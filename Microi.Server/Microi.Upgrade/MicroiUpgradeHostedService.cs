using System;
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
            if (!tenantNames.Contains(configuredTenant, StringComparer.OrdinalIgnoreCase))
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
                    // The durable task worker is a runtime prerequisite, so its
                    // idempotent expand-only schema cannot be blocked by an older,
                    // unrelated migration in the tenant's historical chain.
                    var backgroundTaskMessages = await new Upgrade21()
                        .Run(runtimeClient.OsClient)
                        .ConfigureAwait(false);
                    if (backgroundTaskMessages.Count > 0)
                    {
                        throw new InvalidOperationException(string.Join("；", backgroundTaskMessages));
                    }
                    // 用户个人首页、商城安装计数事件与批量任务明细都是当前
                    // 运行时直接依赖的扩展型结构。历史租户可能因更早的无关迁移
                    // 失败而停在旧 ServerVersion，因此像后台任务基础表一样在共享
                    // 升级租约内独立、幂等地维持这一不变量。
                    upgradeLease.ThrowIfLost();
                    var saasRuntimeMessages = await new Upgrade23()
                        .Run(runtimeClient.OsClient)
                        .ConfigureAwait(false);
                    if (saasRuntimeMessages.Count > 0)
                    {
                        throw new InvalidOperationException(string.Join("；", saasRuntimeMessages));
                    }
                    upgradeLease.ThrowIfLost();
                    var userAccessKeyMenuMessages = await new Upgrade26()
                        .Run(runtimeClient.OsClient)
                        .ConfigureAwait(false);
                    if (userAccessKeyMenuMessages.Count > 0)
                    {
                        throw new InvalidOperationException(string.Join("；", userAccessKeyMenuMessages));
                    }
                    upgradeLease.ThrowIfLost();
                    var userAndMarketplaceMessages = await new Upgrade28()
                        .Run(runtimeClient.OsClient)
                        .ConfigureAwait(false);
                    if (userAndMarketplaceMessages.Count > 0)
                    {
                        throw new InvalidOperationException(string.Join("；", userAndMarketplaceMessages));
                    }
                    // SaaS 运行配置属于当前 API 的控制面。即使历史 ServerVersion 被错误
                    // 推进，也要在共享升级租约内幂等补齐 OCR 与后端运行配置元数据。
                    upgradeLease.ThrowIfLost();
                    var ocrConfigurationMessages = await new Upgrade29()
                        .Run(runtimeClient.OsClient)
                        .ConfigureAwait(false);
                    if (ocrConfigurationMessages.Count > 0)
                    {
                        throw new InvalidOperationException(string.Join("；", ocrConfigurationMessages));
                    }
                    upgradeLease.ThrowIfLost();
                    var backendConfigurationMessages = await new Upgrade30()
                        .Run(runtimeClient.OsClient)
                        .ConfigureAwait(false);
                    if (backendConfigurationMessages.Count > 0)
                    {
                        throw new InvalidOperationException(string.Join("；", backendConfigurationMessages));
                    }
                    upgradeLease.ThrowIfLost();
                    var translateConfigurationMessages = await new Upgrade31()
                        .Run(runtimeClient.OsClient)
                        .ConfigureAwait(false);
                    if (translateConfigurationMessages.Count > 0)
                    {
                        throw new InvalidOperationException(string.Join("；", translateConfigurationMessages));
                    }
                    upgradeLease.ThrowIfLost();
                    var currentVersion = runtimeClient.Db
                        .FromSql("SELECT ServerVersion FROM sys_config WHERE IsEnable = @p0")
                        .AddInParameter("p0", 1)
                        .ToScalar<string>() ?? "";
                    var result = await _upgrade.Upgrade(currentVersion, runtimeClient).ConfigureAwait(false);
                    upgradeLease.ThrowIfLost();
                    if (result.Code != 1)
                    {
                        Console.WriteLine($"Microi：【Error异常】【{runtimeClient.OsClient}】平台自动升级失败：{result.Msg}");
                    }
                    else
                    {
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
    }
}
