using System.Data.Common;
using System.Reflection;
using Dos.ORM;

namespace Dos.ORM.Tests.Compatibility;

public sealed class LegacySqlDialectRewriterTests
{
    private const string MySqlSample =
        "SELECT `u`.`Id`, NOW(), IFNULL(`u`.`Name`, '') " +
        "FROM `sys_user` `u` WHERE `u`.`SchemaName` = DATABASE() LIMIT 10";

    [Fact]
    public void MySql_is_a_byte_for_byte_passthrough()
    {
        Assert.Equal(
            MySqlSample,
            LegacySqlDialectRewriter.Rewrite(MySqlSample, DatabaseType.MySql));
    }

    [Theory]
    [InlineData(DatabaseType.SqlServer,
        "SELECT TOP (10) [u].[Id], CURRENT_TIMESTAMP, COALESCE([u].[Name], '') FROM [sys_user] [u] WHERE [u].[SchemaName] = SCHEMA_NAME()")]
    [InlineData(DatabaseType.PostgreSql,
        "SELECT \"u\".\"Id\", CURRENT_TIMESTAMP, COALESCE(\"u\".\"Name\", '') FROM \"sys_user\" \"u\" WHERE \"u\".\"SchemaName\" = CURRENT_SCHEMA() LIMIT 10")]
    [InlineData(DatabaseType.KingBase,
        "SELECT \"u\".\"Id\", CURRENT_TIMESTAMP, COALESCE(\"u\".\"Name\", '') FROM \"sys_user\" \"u\" WHERE \"u\".\"SchemaName\" = CURRENT_SCHEMA() LIMIT 10")]
    [InlineData(DatabaseType.Oracle,
        "SELECT \"u\".\"Id\", CURRENT_TIMESTAMP, COALESCE(\"u\".\"Name\", '') FROM \"sys_user\" \"u\" WHERE \"u\".\"SchemaName\" = SYS_CONTEXT('USERENV','CURRENT_SCHEMA') FETCH FIRST 10 ROWS ONLY")]
    [InlineData(DatabaseType.DaMeng,
        "SELECT \"u\".\"Id\", CURRENT_TIMESTAMP, COALESCE(\"u\".\"Name\", '') FROM \"sys_user\" \"u\" WHERE \"u\".\"SchemaName\" = CURRENT_SCHEMA FETCH FIRST 10 ROWS ONLY")]
    public void Common_mysql_constructs_are_lowered_for_each_target(
        DatabaseType databaseType,
        string expected)
    {
        Assert.Equal(expected, LegacySqlDialectRewriter.Rewrite(MySqlSample, databaseType));
    }

    [Fact]
    public void Strings_and_comments_are_never_interpreted_as_sql_code()
    {
        const string sql =
            "SELECT '`x` NOW() IFNULL(a,b) DATABASE() LIMIT 2' AS `Text`, \"`quoted` NOW()\" " +
            "FROM `logs` /* `block` NOW() LIMIT 7 */ -- `line` IFNULL(x,y) LIMIT 8\n" +
            "WHERE `Id` = 1 # `hash` DATABASE() LIMIT 9";

        const string expected =
            "SELECT '`x` NOW() IFNULL(a,b) DATABASE() LIMIT 2' AS [Text], \"`quoted` NOW()\" " +
            "FROM [logs] /* `block` NOW() LIMIT 7 */ -- `line` IFNULL(x,y) LIMIT 8\n" +
            "WHERE [Id] = 1 # `hash` DATABASE() LIMIT 9";

        Assert.Equal(expected,
            LegacySqlDialectRewriter.Rewrite(sql, DatabaseType.SqlServer));
    }

    [Fact]
    public void PostgreSql_dollar_strings_and_nested_comments_are_opaque()
    {
        const string sql =
            "SELECT $$NOW() `x` IFNULL(a,b)$$, $body$DATABASE() LIMIT 2$body$, `Id` " +
            "/* outer /* NOW() */ IFNULL(a,b) `hidden` */ FROM `Log`";
        const string expected =
            "SELECT $$NOW() `x` IFNULL(a,b)$$, $body$DATABASE() LIMIT 2$body$, \"Id\" " +
            "/* outer /* NOW() */ IFNULL(a,b) `hidden` */ FROM \"Log\"";

        Assert.Equal(expected,
            LegacySqlDialectRewriter.Rewrite(sql, DatabaseType.PostgreSql));
    }

    [Fact]
    public void Oracle_alternative_quoted_strings_are_opaque()
    {
        const string sql = "SELECT q'[It's NOW() `hidden` LIMIT 1]' AS `Text` FROM `Log`";
        const string expected = "SELECT q'[It's NOW() `hidden` LIMIT 1]' AS \"Text\" FROM \"Log\"";

        Assert.Equal(expected,
            LegacySqlDialectRewriter.Rewrite(sql, DatabaseType.Oracle));
    }

