using System;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        public DosResult ExplainAuthorizationDecision(dynamic dynamicParam)
        {
            var denied = RequireCurrentTenantSuperAdmin(out var osClient, out var currentUser);
            if (denied != null) return new DosResult(denied.Code, denied.Data, denied.Msg);
            try
            {
                JObject request = ToJObject(dynamicParam);
                string userId = GetJsonString(request, "UserId");
                if (userId.DosIsNullOrWhiteSpace()) userId = currentUser?["Id"].Val<string>();
                string tableKey = GetJsonString(request, "TableKey", "FormEngineKey", "TableName", "TableId");
                string operation = GetJsonString(request, "Operation");
                if (operation.DosIsNullOrWhiteSpace()) operation = "List";
                if (userId.DosIsNullOrWhiteSpace() || tableKey.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "UserId 和 TableKey 不能为空。");

                var client = OsClientExtend.GetClient(osClient);
                var user = client?.Db?.From<SysUser>()
                    .Where(row => row.Id == userId && row.IsDeleted != 1)
                    .First();
                if (user == null) return new DosResult(2, null, "目标用户不存在。");
                var formEngine = MicroiEngine.FormEngine as IFormEngineAuthorizationExplainRuntime;
                if (formEngine == null) return new DosResult(0, null, "FormEngine 授权服务不可用。");
                string rowId = GetJsonString(request, "RowId", "Id");
                var param = new DiyTableRowParam
                {
                    OsClient = osClient,
                    _InvokeType = InvokeType.Client.ToString(),
                    _CurrentUser = JObject.FromObject(user),
                    FormEngineKey = tableKey,
                    _SysMenuId = GetJsonString(request, "MenuId", "_SysMenuId"),
                    ModuleEngineKey = GetJsonString(request, "ModuleEngineKey"),
                    Id = rowId,
                    _TableRowId = rowId,
                    _PageIndex = 1,
                    _PageSize = 1
                };
                return formEngine.ExplainClientTableAuthorizationAsync(param, operation)
                    .ConfigureAwait(false).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "解释授权决策失败：" + ex.Message);
            }
        }
    }
}
