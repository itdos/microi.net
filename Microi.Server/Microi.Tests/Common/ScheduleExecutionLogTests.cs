using System.Reflection;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;
using Quartz;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public class ScheduleExecutionLogTests
{
    [Fact]
    public async Task SchedulerStorageError_IsObservableAndRedacted_EvenWhenQueueFails()
    {
        var queue = new QueueRecorder { Throws = true };
        using var provider = new ServiceCollection().AddSingleton<ISysLogQueue>(queue).BuildServiceProvider();
        var locator = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)!;
        var previous = locator.GetValue(null);
        locator.SetValue(null, provider);
        try
        {
            var cause = new SchedulerException("Couldn't acquire next trigger; {\"Password\":\"secret one\"}", new IOException("MongoDB mongodb://user:secret@db:27017; Bearer token.value"));
            await new MicroiSchedulerListener().SchedulerError("scheduler failed", cause, TestContext.Current.CancellationToken);
            var record = Assert.Single(queue.Records);
            Assert.Equal("SchedulerError", record.Action);
            Assert.Contains("Couldn't acquire next trigger", record.Content);
            foreach (var secret in new[] { "secret one", "user:secret", "token.value" }) Assert.DoesNotContain(secret, record.Content);
            var diagnostic = JObject.FromObject(MicroiSchedulingDiagnostics.Read("tenant"));
            Assert.NotNull(diagnostic["LastSchedulerErrorAt"]);
            Assert.Contains("IOException", diagnostic["LastSchedulerError"]!.ToString());
        }
        finally { locator.SetValue(null, previous); }
    }

    [Theory]
    [InlineData(1, false)]
    [InlineData(1, true)]
    [InlineData(0, false)]
    public async Task JobOutcome_PrefersAcknowledgedMongo_AndUsesSqlOnlyOnFailure(int code, bool queueThrows)
    {
        var engine = DispatchProxy.Create<IApiEngine, EngineProxy>();
        ((EngineProxy)engine).ResultCode = code;
        var mongo = DispatchProxy.Create<IMongoDB, MongoProxy>();
        ((MongoProxy)mongo).Fails = queueThrows;
        var forms = DispatchProxy.Create<IFormEngine, FormProxy>();
        using var provider = new ServiceCollection().AddSingleton(engine).AddSingleton(mongo)
            .AddSingleton(forms).BuildServiceProvider();
        var locator = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)!;
        var previous = locator.GetValue(null);
        locator.SetValue(null, provider);
        try
        {
            var context = DispatchProxy.Create<IJobExecutionContext, ContextProxy>();
            await new MicroiApiEngineJob().Execute(context);
            Assert.Equal(1, ((EngineProxy)engine).Runs);
            var record = Assert.Single(((MongoProxy)mongo).Records);
            Assert.Equal("job-log-test", record.OsClient);
            Assert.Equal("minute", record.TargetId);
            Assert.Equal(ScheduleExecutionLog.TargetType, record.TargetType);
            Assert.Equal(code == 1, record.Success);
            Assert.Equal(code == 1 ? "Completed" : "Failed", record.Action);
            Assert.NotEmpty(record.EventId);
            Assert.NotNull(record.OccurredAt);
            Assert.Equal(queueThrows ? 1 : 0, ((FormProxy)forms).Writes);
        }
        finally { locator.SetValue(null, previous); }
    }

    public class MongoProxy : DispatchProxy
    {
        public bool Fails;
        public List<SysLogParam> Records = [];
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name != nameof(IMongoDB.AddSysLogs)) throw new InvalidOperationException(method.Name);
            Records.AddRange((IReadOnlyCollection<SysLogParam>)args![0]!);
            return Task.FromResult(new Dos.Common.DosResult(Fails ? 0 : 1));
        }
    }

    [Fact]
    public async Task OperationalLogStorage_ReportsFailureWhenBothStoresReject()
    {
        var mongo = DispatchProxy.Create<IMongoDB, MongoProxy>();
        ((MongoProxy)mongo).Fails = true;
        using var provider = new ServiceCollection().AddSingleton(mongo).BuildServiceProvider();
        var locator = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)!;
        var previous = locator.GetValue(null);
        locator.SetValue(null, provider);
        try
        {
            var fallbacks = 0;
            var saved = await OperationalLogStorage.WriteAsync(
                new SysLogParam { OsClient = "tenant", TargetType = "MqttEvent" },
                () => { fallbacks++; return Task.FromResult(new Dos.Common.DosResult(0)); });
            Assert.False(saved);
            Assert.Equal(1, fallbacks);
            Assert.Single(((MongoProxy)mongo).Records);
        }
        finally { locator.SetValue(null, previous); }
    }

    [Fact]
    public void OperationalLogStorage_RedactsSecretsAndBoundsLargePayloads()
    {
        var sanitized = OperationalLogStorage.SanitizeContent("{\"token\":\"secret-value\",\"data\":\"ok\"}");
        Assert.DoesNotContain("secret-value", sanitized);
        Assert.Contains("ok", sanitized);
        Assert.True(OperationalLogStorage.SanitizeContent(new string('x', 20000)).Length <= 16385);
    }

    public class FormProxy : DispatchProxy
    {
        public int Writes;
        public string ExpectedTable = "diy_schedule_job_log";
        public JObject? LastPayload;
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name != nameof(IFormEngine.AddFormDataAsync)) throw new InvalidOperationException(method.Name);
            Assert.Equal(ExpectedTable, args![0]);
            LastPayload = JObject.FromObject(args[1]!);
            Writes++;
            return Task.FromResult(new Dos.Common.DosResult(1));
        }
    }

    [Theory]
    [InlineData(false, 0)]
    [InlineData(true, 1)]
    public async Task MqttBusinessLog_WritesMongoFirst_AndFallsBackOnlyOnFailure(bool mongoFails, int sqlWrites)
    {
        var mongo = DispatchProxy.Create<IMongoDB, MongoProxy>();
        ((MongoProxy)mongo).Fails = mongoFails;
        var forms = DispatchProxy.Create<IFormEngine, FormProxy>();
        ((FormProxy)forms).ExpectedTable = "mci_mqtt_log";
        using var provider = new ServiceCollection().AddSingleton(mongo).AddSingleton(forms).BuildServiceProvider();
        var locator = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)!;
        var previous = locator.GetValue(null);
        locator.SetValue(null, provider);
        try
        {
            var method = typeof(MicroiMQTT).GetMethod("WriteMqttLogAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
            await (Task)method.Invoke(null, new object?[] { "tenant", "Receive", "device-1", "tenant/tenant/a", "payload" })!;
            var record = Assert.Single(((MongoProxy)mongo).Records);
            Assert.Equal("MqttEvent", record.TargetType);
            Assert.Equal("device-1", record.TargetId);
            Assert.Equal("tenant/tenant/a", record.Api);
            Assert.Equal("payload", record.Content);
            Assert.Equal(sqlWrites, ((FormProxy)forms).Writes);
            if (mongoFails)
            {
                var sql = ((FormProxy)forms).LastPayload!;
                Assert.Equal(record.EventId, sql["Id"]?.ToString());
                Assert.Null(sql["Topic"]); // 该物理表没有 Topic 列。
            }
        }
        finally { locator.SetValue(null, previous); }
    }

    public class EngineProxy : DispatchProxy
    {
        public int ResultCode, Runs;
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name != nameof(IApiEngine.RunAsync)) throw new InvalidOperationException(method.Name);
            Runs++;
            var param = (JObject)args![0]!;
            Assert.Equal("job-log-test", param["OsClient"]!.ToString());
            return Task.FromResult<dynamic>(new { Code = ResultCode, Msg = "business result" });
        }
    }
    public class ContextProxy : DispatchProxy
    {
        private readonly IJobDetail job = JobBuilder.Create<MicroiApiEngineJob>().WithIdentity("minute", "group")
            .UsingJobData("OsClient", "job-log-test").UsingJobData("ApiEngineKey", "test-engine").Build();
        protected override object? Invoke(MethodInfo? method, object?[]? args) => method!.Name switch
        {
            "get_JobDetail" => job,
            "get_FireInstanceId" => "run-id",
            "get_ScheduledFireTimeUtc" => (DateTimeOffset?)DateTimeOffset.UtcNow,
            _ => throw new InvalidOperationException(method.Name)
        };
    }
    private sealed class QueueRecorder : ISysLogQueue
    {
        public bool Throws;
        public List<SysLogParam> Records = [];
        public bool Enqueue(SysLogParam param)
        {
            Records.Add(param);
            if (Throws) throw new IOException("log store unavailable");
            return true;
        }
        public SysLogQueueHealth GetHealth() => new();
        public Task FlushAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
