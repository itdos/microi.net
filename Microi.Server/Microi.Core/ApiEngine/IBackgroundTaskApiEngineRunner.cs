using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 后台任务专用的接口引擎执行入口。
    /// 当前用户必须由服务端在任务提交阶段完成认证后传入，不能从客户端业务参数读取。
    /// </summary>
    public interface IBackgroundTaskApiEngineRunner
    {
        Task<dynamic> RunBackgroundAsync(dynamic dynamicParam, JObject trustedCurrentUser, DbTrans _trans = null);
    }
}
