using Dos.ORM;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class DatabaseBackupControlTests
{
    [Fact]
    public void Runtime_environment_match_requires_both_type_and_network()
    {
        var model = new JObject
        {
            ["OsClientType"] = "Product",
            ["OsClientNetwork"] = "Internal"
        };

        Assert.True(DatabaseBackupControlService.MatchesRuntimeEnvironment(
            model, "product", "internal"));
        Assert.False(DatabaseBackupControlService.MatchesRuntimeEnvironment(
            model, "Dev", "Internal"));
        Assert.False(DatabaseBackupControlService.MatchesRuntimeEnvironment(
            model, "Product", "External"));
    }

    [Fact]
    public void Eligible_backup_catalog_uses_the_exact_runtime_row_when_osclient_is_duplicated()
    {
        var rows = new[]
        {
            new JObject
            {
                ["OsClient"] = "iTdos",
                ["ClientName"] = "外网主租户",
                ["IsEnable"] = 1,
                ["IsDeleted"] = 0,
                ["OsClientType"] = "Product",
                ["OsClientNetwork"] = "Internet",
                ["DbType"] = "MySql",
                ["DbConn"] = "Server=internet-db;Database=wrong;Uid=root;Pwd=test;SslMode=None;"
            },
            new JObject
            {
                ["OsClient"] = "iTdos",
                ["ClientName"] = "内网主租户",
                ["IsEnable"] = 1,
                ["IsDeleted"] = 0,
                ["OsClientType"] = "Product",
                ["OsClientNetwork"] = "Internal",
                ["DbType"] = "MySql"
            }
        };

        var result = DatabaseBackupControlService.BuildEligibleTenantConnections(
            rows,
            "Product",
            "Internal",
            "iTdos",
            "Server=internal-db;Database=microi;Uid=root;Pwd=test;SslMode=None;");

        var tenant = Assert.Single(result);
        Assert.Equal("iTdos", tenant.OsClient);
        Assert.Equal("内网主租户", tenant.Name);
        Assert.Contains("internal-db", tenant.ConnectionString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("internet-db", tenant.ConnectionString, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Historical_mysql_sslmode_none_is_normalized_before_provider_parsing()
    {
        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.MySql,
            "Server=127.0.0.1;Database=microi;Uid=root;Pwd=test;SslMode=None;",
            100,
            120,
            600);

        Assert.Contains("SslMode=Disabled", normalized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SslMode=None", normalized, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Scheduled_backup_key_uses_fire_time_not_node_local_fire_instance()
    {
        var nodeA = new JObject
        {
            ["ScheduledFireTime"] = "2026-08-01T00:00:00.123Z",
            ["JobRunId"] = "node-a-fire-instance"
        };
        var nodeB = new JObject
        {
            ["FireTime"] = "2026-08-01T08:00:00.123+08:00",
            ["JobRunId"] = "node-b-fire-instance"
        };

        var keyA = DatabaseBackupControlService.BuildScheduledRunKey(nodeA);
        var keyB = DatabaseBackupControlService.BuildScheduledRunKey(nodeB);

        Assert.Equal("20260801000000123", keyA);
        Assert.Equal(keyA, keyB);
    }

    [Theory]
    [InlineData("0 0 * * * ?")]
    [InlineData("0 30 2 * * ?")]
    [InlineData("0 15 0 ? * MON")]
    public void Backup_cron_accepts_only_schedules_with_a_fixed_minute(string cron)
    {
        Assert.Equal(1, DatabaseBackupControlService.ValidateMinimumCronInterval(cron).Code);
    }

    [Theory]
    [InlineData("*/10 * * * * ?")]
    [InlineData("0 */5 * * * ?")]
    [InlineData("0 0,30 * * * ?")]
    [InlineData("0 0-59 * * * ?")]
    public void Backup_cron_rejects_sub_hour_or_ambiguous_schedules(string cron)
    {
        var result = DatabaseBackupControlService.ValidateMinimumCronInterval(cron);

        Assert.Equal(0, result.Code);
        Assert.Contains("最短执行间隔为 1 小时", result.Msg);
    }

    [Fact]
    public void Upgrade_seeds_the_fixed_backup_job_paused_with_safe_all_runtime_scope()
    {
        var settings = Upgrade24.BuildDefaultScheduleSettings();

        Assert.True(new Version(Upgrade24.Version) > new Version("6.9.4.0"));
        Assert.Equal("暂停", Upgrade24.DefaultScheduleStatus);
        Assert.False(settings["Enabled"]!.Value<bool>());
        Assert.True(settings["BackupAllEligible"]!.Value<bool>());
        Assert.Empty((JArray)settings["TenantOsClients"]!);
        Assert.Equal("AllEligibleInRuntime", settings["BackupScope"]!.Value<string>());
    }

    [Fact]
    public void Backup_record_and_attempt_object_keys_are_stable_per_task_and_fence()
    {
        const string taskId = "852ae94e1be343b5868758e0a2f81178";

        Assert.Equal(taskId, DatabaseBackupService.BuildStableRecordId(taskId));
        Assert.Equal(
            "/database-backups/tasks/852ae94e1be343b5868758e0a2f81178/attempt-0000000007.zip",
            DatabaseBackupService.BuildAttemptHdfsPath(taskId, 7));
        Assert.NotEqual(
            DatabaseBackupService.BuildAttemptHdfsPath(taskId, 7),
            DatabaseBackupService.BuildAttemptHdfsPath(taskId, 8));
    }

    [Theory]
    [InlineData(true, "1")]
    [InlineData(false, "0")]
    [InlineData((byte)7, "7")]
    [InlineData((ushort)513, "513")]
    [InlineData((ulong)18446744073709551615, "18446744073709551615")]
    public void Mysql_bit_values_are_serialized_as_literals_without_using_a_binary_stream(
        object value,
        string expected)
    {
        Assert.Equal(expected, DatabaseBackupService.FormatBitLiteral(value));
    }

    [Fact]
    public void Mysql_bit_byte_array_preserves_the_exact_bit_pattern()
    {
        Assert.Equal("0x0102FF", DatabaseBackupService.FormatBitLiteral(new byte[] { 0x01, 0x02, 0xFF }));
    }
}
