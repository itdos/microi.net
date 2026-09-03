using System.Reflection;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

[Collection("TenantContextGlobal")]
public class AdminTenantProvisioningAuthorizationTests
{
    private static readonly object MasterTenantLock = new();

    [Fact]
    public void TrustedBackgroundSuperAdmin_DoesNotRequireHttpToken()
    {
        var result = InvokeAuthorization(new JObject
        {
            ["Id"] = "background-admin",
            ["Account"] = "admin",
            ["Level"] = DiyCommon.MaxRoleLevel
        });

        Assert.Null(result);
    }

    [Fact]
    public void TrustedBackgroundOrdinaryUser_CannotProvisionAdminTenant()
    {
        var result = Assert.IsType<DosResult>(InvokeAuthorization(new JObject
        {
            ["Id"] = "background-user",
            ["Account"] = "user",
            ["Level"] = DiyCommon.MaxRoleLevel - 1
        }));

        Assert.Equal(0, result.Code);
        Assert.Contains("超级管理员", result.Msg);
    }

    [Fact]
    public void NestedApiEngineCall_InheritsTrustedBackgroundUserSnapshot()
    {
        var trustedUser = new JObject
        {
            ["Id"] = "background-user",
            ["Account"] = "user",
            ["Level"] = 1
        };

        using var trustedScope = EnterTrustedExecutionContext(trustedUser);
        var inherited = GetAmbientTrustedCurrentUser();

        Assert.NotNull(inherited);
        Assert.Equal("background-user", inherited!["Id"]?.ToString());
        Assert.NotSame(trustedUser, inherited);

        inherited["Id"] = "mutated";
        Assert.Equal("background-user", trustedUser["Id"]?.ToString());
    }

    [Fact]
    public void OrdinaryApiEngineCall_HasNoAmbientTrustedUser()
    {
        Assert.Null(GetAmbientTrustedCurrentUser());
    }

    [Fact]
    public void DomainBindingAuthorization_RejectsTrustedOrdinaryUserBeforeAnyControlPlaneWrite()
    {
        var result = InvokeDomainBindingAuthorization(
            "admin_ensure_saas_tenant_domain_binding",
            new JObject
            {
                ["Id"] = "background-user",
                ["Account"] = "user",
                ["Level"] = DiyCommon.MaxRoleLevel - 1
            });

        Assert.Equal(0, result.Code);
        Assert.Contains("超级管理员", result.Msg);
    }

    [Fact]
    public void ExternalDomainBindingAuthorization_AcceptsOnlyItsExactKeyBeforePrivilegeCheck()
    {
        var result = InvokeExternalDomainBindingAuthorization(
            "admin_ensure_external_saas_tenant_domain_binding",
            new JObject
            {
                ["Id"] = "background-user",
                ["Account"] = "user",
                ["Level"] = DiyCommon.MaxRoleLevel - 1
            });

        Assert.Equal(0, result.Code);
        Assert.Contains("超级管理员", result.Msg);
        Assert.DoesNotContain("无权调用", result.Msg);
    }

    [Theory]
    [InlineData("admin_ensure_saas_tenant_domain_binding")]
    [InlineData("admin_ensure_external_saas_tenant_domain_bindin")]
    [InlineData("admin_ensure_external_saas_tenant_domain_binding_extra")]
    [InlineData("some_other_managed_engine")]
    public void ExternalDomainBindingAuthorization_RejectsEveryOtherApiEngineKey(
        string apiEngineKey)
    {
        var result = InvokeExternalDomainBindingAuthorization(
            apiEngineKey,
            new JObject
            {
                ["Id"] = "background-admin",
                ["Account"] = "admin",
                ["Level"] = DiyCommon.MaxRoleLevel
            });

        Assert.Equal(0, result.Code);
        Assert.Contains("无权调用", result.Msg);
    }

    [Fact]
    public void LocalDomainBindingAuthorization_RejectsExternalControlPlaneKey()
    {
        var result = InvokeDomainBindingAuthorization(
            "admin_ensure_external_saas_tenant_domain_binding",
            new JObject
            {
                ["Id"] = "background-admin",
                ["Account"] = "admin",
                ["Level"] = DiyCommon.MaxRoleLevel
            });

        Assert.Equal(0, result.Code);
        Assert.Contains("无权调用", result.Msg);
    }

    [Fact]
    public void ExternalDomainBindingAuthorization_RejectsAccessKeyAdminSession()
    {
        var result = InvokeExternalDomainBindingAuthorization(
            "admin_ensure_external_saas_tenant_domain_binding",
            new JObject
            {
                ["Id"] = "access-key-admin",
                ["Account"] = "admin",
                ["Level"] = DiyCommon.MaxRoleLevel,
                ["_AccessKeySession"] = true
            });

        Assert.Equal(0, result.Code);
        Assert.Contains("访问密钥会话", result.Msg);
    }

    [Fact]
    public void ExternalDomainBindingAuthorization_RejectsNonOfficialTenant()
    {
        var result = InvokeExternalDomainBindingAuthorization(
            "admin_ensure_external_saas_tenant_domain_binding",
            new JObject
            {
                ["Id"] = "background-admin",
                ["Account"] = "admin",
                ["Level"] = DiyCommon.MaxRoleLevel
            },
            "chongstech");

        Assert.Equal(1002, result.Code);
        Assert.Contains("iTdos", result.Msg);
    }

