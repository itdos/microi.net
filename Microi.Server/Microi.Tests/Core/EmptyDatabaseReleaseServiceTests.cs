using System.Reflection;
using Microi.net;
using MySql.Data.MySqlClient;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Core;

public sealed class EmptyDatabaseReleaseServiceTests
{
    [Fact]
    public void CollectPackageTableNames_FindsNestedTablesAndRejectsUnsafeNames()
    {
        var package = JToken.Parse("""
        {
          "DDLStatements": [
            { "TableName": "app_order", "DDL": "CREATE TABLE IF NOT EXISTS `app_order_item` (`Id` varchar(36));" }
          ],
          "DiyTables": [
            { "Name": "LegacyBusiness" },
            { "Name": "bad-name;DROP TABLE sys_user" }
          ],
          "ApplicationBundles": [
            { "Infrastructure": { "PhysicalColumns": [ { "TableName": "shared_runtime" } ] } }
          ]
        }
        """);
        var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var method = typeof(EmptyDatabaseReleaseService).GetMethod(
            "CollectPackageTableNames",
            BindingFlags.NonPublic | BindingFlags.Static);

        Assert.NotNull(method);
        method!.Invoke(null, new object[] { package, tables });

        Assert.Equal(
            new[] { "app_order", "app_order_item", "LegacyBusiness", "shared_runtime" },
            tables.OrderBy(value => value, StringComparer.OrdinalIgnoreCase));
        Assert.DoesNotContain(tables, value => value.Contains(';'));
    }

    [Theory]
    [InlineData("USE itdos; DELETE FROM sys_log;")]
    [InlineData("DROP DATABASE microi_empty_temp;")]
    [InlineData("DELETE FROM itdos.sys_user;")]
    [InlineData("DELETE FROM `itdos`.sys_user;")]
    public void ValidateSanitizationSql_RejectsDatabaseEscape(string sql)
    {
        var exception = Assert.Throws<TargetInvocationException>(() =>
            InvokePrivateStatic("ValidateSanitizationSql", sql));

        var inner = Assert.IsType<InvalidOperationException>(exception.InnerException);
        Assert.Contains("只能操作固定目标库", inner.Message);
    }

    [Fact]
    public void ValidateSanitizationSql_IgnoresForbiddenWordsInsideCommentsAndLiterals()
    {
        const string sql = """
            -- USE itdos is documentation only
            /* DROP DATABASE microi_empty_temp; */
            UPDATE sys_config SET Remark='itdos.sys_user is an example';
            """;

        InvokePrivateStatic("ValidateSanitizationSql", sql);
    }

    [Fact]
    public void ValidateSanitizationSql_RejectsEmptyAndOversizedPayloads()
    {
        var emptyException = Assert.Throws<TargetInvocationException>(() =>
            InvokePrivateStatic("ValidateSanitizationSql", "  "));
        Assert.Contains("内容为空", Assert.IsType<InvalidOperationException>(emptyException.InnerException).Message);

        var oversized = new string('x', 2 * 1024 * 1024 + 1);
        var oversizedException = Assert.Throws<TargetInvocationException>(() =>
            InvokePrivateStatic("ValidateSanitizationSql", oversized));
        Assert.Contains("超过 2MB", Assert.IsType<InvalidOperationException>(oversizedException.InnerException).Message);
    }

    [Fact]
    public void ReleaseTargets_AreFixedAndCannotComeFromRuntimeInput()
    {
        Assert.Equal("admin_build_sanitized_empty_database", EmptyDatabaseReleaseService.WorkerApiEngineKey);
        Assert.Equal("iTdos", ReadPrivateConstant("RequiredOsClient"));
        Assert.Equal("itdos", ReadPrivateConstant("RequiredSourceDatabase"));
        Assert.Equal("microi_empty_temp", ReadPrivateConstant("TargetDatabase"));
        Assert.Equal("microi_empty_mysql57.sql", ReadPrivateConstant("SqlFileName"));
        Assert.Equal("/install/", ReadPrivateConstant("PublicObjectDirectory"));
        Assert.Equal("https://static.itdos.com/install/", ReadPrivateConstant("PublicDownloadBaseUrl"));
        Assert.Equal(3, ReadPrivateIntConstant("TableOperationMaxAttempts"));
    }

    [Fact]
    public void DescribeExceptionChain_PreservesNestedTransportCause()
    {
        var exception = new InvalidOperationException(
            "Fatal error encountered during command execution",
            new IOException("Unable to read data from the transport connection"));

        var result = Assert.IsType<string>(InvokePrivateStatic("DescribeExceptionChain", exception));

        Assert.Contains("InvalidOperationException: Fatal error encountered during command execution", result);
        Assert.Contains("IOException: Unable to read data from the transport connection", result);
    }

    [Fact]
    public void IsTransientDatabaseFailure_DetectsTransportErrorsOnly()
    {
        var transient = new InvalidOperationException(
            "Fatal error encountered during command execution",
            new IOException("Unable to read data from the transport connection"));
        var validation = new InvalidOperationException("单表原子复制计数不一致");

        Assert.True(Assert.IsType<bool>(InvokePrivateStatic("IsTransientDatabaseFailure", transient)));
        Assert.False(Assert.IsType<bool>(InvokePrivateStatic("IsTransientDatabaseFailure", validation)));
    }

    [Fact]
    public void BuildSourceConnectionStringBuilder_NormalizesLegacySslModeNone()
    {
        var result = InvokePrivateStatic(
            "BuildSourceConnectionStringBuilder",
            "Server=localhost;Database=itdos;User Id=test;Password=test;SslMode=None;");

        var builder = Assert.IsType<MySqlConnectionStringBuilder>(result);
        Assert.Equal(MySqlSslMode.Disabled, builder.SslMode);
        Assert.True(builder.AllowUserVariables);
        Assert.Equal("itdos", builder.Database);
    }

    private static object? InvokePrivateStatic(string name, params object[] args)
    {
        var method = typeof(EmptyDatabaseReleaseService).GetMethod(
            name,
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return method!.Invoke(null, args);
    }

    private static string ReadPrivateConstant(string name)
    {
        var field = typeof(EmptyDatabaseReleaseService).GetField(
            name,
            BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Static);
        Assert.NotNull(field);
        return Assert.IsType<string>(field!.GetRawConstantValue());
    }

    private static int ReadPrivateIntConstant(string name)
    {
        var field = typeof(EmptyDatabaseReleaseService).GetField(
            name,
            BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Static);
        Assert.NotNull(field);
        return Assert.IsType<int>(field!.GetRawConstantValue());
    }
}
