using System.Security.Cryptography;
using Microi.FixedStep;

namespace Microi.Tests.Common;

/// <summary>授权主库等待与规则计算分开计时，但总租约、每批撤销和所有规则阶段仍受保护。</summary>
public sealed class FixedStepComputeBudgetTests
{
    [Fact]
    public void Authoritative_read_latency_does_not_consume_the_rule_compute_budget()
    {
        var f = new Fixture { AuthorizationMs = 150, FactoryMs = 10, RestoreMs = 10, StepMs = 5, CaptureMs = 10 };
        Assert.Equal(4, f.Advance().CompletedTick);
        Assert.Equal(1, f.Reads); Assert.Equal(1, f.Factories);
        Assert.Equal(200, f.Clock.Milliseconds);
    }

    [Fact]
    public void Authoritative_read_still_consumes_the_total_lease_before_rule_construction()
    {
        var f = new Fixture { AuthorizationMs = 150 };
        var e = f.Envelope(); e.LeaseUntilUnixMs = e.ServerNowUnixMs + 150;
        Assert.Equal("StaleLease", Assert.Throws<InvalidOperationException>(() => f.Advance(e)).Message);
        Assert.Equal(0, f.Factories);
    }

    [Fact]
    public void Backward_authorization_clock_cannot_create_extra_compute_or_lease_time()
    {
        var f = new Fixture { OnAuthorization = x => x.Clock.Milliseconds = -1 };
        Assert.Equal("StaleLease", Assert.Throws<InvalidOperationException>(() => f.Advance()).Message);
        Assert.Equal(0, f.Factories);
    }

    [Fact]
    public void Cancellation_during_authorization_stops_before_rule_construction()
    {
        using var cancel = new CancellationTokenSource();
        var f = new Fixture { OnAuthorization = _ => cancel.Cancel() };
        Assert.Throws<OperationCanceledException>(() => f.Advance(token: cancel.Token));
        Assert.Equal(1, f.Reads); Assert.Equal(0, f.Factories);
    }

    [Fact]
    public void Already_cancelled_batch_does_not_read_primary_authority_or_construct_rules()
    {
        using var cancel = new CancellationTokenSource(); cancel.Cancel(); var f = new Fixture();
        Assert.Throws<OperationCanceledException>(() => f.Advance(token: cancel.Token));
        Assert.Equal(0, f.Reads); Assert.Equal(0, f.Factories);
    }

    [Theory]
    [InlineData(101, 0, 0, 0)]
    [InlineData(0, 101, 0, 0)]
    [InlineData(0, 0, 101, 0)]
    [InlineData(0, 0, 0, 101)]
    public void Factory_restore_step_and_capture_each_remain_inside_the_100ms_compute_budget(int factory, int restore, int step, int capture)
    {
        var f = new Fixture { FactoryMs = factory, RestoreMs = restore, StepMs = step, CaptureMs = capture };
        Assert.Equal("ComputeBudgetExceeded", Assert.Throws<InvalidOperationException>(() => f.Advance()).Message);
        Assert.Equal(1, f.Factories);
    }

    [Fact]
    public void Combined_rule_phases_cannot_each_take_a_fresh_budget()
    {
        var f = new Fixture { FactoryMs = 40, RestoreMs = 30, StepMs = 6, CaptureMs = 7 };
        Assert.Equal("ComputeBudgetExceeded", Assert.Throws<InvalidOperationException>(() => f.Advance()).Message);
    }

    [Fact]
    public void Exact_existing_100ms_boundary_still_succeeds()
    {
        var f = new Fixture { AuthorizationMs = 150, FactoryMs = 50, RestoreMs = 25, StepMs = 5, CaptureMs = 5 };
        Assert.Equal(4, f.Advance().CompletedTick);
    }

