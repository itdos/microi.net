using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class V8McpMenuBadgeTokenTests
{
    [Theory]
    [InlineData(1, 1)]
    [InlineData(0, 0)]
    [InlineData(2, 0)]
    public void NormalizeMenuBadgeEnabledToken_HandlesJValueWithoutDynamicBinding(
        int value,
        int expected)
    {
        var method = typeof(V8McpLogic).GetMethod(
            "NormalizeMenuBadgeEnabledToken",
            BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(method);
        var actual = method!.Invoke(null, [new JValue(value)]);

        Assert.Equal(expected, Assert.IsType<int>(actual));
    }
}
