using System.Text.RegularExpressions;
using MySql.Data.MySqlClient;

namespace Microi.Tests.Common;

/// <summary>共享服务上的夹具按显式库名和持久所有者隔离，不能因旧固定库名冲突另建服务。</summary>
internal static class MySqlFixtureGuard
{
    internal static string? ValidateTarget(MySqlConnectionStringBuilder settings, string scope,
        string? expectedDatabase, string? expectedOwner, bool allowLegacyXqc = false)
    {
        // 保留现有测试运输边界：远端 MCP 服务可通过已登记的本地连接映射复用。
        Assert.Contains(settings.Server, new[] { "127.0.0.1", "localhost" });
        Assert.InRange(settings.Port, 1024u, 65535u);
        Assert.Contains(scope, new[] { "upgrade", "schedule" });
        if (string.IsNullOrEmpty(expectedDatabase))
        {
            var legacy = scope == "schedule" ? "schedule_gate" : "upgrade_fixture";
            Assert.True(settings.Database == legacy || allowLegacyXqc && scope == "upgrade" && settings.Database == "xqc_verify",
                "非默认夹具必须显式配置精确库名和所有者。");
            Assert.True(string.IsNullOrEmpty(expectedOwner), "夹具所有者与精确库名必须一同配置。");
            return null;
        }
        Assert.Matches("^microi_test_" + scope + "_[a-z0-9_]{8,40}$", expectedDatabase);
        Assert.Equal(expectedDatabase, settings.Database);
        return ScheduleFixtureGuard.ValidateFixtureId(expectedOwner);
    }

    internal static void VerifyOwner(string expected, Func<string?> readOwner)
    {
        // 仅做只读核验；不存在、归属不同、读取失败均在任何 DDL 前终止，绝不改写标记。
        Assert.Equal(expected, readOwner());
    }

    internal static void VerifyUpgrade(string connectionString, bool allowLegacyXqc = false)
    {
        var settings = new MySqlConnectionStringBuilder(connectionString);
        var expected = ValidateTarget(settings, "upgrade",
            Environment.GetEnvironmentVariable("MICROI_TEST_UPGRADE_DATABASE"),
            Environment.GetEnvironmentVariable("MICROI_TEST_UPGRADE_FIXTURE_ID"), allowLegacyXqc);
        if (expected == null) return;
        using var connection = new MySqlConnection(settings.ConnectionString);
        connection.Open();
        VerifyOwner(expected, () =>
        {
            using var command = new MySqlCommand("SELECT FixtureId FROM microi_upgrade_fixture WHERE Id=1", connection);
            return Convert.ToString(command.ExecuteScalar());
        });
    }
}
