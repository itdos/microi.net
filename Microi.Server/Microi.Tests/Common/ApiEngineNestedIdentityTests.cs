using System.Reflection;
using System.Runtime.Loader;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Http;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>执行接口引擎实际参数预处理，验证嵌套调用的会话身份与租户边界。</summary>
public sealed class ApiEngineNestedIdentityTests
{
    private static readonly Lazy<Type> ProbeType = new(CompileProductionPrefix);

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SameTenant_MissingOrJsonNullIdentity_UsesRevalidatedToken(bool jsonNull)
    {
        var f = Authenticated();
        var request = new JObject { ["OsClient"] = "tenant-a", ["ApiEngineKey"] = "nested-worker" };
        if (jsonNull) request["_CurrentUser"] = JValue.CreateNull();
        var result = await Run(f, request);
        Assert.Equal("ordinary-user", result["_CurrentUser"]?["Id"]?.Value<string>());
        Assert.Equal(0, result["_CurrentUser"]?["Level"]?.Value<int>());
        Assert.Equal(1, f.TokenReads);
        Assert.Equal("Server", result["_InvokeType"]?.Value<string>());
    }

    [Fact]
    public async Task MissingTenant_InheritsTokenTenantAndIdentity()
    {
        var result = await Run(Authenticated(), new JObject { ["ApiEngineKey"] = "nested-worker" });
        Assert.Equal("tenant-a", result["OsClient"]?.Value<string>());
        Assert.Equal("ordinary-user", result["_CurrentUser"]?["Id"]?.Value<string>());
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("same-user")]
    [InlineData("forged-admin")]
    public async Task DifferentTenant_ClearsIdentityInsteadOfForwardingToken(string kind)
    {
        var request = new JObject { ["OsClient"] = "tenant-b" };
        if (kind != "missing") request["_CurrentUser"] = User(kind == "same-user" ? "ordinary-user" : "forged", 9999);
        var result = await Run(Authenticated(), request);
        Assert.Equal("tenant-b", result["OsClient"]?.Value<string>());
        Assert.True(result["_CurrentUser"] == null || result["_CurrentUser"]!.Type == JTokenType.Null);
    }

