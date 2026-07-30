using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;

namespace Microi.net.Api
{
    /// <summary>
    /// 将 HTTP 请求转换为压力保护运行时参数，并负责输出协议响应。
    /// </summary>
    public sealed class RequestPressureGuardMiddleware
    {
        private static readonly HashSet<string> StaticExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".js", ".css", ".map", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".html", ".htm"
        };

        private readonly RequestDelegate _next;
        private readonly ProcessMemoryPressureState _memoryPressure;

        public RequestPressureGuardMiddleware(RequestDelegate next, ProcessMemoryPressureState memoryPressure)
        {
            _next = next;
            _memoryPressure = memoryPressure;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            if (_memoryPressure.RejectingRequests && !IsMemoryHealthPath(context.Request.Path.Value))
            {
                await WriteMemoryPressureResponse(context, _memoryPressure.GetSnapshot()).ConfigureAwait(false);
                return;
            }

            var options = RequestPressureGuardOptions.FromConfiguration();
            if (!options.Enabled || ShouldSkip(context))
            {
                await _next(context).ConfigureAwait(false);
                return;
            }

            using (var lease = await RequestPressureGuardService.TryEnterAsync(
                context.Request.Path.Value,
                ExtractOsClient(context),
                options,
                context.RequestAborted).ConfigureAwait(false))
            {
                if (!lease.IsEntered)
                {
                    await WriteBusyResponse(context, lease.FailedGate, options).ConfigureAwait(false);
                    return;
                }

                await _next(context).ConfigureAwait(false);
            }
        }

        private static bool IsMemoryHealthPath(string path)
        {
            return string.Equals(path, "/api/Diagnostics/health", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(path, "/api/Diagnostics/liveness", StringComparison.OrdinalIgnoreCase);
        }

        private static async Task WriteMemoryPressureResponse(
            HttpContext context,
            ProcessMemorySnapshot memory)
        {
            if (context.Response.HasStarted) return;
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Headers["Retry-After"] = "10";
            await context.Response.WriteAsync(JsonConvert.SerializeObject(new
            {
                Code = 0,
                Data = (object)null,
                Msg = "当前服务节点内存压力较高，已暂时停止接收新请求，请稍后重试。",
                DataCount = 0,
                DataAppend = new
                {
                    Busy = true,
                    LimitType = "ProcessMemory",
                    RetryAfterSeconds = 10,
                    PressureMetric = "ResidentSet",
                    ProcessMB = memory.ProcessBytes / (1024L * 1024L),
                    WorkingSetMB = memory.WorkingSetBytes / (1024L * 1024L),
                    PrivateAddressSpaceMB = memory.PrivateBytes / (1024L * 1024L),
                    ManagedHeapMB = memory.ManagedHeapBytes / (1024L * 1024L),
                    EffectiveMemoryMB = memory.EffectiveMemoryBytes / (1024L * 1024L),
                    memory.EffectiveMemorySource,
                    SoftLimitMB = memory.SoftLimitBytes / (1024L * 1024L),
                    HardLimitMB = memory.HardLimitBytes / (1024L * 1024L),
                    memory.SoftLimitPercent,
                    memory.HardLimitPercent,
                    memory.SampledAt
                }
            })).ConfigureAwait(false);
        }

        private static bool ShouldSkip(HttpContext context)
        {
            if (HttpMethods.IsOptions(context.Request.Method) || context.WebSockets.IsWebSocketRequest)
            {
                return true;
            }

            var path = context.Request.Path.Value ?? "";
            if (path.StartsWith("/diy-websocket", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/_framework", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/assets", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/favicon", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var ext = Path.GetExtension(path);
            return !string.IsNullOrWhiteSpace(ext) && StaticExtensions.Contains(ext);
        }

        private static string ExtractOsClient(HttpContext context)
        {
            var request = context.Request;
            var osClient = FirstNonBlank(
                request.Query["OsClient"].FirstOrDefault(),
                request.Query["osclient"].FirstOrDefault(),
                request.Headers["OsClient"].FirstOrDefault(),
                request.Headers["osclient"].FirstOrDefault(),
                request.Headers["X-OsClient"].FirstOrDefault());

            if (!string.IsNullOrWhiteSpace(osClient))
            {
                return osClient.Trim();
            }

            var raw = (request.Path.Value ?? "") + request.QueryString.Value;
            const string marker = "--OsClient--";
            var idx = raw.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (idx < 0)
            {
                return "";
            }

            var start = idx + marker.Length;
            var end = raw.IndexOf("--", start, StringComparison.OrdinalIgnoreCase);
            return end > start ? raw.Substring(start, end - start).Trim() : "";
        }

        private static string FirstNonBlank(params string[] values)
        {
            return values.FirstOrDefault(item => !string.IsNullOrWhiteSpace(item)) ?? "";
        }

        private static async Task WriteBusyResponse(
            HttpContext context,
            RequestPressureGate gate,
            RequestPressureGuardOptions options)
        {
            if (context.Response.HasStarted)
            {
                return;
            }

            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Headers["Retry-After"] = options.RetryAfterSeconds.ToString();
            var payload = new
            {
                Code = 0,
                Data = (object)null,
                Msg = gate.Message,
                DataCount = 0,
                DataAppend = new
                {
                    Busy = true,
                    LimitType = gate.Type,
                    RetryAfterSeconds = options.RetryAfterSeconds
                }
            };
            await context.Response.WriteAsync(JsonConvert.SerializeObject(payload)).ConfigureAwait(false);
        }
    }

    public static class RequestPressureGuardMiddlewareExtensions
    {
        public static IApplicationBuilder UseRequestPressureGuard(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<RequestPressureGuardMiddleware>();
        }
    }
}
