using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.Extensions.Hosting;

namespace Microi.net
{
    /// <summary>
    /// Runs schema upgrades under the generic host lifecycle. Every node starts
    /// this service; the shared Redis lease elects exactly one migrator per tenant.
    /// </summary>
    internal sealed class MicroiUpgradeHostedService : BackgroundService
    {
        private readonly IMicroiUpgrade _upgrade;

        public MicroiUpgradeHostedService(IMicroiUpgrade upgrade)
        {
            _upgrade = upgrade;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (ConfigHelper.GetRuntimeConfigurationBool(
                    "MicroiUpgrade:Disabled",
                    false))
            {
                Console.WriteLine("Microi：【信息】服务器端自动升级已通过 SaaS 引擎后端运行配置禁用。");
                return;
            }

            Console.WriteLine("Microi：【信息】服务器端自动升级宿主服务已启动。");
            var tenantNames = OsClient.ClientList.Values
                .Where(item => item != null && !item.OsClient.DosIsNullOrWhiteSpace())
                .Select(item => item.OsClient)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var configuredTenant = OsClient.GetConfigOsClient();
            if (configuredTenant.DosIsNullOrWhiteSpace()) configuredTenant = OsClientDefault.OsClient;
            tenantNames.RemoveAll(item => string.Equals(item, configuredTenant, StringComparison.OrdinalIgnoreCase));
            tenantNames.Insert(0, configuredTenant);

            foreach (var tenantName in tenantNames)
            {
                if (stoppingToken.IsCancellationRequested) break;
                await UpgradeTenantAsync(tenantName, stoppingToken).ConfigureAwait(false);
            }
        }

