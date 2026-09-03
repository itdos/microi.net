using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json.Linq;

using Dos.ORM;

namespace Microi.net
{
    public class OsClientExtend
    {
        private static readonly IReadOnlyDictionary<string, string[]> RuntimeConfigurationFields =
            new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
            {
                ["SaaS:ExtensionDatabaseCacheSeconds"] = new[] { "ExtensionDatabaseCacheSeconds" },
                ["BackgroundTasks:MaxParallelTasks"] = new[] { "BackgroundTaskMaxParallel" },
                ["DiyLang:RuntimeCachePageSize"] = new[] { "DiyLangRuntimeCachePageSize" },
                ["DiyLang:RuntimeCacheMaxRows"] = new[] { "DiyLangRuntimeCacheMaxRows" },
                ["DiyLang:RuntimeCacheMaxCharacters"] = new[] { "DiyLangCacheMaxChars", "DiyLangRuntimeCacheMaxCharacters" },
                ["DiyLang:RuntimeCacheCommandTimeoutSeconds"] = new[] { "DiyLangCacheSqlTimeoutSec", "DiyLangRuntimeCacheCommandTimeoutSeconds" },
                ["Cors:AllowOrigins"] = new[] { "CorsAllowOrigins" },
                ["Cors:AllowAnyWhenUnconfigured"] = new[] { "CorsAllowAnyWhenUnconfigured" },
                ["SsrfProtection:Enabled"] = new[] { "SsrfProtectionEnabled" },
                ["SsrfProtection:AllowedHosts"] = new[] { "SsrfAllowedHosts" },
                ["StartupLimits:DynamicRouteInitMaxConcurrency"] = new[] { "StartupRouteMaxConcurrency", "StartupDynamicRouteMaxConcurrency" },
                ["SecurityGuard:Enabled"] = new[] { "SecurityGuardEnabled" },
                ["SecurityGuard:WindowSeconds"] = new[] { "SecurityWindowSeconds" },
                ["SecurityGuard:PerIpMaxRequests"] = new[] { "SecurityPerIpMaxRequests" },
                ["SecurityGuard:PerIpMaxErrors"] = new[] { "SecurityPerIpMaxErrors" },
                ["SecurityGuard:TrustedVsCodePerIpMaxRequests"] = new[] { "SecurityTrustedVsCodePerIpMaxRequests" },
                ["SecurityGuard:TrustedVsCodePerIpMaxErrors"] = new[] { "SecurityTrustedVsCodePerIpMaxErrors" },
                ["SecurityGuard:BlockMinutes"] = new[] { "SecurityBlockMinutes" },
                ["SecurityGuard:RecentAccessMaxCount"] = new[] { "SecurityRecentAccessMaxCount" },
                ["SecurityGuard:LogIntervalSeconds"] = new[] { "SecurityLogIntervalSeconds" },
                ["SecurityGuard:AccessPersistIntervalSeconds"] = new[] { "SecurityAccessPersistSec", "SecurityAccessPersistIntervalSeconds" },
                ["SecurityGuard:RespectForwardedHeaders"] = new[] { "SecurityTrustForwardedHeaders", "SecurityRespectForwardedHeaders" },
                ["SecurityGuard:LogBlockedToSysLog"] = new[] { "SecurityLogBlockedToSysLog" },
                ["SecurityGuard:PersistSecurityTables"] = new[] { "SecurityPersistTables" },
                ["SecurityGuard:PersistAllAccess"] = new[] { "SecurityPersistAllAccess" },
                ["SecurityGuard:PersistQueueMaxCount"] = new[] { "SecurityPersistQueueMaxCount" },
                ["SecurityGuard:WhitelistIps"] = new[] { "SecurityWhitelistIps" },
                ["PressureGuard:Enabled"] = new[] { "PressureGuardEnabled" },
                ["PressureGuard:GlobalMaxConcurrentRequests"] = new[] { "PressGlobalMax", "PressureGlobalMaxConcurrentRequests" },
                ["PressureGuard:TenantMaxConcurrentRequests"] = new[] { "PressTenantMax", "PressureTenantMaxConcurrentRequests" },
                ["PressureGuard:RouteMaxConcurrentRequests"] = new[] { "PressRouteMax", "PressureRouteMaxConcurrentRequests" },
                ["PressureGuard:ApiEngineMaxConcurrentRequests"] = new[] { "PressApiMax", "PressureApiEngineMaxConcurrentRequests" },
                ["PressureGuard:V8GlobalMaxConcurrentRequests"] = new[] { "PressV8GlobalMax", "PressureV8GlobalMaxConcurrentRequests" },
                ["PressureGuard:V8TenantMaxConcurrentRequests"] = new[] { "PressV8ReqMax", "PressureV8TenantMaxConcurrentRequests" },
                ["PressureGuard:WaitMilliseconds"] = new[] { "PressureWaitMilliseconds" },
                ["PressureGuard:LongRunningWaitMilliseconds"] = new[] { "PressLongWaitMs", "PressureLongRunningWaitMilliseconds" },
                ["PressureGuard:RetryAfterSeconds"] = new[] { "PressRetryAfter", "PressureRetryAfterSeconds" },
                ["OrmLimits:MaxConcurrentConnectionOpens"] = new[] { "OrmMaxConnectionOpens", "OrmMaxConcurrentConnectionOpens" },
                ["OrmLimits:ConnectionOpenWaitSeconds"] = new[] { "OrmConnectionOpenWaitSeconds" },
                ["OrmLimits:ConnectionPressureBackoffSeconds"] = new[] { "OrmConnPressureBackoffSec", "OrmConnectionPressureBackoffSeconds" },
                ["OrmLimits:DefaultCommandTimeoutSeconds"] = new[] { "OrmCommandTimeoutSec", "OrmDefaultCommandTimeoutSeconds" },
                ["OrmLimits:MySqlHostCacheAutoRepairEnabled"] = new[] { "OrmMySqlHostCacheRepairOn", "OrmMySqlHostCacheAutoRepairEnabled" },
                ["OrmLimits:MySqlHostCacheRepairCooldownSeconds"] = new[] { "OrmMySqlHostCacheCooldownSec", "OrmMySqlHostCacheRepairCooldownSeconds" },
                ["OrmLimits:DdlLockWaitSeconds"] = new[] { "OrmDdlLockWaitSeconds" },
                ["OrmLimits:DdlQueueWaitSeconds"] = new[] { "OrmDdlQueueWaitSeconds" },
                ["Spider:MaxSessionsTotal"] = new[] { "SpiderMaxSessionsTotal" },
                ["Spider:MaxSessionsPerScope"] = new[] { "SpiderMaxSessionsPerScope" },
                ["Spider:SessionIdleMinutes"] = new[] { "SpiderSessionIdleMinutes" },
                ["Spider:SessionMaxHours"] = new[] { "SpiderSessionMaxHours" },
                ["Spider:TraceEnabled"] = new[] { "SpiderTraceEnabled" },
                ["MicroiUpgrade:Disabled"] = new[] { "BackendAutoUpgradeDisabled" },
                ["Cad:FreeCadExecutablePath"] = new[] { "BackendFreeCadExecutablePath" },
                ["ForwardedHeaders:KnownProxies"] = new[] { "BackendForwardedKnownProxies" },
                ["ForwardedHeaders:KnownNetworks"] = new[] { "BackendForwardedKnownNetworks" },
                ["Security:LoginRsaPrivateKey"] = new[] { "BackendLoginRsaPrivateKey" },
                ["Security:LoginRsaPublicKey"] = new[] { "BackendLoginRsaPublicKey" }
            };

