using Jint;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;
using System.Data;
using System.Data.Common;
using System.Reflection;
using Dos.ORM;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public class GlobalFunctionRegistryTests
{
    [Fact]
    public void Bootstrap_DoesNotConsumeOrDisableTheTenantStatementBudget()
    {
        using var engine = new V8Engine().CreateEngine(new CreateV8EngineParam { MaxStatements = 1 });
        Assert.Equal(1, engine.Constraints.Find<Jint.Constraints.MaxStatementsConstraint>()!.MaxStatements);
        Assert.Equal(42, engine.Evaluate("40 + 2").AsNumber());
        Assert.Throws<Jint.Runtime.StatementsCountOverflowException>(() => engine.Execute("var x = 0; x++;"));
        Assert.Equal(1, engine.Constraints.Find<Jint.Constraints.MaxStatementsConstraint>()!.MaxStatements);
    }

    [Fact]
    public void FreshEngine_HasDatesWithoutDatabaseOrSystemConfig()
    {
        using var engine = new V8Engine().CreateEngine();
        Assert.Equal("function,function,function", engine.Evaluate("[typeof DateNow,typeof DateFormat,typeof DateAdd].join(',')").AsString());
        Assert.Matches(@"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$", engine.Evaluate("DateNow()").AsString());
    }

    [Theory]
    [InlineData("DateAdd('2024-01-31T12:34:56','M',1,'yyyy-MM-dd')", "2024-02-29")]
    [InlineData("DateAdd('2024-02-29T12:34:56','y',1,'yyyy-MM-dd')", "2025-02-28")]
    [InlineData("DateAdd('2025-03-31T12:34:56','M',-1,'yyyy-MM-dd')", "2025-02-28")]
    [InlineData("DateAdd('2026-09-06T12:34:56','m',1,'HH:mm:ss')", "12:35:56")]
    [InlineData("DateFormat('2026-09-06T12:34:56','yyyy/MM/dd HH:mm:ss yyyy')", "2026/09/06 12:34:56 2026")]
    public void DateFunctions_HandleCalendarBoundaries(string code, string expected)
    {
        using var engine = new V8Engine().CreateEngine();
        Assert.Equal(expected, engine.Evaluate(code).AsString());
    }

    [Fact]
    public void Composition_PreservesCustomCode_AndSeparatesRuntimeAndSettings()
    {
        var rows = JArray.Parse("[{Runtime:'Server',SysConfigId:'a',FunctionName:'Greeting',Code:'function Greeting(){return 42;}'},{Runtime:'Client',SysConfigId:'a',FunctionName:'BrowserOnly',Code:'function BrowserOnly(){return 1;}'},{Runtime:'Server',SysConfigId:'b',FunctionName:'OtherConfig',Code:'function OtherConfig(){return 1;}'}]");
        var legacy = "function DateNow(){return 'tenant';} var CustomSetting=9;";
        var merged = GlobalFunctionRegistry.Compose(legacy, rows, "a", "Server");
        Assert.EndsWith(legacy + Environment.NewLine, merged);
        using var engine = new Engine();
        engine.Execute(merged);
        Assert.Equal("tenant/42/9/undefined/undefined", engine.Evaluate("[DateNow(),Greeting(),CustomSetting,typeof BrowserOnly,typeof OtherConfig].join('/')").AsString());
    }

    [Theory]
    [InlineData("okay", "function other(){}")]
    [InlineData("okay", "function okay(){}; V8.Http.Get({Url:'http://example.test'});")]
    [InlineData("V8", "function V8(){}")]
    [InlineData("okay", "function okay( {")]
    public void DefinitionValidation_DoesNotExecute_AndRejectsInvalidRecords(string name, string code)
        => Assert.ThrowsAny<Exception>(() => GlobalFunctionRegistry.ValidateDefinition(name, code));

    [Fact]
    public void BadDatabaseRecord_CannotBrickLoginOrBootstrap()
    {
        var rows = JArray.Parse("[{Runtime:'Server',SysConfigId:'a',FunctionName:'broken',Code:'function broken( {'}]");
        using var engine = new Engine();
        engine.Execute(GlobalFunctionRegistry.Compose("var Custom=1;", rows, "a", "Server"));
        Assert.Equal(1, engine.Evaluate("Custom").AsNumber());
        Assert.Equal("function", engine.Evaluate("typeof DateNow").AsString());
    }

    [Theory]
    [InlineData("const DateNow = () => 'legacy';")]
    [InlineData("let DateNow = function(){return 'legacy';};")]
    [InlineData("var DateNow = function(){return 'legacy';};")]
    public void LegacyLexicalFunctions_AreNotShadowedOrDuplicated(string legacy)
    {
        using var engine = new V8Engine().CreateEngine();
        var rows = JArray.Parse("[{Runtime:'Server',SysConfigId:'a',FunctionName:'DateNow',Code:'function DateNow(){return 1;}'}]");
        engine.Execute(GlobalFunctionRegistry.Compose(legacy, rows, "a", "Server"));
        Assert.Equal("legacy", engine.Evaluate("DateNow()").AsString());
    }

    [Fact]
    public void Engines_DoNotShareOverriddenFunctions()
    {
        using var a = new V8Engine().CreateEngine();
        using var b = new V8Engine().CreateEngine();
        a.Execute("DateNow=function(){return 'tenant-a';}");
        Assert.NotEqual("tenant-a", b.Evaluate("DateNow()").AsString());
        Assert.NotEqual(GlobalFunctionRegistry.RevisionKey("iTdos"), GlobalFunctionRegistry.RevisionKey("loctek"));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void CacheRevision_ChangesOnlyAfterRealCommit(bool commit)
    {
        using var scope = new CacheScope();
        var key = GlobalFunctionRegistry.RevisionKey("tenant_a");
        scope.Cache.Values[key] = "before";
        scope.Cache.Values["Microi:tenant_a:SysConfig"] = "old-settings";
        using var transaction = new DbTrans(new FakeTransaction(), null!);
        GlobalFunctionRegistry.InvalidateAfterCommit("tenant_a", transaction, systemConfigChanged: true);
        Assert.Equal("before", scope.Cache.Values[key]);
        Assert.Equal("old-settings", scope.Cache.Values["Microi:tenant_a:SysConfig"]);
        if (commit) transaction.Commit(); else transaction.Rollback();
        Assert.Equal(commit, (string)scope.Cache.Values[key] != "before");
        Assert.Equal(!commit, scope.Cache.Values.ContainsKey("Microi:tenant_a:SysConfig"));
    }

    [Fact]
    public void CachedComposition_ReusesSnapshot_AndRevisionSeparatesNewContent()
    {
        using var scope = new CacheScope();
        const string tenant = "tenant_a";
        var raw = JObject.Parse("{Id:'settings-a',GlobalServerV8Code:'function Keep(){return 9;}',GlobalV8Code:''}");
        var original = raw.ToString();
        var snapshot = new GlobalFunctionSnapshot
        {
            Rows = JArray.Parse("[{Runtime:'Server',SysConfigId:'settings-a',FunctionName:'Greeting',Code:'function Greeting(){return 1;}'}]"),
            Fingerprint = "one"
        };
        scope.Cache.Values[$"Microi:{tenant}:GlobalFunctions:Rows:v1:initial"] = snapshot;
        var first = GlobalFunctionRegistry.Attach(raw, tenant);
        var sets = scope.Cache.Sets;
        for (var i = 0; i < 100; i++) Assert.Equal(first.ToString(), GlobalFunctionRegistry.Attach(raw, tenant).ToString());
        Assert.Equal(sets, scope.Cache.Sets); // 热路径既不回源数据库，也不重新编译合并函数。
        Assert.Equal(original, raw.ToString());
        GlobalFunctionRegistry.InvalidateAfterCommit(tenant);
        var revision = (string)scope.Cache.Values[GlobalFunctionRegistry.RevisionKey(tenant)];
        scope.Cache.Values[$"Microi:{tenant}:GlobalFunctions:Rows:v1:{revision}"] = new GlobalFunctionSnapshot
        {
            Rows = JArray.Parse("[{Runtime:'Server',SysConfigId:'settings-a',FunctionName:'Greeting',Code:'function Greeting(){return 2;}'}]"),
            Fingerprint = "two"
        };
        var next = GlobalFunctionRegistry.Attach(raw, tenant);
        using var engine = new Engine();
        engine.Execute(GlobalFunctionRegistry.Decode(next["GlobalServerV8Code"]!.ToString()));
        Assert.Equal(2, engine.Evaluate("Greeting()").AsNumber());
        Assert.Equal(9, engine.Evaluate("Keep()").AsNumber());
        Assert.DoesNotContain("Greeting", GlobalFunctionRegistry.Decode(next["GlobalV8Code"]!.ToString()));
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, false)]
    [InlineData(true, true)]
    [InlineData(false, true)]
    public async Task FormEngineCacheClear_PublishesOnlyCommittedSettings(bool commit, bool useProxy)
    {
        using var scope = new CacheScope();
        const string tenant = "transaction_cache_fixture";
        var key = $"Microi:{tenant}:SysConfig";
        var revisionKey = GlobalFunctionRegistry.RevisionKey(tenant);
        scope.Cache.Values[key] = "committed-settings";
        scope.Cache.Values[revisionKey] = "before";
        using var transaction = new DbTrans(new FakeTransaction(), null!);
        DbTrans suppliedTransaction = useProxy ? new SafeTransactionProxy(transaction) : transaction;
        await new FormEngineExtend().CacheClear(tenant, "config-id", "sys_config",
            FormEngineExtend.FormSubmitType.Upt, cacheTransaction: suppliedTransaction);
        Assert.Equal("committed-settings", scope.Cache.Values[key]);
        Assert.Equal("before", scope.Cache.Values[revisionKey]);
        if (commit) transaction.Commit(); else transaction.Rollback();
        Assert.Equal(!commit, scope.Cache.Values.ContainsKey(key));
        Assert.Equal(commit, (string)scope.Cache.Values[revisionKey] != "before");
    }

    [Fact]
    public async Task FormEngineCacheClear_DoesNotReadUncommittedTableMetadata()
    {
        using var scope = new CacheScope();
        using var transaction = new DbTrans(new FakeTransaction(), null!);
        // 缓存代理不支持数据库读取。任何提交前的授权失效或父表查询都会立即失败，
        // 对应 SQL Server 新增 diy_table 后新增 diy_field 的自阻塞路径。
        await new FormEngineExtend().CacheClear("transaction_cache_fixture", "field-id", "diy_field",
            FormEngineExtend.FormSubmitType.Add, new JObject { ["TableId"] = "uncommitted-table" }, transaction);
        Assert.Empty(scope.Cache.Values);
        transaction.Rollback();
    }

    private sealed class CacheScope : IDisposable, IMicroiCacheTenant
    {
        private readonly FieldInfo field = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        private readonly object? previous;
        private readonly ServiceProvider provider;
        private readonly IMicroiCache proxy = DispatchProxy.Create<IMicroiCache, MemoryCache>();
        public MemoryCache Cache => (MemoryCache)proxy;
        public CacheScope()
        {
            previous = field.GetValue(null);
            provider = new ServiceCollection().AddSingleton<IMicroiCacheTenant>(this).BuildServiceProvider();
            field.SetValue(null, provider);
        }
        IMicroiCache IMicroiCacheTenant.Cache(string osClient) => proxy;
        IMicroiCache IMicroiCacheTenant.Default() => proxy;
        public void Dispose() { field.SetValue(null, previous); provider.Dispose(); }
    }
    public class MemoryCache : DispatchProxy
    {
        public Dictionary<string, object> Values { get; } = new();
        public int Sets { get; private set; }
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            var key = (string)args![0]!;
            switch (method!.Name)
            {
                case "Get": return Values.GetValueOrDefault(key);
                case "Set": Values[key] = args[1]!; Sets++; return true;
                case "Remove": return Values.Remove(key);
                case "RemoveAsync": return Task.FromResult(Values.Remove(key));
                default: throw new NotSupportedException(method.Name);
            }
        }
    }
    private sealed class FakeTransaction : DbTransaction
    {
        private readonly FakeConnection connection = new();
        public override IsolationLevel IsolationLevel => IsolationLevel.ReadCommitted;
        protected override DbConnection DbConnection => connection;
        public override void Commit() { }
        public override void Rollback() { }
    }
    private sealed class FakeConnection : DbConnection
    {
        public override string ConnectionString { get; set; } = "";
        public override string Database => "fixture";
        public override string DataSource => "fixture";
        public override string ServerVersion => "fixture";
        public override ConnectionState State => ConnectionState.Open;
        public override void ChangeDatabase(string databaseName) => throw new NotSupportedException();
        public override void Close() { }
        public override void Open() { }
        protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) => throw new NotSupportedException();
        protected override DbCommand CreateDbCommand() => throw new NotSupportedException();
    }
}
