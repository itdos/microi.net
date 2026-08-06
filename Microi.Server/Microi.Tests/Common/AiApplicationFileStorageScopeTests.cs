using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public class AiApplicationFileStorageScopeTests
{
    [Fact]
    public void PublishedBuildFile_UsesPublicScope_WhenStoragePathsMatch()
    {
        var file = new JObject
        {
            ["HdfsPath"] = @"/micro-app/loctek/dist/assets/index.js",
            ["PublishHdfsPath"] = @"\\micro-app\\loctek\\dist\\assets\\index.js\\"
        };

        Assert.True(V8McpLogic.IsPublishedAiApplicationBuildFile(file));
    }

    [Fact]
    public void PrivateSourceFile_StaysPrivate_WhenPublishedPathDiffers()
    {
        var file = new JObject
        {
            ["HdfsPath"] = "/micro-app/loctek/source/src/App.vue",
            ["PublishHdfsPath"] = "/micro-app/loctek/dist/src/App.vue"
        };

        Assert.False(V8McpLogic.IsPublishedAiApplicationBuildFile(file));
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", "/micro-app/loctek/dist/index.html")]
    [InlineData("/micro-app/loctek/source/index.html", "")]
    public void MissingStoragePath_NeverSwitchesToPublicScope(string? hdfsPath, string? publishHdfsPath)
    {
        var file = new JObject
        {
            ["HdfsPath"] = hdfsPath,
            ["PublishHdfsPath"] = publishHdfsPath
        };

        Assert.False(V8McpLogic.IsPublishedAiApplicationBuildFile(file));
    }
}
