namespace Microi.Tests.Common;

public class ScheduleFixtureGuardTests
{
    [Theory]
    [InlineData("127.0.0.1:62681", 62681)]
    [InlineData("127.0.0.1:63866", 63866)]
    public void LocalEndpoint_AllowsIndependentPorts(string address, int port) =>
        Assert.Equal(port, ScheduleFixtureGuard.ValidateRedisEndpoint(address));

    [Theory]
    [InlineData("192.168.1.1:63866")]
    [InlineData("redis.example.com:63866")]
    [InlineData("127.0.0.1:63866,192.168.1.1:6379")]
    [InlineData("127.0.0.1:80")]
    [InlineData("127.0.0.1:99999")]
    public void Endpoint_RejectsForeignClusterAndInvalidPorts(string address) =>
        Assert.NotNull(Record.Exception(() => ScheduleFixtureGuard.ValidateRedisEndpoint(address)));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("message center full 20260910")]
    public void CustomFixture_RequiresExplicitStableOwner(string? value) =>
        Assert.NotNull(Record.Exception(() => ScheduleFixtureGuard.ValidateFixtureId(value)));
}
