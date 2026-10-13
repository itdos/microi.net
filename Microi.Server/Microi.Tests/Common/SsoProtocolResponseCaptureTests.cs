using System.Reflection;
using Microi.net;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class SsoProtocolResponseCaptureTests
{
    [Fact]
    public async Task Redirect_UsesRealMvcExecutor_AndCapturesLocationAndNoStoreWithoutWritingSourceResponse()
    {
        using var services = CreateMvcServices();
        var source = CreateSourceContext(services);
        var runtime = new SsoProtocolRuntime();

        // 调用产品的捕获路径及真实 MVC 执行器，避免替身掩盖 UrlHelper 对路由上下文的要求。
        var response = await CaptureAsync(runtime, source, () =>
        {
            InvokePrivate(runtime, "SetNoStore");
            return Task.FromResult<IActionResult>(new RedirectResult("/fixture/protocol-result"));
        });

        Assert.Equal(StatusCodes.Status302Found, response.Value<int>("StatusCode"));
        Assert.Equal("/fixture/protocol-result", response["Headers"]!.Value<string>("Location"));
        Assert.Equal("no-store", response["Headers"]!.Value<string>("Cache-Control"));
        Assert.Equal("no-cache", response["Headers"]!.Value<string>("Pragma"));
        Assert.Equal(string.Empty, response.Value<string>("Body"));
        AssertSourceResponseUnchanged(source);
    }

    [Fact]
    public async Task Capture_PreservesExplicitPublicCaching_ForDiscoveryAndJwksResponses()
    {
        using var services = CreateMvcServices();
        var source = CreateSourceContext(services);
        var runtime = new SsoProtocolRuntime();

        var response = await CaptureAsync(runtime, source, () =>
        {
            var field = typeof(SsoProtocolRuntime).GetField("_controllerContext", BindingFlags.NonPublic | BindingFlags.Instance);
            Assert.NotNull(field);
            var context = Assert.IsType<ControllerContext>(field!.GetValue(runtime));
            context.HttpContext.Response.Headers.CacheControl = "public, max-age=300";
            return Task.FromResult<IActionResult>(new ContentResult
            {
                Content = "fixture-discovery", ContentType = "application/json", StatusCode = StatusCodes.Status200OK
            });
        });

        Assert.Equal(StatusCodes.Status200OK, response.Value<int>("StatusCode"));
        Assert.Equal("fixture-discovery", response.Value<string>("Body"));
        Assert.Equal("public, max-age=300", response["Headers"]!.Value<string>("Cache-Control"));
        Assert.Null(response["Headers"]!["Pragma"]);
        AssertSourceResponseUnchanged(source);
    }

    [Fact]
    public void Authorize_SetsNoStoreBeforeValidationOrRedirect()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && !File.Exists(Path.Combine(directory.FullName,
                   "Microi.Server", "Microi.SSO", "SsoProtocolRuntime.Oidc.cs")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        var source = File.ReadAllText(Path.Combine(directory!.FullName,
            "Microi.Server", "Microi.SSO", "SsoProtocolRuntime.Oidc.cs"));
        var method = source.IndexOf("public async Task<IActionResult> Authorize(", StringComparison.Ordinal);
        Assert.True(method >= 0);
        var bodyStart = source.IndexOf('{', method);
        Assert.StartsWith("SetNoStore();", source[(bodyStart + 1)..].TrimStart());
    }

    private static ServiceProvider CreateMvcServices()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers();
        return services.BuildServiceProvider();
    }

    private static DefaultHttpContext CreateSourceContext(IServiceProvider services)
    {
        var context = new DefaultHttpContext { RequestServices = services };
        context.Request.Scheme = "https";
        context.Request.Host = new HostString("fixture.example.test");
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static Task<JObject> CaptureAsync(
        SsoProtocolRuntime runtime, HttpContext source, Func<Task<IActionResult>> actionFactory)
    {
        var method = typeof(SsoProtocolRuntime).GetMethod("CaptureProtocolResponseAsync", BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.NotNull(method);
        return Assert.IsAssignableFrom<Task<JObject>>(method!.Invoke(runtime, [source, actionFactory]));
    }

    private static void InvokePrivate(SsoProtocolRuntime runtime, string name)
    {
        var method = typeof(SsoProtocolRuntime).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.NotNull(method);
        method!.Invoke(runtime, null);
    }

    private static void AssertSourceResponseUnchanged(HttpContext source)
    {
        Assert.Equal(StatusCodes.Status200OK, source.Response.StatusCode);
        Assert.Empty(source.Response.Headers);
        Assert.Equal(0, source.Response.Body.Length);
    }
}