        private async Task UpgradeTenantAsync(string tenantName, CancellationToken stoppingToken)
        {
            OsClientSecret runtimeClient;
            try
            {
                runtimeClient = OsClient.GetClient(tenantName);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】【{tenantName}】平台自动升级解析租户数据库配置失败：{ex.Message}");
                return;
            }

            // The bootstrap database connection is one of the ten API startup
            // settings and deliberately does not have to be persisted back into
            // sys_osclients.  A hydrated runtime tenant can therefore have an
            // empty OsClientModel.DbConn while its DbSession is fully usable.
            // Gate on the resolved session itself so first boot from an old
            // database can still run the expand-only SaaS schema upgrades.
            if (runtimeClient.Db == null)
            {
                Console.WriteLine($"Microi：【⚠️警告】平台自动升级跳过租户【{runtimeClient.OsClient}】：运行时数据库会话尚未初始化。");
                return;
            }

            try
            {
                var prerequisiteResult = await _upgrade
                    .EnsureRuntimePhysicalPrerequisitesAsync(runtimeClient, stoppingToken)
                    .ConfigureAwait(false);
                if (prerequisiteResult.Code != 1)
                {
                    throw new InvalidOperationException(prerequisiteResult.Msg);
                }

                UpgradeDistributedLease upgradeLease = null;
                string leaseReason = null;
                const int maxLeaseAttempts = 30;
                for (var attempt = 1; attempt <= maxLeaseAttempts && !stoppingToken.IsCancellationRequested; attempt++)
                {
                    upgradeLease = UpgradeDistributedLease.TryAcquire(runtimeClient.OsClient, out leaseReason);
                    if (upgradeLease != null) break;
                    if (attempt < maxLeaseAttempts)
                    {
                        if (attempt == 1 || attempt % 6 == 0)
                        {
                            Console.WriteLine($"Microi：【信息】平台自动升级等待租户【{runtimeClient.OsClient}】分布式租约，第{attempt}次：{leaseReason}");
                        }
                        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken).ConfigureAwait(false);
                    }
                }

                if (upgradeLease == null)
                {
                    Console.WriteLine($"Microi：【信息】平台自动升级在有界重试后跳过本节点租户【{runtimeClient.OsClient}】：{leaseReason}");
                    return;
                }

                using (upgradeLease)
                using (UpgradeExecutionLeaseContext.Enter(upgradeLease))
                {
                    upgradeLease.ThrowIfLost();
                    Console.WriteLine(
                        $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【平台运行时接口闭包】后台复检开始。");
                    var startupDependencyResult = await UpgradeAppStore
                        .EnsureStartupDependenciesUnderLeaseAsync(runtimeClient)
                        .ConfigureAwait(false);
                    if (startupDependencyResult.Code != 1)
                    {
                        Console.WriteLine(
                            $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【平台运行时接口闭包】后台复检失败：{startupDependencyResult.Msg}");
                        throw new InvalidOperationException(startupDependencyResult.Msg);
                    }
                    Console.WriteLine(
                        $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【平台运行时接口闭包】后台复检成功：{startupDependencyResult.Msg}");

                    // The durable task worker is a runtime prerequisite, so its
                    // idempotent expand-only schema cannot be blocked by an older,
                    // unrelated migration in the tenant's historical chain.
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade21-持久后台任务", () => new Upgrade21().Run(runtimeClient.OsClient));
                    // 用户个人首页、商城安装计数事件与批量任务明细都是当前
                    // 运行时直接依赖的扩展型结构。历史租户可能因更早的无关迁移
                    // 失败而停在旧 ServerVersion，因此像后台任务基础表一样在共享
                    // 升级租约内独立、幂等地维持这一不变量。
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade23-SaaS运行时结构", () => new Upgrade23().Run(runtimeClient.OsClient));
                    // 当前流式应用发布接口会直接读取 V3 发布闸门与协议字段。历史租户
                    // 可能因更早的无关迁移失败或版本号漂移而跳过 Upgrade25，因此把
                    // 这组扩展型物理结构作为运行时前置条件，在同一分布式租约内幂等维护。
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade25-应用发布租户门禁",
                        () => new Upgrade25().EnsureTenantGateInvariant(runtimeClient.OsClient));
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade25-应用发布V3结构",
                        () => new Upgrade25().EnsureApplicationStreamV3SchemaInvariant(runtimeClient.OsClient));
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade26-访问密钥菜单", () => new Upgrade26().Run(runtimeClient.OsClient));
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade28-用户首页与商城事件", () => new Upgrade28().Run(runtimeClient.OsClient));
                    // SaaS 运行配置属于当前 API 的控制面。即使历史 ServerVersion 被错误
                    // 推进，也要在共享升级租约内幂等补齐 OCR 与后端运行配置元数据。
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade29-OCR租户配置", () => new Upgrade29().Run(runtimeClient.OsClient));
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade30-后端运行配置", () => new Upgrade30().Run(runtimeClient.OsClient));
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade31-翻译引擎配置", () => new Upgrade31().Run(runtimeClient.OsClient));
                    // 表单事件运行时已经直接读取 diy_table.V8Limit。不能仅依赖
                    // 可能漂移的 ServerVersion：在共享升级租约内幂等补齐元数据，
                    // 并只初始化 V8Limit IS NULL 的旧行，保留用户之后的显式值。
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade33-表单V8限额",
                        () => new Upgrade33().Run(runtimeClient.OsClient, resetExistingValues: false));
                    // 新接口引擎运行时直接读取 DataSourceType；历史数据源必须先在
                    // 同一共享租约内事务性复制并软删除，不能只依赖可能漂移的
                    // ServerVersion，也不能让滚动升级期间旧客户端失去 Id/Key 映射。
                    await RunRuntimeInvariantAsync(runtimeClient, upgradeLease,
                        "Upgrade34-数据源迁移接口引擎",
                        () => new Upgrade34().Run(runtimeClient.OsClient));
                    upgradeLease.ThrowIfLost();
                    var runtimeOrm = MicroiEngine.ORM(runtimeClient.Db.Db.DbProvider.DatabaseType);
                    var currentVersion = runtimeClient.Db
                        .FromSql($"SELECT {runtimeOrm.GetFieldName("ServerVersion")} " +
                                 $"FROM {runtimeOrm.GetTableName("sys_config")} " +
                                 $"WHERE {runtimeOrm.GetFieldName("IsEnable")} = @p0")
                        .AddInParameter("p0", 1)
                        .ToScalar<string>() ?? "";
                    Console.WriteLine(
                        $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【版本迁移链】开始：当前版本={currentVersion.DosIsNullOrWhiteSpace() switch { true => "空", false => currentVersion }}。");
                    var result = await _upgrade.Upgrade(currentVersion, runtimeClient).ConfigureAwait(false);
                    upgradeLease.ThrowIfLost();
                    if (result.Code != 1)
                    {
                        Console.WriteLine(
                            $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【版本迁移链】失败：{result.Msg}");
                        Console.WriteLine($"Microi：【Error异常】【{runtimeClient.OsClient}】平台自动升级失败：{result.Msg}");
                    }
                    else
                    {
                        Console.WriteLine(
                            $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【版本迁移链】成功。");
                        Console.WriteLine($"Microi：【成功】【{runtimeClient.OsClient}】平台自动升级检查完成。");
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】【{tenantName}】平台自动升级出现异常：{ex.Message}");
            }

            try
            {
                var reloadResult = await MicroiEngine.FormEngine
                    .ReloadDiyLangCacheAsync(runtimeClient.OsClient)
                    .ConfigureAwait(false);
                if (reloadResult.Code != 1)
                {
                    Console.WriteLine($"Microi：【Error异常】【{tenantName}】加载多语言运行时缓存失败：{reloadResult.Msg}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】【{tenantName}】加载多语言出现异常：{ex.Message}");
            }
        }

        private static async Task RunRuntimeInvariantAsync(
            OsClientSecret runtimeClient,
            UpgradeDistributedLease upgradeLease,
            string step,
            Func<Task<List<string>>> action)
        {
            upgradeLease.ConfirmOwnership();
            Console.WriteLine(
                $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【{step}】开始。");
            try
            {
                var messages = await action().ConfigureAwait(false);
                upgradeLease.ConfirmOwnership();
                if (messages?.Count > 0)
                {
                    throw new InvalidOperationException(string.Join("；", messages));
                }
                Console.WriteLine(
                    $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【{step}】成功。");
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【{step}】失败：{ex.Message}");
                throw;
            }
        }
    }
}
