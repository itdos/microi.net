using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
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
    public void ContainerProxyTrust_UsesOnlyDiscoveredPrivateGatewayExactIps()
    {
        var gateways = new[]
        {
            IPAddress.Parse("172.30.0.1"),
            IPAddress.Parse("10.20.0.1"),
            IPAddress.Parse("203.0.113.1"),
            IPAddress.Loopback
        };

        Assert.Empty(ForwardedProxyTrustPolicy.SelectContainerGatewayProxies(false, gateways));

        var trusted = ForwardedProxyTrustPolicy.SelectContainerGatewayProxies(true, gateways);
        Assert.Contains(IPAddress.Parse("172.30.0.1"), trusted);
        Assert.Contains(IPAddress.Parse("10.20.0.1"), trusted);
        Assert.DoesNotContain(IPAddress.Parse("203.0.113.1"), trusted);
        Assert.DoesNotContain(IPAddress.Loopback, trusted);
        Assert.True(ForwardedProxyTrustPolicy.IsContainerGatewayPeer(
            IPAddress.Parse("172.30.0.1"),
            trusted));
        Assert.False(ForwardedProxyTrustPolicy.IsContainerGatewayPeer(
            IPAddress.Parse("198.51.100.25"),
            trusted));
    }

    [Fact]
    public async Task TrustedContainerGateway_ProjectsForwardedIpButPublicPeerCannotForge()
    {
        var options = new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor,
            ForwardLimit = 1
        };
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
        options.KnownProxies.Add(IPAddress.Parse("172.30.0.1"));
        var middleware = new ForwardedHeadersMiddleware(
            _ => Task.CompletedTask,
            NullLoggerFactory.Instance,
            Options.Create(options));

        var proxied = new DefaultHttpContext();
        proxied.Connection.RemoteIpAddress = IPAddress.Parse("172.30.0.1");
        proxied.Request.Headers["X-Forwarded-For"] = "198.51.100.25";
        await middleware.Invoke(proxied);
        Assert.Equal("198.51.100.25", proxied.Connection.RemoteIpAddress?.ToString());

        var forged = new DefaultHttpContext();
        forged.Connection.RemoteIpAddress = IPAddress.Parse("203.0.113.20");
        forged.Request.Headers["X-Forwarded-For"] = "127.0.0.1";
        await middleware.Invoke(forged);
        Assert.Equal("203.0.113.20", forged.Connection.RemoteIpAddress?.ToString());
    }

    [Theory]
    [InlineData(400, "/api/FormEngine/GetTableData", false)]
    [InlineData(401, "/api/SysUser/GetCurrentUser", false)]
    [InlineData(403, "/api/SecurityGuard/UnblockIp", false)]
    [InlineData(404, "/apiengine/get-microi-store-list", false)]
    [InlineData(429, "/api/FormEngine/GetTableData", false)]
    [InlineData(500, "/apiengine/get-microi-upgrade-resource", false)]
    [InlineData(404, "/wp-admin/install.php", true)]
    [InlineData(405, "/.env", true)]
    public void ErrorBurst_CountsOnlyUnmatchedRouteScanning(
        int statusCode,
        string path,
        bool expected)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Response.StatusCode = statusCode;

        Assert.Equal(expected, SecurityGuardRuntimePolicy.ShouldCountAsAttackLikeResponse(context));
    }

    [Fact]
    public void MatchedEndpoint404_IsAuditedButDoesNotCountTowardAutomaticBlock()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/known-controller/missing-item";
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        context.Items[SecurityGuardRuntimePolicy.MatchedEndpointItemKey] = true;

        Assert.False(SecurityGuardRuntimePolicy.ShouldCountAsAttackLikeResponse(context));
    }

    [Fact]
    public void LegacyBroadErrorBlock_IsRetiredWithoutWeakeningOtherBlockTypes()
    {
        Assert.True(SecurityGuardRuntimePolicy.IsLegacyBroadErrorBlock(new BlockedIpState
        {
            ReasonKey = "HighError",
            Reason = "IP在10秒内产生121次异常状态码，超过阈值120。"
        }));
        Assert.True(SecurityGuardRuntimePolicy.IsLegacyBroadErrorBlock(new BlockedIpState
        {
            Reason = "IP在10秒内产生121次异常状态码，超过阈值120。"
        }));
        Assert.False(SecurityGuardRuntimePolicy.IsLegacyBroadErrorBlock(new BlockedIpState
        {
            ReasonKey = "HighError",
            Manual = true
        }));
        Assert.False(SecurityGuardRuntimePolicy.IsLegacyBroadErrorBlock(new BlockedIpState
        {
            ReasonKey = "HighFrequency"
        }));
        Assert.False(SecurityGuardRuntimePolicy.IsLegacyBroadErrorBlock(new BlockedIpState
        {
            ReasonKey = "RouteScan"
        }));
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
        var administrator = JObject.FromObject(new
        {
            Id = "admin-user",
            _IsAdmin = false,
            Level = DiyCommon.MaxRoleLevel
        });
        var ordinaryUser = JObject.FromObject(new
        {
            Id = "admin-user",
            _IsAdmin = false,
            Level = 1
        });
        var databaseUser = new SysUser
        {
            Id = "admin-user",
            Account = "admin",
            Level = DiyCommon.MaxRoleLevel,
            State = 1,
            IsDeleted = 0,
            RoleIds = string.Empty
        };

        Assert.True(PlatformAdministratorSecurity.HasEffectivePlatformAdministratorLevel(
            administrator, databaseUser, Array.Empty<SysRole>()));
        Assert.False(PlatformAdministratorSecurity.HasEffectivePlatformAdministratorLevel(
            ordinaryUser, databaseUser, Array.Empty<SysRole>()));
        Assert.False(PlatformAdministratorSecurity.HasEffectivePlatformAdministratorLevel(
            null, databaseUser, Array.Empty<SysRole>()));
    }

    [Fact]
    public void DefaultIndexUrlValidation_IsOwnedByTheManagedPreferenceEngine()
    {
        var root = FindRepositoryRoot();
        var sysUserControllerPath = Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "SysUserController.cs");
        var compatibilityControllerPath = Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "LegacyMobileCompatibilityController.cs");
        var engine = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Resource", "platform-user-update-preferences.js"));
        var package = JObject.Parse(File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Resource", "app.microi.sys_user.json")));
        var preferenceEngine = package["SysApiEngines"]!.Values<JObject>()
            .Single(item => item["ApiEngineKey"]?.ToString() == "platform-user-update-preferences");

        Assert.False(File.Exists(sysUserControllerPath));
        Assert.False(File.Exists(compatibilityControllerPath));
        Assert.Contains(
            "/api/SysUser/UpdateMyDefaultIndexUrl",
            preferenceEngine["ApiRoutes"]?.ToString());
        Assert.Contains("defaultIndexUrl.indexOf('/#/') === 0", engine);
        Assert.Contains("defaultIndexUrl.indexOf('#/') === 0", engine);
        Assert.Contains("defaultIndexUrl.indexOf('//') === 0", engine);
        Assert.Contains("defaultIndexUrl.toLowerCase().indexOf('://')", engine);
        Assert.Contains("lowerRoutePath === '/login'", engine);
        Assert.Contains("lowerRoutePath === '/access-login'", engine);
    }

    [Fact]
    public void UploadDisabledResult_ExplainsDefaultAndExactRecoveryField()
    {
        var result = FileUploadSecurity.CreateTenantUploadDisabledResult("tenant-a");
        var append = JObject.FromObject(result.DataAppend);

        Assert.Equal(0, result.Code);
        Assert.Contains("关闭文件上传", result.Msg);
        Assert.Contains("DisableFileUpload", result.Msg);
        Assert.Equal("TenantFileUploadDisabled", append["ErrorType"]?.Value<string>());
        Assert.Equal("DisableFileUpload", append["ConfigField"]?.Value<string>());
        Assert.Equal(0, append["ExpectedValue"]?.Value<int>());
        Assert.Equal("FileUploadEnabled", append["LegacyConfigField"]?.Value<string>());
        Assert.True(append["DefaultEnabled"]?.Value<bool>());
    }

    [Fact]
    public void FileUploadDisableSwitch_IsVersionedNullableAndMarketplaceAligned()
    {
        var root = FindRepositoryRoot();
        var migration = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "35-UpgradeFileUploadDisableSwitch.cs"));
        var upgrade = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Upgrade.cs"));
        var baseline = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "36-UpgradeRuntimeInvariantBaseline.cs"));
        var package = JObject.Parse(File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Resource", "app.microi.saas-engine.json")));

        Assert.Contains("public static string Version = \"6.9.9.1\"", migration);
        Assert.Contains("new Upgrade35().Run", upgrade);
        Assert.Contains("Upgrade35-文件上传负向开关", baseline);
        Assert.DoesNotContain("UPDATE sys_osclients SET FileUploadEnabled", migration);
        Assert.DoesNotContain("UPDATE sys_osclients SET DisableFileUpload", migration);

        Assert.Equal("v7.8.25", package["PackageInfo"]?["Version"]?.Value<string>());
        var fields = package["DiyFields"]!.Values<JObject>().ToList();
        var disableField = fields.Single(item =>
            item["TableName"]?.Value<string>() == "sys_osclients"
            && item["Name"]?.Value<string>() == "DisableFileUpload");
        var legacyField = fields.Single(item =>
            item["TableName"]?.Value<string>() == "sys_osclients"
            && item["Name"]?.Value<string>() == "FileUploadEnabled");
        Assert.Equal("关闭文件上传", disableField["Label"]?.Value<string>());
        Assert.Equal(1, disableField["Visible"]?.Value<int>());
        Assert.Null(disableField["DefaultValue"]);
        Assert.Equal(0, legacyField["Visible"]?.Value<int>());
        Assert.Equal(0, legacyField["AppVisible"]?.Value<int>());
        Assert.Equal(1, legacyField["Readonly"]?.Value<int>());

        var columns = package["PhysicalColumns"]!.Values<JObject>().ToList();
        Assert.Single(columns, item =>
            item["TABLE_NAME"]?.Value<string>() == "sys_osclients"
            && item["COLUMN_NAME"]?.Value<string>() == "DisableFileUpload");
        var ddl = package["DDLStatements"]!.Values<JObject>().Single(item =>
            item["TableName"]?.Value<string>() == "sys_osclients")["DDL"]?.Value<string>();
        Assert.Contains("`DisableFileUpload` int NULL COMMENT '关闭文件上传'", ddl);
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.Server"))
                && Directory.Exists(Path.Combine(current.FullName, "Microi.Client")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("Unable to locate the Microi repository root.");
    }
}