        static OsClientExtend()
        {
            ConfigHelper.SetRuntimeConfigurationReader(ReadMainTenantRuntimeConfiguration);
        }

        private static string ReadMainTenantRuntimeConfiguration(string configPath)
        {
            if (configPath.DosIsNullOrWhiteSpace()) return null;
            var mainTenant = GetConfigOsClient();
            if (mainTenant.DosIsNullOrWhiteSpace()) mainTenant = OsClientDefault.OsClient;
            if (mainTenant.DosIsNullOrWhiteSpace()) return null;
            if (!ClientList.TryGetValue(mainTenant, out var client)
                || client?.OsClientModel == null)
            {
                return null;
            }

            if (!RuntimeConfigurationFields.TryGetValue(configPath, out var fields))
            {
                var separatorIndex = configPath.LastIndexOf(':');
                fields = new[]
                {
                    separatorIndex >= 0
                        ? configPath.Substring(separatorIndex + 1)
                        : configPath
                };
            }

            foreach (var field in fields)
            {
                var token = client.OsClientModel[field];
                if (token == null || token.Type == JTokenType.Null) continue;
                var value = token.ToString().Trim();
                if (!value.DosIsNullOrWhiteSpace()) return value;
            }
            return null;
        }

        private static int ExtensionDatabaseCacheSeconds => Math.Max(5,
            ConfigHelper.GetRuntimeConfigurationInt(
                "SaaS:ExtensionDatabaseCacheSeconds",
                60));

        private static string ExtensionDatabaseVersionKey(string osClient)
        {
            return $"Microi:{osClient}:ExtensionDatabase:Epoch";
        }

        private static bool TryGetExtensionDatabaseVersion(string osClient, out long version)
        {
            version = 0;
            try
            {
                if (osClient.DosIsNullOrWhiteSpace()) return false;
                var value = MicroiEngine.CacheTenant.Cache(osClient)
                    .GetIDatabase()
                    .StringGet(ExtensionDatabaseVersionKey(osClient));
                if (value.IsNullOrEmpty) return true;
                return long.TryParse(value.ToString(), out version);
            }
            catch
            {
                return false;
            }
        }

        public static bool IsExtensionDatabaseCacheExpired(OsClientSecret clientModel)
        {
            if (clientModel == null
                || !clientModel.DataBasesInitialized
                || clientModel.DataBasesLoadedAtUtc == default(DateTime))
                return true;

            if (TryGetExtensionDatabaseVersion(clientModel.OsClient, out var sharedVersion)
                && sharedVersion != clientModel.DataBasesVersion)
                return true;

            return DateTime.UtcNow - clientModel.DataBasesLoadedAtUtc
                   >= TimeSpan.FromSeconds(ExtensionDatabaseCacheSeconds);
        }

