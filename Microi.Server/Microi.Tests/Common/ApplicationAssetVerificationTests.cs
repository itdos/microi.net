using Microi.net;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using System.Reflection;

namespace Dos.Common.Tests;

public class ApplicationAssetVerificationTests
{
    [Theory]
    [InlineData(0, 0L, true)]
    [InlineData(32, 320L, true)]
    [InlineData(678, 6780L, true)]
    [InlineData(-1, 0L, false)]
    [InlineData(679, 6780L, false)]
    [InlineData(1, -1L, false)]
    [InlineData(678, 6779L, false)]
    [InlineData(1, 6781L, false)]
    public void ProgressRejectsImpossibleCheckpoint(int count, long bytes, bool expected)
        => Assert.Equal(expected, V8McpLogic.ValidateApplicationAssetVerificationProgress(
            new string('a', 64), new string('a', 64), count, 678, bytes, 6780L));

    [Fact]
    public void ProgressCannotMoveToDifferentFrozenManifest()
        => Assert.False(V8McpLogic.ValidateApplicationAssetVerificationProgress(
            new string('a', 64), new string('b', 64), 32, 678, 320, 6780));

    private static object? Call(string method, params object?[] args)
        => typeof(V8McpLogic).GetMethod(method, BindingFlags.NonPublic | BindingFlags.Static)!.Invoke(null, args);

    private static (JObject app, JObject version, object request, object plan) Frozen()
    {
        var app = new JObject { ["Id"] = "test-app", ["AppKey"] = "verify-test", ["ApplicationType"] = "Web",
            ["PublishFence"] = 10L, ["PublishRowVersion"] = 10L, ["CurrentVersion"] = 11, ["AppVersion"] = "v1.0.0" };
        var assets = new JArray(new JObject { ["Path"] = "index.html", ["Sha256"] = new string('a', 64), ["Size"] = 100L });
        var runtimeHash = V8McpLogic.ComputeMicroServiceManifestHash(assets);
        var param = new JObject
        {
            ["ProtocolVersion"] = 3, ["PublishMode"] = "stage", ["ExpectedGateEpoch"] = "2",
            ["ExpectedPublishRowVersion"] = "10", ["ExpectedVersionRowVersion"] = JValue.CreateNull(),
            ["ExpectedPublishFence"] = "10", ["ExpectedActivePublishVersionId"] = JValue.CreateNull(),
            ["ExpectedCommittedPublishVersionId"] = JValue.CreateNull(), ["ExpectedCurrentVersion"] = 11,
            ["ExpectedAppVersion"] = "v1.0.0", ["RequestId"] = "verify-test-request",
            ["RequestFingerprint"] = new string('b', 64), ["DeliveryBatchId"] = "verify-test-batch",
            ["SourceManifestHash"] = new string('c', 64), ["RuntimeManifestHash"] = runtimeHash,
            ["RouteSnapshotJson"] = "[]", ["RouteSnapshotHash"] = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
            ["VersionNo"] = "v1.0.1", ["EntryPath"] = "index.html", ["Assets"] = assets
        };
        object?[] parse = { param, null };
        Assert.Null(Call("ParseApplicationAssetV3ProtocolRequest", parse));
        var request = parse[1]!;
        object?[] build = { "iTdos", app, param, request, null };
        Assert.Null(Call("BuildApplicationAssetV3PublishPlan", build));
        var plan = build[4]!;
        var log = ((JObject)Call("BuildApplicationAssetV3BuildLog", request, plan)!).ToString(Formatting.None);
        var version = (JObject)Call("BuildApplicationAssetV3VersionSnapshot", "verify-version", "test-app", request,
            plan, log, 11L, 45L, V8McpLogic.ApplicationAssetV3PublishState.ReleaseVerified)!;
        version["Remark"] = new JObject
        {
            ["Contract"] = "microi-release-verification/1", ["RequestId"] = param["RequestId"],
            ["RequestFingerprint"] = param["RequestFingerprint"], ["RuntimeManifestHash"] = runtimeHash,
            ["VerifiedCount"] = 1, ["VerifiedBytes"] = 100L, ["Complete"] = true
        }.ToString(Formatting.None);
        return (app, version, request, plan);
    }

    [Fact]
    public void FinishedImmutableProofSurvivesSerializedCheckpointAndRowAdvancement()
    {
        var value = Frozen();
        var restarted = JObject.Parse(value.version.ToString(Formatting.None));
        Assert.True((bool)Call("HasApplicationAssetV3VerificationProof", restarted, value.request, value.plan)!);
    }

    [Theory]
    [InlineData("RequestId", "different")]
    [InlineData("RuntimeManifestHash", "different")]
    [InlineData("RequestFingerprint", "different")]
    [InlineData("PublishState", "Verifying")]
    [InlineData("PublishState", "FailedBeforeCommit")]
    [InlineData("BuildLog", "{}")]
    [InlineData("AssetManifestJson", "[]")]
    public void FinishedProofRejectsAnyImmutableFactOrStateDrift(string field, string replacement)
    {
        var value = Frozen(); value.version[field] = replacement;
        Assert.False((bool)Call("HasApplicationAssetV3VerificationProof", value.version, value.request, value.plan)!);
    }

    [Theory]
    [InlineData("VerifiedCount", "0")]
    [InlineData("VerifiedBytes", "99")]
    [InlineData("Complete", "false")]
    [InlineData("RuntimeManifestHash", "\"changed\"")]
    [InlineData("RequestFingerprint", "\"changed\"")]
    [InlineData("RequestId", "\"changed\"")]
    public void FinishedProofNeverAcceptsIncompleteOrForeignCheckpoint(string field, string json)
    {
        var value = Frozen(); var progress = JObject.Parse(value.version.Value<string>("Remark")!);
        progress[field] = JToken.Parse(json); value.version["Remark"] = progress.ToString(Formatting.None);
        Assert.False((bool)Call("HasApplicationAssetV3VerificationProof", value.version, value.request, value.plan)!);
    }

    [Fact]
    public void PendingReceiptCannotPretendToBeReleaseVerifiedOrCommitted()
    {
        var value = Frozen(); value.version["PublishState"] = "Verifying";
        var result = JObject.FromObject(Call("BuildApplicationAssetVerificationPending",
            value.app, value.version, value.request, value.plan)!);
        var data = (JObject)result["Data"]!;
        Assert.Equal(1, result.Value<int>("Code"));
        Assert.True(data.Value<bool>("Pending")); Assert.False(data.Value<bool>("Completed"));
        Assert.Equal("Verifying", data.Value<string>("PhaseState"));
        Assert.Equal("Uncommitted", data.Value<string>("PointerState"));
        Assert.Equal("verify-version", data.Value<string>("VerificationTaskId"));
        Assert.Equal("10", data.Value<string>("PublishFence"));
        Assert.Equal("10", data.Value<string>("PublishRowVersion"));
    }
}
