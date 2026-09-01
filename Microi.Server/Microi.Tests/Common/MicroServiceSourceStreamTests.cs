using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public class MicroServiceSourceStreamTests
{
    private const string HashA =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private const string HashB =
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    [Fact]
    public void Capabilities_AdvertisePrivateSourceStageFinalizeAndCas()
    {
        var capabilities = JObject.FromObject(V8McpLogic.GetMicroServiceSourceStreamCapabilities());

        Assert.True(capabilities.Value<bool>("SourceStreamPublish"));
        Assert.Equal(1, capabilities.Value<int>("SourceStreamProtocolVersion"));
        Assert.Equal(
            "/api/V8Debug/StageMicroServiceSourceFile",
            capabilities.Value<string>("StageRoute"));
        Assert.Equal(
            "/api/V8Debug/FinalizeMicroServiceSourceManifest",
            capabilities.Value<string>("FinalizeRoute"));
        Assert.Contains("ExpectedSourceManifestHash", capabilities["CasFields"]!.Values<string>());
    }

    [Fact]
    public void StagingPath_IsTenantPrivateDeliveryScopedAndTraversalSafe()
    {
        var path = V8McpLogic.BuildMicroServiceSourceStagingPath(
            "Loctek",
            "app-1",
            "01KXYZ_BATCH-1",
            @"src\pages\home.vue");

        Assert.Equal(
            "/loctek/ai-app-source-staged/app-1/01KXYZ_BATCH-1/src/pages/home.vue",
            path);
        Assert.ThrowsAny<ArgumentException>(() =>
            V8McpLogic.BuildMicroServiceSourceStagingPath(
                "Loctek",
                "app-1",
                "01KXYZ_BATCH-1",
                "../secret.txt"));

        var firstVersion = V8McpLogic.BuildMicroServiceSourceStageVersionId(
            "app-1",
            "shared-batch");
        var secondVersion = V8McpLogic.BuildMicroServiceSourceStageVersionId(
            "app-2",
            "shared-batch");
        Assert.Equal(50, firstVersion.Length);
        Assert.NotEqual(firstVersion, secondVersion);
    }

    [Fact]
    public void InterruptedStage_NeverAppearsAsActivePrivateSource()
    {
        var staged = new JObject
        {
            ["StorageScope"] = V8McpLogic.StagedPrivateSourceStorageScope,
            ["FilePath"] = "src/App.vue",
            ["ContentHash"] = HashA,
            ["Size"] = 12,
            ["IsDeleted"] = 0
        };

        Assert.False(V8McpLogic.IsPrivateAiApplicationSourceFile(staged));
        Assert.Null(V8McpLogic.ComputeMicroServiceSourceRowsManifestHash(new[] { staged }));
    }

    [Fact]
    public void ExistingStageRow_DynamicFormDataIsMaterializedBeforeJTokenValueRead()
    {
        dynamic formData = new JObject
        {
            ["Size"] = 12L,
            ["StorageScope"] = V8McpLogic.StagedPrivateSourceStorageScope
        };

        JObject existing = V8McpLogic.MaterializeMicroServiceSourceRecord((object)formData);

        Assert.NotNull(existing);
        Assert.IsType<JValue>(existing["Size"]);
        Assert.Equal(12L, existing.Value<long>("Size"));
        Assert.Equal(
            V8McpLogic.StagedPrivateSourceStorageScope,
            existing.Value<string>("StorageScope"));
    }

    [Fact]
    public void ActiveManifestHash_IsDeterministicAcrossDatabaseRowOrder()
    {
        var app = SourceRow("src/App.vue", HashA, 12);
        var helper = SourceRow("src/helper.ts", HashB, 34);

        var first = V8McpLogic.ComputeMicroServiceSourceRowsManifestHash(new[] { app, helper });
        var second = V8McpLogic.ComputeMicroServiceSourceRowsManifestHash(new[] { helper, app });

        Assert.NotNull(first);
        Assert.Equal(first, second);
        Assert.Matches("^[a-f0-9]{64}$", first!);
    }

    [Fact]
    public void FinalizeCas_RequiresAllThreeBaselinesAndRejectsStaleSource()
    {
        var app = new JObject
        {
            ["CurrentVersion"] = 7,
            ["AppVersion"] = "v1.1.3"
        };
        var param = new JObject
        {
            ["ExpectedCurrentVersion"] = 7,
            ["ExpectedAppVersion"] = "v1.1.3",
            ["ExpectedSourceManifestHash"] = HashA
        };

        Assert.Null(V8McpLogic.ValidateMicroServiceSourceFinalizeCas(app, HashA, param));
        Assert.Contains(
            "ExpectedSourceManifestHash",
            V8McpLogic.ValidateMicroServiceSourceFinalizeCas(
                app,
                HashA,
                new JObject
                {
                    ["ExpectedCurrentVersion"] = 7,
                    ["ExpectedAppVersion"] = "v1.1.3"
                }));
        Assert.Contains(
            "CAS 冲突",
            V8McpLogic.ValidateMicroServiceSourceFinalizeCas(app, HashB, param));
    }

    [Fact]
    public void ManifestReplacement_IdentifiesFilesRemovedByIncomingSnapshot()
    {
        var active = new[]
        {
            SourceRow("src/App.vue", HashA, 12),
            SourceRow("src/obsolete.vue", HashB, 34)
        };
        var incoming = new JArray
        {
            new JObject
            {
                ["Path"] = "src/App.vue",
                ["Sha256"] = HashA,
                ["Size"] = 12
            }
        };

        var deleted = V8McpLogic.ResolveMicroServiceSourceManifestDeletions(active, incoming);

        Assert.Equal(new[] { "src/obsolete.vue" }, deleted);
    }

    [Fact]
    public void LegacyJsonSync_OnlyEntersAtomicProtocolWhenCasWasRequested()
    {
        Assert.False(V8McpLogic.HasMicroServiceSourceCasPreconditions(new JObject()));
        Assert.True(V8McpLogic.HasMicroServiceSourceCasPreconditions(new JObject
        {
            ["ExpectedSourceManifestHash"] = JValue.CreateNull()
        }));
    }

    private static JObject SourceRow(string path, string hash, long size)
    {
        return new JObject
        {
            ["StorageScope"] = "Private",
            ["FilePath"] = path,
            ["ContentHash"] = hash,
            ["Size"] = size,
            ["IsDeleted"] = 0
        };
    }
}
