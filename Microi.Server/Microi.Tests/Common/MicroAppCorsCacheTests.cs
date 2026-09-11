using Microi.net.Api;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;

namespace Microi.Tests.Common;

public class MicroAppCorsCacheTests
{
    [Theory]
    [InlineData("GET", "")]
    [InlineData("HEAD", "")]
    [InlineData("GET", "https://example.test")]
    [InlineData("HEAD", "https://example.test")]
    public void AssetResponsesVaryByOriginEvenWhenFirstRequestIsServerProbe(string method, string origin)
    {
        var http = new DefaultHttpContext();
        http.Request.Method = method;
        if (origin.Length > 0) http.Request.Headers.Origin = origin;
        http.Response.Headers.Vary = "Accept-Encoding";
        var controller = new MicroAppController { ControllerContext = new ControllerContext { HttpContext = http } };
        var context = new ActionExecutingContext(
            new ActionContext(http, new RouteData(), new ActionDescriptor()),
            new List<IFilterMetadata>(), new Dictionary<string, object?>(), controller);

        controller.OnActionExecuting(context);
        controller.OnActionExecuting(context);

        var vary = http.Response.Headers.Vary.ToString().Split(',').Select(s => s.Trim()).ToArray();
        Assert.Contains("Accept-Encoding", vary);
        Assert.Single(vary, s => s.Equals("Origin", StringComparison.OrdinalIgnoreCase));
        // Vary is a cache key, not a grant. The configured CORS policy still decides access.
        Assert.False(http.Response.Headers.ContainsKey("Access-Control-Allow-Origin"));
        Assert.False(http.Response.Headers.ContainsKey("Access-Control-Allow-Credentials"));
    }
}
