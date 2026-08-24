using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 搜索引擎插件的受限管理原子边界。接口引擎负责动作、分页和业务编排，
    /// 插件只负责 Elasticsearch 协议与索引运行时。
    /// </summary>
    public interface IMicroiSearchManagementRuntime
    {
        Task<DosResult> ExecuteAsync(string osClient, string action, JObject request);
    }
}
