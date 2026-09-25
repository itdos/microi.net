using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;

namespace Microi.net.Api;

/// <summary>
/// 在动态路由、租户安全解析及业务压力槽之前完成宿主存活检查，避免其它租户的故障掩盖 API 进程状态。
/// 此协议只表示进程存活，不检查 MongoDB 等依赖。
/// </summary>
public sealed class HostLivenessMiddleware
{
    private readonly RequestDelegate _next;

    public HostLivenessMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value;
        if (!Microi.net.HostLivenessPolicy.IsLivenessGet(context.Request.Method, path))
        {
            await _next(context).ConfigureAwait(false);
            return;
        }

        var contract = string.Equals(path, "/api/Diagnostics/liveness", System.StringComparison.OrdinalIgnoreCase)
            ? "microi-api-host/liveness-v1"
            : "microi-api-host/health-v1";
        context.Response.StatusCode = StatusCodes.Status200OK;
        context.Response.ContentType = "application/json; charset=utf-8";
        // This public, credential-free probe runs before UseCors so it stays
        // available when tenant routing is unhealthy. Allow the PC client to
        // read the fixed health response across origins.
        context.Response.Headers.AccessControlAllowOrigin = "*";
        context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
        context.Response.Headers.Pragma = "no-cache";
        context.Response.Headers.Expires = "0";
        await context.Response.WriteAsync(JsonConvert.SerializeObject(DiagnosticsController.BuildHealthyResult(contract)),
            context.RequestAborted).ConfigureAwait(false);
    }
}

public static class HostLivenessMiddlewareExtensions
{
    public static IApplicationBuilder UseHostLiveness(this IApplicationBuilder builder) =>
        builder.UseMiddleware<HostLivenessMiddleware>();
}
