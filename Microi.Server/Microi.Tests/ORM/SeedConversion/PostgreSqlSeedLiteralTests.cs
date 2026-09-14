using Dos.ORM.SeedConversion;

namespace Dos.ORM.Tests.SeedConversion;

public sealed class PostgreSqlSeedLiteralTests
{
    [Theory]
    [InlineData(SeedDatabaseTarget.PostgreSql17)]
    [InlineData(SeedDatabaseTarget.KingbaseEs)]
    public void Script_literals_are_explicitly_escaped_and_do_not_span_physical_lines(SeedDatabaseTarget target)
    {
        // 模拟 V8 中的引号、正则、Windows 路径、注释和伪 SQL；导出不能依赖导入客户端的会话设置。
        const string dump = """
            CREATE TABLE `scripts` (`Id` int(11), `Body` longtext);
            INSERT INTO `scripts` (`Id`,`Body`) VALUES
            (1,'//写回调日志\r\nvar s = \'C:\\tmp\\\';\n/\\u0000/; -- comment;\nGO\n/\n中文😀\tend'),
            (2,''),(3,NULL);
            """;
        var output = new StringWriter();
        var result = DatabaseSeedConverter.ConvertMySql57(new StringReader(dump), output, target);
        var sql = output.ToString();
        Assert.Equal(3, result.RowCount);
        Assert.Contains("E'//写回调日志\\r\\nvar s = ''C:\\\\tmp\\\\'';\\n/\\\\u0000/; -- comment;\\nGO\\n/\\n中文😀\\tend'", sql);
        Assert.Contains("(2,E'')", sql);
        Assert.Contains("(3,NULL)", sql);
        Assert.DoesNotContain("//写回调日志\r\n", sql);
        Assert.DoesNotContain("\nGO\n", sql);
    }

    [Theory]
    [InlineData(SeedDatabaseTarget.PostgreSql17)]
    [InlineData(SeedDatabaseTarget.KingbaseEs)]
    public void Defaults_and_comments_use_the_same_escape_rules(SeedDatabaseTarget target)
    {
        const string dump = """
            CREATE TABLE `scripts` (`Body` varchar(100) DEFAULT 'C:\\tmp\nnext' COMMENT 'column\r\nquote\'\\') COMMENT='table\nslash\\';
            """;
        var output = new StringWriter();
        DatabaseSeedConverter.ConvertMySql57(new StringReader(dump), output, target);
        var sql = output.ToString();
        Assert.Contains("DEFAULT E'C:\\\\tmp\\nnext'", sql);
        Assert.Contains("IS E'column\\r\\nquote''\\\\';", sql);
        Assert.Contains("IS E'table\\nslash\\\\';", sql);
    }

    [Theory]
    [InlineData(SeedDatabaseTarget.PostgreSql17)]
    [InlineData(SeedDatabaseTarget.KingbaseEs)]
    public void Large_scripts_are_not_truncated_or_split_into_nested_expressions(SeedDatabaseTarget target)
    {
        var dump = "CREATE TABLE `scripts` (`Body` longtext); INSERT INTO `scripts` (`Body`) VALUES ('"
            + new string('中', 600_000) + "\\nlast\\\\');";
        var output = new StringWriter();
        DatabaseSeedConverter.ConvertMySql57(new StringReader(dump), output, target);
        var sql = output.ToString();
        Assert.Equal(600_000, sql.Count(c => c == '中'));
        Assert.Contains("\\nlast\\\\'", sql);
        Assert.DoesNotContain(" || ", sql);
    }

    [Fact]
    public void Null_character_is_rejected_instead_of_silently_losing_data()
    {
        const string dump = "CREATE TABLE `scripts` (`Body` longtext); INSERT INTO `scripts` (`Body`) VALUES ('before\\0after');";
        var error = Assert.ThrowsAny<Exception>(() => DatabaseSeedConverter.ConvertMySql57(
            new StringReader(dump), new StringWriter(), SeedDatabaseTarget.PostgreSql17));
        Assert.Contains("NUL", error.Message);
    }
}
