using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using Microi.net;
using Microi.net.Api;
using Microsoft.Extensions.Logging.Abstractions;

namespace Microi.Tests.Common;

public sealed class AiPlatformTraceAndLifecycleTests
{
    [Fact]
    public void W3cTraceContext_CreatesParentChildRelationship()
    {
        using var root = MicroiTraceContext.StartActivity("root");
        var traceParent = MicroiTraceContext.CurrentTraceParent;
        Assert.NotNull(traceParent);
        Assert.True(MicroiTraceContext.IsValidTraceParent(traceParent));

        using var child = MicroiTraceContext.StartActivity("child", traceParent);
        Assert.Equal(ActivityIdFormat.W3C, child.IdFormat);
        Assert.Equal(root.TraceId, child.TraceId);
        Assert.Equal(root.SpanId, child.ParentSpanId);
        Assert.NotEqual(root.SpanId, child.SpanId);
    }

    [Fact]
    public void SysLogSnapshot_ProjectsCurrentActivityWithoutTrustingRequestInput()
    {
        var spool = Path.Combine(Path.GetTempPath(), "microi-trace-snapshot-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(spool);
        try
        {
            var mongo = DispatchProxy.Create<IMongoDB, NoopMongoProxy>();
            var environment = new BoundedQueueHostEnvironment
            {
                ContentRootPath = spool,
                ApplicationName = "Microi.Trace.Tests",
                EnvironmentName = "Acceptance"
            };
            var service = new SysLogQueueService(
                mongo,
                NullLogger<SysLogQueueService>.Instance,
                environment,
                new SysLogQueueOptions { SpoolDirectory = spool });
            using var activity = MicroiTraceContext.StartActivity("snapshot");
            activity.SetTag("component", "test");

            var snapshotMethod = typeof(SysLogQueueService).GetMethod(
                "Snapshot",
                BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.NotNull(snapshotMethod);
            var snapshot = Assert.IsType<SysLogParam>(snapshotMethod!.Invoke(
                service,
                new object[] { new SysLogParam { OsClient = "trace-test", Title = "trace" } }));

            Assert.Equal(activity.TraceId.ToHexString(), snapshot.TraceId);
            Assert.Equal(activity.SpanId.ToHexString(), snapshot.SpanId);
            Assert.Equal("Microi.Trace.Tests", snapshot.ServiceName);
            Assert.Equal("Acceptance", snapshot.Environment);
            Assert.False(string.IsNullOrWhiteSpace(snapshot.NodeId));
        }
        finally
        {
            if (Directory.Exists(spool)) Directory.Delete(spool, true);
        }
    }

    [Fact]
    public void CompressedArchive_IsJsonLinesAndContainsStableEventEvidence()
    {
        var method = typeof(V8Method).GetMethod(
            "CreateCompressedLogArchive",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        var bytes = Assert.IsType<byte[]>(method!.Invoke(null, new object[]
        {
            new[]
            {
                new SysLog { Id = "event-1", EventId = "event-1", TraceId = "0123456789abcdef0123456789abcdef", Title = "one" },
                new SysLog { Id = "event-2", EventId = "event-2", Title = "two" }
            }
        }));
        Assert.NotEmpty(bytes);
        using var input = new MemoryStream(bytes);
        using var gzip = new GZipStream(input, CompressionMode.Decompress);
        using var reader = new StreamReader(gzip, Encoding.UTF8);
        var lines = reader.ReadToEnd().Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, lines.Length);
        Assert.Contains("\"EventId\":\"event-1\"", lines[0]);
        Assert.Contains("\"TraceId\":\"0123456789abcdef0123456789abcdef\"", lines[0]);
        Assert.Contains("\"EventId\":\"event-2\"", lines[1]);
    }

    [Fact]
    public void LifecycleSource_ArchivesVerifiesReceiptsThenConditionallyDeletes()
    {
        var serverRoot = FindServerRoot();
        var methodSource = File.ReadAllText(Path.Combine(serverRoot, "Microi.net", "V8Engine", "V8Method.cs"));
        var mongoSource = File.ReadAllText(Path.Combine(serverRoot, "Microi.MongoDB", "V8MongoDB.cs"));

        Assert.True(methodSource.IndexOf("PutObject", StringComparison.Ordinal)
                    < methodSource.IndexOf("ObjectExist", StringComparison.Ordinal));
        Assert.True(methodSource.IndexOf("ObjectExist", StringComparison.Ordinal)
                    < methodSource.IndexOf("CommitSystemLogLifecycleBatch", StringComparison.Ordinal));
        Assert.Contains("BackgroundTaskRuntime.IsLeaseCurrent", methodSource);
        Assert.Contains("_log_lifecycle_receipts", mongoSource);
        Assert.Contains("ArchiveVerified", mongoSource);
        Assert.Contains("BuildLifecycleFilter(param)", mongoSource);
        Assert.Contains("Builders<SysLog>.Filter.In(d => d.Id, eventIds)", mongoSource);
        Assert.Contains("remaining != 0", mongoSource);
    }

    [Fact]
    public void TracePropagationSource_CoversHttpBackgroundAndRabbitMq()
    {
        var serverRoot = FindServerRoot();
        var http = File.ReadAllText(Path.Combine(serverRoot, "Microi.Core", "Http", "DiyHttp.cs"));
        var background = File.ReadAllText(Path.Combine(serverRoot, "Microi.Core", "Runtime", "BackgroundTaskService.cs"));
        var publish = File.ReadAllText(Path.Combine(serverRoot, "Microi.MQ", "RabbitMQ", "MicroiRabbitMQPublish.cs"));
        var consume = File.ReadAllText(Path.Combine(serverRoot, "Microi.MQ", "RabbitMQ", "MicroiRabbitMQConsumer.cs"));

        Assert.Contains("AddOrUpdateHeader(\"traceparent\"", http);
        Assert.Contains("param[\"_TraceParent\"]", background);
        Assert.Contains("Microi.BackgroundTask", background);
        Assert.Contains("properties.Headers[\"traceparent\"]", publish);
        Assert.Contains("Microi.MQ.Consume", consume);
        Assert.Contains("RabbitMQ traceparent 与 envelope 不一致", consume);
    }

    [Fact]
    public void LogSignalSource_IsTenantBoundBoundedEscapedAndReturnsSanitizedSamples()
    {
        var serverRoot = FindServerRoot();
        var host = File.ReadAllText(Path.Combine(serverRoot, "Microi.net", "V8Engine", "V8Method.LogSignal.cs"));
        var mongo = File.ReadAllText(Path.Combine(serverRoot, "Microi.MongoDB", "V8MongoDB.cs"));
        var start = mongo.IndexOf("QuerySystemLogSignal", StringComparison.Ordinal);
        var end = mongo.IndexOf("PlanSystemLogLifecycle", start, StringComparison.Ordinal);
        var signal = mongo.Substring(start, end - start);

        Assert.Contains("RequireCurrentTenantSuperAdmin", host);
        Assert.Contains("OsClient = osClient", host);
        Assert.DoesNotContain("GetJsonString(request, \"OsClient\")", host);
        Assert.Contains("Math.Min(86400", host);
        Assert.Contains("TimeSpan.FromDays(1)", signal);
        Assert.Contains("Regex.Escape(param.Keyword.Trim())", signal);
        Assert.Contains(".Take(2)", signal);
        Assert.Contains("MaxDurationSamples", signal);
        Assert.Contains("MaxEventSamples", signal);
        Assert.Contains("Title = row.Title", signal);
        Assert.DoesNotContain("Content = row.Content", signal);
        Assert.DoesNotContain("Param = row.Param", signal);
        Assert.DoesNotContain("OtherInfo = row.OtherInfo", signal);
    }

    [Fact]
    public void ScheduledJobs_AreTenantScopedAtomicAndLegacyOwned()
    {
        var serverRoot = FindServerRoot();
        var scheduler = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.Job", "MicroiQuartzScheduledTask.cs"));
        var controller = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.net.Api", "Controllers", "JobController.cs"));

        Assert.Contains("GetTenantGroup", scheduler);
        Assert.Contains("JobBelongsToTenant", scheduler);
        Assert.Contains("legacyJob, osClient", scheduler);
        Assert.Contains("await _scheduler.ScheduleJob(job, trigger)", scheduler);
        Assert.DoesNotContain("await _scheduler.AddJob(job, true);\n\n                #endregion 新增job", scheduler);
        Assert.Contains("if (existingTrigger == null)", scheduler);
        Assert.Contains("await _scheduler.ScheduleJob(trigger)", scheduler);
        Assert.Contains("GetJobByName(jobNameList, osClient)", controller);
    }

    [Fact]
    public void ScheduledJobV8Atom_IsTenantAdminBoundAndOnlySchedulesPackagedEngines()
    {
        var serverRoot = FindServerRoot();
        var host = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.net", "V8Engine", "V8Method.ScheduleJob.cs"));
        var mcp = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.Core", "V8Engine", "V8McpLogic.cs"));
        var publisher = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.Upgrade", "Resource", "ai-app-publish-store.js"));
        var importer = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.Upgrade", "Resource", "import-package.js"));

        Assert.Contains("RequireCurrentTenantSuperAdmin", host);
        Assert.Contains("UserAccessKeySecurity.IsSession", File.ReadAllText(Path.Combine(
            serverRoot, "Microi.net", "V8Engine", "V8Method.cs")));
        Assert.Contains("request[\"OsClient\"] = osClient", host);
        Assert.Contains("request[\"JobType\"] = \"1\"", host);
        Assert.Contains("request.Remove(\"DllName\")", host);
        Assert.Contains("already exists", mcp);
        Assert.Contains("ScheduleJobs: selectedScheduleJobs", publisher);
        Assert.Contains("backgroundCheckpointPhase == 'ScheduleJobs'", importer);
        Assert.Contains("资源事务提交后幂等调度", importer);
    }

    private static string FindServerRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (File.Exists(Path.Combine(current.FullName, "Microi.Core", "Microi.Core.csproj"))
                && File.Exists(Path.Combine(current.FullName, "Microi.net.Api", "Microi.net.Api.csproj")))
                return current.FullName;
            var nested = Path.Combine(current.FullName, "Microi.Server");
            if (File.Exists(Path.Combine(nested, "Microi.Core", "Microi.Core.csproj"))
                && File.Exists(Path.Combine(nested, "Microi.net.Api", "Microi.net.Api.csproj")))
                return nested;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("未找到Microi.Server根目录。");
    }
}
