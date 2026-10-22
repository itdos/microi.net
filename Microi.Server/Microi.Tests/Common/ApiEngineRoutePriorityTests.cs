using System.Net;
using Microi.net.Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.Tests.Common;

// 真实 ASP.NET 路由选择测试；不连接生产数据库。权威存储的缺失/失败/停用分类
// 另由 LegacyPlatformBootstrapCompatibilityTests 覆盖，此处验证同地址 endpoint 优先级。
public sealed class ApiEngineRoutePriorityTests
{
    [Theory]
    [InlineData("engine", 200, "engine")]
    [InlineData("missing", 200, "controller")]
    [InlineData("disabled", 403, "engine denied")]
    [InlineData("failed", 503, "engine unavailable")]
    public async Task ActualHttp_EngineFirst_ControllerOnlyForAbsence(string state, int status, string body)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddControllers().AddApplicationPart(typeof(PriorityFallbackController).Assembly);
        builder.Services.AddSingleton(new PriorityRouteState(state));
        builder.Services.AddTransient<PriorityRouteTransformer>();
        await using var host = builder.Build();
        host.UseRouting();
        host.MapDynamicControllerRoute<PriorityRouteTransformer>("{*path}", state: null, order: -99);
        host.MapControllers();
        await host.StartAsync(TestContext.Current.CancellationToken);
        var address = host.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
        using var client = new HttpClient { BaseAddress = new Uri(address) };
        using var response = await client.GetAsync("/api/License/GetManagementState");
        Assert.Equal(status, (int)response.StatusCode);
        Assert.Equal(body, await response.Content.ReadAsStringAsync());
        using var absent = await client.GetAsync("/api/no-engine/no-controller");
        Assert.Equal(HttpStatusCode.NotFound, absent.StatusCode);
        await host.StopAsync(TestContext.Current.CancellationToken);
    }
}

public sealed record PriorityRouteState(string Value);
public sealed class PriorityRouteTransformer(PriorityRouteState state) : DynamicRouteValueTransformer
{
    public override ValueTask<RouteValueDictionary> TransformAsync(HttpContext context, RouteValueDictionary values)
    {
        if (context.Request.Path != "/api/License/GetManagementState" || state.Value == "missing")
            return ValueTask.FromResult<RouteValueDictionary>(null!);
        return ValueTask.FromResult(new RouteValueDictionary { ["controller"] = "PriorityEngine", ["action"] = "Run" });
    }
}
[Route("api/[controller]/[action]")]
public sealed class PriorityEngineController(PriorityRouteState state) : Controller
{
    public IActionResult Run() => state.Value switch {
        "disabled" => StatusCode(403, "engine denied"),
        "failed" => StatusCode(503, "engine unavailable"),
        _ => Content("engine")
    };
}
public sealed class PriorityFallbackController : Controller
{
    [HttpGet("/api/License/GetManagementState")]
    public IActionResult Read() => Content("controller");
}
