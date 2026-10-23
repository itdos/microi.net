using System.Reflection;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

// 真实 facade + 真实可信身份作用域；范围是宿主鉴权原子，不能充当 HTTP 登录验证。
[Collection("TenantContextGlobal")]
public sealed class ManagedStorageFacadeAuthorizationTests
{
    private const string Tenant = "standard-admission-auth";
    private const string Maintenance = ManagedStorageAdmissionRuntime.MaintenanceKey;
    private static JObject User(int level = 9999, bool accessKey = false) => new()
    { ["Id"] = "fixture-user", ["Level"] = level, ["_AccessKeySession"] = accessKey };
    private static JObject Request() => new()
    {
        ["Scope"] = "platform-chat-runtime", ["Operation"] = "Status",
        ["MaintenanceConfirmed"] = true, ["WritersDrained"] = true,
        ["_CurrentUser"] = User(), ["ApiEngineKey"] = Maintenance, ["OsClient"] = Tenant
    };
    private static IDisposable Trusted(JObject user, string tenant)
    {
        var type = typeof(V8Method).Assembly.GetType("Microi.net.V8TrustedExecutionContext", true)!;
        return (IDisposable)type.GetMethod("EnterForTenant", BindingFlags.Static | BindingFlags.NonPublic)!
            .Invoke(null, new object[] { user, tenant })!;
    }
    private static DosResult Call(bool require, JObject input) => require
        ? new V8Method().RequireManagedStorageMaintenance(input)
        : new V8Method().ManageManagedStorageMaintenance(input);

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public void Forged_request_key_cannot_replace_the_actual_engine_scope(bool require)
    {
        using var tenant = V8TenantContext.Enter(Tenant, "ordinary-api", "test");
        using var user = Trusted(User(DiyCommon.MaxRoleLevel), Tenant);
        var result = Call(require, Request());
        Assert.Equal(0, result.Code); Assert.Contains("无权调用", result.Msg);
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public void AccessKey_superadmin_is_rejected_before_resolving_store(bool require)
    {
        using var tenant = V8TenantContext.Enter(Tenant, Maintenance, "test");
        using var user = Trusted(User(DiyCommon.MaxRoleLevel, true), Tenant);
        var result = Call(require, Request());
        Assert.Equal(0, result.Code); Assert.Contains("访问密钥会话", result.Msg);
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public void Ordinary_user_cannot_elevate_via_request_CurrentUser_or_maintenance_booleans(bool require)
    {
        using var tenant = V8TenantContext.Enter(Tenant, Maintenance, "test");
        using var user = Trusted(User(DiyCommon.MaxRoleLevel - 1), Tenant);
        var result = Call(require, Request());
        Assert.Equal(0, result.Code); Assert.Contains("超级管理员", result.Msg);
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public void Trusted_identity_from_other_tenant_is_rejected_before_store_access(bool require)
    {
        using var tenant = V8TenantContext.Enter(Tenant, Maintenance, "test");
        using var user = Trusted(User(DiyCommon.MaxRoleLevel), "other-admission-tenant");
        var result = Call(require, Request());
        Assert.Equal(0, result.Code); Assert.Contains("可信登录租户不一致", result.Msg);
    }

    [Theory]
    [InlineData(false)] [InlineData(true)]
    public void Even_superadmin_requires_actual_host_admission_frame(bool require)
    {
        using var tenant = V8TenantContext.Enter(Tenant, Maintenance, "test");
        using var user = Trusted(User(DiyCommon.MaxRoleLevel), Tenant);
        var result = Call(require, Request());
        Assert.Equal(0, result.Code);
        Assert.DoesNotContain("无权调用", result.Msg);
        Assert.DoesNotContain("超级管理员", result.Msg);
        Assert.DoesNotContain("访问密钥会话", result.Msg);
        Assert.Contains(require ? "维护准入尚未确认" : "维护状态未知", result.Msg);
    }
}
