using System.Diagnostics;
using System.Runtime.CompilerServices;
using Jint;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Newtonsoft.Json.Linq;

// 隔离测试宿主：只使用测试租户和指定的本机测试数据库。
if (args.FirstOrDefault() == "segments")
{
    await SegmentRotationRegression.RunAsync(int.Parse(args[1]), Path.GetFullPath(args[2]));
    return;
}
if (args.FirstOrDefault() == "sql")
{
    BoundedQueryRegression.Run();
    return;
}
if (args.FirstOrDefault() == "benchmark")
{
    ObservationBenchmark.Run();
    return;
}
if (args.FirstOrDefault() == "identity")
{
    await IdentityRefreshRegression.RunAsync(Path.GetFullPath(args[1]));
    return;
}
if (args.FirstOrDefault() == "http")
{
    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(50) };
    Console.WriteLine(await client.GetStringAsync(args[1]));
    return;
}
if (args.FirstOrDefault() == "serve")
{
    var root = Path.GetFullPath(args[1]);
    Directory.CreateDirectory(root);
    Environment.SetEnvironmentVariable("OsClient", "memorytesta");
    var unusedSql = new Dos.ORM.DbSession(Dos.ORM.DatabaseType.MySql, "Server=127.0.0.1;Port=1;Database=unused;User ID=unused;");
    foreach (var tenant in new[] { "memorytesta", "memorytestb" })
        OsClient.ClientList[tenant] = new OsClientSecret { OsClient = tenant, Db = unusedSql, DbRead = unusedSql,
            OsClientModel = new JObject { ["Id"] = tenant, ["DbMongoConnection"] = args[2] } };
    var builder = WebApplication.CreateBuilder(new WebApplicationOptions { ContentRootPath = root });
    builder.WebHost.UseUrls("http://127.0.0.1:0");
    builder.Services.AddSingleton<IMemoryIncidentRepository, V8MongoDB>();
    builder.Services.AddSingleton<MemoryDiagnosticsService>();
    builder.Services.AddSingleton<IMemoryDiagnosticsRuntime>(sp => sp.GetRequiredService<MemoryDiagnosticsService>());
    builder.Services.AddHostedService(sp => sp.GetRequiredService<MemoryDiagnosticsService>());
    var app = builder.Build();
    app.UseMiddleware<SystemObservabilityMiddleware>();
    app.MapGet("/trace", (HttpContext context) =>
    {
        ExecutionObservation.Annotate(tenant: "memorytesta", key: "probe-trace");
        return new { RequestId = context.TraceIdentifier, TraceId = MicroiTraceContext.RequestTraceId(context), ExecutionId = ExecutionObservation.CurrentExecutionId };
    });
    app.MapGet("/memory", async (IMemoryDiagnosticsRuntime runtime) => (await runtime.QueryAsync("memory", "memorytesta", "", default)).ToString());
    app.MapGet("/incidents/{tenant}", async (string tenant, IMemoryDiagnosticsRuntime runtime) => (await runtime.QueryAsync("memoryincidents", tenant, "", default)).ToString());
    app.MapGet("/incident/{tenant}/{id}", async (string tenant, string id, IMemoryDiagnosticsRuntime runtime) => (await runtime.QueryAsync("memoryincident", tenant, id, default)).ToString());
    app.MapGet("/allocate", async (HttpContext context) =>
    {
        ExecutionObservation.Annotate(tenant: "memorytesta", key: "probe-batch");
        using var apiTrace = MicroiTraceContext.StartActivity("probe-api");
        using var api = ExecutionObservation.Enter("ApiEngine", "probe-batch", "memorytesta");
        using var v8Trace = MicroiTraceContext.StartActivity("probe-v8");
        using var script = ExecutionObservation.Enter("V8", "probe-batch", "memorytesta", "test_orders", "SubmitAfterServerV8", "var rows = []; /* allocation probe */");
        var retained = new List<byte[]>();
        for (var i = 0; i < 192; i++) { var bytes = new byte[2 * 1024 * 1024]; bytes[0] = 1; retained.Add(bytes); }
        ExecutionObservation.Pulse();
        var deadline = DateTime.UtcNow.AddSeconds(35);
        while (DateTime.UtcNow < deadline)
        {
            ProbeAllocation();
            ExecutionObservation.Pulse();
            await Task.Delay(5);
        }
        GC.KeepAlive(retained);
        return new { Done = true };
    });
    await app.StartAsync();
    File.WriteAllText(Path.Combine(root, "ready.json"), System.Text.Json.JsonSerializer.Serialize(new { Url = app.Urls.Single(), ProcessId = Environment.ProcessId, BootId = ExecutionObservation.BootId }));
    await app.WaitForShutdownAsync();
    return;
}

