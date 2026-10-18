using System.Reflection;
using System.Runtime.Loader;
using Dos.Common;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>
/// 原样执行生产 TableChild 委托授权方法；只以有界主库元数据/记录和根授权结果代替 I/O。
/// 不另写一份关系校验器，也不把本组件测试冒充真实租户 HTTP/数据库验收。
/// </summary>
public class TableChildDelegatedAuthorizationTests
{
    private static readonly Lazy<Type> ProbeType = new(CompileProductionMethod);

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(8)]
    public async Task ParentReadAllowsExactOwnedChildAtEachSupportedDepth(int depth)
    {
        var fixture = new TableChildDelegationFixture(depth);
        var param = fixture.NewParam();

        Assert.True(await Run(fixture, param));

        Assert.Equal("row-" + (depth - 1), param._SearchEqual["ParentId"]);
        Assert.Equal(new[] { "menu-" + depth }, param._AuthorizationPolicy.MenuIds);
        Assert.Equal(depth, fixture.ParentAuthorizationCalls.Count);
        Assert.Equal("Read", fixture.ParentAuthorizationCalls[^1].Operation);
        Assert.DoesNotContain(fixture.Snapshot.Menus, menu => menu.Id == "menu-" + depth);
    }

    [Theory]
    [InlineData("missing-parent-chain")]
    [InlineData("parent-menu-other-table")]
    [InlineData("deleted-parent-menu")]
    [InlineData("forged-field")]
    [InlineData("wrong-parent-value")]
    [InlineData("foreign-child-row")]
    [InlineData("root-denied")]
    [InlineData("cycle")]
    [InlineData("too-deep")]
    [InlineData("wrong-child-menu")]
    [InlineData("wrong-child-module-key")]
    [InlineData("conflicting-child-menu-key")]
    public async Task ForgedOrUnownedDelegationNeverAcquiresRead(string mutation)
    {
        var fixture = new TableChildDelegationFixture(mutation == "too-deep" ? 9
            : mutation == "wrong-child-menu" || mutation == "wrong-child-module-key" || mutation == "conflicting-child-menu-key" ? 1 : 2);
        var param = fixture.NewParam();
        switch (mutation)
        {
            case "missing-parent-chain": param._TableChildAuth.Parent = null; break;
            case "parent-menu-other-table": fixture.Menus.Single(m => m.Id == "menu-1").DiyTableId = "another-table"; break;
            case "deleted-parent-menu": fixture.Menus.Single(m => m.Id == "menu-1").IsDeleted = 1; break;
            case "forged-field": param._TableChildAuth.ParentFieldId = "forged-field"; break;
            case "wrong-parent-value": param._TableChildAuth.ParentValue = "another-parent"; break;
            case "foreign-child-row": param.Id = "foreign-row"; break;
            case "root-denied": fixture.RootReadAllowed = false; break;
            case "cycle": param._TableChildAuth.Parent = param._TableChildAuth; break;
            case "wrong-child-menu": param._SysMenuId = "other-menu"; break;
            case "wrong-child-module-key": param._SysMenuId = null; param.ModuleEngineKey = "other-module"; break;
            case "conflicting-child-menu-key": param.ModuleEngineKey = "other-module"; break;
        }

        Assert.False(await Run(fixture, param));
    }

    [Fact]
    public async Task MissingContextDoesNotTurnHiddenMenuIntoDirectGrant()
    {
        var fixture = new TableChildDelegationFixture(1);
        var param = fixture.NewParam();
        param._TableChildAuth = null;
        Assert.False(await Run(fixture, param));
        Assert.Empty(fixture.ParentAuthorizationCalls);
    }

    [Fact]
    public async Task LegacyChildWithoutExplicitMenuAndExactModuleKeyBothRemainSupported()
    {
        var fixture = new TableChildDelegationFixture(1);
        var legacy = fixture.NewParam(); legacy._SysMenuId = null;
        Assert.True(await Run(fixture, legacy));
        var keyed = fixture.NewParam(); keyed._SysMenuId = null; keyed.ModuleEngineKey = "module-1";
        Assert.True(await Run(fixture, keyed));
        var legacyKeyInId = fixture.NewParam(); legacyKeyInId._SysMenuId = "module-1";
        Assert.True(await Run(fixture, legacyKeyInId));
        var legacyIdInKey = fixture.NewParam(); legacyIdInKey._SysMenuId = null; legacyIdInKey.ModuleEngineKey = "menu-1";
        Assert.True(await Run(fixture, legacyIdInKey));
    }

    private static async Task<bool> Run(TableChildDelegationFixture fixture, DiyTableRowParam param)
    {
        var probe = Activator.CreateInstance(ProbeType.Value, fixture)!;
        return await (Task<bool>)ProbeType.Value.GetMethod("Run")!.Invoke(probe, [param])!;
    }

    private static Type CompileProductionMethod()
    {
        var root = FindRoot();
        var path = Environment.GetEnvironmentVariable("TEST_TABLECHILD_AUTHORIZATION_SOURCE")
            ?? Path.Combine(root, "Microi.Server/Microi.net/FormEngine/FormEngineAuthorization.cs");
        // 与其它私有内核回归一致，仅在中央项目已确认源码引用模式时发现本文件。
        if (!File.Exists(path)) throw new FileNotFoundException("本组件回归需要平台授权源码", path);
        var syntax = CSharpSyntaxTree.ParseText(File.ReadAllText(path)).GetRoot();
        var methods = new[] { "AuthorizeDelegatedTableChildAsync", "IsNewTableChildParent", "IsValidTableChildContextChain", "GetRequestedRowIds", "IsWriteOperation", "FindAuthorizationMenu", "ToJObject" }
            .Select(name => syntax.DescendantNodes().OfType<MethodDeclarationSyntax>().Single(method => method.Identifier.Text == name).ToFullString());
        var source = """
            using System; using System.Linq; using System.Collections.Generic; using System.Threading.Tasks;
            using Dos.Common; using Microi.net; using Newtonsoft.Json.Linq; using Microi.Tests.Common;
            public class TableChildDelegationProbe {
                private enum ClientTableOperation { Read,List,Add,Edit,Delete,EditByWhere,DeleteByWhere,Import,Export }
                private readonly TableChildDelegationFixture fixture;
                public TableChildDelegationProbe(TableChildDelegationFixture value) { fixture=value; }
                private TableChildDelegationFixture OsClient => fixture;
                private Task<DosResult<dynamic>> GetDiyTable(string key,string tenant,string lang) => fixture.GetDiyTable(key,tenant);
                private Task<DosResultList<dynamic>> GetDiyTableRow<T>(DiyTableRowParam p) => fixture.GetRows(p);
                private Task<DosResult<dynamic>> GetDiyTableRowModel<T>(DiyTableRowParam p) => fixture.GetRow(p);
                private async Task<bool> AuthorizeClientTableAsync(DiyTableRowParam p,JObject table,ClientTableOperation operation) {
                    fixture.ParentAuthorizationCalls.Add((p,operation.ToString()));
                    if(p._SysMenuId=="menu-0") return fixture.RootReadAllowed && operation==ClientTableOperation.Read;
                    return await AuthorizeDelegatedTableChildAsync(p,table,operation);
                }
                public Task<bool> Run(DiyTableRowParam p) => AuthorizeDelegatedTableChildAsync(p,fixture.ChildTable,ClientTableOperation.Read);
            """ + string.Join("\n", methods) + "}";
        var references = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Concat(new[] { typeof(TableChildDelegationFixture).Assembly.Location, typeof(DiyTableRowParam).Assembly.Location,
                typeof(DosResult).Assembly.Location, typeof(JObject).Assembly.Location,
                typeof(Microsoft.CSharp.RuntimeBinder.Binder).Assembly.Location })
            .Distinct(StringComparer.OrdinalIgnoreCase).Select(location => MetadataReference.CreateFromFile(location));
        var compilation = CSharpCompilation.Create("TableChildDelegationProbe_" + Guid.NewGuid().ToString("N"),
            [CSharpSyntaxTree.ParseText(source)], references, new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        using var stream = new MemoryStream(); var emitted = compilation.Emit(stream);
        Assert.True(emitted.Success, string.Join(Environment.NewLine, emitted.Diagnostics));
        stream.Position = 0;
        return AssemblyLoadContext.Default.LoadFromStream(stream).GetType("TableChildDelegationProbe")!;
    }

    private static string FindRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory != null; directory = directory.Parent)
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server"))) return directory.FullName;
        throw new DirectoryNotFoundException("无法定位平台源码根");
    }
}

