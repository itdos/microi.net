using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class FormEngineParameterAllocationTests
{
    [Fact]
    public async Task IdentityNormalization_AllocatesOnlyOneIndependentPermissionTree()
    {
        var user = new JObject { ["Id"] = "user", ["_RoleLimits"] = new JArray(
            Enumerable.Range(0, 7403).Select(i => new JObject { ["Id"] = i, ["FkId"] = "menu-" + i, ["Permission"] = "read" })) };
        var engine = new FormEngine();
        await engine.DynamicToDiyTableRowParam(new JObject { ["OsClient"] = "tenant-a", ["_CurrentUser"] = new JObject { ["Id"] = "warmup" } });
        var input = new JObject { ["OsClient"] = "tenant-a", ["_CurrentUser"] = user };
        var before = GC.GetAllocatedBytesForCurrentThread();
        var clone = user.DeepClone();
        var cloneBytes = GC.GetAllocatedBytesForCurrentThread() - before;
        before = GC.GetAllocatedBytesForCurrentThread();
        var result = await engine.DynamicToDiyTableRowParam(input);
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        GC.KeepAlive(clone);
        Assert.True(allocated < cloneBytes * 1.5 + 250000,
            $"Normalization allocated {allocated:N0} bytes; one independent permission tree costs {cloneBytes:N0} bytes");
        Assert.NotSame(user, result._CurrentUser);
        result._CurrentUser["_RoleLimits"]![0]!["Permission"] = "changed";
        Assert.Equal("read", user["_RoleLimits"]![0]!["Permission"]!.Value<string>());
    }

    [Fact]
    public async Task Normalization_KeepsIdentityOutOfRowPayloadAndDoesNotMutateCaller()
    {
        var source = new JObject {
            ["OsClient"] = "tenant-a", ["FormEngineKey"] = "test", ["Name"] = "record",
            ["_CurrentUser"] = new JObject { ["Id"] = "user", ["_RoleLimits"] = new JArray(
                Enumerable.Range(0, 3000).Select(i => new JObject { ["Id"] = i, ["Permission"] = "read" })) }
        };
        var original = source.ToString();
        var engine = new FormEngine();
        var result = await engine.DynamicToDiyTableRowParam(source);
        Assert.False(result._RowModel.ContainsKey("_CurrentUser"));
        Assert.False(result._FormData.ContainsKey("_CurrentUser"));
        Assert.Equal("record", result._RowModel["Name"]!.Value<string>());
        Assert.Equal(3000, ((JArray)result._CurrentUser["_RoleLimits"]!).Count);
        Assert.Equal(original, source.ToString());
        result._CurrentUser["_RoleLimits"]![0]!["Permission"] = "changed";
        Assert.Equal(original, source.ToString());
        Assert.False(result._TrustedServerInvocation);
    }

    [Theory]
    [InlineData("_FormData")]
    [InlineData("_RowModel")]
    public async Task ExplicitRowPayload_PreservesBusinessFieldsAndIndependentChildren(string field)
    {
        var source = new JObject {
            ["OsClient"] = "tenant-a", ["_CurrentUser"] = new JObject { ["Id"] = "user" },
            [field] = new JObject { ["Name"] = "record", ["Extra"] = new JObject { ["Value"] = 3 } }
        };
        var original = source.ToString();
        var result = await new FormEngine().DynamicToDiyTableRowParam(source);
        Assert.Equal("record", result._RowModel["Name"]!.Value<string>());
        result._RowModel["Extra"]!["Value"] = 4;
        Assert.Equal(original, source.ToString());
    }
}
