using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

// ASP.NET Core 流式响应适配层。
namespace Microi.net.Api
{
    internal enum ApiEngineHttpStreamFormat
    {
        ServerSentEvents,
        Ndjson
    }

    internal sealed class ApiEngineHttpStreamOptions
    {
        public int MaxChunkBytes { get; private set; } = 256 * 1024;
        public long MaxTotalBytes { get; private set; } = 16L * 1024 * 1024;
        public int HeartbeatSeconds { get; private set; } = 15;

        public static ApiEngineHttpStreamOptions FromTenant(string osClient)
        {
            var result = new ApiEngineHttpStreamOptions();
            try
            {
                var model = OsClientExtend.GetClient(osClient)?.OsClientModel;
                result.MaxChunkBytes = ReadInt(
                    model?["ApiEngineStreamMaxChunkKB"],
                    256,
                    4,
                    1024) * 1024;
                result.MaxTotalBytes = ReadInt(
                    model?["ApiEngineStreamMaxTotalMB"],
                    16,
                    1,
                    256) * 1024L * 1024L;
                result.HeartbeatSeconds = ReadInt(
                    model?["ApiEngineStreamHeartbeatSeconds"],
                    15,
                    5,
                    60);
            }
            catch
            {
                // Missing historical fields keep the safe compatibility defaults.
            }
            return result;
        }

        private static int ReadInt(object value, int fallback, int minimum, int maximum)
        {
            return int.TryParse(value?.ToString(), out var parsed)
                ? Math.Max(minimum, Math.Min(maximum, parsed))
                : fallback;
        }
    }

    /// <summary>
    /// Serialized, back-pressured HTTP writer for SSE and NDJSON ApiEngine output.
    /// </summary>
    internal sealed class ApiEngineHttpStreamSink : IApiEngineStreamSink, IDisposable
    {
        private readonly HttpResponse _response;
        private readonly ApiEngineHttpStreamFormat _format;
        private readonly CancellationToken _cancellationToken;
        private readonly int _maxFrameBytes;
        private readonly SemaphoreSlim _writeGate = new SemaphoreSlim(1, 1);
        private bool _started;
        private bool _completed;

        public ApiEngineHttpStreamSink(
            HttpResponse response,
            ApiEngineHttpStreamFormat format,
            CancellationToken cancellationToken,
            int maxChunkBytes)
        {
            _response = response ?? throw new ArgumentNullException(nameof(response));
            _format = format;
            _cancellationToken = cancellationToken;
            _maxFrameBytes = Math.Max(8192, maxChunkBytes + 4096);
        }

        public bool IsConnected => !_completed && !_cancellationToken.IsCancellationRequested;
        public CancellationToken CancellationToken => _cancellationToken;

        public async Task StartAsync(string traceId)
        {
            await _writeGate.WaitAsync(_cancellationToken).ConfigureAwait(false);
            try
            {
                if (_started) return;
                _response.StatusCode = StatusCodes.Status200OK;
                _response.ContentType = _format == ApiEngineHttpStreamFormat.Ndjson
                    ? "application/x-ndjson; charset=utf-8"
                    : "text/event-stream; charset=utf-8";
                _response.Headers.CacheControl = "no-cache, no-store, no-transform";
                _response.Headers.Pragma = "no-cache";
                _response.Headers["X-Accel-Buffering"] = "no";
                _response.Headers["X-Content-Type-Options"] = "nosniff";
                _response.Headers["X-Microi-Stream-Protocol"] = "v1";
                await _response.StartAsync(_cancellationToken).ConfigureAwait(false);
                _started = true;
                await WriteEnvelopeUnsafeAsync(
                    "open",
                    null,
                    0,
                    false,
                    new JObject
                    {
                        ["Protocol"] = "microi-apiengine-stream/v1",
                        ["Format"] = _format == ApiEngineHttpStreamFormat.Ndjson ? "ndjson" : "sse",
                        ["TraceId"] = traceId ?? string.Empty,
                        ["ChunkState"] = "provisional",
                        ["TerminalEvents"] = new JArray("done", "error")
                    }).ConfigureAwait(false);
            }
            finally
            {
                _writeGate.Release();
            }
        }

        public async Task<DosResult> WriteAsync(ApiEngineStreamFrame frame)
        {
            if (frame == null) return new DosResult(0, null, "流式分片不能为空。");
            await _writeGate.WaitAsync(_cancellationToken).ConfigureAwait(false);
            try
            {
                if (!_started || _completed) return new DosResult(0, null, "流式响应尚未开始或已经结束。");
                await WriteEnvelopeUnsafeAsync(
                    frame.EventName,
                    frame.Id,
                    frame.Sequence,
                    frame.Provisional,
                    frame.Data).ConfigureAwait(false);
                return new DosResult(1, new { frame.Sequence });
            }
            finally
            {
                _writeGate.Release();
            }
        }

