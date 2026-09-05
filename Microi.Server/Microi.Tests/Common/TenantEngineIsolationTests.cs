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

    [Fact]
    public void IncompleteExtensionDatabase_DoesNotBlockMainDatabaseOrOtherExtensions()
    {
        var client = new OsClientSecret
        {
            OsClient = "tenant_with_incomplete_extension",
            DataBasesInitialized = true,
            DataBasesLoadedAtUtc = DateTime.UtcNow,
            DataBases = new List<OsClientDataBase>
            {
                new() { DbKey = "incomplete", DbType = "", DbName = "incomplete" },
                new() { DbKey = "archive", DbType = "MySql", DbConn = "Server=127.0.0.1;Database=unused;Uid=test;Pwd=test;" }
            }
        };
        var databases = OsClient.GetAllClientDataBase(client);
        Assert.Equal(2, databases.Count);
        Assert.Contains("incomplete", databases.Keys);
        Assert.Null(client.DataBases[0].Db);
        Assert.Null(client.DataBases[1].Db);
        var engine = new Engine();
        engine.SetValue("V8", new V8EngineParam { Dbs = databases });
        Assert.Equal("function", engine.Evaluate("typeof V8.Dbs.archive.FromSql").AsString());
        Assert.NotNull(client.DataBases[1].Db);
        var error = Assert.Throws<InvalidOperationException>(() => databases["incomplete"]);
        Assert.Contains("incomplete", error.Message);
        Assert.Contains(client.OsClient, error.Message);
        Assert.NotNull(databases["archive"]);
    }

    [Fact]
    public void LazyExtensionCollection_ResolvesOnlyRequestedKeyOnceAndKeepsTenantInstancesSeparate()
    {
        var first = new V8DatabaseCollection();
        var second = new V8DatabaseCollection();
        var firstCount = 0;
        var secondCount = 0;
        first.AddLazy("same", () => { firstCount++; return first.Open("MySql", "Server=127.0.0.1;Database=tenant_a;Uid=test;Pwd=test;"); });
        second.AddLazy("same", () => { secondCount++; return second.Open("MySql", "Server=127.0.0.1;Database=tenant_b;Uid=test;Pwd=test;"); });
        Assert.True(first.ContainsKey("same"));
        Assert.Equal(0, firstCount);
        Assert.Equal(0, secondCount);
        Assert.True(first.TryGetValue("SAME", out var session));
        Assert.Same(session, first["same"]);
        Assert.Equal(1, firstCount);
        Assert.Equal(0, secondCount);
        Assert.NotSame(session, second["same"]);
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
