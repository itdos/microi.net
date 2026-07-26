using System.Reflection;
using Jint;
using Microi.net;

namespace Dos.Common.Tests;

[Collection("TenantContextGlobal")]
public class TenantEngineIsolationTests
{
    private static readonly object MasterTenantLock = new();

    [Fact]
    public async Task NonMasterV8_ForcesAllBackendEnginesToCurrentTenant()
    {
        const string currentTenant = "tenant_engine_current";
        const string foreignTenant = "tenant_engine_foreign";

        using (V8TenantContext.Enter(currentTenant, "tenant-engine-test"))
        {
            Assert.Equal(
                currentTenant,
                InvokeTenantResolver(typeof(DataSourceEngine), foreignTenant));

            var translateParam = new TranslateParam
            {
                OsClient = foreignTenant,
                SourceText = ""
            };
            new TranslateEngine().Translate(translateParam);
            Assert.Equal(currentTenant, translateParam.OsClient);

            var workflowParam = new WFParam
            {
                OsClient = foreignTenant,
                _CurrentUser = null
            };
            await new WorkFlow().StartWork(workflowParam);
            Assert.Equal(currentTenant, workflowParam.OsClient);
        }
    }

    [Fact]
    public void TrustedMasterV8_KeepsExplicitCrossTenantRequest()
    {
        lock (MasterTenantLock)
        {
            var originalMaster = OsClientDefault.OsClient;
            try
            {
                OsClientDefault.OsClient = "tenant_engine_master";
                using (V8TenantContext.Enter(
                           OsClientDefault.OsClient,
                           "tenant-engine-master-test"))
                {
                    Assert.Equal(
                        "tenant_engine_target",
                        InvokeTenantResolver(
                            typeof(DataSourceEngine),
                            "tenant_engine_target"));
                    Assert.Equal(
                        "tenant_engine_target",
                        InvokeTenantResolver(
                            typeof(TranslateEngine),
                            "tenant_engine_target"));
                }
            }
            finally
            {
                OsClientDefault.OsClient = originalMaster;
            }
        }
    }

    [Fact]
    public void TrustedNonV8Caller_KeepsExplicitTenantRequest()
    {
        Assert.Equal(
            "tenant_engine_target",
            InvokeTenantResolver(typeof(DataSourceEngine), "tenant_engine_target"));
        Assert.Equal(
            "tenant_engine_target",
            InvokeTenantResolver(typeof(TranslateEngine), "tenant_engine_target"));
    }

    [Fact]
    public void EmptyExtendedDatabaseList_IsAValidInitializedState()
    {
        const string osClient = "tenant_without_extended_databases";
        OsClientExtend.ClientList.TryRemove(osClient, out _);
        var client = new OsClientSecret
        {
            OsClient = osClient,
            DataBases = new List<OsClientDataBase>(),
            DataBasesInitialized = true,
            DataBasesLoadedAtUtc = DateTime.UtcNow
        };

        var databases = OsClient.GetAllClientDataBase(client);

        Assert.NotNull(databases);
        Assert.Empty(databases);
        Assert.NotNull(typeof(V8DatabaseCollection).GetMethod("Open", new[] { typeof(string), typeof(string) }));
        Assert.False(OsClientExtend.ClientList.ContainsKey(osClient));
    }

    [Fact]
    public void V8DatabaseCollection_ExposesSavedKeysAndTemporaryOpenToJint()
    {
        var v8 = new V8EngineParam();
        v8.Dbs["archive"] = v8.Dbs.Open(
            "MySql",
            "Server=127.0.0.1;Port=3306;Database=demo;Uid=user;Pwd=test;");
        var engine = new Engine();
        engine.SetValue("V8", v8);

        Assert.Equal("function", engine.Evaluate("typeof V8.Dbs.Open").AsString());
        Assert.Equal("function", engine.Evaluate("typeof V8.Dbs.archive.FromSql").AsString());
        Assert.True(engine.Evaluate(
            "V8.Dbs.Open('PostgreSql', 'Host=127.0.0.1;Port=5432;Database=demo;Username=user;Password=test;') !== null")
            .AsBoolean());
    }

    private static string InvokeTenantResolver(Type engineType, string requestedOsClient)
    {
        var method = engineType.GetMethod(
            "ResolveExecutionOsClient",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return Assert.IsType<string>(
            method!.Invoke(null, new object?[] { requestedOsClient }));
    }
}
