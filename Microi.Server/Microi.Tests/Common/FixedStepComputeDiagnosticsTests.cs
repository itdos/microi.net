using System.Reflection;
using System.Security.Cryptography;
using Microi.FixedStep;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>实际内核失败必须能定位阶段；节点诊断不泄露业务状态、不扩大绑定，也不改变预算和授权。</summary>
public sealed class FixedStepComputeDiagnosticsTests
{
    [Theory]
    [InlineData("RuleFactory")]
    [InlineData("RestoreState")]
    [InlineData("ApplyCommand")]
    [InlineData("AdvanceTick")]
    [InlineData("CaptureState")]
    public void Actual_kernel_reports_the_failing_phase_without_changing_the_existing_rejection(string phase)
    {
        var f = new Fixture { Phase = phase, PhaseMs = 101, AuthorizationMs = 150 };
        Assert.Equal("ComputeBudgetExceeded", Assert.Throws<InvalidOperationException>(() => f.Advance()).Message);
        var row = Row(f.Monitor);
        Assert.Equal(1, row["ComputeBudgetFailureCount"]!.Value<int>());
        Assert.Equal(phase, row["LastComputeBudgetPhase"]!.Value<string>());
        Assert.Equal(101, row["LastComputeBudgetComputeMilliseconds"]!.Value<long>());
        Assert.Equal(150, row["LastComputeBudgetAuthorizationMilliseconds"]!.Value<long>());
        Assert.Equal(251, row["LastComputeBudgetTotalMilliseconds"]!.Value<long>());
        Assert.NotNull(row["LastComputeBudgetFailureUtc"]);
        var json = row.ToString();
        Assert.DoesNotContain("secret-room", json); Assert.DoesNotContain("secret-request", json); Assert.DoesNotContain("secret-payload", json);
    }

    [Fact]
    public void Exact_compute_boundary_success_and_lease_failure_are_not_mislabelled_as_compute_failures()
    {
        var f = new Fixture { Phase = "RuleFactory", PhaseMs = 100, AuthorizationMs = 150 };
        Assert.Equal(4, f.Advance().CompletedTick); Assert.Equal(0, Row(f.Monitor)["ComputeBudgetFailureCount"]!.Value<int>());
        var expired = new Fixture { AuthorizationMs = 150 }; var e = expired.Envelope(); e.LeaseUntilUnixMs = 350;
        Assert.Equal("StaleLease", Assert.Throws<InvalidOperationException>(() => expired.Advance(e)).Message);
        Assert.Equal(0, Row(expired.Monitor)["ComputeBudgetFailureCount"]!.Value<int>()); Assert.Equal(0, expired.RuleFactories);
    }

    [Fact]
    public void Only_compiled_tenant_bindings_and_fixed_numeric_witnesses_can_update_the_bounded_catalog()
    {
        var f = new Fixture();
        Record(f.Monitor, "another-tenant", "reg", "RestoreState", 101, 0, 101);
        Record(f.Monitor, "tenant", "unknown-reg", "RestoreState", 101, 0, 101);
        Record(f.Monitor, "tenant", "reg", "SELECT secret; /private/key", 101, 0, 101);
        Record(f.Monitor, "tenant", "reg", "RestoreState", 101, 1, 999);
        Assert.Empty(f.Monitor.Snapshot("another-tenant").Registrations);
        Assert.Single(f.Monitor.Snapshot("tenant").Registrations);
        Assert.Equal(0, Row(f.Monitor)["ComputeBudgetFailureCount"]!.Value<int>());
        Assert.DoesNotContain("SELECT", JsonConvert.SerializeObject(f.Monitor.Snapshot("tenant")));
    }

    [Fact]
    public void Concurrent_failures_have_bounded_counters_and_detached_snapshots()
    {
        var f = new Fixture();
        Parallel.For(0, 1000, _ => Record(f.Monitor, "tenant", "reg", "RestoreState", 101, 150, 251));
        Assert.Equal(1000, Row(f.Monitor)["ComputeBudgetFailureCount"]!.Value<int>());
        var old = Assert.Single(f.Monitor.Snapshot("tenant").Registrations);
        var property = old.GetType().GetProperty("LastComputeBudgetPhase"); Assert.NotNull(property);
        property.SetValue(old, "mutated"); Assert.Equal("RestoreState", Row(f.Monitor)["LastComputeBudgetPhase"]!.Value<string>());
        Assert.False(f.Monitor.Snapshot("tenant").AuthorizationProof);
    }

