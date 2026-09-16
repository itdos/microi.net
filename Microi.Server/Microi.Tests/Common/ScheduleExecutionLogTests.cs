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
    public async Task JobOutcome_IsRecordedWithoutSql_AndQueueFailureCannotFailBusiness(int code, bool queueThrows)
    {
        var engine = DispatchProxy.Create<IApiEngine, EngineProxy>();
        ((EngineProxy)engine).ResultCode = code;
        var queue = new QueueRecorder { Throws = queueThrows };
        using var provider = new ServiceCollection().AddSingleton(engine).AddSingleton<ISysLogQueue>(queue).BuildServiceProvider();
        var locator = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)!;
        var previous = locator.GetValue(null);
        locator.SetValue(null, provider);
        try
        {
            var context = DispatchProxy.Create<IJobExecutionContext, ContextProxy>();
            await new MicroiApiEngineJob().Execute(context);
            Assert.Equal(1, ((EngineProxy)engine).Runs);
            var record = Assert.Single(queue.Records);
            Assert.Equal("job-log-test", record.OsClient);
            Assert.Equal("minute", record.TargetId);
            Assert.Equal(ScheduleExecutionLog.TargetType, record.TargetType);
            Assert.Equal(code == 1, record.Success);
            Assert.Equal(code == 1 ? "Completed" : "Failed", record.Action);
            Assert.NotEmpty(record.EventId);
            Assert.NotNull(record.OccurredAt);
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
