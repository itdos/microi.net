using Dos.ORM;
using Microi.net;

namespace Dos.Common.Tests;

[Trait("Category", "FullStack")]
public class FieldOptionTreePageIntegrationTests
{
    public static bool HasFixtures => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_TEST_CONN"))
        && !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Theory(Skip = "Requires isolated local MySQL and SQL Server fixtures", SkipUnless = nameof(HasFixtures))]
    [InlineData("MySql")]
    [InlineData("SqlServer")]
    public void LargeSourcePagesInDatabaseAndKeepsLookupInsideSourceFilter(string provider)
    {
        var connection = Environment.GetEnvironmentVariable(provider == "MySql" ? "MICROI_UPGRADE_TEST_CONN" : "MICROI_UPGRADE_SQLSERVER_TEST_CONN")!;
        Assert.Contains("127.0.0.1", connection);
        Assert.Contains("Database=upgrade_fixture", connection, StringComparison.OrdinalIgnoreCase);
        var db = MicroiORMExtensions.CreateDbSession(connection, provider == "MySql" ? DatabaseType.MySql : DatabaseType.SqlServer);
        var table = "mci_tree_page_" + Guid.NewGuid().ToString("N");
        var quote = provider == "MySql" ? "`" + table + "`" : "[" + table + "]";
        try
        {
            db.FromSql($"CREATE TABLE {quote} (Code varchar(50) NOT NULL PRIMARY KEY, Title varchar(100), ParentCode varchar(50) NULL, IsDeleted int NOT NULL)").ExecuteNonQuery();
            db.FromSql($"CREATE INDEX ix_parent ON {quote}(ParentCode)").ExecuteNonQuery();
            var rows = new List<string>();
            for (var root = 0; root < 3000; root++)
            {
                rows.Add($"('root-{root:D5}','Root {root:D5}',NULL,0)");
                for (var child = 0; child < 12; child++)
                    rows.Add($"('child-{root:D5}-{child:D2}','Child {root:D5} {child:D2}','root-{root:D5}',0)");
            }
            rows.Add("('hidden','Hidden',NULL,1)");
            foreach (var batch in rows.Chunk(500))
                db.FromSql($"INSERT INTO {quote} (Code,Title,ParentCode,IsDeleted) VALUES " + string.Join(",", batch)).ExecuteNonQuery();
            var source = $"SELECT Code,Title,ParentCode FROM {quote} WHERE IsDeleted=0";
            System.Data.DataTable Execute(FieldOptionTreePageQuery query)
            {
                var section = db.FromSql(query.Sql);
                foreach (var param in query.Parameters) section.AddInParameter(param.Key, param.Value);
                return section.ToDataTable();
            }
            var roots = Execute(FieldOptionTreePageQuery.Create(source, provider, "Code", "Title", "ParentCode", 50, 2, 50, "", "", null!));
            Assert.Equal(51, roots.Rows.Count);
            Assert.Equal("root-00050", roots.Rows[0]["Code"]);
            Assert.Equal("root-00100", roots.Rows[50]["Code"]);
            var children = Execute(FieldOptionTreePageQuery.Create(source, provider, "Code", "Title", "ParentCode", 5, 2, 5, "root-02999", "", null!));
            Assert.Equal(6, children.Rows.Count);
            Assert.Equal("child-02999-05", children.Rows[0]["Code"]);
            var lookup = Execute(FieldOptionTreePageQuery.Create(source, provider, "Code", "Title", "ParentCode", 50, 1, 50, "", "", ["child-02999-11", "hidden", "' OR 1=1 --"]));
            Assert.Single(lookup.Rows.Cast<System.Data.DataRow>());
            Assert.Equal("child-02999-11", lookup.Rows[0]["Code"]);
            var search = Execute(FieldOptionTreePageQuery.Create(source, provider, "Code", "Title", "ParentCode", 50, 1, 50, "", "Child 02999 11", null!));
            Assert.Single(search.Rows.Cast<System.Data.DataRow>());
            var parents = Execute(FieldOptionTreePageQuery.Children(source, provider, "ParentCode", ["root-02999", "child-02999-11"]));
            Assert.Single(parents.Rows.Cast<System.Data.DataRow>());
            Assert.Equal("root-02999", parents.Rows[0]["ParentValue"]);
        }
        finally { db.FromSql($"DROP TABLE IF EXISTS {quote}").ExecuteNonQuery(); }
    }
}
