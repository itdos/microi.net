using System.Text;
using Dos.ORM.SeedConversion;

namespace Dos.ORM.Tests.SeedConversion;

public sealed class MySql57SeedConverterTests
{
    private const string SmallDump = """
        -- a semicolon here must not create a statement ;
        SET NAMES utf8mb4;
        SET FOREIGN_KEY_CHECKS=0;
        DROP TABLE IF EXISTS `seed_parent`;
        CREATE TABLE `seed_parent` (
          `Id` varchar(36) NOT NULL COMMENT 'identifier',
          `Message` mediumtext COMMENT 'message',
          `Enabled` bit(1) NOT NULL DEFAULT b'0',
          `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          `RowId` varchar(64) DEFAULT NULL,
          `Payload` blob DEFAULT NULL,
          PRIMARY KEY (`Id`) USING BTREE,
          KEY `idx_seed_message` (`Message`(191)) USING BTREE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='seed table';
        INSERT INTO `seed_parent` (`Id`,`Message`,`Enabled`,`UpdatedAt`,`RowId`,`Payload`) VALUES
        ('one','semi; &quot; &name -- text\r\nV8.Result = false;\nquote\' and slash\\',0,NULL,'row-one',0x00FF),
        ('two','',1,'2026-07-19 12:13:14','',NULL),
        ('three',NULL,0,NULL,NULL,NULL);
        SET FOREIGN_KEY_CHECKS=1;
        """;

    [Theory]
    [InlineData(SeedDatabaseTarget.SqlServer2022, "[seed_parent]", "NVARCHAR(MAX)", "0x00FF")]
    [InlineData(SeedDatabaseTarget.PostgreSql17, "\"seed_parent\"", "TEXT", "decode('00FF','hex')")]
    [InlineData(SeedDatabaseTarget.Oracle19c, "\"seed_parent\"", "NCLOB", "HEXTORAW('00FF')")]
    [InlineData(SeedDatabaseTarget.Dm8, "\"seed_parent\"", "NCLOB", "HEXTORAW('00FF')")]
    [InlineData(SeedDatabaseTarget.KingbaseEs, "\"seed_parent\"", "TEXT", "decode('00FF','hex')")]
    public void Converts_structure_data_indexes_comments_and_update_timestamp(
        SeedDatabaseTarget target,
        string quotedTable,
        string largeTextType,
        string binaryLiteral)
    {
        var output = new StringWriter();

        var result = DatabaseSeedConverter.ConvertMySql57(
            new StringReader(SmallDump), output, target);

        Assert.Equal(1, result.TableCount);
        Assert.Equal(3, result.RowCount);
        Assert.Equal(3, result.TableRowCounts["seed_parent"]);
        Assert.Equal(
            target == SeedDatabaseTarget.Oracle19c,
            result.RequiresNonEmptyEnvelopeRuntime);
        Assert.Contains(quotedTable, output.ToString());
        Assert.Contains(largeTextType, output.ToString());
        Assert.Contains(binaryLiteral, output.ToString());
        Assert.Contains("idx_seed_message", output.ToString());
        Assert.Contains("seed table", output.ToString());
        Assert.Contains("semi; &quot; &name -- text", output.ToString());
        Assert.Contains("quote'' and slash\\", output.ToString());
        Assert.Contains("TRG_seed_parent_UpdatedAt", output.ToString());
    }

    [Fact]
    public void Oracle_prefixes_non_null_text_and_remains_runtime_fail_closed()
    {
        var output = new StringWriter();

        DatabaseSeedConverter.ConvertMySql57(
            new StringReader(SmallDump), output, SeedDatabaseTarget.Oracle19c);

        var sql = output.ToString();
        Assert.Contains("RequiresNonEmptyEnvelopeRuntime=true", sql);
        Assert.Contains("\uE000one", sql);
        Assert.Contains("\uE000semi; &quot; &name -- text", sql);
        Assert.Contains("SET DEFINE OFF", sql);
        Assert.Contains("N'\uE000'", sql);
        Assert.Contains(",NULL,", sql);
        Assert.Contains("SQLCODE != -942", sql);
        Assert.DoesNotContain("SQLCODE != -2106", sql);
        Assert.Contains("\"RowId\"", sql);
        Assert.DoesNotContain("\"Row_Id\"", sql);
    }

