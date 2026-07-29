using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

public class FormEngineUniqueModeTests
{
    private static bool IsAll(string configJson)
    {
        var method = typeof(FormEngine).GetMethod(
            "IsAllUniqueFieldConfig",
            BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(method);
        return Assert.IsType<bool>(method.Invoke(null, new object?[] { configJson }));
    }

    [Theory]
    [InlineData("{\"Unique\":{\"Type\":\"All\"}}")]
    [InlineData("{\"Unique\":{\"Type\":\"all\"}}")]
    [InlineData("{\"Unique\":{\"Type\":\" ALL \"}}")]
    public void Composite_unique_mode_is_case_insensitive(string configJson)
    {
        Assert.True(IsAll(configJson));
    }

    [Theory]
    [InlineData("")]
    [InlineData("{}")]
    [InlineData("{\"Unique\":{\"Type\":\"Alone\"}}")]
    public void Missing_or_alone_mode_is_not_composite(string configJson)
    {
        Assert.False(IsAll(configJson));
    }
}
