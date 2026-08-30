#if !NET40
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Dos.Common
{
    /// <summary>
    /// Reuses one HttpClient while keeping headers, timeout and content scoped to
    /// each request. Returned streams own the response and must be disposed.
    /// </summary>
    public static class HttpClientHelper
    {
        private static readonly HttpClient SharedHttpClient = new HttpClient
        {
            // Per-request CTS below is the single timeout source. Leaving the
            // HttpClient default at 100 seconds would silently cap larger values.
            Timeout = Timeout.InfiniteTimeSpan
        };

        public static Task<string> Post(HttpClientParam param)
        {
            return Post<string>(param);
        }

        /// <summary>
        /// Sends a POST request. Object parameters retain the historical form
        /// shape but are now percent encoded; string parameters are sent verbatim.
        /// </summary>
        public static async Task<T> Post<T>(HttpClientParam param)
        {
            ValidateParam(param);
            var requestUri = BuildRequestUri(param.Url, null);
            var content = CreatePostContent(param);
            var responseText = await SendBufferedAsync(
                    param,
                    HttpMethod.Post,
                    requestUri,
                    content,
                    response => response.Content.ReadAsStringAsync())
                .ConfigureAwait(false);

            if (typeof(T) == typeof(string))
            {
                return (T)(object)responseText;
            }
            return JsonHelper.Deserialize<T>(responseText);
        }

        public static Task<string> Get(HttpClientParam param)
        {
            return GetBuffered(param, response => response.Content.ReadAsStringAsync());
        }

        public static Task<string> Get(string url)
        {
            return Get(new HttpClientParam { Url = url });
        }

        public static async Task<T> Get<T>(HttpClientParam param)
        {
            var responseText = await Get(param).ConfigureAwait(false);
            return JsonHelper.Deserialize<T>(responseText);
        }

        public static Task<Stream> GetStream(HttpClientParam param)
        {
            return GetResponseStream(param);
        }

        public static Task<Stream> GetStream(string url)
        {
            return GetStream(new HttpClientParam { Url = url });
        }

        public static Task<byte[]> GetByte(HttpClientParam param)
        {
            return GetBuffered(param, response => response.Content.ReadAsByteArrayAsync());
        }

        public static Task<byte[]> GetByte(string url)
        {
            return GetByte(new HttpClientParam { Url = url });
        }

        private static Task<TResult> GetBuffered<TResult>(
            HttpClientParam param,
            Func<HttpResponseMessage, Task<TResult>> readResponse)
        {
            ValidateParam(param);
            return SendBufferedAsync(
                param,
                HttpMethod.Get,
                BuildRequestUri(param.Url, param.GetParam),
                null,
                readResponse);
        }

        private static async Task<TResult> SendBufferedAsync<TResult>(
            HttpClientParam param,
            HttpMethod method,
            Uri requestUri,
            HttpContent content,
            Func<HttpResponseMessage, Task<TResult>> readResponse)
        {
            using (var request = new HttpRequestMessage(method, requestUri))
            using (var cancellation = CreateTimeoutCancellation(param.TimeOut))
            {
                request.Content = content;
                ApplyRequestHeaders(request, param);
                using (var response = await SharedHttpClient.SendAsync(
                        request,
                        HttpCompletionOption.ResponseContentRead,
                        cancellation.Token)
                    .ConfigureAwait(false))
                {
                    return await readResponse(response).ConfigureAwait(false);
                }
            }
        }

        private static async Task<Stream> GetResponseStream(HttpClientParam param)
        {
            ValidateParam(param);
            var request = new HttpRequestMessage(
                HttpMethod.Get,
                BuildRequestUri(param.Url, param.GetParam));
            ApplyRequestHeaders(request, param);

            HttpResponseMessage response = null;
            try
            {
                using (var cancellation = CreateTimeoutCancellation(param.TimeOut))
                {
                    response = await SharedHttpClient.SendAsync(
                            request,
                            HttpCompletionOption.ResponseHeadersRead,
                            cancellation.Token)
                        .ConfigureAwait(false);
                }
                var stream = await response.Content.ReadAsStreamAsync().ConfigureAwait(false);
                return new ResponseOwnedStream(stream, response);
            }
            catch
            {
                response?.Dispose();
                throw;
            }
            finally
            {
                request.Dispose();
            }
        }

        private static StringContent CreatePostContent(HttpClientParam param)
        {
            var body = BuildParameterString(param.PostParam);
            var encoding = param.Encoding ?? Encoding.UTF8;
            var contentType = string.IsNullOrWhiteSpace(param.ContentType)
                ? "application/x-www-form-urlencoded"
                : param.ContentType.Trim();
            return new StringContent(body, encoding, contentType);
        }

        private static Uri BuildRequestUri(string url, object queryParameters)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
                || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                throw new ArgumentException("Url must be an absolute HTTP or HTTPS address.", nameof(url));
            }

            if (queryParameters == null) return uri;
            var query = BuildParameterString(queryParameters);
            if (query.Length == 0) return uri;

            var builder = new UriBuilder(uri);
            var existing = builder.Query.TrimStart('?');
            builder.Query = existing.Length == 0 ? query : existing + "&" + query;
            return builder.Uri;
        }

        private static string BuildParameterString(object parameters)
        {
            if (parameters == null) return string.Empty;
            if (parameters is string raw) return raw;

            var values = parameters as JObject ?? JObject.FromObject(parameters);
            var result = new StringBuilder();
            foreach (var item in values)
            {
                if (result.Length > 0) result.Append('&');
                result.Append(WebUtility.UrlEncode(item.Key));
                result.Append('=');
                var value = item.Value == null || item.Value.Type == JTokenType.Null
                    ? string.Empty
                    : item.Value.Type == JTokenType.String
                        ? item.Value.Value<string>()
                        : item.Value.ToString(Formatting.None);
                result.Append(WebUtility.UrlEncode(value ?? string.Empty));
            }
            return result.ToString();
        }

        private static void ApplyRequestHeaders(HttpRequestMessage request, HttpClientParam param)
        {
            if (!string.IsNullOrWhiteSpace(param.UserAgent))
            {
                request.Headers.TryAddWithoutValidation("User-Agent", param.UserAgent.Trim());
            }
            if (!string.IsNullOrWhiteSpace(param.Referer)
                && Uri.TryCreate(param.Referer, UriKind.Absolute, out var referer))
            {
                request.Headers.Referrer = referer;
            }
            if (param.Headers == null) return;

            var headers = param.Headers as JObject ?? JObject.FromObject(param.Headers);
            foreach (var item in headers)
            {
                var value = item.Value?.Type == JTokenType.String
                    ? item.Value.Value<string>()
                    : item.Value?.ToString(Formatting.None);
                if (!request.Headers.TryAddWithoutValidation(item.Key, value ?? string.Empty))
                {
                    request.Content?.Headers.TryAddWithoutValidation(item.Key, value ?? string.Empty);
                }
            }
        }

        private static CancellationTokenSource CreateTimeoutCancellation(int timeoutSeconds)
        {
            return timeoutSeconds > 0
                ? new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds))
                : new CancellationTokenSource();
        }

        private static void ValidateParam(HttpClientParam param)
        {
            if (param == null) throw new ArgumentNullException(nameof(param));
            if (string.IsNullOrWhiteSpace(param.Url))
                throw new ArgumentException("Url is required.", nameof(param));
        }

        private sealed class ResponseOwnedStream : Stream
        {
            private readonly Stream _inner;
            private readonly HttpResponseMessage _response;
            private int _disposed;

            public ResponseOwnedStream(Stream inner, HttpResponseMessage response)
            {
                _inner = inner ?? throw new ArgumentNullException(nameof(inner));
                _response = response ?? throw new ArgumentNullException(nameof(response));
            }

            public override bool CanRead => _inner.CanRead;
            public override bool CanSeek => _inner.CanSeek;
            public override bool CanWrite => _inner.CanWrite;
            public override long Length => _inner.Length;
            public override long Position { get => _inner.Position; set => _inner.Position = value; }
            public override void Flush() => _inner.Flush();
            public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);
            public override long Seek(long offset, SeekOrigin origin) => _inner.Seek(offset, origin);
            public override void SetLength(long value) => _inner.SetLength(value);
            public override void Write(byte[] buffer, int offset, int count) => _inner.Write(buffer, offset, count);
            public override Task FlushAsync(CancellationToken cancellationToken) => _inner.FlushAsync(cancellationToken);
            public override Task<int> ReadAsync(
                byte[] buffer,
                int offset,
                int count,
                CancellationToken cancellationToken) => _inner.ReadAsync(buffer, offset, count, cancellationToken);
            public override Task WriteAsync(
                byte[] buffer,
                int offset,
                int count,
                CancellationToken cancellationToken) => _inner.WriteAsync(buffer, offset, count, cancellationToken);

            protected override void Dispose(bool disposing)
            {
                if (disposing && Interlocked.Exchange(ref _disposed, 1) == 0)
                {
                    _inner.Dispose();
                    _response.Dispose();
                }
                base.Dispose(disposing);
            }
        }
    }
}
#endif
