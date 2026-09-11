using System.Diagnostics;
using Dos.ORM;
using Microi.net;
using MySql.Data.MySqlClient;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.Tests.Common;

[Trait("Category", "FullStack")]
public sealed class DatabasePoolRecoveryIntegrationTests
{
    internal static string Connection()
    {
        var raw = Environment.GetEnvironmentVariable("MICROI_UPGRADE_TEST_CONN");
        Assert.False(string.IsNullOrWhiteSpace(raw), "Full 连接池测试需要隔离本地 MySQL。");
        var settings = new MySqlConnectionStringBuilder(raw);
        Assert.Contains(settings.Server, new[] { "127.0.0.1", "localhost" });
        settings.MaximumPoolSize = 1; settings.MinimumPoolSize = 0; settings.ConnectionTimeout = 1;
        settings.Pooling = true;
        // 每次测试使用独立池身份，不能耗尽其它并行回归的池。
        settings.ConnectionLifeTime = (uint)Random.Shared.Next(600, int.MaxValue);
        return settings.ConnectionString;
    }
    internal static string RedisAddress()
    {
        var address = Environment.GetEnvironmentVariable("MICROI_POOL_TEST_REDIS")
            ?? Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_REDIS");
        Assert.Matches(@"^127\.0\.0\.1:\d{1,5}$", address ?? "");
        return address!;
    }

    [Fact]
    public async Task RealMySql_Exhaustion_IsolatedAuthAndRotation_DoNotKillBorrowedTransaction()
    {
        var db = new DbSession(DatabaseType.MySql, Connection()).Db;
        using var held = db.CreateConnection(true);
        using var transaction = held.BeginTransaction();
        var ex = Assert.ThrowsAny<Exception>(() => db.CreateConnection(true));
        Assert.Equal("DatabasePoolExhausted", Database.ClassifyConnectionFailure(ex));
        Assert.True(db.GetConnectionPoolSnapshot().BackoffSeconds > 0);
        using (Database.BeginIsolatedConnections())
        using (var independent = db.CreateConnection(true))
        {
            Assert.False(new MySqlConnectionStringBuilder(independent.ConnectionString).Pooling);
            Assert.NotSame(held, independent);
        }
        db.ResetConnectionPool();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        Assert.Null(await db.ProbeConnectionPoolAsync(timeout.Token));
        using var command = held.CreateCommand();
        command.Transaction = transaction; command.CommandText = "SELECT 1";
        Assert.Equal(1, Convert.ToInt32(await command.ExecuteScalarAsync()));
        transaction.Rollback();
        Assert.Equal(0, db.GetConnectionPoolSnapshot().BackoffSeconds);
    }

