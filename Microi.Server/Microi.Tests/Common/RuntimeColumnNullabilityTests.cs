using Dos.ORM;
using Microi.net;
using MySql.Data.MySqlClient;
using System.Reflection;

namespace Microi.Tests.Common;

public class RuntimeColumnNullabilityTests
{
    [Theory]
    [InlineData("`V8Limit` int NOT NULL", "`V8Limit` int NULL")]
    [InlineData("`V8Limit` int COMMENT 'no default'", "`V8Limit` int COMMENT 'no default'")]
    [InlineData("`V8Limit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'NOT NULL' COMMENT 'keep NOT NULL'", "`V8Limit` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT 'NOT NULL' COMMENT 'keep NOT NULL'")]
    [InlineData("`V8Limit` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", "`V8Limit` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")]
    [InlineData("`V8Limit` enum('NOT NULL','ok') NOT NULL DEFAULT 'ok'", "`V8Limit` enum('NOT NULL','ok') NULL DEFAULT 'ok'")]
    public void NullabilityChange_PreservesCompleteDefinitionAndQuotedText(string input, string expected)
    {
        var table = "CREATE TABLE `sys_apiengine` (\n  `Id` varchar(36) NOT NULL,\n  " + input + ",\n  PRIMARY KEY (`Id`)\n)";
        Assert.Equal(expected, RuntimeColumnNullability.MakeMySqlColumnNullable(table, "V8Limit"));
        Assert.Throws<InvalidOperationException>(() => RuntimeColumnNullability.MakeMySqlColumnNullable(table, "Id"));
        Assert.Throws<InvalidOperationException>(() => RuntimeColumnNullability.MakeMySqlColumnNullable(table, "Missing"));
    }

    public static bool HasMySqlFixture => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_MYSQL_TEST_CONN"));

    [Fact(Skip = "Requires isolated local MySQL fixture", SkipUnless = nameof(HasMySqlFixture))]
    [Trait("Category", "FullStack")]
    public void LegacyRequiredFields_AreNullableBeforeInsert_AndRestartPreservesDataAndSchema()
    {
        var connection = new MySqlConnectionStringBuilder(ConnectionStringCompatibility.NormalizeProviderSyntax(
            DatabaseType.MySql, Environment.GetEnvironmentVariable("MICROI_UPGRADE_MYSQL_TEST_CONN")));
        Assert.Equal("127.0.0.1", connection.Server);
        var databaseName = "microi_nullable_fixture_" + Guid.NewGuid().ToString("N");
        connection.Database = "mysql";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.MySql);
        master.FromSql("CREATE DATABASE `" + databaseName + "` CHARACTER SET utf8mb4").ExecuteNonQuery();
        connection.Database = databaseName;
        var database = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.MySql);
        try
        {
            database.FromSql(@"CREATE TABLE sys_apiengine (
                Id varchar(36) NOT NULL PRIMARY KEY,
                ApiEngineKey varchar(100) NOT NULL,
                V8Limit int NOT NULL,
                Dropped int NULL,
                Details mediumtext NULL,
                Note varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'NOT NULL' COMMENT '保留 NOT NULL',
                CreateTime timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY ux_api_key (ApiEngineKey));
                INSERT INTO sys_apiengine (Id,ApiEngineKey,V8Limit,Details) VALUES ('old','old',1,'keep content');
                ALTER TABLE sys_apiengine ALTER COLUMN Dropped DROP DEFAULT;
                ALTER TABLE sys_apiengine ALTER COLUMN Details DROP DEFAULT;").ExecuteNonQuery();
            database.FromSql(@"CREATE TABLE sys_osclients (Id varchar(36) NOT NULL PRIMARY KEY,
                ApplicationStreamPublishMode varchar(20) NOT NULL DEFAULT 'LegacyOpen',
                ApplicationStreamMinProtocol int NOT NULL DEFAULT 2,
                ApplicationStreamGateEpoch bigint NOT NULL DEFAULT 0);
                INSERT INTO sys_osclients (Id) VALUES ('existing-tenant');").ExecuteNonQuery();
            database.FromSql(Upgrade25.BuildCreateGateTransitionAuditTableSql(Upgrade25.SchemaDialect.MySql)).ExecuteNonQuery();
            Assert.Equal(1, database.FromSql("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mci_app_stream_gate_transition' AND IS_NULLABLE='NO'").ToScalar<int>());
            Assert.Throws<MySqlException>(() => database.FromSql("SELECT DEFAULT(Dropped) FROM sys_apiengine LIMIT 0").ToScalar());
            Assert.Throws<MySqlException>(() => database.FromSql("SELECT DEFAULT(Details) FROM sys_apiengine LIMIT 0").ToScalar());
            var client = new OsClientSecret { OsClient = "nullable_fixture", Db = database, DbRead = database };
            Assert.False(RuntimeColumnNullability.Ready(client));
            Assert.Equal(9, RuntimeColumnNullability.EnsureUnderLease(client));
            Assert.True(RuntimeColumnNullability.Ready(client));
            // Replaying the older stream migration must not undo the nullable
            // repair, while its declared defaults and legacy values survive.
            var enforceControl = typeof(Upgrade25).GetMethod("EnforceControlColumn", BindingFlags.Static | BindingFlags.NonPublic)!;
            foreach (var field in Upgrade25.Fields.Where(field => field.TableName == "sys_osclients"))
                enforceControl.Invoke(null, new object[] { client, Upgrade25.SchemaDialect.MySql, field });
            Assert.True(RuntimeColumnNullability.Ready(client));
            database.FromSql("INSERT INTO sys_osclients (Id) VALUES ('new-tenant')").ExecuteNonQuery();
            Assert.Equal(2, database.FromSql("SELECT COUNT(*) FROM sys_osclients WHERE ApplicationStreamPublishMode='LegacyOpen' AND ApplicationStreamMinProtocol=2 AND ApplicationStreamGateEpoch=0").ToScalar<int>());
            Assert.Equal(1, database.FromSql("SELECT V8Limit FROM sys_apiengine WHERE Id='old'").ToScalar<int>());
            Assert.Equal("keep content", database.FromSql("SELECT Details FROM sys_apiengine WHERE Id='old'").ToScalar<string>());
            database.FromSql("INSERT INTO sys_apiengine (Id,ApiEngineKey) VALUES ('new','new')").ExecuteNonQuery();
            Assert.Equal(1, database.FromSql("SELECT COUNT(*) FROM sys_apiengine WHERE Id='new' AND V8Limit IS NULL AND Dropped IS NULL AND Details IS NULL AND Note='NOT NULL' AND CreateTime IS NOT NULL").ToScalar<int>());
            Assert.Equal("NO", database.FromSql("SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_apiengine' AND COLUMN_NAME='Id'").ToScalar<string>());
            Assert.Equal("utf8mb4_bin", database.FromSql("SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_apiengine' AND COLUMN_NAME='Note'").ToScalar<string>());
            Assert.Equal(1, database.FromSql("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_apiengine' AND INDEX_NAME='ux_api_key' AND NON_UNIQUE=0").ToScalar<int>());
            var reopened = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.MySql);
            Assert.Equal(0, RuntimeColumnNullability.EnsureUnderLease(new OsClientSecret { OsClient = client.OsClient, Db = reopened, DbRead = reopened }));
            Assert.Equal(2, reopened.FromSql("SELECT COUNT(*) FROM sys_apiengine").ToScalar<int>());
        }
        finally
        {
            master.FromSql("DROP DATABASE `" + databaseName + "`").ExecuteNonQuery();
        }
    }
}
