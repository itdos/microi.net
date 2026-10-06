using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private sealed class TreeMutationMenu
        {
            public string Id { get; set; }
            public string DiyTableId { get; set; }
            public int? TreeDragSortEnabled { get; set; }
            public string TreeDragSortField { get; set; }
        }
        /// <summary>只为固定 Managed 树排序引擎提供当前租户、模块绑定和客户端写入授权；排序与跨级业务均由 V8 编排。</summary>
        public DosResult TreeMutationClientOperation(dynamic input)
        {
            var denied = ResolveTrustedManagedCurrentUser("mci-tree-drag-sort", true, 0, out var osClient, out var user);
            if (denied != null) return denied;
            try
            {
                var request = JsonHelper.ToJObject((object)input);
                var menuId = (string)request["MenuId"];
                if (string.IsNullOrWhiteSpace(menuId)) return new DosResult(0, null, "缺少模块上下文。");
                var client = OsClientExtend.GetClient(osClient);
                var menu = client.Db.FromSql("SELECT Id, DiyTableId, TreeDragSortEnabled, TreeDragSortField FROM sys_menu WHERE Id=@m AND (IsDeleted=0 OR IsDeleted IS NULL)").AddInParameter("@m", menuId).First<TreeMutationMenu>();
                if (menu == null || menu.TreeDragSortEnabled != 1) return new DosResult(0, null, "当前模块未开启拖动排序。");
                var tableResult = MicroiEngine.FormEngine.GetDiyTable(menu.DiyTableId, osClient).GetAwaiter().GetResult();
                if (tableResult.Code != 1 || tableResult.Data == null) return new DosResult(0, null, "模块绑定表不存在。");
                var table = JObject.FromObject((object)tableResult.Data);
                if (table["IsTree"]?.Value<bool>() != true) return new DosResult(0, null, "当前表未开启树形结构。");
                var fieldResult = MicroiEngine.FormEngine.GetDiyField(new DiyFieldParam { OsClient = osClient, TableId = (string)table["Id"], IsDeleted = 0, _OnlyRealField = true }).GetAwaiter().GetResult();
                if (fieldResult.Code != 1) return new DosResult(0, null, "读取树字段失败。");
                var fields = fieldResult.Data.ToDictionary(x => (string)x["Name"], StringComparer.OrdinalIgnoreCase);
                var sort = menu.TreeDragSortField;
                var parent = (string)table["TreeParentField"];
                if (string.IsNullOrWhiteSpace(parent)) parent = "ParentId";
                var ancestors = (string)table["TreeParentFields"];
                if (string.IsNullOrWhiteSpace(ancestors)) ancestors = "ParentIds";
                if (!fields.ContainsKey(ancestors)) ancestors = "";
                var hasChildren = (string)table["TreeHasChildren"];
                if (string.IsNullOrWhiteSpace(hasChildren) || !fields.ContainsKey(hasChildren)) hasChildren = "";
                if (string.IsNullOrWhiteSpace(sort) || !fields.TryGetValue(sort, out var sortField) || !Regex.IsMatch((string)sortField["Type"] ?? "", @"^(int|bigint|decimal\()", RegexOptions.IgnoreCase)
                    || !fields.ContainsKey(parent) || sort.Equals(parent, StringComparison.OrdinalIgnoreCase) || sort.Equals("Id", StringComparison.OrdinalIgnoreCase)) return new DosResult(0, null, "请选择当前树表的有效数值排序字段。");
                var tableName = (string)table["Name"];
                var safeNames = new[] { tableName, sort, parent, ancestors, hasChildren }.Where(x => !string.IsNullOrEmpty(x));
                if (safeNames.Any(x => !Regex.IsMatch(x, @"^[A-Za-z][A-Za-z0-9_]{0,79}$"))) return new DosResult(0, null, "树表字段标识无效。");
                var auth = MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(new DiyTableRowParam { OsClient = osClient, _CurrentUser = user, _InvokeType = "Client", _SysMenuId = menuId, FormEngineKey = tableName }, "List").GetAwaiter().GetResult();
                if (auth.Code != 1) return auth;
                if ((string)request["Action"] == "Context") return new DosResult(1, new { TableName = tableName, SortField = sort, ParentField = parent, AncestorField = ancestors, HasChildrenField = hasChildren, DbType = (string)client.OsClientModel["DbType"] });
                if ((string)request["Action"] != "WriteRows" || !(request["Rows"] is JArray rows) || rows.Count > 20000 || rows.Count == 0) return new DosResult(0, null, "不支持的树写入请求。");
                var transaction = V8TenantContext.CurrentDbTrans;
                if (transaction == null) return new DosResult(0, null, "树排序缺少共享事务。");
                foreach (var id in (request["PlacementIds"] as JArray ?? new JArray()).Values<string>().Where(x => !string.IsNullOrWhiteSpace(x)).Distinct())
                {
                    var placement = MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(new DiyTableRowParam { OsClient = osClient, _CurrentUser = user, _InvokeType = "Client", _SysMenuId = menuId, FormEngineKey = tableName, Id = id }, "Read").GetAwaiter().GetResult();
                    if (placement.Code != 1) return placement;
                }
                var allowed = new HashSet<string>(new[] { "Id", sort, parent, ancestors, hasChildren }.Where(x => !string.IsNullOrEmpty(x)), StringComparer.OrdinalIgnoreCase);
                if (rows.OfType<JObject>().Count() != rows.Count || rows.OfType<JObject>().Any(x => x.Properties().Any(y => !allowed.Contains(y.Name)) || string.IsNullOrWhiteSpace((string)x["Id"]))) return new DosResult(0, null, "树写入字段不合法。");
                foreach (JObject row in rows)
                {
                    var result = MicroiEngine.FormEngine.UptFormData(new DiyTableRowParam { OsClient = osClient, _CurrentUser = user, _InvokeType = "Client", _SysMenuId = menuId, FormEngineKey = tableName, Id = (string)row["Id"], _RowModel = row }, transaction);
                    if (result.Code != 1) return result;
                }
                return new DosResult(1, new { UpdatedRows = rows.Count });
            }
            catch (Exception error) { return new DosResult(0, null, "树排序授权失败：" + error.Message); }
        }
    }
}
