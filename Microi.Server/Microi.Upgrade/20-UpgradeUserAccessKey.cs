using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// Creates the tenant-level browser access-key security control plane.
    /// The table has no ordinary business menu and is protected from generic
    /// client FormEngine access by PlatformResourceSecurity.
    /// </summary>
    public class Upgrade20
    {
        // Must remain newer than the already deployed 6.7.6 schema version so
        // existing tenants execute this reconciliation migration.
        public static string Version = "6.7.6.1";
        private const string TableName = UserAccessKeySecurity.TableName;

        private static readonly IReadOnlyList<AccessKeyField> Fields =
            new List<AccessKeyField>
            {
                Field("TargetUserId", "目标用户Id", "varchar(50)", "Text", 10, true, 220),
                Field("TargetAccount", "目标帐号", "varchar(200)", "Text", 20, false, 160),
                Field("Name", "密钥名称", "varchar(200)", "Text", 30, true, 180),
                Field("KeyPrefix", "密钥前缀", "varchar(50)", "Text", 40, true, 180),
                Field("SecretHash", "密钥哈希", "varchar(200)", "Text", 50, true, null, false),
                Field("Scopes", "权限范围", "mediumtext", "Textarea", 60, true, null, true, 24),
                Field("AllowedRoutes", "允许页面路由", "mediumtext", "Textarea", 70, true, null, true, 24),
                Field("AllowedTableNames", "允许表名", "mediumtext", "Textarea", 80, false, null, true, 24),
                Field("AllowedApiEngineKeys", "允许接口引擎", "mediumtext", "Textarea", 90, false, null, true, 24),
                Field("AllowedDataSourceKeys", "允许数据源引擎", "mediumtext", "Textarea", 100, false, null, true, 24),
                Field("ExpiresAt", "到期时间", "varchar(25)", "DateTime", 110, false, 180),
                Field("State", "状态", "int", "Select", 120, true, 100, true, null, "1|启用,2|已吊销", "1"),
                Field("RevokedAt", "吊销时间", "varchar(25)", "DateTime", 130, false, 180),
                Field("RevokedBy", "吊销人Id", "varchar(50)", "Text", 140, false, 220),
                Field("LastUsedAt", "最后使用时间", "varchar(25)", "DateTime", 150, false, 180),
                Field("LastUsedIp", "最后使用IP", "varchar(50)", "Text", 160, false, 150),
                Field("LastUsedDid", "最后设备Id", "varchar(200)", "Text", 170, false, 180),
                Field("UseCount", "使用次数", "int", "NumberText", 180, false, 100, true, null, "", "0"),
                Field("Remark", "备注", "mediumtext", "Textarea", 190, false, null, true, 24)
            };

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add($"创建 {TableName} 失败：租户数据库连接不存在。");
                    return messages;
                }

                var tableResult = await GetTableAsync(osClient);
                var physicalTableExists = client.Db.TableExists(TableName);
                if (tableResult.Code == 1 && tableResult.Data != null && !physicalTableExists)
                {
                    var repairPhysicalResult = await MicroiEngine.FormEngine.AddTableAsync(new
                    {
                        OsClient = osClient,
                        Name = TableName,
                        Description = "用户浏览器访问密钥安全控制面",
                        DataBaseId = "",
                        DataBaseName = "",
                        _OnlyCreateTable = true
                    });
                    physicalTableExists = client.Db.TableExists(TableName);
                    if (repairPhysicalResult.Code != 1 && !physicalTableExists)
                    {
                        messages.Add($"修复 {TableName} 物理表失败：{repairPhysicalResult.Msg}");
                        return messages;
                    }
                }

                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    if (!physicalTableExists)
                    {
                        var addTableResult = await MicroiEngine.FormEngine.AddTableAsync(new
                        {
                            OsClient = osClient,
                            Name = TableName,
                            Description = "用户浏览器访问密钥安全控制面",
                            DataBaseId = "",
                            DataBaseName = ""
                        });
                        physicalTableExists = client.Db.TableExists(TableName);
                        if (addTableResult.Code != 1 && !physicalTableExists)
                        {
                            messages.Add($"创建 {TableName} 失败：{addTableResult.Msg}");
                            return messages;
                        }
                    }

                    tableResult = await GetTableAsync(osClient);
                    if ((tableResult.Code != 1 || tableResult.Data == null)
                        && physicalTableExists)
                    {
                        var adoptResult = await AdoptExistingPhysicalTableAsync(osClient, client);
                        if (adoptResult.Code != 1)
                        {
                            messages.Add($"恢复 {TableName} 元数据失败：{adoptResult.Msg}");
                            return messages;
                        }
                    }
                    tableResult = await GetTableAsync(osClient);
                }

                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    messages.Add($"创建后未能读取 {TableName} 表定义。");
                    return messages;
                }

                var tableId = Convert.ToString(tableResult.Data.Id);
                await EnsureFixedFieldMetadataAsync(osClient, client, tableId, messages);
                if (messages.Count > 0)
                {
                    return messages;
                }
                foreach (var field in Fields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var existing = await MicroiEngine.FormEngine.GetFormDataAsync(
                        "diy_field",
                        new
                        {
                            OsClient = osClient,
                            _Where = new List<object>
                            {
                                new List<object> { "TableId", "=", tableId },
                                new List<object> { "Name", "=", field.Name }
                            },
                            _SelectFields = new[] { "Id", "Name" }
                        });
                    if (existing.Code == 1 && existing.Data != null) continue;

                    var addFieldResult = await MicroiEngine.FormEngine.AddFieldAsync(new
                    {
                        OsClient = osClient,
                        TableId = tableId,
                        TableName,
                        field.Name,
                        field.Label,
                        field.Type,
                        field.Component,
                        field.Data,
                        field.DefaultValue,
                        field.NotEmpty,
                        field.Sort,
                        field.FormWidth,
                        field.TableWidth,
                        field.Description,
                        field.Visible,
                        AppVisible = field.Visible,
                        Readonly = field.Name == "SecretHash" ? 1 : 0,
                        _NotAddDbField = client.Db.ColumnExists(TableName, field.Name)
                    });
                    if (addFieldResult.Code != 1)
                    {
                        messages.Add($"新增 {TableName}.{field.Name} 失败：{addFieldResult.Msg}");
                    }
                }

                if (messages.Count == 0)
                {
                    AddIndexResult(
                        messages,
                        V8McpLogic.CreateTableIndex(
                            osClient,
                            TableName,
                            "ux_mci_user_access_key_prefix",
                            // OsClient selects the tenant database and is not a
                            // physical column on FormEngine tables. KeyPrefix is
                            // therefore unique inside the already isolated DB.
                            new[] { "KeyPrefix" },
                            true));
                    AddIndexResult(
                        messages,
                        V8McpLogic.CreateTableIndex(
                            osClient,
                            TableName,
                            "ix_mci_user_access_key_user_state",
                            new[] { "TargetUserId", "State", "CreateTime" }));
                    AddIndexResult(
                        messages,
                        V8McpLogic.CreateTableIndex(
                            osClient,
                            TableName,
                            "ix_mci_user_access_key_expiry",
                            new[] { "State", "ExpiresAt" }));
                }
            }
            catch (Exception ex)
            {
                messages.Add($"创建 {TableName} 失败：" + ex.Message);
            }
            return messages;
        }

        private static async Task EnsureFixedFieldMetadataAsync(
            string osClient,
            OsClientSecret client,
            string tableId,
            List<string> messages)
        {
            foreach (var field in DiyCommon.FixedDiyField)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var existing = await MicroiEngine.FormEngine.GetFormDataAsync(
                    "diy_field",
                    new
                    {
                        OsClient = osClient,
                        _Where = new List<object>
                        {
                            new List<object> { "TableId", "=", tableId },
                            new List<object> { "Name", "=", field.Name }
                        },
                        _SelectFields = new[] { "Id", "Name" }
                    });
                if (existing.Code == 1 && existing.Data != null) continue;

                var addFieldResult = await MicroiEngine.FormEngine.AddFieldAsync(new
                {
                    OsClient = osClient,
                    TableId = tableId,
                    TableName,
                    field.Label,
                    field.Name,
                    field.Type,
                    field.Component,
                    field.Sort,
                    IsLockField = 1,
                    field.Visible,
                    AppVisible = field.Visible,
                    Readonly = 1,
                    NameConfirm = 1,
                    field.TableWidth,
                    Unique = 0,
                    _NotAddDbField = client.Db.ColumnExists(TableName, field.Name)
                });
                if (addFieldResult.Code != 1)
                {
                    messages.Add($"恢复 {TableName}.{field.Name} 固定字段元数据失败：{addFieldResult.Msg}");
                }
            }
        }

        private static void AddIndexResult(List<string> messages, DosResult<object> result)
        {
            if (result?.Code != 1)
            {
                messages.Add(result?.Msg ?? $"创建 {TableName} 索引失败。");
            }
        }

        private static async Task<DosResult> AdoptExistingPhysicalTableAsync(
            string osClient,
            OsClientSecret client)
        {
            var tableId = Guid.NewGuid().ToString();
            var trans = client.Db.BeginTransaction();
            try
            {
                var addTableResult = await UpgradeTrustedFormEngine.AddAsync(
                    "diy_table",
                    osClient,
                    new
                    {
                        Id = tableId,
                        Name = TableName,
                        Description = "用户浏览器访问密钥安全控制面",
                        DataBaseId = "",
                        DataBaseName = "",
                        IsDeleted = 0
                    },
                    trans);
                if (addTableResult.Code != 1)
                {
                    trans.Rollback();
                    return addTableResult;
                }

                foreach (var field in DiyCommon.FixedDiyField)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var addFieldResult = await UpgradeTrustedFormEngine.AddAsync(
                        "diy_field",
                        osClient,
                        new
                        {
                            TableId = tableId,
                            TableName,
                            field.Label,
                            field.Name,
                            field.Type,
                            field.Component,
                            field.Sort,
                            IsLockField = 1,
                            field.Visible,
                            AppVisible = field.Visible,
                            Readonly = 1,
                            NameConfirm = 1,
                            field.TableWidth,
                            Unique = 0,
                            IsDeleted = 0
                        },
                        trans);
                    if (addFieldResult.Code != 1)
                    {
                        trans.Rollback();
                        return addFieldResult;
                    }
                }
                trans.Commit();
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                trans.Rollback();
                return new DosResult(0, null, ex.Message);
            }
            finally
            {
                trans.Close();
            }
        }

        private static Task<DosResult<dynamic>> GetTableAsync(string osClient)
        {
            return MicroiEngine.FormEngine.GetFormDataAsync(
                "diy_table",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Name", "=", TableName }
                    },
                    _SelectFields = new[] { "Id", "Name" }
                });
        }

        private static AccessKeyField Field(
            string name,
            string label,
            string type,
            string component,
            int sort,
            bool required,
            int? tableWidth = null,
            bool visible = true,
            int? formWidth = null,
            string data = "",
            string defaultValue = "")
        {
            return new AccessKeyField
            {
                Name = name,
                Label = label,
                Type = type,
                Component = component,
                Sort = sort,
                NotEmpty = required ? 1 : 0,
                TableWidth = tableWidth,
                Visible = visible ? 1 : 0,
                FormWidth = formWidth,
                Data = data,
                DefaultValue = defaultValue,
                Description = name == "SecretHash"
                    ? "只保存完整访问密钥的 SHA-256 哈希；明文不得写入数据库、日志或缓存。"
                    : ""
            };
        }

        private sealed class AccessKeyField
        {
            public string Name { get; set; }
            public string Label { get; set; }
            public string Type { get; set; }
            public string Component { get; set; }
            public string Data { get; set; }
            public string DefaultValue { get; set; }
            public int NotEmpty { get; set; }
            public int Sort { get; set; }
            public int? FormWidth { get; set; }
            public int? TableWidth { get; set; }
            public int Visible { get; set; }
            public string Description { get; set; }
        }
    }
}
