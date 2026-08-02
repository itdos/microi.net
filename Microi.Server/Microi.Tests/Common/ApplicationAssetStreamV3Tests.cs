using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class ApplicationAssetStreamV3Tests
{
    private const string FingerprintA =
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private const string FingerprintB =
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    [Fact]
    public void ReleasePaths_IsolateEveryIdentityDimensionAndNeverEmitMutableAliases()
    {
        var identity = BuildIdentity();
        var prefix = V8McpLogic.BuildApplicationAssetV3ReleasePrefix(identity);
        var entryPath = V8McpLogic.BuildApplicationAssetV3ReleaseEntryPath(
            identity,
            "index.html");
        var publishKey = V8McpLogic.BuildApplicationAssetV3PublishIdentityKey(identity);

        Assert.Contains("/tenants/iTdos/", prefix);
        Assert.Contains("/kinds/runtime/", prefix);
        Assert.Contains("/apps/annual-lottery/", prefix);
        Assert.Contains("/releases/v3.0.0/", prefix);
        Assert.EndsWith("/requests/" + FingerprintA, prefix);
        Assert.Equal(prefix + "/assets/index.html", entryPath);
        Assert.Equal(
            "Microi:iTdos:ApplicationAssetV3:runtime:annual-lottery:v3.0.0:" + FingerprintA,
            publishKey);
        Assert.False(prefix.Contains("/root/", StringComparison.OrdinalIgnoreCase));
        Assert.False(prefix.Contains("/latest/", StringComparison.OrdinalIgnoreCase));

        var variants = new[]
        {
            CopyIdentity(identity, tenant: "tenant-b"),
            CopyIdentity(identity, kind: "source"),
            CopyIdentity(identity, appKey: "annual-lottery-b"),
            CopyIdentity(identity, version: "v3.0.1"),
            CopyIdentity(identity, requestFingerprint: FingerprintB)
        };
        foreach (var variant in variants)
        {
            Assert.NotEqual(prefix, V8McpLogic.BuildApplicationAssetV3ReleasePrefix(variant));
            Assert.NotEqual(publishKey, V8McpLogic.BuildApplicationAssetV3PublishIdentityKey(variant));
        }
    }

    [Theory]
    [InlineData("../index.html")]
    [InlineData("assets/../../index.html")]
    [InlineData("/index.html")]
    [InlineData("assets\\index.html")]
    [InlineData("assets//index.html")]
    [InlineData("assets/%2e%2e/index.html")]
    [InlineData("root/index.html")]
    [InlineData("LATEST/index.html")]
    public void RelativePathValidation_RejectsTraversalAndMutableAliasSegments(string path)
    {
        Assert.NotNull(V8McpLogic.ValidateApplicationAssetV3RelativePath(path));
        Assert.Throws<ArgumentException>(() =>
            V8McpLogic.BuildApplicationAssetV3ReleaseEntryPath(BuildIdentity(), path));
    }

    [Fact]
    public void ReleaseIdentity_RejectsReservedSegmentsAndNonCanonicalOrInvalidHashes()
    {
        var uppercaseHash = CopyIdentity(
            BuildIdentity(),
            requestFingerprint: FingerprintA.ToUpperInvariant());
        Assert.Contains(
            "小写十六进制",
            V8McpLogic.ValidateApplicationAssetV3ReleaseIdentity(uppercaseHash));

        foreach (var invalidHash in new[]
                 {
                     new string('a', 63),
                     new string('a', 65),
                     new string('g', 64)
                 })
        {
            Assert.NotNull(V8McpLogic.ValidateApplicationAssetV3ReleaseIdentity(
                CopyIdentity(BuildIdentity(), requestFingerprint: invalidHash)));
        }

        Assert.Contains(
            "root/latest",
            V8McpLogic.ValidateApplicationAssetV3ReleaseIdentity(
                CopyIdentity(BuildIdentity(), version: "latest")));
        Assert.Contains(
            "root/latest",
            V8McpLogic.ValidateApplicationAssetV3ReleaseIdentity(
                CopyIdentity(BuildIdentity(), appKey: "ROOT")));
    }

    [Fact]
    public void StableResolver_IsVersionlessButRemainsTenantKindAndAppScoped()
    {
        var first = BuildIdentity();
        var nextRelease = CopyIdentity(
            first,
            version: "v3.0.1",
            requestFingerprint: FingerprintB);
        var firstPath = V8McpLogic.BuildApplicationAssetV3StableResolverPath(
            first,
            "assets/app.js");
        var nextPath = V8McpLogic.BuildApplicationAssetV3StableResolverPath(
            nextRelease,
            "assets/app.js");

        Assert.Equal(firstPath, nextPath);
        Assert.Equal(
            "/micro-app/v3/tenants/iTdos/kinds/runtime/apps/annual-lottery/assets/assets/app.js",
            firstPath);
        Assert.DoesNotContain("v3.0.0", firstPath);
        Assert.DoesNotContain(FingerprintA, firstPath);
        Assert.False(firstPath.Contains("/root/", StringComparison.OrdinalIgnoreCase));
        Assert.False(firstPath.Contains("/latest/", StringComparison.OrdinalIgnoreCase));

        Assert.NotEqual(
            firstPath,
            V8McpLogic.BuildApplicationAssetV3StableResolverPath(
                CopyIdentity(first, tenant: "tenant-b"),
                "assets/app.js"));
        Assert.NotEqual(
            firstPath,
            V8McpLogic.BuildApplicationAssetV3StableResolverPath(
                CopyIdentity(first, kind: "source"),
                "assets/app.js"));
        Assert.NotEqual(
            firstPath,
            V8McpLogic.BuildApplicationAssetV3StableResolverPath(
                CopyIdentity(first, appKey: "annual-lottery-b"),
                "assets/app.js"));
    }

    [Fact]
    public void MicroServiceProjectionUrl_UsesV3StableResolverForNonDefaultEntry()
    {
        var stableResolver = V8McpLogic.BuildApplicationAssetV3StableResolverPath(
            BuildIdentity(),
            "admin/start.html");

        Assert.Equal(
            "/micro-app/v3/tenants/iTdos/kinds/runtime/apps/annual-lottery/assets/admin/start.html",
            stableResolver);
        Assert.Equal(
            stableResolver,
            V8McpLogic.ResolveApplicationAssetV3MicroServiceProjectionUrl(stableResolver));
        Assert.Throws<ArgumentException>(() =>
            V8McpLogic.ResolveApplicationAssetV3MicroServiceProjectionUrl(
                "/micro-app/iTdos/annual-lottery/admin/start.html"));
    }

    [Fact]
    public void PublishStateGraph_EnumeratesOnlyLegalTransitionsAndForbidsCommittedRollback()
    {
        var legal = new HashSet<(
            V8McpLogic.ApplicationAssetV3PublishState From,
            V8McpLogic.ApplicationAssetV3PublishState To)>
        {
            (V8McpLogic.ApplicationAssetV3PublishState.Prepared,
                V8McpLogic.ApplicationAssetV3PublishState.Verifying),
            (V8McpLogic.ApplicationAssetV3PublishState.Prepared,
                V8McpLogic.ApplicationAssetV3PublishState.FailedBeforeCommit),
            (V8McpLogic.ApplicationAssetV3PublishState.Verifying,
                V8McpLogic.ApplicationAssetV3PublishState.ReleaseVerified),
            (V8McpLogic.ApplicationAssetV3PublishState.Verifying,
                V8McpLogic.ApplicationAssetV3PublishState.FailedBeforeCommit),
            (V8McpLogic.ApplicationAssetV3PublishState.ReleaseVerified,
                V8McpLogic.ApplicationAssetV3PublishState.PointerCommitted),
            (V8McpLogic.ApplicationAssetV3PublishState.ReleaseVerified,
                V8McpLogic.ApplicationAssetV3PublishState.FailedBeforeCommit),
            (V8McpLogic.ApplicationAssetV3PublishState.FailedBeforeCommit,
                V8McpLogic.ApplicationAssetV3PublishState.Prepared),
            (V8McpLogic.ApplicationAssetV3PublishState.PointerCommitted,
                V8McpLogic.ApplicationAssetV3PublishState.ProjectionPending),
            (V8McpLogic.ApplicationAssetV3PublishState.PointerCommitted,
                V8McpLogic.ApplicationAssetV3PublishState.RepairRequired),
            (V8McpLogic.ApplicationAssetV3PublishState.PointerCommitted,
                V8McpLogic.ApplicationAssetV3PublishState.Completed),
            (V8McpLogic.ApplicationAssetV3PublishState.ProjectionPending,
                V8McpLogic.ApplicationAssetV3PublishState.RepairRequired),
            (V8McpLogic.ApplicationAssetV3PublishState.ProjectionPending,
                V8McpLogic.ApplicationAssetV3PublishState.Completed),
            (V8McpLogic.ApplicationAssetV3PublishState.RepairRequired,
                V8McpLogic.ApplicationAssetV3PublishState.ProjectionPending),
            (V8McpLogic.ApplicationAssetV3PublishState.RepairRequired,
                V8McpLogic.ApplicationAssetV3PublishState.Completed),
            (V8McpLogic.ApplicationAssetV3PublishState.Completed,
                V8McpLogic.ApplicationAssetV3PublishState.Superseded),
            (V8McpLogic.ApplicationAssetV3PublishState.LegacyUnverified,
                V8McpLogic.ApplicationAssetV3PublishState.ManualReview),
            (V8McpLogic.ApplicationAssetV3PublishState.ManualReview,
                V8McpLogic.ApplicationAssetV3PublishState.Superseded)
        };

        var states = Enum.GetValues<V8McpLogic.ApplicationAssetV3PublishState>();
        foreach (var from in states)
        {
            foreach (var to in states)
            {
                var expected = from == to || legal.Contains((from, to));
                Assert.Equal(
                    expected,
                    V8McpLogic.CanTransitionApplicationAssetV3PublishState(from, to));
            }
        }

        foreach (var rollbackState in new[]
                 {
                     V8McpLogic.ApplicationAssetV3PublishState.Prepared,
                     V8McpLogic.ApplicationAssetV3PublishState.Verifying,
                     V8McpLogic.ApplicationAssetV3PublishState.ReleaseVerified,
                     V8McpLogic.ApplicationAssetV3PublishState.FailedBeforeCommit
                 })
        {
            Assert.False(V8McpLogic.CanTransitionApplicationAssetV3PublishState(
                V8McpLogic.ApplicationAssetV3PublishState.PointerCommitted,
                rollbackState));
        }
        Assert.True(V8McpLogic.CanTransitionApplicationAssetV3PublishState(
            V8McpLogic.ApplicationAssetV3PublishState.PointerCommitted,
            V8McpLogic.ApplicationAssetV3PublishState.ProjectionPending));
    }

    [Fact]
    public void PointerCommitValidation_EnforcesInsertAdvanceIdempotencyAndCasGeneration()
    {
        var first = BuildPointer(BuildIdentity(), 1);
        var insert = V8McpLogic.ValidateApplicationAssetV3PointerCommit(null, first);
        Assert.True(insert.IsValid);
        Assert.Equal(V8McpLogic.ApplicationAssetV3PointerCommitMode.Insert, insert.Mode);

        var exactReplay = V8McpLogic.ValidateApplicationAssetV3PointerCommit(
            first,
            BuildPointer(BuildIdentity(), 1));
        Assert.True(exactReplay.IsValid);
        Assert.Equal(
            V8McpLogic.ApplicationAssetV3PointerCommitMode.Idempotent,
            exactReplay.Mode);

        var secondIdentity = CopyIdentity(
            BuildIdentity(),
            version: "v3.0.1",
            requestFingerprint: FingerprintB);
        var second = BuildPointer(secondIdentity, 2);
        var advance = V8McpLogic.ValidateApplicationAssetV3PointerCommit(first, second);
        Assert.True(advance.IsValid);
        Assert.Equal(V8McpLogic.ApplicationAssetV3PointerCommitMode.Advance, advance.Mode);

        var skippedGeneration = V8McpLogic.ValidateApplicationAssetV3PointerCommit(
            first,
            BuildPointer(secondIdentity, 3));
        Assert.False(skippedGeneration.IsValid);
        Assert.Contains("Generation", skippedGeneration.Error);

        var sameReleaseNewGeneration = V8McpLogic.ValidateApplicationAssetV3PointerCommit(
            first,
            BuildPointer(BuildIdentity(), 2));
        Assert.False(sameReleaseNewGeneration.IsValid);
        Assert.Contains("同一不可变 release", sameReleaseNewGeneration.Error);
    }

    [Fact]
    public void PointerCommitValidation_RejectsScopePathKeyAndStateDrift()
    {
        var expected = BuildPointer(BuildIdentity(), 1);
        var nextIdentity = CopyIdentity(
            BuildIdentity(),
            version: "v3.0.1",
            requestFingerprint: FingerprintB);

        var wrongTenant = BuildPointer(
            CopyIdentity(nextIdentity, tenant: "tenant-b"),
            2);
        Assert.Contains(
            "Tenant/Kind/AppKey",
            V8McpLogic.ValidateApplicationAssetV3PointerCommit(expected, wrongTenant).Error);

        var wrongPath = BuildPointer(nextIdentity, 2);
        wrongPath.ReleaseEntryPath = "microi/application-assets/v3/root/index.html";
        Assert.Contains(
            "ReleaseEntryPath",
            V8McpLogic.ValidateApplicationAssetV3PointerCommit(expected, wrongPath).Error);

        var wrongKey = BuildPointer(nextIdentity, 2);
        wrongKey.PublishIdentityKey = "Microi:iTdos:ApplicationAssetV3:runtime:annual-lottery";
        Assert.Contains(
            "PublishIdentityKey",
            V8McpLogic.ValidateApplicationAssetV3PointerCommit(expected, wrongKey).Error);

        var notCommitted = BuildPointer(nextIdentity, 2);
        notCommitted.PublishState = V8McpLogic.ApplicationAssetV3PublishState.ReleaseVerified;
        Assert.Contains(
            "PointerCommitted",
            V8McpLogic.ValidateApplicationAssetV3PointerCommit(expected, notCommitted).Error);

        var supersededExpected = BuildPointer(BuildIdentity(), 1);
        supersededExpected.PublishState = V8McpLogic.ApplicationAssetV3PublishState.Superseded;
        Assert.Contains(
            "Expected.PublishState",
            V8McpLogic.ValidateApplicationAssetV3PointerCommit(supersededExpected, BuildPointer(nextIdentity, 2)).Error);
    }

    [Fact]
    public void GateValidation_IsStrictForLegacyDrainAndEpochBoundV3Only()
    {
        var gate = new V8McpLogic.ApplicationAssetStreamGateSnapshot
        {
            OsClient = "iTdos",
            OsClientType = "Product",
            OsClientNetwork = "Internal",
            ApplicationStreamPublishMode = "LegacyOpen",
            ApplicationStreamMinProtocol = 2,
            ApplicationStreamGateEpoch = 7
        };

        Assert.Null(V8McpLogic.ValidateApplicationAssetStreamGate(gate, 2, null));
        Assert.Contains("仅允许 ProtocolVersion=2",
            V8McpLogic.ValidateApplicationAssetStreamGate(gate, 3, 7));
        gate.ApplicationStreamMinProtocol = 3;
        Assert.Contains("精确等于2",
            V8McpLogic.ValidateApplicationAssetStreamGateConfiguration(gate));
        gate.ApplicationStreamMinProtocol = 2;

        gate.ApplicationStreamPublishMode = "Drain";
        Assert.Contains("Drain", V8McpLogic.ValidateApplicationAssetStreamGate(gate, 2, null));
        Assert.Contains("Drain", V8McpLogic.ValidateApplicationAssetStreamGate(gate, 3, 7));
        gate.ApplicationStreamMinProtocol = 3;
        Assert.Contains("精确等于2",
            V8McpLogic.ValidateApplicationAssetStreamGateConfiguration(gate));

        gate.ApplicationStreamPublishMode = "V3Only";
        gate.ApplicationStreamMinProtocol = 3;
        Assert.Contains("仅允许 ProtocolVersion=3",
            V8McpLogic.ValidateApplicationAssetStreamGate(gate, 2, null));
        Assert.Contains("必须提供 ExpectedGateEpoch",
            V8McpLogic.ValidateApplicationAssetStreamGate(gate, 3, null));
        Assert.Contains("不一致",
            V8McpLogic.ValidateApplicationAssetStreamGate(gate, 3, 8));
        Assert.Null(V8McpLogic.ValidateApplicationAssetStreamGate(gate, 3, 7));
        gate.ApplicationStreamMinProtocol = 4;
        Assert.Contains("精确等于3",
            V8McpLogic.ValidateApplicationAssetStreamGateConfiguration(gate));
        gate.ApplicationStreamMinProtocol = 3;
        gate.ApplicationStreamGateEpoch = 0;
        Assert.Contains("GateEpoch>0",
            V8McpLogic.ValidateApplicationAssetStreamGateConfiguration(gate));
    }

    [Fact]
    public void GateCapability_UsesPublishPhasesInsteadOfTransportProtocolNames()
    {
        Assert.Equal(
            new[] { "stage", "finalize" },
            V8McpLogic.BuildApplicationAssetStreamAllowedModes("V3Only")
                .Values<string>()
                .ToArray());
        Assert.Equal(
            new[] { "stage-and-finalize" },
            V8McpLogic.BuildApplicationAssetStreamAllowedModes("LegacyOpen")
                .Values<string>()
                .ToArray());
        Assert.Empty(V8McpLogic.BuildApplicationAssetStreamAllowedModes("Drain"));
    }

    [Fact]
    public void BusinessFence_IgnoresRedisLeaseCounterResetsAndOnlyAdvancesDbFence()
    {
        const long persistedDbFence = 41L;
        var simulatedRedisLeaseTokens = new[] { 900L, 1L, 2L, 1L };
        foreach (var ignoredLeaseToken in simulatedRedisLeaseTokens)
        {
            Assert.True(ignoredLeaseToken > 0L);
            Assert.Equal(42L,
                V8McpLogic.BuildApplicationAssetV3NextPublishFence(persistedDbFence));
        }
        Assert.Throws<OverflowException>(() =>
            V8McpLogic.BuildApplicationAssetV3NextPublishFence(long.MaxValue));
    }

    [Fact]
    public void PointerCommit_ClearsEveryLegacyPackageProjectionColumn()
    {
        Assert.Equal(
            new[] { "AppPakcet", "AiAppZipFiles", "AiAppPackageManifest" },
            V8McpLogic.GetApplicationAssetV3LegacyPackageColumnsClearedOnPointerCommit());
    }

    [Fact]
    public void ImmediateProjection_NewAppKeepsNullExpectedAppVersionDistinctFromEmpty()
    {
        var newApp = new JObject
        {
            ["CurrentVersion"] = 0,
            ["AppVersion"] = JValue.CreateNull()
        };
        Assert.True(V8McpLogic.IsApplicationAssetV3ClassicBaseline(newApp, 0, null));
        Assert.False(V8McpLogic.IsApplicationAssetV3ClassicBaseline(newApp, 0, string.Empty));

        newApp["AppVersion"] = string.Empty;
        Assert.False(V8McpLogic.IsApplicationAssetV3ClassicBaseline(newApp, 0, null));
        Assert.True(V8McpLogic.IsApplicationAssetV3ClassicBaseline(newApp, 0, string.Empty));
    }

    [Fact]
    public void Recovery_NewAppRehydratesNullExpectedAppVersionWithoutCollapsingIt()
    {
        var version = new JObject { ["ExpectedAppVersion"] = JValue.CreateNull() };
        Assert.Null(V8McpLogic.ReadApplicationAssetV3NullableStringFact(
            version,
            "ExpectedAppVersion"));

        version["ExpectedAppVersion"] = string.Empty;
        Assert.Equal(string.Empty, V8McpLogic.ReadApplicationAssetV3NullableStringFact(
            version,
            "ExpectedAppVersion"));
    }

    [Fact]
    public void RouteSnapshotCanonicalization_MatchesNodeUtf8VectorAndRejectsUnsafeNumbers()
    {
        const string input = "[{\"title\":\"中文\\\"引号\",\"meta\":{\"z\":9007199254740991,\"a\":-9007199254740991},\"path\":\"/a\"},{\"order\":0}]";
        const string canonical = "[{\"meta\":{\"a\":-9007199254740991,\"z\":9007199254740991},\"path\":\"/a\",\"title\":\"中文\\\"引号\"},{\"order\":0}]";
        const string expectedSha256 = "39ac0b5c44884edcb6497dbf6a0fa8a2e95a1f2a968e8eaa10e7557e0443d47e";

        Assert.Equal(canonical, V8McpLogic.CanonicalizeApplicationAssetV3RouteSnapshot(input));
        Assert.Equal(expectedSha256, V8McpLogic.ComputeApplicationAssetV3RouteSnapshotHash(input));
        foreach (var invalid in new[]
                 {
                     "[1.0]", "[1e3]", "[9007199254740992]", "[-9007199254740992]"
                 })
        {
            Assert.Throws<ArgumentException>(() =>
                V8McpLogic.CanonicalizeApplicationAssetV3RouteSnapshot(invalid));
        }
    }

    [Fact]
    public void MicroServiceProjectionLengths_FailClosedAtUtf16DatabaseBoundaries()
    {
        const string stablePrefix = "/micro-app/v3/tenants/";
        var stable500 = stablePrefix + new string('s', 500 - stablePrefix.Length);
        var app = new JObject { ["Name"] = new string('名', 50) };
        var route = new JObject
        {
            ["RoutePath"] = "/" + new string('r', 199),
            ["PageKey"] = new string('k', 100),
            ["PageName"] = new string('名', 100),
            ["PageTitle"] = new string('题', 100),
            ["EntryPath"] = new string('e', 200),
            ["MenuUrl"] = "/" + new string('m', 499),
            ["SourceDirName"] = new string('d', 200)
        };
        var routes = new JArray(route);

        string Validate(
            string appKey = null,
            string version = null,
            string entry = null,
            string stable = null)
        {
            return V8McpLogic.ValidateApplicationAssetV3MicroServiceProjectionLengths(
                app,
                appKey ?? new string('a', 50),
                version ?? new string('v', 50),
                entry ?? new string('e', 200),
                stable ?? stable500,
                routes);
        }

        Assert.Null(Validate());
        Assert.Contains("MsKey", Validate(appKey: new string('a', 51)));
        app["Name"] = new string('名', 51);
        Assert.Contains("MsName", Validate());
        app["Name"] = string.Concat(Enumerable.Repeat("😀", 25));
        Assert.Null(Validate());
        app["Name"] = string.Concat(Enumerable.Repeat("😀", 26));
        Assert.Contains("MsName", Validate());
        app["Name"] = new string('名', 50);
        Assert.Contains("MsUrl", Validate(stable: stable500 + "x"));
        Assert.Contains("EntryPath", Validate(entry: new string('e', 201)));
        Assert.Contains("BuildVersion", Validate(version: new string('v', 51)));

        foreach (var boundary in new[]
                 {
                     (Field: "PageKey", Max: 100),
                     (Field: "PageName", Max: 100),
                     (Field: "PageTitle", Max: 100),
                     (Field: "RoutePath", Max: 200),
                     (Field: "EntryPath", Max: 200),
                     (Field: "MenuUrl", Max: 500),
                     (Field: "SourceDirName", Max: 200)
                 })
        {
            var old = route[boundary.Field];
            route[boundary.Field] = new string('x', boundary.Max + 1);
            Assert.Contains(boundary.Field, Validate());
            route[boundary.Field] = old;
        }

        var defaults = new JArray(new JObject
        {
            ["RoutePath"] = "/home",
            ["PageKey"] = new string('p', 100)
        });
        Assert.Null(V8McpLogic.ValidateApplicationAssetV3MicroServiceProjectionLengths(
            new JObject(),
            new string('a', 50),
            new string('v', 50),
            "index.html",
            V8McpLogic.BuildApplicationAssetV3StableResolverPath(BuildIdentity(), "index.html"),
            defaults));
    }

    [Fact]
    public void StableResolver_BlankPathUsesCommittedNonDefaultEntryAndExplicitPathOverridesIt()
    {
        var committedVersion = new JObject { ["EntryPath"] = "admin/start.html" };
        Assert.Equal("admin/start.html",
            V8McpLogic.ResolveApplicationAssetV3RequestedRelativePath(null, committedVersion));
        Assert.Equal("admin/start.html",
            V8McpLogic.ResolveApplicationAssetV3RequestedRelativePath("   ", committedVersion));
        Assert.Equal("assets/app.js",
            V8McpLogic.ResolveApplicationAssetV3RequestedRelativePath("assets/app.js", committedVersion));
    }

    [Fact]
    public void PublishLockKey_ContainsCanonicalTenantAndApplicationIdentity()
    {
        Assert.Equal(
            "V8Mcp:ApplicationPublish:itdos:app-01",
            V8McpLogic.BuildApplicationAssetPublishLockKey("iTdos", "app-01"));
        Assert.Throws<ArgumentException>(() =>
            V8McpLogic.BuildApplicationAssetPublishLockKey("iTdos", ""));
    }

    [Fact]
    public void ProtocolRequest_RequiresExplicitPhaseAndCanonicalInt64Strings()
    {
        var valid = BuildProtocolRequest();
        valid["ExpectedGateEpoch"] = long.MaxValue.ToString();
        valid["ExpectedPublishRowVersion"] = "9007199254740992";
        valid["ExpectedPublishFence"] = "0";
        Assert.Null(V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(valid));

        var finalize = (JObject)valid.DeepClone();
        finalize["PublishMode"] = "finalize";
        finalize["ExpectedVersionRowVersion"] = "1";
        Assert.Null(V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(finalize));

        foreach (var invalid in new[] { " 1", "1 ", "-1", "+1", "1.0", "01", "9223372036854775808" })
        {
            var request = (JObject)valid.DeepClone();
            request["ExpectedGateEpoch"] = invalid;
            Assert.Contains("ExpectedGateEpoch",
                V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(request));
        }

        var unsafeNumber = (JObject)valid.DeepClone();
        unsafeNumber["ExpectedGateEpoch"] = 9007199254740992L;
        Assert.Contains("JavaScript 安全整数",
            V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(unsafeNumber));

        var missingMode = (JObject)valid.DeepClone();
        missingMode.Remove("PublishMode");
        Assert.Contains("显式提供 PublishMode",
            V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(missingMode));

        var combinedMode = (JObject)valid.DeepClone();
        combinedMode["PublishMode"] = "stage-and-finalize";
        Assert.Contains("只允许显式 stage 或 finalize",
            V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(combinedMode));

        var emptyAppVersion = (JObject)valid.DeepClone();
        emptyAppVersion["ExpectedAppVersion"] = string.Empty;
        Assert.Contains("非空字符串或 null",
            V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(emptyAppVersion));

        var emptyActiveVersion = (JObject)valid.DeepClone();
        emptyActiveVersion["ExpectedActivePublishVersionId"] = " ";
        Assert.Contains("非空字符串或 null",
            V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(emptyActiveVersion));

        var missingRoutes = (JObject)valid.DeepClone();
        missingRoutes.Remove("RouteSnapshotJson");
        Assert.Contains("RouteSnapshotJson",
            V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(missingRoutes));

        var wrongRouteHash = (JObject)valid.DeepClone();
        wrongRouteHash["RouteSnapshotHash"] = FingerprintA;
        Assert.Contains("canonical RouteSnapshotJson",
            V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(wrongRouteHash));
    }

    [Fact]
    public void StableResolver_RequiresCommittedAppPointerAndPostCommitVersionState()
    {
        var identity = CopyIdentity(BuildIdentity(), tenant: "itdos");
        var assetManifest = new JArray
        {
            new JObject
            {
                ["Path"] = "index.html",
                ["Sha256"] = FingerprintA,
                ["Size"] = 1L,
                ["IsEntry"] = true
            }
        };
        var runtimeHash = V8McpLogic.ComputeMicroServiceManifestHash(assetManifest);
        var app = new JObject
        {
            ["Id"] = "app-1",
            ["AppKey"] = identity.AppKey,
            ["ApplicationType"] = "Web",
            ["PublishProtocolVersion"] = 3,
            ["PublishState"] = "ProjectionPending",
            ["PublishFence"] = 1L,
            ["CommittedPublishVersionId"] = "version-1",
            ["CommittedRuntimeManifestHash"] = runtimeHash
        };
        var version = new JObject
        {
            ["Id"] = "version-1",
            ["AppId"] = "app-1",
            ["VersionNo"] = identity.Version,
            ["PublishProtocolVersion"] = 3,
            ["PublishState"] = "ProjectionPending",
            ["FencingToken"] = 1L,
            ["RequestFingerprint"] = identity.RequestFingerprint,
            ["RuntimeManifestHash"] = runtimeHash,
            ["EntryPath"] = "index.html",
            ["ReleasePrefix"] = V8McpLogic.BuildApplicationAssetV3ReleasePrefix(identity),
            ["AssetManifestJson"] = assetManifest.ToString(Newtonsoft.Json.Formatting.None),
            ["RouteSnapshotJson"] = "[]",
            ["RouteSnapshotHash"] = V8McpLogic.ComputeApplicationAssetV3RouteSnapshotHash("[]")
        };

        Assert.Null(V8McpLogic.ValidateApplicationAssetV3StableResolverTarget(
            "iTdos", app, version));

        var uncommittedApp = (JObject)app.DeepClone();
        uncommittedApp["PublishState"] = "ReleaseVerified";
        Assert.Contains("应用状态尚未达到 PointerCommitted",
            V8McpLogic.ValidateApplicationAssetV3StableResolverTarget(
                "iTdos", uncommittedApp, version));

        var wrongVersion = (JObject)version.DeepClone();
        wrongVersion["PublishState"] = "ReleaseVerified";
        Assert.Contains("版本状态尚未达到 PointerCommitted",
            V8McpLogic.ValidateApplicationAssetV3StableResolverTarget(
                "iTdos", app, wrongVersion));

        var zeroFenceApp = (JObject)app.DeepClone();
        zeroFenceApp["PublishFence"] = 0L;
        Assert.Contains("必须大于0",
            V8McpLogic.ValidateApplicationAssetV3StableResolverTarget(
                "iTdos", zeroFenceApp, version));

        var mismatchedFenceVersion = (JObject)version.DeepClone();
        mismatchedFenceVersion["FencingToken"] = 2L;
        Assert.Contains("不一致",
            V8McpLogic.ValidateApplicationAssetV3StableResolverTarget(
                "iTdos", app, mismatchedFenceVersion));

        var wrongAppVersion = (JObject)version.DeepClone();
        wrongAppVersion["AppId"] = "app-2";
        Assert.Contains("version.AppId",
            V8McpLogic.ValidateApplicationAssetV3StableResolverTarget(
                "iTdos", app, wrongAppVersion));

        var uppercaseHashApp = (JObject)app.DeepClone();
        var uppercaseHashVersion = (JObject)version.DeepClone();
        uppercaseHashApp["CommittedRuntimeManifestHash"] = runtimeHash.ToUpperInvariant();
        uppercaseHashVersion["RuntimeManifestHash"] = runtimeHash.ToUpperInvariant();
        Assert.Contains("canonical lowercase",
            V8McpLogic.ValidateApplicationAssetV3StableResolverTarget(
                "iTdos", uppercaseHashApp, uppercaseHashVersion));

        var invalidHashVersion = (JObject)version.DeepClone();
        invalidHashVersion["RuntimeManifestHash"] = "not-a-sha256";
        Assert.Contains("canonical lowercase",
            V8McpLogic.ValidateApplicationAssetV3StableResolverTarget(
                "iTdos", app, invalidHashVersion));
    }

    [Fact]
    public void StableResolverManifest_RejectsTamperingDuplicatesAndWrongEntry()
    {
        var manifest = new JArray
        {
            new JObject
            {
                ["Path"] = "index.html",
                ["Sha256"] = FingerprintA,
                ["Size"] = 123L,
                ["IsEntry"] = true
            },
            new JObject
            {
                ["Path"] = "assets/app.js",
                ["Sha256"] = FingerprintB,
                ["Size"] = 456L,
                ["IsEntry"] = false
            }
        };
        var version = new JObject
        {
            ["EntryPath"] = "index.html",
            ["AssetManifestJson"] = manifest.ToString(Newtonsoft.Json.Formatting.None),
            ["RuntimeManifestHash"] = V8McpLogic.ComputeMicroServiceManifestHash(manifest)
        };
        Assert.Null(V8McpLogic.ValidateApplicationAssetV3CommittedManifest(version));

        var tampered = (JArray)manifest.DeepClone();
        tampered[1]["Sha256"] = FingerprintA;
        var tamperedVersion = (JObject)version.DeepClone();
        tamperedVersion["AssetManifestJson"] = tampered.ToString(Newtonsoft.Json.Formatting.None);
        Assert.Contains("RuntimeManifestHash",
            V8McpLogic.ValidateApplicationAssetV3CommittedManifest(tamperedVersion));

        var duplicated = (JArray)manifest.DeepClone();
        duplicated.Add((JObject)duplicated[1].DeepClone());
        var duplicateVersion = (JObject)version.DeepClone();
        duplicateVersion["AssetManifestJson"] = duplicated.ToString(Newtonsoft.Json.Formatting.None);
        Assert.Contains("重复",
            V8McpLogic.ValidateApplicationAssetV3CommittedManifest(duplicateVersion));

        var wrongEntry = (JArray)manifest.DeepClone();
        wrongEntry[0]["IsEntry"] = false;
        wrongEntry[1]["IsEntry"] = true;
        var wrongEntryVersion = (JObject)version.DeepClone();
        wrongEntryVersion["AssetManifestJson"] = wrongEntry.ToString(Newtonsoft.Json.Formatting.None);
        Assert.Contains("EntryPath",
            V8McpLogic.ValidateApplicationAssetV3CommittedManifest(wrongEntryVersion));
    }

    [Fact]
    public void PersistedPaths_RejectLogicalEncodedAndFullObjectKeysOverVarcharBoundary()
    {
        Assert.Contains("varchar(1000)",
            V8McpLogic.ValidateApplicationAssetV3RelativePath(new string('a', 1001)));
        Assert.Contains("varchar(1000)",
            V8McpLogic.ValidateApplicationAssetV3RelativePath(new string('界', 112)));

        var largestIdentity = new V8McpLogic.ApplicationAssetV3ReleaseIdentity
        {
            Tenant = new string('t', 64),
            Kind = new string('k', 32),
            AppKey = new string('a', 128),
            Version = new string('v', 64),
            RequestFingerprint = FingerprintA
        };
        var relativePath = string.Join("/", Enumerable.Repeat(new string('x', 160), 4));
        Assert.Null(V8McpLogic.ValidateApplicationAssetV3RelativePath(relativePath));
        Assert.Throws<ArgumentException>(() =>
            V8McpLogic.BuildApplicationAssetV3ReleaseEntryPath(largestIdentity, relativePath));
    }

    private static JObject BuildProtocolRequest()
    {
        return new JObject
        {
            ["ProtocolVersion"] = 3,
            ["PublishMode"] = "stage",
            ["ExpectedGateEpoch"] = "7",
            ["ExpectedPublishRowVersion"] = "0",
            ["ExpectedVersionRowVersion"] = JValue.CreateNull(),
            ["ExpectedPublishFence"] = "0",
            ["ExpectedActivePublishVersionId"] = JValue.CreateNull(),
            ["ExpectedCommittedPublishVersionId"] = JValue.CreateNull(),
            ["ExpectedCurrentVersion"] = 0,
            ["ExpectedAppVersion"] = JValue.CreateNull(),
            ["RequestId"] = "request-123",
            ["RequestFingerprint"] = FingerprintA,
            ["DeliveryBatchId"] = "batch-123",
            ["SourceManifestHash"] = FingerprintA,
            ["RuntimeManifestHash"] = FingerprintB,
            ["RouteSnapshotJson"] = "[]",
            ["RouteSnapshotHash"] = V8McpLogic.ComputeApplicationAssetV3RouteSnapshotHash("[]")
        };
    }

    private static V8McpLogic.ApplicationAssetV3ReleaseIdentity BuildIdentity()
    {
        return new V8McpLogic.ApplicationAssetV3ReleaseIdentity
        {
            Tenant = "iTdos",
            Kind = "runtime",
            AppKey = "annual-lottery",
            Version = "v3.0.0",
            RequestFingerprint = FingerprintA
        };
    }

    private static V8McpLogic.ApplicationAssetV3ReleaseIdentity CopyIdentity(
        V8McpLogic.ApplicationAssetV3ReleaseIdentity source,
        string? tenant = null,
        string? kind = null,
        string? appKey = null,
        string? version = null,
        string? requestFingerprint = null)
    {
        return new V8McpLogic.ApplicationAssetV3ReleaseIdentity
        {
            Tenant = tenant ?? source.Tenant,
            Kind = kind ?? source.Kind,
            AppKey = appKey ?? source.AppKey,
            Version = version ?? source.Version,
            RequestFingerprint = requestFingerprint ?? source.RequestFingerprint
        };
    }

    private static V8McpLogic.ApplicationAssetV3PointerSnapshot BuildPointer(
        V8McpLogic.ApplicationAssetV3ReleaseIdentity identity,
        long generation)
    {
        const string entryPath = "index.html";
        return new V8McpLogic.ApplicationAssetV3PointerSnapshot
        {
            Release = identity,
            Generation = generation,
            PublishState = V8McpLogic.ApplicationAssetV3PublishState.PointerCommitted,
            EntryRelativePath = entryPath,
            ReleaseEntryPath = V8McpLogic.BuildApplicationAssetV3ReleaseEntryPath(
                identity,
                entryPath),
            StableResolverPath = V8McpLogic.BuildApplicationAssetV3StableResolverPath(
                identity,
                entryPath),
            PublishIdentityKey = V8McpLogic.BuildApplicationAssetV3PublishIdentityKey(identity)
        };
    }
}
