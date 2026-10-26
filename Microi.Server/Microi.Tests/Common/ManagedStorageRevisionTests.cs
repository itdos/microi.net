using System.Reflection;
using Dos.Common;
using Jint;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

// Real Jint -> JsonHelper -> trusted facade. The recording store checks dispatch
// and error propagation only; durable Mongo CAS remains the FullStack HTTP test.
[Collection("TenantContextGlobal")]
public sealed class ManagedStorageRevisionTests
{
    private const string Tenant = "standard-admission-revision";
    private const string Epoch = "0123456789abcdef0123456789abcdef";

    [Theory]
    [InlineData("gate.Data.Revision", 4L)]
    [InlineData("0", 0L)]
    [InlineData("4", 4L)]
    [InlineData("9007199254740991", 9007199254740991L)]
    public void Exact_Jint_integer_survives_real_object_bridge(string expression, long expected)
    {
        using var fixture = new Fixture();
        var request = FromScript(expression);
        Assert.Equal(JTokenType.Float, JsonHelper.ToJObject(request)["ExpectedRevision"]!.Type);
        var result = new V8Method().ManageManagedStorageMaintenance(request);
        Assert.Equal(1, result.Code);
        Assert.Equal(expected, Assert.Single(fixture.Store.EndRevisions));
    }

    [Theory]
    [InlineData("null")]
    [InlineData("'4'")]
    [InlineData("true")]
    [InlineData("NaN")]
    [InlineData("Infinity")]
    [InlineData("-Infinity")]
    [InlineData("4.25")]
    [InlineData("Number.MIN_VALUE")]
    [InlineData("-Number.MIN_VALUE")]
    [InlineData("Number.MAX_VALUE")]
    [InlineData("-1")]
    [InlineData("9007199254740992")]
    [InlineData("9223372036854775807")]
    [InlineData("{}")]
    [InlineData("[]")]
    public void Invalid_Jint_value_is_rejected_before_End(string expression)
    {
        using var fixture = new Fixture();
        var result = new V8Method().ManageManagedStorageMaintenance(FromScript(expression));
        Assert.Equal(0, result.Code);
        Assert.Contains("准入版本", result.Msg);
        Assert.Empty(fixture.Store.EndRevisions);
    }

    [Fact]
    public void Missing_revision_is_rejected_before_End()
    {
        using var fixture = new Fixture();
        var result = new V8Method().ManageManagedStorageMaintenance(FromScript(null));
        Assert.Equal(0, result.Code);
        Assert.Empty(fixture.Store.EndRevisions);
    }

    [Theory]
    [InlineData("4", true)]
    [InlineData("4.0", true)]
    [InlineData("9007199254740991", true)]
    [InlineData("9007199254740992", false)]
    [InlineData("18446744073709551616", false)]
    [InlineData("-1", false)]
    public void Direct_JSON_integer_and_float_obey_the_same_safe_range(string json, bool valid)
    {
        using var fixture = new Fixture();
        var request = Request(); request["ExpectedRevision"] = JToken.Parse(json);
        var result = new V8Method().ManageManagedStorageMaintenance(request);
        Assert.Equal(valid ? 1 : 0, result.Code);
        Assert.Equal(valid ? 1 : 0, fixture.Store.EndRevisions.Count);
    }

    [Fact]
    public void Decimal_fraction_must_not_round_to_an_integer_via_double()
    {
        using var fixture = new Fixture();
        var request = Request(); request["ExpectedRevision"] = 4.0000000000000000000000000001m;
        Assert.Equal(0, new V8Method().ManageManagedStorageMaintenance(request).Code);
        Assert.Empty(fixture.Store.EndRevisions);
        request["ExpectedRevision"] = 4.0m;
        Assert.Equal(1, new V8Method().ManageManagedStorageMaintenance(request).Code);
        Assert.Equal(4L, Assert.Single(fixture.Store.EndRevisions));
    }

