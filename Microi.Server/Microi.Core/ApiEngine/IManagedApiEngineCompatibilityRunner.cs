using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 宿主旧路由调用官方 Managed 接口引擎的可信兼容入口。
    /// 特意不属于 V8 可见的 <see cref="IApiEngine"/>，防止租户脚本注入
    /// trustedCurrentUser 或绕过 StopHttp。仅友元后端程序集可以解析并调用。
    /// </summary>
    internal interface IManagedApiEngineCompatibilityRunner
    {
        Task<dynamic> RunManagedCompatibilityAsync(
            string apiEngineKey,
            dynamic dynamicParam,
            JObject trustedCurrentUser,
            DbTrans trans = null);
    }
}
