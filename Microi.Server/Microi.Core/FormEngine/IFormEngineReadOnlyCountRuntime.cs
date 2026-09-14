using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 可信宿主的只读计数批次。身份独立传递并在批次内复制一次；每项仍经过
    /// 原表单查询的租户、表、角色和数据范围授权，不提供 HTTP/V8 身份覆盖参数。
    /// </summary>
    internal interface IFormEngineReadOnlyCountRuntime
    {
        Task<DosResultList<dynamic>> GetTableDataCountBatchForIdentityAsync(
            object queries, JObject currentUser, DbTrans transaction = null);
    }
}
