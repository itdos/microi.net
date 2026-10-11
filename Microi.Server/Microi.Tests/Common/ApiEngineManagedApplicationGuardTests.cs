using System.Reflection;
using System.Runtime.Loader;
using Dos.Common;
using Microi.net;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>原样执行生产 AI 应用守卫与可信协议作用域；不在夹具中复制授权算法。</summary>
public sealed class ApiEngineManagedApplicationGuardTests
{
    private const string WriteCode = "V8.Db.FromSql('UPDATE app_counter SET Value=1').ExecuteNonQuery();";
    private static readonly Lazy<Type> Probe = new(CompileProductionGuard);

    [Fact]
    public void Trusted_exact_managed_application_write_does_not_require_a_fake_user()
    {
        using var scope = Enter("app_counter_tick", "tenant");
        var result = Check("app_counter_tick", "tenant", new JObject(), WriteCode);
        Assert.Equal(1, result.Code);
        var data = Assert.IsType<JObject>(result.Data);
        Assert.Null(data["ActorKey"]);
        Assert.Null(data["UserId"]);
        Assert.Null(data["_CurrentUser"]);
    }

    [Fact]
    public void Trusted_read_does_not_inject_an_anonymous_player_into_host_parameters()
    {
        using var scope = Enter("app_counter_projection", "tenant");
        var result = Check("app_counter_projection", "tenant", new JObject(), "return 1;");
        Assert.Equal(1, result.Code);
        Assert.Null(Assert.IsType<JObject>(result.Data)["ActorKey"]);
    }

    [Theory]
    [InlineData("app_other_tick", "tenant")]
    [InlineData("app_counter_tick", "other")]
    public void Protocol_for_another_engine_or_tenant_does_not_allow_userless_writes(string key, string tenant)
    {
        using var scope = Enter("app_counter_tick", "tenant");
        Assert.Equal(1001, Check(key, tenant, new JObject(), WriteCode).Code);
    }

    [Fact]
    public void Consumed_protocol_cannot_authorize_another_application_write()
    {
        using var scope = Enter("app_counter_tick", "tenant");
        Assert.True((bool)Probe.Value.GetMethod("Consume")!.Invoke(null, new object[] { "app_counter_tick", "tenant" })!);
        Assert.Equal(1001, Check("app_counter_tick", "tenant", new JObject(), WriteCode).Code);
    }

    [Fact]
    public void Disposed_scope_cannot_authorize_later_requests()
    {
        using (Enter("app_counter_tick", "tenant")) { }
        Assert.Equal(1001, Check("app_counter_tick", "tenant", new JObject(), WriteCode).Code);
    }

    [Fact]
    public void Parameter_protocol_markers_do_not_create_a_trusted_scope()
    {
        var request = new JObject { ["TrustedPump"] = true, ["TrustedManagedProtocol"] = true, ["_ManagedProtocol"] = true };
        Assert.Equal(1001, Check("app_counter_tick", "tenant", request, WriteCode).Code);
    }

    [Fact]
    public void Ordinary_authenticated_application_write_keeps_its_player_identity()
    {
        var request = new JObject { ["_CurrentUser"] = new JObject { ["Id"] = "ordinary", ["Name"] = "Player", ["Level"] = 0 } };
        var result = Check("app_counter_save", "tenant", request, WriteCode);
        Assert.Equal(1, result.Code);
        Assert.Equal("ordinary", Assert.IsType<JObject>(result.Data)["ActorKey"]?.Value<string>());
        Assert.Null(request["ActorKey"]);
    }

    [Fact]
    public void Explicit_anonymous_scoped_form_write_retains_existing_policy()
    {
        var result = Check("app_counter_save", "tenant", new JObject(), "V8.FormEngine.AddFormData('app_counter',{Value:1});", true);
        Assert.Equal(1, result.Code);
        Assert.StartsWith("anon_", Assert.IsType<JObject>(result.Data)["ActorKey"]?.Value<string>());
    }

    [Theory]
    [InlineData("V8.Db.FromSql('UPDATE app_counter SET Value=1').ExecuteNonQuery();")]
    [InlineData("V8.FormEngine.AddFormData(table,{Value:1});")]
    public void Anonymous_unsafe_or_dynamic_writes_still_fail_closed(string code)
        => Assert.Equal(1001, Check("app_counter_save", "tenant", new JObject(), code, true).Code);

    [Fact]
    public void Ordinary_read_keeps_its_anonymous_projection()
    {
        var result = Check("app_counter_projection", "tenant", new JObject(), "return 1;");
        Assert.Equal(1, result.Code);
        Assert.StartsWith("anon_", Assert.IsType<JObject>(result.Data)["ActorKey"]?.Value<string>());
    }

