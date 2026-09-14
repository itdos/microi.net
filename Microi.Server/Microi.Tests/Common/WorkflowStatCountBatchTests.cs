using System.Reflection;
using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class WorkflowStatCountBatchTests
{
    [Fact]
    public async Task Stats_UsesOneExplicitIdentityBatchAndKeepsAllFiveBusinessCounts()
    {
        using var fixture = new Fixture();
        var result = await new WorkFlowLogic().GetWFStats(fixture.Param);
        Assert.Equal(1, result.Code);
        var data = JObject.FromObject((object)result.Data);
        Assert.Equal(new[] { 3, 2, 3, 4, 1, 5 }, new[] { "Value", "Todo", "Sender", "Done", "Copy", "Connect" }.Select(k => data[k]!.Value<int>()));
        Assert.Equal(5, ((JObject)data["Buttons"]!).Count);
        Assert.Equal(1, fixture.Probe.BatchCalls);
        Assert.Equal(0, fixture.Probe.LegacyCalls);
        Assert.Same(fixture.Param._CurrentUser, fixture.Probe.Identity);
        var queries = fixture.Probe.Queries!;
        Assert.Equal(4, queries.Count);
        Assert.All(queries, q => Assert.Null(q["_CurrentUser"]));
        Assert.All(queries, q => Assert.Equal("stats-test", q["OsClient"]!.Value<string>()));
        Assert.Equal("u1", queries[0]["_SearchEqual"]!["ReceiverId"]!.Value<string>());
        Assert.Equal("Todo", queries[0]["_SearchEqual"]!["WorkState"]!.Value<string>());
        Assert.Equal("u1", queries[1]["_SearchEqual"]!["SenderId"]!.Value<string>());
        Assert.Equal("HandlerUsers", queries[2]["_Where"]![0]!["Name"]!.Value<string>());
        Assert.Equal("NotHandlerUsers", queries[3]["_Where"]![0]!["Name"]!.Value<string>());
    }

    [Theory]
    [InlineData("count-denied")]
    [InlineData("copy-denied")]
    [InlineData("short-batch")]
    [InlineData("wrong-index")]
    public async Task Stats_FailsOnAnyCountOrCopyFailureWithoutReturningPartialSuccess(string failure)
    {
        using var fixture = new Fixture();
        fixture.Probe.Failure = failure;
        var result = await new WorkFlowLogic().GetWFStats(fixture.Param);
        Assert.Equal(0, result.Code);
        Assert.Null(result.Data);
    }

    [Fact]
    public async Task ThirdPartyFormEngine_KeepsLegacyCountsAndExplicitIdentity()
    {
        using var fixture = new Fixture(true);
        var result = await new WorkFlowLogic().GetWFStats(fixture.Param);
        Assert.Equal(1, result.Code);
        Assert.Equal(4, fixture.Probe.LegacyCalls);
        Assert.Equal(0, fixture.Probe.BatchCalls);
        Assert.Equal(3, JObject.FromObject((object)result.Data)["Value"]!.Value<int>());
    }

    private sealed class Fixture : IDisposable
    {
        private readonly FieldInfo provider = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        private readonly object? old;
        private readonly ServiceProvider services;
        public readonly Probe Probe;
        public readonly WFParam Param = new() { OsClient = "stats-test", _CurrentUser = new JObject { ["Id"] = "u1" } };
        public Fixture(bool legacy = false)
        {
            old = provider.GetValue(null);
            IFormEngine formEngine;
            if (legacy)
            {
                formEngine = DispatchProxy.Create<IFormEngine, LegacyProbe>();
                Probe = new Probe(); ((LegacyProbe)formEngine).Target = Probe;
            }
            else { formEngine = DispatchProxy.Create<IFormEngine, Probe>(); Probe = (Probe)formEngine; }
            services = new ServiceCollection().AddSingleton(formEngine).BuildServiceProvider();
            provider.SetValue(null, services);
        }
        public void Dispose() { provider.SetValue(null, old); services.Dispose(); }
    }

    public class Probe : DispatchProxy, IFormEngineReadOnlyCountRuntime
    {
        public int BatchCalls, LegacyCalls;
        public string? Failure;
        public JObject? Identity;
        public JArray? Queries;
        public Task<DosResultList<dynamic>> GetTableDataCountBatchForIdentityAsync(object queries, JObject currentUser, DbTrans? transaction = null)
        {
            BatchCalls++; Identity = currentUser; Queries = JArray.FromObject(queries);
            var count = Failure == "short-batch" ? 3 : 4;
            var data = Enumerable.Range(0, count).Select(i => (dynamic)new JObject { ["Index"] = Failure == "wrong-index" ? 9 : i,
                ["Code"] = Failure == "count-denied" && i == 2 ? 0 : 1, ["Count"] = i + 2, ["Msg"] = "count-denied" }).ToList();
            return Task.FromResult(new DosResultList<dynamic>(1, data));
        }
        protected override object? Invoke(MethodInfo? method, object?[]? args)
            => Forward(method, args);
        public object? Forward(MethodInfo? method, object?[]? args)
        {
            if (method!.Name == "GetTableDataCountAsync")
            {
                Assert.Equal("u1", JsonHelper.ToJObject(args![0])["_CurrentUser"]!["Id"]!.Value<string>());
                LegacyCalls++;
                return Task.FromResult(new DosResultList<dynamic>(1, null, "", LegacyCalls + 1));
            }
            if (method.Name == "GetTableDataAsync" && method.IsGenericMethod && method.GetGenericArguments()[0] == typeof(WFFlow))
                return Task.FromResult(new DosResultList<WFFlow>(Failure == "copy-denied" ? 0 : 1,
                    new List<WFFlow> { new() { CopyUsers = "[{\"Id\":\"u1\",\"IsRead\":false}]" } }, "copy-denied", 1));
            throw new InvalidOperationException("Unexpected FormEngine operation " + method.Name);
        }
    }
    public class LegacyProbe : DispatchProxy
    {
        public Probe Target = null!;
        protected override object? Invoke(MethodInfo? method, object?[]? args) => Target.Forward(method, args);
    }
}
