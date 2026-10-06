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
        Assert.Equal("Reconciled", await state.Run());
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
    }
}
