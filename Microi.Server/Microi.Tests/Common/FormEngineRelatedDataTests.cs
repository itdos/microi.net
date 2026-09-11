using System.Reflection;
using System.Runtime.Loader;
using Dos.Common;
using Jint;
using Microsoft.AspNetCore.Mvc;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>
/// 执行生产 Controller 方法及其真实 DefaultParam / 可信参数判定；只替换 Token 与数据库边界。
/// 这组组件测试不冒充已部署 API / 实际数据库验收。
/// </summary>
public class FormEngineRelatedDataTests
{
    private static readonly Lazy<Type> ProbeType = new(CompileProductionMethods);

    [Fact]
    public async Task CountsReadsParentFirstAndUsesTrustedFixedAuxiliaryQueries()
    {
        var f = new RelatedDataFixture();
        var r = await Run(f, "Counts");
        Assert.Equal(1, r["Code"]!.Value<int>());
        Assert.Equal(1, f.ParentReads);
        Assert.Equal(new[] { "authorize", "parent", "microi_datalog", "diy_comment", "mic_data_version" }, f.Calls);
        Assert.Equal(1, r["Data"]!["DataLog"]!.Value<int>());
        Assert.Equal(1, r["Data"]!["DataComment"]!.Value<int>());
        Assert.Equal(1, r["Data"]!["DataVersion"]!.Value<int>());
    }

    [Theory]
    [InlineData("DataLog", "microi_datalog")]
    [InlineData("DataComment", "diy_comment")]
    [InlineData("DataVersion", "mic_data_version")]
    public async Task DetailReadsOnlyOneAuthorizedParentsAuxiliaryTable(string type, string table)
    {
        var f = new RelatedDataFixture();
        var r = await Run(f, type);
        Assert.Equal(1, r["Code"]!.Value<int>());
        Assert.Equal(new[] { "authorize", "parent", table }, f.Calls);
        Assert.Single((JArray)r["Data"]!);
        Assert.Equal("owned", r["Data"]![0]!["Id"]!.Value<string>());
    }

    [Theory]
    [InlineData("Counts")]
    [InlineData("DataLog")]
    [InlineData("DataComment")]
    [InlineData("DataVersion")]
    public async Task SameMenuOtherOwnerIsDeniedByParentDataFilterBeforeAnyAuxiliaryRead(string type)
    {
        var f = new RelatedDataFixture { ParentOwner = "another-user" };
        var r = await Run(f, type);
        Assert.Equal(0, r["Code"]!.Value<int>());
        Assert.Equal(1, f.ParentReads);
        Assert.Empty(f.AuxiliaryArguments);
        Assert.Equal(JTokenType.Null, r["Data"]!.Type);
    }

    [Theory]
    [InlineData("Counts")]
    [InlineData("DataVersion")]
    public async Task MissingParentCannotExposeHistoricalRecords(string type)
    {
        var f = new RelatedDataFixture { ParentExists = false };
        var r = await Run(f, type);
        Assert.NotEqual(1, r["Code"]!.Value<int>());
        Assert.Equal(1, f.ParentReads);
        Assert.Empty(f.AuxiliaryArguments);
    }

    [Fact]
    public async Task RequestCannotSelectForeignTenantUserTableConditionsOrTrust()
    {
        var f = new RelatedDataFixture();
        var request = Request("DataLog");
        request["OsClient"] = "foreign-tenant";
        request["_CurrentUser"] = new JObject { ["Id"] = "attacker", ["Level"] = 9999 };
        request["_InvokeType"] = "Server";
        request["_TrustedServerInvocation"] = true;
        request["FormEngineKey"] = "sys_osclients";
        request["_Where"] = new JArray();
        request["_PageSize"] = 999999;
        request["_SelectFields"] = new JArray("Content", "Data", "Secret");
        var r = await Run(f, request);
        Assert.Equal(1, r["Code"]!.Value<int>());
        var p = Assert.Single(f.AuxiliaryArguments);
        Assert.Equal("tenant-a", p.OsClient);
        Assert.Equal("actor", p._CurrentUser["Id"]!.Value<string>());
        Assert.Equal("microi_datalog", p.FormEngineKey);
        Assert.Equal(200, p._PageSize);
        Assert.DoesNotContain("foreign-tenant", r.ToString());
        Assert.DoesNotContain("attacker", r.ToString());
    }