var results = new List<object>();
void Check(string name, Action test)
{
    var timer = Stopwatch.StartNew();
    test(); results.Add(new { Name = name, Passed = true, ElapsedMs = timer.ElapsedMilliseconds });
}
void Assert(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
Check("W3C trace fallback is stable and separate from request id", () =>
{
    var context = new DefaultHttpContext { TraceIdentifier = "0HNK8VLTM0001:00000001" };
    using var activity = MicroiTraceContext.EnsureRequestActivity(context);
    var trace = MicroiTraceContext.RequestTraceId(context);
    Assert(trace.Length == 32 && trace.All(Uri.IsHexDigit) && trace != context.TraceIdentifier, "invalid W3C trace");
    Assert(trace == MicroiTraceContext.CurrentTraceId && trace == MicroiTraceContext.RequestTraceId(context), "inconsistent trace");
});
Check("500 active requests report real count and explicit truncated sample", () =>
{
    var leases = new List<SystemObservabilityService.RequestObservabilityLease>();
    var contexts = new List<DefaultHttpContext>();
    for (var i = 0; i < 500; i++)
    {
        var context = new DefaultHttpContext(); context.Request.Path = "/apiengine/probe-" + i;
        contexts.Add(context); leases.Add(SystemObservabilityService.Begin(context));
    }
    try
    {
        var snapshot = SystemObservabilityService.GetSnapshot(5, 50);
        Assert(snapshot.Requests.ActiveRequestCount >= 500, "count was limited to display sample");
        Assert(snapshot.ActiveSampleCount == 100 && snapshot.ActiveSampleTruncated, "sample not explicit");
    }
    finally { for (var i = 0; i < leases.Count; i++) leases[i]?.Complete(contexts[i], false); }
});
Check("Nested async allocations retain identity without charging unrelated tenant", () =>
{
    using var activity = MicroiTraceContext.StartActivity("test-allocation");
    using var parent = ExecutionObservation.Enter("ApiEngine", "parent", "allocation-a");
    var parentId = ExecutionObservation.CurrentExecutionId;
    string childId = "";
    Task.Run(async () =>
    {
        using var child = ExecutionObservation.Enter("V8", "child", "allocation-a", "orders", "DataFilterV8", "return 42;");
        childId = ExecutionObservation.CurrentExecutionId;
        await Task.Delay(1);
        var buffer = new byte[2 * 1024 * 1024];
        ExecutionObservation.Pulse(); GC.KeepAlive(buffer);
    }).GetAwaiter().GetResult();
    var snapshot = ExecutionObservation.Snapshot("allocation-a");
    var root = snapshot.Active.Single(x => x.ExecutionId == parentId);
    var leaf = snapshot.Recent.Single(x => x.ExecutionId == childId);
    Assert(leaf.ParentExecutionId == root.ExecutionId && leaf.RootExecutionId == root.ExecutionId, "lost async ancestry");
    Assert(leaf.ExclusiveAllocatedBytes >= 2 * 1024 * 1024 && root.InclusiveAllocatedBytes >= leaf.ExclusiveAllocatedBytes, "missing allocation");
    Assert(root.ExclusiveAllocatedBytes < leaf.ExclusiveAllocatedBytes, "child charged to parent exclusive counter");
    Assert(leaf.ScriptHash.Length == 64 && leaf.TraceId == root.TraceId, "missing code or trace identity");
    Assert(ExecutionObservation.Snapshot("allocation-b").ActiveCount == 0, "tenant leak");
});
Check("V8 limit OFF still reports progress and permits complex script", () =>
{
    var limits = CreateV8EngineParam.FromTrustedDiyTable(new JObject(), new JObject { ["V8Limit"] = 0 });
    Assert(limits.UnlimitedRuntime, "V8Limit OFF must remain unlimited");
    using var execution = ExecutionObservation.Enter("V8", "unlimited-test", "unlimited", eventName: "SubmitAfterServerV8", script: "var sum=0;for(var i=0;i<200000;i++)sum+=i;sum;");
    using var engine = new V8Engine().CreateEngine(limits);
    var result = engine.Evaluate("var sum=0;for(var i=0;i<200000;i++)sum+=i;sum;").AsNumber();
    ExecutionObservation.Pulse();
    Assert(result == 19999900000D, "script failed");
    Assert(ExecutionObservation.Snapshot("unlimited").Active.Single().InclusiveAllocatedBytes > 0, "unlimited execution invisible");
});
Check("Failed nested execution restores parent identity and records allocation", () =>
{
    using var parent = ExecutionObservation.Enter("ApiEngine", "exception-parent", "exception-test");
    var parentId = ExecutionObservation.CurrentExecutionId;
    string failedId = "";
    try
    {
        using var child = ExecutionObservation.Enter("V8", "exception-child", "exception-test");
        failedId = ExecutionObservation.CurrentExecutionId;
        GC.KeepAlive(new byte[1024 * 1024]);
        child.Failed();
        throw new InvalidOperationException("isolated expected failure");
    }
    catch (InvalidOperationException) { }
    var snapshot = ExecutionObservation.Snapshot("exception-test");
    Assert(ExecutionObservation.CurrentExecutionId == parentId && snapshot.ActiveCount == 1, "failed child retained current identity");
    Assert(snapshot.Recent.Any(s => s.ExecutionId == failedId && s.Outcome == "Failed" && s.ExclusiveAllocatedBytes >= 1024 * 1024), "failed child lost attribution");
});
Check("Pressure trigger uses host headroom and cgroup, not only API/host fraction", () =>
{
    var high = new MemoryDiagnosticsMetrics { RssBytes = 23L << 30, HostTotalBytes = 64L << 30, HostAvailableBytes = 1L << 30 };
    Assert(MemoryDiagnosticsMetrics.Triggers(high, null).Contains("HostMemoryPressure"), "23/64 must detect aggregate host pressure");
    var container = new MemoryDiagnosticsMetrics { ContainerCurrentBytes = 900L << 20, ContainerLimitBytes = 1L << 30 };
    Assert(MemoryDiagnosticsMetrics.Triggers(container, null).Contains("ContainerMemoryPressure"), "container pressure missed");
    Assert(!MemoryDiagnosticsMetrics.Triggers(new MemoryDiagnosticsMetrics(), null).Contains("HostMemoryPressure"), "unavailable metrics are not zero");
});
Check("Memory query exposes incompatible helper instead of reporting healthy empty attribution", () =>
{
    var root = Path.GetFullPath(Path.Combine(args.FirstOrDefault() ?? Path.GetTempPath(), "protocol-query"));
    Directory.CreateDirectory(root);
    var builder = WebApplication.CreateBuilder(new WebApplicationOptions { ContentRootPath = root });
    using var services = builder.Services.BuildServiceProvider();
    using var runtime = new MemoryDiagnosticsService(builder.Environment, services);
    var store = new MemoryDiagnosticsStore(Path.Combine(root, "logs", "memory-diagnostics"));
    var file = Path.Combine(store.BootDirectory(ExecutionObservation.BootId), "collector.json");
    var state = new JObject { ["Status"] = "Collecting", ["SampledAtUtc"] = DateTime.UtcNow, ["Error"] = "" };
    store.Write(file, state);
    var old = runtime.QueryAsync("memory", "protocol-test", "", default).GetAwaiter().GetResult();
    Assert(old["Collector"]!.Value<string>("Status") == "Degraded" && old["Collector"]!.Value<string>("Error")!.Contains("IdentityProtocolMismatch"), "old helper was marked healthy");
    state["IdentityProtocolVersion"] = 2; state["BackgroundIdentityRefreshes"] = 5;
    store.Write(file, state);
    var current = runtime.QueryAsync("memory", "protocol-test", "", default).GetAwaiter().GetResult();
    Assert(current["Collector"]!.Value<string>("Status") == "Collecting" && current["Collector"]!.Value<long>("BackgroundIdentityRefreshes") == 5, "new helper metadata missing in Memory contract");
    Assert(current["Executions"]!.Value<string>("ObservationMode") == "BoundaryAccounting+BackgroundIdentity", "observation mode not visible to MCP");
});
Check("Incident projection filters nested allocation and stack identities", () =>
{
    var raw = JObject.Parse("""{"Executions":[{"OsClient":"a","Key":"allowed"},{"OsClient":"b","Key":"secret"}],"AllocationTop":[{"Execution":{"OsClient":"a"}},{"Execution":{"OsClient":"b","Key":"secret"}}],"Stacks":{"Top":[{"Execution":{"OsClient":"b","Key":"secret"}}]}}""");
    var tenant = MemoryDiagnosticsStore.ForTenant(raw, "a").ToString();
    Assert(tenant.Contains("allowed") && !tenant.Contains("secret"), "cross-tenant evidence leaked");
    raw["Stacks"]!["Samples"] = 10; raw["Stacks"]!["MissingStackSamples"] = 3;
    var partial = MemoryDiagnosticsStore.ForTenant(raw, "a");
    Assert(partial.Value<string>("Boundary")!.Contains("3 条缺少方法栈")
        && partial["Evidence"]!["StackQuality"]!.Value<int>("MissingStackSamples") == 3, "partial stacks hidden from platform operator");
});
Check("Atomic incident WAL survives new store and summary list excludes payload", () =>
{
    var root = args.FirstOrDefault() ?? Path.Combine(Path.GetTempPath(), "microi-memory-tests-" + Guid.NewGuid().ToString("N"));
    var store = new MemoryDiagnosticsStore(root);
    var boot = Guid.NewGuid().ToString("N"); var id = Guid.NewGuid().ToString("N");
    var incident = new JObject { ["Id"] = id, ["Tenant"] = "test-a", ["BootId"] = boot, ["UpdatedAtUtc"] = DateTime.UtcNow, ["Frames"] = new JArray("large-detail") };
    store.SaveIncident(boot, incident); store.SaveIncident(boot, incident);
    var restarted = new MemoryDiagnosticsStore(root);
    Assert(restarted.LocalIncidents("test-a").Count() == 1, "duplicate WAL");
    Assert(!restarted.LocalIncidents("test-a").Single().ContainsKey("Frames"), "list loaded full payload");
    Assert(restarted.LocalIncidents("test-a", id).Single()["Frames"] != null, "detail lost after restart");
    Assert(!restarted.LocalIncidents("test-b").Any(), "tenant list leak");
});
Check("Shared-volume retention never removes another live node checkpoint", () =>
{
    var root = Path.Combine(args.FirstOrDefault() ?? Path.GetTempPath(), "lease-retention");
    var store = new MemoryDiagnosticsStore(root);
    var liveBoot = Guid.NewGuid().ToString("N");
    var checkpoint = Path.Combine(store.BootDirectory(liveBoot), "checkpoint.json");
    store.Write(checkpoint, new JObject { ["NodeId"] = "different-container-hostname" });
    File.SetLastWriteTimeUtc(checkpoint, DateTime.UtcNow.AddDays(-20));
    foreach (var owner in new[] { "host.lock", "collector.lock", "stacks-recovered.json.lock" })
    {
        using var lease = new FileStream(Path.Combine(store.BootDirectory(liveBoot), owner), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        store.Trim(Guid.NewGuid().ToString("N"));
        Assert(File.Exists(checkpoint), "active node checkpoint deleted");
    }
    store.Trim(Guid.NewGuid().ToString("N"));
    Assert(!File.Exists(checkpoint), "expired stopped node checkpoint not trimmed");
});
if (args.Length > 1)
{
    Check("Mongo replay is monotonic and resident memory is available", () =>
    {
        var tenant = "memoryrepositorytest";
        var unusedSql = new Dos.ORM.DbSession(Dos.ORM.DatabaseType.MySql, "Server=127.0.0.1;Port=1;Database=unused;User ID=unused;");
        OsClient.ClientList[tenant] = new OsClientSecret { OsClient = tenant, Db = unusedSql, DbRead = unusedSql,
            OsClientModel = new JObject { ["Id"] = tenant, ["DbMongoConnection"] = args[1] } };
        var repository = (IMemoryIncidentRepository)new V8MongoDB();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        var incident = new JObject { ["Id"] = Guid.NewGuid().ToString("N"), ["Tenant"] = tenant,
            ["OccurredAtUtc"] = DateTime.UtcNow, ["UpdatedAtUtc"] = DateTime.UtcNow, ["Status"] = "new" };
        repository.SaveAsync(tenant, incident, timeout.Token).GetAwaiter().GetResult();
        var stale = (JObject)incident.DeepClone();
        stale["UpdatedAtUtc"] = incident.Value<DateTime>("UpdatedAtUtc").AddSeconds(-10);
        stale["Status"] = "stale";
        repository.SaveAsync(tenant, stale, timeout.Token).GetAwaiter().GetResult();
        repository.SaveAsync(tenant, incident, timeout.Token).GetAwaiter().GetResult();
        Assert(repository.GetAsync(tenant, incident.Value<string>("Id"), timeout.Token).GetAwaiter().GetResult().Value<string>("Status") == "new", "old WAL replaced newer evidence");
        Assert(repository.ListAsync(tenant, 50, timeout.Token).GetAwaiter().GetResult().Count(x => x.Value<string>("Id") == incident.Value<string>("Id")) == 1, "duplicate incident");
        var mongo = repository.GetMemoryStatusAsync(tenant, timeout.Token).GetAwaiter().GetResult();
        Assert(mongo.Value<long?>("ResidentBytes") > 0 && mongo.Value<long?>("WiredTigerCacheLimitBytes") > 0, "resident/cache metrics missing");
        Console.WriteLine("Mongo metrics: " + mongo.ToString(Newtonsoft.Json.Formatting.None));
    });
}
Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { Passed = results.Count, Tests = results }));

[MethodImpl(MethodImplOptions.NoInlining)]
static void ProbeAllocation()
{
    var bytes = new byte[1024 * 1024]; bytes[0] = 1; GC.KeepAlive(bytes);
}
