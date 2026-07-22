using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class FormEngineTenantBoundaryTests
{
    [Fact]
    public void V8TenantContext_ReplacesForeignTenantForNonMasterScript()
    {
        var currentTenant = string.Equals(
            OsClientDefault.OsClient,
            "tenant_boundary_a",
            StringComparison.OrdinalIgnoreCase)
            ? "tenant_boundary_b"
            : "tenant_boundary_a";

        using (V8TenantContext.Enter(currentTenant, "tenant-boundary-test"))
        {
            Assert.Equal(currentTenant, V8TenantContext.EnforceOsClient("foreign_tenant"));
        }
    }

    [Fact]
    public void NonMasterV8SysConfigReturn_IsSanitizedDeepCopyWithoutMutatingRawModel()
    {
        var engine = new ExposedFormEngine();
        var source = new JObject
        {
            ["SysTitle"] = "Tenant title",
            ["ClientSecrets"] = "raw-secret",
            ["GlobalServerV8Code"] = "raw-server-code"
        };
        var currentTenant = GetNonMasterTenant();

        JObject projection;
        using (V8TenantContext.Enter(currentTenant, "sysconfig-projection-test"))
        {
            projection = (JObject)engine.ProjectSysConfigForCaller(source);
        }

        Assert.NotSame(source, projection);
        Assert.Equal("Tenant title", projection["SysTitle"]?.ToString());
        Assert.Null(projection["ClientSecrets"]);
        Assert.Null(projection["GlobalServerV8Code"]);
        Assert.Equal("raw-secret", source["ClientSecrets"]?.ToString());
        Assert.Equal("raw-server-code", source["GlobalServerV8Code"]?.ToString());

        projection["SysTitle"] = "changed";
        Assert.Equal("Tenant title", source["SysTitle"]?.ToString());
    }

    [Fact]
    public void InternalSysConfigReturn_KeepsRawModel()
    {
        var engine = new ExposedFormEngine();
        var source = new JObject { ["ClientSecrets"] = "raw-secret" };

        Assert.Same(source, engine.ProjectSysConfigForCaller(source));
    }

    [Theory]
    [InlineData("SysConfig")]
    [InlineData("SysMenu")]
    [InlineData("SysMenuModel")]
    [InlineData("DiyTable")]
    [InlineData("DiyTableModel")]
    public async Task ConfigurationCacheEntry_EnforcesTenantBeforeCacheAccess(string entry)
    {
        var engine = new RejectingFormEngine();

        var result = entry switch
        {
            "SysConfig" => await engine.GetSysConfig("foreign_tenant"),
            "SysMenu" => await engine.GetSysMenu("menu", "foreign_tenant"),
            "SysMenuModel" => await engine.GetSysMenuModel("menu", "foreign_tenant"),
            "DiyTable" => await engine.GetDiyTable("table", "foreign_tenant"),
            "DiyTableModel" => await engine.GetDiyTableModel("table", "foreign_tenant"),
            _ => throw new ArgumentOutOfRangeException(nameof(entry), entry, null)
        };

        Assert.Equal(0, result.Code);
        Assert.Equal("foreign_tenant", engine.LastRequestedOsClient);
        Assert.Equal(1, engine.EnforcementCount);
    }

    [Theory]
    [InlineData("Queue")]
    [InlineData("Reset")]
    [InlineData("Reload")]
    [InlineData("Sync")]
    [InlineData("Repair")]
    public async Task LanguageConfigurationEntry_EnforcesTenantBeforeSharedStateOrDatabaseAccess(string entry)
    {
        var engine = new RejectingFormEngine();

        var result = entry switch
        {
            "Queue" => engine.QueueDiyLangFullSync("foreign_tenant"),
            "Reset" => engine.ResetDiyLangFullSync("foreign_tenant"),
            "Reload" => engine.ReloadDiyLangRuntimeConfig("foreign_tenant"),
            "Sync" => await engine.SyncDiyLangFullAsync("foreign_tenant"),
            "Repair" => await engine.RepairMissingDiyLangTranslationsAsync("foreign_tenant"),
            _ => throw new ArgumentOutOfRangeException(nameof(entry), entry, null)
        };

        Assert.Equal(0, result.Code);
        Assert.Equal("foreign_tenant", engine.LastRequestedOsClient);
        Assert.Equal(1, engine.EnforcementCount);
    }

    private sealed class RejectingFormEngine : FormEngine
    {
        public int EnforcementCount { get; private set; }
        public string LastRequestedOsClient { get; private set; }

        protected override string EnforceConfigurationOsClient(string osClient)
        {
            EnforcementCount++;
            LastRequestedOsClient = osClient;
            return string.Empty;
        }
    }

    private sealed class ExposedFormEngine : FormEngine
    {
        public dynamic ProjectSysConfigForCaller(dynamic source)
        {
            return ProtectSysConfigForV8Return(source);
        }
    }

    private static string GetNonMasterTenant()
    {
        return string.Equals(
            OsClientDefault.OsClient,
            "tenant_boundary_a",
            StringComparison.OrdinalIgnoreCase)
            ? "tenant_boundary_b"
            : "tenant_boundary_a";
    }
}
