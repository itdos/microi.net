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

    [Fact]
    public async Task AdministratorVersionListNeverReadsBodyAndDetailReadsOnlySelectedVersion()
    {
        var f = new RelatedDataFixture { IsAdministrator = true, ParentTableName = "sys_apiengine" };
        var list = await Run(f, "DataVersion");
        Assert.Equal("OnDemand", list["DataAppend"]!["HistoryContentMode"]!.Value<string>());
        Assert.DoesNotContain("Data", f.AuxiliaryArguments[0]._SelectFields);
        Assert.Empty(f.WrittenComments);
        var request = Request("DataVersion"); request["VersionId"] = "owned";
        var detail = await Run(f, request);
        Assert.Equal("Authorized", detail["DataAppend"]!["HistoryContentMode"]!.Value<string>());
        Assert.Equal(1, f.AuxiliaryArguments[^1]._PageSize);
        Assert.Contains("return 1", detail.ToString());
        Assert.DoesNotContain("HISTORICAL-PRIVATE-PHONE", detail.ToString());
        Assert.Empty(f.WrittenComments);
    }

    [Theory]
    [InlineData(false, "sys_apiengine", "owned")]
    [InlineData(true, "sys_osclients", "owned")]
    [InlineData(true, "sys_apiengine", "other-table")]
    public async Task VersionBodyRequiresLiveAdministratorCodeTableAndExactParent(bool admin, string table, string id)
    {
        var f = new RelatedDataFixture { IsAdministrator = admin, ParentTableName = table };
        var request = Request("DataVersion"); request["VersionId"] = id;
        var result = await Run(f, request);
        Assert.NotEqual(1, result["Code"]!.Value<int>());
        Assert.DoesNotContain("return 1", result.ToString());
    }

    [Theory]
    [InlineData("647b78a5-ae91-4b4a-8d49-abd98405c5dc")]
    [InlineData("01M2FC0G2XBTD08V5PBPVYV63X")]
    public async Task CommentWriteBindsParentAuthorAndReplyAndReusesRequestId(string requestId)
    {
        var f = new RelatedDataFixture();
        var request = Request("DataComment");
        request["RequestId"] = requestId; request["Content"] = "测试评论";
        request["ParentCommentId"] = "owned"; request["TableId"] = "forged-table";
        request["UserId"] = "forged-user"; request["ReplyToContent"] = "forged-content";
        var first = await Run(f, request, "AddFormComment");
        Assert.Equal(1, first["Code"]!.Value<int>());
        var row = Assert.Single(f.WrittenComments);
        Assert.Equal("canonical-table-a", row["ParentTableId"]!.Value<string>());
        Assert.Equal("actor", row["UserId"]!.Value<string>());
        Assert.Equal("original-author", row["ReplyToUserId"]!.Value<string>());
        Assert.Equal("RAW-CHANGE-CONTENT", row["ReplyToContent"]!.Value<string>());
        var second = await Run(f, request, "AddFormComment");
        Assert.Equal(1, second["Code"]!.Value<int>()); Assert.Single(f.WrittenComments);
    }

    [Theory]
    [InlineData("not-an-id")]
    [InlineData("01M2FC0G2XBTD08V5PBPVYV63X-extra")]
    public async Task InvalidCommentSubmissionIdDoesNotWrite(string id)
    {
        var fixture = new RelatedDataFixture();
        var request = Request("DataComment"); request["RequestId"] = id; request["Content"] = "测试";
        Assert.NotEqual(1, (await Run(fixture, request, "AddFormComment"))["Code"]!.Value<int>());
        Assert.Empty(fixture.WrittenComments);
    }

    [Theory]
    [InlineData("other-table", true)]
    [InlineData("owned", false)]
    public async Task UnauthorizedReplyOrParentCannotWriteComment(string reply, bool readable)
    {
        var f = new RelatedDataFixture { ParentExists = readable };
        var request = Request("DataComment"); request["ParentCommentId"] = reply;
        request["RequestId"] = Guid.NewGuid().ToString(); request["Content"] = "测试";
        var result = await Run(f, request, "AddFormComment");
        Assert.NotEqual(1, result["Code"]!.Value<int>()); Assert.Empty(f.WrittenComments);
    }

    private static Task<JObject> Run(RelatedDataFixture fixture, string type) => Run(fixture, Request(type));
    private static async Task<JObject> Run(RelatedDataFixture fixture, JObject request, string method = "GetFormRelatedData")
    {
        var probe = Activator.CreateInstance(ProbeType.Value, fixture)!;
        fixture.IsTrusted = argument => (bool)ProbeType.Value.GetMethod("CheckTrust")!.Invoke(probe, new[] { argument })!;
        var task = (Task<JsonResult>)ProbeType.Value.GetMethod(method)!.Invoke(probe, new object[] { request })!;
        return JObject.FromObject((await task).Value!);
    }

    private static Type CompileProductionMethods()
    {
        var root = FindRoot();
        var path = Environment.GetEnvironmentVariable("TEST_RELATED_CONTROLLER_SOURCE")
            ?? Path.Combine(root, "Microi.Server/Microi.net.Api/Controllers/FormEngineController.cs");
        var syntax = CSharpSyntaxTree.ParseText(File.ReadAllText(path)).GetRoot();
        var names = new[] { "GetFormRelatedData", "AddFormComment", "DefaultParam", "SetCurrentUserParam", "EnsureLang", "GetRequestLang" };
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
            using Microi.Tests.Generated;
            public class RelatedDataProbe : Controller {
                public RelatedDataFixture MicroiEngine {get;}
                private FormRelatedDataRuntime FormRelatedDataService => new(MicroiEngine);
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
        // Controller 依赖内部身份转交原子；一并编译真实源码，保留可访问边界和全部安全断言，
        // 不将内部生产 API 改成 public，也不在测试里手写替代身份处理实现。
        var identityHelper = File.ReadAllText(Path.Combine(root,
            "Microi.Server/Microi.Core/Runtime/HttpOwnedIdentityTransfer.cs"));
        // 执行完整生产服务，仅替换数据库与主库身份复核边界；不在测试里重写业务逻辑。
        var service = File.ReadAllText(Path.Combine(root,"Microi.Server/Microi.Core/FormEngine/FormRelatedDataService.cs"))
            .Replace("namespace Microi.net", "namespace Microi.Tests.Generated")
            .Replace("public static class FormRelatedDataService", "public class FormRelatedDataRuntime")
            .Replace("public static Task<object>", "public Task<object>")
            .Replace("private static async Task<object>", "private async Task<object>")
            .Replace("public Task<object> GetAsync", "public RelatedDataFixture MicroiEngine {get;} public RelatedDataFixture PlatformAdministratorSecurity => MicroiEngine; public FormRelatedDataRuntime(RelatedDataFixture f) {MicroiEngine=f;} public Task<object> GetAsync");
        service = "using Microi.net; using Microi.Tests.Common;\n" + service;
        var compilation = CSharpCompilation.Create("RelatedDataProbe_" + Guid.NewGuid().ToString("N"),
            new[] { CSharpSyntaxTree.ParseText(source), CSharpSyntaxTree.ParseText(identityHelper), CSharpSyntaxTree.ParseText(service) }, refs,
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
    public string CommentBindingField { get; set; } = "ParentTableId";
    public bool IsAdministrator { get; set; }
    public string ParentTableName { get; set; } = "ordinary_table";
    public List<JObject> WrittenComments { get; } = new();
    public bool IsCurrentPlatformAdministrator(string osClient, JObject user) => IsAdministrator;
    public Task<DosResult<dynamic>> GetDiyTable(string id, string osClient, string lang) =>
        Task.FromResult(new DosResult<dynamic>(1, new JObject { ["Id"] = id, ["Name"] = ParentTableName }));
    public Task<DosResult> AddFormDataAsync(DiyTableRowParam p)
    {
        Assert.Equal("diy_comment", p.FormEngineKey); Assert.True(IsTrusted(p));
        Assert.Equal(p._RowModel["Id"]!.Value<string>(), p.Id);
        WrittenComments.Add((JObject)p._RowModel.DeepClone());
        return Task.FromResult(new DosResult(1));
    }

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
            ? new List<JObject>{new(){["Name"]=CommentBindingField,["Type"]="varchar(36)"}}
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
            ["TableId"]=table, ["ParentTableId"]=table, ["CreateTime"]="2026-09-10 00:00:00", ["CreateUserName"]="用户",
            ["Type"]="Update", ["Action"]="Update", ["Version"]=1,
            ["Data"]="{\"Id\":\"same-row-id\",\"ApiV8Code\":\"return 1;\",\"Phone\":\"HISTORICAL-PRIVATE-PHONE\"}",
            ["Content"]="RAW-CHANGE-CONTENT", ["UserId"]="original-author", ["UserName"]="原作者", ["ParentCommentId"]=""
        }).ToList();
        if (p.FormEngineKey == "diy_comment") rows.AddRange(WrittenComments);
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
