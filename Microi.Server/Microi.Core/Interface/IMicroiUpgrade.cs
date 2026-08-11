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
        /// 
        /// </summary>
        /// <returns></returns>
        Task<DosResultList<MicroiUpgradeResult>> Upgrade(string CurrentVersion, OsClientSecret osClientSecret);
    }
}
