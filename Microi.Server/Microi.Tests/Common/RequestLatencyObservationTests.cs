using Dos.Common;
using Microi.net;
using System.Diagnostics;

namespace Microi.Tests.Common;

public class RequestLatencyObservationTests
{
    [Fact]
    public void EveryFixedDimension_IsRecordedWithoutSilentlyDroppingNewParts()
    {
        using var session = RequestLatencyObservation.Begin();
        var dimensions = Enum.GetValues<RequestLatencyObservation.Part>();
        foreach (var part in dimensions) { using var m = RequestLatencyObservation.Measure(part); }
        var parts = session.Capture().Parts;
        Assert.Equal(dimensions.Length, parts.Count);
        Assert.All(parts, p => Assert.Equal(1, p.Count));
        Assert.Contains(parts, p => p.Part == "FormAuthorization");
        Assert.Contains(parts, p => p.Part == "AuthorizationVersion");
    }

    [Fact]
    public async Task AsyncRequestsAndParallelChildren_KeepSeparateIdentityAndExactCounts()
    {
        var requests = Enumerable.Range(0, 8).Select(async index =>
        {
            using var session = RequestLatencyObservation.Begin();
            await Task.WhenAll(Enumerable.Range(0, index + 1).Select(async _ =>
            {
                using var measurement = RequestLatencyObservation.Measure(RequestLatencyObservation.Part.RedisRead);
                await Task.Delay(5);
            }));
            var metric = Assert.Single(session.Capture().Parts);
            Assert.Equal(index + 1, metric.Count);
            Assert.Equal("RedisRead", metric.Part);
            Assert.True(metric.TotalMs > 0);
        });
        await Task.WhenAll(requests);
        Assert.Null(RequestLatencyObservation.Current);
    }

    [Fact]
    public async Task ExceptionsAreMeasured_AndLateBackgroundCompletionCannotChangeClosedRequest()
    {
        var session = RequestLatencyObservation.Begin();
        Assert.Throws<InvalidOperationException>((Action)(() =>
        {
            using var measurement = RequestLatencyObservation.Measure(RequestLatencyObservation.Part.DatabaseCommand);
            throw new InvalidOperationException();
        }));
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var finish = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var background = Task.Run(async () =>
        {
            using var measurement = RequestLatencyObservation.Measure(RequestLatencyObservation.Part.RedisRead);
            started.SetResult(); await finish.Task;
        });
        await started.Task;
        session.Dispose(); finish.SetResult(); await background;
        Assert.Equal("DatabaseCommand", Assert.Single(session.Capture().Parts).Part);
        Assert.Null(RequestLatencyObservation.Current);
    }

    [Fact]
    public async Task SequentialPhasesPartitionTotal_NestedSessionRestoresParent()
    {
        using var parent = RequestLatencyObservation.Begin();
        await Task.Delay(5);
        RequestLatencyObservation.MarkRoutingEnd();
        RequestLatencyObservation.MarkActionStart();
        using (var child = RequestLatencyObservation.Begin())
        { using var measurement = RequestLatencyObservation.Measure(RequestLatencyObservation.Part.RedisRead); }
        Assert.Same(parent, RequestLatencyObservation.Current);
        await Task.Delay(5);
        RequestLatencyObservation.MarkActionEnd();
        await Task.Delay(5);
        var s = parent.Capture();
        Assert.Empty(s.Parts);
        Assert.True(s.RoutingMs > 0 && s.RoutingMs <= s.BeforeActionMs);
        Assert.InRange(Math.Abs(s.TotalMs - (s.BeforeActionMs!.Value + s.ActionMs!.Value + s.AfterActionMs!.Value)), 0, 0.003);
    }

    [Fact]
    public void HotPathMeasurements_DoNotAllocatePerOperation()
    {
        using var session = RequestLatencyObservation.Begin();
        for (var i = 0; i < 10000; i++) { using var m = RequestLatencyObservation.Measure(RequestLatencyObservation.Part.RedisRead); }
        var allocated = GC.GetAllocatedBytesForCurrentThread();
        var sw = Stopwatch.StartNew();
        for (var i = 0; i < 100000; i++) { using var m = RequestLatencyObservation.Measure(RequestLatencyObservation.Part.RedisRead); }
        sw.Stop();
        var bytes = GC.GetAllocatedBytesForCurrentThread() - allocated;
        Assert.True(bytes < 1024, $"100000 measurements allocated {bytes} bytes");
        Assert.Equal(110000, Assert.Single(session.Capture().Parts).Count);
        // 计时只输出作为成本证据，不用繁忙 CI 的墙钟速度作为脆弱通过门。
        Console.WriteLine($"Latency measurement: {sw.Elapsed.TotalMilliseconds:F2} ms / 100000; {bytes} allocated bytes");
    }

    [Fact]
    public void LinuxCpu_SeparatesIoWaitAndSteal_WithoutDoubleCountingGuest()
    {
        var a = RuntimeLatencySampler.ParseCpu("cpu 100 0 100 100 100 0 0 0 50 0");
        var b = RuntimeLatencySampler.ParseCpu("cpu 110 0 110 120 150 0 0 10 60 0");
        var sample = RuntimeLatencySampler.CpuDelta(a, b)!;
        Assert.Equal(20, sample.BusyPercent);
        Assert.Equal(50, sample.IoWaitPercent);
        Assert.Equal(20, sample.IdlePercent);
        Assert.Equal(10, sample.StealPercent);
    }

    [Fact]
    public void MissingOrResetLinuxCounters_AreUnavailableInsteadOfHealthyZero()
    {
        Assert.Null(RuntimeLatencySampler.ParseCpu(null));
        Assert.Null(RuntimeLatencySampler.ParseCpu("cpu invalid"));
        var a = RuntimeLatencySampler.ParseCpu("cpu 10 0 0 10 10 0 0 0");
        Assert.Null(RuntimeLatencySampler.CpuDelta(a, a));
        Assert.Null(RuntimeLatencySampler.CpuDelta(a, RuntimeLatencySampler.ParseCpu("cpu 20 0 0 20 9 0 0 0")));
    }
}
