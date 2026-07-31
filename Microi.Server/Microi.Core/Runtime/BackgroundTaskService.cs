using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

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
    /// Durable background task façade. The tenant database is the source of truth;
    /// Redis only caches user projections and SignalR only transports notifications.
    /// </summary>
    public static class BackgroundTaskService
    {
        private const int MaxLogChars = 120000;
        private static readonly ConcurrentDictionary<string, ActiveExecution> ActiveExecutions =
            new ConcurrentDictionary<string, ActiveExecution>(StringComparer.OrdinalIgnoreCase);
        private static readonly string NodeId = BuildNodeId();
        private static int _claimFailureReported;

        static BackgroundTaskService()
        {
            BackgroundTaskRuntime.UpdateProgressHandler = UpdateProgress;
            BackgroundTaskRuntime.AppendLogHandler = AppendLog;
            BackgroundTaskRuntime.IsCancellationRequestedHandler = IsCancellationRequested;
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
                BusinessEtaField = Limit(options["BusinessEtaField"]?.ToString(), 100)
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
                    return ApplyRuntimeFields(concurrent);
                }
                throw;
            }
            CacheProjection(item);
            QueueNotification(item);
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
                var estimate = BackgroundTaskProgress.Calculate(
                    now,
                    item.StartTime ?? now,
                    nextCurrent,
                    nextTotal,
                    progress,
                    item.ProgressSampleTime,
                    item.ProgressSampleCurrent,
                    item.ThroughputPerSecond,
                    item.ProgressSampleCount);

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

        public static async Task RunWorkerLoopAsync(CancellationToken stoppingToken)
        {
            var parallelism = Clamp(
                ConfigHelper.GetRuntimeConfigurationInt(
                    "BackgroundTasks:MaxParallelTasks",
                    4),
                1,
                16);
            var running = new HashSet<Task>();
            while (!stoppingToken.IsCancellationRequested)
            {
                foreach (var completed in running.Where(task => task.IsCompleted).ToList())
                {
                    running.Remove(completed);
                    try { await completed.ConfigureAwait(false); }
                    catch (Exception ex) { LogFailure("", "WorkerTaskFailed", "后台任务工作器出现未处理异常", ex, NodeId); }
                }

                while (running.Count < parallelism && !stoppingToken.IsCancellationRequested)
                {
                    BackgroundTaskRecord item;
                    try { item = BackgroundTaskStore.TryClaimNext(NodeId); }
                    catch (Exception ex)
                    {
                        LogFailure("", "WorkerClaimFailed", "后台任务抢占失败", ex, NodeId);
                        if (Interlocked.CompareExchange(ref _claimFailureReported, 1, 0) == 0)
                        {
                            Console.WriteLine(
                                $"Microi：【Error异常】主租户[{OsClientDefault.OsClient}]后台任务抢占失败：{ex.Message}");
                        }
                        item = null;
                    }
                    if (item == null) break;
                    Interlocked.Exchange(ref _claimFailureReported, 0);
                    running.Add(ProcessClaimedAsync(item, stoppingToken));
                }

                if (running.Count == 0)
                {
                    try { await Task.Delay(1500, stoppingToken).ConfigureAwait(false); }
                    catch (OperationCanceledException) { break; }
                }
                else
                {
                    var delay = Task.Delay(1000, stoppingToken);
                    try { await Task.WhenAny(running.Cast<Task>().Append(delay)).ConfigureAwait(false); }
                    catch (OperationCanceledException) { break; }
                }
            }

            foreach (var active in ActiveExecutions.Values)
            {
                try { active.Cancellation.Cancel(); } catch { }
            }
            if (running.Count > 0)
            {
                await Task.WhenAny(Task.WhenAll(running), Task.Delay(TimeSpan.FromSeconds(30))).ConfigureAwait(false);
            }
        }

        public static async Task SendTaskListToUserAsync(string osClient, string userKey)
        {
            if (!RealtimePushRuntime.IsConfigured || osClient.DosIsNullOrWhiteSpace() || userKey.DosIsNullOrWhiteSpace()) return;
            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var clientInfo = await cache.GetAsync<ClientInfo>($"Microi:{osClient}:ChatOnline:{userKey}").ConfigureAwait(false);
                if (clientInfo?.ConnectionIds == null || !clientInfo.ConnectionIds.Any()) return;
                await RealtimePushRuntime.SendAsync(
                        clientInfo.ConnectionIds,
                        "ReceiveBackgroundTaskList",
                        List(osClient, userKey))
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                LogFailure(osClient, "RealtimePushFailed", "后台任务列表实时推送失败", ex, userKey);
            }
        }

        private static async Task ProcessClaimedAsync(BackgroundTaskRecord item, CancellationToken stoppingToken)
        {
            BackgroundTaskConcurrencyLease concurrencyLease = null;
            if (!item.ConcurrencyKey.DosIsNullOrWhiteSpace())
            {
                try
                {
                    concurrencyLease = BackgroundTaskConcurrencyLease.TryAcquire(item.OsClient, item.ConcurrencyKey, item.LeaseOwner);
                    if (concurrencyLease == null)
                    {
                        BackgroundTaskStore.ReleaseToPending(item, "等待同一并发组的上一项任务完成", 2);
                        return;
                    }
                }
                catch (Exception ex)
                {
                    BackgroundTaskStore.ReleaseToPending(item, ex.Message, 5);
                    LogFailure(item.OsClient, "ConcurrencyLeaseFailed", "后台任务并发租约获取失败", ex, item.Id);
                    return;
                }
            }

            using (concurrencyLease)
            using (var cancellation = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken))
            {
                var active = new ActiveExecution(item, cancellation);
                ActiveExecutions[item.Id] = active;
                CacheProjection(item);
                QueueNotification(item);
                var renewal = RenewLoopAsync(active, concurrencyLease, stoppingToken);
                try
                {
                    var param = ParseObject(item.ParamJson);
                    var trustedUser = ParseObject(item.TrustedUserJson);
                    param["ApiEngineKey"] = item.ApiEngineKey;
                    param["_BackgroundTaskId"] = item.Id;
                    param["_BackgroundTaskTitle"] = item.Title ?? "";
                    param["_BackgroundTaskIdempotencyKey"] = item.IdempotencyKey ?? item.Id;
                    param["_BackgroundTaskFencingToken"] = item.FencingToken;
                    param["_BackgroundTaskAttempt"] = item.AttemptCount + 1;
                    param["OsClient"] = item.OsClient;
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
                        item.BusinessEtaField
                    });

                    dynamic rawResult = await MicroiEngine.BackgroundTaskApiEngine
                        .RunBackgroundAsync(param, trustedUser, cancellation.Token)
                        .ConfigureAwait(false);
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
                    try { await renewal.ConfigureAwait(false); } catch { }
                    ActiveExecutions.TryRemove(item.Id, out _);
                    var current = BackgroundTaskStore.Get(item.OsClient, item.Id);
                    if (current != null)
                    {
                        CacheProjection(current);
                        QueueNotification(current);
                    }
                }
            }
        }

        private static async Task RenewLoopAsync(
            ActiveExecution active,
            BackgroundTaskConcurrencyLease concurrencyLease,
            CancellationToken stoppingToken)
        {
            using var linked = CancellationTokenSource.CreateLinkedTokenSource(
                active.RenewalCancellation.Token,
                stoppingToken);
            while (!linked.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(20), linked.Token).ConfigureAwait(false);
                    var leaseOk = BackgroundTaskStore.RenewLease(active.Record, out var cancelRequested);
                    var concurrencyOk = concurrencyLease == null || concurrencyLease.Renew();
                    if (!leaseOk || !concurrencyOk)
                    {
                        active.LeaseLost = true;
                        active.Cancellation.Cancel();
                        return;
                    }
                    if (cancelRequested)
                    {
                        active.UserCancellationRequested = true;
                        active.Cancellation.Cancel();
                        return;
                    }
                }
                catch (OperationCanceledException) { return; }
                catch
                {
                    active.LeaseLost = true;
                    try { active.Cancellation.Cancel(); } catch { }
                    return;
                }
            }
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
            _ = SendTaskListToUserAsync(item.OsClient, item.UserKey);
        }

        private static void CacheProjection(BackgroundTaskItem item)
        {
            if (item == null || item.Id.DosIsNullOrWhiteSpace() || item.OsClient.DosIsNullOrWhiteSpace()
                || item.UserKey.DosIsNullOrWhiteSpace()) return;
            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(item.OsClient);
                cache.HashSet(GetTaskHashKey(item.OsClient, item.UserKey), item.Id, ApplyRuntimeFields(item));
                PruneTaskHash(cache, item.OsClient, item.UserKey);
            }
            catch (Exception ex)
            {
                LogFailure(item.OsClient, "RedisTaskWriteFailed", "保存 Redis 后台任务投影失败", ex, item.Id);
            }
        }

        private static List<BackgroundTaskItem> ListLegacyCache(string osClient, string userKey)
        {
            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(osClient ?? "");
                return cache.HashGetAllValues<BackgroundTaskItem>(GetTaskHashKey(osClient, userKey))
                       ?? new List<BackgroundTaskItem>();
            }
            catch { return new List<BackgroundTaskItem>(); }
        }

        private static void RemoveLegacyCompleted(string osClient, string userKey, bool succeededOnly, string taskId)
        {
            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var key = GetTaskHashKey(osClient, userKey);
                var removeIds = cache.HashGetAllValues<BackgroundTaskItem>(key)
                    ?.Where(item => item != null
                                    && (taskId.DosIsNullOrWhiteSpace() || item.Id == taskId)
                                    && (!succeededOnly || item.Status == "Succeeded"))
                    .Select(item => item.Id)
                    .Where(id => !id.DosIsNullOrWhiteSpace())
                    .ToArray();
                if (removeIds?.Length > 0) cache.HashDelete(key, removeIds);
            }
            catch { }
        }

        private static void DeleteProjection(string osClient, string userKey, string taskId)
        {
            try { MicroiEngine.CacheTenant.Cache(osClient).HashDelete(GetTaskHashKey(osClient, userKey), taskId); }
            catch { }
        }

        private static void PruneTaskHash(IMicroiCache cache, string osClient, string userKey)
        {
            try
            {
                var key = GetTaskHashKey(osClient, userKey);
                var list = cache.HashGetAllValues<BackgroundTaskItem>(key) ?? new List<BackgroundTaskItem>();
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

        private static string FormatDuration(int seconds)
        {
            seconds = Math.Max(0, seconds);
            if (seconds < 60) return $"{seconds}s";
            if (seconds < 3600) return $"{seconds / 60}m {seconds % 60}s";
            if (seconds < 86400) return $"{seconds / 3600}h {(seconds % 3600) / 60}m";
            return $"{seconds / 86400}d {(seconds % 86400) / 3600}h {(seconds % 3600) / 60}m";
        }

        private static string GetTaskHashKey(string osClient, string userKey)
        {
            return $"Microi:{osClient ?? ""}:BackgroundTasks:{userKey ?? ""}";
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