/// <summary>有限的权威元数据与记录夹具；外键条件真实筛选，不从被测客户端上下文生成记录。</summary>
public sealed class TableChildDelegationFixture
{
    public List<DiyField> Fields { get; } = [];
    public List<SysMenu> Menus { get; } = [];
    public FormEngineAuthorizationSnapshot Snapshot { get; }
    public bool RootReadAllowed { get; set; } = true;
    public List<(DiyTableRowParam Param, string Operation)> ParentAuthorizationCalls { get; } = [];
    public JObject ChildTable => tables["table-" + depth];
    public TableChildDelegationFixture Db => this;
    private readonly int depth;
    private readonly Dictionary<string, JObject> tables = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, JObject> rows = new(StringComparer.OrdinalIgnoreCase);

    public TableChildDelegationFixture(int levels)
    {
        depth = levels;
        for (var index = 0; index <= depth; index++)
        {
            var key = "table-" + index;
            var table = new JObject { ["Id"] = key, ["Name"] = "diy_fixture_" + index };
            tables[key] = table; tables[(string)table["Name"]!] = table;
            rows[key] = new JObject { ["Id"] = "row-" + index, ["ParentId"] = "row-" + (index - 1) };
            Menus.Add(new SysMenu { Id = "menu-" + index, ModuleEngineKey = "module-" + index, DiyTableId = key, IsDeleted = 0 });
            if (index == 0) continue;
            Fields.Add(new DiyField { Id = "relation-" + index, TableId = "table-" + (index - 1), Component = "TableChild", IsDeleted = 0,
                Config = JsonConvert.SerializeObject(new DiyFieldConfig { TableChildTableId = key, TableChildSysMenuId = "menu-" + index, TableChildFkFieldName = "ParentId" }) });
            Fields.Add(new DiyField { Id = "fk-" + index, TableId = key, Name = "ParentId", IsDeleted = 0 });
        }
        Snapshot = new FormEngineAuthorizationSnapshot { UserId = "actor", IsActiveUser = true, EffectiveRoleIds = ["reader"],
            Menus = [new FormEngineAuthorizationMenuSnapshot { Id = "menu-0", DiyTableId = "table-0" }],
            RoleLimits = [new SysRoleLimit { Type = "Menu", FkId = "menu-0", Permission = "[\"Read\"]" }] };
    }