        /// <summary>
        /// 递增租户扩展数据库共享版本并清空当前节点会话列表。
        /// Redis 版本是多节点事实源，本地状态只是可丢失的 L1。
        /// </summary>
        public static DosResult InvalidateExtensionDatabaseCache(string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "OsClient 不能为空");
            try
            {
                var version = (long)MicroiEngine.CacheTenant.Cache(osClient)
                    .GetIDatabase()
                    .StringIncrement(ExtensionDatabaseVersionKey(osClient));
                if (ClientList.TryGetValue(osClient, out var client) && client != null)
                {
                    lock (client)
                    {
                        client.DataBases = null;
                        client.DataBasesInitialized = false;
                        client.DataBasesLoadedAtUtc = default(DateTime);
                        client.DataBasesVersion = version - 1;
                    }
                }
                return new DosResult(1, new { OsClient = osClient, Version = version }, "扩展数据库缓存版本已刷新");
            }
            catch (Exception ex)
            {
                if (ClientList.TryGetValue(osClient, out var client) && client != null)
                {
                    client.DataBases = null;
                    client.DataBasesInitialized = false;
                    client.DataBasesLoadedAtUtc = default(DateTime);
                }
                return new DosResult(0, null, "扩展数据库共享缓存刷新失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 允许获取内置Client的mac
        /// </summary>

        /// <summary>
        /// 当前内置已有的Client
        /// </summary>
        //private static List<OsClientSecret> ClientList { get; set; }
        public static ConcurrentDictionary<string, OsClientSecret> ClientList = new ConcurrentDictionary<string, OsClientSecret>();

        /// <summary>
        /// 防止缓存初始化时的无限递归标志
        /// </summary>
        // Redis connection setup calls back into tenant resolution synchronously.
        // The recursion guard must be local to that thread; a process-wide flag
        // made unrelated requests skip their L2 tenant cache during startup.
        [ThreadStatic]
        public static bool _isCacheInitializing;

        internal const string SaasConfigurationCacheSchema = "microi.saas-engine.cache";
        internal const int SaasConfigurationCacheSchemaVersion = 2;

        private sealed class SaasConfigurationCacheIdentity
        {
            public string ConfigOsClient { get; set; }
            public string OsClientType { get; set; }
            public string OsClientNetwork { get; set; }
            public string OsClient { get; set; }
            public string LegacyConfigOsClient { get; set; }
            public string LegacyOsClient { get; set; }
        }

        /// <summary>
        /// OsClientName
        /// </summary>
        public static string OsClient { get; set; }

        public static string GetConfigOsClient()
        {
            var osClientName = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
            return osClientName;
        }

        /// <summary>
        /// 从当前节点运行快照中解析唯一租户。数据库、缓存键和请求上下文对 OsClient
        /// 采用不区分大小写的身份语义，但 ClientList 为兼容历史代码仍保留原比较器；
        /// 因此精确键未命中时只能接受唯一的大小写变体，存在重复项则失败关闭。
        /// </summary>
        internal static bool TryResolveUniqueLoadedClient(
            string requestedOsClient,
            out string canonicalKey,
            out OsClientSecret client,
            out bool ambiguous)
        {
            canonicalKey = (requestedOsClient ?? string.Empty).Trim();
            client = null;
            ambiguous = false;
            if (canonicalKey.DosIsNullOrWhiteSpace()) return false;

            if (ClientList.TryGetValue(canonicalKey, out client) && client != null)
            {
                return true;
            }

            var requestedKey = canonicalKey;
            var matches = ClientList
                .Where(item => string.Equals(
                    item.Key,
                    requestedKey,
                    StringComparison.OrdinalIgnoreCase))
                .Take(2)
                .ToArray();
            if (matches.Length == 1 && matches[0].Value != null)
            {
                canonicalKey = matches[0].Key;
                client = matches[0].Value;
                return true;
            }

            ambiguous = matches.Length > 1;
            return false;
        }

        /// <summary>
        /// 从 OsClientSecret 中提取可序列化的配置部分
        /// 【设计】直接返回 OsClientModel（完整的 JObject），包含所有数据库字段
        /// 这样缓存的就是完整的配置，不会丢失任何字段
        /// </summary>
        private static JObject ExtractClientConfig(OsClientSecret client)
        {
            if (client == null) return null;

            EnsureMainTenantDatabaseConfig(client.OsClient, client.OsClientModel);

            // 缓存必须保存独立快照。直接缓存运行模型引用会让后续的节点基础设施
            // 重投影写穿 ClientList，最终把某一节点的 Redis/对象存储端点传播到其它节点。
            return client.OsClientModel == null
                ? null
                : (JObject)client.OsClientModel.DeepClone();
        }

        private static string NormalizeSaasCacheIdentityValue(string value)
        {
            return (value ?? string.Empty).Trim().ToLowerInvariant();
        }

        private static bool TryCreateSaasConfigurationCacheIdentity(
            string osClient,
            out SaasConfigurationCacheIdentity identity)
        {
            identity = null;
            var configOsClient = GetConfigOsClient();
            if (configOsClient.DosIsNullOrWhiteSpace())
            {
                configOsClient = OsClientDefault.OsClient;
            }

            var normalizedConfigOsClient = NormalizeSaasCacheIdentityValue(configOsClient);
            var normalizedOsClientType = NormalizeSaasCacheIdentityValue(OsClientDefault.OsClientType);
            var normalizedOsClientNetwork = NormalizeSaasCacheIdentityValue(OsClientDefault.OsClientNetwork);
            var normalizedOsClient = NormalizeSaasCacheIdentityValue(osClient);
            if (normalizedConfigOsClient.Length == 0
                || normalizedOsClientType.Length == 0
                || normalizedOsClientNetwork.Length == 0
                || normalizedOsClient.Length == 0)
            {
                return false;
            }

            identity = new SaasConfigurationCacheIdentity
            {
                ConfigOsClient = normalizedConfigOsClient,
                OsClientType = normalizedOsClientType,
                OsClientNetwork = normalizedOsClientNetwork,
                OsClient = normalizedOsClient,
                LegacyConfigOsClient = (configOsClient ?? string.Empty).Trim(),
                LegacyOsClient = (osClient ?? string.Empty).Trim()
            };
            return true;
        }

        internal static string GetSaasConfigurationCacheKey(
            string configOsClient,
            string osClientType,
            string osClientNetwork,
            string osClient)
        {
            var config = NormalizeSaasCacheIdentityValue(configOsClient);
            var type = NormalizeSaasCacheIdentityValue(osClientType);
            var network = NormalizeSaasCacheIdentityValue(osClientNetwork);
            var tenant = NormalizeSaasCacheIdentityValue(osClient);
            if (config.Length == 0 || type.Length == 0 || network.Length == 0 || tenant.Length == 0)
            {
                throw new ArgumentException("SaaS cache identity cannot contain an empty value.");
            }

            return $"Microi:{Uri.EscapeDataString(config)}:saas-engine:v2:" +
                   $"{Uri.EscapeDataString(type)}:{Uri.EscapeDataString(network)}:" +
                   Uri.EscapeDataString(tenant);
        }

        private static string GetSaasConfigurationCacheKey(SaasConfigurationCacheIdentity identity)
        {
            return GetSaasConfigurationCacheKey(
                identity.ConfigOsClient,
                identity.OsClientType,
                identity.OsClientNetwork,
                identity.OsClient);
        }

        private static IReadOnlyCollection<string> GetLegacySaasConfigurationCacheKeys(
            string configOsClient,
            string osClient)
        {
            var configValues = new[]
            {
                (configOsClient ?? string.Empty).Trim(),
                NormalizeSaasCacheIdentityValue(configOsClient)
            };
            var tenantValues = new[]
            {
                (osClient ?? string.Empty).Trim(),
                NormalizeSaasCacheIdentityValue(osClient)
            };

            return configValues
                .Where(value => value.Length > 0)
                .SelectMany(config => tenantValues
                    .Where(value => value.Length > 0)
                    .Select(tenant => $"Microi:{config}:saas-engine:{tenant}"))
                .Distinct(StringComparer.Ordinal)
                .ToArray();
        }

        private static bool CacheIdentityEquals(string actual, string expected)
        {
            var normalizedActual = NormalizeSaasCacheIdentityValue(actual);
            var normalizedExpected = NormalizeSaasCacheIdentityValue(expected);
            return normalizedActual.Length > 0
                   && normalizedExpected.Length > 0
                   && string.Equals(
                       normalizedActual,
                       normalizedExpected,
                       StringComparison.Ordinal);
        }

        private static bool ConfigurationHasIdentity(
            JObject configuration,
            string osClientType,
            string osClientNetwork,
            string osClient)
        {
            if (configuration == null) return false;
            var actualOsClient = configuration["OsClient"]?.Val<string>();
            var actualType = configuration["OsClientType"]?.Val<string>();
            var actualNetwork = configuration["OsClientNetwork"]?.Val<string>();
            return !actualOsClient.DosIsNullOrWhiteSpace()
                   && !actualType.DosIsNullOrWhiteSpace()
                   && !actualNetwork.DosIsNullOrWhiteSpace()
                   && CacheIdentityEquals(actualOsClient, osClient)
                   && CacheIdentityEquals(actualType, osClientType)
                   && CacheIdentityEquals(actualNetwork, osClientNetwork);
        }

        private static bool EnsureConfigurationIdentityForWrite(
            JObject configuration,
            string osClientType,
            string osClientNetwork,
            string osClient)
        {
            if (configuration == null) return false;
            var expected = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["OsClient"] = osClient,
                ["OsClientType"] = osClientType,
                ["OsClientNetwork"] = osClientNetwork
            };
            foreach (var pair in expected)
            {
                var current = configuration[pair.Key]?.Val<string>();
                if (current.DosIsNullOrWhiteSpace())
                {
                    configuration[pair.Key] = pair.Value;
                    continue;
                }
                if (!CacheIdentityEquals(current, pair.Value)) return false;
            }
            return true;
        }

        internal static JObject CreateSaasConfigurationCachePayload(
            JObject configuration,
            string configOsClient,
            string osClientType,
            string osClientNetwork,
            string osClient)
        {
            if (NormalizeSaasCacheIdentityValue(configOsClient).Length == 0
                || NormalizeSaasCacheIdentityValue(osClientType).Length == 0
                || NormalizeSaasCacheIdentityValue(osClientNetwork).Length == 0
                || NormalizeSaasCacheIdentityValue(osClient).Length == 0)
            {
                return null;
            }

            var config = configuration == null
                ? null
                : (JObject)configuration.DeepClone();
            if (!EnsureConfigurationIdentityForWrite(
                    config,
                    osClientType,
                    osClientNetwork,
                    osClient))
            {
                return null;
            }

            return new JObject
            {
                ["Schema"] = SaasConfigurationCacheSchema,
                ["SchemaVersion"] = SaasConfigurationCacheSchemaVersion,
                ["Identity"] = new JObject
                {
                    ["ConfigOsClient"] = NormalizeSaasCacheIdentityValue(configOsClient),
                    ["OsClientType"] = NormalizeSaasCacheIdentityValue(osClientType),
                    ["OsClientNetwork"] = NormalizeSaasCacheIdentityValue(osClientNetwork),
                    ["OsClient"] = NormalizeSaasCacheIdentityValue(osClient)
                },
                ["Configuration"] = config
            };
        }

        internal static bool TryValidateSaasConfigurationCachePayload(
            JObject payload,
            string configOsClient,
            string osClientType,
            string osClientNetwork,
            string osClient,
            out JObject configuration)
        {
            configuration = null;
            var hasExpectedSchemaVersion = int.TryParse(
                payload?["SchemaVersion"]?.ToString(),
                out var schemaVersion)
                && schemaVersion == SaasConfigurationCacheSchemaVersion;
            if (payload == null
                || !string.Equals(
                    payload["Schema"]?.Val<string>(),
                    SaasConfigurationCacheSchema,
                    StringComparison.Ordinal)
                || !hasExpectedSchemaVersion
                || !(payload["Identity"] is JObject identity)
                || !(payload["Configuration"] is JObject cachedConfiguration))
            {
                return false;
            }

            if (!CacheIdentityEquals(identity["ConfigOsClient"]?.Val<string>(), configOsClient)
                || !CacheIdentityEquals(identity["OsClientType"]?.Val<string>(), osClientType)
                || !CacheIdentityEquals(identity["OsClientNetwork"]?.Val<string>(), osClientNetwork)
                || !CacheIdentityEquals(identity["OsClient"]?.Val<string>(), osClient)
                || !ConfigurationHasIdentity(
                    cachedConfiguration,
                    osClientType,
                    osClientNetwork,
                    osClient))
            {
                return false;
            }

            configuration = (JObject)cachedConfiguration.DeepClone();
            return true;
        }

        internal static bool TryValidateLegacySaasConfigurationCache(
            JObject legacyConfiguration,
            string osClientType,
            string osClientNetwork,
            string osClient,
            out JObject configuration)
        {
            configuration = null;
            // v1 裸 JObject 没有独立 envelope。只有其自身携带完整且匹配的三元身份时
            // 才允许一次性迁移；缺少身份的历史值绝不能再按请求 key 猜测租户。
            if (!ConfigurationHasIdentity(
                    legacyConfiguration,
                    osClientType,
                    osClientNetwork,
                    osClient))
            {
                return false;
            }

            configuration = (JObject)legacyConfiguration.DeepClone();
            return true;
        }

        /// <summary>
        /// 合并缓存中的配置与本地 ClientList 中的 DB 对象
        /// 【设计】从缓存恢复 OsClientModel（完整配置），同时保留本地的 DB 对象（Db、DbRead 等）
        /// </summary>
        private static OsClientSecret MergeConfigWithClientObjects(
            JObject config,
            OsClientSecret localClient,
            JObject currentNodeLocalModel)
        {
            if (localClient == null) return null;

            // Redis 中保存的是 SaaS 业务配置；数据库连接属于当前进程的本地配置。
            // 主租户在 sys_osclients 中通常不填写 DbConn，不能让缓存中的空值覆盖
            // InitializeDefaultClient 从环境变量/appsettings 加载的连接字符串。
            if (config != null)
            {
                // Only a model that was already present in this node's ClientList is a
                // trustworthy current-node projection. A transient client reconstructed
                // from L2 must not feed that same L2 snapshot back as its "local" fallback.
                var localModel = currentNodeLocalModel;
                var localSigningKeyStatus = DiyToken.GetJwtSigningKeyStatus(
                    localClient,
                    includeFingerprint: false);
                var localAuthSecret = localModel?["AuthSecret"]?.Val<string>();
                var localAuthSecretRotateVersion = localModel?["AuthSecretRotateVersion"]?.Val<string>();
                var localDbConn = localModel?["DbConn"]?.Val<string>();
                var localDbReadConn = localModel?["DbReadConn"]?.Val<string>();
                var localDbType = localModel?["DbType"]?.Val<string>();
                var localDbReadType = localModel?["DbReadType"]?.Val<string>();

                var mergedModel = (JObject)config.DeepClone();
                ReprojectCurrentNodeInfrastructure(
                    localClient.OsClient,
                    mergedModel,
                    localModel);
                localClient.OsClientModel = mergedModel;
                RestoreLocalDatabaseValue(localClient.OsClientModel, "DbConn", localDbConn);
                RestoreLocalDatabaseValue(localClient.OsClientModel, "DbReadConn", localDbReadConn);
                RestoreLocalDatabaseValue(localClient.OsClientModel, "DbType", localDbType);
                RestoreLocalDatabaseValue(localClient.OsClientModel, "DbReadType", localDbReadType);
                if (localSigningKeyStatus.Ready)
                {
                    // 当前节点已经从宿主配置或数据库挂载到稳定密钥时，Redis 中的旧快照
                    // 不能把它覆盖回发布前的临时值。显式轮换会先落数据库，再触发租户重载。
                    RestoreLocalDatabaseValue(localClient.OsClientModel, "AuthSecret", localAuthSecret);
                    RestoreLocalDatabaseValue(
                        localClient.OsClientModel,
                        "AuthSecretRotateVersion",
                        localAuthSecretRotateVersion);
                }
            }

            EnsureMainTenantDatabaseConfig(localClient.OsClient, localClient.OsClientModel);

            return localClient;
        }

        private static void ReprojectCurrentNodeInfrastructure(
            string osClient,
            JObject mergedModel,
            JObject localModel)
        {
            if (mergedModel == null) return;

            if (IsConfiguredMainTenant(osClient))
            {
                // 主租户共享基础设施以本节点已经解析的运行快照为准；先剥离 L2
                // 端点再恢复本地投影，避免本节点未配置的字段残留为其它节点的值。
                var restored = RestoreSharedInfrastructureFromLocal(
                    mergedModel,
                    localModel,
                    removeCachedValuesFirst: true);
                if (!restored)
                {
                    throw new InvalidOperationException(
                        $"主租户[{osClient}]缺少当前节点共享基础设施投影，已拒绝使用 L2 端点。");
                }
                return;
            }

            var configOsClient = GetConfigOsClient();
            if (configOsClient.DosIsNullOrWhiteSpace())
            {
                configOsClient = OsClientDefault.OsClient;
            }
            ClientList.TryGetValue(configOsClient ?? string.Empty, out var mainClient);
            if (mainClient == null)
            {
                mainClient = ClientList.FirstOrDefault(pair => string.Equals(
                    pair.Key,
                    configOsClient,
                    StringComparison.OrdinalIgnoreCase)).Value;
            }
            var mainModel = mainClient?.OsClientModel;

            if (mainModel == null)
            {
                // Redis 初始化递归或启动早期，主租户模型可能短暂不可用。此时不能调用
                // UseMainTenantRedisInfrastructure（它会先删除 child Redis 字段）；只允许
                // 回退到当前节点已存在的 localModel 投影。若本节点连该投影都没有，则
                // 失败关闭，绝不直接采用 L2 中的基础设施端点。
                var restored = RestoreSharedInfrastructureFromLocal(
                    mergedModel,
                    localModel,
                    removeCachedValuesFirst: true);
                if (!restored)
                {
                    throw new InvalidOperationException(
                        $"租户[{osClient}]无法从当前节点恢复共享基础设施投影，已拒绝使用 L2 端点。");
                }
                return;
            }

            // 所有共享基础设施字段先以当前 child 的本地快照重投影；Redis 再强制
            // 使用当前节点主租户，缺失的其它共享字段最后从当前主租户补齐。
            RestoreSharedInfrastructureFromLocal(
                mergedModel,
                localModel,
                removeCachedValuesFirst: true);
            TenantConfigurationSecurity.RemoveLegacySharedTenantCredentials(
                mergedModel,
                mainModel);
            TenantConfigurationSecurity.UseMainTenantRedisInfrastructure(
                mergedModel,
                mainModel);
            TenantConfigurationSecurity.InheritMissingSharedInfrastructure(
                mergedModel,
                mainModel);
        }

        internal static bool RestoreSharedInfrastructureFromLocal(
            JObject target,
            JObject localModel,
            bool removeCachedValuesFirst)
        {
            if (target == null) return false;
            var restored = false;
            foreach (var field in TenantConfigurationSecurity.SharedInfrastructureFields)
            {
                if (removeCachedValuesFirst)
                {
                    foreach (var cachedProperty in target.Properties().Where(property =>
                                 string.Equals(property.Name, field, StringComparison.OrdinalIgnoreCase)).ToList())
                    {
                        cachedProperty.Remove();
                    }
                }

                if (localModel == null) continue;

                var localProperty = localModel.Properties().FirstOrDefault(property =>
                    string.Equals(property.Name, field, StringComparison.OrdinalIgnoreCase));
                if (localProperty == null
                    || localProperty.Value == null
                    || localProperty.Value.Type == JTokenType.Null
                    || localProperty.Value.Type == JTokenType.Undefined
                    || (localProperty.Value.Type == JTokenType.String
                        && localProperty.Value.ToString().DosIsNullOrWhiteSpace()))
                {
                    continue;
                }
                target[field] = localProperty.Value.DeepClone();
                restored = true;
            }
            return restored;
        }

        private static void RestoreLocalDatabaseValue(JObject target, string fieldName, string localValue)
        {
            if (target != null && !localValue.DosIsNullOrWhiteSpace())
            {
                target[fieldName] = localValue;
            }
        }

        /// <summary>
        /// 主租户的数据库连接以进程环境变量为第一优先级、appsettings 为第二优先级。
        /// sys_osclients.DbConn 可以留空，且 Redis 中的空值不得覆盖本机配置。
        /// </summary>
        private static void EnsureMainTenantDatabaseConfig(string osClient, JObject osClientModel)
        {
            if (osClientModel == null || !IsConfiguredMainTenant(osClient)) return;

            var dbConn = GetConfiguredDbConnectionValue(OsClientDefault.OsClientDbConn);
            string currentDbConn = osClientModel["DbConn"]?.Val<string>() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(currentDbConn)
                && !string.IsNullOrWhiteSpace(dbConn))
            {
                osClientModel["DbConn"] = dbConn;
                currentDbConn = dbConn;
            }

            var dbType = GetConfiguredDbTypeValue(OsClientDefault.OsClientDbType);
            string currentDbType = osClientModel["DbType"]?.Val<string>() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(currentDbType)
                && !string.IsNullOrWhiteSpace(dbType))
            {
                osClientModel["DbType"] = dbType;
                currentDbType = dbType;
            }

