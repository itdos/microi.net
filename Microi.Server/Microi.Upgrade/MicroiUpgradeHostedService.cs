using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.Extensions.Hosting;

namespace Microi.net
{
    /// <summary>
    /// 启动时枚举当前已加载租户；单租户的升级语义统一由 IMicroiUpgrade 协调器负责，
    /// 供启动流程、新租户开通和管理员手动补跑共同复用。
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
            if (ConfigHelper.GetRuntimeConfigurationBool("MicroiUpgrade:Disabled", false))
            {
                UpgradeProgress.WriteLine("Microi：【信息】服务器端自动升级已通过 SaaS 引擎后端运行配置禁用。");
                return;
            }

            UpgradeProgress.WriteLine("Microi：【信息】服务器端自动升级宿主服务已启动。");
            var tenantNames = OsClient.ClientList.Values
                .Where(item => item != null && !item.OsClient.DosIsNullOrWhiteSpace())
                .Select(item => item.OsClient)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var configuredTenant = OsClient.GetConfigOsClient();
            if (configuredTenant.DosIsNullOrWhiteSpace()) configuredTenant = OsClientDefault.OsClient;
            tenantNames.RemoveAll(item => string.Equals(
                item, configuredTenant, StringComparison.OrdinalIgnoreCase));
            tenantNames.Insert(0, configuredTenant);

            var batch = new UpgradeProgress.Batch();
            var processed = 0;
            for (var index = 0; index < tenantNames.Count; index++)
            {
                if (stoppingToken.IsCancellationRequested) break;
                var tenantName = tenantNames[index];
                using (UpgradeProgress.EnterTenant(tenantName, index + 1, tenantNames.Count, batch))
                {
                    var result = await _upgrade
                        .UpgradeTenantAsync(tenantName, null, stoppingToken)
                        .ConfigureAwait(false);
                    UpgradeProgress.WriteLine(result.Code == 1
                        ? "Microi：当前租户升级检查完成。"
                        : $"Microi：【Error异常】平台自动升级失败：{result.Msg}");
                    UpgradeProgress.FinishTenant(result.Code == 1);
                }
                processed++;
            }
            UpgradeProgress.WriteBatchSummary(batch, tenantNames.Count, processed, stoppingToken.IsCancellationRequested);
        }
    }
}
