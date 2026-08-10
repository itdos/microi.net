using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        private static string RelationValue(JObject source, params string[] names)
        {
            if (source == null) return "";
            foreach (var name in names)
            {
                var token = source[name];
                if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined) continue;
                var value = token.ToString().Trim();
                if (!value.DosIsNullOrWhiteSpace()) return value;
            }
            return "";
        }

        private static int RelationInt(JObject source, string name)
        {
            return int.TryParse(RelationValue(source, name), out var value) ? value : 0;
        }

        private static JObject ParseRelationConfig(string config)
        {
            if (config.DosIsNullOrWhiteSpace()) return null;
            try
            {
                var token = JToken.Parse(config);
                return token as JObject;
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Pure relation validation used by both the live MCP guard and unit tests.
        /// The target/menu snapshots must come from the current OsClient.
        /// </summary>
        public static List<string> ValidateMcpFieldRelationSnapshotForTest(
            string currentTableId,
            string currentTableName,
            string fieldName,
            string component,
            string config,
            JObject targetTable,
            JArray currentFields,
            JArray targetFields,
            JObject childModule)
        {
            var errors = new List<string>();
            var isJoinForm = string.Equals(component, "JoinForm", StringComparison.OrdinalIgnoreCase);
            var isTableChild = string.Equals(component, "TableChild", StringComparison.OrdinalIgnoreCase);
            if (!isJoinForm && !isTableChild) return errors;

            var configObject = ParseRelationConfig(config);
            if (configObject == null)
            {
                errors.Add($"{component} Config 必须是非空 JSON 对象");
                return errors;
            }

            currentFields = currentFields ?? new JArray();
            targetFields = targetFields ?? new JArray();
            var currentFieldNames = new HashSet<string>(
                currentFields.OfType<JObject>().Select(item => RelationValue(item, "Name")),
                StringComparer.OrdinalIgnoreCase);
            var targetFieldNames = new HashSet<string>(
                targetFields.OfType<JObject>().Select(item => RelationValue(item, "Name")),
                StringComparer.OrdinalIgnoreCase);
            var resolvedTargetId = RelationValue(targetTable, "Id");
            var resolvedTargetName = RelationValue(targetTable, "Name");

            if (isJoinForm)
            {
                var joinForm = configObject["JoinForm"] as JObject;
                if (joinForm == null)
                {
                    errors.Add("JoinForm Config.JoinForm 必须是 JSON 对象");
                    return errors;
                }
                var targetId = RelationValue(joinForm, "TableId");
                var targetName = RelationValue(joinForm, "TableName");
                var joinFieldName = RelationValue(joinForm, "JoinFieldName");
                if (targetId.DosIsNullOrWhiteSpace() || targetName.DosIsNullOrWhiteSpace())
                    errors.Add("JoinForm 必须同时提供已解析的 TableId 和 TableName");
                if (targetTable == null || resolvedTargetId.DosIsNullOrWhiteSpace())
                    errors.Add("JoinForm 目标表不存在于当前租户");
                else
                {
                    if (!string.Equals(targetId, resolvedTargetId, StringComparison.OrdinalIgnoreCase)
                        || !string.Equals(targetName, resolvedTargetName, StringComparison.OrdinalIgnoreCase))
                        errors.Add("JoinForm TableId/TableName 与当前租户目标表不一致");
                    if (string.Equals(currentTableId, resolvedTargetId, StringComparison.OrdinalIgnoreCase)
                        || string.Equals(currentTableName, resolvedTargetName, StringComparison.OrdinalIgnoreCase))
                        errors.Add("JoinForm 目标表不能与当前表相同");
                }
                if (joinFieldName.DosIsNullOrWhiteSpace())
                    errors.Add("JoinForm JoinFieldName 不能为空");
                else if (!currentFieldNames.Contains(joinFieldName))
                    errors.Add($"JoinForm JoinFieldName 指向当前表不存在的字段：{joinFieldName}");
                else if (string.Equals(joinFieldName, fieldName, StringComparison.OrdinalIgnoreCase))
                    errors.Add("JoinForm JoinFieldName 不能指向组件字段自身");
                return errors;
            }

            var tableChildTableId = RelationValue(configObject, "TableChildTableId");
            var tableChildMenuId = RelationValue(configObject, "TableChildSysMenuId");
            var childForeignKey = RelationValue(configObject, "TableChildFkFieldName");
            var tableChildOptions = configObject["TableChild"] as JObject ?? new JObject();
            var primaryFieldName = RelationValue(tableChildOptions, "PrimaryTableFieldName");
            if (primaryFieldName.DosIsNullOrWhiteSpace()) primaryFieldName = "Id";

            if (tableChildTableId.DosIsNullOrWhiteSpace()) errors.Add("TableChildTableId 不能为空");
            if (targetTable == null || resolvedTargetId.DosIsNullOrWhiteSpace())
                errors.Add("TableChild 目标子表不存在于当前租户");
            else
            {
                if (!string.Equals(tableChildTableId, resolvedTargetId, StringComparison.OrdinalIgnoreCase))
                    errors.Add("TableChildTableId 与当前租户目标子表不一致");
                if (string.Equals(currentTableId, resolvedTargetId, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(currentTableName, resolvedTargetName, StringComparison.OrdinalIgnoreCase))
                    errors.Add("TableChild 目标子表不能与当前表相同");
            }
            if (childForeignKey.DosIsNullOrWhiteSpace())
                errors.Add("TableChildFkFieldName 不能为空");
            else if (!targetFieldNames.Contains(childForeignKey))
                errors.Add($"TableChildFkFieldName 指向子表不存在的字段：{childForeignKey}");
            if (!currentFieldNames.Contains(primaryFieldName))
                errors.Add($"TableChild.PrimaryTableFieldName 指向当前表不存在的字段：{primaryFieldName}");
            if (tableChildMenuId.DosIsNullOrWhiteSpace())
                errors.Add("TableChildSysMenuId 不能为空");
            if (childModule == null || RelationValue(childModule, "Id").DosIsNullOrWhiteSpace())
                errors.Add("TableChild 隐藏子表菜单不存在于当前租户");
            else
            {
                if (!string.Equals(tableChildMenuId, RelationValue(childModule, "Id"), StringComparison.OrdinalIgnoreCase))
                    errors.Add("TableChildSysMenuId 与当前租户子表菜单不一致");
                if (!string.Equals(tableChildTableId, RelationValue(childModule, "DiyTableId"), StringComparison.OrdinalIgnoreCase))
                    errors.Add("TableChild 子表菜单未绑定目标子表");
                if (RelationInt(childModule, "Display") != 0
                    || RelationInt(childModule, "AppDisplay") != 0
                    || RelationInt(childModule, "HasChild") != 0)
                    errors.Add("TableChild 子表菜单必须设置 Display=0、AppDisplay=0、HasChild=0");
            }
            return errors;
        }

        private static async Task<(bool Ok, string Msg)> ValidateMcpFieldRelationAsync(
            string osClient,
            string currentTableId,
            string fieldName,
            string component,
            string config)
        {
            var isJoinForm = string.Equals(component, "JoinForm", StringComparison.OrdinalIgnoreCase);
            var isTableChild = string.Equals(component, "TableChild", StringComparison.OrdinalIgnoreCase);
            if (!isJoinForm && !isTableChild) return (true, "");

            var configObject = ParseRelationConfig(config);
            if (configObject == null) return (false, $"{component} Config 必须是非空 JSON 对象");

            var currentTableResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
            {
                OsClient = osClient,
                Id = currentTableId,
                _SelectFields = new[] { "Id", "Name" }
            });
            if (currentTableResult.Code != 1 || currentTableResult.Data == null)
                return (false, "关系组件所属 diy_table 不存在");
            var currentTable = JObject.FromObject((object)currentTableResult.Data);

            var targetTableId = isJoinForm
                ? RelationValue(configObject["JoinForm"] as JObject, "TableId")
                : RelationValue(configObject, "TableChildTableId");
            var targetTableName = isJoinForm
                ? RelationValue(configObject["JoinForm"] as JObject, "TableName")
                : "";
            DosResult<dynamic> targetTableResult;
            if (!targetTableId.DosIsNullOrWhiteSpace())
            {
                targetTableResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
                {
                    OsClient = osClient,
                    Id = targetTableId,
                    _SelectFields = new[] { "Id", "Name" }
                });
            }
            else if (!targetTableName.DosIsNullOrWhiteSpace())
            {
                targetTableResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
                {
                    OsClient = osClient,
                    _Where = new List<object> { new List<object> { "Name", "=", targetTableName } },
                    _SelectFields = new[] { "Id", "Name" }
                });
            }
            else
            {
                targetTableResult = null;
            }
            var targetTable = targetTableResult?.Code == 1 && targetTableResult.Data != null
                ? JObject.FromObject((object)targetTableResult.Data)
                : null;

            var currentFieldsResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_field", new
            {
                OsClient = osClient,
                _Where = new List<object> { new List<object> { "TableId", "=", currentTableId } },
                _SelectFields = new[] { "Id", "Name" },
                _PageSize = 10000
            });
            var currentFields = currentFieldsResult.Code == 1 && currentFieldsResult.Data != null
                ? JArray.FromObject((object)currentFieldsResult.Data)
                : new JArray();

            var targetFields = new JArray();
            if (isTableChild && targetTable != null)
            {
                var targetFieldsResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_field", new
                {
                    OsClient = osClient,
                    _Where = new List<object> { new List<object> { "TableId", "=", RelationValue(targetTable, "Id") } },
                    _SelectFields = new[] { "Id", "Name" },
                    _PageSize = 10000
                });
                if (targetFieldsResult.Code == 1 && targetFieldsResult.Data != null)
                    targetFields = JArray.FromObject((object)targetFieldsResult.Data);
            }

            JObject childModule = null;
            if (isTableChild)
            {
                var menuId = RelationValue(configObject, "TableChildSysMenuId");
                if (!menuId.DosIsNullOrWhiteSpace())
                {
                    var menuResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_menu", new
                    {
                        OsClient = osClient,
                        Id = menuId,
                        _SelectFields = new[] { "Id", "DiyTableId", "Display", "AppDisplay", "HasChild" }
                    });
                    if (menuResult.Code == 1 && menuResult.Data != null) childModule = JObject.FromObject((object)menuResult.Data);
                }
            }

            var errors = ValidateMcpFieldRelationSnapshotForTest(
                currentTableId,
                RelationValue(currentTable, "Name"),
                fieldName,
                component,
                config,
                targetTable,
                currentFields,
                targetFields,
                childModule);
            if (isTableChild && targetTable != null)
            {
                var childForeignKey = RelationValue(configObject, "TableChildFkFieldName");
                var indexResult = GetTableIndexes(osClient, RelationValue(targetTable, "Name"));
                if (indexResult.Code != 1)
                {
                    errors.Add("TableChild 子表索引回读失败：" + indexResult.Msg);
                }
                else if (!(indexResult.Data as IEnumerable<TableIndexInfo> ?? Enumerable.Empty<TableIndexInfo>()).Any(index =>
                    index.Columns != null
                    && index.Columns.Count >= 2
                    && string.Equals(index.Columns[0], "OsClient", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(index.Columns[1], childForeignKey, StringComparison.OrdinalIgnoreCase)))
                {
                    errors.Add($"TableChild 子表必须存在以 (OsClient, {childForeignKey}) 开头的组合索引");
                }
            }
            return errors.Count == 0
                ? (true, "")
                : (false, "关系组件配置校验失败：" + string.Join("；", errors));
        }
    }
}
