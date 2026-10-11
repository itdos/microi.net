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
            return InterpretResult(result,request);
        }
    }

    /// <summary>保留原提交与未知语义；诊断只记录固定类别，绝不返回 Msg、DataAppend 或请求内容。</summary>
    internal static TickDispatchResult InterpretResult(JObject result,TickDispatch request)
    {
            int parsedCode;
            int? resultCode=result!=null&&int.TryParse((string)result["Code"],out parsedCode)?parsedCode:(int?)null;
            if(result==null||resultCode!=1)
            {
                var message=result?["Msg"]?.Type==JTokenType.String?(string)result["Msg"]:"";
                var code=resultCode==1001?"LoginRequired":resultCode==1002?"AuthenticationDenied":TickDispatchDiagnosticCodes.Safe(message);
                if(message=="StalePumpBinding"||message=="StaleLease"||message=="RoomUnavailable"||message=="MultiplayerNotConfigured")return new TickDispatchResult{Status=DispatchStatus.StaleLease,DiagnosticCode=code,ResultCode=resultCode};
                return new TickDispatchResult{Status=DispatchStatus.Unknown,DiagnosticCode=result==null?"EmptyManagedResponse":code,ResultCode=resultCode};
            }
            var data=result["Data"] as JObject;
            if(data==null)return new TickDispatchResult{Status=DispatchStatus.Unknown,DiagnosticCode="MalformedManagedResponse",ResultCode=resultCode};
            if((string)data["Status"]=="StaleLease")return new TickDispatchResult{Status=DispatchStatus.StaleLease,DiagnosticCode="StaleLease",ResultCode=resultCode};
            if((bool?)data["Committed"]!=true||(string)data["RequestId"]!=request.RequestId||(string)data["RoomEpoch"]!=request.RoomEpoch)return new TickDispatchResult{Status=DispatchStatus.Unknown,DiagnosticCode="ReceiptMismatch",ResultCode=resultCode};
            var ttl=(long?)data["LeaseRemainingMs"]??0;
            return new TickDispatchResult{Status=ttl>0?DispatchStatus.Committed:DispatchStatus.StaleLease,LeaseRemainingMs=ttl,DiagnosticCode=ttl>0?"":"StaleLease",ResultCode=resultCode};
    }
}
}
