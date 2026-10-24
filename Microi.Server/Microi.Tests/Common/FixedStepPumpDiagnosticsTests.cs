using System.Reflection;
using System.Security.Cryptography;
using Microi.FixedStep;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>后台执行结果、未知提交与停止语义必须可观察；诊断不能成为共享租约或暴露异常正文。</summary>
public sealed class FixedStepPumpDiagnosticsTests
{
    [Fact]
    public void Snapshot_is_read_only_tenant_scoped_and_not_an_authorization_proof()
    {
        var factoryCalls = 0;
        var c = new BoundedTickCoordinator(Catalog(() => factoryCalls++), new RecordingDispatcher(), new Clock());
        c.RegisterOwnedRoom("tenant", "reg", "room", "epoch", "1", 5000);
        var beforeSnapshot = factoryCalls;
        var own = Snapshot(c, "tenant");
        Assert.True(own.Value<bool>("Available"));
        Assert.False(own.Value<bool>("AuthorizationProof"));
        Assert.True(own.Value<bool>("CurrentNodeOnly"));
        Assert.Equal("NotStarted", own.Value<string>("LoopState"));
        Assert.Single((JArray)own["Rooms"]!);
        Assert.Empty((JArray)Snapshot(c, "other")["Rooms"]!);
        own["Rooms"]![0]!["RoomId"] = "mutated";
        Assert.Equal("room", Snapshot(c, "tenant")["Rooms"]![0]!.Value<string>("RoomId"));
        Assert.Equal(beforeSnapshot, factoryCalls);
    }

    [Fact]
    public async Task Unknown_dispatch_keeps_the_same_request_and_records_safe_rejection()
    {
        var d = new RecordingDispatcher(); var c = new BoundedTickCoordinator(Catalog(), d, new Clock());
        c.RegisterOwnedRoom("tenant", "reg", "room", "epoch", "1", 5000);
        await Pulse(c); await Pulse(c);
        Assert.Equal(d.Requests[0].RequestId, d.Requests[1].RequestId);
        var row = Snapshot(c, "tenant")["Rooms"]![0]!;
        Assert.Equal(2, row.Value<long>("Dispatches"));
        Assert.Equal(2, row.Value<long>("Unknown"));
        Assert.Equal("LoginRequired", row.Value<string>("LastErrorCode"));
        Assert.Equal(1001, row.Value<int>("LastResultCode"));
        Assert.DoesNotContain(d.Requests[0].RequestId, row.ToString());
        d.Status = DispatchStatus.Committed; await Pulse(c); await Pulse(c);
        Assert.NotEqual(d.Requests[2].RequestId, d.Requests[3].RequestId);
    }

    [Fact]
    public async Task Dispatcher_exception_retains_unknown_key_without_exposing_exception_details()
    {
        var d = new RecordingDispatcher { Failure = new InvalidOperationException("password=never-return-this") };
        var c = new BoundedTickCoordinator(Catalog(), d, new Clock());
        c.RegisterOwnedRoom("tenant", "reg", "room", "epoch", "1", 5000);
        await Pulse(c); var row = Snapshot(c, "tenant")["Rooms"]![0]!;
        Assert.Equal("DispatcherException", row.Value<string>("LastErrorCode"));
        Assert.Equal(1, row.Value<long>("Unknown"));
        Assert.DoesNotContain("password", row.ToString());
        d.Failure = null; await Pulse(c);
        Assert.Equal(d.Requests[0].RequestId, d.Requests[1].RequestId);
    }

    [Fact]
    public async Task Expired_room_retains_its_last_failure_without_becoming_authority()
    {
        var clock = new Clock(); var d = new RecordingDispatcher(); var c = new BoundedTickCoordinator(Catalog(), d, clock);
        c.RegisterOwnedRoom("tenant", "reg", "room", "epoch", "1", 50);
        await Pulse(c); clock.Milliseconds = 100; c.Pulse();
        var row = Snapshot(c, "tenant")["Rooms"]![0]!;
        Assert.Equal("Expired", row.Value<string>("LocalState"));
        Assert.Equal("LoginRequired", row.Value<string>("LastErrorCode"));
        Assert.Equal(0, row.Value<long>("LocalLeaseRemainingMs"));
        Assert.Single(d.Requests);
    }

    [Fact]
    public void Removed_room_history_is_bounded_per_tenant()
    {
        var c = new BoundedTickCoordinator(Catalog(), new RecordingDispatcher(), new Clock());
        for (var i = 0; i < 80; i++)
        {
            c.RegisterOwnedRoom("tenant", "reg", "room-" + i, "epoch", "1", 5000);
            c.StopOwnedRoom("tenant", "room-" + i, "epoch", "1");
        }
        var snapshot = Snapshot(c, "tenant");
        Assert.Equal(16, ((JArray)snapshot["Rooms"]!).Count);
        Assert.Empty((JArray)Snapshot(c, "other")["Rooms"]!);
        Assert.DoesNotContain("room-0\"", snapshot.ToString());
    }

    [Fact]
    public async Task Stale_response_removes_local_work_and_records_why_it_stopped()
    {
        var d = new RecordingDispatcher { Status = DispatchStatus.StaleLease, DiagnosticCode = "StaleLease" };
        var c = new BoundedTickCoordinator(Catalog(), d, new Clock());
        c.RegisterOwnedRoom("tenant", "reg", "room", "epoch", "1", 5000);
        await Pulse(c); c.Pulse();
        var row = Snapshot(c, "tenant")["Rooms"]![0]!;
        Assert.Equal("StaleLease", row.Value<string>("LocalState"));
        Assert.Equal("StaleLease", row.Value<string>("LastErrorCode"));
        Assert.Single(d.Requests);
    }

