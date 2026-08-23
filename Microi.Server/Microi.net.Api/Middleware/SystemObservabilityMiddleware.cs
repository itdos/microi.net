using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace Microi.net.Api
{
    /// <summary>
    /// 低开销 API 请求观测。只记录路径、可信连接 IP、状态码、耗时和 TraceId，
    /// 不读取请求体、Cookie、Token 或任意业务参数。
    /// </summary>
    public sealed class SystemObservabilityMiddleware
    {
        private readonly RequestDelegate _next;

        public SystemObservabilityMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var lease = SystemObservabilityService.Begin(context);
            var trafficLease = NetworkTrafficObservabilityService.Begin(context);
            if (trafficLease == null)
            {
                await InvokeNext(context, lease).ConfigureAwait(false);
                return;
            }

            var originalRequestBody = context.Request.Body;
            var originalResponseBody = context.Response.Body;
            var requestCounter = new TrafficCountingReadStream(originalRequestBody);
            var responseCounter = new TrafficCountingWriteStream(originalResponseBody);
            context.Request.Body = requestCounter;
            context.Response.Body = responseCounter;
            var failed = false;
            try
            {
                await _next(context).ConfigureAwait(false);
            }
            catch
            {
                failed = true;
                throw;
            }
            finally
            {
                context.Request.Body = originalRequestBody;
                context.Response.Body = originalResponseBody;
                trafficLease.Complete(context, failed, requestCounter.BytesRead, responseCounter.BytesWritten);
                lease?.Complete(context, failed);
            }
        }

        private async Task InvokeNext(HttpContext context, SystemObservabilityService.RequestObservabilityLease lease)
        {
            var failed = false;
            try
            {
                await _next(context).ConfigureAwait(false);
            }
            catch
            {
                failed = true;
                throw;
            }
            finally
            {
                lease?.Complete(context, failed);
            }
        }
    }

    public static class SystemObservabilityMiddlewareExtensions
    {
        public static IApplicationBuilder UseSystemObservability(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<SystemObservabilityMiddleware>();
        }
    }

    /// <summary>只计数、不缓存、不拥有底层流。</summary>
    internal sealed class TrafficCountingReadStream : Stream
    {
        private readonly Stream _inner;
        private long _bytesRead;

        public TrafficCountingReadStream(Stream inner) => _inner = inner ?? Stream.Null;
        public long BytesRead => Interlocked.Read(ref _bytesRead);
        public override bool CanRead => _inner.CanRead;
        public override bool CanSeek => _inner.CanSeek;
        public override bool CanWrite => _inner.CanWrite;
        public override long Length => _inner.Length;
        public override long Position { get => _inner.Position; set => _inner.Position = value; }
        public override bool CanTimeout => _inner.CanTimeout;
        public override int ReadTimeout { get => _inner.ReadTimeout; set => _inner.ReadTimeout = value; }
        public override int WriteTimeout { get => _inner.WriteTimeout; set => _inner.WriteTimeout = value; }
        public override void Flush() => _inner.Flush();
        public override Task FlushAsync(CancellationToken cancellationToken) => _inner.FlushAsync(cancellationToken);
        public override long Seek(long offset, SeekOrigin origin) => _inner.Seek(offset, origin);
        public override void SetLength(long value) => _inner.SetLength(value);
        public override void Write(byte[] buffer, int offset, int count) => _inner.Write(buffer, offset, count);

        public override int Read(byte[] buffer, int offset, int count)
        {
            var read = _inner.Read(buffer, offset, count);
            if (read > 0) Interlocked.Add(ref _bytesRead, read);
            return read;
        }

        public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        {
            var read = await _inner.ReadAsync(buffer.AsMemory(offset, count), cancellationToken).ConfigureAwait(false);
            if (read > 0) Interlocked.Add(ref _bytesRead, read);
            return read;
        }

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            var read = await _inner.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
            if (read > 0) Interlocked.Add(ref _bytesRead, read);
            return read;
        }
    }

    /// <summary>只计数、不缓存、不拥有底层流。</summary>
    internal sealed class TrafficCountingWriteStream : Stream
    {
        private readonly Stream _inner;
        private long _bytesWritten;

        public TrafficCountingWriteStream(Stream inner) => _inner = inner ?? Stream.Null;
        public long BytesWritten => Interlocked.Read(ref _bytesWritten);
        public override bool CanRead => _inner.CanRead;
        public override bool CanSeek => _inner.CanSeek;
        public override bool CanWrite => _inner.CanWrite;
        public override long Length => _inner.Length;
        public override long Position { get => _inner.Position; set => _inner.Position = value; }
        public override bool CanTimeout => _inner.CanTimeout;
        public override int ReadTimeout { get => _inner.ReadTimeout; set => _inner.ReadTimeout = value; }
        public override int WriteTimeout { get => _inner.WriteTimeout; set => _inner.WriteTimeout = value; }
        public override void Flush() => _inner.Flush();
        public override Task FlushAsync(CancellationToken cancellationToken) => _inner.FlushAsync(cancellationToken);
        public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);
        public override long Seek(long offset, SeekOrigin origin) => _inner.Seek(offset, origin);
        public override void SetLength(long value) => _inner.SetLength(value);

        public override void Write(byte[] buffer, int offset, int count)
        {
            _inner.Write(buffer, offset, count);
            if (count > 0) Interlocked.Add(ref _bytesWritten, count);
        }

        public override async Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        {
            await _inner.WriteAsync(buffer.AsMemory(offset, count), cancellationToken).ConfigureAwait(false);
            if (count > 0) Interlocked.Add(ref _bytesWritten, count);
        }

        public override async ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
        {
            await _inner.WriteAsync(buffer, cancellationToken).ConfigureAwait(false);
            if (buffer.Length > 0) Interlocked.Add(ref _bytesWritten, buffer.Length);
        }
    }
}
