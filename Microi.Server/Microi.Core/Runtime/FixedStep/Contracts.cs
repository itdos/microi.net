using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.FixedStep
{

/// <summary>来自可信 V8 请求上下文；桥接器不得从 Param 或 HTTP Header 创建此对象。</summary>
public sealed class InvocationContext
{
    public string Tenant { get; }
    public string EngineKey { get; }
    public InvocationContext(string tenant,string engineKey){Tenant=Guard.Id(tenant);EngineKey=Guard.Id(engineKey);}
}

/// <summary>只有应用安装/部署路径提供：已审批来源、不可变程序集 hash、租户与唯一入口。</summary>
public sealed class PackageApproval
{
    public string RegistrationId { get; set; }="";
    public string Tenant { get; set; }="";
    public string PackageKey { get; set; }="";
    public string SourceReceipt { get; set; }="";
    public string AssemblySha256 { get; set; }="";
    public string EntryType { get; set; }="";
    public string TickEngineKey { get; set; }="";
    public string ProjectionEngineKey { get; set; }="";
    public string RulesVersion { get; set; }="";
    public string LayoutId { get; set; }="";
}

/// <summary>主库锁下读出的批次信封，所有数值由 Managed 引擎生成，玩家不能直接提交。</summary>
public sealed class AdvanceEnvelope
{
    public int Schema { get; set; }=1;
    public string RegistrationId { get; set; }="";
    public string RoomId { get; set; }="";
    public string RoomEpoch { get; set; }="";
    public string AuthorityEpoch { get; set; }="";
    public string Revision { get; set; }="";
    public string RequestId { get; set; }="";
    public long StartUnixMs { get; set; }
    public long ServerNowUnixMs { get; set; }
    public long LeaseUntilUnixMs { get; set; }
    public long CompletedTick { get; set; }
    public string RulesVersion { get; set; }="";
    public string LayoutId { get; set; }="";
    public string StateJson { get; set; }="";
    public InboxCommand[] Inbox { get; set; }=Array.Empty<InboxCommand>();
}

/// <summary>身份在 Managed 中通过 DiyToken + room membership 固定，非客户端 ActorId。</summary>
public sealed class InboxCommand
{
    public string CommandId { get; set; }="";
    public string CanonicalHash { get; set; }="";
    public bool IsSystem { get; set; }
    public int SeatId { get; set; }
    public long Generation { get; set; }
    public long Sequence { get; set; }
    public long AssignedTick { get; set; }
    public long Order { get; set; }
    public string PayloadJson { get; set; }="";
}

public sealed class CommandReceipt
{
    public string CommandId { get; set; }="";
    public int SeatId { get; set; }
    public long Generation { get; set; }
    public long Sequence { get; set; }
    public long AppliedTick { get; set; }
    public string Outcome { get; set; }="";
}

public sealed class AdvanceResult
{
    public int Schema { get; set; }=1;
    public string RequestId { get; set; }="";
    public string InputHash { get; set; }="";
    public string StateJson { get; set; }="";
    public string StateHash { get; set; }="";
    public long CompletedTick { get; set; }
    public long DueTick { get; set; }
    public bool HasMore { get; set; }
    public bool IsTerminal { get; set; }
    public CommandReceipt[] Receipts { get; set; }=Array.Empty<CommandReceipt>();
}

public sealed class InitialStateResult
{
    public int Schema { get; set; }=1;
    public string StateJson { get; set; }="";
    public string StateHash { get; set; }="";
    public long CompletedTick { get; set; }
}

/// <summary>应用包实现；内核不包含游戏规则，不为应用开放 DB/网络。每批恢复新实例，失败无部分应用。</summary>
public interface IDeterministicRules
{
    long CompletedTick { get; }
    bool IsTerminal { get; }
    SimulationBinding Binding { get; }
    void Initialize(string trustedSetupJson);
    void Restore(string stateJson);
    string Apply(InboxCommand command);
    void AdvanceOneTick();
    string Capture();
    string Project(int boundSeatId,long afterEventSequence);
}

public sealed class SimulationBinding
{
    public string Tenant { get; set; }="";
    public string RoomId { get; set; }="";
    public string RoomEpoch { get; set; }="";
}

public interface IMonotonicClock { long Milliseconds { get; } }
public enum DispatchStatus { Committed, Idle, Unknown, StaleLease }
public sealed class TickDispatchResult
{
    public DispatchStatus Status { get; set; }
    public long LeaseRemainingMs { get; set; }
}
public sealed class TickDispatch
{
    public string Tenant { get; internal set; }="";
    public string RegistrationId { get; internal set; }="";
    public string EngineKey { get; internal set; }="";
    public string RoomId { get; internal set; }="";
    public string RoomEpoch { get; internal set; }="";
    public string AuthorityEpoch { get; internal set; }="";
    public string RequestId { get; internal set; }="";
}

/// <summary>平台适配器以受信后台身份调用固定 Managed 引擎；返回前已提交，Unknown 不代表失败回滚。</summary>
public interface IManagedTickDispatcher
{
    Task<TickDispatchResult> DispatchAsync(TickDispatch request,CancellationToken cancellationToken);
}

internal static class Guard
{
    public static string Id(string value){if(string.IsNullOrEmpty(value)||value.Length>128)throw new InvalidOperationException("InvalidId");foreach(var c in value)if(!((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='_'||c=='-'||c=='.'))throw new InvalidOperationException("InvalidId");return value;}
    public static bool Decimal(string value){return long.TryParse(value,System.Globalization.NumberStyles.None,System.Globalization.CultureInfo.InvariantCulture,out var n)&&n>=0&&n.ToString(System.Globalization.CultureInfo.InvariantCulture)==value;}
}
}
