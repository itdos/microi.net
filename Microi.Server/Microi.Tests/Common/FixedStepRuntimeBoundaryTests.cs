using System.Security.Cryptography;
using Microi.FixedStep;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>平台通用边界。计数规则夹具不引用任何独立游戏源码或应用测试入口。</summary>
public sealed class FixedStepRuntimeBoundaryTests
{
    [Fact]
    public void All_entries_share_tenant_and_global_budget_and_release_after_exception()
    {
        var gate=new ComputeAdmission(()=>false);
        using(gate.TryEnter("a"))
        {
            Assert.Throws<InvalidOperationException>(()=>gate.TryEnter("a"));
            using(gate.TryEnter("b"))Assert.Throws<InvalidOperationException>(()=>gate.TryEnter("c"));
        }
        using(gate.TryEnter("a")) { }
    }

    [Fact]
    public void Memory_pressure_fails_before_native_factory_execution()
    {
        Assert.Equal("HostMemoryPressure",Assert.Throws<InvalidOperationException>(()=>new ComputeAdmission(()=>true).TryEnter("tenant")).Message);
    }

    [Fact]
    public async Task Pump_scope_is_revoked_even_in_inherited_async_child()
    {
        var catalog=Catalog();var identity=new HostInvocationIdentity(catalog);
        var start=new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);Task<bool> inherited;
        using(identity.EnterPump(new TickDispatch{Tenant="tenant",RegistrationId="reg",EngineKey="counter_tick",RoomId="room",RoomEpoch="epoch",AuthorityEpoch="1",RequestId="fixed"}))
        {
            inherited=Task.Run(async()=>{await start.Task;return identity.DescribeInvocation(new("tenant","counter_tick"),"reg").TrustedPump;});
            Assert.True(identity.DescribeInvocation(new("tenant","counter_tick"),"reg").TrustedPump);
        }
        start.SetResult(true);Assert.False(await inherited);
    }

    [Fact]
    public void Actual_tenant_and_exact_engine_are_required_for_native_identity()
    {
        var identity=new HostInvocationIdentity(Catalog());
        Assert.Throws<InvalidOperationException>(()=>identity.DescribeInvocation(new("other","counter_tick"),"reg"));
        Assert.Throws<InvalidOperationException>(()=>identity.DescribeInvocation(new("tenant","counter_projection"),"reg"));
        Assert.False(identity.DescribeInvocation(new("tenant","counter_tick"),"reg").TrustedPump);
    }

    [Fact]
    public void Duplicate_backend_registrars_do_not_override_earlier_approval()
    {
        var binding=new CompiledRulesBinding("tenant","reg",new string('a',64),typeof(Counter),()=>new Counter());
        Assert.Throws<InvalidOperationException>(()=>new CompiledRulesDeployments(new[]{new Registrar(binding),new Registrar(binding)}));
    }

    [Fact]
    public void Completed_but_soft_deleted_source_is_rejected()
    {
        var row=new JObject();
        foreach(var key in new[]{"Id","TenantKey","RegistrationId","PackageKey","InstallRecordId","PublisherTenant","PublishedAppId","PublishedVersionId","PublishedVersion","SourceManifestHash","AssemblySha256","EntryType","TickEngineKey","ProjectionEngineKey","RulesVersion","LayoutId","ApprovedBy","PublisherIdentity"})row[key]="fixture";
        row["TenantKey"]=row["PublisherTenant"]="tenant";row["RegistrationId"]="reg";row["EntryType"]=typeof(Counter).FullName;
        row["SourceManifestHash"]=new string('a',64);row["DependencyJson"]=new JObject{[typeof(Counter).Assembly.FullName!]=new string('a',64)}.ToString();
        row["Status"]="Approved";row["LiveInstallStatus"]="Installed";row["LiveInstallTenant"]="tenant";row["LiveInstalledVersion"]=row["LiveStoreId"]=row["LivePublishedAppId"]=row["LivePublishedVersion"]="fixture";
        row["LivePublishState"]="Completed";row["LivePublishProtocol"]=3;row["LiveSourceHash"]=new string('a',64);row["LiveCompletedAt"]="2026-10-04";row["LiveVersionDeleted"]=1;
        var binding=new CompiledRulesBinding("tenant","reg",RulesInstallationRecord.Digest(row),typeof(Counter),()=>new Counter());
        Assert.Equal("PublishedSourceMismatch",Assert.Throws<InvalidOperationException>(()=>RulesInstallationRecord.Verify(row,binding)).Message);
    }

    [Fact]
    public async Task Drain_preserves_current_commit_token_and_blocks_followup_and_reobserve()
    {
        var dispatcher=new BlockingDispatcher();var coordinator=new BoundedTickCoordinator(Catalog(),dispatcher,new StopwatchClock());
        coordinator.RegisterOwnedRoom("tenant","reg","room","epoch","1",5000);
        coordinator.Pulse();await dispatcher.Started.Task.WaitAsync(TimeSpan.FromSeconds(2),TestContext.Current.CancellationToken);
        coordinator.DrainOwnedRoom("tenant","reg","room","epoch","1");
        Assert.False(dispatcher.Token.IsCancellationRequested);
        Assert.Equal("RoomStillDraining",Assert.Throws<InvalidOperationException>(()=>coordinator.ObserveOwnedRoom("tenant","reg","room","epoch","1",5000)).Message);
        Assert.False(dispatcher.Token.IsCancellationRequested);
        coordinator.Pulse();Assert.Equal(1,dispatcher.Calls);
        dispatcher.Release.TrySetResult(true);await WaitDrained(coordinator);
        Assert.True(dispatcher.ReturnedNormally);
        coordinator.Pulse();Assert.Equal(1,dispatcher.Calls);
    }

    [Fact]
    public async Task Immediate_stop_retains_cancellation_semantics()
    {
        var dispatcher=new BlockingDispatcher();var coordinator=new BoundedTickCoordinator(Catalog(),dispatcher,new StopwatchClock());
        coordinator.RegisterOwnedRoom("tenant","reg","room","epoch","1",5000);
        coordinator.Pulse();await dispatcher.Started.Task.WaitAsync(TimeSpan.FromSeconds(2),TestContext.Current.CancellationToken);
        coordinator.StopOwnedRoom("tenant","room","epoch","1");
        Assert.True(dispatcher.Token.IsCancellationRequested);await WaitDrained(coordinator);
        Assert.False(dispatcher.ReturnedNormally);
    }

    [Fact]
    public async Task Drain_does_not_disable_the_original_lease_deadline()
    {
        var dispatcher=new BlockingDispatcher();var coordinator=new BoundedTickCoordinator(Catalog(),dispatcher,new StopwatchClock());
        coordinator.RegisterOwnedRoom("tenant","reg","room","epoch","1",500);
        coordinator.Pulse();await dispatcher.Started.Task.WaitAsync(TimeSpan.FromSeconds(2),TestContext.Current.CancellationToken);
        coordinator.DrainOwnedRoom("tenant","reg","room","epoch","1");
        await WaitDrained(coordinator);
        Assert.True(dispatcher.Token.IsCancellationRequested);Assert.False(dispatcher.ReturnedNormally);
    }

    [Fact]
    public async Task Global_shutdown_cancels_a_room_that_is_already_draining()
    {
        var dispatcher=new BlockingDispatcher();var coordinator=new BoundedTickCoordinator(Catalog(),dispatcher,new StopwatchClock());
        coordinator.RegisterOwnedRoom("tenant","reg","room","epoch","1",5000);
        coordinator.Pulse();await dispatcher.Started.Task.WaitAsync(TimeSpan.FromSeconds(2),TestContext.Current.CancellationToken);
        coordinator.DrainOwnedRoom("tenant","reg","room","epoch","1");
        Assert.False(await coordinator.StopAsync(0));await WaitDrained(coordinator);
        Assert.True(dispatcher.Token.IsCancellationRequested);Assert.False(dispatcher.ReturnedNormally);
    }

    [Fact]
    public async Task Drain_requires_matching_tenant_registration_room_epoch_and_fence()
    {
        var dispatcher=new BlockingDispatcher();var coordinator=new BoundedTickCoordinator(Catalog(),dispatcher,new StopwatchClock());
        coordinator.RegisterOwnedRoom("tenant","reg","room","epoch","1",5000);
        coordinator.Pulse();await dispatcher.Started.Task.WaitAsync(TimeSpan.FromSeconds(2),TestContext.Current.CancellationToken);
        coordinator.DrainOwnedRoom("other","reg","room","epoch","1");
        coordinator.DrainOwnedRoom("tenant","other","room","epoch","1");
        coordinator.DrainOwnedRoom("tenant","reg","other","epoch","1");
        coordinator.DrainOwnedRoom("tenant","reg","room","other","1");
        coordinator.DrainOwnedRoom("tenant","reg","room","epoch","2");
        // 如果任何错误身份排空了当前请求，这里的同代租约提示将抛 RoomStillDraining。
        coordinator.ObserveOwnedRoom("tenant","reg","room","epoch","1",5000);
        Assert.False(dispatcher.Token.IsCancellationRequested);
        dispatcher.Release.TrySetResult(true);await WaitDrained(coordinator);
        Assert.True(dispatcher.ReturnedNormally);coordinator.StopOwnedRoom("tenant","room","epoch","1");
    }

    private static async Task WaitDrained(BoundedTickCoordinator coordinator)
    {
        using var deadline=CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);deadline.CancelAfter(TimeSpan.FromSeconds(2));
        while(!coordinator.IsDrained)await Task.Delay(5,deadline.Token);
    }

    [Fact]
    public async Task Shutdown_handles_inline_cancellation_that_removes_room_while_idle_rooms_remain()
    {
        var dispatcher=new InlineCancellationDispatcher();var coordinator=new BoundedTickCoordinator(Catalog(),dispatcher,new StopwatchClock());
        coordinator.RegisterOwnedRoom("tenant","reg","active","epoch","1",5000);
        coordinator.RegisterOwnedRoom("tenant","reg","idle","epoch","1",5000);
        coordinator.Pulse();await dispatcher.Started.Task.WaitAsync(TimeSpan.FromSeconds(2),TestContext.Current.CancellationToken);
        Assert.False(await coordinator.StopAsync(0));
        await WaitDrained(coordinator);
        Assert.True(dispatcher.CancelCallbackRan);Assert.Equal(1,dispatcher.Calls);
        coordinator.Pulse();Assert.Equal(1,dispatcher.Calls);
        Assert.True(await coordinator.StopAsync(0));
    }

    [Fact]
    public async Task Immediate_stop_handles_inline_finally_and_allows_later_room_registration()
    {
        var dispatcher=new InlineCancellationDispatcher();var coordinator=new BoundedTickCoordinator(Catalog(),dispatcher,new StopwatchClock());
        coordinator.RegisterOwnedRoom("tenant","reg","room","epoch","1",5000);
        coordinator.Pulse();await dispatcher.Started.Task.WaitAsync(TimeSpan.FromSeconds(2),TestContext.Current.CancellationToken);
        coordinator.StopOwnedRoom("tenant","room","epoch","1");await WaitDrained(coordinator);
        Assert.True(dispatcher.CancelCallbackRan);
        coordinator.RegisterOwnedRoom("tenant","reg","room","next-epoch","2",5000);
        Assert.True(await coordinator.StopAsync(0));
    }

    private sealed class InlineCancellationDispatcher:IManagedTickDispatcher
    {
        internal readonly TaskCompletionSource<bool> Started=new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal bool CancelCallbackRan;internal int Calls;
        public Task<TickDispatchResult> DispatchAsync(TickDispatch request,CancellationToken cancellationToken)
        {
            // 故意不用RunContinuationsAsynchronously：强制覆盖Cancel同步触发Complete.finally的真实失败窗口。
            var pending=new TaskCompletionSource<TickDispatchResult>();Interlocked.Increment(ref Calls);
            cancellationToken.Register(()=>{CancelCallbackRan=true;pending.TrySetCanceled(cancellationToken);});
            Started.TrySetResult(true);return pending.Task;
        }
    }

    private sealed class BlockingDispatcher:IManagedTickDispatcher
    {
        internal readonly TaskCompletionSource<bool> Started=new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal readonly TaskCompletionSource<bool> Release=new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal CancellationToken Token;
        internal int Calls;
        internal bool ReturnedNormally;
        public async Task<TickDispatchResult> DispatchAsync(TickDispatch request,CancellationToken cancellationToken)
        {
            Token=cancellationToken;Interlocked.Increment(ref Calls);Started.TrySetResult(true);
            await Release.Task.WaitAsync(cancellationToken);cancellationToken.ThrowIfCancellationRequested();ReturnedNormally=true;
            return new TickDispatchResult{Status=DispatchStatus.Committed};
        }
    }

    private static TrustedRulesCatalog Catalog()
    {
        var type=typeof(Counter);var sha=Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(type.Assembly.Location)));
        var c=new TrustedRulesCatalog();c.RegisterApproved(new PackageApproval{Tenant="tenant",RegistrationId="reg",PackageKey="counter",SourceReceipt="fixture",AssemblySha256=sha,EntryType=type.FullName!,TickEngineKey="counter_tick",ProjectionEngineKey="counter_projection",RulesVersion="1",LayoutId="one"},()=>new Counter());return c;
    }
    private sealed class Registrar(CompiledRulesBinding binding):ITrustedRulesRegistrar{public IEnumerable<CompiledRulesBinding> Registrations=>new[]{binding};}
    private sealed class Counter:IDeterministicRules
    {
        public long CompletedTick{get;private set;}
        public bool IsTerminal=>false;public SimulationBinding Binding=>new(){Tenant="tenant",RoomId="room",RoomEpoch="epoch"};
        public void Initialize(string setup){CompletedTick=0;}public void Restore(string state){CompletedTick=long.Parse(state);}
        public string Apply(InboxCommand c)=>"Accepted";public void AdvanceOneTick(){CompletedTick++;}
        public string Capture()=>CompletedTick.ToString();public string Project(int seat,long cursor)=>"{}";
    }
}
