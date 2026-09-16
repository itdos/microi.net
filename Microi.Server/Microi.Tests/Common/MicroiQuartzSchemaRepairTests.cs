using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MySql.Data.MySqlClient;

namespace Microi.Tests.Common;

/// <summary>Quartz 3.19 MySQL 方言依赖 IDX_{prefix}T_NFT_ST 索引；缺失时租户任务永不执行。</summary>
public class MicroiQuartzSchemaRepairTests
{
    [Fact]
    public void Missing_indexes_produce_the_two_quartz_required_ddl_statements()
    {
        var statements = MicroiQuartzSchemaRepair.BuildMySqlRepairStatements(
            MicroiQuartzSchemaRepair.DefaultTablePrefix,
            Array.Empty<string>());

        Assert.Equal(2, statements.Count);
        Assert.Contains("CREATE INDEX IDX_microi_job_T_NFT_ST ON microi_job_triggers (SCHED_NAME, NEXT_FIRE_TIME, TRIGGER_STATE)", statements);
        Assert.Contains("CREATE INDEX IDX_microi_job_T_NFT_ST_MISFIRE ON microi_job_triggers (SCHED_NAME, NEXT_FIRE_TIME, MISFIRE_INSTR, TRIGGER_STATE)", statements);
    }

    [Fact]
    public void Legacy_uppercase_index_names_satisfy_the_dependency_without_recreating_indexes()
    {
        // 官方空库模板使用大写索引名；必须按 MySQL 的索引名大小写不敏感语义判定为已存在。
        var statements = MicroiQuartzSchemaRepair.BuildMySqlRepairStatements(
            MicroiQuartzSchemaRepair.DefaultTablePrefix,
            new[] { "IDX_MICROI_JOB_T_NFT_ST", "IDX_MICROI_JOB_T_NFT_ST_MISFIRE" });

        Assert.Empty(statements);
    }

    [Fact]
    public void Legacy_qrtz_prefix_indexes_still_require_the_prefixed_names()
    {
        var statements = MicroiQuartzSchemaRepair.BuildMySqlRepairStatements(
            MicroiQuartzSchemaRepair.DefaultTablePrefix,
            new[] { "IDX_QRTZ_T_NFT_ST", "IDX_QRTZ_T_NFT_ST_MISFIRE" });

        Assert.Equal(2, statements.Count);
    }

    [Fact]
    public void Only_the_mysql_dialect_depends_on_index_hints()
    {
        Assert.True(MicroiQuartzSchemaRepair.RequiresRepair(typeof(Microi.net.MicroiTenantMySqlDelegate).AssemblyQualifiedName!));
        Assert.False(MicroiQuartzSchemaRepair.RequiresRepair(typeof(Microi.net.MicroiTenantSqlServerDelegate).AssemblyQualifiedName!));
        Assert.False(MicroiQuartzSchemaRepair.RequiresRepair(""));
    }

    [Fact]
    public void Both_scheduler_startup_entry_points_must_run_the_repair_themselves()
    {
        // 自愈不能只挂在 JobStore.Initialize：Quartz 存储初始化时委托与数据源属性是否已注入
        // 不可依赖，线上曾因此完全不执行。两个启动入口都必须显式调用。
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !Directory.Exists(Path.Combine(root.FullName, "Microi.Server", "Microi.Job"))) root = root.Parent;
        Assert.NotNull(root);
        foreach (var file in new[] { "MicroiJobExtension.cs", "MicroiQuartzScheduledTask.cs" })
        {
            var source = File.ReadAllText(Path.Combine(root!.FullName, "Microi.Server", "Microi.Job", file));
            Assert.Contains("RepairQuartzTriggerIndexesBeforeSchedulerStart", source);
        }
    }

    [Fact]
    public void Blank_prefix_or_connection_is_a_no_op()
    {
        Assert.Throws<ArgumentException>(() => MicroiQuartzSchemaRepair.BuildMySqlRepairStatements("", Array.Empty<string>()));
        Assert.Equal(0, MicroiQuartzSchemaRepair.EnsureMySqlTriggerIndexesAsync("", MicroiQuartzSchemaRepair.DefaultTablePrefix).GetAwaiter().GetResult());
        Assert.Equal(0, MicroiQuartzSchemaRepair.EnsureMySqlTriggerIndexesAsync("Server=127.0.0.1;Port=1;", "").GetAwaiter().GetResult());
    }
}

