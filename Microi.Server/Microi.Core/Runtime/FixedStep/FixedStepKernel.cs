using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading;

namespace Microi.FixedStep
{
/// <summary>无共享权威状态的确定性原子。仅计算；外层同主库事务持有 room 锁并做 fence/revision CAS。</summary>
public sealed class FixedStepKernel
{
    public const int StepMilliseconds=50;
    public const int MaxCatchUpSteps=4;
    public const int MaxInboxCommands=64;
    public const int MaxStateBytes=8*1024*1024;
    public const int MaxPayloadBytes=4096;
    private readonly TrustedRulesCatalog catalog;
    private readonly IMonotonicClock clock;
    public FixedStepKernel(TrustedRulesCatalog catalog,IMonotonicClock clock){this.catalog=catalog;this.clock=clock;}

    public InitialStateResult CreateInitialState(InvocationContext context,string registrationId,string rulesVersion,string layoutId,string trustedSetupJson)
    {
        if(trustedSetupJson==null||Encoding.UTF8.GetByteCount(trustedSetupJson)>65536)throw new InvalidOperationException("SetupTooLarge");
        var rules=catalog.Create(context,registrationId,false,rulesVersion,layoutId);rules.Initialize(trustedSetupJson);
        var state=rules.Capture();if(rules.CompletedTick!=0||rules.Binding.Tenant!=context.Tenant||state==null||Encoding.UTF8.GetByteCount(state)>MaxStateBytes)throw new InvalidOperationException("InvalidInitialState");
        return new InitialStateResult{StateJson=state,StateHash=TrustedRulesCatalog.Hash(state),CompletedTick=0};
    }

    public AdvanceResult AdvanceBatch(InvocationContext context,AdvanceEnvelope envelope,CancellationToken cancellationToken)
    {
        if(envelope==null||envelope.Schema!=1)throw new InvalidOperationException("InvalidEnvelope");
        Guard.Id(envelope.RegistrationId);Guard.Id(envelope.RoomId);Guard.Id(envelope.RoomEpoch);Guard.Id(envelope.RequestId);
        if(!Guard.Decimal(envelope.AuthorityEpoch)||!Guard.Decimal(envelope.Revision)||envelope.StartUnixMs<0||envelope.ServerNowUnixMs<envelope.StartUnixMs||envelope.LeaseUntilUnixMs<=envelope.ServerNowUnixMs||envelope.CompletedTick<0||envelope.CompletedTick>int.MaxValue-1000)throw new InvalidOperationException("InvalidClockOrFence");
        var begin=clock.Milliseconds;
        var leaseBudget=envelope.LeaseUntilUnixMs-envelope.ServerNowUnixMs;
        void CheckBudget(){cancellationToken.ThrowIfCancellationRequested();var elapsed=clock.Milliseconds-begin;if(elapsed<0||elapsed>=leaseBudget)throw new InvalidOperationException("StaleLease");if(elapsed>100)throw new InvalidOperationException("ComputeBudgetExceeded");}
        if(envelope.StateJson==null||Encoding.UTF8.GetByteCount(envelope.StateJson)>MaxStateBytes)throw new InvalidOperationException("StateTooLarge");
        if(envelope.Inbox==null||envelope.Inbox.Length>MaxInboxCommands)throw new InvalidOperationException("InboxOverflow");
        var due=(envelope.ServerNowUnixMs-envelope.StartUnixMs)/StepMilliseconds;
        if(due<envelope.CompletedTick)throw new InvalidOperationException("ClockBehindCheckpoint");
        var target=Math.Min(due,envelope.CompletedTick+MaxCatchUpSteps);
        var commands=envelope.Inbox.OrderBy(c=>c?.AssignedTick??long.MinValue).ThenBy(c=>c?.Order??long.MinValue).ToArray();
        var ids=new HashSet<string>(StringComparer.Ordinal);var orders=new HashSet<long>();
        foreach(var cmd in commands)
        {
            if(cmd==null||cmd.SeatId<0||cmd.SeatId>255||cmd.Generation<1||(cmd.IsSystem?cmd.Sequence!=0:cmd.Sequence<1)||cmd.Order<1||cmd.AssignedTick<envelope.CompletedTick||cmd.AssignedTick>due||!orders.Add(cmd.Order))throw new InvalidOperationException("InvalidInbox");
            Guard.Id(cmd.CommandId);if(!ids.Add(cmd.CommandId)||cmd.PayloadJson==null||Encoding.UTF8.GetByteCount(cmd.PayloadJson)>MaxPayloadBytes||cmd.CanonicalHash!=TrustedRulesCatalog.Hash(cmd.PayloadJson))throw new InvalidOperationException("CommandHashMismatch");
        }
        // 每批创建新 rules 实例，因此坏输入、超时或中途抛错不污染已提交 checkpoint，也没有进程内秘密 authority。
        var rules=catalog.Create(context,envelope.RegistrationId,false,envelope.RulesVersion,envelope.LayoutId);
        rules.Restore(envelope.StateJson);if(rules.CompletedTick!=envelope.CompletedTick)throw new InvalidOperationException("CheckpointTickMismatch");
        if(rules.Binding.Tenant!=context.Tenant||rules.Binding.RoomId!=envelope.RoomId||rules.Binding.RoomEpoch!=envelope.RoomEpoch)throw new InvalidOperationException("CheckpointBindingMismatch");
        CheckBudget();var receipts=new List<CommandReceipt>();var cursor=0;
        while(true)
        {
            CheckBudget();
            while(cursor<commands.Length&&commands[cursor].AssignedTick<=rules.CompletedTick)
            {
                var cmd=commands[cursor++];var at=rules.CompletedTick;var outcome=rules.Apply(cmd);
                if(rules.CompletedTick!=at||string.IsNullOrEmpty(outcome)||outcome.Length>128)throw new InvalidOperationException("InvalidRulesReceipt");
                receipts.Add(new CommandReceipt{CommandId=cmd.CommandId,SeatId=cmd.SeatId,Generation=cmd.Generation,Sequence=cmd.Sequence,AppliedTick=at,Outcome=outcome});CheckBudget();
            }
            if(rules.CompletedTick==target||rules.IsTerminal)break;
            var previous=rules.CompletedTick;rules.AdvanceOneTick();if(rules.CompletedTick!=previous+1)throw new InvalidOperationException("RulesStepMismatch");
        }
        var state=rules.Capture();CheckBudget();if(state==null||Encoding.UTF8.GetByteCount(state)>MaxStateBytes)throw new InvalidOperationException("StateTooLarge");
        return new AdvanceResult{RequestId=envelope.RequestId,InputHash=InputHash(context,envelope),StateJson=state,StateHash=TrustedRulesCatalog.Hash(state),CompletedTick=rules.CompletedTick,DueTick=due,HasMore=!rules.IsTerminal&&rules.CompletedTick<due,IsTerminal=rules.IsTerminal,Receipts=receipts.ToArray()};
    }

