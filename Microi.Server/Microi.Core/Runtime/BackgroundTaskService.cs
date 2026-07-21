using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public sealed class BackgroundTaskItem
    {
        public string Id { get; set; }
        public string OsClient { get; set; }
        public string UserKey { get; set; }
        public string Title { get; set; }
        public string Type { get; set; }
        public string Status { get; set; }
        public string StatusText { get; set; }
        public int Progress { get; set; }
        public int Current { get; set; }
        public int Total { get; set; }
        public string Msg { get; set; }
        public string Log { get; set; }
        public DateTime CreateTime { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public int ElapsedSeconds { get; set; }
        public string ElapsedText { get; set; }
        public bool CancelRequested { get; set; }
        public JObject Result { get; set; }
    }

    public static class BackgroundTaskService
    {
        private static readonly ConcurrentDictionary<string, BackgroundTaskItem> Tasks = new ConcurrentDictionary<string, BackgroundTaskItem>();
        private static readonly ConcurrentDictionary<string, CancellationTokenSource> CancellationTokens = new ConcurrentDictionary<string, CancellationTokenSource>();
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> SerialApiEngineGates = new ConcurrentDictionary<string, SemaphoreSlim>(StringComparer.OrdinalIgnoreCase);
        private static readonly SemaphoreSlim RunnerGate = new SemaphoreSlim(64, 64);
        static BackgroundTaskService()
        {
            BackgroundTaskRuntime.UpdateProgressHandler = UpdateProgress;
            BackgroundTaskRuntime.AppendLogHandler = AppendLog;
            BackgroundTaskRuntime.IsCancellationRequestedHandler = taskId =>
                Tasks.TryGetValue(taskId ?? "", out var task) && task.CancelRequested;
        }

        public static BackgroundTaskItem StartApiEngine(
            string osClient,
            string userKey,
            string title,
            JObject apiParam,
            JObject trustedCurrentUser)
        {
            var item = new BackgroundTaskItem
            {
                Id = Guid.NewGuid().ToString("N"),
                OsClient = osClient ?? "",
                UserKey = userKey ?? "",
                Title = title.DosIsNullOrWhiteSpace() ? apiParam?["ApiEngineKey"]?.ToString() ?? "后台任务" : title,
                Type = "ApiEngine",
                Status = "Pending",
                StatusText = "排队中",
                Progress = 0,
                Current = 0,
                Total = 100,
                Msg = "",
                CreateTime = DateTime.Now
            };

            var cts = new CancellationTokenSource();
            Tasks[item.Id] = item;
            CancellationTokens[item.Id] = cts;
            SaveTask(item);
            NotifyUser(item);
            var taskParam = apiParam == null ? new JObject() : (JObject)apiParam.DeepClone();
            var taskUser = trustedCurrentUser == null ? null : (JObject)trustedCurrentUser.DeepClone();
            _ = Task.Run(() => RunApiEngineTask(item, taskParam, taskUser, cts.Token));
            return ApplyRuntimeFields(item);
        }

        public static List<BackgroundTaskItem> List(string osClient, string userKey)
        {
            return ListAllTasks(osClient, userKey)
                .OrderByDescending(item => item.CreateTime)
                .Take(100)
                .Select(ApplyRuntimeFields)
                .ToList();
        }

        public static int ClearCompleted(string osClient, string userKey)
        {
            var items = ListAllTasks(osClient, userKey)
                // 批量清理只删除成功任务。失败/取消任务需要保留排查，
                // 用户确认后再通过单条清除处理。
                .Where(item => string.Equals(item.Status, "Succeeded", StringComparison.OrdinalIgnoreCase))
                .ToList();

            var count = 0;
            foreach (var item in items)
            {
                if (item == null || item.Id.DosIsNullOrWhiteSpace())
                {
                    continue;
                }

                CancellationTokens.TryRemove(item.Id, out var cts);
                cts?.Dispose();
                var removedMemory = Tasks.TryRemove(item.Id, out _);
                var removedCache = DeleteTask(item.OsClient, item.UserKey, item.Id);
                if (removedMemory || removedCache)
                {
                    count++;
                }
            }
            return count;
        }

        public static bool Remove(string osClient, string userKey, string taskId)
        {
            if (taskId.DosIsNullOrWhiteSpace())
            {
                return false;
            }

            var item = ListAllTasks(osClient, userKey)
                .FirstOrDefault(candidate => string.Equals(candidate?.Id, taskId, StringComparison.OrdinalIgnoreCase));
            if (item == null || !IsTerminal(item.Status))
            {
                return false;
            }

            CancellationTokens.TryRemove(taskId, out var cts);
            cts?.Dispose();
            var removedMemory = Tasks.TryRemove(taskId, out _);
            var removedCache = DeleteTask(item.OsClient, item.UserKey, taskId);
            return removedMemory || removedCache;
        }

        public static bool Cancel(string osClient, string userKey, string taskId)
        {
            if (taskId.DosIsNullOrWhiteSpace()
                || !Tasks.TryGetValue(taskId, out var item)
                || !string.Equals(item.OsClient, osClient ?? "", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(item.UserKey, userKey ?? "", StringComparison.OrdinalIgnoreCase)
                || IsTerminal(item.Status))
            {
                return false;
            }

            item.CancelRequested = true;
            item.Msg = "已请求停止，正在等待当前执行点结束。";
            if (item.Status == "Pending")
            {
                item.Status = "Canceled";
                item.StatusText = "已停止";
                item.Progress = 100;
                item.Current = item.Total <= 0 ? 100 : item.Total;
                item.Total = item.Total <= 0 ? 100 : item.Total;
                item.EndTime = DateTime.Now;
            }
            else
            {
                item.StatusText = "停止中";
            }

            if (CancellationTokens.TryGetValue(taskId, out var cts))
            {
                try { cts.Cancel(); } catch { }
            }
            NotifyUser(item);
            return true;
        }

        public static bool UpdateProgress(string taskId, int? progress, string msg, int? current, int? total)
        {
            if (taskId.DosIsNullOrWhiteSpace()
                || !Tasks.TryGetValue(taskId, out var item)
                || IsTerminal(item.Status))
            {
                return false;
            }

            if (progress.HasValue)
            {
                item.Progress = Math.Max(0, Math.Min(99, progress.Value));
            }
            if (total.HasValue && total.Value > 0)
            {
                item.Total = total.Value;
            }
            if (current.HasValue)
            {
                item.Current = Math.Max(0, current.Value);
                if (!progress.HasValue && item.Total > 0)
                {
                    var calculated = Convert.ToInt32(Math.Floor(item.Current * 100m / item.Total));
                    item.Progress = Math.Max(0, Math.Min(99, calculated));
                }
            }
            if (!msg.DosIsNullOrWhiteSpace())
            {
                item.Msg = msg;
                if (item.Status == "Running")
                {
                    item.StatusText = msg.Contains("排队") || msg.Contains("等待上一个数据库备份")
                        ? "排队中"
                        : "执行中";
                }
            }
            NotifyUser(item);
            return true;
        }

        public static bool AppendLog(string taskId, string message)
        {
            if (taskId.DosIsNullOrWhiteSpace()
                || message.DosIsNullOrWhiteSpace()
                || !Tasks.TryGetValue(taskId, out var item))
            {
                return false;
            }

            const int maxLogChars = 120000;
            var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message.Trim()}";
            var combined = item.Log.DosIsNullOrWhiteSpace() ? line : item.Log + Environment.NewLine + line;
            item.Log = combined.Length <= maxLogChars
                ? combined
                : "[较早日志已截断]" + Environment.NewLine + combined.Substring(combined.Length - maxLogChars);
            NotifyUser(item);
            return true;
        }

        public static async Task SendTaskListToUserAsync(string osClient, string userKey)
        {
            if (!RealtimePushRuntime.IsConfigured || osClient.DosIsNullOrWhiteSpace() || userKey.DosIsNullOrWhiteSpace())
            {
                return;
            }

            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var clientInfo = await cache.GetAsync<ClientInfo>($"Microi:{osClient}:ChatOnline:{userKey}").ConfigureAwait(false);
                if (clientInfo?.ConnectionIds == null || !clientInfo.ConnectionIds.Any())
                {
                    return;
                }

                await RealtimePushRuntime.SendAsync(
                        clientInfo.ConnectionIds,
                        "ReceiveBackgroundTaskList",
                        List(osClient, userKey))
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【后台任务】推送任务列表失败：{ex.Message}");
            }
        }

        private static async Task RunApiEngineTask(
            BackgroundTaskItem item,
            JObject apiParam,
            JObject trustedCurrentUser,
            CancellationToken cancellationToken)
        {
            var gateAcquired = false;
            var serialGateAcquired = false;
            SemaphoreSlim serialGate = null;
            try
            {
                var serialKey = GetSerialApiEngineKey(item, apiParam);
                if (!serialKey.DosIsNullOrWhiteSpace())
                {
                    serialGate = SerialApiEngineGates.GetOrAdd(serialKey, _ => new SemaphoreSlim(1, 1));
                    item.Status = "Pending";
                    item.StatusText = string.Equals(apiParam?["ApiEngineKey"]?.ToString(), DatabaseBackupService.WorkerApiEngineKey, StringComparison.OrdinalIgnoreCase)
                        ? "等待上一个数据库备份完成"
                        : "等待同租户其它应用安装完成";
                    item.Progress = Math.Max(item.Progress, 5);
                    item.Msg = string.Equals(apiParam?["ApiEngineKey"]?.ToString(), DatabaseBackupService.WorkerApiEngineKey, StringComparison.OrdinalIgnoreCase)
                        ? "数据库备份已排队，上一个备份完成后自动执行。"
                        : "应用安装已排队，将按顺序执行，避免旧库并发DDL和元数据写入死锁。";
                    NotifyUser(item);
                    await serialGate.WaitAsync(cancellationToken).ConfigureAwait(false);
                    serialGateAcquired = true;
                }

                await RunnerGate.WaitAsync(cancellationToken).ConfigureAwait(false);
                gateAcquired = true;
                cancellationToken.ThrowIfCancellationRequested();

                item.Status = "Running";
                item.StatusText = "执行中";
                item.Progress = 10;
                item.Current = Math.Max(item.Current, 10);
                item.Total = item.Total <= 0 ? 100 : item.Total;
                item.StartTime = DateTime.Now;
                NotifyUser(item);

                apiParam["_BackgroundTaskId"] = item.Id;
                apiParam["_BackgroundTaskTitle"] = item.Title ?? "";
                apiParam["OsClient"] = item.OsClient;
                apiParam["_InvokeType"] = "Client";
                apiParam.Remove("_CurrentUser");
                if (trustedCurrentUser != null)
                {
                    apiParam["_CurrentUser"] = trustedCurrentUser.DeepClone();
                }
                // 后台线程可能已经脱离原 HTTP 请求，DiyToken 此时会回退到服务默认租户。
                // 必须通过后台任务专用入口传入提交阶段由服务端认证得到的可信用户快照，
                // 不能让普通接口的跨租户匿名保护误删子租户身份。
                dynamic result = await MicroiEngine.BackgroundTaskApiEngine
                    .RunBackgroundAsync(apiParam, trustedCurrentUser)
                    .ConfigureAwait(false);
                item.Result = SafeToJObject(result);
                item.Msg = item.Result?["Msg"]?.ToString() ?? "";
                item.Progress = 100;
                item.Current = item.Total <= 0 ? 100 : item.Total;
                item.Total = item.Total <= 0 ? 100 : item.Total;
                if (item.CancelRequested)
                {
                    item.Status = "Canceled";
                    item.StatusText = "已停止";
                }
                else
                {
                    item.Status = item.Result?["Code"]?.ToString() == "1" ? "Succeeded" : "Failed";
                    item.StatusText = item.Status == "Succeeded" ? "已完成" : "执行失败";
                }
            }
            catch (OperationCanceledException)
            {
                item.Status = "Canceled";
                item.StatusText = "已停止";
                item.Progress = 100;
                item.Current = item.Total <= 0 ? 100 : item.Total;
                item.Total = item.Total <= 0 ? 100 : item.Total;
                item.Msg = item.Msg.DosIsNullOrWhiteSpace() ? "任务已停止。" : item.Msg;
                item.Result = JObject.FromObject(new { Code = 0, Msg = item.Msg });
            }
            catch (Exception ex)
            {
                item.Status = "Failed";
                item.StatusText = "执行失败";
                item.Progress = 100;
                item.Current = item.Total <= 0 ? 100 : item.Total;
                item.Total = item.Total <= 0 ? 100 : item.Total;
                item.Msg = ex.Message;
                item.Result = JObject.FromObject(new { Code = 0, Msg = ex.Message });
            }
            finally
            {
                if (IsTerminal(item.Status))
                {
                    item.EndTime = DateTime.Now;
                }
                if (gateAcquired)
                {
                    RunnerGate.Release();
                }
                if (serialGateAcquired)
                {
                    serialGate.Release();
                }
                CancellationTokens.TryRemove(item.Id, out var cts);
                cts?.Dispose();
                NotifyUser(item);
            }
        }

        private static string GetSerialApiEngineKey(BackgroundTaskItem item, JObject apiParam)
        {
            var apiEngineKey = apiParam?["ApiEngineKey"]?.ToString();
            if (!string.Equals(apiEngineKey, "import-microi-store-package", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(apiEngineKey, DatabaseBackupService.WorkerApiEngineKey, StringComparison.OrdinalIgnoreCase))
            {
                return "";
            }

            return $"{item?.OsClient ?? ""}:{apiEngineKey}";
        }

        private static void NotifyUser(BackgroundTaskItem item)
        {
            if (item == null)
            {
                return;
            }

            SaveTask(item);
            _ = Task.Run(() => SendTaskListToUserAsync(item.OsClient, item.UserKey));
        }

        private static List<BackgroundTaskItem> ListAllTasks(string osClient, string userKey)
        {
            var normalizedOsClient = osClient ?? "";
            var normalizedUserKey = userKey ?? "";
            var map = new Dictionary<string, BackgroundTaskItem>(StringComparer.OrdinalIgnoreCase);

            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(normalizedOsClient);
                var taskHashKey = GetTaskHashKey(normalizedOsClient, normalizedUserKey);
                foreach (var entry in cache.HashGetAll(taskHashKey))
                {
                    try
                    {
                        var item = JsonHelper.Deserialize<BackgroundTaskItem>(entry.Value.ToString());
                        if (item?.Id.DosIsNullOrWhiteSpace() == false)
                        {
                            map[item.Id] = item;
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Microi：【后台任务】读取Redis任务失败，TaskId={entry.Name}：{ex.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【后台任务】读取Redis任务列表失败：{ex.Message}");
            }

            foreach (var item in Tasks.Values
                         .Where(item => string.Equals(item.OsClient, normalizedOsClient, StringComparison.OrdinalIgnoreCase)
                                        && string.Equals(item.UserKey, normalizedUserKey, StringComparison.OrdinalIgnoreCase)))
            {
                if (item?.Id.DosIsNullOrWhiteSpace() == false)
                {
                    map[item.Id] = item;
                }
            }

            return map.Values.ToList();
        }

        private static void SaveTask(BackgroundTaskItem item)
        {
            if (item == null
                || item.Id.DosIsNullOrWhiteSpace()
                || item.OsClient.DosIsNullOrWhiteSpace()
                || item.UserKey.DosIsNullOrWhiteSpace())
            {
                return;
            }

            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(item.OsClient);
                cache.HashSet(GetTaskHashKey(item.OsClient, item.UserKey), item.Id, ApplyRuntimeFields(item));
                PruneTaskHash(cache, item.OsClient, item.UserKey);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【后台任务】保存Redis任务失败：{ex.Message}");
            }
        }

        private static bool DeleteTask(string osClient, string userKey, string taskId)
        {
            if (osClient.DosIsNullOrWhiteSpace() || userKey.DosIsNullOrWhiteSpace() || taskId.DosIsNullOrWhiteSpace())
            {
                return false;
            }

            try
            {
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                cache.HashDelete(GetTaskHashKey(osClient, userKey), taskId);
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【后台任务】删除Redis任务失败：{ex.Message}");
                return false;
            }
        }

        private static void PruneTaskHash(IMicroiCache cache, string osClient, string userKey)
        {
            if (cache == null)
            {
                return;
            }

            try
            {
                var key = GetTaskHashKey(osClient, userKey);
                var list = cache.HashGetAllValues<BackgroundTaskItem>(key) ?? new List<BackgroundTaskItem>();
                if (list.Count <= 100)
                {
                    return;
                }

                var removeIds = list
                    .Where(item => item?.Id.DosIsNullOrWhiteSpace() == false)
                    .OrderByDescending(item => IsTerminal(item.Status))
                    .ThenBy(item => item.CreateTime)
                    .Take(list.Count - 100)
                    .Select(item => item.Id)
                    .ToArray();
                if (removeIds.Length > 0)
                {
                    cache.HashDelete(key, removeIds);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【后台任务】修剪Redis任务失败：{ex.Message}");
            }
        }

        private static string GetTaskHashKey(string osClient, string userKey)
        {
            return $"Microi:{osClient}:BackgroundTasks:{userKey}";
        }

        private static bool IsTerminal(string status)
        {
            return status == "Succeeded" || status == "Failed" || status == "Canceled";
        }

        private static BackgroundTaskItem ApplyRuntimeFields(BackgroundTaskItem item)
        {
            var from = item.StartTime ?? item.CreateTime;
            var to = item.EndTime ?? DateTime.Now;
            var seconds = Math.Max(0, Convert.ToInt32((to - from).TotalSeconds));
            item.ElapsedSeconds = seconds;
            item.ElapsedText = FormatElapsed(seconds);
            return item;
        }

        private static string FormatElapsed(int seconds)
        {
            if (seconds < 60)
            {
                return $"{seconds}s";
            }
            if (seconds < 3600)
            {
                return $"{seconds / 60}m {seconds % 60}s";
            }
            return $"{seconds / 3600}h {(seconds % 3600) / 60}m";
        }

        private static JObject SafeToJObject(object value)
        {
            if (value == null)
            {
                return new JObject();
            }

            if (value is JObject jObject)
            {
                return jObject;
            }

            try
            {
                return JObject.FromObject(value);
            }
            catch
            {
                return JObject.FromObject(new { Code = 1, Data = value?.ToString() });
            }
        }
    }
}
