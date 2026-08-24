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
                ProcessId = System.Diagnostics.Process.GetCurrentProcess().Id,
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
