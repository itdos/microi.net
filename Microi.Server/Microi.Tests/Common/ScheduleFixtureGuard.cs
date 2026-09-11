using System.Text.RegularExpressions;
using MySql.Data.MySqlClient;
using StackExchange.Redis;

namespace Microi.Tests.Common;

/// <summary>并行 Full 可以使用自己的本地端口；非默认端口必须由数据库与缓存共同证明夹具归属。</summary>
internal static class ScheduleFixtureGuard
{
    internal static int ValidateRedisEndpoint(string address)
    {
        var match = Regex.Match(address, @"^127\.0\.0\.1:([0-9]{4,5})$");
        Assert.True(match.Success, "Full 调度 Redis 只允许单一本地回环地址。");
        var port = int.Parse(match.Groups[1].Value);
        Assert.InRange(port, 1024, 65535);
        return port;
    }

    internal static string ValidateFixtureId(string? value)
    {
        Assert.Matches(@"^[A-Za-z0-9][A-Za-z0-9_-]{15,79}$", value ?? "");
        return value!;
    }

    internal static async Task VerifyRedisOwnerAsync(string address, IDatabase database)
    {
        if (ValidateRedisEndpoint(address) == 62681) return;
        var expected = ValidateFixtureId(Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_FIXTURE_ID"));
        var actual = await database.StringGetAsync("Microi:Full:ScheduleFixture");
        Assert.Equal(expected, actual.ToString());
    }

    internal static async Task VerifyMySqlOwnerAsync(MySqlConnectionStringBuilder settings)
    {
        Assert.Equal("127.0.0.1", settings.Server);
        Assert.Equal("schedule_gate", settings.Database);
        Assert.InRange(settings.Port, 1024u, 65535u);
        if (settings.Port == 62680) return;
        var expected = ValidateFixtureId(Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_FIXTURE_ID"));
        await using var connection = new MySqlConnection(settings.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        using var command = new MySqlCommand("SELECT FixtureId FROM microi_schedule_fixture WHERE Id=1", connection);
        var actual = Convert.ToString(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken));
        Assert.Equal(expected, actual);
    }
}
