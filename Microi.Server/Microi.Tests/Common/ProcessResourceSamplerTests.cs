using Microi.net;

namespace Microi.Tests.Common;

public sealed class ProcessResourceSamplerTests
{
    [Fact]
    public void DelayedScanUsesEachCountersOwnAcquisitionWindow()
    {
        var tick = System.Diagnostics.Stopwatch.Frequency;
        var old = new ProcessResourceSampler.ProcessReading { Pid = 7, Start = 1, Cpu = 0, ReadBytes = 0, WriteBytes = 0, CpuObservedAtTicks = 10 * tick, IoObservedAtTicks = 10 * tick };
        var now = new ProcessResourceSampler.ProcessReading { Pid = 7, Start = 1, Cpu = 2000, ReadBytes = 1000, WriteBytes = 4000, CpuObservedAtTicks = 20 * tick, IoObservedAtTicks = 30 * tick };
        var rate = ProcessResourceSampler.Delta(now, old, 100);
        Assert.Equal(200, rate.CpuPercentRaw);
        Assert.Equal(50, rate.ReadBytesPerSecond);
        Assert.Equal(200, rate.WriteBytesPerSecond);
        Assert.Equal(10, rate.CpuWindowSeconds);
        Assert.Equal(20, rate.IoWindowSeconds);
    }

    [Fact]
    public void LongOrInvalidCounterReadCannotCreateAPercentSpike()
    {
        var tick = System.Diagnostics.Stopwatch.Frequency;
        Assert.Equal(10 * tick + tick / 10, ProcessResourceSampler.CapturedTimestamp(10 * tick, 10 * tick + tick / 10));
        Assert.Equal(0, ProcessResourceSampler.CapturedTimestamp(10 * tick, 12 * tick));
        Assert.Equal(0, ProcessResourceSampler.CapturedTimestamp(10 * tick, 9 * tick));
        var old = new ProcessResourceSampler.ProcessReading { Pid = 1, Start = 1, Cpu = 0, ReadBytes = 0, CpuObservedAtTicks = 10 * tick, IoObservedAtTicks = 10 * tick };
        var now = new ProcessResourceSampler.ProcessReading { Pid = 1, Start = 1, Cpu = 1000, ReadBytes = 1000 };
        var rate = ProcessResourceSampler.Delta(now, old, 100);
        Assert.Null(rate.CpuPercentRaw); Assert.Null(rate.ReadBytesPerSecond);
        Assert.Null(rate.CpuWindowSeconds); Assert.Null(rate.IoWindowSeconds);
    }

    [Fact]
    public void LinuxStat_UsesLastParenthesisAndPreservesNumericProcessNames()
    {
        var fields = Enumerable.Repeat("0", 22).ToArray();
        fields[0] = "S"; fields[11] = "300"; fields[12] = "100"; fields[17] = "7"; fields[19] = "1200";
        var row = ProcessResourceSampler.ParseStat("92 (service ) name2) " + string.Join(' ', fields));
        Assert.NotNull(row); Assert.Equal(92, row.Pid); Assert.Equal("service ) name2", row.Name);
        Assert.Equal(400, row.Cpu); Assert.Equal(1200, row.Start); Assert.Equal(7, row.Threads);
        Assert.Null(ProcessResourceSampler.ParseStat("1 (broken) R 2"));
    }

    [Fact]
    public void CpuAndIoRates_UseSameLifetimeAndActualWindow()
    {
        var tick = System.Diagnostics.Stopwatch.Frequency;
        var old = new ProcessResourceSampler.ProcessReading { Pid = 1, Start = 10, Cpu = 100, ReadBytes = 1000, WriteBytes = 3000, CpuObservedAtTicks = tick, IoObservedAtTicks = tick };
        var now = new ProcessResourceSampler.ProcessReading { Pid = 1, Start = 10, Cpu = 700, ReadBytes = 4000, WriteBytes = 4000, RssBytes = 8192, CpuObservedAtTicks = 3 * tick, IoObservedAtTicks = 3 * tick };
        var rate = ProcessResourceSampler.Delta(now, old, 100);
        Assert.Equal(300, rate.CpuPercentRaw); Assert.Equal(1500, rate.ReadBytesPerSecond);
        Assert.Equal(500, rate.WriteBytesPerSecond); Assert.Equal(8192, rate.RssBytes);
        now.Start = 11;
        var reused = ProcessResourceSampler.Delta(now, old, 100);
        Assert.Null(reused.CpuPercentRaw); Assert.Null(reused.ReadBytesPerSecond);
        Assert.Null(ProcessResourceSampler.Delta(now, null, 100).CpuPercentRaw);
    }

    [Fact]
    public void MissingAccessAndCounterReset_AreUnknownRatherThanZero()
    {
        Assert.Equal(1048576, ProcessResourceSampler.ReadCounter("Name:\tworker\nVmRSS:\t1024 kB\n", "VmRSS:", 1024));
        Assert.Null(ProcessResourceSampler.ReadCounter(null, "VmRSS:", 1024));
        Assert.Null(ProcessResourceSampler.ReadCounter("VmRSS: -1 kB", "VmRSS:", 1024));
        Assert.Null(ProcessResourceSampler.ReadCounter("VmRSS: 9223372036854775807 kB", "VmRSS:", 1024));
        var tick = System.Diagnostics.Stopwatch.Frequency;
        var old = new ProcessResourceSampler.ProcessReading { Pid = 1, Start = 1, Cpu = 100, ReadBytes = 50, CpuObservedAtTicks = tick, IoObservedAtTicks = tick };
        var now = new ProcessResourceSampler.ProcessReading { Pid = 1, Start = 1, Cpu = 1, ReadBytes = 1, CpuObservedAtTicks = 6 * tick, IoObservedAtTicks = 6 * tick };
        var rate = ProcessResourceSampler.Delta(now, old, 100);
        Assert.Null(rate.CpuPercentRaw); Assert.Null(rate.ReadBytesPerSecond); Assert.Null(rate.WriteBytesPerSecond);
    }
}
