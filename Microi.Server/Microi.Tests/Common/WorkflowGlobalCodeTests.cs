using System.Text;
using System.Text.RegularExpressions;
using Jint;
using Microi.net;
using Xunit;

namespace Microi.Tests.Common;

/// <summary>工作流全局脚本使用与接口引擎相同的传输解码协议，配置和节点之间不共享可变脚本。</summary>
public class WorkflowGlobalCodeTests
{
    [Fact]
    public void BothWorkflowGlobalPhasesDecodeBeforeEvaluation()
    {
        var file = Path.Combine(FindRoot(), "Microi.Server", "Microi.WorkFlow", "WorkFlow.Send.cs");
        // 私仓不随公开仓分发；独立公开构建仍运行下面的真实编码/Jint兼容用例。
        if (!File.Exists(file)) return;
        var source = File.ReadAllText(file);
        Assert.DoesNotContain("v8EngineParam.V8Code = resultSysConfig.Data.GlobalServerV8Code;", source);
        Assert.Equal(2, Regex.Matches(source, @"var globalServerV8Code = V8Base64\.Base64ToString\(").Count);
        Assert.Equal(2, Regex.Matches(source, @"if \(!string\.IsNullOrWhiteSpace\(globalServerV8Code\)\)").Count);
        Assert.Equal(2, Regex.Matches(source, @"v8EngineParam\.V8Code = globalServerV8Code;").Count);
        var routeSource = File.ReadAllText(Path.Combine(Path.GetDirectoryName(file)!, "WorkFlow.cs"));
        Assert.DoesNotContain("v8EngineParam.V8Code = resultSysConfig.Data.GlobalServerV8Code;", routeSource);
        Assert.Contains("var globalServerV8Code = V8Base64.Base64ToString(", routeSource);
        Assert.Contains("if (!string.IsNullOrWhiteSpace(globalServerV8Code))", routeSource);
    }

    [Fact]
    public void RawTransportReproducesFailureButDecodedUnicodeScriptRuns()
    {
        const string script = "function FlowMessage(){return '报价审核';}\nvar workflowReady = 1;";
        var encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(script));
        using var oldEngine = new Engine();
        Assert.ThrowsAny<Exception>(() => oldEngine.Execute(encoded));
        using var fixedEngine = new Engine();
        fixedEngine.Execute(V8Base64.Base64ToString(encoded));
        Assert.Equal("报价审核", fixedEngine.Evaluate("FlowMessage()").AsString());
        Assert.Equal(1, fixedEngine.Evaluate("workflowReady").AsNumber());
    }

    [Theory]
    [InlineData("function Legacy(){return 'legacy';}")]
    [InlineData("// 旧配置保持原文\r\nfunction Legacy(){return 'legacy';}")]
    public void ExistingPlainTextConfigurationIsNotDecodedAgain(string script)
    {
        Assert.Equal(script, V8Base64.Base64ToString(script));
        using var engine = new Engine();
        engine.Execute(V8Base64.Base64ToString(script));
        Assert.Equal("legacy", engine.Evaluate("Legacy()").AsString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \r\n\t")]
    [InlineData("IA0K")]
    public void EmptyEncodedOrPlainConfigurationHasNoExecutableBody(string? value)
        => Assert.True(string.IsNullOrWhiteSpace(V8Base64.Base64ToString(value ?? "")));

    [Fact]
    public void DifferentNodesAndTenantsUseTheirOwnUnmodifiedConfiguration()
    {
        var settings = new[] { "function Label(){return '租户甲';}", "function Label(){return '租户乙';}" };
        var encoded = settings.Select(x => Convert.ToBase64String(Encoding.UTF8.GetBytes(x))).ToArray();
        for (var node = 0; node < 2; node++)
            for (var tenant = 0; tenant < settings.Length; tenant++)
            {
                using var engine = new Engine();
                engine.Execute(V8Base64.Base64ToString(encoded[tenant]));
                Assert.Equal(tenant == 0 ? "租户甲" : "租户乙", engine.Evaluate("Label()").AsString());
                Assert.Equal(settings[tenant], Encoding.UTF8.GetString(Convert.FromBase64String(encoded[tenant])));
            }
    }

    [Fact]
    public void BadDecodedBusinessScriptStillFailsClosed()
    {
        var encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes("function Invalid( {"));
        using var engine = new Engine();
        Assert.ThrowsAny<Exception>(() => engine.Execute(V8Base64.Base64ToString(encoded)));
    }

    private static string FindRoot()
    {
        for (var at = new DirectoryInfo(AppContext.BaseDirectory); at is not null; at = at.Parent)
            if (Directory.Exists(Path.Combine(at.FullName, "Microi.Server"))) return at.FullName;
        throw new DirectoryNotFoundException("未找到 Microi.Server 工作区");
    }
}
