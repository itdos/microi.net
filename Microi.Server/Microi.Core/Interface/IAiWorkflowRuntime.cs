using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// AI 工作流图谱的插件级原子运行时。HTTP/动作编排由接口引擎负责，
    /// Core 只定义插件边界，避免 Microi.net 反向引用 Microi.AI。
    /// </summary>
    public interface IAiWorkflowRuntime
    {
        Task<DosResult> ExecuteAsync(
            string osClient,
            string action,
            JObject request,
            JObject currentUser);
    }
}
