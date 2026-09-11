using System.Text;
using System.Text.RegularExpressions;
using System.Dynamic;
using System.Reflection;
using System.Runtime.Loader;
using Dos.Common;
using Jint;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

/// <summary>原生表单读取的数据过滤不依赖可选全局脚本；脚本仍在同一Jint实例内按顺序执行。</summary>
public class FormDataFilterGlobalCodeTests
{
    [Theory]
    [InlineData("FormEngineGet.cs", 1)]
    [InlineData("FormEngineGetTableData.cs", 2)]
    public void ProductionDecodeDeclarationsBindStringExtensionsForDynamicModels(string fileName, int branchCount)
    {
        var folder = Environment.GetEnvironmentVariable("TEST_FORM_FILTER_SOURCE")
            ?? Path.Combine(FindRoot(), "Microi.Server", "Microi.net", "FormEngine");
        // 公开源码包不包含私有表单实现；已有解码/Jint用例在该模式仍执行。
        if (!Directory.Exists(folder)) return;
        var source = File.ReadAllText(Path.Combine(folder, fileName));
        var declarations = Regex.Matches(source,
            @"(?:var|string)\s+(?:GlobalServerV8Code|ServerDataV8)\s*=\s*V8Base64\.Base64ToString\([^;]+;");
        Assert.Equal(branchCount * 2, declarations.Count);

        // 编译从生产Get/List/Tree原样提取的语句，避免只验证手写的正确示例或正则。
        // dynamic参数会让静态helper调用结果继续dynamic；扩展方法必须在编译期绑定。
        var methods = new StringBuilder();
        for (var branch = 0; branch < branchCount; branch++)
        {
            methods.Append("public static bool[] Run" + branch + "(object config, object table) {");
            methods.Append("dynamic sysConfigModel = config; dynamic diyTableModel = table;");
            methods.Append(declarations[branch * 2].Value);
            methods.Append(declarations[branch * 2 + 1].Value);
            methods.Append("return new bool[] { GlobalServerV8Code.DosIsNullOrWhiteSpace(), ServerDataV8.DosIsNullOrWhiteSpace() }; }");
        }
        var syntax = CSharpSyntaxTree.ParseText("using Dos.Common; using Microi.net; public static class DecodeProbe {" + methods + "}",
            cancellationToken: TestContext.Current.CancellationToken);
        var assemblyPaths = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Concat(new[] { typeof(DynamicHelper).Assembly.Location, typeof(V8Base64).Assembly.Location,
                typeof(Microsoft.CSharp.RuntimeBinder.Binder).Assembly.Location })
            .Distinct(StringComparer.OrdinalIgnoreCase);
        var compilation = CSharpCompilation.Create("FormDecodeProbe_" + Guid.NewGuid().ToString("N"),
            new[] { syntax }, assemblyPaths.Select(p => MetadataReference.CreateFromFile(p)),
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        using var pe = new MemoryStream();
        var result = compilation.Emit(pe, cancellationToken: TestContext.Current.CancellationToken);
        Assert.True(result.Success, string.Join(Environment.NewLine, result.Diagnostics));
        pe.Position = 0;
        var loadContext = new AssemblyLoadContext("FormDecodeProbe", isCollectible: true);
        try
        {
            var probe = loadContext.LoadFromStream(pe).GetType("DecodeProbe")!;
            var samples = new (string? Global, string? Filter, bool GlobalBlank, bool FilterBlank)[] {
                (null, null, true, true), ("", "", true, true),
                (" \r\n\t", Encode(" \r\n"), true, true),
                ("", "throw new Error('DENIED');", true, false),
                ("function allowed(){return true;}", "", false, true),
                (Encode("function allowed(){return true;}"), Encode("if(!allowed())throw new Error('DENIED');"), false, false)
            };
            foreach (var sample in samples)
            foreach (var useJObject in new[] { true, false })
            {
                object MakeModel(string field, string? value)
                {
                    if (useJObject) return new JObject { [field] = value is null ? JValue.CreateNull() : new JValue(value) };
                    IDictionary<string, object?> model = new ExpandoObject();
                    model[field] = value;
                    return model;
                }
                for (var branch = 0; branch < branchCount; branch++)
                {
                    bool[]? actual = null;
                    var error = Record.Exception(() => actual = (bool[])probe.GetMethod("Run" + branch)!
                        .Invoke(null, new[] { MakeModel("GlobalServerV8Code", sample.Global), MakeModel("ServerDataV8", sample.Filter) })!);
                    var cause = error is TargetInvocationException invocation ? invocation.InnerException : error;
                    Assert.True(cause is null, fileName + ": branch " + branch + ", model="
                        + (useJObject ? "JObject" : "ExpandoObject") + ": " + cause);
                    Assert.Equal(new[] { sample.GlobalBlank, sample.FilterBlank }, actual);
                }
            }
        }
        finally { loadContext.Unload(); }
    }

    [Fact]
    public void GetAndBothListBranchesKeepDataFilterIndependentFromGlobalCode()
    {
        // 仅测试进程可指向已冻结的旧源码夹具，复现修复前的入口接线失败。
        var folder = Environment.GetEnvironmentVariable("TEST_FORM_FILTER_SOURCE")
            ?? Path.Combine(FindRoot(), "Microi.Server", "Microi.net", "FormEngine");
        // 公开仓不分发私仓源码；下方真实Jint协议测试在公开构建继续执行。
        if (!Directory.Exists(folder)) return;
        var get = File.ReadAllText(Path.Combine(folder, "FormEngineGet.cs"));
        var list = File.ReadAllText(Path.Combine(folder, "FormEngineGetTableData.cs"));
        var gate = Regex.Match(get, @"if \(result != null(?<condition>[^\{]+)\{").Groups["condition"].Value;
        Assert.NotEmpty(gate);
        Assert.DoesNotContain("GlobalServerV8Code", gate);
        Assert.Contains("!ServerDataV8.DosIsNullOrWhiteSpace()", gate);
        Assert.Contains("param._InvokeType == InvokeType.Client.ToString()", gate);
        Assert.DoesNotContain("if (GlobalServerV8Code.DosIsNullOrWhiteSpace())", list);
        Assert.Equal(2, Regex.Matches(get, @"V8Base64\.Base64ToString\(").Count);
        Assert.Equal(4, Regex.Matches(list, @"V8Base64\.Base64ToString\(").Count);
        Assert.Equal(2, Regex.Matches(list, @"if \(!ServerDataV8\.DosIsNullOrWhiteSpace\(\)").Count);
        Assert.Equal(2, Regex.Matches(list, @"if \(!GlobalServerV8Code\.DosIsNullOrWhiteSpace\(\)\)").Count);
        Assert.DoesNotContain("Encoding.Default.GetString(Convert.FromBase64String", get);
        Assert.DoesNotContain("Encoding.Default.GetString(Convert.FromBase64String", list);
        Assert.Contains("if (v8RunResult.Code != 1)", get);
        Assert.Contains("if (v8RunResult.Code != 1)", list);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \r\n\t")]
    [InlineData("IA0K")]
    public void EmptyGlobalConfigurationCannotSkipReadDenial(string? global)
    {
        using var engine = NewEngine();
        Assert.ThrowsAny<Exception>(() => ExecuteReadScripts(engine, global,
            Encode("throw new Error('RECORD_UNAVAILABLE');")));
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public void PlainAndEncodedGlobalFunctionsRunBeforePlainAndEncodedFilters(bool encodedGlobal, bool encodedFilter)
    {
        const string global = "function safeLabel(){return '授权资料';}";
        const string filter = "V8.Form.Label=safeLabel();delete V8.Form.Secret;";
        using var engine = NewEngine();
        ExecuteReadScripts(engine, encodedGlobal ? Encode(global) : global, encodedFilter ? Encode(filter) : filter);
        Assert.Equal("授权资料", engine.Evaluate("V8.Form.Label").AsString());
        Assert.True(engine.Evaluate("V8.Form.Secret === undefined").AsBoolean());
    }

    [Theory]
    [InlineData("throw new Error('GLOBAL_DENIED');", "V8.Form.Secret='leak';")]
    [InlineData("function broken( {", "V8.Form.Secret='leak';")]
    [InlineData("function allowed(){return false;}", "if(!allowed())throw new Error('ROW_DENIED');")]
    [InlineData("", "function invalid( {")]
    public void GlobalOrRowExceptionsContinueToFailClosed(string global, string filter)
    {
        using var engine = NewEngine();
        Assert.ThrowsAny<Exception>(() => ExecuteReadScripts(engine, Encode(global), Encode(filter)));
        Assert.NotEqual("leak", engine.Evaluate("V8.Form.Secret").AsString());
    }

    [Fact]
    public void BlankRowFilterDoesNotRunOptionalGlobalCodeOnItsOwn()
    {
        using var engine = NewEngine();
        ExecuteReadScripts(engine, "throw new Error('unused');", Encode(" \r\n"));
        Assert.Equal("protected", engine.Evaluate("V8.Form.Secret").AsString());
    }

    private static Engine NewEngine()
    {
        var engine = new Engine();
        engine.Execute("var V8={Form:{Secret:'protected'}};");
        return engine;
    }

    private static string Encode(string source) => Convert.ToBase64String(Encoding.UTF8.GetBytes(source));

    // 执行真实Jint脚本与生产共用的既有解码器；源码接线断言另行覆盖Get/List/Tree三个入口。
    private static void ExecuteReadScripts(Engine engine, string? global, string filter)
    {
        var dataFilter = V8Base64.Base64ToString(filter) ?? "";
        if (string.IsNullOrWhiteSpace(dataFilter)) return;
        var globalCode = V8Base64.Base64ToString(global ?? "") ?? "";
        if (!string.IsNullOrWhiteSpace(globalCode)) engine.Execute(globalCode);
        engine.Execute(dataFilter);
    }

    private static string FindRoot()
    {
        for (var at = new DirectoryInfo(AppContext.BaseDirectory); at is not null; at = at.Parent)
            if (Directory.Exists(Path.Combine(at.FullName, "Microi.Server"))) return at.FullName;
        throw new DirectoryNotFoundException("未找到 Microi.Server 工作区");
    }
}
