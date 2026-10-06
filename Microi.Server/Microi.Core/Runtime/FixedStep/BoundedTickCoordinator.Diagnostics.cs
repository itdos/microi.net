using System;
using System.Collections.Generic;
using System.Linq;

namespace Microi.FixedStep
{
/// <summary>只观察当前节点；不访问审批、工厂或数据库，不提供房间授权和共享租约。</summary>
public sealed partial class BoundedTickCoordinator
{
    private sealed class DiagnosticEntry
    {
        internal string Tenant="",RoomId="",RegistrationId="",EngineKey="",LocalState="Owned",LastOutcome="",LastErrorCode="";
        internal long Order,Dispatches,Committed,Unknown,LastElapsedMs;
        internal int? LastResultCode;
        internal DateTime? LastStartedUtc,LastCompletedUtc;
    }
    private readonly List<DiagnosticEntry> diagnosticHistory=new List<DiagnosticEntry>();
    private long diagnosticOrder;
    private string loopState="NotStarted",loopErrorCode="";
    private DateTime? loopStartedUtc,lastWakeUtc;

    // 与房间集合共用短临界区。先淘汰已移除房间，保留活跃房间；历史容量不随租户或失败次数增长。
    private DiagnosticEntry Diagnostic(Room room)
    {
        var entry=diagnosticHistory.FirstOrDefault(e=>e.Tenant==room.Tenant&&e.RoomId==room.Id);
        if(entry==null)
        {
            if(diagnosticHistory.Count(e=>e.Tenant==room.Tenant)>=MaximumTenantRooms)EvictDiagnostic(room.Tenant);
            if(diagnosticHistory.Count>=MaximumRooms)EvictDiagnostic(null);
            entry=new DiagnosticEntry{Tenant=room.Tenant,RoomId=room.Id};diagnosticHistory.Add(entry);
        }
        entry.RegistrationId=room.RegistrationId;entry.EngineKey=room.Engine;entry.Order=++diagnosticOrder;
        return entry;
    }
    private void EvictDiagnostic(string tenant)
    {
        var candidates=diagnosticHistory.Where(e=>tenant==null||e.Tenant==tenant).OrderBy(e=>e.Order).ToArray();
        var victim=candidates.FirstOrDefault(e=>!rooms.Any(r=>!r.Removed&&r.Tenant==e.Tenant&&r.Id==e.RoomId))??candidates.FirstOrDefault();
        if(victim!=null)diagnosticHistory.Remove(victim);
    }
    private void RecordLocalState(Room room,string state){Diagnostic(room).LocalState=state;}
    private void RecordDispatchStarted(Room room)
    {
        var e=Diagnostic(room);e.LocalState="InFlight";e.Dispatches=Increment(e.Dispatches);e.LastStartedUtc=DateTime.UtcNow;
    }
    private void RecordDispatchResult(Room room,TickDispatchResult result,long elapsed)
    {
        var e=Diagnostic(room);e.LastCompletedUtc=DateTime.UtcNow;e.LastElapsedMs=Math.Max(0,Math.Min(30000,elapsed));
        e.LastOutcome=result.Status.ToString();e.LastResultCode=result.ResultCode;
        e.LastErrorCode=string.IsNullOrEmpty(result.DiagnosticCode)?"":TickDispatchDiagnosticCodes.Safe(result.DiagnosticCode);
        if(result.Status==DispatchStatus.Unknown)e.Unknown=Increment(e.Unknown);
        if(result.Status==DispatchStatus.Committed)e.Committed=Increment(e.Committed);
        if(!room.Removed)e.LocalState="Owned";
    }
    private void RecordDispatchFailure(Room room,string safeCode)
    {
        var e=Diagnostic(room);e.LastCompletedUtc=DateTime.UtcNow;e.LastOutcome="Unknown";e.LastErrorCode=TickDispatchDiagnosticCodes.Safe(safeCode);
        e.LastResultCode=null;e.Unknown=Increment(e.Unknown);if(!room.Removed)e.LocalState="Owned";
    }
    private static long Increment(long value){return value==long.MaxValue?value:value+1;}

