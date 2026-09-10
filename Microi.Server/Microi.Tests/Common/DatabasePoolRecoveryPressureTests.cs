using System.Reflection;
using Microi.net;
using Microsoft.AspNetCore.Http;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class DatabasePoolRecoveryPressureTests
{
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
