using System.Reflection;
using Microi.net;
using Microsoft.AspNetCore.Http;
using System.Collections.Concurrent;
using System.Reflection;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class DatabasePoolRecoveryPressureTests
{
    [Fact]
    public async Task TenantV8Queue_DoesNotOccupyAnotherTenantsSharedV8Slot()
    {
        var tenant = "pressure-" + Guid.NewGuid().ToString("N");
        var apiKey = "isolation-" + Guid.NewGuid().ToString("N");
        var path = "/apiengine/" + apiKey;
        var options = new RequestPressureGuardOptions();
        var registry = (ConcurrentDictionary<string, SemaphoreSlim>)typeof(RequestPressureGuardService)
            .GetField("Gates", BindingFlags.NonPublic | BindingFlags.Static)!.GetValue(null)!;
        var ownKeys = new[]
        {
            $"apiengine:{tenant}:{apiKey}:limit:{options.ApiEngineMaxConcurrentRequests}",
            $"v8:tenant:{tenant}:limit:{options.V8TenantMaxConcurrentRequests}",
            $"tenant:{tenant}:limit:{options.TenantMaxConcurrentRequests}",
            $"route:apiengine/{apiKey}:limit:{options.RouteMaxConcurrentRequests}"
        };
        var limits = new[]
        {
            options.ApiEngineMaxConcurrentRequests, options.V8TenantMaxConcurrentRequests,
            options.TenantMaxConcurrentRequests, options.RouteMaxConcurrentRequests
        };
        var leases = new List<RequestPressureLease>();
        Assert.True(OsClientExtend.ClientList.TryAdd(tenant, new OsClientSecret { OsClient = tenant }));
        try
        {
            // 保证该测试在高基数注册表测试之后仍使用独立的真实租户槽。
            var sharedKey = $"v8:global:limit:{options.V8GlobalMaxConcurrentRequests}";
            registry.TryAdd(sharedKey, new SemaphoreSlim(options.V8GlobalMaxConcurrentRequests,
                options.V8GlobalMaxConcurrentRequests));
            registry.TryAdd($"global:limit:{options.GlobalMaxConcurrentRequests}",
                new SemaphoreSlim(options.GlobalMaxConcurrentRequests, options.GlobalMaxConcurrentRequests));
            for (var i = 0; i < ownKeys.Length; i++)
                Assert.True(registry.TryAdd(ownKeys[i], new SemaphoreSlim(limits[i], limits[i])));

            for (var i = 0; i < options.V8TenantMaxConcurrentRequests; i++)
            {
                var lease = await RequestPressureGuardService.TryEnterAsync(path, tenant, options, CancellationToken.None);
                Assert.True(lease.IsEntered);
                leases.Add(lease);
            }

            var shared = registry[sharedKey];
            var availableBeforeWait = shared.CurrentCount;
            using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            var waiting = RequestPressureGuardService.TryEnterAsync(path, tenant, options, cancel.Token);
            Assert.False(waiting.IsCompleted);
            Assert.Equal(availableBeforeWait, shared.CurrentCount);
            cancel.Cancel();
            using var rejected = await waiting;
            Assert.False(rejected.IsEntered);
        }
        finally
        {
            foreach (var lease in leases) lease.Dispose();
            foreach (var key in ownKeys) registry.TryRemove(key, out _);
            OsClientExtend.ClientList.TryRemove(tenant, out _);
        }
    }

    [Fact]
    public async Task PressureSnapshot_RecordsSaturatedGlobalGateAndWaitingRequest()
    {
        var options = RequestPressureGuardOptions.FromConfiguration();
        using var seed = await RequestPressureGuardService.TryEnterAsync("/api/test", "", options, CancellationToken.None);
        var gates = (System.Collections.IDictionary)typeof(RequestPressureGuardService).GetField("Gates", BindingFlags.NonPublic | BindingFlags.Static)!.GetValue(null)!;
        var gate = (SemaphoreSlim)gates["global:limit:" + options.GlobalMaxConcurrentRequests]!;
        var drained = 0;
        while (gate.Wait(0)) drained++;
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        try
        {
            var waiting = RequestPressureGuardService.TryEnterAsync("/api/test", "", options, cancellation.Token);
            var observed = SpinWait.SpinUntil(() =>
            {
                var snapshot = RequestPressureGuardService.Snapshot();
                return snapshot.Global.Active == options.GlobalMaxConcurrentRequests
                    && snapshot.Global.Waiting >= 1;
            }, TimeSpan.FromSeconds(1));
            Assert.True(observed);
            var metrics = Microi.net.Api.MemoryDiagnosticsMetrics.Read(AppContext.BaseDirectory, null);
            Assert.Equal(options.GlobalMaxConcurrentRequests, metrics.PressureGlobalActive);
            Assert.True(metrics.PressureGlobalWaiting >= 1);
            cancellation.Cancel();
            using var lease = await waiting;
            Assert.False(lease.IsEntered);
        }
        finally { cancellation.Cancel(); gate.Release(drained); }
    }

    [Theory]
    [InlineData("GET", "/apiengine/platform-service-health", true)]
    [InlineData("GET", "/api/Diagnostics/health", true)]
    [InlineData("GET", "/api/Diagnostics/liveness", true)]
    [InlineData("POST", "/apiengine/platform-service-health", false)]
    [InlineData("GET", "/apiengine/platform-service-health-extra", false)]
    public async Task SaturatedBusinessGate_DoesNotDelayExactLivenessGet(string method, string path, bool expectedBypass)
    {
        var options = RequestPressureGuardOptions.FromConfiguration();
        using var seed = await RequestPressureGuardService.TryEnterAsync("/api/test", "", options, CancellationToken.None);
        var gates = (System.Collections.IDictionary)typeof(RequestPressureGuardService).GetField("Gates", BindingFlags.NonPublic | BindingFlags.Static)!.GetValue(null)!;
        var gate = (SemaphoreSlim)gates["global:limit:" + options.GlobalMaxConcurrentRequests]!;
        var drained = 0;
        while (gate.Wait(0)) drained++;
        try
        {
            var entered = false;
            var middleware = new RequestPressureGuardMiddleware(_ => { entered = true; return Task.CompletedTask; },
                new ProcessMemoryPressureState(ProcessMemoryGuardOptions.CreateDefault()));
            var context = new DefaultHttpContext();
            context.Request.Method = method;
            context.Request.Path = path;
            context.Response.Body = new MemoryStream();
            using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(60));
            context.RequestAborted = timeout.Token;

            await middleware.InvokeAsync(context);

            Assert.Equal(expectedBypass, entered);
        }
        finally { gate.Release(drained); }
    }

    [Theory]
    [InlineData(true, "POST", true)]
    [InlineData(false, "POST", false)]
    [InlineData(true, "GET", false)]
    public async Task SaturatedBusinessGate_OnlyMatchedEmergencyPostUsesIndependentSlot(bool marked, string method, bool allowed)
    {
        var options = RequestPressureGuardOptions.FromConfiguration();
        using var seed = await RequestPressureGuardService.TryEnterAsync("/api/test", "", options, CancellationToken.None);
        var gates = (System.Collections.IDictionary)typeof(RequestPressureGuardService).GetField("Gates", BindingFlags.NonPublic | BindingFlags.Static)!.GetValue(null)!;
        var gate = (SemaphoreSlim)gates["global:limit:" + options.GlobalMaxConcurrentRequests]!;
        var drained = 0;
        while (gate.Wait(0)) drained++;
        try
        {
            var entered = false;
            var memory = new ProcessMemoryPressureState(ProcessMemoryGuardOptions.CreateDefault());
            var middleware = new RequestPressureGuardMiddleware(_ => { entered = true; return Task.CompletedTask; }, memory);
            var context = new DefaultHttpContext();
            context.Request.Method = method; context.Request.Path = "/api/Diagnostics/database-pools";
            context.Response.Body = new MemoryStream();
            if (marked) context.Items[typeof(DatabasePoolRecoveryEndpointAttribute)] = new DatabasePoolRecoveryEndpointAttribute();
            using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(60));
            context.RequestAborted = timeout.Token;
            await middleware.InvokeAsync(context);
            Assert.Equal(allowed, entered);
            if (!allowed)
            {
                context.Response.Body.Position = 0;
                var rejected = Newtonsoft.Json.Linq.JObject.Parse(await new StreamReader(context.Response.Body).ReadToEndAsync());
                Assert.Equal(0, rejected.Value<int>("Code"));
                Assert.Equal("Global", rejected["DataAppend"]!.Value<string>("LimitType"));
            }
        }
        finally { gate.Release(drained); }
    }
}
