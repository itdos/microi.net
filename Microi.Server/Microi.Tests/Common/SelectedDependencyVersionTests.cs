using System.Text.Json;
using MySql.Data.MySqlClient;
using StackExchange.Redis;

namespace Microi.Tests.Common;

[Trait("Category", "FullStack")]
public sealed class SelectedDependencyVersionTests
{
    private static JsonDocument Matrix() => JsonDocument.Parse(File.ReadAllText(
        Environment.GetEnvironmentVariable("MICROI_TEST_MATRIX_FILE")
        ?? throw new InvalidOperationException("Full 需要冻结的依赖矩阵文件。")));

    [Fact]
    public async Task MySqlAndRedisMatchTheFrozenMcpDependencyVersions()
    {
        using var matrix = Matrix();
        var dependencies = matrix.RootElement.GetProperty("dependencies");
        var connection = new MySqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MICROI_UPGRADE_TEST_CONN"));
        Assert.Contains(connection.Server, new[] { "127.0.0.1", "localhost" });
        Assert.Equal("upgrade_fixture", connection.Database);
        using var mysql = new MySqlConnection(connection.ConnectionString);
        await mysql.OpenAsync(TestContext.Current.CancellationToken);
        using var query = new MySqlCommand("SELECT VERSION()", mysql);
        Assert.Equal(dependencies.GetProperty("mysql").GetProperty("version").GetString(),
            Convert.ToString(await query.ExecuteScalarAsync(TestContext.Current.CancellationToken)));

        var address = Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_REDIS")!;
        ScheduleFixtureGuard.ValidateRedisEndpoint(address);
        var options = ConfigurationOptions.Parse(address);
        // INFO 只读，但客户端将其归类为管理命令；运输代理继续禁止管理写入及越界 SELECT。
        options.AllowAdmin = true;
        using var redis = await ConnectionMultiplexer.ConnectAsync(options);
        await ScheduleFixtureGuard.VerifyRedisOwnerAsync(address, redis.GetDatabase());
        var server = redis.GetServer(redis.GetEndPoints().Single());
        var information = await server.InfoAsync("server");
        var actualVersion = information.SelectMany(group => group).Single(pair => pair.Key == "redis_version").Value;
        Assert.Equal(dependencies.GetProperty("redis").GetProperty("version").GetString(), actualVersion);
    }

    [Fact]
    [Trait("DatabaseProvider", "SqlServer")]
    public async Task SqlServerMatchesItsExplicitlySelectedVersion()
    {
        using var matrix = Matrix();
        var expected = matrix.RootElement.GetProperty("dependencies").GetProperty("sqlServer").GetProperty("version").GetString();
        var settings = new System.Data.SqlClient.SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));
        Assert.Matches(@"^127\.0\.0\.1,\d{1,5}$", settings.DataSource);
        Assert.Equal("upgrade_fixture", settings.InitialCatalog);
        using var connection = new System.Data.SqlClient.SqlConnection(settings.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        using var query = new System.Data.SqlClient.SqlCommand("SELECT CONVERT(varchar(50), SERVERPROPERTY('ProductVersion'))", connection);
        Assert.Equal(expected, Convert.ToString(await query.ExecuteScalarAsync(TestContext.Current.CancellationToken)));
    }
}
