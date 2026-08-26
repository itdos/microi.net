using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class PlatformRuntimeUpgradeGateTests
{
    private static readonly string[] ManagedKeys =
    {
        "platform-os-client-by-domain",
        "platform-sys-config",
        "platform-lang-bundle",
        "platform-current-user",
        "platform-private-file-url",
        "platform-sys-user-public-info",
        "platform-login-wallpapers",
        "microi-init"
    };
    private static readonly HashSet<string> AnonymousKeys = new(StringComparer.Ordinal)
    {
        "platform-os-client-by-domain",
        "platform-sys-config",
        "platform-lang-bundle",
        "platform-login-wallpapers",
        "microi-init"
    };

    [Fact]
    public void SaasBundle_ClosesPlatformRuntimeUpgradeContract()
    {
        var resources = LoadBundledResources();
        var package = JObject.Parse(resources["app.microi.saas-engine.json"]);
        var hasPackagedRuntime = GetPrivateStaticMethod("HasPackagedPlatformRuntime");

        Assert.True(Assert.IsType<bool>(hasPackagedRuntime.Invoke(null, new object[] { package })));
        var packageVersionText = package["PackageInfo"]?["Version"]?.ToString()?.TrimStart('v', 'V');
        Assert.True(System.Version.TryParse(packageVersionText, out var packageVersion));
        Assert.True(packageVersion >= new System.Version(7, 6, 20));
        Assert.Contains(
            "Installer:DeclaredSaaSRuntimeApiClosureV1",
            package["PackageInfo"]?["RequiredPlatformCapabilities"]?.Values<string>()
            ?? Enumerable.Empty<string>());

        foreach (var key in ManagedKeys)
        {
            var engine = Assert.Single(
                package["SysApiEngines"]!.Children<JObject>(),
                item => item["ApiEngineKey"]?.ToString() == key);
            Assert.Equal(1, engine["IsEnable"]?.Value<int>());
            Assert.Equal(0, engine["StopHttp"]?.Value<int>());
            Assert.Equal("/apiengine/" + key, engine["ApiAddress"]?.ToString());
            Assert.StartsWith(
                "/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1",
                engine["ApiV8Code"]?.ToString()?.TrimStart());
            if (AnonymousKeys.Contains(key))
            {
                Assert.DoesNotContain(
                    "V8.ApiEngine.Run('platform-runtime-custom-hook'",
                    engine["ApiV8Code"]?.ToString());
            }
            else
            {
                Assert.Contains(
                    "V8.ApiEngine.Run('platform-runtime-custom-hook'",
                    engine["ApiV8Code"]?.ToString());
            }
            Assert.Equal(
                "Managed",
                package["ResourcePolicies"]?["ApiEngines"]?[key]?["UpgradePolicy"]?.ToString());
        }

        var hook = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-runtime-custom-hook");
        Assert.Equal(1, hook["IsEnable"]?.Value<int>());
        Assert.Equal(1, hook["StopHttp"]?.Value<int>());
        Assert.Equal(
            "CreateIfMissing",
            package["ResourcePolicies"]?["ApiEngines"]?["platform-runtime-custom-hook"]?["UpgradePolicy"]?.ToString());

        var wallpapers = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-login-wallpapers");
        Assert.Equal("v1.1.0", wallpapers["Version"]?.ToString());
        Assert.Contains("V8.Method.GetLoginWallpapers()", wallpapers["ApiV8Code"]?.ToString());
        Assert.DoesNotContain("GetTableDataAnonymous", wallpapers["ApiV8Code"]?.ToString());

        var legacyInit = Assert.Single(
            package["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "microi-init");
        Assert.Equal("v2.0.2", legacyInit["Version"]?.ToString());
        Assert.Contains("GetCurrentToken(rawToken, osClient)", legacyInit["ApiV8Code"]?.ToString());
        Assert.Contains("RefreshLoginUser(", legacyInit["ApiV8Code"]?.ToString());
        Assert.Contains("GetLegacyInitMenuTree(rawToken, osClient)", legacyInit["ApiV8Code"]?.ToString());
        Assert.Contains("safeCurrentUserProjection", legacyInit["ApiV8Code"]?.ToString());
        Assert.Contains("DataAppend: { OsClient: osClient }", legacyInit["ApiV8Code"]?.ToString());
        Assert.DoesNotContain("GetFormData({", legacyInit["ApiV8Code"]?.ToString());
    }

    [Fact]
    public void StartupDependencyGate_LoadsEveryEngineFromAllOfficialBaselinePackages()
    {
        var method = typeof(UpgradeAppStore).GetMethod(
            "LoadBundledStartupDependencyEngines",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        var engines = Assert.IsAssignableFrom<IReadOnlyList<JObject>>(
            method!.Invoke(null, null));
        var resources = LoadBundledResources();
        var packageResources = new[]
        {
            "app.microi.form-engine.json",
            "app.microi.module-engine.json",
            "app.microi.saas-engine.json",
            "app.microi.sso.json",
            "app.microi.store.json",
            "app.microi.sys_user.json",
            "app.microi.sys-config.json",
            "app.microi.message-notification.json",
            "app.microi.ai-engine.json"
        };
        var expected = packageResources
            .Select(resourceName => JObject.Parse(resources[resourceName]))
            .SelectMany(package => package["SysApiEngines"]?.Children<JObject>()
                ?? Enumerable.Empty<JObject>())
            .Select(item => item["ApiEngineKey"]?.ToString())
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .ToArray();

        Assert.Equal(expected.Length, expected.Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(
            expected.OrderBy(value => value, StringComparer.Ordinal),
            engines.Select(item => item["ApiEngineKey"]?.ToString())
                .OrderBy(value => value, StringComparer.Ordinal));
        Assert.All(engines, engine =>
        {
            var key = engine["ApiEngineKey"]?.ToString();
            Assert.False(string.IsNullOrWhiteSpace(engine["ApiAddress"]?.ToString()));
            var policy = engine["_OfficialUpgradePolicy"]?.ToString();
            var ownership = engine["_OfficialOwnership"]?.ToString();
            Assert.Equal(1, engine["IsEnable"]?.Value<int>());
            if (policy == "CreateIfMissing")
            {
                Assert.Equal("Tenant", ownership);
                Assert.StartsWith(
                    "/* OFFICIAL_CREATE_IF_MISSING_API_ENGINE_NOTICE_V1",
                    engine["ApiV8Code"]?.ToString()?.TrimStart());
            }
            else
            {
                Assert.Equal("Managed", policy);
                Assert.Equal("Platform", ownership);
                Assert.StartsWith(
                    "/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1",
                    engine["ApiV8Code"]?.ToString()?.TrimStart());
            }
            Assert.False(string.IsNullOrWhiteSpace(engine["_OfficialPackageResource"]?.ToString()));
        });

        var expectedSet = expected.ToHashSet(StringComparer.Ordinal);
        Assert.Contains("platform-runtime-custom-hook", expectedSet);
        Assert.Contains("platform-service-health", expectedSet);
        Assert.Contains("platform-sys-dept", expectedSet);
        Assert.Contains("mci-module-presentation-stats", expectedSet);
        Assert.Contains("get-microi-store", expectedSet);
        Assert.Contains("bulk-import-microi-store-packages", expectedSet);
        Assert.Contains("platform-background-task", expectedSet);
        foreach (var key in new[]
                 {
                     "platform-sys-menu",
                     "platform-current-user",
                     "platform-private-file-url",
                     "platform-service-health",
                     "platform-sys-dept",
                     "mci-module-presentation-stats",
                     "bulk-import-microi-store-packages",
                     "platform-background-task"
                 })
        {
            var engine = Assert.Single(engines, item => item["ApiEngineKey"]?.ToString() == key);
            Assert.Equal("/apiengine/" + key, engine["ApiAddress"]?.ToString());
        }
        var storeList = Assert.Single(
            engines,
            item => item["ApiEngineKey"]?.ToString() == "get-microi-store");
        Assert.Equal("/apiengine/get-microi-store-list", storeList["ApiAddress"]?.ToString());
    }

    [Fact]
    public void ApiStartup_DelegatesDependencyGateToUpgradeAndHostedUpgradeRepeatsIt()
    {
        var serverRoot = FindServerRoot();
        var program = File.ReadAllText(Path.Combine(serverRoot, "Microi.net.Api", "Program.cs"));
        var apiHost = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.net.Api",
            "Hosting",
            "MicroiApiHostExtensions.cs"));
        var startupGate = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Upgrade",
            "MicroiStartupGate.cs"));
        var hosted = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Upgrade",
            "MicroiUpgradeHostedService.cs"));

        Assert.Contains("RunMicroiApiAsync", program);
        Assert.Contains("EnsureConfiguredMainTenantReadyAsync", apiHost);
        Assert.Contains("EnsureMainTenantReadyAsync(clientModel", startupGate);
        Assert.Contains("EnsureStartupDependenciesAsync(mainTenant", startupGate);
        Assert.Contains("EnsureStartupDependenciesUnderLeaseAsync", hosted);
        Assert.DoesNotContain("【自动升级状态】", program);
        Assert.Contains("【自动升级状态】", startupGate);
        Assert.Contains("【自动升级状态】", hosted);
    }

    [Fact]
    public void AppStoreUpgrade_PropagatesCoreNullableDdlFailuresAndLogsSuccessfulProgressSeparately()
    {
        var source = File.ReadAllText(Path.Combine(
            FindServerRoot(),
            "Microi.Upgrade",
            "13-UpgradeAppStore.cs"));

        Assert.Contains("var nullableErrors = new List<string>();", source);
        Assert.Contains("msgs.AddRange(nullableErrors);", source);
        Assert.Contains("【核心字段可空兼容】全部检查成功", source);
        Assert.Contains("errors.Add($\"核心表 {tableName}.{columnName} 调整为允许为空失败", source);
        Assert.DoesNotContain("msgs.Add($\"核心表 {tableName} 已将", source);
    }

    [Fact]
    public void PlatformRuntimeGate_RejectsManagedDrift_ButNeverComparesTenantHookSource()
    {
        var package = JObject.Parse(LoadBundledResources()["app.microi.saas-engine.json"]);
        var hasPackagedRuntime = GetPrivateStaticMethod("HasPackagedPlatformRuntime");
        var hasExpectedEngine = GetPrivateStaticMethod("HasExpectedPlatformRuntimeEngineContract");

        var brokenManaged = (JObject)package.DeepClone();
        var managedEngine = Assert.Single(
            brokenManaged["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-current-user");
        managedEngine["ApiV8Code"] = managedEngine["ApiV8Code"]?.ToString()
            .Replace("OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1", "MISSING_OFFICIAL_NOTICE");
        Assert.False(Assert.IsType<bool>(hasPackagedRuntime.Invoke(null, new object[] { brokenManaged })));

        var tenantOwnedPackage = (JObject)package.DeepClone();
        var hook = Assert.Single(
            tenantOwnedPackage["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-runtime-custom-hook");
        var caseVariantHook = (JObject)hook.DeepClone();
        caseVariantHook["ApiEngineKey"] = "PLATFORM-RUNTIME-CUSTOM-HOOK";
        Assert.True(Assert.IsType<bool>(hasExpectedEngine.Invoke(
            null,
            new object[] { caseVariantHook, false })));
        hook["ApiV8Code"] = "return { Code: 1, Data: { TenantOwned: true } };";
        hook["Version"] = "tenant-custom-version";
        hook["ApiAddress"] = "/tenant-owned-hook";
        hook["AllowAnonymous"] = 1;

        Assert.True(Assert.IsType<bool>(hasExpectedEngine.Invoke(null, new object[] { hook, false })));
        Assert.False(Assert.IsType<bool>(hasExpectedEngine.Invoke(null, new object[] { hook, true })));
        Assert.False(Assert.IsType<bool>(hasPackagedRuntime.Invoke(null, new object[] { tenantOwnedPackage })));

        var contractError = GetPrivateStaticMethod("GetStartupDependencyContractError");
        var bundledHook = Assert.Single(
            Assert.IsAssignableFrom<IReadOnlyList<JObject>>(
                GetPrivateStaticMethod("LoadBundledStartupDependencyEngines").Invoke(null, null)),
            item => item["ApiEngineKey"]?.ToString() == "platform-runtime-custom-hook");
        var tenantTombstone = new JObject
        {
            ["ApiEngineKey"] = "PLATFORM-RUNTIME-CUSTOM-HOOK",
            ["ApiAddress"] = "/tenant-owned-hook",
            ["ApiV8Code"] = string.Empty,
            ["IsEnable"] = 0,
            ["StopHttp"] = 0,
            ["AllowAnonymous"] = 1,
            ["IsDeleted"] = 1
        };
        Assert.Equal(
            string.Empty,
            Assert.IsType<string>(contractError.Invoke(
                null,
                new object[] { tenantTombstone, bundledHook })));

        hook["StopHttp"] = 0;
        hook["IsDeleted"] = 1;
        Assert.True(Assert.IsType<bool>(hasExpectedEngine.Invoke(null, new object[] { hook, false })));
        Assert.False(Assert.IsType<bool>(hasExpectedEngine.Invoke(null, new object[] { hook, true })));
        Assert.False(Assert.IsType<bool>(hasPackagedRuntime.Invoke(null, new object[] { tenantOwnedPackage })));
    }

    [Fact]
    public void LegacyInitMenuAtom_IsKeyBoundAndRejectsEmptyOrCrossTenantCredentialsBeforeDataAccess()
    {
        var method = new V8Method();
        using (V8TenantContext.Enter("tenant-a", "some-other-engine"))
        {
            var wrongEngine = method.GetLegacyInitMenuTree("token-value", "tenant-a");
            Assert.NotEqual(1, wrongEngine.Code);
        }

        using (V8TenantContext.Enter("tenant-a", "microi-init"))
        {
            var empty = method.GetLegacyInitMenuTree("", "tenant-a");
            Assert.Equal(1001, empty.Code);

            var crossTenant = method.GetLegacyInitMenuTree("token-value", "tenant-b");
            Assert.Equal(1002, crossTenant.Code);
        }
    }

    [Fact]
    public void LoginWallpaperProjection_StripsEveryNonPublicColumn()
    {
        var projection = V8Method.CreateLoginWallpaperProjection(new JObject
        {
            ["Id"] = "wallpaper-1",
            ["Name"] = "默认壁纸",
            ["Category"] = "Default",
            ["ImgUrl"] = "/tenant/wallpaper/A.jpg",
            ["Secret"] = "must-not-leak",
            ["UserId"] = "operator-id",
            ["IsDeleted"] = 0
        });

        Assert.Equal(4, projection.Properties().Count());
        Assert.Equal("wallpaper-1", projection["Id"]?.ToString());
        Assert.Equal("默认壁纸", projection["Name"]?.ToString());
        Assert.Equal("Default", projection["Category"]?.ToString());
        Assert.Equal("/tenant/wallpaper/A.jpg", projection["ImgUrl"]?.ToString());
        Assert.Null(projection["Secret"]);
        Assert.Null(projection["UserId"]);
        Assert.Null(projection["IsDeleted"]);
    }

    [Fact]
    public void V8FirstApplicationGate_RequiresAiRuntimeSchemaAndSysUserAiKeyOwnership()
    {
        var resources = LoadBundledResources();
        var validate = GetPrivateStaticMethod("HasPackagedV8FirstApplicationRuntime");
        var sysUser = JObject.Parse(resources["app.microi.sys_user.json"]);
        var ai = JObject.Parse(resources["app.microi.ai-engine.json"]);

        Assert.True(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.sys_user.json", sysUser })));
        Assert.True(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.ai-engine.json", ai })));

        var missingAiKey = (JObject)sysUser.DeepClone();
        missingAiKey["DiyFields"] = new JArray(
            missingAiKey["DiyFields"]!.Children<JObject>().Where(row =>
                !string.Equals(row["TableName"]?.ToString(), "sys_user", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(row["Name"]?.ToString(), "AiApiKey", StringComparison.OrdinalIgnoreCase)));
        Assert.False(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.sys_user.json", missingAiKey })));

        var oldSysUserVersion = (JObject)sysUser.DeepClone();
        oldSysUserVersion["PackageInfo"]!["Version"] = "v6.3.1";
        Assert.False(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.sys_user.json", oldSysUserVersion })));

        var oldAdminVersion = (JObject)sysUser.DeepClone();
        var oldAdmin = Assert.Single(
            oldAdminVersion["SysApiEngines"]!.Children<JObject>(),
            row => string.Equals(
                row["ApiEngineKey"]?.ToString(),
                "platform-sys-user-admin",
                StringComparison.Ordinal));
        oldAdmin["Version"] = "v1.0.1";
        Assert.False(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.sys_user.json", oldAdminVersion })));

        var missingPasswordMarker = (JObject)sysUser.DeepClone();
        var markerAdmin = Assert.Single(
            missingPasswordMarker["SysApiEngines"]!.Children<JObject>(),
            row => string.Equals(
                row["ApiEngineKey"]?.ToString(),
                "platform-sys-user-admin",
                StringComparison.Ordinal));
        markerAdmin["ApiV8Code"] = markerAdmin["ApiV8Code"]?.ToString()
            .Replace("authorization.DataAppend.ChangesPassword === true", "false");
        Assert.False(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.sys_user.json", missingPasswordMarker })));

        var missingSysUserAdmin = (JObject)sysUser.DeepClone();
        missingSysUserAdmin["SysApiEngines"] = new JArray(
            missingSysUserAdmin["SysApiEngines"]!.Children<JObject>().Where(row =>
                !string.Equals(row["ApiEngineKey"]?.ToString(), "platform-sys-user-admin", StringComparison.Ordinal)));
        Assert.False(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.sys_user.json", missingSysUserAdmin })));

        var missingPromptPreview = (JObject)ai.DeepClone();
        missingPromptPreview["PhysicalColumns"] = new JArray(
            missingPromptPreview["PhysicalColumns"]!.Children<JObject>().Where(row =>
                !string.Equals(row["TABLE_NAME"]?.ToString(), "mci_ai_token_log", StringComparison.OrdinalIgnoreCase)
                || !string.Equals(row["COLUMN_NAME"]?.ToString(), "PromptPreview", StringComparison.OrdinalIgnoreCase)));
        Assert.False(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.ai-engine.json", missingPromptPreview })));
    }

    [Fact]
    public void MessageNotificationGate_RequiresFacadeRuntimeAndHookWithoutDirectFacadeHookCoupling()
    {
        var validate = GetPrivateStaticMethod("HasPackagedV8FirstApplicationRuntime");
        var expectedHook = GetPrivateStaticMethod("ExpectedV8FirstHookMarker");
        var package = JObject.Parse(File.ReadAllText(Path.Combine(
            FindServerRoot(),
            "Microi.Upgrade",
            "Resource",
            "app.microi.message-notification.json")));

        Assert.True(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.message-notification.json", package })));
        Assert.Equal("v1.0.11", package["PackageInfo"]?["Version"]?.ToString());
        Assert.Equal(string.Empty, expectedHook.Invoke(
            null, new object[] { "platform-chat-system-message" }));
        Assert.Equal("platform-message-notification-custom-hook", expectedHook.Invoke(
            null, new object[] { "platform-chat-runtime" }));

        var missingRuntimeForward = (JObject)package.DeepClone();
        var facade = Assert.Single(
            missingRuntimeForward["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-chat-system-message");
        facade["ApiV8Code"] = facade["ApiV8Code"]?.ToString()
            .Replace("platform-chat-runtime", "missing-chat-runtime");
        Assert.False(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.message-notification.json", missingRuntimeForward })));

        var missingHook = (JObject)package.DeepClone();
        var runtime = Assert.Single(
            missingHook["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-chat-runtime");
        runtime["ApiV8Code"] = runtime["ApiV8Code"]?.ToString()
            .Replace("platform-message-notification-custom-hook", "missing-message-hook");
        Assert.False(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.message-notification.json", missingHook })));

        var missingSignalRProtocol = (JObject)package.DeepClone();
        var untrustedRuntime = Assert.Single(
            missingSignalRProtocol["SysApiEngines"]!.Children<JObject>(),
            item => item["ApiEngineKey"]?.ToString() == "platform-chat-runtime");
        untrustedRuntime["ApiV8Code"] = untrustedRuntime["ApiV8Code"]?.ToString()
            .Replace("CHAT_SIGNALR_TRUSTED_PROTOCOL_V1", "missing-signalr-protocol");
        Assert.False(Assert.IsType<bool>(validate.Invoke(
            null, new object[] { "app.microi.message-notification.json", missingSignalRProtocol })));
    }

    [Fact]
    public void LegacyFieldTableNameProjection_WidensBeforeBackfillAndFreshInstallUsesSameCapacity()
    {
        var serverRoot = FindServerRoot();
        var upgradeSource = File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Upgrade",
            "Upgrade.cs"));
        Assert.Contains(
            "EnsureStringColumnCapacity(osClientSecret, \"diy_field\", \"TableName\", 255)",
            upgradeSource);

        var package = JObject.Parse(File.ReadAllText(Path.Combine(
            serverRoot,
            "Microi.Upgrade",
            "Resource",
            "app.microi.form-engine.json")));
        var ddl = Assert.Single(package["DDLStatements"]!.Children<JObject>(), item =>
            string.Equals(item["TableName"]?.ToString(), "diy_field", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("`TableName` varchar(255)", ddl["DDL"]?.ToString());
        var physical = Assert.Single(package["PhysicalColumns"]!.Children<JObject>(), item =>
            string.Equals(item["TABLE_NAME"]?.ToString(), "diy_field", StringComparison.OrdinalIgnoreCase)
            && string.Equals(item["COLUMN_NAME"]?.ToString(), "TableName", StringComparison.OrdinalIgnoreCase));
        Assert.Equal("varchar(255)", physical["COLUMN_TYPE"]?.ToString());
    }

    private static MethodInfo GetPrivateStaticMethod(string name)
    {
        var method = typeof(UpgradeAppStore).GetMethod(
            name,
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return method!;
    }

    private static IReadOnlyDictionary<string, string> LoadBundledResources()
    {
        var method = GetPrivateStaticMethod("LoadBundledResources");
        return Assert.IsAssignableFrom<IReadOnlyDictionary<string, string>>(method.Invoke(null, null));
    }

    private static string FindServerRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (File.Exists(Path.Combine(current.FullName, "Microi.Core", "Microi.Core.csproj"))
                && File.Exists(Path.Combine(current.FullName, "Microi.Upgrade", "Microi.Upgrade.csproj")))
                return current.FullName;
            var nested = Path.Combine(current.FullName, "Microi.Server");
            if (File.Exists(Path.Combine(nested, "Microi.Core", "Microi.Core.csproj"))
                && File.Exists(Path.Combine(nested, "Microi.Upgrade", "Microi.Upgrade.csproj")))
                return nested;
            current = current.Parent;
        }

        throw new DirectoryNotFoundException("未找到 Microi.Server 根目录。");
    }
}
