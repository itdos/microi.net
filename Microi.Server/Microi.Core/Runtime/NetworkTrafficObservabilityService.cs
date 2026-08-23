using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;

namespace Microi.net
{
    /// <summary>
    /// API 网络流量观测原子能力。
    ///
    /// 热路径只执行有界内存累加，不读取请求体内容、查询串、Token、Cookie 或响应内容。
    /// Linux 下网卡计数属于当前网络命名空间（容器部署时可与容器 NetIO 对照）；
    /// Windows 下属于宿主机网卡，页面必须明确展示这个范围差异。
    /// </summary>
    public static class NetworkTrafficObservabilityService
    {
        private const string StateItemKey = "Microi.NetworkTraffic.RequestState";
        private const int RetentionMinutes = 35;
        private const int RecentLimit = 500;
        private const int InterfaceSampleLimit = 900;
        private const int RouteCardinalityPerMinute = 2000;
        private const int IpCardinalityPerMinute = 5000;
        private const int UserCardinalityPerMinute = 3000;
        private const int TenantCardinalityPerMinute = 500;
        private const int ContentTypeCardinalityPerMinute = 200;
        private const long LargeTransferBytes = 1024L * 1024L;
        private const long WarningTransferBytes = 20L * 1024L * 1024L;
        private const long CriticalTransferBytes = 100L * 1024L * 1024L;
        private static readonly Regex SafeKeyPattern = new Regex(
            "^[A-Za-z0-9][A-Za-z0-9._:/{}-]{0,499}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly ConcurrentDictionary<long, TrafficMinuteBucket> MinuteBuckets = new ConcurrentDictionary<long, TrafficMinuteBucket>();
        private static readonly ConcurrentQueue<NetworkTrafficRequestSnapshot> Recent = new ConcurrentQueue<NetworkTrafficRequestSnapshot>();
        private static readonly ConcurrentQueue<NetworkInterfaceCounterSample> InterfaceSamples = new ConcurrentQueue<NetworkInterfaceCounterSample>();
        private static readonly object InterfaceSampleLock = new object();
        private static readonly string RollupNodeId = BuildRollupNodeId();
        private static int _recentCount;
        private static long _completedSinceCleanup;
        private static long _lastInterfaceSampleTicks;

        public static NetworkTrafficRequestLease Begin(HttpContext context)
        {
            if (!ShouldTrack(context)) return null;
            var rawPath = Limit(context.Request.Path.Value ?? "/", 500);
            var route = SystemObservabilityService.NormalizeRoute(rawPath);
            var state = new TrafficRequestState
            {
                StartedAtUtc = DateTime.UtcNow,
                Method = Limit(context.Request.Method, 16),
                Path = rawPath,
                Route = route,
                EndpointKind = ResolveEndpointKind(route),
                ApiEngineKey = ResolveApiEngineKey(route),
                Ip = NormalizeIp(SecurityGuardRuntimePolicy.GetConnectionIp(context)),
                RequestedOsClient = Limit(ExtractRequestedOsClient(context), 50),
                TraceId = Limit(context.TraceIdentifier, 100),
                RequestContentType = NormalizeContentType(context.Request.ContentType),
                DeclaredRequestBytes = Math.Max(0, context.Request.ContentLength ?? 0),
                IsDiagnostic = IsDiagnosticRoute(route)
            };
            context.Items[StateItemKey] = state;
            return new NetworkTrafficRequestLease(state);
        }

        public static void AnnotateEndpoint(
            HttpContext context,
            string route,
            string endpointKind,
            string apiEngineKey,
            string osClient)
        {
            var state = GetState(context);
            if (state == null) return;
            route = Limit((route ?? "").Trim(), 500);
            endpointKind = Limit((endpointKind ?? "").Trim(), 30);
            apiEngineKey = Limit((apiEngineKey ?? "").Trim(), 100);
            osClient = Limit((osClient ?? "").Trim(), 50);
            if (route.Length > 0 && SafeKeyPattern.IsMatch(route)) state.Route = route;
            if (endpointKind.Length > 0 && SafeKeyPattern.IsMatch(endpointKind)) state.EndpointKind = endpointKind;
            if (apiEngineKey.Length == 0 || SafeKeyPattern.IsMatch(apiEngineKey)) state.ApiEngineKey = apiEngineKey;
            if (osClient.Length > 0 && SafeKeyPattern.IsMatch(osClient)) state.RequestedOsClient = osClient;
            state.IsDiagnostic = IsDiagnosticRoute(state.Route);
        }

        /// <summary>授权完成后补充用户投影；不保存 Token、角色、手机号等身份详情。</summary>
        public static void AnnotateIdentity(
            HttpContext context,
            string userId,
            string account,
            string userName,
            string osClient,
            string clientType = "")
        {
            var state = GetState(context);
            if (state == null) return;
            state.UserId = Limit((userId ?? "").Trim(), 64);
            state.Account = Limit((account ?? "").Trim(), 128);
            state.UserName = Limit((userName ?? "").Trim(), 128);
            state.ClientType = Limit((clientType ?? "").Trim(), 50);
            osClient = Limit((osClient ?? "").Trim(), 50);
            if (osClient.Length > 0 && SafeKeyPattern.IsMatch(osClient)) state.RequestedOsClient = osClient;
        }

        /// <summary>
        /// 文件控制器只标注净化后的文件名、扩展名和声明长度，不读取文件内容。
        /// 最多保留 8 个短文件名和 8 个扩展名，防止高基数/超大日志。
        /// </summary>
        public static void AnnotateTransfer(
            HttpContext context,
            string transferKind,
            int fileCount,
            long declaredBytes,
            IEnumerable<string> fileNames = null,
            IEnumerable<string> extensions = null)
        {
            var state = GetState(context);
            if (state == null) return;
            var kind = (transferKind ?? "").Trim();
            if (!string.Equals(kind, "Upload", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(kind, "Download", StringComparison.OrdinalIgnoreCase)) return;
            state.TransferKind = char.ToUpperInvariant(kind[0]) + kind.Substring(1).ToLowerInvariant();
            state.FileCount = Math.Max(0, Math.Min(10000, fileCount));
            state.DeclaredTransferBytes = Math.Max(0, declaredBytes);
            state.FileNames = SanitizeList(fileNames, 8, 120);
            state.FileExtensions = SanitizeList(extensions, 8, 20);
        }

        public static void SampleNetworkInterfaces()
        {
            var nowTicks = DateTime.UtcNow.Ticks;
            var previous = Volatile.Read(ref _lastInterfaceSampleTicks);
            if (previous != 0 && nowTicks - previous < TimeSpan.TicksPerSecond) return;
            lock (InterfaceSampleLock)
            {
                previous = Volatile.Read(ref _lastInterfaceSampleTicks);
                if (previous != 0 && nowTicks - previous < TimeSpan.TicksPerSecond) return;
                var sample = CaptureInterfaceSample(DateTime.UtcNow);
                InterfaceSamples.Enqueue(sample);
                while (InterfaceSamples.Count > InterfaceSampleLimit) InterfaceSamples.TryDequeue(out _);
                Volatile.Write(ref _lastInterfaceSampleTicks, sample.SampledAtUtc.Ticks);
            }
        }

        public static NetworkTrafficSnapshot GetSnapshot(int windowMinutes = 5, int top = 15)
        {
            windowMinutes = Math.Max(1, Math.Min(30, windowMinutes));
            top = Math.Max(5, Math.Min(50, top));
            SampleNetworkInterfaces();
            var nowUtc = DateTime.UtcNow;
            var firstMinute = MinuteKey(nowUtc) - windowMinutes + 1;
            var buckets = MinuteBuckets
                .Where(item => item.Key >= firstMinute && item.Key <= MinuteKey(nowUtc))
                .Select(item => item.Value)
                .ToList();
            var aggregate = AggregateBuckets(buckets);
            var interfaceWindow = BuildInterfaceWindow(nowUtc, windowMinutes);
            var result = new NetworkTrafficSnapshot
            {
                Scope = RuntimeInformation.IsOSPlatform(OSPlatform.Linux) ? "NetworkNamespace" : "HostInterfaces",
                ScopeDescription = RuntimeInformation.IsOSPlatform(OSPlatform.Linux)
                    ? "Linux 当前网络命名空间；容器部署时可与该 API 容器 NetIO 对照。"
                    : "Windows 宿主机网卡总量；包含同机其它进程，不能全部归因给当前 API。",
                WindowMinutes = windowMinutes,
                SampledAtUtc = nowUtc,
                CoverageSeconds = interfaceWindow.CoverageSeconds,
                InterfaceTotalReceivedBytes = interfaceWindow.TotalReceivedBytes,
                InterfaceTotalSentBytes = interfaceWindow.TotalSentBytes,
                WindowReceivedBytes = interfaceWindow.WindowReceivedBytes,
                WindowSentBytes = interfaceWindow.WindowSentBytes,
                ReceiveBytesPerSecond = interfaceWindow.ReceiveBytesPerSecond,
                SendBytesPerSecond = interfaceWindow.SendBytesPerSecond,
                AccountedHttpReceivedBytes = aggregate.Total.ReceivedBytes,
                AccountedHttpSentBytes = aggregate.Total.SentBytes,
                RequestCount = aggregate.Total.Count,
                ErrorCount = aggregate.Total.ErrorCount,
                LargeTransferCount = aggregate.Total.LargeTransferCount,
                SuspiciousCount = aggregate.Total.SuspiciousCount,
                AnonymousRequestCount = aggregate.Total.AnonymousCount,
                Interfaces = interfaceWindow.Interfaces,
                TopEndpoints = BuildTopMetrics(aggregate.Routes, "Endpoint", top),
                TopIps = BuildTopMetrics(aggregate.Ips, "Ip", top),
                TopUsers = BuildTopMetrics(aggregate.Users, "User", top),
                TopTenants = BuildTopMetrics(aggregate.Tenants, "Tenant", top),
                TopContentTypes = BuildTopMetrics(aggregate.ContentTypes, "ContentType", top),
                RecentTransfers = Recent.Reverse()
                    .Where(item => item.CompletedAtUtc >= nowUtc.AddMinutes(-windowMinutes)
                                   && (item.TotalBytes >= LargeTransferBytes || item.IsSuspicious || item.IsUpload || item.IsDownload))
                    .Take(100)
                    .ToList()
            };
            var comparable = result.CoverageSeconds >= 10 && string.Equals(result.Scope, "NetworkNamespace", StringComparison.Ordinal);
            result.UnattributedReceivedBytes = comparable
                ? Math.Max(0, result.WindowReceivedBytes - result.AccountedHttpReceivedBytes)
                : result.WindowReceivedBytes;
            result.UnattributedSentBytes = comparable
                ? Math.Max(0, result.WindowSentBytes - result.AccountedHttpSentBytes)
                : result.WindowSentBytes;
            var interfaceBytes = result.WindowReceivedBytes + result.WindowSentBytes;
            var accountedBytes = result.AccountedHttpReceivedBytes + result.AccountedHttpSentBytes;
            result.AttributionPercent = comparable && interfaceBytes > 0
                ? Math.Round(Math.Min(interfaceBytes, accountedBytes) * 100d / interfaceBytes, 2)
                : 0;
            result.AttributionStatus = !comparable
                ? (result.CoverageSeconds < 10 ? "WarmingUp" : "HostScope")
                : accountedBytes > interfaceBytes * 1.05d ? "WindowMismatch" : "Ready";
            result.Boundaries.Add("HTTP 可归因字节仅统计请求体与响应体，不包含 TLS、HTTP 头、TCP 重传和代理开销。");
            result.Boundaries.Add("未归因流量可能来自数据库、Redis、MongoDB、对象存储、外部 HTTP、健康检查和协议开销，不代表一定被攻击。");
            result.Boundaries.Add("不保存 QueryString、请求体、响应体、Token、Cookie；文件仅保留净化后的短名称、扩展名、数量与字节数。");
            return result;
        }

        /// <summary>生成固定时间桶的有界聚合，供后台服务批量、幂等写 MySQL。</summary>
        public static IReadOnlyList<NetworkTrafficRollupRow> BuildRollupRows(
            DateTime bucketStartUtc,
            int bucketMinutes = 5,
            int top = 10)
        {
            bucketStartUtc = bucketStartUtc.ToUniversalTime();
            bucketMinutes = Math.Max(1, Math.Min(15, bucketMinutes));
            top = Math.Max(1, Math.Min(25, top));
            var endUtc = bucketStartUtc.AddMinutes(bucketMinutes);
            var firstMinute = MinuteKey(bucketStartUtc);
            var endMinute = MinuteKey(endUtc);
            var buckets = MinuteBuckets
                .Where(item => item.Key >= firstMinute && item.Key < endMinute)
                .Select(item => item.Value)
                .ToList();
            if (buckets.Count == 0) return Array.Empty<NetworkTrafficRollupRow>();
            var aggregate = AggregateBuckets(buckets);
            var rows = new List<NetworkTrafficRollupRow>();
            rows.Add(ToRollupRow(bucketStartUtc, bucketMinutes, "Total", "*", aggregate.Total));
            AddRollupRows(rows, bucketStartUtc, bucketMinutes, "Endpoint", aggregate.Routes, top);
            AddRollupRows(rows, bucketStartUtc, bucketMinutes, "Ip", aggregate.Ips, top);
            AddRollupRows(rows, bucketStartUtc, bucketMinutes, "User", aggregate.Users, top);
            AddRollupRows(rows, bucketStartUtc, bucketMinutes, "Tenant", aggregate.Tenants, top);
            AddRollupRows(rows, bucketStartUtc, bucketMinutes, "ContentType", aggregate.ContentTypes, top);
            return rows;
        }

        internal static void ResetForTests()
        {
            MinuteBuckets.Clear();
            while (Recent.TryDequeue(out _)) { }
            while (InterfaceSamples.TryDequeue(out _)) { }
            _recentCount = 0;
            _completedSinceCleanup = 0;
            _lastInterfaceSampleTicks = 0;
        }

        private static void Complete(
            TrafficRequestState state,
            HttpContext context,
            bool failed,
            long actualRequestBytes,
            long actualResponseBytes)
        {
            if (state == null) return;
            var completedAtUtc = DateTime.UtcNow;
            var elapsedMs = Math.Max(0, Convert.ToInt64((completedAtUtc - state.StartedAtUtc).TotalMilliseconds));
            var statusCode = failed ? 500 : context?.Response?.StatusCode ?? 0;
            var receivedBytes = Math.Max(Math.Max(0, actualRequestBytes), state.DeclaredRequestBytes);
            receivedBytes = Math.Max(receivedBytes, state.DeclaredTransferBytes);
            var sentBytes = Math.Max(Math.Max(0, actualResponseBytes), context?.Response?.ContentLength ?? 0);
            var responseContentType = NormalizeContentType(context?.Response?.ContentType);
            var totalBytes = SafeAdd(receivedBytes, sentBytes);
            var isUpload = string.Equals(state.TransferKind, "Upload", StringComparison.OrdinalIgnoreCase)
                           || (receivedBytes >= LargeTransferBytes && IsUploadContentType(state.RequestContentType));
            var isDownload = string.Equals(state.TransferKind, "Download", StringComparison.OrdinalIgnoreCase)
                             || sentBytes >= LargeTransferBytes;
            var risk = ClassifyRisk(state, statusCode, receivedBytes, sentBytes, isUpload, isDownload);
            var isError = failed || statusCode >= 400;
            var isAnonymous = string.IsNullOrWhiteSpace(state.UserId);
            var bucket = MinuteBuckets.GetOrAdd(MinuteKey(completedAtUtc), _ => new TrafficMinuteBucket());
            bucket.Total.Add(receivedBytes, sentBytes, elapsedMs, isError, isAnonymous, isUpload, isDownload, risk.IsSuspicious);
            if (state.IsDiagnostic)
                bucket.Diagnostics.Add(receivedBytes, sentBytes, elapsedMs, isError, isAnonymous, isUpload, isDownload, risk.IsSuspicious);
            AddDimension(bucket.Routes, state.Route, RouteCardinalityPerMinute, "/other/high-cardinality",
                receivedBytes, sentBytes, elapsedMs, isError, isAnonymous, isUpload, isDownload, risk.IsSuspicious);
            AddDimension(bucket.Ips, state.Ip, IpCardinalityPerMinute, "other",
                receivedBytes, sentBytes, elapsedMs, isError, isAnonymous, isUpload, isDownload, risk.IsSuspicious);
            AddDimension(bucket.Users, BuildUserKey(state), UserCardinalityPerMinute, "其他用户",
                receivedBytes, sentBytes, elapsedMs, isError, isAnonymous, isUpload, isDownload, risk.IsSuspicious);
            AddDimension(bucket.Tenants, string.IsNullOrWhiteSpace(state.RequestedOsClient) ? "unknown" : state.RequestedOsClient,
                TenantCardinalityPerMinute, "other",
                receivedBytes, sentBytes, elapsedMs, isError, isAnonymous, isUpload, isDownload, risk.IsSuspicious);
            AddDimension(bucket.ContentTypes, BuildContentTypeKey(state.RequestContentType, responseContentType),
                ContentTypeCardinalityPerMinute, "other",
                receivedBytes, sentBytes, elapsedMs, isError, isAnonymous, isUpload, isDownload, risk.IsSuspicious);

            var completed = new NetworkTrafficRequestSnapshot
            {
                CompletedAtUtc = completedAtUtc,
                Method = state.Method,
                Route = state.Route,
                EndpointKind = state.EndpointKind,
                ApiEngineKey = state.ApiEngineKey,
                Ip = state.Ip,
                OsClient = state.RequestedOsClient,
                UserId = state.UserId,
                Account = state.Account,
                UserName = state.UserName,
                Actor = BuildUserKey(state),
                ClientType = state.ClientType,
                TraceId = state.TraceId,
                StatusCode = statusCode,
                ElapsedMs = elapsedMs,
                ReceivedBytes = receivedBytes,
                SentBytes = sentBytes,
                TotalBytes = totalBytes,
                RequestContentType = state.RequestContentType,
                ResponseContentType = responseContentType,
                IsUpload = isUpload,
                IsDownload = isDownload,
                IsAnonymous = isAnonymous,
                IsSuspicious = risk.IsSuspicious,
                RiskLevel = risk.Level,
                RiskReason = risk.Reason,
                Solution = risk.Solution,
                FileCount = state.FileCount,
                FileNames = state.FileNames,
                FileExtensions = state.FileExtensions
            };
            Recent.Enqueue(completed);
            Interlocked.Increment(ref _recentCount);
            while (Volatile.Read(ref _recentCount) > RecentLimit && Recent.TryDequeue(out _))
                Interlocked.Decrement(ref _recentCount);
            if (totalBytes >= LargeTransferBytes || risk.IsSuspicious || isUpload || isDownload)
                QueueTrafficDetail(completed);
            if (Interlocked.Increment(ref _completedSinceCleanup) % 256 == 0) Prune(completedAtUtc);
        }

        private static void QueueTrafficDetail(NetworkTrafficRequestSnapshot item)
        {
            try
            {
                var direction = item.IsUpload && item.IsDownload ? "双向大流量"
                    : item.IsUpload ? "上传"
                    : item.IsDownload ? "下载"
                    : "大流量请求";
                MicroiEngine.QueueSysLog(new SysLogParam
                {
                    EventId = Sha256Hex($"network|{RollupNodeId}|{item.TraceId}|{item.CompletedAtUtc.Ticks}"),
                    OsClient = string.IsNullOrWhiteSpace(item.OsClient) ? OsClientDefault.OsClient : item.OsClient,
                    UserId = item.UserId,
                    UserName = item.Actor,
                    Category = "Network",
                    Action = item.IsSuspicious ? "SuspiciousTransfer" : direction,
                    Source = "SystemObservability",
                    TargetType = item.EndpointKind,
                    TargetId = item.ApiEngineKey ?? item.Route,
                    Success = item.StatusCode < 400,
                    TraceId = item.TraceId,
                    NodeId = RollupNodeId,
                    DurationMs = item.ElapsedMs,
                    HttpStatusCode = item.StatusCode,
                    OccurredAt = item.CompletedAtUtc.ToLocalTime(),
                    Api = item.Route,
                    Type = "网络流量",
                    Title = $"{direction} {FormatBytes(item.TotalBytes)} · {item.Actor} · {item.Ip}",
                    Content = $"{item.Method} {item.Route}，接收 {FormatBytes(item.ReceivedBytes)}，发送 {FormatBytes(item.SentBytes)}，状态 {item.StatusCode}。",
                    IP = item.Ip,
                    OtherInfo = JsonConvert.SerializeObject(new
                    {
                        item.EndpointKind,
                        item.ApiEngineKey,
                        item.OsClient,
                        item.Account,
                        item.ClientType,
                        item.RequestContentType,
                        item.ResponseContentType,
                        item.IsAnonymous,
                        item.IsUpload,
                        item.IsDownload,
                        item.RiskLevel,
                        item.RiskReason,
                        item.Solution,
                        item.FileCount,
                        item.FileNames,
                        item.FileExtensions,
                        item.ReceivedBytes,
                        item.SentBytes
                    }),
                    Level = item.RiskLevel == "Critical" ? 3 : item.RiskLevel == "Warning" ? 2 : 1
                });
            }
            catch
            {
                // 观测日志始终是旁路，队列/序列化异常不得影响业务请求。
            }
        }

        private static TrafficRisk ClassifyRisk(
            TrafficRequestState state,
            int statusCode,
            long receivedBytes,
            long sentBytes,
            bool isUpload,
            bool isDownload)
        {
            var total = SafeAdd(receivedBytes, sentBytes);
            var anonymous = string.IsNullOrWhiteSpace(state.UserId);
            if (total >= CriticalTransferBytes || (anonymous && isUpload && receivedBytes >= 10L * 1024L * 1024L))
            {
                return new TrafficRisk("Critical", true,
                    anonymous && isUpload ? "匿名大文件上传，存在滥用或攻击风险。" : "单请求流量超过 100 MB。",
                    "核对接口权限、上传白名单和来源 IP；必要时立即限流/封禁，并检查对象存储是否应改为直传或 CDN。" );
            }
            if (total >= WarningTransferBytes || (anonymous && isUpload)
                || (statusCode >= 500 && total >= LargeTransferBytes))
            {
                return new TrafficRisk("Warning", true,
                    anonymous && isUpload ? "匿名上传需要确认是否属于公开业务。" : "单请求流量或失败响应偏大。",
                    "检查调用频率、响应字段、分页和压缩；大文件优先对象存储直传/下载，并配置大小、类型与速率限制。" );
            }
            if (total >= LargeTransferBytes || isUpload || isDownload)
            {
                return new TrafficRisk("Info", false,
                    "已作为大流量传输样本保留。",
                    "如持续高频，检查缓存、压缩、分页、Range/CDN 和调用方重试策略。" );
            }
            return new TrafficRisk("Normal", false, "未发现明显流量异常。", "无需处理；结合窗口趋势持续观察。" );
        }

        private static AggregatedTraffic AggregateBuckets(IEnumerable<TrafficMinuteBucket> buckets)
        {
            var result = new AggregatedTraffic();
            foreach (var bucket in buckets)
            {
                result.Total.Merge(bucket.Total.Snapshot());
                MergeDictionary(result.Routes, bucket.Routes);
                MergeDictionary(result.Ips, bucket.Ips);
                MergeDictionary(result.Users, bucket.Users);
                MergeDictionary(result.Tenants, bucket.Tenants);
                MergeDictionary(result.ContentTypes, bucket.ContentTypes);
            }
            return result;
        }

        private static void MergeDictionary(
            Dictionary<string, TrafficAggregate> target,
            ConcurrentDictionary<string, TrafficAccumulator> source)
        {
            foreach (var item in source)
            {
                if (!target.TryGetValue(item.Key, out var value))
                {
                    value = new TrafficAggregate();
                    target[item.Key] = value;
                }
                value.Merge(item.Value.Snapshot());
            }
        }

        private static List<NetworkTrafficDimensionMetric> BuildTopMetrics(
            Dictionary<string, TrafficAggregate> source,
            string dimensionType,
            int top)
        {
            var totalBytes = source.Values.Sum(item => item.TotalBytes);
            return source.Select(item => new NetworkTrafficDimensionMetric
                {
                    DimensionType = dimensionType,
                    Key = item.Key,
                    RequestCount = item.Value.Count,
                    ErrorCount = item.Value.ErrorCount,
                    SlowCount = item.Value.SlowCount,
                    ReceivedBytes = item.Value.ReceivedBytes,
                    SentBytes = item.Value.SentBytes,
                    TotalBytes = item.Value.TotalBytes,
                    AnonymousCount = item.Value.AnonymousCount,
                    UploadCount = item.Value.UploadCount,
                    DownloadCount = item.Value.DownloadCount,
                    SuspiciousCount = item.Value.SuspiciousCount,
                    AverageDurationMs = item.Value.Count == 0 ? 0 : Math.Round(item.Value.DurationMs / (double)item.Value.Count, 2),
                    MaxDurationMs = item.Value.MaxDurationMs,
                    TrafficSharePercent = totalBytes <= 0 ? 0 : Math.Round(item.Value.TotalBytes * 100d / totalBytes, 2),
                    RiskLevel = ResolveAggregateRisk(item.Value)
                })
                .OrderByDescending(item => item.TotalBytes)
                .ThenByDescending(item => item.RequestCount)
                .Take(top)
                .ToList();
        }

        private static void AddRollupRows(
            List<NetworkTrafficRollupRow> rows,
            DateTime bucketStartUtc,
            int bucketMinutes,
            string type,
            Dictionary<string, TrafficAggregate> source,
            int top)
        {
            foreach (var item in source.OrderByDescending(value => value.Value.TotalBytes).Take(top))
                rows.Add(ToRollupRow(bucketStartUtc, bucketMinutes, type, item.Key, item.Value));
        }

        private static NetworkTrafficRollupRow ToRollupRow(
            DateTime bucketStartUtc,
            int bucketMinutes,
            string dimensionType,
            string dimensionKey,
            TrafficAggregate value)
        {
            var hash = Sha256Hex(dimensionKey ?? "");
            var identity = Sha256Hex($"{bucketStartUtc:O}|{bucketMinutes}|{RollupNodeId}|{dimensionType}|{hash}");
            return new NetworkTrafficRollupRow
            {
                Id = HashToGuid(identity),
                BucketStartUtc = bucketStartUtc,
                BucketMinutes = bucketMinutes,
                NodeId = RollupNodeId,
                ObservedOsClient = string.Equals(dimensionType, "Tenant", StringComparison.OrdinalIgnoreCase)
                    ? Limit(dimensionKey, 50)
                    : "*",
                DimensionType = dimensionType,
                DimensionKey = Limit(dimensionKey, 500),
                DimensionKeyHash = hash,
                RequestCount = value.Count,
                ErrorCount = value.ErrorCount,
                SlowCount = value.SlowCount,
                ReceivedBytes = value.ReceivedBytes,
                SentBytes = value.SentBytes,
                TotalBytes = value.TotalBytes,
                DurationMs = value.DurationMs,
                MaxDurationMs = value.MaxDurationMs,
                AnonymousCount = value.AnonymousCount,
                UploadCount = value.UploadCount,
                DownloadCount = value.DownloadCount,
                SuspiciousCount = value.SuspiciousCount,
                RiskLevel = ResolveAggregateRisk(value),
                LastSeenAtUtc = DateTime.UtcNow
            };
        }

        private static InterfaceWindow BuildInterfaceWindow(DateTime nowUtc, int windowMinutes)
        {
            var samples = InterfaceSamples.ToArray().OrderBy(item => item.SampledAtUtc).ToArray();
            if (samples.Length == 0)
            {
                var currentOnly = CaptureInterfaceSample(nowUtc);
                return new InterfaceWindow
                {
                    TotalReceivedBytes = currentOnly.TotalReceivedBytes,
                    TotalSentBytes = currentOnly.TotalSentBytes,
                    Interfaces = currentOnly.Interfaces
                };
            }
            var current = samples[^1];
            var target = nowUtc.AddMinutes(-windowMinutes);
            var previous = samples.LastOrDefault(item => item.SampledAtUtc <= target) ?? samples[0];
            var seconds = Math.Max(0, (current.SampledAtUtc - previous.SampledAtUtc).TotalSeconds);
            var received = Math.Max(0, current.TotalReceivedBytes - previous.TotalReceivedBytes);
            var sent = Math.Max(0, current.TotalSentBytes - previous.TotalSentBytes);
            return new InterfaceWindow
            {
                CoverageSeconds = Math.Round(seconds, 2),
                TotalReceivedBytes = current.TotalReceivedBytes,
                TotalSentBytes = current.TotalSentBytes,
                WindowReceivedBytes = received,
                WindowSentBytes = sent,
                ReceiveBytesPerSecond = seconds <= 0 ? 0 : Math.Round(received / seconds, 2),
                SendBytesPerSecond = seconds <= 0 ? 0 : Math.Round(sent / seconds, 2),
                Interfaces = current.Interfaces
            };
        }

        private static NetworkInterfaceCounterSample CaptureInterfaceSample(DateTime sampledAtUtc)
        {
            var result = new NetworkInterfaceCounterSample { SampledAtUtc = sampledAtUtc };
            try
            {
                foreach (var networkInterface in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (networkInterface.OperationalStatus != OperationalStatus.Up
                        || networkInterface.NetworkInterfaceType == NetworkInterfaceType.Loopback
                        || networkInterface.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;
                    if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
                        && IsWindowsFilterAdapter(
                            networkInterface.Name,
                            networkInterface.Description)) continue;
                    try
                    {
                        var stats = networkInterface.GetIPStatistics();
                        var item = new NetworkInterfaceMetric
                        {
                            Name = Limit(networkInterface.Name, 100),
                            Description = Limit(networkInterface.Description, 160),
                            Type = networkInterface.NetworkInterfaceType.ToString(),
                            SpeedBitsPerSecond = Math.Max(0, networkInterface.Speed),
                            ReceivedBytes = Math.Max(0, stats.BytesReceived),
                            SentBytes = Math.Max(0, stats.BytesSent)
                        };
                        result.Interfaces.Add(item);
                        result.TotalReceivedBytes = SafeAdd(result.TotalReceivedBytes, item.ReceivedBytes);
                        result.TotalSentBytes = SafeAdd(result.TotalSentBytes, item.SentBytes);
                    }
                    catch { }
                }
            }
            catch (Exception ex)
            {
                result.Error = Limit(ex.Message, 300);
            }
            return result;
        }

        internal static bool IsWindowsFilterAdapter(string name, string description)
        {
            var text = ((name ?? string.Empty) + " " + (description ?? string.Empty)).ToLowerInvariant();
            if (text.Length == 0) return false;
            return text.Contains("wfp native")
                || text.Contains("wfp 802.3")
                || text.Contains("lightweight filter")
                || text.Contains("qos packet scheduler")
                || text.Contains("cfosspeed")
                || text.Contains("virtual switch extension")
                || text.Contains("virtual filtering platform vmswitch extension")
                || (name ?? string.Empty).EndsWith("-0000", StringComparison.OrdinalIgnoreCase);
        }

        private static void AddDimension(
            ConcurrentDictionary<string, TrafficAccumulator> target,
            string key,
            int cardinalityLimit,
            string overflowKey,
            long receivedBytes,
            long sentBytes,
            long elapsedMs,
            bool error,
            bool anonymous,
            bool upload,
            bool download,
            bool suspicious)
        {
            key = string.IsNullOrWhiteSpace(key) ? "unknown" : Limit(key, 500);
            if (!target.ContainsKey(key) && target.Count >= cardinalityLimit) key = overflowKey;
            target.GetOrAdd(key, _ => new TrafficAccumulator())
                .Add(receivedBytes, sentBytes, elapsedMs, error, anonymous, upload, download, suspicious);
        }

        private static bool ShouldTrack(HttpContext context)
        {
            if (context == null || context.WebSockets.IsWebSocketRequest || HttpMethods.IsOptions(context.Request.Method))
                return false;
            var path = context.Request.Path.Value ?? "";
            return path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
                   || path.StartsWith("/apiengine/", StringComparison.OrdinalIgnoreCase);
        }

        private static TrafficRequestState GetState(HttpContext context)
        {
            if (context?.Items.TryGetValue(StateItemKey, out var item) == true && item is TrafficRequestState state)
                return state;
            return null;
        }

        private static void Prune(DateTime nowUtc)
        {
            var expireBefore = MinuteKey(nowUtc) - RetentionMinutes;
            foreach (var item in MinuteBuckets)
                if (item.Key < expireBefore) MinuteBuckets.TryRemove(item.Key, out _);
        }

        private static long MinuteKey(DateTime value) => value.ToUniversalTime().Ticks / TimeSpan.TicksPerMinute;

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
            var parts = (route ?? "").Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
            return parts.Length >= 2 && string.Equals(parts[0], "apiengine", StringComparison.OrdinalIgnoreCase)
                ? Limit(parts[1], 100)
                : "";
        }

        private static bool IsDiagnosticRoute(string route) =>
            (route ?? "").IndexOf("mci-system-observability", StringComparison.OrdinalIgnoreCase) >= 0;

        private static string ExtractRequestedOsClient(HttpContext context)
        {
            var value = FirstNonBlank(
                context.Request.Query["OsClient"].FirstOrDefault(),
                context.Request.Query["osclient"].FirstOrDefault(),
                context.Request.Headers["OsClient"].FirstOrDefault(),
                context.Request.Headers["osclient"].FirstOrDefault(),
                context.Request.Headers["X-OsClient"].FirstOrDefault());
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
            var raw = context.Request.Path.Value ?? "";
            const string marker = "--OsClient--";
            var start = raw.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (start < 0) return "";
            start += marker.Length;
            var end = raw.IndexOf("--", start, StringComparison.OrdinalIgnoreCase);
            return end > start ? raw.Substring(start, end - start).Trim() : "";
        }

        private static string BuildUserKey(TrafficRequestState state)
        {
            if (string.IsNullOrWhiteSpace(state.UserId)) return "匿名";
            if (!string.IsNullOrWhiteSpace(state.Account) && !string.IsNullOrWhiteSpace(state.UserName))
                return Limit($"{state.UserName}({state.Account})", 260);
            return !string.IsNullOrWhiteSpace(state.Account) ? state.Account
                : !string.IsNullOrWhiteSpace(state.UserName) ? state.UserName
                : "用户:" + Limit(state.UserId, 64);
        }

        private static string BuildContentTypeKey(string requestContentType, string responseContentType) =>
            Limit($"{(string.IsNullOrWhiteSpace(requestContentType) ? "-" : requestContentType)} → {(string.IsNullOrWhiteSpace(responseContentType) ? "-" : responseContentType)}", 300);

        private static string NormalizeContentType(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "";
            var separator = value.IndexOf(';');
            return Limit((separator >= 0 ? value.Substring(0, separator) : value).Trim().ToLowerInvariant(), 100);
        }

        private static bool IsUploadContentType(string value) =>
            (value ?? "").IndexOf("multipart/form-data", StringComparison.OrdinalIgnoreCase) >= 0
            || (value ?? "").IndexOf("application/octet-stream", StringComparison.OrdinalIgnoreCase) >= 0;

        private static string NormalizeIp(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "unknown";
            if (IPAddress.TryParse(value, out var parsed) && parsed.IsIPv4MappedToIPv6) parsed = parsed.MapToIPv4();
            return Limit(parsed?.ToString() ?? value.Trim(), 50);
        }

        private static List<string> SanitizeList(IEnumerable<string> values, int maxCount, int maxLength)
        {
            return (values ?? Array.Empty<string>())
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => Limit(value.Replace("\r", " ").Replace("\n", " ").Trim(), maxLength))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(maxCount)
                .ToList();
        }

