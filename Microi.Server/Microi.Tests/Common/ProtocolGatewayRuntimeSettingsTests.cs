using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

[Collection(SaaSRuntimeConfigurationCollection.Name)]
public sealed class ProtocolGatewayRuntimeSettingsTests
{
    [Fact]
    public void RequestedTenantSettings_AreExactAndObserveRuntimeRefresh()
    {
        var tenantA = "protocol-a-" + Guid.NewGuid().ToString("N");
        var tenantB = "protocol-b-" + Guid.NewGuid().ToString("N");
        WithTenants(
            new Dictionary<string, JObject>
            {
                [tenantA] = Model(tenantA, "state-a", "https://a.example.com"),
                [tenantB] = Model(tenantB, "state-b", "https://b.example.com")
            },
            () =>
            {
                Assert.True(TenantProtocolGatewaySettings.TryLoadChanjet(tenantB, out var settings));
                Assert.Equal(tenantB, settings.OsClient);
                Assert.Equal("state-b", settings.OAuthState);
                Assert.True(TenantProtocolGatewaySettings.TryLoadOAuthReturnUrlPolicy(
                    tenantB,
                    out var policy));
                Assert.True(policy.IsAllowed("/same-site"));
                Assert.True(policy.IsAllowed("https://b.example.com/callback?ok=1"));
                Assert.False(policy.IsAllowed("https://a.example.com/callback"));
                Assert.False(policy.IsAllowed("http://b.example.com/callback"));
                Assert.False(policy.IsAllowed("//b.example.com/callback"));

                // ReloadSingleOsClient/AddOrUptClient replace this process snapshot.
                // The protocol atom must not retain a stale secondary cache.
                OsClientExtend.ClientList[tenantB] = Secret(
                    tenantB,
                    Model(tenantB, "state-b-refreshed", "https://new-b.example.com"));
                Assert.True(TenantProtocolGatewaySettings.TryLoadChanjet(tenantB, out var refreshed));
                Assert.Equal("state-b-refreshed", refreshed.OAuthState);
                Assert.True(TenantProtocolGatewaySettings.TryLoadOAuthReturnUrlPolicy(
                    tenantB,
                    out var refreshedPolicy));
                Assert.True(refreshedPolicy.IsAllowed("https://new-b.example.com/return"));
                Assert.False(refreshedPolicy.IsAllowed("https://b.example.com/return"));
            });
    }

    [Fact]
    public void InactiveMismatchedAndCaseDuplicateTenants_FailClosed()
    {
        var tenant = "protocol-sec-" + Guid.NewGuid().ToString("N");
        WithTenants(new Dictionary<string, JObject>
        {
            [tenant] = Model(tenant, "state", "https://tenant.example.com")
        }, () =>
        {
            var model = Model(tenant, "state", "https://tenant.example.com");
            model["IsEnable"] = 0;
            OsClientExtend.ClientList[tenant] = Secret(tenant, model);
            Assert.False(TenantProtocolGatewaySettings.TryLoadChanjet(tenant, out _));

            model = Model(tenant, "state", "https://tenant.example.com");
            model["IsDeleted"] = 1;
            OsClientExtend.ClientList[tenant] = Secret(tenant, model);
            Assert.False(TenantProtocolGatewaySettings.TryLoadChanjet(tenant, out _));

            model = Model("another-tenant", "state", "https://tenant.example.com");
            OsClientExtend.ClientList[tenant] = Secret(tenant, model);
            Assert.False(TenantProtocolGatewaySettings.TryLoadChanjet(tenant, out _));

            OsClientExtend.ClientList[tenant] = Secret(
                tenant,
                Model(tenant, "state", "https://tenant.example.com"));
            var caseVariant = tenant.ToUpperInvariant();
            OsClientExtend.ClientList[caseVariant] = Secret(
                caseVariant,
                Model(caseVariant, "other-state", "https://other.example.com"));
            try
            {
                Assert.False(TenantProtocolGatewaySettings.TryLoadChanjet(tenant, out _));
            }
            finally
            {
                OsClientExtend.ClientList.TryRemove(caseVariant, out _);
            }
        });
    }

    [Fact]
    public void ProtocolSecrets_NeverReachV8CopyOrAuditProjection()
    {
        var model = Model("tenant-projection", "oauth-state", "https://tenant.example.com");
        model["DisplayName"] = "visible";
        var projection = TenantConfigurationSecurity.CreateV8Projection(model);
        var sensitiveFields = new[]
        {
            "ChanjetOAuthState", "ChanjetAesKey", "ChanjetAppKey",
            "WeChatTemplateAppSecret"
        };
        Assert.Equal("visible", projection.Value<string>("DisplayName"));
        Assert.All(sensitiveFields, field =>
        {
            Assert.Null(projection.GetValue(field, StringComparison.OrdinalIgnoreCase));
        });
        Assert.Equal("https://tenant.example.com", projection.Value<string>("OAuthReturnUrlOrigins"));
        Assert.Equal("wechat-app-id", projection.Value<string>("WeChatTemplateAppId"));
        Assert.Equal("wechat-template-id", projection.Value<string>("WeChatTemplateId"));
        Assert.Equal("wechat-mini-id", projection.Value<string>("WeChatMiniProgramAppId"));
        var tenantBoundFields = new[]
        {
            "OAuthReturnUrlOrigins",
            "ChanjetOAuthState", "ChanjetAesKey", "ChanjetAppKey",
            "WeChatTemplateAppId", "WeChatTemplateAppSecret", "WeChatTemplateId",
            "WeChatMiniProgramAppId"
        };
        Assert.All(tenantBoundFields, field =>
            Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain(field)));

