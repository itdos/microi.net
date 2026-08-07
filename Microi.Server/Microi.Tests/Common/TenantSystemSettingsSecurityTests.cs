using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class TenantSystemSettingsSecurityTests
{
    [Fact]
    public void PublicProjection_IsDynamicPerRowAndKeepsTypedValues()
    {
        var projection = TenantSystemSettingsSecurity.CreatePublicProjection(new[]
        {
            Row("Login.Branding.Enabled", "true", "Bool", isPublic: true),
            Row("Ui.MaxRecentItems", "12", "Int", isPublic: true),
            Row("Ui.AccentPalette", "[\"blue\",\"green\"]", "Json", isPublic: true),
            Row("Ui.ServerOnly", "hidden", "String", isPublic: false)
        });

        Assert.True(projection["Login.Branding.Enabled"]?.Value<bool>());
        Assert.Equal(12, projection["Ui.MaxRecentItems"]?.Value<int>());
        Assert.Equal("green", projection["Ui.AccentPalette"]?[1]?.ToString());
        Assert.Null(projection["Ui.ServerOnly"]);
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
    public void InvalidJsonPublicValue_FailsClosedAsNull()
    {
        var projection = TenantSystemSettingsSecurity.CreatePublicProjection(new[]
        {
            Row("Ui.DynamicPayload", "{broken", "Json", isPublic: true)
        });

        Assert.Equal(JTokenType.Null, projection["Ui.DynamicPayload"]?.Type);
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