    /// <summary>调用方必须先完成管理员与租户鉴权；返回独立副本，不泄漏请求号、fence、Token 或自由错误文本。</summary>
    public FixedStepPumpSnapshot Snapshot(string tenant)
    {
        lock(gate)
        {
            var now=clock.Milliseconds;
            var rows=diagnosticHistory.Where(e=>e.Tenant==tenant).OrderByDescending(e=>e.Order).Select(e=>
            {
                var room=rooms.FirstOrDefault(r=>!r.Removed&&r.Tenant==tenant&&r.Id==e.RoomId);
                return new FixedStepPumpRoomSnapshot
                {
                    RoomId=e.RoomId,RegistrationId=e.RegistrationId,EngineKey=e.EngineKey,LocalState=e.LocalState,
                    LocalLeaseRemainingMs=room==null?0:Math.Max(0,Math.Min(30000,room.LeaseDeadline-now)),
                    Dispatches=e.Dispatches,Committed=e.Committed,Unknown=e.Unknown,LastOutcome=e.LastOutcome,
                    LastErrorCode=e.LastErrorCode,LastResultCode=e.LastResultCode,LastElapsedMs=e.LastElapsedMs,
                    LastStartedUtc=e.LastStartedUtc,LastCompletedUtc=e.LastCompletedUtc
                };
            }).ToArray();
            return new FixedStepPumpSnapshot{Available=true,LoopState=loopState,LoopErrorCode=loopErrorCode,LoopStartedUtc=loopStartedUtc,LastWakeUtc=lastWakeUtc,Stopping=stopping,
                OwnedRooms=rooms.Count(r=>!r.Removed&&r.Tenant==tenant),ActiveDispatches=rooms.Count(r=>r.Busy&&r.Tenant==tenant),Rooms=rows};
        }
    }
}

/// <summary>后台运行态观察不代表主库提交成功、20Hz 容量、授权或多节点验收。</summary>
public sealed class FixedStepPumpSnapshot
{
    public string Protocol {get;}="fixed-step-pump/v1";
    public bool CurrentNodeOnly {get;}=true;
    public bool AuthorizationProof {get;}=false;
    public bool Available {get;set;}
    public string LoopState {get;set;}="Unavailable";
    public string LoopErrorCode {get;set;}="";
    public DateTime? LoopStartedUtc {get;set;}
    public DateTime? LastWakeUtc {get;set;}
    public bool Stopping {get;set;}
    public int OwnedRooms {get;set;}
    public int ActiveDispatches {get;set;}
    public FixedStepPumpRoomSnapshot[] Rooms {get;set;}=Array.Empty<FixedStepPumpRoomSnapshot>();
}
public sealed class FixedStepPumpRoomSnapshot
{
    public string RoomId {get;set;}="";
    public string RegistrationId {get;set;}="";
    public string EngineKey {get;set;}="";
    public string LocalState {get;set;}="";
    public long LocalLeaseRemainingMs {get;set;}
    public long Dispatches {get;set;}
    public long Committed {get;set;}
    public long Unknown {get;set;}
    public string LastOutcome {get;set;}="";
    public string LastErrorCode {get;set;}="";
    public int? LastResultCode {get;set;}
    public long LastElapsedMs {get;set;}
    public DateTime? LastStartedUtc {get;set;}
    public DateTime? LastCompletedUtc {get;set;}
}

internal static class TickDispatchDiagnosticCodes
{
    private static readonly HashSet<string> Allowed=new HashSet<string>(new[]{"LoginRequired","AuthenticationDenied","ManagedRejected","EmptyManagedResponse","MalformedManagedResponse","ReceiptMismatch",
        "KernelBusy","HostMemoryPressure","RoomStillDraining","CoordinatorStopping","StaleLease","ComputeBudgetExceeded","StalePumpBinding","RoomUnavailable","MultiplayerNotConfigured","DispatcherException","DispatcherCancelled"},StringComparer.Ordinal);
    internal static string Safe(string code){return code!=null&&Allowed.Contains(code)?code:"ManagedRejected";}
}
}
