using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microi.FixedStep;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
/// <summary>公开的固定临时错误码；不包括授权、程序集来源、业务规则或任意异常文本。</summary>
public enum FixedStepTransientErrorCode
{
    KernelBusy,HostMemoryPressure,RoomStillDraining,CoordinatorStopping,StaleLease,ComputeBudgetExceeded
}

/// <summary>通用平台桥候选。参数仅为已授权引擎的计算数据；租户/真实引擎/NodeId不从Param读取。</summary>
public sealed class FixedStepPlatformRuntime : IPlatformApiRuntime
{
    private readonly FixedStepRuntimeHost host;
    public FixedStepPlatformRuntime(FixedStepRuntimeHost host){this.host=host;}
    public Task<object> ExecuteAsync(string action,JObject parameters)
    {
        var current=V8TenantContext.Current;
        if(current==null)throw new InvalidOperationException("MissingTrustedContext");
        var context=new InvocationContext(current.OsClient,current.ApiEngineKey);
        var registration=(string)parameters["RegistrationId"]??"";
        try
        {
        // 包括主库授权回读在内的所有入口先获同一预算，不能用Describe/Observe绕过并发限制。
        using(host.Admission.TryEnter(context.Tenant))
        {
        if(!host.Catalog.AllowedEngineKeys(context.Tenant,registration).Contains(context.EngineKey,StringComparer.Ordinal))throw new InvalidOperationException("UntrustedEngine");
        object data;
        switch(action)
        {
            case "DescribeInvocation":
                data=host.Identity.DescribeInvocation(context,registration);break;
            case "CreateInitialState":
                data=host.Kernel.CreateInitialState(context,registration,(string)parameters["RulesVersion"],(string)parameters["LayoutId"],(string)parameters["TrustedSetupJson"]);break;
            case "AdvanceBatch":
                data=host.Kernel.AdvanceBatch(context,parameters.ToObject<AdvanceEnvelope>(),CancellationToken.None);break;
            case "Project":
                data=new {Schema=1,ProjectionJson=host.Kernel.Project(context,registration,(string)parameters["RulesVersion"],(string)parameters["LayoutId"],(string)parameters["StateJson"],(int)parameters["BoundSeatId"],(long?)parameters["AfterEventSequence"]??0)};break;
            case "ObserveOwnedRoom":
                var identity=host.Identity.DescribeInvocation(context,registration);
                if((string)parameters["OwnerNodeId"]!=identity.NodeId)throw new InvalidOperationException("WrongOwnerNode");
                host.Coordinator.ObserveOwnedRoom(context.Tenant,registration,(string)parameters["RoomId"],(string)parameters["RoomEpoch"],(string)parameters["AuthorityEpoch"],(long)parameters["LeaseRemainingMs"]);data=new {Observed=true};break;
            case "StopOwnedRoom":
                host.Identity.DescribeInvocation(context,registration);
                host.Coordinator.StopOwnedRoom(context.Tenant,(string)parameters["RoomId"],(string)parameters["RoomEpoch"],(string)parameters["AuthorityEpoch"]);data=new {Stopped=true};break;
            case "DrainOwnedRoom":
                host.Identity.DescribeInvocation(context,registration);
                host.Coordinator.DrainOwnedRoom(context.Tenant,registration,(string)parameters["RoomId"],(string)parameters["RoomEpoch"],(string)parameters["AuthorityEpoch"]);data=new {Drained=true};break;
            default:throw new InvalidOperationException("UnsupportedFixedStepAction");
        }
        return Task.FromResult<object>(new DosResult(1,data));
        }
        }
        catch(InvalidOperationException error)when(TryTransientCode(error.Message,out var code))
        {
            // 外层V8可信原子会隐藏未知异常；只有这些通用、非敏感的固定码可供Managed显式回滚和同键重试。
            return Task.FromResult<object>(new DosResult(0,null,"固定步运行时暂不可用。"){DataAppend=new {ErrorCode=code.ToString(),Retryable=true}});
        }
    }
    private static bool TryTransientCode(string message,out FixedStepTransientErrorCode code)
    {
        switch(message)
        {
            case "KernelBusy":code=FixedStepTransientErrorCode.KernelBusy;return true;
            case "HostMemoryPressure":code=FixedStepTransientErrorCode.HostMemoryPressure;return true;
            case "RoomStillDraining":code=FixedStepTransientErrorCode.RoomStillDraining;return true;
            case "CoordinatorStopping":code=FixedStepTransientErrorCode.CoordinatorStopping;return true;
            case "StaleLease":code=FixedStepTransientErrorCode.StaleLease;return true;
            case "ComputeBudgetExceeded":code=FixedStepTransientErrorCode.ComputeBudgetExceeded;return true;
            default:code=default;return false;
        }
    }
}

/// <summary>由DI/可信启动组合一次安装。不存在可从V8执行的注册函数或参数指定factory。</summary>
public sealed class FixedStepRuntimeHost
{
    public const string RuntimeKey="fixed-step-simulation";
    private static FixedStepRuntimeHost current;
    public TrustedRulesCatalog Catalog { get; }
    public FixedStepKernel Kernel { get; }
    public HostInvocationIdentity Identity { get; }
    public BoundedTickCoordinator Coordinator { get; }
    public ComputeAdmission Admission { get; }
    public FixedStepRuntimeHost(TrustedRulesCatalog catalog,FixedStepKernel kernel,HostInvocationIdentity identity,BoundedTickCoordinator coordinator,ComputeAdmission admission)
    {Catalog=catalog;Kernel=kernel;Identity=identity;Coordinator=coordinator;Admission=admission;}
    public static void Install(FixedStepRuntimeHost host)
    {
        if(host==null||Interlocked.CompareExchange(ref current,host,null)!=null)throw new InvalidOperationException("FixedStepAlreadyInstalled");
        PlatformApiRuntimeRegistry.RegisterFactory(RuntimeKey,()=>new FixedStepPlatformRuntime(host));
    }
    public static string[] GetApprovedEngineKeys(string tenant,string registrationId)=>current==null||string.IsNullOrEmpty(tenant)?Array.Empty<string>():current.Catalog.RegisteredEngineKeys(tenant,registrationId);
}
}
