using System;
using System.Threading;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 当前节点后台任务 Worker 的只读运行快照。
    /// 持久任务的认领、租约、栅栏和完成状态仍以 mci_background_task 为准；
    /// 本内存状态只用于宿主诊断，不参与任务正确性判断。
    /// </summary>
    public static class BackgroundTaskWorkerRuntime
    {
        private static long _hostStartedUtcTicks;
        private static long _loopStartedUtcTicks;
        private static long _lastHeartbeatUtcTicks;
        private static long _lastFaultUtcTicks;
        private static long _lastWakeSignalUtcTicks;
        private static long _lastTenantScanUtcTicks;
        private static long _lastTenantScanDurationMs;
        private static long _slowestTenantScanDurationMs;
        private static long _stoppedUtcTicks;
        private static int _restartCount;
        private static int _wakeSignalCount;
        private static int _pendingWakeLaneCount;
        private static string _lastError = "";
        private static string _lastWakeTenant = "";
        private static string _lastWakeApiEngineKey = "";
        private static string _lastScannedTenant = "";
        private static string _slowestScannedTenant = "";
        private static int _lastTenantScanClaimed;

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

        public static void MarkWakeSignal(string osClient, string apiEngineKey, int pendingLaneCount)
        {
            Interlocked.Exchange(ref _lastWakeSignalUtcTicks, DateTime.UtcNow.Ticks);
            Interlocked.Increment(ref _wakeSignalCount);
            Interlocked.Exchange(ref _pendingWakeLaneCount, Math.Max(0, pendingLaneCount));
            Volatile.Write(ref _lastWakeTenant, osClient ?? "");
            Volatile.Write(ref _lastWakeApiEngineKey, apiEngineKey ?? "");
        }

        public static void MarkPendingWakeLaneCount(int pendingLaneCount)
        {
            Interlocked.Exchange(ref _pendingWakeLaneCount, Math.Max(0, pendingLaneCount));
        }

        public static void MarkTenantScan(string osClient, long elapsedMilliseconds, bool claimed)
        {
            elapsedMilliseconds = Math.Max(0, elapsedMilliseconds);
            Interlocked.Exchange(ref _lastTenantScanUtcTicks, DateTime.UtcNow.Ticks);
            Interlocked.Exchange(ref _lastTenantScanDurationMs, elapsedMilliseconds);
            Interlocked.Exchange(ref _lastTenantScanClaimed, claimed ? 1 : 0);
            Volatile.Write(ref _lastScannedTenant, osClient ?? "");

            while (true)
            {
                var previous = Interlocked.Read(ref _slowestTenantScanDurationMs);
                if (elapsedMilliseconds <= previous) break;
                if (Interlocked.CompareExchange(
                        ref _slowestTenantScanDurationMs,
                        elapsedMilliseconds,
                        previous) != previous)
                {
                    continue;
                }
                Volatile.Write(ref _slowestScannedTenant, osClient ?? "");
                break;
            }
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
                ProcessId = System.Diagnostics.Process.GetCurrentProcess().Id,
                HostStartedUtc = Format(ReadUtc(ref _hostStartedUtcTicks)),
                LoopStartedUtc = Format(ReadUtc(ref _loopStartedUtcTicks)),
                LastHeartbeatUtc = Format(heartbeat),
                LastFaultUtc = Format(ReadUtc(ref _lastFaultUtcTicks)),
                LastWakeSignalUtc = Format(ReadUtc(ref _lastWakeSignalUtcTicks)),
                WakeSignalCount = Volatile.Read(ref _wakeSignalCount),
                PendingWakeTenantCount = Volatile.Read(ref _pendingWakeLaneCount),
                PendingWakeLaneCount = Volatile.Read(ref _pendingWakeLaneCount),
                LastWakeTenant = Volatile.Read(ref _lastWakeTenant) ?? "",
                LastWakeApiEngineKey = Volatile.Read(ref _lastWakeApiEngineKey) ?? "",
                LastTenantScanUtc = Format(ReadUtc(ref _lastTenantScanUtcTicks)),
                LastTenantScanDurationMs = Interlocked.Read(ref _lastTenantScanDurationMs),
                LastScannedTenant = Volatile.Read(ref _lastScannedTenant) ?? "",
                LastTenantScanClaimed = Volatile.Read(ref _lastTenantScanClaimed) == 1,
                SlowestTenantScanDurationMs = Interlocked.Read(ref _slowestTenantScanDurationMs),
                SlowestScannedTenant = Volatile.Read(ref _slowestScannedTenant) ?? "",
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
            return value > 0 ? (DateTime?)new DateTime(value, DateTimeKind.Utc) : null;
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
