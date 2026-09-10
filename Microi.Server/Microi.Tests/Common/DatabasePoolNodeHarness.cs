using Dos.ORM;
using Microi.net;
using Newtonsoft.Json;
using StackExchange.Redis;
using Microi.net.Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>只属于中央回归程序集的独立节点测试夹具；不为生产内核新增友元或公共测试后门。</summary>
public static class DatabasePoolNodeHarness
{
    /// <summary>在独立进程中使用真实 Kestrel、宿主生命周期及 Redis 缓存构造链，启动递归不能杀死中央测试宿主。</summary>
    public static async Task RunStartupAsync()
    {
        var tenant = Environment.GetEnvironmentVariable("MICROI_POOL_TEST_TENANT")!;
        var address = Environment.GetEnvironmentVariable("MICROI_POOL_TEST_REDIS")!;
        var connection = Environment.GetEnvironmentVariable("MICROI_POOL_TEST_CONNECTION")!;
        Environment.SetEnvironmentVariable("OsClient", tenant);
        Environment.SetEnvironmentVariable("OsClientType", "PoolStartup");
        Environment.SetEnvironmentVariable("OsClientNetwork", "Internal");
        OsClientDefault.OsClient = tenant;
        OsClientDefault.OsClientType = "PoolStartup";
        OsClientDefault.OsClientNetwork = "Internal";
        var nodesKey = "Microi:{PoolRecovery:" + DatabasePoolCoordinator.Hash(tenant + "\nPoolStartup\nInternal") + "}:nodes";
        using var redis = await ConnectionMultiplexer.ConnectAsync(address);
        var database = redis.GetDatabase();
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddMicroiCache();
        builder.Services.AddHostedService<DatabasePoolRecoveryHostedService>();
        await using var host = builder.Build();
        try
        {
            // 此时默认缓存和 SaaS 租户还未构造；旧实现在 Init 后抢先进入默认缓存递归。
            MicroiEngine.Init(host.Services);
            await Task.Delay(2200);
            if (await database.KeyExistsAsync(nodesKey)) throw new Exception("Recovery started before tenant bootstrap");

            var session = new DbSession(DatabaseType.MySql, connection);
            var endpoint = address.Split(':');
            OsClientExtend.ClientList[tenant] = new OsClientSecret
            {
                OsClient = tenant, Db = session, DbRead = session,
                OsClientModel = JObject.FromObject(new
                {
                    OsClient = tenant, OsClientType = "PoolStartup", OsClientNetwork = "Internal",
                    DbType = "MySql", DbConn = connection,
                    RedisHost = endpoint[0], RedisPort = endpoint[1], RedisDataBase = "0", RedisPwd = ""
                })
            };
            // 复用 SaaS 初始化时真实缓存构造顺序，不用缓存代理或预先注入 Coordinator 绕开故障链路。
            OsClientExtend._isCacheInitializing = true;
            try { _ = MicroiEngine.CacheTenant.Default().GetIDatabase(); }
            finally { OsClientExtend._isCacheInitializing = false; }
            if (await database.KeyExistsAsync(nodesKey)) throw new Exception("Recovery started before host readiness");
            host.MapGet("/fixture/health", () => "ready");
            await host.StartAsync();
            var url = host.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.Server.IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            using var client = new HttpClient();
            if (await client.GetStringAsync(url + "/fixture/health") != "ready") throw new Exception("Kestrel did not become ready");
            var deadline = DateTime.UtcNow.AddSeconds(8);
            while (await database.SortedSetLengthAsync(nodesKey) == 0 && DateTime.UtcNow < deadline) await Task.Delay(100);
            var nodes = await database.SortedSetRangeByRankAsync(nodesKey);
            if (nodes.Length != 1) throw new Exception("Ready host did not register exactly one recovery node");
            await host.StopAsync();
            var stoppedScore = await database.SortedSetScoreAsync(nodesKey, nodes[0]);
            await Task.Delay(2400);
            if (await database.SortedSetScoreAsync(nodesKey, nodes[0]) != stoppedScore) throw new Exception("Recovery loop survived host stop");
            Console.WriteLine("PoolRecoveryHostStartupVerified");
        }
        finally { await database.KeyDeleteAsync(nodesKey); }
    }

    public static async Task RunAsync()
    {
        var partition = Environment.GetEnvironmentVariable("MICROI_POOL_TEST_PARTITION")!;
        var tenant = Environment.GetEnvironmentVariable("MICROI_POOL_TEST_TENANT")!;
        var pool = new DbSession(DatabaseType.MySql, Environment.GetEnvironmentVariable("MICROI_POOL_TEST_CONNECTION")).Db;
        using var redis = await ConnectionMultiplexer.ConnectAsync(Environment.GetEnvironmentVariable("MICROI_POOL_TEST_REDIS")!);
        var cache = redis.GetDatabase();
        var coordinator = new DatabasePoolCoordinator(cache, partition, (t, _) => t == tenant ? new[] { pool } : Array.Empty<Database>(), (_, _) => false);
        using var held = pool.CreateConnection(true);
        using var transaction = held.BeginTransaction();
        try
        {
            using var blocked = pool.CreateConnection(true);
            throw new Exception("Fixture did not exhaust its pool");
        }
        catch (Exception e) when (Database.ClassifyConnectionFailure(e) == "DatabasePoolExhausted") { }
        await coordinator.TickAsync();
        await cache.HashSetAsync(partition + ":ready", coordinator.NodeId, JsonConvert.SerializeObject(pool.GetConnectionPoolSnapshot()));
        var deadline = DateTime.UtcNow.AddSeconds(90);
        while (DateTime.UtcNow < deadline && !await cache.KeyExistsAsync(partition + ":stop"))
        {
            await coordinator.TickAsync();
            if (pool.GetConnectionPoolSnapshot().Generation > 0)
            {
                using var command = held.CreateCommand();
                command.Transaction = transaction; command.CommandText = "SELECT 1";
                var stillUsable = Convert.ToInt32(await command.ExecuteScalarAsync()) == 1;
                await cache.HashSetAsync(partition + ":verified", coordinator.NodeId, JsonConvert.SerializeObject(new
                { TransactionSurvived = stillUsable, Generation = pool.GetConnectionPoolSnapshot().Generation }));
            }
            await Task.Delay(100);
        }
        transaction.Rollback();
    }
}
