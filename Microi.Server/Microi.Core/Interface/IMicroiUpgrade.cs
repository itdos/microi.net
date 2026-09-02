using System;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public interface IMicroiUpgrade
    {
        /// <summary>
        /// Ensures expand-only physical columns required by generated runtime
        /// entities before License, login, or background upgrade code can query
        /// those entities. The implementation coordinates concurrent nodes with
        /// the shared upgrade lease.
        /// </summary>
        Task<DosResult> EnsureRuntimePhysicalPrerequisitesAsync(
            OsClientSecret osClientSecret,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Ensures the seven managed ApiEngine resources required by the login
        /// and WebOS bootstrap flow exist before the API starts accepting
        /// traffic. Executable V8 source is loaded only from the embedded
        /// official application packages.
        /// </summary>
        Task<DosResult> EnsureStartupDependenciesAsync(
            OsClientSecret osClientSecret,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// 对一个已经加载到 SaaS 运行时的租户执行完整、幂等的升级协调流程。
        /// 该流程与启动宿主使用同一分布式租约和 ServerVersion 门禁；backgroundTaskId
        /// 仅用于向持久后台任务回写真实进度、日志和结果。
        /// </summary>
        Task<DosResult> UpgradeTenantAsync(
            string osClient,
            string backgroundTaskId = null,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        Task<DosResultList<MicroiUpgradeResult>> Upgrade(string CurrentVersion, OsClientSecret osClientSecret);
    }
}
