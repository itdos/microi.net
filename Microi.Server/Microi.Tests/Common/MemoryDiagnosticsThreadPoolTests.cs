using Microi.net.Api;

namespace Microi.Tests.Common;

public sealed class MemoryDiagnosticsThreadPoolTests
{
    [Fact]
    public void Snapshot_RecordsThreadPoolQueueAndWorkers()
    {
        var metrics = MemoryDiagnosticsMetrics.Read(AppContext.BaseDirectory, null);
        var type = typeof(MemoryDiagnosticsMetrics);
        Assert.True(type.GetProperty("ThreadPoolPendingWorkItems")?.GetValue(metrics) is long);
        Assert.True(type.GetProperty("ThreadPoolThreads")?.GetValue(metrics) is int threads && threads > 0);
        Assert.True(type.GetProperty("ThreadPoolAvailableWorkers")?.GetValue(metrics) is int);
        Assert.True(type.GetProperty("ThreadPoolMaxWorkers")?.GetValue(metrics) is int);
    }

    [Fact]
    public void SustainedBacklog_TriggersIncidentWithoutCallingItStarvation()
    {
        var previous = new MemoryDiagnosticsMetrics();
        var current = new MemoryDiagnosticsMetrics();
        var pending = typeof(MemoryDiagnosticsMetrics).GetProperty("ThreadPoolPendingWorkItems");
        var threads = typeof(MemoryDiagnosticsMetrics).GetProperty("ThreadPoolThreads");
        Assert.NotNull(pending);
        Assert.NotNull(threads);
        pending.SetValue(previous, 128L);
        pending.SetValue(current, 130L);
        threads.SetValue(current, Math.Max(16, Environment.ProcessorCount * 2));
        Assert.Contains("SustainedThreadPoolBacklog", MemoryDiagnosticsMetrics.Triggers(current, previous));
    }

    [Fact]
    public void SustainedSharedGateWait_TriggersIncidentWhenMemoryIsNormal()
    {
        var previous = new MemoryDiagnosticsMetrics
        {
            PressureV8GlobalActive = 128, PressureV8GlobalLimit = 128, PressureV8GlobalWaiting = 2
        };
        var current = new MemoryDiagnosticsMetrics
        {
            PressureV8GlobalActive = 128, PressureV8GlobalLimit = 128, PressureV8GlobalWaiting = 3
        };
        Assert.Contains("SustainedRequestGateWait", MemoryDiagnosticsMetrics.Triggers(current, previous));
    }
}
