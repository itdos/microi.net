using System.Globalization;

namespace Microi.Panel.Panel;

/// <summary>新启服务前保留系统余量，活动插件的内存上限不允许累计超过主机容量。</summary>
public static class PanelCapacity
{
    private const long MiB = 1024L * 1024;
    public static long? AvailableMemory()
    {
        if (!OperatingSystem.IsLinux()) return null;
        try
        {
            var line = File.ReadLines("/proc/meminfo").FirstOrDefault(x => x.StartsWith("MemAvailable:", StringComparison.Ordinal));
            return line == null ? null : long.Parse(line.Split(' ', StringSplitOptions.RemoveEmptyEntries)[1], CultureInfo.InvariantCulture) * 1024;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or FormatException) { return null; }
    }
    public static void Assert(long totalBytes, long? availableBytes, int requestedMiB, IEnumerable<int> runningLimitsMiB)
    {
        var required = (requestedMiB + 512L) * MiB;
        var committed = runningLimitsMiB.Sum(x => (long)x) * MiB;
        if (totalBytes <= 0 || required + committed > totalBytes)
            throw new OpsException("活动插件的内存上限加上新服务已超过主机容量与 512 MiB 系统余量；请停止不需要的服务或扩容。", 409);
        if (availableBytes.HasValue && availableBytes.Value < required)
            throw new OpsException("主机当前可用内存不足以启动该服务；请释放其它任务的内存或扩容后继续。", 409);
    }
}
