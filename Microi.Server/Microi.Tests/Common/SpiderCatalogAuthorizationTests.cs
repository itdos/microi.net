using System.Reflection;
using Dos.Common;
using Jint;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class SpiderCatalogAuthorizationTests
{
    [Theory]
    [InlineData("Rules", "mci_spider_rule")]
    [InlineData("Tasks", "mci_spider_task")]
    public void Policy_ProducesOnlyClientAuthorizedSummaryQuery(string action, string table)
    {
        var identity = new JObject { ["Id"] = "real-user", ["RoleIds"] = "role-1" };
        using var scope = V8TenantContext.Enter("tenant-a", "mci-spider-reader");
        var query = SpiderCatalogReadPolicy.Create(action, 2, 10, "tenant-a", identity);
        identity["Id"] = "changed";
        Assert.Equal(table, query.FormEngineKey);
        Assert.Equal("Client", query._InvokeType);
        Assert.False(query._TrustedServerInvocation);
        Assert.Equal("tenant-a", query.OsClient);
        Assert.Equal("real-user", query._CurrentUser["Id"].ToString());
        Assert.Equal(2, query._PageIndex); Assert.Equal(10, query._PageSize);
        Assert.Equal(new[] { "CreateTime", "Id" }, query._OrderBys.Keys);
        foreach (var field in new[] { "RecipeJson", "CredentialJson", "TargetUrl", "ParamJson", "ResultV8Code", "*" })
            Assert.DoesNotContain(field, query._SelectFields);
        Assert.Null(query._SysMenuId); Assert.Null(query._AuthorizationPolicy);
    }

    [Theory]
    [InlineData("Next", 1, 50)]
    [InlineData("Rules", 0, 10)]
    [InlineData("Tasks", 1001, 10)]
    [InlineData("Tasks", 1, 51)]
    [InlineData("Tasks", 1, -1)]
    public void Policy_RejectsUnknownTablesAndUnboundedPages(string action, int page, int size)
        => Assert.ThrowsAny<ArgumentException>(() => SpiderCatalogReadPolicy.Create(action, page, size, "tenant-a", new JObject { ["Id"] = "u" }));

    [Fact]
    public void Atom_IgnoresForgedIdentityAndPreservesRuntimePermissionFailure()
    {
        using var fixture = new Fixture();
        using var scope = V8TenantContext.Enter("tenant-a", "mci-spider-reader");
        using var identity = V8TrustedExecutionContext.EnterForTenant(new JObject { ["Id"] = "real-user" }, "tenant-a");
        fixture.Probe.Code = 0;
        dynamic result = new V8Method().ReadSpiderCatalog(new JObject { ["Action"] = "Tasks", ["PageIndex"] = 3, ["PageSize"] = 5,
            ["OsClient"] = "other", ["UserId"] = "admin", ["FormEngineKey"] = "sys_osclients", ["_TrustedServerInvocation"] = true });
        Assert.Equal(0, (int)result.Code);
        Assert.Equal("denied by row policy", (string)result.Msg);
        Assert.Equal("tenant-a", fixture.Probe.Tenant);
        Assert.Equal("real-user", fixture.Probe.User!["Id"]!.Value<string>());
        Assert.Equal("Tasks", fixture.Probe.Action); Assert.Equal(3, fixture.Probe.Page); Assert.Equal(5, fixture.Probe.Size);
        Assert.Equal(1, fixture.Probe.Calls);
    }

    [Fact]
    public void Atom_RejectsForeignTenantWrongEngineMissingIdentityAndInvalidPagination()
    {
        using var fixture = new Fixture();
        var method = new V8Method();
        dynamic outside = method.ReadSpiderCatalog(new { Action = "Rules" }); Assert.NotEqual(1, (int)outside.Code);
        using var trusted = V8TrustedExecutionContext.EnterForTenant(new JObject { ["Id"] = "u" }, "tenant-a");
        using (V8TenantContext.Enter("tenant-a", "untrusted")) Assert.NotEqual(1, (int)method.ReadSpiderCatalog(new { Action = "Rules" }).Code);
        using (V8TenantContext.Enter("tenant-b", "mci-spider-reader")) Assert.NotEqual(1, (int)method.ReadSpiderCatalog(new { Action = "Rules" }).Code);
        using (V8TenantContext.Enter("tenant-a", "mci-spider-reader"))
        {
            Assert.NotEqual(1, (int)method.ReadSpiderCatalog(new { Action = "Rules", PageSize = 2.5 }).Code);
            using var empty = V8TrustedExecutionContext.EnterForTenant(new JObject(), "tenant-a");
            Assert.Equal(1001, (int)method.ReadSpiderCatalog(new { Action = "Rules" }).Code);
        }
        Assert.Equal(0, fixture.Probe.Calls);
    }

    [Fact]
    public void Jint_RecognizesAtomCapabilityAndBindsItsSmallRequest()
    {
        using var fixture = new Fixture();
        using var scope = V8TenantContext.Enter("tenant-a", "mci-spider-reader");
        using var identity = V8TrustedExecutionContext.EnterForTenant(new JObject { ["Id"] = "real-user" }, "tenant-a");
        using var engine = new Engine();
        engine.SetValue("method", new V8Method());
        Assert.Equal("function", engine.Evaluate("typeof method.ReadSpiderCatalog").AsString());
        Assert.Equal(1, engine.Evaluate("method.ReadSpiderCatalog({ Action: 'Rules', PageIndex: 1, PageSize: 20 }).Code").AsNumber());
        Assert.Equal(20, fixture.Probe.Size);
    }

    private sealed class Fixture : IDisposable
    {
        private readonly FieldInfo field = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        private readonly object? old;
        private readonly ServiceProvider services;
        public Probe Probe { get; }
        public Fixture()
        {
            old = field.GetValue(null);
            var forms = DispatchProxy.Create<IFormEngine, Probe>(); Probe = (Probe)forms;
            services = new ServiceCollection().AddSingleton(forms).BuildServiceProvider(); field.SetValue(null, services);
        }
        public void Dispose() { field.SetValue(null, old); services.Dispose(); }
    }

    public class Probe : DispatchProxy, ISpiderCatalogReadRuntime
    {
        public int Calls, Page, Size, Code = 1;
        public string? Action, Tenant;
        public JObject? User;
        public Task<DosResultList<dynamic>> ReadSpiderCatalogAsync(string action, int pageIndex, int pageSize, string osClient, JObject currentUser)
        {
            Calls++; Action = action; Page = pageIndex; Size = pageSize; Tenant = osClient; User = currentUser;
            return Task.FromResult(new DosResultList<dynamic>(Code, null, Code == 1 ? "" : "denied by row policy"));
        }
        protected override object? Invoke(MethodInfo? method, object?[]? args)
            => throw new InvalidOperationException("Unexpected legacy or unrestricted FormEngine call: " + method?.Name);
    }
}
