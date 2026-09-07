using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Microi.net.Api;

public sealed class MemoryDiagnosticsMetrics
{
    public DateTime AtUtc { get; set; }
    public long RssBytes { get; set; }
    public long PrivateBytes { get; set; }
    public long ManagedBytes { get; set; }
    public long GcHeapBytes { get; set; }
    public long GcCommittedBytes { get; set; }
    public long GcFragmentedBytes { get; set; }
    public double GcPausePercent { get; set; }
    public long TotalAllocatedBytes { get; set; }
    public double AllocationBytesPerSecond { get; set; }
    public int Gen2Collections { get; set; }
    public long? HostTotalBytes { get; set; }
    public long? HostAvailableBytes { get; set; }
    public long? SwapTotalBytes { get; set; }
    public long? SwapFreeBytes { get; set; }
    public long? ContainerCurrentBytes { get; set; }
    public long? ContainerLimitBytes { get; set; }
    public long? ContainerOomKillCount { get; set; }
    public long? ContainerOomCount { get; set; }
    public long? DiskAvailableBytes { get; set; }
    public string HostMemorySource { get; set; } = "Unavailable";
    public string ContainerMemorySource { get; set; } = "Unavailable";
    public string Error { get; set; } = "";

    public static MemoryDiagnosticsMetrics Read(string directory, MemoryDiagnosticsMetrics? previous)
    {
        var value = new MemoryDiagnosticsMetrics { AtUtc = DateTime.UtcNow };
        try
        {
            using var process = Process.GetCurrentProcess();
            process.Refresh();
            value.RssBytes = process.WorkingSet64; value.PrivateBytes = process.PrivateMemorySize64;
            value.ManagedBytes = GC.GetTotalMemory(false);
            var gc = GC.GetGCMemoryInfo();
            value.GcHeapBytes = gc.HeapSizeBytes; value.GcCommittedBytes = gc.TotalCommittedBytes;
            value.GcFragmentedBytes = gc.FragmentedBytes; value.GcPausePercent = gc.PauseTimePercentage;
            value.TotalAllocatedBytes = GC.GetTotalAllocatedBytes(false); value.Gen2Collections = GC.CollectionCount(2);
            if (previous != null) value.AllocationBytesPerSecond = Math.Max(0, value.TotalAllocatedBytes - previous.TotalAllocatedBytes)
                / Math.Max(.1, (value.AtUtc - previous.AtUtc).TotalSeconds);
            if (OperatingSystem.IsLinux())
            {
                var memory = KeyValues("/proc/meminfo", ':', 1024);
                value.HostTotalBytes = memory.GetValueOrDefault("MemTotal"); value.HostAvailableBytes = memory.GetValueOrDefault("MemAvailable");
                value.SwapTotalBytes = memory.GetValueOrDefault("SwapTotal"); value.SwapFreeBytes = memory.GetValueOrDefault("SwapFree");
                value.HostMemorySource = "/proc/meminfo";
                // Containerized cgroup namespaces normally expose the current group at
                // the mount root. Host processes resolve their own membership as well.
                var group = File.ReadLines("/proc/self/cgroup").FirstOrDefault(l => l.StartsWith("0::"))?.Substring(3).TrimStart('/');
                var v2 = "/sys/fs/cgroup";
                if (!File.Exists(Path.Combine(v2, "memory.current")) && group != null) v2 = Path.Combine(v2, group);
                if (File.Exists(Path.Combine(v2, "memory.current")))
                {
                    value.ContainerMemorySource = "cgroup-v2";
                    value.ContainerCurrentBytes = Number(Path.Combine(v2, "memory.current")); value.ContainerLimitBytes = Number(Path.Combine(v2, "memory.max"));
                    var events = KeyValues(Path.Combine(v2, "memory.events"), ' ', 1);
                    value.ContainerOomKillCount = events.GetValueOrDefault("oom_kill"); value.ContainerOomCount = events.GetValueOrDefault("oom");
                }
                else
                {
                    var v1 = "/sys/fs/cgroup/memory";
                    var membership = File.ReadLines("/proc/self/cgroup").FirstOrDefault(l => l.Split(':')[1].Split(',').Contains("memory"))?.Split(':')[2].TrimStart('/');
                    if (!File.Exists(Path.Combine(v1, "memory.usage_in_bytes")) && membership != null) v1 = Path.Combine(v1, membership);
                    value.ContainerCurrentBytes = Number(Path.Combine(v1, "memory.usage_in_bytes")); value.ContainerLimitBytes = Number(Path.Combine(v1, "memory.limit_in_bytes"));
                    if (value.ContainerCurrentBytes != null) value.ContainerMemorySource = "cgroup-v1";
                }
            }
            else if (OperatingSystem.IsWindows())
            {
                var status = new MemoryStatus { Length = (uint)Marshal.SizeOf<MemoryStatus>() };
                if (GlobalMemoryStatusEx(ref status))
                {
                    value.HostTotalBytes = (long)status.TotalPhysical; value.HostAvailableBytes = (long)status.AvailablePhysical;
                    value.HostMemorySource = "GlobalMemoryStatusEx";
                }
            }
            var full = Path.GetFullPath(directory);
            value.DiskAvailableBytes = DriveInfo.GetDrives().Where(d => full.StartsWith(d.Name, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(d => d.Name.Length).FirstOrDefault()?.AvailableFreeSpace;
        }
        catch (Exception ex) { value.Error = ex.GetType().Name; }
        return value;
    }

    public static string[] Triggers(MemoryDiagnosticsMetrics current, MemoryDiagnosticsMetrics? tenSecondsAgo)
    {
        var result = new List<string>();
        if (current.HostTotalBytes > 0 && current.HostAvailableBytes < Math.Min(2L << 30, current.HostTotalBytes.Value / 10)) result.Add("HostMemoryPressure");
        if (current.ContainerLimitBytes > 0 && current.ContainerLimitBytes < long.MaxValue / 2
            && current.ContainerCurrentBytes >= current.ContainerLimitBytes * .8) result.Add("ContainerMemoryPressure");
        if (tenSecondsAgo != null && current.RssBytes - tenSecondsAgo.RssBytes >= 256L * 1024 * 1024) result.Add("RapidRssGrowth");
        if (current.AllocationBytesPerSecond >= 128L * 1024 * 1024) result.Add("HighAllocationRate");
        if (tenSecondsAgo?.ContainerOomKillCount != null && current.ContainerOomKillCount > tenSecondsAgo.ContainerOomKillCount) result.Add("CgroupOomKillObserved");
        if (current.DiskAvailableBytes is >= 0 and < 256L * 1024 * 1024) result.Add("DiskSpacePressure");
        return result.ToArray();
    }

    private static long? Number(string path)
    {
        try { return long.TryParse(File.ReadAllText(path).Trim(), out var n) && n >= 0 ? n : null; } catch { return null; }
    }
    private static Dictionary<string, long?> KeyValues(string path, char separator, long multiplier)
    {
        var values = new Dictionary<string, long?>();
        foreach (var line in File.ReadLines(path).Take(100))
        {
            var index = line.IndexOf(separator);
            if (index > 0 && long.TryParse(line[(index + 1)..].Trim().Split(' ')[0], out var n)) values[line[..index]] = n * multiplier;
        }
        return values;
    }
    [StructLayout(LayoutKind.Sequential)] private struct MemoryStatus
    {
        public uint Length, Load;
        public ulong TotalPhysical, AvailablePhysical, TotalPage, AvailablePage, TotalVirtual, AvailableVirtual, AvailableExtended;
    }
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatus buffer);
}
