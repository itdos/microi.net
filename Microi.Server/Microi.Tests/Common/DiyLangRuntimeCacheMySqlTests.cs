using System.Reflection;
using Dos.Common.Tests;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using MySql.Data.MySqlClient;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public class DiyLangRuntimeCacheMySqlTests
{
    public static bool HasMySqlFixture => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_MYSQL_TEST_CONN"));

    [Fact(Skip = "Requires isolated local MySQL fixture", SkipUnless = nameof(HasMySqlFixture))]
    [Trait("Category", "FullStack")]
    public void LegacyDictionaryAboveTenThousandRows_LoadsAllPages_AndExplicitBudgetPreservesSnapshot()
    {
        var connection = new MySqlConnectionStringBuilder(ConnectionStringCompatibility.NormalizeProviderSyntax(
            DatabaseType.MySql, Environment.GetEnvironmentVariable("MICROI_UPGRADE_MYSQL_TEST_CONN")));
        Assert.Equal("127.0.0.1", connection.Server);
        var tenant = "lang_fixture_" + Guid.NewGuid().ToString("N");
        connection.Database = "mysql";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.MySql);
        master.FromSql("CREATE DATABASE `" + tenant + "` CHARACTER SET utf8mb4").ExecuteNonQuery();
        connection.Database = tenant;
        var db = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.MySql);
        var services = new ServiceCollection(); services.AddMicroiORM();
        using var provider = services.BuildServiceProvider();
        var providerField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        var previous = providerField.GetValue(null);
        MicroiEngine.Init(provider);
        OsClientExtend.ClientList[tenant] = new OsClientSecret
        {
            OsClient = tenant, Db = db, DbRead = db, OsClientModel = new JObject { ["DbType"] = "MySql" }
        };
        try
        {
            db.FromSql("CREATE TABLE sys_config (Id varchar(36) PRIMARY KEY, IsEnable int NULL, SysLangs text NULL); INSERT INTO sys_config VALUES ('config',1,'[]'); CREATE TABLE diy_lang (Id varchar(36) PRIMARY KEY, `Key` varchar(100) NULL, Code varchar(100) NULL, ZhCN text NULL, En text NULL, IsDeleted int NULL)").ExecuteNonQuery();
            for (var offset = 0; offset < 10509; offset += 500)
            {
                var values = Enumerable.Range(offset, Math.Min(500, 10509 - offset))
                    .Select(n => $"('{n:D6}','key-{n}','code-{n}','词条{n}','Text {n}',0)");
                db.FromSql("INSERT INTO diy_lang VALUES " + string.Join(",", values)).ExecuteNonQuery();
            }
            var engine = new FormEngineExtend();
            SaaSRuntimeConfigurationScope.Run(new JObject(), () =>
            {
                var result = engine.ReloadDiyLangCacheAsync(tenant).GetAwaiter().GetResult();
                Assert.Equal(1, result.Code);
                Assert.Equal(10509, result.DataCount);
                Assert.Equal("词条10508", DiyMessage.GetLang(tenant, "key-10508"));
            });
            db.FromSql("UPDATE diy_lang SET ZhCN='changed' WHERE Id='010508'").ExecuteNonQuery();
            SaaSRuntimeConfigurationScope.Run(new JObject { ["DiyLangRuntimeCacheMaxRows"] = 10000 }, () =>
            {
                var result = engine.ReloadDiyLangCacheAsync(tenant).GetAwaiter().GetResult();
                Assert.Equal(0, result.Code);
                Assert.Contains("安全预算", result.Msg);
                Assert.Equal("词条10508", DiyMessage.GetLang(tenant, "key-10508"));
            });
            SaaSRuntimeConfigurationScope.Run(new JObject(), () =>
            {
                Assert.Equal(1, engine.ReloadDiyLangCacheAsync(tenant).GetAwaiter().GetResult().Code);
                Assert.Equal("changed", DiyMessage.GetLang(tenant, "key-10508"));
            });
        }
        finally
        {
            providerField.SetValue(null, previous);
            OsClientExtend.ClientList.TryRemove(tenant, out _);
            DiyMessage.ReplaceTenantMessages(tenant, new Dictionary<string, JObject>());
            master.FromSql("DROP DATABASE `" + tenant + "`").ExecuteNonQuery();
        }
    }
}
