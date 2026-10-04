using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;

namespace Microi.FixedStep
{
/// <summary>后端安装服务回读的审批事实。不得将V8.Param/表单正文直接反序列化成该对象当授权。</summary>
public sealed class ApprovedInstallation
{
    public PackageApproval Package { get; set; }=null!;
    public string ApprovalId { get; set; }="";
    public string AdministratorId { get; set; }="";
    public string PublisherIdentity { get; set; }="";
    public string ImmutableSourceManifestSha256 { get; set; }="";
    public Dictionary<string,string> DependencyClosureSha256 { get; set; }=new Dictionary<string,string>(StringComparer.Ordinal);
}

/// <summary>平台发行/安装适配器独占实现，负责签名、管理员权限、租户已安装版本与撤销状态；不是公开CRUD能力。</summary>
public interface IApprovedRulesInstallationStore
{
    ApprovedInstallation ReadVerified(string tenant,string registrationId);
}

/// <summary>依赖闭包来自实际已装载程序集；每个程序集均需审批清单内hash，没有按System前缀放行的漏洞。</summary>
public static class InstallationVerifier
{
    public static PackageApproval Verify(IApprovedRulesInstallationStore store,string tenant,string registrationId,Type fixedEntryType)
    {
        Guard.Id(tenant);Guard.Id(registrationId);
        if(store==null||fixedEntryType==null||!typeof(IDeterministicRules).IsAssignableFrom(fixedEntryType))throw new InvalidOperationException("InvalidInstallation");
        var receipt=store.ReadVerified(tenant,registrationId);
        if(receipt==null||receipt.Package==null||receipt.Package.Tenant!=tenant||receipt.Package.RegistrationId!=registrationId||receipt.Package.EntryType!=fixedEntryType.FullName||receipt.Package.SourceReceipt!=receipt.ApprovalId||string.IsNullOrWhiteSpace(receipt.ApprovalId)||string.IsNullOrWhiteSpace(receipt.AdministratorId)||string.IsNullOrWhiteSpace(receipt.PublisherIdentity)||!IsHash(receipt.ImmutableSourceManifestSha256))throw new InvalidOperationException("UnapprovedInstallation");
        var all=AppDomain.CurrentDomain.GetAssemblies().Where(a=>!a.IsDynamic).ToArray();
        if(all.Length>512)throw new InvalidOperationException("AssemblyCatalogBudgetExceeded");
        var loaded=new Dictionary<string,Assembly>(StringComparer.Ordinal);
        foreach(var assembly in all)
        {
            var key=IdentityKey(assembly.GetName());
            // 同一强身份在多个LoadContext出现时不随枚举顺序择一；显式失败并要求宿主隔离部署。
            if(loaded.ContainsKey(key))throw new InvalidOperationException("AmbiguousLoadedAssembly");loaded.Add(key,assembly);
        }
        var pending=new Queue<Assembly>();var seen=new HashSet<string>(StringComparer.Ordinal);pending.Enqueue(fixedEntryType.Assembly);
        // 不主动Assembly.Load；缺失依赖表示部署组合没有完成，先拒绝而非按请求搜索磁盘/网络。
        while(pending.Count>0)
        {
            var assembly=pending.Dequeue();if(!seen.Add(assembly.FullName!))continue;
            if(string.IsNullOrEmpty(assembly.Location)||!receipt.DependencyClosureSha256.TryGetValue(assembly.FullName!,out var expected)||!IsHash(expected)||TrustedRulesCatalog.Hash(File.ReadAllBytes(assembly.Location))!=expected)throw new InvalidOperationException("DependencyHashMismatch");
            foreach(var name in assembly.GetReferencedAssemblies())
            {
                // netstandard引用System.Runtime 4.x实际可绑定net10的10.x；验证实际载入身份+hash，不能把声明版本当文件身份。
                if(!loaded.TryGetValue(IdentityKey(name),out var dependency)||dependency.GetName().Version<name.Version)throw new InvalidOperationException("DependencyNotPreloaded");pending.Enqueue(dependency);
            }
        }
        if(TrustedRulesCatalog.Hash(File.ReadAllBytes(fixedEntryType.Assembly.Location))!=receipt.Package.AssemblySha256)throw new InvalidOperationException("PackageHashMismatch");
        return receipt.Package;
    }
    private static bool IsHash(string value)=>value!=null&&value.Length==64&&value.All(c=>(c>='0'&&c<='9')||(c>='a'&&c<='f'));
    private static string IdentityKey(AssemblyName name)=>name.Name+"|"+(name.CultureName??"")+"|"+BitConverter.ToString(name.GetPublicKeyToken()??Array.Empty<byte>());
}
}