    [Fact]
    public async Task Custom_dispatcher_diagnostic_is_sanitized_before_snapshot()
    {
        var d = new RecordingDispatcher { DiagnosticCode = "token=private tenant=other" };
        var c = new BoundedTickCoordinator(Catalog(), d, new Clock());
        c.RegisterOwnedRoom("tenant", "reg", "room", "epoch", "1", 5000);
        await Pulse(c); var row = Snapshot(c, "tenant")["Rooms"]![0]!;
        Assert.Equal("ManagedRejected", row.Value<string>("LastErrorCode"));
        Assert.DoesNotContain("private", row.ToString());
    }

    [Theory]
    [InlineData(1001, "请先登录后再保存数据。", "LoginRequired")]
    [InlineData(0, "ComputeBudgetExceeded", "ComputeBudgetExceeded")]
    [InlineData(0, "token=private", "ManagedRejected")]
    public void Actual_dispatch_result_interpretation_preserves_unknown_and_sanitizes_messages(int code, string message, string expected)
    {
        var method = typeof(ManagedTickDispatcher).GetMethod("InterpretResult", BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        var result = (TickDispatchResult)method.Invoke(null, new object[] { new JObject { ["Code"] = code, ["Msg"] = message }, new TickDispatch() })!;
        Assert.Equal(DispatchStatus.Unknown, result.Status);
        Assert.Equal(expected, typeof(TickDispatchResult).GetProperty("DiagnosticCode")!.GetValue(result));
    }

    [Fact]
    public async Task Loop_stops_normally_without_erasing_dispatch_failure_history()
    {
        var c = new BoundedTickCoordinator(Catalog(), new RecordingDispatcher(), new Clock());
        c.RegisterOwnedRoom("tenant", "reg", "room", "epoch", "1", 5000);
        using var stop = new CancellationTokenSource(); var run = c.RunAsync(stop.Token);
        try
        {
            // Dispatches 在排队时递增；等待异步结果写回后，才能验证停止不会抹掉已有失败记录。
            for (var i = 0; i < 100 && Snapshot(c, "tenant")["Rooms"]![0]!.Value<DateTime?>("LastCompletedUtc") == null; i++)
                await Task.Delay(5, TestContext.Current.CancellationToken);
            var beforeStop = Snapshot(c, "tenant");
            Assert.Equal("Running", beforeStop.Value<string>("LoopState"));
            Assert.NotNull(beforeStop["Rooms"]![0]!.Value<DateTime?>("LastCompletedUtc"));
            Assert.Equal("LoginRequired", beforeStop["Rooms"]![0]!.Value<string>("LastErrorCode"));
            stop.Cancel(); await run;
            Assert.Equal("Stopped", Snapshot(c, "tenant").Value<string>("LoopState"));
            Assert.Equal("LoginRequired", Snapshot(c, "tenant")["Rooms"]![0]!.Value<string>("LastErrorCode"));
        }
        finally { stop.Cancel(); await run; await c.StopAsync(0); }
    }

    private static JObject Snapshot(BoundedTickCoordinator coordinator, string tenant)
    {
        var method = typeof(BoundedTickCoordinator).GetMethod("Snapshot", new[] { typeof(string) });
        Assert.NotNull(method);
        return JObject.FromObject(method.Invoke(coordinator, new object[] { tenant })!);
    }
    private static async Task Pulse(BoundedTickCoordinator coordinator)
    {
        coordinator.Pulse();
        using var stop = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken); stop.CancelAfter(2000);
        while (!coordinator.IsDrained) await Task.Delay(5, stop.Token);
    }
    private sealed class Clock : IMonotonicClock { public long Milliseconds { get; set; } = 10; }
    private sealed class RecordingDispatcher : IManagedTickDispatcher
    {
        internal readonly List<TickDispatch> Requests = new();
        internal DispatchStatus Status = DispatchStatus.Unknown;
        internal string DiagnosticCode = "LoginRequired";
        internal Exception? Failure;
        public Task<TickDispatchResult> DispatchAsync(TickDispatch request, CancellationToken token)
        {
            Requests.Add(request); if (Failure != null) return Task.FromException<TickDispatchResult>(Failure);
            var result = new TickDispatchResult { Status = Status };
            typeof(TickDispatchResult).GetProperty("DiagnosticCode")?.SetValue(result, DiagnosticCode);
            typeof(TickDispatchResult).GetProperty("ResultCode")?.SetValue(result, 1001);
            return Task.FromResult(result);
        }
    }
    private static TrustedRulesCatalog Catalog(Action? onFactory = null)
    {
        var type = typeof(Counter); var sha = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(type.Assembly.Location)));
        var catalog = new TrustedRulesCatalog();
        // 登记会实际构造一次规则以核验版本；只读快照则必须保持后续工厂调用计数不变。
        catalog.RegisterApproved(new PackageApproval { Tenant = "tenant", RegistrationId = "reg", PackageKey = "counter", SourceReceipt = "fixture", AssemblySha256 = sha, EntryType = type.FullName!, TickEngineKey = "counter_tick", ProjectionEngineKey = "counter_projection", RulesVersion = "1", LayoutId = "one" }, () => { onFactory?.Invoke(); return new Counter(); });
        return catalog;
    }
    private sealed class Counter : IDeterministicRules
    {
        public long CompletedTick => 0; public bool IsTerminal => false; public SimulationBinding Binding => new();
        public void Initialize(string setup) { } public void Restore(string state) { }
        public string Apply(InboxCommand c) => "Accepted"; public void AdvanceOneTick() { }
        public string Capture() => "0"; public string Project(int seat, long cursor) => "{}";
    }
}
