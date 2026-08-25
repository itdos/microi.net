using Microi.net;

namespace Microi.Tests.Common;

public class V8BackendVersionTests
{
    [Fact]
    public void GetBackendVersion_ReturnsNormalizedRuntimeFileVersion()
    {
        var version = new V8Method().GetBackendVersion();

        Assert.Matches(@"^v\d+\.\d+\.\d+$", version);
        Assert.DoesNotContain("+", version);
    }
}