    [Fact]
    public void Actual_host_wires_the_same_monitor_and_reports_the_loaded_core_hash()
    {
        var services = new ServiceCollection(); services.AddMicroiFixedStepRuntime();
        using var provider = services.BuildServiceProvider();
        var monitor = provider.GetRequiredService<FixedStepInstallationDiagnostics>();
        var kernel = provider.GetRequiredService<FixedStepKernel>();
        var field = typeof(FixedStepKernel).GetField("diagnostics", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field); Assert.Same(monitor, field.GetValue(kernel));
        var snapshot = JObject.FromObject(monitor.Snapshot("tenant"));
        Assert.Equal(Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(typeof(FixedStepKernel).Assembly.Location))), snapshot["CoreAssemblyFileSha256"]!.Value<string>());
    }

    private static JObject Row(FixedStepInstallationDiagnostics monitor) => JObject.FromObject(Assert.Single(monitor.Snapshot("tenant").Registrations));
    private static void Record(FixedStepInstallationDiagnostics monitor, string tenant, string registration, string phase, long compute, long authorization, long total)
    {
        var method = typeof(FixedStepInstallationDiagnostics).GetMethod("RecordComputeBudgetExceeded", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(method); method.Invoke(monitor, [tenant, registration, phase, compute, authorization, total]);
    }

    private sealed class Fixture
    {
        public readonly Clock Clock = new();
        public readonly FixedStepInstallationDiagnostics Monitor;
        private readonly FixedStepKernel kernel;
        public string Phase = ""; public long PhaseMs, AuthorizationMs; public int RuleFactories;
        public Fixture()
        {
            var type = typeof(Counter); var binding = new CompiledRulesBinding("tenant", "reg", new string('a', 64), type, () => new Counter(this));
            Monitor = new(new CompiledRulesDeployments([new Registrar(binding)]));
            var catalog = new TrustedRulesCatalog();
            catalog.RegisterApproved(new PackageApproval { Tenant = "tenant", RegistrationId = "reg", PackageKey = "counter", SourceReceipt = "fixture", AssemblySha256 = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(type.Assembly.Location))), EntryType = type.FullName!, TickEngineKey = "counter_tick", ProjectionEngineKey = "counter_projection", RulesVersion = "1", LayoutId = "one" },
                () => { RuleFactories++; Delay("RuleFactory"); return new Counter(this); }, () => Clock.Milliseconds += AuthorizationMs);
            RuleFactories = 0;
            // 反射使旧内核也能编译这份回归，真实RED必须来自缺失行为，不能用编译失败冒充。
            var constructor = typeof(FixedStepKernel).GetConstructor([typeof(TrustedRulesCatalog), typeof(IMonotonicClock), typeof(FixedStepInstallationDiagnostics)]);
            Assert.NotNull(constructor); kernel = (FixedStepKernel)constructor.Invoke([catalog, Clock, Monitor]);
        }
        public void Delay(string phase) { if (Phase == phase) Clock.Milliseconds += PhaseMs; }
        public AdvanceEnvelope Envelope() => new() { RegistrationId = "reg", RoomId = "secret-room", RoomEpoch = "epoch", AuthorityEpoch = "1", Revision = "1", RequestId = "secret-request", StartUnixMs = 0, ServerNowUnixMs = 200, LeaseUntilUnixMs = 10200, CompletedTick = 0, RulesVersion = "1", LayoutId = "one", StateJson = "secret-payload", Inbox = [new InboxCommand { CommandId = "command", SeatId = 0, Generation = 1, Sequence = 1, Order = 1, AssignedTick = 0, PayloadJson = "{}", CanonicalHash = Convert.ToHexStringLower(SHA256.HashData("{}"u8.ToArray())) }] };
        public AdvanceResult Advance(AdvanceEnvelope? e = null) => kernel.AdvanceBatch(new("tenant", "counter_tick"), e ?? Envelope(), CancellationToken.None);
    }
    private sealed class Clock : IMonotonicClock { public long Milliseconds { get; set; } }
    private sealed class Registrar(CompiledRulesBinding binding) : ITrustedRulesRegistrar { public IEnumerable<CompiledRulesBinding> Registrations => [binding]; }
    private sealed class Counter(Fixture f) : IDeterministicRules
    {
        public long CompletedTick { get; private set; } public bool IsTerminal => false;
        public SimulationBinding Binding => new() { Tenant = "tenant", RoomId = "secret-room", RoomEpoch = "epoch" };
        public void Initialize(string setup) { }
        public void Restore(string state) { f.Delay("RestoreState"); }
        public string Apply(InboxCommand command) { f.Delay("ApplyCommand"); return "Accepted"; }
        public void AdvanceOneTick() { f.Delay("AdvanceTick"); CompletedTick++; }
        public string Capture() { f.Delay("CaptureState"); return CompletedTick.ToString(); }
        public string Project(int seat, long cursor) => "{}";
    }
}
