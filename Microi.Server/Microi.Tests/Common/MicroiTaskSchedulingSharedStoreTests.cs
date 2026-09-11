using System.Collections.Concurrent;
using System.Reflection;
using Microi.net;
using MySql.Data.MySqlClient;
using Quartz;
using Quartz.Impl.AdoJobStore;
using Quartz.Impl.AdoJobStore.Common;
using Quartz.Simpl;
using Quartz.Spi;
using Quartz.Util;

namespace Microi.Tests.Common;

/// <summary>两个真实 ADO JobStore 共享一次性 MySQL；不连接用户租户，不启动生产调度。</summary>
[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public class MicroiTaskSchedulingSharedStoreTests
{
    [Fact]
    public async Task SharedQuartz_DisabledNewNodeLeavesOldNodeScheduleUntouched_AndSwitchIsLive()
    {
        var connection = Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_MYSQL");
        // 依赖隔离数据库的场景不能归入 Quick，也不能在 Full 中静默跳过。
        Assert.False(string.IsNullOrWhiteSpace(connection), "需显式配置本任务的一次性 schedule_gate MySQL，禁止使用业务数据库。");
        var builder = new MySqlConnectionStringBuilder(connection);
        await ScheduleFixtureGuard.VerifyMySqlOwnerAsync(builder);
        var previous = OsClientExtend.ClientList;
        OsClientExtend.ClientList = new ConcurrentDictionary<string, OsClientSecret>();
        OsClientExtend.ClientList["stopped"] = new OsClientSecret();
        OsClientExtend.ClientList["running"] = new OsClientSecret();
        var schedulerName = "schedule-gate-test-" + Guid.NewGuid().ToString("N");
        var modern = new GateStore { States = new() { ["stopped"] = true, ["running"] = false } };
        var legacy = new JobStoreTX();
        try
        {
            await Initialize(modern, connection!, schedulerName, "new", typeof(MicroiTenantMySqlDelegate));
            await Initialize(legacy, connection!, schedulerName, "old", typeof(MySQLDelegate));
            var keys = new List<TriggerKey>();
            foreach (var tenant in new[] { "stopped", "running" })
            foreach (var group in new[] { "default_group", MicroiQuartzScheduledTask.GetTenantGroup(tenant) })
                keys.Add(await Add(legacy, tenant, group, DateTimeOffset.UtcNow.AddSeconds(-2)));
            var before = new Dictionary<TriggerKey, DateTimeOffset?>();
            foreach (var key in keys) before[key] = (await legacy.RetrieveTrigger(key))!.GetNextFireTimeUtc();

            var newClaims = await modern.AcquireNextTriggers(DateTimeOffset.UtcNow, 10, TimeSpan.Zero);
            Assert.Equal(2, newClaims.Count);
            Assert.All(newClaims, x => Assert.StartsWith("running-", x.JobKey.Name));
            foreach (var claim in newClaims) await modern.ReleaseAcquiredTrigger(claim);
            foreach (var key in keys) Assert.Equal(before[key], (await legacy.RetrieveTrigger(key))!.GetNextFireTimeUtc());

            var oldClaims = await legacy.AcquireNextTriggers(DateTimeOffset.UtcNow, 10, TimeSpan.Zero);
            Assert.Equal(4, oldClaims.Count);
            var stopped = oldClaims.First(x => x.JobKey.Name.StartsWith("stopped-", StringComparison.Ordinal));
            var oldFire = (await legacy.TriggersFired(new[] { stopped })).Single();
            Assert.NotNull(oldFire.TriggerFiredBundle);
            Assert.Null(oldFire.Exception);
            Assert.True((await legacy.RetrieveTrigger(stopped.Key))!.GetNextFireTimeUtc() > before[stopped.Key]);
            await using (var db = new MySqlConnection(connection))
            {
                await db.OpenAsync(TestContext.Current.CancellationToken);
                using var count = new MySqlCommand("SELECT COUNT(*) FROM QRTZ_FIRED_TRIGGERS WHERE SCHED_NAME=@name AND INSTANCE_NAME='old'", db);
                count.Parameters.AddWithValue("@name", schedulerName);
                var firedBefore = Convert.ToInt32(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken));
                Assert.True(firedBefore > 0);
                await modern.RecoverClusterForTest("old");
                Assert.Equal(firedBefore, Convert.ToInt32(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken)));
            }
            foreach (var claim in oldClaims.Where(x => x.Key != stopped.Key)) await legacy.ReleaseAcquiredTrigger(claim);

            // 已领取但尚未 Triggered 时才打开开关：必须归还，不推进 NextFireTime。
            await legacy.ClearAllSchedulingData();
            modern.States["stopped"] = false;
            var raceKey = await Add(legacy, "stopped", MicroiQuartzScheduledTask.GetTenantGroup("stopped"), DateTimeOffset.UtcNow.AddSeconds(-2));
            var acquired = (await modern.AcquireNextTriggers(DateTimeOffset.UtcNow, 1, TimeSpan.Zero)).Single();
            var scheduled = acquired.GetNextFireTimeUtc();
            modern.States["stopped"] = true;
            var rejected = (await modern.TriggersFired(new[] { acquired })).Single();
            Assert.Null(rejected.TriggerFiredBundle);
            Assert.Null(rejected.Exception);
            Assert.Equal(scheduled, (await legacy.RetrieveTrigger(raceKey))!.GetNextFireTimeUtc());
            Assert.Equal(TriggerState.Normal, await legacy.GetTriggerState(raceKey));
            Assert.Equal(1, modern.SkipLogs);
            Assert.Single(await legacy.AcquireNextTriggers(DateTimeOffset.UtcNow, 1, TimeSpan.Zero));

            // 失火处理也不能替旧节点前移停用租户的 Cron；恢复开关后无需重建任务。
            await legacy.ClearAllSchedulingData();
            var overdue = await Add(legacy, "stopped", MicroiQuartzScheduledTask.GetTenantGroup("stopped"), DateTimeOffset.UtcNow.AddMinutes(-5));
            var overdueTime = (await legacy.RetrieveTrigger(overdue))!.GetNextFireTimeUtc();
            await modern.RecoverForTest();
            Assert.Equal(overdueTime, (await legacy.RetrieveTrigger(overdue))!.GetNextFireTimeUtc());
            modern.States["stopped"] = false;
            await modern.RecoverForTest();
            Assert.True((await legacy.RetrieveTrigger(overdue))!.GetNextFireTimeUtc() > overdueTime);

            await legacy.ClearAllSchedulingData();
            var resumed = await Add(legacy, "stopped", MicroiQuartzScheduledTask.GetTenantGroup("stopped"), DateTimeOffset.UtcNow.AddSeconds(-2));
            Assert.Single(await modern.AcquireNextTriggers(DateTimeOffset.UtcNow, 1, TimeSpan.Zero));
        }
        finally
        {
            await legacy.Shutdown();
            await modern.Shutdown();
            OsClientExtend.ClientList = previous;
        }
    }

    private static async Task Initialize(JobStoreTX store, string connection, string name, string node, Type driver)
    {
        var source = name + node;
        var provider = new DbProvider("MySql", connection);
        provider.Initialize();
        DBConnectionManager.Instance.AddConnectionProvider(source, provider);
        store.DataSource = source;
        store.InstanceName = name;
        store.InstanceId = node;
        store.TablePrefix = "QRTZ_";
        store.DriverDelegateType = driver.AssemblyQualifiedName!;
        store.Clustered = true;
        store.AcquireTriggersWithinLock = true;
        store.PerformSchemaValidation = true;
        store.ObjectSerializer = new JsonObjectSerializer();
        store.ObjectSerializer.Initialize();
        var loader = new SimpleTypeLoadHelper();
        loader.Initialize();
        await store.Initialize(loader, DispatchProxy.Create<ISchedulerSignaler, Signaler>());
    }

    private static async Task<TriggerKey> Add(JobStoreTX store, string tenant, string group, DateTimeOffset start)
    {
        var key = tenant + "-" + Guid.NewGuid().ToString("N");
        var job = JobBuilder.Create<NeverRunBusiness>().WithIdentity(key, group).UsingJobData(MicroiJobConst.OsClient, tenant).Build();
        var trigger = (IOperableTrigger)TriggerBuilder.Create().WithIdentity(key, group).ForJob(job)
            .StartAt(start).WithCronSchedule("0/1 * * * * ?", x => x.WithMisfireHandlingInstructionDoNothing()).Build();
        trigger.ComputeFirstFireTimeUtc(null);
        await store.StoreJobAndTrigger(job, trigger);
        return trigger.Key;
    }

    private sealed class GateStore : MicroiTaskSchedulingJobStore
    {
        public Dictionary<string, bool> States = new();
        public int SkipLogs;
        protected override Task<Dictionary<string, bool>> ReadSchedulingSettings() => Task.FromResult(new Dictionary<string, bool>(States));
        protected override Task<bool> IsSchedulingDisabled(string tenant) => Task.FromResult(States[tenant]);
        protected override Task WriteSchedulingSkip(string tenant, IOperableTrigger trigger) { SkipLogs++; return Task.CompletedTask; }
        public Task RecoverForTest() => ExecuteInNonManagedTXLock("TRIGGER_ACCESS", async conn => { await RecoverMisfiredJobs(conn, false, TestContext.Current.CancellationToken); }, TestContext.Current.CancellationToken);
        public Task RecoverClusterForTest(string instance) => ExecuteInNonManagedTXLock("TRIGGER_ACCESS", conn => ClusterRecover(conn,
            new[] { new SchedulerStateRecord { SchedulerInstanceId = instance } }, TestContext.Current.CancellationToken), TestContext.Current.CancellationToken);
    }

    public class Signaler : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.ReturnType == typeof(Task)) return Task.CompletedTask;
            if (method.ReturnType == typeof(ValueTask)) return ValueTask.CompletedTask;
            return null;
        }
    }
    public class NeverRunBusiness : IJob
    {
        public Task Execute(IJobExecutionContext context) => throw new InvalidOperationException("测试只推进真实 Quartz 状态，不允许调用任何业务。");
    }
}
