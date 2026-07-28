using System;
using System.Collections.Generic;
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

                if (table.Code != 1 || table.Data == null)
                {
                    messages.Add($"{TableName} 物理表已存在但缺少 diy_table 元数据；请通过 Microi MCP 认领该表后重试升级。");
                    return messages;
                }

                // OsClient is a platform control column, not an ordinary diy_field;
                // the MCP correctly rejects it as a user-defined field. Add it via
                // the cross-database ORM DDL abstraction so tenant predicates and
                // unique indexes are valid on every supported database.
                EnsurePhysicalColumn(messages, client, "OsClient", "varchar(50)", "租户标识");
                if (messages.Count > 0) return messages;

                var tableId = Convert.ToString(table.Data.Id);
                foreach (var field in Fields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var existing = await MicroiEngine.FormEngine.GetFormDataAsync("diy_field", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>
                        {
                            new List<object> { "TableId", "=", tableId },
                            new List<object> { "Name", "=", field.Name }
                        },
                        _SelectFields = new[] { "Id", "Name" }
                    });
                    if (existing.Code == 1 && existing.Data != null && client.Db.ColumnExists(TableName, field.Name))
                        continue;

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
                        _NotAddDbField = client.Db.ColumnExists(TableName, field.Name)
                    });
                    if (add.Code != 1) messages.Add($"新增 {TableName}.{field.Name} 失败：{add.Msg}");
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

        private static void EnsurePhysicalColumn(
            List<string> messages,
            OsClientSecret client,
            string fieldName,
            string fieldType,
            string fieldLabel)
        {
            if (client.Db.ColumnExists(TableName, fieldName)) return;
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
