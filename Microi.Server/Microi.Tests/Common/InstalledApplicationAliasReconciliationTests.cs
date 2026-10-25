using System.Security.Cryptography;
using System.Text;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class InstalledApplicationAliasReconciliationTests
{
    private const string Tenant = "alias-tenant";
    private const string Key = "installed-app";
    private const string Version = "v1.2.3";
    private const string VersionRoot = Tenant + "/micro-app/" + Key + "/" + Version + "/";

    [Fact]
    public async Task LegacyInstall_RecoversSixTargetsAndReplayDoesNotCopyOrMutateAuthority()
    {
        var state = new State();
        var before = state.Authority.ToString(Formatting.None);
        Assert.Null(V8McpLogic.ValidateInstalledApplicationAliasAuthority(Tenant, state.Authority));
        // This is deliberately not an invented streamed-asset build log.
        Assert.NotNull(V8McpLogic.ValidateApplicationAliasRecoveryManifest(
            (JObject)state.Authority["Application"]!, (JObject)state.Authority["Versions"]![0]!, new JObject()));
        Assert.Equal("Reconciled", await state.Run());
        Assert.Equal(6, state.Copies);
        Assert.Equal(9, state.Objects.Count);
        var readsBeforeReplay = state.Reads;
        Assert.Equal("Reconciled", await state.Run());
        // 原始无调度修复每次仍完整读取 3 个 source 和 2 轮 root/latest：回归对照共 15 次 GET。
        Assert.Equal(15, state.Reads - readsBeforeReplay);
        Assert.Equal(6, state.Copies);
        Assert.Equal(before, state.Authority.ToString(Formatting.None));
        foreach (var file in state.Source)
        {
            Assert.Equal(file.Value, state.Objects[Tenant + "/micro-app/" + Key + "/" + file.Key]);
            Assert.Equal(file.Value, state.Objects[Tenant + "/micro-app/" + Key + "/latest/" + file.Key]);
            Assert.Equal(file.Value, state.Objects[VersionRoot + file.Key]);
        }
    }

    [Theory]
    [InlineData("CrossTenant")]
    [InlineData("DuplicateVersion")]
    [InlineData("DuplicateService")]
    [InlineData("DuplicateFile")]
    [InlineData("PrivateSource")]
    [InlineData("PathTraversal")]
    [InlineData("WrongDigest")]
    [InlineData("WrongSize")]
    [InlineData("ExtraFile")]
    [InlineData("DisabledService")]
    [InlineData("ActivePublish")]
    [InlineData("V3Version")]
    [InlineData("MalformedManifest")]
    [InlineData("ChangedManifest")]
    public async Task AmbiguousOrUnsafeAuthority_IsRejectedBeforeObjectIo(string fault)
    {
        var state = new State();
        var app = (JObject)state.Authority["Application"]!;
        var version = (JObject)state.Authority["Versions"]![0]!;
        var service = (JObject)state.Authority["Services"]![0]!;
        var file = (JObject)state.Authority["Files"]![0]!;
        switch (fault)
        {
            case "CrossTenant": app["PublicPublishPath"] = "another/" + VersionRoot; break;
            case "DuplicateVersion": ((JArray)state.Authority["Versions"]!).Add(version.DeepClone()); break;
            case "DuplicateService": ((JArray)state.Authority["Services"]!).Add(service.DeepClone()); break;
            case "DuplicateFile": state.Authority["Files"]![1] = file.DeepClone(); break;
            case "PrivateSource": file["StorageScope"] = "PrivateSource"; break;
            case "PathTraversal": file["HdfsPath"] = "../" + VersionRoot; break;
            case "WrongDigest": file["ContentHash"] = new string('a', 64); break;
            case "WrongSize": file["Size"] = 999; break;
            case "ExtraFile": ((JArray)state.Authority["Files"]!).Add(file.DeepClone()); break;
            case "DisabledService": service["IsEnable"] = 0; break;
            case "ActivePublish": app["ActivePublishVersionId"] = "new-publish"; break;
            case "V3Version": version["PublishProtocolVersion"] = 3; break;
            case "MalformedManifest": service["AssetManifestJson"] = "{"; break;
            case "ChangedManifest":
                var manifest = JObject.Parse((string)service["AssetManifestJson"]!);
                manifest["Assets"]![0]!["Hash"] = new string('b', 64);
                service["AssetManifestJson"] = manifest.ToString(Formatting.None); break;
        }
        Assert.NotNull(V8McpLogic.ValidateInstalledApplicationAliasAuthority(Tenant, state.Authority));
        Assert.Equal("InvalidAuthority", await state.Run());
        Assert.Equal(0, state.Reads);
        Assert.Equal(0, state.Copies);
    }

    [Fact]
    public async Task CorruptImmutableSource_RejectsWholeSetBeforeFirstCopy()
    {
        var state = new State();
        state.Objects[VersionRoot + "index.html"] = Encoding.UTF8.GetBytes("corrupt");
        Assert.Equal("InvalidSource", await state.Run());
        Assert.Equal(0, state.Copies);
    }

    [Fact]
    public async Task SameVersionReinstallDuringRead_AbortsBeforeCopy()
    {
        var state = new State();
        state.ReadAuthority = () =>
        {
            var current = (JObject)state.Authority.DeepClone();
            current["Files"]![0]!["UpdateTime"] = "new-install";
            return Task.FromResult(current);
        };
        Assert.Equal("Superseded", await state.Run());
        Assert.Equal(0, state.Copies);
    }

    [Fact]
    public async Task InstallInFlight_DefersAndDoesNotCopy()
    {
        var state = new State();
        state.ReadAuthority = () => Task.FromResult<JObject>(null!);
        Assert.Equal("Superseded", await state.Run());
        Assert.Equal(0, state.Copies);
    }

    [Fact]
    public async Task NewPublishAfterFirstCopy_StopsRemainingTargets()
    {
        var state = new State();
        state.AfterCopy = () => state.Authority["Application"]!["ActivePublishVersionId"] = "newer-v3";
        Assert.Equal("Superseded", await state.Run());
        Assert.Equal(1, state.Copies);
    }

    [Fact]
    public async Task LostLeaseAfterCopy_IsNeverReportedCompleteAndRestartRecovers()
    {
        var state = new State();
        var lost = false;
        state.EnsureLease = () => lost ? Task.FromException(new InvalidOperationException("lost lease")) : Task.CompletedTask;
        state.AfterCopy = () => lost = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => state.Run());
        Assert.Equal(1, state.Copies);
        lost = false;
        state.AfterCopy = null;
        Assert.Equal("Reconciled", await state.Run());
        Assert.Equal(6, state.Copies);
    }

    [Fact]
    public async Task UnknownCopyResponse_WithExactDestinationIsResolvedByReadback()
    {
        var state = new State { CopyResponseCode = 0 };
        Assert.Equal("Reconciled", await state.Run());
        Assert.Equal(6, state.Copies);
    }

    [Fact]
    public async Task LateOlderCopy_IsDetectedByFinalSetReadAndNextCycleRepairsIt()
    {
        var state = new State();
        state.AfterCopy = () =>
        {
            if (state.Copies == 6)
                state.Objects[Tenant + "/micro-app/" + Key + "/assets/main.css"] = Encoding.UTF8.GetBytes("late old copy");
        };
        Assert.Equal("Failed", await state.Run());
        state.AfterCopy = null;
        Assert.Equal("Reconciled", await state.Run());
        Assert.Equal(7, state.Copies);
    }

    [Fact]
    public async Task Cancellation_StopsBeforeIo()
    {
        var state = new State();
        using var cancelled = new CancellationTokenSource();
        cancelled.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => state.Run(cancelled.Token));
        Assert.Equal(0, state.Reads);
        Assert.Equal(0, state.Copies);
    }

    [Fact]
    public async Task DurableCheckpoint_StopsRepeatedDownloadsAcrossRuns_AndRechecksDaily()
    {
        var state = new State();
        Assert.Equal("Reconciled", await state.RunScheduled());
        Assert.Equal(1, state.Checkpoint["StablePasses"]!.Value<int>());
        var firstReads = state.Reads;
        for (var index = 0; index < 10; index++)
            Assert.Equal("VerifiedCheckpointSkipped", await state.RunScheduled());
        Assert.Equal(firstReads, state.Reads);
        state.Now += TimeSpan.FromMinutes(5);
        Assert.Equal("Reconciled", await state.RunScheduled());
        Assert.Equal(2, state.Checkpoint["StablePasses"]!.Value<int>());
        state.Now += TimeSpan.FromMinutes(30);
        Assert.Equal("Reconciled", await state.RunScheduled());
        Assert.Equal(3, state.Checkpoint["StablePasses"]!.Value<int>());
        var verifiedReads = state.Reads;
        // 每次调用都从持久 authority 的 BuildLog 重建，不依赖进程内计数器/缓存。
        for (var index = 0; index < 100; index++)
        {
            state.Now += TimeSpan.FromSeconds(30);
            Assert.Equal("VerifiedCheckpointSkipped", await state.RunScheduled());
        }
        Assert.Equal(verifiedReads, state.Reads);
        state.Now += TimeSpan.FromDays(1);
        Assert.Equal("Reconciled", await state.RunScheduled());
        Assert.True(state.Reads > verifiedReads);
        Assert.Equal("LegacyUnverified", state.Authority["Application"]!["PublishState"]);
        Assert.Equal(2, state.Authority["Application"]!["PublishProtocolVersion"]!.Value<int>());
    }

    [Theory]
    [InlineData("Files")]
    [InlineData("Versions")]
    [InlineData("Services")]
    [InlineData("Application")]
    public async Task DurableCheckpoint_MetadataChangeImmediatelyInvalidates(string target)
    {
        var state = new State();
        await state.RunScheduled();
        var priorHash = state.Checkpoint.Value<string>("AuthorityHash");
        var priorReads = state.Reads;
        var changed = target == "Application" ? (JObject)state.Authority[target]! : (JObject)state.Authority[target]![0]!;
        changed["UpdateTime"] = "new same-version install";
        Assert.Equal("Reconciled", await state.RunScheduled());
        Assert.NotEqual(priorHash, state.Checkpoint.Value<string>("AuthorityHash"));
        Assert.True(state.Reads > priorReads);
        Assert.Equal(1, state.Checkpoint["StablePasses"]!.Value<int>());
    }

    [Theory]
    [InlineData("UnknownLog")]
    [InlineData("UnknownField")]
    [InlineData("ForgedStatus")]
    [InlineData("UnboundedDelay")]
    [InlineData("InvalidPasses")]
    public async Task DurableCheckpoint_RejectsUnknownOrMalformedStoredProof(string fault)
    {
        var state = new State();
        await state.RunScheduled();
        var version = (JObject)state.Authority["Versions"]![0]!;
        var log = JObject.Parse(version.Value<string>("BuildLog")!);
        var checkpoint = (JObject)log["Checkpoint"]!;
        switch (fault)
        {
            case "UnknownLog": log = new JObject { ["Mode"] = "StreamedAssets" }; break;
            case "UnknownField": checkpoint["Complete"] = true; break;
            case "ForgedStatus": checkpoint["Status"] = "Completed"; break;
            case "UnboundedDelay": checkpoint["NextCheckAtUtc"] = state.Now.AddYears(1).ToString("O"); break;
            case "InvalidPasses": checkpoint["StablePasses"] = 99; break;
        }
        version["BuildLog"] = log.ToString(Formatting.None);
        var reads = state.Reads;
        Assert.Equal("InvalidAuthority", await state.RunScheduled());
        Assert.Equal(reads, state.Reads);
    }

    [Fact]
    public async Task DurableCheckpoint_JsonNullIsRejectedWithoutObjectIoOrAuthorityWrites()
    {
        var state = new State();
        state.Authority["Versions"]![0]!["BuildLog"] = "null";
        var before = state.Authority.ToString(Formatting.None);
        Assert.Equal("InvalidAuthority", await state.RunScheduled());
        Assert.Equal(0, state.Reads);
        Assert.Equal(0, state.Copies);
        Assert.Equal(before, state.Authority.ToString(Formatting.None));
    }

    [Fact]
    public async Task DurableCheckpoint_CorruptSourceBacksOffAndRecoversWithoutPublishing()
    {
        var state = new State();
        state.Objects[VersionRoot + "index.html"] = Encoding.UTF8.GetBytes("corrupt");
        Assert.Equal("InvalidSource", await state.RunScheduled());
        var reads = state.Reads;
        Assert.Equal("Retrying", state.Checkpoint.Value<string>("Status"));
        Assert.Equal("RetryBackoffSkipped", await state.RunScheduled());
        Assert.Equal(reads, state.Reads);
        state.Now += TimeSpan.FromMinutes(5);
        Assert.Equal("InvalidSource", await state.RunScheduled());
        Assert.Equal(2, state.Checkpoint.Value<int>("Attempt"));
        Assert.Equal(state.Now.AddMinutes(10), DateTimeOffset.Parse(state.Checkpoint.Value<string>("NextCheckAtUtc")!, System.Globalization.CultureInfo.InvariantCulture));
        state.Objects[VersionRoot + "index.html"] = state.Source["index.html"];
        state.Now += TimeSpan.FromMinutes(10);
        Assert.Equal("Reconciled", await state.RunScheduled());
        Assert.Equal(0, state.Checkpoint.Value<int>("Attempt"));
    }

    [Fact]
    public async Task DurableCheckpoint_CopyAfterPriorSuccessIsRepairedAndStabilityRestarts()
    {
        var state = new State();
        await state.RunScheduled();
        state.Now += TimeSpan.FromMinutes(5);
        await state.RunScheduled();
        state.Objects[Tenant + "/micro-app/" + Key + "/assets/main.css"] = Encoding.UTF8.GetBytes("late old copy");
        state.Now += TimeSpan.FromMinutes(30);
        Assert.Equal("Reconciled", await state.RunScheduled());
        Assert.Equal(7, state.Copies);
        Assert.Equal(1, state.Checkpoint.Value<int>("StablePasses"));
        Assert.Equal(state.Now.AddMinutes(5), DateTimeOffset.Parse(state.Checkpoint.Value<string>("NextCheckAtUtc")!, System.Globalization.CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task DurableCheckpoint_DatabaseFailureStopsBeforeObjectIo()
    {
        var state = new State { RejectCheckpointWrite = true };
        Assert.Equal("CheckpointConflict", await state.RunScheduled());
        Assert.Equal(0, state.Reads);
        Assert.Equal(0, state.Copies);
    }

    [Fact]
    public async Task DurableCheckpoint_LostLeaseLeavesRetryableVerifyingState()
    {
        var state = new State();
        var lost = false;
        state.EnsureLease = () => lost ? Task.FromException(new InvalidOperationException("lost lease")) : Task.CompletedTask;
        state.AfterCopy = () => lost = true;
        await Assert.ThrowsAsync<InvalidOperationException>(() => state.RunScheduled());
        Assert.Equal("Verifying", state.Checkpoint.Value<string>("Status"));
        lost = false;
        state.AfterCopy = null;
        var reads = state.Reads;
        Assert.Equal("RetryBackoffSkipped", await state.RunScheduled());
        Assert.Equal(reads, state.Reads);
        state.Now += TimeSpan.FromMinutes(5);
        Assert.Equal("Reconciled", await state.RunScheduled());
    }

    [Fact]
    public void AuthorityFingerprint_IsTenantBoundAndIndependentOfPropertyOrder()
    {
        var state = new State();
        var hash = V8McpLogic.ComputeInstalledApplicationAliasAuthorityHash(Tenant, state.Authority);
        var reordered = new JObject(state.Authority.Properties().Reverse().Select(p => new JProperty(p.Name, p.Value.DeepClone())));
        Assert.Equal(hash, V8McpLogic.ComputeInstalledApplicationAliasAuthorityHash(Tenant, reordered));
        Assert.NotEqual(hash, V8McpLogic.ComputeInstalledApplicationAliasAuthorityHash("other-tenant", state.Authority));
    }

    [Fact]
    public async Task DurableCheckpoint_ClockRollbackNeverSkipsIndefinitely()
    {
        var state = new State();
        await state.RunScheduled();
        state.Now -= TimeSpan.FromMinutes(10);
        var reads = state.Reads;
        Assert.Equal("Reconciled", await state.RunScheduled());
        Assert.True(state.Reads > reads);
    }

    [Fact]
    public async Task DurableCheckpoint_OldNodeEmptyBuildLogGuardRejectsBeforeObjectIo()
    {
        var state = new State();
        await state.RunScheduled();
        var legacyVersion = (JObject)state.Authority["Versions"]![0]!;
        // 固定旧版本的真实必要条件：BuildLog 必须为空；新检查点让旧节点安全拒绝，而非继续全量下载。
        var oldNodeAccepts = new[] { "BuildLog", "RequestId", "DeliveryBatchId", "RequestFingerprint", "RuntimeManifestHash", "AssetManifestJson" }
            .All(field => string.IsNullOrWhiteSpace(legacyVersion.Value<string>(field)));
        Assert.False(oldNodeAccepts);
        Assert.Equal("LegacyUnverified", state.Authority["Versions"]![0]!["PublishState"]);
    }

    private sealed class State
    {
        internal readonly Dictionary<string, byte[]> Source = new(StringComparer.Ordinal)
        {
            ["assets/main.css"] = Encoding.UTF8.GetBytes("body{color:blue}"),
            ["assets/main.js"] = Encoding.UTF8.GetBytes("console.log('installed');"),
            ["index.html"] = Encoding.UTF8.GetBytes("<!doctype html><html><body>Installed</body></html>")
        };
        internal readonly Dictionary<string, byte[]> Objects = new(StringComparer.Ordinal);
        internal readonly JObject Authority;
        internal int Copies, Reads;
        internal int CopyResponseCode = 1;
        internal Action? AfterCopy;
        internal Func<Task> EnsureLease = () => Task.CompletedTask;
        internal Func<Task<JObject>> ReadAuthority;
        internal DateTimeOffset Now = new(2026, 10, 24, 0, 0, 0, TimeSpan.Zero);
        internal bool RejectCheckpointWrite;
        internal JObject Checkpoint => (JObject)JsonConvert.DeserializeObject<JObject>(Authority["Versions"]![0]!.Value<string>("BuildLog")!,
            new JsonSerializerSettings { DateParseHandling = DateParseHandling.None })!["Checkpoint"]!;

        internal State()
        {
            var declared = new JArray();
            var files = new JArray();
            foreach (var row in Source)
            {
                var hash = Convert.ToHexString(SHA256.HashData(row.Value)).ToLowerInvariant();
                var path = VersionRoot + row.Key;
                Objects.Add(path, row.Value);
                declared.Add(new JObject { ["Path"] = row.Key, ["HdfsPath"] = path, ["Hash"] = hash, ["Size"] = row.Value.Length });
                files.Add(new JObject { ["Id"] = row.Key, ["AppId"] = "legacy-app", ["FilePath"] = "dist/" + row.Key,
                    ["HdfsPath"] = path, ["PublishHdfsPath"] = path, ["StorageScope"] = "PrivateSource+PublicBuild",
                    ["ContentHash"] = hash, ["Size"] = row.Value.Length, ["IsDeleted"] = 0, ["IsDirectory"] = 0 });
            }
            var manifest = new JObject { ["MsKey"] = Key, ["BuildVersion"] = Version, ["EntryPath"] = "index.html", ["StorageMode"] = "file", ["Assets"] = declared.DeepClone() };
            Authority = new JObject
            {
                ["Application"] = new JObject { ["Id"] = "legacy-app", ["AppKey"] = Key, ["AppVersion"] = Version,
                    ["ApplicationType"] = "MicroService", ["Status"] = "Published", ["BuildStatus"] = "Success",
                    ["PublishState"] = "LegacyUnverified", ["PublishProtocolVersion"] = 2, ["PublicPublishPath"] = VersionRoot },
                ["Versions"] = new JArray(new JObject { ["Id"] = "legacy-version", ["AppId"] = "legacy-app", ["VersionNo"] = Version,
                    ["Status"] = "Published", ["PublishState"] = "LegacyUnverified", ["PublishProtocolVersion"] = 2,
                    ["PublishPath"] = VersionRoot, ["BuildLog"] = "", ["FileCount"] = Source.Count }),
                ["Services"] = new JArray(new JObject { ["Id"] = "legacy-service", ["MsKey"] = Key,
                    ["MsUrl"] = "/micro-app/" + Tenant + "/" + Key + "/index.html", ["BuildVersion"] = Version,
                    ["StorageMode"] = "file", ["IsEnable"] = 1, ["EntryPath"] = "index.html", ["AssetCount"] = Source.Count,
                    ["AssetsJson"] = declared.ToString(Formatting.None), ["AssetManifestJson"] = manifest.ToString(Formatting.None) }),
                ["Files"] = files
            };
            ReadAuthority = () => Task.FromResult((JObject)Authority.DeepClone());
        }

        internal Task<string> Run(CancellationToken cancellationToken = default) =>
            V8McpLogic.ReconcileInstalledApplicationAliasAuthorityAsync(Tenant, (JObject)Authority.DeepClone(), ReadAuthority,
                (path, relative, size, hash, entry) =>
                {
                    Reads++;
                    var valid = Objects.TryGetValue(path, out var bytes) && bytes.LongLength == size
                        && Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant() == hash;
                    return Task.FromResult(valid ? null! : "bytes differ");
                },
                (source, target) =>
                {
                    Objects[target] = Objects[source].ToArray();
                    Copies++;
                    AfterCopy?.Invoke();
                    return Task.FromResult(new DosResult(CopyResponseCode));
                }, EnsureLease, cancellationToken);

        internal async Task<string> RunScheduled()
        {
            var cancellationToken = TestContext.Current.CancellationToken;
            var result = await V8McpLogic.ReconcileInstalledApplicationAliasCheckpointAsync(Tenant,
                (JObject)Authority.DeepClone(), ReadAuthority,
                (path, relative, size, hash, entry) =>
                {
                    Reads++;
                    var valid = Objects.TryGetValue(path, out var bytes) && bytes.LongLength == size
                        && Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant() == hash;
                    return Task.FromResult(valid ? null! : "bytes differ");
                },
                (source, target) =>
                {
                    Objects[target] = Objects[source].ToArray();
                    Copies++;
                    AfterCopy?.Invoke();
                    return Task.FromResult(new DosResult(CopyResponseCode));
                }, EnsureLease,
                (expected, log) =>
                {
                    if (RejectCheckpointWrite || !JToken.DeepEquals(expected, Authority)) return Task.FromResult(false);
                    Authority["Versions"]![0]!["BuildLog"] = log.ToString(Formatting.None);
                    return Task.FromResult(true);
                }, () => Now, cancellationToken);
            return result.Value<string>("Outcome")!;
        }
    }
}
