#nullable enable annotations
using System;
using System.Linq;
using System.Runtime.CompilerServices;

namespace Microi.FixedStep
{
/// <summary>可信校验器产生的有界依赖失败信息；不包含路径、配置、异常自由文本或任何授权状态。</summary>
internal sealed class DependencyHashWitness
{
    internal readonly string? Identity;
    internal readonly string? ExpectedSha256;
    internal readonly string? ActualSha256;
    internal readonly string Reason;
    internal DependencyHashWitness(string? identity,string? expected,string? actual,string reason)
    {
        Identity=string.IsNullOrEmpty(identity)||identity.Length>512||identity.Any(c=>char.IsControl(c)||c=='/'||c=='\\')?null:identity;
        ExpectedSha256=Hash(expected)?expected:null;
        ActualSha256=Hash(actual)?actual:null;
        Reason=reason;
    }
    private static bool Hash(string? value)=>value!=null&&value.Length==64&&value.All(c=>(c>='0'&&c<='9')||(c>='a'&&c<='f'));
}

/// <summary>仅记录当前节点的失败见证。弱引用避免后台每三十秒重试造成永久累积，记录不能授予原生执行权限。</summary>
internal static class DependencyHashDiagnostics
{
    private static readonly ConditionalWeakTable<Exception,DependencyHashWitness> Witnesses=new ConditionalWeakTable<Exception,DependencyHashWitness>();
    internal static InvalidOperationException Failure(string? identity,string? expected,string? actual,string reason)
    {
        // 保持原异常类型和机器码。见证不取 Exception.Data，调用方不能用任意异常伪造身份/hash。
        var error=new InvalidOperationException("DependencyHashMismatch");
        Witnesses.Add(error,new DependencyHashWitness(identity,expected,actual,reason));
        return error;
    }
    internal static DependencyHashWitness? Read(Exception? error)=>error!=null&&Witnesses.TryGetValue(error,out var witness)?witness:null;
}
}
