using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Quartz;
using Quartz.Impl;
using System.Collections.Specialized;
using System.Reflection;
using Dos.Common;
using Newtonsoft.Json.Linq;
using System.Collections.Concurrent;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public class MicroiJobRuntimeTests
{
    [Fact]
    public void ProductionRegistration_UsesDistinctClusterNodeIds()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        // 仅解析注册选项，不启动 Scheduler，也不连接示例数据库。
        services.AddMicroiJob("Server=localhost;Database=unused;User Id=unused;Password=unused", "MySql");
        using var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptions<QuartzOptions>>().Value;
        Assert.Equal("AUTO", options["quartz.scheduler.instanceId"]);
        Assert.Equal("1000", options["quartz.scheduler.idleWaitTime"]);
        Assert.Equal("true", options["quartz.jobStore.clustered"]);
        Assert.Equal("microi_job_", options["quartz.jobStore.tablePrefix"]);
        Assert.Contains(nameof(MicroiTenantMySqlDelegate), options["quartz.jobStore.driverDelegateType"]);
    }

    [Fact]
    public void AcquisitionAndMisfireSql_OnlySelectLoadedTenantsBeforeApplyingRowLimit()
    {
        var previous = OsClientExtend.ClientList;
        OsClientExtend.ClientList = new ConcurrentDictionary<string, OsClientSecret>();
        try
        {
            OsClientExtend.ClientList["tenantA"] = new OsClientSecret();
            var delegates = new Func<string[]>[] { () => new MySqlProbe().Queries(), () => new SqlServerProbe().Queries() };
            foreach (var querySet in delegates)
            {
                foreach (var sql in querySet())
                {
                    Assert.Contains("default_group.tenanta.", sql);
                    Assert.DoesNotContain("default_group.tenantb.", sql);
                    var predicate = sql.IndexOf("JOB_GROUP IN", StringComparison.Ordinal);
                    Assert.True(predicate >= 0);
                    var order = sql.IndexOf("ORDER BY", StringComparison.OrdinalIgnoreCase);
                    Assert.True(order < 0 || predicate < order);
                    var limit = sql.IndexOf(" LIMIT ", StringComparison.OrdinalIgnoreCase);
                    Assert.True(limit < 0 || predicate < limit);
                }
            }
            // 新租户热加载后下次抢占立即可见，不必重启调度器或依赖另一份租户白名单。
            OsClientExtend.ClientList["tenantB"] = new OsClientSecret();
            Assert.All(new MySqlProbe().Queries(), sql => Assert.Contains("default_group.tenantb.", sql));
        }
        finally { OsClientExtend.ClientList = previous; }
    }

    private sealed class MySqlProbe : MicroiTenantMySqlDelegate
    {
        public string[] Queries() => new[] { GetSelectNextTriggerToAcquireSql(3), GetSelectNextTriggerToAcquireWithExecutionGroupSql(3), GetSelectNextTriggerToAcquireWithPreferredNodeSql(3), GetSelectNextTriggerToAcquireWithPreferredNodeOnlySql(3), GetSelectNextMisfiredTriggersInStateToAcquireSql(3), GetCountMisfiredTriggersInStateSql() };
    }
    private sealed class SqlServerProbe : MicroiTenantSqlServerDelegate
    {
        public string[] Queries() => new[] { GetSelectNextTriggerToAcquireSql(3), GetSelectNextTriggerToAcquireWithExecutionGroupSql(3), GetSelectNextTriggerToAcquireWithPreferredNodeSql(3), GetSelectNextTriggerToAcquireWithPreferredNodeOnlySql(3), GetSelectNextMisfiredTriggersInStateToAcquireSql(3), GetCountMisfiredTriggersInStateSql() };
    }

    [Fact]
    public async Task BackgroundTimeSync_ReadsAndWritesTheSameTenantForIdenticalJobNames()
    {
        var factory = new StdSchedulerFactory(new NameValueCollection
        {
            ["quartz.scheduler.instanceName"] = "TenantTimeSync-" + Guid.NewGuid().ToString("N"),
            ["quartz.threadPool.threadCount"] = "1",
            ["quartz.jobStore.type"] = "Quartz.Simpl.RAMJobStore, Quartz"
        });
        var scheduler = await factory.GetScheduler(TestContext.Current.CancellationToken);
        var service = new MicroiQuartzScheduledTask(factory);
        var formEngine = DispatchProxy.Create<IFormEngine, RecordingScheduleFormEngine>();
        var recording = (RecordingScheduleFormEngine)formEngine;
        var services = new ServiceCollection();
        services.AddSingleton(formEngine);
        using var provider = services.BuildServiceProvider();
        var locator = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        var previous = locator.GetValue(null);
        locator.SetValue(null, provider);
        try
        {
            // 使用真实 Quartz 存储两条同名、不同周期任务；不启动调度器，不执行接口或连接数据库。
            foreach (var (tenant, day) in new[] { ("tenantA", 1), ("tenantB", 2) })
            {
                var added = await service.AddJob(new MicroiAddJobModel
                {
                    OsClient = tenant, JobName = "sameName", JobType = "1", ApiEngineKey = "unusedEngine",
                    CronExpression = $"0 0 0 {day} 1 ? 2099"
                });
                Assert.Equal(1, added.Code);
                var sync = typeof(MicroiQuartzScheduledTask).GetMethod("SyncTenantTaskTime", BindingFlags.Instance | BindingFlags.NonPublic)!;
                await (Task)sync.Invoke(service, new object[] { tenant })!;
            }
            Assert.Equal(new[] { "tenantA", "tenantB" }, recording.ReadTenants);
            Assert.Equal(2, recording.Updates.Count);
            Assert.Equal("tenantA", recording.Updates[0]["OsClient"]?.ToString());
            Assert.Equal("tenantB", recording.Updates[1]["OsClient"]?.ToString());
            Assert.Contains("2099-01-01", recording.Updates[0]["_RowModel"]?["NextTime"]?.ToString());
            Assert.Contains("2099-01-02", recording.Updates[1]["_RowModel"]?["NextTime"]?.ToString());
        }
        finally
        {
            locator.SetValue(null, previous);
            await scheduler.Shutdown(false, TestContext.Current.CancellationToken);
        }
    }

    public class RecordingScheduleFormEngine : DispatchProxy
    {
        public List<string> ReadTenants { get; } = new();
        public List<JObject> Updates { get; } = new();
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            var request = JObject.FromObject(args![0]!);
            if (targetMethod!.Name == nameof(IFormEngine.GetTableDataAsync))
            {
                var tenant = request["OsClient"]!.ToString();
                ReadTenants.Add(tenant);
                return Task.FromResult(new DosResultList<dynamic>
                {
                    Code = 1,
                    Data = new List<dynamic> { new JObject { ["Id"] = tenant + "-row", ["JobName"] = "sameName" } }
                });
            }
            if (targetMethod.Name == nameof(IFormEngine.UptFormDataAsync))
            {
                Updates.Add(request);
                return Task.FromResult(new DosResult(1));
            }
            throw new InvalidOperationException("测试不允许调用 " + targetMethod.Name);
        }
    }
}
