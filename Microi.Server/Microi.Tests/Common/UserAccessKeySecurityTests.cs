using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class UserAccessKeySecurityTests
{
    private static JObject NewScopedUser()
    {
        return new JObject
        {
            ["Id"] = "user-1",
            ["_IsAdmin"] = false,
            ["_AccessKeySession"] = true,
            ["_AccessKeyScopes"] = new JArray("page:open", "form:read", "api-engine:run"),
            ["_AccessKeyAllowedRoutes"] = new JArray("/mic/data-dashboard/preview/dashboard-1"),
            ["_AccessKeyAllowedTableNames"] = new JArray("mic_data_dashboard"),
            ["_AccessKeyAllowedApiEngineKeys"] = new JArray("dashboard_summary"),
            ["_AccessKeyAllowedDataSourceKeys"] = new JArray()
        };
    }

    [Fact]
    public void GeneratedCredential_UsesPublicPrefixAndStrongSecret()
    {
        var generated = UserAccessKeySecurity.GenerateCredential();

        Assert.StartsWith("microi_ak_", generated.Prefix, StringComparison.Ordinal);
        Assert.StartsWith(generated.Prefix + ".", generated.Credential, StringComparison.Ordinal);
        Assert.True(UserAccessKeySecurity.TryGetPrefix(generated.Credential, out var parsedPrefix));
        Assert.Equal(generated.Prefix, parsedPrefix);
        Assert.Equal(41, generated.Credential.Length);
    }

    [Fact]
    public void CredentialHash_UsesFixedTimeComparableDigest()
    {
        var hash = UserAccessKeySecurity.HashCredential("microi_ak_public.secret");
        var same = UserAccessKeySecurity.HashCredential("microi_ak_public.secret");
        var other = UserAccessKeySecurity.HashCredential("microi_ak_public.other");

        Assert.True(UserAccessKeySecurity.FixedTimeHashEquals(hash, same));
        Assert.False(UserAccessKeySecurity.FixedTimeHashEquals(hash, other));
        Assert.DoesNotContain("secret", hash, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void RouteScope_IsExactAndIgnoresQueryString()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.IsRouteAllowed(
            user,
            "/mic/data-dashboard/preview/dashboard-1?ShowClassicTop=0"));
        Assert.False(UserAccessKeySecurity.IsRouteAllowed(
            user,
            "/mic/data-dashboard/preview/dashboard-2"));
        Assert.False(UserAccessKeySecurity.IsRouteAllowed(user, "/system/sysuser"));
    }

    [Fact]
    public void TableScope_NarrowsReadAndDeniesWriteByDefault()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.IsTableOperationAllowed(
            user,
            "MIC_DATA_DASHBOARD",
            true));
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(
            user,
            "sys_user",
            true));
        Assert.False(UserAccessKeySecurity.IsTableOperationAllowed(
            user,
            "mic_data_dashboard",
            false));
    }

    [Fact]
    public void EngineScopes_RequireExactKey()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.IsApiEngineAllowed(user, "dashboard_summary"));
        Assert.False(UserAccessKeySecurity.IsApiEngineAllowed(user, "admin_reset_password"));
        Assert.False(UserAccessKeySecurity.IsDataSourceAllowed(user, "any-data-source"));
    }

    [Fact]
    public void ApiPathScope_DeniesAccountManagementAndAllowsReadFacade()
    {
        var user = NewScopedUser();

        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/FormEngine/GetFormData"));
        Assert.True(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/ApiEngine/Run"));
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/SysUser/UptSysUser"));
        Assert.False(UserAccessKeySecurity.IsApiPathAllowed(
            user,
            "/api/SysUserAccessKey/Create"));
    }

    [Fact]
    public void StripSessionFields_DoesNotMutateSharedIdentity()
    {
        var original = NewScopedUser();

        var clean = UserAccessKeySecurity.StripSessionFields(original);

        Assert.True(original["_AccessKeySession"]!.Value<bool>());
        Assert.Null(clean["_AccessKeySession"]);
        Assert.Equal("user-1", clean["Id"]!.ToString());
    }

    [Fact]
    public void AccessKeyTable_IsProtectedPlatformResource()
    {
        Assert.True(PlatformResourceSecurity.IsProtectedTable(
            UserAccessKeySecurity.TableName));
    }

    [Fact]
    public void Expiry_AllowsPermanentAndRejectsPastDate()
    {
        var now = new DateTime(2026, 7, 28, 12, 0, 0);

        Assert.True(UserAccessKeySecurity.IsExpiryActive(null, now));
        Assert.True(UserAccessKeySecurity.IsExpiryActive("", now));
        Assert.True(UserAccessKeySecurity.IsExpiryActive("2026-07-29 12:00:00", now));
        Assert.False(UserAccessKeySecurity.IsExpiryActive("2026-07-27 12:00:00", now));
        Assert.False(UserAccessKeySecurity.IsExpiryActive("invalid", now));
    }

    [Fact]
    public void StoredPassword_DESCanBeDecodedAndValidated()
    {
        var encrypted = EncryptHelper.DESEncode("Microi-test-password");

        var result = SysUserLogic.DecodeStoredPassword(encrypted, "DES");

        Assert.Equal(1, result.Code);
        Assert.Equal("Microi-test-password", result.Data);
        Assert.Equal(0, SysUserLogic.DecodeStoredPassword(encrypted, "V8").Code);
        Assert.Equal(0, SysUserLogic.DecodeStoredPassword("not-des", "DES").Code);
    }
}
