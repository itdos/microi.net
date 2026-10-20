using System.Security.Cryptography;
using System.Text;
using Microi.net;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.Tests.FullStack;

/// <summary>复用 Full 已登记的共享 Redis；只写本用例随机租户前缀，finally 精确回收全部 Key。</summary>
[Trait("Category", "FullStack")]
[Trait("Suite", "IoTDownlink")]
public sealed class IoTDownlinkRedisTests
{
    [Fact]
    public async Task Two_connections_atomically_deduplicate_route_expire_and_reject_conflicts()
    {
        var options = RedisOptions();
        using var first = await ConnectionMultiplexer.ConnectAsync(options);
        using var second = await ConnectionMultiplexer.ConnectAsync(options);
        var db = first.GetDatabase();
        var peer = second.GetDatabase();
        var a = new RedisIoTCommandStore(db);
        var b = new RedisIoTCommandStore(peer);
        var tenant = "iotfixture_" + Guid.NewGuid().ToString("N");
        const string device = "0199999999999999";
        const string oldSession = "old";
        const string session = "new";
        var root = JObject.Parse("""
            {"osClient":"placeholder","requestHeaderHex":"AA333380","responseHeaderHex":"BB666680","tailHex":"FCFF","lengthOffset":4,"lengthAdjustment":4,
             "downlink":{"enabled":true,"deviceOffset":6,"deviceLength":8,"sendApiEngineKeys":["fixture-control"],"maxPendingCommands":2}}
            """);
        root["osClient"] = tenant;
        var policy = IoTDownlinkPolicy.Parse(root)!;
        var ids = new[] { "once", "expires", "queued-one", "queued-two", "full", "in-flight" };
        try
        {
            await a.BindAsync(tenant, device, oldSession, policy);
            await b.BindAsync(tenant, device, session, policy);
            await a.ReleaseAsync(tenant, device, oldSession);
            Assert.True(await b.RenewAsync(tenant, device, session, policy));
            Assert.False((await a.ClaimAsync(tenant, device, oldSession, policy)).OwnsConnection);

            Task<JObject> Send(RedisIoTCommandStore store, string id, string frame = "AB", int seconds = 30) =>
                store.EnqueueAsync(tenant, device, id, frame, "fixture-control", "user", seconds, policy);
            var submissions = await Task.WhenAll(Send(a, "once"), Send(b, "once"));
            Assert.All(submissions, r => Assert.Equal(1, r.Value<int>("Code")));
            Assert.Single(submissions, r => !r["Data"]!.Value<bool>("Duplicate"));
            var claims = await Task.WhenAll(a.ClaimAsync(tenant, device, session, policy), b.ClaimAsync(tenant, device, session, policy));
            Assert.Single(claims, c => c.Command != null);
            await b.CompleteAsync(tenant, device, session, "once", "Written", policy);
            Assert.Equal("Written", (await Send(a, "once"))["Data"]!.Value<string>("State"));
            Assert.Equal("Conflict", (await Send(b, "once", "CD"))["Data"]!.Value<string>("State"));

            await Send(a, "expires", seconds: 1);
            await Task.Delay(1200, TestContext.Current.CancellationToken);
            Assert.Null((await b.ClaimAsync(tenant, device, session, policy)).Command);
            Assert.Equal("Expired", (await Send(b, "expires", seconds: 1))["Data"]!.Value<string>("State"));
            await Send(a, "queued-one"); await Send(b, "queued-two");
            Assert.Equal("QueueFull", (await Send(a, "full"))["Data"]!.Value<string>("State"));
            await a.ClaimAsync(tenant, device, session, policy); await b.ClaimAsync(tenant, device, session, policy);

            await Send(a, "in-flight");
            Assert.NotNull((await b.ClaimAsync(tenant, device, session, policy)).Command);
            // 模拟写入前后进程退出：Sending 不回收重发，也不移交给下一代连接。
            await a.BindAsync(tenant, device, oldSession, policy);
            Assert.Null((await a.ClaimAsync(tenant, device, oldSession, policy)).Command);
            Assert.Equal("Sending", (await Send(a, "in-flight"))["Data"]!.Value<string>("State"));
        }
        finally
        {
            static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
            var prefix = "__MicroiIoT__:{" + Hash(tenant.ToLowerInvariant()) + "}:" + Hash(device);
            var keys = new[] { prefix + ":owner", prefix + ":q:" + oldSession, prefix + ":q:" + session }
                .Concat(ids.Select(id => prefix + ":c:" + Hash(id))).Select(k => (RedisKey)k).ToArray();
            await db.KeyDeleteAsync(keys);
            foreach (var key in keys) Assert.False(await peer.KeyExistsAsync(key));
        }
    }

    private static ConfigurationOptions RedisOptions()
    {
        // 仅测试进程读取用户指定的私有配置；不复制或输出凭据，不增加 API 生产环境变量。
        var settings = Environment.GetEnvironmentVariable("MICROI_TEST_IOT_SETTINGS_PATH");
        if (!string.IsNullOrWhiteSpace(settings))
        {
            var value = JObject.Parse(File.ReadAllText(settings))["AppSettings"]!;
            var options = new ConfigurationOptions {
                Password = value.Value<string>("OsClientRedisPwd"),
                DefaultDatabase = int.Parse(value["OsClientRedisDataBase"]!.ToString()),
                ConnectTimeout = 5000, SyncTimeout = 5000, AbortOnConnectFail = true
            };
            options.EndPoints.Add(value.Value<string>("OsClientRedisHost")!, int.Parse(value["OsClientRedisPort"]!.ToString()));
            return options;
        }
        var address = Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_REDIS");
        Assert.False(string.IsNullOrWhiteSpace(address), "IoT Redis integration requires the registered shared Redis fixture.");
        return ConfigurationOptions.Parse(address!);
    }
}
