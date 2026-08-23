using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class TenantSystemSettingsSecurityTests
{
    [Fact]
    public void V8Projection_ExposesAllEnabledBackendValuesAtRoot()
    {
        var projection = TenantSystemSettingsSecurity.CreateV8Projection(new[]
        {
            new TenantSystemSettingValue
            {
                Key = "Login.GitHub.Display",
                Value = "0",
                ValueType = "Bool",
                IsEnabled = true
            },
            new TenantSystemSettingValue
            {
                Key = "Business.ApiKey",
                Value = "backend-only-value",
                ValueType = "String",
                IsEnabled = true
            },
            new TenantSystemSettingValue
            {
                Key = "Disabled.Value",
                Value = "ignored",
                ValueType = "String",
                IsEnabled = false
            }
        });

        Assert.False(projection["Login.GitHub.Display"]?.Value<bool>());
        Assert.Equal("backend-only-value", projection["Business.ApiKey"]?.ToString());
        Assert.Null(projection["Disabled.Value"]);
        Assert.Null(projection["PublicSettings"]);
    }

    [Fact]
    public void PublicProjection_NeverExposesDynamicRows()
    {
        var projection = TenantSystemSettingsSecurity.CreatePublicProjection(new[]
        {
            Row("Login.Branding.Enabled", "true", "Bool", isPublic: true),
            Row("Ui.MaxRecentItems", "12", "Int", isPublic: true),
            Row("Ui.AccentPalette", "[\"blue\",\"green\"]", "Json", isPublic: true),
            Row("Ui.ServerOnly", "hidden", "String", isPublic: false)
        });

        Assert.Empty(projection.Properties());
        Assert.All(new[]
        {
            Row("Login.Branding.Enabled", "true", "Bool", isPublic: true),
            Row("Ui.MaxRecentItems", "12", "Int", isPublic: true)
        }, row => Assert.False(TenantSystemSettingsSecurity.CanExposePublicly(row)));
    }

    [Theory]
    [InlineData("Login.Gitee.ClientSecret")]
    [InlineData("Integration.ApiToken")]
    [InlineData("Storage.MinIO.Endpoint")]
    [InlineData("Database.ConnectionString")]
    [InlineData("Redis.PublicLabel")]
    public void PublicProjection_SensitiveNamesAlwaysFailClosed(string key)
    {
        var row = Row(key, "must-not-leak", "String", isPublic: true);
        row["IsSecret"] = 0;

        var projection = TenantSystemSettingsSecurity.CreatePublicProjection(new[] { row });

        Assert.Empty(projection.Properties());
        Assert.True(TenantSystemSettingsSecurity.IsSensitiveKey(key));
    }

    [Fact]
    public void PublicProjection_SecretAndDisabledRowsNeverReachBrowser()
    {
        var secret = Row("Login.Provider.Credential", "plain", "String", isPublic: true);
        secret["IsSecret"] = 1;
        var disabled = Row("Ui.DisabledBanner", "text", "String", isPublic: true);
        disabled["IsEnabled"] = 0;

        var projection = TenantSystemSettingsSecurity.CreatePublicProjection(new[] { secret, disabled });

        Assert.Empty(projection.Properties());
    }

    [Theory]
    [InlineData("")]
    [InlineData("1Invalid")]
    [InlineData("Ui Setting")]
    [InlineData("Ui/Setting")]
    public void NormalizeKey_RejectsAmbiguousOrUnsafeKeys(string key)
    {
        Assert.Throws<ArgumentException>(() => TenantSystemSettingsSecurity.NormalizeKey(key));
    }

    [Fact]
    public void InvalidJsonTypedValue_FailsClosedAsNull()
    {
        var parsed = TenantSystemSettingsSecurity.ParseTypedValue(new JValue("{broken"), "Json");
        Assert.Equal(JTokenType.Null, parsed.Type);
    }

    [Fact]
    public void OfficialDefault_PreservesExplicitLegacyChoiceUntilTenantSaves()
    {
        var official = new Dictionary<string, TenantSystemSettingValue>(StringComparer.OrdinalIgnoreCase)
        {
            ["Login.Passkey.Enabled"] = new()
            {
                Key = "Login.Passkey.Enabled",
                Value = "true",
                IsEnabled = true,
                ValueSource = "OfficialDefault"
            }
        };
        Assert.False(TenantSystemSettingsSecurity.GetBool(
            official, "Login.Passkey.Enabled", fallback: false, preferLegacyForOfficialDefault: true));

        official["Login.Passkey.Enabled"].ValueSource = "Tenant";
        Assert.True(TenantSystemSettingsSecurity.GetBool(
            official, "Login.Passkey.Enabled", fallback: false, preferLegacyForOfficialDefault: true));
    }

    [Fact]
    public void PublicBehaviorSwitch_UsesSysConfigBeforeLegacyPrivateRows()
    {
        var legacy = new Dictionary<string, TenantSystemSettingValue>(StringComparer.OrdinalIgnoreCase)
        {
            ["Login.Passkey.Enabled"] = new()
            {
                Key = "Login.Passkey.Enabled",
                Value = "true",
                IsEnabled = true,
                ValueSource = "Tenant"
            }
        };

        Assert.False(TenantSystemSettingsSecurity.GetPublicBehaviorBool(
            new JObject { ["PasskeyEnabled"] = 0 },
            "PasskeyEnabled",
            legacy,
            "Login.Passkey.Enabled",
            fallback: true));

        Assert.True(TenantSystemSettingsSecurity.GetPublicBehaviorBool(
            new JObject { ["PasskeyEnabled"] = null },
            "PasskeyEnabled",
            legacy,
            "Login.Passkey.Enabled",
            fallback: false));
    }

    [Theory]
    [InlineData("Login.Identity.Enabled")]
    [InlineData("Login.Passkey.Enabled")]
    [InlineData("Login.Authenticator.Enabled")]
    [InlineData("Security.PasswordChange.RequireStepUp")]
    [InlineData("Login.External.Enabled")]
    [InlineData("Login.GitHub.Display")]
    public void MigratedPublicKeys_AreRecognizedAsReadOnlyCompatibilityRows(string key)
    {
        Assert.True(TenantSystemSettingsSecurity.IsMigratedPublicSettingKey(key));
        Assert.Contains(key, TenantSystemSettingsSecurity.MigratedPublicSettingKeys,
            StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void DisabledManagementTemplate_RemainsRuntimePrivateAndFallsBack()
    {
        var disabled = new TenantSystemSettingValue
        {
            Key = "Sms.Aliyun.AccessKeySecret",
            Value = "must-not-be-used",
            SecretCipher = "must-not-be-projected",
            ValueType = "String",
            IsPublic = true,
            IsSecret = true,
            IsEnabled = false,
            TenantOsClient = "iTdos"
        };
        var settings = new Dictionary<string, TenantSystemSettingValue>(StringComparer.OrdinalIgnoreCase)
        {
            [disabled.Key] = disabled
        };

        Assert.Equal("legacy-secret", TenantSystemSettingsSecurity.GetText(
            settings, disabled.Key, "legacy-secret", decryptSecret: true));
        Assert.False(TenantSystemSettingsSecurity.GetBool(
            settings, disabled.Key, fallback: false));
        Assert.Null(TenantSystemSettingsSecurity.CreateV8Projection(new[] { disabled })[disabled.Key]);
        var disabledPublicRow = Row(disabled.Key, "must-not-reach-browser", "String", isPublic: true);
        disabledPublicRow["IsEnabled"] = 0;
        Assert.Empty(TenantSystemSettingsSecurity.CreatePublicProjection(new[] { disabledPublicRow }).Properties());
    }

    [Fact]
    public void MapRuntime_OnlyReturnsTheExplicitlySelectedProviderCredential()
    {
        var settings = new Dictionary<string, TenantSystemSettingValue>(StringComparer.OrdinalIgnoreCase)
        {
            [TenantSystemSettingsSecurity.AMapClientKey] = EnabledText(
                TenantSystemSettingsSecurity.AMapClientKey, "tenant-amap-key"),
            [TenantSystemSettingsSecurity.BaiduMapClientKey] = EnabledText(
                TenantSystemSettingsSecurity.BaiduMapClientKey, "tenant-baidu-key"),
            [TenantSystemSettingsSecurity.TencentMapClientKey] = EnabledText(
                TenantSystemSettingsSecurity.TencentMapClientKey, "tenant-tencent-key")
        };

        var runtime = TenantSystemSettingsSecurity.ResolveMapRuntimeConfiguration(
            settings,
            "AMap",
            new JObject { ["BaiduAK"] = "legacy-baidu-key" });

        Assert.Equal("AMap", runtime.Provider);
        Assert.Equal("tenant-amap-key", runtime.ClientKey);
        Assert.Equal("Tenant", runtime.Source);
        Assert.Null(runtime.GetType().GetProperty("BaiduKey"));
        Assert.Null(runtime.GetType().GetProperty("TencentKey"));
    }

    [Fact]
    public void MapRuntime_SystemModePreservesLegacyBaiduDefault()
    {
        var runtime = TenantSystemSettingsSecurity.ResolveMapRuntimeConfiguration(
            new Dictionary<string, TenantSystemSettingValue>(StringComparer.OrdinalIgnoreCase),
            "System",
            new JObject
            {
                ["BaiduAK"] = "legacy-baidu-key",
                ["AMapKey"] = "legacy-amap-key"
            });

        Assert.Equal("Baidu", runtime.Provider);
        Assert.Equal("legacy-baidu-key", runtime.ClientKey);
        Assert.Equal("Legacy", runtime.Source);
    }

    [Fact]
    public void MapRuntime_TenantDefaultCanSelectTencentAndSecurityCodeIsAlwaysSensitive()
    {
        var settings = new Dictionary<string, TenantSystemSettingValue>(StringComparer.OrdinalIgnoreCase)
        {
            [TenantSystemSettingsSecurity.MapProviderKey] = EnabledText(
                TenantSystemSettingsSecurity.MapProviderKey, "Tencent"),
            [TenantSystemSettingsSecurity.TencentMapClientKey] = EnabledText(
                TenantSystemSettingsSecurity.TencentMapClientKey, "tenant-tencent-key")
        };

        var runtime = TenantSystemSettingsSecurity.ResolveMapRuntimeConfiguration(settings, "System", new JObject());

        Assert.Equal("Tencent", runtime.Provider);
        Assert.Equal("tenant-tencent-key", runtime.ClientKey);
        Assert.True(TenantSystemSettingsSecurity.IsSensitiveKey(
            TenantSystemSettingsSecurity.AMapSecurityJsCodeKey));
    }

    [Theory]
    [InlineData("https://maps.example.com/_AMapService", true)]
    [InlineData("http://localhost:8080/_AMapService", true)]
    [InlineData("javascript:alert(1)", false)]
    [InlineData("https://user:pwd@maps.example.com/proxy", false)]
    [InlineData("https://maps.example.com/proxy?token=value", false)]
    public void MapRuntime_ServiceHostAcceptsOnlyPlainHttpEndpoints(string value, bool expected)
    {
        Assert.Equal(expected, TenantSystemSettingsSecurity.TryNormalizeMapServiceHost(value, out _));
    }

    private static TenantSystemSettingValue EnabledText(string key, string value)
    {
        return new TenantSystemSettingValue
        {
            Key = key,
            Value = value,
            ValueType = "String",
            IsEnabled = true,
            IsSecret = false
        };
    }

    private static JObject Row(string key, string value, string type, bool isPublic)
    {
        return new JObject
        {
            ["ConfigKey"] = key,
            ["ConfigValue"] = value,
            ["ValueType"] = type,
            ["IsPublic"] = isPublic ? 1 : 0,
            ["IsSecret"] = 0,
            ["IsEnabled"] = 1
        };
    }
}
