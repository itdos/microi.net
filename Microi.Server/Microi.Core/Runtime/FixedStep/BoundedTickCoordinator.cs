using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.FixedStep
{
/// <summary>50ms 唤醒器不是全局权威锁。每次写入仍由 Managed 校验主库 lease/fence/revision。</summary>
public sealed class BoundedTickCoordinator
{
    public const int IntervalMilliseconds=50;
    public const int MaximumRooms=128;
    public const int MaximumTenantRooms=16;
    public const int MaximumGlobalConcurrency=2;
    private sealed class Room
    {
        internal string Tenant="",RegistrationId="",Engine="",Id="",Epoch="",Fence="",RequestId="";
        internal long LeaseDeadline;
        internal bool Busy,Removed;
        internal Task Work=Task.CompletedTask;
        internal CancellationTokenSource Cancel=new CancellationTokenSource();
    }
    private readonly object gate=new object();
    private readonly List<Room> rooms=new List<Room>();
    private readonly HashSet<string> activeTenants=new HashSet<string>(StringComparer.Ordinal);
    private readonly IMonotonicClock clock;
    private readonly IManagedTickDispatcher dispatcher;
    private readonly TrustedRulesCatalog catalog;
    private int running,cursor;
    private bool stopping;
    public BoundedTickCoordinator(TrustedRulesCatalog catalog,IManagedTickDispatcher dispatcher,IMonotonicClock clock){this.catalog=catalog;this.dispatcher=dispatcher;this.clock=clock;}

    /// <summary>只能来自平台已验证租约；remainingMs 必须是 DB 返回 TTL 扣除往返时间，不信本地墙钟。</summary>
    public void RegisterOwnedRoom(string tenant,string registration,string roomId,string roomEpoch,string authorityEpoch,long remainingMs)
    {
        Guard.Id(tenant);Guard.Id(roomId);Guard.Id(roomEpoch);if(!Guard.Decimal(authorityEpoch)||remainingMs<=0||remainingMs>30000)throw new InvalidOperationException("InvalidLease");
        var engine=catalog.TickEngine(tenant,registration);
        lock(gate)
        {
            if(stopping)throw new InvalidOperationException("CoordinatorStopping");
            var existing=rooms.FirstOrDefault(r=>r.Tenant==tenant&&r.Id==roomId);
            if(existing!=null)throw new InvalidOperationException(existing.Busy?"RoomStillDraining":"RoomAlreadyRegistered");
            if(rooms.Count>=MaximumRooms||rooms.Count(r=>r.Tenant==tenant)>=MaximumTenantRooms)throw new InvalidOperationException("TenantRoomBudgetExceeded");
            rooms.Add(new Room{Tenant=tenant,RegistrationId=registration,Engine=engine,Id=roomId,Epoch=roomEpoch,Fence=authorityEpoch,LeaseDeadline=checked(clock.Milliseconds+remainingMs)});
        }
    }

    /// <summary>Managed已验证的DB租约观察提示。不是授权；下一步仍需主库同epoch核验，回滚也不会产生合法写。</summary>
    public void ObserveOwnedRoom(string tenant,string registration,string roomId,string roomEpoch,string authorityEpoch,long remainingMs)
    {
        Guard.Id(tenant);Guard.Id(roomId);Guard.Id(roomEpoch);
        if(!Guard.Decimal(authorityEpoch)||remainingMs<=0||remainingMs>30000)throw new InvalidOperationException("InvalidLease");
        catalog.TickEngine(tenant,registration);
        lock(gate)
        {
            if(stopping)throw new InvalidOperationException("CoordinatorStopping");
            var prior=rooms.FirstOrDefault(r=>r.Tenant==tenant&&r.Id==roomId);
            if(prior!=null)
            {
                // 排空期间的新提示不能取消正在提交的终局事务，也不能把已排空房间重新唤醒。
                if(prior.Removed&&prior.Busy)throw new InvalidOperationException("RoomStillDraining");
                if(prior.Removed||prior.RegistrationId!=registration||prior.Epoch!=roomEpoch||prior.Fence!=authorityEpoch)
                {
                    prior.Removed=true;prior.Cancel.Cancel();if(prior.Busy)throw new InvalidOperationException("RoomStillDraining");rooms.Remove(prior);prior.Cancel.Dispose();
                }
                else{prior.LeaseDeadline=checked(clock.Milliseconds+remainingMs);if(prior.Busy)prior.Cancel.CancelAfter((int)remainingMs);return;}
            }
            RegisterOwnedRoom(tenant,registration,roomId,roomEpoch,authorityEpoch,remainingMs);
        }
    }

    public void StopOwnedRoom(string tenant,string roomId,string roomEpoch,string authorityEpoch)
    {
        Room cancel=null;
        lock(gate)
        {
            var room=rooms.FirstOrDefault(r=>r.Tenant==tenant&&r.Id==roomId&&r.Epoch==roomEpoch&&r.Fence==authorityEpoch);
            if(room==null)return;room.Removed=true;
            if(room.Busy)cancel=room;else{rooms.Remove(room);room.Cancel.Dispose();}
        }
        // Cancel可同步执行dispatcher回调并重入Complete.finally；不要在持有集合锁时执行外部回调。
        if(cancel!=null)CancelOwned(cancel);
    }

    /// <summary>停止后续调度但允许在途 Managed 请求返回并提交；原租约截止和全局停机取消仍有效。</summary>
    public void DrainOwnedRoom(string tenant,string registration,string roomId,string roomEpoch,string authorityEpoch)
    {
        lock(gate)
        {
            var room=rooms.FirstOrDefault(r=>r.Tenant==tenant&&r.RegistrationId==registration&&r.Id==roomId&&r.Epoch==roomEpoch&&r.Fence==authorityEpoch);
            if(room==null)return;
            room.Removed=true;
            // 不能在引擎 return Code=1 之前取消该请求自己的 token；busy 的资源由 Complete finally 回收。
            if(!room.Busy){rooms.Remove(room);room.Cancel.Dispose();}
        }
    }

    /// <summary>无 payload 内存队列；持久 inbox 在 Managed 主库。单 room 至多一个执行，忙时 50ms 唤醒合并。</summary>
    public void Pulse()
    {
        lock(gate)
        {
            if(stopping)return;
            var count=rooms.Count;if(count==0)return;
            for(var examined=0;examined<count&&running<MaximumGlobalConcurrency;examined++)
            {
                if(cursor>=rooms.Count)cursor=0;var room=rooms[cursor++];
                if(room.Removed||room.Busy||activeTenants.Contains(room.Tenant))continue;
                if(clock.Milliseconds>=room.LeaseDeadline){room.Removed=true;room.Cancel.Cancel();continue;}
                room.Busy=true;running++;activeTenants.Add(room.Tenant);
                if(room.RequestId.Length==0)room.RequestId=Guid.NewGuid().ToString("N");
                // 占位 Task 在锁内发布，Stop 不会错过已获准但尚未真正执行的批次。
                var completion=new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);room.Work=completion.Task;
                room.Work=Complete(room,completion);
            }
            rooms.RemoveAll(r=>r.Removed&&!r.Busy);
        }
    }
    private async Task Complete(Room room,TaskCompletionSource<bool> completion)
    {
        // 强制在锁外执行真实 dispatcher；同步完成的实现也不会在注册临界区做数据库工作。
        await Task.Yield();
        try
        {
            var remaining=room.LeaseDeadline-clock.Milliseconds;if(remaining<=0)throw new OperationCanceledException();
            room.Cancel.CancelAfter((int)Math.Min(remaining,30000));
            var before=clock.Milliseconds;
            var result=await dispatcher.DispatchAsync(new TickDispatch{Tenant=room.Tenant,RegistrationId=room.RegistrationId,EngineKey=room.Engine,RoomId=room.Id,RoomEpoch=room.Epoch,AuthorityEpoch=room.Fence,RequestId=room.RequestId},room.Cancel.Token).ConfigureAwait(false);
            lock(gate)
            {
                // 过期或 Stop 之后的响应不能复活本地 authority；真正 DB 提交仍由外层事务最后校验。
                if(room.Removed||room.Cancel.IsCancellationRequested||clock.Milliseconds>=room.LeaseDeadline){room.Removed=true;return;}
                if(result.Status==DispatchStatus.StaleLease){room.Removed=true;return;}
                if(result.Status==DispatchStatus.Committed||result.Status==DispatchStatus.Idle)room.RequestId="";
                // Unknown 保留完全相同 RequestId；禁止生成新请求绕过未知提交。
                if(result.LeaseRemainingMs>0&&result.LeaseRemainingMs<=30000)
                {
                    var conservative=result.LeaseRemainingMs-(clock.Milliseconds-before);
                    if(conservative<=0){room.Removed=true;return;}
                    room.LeaseDeadline=checked(clock.Milliseconds+conservative);room.Cancel.CancelAfter((int)conservative);
                }
            }
        }
        catch(OperationCanceledException){lock(gate)room.Removed=true;}
        catch { /* 传输未知状态保留 RequestId；只可同键重试，不能视为无副作用失败。 */ }
        finally
        {
            lock(gate){room.Busy=false;running--;activeTenants.Remove(room.Tenant);if(stopping||room.Removed){room.Removed=true;rooms.Remove(room);room.Cancel.Dispose();}}
            completion.TrySetResult(true);
        }
    }

    public async Task RunAsync(CancellationToken stop)
    {
        try{while(!stop.IsCancellationRequested){Pulse();await Task.Delay(IntervalMilliseconds,stop).ConfigureAwait(false);}}
        catch(OperationCanceledException)when(stop.IsCancellationRequested){}
    }
    /// <summary>拒收新 room 后有界排空；超时取消在途，但不可把不可中断插件伪称已经停止。</summary>
    public async Task<bool> StopAsync(int graceMilliseconds)
    {
        if(graceMilliseconds<0||graceMilliseconds>5000)throw new ArgumentOutOfRangeException(nameof(graceMilliseconds));
        Task[] work;lock(gate){stopping=true;work=rooms.Where(r=>r.Busy).Select(r=>r.Work).ToArray();}
        var all=Task.WhenAll(work);var winner=await Task.WhenAny(all,Task.Delay(graceMilliseconds)).ConfigureAwait(false);
        Room[] cancel;
        lock(gate)
        {
            var snapshot=rooms.ToArray();
            // 必须先让全部房间不可再调度，再触发任何可能同步重入并摘除房间的取消回调。
            foreach(var room in snapshot)room.Removed=true;
            cancel=snapshot.Where(r=>r.Busy).ToArray();
            foreach(var room in snapshot)if(!room.Busy){rooms.Remove(room);room.Cancel.Dispose();}
        }
        foreach(var room in cancel)CancelOwned(room);
        return winner==all;
    }
    private static void CancelOwned(Room room)
    {
        try{room.Cancel.Cancel();}
        // 锁外取消与正常完成并发时，Complete.finally可能已摘除并释放该房间；它已停止，无需再次取消。
        catch(ObjectDisposedException){}
    }
    public bool IsDrained { get { lock(gate)return running==0; } }
}
}
