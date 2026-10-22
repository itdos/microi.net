using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    // 仅宿主实现的边界：不接受任意表、WHERE、V8.Param 身份，
    // 也不允许客户端选择可信调用标记。
    internal interface ISpiderCatalogReadRuntime
    {
        Task<DosResultList<dynamic>> ReadSpiderCatalogAsync(
            string action, int pageIndex, int pageSize, string osClient, JObject currentUser);
    }
}
