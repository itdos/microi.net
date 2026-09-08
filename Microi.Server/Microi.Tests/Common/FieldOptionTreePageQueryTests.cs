using Microi.net;

namespace Dos.Common.Tests;

public class FieldOptionTreePageQueryTests
{
    [Theory]
    [InlineData("MySql", "LIMIT 51 OFFSET 50", "`Code`")]
    [InlineData("SqlServer", "OFFSET 50 ROWS FETCH NEXT 51 ROWS ONLY", "[Code]")]
    [InlineData("Oracle", "OFFSET 50 ROWS FETCH NEXT 51 ROWS ONLY", "\"Code\"")]
    [InlineData("PostgreSql", "LIMIT 51 OFFSET 50", "\"Code\"")]
    public void DatabasePagesAreBoundedAndOrdered(string dbType, string paging, string key)
    {
        var query = FieldOptionTreePageQuery.Create("select * from Categories where TenantId = 'configured';", dbType,
            "Code", "Title", "ParentCode", 50, 2, int.MaxValue, "", "", null!);
        Assert.EndsWith(paging, query.Sql);
        Assert.Contains("ORDER BY _mci_tree." + key, query.Sql);
        Assert.Contains("where TenantId = 'configured'", query.Sql);
        Assert.Equal(50, query.PageSize);
        Assert.Contains("IS NULL", query.Sql);
        Assert.DoesNotContain("COUNT(*)", query.Sql);
    }

    [Fact]
    public void UserValuesAreParametersAndLookupKeepsTheConfiguredSourceBoundary()
    {
        var value = "' OR 1=1 --";
        var query = FieldOptionTreePageQuery.Create("select * from Categories where Visible = 1", "MySql",
            "Id", "Name", "ParentId", 50, 1, 50, value, "", null!);
        Assert.DoesNotContain(value, query.Sql);
        Assert.Equal(value, query.Parameters["@mci_tree_parent"]);
        var lookup = FieldOptionTreePageQuery.Create("select * from Categories where Visible = 1", "MySql",
            "Id", "Name", "ParentId", 50, 1, 50, "", "", [value]);
        Assert.True(lookup.IsLookup);
        Assert.DoesNotContain("IS NULL", lookup.Sql);
        Assert.Contains("where Visible = 1", lookup.Sql);
        Assert.DoesNotContain(value, lookup.Sql);
        Assert.Equal(value, lookup.Parameters["@mci_tree_value_0"]);
    }

    [Fact]
    public void SearchFindsUnloadedBranchesAndEscapesWildcardCharacters()
    {
        var query = FieldOptionTreePageQuery.Create("select * from Categories", "MySql",
            "Id", "Name", "ParentId", 50, 1, 50, "ignored", "10%_!", null!);
        Assert.Contains("LIKE @mci_tree_keyword", query.Sql);
        Assert.DoesNotContain("ParentId", query.Sql);
        Assert.Equal("%10!%!_!!%", query.Parameters["@mci_tree_keyword"]);
    }

    [Fact]
    public void ChildExistenceUsesOnlyCurrentPageAndRejectsInvalidMappings()
    {
        var query = FieldOptionTreePageQuery.Children("select * from Categories where Visible=1", "MySql", "ParentCode", ["A", "B"]);
        Assert.StartsWith("SELECT DISTINCT", query.Sql);
        Assert.Contains("where Visible=1", query.Sql);
        Assert.Equal(2, query.Parameters.Count);
        Assert.Throws<ArgumentException>(() => FieldOptionTreePageQuery.Children("select * from Categories", "MySql", "ParentId) OR 1=1 --", ["A"]));
        Assert.Throws<ArgumentException>(() => FieldOptionTreePageQuery.Children("select * from Categories", "MySql", "ParentId", Enumerable.Range(0, 201).Select(i => i.ToString()).ToArray()));
    }
}
