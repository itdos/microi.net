#nullable enable annotations
using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace Microi.FixedStep
{

/// <summary>只由宿主部署注册调用。没有 LoadFrom/反射类型查找/V8 注册方法，不支持请求指定可执行文件。</summary>
public sealed class TrustedRulesCatalog
{
    private sealed class Entry { internal PackageApproval Approval=null!;internal Func<IDeterministicRules> Factory=null!;internal System.Reflection.Assembly Assembly=null!;internal Action? Revalidate; }
    private readonly Dictionary<string,Entry> entries=new Dictionary<string,Entry>(StringComparer.Ordinal);
    private readonly object gate=new object();
    public void RegisterInstalled(IApprovedRulesInstallationStore installations,string tenant,string registrationId,Type fixedEntryType,Func<IDeterministicRules> fixedFactory)
    {
        // 在首次实例化规则构造器之前完成来源、tenant、入口与全部已装载依赖hash校验。
        var approval=InstallationVerifier.Verify(installations,tenant,registrationId,fixedEntryType);
        RegisterApproved(approval,fixedFactory,()=>
        {
            // 撤销与卸载走共享主库，不能让进程内已注册目录永久保留权限。
            var fresh=installations.ReadVerified(tenant,registrationId).Package;
            if(fresh.SourceReceipt!=approval.SourceReceipt||fresh.AssemblySha256!=approval.AssemblySha256||fresh.EntryType!=approval.EntryType||fresh.TickEngineKey!=approval.TickEngineKey||fresh.ProjectionEngineKey!=approval.ProjectionEngineKey||fresh.RulesVersion!=approval.RulesVersion||fresh.LayoutId!=approval.LayoutId)throw new InvalidOperationException("InstallationChanged");
        });
    }
    internal void RegisterApproved(PackageApproval approval,Func<IDeterministicRules> fixedFactory,Action? revalidate=null)
    {
        if(approval==null||fixedFactory==null)throw new ArgumentNullException();
        Guard.Id(approval.Tenant);Guard.Id(approval.RegistrationId);Guard.Id(approval.PackageKey);Guard.Id(approval.TickEngineKey);Guard.Id(approval.ProjectionEngineKey);
        if(string.IsNullOrWhiteSpace(approval.SourceReceipt)||string.IsNullOrWhiteSpace(approval.RulesVersion)||string.IsNullOrWhiteSpace(approval.LayoutId)||approval.AssemblySha256.Length!=64)throw new InvalidOperationException("UnapprovedPackage");
        // factory 来自部署组合代码，不从 URL/Type 字符串动态构造；读取实际已经装载的应用程序集验证内容。
        var instance=fixedFactory()??throw new InvalidOperationException("InvalidFactory");
        var type=instance.GetType();var location=type.Assembly.Location;
        if(type.FullName!=approval.EntryType||string.IsNullOrEmpty(location)||Hash(File.ReadAllBytes(location))!=approval.AssemblySha256)throw new InvalidOperationException("PackageHashMismatch");
        var copy=new PackageApproval{RegistrationId=approval.RegistrationId,Tenant=approval.Tenant,PackageKey=approval.PackageKey,SourceReceipt=approval.SourceReceipt,AssemblySha256=approval.AssemblySha256,EntryType=approval.EntryType,TickEngineKey=approval.TickEngineKey,ProjectionEngineKey=approval.ProjectionEngineKey,RulesVersion=approval.RulesVersion,LayoutId=approval.LayoutId};
        lock(gate){var key=Key(copy.Tenant,copy.RegistrationId);if(entries.ContainsKey(key))throw new InvalidOperationException("RegistrationImmutable");entries.Add(key,new Entry{Approval=copy,Factory=fixedFactory,Assembly=type.Assembly,Revalidate=revalidate});}
    }
    internal IDeterministicRules Create(InvocationContext context,string id,bool projection,string rulesVersion,string layout)
    {
        Entry entry;lock(gate){if(!entries.TryGetValue(Key(context.Tenant,id),out entry!))throw new InvalidOperationException("RegistrationNotFound");}
        entry.Revalidate?.Invoke();
        if(context.EngineKey!=(projection?entry.Approval.ProjectionEngineKey:entry.Approval.TickEngineKey))throw new InvalidOperationException("UntrustedEngine");
        if(entry.Approval.RulesVersion!=rulesVersion||entry.Approval.LayoutId!=layout)throw new InvalidOperationException("RulesMismatch");
        var rules=entry.Factory();if(rules==null||rules.GetType().FullName!=entry.Approval.EntryType||rules.GetType().Assembly!=entry.Assembly)throw new InvalidOperationException("InvalidFactory");return rules;
    }
    public string TickEngine(string tenant,string registrationId){Entry entry;lock(gate){if(!entries.TryGetValue(Key(tenant,registrationId),out entry!))throw new InvalidOperationException("RegistrationNotFound");}entry.Revalidate?.Invoke();return entry.Approval.TickEngineKey;}
    public string[] AllowedEngineKeys(string tenant,string registrationId){Entry entry;lock(gate){if(!entries.TryGetValue(Key(tenant,registrationId),out entry!))return Array.Empty<string>();}entry.Revalidate?.Invoke();return new[]{entry.Approval.TickEngineKey,entry.Approval.ProjectionEngineKey};}
    public bool Contains(string tenant,string registrationId){lock(gate)return entries.ContainsKey(Key(tenant,registrationId));}
    internal string[] RegisteredEngineKeys(string tenant,string registrationId){lock(gate){if(!entries.TryGetValue(Key(tenant,registrationId),out var e))return Array.Empty<string>();return new[]{e.Approval.TickEngineKey,e.Approval.ProjectionEngineKey};}}
    private static string Key(string tenant,string id)=>tenant+"\n"+id;
    internal static string Hash(string value)=>Hash(Encoding.UTF8.GetBytes(value));
    internal static string Hash(byte[] value){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(value)).Replace("-","").ToLowerInvariant();}
}
}