    [Fact]
    public void Every_batch_revalidates_and_revocation_is_not_cached_or_relabelled_as_busy()
    {
        var f = new Fixture(); Assert.Equal(4, f.Advance().CompletedTick);
        f.ReadFailure = new InvalidOperationException("InstallationRevoked");
        Assert.Equal("InstallationRevoked", Assert.Throws<InvalidOperationException>(() => f.Advance()).Message);
        Assert.Equal(2, f.Reads); Assert.Equal(1, f.Factories);
    }

    [Theory]
    [InlineData("other", "counter_tick", "1", "one", "RegistrationNotFound")]
    [InlineData("tenant", "other_tick", "1", "one", "UntrustedEngine")]
    [InlineData("tenant", "counter_tick", "2", "one", "RulesMismatch")]
    [InlineData("tenant", "counter_tick", "1", "other", "RulesMismatch")]
    public void Separating_authorization_never_bypasses_tenant_engine_version_or_layout(string tenant, string engine, string version, string layout, string expected)
    {
        var f = new Fixture(); var e = f.Envelope(); e.RulesVersion = version; e.LayoutId = layout;
        Assert.Equal(expected, Assert.Throws<InvalidOperationException>(() => f.Advance(e, new InvocationContext(tenant, engine))).Message);
        Assert.Equal(0, f.Factories);
    }

    private sealed class Clock : IMonotonicClock { public long Milliseconds { get; set; } }
    private sealed class Fixture
    {
        private static readonly Lazy<string> AssemblyHash = new(() => Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(typeof(Counter).Assembly.Location))));
        public readonly Clock Clock = new();
        private readonly FixedStepKernel kernel;
        public long AuthorizationMs, FactoryMs, RestoreMs, StepMs, CaptureMs;
        public int Reads, Factories;
        public Action<Fixture>? OnAuthorization;
        public Exception? ReadFailure;
        public Fixture()
        {
            var type = typeof(Counter); var catalog = new TrustedRulesCatalog();
            catalog.RegisterApproved(new PackageApproval { Tenant = "tenant", RegistrationId = "reg", PackageKey = "counter", SourceReceipt = "fixture", AssemblySha256 = AssemblyHash.Value, EntryType = type.FullName!, TickEngineKey = "counter_tick", ProjectionEngineKey = "counter_projection", RulesVersion = "1", LayoutId = "one" },
                () => { Factories++; Clock.Milliseconds += FactoryMs; return new Counter(this); },
                () => { Reads++; if (ReadFailure != null) throw ReadFailure; Clock.Milliseconds += AuthorizationMs; OnAuthorization?.Invoke(this); });
            Factories = 0; Clock.Milliseconds = 0; kernel = new(catalog, Clock);
        }
        public AdvanceEnvelope Envelope() => new() { RegistrationId = "reg", RoomId = "room", RoomEpoch = "epoch", AuthorityEpoch = "1", Revision = "1", RequestId = "request", StartUnixMs = 0, ServerNowUnixMs = 200, LeaseUntilUnixMs = 10200, CompletedTick = 0, RulesVersion = "1", LayoutId = "one", StateJson = "0" };
        public AdvanceResult Advance(AdvanceEnvelope? e = null, InvocationContext? context = null, CancellationToken token = default) => kernel.AdvanceBatch(context ?? new("tenant", "counter_tick"), e ?? Envelope(), token);
    }
    private sealed class Counter(Fixture f) : IDeterministicRules
    {
        public long CompletedTick { get; private set; }
        public bool IsTerminal => false;
        public SimulationBinding Binding => new() { Tenant = "tenant", RoomId = "room", RoomEpoch = "epoch" };
        public void Initialize(string setup) { }
        public void Restore(string state) { f.Clock.Milliseconds += f.RestoreMs; CompletedTick = long.Parse(state); }
        public string Apply(InboxCommand command) => "Accepted";
        public void AdvanceOneTick() { f.Clock.Milliseconds += f.StepMs; CompletedTick++; }
        public string Capture() { f.Clock.Milliseconds += f.CaptureMs; return CompletedTick.ToString(); }
        public string Project(int seat, long cursor) => "{}";
    }
}
