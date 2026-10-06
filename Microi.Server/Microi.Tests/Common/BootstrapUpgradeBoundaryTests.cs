using System.Reflection;
using System.Security.Cryptography;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class BootstrapUpgradeBoundaryTests
{
    private static object? Invoke(string name, params object[] arguments) => typeof(UpgradeAppStore)
        .GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static)!.Invoke(null, arguments);

    [Theory]
    [InlineData("v1.0.0", false)]
    [InlineData("v0.9.0", false)]
    [InlineData("v1.0.1", true)]
    public void AutomaticRecoveryPreservesNewerManagedCodeOnlyWhenRequiredContractRemains(string version, bool ready)
    {
        var source = new JObject { ["Version"] = "v1.0.0", ["ApiV8Code"] = "official baseline",
            ["ApiAddress"] = "/apiengine/example", ["ApiRoutes"] = "/legacy/example", ["IsEnable"] = 1,
            ["StopHttp"] = 0, ["AllowAnonymous"] = 0 };
        var installed = (JObject)source.DeepClone();
        installed["Version"] = version;
        installed["ApiV8Code"] = "newer manually installed official code";
        Assert.Equal(ready, string.IsNullOrEmpty((string)Invoke("GetStartupDependencyContractError", installed, source)!));
        if (!ready) return;
        installed["ApiRoutes"] = "/other";
        Assert.NotEmpty((string)Invoke("GetStartupDependencyContractError", installed, source)!);
        installed["ApiRoutes"] = source["ApiRoutes"];
        installed["AllowAnonymous"] = 1;
        Assert.NotEmpty((string)Invoke("GetStartupDependencyContractError", installed, source)!);
    }

    [Fact]
    public void ExistingTenantHookIsPreservedEvenWhenDisabledDeletedOrCustomized()
    {
        var source = new JObject { ["_OfficialOwnership"] = "Tenant", ["_OfficialUpgradePolicy"] = "CreateIfMissing" };
        var installed = new JObject { ["IsDeleted"] = 1, ["IsEnable"] = 0, ["ApiV8Code"] = "tenant owned" };
        Assert.Empty((string)Invoke("GetStartupDependencyContractError", installed, source)!);
        Assert.NotEmpty((string)Invoke("GetStartupDependencyContractError", null!, source)!);
    }

    [Theory]
    [InlineData("Sha256")]
    [InlineData("Hash")]
    public void MarketplaceReadbackRequiresActualBytesSizeHashAndUniquePaths(string digestField)
    {
        byte[] bytes = System.Text.Encoding.UTF8.GetBytes("<!doctype html><html>marketplace</html>");
        var asset = new JObject { ["Path"] = "index.html", ["ContentBase64"] = Convert.ToBase64String(bytes),
            ["Size"] = bytes.Length, [digestField] = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant() };
        var service = new JObject { ["AssetsJson"] = new JArray(asset).ToString() };
        Assert.True((bool)Invoke("HasDatabaseRuntimeEntryAsset", service)!);
        asset["ContentBase64"] = Convert.ToBase64String(new byte[bytes.Length]);
        service["AssetsJson"] = new JArray(asset).ToString();
        Assert.False((bool)Invoke("HasDatabaseRuntimeEntryAsset", service)!);
        asset["ContentBase64"] = Convert.ToBase64String(bytes);
        asset["Size"] = bytes.Length + 1;
        service["AssetsJson"] = new JArray(asset).ToString();
        Assert.False((bool)Invoke("HasDatabaseRuntimeEntryAsset", service)!);
        asset["Size"] = bytes.Length;
        service["AssetsJson"] = new JArray(asset, asset.DeepClone()).ToString();
        Assert.False((bool)Invoke("HasDatabaseRuntimeEntryAsset", service)!);
        service["AssetsJson"] = "[]";
        Assert.False((bool)Invoke("HasDatabaseRuntimeEntryAsset", service)!);
    }

    [Theory]
    [InlineData("([VersionId] IS NOT NULL)", true)]
    [InlineData("[VersionId] IS NOT NULL AND [FilePathHash] IS NOT NULL", true)]
    [InlineData("[VersionId] IS NULL", false)]
    [InlineData("[VersionId] IS NOT NULL OR [FilePathHash] IS NOT NULL", false)]
    public void MarketplaceSqlServerCompatibilityRecognizesOnlyKnownFileIdentityFilter(string predicate, bool expected)
    {
        Assert.Equal(expected, ApplicationAssetIdentityCompatibility.IsCompatibleSqlServerNotNullFilter(predicate,
            "VersionId", new[] { "VersionId", "FilePathHash" }));
    }

    [Fact]
    public void ProductUpgradeAssemblyContainsOnlyRecoveryResourcesAndNoRetiredMigrations()
    {
        var assembly = typeof(UpgradeAppStore).Assembly;
        Assert.Equal(new[] { "Microi.Upgrade.Resource.app.microi.bootstrap.json", "Microi.Upgrade.Resource.import-package.js" },
            assembly.GetManifestResourceNames().Order().ToArray());
        foreach (var number in new[] { 8,14,16,17,18,20,23,24,25,26,28,29,30,31,34,35,36 })
            Assert.Null(assembly.GetType("Microi.net.Upgrade" + number));
    }
}
