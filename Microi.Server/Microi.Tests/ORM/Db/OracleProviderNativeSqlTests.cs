using Dos.ORM.Oracle;
using Oracle.ManagedDataAccess.Client;

namespace Microi.Tests.ORM.Db;

public class OracleProviderNativeSqlTests
{
    public static TheoryData<string> NativeQueries => new()
    {
        "SELECT TO_CHAR(DATE '2026-09-09', 'YYYY-MM-DD') AS DATE_TEXT FROM DUAL",
        "SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') FROM DUAL",
        "SELECT to_char(1234.5, 'FM9,999.00') FROM DUAL",
        "SELECT TO_CHAR(1234.5, '9999D99', 'NLS_NUMERIC_CHARACTERS=''.,''') FROM DUAL",
        "SELECT TO_CHAR(42) FROM DUAL",
        "SELECT TO_CHAR(NVL(CREATED_AT, SYSDATE), 'YYYY-MM-DD') FROM SAMPLE_TABLE",
        "SELECT TO_CHAR (SYSDATE, 'YYYY-MM-DD'), To_Char(SYSDATE, 'HH24:MI') FROM DUAL",
        "SELECT 'to_char(keep, literal)' AS NOTE FROM DUAL /* TO_CHAR(a, b) */",
        "SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD') FROM DUAL -- TO_CHAR(a, b)"
    };

    [Theory]
    [MemberData(nameof(NativeQueries))]
    public void PrepareCommand_PreservesNativeOracleToChar_AndIsIdempotent(string sql)
    {
        var provider = new OracleProvider("Data Source=unused;User Id=unused;Password=unused;");
        using var command = new OracleCommand(sql);
        provider.PrepareCommand(command);
        Assert.Equal(sql, command.CommandText);
        provider.PrepareCommand(command);
        Assert.Equal(sql, command.CommandText);
    }

    [Fact]
    public void PrepareCommand_PreservesNativeToCharParameterOrderAndTypes()
    {
        var provider = new OracleProvider("Data Source=unused;User Id=unused;Password=unused;");
        using var command = new OracleCommand("SELECT TO_CHAR(:p0, :p1) FROM DUAL");
        command.Parameters.Add(new OracleParameter(":p0", OracleDbType.Date) { Value = new DateTime(2026, 9, 9) });
        command.Parameters.Add(new OracleParameter(":p1", OracleDbType.Varchar2) { Value = "YYYY-MM-DD" });
        provider.PrepareCommand(command);
        Assert.Equal("SELECT TO_CHAR(:p0, :p1) FROM DUAL", command.CommandText.TrimEnd());
        Assert.Equal(OracleDbType.Date, command.Parameters[0].OracleDbType);
        Assert.Equal(new DateTime(2026, 9, 9), command.Parameters[0].Value);
        Assert.Equal(OracleDbType.Varchar2, command.Parameters[1].OracleDbType);
        Assert.Equal("YYYY-MM-DD", command.Parameters[1].Value);
    }
}
