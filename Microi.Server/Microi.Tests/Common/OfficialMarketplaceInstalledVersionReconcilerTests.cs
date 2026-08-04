using Microi.net;

namespace Microi.Tests.Common;

public sealed class OfficialMarketplaceInstalledVersionReconcilerTests
{
    [Fact]
    public void Plan_AlignsAllVersionFieldsForSuccessfulInstalledPlatformAppsOnly()
    {
        var stores = new[]
        {
            Store("store-platform", "app.platform", "平台应用", "v2.0.0"),
            Store("store-draft", "app.draft", "草稿应用", "v9.0.0", isApprove: 0),
            Store("store-web", "app.web", "Web应用", "v3.0.0", applicationType: "Web")
        };
        var installed = new[]
        {
            Installed("installed-platform", "store-platform", "app.platform", "平台应用", "v1.0.0", "Success"),
            Installed("installed-failed", "store-platform", "app.platform", "平台应用", "v1.0.0", "Failed"),
            Installed("installed-draft", "store-draft", "app.draft", "草稿应用", "v1.0.0", "Installed"),
            Installed("installed-web", "store-web", "app.web", "Web应用", "v1.0.0", "Installed")
        };

        var plan = OfficialMarketplaceInstalledVersionReconciler.CreatePlan(stores, installed);

        var update = Assert.Single(plan);
        Assert.Equal("installed-platform", update.InstalledRowId);
        Assert.Equal("v2.0.0", update.LatestVersion);
        Assert.False(update.RepairStoreId);
        Assert.False(update.RepairAppId);
    }

    [Fact]
    public void Plan_UsesUniqueLegacyNameAndRepairsOnlyUnclaimedStableKeys()
    {
        var stores = new[]
        {
            Store("store-form", "app.form", "表单引擎", "v6.9.6"),
            Store("store-module", "app.module", "模块引擎", "v6.9.3")
        };
        var installed = new[]
        {
            Installed("legacy-form", "", "", "表单引擎", "v6.2.3", "Installed"),
            Installed("legacy-module", "", "", "模块引擎", "v6.2.2", "Installed"),
            Installed("stable-module", "store-module", "app.module", "模块引擎", "v6.9.3", "Installed")
        };

        var plan = OfficialMarketplaceInstalledVersionReconciler.CreatePlan(stores, installed);

        Assert.Equal(2, plan.Count);
        var form = Assert.Single(plan, item => item.InstalledRowId == "legacy-form");
        Assert.True(form.RepairStoreId);
        Assert.True(form.RepairAppId);
        var legacyModule = Assert.Single(plan, item => item.InstalledRowId == "legacy-module");
        Assert.False(legacyModule.RepairStoreId);
        Assert.False(legacyModule.RepairAppId);
    }

    [Fact]
    public void Plan_SkipsConflictingOrAmbiguousMatches()
    {
        var stores = new[]
        {
            Store("store-a", "app.a", "同名应用", "v2.0.0"),
            Store("store-b", "app.b", "同名应用", "v3.0.0")
        };
        var installed = new[]
        {
            Installed("ambiguous", "", "", "同名应用", "v1.0.0", "Installed"),
            Installed("conflict", "store-a", "app.b", "", "v1.0.0", "Installed")
        };

        var plan = OfficialMarketplaceInstalledVersionReconciler.CreatePlan(stores, installed);

        Assert.Empty(plan);
    }

    [Fact]
    public void Plan_IsIdempotentAfterThePlannedStateIsApplied()
    {
        var stores = new[] { Store("store-a", "app.a", "应用A", "v2.0.0") };
        var installed = new[]
        {
            Installed("installed-a", "store-a", "app.a", "应用A", "v2.0.0", "Installed")
        };

        var plan = OfficialMarketplaceInstalledVersionReconciler.CreatePlan(stores, installed);

        Assert.Empty(plan);
    }

    private static OfficialMarketplaceAppVersionRow Store(
        string id,
        string appId,
        string name,
        string version,
        int isApprove = 1,
        string applicationType = "Platform")
    {
        return new OfficialMarketplaceAppVersionRow
        {
            Id = id,
            AppId = appId,
            AppName = name,
            Name = name,
            AppVersion = version,
            ApplicationType = applicationType,
            IsApprove = isApprove,
            IsDeleted = 0
        };
    }

    private static InstalledMarketplaceAppVersionRow Installed(
        string id,
        string storeId,
        string appId,
        string name,
        string version,
        string status)
    {
        return new InstalledMarketplaceAppVersionRow
        {
            Id = id,
            StoreId = storeId,
            AppId = appId,
            AppName = name,
            AppVersion = version,
            AppVersionInstall = version,
            PackageVersion = version,
            InstallStatus = status,
            IsDeleted = 0
        };
    }
}
