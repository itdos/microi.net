using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Trusted cross-tenant atom for the SaaS main-tenant control plane.
    /// Business orchestration remains in a Managed ApiEngine; this class only
    /// proves the durable parent task, resolves the authoritative tenant catalog
    /// and queues a target-scoped task without accepting tenant credentials.
    /// </summary>
    public static class ChildTenantPlatformAppControlService
    {
        public const string OrchestratorApiEngineKey = "bulk-update-child-tenant-platform-apps";
        public const string ChildWorkerApiEngineKey = "bulk-import-microi-store-packages";
        public const string StartupDependenciesMaintenanceScope = "StartupDependencies";
        public const string AppStoreApplicationId = "app.microi.store";
        public const string SaasEngineApplicationId = "app.microi.saas-engine";
        private const string PlatformSysMenuApiEngineKey = "platform-sys-menu";
        private const string PlatformOsClientByDomainApiEngineKey = "platform-os-client-by-domain";
        private const string PlatformSysConfigApiEngineKey = "platform-sys-config";
        private const string PlatformLangBundleApiEngineKey = "platform-lang-bundle";
        private const string PlatformCurrentUserApiEngineKey = "platform-current-user";
        private const string PlatformPrivateFileUrlApiEngineKey = "platform-private-file-url";
        private const string PlatformSysUserPublicInfoApiEngineKey = "platform-sys-user-public-info";
        public const string ClusterConcurrencyKey = "__microi_child_platform_app_install_cluster__";
        public const int ChildWorkerMaxAttempts = 8;
        internal static readonly string[] RequiredStartupApplicationIds =
        {
            AppStoreApplicationId,
            SaasEngineApplicationId
        };
        internal static readonly string[] RequiredBootstrapApiEngineKeys =
        {
            "import-microi-store-package",
            ChildWorkerApiEngineKey,
            PlatformSysMenuApiEngineKey,
            PlatformOsClientByDomainApiEngineKey,
            PlatformSysConfigApiEngineKey,
            PlatformLangBundleApiEngineKey,
            PlatformCurrentUserApiEngineKey,
            PlatformPrivateFileUrlApiEngineKey,
            PlatformSysUserPublicInfoApiEngineKey
        };
        private static readonly string[] ApiEngineBootstrapColumns =
        {
            "Id", "CreateTime", "UpdateTime", "UserId", "UserName", "IsDeleted", "OsClient",
            "ApiEngineKey", "ApiName", "ApiAddress", "ApiV8Code", "ApiRole", "Files", "Category",
            "IsEnable", "StopHttp", "AllowAnonymous", "ResponseFile", "EnableLog", "Lock",
            "Timeout", "MaxStatements", "LimitMemory", "LimitRecursion", "V8Limit", "V8Unlimited",
            "Version"
        };
        private static readonly HashSet<string> ApiEngineSwitchColumns = new HashSet<string>(
            new[]
            {
                "IsDeleted", "IsEnable", "StopHttp", "AllowAnonymous", "ResponseFile",
                "EnableLog", "Lock", "V8Limit", "V8Unlimited"
            },
            StringComparer.OrdinalIgnoreCase);
        private static readonly Regex OsClientKeyRegex =
            new Regex(@"^[A-Za-z0-9._-]{1,100}$", RegexOptions.Compiled);
        private static readonly object MonitorBootstrapRecoverySync = new object();
        private static readonly Dictionary<string, string> MonitorBootstrapRecoveryReady =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        public static DosResult GetTargets(JObject input)
        {
            var permission = ValidateExecution(input, out var context);
            if (permission.Code != 1) return permission;
            try
            {
                // CHILD_TENANT_DIRECTORY_DISCOVERY_ONLY_V1：目录发现只读取主租户的
                // 权威 sys_osclients 快照。运行时挂载和商城工作器自愈必须在逐租户
                // QueueTarget 中独立执行，禁止一个陈旧租户缓存拖垮整批目录读取。
                var targets = SnapshotEligibleChildTenants();
                return new DosResult(1, new
                {
                    RuntimeMainOsClient = context.OwnerOsClient,
                    RuntimeOsClientType = OsClientDefault.OsClientType ?? string.Empty,
                    RuntimeOsClientNetwork = OsClientDefault.OsClientNetwork ?? string.Empty,
                    Count = targets.Count,
                    Targets = targets.Select(item => new
                    {
                        item.OsClient,
                        item.Name
                    }).ToList()
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "读取当前运行环境的子租户目录失败：" + ex.Message);
            }
        }

        public static DosResult QueueTarget(JObject input)
        {
            var permission = ValidateExecution(input, out var context);
            if (permission.Code != 1) return permission;
            var targetOsClient = input?["TargetOsClient"]?.ToString()?.Trim() ?? string.Empty;
            if (!OsClientKeyRegex.IsMatch(targetOsClient))
                return new DosResult(0, null, "TargetOsClient 格式不正确。");
            var maintenanceScope = input?["MaintenanceScope"]?.ToString()?.Trim() ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(maintenanceScope)
                && !string.Equals(
                    maintenanceScope,
                    StartupDependenciesMaintenanceScope,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(0, null, "MaintenanceScope 仅支持 StartupDependencies。");
            }
            var startupDependenciesOnly = string.Equals(
                maintenanceScope,
                StartupDependenciesMaintenanceScope,
                StringComparison.OrdinalIgnoreCase);

            try
            {
                var target = SnapshotEligibleChildTenants().FirstOrDefault(item =>
                    string.Equals(item.OsClient, targetOsClient, StringComparison.OrdinalIgnoreCase));
                if (target == null)
                    return new DosResult(0, null, "目标租户不属于当前运行环境、未启用或已经不是子租户。");

                // CHILD_TENANT_RUNTIME_RELOAD_RECOVERY_V1：sys_osclients 是目录事实源；
                // 节点运行时缓存缺失时先从已提交配置重载一次，再决定该租户是否失败。
                // 失败只归属于当前目标，不能让其它已启用子租户无法投递。
                var targetClient = ResolveTargetClientWithReload(target.OsClient, out var runtimeReloaded);
                if (targetClient?.Db == null)
                    return new DosResult(0, null, "目标租户数据库连接不可用。");

                // CHILD_TENANT_COMPLETE_STARTUP_BOOTSTRAP_V1：平台应用维护本身依赖生成实体
                // 物理列、两个商城工作器及前端进入商城前必调的七个启动接口。老空库可能
                // 恰好缺少这些资源，不能要求它先完整安装两个大包后才能恢复登录页面。
                var bootstrap = EnsureTargetBootstrap(
                    context.OwnerOsClient,
                    target.OsClient,
                    context.TrustedCurrentUser);
                if (bootstrap.Code != 1)
                {
                    return new DosResult(
                        0,
                        bootstrap.Data,
                        $"子租户【{target.Name}】平台应用维护前置自愈失败：{bootstrap.Msg}");
                }

                var childParam = new JObject
                {
                    ["ApiEngineKey"] = ChildWorkerApiEngineKey,
                    ["StoreApiBase"] = "https://api.itdos.com",
                    ["StoreOsClient"] = "iTdos",
                    ["ApplicationType"] = "Platform"
                };
                if (startupDependenciesOnly)
                {
                    // CHILD_TENANT_STARTUP_DEPENDENCY_CLOSURE_V2：登录后的菜单路由由
                    // app.microi.store 单一拥有，匿名配置等运行门面由 SaaS 包拥有。
                    // 事故恢复必须按“应用商城 -> SaaS 引擎”的固定闭包执行，不能再
                    // 只安装 SaaS 包并把 platform-sys-menu 留在不可进入商城的旧租户外。
                    childParam["RequiredAppIds"] = new JArray(RequiredStartupApplicationIds);
                }

                var task = BackgroundTaskService.StartApiEngineForTargetTenant(
                    context.OwnerOsClient,
                    target.OsClient,
                    context.TrustedCurrentUser["Id"]?.ToString() ?? string.Empty,
                    startupDependenciesOnly
                        ? $"子租户【{target.Name}（{target.OsClient}）】恢复平台启动接口"
                        : $"子租户【{target.Name}（{target.OsClient}）】安装/更新全部平台应用",
                    childParam,
                    context.TrustedCurrentUser,
                    new JObject
                    {
                        ["IdempotencyKey"] =
                            ($"child-platform-apps:{context.TaskId}:{target.OsClient}"
                             + (startupDependenciesOnly ? ":startup" : string.Empty))
                            .ToLowerInvariant(),
                        // 子租户可能共享同一物理数据库；商城安装包含 DDL，必须继续使用
                        // 固定工作器键在整个运行环境内串行，避免跨租户结构更新死锁。
                        ["ConcurrencyKey"] = ChildWorkerApiEngineKey,
                        // The installer advances through durable, idempotent shards. A
                        // bounded retry budget must cover both transient database
                        // deadlocks and rolling API restarts without turning either into
                        // a false tenant-level terminal failure.
                        ["MaxAttempts"] = ChildWorkerMaxAttempts,
                        ["RetryOnFailure"] = true
                    });

                try
                {
                    MicroiEngine.QueueSystemLog(
                        context.OwnerOsClient,
                        "SaaSPlatformApps",
                        "QueueChildTenantMaintenance",
                        "主租户已投递子租户平台应用维护任务",
                        $"TaskId={task.Id};TargetOsClient={target.OsClient}",
                        1,
                        true,
                        target.OsClient);
                }
                catch
                {
                    // Audit transport is best effort; durable task state remains
                    // the user-visible and authoritative operation record.
                }

                return new DosResult(1, new
                {
                    TaskId = task.Id,
                    task.Status,
                    task.StatusText,
                    TargetOsClient = target.OsClient,
                    TargetName = target.Name,
                    Bootstrap = bootstrap.Data,
                    RuntimeReloaded = runtimeReloaded,
                    MaintenanceScope = startupDependenciesOnly
                        ? StartupDependenciesMaintenanceScope
                        : "AllPlatformApplications"
                }, $"子租户【{target.Name}】的平台应用维护任务已进入主租户后台任务中心。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "投递子租户平台应用维护任务失败：" + ex.Message);
            }
        }

        internal static void EnsureTargetExecutionAllowed(
            string apiEngineKey,
            string ownerOsClient,
            string targetOsClient)
        {
            EnsureTargetExecutionAllowed(
                apiEngineKey,
                ownerOsClient,
                targetOsClient,
                RuntimeMainOsClient());
        }

        internal static void EnsureTargetExecutionAllowed(
            string apiEngineKey,
            string ownerOsClient,
            string targetOsClient,
            string mainOsClient)
        {
            if (!string.Equals(apiEngineKey, ChildWorkerApiEngineKey, StringComparison.Ordinal)
                || !string.Equals(ownerOsClient, mainOsClient, StringComparison.OrdinalIgnoreCase)
                || string.Equals(targetOsClient, mainOsClient, StringComparison.OrdinalIgnoreCase)
                || !OsClientKeyRegex.IsMatch(targetOsClient ?? string.Empty))
            {
                throw new InvalidOperationException("后台任务目标租户执行标记未通过平台控制面校验。");
            }
        }

        internal static List<ChildTenantTarget> SnapshotEligibleChildTenants()
        {
            var mainOsClient = RuntimeMainOsClient();
            var mainClient = OsClientExtend.GetClient(mainOsClient);
            var db = mainClient?.DbRead ?? mainClient?.Db;
            if (db == null) throw new InvalidOperationException("主租户 SaaS 目录读取连接不可用。");

            var rows = db.FromSql(
                    "SELECT OsClient,ClientName,OsClientType,OsClientNetwork,IsEnable,IsDeleted FROM sys_osclients")
                .ToList<dynamic>() ?? new List<dynamic>();
            return BuildEligibleChildTenants(
                rows.Select(item => JObject.FromObject((object)item)),
                OsClientDefault.OsClientType,
                OsClientDefault.OsClientNetwork,
                mainOsClient);
        }

        internal static List<ChildTenantTarget> BuildEligibleChildTenants(
            IEnumerable<JObject> rows,
            string runtimeType,
            string runtimeNetwork,
            string mainOsClient)
        {
            var result = new List<ChildTenantTarget>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows ?? Enumerable.Empty<JObject>())
            {
                if (row == null || !IsTrue(ReadToken(row, "IsEnable")) || IsTrue(ReadToken(row, "IsDeleted")))
                    continue;
                if (!string.Equals(
                        ReadText(row, "OsClientType").Trim(),
                        (runtimeType ?? string.Empty).Trim(),
                        StringComparison.OrdinalIgnoreCase)
                    || !string.Equals(
                        ReadText(row, "OsClientNetwork").Trim(),
                        (runtimeNetwork ?? string.Empty).Trim(),
                        StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var key = ReadText(row, "OsClient").Trim();
                if (!OsClientKeyRegex.IsMatch(key)
                    || string.Equals(key, mainOsClient, StringComparison.OrdinalIgnoreCase)
                    || !seen.Add(key))
                {
                    continue;
                }
                var name = ReadText(row, "ClientName").Trim();
                result.Add(new ChildTenantTarget
                {
                    OsClient = key,
                    Name = string.IsNullOrWhiteSpace(name) ? key : name
                });
            }
            return result.OrderBy(item => item.OsClient, StringComparer.OrdinalIgnoreCase).ToList();
        }

        private static OsClientSecret ResolveTargetClientWithReload(
            string targetOsClient,
            out bool runtimeReloaded)
        {
            runtimeReloaded = false;
            Exception initialLookupError = null;
            try
            {
                var existing = OsClientExtend.GetClient(targetOsClient);
                if (existing != null) return existing;
            }
            catch (Exception ex)
            {
                initialLookupError = ex;
            }

            var reload = MicroiEngine.V8Method.ReloadOsClient(targetOsClient);
            if (reload == null || reload.Code != 1)
            {
                throw new InvalidOperationException(
                    $"租户 {targetOsClient} 未加载，且从 sys_osclients 重新加载失败："
                    + (reload?.Msg ?? initialLookupError?.Message ?? "服务无返回"),
                    initialLookupError);
            }

            try
            {
                var refreshed = OsClientExtend.GetClient(targetOsClient);
                if (refreshed == null)
                    throw new InvalidOperationException("重载返回成功但运行时仍未注册该租户。");
                runtimeReloaded = true;
                return refreshed;
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    $"租户 {targetOsClient} 从 sys_osclients 重新加载后仍不可用：{ex.Message}",
                    ex);
            }
        }

        private static DosResult EnsureTargetBootstrap(
            string ownerOsClient,
            string targetOsClient,
            JObject trustedCurrentUser)
        {
            var targetClient = ResolveTargetClientWithReload(targetOsClient, out _);
            if (targetClient?.Db == null)
                return new DosResult(0, null, "目标租户数据库连接不可用。");

            var bootstrapStage = "ResolveUpgradeService";
            try
            {
                var upgrade = MicroiEngine.TryGetService<IMicroiUpgrade>();
                if (upgrade == null)
                    return new DosResult(0, null, "平台升级服务尚未加载，无法执行物理前置条件自愈。");
                bootstrapStage = "RuntimePhysicalPrerequisites";
                var prerequisites = upgrade
                    .EnsureRuntimePhysicalPrerequisitesAsync(targetClient)
                    .GetAwaiter()
                    .GetResult();
                if (prerequisites?.Code != 1)
                    return new DosResult(0, prerequisites?.Data, prerequisites?.Msg ?? "物理前置条件自愈无返回。");

                // CHILD_TENANT_APIENGINE_ID_PREREQUISITE_V1：跨租户控制面不能只相信
                // 通用升级服务的成功返回。极老租户可能因历史 DbType/元数据差异跳过
                // sys_apiengine.Id；在复制官方工作器前必须在同一可信原子内物理回读、
                // 幂等扩列和补齐稳定 Id。这里只处理固定平台表/列，不承载业务逻辑。
                bootstrapStage = "ApiEngineStableIdPrerequisite";
                var identityPrerequisite = EnsureTargetApiEngineStableId(targetClient);
                if (identityPrerequisite.Code != 1) return identityPrerequisite;

                // CHILD_TENANT_APIENGINE_POST_CREATE_PHYSICAL_CONTRACT_V1：极老空库可能
                // 由上一步首次创建 sys_apiengine。首次通用前置检查当时看不到该表，
                // 因此必须再执行一次 expand-only 物理契约，使生成实体所需完整列在
                // FormEngine 第一次查询之前就绪。
                bootstrapStage = "ApiEnginePostCreatePhysicalContract";
                prerequisites = upgrade
                    .EnsureRuntimePhysicalPrerequisitesAsync(targetClient)
                    .GetAwaiter()
                    .GetResult();
                if (prerequisites?.Code != 1)
                    return new DosResult(
                        0,
                        prerequisites?.Data,
                        prerequisites?.Msg ?? "接口引擎建表后的物理契约自愈无返回。");

                bootstrapStage = "ApiEngineLowCodeMetadataPrerequisite";
                var metadataPrerequisite = EnsureTargetApiEngineLowCodeMetadata(
                    ownerOsClient,
                    targetOsClient);
                if (metadataPrerequisite.Code != 1) return metadataPrerequisite;

                var created = new List<string>();
                var refreshed = new List<string>();
                var reused = new List<string>();
                foreach (var apiEngineKey in RequiredBootstrapApiEngineKeys)
                {
                    bootstrapStage = "BootstrapApiEngine:" + apiEngineKey;
                    var engine = EnsureTargetApiEngine(
                        ownerOsClient,
                        targetOsClient,
                        apiEngineKey,
                        trustedCurrentUser);
                    if (engine.Code != 1) return engine;
                    var data = engine.Data as JObject
                               ?? (engine.Data == null ? new JObject() : JObject.FromObject(engine.Data));
                    if (data["Created"]?.Value<bool>() == true) created.Add(apiEngineKey);
                    else if (data["Refreshed"]?.Value<bool>() == true) refreshed.Add(apiEngineKey);
                    else reused.Add(apiEngineKey);
                }

                return new DosResult(1, new
                {
                    PhysicalPrerequisites = "Ready",
                    CreatedApiEngines = created,
                    RefreshedApiEngines = refreshed,
                    ReusedApiEngines = reused
                }, created.Count > 0 || refreshed.Count > 0
                    ? "已补齐目标租户商城后台任务自举资源。"
                    : "目标租户商城后台任务自举资源已就绪。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, new { Stage = bootstrapStage }, bootstrapStage + "：" + ex.Message);
            }
        }

        private static DosResult EnsureTargetApiEngineStableId(OsClientSecret targetClient)
        {
            var rawDbType = targetClient.OsClientModel?["DbType"].Val<string>()
                            ?? OsClientDefault.OsClientDbType
                            ?? string.Empty;
            var isMySql = string.Equals(rawDbType, "MySql", StringComparison.OrdinalIgnoreCase);
            var isSqlServer = string.Equals(rawDbType, "SqlServer", StringComparison.OrdinalIgnoreCase);
            var columns = GetApiEnginePhysicalColumnsAuthoritative(targetClient);
            var createdTable = false;

            // CHILD_TENANT_APIENGINE_TABLE_PREREQUISITE_V1：极老的空库可能连
            // sys_apiengine 物理表都不存在。接口引擎不可能在自身承载表不存在时
            // 自举，因此这里只为 MySQL/SQL Server 创建固定、最小且无业务数据的
            // 运行表；应用商城随后仍负责表单元数据和其它可演进字段。
            if (columns.Count == 0)
            {
                if (!isMySql && !isSqlServer)
                {
                    return new DosResult(
                        0,
                        new { TargetOsClient = targetClient.OsClient, DbType = rawDbType },
                        "目标租户缺少 sys_apiengine 物理表，当前数据库类型不支持可信在线建表，请先执行对应数据库升级。");
                }

                var createTableSql = isMySql
                    ? @"CREATE TABLE IF NOT EXISTS `sys_apiengine` (
  `Id` varchar(36) NOT NULL,
  `CreateTime` datetime NULL,
  `UpdateTime` datetime NULL,
  `UserId` varchar(36) NULL,
  `UserName` varchar(255) NULL,
  `IsDeleted` tinyint(1) NULL DEFAULT 0,
  `OsClient` varchar(100) NULL,
  `ApiEngineKey` varchar(255) NOT NULL,
  `ApiName` varchar(255) NULL,
  `ApiAddress` varchar(500) NULL,
  `ApiV8Code` longtext NULL,
  `ApiRole` longtext NULL,
  `Files` longtext NULL,
  `Category` varchar(255) NULL,
  `IsEnable` tinyint(1) NULL DEFAULT 1,
  `StopHttp` tinyint(1) NULL DEFAULT 0,
  `AllowAnonymous` tinyint(1) NULL DEFAULT 0,
  `ResponseFile` tinyint(1) NULL DEFAULT 0,
  `EnableLog` tinyint(1) NULL DEFAULT 0,
  `Lock` tinyint(1) NULL DEFAULT 0,
  `Timeout` int NULL,
  `MaxStatements` int NULL,
  `LimitMemory` int NULL,
  `LimitRecursion` int NULL,
  `V8Limit` int NULL,
  `V8Unlimited` int NULL,
  `Version` varchar(50) NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
                    : @"IF OBJECT_ID(N'[dbo].[sys_apiengine]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[sys_apiengine] (
    [Id] varchar(36) NOT NULL PRIMARY KEY,
    [CreateTime] datetime NULL,
    [UpdateTime] datetime NULL,
    [UserId] varchar(36) NULL,
    [UserName] nvarchar(255) NULL,
    [IsDeleted] bit NULL DEFAULT 0,
    [OsClient] varchar(100) NULL,
    [ApiEngineKey] varchar(255) NOT NULL,
    [ApiName] nvarchar(255) NULL,
    [ApiAddress] nvarchar(500) NULL,
    [ApiV8Code] nvarchar(max) NULL,
    [ApiRole] nvarchar(max) NULL,
    [Files] nvarchar(max) NULL,
    [Category] nvarchar(255) NULL,
    [IsEnable] bit NULL DEFAULT 1,
    [StopHttp] bit NULL DEFAULT 0,
    [AllowAnonymous] bit NULL DEFAULT 0,
    [ResponseFile] bit NULL DEFAULT 0,
    [EnableLog] bit NULL DEFAULT 0,
    [Lock] bit NULL DEFAULT 0,
    [Timeout] int NULL,
    [MaxStatements] int NULL,
    [LimitMemory] int NULL,
    [LimitRecursion] int NULL,
    [V8Limit] int NULL,
    [V8Unlimited] int NULL,
    [Version] varchar(50) NULL
  )
END";
                targetClient.Db.FromSql(createTableSql).ExecuteNonQuery();
                columns = GetApiEnginePhysicalColumnsAuthoritative(targetClient);
                foreach (var requiredColumn in new[] { "Id", "ApiEngineKey", "ApiV8Code" })
                {
                    if (!columns.Contains(requiredColumn))
                    {
                        return new DosResult(
                            0,
                            new { TargetOsClient = targetClient.OsClient, MissingColumn = requiredColumn },
                            "目标租户 sys_apiengine 建表后物理回读不完整，拒绝继续复制官方工作器。");
                    }
                }
                createdTable = true;
            }

            var addedColumn = false;
            if (!columns.Contains("Id"))
            {
                if (!isMySql && !isSqlServer)
                {
                    return new DosResult(
                        0,
                        new { TargetOsClient = targetClient.OsClient, DbType = rawDbType },
                        "目标租户 sys_apiengine 缺少 Id，当前数据库类型不支持在线扩列，请先执行对应数据库升级。");
                }

                var addColumnSql = isMySql
                    ? "ALTER TABLE `sys_apiengine` ADD COLUMN `Id` varchar(36) NULL"
                    : "ALTER TABLE [sys_apiengine] ADD [Id] varchar(36) NULL";
                try
                {
                    targetClient.Db.FromSql(addColumnSql).ExecuteNonQuery();
                }
                catch (Exception ex)
                {
                    if (ex.Message.IndexOf("Duplicate column", StringComparison.OrdinalIgnoreCase) < 0
                        && ex.Message.IndexOf(
                            "Column names in each table must be unique",
                            StringComparison.OrdinalIgnoreCase) < 0)
                    {
                        throw;
                    }
                }

                columns = GetApiEnginePhysicalColumnsAuthoritative(targetClient);
                if (!columns.Contains("Id"))
                {
                    return new DosResult(
                        0,
                        null,
                        "目标租户 sys_apiengine.Id 扩列后物理回读仍不存在，拒绝继续复制官方工作器。");
                }

                addedColumn = true;
            }

            // 其它数据库沿用各自升级程序维护既有物理结构；这里只对缺列时失败关闭，
            // 避免把 MySQL/SQL Server 的 UUID 方言误用到 Oracle、达梦等数据库。
            if (!isMySql && !isSqlServer)
            {
                return new DosResult(1, new
                {
                    TargetOsClient = targetClient.OsClient,
                    CreatedTable = createdTable,
                    AddedColumn = false,
                    BackfilledRows = 0
                });
            }

            var backfillSql = isSqlServer
                ? @"UPDATE [sys_apiengine]
                    SET [Id]=CONVERT(varchar(36), NEWID())
                    WHERE [Id] IS NULL OR LTRIM(RTRIM([Id]))=''"
                : @"UPDATE `sys_apiengine`
                    SET `Id`=UUID()
                    WHERE `Id` IS NULL OR TRIM(`Id`)=''";
            var affected = targetClient.Db.FromSql(backfillSql).ExecuteNonQuery();
            var missingCountSql = isSqlServer
                ? "SELECT COUNT(*) FROM [sys_apiengine] WHERE [Id] IS NULL OR LTRIM(RTRIM([Id]))=''"
                : "SELECT COUNT(*) FROM `sys_apiengine` WHERE `Id` IS NULL OR TRIM(`Id`)=''";
            var missingCount = targetClient.Db.FromSql(missingCountSql)
                .ToScalar<int>();
            if (missingCount != 0)
            {
                return new DosResult(
                    0,
                    new { TargetOsClient = targetClient.OsClient, MissingIdCount = missingCount },
                    "目标租户 sys_apiengine.Id 回填后仍存在空值，拒绝继续复制官方工作器。");
            }

            return new DosResult(1, new
            {
                TargetOsClient = targetClient.OsClient,
                CreatedTable = createdTable,
                AddedColumn = addedColumn,
                BackfilledRows = affected
            });
        }

        private static DosResult EnsureTargetApiEngineLowCodeMetadata(
            string ownerOsClient,
            string targetOsClient)
        {
            // CHILD_TENANT_APIENGINE_LOWCODE_METADATA_PREREQUISITE_V1：ApiEngine 可以
            // 通过权威物理行缓存先恢复 HTTP 路由，但完整应用安装器会用 FormEngine
            // 查询 sys_apiengine。极老空库缺少该表的 diy_table/diy_field 自描述时，
            // 接口自身无法自举。这里只从同一受信主租户复制缺失的固定元数据，绝不
            // 覆盖目标租户已有表/字段定义；完整资源仍由随后执行的官方应用包收敛。
            var ownerClient = OsClientExtend.GetClient(ownerOsClient);
            var targetClient = ResolveTargetClientWithReload(targetOsClient, out _);
            if (ownerClient?.Db == null || targetClient?.Db == null)
                return new DosResult(0, null, "接口引擎元数据来源或目标数据库连接不可用。");

            var ownerTableColumns = GetPhysicalColumnsAuthoritative(ownerClient, "diy_table");
            var targetTableColumns = GetPhysicalColumnsAuthoritative(targetClient, "diy_table");
            var ownerFieldColumns = GetPhysicalColumnsAuthoritative(ownerClient, "diy_field");
            var targetFieldColumns = GetPhysicalColumnsAuthoritative(targetClient, "diy_field");
            if (ownerTableColumns.Count == 0 || targetTableColumns.Count == 0
                || ownerFieldColumns.Count == 0 || targetFieldColumns.Count == 0)
            {
                return new DosResult(
                    0,
                    new
                    {
                        TargetOsClient = targetOsClient,
                        HasDiyTable = targetTableColumns.Count > 0,
                        HasDiyField = targetFieldColumns.Count > 0
                    },
                    "目标租户缺少 diy_table 或 diy_field 物理表，无法建立接口引擎最小自描述元数据。");
            }

            var sourceTable = ReadDiyTableMetadataRow(
                ownerClient,
                ownerTableColumns,
                "sys_apiengine");
            if (sourceTable == null)
                return new DosResult(0, null, "主租户缺少 sys_apiengine 的 diy_table 权威元数据。");

            var targetTable = ReadDiyTableMetadataRow(
                targetClient,
                targetTableColumns,
                "sys_apiengine");
            var createdTableMetadata = false;
            if (targetTable == null)
            {
                var sourceTableId = ReadText(sourceTable, "Id");
                var idConflict = ReadMetadataRowById(
                    targetClient,
                    targetTableColumns,
                    "diy_table",
                    sourceTableId);
                if (idConflict != null)
                {
                    return new DosResult(
                        0,
                        new { TargetOsClient = targetOsClient, TableId = sourceTableId },
                        "目标租户 diy_table 已有其它表占用 sys_apiengine 官方稳定 Id，拒绝覆盖。");
                }

                InsertCompatibleMetadataRow(
                    targetClient,
                    "diy_table",
                    ownerTableColumns,
                    targetTableColumns,
                    sourceTable,
                    new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["OsClient"] = targetOsClient,
                        ["IsDeleted"] = 0
                    });
                targetTable = ReadDiyTableMetadataRow(
                    targetClient,
                    targetTableColumns,
                    "sys_apiengine");
                if (targetTable == null)
                    return new DosResult(0, null, "sys_apiengine 的 diy_table 元数据写入后强回读失败。");
                createdTableMetadata = true;
            }

            var targetTableId = ReadText(targetTable, "Id");
            var sourceFields = ReadDiyFieldMetadataRows(
                ownerClient,
                ownerFieldColumns,
                ReadText(sourceTable, "Id"));
            var requiredFieldNames = new HashSet<string>(
                new[] { "Id", "ApiEngineKey", "ApiV8Code" },
                StringComparer.OrdinalIgnoreCase);
            if (!requiredFieldNames.All(required => sourceFields.Any(
                    field => string.Equals(ReadText(field, "Name"), required, StringComparison.OrdinalIgnoreCase))))
            {
                return new DosResult(0, null, "主租户 sys_apiengine 字段元数据缺少固定启动字段。");
            }

            var createdFieldMetadata = 0;
            foreach (var sourceField in sourceFields)
            {
                var fieldName = ReadText(sourceField, "Name");
                if (string.IsNullOrWhiteSpace(fieldName)) continue;
                var existing = ReadDiyFieldMetadataRow(
                    targetClient,
                    targetFieldColumns,
                    targetTableId,
                    fieldName);
                if (existing != null) continue;

                var sourceFieldId = ReadText(sourceField, "Id");
                var idConflict = ReadMetadataRowById(
                    targetClient,
                    targetFieldColumns,
                    "diy_field",
                    sourceFieldId);
                if (idConflict != null)
                {
                    return new DosResult(
                        0,
                        new
                        {
                            TargetOsClient = targetOsClient,
                            FieldId = sourceFieldId,
                            FieldName = fieldName
                        },
                        "目标租户 diy_field 已有其它字段占用 sys_apiengine 官方稳定字段 Id，拒绝覆盖。");
                }

                InsertCompatibleMetadataRow(
                    targetClient,
                    "diy_field",
                    ownerFieldColumns,
                    targetFieldColumns,
                    sourceField,
                    new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase)
                    {
                        ["TableId"] = targetTableId,
                        ["TableName"] = "sys_apiengine",
                        ["OsClient"] = targetOsClient,
                        ["IsDeleted"] = 0
                    });
                createdFieldMetadata++;
            }

            foreach (var required in requiredFieldNames)
            {
                if (ReadDiyFieldMetadataRow(
                        targetClient,
                        targetFieldColumns,
                        targetTableId,
                        required) == null)
                {
                    return new DosResult(
                        0,
                        new { TargetOsClient = targetOsClient, MissingField = required },
                        "sys_apiengine 最小字段元数据写入后强回读不完整。");
                }
            }

            RefreshApiEngineLowCodeMetadataCache(targetOsClient, targetTable);
            return new DosResult(1, new
            {
                TargetOsClient = targetOsClient,
                TableId = targetTableId,
                CreatedTableMetadata = createdTableMetadata,
                CreatedFieldMetadata = createdFieldMetadata
            });
        }

        private static DosResult EnsureMonitorBootstrapRecovery(
            string ownerOsClient,
            string targetOsClient,
            JObject trustedCurrentUser)
        {
            // CHILD_TENANT_BOOTSTRAP_SOURCE_FINGERPRINT_V1：缓存必须绑定当前主租户
            // 官方工作器源码。只按目标租户缓存会让在线修复后的新版本在同一 API
            // 进程中永远无法刷新到已经重试的子任务。
            var sourceFingerprint = GetBootstrapSourceFingerprint(ownerOsClient);
            var recoveryKey = string.Join("|", new[]
            {
                ownerOsClient ?? string.Empty,
                targetOsClient ?? string.Empty,
                OsClientDefault.OsClientType ?? string.Empty,
                OsClientDefault.OsClientNetwork ?? string.Empty
            });
            lock (MonitorBootstrapRecoverySync)
            {
                if (MonitorBootstrapRecoveryReady.TryGetValue(recoveryKey, out var cachedFingerprint)
                    && string.Equals(cachedFingerprint, sourceFingerprint, StringComparison.Ordinal))
                    return new DosResult(1, new JObject { ["Recovered"] = false });

                var bootstrap = EnsureTargetBootstrap(ownerOsClient, targetOsClient, trustedCurrentUser);
                if (bootstrap.Code != 1) return bootstrap;

                var targetClient = ResolveTargetClientWithReload(targetOsClient, out _);
                if (targetClient?.Db == null)
                    return new DosResult(0, null, "目标租户数据库连接不可用。");
                var targetColumns = GetApiEnginePhysicalColumnsAuthoritative(targetClient);
                var importer = ReadApiEngineRow(
                    targetClient,
                    targetColumns,
                    targetOsClient,
                    "import-microi-store-package");
                var importerCode = ReadText(importer, "ApiV8Code");
                if (string.IsNullOrWhiteSpace(importerCode)
                    || importerCode.IndexOf(
                        "BACKGROUND_TASK_IDEMPOTENCY_DUPLICATE_REPAIR_V1",
                        StringComparison.Ordinal) < 0)
                {
                    return new DosResult(
                        0,
                        new
                        {
                            TargetOsClient = targetOsClient,
                            ImporterVersion = ReadText(importer, "Version")
                        },
                        "跨租户目标的统一应用导入器尚未包含后台任务历史重复幂等键修复能力，"
                        + "且当前主租户受信工作器未能补齐该能力；请同步与当前后端配套的应用商城自举资源后重试。");
                }

                MonitorBootstrapRecoveryReady[recoveryKey] = sourceFingerprint;
                return new DosResult(1, new JObject
                {
                    ["Recovered"] = true,
                    ["ImporterVersion"] = ReadText(importer, "Version")
                });
            }
        }

        private static string GetBootstrapSourceFingerprint(string ownerOsClient)
        {
            var ownerClient = OsClientExtend.GetClient(ownerOsClient);
            if (ownerClient?.Db == null)
                throw new InvalidOperationException("商城工作接口来源数据库连接不可用。");
            var ownerColumns = GetApiEnginePhysicalColumnsAuthoritative(ownerClient);
            var source = new StringBuilder();
            foreach (var apiEngineKey in RequiredBootstrapApiEngineKeys)
            {
                var row = ReadApiEngineRow(ownerClient, ownerColumns, ownerOsClient, apiEngineKey);
                if (row == null)
                    throw new InvalidOperationException($"主租户缺少商城自举接口 {apiEngineKey}。");
                source.Append(apiEngineKey).Append('\n')
                    .Append(ReadText(row, "Version")).Append('\n')
                    .Append(NormalizeBootstrapSourceForComparison(ReadText(row, "ApiV8Code")))
                    .Append('\n');
            }
            using var sha256 = SHA256.Create();
            return BitConverter.ToString(sha256.ComputeHash(Encoding.UTF8.GetBytes(source.ToString())))
                .Replace("-", string.Empty);
        }

        // CHILD_TENANT_EXECUTION_BOOTSTRAP_SCOPE_V1：固定工作器 Key 本身不能证明
        // 这是跨租户任务；还必须核对控制面保留标记以及 owner/target 作用域。
        internal static bool RequiresTargetExecutionBootstrap(
            string apiEngineKey,
            string ownerOsClient,
            string executionOsClient,
            string persistedTargetOsClient)
        {
            var target = (persistedTargetOsClient ?? string.Empty).Trim();
            return string.Equals(apiEngineKey, ChildWorkerApiEngineKey, StringComparison.OrdinalIgnoreCase)
                   && !string.IsNullOrWhiteSpace(ownerOsClient)
                   && !string.IsNullOrWhiteSpace(executionOsClient)
                   && !string.IsNullOrWhiteSpace(target)
                   && !string.Equals(ownerOsClient, executionOsClient, StringComparison.OrdinalIgnoreCase)
                   && string.Equals(target, executionOsClient, StringComparison.OrdinalIgnoreCase);
        }

        internal static DosResult EnsureTargetExecutionBootstrap(
            string ownerOsClient,
            string targetOsClient,
            JObject trustedCurrentUser)
        {
            if (string.Equals(ownerOsClient, targetOsClient, StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(1, new JObject
                {
                    ["Recovered"] = false,
                    ["Skipped"] = true,
                    ["Scope"] = "SameTenantSelfService"
                }, "当前租户自助批量安装按计划优先更新应用商城，不执行跨租户工作器自愈。");
            }

            // CHILD_TENANT_EXECUTION_BOOTSTRAP_V1：父任务进入 Monitor 后不再重复
            // 扫描租户目录，但已经排队的子任务仍必须在进程重启/平台热升级后获得
            // 当前主租户的官方安装器。复用进程内按目标缓存，只在首次执行时自愈，
            // 避免每个导入分片都重复检查物理结构和复制工作器。
            return EnsureMonitorBootstrapRecovery(ownerOsClient, targetOsClient, trustedCurrentUser);
        }

        private static DosResult EnsureTargetApiEngine(
            string ownerOsClient,
            string targetOsClient,
            string apiEngineKey,
            JObject trustedCurrentUser)
        {
            var ownerClient = OsClientExtend.GetClient(ownerOsClient);
            var targetClient = ResolveTargetClientWithReload(targetOsClient, out _);
            if (ownerClient?.Db == null || targetClient?.Db == null)
                return new DosResult(0, null, "商城工作接口来源或目标数据库连接不可用。");

            var ownerColumns = GetApiEnginePhysicalColumnsAuthoritative(ownerClient);
            var targetColumns = GetApiEnginePhysicalColumnsAuthoritative(targetClient);
            foreach (var required in new[] { "Id", "ApiEngineKey", "ApiV8Code" })
            {
                if (!targetColumns.Contains(required))
                    return new DosResult(0, null, $"目标租户 sys_apiengine 缺少必需字段 {required}。");
            }

            var source = ReadApiEngineRow(ownerClient, ownerColumns, ownerOsClient, apiEngineKey);
            if (source == null)
                return new DosResult(0, null, $"主租户缺少商城自举接口 {apiEngineKey}，拒绝向子租户投递空任务。");

            var existing = ReadApiEngineRow(targetClient, targetColumns, targetOsClient, apiEngineKey);
            if (existing != null)
            {
                var shouldRefresh = ShouldRefreshBootstrapEngine(
                    apiEngineKey,
                    ReadText(existing, "Version"),
                    ReadText(existing, "ApiV8Code"),
                    ReadText(source, "Version"),
                    ReadText(source, "ApiV8Code"),
                    out var refreshError);
                if (!string.IsNullOrWhiteSpace(refreshError))
                    return new DosResult(0, new
                    {
                        ApiEngineKey = apiEngineKey,
                        TargetVersion = ReadText(existing, "Version"),
                        SourceVersion = ReadText(source, "Version")
                    }, refreshError);

                if (shouldRefresh)
                {
                    RefreshTargetApiEngine(
                        targetClient,
                        ownerColumns,
                        targetColumns,
                        targetOsClient,
                        apiEngineKey,
                        source);
                }
                else
                {
                    ReconcileTargetApiEngineRuntime(
                        targetClient,
                        targetColumns,
                        targetOsClient,
                        apiEngineKey,
                        source);
                }
                var latest = ReadApiEngineRow(targetClient, targetColumns, targetOsClient, apiEngineKey);
                if (latest == null)
                    return new DosResult(0, null, $"商城自举接口 {apiEngineKey} 刷新后回读失败。");
                var runtimeContractError = GetBootstrapRuntimeContractError(latest, source, targetColumns);
                if (!string.IsNullOrWhiteSpace(runtimeContractError))
                {
                    return new DosResult(
                        0,
                        new { ApiEngineKey = apiEngineKey, RuntimeContractError = runtimeContractError },
                        $"商城自举接口 {apiEngineKey} 刷新后运行契约不一致：{runtimeContractError}");
                }
                RefreshApiEngineCache(targetOsClient, latest, apiEngineKey);
                return new DosResult(1, new JObject
                {
                    ["Created"] = false,
                    ["Refreshed"] = shouldRefresh,
                    ["Id"] = latest.GetValue("Id", StringComparison.OrdinalIgnoreCase)?.ToString() ?? string.Empty,
                    ["ApiEngineKey"] = apiEngineKey,
                    ["Version"] = ReadText(latest, "Version")
                });
            }

            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var values = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
            foreach (var column in ApiEngineBootstrapColumns)
            {
                if (!targetColumns.Contains(column)) continue;
                var token = source.GetValue(column, StringComparison.OrdinalIgnoreCase);
                values[column] = ToDatabaseValue(token);
            }
            values["Id"] = Ulid.NewUlid().ToString();
            values["ApiEngineKey"] = apiEngineKey;
            values["CreateTime"] = now;
            values["UpdateTime"] = now;
            if (targetColumns.Contains("OsClient")) values["OsClient"] = targetOsClient;
            if (targetColumns.Contains("UserId"))
                values["UserId"] = trustedCurrentUser?["Id"]?.ToString() ?? string.Empty;
            if (targetColumns.Contains("UserName"))
                values["UserName"] = trustedCurrentUser?["Name"]?.ToString()
                                     ?? trustedCurrentUser?["Account"]?.ToString()
                                     ?? "平台管理员";
            // Historic tenant databases use a mix of BIT(1), BINARY(1), tinyint
            // and provider-specific boolean columns for these switches. Binding
            // Int32 0/1 to a BINARY(1) column is four bytes and MySQL reports the
            // misleading "Data too long" error. Bind CLR Boolean so every
            // supported provider emits its native one-bit/one-byte value.
            if (targetColumns.Contains("IsDeleted")) values["IsDeleted"] = BootstrapSwitch(false);
            if (targetColumns.Contains("IsEnable")) values["IsEnable"] = BootstrapSwitch(true);
            if (targetColumns.Contains("StopHttp")) values["StopHttp"] = BootstrapSwitch(false);

            var ordered = ApiEngineBootstrapColumns
                .Where(column => values.ContainsKey(column))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var quote = IdentifierQuote(targetClient);
            var parameterColumns = new List<string>();
            var valueExpressions = ordered.Select(column =>
            {
                if (ApiEngineSwitchColumns.Contains(column))
                {
                    return BootstrapSwitchLiteral(values[column]) == 1 ? "1" : "0";
                }
                var expression = "@p" + parameterColumns.Count;
                parameterColumns.Add(column);
                return expression;
            }).ToList();
            var sql = $"INSERT INTO {quote("sys_apiengine")} ("
                      + string.Join(",", ordered.Select(quote)) + ") VALUES ("
                      + string.Join(",", valueExpressions) + ")";
            var command = targetClient.Db.FromSql(sql);
            for (var index = 0; index < parameterColumns.Count; index++)
                command.AddInParameter("p" + index, values[parameterColumns[index]] ?? DBNull.Value);
            if (command.ExecuteNonQuery() != 1)
                return new DosResult(0, null, $"补齐商城自举接口 {apiEngineKey} 时数据库未写入记录。");

            var inserted = ReadApiEngineRow(targetClient, targetColumns, targetOsClient, apiEngineKey);
            if (inserted == null)
                return new DosResult(0, null, $"补齐商城自举接口 {apiEngineKey} 后回读失败。");
            RefreshApiEngineCache(targetOsClient, inserted, apiEngineKey);
            return new DosResult(1, new JObject
            {
                ["Created"] = true,
                ["Refreshed"] = false,
                ["Id"] = inserted.GetValue("Id", StringComparison.OrdinalIgnoreCase)?.ToString() ?? string.Empty,
                ["ApiEngineKey"] = apiEngineKey,
                ["Version"] = ReadText(inserted, "Version")
            });
        }

        internal static bool ShouldRefreshBootstrapEngine(
            string apiEngineKey,
            string targetVersion,
            string targetCode,
            string sourceVersion,
            string sourceCode,
            out string error)
        {
            error = string.Empty;
            if (string.Equals(
                    NormalizeBootstrapSourceForComparison(targetCode),
                    NormalizeBootstrapSourceForComparison(sourceCode),
                    StringComparison.Ordinal))
                return false;

            if (!TryParseBootstrapVersion(targetVersion, out var targetParts)
                && !TryParseBootstrapSourceVersion(targetCode, out targetParts)
                || !TryParseBootstrapVersion(sourceVersion, out var sourceParts)
                && !TryParseBootstrapSourceVersion(sourceCode, out sourceParts))
            {
                error = $"商城核心工作器 {apiEngineKey} 的版本无法安全比较，拒绝覆盖；"
                        + $"Target={targetVersion ?? string.Empty}，Source={sourceVersion ?? string.Empty}。";
                return false;
            }

            var comparison = CompareBootstrapVersion(targetParts, sourceParts);
            if (comparison > 0) return false;
            if (comparison == 0)
            {
                error = $"商城核心工作器 {apiEngineKey} 与主租户同版本但源码不同，疑似租户定制，拒绝覆盖。";
                return false;
            }

            if (!IsRecognizedBootstrapEngineSource(apiEngineKey, targetCode))
            {
                error = $"商城核心工作器 {apiEngineKey} 的旧源码无法识别为官方谱系，拒绝自动覆盖租户代码。";
                return false;
            }
            return true;
        }

        private static string NormalizeBootstrapSourceForComparison(string source)
        {
            var normalized = (source ?? string.Empty)
                .TrimStart('\uFEFF')
                .Replace("\r\n", "\n")
                .Replace('\r', '\n')
                .TrimEnd();

            // MCP/VS Code 保存接口引擎时会在完整官方源码外再生成一层描述头。
            // 应用包内嵌的是同一份正文，没有这层传输元数据；若把二者按原文
            // 比较，会把未改动的 Managed 官方源码误判为租户定制。只剥离开头
            // 且同时具备完整稳定标识的生成头，OFFICIAL_MANAGED_NOTICE 及正文
            // 内部注释均保留参与比较，不能因此放宽真实定制代码保护。
            while (normalized.StartsWith("/*", StringComparison.Ordinal))
            {
                var commentEnd = normalized.IndexOf("*/", StringComparison.Ordinal);
                if (commentEnd < 0) break;
                var header = normalized.Substring(0, commentEnd + 2);
                if (header.IndexOf("V8 ApiEngine", StringComparison.Ordinal) < 0
                    || header.IndexOf("ApiEngineKey:", StringComparison.Ordinal) < 0
                    || header.IndexOf("Version:", StringComparison.Ordinal) < 0
                    || header.IndexOf("Function:", StringComparison.Ordinal) < 0)
                    break;
                normalized = normalized.Substring(commentEnd + 2).TrimStart();
            }
            return normalized.TrimEnd();
        }

        private static bool TryParseBootstrapVersion(string value, out int[] parts)
        {
            parts = null;
            var match = Regex.Match(value ?? string.Empty, @"^\s*[vV]?(\d+)\.(\d+)\.(\d+)\s*$");
            if (!match.Success) return false;
            parts = new[]
            {
                int.Parse(match.Groups[1].Value),
                int.Parse(match.Groups[2].Value),
                int.Parse(match.Groups[3].Value)
            };
            return true;
        }

        private static bool TryParseBootstrapSourceVersion(string source, out int[] parts)
        {
            parts = null;
            var match = Regex.Match(
                source ?? string.Empty,
                @"\bVersion\s*:\s*[vV]?(\d+)\.(\d+)\.(\d+)\b",
                RegexOptions.IgnoreCase);
            if (!match.Success) return false;
            parts = new[]
            {
                int.Parse(match.Groups[1].Value),
                int.Parse(match.Groups[2].Value),
                int.Parse(match.Groups[3].Value)
            };
            return true;
        }

        private static int CompareBootstrapVersion(int[] left, int[] right)
        {
            for (var index = 0; index < 3; index++)
            {
                var comparison = left[index].CompareTo(right[index]);
                if (comparison != 0) return comparison;
            }
            return 0;
        }

        private static bool IsRecognizedBootstrapEngineSource(string apiEngineKey, string source)
        {
            var code = source ?? string.Empty;
            if (string.Equals(apiEngineKey, "import-microi-store-package", StringComparison.Ordinal))
            {
                return code.IndexOf("var Package = V8.Param.Package", StringComparison.Ordinal) >= 0
                       && code.IndexOf("sys_microistore", StringComparison.OrdinalIgnoreCase) >= 0;
            }
            if (string.Equals(apiEngineKey, ChildWorkerApiEngineKey, StringComparison.Ordinal))
            {
                return code.IndexOf("import-microi-store-package", StringComparison.Ordinal) >= 0
                       && code.IndexOf("ApplicationType", StringComparison.Ordinal) >= 0;
            }
            if (string.Equals(apiEngineKey, PlatformSysMenuApiEngineKey, StringComparison.Ordinal))
            {
                return code.IndexOf("V8.Method.ManageSystemDirectory", StringComparison.Ordinal) >= 0
                       && code.IndexOf("Domain: 'SysMenu'", StringComparison.Ordinal) >= 0
                       && code.IndexOf("GetSysMenuStep", StringComparison.Ordinal) >= 0;
            }
            if (string.Equals(apiEngineKey, PlatformOsClientByDomainApiEngineKey, StringComparison.Ordinal))
                return code.IndexOf("V8.Method.ResolveOsClientByDomain", StringComparison.Ordinal) >= 0;
            if (string.Equals(apiEngineKey, PlatformSysConfigApiEngineKey, StringComparison.Ordinal))
                return code.IndexOf("V8.Method.GetPublicSysConfig", StringComparison.Ordinal) >= 0;
            if (string.Equals(apiEngineKey, PlatformLangBundleApiEngineKey, StringComparison.Ordinal))
                return code.IndexOf("V8.Method.GetLangBundle", StringComparison.Ordinal) >= 0;
            if (string.Equals(apiEngineKey, PlatformCurrentUserApiEngineKey, StringComparison.Ordinal))
                return code.IndexOf("V8.CurrentUser", StringComparison.Ordinal) >= 0;
            if (string.Equals(apiEngineKey, PlatformPrivateFileUrlApiEngineKey, StringComparison.Ordinal))
                return code.IndexOf("V8.Method.GetAuthorizedPrivateFileUrl", StringComparison.Ordinal) >= 0;
            if (string.Equals(apiEngineKey, PlatformSysUserPublicInfoApiEngineKey, StringComparison.Ordinal))
                return code.IndexOf("GetTableData('sys_user'", StringComparison.Ordinal) >= 0;
            return false;
        }

        private static JObject ReadDiyTableMetadataRow(
            OsClientSecret client,
            HashSet<string> columns,
            string tableName)
        {
            if (!columns.Contains("Name")) return null;
            var quote = IdentifierQuote(client);
            var sql = $"SELECT * FROM {quote("diy_table")} WHERE LOWER({quote("Name")})=LOWER(@p0)";
            if (columns.Contains("IsDeleted"))
                sql += $" AND ({quote("IsDeleted")} IS NULL OR {quote("IsDeleted")}<>1)";
            var row = client.Db.FromSql(sql)
                .AddInParameter("p0", tableName)
                .First<dynamic>();
            return row == null ? null : JObject.FromObject((object)row);
        }

        private static List<JObject> ReadDiyFieldMetadataRows(
            OsClientSecret client,
            HashSet<string> columns,
            string tableId)
        {
            if (!columns.Contains("TableId")) return new List<JObject>();
            var quote = IdentifierQuote(client);
            var sql = $"SELECT * FROM {quote("diy_field")} WHERE {quote("TableId")}=@p0";
            if (columns.Contains("IsDeleted"))
                sql += $" AND ({quote("IsDeleted")} IS NULL OR {quote("IsDeleted")}<>1)";
            if (columns.Contains("Sort")) sql += $" ORDER BY {quote("Sort")} ASC";
            return client.Db.FromSql(sql)
                .AddInParameter("p0", tableId)
                .ToArray()
                .Select(item => JObject.FromObject((object)item))
                .ToList();
        }

        private static JObject ReadDiyFieldMetadataRow(
            OsClientSecret client,
            HashSet<string> columns,
            string tableId,
            string fieldName)
        {
            if (!columns.Contains("TableId") || !columns.Contains("Name")) return null;
            var quote = IdentifierQuote(client);
            var sql = $"SELECT * FROM {quote("diy_field")} WHERE {quote("TableId")}=@p0 "
                      + $"AND LOWER({quote("Name")})=LOWER(@p1)";
            if (columns.Contains("IsDeleted"))
                sql += $" AND ({quote("IsDeleted")} IS NULL OR {quote("IsDeleted")}<>1)";
            var row = client.Db.FromSql(sql)
                .AddInParameter("p0", tableId)
                .AddInParameter("p1", fieldName)
                .First<dynamic>();
            return row == null ? null : JObject.FromObject((object)row);
        }

        private static JObject ReadMetadataRowById(
            OsClientSecret client,
            HashSet<string> columns,
            string tableName,
            string id)
        {
            if (string.IsNullOrWhiteSpace(id) || !columns.Contains("Id")) return null;
            var quote = IdentifierQuote(client);
            var row = client.Db.FromSql(
                    $"SELECT * FROM {quote(tableName)} WHERE {quote("Id")}=@p0")
                .AddInParameter("p0", id)
                .First<dynamic>();
            return row == null ? null : JObject.FromObject((object)row);
        }

        private static void InsertCompatibleMetadataRow(
            OsClientSecret targetClient,
            string tableName,
            HashSet<string> ownerColumns,
            HashSet<string> targetColumns,
            JObject source,
            IDictionary<string, object> overrides)
        {
            var quote = IdentifierQuote(targetClient);
            var bootstrapColumns = string.Equals(tableName, "diy_table", StringComparison.OrdinalIgnoreCase)
                ? new HashSet<string>(new[]
                {
                    "Id", "Name", "Description", "CreateTime", "UpdateTime", "UserId",
                    "UserName", "IsDeleted", "OsClient"
                }, StringComparer.OrdinalIgnoreCase)
                : new HashSet<string>(new[]
                {
                    "Id", "TableId", "TableName", "Name", "Label", "Type", "Component",
                    "CreateTime", "UpdateTime", "UserId", "UserName", "IsDeleted", "OsClient"
                }, StringComparer.OrdinalIgnoreCase);
            var columns = targetColumns
                .Where(column => bootstrapColumns.Contains(column)
                                 && ownerColumns.Contains(column)
                                 && (source.GetValue(column, StringComparison.OrdinalIgnoreCase) != null
                                     || overrides.ContainsKey(column)))
                .OrderBy(column => column, StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (!columns.Contains("Id", StringComparer.OrdinalIgnoreCase))
                throw new InvalidOperationException($"{tableName} 元数据源缺少稳定 Id，拒绝写入。");

            var values = columns.Select(column =>
            {
                var value = overrides.TryGetValue(column, out var overrideValue)
                    ? overrideValue
                    : ToDatabaseValue(source.GetValue(column, StringComparison.OrdinalIgnoreCase));
                return value is byte[] ? BootstrapSwitchLiteral(value) : value;
            }).ToList();

            // CHILD_TENANT_METADATA_BIT_LITERAL_V1：部分极老 MySQL 空库把固定开关列
            // 定义为 bit(1)。Dos.ORM 参数绑定整数时，旧驱动会按二进制文本写入并报
            // Data too long；字段名来自上方固定白名单，值只允许 0/1 常量，其它元数据
            // 仍全部参数化。SQL Server bit 同样接受该固定字面量。
            var sql = $"INSERT INTO {quote(tableName)} ("
                      + string.Join(",", columns.Select(quote))
                      + ") VALUES ("
                      + string.Join(",", columns.Select((column, index) =>
                          string.Equals(column, "IsDeleted", StringComparison.OrdinalIgnoreCase)
                              ? BootstrapSwitchLiteral(values[index]).ToString()
                              : "@m" + index))
                      + ")";
            var command = targetClient.Db.FromSql(sql);
            for (var index = 0; index < columns.Count; index++)
            {
                var column = columns[index];
                if (string.Equals(column, "IsDeleted", StringComparison.OrdinalIgnoreCase))
                    continue;
                command.AddInParameter("m" + index, values[index] ?? DBNull.Value);
            }
            if (command.ExecuteNonQuery() != 1)
                throw new InvalidOperationException($"写入 {tableName} 自举元数据时数据库受影响行数不是1。");
        }

        private static void RefreshApiEngineLowCodeMetadataCache(
            string osClient,
            JObject tableRow)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var tableId = ReadText(tableRow, "Id");
            foreach (var key in new[] { "sys_apiengine", tableId }
                         .Where(value => !string.IsNullOrWhiteSpace(value)))
            {
                var normalized = key.ToLowerInvariant();
                var tableCacheKey = $"Microi:{osClient}:FormData:diy_table:{normalized}";
                cache.RemoveAsync(tableCacheKey).GetAwaiter().GetResult();
                cache.SetAsync<dynamic>(tableCacheKey, tableRow).GetAwaiter().GetResult();
                cache.RemoveAsync(
                        $"Microi:{osClient}:FormData:diy_table_field_list:{normalized}")
                    .GetAwaiter()
                    .GetResult();
            }
        }

        private static void RefreshTargetApiEngine(
            OsClientSecret targetClient,
            HashSet<string> ownerColumns,
            HashSet<string> targetColumns,
            string targetOsClient,
            string apiEngineKey,
            JObject source)
        {
            var excluded = new HashSet<string>(new[]
            {
                "Id", "CreateTime", "UserId", "UserName", "OsClient", "ApiEngineKey", "UpdateTime"
            }, StringComparer.OrdinalIgnoreCase);
            var quote = IdentifierQuote(targetClient);
            var assignments = new List<string>();
            var parameterValues = new List<object>();
            foreach (var column in ApiEngineBootstrapColumns)
            {
                if (excluded.Contains(column)
                    || !ownerColumns.Contains(column)
                    || !targetColumns.Contains(column)) continue;
                var value = ToDatabaseValue(source.GetValue(column, StringComparison.OrdinalIgnoreCase));
                if (ApiEngineSwitchColumns.Contains(column))
                {
                    assignments.Add($"{quote(column)}={BootstrapSwitchLiteral(value)}");
                    continue;
                }
                assignments.Add($"{quote(column)}=@u{parameterValues.Count}");
                parameterValues.Add(value);
            }
            if (targetColumns.Contains("UpdateTime"))
            {
                assignments.Add($"{quote("UpdateTime")}=@u{parameterValues.Count}");
                parameterValues.Add(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            }
            if (assignments.Count == 0)
                throw new InvalidOperationException($"商城核心工作器 {apiEngineKey} 没有可刷新的共享字段。");

            var sql = $"UPDATE {quote("sys_apiengine")} SET {string.Join(",", assignments)} "
                      + $"WHERE {quote("ApiEngineKey")}=@key";
            if (targetColumns.Contains("OsClient")) sql += $" AND {quote("OsClient")}=@osClient";
            var command = targetClient.Db.FromSql(sql).AddInParameter("key", apiEngineKey);
            if (targetColumns.Contains("OsClient")) command.AddInParameter("osClient", targetOsClient);
            for (var index = 0; index < parameterValues.Count; index++)
                command.AddInParameter("u" + index, parameterValues[index] ?? DBNull.Value);
            if (command.ExecuteNonQuery() != 1)
                throw new InvalidOperationException($"刷新商城核心工作器 {apiEngineKey} 时数据库未更新记录。");
        }

        private static HashSet<string> GetPhysicalColumns(OsClientSecret client, string tableName)
        {
            var dbInfo = DiyCommon.GetDbInfo(
                client.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType);
            var result = MicroiEngine.ORM(dbInfo.DbType).GetColumns(new DbServiceParam
            {
                OsClient = client.OsClient,
                TableName = tableName,
                DbSession = client.Db,
                DbInfo = dbInfo
            });
            if (result.Code != 1 || result.Data == null)
                throw new InvalidOperationException($"读取租户 {client.OsClient} 的 {tableName} 物理字段失败：{result.Msg}");
            return new HashSet<string>(result.Data
                .Select(item => JObject.FromObject((object)item)
                    .GetValue("column_name", StringComparison.OrdinalIgnoreCase)?.ToString())
                .Where(name => !string.IsNullOrWhiteSpace(name)), StringComparer.OrdinalIgnoreCase);
        }

        private static HashSet<string> GetPhysicalColumnsAuthoritative(
            OsClientSecret client,
            string tableName)
        {
            if (string.IsNullOrWhiteSpace(tableName)
                || !Regex.IsMatch(tableName, @"^[A-Za-z][A-Za-z0-9_]{0,127}$"))
                throw new InvalidOperationException("物理表名不符合固定标识符白名单。");
            var rawDbType = client.OsClientModel?["DbType"].Val<string>()
                            ?? OsClientDefault.OsClientDbType
                            ?? string.Empty;
            var isMySql = string.Equals(rawDbType, "MySql", StringComparison.OrdinalIgnoreCase);
            var isSqlServer = string.Equals(rawDbType, "SqlServer", StringComparison.OrdinalIgnoreCase);
            if (!isMySql && !isSqlServer)
                return GetPhysicalColumns(client, tableName);

            var sql = isMySql
                ? @"SELECT COLUMN_NAME AS ColumnName
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=LOWER(@p0)"
                : @"SELECT COLUMN_NAME AS ColumnName
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_CATALOG=DB_NAME() AND LOWER(TABLE_NAME)=LOWER(@p0)";
            var rows = client.Db.FromSql(sql)
                .AddInParameter("p0", tableName)
                .ToArray();
            return new HashSet<string>(
                rows.Select(item => JObject.FromObject((object)item)
                        .GetValue("ColumnName", StringComparison.OrdinalIgnoreCase)?.ToString())
                    .Where(name => !string.IsNullOrWhiteSpace(name)),
                StringComparer.OrdinalIgnoreCase);
        }

        private static HashSet<string> GetApiEnginePhysicalColumnsAuthoritative(OsClientSecret client)
        {
            // CHILD_TENANT_APIENGINE_AUTHORITATIVE_COLUMN_READ_V1：通用 ORM 列枚举可能在
            // 同一进程内保留建表/扩列前快照。sys_apiengine 是启动自举的唯一固定物理
            // 前置表，MySQL/SQL Server 必须从 INFORMATION_SCHEMA 直读并用于 DDL 后强回读。
            return GetPhysicalColumnsAuthoritative(client, "sys_apiengine");
        }

        private static JObject ReadApiEngineRow(
            OsClientSecret client,
            HashSet<string> columns,
            string osClient,
            string apiEngineKey)
        {
            var quote = IdentifierQuote(client);
            var sql = $"SELECT * FROM {quote("sys_apiengine")} WHERE {quote("ApiEngineKey")}=@p0";
            if (columns.Contains("OsClient")) sql += $" AND {quote("OsClient")}=@p1";
            var query = client.Db.FromSql(sql).AddInParameter("p0", apiEngineKey);
            if (columns.Contains("OsClient")) query.AddInParameter("p1", osClient);
            var row = query.First<dynamic>();
            return row == null ? null : JObject.FromObject((object)row);
        }

        private static void ReconcileTargetApiEngineRuntime(
            OsClientSecret client,
            HashSet<string> columns,
            string osClient,
            string apiEngineKey,
            JObject source)
        {
            var assignments = new List<string>();
            var parameters = new List<object>();
            var quote = IdentifierQuote(client);
            if (columns.Contains("IsDeleted")) assignments.Add($"{quote("IsDeleted")}=0");
            if (columns.Contains("IsEnable")) assignments.Add($"{quote("IsEnable")}=1");
            if (columns.Contains("StopHttp"))
                assignments.Add($"{quote("StopHttp")}={BootstrapSwitchLiteral(ToDatabaseValue(source?["StopHttp"]))}");
            if (columns.Contains("AllowAnonymous"))
                assignments.Add($"{quote("AllowAnonymous")}={BootstrapSwitchLiteral(ToDatabaseValue(source?["AllowAnonymous"]))}");
            foreach (var column in new[] { "ApiAddress", "Version" })
            {
                if (!columns.Contains(column)) continue;
                assignments.Add($"{quote(column)}=@u{parameters.Count}");
                parameters.Add(ToDatabaseValue(source?[column]));
            }
            if (columns.Contains("UpdateTime"))
            {
                assignments.Add($"{quote("UpdateTime")}=@u{parameters.Count}");
                parameters.Add(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            }
            if (assignments.Count == 0) return;
            var sql = $"UPDATE {quote("sys_apiengine")} SET {string.Join(",", assignments)} "
                      + $"WHERE {quote("ApiEngineKey")}=@p0";
            if (columns.Contains("OsClient")) sql += $" AND {quote("OsClient")}=@p1";
            var command = client.Db.FromSql(sql).AddInParameter("p0", apiEngineKey);
            if (columns.Contains("OsClient")) command.AddInParameter("p1", osClient);
            for (var index = 0; index < parameters.Count; index++)
                command.AddInParameter("u" + index, parameters[index] ?? DBNull.Value);
            if (command.ExecuteNonQuery() != 1)
                throw new InvalidOperationException($"补正平台启动自举接口 {apiEngineKey} 运行契约时数据库未更新记录。");
        }

        private static string GetBootstrapRuntimeContractError(
            JObject target,
            JObject source,
            HashSet<string> columns)
        {
            if (target == null) return "记录不存在";
            if (columns.Contains("ApiAddress")
                && !string.Equals(
                    ReadText(target, "ApiAddress"),
                    ReadText(source, "ApiAddress"),
                    StringComparison.OrdinalIgnoreCase))
                return "ApiAddress 未按官方自举契约补正";
            foreach (var column in new[] { "IsDeleted", "IsEnable", "StopHttp", "AllowAnonymous" })
            {
                if (!columns.Contains(column)) continue;
                var expected = column == "IsDeleted"
                    ? 0
                    : column == "IsEnable"
                        ? 1
                        : BootstrapSwitchLiteral(ToDatabaseValue(source?[column]));
                var actual = BootstrapSwitchLiteral(ToDatabaseValue(target?[column]));
                if (actual != expected) return column + " 未按官方自举契约补正";
            }
            return string.Empty;
        }

        private static Func<string, string> IdentifierQuote(OsClientSecret client)
        {
            var dbType = client.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            if (string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase))
                return value => "[" + value + "]";
            if (string.Equals(dbType, "Oracle", StringComparison.OrdinalIgnoreCase))
                return value => "\"" + value.ToUpperInvariant() + "\"";
            return value => "`" + value + "`";
        }

        private static object ToDatabaseValue(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                return DBNull.Value;
            if (token is JValue value) return value.Value ?? DBNull.Value;
            return token.ToString(Newtonsoft.Json.Formatting.None);
        }

        internal static object BootstrapSwitch(bool value)
        {
            return value;
        }

        internal static int BootstrapSwitchLiteral(object value)
        {
            if (value == null || value == DBNull.Value) return 0;
            if (value is bool boolean) return boolean ? 1 : 0;
            if (value is byte[] bytes) return bytes.Any(item => item != 0) ? 1 : 0;
            var text = Convert.ToString(value)?.Trim() ?? string.Empty;
            if (bool.TryParse(text, out var parsedBoolean)) return parsedBoolean ? 1 : 0;
            return long.TryParse(text, out var parsedNumber) && parsedNumber != 0 ? 1 : 0;
        }

        private static void RefreshApiEngineCache(string osClient, JObject row, string apiEngineKey)
        {
            // CHILD_TENANT_APIENGINE_BOOTSTRAP_CACHE_PROJECTION_V1：极老空库可能尚无
            // sys_apiengine 的 diy_table/diy_field 自描述元数据，旧 ApiEngine 内核会在
            // FormEngine 回源前失败。物理写入和强回读成功后，将同一权威行投影到平台
            // 原有 Key/Id/ApiAddress 缓存，使安装器先启动；完整应用包随后补齐低代码元数据。
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var keys = new[]
            {
                apiEngineKey,
                row?.GetValue("Id", StringComparison.OrdinalIgnoreCase)?.ToString(),
                row?.GetValue("ApiAddress", StringComparison.OrdinalIgnoreCase)?.ToString()
            };
            foreach (var key in keys.Where(value => !string.IsNullOrWhiteSpace(value)))
            {
                var cacheKey = $"Microi:{osClient}:FormData:sys_apiengine:{key.ToLowerInvariant()}";
                cache.RemoveAsync(cacheKey)
                    .GetAwaiter()
                    .GetResult();
                cache.SetAsync<dynamic>(cacheKey, row)
                    .GetAwaiter()
                    .GetResult();
            }
        }

        private static DosResult ValidateExecution(
            JObject input,
            out TrustedBackgroundTaskExecutionContext context)
        {
            context = null;
            var taskId = input?["_BackgroundTaskId"]?.ToString()
                         ?? input?["BackgroundTaskId"]?.ToString()
                         ?? input?["TaskId"]?.ToString()
                         ?? string.Empty;
            long.TryParse(
                input?["_BackgroundTaskFencingToken"]?.ToString()
                ?? input?["FencingToken"]?.ToString(),
                out var fencingToken);
            if (!BackgroundTaskService.TryGetCurrentExecutionContext(
                    taskId,
                    fencingToken,
                    OrchestratorApiEngineKey,
                    out context))
            {
                return new DosResult(0, null, "该操作必须由当前有效租约下的主租户持久后台任务执行。");
            }
            if (!string.Equals(context.OwnerOsClient, RuntimeMainOsClient(), StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "只有当前后端运行环境的主租户可以维护全部子租户平台应用。");

            int.TryParse(context.TrustedCurrentUser?["Level"]?.ToString(), out var level);
            if (string.IsNullOrWhiteSpace(context.TrustedCurrentUser?["Id"]?.ToString()) || level < 9999)
                return new DosResult(0, null, "只有主租户 Level >= 9999 的超级管理员可以执行该操作。");
            return new DosResult(1);
        }

        private static string RuntimeMainOsClient()
        {
            var configured = OsClientExtend.GetConfigOsClient();
            return string.IsNullOrWhiteSpace(configured)
                ? OsClientDefault.OsClient ?? string.Empty
                : configured.Trim();
        }

        private static JToken ReadToken(JObject row, string name)
            => row?.GetValue(name, StringComparison.OrdinalIgnoreCase);

        private static string ReadText(JObject row, string name)
            => ReadToken(row, name)?.ToString() ?? string.Empty;

        private static bool IsTrue(JToken value)
            => value != null
               && (value.ToString() == "1"
                   || string.Equals(value.ToString(), "true", StringComparison.OrdinalIgnoreCase));
    }

    internal sealed class ChildTenantTarget
    {
        public string OsClient { get; set; }
        public string Name { get; set; }
    }
}
