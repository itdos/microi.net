using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;

namespace Microi.net.Api
{
    /// <summary>
    /// HTTP 入口压力保护。超过并发阈值时直接返回 DosResult 风格 JSON，
    /// 避免请求继续进入控制器、V8、ORM 后把数据库和线程池拖垮。
    /// </summary>
    public sealed class RequestPressureGuardMiddleware
    {
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new ConcurrentDictionary<string, SemaphoreSlim>(StringComparer.OrdinalIgnoreCase);
        private static readonly HashSet<string> StaticExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".js", ".css", ".map", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".html", ".htm"
        };

        private readonly RequestDelegate _next;
        private readonly RequestPressureGuardOptions _options;

        public RequestPressureGuardMiddleware(RequestDelegate next, IConfiguration configuration)
        {
            _next = next;
            _options = RequestPressureGuardOptions.From(configuration);
        }

        public async Task InvokeAsync(HttpContext context)
        {
            if (!_options.Enabled || ShouldSkip(context))
            {
                await _next(context);
                return;
            }

            var acquired = new List<SemaphoreSlim>();
            var gates = BuildGateRequests(context);
            foreach (var item in gates)
            {
                var gate = Gates.GetOrAdd(item.Key, _ => new SemaphoreSlim(item.Limit, item.Limit));
                var entered = false;
                try
                {
                    entered = await gate.WaitAsync(TimeSpan.FromMilliseconds(item.WaitMilliseconds), context.RequestAborted).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                }

                if (!entered)
                {
                    Release(acquired);
                    await WriteBusyResponse(context, item).ConfigureAwait(false);
                    return;
                }

                acquired.Add(gate);
            }

            try
            {
                await _next(context).ConfigureAwait(false);
            }
            finally
            {
                Release(acquired);
            }
        }

        private List<GateRequest> BuildGateRequests(HttpContext context)
        {
            var path = context.Request.Path.Value ?? "";
            var osClient = ExtractOsClient(context);
            var apiEngineKey = ExtractApiEngineKey(path);
            var category = ResolveCategory(path);
            var routeKey = NormalizeRouteKey(path, category);
            var waitMilliseconds = IsLongRunningCategory(category)
                ? _options.LongRunningWaitMilliseconds
                : _options.WaitMilliseconds;
            var result = new List<GateRequest>
            {
                new GateRequest("global", _options.GlobalMaxConcurrentRequests, "Global", "系统当前请求较多，请稍后重试。")
            };

            if (!string.IsNullOrWhiteSpace(osClient))
            {
                result.Add(new GateRequest($"tenant:{osClient}", _options.TenantMaxConcurrentRequests, "Tenant", "当前租户请求较多，请稍后重试。"));
            }

            if (!string.IsNullOrWhiteSpace(routeKey))
            {
                result.Add(new GateRequest($"route:{routeKey}", _options.RouteMaxConcurrentRequests, "Route", "当前功能请求较多，请稍后重试。"));
            }

            if (category == "apiengine" || category == "v8")
            {
                result.Add(new GateRequest("v8:global", _options.V8GlobalMaxConcurrentRequests, "V8Global", "V8 引擎当前执行较多，请稍后重试。"));
                if (!string.IsNullOrWhiteSpace(osClient))
                {
                    result.Add(new GateRequest($"v8:tenant:{osClient}", _options.V8TenantMaxConcurrentRequests, "V8Tenant", "当前租户 V8 引擎执行较多，请稍后重试。"));
                }
            }

            if (!string.IsNullOrWhiteSpace(apiEngineKey))
            {
                var key = string.IsNullOrWhiteSpace(osClient) ? apiEngineKey : $"{osClient}:{apiEngineKey}";
                result.Add(new GateRequest($"apiengine:{key}", _options.ApiEngineMaxConcurrentRequests, "ApiEngine", $"接口引擎[{apiEngineKey}]当前执行较多，请稍后重试。"));
            }

            foreach (var item in result)
            {
                item.WaitMilliseconds = waitMilliseconds;
            }

            return result.Where(item => item.Limit > 0).ToList();
        }

        private static void Release(List<SemaphoreSlim> acquired)
        {
            for (var i = acquired.Count - 1; i >= 0; i--)
            {
                acquired[i].Release();
            }
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

        private string ExtractOsClient(HttpContext context)
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
            if (idx >= 0)
            {
                var start = idx + marker.Length;
                var end = raw.IndexOf("--", start, StringComparison.OrdinalIgnoreCase);
                if (end > start)
                {
                    return raw.Substring(start, end - start).Trim();
                }
            }

            return "";
        }

        private static string ExtractApiEngineKey(string path)
        {
            var value = (path ?? "").Trim('/');
            if (value.StartsWith("apiengine/", StringComparison.OrdinalIgnoreCase))
            {
                var parts = value.Split('/', StringSplitOptions.RemoveEmptyEntries);
                return parts.Length >= 2 ? parts[1] : "";
            }
            return "";
        }

