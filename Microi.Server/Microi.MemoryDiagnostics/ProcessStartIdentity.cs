using System.Diagnostics;
using System.Globalization;

namespace Microi.MemoryDiagnostics;

/// <summary>Linux 启动标识使用内核 jiffies，避免各进程按当前时间反推 UTC 导致微小漂移。
/// Windows 使用系统提供的启动 FILETIME；同一 PID 被复用时标识会改变。</summary>
public static class ProcessStartIdentity
{
    public static long Read(int pid)
    {
        if (!OperatingSystem.IsLinux())
        {
            using var process = Process.GetProcessById(pid);
            return process.StartTime.ToUniversalTime().Ticks;
        }
        var stat = File.ReadAllText("/proc/" + pid.ToString(CultureInfo.InvariantCulture) + "/stat");
        // comm 被括号包裹，允许空格；不能直接按整行空格切第 22 列。
        var end = stat.LastIndexOf(')');
        if (end < 0 || stat.Length > 4096) throw new InvalidDataException("Invalid process identity.");
        var fields = stat[(end + 1)..].Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return long.Parse(fields[19], CultureInfo.InvariantCulture);
    }
}
