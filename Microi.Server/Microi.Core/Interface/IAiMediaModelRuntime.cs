using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    /// <summary>媒体协议的公开能力投影；模型配置、供应商密钥与路由解析留在 AI 插件。</summary>
    public interface IAiMediaModelRuntime
    {
        Task<DosResult> GetModelsAsync(string osClient, string userId);
        DosResult GetRelayModels();
    }
}
