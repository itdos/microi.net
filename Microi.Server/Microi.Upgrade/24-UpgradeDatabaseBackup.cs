using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;

namespace Microi.net
{
    /// <summary>
    /// Installs and heals the native database-backup control plane on the runtime
    /// main tenant. This migration intentionally does not depend on app-store
    /// SelectData, so a partially installed SaaS/Job package can recover on restart.
    /// </summary>
    public sealed class Upgrade24
    {
        // Must stay above the currently released 6.9.4.0 schema marker.  This
        // migration also heals already-existing backup tables, so using the old
        // 6.9.3.1 marker caused upgraded tenants to skip the newly added fencing
        // and object-attempt columns entirely.
        public static string Version = "6.9.4.2";
        public const string DefaultScheduleStatus = "暂停";

        private static readonly TableDefinition ScheduleTable = new TableDefinition
        {
            Id = "0234e89e-2e80-4ae0-b86a-f53635e29460",
            Name = "diy_schedule_job",
            Description = "定时任务表",
            Fields = new List<FieldDefinition>
            {
                Field("ZhiXingZQ", "执行周期", "varchar(100)", "Text", 10),
                Field("NextTime", "下次执行时间", "varchar(50)", "DateTime", 20),
                Field("JobParam", "任务参数", "mediumtext", "CodeEditor", 30, 24, false, true),
                Field("Description", "任务描述", "mediumtext", "Textarea", 40, 24),
                Field("ApiEngineKey", "ApiEngineKey", "varchar(200)", "Text", 50),
                Field("LastTime", "上次执行时间", "varchar(50)", "DateTime", 60),
                Field("XiaoShi", "小时", "int", "NumberText", 70),
                Field("JobType", "任务类别", "varchar(50)", "Text", 80),
                Field("FenZhong", "分钟", "int", "NumberText", 90),
                Field("Status", "任务状态", "varchar(200)", "Text", 100),
                Field("Week", "星期", "varchar(100)", "Text", 110),
                Field("ZhiXingZQLB", "执行周期类别", "varchar(100)", "Text", 120),
                Field("JobDesc", "任务名称", "varchar(200)", "Text", 130),
                Field("Tian", "日", "int", "NumberText", 140),
                Field("CronExpression", "cron表达式", "varchar(100)", "Text", 150),
                Field("DllName", "DLL名称", "varchar(100)", "Text", 160),
                Field("JobName", "任务Key", "varchar(100)", "Text", 170),
                Field("JobPath", "任务路径", "varchar(200)", "Text", 180),
                Field("CronDesc", "执行周期描述", "varchar(200)", "Text", 190),
                Field("Miao", "秒", "int", "NumberText", 200)
            }
        };

        private static readonly TableDefinition ScheduleLogTable = new TableDefinition
        {
            Id = "01KXZDBACKUPJOBLOG00000000",
            Name = "diy_schedule_job_log",
            Description = "定时任务日志",
            Fields = new List<FieldDefinition>
            {
                Field("JobName", "任务名称", "varchar(100)", "Text", 10),
                Field("Message", "日志信息", "mediumtext", "Textarea", 20, 24)
            }
        };

