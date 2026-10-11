using Microi.net;

namespace Dos.Common.Tests;

public class MqttEnablePolicyTests
{
    [Theory]
    [InlineData(null, false, false)]
    [InlineData("", false, false)]
    [InlineData("  ", false, false)]
    [InlineData("1", false, true)]
    [InlineData("0", false, false)]
    [InlineData(null, true, true)]
    [InlineData("  ", true, true)]
    [InlineData("1", true, true)]
    [InlineData("0", true, false)]
    [InlineData("2", true, false)]
    [InlineData("true", true, false)]
    public void SwitchRequiresMigrationBeforeNullCanEnable(string? value, bool migrated, bool expected)
    {
        Assert.Equal(expected, MqttEnablePolicy.IsEnabled(value!, migrated));
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("7.6.15.0", false)]
    [InlineData("7.6.16.0", true)]
    [InlineData("8.0.0.0", true)]
    [InlineData("bad-version", false)]
    public void OnlyCompletedVersionOpensNullSemantic(string? version, bool expected)
    {
        Assert.Equal(expected, MqttEnablePolicy.IsMigrationApplied(version!));
    }

    [Fact]
    public void RuntimeSnapshotBeginsClosed()
    {
        var state = new MqttEnableState();
        Assert.False(state.IsEnabled("iTdos"));
        state.DisableAll();
        Assert.False(state.IsEnabled("iTdos"));
    }
}
