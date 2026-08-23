using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 租户自有系统设置的可信读取与加密边界。
    ///
    /// mci_system_setting 存在于每个租户自己的业务库中；共享数据库、Redis、MinIO 等
    /// 部署级配置仍由主控面的 sys_osclients 管理。mci_system_setting 只属于后端私有
    /// 执行面，任何记录都不得进入匿名 SysConfig 或浏览器 V8.SysConfig。公开展示配置
    /// 必须建模为 sys_config 的实体字段。
    /// </summary>
    public static class TenantSystemSettingsSecurity
    {
        public const string TableName = "mci_system_setting";
        public const string MapProviderKey = "Map.Provider";
        public const string BaiduMapClientKey = "Map.Baidu.JsApiKey";
        public const string AMapClientKey = "Map.AMap.JsApiKey";
        public const string AMapSecurityJsCodeKey = "Map.AMap.SecurityJsCode";
        public const string AMapServiceHostKey = "Map.AMap.ServiceHost";
        public const string TencentMapClientKey = "Map.Tencent.JsApiKey";
        private const string CipherPurpose = "Microi.TenantSystemSetting:v1:";

        private static readonly Regex KeyRegex = new Regex(
            @"^[A-Za-z][A-Za-z0-9_.:-]{0,199}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly string[] SensitiveKeyFragments =
        {
            "password", "passwd", "pwd", "secret", "token", "credential",
            "privatekey", "private_key", "accesskey", "apikey", "api_key",
            "connectionstring", "connection_string", "dbconn", "redis",
            "minio", "authsecret", "clientsecret", "signingkey", "aeskey",
            "securityjscode"
        };

        private static readonly HashSet<string> MigratedPublicSettingKeySet =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Login.Identity.Enabled",
                "Login.Passkey.Enabled",
                "Login.Authenticator.Enabled",
                "Security.PasswordChange.RequireStepUp",
                "Login.External.Enabled",
                "Login.Face.Enabled",
                "Login.Gitee.Enabled",
                "Login.WeChat.Enabled",
                "Login.GitHub.Enabled",
                "Login.Passkey.Display",
                "Login.Authenticator.Display",
                "Login.Gitee.Display",
                "Login.WeChat.Display",
                "Login.GitHub.Display"
            };

        /// <summary>
        /// 已迁移到 sys_config 实体字段的公开功能/展示开关。旧行只作为未安装新版
        /// 系统设置应用时的只读兼容回退，不能继续通过私有设置管理端增删改。
        /// </summary>
        public static IReadOnlyCollection<string> MigratedPublicSettingKeys =>
            MigratedPublicSettingKeySet.ToArray();

        public static bool IsMigratedPublicSettingKey(string key)
        {
            return MigratedPublicSettingKeySet.Contains((key ?? string.Empty).Trim());
        }

        public static string NormalizeKey(string key)
        {
            var value = (key ?? string.Empty).Trim();
            if (!KeyRegex.IsMatch(value))
            {
                throw new ArgumentException(
                    "设置 Key 必须以字母开头，只能包含字母、数字、点、冒号、下划线和中划线，长度为1到200。",
                    nameof(key));
            }
            return value;
        }

        public static bool IsSensitiveKey(string key)
        {
            var normalized = (key ?? string.Empty)
                .Replace("-", string.Empty)
                .Replace(".", string.Empty)
                .Replace(":", string.Empty)
                .ToLowerInvariant();
            return normalized.Length == 0
                   || SensitiveKeyFragments.Any(fragment => normalized.Contains(
                       fragment.Replace("_", string.Empty), StringComparison.Ordinal));
        }

        public static bool CanExposePublicly(JObject row)
        {
            // IsPublic 仅作为历史物理字段保留；新安全边界不再允许动态设置下发浏览器。
            return false;
        }

        public static JObject CreatePublicProjection(IEnumerable<JObject> rows)
        {
            return new JObject();
        }

        public static IReadOnlyDictionary<string, TenantSystemSettingValue> LoadSnapshot(string osClient)
        {
            var output = new Dictionary<string, TenantSystemSettingValue>(StringComparer.OrdinalIgnoreCase);
            try { osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient); }
            catch { return output; }

            var cacheKey = GetSnapshotCacheKey(osClient);
            try
            {
                var cached = MicroiEngine.CacheTenant.Cache(osClient)
                    .Get<List<TenantSystemSettingValue>>(cacheKey);
                if (cached != null)
                {
                    AddSnapshotValues(output, cached, osClient);
                    return output;
                }
            }
            catch
            {
                // Redis 不可用时继续回源当前租户数据库。
            }

            try
            {
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null) return output;
                var rows = client.Db.FromSql(
                        $"SELECT Id,ConfigKey,ConfigValue,SecretCipher,ValueType,Category,Description,IsPublic,IsSecret,IsEnabled,Sort,ValueSource " +
                        // 管理快照必须保留停用行，管理员才能重新启用；所有运行时读取器
                        // （GetBool/GetText/CreateV8Projection）仍逐项检查 IsEnabled 并失败关闭。
                        $"FROM {TableName} WHERE (IsDeleted<>1 OR IsDeleted IS NULL) " +
                        "ORDER BY Sort ASC, ConfigKey ASC")
                    .ToList<dynamic>() ?? new List<dynamic>();
                var values = new List<TenantSystemSettingValue>();
                foreach (var raw in rows)
                {
                    var row = raw as JObject ?? JObject.FromObject((object)raw);
                    values.Add(new TenantSystemSettingValue
                    {
                        Id = row["Id"]?.ToString(),
                        Key = row["ConfigKey"]?.ToString(),
                        Value = row["ConfigValue"]?.ToString() ?? string.Empty,
                        SecretCipher = row["SecretCipher"]?.ToString() ?? string.Empty,
                        ValueType = NormalizeValueType(row["ValueType"]?.ToString()),
                        Category = row["Category"]?.ToString() ?? string.Empty,
                        Description = row["Description"]?.ToString() ?? string.Empty,
                        IsPublic = Flag(row["IsPublic"], false),
                        IsSecret = Flag(row["IsSecret"], false),
                        IsEnabled = Flag(row["IsEnabled"], true),
                        Sort = row["Sort"]?.Val<int>() ?? 0,
                        ValueSource = row["ValueSource"]?.ToString() ?? string.Empty,
                        TenantOsClient = osClient
                    });
                }
                AddSnapshotValues(output, values, osClient);
                if (output.Count > 0)
                {
                    try
                    {
                        MicroiEngine.CacheTenant.Cache(osClient).Set(
                            cacheKey,
                            output.Values.ToList(),
                            TimeSpan.FromMinutes(10));
                    }
                    catch
                    {
                        // 缓存写入失败不影响当前请求使用数据库结果。
                    }
                }
            }
            catch
            {
                // 兼容尚未安装官方应用包的旧租户；调用方继续使用历史 sys_config/sys_osclients。
            }
            return output;
        }

        public static string GetSnapshotCacheKey(string osClient)
        {
            osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            return $"Microi:{osClient}:TenantSystemSettings:Snapshot:v1";
        }

        private static void AddSnapshotValues(
            IDictionary<string, TenantSystemSettingValue> output,
            IEnumerable<TenantSystemSettingValue> values,
            string osClient)
        {
            foreach (var item in values ?? Enumerable.Empty<TenantSystemSettingValue>())
            {
                if (item == null) continue;
                string key;
                try { key = NormalizeKey(item.Key); }
                catch { continue; }
                // 重复 Key 失败关闭：只接受排序后的第一条，数据库唯一索引是最终约束。
                if (output.ContainsKey(key)) continue;
                item.Key = key;
                item.TenantOsClient = osClient;
                output[key] = item;
            }
        }

        public static JObject LoadPublicProjection(string osClient)
        {
            return new JObject();
        }

        /// <summary>
        /// 读取当前租户 sys_config 的服务端快照。这里只用于解析已经声明为公开实体字段的
        /// 行为开关；旧租户尚未安装新增物理列时查询失败关闭，并继续走兼容回退。
        /// </summary>
        public static JObject LoadTenantSysConfigSnapshot(string osClient)
        {
            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null) return new JObject();
                var raw = client.Db.FromSql("SELECT * FROM sys_config").First<dynamic>();
                return raw as JObject ?? (raw == null ? new JObject() : JObject.FromObject((object)raw));
            }
            catch
            {
                // 兼容尚未安装新版系统设置应用、尚无 sys_config 或物理列不完整的旧租户。
                return new JObject();
            }
        }

        /// <summary>
        /// 公开行为开关以 sys_config 显式值为唯一新事实源；字段缺失/空值时才读取历史
        /// mci_system_setting，再回退 sys_osclients 的存量字段或代码安全默认值。
        /// </summary>
        public static bool GetPublicBehaviorBool(
            JObject sysConfig,
            string sysConfigField,
            IReadOnlyDictionary<string, TenantSystemSettingValue> legacySettings,
            string legacySettingKey,
            bool fallback)
        {
            var property = sysConfig?.Properties().FirstOrDefault(item =>
                string.Equals(item.Name, sysConfigField, StringComparison.OrdinalIgnoreCase));
            var value = property?.Value;
            if (value != null
                && value.Type != JTokenType.Null
                && (value.Type != JTokenType.String || !string.IsNullOrWhiteSpace(value.ToString())))
            {
                return Flag(value, fallback);
            }

            return GetBool(
                legacySettings,
                legacySettingKey,
                fallback,
                preferLegacyForOfficialDefault: true);
        }

        /// <summary>
        /// 创建后端 V8 可用的当前租户设置投影。后端接口引擎和后端 V8 事件属于
        /// 可信执行面，因此可以读取全部启用设置；Secret 只在这里按当前租户解密，
        /// 不会进入匿名 GetSysConfig 或浏览器 V8.SysConfig。
        /// </summary>
        public static JObject LoadV8Projection(string osClient)
        {
            return CreateV8Projection(LoadSnapshot(osClient).Values);
        }

        public static JObject CreateV8Projection(IEnumerable<TenantSystemSettingValue> settings)
        {
            var result = new JObject();
            foreach (var item in settings ?? Enumerable.Empty<TenantSystemSettingValue>())
            {
                if (item == null || !item.IsEnabled) continue;

                string key;
                try { key = NormalizeKey(item.Key); }
                catch { continue; }

                if (!item.IsSecret)
                {
                    result[key] = ParseTypedValue(new JValue(item.Value ?? string.Empty), item.ValueType);
                    continue;
                }

                if (string.IsNullOrWhiteSpace(item.SecretCipher)
                    || string.IsNullOrWhiteSpace(item.TenantOsClient))
                {
                    continue;
                }

                try
                {
                    result[key] = UnprotectSecret(item.TenantOsClient, key, item.SecretCipher);
                }
                catch
                {
                    // 单条损坏或不可解密的 Secret 失败关闭，不影响其它后端配置。
                }
            }
            return result;
        }

        public static string GetText(
            IReadOnlyDictionary<string, TenantSystemSettingValue> settings,
            string key,
            string fallback = "",
            bool decryptSecret = true)
        {
            if (settings == null || !settings.TryGetValue(key, out var item) || !item.IsEnabled) return fallback;
            if (!item.IsSecret) return item.Value ?? fallback;
            if (!decryptSecret || string.IsNullOrWhiteSpace(item.SecretCipher)) return fallback;
            return UnprotectSecret(item.TenantOsClient, item.Key, item.SecretCipher);
        }

        /// <summary>
        /// 将表单字段或租户默认值规范为地图供应商标识。System 表示继续使用租户默认值；
        /// 未识别的历史值失败回退到调用方指定的安全默认值。
        /// </summary>
        public static string NormalizeMapProvider(string provider, string fallback = "System")
        {
            var value = (provider ?? string.Empty).Trim();
            if (value.Length == 0) return fallback;
            if (new[] { "System", "Default" }.Any(item => string.Equals(item, value, StringComparison.OrdinalIgnoreCase)))
                return "System";
            if (new[] { "AMap", "Gaode", "高德" }.Any(item => string.Equals(item, value, StringComparison.OrdinalIgnoreCase)))
                return "AMap";
            if (new[] { "Baidu", "BMap", "百度" }.Any(item => string.Equals(item, value, StringComparison.OrdinalIgnoreCase)))
                return "Baidu";
            if (new[] { "Tencent", "QQ", "QQMap", "腾讯" }.Any(item => string.Equals(item, value, StringComparison.OrdinalIgnoreCase)))
                return "Tencent";
            return fallback;
        }

        /// <summary>
        /// 只解析浏览器地图 SDK 必需的当前供应商配置。租户私密设置优先；尚未启用模板时
        /// 回退历史 sys_config 字段，保证升级后旧地图立即可用。返回对象不会包含其它供应商
        /// 的 Key，也不得并入 SysConfig 或任何共享浏览器缓存。
        /// </summary>
        public static TenantMapRuntimeConfiguration ResolveMapRuntimeConfiguration(
            IReadOnlyDictionary<string, TenantSystemSettingValue> settings,
            string requestedProvider,
            JObject legacySysConfig)
        {
            settings ??= new Dictionary<string, TenantSystemSettingValue>(StringComparer.OrdinalIgnoreCase);
            legacySysConfig ??= new JObject();

            var provider = NormalizeMapProvider(requestedProvider);
            if (string.Equals(provider, "System", StringComparison.OrdinalIgnoreCase))
            {
                provider = NormalizeMapProvider(GetText(settings, MapProviderKey, "System"));
            }
            if (string.Equals(provider, "System", StringComparison.OrdinalIgnoreCase))
            {
                // Baidu is checked first to preserve the historical default used by existing fields.
                if (HasConfiguredMapCredential(settings, BaiduMapClientKey, legacySysConfig, "BaiduAK")) provider = "Baidu";
                else if (HasConfiguredMapCredential(settings, AMapClientKey, legacySysConfig, "AMapKey")) provider = "AMap";
                else if (HasConfiguredMapCredential(settings, TencentMapClientKey, legacySysConfig, "TencentMapKey", "TencentMapJsKey", "QQMapKey")) provider = "Tencent";
                else provider = "Baidu";
            }

            var result = new TenantMapRuntimeConfiguration { Provider = provider };
            switch (provider)
            {
                case "AMap":
                    result.ClientKey = ResolveMapValue(settings, AMapClientKey, legacySysConfig, out var amapTenant, "AMapKey");
                    result.SecurityJsCode = ResolveMapValue(settings, AMapSecurityJsCodeKey, legacySysConfig, out _, "AMapSecurityJsCode", "AMapSecret");
                    result.ServiceHost = ResolveMapValue(settings, AMapServiceHostKey, legacySysConfig, out _, "AMapServiceHost");
                    result.Source = amapTenant ? "Tenant" : "Legacy";
                    break;
                case "Tencent":
                    result.ClientKey = ResolveMapValue(settings, TencentMapClientKey, legacySysConfig, out var tencentTenant, "TencentMapKey", "TencentMapJsKey", "QQMapKey");
                    result.Source = tencentTenant ? "Tenant" : "Legacy";
                    break;
                default:
                    result.Provider = "Baidu";
                    result.ClientKey = ResolveMapValue(settings, BaiduMapClientKey, legacySysConfig, out var baiduTenant, "BaiduAK");
                    result.Source = baiduTenant ? "Tenant" : "Legacy";
                    break;
            }
            return result;
        }

        public static bool TryNormalizeMapServiceHost(string value, out string normalized)
        {
            normalized = (value ?? string.Empty).Trim().TrimEnd('/');
            if (normalized.Length == 0) return true;
            if (normalized.Length > 2048
                || !Uri.TryCreate(normalized, UriKind.Absolute, out var uri)
                || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
                || !string.IsNullOrWhiteSpace(uri.UserInfo)
                || !string.IsNullOrWhiteSpace(uri.Query)
                || !string.IsNullOrWhiteSpace(uri.Fragment))
            {
                normalized = string.Empty;
                return false;
            }
            return true;
        }

        private static bool HasConfiguredMapCredential(
            IReadOnlyDictionary<string, TenantSystemSettingValue> settings,
            string key,
            JObject legacySysConfig,
            params string[] legacyKeys)
        {
            if (settings.TryGetValue(key, out var item) && item != null && item.IsEnabled)
            {
                if (item.IsSecret && !string.IsNullOrWhiteSpace(item.SecretCipher)) return true;
                if (!item.IsSecret && !string.IsNullOrWhiteSpace(item.Value)) return true;
            }
            return !string.IsNullOrWhiteSpace(GetLegacyText(legacySysConfig, legacyKeys));
        }

        private static string ResolveMapValue(
            IReadOnlyDictionary<string, TenantSystemSettingValue> settings,
            string key,
            JObject legacySysConfig,
            out bool fromTenant,
            params string[] legacyKeys)
        {
            fromTenant = false;
            if (settings.TryGetValue(key, out var item) && item != null && item.IsEnabled)
            {
                var tenantValue = GetText(settings, key, string.Empty);
                if (!string.IsNullOrWhiteSpace(tenantValue))
                {
                    fromTenant = true;
                    return NormalizeMapRuntimeText(tenantValue, key);
                }
            }
            return NormalizeMapRuntimeText(GetLegacyText(legacySysConfig, legacyKeys), key);
        }

        private static string GetLegacyText(JObject legacySysConfig, params string[] keys)
        {
            foreach (var key in keys ?? Array.Empty<string>())
            {
                var property = legacySysConfig?.Properties().FirstOrDefault(item =>
                    string.Equals(item.Name, key, StringComparison.OrdinalIgnoreCase));
                var value = property?.Value?.Type == JTokenType.Null ? string.Empty : property?.Value?.ToString();
                if (!string.IsNullOrWhiteSpace(value)) return value;
            }
            return string.Empty;
        }

        private static string NormalizeMapRuntimeText(string value, string key)
        {
            var text = new string((value ?? string.Empty).Where(ch => !char.IsControl(ch)).ToArray()).Trim();
            if (text.Length > 4096) throw new ArgumentException($"地图设置 {key} 超出允许长度。");
            return text;
        }

        public static bool GetBool(
            IReadOnlyDictionary<string, TenantSystemSettingValue> settings,
            string key,
            bool fallback,
            bool preferLegacyForOfficialDefault = false)
        {
            if (settings == null || !settings.TryGetValue(key, out var item) || !item.IsEnabled || item.IsSecret)
                return fallback;
            if (preferLegacyForOfficialDefault
                && string.Equals(item.ValueSource, "OfficialDefault", StringComparison.OrdinalIgnoreCase))
                return fallback;
            return Flag(new JValue(item.Value ?? string.Empty), fallback);
        }

        public static string ProtectSecret(string osClient, string key, string plainText)
        {
            osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            key = NormalizeKey(key);
            if (plainText == null) return null;
            return EncryptHelper.AESEncrypt(plainText, ResolveEncryptionKey(osClient, key));
        }

        public static string UnprotectSecret(string osClient, string key, string cipherText)
        {
            osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            key = NormalizeKey(key);
            if (string.IsNullOrWhiteSpace(cipherText)) return string.Empty;
            return EncryptHelper.AESDecrypt(cipherText, ResolveEncryptionKey(osClient, key));
        }

        public static string ComputeRevealActionHash(string osClient, string settingId)
        {
            osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            var id = (settingId ?? string.Empty).Trim();
            if (id.Length == 0 || id.Length > 80) throw new ArgumentException("设置 Id 无效。", nameof(settingId));
            using (var sha = SHA256.Create())
            {
                var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(
                    $"Microi:RevealTenantSetting:v1:{osClient}:{id}"));
                return string.Concat(bytes.Select(value => value.ToString("x2", CultureInfo.InvariantCulture)));
            }
        }

        public static JToken ParseTypedValue(JToken rawValue, string valueType)
        {
            var text = rawValue?.Type == JTokenType.Null ? string.Empty : rawValue?.ToString() ?? string.Empty;
            switch (NormalizeValueType(valueType))
            {
                case "Bool":
                    return Flag(new JValue(text), false);
                case "Int":
                    return long.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var integer)
                        ? new JValue(integer)
                        : JValue.CreateNull();
                case "Decimal":
                    return decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var number)
                        ? new JValue(number)
                        : JValue.CreateNull();
                case "Json":
                    try { return JToken.Parse(text); }
                    catch { return JValue.CreateNull(); }
                default:
                    return new JValue(text);
            }
        }

        public static string NormalizeValueType(string valueType)
        {
            var value = (valueType ?? string.Empty).Trim();
            return new[] { "String", "Bool", "Int", "Decimal", "Json" }
                .FirstOrDefault(item => string.Equals(item, value, StringComparison.OrdinalIgnoreCase))
                ?? "String";
        }

        private static string ResolveEncryptionKey(string osClient, string key)
        {
            var client = OsClientExtend.GetClient(osClient)
                         ?? throw new InvalidOperationException("当前租户不存在，无法处理系统设置密文。");
            return CipherPurpose + key + ":" + DiyToken.ResolveJwtSigningKey(client);
        }

        private static bool Flag(JToken token, bool fallback)
        {
            if (token == null || token.Type == JTokenType.Null) return fallback;
            if (token.Type == JTokenType.Boolean) return token.Value<bool>();
            if (token.Type == JTokenType.Integer) return token.Value<long>() != 0;
            var value = token.ToString().Trim();
            if (new[] { "1", "true", "yes", "on", "enabled" }.Any(item =>
                    string.Equals(item, value, StringComparison.OrdinalIgnoreCase))) return true;
            if (new[] { "0", "false", "no", "off", "disabled" }.Any(item =>
                    string.Equals(item, value, StringComparison.OrdinalIgnoreCase))) return false;
            return fallback;
        }
    }

    public sealed class TenantSystemSettingValue
    {
        public string Id { get; set; }
        public string Key { get; set; }
        public string Value { get; set; }
        public string SecretCipher { get; set; }
        public string ValueType { get; set; }
        public string Category { get; set; }
        public string Description { get; set; }
        public bool IsPublic { get; set; }
        public bool IsSecret { get; set; }
        public bool IsEnabled { get; set; }
        public int Sort { get; set; }
        public string ValueSource { get; set; }
        [JsonIgnore]
        public string TenantOsClient { get; set; }
    }

    public sealed class TenantMapRuntimeConfiguration
    {
        public string Provider { get; set; }
        public string ClientKey { get; set; }
        public string SecurityJsCode { get; set; }
        public string ServiceHost { get; set; }
        public string Source { get; set; }
    }
}