        public async Task WriteHeartbeatAsync()
        {
            if (!IsConnected) return;
            await _writeGate.WaitAsync(_cancellationToken).ConfigureAwait(false);
            try
            {
                if (!_started || _completed) return;
                if (_format == ApiEngineHttpStreamFormat.ServerSentEvents)
                {
                    await WriteRawUnsafeAsync($": heartbeat {DateTimeOffset.UtcNow:O}\n\n")
                        .ConfigureAwait(false);
                }
                else
                {
                    await WriteEnvelopeUnsafeAsync(
                        "heartbeat",
                        null,
                        0,
                        false,
                        new JObject { ["Utc"] = DateTimeOffset.UtcNow.ToString("O") })
                        .ConfigureAwait(false);
                }
            }
            finally
            {
                _writeGate.Release();
            }
        }

        public async Task CompleteAsync(
            bool committed,
            object result,
            long sequence,
            string traceId)
        {
            if (_completed || _cancellationToken.IsCancellationRequested) return;
            await _writeGate.WaitAsync(_cancellationToken).ConfigureAwait(false);
            try
            {
                if (_completed) return;
                var resultToken = ToToken(result);
                var data = new JObject
                {
                    ["Code"] = committed ? 1 : ReadResultCode(resultToken),
                    ["Committed"] = committed,
                    ["TraceId"] = traceId ?? string.Empty,
                    ["Result"] = resultToken
                };
                if (Encoding.UTF8.GetByteCount(data.ToString(Formatting.None)) > _maxFrameBytes)
                {
                    data["Result"] = new JObject
                    {
                        ["Omitted"] = true,
                        ["Reason"] = "terminal-result-exceeds-stream-frame-limit"
                    };
                }
                await WriteEnvelopeUnsafeAsync(
                    committed ? "done" : "error",
                    null,
                    sequence,
                    false,
                    data).ConfigureAwait(false);
                _completed = true;
            }
            finally
            {
                _writeGate.Release();
            }
        }

        public async Task FailAsync(string message, string traceId, long sequence)
        {
            var failure = new DosResult(
                0,
                new { TraceId = traceId ?? string.Empty },
                string.IsNullOrWhiteSpace(message) ? "接口引擎流式执行失败。" : message);
            await CompleteAsync(false, failure, sequence, traceId).ConfigureAwait(false);
        }

        public void Dispose()
        {
            _completed = true;
            _writeGate.Dispose();
        }

        private async Task WriteEnvelopeUnsafeAsync(
            string eventName,
            string id,
            long sequence,
            bool provisional,
            JToken data)
        {
            var envelope = new JObject
            {
                ["Event"] = eventName,
                ["Sequence"] = sequence,
                ["Provisional"] = provisional,
                ["Utc"] = DateTimeOffset.UtcNow.ToString("O"),
                ["Data"] = data ?? JValue.CreateNull()
            };
            var json = envelope.ToString(Formatting.None);
            if (Encoding.UTF8.GetByteCount(json) > _maxFrameBytes)
            {
                throw new InvalidOperationException("流式帧超过宿主安全上限。");
            }

            if (_format == ApiEngineHttpStreamFormat.Ndjson)
            {
                await WriteRawUnsafeAsync(json + "\n").ConfigureAwait(false);
                return;
            }

            var builder = new StringBuilder(json.Length + 96);
            if (!string.IsNullOrWhiteSpace(id)) builder.Append("id: ").Append(id).Append('\n');
            builder.Append("event: ").Append(eventName).Append('\n');
            builder.Append("data: ").Append(json).Append("\n\n");
            await WriteRawUnsafeAsync(builder.ToString()).ConfigureAwait(false);
        }

        private async Task WriteRawUnsafeAsync(string value)
        {
            await _response.WriteAsync(value, Encoding.UTF8, _cancellationToken).ConfigureAwait(false);
            await _response.Body.FlushAsync(_cancellationToken).ConfigureAwait(false);
        }

        private static JToken ToToken(object value)
        {
            try
            {
                if (value == null) return JValue.CreateNull();
                if (value is JToken token) return token.DeepClone();
                return JToken.FromObject(value, DiyCommon.GetJsonSerializer());
            }
            catch
            {
                return new JValue(value?.ToString() ?? string.Empty);
            }
        }

        private static int ReadResultCode(JToken token)
        {
            return token is JObject result
                   && int.TryParse(result["Code"]?.ToString(), out var code)
                ? code
                : 0;
        }
    }
}