    [Fact]
    public void ExternalDomainBindingAuthorization_RejectsTrustedTenantMismatch()
    {
        var result = InvokeExternalDomainBindingAuthorization(
            "admin_ensure_external_saas_tenant_domain_binding",
            new JObject
            {
                ["Id"] = "background-admin",
                ["Account"] = "admin",
                ["Level"] = DiyCommon.MaxRoleLevel
            },
            "iTdos",
            "another-tenant");

        Assert.Equal(0, result.Code);
        Assert.Contains("租户", result.Msg);
        Assert.Contains("不一致", result.Msg);
    }

    [Fact]
    public void ExternalDomainBindingAuthorization_PrimaryDatabaseRejectsRevokedAdministrator()
    {
        var currentUser = new JObject
        {
            ["Id"] = "official-admin",
            ["Account"] = "admin",
            ["Level"] = DiyCommon.MaxRoleLevel,
            ["_IsAdmin"] = true
        };
        var disabledUser = new SysUser
        {
            Id = "official-admin",
            Account = "admin",
            Level = DiyCommon.MaxRoleLevel,
            State = 0,
            IsDeleted = 0,
            RoleIds = string.Empty
        };
        var deletedUser = new SysUser
        {
            Id = "official-admin",
            Account = "admin",
            Level = DiyCommon.MaxRoleLevel,
            State = 1,
            IsDeleted = 1,
            RoleIds = string.Empty
        };
        var downgradedUser = new SysUser
        {
            Id = "official-admin",
            Account = "admin",
            Level = DiyCommon.MaxRoleLevel - 1,
            State = 1,
            IsDeleted = 0,
            RoleIds = string.Empty
        };

        Assert.False(PlatformAdministratorSecurity.HasEffectivePlatformAdministratorLevel(
            currentUser,
            disabledUser,
            Array.Empty<SysRole>()));
        Assert.False(PlatformAdministratorSecurity.HasEffectivePlatformAdministratorLevel(
            currentUser,
            deletedUser,
            Array.Empty<SysRole>()));
        Assert.False(PlatformAdministratorSecurity.HasEffectivePlatformAdministratorLevel(
            currentUser,
            downgradedUser,
            Array.Empty<SysRole>()));
    }

    [Fact]
    public void DomainBindingAuthorization_RejectsEveryOtherApiEngineKey()
    {
        var result = InvokeDomainBindingAuthorization(
            "some_other_managed_engine",
            new JObject
            {
                ["Id"] = "background-admin",
                ["Account"] = "admin",
                ["Level"] = DiyCommon.MaxRoleLevel
            });

        Assert.Equal(0, result.Code);
        Assert.Contains("无权调用", result.Msg);
    }

    private static object? InvokeAuthorization(JObject trustedCurrentUser)
    {
        lock (MasterTenantLock)
        {
            var originalMaster = OsClientDefault.OsClient;
            try
            {
                OsClientDefault.OsClient = "tenant_admin_master";
                using var tenantScope = V8TenantContext.Enter(
                    OsClientDefault.OsClient,
                    "admin_create_empty_saas_tenant",
                    "BackgroundTask");
                using var trustedScope = EnterTrustedExecutionContext(trustedCurrentUser);

                var authorize = typeof(V8Method).GetMethod(
                    "RequireMasterTenantProvisioningAdminAccess",
                    BindingFlags.Static | BindingFlags.NonPublic);
                Assert.NotNull(authorize);
                return authorize!.Invoke(null, null);
            }
            finally
            {
                OsClientDefault.OsClient = originalMaster;
            }
        }
    }

    private static DosResult InvokeDomainBindingAuthorization(
        string apiEngineKey,
        JObject trustedCurrentUser)
    {
        lock (MasterTenantLock)
        {
            var originalMaster = OsClientDefault.OsClient;
            try
            {
                OsClientDefault.OsClient = "tenant_admin_master";
                using var tenantScope = V8TenantContext.Enter(
                    OsClientDefault.OsClient,
                    apiEngineKey,
                    "BackgroundTask");
                using var trustedScope = EnterTrustedExecutionContext(
                    trustedCurrentUser,
                    OsClientDefault.OsClient);

                return new V8Method().AuthorizeAdminTenantDomainBinding();
            }
            finally
            {
                OsClientDefault.OsClient = originalMaster;
            }
        }
    }

    private static DosResult InvokeExternalDomainBindingAuthorization(
        string apiEngineKey,
        JObject trustedCurrentUser,
        string contextOsClient = "iTdos",
        string? trustedOsClient = null)
    {
        lock (MasterTenantLock)
        {
            using var tenantScope = V8TenantContext.Enter(
                contextOsClient,
                apiEngineKey,
                "BackgroundTask");
            using var trustedScope = EnterTrustedExecutionContext(
                trustedCurrentUser,
                trustedOsClient ?? contextOsClient);

            return new V8Method().AuthorizeExternalSaasTenantDomainBinding();
        }
    }

    private static IDisposable EnterTrustedExecutionContext(
        JObject currentUser,
        string? trustedOsClient = null)
    {
        var contextType = typeof(V8Method).Assembly.GetType(
            "Microi.net.V8TrustedExecutionContext",
            throwOnError: true);
        var methodName = trustedOsClient == null ? "Enter" : "EnterForTenant";
        var enter = contextType!.GetMethod(
            methodName,
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(enter);
        return Assert.IsAssignableFrom<IDisposable>(
            enter!.Invoke(
                null,
                trustedOsClient == null
                    ? new object?[] { currentUser }
                    : new object?[] { currentUser, trustedOsClient }));
    }

    private static JObject? GetAmbientTrustedCurrentUser()
    {
        var method = typeof(ApiEngine).GetMethod(
            "GetAmbientTrustedCurrentUser",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return method!.Invoke(null, null) as JObject;
    }
}