    [Fact]
    public async Task RealSqlServer_RotationRecoversPool_AndPreservesBorrowedTransaction()
    {
        var raw = Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN");
        Assert.False(string.IsNullOrWhiteSpace(raw), "Full 连接池测试需要隔离本地 SQL Server。");
        var settings = new System.Data.SqlClient.SqlConnectionStringBuilder(raw);
        Assert.Matches(@"^127\.0\.0\.1,\d{1,5}$", settings.DataSource);
        settings.ApplicationName = "pool-recovery-" + Guid.NewGuid().ToString("N");
        settings.MaxPoolSize = 1; settings.MinPoolSize = 0; settings.ConnectTimeout = 1;
        var pool = new DbSession(DatabaseType.SqlServer, settings.ConnectionString).Db;
        using var held = pool.CreateConnection(true);
        using var transaction = held.BeginTransaction();
        Assert.Equal("DatabasePoolExhausted", Database.ClassifyConnectionFailure(Assert.ThrowsAny<Exception>(() => pool.CreateConnection(true))));
        using (Database.BeginIsolatedConnections())
        using (var independent = pool.CreateConnection(true))
            Assert.False(new System.Data.SqlClient.SqlConnectionStringBuilder(independent.ConnectionString).Pooling);
        pool.ResetConnectionPool();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        Assert.Null(await pool.ProbeConnectionPoolAsync(timeout.Token));
        using var command = held.CreateCommand(); command.Transaction = transaction; command.CommandText = "SELECT 1";
        Assert.Equal(1, Convert.ToInt32(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken)));
        transaction.Rollback();
    }

    [Fact]
    public async Task TwoRealProcesses_RecoverOnce_KeepTransactions_ReportEveryNodeAndRejectDrift()
    {
        var connection = Connection();
        var pool = new DbSession(DatabaseType.MySql, connection).Db;
        using var redis = await ConnectionMultiplexer.ConnectAsync(RedisAddress());
        var cache = redis.GetDatabase();
        var partition = "pool-recovery-" + Guid.NewGuid().ToString("N");
        var tenant = "tenant-" + Guid.NewGuid().ToString("N");
        var coordinator = new DatabasePoolCoordinator(cache, partition, (t, _) => t == tenant ? new[] { pool } : Array.Empty<Database>(), (_, _) => false);
        var workers = new List<Process>();
        try
        {
            for (var i = 0; i < 2; i++) workers.Add(StartNode(connection, partition, tenant));
            await Until(async () => await cache.HashLengthAsync(partition + ":ready") == 2);
            var ready = await cache.HashGetAllAsync(partition + ":ready");
            Assert.All(ready, r => Assert.Equal("DatabasePoolExhausted", JObject.Parse(r.Value.ToString()).Value<string>("FailureCode")));
            var preview = await coordinator.PreviewAsync(tenant, "Both");
            var id = preview.Value<string>("OperationId")!;
            var ids = preview["PoolIds"]!.ToObject<string[]>()!;
            var accepted = await coordinator.SubmitAsync(tenant, "Both", id, ids, "administrator");
            Assert.Equal("Pending", accepted.Value<string>("State"));
            await Until(async () =>
            {
                await coordinator.TickAsync();
                return (await coordinator.StatusAsync(tenant, id)).Value<string>("State") == "CompletedForRegisteredNodes";
            });
            await Until(async () => await cache.HashLengthAsync(partition + ":verified") == 2);
            var verified = await cache.HashGetAllAsync(partition + ":verified");
            Assert.All(verified, r => Assert.True(JObject.Parse(r.Value.ToString()).Value<bool>("TransactionSurvived")));
            var repeat = await coordinator.SubmitAsync(tenant, "Both", id, ids, "administrator");
            Assert.Equal(3, repeat["Nodes"]!.Count());
            await coordinator.TickAsync();
            Assert.Equal(1, pool.GetConnectionPoolSnapshot().Generation);
            Assert.All(verified, r => Assert.Equal(1, JObject.Parse(r.Value.ToString()).Value<int>("Generation")));
            await Assert.ThrowsAsync<InvalidOperationException>(() => coordinator.SubmitAsync(tenant, "Read", id, ids, "administrator"));
            var next = await coordinator.PreviewAsync(tenant, "Both");
            var drift = await Assert.ThrowsAsync<InvalidOperationException>(() => coordinator.SubmitAsync(tenant, "Both", next.Value<string>("OperationId")!, new[] { new string('0', 64) }, "administrator"));
            Assert.Equal("PoolConfigurationChanged", drift.Message);
            var cooldown = await Assert.ThrowsAsync<InvalidOperationException>(() => coordinator.SubmitAsync(tenant, "Both", next.Value<string>("OperationId")!, ids, "administrator"));
            Assert.Equal("PoolRecoveryCooldown60Seconds", cooldown.Message);
            var expired = await Assert.ThrowsAsync<InvalidOperationException>(() => coordinator.SubmitAsync(tenant, "Both", Guid.NewGuid().ToString("N"), ids, "administrator"));
            Assert.Equal("PoolRecoveryPreviewExpired", expired.Message);
            await Assert.ThrowsAsync<InvalidOperationException>(() => coordinator.StatusAsync("another-tenant", id));
            var shared = new DatabasePoolCoordinator(cache, partition, (_, _) => new[] { pool }, (_, _) => true);
            Assert.False((await shared.PreviewAsync(tenant, "Both")).Value<bool>("CanReset"));
        }
        finally
        {
            await cache.StringSetAsync(partition + ":stop", "1", TimeSpan.FromMinutes(2));
            foreach (var worker in workers)
            {
                if (!worker.WaitForExit(5000)) worker.Kill(entireProcessTree: true);
                var error = await worker.StandardError.ReadToEndAsync();
                Assert.True(worker.ExitCode == 0, "独立连接池节点失败：" + error);
                worker.Dispose();
            }
        }
    }

    internal static async Task Until(Func<Task<bool>> predicate)
    {
        var deadline = DateTime.UtcNow.AddSeconds(40);
        while (DateTime.UtcNow < deadline)
        {
            if (await predicate()) return;
            await Task.Delay(100);
        }
        Assert.Fail("隔离连接池故障验收未在时限内完成。");
    }

    internal static Process StartNode(string connection, string partition, string tenant, string mode = "recovery")
    {
        var path = Environment.GetEnvironmentVariable("MICROI_POOL_NODE_DLL");
        if (string.IsNullOrWhiteSpace(path))
        {
            var output = new DirectoryInfo(AppContext.BaseDirectory);
            var artifacts = Path.GetFullPath(Path.Combine(output.FullName, "..", "..", "DatabasePoolNode", output.Name, "Microi.PoolRecoveryNode.dll"));
            var configuration = typeof(DatabasePoolNodeHarness).Assembly
                .GetCustomAttributes(typeof(System.Reflection.AssemblyConfigurationAttribute), false)
                .Cast<System.Reflection.AssemblyConfigurationAttribute>().Single().Configuration;
            var root = AppContext.BaseDirectory;
            while (!Directory.Exists(Path.Combine(root, "Microi.Server"))) root = Directory.GetParent(root)?.FullName ?? throw new InvalidOperationException("Workspace not found");
            var regular = Path.Combine(root, "Microi.Server", "Microi.Tests", "Fixtures", "DatabasePoolNode", "bin", configuration, output.Name, "Microi.PoolRecoveryNode.dll");
            // 依据当前程序集的输出布局与 Configuration 选定唯一候选，禁止缺失时借用旧 Debug 产物。
            path = output.Parent?.Name == configuration && output.Parent.Parent?.Name == "bin" ? regular : artifacts;
        }
        Assert.True(File.Exists(path), "须先构建 DatabasePoolNode 独立回归夹具。");
        var start = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardOutput = true };
        start.ArgumentList.Add(path!);
        start.Environment["MICROI_POOL_TEST_CONNECTION"] = connection;
        start.Environment["MICROI_POOL_TEST_PARTITION"] = partition;
        start.Environment["MICROI_POOL_TEST_TENANT"] = tenant;
        start.Environment["MICROI_POOL_TEST_REDIS"] = RedisAddress();
        start.Environment["MICROI_POOL_TEST_ASSEMBLY"] = typeof(DatabasePoolNodeHarness).Assembly.Location;
        start.Environment["MICROI_POOL_TEST_MODE"] = mode;
        return Process.Start(start)!;
    }
}
