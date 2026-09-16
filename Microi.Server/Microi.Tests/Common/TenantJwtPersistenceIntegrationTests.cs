using System.Reflection;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using MySql.Data.MySqlClient;
using System.Data.SqlClient;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public sealed class TenantJwtPersistenceIntegrationTests
{
    public static bool HasFixtures => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_MYSQL_TEST_CONN"))
        && !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Theory(Skip = "Requires isolated local database fixtures", SkipUnless = nameof(HasFixtures))]
    [InlineData("MySql", null)]
    [InlineData("MySql", "")]
    [InlineData("MySql", " \t ")]
    [InlineData("MySql", "short")]
    [InlineData("SqlServer", null)]
    [InlineData("SqlServer", "")]
    [InlineData("SqlServer", " \t ")]
    [InlineData("SqlServer", "short")]
    public async Task NewlyAddedTenant_PersistsWeakKeyAndConvergesCompetingRefreshes(string providerName, string? previousSecret)
    {
        var databaseName = "jwt_persist_" + Guid.NewGuid().ToString("N");
        var mysql = providerName == "MySql";
        var type = mysql ? DatabaseType.MySql : DatabaseType.SqlServer;
        var connection = Environment.GetEnvironmentVariable(mysql ? "MICROI_UPGRADE_MYSQL_TEST_CONN" : "MICROI_UPGRADE_SQLSERVER_TEST_CONN")!;
        string WithDatabase(string name)
        {
            if (mysql) { var b = new MySqlConnectionStringBuilder(connection); Assert.Equal("127.0.0.1", b.Server); Assert.Equal("upgrade_fixture", b.Database); b.Database = name; return b.ConnectionString; }
            var s = new SqlConnectionStringBuilder(connection); Assert.StartsWith("127.0.0.1,", s.DataSource); Assert.Equal("upgrade_fixture", s.InitialCatalog); s.InitialCatalog = name; return s.ConnectionString;
        }
        var master = MicroiORMExtensions.CreateDbSession(WithDatabase(mysql ? "mysql" : "master"), type);
        var quoted = mysql ? "`" + databaseName + "`" : "[" + databaseName + "]";
        master.FromSql("CREATE DATABASE " + quoted).ExecuteNonQuery();
        var db = MicroiORMExtensions.CreateDbSession(WithDatabase(databaseName), type);
        var services = new ServiceCollection(); services.AddMicroiORM();
        using var provider = services.BuildServiceProvider();
        var providerField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        var oldProvider = providerField.GetValue(null);
        var oldType = OsClientDefault.OsClientDbType;
        MicroiEngine.Init(provider); OsClientDefault.OsClientDbType = providerName;
        try
        {
            db.FromSql("CREATE TABLE sys_osclients (Id varchar(50) PRIMARY KEY, AuthSecret varchar(100) NULL, AuthSecretRotateVersion varchar(100) NULL, UpdateTime datetime NULL)").ExecuteNonQuery();
            db.FromSql("INSERT INTO sys_osclients (Id,AuthSecret) VALUES ('target',@value),('unrelated','unrelated-existing-value')")
                .AddSensitiveInParameter("value", System.Data.DbType.String, previousSecret).ExecuteNonQuery();
            var runtime = new OsClient();
            var config = new OsClientSecret { Db = db, OsClientModel = new JObject { ["DbType"] = providerName } };
            var item = new OsClientSecret { OsClient = "fixture", OsClientModel = new JObject { ["Id"] = "target" } };
            var method = typeof(OsClient).GetMethod("TryPersistAuthSecret", BindingFlags.Instance | BindingFlags.NonPublic)!;
            (bool Success, string Effective) Persist(string? expected, string proposed, string id = "target")
            {
                var target = new OsClientSecret { OsClient = item.OsClient, OsClientModel = new JObject { ["Id"] = id } };
                object?[] args = [target, config, expected, proposed, null];
                var ok = (bool)method.Invoke(runtime, args)!;
                return (ok, (string)args[4]!);
            }
            // 两个独立刷新竞争同一旧值；只允许一个新值成为持久事实，另一方必须读取胜者。
            var proposals = new[] { TenantJwtSigningKeyCoordinator.GenerateStrongAuthSecret(), TenantJwtSigningKeyCoordinator.GenerateStrongAuthSecret() };
            var results = await Task.WhenAll(proposals.Select(value => Task.Run(() => Persist(previousSecret, value))));
            Assert.All(results, result => Assert.True(result.Success));
            var durable = db.FromSql("SELECT AuthSecret FROM sys_osclients WHERE Id='target'").ToScalar<string>();
            Assert.Contains(durable, proposals);
            Assert.All(results, result => Assert.Equal(durable, result.Effective));
            Assert.Equal(durable, Persist(previousSecret, TenantJwtSigningKeyCoordinator.GenerateStrongAuthSecret()).Effective);
            Assert.Equal("unrelated-existing-value", db.FromSql("SELECT AuthSecret FROM sys_osclients WHERE Id='unrelated'").ToScalar<string>());
            Assert.False(Persist(null, proposals[0], "missing").Success);
            db.FromSql("UPDATE sys_osclients SET AuthSecret='different-weak-value' WHERE Id='target'").ExecuteNonQuery();
            Assert.False(Persist("stale-weak-value", proposals[0]).Success);
            Assert.Equal("different-weak-value", db.FromSql("SELECT AuthSecret FROM sys_osclients WHERE Id='target'").ToScalar<string>());
        }
        finally
        {
            providerField.SetValue(null, oldProvider); OsClientDefault.OsClientDbType = oldType;
            if (!mysql) master.FromSql("ALTER DATABASE " + quoted + " SET SINGLE_USER WITH ROLLBACK IMMEDIATE").ExecuteNonQuery();
            master.FromSql("DROP DATABASE " + quoted).ExecuteNonQuery();
        }
    }
}
