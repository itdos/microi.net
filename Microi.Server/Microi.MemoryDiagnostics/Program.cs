using Microi.MemoryDiagnostics;

// 独立诊断进程，不开放 HTTP。容器整体退出后，也可在新进程中解析已落盘片段。
if (args.Length == 3 && args[0] == "analyze")
{
    using var lease = new FileStream(args[2] + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
    using var deadline = new Timer(_ => Environment.Exit(2), null, 45000, Timeout.Infinite);
    try
    {
        var segment = args[2] + ".segment.json";
        TraceAnalysis.Write(args[1], segment);
        TraceAnalysis.MergeRecovered(args[2], segment);
        File.Delete(segment);
    }
    catch (Exception ex)
    {
        File.WriteAllText(args[2] + ".error", ex.GetType().Name);
        Environment.ExitCode = 1;
    }
    return;
}
if (args.Length != 4 || !int.TryParse(args[0], out var pid) || !long.TryParse(args[1], out var startedTicks)
    || !Guid.TryParseExact(args[2], "N", out _))
    throw new ArgumentException("Expected parent PID, stable process start identity, boot id and diagnostic directory.");
await new AllocationCollector(pid, startedTicks, args[2], Path.GetFullPath(args[3])).RunAsync();
