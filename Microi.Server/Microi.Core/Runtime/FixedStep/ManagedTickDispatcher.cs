using System;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microi.FixedStep;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
/// <summary>后台固定Managed调用，不伪造DiyToken/用户。后台scope绑定该房与fence，客户端不能制造。</summary>
public sealed class ManagedTickDispatcher : IManagedTickDispatcher
{
    private readonly HostInvocationIdentity identity;
    public ManagedTickDispatcher(HostInvocationIdentity identity){this.identity=identity;}
    public async Task<TickDispatchResult> DispatchAsync(TickDispatch request,CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        using(identity.EnterPump(request))
        using(V8TrustedExecutionContext.EnterManagedProtocol(request.EngineKey,request.Tenant))
        {
            // 只传固定action和房间标识。身份、owner和时钟均不进入Param；真实引擎从原子scope读取。
            var parameters=new JObject { ["OsClient"]=request.Tenant,["_InvokeType"]="Client",["Action"]="Advance",["RoomId"]=request.RoomId,["RequestId"]=request.RequestId };
            var raw=await MicroiEngine.ManagedCompatibilityApiEngine.RunManagedCompatibilityAsync(request.EngineKey,parameters,null,null,cancellationToken).ConfigureAwait(false);
            var result=JsonHelper.ToJObject((object)raw);
            if(result==null||(int?)result["Code"]!=1)
            {
                var code=(string)result?["Msg"];
                if(code=="StalePumpBinding"||code=="StaleLease"||code=="RoomUnavailable"||code=="MultiplayerNotConfigured")return new TickDispatchResult{Status=DispatchStatus.StaleLease};
                return new TickDispatchResult{Status=DispatchStatus.Unknown};
            }
            var data=result["Data"] as JObject;
            if(data==null)return new TickDispatchResult{Status=DispatchStatus.Unknown};
            if((string)data["Status"]=="StaleLease")return new TickDispatchResult{Status=DispatchStatus.StaleLease};
            if((bool?)data["Committed"]!=true||(string)data["RequestId"]!=request.RequestId||(string)data["RoomEpoch"]!=request.RoomEpoch)return new TickDispatchResult{Status=DispatchStatus.Unknown};
            var ttl=(long?)data["LeaseRemainingMs"]??0;
            return new TickDispatchResult{Status=ttl>0?DispatchStatus.Committed:DispatchStatus.StaleLease,LeaseRemainingMs=ttl};
        }
    }
}
}