    [Fact]
    public async Task PreparedControllerIdentity_PreservesScopedProjectionAndInvocationType()
    {
        var request = new JObject { ["OsClient"] = "tenant-a", ["_InvokeType"] = "Client", ["_CurrentUser"] = User("ordinary-user", 0) };
        request["_CurrentUser"]!["ControllerProjection"] = "kept";
        var result = await Run(Authenticated(), request);
        Assert.Equal("kept", result["_CurrentUser"]?["ControllerProjection"]?.Value<string>());
        Assert.Equal("Client", result["_InvokeType"]?.Value<string>());
        Assert.Equal(0, result["_CurrentUser"]?["Level"]?.Value<int>());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task TrustedBackgroundIdentity_WinsOverHttpAndParameterIdentity(bool httpPresent)
    {
        var f = httpPresent ? Authenticated() : new NestedIdentityFixture();
        var trusted = User("trusted-worker-user", 1);
        var request = new JObject { ["OsClient"] = "worker-tenant", ["_CurrentUser"] = User("forged-admin", 9999) };
        var result = await Run(f, request, trusted, true);
        Assert.Equal("trusted-worker-user", result["_CurrentUser"]?["Id"]?.Value<string>());
        result["_CurrentUser"]!["Level"] = 9999;
        Assert.Equal(1, trusted["Level"]?.Value<int>());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AnonymousOrUserlessToken_DoesNotInventAnIdentity(bool tokenPresent)
    {
        var f = new NestedIdentityFixture { Token = tokenPresent ? new CurrentToken { OsClient = "tenant-a" } : null };
        var result = await Run(f, new JObject());
        Assert.True(result["_CurrentUser"] == null || result["_CurrentUser"]!.Type == JTokenType.Null);
        Assert.Equal(tokenPresent ? "tenant-a" : "header-tenant", result["OsClient"]?.Value<string>());
    }

    [Fact]
    public async Task ChildIdentityMutation_CannotChangeTheTokenSnapshot()
    {
        var f = Authenticated();
        var original = (JObject)f.Token!.CurrentUser.DeepClone();
        var result = await Run(f, new JObject { ["OsClient"] = "tenant-a" });
        Assert.IsType<JObject>(result["_CurrentUser"]);
        result["_CurrentUser"]!["Level"] = 9999;
        result["_CurrentUser"]!["RoleIds"] = new JArray("admin-role");
        Assert.True(JToken.DeepEquals(original, f.Token.CurrentUser));
    }

    [Fact]
    public async Task ControllerHandoff_IsSingleUse_ThenNestedCallsRevalidate()
    {
        var f = Authenticated();
        var request = new JObject { ["OsClient"] = "tenant-a", ["_CurrentUser"] = User("ordinary-user", 0) };
        var probe = Activator.CreateInstance(ProbeType.Value, f)!;
        ProbeType.Value.GetMethod("BindHandoff")!.Invoke(probe, new object[] { request });
        await Invoke(probe, request, null, false);
        Assert.Equal(0, f.TokenReads);
        await Invoke(probe, (JObject)request.DeepClone(), null, false);
        Assert.Equal(1, f.TokenReads);
    }

    [Fact]
    public async Task TrustedNullIdentity_CannotBeRepopulatedFromAnUnrelatedHttpToken()
    {
        var result = await Run(Authenticated(), new JObject { ["OsClient"] = "tenant-a", ["_CurrentUser"] = User("forged", 9999) }, null, true);
        Assert.True(result["_CurrentUser"] == null || result["_CurrentUser"]!.Type == JTokenType.Null);
    }

    private static JObject User(string id, int level) => new() { ["Id"] = id, ["Level"] = level, ["RoleIds"] = new JArray() };
    private static NestedIdentityFixture Authenticated() => new() { Token = new CurrentToken { OsClient = "tenant-a", CurrentUser = User("ordinary-user", 0) } };
    private static Task<JObject> Run(NestedIdentityFixture fixture, JObject request, JObject? trusted = null, bool preserve = false)
        => Invoke(Activator.CreateInstance(ProbeType.Value, fixture)!, request, trusted, preserve);
    private static Task<JObject> Invoke(object probe, JObject request, JObject? trusted, bool preserve)
        => (Task<JObject>)ProbeType.Value.GetMethod("Initialize")!.Invoke(probe, new object?[] { request, trusted, preserve })!;

    private static Type CompileProductionPrefix()
    {
        var root = FindRoot();
        var syntax = CSharpSyntaxTree.ParseText(File.ReadAllText(Path.Combine(root, "Microi.Server/Microi.net/ApiEngine/ApiEngine.cs"))).GetRoot();
        var method = syntax.DescendantNodes().OfType<MethodDeclarationSyntax>().Single(m => m.Identifier.Text == "RunInternalAsync");
        // 原样取数据库/脚本执行前的生产语句，只替换会话读取、HttpContext 和内存计量 I/O。
        // 不在测试里另写身份恢复算法；修改生产分支会直接改变本夹具的执行行为。
        var prefix = method.Body!.Statements.TakeWhile(s => s is not LocalDeclarationStatementSyntax l || !l.Declaration.Variables.Any(v => v.Identifier.Text == "param"));
        var body = string.Join("\n", prefix.Select(s => s.WithoutLeadingTrivia().WithoutTrailingTrivia().ToFullString()));
        Assert.Contains("await DiyToken.GetCurrentToken()", body);
        var source = """
            using System; using System.Threading.Tasks; using Dos.Common; using Microi.net;
            using Newtonsoft.Json.Linq; using Microi.Tests.Common;
            using MicroiV8ExecutionScope = Microi.Tests.Common.NestedIdentityFixture.MemoryBoundary;
            using DiyHttpContext = Microi.Tests.Common.NestedIdentityFixture.ContextBoundary;
            public sealed class NestedIdentityProbe {
                public NestedIdentityFixture DiyToken {get;}
                public NestedIdentityProbe(NestedIdentityFixture fixture) {DiyToken=fixture; DiyHttpContext.Current=fixture.Context;}
                public void BindHandoff(JObject request) {HttpApiTokenHandoff.Bind(request, DiyToken.Context, DiyToken.Token);}
                public async Task<JObject> Initialize(JObject request, JObject trustedCurrentUser, bool preserveTrustedCurrentUser) {
                    dynamic dynamicParam=request;
            """ + body + "\nreturn dynamicParamJobj; }}";
        var references = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Concat(new[] { typeof(NestedIdentityFixture).Assembly.Location, typeof(CurrentToken).Assembly.Location, typeof(DosResult).Assembly.Location, typeof(JObject).Assembly.Location, typeof(HttpContext).Assembly.Location, typeof(Microsoft.CSharp.RuntimeBinder.Binder).Assembly.Location })
            .Distinct(StringComparer.OrdinalIgnoreCase).Select(p => MetadataReference.CreateFromFile(p));
        // 同时编译真正的一次性身份交接实现，不用恒真/恒假的替代鉴权器。
        var handoff = File.ReadAllText(Path.Combine(root, "Microi.Server/Microi.Core/Runtime/HttpApiTokenHandoff.cs"));
        var compilation = CSharpCompilation.Create("NestedIdentityProbe_" + Guid.NewGuid().ToString("N"),
            new[] { CSharpSyntaxTree.ParseText(source), CSharpSyntaxTree.ParseText(handoff) }, references,
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        using var stream = new MemoryStream(); var emitted = compilation.Emit(stream);
        Assert.True(emitted.Success, string.Join(Environment.NewLine, emitted.Diagnostics));
        stream.Position = 0;
        return AssemblyLoadContext.Default.LoadFromStream(stream).GetType("NestedIdentityProbe")!;
    }

    private static string FindRoot() => TestProjectPaths.WorkspaceRoot();
}

/// <summary>只替换实时会话读取与宿主边界，不负责身份、租户或参数清洗决策。</summary>
public sealed class NestedIdentityFixture
{
    public CurrentToken? Token { get; set; }
    public int TokenReads { get; private set; }
    public HttpContext Context { get; } = new DefaultHttpContext();
    public Task<CurrentToken?> GetCurrentToken() { TokenReads++; return Task.FromResult(Token); }
    public string GetCurrentOsClient() => "header-tenant";
    public static class ContextBoundary
    {
        private static readonly AsyncLocal<HttpContext?> CurrentContext = new();
        public static HttpContext? Current { get => CurrentContext.Value; set => CurrentContext.Value = value; }
    }
    public static class MemoryBoundary
    {
        public static IDisposable PauseCurrentExclusiveMemory() => new EmptyScope();
        private sealed class EmptyScope : IDisposable { public void Dispose() { } }
    }
}
