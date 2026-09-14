using System.Reflection;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class FormEngineExplicitCountIdentityTests(ITestOutputHelper output)
{
    private static Task<List<DiyTableRowParam>> Prepare(FormEngine engine, object queries, JObject user)
    {
        var method = typeof(FormEngine).GetMethod("PrepareExplicitReadOnlyCountBatchAsync", BindingFlags.NonPublic | BindingFlags.Instance);
        // 在修复前程序集上走实际旧转换路径，以分配量证明回归而非只检查新增方法存在。
        if (method == null)
        {
            var legacy = ((System.Collections.IEnumerable)queries).Cast<object>().Select(query =>
            {
                var item = JsonHelper.ToJObject(query).Properties().ToDictionary(p => p.Name, p => (object)p.Value);
                item["_CurrentUser"] = user;
                return item;
            }).ToArray();
            return engine.DynamicToDiyTableRowParamList(legacy);
        }
        return (Task<List<DiyTableRowParam>>)method.Invoke(engine, new[] { queries, user })!;
    }

    [Fact]
    public async Task ExplicitBatch_CopiesLargeIdentityOnceAndPreservesCallerAndBusinessFields()
    {
        var engine = new FormEngine();
        var queries = new[] { new { OsClient = "count-test", FormEngineKey = "items", _Where = new JArray { new JArray("Status", "=", 1) } } };
        var user = new JObject { ["Id"] = "background-user", ["_RoleLimits"] = new JArray() };
        await Prepare(engine, queries, user);
        user["_RoleLimits"] = new JArray(Enumerable.Range(0, 7403).Select(i => new JObject { ["Id"] = i, ["Permission"] = "read" }));
        var before = GC.GetAllocatedBytesForCurrentThread();
        var comparison = user.DeepClone();
        var oneTreeBytes = GC.GetAllocatedBytesForCurrentThread() - before;
        var batch = Enumerable.Repeat(queries[0], 32).ToArray();
        before = GC.GetAllocatedBytesForCurrentThread();
        var result = await Prepare(engine, batch, user);
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        output.WriteLine($"Explicit count allocation: {allocated}; one identity: {oneTreeBytes}");
        GC.KeepAlive(comparison);
        Assert.True(allocated < oneTreeBytes * 1.5 + 1_000_000, $"Allocated {allocated:N0}; one identity {oneTreeBytes:N0}");
        Assert.All(result, item => Assert.Same(result[0]._CurrentUser, item._CurrentUser));
        Assert.NotSame(user, result[0]._CurrentUser);
        Assert.All(result, item => Assert.Equal("background-user", item._CurrentUser["Id"]!.Value<string>()));
        Assert.All(result, item => Assert.False(item._RowModel.ContainsKey("_CurrentUser")));
        result[0]._CurrentUser["_RoleLimits"]![0]!["Permission"] = "changed";
        Assert.Equal("read", user["_RoleLimits"]![0]!["Permission"]!.Value<string>());
        Assert.Equal(1, queries[0]._Where[0]![2]!.Value<int>());
        Assert.Equal(32, result.Count);
    }

    [Fact]
    public async Task ExplicitBatch_RejectsMissingIdentityAndBusinessIdentityOverride()
    {
        var engine = new FormEngine();
        Assert.IsAssignableFrom<IFormEngineReadOnlyCountRuntime>(engine);
        var runtime = (IFormEngineReadOnlyCountRuntime)engine;
        var queries = new[] { new { OsClient = "count-test", FormEngineKey = "items" } };
        Assert.Equal(0, (await runtime.GetTableDataCountBatchForIdentityAsync(queries, null!)).Code);
        Assert.Equal(0, (await runtime.GetTableDataCountBatchForIdentityAsync(queries, new JObject())).Code);
        var forged = new JArray(new JObject { ["OsClient"] = "count-test", ["_CurrentUser"] = new JObject { ["Id"] = "forged" } });
        Assert.Equal(0, (await runtime.GetTableDataCountBatchForIdentityAsync(forged, new JObject { ["Id"] = "real" })).Code);
    }

    [Fact]
    public async Task ExplicitBatch_PreservesClientProvenanceAndEnforcesV8Tenant()
    {
        var engine = new FormEngine();
        var user = new JObject { ["Id"] = "u1", ["_AccessKeySession"] = true,
            ["_AccessKeyAllowedTableNames"] = new JArray("items") };
        var client = await Prepare(engine, new[] { new DiyTableRowParam { OsClient = "count-test",
            FormEngineKey = "items", _InvokeType = "Client" } }, user);
        Assert.False(client[0]._TrustedServerInvocation);
        Assert.True(client[0]._CurrentUser["_AccessKeySession"]!.Value<bool>());
        using var tenant = V8TenantContext.Enter("count-test", "stats-test");
        var constrained = await Prepare(engine, new[] { new { OsClient = "foreign", FormEngineKey = "items" } }, user);
        Assert.Equal("count-test", constrained[0].OsClient);
        Assert.Equal("items", constrained[0]._CurrentUser["_AccessKeyAllowedTableNames"]![0]!.Value<string>());
    }

    [Fact]
    public async Task ExplicitBatch_EmptyAndOversizeKeepBoundedContract()
    {
        var engine = new FormEngine();
        Assert.IsAssignableFrom<IFormEngineReadOnlyCountRuntime>(engine);
        var runtime = (IFormEngineReadOnlyCountRuntime)engine;
        var user = new JObject { ["Id"] = "real" };
        var empty = await runtime.GetTableDataCountBatchForIdentityAsync(Array.Empty<object>(), user);
        Assert.Equal(1, empty.Code);
        Assert.Empty(empty.Data);
        var queries = Enumerable.Range(0, 65).Select(i => new { OsClient = "count-test", FormEngineKey = "items" }).ToArray();
        Assert.Equal(0, (await runtime.GetTableDataCountBatchForIdentityAsync(queries, user)).Code);
    }
}
