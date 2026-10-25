using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.Loader;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>执行生产 HTTP 参数归一化；仅隔离 Token I/O 和已解析路由输入，不替代真实 HTTP/租户验收。</summary>
public class ApiEngineHttpBusinessTargetTests
{
    private static readonly Lazy<MethodInfo> Normalize = new(CompileProductionNormalizer);

    [Theory]
    [InlineData(false, "platform-service-health")]
    [InlineData(true, "platform-service-health")]
    [InlineData(false, "")]
    [InlineData(true, "")]
    [InlineData(false, null)]
    [InlineData(true, null)]
    public async Task HttpTargetIsPreservedWithoutReplacingAuthoritativeRoute(bool form, string? target)
    {
        var values = new Dictionary<string, string>
        {
            ["_RequestApiEngineKey"] = "forged-target",
            ["_RequestPath"] = "/api/Job/DeleteJob",
            ["_HttpMethod"] = "GET",
            ["Action"] = "Delete"
        };
        if (target != null) values["ApiEngineKey"] = target;
        var context = new DefaultHttpContext();
        context.Request.Method = "POST";
        context.Request.Path = "/api/Job/AddJob";
        context.Items["resolved-engine"] = "platform-schedule-job";
        string body;
        if (form)
        {
            context.Request.ContentType = "application/x-www-form-urlencoded";
            body = await new FormUrlEncodedContent(values).ReadAsStringAsync();
        }
        else
        {
            context.Request.ContentType = "application/json";
            body = JObject.FromObject(values).ToString();
        }
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(body));
        context.Request.ContentLength = context.Request.Body.Length;
        var result = await (Task<JObject>)Normalize.Value.Invoke(null, new object[] { context, new JObject() })!;

        Assert.Equal("platform-schedule-job", result["ApiEngineKey"]?.ToString());
        Assert.Equal(target, result["_RequestApiEngineKey"]?.ToString());
        Assert.Equal("/api/Job/AddJob", result["_RequestPath"]?.ToString());
        Assert.Equal("POST", result["_HttpMethod"]?.ToString());
        Assert.Equal("Client", result["_InvokeType"]?.ToString());
        Assert.NotEqual("forged-target", result["_RequestApiEngineKey"]?.ToString());
    }

    private static MethodInfo CompileProductionNormalizer()
    {
        var root = FindRoot();
        var path = Environment.GetEnvironmentVariable("TEST_API_CONTROLLER_SOURCE")
            ?? Path.Combine(root, "Microi.Server/Microi.net.Api/Controllers/ApiEngineController.cs");
        var syntax = CSharpSyntaxTree.ParseText(File.ReadAllText(path)).GetRoot();
        var methods = new[] { "DefaultParam", "XmlToJObject" }.Select(name =>
            syntax.DescendantNodes().OfType<MethodDeclarationSyntax>()
                .Single(method => method.Identifier.Text == name).ToFullString());
        var source = """
            using System; using System.IO; using System.Linq; using System.Text; using System.Threading;
            using System.Threading.Tasks; using System.Xml.Linq; using Dos.Common;
            using Microsoft.AspNetCore.Http; using Newtonsoft.Json.Linq;
            public static class HttpBusinessTargetProbe {
                enum InvokeType { Client }
                static readonly AsyncLocal<HttpContext> Context = new();
                public static async Task<JObject> Run(HttpContext context, JObject input) {
                    Context.Value=context;
                    try { return await DefaultParam(input); } finally { Context.Value=null; }
                }
                static class DiyToken { public static Task<dynamic> GetCurrentToken() => Task.FromResult<dynamic>(null); }
                static class DiyHttpContext { public static HttpContext Current => Context.Value; }
                static class HdfsUploadRequestContext { public static bool HasCurrentRequest => false; }
                static class HttpApiTokenHandoff { public static void Bind(JObject p,HttpContext c,object token) {} }
                static class DynamicRoute {
                    public const string ResolvedApiEngineKeyItem="resolved-engine";
                    public const string ResolvedApiRouteValuesItem="resolved-values";
                    public static string NormalizeApiEngineRouteAddress(string path) => path;
                }
            """ + string.Join("\n", methods) + "}";
        var refs = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Concat(new[] { typeof(JObject).Assembly.Location, typeof(Dos.Common.DosResult).Assembly.Location,
                typeof(DefaultHttpContext).Assembly.Location,
                typeof(Microsoft.CSharp.RuntimeBinder.Binder).Assembly.Location })
            .Distinct(StringComparer.OrdinalIgnoreCase).Select(file => MetadataReference.CreateFromFile(file));
        var compilation = CSharpCompilation.Create("HttpBusinessTargetProbe_" + Guid.NewGuid().ToString("N"),
            new[] { CSharpSyntaxTree.ParseText(source) }, refs,
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        using var stream = new MemoryStream();
        var emitted = compilation.Emit(stream);
        Assert.True(emitted.Success, string.Join(Environment.NewLine, emitted.Diagnostics));
        stream.Position = 0;
        return AssemblyLoadContext.Default.LoadFromStream(stream).GetType("HttpBusinessTargetProbe")!.GetMethod("Run")!;
    }

    private static string FindRoot([CallerFilePath] string sourceFile = "")
    {
        // 正式发布把测试产物放在 checkout 外，优先绑定编译时真实源码路径。
        for (var directory = new DirectoryInfo(Path.GetDirectoryName(sourceFile)!); directory != null; directory = directory.Parent)
            if (File.Exists(Path.Combine(directory.FullName, "Microi.Server/Microi.Tests/Microi.Tests.csproj"))) return directory.FullName;
        throw new DirectoryNotFoundException("无法定位生产源码根");
    }
}
