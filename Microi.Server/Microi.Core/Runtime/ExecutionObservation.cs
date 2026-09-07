using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Diagnostics.Tracing;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

namespace Microi.net
{
    /// <summary>
    /// 仅做诊断归属，不启用 V8 限额、不保留业务对象。按执行上下文的线程片段统计
    /// 托管累计分配，不能当作驻留内存。EventPipe 身份标记让独立进程在执行尚未
    /// 返回时也能关联分配样本；未标记后台线程保持“未归属”，不猜测责任入口。
    /// </summary>
    public static class ExecutionObservation
    {
        private const int ActiveLimit = 10000;
        private const int RecentLimit = 1000;
        private static readonly ConcurrentDictionary<string, State> Active = new ConcurrentDictionary<string, State>();
        private static readonly ConcurrentQueue<ExecutionObservationSnapshot> Recent = new ConcurrentQueue<ExecutionObservationSnapshot>();
        private static readonly AsyncLocal<Frame> Flow = new AsyncLocal<Frame>(Changed);
        private static readonly Func<long> Allocated = BuildAllocationReader();
        private static readonly ConditionalWeakTable<string, Identity> ScriptHashes = new ConditionalWeakTable<string, Identity>();
        [ThreadStatic] private static Frame _threadFrame;
        [ThreadStatic] private static long _threadBaseline;
        private static long _activeCount, _unregistered, _completed;
        private static int _recentCount;
        public static readonly string BootId = Guid.NewGuid().ToString("N");
        public static string CurrentExecutionId => Flow.Value?.State.Id ?? "";

        public static Scope Enter(string kind, string key, string tenant = "", string table = "", string eventName = "", string script = null)
        {
            // 只保留受限标识和源码哈希，禁止把脚本正文或业务对象送入常驻注册表。
            var parent = Flow.Value;
            if (!string.IsNullOrWhiteSpace(tenant))
                for (var ancestor = parent; ancestor != null; ancestor = ancestor.Parent)
                    if (string.IsNullOrEmpty(ancestor.State.Tenant)) ancestor.State.Tenant = Short(tenant, 64);
            var state = new State
            {
                Id = Guid.NewGuid().ToString("N"),
                ParentId = parent?.State.Id ?? "",
                RootId = parent?.State.RootId,
                TraceId = MicroiTraceContext.CurrentTraceId,
                SpanId = Activity.Current?.SpanId.ToString() ?? "",
                Kind = Short(kind, 32), Key = Short(key, 256),
                Tenant = Short(string.IsNullOrWhiteSpace(tenant) ? parent?.State.Tenant : tenant, 64),
                Table = Short(table, 128), Event = Short(eventName, 80),
                ScriptHash = string.IsNullOrEmpty(script) ? "" : ScriptHashes.GetValue(script, HashScript).Hash,
                StartedUtc = DateTime.UtcNow, LastProgressUtc = DateTime.UtcNow
            };
            state.RootId = state.RootId ?? state.Id;
            var count = Interlocked.Increment(ref _activeCount);
            state.Registered = count <= ActiveLimit;
            if (state.Registered) Active[state.Id] = state;
            else Interlocked.Increment(ref _unregistered);
            var frame = new Frame { State = state, Parent = parent };
            Flow.Value = frame;
            return new Scope(frame, parent);
        }

        public static void Annotate(string key = null, string tenant = null, string table = null, string stage = null)
        {
            var state = Flow.Value?.State;
            if (state == null) return;
            if (!string.IsNullOrWhiteSpace(key)) state.Key = Short(key, 256);
            if (!string.IsNullOrWhiteSpace(tenant)) state.Tenant = Short(tenant, 64);
            if (!string.IsNullOrWhiteSpace(table)) state.Table = Short(table, 128);
            if (!string.IsNullOrWhiteSpace(stage)) state.Stage = Short(stage, 80);
            Pulse();
        }

        public static void Pulse()
        {
            try
            {
                Account();
                var state = Flow.Value?.State;
                if (state != null)
                {
                    state.LastProgressUtc = DateTime.UtcNow;
                    Emit(state);
                }
                _threadBaseline = Allocated();
            }
            catch { /* Observability must not fail a business execution. */ }
        }

