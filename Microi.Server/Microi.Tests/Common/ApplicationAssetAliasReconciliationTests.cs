using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class ApplicationAssetAliasReconciliationTests
{
    [Fact]
    public void Disposition_RepairsOnlyExactCurrentPublishedPointer()
    {
        var state = BuildState();

        Assert.Equal(
            "Current",
            V8McpLogic.GetApplicationAliasRecoveryDisposition(
                state.App,
                state.Version,
                state.BuildLog));

        state.App["LastBuildTaskId"] = "batch-newer";
        Assert.Equal(
            "Superseded",
            V8McpLogic.GetApplicationAliasRecoveryDisposition(
                state.App,
                state.Version,
                state.BuildLog));
    }

    [Fact]
    public void Disposition_NewerVersionIsSupersededAndVerifiedRequiresFinalizeReplay()
    {
        var state = BuildState();
        state.App["AppVersion"] = "v1.2.4";
        Assert.Equal(
            "Superseded",
            V8McpLogic.GetApplicationAliasRecoveryDisposition(
                state.App,
                state.Version,
                state.BuildLog));

        state.Version["Status"] = "Verified";
        Assert.Equal(
            "PendingFinalizeReplay",
            V8McpLogic.GetApplicationAliasRecoveryDisposition(
                state.App,
                state.Version,
                state.BuildLog));
    }

    [Fact]
    public void ManifestValidation_RebuildsEveryAllowedPathAndRejectsTampering()
    {
        var state = BuildState();
        Assert.Null(V8McpLogic.ValidateApplicationAliasRecoveryManifest(
            state.App,
            state.Version,
            state.BuildLog));

        ((JObject)((JArray)state.BuildLog["AliasManifest"]!)[0])["RootPath"] =
            "itdos/ai-app-publish/another-app/index.html";
        Assert.Contains(
            "路径越界",
            V8McpLogic.ValidateApplicationAliasRecoveryManifest(
                state.App,
                state.Version,
                state.BuildLog));
    }

    [Fact]
    public void WorkerSource_UsesPublisherLockDurableCasAndNeverDeletesObjects()
    {
        var serverRoot = FindServerRoot();
        var source = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Core",
            "V8Engine",
            "V8McpLogic.ApplicationAliasReconciliation.cs"));
        var program = File.ReadAllText(Path.Combine(serverRoot, "Microi.net.Api", "Program.cs"));

        Assert.Contains("Key = BuildApplicationAssetPublishLockKey(osClient, appId)", source);
        Assert.Contains("new List<object> { \"AND\", \"BuildLog\", \"=\", oldBuildLog }", source);
        Assert.Contains("var currentApp = await FindAiApplication(osClient, appId)", source);
        Assert.Contains("ExecuteApplicationAssetSideEffect(", source);
        Assert.DoesNotContain("DeleteObject", source);
        Assert.DoesNotContain("ApplicationType, \"Web\"", source);

        var hdfsOffset = program.IndexOf("services.AddMicroiHDFS()", StringComparison.Ordinal);
        var workerOffset = program.IndexOf(
            "services.AddHostedService<ApplicationAssetAliasReconciliationWorkerService>()",
            StringComparison.Ordinal);
        Assert.True(hdfsOffset >= 0);
        Assert.True(workerOffset > hdfsOffset);
    }

    private static (JObject App, JObject Version, JObject BuildLog) BuildState()
    {
        const string sha256 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        const string versionNo = "v1.2.3";
        const string versionPath = "itdos/ai-app-publish/demo-game/versions/v1.2.3/index.html";
        const string rootPath = "itdos/ai-app-publish/demo-game/index.html";
        const string latestPath = "itdos/ai-app-publish/demo-game/latest/index.html";
        var runtimeManifest = new JArray
        {
            new JObject
            {
                ["Path"] = "index.html",
                ["Sha256"] = sha256,
                ["Size"] = 100L,
                ["IsEntry"] = true
            }
        };
        var buildLog = new JObject
        {
            ["Mode"] = "StreamedAssets",
            ["DeliveryBatchId"] = "batch-current-0001",
            ["AssetCount"] = 1,
            ["TotalSize"] = 100L,
            ["RuntimeManifestHash"] = V8McpLogic.ComputeMicroServiceManifestHash(runtimeManifest),
            ["AliasManifest"] = new JArray
            {
                new JObject
                {
                    ["RelativePath"] = "index.html",
                    ["Sha256"] = sha256,
                    ["Size"] = 100L,
                    ["IsEntry"] = true,
                    ["VersionPath"] = versionPath,
                    ["RootPath"] = rootPath,
                    ["LatestPath"] = latestPath
                }
            }
        };
        var app = new JObject
        {
            ["OsClient"] = "iTdos",
            ["Id"] = "app-record-1",
            ["AppId"] = "demo-game",
            ["AppKey"] = "demo-game",
            ["ApplicationType"] = "Web",
            ["Status"] = "Published",
            ["AppVersion"] = versionNo,
            ["LastBuildTaskId"] = "batch-current-0001",
            ["PublicPublishPath"] = rootPath
        };
        var version = new JObject
        {
            ["Id"] = "version-record-1",
            ["OsClient"] = "iTdos",
            ["AppId"] = "app-record-1",
            ["VersionNo"] = versionNo,
            ["Status"] = "Published",
            ["PublishPath"] = versionPath,
            ["FileCount"] = 1,
            ["TotalSize"] = 100L
        };
        return (app, version, buildLog);
    }

    private static string FindServerRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.net.Api"))
                && Directory.Exists(Path.Combine(current.FullName, "Microi.Core")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("未找到 Microi.Server 根目录。");
    }
}
