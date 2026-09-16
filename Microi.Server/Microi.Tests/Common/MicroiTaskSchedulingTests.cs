using System.Collections.Concurrent;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Newtonsoft.Json.Linq;
using Quartz;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public class MicroiTaskSchedulingTests
{
    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("0", false)]
    [InlineData("false", false)]
    [InlineData("1", true)]
    [InlineData(" TRUE ", true)]
    public void MissingOrDisabledSwitch_IsBackwardsCompatible(string? value, bool expected)
        => Assert.Equal(expected, MicroiTaskSchedulingPolicy.ParseDisabled(value == null ? null! : new JValue(value)));

    [Fact]
    public void InvalidConfiguration_FailsClosed()
    {
        Assert.Throws<InvalidOperationException>(() => MicroiTaskSchedulingPolicy.ParseDisabled(new JValue("bad")));
        Assert.False(MicroiTaskSchedulingPolicy.ParseDisabled(JValue.CreateNull()));
        Assert.True(MicroiTaskSchedulingPolicy.ParseDisabled(new JValue(true)));
    }

    [Fact]
    public async Task TenantFailure_DoesNotStopHealthyTenant_AndEveryReadSeesChanges()
    {
        var previous = OsClientExtend.ClientList;
        OsClientExtend.ClientList = new ConcurrentDictionary<string, OsClientSecret>();
        try
        {
            OsClientExtend.ClientList["one"] = new OsClientSecret();
            OsClientExtend.ClientList["two"] = new OsClientSecret();
            var disabled = false;
            Task<bool> Read(string tenant) => tenant == "one" ? Task.FromException<bool>(new InvalidOperationException("test fault")) : Task.FromResult(disabled);
            var first = await MicroiTaskSchedulingPolicy.ReadTenantsAsync(Read);
            Assert.True(first["one"]);
            Assert.False(first["two"]);
            disabled = true;
            Assert.True((await MicroiTaskSchedulingPolicy.ReadTenantsAsync(Read))["two"]);
            disabled = false;
            Assert.False((await MicroiTaskSchedulingPolicy.ReadTenantsAsync(Read))["two"]);
        }
        finally { OsClientExtend.ClientList = previous; }
    }

    [Fact]
    public void Registration_UsesGateAndReadOnlyObserver()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddMicroiJob("Server=localhost;Database=unused;User Id=unused;Password=unused", "MySql");
        using var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptions<QuartzOptions>>().Value;
        Assert.Contains(nameof(MicroiTaskSchedulingJobStore), options["quartz.jobStore.type"]);
        Assert.Contains(services, x => x.ServiceType == typeof(IHostedService) && x.ImplementationType == typeof(MicroiDisabledScheduleObserver));
    }

    [Fact]
    public async Task HungTenant_IsBounded_DoesNotStarveHealthyTenant_AndDoesNotAccumulateReads()
    {
        var previous = OsClientExtend.ClientList;
        var tenant = "hung-" + Guid.NewGuid().ToString("N");
        var healthy = "healthy-" + Guid.NewGuid().ToString("N");
        OsClientExtend.ClientList = new ConcurrentDictionary<string, OsClientSecret>();
        OsClientExtend.ClientList[tenant] = new OsClientSecret();
        OsClientExtend.ClientList[healthy] = new OsClientSecret();
        var release = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var calls = 0;
        Task<bool> Read(string name)
        {
            if (name != tenant) return Task.FromResult(false);
            Interlocked.Increment(ref calls);
            return release.Task;
        }
        try
        {
            var results = await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => MicroiTaskSchedulingPolicy.ReadTenantsAsync(Read)))
                .WaitAsync(TimeSpan.FromSeconds(3), TestContext.Current.CancellationToken);
            Assert.All(results, result => { Assert.True(result[tenant]); Assert.False(result[healthy]); });
            var next = await MicroiTaskSchedulingPolicy.ReadTenantsAsync(Read);
            Assert.True(next[tenant]);
            Assert.False(next[healthy]);
            Assert.Equal(1, calls);
        }
        finally { release.TrySetResult(false); OsClientExtend.ClientList = previous; }
    }

    [Fact]
    public async Task SynchronousCacheInitialization_IsAlsoBounded()
    {
        var previous = OsClientExtend.ClientList;
        var tenant = "sync-hung-" + Guid.NewGuid().ToString("N");
        using var unblock = new ManualResetEventSlim(false);
        using var finished = new ManualResetEventSlim(false);
        OsClientExtend.ClientList = new ConcurrentDictionary<string, OsClientSecret>();
        OsClientExtend.ClientList[tenant] = new OsClientSecret();
        try
        {
            Task<bool> Read(string _) { unblock.Wait(); finished.Set(); return Task.FromResult(false); }
            var result = await Task.Run(() => MicroiTaskSchedulingPolicy.ReadTenantsAsync(Read))
                .WaitAsync(TimeSpan.FromSeconds(3), TestContext.Current.CancellationToken);
            Assert.True(result[tenant]);
            Assert.Contains("1 秒", MicroiTaskSchedulingPolicy.ReadFailure(tenant));
        }
        finally { unblock.Set(); Assert.True(finished.Wait(3000)); OsClientExtend.ClientList = previous; }
    }

    [Fact]
    public void AllAcquisitionAndMisfireVariants_FilterBeforeLimit_AndScopeIsRestored()
    {
        var selection = new MicroiTaskSchedulingSelection(new Dictionary<string, bool> { ["off"] = true, ["on"] = false }, new[] { "legacy'allowed" });
        using (MicroiTaskSchedulingPolicy.Enter(selection))
        {
            foreach (var sql in new MySqlProbe().Queries().Concat(new SqlServerProbe().Queries()))
            {
                Assert.DoesNotContain(MicroiQuartzScheduledTask.GetTenantGroup("off"), sql);
                Assert.Contains(MicroiQuartzScheduledTask.GetTenantGroup("on"), sql);
                Assert.Contains("legacy''allowed", sql);
                var filter = sql.IndexOf("JOB_GROUP IN", StringComparison.Ordinal);
                var order = sql.IndexOf("ORDER BY", StringComparison.OrdinalIgnoreCase);
                var limit = sql.IndexOf(" LIMIT ", StringComparison.OrdinalIgnoreCase);
                Assert.True(filter >= 0 && (order < 0 || filter < order) && (limit < 0 || filter < limit));
            }
            using (MicroiTaskSchedulingPolicy.Enter(new MicroiTaskSchedulingSelection(new Dictionary<string, bool> { ["off"] = true }, [])))
                Assert.All(new MySqlProbe().Queries(), sql => Assert.Contains("AND (1 = 0)", sql));
            Assert.Same(selection, MicroiTaskSchedulingPolicy.Current.Value);
        }
        Assert.Null(MicroiTaskSchedulingPolicy.Current.Value);
        Assert.Throws<InvalidOperationException>(() => MicroiTaskSchedulingSelection.SqlLiteral("unsafe\\name"));
    }

    [Fact]
    public void SkipObservation_DoesNotAdvanceTrigger_AndDeduplicatesAcrossNodes()
    {
        var from = new DateTimeOffset(2026, 9, 8, 1, 0, 0, TimeSpan.Zero);
        var trigger = TriggerBuilder.Create().WithIdentity("trigger", "group").ForJob("job", "group")
            .StartAt(from).WithCronSchedule("0/10 * * * * ?", x => x.InTimeZone(TimeZoneInfo.Utc)).Build();
        var before = trigger.GetNextFireTimeUtc();
        var times = MicroiDisabledScheduleObserver.DueTimes(trigger, from, from.AddSeconds(30));
        Assert.Equal(new[] { from.AddSeconds(10), from.AddSeconds(20), from.AddSeconds(30) }, times);
        Assert.Equal(before, trigger.GetNextFireTimeUtc());
        var id = MicroiDisabledScheduleObserver.LogId("tenant", trigger.JobKey, trigger.Key, times[0]);
        Assert.Equal(id, MicroiDisabledScheduleObserver.LogId("TENANT", trigger.JobKey, trigger.Key, times[0].ToOffset(TimeSpan.FromHours(8))));
        Assert.NotEqual(id, MicroiDisabledScheduleObserver.LogId("other", trigger.JobKey, trigger.Key, times[0]));
        Assert.NotEqual(id, MicroiDisabledScheduleObserver.LogId("tenant", trigger.JobKey, trigger.Key, times[1]));
    }

    private sealed class MySqlProbe : MicroiTenantMySqlDelegate
    {
        public string[] Queries() => [GetSelectNextTriggerToAcquireSql(3), GetSelectNextTriggerToAcquireWithExecutionGroupSql(3), GetSelectNextTriggerToAcquireWithPreferredNodeSql(3), GetSelectNextTriggerToAcquireWithPreferredNodeOnlySql(3), GetSelectNextMisfiredTriggersInStateToAcquireSql(3), GetCountMisfiredTriggersInStateSql()];
    }
    private sealed class SqlServerProbe : MicroiTenantSqlServerDelegate
    {
        public string[] Queries() => [GetSelectNextTriggerToAcquireSql(3), GetSelectNextTriggerToAcquireWithExecutionGroupSql(3), GetSelectNextTriggerToAcquireWithPreferredNodeSql(3), GetSelectNextTriggerToAcquireWithPreferredNodeOnlySql(3), GetSelectNextMisfiredTriggersInStateToAcquireSql(3), GetCountMisfiredTriggersInStateSql()];
    }
}
