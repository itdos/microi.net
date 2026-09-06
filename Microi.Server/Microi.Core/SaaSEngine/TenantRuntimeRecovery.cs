using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 缓存不是租户目录：丢失运行快照时，从当前节点三参数对应的已提交配置恢复。
    /// 固定数量的锁只合并本机加载，不承担分布式业务幂等，也不缓存不存在的租户。
    /// </summary>
    internal static class TenantRuntimeRecovery
    {
        private static readonly object[] Gates = Enumerable.Range(0, 64).Select(_ => new object()).ToArray();
        [ThreadStatic] private static HashSet<string> _loading;

        internal static OsClientSecret Resolve(
            string identity,
            Func<OsClientSecret> readLoaded,
            Func<DosResult> reload)
        {
            if (_loading?.Contains(identity) == true) return null;
            var gate = Gates[(StringComparer.OrdinalIgnoreCase.GetHashCode(identity) & int.MaxValue) % Gates.Length];
            lock (gate)
            {
                var loaded = readLoaded();
                if (loaded != null) return loaded;
                _loading ??= new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                _loading.Add(identity);
                try
                {
                    var result = reload();
                    return result?.Code == 1 ? readLoaded() : null;
                }
                finally
                {
                    _loading.Remove(identity);
                }
            }
        }
    }
}
