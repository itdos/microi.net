using System.Security.Cryptography;
using System.Text;

namespace Microi.Tests.Common;

public sealed class BoundedNativeProcessOutputTests
{
    [Fact]
    public async Task LargeOutput_IsDrainedAndHasBoundedPrivateBodyAndWholeTextHash()
    {
        var value = new string('x', BoundedNativeProcessOutput.MaximumCharacters + 9000);
        var result = await BoundedNativeProcessOutput.ReadAsync(new StringReader(value));
        Assert.True(result.Truncated);
        Assert.Equal(value.Length, result.Characters);
        Assert.Equal(BoundedNativeProcessOutput.MaximumCharacters, result.Text.Length);
        Assert.Equal(Convert.ToHexString(SHA256.HashData(Encoding.Unicode.GetBytes(value))).ToLowerInvariant(), result.Utf16LeSha256);
        Assert.Equal("UnknownNativeControlFailure", result.SafeFailureSummary());
    }

    [Fact]
    public async Task Truncation_DoesNotLeaveHalfOfUnicodeSurrogatePair()
    {
        var value = new string('x', BoundedNativeProcessOutput.MaximumCharacters - 1) + "😀tail";
        var result = await BoundedNativeProcessOutput.ReadAsync(new StringReader(value));
        Assert.True(result.Truncated);
        Assert.Equal(BoundedNativeProcessOutput.MaximumCharacters - 1, result.Text.Length);
        Assert.Equal(value.Length, result.Characters);
        Assert.Equal(Convert.ToHexString(SHA256.HashData(Encoding.Unicode.GetBytes(value))).ToLowerInvariant(), result.Utf16LeSha256);
    }

    [Theory]
    [InlineData("{\"Code\":0,\"errorType\":\"OperationalError\",\"errorCode\":2013}", "OperationalError/2013")]
    [InlineData("{\"Code\":0,\"errorType\":\"PermissionError\",\"errorCode\":null}", "PermissionError")]
    [InlineData("{\"Code\":0,\"errorType\":\"OperationalError\",\"errorCode\":\"private-secret\"}", "OperationalError")]
    [InlineData("{\"Code\":0,\"errorType\":\"private-secret\",\"errorCode\":1}", "UnknownNativeControlFailure")]
    [InlineData("{\"Code\":1,\"errorType\":\"OperationalError\",\"errorCode\":2013}", "UnknownNativeControlFailure")]
    [InlineData("not-json private-secret", "UnknownNativeControlFailure")]
    public async Task FailureSummary_OnlyIncludesTrustedTypeAndNumericCode(string text, string expected)
    {
        var result = await BoundedNativeProcessOutput.ReadAsync(new StringReader(text));
        Assert.False(result.Truncated);
        Assert.Equal(text, result.PrivateBody().Value<string>("text"));
        Assert.Equal(expected, result.SafeFailureSummary());
        Assert.DoesNotContain("private-secret", result.SafeFailureSummary());
    }
}
