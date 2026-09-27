using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>请求排队和外部 HTTP 的独立有界登记。只采标识，不持有请求、正文、凭据或业务对象。</summary>
    public static class RequestWaitObservation
    {
        private const int Capacity = 10000;
        private static readonly ConcurrentDictionary<string, Scope> Active = new ConcurrentDictionary<string, Scope>();
        private static readonly ConcurrentQueue<JObject> Recent = new ConcurrentQueue<JObject>();
        private static int _count, _recent;
        private static long _overflow;

        public static Scope Enter(string kind, string tenant = null, string key = null, string target = "", int timeoutSeconds = 0)
        {
            var context = ExecutionObservation.CurrentIdentity();
            var scope = new Scope(kind, tenant ?? context.OsClient, key ?? context.Key, target, timeoutSeconds,
                context.ExecutionId, context.RootExecutionId, context.TraceId);
            if (Interlocked.Increment(ref _count) <= Capacity) Active[scope.Id] = scope;
            else { Interlocked.Decrement(ref _count); scope.Registered = false; Interlocked.Increment(ref _overflow); }
            return scope;
        }

        /// <summary>目标仅含协议/主机/端口及路径哈希，路径中的凭据、查询参数和用户信息不落库。</summary>
        public static string HttpTarget(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != "http" && uri.Scheme != "https")) return "InvalidUri";
            using (var sha = SHA256.Create())
            {
                var hash = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(uri.AbsolutePath))).Replace("-", "").ToLowerInvariant();
                return uri.GetComponents(UriComponents.SchemeAndServer, UriFormat.UriEscaped) + "/[path-sha256:" + hash + "]";
            }
        }

        public static JObject Snapshot(string tenant = null)
        {
            var rows = Active.Values.Where(x => tenant == null || string.Equals(x.Tenant, tenant, StringComparison.OrdinalIgnoreCase)).Select(x => x.Copy()).ToArray();
            var groups = rows.GroupBy(x => new { Tenant = x.Value<string>("OsClient"), Key = x.Value<string>("ApiEngineKey"), Kind = x.Value<string>("Kind"), Stage = x.Value<string>("Stage"), Target = x.Value<string>("Target") })
                .Select(g => new JObject { ["OsClient"] = g.Key.Tenant, ["ApiEngineKey"] = g.Key.Key, ["Kind"] = g.Key.Kind,
                    ["Stage"] = g.Key.Stage, ["Target"] = g.Key.Target, ["Count"] = g.Count(), ["LongestMs"] = g.Max(x => x.Value<long>("StageElapsedMs")) })
                .OrderByDescending(x => x.Value<long>("LongestMs")).ToArray();
            return new JObject
            {
                ["Contract"] = "request-waits/v1", ["SampledAtUtc"] = DateTime.UtcNow, ["ActiveCount"] = rows.Length,
                ["RegistryOverflowCount"] = Interlocked.Read(ref _overflow), ["OmittedGroups"] = Math.Max(0, groups.Length - 128),
                ["Groups"] = new JArray(groups.Take(128)),
                ["Samples"] = new JArray(rows.OrderByDescending(x => x.Value<long>("StageElapsedMs")).Take(64)),
                ["OmittedSamples"] = Math.Max(0, rows.Length - 64),
                ["Recent"] = new JArray(Recent.Where(x => (tenant == null || string.Equals(x.Value<string>("OsClient"), tenant, StringComparison.OrdinalIgnoreCase))
                    && x.Value<DateTime>("CompletedAtUtc") > DateTime.UtcNow.AddMinutes(-2)).Reverse().Take(64).Select(x => x.DeepClone())),
                ["Boundary"] = "每个 Admission 是一个请求，每个 Http 是一次依赖调用，不能相加为线程数。AwaitingHttpCompletion 包含连接、服务端处理及接收；不能单独证明 DNS/TCP 或对方服务内部根因。长等待仅留证，不改变业务超时。"
            };
        }

        public sealed class Scope : IDisposable
        {
            internal readonly string Id = Guid.NewGuid().ToString("N"), Tenant;
            internal bool Registered = true;
            private readonly string _kind, _key, _target, _execution, _root, _trace;
            private readonly int _timeout;
            private readonly long _start = Stopwatch.GetTimestamp();
            private readonly DateTime _at = DateTime.UtcNow;
            private readonly object _gate = new object();
            private string _stage = "Starting", _outcome = "Running";
            private long _stageStart = Stopwatch.GetTimestamp();
            private int _disposed;
            internal Scope(string kind, string tenant, string key, string target, int timeout, string execution, string root, string trace)
            { _kind = Short(kind, 32); Tenant = Short(tenant, 80); _key = Short(key, 256); _target = Short(target, 400); _timeout = timeout; _execution = execution; _root = root; _trace = trace; }
            public void Stage(string value) { lock (_gate) { _stage = Short(value, 80); _stageStart = Stopwatch.GetTimestamp(); } }
            public void Outcome(string value) { lock (_gate) _outcome = Short(value, 80); }
            internal JObject Copy()
            {
                lock (_gate) return new JObject { ["Id"] = Id, ["OsClient"] = Tenant, ["Kind"] = _kind, ["ApiEngineKey"] = _key,
                    ["Target"] = _target, ["TimeoutSeconds"] = _timeout, ["ExecutionId"] = _execution, ["RootExecutionId"] = _root,
                    ["TraceId"] = _trace, ["Stage"] = _stage, ["Outcome"] = _outcome, ["StartedAtUtc"] = _at,
                    ["ElapsedMs"] = (Stopwatch.GetTimestamp() - _start) * 1000 / Stopwatch.Frequency,
                    ["StageElapsedMs"] = (Stopwatch.GetTimestamp() - _stageStart) * 1000 / Stopwatch.Frequency };
            }
            public void Dispose()
            {
                if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
                if (Registered) { Active.TryRemove(Id, out _); Interlocked.Decrement(ref _count); }
                var row = Copy(); row["CompletedAtUtc"] = DateTime.UtcNow;
                if (row.Value<string>("Outcome") == "Running") row["Outcome"] = "Completed";
                // 快请求不挤走故障片段；活动请求不依赖完成事件也能进入每 2 秒快照。
                if (row.Value<long>("ElapsedMs") >= 1000 || row.Value<string>("Outcome") != "Completed")
                {
                    Recent.Enqueue(row); Interlocked.Increment(ref _recent);
                    while (Volatile.Read(ref _recent) > 512 && Recent.TryDequeue(out _)) Interlocked.Decrement(ref _recent);
                }
            }
            private static string Short(string text, int max) => string.IsNullOrEmpty(text) ? "" : text.Substring(0, Math.Min(max, text.Length));
        }
    }
}
