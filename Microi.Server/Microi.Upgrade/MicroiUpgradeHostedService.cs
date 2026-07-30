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
            var disabledText = ConfigHelper.GetEnvOrConfiguration(
                "MICROI_DISABLE_AUTO_UPGRADE",
                "MicroiUpgrade:Disabled");
            if (bool.TryParse(disabledText, out var disabled) && disabled)
            {
                Console.WriteLine("Microi：【信息】服务器端自动升级已通过配置禁用。");
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

            var dbConn = runtimeClient.OsClientModel?["DbConn"]?.ToString();
            if (string.IsNullOrWhiteSpace(dbConn))
            {
                Console.WriteLine($"Microi：【⚠️警告】平台自动升级跳过租户【{runtimeClient.OsClient}】：数据库连接（DbConn）未配置。");
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
