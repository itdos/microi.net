using System;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 工作流角标缓存的租户级版本门。写操作只更新一个短字符串，读缓存把版本
    /// 放进用户级 Key；这样无需扫描/删除未知用户 Key，也不会让工作流变更后
    /// 长时间返回旧统计。
    /// </summary>
    public static class WorkflowStatsCache
    {
        public static string VersionKey(string osClient) =>
            $"Microi:{(osClient ?? string.Empty).Trim()}:WorkflowStats:Version";

        public static async Task InvalidateTenantAsync(string osClient)
        {
            if (string.IsNullOrWhiteSpace(osClient)) return;
            try
            {
                await MicroiEngine.CacheTenant.Cache(osClient)
                    .SetAsync(
                        VersionKey(osClient),
                        Guid.NewGuid().ToString("N"),
                        TimeSpan.FromDays(7))
                    .ConfigureAwait(false);
            }
            catch
            {
                // 缓存失效失败不能回滚已经成功的工作流事务；用户缓存仍有硬 TTL。
            }
        }
    }
}