        public static ExecutionObservationWindow Snapshot(string tenant = null, int top = 100)
        {
            top = Math.Max(1, Math.Min(500, top));
            var now = DateTime.UtcNow;
            var all = Active.Values.Where(s => tenant == null || string.Equals(s.Tenant, tenant, StringComparison.OrdinalIgnoreCase)).ToArray();
            return new ExecutionObservationWindow
            {
                BootId = BootId, SampledAtUtc = now,
                ActiveCount = tenant == null ? Interlocked.Read(ref _activeCount) : all.LongLength,
                RegistryOverflowCount = Interlocked.Read(ref _unregistered),
                CompletedCount = Interlocked.Read(ref _completed),
                // 同时保留高分配、最新和最长执行，避免大量旧等待请求挤掉刚开始分配的请求。
                Active = all.OrderByDescending(s => Interlocked.Read(ref s.InclusiveBytes)).Take(top / 2)
                    .Concat(all.OrderByDescending(s => s.StartedUtc).Take(top / 4))
                    .Concat(all.OrderBy(s => s.StartedUtc).Take(top))
                    .GroupBy(s => s.Id).Select(g => g.First()).Take(top).Select(s => Copy(s, now)).ToList(),
                Recent = Recent.Where(s => tenant == null || string.Equals(s.OsClient, tenant, StringComparison.OrdinalIgnoreCase))
                    .Where(s => s.CompletedAtUtc > now.AddMinutes(-2)).OrderByDescending(s => s.ExclusiveAllocatedBytes).Take(top).ToList()
            };
        }

        private static void Changed(AsyncLocalValueChangedArgs<Frame> change)
        {
            try
            {
                Account();
                _threadFrame = change.CurrentValue;
                Emit(change.CurrentValue?.State);
                _threadBaseline = Allocated();
            }
            catch { _threadFrame = change.CurrentValue; _threadBaseline = 0; }
        }

        private static void Account()
        {
            var bytes = Allocated();
            var frame = _threadFrame;
            if (frame != null && _threadBaseline > 0 && bytes >= _threadBaseline)
            {
                var delta = bytes - _threadBaseline;
                Interlocked.Add(ref frame.State.ExclusiveBytes, delta);
                for (var current = frame; current != null; current = current.Parent)
                    Interlocked.Add(ref current.State.InclusiveBytes, delta);
            }
            _threadBaseline = bytes;
        }

        private static void Emit(State state)
        {
            ExecutionIdentityPublisher.Set(state);
        }

        private static ExecutionObservationSnapshot Copy(State s, DateTime now) => new ExecutionObservationSnapshot
        {
            ExecutionId = s.Id, ParentExecutionId = s.ParentId, RootExecutionId = s.RootId, TraceId = s.TraceId, SpanId = s.SpanId,
            OsClient = s.Tenant, Kind = s.Kind, Key = s.Key, Table = s.Table, Event = s.Event, Stage = s.Stage,
            ScriptHash = s.ScriptHash, StartedAtUtc = s.StartedUtc, LastProgressAtUtc = s.LastProgressUtc,
            CompletedAtUtc = s.CompletedUtc, ElapsedMs = (long)((s.CompletedUtc ?? now) - s.StartedUtc).TotalMilliseconds,
            ExclusiveAllocatedBytes = Math.Max(0, Interlocked.Read(ref s.ExclusiveBytes)),
            InclusiveAllocatedBytes = Math.Max(0, Interlocked.Read(ref s.InclusiveBytes)), Outcome = s.Outcome
        };

