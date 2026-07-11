using System.Diagnostics;
using System.Threading.Tasks;
using Microi.net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;

namespace Microi.net.Api
{
    public sealed class SecurityGuardMiddleware
    {
        private readonly RequestDelegate _next;

        public SecurityGuardMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var options = SecurityGuardOptions.From();
            if (!options.Enabled || ShouldSkip(context))
            {
                await _next(context).ConfigureAwait(false);
                return;
            }

            var decision = SecurityGuardService.CheckBeforeRequest(context, options);
            if (decision.IsBlocked)
            {
                await WriteBlockedResponse(context, decision).ConfigureAwait(false);
                return;
            }

            var watch = Stopwatch.StartNew();
            try
            {
                await _next(context).ConfigureAwait(false);
            }
            finally
            {
                watch.Stop();
                SecurityGuardService.RecordAfterRequest(context, options, decision.Ip, watch.ElapsedMilliseconds);
            }
        }

        private static bool ShouldSkip(HttpContext context)
        {
            if (context.WebSockets.IsWebSocketRequest || HttpMethods.IsOptions(context.Request.Method))
            {
                return true;
            }

            var path = context.Request.Path.Value ?? "";
            return path.StartsWith("/diy-websocket", System.StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/swagger", System.StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/_framework", System.StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/assets", System.StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/favicon", System.StringComparison.OrdinalIgnoreCase);
        }

        private static async Task WriteBlockedResponse(HttpContext context, SecurityGuardDecision decision)
        {
            if (context.Response.HasStarted)
            {
                return;
            }

            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Headers["Retry-After"] = "60";
            var payload = new
            {
                Code = 0,
                Data = (object)null,
                Msg = "当前IP访问过于频繁，已被安全防护临时拦截，请稍后再试或联系管理员。",
                DataCount = 0,
                DataAppend = new
                {
                    SecurityBlocked = true,
                    decision.Ip,
                    decision.BlockedIp?.Reason,
                    decision.BlockedIp?.ExpiresAtUtc
                }
            };
            await context.Response.WriteAsync(JsonConvert.SerializeObject(payload)).ConfigureAwait(false);
        }
    }

    public static class SecurityGuardMiddlewareExtensions
    {
        public static IApplicationBuilder UseSecurityGuard(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<SecurityGuardMiddleware>();
        }
    }
}