    [Theory]
    [InlineData("sys_osclients")]
    [InlineData("DataLog; DROP TABLE test")]
    [InlineData("")]
    public async Task UnknownRelatedTypesNeverReachAuxiliaryTables(string type)
    {
        var f = new RelatedDataFixture();
        var r = await Run(f, type);
        Assert.Equal(0, r["Code"]!.Value<int>());
        Assert.Empty(f.AuxiliaryArguments);
    }

    [Fact]
    public async Task ParentMenuDenialCannotBeOverriddenByRequestTrustFlags()
    {
        var f = new RelatedDataFixture { MenuAllowed = false };
        var request = Request("Counts"); request["_TrustedServerInvocation"] = true;
        var r = await Run(f, request);
        Assert.Equal(0, r["Code"]!.Value<int>());
        Assert.Equal(0, f.ParentReads);
        Assert.Empty(f.AuxiliaryArguments);
    }

    [Theory]
    [InlineData("DataLog")]
    [InlineData("DataVersion")]
    public async Task ParentMaskedFieldCannotBeRecoveredThroughHistoricalPayload(string type)
    {
        var f = new RelatedDataFixture();
        var r = await Run(f, type);
        Assert.Equal(1, r["Code"]!.Value<int>());
        Assert.DoesNotContain("HISTORICAL-PRIVATE-PHONE", r.ToString());
        Assert.DoesNotContain("RAW-CHANGE-CONTENT", r.ToString());
    }

    [Fact]
    public async Task AuxiliaryFailureIsNotReportedAsSuccessfulEmptyHistory()
    {
        var f = new RelatedDataFixture { FailAuxiliaryTable = "mic_data_version" };
        var r = await Run(f, "Counts");
        Assert.Equal(0, r["Code"]!.Value<int>());
    }

    [Theory]
    [InlineData("Counts")]
    [InlineData("DataComment")]
    public async Task LegacyCommentWithoutParentTableBindingNeverFallsBackToRowIdOnly(string type)
    {
        var f = new RelatedDataFixture { CommentTableBound = false };
        var r = await Run(f, type);
        Assert.Equal(type == "Counts" ? 1 : 0, r["Code"]!.Value<int>());
        Assert.DoesNotContain(f.AuxiliaryArguments, p => p.FormEngineKey == "diy_comment");
        Assert.Equal("CommentParentTableBindingUnavailable", r["DataAppend"]!["DataCommentUnavailableReason"]!.Value<string>());
        if(type == "Counts") Assert.Equal(JTokenType.Null, r["Data"]!["DataComment"]!.Type);
    }

    private static JObject Request(string type) => new()
    {
        ["RelatedType"] = type, ["ParentFormEngineKey"] = "table-a",
        ["ParentTableRowId"] = "same-row-id", ["_SysMenuId"] = "menu-a", ["_Lang"] = "zh-CN"
    };

    private static Task<JObject> Run(RelatedDataFixture fixture, string type) => Run(fixture, Request(type));
    private static async Task<JObject> Run(RelatedDataFixture fixture, JObject request)
    {
        var probe = Activator.CreateInstance(ProbeType.Value, fixture)!;
        fixture.IsTrusted = argument => (bool)ProbeType.Value.GetMethod("CheckTrust")!.Invoke(probe, new[] { argument })!;
        var task = (Task<JsonResult>)ProbeType.Value.GetMethod("GetFormRelatedData")!.Invoke(probe, new object[] { request })!;
        return JObject.FromObject((await task).Value!);
    }