/// <summary>真实 MySQL 上验证索引补齐是幂等的，并且确实创建 Quartz 依赖的索引。</summary>
[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public class MicroiQuartzSchemaRepairMySqlTests
{
    [Fact]
    public async Task Scheduler_startup_entry_point_repairs_missing_trigger_indexes()
    {
        var connection = Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_MYSQL");
        Assert.False(string.IsNullOrWhiteSpace(connection), "需显式配置本任务的一次性 schedule_gate MySQL，禁止使用业务数据库。");
        var builder = new MySqlConnectionStringBuilder(connection);
        await ScheduleFixtureGuard.VerifyMySqlOwnerAsync(builder);

        // 与 Quartz 官方 MySQL 脚本一致的触发器表，但故意只保留旧 QRTZ_ 前缀索引：
        // 线上历史租户库就是这样缺 IDX_{prefix}T_NFT_ST 的。
        await Execute(builder, @"DROP TABLE IF EXISTS `microi_job_triggers`", null);
        await Execute(builder, @"CREATE TABLE `microi_job_triggers` (
                `SCHED_NAME` varchar(120) NOT NULL,
                `TRIGGER_NAME` varchar(200) NOT NULL,
                `TRIGGER_GROUP` varchar(200) NOT NULL,
                `JOB_NAME` varchar(200) NOT NULL,
                `JOB_GROUP` varchar(200) NOT NULL,
                `DESCRIPTION` varchar(250) DEFAULT NULL,
                `NEXT_FIRE_TIME` bigint(19) DEFAULT NULL,
                `PREV_FIRE_TIME` bigint(19) DEFAULT NULL,
                `PRIORITY` int(11) DEFAULT NULL,
                `TRIGGER_STATE` varchar(16) NOT NULL,
                `TRIGGER_TYPE` varchar(8) NOT NULL,
                `START_TIME` bigint(19) NOT NULL,
                `END_TIME` bigint(19) DEFAULT NULL,
                `CALENDAR_NAME` varchar(200) DEFAULT NULL,
                `MISFIRE_INSTR` smallint(2) DEFAULT NULL,
                `JOB_DATA` blob,
                PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
                KEY `IDX_QRTZ_T_NFT_ST` (`SCHED_NAME`,`TRIGGER_STATE`,`NEXT_FIRE_TIME`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8;", null);
        try
        {
            // 走真实启动入口（DI 宿主注册），不是直接调用内部方法。
            var services = new ServiceCollection();
            services.AddLogging();
            services.AddMicroiJob(builder.ConnectionString, "MySql");

            Assert.Equal(1, await IndexCount(builder, "IDX_microi_job_T_NFT_ST"));
            Assert.Equal(1, await IndexCount(builder, "IDX_microi_job_T_NFT_ST_MISFIRE"));
        }
        finally
        {
            await Execute(builder, "DROP TABLE IF EXISTS `microi_job_triggers`", null);
        }
    }

    private static async Task<int> IndexCount(MySqlConnectionStringBuilder builder, string indexName)
    {
        await using var db = new MySqlConnection(builder.ConnectionString);
        await db.OpenAsync(TestContext.Current.CancellationToken);
        await using var read = new MySqlCommand(
            "SELECT COUNT(DISTINCT INDEX_NAME) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tableName AND INDEX_NAME=@indexName", db);
        read.Parameters.AddWithValue("@tableName", "microi_job_triggers");
        read.Parameters.AddWithValue("@indexName", indexName);
        return Convert.ToInt32(await read.ExecuteScalarAsync(TestContext.Current.CancellationToken));
    }

    private static async Task Execute(MySqlConnectionStringBuilder builder, string sql, string _)
    {
        await using var db = new MySqlConnection(builder.ConnectionString);
        await db.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new MySqlCommand(sql, db);
        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Repair_creates_and_then_skips_the_required_trigger_indexes()
    {
        var connection = Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_MYSQL");
        Assert.False(string.IsNullOrWhiteSpace(connection), "需显式配置本任务的一次性 schedule_gate MySQL，禁止使用业务数据库。");
        var builder = new MySqlConnectionStringBuilder(connection);
        await ScheduleFixtureGuard.VerifyMySqlOwnerAsync(builder);

        var tablePrefix = "qrtzrepair_" + Guid.NewGuid().ToString("N")[..8] + "_";
        var triggers = tablePrefix + "triggers";
        try
        {
            await using (var db = new MySqlConnection(builder.ConnectionString))
            {
                await db.OpenAsync(TestContext.Current.CancellationToken);
                await using var create = new MySqlCommand(
                    $@"CREATE TABLE `{triggers}` (
                        `SCHED_NAME` varchar(120) NOT NULL,
                        `TRIGGER_NAME` varchar(200) NOT NULL,
                        `TRIGGER_GROUP` varchar(200) NOT NULL,
                        `NEXT_FIRE_TIME` bigint(19) DEFAULT NULL,
                        `MISFIRE_INSTR` smallint(2) DEFAULT NULL,
                        `TRIGGER_STATE` varchar(16) NOT NULL,
                        PRIMARY KEY (`SCHED_NAME`,`TRIGGER_NAME`,`TRIGGER_GROUP`),
                        KEY `IDX_QRTZ_T_NFT_ST` (`SCHED_NAME`,`TRIGGER_STATE`,`NEXT_FIRE_TIME`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8;", db);
                await create.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }

            var created = await MicroiQuartzSchemaRepair.EnsureMySqlTriggerIndexesAsync(builder.ConnectionString, tablePrefix);
            Assert.Equal(2, created);

            await using (var db = new MySqlConnection(builder.ConnectionString))
            {
                await db.OpenAsync(TestContext.Current.CancellationToken);
                await using var read = new MySqlCommand(
                    "SELECT COUNT(DISTINCT INDEX_NAME) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tableName AND INDEX_NAME=@indexName", db);
                read.Parameters.AddWithValue("@tableName", triggers);
                read.Parameters.AddWithValue("@indexName", $"IDX_{tablePrefix}T_NFT_ST");
                Assert.Equal(1, Convert.ToInt32(await read.ExecuteScalarAsync(TestContext.Current.CancellationToken)));
            }

            // 多节点同时启动时会重复执行；第二次必须不报错且不再创建。
            Assert.Equal(0, await MicroiQuartzSchemaRepair.EnsureMySqlTriggerIndexesAsync(builder.ConnectionString, tablePrefix));
        }
        finally
        {
            await using var db = new MySqlConnection(builder.ConnectionString);
            await db.OpenAsync(TestContext.Current.CancellationToken);
            await using var drop = new MySqlCommand($"DROP TABLE IF EXISTS `{triggers}`", db);
            await drop.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }
    }
}
