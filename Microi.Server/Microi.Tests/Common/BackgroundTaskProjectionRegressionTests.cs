using System.Reflection;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class BackgroundTaskProjectionRegressionTests
{
    [Theory]
    [InlineData("main", "Product", "Internet")]
    [InlineData("child", "Product", "Internal")]
    public void PlatformAppTask_ProjectsOnlyBoundedSummaryEvenWithLargePackages(
        string tenant, string runtimeType, string runtimeNetwork)
    {
        var payload = new string('X', 4_000_000);
        var record = new BackgroundTaskRecord
        {
            Id = "maintenance", OsClient = tenant, UserKey = "admin-test",
            ApiEngineKey = "bulk-import-microi-store-packages", Status = "Pending",
            Title = "平台应用全部安装/更新", CreateTime = DateTime.Now,
            Msg = payload, Log = payload,
            ParamJson = payload, ResultJson = payload, CheckpointJson = payload,
            TrustedUserJson = "{\"SecretMarker\":\"must-not-leave-runtime\"}",
            Result = new JObject { ["Package"] = payload }
        };
        var cache = DispatchProxy.Create<IMicroiCache, RecordingCache>();
        BackgroundTaskService.WriteSummaryProjection(cache, record, runtimeType, runtimeNetwork);
        var recorded = (RecordingCache)cache;
        var summary = Assert.IsType<BackgroundTaskSummary>(recorded.Value);
        Assert.Equal("maintenance", summary.Id);
        Assert.Equal(record.ApiEngineKey, summary.ApiEngineKey);
        Assert.True(summary.HasLog);
        Assert.True(summary.HasResult);
        Assert.Equal(2000, summary.Msg.Length);
        Assert.Equal($"Microi:{tenant}:BackgroundTaskSummaries:V2:{runtimeType}:{runtimeNetwork}:admin-test", recorded.Key);
        var json = JsonConvert.SerializeObject(recorded.Value);
        Assert.True(json.Length < 6000, $"Redis projection was {json.Length} characters");
        foreach (var forbidden in new[] { "ParamJson", "ResultJson", "CheckpointJson", "TrustedUserJson", "SecretMarker", "Package", "\"Log\"", "\"Result\"" })
            Assert.DoesNotContain(forbidden, json, StringComparison.Ordinal);
        Assert.Equal(payload, record.ParamJson);
        Assert.Equal(payload, record.Result["Package"]!.Value<string>());
    }

    [Fact]
    public void RollingUpgrade_UsesSeparateSummaryNamespaceForEachTenantUserAndRuntime()
    {
        var current = BackgroundTaskService.GetTaskHashKey("main", "admin", "Product", "Internal");
        Assert.NotEqual("Microi:main:BackgroundTasks:Product:Internal:admin", current);
        Assert.NotEqual(current, BackgroundTaskService.GetTaskHashKey("child", "admin", "Product", "Internal"));
        Assert.NotEqual(current, BackgroundTaskService.GetTaskHashKey("main", "other", "Product", "Internal"));
        Assert.NotEqual(current, BackgroundTaskService.GetTaskHashKey("main", "admin", "Product", "Internet"));
    }

    public class RecordingCache : DispatchProxy
    {
        public string? Key { get; private set; }
        public object? Value { get; private set; }
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            Assert.Equal("HashSet", method!.Name);
            Assert.Equal(typeof(BackgroundTaskSummary), method.GetGenericArguments().Single());
            Key = (string)args![0]!;
            Value = args[2];
            return true;
        }
    }
}
