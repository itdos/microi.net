using System.Collections.Concurrent;
using System.Diagnostics;
using System.Reflection;
using Microi.net;
using Microi.net.Api;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

const int total = 100_000;
const int producerConcurrency = 256;
const int simulatedMongoFailures = 3;
const int distributedUnique = 20_000;
const int restartRecoveryCount = 1_000;

var spool = Path.Combine(Path.GetTempPath(), "microi-syslog-load-" + Guid.NewGuid().ToString("N"));
Environment.SetEnvironmentVariable("MICROI_SYSLOG_SPOOL_DIR", spool);
Directory.CreateDirectory(spool);

try
{
    var mongo = DispatchProxy.Create<IMongoDB, FakeMongoProxy>();
    var fake = (FakeMongoProxy)(object)mongo;
    fake.FailuresRemaining = simulatedMongoFailures;
    var environment = new TestHostEnvironment { ContentRootPath = spool };
    var queue = new SysLogQueueService(mongo, NullLogger<SysLogQueueService>.Instance, environment);
    await queue.StartAsync(CancellationToken.None);

    var latencies = new long[total];
    var accepted = 0;
    var run = Stopwatch.StartNew();
    Parallel.For(0, total, new ParallelOptions { MaxDegreeOfParallelism = producerConcurrency }, i =>
    {
        var started = Stopwatch.GetTimestamp();
        if (queue.Enqueue(new SysLogParam
        {
            OsClient = "loadtest",
            Category = "LoadTest",
            Action = "Enqueue",
            UserId = "perf-user",
            UserName = "压力测试用户(perf)",
            TargetId = i.ToString(),
            Title = "日志队列压测",
            OccurredAt = DateTime.Now
        })) Interlocked.Increment(ref accepted);
        latencies[i] = Stopwatch.GetTimestamp() - started;
    });
    run.Stop();

    // 立刻停机，覆盖“局部批次已取出但尚未满500条”的正常停机窗口。
    using (var stopCts = new CancellationTokenSource(TimeSpan.FromSeconds(30)))
        await queue.StopAsync(stopCts.Token);
    using (var flushCts = new CancellationTokenSource(TimeSpan.FromSeconds(30)))
    {
        // 生产服务每5秒重放一次；测试用短循环等价模拟多轮故障恢复。
        for (var attempt = 0; attempt < simulatedMongoFailures + 3 && Directory.EnumerateFiles(spool, "*.json").Any(); attempt++)
        {
            await queue.FlushAsync(flushCts.Token);
            await Task.Delay(25, flushCts.Token);
        }
    }

    Array.Sort(latencies);
    double ToMicroseconds(long ticks) => ticks * 1_000_000d / Stopwatch.Frequency;
    var health = queue.GetHealth();
    var remainingSpools = Directory.EnumerateFiles(spool, "*.json").Count();
    var p95 = ToMicroseconds(latencies[(int)(total * 0.95)]);
    var p99 = ToMicroseconds(latencies[(int)(total * 0.99)]);
    var rps = total / run.Elapsed.TotalSeconds;

    Console.WriteLine($"Accepted={accepted}; UniquePersisted={fake.UniqueEvents.Count}; MongoCalls={fake.AddSysLogsCalls}; SimulatedFailures={simulatedMongoFailures}");
    Console.WriteLine($"EnqueueSeconds={run.Elapsed.TotalSeconds:F3}; EnqueueRps={rps:F0}; P95={p95:F2}us; P99={p99:F2}us");
    Console.WriteLine($"QueuePending={health.Pending}; OverflowPending={health.OverflowPending}; FailedBatches={health.FailedBatches}; RemainingSpools={remainingSpools}; LastError={health.LastError}");

    if (accepted != total) throw new InvalidOperationException($"入队成功数不符：{accepted}/{total}");
    if (fake.UniqueEvents.Count != total) throw new InvalidOperationException($"唯一持久化事件数不符：{fake.UniqueEvents.Count}/{total}");
    if (remainingSpools != 0 || health.Pending != 0 || health.OverflowPending != 0)
        throw new InvalidOperationException("重放后仍有待处理事件或spool文件。");
    Console.WriteLine("PASS: 10万事件并发入队、Mongo故障spool重放、EventId幂等和正常停机零丢失均通过。");

    // 两个节点连接同一Mongo：相同EventId即使被重复投递，也只能形成一条最终记录。
    var node1Spool = Path.Combine(spool, "node-1");
    var node2Spool = Path.Combine(spool, "node-2");
    Environment.SetEnvironmentVariable("MICROI_SYSLOG_SPOOL_DIR", node1Spool);
    Environment.SetEnvironmentVariable("MICROI_NODE_ID", "load-node-1");
    var node1 = new SysLogQueueService(mongo, NullLogger<SysLogQueueService>.Instance, environment);
    Environment.SetEnvironmentVariable("MICROI_SYSLOG_SPOOL_DIR", node2Spool);
    Environment.SetEnvironmentVariable("MICROI_NODE_ID", "load-node-2");
    var node2 = new SysLogQueueService(mongo, NullLogger<SysLogQueueService>.Instance, environment);
    await node1.StartAsync(CancellationToken.None);
    await node2.StartAsync(CancellationToken.None);
    Parallel.For(0, distributedUnique, new ParallelOptions { MaxDegreeOfParallelism = producerConcurrency }, i =>
    {
        var eventId = UserBehaviorAudit.DeterministicEventId($"distributed-duplicate|{i}");
        var first = new SysLogParam { EventId = eventId, OsClient = "loadtest", Action = "DistributedDuplicate", TargetId = i.ToString() };
        var second = new SysLogParam { EventId = eventId, OsClient = "loadtest", Action = "DistributedDuplicate", TargetId = i.ToString() };
        if (!node1.Enqueue(first) || !node2.Enqueue(second)) throw new InvalidOperationException("多节点入队失败。");
    });
    using (var stopCts = new CancellationTokenSource(TimeSpan.FromSeconds(30)))
        await Task.WhenAll(node1.StopAsync(stopCts.Token), node2.StopAsync(stopCts.Token));
    using (var flushCts = new CancellationTokenSource(TimeSpan.FromSeconds(30)))
        await Task.WhenAll(node1.FlushAsync(flushCts.Token), node2.FlushAsync(flushCts.Token));
    if (fake.UniqueEvents.Count != total + distributedUnique)
        throw new InvalidOperationException($"跨节点EventId幂等失败：{fake.UniqueEvents.Count}/{total + distributedUnique}");

    // 模拟Mongo故障时节点退出，并把一个完整json改为异常中断可能遗留的json.tmp；新实例必须自动恢复重放。
    var recoverySpool = Path.Combine(spool, "restart-node");
    Environment.SetEnvironmentVariable("MICROI_SYSLOG_SPOOL_DIR", recoverySpool);
    Environment.SetEnvironmentVariable("MICROI_NODE_ID", "stable-restart-node");
    Interlocked.Exchange(ref fake.FailuresRemaining, 1000);
    var beforeRestart = new SysLogQueueService(mongo, NullLogger<SysLogQueueService>.Instance, environment);
    await beforeRestart.StartAsync(CancellationToken.None);
    for (var i = 0; i < restartRecoveryCount; i++)
        beforeRestart.Enqueue(new SysLogParam
        {
            EventId = UserBehaviorAudit.DeterministicEventId($"restart-recovery|{i}"),
            OsClient = "loadtest",
            Action = "RestartRecovery",
            TargetId = i.ToString()
        });
    using (var stopCts = new CancellationTokenSource(TimeSpan.FromSeconds(30)))
        await beforeRestart.StopAsync(stopCts.Token);
    var recoveryFile = Directory.EnumerateFiles(recoverySpool, "*.json").FirstOrDefault()
        ?? throw new InvalidOperationException("未生成重启恢复spool文件。");
    File.Move(recoveryFile, recoveryFile + ".tmp");

    Interlocked.Exchange(ref fake.FailuresRemaining, 0);
    var afterRestart = new SysLogQueueService(mongo, NullLogger<SysLogQueueService>.Instance, environment);
    await afterRestart.StartAsync(CancellationToken.None);
    var recoveryDeadline = DateTime.UtcNow.AddSeconds(30);
    while (fake.UniqueEvents.Count < total + distributedUnique + restartRecoveryCount && DateTime.UtcNow < recoveryDeadline)
        await Task.Delay(25);
    using (var stopCts = new CancellationTokenSource(TimeSpan.FromSeconds(30)))
        await afterRestart.StopAsync(stopCts.Token);
    using (var flushCts = new CancellationTokenSource(TimeSpan.FromSeconds(30)))
        await afterRestart.FlushAsync(flushCts.Token);
    var remainingRecoveryFiles = Directory.EnumerateFiles(recoverySpool, "*.json*").Count();
    if (fake.UniqueEvents.Count != total + distributedUnique + restartRecoveryCount || remainingRecoveryFiles != 0)
        throw new InvalidOperationException("节点重启后spool恢复不完整。");
    Console.WriteLine($"PASS: 双节点重复投递{distributedUnique}个EventId只落一份，节点重启恢复{restartRecoveryCount}个事件，剩余spool={remainingRecoveryFiles}。");
}
finally
{
    Environment.SetEnvironmentVariable("MICROI_SYSLOG_SPOOL_DIR", null);
    Environment.SetEnvironmentVariable("MICROI_NODE_ID", null);
    var resolvedSpool = Path.GetFullPath(spool);
    var resolvedTemp = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
    if (resolvedSpool.StartsWith(resolvedTemp, StringComparison.OrdinalIgnoreCase)
        && Path.GetFileName(resolvedSpool).StartsWith("microi-syslog-load-", StringComparison.Ordinal)
        && Directory.Exists(resolvedSpool))
        Directory.Delete(resolvedSpool, true);
}

public class FakeMongoProxy : DispatchProxy
{
    public int FailuresRemaining;
    public int AddSysLogsCalls;
    public ConcurrentDictionary<string, byte> UniqueEvents { get; } = new(StringComparer.Ordinal);

    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        if (targetMethod?.Name == nameof(IMongoDB.AddSysLogs))
        {
            Interlocked.Increment(ref AddSysLogsCalls);
            if (Interlocked.Decrement(ref FailuresRemaining) >= 0)
                return Task.FromResult(new Dos.Common.DosResult(0, null, "simulated mongo outage"));
            foreach (var item in (IEnumerable<SysLogParam>)args![0]!)
                UniqueEvents.TryAdd(item.EventId, 0);
            return Task.FromResult(new Dos.Common.DosResult(1));
        }
        throw new NotSupportedException($"Load test did not expect IMongoDB.{targetMethod?.Name}");
    }
}

public sealed class TestHostEnvironment : IHostEnvironment
{
    public string EnvironmentName { get; set; } = Environments.Development;
    public string ApplicationName { get; set; } = "SysLogQueueLoadTest";
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
