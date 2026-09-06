using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class AiImageBackgroundTaskTests
{
    [Fact]
    public void NodeWithoutImagePlugin_LeavesNativeImageJobsForCapableNodes()
    {
        var excluded = AiImageBackgroundTaskService.ExcludeUnsupportedWorkers(new[] { "busy-business-lane" }, false);
        Assert.Contains("busy-business-lane", excluded);
        Assert.Contains(AiImageBackgroundTaskService.WorkerApiEngineKey, excluded);
        Assert.Contains(AiImageBackgroundTaskService.ProviderWorkerApiEngineKey, excluded);
        Assert.DoesNotContain(AiImageBackgroundTaskService.WorkerApiEngineKey,
            AiImageBackgroundTaskService.ExcludeUnsupportedWorkers(new[] { "busy-business-lane" }, true));
        Assert.Equal("UnsupportedRuntime", JObject.FromObject(AiImageBackgroundTaskService.RuntimeUnavailable().Data)["Status"]?.ToString());
    }

    [Fact]
    public void PersistentKey_IsStableBoundedAndOwnerScoped()
    {
        var key = AiImageBackgroundTaskService.BuildTaskIdempotencyKey("tenant-a", "user-a", "image:001");
        Assert.Equal(key, AiImageBackgroundTaskService.BuildTaskIdempotencyKey("tenant-a", "user-a", "image:001"));
        Assert.NotEqual(key, AiImageBackgroundTaskService.BuildTaskIdempotencyKey("tenant-b", "user-a", "image:001"));
        Assert.NotEqual(key, AiImageBackgroundTaskService.BuildTaskIdempotencyKey("tenant-a", "user-b", "image:001"));
        Assert.InRange(key.Length, 1, 200);
        Assert.DoesNotContain("user-a", key);
    }

    [Fact]
    public void ImageWorkerKey_CannotBeReplacedByTenantEngine()
    {
        Assert.True(BackgroundTaskService.IsReservedNativeWorkerKey(AiImageBackgroundTaskService.WorkerApiEngineKey));
        Assert.True(BackgroundTaskService.IsReservedNativeWorkerKey(AiImageBackgroundTaskService.ProviderWorkerApiEngineKey));
    }

    [Fact]
    public void RelayWaitersCannotDeadlockTheirProviderOnSameNode()
    {
        var active = new[] { "tenant-a", "tenant-b", "tenant-c" }.Select(tenant => new BackgroundTaskLaneState
            { OsClient = tenant, ApiEngineKey = AiImageBackgroundTaskService.WorkerApiEngineKey }).ToArray();
        Assert.False(BackgroundTaskSchedulingPolicy.CanAdmit("tenant-d", AiImageBackgroundTaskService.WorkerApiEngineKey, active, 4));
        Assert.True(BackgroundTaskSchedulingPolicy.CanAdmit("tenant-a", AiImageBackgroundTaskService.ProviderWorkerApiEngineKey, active, 4));
        var excluded = BackgroundTaskSchedulingPolicy.ExcludedApiEngineKeys("tenant-d", active, 4);
        Assert.Contains(AiImageBackgroundTaskService.WorkerApiEngineKey, excluded);
        Assert.DoesNotContain(AiImageBackgroundTaskService.ProviderWorkerApiEngineKey, excluded);
    }

    [Theory]
    [InlineData("Pending")]
    [InlineData("Running")]
    [InlineData("Retrying")]
    public void PendingTask_IsPollableAndHasNoFabricatedImages(string status)
    {
        var result = AiImageBackgroundTaskService.Project(new BackgroundTaskSummary { Id = "task-a", Status = status }, null);
        Assert.Equal(2, result.Code);
        var data = JObject.FromObject(result.Data);
        Assert.Equal("task-a", data["TaskId"]?.ToString());
        Assert.Equal("MicroiBackgroundTask", data["StatusSource"]?.ToString());
        Assert.Null(data["Images"]);
    }

    [Fact]
    public void SuccessfulTask_RequiresActualImageResult()
    {
        var task = new BackgroundTaskSummary { Id = "task-a", Status = "Succeeded" };
        Assert.Equal(0, AiImageBackgroundTaskService.Project(task, new JObject { ["Code"] = 1 }).Code);
        var result = AiImageBackgroundTaskService.Project(task, JObject.Parse(
            "{\"Code\":1,\"Data\":{\"Images\":[{\"FilePath\":\"/owned/image.jpg\"}]}}"));
        Assert.Equal(1, result.Code);
        Assert.Equal("/owned/image.jpg", JObject.FromObject(result.Data)["Images"]?[0]?["FilePath"]?.ToString());
    }

    [Fact]
    public void KnownUpstreamFailure_PreservesCodeAndMessageOnReadback()
    {
        var record = JObject.Parse("{\"State\":\"Failed\",\"Fingerprint\":\"abc\",\"Error\":\"MiniMax 返回错误（1004）：验证失败\",\"Result\":{\"UpstreamCode\":1004}}");
        var result = MiniMaxImageStateSupport.Read(record, "abc");
        Assert.Equal(0, result.Code);
        Assert.Contains("1004", result.Msg);
        Assert.Equal(1004, JObject.FromObject(result.Data)["UpstreamCode"]?.Value<int>());
        Assert.Equal("Failed", JObject.FromObject(result.Data)["Status"]?.ToString());
    }

    [Theory]
    [InlineData("Uncertain", 0)]
    [InlineData("Generating", 2)]
    [InlineData("Failed", 0)]
    public void Replay_DistinguishesPendingFromTerminalUnknown(string state, int code)
    {
        var result = MiniMaxImageStateSupport.Read(new JObject { ["State"] = state, ["Fingerprint"] = "abc" }, "abc");
        Assert.Equal(code, result.Code);
        Assert.Equal("MicroiIdempotencyRecord", JObject.FromObject(result.Data)["StatusSource"]?.ToString());
    }

    [Fact]
    public void ChangedPromptCannotReplayAnExistingImage()
    {
        var result = MiniMaxImageStateSupport.Read(new JObject { ["State"] = "Succeeded", ["Fingerprint"] = "old" }, "new");
        Assert.Equal(0, result.Code);
        Assert.Equal("Conflict", JObject.FromObject(result.Data)["Status"]?.ToString());
    }

    [Theory]
    [InlineData(524, true)]
    [InlineData(504, true)]
    [InlineData(408, true)]
    [InlineData(429, false)]
    [InlineData(400, false)]
    [InlineData(401, false)]
    public void TransportTimeoutIsNotMisclassifiedAsKeywordRejection(int status, bool uncertain)
        => Assert.Equal(uncertain, MiniMaxImageStateSupport.IsAmbiguousHttpFailure(status));
}
