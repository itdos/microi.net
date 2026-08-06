using System;
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

            // UseForwardedHeaders 已在本中间件之前执行。若 RemoteIp 仍是当前容器
            // 精确发现的网桥网关，说明最后一跳没有提供可验证的客户端 IP；此时按
            // 网关封禁会让任意一个用户拖垮全站。仅记录审计，不进入 IP 自动封禁，
            // 后续请求压力与内存保护仍继续执行。
            if (ForwardedProxyTrustPolicy.IsContainerGatewayPeer(context.Connection.RemoteIpAddress))
            {
                var unattributedWatch = Stopwatch.StartNew();
                try
                {
                    await _next(context).ConfigureAwait(false);
                }
                finally
                {
                    unattributedWatch.Stop();
                    SecurityGuardService.RecordAuditOnly(
                        context,
                        options,
                        unattributedWatch.ElapsedMilliseconds);
                }
                return;
            }

            var profile = await SecurityGuardTrustResolver.ResolveAsync(context).ConfigureAwait(false);
            var decision = SecurityGuardService.CheckBeforeRequest(context, options, profile);
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
                context.Items[SecurityGuardRuntimePolicy.MatchedEndpointItemKey] =
                    context.GetEndpoint() != null;
                SecurityGuardService.RecordAfterRequest(context, options, decision, watch.ElapsedMilliseconds);
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

            var expiresAtUtc = decision.BlockedIp?.ExpiresAtUtc;
            var retryAfterSeconds = expiresAtUtc.HasValue
                ? Math.Max(1, (int)Math.Ceiling((expiresAtUtc.Value - DateTime.UtcNow).TotalSeconds))
                : 60;

            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Headers["Retry-After"] = retryAfterSeconds.ToString();
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
                    decision.BlockedIp?.ReasonKey,
                    decision.BlockedIp?.BlockedAtUtc,
                    SecurityScope = decision.BlockedIp?.SecurityScope ?? decision.SecurityScope,
                    StateBackend = decision.BlockedIp?.StateBackend ?? decision.StateBackend,
                    ExpiresAtUtc = expiresAtUtc,
                    RetryAfterSeconds = retryAfterSeconds,
                    AutoUnblock = true,
                    UnblockAdvice = "到期后会自动解除。需立即解除时，请从未被封禁的网络使用平台超级管理员进入系统日志的安全防护页解除该 IP；固定可信出口可谨慎加入 SaaS 引擎 SecurityWhitelistIps。",
                    DocumentationUrl = "https://microi.net/doc/more/security"
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
