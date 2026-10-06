#nullable enable annotations
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;

namespace Microi.FixedStep
{
/// <summary>仅当前节点的安装观测。编译绑定来自可信DI；记录不授予权限，不触发工厂、主库查询或再次安装。</summary>
public sealed class FixedStepInstallationDiagnostics
{
    private sealed class Entry
    {
        internal CompiledRulesBinding Binding=null!;
        internal string? AssemblyFileSha256;
        internal bool Registered;
        internal int Attempts;
        internal DateTime? LastAttemptUtc;
        internal DateTime? LastRegisteredUtc;
        internal string? ErrorCode;
        internal DependencyHashWitness? DependencyFailure;
    }
    private static readonly HashSet<string> SafeErrors=new HashSet<string>(StringComparer.Ordinal)
    {
        "InstallationMissingOrAmbiguous","InstallationPrimaryUnavailable","InstallationDialectUnsupported",
        "DeploymentNotApproved","ApprovalReceiptMismatch","InstallationRevoked","InstallationVersionMismatch",
        "PublishedSourceMismatch","OfficialPublisherRequired","PublicationSnapshotMismatch","PublicationSnapshotInvalid",
        "PublicationPointerMismatch","PublicationSnapshotPointerMismatch","PublicationPackageMismatch",
        "UnapprovedInstallation","AssemblyCatalogBudgetExceeded","AmbiguousLoadedAssembly",
        "DependencyHashMismatch","DependencyNotPreloaded","PackageHashMismatch","RegistrationImmutable"
    };
    private readonly object gate=new object();
    private readonly Dictionary<string,Entry> entries=new Dictionary<string,Entry>(StringComparer.Ordinal);
    private readonly string? apiAssemblyFileSha256;
    private readonly DateTime initializedAtUtc=DateTime.UtcNow;

    public FixedStepInstallationDiagnostics(CompiledRulesDeployments deployments)
    {
        if(deployments==null)throw new ArgumentNullException(nameof(deployments));
        apiAssemblyFileSha256=FileHash(Assembly.GetEntryAssembly());
        foreach(var binding in deployments.Snapshot())
            entries.Add(Key(binding.Tenant,binding.RegistrationId),new Entry{Binding=binding,AssemblyFileSha256=FileHash(binding.EntryType.Assembly)});
    }
    // 文件hash只在可信启动组合初始化时读取；不可用时留空，不使纯诊断阻止平台启动。
    private static string? FileHash(Assembly? assembly)
    {
        try
        {
            if(assembly==null||string.IsNullOrEmpty(assembly.Location))return null;
            using(var stream=File.OpenRead(assembly.Location))
            using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
        }
        catch{return null;}
    }
    private static string Key(string tenant,string registration)=>tenant+"\n"+registration;

    /// <summary>仅由安装后台服务记录已经结束的一次尝试；自由文本异常、SQL、路径、配置与Token均不进入快照。</summary>
    public void RecordAttempt(CompiledRulesBinding binding,Exception? error=null)
    {
        if(binding==null)throw new ArgumentNullException(nameof(binding));
        lock(gate)
        {
            if(!entries.TryGetValue(Key(binding.Tenant,binding.RegistrationId),out var entry)||!ReferenceEquals(entry.Binding,binding))
                throw new InvalidOperationException("DiagnosticBindingUnknown");
            entry.Attempts=Math.Min(entry.Attempts, int.MaxValue-1)+1;
            entry.LastAttemptUtc=DateTime.UtcNow;
            entry.Registered=error==null;
            entry.ErrorCode=error==null?null:error is InvalidOperationException&&SafeErrors.Contains(error.Message)?error.Message:"RegistrationFailed";
            // 只消费校验器弱引用中的见证，不读取错误的Data/Message中的路径或用户可拼装的元数据。
            entry.DependencyFailure=DependencyHashDiagnostics.Read(error);
            if(error==null)entry.LastRegisteredUtc=entry.LastAttemptUtc;
        }
    }

    /// <summary>调用方必须先通过现有可观测性管理员鉴权；只返回当前可信租户，不能用注册成功缓存代替当前审批。</summary>
    public FixedStepInstallationSnapshot Snapshot(string tenant)
    {
        lock(gate)
        {
            var rows=entries.Values.Where(e=>string.Equals(e.Binding.Tenant,tenant,StringComparison.Ordinal))
                .OrderBy(e=>e.Binding.RegistrationId,StringComparer.Ordinal)
                .Select(e=>new FixedStepRegistrationSnapshot
                {
                    RegistrationId=e.Binding.RegistrationId,EntryType=e.Binding.EntryType.FullName??"",
                    ApprovalDigest=e.Binding.ApprovalDigest,AssemblyFileSha256=e.AssemblyFileSha256,
                    State=e.Registered?"CatalogRegistered":e.Attempts==0?"Pending":"RegistrationFailed",
                    Attempts=e.Attempts,LastAttemptUtc=e.LastAttemptUtc,LastRegisteredUtc=e.LastRegisteredUtc,ErrorCode=e.ErrorCode,
                    DependencyIdentity=e.DependencyFailure?.Identity,DependencyExpectedSha256=e.DependencyFailure?.ExpectedSha256,
                    DependencyActualSha256=e.DependencyFailure?.ActualSha256,DependencyFailureReason=e.DependencyFailure?.Reason
                }).ToArray();
            return new FixedStepInstallationSnapshot{Available=true,InitializedAtUtc=initializedAtUtc,ApiAssemblyFileSha256=apiAssemblyFileSha256,Registrations=rows};
        }
    }
}

/// <summary>这些字段仅是节点诊断，不表示授权、健康、匹配或多节点验收已经通过。</summary>
public sealed class FixedStepInstallationSnapshot
{
    public string Protocol {get;}="fixed-step-installation/v1";
    public bool CurrentNodeOnly {get;}=true;
    public bool AuthorizationProof {get;}=false;
    public bool Available {get;set;}
    public DateTime? InitializedAtUtc {get;set;}
    public string? ApiAssemblyFileSha256 {get;set;}
    public FixedStepRegistrationSnapshot[] Registrations {get;set;}=Array.Empty<FixedStepRegistrationSnapshot>();
}
public sealed class FixedStepRegistrationSnapshot
{
    public string RegistrationId {get;set;}="";
    public string EntryType {get;set;}="";
    public string ApprovalDigest {get;set;}="";
    public string? AssemblyFileSha256 {get;set;}
    public string State {get;set;}="Pending";
    public int Attempts {get;set;}
    public DateTime? LastAttemptUtc {get;set;}
    public DateTime? LastRegisteredUtc {get;set;}
    public string? ErrorCode {get;set;}
    /// <summary>仅真实Verifier失败时提供；管理员诊断字段不代表审批通过，且不返回文件路径。</summary>
    public string? DependencyIdentity {get;set;}
    public string? DependencyExpectedSha256 {get;set;}
    public string? DependencyActualSha256 {get;set;}
    public string? DependencyFailureReason {get;set;}
}
}
