using System.Reflection;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class BackgroundTaskPayloadTests
{
    [Fact]
    public void NotificationSummary_DoesNotSerializeHeavyExecutionPayloads()
    {
        var task = new BackgroundTaskItem
        {
            Id = "task-01",
            Title = "large export",
            Status = "Succeeded",
            Log = new string('L', 1_000_000),
            Result = new JObject
            {
                ["FileByteBase64"] = new string('A', 1_000_000),
                ["DownloadUrl"] = "/download/task-01"
            },
            CreateTime = DateTime.Now
        };
        var method = typeof(BackgroundTaskService).GetMethod(
            "ToSummary",
            BindingFlags.NonPublic | BindingFlags.Static);

        var summary = Assert.IsType<BackgroundTaskSummary>(method!.Invoke(null, [task]));
        var json = JsonConvert.SerializeObject(summary);

        Assert.True(summary.HasLog);
        Assert.True(summary.HasResult);
        Assert.DoesNotContain("FileByteBase64", json, StringComparison.Ordinal);
        Assert.DoesNotContain("\"Log\"", json, StringComparison.Ordinal);
        Assert.DoesNotContain("\"Result\"", json, StringComparison.Ordinal);
        Assert.True(json.Length < 2_000, $"summary unexpectedly grew to {json.Length} characters");
    }

    [Fact]
    public void DetailContract_StillExposesOwnerScopedLogAndResult()
    {
        var names = typeof(BackgroundTaskDetail)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(property => property.Name)
            .ToHashSet(StringComparer.Ordinal);

        Assert.Contains("Log", names);
        Assert.Contains("Result", names);
        Assert.Contains("Error", names);
        Assert.DoesNotContain("ParamJson", names);
        Assert.DoesNotContain("TrustedUserJson", names);
        Assert.DoesNotContain("CheckpointJson", names);
    }
}
