using Dos.ORM.SqlCompilation;
using Microi.net;

namespace Microi.Tests.Common;

public class SelectedValueQueryTests
{
    [Theory]
    [InlineData("limit 0,20")]
    [InlineData("LIMIT 20 OFFSET 0;")]
    [InlineData("limit 20")]
    public void LookupKeepsEligibilityAndNestedLimitButRemovesCandidatePage(string page)
    {
        var source = "SELECT Id, CONCAT(Account, '/ ',Name) AS userName FROM sys_user WHERE state=1 AND isDeleted=0 "
            + "AND Id IN (SELECT Id FROM permitted_users LIMIT 100) ORDER BY Account " + page;
        var query = SelectedValueQuery.Create(source, "MySql", "Id", "userName", new[] { "outside-first-page", "x' OR 1=1 --" });
        Assert.Contains("WHERE state=1 AND isDeleted=0", query.Sql);
        Assert.Contains("SELECT Id FROM permitted_users LIMIT 100", query.Sql);
        Assert.DoesNotContain("ORDER BY Account", query.Sql);
        Assert.Contains("WHERE mci_selected.`Id` IN (@mci_selected_0,@mci_selected_1)", query.Sql);
        Assert.EndsWith("LIMIT 3", query.Sql);
        Assert.DoesNotContain("x' OR", query.Sql);
        Assert.Equal("x' OR 1=1 --", query.Parameters["@mci_selected_1"]);
    }

    [Fact]
    public void QuotedKeywordsAndNestedQueriesAreNotTopLevelPagination()
    {
        var q = SelectedValueQuery.Create("select Id, 'LIMIT 1; ORDER BY x' as Name from (select Id from t limit 100) q limit 20", "MySql", "Id", "Name", new[] { "a" });
        Assert.Contains("'LIMIT 1; ORDER BY x'", q.Sql);
        Assert.Contains("select Id from t limit 100", q.Sql);
    }

    [Theory]
    [InlineData("select Id,Name from t; delete from t")]
    [InlineData("select Id,Name from t limit @take")]
    [InlineData("select Id,Name from t limit 2 for update")]
    [InlineData("select Id,Name from t /*! LIMIT 2 */")]
    [InlineData("select Id,Name from t -- LIMIT 2")]
    [InlineData("select Id,Name from t union select Id,Name from u")]
    [InlineData("with x as (select * from t) select * from x")]
    [InlineData("select top 20 Id,Name from t")]
    [InlineData("select Id,'unterminated from t")]
    public void UnknownShapesFailClosed(string sql) => Assert.Throws<ArgumentException>(() =>
        SelectedValueQuery.Create(sql, "MySql", "Id", "Name", new[] { "a" }));

    [Fact]
    public void MappingAndBudgetsCannotBeSuppliedAsSql()
    {
        Assert.Throws<ArgumentException>(() => SelectedValueQuery.Create("select * from t", "MySql", "Id) OR 1=1", "Name", new[] { "a" }));
        Assert.Throws<ArgumentException>(() => SelectedValueQuery.Create("select * from t", "MySql", "Id", "Name", Enumerable.Repeat("a", 201).ToArray()));
        Assert.Throws<ArgumentException>(() => SelectedValueQuery.Create("select * from t", "MySql", "Id", "Name", Array.Empty<string>()));
        var q = SelectedValueQuery.Create("select Id,Name from t", "MySql", "Id", "Name", new[] { "a", "a", "0" });
        Assert.Equal(2, q.Parameters.Count);
    }

    [Fact]
    public async Task FieldLookupRejectsInvalidBatchesBeforeOpeningAnyTenantConnection()
    {
        foreach (var param in new[]
        {
            new DiyTableRowParam { FieldIds = new() { "a", "a" }, _SelectedValues = new() { ["a"] = new() { "1" }, ["b"] = new() { "2" } } },
            new DiyTableRowParam { FieldIds = new() { "a" }, _SelectedValues = new() { ["a"] = Enumerable.Repeat("1", 201).ToList() } },
            new DiyTableRowParam { FieldIds = new() { "wrong" }, _SelectedValues = new() { ["a"] = new() { "1" } } },
            new DiyTableRowParam { FieldIds = new() { "a" }, _SelectedValues = new() { ["a"] = new() { new string('x', 513) } } }
        })
        {
            Assert.Equal(0, (await new FormEngine().GetFieldsData(param)).Code);
        }
    }
}
