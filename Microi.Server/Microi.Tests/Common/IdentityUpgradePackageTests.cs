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
        var packageVersionText = package["PackageInfo"]?["Version"]?.Value<string>()?.TrimStart('v', 'V');
        Assert.True(
            Version.TryParse(packageVersionText, out var packageVersion)
            && packageVersion >= new Version(6, 5, 1),
            $"SaaS 引擎身份数据包版本过低：{packageVersionText ?? "(空)"}");
        Assert.True(package["PackageInfo"]?["IncludeSource"]?.Value<bool>());

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

        var userTable = Assert.Single(tables,
            table => table["Name"]?.Value<string>() == "sys_user");
        var publicAvatar = Assert.Single(fields, field =>
            field["TableId"]?.Value<string>() == userTable["Id"]?.Value<string>()
            && field["Name"]?.Value<string>() == "PublicAvatar");
        Assert.Equal("varchar(2000)", publicAvatar["Type"]?.Value<string>());
        Assert.Equal("ImgUpload", publicAvatar["Component"]?.Value<string>());
        Assert.Contains("\"Limit\":false", publicAvatar["Config"]?.Value<string>());
        Assert.Contains(package["PhysicalColumns"]?.Children<JObject>() ?? [], column =>
            column["TABLE_NAME"]?.Value<string>() == "sys_user"
            && column["COLUMN_NAME"]?.Value<string>() == "PublicAvatar"
            && column["COLUMN_TYPE"]?.Value<string>() == "varchar(2000)");

        var settingsDataSet = Assert.Single(package["DataSets"]?.Children<JObject>()
            .Where(item => item["TableName"]?.Value<string>() == "mci_system_setting") ?? []);
        Assert.Equal("InsertIfMissing", settingsDataSet["ConflictPolicy"]?.Value<string>());
        Assert.Equal(9, settingsDataSet["Rows"]?.Children().Count());

        var bundle = Assert.Single(package["ApplicationBundles"]?.Children<JObject>()
            .Where(item => item["Application"]?["AppKey"]?.Value<string>() == "microi-platform-service") ?? []);
        Assert.Equal("v1.5.6", bundle["VersionNo"]?.Value<string>());
        Assert.True(bundle["IncludeSource"]?.Value<bool>());
        Assert.Equal(13, bundle["Application"]?["CurrentVersion"]?.Value<int>());
        Assert.Equal("v1.5.6", bundle["Application"]?["BuildVersion"]?.Value<string>());
        Assert.Equal("v1.5.6", bundle["MicroService"]?["BuildVersion"]?.Value<string>());
        Assert.All(bundle["Routes"]?.Children<JObject>() ?? [], route =>
            Assert.Equal("v1.5.6", route["BuildVersion"]?.Value<string>()));
        Assert.NotNull(bundle["PackageAssets"]?["SourceZip"]);
        Assert.False(string.IsNullOrWhiteSpace(
            bundle["PackageAssets"]?["SourceZip"]?["Sha256"]?.Value<string>()));
        var routes = bundle["Routes"]?.Children<JObject>().ToList() ?? [];
        Assert.DoesNotContain(routes, route => route["RoutePath"]?.Value<string>() == "/");
        Assert.Contains(routes, route =>
            route["RoutePath"]?.Value<string>() == "/personal-settings"
            && route["PageTitle"]?.Value<string>() == "个人中心");
        Assert.Contains(routes, route =>
            route["RoutePath"]?.Value<string>() == "/system-settings"
            && route["PageTitle"]?.Value<string>() == "租户系统设置");
        var buildAssets = bundle["BuildAssets"]?.Children<JObject>().ToList() ?? [];
        Assert.NotEmpty(buildAssets);
        Assert.Contains(buildAssets, asset =>
            asset["Path"]?.Value<string>()?.Contains("identity-tech-banner", StringComparison.Ordinal) == true);
        var sourceFiles = bundle["SourceFiles"]?.Children<JObject>().ToList() ?? [];
        Assert.Equal(23, sourceFiles.Count);
        Assert.Contains(sourceFiles, file =>
            file["Path"]?.Value<string>() == "src/PersonalSettings.vue"
            && !string.IsNullOrWhiteSpace(file["FileByteBase64"]?.Value<string>()));
        Assert.Contains(sourceFiles, file =>
            file["Path"]?.Value<string>() == "src/identity-verification.js"
            && !string.IsNullOrWhiteSpace(file["Sha256"]?.Value<string>()));
    }

    [Fact]
    public void StoreImporterOnlyNormalizesLegacyBooleanTextForDeclaredSwitchFields()
    {
        var root = FindRepositoryRoot();
        var importerPath = Path.Combine(root, "Microi.Server", "Microi.Upgrade", "Resource", "import-package.js");
        var baseImporterPath = Path.Combine(root, "Microi.Server", "Microi.Upgrade", "Resource",
            ".resource-sync-base", "import-package.js");
        var importer = File.ReadAllText(importerPath);
        var baseImporter = File.ReadAllText(baseImporterPath);

        Assert.Equal(baseImporter, importer);
        Assert.Contains("var isPackageSwitchColumn", importer, StringComparison.Ordinal);
        Assert.Contains("String(packageField.Component || '').toLowerCase() != 'switch'", importer,
            StringComparison.Ordinal);
        Assert.Contains("packageDeclaresSameNameSwitch", importer, StringComparison.Ordinal);
        Assert.Contains("INNER JOIN diy_table dt ON dt.Id = df.TableId", importer, StringComparison.Ordinal);
        Assert.Contains("physical_schema_switch_metadata_fallback_", importer, StringComparison.Ordinal);
        Assert.Contains("normalizeSwitchLiteral('true', 1)", importer, StringComparison.Ordinal);
        Assert.Contains("normalizeSwitchLiteral('false', 0)", importer, StringComparison.Ordinal);
        Assert.Contains("normalizedTextExpression + \" <> 'true'\"", importer, StringComparison.Ordinal);
        Assert.Contains("normalizedTextExpression + \" <> 'false'\"", importer, StringComparison.Ordinal);
        Assert.DoesNotContain("NOT IN (@p1, @p2)", importer, StringComparison.Ordinal);
        Assert.Contains("其它非数字内容必须阻止迁移", importer, StringComparison.Ordinal);
        Assert.Contains("'字段存在' + invalidCount + '条非数字数据", importer,
            StringComparison.Ordinal);
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