    private static Type CompileProductionMethods()
    {
        var root = FindRoot();
        var path = Environment.GetEnvironmentVariable("TEST_RELATED_CONTROLLER_SOURCE")
            ?? Path.Combine(root, "Microi.Server/Microi.net.Api/Controllers/FormEngineController.cs");
        var syntax = CSharpSyntaxTree.ParseText(File.ReadAllText(path)).GetRoot();
        var names = new[] { "GetFormRelatedData", "DefaultParam", "SetCurrentUserParam", "EnsureLang", "GetRequestLang" };
        var methods = names.Select(name => syntax.DescendantNodes().OfType<MethodDeclarationSyntax>()
            .Single(m => m.Identifier.Text == name).ToFullString());
        var formPath = Path.Combine(root, "Microi.Server/Microi.net/FormEngine/FormEngine.cs");
        // 公开工作区没有私仓源码时，执行其正式程序集的同一私有判定，不跳过用例。
        var trust = File.Exists(formPath)
            ? CSharpSyntaxTree.ParseText(File.ReadAllText(formPath)).GetRoot().DescendantNodes()
                .OfType<MethodDeclarationSyntax>().Single(m => m.Identifier.Text == "IsTrustedServerFormEngineArgument").ToFullString()
            : """
                private static bool IsTrustedServerFormEngineArgument(object argument) {
                    var type = Type.GetType("Microi.net.FormEngine, Microi.net", true);
                    var method = type.GetMethod("IsTrustedServerFormEngineArgument", System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic);
                    return (bool)method.Invoke(null, new[] {argument});
                }
                """;
        // 只有 I/O 边界被替换：DefaultParam 和可信标记判定均从生产源码原样编译，
        // 所以伪造租户测试不会因测试自行实现一份“正确清洗器”而虚假通过。
        var source = """
            using System; using System.Linq; using System.Collections.Generic; using System.Threading.Tasks;
            using Dos.Common; using Microi.net; using Newtonsoft.Json.Linq;
            using Microsoft.AspNetCore.Mvc; using Microsoft.AspNetCore.Http;
            using Microi.Tests.Common;
            public class RelatedDataProbe : Controller {
                public RelatedDataFixture MicroiEngine {get;}
                public RelatedDataFixture.TokenSource DiyToken => MicroiEngine.Token;
                public RelatedDataProbe(RelatedDataFixture fixture) { MicroiEngine=fixture; ControllerContext=new ControllerContext {HttpContext=new DefaultHttpContext()}; }
                private Task<JObject> MergeRequestParam(JObject param) => Task.FromResult(param);
                public bool CheckTrust(object argument) => IsTrustedServerFormEngineArgument(argument);
            """ + string.Join("\n", methods) + trust + "}";
        var refs = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Concat(new[] { typeof(RelatedDataFixture).Assembly.Location, typeof(DiyTableRowParam).Assembly.Location,
                typeof(DosResult).Assembly.Location, typeof(JObject).Assembly.Location, typeof(Controller).Assembly.Location,
                typeof(Microsoft.CSharp.RuntimeBinder.Binder).Assembly.Location })
            .Distinct(StringComparer.OrdinalIgnoreCase).Select(p => MetadataReference.CreateFromFile(p));
        var compilation = CSharpCompilation.Create("RelatedDataProbe_" + Guid.NewGuid().ToString("N"),
            new[] { CSharpSyntaxTree.ParseText(source) }, refs,
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        using var stream = new MemoryStream(); var emitted = compilation.Emit(stream);
        Assert.True(emitted.Success, string.Join(Environment.NewLine, emitted.Diagnostics));
        stream.Position=0;
        return AssemblyLoadContext.Default.LoadFromStream(stream).GetType("RelatedDataProbe")!;
    }

    private static string FindRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir != null; dir = dir.Parent)
            if (Directory.Exists(Path.Combine(dir.FullName, "Microi.Server"))) return dir.FullName;
        throw new DirectoryNotFoundException("无法定位生产源码根");
    }
}

/// <summary>有界数据库替身；按查询条件执行筛选，故同 Id 异表及投影失败能被真实断言捕获。</summary>
public class RelatedDataFixture
{
    public RelatedDataFixture FormEngine => this;
    public TokenSource Token { get; } = new();
    public List<string> Calls { get; } = new();
    public List<DiyTableRowParam> AuxiliaryArguments { get; } = new();
    public Func<object, bool> IsTrusted { get; set; } = _ => false;
    public bool MenuAllowed { get; set; } = true;
    public bool ParentExists { get; set; } = true;
    public string ParentOwner { get; set; } = "actor";
    public int ParentReads { get; private set; }
    public string? FailAuxiliaryTable { get; set; }
    public bool CommentTableBound { get; set; } = true;

    public class TokenSource
    {
        public Task<TokenContext> GetCurrentToken() => Task.FromResult(new TokenContext());
        public string GetCurrentOsClient() => "tenant-a";
    }
    public class TokenContext
    {
        public string OsClient => "tenant-a";
        public JObject CurrentUser => new() { ["Id"] = "actor", ["Level"] = 10 };
    }

