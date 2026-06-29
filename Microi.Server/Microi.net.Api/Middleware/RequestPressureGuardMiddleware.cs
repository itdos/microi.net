using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// HTTP 入口并发保护。它只控制同时进入系统的数量，长任务会优先排队，
    /// 避免把压力继续传递到 V8、ORM 和数据库。
    /// </summary>
    public sealed class RequestPressureGuardMiddleware
    {
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates = new ConcurrentDictionary<string, SemaphoreSlim>(StringComparer.OrdinalIgnoreCase);
        private static readonly HashSet<string> StaticExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".js", ".css", ".map", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".html", ".htm"
        };

        private readonly RequestDelegate _next;
        private readonly IConfiguration _configuration;

        public RequestPressureGuardMiddleware(RequestDelegate next, IConfiguration configuration)
        {
            _next = next;
            _configuration = configuration;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var options = RequestPressureGuardOptions.From(_configuration);
            if (!options.Enabled || ShouldSkip(context))
            {
                await _next(context);
                return;
            }

            var acquired = new List<SemaphoreSlim>();
            var gates = BuildGateRequests(context, options);
            foreach (var item in gates)
            {
                var gateKey = $"{item.Key}:limit:{item.Limit}";
                var gate = Gates.GetOrAdd(gateKey, _ => new SemaphoreSlim(item.Limit, item.Limit));
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
                    await WriteBusyResponse(context, item, options).ConfigureAwait(false);
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

        private List<GateRequest> BuildGateRequests(HttpContext context, RequestPressureGuardOptions options)
        {
            var path = context.Request.Path.Value ?? "";
            var osClient = ExtractOsClient(context);
            var apiEngineKey = ExtractApiEngineKey(path);
            var category = ResolveCategory(path);
            var routeKey = NormalizeRouteKey(path, category);
            var tenantOptions = GetTenantPressureOptions(osClient);
            var waitMilliseconds = IsLongRunningRequest(path, category)
                ? LowerPositive(options.LongRunningWaitMilliseconds, tenantOptions.LongRunningWaitMilliseconds)
                : LowerPositive(options.WaitMilliseconds, tenantOptions.WaitMilliseconds);

            var result = new List<GateRequest>
            {
                new GateRequest("global", options.GlobalMaxConcurrentRequests, "Global", "系统当前请求较多，正在排队处理，请稍后重试。")
            };

            if (!string.IsNullOrWhiteSpace(osClient))
            {
                result.Add(new GateRequest(
                    $"tenant:{osClient}",
                    LowerPositive(options.TenantMaxConcurrentRequests, tenantOptions.TenantMaxConcurrentRequests),
                    "Tenant",
                    "当前租户请求较多，正在排队处理，请稍后重试。"));
            }

            if (!string.IsNullOrWhiteSpace(routeKey))
            {
                result.Add(new GateRequest(
                    $"route:{routeKey}",
                    LowerPositive(options.RouteMaxConcurrentRequests, tenantOptions.RouteMaxConcurrentRequests),
                    "Route",
                    "当前功能请求较多，正在排队处理，请稍后重试。"));
            }

            if (category == "apiengine" || category == "v8")
            {
                result.Add(new GateRequest("v8:global", options.V8GlobalMaxConcurrentRequests, "V8Global", "V8 引擎当前执行较多，正在排队处理，请稍后重试。"));
                if (!string.IsNullOrWhiteSpace(osClient))
                {
                    result.Add(new GateRequest(
                        $"v8:tenant:{osClient}",
                        LowerPositive(options.V8TenantMaxConcurrentRequests, tenantOptions.V8TenantMaxConcurrentRequests),
                        "V8Tenant",
                        "当前租户 V8 引擎执行较多，正在排队处理，请稍后重试。"));
                }
            }

            if (!string.IsNullOrWhiteSpace(apiEngineKey))
            {
                var key = string.IsNullOrWhiteSpace(osClient) ? apiEngineKey : $"{osClient}:{apiEngineKey}";
                result.Add(new GateRequest(
                    $"apiengine:{key}",
                    LowerPositive(options.ApiEngineMaxConcurrentRequests, tenantOptions.ApiEngineMaxConcurrentRequests),
                    "ApiEngine",
                    $"接口引擎[{apiEngineKey}]当前执行较多，正在排队处理，请稍后重试。"));
            }

            foreach (var item in result)
            {
                item.WaitMilliseconds = waitMilliseconds;
            }

            return result.Where(item => item.Limit > 0).ToList();
        }

        private static TenantPressureOptions GetTenantPressureOptions(string osClient)
        {
            var result = new TenantPressureOptions();
            if (string.IsNullOrWhiteSpace(osClient))
            {
                return result;
            }

            try
            {
                if (!Microi.net.OsClientExtend.ClientList.TryGetValue(osClient.Trim(), out var client)
                    || client?.OsClientModel == null)
                {
                    return result;
                }

                result.TenantMaxConcurrentRequests = ReadTenantInt(client.OsClientModel, "PressTenantMax", "PressureTenantMaxConcurrentRequests");
                result.RouteMaxConcurrentRequests = ReadTenantInt(client.OsClientModel, "PressRouteMax", "PressureRouteMaxConcurrentRequests");
                result.ApiEngineMaxConcurrentRequests = ReadTenantInt(client.OsClientModel, "PressApiMax", "PressureApiEngineMaxConcurrentRequests");
                result.V8TenantMaxConcurrentRequests = ReadTenantInt(client.OsClientModel, "PressV8ReqMax", "PressureV8TenantMaxConcurrentRequests");
                result.WaitMilliseconds = ReadTenantInt(client.OsClientModel, "PressureWaitMilliseconds");
                result.LongRunningWaitMilliseconds = ReadTenantInt(client.OsClientModel, "PressLongWaitMs", "PressureLongRunningWaitMilliseconds");
            }
            catch
            {
            }

            return result;
        }

        private static int ReadTenantInt(JObject model, params string[] fieldNames)
        {
            if (model == null || fieldNames == null)
            {
                return 0;
            }

            foreach (var fieldName in fieldNames)
            {
                var value = model[fieldName]?.ToString();
                if (int.TryParse(value, out var parsed) && parsed > 0)
                {
                    return parsed;
                }
            }

            return 0;
        }

        private static int LowerPositive(int globalValue, int tenantValue)
        {
            if (globalValue <= 0)
            {
                return tenantValue;
            }
            if (tenantValue > 0 && tenantValue < globalValue)
            {
                return tenantValue;
            }
            return globalValue;
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

        private static bool IsLongRunningRequest(string path, string category)
        {
            if (string.Equals(category, "apiengine", StringComparison.OrdinalIgnoreCase)
                || string.Equals(category, "v8", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (!string.Equals(category, "formengine", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            var action = ExtractFormEngineAction(path);
            if (string.IsNullOrWhiteSpace(action))
            {
                return false;
            }

            // 表单保存、删除、导入导出、批量处理可能触发后端 V8 或外部系统同步，
            // 需要长排队窗口；列表/详情/元数据读取保持普通窗口，避免页面查询被长任务拖住。
            return action.StartsWith("Add", StringComparison.OrdinalIgnoreCase)
                || action.StartsWith("Upt", StringComparison.OrdinalIgnoreCase)
                || action.StartsWith("Del", StringComparison.OrdinalIgnoreCase)
                || action.StartsWith("Save", StringComparison.OrdinalIgnoreCase)
                || action.StartsWith("Submit", StringComparison.OrdinalIgnoreCase)
                || action.StartsWith("Import", StringComparison.OrdinalIgnoreCase)
                || action.StartsWith("Export", StringComparison.OrdinalIgnoreCase)
                || action.StartsWith("Batch", StringComparison.OrdinalIgnoreCase)
                || action.IndexOf("Upload", StringComparison.OrdinalIgnoreCase) >= 0
                || action.IndexOf("Download", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string ExtractFormEngineAction(string path)
        {
            var value = (path ?? "").Trim('/');
            var parts = value.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 3 || !parts[0].Equals("api", StringComparison.OrdinalIgnoreCase)
                || !parts[1].Equals("FormEngine", StringComparison.OrdinalIgnoreCase))
            {
                return "";
            }

            var action = parts[2];
            var dashIndex = action.IndexOf('-');
            return dashIndex > 0 ? action.Substring(0, dashIndex) : action;
        }

        private static string FirstNonBlank(params string[] values)
        {
            return values.FirstOrDefault(item => !string.IsNullOrWhiteSpace(item)) ?? "";
        }

        private async Task WriteBusyResponse(HttpContext context, GateRequest gate, RequestPressureGuardOptions options)
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

        private sealed class TenantPressureOptions
        {
            public int TenantMaxConcurrentRequests { get; set; }
            public int RouteMaxConcurrentRequests { get; set; }
            public int ApiEngineMaxConcurrentRequests { get; set; }
            public int V8TenantMaxConcurrentRequests { get; set; }
            public int WaitMilliseconds { get; set; }
            public int LongRunningWaitMilliseconds { get; set; }
        }
    }

    public sealed class RequestPressureGuardOptions
    {
        public bool Enabled { get; private set; } = true;
        public int GlobalMaxConcurrentRequests { get; private set; } = 2000;
        public int TenantMaxConcurrentRequests { get; private set; } = 600;
        public int RouteMaxConcurrentRequests { get; private set; } = 400;
        public int ApiEngineMaxConcurrentRequests { get; private set; } = 80;
        public int V8GlobalMaxConcurrentRequests { get; private set; } = 128;
        public int V8TenantMaxConcurrentRequests { get; private set; } = 32;
        public int WaitMilliseconds { get; private set; } = 10000;
        public int LongRunningWaitMilliseconds { get; private set; } = 1800000;
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
            return ConfigHelper.GetEnvOrConfigurationInt(envKey, configKey, defaultValue);
        }

        private static bool ReadBool(IConfiguration configuration, string configKey, string envKey, bool defaultValue)
        {
            return ConfigHelper.GetEnvOrConfigurationBool(envKey, configKey, defaultValue);
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
