using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading;

namespace Microi.net
{
    /// <summary>
    /// 独立线程每秒采集固定大小的运行态；请求线程只读取最近 30 个不可变样本。
    /// CPU、I/O wait、GC 和定时唤醒延迟使用同一时间窗，避免把不同窗口相减归因。
    /// 不运行命令、不访问 Docker socket、不枚举宿主进程、不接受客户端文件路径。
    /// </summary>
    public static class RuntimeLatencySampler
    {
        private static readonly object Gate = new object();
        private static readonly Queue<RuntimeLatencySample> Recent = new Queue<RuntimeLatencySample>();
        private static readonly Func<TimeSpan> Pause = Reader<TimeSpan>(typeof(GC).GetMethod("GetTotalPauseDuration", Type.EmptyTypes));
        private static readonly Func<long> Pending = Reader<long>(typeof(ThreadPool).GetProperty("PendingWorkItemCount")?.GetMethod);
        private static int _started;

        public static void Start()
        {
            ProcessResourceSampler.Start();
            if (Interlocked.Exchange(ref _started, 1) != 0) return;
            new Thread(Run) { IsBackground = true, Name = "Microi latency sampler" }.Start();
        }

        public static RuntimeLatencySample[] GetRecent() { lock (Gate) return Recent.ToArray(); }

        private static void Run()
        {
            long lastAt = 0;
            TimeSpan lastCpu = default, lastPause = default;
            long[] lastHost = null;
            long? lastThrottle = null;
            using (var process = Process.GetCurrentProcess())
            while (true)
            {
                var at = Stopwatch.GetTimestamp();
                try
                {
                    var cpu = process.TotalProcessorTime;
                    var pause = Pause?.Invoke() ?? default;
                    var host = ParseCpu(ReadBounded("/proc/stat")?.Split('\n').FirstOrDefault());
                    var throttle = ReadThrottle();
                    if (lastAt > 0)
                    {
                        var ms = (at - lastAt) * 1000d / Stopwatch.Frequency;
                        var sample = new RuntimeLatencySample
                        {
                            EndedAtUtc = DateTime.UtcNow, WindowMs = Math.Round(ms, 2),
                            SamplerWakeDelayMs = Math.Round(Math.Max(0, ms - 1000), 2),
                            ProcessCpuPercentRaw = Math.Round(Math.Max(0, (cpu - lastCpu).TotalMilliseconds) / ms * 100, 2),
                            GcPauseMs = Pause == null ? (double?)null : Math.Round(Math.Max(0, (pause - lastPause).TotalMilliseconds), 2),
                            ThreadPoolPendingWorkItems = Pending?.Invoke(),
                            HostCpu = CpuDelta(lastHost, host),
                            CpuThrottledMs = throttle.HasValue && lastThrottle.HasValue && throttle >= lastThrottle ? (throttle - lastThrottle) / 1000000d : null
                        };
                        lock (Gate) { Recent.Enqueue(sample); while (Recent.Count > 30) Recent.Dequeue(); }
                    }
                    lastCpu = cpu; lastPause = pause; lastHost = host; lastThrottle = throttle;
                }
                catch (Exception ex)
                {
                    lock (Gate)
                    {
                        Recent.Enqueue(new RuntimeLatencySample { EndedAtUtc = DateTime.UtcNow, Error = ex.GetType().Name });
                        while (Recent.Count > 30) Recent.Dequeue();
                    }
                    // 采集失败后的第一份成功读数重新建立基线，不能跨缺口制造百分比。
                    lastAt = 0;
                    Thread.Sleep(1000);
                    continue;
                }
                lastAt = at;
                var elapsed = (Stopwatch.GetTimestamp() - at) * 1000d / Stopwatch.Frequency;
                Thread.Sleep(Math.Max(1, 1000 - (int)Math.Min(999, elapsed)));
            }
        }

        internal static long[] ParseCpu(string line)
        {
            if (line == null) return null;
            var parts = line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 5 || parts[0] != "cpu") return null;
            var values = new long[8];
            // guest 已包含在 user/nice 中，不能再次相加。旧内核缺少的后缀按零处理。
            for (var i = 0; i < values.Length && i + 1 < parts.Length; i++)
                if (!long.TryParse(parts[i + 1], out values[i]) || values[i] < 0) return null;
            return values;
        }

        internal static HostCpuInterval CpuDelta(long[] before, long[] after)
        {
            if (before == null || after == null || before.Length != 8 || after.Length != 8) return null;
            var delta = new long[8];
            for (var i = 0; i < 8; i++) { delta[i] = after[i] - before[i]; if (delta[i] < 0) return null; }
            var total = delta.Sum();
            if (total <= 0) return null;
            return new HostCpuInterval
            {
                BusyPercent = Math.Round((delta[0] + delta[1] + delta[2] + delta[5] + delta[6]) * 100d / total, 2),
                IoWaitPercent = Math.Round(delta[4] * 100d / total, 2),
                StealPercent = Math.Round(delta[7] * 100d / total, 2),
                IdlePercent = Math.Round(delta[3] * 100d / total, 2)
            };
        }

        private static long? ReadThrottle()
        {
            foreach (var path in new[] { "/sys/fs/cgroup/cpu.stat", "/sys/fs/cgroup/cpu/cpu.stat", "/sys/fs/cgroup/cpu,cpuacct/cpu.stat" })
            {
                var text = ReadBounded(path);
                if (text == null) continue;
                foreach (var line in text.Split('\n'))
                {
                    var pair = line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                    if (pair.Length != 2 || !long.TryParse(pair[1], out var value) || value < 0) continue;
                    if (pair[0] == "throttled_time") return value;
                    if (pair[0] == "throttled_usec" && value <= long.MaxValue / 1000) return value * 1000;
                }
            }
            return null;
        }

        private static string ReadBounded(string path)
        {
            try
            {
                if (!File.Exists(path)) return null;
                using (var reader = new StreamReader(path))
                { var chars = new char[16384]; var n = reader.Read(chars, 0, chars.Length); return new string(chars, 0, n); }
            }
            catch { return null; }
        }
        private static Func<T> Reader<T>(MethodInfo method)
        { try { return method == null ? null : (Func<T>)method.CreateDelegate(typeof(Func<T>)); } catch { return null; } }
    }

    public sealed class HostCpuInterval
    {
        public double BusyPercent { get; set; }
        public double IoWaitPercent { get; set; }
        public double StealPercent { get; set; }
        public double IdlePercent { get; set; }
    }
    public sealed class RuntimeLatencySample
    {
        public string Boundary => "当前节点同窗进程/主机样本，不能当作某个请求独占 CPU；唤醒延迟可能含 GC/调度，IoWait 为内核估计，缺值为不可用。";
        public DateTime EndedAtUtc { get; set; }
        public double WindowMs { get; set; }
        public double SamplerWakeDelayMs { get; set; }
        public double ProcessCpuPercentRaw { get; set; }
        public double? GcPauseMs { get; set; }
        public long? ThreadPoolPendingWorkItems { get; set; }
        public HostCpuInterval HostCpu { get; set; }
        public double? CpuThrottledMs { get; set; }
        public string Error { get; set; }
    }
}
