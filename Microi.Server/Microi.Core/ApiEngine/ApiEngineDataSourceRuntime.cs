using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 接口引擎中的数据源类型运行时与历史数据迁移公共契约。
    ///
    /// 新接口只保留 sys_apiengine.ApiV8Code 一个源码字段；DataSourceType
    /// 决定该字段按 JavaScript、SQL 或 JSON 解释。旧 sys_datasource 的多源码
    /// 字段仅在一次性迁移时读取，不能继续扩散到接口引擎物理结构。
    /// </summary>
    public static class ApiEngineDataSourceRuntime
    {
        public const string V8Type = "V8";
        public const string SqlType = "SQL";
        public const string JsonType = "JSON";
        public const string ApiType = "API";
        public const string MigratedNamePrefix = "【数据源引擎迁移】";
        public const string MigrationMarker = "MICROI_DATA_SOURCE_MIGRATION_V1";

        public static string NormalizeType(string value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (normalized.Length == 0) return V8Type;
            if (normalized.IndexOf("V8", StringComparison.OrdinalIgnoreCase) >= 0)
                return V8Type;
            if (normalized.IndexOf("SQL", StringComparison.OrdinalIgnoreCase) >= 0
                || normalized.IndexOf("Sql", StringComparison.OrdinalIgnoreCase) >= 0)
                return SqlType;
            if (normalized.IndexOf("JSON", StringComparison.OrdinalIgnoreCase) >= 0
                || normalized.IndexOf("Normal", StringComparison.OrdinalIgnoreCase) >= 0
                || normalized.Contains("普通数据源"))
                return JsonType;
            if (normalized.IndexOf("API", StringComparison.OrdinalIgnoreCase) >= 0
                || normalized.IndexOf("Api", StringComparison.OrdinalIgnoreCase) >= 0)
                return ApiType;
            return normalized.ToUpperInvariant();
        }

        public static string SelectLegacyCode(
            JObject source,
            out string normalizedType,
            out string sourceField)
        {
            source ??= new JObject();
            normalizedType = NormalizeType(source["DataSourceType"].Val<string>());
            sourceField = normalizedType switch
            {
                SqlType => "SqlDataSource",
                JsonType => FirstNonEmptyField(source, "JsonDataSource", "NormalDataSource"),
                ApiType => "ApiDataSource",
                _ => "V8DataSource"
            };

            var code = source[sourceField].Val<string>();
            if (!code.DosIsNullOrWhiteSpace()) return code;

            // 极老租户可能保存了未知/本地化类型，但仍只有一个源码字段有值。
            // 优先级保持当前正式运行时 V8 -> SQL -> JSON -> 普通 -> API 的顺序，
            // 以“完整保留源码”优先于因类型脏值丢弃历史记录。
            foreach (var candidate in new[]
            {
                "V8DataSource", "SqlDataSource", "JsonDataSource",
                "NormalDataSource", "ApiDataSource"
            })
            {
                var candidateCode = source[candidate].Val<string>();
                if (candidateCode.DosIsNullOrWhiteSpace()) continue;
                sourceField = candidate;
                normalizedType = candidate switch
                {
                    "SqlDataSource" => SqlType,
                    "JsonDataSource" => JsonType,
                    "NormalDataSource" => JsonType,
                    "ApiDataSource" => ApiType,
                    _ => V8Type
                };
                return candidateCode;
            }

            return string.Empty;
        }

        public static string BuildFallbackApiEngineKey(string sourceId)
        {
            var normalized = new string((sourceId ?? string.Empty)
                .Trim()
                .ToLowerInvariant()
                .Where(character => char.IsLetterOrDigit(character) || character == '-')
                .ToArray());
            if (normalized.Length > 0 && normalized.Length <= 47)
                return "ds-" + normalized;

            return "ds-" + ComputeHex("key:" + (sourceId ?? string.Empty)).Substring(0, 32);
        }

        public static string BuildFallbackApiEngineId(string sourceId)
        {
            var bytes = ComputeHash("id:" + (sourceId ?? string.Empty)).Take(16).ToArray();
            bytes[6] = (byte)((bytes[6] & 0x0f) | 0x40);
            bytes[8] = (byte)((bytes[8] & 0x3f) | 0x80);
            return new Guid(bytes).ToString();
        }

        public static string BuildMigratedName(string sourceName)
        {
            var name = MigratedNamePrefix + ((sourceName ?? string.Empty).Trim());
            return name.Length <= 50 ? name : name.Substring(0, 50);
        }

        public static string BuildMigrationRemark(
            string sourceId,
            string sourceKey,
            string sourceType,
            string sourceField,
            string legacyRemark)
        {
            var marker = string.Join("\n", new[]
            {
                MigrationMarker,
                "LegacyDataSourceId: " + (sourceId ?? string.Empty),
                "LegacyDataSourceKey: " + (sourceKey ?? string.Empty),
                "LegacyDataSourceType: " + (sourceType ?? string.Empty),
                "LegacyCodeField: " + (sourceField ?? string.Empty)
            });
            return (marker + (legacyRemark.DosIsNullOrWhiteSpace()
                ? string.Empty
                : "\n\n" + legacyRemark.Trim())).Trim();
        }

        public static bool IsMigrationForSource(JObject apiEngine, string sourceId)
        {
            if (apiEngine == null || sourceId.DosIsNullOrWhiteSpace()) return false;
            var remark = apiEngine["ApiRemark"].Val<string>() ?? string.Empty;
            return remark.Contains(MigrationMarker)
                && remark.Contains("LegacyDataSourceId: " + sourceId);
        }

        public static DosResult ExecuteNonV8(
            string dataSourceType,
            string code,
            DbSession dbSession,
            JObject currentUser)
        {
            var normalizedType = NormalizeType(dataSourceType);
            try
            {
                if (normalizedType == SqlType)
                {
                    if (dbSession == null) return new DosResult(0, null, "当前租户数据库不可用。");
                    var sql = ReplaceCurrentUser(code ?? string.Empty, currentUser);
                    if (sql.DosIsNullOrWhiteSpace()) return new DosResult(0, null, "ApiV8Code SQL 不能为空。");
                    return new DosResult(1, dbSession.FromSql(sql).ToList<dynamic>());
                }

                if (normalizedType == JsonType)
                {
                    if ((code ?? string.Empty).DosIsNullOrWhiteSpace())
                        return new DosResult(0, null, "ApiV8Code JSON 不能为空。");
                    return new DosResult(1, JToken.Parse(code));
                }

                if (normalizedType == ApiType)
                {
                    return new DosResult(
                        0,
                        null,
                        "历史 ApiDataSource 没有稳定的服务端执行协议，源码已完整迁移到 ApiV8Code；请将其改写为 V8.Http 后把类型切换为 V8。");
                }

                return new DosResult(0, null, $"不支持的接口引擎数据源类型：{dataSourceType}");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"执行接口引擎[{normalizedType}]数据源失败：{ex.Message}");
            }
        }

        public static string ReplaceCurrentUser(string source, JObject currentUser)
        {
            var result = source ?? string.Empty;
            if (currentUser == null) return result;
            foreach (var property in currentUser.Properties())
            {
                if (!IsCurrentUserScalar(property.Value.Type)) continue;
                result = result.Replace(
                    "$CurrentUser." + property.Name + "$",
                    property.Value.Type == JTokenType.Null
                        ? string.Empty
                        : property.Value.Val<string>() ?? string.Empty);
            }
            return result;
        }

        private static string FirstNonEmptyField(JObject source, params string[] names)
        {
            return names.FirstOrDefault(name => !source[name].Val<string>().DosIsNullOrWhiteSpace())
                ?? names.First();
        }

        private static bool IsCurrentUserScalar(JTokenType type)
        {
            return type == JTokenType.Boolean
                || type == JTokenType.Date
                || type == JTokenType.Float
                || type == JTokenType.Guid
                || type == JTokenType.Integer
                || type == JTokenType.None
                || type == JTokenType.Null
                || type == JTokenType.String
                || type == JTokenType.TimeSpan
                || type == JTokenType.Undefined;
        }

        private static byte[] ComputeHash(string value)
        {
            using var sha256 = SHA256.Create();
            return sha256.ComputeHash(Encoding.UTF8.GetBytes(value ?? string.Empty));
        }

        private static string ComputeHex(string value)
        {
            return string.Concat(ComputeHash(value).Select(item => item.ToString("x2")));
        }
    }
}
