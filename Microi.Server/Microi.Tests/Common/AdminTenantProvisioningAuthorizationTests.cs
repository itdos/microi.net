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

    private static IDisposable EnterTrustedExecutionContext(JObject currentUser)
    {
        var contextType = typeof(V8Method).Assembly.GetType(
            "Microi.net.V8TrustedExecutionContext",
            throwOnError: true);
        var enter = contextType!.GetMethod(
            "Enter",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(enter);
        return Assert.IsAssignableFrom<IDisposable>(
            enter!.Invoke(null, new object?[] { currentUser }));
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