        private static string ResolveCategory(string path)
        {
            path = path ?? "";
            if (path.StartsWith("/apiengine/", StringComparison.OrdinalIgnoreCase)) return "apiengine";
            if (path.StartsWith("/api/V8Engine/", StringComparison.OrdinalIgnoreCase) || path.StartsWith("/api/V8Debug/", StringComparison.OrdinalIgnoreCase)) return "v8";
            if (path.StartsWith("/api/FormEngine/", StringComparison.OrdinalIgnoreCase)) return "formengine";
            if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)) return "api";
            return "dynamic";
        }

        private static string NormalizeRouteKey(string path, string category)
        {
            var value = (path ?? "").Trim('/');
            if (string.IsNullOrWhiteSpace(value)) return "";
            var parts = value.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (category == "apiengine" && parts.Length >= 2) return $"apiengine/{parts[1]}";
            if (parts.Length >= 3 && parts[0].Equals("api", StringComparison.OrdinalIgnoreCase)) return $"{parts[0]}/{parts[1]}/{parts[2]}";
            if (parts.Length >= 2) return $"{parts[0]}/{parts[1]}";
            return parts[0];
        }

        private static bool IsLongRunningCategory(string category)
        {
            return string.Equals(category, "apiengine", StringComparison.OrdinalIgnoreCase)
                || string.Equals(category, "v8", StringComparison.OrdinalIgnoreCase);
        }

        private static string FirstNonBlank(params string[] values)
        {
            return values.FirstOrDefault(item => !string.IsNullOrWhiteSpace(item)) ?? "";
        }

        private async Task WriteBusyResponse(HttpContext context, GateRequest gate)
        {
            if (context.Response.HasStarted)
            {
                return;
            }

            context.Response.StatusCode = StatusCodes.Status200OK;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Headers["Retry-After"] = _options.RetryAfterSeconds.ToString();
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
                    RetryAfterSeconds = _options.RetryAfterSeconds
                }
            };
            await context.Response.WriteAsync(JsonConvert.SerializeObject(payload)).ConfigureAwait(false);
        }

        private sealed class GateRequest
        {
            public GateRequest(string key, int limit, string type, string message)
            {
                Key = key;
                Limit = limit;
                Type = type;
                Message = message;
                WaitMilliseconds = 0;
            }

            public string Key { get; }
            public int Limit { get; }
            public string Type { get; }
            public string Message { get; }
            public int WaitMilliseconds { get; set; }
        }
    }

    public sealed class RequestPressureGuardOptions
    {
        public bool Enabled { get; private set; } = true;
        public int GlobalMaxConcurrentRequests { get; private set; } = 2000;
        public int TenantMaxConcurrentRequests { get; private set; } = 600;
        public int RouteMaxConcurrentRequests { get; private set; } = 400;
        public int ApiEngineMaxConcurrentRequests { get; private set; } = 80;
        public int V8GlobalMaxConcurrentRequests { get; private set; } = 160;
        public int V8TenantMaxConcurrentRequests { get; private set; } = 40;
        public int WaitMilliseconds { get; private set; } = 10000;
        public int LongRunningWaitMilliseconds { get; private set; } = 300000;
        public int RetryAfterSeconds { get; private set; } = 3;

        public static RequestPressureGuardOptions From(IConfiguration configuration)
        {
            var options = new RequestPressureGuardOptions();
            options.Enabled = ReadBool(configuration, "PressureGuard:Enabled", "MICROI_PRESSURE_GUARD_ENABLED", true);
            options.GlobalMaxConcurrentRequests = ReadPositiveInt(configuration, "PressureGuard:GlobalMaxConcurrentRequests", "MICROI_PRESSURE_GLOBAL_MAX", options.GlobalMaxConcurrentRequests);
            options.TenantMaxConcurrentRequests = ReadPositiveInt(configuration, "PressureGuard:TenantMaxConcurrentRequests", "MICROI_PRESSURE_TENANT_MAX", options.TenantMaxConcurrentRequests);
            options.RouteMaxConcurrentRequests = ReadPositiveInt(configuration, "PressureGuard:RouteMaxConcurrentRequests", "MICROI_PRESSURE_ROUTE_MAX", options.RouteMaxConcurrentRequests);
            options.ApiEngineMaxConcurrentRequests = ReadPositiveInt(configuration, "PressureGuard:ApiEngineMaxConcurrentRequests", "MICROI_PRESSURE_APIENGINE_MAX", options.ApiEngineMaxConcurrentRequests);
            options.V8GlobalMaxConcurrentRequests = ReadPositiveInt(configuration, "PressureGuard:V8GlobalMaxConcurrentRequests", "MICROI_PRESSURE_V8_GLOBAL_MAX", options.V8GlobalMaxConcurrentRequests);
            options.V8TenantMaxConcurrentRequests = ReadPositiveInt(configuration, "PressureGuard:V8TenantMaxConcurrentRequests", "MICROI_PRESSURE_V8_TENANT_MAX", options.V8TenantMaxConcurrentRequests);
            options.WaitMilliseconds = ReadPositiveInt(configuration, "PressureGuard:WaitMilliseconds", "MICROI_PRESSURE_WAIT_MS", options.WaitMilliseconds);
            options.LongRunningWaitMilliseconds = ReadPositiveInt(configuration, "PressureGuard:LongRunningWaitMilliseconds", "MICROI_PRESSURE_LONG_RUNNING_WAIT_MS", options.LongRunningWaitMilliseconds);
            options.RetryAfterSeconds = ReadPositiveInt(configuration, "PressureGuard:RetryAfterSeconds", "MICROI_PRESSURE_RETRY_AFTER_SECONDS", options.RetryAfterSeconds);
            return options;
        }

        private static int ReadPositiveInt(IConfiguration configuration, string configKey, string envKey, int defaultValue)
        {
            var value = Environment.GetEnvironmentVariable(envKey);
            if (int.TryParse(value, out var parsed) && parsed > 0) return parsed;
            value = configuration?[configKey];
            if (int.TryParse(value, out parsed) && parsed > 0) return parsed;
            return defaultValue;
        }

        private static bool ReadBool(IConfiguration configuration, string configKey, string envKey, bool defaultValue)
        {
            var value = Environment.GetEnvironmentVariable(envKey);
            if (bool.TryParse(value, out var parsed)) return parsed;
            value = configuration?[configKey];
            if (bool.TryParse(value, out parsed)) return parsed;
            return defaultValue;
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
