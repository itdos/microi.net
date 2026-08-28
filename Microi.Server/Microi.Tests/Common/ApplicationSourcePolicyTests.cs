using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class ApplicationSourcePolicyTests
{
    private static object Invoke(string methodName, params object?[] args)
    {
        var method = typeof(V8McpLogic).GetMethod(
            methodName,
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return method!.Invoke(null, args)!;
    }

    [Fact]
    public void SourceRowsQueryKeepsExactAppIdFilterAndBoundedPagination()
    {
        var query = JObject.FromObject(Invoke(
            "BuildApplicationSourceRowsQuery",
            "iTdos",
            "01APP",
            3,
            1000));

        Assert.Equal("iTdos", query["OsClient"]?.ToString());
        Assert.Equal("01APP", query["_Where"]?[0]?[2]?.ToString());
        Assert.Equal("AppId", query["_Where"]?[0]?[0]?.ToString());
        Assert.Equal("=", query["_Where"]?[0]?[1]?.ToString());
        Assert.Equal(3, query["_PageIndex"]?.Value<int>());
        Assert.Equal(1000, query["_PageSize"]?.Value<int>());
        Assert.Contains("HdfsPath", query["_SelectFields"]!.Values<string>());
        Assert.Contains("StorageScope", query["_SelectFields"]!.Values<string>());
    }

    [Theory]
    [InlineData("itdos/ai-app-source/01app/202608/main.js", true)]
    [InlineData("itdos/ai-app-source/xiangqi-3d-arena/202608/main.js", true)]
    [InlineData("itdos/ai-app-source/01app-other/202608/main.js", false)]
    [InlineData("itdos/ai-app-source/01other/202608/main.js", false)]
    [InlineData("itdos/ai-app-source/01app/../01other/main.js", false)]
    [InlineData("other/ai-app-source/01app/202608/main.js", false)]
    public void PrivateSourceOwnershipRequiresExactTenantAndApplicationPrefix(
        string path,
        bool expected)
    {
        var actual = (bool)Invoke(
            "IsApplicationOwnedPrivateSourcePath",
            path,
            "iTdos",
            "01APP",
            "xiangqi-3d-arena",
            "ai-app-source/01APP");

        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData("itdos/microi/app-store/ai-app-packages/xiangqi-3d-arena/202608/source.zip", true)]
    [InlineData("itdos/microi/app-store/ai-app-packages/01app/202608/source.zip", true)]
    [InlineData("itdos/microi/app-store/ai-app-packages/xiangqi-3d-arena-copy/source.zip", false)]
    [InlineData("itdos/microi/app-store/ai-app-packages/other/source.zip", false)]
    public void PublicSourceZipOwnershipRequiresExactApplicationSegment(
        string path,
        bool expected)
    {
        var actual = (bool)Invoke(
            "IsApplicationOwnedPublicSourceZipPath",
            path,
            "iTdos",
            "01APP",
            "xiangqi-3d-arena");

        Assert.Equal(expected, actual);
    }
}
