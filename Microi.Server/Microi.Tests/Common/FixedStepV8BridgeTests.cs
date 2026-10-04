using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Microi.FixedStep;
using Microi.net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

// Host.Install 是进程级实际平台注册；禁止与其它依赖注册表的测试并行修改全局状态。
[CollectionDefinition("FixedStepV8Host", DisableParallelization = true)]
public sealed class FixedStepV8HostCollection { }

/// <summary>
/// 真实 V8Engine/Jint、V8Method 和当前租户上下文的桥接回归。
/// HTTP 使用本机 Kestrel 固定可信测试路由，不代替 ApiEngineController/DiyToken/真实数据库验收。
/// </summary>
[Collection("FixedStepV8Host")]
public sealed class FixedStepV8BridgeTests
{
    private const string Tenant = "fixture-fixedstep";
    private const string Registration = "counter-approved";
    private const string TickEngine = "fixture_counter_tick";
    private const string ProjectionEngine = "fixture_counter_projection";
    private static readonly Lazy<FixedStepRuntimeHost> Installed = new(CreateHost);
    private static int memoryPressure;

    [Fact]
    public void Actual_jint_bridge_uses_approved_catalog_beyond_legacy_static_whitelist()
    {
        var field = typeof(V8Method).GetField("PlatformApiRuntimeEngineKeys", BindingFlags.NonPublic | BindingFlags.Static)!;
        var legacy = (IReadOnlyDictionary<string, string[]>)field.GetValue(null)!;
        Assert.DoesNotContain(FixedStepRuntimeHost.RuntimeKey, legacy.Keys);
        var result = Invoke(Tenant, TickEngine, Request("DescribeInvocation"));
        Assert.Equal(1, result.Value<int>("Code"));
        Assert.Equal(Registration, result["Data"]!.Value<string>("RegistrationId"));
        Assert.StartsWith("microi-", result["Data"]!.Value<string>("NodeId"));
        Assert.False(result["Data"]!.Value<bool>("TrustedPump"));
    }

    [Theory]
    [InlineData("other-tenant", TickEngine, Registration)]
    [InlineData(Tenant, "fixture_counter_tick_extra", Registration)]
    [InlineData(Tenant, "unapproved_script", Registration)]
    [InlineData(Tenant, TickEngine, "missing-registration")]
    public void Actual_jint_rejects_unapproved_context_even_when_payload_forges_identity(string tenant, string engine, string registration)
    {
        var request = Request("DescribeInvocation");
        request["Param"]!["RegistrationId"] = registration;
        request["Param"]!["Tenant"] = Tenant;
        request["Param"]!["OsClient"] = Tenant;
        request["Param"]!["EngineKey"] = TickEngine;
        request["Param"]!["ApiEngineKey"] = TickEngine;
        request["Param"]!["NodeId"] = "forged-node";
        request["Param"]!["TrustedPump"] = true;
        Assert.Equal(0, Invoke(tenant, engine, request).Value<int>("Code"));
    }

    [Fact]
    public void Allowed_script_cannot_make_param_into_background_identity()
    {
        var request = Request("DescribeInvocation");
        request["Param"]!["TrustedPump"] = true;
        request["Param"]!["NodeId"] = "forged-node";
        request["Param"]!["AuthorityEpoch"] = "999";
        request["Param"]!["RoomId"] = "other-room";
        request["Param"]!["RequestId"] = "forged-request";
        var result = Invoke(Tenant, TickEngine, request);
        Assert.Equal(1, result.Value<int>("Code"));
        Assert.NotEqual("forged-node", result["Data"]!.Value<string>("NodeId"));
        Assert.False(result["Data"]!.Value<bool>("TrustedPump"));
        Assert.Equal("", result["Data"]!.Value<string>("RoomId"));
        Assert.Equal("", result["Data"]!.Value<string>("AuthorityEpoch"));
        Assert.Equal("", result["Data"]!.Value<string>("RequestId"));
    }

