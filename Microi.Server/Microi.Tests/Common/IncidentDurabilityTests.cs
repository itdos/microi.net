using System.Net;
using System.Net.Sockets;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class IncidentDurabilityTests
{
    [Fact]
    public void Incident_RetainsBlockedRequestEvidenceAfterRecovery()
    {
        // 只调用合并逻辑，不启动宿主/采样线程；防止事故结束后空快照覆盖真正的阻塞现场。
        var service = (MemoryDiagnosticsService)System.Runtime.CompilerServices.RuntimeHelpers.GetUninitializedObject(typeof(MemoryDiagnosticsService));
        typeof(MemoryDiagnosticsService).GetField("_store", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!
            .SetValue(service, new MemoryDiagnosticsStore(Path.GetTempPath()));
        var merge = typeof(MemoryDiagnosticsService).GetMethod("MergeIncident", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)!;
        var incident = Incident("retention-a"); incident["BootId"] = Guid.NewGuid().ToString("N");
        var blocked = new JObject { ["UpdatedAtUtc"] = DateTime.UtcNow, ["Current"] = new JObject { ["ThreadPoolAvailableWorkers"] = 0 },
            ["RequestWaits"] = new JObject { ["Groups"] = new JArray(new JObject { ["OsClient"] = "retention-a", ["Kind"] = "Admission", ["Stage"] = "Gate:V8Tenant", ["Count"] = 9, ["LongestMs"] = 20000 }),
                ["Samples"] = new JArray(new JObject { ["OsClient"] = "retention-a", ["Id"] = "request-id", ["ElapsedMs"] = 20000 }) } };
        var recovered = new JObject { ["UpdatedAtUtc"] = DateTime.UtcNow.AddMinutes(3), ["Current"] = new JObject { ["ThreadPoolAvailableWorkers"] = 100 },
            ["RequestWaits"] = new JObject { ["Groups"] = new JArray(), ["Samples"] = new JArray() } };
        merge.Invoke(service, [incident, recovered]); // 后续更差现场必须替换最初的健康状态。
        merge.Invoke(service, [incident, blocked]);
        merge.Invoke(service, [incident, recovered]);
        var evidence = CriticalIncidentWriter.Project(MemoryDiagnosticsStore.ForTenant(incident, "retention-a"));
        Assert.Equal(9, evidence["WaitEvidence"]?["Groups"]?[0]?.Value<int>("Count"));
        Assert.Equal("request-id", evidence["WaitEvidence"]?["Samples"]?[0]?.Value<string>("Id"));
        Assert.Equal(0, evidence["WaitEvidence"]?["WorstThreadPoolFrame"]?.Value<int>("ThreadPoolAvailableWorkers"));
    }

    [Fact]
    public async Task PendingHttp_IsAttributedBeforeCompletion_WithoutCredentials()
    {
        using var socket = new TcpListener(IPAddress.Loopback, 0); socket.Start();
        var port = ((IPEndPoint)socket.LocalEndpoint).Port;
        using var accept = awaitableServer(socket);
        using var execution = ExecutionObservation.Enter("ApiEngine", "slow-device", "diagnostic-test");
        var http = new DiyHttp();
        var result = http.GetResponseAsync(new DiyHttpParam { Url = $"http://127.0.0.1:{port}/private-secret?token=hidden", Timeout = 10 });
        await accept.Ready.Task.WaitAsync(TimeSpan.FromSeconds(5));
        var snapshot = RequestWaitObservation.Snapshot("diagnostic-test");
        var row = Assert.Single(((JArray)snapshot["Samples"]!).OfType<JObject>().Where(x => x.Value<string>("Kind") == "Http"));
        Assert.Equal("slow-device", row.Value<string>("ApiEngineKey"));
        Assert.Equal("AwaitingHttpCompletion:GET", row.Value<string>("Stage"));
        Assert.Equal(10, row.Value<int>("TimeoutSeconds"));
        Assert.Contains(":" + port, row.Value<string>("Target"));
        Assert.DoesNotContain("private-secret", snapshot.ToString()); Assert.DoesNotContain("hidden", snapshot.ToString());
        accept.Release.SetResult(); await result.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(0, RequestWaitObservation.Snapshot("diagnostic-test").Value<int>("ActiveCount"));
    }

    [Fact]
    public async Task TenantQueueEvidence_IsExact_AndOtherTenantStillEnters()
    {
        var a = "wait-a-" + Guid.NewGuid().ToString("N"); var b = "wait-b-" + Guid.NewGuid().ToString("N");
        var options = new RequestPressureGuardOptions();
        var registry = (System.Collections.Concurrent.ConcurrentDictionary<string, SemaphoreSlim>)typeof(RequestPressureGuardService)
            .GetField("Gates", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic)!.GetValue(null)!;
        var own = new List<string>();
        // 高基数攻击回归会刻意填满全局注册表；此用例验证正常配额排队，使用独立预登记槽，退出仅移除自己的键。
        void Seed(string key, int limit, bool owned = true) { if (registry.TryAdd(key + ":limit:" + limit, new SemaphoreSlim(limit, limit)) && owned) own.Add(key + ":limit:" + limit); }
        Seed("global", options.GlobalMaxConcurrentRequests, false); Seed("v8:global", options.V8GlobalMaxConcurrentRequests, false);
        foreach (var t in new[] { a, b }) {
            Seed("v8:tenant:" + t, 1); Seed("tenant:" + t, options.TenantMaxConcurrentRequests);
            foreach (var api in new[] { "device-a", "device-b" }) Seed("apiengine:" + t + ":" + api, options.ApiEngineMaxConcurrentRequests);
        }
        foreach (var api in new[] { "device-a", "device-b" }) Seed("route:apiengine/" + api, options.RouteMaxConcurrentRequests);
        foreach (var t in new[] { a, b }) OsClientExtend.ClientList[t] = new OsClientSecret { OsClient = t, OsClientModel = new JObject { ["PressV8ReqMax"] = 1 } };
        try
        {
            using var active = await RequestPressureGuardService.TryEnterAsync("/apiengine/device-a", a, options, default);
            using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var waiting = RequestPressureGuardService.TryEnterAsync("/apiengine/device-b", a, options, cancel.Token);
            Assert.False(waiting.IsCompleted);
            var groups = (JArray)RequestWaitObservation.Snapshot(a)["Groups"]!;
            Assert.Contains(groups, x => x.Value<string>("Stage") == "Gate:V8Tenant" && x.Value<int>("Count") == 1);
            using var other = await RequestPressureGuardService.TryEnterAsync("/apiengine/device-b", b, options, cancel.Token);
            Assert.True(other.IsEntered); cancel.Cancel(); using var rejected = await waiting;
            Assert.False(rejected.IsEntered);
            Assert.DoesNotContain((JArray)RequestWaitObservation.Snapshot(b)["Samples"]!, x => x.Value<string>("OsClient") == a);
        }
        finally { foreach (var key in own) registry.TryRemove(key, out _); OsClientExtend.ClientList.TryRemove(a, out _); OsClientExtend.ClientList.TryRemove(b, out _); }
    }

    [Fact]
    public void Projection_IsTenantScoped_AndExplicitlyBounded()
    {
        using var a = RequestWaitObservation.Enter("Http", "projection-a", "api-a");
        using var b = RequestWaitObservation.Enter("Http", "projection-b", "api-b");
        var incident = Incident("projection-a"); incident["RequestWaits"] = RequestWaitObservation.Snapshot();
        incident["Executions"] = new JArray(Enumerable.Range(0, 300).Select(i => new JObject { ["OsClient"] = "projection-a", ["Key"] = new string('a', 5000) }));
        var result = CriticalIncidentWriter.Project(MemoryDiagnosticsStore.ForTenant(incident, "projection-a"));
        Assert.DoesNotContain("projection-b", result.ToString());
        Assert.True(result.Value<bool>("EvidenceTruncated"));
        Assert.False(result.Value<bool>("RawStacksStoredHere"));
        Assert.True(System.Text.Encoding.UTF8.GetByteCount(result.ToString(Newtonsoft.Json.Formatting.None)) <= RelationalIncidentRepository.MaximumPayloadBytes);
    }

    [Fact]
    public void Writer_DoesNotAcknowledgeExpiredEvidence()
    {
        using var writer = new CriticalIncidentWriter((_, _) => throw new Exception("Expired evidence must not reach storage"));
        var incident = Incident("expired"); incident["OccurredAtUtc"] = DateTime.UtcNow.AddDays(-15); writer.Enqueue(incident);
        Assert.Equal(0, writer.Health().Value<long>("AcknowledgedWrites"));
        Assert.Equal(1, writer.Health().Value<long>("DroppedSnapshots"));
        Assert.Equal(0, writer.Health().Value<int>("Pending"));
    }

    [Fact]
    public void Writer_DoesNotClaimAcknowledgementWhileDatabaseFails()
    {
        using var attempted = new ManualResetEventSlim();
        using var writer = new CriticalIncidentWriter((_, _) => { attempted.Set(); throw new IOException("sensitive-password"); });
        writer.Enqueue(Incident("writer-a")); Assert.True(attempted.Wait(TimeSpan.FromSeconds(3)));
        Assert.True(SpinWait.SpinUntil(() => writer.Health().Value<string>("Error") == nameof(IOException), 1000));
        var health = writer.Health(); Assert.Equal(0, health.Value<int>("AcknowledgedWrites"));
        Assert.Equal(1, health.Value<int>("Pending")); Assert.DoesNotContain("sensitive-password", health.ToString());
    }

    [Fact]
    public void Writer_CoalescesNewerVersionWhileWriteIsInFlight()
    {
        using var started = new ManualResetEventSlim(); using var release = new ManualResetEventSlim();
        var versions = new List<DateTime>();
        using var writer = new CriticalIncidentWriter((_, value) => { lock (versions) versions.Add(value.Value<DateTime>("UpdatedAtUtc")); started.Set(); release.Wait(TimeSpan.FromSeconds(3)); });
        var first = Incident("writer-a"); writer.Enqueue(first); Assert.True(started.Wait(1000));
        var second = (JObject)first.DeepClone(); second["UpdatedAtUtc"] = first.Value<DateTime>("UpdatedAtUtc").AddSeconds(1); writer.Enqueue(second);
        release.Set(); Assert.True(SpinWait.SpinUntil(() => writer.Health().Value<long>("AcknowledgedWrites") == 2, 3000));
        Assert.Equal(0, writer.Health().Value<int>("Pending")); Assert.Equal(2, versions.Count);
    }

    [Fact]
    public void Writer_FailedTenantCannotFillQueueAndExcludeAnotherTenant()
    {
        using var started = new ManualResetEventSlim(); using var release = new ManualResetEventSlim(); using var saved = new ManualResetEventSlim();
        using var writer = new CriticalIncidentWriter((tenant, _) =>
        {
            if (tenant == "healthy") { saved.Set(); return; }
            started.Set(); release.Wait(TimeSpan.FromSeconds(4)); throw new IOException("Unavailable tenant database");
        });
        writer.Enqueue(Incident("failed")); Assert.True(started.Wait(1000));
        try
        {
            // 固定首个写入，确定性地复现一个故障租户把全局 64 个槽占满的旧行为。
            for (var i = 0; i < 63; i++) writer.Enqueue(Incident("failed"));
            writer.Enqueue(Incident("healthy"));
        }
        finally { release.Set(); }
        Assert.True(saved.Wait(3000), "A failed tenant must not exclude another tenant's critical evidence.");
        Assert.True(SpinWait.SpinUntil(() => writer.Health().Value<long>("AcknowledgedWrites") >= 1, 1000));
        Assert.True(writer.Health().Value<int>("Pending") <= 8);
        Assert.Equal("CurrentNodeAllLoadedTenants", writer.Health().Value<string>("Scope"));
    }

    [Fact]
    public void Writer_FailedDatabaseBackoffAppliesToWholeTenant()
    {
        using var started = new ManualResetEventSlim(); using var release = new ManualResetEventSlim(); using var saved = new ManualResetEventSlim();
        var attempts = 0;
        using var writer = new CriticalIncidentWriter((tenant, _) =>
        {
            if (tenant == "healthy") { saved.Set(); return; }
            Interlocked.Increment(ref attempts); started.Set(); release.Wait(TimeSpan.FromSeconds(4)); throw new IOException("Unavailable");
        });
        writer.Enqueue(Incident("failed")); Assert.True(started.Wait(1000));
        try { for (var i = 0; i < 3; i++) writer.Enqueue(Incident("failed")); writer.Enqueue(Incident("healthy")); }
        finally { release.Set(); }
        Assert.True(saved.Wait(3000));
        Assert.Equal(1, Volatile.Read(ref attempts));
    }

    [Fact]
    public void Writer_NewTenantCanEnterWhenManyFailedTenantsFillGlobalQueue()
    {
        using var started = new ManualResetEventSlim(); using var release = new ManualResetEventSlim(); using var saved = new ManualResetEventSlim();
        using var writer = new CriticalIncidentWriter((tenant, _) =>
        {
            if (tenant == "healthy") { saved.Set(); return; }
            started.Set(); release.Wait(TimeSpan.FromSeconds(4)); throw new IOException("Unavailable");
        });
        writer.Enqueue(Incident("failed-0")); Assert.True(started.Wait(1000));
        try
        {
            for (var tenant = 0; tenant < 8; tenant++)
                for (var i = tenant == 0 ? 1 : 0; i < 8; i++) writer.Enqueue(Incident("failed-" + tenant));
            Assert.Equal(64, writer.Health().Value<int>("Pending")); writer.Enqueue(Incident("healthy"));
            Assert.True(writer.Health().Value<int>("Pending") <= 64);
        }
        finally { release.Set(); }
        Assert.True(saved.Wait(3000)); Assert.True(writer.Health().Value<long>("DroppedSnapshots") > 0);
    }

    [Fact]
    public void Writer_ReplaysPersistedEvidenceAfterRestart_RegardlessOfMongoAcknowledgement()
    {
        var directory = Path.Combine(Path.GetTempPath(), "microi-incident-replay-" + Guid.NewGuid().ToString("N"));
        try
        {
            var store = new MemoryDiagnosticsStore(directory); var incident = Incident("replay-tenant");
            var file = store.SaveIncident(Guid.NewGuid().ToString("N"), incident);
            File.WriteAllText(file + ".ack", "Mongo acknowledgement does not confirm MySQL");
            CriticalIncidentWriter Start(Action<string, JObject> save) =>
                typeof(CriticalIncidentWriter).GetConstructor([typeof(Action<string, JObject>), typeof(MemoryDiagnosticsStore)]) is { } constructor
                ? (CriticalIncidentWriter)constructor.Invoke([save, store]) : new CriticalIncidentWriter(save);
            using (var unavailable = Start((_, _) => throw new IOException("database unavailable")))
                Assert.True(SpinWait.SpinUntil(() => unavailable.Health().Value<string>("Error") == nameof(IOException), 3000));
            Assert.False(File.Exists(file + ".mysql-ack.json"));
            using (var recovered = Start((tenant, value) => { Assert.Equal("replay-tenant", tenant); Assert.Equal(incident.Value<string>("Id"), value.Value<string>("Id")); }))
            {
                Assert.True(SpinWait.SpinUntil(() => recovered.Health().Value<long>("AcknowledgedWrites") == 1, 3000));
                Assert.Equal(incident.Value<DateTime>("UpdatedAtUtc").Ticks, MemoryDiagnosticsStore.Read(file + ".mysql-ack.json")!.Value<long>("UpdatedVersion"));
            }
            using var noDuplicate = Start((_, _) => throw new Exception("Acknowledged version must not replay"));
            Thread.Sleep(600); Assert.Equal(0, noDuplicate.Health().Value<long>("AcknowledgedWrites"));
            Assert.Equal("NotYetWritten", noDuplicate.Health().Value<string>("Error"));
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }

    private static JObject Incident(string tenant) => new() { ["Id"] = Guid.NewGuid().ToString("N"), ["Tenant"] = tenant,
        ["OccurredAtUtc"] = DateTime.UtcNow, ["UpdatedAtUtc"] = DateTime.UtcNow, ["Trigger"] = "Test", ["Executions"] = new JArray() };
    private static Server awaitableServer(TcpListener listener) => new(listener);
    private sealed class Server : IDisposable
    {
        public TaskCompletionSource Ready = new(TaskCreationOptions.RunContinuationsAsynchronously), Release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly Task _task;
        public Server(TcpListener listener) { _task = Run(listener); }
        private async Task Run(TcpListener listener)
        {
            using var client = await listener.AcceptTcpClientAsync(); using var stream = client.GetStream();
            var buffer = new byte[4096]; await stream.ReadAsync(buffer); Ready.SetResult();
            await Release.Task; await stream.WriteAsync("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok"u8.ToArray());
        }
        public void Dispose() { Release.TrySetResult(); _task.Wait(TimeSpan.FromSeconds(3)); }
    }
}
