using Dos.Common;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class RealtimeResultMetadataTests
{
    [Fact]
    public void NoNotificationDoesNotVisitBusinessData()
    {
        var result = new PoisonResult();
        Assert.False(ApiEngineRealtimeRuntime.TryReadEvent(result, "iTdos", out _, out var error));
        Assert.Null(error);
        Assert.False(GameRealtimeRuntime.TryReadInvalidation(result, "iTdos", out _, out error));
        Assert.Null(error);
    }

    [Fact]
    public void ResultFamiliesRetainSuccessAndExplicitNotificationMetadata()
    {
        var append = JObject.Parse("""{"RealtimeEvent":{"EventId":"qa-metadata-1","ChannelKey":"order_updates","SubjectId":"order-1","Version":2,"EventType":"Updated","Data":{"Status":"Paid"}}} """);
        object[] results = [new DosResult(1, new PoisonData()) { DataAppend = append },
            new DosResult<object>(1, new PoisonData(), "", append),
            new { Code = 1, Data = new PoisonData(), DataAppend = append },
            new Dictionary<string, object> { ["Code"] = 1, ["Data"] = new PoisonData(), ["DataAppend"] = append },
            new AliasedResult { Status = 1, Metadata = append }];
        foreach (var result in results)
        {
            Assert.True(ApiEngineRealtimeRuntime.TryReadEvent(result, "iTdos", out var evt, out var error), error);
            Assert.Equal("Paid", evt.Data["Status"]); evt.Data["Status"] = "Changed";
            Assert.Equal("Paid", append["RealtimeEvent"]!["Data"]!["Status"]);
        }
    }

    [Fact]
    public void NoEventCostIsIndependentOfLargeResponse()
    {
        var data = new JArray(Enumerable.Range(0, 7403).Select(i => new JObject { ["Id"] = i, ["Text"] = new string('x', 128) }));
        var result = new DosResult(1, data);
        _ = RealtimeResultMetadata.Read(result);
        var before = GC.GetAllocatedBytesForCurrentThread();
        Assert.False(ApiEngineRealtimeRuntime.TryReadEvent(result, "iTdos", out _, out _));
        Assert.False(GameRealtimeRuntime.TryReadInvalidation(result, "iTdos", out _, out _));
        Assert.True(GC.GetAllocatedBytesForCurrentThread() - before < 64 * 1024);
        Assert.Equal(7403, data.Count);
    }

    private sealed class PoisonData { public string Value => throw new InvalidOperationException("Business Data must not be serialized by event detection."); }
    private sealed class PoisonResult { public int Code => 1; public object? DataAppend => null; public object Data => throw new InvalidOperationException("Do not read Data."); }
    private sealed class AliasedResult { [JsonProperty("Code")] public int Status { get; set; } [JsonProperty("DataAppend")] public object? Metadata { get; set; } public object Data => new PoisonData(); }
}
