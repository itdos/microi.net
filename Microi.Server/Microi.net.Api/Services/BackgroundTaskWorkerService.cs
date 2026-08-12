using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// Hosts the durable tenant task worker. Claiming, leases, fencing and recovery
    /// live in Microi.Core so every API/Worker node follows the same protocol.
    /// </summary>
    public sealed class BackgroundTaskWorkerService : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            BackgroundTaskWorkerRuntime.MarkHostStarted();

            // SaaS clients and automatic schema upgrades initialize during startup.
            // A short delay avoids noisy table-missing scans while preserving recovery.
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(8), stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }

            var consecutiveFailures = 0;
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    BackgroundTaskWorkerRuntime.MarkLoopStarted();
                    System.Console.WriteLine(
                        $"Microi：【✅成功】主租户[{OsClientDefault.OsClient}]后台任务Worker已启动；已加载租户数={OsClientExtend.ClientList.Count}。");
                    await BackgroundTaskService.RunWorkerLoopAsync(
                            stoppingToken,
                            BackgroundTaskWorkerRuntime.MarkHeartbeat)
                        .ConfigureAwait(false);

                    if (stoppingToken.IsCancellationRequested) break;
                    throw new InvalidOperationException("后台任务Worker循环意外退出。");
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    consecutiveFailures++;
                    BackgroundTaskWorkerRuntime.MarkFault(ex);
                    System.Console.WriteLine(
                        $"Microi：【Error异常】后台任务Worker循环异常，将自动恢复：{ex.GetBaseException().Message}");

                    var retryDelay = TimeSpan.FromSeconds(Math.Min(30, Math.Max(2, consecutiveFailures * 2)));
                    try
                    {
                        await Task.Delay(retryDelay, stoppingToken).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                }
            }

            BackgroundTaskWorkerRuntime.MarkStopped();
        }
    }

    /// <summary>
    /// Current-node diagnostics only. Durable task ownership and completion remain
    /// in mci_background_task; this in-memory state is never used for correctness.
    /// </summary>
    internal static class BackgroundTaskWorkerRuntime
    {
        private static long _hostStartedUtcTicks;
        private static long _loopStartedUtcTicks;
        private static long _lastHeartbeatUtcTicks;
        private static long _lastFaultUtcTicks;
        private static long _stoppedUtcTicks;
        private static int _restartCount;
        private static string _lastError = "";

        public static void MarkHostStarted()
        {
            Interlocked.Exchange(ref _hostStartedUtcTicks, DateTime.UtcNow.Ticks);
            Interlocked.Exchange(ref _stoppedUtcTicks, 0);
        }

        public static void MarkLoopStarted()
        {
            Interlocked.Exchange(ref _loopStartedUtcTicks, DateTime.UtcNow.Ticks);
            Interlocked.Exchange(ref _lastHeartbeatUtcTicks, DateTime.UtcNow.Ticks);
        }

        public static void MarkHeartbeat()
        {
            Interlocked.Exchange(ref _lastHeartbeatUtcTicks, DateTime.UtcNow.Ticks);
        }

        public static void MarkFault(Exception error)
        {
            Interlocked.Increment(ref _restartCount);
            Interlocked.Exchange(ref _lastFaultUtcTicks, DateTime.UtcNow.Ticks);
            Volatile.Write(ref _lastError, SafeError(error));
        }

        public static void MarkStopped()
        {
            Interlocked.Exchange(ref _stoppedUtcTicks, DateTime.UtcNow.Ticks);
        }

        public static JObject Snapshot()
        {
            var now = DateTime.UtcNow;
            var heartbeat = ReadUtc(ref _lastHeartbeatUtcTicks);
            var stopped = ReadUtc(ref _stoppedUtcTicks);
            return JObject.FromObject(new
            {
                ProcessId = Environment.ProcessId,
                HostStartedUtc = Format(ReadUtc(ref _hostStartedUtcTicks)),
                LoopStartedUtc = Format(ReadUtc(ref _loopStartedUtcTicks)),
                LastHeartbeatUtc = Format(heartbeat),
                LastFaultUtc = Format(ReadUtc(ref _lastFaultUtcTicks)),
                StoppedUtc = Format(stopped),
                RestartCount = Volatile.Read(ref _restartCount),
                LastError = Volatile.Read(ref _lastError) ?? "",
                LoopHealthy = stopped == null
                              && heartbeat.HasValue
                              && now - heartbeat.Value <= TimeSpan.FromSeconds(10)
            });
        }

        private static DateTime? ReadUtc(ref long ticks)
        {
            var value = Interlocked.Read(ref ticks);
            return value > 0 ? new DateTime(value, DateTimeKind.Utc) : null;
        }

        private static string Format(DateTime? value)
        {
            return value?.ToString("O") ?? "";
        }

        private static string SafeError(Exception error)
        {
            var text = error?.GetBaseException()?.Message ?? error?.Message ?? "未知异常";
            text = text.Replace("\r", " ").Replace("\n", " ").Trim();
            return text.Length <= 1000 ? text : text.Substring(0, 1000);
        }
    }
}
