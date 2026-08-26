using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Migrates backend form-event runtime control from the negative
    /// diy_table.V8Unlimited switch to the positive diy_table.V8Limit switch.
    /// The version-gated migration resets every existing table to unrestricted
    /// exactly once. Startup invariant calls only initialize missing/null values,
    /// so a user's later explicit V8Limit=0/1 choice is never overwritten.
    /// </summary>
    public sealed class Upgrade33
    {
        public static string Version = "6.9.8.9";

        public const string FieldName = "V8Limit";
        public const string LegacyFieldName = "V8Unlimited";
        public const string Description =
            "默认关闭，后端表单 V8 事件不设置 Jint 单次执行超时、最大语句数、函数递归和累计分配预算；只有打开后才启用这些单次限制。进程/容器常驻内存保护、取消、并发、嵌套深度、权限沙箱和数据库保护始终生效。";

        public async Task<List<string>> Run(string osClient, bool resetExistingValues = true)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在，无法升级表单 V8 运行限制开关。");
                    return messages;
                }

                var table = await GetTableAsync(osClient).ConfigureAwait(false);
                if (table == null)
                {
                    messages.Add("未找到 diy_table 元数据，无法升级表单 V8 运行限制开关。");
                    return messages;
                }

                var tableId = table.Value<string>("Id");
                var tab = await GetReferenceTabAsync(
                    osClient,
                    tableId,
                    "ServerDataV8",
                    "事件").ConfigureAwait(false);
                await EnsureFieldAsync(messages, osClient, tableId, tab).ConfigureAwait(false);
                if (messages.Count > 0) return messages;

                UpgradeExecutionLeaseContext.ThrowIfLost();
                if (resetExistingValues)
                {
                    // Upgrade.cs advances ServerVersion only after Run succeeds.
                    // This historical correction therefore runs once and makes
                    // every pre-existing form-event runtime unrestricted.
                    var orm = MicroiEngine.ORM(client.Db.Db.DbProvider.DatabaseType);
                    client.Db.FromSql($@"UPDATE {orm.GetTableName("diy_table")}
                            SET {orm.GetFieldName(FieldName)} = @p0,
                                {orm.GetFieldName(LegacyFieldName)} = @p1")
                        .AddInParameter("p0", 0)
                        .AddInParameter("p1", 1)
                        .ExecuteNonQuery();
                }
                else
                {
                    // Hosted startup uses this metadata invariant before reading
                    // ServerVersion. It may fill only uninitialized rows and must
                    // never undo a tenant's later explicit V8Limit choice.
                    var orm = MicroiEngine.ORM(client.Db.Db.DbProvider.DatabaseType);
                    client.Db.FromSql($@"UPDATE {orm.GetTableName("diy_table")}
                            SET {orm.GetFieldName(FieldName)} = @p0,
                                {orm.GetFieldName(LegacyFieldName)} = @p1
                            WHERE {orm.GetFieldName(FieldName)} IS NULL")
                        .AddInParameter("p0", 0)
                        .AddInParameter("p1", 1)
                        .ExecuteNonQuery();
                }
            }
            catch (Exception ex)
            {
                messages.Add("升级表单 V8 运行限制开关失败：" + ex.Message);
            }
            return messages;
        }

        private static async Task EnsureFieldAsync(
            List<string> messages,
            string osClient,
            string tableId,
            string tab)
        {
            var client = OsClientExtend.GetClient(osClient);
            var existing = await GetFieldAsync(osClient, tableId, FieldName).ConfigureAwait(false);
            var physicalExists = client.Db.ColumnExists("diy_table", FieldName);
            if (!physicalExists)
            {
                var addPhysical = MicroiEngine.ORM(client.Db.Db.DbProvider.DatabaseType)
                    .AddColumn(new DbServiceParam
                    {
                        OsClient = osClient,
                        TableName = "diy_table",
                        FieldName = FieldName,
                        FieldType = "int",
                        FieldNotNull = false,
                        DbSession = client.Db
                    });
                if (addPhysical.Code != 1 && !client.Db.ColumnExists("diy_table", FieldName))
                {
                    messages.Add($"新增 diy_table.{FieldName} 物理字段失败：{addPhysical.Msg}");
                    return;
                }
                physicalExists = true;
            }
            if (existing == null)
            {
                var add = await UpgradeTrustedFormEngine.AddFieldAsync(
                    osClient,
                    new DiyFieldParam
                    {
                        TableId = tableId,
                        TableName = "diy_table",
                        Name = FieldName,
                        Label = "V8运行限制",
                        Type = "int",
                        Component = "Switch",
                        DefaultValue = "0",
                        Sort = 2490,
                        TableWidth = 130,
                        Description = Description,
                        Tab = tab,
                        Visible = 1,
                        AppVisible = 1,
                        Readonly = 0,
                        NotEmpty = 0,
                        NameConfirm = 1,
                        _NotAddDbField = physicalExists
                    }).ConfigureAwait(false);
                if (add.Code != 1)
                {
                    messages.Add($"新增 diy_table.{FieldName} 失败：{add.Msg}");
                    return;
                }
                existing = await GetFieldAsync(osClient, tableId, FieldName).ConfigureAwait(false);
            }

            if (existing == null)
            {
                messages.Add($"新增 diy_table.{FieldName} 后未能回读字段元数据。");
                return;
            }

            var update = await UpgradeTrustedFormEngine.UpdateAsync(
                "diy_field",
                osClient,
                new JObject
                {
                    ["Id"] = existing["Id"],
                    ["OsClient"] = osClient,
                    ["TableId"] = tableId,
                    ["Label"] = "V8运行限制",
                    ["Component"] = "Switch",
                    ["DefaultValue"] = "0",
                    ["Description"] = Description,
                    ["Sort"] = 2490,
                    ["Tab"] = tab,
                    ["Visible"] = 1,
                    ["AppVisible"] = 1,
                    ["IsDeleted"] = 0
                }).ConfigureAwait(false);
            if (update.Code != 1)
            {
                messages.Add($"更新 diy_table.{FieldName} 元数据失败：{update.Msg}");
                return;
            }

            var legacy = await GetFieldAsync(osClient, tableId, LegacyFieldName).ConfigureAwait(false);
            if (legacy != null)
            {
                var hide = await UpgradeTrustedFormEngine.UpdateAsync(
                    "diy_field",
                    osClient,
                    new JObject
                    {
                        ["Id"] = legacy["Id"],
                        ["OsClient"] = osClient,
                        ["TableId"] = tableId,
                        ["Visible"] = 0,
                        ["AppVisible"] = 0
                    }).ConfigureAwait(false);
                if (hide.Code != 1)
                {
                    messages.Add("隐藏旧 diy_table.V8Unlimited 字段元数据失败：" + hide.Msg);
                }
            }
        }

        private static async Task<JObject> GetTableAsync(string osClient)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(
                "diy_table",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object> { new List<object> { "Name", "=", "diy_table" } },
                    _SelectFields = new[] { "Id", "Name" }
                }).ConfigureAwait(false);
            return result.Code == 1 && result.Data != null
                ? JObject.FromObject((object)result.Data)
                : null;
        }

        private static async Task<JObject> GetFieldAsync(
            string osClient,
            string tableId,
            string fieldName)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(
                "diy_field",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "TableId", "=", tableId },
                        new List<object> { "Name", "=", fieldName }
                    },
                    _SelectFields = new[] { "Id", "Name", "Tab", "IsDeleted" }
                }).ConfigureAwait(false);
            return result.Code == 1 && result.Data != null
                ? JObject.FromObject((object)result.Data)
                : null;
        }

        private static async Task<string> GetReferenceTabAsync(
            string osClient,
            string tableId,
            string referenceField,
            string fallback)
        {
            var field = await GetFieldAsync(osClient, tableId, referenceField).ConfigureAwait(false);
            var tab = field?.Value<string>("Tab");
            return string.IsNullOrWhiteSpace(tab) ? fallback : tab;
        }
    }
}