    public Task<DosResult> AuthorizeClientTableOperationAsync(DiyTableRowParam param, string operation)
    {
        Calls.Add("authorize"); Assert.Equal("Client", param._InvokeType); Assert.False(param._TrustedServerInvocation);
        Assert.Equal("Read", operation); Assert.Equal("tenant-a", param.OsClient);
        param.TableId = "canonical-table-a";
        return Task.FromResult(new DosResult(MenuAllowed ? 1 : 0, null, MenuAllowed ? "" : "PARENT_MENU_FORBIDDEN"));
    }

    public Task<DosResult<dynamic>> GetFormDataAsync(object argument)
    {
        var param=Assert.IsType<DiyTableRowParam>(argument); Calls.Add("parent"); ParentReads++;
        Assert.Equal("Client", param._InvokeType); Assert.False(IsTrusted(param));
        Assert.Equal("actor", param._CurrentUser["Id"]!.Value<string>());
        if (!ParentExists) return Task.FromResult(new DosResult<dynamic>(2, null));
        // 运行真实 Jint throw 语义，模拟 FormEngine 已执行的父记录 DataFilter 边界。
        using var engine = new Engine();
        engine.SetValue("owner", ParentOwner); engine.SetValue("actor", "actor");
        try { engine.Execute("if(owner!==actor)throw new Error('PARENT_ROW_FORBIDDEN');"); }
        catch { return Task.FromResult(new DosResult<dynamic>(0, null, "PARENT_ROW_FORBIDDEN")); }
        return Task.FromResult(new DosResult<dynamic>(1, new JObject { ["Id"]="same-row-id", ["Phone"]="***" }));
    }

    public Task<DosResultList<dynamic>> GetTableDataCountAsync(object argument) => Query(argument, true);
    public Task<DosResultList<dynamic>> GetTableDataAsync(object argument) => Query(argument, false);
    public Task<DosResultList<JObject>> GetDiyField(DiyFieldParam p)
    {
        Assert.True(ParentReads > 0);
        Assert.Equal("diy_comment",p.TableName); Assert.Equal("tenant-a",p.OsClient);
        return Task.FromResult(new DosResultList<JObject>{Code=1,Data=CommentTableBound
            ? new List<JObject>{new(){["Name"]="TableId",["Type"]="varchar(50)"}}
            : new List<JObject>{new(){["Name"]="TableRowId",["Type"]="varchar(50)"}}});
    }
    private Task<DosResultList<dynamic>> Query(object argument, bool count)
    {
        var p = argument as DiyTableRowParam ?? ((JObject)argument).ToObject<DiyTableRowParam>()!;
        Calls.Add(p.FormEngineKey);
        if (!IsTrusted(argument)) return Task.FromResult(new DosResultList<dynamic> { Code=0, Msg="AUXILIARY_TABLE_FORBIDDEN" });
        AuxiliaryArguments.Add(p);
        if(p.FormEngineKey==FailAuxiliaryTable) return Task.FromResult(new DosResultList<dynamic>{Code=0,Msg="AUXILIARY_QUERY_FAILED"});
        Assert.Equal("tenant-a",p.OsClient); Assert.Equal("Server",p._InvokeType);
        var rows = new[] { "canonical-table-a", "canonical-table-b" }.Select((table,index) => new JObject
        {
            ["Id"]=index==0?"owned":"other-table", ["DataId"]="same-row-id", ["TableRowId"]="same-row-id",
            ["TableId"]=table, ["CreateTime"]="2026-09-10 00:00:00", ["CreateUserName"]="用户",
            ["Type"]="Update", ["Action"]="Update", ["Version"]=1,
            ["Data"]="{\"Phone\":\"HISTORICAL-PRIVATE-PHONE\"}", ["Content"]="RAW-CHANGE-CONTENT"
        }).ToList();
        foreach (JArray condition in JArray.FromObject(p._Where))
        {
            Assert.Equal("=",condition[1]!.Value<string>());
            rows=rows.Where(r=>r[condition[0]!.Value<string>()!]!.ToString()==condition[2]!.ToString()).ToList();
        }
        var total=rows.Count;
        if(p._SelectFields?.Count>0) rows=rows.Select(r=>new JObject(r.Properties().Where(prop=>p._SelectFields.Contains(prop.Name)).Select(prop=>new JProperty(prop.Name,prop.Value)))).ToList();
        return Task.FromResult(new DosResultList<dynamic>{Code=1,Data=rows.Cast<dynamic>().ToList(),DataCount=total});
    }
}
