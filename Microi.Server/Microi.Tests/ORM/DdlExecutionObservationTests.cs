using System.Data;
using System.Data.Common;
using System.Reflection;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using static Dos.ORM.Tests.Db.ConnectionOwnershipTests;

namespace Microi.Tests.ORM;

[Collection("TenantContextGlobal")]
public sealed class DdlExecutionObservationTests
{
    private static Database Database() => new(new FaultProvider(new FaultFactory()));
    private static int Execute(Database db, DbCommand command) => (int)typeof(Database)
        .GetMethod("DoExecuteNonQuery", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(db, new object[] { command })!;
    private static Task<int> ExecuteAsync(Database db, DbCommand command) => (Task<int>)typeof(Database)
        .GetMethod("DoExecuteNonQueryAsync", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(db, new object[] { command })!;

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ActualDatabaseCommandRecordsSubmittedAndReturnedExactlyOnce(bool async)
    {
        using var scope = DdlExecutionObservation.Begin();
        using var command = new RecordingCommand { CommandText = "CREATE TABLE test_actual (Id int)" };
        var result = async ? await ExecuteAsync(Database(), command) : Execute(Database(), command);
        Assert.Equal(7, result); Assert.Equal(1, command.Calls);
        Assert.Equal(new[] { "submitted", "executed" }, scope.Events.Select(x => x.State));
        Assert.All(scope.Events, item => Assert.Equal(command.CommandText, item.Statement));
        Assert.All(scope.Events, item => Assert.False(item.TransactionPending));
    }

    [Fact]
    public void ActualIndexCommandRecordsOnlyItsRealExecutionWithoutCommitClaim()
    {
        using var scope = DdlExecutionObservation.Begin();
        using var command = new RecordingCommand { CommandText = "CREATE UNIQUE INDEX idx_actual_name ON test_actual (Name)" };
        Assert.Equal(7, Execute(Database(), command));
        Assert.Equal(1, command.Calls);
        Assert.Equal(new[] { "submitted", "executed" }, scope.Events.Select(item => item.State));
        Assert.All(scope.Events, item => Assert.Equal(command.CommandText, item.Statement));
        Assert.All(scope.Events, item => Assert.False(item.TransactionPending));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task IndexEndpointRejectsMissingMcpGrantWithoutDdlAppend(bool resolvedDisabledGrant)
    {
        var accessorField = typeof(DiyHttpContext).GetField("_httpContextAccessor", BindingFlags.Static | BindingFlags.NonPublic)!;
        var oldAccessor = accessorField.GetValue(null);
        var oldContext = (oldAccessor as IHttpContextAccessor)?.HttpContext;
        var accessor = new HttpContextAccessor();
        var context = new DefaultHttpContext();
        // 覆盖无会话与已解析但未获 MCP 授权的请求，不伪造管理员或注入数据库/Token。
        if (resolvedDisabledGrant)
        {
            var contextKey = (string)typeof(McpRoleRequestAuthorization)
                .GetField("ContextKey", BindingFlags.Static | BindingFlags.NonPublic)!.GetRawConstantValue()!;
            context.Items[contextKey] = new McpRoleAuthorization();
        }
        try
        {
            accessor.HttpContext = context;
            DiyHttpContext.Configure(accessor);
            using var observation = DdlExecutionObservation.Begin();
            var response = Assert.IsType<OkObjectResult>(await new V8McpEndpointService(context).CreateTableIndex(new JObject
            {
                ["TableName"] = "test_actual", ["IndexName"] = "idx_actual_name", ["Columns"] = new JArray("Name"),
                ["CaptureDdl"] = true,
            }));
            var result = JObject.FromObject(response.Value!);
            Assert.Equal(0, result.Value<int>("Code"));
            Assert.Equal("当前角色未获准连接 MCP 进行 AI 开发。", result.Value<string>("Msg"));
            Assert.True(result["DataAppend"] == null || result["DataAppend"]!.Type == JTokenType.Null);
            Assert.Empty(observation.Events);
        }
        finally { accessor.HttpContext = oldContext; accessorField.SetValue(null, oldAccessor); }
    }

    [Fact]
    public void FailedActualCommandPreservesOriginalErrorAndDoesNotReplay()
    {
        using var scope = DdlExecutionObservation.Begin();
        var original = new InvalidOperationException("connection-password-must-not-be-in-events");
        using var command = new RecordingCommand { CommandText = "ALTER TABLE test_actual ADD secret varchar(100) DEFAULT 'private-value'", Error = original };
        var error = Assert.Throws<TargetInvocationException>(() => Execute(Database(), command));
        Assert.Same(original, error.InnerException); Assert.Equal(1, command.Calls);
        Assert.Equal(new[] { "submitted", "failed" }, scope.Events.Select(x => x.State));
        Assert.DoesNotContain("private-value", string.Join("\n", scope.Events.Select(x => x.Statement)));
        Assert.DoesNotContain("connection-password", System.Text.Json.JsonSerializer.Serialize(scope.Events));
    }

    [Fact]
    public async Task ParallelAsyncRequestsHaveIsolatedActualCommandReceipts()
    {
        var both = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var ready = 0;
        async Task<string[]> Request(string table)
        {
            using var scope = DdlExecutionObservation.Begin();
            using var command = new RecordingCommand { CommandText = "CREATE TABLE " + table + " (Id int)", BeforeReturn = async () => { if (Interlocked.Increment(ref ready) == 2) both.SetResult(); await both.Task; } };
            await ExecuteAsync(Database(), command);
            return scope.Events.Select(x => x.Statement).ToArray();
        }
        var results = await Task.WhenAll(Task.Run(() => Request("tenant_a")), Task.Run(() => Request("tenant_b")));
        Assert.All(results[0], sql => { Assert.Contains("tenant_a", sql); Assert.DoesNotContain("tenant_b", sql); });
        Assert.All(results[1], sql => { Assert.Contains("tenant_b", sql); Assert.DoesNotContain("tenant_a", sql); });
    }

    [Fact]
    public void NestedScopesRestoreTheirOwnerAndDoNotLeakInnerStatements()
    {
        using var outer = DdlExecutionObservation.Begin();
        using (var inner = DdlExecutionObservation.Begin())
        {
            Execute(Database(), new RecordingCommand { CommandText = "CREATE TABLE inner_table (Id int)" });
            Assert.Equal(2, inner.Events.Count); Assert.Empty(outer.Events);
        }
        Execute(Database(), new RecordingCommand { CommandText = "CREATE TABLE outer_table (Id int)" });
        Assert.All(outer.Events, item => Assert.Contains("outer_table", item.Statement));
    }

    [Fact]
    public async Task BackgroundContinuationCannotKeepCapturingAfterItsRequestScopeCloses()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var scope = DdlExecutionObservation.Begin();
        var child = Task.Run(async () => { await release.Task; Execute(Database(), new RecordingCommand { CommandText = "CREATE TABLE late_background (Id int)" }); });
        scope.Dispose(); release.SetResult(); await child;
        Assert.Empty(scope.Events);
    }

    [Fact]
    public void BoundedObserverReportsOmissionsWithoutChangingExecutedCommands()
    {
        using var scope = DdlExecutionObservation.Begin();
        var db = Database();
        for (var i = 0; i < 65; i++) Execute(db, new RecordingCommand { CommandText = "CREATE TABLE table_" + i + " (Id int)" });
        Assert.Equal(128, scope.Events.Count); Assert.Equal(1, scope.Dropped);
    }

    [Theory]
    [InlineData("CREATE TABLE x (a text DEFAULT 'secret-value', b text COMMENT 'connection-string')")]
    [InlineData("ALTER TABLE x ADD a text DEFAULT $$secret-value$$ /* connection-string */")]
    [InlineData("CREATE TABLE x (a int DEFAULT 123456) -- connection-string\n")]
    [InlineData("CREATE TABLE x (a text DEFAULT \"secret-value\") COMMENT=\"connection-string\"")]
    [InlineData("ALTER TABLE x ADD a ENUM(\"secret-value\",\"connection-string\") # 123456\n")]
    public void ActualDdlProjectionHidesLiteralDefaultsAndComments(string sql)
    {
        var projected = DdlExecutionObservation.Project(sql)!;
        Assert.DoesNotContain("secret-value", projected); Assert.DoesNotContain("connection-string", projected); Assert.DoesNotContain("123456", projected);
        Assert.Contains("已隐藏", projected);
    }

    [Theory]
    [InlineData("UPDATE users SET password='private-value'")]
    [InlineData("CREATE TABLE x (Id int); INSERT INTO x VALUES (1)")]
    [InlineData("EXEC private_procedure 'private-value'")]
    public void BusinessDmlAndMixedCommandsNeverBecomeDdlEvents(string sql) => Assert.Null(DdlExecutionObservation.Project(sql));

    [Fact]
    public void ObserverCannotBeEnabledByPublicHttpOrV8ParameterBinding()
    {
        Assert.False(typeof(DdlExecutionObservation).IsPublic);
        Assert.Empty(typeof(DdlExecutionObservation).GetMethods(BindingFlags.Public | BindingFlags.Static));
        using var command = new RecordingCommand { CommandText = "CREATE TABLE no_observer (Id int)" };
        Assert.Equal(7, Execute(Database(), command)); Assert.Equal(1, command.Calls);
    }

    private sealed class RecordingCommand : DbCommand
    {
        public int Calls;
        public Exception? Error;
        public Func<Task>? BeforeReturn;
        public override string CommandText { get; set; } = "";
        public override int CommandTimeout { get; set; }
        public override CommandType CommandType { get; set; } = CommandType.Text;
        public override bool DesignTimeVisible { get; set; }
        public override UpdateRowSource UpdatedRowSource { get; set; }
        protected override DbConnection? DbConnection { get; set; }
        protected override DbTransaction? DbTransaction { get; set; }
        protected override DbParameterCollection DbParameterCollection => throw new NotSupportedException();
        public override int ExecuteNonQuery() { Calls++; if (Error != null) throw Error; return 7; }
        public override async Task<int> ExecuteNonQueryAsync(CancellationToken cancellationToken) { if (BeforeReturn != null) await BeforeReturn(); return ExecuteNonQuery(); }
        public override void Cancel() { }
        public override object ExecuteScalar() => throw new NotSupportedException();
        public override void Prepare() { }
        protected override DbParameter CreateDbParameter() => throw new NotSupportedException();
        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => throw new NotSupportedException();
    }
}
