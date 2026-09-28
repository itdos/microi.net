using Microi.net.Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class HostLivenessMiddlewareTests
{
    [Fact]
    public async Task ActualHttp_LivenessReturnsBeforeBusinessRoute()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        await using var host = builder.Build();
        host.UseHostLiveness();
        host.MapGet("/apiengine/platform-service-health-extra", () => "business");
        await host.StartAsync(TestContext.Current.CancellationToken);
        var address = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        using var client = new HttpClient { BaseAddress = new Uri(address) };

        using var healthRequest = new HttpRequestMessage(HttpMethod.Get, "/apiengine/platform-service-health?OsClient=junchi");
        healthRequest.Headers.TryAddWithoutValidation("Origin", "http://127.0.0.1:61500");
        using var health = await client.SendAsync(healthRequest, TestContext.Current.CancellationToken);
        Assert.Equal(System.Net.HttpStatusCode.OK, health.StatusCode);
        Assert.Equal("*", health.Headers.GetValues("Access-Control-Allow-Origin").Single());
        var payload = JObject.Parse(await health.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Equal(1, payload.Value<int>("Code"));
        Assert.Equal("microi-api-host/health-v1", payload["Data"]?.Value<string>("HealthContract"));

        using var business = await client.GetAsync("/apiengine/platform-service-health-extra", TestContext.Current.CancellationToken);
        Assert.Equal("business", await business.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData("/apiengine/platform-service-health", "microi-api-host/health-v1")]
    [InlineData("/api/Diagnostics/health", "microi-api-host/health-v1")]
    [InlineData("/api/Diagnostics/liveness", "microi-api-host/liveness-v1")]
    [InlineData("/itdos-heart", "microi-api-host/health-v1")]
    public async Task ExactLivenessGet_ShortCircuitsBusinessPipeline(string path, string contract)
    {
        var nextCalled = false;
        var middleware = new HostLivenessMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        var context = new DefaultHttpContext();
        context.Request.Method = "GET";
        context.Request.Path = path;
        context.Request.QueryString = new QueryString("?OsClient=junchi");
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        Assert.Equal("no-store, no-cache, must-revalidate", context.Response.Headers.CacheControl.ToString());
        context.Response.Body.Position = 0;
        var payload = JObject.Parse(await new StreamReader(context.Response.Body).ReadToEndAsync());
        Assert.Equal(1, payload.Value<int>("Code"));
        Assert.Equal("Healthy", payload["Data"]?.Value<string>("Status"));
        Assert.Equal(contract, payload["Data"]?.Value<string>("HealthContract"));
    }

    [Theory]
    [InlineData("POST", "/apiengine/platform-service-health")]
    [InlineData("GET", "/apiengine/platform-service-health-extra")]
    [InlineData("GET", "/apiengine/some-business-engine")]
    public async Task OtherRequests_ContinueToBusinessPipeline(string method, string path)
    {
        var nextCalled = false;
        var middleware = new HostLivenessMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        await middleware.InvokeAsync(context);
        Assert.True(nextCalled);
    }
}