    [Theory]
    [InlineData(DatabaseType.SqlServer,
        "SELECT Id FROM Users ORDER BY Id OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY;")]
    [InlineData(DatabaseType.PostgreSql,
        "SELECT Id FROM Users ORDER BY Id LIMIT 10 OFFSET 5;")]
    [InlineData(DatabaseType.KingBase,
        "SELECT Id FROM Users ORDER BY Id LIMIT 10 OFFSET 5;")]
    [InlineData(DatabaseType.Oracle,
        "SELECT Id FROM Users ORDER BY Id OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY;")]
    [InlineData(DatabaseType.DaMeng,
        "SELECT Id FROM Users ORDER BY Id OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY;")]
    public void Limit_offset_count_is_lowered(DatabaseType databaseType, string expected)
    {
        const string sql = "SELECT Id FROM Users ORDER BY Id LIMIT 5, 10;";
        Assert.Equal(expected, LegacySqlDialectRewriter.Rewrite(sql, databaseType));
    }

    [Fact]
    public void SqlServer_offset_adds_a_deterministic_syntax_fallback_when_order_is_absent()
    {
        Assert.Equal(
            "SELECT Id FROM Users ORDER BY (SELECT NULL) OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY",
            LegacySqlDialectRewriter.Rewrite(
                "SELECT Id FROM Users LIMIT 10 OFFSET 5",
                DatabaseType.SqlServer));
    }

    [Theory]
    [InlineData("SECOND")]
    [InlineData("MINUTE")]
    [InlineData("HOUR")]
    [InlineData("DAY")]
    public void SqlServer_timestampdiff_maps_to_datediff(string unit)
    {
        var sql = $"SELECT TIMESTAMPDIFF({unit}, `StartAt`, IFNULL(`EndAt`, NOW())) FROM `Run`";
        var expected = $"SELECT DATEDIFF({unit}, [StartAt], COALESCE([EndAt], CURRENT_TIMESTAMP)) FROM [Run]";

        Assert.Equal(expected,
            LegacySqlDialectRewriter.Rewrite(sql, DatabaseType.SqlServer));
    }

    [Fact]
    public void PostgreSql_timestampdiff_uses_epoch_and_truncates_like_mysql()
    {
        Assert.Equal(
            "SELECT CAST(TRUNC(EXTRACT(EPOCH FROM ((\"EndAt\") - (\"StartAt\"))) / 60) AS BIGINT) FROM \"Run\"",
            LegacySqlDialectRewriter.Rewrite(
                "SELECT TIMESTAMPDIFF(MINUTE, `StartAt`, `EndAt`) FROM `Run`",
                DatabaseType.PostgreSql));
    }

    [Theory]
    [InlineData(DatabaseType.Oracle,
        "SELECT TRUNC((CAST(\"EndAt\" AS DATE) - CAST(\"StartAt\" AS DATE)) * 86400) FROM \"Run\"")]
    [InlineData(DatabaseType.DaMeng,
        "SELECT TRUNC((CAST(\"EndAt\" AS DATE) - CAST(\"StartAt\" AS DATE)) * 86400) FROM \"Run\"")]
    public void Oracle_family_timestampdiff_uses_date_arithmetic(
        DatabaseType databaseType,
        string expected)
    {
        Assert.Equal(expected,
            LegacySqlDialectRewriter.Rewrite(
                "SELECT TIMESTAMPDIFF(SECOND, `StartAt`, `EndAt`) FROM `Run`",
                databaseType));
    }

    [Fact]
    public void Unsupported_legacy_provider_is_left_unchanged()
    {
        Assert.Equal(MySqlSample,
            LegacySqlDialectRewriter.Rewrite(MySqlSample, DatabaseType.Sqlite3));
    }

    [Fact]
    public void DbSession_FromSql_applies_the_compatibility_boundary()
    {
        var session = new DbSession(
            DatabaseType.PostgreSql,
            "Host=127.0.0.1;Database=test;Username=test;Password=test");

        var section = session.FromSql("SELECT `Id` FROM `Users` LIMIT 1");
        var commandField = typeof(Section).GetField(
            "cmd",
            BindingFlags.Instance | BindingFlags.NonPublic);
        var command = Assert.IsAssignableFrom<DbCommand>(commandField!.GetValue(section));

        Assert.Equal("SELECT \"Id\" FROM \"Users\" LIMIT 1", command.CommandText);
    }
}
