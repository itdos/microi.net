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
            tenantNames.RemoveAll(item => string.Equals(
                item, configuredTenant, StringComparison.OrdinalIgnoreCase));
            tenantNames.Insert(0, configuredTenant);

            foreach (var tenantName in tenantNames)
            {
                if (stoppingToken.IsCancellationRequested) break;
                var result = await _upgrade
                    .UpgradeTenantAsync(tenantName, null, stoppingToken)
                    .ConfigureAwait(false);
                if (result.Code != 1)
                {
                    Console.WriteLine(
                        $"Microi：【Error异常】【{tenantName}】平台自动升级失败：{result.Msg}");
                }
            }
        }
    }
}
