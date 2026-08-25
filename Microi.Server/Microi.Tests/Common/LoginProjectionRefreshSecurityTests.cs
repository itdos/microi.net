using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class LoginProjectionRefreshSecurityTests
{
    [Fact]
    public void CrossTenantExplicitParameter_IsRejectedBeforeAdministratorCheck()
    {
        var administratorChecked = false;
        var result = Authorize(
            targetUserId: "user-a",
            requestedOsClient: "tenant-b",
            v8OsClient: "tenant-a",
            token: Token("tenant-a", "user-a"),
            isAdministrator: (_, _) =>
            {
                administratorChecked = true;
                return true;
            });

        Assert.Equal(0, result.Code);
        Assert.Contains("跨租户", result.Msg);
        Assert.False(administratorChecked);
    }

    [Fact]
    public void AuthenticatedTokenFromAnotherTenant_IsRejectedEvenWithNoExplicitParameter()
    {
        var credential = V8Method.ResolveLoginProjectionCredential(
            "valid-token-from-tenant-b",
            _ => Token("tenant-b", "user-b"),
            () => throw new InvalidOperationException("explicit token must not use ambient identity"));
        Assert.Equal(1, credential.Code);

        var result = Authorize(
            targetUserId: "user-b",
            requestedOsClient: null,
            v8OsClient: "tenant-a",
            token: credential.Data,
            explicitTokenCredential: true);

        Assert.Equal(0, result.Code);
        Assert.Contains("Token", result.Msg);
        Assert.Contains("租户不一致", result.Msg);
    }

    [Fact]
    public void ForgedExplicitToken_IsRejectedWithoutAmbientFallback()
    {
        var ambientCalled = false;
        var result = V8Method.ResolveLoginProjectionCredential(
            "forged-token",
            rawToken =>
            {
                Assert.Equal("forged-token", rawToken);
                return null;
            },
            () =>
            {
                ambientCalled = true;
                return Token("tenant-a", "user-a");
            });

        Assert.Equal(1001, result.Code);
        Assert.Null(result.Data);
        Assert.False(ambientCalled);
    }

    [Fact]
    public void MatchingExplicitToken_IsRevalidatedAndAcceptedOnlyForItsExactSubject()
    {
        var ambientCalled = false;
        var credential = V8Method.ResolveLoginProjectionCredential(
            "valid-user-a-token",
            rawToken =>
            {
                Assert.Equal("valid-user-a-token", rawToken);
                return Token("tenant-a", "user-a");
            },
            () =>
            {
                ambientCalled = true;
                return null;
            });
        Assert.Equal(1, credential.Code);
        Assert.False(ambientCalled);

        var result = Authorize(
            targetUserId: "user-a",
            requestedOsClient: "tenant-a",
            v8OsClient: "tenant-a",
            token: credential.Data,
            explicitTokenCredential: true);

        Assert.Equal(1, result.Code);
        Assert.Equal("tenant-a", result.Data);
    }

    [Fact]
    public void ExplicitAdministratorToken_CannotRefreshAnotherUsersProjection()
    {
        var credential = V8Method.ResolveLoginProjectionCredential(
            "valid-admin-token",
            _ => Token("tenant-a", "admin-a", DiyCommon.MaxRoleLevel),
            () => null);

        var result = Authorize(
            targetUserId: "user-b",
            requestedOsClient: "tenant-a",
            v8OsClient: "tenant-a",
            token: credential.Data,
            isAdministrator: (_, _) => true,
            explicitTokenCredential: true);

        Assert.Equal(0, result.Code);
        Assert.Contains("显式 Token", result.Msg);
        Assert.Contains("所属用户", result.Msg);
    }

    [Fact]
    public void CurrentUser_CanRefreshOwnProjectionInAuthenticatedTenant()
    {
        var result = Authorize(
            targetUserId: "user-a",
            requestedOsClient: "TENANT-A",
            v8OsClient: "tenant-a",
            token: Token("tenant-a", "user-a"));

        Assert.Equal(1, result.Code);
        Assert.Equal("tenant-a", result.Data);
    }

    [Fact]
    public void SameTenantPlatformAdministrator_CanRefreshAnotherUser()
    {
        string? checkedTenant = null;
        string? checkedUser = null;
        var result = Authorize(
            targetUserId: "user-b",
            requestedOsClient: "tenant-a",
            v8OsClient: "tenant-a",
            token: Token("tenant-a", "admin-a", DiyCommon.MaxRoleLevel),
            isAdministrator: (tenant, currentUser) =>
            {
                checkedTenant = tenant;
                checkedUser = currentUser["Id"]?.ToString();
                return true;
            });

        Assert.Equal(1, result.Code);
        Assert.Equal("tenant-a", result.Data);
        Assert.Equal("tenant-a", checkedTenant);
        Assert.Equal("admin-a", checkedUser);
    }

    [Fact]
    public void OrdinaryUser_CannotRefreshAnotherUsersProjection()
    {
        var result = Authorize(
            targetUserId: "user-b",
            requestedOsClient: "tenant-a",
            v8OsClient: "tenant-a",
            token: Token("tenant-a", "user-a"),
            isAdministrator: (_, _) => false);

        Assert.Equal(0, result.Code);
        Assert.Contains("只能刷新自己的", result.Msg);
    }

    [Fact]
    public void MissingTokenAndTrustedIdentity_FailsClosedWithoutThrowing()
    {
        var exception = Record.Exception(() => Authorize(
            targetUserId: "user-a",
            requestedOsClient: null,
            v8OsClient: null,
            token: null));

        Assert.Null(exception);
        var result = Authorize(
            targetUserId: "user-a",
            requestedOsClient: null,
            v8OsClient: null,
            token: null);
        Assert.Equal(1001, result.Code);
    }

    [Fact]
    public void PublicMethod_WithNoHttpTokenOrTrustedScope_ReturnsExpiredInsteadOfThrowing()
    {
        var exception = Record.Exception(() => new V8Method().RefreshLoginUser("user-a"));

        Assert.Null(exception);
        var result = new V8Method().RefreshLoginUser("user-a");
        Assert.Equal(1001, result.Code);
        Assert.Contains("已过期", result.Msg);
    }

    [Fact]
    public void TrustedHostIdentity_RequiresTenantScopeAndOnlyRefreshesItselfByDefault()
    {
        var trustedUser = User("background-user");
        var missingScope = Authorize(
            targetUserId: "background-user",
            requestedOsClient: null,
            v8OsClient: null,
            token: null,
            trustedOsClient: null,
            trustedCurrentUser: trustedUser);
        Assert.Equal(0, missingScope.Code);
        Assert.Contains("缺少租户", missingScope.Msg);

        var allowed = Authorize(
            targetUserId: "background-user",
            requestedOsClient: "tenant-a",
            v8OsClient: null,
            token: null,
            trustedOsClient: "tenant-a",
            trustedCurrentUser: trustedUser);
        Assert.Equal(1, allowed.Code);
        Assert.Equal("tenant-a", allowed.Data);

        var crossUser = Authorize(
            targetUserId: "other-user",
            requestedOsClient: "tenant-a",
            v8OsClient: null,
            token: null,
            trustedOsClient: "tenant-a",
            trustedCurrentUser: trustedUser,
            isAdministrator: (_, _) => false);
        Assert.Equal(0, crossUser.Code);
    }

    [Fact]
    public void AccessKeySession_CannotRefreshLoginProjection()
    {
        var token = Token("tenant-a", "access-key-user");
        token.CurrentUser["_AccessKeySession"] = true;

        var result = Authorize(
            targetUserId: "access-key-user",
            requestedOsClient: "tenant-a",
            v8OsClient: "tenant-a",
            token: token);

        Assert.Equal(0, result.Code);
        Assert.Contains("访问密钥", result.Msg);
    }

    [Fact]
    public void ProjectionQueryAndCacheKey_AreBoundToTheCanonicalTenantAndTargetUser()
    {
        var cacheKey = SysUserLogic.BuildLoginProjectionCacheKey("tenant-a", "user-a");
        var query = SysUserLogic.BuildLoginProjectionUserQuery("tenant-a", "user-a");

        Assert.Equal("Microi:tenant-a:LoginTokenSysUser:user-a", cacheKey);
        Assert.Equal("tenant-a", query.OsClient);
        Assert.Equal("user-a", query.Id);
        Assert.Equal("sys_user", query.FormEngineKey);
        Assert.Equal("Server", query._InvokeType);
        Assert.True(query._TrustedServerInvocation);
        var where = Assert.IsType<List<DiyWhere>>(query._Where);
        var state = Assert.Single(where);
        Assert.Equal("State", state.Name);
        Assert.Equal("1", state.Value);
        Assert.Equal("=", state.Type);

        Assert.DoesNotContain("tenant-b", cacheKey, StringComparison.OrdinalIgnoreCase);
        Assert.Throws<ArgumentException>(() =>
            SysUserLogic.BuildLoginProjectionUserQuery("tenant-a/tenant-b", "user-a"));
    }

    [Fact]
    public void LoginProjection_RecursivelyRemovesCredentialsButPreservesExtensibleProfileFields()
    {
        var projection = new JObject
        {
            ["Id"] = "user-a",
            ["Account"] = "alice",
            ["CustomProfileField"] = "kept",
            ["Pwd"] = "password-hash",
            ["PwdEncode"] = "PBKDF2-SHA256",
            ["AiApiKey"] = "relay-secret",
            ["Nested"] = new JObject
            {
                ["Name"] = "kept-nested",
                ["Token"] = "must-not-leak",
                ["_IdentityVerificationTicket"] = "one-shot-ticket"
            }
        };

        Assert.True(SysUserLogic.SanitizeLoginProjection(projection));
        Assert.Equal("user-a", projection["Id"]?.ToString());
        Assert.Equal("kept", projection["CustomProfileField"]?.ToString());
        Assert.Equal("kept-nested", projection["Nested"]?["Name"]?.ToString());
        Assert.Null(projection["Pwd"]);
        Assert.Null(projection["PwdEncode"]);
        Assert.Null(projection["AiApiKey"]);
        Assert.Null(projection["Nested"]?["Token"]);
        Assert.Null(projection["Nested"]?["_IdentityVerificationTicket"]);
        Assert.False(SysUserLogic.SanitizeLoginProjection(projection));
    }

    [Fact]
    public void LegacyMicroiInit_PassesRawTokenIntoTheVerifiedRefreshOverload()
    {
        Assert.Contains(
            "V8.Method.RefreshLoginUser(tokenResult.CurrentUser.Id, osClient, V8.Param.Token)",
            UpgradeApiEngine.Sql,
            StringComparison.Ordinal);
    }

    private static DosResult<string> Authorize(
        string targetUserId,
        string? requestedOsClient,
        string? v8OsClient,
        CurrentToken? token,
        string? trustedOsClient = null,
        JObject? trustedCurrentUser = null,
        Func<string, JObject, bool>? isAdministrator = null,
        bool explicitTokenCredential = false)
    {
        return V8Method.AuthorizeLoginProjectionRefresh(
            targetUserId,
            requestedOsClient,
            v8OsClient,
            trustedOsClient,
            trustedCurrentUser,
            token,
            tenant => tenant,
            isAdministrator ?? ((_, _) => false),
            explicitTokenCredential);
    }

    private static CurrentToken Token(string osClient, string userId, int level = 1)
    {
        return new CurrentToken
        {
            OsClient = osClient,
            CurrentUser = User(userId, level)
        };
    }

    private static JObject User(string userId, int level = 1)
    {
        return new JObject
        {
            ["Id"] = userId,
            ["Level"] = level
        };
    }
}
