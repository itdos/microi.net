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
        public const string SaasEngineApplicationId = "app.microi.saas-engine";
        public const string ClusterConcurrencyKey = "__microi_child_platform_app_install_cluster__";
        public const int ChildWorkerMaxAttempts = 8;
        internal static readonly string[] RequiredBootstrapApiEngineKeys =
        {
            "import-microi-store-package",
            ChildWorkerApiEngineKey
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

                // 平台应用维护本身依赖生成实体物理列和两个商城工作接口。老空库
                // 可能恰好缺少这些资源，不能要求它先成功安装商城来获得安装器。
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
                    // CHILD_TENANT_STARTUP_DEPENDENCY_SCOPE_V1：事故恢复只安装
                    // platform-sys-config 的唯一官方归属包。商城工作器本身已经由
                    // 上面的可信 C# 自举原子直接刷新，无需再串行安装其完整应用包。
                    childParam["RequiredAppIds"] = new JArray(SaasEngineApplicationId);
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
                var targetColumns = GetPhysicalColumns(targetClient, "sys_apiengine");
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
            var ownerColumns = GetPhysicalColumns(ownerClient, "sys_apiengine");
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

            var ownerColumns = GetPhysicalColumns(ownerClient, "sys_apiengine");
            var targetColumns = GetPhysicalColumns(targetClient, "sys_apiengine");
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
                    ReviveTargetApiEngine(targetClient, targetColumns, targetOsClient, apiEngineKey);
                }
                var latest = ReadApiEngineRow(targetClient, targetColumns, targetOsClient, apiEngineKey);
                if (latest == null)
                    return new DosResult(0, null, $"商城自举接口 {apiEngineKey} 刷新后回读失败。");
                ClearApiEngineCache(targetOsClient, latest, apiEngineKey);
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
            ClearApiEngineCache(targetOsClient, inserted, apiEngineKey);
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
            return false;
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

        private static void ReviveTargetApiEngine(
            OsClientSecret client,
            HashSet<string> columns,
            string osClient,
            string apiEngineKey)
        {
            var assignments = new List<string>();
            var quote = IdentifierQuote(client);
            if (columns.Contains("IsDeleted")) assignments.Add($"{quote("IsDeleted")}=0");
            if (columns.Contains("IsEnable")) assignments.Add($"{quote("IsEnable")}=1");
            if (columns.Contains("StopHttp")) assignments.Add($"{quote("StopHttp")}=0");
            if (columns.Contains("UpdateTime")) assignments.Add($"{quote("UpdateTime")}=@p2");
            if (assignments.Count == 0) return;
            var sql = $"UPDATE {quote("sys_apiengine")} SET {string.Join(",", assignments)} "
                      + $"WHERE {quote("ApiEngineKey")}=@p0";
            if (columns.Contains("OsClient")) sql += $" AND {quote("OsClient")}=@p1";
            var command = client.Db.FromSql(sql).AddInParameter("p0", apiEngineKey);
            if (columns.Contains("OsClient")) command.AddInParameter("p1", osClient);
            if (columns.Contains("UpdateTime"))
                command.AddInParameter("p2", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            command.ExecuteNonQuery();
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

        private static void ClearApiEngineCache(string osClient, JObject row, string apiEngineKey)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var keys = new[]
            {
                apiEngineKey,
                row?.GetValue("Id", StringComparison.OrdinalIgnoreCase)?.ToString(),
                row?.GetValue("ApiAddress", StringComparison.OrdinalIgnoreCase)?.ToString()
            };
            foreach (var key in keys.Where(value => !string.IsNullOrWhiteSpace(value)))
            {
                cache.RemoveAsync(
                        $"Microi:{osClient}:FormData:sys_apiengine:{key.ToLowerInvariant()}")
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