    [Fact]
    public void Existing_runtime_still_requires_its_original_exact_engine()
    {
        var request = Request("DescribeInvocation");
        request["RuntimeKey"] = "PlatformReminders";
        Assert.Equal(0, Invoke(Tenant, TickEngine, request).Value<int>("Code"));
        request["RuntimeKey"] = "request-selected-unregistered-runtime";
        Assert.Equal(0, Invoke(Tenant, TickEngine, request).Value<int>("Code"));
    }

    [Fact]
    public void Actual_jint_budget_failure_has_fixed_retry_code_and_recovers_after_release()
    {
        var host=Installed.Value;
        using(host.Admission.TryEnter(Tenant))
        {
            var failed=Invoke(Tenant,TickEngine,Request("DescribeInvocation"));
            Assert.Equal(0,failed.Value<int>("Code"));
            Assert.Equal("KernelBusy",failed["DataAppend"]!.Value<string>("ErrorCode"));
            Assert.True(failed["DataAppend"]!.Value<bool>("Retryable"));
            Assert.Equal("固定步运行时暂不可用。",failed.Value<string>("Msg"));
        }
        Assert.Equal(1,Invoke(Tenant,TickEngine,Request("DescribeInvocation")).Value<int>("Code"));
    }

    [Fact]
    public void Actual_jint_memory_pressure_uses_only_fixed_safe_error_code()
    {
        _=Installed.Value;Volatile.Write(ref memoryPressure,1);
        try
        {
            var failed=Invoke(Tenant,TickEngine,Request("DescribeInvocation"));
            Assert.Equal(0,failed.Value<int>("Code"));
            Assert.Equal("HostMemoryPressure",failed["DataAppend"]!.Value<string>("ErrorCode"));
            Assert.True(failed["DataAppend"]!.Value<bool>("Retryable"));
        }
        finally{Volatile.Write(ref memoryPressure,0);}
    }

    [Fact]
    public void Unauthorized_and_unknown_actions_do_not_receive_transient_details()
    {
        using(Installed.Value.Admission.TryEnter(Tenant))
        {
            var denied=Invoke(Tenant,"not-approved",Request("DescribeInvocation"));
            Assert.Equal(0,denied.Value<int>("Code"));Assert.Null((denied["DataAppend"] as JObject)?["ErrorCode"]);
        }
        var unknown=Invoke(Tenant,TickEngine,Request("unknown-internal-action"));
        Assert.Equal(0,unknown.Value<int>("Code"));Assert.Null((unknown["DataAppend"] as JObject)?["ErrorCode"]);
        Assert.DoesNotContain("UnsupportedFixedStepAction",unknown.Value<string>("Msg"));
    }

    [Fact]
    public void Actual_jint_observe_and_drain_return_explicit_hint_receipts()
    {
        var identity = Invoke(Tenant, TickEngine, Request("DescribeInvocation"));
        var room = "jint-" + Guid.NewGuid().ToString("N");
        var request = Request("ObserveOwnedRoom", new JObject
        {
            ["OwnerNodeId"] = identity["Data"]!["NodeId"], ["RoomId"] = room,
            ["RoomEpoch"] = "epoch", ["AuthorityEpoch"] = "1", ["LeaseRemainingMs"] = 5000
        });
        var observed = Invoke(Tenant, TickEngine, request);
        Assert.Equal(1, observed.Value<int>("Code"));
        Assert.True(observed["Data"]!.Value<bool>("Observed"));
        request["Action"] = "DrainOwnedRoom";
        var drained = Invoke(Tenant, TickEngine, request);
        Assert.Equal(1, drained.Value<int>("Code"));
        Assert.True(drained["Data"]!.Value<bool>("Drained"));
    }

