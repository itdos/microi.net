using Microi.net;

namespace Microi.Tests.Common;

public sealed class V8HttpTimeoutRegressionTests
{
    [Fact]
    public void V8HttpWithoutTimeout_PreservesTenMinuteDefault()
    {
        var param = new DiyHttp().DynamicToDiyHttpParam(new { Url = "https://example.test/" });
        Assert.Equal(600, param.TimeOut);
    }

    [Theory]
    [InlineData(10)]
    [InlineData(600)]
    [InlineData(1200)]
    public void V8HttpExplicitTimeout_RemainsAvailable(int seconds)
    {
        var param = new DiyHttp().DynamicToDiyHttpParam(new { Url = "https://example.test/", Timeout = seconds });
        Assert.Equal(seconds, param.TimeOut);
    }

}
