using System.Data.SqlClient;
using Dos.ORM;
using Microi.net;

namespace Microi.Tests.ORM.Compatibility;

[Trait("Category", "FullStack")]
public sealed class SqlServerColumnDescriptionIntegrationTests
{
    public static bool HasSqlServerTestConnection => !string.IsNullOrWhiteSpace(
        Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Fact(Skip = "Requires an isolated local SQL Server fixture", SkipUnless = nameof(HasSqlServerTestConnection))]
    public void ChangeColumn_AddsMissingDescription_UpdatesAndRenamesWithoutLosingData()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN")!);
        Assert.Matches(@"^127\.0\.0\.1,\d{1,5}$", connection.DataSource);
        Assert.Equal("upgrade_fixture", connection.InitialCatalog);
        var databaseName = "microi_column_fixture_" + Guid.NewGuid().ToString("N");
        connection.InitialCatalog = "master";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
        master.FromSql($"CREATE DATABASE [{databaseName}]").ExecuteNonQuery();
        connection.InitialCatalog = databaseName;
        var database = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
        try
        {
            var ddl = new SqlServerService();
            Assert.Equal(1, ddl.AddDiyTable(new DbServiceParam { DbSession = database, TableName = "unicode_form" }).Code);
            Assert.Equal(1, ddl.AddColumn(new DbServiceParam
            {
                DbSession = database, TableName = "unicode_form", FieldName = "Title",
                FieldType = "varchar(255)", FieldLabel = "中文标题"
            }).Code);
            var unicode = "中文与 Emoji 🚀 O'Brien";
            database.FromSql("INSERT INTO unicode_form (Id,UserName,Title) VALUES ('unicode-row',@p0,@p0)")
                .AddInParameter("p0", unicode).ExecuteNonQuery();
            Assert.Equal(unicode, database.FromSql("SELECT UserName FROM unicode_form").ToScalar<string>());
            Assert.Equal(unicode, database.FromSql("SELECT Title FROM unicode_form").ToScalar<string>());
            Assert.Equal(1, ddl.ChangeColumn(new DbServiceParam
            {
                DbSession = database, TableName = "unicode_form", FieldName = "Title", NewFieldName = "Title",
                FieldType = "varchar(500)", FieldLabel = "修改中文标题"
            }).Code);
            Assert.Equal(unicode, database.FromSql("SELECT Title FROM unicode_form").ToScalar<string>());

            database.FromSql("CREATE TABLE dbo.legacy_job (Id int PRIMARY KEY, JobParam nvarchar(50) NULL); INSERT INTO dbo.legacy_job VALUES (1,N'保留旧参数')").ExecuteNonQuery();
            var change = new DbServiceParam
            {
                DbSession = database, TableName = "legacy_job", FieldName = "JobParam", NewFieldName = "JobParam",
                FieldType = "mediumtext", FieldLabel = "任务参数 O'Brien'; --"
            };
            Assert.Equal(1, ddl.ChangeColumn(change).Code);
            AssertDescription(database, "JobParam", change.FieldLabel);
            Assert.Equal(-1, database.FromSql("SELECT max_length FROM sys.columns WHERE object_id=OBJECT_ID('dbo.legacy_job') AND name='JobParam'").ToScalar<int>());
            change.FieldLabel = "新的参数说明";
            Assert.Equal(1, ddl.ChangeColumn(change).Code);
            AssertDescription(database, "JobParam", change.FieldLabel);
            change.NewFieldName = "Parameters";
            Assert.Equal(1, ddl.ChangeColumn(change).Code);
            AssertDescription(database, "Parameters", change.FieldLabel);
            Assert.Equal("保留旧参数", database.FromSql("SELECT Parameters FROM dbo.legacy_job WHERE Id=1").ToScalar<string>());
            Assert.Equal(1, database.FromSql("SELECT COUNT(*) FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.legacy_job') AND name='MS_Description'").ToScalar<int>());
        }
        finally
        {
            master.FromSql($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]").ExecuteNonQuery();
        }
    }

    private static void AssertDescription(DbSession database, string column, string expected)
    {
        var actual = database.FromSql("SELECT CONVERT(nvarchar(max),value) FROM sys.extended_properties WHERE class=1 AND major_id=OBJECT_ID('dbo.legacy_job') AND minor_id=COLUMNPROPERTY(OBJECT_ID('dbo.legacy_job'), @column, 'ColumnId') AND name='MS_Description'")
            .AddInParameter("column", column).ToScalar<string>();
        Assert.Equal(expected, actual);
    }
}
