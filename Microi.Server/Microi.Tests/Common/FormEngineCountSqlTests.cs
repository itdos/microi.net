using System.Reflection;
using Microi.net;

namespace Microi.Tests.Common;

public class FormEngineCountSqlTests
{
    private static string ReplaceProjection(
        string sql,
        string currentProjection,
        string replacementProjection)
    {
        var method = typeof(FormEngine).GetMethod(
            "ReplaceLeadingSelectProjection",
            BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(method);
        return Assert.IsType<string>(method.Invoke(
            null,
            new object?[] { sql, currentProjection, replacementProjection }));
    }

    [Fact]
    public void Count_projection_does_not_replace_the_same_id_expression_in_where()
    {
        const string projection = "A.`Id`";
        const string sql = " SELECT A.`Id` FROM `sys_role` A WHERE A.`Name` = ?Name AND A.`TenantId` IS NULL AND A.`Id` <> ?Id";

        var result = ReplaceProjection(sql, projection, "COUNT(A.`Id`)");

        Assert.StartsWith(" SELECT COUNT(A.`Id`) FROM `sys_role` A", result, StringComparison.Ordinal);
        Assert.Contains("AND A.`Id` <> ?Id", result, StringComparison.Ordinal);
        Assert.DoesNotContain("COUNT(A.`Id`) <> ?Id", result, StringComparison.Ordinal);
    }

    [Fact]
    public void Grouped_count_projection_only_changes_the_leading_select_list()
    {
        const string projection = "A.`Id`";
        const string sql = " SELECT A.`Id` FROM `sys_role` A WHERE A.`Id` <> ?Id HAVING COUNT(A.`Id`) > 0";

        var result = ReplaceProjection(sql, projection, "A.`Id`,COUNT(A.`Id`) AS `Rows`");

        Assert.StartsWith(" SELECT A.`Id`,COUNT(A.`Id`) AS `Rows` FROM", result, StringComparison.Ordinal);
        Assert.Contains("WHERE A.`Id` <> ?Id", result, StringComparison.Ordinal);
        Assert.Contains("HAVING COUNT(A.`Id`) > 0", result, StringComparison.Ordinal);
    }
}