        Assert.True(TenantConfigurationSecurity.IsSensitiveConfigurationField("ChanjetOAuthState"));
        Assert.True(TenantConfigurationSecurity.IsSensitiveConfigurationField("ChanjetAesKey"));
        Assert.True(TenantConfigurationSecurity.IsSensitiveConfigurationField("ChanjetAppKey"));
        Assert.True(TenantConfigurationSecurity.IsSensitiveConfigurationField("WeChatTemplateAppSecret"));
        Assert.True(UserBehaviorAudit.IsSensitiveField("ChanjetOAuthState"));
        Assert.True(UserBehaviorAudit.IsSensitiveField("ChanjetAppKey"));
    }

    [Fact]
    public void ProtocolRuntimesUseTenantBoundAtom_AndUpgradePackageAlreadyOwnsFields()
    {
        var root = FindRepositoryRoot();
        var message = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "MessageController.cs"));
        var weChat = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.WeChat", "OAuth", "WeChatOAuthRuntime.cs"));
        var runtimeReader = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Core", "SaaSEngine", "OsClient.cs"));

        Assert.DoesNotContain("GetRuntimeConfigurationValue", message, StringComparison.Ordinal);
        Assert.DoesNotContain("GetRuntimeConfigurationValue", weChat, StringComparison.Ordinal);
        Assert.Contains("TenantProtocolGatewaySettings.TryLoadChanjet", message, StringComparison.Ordinal);
        Assert.Contains("TenantProtocolGatewaySettings.TryLoadOAuthReturnUrlPolicy", weChat, StringComparison.Ordinal);
        Assert.Contains("returnUrlPolicy.IsAllowed", weChat, StringComparison.Ordinal);
        Assert.False(File.Exists(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "WeChatController.cs")));
        Assert.DoesNotContain("Security:OAuthReturnUrlOrigins", runtimeReader, StringComparison.Ordinal);
        Assert.DoesNotContain("Integrations:Chanjet:", runtimeReader, StringComparison.Ordinal);
        Assert.DoesNotContain("Integrations:WeChat:", runtimeReader, StringComparison.Ordinal);

        var package = JObject.Parse(File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Resource", "app.microi.saas-engine.json")));
        var packageFieldNames = package["DiyFields"]!
            .OfType<JObject>()
            .Where(field => string.Equals(
                field.Value<string>("TableName"),
                "sys_osclients",
                StringComparison.OrdinalIgnoreCase))
            .Select(field => field.Value<string>("Name"))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var expected = new[]
        {
            "OAuthReturnUrlOrigins",
            "ChanjetOAuthState", "ChanjetAesKey", "ChanjetAppKey",
            "WeChatTemplateAppId", "WeChatTemplateAppSecret", "WeChatTemplateId",
            "WeChatMiniProgramAppId"
        };
        Assert.All(expected, field => Assert.Contains(field, Upgrade23.RuntimeFieldNames));
        Assert.All(expected, field => Assert.Contains(field, packageFieldNames));
    }

    [Fact]
    public void ChanjetV2Settings_AcceptBoundedJsonOrDelimitedAppKeySets()
    {
        Assert.True(ChanjetV2ProtocolGatewaySettings.TryCreate(
            "tenant-v2",
            "1234567890123456",
            "[\"app-a\",\"APP-A\",\"app-b\"]",
            out var jsonSettings));
        Assert.Equal(3, jsonSettings.AllowedAppKeyCount);
        Assert.False(jsonSettings.IsAllowedAppKey("App-A"));
        Assert.True(jsonSettings.IsAllowedAppKey("APP-A"));
        Assert.True(jsonSettings.IsAllowedAppKey("app-b"));
        Assert.False(jsonSettings.IsAllowedAppKey("app-c"));

        Assert.True(ChanjetV2ProtocolGatewaySettings.TryCreate(
            "tenant-v2",
            "123456789012345678901234",
            "app-a; app-b\napp-c",
            out var delimitedSettings));
        Assert.Equal(3, delimitedSettings.AllowedAppKeyCount);
    }

    [Theory]
    [InlineData("short", "app-a")]
    [InlineData("1234567890123456", "")]
    [InlineData("1234567890123456", "[]")]
    [InlineData("1234567890123456", "[\"ok\",42]")]
    public void ChanjetV2Settings_InvalidCryptographicOrAllowListInputFailsClosed(
        string aesKey,
        string appKeys)
    {
        Assert.False(ChanjetV2ProtocolGatewaySettings.TryCreate(
            "tenant-v2",
            aesKey,
            appKeys,
            out _));
    }

    [Fact]
    public void ChanjetV2Callback_IsAdditiveTenantBoundAndManaged()
    {
        var root = FindRepositoryRoot();
        var message = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "MessageController.cs"));
        var settings = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Core", "SaaSEngine", "ChanjetV2ProtocolGatewaySettings.cs"));
        var package = JObject.Parse(File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Resource", "app.microi.saas-engine.json")));
        var systemSettings = Assert.Single(package["DataSets"]!
            .Children<JObject>()
            .Where(item => string.Equals(
                item.Value<string>("TableName"),
                "mci_system_setting",
                StringComparison.OrdinalIgnoreCase)));
        var settingRows = systemSettings["Rows"]!
            .Children<JObject>()
            .ToDictionary(row => row.Value<string>("ConfigKey")!, StringComparer.Ordinal);

        Assert.Contains("Route(\"ReceiveV2\")", message, StringComparison.Ordinal);
        Assert.Contains("OsClient.DosIsNullOrWhiteSpace()", message, StringComparison.Ordinal);
        Assert.Contains("RunTrustedProtocolAsync(", message, StringComparison.Ordinal);
        Assert.Contains("ChanjetCallbackV2EngineKey", message, StringComparison.Ordinal);
        Assert.DoesNotContain("GetConfigOsClient", settings, StringComparison.Ordinal);
        Assert.Contains("TenantSystemSettingsSecurity.LoadSnapshot", settings, StringComparison.Ordinal);
        Assert.Contains("Integration.Chanjet.CallbackV2.Enabled", settings, StringComparison.Ordinal);
        Assert.Contains("Integration.Chanjet.CallbackV2.AesKey", settings, StringComparison.Ordinal);
        Assert.Contains("Integration.Chanjet.CallbackV2.AppKeys", settings, StringComparison.Ordinal);

        var enabled = settingRows["Integration.Chanjet.CallbackV2.Enabled"];
        Assert.Equal("false", enabled.Value<string>("ConfigValue"));
        Assert.Equal(0, enabled.Value<int>("IsPublic"));
        Assert.Equal(0, enabled.Value<int>("IsSecret"));
        Assert.Equal(0, enabled.Value<int>("IsEnabled"));

        foreach (var key in new[]
                 {
                     "Integration.Chanjet.CallbackV2.AesKey",
                     "Integration.Chanjet.CallbackV2.AppKeys"
                 })
        {
            Assert.Equal(0, settingRows[key].Value<int>("IsPublic"));
            Assert.Equal(1, settingRows[key].Value<int>("IsSecret"));
            Assert.Equal(0, settingRows[key].Value<int>("IsEnabled"));
        }
    }

    private static JObject Model(string osClient, string state, string origins)
    {
        return new JObject
        {
            ["OsClient"] = osClient,
            ["IsEnable"] = 1,
            ["IsDeleted"] = 0,
            ["OAuthReturnUrlOrigins"] = origins,
            ["ChanjetOAuthState"] = state,
            ["ChanjetAesKey"] = "1234567890123456",
            ["ChanjetAppKey"] = "chanjet-app-key",
            ["WeChatTemplateAppId"] = "wechat-app-id",
            ["WeChatTemplateAppSecret"] = "wechat-app-secret",
            ["WeChatTemplateId"] = "wechat-template-id",
            ["WeChatMiniProgramAppId"] = "wechat-mini-id"
        };
    }

    private static OsClientSecret Secret(string osClient, JObject model)
    {
        return new OsClientSecret { OsClient = osClient, OsClientModel = model };
    }

    private static void WithTenants(
        IReadOnlyDictionary<string, JObject> tenants,
        Action action)
    {
        var originals = new Dictionary<string, OsClientSecret>(StringComparer.Ordinal);
        var absent = new HashSet<string>(StringComparer.Ordinal);
        foreach (var pair in tenants)
        {
            if (OsClientExtend.ClientList.TryGetValue(pair.Key, out var original))
                originals[pair.Key] = original;
            else
                absent.Add(pair.Key);
            OsClientExtend.ClientList[pair.Key] = Secret(pair.Key, pair.Value);
        }
        try
        {
            action();
        }
        finally
        {
            foreach (var pair in originals) OsClientExtend.ClientList[pair.Key] = pair.Value;
            foreach (var key in absent) OsClientExtend.ClientList.TryRemove(key, out _);
        }
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server"))
                && Directory.Exists(Path.Combine(directory.FullName, "microi.doc")))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("未找到 Microi 仓库根目录。");
    }
}
