using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using MySql.Data.MySqlClient;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Native control plane shared by the platform UI, MCP and Quartz. It never
    /// accepts connection strings from callers: tenant keys are resolved against
    /// the enabled in-process SaaS catalog for the current runtime environment.
    /// </summary>
    public static class DatabaseBackupControlService
    {
        private const string ScheduleTable = "diy_schedule_job";
        private static readonly Regex OsClientKeyRegex =
            new Regex(@"^[A-Za-z0-9._-]{1,100}$", RegexOptions.Compiled);
        private static readonly Regex IdempotencyKeyRegex =
            new Regex(@"^[A-Za-z0-9:._-]{8,128}$", RegexOptions.Compiled);

        public static DosResult ListEligibleTenants(JObject currentUser, string osClient)
        {
            var permission = ValidatePermission(currentUser, osClient);
            if (permission.Code != 1) return permission;
            var tenants = SnapshotEligibleTenants();
            return new DosResult(1, new
            {
                Runtime = new
                {
                    OsClient = OsClientDefault.OsClient,
                    OsClientType = OsClientDefault.OsClientType,
                    OsClientNetwork = OsClientDefault.OsClientNetwork
                },
                Tenants = tenants.Select(item => new
                {
                    item.OsClient,
                    item.Name,
                    OsClientType = OsClientDefault.OsClientType,
                    OsClientNetwork = OsClientDefault.OsClientNetwork,
                    IsMainTenant = string.Equals(item.OsClient, OsClientDefault.OsClient,
                        StringComparison.OrdinalIgnoreCase)
                }).ToList(),
                Count = tenants.Count
            });
        }

        public static DosResult QueueManualBackup(
            JObject currentUser,
            string osClient,
            JToken tenantOsClients,
            int retainCount,
            string idempotencyKey)
        {
            var permission = ValidatePermission(currentUser, osClient);
            if (permission.Code != 1) return permission;
            var selection = ResolveSelection(tenantOsClients, tenantOsClients != null);
            if (selection.Error != null) return new DosResult(0, null, selection.Error);
            retainCount = Clamp(retainCount, 1, 100, 7);

            var userId = currentUser?["Id"]?.ToString() ?? "";
            if (string.IsNullOrWhiteSpace(idempotencyKey)
                || !IdempotencyKeyRegex.IsMatch(idempotencyKey))
            {
                return new DosResult(0, null,
                    "IdempotencyKey 必填，且仅允许 8-128 位字母、数字、冒号、点、下划线或短横线；不确定重试必须复用同一个值。");
            }
            var title = selection.Keys == null
                ? "立即备份当前环境全部 SaaS 数据库"
                : $"立即备份指定的 {selection.Keys.Count} 个 SaaS 租户数据库";

            try
            {
                var task = Queue(
                    currentUser,
                    osClient,
                    title,
                    "Manual",
                    retainCount,
                    selection.Keys,
                    $"database-backup:{osClient}:manual:{userId}:{idempotencyKey}",
                    "database-backup");
                return new DosResult(1, new
                {
                    TaskId = task.Id,
                    task.Status,
                    task.StatusText,
                    SelectionMode = selection.Keys == null ? "AllEligible" : "Selected",
                    TenantCount = selection.Keys?.Count ?? SnapshotEligibleTenants().Count
                }, "数据库备份已进入持久后台任务队列。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "数据库备份入队失败：" + ex.Message);
            }
        }

        public static DosResult QueueScheduledBackup(JObject schedulerParam)
        {
            var osClient = schedulerParam?["OsClient"]?.ToString() ?? "";
            var jobId = schedulerParam?["JobName"]?.ToString()
                        ?? schedulerParam?["JobId"]?.ToString()
                        ?? schedulerParam?["Id"]?.ToString()
                        ?? "";
            if (!string.Equals(osClient, RuntimeMainOsClient(), StringComparison.OrdinalIgnoreCase)
                || !string.Equals(jobId, DatabaseBackupService.ScheduledJobId, StringComparison.Ordinal))
            {
                return new DosResult(0, null, "仅当前后端主租户的固定数据库备份任务可投递。");
            }

            try
            {
                var client = OsClientExtend.GetClient(osClient);
                if (client?.DbRead == null) return new DosResult(0, null, "主租户读取连接不可用。");
                var admin = client.DbRead.FromSql(@"SELECT `Id`,`Account`,`Name`,`Level`
FROM `Sys_User` WHERE (`IsDeleted`=0 OR `IsDeleted` IS NULL) AND `Level`>=9999
ORDER BY `Level` DESC,`CreateTime` ASC LIMIT 1").ToFirst<dynamic>();
                if (admin == null) return new DosResult(0, null, "未找到可接收定时备份通知的超级管理员。");
                var trustedUser = JObject.FromObject(admin);

                var settings = ParseSettings(schedulerParam?["JobParam"]);
                var retainCount = Clamp(settings["RetainCount"]?.Val<int>() ?? 7, 1, 100, 7);
                var backupAll = settings["BackupAllEligible"] == null
                                || settings["BackupAllEligible"].Val<bool>();
                var selectionToken = backupAll ? null : settings["TenantOsClients"];
                var selection = ResolveSelection(selectionToken, !backupAll);
                if (selection.Error != null) return new DosResult(0, null, selection.Error);
                var scheduledRunKey = BuildScheduledRunKey(schedulerParam);
                var active = BackgroundTaskStore.FindActiveByApiEngineKey(
                    osClient, DatabaseBackupService.WorkerApiEngineKey);
                if (active != null)
                {
                    return new DosResult(1, new
                    {
                        TaskId = active.Id,
                        active.Status,
                        active.StatusText,
                        SuppressedBacklog = true,
                        ScheduledRunKey = scheduledRunKey
                    }, "上一数据库备份任务仍未完成，本次触发已复用现有任务且不会重复积压。");
                }
                var task = Queue(
                    trustedUser,
                    osClient,
                    "数据库定时备份",
                    "Scheduled",
                    retainCount,
                    selection.Keys,
                    $"database-backup:{osClient}:{jobId}:{scheduledRunKey}",
                    "database-backup");
                return new DosResult(1, new { TaskId = task.Id, task.Status, task.StatusText },
                    "数据库定时备份已进入后台任务队列。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "投递数据库定时备份失败：" + ex.Message);
            }
        }

        public static async Task<DosResult> GetSettingsAsync(JObject currentUser, string osClient)
        {
            var permission = ValidatePermission(currentUser, osClient);
            if (permission.Code != 1) return permission;
            var rowResult = await GetScheduleRowAsync(osClient).ConfigureAwait(false);
            if (rowResult.Code != 1 || rowResult.Data == null)
            {
                return new DosResult(0, null,
                    "数据库备份固定任务尚未完成自举，请重启最新版后端执行 Upgrade24；若使用应用商城，请同时更新任务调度与 SaaS 引擎应用。");
            }
            var row = JObject.FromObject(rowResult.Data);
            var settings = ParseSettings(row["JobParam"]);
            if (settings["BackupAllEligible"] == null) settings["BackupAllEligible"] = true;
            if (!(settings["TenantOsClients"] is JArray)) settings["TenantOsClients"] = new JArray();
            var tenantResult = ListEligibleTenants(currentUser, osClient);
            return new DosResult(1, new
            {
                Job = new
                {
                    Id = row["Id"]?.ToString(),
                    JobName = DatabaseBackupService.ScheduledJobId,
                    Status = row["Status"]?.ToString(),
                    CronExpression = row["CronExpression"]?.ToString(),
                    CronDesc = row["CronDesc"]?.ToString(),
                    Settings = settings
                },
                TenantCatalog = tenantResult.Data
            });
        }

        public static async Task<DosResult> SaveSettingsAsync(
            JObject currentUser,
            string osClient,
            JObject input)
        {
            var permission = ValidatePermission(currentUser, osClient);
            if (permission.Code != 1) return permission;
            input ??= new JObject();
            var cronExpression = input["CronExpression"]?.ToString()?.Trim() ?? "";
            var cronDesc = Limit(input["CronDesc"]?.ToString(), 200);
            if (string.IsNullOrWhiteSpace(cronExpression)) return new DosResult(0, null, "CronExpression 不能为空。");
            var cronValidation = ValidateMinimumCronInterval(cronExpression);
            if (cronValidation.Code != 1) return cronValidation;
            var enabled = input["Enabled"] == null || input["Enabled"].Val<bool>();
            var settings = input["Settings"] as JObject ?? new JObject();
            var backupAll = settings["BackupAllEligible"] == null
                            || settings["BackupAllEligible"].Val<bool>();
            var selection = ResolveSelection(
                backupAll ? null : settings["TenantOsClients"],
                !backupAll);
            if (selection.Error != null) return new DosResult(0, null, selection.Error);

            var sanitized = new JObject
            {
                ["Enabled"] = enabled,
                ["ScheduleType"] = Limit(settings["ScheduleType"]?.ToString(), 30),
                ["Interval"] = Clamp(settings["Interval"]?.Val<int>() ?? 1, 1, 59, 1),
                ["WeekDay"] = Limit(settings["WeekDay"]?.ToString(), 3),
                ["MonthDay"] = Clamp(settings["MonthDay"]?.Val<int>() ?? 1, 1, 28, 1),
                ["Hour"] = Clamp(settings["Hour"]?.Val<int>() ?? 0, 0, 23, 0),
                ["Minute"] = Clamp(settings["Minute"]?.Val<int>() ?? 0, 0, 59, 0),
                ["CustomCron"] = cronExpression,
                ["RetainCount"] = Clamp(settings["RetainCount"]?.Val<int>() ?? 7, 1, 100, 7),
                ["BackupAllEligible"] = backupAll,
                ["TenantOsClients"] = selection.Keys == null ? new JArray() : JArray.FromObject(selection.Keys),
                ["BackupScope"] = backupAll ? "AllEligibleInRuntime" : "SelectedInRuntime",
                ["Storage"] = "MainTenantPrivateHdfs",
                ["Serial"] = true
            };
            var jobParam = sanitized.ToString(Formatting.None);
            var row = new JObject
            {
                ["Id"] = DatabaseBackupService.ScheduledJobRecordId,
                ["JobName"] = DatabaseBackupService.ScheduledJobId,
                ["JobType"] = "1",
                ["ApiEngineKey"] = DatabaseBackupService.SchedulerApiEngineKey,
                ["Status"] = enabled ? "正常" : "暂停",
                ["CronExpression"] = cronExpression,
                ["CronDesc"] = cronDesc,
                ["JobDesc"] = "固定任务：SaaS 数据库定时备份",
                ["JobParam"] = jobParam,
                ["IsDeleted"] = 0
            };

            var existing = await GetScheduleRowAsync(osClient).ConfigureAwait(false);
            DosResult saveResult;
            if (existing.Code == 1 && existing.Data != null)
            {
                row["Id"] = JObject.FromObject(existing.Data)["Id"]?.ToString()
                            ?? DatabaseBackupService.ScheduledJobRecordId;
                saveResult = await MicroiEngine.FormEngine.UptFormDataAsync(
                    ScheduleTable,
                    BuildTrustedWriteParam(osClient, row)).ConfigureAwait(false);
            }
            else
            {
                saveResult = await MicroiEngine.FormEngine.AddFormDataAsync(
                    ScheduleTable,
                    BuildTrustedWriteParam(osClient, row)).ConfigureAwait(false);
            }
            if (saveResult.Code != 1) return new DosResult(saveResult.Code, saveResult.Data, saveResult.Msg);

            var schedulerResult = await UpsertQuartzJobAsync(osClient, row, enabled).ConfigureAwait(false);
            if (schedulerResult.Code != 1)
            {
                return new DosResult(0, new { SavedToDatabase = true },
                    "设置已持久化，但刷新分布式调度器失败：" + schedulerResult.Msg);
            }
            return new DosResult(1, new
            {
                JobId = row["Id"]?.ToString(),
                CronExpression = cronExpression,
                Enabled = enabled,
                SelectionMode = backupAll ? "AllEligible" : "Selected",
                TenantCount = selection.Keys?.Count ?? SnapshotEligibleTenants().Count
            }, "数据库备份设置已保存并同步到调度器。");
        }

        private static async Task<MicroiJobResult> UpsertQuartzJobAsync(
            string osClient,
            JObject row,
            bool enabled)
        {
            var model = new MicroiAddJobModel
            {
                Id = row["Id"]?.ToString(),
                JobName = DatabaseBackupService.ScheduledJobId,
                JobType = "1",
                ApiEngineKey = DatabaseBackupService.SchedulerApiEngineKey,
                JobDesc = row["JobDesc"]?.ToString() ?? "",
                JobParam = row["JobParam"]?.ToString() ?? "",
                CronDesc = row["CronDesc"]?.ToString() ?? "",
                CronExpression = row["CronExpression"]?.ToString() ?? "",
                DllName = "",
                JobPath = "",
                OsClient = osClient
            };
            var detail = await MicroiEngine.Job.GetJobDetail(new MicroiSearchJobModel
            {
                Name = DatabaseBackupService.ScheduledJobId,
                OsClient = osClient
            }).ConfigureAwait(false);
            var result = detail.Code == 1
                ? await MicroiEngine.Job.UpdateJob(model).ConfigureAwait(false)
                : await MicroiEngine.Job.AddJob(model).ConfigureAwait(false);
            if (result.Code != 1) return result;
            var stateModel = new MicroiJobModel
            {
                Id = model.Id,
                JobName = model.JobName,
                OsClient = osClient
            };
            return enabled
                ? await MicroiEngine.Job.ResumeJob(stateModel).ConfigureAwait(false)
                : await MicroiEngine.Job.PauseJob(stateModel).ConfigureAwait(false);
        }

        private static BackgroundTaskItem Queue(
            JObject currentUser,
            string osClient,
            string title,
            string triggerType,
            int retainCount,
            IReadOnlyCollection<string> selectedOsClients,
            string idempotencyKey,
            string concurrencyKey)
        {
            var param = new JObject
            {
                ["ApiEngineKey"] = DatabaseBackupService.WorkerApiEngineKey,
                ["TriggerType"] = triggerType,
                ["RetainCount"] = retainCount,
                ["TenantOsClients"] = selectedOsClients == null
                    ? (JToken)JValue.CreateNull()
                    : JArray.FromObject(selectedOsClients)
            };
            return BackgroundTaskService.StartApiEngine(
                osClient,
                currentUser?["Id"]?.ToString() ?? "",
                title,
                param,
                currentUser,
                new JObject
                {
                    ["IdempotencyKey"] = Limit(idempotencyKey, 200),
                    ["ConcurrencyKey"] = concurrencyKey,
                    ["MaxAttempts"] = 1,
                    ["RetryOnFailure"] = false
                });
        }

        private static SelectionResult ResolveSelection(JToken token, bool explicitSelection)
        {
            var eligible = SnapshotEligibleTenants();
            if (eligible.Count == 0) return SelectionResult.Fail("当前后端运行环境没有可备份的已启用 MySQL 租户。");
            if (!explicitSelection) return SelectionResult.All();
            var array = ParseStringArray(token);
            if (array == null) return SelectionResult.Fail("TenantOsClients 必须是字符串数组。");
            var requested = array.Select(item => item?.Trim() ?? "")
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (requested.Count == 0) return SelectionResult.Fail("指定租户备份时至少选择一个租户。");
            if (requested.Count > 2000) return SelectionResult.Fail("单次最多选择 2000 个租户。");
            var malformed = requested.Where(item => !OsClientKeyRegex.IsMatch(item)).ToList();
            if (malformed.Count > 0) return SelectionResult.Fail("TenantOsClients 包含格式不正确的租户标识。");
            var eligibleKeys = new HashSet<string>(eligible.Select(item => item.OsClient), StringComparer.OrdinalIgnoreCase);
            var rejected = requested.Where(item => !eligibleKeys.Contains(item)).ToList();
            if (rejected.Count > 0)
            {
                return SelectionResult.Fail(
                    "以下租户不属于当前后端运行环境三元组、未启用或不是 MySQL 租户："
                    + string.Join(",", rejected.Take(20)));
            }
            return SelectionResult.Selected(requested);
        }

        private static List<EligibleTenant> SnapshotEligibleTenants()
        {
            return SnapshotEligibleTenantConnections()
                .Select(item => new EligibleTenant
                {
                    OsClient = item.OsClient,
                    Name = item.Name
                })
                .ToList();
        }

        /// <summary>
        /// Reads the authoritative SaaS catalog from the main database instead of
        /// relying on ClientList, whose historical key is only OsClient. The same
        /// OsClient can legitimately have one row per runtime type/network, so a
        /// dictionary snapshot can otherwise let the last loaded row shadow the
        /// row for the current server environment.
        /// </summary>
        internal static List<BackupTenantConnection> SnapshotEligibleTenantConnections()
        {
            var runtimeType = OsClientDefault.OsClientType ?? "";
            var runtimeNetwork = OsClientDefault.OsClientNetwork ?? "";
            var mainOsClient = RuntimeMainOsClient();
            try
            {
                var db = string.IsNullOrWhiteSpace(OsClientDefault.OsClientDbConn)
                    ? OsClientExtend.GetClient(mainOsClient)?.DbRead
                      ?? OsClientExtend.GetClient(mainOsClient)?.Db
                    : MicroiORMExtensions.CreateDbSession(
                        OsClientDefault.OsClientDbConn,
                        DatabaseType.MySql);
                if (db != null)
                {
                    var rows = db.FromSql(@"SELECT `OsClient`,`ClientName`,`OsClientType`,`OsClientNetwork`,
`DbType`,`DbConn`,`DbReadConn`,`IsEnable`,`IsDeleted`
FROM `sys_osclients`
WHERE (`IsDeleted` IS NULL OR `IsDeleted`<>1) AND `IsEnable`=1
  AND LOWER(TRIM(COALESCE(`OsClientType`,'')))=LOWER(TRIM(@runtimeType))
  AND LOWER(TRIM(COALESCE(`OsClientNetwork`,'')))=LOWER(TRIM(@runtimeNetwork))
  AND LOWER(TRIM(COALESCE(`DbType`,'')))='mysql'
ORDER BY `OsClient`,`Id`")
                        .AddInParameter("@runtimeType", runtimeType)
                        .AddInParameter("@runtimeNetwork", runtimeNetwork)
                        .ToList<dynamic>() ?? new List<dynamic>();
                    return BuildEligibleTenantConnections(
                        rows.Select(item => JObject.FromObject((object)item)),
                        runtimeType,
                        runtimeNetwork,
                        mainOsClient,
                        OsClientDefault.OsClientDbConn);
                }
            }
            catch
            {
                // A legacy deployment can briefly reach this path before its
                // metadata table is ready. Keep the old in-process catalog as a
                // fail-closed compatibility fallback; it is still filtered by
                // the exact runtime triple below.
            }

            var legacyRows = OsClientExtend.ClientList
                .OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                .Where(item => item.Value?.OsClientModel != null)
                .Select(item =>
                {
                    var model = (JObject)item.Value.OsClientModel.DeepClone();
                    model["OsClient"] = item.Key;
                    return model;
                });
            return BuildEligibleTenantConnections(
                legacyRows,
                runtimeType,
                runtimeNetwork,
                mainOsClient,
                OsClientDefault.OsClientDbConn);
        }

        internal static List<BackupTenantConnection> BuildEligibleTenantConnections(
            IEnumerable<JObject> rows,
            string runtimeType,
            string runtimeNetwork,
            string mainOsClient,
            string mainConnectionString)
        {
            var result = new List<BackupTenantConnection>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var model in rows ?? Enumerable.Empty<JObject>())
            {
                if (model == null || IsFalse(model["IsEnable"]) || IsTrue(model["IsDeleted"])) continue;
                if (!MatchesRuntimeEnvironment(model, runtimeType, runtimeNetwork)) continue;
                if (!string.Equals(model["DbType"]?.ToString()?.Trim(), "MySql", StringComparison.OrdinalIgnoreCase)) continue;
                var tenantOsClient = model["OsClient"]?.ToString()?.Trim() ?? "";
                if (!OsClientKeyRegex.IsMatch(tenantOsClient) || seen.Contains(tenantOsClient)) continue;

                var connectionString = string.Equals(
                    tenantOsClient,
                    mainOsClient,
                    StringComparison.OrdinalIgnoreCase)
                    ? mainConnectionString
                    : model["DbReadConn"]?.ToString();
                if (string.IsNullOrWhiteSpace(connectionString)) connectionString = model["DbConn"]?.ToString();
                if (string.IsNullOrWhiteSpace(connectionString)) continue;
                try
                {
                    var builder = new MySqlConnectionStringBuilder(
                        ConnectionStringCompatibility.Normalize(
                            DatabaseType.MySql, connectionString, 100, 120, 600));
                    if (string.IsNullOrWhiteSpace(builder.Database)) continue;
                    result.Add(new BackupTenantConnection
                    {
                        OsClient = tenantOsClient,
                        Name = string.IsNullOrWhiteSpace(model["ClientName"]?.ToString())
                            ? tenantOsClient
                            : model["ClientName"]?.ToString()?.Trim(),
                        ConnectionString = builder.ConnectionString
                    });
                    seen.Add(tenantOsClient);
                }
                catch
                {
                    // Invalid or incomplete connection settings are never
                    // projected to the UI and are not eligible for backup.
                }
            }
            return result.OrderBy(item => item.OsClient, StringComparer.OrdinalIgnoreCase).ToList();
        }

        public static bool MatchesRuntimeEnvironment(JObject model, string osClientType, string osClientNetwork)
        {
            if (model == null) return false;
            return string.Equals(model["OsClientType"]?.ToString() ?? "", osClientType ?? "",
                       StringComparison.OrdinalIgnoreCase)
                   && string.Equals(model["OsClientNetwork"]?.ToString() ?? "", osClientNetwork ?? "",
                       StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Quartz FireInstanceId is node-local. The scheduled fire time is the
        /// stable identity shared by all cluster nodes competing for one Cron
        /// occurrence, and therefore must lead the durable idempotency key.
        /// </summary>
        public static string BuildScheduledRunKey(JObject schedulerParam)
        {
            var fireTime = schedulerParam?["ScheduledFireTime"]?.ToString()
                           ?? schedulerParam?["FireTime"]?.ToString();
            if (DateTimeOffset.TryParse(
                    fireTime,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out var parsed))
            {
                return parsed.UtcDateTime.ToString("yyyyMMddHHmmssfff", CultureInfo.InvariantCulture);
            }
            var legacyInstance = schedulerParam?["JobRunId"]?.ToString();
            if (!string.IsNullOrWhiteSpace(legacyInstance)) return Limit(legacyInstance, 100);
            // Legacy adapters that do not expose Quartz metadata are grouped by
            // UTC minute. New native jobs always provide ScheduledFireTime.
            return DateTime.UtcNow.ToString("yyyyMMddHHmm", CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// Database backup is deliberately limited to at most one fire per hour.
        /// A literal second and minute make that invariant auditable without
        /// depending on a node-local Quartz parser in the shared Core assembly;
        /// Quartz still performs the complete syntax validation on save.
        /// </summary>
        public static DosResult ValidateMinimumCronInterval(string cronExpression)
        {
            var fields = Regex.Split((cronExpression ?? "").Trim(), @"\s+")
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .ToArray();
            if (fields.Length != 6 && fields.Length != 7)
                return new DosResult(0, null, "Quartz Cron 必须是 6 或 7 段表达式。");
            if (!string.Equals(fields[0], "0", StringComparison.Ordinal)
                || !int.TryParse(fields[1], NumberStyles.None, CultureInfo.InvariantCulture, out var minute)
                || minute < 0 || minute > 59)
            {
                return new DosResult(0, null,
                    "数据库备份最短执行间隔为 1 小时：秒必须为 0，分钟必须是 0-59 的单个固定值，不能使用通配、步长、范围或列表。");
            }
            return new DosResult(1);
        }

        private static DosResult ValidatePermission(JObject currentUser, string osClient)
        {
            if (!string.Equals(osClient, RuntimeMainOsClient(), StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "数据库备份控制面仅允许当前后端运行环境的主租户访问。");
            int.TryParse(currentUser?["Level"]?.ToString(), out var level);
            if (string.IsNullOrWhiteSpace(currentUser?["Id"]?.ToString()) || level < 9999)
                return new DosResult(0, null, "仅当前后端主租户 Level >= 9999 的管理员可管理数据库备份。");
            return new DosResult(1);
        }

        private static Task<DosResult<dynamic>> GetScheduleRowAsync(string osClient)
        {
            return MicroiEngine.FormEngine.GetFormDataAsync("diy_schedule_job", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "JobName", "=", DatabaseBackupService.ScheduledJobId }
                }
            });
        }

        private static DiyTableRowParam BuildTrustedWriteParam(string osClient, JObject row)
        {
            return new DiyTableRowParam
            {
                FormEngineKey = ScheduleTable,
                Id = row["Id"]?.ToString(),
                OsClient = osClient,
                _InvokeType = InvokeType.Server.ToString(),
                _TrustedServerInvocation = true,
                _RowModel = (JObject)row.DeepClone()
            };
        }

        private static JObject ParseSettings(JToken token)
        {
            if (token is JObject value) return (JObject)value.DeepClone();
            var text = token?.ToString();
            if (string.IsNullOrWhiteSpace(text)) return new JObject();
            try { return JObject.Parse(text); }
            catch { return new JObject(); }
        }

        private static List<string> ParseStringArray(JToken token)
        {
            if (token is JArray array)
            {
                return array.Where(item => item.Type == JTokenType.String)
                    .Select(item => item.ToString()).ToList();
            }
            if (token?.Type == JTokenType.String)
            {
                try { return ParseStringArray(JArray.Parse(token.ToString())); }
                catch { return null; }
            }
            return null;
        }

        private static int Clamp(int value, int min, int max, int fallback)
            => value < min || value > max ? Math.Max(min, Math.Min(max, fallback)) : value;
        private static string Limit(string value, int max)
            => string.IsNullOrWhiteSpace(value) ? "" : (value.Length <= max ? value : value.Substring(0, max));
        private static string RuntimeMainOsClient() => OsClientDefault.OsClient ?? "";
        private static bool IsTrue(JToken token) => token != null
                                                    && (token.ToString() == "1"
                                                        || string.Equals(token.ToString(), "true", StringComparison.OrdinalIgnoreCase));
        private static bool IsFalse(JToken token) => token != null
                                                     && (token.ToString() == "0"
                                                         || string.Equals(token.ToString(), "false", StringComparison.OrdinalIgnoreCase));

        private sealed class EligibleTenant
        {
            public string OsClient { get; set; }
            public string Name { get; set; }
        }

        internal sealed class BackupTenantConnection
        {
            public string OsClient { get; set; }
            public string Name { get; set; }
            public string ConnectionString { get; set; }
        }

        private sealed class SelectionResult
        {
            public IReadOnlyCollection<string> Keys { get; private set; }
            public string Error { get; private set; }
            public static SelectionResult All() => new SelectionResult();
            public static SelectionResult Selected(IReadOnlyCollection<string> keys) => new SelectionResult { Keys = keys };
            public static SelectionResult Fail(string error) => new SelectionResult { Error = error };
        }
    }
}
