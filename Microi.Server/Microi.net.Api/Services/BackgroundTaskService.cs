using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
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
        public string Msg { get; set; }
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
        private static readonly SemaphoreSlim RunnerGate = new SemaphoreSlim(64, 64);
        private static IHubContext<DiyWebSocket> HubContext;

        public static void ConfigureHubContext(IHubContext<DiyWebSocket> hubContext)
        {
            HubContext = hubContext;
            BackgroundTaskRuntime.UpdateProgressHandler = UpdateProgress;
        }

        public static BackgroundTaskItem StartApiEngine(string osClient, string userKey, string title, JObject apiParam)
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
                Msg = "",
                CreateTime = DateTime.Now
            };

            var cts = new CancellationTokenSource();
            Tasks[item.Id] = item;
            CancellationTokens[item.Id] = cts;
            NotifyUser(item);
            _ = Task.Run(() => RunApiEngineTask(item, apiParam ?? new JObject(), cts.Token));
            return ApplyRuntimeFields(item);
        }

        public static List<BackgroundTaskItem> List(string osClient, string userKey)
        {
            return Tasks.Values
                .Where(item => string.Equals(item.OsClient, osClient ?? "", StringComparison.OrdinalIgnoreCase)
                               && string.Equals(item.UserKey, userKey ?? "", StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(item => item.CreateTime)
                .Take(100)
                .Select(ApplyRuntimeFields)
                .ToList();
        }

        public static int ClearCompleted(string osClient, string userKey)
        {
            var ids = Tasks.Values
                .Where(item => string.Equals(item.OsClient, osClient ?? "", StringComparison.OrdinalIgnoreCase)
                               && string.Equals(item.UserKey, userKey ?? "", StringComparison.OrdinalIgnoreCase)
                               && IsTerminal(item.Status))
                .Select(item => item.Id)
                .ToList();

            var count = 0;
            foreach (var id in ids)
            {
                CancellationTokens.TryRemove(id, out var cts);
                cts?.Dispose();
                if (Tasks.TryRemove(id, out _))
                {
                    count++;
                }
            }
            return count;
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

        public static bool UpdateProgress(string taskId, int? progress, string msg)
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
            if (!msg.DosIsNullOrWhiteSpace())
            {
                item.Msg = msg;
            }
            NotifyUser(item);
            return true;
        }

        public static async Task SendTaskListToUserAsync(string osClient, string userKey)
        {
            if (HubContext == null || osClient.DosIsNullOrWhiteSpace() || userKey.DosIsNullOrWhiteSpace())
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

                await HubContext.Clients.Clients(clientInfo.ConnectionIds)
                    .SendAsync("ReceiveBackgroundTaskList", List(osClient, userKey))
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【后台任务】推送任务列表失败：{ex.Message}");
            }
        }

        private static async Task RunApiEngineTask(BackgroundTaskItem item, JObject apiParam, CancellationToken cancellationToken)
        {
            var gateAcquired = false;
            try
            {
                await RunnerGate.WaitAsync(cancellationToken).ConfigureAwait(false);
                gateAcquired = true;
                cancellationToken.ThrowIfCancellationRequested();

                item.Status = "Running";
                item.StatusText = "执行中";
                item.Progress = 10;
                item.StartTime = DateTime.Now;
                NotifyUser(item);

                apiParam["_BackgroundTaskId"] = item.Id;
                apiParam["_BackgroundTaskTitle"] = item.Title ?? "";
                dynamic result = await MicroiEngine.ApiEngine.RunAsync(apiParam).ConfigureAwait(false);
                item.Result = SafeToJObject(result);
                item.Msg = item.Result?["Msg"]?.ToString() ?? "";
                item.Progress = 100;
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
                item.Msg = item.Msg.DosIsNullOrWhiteSpace() ? "任务已停止。" : item.Msg;
                item.Result = JObject.FromObject(new { Code = 0, Msg = item.Msg });
            }
            catch (Exception ex)
            {
                item.Status = "Failed";
                item.StatusText = "执行失败";
                item.Progress = 100;
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
                CancellationTokens.TryRemove(item.Id, out var cts);
                cts?.Dispose();
                NotifyUser(item);
            }
        }

        private static void NotifyUser(BackgroundTaskItem item)
        {
            if (item == null)
            {
                return;
            }

            _ = Task.Run(() => SendTaskListToUserAsync(item.OsClient, item.UserKey));
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
