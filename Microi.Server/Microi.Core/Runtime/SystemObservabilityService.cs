using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.AspNetCore.Http;

namespace Microi.net
{
    /// <summary>
    /// 当前 API 节点的轻量请求观测器。
    ///
    /// 这里只保留分钟聚合、少量最近请求和正在执行的请求，不读取请求体、不保存
    /// Token/Cookie，也不把每次普通请求同步写入数据库。耗时和并发是 CPU 归因线索，
    /// 不是逐请求 CPU 采样；页面必须如实展示这个边界。
    /// </summary>
    public static class SystemObservabilityService
    {
        private const int RetentionMinutes = 30;
        private const int RecentRequestLimit = 500;
        private const int RouteCardinalityPerMinute = 2000;
        private const int IpCardinalityPerMinute = 5000;
        private const string OverflowRoute = "/other/high-cardinality";
        private const string OverflowIp = "other";
        private const string RequestStateItemKey = "Microi.SystemObservability.RequestState";
        private static readonly long[] DurationBounds = { 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, long.MaxValue };
        private static readonly Regex GuidSegment = new Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        private static readonly Regex UlidSegment = new Regex("^[0-9A-HJKMNP-TV-Z]{26}$", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        private static readonly Regex HexSegment = new Regex("^[0-9a-f]{24,64}$", RegexOptions.Compiled | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        private static readonly Regex NumericSegment = new Regex(@"^\d{4,}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex ApiEngineKeyPattern = new Regex("^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex OsClientPattern = new Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly ConcurrentDictionary<string, ActiveRequestState> Active =
            new ConcurrentDictionary<string, ActiveRequestState>(StringComparer.Ordinal);
        private static readonly ConcurrentDictionary<long, MinuteBucket> MinuteBuckets =
            new ConcurrentDictionary<long, MinuteBucket>();
        private static readonly ConcurrentQueue<CompletedRequestState> Recent =
            new ConcurrentQueue<CompletedRequestState>();
        private static readonly object CpuLock = new object();
        private static int _recentCount;
        private static long _completedSinceCleanup;
        private static DateTime _lastCpuSampleAtUtc = DateTime.MinValue;
        private static TimeSpan _lastProcessCpu = TimeSpan.Zero;
        private static double _lastProcessCpuRaw;
        private static double _lastProcessCpuNormalized;

        public static RequestObservabilityLease Begin(HttpContext context)
        {
            if (!ShouldTrack(context)) return null;
            var startedAtUtc = DateTime.UtcNow;
            var rawPath = Limit(context.Request.Path.Value ?? "/", 500);
            var normalizedRoute = NormalizeRoute(rawPath);
            var traceId = MicroiTraceContext.RequestTraceId(context);
            var key = string.IsNullOrWhiteSpace(traceId)
                ? Guid.NewGuid().ToString("N")
                : traceId + ":" + Guid.NewGuid().ToString("N").Substring(0, 8);
            var state = new ActiveRequestState
            {
                Key = key,
                TraceId = traceId,
                StartedAtUtc = startedAtUtc,
                Method = Limit(context.Request.Method, 16),
                Path = rawPath,
                Route = normalizedRoute,
                EndpointKind = ResolveEndpointKind(normalizedRoute),
                ApiEngineKey = ResolveApiEngineKey(normalizedRoute),
                Ip = NormalizeIp(SecurityGuardRuntimePolicy.GetConnectionIp(context)),
                RequestedOsClient = Limit(ExtractRequestedOsClient(context), 50),
                UserAgent = Limit(context.Request.Headers["User-Agent"].FirstOrDefault(), 300),
                IsDiagnostic = IsDiagnosticRoute(normalizedRoute)
            };
            Active[key] = state;
            context.Items[RequestStateItemKey] = state;
            return new RequestObservabilityLease(state);
        }

        /// <summary>
        /// 控制器完成参数绑定后，将已解析出的接口引擎 Key 和租户标注到当前请求。
        /// 这避免中间件读取 JSON/Form 请求体，同时让通用 /api/ApiEngine/Run 入口也能
        /// 按真实接口引擎聚合。只接受短标识，不接收业务参数。
        /// </summary>
        public static void AnnotateApiEngine(HttpContext context, string apiEngineKey, string osClient = "")
        {
            apiEngineKey = (apiEngineKey ?? "").Trim();
            if (!ApiEngineKeyPattern.IsMatch(apiEngineKey)) return;
            ExecutionObservation.Annotate(apiEngineKey, osClient);
            NetworkTrafficObservabilityService.AnnotateEndpoint(
                context,
                "/apiengine/" + apiEngineKey,
                "ApiEngine",
                apiEngineKey,
                osClient);
            if (context == null
                || !context.Items.TryGetValue(RequestStateItemKey, out var item)
                || !(item is ActiveRequestState state))
                return;
            state.ApiEngineKey = apiEngineKey;
            state.EndpointKind = "ApiEngine";
            state.Route = "/apiengine/" + apiEngineKey;
            state.IsDiagnostic = IsDiagnosticRoute(state.Route);
            osClient = (osClient ?? "").Trim();
            if (OsClientPattern.IsMatch(osClient)) state.RequestedOsClient = osClient;
        }

        /// <summary>
        /// 控制器完成参数绑定后，把通用 FormEngine 路由细分到受限的表单引擎 Key。
        /// 只记录短标识，不读取 Where、业务数据或请求体，避免诊断页把所有表查询
        /// 聚合成无法继续定位的 /api/FormEngine/GetTableData。
        /// </summary>
        public static void AnnotateFormEngine(HttpContext context, string formEngineKey, string action)
        {
            ExecutionObservation.Annotate(table: formEngineKey, stage: action);
            NetworkTrafficObservabilityService.AnnotateEndpoint(
                context,
                $"/api/FormEngine/{(action ?? "Request").Trim()}::{(formEngineKey ?? "").Trim()}",
                "FormEngine",
                "",
                "");
            if (context == null
                || !context.Items.TryGetValue(RequestStateItemKey, out var item)
                || !(item is ActiveRequestState state))
                return;
            formEngineKey = (formEngineKey ?? "").Trim();
            action = (action ?? "Request").Trim();
            if (!ApiEngineKeyPattern.IsMatch(formEngineKey)
                || !ApiEngineKeyPattern.IsMatch(action))
                return;
            state.EndpointKind = "FormEngine";
            state.ApiEngineKey = "";
            state.Route = $"/api/FormEngine/{action}::{formEngineKey}";
        }

        public static void AnnotateControllerResource(
            HttpContext context,
            string controller,
            string action,
            string resourceKey)
        {
            NetworkTrafficObservabilityService.AnnotateEndpoint(
                context,
                $"/api/{(controller ?? "").Trim()}/{(action ?? "").Trim()}::{(resourceKey ?? "").Trim()}",
                "Controller",
                "",
                "");
            if (context == null
                || !context.Items.TryGetValue(RequestStateItemKey, out var item)
                || !(item is ActiveRequestState state))
                return;
            controller = (controller ?? "").Trim();
            action = (action ?? "").Trim();
            resourceKey = (resourceKey ?? "").Trim();
            if (!ApiEngineKeyPattern.IsMatch(controller)
                || !ApiEngineKeyPattern.IsMatch(action)
                || !ApiEngineKeyPattern.IsMatch(resourceKey))
                return;
            state.EndpointKind = "Controller";
            state.ApiEngineKey = "";
            state.Route = $"/api/{controller}/{action}::{resourceKey}";
        }

        public static SystemObservabilitySnapshot GetSnapshot(int windowMinutes = 5, int top = 15)
        {
            windowMinutes = Bound(windowMinutes, 1, 15);
            top = Bound(top, 5, 50);
            var nowUtc = DateTime.UtcNow;
            var currentMinute = MinuteKey(nowUtc);
            var firstMinute = currentMinute - windowMinutes + 1;
            var buckets = MinuteBuckets
                .Where(item => item.Key >= firstMinute && item.Key <= currentMinute)
                .Select(item => item.Value)
                .ToList();

            var total = new MetricAggregate();
            var diagnostic = new MetricAggregate();
            var routeMetrics = new Dictionary<string, MetricAggregate>(StringComparer.OrdinalIgnoreCase);
            var ipMetrics = new Dictionary<string, MetricAggregate>(StringComparer.OrdinalIgnoreCase);
            foreach (var bucket in buckets)
            {
                total.Merge(bucket.Total.Snapshot());
                diagnostic.Merge(bucket.Diagnostics.Snapshot());
                foreach (var item in bucket.Routes)
                {
                    if (IsDiagnosticRoute(item.Key)) continue;
                    GetOrAdd(routeMetrics, item.Key).Merge(item.Value.Snapshot());
                }
                foreach (var item in bucket.Ips)
                {
                    GetOrAdd(ipMetrics, item.Key).Merge(item.Value.Snapshot());
                }
            }

            var allActive = Active.Values.ToArray();
            var active = allActive
                .Select(item => ToActiveSnapshot(item, nowUtc))
                .OrderByDescending(item => item.ElapsedMs)
                .Take(100)
                .ToList();
            var activeBusiness = active.Where(item => !item.IsDiagnostic).ToList();
            var windowSeconds = windowMinutes * 60d;
            var topEndpoints = BuildTopMetrics(routeMetrics, total.TotalElapsedMs, windowSeconds, top, true, activeBusiness);
            var topIps = BuildTopMetrics(ipMetrics, total.TotalElapsedMs, windowSeconds, top, false, activeBusiness);
            var process = BuildProcessSnapshot();
            var requests = new RequestWindowSnapshot
            {
                WindowMinutes = windowMinutes,
                RequestCount = total.Count,
                BusinessRequestCount = Math.Max(0, total.Count - diagnostic.Count),
                DiagnosticRequestCount = diagnostic.Count,
                ErrorCount = total.ErrorCount,
                SlowRequestCount = total.SlowCount,
                ErrorRate = total.Count == 0 ? 0 : Math.Round(total.ErrorCount * 100d / total.Count, 2),
                RequestsPerSecond = Math.Round(total.Count / windowSeconds, 3),
                AverageDurationMs = total.Count == 0 ? 0 : Math.Round(total.TotalElapsedMs / (double)total.Count, 2),
                P95DurationMs = total.Percentile95(),
                MaxDurationMs = total.MaxElapsedMs,
                ActiveRequestCount = allActive.Length,
                ActiveBusinessRequestCount = allActive.Count(item => !item.IsDiagnostic),
                SampledAtUtc = nowUtc
            };
            var recent = Recent.Reverse()
                .Where(item => item.CompletedAtUtc >= nowUtc.AddMinutes(-windowMinutes))
                .Take(100)
                .Select(ToCompletedSnapshot)
                .ToList();
            var snapshot = new SystemObservabilitySnapshot
            {
                Node = new ObservabilityNodeSnapshot
                {
                    NodeId = $"{Environment.MachineName}:{process.ProcessId}",
                    MachineName = Environment.MachineName,
                    ProcessId = process.ProcessId,
                    ProcessorCount = Environment.ProcessorCount,
                    Scope = "CurrentProcess",
                    WindowMinutes = windowMinutes,
                    SampledAtUtc = nowUtc
                },
                Process = process,
                Requests = requests,
                TopEndpoints = topEndpoints,
                TopIps = topIps,
                ActiveRequests = active,
                ActiveSampleTruncated = allActive.Length > active.Count,
                RecentRequests = recent,
                NetworkTraffic = NetworkTrafficObservabilityService.GetSnapshot(windowMinutes, top)
            };
            snapshot.Diagnosis = Diagnose(snapshot);
            return snapshot;
        }

        public static string NormalizeRoute(string path)
        {
            var raw = (path ?? "/").Trim();
            var queryIndex = raw.IndexOf('?');
            if (queryIndex >= 0) raw = raw.Substring(0, queryIndex);
            var tenantMarker = raw.IndexOf("--OsClient--", StringComparison.OrdinalIgnoreCase);
            if (tenantMarker >= 0) raw = raw.Substring(0, tenantMarker);
            var segments = raw.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length == 0) return "/";
            for (var i = 0; i < segments.Length; i++)
            {
                var segment = segments[i];
                if (GuidSegment.IsMatch(segment) || UlidSegment.IsMatch(segment)
                    || HexSegment.IsMatch(segment) || NumericSegment.IsMatch(segment)
                    || segment.Length > 80)
                {
                    segments[i] = "{id}";
                }
            }
            return Limit("/" + string.Join("/", segments), 300);
        }

        internal static void ResetForTests()
        {
            Active.Clear();
            MinuteBuckets.Clear();
            while (Recent.TryDequeue(out _)) { }
            _recentCount = 0;
            _completedSinceCleanup = 0;
            lock (CpuLock)
            {
                _lastCpuSampleAtUtc = DateTime.MinValue;
                _lastProcessCpu = TimeSpan.Zero;
                _lastProcessCpuRaw = 0;
                _lastProcessCpuNormalized = 0;
            }
        }

        private static bool ShouldTrack(HttpContext context)
        {
            if (context == null || context.WebSockets.IsWebSocketRequest || HttpMethods.IsOptions(context.Request.Method))
                return false;
            var path = context.Request.Path.Value ?? "";
            return path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/apiengine/", StringComparison.OrdinalIgnoreCase);
        }

        private static void Complete(ActiveRequestState state, HttpContext context, bool failed)
        {
            if (state == null) return;
            Active.TryRemove(state.Key, out _);
            var completedAtUtc = DateTime.UtcNow;
            var elapsedMs = Math.Max(0, Convert.ToInt64((completedAtUtc - state.StartedAtUtc).TotalMilliseconds));
            var statusCode = failed ? 500 : context?.Response?.StatusCode ?? 0;
            var isError = failed || statusCode >= 400;
            var bucket = MinuteBuckets.GetOrAdd(MinuteKey(completedAtUtc), _ => new MinuteBucket());
            bucket.Total.Add(elapsedMs, isError);
            if (state.IsDiagnostic) bucket.Diagnostics.Add(elapsedMs, isError);
            var routeKey = CardinalityKey(bucket.Routes, state.Route, RouteCardinalityPerMinute, OverflowRoute);
            bucket.Routes.GetOrAdd(routeKey, _ => new MetricAccumulator()).Add(elapsedMs, isError);
            var ipKey = CardinalityKey(bucket.Ips, state.Ip, IpCardinalityPerMinute, OverflowIp);
            bucket.Ips.GetOrAdd(ipKey, _ => new MetricAccumulator()).Add(elapsedMs, isError);
            Recent.Enqueue(new CompletedRequestState
            {
                CompletedAtUtc = completedAtUtc,
                Method = state.Method,
                Path = state.Path,
                Route = state.Route,
                EndpointKind = state.EndpointKind,
                ApiEngineKey = state.ApiEngineKey,
                Ip = state.Ip,
                RequestedOsClient = state.RequestedOsClient,
                TraceId = state.TraceId,
                StatusCode = statusCode,
                ElapsedMs = elapsedMs,
                IsDiagnostic = state.IsDiagnostic
            });
            Interlocked.Increment(ref _recentCount);
            while (Volatile.Read(ref _recentCount) > RecentRequestLimit && Recent.TryDequeue(out _))
                Interlocked.Decrement(ref _recentCount);
            if (Interlocked.Increment(ref _completedSinceCleanup) % 256 == 0) Prune(completedAtUtc);
        }

        private static void Prune(DateTime nowUtc)
        {
            var expireBefore = MinuteKey(nowUtc) - RetentionMinutes;
            foreach (var item in MinuteBuckets)
                if (item.Key < expireBefore) MinuteBuckets.TryRemove(item.Key, out _);
        }

        private static ProcessRuntimeSnapshot BuildProcessSnapshot()
        {
            var snapshot = new ProcessRuntimeSnapshot();
            try
            {
                using (var process = Process.GetCurrentProcess())
                {
                    process.Refresh();
                    snapshot.ProcessId = process.Id;
                    snapshot.ProcessName = process.ProcessName;
                    snapshot.StartedAt = process.StartTime;
                    snapshot.UptimeSeconds = Math.Max(0, Convert.ToInt64((DateTime.Now - process.StartTime).TotalSeconds));
                    snapshot.WorkingSetMB = Math.Round(process.WorkingSet64 / 1024d / 1024d, 2);
                    snapshot.PrivateMemoryMB = Math.Round(process.PrivateMemorySize64 / 1024d / 1024d, 2);
                    snapshot.ManagedHeapMB = Math.Round(GC.GetTotalMemory(false) / 1024d / 1024d, 2);
                    snapshot.ProcessThreadCount = process.Threads.Count;
                    lock (CpuLock)
                    {
                        var nowUtc = DateTime.UtcNow;
                        var totalCpu = process.TotalProcessorTime;
                        if (_lastCpuSampleAtUtc != DateTime.MinValue)
                        {
                            var wallMs = (nowUtc - _lastCpuSampleAtUtc).TotalMilliseconds;
                            var cpuMs = (totalCpu - _lastProcessCpu).TotalMilliseconds;
                            if (wallMs > 0 && cpuMs >= 0)
                            {
                                _lastProcessCpuRaw = Math.Max(0, Math.Round(cpuMs / wallMs * 100d, 2));
                                _lastProcessCpuNormalized = Math.Max(0, Math.Round(_lastProcessCpuRaw / Math.Max(1, Environment.ProcessorCount), 2));
                            }
                        }
                        _lastCpuSampleAtUtc = nowUtc;
                        _lastProcessCpu = totalCpu;
                        snapshot.ProcessCpuPercentRaw = _lastProcessCpuRaw;
                        snapshot.ProcessCpuPercentNormalized = _lastProcessCpuNormalized;
                    }
                }
            }
            catch (Exception ex)
            {
                snapshot.Error = ex.Message;
            }
            ThreadPool.GetAvailableThreads(out var availableWorkers, out var availableIo);
            ThreadPool.GetMaxThreads(out var maxWorkers, out var maxIo);
            ThreadPool.GetMinThreads(out var minWorkers, out var minIo);
            snapshot.ThreadPoolAvailableWorkers = availableWorkers;
            snapshot.ThreadPoolMaxWorkers = maxWorkers;
            snapshot.ThreadPoolMinWorkers = minWorkers;
            snapshot.ThreadPoolAvailableIo = availableIo;
            snapshot.ThreadPoolMaxIo = maxIo;
            snapshot.ThreadPoolMinIo = minIo;
            snapshot.Gen0Collections = GC.CollectionCount(0);
            snapshot.Gen1Collections = GC.CollectionCount(1);
            snapshot.Gen2Collections = GC.CollectionCount(2);
            return snapshot;
        }

        private static List<TopRequestMetric> BuildTopMetrics(
            Dictionary<string, MetricAggregate> source,
            long totalElapsedMs,
            double windowSeconds,
            int top,
            bool endpoint,
            List<ActiveRequestSnapshot> active)
        {
            return source.Select(item => new TopRequestMetric
                {
                    Key = item.Key,
                    Route = endpoint ? item.Key : "",
                    Ip = endpoint ? "" : item.Key,
                    EndpointKind = endpoint ? ResolveEndpointKind(item.Key) : "ClientIp",
                    ApiEngineKey = endpoint ? ResolveApiEngineKey(item.Key) : "",
                    RequestCount = item.Value.Count,
                    ErrorCount = item.Value.ErrorCount,
                    SlowRequestCount = item.Value.SlowCount,
                    ErrorRate = item.Value.Count == 0 ? 0 : Math.Round(item.Value.ErrorCount * 100d / item.Value.Count, 2),
                    RequestsPerSecond = Math.Round(item.Value.Count / windowSeconds, 3),
                    TotalElapsedMs = item.Value.TotalElapsedMs,
                    AverageDurationMs = item.Value.Count == 0 ? 0 : Math.Round(item.Value.TotalElapsedMs / (double)item.Value.Count, 2),
                    P95DurationMs = item.Value.Percentile95(),
                    MaxDurationMs = item.Value.MaxElapsedMs,
                    CostSharePercent = totalElapsedMs <= 0 ? 0 : Math.Round(item.Value.TotalElapsedMs * 100d / totalElapsedMs, 2),
                    ActiveCount = endpoint
                        ? active.Count(request => string.Equals(request.Route, item.Key, StringComparison.OrdinalIgnoreCase))
                        : active.Count(request => string.Equals(request.Ip, item.Key, StringComparison.OrdinalIgnoreCase))
                })
                .OrderByDescending(item => item.TotalElapsedMs)
                .ThenByDescending(item => item.RequestCount)
                .Take(top)
                .ToList();
        }

        private static ObservabilityDiagnosis Diagnose(SystemObservabilitySnapshot snapshot)
        {
            var result = new ObservabilityDiagnosis
            {
                Severity = "Info",
                Confidence = "Low",
                Summary = "当前节点未观察到足以直接归因的高 CPU 信号。",
                Boundary = "接口耗时、请求量和并发是归因线索，不是逐请求 CPU 采样；多实例部署时本页只代表当前命中的 API 节点。"
            };
            var cpu = snapshot.Process.ProcessCpuPercentNormalized;
            var rawCpu = snapshot.Process.ProcessCpuPercentRaw;
            var top = snapshot.TopEndpoints.FirstOrDefault();
            if (IsProcessCpuHigh(cpu))
            {
                result.Severity = cpu >= 90 ? "Critical" : "Warning";
                result.Confidence = top != null && top.RequestCount >= 5 ? "Medium" : "Low";
                result.Summary = top == null
                    ? $"当前 API 进程 CPU 较高（主机归一化 {cpu:0.##}% / 多核原始 {rawCpu:0.##}%），但窗口内请求样本不足。"
                    : $"当前 API 进程 CPU 较高；耗时贡献最高的是 {top.Key}，占窗口请求总耗时 {top.CostSharePercent:0.##}%。";
                result.Signals.Add(new DiagnosisSignal
                {
                    Code = "PROCESS_CPU_HIGH",
                    Severity = result.Severity,
                    Title = "API 进程 CPU 较高",
                    Detail = $"归一化 {cpu:0.##}%，多核原始 {rawCpu:0.##}%。"
                });
            }
            if (snapshot.Requests.ActiveBusinessRequestCount >= Math.Max(8, Environment.ProcessorCount * 2))
            {
                result.Severity = result.Severity == "Critical" ? "Critical" : "Warning";
                result.Confidence = "Medium";
                result.Signals.Add(new DiagnosisSignal
                {
                    Code = "ACTIVE_REQUESTS_HIGH",
                    Severity = "Warning",
                    Title = "并发请求堆积",
                    Detail = $"当前有 {snapshot.Requests.ActiveBusinessRequestCount} 个业务请求仍在执行。"
                });
            }
            if (top != null && top.CostSharePercent >= 50 && top.RequestCount >= 5)
            {
                result.Confidence = IsProcessCpuHigh(cpu) ? "High" : "Medium";
                result.Signals.Add(new DiagnosisSignal
                {
                    Code = "HOT_ENDPOINT_CONCENTRATED",
                    Severity = top.AverageDurationMs >= 1000 ? "Warning" : "Info",
                    Title = "热点接口集中",
                    Detail = $"{top.Key} 请求 {top.RequestCount} 次，平均 {top.AverageDurationMs:0.##}ms，P95 {top.P95DurationMs:0.##}ms。"
                });
            }
            if (rawCpu >= 100 && !IsProcessCpuHigh(cpu))
            {
                result.Signals.Add(new DiagnosisSignal
                {
                    Code = "MULTICORE_CPU_CONTEXT",
                    Severity = "Info",
                    Title = "多核原始 CPU 超过 100% 不等于整机过载",
                    Detail = $"当前约使用 {rawCpu / 100d:0.##} 个逻辑核；按 {Math.Max(1, Environment.ProcessorCount)} 核归一化后为 {cpu:0.##}%，未达到 70% 高负载阈值。"
                });
            }
            if (snapshot.Requests.ErrorRate >= 10 && snapshot.Requests.RequestCount >= 20)
            {
                result.Signals.Add(new DiagnosisSignal
                {
                    Code = "ERROR_RATE_HIGH",
                    Severity = "Warning",
                    Title = "异常率偏高",
                    Detail = $"窗口错误率 {snapshot.Requests.ErrorRate:0.##}%，可能存在失败重试或攻击流量。"
                });
            }
            if (snapshot.Process.ThreadPoolMaxWorkers > 0
                && snapshot.Process.ThreadPoolAvailableWorkers < Math.Max(4, snapshot.Process.ThreadPoolMaxWorkers / 20))
            {
                result.Signals.Add(new DiagnosisSignal
                {
                    Code = "THREADPOOL_LOW",
                    Severity = "Warning",
                    Title = "线程池余量偏低",
                    Detail = $"可用工作线程 {snapshot.Process.ThreadPoolAvailableWorkers}/{snapshot.Process.ThreadPoolMaxWorkers}。"
                });
            }
            if (result.Signals.Count == 0)
            {
                result.Signals.Add(new DiagnosisSignal
                {
                    Code = "NOT_REPRODUCED",
                    Severity = "Info",
                    Title = "当前未复现高负载",
                    Detail = "请在 NAS 再次显示高 CPU 时保持本页自动刷新，并核对容器/反向代理是否命中同一节点。"
                });
            }
            result.Recommendations.Add("先按热点接口、来源 IP、活动请求和 TraceId 交叉定位，再查看对应系统日志；不要仅凭单次 HTTP 200 判断正常。");
            result.Recommendations.Add("若本页进程 CPU 低而 NAS 容器 CPU 高，请核对容器内实际版本、实例/节点和采样时段，并检查数据库慢查询与宿主机指标。");
            result.Recommendations.Add("高频来源先确认是否可信代理、轮询或爬虫，再决定限流/封禁；不要直接封禁容器网桥网关。"
            );
            return result;
        }

        internal static bool IsProcessCpuHigh(double normalizedCpuPercent)
        {
            return normalizedCpuPercent >= 70;
        }

        private static ActiveRequestSnapshot ToActiveSnapshot(ActiveRequestState item, DateTime nowUtc)
        {
            return new ActiveRequestSnapshot
            {
                TraceId = item.TraceId,
                StartedAtUtc = item.StartedAtUtc,
                ElapsedMs = Math.Max(0, Convert.ToInt64((nowUtc - item.StartedAtUtc).TotalMilliseconds)),
                Method = item.Method,
                Path = item.Path,
                Route = item.Route,
                EndpointKind = item.EndpointKind,
                ApiEngineKey = item.ApiEngineKey,
                Ip = item.Ip,
                RequestedOsClient = item.RequestedOsClient,
                UserAgent = item.UserAgent,
                IsDiagnostic = item.IsDiagnostic
            };
        }

        private static CompletedRequestSnapshot ToCompletedSnapshot(CompletedRequestState item)
        {
            return new CompletedRequestSnapshot
            {
                CompletedAtUtc = item.CompletedAtUtc,
                Method = item.Method,
                Path = item.Path,
                Route = item.Route,
                EndpointKind = item.EndpointKind,
                ApiEngineKey = item.ApiEngineKey,
                Ip = item.Ip,
                RequestedOsClient = item.RequestedOsClient,
                TraceId = item.TraceId,
                StatusCode = item.StatusCode,
                ElapsedMs = item.ElapsedMs,
                IsDiagnostic = item.IsDiagnostic
            };
        }

        private static MetricAggregate GetOrAdd(Dictionary<string, MetricAggregate> target, string key)
        {
            if (!target.TryGetValue(key, out var metric))
            {
                metric = new MetricAggregate();
                target[key] = metric;
            }
            return metric;
        }

        private static string CardinalityKey(ConcurrentDictionary<string, MetricAccumulator> target, string key, int limit, string overflow)
        {
            if (target.ContainsKey(key) || target.Count < limit) return key;
            return overflow;
        }

        private static long MinuteKey(DateTime value)
        {
            return value.ToUniversalTime().Ticks / TimeSpan.TicksPerMinute;
        }

        private static string ResolveEndpointKind(string route)
        {
            if ((route ?? "").StartsWith("/apiengine/", StringComparison.OrdinalIgnoreCase)) return "ApiEngine";
            if ((route ?? "").StartsWith("/api/FormEngine/", StringComparison.OrdinalIgnoreCase)) return "FormEngine";
            if ((route ?? "").StartsWith("/api/V8", StringComparison.OrdinalIgnoreCase)) return "V8";
            if ((route ?? "").StartsWith("/api/", StringComparison.OrdinalIgnoreCase)) return "Controller";
            return "Other";
        }

        private static string ResolveApiEngineKey(string route)
        {
            var value = (route ?? "").Trim('/');
            var parts = value.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length >= 2 && string.Equals(parts[0], "apiengine", StringComparison.OrdinalIgnoreCase)
                ? Limit(parts[1], 100)
                : "";
        }

        private static bool IsDiagnosticRoute(string route)
        {
            return (route ?? "").IndexOf("mci-system-observability", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string ExtractRequestedOsClient(HttpContext context)
        {
            var request = context.Request;
            var value = FirstNonBlank(
                request.Query["OsClient"].FirstOrDefault(),
                request.Query["osclient"].FirstOrDefault(),
                request.Headers["OsClient"].FirstOrDefault(),
                request.Headers["osclient"].FirstOrDefault(),
                request.Headers["X-OsClient"].FirstOrDefault());
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
            var raw = request.Path.Value ?? "";
            const string marker = "--OsClient--";
            var start = raw.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (start < 0) return "";
            start += marker.Length;
            var end = raw.IndexOf("--", start, StringComparison.OrdinalIgnoreCase);
            return end > start ? raw.Substring(start, end - start).Trim() : "";
        }

        private static string FirstNonBlank(params string[] values)
        {
            return values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "";
        }

        private static string NormalizeIp(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "unknown";
            if (IPAddress.TryParse(value, out var parsed) && parsed.IsIPv4MappedToIPv6) parsed = parsed.MapToIPv4();
            return Limit(parsed?.ToString() ?? value.Trim(), 50);
        }

        private static int Bound(int value, int min, int max)
        {
            return Math.Max(min, Math.Min(max, value));
        }

        private static string Limit(string value, int max)
        {
            if (string.IsNullOrEmpty(value)) return "";
            return value.Length <= max ? value : value.Substring(0, max);
        }

        public sealed class RequestObservabilityLease
        {
            private readonly ActiveRequestState _state;
            private int _completed;

            internal RequestObservabilityLease(ActiveRequestState state)
            {
                _state = state;
            }

            public void Complete(HttpContext context, bool failed = false)
            {
                if (Interlocked.Exchange(ref _completed, 1) == 0)
                    SystemObservabilityService.Complete(_state, context, failed);
            }
        }

        private sealed class MinuteBucket
        {
            public MetricAccumulator Total { get; } = new MetricAccumulator();
            public MetricAccumulator Diagnostics { get; } = new MetricAccumulator();
            public ConcurrentDictionary<string, MetricAccumulator> Routes { get; } =
                new ConcurrentDictionary<string, MetricAccumulator>(StringComparer.OrdinalIgnoreCase);
            public ConcurrentDictionary<string, MetricAccumulator> Ips { get; } =
                new ConcurrentDictionary<string, MetricAccumulator>(StringComparer.OrdinalIgnoreCase);
        }

        private sealed class MetricAccumulator
        {
            private long _count;
            private long _totalElapsedMs;
            private long _errorCount;
            private long _slowCount;
            private long _maxElapsedMs;
            private readonly long[] _histogram = new long[DurationBounds.Length];

            public void Add(long elapsedMs, bool error)
            {
                Interlocked.Increment(ref _count);
                Interlocked.Add(ref _totalElapsedMs, elapsedMs);
                if (error) Interlocked.Increment(ref _errorCount);
                if (elapsedMs >= 1000) Interlocked.Increment(ref _slowCount);
                var current = Volatile.Read(ref _maxElapsedMs);
                while (elapsedMs > current)
                {
                    var original = Interlocked.CompareExchange(ref _maxElapsedMs, elapsedMs, current);
                    if (original == current) break;
                    current = original;
                }
                for (var i = 0; i < DurationBounds.Length; i++)
                {
                    if (elapsedMs <= DurationBounds[i])
                    {
                        Interlocked.Increment(ref _histogram[i]);
                        break;
                    }
                }
            }

            public MetricAggregate Snapshot()
            {
                var result = new MetricAggregate
                {
                    Count = Interlocked.Read(ref _count),
                    TotalElapsedMs = Interlocked.Read(ref _totalElapsedMs),
                    ErrorCount = Interlocked.Read(ref _errorCount),
                    SlowCount = Interlocked.Read(ref _slowCount),
                    MaxElapsedMs = Interlocked.Read(ref _maxElapsedMs)
                };
                for (var i = 0; i < _histogram.Length; i++) result.Histogram[i] = Interlocked.Read(ref _histogram[i]);
                return result;
            }
        }

        private sealed class MetricAggregate
        {
            public long Count;
            public long TotalElapsedMs;
            public long ErrorCount;
            public long SlowCount;
            public long MaxElapsedMs;
            public long[] Histogram { get; } = new long[DurationBounds.Length];

            public void Merge(MetricAggregate other)
            {
                if (other == null) return;
                Count += other.Count;
                TotalElapsedMs += other.TotalElapsedMs;
                ErrorCount += other.ErrorCount;
                SlowCount += other.SlowCount;
                MaxElapsedMs = Math.Max(MaxElapsedMs, other.MaxElapsedMs);
                for (var i = 0; i < Histogram.Length; i++) Histogram[i] += other.Histogram[i];
            }

            public long Percentile95()
            {
                if (Count <= 0) return 0;
                var target = Math.Max(1, Convert.ToInt64(Math.Ceiling(Count * 0.95d)));
                long cumulative = 0;
                for (var i = 0; i < Histogram.Length; i++)
                {
                    cumulative += Histogram[i];
                    if (cumulative >= target)
                        return DurationBounds[i] == long.MaxValue ? MaxElapsedMs : DurationBounds[i];
                }
                return MaxElapsedMs;
            }
        }

        internal sealed class ActiveRequestState
        {
            public string Key { get; set; }
            public string TraceId { get; set; }
            public DateTime StartedAtUtc { get; set; }
            public string Method { get; set; }
            public string Path { get; set; }
            public string Route { get; set; }
            public string EndpointKind { get; set; }
            public string ApiEngineKey { get; set; }
            public string Ip { get; set; }
            public string RequestedOsClient { get; set; }
            public string UserAgent { get; set; }
            public bool IsDiagnostic { get; set; }
        }

        private sealed class CompletedRequestState
        {
            public DateTime CompletedAtUtc { get; set; }
            public string Method { get; set; }
            public string Path { get; set; }
            public string Route { get; set; }
            public string EndpointKind { get; set; }
            public string ApiEngineKey { get; set; }
            public string Ip { get; set; }
            public string RequestedOsClient { get; set; }
            public string TraceId { get; set; }
            public int StatusCode { get; set; }
            public long ElapsedMs { get; set; }
            public bool IsDiagnostic { get; set; }
        }
    }

    public sealed class SystemObservabilitySnapshot
    {
        public bool ActiveSampleTruncated { get; set; }
        public int ActiveSampleCount => ActiveRequests.Count;
        public ObservabilityNodeSnapshot Node { get; set; }
        public ProcessRuntimeSnapshot Process { get; set; }
        public RequestWindowSnapshot Requests { get; set; }
        public List<TopRequestMetric> TopEndpoints { get; set; } = new List<TopRequestMetric>();
        public List<TopRequestMetric> TopIps { get; set; } = new List<TopRequestMetric>();
        public List<ActiveRequestSnapshot> ActiveRequests { get; set; } = new List<ActiveRequestSnapshot>();
        public List<CompletedRequestSnapshot> RecentRequests { get; set; } = new List<CompletedRequestSnapshot>();
        public NetworkTrafficSnapshot NetworkTraffic { get; set; }
        public ObservabilityDiagnosis Diagnosis { get; set; }
    }

    public sealed class ObservabilityNodeSnapshot
    {
        public string NodeId { get; set; }
        public string MachineName { get; set; }
        public int ProcessId { get; set; }
        public int ProcessorCount { get; set; }
        public string Scope { get; set; }
        public int WindowMinutes { get; set; }
        public DateTime SampledAtUtc { get; set; }
    }

    public sealed class ProcessRuntimeSnapshot
    {
        public int ProcessId { get; set; }
        public string ProcessName { get; set; }
        public DateTime StartedAt { get; set; }
        public long UptimeSeconds { get; set; }
        public double ProcessCpuPercentRaw { get; set; }
        public double ProcessCpuPercentNormalized { get; set; }
        public double WorkingSetMB { get; set; }
        public double PrivateMemoryMB { get; set; }
        public double ManagedHeapMB { get; set; }
        public int ProcessThreadCount { get; set; }
        public int ThreadPoolAvailableWorkers { get; set; }
        public int ThreadPoolMaxWorkers { get; set; }
        public int ThreadPoolMinWorkers { get; set; }
        public int ThreadPoolAvailableIo { get; set; }
        public int ThreadPoolMaxIo { get; set; }
        public int ThreadPoolMinIo { get; set; }
        public int Gen0Collections { get; set; }
        public int Gen1Collections { get; set; }
        public int Gen2Collections { get; set; }
        public string Error { get; set; }
    }

    public sealed class RequestWindowSnapshot
    {
        public int WindowMinutes { get; set; }
        public long RequestCount { get; set; }
        public long BusinessRequestCount { get; set; }
        public long DiagnosticRequestCount { get; set; }
        public long ErrorCount { get; set; }
        public long SlowRequestCount { get; set; }
        public double ErrorRate { get; set; }
        public double RequestsPerSecond { get; set; }
        public double AverageDurationMs { get; set; }
        public long P95DurationMs { get; set; }
        public long MaxDurationMs { get; set; }
        public int ActiveRequestCount { get; set; }
        public int ActiveBusinessRequestCount { get; set; }
        public DateTime SampledAtUtc { get; set; }
    }

    public sealed class TopRequestMetric
    {
        public string Key { get; set; }
        public string Route { get; set; }
        public string Ip { get; set; }
        public string EndpointKind { get; set; }
        public string ApiEngineKey { get; set; }
        public long RequestCount { get; set; }
        public long ErrorCount { get; set; }
        public long SlowRequestCount { get; set; }
        public double ErrorRate { get; set; }
        public double RequestsPerSecond { get; set; }
        public long TotalElapsedMs { get; set; }
        public double AverageDurationMs { get; set; }
        public long P95DurationMs { get; set; }
        public long MaxDurationMs { get; set; }
        public double CostSharePercent { get; set; }
        public int ActiveCount { get; set; }
    }

    public sealed class ActiveRequestSnapshot
    {
        public string TraceId { get; set; }
        public DateTime StartedAtUtc { get; set; }
        public long ElapsedMs { get; set; }
        public string Method { get; set; }
        public string Path { get; set; }
        public string Route { get; set; }
        public string EndpointKind { get; set; }
        public string ApiEngineKey { get; set; }
        public string Ip { get; set; }
        public string RequestedOsClient { get; set; }
        public string UserAgent { get; set; }
        public bool IsDiagnostic { get; set; }
    }

    public sealed class CompletedRequestSnapshot
    {
        public DateTime CompletedAtUtc { get; set; }
        public string Method { get; set; }
        public string Path { get; set; }
        public string Route { get; set; }
        public string EndpointKind { get; set; }
        public string ApiEngineKey { get; set; }
        public string Ip { get; set; }
        public string RequestedOsClient { get; set; }
        public string TraceId { get; set; }
        public int StatusCode { get; set; }
        public long ElapsedMs { get; set; }
        public bool IsDiagnostic { get; set; }
    }

    public sealed class ObservabilityDiagnosis
    {
        public string Severity { get; set; }
        public string Confidence { get; set; }
        public string Summary { get; set; }
        public string Boundary { get; set; }
        public List<DiagnosisSignal> Signals { get; set; } = new List<DiagnosisSignal>();
        public List<string> Recommendations { get; set; } = new List<string>();
    }

    public sealed class DiagnosisSignal
    {
        public string Code { get; set; }
        public string Severity { get; set; }
        public string Title { get; set; }
        public string Detail { get; set; }
    }
}
