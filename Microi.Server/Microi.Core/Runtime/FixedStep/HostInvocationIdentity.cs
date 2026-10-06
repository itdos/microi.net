#nullable enable annotations
using System;
using System.Threading;

namespace Microi.FixedStep
{
public sealed class HostInvocationDescription
{
    public string NodeId { get; set; }="";
    public string RegistrationId { get; set; }="";
    public bool TrustedPump { get; set; }
    public string RoomId { get; set; }="";
    public string RoomEpoch { get; set; }="";
    public string AuthorityEpoch { get; set; }="";
    public string RequestId { get; set; }="";
}

/// <summary>进程身份不来自请求/配置。后台调用 scope 是 C# 内部能力，不能在 Jint 或 HTTP 创建。</summary>
public sealed class HostInvocationIdentity
{
    private readonly string nodeId="microi-"+Guid.NewGuid().ToString("N");
    private sealed class PumpScope { internal TickDispatch Request=null!;internal int Active=1; }
    private readonly AsyncLocal<PumpScope?> invocation=new AsyncLocal<PumpScope?>();
    private readonly TrustedRulesCatalog catalog;
    public HostInvocationIdentity(TrustedRulesCatalog catalog){this.catalog=catalog;}
    public HostInvocationDescription DescribeInvocation(InvocationContext context,string registrationId)
    {
        if(catalog.TickEngine(context.Tenant,registrationId)!=context.EngineKey)throw new InvalidOperationException("UntrustedEngine");
        var scope=invocation.Value;var active=scope?.Request;var isPump=scope!=null&&Volatile.Read(ref scope.Active)==1&&active!=null&&active.Tenant==context.Tenant&&active.RegistrationId==registrationId&&active.EngineKey==context.EngineKey;
        return new HostInvocationDescription{NodeId=nodeId,RegistrationId=registrationId,TrustedPump=isPump,RoomId=isPump?active!.RoomId:"",RoomEpoch=isPump?active!.RoomEpoch:"",AuthorityEpoch=isPump?active!.AuthorityEpoch:"",RequestId=isPump?active!.RequestId:""};
    }
    internal IDisposable EnterPump(TickDispatch request)
    {
        var previous=invocation.Value;
        // 复制请求，dispatcher 后续修改引用不能改变该次受信身份。
        var scope=new PumpScope{Request=new TickDispatch{Tenant=request.Tenant,RegistrationId=request.RegistrationId,EngineKey=request.EngineKey,RoomId=request.RoomId,RoomEpoch=request.RoomEpoch,AuthorityEpoch=request.AuthorityEpoch,RequestId=request.RequestId}};
        invocation.Value=scope;
        // AsyncLocal会传播给异步子任务；共享Active撤销位阻止父调用结束后继承旧scope继续冒充pump。
        return new RestoreScope(()=>{Interlocked.Exchange(ref scope.Active,0);invocation.Value=previous;});
    }
    private sealed class RestoreScope : IDisposable
    {
        private Action? action;
        internal RestoreScope(Action action){this.action=action;}
        public void Dispose(){Interlocked.Exchange(ref action,null)?.Invoke();}
    }
}
}