    public DiyTableRowParam NewParam()
    {
        TableChildAuthorizationContext? context = null;
        for (var index = 1; index <= depth; index++)
            context = new TableChildAuthorizationContext { ParentTableId = "table-" + (index - 1), ParentSysMenuId = "menu-" + (index - 1),
                ParentFieldId = "relation-" + index, ParentRowId = "row-" + (index - 1), ParentValue = "row-" + (index - 1), ParentFormMode = "View", Parent = context };
        return new DiyTableRowParam { OsClient = "fixture-tenant", FormEngineKey = "diy_fixture_" + depth, Id = "row-" + depth,
            _SysMenuId = "menu-" + depth, _TableChildAuth = context, _CurrentUser = new JObject { ["Id"] = "actor" },
            _InvokeType = "Client", _AuthorizationSnapshot = Snapshot };
    }

    public TableChildDelegationFixture? GetClient(string tenant) => tenant == "fixture-tenant" ? this : null;
    public TableChildMetadataQuery<T> From<T>() => new(typeof(T) == typeof(DiyField) ? Fields.Cast<T>() : typeof(T) == typeof(SysMenu) ? Menus.Cast<T>() : throw new InvalidOperationException("夹具不允许其它元数据表"));
    public Task<DosResult<dynamic>> GetDiyTable(string key, string tenant) => Task.FromResult(new DosResult<dynamic>(tenant == "fixture-tenant" && tables.TryGetValue(key, out _) ? 1 : 0, tables.GetValueOrDefault(key)));
    public Task<DosResultList<dynamic>> GetRows(DiyTableRowParam p)
    {
        var found = FindRow(p);
        return Task.FromResult(new DosResultList<dynamic> { Code = 1, DataCount = found == null ? 0 : 1, Data = found == null ? [] : [found] });
    }
    public Task<DosResult<dynamic>> GetRow(DiyTableRowParam p)
    {
        var found = FindRow(p);
        return Task.FromResult(new DosResult<dynamic>(found == null ? 2 : 1, found));
    }
    private JObject? FindRow(DiyTableRowParam p)
    {
        Assert.Equal("fixture-tenant", p.OsClient);
        Assert.Equal("actor", p._CurrentUser["Id"]!.Value<string>());
        Assert.True(p._TrustedServerInvocation);
        if (!tables.TryGetValue(p.FormEngineKey, out var table) || !rows.TryGetValue((string)table["Id"]!, out var row)) return null;
        if (!string.IsNullOrEmpty(p.Id) && p.Id != (string?)row["Id"]) return null;
        if (p._SearchEqual?.Any(pair => (string?)row[pair.Key] != pair.Value) == true) return null;
        return row;
    }
}

public sealed class TableChildMetadataQuery<T>(IEnumerable<T> source)
{
    private IEnumerable<T> rows = source;
    public TableChildMetadataQuery<T> Where(Func<T, bool> predicate) { rows = rows.Where(predicate); return this; }
    public T? First() => rows.FirstOrDefault();
}
