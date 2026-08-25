using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// AI 平台账户的插件级受信原子边界。套餐、订阅、订单等普通业务编排由
    /// 官方 Managed 接口引擎负责；本接口只承载供应商密钥、额度原子扣减、
    /// 平台凭据、异步任务句柄和受控媒体落盘等 V8 不应直接接触的能力。
    /// </summary>
    public interface IAiPlatformRuntime
    {
        Task<DosResult> ExecuteAsync(
            string osClient,
            string action,
            JObject request,
            JObject currentUser);
    }
}
