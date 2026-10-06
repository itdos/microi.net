using System;
using System.Collections.Generic;
using System.Linq;

namespace Microi.FixedStep
{
/// <summary>只由API的后端编译组合注入DI；不是V8服务，不按字符串/目录扫描并装载代码。</summary>
public interface ITrustedRulesRegistrar
{
    IEnumerable<CompiledRulesBinding> Registrations { get; }
}

/// <summary>来源证明类别只由后端编译组合固定；不读取请求参数或审批表中的自由文本。</summary>
public enum RulesInstallationProofKind { TenantInstallation = 0, OfficialPublishedSnapshot = 1 }

/// <summary>不可变后端部署回执。审批表只能撤销，不能把未编译审批的新入口变成可执行代码。</summary>
public sealed class CompiledRulesBinding
{
    public string Tenant { get; }
    public string RegistrationId { get; }
    public string ApprovalDigest { get; }
    public Type EntryType { get; }
    public RulesInstallationProofKind ProofKind { get; }
    public string PublicationSnapshotSha256 { get; }
    public Func<IDeterministicRules> Factory { get; }
    public CompiledRulesBinding(string tenant,string registrationId,string approvalDigest,Type entryType,Func<IDeterministicRules> factory,RulesInstallationProofKind proofKind=RulesInstallationProofKind.TenantInstallation,string publicationSnapshotSha256="")
    {
        Tenant=Guard.Id(tenant);RegistrationId=Guard.Id(registrationId);
        if(approvalDigest==null||approvalDigest.Length!=64||approvalDigest.Any(c=>!((c>='0'&&c<='9')||(c>='a'&&c<='f')))||entryType==null||factory==null||!typeof(IDeterministicRules).IsAssignableFrom(entryType))throw new InvalidOperationException("InvalidDeploymentBinding");
        if(!Enum.IsDefined(typeof(RulesInstallationProofKind),proofKind))throw new InvalidOperationException("InvalidProofKind");
        if(proofKind==RulesInstallationProofKind.OfficialPublishedSnapshot
            ? publicationSnapshotSha256==null||publicationSnapshotSha256.Length!=64||publicationSnapshotSha256.Any(c=>!((c>='0'&&c<='9')||(c>='a'&&c<='f')))
            : !string.IsNullOrEmpty(publicationSnapshotSha256))throw new InvalidOperationException("InvalidPublicationSnapshotHash");
        ApprovalDigest=approvalDigest;EntryType=entryType;Factory=factory;ProofKind=proofKind;PublicationSnapshotSha256=publicationSnapshotSha256;
    }
}

/// <summary>最多64个固定部署绑定；重复tenant+registration失败，不依赖DI枚举顺序挑选。</summary>
public sealed class CompiledRulesDeployments
{
    private readonly Dictionary<string,CompiledRulesBinding> bindings=new Dictionary<string,CompiledRulesBinding>(StringComparer.Ordinal);
    public CompiledRulesDeployments(IEnumerable<ITrustedRulesRegistrar> registrars)
    {
        foreach(var registrar in registrars)
        foreach(var value in registrar.Registrations)
        {
            if(value==null||bindings.Count>=64||bindings.ContainsKey(Key(value.Tenant,value.RegistrationId)))throw new InvalidOperationException("DeploymentCatalogInvalid");
            bindings.Add(Key(value.Tenant,value.RegistrationId),value);
        }
    }
    public CompiledRulesBinding Require(string tenant,string registrationId)
    {if(!bindings.TryGetValue(Key(tenant,registrationId),out var result))throw new InvalidOperationException("DeploymentNotApproved");return result;}
    public CompiledRulesBinding[] Snapshot()=>bindings.Values.ToArray();
    private static string Key(string tenant,string registrationId)=>tenant+"\n"+registrationId;
}
}
