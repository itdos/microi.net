using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class MicroServiceRouteNormalizationTests
{
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
