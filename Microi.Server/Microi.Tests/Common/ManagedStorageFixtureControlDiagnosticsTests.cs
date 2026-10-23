using Microi.Tests.FullStack;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class ManagedStorageFixtureControlDiagnosticsTests
{
    private const string Secret = "canary-password-token-source";
    private static string Describe(string? stderr) => ManagedStorageAdmissionHttpTests.DescribeControlFailure(1, stderr);
    private static readonly string Fallback = Describe(null);

    [Fact]
    public void RealStructuredDatabaseFailureAddsOnlyApprovedTypeAndNumericCode()
    {
        var output = Describe(new JObject
        {
            ["Code"] = 0, ["errorType"] = "OperationalError", ["errorCode"] = 1045,
            ["Message"] = Secret, ["command"] = "python --password=" + Secret,
            ["credentials"] = new JObject { ["password"] = Secret }
        }.ToString());
        Assert.Contains("errorType=OperationalError; errorCode=1045", output);
        Assert.Contains("exitCode=1", output);
        Assert.DoesNotContain(Secret, output);
        Assert.DoesNotContain("Message", output);
        Assert.DoesNotContain("command", output);
        Assert.DoesNotContain("credentials", output);
    }

    [Fact]
    public void BoundaryFailureWithNullCodeRetainsItsSafeType()
    {
        var output = Describe("{\"Code\":0,\"errorType\":\"BoundaryError\",\"errorCode\":null}");
        Assert.Contains("errorType=BoundaryError", output);
        Assert.DoesNotContain("errorCode=", output);
    }

    [Theory]
    [InlineData("canary-password-token-source")]
    [InlineData("OperationalError canary-password-token-source")]
    [InlineData("System.OperationalError")]
    [InlineData("operationalerror")]
    [InlineData("OperationalError\ncanary-password-token-source")]
    public void UnknownOrDecoratedErrorTypesNeverEnterDiagnostics(string type)
    {
        Assert.Equal(Fallback, Describe(new JObject { ["Code"] = 0, ["errorType"] = type, ["errorCode"] = 1045 }.ToString()));
    }

    [Theory]
    [InlineData("\"canary-password-token-source\"")]
    [InlineData("\"1045\"")]
    [InlineData("true")]
    [InlineData("1045.0")]
    [InlineData("-1")]
    [InlineData("65536")]
    [InlineData("9223372036854775808")]
    [InlineData("{\"password\":\"canary-password-token-source\"}")]
    public void CodesWithWrongTypesOrOutsideTheNumericBoundAreOmitted(string code)
    {
        var output = Describe("{\"Code\":0,\"errorType\":\"OperationalError\",\"errorCode\":" + code + "}");
        Assert.Contains("errorType=OperationalError", output);
        Assert.DoesNotContain("errorCode=", output);
        Assert.DoesNotContain(Secret, output);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("65535")]
    public void NumericCodeBoundariesArePreserved(string code)
    {
        Assert.Contains("errorCode=" + code, Describe("{\"Code\":0,\"errorType\":\"OSError\",\"errorCode\":" + code + "}"));
    }

    [Theory]
    [InlineData("canary-password-token-source")]
    [InlineData("Traceback: canary-password-token-source\n{\"Code\":0,\"errorType\":\"OperationalError\"}")]
    [InlineData("{\"Code\":0,\"errorType\":\"OperationalError\"} canary-password-token-source")]
    [InlineData("{\"Code\":0,\"errorType\":\"OperationalError\"}{\"password\":\"canary-password-token-source\"}")]
    [InlineData("{\"Code\":0,\"errorType\":\"OperationalError\",\"errorType\":\"canary-password-token-source\"}")]
    [InlineData("{\"Code\":0,\"errorType\":\"OperationalError\",\"extra\":{\"a\":{\"b\":{\"c\":{\"d\":\"canary-password-token-source\"}}}}}")]
    [InlineData("[]")]
    [InlineData("{\"errorType\":\"OperationalError\",\"errorCode\":1045}")]
    [InlineData("{\"Code\":1,\"errorType\":\"OperationalError\",\"errorCode\":1045}")]
    [InlineData("{\"Code\":\"0\",\"errorType\":\"OperationalError\",\"errorCode\":1045}")]
    public void MalformedAmbiguousOrUntrustedJsonUsesOnlyTheFixedFallback(string stderr)
    {
        Assert.Equal(Fallback, Describe(stderr));
    }

    [Fact]
    public void OversizedInputIsRejectedWithoutEchoingItsPrefix()
    {
        Assert.Equal(Fallback, Describe("{\"Code\":0,\"errorType\":\"OperationalError\",\"Message\":\"" + Secret + new string('x', 2048) + "\"}"));
        Assert.Equal(Fallback, Describe(new JObject { ["Code"] = 0, ["errorType"] = new string('A', 65), ["errorCode"] = 1045 }.ToString()));
    }
}