            string currentDbReadConn = osClientModel["DbReadConn"]?.Val<string>() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(currentDbReadConn)
                && !string.IsNullOrWhiteSpace(currentDbConn))
            {
                osClientModel["DbReadConn"] = currentDbConn;
            }
            string currentDbReadType = osClientModel["DbReadType"]?.Val<string>() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(currentDbReadType)
                && !string.IsNullOrWhiteSpace(currentDbType))
            {
                osClientModel["DbReadType"] = currentDbType;
            }
        }

        private static bool IsConfiguredMainTenant(string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace()) return false;
            var configuredOsClient = GetConfiguredOsClientValue(OsClientDefault.OsClient);
            return string.Equals(osClient, configuredOsClient, StringComparison.OrdinalIgnoreCase);
        }

        private static string GetConfiguredOsClientValue(string fallback)
        {
            var processValue = Environment.GetEnvironmentVariable(
                "OsClient",
                EnvironmentVariableTarget.Process);
            if (!processValue.DosIsNullOrWhiteSpace()) return processValue;

            var appSettingsValue = ConfigHelper.GetAppSettings("OsClient");
            return appSettingsValue.DosIsNullOrWhiteSpace() ? fallback : appSettingsValue;
        }

        private static string GetConfiguredDbConnectionValue(string fallback)
        {
            var processValue = Environment.GetEnvironmentVariable(
                "OsClientDbConn",
                EnvironmentVariableTarget.Process);
            if (!processValue.DosIsNullOrWhiteSpace()) return processValue;

            var appSettingsValue = ConfigHelper.GetAppSettings("OsClientDbConn");
            return appSettingsValue.DosIsNullOrWhiteSpace() ? fallback : appSettingsValue;
        }

        private static string GetConfiguredDbTypeValue(string fallback)
        {
            var processValue = Environment.GetEnvironmentVariable(
                "OsClientDbType",
                EnvironmentVariableTarget.Process);
            if (!processValue.DosIsNullOrWhiteSpace()) return processValue;

            var appSettingsValue = ConfigHelper.GetAppSettings("OsClientDbType");
            return appSettingsValue.DosIsNullOrWhiteSpace() ? fallback : appSettingsValue;
        }

        /// <summary>
        /// 获取非空值，如果缓存值为空则使用本地值
        /// </summary>
        private static string GetNonEmptyValue(string cacheValue, string localValue)
        {
            return string.IsNullOrWhiteSpace(cacheValue) ? localValue : cacheValue;
        }

        /// <summary>
        /// 获取缓存实例
        /// </summary>
        private static IMicroiCache GetCacheInstance()
        {
            try
            {
                return MicroiEngine.CacheTenant.Default();
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 从缓存获取值
        /// </summary>
        private static JObject GetFromCache(IMicroiCache cache, string key)
        {
            try
            {
                if (cache == null) return null;
                var result = cache.Get<JObject>(key);
                return result;
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 保存值到缓存
        /// </summary>
        private static bool SetToCache(IMicroiCache cache, string key, JObject value, TimeSpan? expiration = null)
        {
            try
            {
                if (cache == null || value == null) return false;
                return expiration.HasValue
                    ? cache.Set(key, value, expiration.Value)
                    : cache.Set(key, value);
            }
            catch
            {
                // 缓存失败不影响主流程
                return false;
            }
        }

        private static void RemoveCacheKey(IMicroiCache cache, string key)
        {
            if (cache == null || key.DosIsNullOrWhiteSpace()) return;
            try
            {
                // TwoLevelCache.Remove 会同步清理 L1/L2 并发布 Pub/Sub 失效通知。
                cache.Remove(key);
            }
            catch
            {
                // 缓存失效失败不能中断数据库权威读取路径。
            }
        }

        private static JObject ReadSaasConfigurationCache(
            IMicroiCache cache,
            SaasConfigurationCacheIdentity identity)
        {
            if (cache == null || identity == null) return null;
            var cacheKey = GetSaasConfigurationCacheKey(identity);
            var payload = GetFromCache(cache, cacheKey);
            if (payload != null)
            {
                if (TryValidateSaasConfigurationCachePayload(
                        payload,
                        identity.ConfigOsClient,
                        identity.OsClientType,
                        identity.OsClientNetwork,
                        identity.OsClient,
                        out var configuration))
                {
                    return configuration;
                }

                // schema/identity 不匹配的 v2 值必须失败关闭，并通知其它节点清除 L1。
                RemoveCacheKey(cache, cacheKey);
            }

            foreach (var legacyKey in GetLegacySaasConfigurationCacheKeys(
                         identity.LegacyConfigOsClient,
                         identity.LegacyOsClient))
            {
                var legacy = GetFromCache(cache, legacyKey);
                if (legacy == null) continue;
                if (!TryValidateLegacySaasConfigurationCache(
                        legacy,
                        identity.OsClientType,
                        identity.OsClientNetwork,
                        identity.OsClient,
                        out var legacyConfiguration))
                {
                    // 无身份或身份不匹配的旧 payload 不得信任。
                    RemoveCacheKey(cache, legacyKey);
                    continue;
                }

                var migratedPayload = CreateSaasConfigurationCachePayload(
                    legacyConfiguration,
                    identity.ConfigOsClient,
                    identity.OsClientType,
                    identity.OsClientNetwork,
                    identity.OsClient);
                if (SetToCache(cache, cacheKey, migratedPayload))
                {
                    RemoveCacheKey(cache, legacyKey);
                    return legacyConfiguration;
                }
            }
            return null;
        }

        internal static JObject ReadSaasConfigurationCache(
            IMicroiCache cache,
            string configOsClient,
            string osClientType,
            string osClientNetwork,
            string osClient)
        {
            var identity = new SaasConfigurationCacheIdentity
            {
                ConfigOsClient = NormalizeSaasCacheIdentityValue(configOsClient),
                OsClientType = NormalizeSaasCacheIdentityValue(osClientType),
                OsClientNetwork = NormalizeSaasCacheIdentityValue(osClientNetwork),
                OsClient = NormalizeSaasCacheIdentityValue(osClient),
                LegacyConfigOsClient = (configOsClient ?? string.Empty).Trim(),
                LegacyOsClient = (osClient ?? string.Empty).Trim()
            };
            if (identity.ConfigOsClient.Length == 0
                || identity.OsClientType.Length == 0
                || identity.OsClientNetwork.Length == 0
                || identity.OsClient.Length == 0)
            {
                return null;
            }
            return ReadSaasConfigurationCache(cache, identity);
        }

        public static void InvalidateSaasConfigurationCache(
            string osClient,
            IMicroiCache cache = null)
        {
            if (osClient.DosIsNullOrWhiteSpace()) return;
            cache = cache ?? GetCacheInstance();
            if (cache == null) return;

            if (TryCreateSaasConfigurationCacheIdentity(osClient, out var identity))
            {
                RemoveCacheKey(cache, GetSaasConfigurationCacheKey(identity));
            }

            var configOsClient = GetConfigOsClient();
            if (configOsClient.DosIsNullOrWhiteSpace())
            {
                configOsClient = OsClientDefault.OsClient;
            }
            foreach (var legacyKey in GetLegacySaasConfigurationCacheKeys(
                         configOsClient,
                         osClient))
            {
                RemoveCacheKey(cache, legacyKey);
            }
        }

        public static OsClientSecret GetClient(string osClient = "")
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }

            if (osClient.DosIsNullOrWhiteSpace())
            {
                throw new Exception("OsClient.GetClient出现错误：OsClient为空！");
            }
            osClient = osClient.DosTrim();

            // 【分布式缓存优先策略】
            // 第一步：尝试从L2缓存（Redis）获取配置
            // 【递归保护】如果正在初始化缓存，跳过缓存读取以避免无限递归
            JObject cachedConfig = null;
            if (!_isCacheInitializing
                && TryCreateSaasConfigurationCacheIdentity(osClient, out var cacheIdentity))
            {
                var cache = GetCacheInstance();
                cachedConfig = ReadSaasConfigurationCache(cache, cacheIdentity);
            }

            // 第二步：从本地ClientList获取完整的OsClientSecret（包含DB对象）
            TryResolveUniqueLoadedClient(
                osClient,
                out var canonicalClientKey,
                out var client,
                out var ambiguousClientKey);
            if (ambiguousClientKey)
            {
                var diagnostic = $"OsClient=[{osClient}]在当前节点存在多个仅大小写不同的运行快照，已停止解析。";
                Console.WriteLine($"Microi：【Error异常】【SaaS租户解析】{diagnostic}");
                MicroiEngine.QueueSystemLog(
                    osClient,
                    "SaaS",
                    "AmbiguousRuntimeTenant",
                    "租户运行快照存在大小写重复",
                    diagnostic,
                    3,
                    false,
                    osClient);
                throw new InvalidOperationException(diagnostic);
            }
            if (client != null)
            {
                // 后续合并与 AddOrUpdate 必须沿用 ClientList 中的权威大小写，避免为同一
                // 租户再创建一个仅大小写不同的本地运行快照。
                osClient = canonicalClientKey;
            }

            var currentNodeLocalModel = client?.OsClientModel;

            // 本机尚未加载该租户时，允许从 Redis 中的 SaaS 配置构造临时 Client。
            // 必须先完成当前节点基础设施重投影，成功后才能放入 ClientList；否则失败路径
            // 会把未经重投影的 L2 端点暴露给直接读取 ClientList 的其它运行时组件。
            if (client == null && cachedConfig != null)
            {
                client = new OsClientSecret
                {
                    OsClient = osClient,
                    OsClientModel = new JObject()
                };
            }

            if (client != null)
            {

                // 如果有缓存配置，合并缓存配置与本地DB对象
                if (cachedConfig != null)
                {
                    client = MergeConfigWithClientObjects(
                        cachedConfig,
                        client,
                        currentNodeLocalModel);
                    ClientList.AddOrUpdate(osClient, client, (key, oldValue) => client);
                }

                EnsureMainTenantDatabaseConfig(osClient, client.OsClientModel);

                //判断数据库对象是否初始化，或已断开？
                if (client.Db == null || client.DbRead == null)
                {
                    // 【防御】检查 DbConn 是否有效，避免创建会话时出现 null 错误
                    if (client.OsClientModel["DbConn"] == null || client.OsClientModel["DbConn"].Val<string>().DosIsNullOrWhiteSpace())
                    {
                        throw new Exception($"OsClient.GetClient出现错误：OsClient=[{osClient}] 的数据库连接字符串（DbConn）为空或未配置！请检查 OsClient 表中该租户的配置。");
                    }

                    // 【防御】检查 DbType 是否有效，为空时使用默认值 MySql
                    var dbTypeString = client.OsClientModel["DbType"]?.Val<string>();
                    if (dbTypeString.DosIsNullOrWhiteSpace())
                    {
                        dbTypeString = "MySql";
                    }

                    try
                    {
                        // 使用工厂创建会话（Dos.ORM）
                        var dbType = (DatabaseType)Enum.Parse(typeof(DatabaseType), dbTypeString);
                        client.Db = MicroiORMExtensions.CreateDbSession(client.OsClientModel["DbConn"].Val<string>(), dbType);

                        // 【防御】检查 DbReadType 是否有效，为空时使用默认值 MySql
                        var dbReadTypeString = client.OsClientModel["DbReadType"]?.Val<string>();
                        if (dbReadTypeString.DosIsNullOrWhiteSpace())
                        {
                            dbReadTypeString = "MySql";
                        }

                        var dbReadType = (DatabaseType)Enum.Parse(typeof(DatabaseType), dbReadTypeString);
                        // 【防御】DbReadConn 为空时回退到 DbConn（读写共用主库连接），避免 ArgumentNullException
                        var dbReadConnStr = client.OsClientModel["DbReadConn"]?.Val<string>();
                        if (dbReadConnStr.DosIsNullOrWhiteSpace())
                        {
                            dbReadConnStr = client.OsClientModel["DbConn"].Val<string>();
                            dbReadType = dbType;
                        }
                        client.DbRead = MicroiORMExtensions.CreateDbSession(dbReadConnStr, dbReadType);
                    }
                    catch (Exception ex)
                    {
                        var safeConnStr = SanitizeConnectionString(client.OsClientModel["DbConn"]?.Val<string>());
                        var safeReadConnStr = SanitizeConnectionString(client.OsClientModel["DbReadConn"]?.Val<string>());
                        throw new Exception(
                            $"OsClient.GetClient数据库连接失败：OsClient=[{osClient}]，" +
                            $"DbType=[{dbTypeString}]，" +
                            $"写库连接字符串=[{safeConnStr}]，" +
                            $"读库连接字符串=[{safeReadConnStr}]，" +
                            $"错误信息：{ex.Message}", ex);
                    }

                    AddOrUptClient(client);
                }
                return client;
            }
            throw new Exception($"Microi：【Error异常】未找到OsClient：{(osClient ?? "")}");
        }
        /// <summary>
        /// 
        /// </summary>
        public static OsClientSecret AddOrUptClient(
            OsClientSecret client,
            bool publishConfiguration = true)
        {
            try
            {
                if (client == null || client.OsClient.DosIsNullOrWhiteSpace())
                {
                    MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "SaaS", "EmptyTenantRejected", "更新租户运行时配置失败", "OsClient 不能为空。", 2);
                    return client;
                }

                // 第一步：更新本地ClientList
                ClientList.AddOrUpdate(client.OsClient, client, (key, oldValue) => client);
                if (!publishConfiguration)
                {
                    return client;
                }

                MicroiEngine.QueueSystemLog(client.OsClient, "SaaS", "RuntimeConfigurationUpdated", "租户运行时配置已更新", "本节点 ClientList 已刷新。", 1, true, client.OsClient);

                // 第二步：提取可序列化配置并缓存到L2（Redis）
                try
                {
                    var signingKeyStatus = DiyToken.GetJwtSigningKeyStatus(
                        client,
                        includeFingerprint: false);
                    if (!signingKeyStatus.Ready)
                    {
                        // 启动占位模型不再把进程临时/空密钥写进共享 Redis，避免新节点
                        // 在数据库挂载完成前污染其它节点的稳定签名配置。
                        MicroiEngine.QueueSystemLog(
                            client.OsClient,
                            "SaaS",
                            "ConfigurationCacheSkipped",
                            "租户配置暂未写入 Redis",
                            signingKeyStatus.Message,
                            2,
                            false,
                            client.OsClient);
                        return client;
                    }

                    var config = ExtractClientConfig(client);
                    var cache = GetCacheInstance();

                    if (cache != null
                        && TryCreateSaasConfigurationCacheIdentity(
                            client.OsClient,
                            out var cacheIdentity))
                    {
                        var cacheKey = GetSaasConfigurationCacheKey(cacheIdentity);
                        var payload = CreateSaasConfigurationCachePayload(
                            config,
                            cacheIdentity.ConfigOsClient,
                            cacheIdentity.OsClientType,
                            cacheIdentity.OsClientNetwork,
                            cacheIdentity.OsClient);
                        if (payload == null)
                        {
                            MicroiEngine.QueueSystemLog(
                                client.OsClient,
                                "SaaS",
                                "ConfigurationCacheIdentityRejected",
                                "租户配置未写入 Redis",
                                "运行配置身份与当前节点 OsClientType/OsClientNetwork 不一致。",
                                2,
                                false,
                                client.OsClient);
                            return client;
                        }

                        // v2 envelope 写入 L2/L1，并由 TwoLevelCache 发布跨节点失效通知。
                        if (SetToCache(cache, cacheKey, payload))
                        {
                            foreach (var legacyKey in GetLegacySaasConfigurationCacheKeys(
                                         cacheIdentity.LegacyConfigOsClient,
                                         cacheIdentity.LegacyOsClient))
                            {
                                RemoveCacheKey(cache, legacyKey);
                            }
                            MicroiEngine.QueueSystemLog(client.OsClient, "SaaS", "ConfigurationCached", "租户配置已缓存到 Redis", "已写入 cache schema v2，并发布跨节点缓存失效通知。", 1, true, client.OsClient);
                        }
                    }
                }
                catch (Exception cacheEx)
                {
                    MicroiEngine.QueueSystemLog(client.OsClient, "SaaS", "ConfigurationCacheFailed", "租户配置写入 Redis 失败", cacheEx.ToString(), 2, false, client.OsClient);
                }

                return client;
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(client?.OsClient, "SaaS", "RuntimeConfigurationUpdateFailed", "更新租户运行时配置失败", ex.ToString(), 2, false, client?.OsClient);
                return client;
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="clientModel"></param>
        /// <param name="dataBaseId"></param>
        /// <returns></returns>
        public static OsClientDataBase GetClientDataBase(OsClientSecret clientModel, string dataBaseId)
        {
            if (dataBaseId.DosIsNullOrWhiteSpace())
            {
                return null;
            }
            if (IsExtensionDatabaseCacheExpired(clientModel)
                || clientModel.DataBases == null
                || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
            {
                InitOsClientDataBases(clientModel.Db, clientModel);
                // 这里只初始化当前进程的数据库会话，没有修改 SaaS 配置，
                // 禁止向 Redis 再发布一次配置变更。
                AddOrUptClient(clientModel, publishConfiguration: false);
            }
            if (clientModel.DataBases == null || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
            {
                throw new Exception($"未找到OsClient DataBaseId：{(dataBaseId ?? "")}。");
            }
            var dataBaseModel = clientModel.DataBases.First(d => d.Id == dataBaseId);
            if (dataBaseModel.Db == null || dataBaseModel.DbRead == null)
            {
                // 使用工厂创建会话（Dos.ORM）
                var dbType = ExternalDatabaseCatalog.ResolveType(dataBaseModel.DbType);
                dataBaseModel.Db = MicroiORMExtensions.CreateDbSession(dataBaseModel.DbConn, dbType);

                if (dataBaseModel.DbReadConn.DosIsNullOrWhiteSpace())
                {
                    dataBaseModel.DbReadConn = dataBaseModel.DbConn;
                }
                if (dataBaseModel.DbReadType.DosIsNullOrWhiteSpace())
                {
                    dataBaseModel.DbReadType = dataBaseModel.DbType;
                }
                var dbReadType = ExternalDatabaseCatalog.ResolveType(dataBaseModel.DbReadType);
                dataBaseModel.DbRead = MicroiORMExtensions.CreateDbSession(dataBaseModel.DbReadConn, dbReadType);
                AddOrUptClient(clientModel, publishConfiguration: false);
            }
            return dataBaseModel;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="db"></param>
        /// <param name="secret"></param>
        /// <returns></returns>
        public static OsClientSecret InitOsClientDataBases(DbSession db, OsClientSecret secret)
        {

            try
            {
                TryGetExtensionDatabaseVersion(secret.OsClient, out var versionBefore);
                List<OsClientDataBase> microiDatabaseList = null;
                var stableVersion = versionBefore;
                for (var attempt = 0; attempt < 2; attempt++)
                {
                    var left = db.Db.DbProvider.LeftToken;
                    var right = db.Db.DbProvider.RightToken;
                    var sql = $"select * from {left}microi_database{right} " +
                              $"where {left}IsEnable{right}=1 and {left}IsDeleted{right}=0";
                    microiDatabaseList = db.FromSql(sql)
                        .ToList<OsClientDataBase>();
                    if (!TryGetExtensionDatabaseVersion(secret.OsClient, out var versionAfter)
                        || versionAfter == versionBefore)
                    {
                        stableVersion = versionAfter;
                        break;
                    }
                    versionBefore = versionAfter;
                    stableVersion = versionAfter;
                }
                if (microiDatabaseList.Any())
                {
                    secret.DataBases = microiDatabaseList;
                    foreach (var item in secret.DataBases)
                    {

                    }
                }
                else
                {
                    secret.DataBases = new List<OsClientDataBase>();
                }
                secret.DataBasesInitialized = true;
                secret.DataBasesLoadedAtUtc = DateTime.UtcNow;
                secret.DataBasesVersion = stableVersion;
                return secret;
            }
            catch (Exception ex)
            {
                secret.DataBases = new List<OsClientDataBase>();
                secret.DataBasesInitialized = false;
                secret.DataBasesLoadedAtUtc = default(DateTime);
                return null;
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="clientModel"></param>
        /// <param name="dataBaseId"></param>
        /// <returns></returns>
        /// <exception cref="Exception"></exception>
        public static DbSession GetClientDbSession(OsClientSecret clientModel = null, string dataBaseId = "")
        {
            if (!dataBaseId.DosIsNullOrWhiteSpace())
            {
                if (IsExtensionDatabaseCacheExpired(clientModel)
                    || clientModel.DataBases == null
                    || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
                {
                    InitOsClientDataBases(clientModel.Db, clientModel);
                    AddOrUptClient(clientModel, publishConfiguration: false);
                }
                if (clientModel.DataBases == null || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
                {
                    throw new Exception($"未找到OsClient DataBaseId：{(dataBaseId ?? "")}。");
                }
                var dataBaseModel = clientModel.DataBases.First(d => d.Id == dataBaseId);
                if (dataBaseModel.Db == null || dataBaseModel.DbRead == null)
                {
                    // 使用工厂创建会话
                    var dbType = ExternalDatabaseCatalog.ResolveType(dataBaseModel.DbType);
                    dataBaseModel.Db = MicroiORMExtensions.CreateDbSession(dataBaseModel.DbConn, dbType);

                    if (dataBaseModel.DbReadConn.DosIsNullOrWhiteSpace())
                    {
                        dataBaseModel.DbReadConn = dataBaseModel.DbConn;
                    }
                    if (dataBaseModel.DbReadType.DosIsNullOrWhiteSpace())
                    {
                        dataBaseModel.DbReadType = dataBaseModel.DbType;
                    }
                    var dbReadType = ExternalDatabaseCatalog.ResolveType(dataBaseModel.DbReadType);
                    dataBaseModel.DbRead = MicroiORMExtensions.CreateDbSession(dataBaseModel.DbReadConn, dbReadType);
                    AddOrUptClient(clientModel, publishConfiguration: false);
                }
                return dataBaseModel.Db;
            }
            else
            {
                return clientModel.Db;
            }
        }
        /// <summary>
        /// 验证 OsClient 一致性
        /// </summary>
        public void ValidateOsClientConsistency(List<dynamic> dbOsClientsList)
        {
            try
            {
                if (!dbOsClientsList.Any(d => d.OsClient == OsClientDefault.OsClient))
                {
                    Console.WriteLine($"Microi：【警告】环境变量中的OsClient值为{OsClientDefault.OsClient}，但Sys_OsClients表中的并不存在此配置！根据OsClient、OsClientType、OsClientNetwork在sys_osclients中未匹配到数据，这将导致系统设置-开发配置无效！");
                }
            }
            catch { }
        }

        /// <summary>
        /// 加载系统配置
        /// </summary>
        public void LoadSysConfig(OsClientSecret currentClientModel)
        {
            var provider = currentClientModel.Db.Db.DbProvider;
            var left = provider.LeftToken;
            var right = provider.RightToken;
            // PostgreSQL 对未引用标识符大小写敏感；使用实际会话 Provider 的引用符，
            // 使 MySQL、SQL Server、Oracle、PostgreSQL 等启动路径保持同一实现。
            var sql = $"select * from {left}sys_config{right} " +
                      $"where {left}IsDeleted{right}<>1 and {left}IsEnable{right}=1";
            var sysConfig = currentClientModel.Db
                .FromSql(sql)
                .ToFirst<dynamic>();

            if (sysConfig != null)
            {
                bool enableSwagger = DynamicHelper.GetDynamicBoolValue(sysConfig, "EnableSwagger", false);
                if (!enableSwagger)
                {
                    currentClientModel.OsClientModel["EnableSwagger"] = 0;
                }
                string indexCodeApi = DynamicHelper.GetDynamicStringValue(sysConfig, "IndexCodeApi", "");
                if(!indexCodeApi.DosIsNullOrWhiteSpace())
                {
                    currentClientModel.OsClientModel["IndexCodeApi"] = indexCodeApi;
                }
            }
        }

        /// <summary>
        /// 隐藏连接字符串中的密码，用于安全日志输出
        /// </summary>
        public static string SanitizeConnectionString(string connectionString)
        {
            if (string.IsNullOrWhiteSpace(connectionString)) return "(空)";
            // 匹配 password=xxx 或 pwd=xxx，支持带引号和不带引号的值
            return Regex.Replace(connectionString, @"(?i)(password|pwd)\s*=\s*([^;]*)", "$1=***");
        }
    }

}

