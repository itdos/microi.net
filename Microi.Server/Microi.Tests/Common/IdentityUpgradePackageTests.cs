using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class IdentityUpgradePackageTests
{
    [Fact]
    public void IdentityPackageUpgradeIsAppliedPerHydratedTenant()
    {
        var root = FindRepositoryRoot();
        var hostedService = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "MicroiUpgradeHostedService.cs"));
        var appStoreUpgrade = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "13-UpgradeAppStore.cs"));

        Assert.Contains("OsClient.ClientList.Values", hostedService, StringComparison.Ordinal);
        Assert.Contains("foreach (var tenantName in tenantNames)", hostedService, StringComparison.Ordinal);
        Assert.Contains("UpgradeTenantAsync(tenantName", hostedService, StringComparison.Ordinal);
        Assert.Contains("SaaSEnginePackageResourceName", appStoreUpgrade, StringComparison.Ordinal);
        Assert.Contains(
            "InstallUpgradePackage(osClient, msgs, SaaSEnginePackageResourceName",
            appStoreUpgrade,
            StringComparison.Ordinal);
    }

    [Fact]
    public void BundledSaasPackageBootstrapsIdentityAndPersonalCenter()
    {
        var loader = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledResources",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(loader);

        var resources = Assert.IsType<Dictionary<string, string>>(loader!.Invoke(null, null));
        var package = JObject.Parse(resources["app.microi.saas-engine.json"]);
        Assert.Equal("SaaS引擎", package["PackageInfo"]?["Name"]?.Value<string>());

        var tables = package["DiyTables"]?.Children<JObject>().ToList() ?? [];
        var fields = package["DiyFields"]?.Children<JObject>().ToList() ?? [];
        var totpTable = Assert.Single(tables, table => table["Name"]?.Value<string>() == "mci_identity_totp");
        Assert.Contains(fields, field =>
            field["TableId"]?.Value<string>() == totpTable["Id"]?.Value<string>()
            && field["Name"]?.Value<string>() == "AllowStepUp"
            && field["DefaultValue"]?.Value<string>() == "1");

        var osClients = Assert.Single(tables, table => table["Name"]?.Value<string>() == "sys_osclients");
        foreach (var (name, defaultValue) in new[]
                 {
                     ("IdentityVerificationEnabled", "1"),
                     ("PasskeyEnabled", "1"),
                     ("AuthenticatorTotpEnabled", "1"),
                     ("AuthenticatorIssuer", "Microi"),
                     ("RequirePasswordChangeStepUp", "1")
                 })
        {
            var field = Assert.Single(fields, field =>
                field["TableId"]?.Value<string>() == osClients["Id"]?.Value<string>()
                && field["Name"]?.Value<string>() == name);
            Assert.Equal(defaultValue, field["DefaultValue"]?.Value<string>());
        }

        var passkeyTable = Assert.Single(tables,
            table => table["Name"]?.Value<string>() == "mci_identity_credential");
        foreach (var name in new[] { "AllowPasswordlessLogin", "AllowStepUp" })
        {
            var policyField = Assert.Single(fields, field =>
                field["TableId"]?.Value<string>() == passkeyTable["Id"]?.Value<string>()
                && field["Name"]?.Value<string>() == name);
            Assert.Equal("1", policyField["DefaultValue"]?.Value<string>());
        }

        var tenantSettingsTable = Assert.Single(tables,
            table => table["Name"]?.Value<string>() == "mci_system_setting");
        Assert.Contains(fields, field =>
            field["TableId"]?.Value<string>() == tenantSettingsTable["Id"]?.Value<string>()
            && field["Name"]?.Value<string>() == "IsPublic");
        Assert.Contains(fields, field =>
            field["TableId"]?.Value<string>() == tenantSettingsTable["Id"]?.Value<string>()
            && field["Name"]?.Value<string>() == "IsSecret");

        Assert.Single(tables,
            table => table["Name"]?.Value<string>() == "mci_user_external_identity");

        var settingsDataSet = Assert.Single(package["DataSets"]?.Children<JObject>()
            .Where(item => item["TableName"]?.Value<string>() == "mci_system_setting") ?? []);
        Assert.Equal("InsertIfMissing", settingsDataSet["ConflictPolicy"]?.Value<string>());
        Assert.Equal(9, settingsDataSet["Rows"]?.Children().Count());

        var bundle = Assert.Single(package["ApplicationBundles"]?.Children<JObject>()
            .Where(item => item["Application"]?["AppKey"]?.Value<string>() == "microi-platform-service") ?? []);
        Assert.Equal("v1.5.0", bundle["VersionNo"]?.Value<string>());
        var routes = bundle["Routes"]?.Children<JObject>().ToList() ?? [];
        Assert.DoesNotContain(routes, route => route["RoutePath"]?.Value<string>() == "/");
        Assert.Contains(routes, route =>
            route["RoutePath"]?.Value<string>() == "/personal-settings"
            && route["PageTitle"]?.Value<string>() == "个人中心");
        Assert.Contains(routes, route =>
            route["RoutePath"]?.Value<string>() == "/system-settings"
            && route["PageTitle"]?.Value<string>() == "租户系统设置");
        Assert.NotEmpty(bundle["BuildAssets"]?.Children() ?? []);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Unable to locate Microi repository root.");
    }
}
