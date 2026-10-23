using Microi.Tests.FullStack;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class ManagedStorageNativeFailureIntegrationTests
{
    private const string Canary = "private-native-and-capture-secret-canary";
    private const string RequestId = "0123456789abcdef0123456789abcdef";
    private const string Tenant = "adm_test_owned";
    private const string Owner = "test-owned-nonce";
    private static Task<BoundedNativeProcessOutput> Read(string text) => BoundedNativeProcessOutput.ReadAsync(new StringReader(text));

    [Fact]
    public async Task NonzeroExitCombinesBoundedStreamsWithStrictDiagnosticWithoutEitherCanary()
    {
        var stdout = await Read(Canary);
        var stderr = await Read(new JObject { ["Code"] = 0, ["errorType"] = "OperationalError", ["errorCode"] = 1045, ["Message"] = Canary }.ToString());
        var capture = await Read(Canary);
        Assert.True(ManagedStorageAdmissionHttpTests.RequiresPrivateFailureEvidence(1, stdout, stderr));
        var receipt = ManagedStorageAdmissionHttpTests.AcceptPrivateFailureReceipt(0, capture, RequestId);
        var diagnostic = ManagedStorageAdmissionHttpTests.DescribeBoundedControlFailure(1, stdout, stderr, receipt);
        Assert.Contains("errorType=OperationalError; errorCode=1045", diagnostic);
        Assert.Contains("private evidence=Unavailable", diagnostic);
        Assert.DoesNotContain(Canary, diagnostic);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task SuccessfulExitWithEitherTruncatedStreamStillRequiresFailure(bool stdoutTruncated, bool stderrTruncated)
    {
        var stdout = await Read("{}"); var stderr = await Read("{\"Code\":0,\"errorType\":\"OperationalError\",\"errorCode\":1045}");
        stdout = stdout with { Truncated = stdoutTruncated }; stderr = stderr with { Truncated = stderrTruncated };
        Assert.True(ManagedStorageAdmissionHttpTests.RequiresPrivateFailureEvidence(0, stdout, stderr));
        var diagnostic = ManagedStorageAdmissionHttpTests.DescribeBoundedControlFailure(0, stdout, stderr, Canary);
        Assert.DoesNotContain(Canary, diagnostic);
        if (stderrTruncated) Assert.DoesNotContain("errorType=", diagnostic);
    }

    [Theory]
    [InlineData(1, false, "{\"Code\":1,\"file\":\"native-control-failure-0123456789abcdef0123456789abcdef.json\"}")]
    [InlineData(0, true, "{\"Code\":1,\"file\":\"native-control-failure-0123456789abcdef0123456789abcdef.json\"}")]
    [InlineData(0, false, "not-json private-native-and-capture-secret-canary")]
    [InlineData(0, false, "{\"Code\":1,\"file\":\"private-native-and-capture-secret-canary\"}")]
    [InlineData(0, false, "{\"Code\":0,\"file\":\"native-control-failure-0123456789abcdef0123456789abcdef.json\"}")]
    public async Task FailedTruncatedMalformedOrForeignEvidenceAcknowledgementCannotSupplyPublicReceipt(int exitCode, bool truncated, string text)
    {
        var output = await Read(text);
        Assert.Equal("Unavailable", ManagedStorageAdmissionHttpTests.AcceptPrivateFailureReceipt(exitCode, output with { Truncated = truncated }, RequestId));
    }

    [Fact]
    public async Task EvidenceAcknowledgementOnlyAcceptsThisLocallyGeneratedRequestFilename()
    {
        var expected = "native-control-failure-" + RequestId + ".json";
        var output = await Read(new JObject { ["Code"] = 1, ["file"] = expected }.ToString());
        Assert.Equal(expected, ManagedStorageAdmissionHttpTests.AcceptPrivateFailureReceipt(0, output, RequestId));
        Assert.Equal("Unavailable", ManagedStorageAdmissionHttpTests.AcceptPrivateFailureReceipt(0, output, "ffffffffffffffffffffffffffffffff"));
    }

    [Fact]
    public async Task UntruncatedSuccessKeepsExactCodeOwnerAndTenantChecks()
    {
        var output = await Read(new JObject { ["Code"] = 1, ["tenant"] = Tenant, ["owner"] = Owner }.ToString());
        Assert.False(ManagedStorageAdmissionHttpTests.RequiresPrivateFailureEvidence(0, output, await Read("")));
        Assert.Equal(Tenant, ManagedStorageAdmissionHttpTests.ParseOwnedControlSuccess(output, Tenant, Owner).Value<string>("tenant"));
        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() => ManagedStorageAdmissionHttpTests.ParseOwnedControlSuccess(output, "foreign-tenant", Owner));
        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() => ManagedStorageAdmissionHttpTests.ParseOwnedControlSuccess(output, Tenant, "foreign-owner"));
        var failed = await Read(new JObject { ["Code"] = 0, ["tenant"] = Tenant, ["owner"] = Owner }.ToString());
        Assert.ThrowsAny<Xunit.Sdk.XunitException>(() => ManagedStorageAdmissionHttpTests.ParseOwnedControlSuccess(failed, Tenant, Owner));
    }
}
