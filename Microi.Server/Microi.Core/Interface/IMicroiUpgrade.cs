using System;
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
        /// 
        /// </summary>
        /// <returns></returns>
        Task<DosResultList<MicroiUpgradeResult>> Upgrade(string CurrentVersion, OsClientSecret osClientSecret);
    }
}