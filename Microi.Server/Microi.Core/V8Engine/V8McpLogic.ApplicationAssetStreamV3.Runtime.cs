using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Runtime wiring for application-asset protocol v3. Object writes are
    /// immutable release writes only. The authoritative runtime switch is the
    /// sys_microistore pointer committed together with mci_ai_app_version in one
    /// primary-database transaction.
    /// </summary>
    public static partial class V8McpLogic
    {
        private const int ApplicationAssetStreamV3ProtocolVersion = 3;
        private const int ApplicationAssetStreamV3RetryAfterMs = 5000;
        private const long ApplicationAssetStreamV3JavaScriptMaxSafeInteger = 9007199254740991L;
        private const int ApplicationAssetV3RecoveryPageSize = 25;
        private const int ApplicationAssetV3RecoveryMaxPagesPerTenant = 2;
        private const int ApplicationAssetV3RecoveryMaxCandidatesPerRound = 200;
        private const int ApplicationAssetV3RouteSnapshotMaxBytes = 4 * 1024 * 1024;
        private const int ApplicationAssetV3RouteSnapshotMaxRoutes = 1000;

        private enum ApplicationAssetV3SqlDialect
        {
            MySql,
            SqlServer,
            Oracle
        }

        private static ApplicationAssetV3SqlDialect ResolveApplicationAssetV3SqlDialect(
            string osClient)
        {
            var client = OsClientExtend.GetClient(osClient);
            if (client?.Db?.Db?.DbProvider == null)
                throw new InvalidOperationException("未找到租户主库方言：" + osClient);
            return client.Db.Db.DbProvider.DatabaseType switch
            {
                DatabaseType.MySql => ApplicationAssetV3SqlDialect.MySql,
                DatabaseType.SqlServer => ApplicationAssetV3SqlDialect.SqlServer,
                DatabaseType.SqlServer9 => ApplicationAssetV3SqlDialect.SqlServer,
                DatabaseType.Oracle => ApplicationAssetV3SqlDialect.Oracle,
                var unsupported => throw new NotSupportedException(
                    "应用资产流 v3 暂不支持数据库类型：" + unsupported)
            };
        }

        private static string QuoteApplicationAssetV3Identifier(
            ApplicationAssetV3SqlDialect dialect,
            string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier)
                || !Regex.IsMatch(identifier, "^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.CultureInvariant))
            {
                throw new ArgumentException("SQL 标识符不合法", nameof(identifier));
            }
            return dialect switch
            {
                ApplicationAssetV3SqlDialect.MySql => "`" + identifier + "`",
                ApplicationAssetV3SqlDialect.SqlServer => "[" + identifier + "]",
                ApplicationAssetV3SqlDialect.Oracle => identifier,
                _ => throw new ArgumentOutOfRangeException(nameof(dialect))
            };
        }

        private static string BuildApplicationAssetV3LimitedSelectSql(
            ApplicationAssetV3SqlDialect dialect,
            string tableName,
            string columns,
            string whereSql,
            int limit,
            bool forUpdate)
        {
            if (limit <= 0) throw new ArgumentOutOfRangeException(nameof(limit));
            var table = QuoteApplicationAssetV3Identifier(dialect, tableName);
            if (dialect == ApplicationAssetV3SqlDialect.SqlServer)
            {
                var hint = forUpdate ? " WITH (UPDLOCK,HOLDLOCK)" : string.Empty;
                return $"SELECT TOP ({limit}) {columns} FROM {table}{hint} WHERE {whereSql}";
            }
            if (dialect == ApplicationAssetV3SqlDialect.Oracle)
            {
                return $"SELECT {columns} FROM {table} WHERE ({whereSql}) AND ROWNUM <= {limit}"
                       + (forUpdate ? " FOR UPDATE" : string.Empty);
            }
            return $"SELECT {columns} FROM {table} WHERE {whereSql} LIMIT {limit}"
                   + (forUpdate ? " FOR UPDATE" : string.Empty);
        }

        private static string BuildApplicationAssetV3SelectSql(
            ApplicationAssetV3SqlDialect dialect,
            string tableName,
            string columns,
            string whereSql,
            bool forUpdate)
        {
            var table = QuoteApplicationAssetV3Identifier(dialect, tableName);
            if (dialect == ApplicationAssetV3SqlDialect.SqlServer)
            {
                var hint = forUpdate ? " WITH (UPDLOCK,HOLDLOCK)" : string.Empty;
                return $"SELECT {columns} FROM {table}{hint} WHERE {whereSql}";
            }
            return $"SELECT {columns} FROM {table} WHERE {whereSql}"
                   + (forUpdate ? " FOR UPDATE" : string.Empty);
        }

        private static string BuildApplicationAssetV3InsertSql(
            ApplicationAssetV3SqlDialect dialect,
            string tableName,
            IReadOnlyList<string> columns,
            IReadOnlyList<string> values)
        {
            if (columns == null || values == null || columns.Count == 0 || columns.Count != values.Count)
                throw new ArgumentException("INSERT 列和值数量不一致");
            return "INSERT INTO "
                   + QuoteApplicationAssetV3Identifier(dialect, tableName)
                   + " ("
                   + string.Join(",", columns.Select(column =>
                       QuoteApplicationAssetV3Identifier(dialect, column)))
                   + ") VALUES ("
                   + string.Join(",", values)
                   + ")";
        }

        private static string BuildApplicationAssetV3NullableStringEqualsSql(
            ApplicationAssetV3SqlDialect dialect,
            string column,
            string parameterName)
        {
            var quoted = QuoteApplicationAssetV3Identifier(dialect, column);
            const string sentinel = "__MICROI_V3_NULL__";
            return $"COALESCE({quoted},'{sentinel}')=COALESCE({parameterName},'{sentinel}')";
        }

        public static IReadOnlyList<string> GetApplicationAssetV3LegacyPackageColumnsClearedOnPointerCommit()
        {
            return new[] { "AppPakcet", "AiAppZipFiles", "AiAppPackageManifest" };
        }

        public static string ReadApplicationAssetV3NullableStringFact(JObject row, string name)
        {
            var token = row?.GetValue(name, StringComparison.OrdinalIgnoreCase);
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                return null;
            return token.Type == JTokenType.String
                ? token.Value<string>()
                : token.ToString(Formatting.None);
        }

        public static string ValidateApplicationAssetV3ExpectedPointerBaselines(
            JObject app,
            string expectedActivePublishVersionId,
            string expectedCommittedPublishVersionId)
        {
            // Pointer ids are nullable database facts. SafeJString intentionally
            // collapses null to "" for display-oriented callers, which would make
            // a legitimate first v3 release fail its exact null baseline CAS.
            if (!string.Equals(
                    ReadApplicationAssetV3NullableStringFact(app, "ActivePublishVersionId"),
                    expectedActivePublishVersionId,
                    StringComparison.Ordinal))
            {
                return "ExpectedActivePublishVersionId 不一致";
            }
            if (!string.Equals(
                    ReadApplicationAssetV3NullableStringFact(app, "CommittedPublishVersionId"),
                    expectedCommittedPublishVersionId,
                    StringComparison.Ordinal))
            {
                return "ExpectedCommittedPublishVersionId 不一致";
            }
            return null;
        }

        public static bool IsApplicationAssetV3ClassicBaseline(
            JObject app,
            int expectedCurrentVersion,
            string expectedAppVersion)
        {
            return SafeJInt(app, "CurrentVersion") == expectedCurrentVersion
                   && string.Equals(
                       ReadApplicationAssetV3NullableStringFact(app, "AppVersion"),
                       expectedAppVersion,
                       StringComparison.Ordinal);
        }

        public static string CanonicalizeApplicationAssetV3RouteSnapshot(string routeSnapshotJson)
        {
            if (routeSnapshotJson == null)
                throw new ArgumentNullException(nameof(routeSnapshotJson));
            if (Encoding.UTF8.GetByteCount(routeSnapshotJson) > ApplicationAssetV3RouteSnapshotMaxBytes)
                throw new ArgumentException("RouteSnapshotJson 超过4MB", nameof(routeSnapshotJson));
            JToken parsed;
            try
            {
                using var textReader = new StringReader(routeSnapshotJson);
                using var jsonReader = new JsonTextReader(textReader)
                {
                    DateParseHandling = DateParseHandling.None,
                    FloatParseHandling = FloatParseHandling.Decimal
                };
                parsed = JToken.ReadFrom(jsonReader, new JsonLoadSettings
                {
                    DuplicatePropertyNameHandling = DuplicatePropertyNameHandling.Error,
                    CommentHandling = CommentHandling.Load
                });
                if (jsonReader.Read())
                    throw new JsonReaderException("根 JSON 后存在额外 token");
            }
            catch (Exception ex)
            {
                throw new ArgumentException("RouteSnapshotJson 不是有效 JSON：" + ex.Message,
                    nameof(routeSnapshotJson));
            }
            if (!(parsed is JArray))
                throw new ArgumentException("RouteSnapshotJson 根节点必须是数组", nameof(routeSnapshotJson));
            var canonical = CanonicalizeApplicationAssetV3JsonToken(parsed)
                .ToString(Formatting.None);
            if (Encoding.UTF8.GetByteCount(canonical) > ApplicationAssetV3RouteSnapshotMaxBytes)
                throw new ArgumentException("canonical RouteSnapshotJson 超过4MB", nameof(routeSnapshotJson));
            return canonical;
        }

        public static string ComputeApplicationAssetV3RouteSnapshotHash(string routeSnapshotJson)
        {
            return Sha256Hex(CanonicalizeApplicationAssetV3RouteSnapshot(routeSnapshotJson));
        }

        public static string ResolveApplicationAssetV3RequestedRelativePath(
            string relativeAssetPath,
            JObject committedVersion)
        {
            var selected = string.IsNullOrWhiteSpace(relativeAssetPath)
                ? SafeJString(committedVersion, "EntryPath")
                : relativeAssetPath;
            var error = ValidateApplicationAssetV3RelativePath(selected);
            if (error != null) throw new ArgumentException(error, nameof(relativeAssetPath));
            return NormalizeApplicationAssetRelativePath(selected);
        }

        public static string BuildApplicationAssetPublishLockKey(string osClient, string appId)
        {
            var tenant = TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant();
            if (tenant.DosIsNullOrWhiteSpace())
                throw new ArgumentException("OsClient 不能为空", nameof(osClient));
            if (appId.DosIsNullOrWhiteSpace())
                throw new ArgumentException("AppId 不能为空", nameof(appId));
            return $"V8Mcp:ApplicationPublish:{tenant}:{appId}";
        }

        public static string ResolveApplicationAssetV3MicroServiceProjectionUrl(
            string stableResolverPath)
        {
            if (string.IsNullOrWhiteSpace(stableResolverPath)
                || !stableResolverPath.StartsWith(
                    "/micro-app/v3/tenants/",
                    StringComparison.Ordinal))
            {
                throw new ArgumentException(
                    "MicroService MsUrl 必须使用 versionless v3 stable resolver",
                    nameof(stableResolverPath));
            }
            return stableResolverPath;
        }

        private static JToken CanonicalizeApplicationAssetV3JsonToken(JToken token)
        {
            if (token is JObject obj)
            {
                var canonicalObject = new JObject();
                foreach (var property in obj.Properties().OrderBy(
                             property => property.Name,
                             StringComparer.Ordinal))
                {
                    ValidateApplicationAssetV3JsonString(property.Name, "对象键");
                    canonicalObject.Add(property.Name,
                        CanonicalizeApplicationAssetV3JsonToken(property.Value));
                }
                return canonicalObject;
            }
            if (token is JArray array)
            {
                return new JArray(array.Select(CanonicalizeApplicationAssetV3JsonToken));
            }
            if (token is JValue value)
            {
                if (value.Type == JTokenType.Null) return JValue.CreateNull();
                if (value.Type == JTokenType.Boolean) return new JValue(value.Value<bool>());
                if (value.Type == JTokenType.String)
                {
                    var text = value.Value<string>() ?? string.Empty;
                    ValidateApplicationAssetV3JsonString(text, "字符串值");
                    return new JValue(text);
                }
                if (value.Type == JTokenType.Integer)
                {
                    if (!long.TryParse(
                            Convert.ToString(value.Value, CultureInfo.InvariantCulture),
                            NumberStyles.AllowLeadingSign,
                            CultureInfo.InvariantCulture,
                            out var integer)
                        || integer < -ApplicationAssetStreamV3JavaScriptMaxSafeInteger
                        || integer > ApplicationAssetStreamV3JavaScriptMaxSafeInteger)
                    {
                        throw new ArgumentException("RouteSnapshotJson 整数必须位于 JavaScript safe integer 范围");
                    }
                    return new JValue(integer);
                }
                if (value.Type == JTokenType.Float)
                    throw new ArgumentException("RouteSnapshotJson 禁止浮点数与指数数字语义");
            }
            throw new ArgumentException("RouteSnapshotJson 包含不支持的 JSON token：" + token.Type);
        }

        private static void ValidateApplicationAssetV3JsonString(string value, string label)
        {
            try { _ = new UTF8Encoding(false, true).GetByteCount(value ?? string.Empty); }
            catch (EncoderFallbackException)
            {
                throw new ArgumentException("RouteSnapshotJson " + label + " 包含无效 Unicode surrogate");
            }
        }

        private static string ValidateApplicationAssetV3RouteSnapshotFacts(
            string applicationType,
            string routeSnapshotJson,
            string routeSnapshotHash,
            string entryPath,
            IReadOnlyCollection<StreamPublishAsset> assets,
            out JArray routes)
        {
            routes = null;
            string canonical;
            try { canonical = CanonicalizeApplicationAssetV3RouteSnapshot(routeSnapshotJson); }
            catch (Exception ex) { return ex.Message; }
            if (!string.Equals(canonical, routeSnapshotJson, StringComparison.Ordinal))
                return "RouteSnapshotJson 必须是服务端 canonical JSON";
            if (!Regex.IsMatch(routeSnapshotHash ?? string.Empty, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                return "RouteSnapshotHash 必须是64位小写十六进制 SHA-256";
            if (!string.Equals(Sha256Hex(canonical), routeSnapshotHash, StringComparison.Ordinal))
                return "RouteSnapshotHash 与 canonical RouteSnapshotJson 不一致";
            routes = JArray.Parse(canonical);
            if (routes.Count > ApplicationAssetV3RouteSnapshotMaxRoutes)
                return "RouteSnapshotJson 路由数量超过1000";

            var isMicroService = string.Equals(applicationType, "microservice", StringComparison.Ordinal);
            if (!isMicroService)
                return routes.Count == 0 ? null : "Web/UniApp 的 RouteSnapshotJson 必须规范化为 []";
            if (routes.Count == 0) return "MicroService 的 RouteSnapshotJson 不能为空";

            var routePaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var pageKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var assetPaths = new HashSet<string>(
                (assets ?? Array.Empty<StreamPublishAsset>())
                .Select(asset => asset.RelativePath),
                StringComparer.Ordinal);
            for (var index = 0; index < routes.Count; index++)
            {
                if (!(routes[index] is JObject route)) return $"RouteSnapshotJson[{index}] 必须是对象";
                var routePathProperty = route.Property("RoutePath");
                if (routePathProperty?.Value.Type != JTokenType.String)
                    return $"RouteSnapshotJson[{index}].RoutePath 必须显式提供字符串";
                string routePath;
                try { routePath = NormalizeMcpMicroServiceRoutePath(routePathProperty.Value.Value<string>()); }
                catch (Exception ex) { return $"RouteSnapshotJson[{index}].RoutePath 不合法：{ex.Message}"; }
                if (!string.Equals(routePath, routePathProperty.Value.Value<string>(), StringComparison.Ordinal))
                    return $"RouteSnapshotJson[{index}].RoutePath 必须是 canonical route path";
                if (!routePaths.Add(routePath)) return "RouteSnapshotJson.RoutePath 重复：" + routePath;

                var pageKeyProperty = route.Property("PageKey");
                if (pageKeyProperty?.Value.Type != JTokenType.String
                    || string.IsNullOrWhiteSpace(pageKeyProperty.Value.Value<string>()))
                {
                    return $"RouteSnapshotJson[{index}].PageKey 必须显式提供非空字符串";
                }
                if (!pageKeys.Add(pageKeyProperty.Value.Value<string>()))
                    return "RouteSnapshotJson.PageKey 重复：" + pageKeyProperty.Value.Value<string>();
                var routeEntryPath = route.Value<string>("EntryPath") ?? entryPath;
                var routeEntryError = ValidateApplicationAssetV3RelativePath(routeEntryPath);
                if (routeEntryError != null)
                    return $"RouteSnapshotJson[{index}].EntryPath 不合法：{routeEntryError}";
                routeEntryPath = NormalizeApplicationAssetRelativePath(routeEntryPath);
                if (!assetPaths.Contains(routeEntryPath))
                    return $"RouteSnapshotJson[{index}].EntryPath 未包含在 committed asset manifest：{routeEntryPath}";
            }
            return null;
        }

        public static string ValidateApplicationAssetV3MicroServiceProjectionLengths(
            JObject app,
            string appKey,
            string versionNo,
            string entryPath,
            string stableResolverPath,
            JArray routes)
        {
            string Validate(string field, string value, int maxLength)
            {
                value ??= string.Empty;
                try { ValidateApplicationAssetV3JsonString(value, field); }
                catch (ArgumentException ex) { return ex.Message; }
                return value.Length <= maxLength
                    ? null
                    : $"MicroService projection {field} UTF-16 长度超过数据库上限 {maxLength}";
            }

            var error = Validate("MsKey", appKey, 50)
                        ?? Validate(
                            "MsName",
                            SafeJString(app, "Name", SafeJString(app, "AppName", appKey)),
                            50)
                        ?? Validate("MsUrl", stableResolverPath, 500)
                        ?? Validate("EntryPath", entryPath, 200)
                        ?? Validate("BuildVersion", versionNo, 50);
            if (error != null) return error;
            if (routes == null) return "MicroService projection routes 不能为空";

            for (var index = 0; index < routes.Count; index++)
            {
                if (!(routes[index] is JObject route))
                    return $"MicroService projection route[{index}] 必须是对象";
                var routePath = SafeJString(route, "RoutePath");
                var pageKey = SafeJString(route, "PageKey");
                var pageName = SafeJString(
                    route,
                    "PageName",
                    SafeJString(route, "PageTitle", pageKey));
                var pageTitle = SafeJString(
                    route,
                    "PageTitle",
                    SafeJString(route, "PageName", pageKey));
                var routeEntryPath = route.Value<string>("EntryPath") ?? entryPath;
                var sourceDirName = SafeJString(route, "SourceDirName", appKey);
                var menuUrl = SafeJString(route, "MenuUrl", $"/micro-app/{appKey}{routePath}");
                var prefix = $"route[{index}].";
                error = Validate(prefix + "PageKey", pageKey, 100)
                        ?? Validate(prefix + "PageName", pageName, 100)
                        ?? Validate(prefix + "PageTitle", pageTitle, 100)
                        ?? Validate(prefix + "RoutePath", routePath, 200)
                        ?? Validate(prefix + "EntryPath", routeEntryPath, 200)
                        ?? Validate(prefix + "MenuUrl", menuUrl, 500)
                        ?? Validate(prefix + "SourceDirName", sourceDirName, 200);
                if (error != null) return error;
            }
            return null;
        }

        private static string ValidateApplicationAssetV3MicroServiceProjectionSchema(string osClient)
        {
            var client = OsClientExtend.GetClient(osClient);
            if (client?.Db == null) return "未找到租户主库连接";
            var required = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
            {
                ["sys_microiservice"] = new[]
                {
                    "Id", "MsKey", "MsName", "MsType", "Runtime", "StorageMode", "MsUrl", "IsEnable",
                    "PublishTime", "EntryPath", "AssetCount", "TotalSize", "DistHash", "Description",
                    "BuildVersion", "AssetsJson", "AssetManifestJson", "IsDeleted", "CreateTime", "UpdateTime"
                },
                ["sys_microiservice_page"] = new[]
                {
                    "Id", "MicroServiceId", "MicroServiceKey", "PageKey", "PageName", "PageTitle",
                    "RoutePath", "EntryPath", "SourceDirName", "MenuUrl", "Sort", "IsHome", "IsEnable",
                    "BuildVersion", "RouteMetaJson", "IsDeleted", "CreateTime", "UpdateTime"
                }
            };
            foreach (var table in required)
            {
                if (!client.Db.TableExists(table.Key))
                    return "MicroService v3 projection 缺少物理表：" + table.Key;
                var missing = table.Value
                    .Where(column => !client.Db.ColumnExists(table.Key, column))
                    .ToArray();
                if (missing.Length > 0)
                    return $"MicroService v3 projection 表 {table.Key} 缺少字段：{string.Join(",", missing)}";
            }
            return null;
        }

        private static string BuildApplicationAssetV3LegacyPackageClearSql(
            ApplicationAssetV3SqlDialect dialect)
        {
            return string.Join(",", GetApplicationAssetV3LegacyPackageColumnsClearedOnPointerCommit()
                .Select(column => QuoteApplicationAssetV3Identifier(dialect, column) + "=NULL"));
        }

        public sealed class ApplicationAssetStreamGateSnapshot
        {
            public string OsClient { get; set; }
            public string OsClientType { get; set; }
            public string OsClientNetwork { get; set; }
            public string ApplicationStreamPublishMode { get; set; }
            public int ApplicationStreamMinProtocol { get; set; }
            public long ApplicationStreamGateEpoch { get; set; }
        }

        public sealed class ApplicationAssetV3ResolverSnapshot
        {
            public JObject App { get; set; }
            public JObject Version { get; set; }
            public JObject Asset { get; set; }
            public string StableResolverPath { get; set; }
            public string ReleaseAssetPath { get; set; }
            public string PublishFence { get; set; }
            public string VersionFencingToken { get; set; }
            public string RouteSnapshotHash { get; set; }
        }

        private sealed class ApplicationAssetV3ProtocolRequest
        {
            public int ProtocolVersion { get; set; }
            public string PublishMode { get; set; }
            public long ExpectedGateEpoch { get; set; }
            public long ExpectedPublishRowVersion { get; set; }
            public long? ExpectedVersionRowVersion { get; set; }
            public long ExpectedPublishFence { get; set; }
            public string ExpectedActivePublishVersionId { get; set; }
            public string ExpectedCommittedPublishVersionId { get; set; }
            public int ExpectedCurrentVersion { get; set; }
            public string ExpectedAppVersion { get; set; }
            public string RequestId { get; set; }
            public string RequestFingerprint { get; set; }
            public string DeliveryBatchId { get; set; }
            public string SourceManifestHash { get; set; }
            public string RuntimeManifestHash { get; set; }
            public string RouteSnapshotJson { get; set; }
            public string RouteSnapshotHash { get; set; }
        }

        private sealed class ApplicationAssetV3PublishPlan
        {
            public ApplicationAssetV3ReleaseIdentity Identity { get; set; }
            public List<StreamPublishAsset> Assets { get; set; }
            public string VersionNo { get; set; }
            public string EntryPath { get; set; }
            public string ReleasePrefix { get; set; }
            public string ReleaseEntryPath { get; set; }
            public string StableResolverPath { get; set; }
            public string AssetManifestJson { get; set; }
            public int FileCount { get; set; }
            public long TotalSize { get; set; }
            public string RuntimeManifestHash { get; set; }
            public string SourceManifestHash { get; set; }
            public string ApplicationType { get; set; }
            public string AppKey { get; set; }
            public string RouteSnapshotJson { get; set; }
            public string RouteSnapshotHash { get; set; }
            public JArray Routes { get; set; }
        }

        public static string ValidateApplicationAssetStreamGate(
            ApplicationAssetStreamGateSnapshot gate,
            int protocolVersion,
            long? expectedGateEpoch)
        {
            var configurationError = ValidateApplicationAssetStreamGateConfiguration(gate);
            if (configurationError != null) return configurationError;
            var mode = gate.ApplicationStreamPublishMode;
            if (string.Equals(mode, "Drain", StringComparison.Ordinal))
                return "应用资产发布门禁处于 Drain，拒绝所有 stage/finalize";

            if (string.Equals(mode, "LegacyOpen", StringComparison.Ordinal))
            {
                return protocolVersion == 2
                    ? null
                    : "当前租户门禁为 LegacyOpen，仅允许 ProtocolVersion=2";
            }

            if (protocolVersion != ApplicationAssetStreamV3ProtocolVersion)
                return "当前租户门禁为 V3Only，仅允许 ProtocolVersion=3";
            if (!expectedGateEpoch.HasValue)
                return "ProtocolVersion=3 必须提供 ExpectedGateEpoch";
            return expectedGateEpoch.Value == gate.ApplicationStreamGateEpoch
                ? null
                : $"ExpectedGateEpoch 不一致：Expected={expectedGateEpoch.Value}，Actual={gate.ApplicationStreamGateEpoch}";
        }

        public static string ValidateApplicationAssetStreamGateConfiguration(
            ApplicationAssetStreamGateSnapshot gate)
        {
            if (gate == null) return "应用发布门禁不存在";
            var mode = (gate.ApplicationStreamPublishMode ?? string.Empty).Trim();
            if (!new[] { "LegacyOpen", "Drain", "V3Only" }.Contains(mode, StringComparer.Ordinal))
                return "ApplicationStreamPublishMode 不合法，已 fail closed";
            if (gate.ApplicationStreamGateEpoch < 0)
                return "ApplicationStreamGateEpoch 不合法";
            if ((string.Equals(mode, "LegacyOpen", StringComparison.Ordinal)
                 || string.Equals(mode, "Drain", StringComparison.Ordinal))
                && gate.ApplicationStreamMinProtocol != 2)
            {
                return mode + " 门禁要求 ApplicationStreamMinProtocol 精确等于2";
            }
            if (string.Equals(mode, "V3Only", StringComparison.Ordinal)
                && (gate.ApplicationStreamMinProtocol != 3
                    || gate.ApplicationStreamGateEpoch <= 0))
            {
                return "V3Only 门禁要求 ApplicationStreamMinProtocol 精确等于3且 GateEpoch>0";
            }
            return null;
        }

        public static JObject BuildApplicationAssetStreamGateStatusData(
            string osClient,
            string osClientType,
            string osClientNetwork)
        {
            try
            {
                var gate = ReadApplicationAssetStreamGateStrong(
                    osClient,
                    osClientType,
                    osClientNetwork,
                    null,
                    false);
                var mode = (gate.ApplicationStreamPublishMode ?? string.Empty).Trim();
                var configurationError = ValidateApplicationAssetStreamGateConfiguration(gate);
                if (configurationError != null) throw new InvalidOperationException(configurationError);
                var allowedModes = BuildApplicationAssetStreamAllowedModes(mode);
                var transportModes = string.Equals(
                    mode,
                    "V3Only",
                    StringComparison.Ordinal)
                    ? new JArray("v3")
                    : string.Equals(
                        mode,
                        "LegacyOpen",
                        StringComparison.Ordinal)
                        ? new JArray("v2")
                        : new JArray();
                return new JObject
                {
                    ["ApplicationAssetStreamProtocol"] = string.Equals(
                        mode,
                        "V3Only",
                        StringComparison.Ordinal) ? "3.0" : "2.0",
                    ["ProtocolVersion"] = string.Equals(
                        mode,
                        "V3Only",
                        StringComparison.Ordinal) ? 3 : 2,
                    ["ApplicationStreamPublishMode"] = mode,
                    ["ApplicationStreamMinProtocol"] = gate.ApplicationStreamMinProtocol,
                    ["ApplicationStreamGateEpoch"] = FormatApplicationAssetV3Int64(
                        gate.ApplicationStreamGateEpoch),
                    ["GateEpoch"] = FormatApplicationAssetV3Int64(
                        gate.ApplicationStreamGateEpoch),
                    ["ApplicationAssetStreamV3Only"] = string.Equals(
                        mode,
                        "V3Only",
                        StringComparison.Ordinal),
                    ["V3Only"] = string.Equals(
                        mode,
                        "V3Only",
                        StringComparison.Ordinal),
                    ["ApplicationAssetStreamAllowedModes"] = allowedModes,
                    ["AllowedModes"] = allowedModes.DeepClone(),
                    ["TransportModes"] = transportModes,
                    ["ApplicationAssetStreamGateReady"] = true
                };
            }
            catch (Exception ex)
            {
                // Capability remains visible, but callers must fail closed because
                // no database-authoritative gate facts could be read.
                return new JObject
                {
                    ["ApplicationAssetStreamProtocol"] = "Unavailable",
                    ["ProtocolVersion"] = JValue.CreateNull(),
                    ["ApplicationStreamPublishMode"] = "Unavailable",
                    ["ApplicationStreamMinProtocol"] = int.MaxValue,
                    ["ApplicationStreamGateEpoch"] = JValue.CreateNull(),
                    ["GateEpoch"] = JValue.CreateNull(),
                    ["ApplicationAssetStreamV3Only"] = false,
                    ["V3Only"] = false,
                    ["ApplicationAssetStreamAllowedModes"] = new JArray(),
                    ["AllowedModes"] = new JArray(),
                    ["TransportModes"] = new JArray(),
                    ["ApplicationAssetStreamGateReady"] = false,
                    ["ApplicationAssetStreamGateReadError"] = ex.Message
                };
            }
        }

        public static JArray BuildApplicationAssetStreamAllowedModes(string gateMode)
        {
            if (string.Equals(gateMode, "V3Only", StringComparison.Ordinal))
                return new JArray("stage", "finalize");
            if (string.Equals(gateMode, "LegacyOpen", StringComparison.Ordinal))
                return new JArray("stage-and-finalize");
            return new JArray();
        }

        public static string ValidateApplicationAssetV3ProtocolRequest(JObject param)
        {
            ApplicationAssetV3ProtocolRequest ignored;
            return ParseApplicationAssetV3ProtocolRequest(param, out ignored);
        }

        public static string ValidateApplicationAssetV3StableResolverTarget(
            string osClient,
            JObject app,
            JObject versionRow)
        {
            if (app == null || versionRow == null) return "应用或版本指针不存在";
            var appId = SafeJString(app, "Id");
            if (appId.DosIsNullOrWhiteSpace()
                || !string.Equals(
                    SafeJString(versionRow, "AppId"),
                    appId,
                    StringComparison.Ordinal))
            {
                return "version.AppId 未精确指向 app.Id";
            }
            if (SafeJInt(app, "PublishProtocolVersion") != ApplicationAssetStreamV3ProtocolVersion)
                return "应用不是 v3 指针";
            if (SafeJInt(versionRow, "PublishProtocolVersion") != ApplicationAssetStreamV3ProtocolVersion)
                return "版本不是 v3 release";
            if (!TryParseApplicationAssetV3PublishState(app, out var appState)
                || !IsApplicationAssetV3PointerCommittedState(appState))
            {
                return "应用状态尚未达到 PointerCommitted";
            }
            var versionId = SafeJString(versionRow, "Id");
            if (versionId.DosIsNullOrWhiteSpace()
                || !string.Equals(
                    SafeJString(app, "CommittedPublishVersionId"),
                    versionId,
                    StringComparison.Ordinal))
            {
                return "CommittedPublishVersionId 未指向该版本";
            }
            if (!TryParseApplicationAssetV3PublishState(versionRow, out var state)
                || !IsApplicationAssetV3PointerCommittedState(state))
            {
                return "版本状态尚未达到 PointerCommitted";
            }
            var appFence = SafeApplicationAssetV3Long(app, "PublishFence", -1L);
            var versionFence = SafeApplicationAssetV3Long(versionRow, "FencingToken", -1L);
            if (appFence <= 0L || versionFence <= 0L)
                return "committed PublishFence 与 FencingToken 必须大于0";
            if (appFence != versionFence)
                return "app.PublishFence 与 version.FencingToken 不一致";
            var appKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
            var applicationType = SafeJString(app, "ApplicationType", "Web").ToLowerInvariant();
            if (!new[] { "web", "uniapp", "microservice" }.Contains(
                    applicationType,
                    StringComparer.Ordinal))
            {
                return "v3 runtime 指针仅支持 Web、UniApp 和 MicroService";
            }
            var appRuntimeHash = SafeJString(app, "CommittedRuntimeManifestHash");
            var versionRuntimeHash = SafeJString(versionRow, "RuntimeManifestHash");
            if (!Regex.IsMatch(appRuntimeHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant)
                || !Regex.IsMatch(versionRuntimeHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
            {
                return "committed runtime manifest hash 必须是 canonical lowercase 64 hex";
            }
            if (!string.Equals(appRuntimeHash, versionRuntimeHash, StringComparison.Ordinal))
                return "CommittedRuntimeManifestHash 与版本不一致";
            var manifestError = ValidateApplicationAssetV3CommittedManifest(
                versionRow,
                out var committedManifest);
            if (manifestError != null) return manifestError;
            var committedAssets = committedManifest
                .OfType<JObject>()
                .Select(item => new StreamPublishAsset
                {
                    RelativePath = SafeJString(item, "Path")
                })
                .ToList();
            var routeSnapshotError = ValidateApplicationAssetV3RouteSnapshotFacts(
                applicationType,
                SafeJString(versionRow, "RouteSnapshotJson"),
                SafeJString(versionRow, "RouteSnapshotHash"),
                SafeJString(versionRow, "EntryPath"),
                committedAssets,
                out _);
            if (routeSnapshotError != null) return routeSnapshotError;
            var identity = new ApplicationAssetV3ReleaseIdentity
            {
                Tenant = TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant(),
                Kind = "runtime",
                AppKey = appKey,
                Version = SafeJString(versionRow, "VersionNo"),
                RequestFingerprint = SafeJString(versionRow, "RequestFingerprint")
            };
            var identityError = ValidateApplicationAssetV3ReleaseIdentity(identity);
            if (identityError != null) return identityError;
            var expectedPrefix = BuildApplicationAssetV3ReleasePrefix(identity);
            if (!string.Equals(
                    SafeJString(versionRow, "ReleasePrefix"),
                    expectedPrefix,
                    StringComparison.Ordinal))
            {
                return "ReleasePrefix 与 committed release identity 不一致";
            }
            return null;
        }

        public static string ValidateApplicationAssetV3CommittedManifest(JObject versionRow)
        {
            return ValidateApplicationAssetV3CommittedManifest(versionRow, out _);
        }

        private static string ValidateApplicationAssetV3CommittedManifest(
            JObject versionRow,
            out JArray canonicalManifest)
        {
            canonicalManifest = null;
            if (versionRow == null) return "版本不存在";
            var entryPath = SafeJString(versionRow, "EntryPath");
            var entryPathError = ValidateApplicationAssetV3RelativePath(entryPath);
            if (entryPathError != null) return "EntryPath 不合法：" + entryPathError;
            var normalizedEntryPath = NormalizeApplicationAssetRelativePath(entryPath);
            if (!string.Equals(entryPath, normalizedEntryPath, StringComparison.Ordinal))
                return "EntryPath 不是 canonical path";

            JArray persistedManifest;
            try { persistedManifest = JArray.Parse(SafeJString(versionRow, "AssetManifestJson")); }
            catch { return "AssetManifestJson 不合法"; }
            if (persistedManifest.Count == 0 || persistedManifest.Count > MaxStreamPublishAssetCount)
                return "AssetManifestJson 文件数不合法";

            var uniquePaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var rebuilt = new JArray();
            long totalSize = 0L;
            var entryCount = 0;
            foreach (var token in persistedManifest)
            {
                if (!(token is JObject item)) return "AssetManifestJson 包含非对象项";
                var path = SafeJString(item, "Path");
                var pathError = ValidateApplicationAssetV3RelativePath(path);
                if (pathError != null) return "AssetManifestJson.Path 不合法：" + pathError;
                var normalizedPath = NormalizeApplicationAssetRelativePath(path);
                if (!string.Equals(path, normalizedPath, StringComparison.Ordinal))
                    return "AssetManifestJson.Path 不是 canonical path：" + path;
                if (!uniquePaths.Add(normalizedPath))
                    return "AssetManifestJson.Path 重复：" + normalizedPath;

                var sha256 = SafeJString(item, "Sha256");
                if (!Regex.IsMatch(sha256, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                    return "AssetManifestJson.Sha256 不合法：" + normalizedPath;
                if (!TryParseApplicationAssetV3NonNegativeInt64(
                        item["Size"],
                        "AssetManifestJson.Size",
                        out var size,
                        out var sizeError))
                {
                    return sizeError + "：" + normalizedPath;
                }
                if (!TryAddApplicationAssetResumableLogicalSize(
                        totalSize,
                        size,
                        out var nextTotalSize))
                    return "AssetManifestJson.Size 超限：" + normalizedPath;
                totalSize = nextTotalSize;
                if (item["IsEntry"]?.Type != JTokenType.Boolean)
                    return "AssetManifestJson.IsEntry 必须是 boolean：" + normalizedPath;
                var isEntry = item.Value<bool>("IsEntry");
                if (isEntry)
                {
                    entryCount++;
                    if (!string.Equals(normalizedPath, normalizedEntryPath, StringComparison.Ordinal))
                        return "IsEntry 未指向版本 EntryPath";
                }

                rebuilt.Add(new JObject
                {
                    ["Path"] = normalizedPath,
                    ["Sha256"] = sha256,
                    ["Size"] = size,
                    ["IsEntry"] = isEntry
                });
            }
            if (entryCount != 1)
                return "EntryPath 在 AssetManifestJson 中必须且只能有一个 IsEntry";
            var runtimeHash = ComputeMicroServiceManifestHash(rebuilt);
            if (!string.Equals(
                    runtimeHash,
                    SafeJString(versionRow, "RuntimeManifestHash"),
                    StringComparison.Ordinal))
            {
                return "AssetManifestJson canonical hash 与 RuntimeManifestHash 不一致";
            }
            canonicalManifest = rebuilt;
            return null;
        }

        /// <summary>
        /// Strong single-statement resolver snapshot for anonymous stable reads.
        /// It never consults cache, PreviewUrl, legacy Status or PublicPublishPath.
        /// AppKey is rechecked ordinally after the JOIN so case-insensitive database
        /// collations cannot turn an ambiguous key into a valid public pointer.
        /// </summary>
        public static string ResolveApplicationAssetV3RuntimeOsClientKey(
            string requestedOsClient,
            IEnumerable<string> registeredKeys)
        {
            if (string.IsNullOrWhiteSpace(requestedOsClient)) return null;
            var requested = requestedOsClient.Trim();
            var keys = (registeredKeys ?? Enumerable.Empty<string>())
                .Where(key => !string.IsNullOrWhiteSpace(key))
                .Select(key => key.Trim())
                .Distinct(StringComparer.Ordinal)
                .ToList();
            var exact = keys.Where(key => string.Equals(key, requested, StringComparison.Ordinal)).ToList();
            if (exact.Count == 1) return exact[0];

            var normalized = TenantConfigurationSecurity.NormalizeTenantId(requested).ToLowerInvariant();
            var matches = keys.Where(key => string.Equals(
                    TenantConfigurationSecurity.NormalizeTenantId(key).ToLowerInvariant(),
                    normalized,
                    StringComparison.Ordinal))
                .Take(2)
                .ToList();
            return matches.Count == 1 ? matches[0] : null;
        }

        public static DosResult<ApplicationAssetV3ResolverSnapshot>
            ReadApplicationAssetV3ResolverSnapshot(
                string osClient,
                string appKey,
                string relativeAssetPath)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(osClient))
                    return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null, "OsClient 不能为空");
                if (string.IsNullOrWhiteSpace(appKey)
                    || !string.Equals(appKey, appKey.Trim(), StringComparison.Ordinal))
                {
                    return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null, "AppKey 必须精确且无首尾空白");
                }
                var runtimeOsClient = ResolveApplicationAssetV3RuntimeOsClientKey(
                    osClient,
                    OsClientExtend.ClientList.Keys);
                if (runtimeOsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null,
                        "stable resolver tenant coordinate is unloaded or case-ambiguous");
                }
                var client = OsClientExtend.GetClient(runtimeOsClient);
                if (client?.Db == null)
                    return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null, "未找到租户主库连接");
                var dialect = ResolveApplicationAssetV3SqlDialect(runtimeOsClient);
                string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
                string A(string alias, string name) => alias + "." + Q(name);
                var select = string.Join(",", new[]
                {
                    $"{A("a", "Id")} AS App_Id",
                    $"{A("a", "AppKey")} AS App_AppKey",
                    $"{A("a", "ApplicationType")} AS App_ApplicationType",
                    $"{A("a", "PublishProtocolVersion")} AS App_PublishProtocolVersion",
                    $"{A("a", "PublishState")} AS App_PublishState",
                    $"{A("a", "PublishFence")} AS App_PublishFence",
                    $"{A("a", "PublishRowVersion")} AS App_PublishRowVersion",
                    $"{A("a", "ActivePublishVersionId")} AS App_ActivePublishVersionId",
                    $"{A("a", "CommittedPublishVersionId")} AS App_CommittedPublishVersionId",
                    $"{A("a", "CommittedRuntimeManifestHash")} AS App_CommittedRuntimeManifestHash",
                    $"{A("v", "Id")} AS Version_Id",
                    $"{A("v", "AppId")} AS Version_AppId",
                    $"{A("v", "VersionNo")} AS Version_VersionNo",
                    $"{A("v", "PublishProtocolVersion")} AS Version_PublishProtocolVersion",
                    $"{A("v", "PublishState")} AS Version_PublishState",
                    $"{A("v", "RequestId")} AS Version_RequestId",
                    $"{A("v", "RequestFingerprint")} AS Version_RequestFingerprint",
                    $"{A("v", "RuntimeManifestHash")} AS Version_RuntimeManifestHash",
                    $"{A("v", "EntryPath")} AS Version_EntryPath",
                    $"{A("v", "ReleasePrefix")} AS Version_ReleasePrefix",
                    $"{A("v", "AssetManifestJson")} AS Version_AssetManifestJson",
                    $"{A("v", "RouteSnapshotJson")} AS Version_RouteSnapshotJson",
                    $"{A("v", "RouteSnapshotHash")} AS Version_RouteSnapshotHash",
                    $"{A("v", "FencingToken")} AS Version_FencingToken",
                    $"{A("v", "RowVersion")} AS Version_RowVersion"
                });
                var appTable = QuoteApplicationAssetV3Identifier(dialect, "sys_microistore");
                var versionTable = QuoteApplicationAssetV3Identifier(dialect, "mci_ai_app_version");
                var fromWhere =
                    $" FROM {appTable} a LEFT JOIN {versionTable} v " +
                    $"ON {A("v", "Id")}={A("a", "CommittedPublishVersionId")} " +
                    $"AND {A("v", "AppId")}={A("a", "Id")} " +
                    $"AND ({A("v", "IsDeleted")} IS NULL OR {A("v", "IsDeleted")}=0) " +
                    $"WHERE {A("a", "AppKey")}=@appKey " +
                    $"AND ({A("a", "IsDeleted")} IS NULL OR {A("a", "IsDeleted")}=0)";
                var sql = dialect switch
                {
                    ApplicationAssetV3SqlDialect.SqlServer => "SELECT TOP (2) " + select + fromWhere,
                    ApplicationAssetV3SqlDialect.Oracle =>
                        "SELECT " + select + fromWhere + " AND ROWNUM <= 2",
                    _ => "SELECT " + select + fromWhere + " LIMIT 2"
                };
                var rows = client.Db.FromSql(sql)
                               .AddInParameter("@appKey", appKey)
                               .ToList<dynamic>()
                           ?? new List<dynamic>();
                if (rows.Count != 1)
                {
                    return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null,
                        $"stable resolver JOIN 必须精确命中1行，Actual={rows.Count}");
                }
                var row = rows[0] as JObject ?? JObject.FromObject((object)rows[0]);
                var app = new JObject
                {
                    ["Id"] = SafeApplicationAssetV3DbString(row, "App_Id"),
                    ["AppKey"] = SafeApplicationAssetV3DbString(row, "App_AppKey"),
                    ["ApplicationType"] = SafeApplicationAssetV3DbString(row, "App_ApplicationType"),
                    ["PublishProtocolVersion"] = SafeApplicationAssetV3DbInt(row, "App_PublishProtocolVersion"),
                    ["PublishState"] = SafeApplicationAssetV3DbString(row, "App_PublishState"),
                    ["PublishFence"] = SafeApplicationAssetV3DbLong(row, "App_PublishFence", -1L),
                    ["PublishRowVersion"] = SafeApplicationAssetV3DbLong(row, "App_PublishRowVersion", -1L),
                    ["ActivePublishVersionId"] = SafeApplicationAssetV3DbString(row, "App_ActivePublishVersionId"),
                    ["CommittedPublishVersionId"] = SafeApplicationAssetV3DbString(row, "App_CommittedPublishVersionId"),
                    ["CommittedRuntimeManifestHash"] = SafeApplicationAssetV3DbString(row, "App_CommittedRuntimeManifestHash")
                };
                var version = new JObject
                {
                    ["Id"] = SafeApplicationAssetV3DbString(row, "Version_Id"),
                    ["AppId"] = SafeApplicationAssetV3DbString(row, "Version_AppId"),
                    ["VersionNo"] = SafeApplicationAssetV3DbString(row, "Version_VersionNo"),
                    ["PublishProtocolVersion"] = SafeApplicationAssetV3DbInt(row, "Version_PublishProtocolVersion"),
                    ["PublishState"] = SafeApplicationAssetV3DbString(row, "Version_PublishState"),
                    ["RequestId"] = SafeApplicationAssetV3DbString(row, "Version_RequestId"),
                    ["RequestFingerprint"] = SafeApplicationAssetV3DbString(row, "Version_RequestFingerprint"),
                    ["RuntimeManifestHash"] = SafeApplicationAssetV3DbString(row, "Version_RuntimeManifestHash"),
                    ["EntryPath"] = SafeApplicationAssetV3DbString(row, "Version_EntryPath"),
                    ["ReleasePrefix"] = SafeApplicationAssetV3DbString(row, "Version_ReleasePrefix"),
                    ["AssetManifestJson"] = SafeApplicationAssetV3DbString(row, "Version_AssetManifestJson"),
                    ["RouteSnapshotJson"] = SafeApplicationAssetV3DbString(row, "Version_RouteSnapshotJson"),
                    ["RouteSnapshotHash"] = SafeApplicationAssetV3DbString(row, "Version_RouteSnapshotHash"),
                    ["FencingToken"] = SafeApplicationAssetV3DbLong(row, "Version_FencingToken", -1L),
                    ["RowVersion"] = SafeApplicationAssetV3DbLong(row, "Version_RowVersion", -1L)
                };
                if (!string.Equals(SafeJString(app, "AppKey"), appKey, StringComparison.Ordinal))
                    return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null, "AppKey ordinal 精确回读失败");
                var resolverError = ValidateApplicationAssetV3StableResolverTarget(runtimeOsClient, app, version);
                if (resolverError != null)
                    return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null, resolverError);
                string normalizedPath;
                try
                {
                    normalizedPath = ResolveApplicationAssetV3RequestedRelativePath(
                        relativeAssetPath,
                        version);
                }
                catch (Exception ex)
                {
                    return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null, ex.Message);
                }
                var appFence = SafeApplicationAssetV3Long(app, "PublishFence", -1L);
                var versionFence = SafeApplicationAssetV3Long(version, "FencingToken", -1L);

                var manifestError = ValidateApplicationAssetV3CommittedManifest(
                    version,
                    out var manifest);
                if (manifestError != null)
                    return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null, manifestError);
                var matches = manifest
                    .OfType<JObject>()
                    .Where(item => string.Equals(
                        SafeJString(item, "Path"),
                        normalizedPath,
                        StringComparison.Ordinal))
                    .ToList();
                if (matches.Count != 1)
                {
                    return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null,
                        $"请求资产必须精确命中 committed manifest 1项，Actual={matches.Count}");
                }
                var identity = new ApplicationAssetV3ReleaseIdentity
                {
                    Tenant = TenantConfigurationSecurity.NormalizeTenantId(runtimeOsClient).ToLowerInvariant(),
                    Kind = "runtime",
                    AppKey = appKey,
                    Version = SafeJString(version, "VersionNo"),
                    RequestFingerprint = SafeJString(version, "RequestFingerprint")
                };
                return new DosResult<ApplicationAssetV3ResolverSnapshot>(1,
                    new ApplicationAssetV3ResolverSnapshot
                    {
                        App = app,
                        Version = version,
                        Asset = (JObject)matches[0].DeepClone(),
                        StableResolverPath = BuildApplicationAssetV3StableResolverPath(
                            identity,
                            normalizedPath),
                        ReleaseAssetPath = BuildApplicationAssetV3ReleaseEntryPath(
                            identity,
                            normalizedPath),
                        PublishFence = FormatApplicationAssetV3Int64(appFence),
                        VersionFencingToken = FormatApplicationAssetV3Int64(versionFence),
                        RouteSnapshotHash = SafeJString(version, "RouteSnapshotHash")
                    },
                    "stable resolver authoritative snapshot 已读取");
            }
            catch (Exception ex)
            {
                return new DosResult<ApplicationAssetV3ResolverSnapshot>(0, null,
                    "stable resolver snapshot 失败：" + ex.Message);
            }
        }

        /// <summary>
        /// Performs one bounded, multi-tenant roll-forward pass for durable v3
        /// pointers whose classic/file projection was interrupted. Candidate
        /// discovery is only a bounded hint; every version is re-read from the
        /// tenant primary and processed under the same per-AppId distributed
        /// publish lease used by finalize. The committed pointer is never rolled
        /// back by this recovery path.
        /// </summary>
        public static async Task<DosResult<object>> RecoverApplicationAssetV3ProjectionsOnceAsync(
            CancellationToken cancellationToken = default)
        {
            var tenants = OsClientExtend.ClientList.Keys
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
                .ToList();
            var configuredTenant = OsClientExtend.GetConfigOsClient();
            if (configuredTenant.DosIsNullOrWhiteSpace()) configuredTenant = OsClientDefault.OsClient;
            if (!configuredTenant.DosIsNullOrWhiteSpace())
            {
                tenants.RemoveAll(value => string.Equals(
                    value,
                    configuredTenant,
                    StringComparison.OrdinalIgnoreCase));
                tenants.Insert(0, configuredTenant);
            }

            var scheduled = 0;
            var scanned = 0;
            var recovered = 0;
            var pending = 0;
            var superseded = 0;
            var skipped = 0;
            var failed = 0;
            foreach (var osClient in tenants)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (scheduled >= ApplicationAssetV3RecoveryMaxCandidatesPerRound) break;
                try
                {
                    var candidates = new List<JObject>();
                    var uniqueVersionIds = new HashSet<string>(StringComparer.Ordinal);
                    for (var pageIndex = 1;
                         pageIndex <= ApplicationAssetV3RecoveryMaxPagesPerTenant
                         && scheduled + candidates.Count < ApplicationAssetV3RecoveryMaxCandidatesPerRound;
                         pageIndex++)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        var pageSize = Math.Min(
                            ApplicationAssetV3RecoveryPageSize,
                            ApplicationAssetV3RecoveryMaxCandidatesPerRound - scheduled - candidates.Count);
                        var query = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(
                            "mci_ai_app_version",
                            new
                            {
                                OsClient = osClient,
                                _Where = new List<object>
                                {
                                    new List<object> { "PublishProtocolVersion", "=", 3 },
                                    new List<object>
                                    {
                                        "AND", "PublishState", "In", new[]
                                        {
                                            ApplicationAssetV3PublishState.PointerCommitted.ToString(),
                                            ApplicationAssetV3PublishState.ProjectionPending.ToString(),
                                            ApplicationAssetV3PublishState.RepairRequired.ToString()
                                        }
                                    }
                                },
                                _SelectFields = new[] { "Id", "AppId", "VersionNo", "PublishState", "UpdateTime" },
                                _OrderBy = "UpdateTime",
                                _OrderByType = "ASC",
                                _PageIndex = pageIndex,
                                _PageSize = pageSize
                            }).ConfigureAwait(false);
                        if (query.Code != 1) break;
                        var rows = query.Data == null
                            ? new JArray()
                            : JArray.FromObject((object)query.Data);
                        foreach (var token in rows)
                        {
                            var candidate = token as JObject ?? JObject.FromObject(token);
                            var versionId = SafeJString(candidate, "Id");
                            if (!versionId.DosIsNullOrWhiteSpace() && uniqueVersionIds.Add(versionId))
                                candidates.Add(candidate);
                        }
                        if (rows.Count < pageSize) break;
                    }

                    scheduled += candidates.Count;
                    foreach (var candidate in candidates)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        scanned++;
                        var outcome = await RecoverApplicationAssetV3ProjectionCandidateAsync(
                            osClient,
                            candidate,
                            cancellationToken).ConfigureAwait(false);
                        if (outcome == "Recovered") recovered++;
                        else if (outcome == "Pending") pending++;
                        else if (outcome == "Superseded") superseded++;
                        else if (outcome == "Skipped") skipped++;
                        else failed++;
                    }
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch
                {
                    // A tenant without the v3 migration, or a transient tenant
                    // failure, must not block the next tenant or future rounds.
                    failed++;
                }
            }

            return new DosResult<object>(1, new
            {
                TenantCount = tenants.Count,
                CandidateRoundCap = ApplicationAssetV3RecoveryMaxCandidatesPerRound,
                CandidatePageSize = ApplicationAssetV3RecoveryPageSize,
                MaxPagesPerTenant = ApplicationAssetV3RecoveryMaxPagesPerTenant,
                Scheduled = scheduled,
                Scanned = scanned,
                Recovered = recovered,
                Pending = pending,
                Superseded = superseded,
                Skipped = skipped,
                Failed = failed
            }, failed == 0 && pending == 0
                ? "v3 projection 有界恢复扫描完成"
                : "v3 projection 有界恢复扫描完成，存在待后续轮次重试项");
        }

        private static async Task<string> RecoverApplicationAssetV3ProjectionCandidateAsync(
            string osClient,
            JObject candidate,
            CancellationToken cancellationToken)
        {
            var versionId = SafeJString(candidate, "Id");
            var appId = SafeJString(candidate, "AppId");
            var versionNo = SafeJString(candidate, "VersionNo");
            if (versionId.DosIsNullOrWhiteSpace()
                || appId.DosIsNullOrWhiteSpace()
                || versionNo.DosIsNullOrWhiteSpace())
            {
                return "Failed";
            }

            DosResult<object> recoveryResult = null;
            var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
            {
                // One lease acquisition is performed for each version candidate,
                // while the key deliberately matches finalize so different
                // versions of one application can never project concurrently.
                Key = BuildApplicationAssetPublishLockKey(osClient, appId),
                OsClient = osClient,
                Expiry = TimeSpan.FromMinutes(5),
                AcquireTimeout = TimeSpan.FromSeconds(2),
                CancellationToken = cancellationToken,
                RetryIntervalMs = 100,
                UseExponentialBackoff = true,
                AutoRenew = true,
                MaxLeaseDuration = TimeSpan.FromHours(1)
            }, async lease =>
            {
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                var app = ReadApplicationAssetV3AppStrong(osClient, appId, null, false);
                var versions = ReadApplicationAssetV3VersionRowsStrong(
                    osClient,
                    appId,
                    versionNo,
                    null,
                    false);
                if (versions.Count != 1
                    || !string.Equals(SafeJString(versions[0], "Id"), versionId, StringComparison.Ordinal))
                {
                    recoveryResult = new DosResult<object>(0, null,
                        "recovery 要求 AppId+VersionNo 精确唯一且 Id 不漂移");
                    return;
                }
                var version = versions[0];
                if (!string.Equals(
                        SafeJString(app, "CommittedPublishVersionId"),
                        versionId,
                        StringComparison.Ordinal))
                {
                    recoveryResult = new DosResult<object>(1, new { Outcome = "Superseded" },
                        "候选版本已不再是 committed pointer");
                    return;
                }
                var resolverError = ValidateApplicationAssetV3StableResolverTarget(osClient, app, version);
                if (resolverError != null)
                {
                    recoveryResult = new DosResult<object>(0, null,
                        "recovery committed proof 失败：" + resolverError);
                    return;
                }
                var rehydrateError = TryRehydrateApplicationAssetV3RecoveryContext(
                    osClient,
                    app,
                    version,
                    out var request,
                    out var plan,
                    out var buildLog);
                if (rehydrateError != null)
                {
                    recoveryResult = new DosResult<object>(0, null,
                        "recovery 持久化事实不合法：" + rehydrateError);
                    return;
                }
                recoveryResult = await RollForwardApplicationAssetV3Projection(
                    osClient,
                    appId,
                    versionId,
                    request,
                    plan,
                    buildLog,
                    lease,
                    true).ConfigureAwait(false);
            }).ConfigureAwait(false);

            if (lockResult.Code != 1) return "Skipped";
            if (recoveryResult?.Code != 1) return "Failed";
            var data = recoveryResult.Data == null
                ? new JObject()
                : JObject.FromObject(recoveryResult.Data);
            var explicitOutcome = data.Value<string>("Outcome");
            if (string.Equals(explicitOutcome, "Superseded", StringComparison.Ordinal))
                return "Superseded";
            return data.Value<bool?>("Completed") == true ? "Recovered" : "Pending";
        }

        private static string TryRehydrateApplicationAssetV3RecoveryContext(
            string osClient,
            JObject app,
            JObject version,
            out ApplicationAssetV3ProtocolRequest request,
            out ApplicationAssetV3PublishPlan plan,
            out string buildLogRaw)
        {
            request = null;
            plan = null;
            buildLogRaw = SafeJString(version, "BuildLog");
            JObject buildLog;
            try { buildLog = JObject.Parse(buildLogRaw); }
            catch { return "BuildLog 不是有效 JSON"; }
            if (SafeJInt(buildLog, "ProtocolVersion") != 3)
                return "BuildLog.ProtocolVersion 不是3";

            var gateEpoch = ReadRequiredApplicationAssetV3Long(
                buildLog,
                "ExpectedGateEpoch",
                out var gateEpochError);
            if (gateEpochError != null) return gateEpochError;
            var expectedPublishRowVersion = ReadRequiredApplicationAssetV3Long(
                buildLog,
                "ExpectedPublishRowVersion",
                out var publishRowError);
            if (publishRowError != null) return publishRowError;
            var expectedPublishFence = ReadRequiredApplicationAssetV3Long(
                buildLog,
                "ExpectedPublishFence",
                out var publishFenceError);
            if (publishFenceError != null) return publishFenceError;
            var expectedActiveError = ReadRequiredNullableApplicationAssetV3String(
                buildLog,
                "ExpectedActivePublishVersionId",
                out var expectedActive);
            if (expectedActiveError != null) return expectedActiveError;
            var expectedCommittedError = ReadRequiredNullableApplicationAssetV3String(
                buildLog,
                "ExpectedCommittedPublishVersionId",
                out var expectedCommitted);
            if (expectedCommittedError != null) return expectedCommittedError;
            var expectedAppVersionError = ReadRequiredNullableApplicationAssetV3String(
                version,
                "ExpectedAppVersion",
                out var expectedAppVersion);
            if (expectedAppVersionError != null) return expectedAppVersionError;
            if (expectedPublishRowVersion == long.MaxValue || expectedPublishFence == long.MaxValue)
                return "BuildLog 的 publish proof 已达到 Int64 上限";
            if (SafeApplicationAssetV3Long(app, "PublishRowVersion", -1L)
                != expectedPublishRowVersion + 1L)
            {
                return "app.PublishRowVersion 不等于 BuildLog.ExpectedPublishRowVersion+1";
            }
            if (SafeApplicationAssetV3Long(app, "PublishFence", -1L)
                != BuildApplicationAssetV3NextPublishFence(expectedPublishFence))
            {
                return "app.PublishFence 不等于 BuildLog.ExpectedPublishFence+1";
            }

            var expectedCurrentVersion = SafeJInt(version, "ExpectedCurrentVersion", -1);
            if (expectedCurrentVersion < 0) return "version.ExpectedCurrentVersion 不合法";
            request = new ApplicationAssetV3ProtocolRequest
            {
                ProtocolVersion = 3,
                PublishMode = "finalize",
                ExpectedGateEpoch = gateEpoch,
                ExpectedPublishRowVersion = expectedPublishRowVersion,
                ExpectedVersionRowVersion = SafeApplicationAssetV3Long(version, "RowVersion", 0L),
                ExpectedPublishFence = expectedPublishFence,
                ExpectedActivePublishVersionId = expectedActive,
                ExpectedCommittedPublishVersionId = expectedCommitted,
                ExpectedCurrentVersion = expectedCurrentVersion,
                ExpectedAppVersion = expectedAppVersion,
                RequestId = SafeJString(buildLog, "RequestId"),
                RequestFingerprint = SafeJString(buildLog, "RequestFingerprint"),
                DeliveryBatchId = SafeJString(buildLog, "DeliveryBatchId"),
                SourceManifestHash = SafeJString(buildLog, "SourceManifestHash"),
                RuntimeManifestHash = SafeJString(buildLog, "RuntimeManifestHash"),
                RouteSnapshotJson = SafeJString(buildLog, "RouteSnapshotJson"),
                RouteSnapshotHash = SafeJString(buildLog, "RouteSnapshotHash")
            };
            if (!Regex.IsMatch(request.RequestFingerprint, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant)
                || !Regex.IsMatch(request.SourceManifestHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant)
                || !Regex.IsMatch(request.RuntimeManifestHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant)
                || !Regex.IsMatch(request.RouteSnapshotHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
            {
                return "BuildLog manifest/route/fingerprint hash 不是 canonical lowercase 64 hex";
            }
            if (!string.Equals(
                    request.RouteSnapshotJson,
                    SafeJString(version, "RouteSnapshotJson"),
                    StringComparison.Ordinal)
                || !string.Equals(
                    request.RouteSnapshotHash,
                    SafeJString(version, "RouteSnapshotHash"),
                    StringComparison.Ordinal))
            {
                return "BuildLog 与 version 的 RouteSnapshot 不一致";
            }

            var manifestError = ValidateApplicationAssetV3CommittedManifest(version, out var manifest);
            if (manifestError != null) return manifestError;
            var planParam = new JObject
            {
                ["VersionNo"] = SafeJString(version, "VersionNo"),
                ["EntryPath"] = SafeJString(version, "EntryPath"),
                ["Assets"] = manifest
            };
            var planError = BuildApplicationAssetV3PublishPlan(
                osClient,
                app,
                planParam,
                request,
                out plan);
            if (planError != null) return planError;
            var rebuiltBuildLog = BuildApplicationAssetV3BuildLog(request, plan)
                .ToString(Formatting.None);
            if (!string.Equals(rebuiltBuildLog, buildLogRaw, StringComparison.Ordinal))
                return "BuildLog 不是由持久化不可变事实重建出的 canonical JSON";
            return null;
        }

        public static async Task<DosResult<object>> UploadApplicationAssetStreamV3(
            string osClient,
            string appIdOrKey,
            string versionNo,
            string relativePath,
            string expectedSha256,
            string fileName,
            Stream fileStream,
            long contentLength,
            JObject protocolParam,
            object currentToken,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var operatorError = ValidateStreamPublishOperator(
                    currentToken,
                    osClient,
                    "application-asset:upload",
                    appIdOrKey);
                if (operatorError != null) return operatorError;
                var requestError = ParseApplicationAssetV3ProtocolRequest(
                    protocolParam,
                    out var request);
                if (requestError != null) return new DosResult<object>(0, null, requestError);
                if (!string.Equals(request.PublishMode, "stage", StringComparison.Ordinal))
                    return new DosResult<object>(0, null, "v3 multipart 上传只允许 PublishMode=stage");
                if (fileStream == null) return new DosResult<object>(0, null, "未接收到应用资产文件流");

                var coordinate = ResolveApplicationAssetStreamGateCoordinate(osClient);
                var gate = ReadApplicationAssetStreamGateStrong(
                    osClient,
                    coordinate.OsClientType,
                    coordinate.OsClientNetwork,
                    null,
                    false);
                var gateError = ValidateApplicationAssetStreamGate(
                    gate,
                    request.ProtocolVersion,
                    request.ExpectedGateEpoch);
                if (gateError != null) return new DosResult<object>(0, null, gateError);

                versionNo = NormalizeApplicationAssetVersion(versionNo);
                var v3PathError = ValidateApplicationAssetV3RelativePath(relativePath);
                if (v3PathError != null) return new DosResult<object>(0, null, v3PathError);
                relativePath = NormalizeApplicationAssetRelativePath(relativePath);
                expectedSha256 = (expectedSha256 ?? string.Empty).Trim();
                if (!Regex.IsMatch(expectedSha256, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                    return new DosResult<object>(0, null, "ExpectedSha256 必须是64位小写十六进制 SHA-256");
                var safeFileName = Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/'));
                if (!string.Equals(safeFileName, Path.GetFileName(relativePath), StringComparison.Ordinal))
                    return new DosResult<object>(0, null, "multipart 文件名必须与 RelativePath 的文件名一致");
                if (!fileStream.CanSeek)
                    return new DosResult<object>(0, null, "当前 multipart 文件流不可定位");
                fileStream.Position = 0;
                var actualLength = fileStream.Length;
                if (contentLength > 0 && contentLength != actualLength)
                    return new DosResult<object>(0, null, "Content-Length 与实际文件长度不一致");
                if (actualLength > MaxStreamPublishFileBytes)
                    return new DosResult<object>(0, null, "单个应用资产不能超过128MB");
                var actualSha256 = await Sha256HexAsync(fileStream, cancellationToken).ConfigureAwait(false);
                if (!string.Equals(actualSha256, expectedSha256, StringComparison.Ordinal))
                    return new DosResult<object>(0, null, "上传文件 SHA-256 与 ExpectedSha256 不一致");

                var app = ReadApplicationAssetV3AppStrong(osClient, appIdOrKey, null, false);
                if (app == null) return new DosResult<object>(2, null, "在线 AI 应用不存在");
                var appGateError = ValidateApplicationAssetV3AppExpectedState(app, request);
                if (appGateError != null) return new DosResult<object>(0, null, appGateError);
                var appId = SafeJString(app, "Id");
                var appKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
                var applicationType = SafeJString(app, "ApplicationType", "Web").ToLowerInvariant();
                if (!new[] { "web", "uniapp", "microservice" }.Contains(
                        applicationType,
                        StringComparer.Ordinal))
                {
                    return new DosResult<object>(0, null, "v3 runtime 仅支持 Web、UniApp 和 MicroService");
                }
                var versionRows = ReadApplicationAssetV3VersionRowsStrong(
                    osClient,
                    appId,
                    versionNo,
                    null,
                    false);
                var versionGateError = ValidateApplicationAssetV3ExpectedVersionRow(
                    versionRows,
                    request,
                    appId,
                    versionNo,
                    true);
                if (versionGateError != null) return new DosResult<object>(0, null, versionGateError);

                var identity = new ApplicationAssetV3ReleaseIdentity
                {
                    Tenant = TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant(),
                    Kind = "runtime",
                    AppKey = appKey,
                    Version = versionNo,
                    RequestFingerprint = request.RequestFingerprint
                };
                var identityError = ValidateApplicationAssetV3ReleaseIdentity(identity);
                if (identityError != null) return new DosResult<object>(0, null, identityError);
                var paths = BuildApplicationAssetV3Paths(identity, relativePath, actualSha256);
                var markerBytes = BuildApplicationAssetV3IntegrityMarker(
                    identity,
                    relativePath,
                    actualSha256,
                    actualLength,
                    request.RequestId);
                var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
                DosResult uploadResult = null;
                var idempotent = false;
                var markerRepaired = false;
                var businessFencingToken = BuildApplicationAssetV3NextPublishFence(
                    request.ExpectedPublishFence);
                long leaseFencingToken = 0;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = $"V8Mcp:ApplicationAssetV3:{TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant()}:{appId}:{versionNo}:{request.RequestFingerprint}:{Sha256Hex(relativePath)}",
                    OsClient = osClient,
                    Expiry = TimeSpan.FromMinutes(10),
                    AcquireTimeout = TimeSpan.FromMinutes(1),
                    CancellationToken = cancellationToken,
                    RetryIntervalMs = 50,
                    UseExponentialBackoff = true,
                    AutoRenew = true,
                    MaxLeaseDuration = TimeSpan.FromHours(2)
                }, async lease =>
                {
                    leaseFencingToken = lease.FencingToken;
                    var lockedGate = ReadApplicationAssetStreamGateStrong(
                        osClient,
                        coordinate.OsClientType,
                        coordinate.OsClientNetwork,
                        null,
                        false);
                    var lockedGateError = ValidateApplicationAssetStreamGate(
                        lockedGate,
                        request.ProtocolVersion,
                        request.ExpectedGateEpoch);
                    if (lockedGateError != null)
                    {
                        uploadResult = new DosResult(0, null, lockedGateError);
                        return;
                    }
                    var lockedApp = ReadApplicationAssetV3AppStrong(osClient, appId, null, false);
                    var lockedAppError = ValidateApplicationAssetV3AppExpectedState(lockedApp, request);
                    if (lockedAppError != null)
                    {
                        uploadResult = new DosResult(0, null, lockedAppError);
                        return;
                    }
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                    var versionExists = await ApplicationObjectExists(
                        hdfs,
                        clientModel,
                        paths.VersionPath).ConfigureAwait(false);
                    var markerExists = await ApplicationObjectExists(
                        hdfs,
                        clientModel,
                        paths.IntegrityMarkerPath).ConfigureAwait(false);
                    if (versionExists.Error != null || markerExists.Error != null)
                    {
                        uploadResult = versionExists.Error ?? markerExists.Error;
                        return;
                    }
                    if (!versionExists.Exists && markerExists.Exists)
                    {
                        uploadResult = new DosResult(0, null, "v3 完整性标记存在但 immutable release 文件缺失");
                        return;
                    }
                    if (versionExists.Exists)
                    {
                        using var readBudget = await AcquireApplicationAssetReadBudgetAsync(
                            actualLength,
                            cancellationToken).ConfigureAwait(false);
                        var storedBytes = await ReadApplicationObjectBytes(
                            hdfs,
                            clientModel,
                            paths.VersionPath).ConfigureAwait(false);
                        var contentError = ValidateApplicationAssetContent(
                            relativePath,
                            actualLength,
                            actualSha256,
                            storedBytes,
                            false);
                        if (contentError != null)
                        {
                            uploadResult = new DosResult(0, null, contentError + "；拒绝覆盖 v3 immutable release");
                            return;
                        }
                        if (markerExists.Exists)
                        {
                            var storedMarker = await ReadApplicationObjectBytes(
                                hdfs,
                                clientModel,
                                paths.IntegrityMarkerPath).ConfigureAwait(false);
                            var markerError = ValidateApplicationAssetV3IntegrityMarker(
                                storedMarker,
                                identity,
                                relativePath,
                                actualSha256,
                                actualLength,
                                request.RequestId);
                            if (markerError != null)
                            {
                                uploadResult = new DosResult(0, null, markerError);
                                return;
                            }
                        }
                        else
                        {
                            await using var markerRepairStream = new MemoryStream(markerBytes, false);
                            var repair = await ExecuteApplicationAssetSideEffect(
                                lease,
                                () => PutApplicationObject(
                                    hdfs,
                                    clientModel,
                                    paths.IntegrityMarkerPath,
                                    markerRepairStream)).ConfigureAwait(false);
                            if (repair.Code != 1)
                            {
                                uploadResult = repair;
                                return;
                            }
                            markerRepaired = true;
                        }
                        idempotent = true;
                        uploadResult = new DosResult(1);
                        return;
                    }

                    var currentUser = GetMcpOperator(currentToken);
                    var tenantUploadOptions = FileUploadSecurityOptions.Load(
                        OsClientExtend.GetClient(osClient)?.OsClientModel);
                    var uploadOptions = new FileUploadSecurityOptions
                    {
                        MaxFileBytes = MaxStreamPublishFileBytes,
                        MaxTotalBytes = MaxStreamPublishFileBytes,
                        MaxFileCount = 1,
                        DailyUserQuotaBytes = ApplicationPublishDailyQuotaBytes,
                        DailyTenantQuotaBytes = ApplicationPublishDailyQuotaBytes,
                        UploadEnabled = tenantUploadOptions.UploadEnabled
                    };
                    if (!uploadOptions.UploadEnabled)
                    {
                        uploadResult = FileUploadSecurity.CreateTenantUploadDisabledResult(osClient);
                        return;
                    }
                    var payload = new DiyUploadParam
                    {
                        OsClient = osClient,
                        Limit = false,
                        Preview = false,
                        _CurrentUser = currentUser,
                        _InvokeType = InvokeType.Server.ToString(),
                        Files = new Dictionary<string, Stream> { [safeFileName] = fileStream }
                    };
                    var payloadError = FileUploadSecurity.ValidatePayload(
                        payload,
                        out var totalBytes,
                        uploadOptions);
                    if (payloadError != null)
                    {
                        uploadResult = payloadError;
                        return;
                    }
                    if (totalBytes > 0)
                    {
                        var quotaError = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => FileUploadSecurity.ReserveDailyQuotaAsync(
                                osClient,
                                SafeJString(currentUser, "Id", SafeJString(currentUser, "UserId")),
                                totalBytes,
                                uploadOptions,
                                FileUploadSecurity.ApplicationPublishQuotaScope)).ConfigureAwait(false);
                        if (quotaError != null)
                        {
                            uploadResult = quotaError;
                            return;
                        }
                    }
                    var put = await ExecuteApplicationAssetSideEffect(
                        lease,
                        () => PutApplicationObject(
                            hdfs,
                            clientModel,
                            paths.VersionPath,
                            fileStream)).ConfigureAwait(false);
                    if (put.Code != 1)
                    {
                        uploadResult = put;
                        return;
                    }
                    await using var markerStream = new MemoryStream(markerBytes, false);
                    var markerPut = await ExecuteApplicationAssetSideEffect(
                        lease,
                        () => PutApplicationObject(
                            hdfs,
                            clientModel,
                            paths.IntegrityMarkerPath,
                            markerStream)).ConfigureAwait(false);
                    if (markerPut.Code != 1)
                    {
                        uploadResult = new DosResult(
                            markerPut.Code,
                            markerPut.Data,
                            "v3 release 已写入但 marker 失败；immutable orphan 将由后续同请求校验处理：" + markerPut.Msg);
                        return;
                    }
                    uploadResult = new DosResult(1);
                }).ConfigureAwait(false);

                if (lockResult.Code != 1)
                    return new DosResult<object>(0, null, "未获得 v3 immutable release 分布式锁：" + lockResult.Msg);
                if (uploadResult == null || uploadResult.Code != 1)
                    return new DosResult<object>(uploadResult?.Code ?? 0, uploadResult?.Data, uploadResult?.Msg ?? "v3 stage 未执行");
                return new DosResult<object>(1, new
                {
                    ProtocolVersion = ApplicationAssetStreamV3ProtocolVersion,
                    PublishMode = "stage",
                    GateEpoch = FormatApplicationAssetV3Int64(request.ExpectedGateEpoch),
                    AppId = appId,
                    AppKey = appKey,
                    VersionNo = versionNo,
                    RequestId = request.RequestId,
                    RequestFingerprint = request.RequestFingerprint,
                    DeliveryBatchId = request.DeliveryBatchId,
                    RouteSnapshotJson = request.RouteSnapshotJson,
                    RouteSnapshotHash = request.RouteSnapshotHash,
                    FencingToken = FormatApplicationAssetV3Int64(businessFencingToken),
                    LeaseFencingToken = FormatApplicationAssetV3Int64(leaseFencingToken),
                    PublishState = "Prepared",
                    PointerState = "Uncommitted",
                    Pending = true,
                    Completed = false,
                    RetryAfterMs = 0,
                    Path = relativePath,
                    Sha256 = actualSha256,
                    Size = actualLength,
                    ReleaseFilePath = paths.VersionPath,
                    IntegrityMarkerPath = paths.IntegrityMarkerPath,
                    Idempotent = idempotent,
                    IntegrityMarkerRepaired = markerRepaired
                }, idempotent ? "v3 immutable release 资产已精确幂等复用" : "v3 immutable release 资产已写入");
            }
            catch (OperationCanceledException)
            {
                return new DosResult<object>(0, null, "v3 stage 已取消");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "v3 stage 失败：" + ex.Message);
            }
        }

        private static async Task<DosResult<object>> FinalizeApplicationStreamPublishV3Core(
            string osClient,
            JObject param,
            object currentToken,
            string expectedAppId,
            string expectedAppKey,
            IMicroiLockLease lease,
            CancellationToken cancellationToken)
        {
            var requestError = ParseApplicationAssetV3ProtocolRequest(param, out var request);
            if (requestError != null) return new DosResult<object>(0, null, requestError);
            long businessFencingToken;
            try
            {
                businessFencingToken = BuildApplicationAssetV3NextPublishFence(
                    request.ExpectedPublishFence);
            }
            catch (OverflowException)
            {
                return new DosResult<object>(0, null, "PublishFence 已达到 Int64 上限");
            }
            var coordinate = ResolveApplicationAssetStreamGateCoordinate(osClient);
            var gate = ReadApplicationAssetStreamGateStrong(
                osClient,
                coordinate.OsClientType,
                coordinate.OsClientNetwork,
                null,
                false);
            var gateError = ValidateApplicationAssetStreamGate(
                gate,
                request.ProtocolVersion,
                request.ExpectedGateEpoch);
            if (gateError != null) return new DosResult<object>(0, null, gateError);

            var app = ReadApplicationAssetV3AppStrong(osClient, expectedAppId, null, false);
            var identityError = ValidateApplicationStreamIdentity(app, expectedAppId, expectedAppKey);
            if (identityError != null) return new DosResult<object>(0, null, identityError);
            var planError = BuildApplicationAssetV3PublishPlan(
                osClient,
                app,
                param,
                request,
                out var plan);
            if (planError != null) return new DosResult<object>(0, null, planError);
            if (string.Equals(plan.ApplicationType, "microservice", StringComparison.Ordinal))
            {
                var projectionSchemaError = ValidateApplicationAssetV3MicroServiceProjectionSchema(osClient);
                if (projectionSchemaError != null)
                    return new DosResult<object>(0, null,
                        projectionSchemaError + "；pointer 尚未提交");
            }

            var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
            var releaseVerificationError = await RunApplicationAssetBoundedParallelAsync(
                plan.Assets,
                async (asset, batchCancellationToken) =>
                {
                    batchCancellationToken.ThrowIfCancellationRequested();
                    var objectExists = await ApplicationObjectExists(
                        hdfs,
                        clientModel,
                        asset.Paths.VersionPath).ConfigureAwait(false);
                    var markerExists = await ApplicationObjectExists(
                        hdfs,
                        clientModel,
                        asset.Paths.IntegrityMarkerPath).ConfigureAwait(false);
                    if (objectExists.Error != null || markerExists.Error != null)
                        return objectExists.Error?.Msg ?? markerExists.Error?.Msg;
                    if (!objectExists.Exists || !markerExists.Exists)
                        return "v3 immutable release 或完整性 marker 不存在：" + asset.RelativePath;
                    var markerBytes = await ReadApplicationObjectBytes(
                        hdfs,
                        clientModel,
                        asset.Paths.IntegrityMarkerPath).ConfigureAwait(false);
                    var markerError = ValidateApplicationAssetV3IntegrityMarker(
                        markerBytes,
                        plan.Identity,
                        asset.RelativePath,
                        asset.Sha256,
                        asset.Size,
                        request.RequestId);
                    if (markerError != null) return markerError;
                    var bytes = await ReadApplicationObjectBytes(
                        hdfs,
                        clientModel,
                        asset.Paths.VersionPath).ConfigureAwait(false);
                    return ValidateApplicationAssetContent(
                        asset.RelativePath,
                        asset.Size,
                        asset.Sha256,
                        bytes,
                        asset.IsEntry);
                },
                cancellationToken,
                declaredByteSize: asset => asset.Size).ConfigureAwait(false);
            if (releaseVerificationError != null)
                return new DosResult<object>(0, null, releaseVerificationError);
            await lease.EnsureHeldAsync().ConfigureAwait(false);

            var versionId = BuildApplicationStreamRecordId(
                "version",
                osClient,
                expectedAppId,
                plan.VersionNo + "\n" + request.RequestFingerprint);
            var buildLog = BuildApplicationAssetV3BuildLog(request, plan).ToString(Formatting.None);
            var db = OsClientExtend.GetClient(osClient)?.Db;
            if (db == null) return new DosResult<object>(0, null, "未找到租户主库连接");
            var dialect = ResolveApplicationAssetV3SqlDialect(osClient);
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);

            using (var trans = db.BeginTransaction())
            {
                var transactionCommitted = false;
                try
                {
                    var lockedGate = ReadApplicationAssetStreamGateStrong(
                        osClient,
                        coordinate.OsClientType,
                        coordinate.OsClientNetwork,
                        trans,
                        true);
                    var lockedGateError = ValidateApplicationAssetStreamGate(
                        lockedGate,
                        request.ProtocolVersion,
                        request.ExpectedGateEpoch);
                    if (lockedGateError != null)
                        return new DosResult<object>(0, null, lockedGateError);

                    var lockedApp = ReadApplicationAssetV3AppStrong(
                        osClient,
                        expectedAppId,
                        trans,
                        true);
                    var lockedIdentityError = ValidateApplicationStreamIdentity(
                        lockedApp,
                        expectedAppId,
                        expectedAppKey);
                    if (lockedIdentityError != null)
                        return new DosResult<object>(0, null, lockedIdentityError);
                    var versionRows = ReadApplicationAssetV3VersionRowsStrong(
                        osClient,
                        expectedAppId,
                        plan.VersionNo,
                        trans,
                        true);
                    if (versionRows.Count > 1)
                        return new DosResult<object>(0, null, "同一 AppId+VersionNo 存在多个 v3 版本，已 fail closed");
                    var existingVersion = versionRows.Count == 1 ? versionRows[0] : null;

                    ApplicationAssetV3PublishState? existingState = null;
                    if (existingVersion != null)
                    {
                        var immutableError = ValidateApplicationAssetV3VersionImmutableFacts(
                            existingVersion,
                            versionId,
                            request,
                            plan,
                            buildLog);
                        if (immutableError != null)
                            return new DosResult<object>(0, null, "v3 版本不可变事实冲突：" + immutableError);
                        if (!TryParseApplicationAssetV3PublishState(existingVersion, out var parsedState))
                            return new DosResult<object>(0, null, "既有 v3 版本 PublishState 不合法");
                        existingState = parsedState;
                    }

                    if (string.Equals(request.PublishMode, "stage", StringComparison.Ordinal))
                    {
                        if (existingVersion != null)
                        {
                            if (IsApplicationAssetV3PointerCommittedState(existingState.Value))
                            {
                                var resolverError = ValidateApplicationAssetV3StableResolverTarget(
                                    osClient,
                                    lockedApp,
                                    existingVersion);
                                if (resolverError != null)
                                    return new DosResult<object>(0, null, "v3 完成态与应用指针冲突：" + resolverError);
                            }
                            else if (existingState.Value != ApplicationAssetV3PublishState.ReleaseVerified)
                            {
                                return new DosResult<object>(0, null,
                                    "v3 stage 只允许新建或精确回放 ReleaseVerified 版本");
                            }
                            return BuildApplicationAssetV3StageResult(
                                lockedApp,
                                existingVersion,
                                request,
                                plan,
                                true);
                        }

                        var appStageError = ValidateApplicationAssetV3AppExpectedState(
                            lockedApp,
                            request);
                        if (appStageError != null)
                            return new DosResult<object>(0, null, appStageError);
                        var versionStageError = ValidateApplicationAssetV3ExpectedVersionRow(
                            versionRows,
                            request,
                            expectedAppId,
                            plan.VersionNo,
                            true);
                        if (versionStageError != null)
                            return new DosResult<object>(0, null, versionStageError);
                        const long stagedRowVersion = 1L;
                        var insertCount = InsertApplicationAssetV3Version(
                            trans,
                            ResolveApplicationAssetV3SqlDialect(osClient),
                            versionId,
                            lockedApp,
                            request,
                            plan,
                            buildLog,
                            businessFencingToken,
                            stagedRowVersion);
                        if (insertCount != 1)
                            return new DosResult<object>(0, null, "新增 v3 ReleaseVerified 版本失败");
                        trans.Commit();
                        transactionCommitted = true;
                        var stagedVersion = BuildApplicationAssetV3VersionSnapshot(
                            versionId,
                            expectedAppId,
                            request,
                            plan,
                            buildLog,
                            businessFencingToken,
                            stagedRowVersion,
                            ApplicationAssetV3PublishState.ReleaseVerified);
                        return BuildApplicationAssetV3StageResult(
                            lockedApp,
                            stagedVersion,
                            request,
                            plan,
                            false);
                    }

                    if (existingVersion == null)
                        return new DosResult<object>(0, null, "v3 finalize 必须先完成同一 RequestId/Fingerprint 的 stage");
                    if (IsApplicationAssetV3PointerCommittedState(existingState.Value))
                    {
                        var resolverError = ValidateApplicationAssetV3StableResolverTarget(
                            osClient,
                            lockedApp,
                            existingVersion);
                        if (resolverError != null)
                            return new DosResult<object>(0, null, "v3 完成态与应用指针冲突：" + resolverError);
                        if (existingState.Value == ApplicationAssetV3PublishState.Completed)
                        {
                            return BuildApplicationAssetV3PendingResult(
                                lockedApp,
                                existingVersion,
                                request,
                                plan,
                                true);
                        }
                        trans.Commit();
                        transactionCommitted = true;
                        return await RollForwardApplicationAssetV3Projection(
                            osClient,
                            expectedAppId,
                            versionId,
                            request,
                            plan,
                            buildLog,
                            lease,
                            true).ConfigureAwait(false);
                    }
                    if (existingState.Value != ApplicationAssetV3PublishState.ReleaseVerified)
                        return new DosResult<object>(0, null, "v3 finalize 只接受 ReleaseVerified 版本");

                    var appExpectedError = ValidateApplicationAssetV3AppExpectedState(
                        lockedApp,
                        request);
                    if (appExpectedError != null)
                        return new DosResult<object>(0, null, appExpectedError);
                    // A frozen new-version request stages with an explicit null
                    // baseline. Once that exact RequestId/Fingerprint has
                    // consumed the null by creating ReleaseVerified RowVersion=1,
                    // finalize CASes the locked actual RowVersion. A non-null
                    // caller baseline remains an exact optimistic precondition.
                    var versionExpectedError = request.ExpectedVersionRowVersion.HasValue
                        ? ValidateApplicationAssetV3ExpectedVersionRow(
                            versionRows,
                            request,
                            expectedAppId,
                            plan.VersionNo,
                            true)
                        : null;
                    if (versionExpectedError != null)
                        return new DosResult<object>(0, null, versionExpectedError);
                    if (request.ExpectedPublishRowVersion == long.MaxValue)
                        return new DosResult<object>(0, null, "PublishRowVersion 已达到上限");
                    var stagedRowVersionForFinalize = SafeApplicationAssetV3Long(
                        existingVersion,
                        "RowVersion",
                        -1L);
                    if (stagedRowVersionForFinalize < 0 || stagedRowVersionForFinalize > long.MaxValue - 2)
                        return new DosResult<object>(0, null, "ReleaseVerified RowVersion 不合法或无法完成两步状态前滚");

                    var targetPublishRowVersion = request.ExpectedPublishRowVersion + 1;
                    var appCommitSql =
                        $"UPDATE {Q("sys_microistore")} SET " +
                        $"{Q("PublishProtocolVersion")}=3,{Q("PublishState")}=@publishState," +
                        $"{Q("PublishFence")}=@newFence,{Q("PublishRowVersion")}=@newRowVersion," +
                        $"{Q("ActivePublishVersionId")}=@versionId,{Q("CommittedPublishVersionId")}=@versionId," +
                        $"{Q("CommittedRuntimeManifestHash")}=@runtimeHash," +
                        BuildApplicationAssetV3LegacyPackageClearSql(dialect) + "," +
                        $"{Q("UpdateTime")}=@now " +
                        $"WHERE {Q("Id")}=@appId " +
                        $"AND COALESCE({Q("PublishFence")},0)=@expectedFence " +
                        $"AND COALESCE({Q("PublishRowVersion")},0)=@expectedRowVersion " +
                        $"AND {BuildApplicationAssetV3NullableStringEqualsSql(dialect, "ActivePublishVersionId", "@expectedActive")} " +
                        $"AND {BuildApplicationAssetV3NullableStringEqualsSql(dialect, "CommittedPublishVersionId", "@expectedCommitted")} " +
                        $"AND COALESCE({Q("CurrentVersion")},0)=@expectedCurrentVersion " +
                        $"AND {BuildApplicationAssetV3NullableStringEqualsSql(dialect, "AppVersion", "@expectedAppVersion")}";
                    var appCommitCount = trans.FromSql(appCommitSql)
                        .AddInParameter("@publishState", ApplicationAssetV3PublishState.PointerCommitted.ToString())
                        .AddInParameter("@newFence", businessFencingToken)
                        .AddInParameter("@newRowVersion", targetPublishRowVersion)
                        .AddInParameter("@versionId", versionId)
                        .AddInParameter("@runtimeHash", plan.RuntimeManifestHash)
                        .AddInParameter("@appId", expectedAppId)
                        .AddInParameter("@expectedFence", request.ExpectedPublishFence)
                        .AddInParameter("@expectedRowVersion", request.ExpectedPublishRowVersion)
                        .AddInParameter("@expectedActive", request.ExpectedActivePublishVersionId)
                        .AddInParameter("@expectedCommitted", request.ExpectedCommittedPublishVersionId)
                        .AddInParameter("@expectedCurrentVersion", request.ExpectedCurrentVersion)
                        .AddInParameter("@expectedAppVersion", request.ExpectedAppVersion)
                        .AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                        .ExecuteNonQuery();
                    if (appCommitCount != 1)
                        return new DosResult<object>(0, null, "sys_microistore v3 指针 CAS 失败，未提交任何变更");

                    var pointerVersionRowVersion = stagedRowVersionForFinalize + 1;
                    var versionCommitSql =
                        $"UPDATE {Q("mci_ai_app_version")} SET {Q("PublishState")}=@state,{Q("Status")}=@state," +
                        $"{Q("FencingToken")}=@fence,{Q("RowVersion")}=@newRow,{Q("PointerCommittedAt")}=@now," +
                        $"{Q("CompletedAt")}=NULL,{Q("LastError")}=NULL,{Q("UpdateTime")}=@now " +
                        $"WHERE {Q("Id")}=@id AND {Q("RowVersion")}=@oldRow AND {Q("PublishState")}=@expectedState";
                    var versionCommitCount = trans.FromSql(versionCommitSql)
                        .AddInParameter("@state", ApplicationAssetV3PublishState.PointerCommitted.ToString())
                        .AddInParameter("@fence", businessFencingToken)
                        .AddInParameter("@newRow", pointerVersionRowVersion)
                        .AddInParameter("@id", versionId)
                        .AddInParameter("@oldRow", stagedRowVersionForFinalize)
                        .AddInParameter("@expectedState", ApplicationAssetV3PublishState.ReleaseVerified.ToString())
                        .AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                        .ExecuteNonQuery();
                    if (versionCommitCount != 1)
                        return new DosResult<object>(0, null, "mci_ai_app_version v3 PointerCommitted CAS 失败");

                    // ProjectionPending is a roll-forward state, not a rollback
                    // of the committed pointer. Persist the canonical transition
                    // explicitly in the same atomic database transaction.
                    var appProjectionSql =
                        $"UPDATE {Q("sys_microistore")} SET {Q("PublishState")}=@projectionState,{Q("UpdateTime")}=@now " +
                        $"WHERE {Q("Id")}=@appId AND {Q("PublishProtocolVersion")}=3 " +
                        $"AND {Q("PublishState")}=@pointerState AND {Q("PublishRowVersion")}=@rowVersion " +
                        $"AND {Q("CommittedPublishVersionId")}=@versionId " +
                        $"AND {Q("CommittedRuntimeManifestHash")}=@runtimeHash";
                    var appProjectionCount = trans.FromSql(appProjectionSql)
                        .AddInParameter("@projectionState", ApplicationAssetV3PublishState.ProjectionPending.ToString())
                        .AddInParameter("@appId", expectedAppId)
                        .AddInParameter("@pointerState", ApplicationAssetV3PublishState.PointerCommitted.ToString())
                        .AddInParameter("@rowVersion", targetPublishRowVersion)
                        .AddInParameter("@versionId", versionId)
                        .AddInParameter("@runtimeHash", plan.RuntimeManifestHash)
                        .AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                        .ExecuteNonQuery();
                    if (appProjectionCount != 1)
                        return new DosResult<object>(0, null, "sys_microistore PointerCommitted→ProjectionPending 前滚失败");

                    var committedVersionRowVersion = pointerVersionRowVersion + 1;
                    var versionProjectionSql =
                        $"UPDATE {Q("mci_ai_app_version")} SET {Q("PublishState")}=@projectionState,{Q("Status")}=@projectionState," +
                        $"{Q("RowVersion")}=@newRow,{Q("LastError")}=NULL,{Q("UpdateTime")}=@now " +
                        $"WHERE {Q("Id")}=@id AND {Q("RowVersion")}=@oldRow AND {Q("PublishState")}=@pointerState";
                    var versionProjectionCount = trans.FromSql(versionProjectionSql)
                        .AddInParameter("@projectionState", ApplicationAssetV3PublishState.ProjectionPending.ToString())
                        .AddInParameter("@newRow", committedVersionRowVersion)
                        .AddInParameter("@id", versionId)
                        .AddInParameter("@oldRow", pointerVersionRowVersion)
                        .AddInParameter("@pointerState", ApplicationAssetV3PublishState.PointerCommitted.ToString())
                        .AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                        .ExecuteNonQuery();
                    if (versionProjectionCount != 1)
                        return new DosResult<object>(0, null, "mci_ai_app_version PointerCommitted→ProjectionPending 前滚失败");

                    trans.Commit();
                    transactionCommitted = true;
                    return await RollForwardApplicationAssetV3Projection(
                        osClient,
                        expectedAppId,
                        versionId,
                        request,
                        plan,
                        buildLog,
                        lease,
                        false).ConfigureAwait(false);
                }
                catch
                {
                    // Before the database pointer transaction commits, rollback
                    // is safe and required. Once committed, any projection or
                    // response failure must roll forward through recovery; the
                    // authoritative pointer must never be reverted.
                    if (!transactionCommitted)
                    {
                        try { trans.Rollback(); } catch { }
                    }
                    throw;
                }
            }
        }

        private static async Task<DosResult<object>> RollForwardApplicationAssetV3Projection(
            string osClient,
            string appId,
            string versionId,
            ApplicationAssetV3ProtocolRequest request,
            ApplicationAssetV3PublishPlan plan,
            string buildLog,
            IMicroiLockLease lease,
            bool idempotent)
        {
            string projectionError = null;
            try
            {
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null) throw new InvalidOperationException("未找到租户主库连接");
                var dialect = ResolveApplicationAssetV3SqlDialect(osClient);
                string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);

                using var trans = client.Db.BeginTransaction();
                var committed = false;
                try
                {
                    var app = ReadApplicationAssetV3AppStrong(osClient, appId, trans, true);
                    var versions = ReadApplicationAssetV3VersionRowsStrong(
                        osClient,
                        appId,
                        plan.VersionNo,
                        trans,
                        true);
                    if (versions.Count != 1)
                        throw new InvalidOperationException("投影要求精确一条 committed v3 版本");
                    var version = versions[0];
                    var immutableError = ValidateApplicationAssetV3VersionImmutableFacts(
                        version,
                        versionId,
                        request,
                        plan,
                        buildLog);
                    if (immutableError != null)
                        throw new InvalidOperationException("投影版本不可变事实冲突：" + immutableError);
                    var resolverError = ValidateApplicationAssetV3StableResolverTarget(
                        osClient,
                        app,
                        version);
                    if (resolverError != null)
                        throw new InvalidOperationException("投影 committed pointer 冲突：" + resolverError);
                    if (!TryParseApplicationAssetV3PublishState(app, out var appState)
                        || !TryParseApplicationAssetV3PublishState(version, out var versionState))
                    {
                        throw new InvalidOperationException("投影状态不合法");
                    }
                    if (!IsApplicationAssetV3PointerCommittedState(appState)
                        || !IsApplicationAssetV3PointerCommittedState(versionState))
                    {
                        throw new InvalidOperationException("投影只允许 PointerCommitted 之后的前滚状态");
                    }

                    var committedFence = SafeApplicationAssetV3Long(app, "PublishFence", -1L);
                    var committedPublishRowVersion = SafeApplicationAssetV3Long(
                        app,
                        "PublishRowVersion",
                        -1L);
                    var versionFence = SafeApplicationAssetV3Long(version, "FencingToken", -1L);
                    if (committedFence < 0
                        || committedPublishRowVersion < 0
                        || versionFence != committedFence)
                    {
                        throw new InvalidOperationException("投影 fence/rowversion proof 不一致");
                    }

                    for (var index = 0; index < plan.Assets.Count; index++)
                    {
                        if ((index & 63) == 0)
                            await lease.EnsureHeldAsync().ConfigureAwait(false);
                        var fileError = UpsertApplicationAssetV3ProjectionFile(
                            trans,
                            dialect,
                            osClient,
                            app,
                            versionId,
                            plan,
                            plan.Assets[index]);
                        if (fileError != null) throw new InvalidOperationException(fileError);
                    }

                    var manifestReadbackError = ValidateApplicationAssetV3ProjectionFileSet(
                        trans,
                        dialect,
                        versionId,
                        plan);
                    if (manifestReadbackError != null)
                        throw new InvalidOperationException(manifestReadbackError);

                    var microServiceProjectionError = ProjectApplicationAssetV3MicroServiceDerivedCache(
                        trans,
                        dialect,
                        osClient,
                        app,
                        version,
                        versionId,
                        plan);
                    if (microServiceProjectionError != null)
                        throw new InvalidOperationException(microServiceProjectionError);
                    var postSideEffectApp = ReadApplicationAssetV3AppStrong(
                        osClient,
                        appId,
                        trans,
                        false);
                    var postSideEffectVersions = ReadApplicationAssetV3VersionRowsStrong(
                        osClient,
                        appId,
                        plan.VersionNo,
                        trans,
                        false);
                    if (postSideEffectVersions.Count != 1
                        || !string.Equals(
                            SafeJString(postSideEffectVersions[0], "Id"),
                            versionId,
                            StringComparison.Ordinal))
                    {
                        throw new InvalidOperationException("MicroService projection 后 version pointer 漂移");
                    }
                    var postSideEffectProof = ValidateApplicationAssetV3StableResolverTarget(
                        osClient,
                        postSideEffectApp,
                        postSideEffectVersions[0]);
                    if (postSideEffectProof != null)
                        throw new InvalidOperationException("projection 后 committed proof 漂移：" + postSideEffectProof);

                    var archiveSql =
                        $"UPDATE {Q("mci_ai_app_file")} SET {Q("StorageScope")}=@archived,{Q("UpdateTime")}=@now " +
                        $"WHERE {Q("AppId")}=@appId AND {Q("StorageScope")}=@active " +
                        $"AND ({Q("VersionId")} IS NULL OR {Q("VersionId")}<>@versionId)";
                    trans.FromSql(archiveSql)
                        .AddInParameter("@archived", ArchivedStreamBuildStorageScope)
                        .AddInParameter("@active", ActiveStreamBuildStorageScope)
                        .AddInParameter("@appId", appId)
                        .AddInParameter("@versionId", versionId)
                        .AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                        .ExecuteNonQuery();

                    if (request.ExpectedCurrentVersion == int.MaxValue)
                        throw new InvalidOperationException("CurrentVersion 已达到上限");
                    var desiredCurrentVersion = request.ExpectedCurrentVersion + 1;
                    var actualCurrentVersion = SafeJInt(app, "CurrentVersion");
                    var actualAppVersion = ReadApplicationAssetV3NullableStringFact(app, "AppVersion");
                    var baselineClassic = IsApplicationAssetV3ClassicBaseline(
                        app,
                        request.ExpectedCurrentVersion,
                        request.ExpectedAppVersion);
                    var desiredClassic = actualCurrentVersion == desiredCurrentVersion
                                         && string.Equals(actualAppVersion, plan.VersionNo, StringComparison.Ordinal)
                                         && string.Equals(SafeJString(app, "Status"), "Published", StringComparison.Ordinal)
                                         && string.Equals(SafeJString(app, "BuildStatus"), "Success", StringComparison.Ordinal)
                                         && string.Equals(
                                             SafeJString(app, "PublicPublishPath"),
                                             plan.StableResolverPath,
                                             StringComparison.Ordinal)
                                         && string.Equals(
                                             SafeJString(app, "LastBuildTaskId"),
                                             request.DeliveryBatchId,
                                             StringComparison.Ordinal);
                    if (!baselineClassic && !desiredClassic)
                        throw new InvalidOperationException("classic 应用字段既非冻结基线也非当前 committed release");

                    if (appState != ApplicationAssetV3PublishState.Completed || !desiredClassic)
                    {
                        var appCompleteSql =
                            $"UPDATE {Q("sys_microistore")} SET " +
                            $"{Q("Status")}=@published,{Q("BuildStatus")}=@success,{Q("AppVersion")}=@versionNo," +
                            $"{Q("CurrentVersion")}=@currentVersion,{Q("PreviewUrl")}=@stablePath," +
                            $"{Q("PublicPublishPath")}=@stablePath,{Q("LastBuildTaskId")}=@batchId," +
                            $"{Q("LastBuildMsg")}=@buildMsg,{Q("PublishState")}=@completed,{Q("UpdateTime")}=@now " +
                            $"WHERE {Q("Id")}=@appId AND {Q("PublishProtocolVersion")}=3 " +
                            $"AND {Q("CommittedPublishVersionId")}=@versionId " +
                            $"AND {Q("CommittedRuntimeManifestHash")}=@runtimeHash " +
                            $"AND {Q("PublishFence")}=@fence AND {Q("PublishRowVersion")}=@publishRowVersion " +
                            $"AND {Q("PublishState")} IN (@pointer,@pending,@repair,@completed)";
                        var appCompleteCount = trans.FromSql(appCompleteSql)
                            .AddInParameter("@published", "Published")
                            .AddInParameter("@success", "Success")
                            .AddInParameter("@versionNo", plan.VersionNo)
                            .AddInParameter("@currentVersion", desiredCurrentVersion)
                            .AddInParameter("@stablePath", plan.StableResolverPath)
                            .AddInParameter("@batchId", request.DeliveryBatchId)
                            .AddInParameter("@buildMsg",
                                $"ProtocolVersion=3；RequestId={request.RequestId}；DeliveryBatchId={request.DeliveryBatchId}；" +
                                $"CommittedPublishVersionId={versionId}；RuntimeManifestHash={plan.RuntimeManifestHash}；" +
                                $"PublishFence={committedFence}。")
                            .AddInParameter("@completed", ApplicationAssetV3PublishState.Completed.ToString())
                            .AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                            .AddInParameter("@appId", appId)
                            .AddInParameter("@versionId", versionId)
                            .AddInParameter("@runtimeHash", plan.RuntimeManifestHash)
                            .AddInParameter("@fence", committedFence)
                            .AddInParameter("@publishRowVersion", committedPublishRowVersion)
                            .AddInParameter("@pointer", ApplicationAssetV3PublishState.PointerCommitted.ToString())
                            .AddInParameter("@pending", ApplicationAssetV3PublishState.ProjectionPending.ToString())
                            .AddInParameter("@repair", ApplicationAssetV3PublishState.RepairRequired.ToString())
                            .ExecuteNonQuery();
                        if (appCompleteCount != 1)
                            throw new InvalidOperationException("sys_microistore Completed proof CAS 失败");
                    }

                    var completedVersionRowVersion = SafeApplicationAssetV3Long(
                        version,
                        "RowVersion",
                        -1L);
                    if (completedVersionRowVersion < 0 || completedVersionRowVersion == long.MaxValue)
                        throw new InvalidOperationException("版本 RowVersion 不合法或已达到上限");
                    if (versionState != ApplicationAssetV3PublishState.Completed)
                    {
                        var versionCompleteSql =
                            $"UPDATE {Q("mci_ai_app_version")} SET {Q("PublishState")}=@completed," +
                            $"{Q("Status")}=@completed,{Q("RowVersion")}=@nextRow,{Q("CompletedAt")}=@now," +
                            $"{Q("LastError")}=NULL,{Q("UpdateTime")}=@now " +
                            $"WHERE {Q("Id")}=@versionId AND {Q("RowVersion")}=@oldRow " +
                            $"AND {Q("FencingToken")}=@fence AND {Q("RuntimeManifestHash")}=@runtimeHash " +
                            $"AND {Q("RequestId")}=@requestId AND {Q("RequestFingerprint")}=@fingerprint " +
                            $"AND {Q("PublishState")} IN (@pointer,@pending,@repair)";
                        var versionCompleteCount = trans.FromSql(versionCompleteSql)
                            .AddInParameter("@completed", ApplicationAssetV3PublishState.Completed.ToString())
                            .AddInParameter("@nextRow", completedVersionRowVersion + 1)
                            .AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                            .AddInParameter("@versionId", versionId)
                            .AddInParameter("@oldRow", completedVersionRowVersion)
                            .AddInParameter("@fence", committedFence)
                            .AddInParameter("@runtimeHash", plan.RuntimeManifestHash)
                            .AddInParameter("@requestId", request.RequestId)
                            .AddInParameter("@fingerprint", request.RequestFingerprint)
                            .AddInParameter("@pointer", ApplicationAssetV3PublishState.PointerCommitted.ToString())
                            .AddInParameter("@pending", ApplicationAssetV3PublishState.ProjectionPending.ToString())
                            .AddInParameter("@repair", ApplicationAssetV3PublishState.RepairRequired.ToString())
                            .ExecuteNonQuery();
                        if (versionCompleteCount != 1)
                            throw new InvalidOperationException("mci_ai_app_version Completed proof CAS 失败");
                        completedVersionRowVersion++;
                    }

                    var finalProofApp = ReadApplicationAssetV3AppStrong(osClient, appId, trans, false);
                    var finalProofVersions = ReadApplicationAssetV3VersionRowsStrong(
                        osClient,
                        appId,
                        plan.VersionNo,
                        trans,
                        false);
                    if (finalProofVersions.Count != 1
                        || !string.Equals(SafeJString(finalProofVersions[0], "Id"), versionId, StringComparison.Ordinal))
                    {
                        throw new InvalidOperationException("Completed 前 version 精确回读失败");
                    }
                    var finalProofError = ValidateApplicationAssetV3StableResolverTarget(
                        osClient,
                        finalProofApp,
                        finalProofVersions[0]);
                    if (finalProofError != null)
                        throw new InvalidOperationException("Completed 前 committed proof 回读失败：" + finalProofError);

                    trans.Commit();
                    committed = true;
                    var completedApp = (JObject)app.DeepClone();
                    completedApp["Status"] = "Published";
                    completedApp["BuildStatus"] = "Success";
                    completedApp["AppVersion"] = plan.VersionNo;
                    completedApp["CurrentVersion"] = desiredCurrentVersion;
                    completedApp["PreviewUrl"] = plan.StableResolverPath;
                    completedApp["PublicPublishPath"] = plan.StableResolverPath;
                    completedApp["LastBuildTaskId"] = request.DeliveryBatchId;
                    completedApp["PublishState"] = ApplicationAssetV3PublishState.Completed.ToString();
                    var completedVersion = (JObject)version.DeepClone();
                    completedVersion["Status"] = ApplicationAssetV3PublishState.Completed.ToString();
                    completedVersion["PublishState"] = ApplicationAssetV3PublishState.Completed.ToString();
                    completedVersion["RowVersion"] = completedVersionRowVersion;
                    completedVersion["LastError"] = JValue.CreateNull();
                    return BuildApplicationAssetV3PendingResult(
                        completedApp,
                        completedVersion,
                        request,
                        plan,
                        idempotent);
                }
                catch
                {
                    if (!committed)
                    {
                        try { trans.Rollback(); } catch { }
                    }
                    throw;
                }
            }
            catch (Exception ex)
            {
                projectionError = ex.Message;
            }

            return MarkApplicationAssetV3ProjectionRepairRequired(
                osClient,
                appId,
                versionId,
                request,
                plan,
                projectionError,
                idempotent);
        }

        private static string UpsertApplicationAssetV3ProjectionFile(
            DbTrans trans,
            ApplicationAssetV3SqlDialect dialect,
            string osClient,
            JObject app,
            string versionId,
            ApplicationAssetV3PublishPlan plan,
            StreamPublishAsset asset)
        {
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
            var filePath = NormalizeApplicationAssetRelativePath("dist/" + asset.RelativePath);
            if (filePath.Length > 1000) return "投影 FilePath 超过 varchar(1000)：" + filePath;
            var filePathHash = Sha256Hex(filePath);
            var stableAssetPath = BuildApplicationAssetV3StableResolverPath(
                plan.Identity,
                asset.RelativePath);
            if (asset.Paths.VersionPath.Length > 1000 || stableAssetPath.Length > 1000)
                return "投影 HdfsPath/PublishHdfsPath 超过 varchar(1000)：" + filePath;

            var where = $"{Q("VersionId")}=@versionId AND {Q("FilePathHash")}=@pathHash";
            var selectSql = BuildApplicationAssetV3LimitedSelectSql(
                dialect,
                "mci_ai_app_file",
                "*",
                where,
                2,
                true);
            var rows = trans.FromSql(selectSql)
                           .AddInParameter("@versionId", versionId)
                           .AddInParameter("@pathHash", filePathHash)
                           .ToList<dynamic>()
                       ?? new List<dynamic>();
            if (rows.Count > 1) return "VersionId+FilePathHash 命中多行，已 fail closed：" + filePath;
            var existing = rows.Count == 1
                ? rows[0] as JObject ?? JObject.FromObject((object)rows[0])
                : null;
            if (existing != null
                && !string.Equals(SafeJString(existing, "FilePath"), filePath, StringComparison.Ordinal))
            {
                return "FilePathHash 碰撞：同一 hash 对应不同完整 FilePath";
            }
            if (existing != null
                && (!string.Equals(SafeJString(existing, "AppId"), SafeJString(app, "Id"), StringComparison.Ordinal)
                    || !string.Equals(SafeJString(existing, "VersionId"), versionId, StringComparison.Ordinal)))
            {
                return "既有投影文件 AppId/VersionId 冲突：" + filePath;
            }

            var now = DateTime.Now;
            if (existing == null)
            {
                var columns = new[]
                {
                    "Id", "AppId", "AppName", "VersionId", "FilePath", "FilePathHash", "FileName", "FileType",
                    "HdfsPath", "PublishHdfsPath", "StorageScope", "ContentHash", "Size", "IsDirectory", "Version",
                    "IsDeleted", "CreateTime", "UpdateTime"
                };
                var values = new[]
                {
                    "@id", "@appId", "@appName", "@versionId", "@filePath", "@pathHash", "@fileName", "@fileType",
                    "@hdfsPath", "@publishPath", "@scope", "@contentHash", "@size", "0", "1", "0", "@now", "@now"
                };
                var inserted = trans.FromSql(BuildApplicationAssetV3InsertSql(
                        dialect,
                        "mci_ai_app_file",
                        columns,
                        values))
                    .AddInParameter("@id", BuildApplicationStreamRecordId(
                        "file",
                        osClient,
                        SafeJString(app, "Id"),
                        versionId + "\n" + filePathHash))
                    .AddInParameter("@appId", SafeJString(app, "Id"))
                    .AddInParameter("@appName", SafeJString(app, "Name", SafeJString(app, "AppName")))
                    .AddInParameter("@versionId", versionId)
                    .AddInParameter("@filePath", filePath)
                    .AddInParameter("@pathHash", filePathHash)
                    .AddInParameter("@fileName", Path.GetFileName(asset.RelativePath))
                    .AddInParameter("@fileType", Path.GetExtension(asset.RelativePath).TrimStart('.').ToLowerInvariant())
                    .AddInParameter("@hdfsPath", asset.Paths.VersionPath)
                    .AddInParameter("@publishPath", stableAssetPath)
                    .AddInParameter("@scope", ActiveStreamBuildStorageScope)
                    .AddInParameter("@contentHash", asset.Sha256)
                    .AddInParameter("@size", asset.Size)
                    .AddInParameter("@now", System.Data.DbType.DateTime, now)
                    .ExecuteNonQuery();
                return inserted == 1 ? null : "新增 v3 投影文件失败：" + filePath;
            }

            var updateSql =
                $"UPDATE {Q("mci_ai_app_file")} SET {Q("AppName")}=@appName,{Q("FileName")}=@fileName," +
                $"{Q("FileType")}=@fileType,{Q("HdfsPath")}=@hdfsPath,{Q("PublishHdfsPath")}=@publishPath," +
                $"{Q("StorageScope")}=@scope,{Q("ContentHash")}=@contentHash,{Q("Size")}=@size," +
                $"{Q("IsDirectory")}=0,{Q("IsDeleted")}=0,{Q("UpdateTime")}=@now " +
                $"WHERE {Q("Id")}=@id AND {Q("VersionId")}=@versionId " +
                $"AND {Q("FilePathHash")}=@pathHash AND {Q("FilePath")}=@filePath";
            var updated = trans.FromSql(updateSql)
                .AddInParameter("@appName", SafeJString(app, "Name", SafeJString(app, "AppName")))
                .AddInParameter("@fileName", Path.GetFileName(asset.RelativePath))
                .AddInParameter("@fileType", Path.GetExtension(asset.RelativePath).TrimStart('.').ToLowerInvariant())
                .AddInParameter("@hdfsPath", asset.Paths.VersionPath)
                .AddInParameter("@publishPath", stableAssetPath)
                .AddInParameter("@scope", ActiveStreamBuildStorageScope)
                .AddInParameter("@contentHash", asset.Sha256)
                .AddInParameter("@size", asset.Size)
                .AddInParameter("@now", System.Data.DbType.DateTime, now)
                .AddInParameter("@id", SafeJString(existing, "Id"))
                .AddInParameter("@versionId", versionId)
                .AddInParameter("@pathHash", filePathHash)
                .AddInParameter("@filePath", filePath)
                .ExecuteNonQuery();
            return updated == 1 ? null : "更新 v3 投影文件 CAS 失败：" + filePath;
        }

        private static string ValidateApplicationAssetV3ProjectionFileSet(
            DbTrans trans,
            ApplicationAssetV3SqlDialect dialect,
            string versionId,
            ApplicationAssetV3PublishPlan plan)
        {
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
            var selectSql = BuildApplicationAssetV3LimitedSelectSql(
                dialect,
                "mci_ai_app_file",
                string.Join(",", new[] { Q("FilePath"), Q("FilePathHash") }),
                $"{Q("VersionId")}=@versionId",
                MaxStreamPublishAssetCount + 1,
                true);
            var rows = trans.FromSql(selectSql)
                           .AddInParameter("@versionId", versionId)
                           .ToList<dynamic>()
                       ?? new List<dynamic>();
            if (rows.Count != plan.Assets.Count)
                return $"v3 投影文件清单数量不一致：Expected={plan.Assets.Count}，Actual={rows.Count}";
            var expected = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var asset in plan.Assets)
            {
                var filePath = NormalizeApplicationAssetRelativePath("dist/" + asset.RelativePath);
                expected[filePath] = Sha256Hex(filePath);
            }
            foreach (var raw in rows)
            {
                var row = raw as JObject ?? JObject.FromObject((object)raw);
                var filePath = SafeJString(row, "FilePath");
                var hash = SafeJString(row, "FilePathHash");
                if (!expected.TryGetValue(filePath, out var expectedHash)
                    || !string.Equals(hash, expectedHash, StringComparison.Ordinal))
                {
                    return "v3 投影文件清单全文路径/hash 回读不一致";
                }
            }
            return null;
        }

        private static string ProjectApplicationAssetV3MicroServiceDerivedCache(
            DbTrans trans,
            ApplicationAssetV3SqlDialect dialect,
            string osClient,
            JObject app,
            JObject version,
            string versionId,
            ApplicationAssetV3PublishPlan plan)
        {
            if (!string.Equals(plan.ApplicationType, "microservice", StringComparison.Ordinal)) return null;
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
            var appId = SafeJString(app, "Id");
            var fence = SafeApplicationAssetV3Long(app, "PublishFence", -1L);
            if (fence <= 0L) return "MicroService projection PublishFence 必须大于0";

            var publishedAssets = new JArray(plan.Assets.Select(asset => new JObject
            {
                ["Path"] = asset.RelativePath,
                ["FilePathName"] = asset.Paths.VersionPath,
                ["StableFilePathName"] = BuildApplicationAssetV3StableResolverPath(
                    plan.Identity,
                    asset.RelativePath),
                ["Sha256"] = asset.Sha256,
                ["Size"] = asset.Size,
                ["IsEntry"] = asset.IsEntry
            }));
            var serviceManifest = CanonicalizeApplicationAssetV3JsonToken(new JObject
            {
                ["SchemaVersion"] = 3,
                ["CommittedPublishVersionId"] = versionId,
                ["PublishFence"] = FormatApplicationAssetV3Int64(fence),
                ["RequestFingerprint"] = SafeJString(version, "RequestFingerprint"),
                ["RuntimeManifestHash"] = plan.RuntimeManifestHash,
                ["RouteSnapshotHash"] = plan.RouteSnapshotHash,
                ["RouteSnapshotJson"] = plan.RouteSnapshotJson,
                ["Assets"] = publishedAssets
            }).ToString(Formatting.None);
            var assetsJson = publishedAssets.ToString(Formatting.None);
            var desiredService = new JObject
            {
                ["MsKey"] = plan.AppKey,
                ["MsName"] = SafeJString(app, "Name", SafeJString(app, "AppName", plan.AppKey)),
                ["MsType"] = "前端",
                ["Runtime"] = "micro-app",
                ["StorageMode"] = "file",
                ["MsUrl"] = ResolveApplicationAssetV3MicroServiceProjectionUrl(
                    plan.StableResolverPath),
                ["IsEnable"] = 1,
                ["EntryPath"] = plan.EntryPath,
                ["AssetCount"] = plan.FileCount,
                ["TotalSize"] = plan.TotalSize,
                ["DistHash"] = plan.RuntimeManifestHash,
                ["Description"] = SafeJString(app, "Description", SafeJString(app, "AppDetail")),
                ["BuildVersion"] = plan.VersionNo,
                ["AssetsJson"] = assetsJson,
                ["AssetManifestJson"] = serviceManifest
            };

            var serviceRows = trans.FromSql(BuildApplicationAssetV3LimitedSelectSql(
                    dialect,
                    "sys_microiservice",
                    "*",
                    $"{Q("MsKey")}=@msKey",
                    2,
                    true))
                .AddInParameter("@msKey", plan.AppKey)
                .ToList<dynamic>() ?? new List<dynamic>();
            if (serviceRows.Count > 1) return "同一 MsKey 命中多条派生缓存，已 fail closed";
            var existingService = serviceRows.Count == 1
                ? serviceRows[0] as JObject ?? JObject.FromObject((object)serviceRows[0])
                : null;
            var serviceId = existingService == null
                ? BuildApplicationStreamRecordId("microservice", osClient, appId, plan.AppKey)
                : SafeApplicationAssetV3DbString(existingService, "Id");
            if (serviceId.DosIsNullOrWhiteSpace()) return "MicroService 派生缓存 Id 为空";
            desiredService["Id"] = serviceId;
            var now = DateTime.Now;
            // sys_microiservice.PublishTime is a legacy varchar field. Bind the
            // platform's canonical 19-character timestamp instead of relying on
            // provider-specific DateTime serialization (which can include
            // fractional seconds and overflow varchar(25)).
            var publishTime = now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
            if (existingService == null)
            {
                var columns = new[]
                {
                    "Id", "MsKey", "MsName", "MsType", "Runtime", "StorageMode", "MsUrl", "IsEnable",
                    "PublishTime", "EntryPath", "AssetCount", "TotalSize", "DistHash", "Description",
                    "BuildVersion", "AssetsJson", "AssetManifestJson", "IsDeleted", "CreateTime", "UpdateTime"
                };
                var values = new[]
                {
                    "@id", "@msKey", "@msName", "@msType", "@runtime", "@storage", "@url", "1",
                    "@publishTime", "@entry", "@assetCount", "@totalSize", "@distHash", "@description",
                    "@buildVersion", "@assetsJson", "@manifest", "0", "@now", "@now"
                };
                var inserted = trans.FromSql(BuildApplicationAssetV3InsertSql(
                        dialect,
                        "sys_microiservice",
                        columns,
                        values))
                    .AddInParameter("@id", serviceId)
                    .AddInParameter("@msKey", plan.AppKey)
                    .AddInParameter("@msName", SafeJString(desiredService, "MsName"))
                    .AddInParameter("@msType", "前端")
                    .AddInParameter("@runtime", "micro-app")
                    .AddInParameter("@storage", "file")
                    .AddInParameter("@url", SafeJString(desiredService, "MsUrl"))
                    .AddInParameter("@publishTime", publishTime)
                    .AddInParameter("@now", System.Data.DbType.DateTime, now)
                    .AddInParameter("@entry", plan.EntryPath)
                    .AddInParameter("@assetCount", plan.FileCount)
                    .AddInParameter("@totalSize", plan.TotalSize)
                    .AddInParameter("@distHash", plan.RuntimeManifestHash)
                    .AddInParameter("@description", SafeJString(desiredService, "Description"))
                    .AddInParameter("@buildVersion", plan.VersionNo)
                    .AddInParameter("@assetsJson", assetsJson)
                    .AddInParameter("@manifest", serviceManifest)
                    .ExecuteNonQuery();
                if (inserted != 1) return "新增 MicroService 派生缓存失败";
            }
            else
            {
                var updateSql =
                    $"UPDATE {Q("sys_microiservice")} SET {Q("MsName")}=@msName,{Q("MsType")}=@msType," +
                    $"{Q("Runtime")}=@runtime,{Q("StorageMode")}=@storage,{Q("MsUrl")}=@url," +
                    $"{Q("IsEnable")}=1,{Q("PublishTime")}=@publishTime,{Q("EntryPath")}=@entry," +
                    $"{Q("AssetCount")}=@assetCount,{Q("TotalSize")}=@totalSize,{Q("DistHash")}=@distHash," +
                    $"{Q("Description")}=@description,{Q("BuildVersion")}=@buildVersion," +
                    $"{Q("AssetsJson")}=@assetsJson,{Q("AssetManifestJson")}=@manifest," +
                    $"{Q("IsDeleted")}=0,{Q("UpdateTime")}=@now " +
                    $"WHERE {Q("Id")}=@id AND {Q("MsKey")}=@msKey " +
                    $"AND {BuildApplicationAssetV3NullableStringEqualsSql(dialect, "BuildVersion", "@oldBuildVersion")} " +
                    $"AND {BuildApplicationAssetV3NullableStringEqualsSql(dialect, "DistHash", "@oldDistHash")} " +
                    $"AND {BuildApplicationAssetV3NullableStringEqualsSql(dialect, "AssetManifestJson", "@oldManifest")}";
                var updated = trans.FromSql(updateSql)
                    .AddInParameter("@msName", SafeJString(desiredService, "MsName"))
                    .AddInParameter("@msType", "前端")
                    .AddInParameter("@runtime", "micro-app")
                    .AddInParameter("@storage", "file")
                    .AddInParameter("@url", SafeJString(desiredService, "MsUrl"))
                    .AddInParameter("@publishTime", publishTime)
                    .AddInParameter("@now", System.Data.DbType.DateTime, now)
                    .AddInParameter("@entry", plan.EntryPath)
                    .AddInParameter("@assetCount", plan.FileCount)
                    .AddInParameter("@totalSize", plan.TotalSize)
                    .AddInParameter("@distHash", plan.RuntimeManifestHash)
                    .AddInParameter("@description", SafeJString(desiredService, "Description"))
                    .AddInParameter("@buildVersion", plan.VersionNo)
                    .AddInParameter("@assetsJson", assetsJson)
                    .AddInParameter("@manifest", serviceManifest)
                    .AddInParameter("@id", serviceId)
                    .AddInParameter("@msKey", plan.AppKey)
                    .AddInParameter("@oldBuildVersion", ReadApplicationAssetV3NullableStringFact(existingService, "BuildVersion"))
                    .AddInParameter("@oldDistHash", ReadApplicationAssetV3NullableStringFact(existingService, "DistHash"))
                    .AddInParameter("@oldManifest", ReadApplicationAssetV3NullableStringFact(existingService, "AssetManifestJson"))
                    .ExecuteNonQuery();
                if (updated != 1) return "更新 MicroService 派生缓存旧值 CAS 失败";
            }

            var pageRows = trans.FromSql(BuildApplicationAssetV3SelectSql(
                    dialect,
                    "sys_microiservice_page",
                    "*",
                    $"{Q("MicroServiceId")}=@serviceId",
                    true))
                .AddInParameter("@serviceId", serviceId)
                .ToList<dynamic>() ?? new List<dynamic>();
            if (pageRows.Count > ApplicationAssetV3RouteSnapshotMaxRoutes * 2)
                return "MicroServiceId 派生页面数量异常，已 fail closed";
            var existingPages = pageRows
                .Select(row => row as JObject ?? JObject.FromObject((object)row))
                .ToList();
            var duplicateRoute = existingPages
                .GroupBy(row => SafeApplicationAssetV3DbString(row, "RoutePath"), StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault(group => group.Count() > 1);
            if (duplicateRoute != null)
                return "同一 MicroServiceId+RoutePath 命中多行，已 fail closed：" + duplicateRoute.Key;
            var existingByRoute = existingPages.ToDictionary(
                row => SafeApplicationAssetV3DbString(row, "RoutePath"),
                StringComparer.OrdinalIgnoreCase);
            var desiredPages = new List<JObject>();
            for (var index = 0; index < plan.Routes.Count; index++)
            {
                var route = (JObject)plan.Routes[index];
                var pageError = BuildApplicationAssetV3DesiredRoutePage(
                    route,
                    index,
                    serviceId,
                    versionId,
                    fence,
                    plan,
                    out var desiredPage);
                if (pageError != null) return pageError;
                desiredPages.Add(desiredPage);
                var routePath = SafeJString(desiredPage, "RoutePath");
                existingByRoute.TryGetValue(routePath, out var existingPage);
                var pageId = existingPage == null
                    ? BuildApplicationStreamRecordId("microservice-page", osClient, serviceId, routePath)
                    : SafeApplicationAssetV3DbString(existingPage, "Id");
                desiredPage["Id"] = pageId;
                if (existingPage == null)
                {
                    var columns = new[]
                    {
                        "Id", "MicroServiceId", "MicroServiceKey", "PageKey", "PageName", "PageTitle",
                        "RoutePath", "EntryPath", "SourceDirName", "MenuUrl", "Sort", "IsHome", "IsEnable",
                        "BuildVersion", "RouteMetaJson", "IsDeleted", "CreateTime", "UpdateTime"
                    };
                    var values = new[]
                    {
                        "@id", "@serviceId", "@serviceKey", "@pageKey", "@pageName", "@pageTitle",
                        "@routePath", "@entryPath", "@sourceDir", "@menuUrl", "@sort", "@isHome", "@isEnable",
                        "@buildVersion", "@routeMeta", "0", "@now", "@now"
                    };
                    var inserted = BindApplicationAssetV3RoutePageParameters(
                            trans.FromSql(BuildApplicationAssetV3InsertSql(
                                dialect,
                                "sys_microiservice_page",
                                columns,
                                values)),
                            desiredPage,
                            now)
                        .ExecuteNonQuery();
                    if (inserted != 1) return "新增 MicroService route 派生页失败：" + routePath;
                }
                else
                {
                    var updateSql =
                        $"UPDATE {Q("sys_microiservice_page")} SET {Q("MicroServiceKey")}=@serviceKey," +
                        $"{Q("PageKey")}=@pageKey,{Q("PageName")}=@pageName,{Q("PageTitle")}=@pageTitle," +
                        $"{Q("EntryPath")}=@entryPath,{Q("SourceDirName")}=@sourceDir,{Q("MenuUrl")}=@menuUrl," +
                        $"{Q("Sort")}=@sort,{Q("IsHome")}=@isHome,{Q("IsEnable")}=@isEnable," +
                        $"{Q("BuildVersion")}=@buildVersion,{Q("RouteMetaJson")}=@routeMeta," +
                        $"{Q("IsDeleted")}=0,{Q("UpdateTime")}=@now " +
                        $"WHERE {Q("Id")}=@id AND {Q("MicroServiceId")}=@serviceId AND {Q("RoutePath")}=@routePath " +
                        $"AND {BuildApplicationAssetV3NullableStringEqualsSql(dialect, "BuildVersion", "@oldBuildVersion")} " +
                        $"AND {BuildApplicationAssetV3NullableStringEqualsSql(dialect, "RouteMetaJson", "@oldRouteMeta")}";
                    var updated = BindApplicationAssetV3RoutePageParameters(
                            trans.FromSql(updateSql),
                            desiredPage,
                            now)
                        .AddInParameter("@oldBuildVersion", ReadApplicationAssetV3NullableStringFact(existingPage, "BuildVersion"))
                        .AddInParameter("@oldRouteMeta", ReadApplicationAssetV3NullableStringFact(existingPage, "RouteMetaJson"))
                        .ExecuteNonQuery();
                    if (updated != 1) return "更新 MicroService route 派生页旧值 CAS 失败：" + routePath;
                }
                existingByRoute.Remove(routePath);
            }

            foreach (var stale in existingByRoute.Values)
            {
                var staleSql =
                    $"UPDATE {Q("sys_microiservice_page")} SET {Q("IsEnable")}=0,{Q("IsDeleted")}=1,{Q("UpdateTime")}=@now " +
                    $"WHERE {Q("Id")}=@id AND {Q("MicroServiceId")}=@serviceId AND {Q("RoutePath")}=@routePath " +
                    $"AND COALESCE({Q("IsDeleted")},0)=@oldDeleted " +
                    $"AND {BuildApplicationAssetV3NullableStringEqualsSql(dialect, "BuildVersion", "@oldBuildVersion")}";
                var staleCount = trans.FromSql(staleSql)
                    .AddInParameter("@now", System.Data.DbType.DateTime, now)
                    .AddInParameter("@id", SafeApplicationAssetV3DbString(stale, "Id"))
                    .AddInParameter("@serviceId", serviceId)
                    .AddInParameter("@routePath", SafeApplicationAssetV3DbString(stale, "RoutePath"))
                    .AddInParameter("@oldDeleted", SafeApplicationAssetV3DbInt(stale, "IsDeleted", 0))
                    .AddInParameter("@oldBuildVersion", ReadApplicationAssetV3NullableStringFact(stale, "BuildVersion"))
                    .ExecuteNonQuery();
                if (staleCount != 1) return "软删 stale MicroService route CAS 失败";
            }

            var serviceReadback = trans.FromSql(BuildApplicationAssetV3LimitedSelectSql(
                    dialect,
                    "sys_microiservice",
                    "*",
                    $"{Q("MsKey")}=@msKey AND COALESCE({Q("IsDeleted")},0)=0",
                    2,
                    false))
                .AddInParameter("@msKey", plan.AppKey)
                .ToList<dynamic>() ?? new List<dynamic>();
            if (serviceReadback.Count != 1
                || !IsApplicationAssetV3DesiredService(
                    serviceReadback[0] as JObject ?? JObject.FromObject((object)serviceReadback[0]),
                    desiredService))
            {
                return "MicroService 派生缓存精确回读不一致";
            }
            var activePages = trans.FromSql(BuildApplicationAssetV3SelectSql(
                    dialect,
                    "sys_microiservice_page",
                    "*",
                    $"{Q("MicroServiceId")}=@serviceId AND COALESCE({Q("IsDeleted")},0)=0",
                    false))
                .AddInParameter("@serviceId", serviceId)
                .ToList<dynamic>() ?? new List<dynamic>();
            if (activePages.Count != desiredPages.Count) return "MicroService route 全量回读数量不一致";
            foreach (var desiredPage in desiredPages)
            {
                var matches = activePages
                    .Select(row => row as JObject ?? JObject.FromObject((object)row))
                    .Where(row => string.Equals(
                        SafeApplicationAssetV3DbString(row, "RoutePath"),
                        SafeJString(desiredPage, "RoutePath"),
                        StringComparison.Ordinal))
                    .ToList();
                if (matches.Count != 1 || !IsApplicationAssetV3DesiredRoutePage(matches[0], desiredPage))
                    return "MicroService route 精确全量回读不一致：" + SafeJString(desiredPage, "RoutePath");
            }
            return null;
        }

        private static string BuildApplicationAssetV3DesiredRoutePage(
            JObject route,
            int index,
            string serviceId,
            string versionId,
            long fence,
            ApplicationAssetV3PublishPlan plan,
            out JObject page)
        {
            page = null;
            var routePath = SafeJString(route, "RoutePath");
            var entryPath = route.Value<string>("EntryPath") ?? plan.EntryPath;
            JObject routeMeta;
            var routeMetaToken = route["RouteMetaJson"];
            try
            {
                if (routeMetaToken?.Type == JTokenType.String)
                    routeMeta = JObject.Parse(routeMetaToken.Value<string>() ?? "{}");
                else if (routeMetaToken is JObject routeMetaObject)
                    routeMeta = (JObject)routeMetaObject.DeepClone();
                else
                    routeMeta = route["Meta"] is JObject meta ? (JObject)meta.DeepClone() : new JObject();
            }
            catch (Exception ex) { return "RouteMetaJson 不合法：" + ex.Message; }
            routeMeta["_MicroiV3"] = new JObject
            {
                ["CommittedPublishVersionId"] = versionId,
                ["PublishFence"] = FormatApplicationAssetV3Int64(fence),
                ["RouteSnapshotHash"] = plan.RouteSnapshotHash
            };
            var routeMetaJson = CanonicalizeApplicationAssetV3JsonToken(routeMeta).ToString(Formatting.None);
            page = new JObject
            {
                ["MicroServiceId"] = serviceId,
                ["MicroServiceKey"] = plan.AppKey,
                ["PageKey"] = SafeJString(route, "PageKey"),
                ["PageName"] = SafeJString(route, "PageName", SafeJString(route, "PageTitle", SafeJString(route, "PageKey"))),
                ["PageTitle"] = SafeJString(route, "PageTitle", SafeJString(route, "PageName", SafeJString(route, "PageKey"))),
                ["RoutePath"] = routePath,
                ["EntryPath"] = entryPath,
                ["SourceDirName"] = SafeJString(route, "SourceDirName", plan.AppKey),
                ["MenuUrl"] = SafeJString(route, "MenuUrl", $"/micro-app/{plan.AppKey}{routePath}"),
                ["Sort"] = SafeJInt(route, "Sort", index),
                ["IsHome"] = SafeJInt(route, "IsHome", index == 0 ? 1 : 0),
                ["IsEnable"] = SafeJInt(route, "IsEnable", 1),
                ["BuildVersion"] = plan.VersionNo,
                ["RouteMetaJson"] = routeMetaJson
            };
            return null;
        }

        private static SqlSection BindApplicationAssetV3RoutePageParameters(
            SqlSection section,
            JObject page,
            DateTime now)
        {
            return section
                .AddInParameter("@id", SafeJString(page, "Id"))
                .AddInParameter("@serviceId", SafeJString(page, "MicroServiceId"))
                .AddInParameter("@serviceKey", SafeJString(page, "MicroServiceKey"))
                .AddInParameter("@pageKey", SafeJString(page, "PageKey"))
                .AddInParameter("@pageName", SafeJString(page, "PageName"))
                .AddInParameter("@pageTitle", SafeJString(page, "PageTitle"))
                .AddInParameter("@routePath", SafeJString(page, "RoutePath"))
                .AddInParameter("@entryPath", SafeJString(page, "EntryPath"))
                .AddInParameter("@sourceDir", SafeJString(page, "SourceDirName"))
                .AddInParameter("@menuUrl", SafeJString(page, "MenuUrl"))
                .AddInParameter("@sort", SafeJInt(page, "Sort"))
                .AddInParameter("@isHome", SafeJInt(page, "IsHome"))
                .AddInParameter("@isEnable", SafeJInt(page, "IsEnable", 1))
                .AddInParameter("@buildVersion", SafeJString(page, "BuildVersion"))
                .AddInParameter("@routeMeta", SafeJString(page, "RouteMetaJson"))
                .AddInParameter("@now", System.Data.DbType.DateTime, now);
        }

        private static bool IsApplicationAssetV3DesiredService(JObject actual, JObject desired)
        {
            foreach (var field in new[]
                     {
                         "Id", "MsKey", "MsName", "MsType", "Runtime", "StorageMode", "MsUrl", "EntryPath",
                         "DistHash", "Description", "BuildVersion", "AssetsJson", "AssetManifestJson"
                     })
            {
                if (!string.Equals(
                        SafeApplicationAssetV3DbString(actual, field),
                        SafeJString(desired, field),
                        StringComparison.Ordinal)) return false;
            }
            return SafeApplicationAssetV3DbInt(actual, "IsEnable") == 1
                   && SafeApplicationAssetV3DbInt(actual, "IsDeleted") == 0
                   && SafeApplicationAssetV3DbInt(actual, "AssetCount") == SafeJInt(desired, "AssetCount")
                   && SafeApplicationAssetV3DbLong(actual, "TotalSize", -1L)
                   == SafeApplicationAssetV3Long(desired, "TotalSize", -2L);
        }

        private static bool IsApplicationAssetV3DesiredRoutePage(JObject actual, JObject desired)
        {
            foreach (var field in new[]
                     {
                         "Id", "MicroServiceId", "MicroServiceKey", "PageKey", "PageName", "PageTitle",
                         "RoutePath", "EntryPath", "SourceDirName", "MenuUrl", "BuildVersion", "RouteMetaJson"
                     })
            {
                if (!string.Equals(
                        SafeApplicationAssetV3DbString(actual, field),
                        SafeJString(desired, field),
                        StringComparison.Ordinal)) return false;
            }
            return SafeApplicationAssetV3DbInt(actual, "Sort") == SafeJInt(desired, "Sort")
                   && SafeApplicationAssetV3DbInt(actual, "IsHome") == SafeJInt(desired, "IsHome")
                   && SafeApplicationAssetV3DbInt(actual, "IsEnable") == SafeJInt(desired, "IsEnable")
                   && SafeApplicationAssetV3DbInt(actual, "IsDeleted") == 0;
        }

        private static DosResult<object> MarkApplicationAssetV3ProjectionRepairRequired(
            string osClient,
            string appId,
            string versionId,
            ApplicationAssetV3ProtocolRequest request,
            ApplicationAssetV3PublishPlan plan,
            string error,
            bool idempotent)
        {
            var lastError = (error ?? "v3 projection 失败").Trim();
            if (lastError.Length > 2000) lastError = lastError.Substring(0, 2000);
            try
            {
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null) throw new InvalidOperationException("未找到租户主库连接");
                var dialect = ResolveApplicationAssetV3SqlDialect(osClient);
                string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
                using var trans = client.Db.BeginTransaction();
                var app = ReadApplicationAssetV3AppStrong(osClient, appId, trans, true);
                var versions = ReadApplicationAssetV3VersionRowsStrong(
                    osClient,
                    appId,
                    plan.VersionNo,
                    trans,
                    true);
                if (versions.Count != 1) throw new InvalidOperationException("repair 回读版本不唯一");
                var version = versions[0];
                var resolverError = ValidateApplicationAssetV3StableResolverTarget(osClient, app, version);
                if (resolverError != null) throw new InvalidOperationException(resolverError);
                if (!TryParseApplicationAssetV3PublishState(app, out var appState)
                    || !TryParseApplicationAssetV3PublishState(version, out var versionState))
                {
                    throw new InvalidOperationException("repair 状态不合法");
                }
                if (appState == ApplicationAssetV3PublishState.Completed
                    && versionState == ApplicationAssetV3PublishState.Completed)
                {
                    trans.Commit();
                    return BuildApplicationAssetV3PendingResult(app, version, request, plan, true);
                }
                var fence = SafeApplicationAssetV3Long(app, "PublishFence", -1L);
                var publishRowVersion = SafeApplicationAssetV3Long(app, "PublishRowVersion", -1L);
                var versionRowVersion = SafeApplicationAssetV3Long(version, "RowVersion", -1L);
                if (fence < 0 || publishRowVersion < 0 || versionRowVersion < 0 || versionRowVersion == long.MaxValue)
                    throw new InvalidOperationException("repair proof 不合法");

                if (appState != ApplicationAssetV3PublishState.Completed)
                {
                    var appRepairSql =
                        $"UPDATE {Q("sys_microistore")} SET {Q("PublishState")}=@repair,{Q("UpdateTime")}=@now " +
                        $"WHERE {Q("Id")}=@appId AND {Q("CommittedPublishVersionId")}=@versionId " +
                        $"AND {Q("CommittedRuntimeManifestHash")}=@runtimeHash AND {Q("PublishFence")}=@fence " +
                        $"AND {Q("PublishRowVersion")}=@rowVersion " +
                        $"AND {Q("PublishState")} IN (@pointer,@pending,@repair)";
                    if (trans.FromSql(appRepairSql)
                            .AddInParameter("@repair", ApplicationAssetV3PublishState.RepairRequired.ToString())
                            .AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                            .AddInParameter("@appId", appId)
                            .AddInParameter("@versionId", versionId)
                            .AddInParameter("@runtimeHash", plan.RuntimeManifestHash)
                            .AddInParameter("@fence", fence)
                            .AddInParameter("@rowVersion", publishRowVersion)
                            .AddInParameter("@pointer", ApplicationAssetV3PublishState.PointerCommitted.ToString())
                            .AddInParameter("@pending", ApplicationAssetV3PublishState.ProjectionPending.ToString())
                            .ExecuteNonQuery() != 1)
                    {
                        throw new InvalidOperationException("app RepairRequired CAS 失败");
                    }
                }

                if (versionState != ApplicationAssetV3PublishState.Completed)
                {
                    var versionRepairSql =
                        $"UPDATE {Q("mci_ai_app_version")} SET {Q("PublishState")}=@repair,{Q("Status")}=@repair," +
                        $"{Q("LastError")}=@error,{Q("RecoveryEpoch")}=COALESCE({Q("RecoveryEpoch")},0)+1," +
                        $"{Q("RowVersion")}=@nextRow,{Q("UpdateTime")}=@now " +
                        $"WHERE {Q("Id")}=@versionId AND {Q("RowVersion")}=@oldRow AND {Q("FencingToken")}=@fence " +
                        $"AND {Q("RuntimeManifestHash")}=@runtimeHash AND {Q("RequestId")}=@requestId " +
                        $"AND {Q("RequestFingerprint")}=@fingerprint " +
                        $"AND {Q("PublishState")} IN (@pointer,@pending,@repair)";
                    if (trans.FromSql(versionRepairSql)
                            .AddInParameter("@repair", ApplicationAssetV3PublishState.RepairRequired.ToString())
                            .AddInParameter("@error", lastError)
                            .AddInParameter("@nextRow", versionRowVersion + 1)
                            .AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                            .AddInParameter("@versionId", versionId)
                            .AddInParameter("@oldRow", versionRowVersion)
                            .AddInParameter("@fence", fence)
                            .AddInParameter("@runtimeHash", plan.RuntimeManifestHash)
                            .AddInParameter("@requestId", request.RequestId)
                            .AddInParameter("@fingerprint", request.RequestFingerprint)
                            .AddInParameter("@pointer", ApplicationAssetV3PublishState.PointerCommitted.ToString())
                            .AddInParameter("@pending", ApplicationAssetV3PublishState.ProjectionPending.ToString())
                            .ExecuteNonQuery() != 1)
                    {
                        throw new InvalidOperationException("version RepairRequired CAS 失败");
                    }
                    version["RowVersion"] = versionRowVersion + 1;
                    version["PublishState"] = ApplicationAssetV3PublishState.RepairRequired.ToString();
                    version["Status"] = ApplicationAssetV3PublishState.RepairRequired.ToString();
                    version["LastError"] = lastError;
                }
                if (appState != ApplicationAssetV3PublishState.Completed)
                    app["PublishState"] = ApplicationAssetV3PublishState.RepairRequired.ToString();
                trans.Commit();
                return BuildApplicationAssetV3PendingResult(
                    app,
                    version,
                    request,
                    plan,
                    idempotent);
            }
            catch (Exception markError)
            {
                return new DosResult<object>(0, new
                {
                    ProtocolVersion = 3,
                    PublishMode = "finalize",
                    RequestId = request.RequestId,
                    RequestFingerprint = request.RequestFingerprint,
                    DeliveryBatchId = request.DeliveryBatchId,
                    CommittedPublishVersionId = versionId,
                    CommittedRuntimeManifestHash = plan.RuntimeManifestHash,
                    PointerState = "Committed",
                    Pending = true,
                    Completed = false,
                    ProjectionPending = true,
                    RetryAfterMs = ApplicationAssetStreamV3RetryAfterMs
                }, "v3 pointer 已提交；projection 与 RepairRequired 标记均失败，必须同请求重放："
                   + lastError + "；" + markError.Message);
            }
        }

        private static string BuildApplicationAssetV3PublishPlan(
            string osClient,
            JObject app,
            JObject param,
            ApplicationAssetV3ProtocolRequest request,
            out ApplicationAssetV3PublishPlan plan)
        {
            plan = null;
            var appKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
            var applicationType = SafeJString(app, "ApplicationType", "Web").ToLowerInvariant();
            if (!new[] { "web", "uniapp", "microservice" }.Contains(applicationType, StringComparer.Ordinal))
                return "v3 仅支持 Web、UniApp 和 MicroService";
            var versionNo = NormalizeApplicationAssetVersion(
                SafeJString(param, "VersionNo", SafeJString(param, "BuildVersion")));
            var entryPath = SafeJString(param, "EntryPath", "index.html");
            var entryPathError = ValidateApplicationAssetV3RelativePath(entryPath);
            if (entryPathError != null) return entryPathError;
            entryPath = NormalizeApplicationAssetRelativePath(entryPath);
            var assetsJson = param["Assets"] as JArray ?? param["Manifest"] as JArray;
            if (assetsJson == null || assetsJson.Count == 0) return "Assets 发布清单不能为空";
            if (assetsJson.Count > MaxStreamPublishAssetCount) return "Assets 发布清单数量超限";

            var identity = new ApplicationAssetV3ReleaseIdentity
            {
                Tenant = TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant(),
                Kind = "runtime",
                AppKey = appKey,
                Version = versionNo,
                RequestFingerprint = request.RequestFingerprint
            };
            var identityError = ValidateApplicationAssetV3ReleaseIdentity(identity);
            if (identityError != null) return identityError;
            var assets = new List<StreamPublishAsset>();
            var unique = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            long totalSize = 0;
            foreach (var token in assetsJson)
            {
                if (!(token is JObject item)) return "Assets 包含非对象项";
                var relativePath = SafeJString(item, "Path", SafeJString(item, "RelativePath"));
                var pathError = ValidateApplicationAssetV3RelativePath(relativePath);
                if (pathError != null) return pathError;
                relativePath = NormalizeApplicationAssetRelativePath(relativePath);
                if (!unique.Add(relativePath)) return "Assets 路径重复：" + relativePath;
                var sha256 = SafeJString(item, "Sha256", SafeJString(item, "Hash"));
                if (!Regex.IsMatch(sha256, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                    return "Assets SHA-256 必须是小写十六进制：" + relativePath;
                if (!TryParseApplicationAssetV3NonNegativeInt64(
                        item["Size"],
                        "Assets.Size",
                        out var size,
                        out var sizeError))
                {
                    return sizeError + "：" + relativePath;
                }
                if (!TryAddApplicationAssetResumableLogicalSize(
                        totalSize,
                        size,
                        out var nextTotalSize))
                    return "Assets Size 不合法：" + relativePath;
                totalSize = nextTotalSize;
                assets.Add(new StreamPublishAsset
                {
                    RelativePath = relativePath,
                    Sha256 = sha256,
                    Size = size,
                    IsEntry = string.Equals(relativePath, entryPath, StringComparison.Ordinal),
                    Paths = BuildApplicationAssetV3Paths(identity, relativePath, sha256)
                });
            }
            if (!assets.Any(asset => asset.IsEntry)) return "Assets 缺少精确入口文件：" + entryPath;

            var canonicalManifest = new JArray(assets
                .OrderBy(asset => asset.RelativePath, StringComparer.Ordinal)
                .Select(asset => new JObject
                {
                    ["Path"] = asset.RelativePath,
                    ["Sha256"] = asset.Sha256,
                    ["Size"] = asset.Size,
                    ["IsEntry"] = asset.IsEntry
                }));
            var runtimeHash = ComputeMicroServiceManifestHash(canonicalManifest);
            if (!string.Equals(runtimeHash, request.RuntimeManifestHash, StringComparison.Ordinal))
                return "RuntimeManifestHash 与服务端 canonical manifest 不一致";
            var routeSnapshotError = ValidateApplicationAssetV3RouteSnapshotFacts(
                applicationType,
                request.RouteSnapshotJson,
                request.RouteSnapshotHash,
                entryPath,
                assets,
                out var routes);
            if (routeSnapshotError != null) return routeSnapshotError;
            var releasePrefix = BuildApplicationAssetV3ReleasePrefix(identity);
            plan = new ApplicationAssetV3PublishPlan
            {
                Identity = identity,
                Assets = assets,
                VersionNo = versionNo,
                EntryPath = entryPath,
                ReleasePrefix = releasePrefix,
                ReleaseEntryPath = BuildApplicationAssetV3ReleaseEntryPath(identity, entryPath),
                StableResolverPath = BuildApplicationAssetV3StableResolverPath(identity, entryPath),
                AssetManifestJson = canonicalManifest.ToString(Formatting.None),
                FileCount = assets.Count,
                TotalSize = totalSize,
                RuntimeManifestHash = runtimeHash,
                SourceManifestHash = request.SourceManifestHash,
                ApplicationType = applicationType,
                AppKey = appKey,
                RouteSnapshotJson = request.RouteSnapshotJson,
                RouteSnapshotHash = request.RouteSnapshotHash,
                Routes = routes
            };
            if (string.Equals(applicationType, "microservice", StringComparison.Ordinal))
            {
                var projectionLengthError = ValidateApplicationAssetV3MicroServiceProjectionLengths(
                    app,
                    plan.AppKey,
                    plan.VersionNo,
                    plan.EntryPath,
                    plan.StableResolverPath,
                    plan.Routes);
                if (projectionLengthError != null)
                {
                    plan = null;
                    return projectionLengthError + "；pointer 尚未提交";
                }
            }
            return null;
        }

        private static JObject BuildApplicationAssetV3BuildLog(
            ApplicationAssetV3ProtocolRequest request,
            ApplicationAssetV3PublishPlan plan)
        {
            return new JObject
            {
                ["ProtocolVersion"] = 3,
                ["ExpectedGateEpoch"] = FormatApplicationAssetV3Int64(
                    request.ExpectedGateEpoch),
                ["ExpectedPublishRowVersion"] = FormatApplicationAssetV3Int64(
                    request.ExpectedPublishRowVersion),
                // ExpectedVersionRowVersion is a phase-local CAS precondition:
                // stage uses null for a new row, while finalize uses the
                // ReleaseVerified row version returned by stage. It is therefore
                // deliberately excluded from the immutable release fingerprint.
                ["ExpectedPublishFence"] = FormatApplicationAssetV3Int64(
                    request.ExpectedPublishFence),
                ["ExpectedActivePublishVersionId"] = request.ExpectedActivePublishVersionId,
                ["ExpectedCommittedPublishVersionId"] = request.ExpectedCommittedPublishVersionId,
                ["RequestId"] = request.RequestId,
                ["RequestFingerprint"] = request.RequestFingerprint,
                ["DeliveryBatchId"] = request.DeliveryBatchId,
                ["SourceManifestHash"] = request.SourceManifestHash,
                ["RuntimeManifestHash"] = request.RuntimeManifestHash,
                ["RouteSnapshotJson"] = request.RouteSnapshotJson,
                ["RouteSnapshotHash"] = request.RouteSnapshotHash,
                ["ReleasePrefix"] = plan.ReleasePrefix,
                ["AssetManifestJson"] = plan.AssetManifestJson
            };
        }

        private static int InsertApplicationAssetV3Version(
            DbTrans trans,
            ApplicationAssetV3SqlDialect dialect,
            string versionId,
            JObject app,
            ApplicationAssetV3ProtocolRequest request,
            ApplicationAssetV3PublishPlan plan,
            string buildLog,
            long fencingToken,
            long rowVersion)
        {
            var columns = new[]
            {
                "Id", "AppId", "AppName", "VersionNo", "VersionName", "Status", "FileCount", "TotalSize",
                "BuildLog", "BuildTaskId", "PreviewUrl", "PublishPath", "PublishProtocolVersion", "PublishState",
                "RequestId", "DeliveryBatchId", "RequestFingerprint", "SourceManifestHash", "RuntimeManifestHash",
                "ExpectedCurrentVersion", "ExpectedAppVersion", "EntryPath", "ReleasePrefix", "AssetManifestJson",
                "RouteSnapshotJson", "RouteSnapshotHash",
                "FencingToken", "RowVersion", "PointerCommittedAt", "CompletedAt", "LastError", "RecoveryEpoch",
                "CreateTime", "UpdateTime"
            };
            var values = new[]
            {
                "@id", "@appId", "@appName", "@versionNo", "@versionNo", "@state", "@fileCount", "@totalSize",
                "@buildLog", "@batchId", "@preview", "@publishPath", "3", "@state", "@requestId", "@batchId",
                "@fingerprint", "@sourceHash", "@runtimeHash", "@expectedCurrent", "@expectedAppVersion",
                "@entryPath", "@releasePrefix", "@manifest", "@routeSnapshotJson", "@routeSnapshotHash",
                "@fence", "@rowVersion", "NULL", "NULL", "NULL",
                "0", "@now", "@now"
            };
            return trans.FromSql(BuildApplicationAssetV3InsertSql(
                    dialect,
                    "mci_ai_app_version",
                    columns,
                    values))
                .AddInParameter("@id", versionId)
                .AddInParameter("@appId", SafeJString(app, "Id"))
                .AddInParameter("@appName", SafeJString(app, "Name", SafeJString(app, "AppName")))
                .AddInParameter("@versionNo", plan.VersionNo)
                .AddInParameter("@state", ApplicationAssetV3PublishState.ReleaseVerified.ToString())
                .AddInParameter("@fileCount", plan.FileCount)
                .AddInParameter("@totalSize", plan.TotalSize)
                .AddInParameter("@buildLog", buildLog)
                .AddInParameter("@batchId", request.DeliveryBatchId)
                .AddInParameter("@preview", plan.StableResolverPath)
                .AddInParameter("@publishPath", plan.ReleaseEntryPath)
                .AddInParameter("@requestId", request.RequestId)
                .AddInParameter("@fingerprint", request.RequestFingerprint)
                .AddInParameter("@sourceHash", request.SourceManifestHash)
                .AddInParameter("@runtimeHash", request.RuntimeManifestHash)
                .AddInParameter("@expectedCurrent", request.ExpectedCurrentVersion)
                .AddInParameter("@expectedAppVersion", request.ExpectedAppVersion)
                .AddInParameter("@entryPath", plan.EntryPath)
                .AddInParameter("@releasePrefix", plan.ReleasePrefix)
                .AddInParameter("@manifest", plan.AssetManifestJson)
                .AddInParameter("@routeSnapshotJson", plan.RouteSnapshotJson)
                .AddInParameter("@routeSnapshotHash", plan.RouteSnapshotHash)
                .AddInParameter("@fence", fencingToken)
                .AddInParameter("@rowVersion", rowVersion)
                .AddInParameter("@now", System.Data.DbType.DateTime, DateTime.Now)
                .ExecuteNonQuery();
        }

        private static JObject BuildApplicationAssetV3VersionSnapshot(
            string versionId,
            string appId,
            ApplicationAssetV3ProtocolRequest request,
            ApplicationAssetV3PublishPlan plan,
            string buildLog,
            long fencingToken,
            long rowVersion,
            ApplicationAssetV3PublishState state)
        {
            return new JObject
            {
                ["Id"] = versionId,
                ["AppId"] = appId,
                ["VersionNo"] = plan.VersionNo,
                ["Status"] = state.ToString(),
                ["PublishProtocolVersion"] = 3,
                ["PublishState"] = state.ToString(),
                ["RequestId"] = request.RequestId,
                ["DeliveryBatchId"] = request.DeliveryBatchId,
                ["RequestFingerprint"] = request.RequestFingerprint,
                ["SourceManifestHash"] = request.SourceManifestHash,
                ["RuntimeManifestHash"] = request.RuntimeManifestHash,
                ["ExpectedCurrentVersion"] = request.ExpectedCurrentVersion,
                ["ExpectedAppVersion"] = request.ExpectedAppVersion,
                ["EntryPath"] = plan.EntryPath,
                ["ReleasePrefix"] = plan.ReleasePrefix,
                ["AssetManifestJson"] = plan.AssetManifestJson,
                ["RouteSnapshotJson"] = plan.RouteSnapshotJson,
                ["RouteSnapshotHash"] = plan.RouteSnapshotHash,
                ["BuildLog"] = buildLog,
                ["FencingToken"] = fencingToken,
                ["RowVersion"] = rowVersion,
                ["FileCount"] = plan.FileCount,
                ["TotalSize"] = plan.TotalSize
            };
        }

        private static string ValidateApplicationAssetV3VersionImmutableFacts(
            JObject version,
            string versionId,
            ApplicationAssetV3ProtocolRequest request,
            ApplicationAssetV3PublishPlan plan,
            string buildLog)
        {
            if (!string.Equals(SafeJString(version, "Id"), versionId, StringComparison.Ordinal))
                return "Id 不一致";
            if (SafeJInt(version, "PublishProtocolVersion") != 3) return "PublishProtocolVersion 不一致";
            if (!string.Equals(SafeJString(version, "VersionNo"), plan.VersionNo, StringComparison.Ordinal)) return "VersionNo 不一致";
            if (!string.Equals(SafeJString(version, "RequestId"), request.RequestId, StringComparison.Ordinal)) return "RequestId 不一致";
            if (!string.Equals(SafeJString(version, "DeliveryBatchId"), request.DeliveryBatchId, StringComparison.Ordinal)) return "DeliveryBatchId 不一致";
            if (!string.Equals(SafeJString(version, "RequestFingerprint"), request.RequestFingerprint, StringComparison.Ordinal)) return "RequestFingerprint 不一致";
            if (!string.Equals(SafeJString(version, "SourceManifestHash"), request.SourceManifestHash, StringComparison.Ordinal)) return "SourceManifestHash 不一致";
            if (!string.Equals(SafeJString(version, "RuntimeManifestHash"), request.RuntimeManifestHash, StringComparison.Ordinal)) return "RuntimeManifestHash 不一致";
            if (SafeJInt(version, "ExpectedCurrentVersion", -1) != request.ExpectedCurrentVersion) return "ExpectedCurrentVersion 不一致";
            if (!string.Equals(
                    ReadApplicationAssetV3NullableStringFact(version, "ExpectedAppVersion"),
                    request.ExpectedAppVersion,
                    StringComparison.Ordinal)) return "ExpectedAppVersion 不一致";
            if (!string.Equals(SafeJString(version, "EntryPath"), plan.EntryPath, StringComparison.Ordinal)) return "EntryPath 不一致";
            if (!string.Equals(SafeJString(version, "ReleasePrefix"), plan.ReleasePrefix, StringComparison.Ordinal)) return "ReleasePrefix 不一致";
            if (!string.Equals(SafeJString(version, "AssetManifestJson"), plan.AssetManifestJson, StringComparison.Ordinal)) return "AssetManifestJson 不一致";
            if (!string.Equals(SafeJString(version, "RouteSnapshotJson"), plan.RouteSnapshotJson, StringComparison.Ordinal)) return "RouteSnapshotJson 不一致";
            if (!string.Equals(SafeJString(version, "RouteSnapshotHash"), plan.RouteSnapshotHash, StringComparison.Ordinal)) return "RouteSnapshotHash 不一致";
            if (!string.Equals(SafeJString(version, "BuildLog"), buildLog, StringComparison.Ordinal)) return "BuildLog 门禁指纹不一致";
            if (SafeJInt(version, "FileCount", -1) != plan.FileCount) return "FileCount 不一致";
            if (SafeApplicationAssetV3Long(version, "TotalSize", -1L) != plan.TotalSize) return "TotalSize 不一致";
            return null;
        }

        private static DosResult<object> BuildApplicationAssetV3PendingResult(
            JObject app,
            JObject version,
            ApplicationAssetV3ProtocolRequest request,
            ApplicationAssetV3PublishPlan plan,
            bool idempotent)
        {
            if (!TryParseApplicationAssetV3PublishState(version, out var state))
                return new DosResult<object>(0, null, "v3 finalize 回执 PublishState 不合法");
            if (!TryParseApplicationAssetV3PublishState(app, out var appState))
                return new DosResult<object>(0, null, "v3 finalize 回执 AppPublishState 不合法");
            var completed = state == ApplicationAssetV3PublishState.Completed
                            && appState == ApplicationAssetV3PublishState.Completed;
            return new DosResult<object>(1, new
            {
                ProtocolVersion = 3,
                PublishMode = "finalize",
                GateEpoch = FormatApplicationAssetV3Int64(request.ExpectedGateEpoch),
                V3Only = true,
                AllowedModes = new[] { "stage", "finalize" },
                AppId = SafeJString(app, "Id"),
                AppKey = plan.AppKey,
                VersionId = SafeJString(version, "Id"),
                VersionNo = plan.VersionNo,
                CommittedPublishVersionId = SafeJString(app, "CommittedPublishVersionId"),
                CommittedRuntimeManifestHash = SafeJString(app, "CommittedRuntimeManifestHash"),
                RequestId = request.RequestId,
                RequestFingerprint = request.RequestFingerprint,
                DeliveryBatchId = request.DeliveryBatchId,
                PublishFence = FormatApplicationAssetV3Int64(
                    SafeApplicationAssetV3Long(app, "PublishFence", 0L)),
                PublishRowVersion = FormatApplicationAssetV3Int64(
                    SafeApplicationAssetV3Long(app, "PublishRowVersion", 0L)),
                VersionRowVersion = FormatApplicationAssetV3Int64(
                    SafeApplicationAssetV3Long(version, "RowVersion", 0L)),
                PublishState = state.ToString(),
                AppPublishState = appState.ToString(),
                PointerState = "Committed",
                Pending = !completed,
                Completed = completed,
                ProjectionPending = !completed,
                RetryAfterMs = completed ? 0 : ApplicationAssetStreamV3RetryAfterMs,
                ReleasePrefix = plan.ReleasePrefix,
                ReleaseEntryPath = plan.ReleaseEntryPath,
                StableResolverPath = plan.StableResolverPath,
                RuntimeManifestHash = plan.RuntimeManifestHash,
                SourceManifestHash = plan.SourceManifestHash,
                RouteSnapshotJson = plan.RouteSnapshotJson,
                RouteSnapshotHash = plan.RouteSnapshotHash,
                LastError = SafeJString(version, "LastError"),
                Idempotent = idempotent
            }, completed
                ? "v3 指针与投影均已完成"
                : "v3 指针已事务提交；投影待异步恢复，禁止回滚 committed pointer");
        }

        private static DosResult<object> BuildApplicationAssetV3StageResult(
            JObject app,
            JObject version,
            ApplicationAssetV3ProtocolRequest request,
            ApplicationAssetV3PublishPlan plan,
            bool idempotent)
        {
            if (!TryParseApplicationAssetV3PublishState(version, out var state))
                return new DosResult<object>(0, null, "v3 stage 回执 PublishState 不合法");
            var pointerCommitted = IsApplicationAssetV3PointerCommittedState(state);
            return new DosResult<object>(1, new
            {
                ProtocolVersion = 3,
                PublishMode = "stage",
                GateEpoch = FormatApplicationAssetV3Int64(request.ExpectedGateEpoch),
                V3Only = true,
                AllowedModes = new[] { "stage", "finalize" },
                AppId = SafeJString(app, "Id"),
                AppKey = plan.AppKey,
                VersionId = SafeJString(version, "Id"),
                VersionNo = plan.VersionNo,
                RequestId = request.RequestId,
                RequestFingerprint = request.RequestFingerprint,
                DeliveryBatchId = request.DeliveryBatchId,
                PublishFence = FormatApplicationAssetV3Int64(
                    SafeApplicationAssetV3Long(app, "PublishFence", 0L)),
                PublishRowVersion = FormatApplicationAssetV3Int64(
                    SafeApplicationAssetV3Long(app, "PublishRowVersion", 0L)),
                VersionRowVersion = FormatApplicationAssetV3Int64(
                    SafeApplicationAssetV3Long(version, "RowVersion", 0L)),
                RowVersion = FormatApplicationAssetV3Int64(
                    SafeApplicationAssetV3Long(version, "RowVersion", 0L)),
                FencingToken = FormatApplicationAssetV3Int64(
                    SafeApplicationAssetV3Long(version, "FencingToken", 0L)),
                PublishState = state.ToString(),
                PhaseState = ApplicationAssetV3PublishState.ReleaseVerified.ToString(),
                PointerState = pointerCommitted ? "Committed" : "Uncommitted",
                // Pending is phase-relative. A verified stage must not be
                // replayed forever merely because finalize/projection follows.
                Pending = false,
                Completed = false,
                ProjectionPending = state == ApplicationAssetV3PublishState.ProjectionPending
                                    || state == ApplicationAssetV3PublishState.RepairRequired,
                RetryAfterMs = 0,
                ReleasePrefix = plan.ReleasePrefix,
                ReleaseEntryPath = plan.ReleaseEntryPath,
                StableResolverPath = plan.StableResolverPath,
                RuntimeManifestHash = plan.RuntimeManifestHash,
                SourceManifestHash = plan.SourceManifestHash,
                RouteSnapshotJson = plan.RouteSnapshotJson,
                RouteSnapshotHash = plan.RouteSnapshotHash,
                Idempotent = idempotent
            }, idempotent
                ? "v3 stage 已精确幂等回读，当前 phase 无需重放"
                : "v3 immutable release 已完整校验并持久化为 ReleaseVerified");
        }

        private static string ParseApplicationAssetV3ProtocolRequest(
            JObject param,
            out ApplicationAssetV3ProtocolRequest request)
        {
            request = null;
            if (param == null) return "v3 请求不能为空";
            var protocol = ReadRequiredApplicationAssetV3Long(param, "ProtocolVersion", out var protocolError);
            if (protocolError != null || protocol != 3) return protocolError ?? "ProtocolVersion 必须为 3";
            var publishModeProperty = param.Property("PublishMode");
            if (publishModeProperty == null || publishModeProperty.Value.Type != JTokenType.String)
                return "ProtocolVersion=3 必须显式提供 PublishMode=stage 或 finalize";
            var publishMode = publishModeProperty.Value.Value<string>() ?? string.Empty;
            if (!string.Equals(publishMode, "stage", StringComparison.Ordinal)
                && !string.Equals(publishMode, "finalize", StringComparison.Ordinal))
            {
                return "ProtocolVersion=3 的 PublishMode 只允许显式 stage 或 finalize";
            }
            var gateEpoch = ReadRequiredApplicationAssetV3Long(param, "ExpectedGateEpoch", out var gateError);
            if (gateError != null) return gateError;
            var publishRowVersion = ReadRequiredApplicationAssetV3Long(param, "ExpectedPublishRowVersion", out var publishRowError);
            if (publishRowError != null) return publishRowError;
            var publishFence = ReadRequiredApplicationAssetV3Long(param, "ExpectedPublishFence", out var fenceError);
            if (fenceError != null) return fenceError;
            var expectedVersionRowError = ReadRequiredNullableApplicationAssetV3Long(
                param,
                "ExpectedVersionRowVersion",
                out var expectedVersionRowVersion);
            if (expectedVersionRowError != null) return expectedVersionRowError;
            var expectedActiveError = ReadRequiredNullableApplicationAssetV3String(
                param,
                "ExpectedActivePublishVersionId",
                out var expectedActive);
            if (expectedActiveError != null) return expectedActiveError;
            var expectedCommittedError = ReadRequiredNullableApplicationAssetV3String(
                param,
                "ExpectedCommittedPublishVersionId",
                out var expectedCommitted);
            if (expectedCommittedError != null) return expectedCommittedError;
            var expectedStateError = ParseApplicationStreamExpectedState(
                param,
                out var expectedCurrentVersion,
                out var expectedAppVersionSupplied,
                out _);
            if (expectedStateError != null) return expectedStateError;
            if (!expectedCurrentVersion.HasValue || !expectedAppVersionSupplied)
                return "v3 必须提供 ExpectedCurrentVersion 与 ExpectedAppVersion";
            var expectedAppVersionError = ReadRequiredNullableApplicationAssetV3String(
                param,
                "ExpectedAppVersion",
                out var expectedAppVersion);
            if (expectedAppVersionError != null) return expectedAppVersionError;

            string requestId;
            string deliveryBatchId;
            try
            {
                requestId = NormalizeApplicationAssetRequestId(SafeJString(param, "RequestId"));
                deliveryBatchId = NormalizeApplicationAssetDeliveryBatchId(
                    SafeJString(param, "DeliveryBatchId"));
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
            var fingerprint = SafeJString(param, "RequestFingerprint");
            if (!Regex.IsMatch(fingerprint, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                return "RequestFingerprint 必须是64位小写十六进制 SHA-256";
            var sourceHash = SafeJString(param, "SourceManifestHash");
            var runtimeHash = SafeJString(param, "RuntimeManifestHash");
            if (!Regex.IsMatch(sourceHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                return "SourceManifestHash 必须是64位小写十六进制 SHA-256";
            if (!Regex.IsMatch(runtimeHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                return "RuntimeManifestHash 必须是64位小写十六进制 SHA-256";
            var routeSnapshotProperty = param.Property("RouteSnapshotJson");
            if (routeSnapshotProperty?.Value.Type != JTokenType.String)
                return "ProtocolVersion=3 必须显式提供字符串 RouteSnapshotJson";
            var routeSnapshotHashProperty = param.Property("RouteSnapshotHash");
            if (routeSnapshotHashProperty?.Value.Type != JTokenType.String)
                return "ProtocolVersion=3 必须显式提供字符串 RouteSnapshotHash";
            string routeSnapshotJson;
            try
            {
                routeSnapshotJson = CanonicalizeApplicationAssetV3RouteSnapshot(
                    routeSnapshotProperty.Value.Value<string>());
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
            var routeSnapshotHash = routeSnapshotHashProperty.Value.Value<string>() ?? string.Empty;
            if (!Regex.IsMatch(routeSnapshotHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                return "RouteSnapshotHash 必须是64位小写十六进制 SHA-256";
            if (!string.Equals(
                    Sha256Hex(routeSnapshotJson),
                    routeSnapshotHash,
                    StringComparison.Ordinal))
            {
                return "RouteSnapshotHash 与服务端 canonical RouteSnapshotJson 不一致";
            }

            request = new ApplicationAssetV3ProtocolRequest
            {
                ProtocolVersion = 3,
                PublishMode = publishMode,
                ExpectedGateEpoch = gateEpoch,
                ExpectedPublishRowVersion = publishRowVersion,
                ExpectedVersionRowVersion = expectedVersionRowVersion,
                ExpectedPublishFence = publishFence,
                ExpectedActivePublishVersionId = expectedActive,
                ExpectedCommittedPublishVersionId = expectedCommitted,
                ExpectedCurrentVersion = expectedCurrentVersion.Value,
                ExpectedAppVersion = expectedAppVersion,
                RequestId = requestId,
                RequestFingerprint = fingerprint,
                DeliveryBatchId = deliveryBatchId,
                SourceManifestHash = sourceHash,
                RuntimeManifestHash = runtimeHash,
                RouteSnapshotJson = routeSnapshotJson,
                RouteSnapshotHash = routeSnapshotHash
            };
            return null;
        }

        private static long ReadRequiredApplicationAssetV3Long(
            JObject param,
            string name,
            out string error)
        {
            error = null;
            var property = param.Property(name);
            if (property == null)
            {
                error = name + " 必须显式提供规范非负 Int64";
                return 0L;
            }
            if (!TryParseApplicationAssetV3NonNegativeInt64(
                    property.Value,
                    name,
                    out var value,
                    out error))
            {
                return 0L;
            }
            return value;
        }

        private static string ReadRequiredNullableApplicationAssetV3Long(
            JObject param,
            string name,
            out long? value)
        {
            value = null;
            var property = param.Property(name);
            if (property == null) return name + " 必须显式提供，允许 null";
            if (property.Value.Type == JTokenType.Null || property.Value.Type == JTokenType.Undefined)
                return null;
            if (!TryParseApplicationAssetV3NonNegativeInt64(
                    property.Value,
                    name,
                    out var parsed,
                    out var error))
            {
                return error + "，或显式传 null";
            }
            value = parsed;
            return null;
        }

        private static bool TryParseApplicationAssetV3NonNegativeInt64(
            JToken token,
            string name,
            out long value,
            out string error)
        {
            value = 0L;
            error = null;
            if (token == null)
            {
                error = name + " 必须是规范非负 Int64 十进制字符串";
                return false;
            }

            if (token.Type == JTokenType.Integer)
            {
                try { value = token.Value<long>(); }
                catch
                {
                    error = name + " 超出 Int64 范围";
                    return false;
                }
                if (value < 0)
                {
                    error = name + " 不能为负数";
                    return false;
                }
                if (value > ApplicationAssetStreamV3JavaScriptMaxSafeInteger)
                {
                    error = name + " 超过 JavaScript 安全整数范围时必须使用规范十进制字符串";
                    return false;
                }
                return true;
            }

            if (token.Type != JTokenType.String)
            {
                error = name + " 必须是非负整数或规范十进制字符串";
                return false;
            }
            var text = token.Value<string>() ?? string.Empty;
            if (!Regex.IsMatch(text, "^(0|[1-9][0-9]*)$", RegexOptions.CultureInvariant))
            {
                error = name + " 必须是无符号、无空白、无小数且无多余前导零的十进制字符串";
                return false;
            }
            if (!long.TryParse(
                    text,
                    NumberStyles.None,
                    CultureInfo.InvariantCulture,
                    out value))
            {
                error = name + " 超出 Int64 范围";
                return false;
            }
            return true;
        }

        private static string FormatApplicationAssetV3Int64(long value)
        {
            if (value < 0) throw new ArgumentOutOfRangeException(nameof(value));
            return value.ToString(CultureInfo.InvariantCulture);
        }

        private static string ReadRequiredNullableApplicationAssetV3String(
            JObject param,
            string name,
            out string value)
        {
            value = null;
            var property = param.Property(name);
            if (property == null) return name + " 必须显式提供，允许 null";
            if (property.Value.Type == JTokenType.Null || property.Value.Type == JTokenType.Undefined)
                return null;
            if (property.Value.Type != JTokenType.String) return name + " 必须是字符串或 null";
            value = property.Value.Value<string>();
            if (string.IsNullOrWhiteSpace(value))
                return name + " 必须是非空字符串或 null；空基线请显式传 null";
            return value.Length <= 64 ? null : name + " 长度超限";
        }

        private static ApplicationAssetStreamGateSnapshot ReadApplicationAssetStreamGateStrong(
            string osClient,
            string osClientType,
            string osClientNetwork,
            DbTrans trans,
            bool forUpdate)
        {
            var client = OsClientExtend.GetClient(osClient);
            if (client?.Db == null) throw new InvalidOperationException("未找到租户主库连接：" + osClient);
            var dialect = ResolveApplicationAssetV3SqlDialect(osClient);
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
            var columns = string.Join(",", new[]
            {
                "OsClient", "OsClientType", "OsClientNetwork", "ApplicationStreamPublishMode",
                "ApplicationStreamMinProtocol", "ApplicationStreamGateEpoch"
            }.Select(Q));
            var where = $"{Q("OsClient")}=@os AND {Q("OsClientType")}=@type " +
                        $"AND {Q("OsClientNetwork")}=@network " +
                        $"AND ({Q("IsDeleted")} IS NULL OR {Q("IsDeleted")}=0)";
            var sql = BuildApplicationAssetV3LimitedSelectSql(
                dialect,
                "sys_osclients",
                columns,
                where,
                2,
                forUpdate);
            var section = trans == null ? client.Db.FromSql(sql) : trans.FromSql(sql);
            var rows = section
                .AddInParameter("@os", osClient)
                .AddInParameter("@type", osClientType)
                .AddInParameter("@network", osClientNetwork)
                .ToList<dynamic>() ?? new List<dynamic>();
            if (rows.Count != 1)
                throw new InvalidOperationException($"sys_osclients 门禁行数量必须为1，Actual={rows.Count}");
            var row = rows[0] as JObject ?? JObject.FromObject((object)rows[0]);
            var actualOsClient = SafeApplicationAssetV3DbString(row, "OsClient");
            var actualType = SafeApplicationAssetV3DbString(row, "OsClientType");
            var actualNetwork = SafeApplicationAssetV3DbString(row, "OsClientNetwork");
            if (!string.Equals(actualOsClient, osClient, StringComparison.Ordinal)
                || !string.Equals(actualType, osClientType, StringComparison.Ordinal)
                || !string.Equals(actualNetwork, osClientNetwork, StringComparison.Ordinal))
            {
                throw new InvalidOperationException("sys_osclients 门禁坐标 ordinal 精确回读失败");
            }
            return new ApplicationAssetStreamGateSnapshot
            {
                OsClient = actualOsClient,
                OsClientType = actualType,
                OsClientNetwork = actualNetwork,
                ApplicationStreamPublishMode = SafeApplicationAssetV3DbString(row, "ApplicationStreamPublishMode"),
                ApplicationStreamMinProtocol = SafeApplicationAssetV3DbInt(row, "ApplicationStreamMinProtocol", -1),
                ApplicationStreamGateEpoch = SafeApplicationAssetV3DbLong(row, "ApplicationStreamGateEpoch", -1L)
            };
        }

        private static (string OsClientType, string OsClientNetwork) ResolveApplicationAssetStreamGateCoordinate(
            string osClient)
        {
            var osClientType = Environment.GetEnvironmentVariable(
                                   "OsClientType",
                                   EnvironmentVariableTarget.Process)
                               ?? ConfigHelper.GetAppSettings("OsClientType")
                               ?? "Product";
            var osClientNetwork = Environment.GetEnvironmentVariable(
                                      "OsClientNetwork",
                                      EnvironmentVariableTarget.Process)
                                  ?? ConfigHelper.GetAppSettings("OsClientNetwork")
                                  ?? "Internal";
            return (osClientType, osClientNetwork);
        }

        private static JObject ReadApplicationAssetV3AppStrong(
            string osClient,
            string appIdOrKey,
            DbTrans trans,
            bool forUpdate)
        {
            var client = OsClientExtend.GetClient(osClient);
            if (client?.Db == null) throw new InvalidOperationException("未找到租户主库连接：" + osClient);
            var dialect = ResolveApplicationAssetV3SqlDialect(osClient);
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
            var where = $"({Q("Id")}=@key OR {Q("AppKey")}=@key OR {Q("AppId")}=@key) " +
                        $"AND ({Q("IsDeleted")} IS NULL OR {Q("IsDeleted")}=0)";
            var sql = BuildApplicationAssetV3LimitedSelectSql(
                dialect,
                "sys_microistore",
                "*",
                where,
                2,
                forUpdate);
            var section = trans == null ? client.Db.FromSql(sql) : trans.FromSql(sql);
            var rows = section.AddInParameter("@key", appIdOrKey).ToList<dynamic>() ?? new List<dynamic>();
            if (rows.Count == 0) return null;
            if (rows.Count != 1) throw new InvalidOperationException("应用身份命中多行，已 fail closed");
            return rows[0] as JObject ?? JObject.FromObject((object)rows[0]);
        }

        private static List<JObject> ReadApplicationAssetV3VersionRowsStrong(
            string osClient,
            string appId,
            string versionNo,
            DbTrans trans,
            bool forUpdate)
        {
            var client = OsClientExtend.GetClient(osClient);
            if (client?.Db == null) throw new InvalidOperationException("未找到租户主库连接：" + osClient);
            var dialect = ResolveApplicationAssetV3SqlDialect(osClient);
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
            var where = $"{Q("AppId")}=@appId AND {Q("VersionNo")}=@versionNo " +
                        $"AND ({Q("IsDeleted")} IS NULL OR {Q("IsDeleted")}=0)";
            var sql = BuildApplicationAssetV3LimitedSelectSql(
                dialect,
                "mci_ai_app_version",
                "*",
                where,
                3,
                forUpdate);
            var section = trans == null ? client.Db.FromSql(sql) : trans.FromSql(sql);
            return (section
                    .AddInParameter("@appId", appId)
                    .AddInParameter("@versionNo", versionNo)
                    .ToList<dynamic>() ?? new List<dynamic>())
                .Select(row => row as JObject ?? JObject.FromObject((object)row))
                .ToList();
        }

        private static string ValidateApplicationAssetV3AppExpectedState(
            JObject app,
            ApplicationAssetV3ProtocolRequest request)
        {
            if (app == null) return "应用不存在";
            if (SafeApplicationAssetV3Long(app, "PublishFence", 0L) != request.ExpectedPublishFence)
                return "ExpectedPublishFence 与 sys_microistore.PublishFence 不一致";
            if (SafeApplicationAssetV3Long(app, "PublishRowVersion", 0L) != request.ExpectedPublishRowVersion)
                return "ExpectedPublishRowVersion 与 sys_microistore.PublishRowVersion 不一致";
            var pointerBaselineError = ValidateApplicationAssetV3ExpectedPointerBaselines(
                app,
                request.ExpectedActivePublishVersionId,
                request.ExpectedCommittedPublishVersionId);
            if (pointerBaselineError != null) return pointerBaselineError;
            if (SafeJInt(app, "CurrentVersion") != request.ExpectedCurrentVersion)
                return "ExpectedCurrentVersion 不一致";
            if (!string.Equals(
                    ReadApplicationAssetV3NullableStringFact(app, "AppVersion"),
                    request.ExpectedAppVersion,
                    StringComparison.Ordinal))
                return "ExpectedAppVersion 不一致";
            return null;
        }

        private static string ValidateApplicationAssetV3ExpectedVersionRow(
            List<JObject> rows,
            ApplicationAssetV3ProtocolRequest request,
            string appId,
            string versionNo,
            bool requireImmutableIdentity)
        {
            rows = rows ?? new List<JObject>();
            if (rows.Count > 1) return "同一 AppId+VersionNo 存在重复版本";
            if (rows.Count == 0)
                return request.ExpectedVersionRowVersion.HasValue
                    ? "ExpectedVersionRowVersion 指向不存在的新版本"
                    : null;
            var row = rows[0];
            if (!request.ExpectedVersionRowVersion.HasValue)
                return "版本已存在，ExpectedVersionRowVersion 不能为 null";
            if (SafeApplicationAssetV3Long(row, "RowVersion", -1L) != request.ExpectedVersionRowVersion.Value)
                return "ExpectedVersionRowVersion 与 mci_ai_app_version.RowVersion 不一致";
            if (requireImmutableIdentity
                && (!string.Equals(SafeJString(row, "AppId"), appId, StringComparison.Ordinal)
                    || !string.Equals(SafeJString(row, "VersionNo"), versionNo, StringComparison.Ordinal)
                    || !string.Equals(SafeJString(row, "RequestId"), request.RequestId, StringComparison.Ordinal)
                    || !string.Equals(SafeJString(row, "RequestFingerprint"), request.RequestFingerprint, StringComparison.Ordinal)))
            {
                return "既有版本 RequestId/RequestFingerprint 冲突";
            }
            return null;
        }

        private static ApplicationAssetPaths BuildApplicationAssetV3Paths(
            ApplicationAssetV3ReleaseIdentity identity,
            string relativePath,
            string sha256)
        {
            var releasePath = BuildApplicationAssetV3ReleaseEntryPath(identity, relativePath);
            var pathHash = Sha256Hex(relativePath).Substring(0, 24);
            return new ApplicationAssetPaths
            {
                VersionPath = releasePath,
                RootPath = null,
                LatestPath = null,
                IntegrityMarkerPath = BuildApplicationAssetV3ReleasePrefix(identity)
                                      + "/.microi-integrity/"
                                      + pathHash
                                      + "-"
                                      + sha256
                                      + ".ok"
            };
        }

        private static byte[] BuildApplicationAssetV3IntegrityMarker(
            ApplicationAssetV3ReleaseIdentity identity,
            string relativePath,
            string sha256,
            long size,
            string requestId)
        {
            return Encoding.UTF8.GetBytes(new JObject
            {
                ["ProtocolVersion"] = 3,
                ["Tenant"] = identity.Tenant,
                ["Kind"] = identity.Kind,
                ["AppKey"] = identity.AppKey,
                ["VersionNo"] = identity.Version,
                ["RequestId"] = requestId,
                ["RequestFingerprint"] = identity.RequestFingerprint,
                ["RelativePath"] = relativePath,
                ["Sha256"] = sha256,
                ["Size"] = size
            }.ToString(Formatting.None));
        }

        private static string ValidateApplicationAssetV3IntegrityMarker(
            byte[] markerBytes,
            ApplicationAssetV3ReleaseIdentity identity,
            string relativePath,
            string sha256,
            long size,
            string requestId)
        {
            if (markerBytes == null || markerBytes.Length == 0) return "v3 完整性 marker 为空";
            JObject marker;
            try { marker = JObject.Parse(Encoding.UTF8.GetString(markerBytes)); }
            catch { return "v3 完整性 marker 不是有效 JSON"; }
            if (SafeJInt(marker, "ProtocolVersion") != 3) return "v3 marker ProtocolVersion 不一致";
            if (!string.Equals(SafeJString(marker, "Tenant"), identity.Tenant, StringComparison.Ordinal)
                || !string.Equals(SafeJString(marker, "Kind"), identity.Kind, StringComparison.Ordinal)
                || !string.Equals(SafeJString(marker, "AppKey"), identity.AppKey, StringComparison.Ordinal)
                || !string.Equals(SafeJString(marker, "VersionNo"), identity.Version, StringComparison.Ordinal)
                || !string.Equals(SafeJString(marker, "RequestId"), requestId, StringComparison.Ordinal)
                || !string.Equals(SafeJString(marker, "RequestFingerprint"), identity.RequestFingerprint, StringComparison.Ordinal)
                || !string.Equals(SafeJString(marker, "RelativePath"), relativePath, StringComparison.Ordinal)
                || !string.Equals(SafeJString(marker, "Sha256"), sha256, StringComparison.Ordinal)
                || SafeApplicationAssetV3Long(marker, "Size", -1L) != size)
            {
                return "v3 完整性 marker 不可变事实冲突";
            }
            return null;
        }

        private static bool TryParseApplicationAssetV3PublishState(
            JObject row,
            out ApplicationAssetV3PublishState state)
        {
            state = ApplicationAssetV3PublishState.LegacyUnverified;
            var value = SafeJString(row, "PublishState", SafeJString(row, "Status"));
            return Enum.TryParse(value, false, out state)
                   && Enum.IsDefined(typeof(ApplicationAssetV3PublishState), state);
        }

        private static long SafeApplicationAssetV3Long(
            JObject row,
            string name,
            long fallback)
        {
            var token = row?[name];
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                return fallback;
            try { return token.Value<long>(); }
            catch
            {
                return long.TryParse(
                    token.ToString(),
                    NumberStyles.Integer,
                    CultureInfo.InvariantCulture,
                    out var value) ? value : fallback;
            }
        }

        private static JToken GetApplicationAssetV3DbToken(JObject row, string name)
        {
            return row?.GetValue(name, StringComparison.OrdinalIgnoreCase);
        }

        private static string SafeApplicationAssetV3DbString(
            JObject row,
            string name,
            string fallback = "")
        {
            var token = GetApplicationAssetV3DbToken(row, name);
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                return fallback;
            var value = token.ToString();
            return string.IsNullOrWhiteSpace(value) ? fallback : value;
        }

        private static int SafeApplicationAssetV3DbInt(
            JObject row,
            string name,
            int fallback = 0)
        {
            return int.TryParse(
                SafeApplicationAssetV3DbString(row, name),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var value) ? value : fallback;
        }

        private static long SafeApplicationAssetV3DbLong(
            JObject row,
            string name,
            long fallback)
        {
            return long.TryParse(
                SafeApplicationAssetV3DbString(row, name),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var value) ? value : fallback;
        }
    }
}