    [Fact]
    public void Dm8_preserves_native_text_maps_rowid_and_uses_to_clob()
    {
        var output = new StringWriter();

        var result = DatabaseSeedConverter.ConvertMySql57(
            new StringReader(SmallDump), output, SeedDatabaseTarget.Dm8);

        var sql = output.ToString();
        Assert.False(result.RequiresNonEmptyEnvelopeRuntime);
        Assert.Contains("RequiresNonEmptyEnvelopeRuntime=false", sql);
        Assert.DoesNotContain("\uE000", sql);
        Assert.Contains("N'one'", sql);
        Assert.Contains("N''", sql);
        Assert.Contains("TO_CLOB(N'')", sql);
        Assert.Contains("REPLACE(", sql);
        Assert.Contains("CHR(13)", sql);
        Assert.Contains("CHR(10)", sql);
        Assert.DoesNotContain("text\r\nV8.Result = false;", sql);
        Assert.DoesNotContain("\nV8.Result = false;\n", sql);
        Assert.DoesNotContain("TO_NCLOB", sql);
        Assert.Contains("SQLCODE != -2106", sql);
        Assert.DoesNotContain("SQLCODE != -942", sql);
        Assert.Contains("\"Row_Id\"", sql);
        Assert.DoesNotContain("\"RowId\"", sql);
    }

    [Fact]
    public void Dm8_restores_many_line_breaks_without_deep_concatenation()
    {
        var message = new StringBuilder();
        for (var index = 0; index < 2500; index++)
        {
            if (index > 0)
            {
                message.Append("\\n");
            }
            message.Append("V8.Result = false;");
        }
        var dump = "CREATE TABLE `scripts` (`Id` int(11) NOT NULL, `Body` longtext, "
            + "PRIMARY KEY (`Id`)); INSERT INTO `scripts` (`Id`,`Body`) VALUES "
            + "(1,'" + message + "');";
        var output = new StringWriter();

        DatabaseSeedConverter.ConvertMySql57(
            new StringReader(dump), output, SeedDatabaseTarget.Dm8);

        var sql = output.ToString();
        AssertNoPhysicalLineBreakInsideSqlLiteral(sql);
        Assert.InRange(Count(sql, "CHR(10)"), 1, 100);
        Assert.InRange(Count(sql, " || "), 1, 100);
    }

    [Fact]
    public void Sql_server_splits_insert_batches_at_one_thousand_rows()
    {
        var dump = new StringBuilder(
            "CREATE TABLE `items` (`Id` int(11) NOT NULL, PRIMARY KEY (`Id`));\n"
            + "INSERT INTO `items` (`Id`) VALUES\n");
        for (var i = 0; i < 1001; i++)
        {
            if (i > 0)
            {
                dump.Append(",\n");
            }
            dump.Append('(').Append(i).Append(')');
        }
        dump.Append(';');
        var output = new StringWriter();

        var result = DatabaseSeedConverter.ConvertMySql57(
            new StringReader(dump.ToString()),
            output,
            SeedDatabaseTarget.SqlServer2022);

        Assert.Equal(1001, result.RowCount);
        Assert.Equal(
            2,
            Count(output.ToString(), "INSERT INTO [dbo].[items] ([Id]) VALUES"));
    }

    [Fact]
    public void Unknown_statement_fails_instead_of_being_silently_dropped()
    {
        var error = Assert.Throws<SeedConversionException>(() =>
            DatabaseSeedConverter.ConvertMySql57(
                new StringReader("UPDATE `x` SET `a` = 1;"),
                new StringWriter(),
                SeedDatabaseTarget.PostgreSql17));

        Assert.Equal(1, error.StatementNumber);
        Assert.Contains("UPDATE", error.Message);
    }

