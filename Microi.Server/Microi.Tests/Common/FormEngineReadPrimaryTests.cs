using System.Reflection;
using System.Runtime.Loader;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

/// <summary>从真实七处 SQL 分支抽取会话选择并执行；数据库终端替换为连接标签，不声称真实复制延迟验收。</summary>
public sealed class FormEngineReadPrimaryTests
{
    private static readonly Lazy<Type> Production = new(BuildProbe);

    [Theory]
    [InlineData(0)] // Get
    [InlineData(1)] // Tree 自动转懒加载计数
    [InlineData(2)] // List/Count/CountBatch
    [InlineData(3)] // SUM 批量
    [InlineData(4)] // SUM 回退
    [InlineData(5)] // 普通行/Export
    [InlineData(6)] // Tree 全量行
    public void EveryNativeSqlBranchUsesTheTrustedTablePolicyAndPreservesTransactions(int entry)
    {
        foreach (var database in new[] { "MySQL", "SqlServer", "Oracle", "PostgreSql", "KingBase", "Dameng", "SQLite" })
        foreach (var target in new[] { "tenant", "extended" })
        {
            var writer = database + ":" + target + ":writer";
            var replica = database + ":" + target + ":replica";
            var table = new JObject { ["Id"] = "resolved-table", ["Name"] = "business", ["DataBaseId"] = target, ["ReadPrimary"] = 1 };
            Assert.Equal(writer, Run(entry, table, writer, replica, false));
            Assert.Equal("parent-transaction", Run(entry, table, writer, replica, true));
            table["ReadPrimary"] = 0;
            Assert.Equal(replica, Run(entry, table, writer, replica, false));
            table["ReadPrimary"] = JValue.CreateNull();
            Assert.Equal(replica, Run(entry, table, writer, replica, false));
            table.Remove("ReadPrimary");
            Assert.Equal(replica, Run(entry, table, writer, replica, false));
            // 请求特意携带反向同名配置；生产决策只能引用已解析的表模型。
            Assert.Equal(replica, Run(entry, table, writer, replica, false, requestPrimary: 1));
        }
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    [InlineData(6)]
    public void MissingWriterAndInvalidMetadataCannotSilentlyFallBack(int entry)
    {
        Assert.Throws<InvalidOperationException>(() => Run(entry, new JObject { ["ReadPrimary"] = 1 }, null, "replica", false));
        foreach (var invalid in new JToken[] { new JValue(2), new JValue(-1), new JValue(true), new JValue(1.5), new JValue(""), new JObject() })
            Assert.Throws<InvalidOperationException>(() => Run(entry, new JObject { ["ReadPrimary"] = invalid }, "writer", "replica", false));
    }

    [Fact]
    public void NativeConfigurationWritesValidateOnlyTheRealMetadataTable()
    {
        var method = Production.Value.Assembly.GetType("Microi.net.FormEngineReadPolicy")?.GetMethod("ValidateConfigurationWrite");
        Assert.NotNull(method);
        Invoke(method, null, new object[] { "business", new JObject { ["ReadPrimary"] = "ordinary business value" } });
        foreach (var value in new JToken[] { JValue.CreateNull(), new JValue(0), new JValue(1), new JValue("1") })
            Invoke(method, null, new object[] { "DIY_TABLE", new JObject { ["ReadPrimary"] = value } });
        Assert.Throws<InvalidOperationException>(() => Invoke(method, null,
            new object[] { "diy_table", new JObject { ["ReadPrimary"] = "primary please" } }));
        Assert.Throws<InvalidOperationException>(() => Invoke(method, null,
            new object[] { "diy_table", new JObject { ["ReadPrimary"] = 1, ["readprimary"] = 0 } }));
    }

    private static string Run(int entry, JObject table, string? writer, string? replica, bool transaction, int requestPrimary = 0) =>
        (string)Invoke(Production.Value.GetMethod("Run" + entry)!, null,
            new object?[] { table, writer, replica, transaction, requestPrimary })!;

    private static object? Invoke(MethodInfo method, object? target, object?[] args)
    {
        try { return method.Invoke(target, args); }
        catch (TargetInvocationException e) when (e.InnerException != null)
        { System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(e.InnerException).Throw(); throw; }
    }

    private static Type BuildProbe()
    {
        var root = FindRoot();
        var before = Environment.GetEnvironmentVariable("TEST_FORM_READ_PRIMARY_SOURCE");
        // 写前文件名保留双下划线分隔符；不替换业务源码内容或条件表达式。
        string Source(string file) => before == null ? File.ReadAllText(Path.Combine(root, file))
            : File.ReadAllText(Path.Combine(before, file.Replace("/", "__")));
        var policyFile = "Microi.Server/Microi.Core/FormEngine/FormEngineReadPolicy.cs";
        var policyPath = before == null ? Path.Combine(root, policyFile) : Path.Combine(before, policyFile.Replace("/", "__"));
        var code = new StringBuilder("using System; using Newtonsoft.Json.Linq; using Microi.net; public class DbSession { public string Label; public DbSession(string label){Label=label;} public string FromSql(string sql)=>Label; } public class NativeReadProbe {");
        int entry = 0;
        foreach (var file in new[] { "FormEngineGet.cs", "FormEngineGetTableData.cs" })
        {
            var syntax = CSharpSyntaxTree.ParseText(Source("Microi.Server/Microi.net/FormEngine/" + file), cancellationToken: TestContext.Current.CancellationToken).GetRoot();
            var decision = syntax.DescendantNodes().OfType<LocalDeclarationStatementSyntax>()
                .SingleOrDefault(x => x.Declaration.Variables.Any(v => v.Identifier.Text == "queryRead"));
            var queries = syntax.DescendantNodes().OfType<InvocationExpressionSyntax>().Where(x =>
                x.Expression is MemberAccessExpressionSyntax m && m.Name.Identifier.Text == "FromSql"
                && (m.Expression.ToString() == "dbRead" || m.Expression.ToString() == "queryRead")
                && x.ArgumentList.Arguments.Count == 1
                && new[] { "sql", "sqlCount", "autoTreeLazyCountSql", "batchSumSql", "sumSqlFinal" }.Contains(x.ArgumentList.Arguments[0].ToString())).ToArray();
            Assert.Equal(file == "FormEngineGet.cs" ? 1 : 6, queries.Length);
            foreach (var query in queries)
            {
                var condition = query.Ancestors().OfType<ConditionalExpressionSyntax>().First();
                ExpressionSyntax Terminal(ExpressionSyntax branch) => branch.DescendantNodesAndSelf().OfType<InvocationExpressionSyntax>()
                    .First(x => x.Expression is MemberAccessExpressionSyntax m && m.Name.Identifier.Text == "FromSql");
                var selected = condition.WithWhenTrue(Terminal(condition.WhenTrue)).WithWhenFalse(Terminal(condition.WhenFalse));
                code.AppendLine($"public static string Run{entry++}(JObject diyTableModel,string writer,string replica,bool transaction,int requestPrimary) {{ var param=new JObject{{[\"ReadPrimary\"]=requestPrimary,[\"DataBaseId\"]=\"forged\"}}; DbSession dbSession=writer==null?null:new DbSession(writer), dbRead=replica==null?null:new DbSession(replica), _trans=transaction?new DbSession(\"parent-transaction\"):null; string sql=\"rows\",sqlCount=\"count\",autoTreeLazyCountSql=\"tree-count\",batchSumSql=\"sum-batch\",sumSqlFinal=\"sum\"; {decision?.ToString()} return {selected}; }}");
            }
        }
        code.AppendLine("} namespace Microi.net { }");
        var trees = new List<SyntaxTree> { CSharpSyntaxTree.ParseText(code.ToString(), cancellationToken: TestContext.Current.CancellationToken) };
        if (File.Exists(policyPath)) trees.Add(CSharpSyntaxTree.ParseText(File.ReadAllText(policyPath), cancellationToken: TestContext.Current.CancellationToken));
        var references = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "").Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Append(typeof(JObject).Assembly.Location).Distinct(StringComparer.OrdinalIgnoreCase).Select(p => MetadataReference.CreateFromFile(p));
        var compilation = CSharpCompilation.Create("ReadPrimaryProbe_" + Guid.NewGuid().ToString("N"), trees, references, new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        using var stream = new MemoryStream();
        var emitted = compilation.Emit(stream, cancellationToken: TestContext.Current.CancellationToken);
        Assert.True(emitted.Success, string.Join(Environment.NewLine, emitted.Diagnostics));
        stream.Position = 0;
        return new AssemblyLoadContext("ReadPrimaryProbe", isCollectible: true).LoadFromStream(stream).GetType("NativeReadProbe")!;
    }

    private static string FindRoot()
    {
        for (var p = new DirectoryInfo(AppContext.BaseDirectory); p != null; p = p.Parent)
            if (Directory.Exists(Path.Combine(p.FullName, "Microi.Server"))) return p.FullName;
        throw new DirectoryNotFoundException("Microi.Server");
    }
}
