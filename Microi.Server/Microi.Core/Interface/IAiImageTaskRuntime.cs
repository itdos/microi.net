using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// AI 图片持久任务的原生执行器。Core 只交付已认领的租户/用户信封，
    /// 供应商路由、密钥和媒体处理仍由 Microi.AI 提供，不能由同名 V8 覆盖。
    /// </summary>
    public interface IAiImageTaskRuntime
    {
        Task<DosResult> QueueAuthenticatedAsync(string userId, string osClient,
            JObject trustedCurrentUser, MiniMaxImageGenerateParam request);
        Task<DosResult> QueueRelayAsync(string authorizationHeader, string idempotencyKey,
            MiniMaxImageGenerateParam request);
        Task<DosResult> GetRelayTaskAsync(string authorizationHeader, string taskId);
        Task<DosResult> RecoverRelayTaskAsync(string authorizationHeader, string taskId);
        Task<DosResult> RunAsync(string taskId, long fencingToken, string osClient,
            JObject trustedCurrentUser, JObject taskParam, CancellationToken cancellationToken);
    }
}
