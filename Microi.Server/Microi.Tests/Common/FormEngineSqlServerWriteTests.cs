using System.Data;
using System.Data.SqlClient;
using System.Reflection;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class FormEngineSqlServerWriteTests
{
    public static bool HasSqlServerTestConnection => !string.IsNullOrWhiteSpace(
        Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Theory]
    [InlineData("datetime", "", true)]
    [InlineData("datetime2", "  ", true)]
    [InlineData("date", null, true)]
    [InlineData("varchar(25)", "", false)]
    [InlineData("datetime", "2026-09-07 10:20:30", false)]
    public void EmptyNativeDate_UsesDatabaseNull_WithoutChangingTextDates(string type, string? value, bool isNull)
    {
        var parameter = new SqlParameter();
        var method = typeof(FormEngine).GetMethod("SetDbParameter", BindingFlags.NonPublic | BindingFlags.Static)!;
        method.Invoke(null, new object?[] { parameter, new JObject { ["Name"] = "BizDate", ["Type"] = type },
            value == null ? JValue.CreateNull() : new JValue(value), new DbInfo { DbType = DatabaseType.SqlServer } });
        if (isNull) Assert.Equal(DBNull.Value, parameter.Value);
        else Assert.Equal(value, parameter.Value);
    }

    [Fact(Skip = "Requires an isolated local SQL Server fixture", SkipUnless = nameof(HasSqlServerTestConnection))]
    [Trait("Category", "FullStack")]
    public void CurrentFileIndex_RepairsNullIdentitySemantics_AndPreservesVersionUniqueness()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN")!);
        Assert.Matches(@"^127\.0\.0\.1,\d{1,5}$", connection.DataSource);
        Assert.Equal("upgrade_fixture", connection.InitialCatalog);
        var databaseName = "microi_file_index_fixture_" + Guid.NewGuid().ToString("N");
        connection.InitialCatalog = "master";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
        master.FromSql($"CREATE DATABASE [{databaseName}]").ExecuteNonQuery();
        connection.InitialCatalog = databaseName;
        var database = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
        var tenant = "file-index-" + Guid.NewGuid().ToString("N");
        var client = new OsClientSecret { OsClient = tenant, Db = database, DbRead = database,
            OsClientModel = new JObject { ["DbType"] = "SqlServer" } };
        var services = new ServiceCollection(); services.AddMicroiORM();
        using var provider = services.BuildServiceProvider();
        var providerField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        var previous = providerField.GetValue(null);
        OsClientExtend.ClientList[tenant] = client; MicroiEngine.Init(provider);
        try
        {
            database.FromSql("CREATE TABLE mci_ai_app_file (Id varchar(36) PRIMARY KEY, AppId varchar(50), VersionId varchar(50) NULL, FilePathHash char(64) NULL); CREATE UNIQUE INDEX ux_aaf_version_pathhash ON mci_ai_app_file(VersionId,FilePathHash); INSERT INTO mci_ai_app_file VALUES ('current-a','app-a',NULL,'same-path')").ExecuteNonQuery();
            Assert.False(Upgrade25.CurrentFileIdentityIndexReady(client));
            Upgrade25.EnsureCurrentFileIdentityIndex(client);
            Assert.True(Upgrade25.CurrentFileIdentityIndexReady(client));
            Upgrade25.EnsureCurrentFileIdentityIndex(client);
            database.FromSql("INSERT INTO mci_ai_app_file VALUES ('current-b','app-b',NULL,'same-path'),('version-a','app-a','v1','same-path')").ExecuteNonQuery();
            Assert.ThrowsAny<Exception>(() => database.FromSql("INSERT INTO mci_ai_app_file VALUES ('version-b','app-a','v1','same-path')").ExecuteNonQuery());
            Assert.Equal(3, database.FromSql("SELECT COUNT(*) FROM mci_ai_app_file").ToScalar<int>());
        }
        finally
        {
            providerField.SetValue(null, previous); OsClientExtend.ClientList.TryRemove(tenant, out _);
            master.FromSql($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]").ExecuteNonQuery();
        }
    }
}
