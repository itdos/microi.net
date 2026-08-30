using Microi.net;

namespace Microi.Tests.Common;

public sealed class SysDeptCodeTests
{
    [Theory]
    [InlineData("1-2-", "1-", 2)]
    [InlineData("12-35-", "12-", 35)]
    public void DirectChildSequenceUsesLiteralParentPrefix(
        string childCode,
        string parentCode,
        int expected)
    {
        Assert.True(SysDeptLogic.TryParseDirectChildSequence(
            childCode,
            parentCode,
            out var sequence));
        Assert.Equal(expected, sequence);
    }

    [Theory]
    [InlineData("21-3-", "1-")]
    [InlineData("1-", "1-")]
    [InlineData("1-A-", "1-")]
    [InlineData(null, "1-")]
    public void InvalidOrNonChildCodesAreIgnored(string? childCode, string parentCode)
    {
        Assert.False(SysDeptLogic.TryParseDirectChildSequence(
            childCode,
            parentCode,
            out _));
    }
}