    private static IDisposable Enter(string key, string tenant)
        => (IDisposable)Probe.Value.GetMethod("Enter")!.Invoke(null, new object[] { key, tenant })!;
    private static DosResult Check(string key, string tenant, JObject request, string code, bool anonymous = false)
        => (DosResult)Probe.Value.GetMethod("Check")!.Invoke(null, new object[] { key, tenant, request, code, anonymous })!;

    private static Type CompileProductionGuard()
    {
        var root = FindRoot();
        var syntax = CSharpSyntaxTree.ParseText(File.ReadAllText(Path.Combine(root, "Microi.Server/Microi.net/ApiEngine/ApiEngine.cs"))).GetRoot();
        var runtime = syntax.DescendantNodes().OfType<MethodDeclarationSyntax>().Single(m => m.Identifier.Text == "RunInternalAsync");
        var guard = runtime.Body!.Statements.OfType<IfStatementSyntax>()
            .Single(s => s.Condition.ToString().Contains("IsAiApplicationEngineKey(param.ApiEngineKey)", StringComparison.Ordinal));
        var fields = syntax.DescendantNodes().OfType<FieldDeclarationSyntax>()
            .Where(f => f.Declaration.Variables.Any(v => v.Identifier.Text.StartsWith("AiApplication", StringComparison.Ordinal)));
        var helperNames = new[] { "IsAiApplicationEngineKey", "IsAiApplicationWriteCode", "IsAnonymousAiApplicationWriteAllowed", "IsAiApplicationReadEngineKey", "IsAiApplicationReadRequest", "BuildAnonymousAiApplicationScope", "ApplyAiApplicationIdentity" };
        var helpers = syntax.DescendantNodes().OfType<MethodDeclarationSyntax>().Where(m => helperNames.Contains(m.Identifier.Text));
        // 参数输入仅作为已完成身份校验后的投影；真正协议授权来自同程序集内的生产 AsyncLocal，不能用 bool 替代。
        var source = """
            using System; using System.Linq; using System.Text; using System.Security.Cryptography;
            using System.Text.RegularExpressions; using Dos.Common; using Microi.net; using Newtonsoft.Json.Linq;
            public static class ManagedApplicationGuardProbe {
                public static IDisposable Enter(string key,string tenant) => V8TrustedExecutionContext.EnterManagedProtocol(key,tenant);
                public static bool Consume(string key,string tenant) => V8TrustedExecutionContext.TryConsumeManagedProtocol(key,tenant);
                public static DosResult Check(string key,string tenant,JObject request,string code,bool anonymous) {
                    var param=new ApiEngineParam {ApiEngineKey=key,OsClient=tenant};
                    var dynamicParamJobj=(JObject)request.DeepClone();
                    dynamic apiEngineModel=new JObject { ["ApiV8Code"]=code };
                    var isClientInvocation=true; var isAllowAnonymous=anonymous;
                    var isTrustedManagedProtocol=V8TrustedExecutionContext.IsManagedProtocolAuthorized(key,tenant);
            """ + guard.ToFullString() + "\nreturn new DosResult(1,dynamicParamJobj);}\n"
            + string.Join("\n", fields.Select(f => f.ToFullString()))
            + string.Join("\n", helpers.Select(m => m.ToFullString())) + "\n}";
        var references = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Concat(new[] { typeof(ApiEngineParam).Assembly.Location, typeof(DosResult).Assembly.Location, typeof(JObject).Assembly.Location, typeof(Microsoft.CSharp.RuntimeBinder.Binder).Assembly.Location })
            .Distinct(StringComparer.OrdinalIgnoreCase).Select(p => MetadataReference.CreateFromFile(p));
        var context = File.ReadAllText(Path.Combine(root, "Microi.Server/Microi.Core/Runtime/V8TrustedExecutionContext.cs"));
        var compilation = CSharpCompilation.Create("ManagedApplicationGuardProbe_" + Guid.NewGuid().ToString("N"),
            new[] { CSharpSyntaxTree.ParseText(source), CSharpSyntaxTree.ParseText(context) }, references,
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        using var stream = new MemoryStream(); var emitted = compilation.Emit(stream);
        Assert.True(emitted.Success, string.Join(Environment.NewLine, emitted.Diagnostics));
        stream.Position = 0;
        return AssemblyLoadContext.Default.LoadFromStream(stream).GetType("ManagedApplicationGuardProbe")!;
    }

    private static string FindRoot() => TestProjectPaths.WorkspaceRoot();
}