    [Fact]
    public void Actual_jint_creates_advances_and_projects_the_same_generic_counter()
    {
        var created = Invoke(Tenant, TickEngine, Request("CreateInitialState", new JObject
        {
            ["RulesVersion"] = "1", ["LayoutId"] = "one", ["TrustedSetupJson"] = "{}"
        }));
        Assert.Equal(1, created.Value<int>("Code"));
        Assert.Equal("0", created["Data"]!.Value<string>("StateJson"));
        var batch = Invoke(Tenant, TickEngine, Request("AdvanceBatch", new JObject
        {
            ["Schema"] = 1, ["RoomId"] = "room", ["RoomEpoch"] = "epoch", ["AuthorityEpoch"] = "1",
            ["Revision"] = "0", ["RequestId"] = "request-one", ["StartUnixMs"] = 1000,
            ["ServerNowUnixMs"] = 1150, ["LeaseUntilUnixMs"] = 6000, ["CompletedTick"] = 0,
            ["RulesVersion"] = "1", ["LayoutId"] = "one", ["StateJson"] = "0", ["Inbox"] = new JArray()
        }));
        Assert.Equal(1, batch.Value<int>("Code"));
        Assert.Equal(3, batch["Data"]!.Value<long>("CompletedTick"));
        var projected = Invoke(Tenant, ProjectionEngine, Request("Project", new JObject
        {
            ["RulesVersion"] = "1", ["LayoutId"] = "one", ["StateJson"] = batch["Data"]!["StateJson"],
            ["BoundSeatId"] = 2, ["AfterEventSequence"] = 7
        }));
        Assert.Equal(1, projected.Value<int>("Code"));
        Assert.Equal(new JObject { ["tick"] = 3, ["seat"] = 2, ["cursor"] = 7 }.ToString(Formatting.None), projected["Data"]!.Value<string>("ProjectionJson"));
    }