        private static readonly TableDefinition BackupRecordTable = new TableDefinition
        {
            Id = "01KXZS3D7N4ZQSKRFADNXPCYVS",
            Name = "mci_database_backup",
            Description = "SaaS 数据库备份记录",
            Fields = new List<FieldDefinition>
            {
                Field("BackupNo", "备份编号", "varchar(100)", "Text", 10),
                Field("TriggerType", "触发方式", "varchar(30)", "Text", 20),
                Field("Status", "状态", "varchar(30)", "Text", 30),
                Field("Progress", "进度", "int", "NumberText", 40),
                Field("TotalDatabases", "数据库总数", "int", "NumberText", 50),
                Field("CompletedDatabases", "已完成数据库", "int", "NumberText", 60),
                Field("SuccessCount", "成功数", "int", "NumberText", 70),
                Field("FailedCount", "失败数", "int", "NumberText", 80),
                Field("BackgroundTaskId", "后台任务Id", "varchar(100)", "Text", 90, null, false),
                Field("BackgroundTaskFencingToken", "后台任务栅栏令牌", "bigint", "NumberText", 95, null, false),
                Field("RequestedById", "发起人Id", "varchar(100)", "Text", 100, null, false),
                Field("RequestedByName", "发起人", "varchar(200)", "Text", 110),
                Field("RetentionStatus", "保留状态", "varchar(30)", "Text", 120),
                Field("CurrentDatabase", "当前数据库", "varchar(500)", "Text", 130),
                Field("StartedAt", "开始时间", "varchar(25)", "DateTime", 140),
                Field("FinishedAt", "完成时间", "varchar(25)", "DateTime", 150),
                Field("FileName", "文件名", "varchar(500)", "Text", 160),
                Field("FileSize", "文件大小", "bigint", "NumberText", 170),
                Field("Sha256", "SHA-256", "varchar(64)", "Text", 180),
                Field("HdfsPath", "私有存储路径", "mediumtext", "Textarea", 190, 24, false),
                Field("LeaseOwner", "租约持有者", "varchar(200)", "Text", 200, null, false),
                Field("LeaseExpiresAt", "租约到期时间", "varchar(25)", "DateTime", 210, null, false),
                Field("ErrorSummary", "错误摘要", "mediumtext", "Textarea", 220, 24),
                Field("Log", "执行日志", "longtext", "Textarea", 230, 24),
                Field("BackupScope", "备份范围", "varchar(50)", "Text", 240),
                Field("SelectedOsClients", "指定租户", "longtext", "CodeEditor", 250, 24, false),
                Field("RuntimeOsClientType", "运行环境类型", "varchar(50)", "Text", 260, null, false),
                Field("RuntimeOsClientNetwork", "运行环境网络", "varchar(50)", "Text", 270, null, false),
                Field("ObjectAttemptPath", "对象尝试路径", "mediumtext", "Textarea", 280, 24, false),
                Field("ObjectState", "对象状态", "varchar(30)", "Text", 290, null, false)
            }
        };

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            if (!string.Equals(osClient, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase))
                return messages;
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                foreach (var table in new[] { ScheduleTable, ScheduleLogTable, BackupRecordTable })
                {
                    await EnsureTableAsync(osClient, table, messages).ConfigureAwait(false);
                    if (messages.Count > 0) return messages;
                }
                await EnsureFixedScheduleRowAsync(osClient, messages).ConfigureAwait(false);
                if (messages.Count == 0)
                {
                    NormalizeLegacyBackgroundTaskIds(osClient, messages);
                }
                if (messages.Count == 0)
                {
                    AddIndex(messages, osClient, "ux_database_backup_job_name",
                        ScheduleTable.Name, new[] { "JobName" }, true);
                    AddIndex(messages, osClient, "ix_database_backup_status_time",
                        BackupRecordTable.Name, new[] { "Status", "CreateTime" });
                    AddIndex(messages, osClient, "ux_database_backup_background_task",
                        BackupRecordTable.Name, new[] { "BackgroundTaskId" }, true);
                }
            }
            catch (Exception ex)
            {
                messages.Add("数据库备份控制面升级失败：" + ex.Message);
            }
            return messages;
        }

        private static async Task EnsureTableAsync(
            string osClient,
            TableDefinition definition,
            List<string> messages)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            var client = OsClientExtend.GetClient(osClient);
            if (client?.Db == null)
            {
                messages.Add($"创建 {definition.Name} 失败：租户数据库连接不存在。");
                return;
            }

            var table = await GetTableAsync(osClient, definition.Name).ConfigureAwait(false);
            var physicalExists = client.Db.TableExists(definition.Name);
            if ((table.Code != 1 || table.Data == null) && physicalExists)
            {
                var adopt = await AdoptExistingPhysicalTableAsync(osClient, client, definition)
                    .ConfigureAwait(false);
                if (adopt.Code != 1)
                {
                    messages.Add($"接管现有 {definition.Name} 物理表失败：{adopt.Msg}");
                    return;
                }
                table = await GetTableAsync(osClient, definition.Name).ConfigureAwait(false);
            }
            else if ((table.Code != 1 || table.Data == null) && !physicalExists)
            {
                var create = await MicroiEngine.FormEngine.AddTableAsync(new
                {
                    OsClient = osClient,
                    definition.Id,
                    definition.Name,
                    definition.Description,
                    DataBaseId = "",
                    DataBaseName = ""
                }).ConfigureAwait(false);
                if (create.Code != 1 && !client.Db.TableExists(definition.Name))
                {
                    messages.Add($"创建 {definition.Name} 失败：{create.Msg}");
                    return;
                }
                table = await GetTableAsync(osClient, definition.Name).ConfigureAwait(false);
            }
            else if (table.Code == 1 && table.Data != null && !physicalExists)
            {
                var repair = await MicroiEngine.FormEngine.AddTableAsync(new
                {
                    OsClient = osClient,
                    definition.Name,
                    definition.Description,
                    DataBaseId = "",
                    DataBaseName = "",
                    _OnlyCreateTable = true
                }).ConfigureAwait(false);
                if (repair.Code != 1 && !client.Db.TableExists(definition.Name))
                {
                    messages.Add($"修复 {definition.Name} 物理表失败：{repair.Msg}");
                    return;
                }
            }

            if (table.Code != 1 || table.Data == null)
            {
                messages.Add($"{definition.Name} 创建或接管后仍无法读取 diy_table 元数据。");
                return;
            }
            var tableId = Convert.ToString(table.Data.Id);
            var fixedRepair = await V8McpLogic.CreateTable(
                osClient, definition.Name, definition.Description).ConfigureAwait(false);
            if (fixedRepair.Code != 1)
            {
                messages.Add(fixedRepair.Msg);
                return;
            }

            foreach (var field in definition.Fields)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                EnsurePhysicalField(osClient, client, definition.Name, field, messages);
                if (messages.Count > 0) return;
                var existing = await GetFieldAsync(osClient, tableId, field.Name).ConfigureAwait(false);
                if (existing.Code != 1 || existing.Data == null)
                {
                    var add = await MicroiEngine.FormEngine.AddFieldAsync(new
                    {
                        OsClient = osClient,
                        TableId = tableId,
                        TableName = definition.Name,
                        field.Name,
                        field.Label,
                        field.Type,
                        field.Component,
                        field.Sort,
                        field.FormWidth,
                        field.Visible,
                        AppVisible = field.Visible,
                        Readonly = 1,
                        NameConfirm = 1,
                        TableWidth = 120,
                        Unique = 0,
                        _NotAddDbField = true
                    }).ConfigureAwait(false);
                    if (add.Code != 1)
                    {
                        var reread = await GetFieldAsync(osClient, tableId, field.Name).ConfigureAwait(false);
                        if (reread.Code != 1 || reread.Data == null)
                        {
                            messages.Add($"新增 {definition.Name}.{field.Name} 元数据失败：{add.Msg}");
                            return;
                        }
                    }
                }
                else if (field.WidenExisting
                         && !string.Equals(Convert.ToString(existing.Data.Type), field.Type,
                             StringComparison.OrdinalIgnoreCase))
                {
                    var update = await UpgradeTrustedFormEngine.UpdateAsync("diy_field", osClient, new
                    {
                        Id = Convert.ToString(existing.Data.Id),
                        Type = field.Type
                    }).ConfigureAwait(false);
                    if (update.Code != 1)
                    {
                        messages.Add($"更新 {definition.Name}.{field.Name} 元数据类型失败：{update.Msg}");
                        return;
                    }
                }
            }
            await ClearMetadataCacheAsync(osClient, tableId, definition.Name).ConfigureAwait(false);
        }

        private static void EnsurePhysicalField(
            string osClient,
            OsClientSecret client,
            string tableName,
            FieldDefinition field,
            List<string> messages)
        {
            var dbInfo = DiyCommon.GetDbInfo(client.OsClientModel["DbType"].Val<string>());
            var orm = MicroiEngine.ORM(dbInfo.DbType);
            if (!client.Db.ColumnExists(tableName, field.Name))
            {
                var add = orm.AddColumn(new DbServiceParam
                {
                    TableName = tableName,
                    FieldName = field.Name,
                    FieldType = field.Type,
                    FieldNotNull = false,
                    FieldLabel = field.Label,
                    OsClientModel = client,
                    DbInfo = dbInfo,
                    DataBaseId = "",
                    OsClient = osClient,
                    DbSession = client.Db
                });
                if (add.Code != 1 || !client.Db.ColumnExists(tableName, field.Name))
                    messages.Add($"新增 {tableName}.{field.Name} 物理字段失败：{add.Msg}");
                return;
            }
            if (!field.WidenExisting) return;
            var columns = orm.GetColumns(new DbServiceParam
            {
                OsClient = osClient,
                TableName = tableName,
                DbSession = client.Db,
                DbInfo = dbInfo
            });
            var column = columns.Data?.FirstOrDefault(item => string.Equals(
                Convert.ToString(item.column_name), field.Name, StringComparison.OrdinalIgnoreCase));
            var currentType = Convert.ToString(column?.column_type ?? column?.data_type);
            if (string.Equals(currentType, field.Type, StringComparison.OrdinalIgnoreCase)) return;
            var change = orm.ChangeColumn(new DbServiceParam
            {
                OsClient = osClient,
                TableName = tableName,
                FieldName = field.Name,
                NewFieldName = field.Name,
                FieldType = field.Type,
                FieldLabel = field.Label,
                FieldNotNull = false,
                DbSession = client.Db,
                DbInfo = dbInfo
            });
            if (change.Code != 1)
                messages.Add($"扩容 {tableName}.{field.Name} 为 {field.Type} 失败：{change.Msg}");
        }

        private static async Task EnsureFixedScheduleRowAsync(string osClient, List<string> messages)
        {
            var existing = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(ScheduleTable.Name, new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "JobName", "=", DatabaseBackupService.ScheduledJobId }
                }
            }).ConfigureAwait(false);
            if (existing.Code == 1 && existing.Data != null) return;
            var settings = BuildDefaultScheduleSettings();
            var add = await UpgradeTrustedFormEngine.AddAsync(ScheduleTable.Name, osClient, new
            {
                Id = DatabaseBackupService.ScheduledJobRecordId,
                JobName = DatabaseBackupService.ScheduledJobId,
                JobType = "1",
                ApiEngineKey = DatabaseBackupService.SchedulerApiEngineKey,
                Status = DefaultScheduleStatus,
                CronExpression = "0 0 0 * * ?",
                CronDesc = "每天 00:00",
                JobDesc = "固定任务：SaaS 数据库定时备份",
                JobParam = JsonConvert.SerializeObject(settings),
                IsDeleted = 0
            }).ConfigureAwait(false);
            if (add.Code != 1)
            {
                var reread = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(ScheduleTable.Name, new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "JobName", "=", DatabaseBackupService.ScheduledJobId }
                    }
                }).ConfigureAwait(false);
                if (reread.Code != 1 || reread.Data == null)
                    messages.Add("新增数据库备份固定任务失败：" + add.Msg);
            }
        }

        public static Newtonsoft.Json.Linq.JObject BuildDefaultScheduleSettings()
        {
            return Newtonsoft.Json.Linq.JObject.FromObject(new
            {
                Enabled = false,
                ScheduleType = "Daily",
                Interval = 1,
                WeekDay = "MON",
                MonthDay = 1,
                Hour = 0,
                Minute = 0,
                CustomCron = "0 0 0 * * ?",
                RetainCount = 7,
                BackupAllEligible = true,
                TenantOsClients = Array.Empty<string>(),
                BackupScope = "AllEligibleInRuntime",
                Storage = "MainTenantPrivateHdfs",
                Serial = true
            });
        }

        private static void NormalizeLegacyBackgroundTaskIds(string osClient, List<string> messages)
        {
            try
            {
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null) throw new InvalidOperationException("主租户数据库连接不可用。");
                client.Db.FromSql($@"UPDATE `{BackupRecordTable.Name}`
SET `BackgroundTaskId`=NULL
WHERE `BackgroundTaskId` IS NOT NULL AND TRIM(`BackgroundTaskId`)='';").ExecuteNonQuery();
                client.Db.FromSql($@"UPDATE `{BackupRecordTable.Name}` older
INNER JOIN `{BackupRecordTable.Name}` newer
 ON older.`BackgroundTaskId`=newer.`BackgroundTaskId`
 AND older.`BackgroundTaskId` IS NOT NULL
 AND (COALESCE(newer.`CreateTime`,'1970-01-01')>COALESCE(older.`CreateTime`,'1970-01-01')
      OR (COALESCE(newer.`CreateTime`,'1970-01-01')=COALESCE(older.`CreateTime`,'1970-01-01')
          AND newer.`Id`>older.`Id`))
SET older.`BackgroundTaskId`=NULL;").ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                messages.Add("归一化数据库备份后台任务标识失败：" + ex.Message);
            }
        }

        private static async Task<DosResult> AdoptExistingPhysicalTableAsync(
            string osClient,
            OsClientSecret client,
            TableDefinition definition)
        {
            var trans = client.Db.BeginTransaction();
            try
            {
                var addTable = await UpgradeTrustedFormEngine.AddAsync("diy_table", osClient, new
                {
                    definition.Id,
                    definition.Name,
                    definition.Description,
                    DataBaseId = "",
                    DataBaseName = "",
                    IsDeleted = 0
                }, trans).ConfigureAwait(false);
                if (addTable.Code != 1)
                {
                    trans.Rollback();
                    return addTable;
                }
                foreach (var field in DiyCommon.FixedDiyField)
                {
                    var addField = await UpgradeTrustedFormEngine.AddAsync("diy_field", osClient, new
                    {
                        TableId = definition.Id,
                        TableName = definition.Name,
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
                    }, trans).ConfigureAwait(false);
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

        private static Task<DosResult<dynamic>> GetTableAsync(string osClient, string tableName)
        {
            return MicroiEngine.FormEngine.GetFormDataAsync("diy_table", new
            {
                OsClient = osClient,
                _Where = new List<object> { new List<object> { "Name", "=", tableName } },
                _SelectFields = new[] { "Id", "Name" }
            });
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
                _SelectFields = new[] { "Id", "Name", "Type" }
            });
        }

        private static void AddIndex(
            List<string> messages,
            string osClient,
            string indexName,
            string tableName,
            string[] columns,
            bool unique = false)
        {
            var result = V8McpLogic.CreateTableIndex(osClient, tableName, indexName, columns, unique);
            if (result?.Code != 1) messages.Add(result?.Msg ?? $"创建索引 {indexName} 失败。");
        }

        private static async Task ClearMetadataCacheAsync(
            string osClient,
            string tableId,
            string tableName)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            foreach (var key in new[]
            {
                $"Microi:{osClient}:FormData:diy_table:{tableId.ToLowerInvariant()}",
                $"Microi:{osClient}:FormData:diy_table:{tableName}",
                $"Microi:{osClient}:FormData:diy_table_field_list:{tableId.ToLowerInvariant()}",
                $"Microi:{osClient}:FormData:diy_table_field_list:{tableName}"
            })
            {
                await cache.RemoveAsync(key).ConfigureAwait(false);
            }
        }

        private static FieldDefinition Field(
            string name,
            string label,
            string type,
            string component,
            int sort,
            int? formWidth = null,
            bool visible = true,
            bool widenExisting = false)
        {
            return new FieldDefinition
            {
                Name = name,
                Label = label,
                Type = type,
                Component = component,
                Sort = sort,
                FormWidth = formWidth,
                Visible = visible ? 1 : 0,
                WidenExisting = widenExisting
            };
        }

        private sealed class TableDefinition
        {
            public string Id { get; set; }
            public string Name { get; set; }
            public string Description { get; set; }
            public IReadOnlyList<FieldDefinition> Fields { get; set; }
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
            public bool WidenExisting { get; set; }
        }
    }
}
