using System.Net;
using System.Reflection;
using Microsoft.AspNetCore.Http;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class SecurityGuardAndSysUserRegressionTests
{
    [Fact]
    public void RequestIp_IgnoresForgedForwardedForAndUsesValidatedConnectionAddress()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.20");
        context.Request.Headers["X-Forwarded-For"] = "127.0.0.1";
        context.Request.Headers["X-Real-IP"] = "127.0.0.1";

        Assert.Equal(
            "203.0.113.20",
            SecurityGuardRuntimePolicy.GetConnectionIp(context));

        context.Connection.RemoteIpAddress = IPAddress.Parse("::ffff:203.0.113.21");
        Assert.Equal(
            "203.0.113.21",
            SecurityGuardRuntimePolicy.GetConnectionIp(context));
    }

    [Fact]
    public void OrdinaryRequest_OsClientRotationCannotSelectAnotherRateLimitScope()
    {
        var first = new DefaultHttpContext();
        first.Request.Headers["OsClient"] = "tenant-a";
        var second = new DefaultHttpContext();
        second.Request.QueryString = new QueryString("?OsClient=tenant-b");

        var firstScope = SecurityGuardRuntimePolicy.ResolveSecurityScope(
            first,
            SecurityGuardRequestProfile.Normal,
            "main-runtime");
        var secondScope = SecurityGuardRuntimePolicy.ResolveSecurityScope(
            second,
            SecurityGuardRequestProfile.Normal,
            "main-runtime");

        Assert.Equal("main-runtime", firstScope);
        Assert.Equal(firstScope, secondScope);
        Assert.Equal(
            "token-bound-tenant",
            SecurityGuardRuntimePolicy.ResolveSecurityScope(
                first,
                SecurityGuardRequestProfile.CreateTrustedVsCode("token-bound-tenant"),
                "main-runtime"));
    }

    [Fact]
    public void SharedRedisAbsence_IsAuthoritativeAndCannotResurrectLocalBlock()
    {
        var now = DateTime.UtcNow;
        var staleLocal = new BlockedIpState
        {
            Ip = "183.133.34.254",
            ExpiresAtUtc = now.AddMinutes(20),
            StateBackend = "ProcessFallback"
        };

        Assert.Equal(
            SecurityGuardBlockSource.None,
            SecurityGuardRuntimePolicy.ResolveActiveBlockSource(
                sharedBackendAvailable: true,
                sharedState: null,
                localState: staleLocal,
                utcNow: now));
        Assert.Equal(
            SecurityGuardBlockSource.ProcessFallback,
            SecurityGuardRuntimePolicy.ResolveActiveBlockSource(
                sharedBackendAvailable: false,
                sharedState: null,
                localState: staleLocal,
                utcNow: now));
    }

    [Fact]
    public void TrustedVsCodeProfile_RequiresServerVerifiedTokenDidAdminAndReadOnlyPath()
    {
        const string token = "active-vscode-token";
        const string did = "VSCode:machine:workspace";
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/V8Debug/GetApiEngineList";
        context.Request.Headers["Authorization"] = $"Bearer {token}";
        context.Request.Headers["did"] = did;
        // 伪造这些非可信 Header 本身绝不能获得放宽阈值。
        context.Request.Headers["ClientType"] = "VSCode";
        context.Request.Headers["X-User-Level"] = "9999";

        Assert.False(SecurityGuardTrustResolver.IsTrustedVsCodeRequest(context, null));

        var currentToken = new CurrentToken
        {
            AuthVersion = DiyToken.CurrentAuthVersion,
            Token = token,
            CurrentUser = new JObject { ["Level"] = DiyCommon.MaxRoleLevel - 1 },
            Tokens = new List<TokensModel>
            {
                new()
                {
                    Token = token,
                    AuthVersion = DiyToken.CurrentAuthVersion,
                    ClientType = "VSCode",
                    Did = did
                }
            }
        };

        Assert.False(SecurityGuardTrustResolver.IsTrustedVsCodeRequest(context, currentToken));

        currentToken.CurrentUser["Level"] = DiyCommon.MaxRoleLevel;
        currentToken.Tokens[0].ClientType = "PC";
        Assert.False(SecurityGuardTrustResolver.IsTrustedVsCodeRequest(context, currentToken));

        currentToken.Tokens[0].ClientType = "VSCode";
        currentToken.Tokens[0].Did = "VSCode:other:workspace";
        Assert.False(SecurityGuardTrustResolver.IsTrustedVsCodeRequest(context, currentToken));

        currentToken.Tokens[0].Did = did;
        Assert.True(SecurityGuardTrustResolver.IsTrustedVsCodeRequest(context, currentToken));

        context.Request.Path = "/api/V8Debug/UpdateApiEngineCode";
        Assert.False(SecurityGuardTrustResolver.IsTrustedVsCodeRequest(context, currentToken));
    }

    [Fact]
    public void DistributedSecurityKeys_IsolateTenantIpProfileAndUseAtomicTtlCounter()
    {
        var ordinary = SecurityGuardDistributedKeys.BuildWindowKey(
            "tenant-a", "183.133.34.254", false, "requests", 123);
        var trusted = SecurityGuardDistributedKeys.BuildWindowKey(
            "tenant-a", "183.133.34.254", true, "requests", 123);
        var otherTenant = SecurityGuardDistributedKeys.BuildWindowKey(
            "tenant-b", "183.133.34.254", false, "requests", 123);
        var otherIp = SecurityGuardDistributedKeys.BuildWindowKey(
            "tenant-a", "183.133.34.255", false, "requests", 123);

        Assert.NotEqual(ordinary, trusted);
        Assert.NotEqual(ordinary, otherTenant);
        Assert.NotEqual(ordinary, otherIp);
        Assert.Contains("{tenant-a}", ordinary);
        Assert.Equal(
            "Microi:{tenant-a}:SecurityGuard:BlockedIps",
            SecurityGuardDistributedKeys.BuildBlockHashKey("TENANT-A"));
        Assert.Contains("redis.call('INCR'", SecurityGuardDistributedKeys.AtomicWindowCounterScript);
        Assert.Contains("redis.call('EXPIRE'", SecurityGuardDistributedKeys.AtomicWindowCounterScript);
    }

    [Fact]
    public void ChangePasswordPatch_PreservesFieldsMissingFromSelfServiceRequest()
    {
        var existing = new SysUser
        {
            Id = "user-1",
            Account = "admin",
            Name = "平台管理员",
            Pwd = "old-hash",
            DeptId = "dept-1",
            RoleIds = "[\"role-admin\"]",
            State = 1,
            Level = DiyCommon.MaxRoleLevel,
            IsDeleted = 0
        };
        var sparsePasswordPatch = new SysUserParam
        {
            Id = existing.Id,
            Pwd = "new-hash"
        };

        var merged = SysUserLogic.MergeUpdateModel(sparsePasswordPatch, existing);

        Assert.Equal("new-hash", merged.Pwd);
        Assert.Equal(existing.Account, merged.Account);
        Assert.Equal(existing.Name, merged.Name);
        Assert.Equal(existing.DeptId, merged.DeptId);
        Assert.Equal(existing.RoleIds, merged.RoleIds);
        Assert.Equal(existing.State, merged.State);
        Assert.Equal(existing.Level, merged.Level);
        Assert.Equal(existing.IsDeleted, merged.IsDeleted);
    }

    [Fact]
    public void PlatformAdminCheck_HandlesJObjectTokensWithoutDynamicBinderFailure()
    {
        var method = typeof(SysUserController).GetMethod(
            "IsPlatformAdmin",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var administrator = JObject.FromObject(new
        {
            _IsAdmin = false,
            Level = DiyCommon.MaxRoleLevel
        });
        var ordinaryUser = JObject.FromObject(new
        {
            _IsAdmin = false,
            Level = 1
        });

        Assert.True((bool)method!.Invoke(null, new object[] { administrator })!);
        Assert.False((bool)method.Invoke(null, new object[] { ordinaryUser })!);
        Assert.False((bool)method.Invoke(null, new object?[] { null })!);
    }

    [Theory]
    [InlineData("/#/microi-store", "/microi-store")]
    [InlineData("#/mic-sys-user", "/mic-sys-user")]
    [InlineData("workflow/todo?state=waiting", "/workflow/todo?state=waiting")]
    [InlineData("", "")]
    public void DefaultIndexUrl_NormalizesSupportedInternalRouteForms(string input, string expected)
    {
        var method = typeof(SysUserController).GetMethod(
            "TryNormalizeDefaultIndexUrl",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        object?[] args = { input, null, null };

        Assert.True((bool)method!.Invoke(null, args)!);
        Assert.Equal(expected, args[1]);
        Assert.Null(args[2]);
    }

    [Theory]
    [InlineData("https://evil.example/path")]
    [InlineData("//evil.example/path")]
    [InlineData("/login")]
    [InlineData("#/access-login")]
    [InlineData("/path\\child")]
    public void DefaultIndexUrl_RejectsExternalAndAuthenticationRoutes(string input)
    {
        var method = typeof(SysUserController).GetMethod(
            "TryNormalizeDefaultIndexUrl",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        object?[] args = { input, null, null };

        Assert.False((bool)method!.Invoke(null, args)!);
        Assert.False(string.IsNullOrWhiteSpace(args[2]?.ToString()));
    }

    [Fact]
    public void UploadDisabledResult_ExplainsDefaultAndExactRecoveryField()
    {
        var result = FileUploadSecurity.CreateTenantUploadDisabledResult("tenant-a");
        var append = JObject.FromObject(result.DataAppend);

        Assert.Equal(0, result.Code);
        Assert.Contains("FileUploadEnabled", result.Msg);
        Assert.Equal("TenantFileUploadDisabled", append["ErrorType"]?.Value<string>());
        Assert.Equal("FileUploadEnabled", append["ConfigField"]?.Value<string>());
        Assert.True(append["DefaultEnabled"]?.Value<bool>());
    }
}