    [Fact]
    public async Task Real_local_http_to_jint_preserves_server_bound_context_and_observe_contract()
    {
        _ = Installed.Value;
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        await using var host = builder.Build();
        // 路由里的身份是测试宿主固定值；请求正文只交给实际原子，不能产生 TenantContext。
        host.MapPost("/allowed", (HttpContext context) => Handle(context, Tenant, TickEngine));
        host.MapPost("/other-tenant", (HttpContext context) => Handle(context, "other-tenant", TickEngine));
        host.MapPost("/other-engine", (HttpContext context) => Handle(context, Tenant, "other-engine"));
        await host.StartAsync(TestContext.Current.CancellationToken);
        var address = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        using var client = new HttpClient { BaseAddress = new Uri(address) };
        var description = await Post("/allowed", Request("DescribeInvocation"));
        Assert.Equal(1, description.Value<int>("Code"));
        var forged = Request("DescribeInvocation", new JObject { ["Tenant"] = Tenant, ["EngineKey"] = TickEngine, ["TrustedPump"] = true });
        Assert.Equal(0, (await Post("/other-tenant", forged)).Value<int>("Code"));
        Assert.Equal(0, (await Post("/other-engine", forged)).Value<int>("Code"));
        var hint = Request("ObserveOwnedRoom", new JObject
        {
            ["OwnerNodeId"] = description["Data"]!["NodeId"], ["RoomId"] = "http-" + Guid.NewGuid().ToString("N"),
            ["RoomEpoch"] = "epoch", ["AuthorityEpoch"] = "1", ["LeaseRemainingMs"] = 5000
        });
        var observed = await Post("/allowed", hint);
        Assert.Equal(1, observed.Value<int>("Code")); Assert.True(observed["Data"]!.Value<bool>("Observed"));
        hint["Action"] = "DrainOwnedRoom";
        var drained = await Post("/allowed", hint);
        Assert.Equal(1, drained.Value<int>("Code")); Assert.True(drained["Data"]!.Value<bool>("Drained"));
        await host.StopAsync(TestContext.Current.CancellationToken);

        async Task<JObject> Post(string path, JObject payload)
        {
            using var content = new StringContent(payload.ToString(Formatting.None), Encoding.UTF8, "application/json");
            using var response = await client.PostAsync(path, content, TestContext.Current.CancellationToken);
            response.EnsureSuccessStatusCode();
            return JObject.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
    }

    private static async Task Handle(HttpContext context, string tenant, string engine)
    {
        using var reader = new StreamReader(context.Request.Body);
        var payload = JObject.Parse(await reader.ReadToEndAsync(context.RequestAborted));
        // MapPost可能选择RequestDelegate重载；显式写回正文，不能让Task<IResult>结果被静默丢弃。
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(Invoke(tenant, engine, payload).ToString(Formatting.None), context.RequestAborted);
    }

    private static JObject Request(string action, JObject? parameters = null)
    {
        parameters ??= new JObject(); parameters["RegistrationId"] = Registration;
        return new JObject { ["RuntimeKey"] = FixedStepRuntimeHost.RuntimeKey, ["Action"] = action, ["Param"] = parameters };
    }

    private static JObject Invoke(string tenant, string apiEngineKey, JObject payload)
    {
        _ = Installed.Value;
        using var context = V8TenantContext.Enter(tenant, apiEngineKey);
        using var engine = new V8Engine().CreateEngine();
        engine.SetValue("V8", new V8EngineParam { Method = new V8Method() });
        engine.SetValue("wire", payload.ToString(Formatting.None));
        // 输入真正经过 Jint 的 JS ObjectInstance -> 生产 JsonHelper -> V8Method 桥，不能用直接 .NET 调用替代。
        var completion = engine.Evaluate("V8.Method.RunPlatformApiRuntime(JSON.parse(wire))");
        return JObject.FromObject(completion.ToObject()!);
    }

    private static FixedStepRuntimeHost CreateHost()
    {
        var type = typeof(Counter); var catalog = new TrustedRulesCatalog();
        catalog.RegisterApproved(new PackageApproval
        {
            Tenant = Tenant, RegistrationId = Registration, PackageKey = "fixture-counter", SourceReceipt = "test-backend-composition",
            AssemblySha256 = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(type.Assembly.Location))), EntryType = type.FullName!,
            TickEngineKey = TickEngine, ProjectionEngineKey = ProjectionEngine, RulesVersion = "1", LayoutId = "one"
        }, () => new Counter());
        var clock = new StopwatchClock();
        var host = new FixedStepRuntimeHost(catalog, new FixedStepKernel(catalog, clock), new HostInvocationIdentity(catalog),
            new BoundedTickCoordinator(catalog, new IdleDispatcher(), clock), new ComputeAdmission(() => Volatile.Read(ref memoryPressure)!=0));
        FixedStepRuntimeHost.Install(host); return host;
    }

    private sealed class IdleDispatcher : IManagedTickDispatcher
    {
        public Task<TickDispatchResult> DispatchAsync(TickDispatch request, CancellationToken cancellationToken) =>
            Task.FromResult(new TickDispatchResult { Status = DispatchStatus.Idle });
    }

    private sealed class Counter : IDeterministicRules
    {
        public long CompletedTick { get; private set; }
        public bool IsTerminal => false;
        public SimulationBinding Binding => new() { Tenant = Tenant, RoomId = "room", RoomEpoch = "epoch" };
        public void Initialize(string setup) { CompletedTick = 0; }
        public void Restore(string state) { CompletedTick = long.Parse(state, System.Globalization.CultureInfo.InvariantCulture); }
        public string Apply(InboxCommand command) => "Accepted";
        public void AdvanceOneTick() { CompletedTick++; }
        public string Capture() => CompletedTick.ToString(System.Globalization.CultureInfo.InvariantCulture);
        public string Project(int seat, long cursor) => new JObject { ["tick"] = CompletedTick, ["seat"] = seat, ["cursor"] = cursor }.ToString(Formatting.None);
    }
}
