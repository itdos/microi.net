using Dos.ORM;
using Dos.ORM.SqlCompilation;
using Microi.net;
using MySql.Data.MySqlClient;

namespace Microi.Tests.Common;

public class SelectedValueQueryMySqlTests
{
    public static bool HasMySql => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_MYSQL_TEST_CONN"));

    [Fact(Skip = "Requires configured MySQL read-only connection", SkipUnless = nameof(HasMySql))]
    [Trait("Category", "FullStack")]
    public void OffPageLookupExecutesParameterizedSqlWithoutDatabaseWrites()
    {
        // 只 SELECT 字面量派生表，不创建/修改任何表，不读真实用户或业务数据。
        var connection = new MySqlConnectionStringBuilder(ConnectionStringCompatibility.NormalizeProviderSyntax(
            DatabaseType.MySql, Environment.GetEnvironmentVariable("MICROI_UPGRADE_MYSQL_TEST_CONN")))
        { ConnectionTimeout = 10, DefaultCommandTimeout = 10 };
        var db = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.MySql);
        var literals = string.Join(" UNION ALL ", Enumerable.Range(1, 30).Select(i => $"SELECT '{i}' AS Id, 'Label {i}' AS Name, {(i == 30 ? 0 : 1)} AS Active"));
        var source = $"SELECT Id,Name FROM ({literals}) fixture WHERE Active=1 ORDER BY Id LIMIT 0,20";
        var firstPage = db.FromSql(source).ToDataTable();
        Assert.Equal(20, firstPage.Rows.Count);
        Assert.DoesNotContain(firstPage.Rows.Cast<System.Data.DataRow>(), row => row["Id"].ToString() == "9");
        var query = SelectedValueQuery.Create(source, "MySql", "Id", "Name", new[] { "9", "30", "x' OR 1=1 --" });
        var sql = db.FromSql(query.Sql);
        foreach (var parameter in query.Parameters) sql.AddInParameter(parameter.Key, parameter.Value);
        var rows = sql.ToDataTable();
        Assert.Single(rows.Rows.Cast<System.Data.DataRow>());
        Assert.Equal("9", rows.Rows[0]["Id"]);
        Assert.Equal("Label 9", rows.Rows[0]["Name"]);
        Assert.Equal(2, rows.Columns.Count);
    }
}
