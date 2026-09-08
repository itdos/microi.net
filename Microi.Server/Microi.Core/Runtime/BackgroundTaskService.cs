using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    public class BackgroundTaskItem
    {
        public string Id { get; set; }
        public string OsClient { get; set; }
        public string UserKey { get; set; }
        public string Title { get; set; }
        public string Type { get; set; }
        public string Status { get; set; }
        public string StatusText { get; set; }
        public int Progress { get; set; }
        public string ProgressMode { get; set; }
        public int Current { get; set; }
        public int Total { get; set; }
        public string Msg { get; set; }
        public string Log { get; set; }
        public DateTime CreateTime { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public DateTime? HeartbeatTime { get; set; }
        public DateTime? EstimatedEndTime { get; set; }
        public int? RemainingSeconds { get; set; }
        public string RemainingText { get; set; }
        public string EstimateConfidence { get; set; }
        public int ElapsedSeconds { get; set; }
        public string ElapsedText { get; set; }
        public bool CancelRequested { get; set; }
        public JObject Result { get; set; }
        public string IdempotencyKey { get; set; }
        public long FencingToken { get; set; }
        public int AttemptCount { get; set; }
        public int MaxAttempts { get; set; }
        public int ExecutionCount { get; set; }
        public string BusinessTable { get; set; }
        public string BusinessId { get; set; }
        public string BusinessStatusField { get; set; }
        public string BusinessTaskIdField { get; set; }
        public string BusinessProgressField { get; set; }
        public string BusinessEtaField { get; set; }
    }

    /// <summary>
    /// Notification-center list projection. Large execution payloads are deliberately
    /// excluded so a single completed task cannot turn the list API or SignalR push
    /// into a multi-megabyte response.
    /// </summary>
    public class BackgroundTaskSummary
    {
        public string Id { get; set; }
        public string Title { get; set; }
        public string Type { get; set; }
        public string ApiEngineKey { get; set; }
        public string Status { get; set; }
        public string StatusText { get; set; }
        public int Progress { get; set; }
        public string ProgressMode { get; set; }
        public int Current { get; set; }
        public int Total { get; set; }
        public string Msg { get; set; }
        public DateTime CreateTime { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public DateTime? HeartbeatTime { get; set; }
        public DateTime? EstimatedEndTime { get; set; }
        public int? RemainingSeconds { get; set; }
        public string RemainingText { get; set; }
        public string EstimateConfidence { get; set; }
        public int ElapsedSeconds { get; set; }
        public string ElapsedText { get; set; }
        public bool CancelRequested { get; set; }
        public int AttemptCount { get; set; }
        public int MaxAttempts { get; set; }
        public int ExecutionCount { get; set; }
        public string BusinessTable { get; set; }
        public string BusinessId { get; set; }
        public bool HasLog { get; set; }
        public bool HasResult { get; set; }
    }

    /// <summary>Owner-scoped detail loaded only when a row is expanded or downloaded.</summary>
    public sealed class BackgroundTaskDetail : BackgroundTaskSummary
    {
        public string Log { get; set; }
        public JObject Result { get; set; }
        public string Error { get; set; }
    }

    internal sealed class TrustedBackgroundTaskExecutionContext
    {
        public string TaskId { get; set; }
        public string OwnerOsClient { get; set; }
        public string ApiEngineKey { get; set; }
        public long FencingToken { get; set; }
        public JObject TrustedCurrentUser { get; set; }
    }

    /// <summary>
    /// Durable background task façade. The tenant database is the source of truth;
    /// Redis only caches user projections and SignalR only transports notifications.
    /// </summary>
    public static class BackgroundTaskService
    {
        internal const string TargetExecutionOsClientParam = "_BackgroundTaskTargetOsClient";
        private const int MaxLogChars = 120000;
        private const int LeaseRenewalTransientFailureLimit = 3;
        private static readonly TimeSpan RenewalShutdownTimeout = TimeSpan.FromSeconds(5);
        private static readonly TimeSpan LeaseRenewalRetryDelay = TimeSpan.FromSeconds(5);
        private static readonly TimeSpan FailedLaneHintRetryDelay = TimeSpan.FromSeconds(1);
        private static readonly ConcurrentDictionary<string, ActiveExecution> ActiveExecutions =
            new ConcurrentDictionary<string, ActiveExecution>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, byte> ProjectionPruneInFlight =
            new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, NotificationRequest> PendingNotifications =
            new ConcurrentDictionary<string, NotificationRequest>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, byte> NotificationWorkers =
            new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        private static readonly BackgroundTaskWakeQueue WorkerWakeQueue =
            new BackgroundTaskWakeQueue();
        private static readonly string NodeId = BuildNodeId();
        private static int _claimFailureReported;
        private static int _workerParallelism;
        private static int _workerRunningCount;

        static BackgroundTaskService()
        {
            BackgroundTaskRuntime.UpdateProgressHandler = UpdateProgress;
            BackgroundTaskRuntime.AppendLogHandler = AppendLog;
            BackgroundTaskRuntime.IsCancellationRequestedHandler = IsCancellationRequested;
        }

        public static bool IsReservedNativeWorkerKey(string apiEngineKey)
        {
            return string.Equals(
                       apiEngineKey,
                       DiyLangBackgroundTaskService.WorkerApiEngineKey,
                       StringComparison.OrdinalIgnoreCase)
                   || string.Equals(
                       apiEngineKey,
                       DatabaseBackupService.WorkerApiEngineKey,
                       StringComparison.OrdinalIgnoreCase)
                   || AiImageBackgroundTaskService.IsImageWorker(apiEngineKey)
                   || AiMusicBackgroundTaskService.IsMusicWorker(apiEngineKey);
        }

        public static BackgroundTaskItem StartApiEngine(
            string osClient,
            string userKey,
            string title,
            JObject apiParam,
            JObject trustedCurrentUser)
        {
            return StartApiEngine(osClient, userKey, title, apiParam, trustedCurrentUser, null);
        }

        public static BackgroundTaskItem StartApiEngine(
            string osClient,
            string userKey,
            string title,
            JObject apiParam,
            JObject trustedCurrentUser,
            JObject options)
        {
            return StartApiEngineCore(
                osClient,
                userKey,
                title,
                apiParam,
                trustedCurrentUser,
                options,
                null);
        }

        internal static BackgroundTaskItem StartApiEngineForTargetTenant(
            string ownerOsClient,
            string targetOsClient,
            string userKey,
            string title,
            JObject apiParam,
            JObject trustedCurrentUser,
            JObject options)
        {
            targetOsClient = (targetOsClient ?? string.Empty).Trim();
            if (targetOsClient.DosIsNullOrWhiteSpace())
                throw new InvalidOperationException("目标子租户不能为空。");
            ChildTenantPlatformAppControlService.EnsureTargetExecutionAllowed(
                apiParam?["ApiEngineKey"]?.ToString(),
                ownerOsClient,
                targetOsClient);
            return StartApiEngineCore(
                ownerOsClient,
                userKey,
                title,
                apiParam,
                trustedCurrentUser,
                options,
                targetOsClient);
        }

        private static BackgroundTaskItem StartApiEngineCore(
            string osClient,
            string userKey,
            string title,
            JObject apiParam,
            JObject trustedCurrentUser,
            JObject options,
            string targetOsClient)
        {
            osClient = osClient ?? "";
            userKey = userKey ?? "";
            if (!BackgroundTaskStore.TryGetAvailability(osClient, out var unavailableReason))
            {
                throw new InvalidOperationException(
                    $"租户 {osClient} 尚未完成 mci_background_task 升级，后台任务未入队。"
                    + $"当前校验结果：{unavailableReason}。"
                    + "请先升级并重启最新版后端，由启动期幂等迁移修复该表；"
                    + "仅在后端自动升级被禁用时，才以前台方式安装“后台任务基础能力”。");
            }

            var param = apiParam == null ? new JObject() : (JObject)apiParam.DeepClone();
            // External callers can never select another tenant by smuggling the
            // reserved execution marker into RunBackground params. Only the
            // trusted control-plane overload above may add it after sanitization.
            param.Remove(TargetExecutionOsClientParam);
            if (!targetOsClient.DosIsNullOrWhiteSpace())
                param[TargetExecutionOsClientParam] = targetOsClient;
            if (param["_TraceParent"] == null && !MicroiTraceContext.CurrentTraceParent.DosIsNullOrWhiteSpace())
            {
                param["_TraceParent"] = MicroiTraceContext.CurrentTraceParent;
                if (!MicroiTraceContext.CurrentTraceState.DosIsNullOrWhiteSpace())
                    param["_TraceState"] = MicroiTraceContext.CurrentTraceState;
            }
            var apiEngineKey = param["ApiEngineKey"]?.ToString() ?? "";
            if (apiEngineKey.DosIsNullOrWhiteSpace())
                throw new InvalidOperationException("ApiEngineKey不能为空。");
            param.Remove("_CurrentUser");
            param.Remove("_BackgroundTaskOptions");

            options = options == null ? new JObject() : (JObject)options.DeepClone();
            var requestedIdempotencyKey = Limit(options["IdempotencyKey"]?.ToString(), 200);
            if (!requestedIdempotencyKey.DosIsNullOrWhiteSpace())
            {
                var existing = BackgroundTaskStore.FindByIdempotency(osClient, requestedIdempotencyKey);
                if (existing != null)
                {
                    CacheProjection(existing);
                    SignalWorkerIfPending(existing);
                    return ApplyRuntimeFields(existing);
                }
            }

            var id = Guid.NewGuid().ToString("N");
            var idempotencyKey = requestedIdempotencyKey.DosIsNullOrWhiteSpace()
                ? id
                : requestedIdempotencyKey;
            var concurrencyKey = Limit(options["ConcurrencyKey"]?.ToString(), 200);
            if (concurrencyKey.DosIsNullOrWhiteSpace()
                && (string.Equals(apiEngineKey, "import-microi-store-package", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(apiEngineKey, DatabaseBackupService.WorkerApiEngineKey, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(apiEngineKey, DiyLangBackgroundTaskService.WorkerApiEngineKey, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(apiEngineKey, EmptyDatabaseReleaseService.WorkerApiEngineKey, StringComparison.OrdinalIgnoreCase)))
            {
                concurrencyKey = apiEngineKey;
            }

            var trustedUser = CreateTrustedUserSnapshot(trustedCurrentUser);
            var item = new BackgroundTaskRecord
            {
                Id = id,
                OsClient = osClient,
                UserKey = userKey,
                Title = title.DosIsNullOrWhiteSpace() ? apiEngineKey : Limit(title, 500),
                Type = "ApiEngine",
                ApiEngineKey = apiEngineKey,
                Status = "Pending",
                StatusText = "排队中",
                Progress = 0,
                ProgressMode = "Indeterminate",
                Current = 0,
                Total = 0,
                Msg = "",
                Log = "",
                CreateTime = DateTime.Now,
                EstimateConfidence = "None",
                Result = new JObject(),
                ParamJson = param.ToString(Formatting.None),
                TrustedUserJson = trustedUser.ToString(Formatting.None),
                IdempotencyKey = idempotencyKey,
                ConcurrencyKey = concurrencyKey ?? "",
                MaxAttempts = Clamp(ParseInt(options["MaxAttempts"], 3), 1, 10),
                RetryOnFailure = IsTrue(options["RetryOnFailure"]) ? 1 : 0,
                BusinessTable = Limit(options["BusinessTable"]?.ToString(), 200),
                BusinessId = Limit(options["BusinessId"]?.ToString(), 200),
                BusinessStatusField = Limit(options["BusinessStatusField"]?.ToString(), 100),
                BusinessTaskIdField = Limit(options["BusinessTaskIdField"]?.ToString(), 100),
                BusinessProgressField = Limit(options["BusinessProgressField"]?.ToString(), 100),
                BusinessEtaField = Limit(options["BusinessEtaField"]?.ToString(), 100),
                RuntimeOsClientType = BackgroundTaskStore.CurrentRuntimeOsClientType(),
                RuntimeOsClientNetwork = BackgroundTaskStore.CurrentRuntimeOsClientNetwork()
            };
            try
            {
                BackgroundTaskStore.Insert(
                    item,
                    trustedUser["Id"]?.ToString() ?? userKey,
                    trustedUser["Name"]?.ToString() ?? trustedUser["Account"]?.ToString() ?? userKey);
            }
            catch when (!requestedIdempotencyKey.DosIsNullOrWhiteSpace())
            {
                // A concurrent node can win the tenant-scoped unique key between
                // read and insert. Readback makes the submission itself idempotent.
                var concurrent = BackgroundTaskStore.FindByIdempotency(osClient, requestedIdempotencyKey);
                if (concurrent != null)
                {
                    CacheProjection(concurrent);
                    SignalWorkerIfPending(concurrent);
                    return ApplyRuntimeFields(concurrent);
                }
                throw;
            }
            CacheProjection(item);
            QueueNotification(item);
            SignalWorker(item.OsClient, item.ApiEngineKey);
            return ApplyRuntimeFields(item);
        }

        public static List<BackgroundTaskItem> List(string osClient, string userKey)
        {
            try
            {
                if (BackgroundTaskStore.IsAvailable(osClient))
                {
                    return BackgroundTaskStore.List(osClient, userKey)
                        .Select(ApplyRuntimeFields)
                        .Cast<BackgroundTaskItem>()
                        .ToList();
                }
            }
            catch (Exception ex)
            {
                LogFailure(osClient, "DatabaseTaskListFailed", "读取数据库后台任务列表失败", ex, userKey);
            }
            return ListLegacyCache(osClient, userKey)
                .OrderByDescending(item => item.CreateTime)
                .Take(100)
                .Select(ApplyRuntimeFields)
                .ToList();
        }

        public static List<BackgroundTaskSummary> ListSummaries(
            string osClient,
            string userKey,
            int pageIndex,
            int pageSize,
            out int dataCount)
        {
            pageIndex = Math.Max(1, pageIndex);
            pageSize = Math.Max(1, Math.Min(100, pageSize));
            try
            {
                if (BackgroundTaskStore.IsAvailable(osClient))
                {
                    return BackgroundTaskStore.ListSummaries(
                        osClient,
                        userKey,
                        pageIndex,
                        pageSize,
                        out dataCount);
                }
            }
            catch (Exception ex)
            {
                LogFailure(osClient, "DatabaseTaskSummaryListFailed", "读取数据库后台任务摘要失败", ex, userKey);
            }

            var all = ListCachedSummaries(osClient, userKey)
                .OrderByDescending(item => item.CreateTime)
                .ToList();
            dataCount = all.Count;
            return all.Skip((pageIndex - 1) * pageSize)
                .Take(pageSize)
                .ToList();
        }

        public static BackgroundTaskDetail GetDetail(string osClient, string userKey, string taskId)
        {
            if (taskId.DosIsNullOrWhiteSpace()) return null;
            BackgroundTaskItem item = null;
            try
            {
                if (BackgroundTaskStore.IsAvailable(osClient))
                {
                    item = BackgroundTaskStore.GetForUser(osClient, userKey, taskId);
                }
            }
            catch (Exception ex)
            {
                LogFailure(osClient, "DatabaseTaskDetailFailed", "读取数据库后台任务详情失败", ex, userKey);
            }
            // Execution details are owner-scoped database reads. Redis only holds
            // summaries; never scan historical full-payload task hashes here.
            if (item == null) return null;
            var detail = JObject.FromObject(ToSummary(item)).ToObject<BackgroundTaskDetail>()
                         ?? new BackgroundTaskDetail { Id = item.Id };
            detail.Log = item.Log ?? "";
            detail.Result = item.Result ?? new JObject();
            detail.Error = item is BackgroundTaskRecord record ? record.LastError ?? "" : "";
            return detail;
        }

        public static BackgroundTaskSummary GetSummary(string osClient, string userKey, string taskId)
        {
            if (taskId.DosIsNullOrWhiteSpace()) return null;
            try
            {
                if (BackgroundTaskStore.IsAvailable(osClient))
                    return BackgroundTaskStore.GetSummaryForUser(osClient, userKey, taskId);
            }
            catch (Exception ex)
            {
                LogFailure(osClient, "DatabaseTaskStatusFailed", "读取数据库后台任务状态失败", ex, userKey);
            }
            var item = ListCachedSummaries(osClient, userKey)
                .FirstOrDefault(value => string.Equals(value.Id, taskId, StringComparison.OrdinalIgnoreCase));
            return item;
        }

        public static int ClearCompleted(string osClient, string userKey)
        {
            if (!BackgroundTaskStore.IsAvailable(osClient)) return 0;
            var count = BackgroundTaskStore.ClearSucceeded(osClient, userKey);
            if (count > 0) RemoveLegacyCompleted(osClient, userKey, true, null);
            return count;
        }

        public static bool Remove(string osClient, string userKey, string taskId)
        {
            if (taskId.DosIsNullOrWhiteSpace() || !BackgroundTaskStore.IsAvailable(osClient)) return false;
            var removed = BackgroundTaskStore.SoftDelete(osClient, userKey, taskId) == 1;
            if (removed) DeleteProjection(osClient, userKey, taskId);
            return removed;
        }

        public static bool Cancel(string osClient, string userKey, string taskId)
        {
            if (taskId.DosIsNullOrWhiteSpace() || !BackgroundTaskStore.IsAvailable(osClient)) return false;
            var updated = BackgroundTaskStore.RequestCancel(osClient, userKey, taskId) == 1;
            if (!updated) return false;
            if (ActiveExecutions.TryGetValue(taskId, out var active))
            {
                active.UserCancellationRequested = true;
                try { active.Cancellation.Cancel(); } catch { }
            }
            var item = BackgroundTaskStore.Get(osClient, taskId);
            if (item != null)
            {
                CacheProjection(item);
                QueueNotification(item);
            }
            return true;
        }

        public static bool UpdateProgress(string taskId, int? progress, string msg, int? current, int? total)
        {
            if (taskId.DosIsNullOrWhiteSpace()
                || !ActiveExecutions.TryGetValue(taskId, out var active)
                || active.Cancellation.IsCancellationRequested)
            {
                return false;
            }

            lock (active.SyncRoot)
            {
                var item = active.Record;
                var now = DateTime.Now;
                var nextCurrent = current.HasValue ? Math.Max(0, current.Value) : item.Current;
                var nextTotal = total.HasValue && total.Value > 0 ? total.Value : item.Total;
                nextCurrent = BackgroundTaskProgress.PreserveMonotonicCurrent(
                    item.Current,
                    item.Total,
                    nextCurrent,
                    nextTotal);
                var estimate = BackgroundTaskProgress.Calculate(
                    now,
                    item.StartTime ?? now,
                    nextCurrent,
                    nextTotal,
                    progress,
                    item.ProgressSampleTime,
                    item.ProgressSampleCurrent,
                    item.ThroughputPerSecond,
                    item.ProgressSampleCount,
                    item.Progress);

                item.Current = nextCurrent;
                item.Total = nextTotal;
                item.Progress = estimate.Progress;
                item.ProgressMode = estimate.ProgressMode;
                item.ThroughputPerSecond = estimate.ThroughputPerSecond;
                item.ProgressSampleCount = estimate.SampleCount;
                item.RemainingSeconds = estimate.RemainingSeconds;
                item.EstimatedEndTime = estimate.EstimatedEndTime;
                item.EstimateConfidence = estimate.EstimateConfidence;
                item.ProgressSampleTime = now;
                item.ProgressSampleCurrent = nextCurrent;
                item.HeartbeatTime = now;
                if (!msg.DosIsNullOrWhiteSpace()) item.Msg = Limit(msg, 2000);
                item.StatusText = item.Msg.Contains("排队") || item.Msg.Contains("等待") ? "执行中（等待依赖）" : "执行中";
                if (!BackgroundTaskStore.UpdateProgress(item)) return false;
                CacheProjection(item);
                QueueNotification(item);
                return true;
            }
        }

        public static bool AppendLog(string taskId, string message)
        {
            if (taskId.DosIsNullOrWhiteSpace()
                || message.DosIsNullOrWhiteSpace()
                || !ActiveExecutions.TryGetValue(taskId, out var active))
            {
                return false;
            }
            lock (active.SyncRoot)
            {
                var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message.Trim()}";
                var combined = active.Record.Log.DosIsNullOrWhiteSpace()
                    ? line
                    : active.Record.Log + Environment.NewLine + line;
                active.Record.Log = combined.Length <= MaxLogChars
                    ? combined
                    : "[较早日志已截断]" + Environment.NewLine + combined.Substring(combined.Length - MaxLogChars);
                if (!BackgroundTaskStore.UpdateLog(active.Record)) return false;
                CacheProjection(active.Record);
                QueueNotification(active.Record);
                return true;
            }
        }

        public static bool IsCurrentExecutionOwner(string taskId, long fencingToken)
        {
            if (taskId.DosIsNullOrWhiteSpace()
                || !ActiveExecutions.TryGetValue(taskId, out var active)
                || active.Cancellation.IsCancellationRequested
                || active.LeaseLost
                || active.Record.FencingToken != fencingToken)
            {
                return false;
            }
            return BackgroundTaskStore.IsLeaseCurrent(
                active.Record.OsClient,
                taskId,
                active.Record.LeaseOwner,
                fencingToken);
        }

        internal static bool TryGetCurrentExecutionContext(
            string taskId,
            long fencingToken,
            string expectedApiEngineKey,
            out TrustedBackgroundTaskExecutionContext context)
        {
            context = null;
            if (taskId.DosIsNullOrWhiteSpace()
                || expectedApiEngineKey.DosIsNullOrWhiteSpace()
                || !ActiveExecutions.TryGetValue(taskId, out var active)
                || active.Cancellation.IsCancellationRequested
                || active.LeaseLost
                || active.Record.FencingToken != fencingToken
                || !string.Equals(
                    active.Record.ApiEngineKey,
                    expectedApiEngineKey,
                    StringComparison.Ordinal))
            {
                return false;
            }
            if (!BackgroundTaskStore.IsLeaseCurrent(
                    active.Record.OsClient,
                    taskId,
                    active.Record.LeaseOwner,
                    fencingToken))
            {
                return false;
            }
            context = new TrustedBackgroundTaskExecutionContext
            {
                TaskId = active.Record.Id,
                OwnerOsClient = active.Record.OsClient,
                ApiEngineKey = active.Record.ApiEngineKey,
                FencingToken = active.Record.FencingToken,
                TrustedCurrentUser = ParseObject(active.Record.TrustedUserJson)
            };
            return true;
        }

        public static async Task RunWorkerLoopAsync(
            CancellationToken stoppingToken,
            Action heartbeat = null)
        {
            var configuredParallelism = ConfigHelper.GetRuntimeConfigurationInt(
                "BackgroundTasks:MaxParallelTasks",
                4);
            var parallelism = Clamp(
                configuredParallelism,
                BackgroundTaskSchedulingPolicy.MinimumWorkerParallelism,
                16);
            if (configuredParallelism < BackgroundTaskSchedulingPolicy.MinimumWorkerParallelism)
            {
                Console.WriteLine(
                    $"Microi：【后台任务隔离】MaxParallelTasks={configuredParallelism} 无法同时保留业务与维护槽，"
                    + $"当前节点已提升为最小值 {BackgroundTaskSchedulingPolicy.MinimumWorkerParallelism}。");
            }
            Volatile.Write(ref _workerParallelism, parallelism);
            var configuredTenant = OsClientExtend.GetConfigOsClient();
            if (configuredTenant.DosIsNullOrWhiteSpace()) configuredTenant = OsClientDefault.OsClient;
            // A restart loses process-local hints but not durable rows. Give every
            // loaded tenant one coalesced fast recovery turn immediately instead of
            // making pending work wait behind fallback polling rounds.
            foreach (var tenant in new[] { configuredTenant }
                         .Concat(OsClientExtend.ClientList.Keys)
                         .Where(tenant => !tenant.DosIsNullOrWhiteSpace())
                         .Distinct(StringComparer.OrdinalIgnoreCase))
            {
                SignalTenantRecovery(tenant);
            }
            var running = new List<WorkerSlot>();
            var hintsSinceCompletedRecovery = 0;
            var nextForcedRecoveryScanUtc = DateTime.UtcNow.Add(
                BackgroundTaskSchedulingPolicy.ForcedRecoveryScanInterval);
            while (!stoppingToken.IsCancellationRequested)
            {
                // This callback is diagnostic state only. The durable task table,
                // leases and fencing tokens remain the shared source of truth.
                // Never let observability code terminate the worker loop.
                try { heartbeat?.Invoke(); } catch { }

                foreach (var completedSlot in running
                             .Where(slot => slot.Execution.IsCompleted)
                             .ToList())
                {
                    running.Remove(completedSlot);
                    try { await completedSlot.Execution.ConfigureAwait(false); }
                    catch (Exception ex) { LogFailure("", "WorkerTaskFailed", "后台任务工作器出现未处理异常", ex, NodeId); }
                    finally
                    {
                        // One process-local hint represents one logical
                        // (tenant, task-type) queue turn. Re-enqueue only after the
                        // active turn ends, so a hot lane cannot occupy every slot.
                        SignalWorker(completedSlot.OsClient, completedSlot.ApiEngineKey);
                    }
                }
                Volatile.Write(ref _workerRunningCount, running.Count);

                while (running.Count < parallelism && !stoppingToken.IsCancellationRequested)
                {
                    BackgroundTaskRecord item;
                    var hadQueueHint = WorkerWakeQueue.TryTake(out var queueHint);
                    var hintAdmissible = hadQueueHint
                                         && (queueHint.IsTenantRecovery
                                             || BackgroundTaskSchedulingPolicy.CanAdmit(
                                                 queueHint.OsClient,
                                                 queueHint.ApiEngineKey,
                                                 running,
                                                 parallelism));
                    var forceRecoveryScan = hintAdmissible
                                            && !queueHint.IsTenantRecovery
                                            && BackgroundTaskSchedulingPolicy.ShouldForceRecoveryScan(
                                                hintsSinceCompletedRecovery,
                                                DateTime.UtcNow,
                                                nextForcedRecoveryScanUtc);
                    var forceTenantRecovery = hintAdmissible
                                              && queueHint.IsTenantRecovery
                                              && BackgroundTaskSchedulingPolicy.ShouldForceRecoveryScan(
                                                  hintsSinceCompletedRecovery,
                                                  DateTime.UtcNow,
                                                  nextForcedRecoveryScanUtc);
                    var claimingHint = hintAdmissible && !forceRecoveryScan;
                    if (forceRecoveryScan)
                    {
                        // Put the hot lane at the tail, then make one bounded DB
                        // recovery pass while excluding that lane. This prevents
                        // process-local hints from starving persisted work that was
                        // recovered after a restart or inserted by another node.
                        SignalWorker(queueHint.OsClient, queueHint.ApiEngineKey);
                    }
                    else if (hadQueueHint
                             && !hintAdmissible
                             && !queueHint.IsTenantRecovery
                             && !BackgroundTaskSchedulingPolicy.IsLaneActive(
                                 queueHint.OsClient,
                                 queueHint.ApiEngineKey,
                                 running))
                    {
                        // A different maintenance lane currently owns the single
                        // maintenance slot. Preserve this hint without a busy loop.
                        ScheduleWorkerWake(
                            queueHint.OsClient,
                            queueHint.ApiEngineKey,
                            FailedLaneHintRetryDelay);
                    }
                    BackgroundTaskWorkerRuntime.MarkPendingWakeLaneCount(
                        WorkerWakeQueue.PendingLaneCount);
                    var recoveryAttemptCompleted = false;
                    try
                    {
                        item = null;
                        if (claimingHint)
                        {
                            var recoveryYielded = false;
                            item = BackgroundTaskStore.TryClaimTenant(
                                queueHint.OsClient,
                                NodeId,
                                AiMusicBackgroundTaskService.ExcludeUnsupportedWorkers(AiImageBackgroundTaskService.ExcludeUnsupportedWorkers(BackgroundTaskSchedulingPolicy.ExcludedApiEngineKeys(
                                    queueHint.OsClient,
                                    running,
                                    parallelism), MicroiEngine.TryGetService<IAiImageTaskRuntime>() != null), MicroiEngine.TryGetService<IAiMusicTaskRuntime>() != null),
                                queueHint.IsTenantRecovery ? null
                                    : BackgroundTaskSchedulingPolicy.RequiredApiEngineKeyForWakeHint(queueHint.ApiEngineKey),
                                false,
                                () =>
                                {
                                    try { heartbeat?.Invoke(); } catch { }
                                    recoveryYielded = queueHint.IsTenantRecovery
                                                      && !forceTenantRecovery
                                                      && WorkerWakeQueue.HasPendingTaskLane;
                                    return recoveryYielded;
                                });
                            if (recoveryYielded)
                            {
                                // A startup/recovery hint is lower priority than a
                                // newly enqueued lane. Preserve it at the tail so
                                // persisted work is still revisited after the fast path.
                                SignalTenantRecovery(queueHint.OsClient);
                            }
                            else if (queueHint.IsTenantRecovery)
                            {
                                recoveryAttemptCompleted = true;
                            }
                            else if (item != null && !string.Equals(
                                         item.ApiEngineKey, queueHint.ApiEngineKey, StringComparison.OrdinalIgnoreCase))
                            {
                                // A different ready maintenance kind won the fair
                                // claim. Preserve the original hint for its next turn.
                                SignalWorker(queueHint.OsClient, queueHint.ApiEngineKey);
                            }
                        }
                        else
                        {
                            var genericRecoveryYielded = false;
                            item = BackgroundTaskStore.TryClaimNext(
                                NodeId,
                                tenant =>
                                {
                                    var excluded = new HashSet<string>(
                                        AiMusicBackgroundTaskService.ExcludeUnsupportedWorkers(AiImageBackgroundTaskService.ExcludeUnsupportedWorkers(BackgroundTaskSchedulingPolicy.ExcludedApiEngineKeys(
                                            tenant,
                                            running,
                                            parallelism), MicroiEngine.TryGetService<IAiImageTaskRuntime>() != null), MicroiEngine.TryGetService<IAiMusicTaskRuntime>() != null),
                                        StringComparer.OrdinalIgnoreCase);
                                    if (forceRecoveryScan
                                        && string.Equals(
                                            tenant,
                                            queueHint.OsClient,
                                            StringComparison.OrdinalIgnoreCase))
                                    {
                                        excluded.Add(queueHint.ApiEngineKey);
                                    }
                                    return excluded.ToArray();
                                },
                                () =>
                                {
                                    try { heartbeat?.Invoke(); } catch { }
                                    // Once per bounded hot-hint window, complete one
                                    // single-tenant recovery pass even when other
                                    // lanes keep arriving. Otherwise A/B/A/B traffic
                                    // could starve durable rows that lost their hint.
                                    genericRecoveryYielded = !forceRecoveryScan
                                                             && WorkerWakeQueue.HasPendingTaskLane;
                                    return genericRecoveryYielded;
                                },
                                tenantScanBatchSize: forceRecoveryScan
                                    ? 1
                                    : BackgroundTaskStore.TenantScanBatchSize,
                                runMaintenance: !forceRecoveryScan);
                            recoveryAttemptCompleted = !genericRecoveryYielded;
                        }
                    }
                    catch (Exception ex)
                    {
                        if (claimingHint)
                        {
                            ScheduleWorkerWake(
                                queueHint.OsClient,
                                queueHint.ApiEngineKey,
                                FailedLaneHintRetryDelay);
                        }
                        LogFailure("", "WorkerClaimFailed", "后台任务抢占失败", ex, NodeId);
                        if (Interlocked.CompareExchange(ref _claimFailureReported, 1, 0) == 0)
                        {
                            Console.WriteLine(
                                $"Microi：【Error异常】主租户[{OsClientDefault.OsClient}]后台任务抢占失败：{ex.Message}");
                        }
                        item = null;
                    }
                    if (recoveryAttemptCompleted)
                    {
                        hintsSinceCompletedRecovery = 0;
                        nextForcedRecoveryScanUtc =
                            DateTime.UtcNow.Add(
                                BackgroundTaskSchedulingPolicy.ForcedRecoveryScanInterval);
                    }
                    else if (claimingHint && item != null && !queueHint.IsTenantRecovery)
                    {
                        if (hintsSinceCompletedRecovery == 0)
                        {
                            nextForcedRecoveryScanUtc =
                                DateTime.UtcNow.Add(
                                    BackgroundTaskSchedulingPolicy.ForcedRecoveryScanInterval);
                        }
                        hintsSinceCompletedRecovery++;
                    }
                    if (item == null) break;
                    Interlocked.Exchange(ref _claimFailureReported, 0);
                    running.Add(new WorkerSlot
                    {
                        // Isolate the synchronous prefix as well. Some platform
                        // maintenance handlers perform Redis/bootstrap/database work
                        // before their first incomplete await; executing that prefix
                        // on the dispatcher would prevent otherwise-free business
                        // lanes from being claimed.
                        Execution = Task.Run(
                            () => ProcessClaimedAsync(item, stoppingToken),
                            CancellationToken.None),
                        OsClient = item.OsClient ?? "",
                        ApiEngineKey = item.ApiEngineKey ?? ""
                    });
                    Volatile.Write(ref _workerRunningCount, running.Count);
                }

                if (running.Count < parallelism && WorkerWakeQueue.HasPending) continue;
                if (running.Count == 0)
                {
                    hintsSinceCompletedRecovery = 0;
                    nextForcedRecoveryScanUtc =
                        DateTime.UtcNow.Add(
                            BackgroundTaskSchedulingPolicy.ForcedRecoveryScanInterval);
                    try
                    {
                        await WorkerWakeQueue.WaitAsync(
                                TimeSpan.FromMilliseconds(1500),
                                stoppingToken)
                            .ConfigureAwait(false);
                    }
                    catch (OperationCanceledException) { break; }
                }
                else
                {
                    var delay = Task.Delay(1000, stoppingToken);
                    try
                    {
                        await Task.WhenAny(
                                running.Select(slot => slot.Execution).Append(delay))
                            .ConfigureAwait(false);
                    }
                    catch (OperationCanceledException) { break; }
                }
            }

            foreach (var active in ActiveExecutions.Values)
            {
                try { active.Cancellation.Cancel(); } catch { }
            }
            if (running.Count > 0)
            {
                await Task.WhenAny(
                        Task.WhenAll(running.Select(slot => slot.Execution)),
                        Task.Delay(TimeSpan.FromSeconds(30)))
                    .ConfigureAwait(false);
            }
            Volatile.Write(ref _workerRunningCount, 0);
        }

        private static void SignalWorker(string osClient, string apiEngineKey)
        {
            WorkerWakeQueue.Signal(osClient, apiEngineKey);
            BackgroundTaskWorkerRuntime.MarkWakeSignal(
                osClient,
                apiEngineKey,
                WorkerWakeQueue.PendingLaneCount);
        }

        private static void SignalTenantRecovery(string osClient)
        {
            WorkerWakeQueue.SignalTenantRecovery(osClient);
            BackgroundTaskWorkerRuntime.MarkWakeSignal(
                osClient,
                "",
                WorkerWakeQueue.PendingLaneCount);
        }

        private static void SignalWorkerIfPending(BackgroundTaskRecord item)
        {
            if (item == null || item.CancelRequested) return;
            if (!string.Equals(item.Status, "Pending", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(item.Status, "Retrying", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
            ScheduleWorkerWake(item);
        }

        private static void ScheduleWorkerWake(BackgroundTaskRecord item)
        {
            if (item == null || item.CancelRequested || item.OsClient.DosIsNullOrWhiteSpace()) return;
            var delay = item.NextRunTime.HasValue
                ? item.NextRunTime.Value - DateTime.Now
                : TimeSpan.Zero;
            if (delay <= TimeSpan.FromMilliseconds(25))
            {
                SignalWorker(item.OsClient, item.ApiEngineKey);
                return;
            }
            ScheduleWorkerWake(item.OsClient, item.ApiEngineKey, delay);
        }

        private static void ScheduleWorkerWake(
            string osClient,
            string apiEngineKey,
            TimeSpan delay)
        {
            if (osClient.DosIsNullOrWhiteSpace()) return;
            if (delay <= TimeSpan.FromMilliseconds(25))
            {
                SignalWorker(osClient, apiEngineKey);
                return;
            }
            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(delay).ConfigureAwait(false);
                    SignalWorker(osClient, apiEngineKey);
                }
                catch
                {
                    // This is an acceleration hint only. The durable recovery scan
                    // remains authoritative if a process is stopping or a timer is lost.
                }
            });
        }

        /// <summary>
        /// Returns a side-effect-free readiness probe for the configured tenant.
        /// It deliberately validates the full worker projection so a half-applied
        /// mci_background_task schema cannot look healthy.
        /// </summary>
        public static JObject GetWorkerReadiness()
        {
            var osClient = OsClientExtend.GetConfigOsClient();
            if (osClient.DosIsNullOrWhiteSpace()) osClient = OsClientDefault.OsClient;
            var available = BackgroundTaskStore.TryGetAvailability(osClient, out var reason);
            var activeTasks = ActiveExecutions.Values
                .Select(active => new
                {
                    active.Record.Id,
                    active.Record.OsClient,
                    active.Record.ApiEngineKey,
                    active.Record.Status,
                    active.Record.Progress,
                    active.Record.ProgressMode,
                    active.Record.Current,
                    active.Record.Total,
                    active.Record.Msg,
                    active.Record.StartTime,
                    active.Record.HeartbeatTime,
                    active.Record.LeaseExpiresAt,
                    active.Record.FencingToken,
                    active.Record.AttemptCount,
                    active.Record.MaxAttempts,
                    active.Record.ExecutionCount,
                    active.Record.LastError,
                    active.Record.ConcurrencyKey,
                    active.LeaseLost,
                    CancellationRequested = active.Cancellation.IsCancellationRequested
                })
                .OrderBy(active => active.OsClient, StringComparer.OrdinalIgnoreCase)
                .ThenBy(active => active.StartTime)
                .Take(32)
                .ToArray();
            return JObject.FromObject(new
            {
                OsClient = osClient ?? "",
                RuntimeOsClientType = BackgroundTaskStore.CurrentRuntimeOsClientType(),
                RuntimeOsClientNetwork = BackgroundTaskStore.CurrentRuntimeOsClientNetwork(),
                SchemaReady = available,
                Reason = reason ?? "",
                MaxParallelTaskCount = Volatile.Read(ref _workerParallelism),
                MinimumWorkerParallelism = BackgroundTaskSchedulingPolicy.MinimumWorkerParallelism,
                LogicalQueueScope = "OsClient+ApiEngineKey",
                MandatoryCrossNodeLaneLease = true,
                PlatformMaintenanceParallelTaskCount =
                    BackgroundTaskSchedulingPolicy.MaxPlatformMaintenanceParallelism(
                        Volatile.Read(ref _workerParallelism)),
                ConfiguredTenant = osClient ?? "",
                ReservedConfiguredTenantSlotCount = 0,
                ReservedNonDiyLangSlotCount = Math.Max(0, Volatile.Read(ref _workerParallelism) - 1),
                ReservedBusinessSlotCount = Math.Max(
                    0,
                    Math.Min(
                        Volatile.Read(ref _workerParallelism),
                        BackgroundTaskSchedulingPolicy.ReservedBusinessParallelism)),
                RunningSlotCount = Volatile.Read(ref _workerRunningCount),
                ActiveExecutionCount = ActiveExecutions.Count,
                ActiveTasks = activeTasks
            });
        }

        public static async Task SendTaskListToUserAsync(string osClient, string userKey)
        {
            await SendTaskListToUserAsync(
                    osClient,
                    userKey,
                    BackgroundTaskStore.CurrentRuntimeOsClientType(),
                    BackgroundTaskStore.CurrentRuntimeOsClientNetwork())
                .ConfigureAwait(false);
        }

        private static async Task SendTaskListToUserAsync(
            string osClient,
            string userKey,
            string runtimeOsClientType,
            string runtimeOsClientNetwork)
        {
            if (!RealtimePushRuntime.IsConfigured || osClient.DosIsNullOrWhiteSpace() || userKey.DosIsNullOrWhiteSpace()) return;
            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var clientInfo = await cache.GetAsync<ClientInfo>(GetScopedChatOnlineKey(
                        osClient, userKey, runtimeOsClientType, runtimeOsClientNetwork))
                    .ConfigureAwait(false);
                if (clientInfo?.ConnectionIds == null || !clientInfo.ConnectionIds.Any()) return;
                // Every task mutation writes the bounded Redis projection before it queues
                // a notification. Re-reading the authoritative table for each progress
                // push turned active jobs into a database polling loop. Transport the
                // fresh projection and keep the controller List endpoint as the explicit
                // authoritative reconciliation path.
                var projected = ListCachedSummaries(osClient, userKey)
                    .OrderByDescending(item => item.CreateTime)
                    .Take(15)
                    .ToList();
                await RealtimePushRuntime.SendAsync(
                        clientInfo.ConnectionIds,
                        "ReceiveBackgroundTaskList",
                        projected.Count > 0
                            ? projected
                            : ListSummaries(osClient, userKey, 1, 15, out _))
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                LogFailure(osClient, "RealtimePushFailed", "后台任务列表实时推送失败", ex, userKey);
            }
        }

        private static async Task ProcessClaimedAsync(BackgroundTaskRecord item, CancellationToken stoppingToken)
        {
            string executionOsClient;
            try
            {
                executionOsClient = ResolveExecutionOsClient(item);
            }
            catch (Exception ex)
            {
                BackgroundTaskStore.RetryOrFail(item, ex, false);
                SignalWorkerIfPending(item);
                return;
            }
            BackgroundTaskConcurrencyLease laneLease = null;
            BackgroundTaskConcurrencyLease concurrencyLease = null;
            try
            {
                // Mandatory, server-derived lane lease: optional business
                // ConcurrencyKey values can further serialize work, but can never
                // split one (tenant, task-type) queue across nodes.
                laneLease = BackgroundTaskConcurrencyLease.TryAcquire(
                    item.OsClient,
                    BackgroundTaskSchedulingPolicy.LaneConcurrencyKey(item.ApiEngineKey),
                    item.LeaseOwner,
                    item.RuntimeOsClientType,
                    item.RuntimeOsClientNetwork,
                    BackgroundTaskStore.ResolveLeaseSeconds(item.ApiEngineKey) * 1000,
                    "LaneV1");
                if (laneLease == null)
                {
                    BackgroundTaskStore.ReleaseToPending(item, "等待同一任务类型队列的上一项任务完成", 1);
                    SignalWorkerIfPending(item);
                    return;
                }

                if (!item.ConcurrencyKey.DosIsNullOrWhiteSpace())
                {
                    var concurrencyLeaseOsClient = executionOsClient;
                    var concurrencyLeaseKey = item.ConcurrencyKey;
                    if (string.Equals(
                            item.ApiEngineKey,
                            DiyLangBackgroundTaskService.WorkerApiEngineKey,
                            StringComparison.OrdinalIgnoreCase))
                    {
                        // Tenant task tables remain the durable source of truth, but
                        // all language jobs coordinate through the configured
                        // tenant's Redis. This serializes maintenance across tenants
                        // and nodes instead of merely within one tenant database.
                        concurrencyLeaseOsClient = OsClientExtend.GetConfigOsClient();
                        if (concurrencyLeaseOsClient.DosIsNullOrWhiteSpace())
                            concurrencyLeaseOsClient = OsClientDefault.OsClient;
                        concurrencyLeaseKey = DiyLangBackgroundTaskService.ClusterConcurrencyKey;
                    }
                    else if (string.Equals(
                                 item.ApiEngineKey,
                                 ChildTenantPlatformAppControlService.ChildWorkerApiEngineKey,
                                 StringComparison.OrdinalIgnoreCase))
                    {
                        // Child tenants can share one physical schema. Tenant-scoped
                        // leases would still allow concurrent DDL and metadata writes
                        // against that shared database, causing avoidable deadlocks.
                        // Queue every tenant task up-front for observability, but
                        // serialize the installer through the configured tenant Redis.
                        concurrencyLeaseOsClient = OsClientExtend.GetConfigOsClient();
                        if (concurrencyLeaseOsClient.DosIsNullOrWhiteSpace())
                            concurrencyLeaseOsClient = OsClientDefault.OsClient;
                        concurrencyLeaseKey =
                            ChildTenantPlatformAppControlService.ClusterConcurrencyKey;
                    }
                    concurrencyLease = BackgroundTaskConcurrencyLease.TryAcquire(
                        concurrencyLeaseOsClient,
                        concurrencyLeaseKey,
                        item.LeaseOwner,
                        item.RuntimeOsClientType,
                        item.RuntimeOsClientNetwork,
                        BackgroundTaskStore.ResolveLeaseSeconds(item.ApiEngineKey) * 1000);
                    if (concurrencyLease == null)
                    {
                        BackgroundTaskStore.ReleaseToPending(item, "等待同一并发组的上一项任务完成", 2);
                        SignalWorkerIfPending(item);
                        laneLease.Dispose();
                        return;
                    }
                }
            }
            catch (Exception ex)
            {
                try { concurrencyLease?.Dispose(); } catch { }
                try { laneLease?.Dispose(); } catch { }
                BackgroundTaskStore.ReleaseToPending(item, ex.Message, 5);
                SignalWorkerIfPending(item);
                LogFailure(item.OsClient, "ConcurrencyLeaseFailed", "后台任务队列或并发租约获取失败", ex, item.Id);
                return;
            }

            using (laneLease)
            using (concurrencyLease)
            using (var cancellation = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken))
            {
                var active = new ActiveExecution(item, cancellation);
                var traceParam = ParseObject(item.ParamJson);
                var activity = MicroiTraceContext.StartActivity(
                    "Microi.BackgroundTask " + (item.ApiEngineKey ?? "Worker"),
                    traceParam["_TraceParent"]?.ToString(),
                    traceParam["_TraceState"]?.ToString(),
                    new Dictionary<string, object>
                    {
                        ["microi.os_client"] = executionOsClient ?? "",
                        ["microi.background_task_owner_os_client"] = item.OsClient ?? "",
                        ["microi.background_task_id"] = item.Id ?? "",
                        ["microi.api_engine_key"] = item.ApiEngineKey ?? "",
                        ["microi.fencing_token"] = item.FencingToken
                    });
                ActiveExecutions[item.Id] = active;
                CacheProjection(item);
                QueueNotification(item);
                var renewal = RenewLoopAsync(active, laneLease, concurrencyLease, stoppingToken);
                try
                {
                    var param = ParseObject(item.ParamJson);
                    var trustedUser = ParseObject(item.TrustedUserJson);
                    if (ChildTenantPlatformAppControlService.RequiresTargetExecutionBootstrap(
                            item.ApiEngineKey,
                            item.OsClient,
                            executionOsClient,
                            param[TargetExecutionOsClientParam]?.ToString()))
                    {
                        // CHILD_TENANT_EXECUTION_BOOTSTRAP_V1：已排队的主→子任务在
                        // 运行目标租户 V8 前刷新官方安装器，使平台修复接管原检查点。
                        // CHILD_TENANT_EXECUTION_BOOTSTRAP_SCOPE_V1：只有服务端控制面
                        // 持久化了目标租户标记的主→子任务才执行跨租户自愈。普通租户
                        // 自己发起“全部安装/更新”时 owner==execution 且没有该保留标记，
                        // 必须让批量计划先安装/更新应用商城，不能从旧租户自己复制旧工作器。
                        var bootstrap = ChildTenantPlatformAppControlService.EnsureTargetExecutionBootstrap(
                            item.OsClient,
                            executionOsClient,
                            trustedUser);
                        if (bootstrap?.Code != 1)
                        {
                            throw new InvalidOperationException(
                                "子租户商城工作器执行前自愈失败：" + (bootstrap?.Msg ?? "无返回"));
                        }
                    }
                    param["ApiEngineKey"] = item.ApiEngineKey;
                    param["_BackgroundTaskId"] = item.Id;
                    param["_BackgroundTaskTitle"] = item.Title ?? "";
                    param["_BackgroundTaskIdempotencyKey"] = item.IdempotencyKey ?? item.Id;
                    param["_BackgroundTaskFencingToken"] = item.FencingToken;
                    param["_BackgroundTaskAttempt"] = item.AttemptCount + 1;
                    param["OsClient"] = executionOsClient;
                    param["_InvokeType"] = "Client";
                    // 后台任务由服务端持久队列恢复可信用户快照后执行，不是外部 HTTP
                    // 调用。保留 Client 业务语义，同时用独立 provenance 标记允许调用
                    // StopHttp=1 的内部 worker；HTTP 控制器会主动剥离该标记。
                    param["_TrustedServerInvocation"] = true;
                    param.Remove("_CurrentUser");
                    param["_BackgroundTask"] = JObject.FromObject(new
                    {
                        item.Id,
                        item.IdempotencyKey,
                        item.FencingToken,
                        item.BusinessTable,
                        item.BusinessId,
                        item.BusinessStatusField,
                        item.BusinessTaskIdField,
                        item.BusinessProgressField,
                        item.BusinessEtaField,
                        item.LeaseOwner,
                        item.Progress,
                        item.Current,
                        item.Total
                    });

                    dynamic rawResult;
                    if (string.Equals(item.ApiEngineKey, DiyLangBackgroundTaskService.WorkerApiEngineKey,
                            StringComparison.OrdinalIgnoreCase))
                    {
                        // diy_lang synchronization is platform-native work. The
                        // durable envelope owns leases, fencing, retries and recovery;
                        // FormEngine remains the synchronization implementation.
                        rawResult = await DiyLangBackgroundTaskService.RunAsync(
                                item.Id,
                                item.FencingToken,
                                param,
                                trustedUser,
                                cancellation.Token)
                            .ConfigureAwait(false);
                    }
                    else if (string.Equals(item.ApiEngineKey, DatabaseBackupService.WorkerApiEngineKey,
                            StringComparison.OrdinalIgnoreCase))
                    {
                        // Database backup is a platform capability, not tenant V8
                        // source. Keeping the durable task envelope while executing
                        // native code removes the historic dependency on an app-store
                        // worker engine that may be missing or version-skewed.
                        var selectedTenants = param["TenantOsClients"] is JArray tenantArray
                            ? tenantArray.Select(token => token?.ToString())
                                .Where(value => !value.DosIsNullOrWhiteSpace())
                                .Distinct(StringComparer.OrdinalIgnoreCase)
                                .ToArray()
                            : null;
                        rawResult = new DatabaseBackupService(item.Id, item.FencingToken).Run(
                            trustedUser,
                            item.OsClient,
                            param["TriggerType"]?.ToString() ?? "Manual",
                            ParseInt(param["RetainCount"], 7),
                            selectedTenants);
                    }
                    else if (AiMusicBackgroundTaskService.IsMusicWorker(item.ApiEngineKey))
                    {
                        var runtime = MicroiEngine.TryGetService<IAiMusicTaskRuntime>();
                        if (runtime == null) throw new InvalidOperationException("当前节点缺少 AI 音乐持久任务运行时，请完整更新平台后端。");
                        rawResult = await runtime.RunAsync(item.Id, item.FencingToken, item.OsClient,
                            trustedUser, param, cancellation.Token).ConfigureAwait(false);
                    }
                    else if (AiImageBackgroundTaskService.IsImageWorker(item.ApiEngineKey))
                    {
                        // 原生图片任务由持久队列提供可信身份与生命周期；不能通过租户
                        // 创建同名接口引擎替换供应商密钥隔离和生成幂等原子。
                        var runtime = MicroiEngine.TryGetService<IAiImageTaskRuntime>();
                        if (runtime == null) throw new InvalidOperationException("当前节点缺少 AI 图片持久任务运行时，请完整更新平台后端。");
                        rawResult = await runtime.RunAsync(item.Id, item.FencingToken, item.OsClient,
                            trustedUser, param, cancellation.Token).ConfigureAwait(false);
                    }
                    else
                    {
                        rawResult = await MicroiEngine.BackgroundTaskApiEngine
                            .RunBackgroundAsync(param, trustedUser, cancellation.Token)
                            .ConfigureAwait(false);
                    }
                    var result = SafeToJObject(rawResult);
                    var continuation = GetContinuation(result);
                    if (continuation != null && IsTrue(continuation["HasMore"]))
                    {
                        ApplyContinuationProgress(item.Id, continuation);
                        var nextParam = (JObject)param.DeepClone();
                        nextParam.Remove("_CurrentUser");
                        nextParam.Remove("_BackgroundTask");
                        nextParam.Remove("_BackgroundTaskFencingToken");
                        nextParam.Remove("_BackgroundTaskAttempt");
                        nextParam.Remove("_TrustedServerInvocation");
                        var checkpoint = continuation["Checkpoint"];
                        if (checkpoint != null) nextParam["_BackgroundTaskCheckpoint"] = checkpoint.DeepClone();
                        if (continuation["ParamPatch"] is JObject patch)
                        {
                            foreach (var property in patch.Properties()) nextParam[property.Name] = property.Value.DeepClone();
                        }
                        // A tenant ApiEngine continuation must never redirect a
                        // trusted cross-tenant task. Restore the server-selected
                        // target after applying its untrusted ParamPatch.
                        nextParam.Remove(TargetExecutionOsClientParam);
                        if (!string.Equals(
                                executionOsClient,
                                item.OsClient,
                                StringComparison.OrdinalIgnoreCase))
                        {
                            nextParam[TargetExecutionOsClientParam] = executionOsClient;
                        }
                        BackgroundTaskStore.RequeueChunk(
                            item,
                            nextParam,
                            checkpoint,
                            ParseInt(continuation["NextDelaySeconds"], 0),
                            continuation["Msg"]?.ToString() ?? result["Msg"]?.ToString());
                    }
                    else
                    {
                        var succeeded = result["Code"]?.ToString() == "1";
                        if (!succeeded && item.RetryOnFailure == 1)
                        {
                            BackgroundTaskStore.RetryOrFail(
                                item,
                                new InvalidOperationException(result["Msg"]?.ToString() ?? "接口引擎返回失败。"),
                                false);
                        }
                        else
                        {
                            BackgroundTaskStore.Complete(
                                item,
                                succeeded ? "Succeeded" : "Failed",
                                succeeded ? "已完成" : "执行失败",
                                result,
                                result["Msg"]?.ToString() ?? "");
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    if (active.UserCancellationRequested || IsPersistedCancellationRequested(item))
                    {
                        BackgroundTaskStore.Complete(
                            item,
                            "Canceled",
                            "已停止",
                            JObject.FromObject(new { Code = 0, Msg = "任务已停止。" }),
                            "任务已停止；失败或取消不会伪装成 100%。");
                    }
                    else
                    {
                        BackgroundTaskStore.RetryOrFail(
                            item,
                            new OperationCanceledException(active.LeaseLost
                                ? "执行租约已丢失，等待其它节点恢复。"
                                : "节点停止，任务等待恢复。"),
                            stoppingToken.IsCancellationRequested);
                    }
                }
                catch (Exception ex)
                {
                    BackgroundTaskStore.RetryOrFail(item, ex, stoppingToken.IsCancellationRequested);
                }
                finally
                {
                    try { active.RenewalCancellation.Cancel(); } catch { }
                    if (!await WaitForWorkerCleanupAsync(renewal, RenewalShutdownTimeout).ConfigureAwait(false))
                    {
                        LogFailure(
                            item.OsClient,
                            "WorkerRenewalShutdownTimedOut",
                            "后台任务租约续期收尾超过上限，已释放执行槽并由持久租约兜底",
                            new TimeoutException($"续期收尾超过 {RenewalShutdownTimeout.TotalSeconds:0} 秒。"),
                            item.Id);
                    }
                    ActiveExecutions.TryRemove(item.Id, out _);
                    // All terminal/requeue store methods update the owned in-memory
                    // record before their guarded write. Do not perform another
                    // tenant database read here: a slow legacy tenant must never
                    // retain a global worker slot after its durable row is terminal.
                    CacheProjection(item);
                    QueueNotification(item);
                    SignalWorkerIfPending(item);
                    activity?.Stop();
                }
            }
        }

        internal static async Task<bool> WaitForWorkerCleanupAsync(Task cleanup, TimeSpan timeout)
        {
            if (cleanup == null) return true;
            if (timeout <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(timeout));

            var completed = await Task.WhenAny(cleanup, Task.Delay(timeout)).ConfigureAwait(false);
            if (ReferenceEquals(completed, cleanup))
            {
                try { await cleanup.ConfigureAwait(false); } catch { }
                return true;
            }

            _ = cleanup.ContinueWith(
                task => { var ignored = task.Exception; },
                CancellationToken.None,
                TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
            return false;
        }

        private static async Task RenewLoopAsync(
            ActiveExecution active,
            BackgroundTaskConcurrencyLease laneLease,
            BackgroundTaskConcurrencyLease concurrencyLease,
            CancellationToken stoppingToken)
        {
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(
                active.RenewalCancellation.Token,
                stoppingToken);
            var consecutiveFailures = 0;
            while (!linked.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(
                            consecutiveFailures == 0
                                ? TimeSpan.FromSeconds(20)
                                : LeaseRenewalRetryDelay,
                            linked.Token)
                        .ConfigureAwait(false);
                    var leaseOk = BackgroundTaskStore.RenewLease(active.Record, out var cancelRequested);
                    var laneOk = laneLease == null || laneLease.Renew();
                    var concurrencyOk = concurrencyLease == null || concurrencyLease.Renew();
                    if (!leaseOk || !laneOk || !concurrencyOk)
                    {
                        active.LeaseLost = true;
                        active.Cancellation.Cancel();
                        LogFailure(
                            active.Record.OsClient,
                            "WorkerLeaseOwnershipLost",
                            "后台任务执行租约或并发租约所有权已丢失",
                            new InvalidOperationException(
                                $"TaskLease={leaseOk};ConcurrencyLease={concurrencyOk}"),
                            active.Record.Id);
                        return;
                    }
                    consecutiveFailures = 0;
                    if (cancelRequested)
                    {
                        active.UserCancellationRequested = true;
                        active.Cancellation.Cancel();
                        return;
                    }
                }
                catch (OperationCanceledException) { return; }
                catch (Exception ex)
                {
                    consecutiveFailures++;
                    if (ShouldRetryRenewalFailure(consecutiveFailures)) continue;
                    active.LeaseLost = true;
                    try { active.Cancellation.Cancel(); } catch { }
                    LogFailure(
                        active.Record.OsClient,
                        "WorkerLeaseRenewalFailed",
                        "后台任务租约连续续期失败，已停止当前执行并交由持久队列恢复",
                        ex,
                        active.Record.Id);
                    return;
                }
            }
        }

        internal static bool ShouldRetryRenewalFailure(int consecutiveFailures)
        {
            return consecutiveFailures > 0
                   && consecutiveFailures < LeaseRenewalTransientFailureLimit;
        }

        private static void ApplyContinuationProgress(string taskId, JObject continuation)
        {
            int? current = TryParseInt(continuation["Current"]);
            int? total = TryParseInt(continuation["Total"]);
            int? progress = TryParseInt(continuation["Progress"]);
            UpdateProgress(taskId, progress, continuation["Msg"]?.ToString(), current, total);
        }

        private static JObject GetContinuation(JObject result)
        {
            if (result == null) return null;
            if (result["BackgroundTask"] is JObject root) return root;
            if (result["Data"] is JObject data && data["BackgroundTask"] is JObject fromData) return fromData;
            if (result["DataAppend"] is JObject append && append["BackgroundTask"] is JObject fromAppend) return fromAppend;
            return null;
        }

        private static string ResolveExecutionOsClient(BackgroundTaskRecord item)
        {
            var ownerOsClient = item?.OsClient ?? string.Empty;
            var targetOsClient = ParseObject(item?.ParamJson)[TargetExecutionOsClientParam]
                ?.ToString()
                ?.Trim();
            if (targetOsClient.DosIsNullOrWhiteSpace()) return ownerOsClient;
            ChildTenantPlatformAppControlService.EnsureTargetExecutionAllowed(
                item?.ApiEngineKey,
                ownerOsClient,
                targetOsClient);
            return targetOsClient;
        }

        private static bool IsPersistedCancellationRequested(BackgroundTaskRecord item)
        {
            try { return BackgroundTaskStore.Get(item.OsClient, item.Id)?.CancelRequested == true; }
            catch { return false; }
        }

        private static bool IsCancellationRequested(string taskId)
        {
            return ActiveExecutions.TryGetValue(taskId ?? "", out var active)
                   && active.Cancellation.IsCancellationRequested;
        }

        private static JObject CreateTrustedUserSnapshot(JObject source)
        {
            var result = new JObject();
            if (source == null) return result;
            var allowed = new[]
            {
                "Id", "Account", "Name", "Level", "RoleIds", "RoleName", "DeptId", "DeptIds",
                "DeptName", "PostIds", "PostName", "Avatar", "Phone", "Email"
            };
            foreach (var field in allowed)
            {
                if (source[field] != null) result[field] = source[field].DeepClone();
            }
            return result;
        }

        private static void QueueNotification(BackgroundTaskItem item)
        {
            if (item == null) return;
            var scope = GetItemRuntimeScope(item);
            var key = string.Join("\n", item.OsClient ?? "", item.UserKey ?? "", scope.Type, scope.Network);
            PendingNotifications[key] = new NotificationRequest
            {
                OsClient = item.OsClient,
                UserKey = item.UserKey,
                RuntimeOsClientType = scope.Type,
                RuntimeOsClientNetwork = scope.Network
            };
            TryStartNotificationWorker(key);
        }

        private static void TryStartNotificationWorker(string key)
        {
            if (!NotificationWorkers.TryAdd(key, 0)) return;
            _ = Task.Run(async () =>
            {
                try
                {
                    while (PendingNotifications.TryRemove(key, out var request))
                    {
                        await SendTaskListToUserAsync(
                                request.OsClient,
                                request.UserKey,
                                request.RuntimeOsClientType,
                                request.RuntimeOsClientNetwork)
                            .ConfigureAwait(false);
                    }
                }
                finally
                {
                    NotificationWorkers.TryRemove(key, out _);
                    if (PendingNotifications.ContainsKey(key)) TryStartNotificationWorker(key);
                }
            });
        }

        private static void CacheProjection(BackgroundTaskItem item)
        {
            if (item == null || item.Id.DosIsNullOrWhiteSpace() || item.OsClient.DosIsNullOrWhiteSpace()
                || item.UserKey.DosIsNullOrWhiteSpace()) return;
            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(item.OsClient);
                var scope = GetItemRuntimeScope(item);
                WriteSummaryProjection(cache, item, scope.Type, scope.Network);
                // Do not leave a stale pre-scope projection behind after an upgraded
                // node has persisted the authoritative scoped projection.
                cache.HashDelete(
                    GetLegacyTaskHashKey(item.OsClient, item.UserKey),
                    item.Id,
                    CommandFlags.FireAndForget);
                QueueProjectionPrune(cache, item.OsClient, item.UserKey, scope.Type, scope.Network);
            }
            catch (Exception ex)
            {
                LogFailure(item.OsClient, "RedisTaskWriteFailed", "保存 Redis 后台任务投影失败", ex, item.Id);
            }
        }

        internal static void WriteSummaryProjection(
            IMicroiCache cache, BackgroundTaskItem item, string runtimeType, string runtimeNetwork)
        {
            // BackgroundTaskRecord additionally carries ParamJson, ResultJson,
            // CheckpointJson and TrustedUserJson. Never serialize its runtime type
            // into the cache used by notification pushes and pruning.
            cache.HashSet(GetTaskHashKey(item.OsClient, item.UserKey, runtimeType, runtimeNetwork),
                item.Id, ToSummary(item), When.Always, CommandFlags.FireAndForget);
        }

        private static void QueueProjectionPrune(
            IMicroiCache cache,
            string osClient,
            string userKey,
            string runtimeOsClientType,
            string runtimeOsClientNetwork)
        {
            var key = GetTaskHashKey(
                osClient,
                userKey,
                runtimeOsClientType,
                runtimeOsClientNetwork);
            if (!ProjectionPruneInFlight.TryAdd(key, 0)) return;

            _ = Task.Run(() =>
            {
                try
                {
                    PruneTaskHash(cache, osClient, userKey, runtimeOsClientType, runtimeOsClientNetwork);
                }
                finally
                {
                    ProjectionPruneInFlight.TryRemove(key, out _);
                }
            });
        }

        private static List<BackgroundTaskItem> ListLegacyCache(string osClient, string userKey)
        {
            return ListCachedSummaries(osClient, userKey)
                .Select(summary => JObject.FromObject(summary).ToObject<BackgroundTaskItem>())
                .Where(item => item != null)
                .ToList();
        }

        private static List<BackgroundTaskSummary> ListCachedSummaries(string osClient, string userKey)
        {
            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(osClient ?? "");
                // Old nodes keep their old namespace during rolling upgrades.
                // Reconcile their rows from the shared database, never HVALS their
                // complete logs, package results and trusted execution payloads.
                return cache.HashGetAllValues<BackgroundTaskSummary>(GetTaskHashKey(
                    osClient, userKey,
                    BackgroundTaskStore.CurrentRuntimeOsClientType(),
                    BackgroundTaskStore.CurrentRuntimeOsClientNetwork())) ?? new List<BackgroundTaskSummary>();
            }
            catch { return new List<BackgroundTaskSummary>(); }
        }

        private static void RemoveLegacyCompleted(string osClient, string userKey, bool succeededOnly, string taskId)
        {
            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var key = GetTaskHashKey(osClient, userKey,
                    BackgroundTaskStore.CurrentRuntimeOsClientType(),
                    BackgroundTaskStore.CurrentRuntimeOsClientNetwork());
                var removeIds = cache.HashGetAllValues<BackgroundTaskSummary>(key)
                    ?.Where(item => item != null
                                    && (taskId.DosIsNullOrWhiteSpace() || item.Id == taskId)
                                    && (!succeededOnly || item.Status == "Succeeded"))
                    .Select(item => item.Id)
                    .Where(id => !id.DosIsNullOrWhiteSpace())
                    .ToArray();
                if (removeIds?.Length > 0) cache.HashDelete(key, removeIds);
                if (removeIds?.Length > 0) cache.HashDelete(GetLegacyTaskHashKey(osClient, userKey), removeIds);
            }
            catch { }
        }

        private static void DeleteProjection(string osClient, string userKey, string taskId)
        {
            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                cache.HashDelete(GetTaskHashKey(osClient, userKey,
                    BackgroundTaskStore.CurrentRuntimeOsClientType(),
                    BackgroundTaskStore.CurrentRuntimeOsClientNetwork()), taskId);
                cache.HashDelete(GetLegacyTaskHashKey(osClient, userKey), taskId);
            }
            catch { }
        }

        private static void PruneTaskHash(
            IMicroiCache cache,
            string osClient,
            string userKey,
            string runtimeOsClientType,
            string runtimeOsClientNetwork)
        {
            try
            {
                var key = GetTaskHashKey(osClient, userKey, runtimeOsClientType, runtimeOsClientNetwork);
                var list = cache.HashGetAllValues<BackgroundTaskSummary>(key) ?? new List<BackgroundTaskSummary>();
                if (list.Count <= 100) return;
                var removeIds = list.OrderByDescending(item => IsTerminal(item.Status))
                    .ThenBy(item => item.CreateTime)
                    .Take(list.Count - 100)
                    .Select(item => item.Id)
                    .ToArray();
                if (removeIds.Length > 0) cache.HashDelete(key, removeIds);
            }
            catch { }
        }

        private static BackgroundTaskItem ApplyRuntimeFields(BackgroundTaskItem item)
        {
            if (item == null) return null;
            var from = item.StartTime ?? item.CreateTime;
            var to = item.EndTime ?? DateTime.Now;
            item.ElapsedSeconds = Math.Max(0, Convert.ToInt32((to - from).TotalSeconds));
            item.ElapsedText = FormatDuration(item.ElapsedSeconds);
            item.RemainingText = item.RemainingSeconds.HasValue
                ? FormatDuration(item.RemainingSeconds.Value)
                : "";
            item.ProgressMode = item.ProgressMode.DosIsNullOrWhiteSpace() ? "Indeterminate" : item.ProgressMode;
            item.EstimateConfidence = item.EstimateConfidence.DosIsNullOrWhiteSpace() ? "None" : item.EstimateConfidence;
            return item;
        }

        internal static BackgroundTaskSummary ToSummary(BackgroundTaskItem item)
        {
            item = ApplyRuntimeFields(item);
            if (item == null) return null;
            return new BackgroundTaskSummary
            {
                Id = item.Id,
                Title = item.Title,
                Type = item.Type,
                ApiEngineKey = item is BackgroundTaskRecord record ? record.ApiEngineKey : "",
                Status = item.Status,
                StatusText = item.StatusText,
                Progress = item.Progress,
                ProgressMode = item.ProgressMode,
                Current = item.Current,
                Total = item.Total,
                Msg = Limit(item.Msg, 2000),
                CreateTime = item.CreateTime,
                StartTime = item.StartTime,
                EndTime = item.EndTime,
                HeartbeatTime = item.HeartbeatTime,
                EstimatedEndTime = item.EstimatedEndTime,
                RemainingSeconds = item.RemainingSeconds,
                RemainingText = item.RemainingText,
                EstimateConfidence = item.EstimateConfidence,
                ElapsedSeconds = item.ElapsedSeconds,
                ElapsedText = item.ElapsedText,
                CancelRequested = item.CancelRequested,
                AttemptCount = item.AttemptCount,
                MaxAttempts = item.MaxAttempts,
                ExecutionCount = item.ExecutionCount,
                BusinessTable = item.BusinessTable,
                BusinessId = item.BusinessId,
                HasLog = !item.Log.DosIsNullOrWhiteSpace(),
                HasResult = item.Result != null && item.Result.HasValues
            };
        }

        private static string FormatDuration(int seconds)
        {
            seconds = Math.Max(0, seconds);
            if (seconds < 60) return $"{seconds}s";
            if (seconds < 3600) return $"{seconds / 60}m {seconds % 60}s";
            if (seconds < 86400) return $"{seconds / 3600}h {(seconds % 3600) / 60}m";
            return $"{seconds / 86400}d {(seconds % 86400) / 3600}h {(seconds % 3600) / 60}m";
        }

        internal static string GetTaskHashKey(
            string osClient,
            string userKey,
            string runtimeOsClientType,
            string runtimeOsClientNetwork)
        {
            return $"Microi:{osClient ?? ""}:BackgroundTaskSummaries:V2:{ScopeKey(runtimeOsClientType, runtimeOsClientNetwork)}:{userKey ?? ""}";
        }

        public static string GetScopedChatOnlineKey(
            string osClient,
            string userKey,
            string runtimeOsClientType,
            string runtimeOsClientNetwork)
        {
            return $"Microi:{osClient ?? ""}:ChatOnline:{ScopeKey(runtimeOsClientType, runtimeOsClientNetwork)}:{userKey ?? ""}";
        }

        private static string GetLegacyTaskHashKey(string osClient, string userKey)
        {
            return $"Microi:{osClient ?? ""}:BackgroundTasks:{userKey ?? ""}";
        }

        private static (string Type, string Network) GetItemRuntimeScope(BackgroundTaskItem item)
        {
            if (item is BackgroundTaskRecord record)
            {
                var type = BackgroundTaskStore.NormalizeRuntimeScopeValue(record.RuntimeOsClientType);
                var network = BackgroundTaskStore.NormalizeRuntimeScopeValue(record.RuntimeOsClientNetwork);
                if (!type.DosIsNullOrWhiteSpace() || !network.DosIsNullOrWhiteSpace())
                    return (type, network);
            }
            return (BackgroundTaskStore.CurrentRuntimeOsClientType(),
                BackgroundTaskStore.CurrentRuntimeOsClientNetwork());
        }

        private static string ScopeKey(string runtimeOsClientType, string runtimeOsClientNetwork)
        {
            return Uri.EscapeDataString(BackgroundTaskStore.NormalizeRuntimeScopeValue(runtimeOsClientType))
                   + ":"
                   + Uri.EscapeDataString(BackgroundTaskStore.NormalizeRuntimeScopeValue(runtimeOsClientNetwork));
        }

        private static bool IsTerminal(string status)
        {
            return status == "Succeeded" || status == "Failed" || status == "Canceled";
        }

        private static JObject ParseObject(string json)
        {
            if (json.DosIsNullOrWhiteSpace()) return new JObject();
            try { return JObject.Parse(json); }
            catch { return new JObject(); }
        }

        private static JObject SafeToJObject(object value)
        {
            if (value == null) return new JObject();
            if (value is JObject jObject) return jObject;
            try { return JObject.FromObject(value); }
            catch { return JObject.FromObject(new { Code = 1, Data = value.ToString() }); }
        }

        private static string Limit(string value, int max)
        {
            value = value?.Trim() ?? "";
            return value.Length <= max ? value : value.Substring(0, max);
        }

        private static bool IsTrue(JToken token)
        {
            var text = token?.ToString();
            return text == "1" || string.Equals(text, "true", StringComparison.OrdinalIgnoreCase);
        }

        private static int ParseInt(JToken token, int defaultValue)
        {
            return int.TryParse(token?.ToString(), out var value) ? value : defaultValue;
        }

        private static int? TryParseInt(JToken token)
        {
            return int.TryParse(token?.ToString(), out var value) ? value : (int?)null;
        }

        private static int Clamp(int value, int min, int max)
        {
            return value < min ? min : value > max ? max : value;
        }

        private static string BuildNodeId()
        {
            return Limit($"{Environment.MachineName}-{System.Diagnostics.Process.GetCurrentProcess().Id}", 100);
        }

        private static void LogFailure(string osClient, string key, string title, Exception ex, string data)
        {
            try { MicroiEngine.QueueSystemLog(osClient, "BackgroundTask", key, title, ex?.ToString() ?? "", 2, false, data); }
            catch { }
        }

        private sealed class NotificationRequest
        {
            public string OsClient { get; set; }
            public string UserKey { get; set; }
            public string RuntimeOsClientType { get; set; }
            public string RuntimeOsClientNetwork { get; set; }
        }

        private sealed class WorkerSlot : BackgroundTaskLaneState
        {
            public Task Execution { get; set; }
        }

        private sealed class ActiveExecution
        {
            public ActiveExecution(BackgroundTaskRecord record, CancellationTokenSource cancellation)
            {
                Record = record;
                Cancellation = cancellation;
            }

            public BackgroundTaskRecord Record { get; }
            public CancellationTokenSource Cancellation { get; }
            public CancellationTokenSource RenewalCancellation { get; } = new CancellationTokenSource();
            public object SyncRoot { get; } = new object();
            public bool UserCancellationRequested { get; set; }
            public bool LeaseLost { get; set; }
        }
    }
}
