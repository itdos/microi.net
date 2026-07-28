using Microi.net;

namespace Microi.Tests.Common;

public sealed class BackgroundTaskProgressTests
{
    [Fact]
    public void UnknownTotal_RemainsIndeterminateWithoutFakeEta()
    {
        var now = new DateTime(2026, 7, 28, 10, 0, 30, DateTimeKind.Utc);
        var estimate = BackgroundTaskProgress.Calculate(
            now,
            now.AddSeconds(-30),
            current: 10,
            total: 0,
            explicitProgress: null,
            previousSampleTime: null,
            previousSampleCurrent: 0,
            previousThroughput: null,
            previousSampleCount: 0);

        Assert.Equal("Indeterminate", estimate.ProgressMode);
        Assert.Equal(0, estimate.Progress);
        Assert.Null(estimate.EstimatedEndTime);
        Assert.Null(estimate.RemainingSeconds);
    }

    [Fact]
    public void UnitProgress_ComputesPercentAndEtaFromCommittedThroughput()
    {
        var now = new DateTime(2026, 7, 28, 10, 1, 0, DateTimeKind.Utc);
        var estimate = BackgroundTaskProgress.Calculate(
            now,
            now.AddMinutes(-1),
            current: 25,
            total: 100,
            explicitProgress: 90,
            previousSampleTime: now.AddSeconds(-10),
            previousSampleCurrent: 20,
            previousThroughput: 0.5,
            previousSampleCount: 2);

        Assert.Equal("Units", estimate.ProgressMode);
        Assert.Equal(25, estimate.Progress);
        Assert.Equal(3, estimate.SampleCount);
        Assert.Equal("Medium", estimate.EstimateConfidence);
        Assert.Equal(150, estimate.RemainingSeconds);
        Assert.Equal(now.AddSeconds(150), estimate.EstimatedEndTime);
    }

    [Fact]
    public void PercentOnlyProgress_NeverReachesOneHundredBeforeCompletion()
    {
        var now = DateTime.UtcNow;
        var estimate = BackgroundTaskProgress.Calculate(
            now,
            now.AddMinutes(-1),
            current: 0,
            total: 0,
            explicitProgress: 100,
            previousSampleTime: null,
            previousSampleCurrent: 0,
            previousThroughput: null,
            previousSampleCount: 0);

        Assert.Equal("Percent", estimate.ProgressMode);
        Assert.Equal(99, estimate.Progress);
        Assert.Null(estimate.EstimatedEndTime);
    }
}
