using System;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using System.Linq;

namespace Microi.net
{
    /// <summary>
    /// API 接收流量前只门禁当前部署的主租户。SaaS 子租户由
    /// <see cref="MicroiUpgradeHostedService"/> 在宿主启动后逐一修复和强回读，
    /// 避免几十个历史租户把整个 API 的监听时间串行拖长数十分钟。
    /// </summary>
    public sealed class MicroiStartupGate
    {
        private readonly IMicroiUpgrade _upgrade;

        public MicroiStartupGate(IMicroiUpgrade upgrade)
        {
            _upgrade = upgrade ?? throw new ArgumentNullException(nameof(upgrade));
        }

        /// <summary>
        /// 完成 API 接收流量前的主租户单一就绪闭包：挂载权威 SaaS 配置、
        /// 收敛并回读 JWT 签名密钥、验证密钥发布状态，再执行升级物理门禁。
        /// 宿主无需理解这些租户与升级细节，只消费最终就绪的租户模型。
        /// </summary>
        public async Task<DosResult<OsClientSecret>> EnsureConfiguredMainTenantReadyAsync(
            CancellationToken cancellationToken = default)
        {
            var tenantName = OsClient.GetConfigOsClient();
            if (tenantName.DosIsNullOrWhiteSpace()) tenantName = OsClientDefault.OsClient;
            if (tenantName.DosIsNullOrWhiteSpace())
                return new DosResult<OsClientSecret>(0, null, "未配置主租户 OsClient。");

            if (!OsClient.EnsureHydrated(tenantName))
            {
                Console.WriteLine(
                    $"Microi：【失败】主租户[{tenantName}]的 OsClientModel 未能从 sys_osclients 完整挂载，无法通过启动门禁。");
                return new DosResult<OsClientSecret>(
                    0,
                    null,
                    $"主租户[{tenantName}]的 SaaS 配置未能从 sys_osclients 完整挂载。");
            }

            var clientModel = OsClient.GetClient(tenantName);
            var convergence = TenantJwtSigningKeyCoordinator.Converge(
                clientModel.Db,
                clientModel.OsClientModel["DbType"]?.Val<string>() ?? OsClientDefault.OsClientDbType);
            if (!convergence.Success)
                return new DosResult<OsClientSecret>(0, null, convergence.Message);

            if (convergence.UpdatedOsClients.Any(value =>
                    string.Equals(value, tenantName, StringComparison.OrdinalIgnoreCase)))
            {
                var reload = new OsClient().ReloadSingleOsClient(tenantName);
                if (reload.Code != 1)
                {
                    return new DosResult<OsClientSecret>(
                        0,
                        null,
                        $"租户[{tenantName}]签名密钥收敛后重载失败：{reload.Msg}");
                }
                clientModel = OsClient.GetClient(tenantName);
            }

            var signingKeyStatus = DiyToken.GetJwtSigningKeyStatus(clientModel);
            if (!signingKeyStatus.Ready)
                return new DosResult<OsClientSecret>(0, null, signingKeyStatus.Message);

            Console.WriteLine(
                $"Microi：【成功】【安全】JWT签名密钥发布门禁通过：Source={signingKeyStatus.Source}，Fingerprint={signingKeyStatus.Fingerprint}");
            var gateResult = await EnsureMainTenantReadyAsync(clientModel, cancellationToken)
                .ConfigureAwait(false);
            return gateResult.Code == 1
                ? new DosResult<OsClientSecret>(1, clientModel, gateResult.Msg)
                : new DosResult<OsClientSecret>(gateResult.Code, null, gateResult.Msg);
        }

        public async Task<DosResult> EnsureMainTenantReadyAsync(
            OsClientSecret mainTenant,
            CancellationToken cancellationToken = default)
        {
            if (mainTenant == null || mainTenant.Db == null)
                return new DosResult(0, null, "主租户数据库会话尚未初始化。");

            var tenantName = mainTenant.OsClient;
            Console.WriteLine($"Microi：【自动升级状态】【{tenantName}】【启动前物理字段】开始检查。");
            var physical = await _upgrade
                .EnsureRuntimePhysicalPrerequisitesAsync(mainTenant, cancellationToken)
                .ConfigureAwait(false);
            if (physical.Code != 1)
            {
                Console.WriteLine($"Microi：【自动升级状态】【{tenantName}】【启动前物理字段】失败：{physical.Msg}");
                return physical;
            }
            Console.WriteLine($"Microi：【自动升级状态】【{tenantName}】【启动前物理字段】成功：{physical.Msg}");

            Console.WriteLine($"Microi：【自动升级状态】【{tenantName}】【平台运行时接口闭包】开始检查。");
            var dependencies = await _upgrade
                .EnsureStartupDependenciesAsync(mainTenant, cancellationToken)
                .ConfigureAwait(false);
            if (dependencies.Code != 1)
            {
                Console.WriteLine($"Microi：【自动升级状态】【{tenantName}】【平台运行时接口闭包】失败：{dependencies.Msg}");
                return dependencies;
            }
            Console.WriteLine($"Microi：【自动升级状态】【{tenantName}】【平台运行时接口闭包】成功：{dependencies.Msg}");
            Console.WriteLine($"Microi：【自动升级状态】【启动前门禁汇总】完成：租户数=1，成功=1，失败=0，主租户={tenantName}，子租户转后台维护。");
            return new DosResult(1, dependencies.Data, "主租户启动门禁已通过；子租户将在宿主启动后逐一维护。");
        }
    }
}
