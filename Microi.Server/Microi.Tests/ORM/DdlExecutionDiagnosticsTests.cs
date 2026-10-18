using System.Data;
using System.Data.Common;
using System.Reflection;
using Dos.ORM;
using Jint;
using Jint.Runtime;
using Jint.Runtime.Interop;
using Microi.net;
using static Dos.ORM.Tests.Db.ConnectionOwnershipTests;

namespace Microi.Tests.ORM;

[Collection("TenantContextGlobal")]
public sealed class DdlExecutionDiagnosticsTests
{
    private static Database Database() => new(new FaultProvider(new FaultFactory()));
    private static int Execute(Database db, DbCommand command) => (int)typeof(Database)
        .GetMethod("DoExecuteNonQuery", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(db, new object[] { command })!;
    private static Task<int> ExecuteAsync(Database db, DbCommand command) => (Task<int>)typeof(Database)
        .GetMethod("DoExecuteNonQueryAsync", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(db, new object[] { command })!;

    [Fact]
    public void ExternalClrSurfaceCannotAcceptSqlCallbacksOrInternalExecutionObjects()
    {
        var facade = typeof(DdlExecutionDiagnostics);
        const BindingFlags declaredPublic = BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly;
        Assert.True(facade.IsPublic && facade.IsSealed);
        Assert.Empty(facade.GetConstructors());
        Assert.Empty(facade.GetFields(declaredPublic));
        Assert.Empty(facade.GetEvents(declaredPublic));
        Assert.Equal(new[] { "Begin", "Dispose", "get_Dropped", "get_Events" },
            facade.GetMethods(declaredPublic).Select(method => method.Name).OrderBy(name => name));
        Assert.All(facade.GetMethods(declaredPublic), method => Assert.Empty(method.GetParameters()));
        Assert.Equal(facade, facade.GetMethod("Begin")!.ReturnType);
        Assert.Equal(typeof(int), facade.GetProperty("Dropped")!.PropertyType);
        Assert.Equal(typeof(IReadOnlyList<DdlExecutionDiagnostics.EventSnapshot>), facade.GetProperty("Events")!.PropertyType);
        Assert.All(facade.GetProperties(declaredPublic), property => Assert.False(property.CanWrite));

        var snapshot = typeof(DdlExecutionDiagnostics.EventSnapshot);
        Assert.True(snapshot.IsNestedPublic && snapshot.IsSealed);
        Assert.Empty(snapshot.GetConstructors());
        Assert.Empty(snapshot.GetFields(declaredPublic));
        Assert.Equal(new[] { "Id", "ObservedAtUtc", "State", "Statement", "TransactionPending" },
            snapshot.GetProperties(declaredPublic).Select(property => property.Name).OrderBy(name => name));
        Assert.All(snapshot.GetProperties(declaredPublic), property =>
        {
            Assert.False(property.CanWrite);
            Assert.Contains(property.PropertyType, new[] { typeof(int), typeof(string), typeof(bool) });
        });
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SuccessfulActualCommandsReturnDetachedReadOnlySanitizedSnapshots(bool async)
    {
        using var scope = DdlExecutionDiagnostics.Begin();
        IReadOnlyList<DdlExecutionDiagnostics.EventSnapshot>? submitted = null;
        using var command = new RecordingCommand
        {
            CommandText = "CREATE TABLE trusted_facade (Secret text DEFAULT 'private-value') /* connection-password */",
            DuringExecution = () => submitted = scope.Events,
        };
        Assert.Equal(7, async ? await ExecuteAsync(Database(), command) : Execute(Database(), command));
        Assert.Equal(1, command.Calls);
        Assert.Single(submitted!);
        Assert.Equal("submitted", submitted![0].State);
        var completed = scope.Events;
        Assert.Equal(new[] { "submitted", "executed" }, completed.Select(item => item.State));
        Assert.NotSame(submitted[0], completed[0]);
        Assert.Equal(1, completed[0].Id);
        Assert.Equal(completed[0].Id, completed[1].Id);
        Assert.All(completed, item =>
        {
            Assert.Contains("trusted_facade", item.Statement);
            Assert.DoesNotContain("private-value", item.Statement);
            Assert.DoesNotContain("connection-password", item.Statement);
            Assert.Contains("已隐藏", item.Statement);
            Assert.False(item.TransactionPending);
            Assert.True(DateTimeOffset.TryParse(item.ObservedAtUtc, out _));
        });
        var list = Assert.IsAssignableFrom<IList<DdlExecutionDiagnostics.EventSnapshot>>(completed);
        Assert.True(list.IsReadOnly);
        Assert.Throws<NotSupportedException>(() => list.Clear());
        Assert.Equal(2, scope.Events.Count);
        Assert.Equal(0, scope.Dropped);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task FailedActualCommandsPreserveOriginalFailureWithoutReplayOrErrorLeak(bool async)
    {
        using var scope = DdlExecutionDiagnostics.Begin();
        var original = new InvalidOperationException("private-connection-password");
        using var command = new RecordingCommand
        {
            CommandText = "ALTER TABLE trusted_facade ADD Secret text DEFAULT 'private-value'",
            Error = original,
        };
        if (async)
            Assert.Same(original, await Assert.ThrowsAsync<InvalidOperationException>(() => ExecuteAsync(Database(), command)));
        else
            Assert.Same(original, Assert.Throws<TargetInvocationException>(() => Execute(Database(), command)).InnerException);
        Assert.Equal(1, command.Calls);
        Assert.Equal(new[] { "submitted", "failed" }, scope.Events.Select(item => item.State));
        var serialized = System.Text.Json.JsonSerializer.Serialize(scope.Events);
        Assert.DoesNotContain("private-connection-password", serialized);
        Assert.DoesNotContain("private-value", serialized);
    }

    [Fact]
    public async Task ParallelFlowsHaveSeparateFacadeSnapshots()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var ready = 0;
        async Task<string[]> Request(string table)
        {
            using var scope = DdlExecutionDiagnostics.Begin();
            using var command = new RecordingCommand
            {
                CommandText = "CREATE TABLE " + table + " (Id int)",
                BeforeReturn = async () => { if (Interlocked.Increment(ref ready) == 2) release.SetResult(); await release.Task; },
            };
            await ExecuteAsync(Database(), command);
            return scope.Events.Select(item => item.Statement).ToArray();
        }
        var snapshots = await Task.WhenAll(Task.Run(() => Request("facade_tenant_a")), Task.Run(() => Request("facade_tenant_b")));
        Assert.All(snapshots[0], statement => { Assert.Contains("facade_tenant_a", statement); Assert.DoesNotContain("facade_tenant_b", statement); });
        Assert.All(snapshots[1], statement => { Assert.Contains("facade_tenant_b", statement); Assert.DoesNotContain("facade_tenant_a", statement); });
    }

    [Fact]
    public void NestedFacadeDisposalRestoresOuterScopeAndRemainsIdempotent()
    {
        using var outer = DdlExecutionDiagnostics.Begin();
        var inner = DdlExecutionDiagnostics.Begin();
        Execute(Database(), new RecordingCommand { CommandText = "CREATE TABLE inner_facade (Id int)" });
        Assert.Empty(outer.Events);
        inner.Dispose(); inner.Dispose();
        Execute(Database(), new RecordingCommand { CommandText = "CREATE TABLE outer_facade (Id int)" });
        Assert.All(inner.Events, item => Assert.Contains("inner_facade", item.Statement));
        Assert.All(outer.Events, item => Assert.Contains("outer_facade", item.Statement));
        Assert.Equal(2, inner.Events.Count);
        Assert.Equal(2, outer.Events.Count);
    }

    [Fact]
    public async Task ClosedFacadeCannotCaptureAnInheritedBackgroundFlow()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var scope = DdlExecutionDiagnostics.Begin();
        var background = Task.Run(async () =>
        {
            await release.Task;
            Execute(Database(), new RecordingCommand { CommandText = "CREATE TABLE late_facade (Id int)" });
        });
        scope.Dispose(); release.SetResult(); await background;
        Assert.Empty(scope.Events);
    }

    [Fact]
    public void FacadeRetainsObserverBoundsAndExcludesBusinessDml()
    {
        using var scope = DdlExecutionDiagnostics.Begin();
        var db = Database();
        Execute(db, new RecordingCommand { CommandText = "UPDATE users SET Secret='private-value'" });
        Execute(db, new RecordingCommand { CommandText = "CREATE TABLE mixed_facade (Id int); INSERT INTO mixed_facade VALUES (1)" });
        Assert.Empty(scope.Events);
        for (var index = 0; index < 65; index++)
            Execute(db, new RecordingCommand { CommandText = "CREATE TABLE bounded_facade_" + index + " (Id int)" });
        Assert.Equal(128, scope.Events.Count);
        Assert.Equal(1, scope.Dropped);
    }

    [Fact]
    public void RealV8EngineBlocksImportedFacadeBeginAndInjectedTypeReference()
    {
        using var engine = new V8Engine().CreateEngine();
        // Only this test engine discovers ORM types. Production AllowClr and the
        // production member filter remain unchanged, including all denied members.
        var options = (Options)typeof(Engine)
            .GetProperty("Options", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(engine)!;
        options.Interop.AllowedAssemblies.Add(typeof(DdlExecutionDiagnostics).Assembly);
        // Prove namespace/type resolution succeeded, so a missing assembly cannot make the denial pass.
        Assert.IsType<TypeReference>(engine.Evaluate("importNamespace('Dos.ORM').DdlExecutionDiagnostics"));
        Assert.True(engine.Evaluate("importNamespace('Dos.ORM').DdlExecutionDiagnostics.Begin").IsUndefined());
        Assert.Throws<JavaScriptException>(() => engine.Execute("importNamespace('Dos.ORM').DdlExecutionDiagnostics.Begin()"));
        engine.SetValue("injectedDiagnosticsType", TypeReference.CreateTypeReference(engine, typeof(DdlExecutionDiagnostics)));
        Assert.True(engine.Evaluate("injectedDiagnosticsType.Begin").IsUndefined());
        Assert.Throws<JavaScriptException>(() => engine.Execute("injectedDiagnosticsType.Begin()"));
        // Preserve useful CLR access, including another type in the same ORM namespace.
        Assert.IsType<TypeReference>(engine.Evaluate("importNamespace('Dos.ORM').DatabaseType"));
        Assert.Equal((double)DatabaseType.MySql, engine.Evaluate("importNamespace('Dos.ORM').DatabaseType.MySql").AsNumber());
        Assert.Equal(7, engine.Evaluate("System.Math.Abs(-7)").AsNumber());
        Assert.Equal("2024-01-02", engine.Evaluate("DateFormat('2024-01-02T12:34:56','yyyy-MM-dd')").AsString());
    }

    [Fact]
    public void RealV8EngineBlocksInjectedScopeAndNestedSnapshotMembers()
    {
        using var scope = DdlExecutionDiagnostics.Begin();
        Execute(Database(), new RecordingCommand { CommandText = "CREATE TABLE before_v8 (Id int)" });
        var snapshot = scope.Events[0];
        using var engine = new V8Engine().CreateEngine();
        engine.SetValue("injectedDiagnostics", scope);
        engine.SetValue("injectedSnapshot", snapshot);
        engine.SetValue("injectedDisposable", (IDisposable)scope);
        Assert.True(engine.Evaluate("injectedDiagnostics").IsUndefined());
        Assert.True(engine.Evaluate("injectedSnapshot").IsUndefined());
        Assert.True(engine.Evaluate("injectedDisposable").IsUndefined());
        foreach (var member in new[] { "Events", "Dropped", "Dispose" })
            Assert.Throws<JavaScriptException>(() => engine.Evaluate("injectedDiagnostics." + member));
        foreach (var member in new[] { "Id", "Statement", "State", "TransactionPending", "ObservedAtUtc" })
            Assert.Throws<JavaScriptException>(() => engine.Evaluate("injectedSnapshot." + member));
        Assert.Throws<JavaScriptException>(() => engine.Execute("injectedDiagnostics.Dispose()"));
        Assert.Throws<JavaScriptException>(() => engine.Execute("injectedDisposable.Dispose()"));
        Execute(Database(), new RecordingCommand { CommandText = "CREATE TABLE after_v8 (Id int)" });
        Assert.Equal(4, scope.Events.Count); // Denied JS disposal cannot disable the trusted host observer.
        Assert.Equal("submitted", snapshot.State);
        Assert.Equal(7, engine.Evaluate("System.Math.Abs(-7)").AsNumber());
        var ordinary = new CountingDisposable();
        engine.SetValue("ordinaryDisposable", ordinary);
        engine.Execute("ordinaryDisposable.Dispose()");
        Assert.Equal(1, ordinary.Calls);
    }

    public sealed class CountingDisposable : IDisposable
    {
        public int Calls { get; private set; }
        public void Dispose() => Calls++;
    }

    private sealed class RecordingCommand : DbCommand
    {
        public int Calls;
        public Exception? Error;
        public Action? DuringExecution;
        public Func<Task>? BeforeReturn;
        public override string CommandText { get; set; } = "";
        public override int CommandTimeout { get; set; }
        public override CommandType CommandType { get; set; } = CommandType.Text;
        public override bool DesignTimeVisible { get; set; }
        public override UpdateRowSource UpdatedRowSource { get; set; }
        protected override DbConnection? DbConnection { get; set; }
        protected override DbTransaction? DbTransaction { get; set; }
        protected override DbParameterCollection DbParameterCollection => throw new NotSupportedException();
        public override int ExecuteNonQuery() { Calls++; DuringExecution?.Invoke(); if (Error != null) throw Error; return 7; }
        public override async Task<int> ExecuteNonQueryAsync(CancellationToken cancellationToken) { if (BeforeReturn != null) await BeforeReturn(); return ExecuteNonQuery(); }
        public override void Cancel() { }
        public override object ExecuteScalar() => throw new NotSupportedException();
        public override void Prepare() { }
        protected override DbParameter CreateDbParameter() => throw new NotSupportedException();
        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => throw new NotSupportedException();
    }
}
