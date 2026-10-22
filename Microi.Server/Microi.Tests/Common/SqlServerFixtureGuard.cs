using System.Data.SqlClient;

namespace Microi.Tests.Common;

/// <summary>执行隔离 SQL Server 用例前，核验精确库名和数据库内持久所有者。</summary>
internal static class SqlServerFixtureGuard
{
    internal static void Verify(SqlConnectionStringBuilder settings)
    {
        var owner = ValidateTarget(settings.InitialCatalog,
            Environment.GetEnvironmentVariable("MICROI_TEST_SQLSERVER_DATABASE"),
            Environment.GetEnvironmentVariable("MICROI_TEST_SQLSERVER_FIXTURE_ID"));
        if (owner == null)
        {
            // 未登记所有者的历史兼容夹具仍只允许本机端口，不能扩大到共享服务。
            Assert.Matches(@"^127\.0\.0\.1,\d{1,5}$", settings.DataSource);
            return;
        }

        // 只读检查先于任何 CREATE DATABASE；不能补造或改写既有夹具归属标记。
        using var connection = new SqlConnection(settings.ConnectionString);
        connection.Open();
        using var command = new SqlCommand("SELECT FixtureId FROM dbo.microi_sqlserver_fixture WHERE Id=1", connection);
        Assert.Equal(owner, Convert.ToString(command.ExecuteScalar()));
        command.CommandText = "SELECT CONVERT(varchar(64), SERVERPROPERTY('ProductVersion'))";
        var version = Convert.ToString(command.ExecuteScalar());
        TestContext.Current.TestOutputHelper?.WriteLine($"SQLServerFixtureVerified Database={settings.InitialCatalog}; FixtureId={owner}; ProductVersion={version}; MarkerReadOnly=true");
    }

    internal static string? ValidateTarget(string database, string? configuredDatabase, string? configuredOwner)
    {
        if (string.IsNullOrEmpty(configuredDatabase))
        {
            Assert.Equal("upgrade_fixture", database);
            Assert.True(string.IsNullOrEmpty(configuredOwner), "夹具精确库名和所有者必须同时配置");
            return null;
        }

        // 共享 SQL Server 可承载已登记的独立测试库，不要求占用另一个任务的固定库。
        Assert.Matches("^microi_test_sqlserver_[a-z0-9_]{8,40}$", configuredDatabase);
        Assert.Equal(configuredDatabase, database);
        return ScheduleFixtureGuard.ValidateFixtureId(configuredOwner);
    }
}
