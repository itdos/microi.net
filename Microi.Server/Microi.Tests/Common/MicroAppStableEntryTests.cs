using System.Reflection;
using System.Text;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class MicroAppStableEntryTests
{
    private const string V3RequestFingerprint = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    private static string? ResolveStandaloneRedirect(JObject application)
    {
        var method = typeof(MicroAppController).GetMethod(
            "ResolveStandaloneRedirect",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (string?)method!.Invoke(null, new object?[] { application });
    }

    private static byte[] Rewrite(string html, bool stableEntry = true)
    {
        var method = typeof(MicroAppController).GetMethod(
            "RewriteStableEntryHtml",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        return (byte[])method!.Invoke(null, new object?[]
        {
            Encoding.UTF8.GetBytes(html),
            "text/html; charset=utf-8",
            "iTdos",
            "microi-platform-service",
            "v1.0.3",
            stableEntry
        })!;
    }

    private static string? ResolveV3(
        JObject application,
        JObject version,
        string kind = "runtime",
        string? assetPath = null)
    {
        var method = typeof(MicroAppController).GetMethod(
            "ResolveApplicationAssetV3CommittedPath",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (string?)method!.Invoke(null, new object?[]
        {
            application,
            version,
            "iTdos",
            kind,
            "event-lottery-studio",
            assetPath
        });
    }

    private static (JObject Application, JObject Version, string Prefix, string Entry) BuildV3Pointer()
    {
        var identity = new V8McpLogic.ApplicationAssetV3ReleaseIdentity
        {
            Tenant = "itdos",
            Kind = "runtime",
            AppKey = "event-lottery-studio",
            Version = "v1.0.0",
            RequestFingerprint = V3RequestFingerprint
        };
        var prefix = V8McpLogic.BuildApplicationAssetV3ReleasePrefix(identity);
        var entry = V8McpLogic.BuildApplicationAssetV3ReleaseEntryPath(identity, "index.html");
        var stableEntry = V8McpLogic.BuildApplicationAssetV3StableResolverPath(identity, "index.html");
        var assetManifest = new JArray
        {
            new JObject
            {
                ["Path"] = "index.html",
                ["Sha256"] = new string('b', 64),
                ["Size"] = 123L,
                ["IsEntry"] = true
            },
            new JObject
            {
                ["Path"] = "assets/app.js",
                ["Sha256"] = new string('c', 64),
                ["Size"] = 456L,
                ["IsEntry"] = false
            }
        };
        var runtimeManifestHash = V8McpLogic.ComputeMicroServiceManifestHash(assetManifest);
        var application = JObject.FromObject(new
        {
            Id = "app-01",
            AppKey = "event-lottery-studio",
            ApplicationType = "Web",
            Status = "Published",
            PublishProtocolVersion = 3,
            PublishState = "Completed",
            PublishFence = 7L,
            CommittedPublishVersionId = "version-01",
            CommittedRuntimeManifestHash = runtimeManifestHash,
            PublicPublishPath = stableEntry,
            PreviewUrl = "https://untrusted.example.invalid/mutable/latest/index.html"
        });
        var version = JObject.FromObject(new
        {
            Id = "version-01",
            AppId = "app-01",
            VersionNo = "v1.0.0",
            Status = "Published",
            PublishProtocolVersion = 3,
            PublishState = "Completed",
            FencingToken = 7L,
            RequestFingerprint = V3RequestFingerprint,
            RuntimeManifestHash = runtimeManifestHash,
            EntryPath = "index.html",
            ReleasePrefix = prefix,
            AssetManifestJson = assetManifest.ToString(Newtonsoft.Json.Formatting.None),
            RouteSnapshotJson = "[]",
            RouteSnapshotHash = V8McpLogic.ComputeApplicationAssetV3RouteSnapshotHash("[]")
        });
        return (application, version, prefix, entry);
    }

    [Fact]
    public void StableEntry_RewritesRelativeAssetsWithoutDroppingReverseProxyPathBase()
    {
        var html = "<link href=\"./assets/app.css\"><script src='./assets/app.js'></script>";

        var rewritten = Encoding.UTF8.GetString(Rewrite(html));

        Assert.Contains(
            "./v1.0.3/assets/app.css?v=v1.0.3",
            rewritten);
        Assert.Contains(
            "./v1.0.3/assets/app.js?v=v1.0.3",
            rewritten);
        Assert.DoesNotContain("href=\"/micro-app/", rewritten);
        Assert.DoesNotContain("src='/micro-app/", rewritten);

        var stableEntry = new Uri("https://lowcode.example.com/v2/micro-app/iTdos/microi-platform-service/index.html");
        var resolvedAsset = new Uri(stableEntry, "./v1.0.3/assets/app.js?v=v1.0.3");
        Assert.Equal(
            "/v2/micro-app/iTdos/microi-platform-service/v1.0.3/assets/app.js",
            resolvedAsset.AbsolutePath);
    }

    [Fact]
    public void StableEntry_PreservesExternalAndRootRelativeUrls()
    {
        var html = "<script src=\"https://cdn.example.com/app.js\"></script><link href=\"/favicon.ico\">";

        var rewritten = Encoding.UTF8.GetString(Rewrite(html));

        Assert.Equal(html, rewritten);
    }

    [Fact]
    public void VersionedEntry_DoesNotRewritePublishedHtml()
    {
        var html = "<script src=\"./assets/app.js\"></script>";

        var rewritten = Encoding.UTF8.GetString(Rewrite(html, stableEntry: false));

        Assert.Equal(html, rewritten);
    }

    [Fact]
    public void RuntimePageLookup_DoesNotRequireOptionalPageNameColumn()
    {
        var method = typeof(MicroAppController).GetMethod(
            "GetPageSelectFields",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var fields = Assert.IsAssignableFrom<IEnumerable<string>>(method!.Invoke(null, null));
        Assert.DoesNotContain("PageName", fields);
        Assert.Contains("PageTitle", fields);
        Assert.Contains("RoutePath", fields);
    }

    [Fact]
    public void RuntimePageProjection_HandlesJValueEnableFlagWithoutDynamicDispatch()
    {
        var method = typeof(MicroAppController).GetMethod(
            "ToEnabledPage",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var enabled = JObject.FromObject(new { PageKey = "personal-settings", IsEnable = 1 });
        var disabled = JObject.FromObject(new { PageKey = "disabled-page", IsEnable = 0 });

        var enabledResult = Assert.IsType<JObject>(method!.Invoke(null, new object[] { enabled }));
        Assert.Equal("personal-settings", enabledResult["PageKey"]?.Value<string>());
        Assert.Null(method.Invoke(null, new object[] { disabled }));
    }

    [Fact]
    public void RuntimeResolve_DoesNotLoadCompiledAssetPayloads()
    {
        var method = typeof(MicroAppController).GetMethod(
            "GetServiceSelectFields",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var metadataFields = Assert.IsAssignableFrom<IEnumerable<string>>(method!.Invoke(null, new object[] { false }));
        Assert.DoesNotContain("AssetManifestJson", metadataFields);
        Assert.DoesNotContain("AssetsJson", metadataFields);
        Assert.Contains("StorageMode", metadataFields);
        Assert.DoesNotContain("SourceDirName", metadataFields);

        var assetFields = Assert.IsAssignableFrom<IEnumerable<string>>(method.Invoke(null, new object[] { true }));
        Assert.Contains("AssetManifestJson", assetFields);
        Assert.Contains("AssetsJson", assetFields);
    }

    [Theory]
    [InlineData("Web")]
    [InlineData("UniApp")]
    public void LegacyMicroAppBookmark_RedirectsStandaloneApplicationsToCurrentPreview(string applicationType)
    {
        var application = JObject.FromObject(new
        {
            ApplicationType = applicationType,
            PreviewUrl = "https://static.itdos.com/itdos/ai-app-publish/landlord-arena/index.html"
        });

        Assert.Equal(
            "https://static.itdos.com/itdos/ai-app-publish/landlord-arena/index.html",
            ResolveStandaloneRedirect(application));
    }

    [Theory]
    [InlineData("MicroService", "https://static.itdos.com/itdos/ai-app-publish/example/index.html")]
    [InlineData("Web", "https://api.itdos.com/micro-app/iTdos/example/index.html")]
    [InlineData("Web", "javascript:alert(1)")]
    public void LegacyMicroAppBookmark_DoesNotRedirectUnsupportedOrUnsafeTargets(
        string applicationType,
        string previewUrl)
    {
        var application = JObject.FromObject(new
        {
            ApplicationType = applicationType,
            PreviewUrl = previewUrl
        });

        Assert.Null(ResolveStandaloneRedirect(application));
    }

    [Fact]
    public void V3StableResolver_UsesOnlyTheCommittedImmutableDatabasePointer()
    {
        var pointer = BuildV3Pointer();

        Assert.Equal(pointer.Entry, ResolveV3(pointer.Application, pointer.Version));
        Assert.Equal(
            pointer.Prefix + "/assets/assets/app.js",
            ResolveV3(pointer.Application, pointer.Version, assetPath: "assets/app.js"));

        // PreviewUrl is intentionally untrusted input for protocol v3 and does
        // not participate in either result above.
        Assert.DoesNotContain("untrusted.example.invalid", ResolveV3(pointer.Application, pointer.Version));
    }

    [Fact]
    public void V3StableResolver_FailsClosedForPrecommitDriftAndMutablePaths()
    {
        var pointer = BuildV3Pointer();

        var precommitApplication = (JObject)pointer.Application.DeepClone();
        precommitApplication["PublishState"] = "Prepared";
        Assert.Null(ResolveV3(precommitApplication, pointer.Version));

        var precommitVersion = (JObject)pointer.Version.DeepClone();
        precommitVersion["PublishState"] = "ReleaseVerified";
        Assert.Null(ResolveV3(pointer.Application, precommitVersion));

        var mutableAlias = (JObject)pointer.Application.DeepClone();
        mutableAlias["PublicPublishPath"] = "itdos/ai-app-publish/event-lottery-studio/latest/index.html";
        mutableAlias["Status"] = "Draft";
        Assert.Equal(pointer.Entry, ResolveV3(mutableAlias, pointer.Version));

        var wrongPrefix = (JObject)pointer.Version.DeepClone();
        wrongPrefix["ReleasePrefix"] = pointer.Prefix + "-other";
        Assert.Null(ResolveV3(pointer.Application, wrongPrefix));

        var wrongManifest = (JObject)pointer.Version.DeepClone();
        wrongManifest["RuntimeManifestHash"] = new string('c', 64);
        Assert.Null(ResolveV3(pointer.Application, wrongManifest));

        var tornFence = (JObject)pointer.Version.DeepClone();
        tornFence["FencingToken"] = 8L;
        Assert.Null(ResolveV3(pointer.Application, tornFence));

        var zeroFenceApplication = (JObject)pointer.Application.DeepClone();
        var zeroFenceVersion = (JObject)pointer.Version.DeepClone();
        zeroFenceApplication["PublishFence"] = 0L;
        zeroFenceVersion["FencingToken"] = 0L;
        Assert.Null(ResolveV3(zeroFenceApplication, zeroFenceVersion));

        Assert.Null(ResolveV3(pointer.Application, pointer.Version, kind: "source"));
        Assert.Null(ResolveV3(pointer.Application, pointer.Version, assetPath: "../source.zip"));
    }
}
