using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class MicroServiceRouteNormalizationTests
{
    [Fact]
    public void EmptyMetadataKeepsExistingAliasesAndAcceptsTopLevelComponentPaths()
    {
        var old = JObject.Parse("""{"LegacyComponentPaths":["/loctek/CountingDetails"],"LegacyMenuUrls":["/pandiandan"]}""");
        var route = JObject.Parse("""{"RouteMetaJson":"{}","LegacyComponentPaths":["/loctek/NewDetails"],"sourceFile":"src/CountingDetails.vue","InternalOnly":true}""");
        var merged = V8McpLogic.BuildMicroServiceRouteMetadata(route, old);
        Assert.Equal(new[] { "/loctek/CountingDetails", "/loctek/NewDetails" }, merged["LegacyComponentPaths"]!.Values<string>());
        Assert.Equal("/pandiandan", merged["LegacyMenuUrls"]![0]!.Value<string>());
        Assert.Equal("src/CountingDetails.vue", merged.Value<string>("SourceFile"));
        Assert.True(merged.Value<bool>("InternalOnly"));
        Assert.Single(old["LegacyComponentPaths"]!);
    }

    [Fact]
    public void V3MetadataRetainsNestedMetaCompatibilityAndRejectsInvalidAliases()
    {
        var route = JObject.Parse("""{"Meta":{"title":"Details","LegacyComponentPaths":["/legacy"]}}""");
        var meta = V8McpLogic.BuildMicroServiceRouteMetadata(route);
        Assert.Equal("Details", meta.Value<string>("title"));
        Assert.Equal("/legacy", meta["LegacyComponentPaths"]![0]!.Value<string>());
        Assert.Throws<ArgumentException>(() => V8McpLogic.BuildMicroServiceRouteMetadata(
            JObject.Parse("""{"LegacyComponentPaths":"not-an-array"}""")));
    }

    [Fact]
    public void V3SnapshotCannotSilentlyDropOtherPagesOrComponentAliases()
    {
        var old = JObject.Parse("""{"RoutePath":"/inventory","RouteMetaJson":"{\"LegacyComponentPaths\":[\"/loctek/CountingDetails\"]}"}""");
        var next = JObject.Parse("""{"RoutePath":"/inventory","RouteMetaJson":"{}"}""");
        Assert.Contains("LegacyComponentPaths", V8McpLogic.ValidateMicroServiceRouteContinuity(new[] { old }, new[] { next }));
        Assert.Contains("缺少现有路由", V8McpLogic.ValidateMicroServiceRouteContinuity(new[] { old }, Array.Empty<JObject>()));
        next["LegacyComponentPaths"] = new JArray("/loctek/CountingDetails");
        Assert.Null(V8McpLogic.ValidateMicroServiceRouteContinuity(new[] { old }, new[] { next }));
        next.Remove("LegacyComponentPaths");
        next["IsEnable"] = 0;
        Assert.Null(V8McpLogic.ValidateMicroServiceRouteContinuity(new[] { old }, new[] { next }));
        old["IsDeleted"] = 1;
        Assert.Null(V8McpLogic.ValidateMicroServiceRouteContinuity(new[] { old }, Array.Empty<JObject>()));
    }

    [Theory]
    [InlineData("RouteGateMain20261013", "route-probe", "/", "/micro-app/RouteGateMain20261013/route-probe")]
    [InlineData("iTdos", "MixedCaseApp", "/designer/details", "/micro-app/iTdos/MixedCaseApp/designer/details")]
    [InlineData("tenant a", "app+key", "/设备 A/%E5%88%86%E7%BB%84?mode=edit#detail", "/micro-app/tenant%20a/app%2Bkey/%E8%AE%BE%E5%A4%87%20A/%E5%88%86%E7%BB%84?mode=edit#detail")]
    public void GeneratedPageMenuUrlUsesTrustedTenantAndEscapesCoordinates(string osClient, string appKey, string routePath, string expected)
    {
        Assert.Equal(expected, V8McpLogic.ResolveMicroServicePageMenuUrl(osClient, appKey, routePath));
    }

    [Theory]
    [InlineData("/legacy/custom-page")]
    [InlineData("/micro-app/legacy-key/designer?record=1")]
    [InlineData("")]
    public void ExplicitPageMenuUrlRemainsUnchanged(string explicitMenuUrl)
    {
        Assert.Equal(explicitMenuUrl, V8McpLogic.ResolveMicroServicePageMenuUrl("trusted-tenant", "app", "/designer", explicitMenuUrl));
    }

    [Fact]
    public void GeneratedPageMenuUrlCannotGuessMissingTenant()
    {
        Assert.Throws<ArgumentException>(() => V8McpLogic.ResolveMicroServicePageMenuUrl("", "app", "/designer"));
    }

    [Fact]
    public void DocumentedLowerCaseRouteManifestKeysAreRecognized()
    {
        var route = JObject.Parse("""
        {
          "path": "/personal-settings",
          "name": "personal-settings",
          "title": "个人中心",
          "sort": 50,
          "isHome": false,
          "isEnable": true
        }
        """);

        Assert.Equal("/personal-settings", V8McpLogic.ReadMicroServiceRouteString(route, "RoutePath", "routePath", "Path", "path"));
        Assert.Equal("personal-settings", V8McpLogic.ReadMicroServiceRouteString(route, "PageKey", "pageKey", "Key", "key", "Name", "name"));
        Assert.Equal("个人中心", V8McpLogic.ReadMicroServiceRouteString(route, "PageTitle", "pageTitle", "Title", "title"));
        Assert.Equal(50, V8McpLogic.ReadMicroServiceRouteInt(route, 0, "Sort", "sort"));
        Assert.Equal(0, V8McpLogic.ReadMicroServiceRouteInt(route, 1, "IsHome", "isHome"));
        Assert.Equal(1, V8McpLogic.ReadMicroServiceRouteInt(route, 0, "IsEnable", "isEnable"));
    }

    [Fact]
    public void LegacyPascalCaseRouteManifestKeysRemainCompatible()
    {
        var route = JObject.Parse("""
        {
          "RoutePath": "/legacy",
          "PageKey": "legacy",
          "PageTitle": "旧页面",
          "Sort": 8,
          "IsHome": 1
        }
        """);

        Assert.Equal("/legacy", V8McpLogic.ReadMicroServiceRouteString(route, "RoutePath", "routePath", "Path", "path"));
        Assert.Equal("legacy", V8McpLogic.ReadMicroServiceRouteString(route, "PageKey", "pageKey", "Key", "key", "Name", "name"));
        Assert.Equal(8, V8McpLogic.ReadMicroServiceRouteInt(route, 0, "Sort", "sort"));
        Assert.Equal(1, V8McpLogic.ReadMicroServiceRouteInt(route, 0, "IsHome", "isHome"));
    }
}
