using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class AiMusicBackgroundTaskTests
{
    [Fact]
    public void MusicAndImageWaitersShareCapacityAndLeaveProviderLaneFree()
    {
        var active = new[] { AiImageBackgroundTaskService.WorkerApiEngineKey, AiMusicBackgroundTaskService.WorkerApiEngineKey, AiMusicBackgroundTaskService.WorkerApiEngineKey }
            .Select((key, i) => new BackgroundTaskLaneState { OsClient = "tenant-" + i, ApiEngineKey = key }).ToArray();
        foreach (var key in new[] { AiImageBackgroundTaskService.WorkerApiEngineKey, AiMusicBackgroundTaskService.WorkerApiEngineKey })
        {
            Assert.False(BackgroundTaskSchedulingPolicy.CanAdmit("tenant-next", key, active, 4));
            Assert.Contains(key, BackgroundTaskSchedulingPolicy.ExcludedApiEngineKeys("tenant-next", active, 4));
        }
        Assert.True(BackgroundTaskSchedulingPolicy.CanAdmit("tenant-0", AiMusicBackgroundTaskService.ProviderWorkerApiEngineKey, active, 4));
        Assert.True(BackgroundTaskSchedulingPolicy.CanAdmit("tenant-1", AiImageBackgroundTaskService.ProviderWorkerApiEngineKey, active, 4));
    }

    [Fact]
    public void OldNodesCannotClaimMusicJobsAndTenantEnginesCannotReplaceWorkers()
    {
        var excluded = AiMusicBackgroundTaskService.ExcludeUnsupportedWorkers(new[] { "busy" }, false);
        foreach (var key in new[] { AiMusicBackgroundTaskService.WorkerApiEngineKey, AiMusicBackgroundTaskService.ProviderWorkerApiEngineKey })
        {
            Assert.Contains(key, excluded);
            Assert.True(BackgroundTaskService.IsReservedNativeWorkerKey(key));
        }
        Assert.Contains("busy", excluded);
        Assert.DoesNotContain(AiMusicBackgroundTaskService.WorkerApiEngineKey, AiMusicBackgroundTaskService.ExcludeUnsupportedWorkers(excludedKeys: null, musicRuntimeAvailable: true));
    }

    [Fact]
    public void StableRequestIdIsScopedToTenantAndUser()
    {
        var key = AiMusicBackgroundTaskService.BuildTaskIdempotencyKey("a", "user", "song");
        Assert.Equal(key, AiMusicBackgroundTaskService.BuildTaskIdempotencyKey("a", "user", "song"));
        Assert.NotEqual(key, AiMusicBackgroundTaskService.BuildTaskIdempotencyKey("b", "user", "song"));
        Assert.NotEqual(key, AiMusicBackgroundTaskService.BuildTaskIdempotencyKey("a", "other", "song"));
    }

    [Fact]
    public void SuccessRequiresPermanentPlayableFileAndFailuresKeepTheirDiagnosis()
    {
        var task = new BackgroundTaskSummary { Id = "task", Status = "Succeeded" };
        Assert.Equal(0, AiMusicBackgroundTaskService.Project(task, JObject.Parse("{\"Code\":1,\"Data\":{\"Permanent\":false,\"FileUrl\":\"https://temporary\"}}")).Code);
        Assert.Equal(1, AiMusicBackgroundTaskService.Project(task, JObject.Parse("{\"Code\":1,\"Data\":{\"Permanent\":true,\"FileUrl\":\"https://cdn/music.wav\"}}")).Code);
        task.Status = "Failed";
        var failed = AiMusicBackgroundTaskService.Project(task, JObject.Parse("{\"Code\":0,\"Msg\":\"HTTP 524\",\"Data\":{\"Status\":\"Uncertain\"}}"));
        Assert.Equal(0, failed.Code);
        Assert.Equal("HTTP 524", failed.Msg);
        Assert.Equal("Uncertain", JObject.FromObject(failed.Data)["Status"]!.ToString());
    }
}
