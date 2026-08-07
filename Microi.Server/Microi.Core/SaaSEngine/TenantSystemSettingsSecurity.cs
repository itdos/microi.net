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
    /// 部署级配置仍由主控面的 sys_osclients 管理。公开设置由每条记录的 IsPublic 动态
    /// 决定，但 Secret/Token/Password/Connection 等高风险名称始终失败关闭。
    /// </summary>
    public static class TenantSystemSettingsSecurity
    {
        public const string TableName = "mci_system_setting";
        private const string CipherPurpose = "Microi.TenantSystemSetting:v1:";

        private static readonly Regex KeyRegex = new Regex(
            @"^[A-Za-z][A-Za-z0-9_.:-]{0,199}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly string[] SensitiveKeyFragments =
        {
            "password", "passwd", "pwd", "secret", "token", "credential",
            "privatekey", "private_key", "accesskey", "apikey", "api_key",
            "connectionstring", "connection_string", "dbconn", "redis",
            "minio", "authsecret", "clientsecret", "signingkey", "aeskey"
        };

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
            if (row == null || !Flag(row["IsEnabled"], true) || !Flag(row["IsPublic"], false)) return false;
            if (Flag(row["IsSecret"], false)) return false;
            var key = row["ConfigKey"]?.ToString();
            try { key = NormalizeKey(key); }
            catch { return false; }
            return !IsSensitiveKey(key);
        }

        public static JObject CreatePublicProjection(IEnumerable<JObject> rows)
        {
            var result = new JObject();
            foreach (var row in rows ?? Enumerable.Empty<JObject>())
            {
                if (!CanExposePublicly(row)) continue;
                var key = NormalizeKey(row["ConfigKey"]?.ToString());
                result[key] = ParseTypedValue(row["ConfigValue"], row["ValueType"]?.ToString());
            }
            return result;
        }

        public static IReadOnlyDictionary<string, TenantSystemSettingValue> LoadSnapshot(string osClient)
        {
            var output = new Dictionary<string, TenantSystemSettingValue>(StringComparer.OrdinalIgnoreCase);
            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null) return output;
                var rows = client.Db.FromSql(
                        $"SELECT Id,ConfigKey,ConfigValue,SecretCipher,ValueType,Category,Description,IsPublic,IsSecret,IsEnabled,Sort,ValueSource " +
                        $"FROM {TableName} WHERE (IsDeleted<>1 OR IsDeleted IS NULL) AND (IsEnabled=1 OR IsEnabled IS NULL) " +
                        "ORDER BY Sort ASC, ConfigKey ASC")
                    .ToList<dynamic>() ?? new List<dynamic>();
                foreach (var raw in rows)
                {
                    var row = raw as JObject ?? JObject.FromObject((object)raw);
                    var key = NormalizeKey(row["ConfigKey"]?.ToString());
                    // 重复 Key 失败关闭：只接受排序后的第一条，数据库唯一索引是最终约束。
                    if (output.ContainsKey(key)) continue;
                    output[key] = new TenantSystemSettingValue
                    {
                        Id = row["Id"]?.ToString(),
                        Key = key,
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
                    };
                }
            }
            catch
            {
                // 兼容尚未安装官方应用包的旧租户；调用方继续使用历史 sys_config/sys_osclients。
            }
            return output;
        }

        public static JObject LoadPublicProjection(string osClient)
        {
            var rows = LoadSnapshot(osClient).Values.Select(item => new JObject
            {
                ["ConfigKey"] = item.Key,
                ["ConfigValue"] = item.Value,
                ["ValueType"] = item.ValueType,
                ["IsPublic"] = item.IsPublic ? 1 : 0,
                ["IsSecret"] = item.IsSecret ? 1 : 0,
                ["IsEnabled"] = item.IsEnabled ? 1 : 0
            });
            return CreatePublicProjection(rows);
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
}