    /// <summary>必须先由固定 Managed 投影接口用 CurrentUser 确定 boundSeatId；不允许公开直接调用。</summary>
    public string Project(InvocationContext context,string registrationId,string rulesVersion,string layoutId,string stateJson,int boundSeatId,long afterEventSequence=0)
    {
        if(boundSeatId<0||boundSeatId>255||afterEventSequence<0||stateJson==null||Encoding.UTF8.GetByteCount(stateJson)>MaxStateBytes)throw new InvalidOperationException("InvalidProjection");
        var rules=catalog.Create(context,registrationId,true,rulesVersion,layoutId);rules.Restore(stateJson);if(rules.Binding.Tenant!=context.Tenant)throw new InvalidOperationException("CheckpointBindingMismatch");var json=rules.Project(boundSeatId,afterEventSequence);
        if(json==null||Encoding.UTF8.GetByteCount(json)>1024*1024)throw new InvalidOperationException("ProjectionTooLarge");return json;
    }
    private static string InputHash(InvocationContext context,AdvanceEnvelope e)
    {
        // 长度前缀不会因分隔符或属性顺序发生歧义；绑定所有可信输入，不用于公开身份标识。
        var parts=new List<string>{context.Tenant,e.RegistrationId,e.RoomId,e.RoomEpoch,e.AuthorityEpoch,e.Revision,e.RequestId,e.StartUnixMs.ToString(CultureInfo.InvariantCulture),e.ServerNowUnixMs.ToString(CultureInfo.InvariantCulture),e.LeaseUntilUnixMs.ToString(CultureInfo.InvariantCulture),e.CompletedTick.ToString(CultureInfo.InvariantCulture),e.RulesVersion,e.LayoutId,TrustedRulesCatalog.Hash(e.StateJson)};
        foreach(var c in e.Inbox.OrderBy(c=>c.AssignedTick).ThenBy(c=>c.Order)){parts.Add(c.CommandId);parts.Add(c.IsSystem?"1":"0");parts.Add(c.SeatId.ToString(CultureInfo.InvariantCulture));parts.Add(c.Generation.ToString(CultureInfo.InvariantCulture));parts.Add(c.Sequence.ToString(CultureInfo.InvariantCulture));parts.Add(c.AssignedTick.ToString(CultureInfo.InvariantCulture));parts.Add(c.Order.ToString(CultureInfo.InvariantCulture));parts.Add(c.CanonicalHash);}
        return TrustedRulesCatalog.Hash(string.Concat(parts.Select(p=>p.Length.ToString(CultureInfo.InvariantCulture)+":"+p)));
    }
}

public sealed class StopwatchClock : IMonotonicClock
{
    private readonly Stopwatch watch=Stopwatch.StartNew();
    public long Milliseconds=>watch.ElapsedMilliseconds;
}
}
