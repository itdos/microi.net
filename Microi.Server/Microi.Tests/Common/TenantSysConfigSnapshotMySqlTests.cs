using System.Reflection;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using MySql.Data.MySqlClient;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public class TenantSysConfigSnapshotMySqlTests
{
    public static bool HasMySqlFixture => !string.IsNullOrWhiteSpace(
        Environment.GetEnvironmentVariable("MICROI_UPGRADE_MYSQL_TEST_CONN"));

    [Fact(Skip = "Requires isolated local MySQL fixture", SkipUnless = nameof(HasMySqlFixture))]
    [Trait("Category", "FullStack")]
    public void LoginSwitchSnapshot_IgnoresHistoricalRows_AndReadsLatestActiveConfiguration()
    {
        var connection = new MySqlConnectionStringBuilder(ConnectionStringCompatibility.NormalizeProviderSyntax(
            DatabaseType.MySql, Environment.GetEnvironmentVariable("MICROI_UPGRADE_MYSQL_TEST_CONN")));
        Assert.Equal("127.0.0.1", connection.Server);
        var tenant = "config_fixture_" + Guid.NewGuid().ToString("N");
        connection.Database = "mysql";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.MySql);
        master.FromSql("CREATE DATABASE `" + tenant + "` CHARACTER SET utf8mb4").ExecuteNonQuery();
        connection.Database = tenant;
        var db = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.MySql);
        var services = new ServiceCollection();
        services.AddMicroiORM();
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
            db.FromSql("CREATE TABLE sys_config (Id varchar(36) PRIMARY KEY, IsEnable int NULL, IsDeleted int NULL, " +
                       "UpdateTime datetime NULL, GiteeLoginEnabled int NULL); " +
                       "INSERT INTO sys_config VALUES ('00-deleted',1,1,'2030-01-01',0)," +
                       "('01-disabled',0,0,'2030-01-01',0),('10-older',1,0,'2026-01-01',0)," +
                       "('20-latest',1,NULL,'2026-02-01',1),('21-tied',1,0,'2026-02-01',0)")
                .ExecuteNonQuery();

            var snapshot = TenantSystemSettingsSecurity.LoadTenantSysConfigSnapshot(tenant);
            Assert.Equal("20-latest", snapshot["Id"]?.ToString());
            Assert.True(TenantSystemSettingsSecurity.GetPublicBehaviorBool(
                snapshot, "GiteeLoginEnabled", null, "Login.Gitee.Enabled", false));

            db.FromSql("UPDATE sys_config SET IsEnable=0 WHERE Id='20-latest'").ExecuteNonQuery();
            Assert.Equal("21-tied", TenantSystemSettingsSecurity.LoadTenantSysConfigSnapshot(tenant)["Id"]?.ToString());
            db.FromSql("UPDATE sys_config SET IsEnable=0").ExecuteNonQuery();
            Assert.Empty(TenantSystemSettingsSecurity.LoadTenantSysConfigSnapshot(tenant));
        }
        finally
        {
            providerField.SetValue(null, previous);
            OsClientExtend.ClientList.TryRemove(tenant, out _);
            master.FromSql("DROP DATABASE `" + tenant + "`").ExecuteNonQuery();
        }
    }
}
