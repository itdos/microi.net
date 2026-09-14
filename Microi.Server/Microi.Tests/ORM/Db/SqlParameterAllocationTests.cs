using System.Data;
using System.Data.Common;
using System.Reflection;
using Dos.ORM.Oracle;
using Microi.net;
using Oracle.ManagedDataAccess.Client;

namespace Microi.Tests.ORM.Db;

public class SqlParameterAllocationTests
{
    private static string Render(string sql, DbParameter[] parameters, int limit = 0) =>
        (string)typeof(FormEngine).GetMethod("BuildExecutableSql", BindingFlags.NonPublic | BindingFlags.Static)!
            .Invoke(null, new object[] { sql, parameters, limit })!;

    [Fact]
    public void LargeInQuery_PreparationAndPrintSqlStayWithinLinearAllocationBudget()
    {
        var provider = new OracleProvider("Data Source=unused;User Id=unused;Password=unused;");
        using var command = new OracleCommand("SELECT * FROM menu WHERE Id IN (" +
            string.Join(",", Enumerable.Range(0, 3000).Select(i => "@p" + i)) + ")");
        foreach (var i in Enumerable.Range(0, 3000))
            command.Parameters.Add(new OracleParameter(":p" + i, "menu-" + i));
        using var warmup = new OracleCommand("SELECT :p FROM DUAL");
        warmup.Parameters.Add(new OracleParameter(":p", "warmup"));
        provider.PrepareCommand(warmup);
        var before = GC.GetAllocatedBytesForCurrentThread();
        provider.PrepareCommand(command);
        var prepareBytes = GC.GetAllocatedBytesForCurrentThread() - before;
        Assert.True(prepareBytes < 12_000_000, $"PrepareCommand allocated {prepareBytes:N0} bytes for 3000 parameters");
        var parameters = command.Parameters.Cast<DbParameter>().ToArray();
        Render("SELECT :p", new DbParameter[] { new OracleParameter(":p", "warmup") });
        before = GC.GetAllocatedBytesForCurrentThread();
        var sql = Render(command.CommandText, parameters);
        var renderBytes = GC.GetAllocatedBytesForCurrentThread() - before;
        Assert.True(renderBytes < 12_000_000, $"PrintSqlToPage allocated {renderBytes:N0} bytes for 3000 parameters");
        Assert.Contains("'menu-0','menu-1'", sql);
        Assert.EndsWith("'menu-2999')", sql);
        Assert.DoesNotContain(":p", sql);
    }

    [Fact]
    public void ParameterText_DoesNotTouchLiteralsCommentsIdentifiersOrParameterValues()
    {
        const string original = "SELECT @p, @p1, @p10, @p_other, '@p', \"@p\", [@p], `@p`, @@p, 1::p /* @p */ -- @p\nFROM T WHERE x=?p AND y=:p";
        using var command = new OracleCommand(original);
        command.Parameters.Add(new OracleParameter(":p", "literal @p1 O'Brien"));
        command.Parameters.Add(new OracleParameter(":p1", 1));
        command.Parameters.Add(new OracleParameter(":p10", 10));
        var provider = new OracleProvider("Data Source=unused;User Id=unused;Password=unused;");
        provider.PrepareCommand(command);
        Assert.StartsWith("SELECT :p, :p1, :p10, @p_other, '@p'", command.CommandText);
        Assert.Contains("@@p, 1::p /* @p */ -- @p", command.CommandText);
        var prepared = command.CommandText;
        provider.PrepareCommand(command);
        Assert.Equal(prepared, command.CommandText);
        var rendered = Render(original, command.Parameters.Cast<DbParameter>().ToArray());
        Assert.StartsWith("SELECT 'literal @p1 O''Brien', 1, 10, @p_other, '@p'", rendered);
        Assert.Contains("\"@p\", [@p], `@p`, @@p, 1::p /* @p */ -- @p", rendered);
    }

    [Fact]
    public void PrintSql_RemainsCompleteAndSlowLogTruncatesWithoutRewritingValues()
    {
        var parameters = new DbParameter[] { new OracleParameter(":p", new string('x', 20000)), new OracleParameter(":n", DBNull.Value) };
        var full = Render("SELECT :p, :n", parameters);
        Assert.Equal("SELECT '" + new string('x', 20000) + "', NULL", full);
        Assert.Equal(full[..40] + "...", Render("SELECT :p, :n", parameters, 40));
        Assert.Equal("SELECT NULL", Render("SELECT :n", parameters));
    }

    [Fact]
    public void ParameterText_RespectsProviderSpecificQuotesAndHashCharacters()
    {
        // Oracle / SQL Server 的反斜杠不是字符串转义；# 也不是它们的行注释。
        var standard = new DbParameter[] { new OracleParameter(":p", 7) };
        Assert.Equal(@"SELECT 'C:\', 7 FROM #Temp WHERE Id=7", Render(@"SELECT 'C:\', @p FROM #Temp WHERE Id=:p", standard));
        var mysql = new DbParameter[] { new MySql.Data.MySqlClient.MySqlParameter("@p", 7) };
        Assert.Equal(@"SELECT 'can\'t @p', 7 # @p" + "\n,7", Render(@"SELECT 'can\'t @p', @p # @p" + "\n,@p", mysql));
        Assert.Equal("SELECT 1--2 + 7", Render("SELECT 1--2 + @p", mysql));
    }

    [Fact]
    public void StoredProcedure_KeepsCommandNameAndNormalizesNullValues()
    {
        var provider = new OracleProvider("Data Source=unused;User Id=unused;Password=unused;");
        using var command = new OracleCommand("some_procedure") { CommandType = CommandType.StoredProcedure };
        command.Parameters.Add(new OracleParameter(":p", OracleDbType.Varchar2) { Value = null });
        provider.PrepareCommand(command);
        Assert.Equal("some_procedure", command.CommandText);
        Assert.Equal(DBNull.Value, command.Parameters[0].Value);
    }
}
