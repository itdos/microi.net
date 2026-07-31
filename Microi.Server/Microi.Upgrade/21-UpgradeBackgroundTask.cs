using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// Creates the durable, tenant-scoped background task control plane. The table
    /// has no ordinary menu and is protected from generic client FormEngine access.
    /// </summary>
    public sealed class Upgrade21
    {
        // Must remain newer than Upgrade20 and the already deployed 6.7.6 schema.
        public static string Version = "6.7.6.2";
        private const string TableName = "mci_background_task";

        private static readonly IReadOnlyList<FieldDefinition> Fields = new List<FieldDefinition>
        {
            Field("UserKey", "任务用户Key", "varchar(100)", "Text", 10),
            Field("Title", "任务标题", "varchar(500)", "Text", 20),
            Field("Type", "任务类型", "varchar(50)", "Text", 30),
            Field("ApiEngineKey", "接口引擎Key", "varchar(200)", "Text", 40),
            Field("Status", "任务状态", "varchar(30)", "Text", 50),
            Field("StatusText", "状态说明", "varchar(200)", "Text", 60),
            Field("Progress", "进度百分比", "int", "NumberText", 70),
            Field("ProgressMode", "进度模式", "varchar(30)", "Text", 80),
            Field("WorkCurrent", "已完成工作量", "int", "NumberText", 90),
            Field("WorkTotal", "总工作量", "int", "NumberText", 100),
            Field("Msg", "当前消息", "mediumtext", "Textarea", 110, 24),
            Field("Log", "详细日志", "longtext", "Textarea", 120, 24),
            Field("StartTime", "开始时间", "varchar(25)", "DateTime", 130),
            Field("EndTime", "结束时间", "varchar(25)", "DateTime", 140),
            Field("HeartbeatTime", "最后心跳", "varchar(25)", "DateTime", 150),
            Field("EstimatedEndTime", "预计结束时间", "varchar(25)", "DateTime", 160),
            Field("RemainingSeconds", "预计剩余秒数", "int", "NumberText", 170),
            Field("EstimateConfidence", "预计可信度", "varchar(20)", "Text", 180),
            Field("CancelRequested", "已请求取消", "int", "Switch", 190),
            Field("ResultJson", "任务结果", "longtext", "CodeEditor", 200, 24, false),
            Field("ParamJson", "任务参数", "longtext", "CodeEditor", 210, 24, false),
            Field("TrustedUserJson", "可信用户快照", "longtext", "CodeEditor", 220, 24, false),
            Field("IdempotencyKey", "幂等键", "varchar(200)", "Text", 230, null, false),
            Field("ConcurrencyKey", "并发组Key", "varchar(200)", "Text", 240, null, false),
            Field("LeaseOwner", "租约持有者", "varchar(200)", "Text", 250, null, false),
            Field("LeaseExpiresAt", "租约到期时间", "varchar(25)", "DateTime", 260, null, false),
            Field("FencingToken", "隔离令牌", "bigint", "NumberText", 270, null, false),
            Field("AttemptCount", "恢复重试次数", "int", "NumberText", 280, null, false),
            Field("MaxAttempts", "最大尝试次数", "int", "NumberText", 290, null, false),
            Field("ExecutionCount", "执行片段次数", "int", "NumberText", 300, null, false),
            Field("RetryOnFailure", "业务失败时重试", "int", "Switch", 310, null, false),
            Field("NextRunTime", "下次运行时间", "varchar(25)", "DateTime", 320, null, false),
            Field("ProgressSampleTime", "进度采样时间", "varchar(25)", "DateTime", 330, null, false),
            Field("ProgressSampleCurrent", "上次采样工作量", "int", "NumberText", 340, null, false),
            Field("ThroughputPerSecond", "每秒吞吐量", "decimal(18,6)", "NumberText", 350, null, false),
            Field("ProgressSampleCount", "有效采样数", "int", "NumberText", 360, null, false),
            Field("CheckpointJson", "恢复检查点", "longtext", "CodeEditor", 370, 24, false),
            Field("LastError", "最后错误", "mediumtext", "Textarea", 380, 24, false),
            Field("BusinessTable", "关联业务表", "varchar(200)", "Text", 390, null, false),
            Field("BusinessId", "关联业务Id", "varchar(200)", "Text", 400, null, false),
            Field("BusinessStatusField", "业务状态字段", "varchar(100)", "Text", 410, null, false),
            Field("BusinessTaskIdField", "业务任务Id字段", "varchar(100)", "Text", 420, null, false),
            Field("BusinessProgressField", "业务进度字段", "varchar(100)", "Text", 430, null, false),
            Field("BusinessEtaField", "业务预计完成字段", "varchar(100)", "Text", 440, null, false)
        };

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            var repairedPhysicalColumns = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add($"创建 {TableName} 失败：租户数据库连接不存在。");
                    return messages;
                }

                var table = await GetTableAsync(osClient);
                var physicalExists = client.Db.TableExists(TableName);
                if (table.Code == 1 && table.Data != null && !physicalExists)
                {
                    // MCP or a killed process can commit diy_table metadata before
                    // the tenant DDL is visible. Explicitly heal that half-created
                    // state instead of treating the duplicate metadata as success.
                    var repair = await MicroiEngine.FormEngine.AddTableAsync(new
                    {
                        OsClient = osClient,
                        Name = TableName,
                        Description = "分布式可恢复后台任务控制面",
                        DataBaseId = "",
                        DataBaseName = "",
                        _OnlyCreateTable = true
                    });
                    physicalExists = client.Db.TableExists(TableName);
                    if (repair.Code != 1 && !physicalExists)
                    {
                        messages.Add($"修复 {TableName} 物理表失败：{repair.Msg}");
                        return messages;
                    }
                }

                if ((table.Code != 1 || table.Data == null) && !physicalExists)
                {
                    var create = await MicroiEngine.FormEngine.AddTableAsync(new
                    {
                        OsClient = osClient,
                        Name = TableName,
                        Description = "分布式可恢复后台任务控制面",
                        DataBaseId = "",
                        DataBaseName = ""
                    });
                    physicalExists = client.Db.TableExists(TableName);
                    if (create.Code != 1 && !physicalExists)
                    {
                        messages.Add($"创建 {TableName} 失败：{create.Msg}");
                        return messages;
                    }
                    table = await GetTableAsync(osClient);
                }

                if ((table.Code != 1 || table.Data == null) && physicalExists)
                {
                    var adopt = await AdoptExistingPhysicalTableAsync(osClient, client);
                    table = await GetTableAsync(osClient);
                    if ((adopt.Code != 1) && (table.Code != 1 || table.Data == null))
                    {
                        messages.Add($"接管现有 {TableName} 物理表失败：{adopt.Msg}");
                        return messages;
                    }
                    Console.WriteLine(
                        $"Microi：【兼容修复】【{osClient}】已接管半安装的 {TableName} 物理表并补齐表单引擎元数据。");
                }

                if (table.Code != 1 || table.Data == null)
                {
                    messages.Add($"{TableName} 创建或接管后仍无法读取 diy_table 元数据。");
                    return messages;
                }

                var tableId = Convert.ToString(table.Data.Id);
                await EnsureFixedFieldsAsync(
                    messages,
                    repairedPhysicalColumns,
                    osClient,
                    client,
                    tableId);
                if (messages.Count > 0) return messages;

                // OsClient is a platform control column, not an ordinary diy_field;
                // the MCP correctly rejects it as a user-defined field. Add it via
                // the cross-database ORM DDL abstraction so tenant predicates and
                // unique indexes are valid on every supported database.
                if (EnsurePhysicalColumn(messages, client, "OsClient", "varchar(50)", "租户标识"))
                    repairedPhysicalColumns.Add("OsClient");
                if (messages.Count > 0) return messages;

                foreach (var field in Fields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    // Physical schema and metadata are repaired independently. A
                    // killed installer can leave either side committed on its own;
                    // retrying AddField against existing metadata would never add
                    // the missing physical column.
                    if (EnsurePhysicalColumn(
                        messages,
                        client,
                        field.Name,
                        field.Type,
                        field.Label))
                    {
                        repairedPhysicalColumns.Add(field.Name);
                    }
                    if (messages.Count > 0) break;

                    var existing = await GetFieldAsync(osClient, tableId, field.Name);
                    if (existing.Code == 1 && existing.Data != null) continue;

                    var add = await MicroiEngine.FormEngine.AddFieldAsync(new
                    {
                        OsClient = osClient,
                        TableId = tableId,
                        TableName,
                        field.Name,
                        field.Label,
                        field.Type,
                        field.Component,
                        field.Sort,
                        field.FormWidth,
                        field.Visible,
                        AppVisible = field.Visible,
                        Readonly = 1,
                        _NotAddDbField = true
                    });
                    if (add.Code != 1)
                    {
                        var reread = await GetFieldAsync(osClient, tableId, field.Name);
                        if (reread.Code != 1 || reread.Data == null)
                            messages.Add($"新增 {TableName}.{field.Name} 元数据失败：{add.Msg}");
                    }
                }

                if (messages.Count == 0)
                {
                    AddIndex(messages, osClient, "ux_mci_background_task_idempotency",
                        new[] { "OsClient", "IdempotencyKey" }, true);
                    AddIndex(messages, osClient, "ix_mci_background_task_claim",
                        new[] { "OsClient", "Status", "NextRunTime", "LeaseExpiresAt", "CreateTime" });
                    AddIndex(messages, osClient, "ix_mci_background_task_user",
                        new[] { "OsClient", "UserKey", "IsDeleted", "CreateTime" });
                    AddIndex(messages, osClient, "ix_mci_background_task_concurrency",
                        new[] { "OsClient", "ConcurrencyKey", "Status", "LeaseExpiresAt" });
                }

                if (messages.Count == 0)
                {
                    var missingColumns = GetRequiredPhysicalColumnNames()
                        .Where(name => !client.Db.ColumnExists(TableName, name))
                        .ToArray();
                    if (missingColumns.Length > 0)
                    {
                        messages.Add(
                            $"{TableName} 修复后严格回读仍缺少物理字段：{string.Join(",", missingColumns)}");
                    }
                }

                await ClearMetadataCacheAsync(osClient, tableId);
                if (messages.Count == 0 && repairedPhysicalColumns.Count > 0)
                {
                    Console.WriteLine(
                        $"Microi：【后台任务兼容修复】【{osClient}】已补齐 {TableName} 物理字段"
                        + $"{repairedPhysicalColumns.Count}个：{string.Join(",", repairedPhysicalColumns)}。");
                }
            }
            catch (Exception ex)
            {
                messages.Add($"创建 {TableName} 失败：{ex.Message}");
            }
            return messages;
        }

        private static void AddIndex(
            List<string> messages,
            string osClient,
            string name,
            string[] columns,
            bool unique = false)
        {
            var result = V8McpLogic.CreateTableIndex(osClient, TableName, name, columns, unique);
            if (result?.Code != 1) messages.Add(result?.Msg ?? $"创建索引 {name} 失败。");
        }

        private static bool EnsurePhysicalColumn(
            List<string> messages,
            OsClientSecret client,
            string fieldName,
            string fieldType,
            string fieldLabel)
        {
            if (client.Db.ColumnExists(TableName, fieldName)) return false;
            var dbInfo = DiyCommon.GetDbInfo(client.OsClientModel["DbType"].Val<string>());
            var result = MicroiEngine.ORM(dbInfo.DbType).AddColumn(new DbServiceParam
            {
                TableName = TableName,
                FieldName = fieldName,
                FieldType = fieldType,
                FieldNotNull = false,
                FieldLabel = fieldLabel,
                OsClientModel = client,
                DbInfo = dbInfo,
                DataBaseId = "",
                OsClient = client.OsClient,
                DbSession = client.Db
            });
            if (result?.Code != 1 || !client.Db.ColumnExists(TableName, fieldName))
            {
                messages.Add($"新增 {TableName}.{fieldName} 系统列失败：{result?.Msg}");
                return false;
            }
            return true;
        }

        private static async Task EnsureFixedFieldsAsync(
            List<string> messages,
            List<string> repairedPhysicalColumns,
            string osClient,
            OsClientSecret client,
            string tableId)
        {
            foreach (var field in DiyCommon.FixedDiyField)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                if (EnsurePhysicalColumn(
                    messages,
                    client,
                    field.Name,
                    field.Type,
                    field.Label))
                {
                    repairedPhysicalColumns.Add(field.Name);
                }
                if (messages.Count > 0) return;

                var existing = await GetFieldAsync(osClient, tableId, field.Name);
                if (existing.Code == 1 && existing.Data != null) continue;

                var add = await UpgradeTrustedFormEngine.AddAsync(
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
                    });
                if (add.Code != 1)
                {
                    var reread = await GetFieldAsync(osClient, tableId, field.Name);
                    if (reread.Code != 1 || reread.Data == null)
                        messages.Add($"补充 {TableName}.{field.Name} 固定字段元数据失败：{add.Msg}");
                }
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
                var addTable = await UpgradeTrustedFormEngine.AddAsync(
                    "diy_table",
                    osClient,
                    new
                    {
                        Id = tableId,
                        Name = TableName,
                        Description = "分布式可恢复后台任务控制面",
                        DataBaseId = "",
                        DataBaseName = "",
                        IsDeleted = 0
                    },
                    trans);
                if (addTable.Code != 1)
                {
                    trans.Rollback();
                    return addTable;
                }

                foreach (var field in DiyCommon.FixedDiyField)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var addField = await UpgradeTrustedFormEngine.AddAsync(
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
                    if (addField.Code == 1) continue;

                    trans.Rollback();
                    return addField;
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

        private static Task<DosResult<dynamic>> GetFieldAsync(
            string osClient,
            string tableId,
            string fieldName)
        {
            return MicroiEngine.FormEngine.GetFormDataAsync("diy_field", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "TableId", "=", tableId },
                    new List<object> { "Name", "=", fieldName }
                },
                _SelectFields = new[] { "Id", "Name" }
            });
        }

        private static string[] GetRequiredPhysicalColumnNames()
        {
            return DiyCommon.FixedDiyField
                .Select(field => field.Name)
                .Concat(new[] { "OsClient" })
                .Concat(Fields.Select(field => field.Name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        private static async Task ClearMetadataCacheAsync(string osClient, string tableId)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            foreach (var key in new[]
            {
                $"Microi:{osClient}:FormData:diy_table:{tableId.ToLowerInvariant()}",
                $"Microi:{osClient}:FormData:diy_table:{TableName}",
                $"Microi:{osClient}:FormData:diy_table_field_list:{tableId.ToLowerInvariant()}",
                $"Microi:{osClient}:FormData:diy_table_field_list:{TableName}"
            })
            {
                await cache.RemoveAsync(key);
            }
        }

        private static Task<DosResult<dynamic>> GetTableAsync(string osClient)
        {
            return MicroiEngine.FormEngine.GetFormDataAsync("diy_table", new
            {
                OsClient = osClient,
                _Where = new List<object> { new List<object> { "Name", "=", TableName } },
                _SelectFields = new[] { "Id", "Name" }
            });
        }

        private static FieldDefinition Field(
            string name,
            string label,
            string type,
            string component,
            int sort,
            int? formWidth = null,
            bool visible = true)
        {
            return new FieldDefinition
            {
                Name = name,
                Label = label,
                Type = type,
                Component = component,
                Sort = sort,
                FormWidth = formWidth,
                Visible = visible ? 1 : 0
            };
        }

        private sealed class FieldDefinition
        {
            public string Name { get; set; }
            public string Label { get; set; }
            public string Type { get; set; }
            public string Component { get; set; }
            public int Sort { get; set; }
            public int? FormWidth { get; set; }
            public int Visible { get; set; }
        }
    }
}
