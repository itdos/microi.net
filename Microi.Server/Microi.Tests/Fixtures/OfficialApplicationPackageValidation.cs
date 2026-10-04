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
    internal class OfficialApplicationPackageValidation
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "7.6.13.0";
        private static readonly HttpClient ResourceHttpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(8)
        };

        /// <summary>
        /// 官网升级资源属于可降级的远程输入。网络波动、发布窗口内的版本差异或
        /// 远端包契约暂未追平时，返回失败结果并整组回退程序集内置资源，不能通过
        /// 抛异常来驱动正常回退，否则 Visual Studio 会把已处理异常显示给普通用户。
        /// </summary>
        private sealed class OfficialResourceDownloadResult
        {
            private OfficialResourceDownloadResult(string resourceName, string content, string error)
            {
                ResourceName = resourceName;
                Content = content;
                Error = error;
            }

            public string ResourceName { get; }
            public string Content { get; }
            public string Error { get; }
            public bool Succeeded => string.IsNullOrWhiteSpace(Error) && !string.IsNullOrWhiteSpace(Content);

            public static OfficialResourceDownloadResult Success(string resourceName, string content)
            {
                return new OfficialResourceDownloadResult(resourceName, content, string.Empty);
            }

            public static OfficialResourceDownloadResult Failure(string resourceName, string error)
            {
                return new OfficialResourceDownloadResult(resourceName, string.Empty, error);
            }
        }

        private static void WriteUpgradeResourceDiagnostic(
            string action,
            string title,
            string content,
            int level,
            bool success,
            string resourceName = null)
        {
            var status = success
                ? "【成功】"
                : level >= 3
                    ? "【Error异常】"
                    : "【Warning警告】";
            UpgradeProgress.WriteLine($"Microi：{status}平台自动升级【升级13资源】【{title}】{content}");
            MicroiEngine.QueueSystemLog(
                null,
                "PlatformUpgrade",
                action,
                title,
                content,
                level,
                success,
                resourceName);
        }
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
        // SQL Server must receive the native background-task index reader before
        // installing that bootstrap package, even when ServerVersion is current.
        private static readonly System.Version MinimumPinnedImporterVersion = new System.Version(2, 8, 10);
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
                && code.Contains("PACKAGE_API_ENGINE_AUTHORITATIVE_READBACK_V2")
                && code.Contains("DATASET_TABLE_PREFLIGHT_V1")
                && code.Contains("activeImportStage = '步骤2-字段定义'")
                && code.Contains("TableName: 'diy_field'")
                && code.Contains("['OsClient', textType(255)]")
                && code.Contains("TRUSTED_EMBEDDED_OFFICIAL_PACKAGE_V1")
                && code.Contains("ABSENT_PACKAGE_TABLE_DEFER_DDL_V1")
                && code.Contains("DATABASE_INLINE_SERVING_API_CONTEXT_V1")
                && HasSafeAdministratorRoleBootstrap(code)
                && code.Contains("PACKAGE_DECLARED_IDENTIFIER_STORAGE_V1")
                && code.Contains("UNUSED_WORKFLOW_PHYSICAL_SCHEMA_V1")
                && code.Contains("MYSQL_IDENTIFIER_FOREIGN_KEY_SCOPE_V1")
                && code.Contains("PACKAGE_MANAGED_OVERWRITE_V2")
                && code.Contains("PACKAGE_API_ENGINE_IDENTITY_RECONCILIATION_V2")
                && code.Contains("PACKAGE_API_ENGINE_ROUTE_RECLAIM_V1")
                && code.Contains("PHYSICAL_NOT_NULL_TENANT_BACKFILL_V1")
                && code.Contains("MARKETPLACE_CHANGELOG_TENANT_COLLISION_REPAIR_V1")
                && code.Contains("PAGE_ENGINE_OPTIONAL_REFERENCE_V1")
                && code.Contains("SQLSERVER_PHYSICAL_SCHEMA_DIALECT_V1")
                && code.Contains("SQLSERVER_PHYSICAL_FIELD_CHANGE_V1")
                && code.Contains("V8.Method.RequireManagedProtocolContext");
        }

        private static bool HasSafeAdministratorRoleBootstrap(string code)
        {
            return code.Contains("ADMIN_ROLE_BOOTSTRAP_PHYSICAL_V1")
                || (code.Contains("var candidateRoleIds = [];")
                    && code.Contains("var assessRoleHolders = function")
                    && code.Contains("if (missingRoleHolders.OrdinaryHolder)")
                    && code.Contains("缺失角色引用不唯一"));
        }

        private static bool HasSafeAdministratorLegacyRoleGrant(string code)
        {
            return code.Contains("ADMIN_MENU_LEGACY_ACCOUNT_ROLE_V1")
                || (code.Contains("if (holders.ActiveAdministrator && !holders.OrdinaryHolder)")
                    && code.Contains("if (exclusiveLegacyRoles.length > 1)")
                    && code.Contains("legacyAccountAdministratorRoleId = String(exclusiveLegacyRoles[0].Id).toLowerCase()")
                    && code.Contains("Number(role.Level || 0) >= 9999"));
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
                // 旧包直接传 V8.Param；新包先排除内部身份再调用同一可信原子。
                // 同时要求完整投影和固定调用，不能因为参数变量名变化误拒绝有效启动依赖。
                && (code.Contains("V8.Method.ManageBackgroundTask(V8.Param)")
                    || (code.Contains("var backgroundTaskParam = Object.create(null);")
                        && code.Contains("if (backgroundTaskKey !== '_CurrentUser') backgroundTaskParam[backgroundTaskKey] = V8.Param[backgroundTaskKey];")
                        && code.Contains("V8.Method.ManageBackgroundTask(backgroundTaskParam)")))
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
                { SysUserPackageResourceName, new System.Version(7, 6, 5) },
                { SysConfigPackageResourceName, new System.Version(6, 3, 9) },
                { MessageNotificationPackageResourceName, new System.Version(1, 0, 14) },
                { AiEnginePackageResourceName, new System.Version(7, 6, 1) },
                { SaaSEnginePackageResourceName, new System.Version(7, 7, 8) },
                { AppStorePackageResourceName, new System.Version(7, 7, 15) }
            };

        // 这里只声明每个包必须保留的基础接口，不再把接口总数写死。官方包新增
        // Managed 接口属于向前兼容扩展；若继续要求“恰好等于”这份清单，发布包
        // 与校验器只要有一次提交不同步，就会让全新数据库在写入前直接退出。
        private static readonly Dictionary<string, string[]> V8FirstPackageRequiredEngineKeys =
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
                        "platform-home-overview",
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

        private static bool HasPackagedSysUserHomeUsageStatsSchema(JObject package)
        {
            var fields = package?["DiyFields"] as JArray ?? new JArray();
            var ddls = package?["DDLStatements"] as JArray ?? new JArray();
            var physicalColumns = package?["PhysicalColumns"] as JArray ?? new JArray();
            var fieldRows = fields.Children<JObject>().Where(row =>
                string.Equals(row.Value<string>("TableName"), "sys_user", StringComparison.OrdinalIgnoreCase)
                && string.Equals(row.Value<string>("Name"), "HomeUsageStats", StringComparison.OrdinalIgnoreCase)).ToArray();
            return fieldRows.Length == 1
                && fieldRows[0].Value<int?>("Visible") == 0
                && fieldRows[0].Value<int?>("AppVisible") == 0
                && fieldRows[0].Value<int?>("Readonly") == 1
                && string.Equals(fieldRows[0].Value<string>("Type"), "mediumtext", StringComparison.OrdinalIgnoreCase)
                && physicalColumns.Children<JObject>().Count(row =>
                    string.Equals(row.Value<string>("TABLE_NAME"), "sys_user", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(row.Value<string>("COLUMN_NAME"), "HomeUsageStats", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(row.Value<string>("DATA_TYPE"), "mediumtext", StringComparison.OrdinalIgnoreCase)) == 1
                && ddls.Children<JObject>().Any(row =>
                    string.Equals(row.Value<string>("TableName"), "sys_user", StringComparison.OrdinalIgnoreCase)
                    && Regex.IsMatch(row.Value<string>("DDL") ?? string.Empty, @"`HomeUsageStats`\s+mediumtext", RegexOptions.IgnoreCase));
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

            if (V8FirstPackageRequiredEngineKeys.TryGetValue(resourceName, out var requiredKeys))
            {
                var tenantHookKey = V8FirstTenantHookKeys[resourceName];
                foreach (var key in requiredKeys)
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

                // 新增接口可以超过最低清单，但仍必须逐项声明唯一官方所有权并带
                // 醒目恢复提示。除固定租户 Hook 外，任何额外 CreateIfMissing 或
                // 未声明策略的接口都会在这里失败关闭，不能借“向前兼容”绕过审计。
                foreach (var pair in byKey)
                {
                    var isTenantHook = string.Equals(
                        pair.Key,
                        tenantHookKey,
                        StringComparison.Ordinal)
                        || (string.Equals(resourceName, SysConfigPackageResourceName, StringComparison.Ordinal)
                            && string.Equals(pair.Key, "platform-hdfs-upload-hook", StringComparison.Ordinal));
                    if (!HasExpectedOfficialEnginePolicy(package, pair.Value, isTenantHook))
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
                var homeOverviewEngine = byKey["platform-home-overview"];
                var homeOverviewCode = homeOverviewEngine.Value<string>("ApiV8Code") ?? string.Empty;
                var homeOverviewVersionText = (homeOverviewEngine.Value<string>("Version") ?? string.Empty)
                    .TrimStart('v', 'V');
                var capabilities = package["PackageInfo"]?["RequiredPlatformCapabilities"] as JArray
                    ?? new JArray();
                return System.Version.TryParse(adminVersionText, out var adminVersion)
                    && adminVersion >= new System.Version(1, 0, 2)
                    && System.Version.TryParse(homeOverviewVersionText, out var homeOverviewVersion)
                    && homeOverviewVersion >= new System.Version(1, 0, 0)
                    && capabilities.Any(item => string.Equals(
                        item?.ToString(),
                        "ApiEngine:platform-sys-user-admin@v1.0.2",
                        StringComparison.Ordinal))
                    && capabilities.Any(item => string.Equals(
                        item?.ToString(),
                        "ApiEngine:platform-home-overview@v1.0.0",
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
                    && homeOverviewCode.Contains("HomeUsageStats")
                    && homeOverviewCode.Contains("recordMenuOpen")
                    && HasPackagedSysUserAiApiKeySchema(package)
                    && HasPackagedSysUserHomeUsageStatsSchema(package);
            }
            if (string.Equals(resourceName, SysConfigPackageResourceName, StringComparison.Ordinal))
            {
                if (!(byKey["platform-tenant-system-settings"].Value<string>("ApiV8Code") ?? string.Empty)
                    .Contains("platform-system-settings-custom-hook")) return false;
                var uploadFields = (package["DiyFields"] as JArray ?? new JArray()).Children<JObject>()
                    .Where(row => string.Equals(row.Value<string>("Name"), "CompatiblePlatformOldVersion", StringComparison.OrdinalIgnoreCase))
                    .ToArray();
                if (uploadFields.Length == 0 && !byKey.ContainsKey("platform-hdfs-upload")
                    && !byKey.ContainsKey("platform-hdfs-upload-hook")) return true;
                if (packageVersion < new System.Version(6, 4, 5) || uploadFields.Length != 1
                    || uploadFields[0].Value<string>("Component") != "Switch"
                    || uploadFields[0].Value<string>("DefaultValue") != "0"
                    || !byKey.TryGetValue("platform-hdfs-upload", out var uploadEngine)
                    || !byKey.ContainsKey("platform-hdfs-upload-hook")) return false;
                var uploadCode = uploadEngine.Value<string>("ApiV8Code") ?? string.Empty;
                return uploadEngine.Value<int?>("StopHttp") == 0
                    && uploadEngine.Value<int?>("AllowAnonymous") == 0
                    && uploadCode.Contains("V8.Method.UploadCurrentRequestAsync")
                    && uploadCode.Contains("V8.Method.IsLegacyUploadCompatibilityEnabled")
                    && uploadCode.Contains("platform-hdfs-upload-hook");
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
                    && HasApiEngineCapabilityAtLeast(
                        aiCapabilities,
                        "platform-ai-runtime",
                        new System.Version(1, 0, 0))
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
        private static Dictionary<string, string> LoadBundledResources()
        {
            var directory = new DirectoryInfo(Path.GetDirectoryName(SourcePath())!);
            while (directory != null && !Directory.Exists(Path.Combine(directory.FullName, "Microi.Server"))) directory = directory.Parent;
            if (directory == null) throw new DirectoryNotFoundException("找不到工作区。");
            return RequiredResourceNames.ToDictionary(name => name, name => File.ReadAllText(Path.Combine(directory.FullName, "Microi.Server", "OfficialApplications", "Resource", name)));
        }
        private static string SourcePath([System.Runtime.CompilerServices.CallerFilePath] string path = "") => path;
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
            UpgradeProgress.WriteLine($"Microi：【基础应用升级】租户[{osClient}]需要修复：{reason}。");
            return Task.FromResult(true);
        }

        /// <summary>
        /// 官方应用源数据库不能被随程序集发布的商城基线包反向覆盖。
        /// 客户可以使用同名 iTdos 租户，因此租户名本身绝不能作为判断依据。
        /// 统一调用 Microi.net 的 LicenseService 判断当前服务器是否拥有签发私钥；
        /// 客户 NuGet/发布包不包含私钥，即使租户也叫 iTdos 仍会正常升级。
        /// </summary>
        private static bool TryParseOfficialResourceResponse(
            string resourceName,
            string body,
            out string content,
            out string error)
        {
            content = string.Empty;
            error = string.Empty;
            if (body.DosIsNullOrWhiteSpace())
            {
                error = $"吾码官方数据库返回的升级资源[{resourceName}]为空。";
                return false;
            }

            JObject response;
            try
            {
                response = JObject.Parse(body);
            }
            catch (Exception ex)
            {
                error = $"吾码官方数据库返回的升级资源[{resourceName}]不是标准JSON响应：{ex.Message}";
                return false;
            }

            if (!int.TryParse(response["Code"]?.ToString(), out var responseCode)
                || responseCode != 1)
            {
                error = $"吾码官方数据库返回升级资源[{resourceName}]失败：{response["Msg"]}";
                return false;
            }

            if (!(response["Data"] is JObject data))
            {
                error = $"吾码官方数据库返回的升级资源[{resourceName}]缺少标准Data对象。";
                return false;
            }

            var returnedResourceName = data["ResourceName"]?.ToString();
            if (!string.Equals(returnedResourceName, resourceName, StringComparison.Ordinal))
            {
                error = $"吾码官方数据库返回的资源名不匹配，期望[{resourceName}]，实际[{returnedResourceName}]。";
                return false;
            }

            var contentToken = data["Content"];
            if (contentToken == null)
            {
                error = $"吾码官方数据库返回的升级资源[{resourceName}]缺少Data.Content。";
                return false;
            }

            content = contentToken.Type == JTokenType.String
                ? contentToken.ToString()
                : contentToken.ToString(Formatting.None);
            return true;
        }

        private static void ValidateResourceContent(string resourceName, string content)
        {
            var error = GetResourceContentValidationError(resourceName, content);
            if (!string.IsNullOrWhiteSpace(error))
            {
                // 程序集内置资源是当前后端发布物的一部分，损坏时必须失败关闭；
                // 官网远程资源使用下面的非抛异常校验方法并安全回退，不会走到这里。
                throw new InvalidOperationException(error);
            }
        }

        private static string GetResourceContentValidationError(string resourceName, string content)
        {
            if (content.DosIsNullOrWhiteSpace())
            {
                return $"升级资源[{resourceName}]内容为空。";
            }

            if (string.Equals(resourceName, ImportPackageResourceName, StringComparison.Ordinal))
            {
                if (!content.Contains("import-microi-store-package"))
                {
                    return $"升级资源[{resourceName}]内容校验失败，未找到目标接口Key。";
                }
                var versionMatch = Regex.Match(content, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!versionMatch.Success ||
                    !System.Version.TryParse(versionMatch.Groups[1].Value, out var importerVersion) ||
                    !HasPinnedImporterCapabilities(content, importerVersion) ||
                    !content.Contains("applicationSha256Base64") ||
                    !content.Contains("PLATFORM_PHYSICAL_NULLABLE_V1") ||
                    !content.Contains("PLATFORM_MYSQL_NULL_DEFAULT_V1") ||
                    !HasSafeAdministratorLegacyRoleGrant(content) ||
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
                    !content.Contains("ADMIN_MENU_PERMISSION_DB_TIME_V1") ||
                    !content.Contains("PHYSICAL_NOT_NULL_TENANT_BACKFILL_V1") ||
                     !content.Contains("MARKETPLACE_CHANGELOG_TENANT_COLLISION_REPAIR_V1") ||
                     !content.Contains("PAGE_ENGINE_OPTIONAL_REFERENCE_V1") ||
                     !content.Contains("SQLSERVER_PHYSICAL_SCHEMA_DIALECT_V1") ||
                     !content.Contains("SQLSERVER_PHYSICAL_FIELD_CHANGE_V1"))
                {
                    return $"升级资源[{resourceName}]版本过旧或缺少幂等安装保护，拒绝覆盖客户数据库。";
                }
                return string.Empty;
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
                    return $"升级资源[{resourceName}]内容校验失败，未找到目标接口Key。";
                }
                return string.Empty;
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
                    return $"升级资源[{resourceName}]缺少当前租户运行时上下文注入能力。";
                }
                return string.Empty;
            }

            JObject package;
            try
            {
                package = JObject.Parse(content);
            }
            catch (Exception ex)
            {
                return $"升级资源[{resourceName}]不是有效的应用数据包JSON：{ex.Message}";
            }

            if (!ExpectedPackageNames.TryGetValue(resourceName, out var expectedPackageName))
            {
                return $"升级资源[{resourceName}]不在受信任应用数据包白名单中。";
            }
            var actualPackageName = package["PackageInfo"]?["Name"]?.ToString();
            if (!string.Equals(actualPackageName, expectedPackageName, StringComparison.Ordinal))
            {
                return $"升级资源[{resourceName}]数据包名称不匹配，期望[{expectedPackageName}]，实际[{actualPackageName}]。";
            }

            if (!HasPackagedV8FirstApplicationRuntime(resourceName, package))
            {
                var packageVersion = package["PackageInfo"]?["Version"]?.ToString() ?? "<missing>";
                var engineCount = (package["SysApiEngines"] as JArray)?.Count ?? 0;
                return $"升级资源[{resourceName}]缺少当前 V8 引擎优先接口、单一官方应用所有权、醒目恢复提示或 CreateIfMissing 个性化 Hook。"
                    + $" PackageInfo.Version=[{packageVersion}]，SysApiEngines={engineCount}。";
            }

            if (string.Equals(resourceName, SsoPackageResourceName, StringComparison.Ordinal)
                && !HasPackagedSsoRuntime(package))
            {
                return $"升级资源[{resourceName}]缺少 v7.5.9 SSO Platform/Managed HTTP 端点闭包、醒目恢复提示、安全 Hook 白名单或 CreateIfMissing 默认模板。";
            }

            if (string.Equals(resourceName, SaaSEnginePackageResourceName, StringComparison.Ordinal))
            {
                if (!HasPackagedFoundationSchema(package))
                {
                    return $"升级资源[{resourceName}]缺少 License 节点、多语言表的完整物理结构或仅补缺的基础语言词条。";
                }
                if (!HasPackagedPlatformRuntime(package))
                {
                    return $"升级资源[{resourceName}]缺少 v7.7.8 平台运行时 Managed 基线、完整声明闭包、CreateIfMissing Hook、安全 microi-init、登录壁纸可信原子契约或完整资源策略。";
                }

                var bundle = (package["ApplicationBundles"] as JArray)?.FirstOrDefault() as JObject;
                var sourceFiles = bundle?["SourceFiles"] as JArray;
                var buildAssets = bundle?["BuildAssets"] as JArray;
                var packageAssets = bundle?["PackageAssets"];
                var packageAssetsObject = packageAssets as JObject;
                // JSON 的显式 null 是 JValue，不是 C# null；它与省略 SourceZip 都表示不分发源码。
                // 真实对象或标量仍拒绝，避免把公开构建包混成源码发布通道。
                var sourceZip = packageAssetsObject?["SourceZip"];
                var buildBytes = buildAssets?.Sum(item => item?["Size"]?.Value<long?>() ?? 0L) ?? 0L;
                if (package["PackageInfo"]?["IncludeSource"]?.Value<bool?>() != false
                    || bundle?["IncludeSource"]?.Value<bool?>() != false
                    || (sourceFiles?.Count ?? 0) != 0
                    || (packageAssets != null
                        && packageAssets.Type != JTokenType.Null
                        && packageAssetsObject == null)
                    || (sourceZip != null && sourceZip.Type != JTokenType.Null)
                    || !string.Equals(bundle?["MicroService"]?["StorageMode"]?.ToString(), "db", StringComparison.OrdinalIgnoreCase)
                    || !string.Equals(bundle?["AssetStoragePolicy"]?["Source"]?.ToString(), "NotIncluded", StringComparison.Ordinal)
                    || !string.Equals(bundle?["AssetStoragePolicy"]?["Build"]?.ToString(), "DatabaseOnly", StringComparison.Ordinal)
                    || (buildAssets?.Count ?? 0) < 1
                    || buildAssets.Count > 256
                    || buildBytes > 5L * 1024 * 1024)
                {
                    return $"升级资源[{resourceName}]必须以无伪源码、256 文件/5MB 内的 DatabaseOnly 平台内置微服务发布。";
                }
            }

            if (string.Equals(resourceName, AppStorePackageResourceName, StringComparison.Ordinal))
            {
                var packageVersionText = package["PackageInfo"]?["Version"]?.ToString()?.TrimStart('v', 'V');
                var packageEngines = package["SysApiEngines"] as JArray;
                var buildZipEngineCode = packageEngines?
                    .FirstOrDefault(item => string.Equals(item?["ApiEngineKey"]?.ToString(), "ai_app_download_build_zip", StringComparison.Ordinal))?
                    ["ApiV8Code"]?.ToString() ?? string.Empty;
                var buildZipEngineVersionText = packageEngines?
                    .FirstOrDefault(item => string.Equals(item?["ApiEngineKey"]?.ToString(), "ai_app_download_build_zip", StringComparison.Ordinal))?
                    ["Version"]?.ToString()?.TrimStart('v', 'V');
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
                    !System.Version.TryParse(buildZipEngineVersionText, out var embeddedBuildZipVersion) ||
                    embeddedBuildZipVersion < new System.Version(1, 2, 4) ||
                    !buildZipEngineCode.Contains("REAL_BUILD_ZIP_ASSETS_V1") ||
                    !buildZipEngineCode.Contains("STABLE_RUNTIME_ASSET_ROUTE_V1") ||
                    !buildZipEngineCode.Contains("VERIFIED_RUNTIME_ASSET_BYTES_V1") ||
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
                    !importerEngineCode.Contains("PHYSICAL_NOT_NULL_TENANT_BACKFILL_V1") ||
                    !importerEngineCode.Contains("MARKETPLACE_CHANGELOG_TENANT_COLLISION_REPAIR_V1") ||
                    !importerEngineCode.Contains("PAGE_ENGINE_OPTIONAL_REFERENCE_V1") ||
                    !importerEngineCode.Contains("POST_SCHEMA_MICROSERVICE_BINDING_RESTORE_V1") ||
                    !importerEngineCode.Contains("PACKAGE_BOUND_MICROSERVICE_MENU_V1") ||
                    !content.Contains("OFFICIAL_PLATFORM_API_ENGINE_OWNERSHIP_V1") ||
                    !bulkEngineCode.Contains("BACKGROUND_TASK_CHECKPOINT_PLAN_V2") ||
                    !bulkEngineCode.Contains("BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1") ||
                    !bulkEngineCode.Contains("BULK_STORAGE_FAILURE_RECOVERY_V1") ||
                    !bulkEngineCode.Contains("BULK_MONOTONIC_CHILD_PROGRESS_V1") ||
                    !HasPackagedMarketplaceRuntime(package))
                {
                    return $"升级资源[{resourceName}]版本过旧，或缺少商城微服务运行时、页面绑定及批量安装能力，拒绝覆盖客户数据库。";
                }
            }
            return string.Empty;
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

        internal static bool HasPackagedFoundationSchema(JObject package)
        {
            // SaaS 首次安装会先写内置微服务，不能依赖之后才执行的商城包或历史迁移。
            var storeColumns = new HashSet<string>(package["PhysicalColumns"]?.OfType<JObject>()
                .Where(c => string.Equals(c["TABLE_NAME"]?.ToString(), "sys_microistore", StringComparison.OrdinalIgnoreCase))
                .Select(c => c["COLUMN_NAME"]?.ToString()) ?? Enumerable.Empty<string>(), StringComparer.OrdinalIgnoreCase);
            if (new[] { "PublishProtocolVersion", "PublishState", "PublishFence", "PublishRowVersion",
                    "ActivePublishVersionId", "CommittedPublishVersionId", "CommittedRuntimeManifestHash" }
                .Any(name => !storeColumns.Contains(name))) return false;
            foreach (var name in new[] { "mci_license_server", "diy_lang" })
            {
                var table = package["DiyTables"]?.OfType<JObject>().FirstOrDefault(t =>
                    string.Equals(t["Name"]?.ToString(), name, StringComparison.OrdinalIgnoreCase));
                if (table == null) return false;
                var fields = package["DiyFields"]?.OfType<JObject>().Where(f =>
                    string.Equals(f["TableId"]?.ToString(), table["Id"]?.ToString(), StringComparison.OrdinalIgnoreCase)).ToArray();
                if (fields == null || fields.Length == 0) return false;
                var names = fields.Select(f => f["Name"]?.ToString()).ToArray();
                if (names.Distinct(StringComparer.OrdinalIgnoreCase).Count() != names.Length) return false;
                var columns = new HashSet<string>(package["PhysicalColumns"]?.OfType<JObject>()
                    .Where(c => string.Equals(c["TABLE_NAME"]?.ToString(), name, StringComparison.OrdinalIgnoreCase))
                    .Select(c => c["COLUMN_NAME"]?.ToString()) ?? Enumerable.Empty<string>(), StringComparer.OrdinalIgnoreCase);
                if (names.Any(n => !columns.Contains(n))) return false;
                var required = new[] { "Id", "CreateTime", "UpdateTime", "UserId", "UserName", "IsDeleted" }
                    .Concat(name == "diy_lang" ? new[] { "Key", "Code", "ZhCN", "En" } : new[] { "HID", "LicenseContent", "LicenseInfoJson" });
                if (required.Any(n => !names.Contains(n, StringComparer.OrdinalIgnoreCase))) return false;
                if (package["DDLStatements"]?.OfType<JObject>().Any(d =>
                    string.Equals(d["TableName"]?.ToString(), name, StringComparison.OrdinalIgnoreCase)) != true) return false;
            }
            var apiTable = package["DiyTables"]?.OfType<JObject>().FirstOrDefault(t =>
                string.Equals(t["Name"]?.ToString(), "sys_apiengine", StringComparison.OrdinalIgnoreCase));
            var apiFields = package["DiyFields"]?.OfType<JObject>().Where(f =>
                apiTable != null && f["TableId"]?.ToString() == apiTable["Id"]?.ToString())
                .Select(f => f["Name"]?.ToString()).ToArray() ?? Array.Empty<string>();
            if (new[] { "ApiEngineKey", "ApiV8Code", "ApiAddress", "IsEnable", "Version" }
                .Any(name => !apiFields.Contains(name, StringComparer.OrdinalIgnoreCase))) return false;
            var dataSets = package["DataSets"]?.OfType<JObject>().ToArray() ?? Array.Empty<JObject>();
            if (dataSets.Any(d => string.Equals(d["TableName"]?.ToString(), "mci_license_server", StringComparison.OrdinalIgnoreCase))) return false;
            var language = dataSets.FirstOrDefault(d => string.Equals(d["TableName"]?.ToString(), "diy_lang", StringComparison.OrdinalIgnoreCase));
            foreach (var columnName in new[] { "Key", "Code", "ZhCN", "En", "ZhTW" })
            {
                if (package["PhysicalColumns"]?.OfType<JObject>().Any(c =>
                    string.Equals(c["TABLE_NAME"]?.ToString(), "diy_lang", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(c["COLUMN_NAME"]?.ToString(), columnName, StringComparison.OrdinalIgnoreCase)
                    && c["SQLSERVER_UNICODE"]?.Type == JTokenType.Boolean
                    && c["SQLSERVER_UNICODE"].Value<bool>()) != true) return false;
            }
            return language?["ConflictPolicy"]?.ToString() == "InsertIfMissing"
                && language["ConflictFields"]?.Values<string>().SequenceEqual(new[] { "Key" }) == true
                && language["Rows"]?.OfType<JObject>().Any(r => r["Key"]?.ToString() == "NoExistData") == true;
        }

    }
}
