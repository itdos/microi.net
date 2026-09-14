using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;

namespace Dos.Common
{
    /// <summary>固定维度的请求耗时计量；不接收 SQL、缓存 Key 或业务数据，不增加任何 I/O。</summary>
    public static class RequestLatencyObservation
    {
        private static readonly AsyncLocal<Session> Ambient = new AsyncLocal<Session>();
        public enum Part { Authorization, Identity, IdentitySanitize, IdentityScope, OnlineTerminal, RedisRead, RedisDecode, RedisWrite, RedisEncode, DatabaseOpen, DatabaseCommand, Action, Response, PressureWait, FormAuthorization, AuthorizationVersion }

        /// <summary>仅 HTTP 入口创建。异步子操作共用计数器，完成后拒绝迟到的后台计量。</summary>
        public static Session Begin()
        {
            var session = new Session(Ambient.Value);
            Ambient.Value = session;
            return session;
        }

        public static Session Current => Ambient.Value;
        public static Measurement Measure(Part part) => new Measurement(Ambient.Value, part);
        public static void MarkActionStart() => Ambient.Value?.MarkActionStart();
        public static void MarkActionEnd() => Ambient.Value?.MarkActionEnd();
        public static void MarkRoutingEnd() => Ambient.Value?.MarkRoutingEnd();

        public readonly struct Measurement : IDisposable
        {
            private readonly Session _session;
            private readonly Part _part;
            private readonly long _started;
            internal Measurement(Session session, Part part) { _session = session; _part = part; _started = session == null ? 0 : Stopwatch.GetTimestamp(); }
            public void Dispose() { _session?.Add(_part, Stopwatch.GetTimestamp() - _started); }
        }

        public sealed class Session : IDisposable
        {
            private readonly Session _previous;
            private readonly long _start = Stopwatch.GetTimestamp();
            private readonly long[] _ticks = new long[16];
            private readonly long[] _counts = new long[16];
            private long _actionStart, _actionEnd, _routingEnd;
            private int _closed;
            internal Session(Session previous) { _previous = previous; }
            internal void Add(Part part, long ticks)
            {
                if (Volatile.Read(ref _closed) != 0) return;
                var index = (int)part;
                if (index < 0 || index >= _ticks.Length) return;
                Interlocked.Add(ref _ticks[index], Math.Max(0, ticks));
                Interlocked.Increment(ref _counts[index]);
            }
            internal void MarkActionStart() { Interlocked.CompareExchange(ref _actionStart, Stopwatch.GetTimestamp(), 0); }
            internal void MarkActionEnd() { Interlocked.CompareExchange(ref _actionEnd, Stopwatch.GetTimestamp(), 0); }
            internal void MarkRoutingEnd() { Interlocked.CompareExchange(ref _routingEnd, Stopwatch.GetTimestamp(), 0); }
            public Snapshot Capture()
            {
                var now = Stopwatch.GetTimestamp();
                var start = Interlocked.Read(ref _actionStart);
                var end = Interlocked.Read(ref _actionEnd);
                var parts = new List<Metric>();
                for (var i = 0; i < _ticks.Length; i++)
                {
                    var count = Interlocked.Read(ref _counts[i]);
                    if (count > 0) parts.Add(new Metric { Part = ((Part)i).ToString(), Count = count, TotalMs = Ms(Interlocked.Read(ref _ticks[i])) });
                }
                var routingEnd = Interlocked.Read(ref _routingEnd);
                return new Snapshot { TotalMs = Ms(now - _start), RoutingMs = routingEnd > 0 ? Ms(routingEnd - _start) : (double?)null, BeforeActionMs = start > 0 ? Ms(start - _start) : (double?)null,
                    ActionMs = start > 0 && end >= start ? Ms(end - start) : (double?)null,
                    AfterActionMs = end > 0 ? Ms(now - end) : (double?)null, Parts = parts };
            }
            public void Dispose()
            {
                Interlocked.Exchange(ref _closed, 1);
                if (ReferenceEquals(Ambient.Value, this)) Ambient.Value = _previous;
            }
            private static double Ms(long ticks) => Math.Round(Math.Max(0, ticks) * 1000d / Stopwatch.Frequency, 3);
        }

        public sealed class Metric { public string Part { get; set; } public long Count { get; set; } public double TotalMs { get; set; } }
        public sealed class Snapshot
        {
            public string Contract => "request-latency/v1";
            public string Boundary => "Parts 为含子调用的累计墙钟耗时，可能重叠或并行，不可相加当作 CPU；DatabaseCommand 不含读取后续行。Before/Action/After 为顺序阶段。";
            public double TotalMs { get; set; }
            public double? RoutingMs { get; set; }
            public double? BeforeActionMs { get; set; }
            public double? ActionMs { get; set; }
            public double? AfterActionMs { get; set; }
            public List<Metric> Parts { get; set; }
        }
    }
}
