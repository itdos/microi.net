using System.Collections.Concurrent;
using System.Reflection;
using Dos.Common;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Quartz;
using StackExchange.Redis;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public class MicroiTaskSchedulingCacheTests
{
    [Fact]
    public async Task RealRedis_LiveSettingRead_AndConcurrentSkipLogsAreIdempotent()
    {
        var address = Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_REDIS");
        // 真实缓存验证属于 Full；配置缺失必须失败，不能让发布以跳过用例收尾。
        Assert.False(string.IsNullOrWhiteSpace(address), "需显式配置本任务隔离 Redis。");
        ScheduleFixtureGuard.ValidateRedisEndpoint(address!);
        using var redis = await ConnectionMultiplexer.ConnectAsync(address);
        var db = redis.GetDatabase();
        await ScheduleFixtureGuard.VerifyRedisOwnerAsync(address!, db);
        var tenant = "schedule-test-" + Guid.NewGuid().ToString("N");
        var cache = DispatchProxy.Create<IMicroiCache, CacheProxy>();
        ((CacheProxy)cache).Database = db;
        var form = DispatchProxy.Create<IFormEngine, FormProxy>();
        var recorder = DispatchProxy.Create<IMongoDB, MongoRecorder>();
        using var provider = new ServiceCollection().AddSingleton<IMicroiCacheTenant>(new CacheTenant(cache))
            .AddSingleton(form).AddSingleton(recorder).BuildServiceProvider();
        var locator = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)!;
        var previous = locator.GetValue(null);
        locator.SetValue(null, provider);
        try
        {
            var configKey = $"Microi:{tenant}:SysConfig";
            await db.StringSetAsync(configKey, "{}");
            Assert.False(await MicroiTaskSchedulingPolicy.IsDisabledAsync(tenant));
            await db.StringSetAsync(configKey, "{\"DisableTaskScheduling\":1}");
            Assert.True(await MicroiTaskSchedulingPolicy.IsDisabledAsync(tenant));
            await db.StringSetAsync(configKey, "{\"DisableTaskScheduling\":0}");
            Assert.False(await MicroiTaskSchedulingPolicy.IsDisabledAsync(tenant));
            // 真实缓存 miss 再走 FormEngine，必须失败关闭，不能自动允许业务。
            await db.KeyDeleteAsync(configKey);
            await Assert.ThrowsAsync<InvalidOperationException>(() => MicroiTaskSchedulingPolicy.IsDisabledAsync(tenant));

            var job = new JobKey("daily", "group");
            var trigger = new TriggerKey("daily", "group");
            var time = DateTimeOffset.UtcNow;
            await Task.WhenAll(Enumerable.Range(0, 24).Select(i => MicroiDisabledScheduleObserver.WriteSkip(tenant, job, trigger, time, "node-" + i)));
            var stored = (MongoRecorder)recorder;
            var row = Assert.Single(stored.Rows).Value;
            Assert.Equal(1, stored.AddAttempts);
            var message = JObject.Parse(row.Content!);
            Assert.Equal("Skipped", message["Status"]);
            Assert.False((bool)message["Executed"]!);
            Assert.Equal("SystemTaskSchedulingDisabled", message["Reason"]);
            Assert.Contains("系统设置中已经手动停用了任务调度", message["Msg"]!.ToString());

            var logId = MicroiDisabledScheduleObserver.LogId(tenant, job, trigger, time);
            var dedupKey = $"Microi:{tenant}:JobSchedulingSkipped:{logId}";
            Assert.Equal("done", (await db.StringGetAsync(dedupKey)).ToString());
            // 模拟日志已落库但缓存凭据丢失；确定性数据库主键与回读仍避免第二条记录。
            await db.KeyDeleteAsync(dedupKey);
            await MicroiDisabledScheduleObserver.WriteSkip(tenant, job, trigger, time, "replacement-node");
            Assert.Single(stored.Rows);
            Assert.Equal(2, stored.AddAttempts);
            await db.KeyDeleteAsync(dedupKey);
        }
        finally { locator.SetValue(null, previous); }
    }

    public class MongoRecorder : DispatchProxy
    {
        public ConcurrentDictionary<string, SysLogParam> Rows = new();
        public int AddAttempts;
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name != nameof(IMongoDB.AddSysLogs)) throw new InvalidOperationException(method.Name);
            Interlocked.Increment(ref AddAttempts);
            foreach (var row in (IReadOnlyCollection<SysLogParam>)args![0]!) Rows.TryAdd(row.EventId, row);
            return Task.FromResult(new DosResult(1));
        }
    }

    private sealed class CacheTenant(IMicroiCache cache) : IMicroiCacheTenant
    {
        public IMicroiCache Cache(string osClient) => cache;
        public IMicroiCache Default() => cache;
    }
    public class CacheProxy : DispatchProxy
    {
        public IDatabase Database = null!;
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name == nameof(IMicroiCache.GetIDatabase)) return Database;
            if (method.Name == nameof(IMicroiCache.GetAsync) && method.IsGenericMethod) return Read(args![0]!.ToString()!);
            throw new InvalidOperationException("Unexpected cache operation: " + method.Name);
        }
        private async Task<JObject?> Read(string key)
        {
            var value = await Database.StringGetAsync(key);
            return value.IsNull ? null : JsonConvert.DeserializeObject<JObject>(value.ToString());
        }
    }
    public class FormProxy : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name == nameof(IFormEngine.GetSysConfig)) return Task.FromResult(new DosResult<dynamic> { Code = 0, Msg = "test config unavailable" });
            throw new InvalidOperationException("Unexpected FormEngine operation: " + method.Name);
        }
    }
}
