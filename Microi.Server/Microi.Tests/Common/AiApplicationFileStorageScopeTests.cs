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
    [InlineData("PublicBuildStream")]
    [InlineData("PublicBuildStreamArchived")]
    [InlineData("PublicBuildOnly")]
    public void PublicBuildScopes_AreNeverReturnedAsPrivateSource(string storageScope)
    {
        var file = new JObject
        {
            ["StorageScope"] = storageScope,
            ["FilePath"] = "dist/assets/_plugin-vue_export-helper-DlAUqK2U.js",
            ["HdfsPath"] = "/micro-app/loctek/loctek-custom-pages/v1.1.3/assets/helper.js",
            ["PublishHdfsPath"] = "/micro-app/loctek/loctek-custom-pages/assets/helper.js"
        };

        Assert.True(V8McpLogic.IsPublishedAiApplicationBuildFile(file));
    }

    [Fact]
    public void SourceReplacement_PreservesPublicBuildRows()
    {
        var syncedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "src/App.vue" };
        var publicBuild = new JObject
        {
            ["StorageScope"] = "PublicBuildStream",
            ["FilePath"] = "dist/assets/index.js"
        };
        var currentSource = new JObject
        {
            ["StorageScope"] = "Private",
            ["FilePath"] = "src/App.vue"
        };
        var staleSource = new JObject
        {
            ["StorageScope"] = "Private",
            ["FilePath"] = "src/old.vue"
        };

        Assert.False(V8McpLogic.ShouldRemoveAiApplicationSourceFile(publicBuild, syncedPaths));
        Assert.False(V8McpLogic.ShouldRemoveAiApplicationSourceFile(currentSource, syncedPaths));
        Assert.True(V8McpLogic.ShouldRemoveAiApplicationSourceFile(staleSource, syncedPaths));
    }

    [Theory]
    [InlineData("ApplicationAssetMultipartSession")]
    [InlineData("ApplicationAssetPublishAudit")]
    public void SourceReplacement_PreservesControlPlaneRows(string storageScope)
    {
        var syncedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "src/App.vue" };
        var controlPlaneRow = new JObject
        {
            ["StorageScope"] = storageScope,
            ["FilePath"] = "dist/downloads/large-installer.exe"
        };

        Assert.False(V8McpLogic.IsPrivateAiApplicationSourceFile(controlPlaneRow));
        Assert.False(V8McpLogic.ShouldRemoveAiApplicationSourceFile(controlPlaneRow, syncedPaths));
    }

    [Fact]
    public void LegacyPrivateSource_WithoutStorageScope_RemainsReplaceable()
    {
        var syncedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "src/App.vue" };
        var legacySource = new JObject
        {
            ["FilePath"] = "src/old.vue",
            ["HdfsPath"] = "/micro-app/loctek/source/src/old.vue",
            ["PublishHdfsPath"] = ""
        };

        Assert.True(V8McpLogic.IsPrivateAiApplicationSourceFile(legacySource));
        Assert.True(V8McpLogic.ShouldRemoveAiApplicationSourceFile(legacySource, syncedPaths));
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