    [Fact]
    public void Store_revision_drift_is_not_retried_or_replaced_with_a_new_read()
    {
        using var fixture = new Fixture();
        fixture.Store.EndFailure = new InvalidOperationException("ManagedStorageNotDrainedOrRevisionChanged");
        var result = new V8Method().ManageManagedStorageMaintenance(FromScript("gate.Data.Revision"));
        Assert.Equal(0, result.Code);
        Assert.Equal(4L, Assert.Single(fixture.Store.EndRevisions));
        Assert.Equal(0, fixture.Store.Reads);
    }

    private static JObject Request() => new()
    { ["Scope"] = ManagedStorageAdmissionRuntime.RuntimeKey, ["Operation"] = "End", ["Epoch"] = Epoch };

    private static object FromScript(string? expression)
    {
        using var engine = new Engine();
        object? captured = null;
        engine.SetValue("capture", (Action<object>)(input => captured = input));
        engine.SetValue("gate", new JObject { ["Data"] = new JObject { ["Revision"] = 4L } });
        engine.Execute("capture({Scope:'platform-chat-runtime',Operation:'End',Epoch:'" + Epoch + "'"
            + (expression == null ? "" : ",ExpectedRevision:" + expression) + "});");
        return captured ?? throw new InvalidOperationException("Jint did not invoke the real object bridge");
    }

    private sealed class Fixture : IDisposable
    {
        private readonly FieldInfo provider = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        private readonly object? previous;
        private readonly IDisposable tenant, trusted, admission;
        public readonly RecordingStore Store = new();
        public Fixture()
        {
            previous = provider.GetValue(null);
            tenant = V8TenantContext.Enter(Tenant, ManagedStorageAdmissionRuntime.MaintenanceKey, "test");
            var context = typeof(V8Method).Assembly.GetType("Microi.net.V8TrustedExecutionContext", true)!;
            trusted = (IDisposable)context.GetMethod("EnterForTenant", BindingFlags.Static | BindingFlags.NonPublic)!
                .Invoke(null, new object[] { new JObject { ["Id"] = "revision-fixture", ["Level"] = DiyCommon.MaxRoleLevel }, Tenant })!;
            admission = ManagedStorageAdmissionRuntime.Enter(ManagedStorageAdmissionRuntime.MaintenanceKey, Tenant, () => Store);
            provider.SetValue(null, new StoreProvider(Store));
        }
        public void Dispose()
        { provider.SetValue(null, previous); admission.Dispose(); trusted.Dispose(); tenant.Dispose(); }
    }

    private sealed class StoreProvider(RecordingStore store) : IServiceProvider
    { public object? GetService(Type type) => type == typeof(IManagedStorageAdmissionStore) ? store : null; }

    private sealed class RecordingStore : IManagedStorageAdmissionStore
    {
        public readonly List<long> EndRevisions = [];
        public Exception? EndFailure;
        public int Reads;
        public ManagedStorageGate End(string tenant, string scope, string epoch, long revision)
        {
            Assert.Equal(Tenant, tenant); Assert.Equal(ManagedStorageAdmissionRuntime.RuntimeKey, scope); Assert.Equal(Epoch, epoch);
            EndRevisions.Add(revision);
            if (EndFailure != null) throw EndFailure;
            return new ManagedStorageGate { OsClient = tenant, Scope = scope, Epoch = epoch, Phase = "Open", Revision = revision + 1 };
        }
        public ManagedStorageGate Read(string tenant, string scope) { Reads++; throw new InvalidOperationException("Unexpected Read"); }
        public ManagedStorageTicket Enter(string tenant, string scope, string token, string process) => throw new NotSupportedException();
        public ManagedStorageTicket EnterMaintenance(string tenant, string scope, string epoch, string token, string process) => throw new NotSupportedException();
        public bool Release(ManagedStorageTicket ticket) => throw new NotSupportedException();
        public ManagedStorageGate Begin(string tenant, string scope, string operation, string epoch) => throw new NotSupportedException();
        public ManagedStorageGate Drain(string tenant, string scope, string epoch) => throw new NotSupportedException();
    }
}
