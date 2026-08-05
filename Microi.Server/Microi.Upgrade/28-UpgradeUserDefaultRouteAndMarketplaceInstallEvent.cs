using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Adds the per-user login landing route and the durable idempotency ledger used
    /// by official marketplace install counting. The migration is expand-only and
    /// safe to rerun on every node under the shared upgrade lease.
    /// </summary>
    public sealed class Upgrade28
    {
        public static string Version = "6.9.8.3";

        public const string UserDefaultRouteField = "DefaultIndexUrl";
        public const string InstallEventTable = "mci_marketplace_install_event";

        private sealed class FieldDefinition
        {
            public string Name { get; set; }
            public string Label { get; set; }
            public string Type { get; set; }
            public string Component { get; set; }
            public int Sort { get; set; }
            public int Visible { get; set; }
            public int Readonly { get; set; }
            public string Description { get; set; }
            public string Tab { get; set; }
            public int TableWidth { get; set; } = 140;
        }

        private static readonly FieldDefinition[] InstallEventFields =
        {
            EventField("OperationId", "安装操作Id", "varchar(100)", 100),
            EventField("StoreId", "商城记录Id", "varchar(100)", 110),
            EventField("AppId", "应用Id", "varchar(100)", 120),
            EventField("AppName", "应用名称", "varchar(200)", 130),
            EventField("AppVersion", "应用版本", "varchar(50)", 140),
            EventField("InstallAction", "安装动作", "varchar(50)", 150),
            EventField("TargetOsClient", "目标租户", "varchar(100)", 160),
            EventField("CountedAt", "计数时间", "varchar(25)", 170, "DateTime"),
            EventField("Source", "计数来源", "varchar(100)", 180),
            EventField("Remark", "备注", "varchar(500)", 190)
        };

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在，无法升级用户默认首页与商城计数事件表。");
                    return messages;
                }

                var sysUser = await GetTableAsync(osClient, "sys_user").ConfigureAwait(false);
                if (sysUser == null)
                {
                    messages.Add("未找到 sys_user 元数据，无法新增用户登录后首页路由字段。");
                    return messages;
                }

                var personalTab = await GetReferenceTabAsync(
                    osClient,
                    sysUser.Value<string>("Id"),
                    "DesktopType",
                    "个人设置").ConfigureAwait(false);
                await EnsureFieldAsync(
                    messages,
                    osClient,
                    sysUser.Value<string>("Id"),
                    "sys_user",
                    new FieldDefinition
                    {
                        Name = UserDefaultRouteField,
                        Label = "登录后首页路由",
                        Type = "varchar(500)",
                        Component = "Text",
                        Sort = 2380,
                        Visible = 1,
                        Readonly = 0,
                        TableWidth = 180,
                        Tab = personalTab,
                        Description = "当前用户登录后的首选内部路由，例如 /microi-store 或 /#/microi-store；留空时依次使用系统默认首页、菜单首页和首个有权限菜单。无权限或不存在的路由会安全回退。"
                    }).ConfigureAwait(false);
                if (messages.Count > 0) return messages;

                await EnsureTableAsync(
                    messages,
                    osClient,
                    InstallEventTable,
                    "应用商城安装计数幂等事件",
                    InstallEventFields).ConfigureAwait(false);
                if (messages.Count > 0) return messages;

            }
            catch (Exception ex)
            {
                messages.Add("升级用户默认首页与商城计数事件表失败：" + ex.Message);
            }
            return messages;
        }

        private static FieldDefinition EventField(
            string name,
            string label,
            string type,
            int sort,
            string component = "Text")
        {
            return new FieldDefinition
            {
                Name = name,
                Label = label,
                Type = type,
                Component = component,
                Sort = sort,
                Visible = 0,
                Readonly = 1,
                TableWidth = 140,
                Description = "应用商城安装计数幂等事件字段。"
            };
        }

        private static async Task EnsureTableAsync(
            List<string> messages,
            string osClient,
            string tableName,
            string description,
            IEnumerable<FieldDefinition> fields)
        {
            var client = OsClientExtend.GetClient(osClient);
            var table = await GetTableAsync(osClient, tableName).ConfigureAwait(false);
            if (table == null)
            {
                var create = await UpgradeTrustedFormEngine.AddTableAsync(
                    osClient,
                    tableName,
                    description).ConfigureAwait(false);
                table = await GetTableAsync(osClient, tableName).ConfigureAwait(false);
                if (create.Code != 1 && table == null)
                {
                    messages.Add($"创建 {description} 表失败：{create.Msg}");
                    return;
                }
            }
            else if (client?.Db != null && !client.Db.TableExists(tableName))
            {
                var repair = await UpgradeTrustedFormEngine.AddTableAsync(
                    osClient,
                    tableName,
                    description,
                    true).ConfigureAwait(false);
                if (repair.Code != 1 && !client.Db.TableExists(tableName))
                {
                    messages.Add($"修复 {description} 物理表失败：{repair.Msg}");
                    return;
                }
            }
            if (table == null)
            {
                messages.Add($"{description} 表创建后无法回读 diy_table 元数据。");
                return;
            }
            foreach (var field in fields)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                await EnsureFieldAsync(
                    messages,
                    osClient,
                    table.Value<string>("Id"),
                    tableName,
                    field).ConfigureAwait(false);
                if (messages.Count > 0) return;
            }
        }

        private static async Task EnsureFieldAsync(
            List<string> messages,
            string osClient,
            string tableId,
            string tableName,
            FieldDefinition definition)
        {
            var client = OsClientExtend.GetClient(osClient);
            var existing = await GetFieldAsync(osClient, tableId, definition.Name, true)
                .ConfigureAwait(false);
            if (existing != null && existing.Value<int?>("IsDeleted") == 1)
            {
                var recover = await MicroiEngine.FormEngine.RecoverDiyField(new DiyFieldParam
                {
                    Id = existing.Value<string>("Id"),
                    Name = definition.Name,
                    Type = definition.Type,
                    TableId = tableId,
                    TableName = tableName,
                    OsClient = osClient
                }).ConfigureAwait(false);
                if (recover.Code != 1)
                {
                    messages.Add($"恢复 {tableName}.{definition.Name} 元数据失败：{recover.Msg}");
                    return;
                }
                existing = await GetFieldAsync(osClient, tableId, definition.Name, false)
                    .ConfigureAwait(false);
            }

            var physicalExists = client.Db.ColumnExists(tableName, definition.Name);
            if (existing == null)
            {
                var add = await UpgradeTrustedFormEngine.AddFieldAsync(
                    osClient,
                    new DiyFieldParam
                {
                    TableId = tableId,
                    TableName = tableName,
                    Name = definition.Name,
                    Label = definition.Label,
                    Type = definition.Type,
                    Component = definition.Component,
                    Sort = definition.Sort,
                    Visible = definition.Visible,
                    AppVisible = definition.Visible,
                    Readonly = definition.Readonly,
                    Description = definition.Description,
                    Tab = definition.Tab,
                    TableWidth = definition.TableWidth,
                    IsLockField = 0,
                    NameConfirm = 1,
                    Unique = 0,
                    _NotAddDbField = physicalExists
                }).ConfigureAwait(false);
                if (add.Code != 1)
                {
                    existing = await GetFieldAsync(osClient, tableId, definition.Name, false)
                        .ConfigureAwait(false);
                    if (existing == null)
                    {
                        messages.Add($"新增 {tableName}.{definition.Name} 失败：{add.Msg}");
                        return;
                    }
                }
                else
                {
                    existing = await GetFieldAsync(osClient, tableId, definition.Name, false)
                        .ConfigureAwait(false);
                }
            }

            if (!client.Db.ColumnExists(tableName, definition.Name))
            {
                var addPhysical = await UpgradeTrustedFormEngine.AddDbFieldAsync(
                    osClient,
                    new DiyFieldParam
                {
                    TableId = tableId,
                    TableName = tableName,
                    Name = definition.Name,
                    Type = definition.Type
                }).ConfigureAwait(false);
                if (addPhysical.Code != 1 && !client.Db.ColumnExists(tableName, definition.Name))
                {
                    messages.Add($"新增 {tableName}.{definition.Name} 物理字段失败：{addPhysical.Msg}");
                    return;
                }
            }

            if (existing == null)
            {
                messages.Add($"{tableName}.{definition.Name} 新增后无法回读字段元数据。");
                return;
            }
            var update = await UpgradeTrustedFormEngine.UpdateAsync("diy_field", osClient, new JObject
            {
                ["Id"] = existing["Id"],
                ["TableId"] = tableId,
                ["TableName"] = tableName,
                ["Name"] = definition.Name,
                ["Label"] = definition.Label,
                ["Type"] = definition.Type,
                ["Component"] = definition.Component,
                ["Sort"] = definition.Sort,
                ["Visible"] = definition.Visible,
                ["AppVisible"] = definition.Visible,
                ["Readonly"] = definition.Readonly,
                ["Description"] = definition.Description ?? "",
                ["Tab"] = definition.Tab ?? "",
                ["TableWidth"] = definition.TableWidth,
                ["NameConfirm"] = 1,
                ["IsDeleted"] = 0
            }).ConfigureAwait(false);
            if (update.Code != 1)
            {
                messages.Add($"更新 {tableName}.{definition.Name} 元数据失败：{update.Msg}");
            }
        }

        private static async Task<JObject> GetTableAsync(string osClient, string tableName)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(
                "diy_table",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object> { new List<object> { "Name", "=", tableName } },
                    _SelectFields = new[] { "Id", "Name" }
                }).ConfigureAwait(false);
            return result.Code == 1 && result.Data != null
                ? JObject.FromObject((object)result.Data)
                : null;
        }

        private static async Task<JObject> GetFieldAsync(
            string osClient,
            string tableId,
            string fieldName,
            bool includeDeleted)
        {
            var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(
                "diy_field",
                new
                {
                    OsClient = osClient,
                    _IsContainDeleted = includeDeleted,
                    _Where = new List<object>
                    {
                        new List<object> { "TableId", "=", tableId },
                        new List<object> { "Name", "=", fieldName }
                    },
                    _SelectFields = new[] { "Id", "Name", "Tab", "IsDeleted" },
                    _PageIndex = 1,
                    _PageSize = 10
                }).ConfigureAwait(false);
            if (result.Code != 1 || result.Data == null) return null;
            var rows = JArray.FromObject((object)result.Data).OfType<JObject>().ToList();
            return rows.FirstOrDefault(row => row.Value<int?>("IsDeleted") != 1)
                   ?? rows.FirstOrDefault();
        }

        private static async Task<string> GetReferenceTabAsync(
            string osClient,
            string tableId,
            string referenceField,
            string fallback)
        {
            var field = await GetFieldAsync(osClient, tableId, referenceField, false)
                .ConfigureAwait(false);
            var tab = field?.Value<string>("Tab");
            return string.IsNullOrWhiteSpace(tab) ? fallback : tab;
        }
    }
}
