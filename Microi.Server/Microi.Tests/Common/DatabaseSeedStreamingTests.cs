using System.IO;
using System.Linq;
using Dos.ORM.SeedConversion;

namespace Microi.Tests.Common;

public sealed class DatabaseSeedStreamingTests
{
    [Fact]
    public void StreamingReader_SplitsStatementsWithoutBreakingQuotedSemicolons()
    {
        const string sql = "SET NAMES utf8mb4;\n"
                           + "INSERT INTO `demo` VALUES ('a;b', \"c;d\", `semi;column`);\n"
                           + "-- comment; stays with the next statement\n"
                           + "UPDATE `demo` SET `value`='it\\'s;safe';";

        var statements = DatabaseSeedImporter
            .ReadMySqlStatements(new StringReader(sql))
            .ToArray();

        Assert.Equal(3, statements.Length);
        Assert.Equal("SET NAMES utf8mb4", statements[0]);
        Assert.Contains("'a;b'", statements[1]);
        Assert.Contains("comment; stays", statements[2]);
        Assert.Contains("'it\\'s;safe'", statements[2]);
    }

    [Fact]
    public void StreamingReader_HonorsDelimiterDirectivesAndComments()
    {
        const string sql = "DELIMITER $$\n"
                           + "CREATE PROCEDURE p()\n"
                           + "BEGIN\n"
                           + "  SELECT 'inside;value'; /* block; comment */\n"
                           + "END$$\n"
                           + "DELIMITER ;\n"
                           + "SELECT 2; # trailing; comment\n";

        var statements = DatabaseSeedImporter
            .ReadMySqlStatements(new StringReader(sql))
            .ToArray();

        Assert.Equal(2, statements.Length);
        Assert.Contains("CREATE PROCEDURE p()", statements[0]);
        Assert.Contains("SELECT 'inside;value';", statements[0]);
        Assert.StartsWith("SELECT 2", statements[1]);
    }

    [Fact]
    public void StreamingReader_RejectsOversizedSingleStatement()
    {
        using var reader = new StringReader("SELECT '123456789';");
        var error = Assert.Throws<InvalidDataException>(() =>
            DatabaseSeedImporter.ReadMySqlStatements(reader, 8).ToArray());

        Assert.Contains("单条 SQL", error.Message);
    }

    [Fact]
    public void ExecutionBatches_GroupOnlyBoundedInsertAndReplaceStatements()
    {
        var statements = new[]
        {
            "CREATE TABLE `demo` (`Id` int)",
            "INSERT INTO `demo` VALUES (1)",
            "INSERT INTO `demo` VALUES (2)",
            "REPLACE INTO `demo` VALUES (3)",
            "REPLACE INTO `demo` VALUES (4)",
            "SET FOREIGN_KEY_CHECKS = 1"
        };

        var batches = DatabaseSeedImporter
            .BuildMySqlExecutionBatches(statements, 1024, 500)
            .ToArray();

        Assert.Collection(
            batches,
            item =>
            {
                Assert.False(item.Batched);
                Assert.Equal("CREATE", item.StatementKind);
                Assert.Equal(1, item.StatementCount);
            },
            item =>
            {
                Assert.True(item.Batched);
                Assert.Equal("INSERT", item.StatementKind);
                Assert.Equal(2, item.StatementCount);
                Assert.Contains("VALUES (1);", item.Sql);
                Assert.Contains("VALUES (2);", item.Sql);
            },
            item =>
            {
                Assert.True(item.Batched);
                Assert.Equal("REPLACE", item.StatementKind);
                Assert.Equal(2, item.StatementCount);
            },
            item =>
            {
                Assert.False(item.Batched);
                Assert.Equal("SET", item.StatementKind);
                Assert.Equal(1, item.StatementCount);
            });
    }

    [Fact]
    public void ExecutionBatches_RespectStatementAndCharacterLimits()
    {
        var statements = Enumerable.Range(1, 7)
            .Select(index => "-- row " + index + "\nINSERT INTO `demo` VALUES (" + index + ")");

        var batches = DatabaseSeedImporter
            .BuildMySqlExecutionBatches(statements, 140, 3)
            .ToArray();

        Assert.Equal(3, batches.Length);
        Assert.Equal(new[] { 3, 3, 1 }, batches.Select(item => item.StatementCount));
        Assert.All(batches, item => Assert.InRange(item.Sql.Length, 1, 140));
        Assert.All(batches, item => Assert.Equal("INSERT", item.StatementKind));
    }

    [Theory]
    [InlineData("START TRANSACTION", SeedImportSessionControl.BeginTransaction)]
    [InlineData("BEGIN", SeedImportSessionControl.BeginTransaction)]
    [InlineData("COMMIT", SeedImportSessionControl.CommitOrRollback)]
    [InlineData("ROLLBACK", SeedImportSessionControl.CommitOrRollback)]
    [InlineData("SET @@SESSION.autocommit = 0", SeedImportSessionControl.DisableAutocommit)]
    [InlineData("SET AUTOCOMMIT = ON", SeedImportSessionControl.EnableAutocommit)]
    [InlineData("/*!40101 SET AUTOCOMMIT=0 */", SeedImportSessionControl.DisableAutocommit)]
    [InlineData("LOCK TABLES `demo` WRITE", SeedImportSessionControl.LockTables)]
    [InlineData("UNLOCK TABLES", SeedImportSessionControl.UnlockTables)]
    [InlineData("START REPLICA", SeedImportSessionControl.None)]
    [InlineData("ROLLBACK TO SAVEPOINT before_row", SeedImportSessionControl.None)]
    [InlineData("LOCK INSTANCE FOR BACKUP", SeedImportSessionControl.None)]
    [InlineData("SET FOREIGN_KEY_CHECKS=0", SeedImportSessionControl.None)]
    [InlineData("CREATE PROCEDURE p() BEGIN COMMIT; END", SeedImportSessionControl.None)]
    public void SessionControlClassifier_DetectsOnlyTopLevelTransactionBoundaries(
        string sql,
        SeedImportSessionControl expected)
    {
        Assert.Equal(expected, DatabaseSeedImporter.ClassifyMySqlSessionControl(sql));
    }
}