        private static string ResolveAggregateRisk(TrafficAggregate value)
        {
            if (value.SuspiciousCount > 0 && value.TotalBytes >= CriticalTransferBytes) return "Critical";
            if (value.SuspiciousCount > 0 || value.TotalBytes >= CriticalTransferBytes) return "Warning";
            return "Normal";
        }

        private static string FirstNonBlank(params string[] values) =>
            values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "";

        private static long SafeAdd(long left, long right)
        {
            if (left >= long.MaxValue - right) return long.MaxValue;
            return Math.Max(0, left + right);
        }

        private static string Limit(string value, int max) =>
            string.IsNullOrEmpty(value) || value.Length <= max ? value ?? "" : value.Substring(0, max);

        private static string Sha256Hex(string value)
        {
            byte[] bytes;
            using (var sha256 = SHA256.Create())
            {
                bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(value ?? ""));
            }
            return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        }

        private static string HashToGuid(string hash)
        {
            var hex = hash.Substring(0, 32);
            var bytes = new byte[16];
            for (var i = 0; i < bytes.Length; i++)
                bytes[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
            return new Guid(bytes).ToString();
        }

        private static string BuildRollupNodeId()
        {
            try
            {
                using var process = Process.GetCurrentProcess();
                return $"{Environment.MachineName}:{process.Id}:{process.StartTime.ToUniversalTime().Ticks}";
            }
            catch
            {
                try
                {
                    using (var process = Process.GetCurrentProcess())
                        return $"{Environment.MachineName}:{process.Id}";
                }
                catch { return Environment.MachineName; }
            }
        }

        private static string FormatBytes(long bytes)
        {
            var value = Math.Max(0, bytes);
            string[] units = { "B", "KB", "MB", "GB", "TB" };
            var number = (double)value;
            var unit = 0;
            while (number >= 1024 && unit < units.Length - 1) { number /= 1024; unit++; }
            return $"{number:0.##} {units[unit]}";
        }

        public sealed class NetworkTrafficRequestLease
        {
            private readonly TrafficRequestState _state;
            private int _completed;

            internal NetworkTrafficRequestLease(TrafficRequestState state) => _state = state;

            public void Complete(
                HttpContext context,
                bool failed,
                long actualRequestBytes,
                long actualResponseBytes)
            {
                if (Interlocked.Exchange(ref _completed, 1) == 0)
                    NetworkTrafficObservabilityService.Complete(
                        _state,
                        context,
                        failed,
                        actualRequestBytes,
                        actualResponseBytes);
            }
        }

        internal sealed class TrafficRequestState
        {
            public DateTime StartedAtUtc;
            public string Method;
            public string Path;
            public string Route;
            public string EndpointKind;
            public string ApiEngineKey;
            public string Ip;
            public string RequestedOsClient;
            public string TraceId;
            public string RequestContentType;
            public long DeclaredRequestBytes;
            public string UserId;
            public string Account;
            public string UserName;
            public string ClientType;
            public string TransferKind;
            public int FileCount;
            public long DeclaredTransferBytes;
            public List<string> FileNames = new List<string>();
            public List<string> FileExtensions = new List<string>();
            public bool IsDiagnostic;
        }

        private sealed class TrafficMinuteBucket
        {
            public TrafficAccumulator Total { get; } = new TrafficAccumulator();
            public TrafficAccumulator Diagnostics { get; } = new TrafficAccumulator();
            public ConcurrentDictionary<string, TrafficAccumulator> Routes { get; } = new ConcurrentDictionary<string, TrafficAccumulator>(StringComparer.OrdinalIgnoreCase);
            public ConcurrentDictionary<string, TrafficAccumulator> Ips { get; } = new ConcurrentDictionary<string, TrafficAccumulator>(StringComparer.OrdinalIgnoreCase);
            public ConcurrentDictionary<string, TrafficAccumulator> Users { get; } = new ConcurrentDictionary<string, TrafficAccumulator>(StringComparer.OrdinalIgnoreCase);
            public ConcurrentDictionary<string, TrafficAccumulator> Tenants { get; } = new ConcurrentDictionary<string, TrafficAccumulator>(StringComparer.OrdinalIgnoreCase);
            public ConcurrentDictionary<string, TrafficAccumulator> ContentTypes { get; } = new ConcurrentDictionary<string, TrafficAccumulator>(StringComparer.OrdinalIgnoreCase);
        }

        private sealed class TrafficAccumulator
        {
            private long _count;
            private long _errorCount;
            private long _slowCount;
            private long _receivedBytes;
            private long _sentBytes;
            private long _durationMs;
            private long _maxDurationMs;
            private long _anonymousCount;
            private long _uploadCount;
            private long _downloadCount;
            private long _largeTransferCount;
            private long _suspiciousCount;

            public void Add(long receivedBytes, long sentBytes, long elapsedMs, bool error, bool anonymous, bool upload, bool download, bool suspicious)
            {
                Interlocked.Increment(ref _count);
                if (error) Interlocked.Increment(ref _errorCount);
                if (elapsedMs >= 1000) Interlocked.Increment(ref _slowCount);
                Interlocked.Add(ref _receivedBytes, receivedBytes);
                Interlocked.Add(ref _sentBytes, sentBytes);
                Interlocked.Add(ref _durationMs, elapsedMs);
                if (anonymous) Interlocked.Increment(ref _anonymousCount);
                if (upload) Interlocked.Increment(ref _uploadCount);
                if (download) Interlocked.Increment(ref _downloadCount);
                if (SafeAdd(receivedBytes, sentBytes) >= LargeTransferBytes) Interlocked.Increment(ref _largeTransferCount);
                if (suspicious) Interlocked.Increment(ref _suspiciousCount);
                var current = Volatile.Read(ref _maxDurationMs);
                while (elapsedMs > current)
                {
                    var original = Interlocked.CompareExchange(ref _maxDurationMs, elapsedMs, current);
                    if (original == current) break;
                    current = original;
                }
            }

            public TrafficAggregate Snapshot() => new TrafficAggregate()
            {
                Count = Interlocked.Read(ref _count),
                ErrorCount = Interlocked.Read(ref _errorCount),
                SlowCount = Interlocked.Read(ref _slowCount),
                ReceivedBytes = Interlocked.Read(ref _receivedBytes),
                SentBytes = Interlocked.Read(ref _sentBytes),
                DurationMs = Interlocked.Read(ref _durationMs),
                MaxDurationMs = Interlocked.Read(ref _maxDurationMs),
                AnonymousCount = Interlocked.Read(ref _anonymousCount),
                UploadCount = Interlocked.Read(ref _uploadCount),
                DownloadCount = Interlocked.Read(ref _downloadCount),
                LargeTransferCount = Interlocked.Read(ref _largeTransferCount),
                SuspiciousCount = Interlocked.Read(ref _suspiciousCount)
            };
        }

        private sealed class AggregatedTraffic
        {
            public TrafficAggregate Total { get; } = new TrafficAggregate();
            public Dictionary<string, TrafficAggregate> Routes { get; } = new Dictionary<string, TrafficAggregate>(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, TrafficAggregate> Ips { get; } = new Dictionary<string, TrafficAggregate>(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, TrafficAggregate> Users { get; } = new Dictionary<string, TrafficAggregate>(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, TrafficAggregate> Tenants { get; } = new Dictionary<string, TrafficAggregate>(StringComparer.OrdinalIgnoreCase);
            public Dictionary<string, TrafficAggregate> ContentTypes { get; } = new Dictionary<string, TrafficAggregate>(StringComparer.OrdinalIgnoreCase);
        }

        private sealed class TrafficAggregate
        {
            public long Count;
            public long ErrorCount;
            public long SlowCount;
            public long ReceivedBytes;
            public long SentBytes;
            public long DurationMs;
            public long MaxDurationMs;
            public long AnonymousCount;
            public long UploadCount;
            public long DownloadCount;
            public long LargeTransferCount;
            public long SuspiciousCount;
            public long TotalBytes => SafeAdd(ReceivedBytes, SentBytes);

            public void Merge(TrafficAggregate other)
            {
                if (other == null) return;
                Count += other.Count;
                ErrorCount += other.ErrorCount;
                SlowCount += other.SlowCount;
                ReceivedBytes = SafeAdd(ReceivedBytes, other.ReceivedBytes);
                SentBytes = SafeAdd(SentBytes, other.SentBytes);
                DurationMs = SafeAdd(DurationMs, other.DurationMs);
                MaxDurationMs = Math.Max(MaxDurationMs, other.MaxDurationMs);
                AnonymousCount += other.AnonymousCount;
                UploadCount += other.UploadCount;
                DownloadCount += other.DownloadCount;
                LargeTransferCount += other.LargeTransferCount;
                SuspiciousCount += other.SuspiciousCount;
            }
        }

        private sealed class TrafficRisk
        {
            public TrafficRisk(string level, bool isSuspicious, string reason, string solution)
            {
                Level = level;
                IsSuspicious = isSuspicious;
                Reason = reason;
                Solution = solution;
            }

            public string Level { get; }
            public bool IsSuspicious { get; }
            public string Reason { get; }
            public string Solution { get; }
        }

        private sealed class NetworkInterfaceCounterSample
        {
            public DateTime SampledAtUtc { get; set; }
            public long TotalReceivedBytes { get; set; }
            public long TotalSentBytes { get; set; }
            public string Error { get; set; }
            public List<NetworkInterfaceMetric> Interfaces { get; } = new List<NetworkInterfaceMetric>();
        }

        private sealed class InterfaceWindow
        {
            public double CoverageSeconds { get; set; }
            public long TotalReceivedBytes { get; set; }
            public long TotalSentBytes { get; set; }
            public long WindowReceivedBytes { get; set; }
            public long WindowSentBytes { get; set; }
            public double ReceiveBytesPerSecond { get; set; }
            public double SendBytesPerSecond { get; set; }
            public List<NetworkInterfaceMetric> Interfaces { get; set; } = new List<NetworkInterfaceMetric>();
        }
    }

    public sealed class NetworkTrafficSnapshot
    {
        public string Scope { get; set; }
        public string ScopeDescription { get; set; }
        public string AttributionStatus { get; set; }
        public int WindowMinutes { get; set; }
        public DateTime SampledAtUtc { get; set; }
        public double CoverageSeconds { get; set; }
        public long InterfaceTotalReceivedBytes { get; set; }
        public long InterfaceTotalSentBytes { get; set; }
        public long WindowReceivedBytes { get; set; }
        public long WindowSentBytes { get; set; }
        public double ReceiveBytesPerSecond { get; set; }
        public double SendBytesPerSecond { get; set; }
        public long AccountedHttpReceivedBytes { get; set; }
        public long AccountedHttpSentBytes { get; set; }
        public long UnattributedReceivedBytes { get; set; }
        public long UnattributedSentBytes { get; set; }
        public double AttributionPercent { get; set; }
        public long RequestCount { get; set; }
        public long ErrorCount { get; set; }
        public long LargeTransferCount { get; set; }
        public long SuspiciousCount { get; set; }
        public long AnonymousRequestCount { get; set; }
        public List<NetworkInterfaceMetric> Interfaces { get; set; } = new List<NetworkInterfaceMetric>();
        public List<NetworkTrafficDimensionMetric> TopEndpoints { get; set; } = new List<NetworkTrafficDimensionMetric>();
        public List<NetworkTrafficDimensionMetric> TopIps { get; set; } = new List<NetworkTrafficDimensionMetric>();
        public List<NetworkTrafficDimensionMetric> TopUsers { get; set; } = new List<NetworkTrafficDimensionMetric>();
        public List<NetworkTrafficDimensionMetric> TopTenants { get; set; } = new List<NetworkTrafficDimensionMetric>();
        public List<NetworkTrafficDimensionMetric> TopContentTypes { get; set; } = new List<NetworkTrafficDimensionMetric>();
        public List<NetworkTrafficRequestSnapshot> RecentTransfers { get; set; } = new List<NetworkTrafficRequestSnapshot>();
        public List<string> Boundaries { get; set; } = new List<string>();
    }

    public sealed class NetworkInterfaceMetric
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public string Type { get; set; }
        public long SpeedBitsPerSecond { get; set; }
        public long ReceivedBytes { get; set; }
        public long SentBytes { get; set; }
    }

    public sealed class NetworkTrafficDimensionMetric
    {
        public string DimensionType { get; set; }
        public string Key { get; set; }
        public long RequestCount { get; set; }
        public long ErrorCount { get; set; }
        public long SlowCount { get; set; }
        public long ReceivedBytes { get; set; }
        public long SentBytes { get; set; }
        public long TotalBytes { get; set; }
        public long AnonymousCount { get; set; }
        public long UploadCount { get; set; }
        public long DownloadCount { get; set; }
        public long SuspiciousCount { get; set; }
        public double AverageDurationMs { get; set; }
        public long MaxDurationMs { get; set; }
        public double TrafficSharePercent { get; set; }
        public string RiskLevel { get; set; }
    }

    public sealed class NetworkTrafficRequestSnapshot
    {
        public DateTime CompletedAtUtc { get; set; }
        public string Method { get; set; }
        public string Route { get; set; }
        public string EndpointKind { get; set; }
        public string ApiEngineKey { get; set; }
        public string Ip { get; set; }
        public string OsClient { get; set; }
        public string UserId { get; set; }
        public string Account { get; set; }
        public string UserName { get; set; }
        public string Actor { get; set; }
        public string ClientType { get; set; }
        public string TraceId { get; set; }
        public int StatusCode { get; set; }
        public long ElapsedMs { get; set; }
        public long ReceivedBytes { get; set; }
        public long SentBytes { get; set; }
        public long TotalBytes { get; set; }
        public string RequestContentType { get; set; }
        public string ResponseContentType { get; set; }
        public bool IsUpload { get; set; }
        public bool IsDownload { get; set; }
        public bool IsAnonymous { get; set; }
        public bool IsSuspicious { get; set; }
        public string RiskLevel { get; set; }
        public string RiskReason { get; set; }
        public string Solution { get; set; }
        public int FileCount { get; set; }
        public List<string> FileNames { get; set; } = new List<string>();
        public List<string> FileExtensions { get; set; } = new List<string>();
    }

    public sealed class NetworkTrafficRollupRow
    {
        public string Id { get; set; }
        public DateTime BucketStartUtc { get; set; }
        public int BucketMinutes { get; set; }
        public string NodeId { get; set; }
        public string ObservedOsClient { get; set; }
        public string DimensionType { get; set; }
        public string DimensionKey { get; set; }
        public string DimensionKeyHash { get; set; }
        public long RequestCount { get; set; }
        public long ErrorCount { get; set; }
        public long SlowCount { get; set; }
        public long ReceivedBytes { get; set; }
        public long SentBytes { get; set; }
        public long TotalBytes { get; set; }
        public long DurationMs { get; set; }
        public long MaxDurationMs { get; set; }
        public long AnonymousCount { get; set; }
        public long UploadCount { get; set; }
        public long DownloadCount { get; set; }
        public long SuspiciousCount { get; set; }
        public string RiskLevel { get; set; }
        public DateTime LastSeenAtUtc { get; set; }
    }
}
