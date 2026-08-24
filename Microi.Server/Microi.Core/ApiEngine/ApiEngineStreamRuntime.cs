using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// One provisional frame emitted by V8.Stream.  A frame is not a transaction
    /// commit acknowledgement; the HTTP host emits the reserved done/error terminal
    /// frame only after ApiEngine.RunAsync has committed or rolled back.
    /// </summary>
    public sealed class ApiEngineStreamFrame
    {
        public long Sequence { get; set; }
        public string EventName { get; set; }
        public string Id { get; set; }
        public JToken Data { get; set; }
        public bool Provisional { get; set; } = true;
    }

    public interface IApiEngineStreamSink
    {
        bool IsConnected { get; }
        CancellationToken CancellationToken { get; }
        Task<DosResult> WriteAsync(ApiEngineStreamFrame frame);
    }

    /// <summary>
    /// Script-facing stream writer exposed as V8.Stream.  The host controls the
    /// sink and budgets; V8 parameters cannot replace either of them.
    /// </summary>
    public sealed class V8ApiEngineStream
    {
        private static readonly Regex EventNamePattern = new Regex(
            "^[A-Za-z][A-Za-z0-9_.-]{0,63}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly HashSet<string> ReservedEvents = new HashSet<string>(
            new[] { "open", "done", "error", "heartbeat" },
            StringComparer.OrdinalIgnoreCase);
        private static readonly V8ApiEngineStream DisabledInstance = new V8ApiEngineStream();

        private readonly IApiEngineStreamSink _sink;
        private readonly int _maxChunkBytes;
        private readonly long _maxTotalBytes;
        private long _sequence;
        private long _totalBytes;

        private V8ApiEngineStream()
        {
            _maxChunkBytes = 0;
            _maxTotalBytes = 0;
        }

        internal V8ApiEngineStream(
            IApiEngineStreamSink sink,
            int maxChunkBytes,
            long maxTotalBytes)
        {
            _sink = sink ?? throw new ArgumentNullException(nameof(sink));
            _maxChunkBytes = Math.Max(4096, Math.Min(1024 * 1024, maxChunkBytes));
            _maxTotalBytes = Math.Max(_maxChunkBytes, Math.Min(256L * 1024 * 1024, maxTotalBytes));
        }

        public static V8ApiEngineStream Disabled => DisabledInstance;
        public bool IsAvailable => _sink?.IsConnected == true;
        public long WrittenBytes => Interlocked.Read(ref _totalBytes);
        public long WrittenChunks => Interlocked.Read(ref _sequence);

        public DosResult Write(object data, string eventName = "chunk", string id = null)
        {
            return WriteAsync(data, eventName, id).ConfigureAwait(false).GetAwaiter().GetResult();
        }

        public async Task<DosResult> WriteAsync(
            object data,
            string eventName = "chunk",
            string id = null)
        {
            if (_sink == null)
            {
                return new DosResult(0, null, "当前接口未启用流式响应，请将 ResponseType 设置为 Stream。");
            }
            if (!_sink.IsConnected || _sink.CancellationToken.IsCancellationRequested)
            {
                return new DosResult(0, null, "流式客户端已断开连接。");
            }

            eventName = string.IsNullOrWhiteSpace(eventName) ? "chunk" : eventName.Trim();
            if (!EventNamePattern.IsMatch(eventName) || ReservedEvents.Contains(eventName))
            {
                return new DosResult(0, null, "流式事件名不合法或属于宿主保留事件。");
            }
            id = NormalizeId(id);

            JToken token;
            try
            {
                token = data == null
                    ? JValue.CreateNull()
                    : data is JToken jsonToken
                        ? jsonToken.DeepClone()
                        : JToken.FromObject(data, DiyCommon.JsonConfig);
            }
            catch
            {
                token = new JValue(data?.ToString() ?? string.Empty);
            }

            var payloadBytes = Encoding.UTF8.GetByteCount(token.ToString(Formatting.None));
            if (payloadBytes > _maxChunkBytes)
            {
                return new DosResult(
                    0,
                    new { MaxChunkBytes = _maxChunkBytes, ActualBytes = payloadBytes },
                    "流式单个分片超过当前租户安全上限。");
            }

            var total = Interlocked.Add(ref _totalBytes, payloadBytes);
            if (total > _maxTotalBytes)
            {
                Interlocked.Add(ref _totalBytes, -payloadBytes);
                return new DosResult(
                    0,
                    new { MaxTotalBytes = _maxTotalBytes },
                    "流式响应累计大小超过当前租户安全上限。");
            }

            var sequence = Interlocked.Increment(ref _sequence);
            try
            {
                var result = await _sink.WriteAsync(new ApiEngineStreamFrame
                {
                    Sequence = sequence,
                    EventName = eventName,
                    Id = id,
                    Data = token,
                    Provisional = true
                }).ConfigureAwait(false);
                if (result?.Code == 1) return result;
                Interlocked.Add(ref _totalBytes, -payloadBytes);
                return result ?? new DosResult(0, null, "流式宿主没有返回写入结果。");
            }
            catch (OperationCanceledException)
            {
                Interlocked.Add(ref _totalBytes, -payloadBytes);
                return new DosResult(0, null, "流式客户端已断开连接。");
            }
            catch (Exception ex)
            {
                Interlocked.Add(ref _totalBytes, -payloadBytes);
                return new DosResult(0, null, "写入流式分片失败：" + ex.Message);
            }
        }

        private static string NormalizeId(string id)
        {
            if (string.IsNullOrWhiteSpace(id)) return null;
            var normalized = new string(id.Trim()
                .Where(value => value >= 0x20 && value != '\r' && value != '\n')
                .Take(128)
                .ToArray());
            return string.IsNullOrWhiteSpace(normalized) ? null : normalized;
        }
    }

    /// <summary>
    /// Async-flow-local host binding.  It is created only by the dedicated HTTP
    /// stream action and cannot be supplied through V8.Param.
    /// </summary>
    public static class ApiEngineStreamContext
    {
        private static readonly AsyncLocal<V8ApiEngineStream> CurrentWriter =
            new AsyncLocal<V8ApiEngineStream>();

        public static V8ApiEngineStream Current => CurrentWriter.Value ?? V8ApiEngineStream.Disabled;

        public static IDisposable Enter(
            IApiEngineStreamSink sink,
            int maxChunkBytes,
            long maxTotalBytes)
        {
            if (sink == null) throw new ArgumentNullException(nameof(sink));
            var previous = CurrentWriter.Value;
            CurrentWriter.Value = new V8ApiEngineStream(sink, maxChunkBytes, maxTotalBytes);
            return new Scope(previous);
        }

        private sealed class Scope : IDisposable
        {
            private V8ApiEngineStream _previous;

            public Scope(V8ApiEngineStream previous)
            {
                _previous = previous;
            }

            public void Dispose()
            {
                CurrentWriter.Value = Interlocked.Exchange(ref _previous, null);
            }
        }
    }
}
