using System.Reflection;
using System.Text;
using Microi.net.Api;

namespace Microi.Tests.Common;

public class MicroAppStableEntryTests
{
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

    [Fact]
    public void StableEntry_RewritesRelativeAssetsToVersionedCacheBustingUrls()
    {
        var html = "<link href=\"./assets/app.css\"><script src='./assets/app.js'></script>";

        var rewritten = Encoding.UTF8.GetString(Rewrite(html));

        Assert.Contains(
            "/micro-app/iTdos/microi-platform-service/v1.0.3/assets/app.css?v=v1.0.3",
            rewritten);
        Assert.Contains(
            "/micro-app/iTdos/microi-platform-service/v1.0.3/assets/app.js?v=v1.0.3",
            rewritten);
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
}
