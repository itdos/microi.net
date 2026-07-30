using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 请求压力保护的运行时策略。宿主只需提供路径和租户，不依赖 HTTP 上下文。
    /// </summary>
    public static class RequestPressureGuardService
    {
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> Gates =
            new ConcurrentDictionary<string, SemaphoreSlim>(StringComparer.OrdinalIgnoreCase);

        public static async Task<RequestPressureLease> TryEnterAsync(
            string path,
            string osClient,
            RequestPressureGuardOptions options,
            CancellationToken cancellationToken)
        {
            if (options == null)
            {
                throw new ArgumentNullException(nameof(options));
            }

            var acquired = new List<SemaphoreSlim>();
            foreach (var item in BuildGateRequests(path, osClient, options))
            {
                var gateKey = $"{item.Key}:limit:{item.Limit}";
                var gate = Gates.GetOrAdd(gateKey, _ => new SemaphoreSlim(item.Limit, item.Limit));
                var entered = false;
                try
                {
                    entered = await gate.WaitAsync(
                        TimeSpan.FromMilliseconds(item.WaitMilliseconds),
                        cancellationToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                }

                if (!entered)
                {
                    Release(acquired);
                    return RequestPressureLease.Rejected(item);
                }

                acquired.Add(gate);
            }

            return RequestPressureLease.Entered(acquired);
        }

        private static IEnumerable<RequestPressureGate> BuildGateRequests(
            string path,
            string osClient,
            RequestPressureGuardOptions options)
        {
            path = path ?? "";
            osClient = (osClient ?? "").Trim();
            var apiEngineKey = ExtractApiEngineKey(path);
            var category = ResolveCategory(path);
            var routeKey = NormalizeRouteKey(path, category);
            var tenantOptions = GetTenantPressureOptions(osClient);
            var waitMilliseconds = IsLongRunningRequest(path, category)
                ? LowerPositive(options.LongRunningWaitMilliseconds, tenantOptions.LongRunningWaitMilliseconds)
                : LowerPositive(options.WaitMilliseconds, tenantOptions.WaitMilliseconds);

            var result = new List<RequestPressureGate>
            {
                new RequestPressureGate("global", options.GlobalMaxConcurrentRequests, "Global", "系统当前请求较多，正在排队处理，请稍后重试。")
            };

            if (!string.IsNullOrWhiteSpace(osClient))
            {
                result.Add(new RequestPressureGate(
                    $"tenant:{osClient}",
                    LowerPositive(options.TenantMaxConcurrentRequests, tenantOptions.TenantMaxConcurrentRequests),
                    "Tenant",
                    "当前租户请求较多，正在排队处理，请稍后重试。"));
            }

            if (!string.IsNullOrWhiteSpace(routeKey))
            {
                result.Add(new RequestPressureGate(
                    $"route:{routeKey}",
                    LowerPositive(options.RouteMaxConcurrentRequests, tenantOptions.RouteMaxConcurrentRequests),
                    "Route",
                    "当前功能请求较多，正在排队处理，请稍后重试。"));
            }

            if (category == "apiengine" || category == "v8")
            {
                result.Add(new RequestPressureGate(
                    "v8:global",
                    options.V8GlobalMaxConcurrentRequests,
                    "V8Global",
                    "V8 引擎当前执行较多，正在排队处理，请稍后重试。"));
                if (!string.IsNullOrWhiteSpace(osClient))
                {
                    result.Add(new RequestPressureGate(
                        $"v8:tenant:{osClient}",
                        LowerPositive(options.V8TenantMaxConcurrentRequests, tenantOptions.V8TenantMaxConcurrentRequests),
                        "V8Tenant",
                        "当前租户 V8 引擎执行较多，正在排队处理，请稍后重试。"));
                }
            }

            if (!string.IsNullOrWhiteSpace(apiEngineKey))
            {
                var key = string.IsNullOrWhiteSpace(osClient) ? apiEngineKey : $"{osClient}:{apiEngineKey}";
                result.Add(new RequestPressureGate(
                    $"apiengine:{key}",
                    LowerPositive(options.ApiEngineMaxConcurrentRequests, tenantOptions.ApiEngineMaxConcurrentRequests),
                    "ApiEngine",
                    $"接口引擎[{apiEngineKey}]当前执行较多，正在排队处理，请稍后重试。"));
            }

            foreach (var item in result)
            {
                item.WaitMilliseconds = waitMilliseconds;
            }

            return result.Where(item => item.Limit > 0);
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
                if (!OsClientExtend.ClientList.TryGetValue(osClient, out var client)
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

            return tenantValue > 0 && tenantValue < globalValue ? tenantValue : globalValue;
        }

        internal static void Release(IReadOnlyList<SemaphoreSlim> acquired)
        {
            for (var i = acquired.Count - 1; i >= 0; i--)
            {
                acquired[i].Release();
            }
        }

        private static string ExtractApiEngineKey(string path)
        {
            var value = (path ?? "").Trim('/');
            if (!value.StartsWith("apiengine/", StringComparison.OrdinalIgnoreCase))
            {
                return "";
            }

            var parts = value.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length >= 2 ? parts[1] : "";
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
            var parts = value.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
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

            return action.StartsWith("GetTableData", StringComparison.OrdinalIgnoreCase)
                || action.StartsWith("GetFormData", StringComparison.OrdinalIgnoreCase)
                || action.StartsWith("Add", StringComparison.OrdinalIgnoreCase)
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
            var parts = value.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 3 || !parts[0].Equals("api", StringComparison.OrdinalIgnoreCase)
                || !parts[1].Equals("FormEngine", StringComparison.OrdinalIgnoreCase))
            {
                return "";
            }

            var action = parts[2];
            var dashIndex = action.IndexOf('-');
            return dashIndex > 0 ? action.Substring(0, dashIndex) : action;
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

    public sealed class RequestPressureLease : IDisposable
    {
        private IReadOnlyList<SemaphoreSlim> _acquired;

        private RequestPressureLease(bool isEntered, IReadOnlyList<SemaphoreSlim> acquired, RequestPressureGate failedGate)
        {
            IsEntered = isEntered;
            _acquired = acquired;
            FailedGate = failedGate;
        }

        public bool IsEntered { get; }
        public RequestPressureGate FailedGate { get; }

        internal static RequestPressureLease Entered(IReadOnlyList<SemaphoreSlim> acquired)
        {
            return new RequestPressureLease(true, acquired, null);
        }

        internal static RequestPressureLease Rejected(RequestPressureGate failedGate)
        {
            return new RequestPressureLease(false, Array.Empty<SemaphoreSlim>(), failedGate);
        }

        public void Dispose()
        {
            var acquired = Interlocked.Exchange(ref _acquired, null);
            if (acquired != null)
            {
                RequestPressureGuardService.Release(acquired);
            }
        }
    }

    public sealed class RequestPressureGate
    {
        internal RequestPressureGate(string key, int limit, string type, string message)
        {
            Key = key;
            Limit = limit;
            Type = type;
            Message = message;
        }

        public string Key { get; }
        public int Limit { get; }
        public string Type { get; }
        public string Message { get; }
        internal int WaitMilliseconds { get; set; }
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

        public static RequestPressureGuardOptions FromConfiguration()
        {
            var options = new RequestPressureGuardOptions
            {
                Enabled = ConfigHelper.GetRuntimeConfigurationBool("PressureGuard:Enabled", true),
                GlobalMaxConcurrentRequests = ConfigHelper.GetRuntimeConfigurationInt("PressureGuard:GlobalMaxConcurrentRequests", 2000),
                TenantMaxConcurrentRequests = ConfigHelper.GetRuntimeConfigurationInt("PressureGuard:TenantMaxConcurrentRequests", 600),
                RouteMaxConcurrentRequests = ConfigHelper.GetRuntimeConfigurationInt("PressureGuard:RouteMaxConcurrentRequests", 400),
                ApiEngineMaxConcurrentRequests = ConfigHelper.GetRuntimeConfigurationInt("PressureGuard:ApiEngineMaxConcurrentRequests", 80),
                V8GlobalMaxConcurrentRequests = ConfigHelper.GetRuntimeConfigurationInt("PressureGuard:V8GlobalMaxConcurrentRequests", 128),
                V8TenantMaxConcurrentRequests = ConfigHelper.GetRuntimeConfigurationInt("PressureGuard:V8TenantMaxConcurrentRequests", 32),
                WaitMilliseconds = ConfigHelper.GetRuntimeConfigurationInt("PressureGuard:WaitMilliseconds", 10000),
                LongRunningWaitMilliseconds = ConfigHelper.GetRuntimeConfigurationInt("PressureGuard:LongRunningWaitMilliseconds", 1800000),
                RetryAfterSeconds = ConfigHelper.GetRuntimeConfigurationInt("PressureGuard:RetryAfterSeconds", 3)
            };
            return options;
        }
    }
}
