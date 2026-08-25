using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Redis/L1-L2 缓存管理的宿主原子边界。
    /// 业务动作白名单、租户与管理员鉴权由官方接口引擎和 V8.Method 负责；
    /// 插件实现只执行受限操作，不接受任意 Redis 命令字符串。
    /// </summary>
    public interface IMicroiCacheManagementRuntime
    {
        Task<object> ExecuteAsync(string tenantOsClient, string action, JObject request);
    }
}
