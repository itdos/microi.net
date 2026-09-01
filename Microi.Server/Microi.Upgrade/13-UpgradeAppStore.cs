using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
namespace Microi.net
{
    /// <summary>
    /// 必要升级：应用商城
    /// </summary>
    public class UpgradeAppStore
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "7.6.11.0";
        private static readonly HttpClient ResourceHttpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(8)
        };
        private static readonly Lazy<Task<Dictionary<string, string>>> UpgradeResources =
            new Lazy<Task<Dictionary<string, string>>>(LoadUpgradeResourcesCoreAsync);
        private const string OfficialResourceApiUrl = "https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos";
        private const string ImportPackageResourceName = "import-package.js";
        private const string PublishAiAppResourceName = "ai-app-publish-store.js";
        private const string BuildAiAppResourceName = "ai-app-build.js";
        private const string FormEnginePackageResourceName = "app.microi.form-engine.json";
        private const string ModuleEnginePackageResourceName = "app.microi.module-engine.json";
        private const string SaaSEnginePackageResourceName = "app.microi.saas-engine.json";
        private const string SsoPackageResourceName = "app.microi.sso.json";
        private const string AppStorePackageResourceName = "app.microi.store.json";
        private const string SysUserPackageResourceName = "app.microi.sys_user.json";
        private const string SysConfigPackageResourceName = "app.microi.sys-config.json";
        private const string MessageNotificationPackageResourceName = "app.microi.message-notification.json";
        private const string AiEnginePackageResourceName = "app.microi.ai-engine.json";
        private const string OfficialResourcePublisherEngineKey = "get-microi-upgrade-resource";
        private const string PlatformBackgroundTaskEngineKey = "platform-background-task";
        private const string PlatformBackgroundTaskApiAddress = "/apiengine/platform-background-task";
        private const string PlatformSysMenuEngineKey = "platform-sys-menu";
        private const string PlatformSysMenuApiAddress = "/apiengine/platform-sys-menu";
        private const string AppStoreMenuId = "61b7faee-35b2-4571-add2-5231a355f368";
        private const string PlatformMicroServiceKey = "microi-platform-service";
        private const string MarketplaceRoutePath = "/marketplace";
        private const string MicroAppHostComponentPath = "/micro-app/host";
        private const string ApplicationAssetUploadAuditMenuId =
            "a3000100-0000-4000-8000-000000000100";
        // Jint 4.14 的 MemoryLimitConstraint 统计一次执行的累计分配量，而非实时存活堆。
        // 远程 ZIP 即使只有十余 MB，也会因 HTTP byte[]、Base64、ZIP Entry 与 JS/.NET
        // 互操作在单片中累计到 4GB 以上。统一导入器同时强制每片一个资产，因此仅把
        // 受信任核心导入器提升到平台既有 8GB 累计分配硬上限；进程常驻内存保护仍生效，
        // 普通接口引擎不受影响，5GB 运行资产继续走 HDFS multipart 而不进入 Jint。
        private const int ImporterLimitMemoryMb = 8192;
        private static readonly System.Version MinimumPinnedImporterVersion = new System.Version(2, 5, 1);
        private static readonly System.Version MinimumPinnedBulkVersion = new System.Version(1, 3, 8);
        private static readonly System.Version MinimumPlatformBackgroundTaskVersion = new System.Version(1, 1, 0);
        private static readonly System.Version MinimumPlatformSysMenuVersion = new System.Version(1, 0, 1);
        private static readonly System.Version MinimumPlatformRuntimePackageVersion = new System.Version(7, 7, 1);
        private static readonly System.Version MinimumPlatformRuntimeEngineVersion = new System.Version(1, 0, 0);
        private static readonly System.Version MinimumPlatformServiceHealthEngineVersion = new System.Version(1, 0, 1);
        private static readonly System.Version MinimumPlatformLoginWallpapersEngineVersion = new System.Version(1, 1, 0);
        private static readonly System.Version MinimumPlatformMicroiInitEngineVersion = new System.Version(2, 0, 2);
        private const string PlatformRuntimeCustomHookEngineKey = "platform-runtime-custom-hook";
        private const string ManagedPlatformRuntimeNoticeMarker = "/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1";
        private const string TenantPlatformRuntimeNoticeMarker = "/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1";
        private const string DefaultPlatformRuntimeHookBody = "return { Code : 1 };";
        private static readonly string[] ManagedPlatformRuntimeEngineKeys =
        {
            "platform-os-client-by-domain",
            "platform-sys-config",
            "platform-service-health",
            "platform-lang-bundle",
            "platform-current-user",
            "platform-private-file-url",
            "platform-sys-user-public-info",
            "platform-login-wallpapers",
            "microi-init",
            "mci-system-observability-query",
            "mci-system-observability-action",
            "platform-data-source-run",
            "platform-module-data",
            "platform-ocr-recognize",
            "platform-office-export-word-by-template",
            "platform-translate-runtime",
            "platform-user-behavior-signal"
        };
        private static readonly string[] RequiredPlatformRuntimeEngineKeys =
            ManagedPlatformRuntimeEngineKeys.Concat(new[] { PlatformRuntimeCustomHookEngineKey }).ToArray();
        // A successful login is not a useful readiness boundary if authenticated
        // routes or a transitive V8.ApiEngine.Run dependency are still missing.
        // The application packages are the single source of truth. All engines
        // from the official baseline packages must exist before traffic is
        // accepted, including internal workers and tenant-owned hooks. This
        // avoids another C# route list that drifts whenever a Controller is
        // migrated to V8 or an installer adds a new dependency.
        private static readonly string[] RuntimeDependencyPackageResourceNames =
        {
            FormEnginePackageResourceName,
            ModuleEnginePackageResourceName,
            SaaSEnginePackageResourceName,
            SsoPackageResourceName,
            AppStorePackageResourceName,
            SysUserPackageResourceName,
            SysConfigPackageResourceName,
            MessageNotificationPackageResourceName,
            AiEnginePackageResourceName
        };
        private static readonly IReadOnlyDictionary<string, string[]> StartupDependencyPackageKeys =
            BuildRuntimeDependencyPackageKeys();
        internal static readonly string[] RequiredStartupDependencyEngineKeys =
            RuntimeDependencyPackageResourceNames
                .Where(StartupDependencyPackageKeys.ContainsKey)
                .SelectMany(resourceName => StartupDependencyPackageKeys[resourceName])
                .ToArray();
        private static readonly Lazy<IReadOnlyList<JObject>> BundledStartupDependencyEngines =
            new Lazy<IReadOnlyList<JObject>>(BuildBundledStartupDependencyEngines);
        private static readonly HashSet<string> ApiEngineBitColumns =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "IsDeleted", "IsEnable", "Lock", "AllowAnonymous"
            };
        // 启动闭包会在 FormEngine 可用前直接写 sys_apiengine，因此只能消费该表的
        // 物理字段。官方包历史上曾把展示名称导出为 Name；若把包对象的全部属性直接
        // 拼成列名，旧租户会因 Unknown column 'Name' 退出，Docker 随即反复重启。
        // 这里保留当前实体的完整物理字段白名单，包级说明等非物理元数据一律不入库。
        private static readonly HashSet<string> StartupDependencyPhysicalFields =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "Id", "CreateTime", "UpdateTime", "UserId", "UserName", "IsDeleted",
                "ApiName", "ApiEngineKey", "ApiAddress", "ApiRoutes", "ApiV8Code", "ApiRemark",
                "ApiRole", "Category", "ChangeHistory", "Version", "Files", "TestParam",
                "TestResult", "AiCheckResult", "IsEnable", "StopHttp", "AllowAnonymous",
                "EnableLog", "ResponseFile", "ResponseType", "Lock", "LockKey", "Timeout",
                "MaxStatements", "LimitMemory", "LimitRecursion", "V8Limit", "V8Unlimited"
            };
        // 启动门禁没有登录用户上下文。旧版 sys_apiengine.UserId/UserName 曾是
        // NOT NULL 且没有默认值，因此官方包偶尔漏出审计字段时必须使用稳定的
        // 平台系统身份补齐；该身份只用于审计兼容，不参与任何授权判断。
        private const string StartupDependencySystemUserId = "c74d669c-a3d4-11e5-b60d-b870f43edd03";
        private const string StartupDependencySystemUserName = "管理员";
        private static readonly HashSet<string> AnonymousPlatformRuntimeEngineKeys = new HashSet<string>(StringComparer.Ordinal)
        {
            "platform-os-client-by-domain",
            "platform-sys-config",
            "platform-service-health",
            "platform-lang-bundle",
            "platform-login-wallpapers",
            // 旧移动端私人文件 Token 允许匿名进入可信原子重新验权；V8 代码中的
            // 登录用户 Hook 仍由身份门禁隔离，匿名请求绝不会执行租户代码。
            "platform-private-file-url",
            "microi-init"
        };
        private static readonly System.Version MinimumSsoPackageVersion = new System.Version(7, 5, 9);
        private static readonly System.Version MinimumSsoEngineVersion = new System.Version(1, 0, 3);
        private const string ManagedSsoNoticeMarker = "/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1";
        private const string TenantSsoNoticeMarker = "/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1";
        private const string SsoSafeHookPayloadMarker = "SSO_TENANT_HOOK_SAFE_PAYLOAD_V1";
        private const string DefaultSsoEventHookBody = "return { Code : 1 };";
        // 原 SSO Controller 的全部公开地址均属于官方应用资源。地址表同时作为
        // 升级门禁，防止包里只有接口 Key、却遗漏协议伙伴依赖的稳定 URL。
        private static readonly IReadOnlyDictionary<string, string> SsoHttpEndpointAddresses =
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                ["sso_http_begin"] = "/api/Sso/Begin",
                ["sso_http_complete_authorization"] = "/api/Sso/CompleteAuthorization",
                ["sso_http_oidc_callback"] = "/api/Sso/OidcCallback",
                ["sso_http_oidc_discovery"] = "/sso/{OsClient}/.well-known/openid-configuration",
                ["sso_http_oidc_jwks"] = "/sso/{OsClient}/jwks",
                ["sso_http_oidc_authorize"] = "/sso/{OsClient}/authorize",
                ["sso_http_oidc_token"] = "/sso/{OsClient}/token",
                ["sso_http_oidc_userinfo"] = "/sso/{OsClient}/userinfo",
                ["sso_http_oidc_introspect"] = "/sso/{OsClient}/introspect",
                ["sso_http_oidc_revoke"] = "/sso/{OsClient}/revoke",
                ["sso_http_oidc_logout"] = "/sso/{OsClient}/logout",
                ["sso_http_cas_callback"] = "/api/Sso/CasCallback",
                ["sso_http_cas_login"] = "/cas/{OsClient}/login",
                ["sso_http_cas_service_validate"] = "/cas/{OsClient}/serviceValidate",
                ["sso_http_cas_p3_service_validate"] = "/cas/{OsClient}/p3/serviceValidate",
                ["sso_http_cas_validate"] = "/cas/{OsClient}/validate",
                ["sso_http_cas_logout"] = "/cas/{OsClient}/logout",
                ["sso_http_saml_begin"] = "/api/Sso/SamlBegin",
                ["sso_http_saml_acs"] = "/api/Sso/SamlAcs",
                ["sso_http_saml_login"] = "/saml/{OsClient}/login",
                ["sso_http_saml_complete"] = "/api/Sso/SamlComplete",
                ["sso_http_saml_idp_metadata"] = "/saml/{OsClient}/metadata",
                ["sso_http_saml_sp_metadata"] = "/saml/{OsClient}/sp/{ConnectionKey}/metadata",
                ["sso_http_saml_logout"] = "/saml/{OsClient}/logout"
            };
        private static readonly string[] ManagedSsoEngineKeys = new[]
        {
            "sso_capabilities",
            "sso_legacy_capabilities",
            "sso_connection_runtime",
            "sso_resolve_federated_identity",
            "sso_protocol_event",
            "sso_outbound_claims",
            "sso_complete_login",
            "sso_rotate_client_secret",
            "sso_legacy_token_login",
            "sso_user_runtime"
        }.Concat(SsoHttpEndpointAddresses.Keys).ToArray();
        private static readonly string[] RequiredSsoEngineKeys =
            ManagedSsoEngineKeys.Concat(new[] { "sso_event_hook" }).ToArray();
        private static readonly HashSet<string> AnonymousSsoEngineKeys = new HashSet<string>(StringComparer.Ordinal)
        {
            "sso_capabilities",
            "sso_legacy_capabilities",
            "sso_complete_login",
            "sso_legacy_token_login",
            "sso_http_begin",
            "sso_http_oidc_callback",
            "sso_http_oidc_discovery",
            "sso_http_oidc_jwks",
            "sso_http_oidc_authorize",
            "sso_http_oidc_token",
            "sso_http_oidc_userinfo",
            "sso_http_oidc_introspect",
            "sso_http_oidc_revoke",
            "sso_http_oidc_logout",
            "sso_http_cas_callback",
            "sso_http_cas_login",
            "sso_http_cas_service_validate",
            "sso_http_cas_p3_service_validate",
            "sso_http_cas_validate",
            "sso_http_cas_logout",
            "sso_http_saml_begin",
            "sso_http_saml_acs",
            "sso_http_saml_login",
            "sso_http_saml_complete",
            "sso_http_saml_idp_metadata",
            "sso_http_saml_sp_metadata",
            "sso_http_saml_logout"
        };
        private static readonly HashSet<string> InternalOnlySsoEngineKeys = new HashSet<string>(StringComparer.Ordinal)
        {
            "sso_connection_runtime",
            "sso_resolve_federated_identity",
            "sso_protocol_event",
            "sso_event_hook",
            "sso_outbound_claims",
            "sso_user_runtime"
        };

        private static bool HasPinnedImporterCapabilities(string code, System.Version version)
        {
            return version != null
                && version >= MinimumPinnedImporterVersion
                && !code.DosIsNullOrWhiteSpace()
                && code.Contains("PACKAGE_REPLAY_VERSION_GUARD_V2")
                && code.Contains("PackagePointerMode: 'HdfsV1'")
                && code.Contains("PinCurrentVersion")
                && code.Contains("BACKGROUND_TASK_BOUNDED_PACKAGE_SLICES_V1")
                && code.Contains("GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_BATCH_V1")
                && code.Contains("GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_CHECKPOINT_V1")
                && code.Contains("PACKAGE_API_ENGINE_PHYSICAL_READBACK_FALLBACK_V1")
                && code.Contains("activeImportStage = '步骤2-字段定义'")
                && code.Contains("TableName: 'diy_field'")
                && code.Contains("['OsClient', textType(255)]")
                && code.Contains("TRUSTED_EMBEDDED_OFFICIAL_PACKAGE_V1")
                && code.Contains("PACKAGE_MANAGED_OVERWRITE_V2")
                && code.Contains("PACKAGE_API_ENGINE_IDENTITY_RECONCILIATION_V2")
                && code.Contains("PACKAGE_API_ENGINE_ROUTE_RECLAIM_V1")
                && code.Contains("V8.Method.RequireManagedProtocolContext");
        }

        private static bool HasPinnedBulkCapabilities(string code, System.Version version)
        {
            return version != null
                && version >= MinimumPinnedBulkVersion
                && !code.DosIsNullOrWhiteSpace()
                && code.Contains("BULK_BOUNDED_PACKAGE_SLICES_V1")
                && code.Contains("StoreVersionId")
                && code.Contains("BulkAdaptiveSingleSlice: false")
                && code.Contains("STARTUP_DEPENDENCY_RESOURCE_CLOSURE_V2")
                && code.Contains("STARTUP_DEPENDENCY_PREINSTALL_BOOTSTRAP_V1")
                && code.Contains("STARTUP_DEPENDENCY_BOOTSTRAP_ONLY_V1")
                && code.Contains("BULK_PACKAGE_MANAGED_OVERWRITE_RECOVERY_V1")
                && code.Contains("MARKETPLACE_LIST_ROUTE_FAILOVER_V1")
                && code.Contains("platform-sys-menu")
                && code.Contains("platform-sys-config");
        }

        private static bool HasPlatformBackgroundTaskCapabilities(string code, System.Version version)
        {
            return version != null
                && version >= MinimumPlatformBackgroundTaskVersion
                && !code.DosIsNullOrWhiteSpace()
                && code.Contains("V8.Method.ManageBackgroundTask(V8.Param)")
                && code.Contains("WorkerStatus")
                && code.Contains("RunApiEngine")
                && !code.Contains("V8.Db.FromSql");
        }

        private static bool HasPlatformSysMenuCapabilities(string code, System.Version version)
        {
            return version != null
                && version >= MinimumPlatformSysMenuVersion
                && !code.DosIsNullOrWhiteSpace()
                && code.Contains("V8.Method.ManageSystemDirectory")
                && code.Contains("Domain: 'SysMenu'")
                && code.Contains("GetSysMenuStep")
                && code.Contains("platform-marketplace-source-hook")
                && !code.Contains("V8.Db.FromSql");
        }

        private static bool HasExpectedPlatformRuntimeEngineContract(JObject engine, bool validateTenantTemplate)
        {
            if (engine == null) return false;
            var key = engine.Value<string>("ApiEngineKey") ?? string.Empty;

            // CreateIfMissing Hook 首次创建后即归租户维护。已安装租户只校验记录存在；
            // 禁用、改地址或改变内部调用策略都是租户自己的合法选择，升级器不能因为
            // 这些可变字段进入永久重装循环。只有嵌入的官方包模板需要校验安全默认值。
            if (string.Equals(key, PlatformRuntimeCustomHookEngineKey, StringComparison.OrdinalIgnoreCase))
            {
                if (!validateTenantTemplate) return true;
                var hookCode = engine.Value<string>("ApiV8Code") ?? string.Empty;
                return engine.Value<int?>("IsEnable") == 1
                    && engine.Value<int?>("StopHttp") == 1
                    && engine.Value<int?>("AllowAnonymous") == 0
                    && string.Equals(
                        engine.Value<string>("ApiAddress"),
                        "/apiengine/" + key,
                        StringComparison.OrdinalIgnoreCase)
                    && hookCode.TrimStart().StartsWith(TenantPlatformRuntimeNoticeMarker, StringComparison.Ordinal)
                    && string.Equals(
                        StripLeadingBlockComments(hookCode),
                        DefaultPlatformRuntimeHookBody,
                        StringComparison.Ordinal);
            }

            if (!ManagedPlatformRuntimeEngineKeys.Contains(key, StringComparer.Ordinal)) return false;
            var code = engine.Value<string>("ApiV8Code") ?? string.Empty;
            var metadataVersionText = engine.Value<string>("Version")?.TrimStart('v', 'V');
            var codeVersionMatch = Regex.Match(code, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
            var minimumEngineVersion = string.Equals(
                    key,
                    "platform-service-health",
                    StringComparison.Ordinal)
                ? MinimumPlatformServiceHealthEngineVersion
                : string.Equals(key, "platform-login-wallpapers", StringComparison.Ordinal)
                    ? MinimumPlatformLoginWallpapersEngineVersion
                    : string.Equals(key, "microi-init", StringComparison.Ordinal)
                        ? MinimumPlatformMicroiInitEngineVersion
                        : MinimumPlatformRuntimeEngineVersion;
            // 官方资源既有单引号也有双引号写法；门禁校验调用语义，不能因
            // JavaScript 等价引号风格把完整运行时包误判为缺失并反复重装。
            var callsRuntimeHook = code.Contains(
                                       "V8.ApiEngine.Run('" + PlatformRuntimeCustomHookEngineKey + "'",
                                       StringComparison.Ordinal)
                                   || code.Contains(
                                       "V8.ApiEngine.Run(\"" + PlatformRuntimeCustomHookEngineKey + "\"",
                                       StringComparison.Ordinal);
            var anonymousHookIsIdentityGuarded = string.Equals(
                    key,
                    "platform-private-file-url",
                    StringComparison.Ordinal)
                && callsRuntimeHook
                && code.IndexOf("!V8.CurrentUser || !V8.CurrentUser.Id", StringComparison.Ordinal) >= 0
                && code.IndexOf("!V8.CurrentUser || !V8.CurrentUser.Id", StringComparison.Ordinal)
                    < code.IndexOf(PlatformRuntimeCustomHookEngineKey, StringComparison.Ordinal);
            return System.Version.TryParse(metadataVersionText, out var metadataVersion)
                && metadataVersion >= minimumEngineVersion
                && codeVersionMatch.Success
                && System.Version.TryParse(codeVersionMatch.Groups[1].Value, out var codeVersion)
                && codeVersion >= minimumEngineVersion
                && engine.Value<int?>("IsEnable") == 1
                && engine.Value<int?>("StopHttp") == 0
                && engine.Value<int?>("AllowAnonymous") == (AnonymousPlatformRuntimeEngineKeys.Contains(key) ? 1 : 0)
                && string.Equals(
                    engine.Value<string>("ApiAddress"),
                    "/apiengine/" + key,
                    StringComparison.OrdinalIgnoreCase)
                && code.TrimStart().StartsWith(ManagedPlatformRuntimeNoticeMarker, StringComparison.Ordinal)
                && (!string.Equals(key, "platform-service-health", StringComparison.Ordinal)
                    || (code.Contains("V8.Method.GetBackendVersion()")
                        && code.Contains("Status: 'Healthy'")
                        && code.Contains("catch (versionError)")
                        && !code.Contains("V8.Db")))
                && (!string.Equals(key, "microi-init", StringComparison.Ordinal)
                    || (code.Contains("GetCurrentToken(rawToken, osClient)")
                        && code.Contains("RefreshLoginUser(")
                        && code.Contains("GetLegacyInitMenuTree(rawToken, osClient)")
                        && code.Contains("safeCurrentUserProjection")
                        && code.Contains("DataAppend: { OsClient: osClient }")
                        && !code.Contains("GetFormData({")
                        && !code.Contains("GetTableDataTree")))
                && (AnonymousPlatformRuntimeEngineKeys.Contains(key)
                    ? (!callsRuntimeHook || anonymousHookIsIdentityGuarded)
                    : callsRuntimeHook);
        }

        private static bool HasPackagedPlatformRuntime(JObject package)
        {
            var packageVersionText = package?["PackageInfo"]?["Version"]?.ToString()?.TrimStart('v', 'V');
            var engines = package?["SysApiEngines"] as JArray;
            if (package == null
                || !System.Version.TryParse(packageVersionText, out var packageVersion)
                || packageVersion < MinimumPlatformRuntimePackageVersion
                || engines == null
                || package["PackageInfo"]?["ApiEngineCount"]?.Value<int?>() != engines.Count)
            {
                return false;
            }

            var byKey = new Dictionary<string, JObject>(StringComparer.Ordinal);
            foreach (var engine in engines.Children<JObject>())
            {
                var key = engine.Value<string>("ApiEngineKey") ?? string.Empty;
                if (key.DosIsNullOrWhiteSpace() || byKey.ContainsKey(key)) return false;
                byKey[key] = engine;
            }

            var requiredCapabilities = package["PackageInfo"]?["RequiredPlatformCapabilities"] as JArray;
            if (requiredCapabilities?.Any(item => string.Equals(
                    item?.ToString(),
                    "Installer:DeclaredSaaSRuntimeApiClosureV1",
                    StringComparison.Ordinal)) != true)
            {
                return false;
            }
            foreach (var key in RequiredPlatformRuntimeEngineKeys)
            {
                if (!byKey.TryGetValue(key, out var engine)
                    || !HasExpectedPlatformRuntimeEngineContract(engine, validateTenantTemplate: true)
                    || requiredCapabilities?.Any(item => string.Equals(
                        item?.ToString(),
                        "ApiEngine:" + key,
                        StringComparison.Ordinal)) != true)
                {
                    return false;
                }

                var policy = package["ResourcePolicies"]?["ApiEngines"]?[key];
                var isTenantHook = string.Equals(key, PlatformRuntimeCustomHookEngineKey, StringComparison.Ordinal);
                if (!string.Equals(
                        policy?["UpgradePolicy"]?.ToString(),
                        isTenantHook ? "CreateIfMissing" : "Managed",
                        StringComparison.Ordinal)
                    || (isTenantHook && !string.Equals(
                        policy?["Ownership"]?.ToString(),
                        "Tenant",
                        StringComparison.Ordinal)))
                {
                    return false;
                }
            }

            return true;
        }

        private static string StripLeadingBlockComments(string source)
        {
            var body = (source ?? string.Empty).TrimStart();
            while (body.StartsWith("/*", StringComparison.Ordinal))
            {
                var end = body.IndexOf("*/", StringComparison.Ordinal);
                if (end < 0) break;
                body = body.Substring(end + 2).TrimStart();
            }
            return body.Trim();
        }

        private static bool HasExpectedSsoEngineContract(JObject engine, bool validateTenantTemplate)
        {
            if (engine == null) return false;
            var key = engine.Value<string>("ApiEngineKey") ?? string.Empty;
            var code = engine.Value<string>("ApiV8Code") ?? string.Empty;
            var versionText = engine.Value<string>("Version")?.TrimStart('v', 'V');
            var codeVersionMatch = Regex.Match(code, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
            var isHttpEndpoint = SsoHttpEndpointAddresses.TryGetValue(key, out var expectedApiAddress);
            if (!isHttpEndpoint) expectedApiAddress = "/apiengine/" + key;
            if (!System.Version.TryParse(versionText, out var metadataVersion)
                || metadataVersion < MinimumSsoEngineVersion
                || !codeVersionMatch.Success
                || !System.Version.TryParse(codeVersionMatch.Groups[1].Value, out var codeVersion)
                || codeVersion < MinimumSsoEngineVersion
                || engine.Value<int?>("IsEnable") != 1
                || !string.Equals(
                    engine.Value<string>("ApiAddress"),
                    expectedApiAddress,
                    StringComparison.OrdinalIgnoreCase)
                || engine.Value<int?>("AllowAnonymous") != (AnonymousSsoEngineKeys.Contains(key) ? 1 : 0)
                || engine.Value<int?>("StopHttp") != (InternalOnlySsoEngineKeys.Contains(key) ? 1 : 0)
                || (isHttpEndpoint && !string.Equals(
                    engine.Value<string>("ResponseType"), "HTTP", StringComparison.OrdinalIgnoreCase))
                || (isHttpEndpoint && !code.Contains("V8.Method.RunSsoProtocol", StringComparison.Ordinal)))
            {
                return false;
            }

            if (string.Equals(key, "sso_event_hook", StringComparison.Ordinal))
            {
                return code.TrimStart().StartsWith(TenantSsoNoticeMarker, StringComparison.Ordinal)
                    && (!validateTenantTemplate
                        || string.Equals(StripLeadingBlockComments(code), DefaultSsoEventHookBody, StringComparison.Ordinal));
            }

            var directlyCallsTenantHook = code.Contains("V8.ApiEngine.Run('sso_event_hook'")
                || code.Contains("V8.ApiEngine.Run(\"sso_event_hook\"");
            if (!code.TrimStart().StartsWith(ManagedSsoNoticeMarker, StringComparison.Ordinal)
                || (directlyCallsTenantHook != string.Equals(key, "sso_protocol_event", StringComparison.Ordinal)))
            {
                return false;
            }

            return !string.Equals(key, "sso_protocol_event", StringComparison.Ordinal)
                || code.Contains(SsoSafeHookPayloadMarker);
        }

        private static bool HasPackagedSsoRuntime(JObject package)
        {
            var packageVersionText = package?["PackageInfo"]?["Version"]?.ToString()?.TrimStart('v', 'V');
            if (package == null
                || !string.Equals(package["PackageInfo"]?["AppId"]?.ToString(), "app.microi.sso", StringComparison.Ordinal)
                || !string.Equals(package["PackageInfo"]?["ApplicationType"]?.ToString(), "Platform", StringComparison.Ordinal)
                || !System.Version.TryParse(packageVersionText, out var packageVersion)
                || packageVersion < MinimumSsoPackageVersion)
            {
                return false;
            }

            var engines = package["SysApiEngines"] as JArray;
            if (engines == null || engines.Count != RequiredSsoEngineKeys.Length) return false;
            var byKey = new Dictionary<string, JObject>(StringComparer.Ordinal);
            foreach (var engine in engines.Children<JObject>())
            {
                var key = engine.Value<string>("ApiEngineKey") ?? string.Empty;
                if (key.DosIsNullOrWhiteSpace() || byKey.ContainsKey(key)) return false;
                byKey[key] = engine;
            }

            foreach (var key in RequiredSsoEngineKeys)
            {
                if (!byKey.TryGetValue(key, out var engine)
                    || !HasExpectedSsoEngineContract(engine, validateTenantTemplate: true))
                {
                    return false;
                }

                var policy = package["ResourcePolicies"]?["ApiEngines"]?[key];
                var isTenantHook = string.Equals(key, "sso_event_hook", StringComparison.Ordinal);
                if (!string.Equals(
                        policy?["Ownership"]?.ToString(),
                        isTenantHook ? "Tenant" : "Platform",
                        StringComparison.Ordinal)
                    || !string.Equals(
                        policy?["UpgradePolicy"]?.ToString(),
                        isTenantHook ? "CreateIfMissing" : "Managed",
                        StringComparison.Ordinal))
                {
                    return false;
                }
            }
            var capabilities = package["PackageInfo"]?["RequiredPlatformCapabilities"] as JArray;
            foreach (var capability in new[]
                     {
                         "ApiEngine:ResponseType=HTTP",
                         "ApiEngine:TemplateRouteV1",
                         "V8.Method.RunSsoProtocol"
                     })
            {
                if (capabilities?.Any(item => string.Equals(
                        item?.ToString(), capability, StringComparison.Ordinal)) != true)
                    return false;
            }
            return true;
        }

        private static readonly Dictionary<string, System.Version> V8FirstPackageMinimumVersions =
            new Dictionary<string, System.Version>(StringComparer.Ordinal)
            {
                { SysUserPackageResourceName, new System.Version(7, 6, 2) },
                { SysConfigPackageResourceName, new System.Version(6, 3, 9) },
                { MessageNotificationPackageResourceName, new System.Version(1, 0, 14) },
                { AiEnginePackageResourceName, new System.Version(7, 6, 1) },
                { SaaSEnginePackageResourceName, new System.Version(7, 7, 8) },
                { AppStorePackageResourceName, new System.Version(7, 7, 15) }
            };

        private static readonly Dictionary<string, string[]> V8FirstPackageExactEngineKeys =
            new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                {
                    SysUserPackageResourceName,
                    new[]
                    {
                        "platform-user-update-preferences",
                        "user-module-table-preference",
                        "sys-user-security-action",
                        "platform-user-update-profile",
                        "platform-sys-user-admin",
                        "platform-user-access-key",
                        "platform-user-custom-hook"
                    }
                },
                {
                    SysConfigPackageResourceName,
                    new[]
                    {
                        "platform-tenant-system-settings",
                        "platform-system-settings-custom-hook"
                    }
                },
                {
                    MessageNotificationPackageResourceName,
                    new[]
                    {
                        "msg_event",
                        "msg_internal_list",
                        "msg_internal_mark_read",
                        "platform-chat-system-message",
                        "platform-chat-runtime",
                        "platform-message-notification-custom-hook",
                        "wechat_send_tpl_msg"
                    }
                },
                {
                    AiEnginePackageResourceName,
                    new[]
                    {
                        "mci_ai_data_assistant",
                        "platform-ai-account",
                        "platform-ai-runtime",
                        "platform-ai-custom-hook"
                    }
                }
            };

        private static readonly Dictionary<string, string> V8FirstTenantHookKeys =
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                { SysUserPackageResourceName, "platform-user-custom-hook" },
                { SysConfigPackageResourceName, "platform-system-settings-custom-hook" },
                { MessageNotificationPackageResourceName, "platform-message-notification-custom-hook" },
                { AiEnginePackageResourceName, "platform-ai-custom-hook" },
                { AppStorePackageResourceName, "platform-marketplace-source-hook" }
            };

        private static bool HasExpectedOfficialEnginePolicy(
            JObject package,
            JObject engine,
            bool isTenantHook)
        {
            var key = engine?.Value<string>("ApiEngineKey") ?? string.Empty;
            var code = engine?.Value<string>("ApiV8Code") ?? string.Empty;
            var policy = package?["ResourcePolicies"]?["ApiEngines"]?[key];
            if (key.DosIsNullOrWhiteSpace()
                || engine?.Value<int?>("IsEnable") != 1
                || !string.Equals(
                    policy?["UpgradePolicy"]?.ToString(),
                    isTenantHook ? "CreateIfMissing" : "Managed",
                    StringComparison.Ordinal))
            {
                return false;
            }

            if (isTenantHook)
            {
                return engine.Value<int?>("StopHttp") == 1
                    && string.Equals(policy?["Ownership"]?.ToString(), "Tenant", StringComparison.Ordinal)
                    && code.TrimStart().StartsWith(TenantPlatformRuntimeNoticeMarker, StringComparison.Ordinal)
                    && string.Equals(
                        StripLeadingBlockComments(code),
                        DefaultPlatformRuntimeHookBody,
                        StringComparison.Ordinal);
            }

            var ownership = policy?["Ownership"]?.ToString();
            return string.Equals(ownership, "Platform", StringComparison.Ordinal)
                && code.TrimStart().StartsWith(ManagedPlatformRuntimeNoticeMarker, StringComparison.Ordinal);
        }

        private static bool HasPackagedTableClosure(
            JObject package,
            IEnumerable<string> requiredTableNames,
            IEnumerable<string> forbiddenTableNames)
        {
            var tables = package?["DiyTables"] as JArray ?? new JArray();
            var fields = package?["DiyFields"] as JArray ?? new JArray();
            var ddls = package?["DDLStatements"] as JArray ?? new JArray();
            var physicalColumns = package?["PhysicalColumns"] as JArray ?? new JArray();
            foreach (var tableName in requiredTableNames)
            {
                if (tables.Children<JObject>().Count(row => string.Equals(
                        row.Value<string>("Name"), tableName, StringComparison.OrdinalIgnoreCase)) != 1
                    || ddls.Children<JObject>().Count(row => string.Equals(
                        row.Value<string>("TableName"), tableName, StringComparison.OrdinalIgnoreCase)) != 1
                    || !ddls.Children<JObject>().Any(row => string.Equals(
                            row.Value<string>("TableName"), tableName, StringComparison.OrdinalIgnoreCase)
                        && (row.Value<string>("DDL") ?? string.Empty).IndexOf(
                            "CREATE TABLE IF NOT EXISTS `" + tableName + "`",
                            StringComparison.OrdinalIgnoreCase) >= 0)
                    || !fields.Children<JObject>().Any(row => string.Equals(
                        row.Value<string>("TableName"), tableName, StringComparison.OrdinalIgnoreCase))
                    || !physicalColumns.Children<JObject>().Any(row => string.Equals(
                        row.Value<string>("TABLE_NAME"), tableName, StringComparison.OrdinalIgnoreCase)))
                {
                    return false;
                }
            }

            foreach (var tableName in forbiddenTableNames)
            {
                if (tables.Children<JObject>().Any(row => string.Equals(
                        row.Value<string>("Name"), tableName, StringComparison.OrdinalIgnoreCase))
                    || fields.Children<JObject>().Any(row => string.Equals(
                        row.Value<string>("TableName"), tableName, StringComparison.OrdinalIgnoreCase))
                    || ddls.Children<JObject>().Any(row => string.Equals(
                        row.Value<string>("TableName"), tableName, StringComparison.OrdinalIgnoreCase))
                    || physicalColumns.Children<JObject>().Any(row => string.Equals(
                        row.Value<string>("TABLE_NAME"), tableName, StringComparison.OrdinalIgnoreCase)))
                {
                    return false;
                }
            }
            return true;
        }

        private static bool HasPackagedSysUserAiApiKeySchema(JObject package)
        {
            var fields = package?["DiyFields"] as JArray ?? new JArray();
            var ddls = package?["DDLStatements"] as JArray ?? new JArray();
            var physicalColumns = package?["PhysicalColumns"] as JArray ?? new JArray();
            var fieldRows = fields.Children<JObject>().Where(row =>
                string.Equals(row.Value<string>("TableName"), "sys_user", StringComparison.OrdinalIgnoreCase)
                && string.Equals(row.Value<string>("Name"), "AiApiKey", StringComparison.OrdinalIgnoreCase)).ToArray();
            return fieldRows.Length == 1
                && fieldRows[0].Value<int?>("Visible") == 0
                && fieldRows[0].Value<int?>("AppVisible") == 0
                && fieldRows[0].Value<int?>("Readonly") == 1
                && physicalColumns.Children<JObject>().Count(row =>
                    string.Equals(row.Value<string>("TABLE_NAME"), "sys_user", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(row.Value<string>("COLUMN_NAME"), "AiApiKey", StringComparison.OrdinalIgnoreCase)) == 1
                && ddls.Children<JObject>().Any(row =>
                    string.Equals(row.Value<string>("TableName"), "sys_user", StringComparison.OrdinalIgnoreCase)
                    && Regex.IsMatch(row.Value<string>("DDL") ?? string.Empty, @"`AiApiKey`\s+varchar\(200\)", RegexOptions.IgnoreCase));
        }

        private static bool HasPackagedV8FirstApplicationRuntime(string resourceName, JObject package)
        {
            if (!V8FirstPackageMinimumVersions.TryGetValue(resourceName, out var minimumVersion))
            {
                return true;
            }
            var packageVersionText = package?["PackageInfo"]?["Version"]?.ToString()?.TrimStart('v', 'V');
            if (!System.Version.TryParse(packageVersionText, out var packageVersion)
                || packageVersion < minimumVersion)
            {
                return false;
            }

            var engines = package?["SysApiEngines"] as JArray ?? new JArray();
            var byKey = new Dictionary<string, JObject>(StringComparer.Ordinal);
            foreach (var engine in engines.Children<JObject>())
            {
                var key = engine.Value<string>("ApiEngineKey") ?? string.Empty;
                if (key.DosIsNullOrWhiteSpace() || byKey.ContainsKey(key)) return false;
                byKey[key] = engine;
            }

            if (V8FirstPackageExactEngineKeys.TryGetValue(resourceName, out var exactKeys))
            {
                if (byKey.Count != exactKeys.Length) return false;
                var tenantHookKey = V8FirstTenantHookKeys[resourceName];
                foreach (var key in exactKeys)
                {
                    if (!byKey.TryGetValue(key, out var engine)
                        || !HasExpectedOfficialEnginePolicy(
                            package,
                            engine,
                            string.Equals(key, tenantHookKey, StringComparison.Ordinal)))
                    {
                        return false;
                    }
                }
            }

            if (string.Equals(resourceName, SaaSEnginePackageResourceName, StringComparison.Ordinal))
            {
                foreach (var key in new[]
                {
                    "platform-create-tenant",
                    "platform-external-login-binding",
                    "platform-wechat-user-binding"
                })
                {
                    if (!byKey.TryGetValue(key, out var engine)
                        || !HasExpectedOfficialEnginePolicy(package, engine, false)
                        || !(engine.Value<string>("ApiV8Code") ?? string.Empty).Contains("platform-runtime-custom-hook")
                        || ((string.Equals(key, "platform-external-login-binding", StringComparison.Ordinal)
                                || string.Equals(key, "platform-wechat-user-binding", StringComparison.Ordinal))
                            && engine.Value<int?>("Lock") != 1))
                    {
                        return false;
                    }
                }
                if (byKey.ContainsKey("platform-user-update-preferences")
                    || byKey.ContainsKey("platform-sys-menu"))
                {
                    return false;
                }
            }

            if (string.Equals(resourceName, AppStorePackageResourceName, StringComparison.Ordinal))
            {
                var requiredCapabilities = package["PackageInfo"]?["RequiredPlatformCapabilities"] as JArray
                    ?? new JArray();
                var deliveredCapabilities = package["PackageInfo"]?["Capabilities"] as JArray
                    ?? new JArray();
                var hasPackageStorage = byKey.TryGetValue("microi-store-package-storage", out var packageStorageEngine);
                var packageStorageVersionText = (packageStorageEngine?.Value<string>("Version") ?? string.Empty)
                    .TrimStart('v', 'V');
                var packageStorageCode = packageStorageEngine?.Value<string>("ApiV8Code") ?? string.Empty;
                if (!byKey.TryGetValue("get-microi-upgrade-resource", out var officialResourceEngine)
                    || !System.Version.TryParse(
                        (officialResourceEngine.Value<string>("Version") ?? string.Empty).TrimStart('v', 'V'),
                        out var officialResourceVersion)
                    || officialResourceVersion < new System.Version(1, 2, 8)
                    || officialResourceEngine.Value<int?>("AllowAnonymous") != 1
                    || !HasExpectedOfficialEnginePolicy(package, officialResourceEngine, false)
                    || !(officialResourceEngine.Value<string>("ApiV8Code") ?? string.Empty)
                        .Contains("V8.Method.AuthorizeOfficialResourcePublish()")
                    || !requiredCapabilities.Any(item => string.Equals(
                        item?.ToString(),
                        "V8.Method.AuthorizeOfficialResourcePublish",
                        StringComparison.Ordinal))
                    || !HasApiEngineCapabilityAtLeast(
                        requiredCapabilities,
                        OfficialResourcePublisherEngineKey,
                        new System.Version(1, 2, 8))
                    || !hasPackageStorage
                    || !System.Version.TryParse(packageStorageVersionText, out var packageStorageVersion)
                    || packageStorageVersion < new System.Version(1, 1, 0)
                    || packageStorageEngine.Value<int?>("StopHttp") != 1
                    || !HasExpectedOfficialEnginePolicy(package, packageStorageEngine, false)
                    || !packageStorageCode.Contains("MARKETPLACE_PACKAGE_UPLOAD_BASE64_SINGLE_ATTEMPT_V1")
                    || packageStorageCode.Contains("V8.Method.UploadText(")
                    || !HasApiEngineCapabilityAtLeast(
                        deliveredCapabilities,
                        "microi-store-package-storage",
                        new System.Version(1, 1, 0))
                    || !byKey.TryGetValue("platform-marketplace-source", out var sourceEngine)
                    || !byKey.TryGetValue("platform-marketplace-source-hook", out var sourceHook)
                    || !HasExpectedOfficialEnginePolicy(package, sourceEngine, false)
                    || !HasExpectedOfficialEnginePolicy(package, sourceHook, true)
                    || !(sourceEngine.Value<string>("ApiV8Code") ?? string.Empty).Contains("platform-marketplace-source-hook")
                    || !byKey.TryGetValue("get-microi-store-legacy-route", out var legacyStoreRoute)
                    || !string.Equals(
                        legacyStoreRoute.Value<string>("ApiAddress"),
                        "/apiengine/get-microi-store",
                        StringComparison.OrdinalIgnoreCase)
                    || legacyStoreRoute.Value<int?>("AllowAnonymous") != 1
                    || !HasExpectedOfficialEnginePolicy(package, legacyStoreRoute, false)
                    || !(legacyStoreRoute.Value<string>("ApiV8Code") ?? string.Empty)
                        .Contains("V8.ApiEngine.Run('get-microi-store'")
                    || !HasApiEngineCapabilityAtLeast(
                        requiredCapabilities,
                        "get-microi-store-legacy-route",
                        new System.Version(1, 0, 0))
                    || byKey.ContainsKey("platform-user-update-preferences"))
                {
                    return false;
                }
            }

            if (string.Equals(resourceName, SysUserPackageResourceName, StringComparison.Ordinal))
            {
                var adminEngine = byKey["platform-sys-user-admin"];
                var adminCode = adminEngine.Value<string>("ApiV8Code") ?? string.Empty;
                var adminVersionText = (adminEngine.Value<string>("Version") ?? string.Empty)
                    .TrimStart('v', 'V');
                var capabilities = package["PackageInfo"]?["RequiredPlatformCapabilities"] as JArray
                    ?? new JArray();
                return System.Version.TryParse(adminVersionText, out var adminVersion)
                    && adminVersion >= new System.Version(1, 0, 2)
                    && capabilities.Any(item => string.Equals(
                        item?.ToString(),
                        "ApiEngine:platform-sys-user-admin@v1.0.2",
                        StringComparison.Ordinal))
                    && (byKey["platform-user-update-preferences"].Value<string>("ApiV8Code") ?? string.Empty).Contains("platform-user-custom-hook")
                    && (byKey["platform-user-update-profile"].Value<string>("ApiV8Code") ?? string.Empty).Contains("platform-user-custom-hook")
                    && adminCode.Contains("V8.Method.ManageSysUserAdmin")
                    && adminCode.Contains("platform-user-custom-hook")
                    && adminCode.Contains("authorization.DataAppend.ChangesPassword === true")
                    && (byKey["platform-user-access-key"].Value<string>("ApiV8Code") ?? string.Empty)
                        .Contains("V8.Method.ManageUserAccessKey")
                    && (byKey["platform-user-access-key"].Value<string>("ApiRoutes") ?? string.Empty)
                        .Contains("/api/SysUserAccessKey/Create")
                    && HasPackagedSysUserAiApiKeySchema(package);
            }
            if (string.Equals(resourceName, SysConfigPackageResourceName, StringComparison.Ordinal))
            {
                return (byKey["platform-tenant-system-settings"].Value<string>("ApiV8Code") ?? string.Empty).Contains("platform-system-settings-custom-hook");
            }
            if (string.Equals(resourceName, MessageNotificationPackageResourceName, StringComparison.Ordinal))
            {
                var systemCode = byKey["platform-chat-system-message"].Value<string>("ApiV8Code") ?? string.Empty;
                var runtimeCode = byKey["platform-chat-runtime"].Value<string>("ApiV8Code") ?? string.Empty;
                var wechatCode = byKey["wechat_send_tpl_msg"].Value<string>("ApiV8Code") ?? string.Empty;
                var runtimeVersionText = (byKey["platform-chat-runtime"].Value<string>("Version") ?? string.Empty)
                    .TrimStart('v', 'V');
                var capabilities = package["PackageInfo"]?["RequiredPlatformCapabilities"] as JArray
                    ?? new JArray();
                return systemCode.Contains("platform-chat-runtime")
                    && System.Version.TryParse(runtimeVersionText, out var runtimeVersion)
                    && runtimeVersion >= new System.Version(1, 0, 2)
                    && capabilities.Any(item => string.Equals(
                        item?.ToString(),
                        "ApiEngine:platform-chat-runtime@v1.0.2",
                        StringComparison.Ordinal))
                    && capabilities.Any(item => string.Equals(
                        item?.ToString(),
                        "V8.Method.RequireManagedProtocolContext",
                        StringComparison.Ordinal))
                    && runtimeCode.Contains("CHAT_SIGNALR_TRUSTED_PROTOCOL_V1")
                    && runtimeCode.Contains("PLATFORM_CHAT_LOCAL_TIME_V1")
                    && runtimeCode.Contains("RequireManagedProtocolContext")
                    && runtimeCode.Contains("platform-message-notification-custom-hook")
                    && runtimeCode.Contains("V8.MongoDb.UptFormDataByWhere")
                    && runtimeCode.Contains("V8.MongoDb.DelFormDataByWhere")
                    && wechatCode.Contains("platform-message-notification-custom-hook")
                    && wechatCode.Contains("V8.Method.SendWeChatTemplateMessage")
                    && capabilities.Any(item => string.Equals(
                        item?.ToString(),
                        "ApiEngine:wechat_send_tpl_msg@v1.0.0",
                        StringComparison.Ordinal))
                    && capabilities.Any(item => string.Equals(
                        item?.ToString(),
                        "V8.Method.SendWeChatTemplateMessage",
                        StringComparison.Ordinal));
            }
            if (string.Equals(resourceName, AiEnginePackageResourceName, StringComparison.Ordinal))
            {
                var assistantCode = byKey["mci_ai_data_assistant"].Value<string>("ApiV8Code") ?? string.Empty;
                var accountCode = byKey["platform-ai-account"].Value<string>("ApiV8Code") ?? string.Empty;
                var runtimeCode = byKey["platform-ai-runtime"].Value<string>("ApiV8Code") ?? string.Empty;
                var accountVersionText = (byKey["platform-ai-account"].Value<string>("Version") ?? string.Empty)
                    .TrimStart('v', 'V');
                var runtimeVersionText = (byKey["platform-ai-runtime"].Value<string>("Version") ?? string.Empty)
                    .TrimStart('v', 'V');
                var aiCapabilities = package["PackageInfo"]?["RequiredPlatformCapabilities"] as JArray
                    ?? new JArray();
                return assistantCode.Contains("AI_DATA_ASSISTANT_SAFE_TENANT_HOOK_V1")
                    && assistantCode.Contains("platform-ai-custom-hook")
                    && accountCode.Contains("platform-ai-custom-hook")
                    && accountCode.Contains("PAYMENT_COMPLETE_MANAGED_V1")
                    && accountCode.Contains("RequireManagedProtocolContext")
                    && runtimeCode.Contains("AI_RUNTIME_MANAGED_NON_STREAM_V1")
                    && runtimeCode.Contains("platform-ai-custom-hook")
                    && runtimeCode.Contains("V8.AI.Chat")
                    && runtimeCode.Contains("V8.AI.NL2SQL")
                    && runtimeCode.Contains("V8.AI.NL2V8")
                    && System.Version.TryParse(accountVersionText, out var accountVersion)
                    && accountVersion >= new System.Version(1, 1, 0)
                    && System.Version.TryParse(runtimeVersionText, out var runtimeVersion)
                    && runtimeVersion >= new System.Version(1, 0, 0)
                    && new[]
                    {
                        "ApiEngine:platform-ai-account@v1.1.0",
                        "ApiEngine:platform-ai-runtime@v1.0.0",
                        "V8.Method.RequireManagedProtocolContext",
                        "V8.AI.UpdateConversationTitle",
                        "V8.AI.Chat",
                        "V8.AI.RecognizeIntent",
                        "V8.AI.NL2SQL",
                        "V8.AI.NL2V8"
                    }.All(required => aiCapabilities.Any(item => string.Equals(
                        item?.ToString(),
                        required,
                        StringComparison.Ordinal)))
                    && HasPackagedTableClosure(
                        package,
                        new[]
                        {
                            "mic_sub_provider", "mic_sub_model", "mic_sub_plan", "mic_sub_order",
                            "mic_sub_user", "mic_sub_usage", "mic_sub_alipay_config", "mic_sub_apikey",
                            "mic_sub_apikey_binduser", "mci_ai_token_account", "mci_ai_token_log"
                        },
                        new[] { "mci_ai_app_version", "mci_ai_app_file", "sys_microistore", "sys_user" })
                    && (package["PhysicalColumns"] as JArray)?.Children<JObject>().Count(row =>
                        string.Equals(row.Value<string>("TABLE_NAME"), "mci_ai_token_log", StringComparison.OrdinalIgnoreCase)
                        && string.Equals(row.Value<string>("COLUMN_NAME"), "PromptPreview", StringComparison.OrdinalIgnoreCase)) == 1;
            }

            return true;
        }

        private static bool HasApiEngineCapabilityAtLeast(
            JArray capabilities,
            string apiEngineKey,
            System.Version minimumVersion)
        {
            if (capabilities == null || apiEngineKey.DosIsNullOrWhiteSpace() || minimumVersion == null)
            {
                return false;
            }

            var prefix = "ApiEngine:" + apiEngineKey + "@";
            foreach (var item in capabilities)
            {
                var capability = item?.ToString() ?? string.Empty;
                if (!capability.StartsWith(prefix, StringComparison.Ordinal))
                {
                    continue;
                }

                var versionText = capability.Substring(prefix.Length).TrimStart('v', 'V');
                if (System.Version.TryParse(versionText, out var version)
                    && version >= minimumVersion)
                {
                    return true;
                }
            }
            return false;
        }

        private static readonly string[] RequiredResourceNames =
        {
            ImportPackageResourceName,
            PublishAiAppResourceName,
            BuildAiAppResourceName,
            FormEnginePackageResourceName,
            ModuleEnginePackageResourceName,
            SaaSEnginePackageResourceName,
            SsoPackageResourceName,
            AppStorePackageResourceName,
            SysUserPackageResourceName,
            SysConfigPackageResourceName,
            MessageNotificationPackageResourceName,
            AiEnginePackageResourceName
        };

        private static readonly Dictionary<string, string> ExpectedPackageNames = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            { FormEnginePackageResourceName, "表单引擎" },
            { ModuleEnginePackageResourceName, "模块引擎" },
            { SaaSEnginePackageResourceName, "SaaS引擎" },
            { SsoPackageResourceName, "SSO 身份联邦" },
            { AppStorePackageResourceName, "应用商城" },
            { SysUserPackageResourceName, "系统账号" },
            { SysConfigPackageResourceName, "系统设置" },
            { MessageNotificationPackageResourceName, "消息通知" },
            { AiEnginePackageResourceName, "AI助手" }
        };

        /// <summary>
        /// 全局数据库版本可能已经高于本升级号，但租户库中的导入器仍可能因历史应用包覆盖而停留在旧版。
        /// 因此必须单独检查导入器能力标记，不能只依赖 SysConfig.Version。
        /// </summary>
        public static Task<bool> NeedRefreshAsync(string osClient)
        {
            if (IsOfficialSourceTenant(osClient))
            {
                Console.WriteLine($"Microi：【基础应用升级】租户[{osClient}]是吾码官方应用源，跳过基础应用包完整性回写检查。");
                return Task.FromResult(false);
            }

            try
            {
                // 老库的物理表与 diy_table/diy_field 元数据经常不同步。启动完整性判断如果继续走
                // FormEngine，会把“物理数据存在但元数据缺失”误判为需要升级并在每次启动重复导入。
                // 这里仅做参数化只读查询，以物理表事实为准；任何缺表/缺列异常仍安全地触发修复。
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null) return RefreshRequired(osClient, "未找到租户数据库连接");

                var code = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "import-microi-store-package")
                    .ToScalar()?.ToString() ?? string.Empty;
                var importerLimitMemoryText = client.Db.FromSql(@"SELECT LimitMemory FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "import-microi-store-package")
                    .ToScalar()?.ToString();
                var importerLimitRecursionText = client.Db.FromSql(@"SELECT LimitRecursion FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "import-microi-store-package")
                    .ToScalar()?.ToString();
                var versionMatch = Regex.Match(code, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                var importerVersion = new System.Version(0, 0, 0);
                if (!versionMatch.Success ||
                    !System.Version.TryParse(versionMatch.Groups[1].Value, out importerVersion) ||
                    !HasPinnedImporterCapabilities(code, importerVersion) ||
                    !long.TryParse(importerLimitMemoryText, out var importerLimitMemory) ||
                    importerLimitMemory < ImporterLimitMemoryMb ||
                    !long.TryParse(importerLimitRecursionText, out var importerLimitRecursion) ||
                    importerLimitRecursion != PrivilegedEngineLimitRecursion ||
                    !code.Contains("field_primary_recovered_") ||
                    !code.Contains("rename_skipped_target_exists_") ||
                    !code.Contains("preserve_interface_engine_pagetabs_") ||
                    !code.Contains("System.DateTime.Now.ToString") ||
                    !code.Contains("applicationSha256Base64") ||
                    !code.Contains("REMOTE_ZIP_SINGLE_ASSET_SLICE_V1") ||
                    !code.Contains("SharedPublicRuntime") ||
                    !code.Contains("MicroServiceMenusPreserved") ||
                    !code.Contains("sourceExpected") ||
                    !code.Contains("validationSourceExpected") ||
                    !code.Contains("stableMenuUrl") ||
                    !code.Contains("normalizeRouteMeta") ||
                    !code.Contains("recoverBoundMicroserviceMenus") ||
                    !code.Contains("preservedLegacyUrl") ||
                    !code.Contains("preserve_existing_menu_visibility_") ||
                    !code.Contains("upsertApplicationRow('sys_microistore'") ||
                    !code.Contains("official_marketplace_install_stat") ||
                    !code.Contains("SKIP_MOVE_FOR_REUSED_BUILD_V1") ||
                    !code.Contains("MICRO_APP_PUBLIC_HDFS_PATH_V1") ||
                    !code.Contains("DB_RUNTIME_BUILD_ASSETS_V1") ||
                    !code.Contains("PRUNE_ASSET_IDS_WITH_DELFORM_V1") ||
                    !code.Contains("BACKGROUND_TASK_BOOTSTRAP_READINESS_V1") ||
                    !code.Contains("BACKGROUND_TASK_RUNTIME_SCOPE_V1") ||
                    !code.Contains("APPLICATION_ASSET_BACKGROUND_CHUNKS_V1") ||
                    !code.Contains("ASSET_METADATA_WITHOUT_SECOND_DECODE_V1") ||
                    !code.Contains("DATASET_INSERT_IF_MISSING_V1") ||
                    !code.Contains("PACKAGE_API_ENGINE_READBACK_V1") ||
                    !code.Contains("API_ENGINE_RESOURCE_BASELINE_V1") ||
                    !code.Contains("TRUSTED_OFFICIAL_PLATFORM_PACKAGE_V1") ||
                    !code.Contains("PACKAGE_MANAGED_OVERWRITE_V2") ||
                    !code.Contains("PACKAGE_API_ENGINE_IDENTITY_RECONCILIATION_V2") ||
                    !code.Contains("GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_V1") ||
                    !code.Contains("DATABASE_ONLY_BUILD_ASSETS_V1") ||
                    !code.Contains("BACKGROUND_TASK_MONOTONIC_PROGRESS_V1") ||
                    !code.Contains("BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1") ||
                    !code.Contains("OBJECT_STORAGE_FORBIDDEN") ||
                    !code.Contains("SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1") ||
                    !code.Contains("LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1") ||
                    !code.Contains("MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1") ||
                    !code.Contains("ADMIN_MENU_PERMISSION_V1") ||
                    !code.Contains("ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1") ||
                    !code.Contains("ADMIN_MENU_PERMISSION_DB_TIME_V1"))
                {
                    return RefreshRequired(osClient, "应用数据包导入器缺失或版本过低");
                }

                // 页面级按钮与依赖接口必须一起存在。历史包曾只更新 PageBtns，却没有
                // 把 bulk-import-microi-store-packages 写入目标租户；ServerVersion 与
                // sys_microistoreversion 都不能证明这个运行时依赖已经落库。
                var bulkEngineRow = client.Db.FromSql(@"SELECT ApiV8Code, IsEnable, StopHttp FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "bulk-import-microi-store-packages")
                    .First<dynamic>();
                var bulkEngine = bulkEngineRow == null ? null : JObject.FromObject(bulkEngineRow);
                var bulkCode = bulkEngine?.Value<string>("ApiV8Code") ?? string.Empty;
                var bulkVersionMatch = Regex.Match(bulkCode, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                var bulkVersion = new System.Version(0, 0, 0);
                if (bulkEngine == null
                    || !bulkVersionMatch.Success
                    || !System.Version.TryParse(bulkVersionMatch.Groups[1].Value, out bulkVersion)
                    || !HasPinnedBulkCapabilities(bulkCode, bulkVersion)
                    || bulkEngine.Value<int?>("IsEnable") != 1
                    || bulkEngine.Value<int?>("StopHttp") != 0
                    || !bulkCode.Contains("BACKGROUND_TASK_CHECKPOINT_PLAN_V2")
                    || !bulkCode.Contains("BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1")
                    || !bulkCode.Contains("BULK_STORAGE_FAILURE_RECOVERY_V1")
                    || !bulkCode.Contains("BULK_MONOTONIC_CHILD_PROGRESS_V1"))
                {
                    return RefreshRequired(osClient, "应用商城全部安装/更新接口缺失或版本过低");
                }

                var backgroundTaskEngineRow = client.Db.FromSql(@"SELECT ApiV8Code, ApiAddress, IsEnable, StopHttp, AllowAnonymous FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", PlatformBackgroundTaskEngineKey)
                    .First<dynamic>();
                var backgroundTaskEngine = backgroundTaskEngineRow == null
                    ? null
                    : JObject.FromObject(backgroundTaskEngineRow);
                var backgroundTaskCode = backgroundTaskEngine?.Value<string>("ApiV8Code") ?? string.Empty;
                var backgroundTaskVersionMatch = Regex.Match(
                    backgroundTaskCode,
                    @"Version\s*:\s*v?(\d+\.\d+\.\d+)",
                    RegexOptions.IgnoreCase);
                var backgroundTaskVersion = new System.Version(0, 0, 0);
                if (backgroundTaskEngine == null
                    || !backgroundTaskVersionMatch.Success
                    || !System.Version.TryParse(backgroundTaskVersionMatch.Groups[1].Value, out backgroundTaskVersion)
                    || !HasPlatformBackgroundTaskCapabilities(backgroundTaskCode, backgroundTaskVersion)
                    || !string.Equals(
                        backgroundTaskEngine.Value<string>("ApiAddress"),
                        PlatformBackgroundTaskApiAddress,
                        StringComparison.OrdinalIgnoreCase)
                    || backgroundTaskEngine.Value<int?>("IsEnable") != 1
                    || backgroundTaskEngine.Value<int?>("StopHttp") != 0
                    || backgroundTaskEngine.Value<int?>("AllowAnonymous") != 0)
                {
                    return RefreshRequired(osClient, "平台后台任务接口缺失或版本过低");
                }

                // platform-sys-menu 是前端登录后构建路由的启动前置依赖，由安装顺序
                // 最前的应用商城包单一交付。不能只验证 SaaS 包中的匿名系统设置接口，
                // 否则旧租户会在进入应用商城之前就因菜单接口不存在而全站不可用。
                var sysMenuEngineRow = client.Db.FromSql(@"SELECT ApiV8Code, ApiAddress, IsEnable, StopHttp, AllowAnonymous FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", PlatformSysMenuEngineKey)
                    .First<dynamic>();
                var sysMenuEngine = sysMenuEngineRow == null
                    ? null
                    : JObject.FromObject(sysMenuEngineRow);
                var sysMenuCode = sysMenuEngine?.Value<string>("ApiV8Code") ?? string.Empty;
                var sysMenuVersionMatch = Regex.Match(
                    sysMenuCode,
                    @"Version\s*:\s*v?(\d+\.\d+\.\d+)",
                    RegexOptions.IgnoreCase);
                var sysMenuVersion = new System.Version(0, 0, 0);
                if (sysMenuEngine == null
                    || !sysMenuVersionMatch.Success
                    || !System.Version.TryParse(sysMenuVersionMatch.Groups[1].Value, out sysMenuVersion)
                    || !HasPlatformSysMenuCapabilities(sysMenuCode, sysMenuVersion)
                    || !string.Equals(
                        sysMenuEngine.Value<string>("ApiAddress"),
                        PlatformSysMenuApiAddress,
                        StringComparison.OrdinalIgnoreCase)
                    || sysMenuEngine.Value<int?>("IsEnable") != 1
                    || sysMenuEngine.Value<int?>("StopHttp") != 0
                    || sysMenuEngine.Value<int?>("AllowAnonymous") != 0)
                {
                    return RefreshRequired(osClient, "平台菜单启动接口缺失或版本过低");
                }

                var storeListCode = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "get-microi-store")
                    .ToScalar()?.ToString() ?? string.Empty;
                if (!storeListCode.Contains("BULK_PLATFORM_BOOTSTRAP_ORDER_V1"))
                {
                    return RefreshRequired(osClient, "应用商城平台批量计划缺少自举优先级");
                }

                var publisherCode = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "ai_app_publish_store")
                    .ToScalar()?.ToString() ?? string.Empty;
                var dbType = client.OsClientModel?["DbType"]?.Val<string>();
                var publisherSettingsSql = string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase)
                    ? @"SELECT [StopHttp], [Timeout], [MaxStatements], [LimitMemory], [LimitRecursion], [Lock]
FROM [sys_apiengine]
WHERE [ApiEngineKey]=@p0 AND ([IsDeleted]=0 OR [IsDeleted] IS NULL)"
                    : @"SELECT `StopHttp`, `Timeout`, `MaxStatements`, `LimitMemory`, `LimitRecursion`, `Lock`
FROM `sys_apiengine`
WHERE `ApiEngineKey`=@p0 AND (`IsDeleted`=0 OR `IsDeleted` IS NULL)";
                var publisherSettingsRow = client.Db.FromSql(publisherSettingsSql)
                    .AddInParameter("p0", "ai_app_publish_store")
                    .First<dynamic>();
                var publisherSettings = publisherSettingsRow == null
                    ? null
                    : JObject.FromObject(publisherSettingsRow);
                var publisherVersionMatch = Regex.Match(publisherCode, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!publisherVersionMatch.Success ||
                    !System.Version.TryParse(publisherVersionMatch.Groups[1].Value, out var publisherVersion) ||
                    publisherVersion < new System.Version(1, 7, 7) ||
                    !publisherCode.Contains("OfflineSelfContained") ||
                    !publisherCode.Contains("IncludeSource: includeSource") ||
                    !publisherCode.Contains("action === 'PackageOnly'") ||
                    !publisherCode.Contains("ReturnPackageModel") ||
                    !publisherCode.Contains("buildApiEngineResourcePolicies") ||
                    !publisherCode.Contains("OFFICIAL_PLATFORM_API_ENGINE_OWNERSHIP_V1") ||
                    !publisherCode.Contains("GetFormData('sys_microistore'") ||
                    !publisherCode.Contains("ApplicationType || app.AppType") ||
                    !publisherCode.Contains("SOURCE_BUILD_ARCHIVE_ROOTS_V1") ||
                    !HasExpectedPublisherSettings(publisherSettings))
                {
                    return RefreshRequired(osClient, "AI应用离线发布器缺失、自包含能力过低或运行限额不足");
                }

                var builderCode = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "ai_app_build")
                    .ToScalar()?.ToString() ?? string.Empty;
                var builderVersionMatch = Regex.Match(builderCode, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!builderVersionMatch.Success ||
                    !System.Version.TryParse(builderVersionMatch.Groups[1].Value, out var builderVersion) ||
                    builderVersion < new System.Version(1, 4, 5) ||
                    !builderCode.Contains("TENANT_RUNTIME_CONTEXT_V1") ||
                    !builderCode.Contains("UNIFIED_UNIAPP_PREVIEW_SHELL_V1") ||
                    !builderCode.Contains("injectRuntimeContext") ||
                    !builderCode.Contains("V8.SysConfig && V8.SysConfig.ApiBase"))
                {
                    return RefreshRequired(osClient, "AI应用构建器缺少按当前租户注入运行时上下文的能力");
                }

                foreach (var engineKey in new[]
                {
                    "ai_app_prepare_store_assets",
                    "ai_app_download_build_zip",
                    "ai_app_download_source_zip"
                })
                {
                    var engineCode = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                        .AddInParameter("p0", engineKey)
                        .ToScalar()?.ToString() ?? string.Empty;
                    if (!engineCode.DosIsNullOrWhiteSpace()
                        && ((engineCode.Contains("DateNow(") && !engineCode.Contains("var nowText = function"))
                            || engineCode.Contains("new System.IO.MemoryStream")))
                    {
                        return RefreshRequired(osClient, $"AI应用打包接口[{engineKey}]仍依赖客户全局DateNow或System.IO");
                    }
                    if (string.Equals(engineKey, "ai_app_download_build_zip", StringComparison.Ordinal)
                        && (!engineCode.Contains("Version: v1.2.0")
                            || !engineCode.Contains("REAL_BUILD_ZIP_ASSETS_V1")
                            || !engineCode.Contains("buildArchivePath")))
                    {
                        return RefreshRequired(osClient, "AI应用 BuildZip 仍未携带完整真实编译资产");
                    }
                    if (string.Equals(engineKey, "ai_app_download_source_zip", StringComparison.Ordinal)
                        && (!engineCode.Contains("Version: v1.2.0")
                            || !engineCode.Contains("SOURCE_ONLY_ZIP_ROOT_V1")
                            || !engineCode.Contains("sourceArchivePath")))
                    {
                        return RefreshRequired(osClient, "AI应用 SourceZip 仍混入包装根目录或编译资产");
                    }
                }

                // ServerVersion 只能说明某个后续步骤曾成功，不能证明商城安装完整。
                foreach (var tableName in new[] { "sys_microistore", "sys_microistoreversion" })
                {
                    var tableCount = client.Db.FromSql(@"SELECT COUNT(1) FROM diy_table
WHERE LOWER(Name)=LOWER(@p0) AND (IsDeleted=0 OR IsDeleted IS NULL)")
                        .AddInParameter("p0", tableName)
                        .ToScalar();
                    if (!HasRows(tableCount)) return RefreshRequired(osClient, $"缺少表单元数据[{tableName}]");
                }

                var unifiedFieldCount = client.Db.FromSql(@"SELECT COUNT(1) FROM diy_field f
INNER JOIN diy_table t ON t.Id=f.TableId
WHERE LOWER(t.Name)=LOWER(@p0)
  AND f.Name IN ('AppKey','ApplicationType','Category','PublisherType','ViewCount','InstallCount')
  AND (t.IsDeleted=0 OR t.IsDeleted IS NULL)
  AND (f.IsDeleted=0 OR f.IsDeleted IS NULL)")
                    .AddInParameter("p0", "sys_microistore")
                    .ToScalar();
                if (!long.TryParse(unifiedFieldCount?.ToString(), out var unifiedFields) || unifiedFields < 6)
                {
                    return RefreshRequired(osClient, "应用商城缺少统一应用类型、分类或统计字段");
                }

                var appStoreMenuRow = client.Db.FromSql(@"SELECT Id, OpenType, IsMicroiService,
ComponentPath, MicroServiceId, MicroServicePageId, MicroServiceRoutePath
FROM sys_menu
WHERE ModuleEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "sys_microistore")
                    .First<dynamic>();
                var appStoreMenu = appStoreMenuRow == null
                    ? null
                    : JObject.FromObject((object)appStoreMenuRow);
                var menuId = appStoreMenu?["Id"]?.ToString();
                if (menuId.DosIsNullOrWhiteSpace()) return RefreshRequired(osClient, "缺少应用商城菜单");

                var marketplaceServiceRow = client.Db.FromSql(@"SELECT Id, MsKey, IsEnable,
Runtime, StorageMode, MsUrl, EntryPath, BuildVersion, AssetCount, AssetsJson, AssetManifestJson
FROM sys_microiservice
WHERE MsKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", PlatformMicroServiceKey)
                    .First<dynamic>();
                var marketplaceService = marketplaceServiceRow == null
                    ? null
                    : JObject.FromObject((object)marketplaceServiceRow);
                var marketplaceServiceId = marketplaceService?["Id"]?.ToString();

                JObject marketplacePage = null;
                if (!marketplaceServiceId.DosIsNullOrWhiteSpace())
                {
                    var marketplacePageRow = client.Db.FromSql(@"SELECT Id, MicroServiceId,
MicroServiceKey, RoutePath, EntryPath, BuildVersion, IsEnable
FROM sys_microiservice_page
WHERE MicroServiceId=@p0 AND RoutePath=@p1 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                        .AddInParameter("p0", marketplaceServiceId)
                        .AddInParameter("p1", MarketplaceRoutePath)
                        .First<dynamic>();
                    marketplacePage = marketplacePageRow == null
                        ? null
                        : JObject.FromObject((object)marketplacePageRow);
                }

                var marketplaceRuntimeReason = GetMarketplaceRuntimeRepairReason(
                    appStoreMenu,
                    marketplaceService,
                    marketplacePage);
                if (!marketplaceRuntimeReason.DosIsNullOrWhiteSpace())
                {
                    return RefreshRequired(osClient, marketplaceRuntimeReason);
                }

                var relatedMenuCount = client.Db.FromSql(@"SELECT COUNT(1) FROM sys_menu
WHERE Id IN (@p0,@p1) AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "01KXFSG7MZ40CY8KCWCZZZJH2M")
                    .AddInParameter("p1", "01KXFSG8153B3VZPZ45WNCCFHR")
                    .ToScalar();
                if (!long.TryParse(relatedMenuCount?.ToString(), out var relatedCount) || relatedCount < 2)
                {
                    return RefreshRequired(osClient, "缺少应用商城关联模块");
                }

                // sys_menu 的 diy_table.Id 在部分早期客户库中并非官方固定 Id，
                // 必须按表名关联查找，避免完整性检查永远误判并重复安装应用商城。
                var pageTabsConfig = client.Db.FromSql(@"SELECT f.Config
FROM diy_field f
INNER JOIN diy_table t ON t.Id=f.TableId
WHERE LOWER(t.Name)=LOWER(@p0)
  AND f.Name=@p1
  AND (t.IsDeleted=0 OR t.IsDeleted IS NULL)
  AND (f.IsDeleted=0 OR f.IsDeleted IS NULL)")
                    .AddInParameter("p0", "sys_menu")
                    .AddInParameter("p1", "PageTabs")
                    .ToScalar()?.ToString() ?? string.Empty;
                if (!pageTabsConfig.Contains("TargetSysMenuId"))
                {
                    return RefreshRequired(osClient, "页面多Tab缺少关联模块配置");
                }

                var appStorePageTabs = client.Db.FromSql(@"SELECT PageTabs FROM sys_menu
WHERE Id=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", menuId)
                    .ToScalar()?.ToString() ?? string.Empty;
                if (!appStorePageTabs.Contains("01KXFSG7MZ40CY8KCWCZZZJH2M") ||
                    !appStorePageTabs.Contains("01KXFSG8153B3VZPZ45WNCCFHR") ||
                    !appStorePageTabs.Contains("AI应用") ||
                    appStorePageTabs.Contains("官方应用") ||
                    appStorePageTabs.Contains("社区应用"))
                {
                    return RefreshRequired(osClient, "应用商城页面多Tab尚未合并为AI应用");
                }

                if (!client.Db.ColumnExists("mci_ai_app_file", "UploadRecoveryHint"))
                {
                    return RefreshRequired(osClient, "AI应用文件缺少超大文件断点上传审计列");
                }

                var uploadAuditFieldCount = client.Db.FromSql(@"SELECT COUNT(1)
FROM diy_field f
INNER JOIN diy_table t ON t.Id=f.TableId
WHERE LOWER(t.Name)=LOWER(@p0) AND f.Name=@p1
  AND (t.IsDeleted=0 OR t.IsDeleted IS NULL)
  AND (f.IsDeleted=0 OR f.IsDeleted IS NULL)")
                    .AddInParameter("p0", "mci_ai_app_file")
                    .AddInParameter("p1", "UploadRecoveryHint")
                    .ToScalar();
                if (!HasRows(uploadAuditFieldCount))
                {
                    return RefreshRequired(osClient, "AI应用文件缺少超大文件断点上传审计元数据");
                }

                var uploadAuditMenuRow = client.Db.FromSql(@"SELECT Display, AppDisplay, SqlWhere,
ModuleEngineKey, DiyTableId
FROM sys_menu
WHERE Id=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", ApplicationAssetUploadAuditMenuId)
                    .First<dynamic>();
                var uploadAuditMenu = uploadAuditMenuRow == null
                    ? null
                    : JObject.FromObject(uploadAuditMenuRow);
                var uploadAuditSqlWhere = uploadAuditMenu?["SqlWhere"]?.ToString() ?? string.Empty;
                if (uploadAuditMenu == null
                    || uploadAuditMenu.Value<int?>("Display") != 1
                    || uploadAuditMenu.Value<int?>("AppDisplay") != 0
                    || !string.Equals(
                        uploadAuditMenu["ModuleEngineKey"]?.ToString(),
                        "application-asset-upload-audit",
                        StringComparison.Ordinal)
                    || !uploadAuditSqlWhere.Contains(
                        "ApplicationAssetMultipartSession",
                        StringComparison.Ordinal)
                    || string.IsNullOrWhiteSpace(uploadAuditMenu["DiyTableId"]?.ToString()))
                {
                    return RefreshRequired(osClient, "缺少只读超大文件上传记录菜单或固定会话筛选");
                }

                var marketplaceListCode = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "get-microi-store")
                    .ToScalar()?.ToString() ?? string.Empty;
                if (!marketplaceListCode.Contains("PublisherTypes") ||
                    !marketplaceListCode.Contains("StoreInstallStatus") ||
                    !marketplaceListCode.Contains("ApplicationTypes"))
                {
                    return RefreshRequired(osClient, "应用商城列表缺少统一筛选或安装状态兼容");
                }

                var roleLimitCount = client.Db.FromSql(@"SELECT COUNT(1) FROM sys_rolelimit
WHERE RoleId=@p0 AND FkId=@p1 AND Type=@p2")
                    .AddInParameter("p0", "5db47859-35a3-411a-a1f7-99482e057d24")
                    .AddInParameter("p1", menuId)
                    .AddInParameter("p2", "Menu")
                    .ToScalar();
                if (!HasRows(roleLimitCount)) return RefreshRequired(osClient, "缺少应用商城超级管理员菜单权限");

                var platformRuntimeReason = GetInstalledPlatformRuntimeRepairReason(client.Db);
                if (!platformRuntimeReason.DosIsNullOrWhiteSpace())
                {
                    return RefreshRequired(osClient, platformRuntimeReason);
                }

                var ssoRuntimeReason = GetInstalledSsoRuntimeRepairReason(client.Db);
                if (!ssoRuntimeReason.DosIsNullOrWhiteSpace())
                {
                    return RefreshRequired(osClient, ssoRuntimeReason);
                }

                var v8FirstRuntimeReason = GetInstalledV8FirstApplicationRuntimeRepairReason(client.Db);
                if (!v8FirstRuntimeReason.DosIsNullOrWhiteSpace())
                {
                    return RefreshRequired(osClient, v8FirstRuntimeReason);
                }

                return Task.FromResult(false);
            }
            catch (Exception ex)
            {
                return RefreshRequired(osClient, "完整性检查异常：" + ex.Message);
            }
        }

        private static bool HasRows(object value)
        {
            return long.TryParse(value?.ToString(), out var count) && count > 0;
        }

        private static string GetInstalledPlatformRuntimeRepairReason(DbSession database)
        {
            foreach (var key in RequiredPlatformRuntimeEngineKeys)
            {
                var isTenantHook = string.Equals(
                    key,
                    PlatformRuntimeCustomHookEngineKey,
                    StringComparison.Ordinal);
                var keyPredicate = isTenantHook
                    ? "LOWER(ApiEngineKey)=LOWER(@p0)"
                    : "ApiEngineKey=@p0";
                var sql = @"SELECT ApiEngineKey, ApiV8Code, Version, ApiAddress,
IsEnable, StopHttp, AllowAnonymous, ResponseType
FROM sys_apiengine
WHERE " + keyPredicate + (isTenantHook ? string.Empty : " AND (IsDeleted=0 OR IsDeleted IS NULL)");
                var row = database.FromSql(sql)
                    .AddInParameter("p0", key)
                    .First<dynamic>();
                if (row == null) return $"平台运行时接口[{key}]缺失";

                // CreateIfMissing 导入器按 LOWER(ApiEngineKey) 识别既有墓碑/大小写变体；
                // 安装回读必须使用同一语义。租户 Hook 只要记录存在即满足门禁。
                if (isTenantHook) continue;

                var engine = JObject.FromObject((object)row);
                if (HasExpectedPlatformRuntimeEngineContract(engine, validateTenantTemplate: false)) continue;

                return $"平台运行时 Managed 接口[{key}]缺失、版本过低或官方运行契约不完整";
            }

            return null;
        }

        private static string GetInstalledSsoRuntimeRepairReason(DbSession database)
        {
            foreach (var key in RequiredSsoEngineKeys)
            {
                var isTenantHook = string.Equals(key, "sso_event_hook", StringComparison.Ordinal);
                var keyPredicate = isTenantHook
                    ? "LOWER(ApiEngineKey)=LOWER(@p0)"
                    : "ApiEngineKey=@p0";
                var sql = @"SELECT ApiEngineKey, ApiV8Code, Version, ApiAddress,
IsEnable, StopHttp, AllowAnonymous, ResponseType
FROM sys_apiengine
WHERE " + keyPredicate + (isTenantHook ? string.Empty : " AND (IsDeleted=0 OR IsDeleted IS NULL)");
                var row = database.FromSql(sql)
                    .AddInParameter("p0", key)
                    .First<dynamic>();
                if (row == null) return $"SSO 身份联邦接口[{key}]缺失";

                var engine = JObject.FromObject((object)row);
                // CreateIfMissing Hook 首次创建后归租户维护。已存在即满足升级门；源码、
                // 版本、启用状态、地址与内部调用配置都不得成为重复安装条件。
                if (string.Equals(key, "sso_event_hook", StringComparison.Ordinal))
                {
                    continue;
                }

                if (!HasExpectedSsoEngineContract(engine, validateTenantTemplate: false))
                {
                    return $"SSO 身份联邦 Managed 接口[{key}]缺失、版本过低或资源策略提示不完整";
                }
            }
            return null;
        }

        private static readonly string[] InstalledV8FirstManagedEngineKeys =
        {
            "platform-create-tenant",
            "platform-external-login-binding",
            "platform-wechat-user-binding",
            "platform-user-update-preferences",
            "platform-user-update-profile",
            "platform-sys-user-admin",
            "platform-tenant-system-settings",
            "platform-chat-system-message",
            "platform-chat-runtime",
            "wechat_send_tpl_msg",
            "platform-marketplace-source",
            "mci_ai_data_assistant",
            "platform-ai-account",
            "platform-ai-runtime"
        };

        // platform-marketplace-source intentionally stays out of this set:
        // authenticated browser clients must reach its Managed runtime, while
        // AllowAnonymous=0 still rejects missing/expired tokens before V8 runs.
        private static readonly HashSet<string> InstalledV8FirstInternalEngineKeys =
            new HashSet<string>(StringComparer.Ordinal)
            {
                "platform-external-login-binding",
                "platform-wechat-user-binding",
                "platform-chat-runtime",
                "wechat_send_tpl_msg"
            };

        private static readonly HashSet<string> InstalledV8FirstAnonymousEngineKeys =
            new HashSet<string>(StringComparer.Ordinal)
            {
                // 同一 Managed 多路由同时承载 GetPublic/GetMapRuntime 与需要内部
                // 强鉴权的管理动作；匿名只表示允许进入 V8，敏感动作仍由
                // ValidateTenantSystemSettingsOperation/可信运行时重新鉴权。
                "platform-tenant-system-settings",
                "platform-ai-account"
            };

        private static readonly string[] InstalledV8FirstTenantHookKeys =
        {
            "platform-runtime-custom-hook",
            "platform-user-custom-hook",
            "platform-system-settings-custom-hook",
            "platform-message-notification-custom-hook",
            "platform-marketplace-source-hook",
            "platform-ai-custom-hook"
        };

        private static string ExpectedV8FirstHookMarker(string key)
        {
            if (string.Equals(key, "platform-create-tenant", StringComparison.Ordinal)
                || string.Equals(key, "platform-external-login-binding", StringComparison.Ordinal)
                || string.Equals(key, "platform-wechat-user-binding", StringComparison.Ordinal))
            {
                return "platform-runtime-custom-hook";
            }
            if (string.Equals(key, "platform-user-update-preferences", StringComparison.Ordinal)
                || string.Equals(key, "platform-user-update-profile", StringComparison.Ordinal)
                || string.Equals(key, "platform-sys-user-admin", StringComparison.Ordinal))
            {
                return "platform-user-custom-hook";
            }
            if (string.Equals(key, "platform-tenant-system-settings", StringComparison.Ordinal))
            {
                return "platform-system-settings-custom-hook";
            }
            if (string.Equals(key, "platform-chat-runtime", StringComparison.Ordinal))
            {
                return "platform-message-notification-custom-hook";
            }
            if (string.Equals(key, "wechat_send_tpl_msg", StringComparison.Ordinal))
            {
                return "platform-message-notification-custom-hook";
            }
            if (string.Equals(key, "platform-marketplace-source", StringComparison.Ordinal))
            {
                return "platform-marketplace-source-hook";
            }
            if (string.Equals(key, "mci_ai_data_assistant", StringComparison.Ordinal)
                || string.Equals(key, "platform-ai-account", StringComparison.Ordinal)
                || string.Equals(key, "platform-ai-runtime", StringComparison.Ordinal))
            {
                return "platform-ai-custom-hook";
            }
            return string.Empty;
        }

        private static string GetInstalledV8FirstApplicationRuntimeRepairReason(DbSession database)
        {
            foreach (var key in InstalledV8FirstTenantHookKeys)
            {
                var hook = database.FromSql(@"SELECT ApiEngineKey FROM sys_apiengine
WHERE LOWER(ApiEngineKey)=LOWER(@p0)")
                    .AddInParameter("p0", key)
                    .First<dynamic>();
                // CreateIfMissing 资源首次创建后归租户维护。禁用、改名大小写或软删除都不触发官方覆盖。
                if (hook == null) return $"租户个性化 Hook[{key}]尚未创建";
            }

            foreach (var key in InstalledV8FirstManagedEngineKeys)
            {
                // SELECT * avoids spelling the legacy `Lock` column directly:
                // Lock is a reserved word on MySQL, while provider-specific
                // quoting would make the same readiness gate non-portable.
                var row = database.FromSql(@"SELECT *
FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", key)
                    .First<dynamic>();
                if (row == null) return $"V8 引擎优先 Managed 接口[{key}]缺失";
                var engine = JObject.FromObject((object)row);
                var code = engine.Value<string>("ApiV8Code") ?? string.Empty;
                var versionText = (engine.Value<string>("Version") ?? string.Empty).TrimStart('v', 'V');
                var expectedHook = ExpectedV8FirstHookMarker(key);
                var minimumInstalledVersion = string.Equals(
                        key,
                        "platform-ai-account",
                        StringComparison.Ordinal)
                    || string.Equals(
                        key,
                        "platform-chat-system-message",
                        StringComparison.Ordinal)
                    ? new System.Version(1, 1, 0)
                    : string.Equals(
                        key,
                        "platform-chat-runtime",
                        StringComparison.Ordinal)
                    ? new System.Version(1, 0, 2)
                    : string.Equals(
                        key,
                        "platform-marketplace-source",
                        StringComparison.Ordinal)
                    ? new System.Version(1, 0, 5)
                    : new System.Version(1, 0, 0);
                if (!System.Version.TryParse(versionText, out var version)
                    || version < minimumInstalledVersion
                    || !code.TrimStart().StartsWith(ManagedPlatformRuntimeNoticeMarker, StringComparison.Ordinal)
                    || (!expectedHook.DosIsNullOrWhiteSpace() && !code.Contains(expectedHook))
                    || engine.Value<int?>("IsEnable") != 1
                    || engine.Value<int?>("StopHttp") != (InstalledV8FirstInternalEngineKeys.Contains(key) ? 1 : 0)
                    || engine.Value<int?>("AllowAnonymous") != (InstalledV8FirstAnonymousEngineKeys.Contains(key) ? 1 : 0)
                    || ((string.Equals(key, "platform-external-login-binding", StringComparison.Ordinal)
                            || string.Equals(key, "platform-wechat-user-binding", StringComparison.Ordinal))
                        && engine.Value<int?>("Lock") != 1)
                    || !string.Equals(
                        engine.Value<string>("ApiAddress"),
                        "/apiengine/" + key,
                        StringComparison.OrdinalIgnoreCase))
                {
                    return $"V8 引擎优先 Managed 接口[{key}]版本、路由、官方提示或 Hook 契约不完整";
                }
                if (string.Equals(key, "mci_ai_data_assistant", StringComparison.Ordinal)
                    && !code.Contains("AI_DATA_ASSISTANT_SAFE_TENANT_HOOK_V1"))
                {
                    return "AI 数据助手缺少安全最小化租户 Hook";
                }
                if (string.Equals(key, "platform-ai-account", StringComparison.Ordinal)
                    && (!code.Contains("PAYMENT_COMPLETE_MANAGED_V1")
                        || !code.Contains("RequireManagedProtocolContext")))
                {
                    return "AI 账户接口缺少可信支付回调 Managed 编排";
                }
                if (string.Equals(key, "platform-ai-runtime", StringComparison.Ordinal)
                    && (!code.Contains("AI_RUNTIME_MANAGED_NON_STREAM_V1")
                        || !code.Contains("V8.AI.Chat")
                        || !code.Contains("V8.AI.NL2SQL")
                        || !code.Contains("V8.AI.NL2V8")))
                {
                    return "AI 非流式兼容运行时能力不完整";
                }
                if (string.Equals(key, "platform-chat-system-message", StringComparison.Ordinal)
                    && !code.Contains("platform-chat-runtime"))
                {
                    return "平台系统消息尚未转发固定聊天 Managed 运行时";
                }
                if (string.Equals(key, "platform-chat-runtime", StringComparison.Ordinal)
                    && (!code.Contains("V8.MongoDb.UptFormDataByWhere")
                        || !code.Contains("V8.MongoDb.DelFormDataByWhere")
                        || !code.Contains("CHAT_SIGNALR_TRUSTED_PROTOCOL_V1")
                        || !code.Contains("PLATFORM_CHAT_LOCAL_TIME_V1")
                        || Regex.IsMatch(code, @"\bDateNow\s*\(")
                        || !code.Contains("RequireManagedProtocolContext")
                        || !code.Contains("platform-message-notification-custom-hook")))
                {
                    return "平台聊天 Managed 运行时缺少 SignalR 可信协议、持久化、已读/删除或租户 Hook 契约";
                }
            }
            return null;
        }

        private static string GetMarketplaceRuntimeRepairReason(
            JObject menu,
            JObject service,
            JObject page)
        {
            if (menu == null) return "缺少应用商城菜单";
            if (!string.Equals(menu["OpenType"]?.ToString(), "MicroService", StringComparison.OrdinalIgnoreCase)
                || menu.Value<int?>("IsMicroiService") != 1
                || !string.Equals(menu["ComponentPath"]?.ToString(), MicroAppHostComponentPath, StringComparison.OrdinalIgnoreCase))
            {
                return "应用商城菜单尚未切换到微服务宿主";
            }

            var menuServiceId = menu["MicroServiceId"]?.ToString();
            var menuPageId = menu["MicroServicePageId"]?.ToString();
            if (menuServiceId.DosIsNullOrWhiteSpace() || menuPageId.DosIsNullOrWhiteSpace()
                || !string.Equals(menu["MicroServiceRoutePath"]?.ToString(), MarketplaceRoutePath, StringComparison.OrdinalIgnoreCase))
            {
                return "应用商城菜单缺少 microi-platform-service 页面绑定";
            }

            if (service == null) return "缺少应用商城平台微服务运行记录";
            var serviceId = service["Id"]?.ToString();
            if (!string.Equals(serviceId, menuServiceId, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(service["MsKey"]?.ToString(), PlatformMicroServiceKey, StringComparison.OrdinalIgnoreCase))
            {
                return "应用商城菜单绑定的平台微服务不匹配";
            }
            if (service.Value<int?>("IsEnable") != 1)
            {
                return "应用商城平台微服务已停用";
            }
            if (!string.Equals(service["Runtime"]?.ToString(), "micro-app", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(service["StorageMode"]?.ToString(), "db", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(service["MsUrl"]?.ToString(), "db", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(NormalizeRuntimeAssetPath(service["EntryPath"]?.ToString()), "index.html", StringComparison.OrdinalIgnoreCase)
                || string.IsNullOrWhiteSpace(service["BuildVersion"]?.ToString()))
            {
                return "应用商城平台微服务运行配置不完整";
            }
            if (!HasDatabaseRuntimeEntryAsset(service))
            {
                return "应用商城平台微服务缺少数据库内联入口资产";
            }

            if (page == null) return "缺少应用商城 /marketplace 页面";
            if (!string.Equals(page["Id"]?.ToString(), menuPageId, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(page["MicroServiceId"]?.ToString(), serviceId, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(page["MicroServiceKey"]?.ToString(), PlatformMicroServiceKey, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(page["RoutePath"]?.ToString(), MarketplaceRoutePath, StringComparison.OrdinalIgnoreCase)
                || page.Value<int?>("IsEnable") != 1)
            {
                return "应用商城 /marketplace 页面绑定不完整或已停用";
            }

            return null;
        }

        private static bool HasDatabaseRuntimeEntryAsset(JObject service)
        {
            if (service == null) return false;
            try
            {
                var assetsToken = service.GetValue("AssetsJson", StringComparison.OrdinalIgnoreCase);
                var assets = assetsToken as JArray ?? JArray.Parse(assetsToken?.ToString() ?? string.Empty);
                return assets.Children<JObject>().Any(asset =>
                    string.Equals(
                        NormalizeRuntimeAssetPath(asset["Path"]?.ToString() ?? asset["FileName"]?.ToString()),
                        "index.html",
                        StringComparison.OrdinalIgnoreCase)
                    && !string.IsNullOrWhiteSpace(
                        asset["ContentBase64"]?.ToString()
                        ?? asset["FileByteBase64"]?.ToString()
                        ?? asset["Base64"]?.ToString()));
            }
            catch
            {
                return false;
            }
        }

        private static string NormalizeRuntimeAssetPath(string value)
        {
            var normalized = (value ?? string.Empty)
                .Replace('\\', '/')
                .Trim()
                .TrimStart('/');
            while (normalized.StartsWith("./", StringComparison.Ordinal))
            {
                normalized = normalized.Substring(2);
            }
            return normalized;
        }

        private static bool HasExpectedPublisherSettings(JObject settings)
        {
            if (settings == null) return false;
            return TryGetLong(settings, "StopHttp", out var stopHttp) && stopHttp == 0
                   && TryGetLong(settings, "Timeout", out var timeout) && timeout >= 3600
                   && TryGetLong(settings, "MaxStatements", out var maxStatements) && maxStatements >= 100000000
                   && TryGetLong(settings, "LimitMemory", out var limitMemory) && limitMemory >= 2048
                   && TryGetLong(settings, "LimitRecursion", out var limitRecursion) && limitRecursion == PrivilegedEngineLimitRecursion
                   && TryGetLong(settings, "Lock", out var lockValue) && lockValue == 1;
        }

        // These official engines historically persisted 10000 although the V8 runtime
        // hard ceiling is 5000 by default. Keep the privileged engines at the effective
        // ceiling without writing a value that the runtime will silently truncate.
        private static int PrivilegedEngineLimitRecursion =>
            Math.Min(5000, CreateV8EngineParam.MaxLimitRecursion);

        private static bool TryGetLong(JObject model, string name, out long value)
        {
            value = 0;
            var token = model.GetValue(name, StringComparison.OrdinalIgnoreCase);
            return token != null && long.TryParse(token.ToString(), out value);
        }

        private static Task<bool> RefreshRequired(string osClient, string reason)
        {
            Console.WriteLine($"Microi：【基础应用升级】租户[{osClient}]需要修复：{reason}。");
            return Task.FromResult(true);
        }

        /// <summary>
        /// 官方应用源数据库不能被随程序集发布的商城基线包反向覆盖。
        /// 客户可以使用同名 iTdos 租户，因此租户名本身绝不能作为判断依据。
        /// 统一调用 Microi.net 的 LicenseService 判断当前服务器是否拥有签发私钥；
        /// 客户 NuGet/发布包不包含私钥，即使租户也叫 iTdos 仍会正常升级。
        /// </summary>
        internal static bool IsOfficialSourceTenant(string osClient)
        {
            return Microi.License.LicenseService.IsOfficialPlatform(osClient);
        }

        private static readonly string[] CoreNullableTables =
        {
            "diy_table",
            "diy_field",
            "sys_user",
            "sys_menu",
            "sys_role",
            "sys_osclients"
        };
        
        private static Dictionary<string, string> LoadBundledResources()
        {
            var resources = new Dictionary<string, string>(StringComparer.Ordinal);
            var assembly = typeof(UpgradeAppStore).GetTypeInfo().Assembly;
            foreach (var resourceName in RequiredResourceNames)
            {
                var manifestName = "Microi.Upgrade.Resource." + resourceName;
                using (var stream = assembly.GetManifestResourceStream(manifestName))
                {
                    if (stream == null)
                    {
                        throw new InvalidOperationException($"程序集缺少基础升级资源[{resourceName}]。请刷新资源后重新构建。");
                    }
                    using (var reader = new StreamReader(stream))
                    {
                        var content = reader.ReadToEnd();
                        ValidateResourceContent(resourceName, content);
                        resources[resourceName] = content;
                    }
                }
            }
            return resources;
        }

        private static IReadOnlyDictionary<string, string[]> BuildRuntimeDependencyPackageKeys()
        {
            var assembly = typeof(UpgradeAppStore).GetTypeInfo().Assembly;
            var result = new Dictionary<string, string[]>(StringComparer.Ordinal);
            var ownerByKey = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var resourceName in RuntimeDependencyPackageResourceNames)
            {
                var manifestName = "Microi.Upgrade.Resource." + resourceName;
                using var stream = assembly.GetManifestResourceStream(manifestName);
                if (stream == null)
                    throw new InvalidOperationException($"程序集缺少平台运行时资源[{resourceName}]。");
                using var reader = new StreamReader(stream);
                var package = JObject.Parse(reader.ReadToEnd());
                var packageKeys = package["SysApiEngines"]?.Children<JObject>()
                                      .Select(engine => engine["ApiEngineKey"]?.ToString()?.Trim())
                                      .Where(key => !key.DosIsNullOrWhiteSpace())
                                      .ToArray()
                                  ?? Array.Empty<string>();
                if (packageKeys.Distinct(StringComparer.Ordinal).Count() != packageKeys.Length)
                {
                    throw new InvalidOperationException($"内置官方应用包[{resourceName}]的接口引擎 Key 重复。");
                }
                foreach (var key in packageKeys)
                {
                    if (ownerByKey.TryGetValue(key, out var existingOwner))
                    {
                        throw new InvalidOperationException(
                            $"内置官方应用包接口[{key}]同时归属[{existingOwner}]和[{resourceName}]，无法确定升级所有权。");
                    }
                    ownerByKey[key] = resourceName;
                }
                if (packageKeys.Length > 0) result[resourceName] = packageKeys;
            }

            // This list is a regression assertion, not the closure source. The
            // source is every SysApiEngines resource in the automatically
            // installed official baseline packages above. Keeping a few known
            // production failures here makes an accidentally incomplete package
            // fail during process initialization instead of at a customer page.
            var minimumSeed = new[]
            {
                PlatformSysMenuEngineKey,
                "platform-os-client-by-domain",
                "platform-sys-config",
                "platform-lang-bundle",
                "platform-current-user",
                "platform-private-file-url",
                "platform-sys-user-public-info",
                PlatformRuntimeCustomHookEngineKey,
                "platform-service-health",
                "platform-sys-dept",
                "mci-module-presentation-stats",
                PlatformBackgroundTaskEngineKey,
                "bulk-import-microi-store-packages",
                "get-microi-store"
            };
            var missingSeed = minimumSeed
                .Where(key => !ownerByKey.ContainsKey(key))
                .ToArray();
            if (missingSeed.Length > 0)
            {
                throw new InvalidOperationException(
                    "内置官方应用包缺少平台运行时基础接口：" + string.Join(",", missingSeed));
            }
            return result;
        }

        /// <summary>
        /// Reads every API engine from the embedded official baseline packages.
        /// Executable source remains owned by those application packages; this
        /// gate never carries a second copy of V8 business code in C#.
        /// </summary>
        internal static IReadOnlyList<JObject> LoadBundledStartupDependencyEngines()
        {
            return BundledStartupDependencyEngines.Value
                .Select(item => (JObject)item.DeepClone())
                .ToList();
        }

        private static IReadOnlyList<JObject> BuildBundledStartupDependencyEngines()
        {
            var resources = LoadBundledResources();
            var result = new List<JObject>();
            foreach (var packageEntry in StartupDependencyPackageKeys)
            {
                var package = JObject.Parse(resources[packageEntry.Key]);
                var policyMap = package["ResourcePolicies"]?["ApiEngines"] as JObject;
                var engines = package["SysApiEngines"]?.Children<JObject>().ToList()
                              ?? new List<JObject>();
                foreach (var key in packageEntry.Value)
                {
                    var matches = engines.Where(engine => string.Equals(
                        engine["ApiEngineKey"]?.ToString(),
                        key,
                        StringComparison.Ordinal)).ToList();
                    if (matches.Count != 1)
                    {
                        throw new InvalidOperationException(
                            $"内置官方应用包[{packageEntry.Key}]的启动接口[{key}]定义数量不是1。" );
                    }

                    var policy = policyMap?[key] as JObject;
                    var ownership = policy?["Ownership"]?.ToString();
                    var upgradePolicy = policy?["UpgradePolicy"]?.ToString();
                    var isManaged = string.Equals(ownership, "Platform", StringComparison.Ordinal)
                                    && string.Equals(upgradePolicy, "Managed", StringComparison.Ordinal);
                    var isTenantHook = string.Equals(ownership, "Tenant", StringComparison.Ordinal)
                                       && string.Equals(upgradePolicy, "CreateIfMissing", StringComparison.Ordinal);
                    if (!isManaged && !isTenantHook)
                    {
                        throw new InvalidOperationException(
                            $"内置官方应用包[{packageEntry.Key}]的运行时接口[{key}]未声明 Platform/Managed 或 Tenant/CreateIfMissing 所有权。" );
                    }

                    var engine = (JObject)matches[0].DeepClone();
                    var source = engine["ApiV8Code"]?.ToString() ?? string.Empty;
                    if (!source.TrimStart().StartsWith(
                            isTenantHook ? TenantPlatformRuntimeNoticeMarker : ManagedPlatformRuntimeNoticeMarker,
                            StringComparison.Ordinal)
                        || engine["ApiAddress"].Val<string>().DosIsNullOrWhiteSpace()
                        || (isTenantHook && !string.Equals(
                            StripLeadingBlockComments(source),
                            DefaultPlatformRuntimeHookBody,
                            StringComparison.Ordinal))
                        || engine["Id"].Val<string>().DosIsNullOrWhiteSpace())
                    {
                        throw new InvalidOperationException(
                            $"内置官方应用包[{packageEntry.Key}]的启动接口[{key}]运行契约不完整。" );
                    }
                    engine["_OfficialPackageResource"] = packageEntry.Key;
                    engine["_OfficialOwnership"] = ownership;
                    engine["_OfficialUpgradePolicy"] = upgradePolicy;
                    result.Add(engine);
                }
            }

            var actualKeys = result.Select(item => item["ApiEngineKey"]?.ToString()).ToArray();
            if (actualKeys.Length != RequiredStartupDependencyEngineKeys.Length
                || RequiredStartupDependencyEngineKeys.Any(key => !actualKeys.Contains(key, StringComparer.Ordinal)))
            {
                throw new InvalidOperationException("内置官方应用包未形成完整的平台运行时接口闭包。");
            }
            return result;
        }

        internal static bool StartupDependenciesReady(OsClientSecret client, out string reason)
        {
            reason = string.Empty;
            if (client?.Db == null)
            {
                reason = "租户数据库连接不可用。";
                return false;
            }
            try
            {
                var problems = new List<string>();
                foreach (var source in LoadBundledStartupDependencyEngines())
                {
                    var key = source["ApiEngineKey"]?.ToString();
                    var row = ReadStartupDependencyEngine(
                        client.Db,
                        key,
                        ignoreKeyCase: true);
                    var contractError = GetStartupDependencyContractError(row, source);
                    if (!contractError.DosIsNullOrWhiteSpace())
                    {
                        problems.Add(key + "：" + contractError);
                    }
                }
                if (problems.Count > 0)
                {
                    var visible = problems.Take(12).ToArray();
                    reason = $"共{problems.Count}项：" + string.Join("；", visible)
                             + (problems.Count > visible.Length
                                 ? $"；另有{problems.Count - visible.Length}项（修复结果会完整回读）"
                                 : string.Empty);
                    return false;
                }
                return true;
            }
            catch (Exception ex)
            {
                reason = ex.Message;
                return false;
            }
        }

        /// <summary>
        /// Must run under UpgradeDistributedLease. Package-declared Managed
        /// startup interfaces are authoritative and are overwritten in place from
        /// the embedded package. Existing CreateIfMissing hooks remain tenant-owned
        /// and are reused. Physical Id/address collisions are reconciled without
        /// turning local drift into an upgrade-blocking conflict.
        /// </summary>
        internal static async Task<DosResult> EnsureStartupDependenciesUnderLeaseAsync(
            OsClientSecret client)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (client?.Db == null)
                return new DosResult(0, null, "租户数据库连接不可用，无法检查平台运行时接口闭包。");
            if (IsOfficialSourceTenant(client.OsClient))
            {
                return StartupDependenciesReady(client, out var officialSourceReason)
                    ? new DosResult(1, new { Skipped = true, OfficialSource = true },
                        "官方应用源平台运行时接口闭包已就绪；未使用程序集内置包反向写入。")
                    : new DosResult(0, new
                    {
                        Skipped = true,
                        OfficialSource = true,
                        Reason = officialSourceReason
                    }, "官方应用源平台运行时接口闭包不完整，必须通过官方应用源同步修复：" + officialSourceReason);
            }

            var added = new List<string>();
            var reconciled = new List<string>();
            var reused = new List<string>();
            var overwritten = new List<string>();
            var identityRemapped = new List<string>();
            try
            {
                // 同一租户的一轮启动闭包使用同一份物理字段快照。旧库可能一次缺少
                // 数十个接口，逐条重复查询 information_schema 会显著拖慢容器启动。
                var physicalFields = ReadStartupDependencyPhysicalFields(client.Db, client.OsClient);
                var dependencyIndex = 0;
                foreach (var packaged in LoadBundledStartupDependencyEngines())
                {
                    if (dependencyIndex++ % 10 == 0)
                        UpgradeExecutionLeaseContext.ConfirmOwnership();
                    else
                        UpgradeExecutionLeaseContext.ThrowIfLost();
                    var source = (JObject)packaged.DeepClone();
                    var key = source["ApiEngineKey"]?.ToString();
                    var isTenantHook = IsCreateIfMissingRuntimeDependency(source);
                    var existing = ReadStartupDependencyEngine(client.Db, key, ignoreKeyCase: true);
                    if (existing != null)
                    {
                        // CreateIfMissing is a one-way ownership transfer. Any
                        // existing record, including a case variant, disabled
                        // row or tombstone, belongs to the tenant and must not be
                        // repaired by an official startup path.
                        if (isTenantHook)
                        {
                            reused.Add(key);
                            continue;
                        }

                        var reclaimedRoutes = await ReclaimStartupDependencyRoutesAsync(
                                client,
                                source,
                                existing["Id"]?.ToString(),
                                physicalFields)
                            .ConfigureAwait(false);
                        identityRemapped.AddRange(reclaimedRoutes);

                        // An exact package readback needs no write. Any Managed
                        // drift, including local source edits and soft deletion,
                        // is repaired from the selected embedded package.
                        if (string.IsNullOrWhiteSpace(
                                GetStartupDependencyContractError(existing, source)))
                        {
                            reused.Add(key);
                            continue;
                        }

                        var sameOfficialSource = string.Equals(
                            NormalizeStartupDependencySource(existing["ApiV8Code"]?.ToString()),
                            NormalizeStartupDependencySource(source["ApiV8Code"]?.ToString()),
                            StringComparison.Ordinal);
                        var patch = CreatePersistableRuntimeDependencySource(source);
                        patch["Id"] = existing["Id"]?.ToString();
                        patch["OsClient"] = client.OsClient;
                        patch["IsDeleted"] = 0;
                        patch["UpdateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                        var updateCount = PersistStartupDependencyDirect(
                            client.Db,
                            patch,
                            existing["Id"]?.ToString(),
                            physicalFields);
                        if (updateCount != 1)
                        {
                            return new DosResult(0, new { ApiEngineKey = key },
                                $"平台运行时接口[{key}]补正失败：数据库影响行数={updateCount}");
                        }
                        reconciled.Add(key);
                        if (!sameOfficialSource
                            || ReadStartupSwitch(existing["IsDeleted"]) == 1)
                        {
                            overwritten.Add(key);
                        }
                    }
                    else
                    {
                        var reclaimedRoutes = await ReclaimStartupDependencyRoutesAsync(
                                client,
                                source,
                                ownerId: null,
                                physicalFields: physicalFields)
                            .ConfigureAwait(false);
                        identityRemapped.AddRange(reclaimedRoutes);
                        var idCollision = client.Db.FromSql($@"SELECT
    {QuoteIdentifier(client.Db, "Id")},
    {QuoteIdentifier(client.Db, "ApiEngineKey")},
    {QuoteIdentifier(client.Db, "ApiAddress")}
FROM {QuoteIdentifier(client.Db, "sys_apiengine")}
WHERE {QuoteIdentifier(client.Db, "Id")}=@p0")
                            .AddInParameter("p0", source["Id"]?.ToString())
                            .First<dynamic>();

                        var persistedSource = CreatePersistableRuntimeDependencySource(source);
                        if (idCollision != null)
                        {
                            persistedSource["Id"] = Guid.NewGuid().ToString();
                            identityRemapped.Add(key + "：包内Id已占用，使用新Id");
                        }
                        persistedSource["OsClient"] = client.OsClient;
                        persistedSource["IsDeleted"] = 0;
                        persistedSource["CreateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                        persistedSource["UpdateTime"] = persistedSource["CreateTime"];
                        var addCount = PersistStartupDependencyDirect(
                            client.Db,
                            persistedSource,
                            existingId: null,
                            physicalFields: physicalFields);
                        if (addCount != 1)
                        {
                            return new DosResult(0, new { ApiEngineKey = key },
                                $"平台运行时接口[{key}]创建失败：数据库影响行数={addCount}");
                        }
                        added.Add(key);
                    }

                    // Some old databases have physical BIT columns without
                    // matching diy_field metadata.  FormEngine can then report
                    // success while silently ignoring these flags, so reconcile
                    // internal 0/1 constants physically and read them back.
                    var isEnable = ReadStartupSwitch(source["IsEnable"]);
                    var stopHttp = ReadStartupSwitch(source["StopHttp"]);
                    var allowAnonymous = ReadStartupSwitch(source["AllowAnonymous"]);
                    client.Db.FromSql($@"UPDATE {QuoteIdentifier(client.Db, "sys_apiengine")}
SET {QuoteIdentifier(client.Db, "IsEnable")}={isEnable},
    {QuoteIdentifier(client.Db, "StopHttp")}={stopHttp},
    {QuoteIdentifier(client.Db, "AllowAnonymous")}={allowAnonymous},
    {QuoteIdentifier(client.Db, "ApiAddress")}=@p0
WHERE {QuoteIdentifier(client.Db, "ApiEngineKey")}=@p1
  AND ({QuoteIdentifier(client.Db, "IsDeleted")}=0 OR {QuoteIdentifier(client.Db, "IsDeleted")} IS NULL)")
                        .AddInParameter("p0", source["ApiAddress"]?.ToString())
                        .AddInParameter("p1", key)
                        .ExecuteNonQuery();

                    var readback = ReadStartupDependencyEngine(client.Db, key, ignoreKeyCase: true);
                    var contractError = GetStartupDependencyContractError(readback, source);
                    if (!contractError.DosIsNullOrWhiteSpace())
                    {
                        return new DosResult(0, new
                        {
                            ApiEngineKey = key,
                            ContractError = contractError
                        }, $"平台运行时接口[{key}]写入后强回读不一致：{contractError}");
                    }
                    await InvalidateStartupDependencyCacheAsync(client.OsClient, readback)
                        .ConfigureAwait(false);
                }

                foreach (var key in RequiredStartupDependencyEngineKeys)
                {
                    if (!added.Contains(key, StringComparer.Ordinal)
                        && !reconciled.Contains(key, StringComparer.Ordinal)
                        && !reused.Contains(key, StringComparer.Ordinal))
                        reused.Add(key);
                }
                UpgradeExecutionLeaseContext.ConfirmOwnership();
                if (!StartupDependenciesReady(client, out var finalReason))
                    return new DosResult(0, null, "平台运行时接口闭包最终回读失败：" + finalReason);

                return new DosResult(1, new
                {
                    Verified = RequiredStartupDependencyEngineKeys.Length,
                    Added = added,
                    Reconciled = reconciled,
                    Reused = reused,
                    Overwritten = overwritten,
                    IdentityRemapped = identityRemapped,
                    Source = "EmbeddedOfficialApplicationPackages"
                }, added.Count > 0 || reconciled.Count > 0
                    ? $"已从内置官方应用包补齐平台运行时接口闭包（共{RequiredStartupDependencyEngineKeys.Length}项）。"
                    : $"平台运行时接口闭包已就绪（共{RequiredStartupDependencyEngineKeys.Length}项）。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, new
                {
                    Added = added,
                    Reconciled = reconciled,
                    Overwritten = overwritten,
                    IdentityRemapped = identityRemapped
                }, "平台运行时接口闭包检查异常：" + ex.Message);
            }
        }

        private static JObject ReadStartupDependencyEngine(
            DbSession database,
            string key,
            bool ignoreKeyCase = false)
        {
            var apiEngineKey = QuoteIdentifier(database, "ApiEngineKey");
            var predicate = ignoreKeyCase
                ? $"LOWER({apiEngineKey})=LOWER(@p0)"
                : $"{apiEngineKey}=@p0";
            var row = database.FromSql(
                    $"SELECT * FROM {QuoteIdentifier(database, "sys_apiengine")} WHERE {predicate}")
                .AddInParameter("p0", key)
                .First<dynamic>();
            return row == null ? null : JObject.FromObject(row);
        }

        /// <summary>
        /// Package-declared Managed routes are authoritative for the selected
        /// application version. Remove only colliding ApiAddress/ApiRoutes aliases
        /// from other engines; preserve their identity, source and unrelated routes.
        /// </summary>
        private static async Task<IReadOnlyList<string>> ReclaimStartupDependencyRoutesAsync(
            OsClientSecret client,
            JObject source,
            string ownerId,
            HashSet<string> physicalFields)
        {
            var claimedRoutes = new HashSet<string>(
                ApiEngineRouteAliases.GetConfiguredRoutes(source),
                StringComparer.OrdinalIgnoreCase);
            if (claimedRoutes.Count == 0) return Array.Empty<string>();

            var idColumn = QuoteIdentifier(client.Db, "Id");
            var keyColumn = QuoteIdentifier(client.Db, "ApiEngineKey");
            var addressColumn = QuoteIdentifier(client.Db, "ApiAddress");
            var hasApiRoutes = physicalFields.Contains("ApiRoutes");
            var routesColumn = hasApiRoutes ? QuoteIdentifier(client.Db, "ApiRoutes") : null;
            var rows = client.Db.FromSql($@"SELECT
    {idColumn},
    {keyColumn},
    {addressColumn}{(hasApiRoutes ? "," + Environment.NewLine + "    " + routesColumn : string.Empty)}
FROM {QuoteIdentifier(client.Db, "sys_apiengine")}").ToArray() ?? Array.Empty<dynamic>();
            var released = new List<string>();
            foreach (var raw in rows)
            {
                var row = JObject.FromObject((object)raw);
                var rowId = row["Id"]?.ToString();
                if (!ownerId.DosIsNullOrWhiteSpace()
                    && string.Equals(ownerId, rowId, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var oldAddress = row["ApiAddress"]?.ToString()?.Trim() ?? string.Empty;
                IReadOnlyList<string> oldRoutes = hasApiRoutes
                    ? ApiEngineRouteAliases.Parse(row["ApiRoutes"]?.ToString())
                    : Array.Empty<string>();
                var removedRoutes = new List<string>();
                if (!oldAddress.DosIsNullOrWhiteSpace() && claimedRoutes.Contains(oldAddress))
                    removedRoutes.Add(oldAddress);
                removedRoutes.AddRange(oldRoutes.Where(claimedRoutes.Contains));
                if (removedRoutes.Count == 0) continue;

                await InvalidateStartupDependencyCacheAsync(client.OsClient, row)
                    .ConfigureAwait(false);
                var keptRoutes = oldRoutes.Where(route => !claimedRoutes.Contains(route)).ToArray();
                var command = hasApiRoutes
                    ? client.Db.FromSql($@"UPDATE {QuoteIdentifier(client.Db, "sys_apiengine")}
SET {addressColumn}=@p1,
    {routesColumn}=@p2
WHERE {idColumn}=@p0")
                    : client.Db.FromSql($@"UPDATE {QuoteIdentifier(client.Db, "sys_apiengine")}
SET {addressColumn}=@p1
WHERE {idColumn}=@p0");
                command.AddInParameter("p0", rowId)
                    .AddInParameter(
                        "p1",
                        claimedRoutes.Contains(oldAddress) ? (object)DBNull.Value : oldAddress);
                if (hasApiRoutes)
                {
                    command.AddInParameter(
                        "p2",
                        keptRoutes.Length > 0
                            ? (object)string.Join(";", keptRoutes)
                            : DBNull.Value);
                }
                var affected = command.ExecuteNonQuery();
                if (affected != 1)
                {
                    throw new InvalidOperationException(
                        $"平台运行时接口[{source?["ApiEngineKey"]}]收回包声明路由未命中唯一记录：{rowId}");
                }
                released.Add(
                    $"{source?["ApiEngineKey"]}：收回路由[{string.Join("；", removedRoutes)}]，原接口="
                    + (row["ApiEngineKey"]?.ToString() ?? rowId));
            }
            return released;
        }

        private static bool IsCreateIfMissingRuntimeDependency(JObject source)
        {
            return string.Equals(
                       source?["_OfficialOwnership"]?.ToString(),
                       "Tenant",
                       StringComparison.Ordinal)
                   && string.Equals(
                       source?["_OfficialUpgradePolicy"]?.ToString(),
                       "CreateIfMissing",
                       StringComparison.Ordinal);
        }

        private static JObject CreatePersistableRuntimeDependencySource(JObject source)
        {
            var result = source == null ? new JObject() : (JObject)source.DeepClone();

            // 兼容 v7.7.2 及更早应用商城包的接口展示名称别名。ApiName 才是
            // sys_apiengine 的真实物理列；已有 ApiName 时绝不让旧 Name 覆盖它。
            if (result["ApiName"].Val<string>().DosIsNullOrWhiteSpace()
                && !result["Name"].Val<string>().DosIsNullOrWhiteSpace())
            {
                result["ApiName"] = result["Name"];
            }

            result.Remove("_OfficialPackageResource");
            result.Remove("_OfficialOwnership");
            result.Remove("_OfficialUpgradePolicy");
            foreach (var property in result.Properties()
                         .Where(property => !StartupDependencyPhysicalFields.Contains(property.Name))
                         .ToArray())
            {
                property.Remove();
            }

            var key = result["ApiEngineKey"].Val<string>();
            if (result["ApiName"].Val<string>().DosIsNullOrWhiteSpace())
                result["ApiName"] = key;
            if (result["UserId"].Val<string>().DosIsNullOrWhiteSpace())
                result["UserId"] = StartupDependencySystemUserId;
            if (result["UserName"].Val<string>().DosIsNullOrWhiteSpace())
                result["UserName"] = StartupDependencySystemUserName;

            // 早期 sys_apiengine 的多个基础列曾使用 NOT NULL 且没有数据库默认值。
            // 包资源允许省略可推导的零值，但启动门禁必须先形成一条完整、可安全插入
            // 的物理记录；随后还会与目标租户真实列取交集，不会向旧库写入不存在的列。
            if (result["IsDeleted"] == null || result["IsDeleted"].Type == JTokenType.Null)
                result["IsDeleted"] = 0;
            if (result["IsEnable"] == null || result["IsEnable"].Type == JTokenType.Null)
                result["IsEnable"] = 1;
            if (result["StopHttp"] == null || result["StopHttp"].Type == JTokenType.Null)
                result["StopHttp"] = 0;
            if (result["AllowAnonymous"] == null || result["AllowAnonymous"].Type == JTokenType.Null)
                result["AllowAnonymous"] = 0;
            if (result["EnableLog"] == null || result["EnableLog"].Type == JTokenType.Null)
                result["EnableLog"] = 0;
            if (result["ResponseFile"] == null || result["ResponseFile"].Type == JTokenType.Null)
                result["ResponseFile"] = 0;
            if (result["Lock"] == null || result["Lock"].Type == JTokenType.Null)
                result["Lock"] = 0;
            if (result["ApiRole"].Val<string>().DosIsNullOrWhiteSpace())
                result["ApiRole"] = "[]";
            if (result["Files"].Val<string>().DosIsNullOrWhiteSpace())
                result["Files"] = "[]";
            if (key.DosIsNullOrWhiteSpace()
                || result["Id"].Val<string>().DosIsNullOrWhiteSpace()
                || result["ApiAddress"].Val<string>().DosIsNullOrWhiteSpace()
                || result["ApiV8Code"].Val<string>().DosIsNullOrWhiteSpace())
            {
                throw new InvalidOperationException("平台运行时接口缺少 Id、ApiEngineKey、ApiAddress 或 ApiV8Code，拒绝持久化。");
            }
            return result;
        }

        private static JObject IntersectStartupDependencyWithPhysicalFields(
            JObject source,
            HashSet<string> physicalFields)
        {
            if (physicalFields == null || physicalFields.Count == 0)
                throw new InvalidOperationException("未读取到 sys_apiengine 物理字段，拒绝盲目写入启动接口闭包。");

            var result = source == null ? new JObject() : (JObject)source.DeepClone();
            foreach (var property in result.Properties()
                         .Where(property => !StartupDependencyPhysicalFields.Contains(property.Name)
                                            || !physicalFields.Contains(property.Name))
                         .ToArray())
            {
                property.Remove();
            }
            return result;
        }

        private static HashSet<string> ReadStartupDependencyPhysicalFields(
            DbSession database,
            string osClient)
        {
            var columnResult = MicroiEngine.ORM(database.Db.DbProvider.DatabaseType).GetColumns(
                new DbServiceParam
                {
                    OsClient = osClient,
                    TableName = "sys_apiengine",
                    DbSession = database
                });
            if (columnResult?.Code != 1 || columnResult.Data == null)
                throw new InvalidOperationException(
                    "读取 sys_apiengine 物理字段失败：" + (columnResult?.Msg ?? "接口无返回"));

            var fields = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var token in JArray.FromObject(columnResult.Data))
            {
                var row = token as JObject ?? JObject.FromObject(token);
                var name = row.GetValue("column_name", StringComparison.OrdinalIgnoreCase)?.ToString()
                           ?? row.GetValue("ColumnName", StringComparison.OrdinalIgnoreCase)?.ToString();
                if (!name.DosIsNullOrWhiteSpace()) fields.Add(name);
            }
            if (fields.Count == 0)
                throw new InvalidOperationException("sys_apiengine 物理字段回读为空，拒绝盲目写入启动接口闭包。");
            return fields;
        }

        /// <summary>
        /// 启动闭包属于 API 接收流量前的物理协议门禁，不能依赖 diy_table/diy_field
        /// 元数据。部分早期子租户只有 sys_apiengine 物理表而没有对应低代码元数据，
        /// 继续走 FormEngine 会在修复第一个接口时反而报 diy_table NoExistData。
        /// 这里仅对程序集内受信官方包的固定字段执行参数化 INSERT/UPDATE；业务应用
        /// 的完整安装、资源策略与版本记录仍由应用商城导入器负责。
        /// </summary>
        private static int PersistStartupDependencyDirect(
            DbSession database,
            JObject source,
            string existingId,
            HashSet<string> physicalFields)
        {
            if (database == null) throw new ArgumentNullException(nameof(database));
            if (source == null) throw new ArgumentNullException(nameof(source));

            var persisted = (JObject)source.DeepClone();
            persisted.Remove("OsClient");
            persisted.Remove("_OfficialPackageResource");
            persisted.Remove("_OfficialOwnership");
            persisted.Remove("_OfficialUpgradePolicy");
            var now = DateTime.Now;
            persisted["UpdateTime"] = JToken.FromObject(now);
            if (existingId.DosIsNullOrWhiteSpace())
                persisted["CreateTime"] = JToken.FromObject(now);
            persisted = IntersectStartupDependencyWithPhysicalFields(persisted, physicalFields);

            foreach (var requiredField in new[] { "Id", "ApiEngineKey", "ApiAddress", "ApiV8Code" })
            {
                if (!physicalFields.Contains(requiredField))
                    throw new InvalidOperationException(
                        $"sys_apiengine 缺少启动闭包必需物理字段 {requiredField}，请先完成物理字段升级。");
            }

            var fields = persisted.Properties()
                .Where(property => existingId.DosIsNullOrWhiteSpace()
                    || (!string.Equals(property.Name, "Id", StringComparison.OrdinalIgnoreCase)
                        && !string.Equals(property.Name, "CreateTime", StringComparison.OrdinalIgnoreCase)))
                .ToArray();
            if (fields.Length == 0)
                throw new InvalidOperationException("平台运行时接口没有可持久化字段。");

            var section = existingId.DosIsNullOrWhiteSpace()
                ? database.FromSql(
                    $"INSERT INTO {QuoteIdentifier(database, "sys_apiengine")} ({string.Join(",", fields.Select(field => QuoteIdentifier(database, field.Name)))}) "
                    + $"VALUES ({string.Join(",", fields.Select((_, index) => "@p" + index))})")
                : database.FromSql(
                    $"UPDATE {QuoteIdentifier(database, "sys_apiengine")} SET {string.Join(",", fields.Select((field, index) => QuoteIdentifier(database, field.Name) + "=@p" + index))} "
                    + $"WHERE {QuoteIdentifier(database, "Id") }=@p{fields.Length}");

            for (var index = 0; index < fields.Length; index++)
                section.AddInParameter(
                    "p" + index,
                    ReadDatabaseValue(database, fields[index].Name, fields[index].Value));
            if (!existingId.DosIsNullOrWhiteSpace())
                section.AddInParameter("p" + fields.Length, existingId);
            return section.ExecuteNonQuery();
        }

        private static string QuoteIdentifier(DbSession database, string identifier)
        {
            return database.Db.DbProvider.DatabaseType switch
            {
                DatabaseType.SqlServer or DatabaseType.SqlServer9 => "[" + identifier + "]",
                DatabaseType.PostgreSql or DatabaseType.KingBase
                    or DatabaseType.Oracle or DatabaseType.DaMeng => "\"" + identifier + "\"",
                _ => "`" + identifier + "`"
            };
        }

        private static object ReadDatabaseValue(
            DbSession database,
            string fieldName,
            JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                return DBNull.Value;
            if (ApiEngineBitColumns.Contains(fieldName))
                return (short)ReadStartupSwitch(token);
            return token.Type switch
            {
                JTokenType.Integer => ReadDatabaseInteger(token.Value<long>()),
                JTokenType.Float => token.Value<decimal>(),
                JTokenType.Boolean => token.Value<bool>() ? 1 : 0,
                JTokenType.Date => ReadDatabaseDateTime(database, token.Value<DateTime>()),
                JTokenType.Bytes => token.Value<byte[]>(),
                JTokenType.Array or JTokenType.Object => token.ToString(Formatting.None),
                _ => token.ToString()
            };
        }

        private static object ReadDatabaseInteger(long value)
        {
            return value >= int.MinValue && value <= int.MaxValue
                ? (object)(int)value
                : value;
        }

        private static DateTime ReadDatabaseDateTime(DbSession database, DateTime value)
        {
            if (database?.Db?.DbProvider?.DatabaseType != DatabaseType.PostgreSql)
                return value;
            if (value.Kind == DateTimeKind.Utc)
                return value;
            return value.Kind == DateTimeKind.Local
                ? value.ToUniversalTime()
                : DateTime.SpecifyKind(value, DateTimeKind.Local).ToUniversalTime();
        }

        private static string GetStartupDependencyContractError(JObject row, JObject source)
        {
            if (row == null) return "不存在";
            if (IsCreateIfMissingRuntimeDependency(source)) return string.Empty;
            if (ReadStartupSwitch(row["IsDeleted"]) == 1) return "处于软删除状态";
            if (string.IsNullOrWhiteSpace(row["ApiV8Code"]?.ToString()))
                return "ApiV8Code为空";
            if (ReadStartupSwitch(row["IsEnable"]) != ReadStartupSwitch(source?["IsEnable"]))
                return "IsEnable不一致";
            if (ReadStartupSwitch(row["StopHttp"]) != ReadStartupSwitch(source?["StopHttp"]))
                return "StopHttp不一致";
            if (ReadStartupSwitch(row["AllowAnonymous"])
                != ReadStartupSwitch(source["AllowAnonymous"])) return "AllowAnonymous不一致";
            if (!string.Equals(row["ApiAddress"]?.ToString(), source["ApiAddress"]?.ToString(), StringComparison.Ordinal))
                return "ApiAddress不一致";
            if (!string.Equals(
                NormalizeStartupDependencySource(row["ApiV8Code"]?.ToString()),
                NormalizeStartupDependencySource(source?["ApiV8Code"]?.ToString()),
                StringComparison.Ordinal))
            {
                return "ApiV8Code与包内Managed源码不一致";
            }
            if (!string.IsNullOrWhiteSpace(source?["Version"]?.ToString())
                && !string.Equals(
                    row["Version"]?.ToString(),
                    source["Version"]?.ToString(),
                    StringComparison.OrdinalIgnoreCase))
            {
                return "Version与包内Managed版本不一致";
            }
            if (source?["ApiRoutes"] != null
                && !string.Equals(
                    row["ApiRoutes"]?.ToString() ?? string.Empty,
                    source["ApiRoutes"]?.ToString() ?? string.Empty,
                    StringComparison.Ordinal))
            {
                return "ApiRoutes与包内Managed路由不一致";
            }
            return string.Empty;
        }

        private static string NormalizeStartupDependencySource(string source)
        {
            return (source ?? string.Empty).Replace("\r\n", "\n").Trim();
        }

        private static int ReadStartupSwitch(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null) return 0;
            if (token.Type == JTokenType.Boolean) return token.Value<bool>() ? 1 : 0;
            if (token.Type == JTokenType.Integer || token.Type == JTokenType.Float)
                return token.Value<double>() == 0 ? 0 : 1;
            if (token.Type == JTokenType.Bytes)
                return token.Value<byte[]>()?.Any(value => value != 0) == true ? 1 : 0;
            var text = token.ToString().Trim();
            if (bool.TryParse(text, out var boolean)) return boolean ? 1 : 0;
            if (long.TryParse(text, out var number)) return number == 0 ? 0 : 1;
            try
            {
                var bytes = Convert.FromBase64String(text);
                return bytes.Any(value => value != 0) ? 1 : 0;
            }
            catch
            {
                return 0;
            }
        }

        private static async Task InvalidateStartupDependencyCacheAsync(
            string osClient,
            JObject row)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            foreach (var value in ApiEngineRouteAliases.GetCacheAliases(row))
            {
                await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{value}")
                    .ConfigureAwait(false);
                var lower = value.ToLowerInvariant();
                if (!string.Equals(value, lower, StringComparison.Ordinal))
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{lower}")
                        .ConfigureAwait(false);
            }
        }

        private static Task<Dictionary<string, string>> LoadUpgradeResourcesAsync()
        {
            // 同一 API 进程内所有租户共享同一组受校验的官方资源。此前每个租户都
            // 重复下载整组资源，74 个租户会产生数百次外部请求并把启动时间放大到
            // 数十分钟。Lazy<Task<...>> 同时保证并发租户只执行一次下载或一次回退。
            return UpgradeResources.Value;
        }

        private static async Task<Dictionary<string, string>> LoadUpgradeResourcesCoreAsync()
        {
            var bundledResources = LoadBundledResources();
            try
            {
                var onlineResourceNames = RequiredResourceNames
                    .Where(resourceName => !string.Equals(resourceName, BuildAiAppResourceName, StringComparison.Ordinal));
                Console.WriteLine($"Microi：【基础应用升级】开始并行读取吾码官方升级资源（共{onlineResourceNames.Count()}项，单项超时8秒）。");
                var pairs = await Task.WhenAll(onlineResourceNames.Select(async resourceName =>
                    new KeyValuePair<string, string>(resourceName, await DownloadOfficialResourceAsync(resourceName))));
                Console.WriteLine("Microi：【基础应用升级】官方资源整组校验成功，使用在线最新版。");
                var resources = pairs.ToDictionary(item => item.Key, item => item.Value, StringComparer.Ordinal);
                // 构建器随当前服务器版本发布，确保客户即使连接到较旧的官方资源服务，
                // 也不会再次安装缺少租户 ApiBase/OsClient 上下文的旧入口发布逻辑。
                resources[BuildAiAppResourceName] = bundledResources[BuildAiAppResourceName];
                return resources;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【基础应用升级】官方资源不可用，整组回退到程序集内置资源：{ex.Message}");
                return bundledResources;
            }
        }

        private static async Task<string> DownloadOfficialResourceAsync(string resourceName)
        {
            var url = OfficialResourceApiUrl + "&Name=" + Uri.EscapeDataString(resourceName);
            using (var response = await ResourceHttpClient.GetAsync(url))
            {
                var body = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                {
                    throw new InvalidOperationException($"从吾码官方数据库获取升级资源[{resourceName}]失败，HTTP状态码：{(int)response.StatusCode}");
                }

                var content = ParseOfficialResourceResponse(resourceName, body);
                ValidateResourceContent(resourceName, content);
                Console.WriteLine($"Microi：【基础应用升级】已从吾码官方数据库获取并校验升级资源：{resourceName}");
                return content;
            }
        }

        private static string ParseOfficialResourceResponse(string resourceName, string body)
        {
            if (body.DosIsNullOrWhiteSpace())
            {
                throw new InvalidOperationException($"吾码官方数据库返回的升级资源[{resourceName}]为空。");
            }

            JObject response;
            try
            {
                response = JObject.Parse(body);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"吾码官方数据库返回的升级资源[{resourceName}]不是标准JSON响应。", ex);
            }

            if (response["Code"]?.Value<int>() != 1)
            {
                throw new InvalidOperationException($"吾码官方数据库返回升级资源[{resourceName}]失败：{response["Msg"]}");
            }

            var returnedResourceName = response["Data"]?["ResourceName"]?.ToString();
            if (!string.Equals(returnedResourceName, resourceName, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"吾码官方数据库返回的资源名不匹配，期望[{resourceName}]，实际[{returnedResourceName}]。");
            }

            var contentToken = response["Data"]?["Content"];
            if (contentToken == null)
            {
                throw new InvalidOperationException($"吾码官方数据库返回的升级资源[{resourceName}]缺少Data.Content。");
            }

            return contentToken.Type == JTokenType.String
                ? contentToken.ToString()
                : contentToken.ToString(Formatting.None);
        }

        private static void ValidateResourceContent(string resourceName, string content)
        {
            if (content.DosIsNullOrWhiteSpace())
            {
                throw new InvalidOperationException($"吾码官方数据库返回的升级资源[{resourceName}]内容为空。");
            }

            if (string.Equals(resourceName, ImportPackageResourceName, StringComparison.Ordinal))
            {
                if (!content.Contains("import-microi-store-package"))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]内容校验失败，未找到目标接口Key。");
                }
                var versionMatch = Regex.Match(content, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!versionMatch.Success ||
                    !System.Version.TryParse(versionMatch.Groups[1].Value, out var importerVersion) ||
                    !HasPinnedImporterCapabilities(content, importerVersion) ||
                    !content.Contains("applicationSha256Base64") ||
                    !content.Contains("field_primary_recovered_") ||
                    !content.Contains("preserve_interface_engine_pagetabs_") ||
                    !content.Contains("System.DateTime.Now.ToString") ||
                    !content.Contains("rename_skipped_target_exists_") ||
                    !content.Contains("MicroServiceMenusPreserved") ||
                    !content.Contains("sourceExpected") ||
                    !content.Contains("validationSourceExpected") ||
                    !content.Contains("stableMenuUrl") ||
                    !content.Contains("normalizeRouteMeta") ||
                    !content.Contains("recoverBoundMicroserviceMenus") ||
                    !content.Contains("preservedLegacyUrl") ||
                    !content.Contains("preserve_existing_menu_visibility_") ||
                    !content.Contains("SKIP_MOVE_FOR_REUSED_BUILD_V1") ||
                    !content.Contains("MICRO_APP_PUBLIC_HDFS_PATH_V1") ||
                    !content.Contains("DB_RUNTIME_BUILD_ASSETS_V1") ||
                    !content.Contains("PRUNE_ASSET_IDS_WITH_DELFORM_V1") ||
                    !content.Contains("BACKGROUND_TASK_BOOTSTRAP_READINESS_V1") ||
                    !content.Contains("BACKGROUND_TASK_RUNTIME_SCOPE_V1") ||
                    !content.Contains("APPLICATION_ASSET_BACKGROUND_CHUNKS_V1") ||
                    !content.Contains("ASSET_METADATA_WITHOUT_SECOND_DECODE_V1") ||
                    !content.Contains("DATASET_INSERT_IF_MISSING_V1") ||
                    !content.Contains("PACKAGE_API_ENGINE_READBACK_V1") ||
                    !content.Contains("API_ENGINE_RESOURCE_BASELINE_V1") ||
                    !content.Contains("TRUSTED_OFFICIAL_PLATFORM_PACKAGE_V1") ||
                    !content.Contains("PACKAGE_MANAGED_OVERWRITE_V2") ||
                    !content.Contains("PACKAGE_API_ENGINE_IDENTITY_RECONCILIATION_V2") ||
                    !content.Contains("GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_V1") ||
                    !content.Contains("DATABASE_ONLY_BUILD_ASSETS_V1") ||
                    !content.Contains("BACKGROUND_TASK_MONOTONIC_PROGRESS_V1") ||
                    !content.Contains("BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1") ||
                    !content.Contains("OBJECT_STORAGE_FORBIDDEN") ||
                    !content.Contains("SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1") ||
                    !content.Contains("LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1") ||
                    !content.Contains("MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1") ||
                    !content.Contains("ADMIN_MENU_PERMISSION_V1") ||
                    !content.Contains("ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1") ||
                    !content.Contains("ADMIN_MENU_PERMISSION_DB_TIME_V1"))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]版本过旧或缺少幂等安装保护，拒绝覆盖客户数据库。");
                }
                return;
            }

            if (string.Equals(resourceName, PublishAiAppResourceName, StringComparison.Ordinal))
            {
                var publisherVersionMatch = Regex.Match(content, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!content.Contains("ai_app_publish_store") ||
                    !publisherVersionMatch.Success ||
                    !System.Version.TryParse(publisherVersionMatch.Groups[1].Value, out var publisherVersion) ||
                    publisherVersion < new System.Version(1, 7, 7) ||
                    !content.Contains("OfflineSelfContained") ||
                    !content.Contains("IncludeSource: includeSource") ||
                    !content.Contains("action === 'PackageOnly'") ||
                    !content.Contains("ReturnPackageModel") ||
                    !content.Contains("buildApiEngineResourcePolicies") ||
                    !content.Contains("OFFICIAL_PLATFORM_API_ENGINE_OWNERSHIP_V1") ||
                    !content.Contains("SOURCE_BUILD_ARCHIVE_ROOTS_V1"))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]内容校验失败，未找到目标接口Key。");
                }
                return;
            }

            if (string.Equals(resourceName, BuildAiAppResourceName, StringComparison.Ordinal))
            {
                var builderVersionMatch = Regex.Match(content, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!content.Contains("ApiEngineKey: ai_app_build") ||
                    !builderVersionMatch.Success ||
                    !System.Version.TryParse(builderVersionMatch.Groups[1].Value, out var builderVersion) ||
                    builderVersion < new System.Version(1, 4, 5) ||
                    !content.Contains("TENANT_RUNTIME_CONTEXT_V1") ||
                    !content.Contains("UNIFIED_UNIAPP_PREVIEW_SHELL_V1") ||
                    !content.Contains("injectRuntimeContext") ||
                    !content.Contains("V8.SysConfig && V8.SysConfig.ApiBase"))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]缺少当前租户运行时上下文注入能力。");
                }
                return;
            }

            JObject package;
            try
            {
                package = JObject.Parse(content);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"升级资源[{resourceName}]不是有效的应用数据包JSON。", ex);
            }

            var expectedPackageName = ExpectedPackageNames[resourceName];
            var actualPackageName = package["PackageInfo"]?["Name"]?.ToString();
            if (!string.Equals(actualPackageName, expectedPackageName, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"升级资源[{resourceName}]数据包名称不匹配，期望[{expectedPackageName}]，实际[{actualPackageName}]。");
            }

            if (!HasPackagedV8FirstApplicationRuntime(resourceName, package))
            {
                throw new InvalidOperationException(
                    $"升级资源[{resourceName}]缺少当前 V8 引擎优先接口、单一官方应用所有权、醒目恢复提示或 CreateIfMissing 个性化 Hook。"
                );
            }

            if (string.Equals(resourceName, SsoPackageResourceName, StringComparison.Ordinal)
                && !HasPackagedSsoRuntime(package))
            {
                throw new InvalidOperationException(
                    $"升级资源[{resourceName}]缺少 v7.5.9 SSO Platform/Managed HTTP 端点闭包、醒目恢复提示、安全 Hook 白名单或 CreateIfMissing 默认模板。"
                );
            }

            if (string.Equals(resourceName, SaaSEnginePackageResourceName, StringComparison.Ordinal))
            {
                if (!HasPackagedPlatformRuntime(package))
                {
                    throw new InvalidOperationException(
                        $"升级资源[{resourceName}]缺少 v7.7.8 平台运行时 Managed 基线、完整声明闭包、CreateIfMissing Hook、安全 microi-init、登录壁纸可信原子契约或完整资源策略。"
                    );
                }

                var bundle = (package["ApplicationBundles"] as JArray)?.FirstOrDefault() as JObject;
                var sourceFiles = bundle?["SourceFiles"] as JArray;
                var buildAssets = bundle?["BuildAssets"] as JArray;
                var packageAssets = bundle?["PackageAssets"];
                var packageAssetsObject = packageAssets as JObject;
                var buildBytes = buildAssets?.Sum(item => item?["Size"]?.Value<long?>() ?? 0L) ?? 0L;
                if (package["PackageInfo"]?["IncludeSource"]?.Value<bool?>() != false
                    || bundle?["IncludeSource"]?.Value<bool?>() != false
                    || (sourceFiles?.Count ?? 0) != 0
                    || (packageAssets != null
                        && packageAssets.Type != JTokenType.Null
                        && packageAssetsObject == null)
                    || packageAssetsObject?["SourceZip"] != null
                    || !string.Equals(bundle?["MicroService"]?["StorageMode"]?.ToString(), "db", StringComparison.OrdinalIgnoreCase)
                    || !string.Equals(bundle?["AssetStoragePolicy"]?["Source"]?.ToString(), "NotIncluded", StringComparison.Ordinal)
                    || !string.Equals(bundle?["AssetStoragePolicy"]?["Build"]?.ToString(), "DatabaseOnly", StringComparison.Ordinal)
                    || (buildAssets?.Count ?? 0) < 1
                    || buildAssets.Count > 256
                    || buildBytes > 5L * 1024 * 1024)
                {
                    throw new InvalidOperationException(
                        $"升级资源[{resourceName}]必须以无伪源码、256 文件/5MB 内的 DatabaseOnly 平台内置微服务发布。"
                    );
                }
            }

            if (string.Equals(resourceName, AppStorePackageResourceName, StringComparison.Ordinal))
            {
                var packageVersionText = package["PackageInfo"]?["Version"]?.ToString()?.TrimStart('v', 'V');
                var packageEngines = package["SysApiEngines"] as JArray;
                var buildZipEngineCode = packageEngines?
                    .FirstOrDefault(item => string.Equals(item?["ApiEngineKey"]?.ToString(), "ai_app_download_build_zip", StringComparison.Ordinal))?
                    ["ApiV8Code"]?.ToString() ?? string.Empty;
                var sourceZipEngineCode = packageEngines?
                    .FirstOrDefault(item => string.Equals(item?["ApiEngineKey"]?.ToString(), "ai_app_download_source_zip", StringComparison.Ordinal))?
                    ["ApiV8Code"]?.ToString() ?? string.Empty;
                var importerEngine = packageEngines?
                    .FirstOrDefault(item => string.Equals(item?["ApiEngineKey"]?.ToString(), "import-microi-store-package", StringComparison.Ordinal));
                var importerEngineCode = importerEngine?["ApiV8Code"]?.ToString() ?? string.Empty;
                var importerEngineVersionText = importerEngine?["Version"]?.ToString()?.TrimStart('v', 'V');
                var bulkEngine = packageEngines?
                    .FirstOrDefault(item => string.Equals(item?["ApiEngineKey"]?.ToString(), "bulk-import-microi-store-packages", StringComparison.Ordinal));
                var bulkEngineCode = bulkEngine?["ApiV8Code"]?.ToString() ?? string.Empty;
                var bulkEngineVersionText = bulkEngine?["Version"]?.ToString()?.TrimStart('v', 'V');
                var backgroundTaskEngine = packageEngines?
                    .FirstOrDefault(item => string.Equals(
                        item?["ApiEngineKey"]?.ToString(),
                        PlatformBackgroundTaskEngineKey,
                        StringComparison.Ordinal));
                var backgroundTaskEngineCode = backgroundTaskEngine?["ApiV8Code"]?.ToString() ?? string.Empty;
                var backgroundTaskEngineVersionText = backgroundTaskEngine?["Version"]?.ToString()?.TrimStart('v', 'V');
                var backgroundTaskPolicy = package["ResourcePolicies"]?["ApiEngines"]?[PlatformBackgroundTaskEngineKey];
                var sysMenuEngine = packageEngines?
                    .FirstOrDefault(item => string.Equals(
                        item?["ApiEngineKey"]?.ToString(),
                        PlatformSysMenuEngineKey,
                        StringComparison.Ordinal));
                var sysMenuEngineCode = sysMenuEngine?["ApiV8Code"]?.ToString() ?? string.Empty;
                var sysMenuEngineVersionText = sysMenuEngine?["Version"]?.ToString()?.TrimStart('v', 'V');
                var sysMenuPolicy = package["ResourcePolicies"]?["ApiEngines"]?[PlatformSysMenuEngineKey];
                var officialResourceEngine = packageEngines?
                    .FirstOrDefault(item => string.Equals(
                        item?["ApiEngineKey"]?.ToString(),
                        OfficialResourcePublisherEngineKey,
                        StringComparison.Ordinal));
                var officialResourceEngineCode = officialResourceEngine?["ApiV8Code"]?.ToString() ?? string.Empty;
                var officialResourceEngineVersionText = officialResourceEngine?["Version"]?.ToString()?.TrimStart('v', 'V');
                var officialResourcePolicy = package["ResourcePolicies"]?["ApiEngines"]?[OfficialResourcePublisherEngineKey];
                var requiredCapabilities = package["PackageInfo"]?["RequiredPlatformCapabilities"] as JArray;
                if (!System.Version.TryParse(packageVersionText, out var packageVersion) ||
                    packageVersion < new System.Version(7, 5, 55) ||
                    !System.Version.TryParse(importerEngineVersionText, out var embeddedImporterVersion) ||
                    !HasPinnedImporterCapabilities(importerEngineCode, embeddedImporterVersion) ||
                    !System.Version.TryParse(bulkEngineVersionText, out var embeddedBulkVersion) ||
                    !HasPinnedBulkCapabilities(bulkEngineCode, embeddedBulkVersion) ||
                    bulkEngine?["IsEnable"]?.Value<int>() != 1 ||
                    bulkEngine?["StopHttp"]?.Value<int>() != 0 ||
                    !System.Version.TryParse(backgroundTaskEngineVersionText, out var embeddedBackgroundTaskVersion) ||
                    !HasPlatformBackgroundTaskCapabilities(backgroundTaskEngineCode, embeddedBackgroundTaskVersion) ||
                    !string.Equals(
                        backgroundTaskEngine?["ApiAddress"]?.ToString(),
                        PlatformBackgroundTaskApiAddress,
                        StringComparison.OrdinalIgnoreCase) ||
                    backgroundTaskEngine?["IsEnable"]?.Value<int>() != 1 ||
                    backgroundTaskEngine?["StopHttp"]?.Value<int>() != 0 ||
                    backgroundTaskEngine?["AllowAnonymous"]?.Value<int>() != 0 ||
                    !string.Equals(
                        backgroundTaskPolicy?["UpgradePolicy"]?.ToString(),
                        "Managed",
                        StringComparison.Ordinal) ||
                    requiredCapabilities?.Any(item => string.Equals(
                        item?.ToString(),
                        "ServerFeature:V8.ManageBackgroundTask",
                        StringComparison.Ordinal)) != true ||
                    requiredCapabilities?.Any(item => string.Equals(
                        item?.ToString(),
                        "ApiEngine:platform-background-task@v1.1.0",
                        StringComparison.Ordinal)) != true ||
                    !System.Version.TryParse(sysMenuEngineVersionText, out var embeddedSysMenuVersion) ||
                    !HasPlatformSysMenuCapabilities(sysMenuEngineCode, embeddedSysMenuVersion) ||
                    !string.Equals(
                        sysMenuEngine?["ApiAddress"]?.ToString(),
                        PlatformSysMenuApiAddress,
                        StringComparison.OrdinalIgnoreCase) ||
                    sysMenuEngine?["IsEnable"]?.Value<int>() != 1 ||
                    sysMenuEngine?["StopHttp"]?.Value<int>() != 0 ||
                    sysMenuEngine?["AllowAnonymous"]?.Value<int>() != 0 ||
                    !string.Equals(
                        sysMenuPolicy?["UpgradePolicy"]?.ToString(),
                        "Managed",
                        StringComparison.Ordinal) ||
                    requiredCapabilities?.Any(item => string.Equals(
                        item?.ToString(),
                        "V8.Method.ManageSystemDirectory",
                        StringComparison.Ordinal)) != true ||
                    requiredCapabilities?.Any(item => string.Equals(
                        item?.ToString(),
                        "ApiEngine:platform-sys-menu@v1.0.1",
                        StringComparison.Ordinal)) != true ||
                    !System.Version.TryParse(officialResourceEngineVersionText, out var embeddedOfficialResourceVersion) ||
                    embeddedOfficialResourceVersion < new System.Version(1, 2, 8) ||
                    officialResourceEngine?["IsEnable"]?.Value<int>() != 1 ||
                    officialResourceEngine?["AllowAnonymous"]?.Value<int>() != 1 ||
                    !string.Equals(
                        officialResourcePolicy?["UpgradePolicy"]?.ToString(),
                        "Managed",
                        StringComparison.Ordinal) ||
                    !officialResourceEngineCode.Contains("V8.Method.AuthorizeOfficialResourcePublish()") ||
                    requiredCapabilities?.Any(item => string.Equals(
                        item?.ToString(),
                        "V8.Method.AuthorizeOfficialResourcePublish",
                        StringComparison.Ordinal)) != true ||
                    !HasApiEngineCapabilityAtLeast(
                        requiredCapabilities,
                        OfficialResourcePublisherEngineKey,
                        new System.Version(1, 2, 8)) ||
                    !content.Contains("TargetSysMenuId") ||
                    !content.Contains("01KXFSG7MZ40CY8KCWCZZZJH2M") ||
                    !content.Contains("01KXFSG8153B3VZPZ45WNCCFHR") ||
                    !content.Contains(ApplicationAssetUploadAuditMenuId) ||
                    !content.Contains("ApplicationAssetMultipartSession") ||
                    !content.Contains("UploadRecoveryHint") ||
                    !content.Contains("RunBackground('bulk-import-microi-store-packages'") ||
                    !content.Contains("BULK_PLATFORM_BOOTSTRAP_ORDER_V1") ||
                    !content.Contains("MARKETPLACE_LEGACY_IMPORTER_HDFS_BRIDGE_V1") ||
                    !buildZipEngineCode.Contains("REAL_BUILD_ZIP_ASSETS_V1") ||
                    !sourceZipEngineCode.Contains("SOURCE_ONLY_ZIP_ROOT_V1") ||
                    !importerEngineCode.Contains("SKIP_MOVE_FOR_REUSED_BUILD_V1") ||
                    !importerEngineCode.Contains("MICRO_APP_PUBLIC_HDFS_PATH_V1") ||
                    !importerEngineCode.Contains("DB_RUNTIME_BUILD_ASSETS_V1") ||
                    !importerEngineCode.Contains("PRUNE_ASSET_IDS_WITH_DELFORM_V1") ||
                    !importerEngineCode.Contains("BACKGROUND_TASK_BOOTSTRAP_READINESS_V1") ||
                    !importerEngineCode.Contains("BACKGROUND_TASK_RUNTIME_SCOPE_V1") ||
                    !importerEngineCode.Contains("APPLICATION_ASSET_BACKGROUND_CHUNKS_V1") ||
                    !importerEngineCode.Contains("ASSET_METADATA_WITHOUT_SECOND_DECODE_V1") ||
                    !importerEngineCode.Contains("DATASET_INSERT_IF_MISSING_V1") ||
                    !importerEngineCode.Contains("PACKAGE_API_ENGINE_READBACK_V1") ||
                    !importerEngineCode.Contains("API_ENGINE_RESOURCE_BASELINE_V1") ||
                    !importerEngineCode.Contains("TRUSTED_OFFICIAL_PLATFORM_PACKAGE_V1") ||
                    !importerEngineCode.Contains("PACKAGE_MANAGED_OVERWRITE_V2") ||
                    !importerEngineCode.Contains("PACKAGE_API_ENGINE_IDENTITY_RECONCILIATION_V2") ||
                    !importerEngineCode.Contains("GENERATED_ENTITY_PHYSICAL_BOOTSTRAP_V1") ||
                    !importerEngineCode.Contains("DATABASE_ONLY_BUILD_ASSETS_V1") ||
                    !importerEngineCode.Contains("BACKGROUND_TASK_MONOTONIC_PROGRESS_V1") ||
                    !importerEngineCode.Contains("BACKGROUND_TASK_PERSISTED_PROGRESS_FLOOR_V1") ||
                    !importerEngineCode.Contains("OBJECT_STORAGE_FORBIDDEN") ||
                    !importerEngineCode.Contains("SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1") ||
                    !importerEngineCode.Contains("LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1") ||
                    !importerEngineCode.Contains("MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1") ||
                    !importerEngineCode.Contains("ADMIN_MENU_PERMISSION_V1") ||
                    !importerEngineCode.Contains("ADMIN_MENU_PERMISSION_PHYSICAL_FALLBACK_V1") ||
                    !importerEngineCode.Contains("ADMIN_MENU_PERMISSION_DB_TIME_V1") ||
                    !importerEngineCode.Contains("POST_SCHEMA_MICROSERVICE_BINDING_RESTORE_V1") ||
                    !importerEngineCode.Contains("PACKAGE_BOUND_MICROSERVICE_MENU_V1") ||
                    !content.Contains("OFFICIAL_PLATFORM_API_ENGINE_OWNERSHIP_V1") ||
                    !bulkEngineCode.Contains("BACKGROUND_TASK_CHECKPOINT_PLAN_V2") ||
                    !bulkEngineCode.Contains("BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1") ||
                    !bulkEngineCode.Contains("BULK_STORAGE_FAILURE_RECOVERY_V1") ||
                    !bulkEngineCode.Contains("BULK_MONOTONIC_CHILD_PROGRESS_V1") ||
                    !HasPackagedMarketplaceRuntime(package))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]版本过旧，或缺少商城微服务运行时、页面绑定及批量安装能力，拒绝覆盖客户数据库。");
                }
            }
        }

        private static bool HasPackagedMarketplaceRuntime(JObject package)
        {
            if (package == null) return false;

            var menu = package["SysMenus"]?.Children<JObject>().FirstOrDefault(item =>
                string.Equals(item["Id"]?.ToString(), AppStoreMenuId, StringComparison.OrdinalIgnoreCase)
                || string.Equals(item["ModuleEngineKey"]?.ToString(), "sys_microistore", StringComparison.Ordinal));
            if (menu == null
                || !string.Equals(menu["OpenType"]?.ToString(), "MicroService", StringComparison.OrdinalIgnoreCase)
                || menu.Value<int?>("IsMicroiService") != 1
                || !string.Equals(menu["ComponentPath"]?.ToString(), MicroAppHostComponentPath, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(menu["MicroServiceKey"]?.ToString() ?? menu["MsKey"]?.ToString(), PlatformMicroServiceKey, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(menu["MicroServiceRoutePath"]?.ToString(), MarketplaceRoutePath, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            var bundle = package["ApplicationBundles"]?.Children<JObject>().FirstOrDefault(item =>
                string.Equals(
                    item["Application"]?["AppKey"]?.ToString()
                    ?? item["Application"]?["AppId"]?.ToString()
                    ?? item["MicroService"]?["MsKey"]?.ToString(),
                    PlatformMicroServiceKey,
                    StringComparison.OrdinalIgnoreCase));
            var application = bundle?["Application"] as JObject;
            var service = bundle?["MicroService"] as JObject;
            var buildAssets = bundle?["BuildAssets"] as JArray;
            var routes = bundle?["Routes"] as JArray;
            if (bundle == null
                || !string.Equals(bundle["ApplicationType"]?.ToString(), "MicroService", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(application?["AppKey"]?.ToString(), PlatformMicroServiceKey, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(service?["MsKey"]?.ToString(), PlatformMicroServiceKey, StringComparison.OrdinalIgnoreCase)
                || (service?.Value<int?>("IsEnable") ?? 0) != 1
                || !string.Equals(service?["Runtime"]?.ToString(), "micro-app", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(service?["StorageMode"]?.ToString(), "db", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(NormalizeRuntimeAssetPath(service?["EntryPath"]?.ToString()), "index.html", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(bundle["AssetStoragePolicy"]?["Source"]?.ToString(), "NotIncluded", StringComparison.Ordinal)
                || !string.Equals(bundle["AssetStoragePolicy"]?["Build"]?.ToString(), "DatabaseOnly", StringComparison.Ordinal)
                || (buildAssets?.Count ?? 0) < 1)
            {
                return false;
            }

            var entryAsset = buildAssets.Children<JObject>().FirstOrDefault(asset =>
                string.Equals(
                    NormalizeRuntimeAssetPath(asset["Path"]?.ToString() ?? asset["FileName"]?.ToString()),
                    "index.html",
                    StringComparison.OrdinalIgnoreCase));
            if (entryAsset == null
                || string.IsNullOrWhiteSpace(
                    entryAsset["FileByteBase64"]?.ToString()
                    ?? entryAsset["ContentBase64"]?.ToString()
                    ?? entryAsset["Base64"]?.ToString())
                || string.IsNullOrWhiteSpace(entryAsset["Sha256"]?.ToString()))
            {
                return false;
            }

            return routes?.Children<JObject>().Any(route =>
                string.Equals(route["RoutePath"]?.ToString(), MarketplaceRoutePath, StringComparison.OrdinalIgnoreCase)
                && route.Value<int?>("IsEnable") == 1
                && !string.IsNullOrWhiteSpace(route["Id"]?.ToString())
                && string.Equals(NormalizeRuntimeAssetPath(route["EntryPath"]?.ToString()), "index.html", StringComparison.OrdinalIgnoreCase)) == true;
        }

        private static async Task InstallUpgradePackage(string osClient, List<string> msgs, string resourceName, string packageName, IReadOnlyDictionary<string, string> resources)
        {
            var packageContent = NormalizePackageExecutionLimits(resources[resourceName]);
            if (IsPackageVersionAlreadyInstalled(osClient, packageContent, out var installedVersion))
            {
                Console.WriteLine($"Microi：【基础应用升级】【{osClient}】{packageName}已安装同版本[{installedVersion}]，执行覆盖式重放以修复资源漂移。");
            }
            Console.WriteLine($"Microi：【基础应用升级】开始导入{packageName}：{resourceName}");
            dynamic installResult;
            // Upgrade13 is the only caller allowed to mark a package as the
            // validated embedded official baseline. The authorization lives in
            // an AsyncLocal host scope bound to this fixed importer and tenant;
            // V8.Param alone cannot forge it. The importer consumes it once and
            // may then restore Platform/Managed code while still preserving every
            // Tenant/CreateIfMissing hook.
            using (V8TrustedExecutionContext.EnterManagedProtocol(
                       "import-microi-store-package",
                       osClient))
            {
                installResult = await MicroiEngine.ApiEngine.RunAsync("import-microi-store-package", new
                {
                    OsClient = osClient,
                    Package = packageContent,
                    TrustedEmbeddedOfficialPackage = true,
                    EmbeddedOfficialPackageResourceName = resourceName
                });
            }
            if (installResult.Code != 1)
            {
                msgs.Add($"{packageName}导入失败：{installResult.Msg}{FormatInstallFailureDetails(installResult.Data)}");
                return;
            }

            Console.WriteLine($"Microi：【基础应用升级】{packageName}导入完成。");
        }

        private static bool IsPackageVersionAlreadyInstalled(
            string osClient,
            string packageContent,
            out string installedVersion)
        {
            installedVersion = string.Empty;
            try
            {
                var packageInfo = JObject.Parse(packageContent)["PackageInfo"] as JObject;
                var packageName = packageInfo?["Name"]?.ToString();
                var incomingVersion = packageInfo?["Version"]?.ToString();
                if (string.IsNullOrWhiteSpace(packageName) || string.IsNullOrWhiteSpace(incomingVersion))
                    return false;

                var client = OsClient.GetClient(osClient);
                var db = client?.Db;
                if (db == null || !db.TableExists("sys_microistoreversion")) return false;

                var identityColumns = new[] { "AppName", "PackageName" }
                    .Where(column => db.ColumnExists("sys_microistoreversion", column))
                    .ToArray();
                var versionColumns = new[] { "AppVersionInstall", "PackageVersion", "AppVersion" }
                    .Where(column => db.ColumnExists("sys_microistoreversion", column))
                    .ToArray();
                if (identityColumns.Length == 0 || versionColumns.Length == 0) return false;

                var selectColumns = versionColumns.ToList();
                var hasStatus = db.ColumnExists("sys_microistoreversion", "InstallStatus");
                if (hasStatus) selectColumns.Add("InstallStatus");
                var where = "(" + string.Join(" OR ", identityColumns.Select(column => column + "=@p0")) + ")";
                if (db.ColumnExists("sys_microistoreversion", "IsDeleted"))
                    where += " AND (IsDeleted<>1 OR IsDeleted IS NULL)";
                var orderBy = db.ColumnExists("sys_microistoreversion", "InstallTime")
                    ? " ORDER BY InstallTime DESC"
                    : string.Empty;
                var row = db.FromSql(
                        $"SELECT {string.Join(",", selectColumns)} FROM sys_microistoreversion WHERE {where}{orderBy}")
                    .AddInParameter("p0", packageName)
                    .First<dynamic>();
                if (row == null) return false;

                installedVersion = ReadInstalledPackageVersionRow(
                    (object)row,
                    versionColumns,
                    hasStatus,
                    out var installedStatus);
                if (!installedStatus)
                    return false;
                return PackageVersionsEquivalent(installedVersion, incomingVersion);
            }
            catch (Exception ex)
            {
                // 老库可能尚无版本表或只有部分历史字段。版本读取失败只能降级为正常
                // 幂等导入，不能阻断升级，也不能把未知状态误判成“已安装”。
                Console.WriteLine($"Microi：【基础应用升级】【{osClient}】读取应用包安装版本失败，将执行幂等导入：{ex.Message}");
                installedVersion = string.Empty;
                return false;
            }
        }

        internal static string ReadInstalledPackageVersionRow(
            object row,
            IReadOnlyCollection<string> versionColumns,
            bool hasStatus,
            out bool installedStatus)
        {
            installedStatus = false;
            if (row == null) return string.Empty;

            // First<dynamic>() makes the local variable dynamic. Passing that value
            // directly to JObject.FromObject would make the returned expression dynamic
            // too, and extension methods in the following LINQ predicate would then fail
            // at runtime. Keep this boundary strongly typed for every database provider.
            JObject model = JObject.FromObject(row);
            installedStatus = !hasStatus
                || string.Equals(
                    model["InstallStatus"]?.ToString(),
                    "Installed",
                    StringComparison.OrdinalIgnoreCase);
            if (!installedStatus) return string.Empty;

            return versionColumns
                .Select(column => model[column]?.ToString())
                .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
        }

        internal static bool PackageVersionsEquivalent(string left, string right)
        {
            static bool TryNormalize(string value, out System.Version version)
            {
                version = null;
                var text = (value ?? string.Empty).Trim().TrimStart('v', 'V');
                if (!System.Version.TryParse(text, out var parsed)) return false;
                version = new System.Version(
                    Math.Max(0, parsed.Major),
                    Math.Max(0, parsed.Minor),
                    Math.Max(0, parsed.Build),
                    Math.Max(0, parsed.Revision));
                return true;
            }

            return TryNormalize(left, out var leftVersion)
                && TryNormalize(right, out var rightVersion)
                && leftVersion.Equals(rightVersion);
        }

        private static void ValidateInstalledPlatformRuntimeDependencies(string osClient, List<string> msgs)
        {
            try
            {
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null)
                {
                    msgs.Add($"平台运行时接口回读失败：未找到租户[{osClient}]数据库连接。");
                    return;
                }

                var reason = GetInstalledPlatformRuntimeRepairReason(client.Db);
                if (!reason.DosIsNullOrWhiteSpace())
                {
                    msgs.Add("平台运行时接口回读失败：" + reason);
                }
            }
            catch (Exception ex)
            {
                msgs.Add("平台运行时接口回读异常：" + ex.Message);
            }
        }

        private static void ValidateInstalledSsoRuntimeDependencies(string osClient, List<string> msgs)
        {
            try
            {
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null)
                {
                    msgs.Add($"SSO 身份联邦运行时回读失败：未找到租户[{osClient}]数据库连接。");
                    return;
                }

                var reason = GetInstalledSsoRuntimeRepairReason(client.Db);
                if (!reason.DosIsNullOrWhiteSpace())
                {
                    msgs.Add("SSO 身份联邦运行时回读失败：" + reason);
                }
            }
            catch (Exception ex)
            {
                msgs.Add("SSO 身份联邦运行时回读异常：" + ex.Message);
            }
        }

        private static void ValidateInstalledV8FirstApplicationDependencies(string osClient, List<string> msgs)
        {
            try
            {
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null)
                {
                    msgs.Add($"V8 引擎优先官方应用回读失败：未找到租户[{osClient}]数据库连接。");
                    return;
                }

                var reason = GetInstalledV8FirstApplicationRuntimeRepairReason(client.Db);
                if (!reason.DosIsNullOrWhiteSpace())
                {
                    msgs.Add("V8 引擎优先官方应用回读失败：" + reason);
                }
            }
            catch (Exception ex)
            {
                msgs.Add("V8 引擎优先官方应用回读异常：" + ex.Message);
            }
        }

        private static void ValidateInstalledAppStoreRuntimeDependencies(string osClient, List<string> msgs)
        {
            try
            {
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null)
                {
                    msgs.Add($"应用商城运行时依赖回读失败：未找到租户[{osClient}]数据库连接。");
                    return;
                }

                var dependencies = new[]
                {
                    new
                    {
                        Key = PlatformBackgroundTaskEngineKey,
                        Address = PlatformBackgroundTaskApiAddress,
                        Validator = new Func<string, System.Version, bool>(HasPlatformBackgroundTaskCapabilities)
                    },
                    new
                    {
                        Key = PlatformSysMenuEngineKey,
                        Address = PlatformSysMenuApiAddress,
                        Validator = new Func<string, System.Version, bool>(HasPlatformSysMenuCapabilities)
                    }
                };

                foreach (var dependency in dependencies)
                {
                    var row = client.Db.FromSql(@"SELECT ApiV8Code, ApiAddress, IsEnable, StopHttp, AllowAnonymous FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                        .AddInParameter("p0", dependency.Key)
                        .First<dynamic>();
                    var engine = row == null ? null : JObject.FromObject(row);
                    var code = engine?.Value<string>("ApiV8Code") ?? string.Empty;
                    var versionMatch = Regex.Match(code, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                    var version = new System.Version(0, 0, 0);
                    var valid = engine != null
                        && versionMatch.Success
                        && System.Version.TryParse(versionMatch.Groups[1].Value, out version)
                        && dependency.Validator(code, version)
                        && string.Equals(
                            engine.Value<string>("ApiAddress"),
                            dependency.Address,
                            StringComparison.OrdinalIgnoreCase)
                        && engine.Value<int?>("IsEnable") == 1
                        && engine.Value<int?>("StopHttp") == 0
                        && engine.Value<int?>("AllowAnonymous") == 0;
                    if (!valid)
                    {
                        msgs.Add(
                            $"应用商城运行时依赖回读失败：接口引擎[{dependency.Key}]未按 Managed 包完整落库。"
                        );
                    }
                }
            }
            catch (Exception ex)
            {
                msgs.Add($"应用商城运行时依赖回读失败：{ex.Message}");
            }
        }

        private static string FormatInstallFailureDetails(object data)
        {
            try
            {
                if (data == null) return string.Empty;
                var token = data as JToken ?? JToken.FromObject(data);
                var detail = (token as JObject)?.Properties().FirstOrDefault(property =>
                    property.Name.StartsWith("失败详情", StringComparison.Ordinal));
                if (detail?.Value == null) return string.Empty;

                // 只记录导入器明确返回的失败列表，不把整份应用包或其它统计信息写入日志。
                var detailJson = detail.Value.ToString(Formatting.None);
                const int maxLogLength = 4000;
                if (detailJson.Length > maxLogLength)
                {
                    detailJson = detailJson.Substring(0, maxLogLength) + "...(已截断)";
                }
                return $"；{detail.Name}：{detailJson}";
            }
            catch
            {
                // 诊断信息不得覆盖原始失败，也不能让自动升级因序列化再次异常。
                return string.Empty;
            }
        }

        private static string NormalizePackageExecutionLimits(string packageContent)
        {
            if (string.IsNullOrWhiteSpace(packageContent)) return packageContent;

            var package = JObject.Parse(packageContent);
            var changed = false;
            foreach (var engine in package["SysApiEngines"]?.Children<JObject>() ?? Enumerable.Empty<JObject>())
            {
                var persistedLimit = engine["LimitRecursion"]?.Value<int>() ?? 0;
                if (persistedLimit <= PrivilegedEngineLimitRecursion) continue;
                engine["LimitRecursion"] = PrivilegedEngineLimitRecursion;
                changed = true;
            }
            return changed ? package.ToString(Formatting.None) : packageContent;
        }

        private static void EnsureImporterExecutionLimits(string osClient)
        {
            var client = OsClient.GetClient(osClient);
            if (client?.Db == null) throw new InvalidOperationException($"未找到租户[{osClient}]数据库连接。");
            var dbType = client.OsClientModel?["DbType"]?.Val<string>();
            var sql = string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase)
                ? @"UPDATE [sys_apiengine] SET [Timeout]=@p0, [MaxStatements]=@p1, [LimitMemory]=@p2, [LimitRecursion]=@p3, [Lock]=1 WHERE [ApiEngineKey]=@p4"
                : @"UPDATE `sys_apiengine` SET `Timeout`=@p0, `MaxStatements`=@p1, `LimitMemory`=@p2, `LimitRecursion`=@p3, `Lock`=1 WHERE `ApiEngineKey`=@p4";
            client.Db.FromSql(sql)
                .AddInParameter("p0", 3600)
                .AddInParameter("p1", 100000000)
                .AddInParameter("p2", ImporterLimitMemoryMb)
                .AddInParameter("p3", PrivilegedEngineLimitRecursion)
                .AddInParameter("p4", "import-microi-store-package")
                .ExecuteNonQuery();
        }

        private static async Task EnsureImporterExecutionLimitsAndInvalidateAsync(string osClient)
        {
            EnsureImporterExecutionLimits(osClient);
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:import-microi-store-package");
            await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:/apiengine/import-microi-store-package");
        }

        private static void EnsurePublisherExecutionSettings(string osClient)
        {
            var client = OsClient.GetClient(osClient);
            if (client?.Db == null) throw new InvalidOperationException($"未找到租户[{osClient}]数据库连接。");
            var dbType = client.OsClientModel?["DbType"]?.Val<string>();
            var sql = string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase)
                ? @"UPDATE [sys_apiengine] SET [StopHttp]=0, [Timeout]=@p0, [MaxStatements]=@p1, [LimitMemory]=@p2, [LimitRecursion]=@p3, [Lock]=1 WHERE [ApiEngineKey]=@p4"
                : @"UPDATE `sys_apiengine` SET `StopHttp`=0, `Timeout`=@p0, `MaxStatements`=@p1, `LimitMemory`=@p2, `LimitRecursion`=@p3, `Lock`=1 WHERE `ApiEngineKey`=@p4";
            client.Db.FromSql(sql)
                .AddInParameter("p0", 3600)
                .AddInParameter("p1", 100000000)
                .AddInParameter("p2", 2048)
                .AddInParameter("p3", PrivilegedEngineLimitRecursion)
                .AddInParameter("p4", "ai_app_publish_store")
                .ExecuteNonQuery();
        }

        private static async Task EnsureAiAppBuilderAsync(
            string osClient,
            List<string> msgs,
            IReadOnlyDictionary<string, string> resources)
        {
            var engineCode = resources[BuildAiAppResourceName];
            var existing = await MicroiEngine.FormEngine.GetFormDataAsync("sys_apiengine", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "ApiEngineKey", "=", "ai_app_build" }
                },
                _SelectFields = new[] { "Id" }
            });
            var model = new
            {
                OsClient = osClient,
                ApiName = "AI应用构建发布",
                ApiEngineKey = "ai_app_build",
                ApiAddress = "/apiengine/ai_app_build",
                IsEnable = 1,
                StopHttp = 0,
                AllowAnonymous = 0,
                Timeout = 600,
                MaxStatements = 100000000,
                LimitMemory = 2048,
                LimitRecursion = PrivilegedEngineLimitRecursion,
                Lock = 0,
                Version = "v1.4.5",
                ApiV8Code = engineCode
            };
            DosResult result;
            if (existing.Code == 1 && existing.Data != null)
            {
                result = await UpgradeTrustedFormEngine.UpdateAsync("sys_apiengine", osClient, new
                {
                    Id = (string)existing.Data.Id,
                    model.OsClient,
                    model.ApiName,
                    model.ApiEngineKey,
                    model.ApiAddress,
                    model.IsEnable,
                    model.StopHttp,
                    model.AllowAnonymous,
                    model.Timeout,
                    model.MaxStatements,
                    model.LimitMemory,
                    model.LimitRecursion,
                    model.Lock,
                    model.Version,
                    model.ApiV8Code
                });
            }
            else
            {
                result = await UpgradeTrustedFormEngine.AddAsync("sys_apiengine", osClient, model);
            }
            if (result.Code != 1)
            {
                msgs.Add("AI应用构建器升级失败：" + result.Msg);
                return;
            }
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:ai_app_build");
            await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:/apiengine/ai_app_build");
            if (existing.Code == 1 && existing.Data != null)
            {
                await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{(string)existing.Data.Id}");
            }
        }

        private static async Task EnsureAiPackagingTimeFallback(string osClient, List<string> msgs)
        {
            const string helper = @"// 平台接口必须自包含时间能力，不能覆盖或依赖客户系统设置中的全局V8。
var nowText = function (format) {
    var dateFormat = format || 'yyyy-MM-dd HH:mm:ss';
    try { if (typeof DateNow == 'function') return DateNow(dateFormat); } catch (dateNowError) { }
    try { return System.DateTime.Now.ToString(dateFormat); } catch (systemDateError) { }
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

";
            const string controlledZipHelper = @"function buildZip(fileName, entries) {
  var zipResult = V8.Method.CreateZip({
    Entries: entries,
    MaxFileCount: 20000,
    MaxEntryBytes: 268435456,
    MaxTotalBytes: 2147483648
  });
  if (!zipResult || zipResult.Code !== 1 || !zipResult.Data) {
    return fail('创建ZIP失败：' + ((zipResult && zipResult.Msg) || '接口无返回'));
  }
  return ok({
    FileName: fileName,
    ContentType: 'application/zip',
    FileByteBase64: zipResult.Data.FileByteBase64,
    Size: zipResult.Data.Size || 0,
    Sha256: zipResult.Data.Sha256 || ''
  });
}

";
            try
            {
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null)
                {
                    msgs.Add($"AI应用打包时间兼容修复失败：未找到租户[{osClient}]数据库连接。");
                    return;
                }

                foreach (var engineKey in new[]
                {
                    "ai_app_prepare_store_assets",
                    "ai_app_download_build_zip",
                    "ai_app_download_source_zip"
                })
                {
                    var dbType = client.OsClientModel?["DbType"]?.Val<string>();
                    var getEngineSql = string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase)
                        ? @"SELECT TOP 1 Id, ApiAddress, ApiRoutes, ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)"
                        : @"SELECT Id, ApiAddress, ApiRoutes, ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL) LIMIT 1";
                    var engine = client.Db.FromSql(getEngineSql)
                        .AddInParameter("p0", engineKey)
                        .First<dynamic>();
                    if (engine == null) continue;

                    string code = Convert.ToString(engine.ApiV8Code) ?? string.Empty;
                    string engineId = Convert.ToString(engine.Id) ?? string.Empty;
                    string engineApiAddress = Convert.ToString(engine.ApiAddress) ?? string.Empty;
                    string engineApiRoutes = Convert.ToString(engine.ApiRoutes) ?? string.Empty;
                    if (code.DosIsNullOrWhiteSpace()) continue;

                    var patchedCode = code;
                    if (patchedCode.Contains("DateNow(") && !patchedCode.Contains("var nowText = function"))
                    {
                        // 先替换平台脚本中的直接调用，再前置包含 DateNow 探测的局部 helper。
                        patchedCode = helper + Regex.Replace(patchedCode, @"\bDateNow\s*\(", "nowText(");
                    }
                    if (patchedCode.Contains("new System.IO.MemoryStream"))
                    {
                        patchedCode = Regex.Replace(
                            patchedCode,
                            @"function addZipText[\s\S]*?(?=var appId\s*=)",
                            controlledZipHelper,
                            RegexOptions.Multiline);
                    }
                    if (patchedCode == code) continue;
                    client.Db.FromSql(@"UPDATE sys_apiengine SET ApiV8Code=@p0 WHERE Id=@p1")
                        .AddInParameter("p0", patchedCode)
                        .AddInParameter("p1", engineId)
                        .ExecuteNonQuery();

                    var cache = MicroiEngine.CacheTenant.Cache(osClient);
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{engineKey}");
                    if (!string.IsNullOrWhiteSpace(engineId))
                    {
                        await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{engineId}");
                    }
                    foreach (var routeAlias in ApiEngineRouteAliases.Parse(engineApiRoutes))
                    {
                        await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{routeAlias.ToLowerInvariant()}");
                    }
                    if (!string.IsNullOrWhiteSpace(engineApiAddress))
                    {
                        await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{engineApiAddress}");
                    }
                    Console.WriteLine($"Microi：【基础应用升级】已为[{engineKey}]补充局部时间回退/受控ZIP兼容，客户全局V8保持不变。");
                }
            }
            catch (Exception ex)
            {
                msgs.Add("AI应用打包时间兼容修复异常：" + ex.Message);
            }
        }

        private static async Task EnsureAppStoreAdminPermission(string osClient, string menuId, List<string> msgs)
        {
            var roleId = "5db47859-35a3-411a-a1f7-99482e057d24";
            var existing = await MicroiEngine.FormEngine.GetFormDataAsync("sys_rolelimit", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "RoleId", "=", roleId },
                    new List<object> { "FkId", "=", menuId },
                    new List<object> { "Type", "=", "Menu" }
                },
                _SelectFields = new[] { "Id" }
            });
            if (existing.Code == 1 && existing.Data != null) return;

            var addResult = await UpgradeTrustedFormEngine.AddAsync("sys_rolelimit", osClient, new
            {
                OsClient = osClient,
                RoleId = roleId,
                FkId = menuId,
                Type = "Menu",
                Permission = "[\"Add\",\"Edit\",\"Del\",\"Export\",\"Import\"]"
            });
            if (addResult.Code != 1)
            {
                msgs.Add("应用商城超级管理员菜单权限补齐失败：" + addResult.Msg);
            }
        }

        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string osClient)
        {
            var msgs = new List<string>();

            if (IsOfficialSourceTenant(osClient))
            {
                Console.WriteLine($"Microi：【基础应用升级】租户[{osClient}]是吾码官方应用源，跳过导入器及基础应用包回写；其它升级步骤不受影响。");
                return msgs;
            }

            // 在线资源必须整组成功才使用；断网、超时或任一资源校验失败时，整组使用
            // 当前程序集随版本发布的基线，确保客户更新后端即可自动获得应用商城。
            var resources = await LoadUpgradeResourcesAsync();

            var nullableErrors = new List<string>();
            EnsureCoreTableColumnsNullable(osClient, nullableErrors);
            if (nullableErrors.Count > 0)
            {
                foreach (var nullableError in nullableErrors)
                {
                    Console.WriteLine($"Microi：【基础应用升级】【{osClient}】【核心字段可空兼容】失败：{nullableError}");
                }
                msgs.AddRange(nullableErrors);
                return msgs;
            }
            Console.WriteLine($"Microi：【基础应用升级】【{osClient}】【核心字段可空兼容】全部检查成功。");
            
            #region 导入数据包V8
            //更新应用商城的导入数据包接口引擎
            var importMicroiStorePackageResult = await MicroiEngine.FormEngine.GetFormDataAsync("sys_apiengine", new
            {
                OsClient = osClient,
                _Where = new List<object>()
                {
                    new List<object>()
                    {
                        "ApiEngineKey", "=", "import-microi-store-package"
                    }
                },
            });
            var importV8 = resources[ImportPackageResourceName];
            if (importMicroiStorePackageResult.Code != 1
                && importMicroiStorePackageResult.Code != 2)
            {
                msgs.Add("读取应用商城导入器失败：" + importMicroiStorePackageResult.Msg);
            }
            else if (importMicroiStorePackageResult.Code == 2
                     || importMicroiStorePackageResult.Data == null)
            {
                var addImportMicroiStorePackageResult = await UpgradeTrustedFormEngine.AddAsync("sys_apiengine", osClient, new
                {
                    ApiName = "[应用商城]导入Microi应用数据包",
                    ApiEngineKey = "import-microi-store-package",
                    ApiAddress = "/apiengine/import-microi-store-package",
                    IsEnable = 1,
                    Timeout = 3600,
                    MaxStatements = 100000000,
                    LimitMemory = ImporterLimitMemoryMb,
                    LimitRecursion = PrivilegedEngineLimitRecursion,
                    Lock = 1,
                    OsClient = osClient,
                    ApiV8Code = importV8
                });
                if(addImportMicroiStorePackageResult.Code != 1)
                {
                    msgs.Add("新增应用商城导入器失败：" + addImportMicroiStorePackageResult.Msg);
                }
            }
            else
            {
                var uptImportMicroiStorePackageResult = await UpgradeTrustedFormEngine.UpdateAsync("sys_apiengine", osClient, new
                {
                    Id = (string)importMicroiStorePackageResult.Data.Id,
                    ApiName = "[应用商城]导入Microi应用数据包",
                    ApiEngineKey = "import-microi-store-package",
                    ApiAddress = "/apiengine/import-microi-store-package",
                    IsEnable = 1,
                    Timeout = 3600,
                    MaxStatements = 100000000,
                    LimitMemory = ImporterLimitMemoryMb,
                    LimitRecursion = PrivilegedEngineLimitRecursion,
                    Lock = 1,
                    OsClient = osClient,
                    ApiV8Code = importV8
                });
                if(uptImportMicroiStorePackageResult.Code != 1)
                {
                    msgs.Add("更新应用商城导入器失败：" + uptImportMicroiStorePackageResult.Msg);
                }
                else
                {
                    await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:import-microi-store-package");
                    await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{(string)importMicroiStorePackageResult.Data.Id}");
                    await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:/apiengine/import-microi-store-package");
                }
            }
            if (msgs.Count == 0)
            {
                // 老库虽然已有物理字段，但 diy_field 元数据可能缺失，FormEngine 更新会忽略这些值。
                // 这里直接修正导入器运行限额，避免大体量元数据包继续使用默认 1GB 限制。
                await EnsureImporterExecutionLimitsAndInvalidateAsync(osClient);
            }
            if (msgs.Count > 0) return msgs;
            #endregion

            // 应用商城是本升级的核心目标：导入器更新成功后必须优先安装商城包，
            // 表单引擎、模块引擎及可选 AI 发布器均排在其后。
            #region 应用商城 数据包
            await InstallUpgradePackage(osClient, msgs, AppStorePackageResourceName, "应用商城数据包", resources);
            if (msgs.Count > 0) return msgs;
            ValidateInstalledAppStoreRuntimeDependencies(osClient, msgs);
            if (msgs.Count > 0) return msgs;
            // 尚未同步的官方在线商城包可能仍内嵌 2048MB 配置，并在导入自身时覆盖
            // 当前导入器。立即恢复受信任导入器限额，保证后续表单/模块大包继续稳定执行。
            await EnsureImporterExecutionLimitsAndInvalidateAsync(osClient);
            await EnsureAiAppBuilderAsync(osClient, msgs, resources);
            if (msgs.Count > 0) return msgs;
            await EnsureAiPackagingTimeFallback(osClient, msgs);
            if (msgs.Count > 0) return msgs;
            #endregion

            #region 表单引擎 数据包
            await InstallUpgradePackage(osClient, msgs, FormEnginePackageResourceName, "表单引擎数据包", resources);
            if (msgs.Count > 0) return msgs;
            #endregion

            #region 模块引擎 数据包
            await InstallUpgradePackage(osClient, msgs, ModuleEnginePackageResourceName, "模块引擎数据包", resources);
            if (msgs.Count > 0) return msgs;
            #endregion

            #region SaaS引擎与强身份验证基础包
            // SaaS 引擎包是官方平台资源，随升级自动安装。它通过统一应用商城导入器
            // 幂等补齐 Passkey/TOTP/严格人脸表、sys_osclients 配置字段和个人中心微服务；
            // 不在 .NET 中复制表/字段迁移逻辑，并保留租户后来显式关闭的 0 值。
            await InstallUpgradePackage(osClient, msgs, SaaSEnginePackageResourceName, "SaaS引擎与身份验证数据包", resources);
            if (msgs.Count > 0) return msgs;
            // The importer intentionally follows low-code field metadata. Old
            // tenants can already have newer physical sys_apiengine columns
            // without matching diy_field rows, so Managed source may update
            // while Version/StopHttp stays blank/null. Re-run the fixed,
            // parameterized startup closure after package import to reconcile
            // those physical fields before the hard readback gate.
            var platformRuntimeClient = OsClient.GetClient(osClient);
            var platformRuntimeReconcile = await EnsureStartupDependenciesUnderLeaseAsync(
                platformRuntimeClient);
            if (platformRuntimeReconcile.Code != 1)
            {
                msgs.Add("平台运行时接口物理字段补正失败：" + platformRuntimeReconcile.Msg);
                return msgs;
            }
            ValidateInstalledPlatformRuntimeDependencies(osClient, msgs);
            if (msgs.Count > 0) return msgs;
            #endregion

            #region 系统账号、系统设置、消息通知与 AI助手官方应用
            // 这些包分别拥有本领域 Managed 接口和 CreateIfMissing Hook。必须随服务端升级
            // 安装，避免新前端已切换 /apiengine 路由而旧租户仍缺少对应接口。
            await InstallUpgradePackage(osClient, msgs, SysUserPackageResourceName, "系统账号数据包", resources);
            if (msgs.Count > 0) return msgs;
            await InstallUpgradePackage(osClient, msgs, SysConfigPackageResourceName, "系统设置数据包", resources);
            if (msgs.Count > 0) return msgs;
            await InstallUpgradePackage(osClient, msgs, MessageNotificationPackageResourceName, "消息通知数据包", resources);
            if (msgs.Count > 0) return msgs;
            await InstallUpgradePackage(osClient, msgs, AiEnginePackageResourceName, "AI助手数据包", resources);
            if (msgs.Count > 0) return msgs;
            ValidateInstalledV8FirstApplicationDependencies(osClient, msgs);
            if (msgs.Count > 0) return msgs;
            #endregion

            #region SSO 身份联邦官方应用
            // SSO 依赖 SaaS/强身份验证底层能力，因此固定在 SaaS 包之后安装；业务编排、
            // Managed 基线和 CreateIfMissing 租户 Hook 全部由应用包交付，不新增租户迁移代码。
            await InstallUpgradePackage(osClient, msgs, SsoPackageResourceName, "SSO 身份联邦数据包", resources);
            if (msgs.Count > 0) return msgs;
            ValidateInstalledSsoRuntimeDependencies(osClient, msgs);
            if (msgs.Count > 0) return msgs;
            #endregion

            #region AI应用发布到商城V8
            var publishAiAppV8 = resources[PublishAiAppResourceName];
            var publishAiAppEngine = await MicroiEngine.FormEngine.GetFormDataAsync("sys_apiengine", new
            {
                OsClient = osClient,
                _Where = new List<object>()
                {
                    new List<object>() { "ApiEngineKey", "=", "ai_app_publish_store" }
                }
            });
            DosResult publishAiAppResult;
            if (publishAiAppEngine.Code == 1)
            {
                publishAiAppResult = await UpgradeTrustedFormEngine.UpdateAsync("sys_apiengine", osClient, new
                {
                    Id = (string)publishAiAppEngine.Data.Id,
                    OsClient = osClient,
                    ApiName = "[AI应用]制作离线包并发布应用商城",
                    ApiEngineKey = "ai_app_publish_store",
                    ApiAddress = "/apiengine/ai_app_publish_store",
                    IsEnable = 1,
                    StopHttp = 0,
                    Timeout = 3600,
                    MaxStatements = 100000000,
                    LimitMemory = 2048,
                    LimitRecursion = PrivilegedEngineLimitRecursion,
                    Lock = 1,
                    ApiV8Code = publishAiAppV8
                });
            }
            else
            {
                publishAiAppResult = await UpgradeTrustedFormEngine.AddAsync("sys_apiengine", osClient, new
                {
                    OsClient = osClient,
                    ApiName = "[AI应用]制作离线包并发布应用商城",
                    ApiEngineKey = "ai_app_publish_store",
                    ApiAddress = "/apiengine/ai_app_publish_store",
                    IsEnable = 1,
                    StopHttp = 0,
                    Timeout = 3600,
                    MaxStatements = 100000000,
                    LimitMemory = 2048,
                    LimitRecursion = PrivilegedEngineLimitRecursion,
                    Lock = 1,
                    ApiV8Code = publishAiAppV8
                });
            }
            if (publishAiAppResult.Code != 1)
            {
                // AI 发布器不是应用商城启动的前置条件，老库缺少可选字段时不应阻断三套基础包。
                Console.WriteLine("Microi：【基础应用升级】AI应用发布商城接口升级跳过：" + publishAiAppResult.Msg);
            }
            else
            {
                // 老库的运行参数物理列可能缺少 diy_field 元数据，FormEngine 更新会静默忽略；
                // 再以参数化 SQL 强制修正，保证大型自包含源码包可以稳定生成。
                EnsurePublisherExecutionSettings(osClient);
                await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync("Microi:" + osClient + ":FormData:sys_apiengine:ai_app_publish_store");
                await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync("Microi:" + osClient + ":FormData:sys_apiengine:/apiengine/ai_app_publish_store");
            }
            #endregion

            #region 修正sys_menu的DiyTableId关联值
            var getStoreTableResult = await MicroiEngine.FormEngine.GetFormDataAsync("diy_table", new {
                OsClient = osClient,
                _Where = new List<object>()
                {
                    new List<object>() { "Name", "=", "sys_microistore" }
                }
            });
            if(getStoreTableResult.Code == 1){
                var getMenuResult = await MicroiEngine.FormEngine.GetFormDataAsync("sys_menu", new {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        // Stable official id also repairs tenants whose engine key was
                        // cleared by an older sparse-write conversion bug.
                        new List<object>() { "Id", "=", AppStoreMenuId },
                    }
                });
                if(getMenuResult.Code == 1)
                {
                    var appStoreMenuId = (string)getMenuResult.Data.Id;
                    // Data 是 dynamic；若直接作为 dynamic 参数调用 ToJObject，整个调用结果也会
                    // 被编译为 dynamic，随后 JValue.Val<T>() 会被当作实例方法解析并失败。
                    // 显式落到 object/JObject，确保 Dos.Common 的 JToken 扩展方法静态绑定。
                    JObject currentMenu = JsonHelper.ToJObject((object)getMenuResult.Data) ?? new JObject();
                    var menuPatch = new JObject
                    {
                        ["Id"] = appStoreMenuId,
                        ["OsClient"] = osClient,
                        ["DiyTableId"] = (string)getStoreTableResult.Data.Id,
                        ["DiyTableName"] = (string)getStoreTableResult.Data.Name,
                    };
                    if (currentMenu["Name"].Val<string>().DosIsNullOrWhiteSpace())
                    {
                        menuPatch["Name"] = "应用商城";
                    }
                    if (currentMenu["ModuleEngineKey"].Val<string>().DosIsNullOrWhiteSpace())
                    {
                        menuPatch["ModuleEngineKey"] = "sys_microistore";
                    }
                    var uptMenuResult = await UpgradeTrustedFormEngine.UpdateAsync("sys_menu", osClient, menuPatch);
                    if(uptMenuResult.Code != 1)
                    {
                        msgs.Add(uptMenuResult.Msg);
                    }else
                    {
                        await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:{appStoreMenuId}");
                        await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:sys_microistore");
                    }
                    await EnsureAppStoreAdminPermission(osClient, appStoreMenuId, msgs);
                    await EnsureAppStoreAdminPermission(osClient, "01KXFSG7MZ40CY8KCWCZZZJH2M", msgs);
                    await EnsureAppStoreAdminPermission(osClient, "01KXFSG8153B3VZPZ45WNCCFHR", msgs);
                }
            }
            #endregion

            //更新缓存
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:6cf254f1-edd0-4f04-96bc-c9ad08b5a2c");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:6cf254f1-edd0-4f04-96bc-c9ad08b5a2c");

            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:39bc4abe-98ee-46a7-b9d1-a7d649691193");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:39bc4abe-98ee-46a7-b9d1-a7d649691193");

            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:diy_table");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:diy_field");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:sys_microistore");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:sys_microistore");
            
            return msgs;
        }

        private static void EnsureCoreTableColumnsNullable(string osClient, List<string> errors)
        {
            try
            {
                var osClientModel = OsClient.GetClient(osClient);
                if (osClientModel?.Db == null)
                {
                    errors.Add($"核心表字段可空升级失败：未找到租户 {osClient} 的数据库连接。");
                    return;
                }

                var dbType = osClientModel.OsClientModel?["DbType"]?.Val<string>();
                var dbInfo = DiyCommon.GetDbInfo(dbType);
                var orm = MicroiEngine.ORM(dbInfo.DbType);

                foreach (var tableName in CoreNullableTables)
                {
                    Console.WriteLine($"Microi：【基础应用升级】【{osClient}】【核心字段可空兼容】开始检查表：{tableName}。");
                    var columnsResult = orm.GetColumns(new DbServiceParam
                    {
                        OsClient = osClient,
                        TableName = tableName,
                        DbSession = osClientModel.Db,
                        DbInfo = dbInfo
                    });
                    if (columnsResult.Code != 1 || columnsResult.Data == null)
                    {
                        errors.Add($"读取核心表 {tableName} 字段失败：{columnsResult.Msg}");
                        continue;
                    }

                    var changedCount = 0;
                    foreach (var column in columnsResult.Data)
                    {
                        var columnName = column.column_name ?? "";
                        if (columnName.Equals("Id", StringComparison.OrdinalIgnoreCase)) continue;
                        if (string.Equals(column.is_nullable, "YES", StringComparison.OrdinalIgnoreCase)) continue;

                        var columnType = column.column_type;
                        if (columnType.DosIsNullOrWhiteSpace())
                        {
                            columnType = column.data_type;
                        }
                        if (columnType.DosIsNullOrWhiteSpace()) continue;

                        Console.WriteLine(
                            $"Microi：【基础应用升级】【{osClient}】【核心字段可空兼容】开始调整：{tableName}.{columnName}，类型={columnType}。"
                        );
                        var changeResult = orm.ChangeColumn(new DbServiceParam
                        {
                            OsClient = osClient,
                            TableName = tableName,
                            FieldName = columnName,
                            NewFieldName = columnName,
                            FieldType = columnType,
                            FieldLabel = column.column_comment ?? "",
                            FieldNotNull = false,
                            DbSession = osClientModel.Db,
                            DbInfo = dbInfo
                        });
                        if (changeResult.Code == 1)
                        {
                            changedCount++;
                            Console.WriteLine(
                                $"Microi：【基础应用升级】【{osClient}】【核心字段可空兼容】调整成功：{tableName}.{columnName}。"
                            );
                        }
                        else
                        {
                            errors.Add($"核心表 {tableName}.{columnName} 调整为允许为空失败：{changeResult.Msg}");
                            Console.WriteLine(
                                $"Microi：【基础应用升级】【{osClient}】【核心字段可空兼容】调整失败：{tableName}.{columnName}；{changeResult.Msg}"
                            );
                        }
                    }

                    if (changedCount > 0)
                    {
                        Console.WriteLine(
                            $"Microi：【基础应用升级】【{osClient}】【核心字段可空兼容】表调整成功：{tableName}，已将{changedCount}个字段调整为允许为空。"
                        );
                    }
                    Console.WriteLine(
                        $"Microi：【基础应用升级】【{osClient}】【核心字段可空兼容】表检查完成：{tableName}，本次调整={changedCount}。"
                    );
                }
            }
            catch (Exception ex)
            {
                errors.Add($"核心表字段可空升级异常：{ex.Message}");
            }
        }
    }
}

