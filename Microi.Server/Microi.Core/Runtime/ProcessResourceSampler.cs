using System;
using System.Buffers;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>在独立线程持续采样可见进程；请求只读取缓存，不执行 ps/top，不采集命令行或环境变量。</summary>
    public static class ProcessResourceSampler
    {
        private const int MaximumProcesses = 2048;
        private static readonly object Gate = new object();
        private static readonly Queue<object> History = new Queue<object>();
        private static object _snapshot;
        private static DateTime _sampledAt;
        private static bool _available;
        private static int _started;

        public static void Start()
        {
            if (Interlocked.Exchange(ref _started, 1) != 0) return;
            new Thread(Run) { IsBackground = true, Name = "Microi process sampler" }.Start();
        }

        public static JObject GetSnapshot()
        {
            Start();
            lock (Gate)
            {
                return JObject.FromObject(new
                {
                    Protocol = "process-resources/v1",
                    Status = _snapshot == null ? "WarmingUp" : _available ? "Available" : "Unavailable",
                    Fresh = _snapshot != null && (DateTime.UtcNow - _sampledAt).TotalSeconds <= 15,
                    SampleIntervalSeconds = 5,
                    Current = _snapshot,
                    Recent = History.ToArray(),
                    Boundary = "CPU 为同一 PID 和启动标识的区间值，100% 表示一个核心；每个进程的 CPU/IO 使用各自实际读取时间窗，顶层 WindowSeconds 仅表示扫描周期。RSS 包含共享页，不能相加当作独占内存。首次采样/进程重建/无权读取/读取被长暂停打断为 null。容器 PID 命名空间不等于 NAS 全部进程。"
                });
            }
        }

        private static void Run()
        {
            var previous = new Dictionary<int, ProcessReading>();
            long previousAt = 0;
            while (true)
            {
                var at = Stopwatch.GetTimestamp();
                try
                {
                    var linux = RuntimeInformation.IsOSPlatform(OSPlatform.Linux);
                    var inContainer = linux && (File.Exists("/.dockerenv") || File.Exists("/run/.containerenv"));
                    // 只接受部署方显式提供的固定只读挂载；HTTP/V8 参数不能选择文件路径。
                    var hostMount = linux && File.Exists("/host/proc/1/stat");
                    var procRoot = hostMount ? "/host/proc" : "/proc";
                    var ticks = linux ? ClockTicks() : 10000000L;
                    var rows = new List<ProcessReading>();
                    var failures = 0;
                    bool truncated;
                    if (linux)
                    {
                        var paths = Directory.EnumerateDirectories(procRoot)
                            .Where(path => int.TryParse(Path.GetFileName(path), out _)).Take(MaximumProcesses + 1).ToArray();
                        truncated = paths.Length > MaximumProcesses;
                        foreach (var path in paths.Take(MaximumProcesses))
                        {
                            try
                            {
                                var cpuReadStarted = Stopwatch.GetTimestamp();
                                var statText = ReadBounded(Path.Combine(path, "stat"), 8192);
                                var cpuReadEnded = Stopwatch.GetTimestamp();
                                var row = ParseStat(statText);
                                if (row == null) { failures++; continue; }
                                row.CpuObservedAtTicks = CapturedTimestamp(cpuReadStarted, cpuReadEnded);
                                var status = ReadBounded(Path.Combine(path, "status"), 16384);
                                row.RssBytes = ReadCounter(status, "VmRSS:", 1024);
                                row.SwapBytes = ReadCounter(status, "VmSwap:", 1024);
                                var ioReadStarted = Stopwatch.GetTimestamp();
                                var io = ReadBounded(Path.Combine(path, "io"), 4096);
                                row.IoObservedAtTicks = CapturedTimestamp(ioReadStarted, Stopwatch.GetTimestamp());
                                row.ReadBytes = ReadCounter(io, "read_bytes:");
                                row.WriteBytes = ReadCounter(io, "write_bytes:");
                                rows.Add(row);
                            }
                            catch { failures++; }
                        }
                    }
                    else
                    {
                        var processes = Process.GetProcesses();
                        truncated = processes.Length > MaximumProcesses;
                        foreach (var process in processes)
                        using (process)
                        {
                            if (rows.Count >= MaximumProcesses) continue;
                            try
                            {
                                var cpuReadStarted = Stopwatch.GetTimestamp();
                                var cpu = process.TotalProcessorTime.Ticks;
                                var cpuReadEnded = Stopwatch.GetTimestamp();
                                rows.Add(new ProcessReading { Pid = process.Id, Name = process.ProcessName, Start = process.StartTime.ToUniversalTime().Ticks, Cpu = cpu,
                                    CpuObservedAtTicks = CapturedTimestamp(cpuReadStarted, cpuReadEnded), RssBytes = process.WorkingSet64, Threads = process.Threads.Count });
                            }
                            catch { failures++; }
                        }
                    }
                    var seconds = previousAt == 0 ? 0 : (at - previousAt) / (double)Stopwatch.Frequency;
                    var projected = rows.Select(row => Delta(row, previous.TryGetValue(row.Pid, out var old) ? old : null, ticks)).ToArray();
                    // 未发现容器标记不等于已验证宿主 PID 视图；Linux 默认只声明当前命名空间。
                    var scope = hostMount ? "HostProcMount" : linux ? "CurrentPidNamespace" : "Host";
                    var result = new
                    {
                        SampledAtUtc = DateTime.UtcNow, WindowSeconds = Math.Round(seconds, 3),
                        Scope = scope, HostProcessesVisible = hostMount || !linux ? (bool?)true : inContainer ? false : (bool?)null,
                        VisibilityReason = linux && !hostMount ? "读取当前 PID 命名空间，未验证宿主全部进程可见；若需 NAS 宿主排行，部署时只读挂载 /proc:/host/proc:ro。镜像更新不会自动新增挂载。" : "读取当前可见操作系统进程，权限拒绝及退出进程计入缺口。",
                        ObservedCount = rows.Count, UnreadableOrExitedCount = failures, Truncated = truncated,
                        CpuUnavailableCount = projected.Count(row => !row.CpuPercentRaw.HasValue),
                        MemoryUnavailableCount = projected.Count(row => !row.RssBytes.HasValue),
                        IoUnavailableCount = projected.Count(row => !row.ReadBytesPerSecond.HasValue || !row.WriteBytesPerSecond.HasValue),
                        ScanDurationMs = Math.Round((Stopwatch.GetTimestamp() - at) * 1000d / Stopwatch.Frequency, 2),
                        TopCpu = projected.OrderByDescending(row => row.CpuPercentRaw ?? -1).Take(10).ToArray(),
                        TopMemory = projected.OrderByDescending(row => row.RssBytes ?? -1).Take(10).ToArray(),
                        TopIo = projected.OrderByDescending(row => (row.ReadBytesPerSecond ?? 0) + (row.WriteBytesPerSecond ?? 0)).Take(10).ToArray()
                    };
                    lock (Gate) { _snapshot = result; _available = true; _sampledAt = DateTime.UtcNow; History.Enqueue(result); while (History.Count > 12) History.Dequeue(); }
                    previous = rows.GroupBy(row => row.Pid).ToDictionary(group => group.Key, group => group.Last());
                    previousAt = at;
                }
                catch (Exception ex)
                {
                    lock (Gate) { _snapshot = new { Status = "Unavailable", Error = ex.GetType().Name, SampledAtUtc = DateTime.UtcNow }; _available = false; _sampledAt = DateTime.MinValue; }
                    previous.Clear(); previousAt = 0;
                }
                Thread.Sleep(5000);
            }
        }

        internal static ProcessReading ParseStat(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return null;
            var first = text.IndexOf('('); var last = text.LastIndexOf(')');
            if (first <= 0 || last <= first || !int.TryParse(text.Substring(0, first).Trim(), out var pid)) return null;
            var fields = text.Substring(last + 1).Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            if (fields.Length < 22 || !long.TryParse(fields[11], out var user) || !long.TryParse(fields[12], out var system)
                || !long.TryParse(fields[19], out var start) || !int.TryParse(fields[17], out var threads) || user < 0 || system < 0 || start < 0) return null;
            var name = new string(text.Substring(first + 1, last - first - 1).Where(ch => !char.IsControl(ch)).Take(80).ToArray());
            return new ProcessReading { Pid = pid, Name = name, Start = start, Cpu = checked(user + system), Threads = threads, State = fields[0] };
        }

        internal static long? ReadCounter(string text, string key, long multiplier = 1)
        {
            if (text == null) return null;
            foreach (var line in text.Split('\n'))
            {
                if (!line.StartsWith(key, StringComparison.Ordinal)) continue;
                var value = line.Substring(key.Length).Trim().Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
                return long.TryParse(value, out var number) && number >= 0 && number <= long.MaxValue / multiplier ? number * multiplier : (long?)null;
            }
            return null;
        }

        // stat/io 在逐进程扫描中的读取位置会随 GC、调度和进程数量变化；用扫描开始时间
        // 作为分母会把本次延迟错误挤进上一段 5 秒。长暂停横跨实际读取时宁可返回缺值。
        internal static long CapturedTimestamp(long before, long after) => before > 0 && after >= before
            && after - before <= Stopwatch.Frequency / 4 ? after : 0;
        private static double CounterWindow(long current, long previous) => current > previous && previous > 0
            ? (current - previous) / (double)Stopwatch.Frequency : 0;

        internal static ProcessRate Delta(ProcessReading current, ProcessReading previous, long ticks)
        {
            var same = previous != null && previous.Pid == current.Pid && previous.Start == current.Start;
            var cpuSeconds = same ? CounterWindow(current.CpuObservedAtTicks, previous.CpuObservedAtTicks) : 0;
            var ioSeconds = same ? CounterWindow(current.IoObservedAtTicks, previous.IoObservedAtTicks) : 0;
            return new ProcessRate
            {
                Pid = current.Pid, Name = current.Name, State = current.State, Threads = current.Threads,
                RssBytes = current.RssBytes, SwapBytes = current.SwapBytes,
                CpuWindowSeconds = cpuSeconds > 0 ? Math.Round(cpuSeconds, 3) : (double?)null,
                IoWindowSeconds = ioSeconds > 0 ? Math.Round(ioSeconds, 3) : (double?)null,
                CpuPercentRaw = cpuSeconds > 0 && ticks > 0 && current.Cpu >= previous.Cpu ? Math.Round((current.Cpu - previous.Cpu) / (double)ticks / cpuSeconds * 100, 2) : (double?)null,
                ReadBytesPerSecond = ioSeconds > 0 ? Rate(current.ReadBytes, previous.ReadBytes, ioSeconds) : null,
                WriteBytesPerSecond = ioSeconds > 0 ? Rate(current.WriteBytes, previous.WriteBytes, ioSeconds) : null
            };
        }
        private static double? Rate(long? current, long? previous, double seconds) => current.HasValue && previous.HasValue && current >= previous ? Math.Round((current.Value - previous.Value) / seconds, 2) : (double?)null;
        private static string ReadBounded(string path, int maximum)
        {
            var buffer = ArrayPool<char>.Shared.Rent(maximum + 1);
            try { using (var reader = new StreamReader(path)) { var length = reader.ReadBlock(buffer, 0, maximum + 1); return length <= maximum ? new string(buffer, 0, length) : null; } }
            catch { return null; }
            finally { ArrayPool<char>.Shared.Return(buffer); }
        }
        [DllImport("libc", EntryPoint = "sysconf")] private static extern long Sysconf(int name);
        private static long ClockTicks() { try { return Sysconf(2); } catch { return 0; } }
        internal sealed class ProcessReading
        {
            internal int Pid; internal string Name; internal string State; internal long Start; internal long Cpu; internal int Threads;
            internal long? RssBytes; internal long? SwapBytes; internal long? ReadBytes; internal long? WriteBytes;
            internal long CpuObservedAtTicks; internal long IoObservedAtTicks;
        }
        internal sealed class ProcessRate
        {
            public int Pid { get; set; } public string Name { get; set; } public string State { get; set; } public int Threads { get; set; }
            public long? RssBytes { get; set; } public long? SwapBytes { get; set; } public double? CpuPercentRaw { get; set; }
            public double? CpuWindowSeconds { get; set; } public double? IoWindowSeconds { get; set; }
            public double? ReadBytesPerSecond { get; set; } public double? WriteBytesPerSecond { get; set; }
        }
    }
}