        private static Identity HashScript(string source)
        {
            using (var sha = SHA256.Create())
                return new Identity { Hash = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(source))).Replace("-", "").ToLowerInvariant() };
        }
        private static string Short(string value, int length) => string.IsNullOrEmpty(value) ? "" : value.Substring(0, Math.Min(value.Length, length));
        private static Func<long> BuildAllocationReader()
        {
            var method = typeof(GC).GetMethod("GetAllocatedBytesForCurrentThread", BindingFlags.Public | BindingFlags.Static);
            return method == null ? (Func<long>)(() => 0) : (Func<long>)Delegate.CreateDelegate(typeof(Func<long>), method);
        }
        private sealed class Identity { public string Hash; }
        internal sealed class Frame { public State State; public Frame Parent; }
        internal sealed class State
        {
            public string Id, ParentId, RootId, TraceId, SpanId, Tenant, Kind, Key, Table, Event, ScriptHash, Stage = "Execute", Outcome = "Running";
            public DateTime StartedUtc, LastProgressUtc;
            public DateTime? CompletedUtc;
            public long ExclusiveBytes, InclusiveBytes;
            public bool Registered;
        }
        public sealed class Scope : IDisposable
        {
            private readonly Frame _frame, _parent;
            private int _disposed;
            internal Scope(Frame frame, Frame parent) { _frame = frame; _parent = parent; }
            public void Failed() { _frame.State.Outcome = "Failed"; }
            public void Dispose()
            {
                if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
                Pulse();
                _frame.State.CompletedUtc = DateTime.UtcNow;
                if (_frame.State.Outcome == "Running") _frame.State.Outcome = "Completed";
                if (_frame.State.Registered) Active.TryRemove(_frame.State.Id, out _);
                Interlocked.Decrement(ref _activeCount);
                Interlocked.Increment(ref _completed);
                Recent.Enqueue(Copy(_frame.State, DateTime.UtcNow));
                Interlocked.Increment(ref _recentCount);
                while (Volatile.Read(ref _recentCount) > RecentLimit && Recent.TryDequeue(out _)) Interlocked.Decrement(ref _recentCount);
                if (Flow.Value == _frame) Flow.Value = _parent;
            }
        }
    }

    [EventSource(Name = "Microi-Execution")]
    public sealed class MicroiExecutionEventSource : EventSource
    {
        public static readonly MicroiExecutionEventSource Log = new MicroiExecutionEventSource();
        private MicroiExecutionEventSource() { }
        [Event(1, Level = EventLevel.Informational)]
        public void Context(string executionId, string parentId, string traceId, string tenant, string kind,
            string key, string table, string eventName, string scriptHash, string stage)
        {
            if (IsEnabled()) WriteEvent(1, executionId, parentId, traceId, tenant, kind, key, table, eventName, scriptHash, stage);
        }

        // v1 remains readable in historical traces. v2 can also be emitted by a different
        // thread: consumers MUST use nativeThreadId, never the publisher's event ThreadID.
        [Event(2, Level = EventLevel.Informational)]
        public void ThreadContext(int nativeThreadId, long revision, bool refresh, string executionId,
            string parentId, string traceId, string tenant, string kind, string key, string table,
            string eventName, string scriptHash, string stage)
        {
            if (IsEnabled()) WriteEvent(2, nativeThreadId, revision, refresh, executionId, parentId,
                traceId, tenant, kind, key, table, eventName, scriptHash, stage);
        }
    }

    public sealed class ExecutionObservationWindow
    {
        public string BootId { get; set; }
        public DateTime SampledAtUtc { get; set; }
        public long ActiveCount { get; set; }
        public long RegistryOverflowCount { get; set; }
        public long CompletedCount { get; set; }
        public string AllocationAccounting => "Managed cumulative allocation accounted at execution/context boundaries, not retained/RSS. Live CPU-bound counters can lag until the next boundary; use EventPipe samples for in-flight allocation. Background identity refresh is not business progress.";
        public string ObservationMode => "BoundaryAccounting+BackgroundIdentity";
        public int IdentityRefreshIntervalMs => 200;
        public long IdentityRegistryOverflowCount => ExecutionIdentityPublisher.OverflowCount;
        public long NativeThreadIdentityUnavailableCount => ExecutionIdentityPublisher.UnavailableCount;
        public long IdentityRefreshFailureCount => ExecutionIdentityPublisher.FailureCount;
        public List<ExecutionObservationSnapshot> Active { get; set; } = new List<ExecutionObservationSnapshot>();
        public List<ExecutionObservationSnapshot> Recent { get; set; } = new List<ExecutionObservationSnapshot>();
    }
    public sealed class ExecutionObservationSnapshot
    {
        public string ExecutionId { get; set; }
        public string ParentExecutionId { get; set; }
        public string RootExecutionId { get; set; }
        public string TraceId { get; set; }
        public string SpanId { get; set; }
        public string OsClient { get; set; }
        public string Kind { get; set; }
        public string Key { get; set; }
        public string Table { get; set; }
        public string Event { get; set; }
        public string Stage { get; set; }
        public string ScriptHash { get; set; }
        public DateTime StartedAtUtc { get; set; }
        public DateTime LastProgressAtUtc { get; set; }
        public DateTime? CompletedAtUtc { get; set; }
        public long ElapsedMs { get; set; }
        public long ExclusiveAllocatedBytes { get; set; }
        public long InclusiveAllocatedBytes { get; set; }
        public string Outcome { get; set; }
    }
}