    [Fact]
    public void Target_names_and_output_file_names_are_centralized_in_dos_orm()
    {
        Assert.Equal(
            SeedDatabaseTarget.KingbaseEs,
            DatabaseSeedConverter.ParseTarget("kingbase"));
        Assert.Equal(
            "microi_empty_postgresql17.sql",
            DatabaseSeedConverter.GetOutputFileName(
                SeedDatabaseTarget.PostgreSql17));
        Assert.Equal(5, DatabaseSeedConverter.SupportedTargets.Count);
        Assert.Equal(
            SeedDatabaseTarget.SqlServer2022,
            DatabaseSeedConverter.GetTarget(DatabaseType.SqlServer));
        Assert.Equal(
            SeedDatabaseTarget.SqlServer2022,
            DatabaseSeedConverter.GetTarget(DatabaseType.SqlServer9));
        Assert.Equal(
            SeedDatabaseTarget.PostgreSql17,
            DatabaseSeedConverter.GetTarget(DatabaseType.PostgreSql));
        Assert.Equal(
            SeedDatabaseTarget.Oracle19c,
            DatabaseSeedConverter.GetTarget(DatabaseType.Oracle));
        Assert.Equal(
            SeedDatabaseTarget.Dm8,
            DatabaseSeedConverter.GetTarget(DatabaseType.DaMeng));
        Assert.Equal(
            SeedDatabaseTarget.KingbaseEs,
            DatabaseSeedConverter.GetTarget(DatabaseType.KingBase));
        Assert.Throws<ArgumentException>(() =>
            DatabaseSeedConverter.GetTarget(DatabaseType.MySql));
    }

    [Fact]
    public void Execution_batches_are_target_owned_and_envelope_runtime_is_fail_closed()
    {
        var sqlServerOutput = new StringWriter();
        var sqlServerResult = DatabaseSeedConverter.ConvertMySql57(
            new StringReader(SmallDump),
            sqlServerOutput,
            SeedDatabaseTarget.SqlServer2022);

        var sqlServerBatches = DatabaseSeedConverter.GetExecutionBatches(
            sqlServerOutput.ToString(),
            sqlServerResult);

        Assert.True(sqlServerBatches.Count > 1);
        Assert.All(sqlServerBatches, batch =>
            Assert.DoesNotContain("\nGO\n", batch, StringComparison.OrdinalIgnoreCase));

        var postgresOutput = new StringWriter();
        var postgresResult = DatabaseSeedConverter.ConvertMySql57(
            new StringReader(SmallDump),
            postgresOutput,
            SeedDatabaseTarget.PostgreSql17);
        Assert.Single(DatabaseSeedConverter.GetExecutionBatches(
            postgresOutput.ToString(),
            postgresResult));

        var dmOutput = new StringWriter();
        var dmResult = DatabaseSeedConverter.ConvertMySql57(
            new StringReader(SmallDump),
            dmOutput,
            SeedDatabaseTarget.Dm8);
        var dmBatches = DatabaseSeedConverter.GetExecutionBatches(
            dmOutput.ToString(),
            dmResult);
        Assert.True(dmBatches.Count > 1);
        Assert.DoesNotContain(dmBatches, batch =>
            batch.Split('\n').Any(line => line.Trim() == "/"));
        Assert.DoesNotContain(dmBatches, batch =>
            batch.Contains("SET DEFINE OFF", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(dmBatches, batch =>
            batch.StartsWith("INSERT INTO", StringComparison.OrdinalIgnoreCase)
            && batch.Contains("semi; &quot; &name", StringComparison.Ordinal));

        var replay = DatabaseSeedConverter.GetDataReplaySql(
            dmOutput.ToString(),
            dmResult,
            new[] { "seed_parent" });
        Assert.Equal(3, Count(replay, "INSERT INTO \"seed_parent\""));
        Assert.DoesNotContain("CREATE TABLE", replay);
        Assert.DoesNotContain("DROP TABLE", replay);
    }

    private static int Count(string value, string text)
    {
        var count = 0;
        var start = 0;
        while ((start = value.IndexOf(text, start, StringComparison.Ordinal)) >= 0)
        {
            count++;
            start += text.Length;
        }
        return count;
    }

    private static void AssertNoPhysicalLineBreakInsideSqlLiteral(string sql)
    {
        var inLiteral = false;
        for (var index = 0; index < sql.Length; index++)
        {
            if (sql[index] == '\'' && inLiteral
                && index + 1 < sql.Length && sql[index + 1] == '\'')
            {
                index++;
                continue;
            }
            if (sql[index] == '\'')
            {
                inLiteral = !inLiteral;
                continue;
            }
            Assert.False(
                inLiteral && (sql[index] == '\r' || sql[index] == '\n'),
                "Generated SQL contains a physical line break inside a string literal.");
        }
        Assert.False(inLiteral, "Generated SQL contains an unterminated string literal.");
    }
}
