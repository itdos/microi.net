using System.Net;
using System.Net.Sockets;
using System.Text;
using Dos.Common;

namespace Microi.Tests.Common;

public sealed class HttpClientHelperTests
{
    [Fact]
    public async Task Get_UsesRequestScopedHeadersAndDoesNotMutateInputUrl()
    {
        await using var server = new LoopbackHttpServer(1);
        var originalUrl = server.BaseAddress + "probe?existing=1";
        var param = new HttpClientParam
        {
            Url = originalUrl,
            GetParam = new { q = "a b&c" },
            Headers = new { X_Request_Id = "request-one" },
            UserAgent = "Microi-HttpClientHelper-Test"
        };

        var response = await HttpClientHelper.Get(param);

        Assert.Equal(originalUrl, param.Url);
        Assert.Contains("existing=1", response, StringComparison.Ordinal);
        Assert.Contains("q=a+b%26c", response, StringComparison.Ordinal);
        Assert.Contains("request-one", response, StringComparison.Ordinal);
        Assert.Contains("Microi-HttpClientHelper-Test", response, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ConcurrentGets_DoNotLeakHeadersAcrossRequests()
    {
        const int requestCount = 32;
        await using var server = new LoopbackHttpServer(requestCount);
        var tasks = Enumerable.Range(0, requestCount)
            .Select(index => Task.Run(async () =>
            {
                var requestId = "request-" + index;
                var response = await HttpClientHelper.Get(new HttpClientParam
                {
                    Url = server.BaseAddress + "headers",
                    Headers = new Dictionary<string, string> { ["X-Request-Id"] = requestId },
                    UserAgent = "Microi-Header-Isolation-Test"
                });
                return (requestId, response);
            }, TestContext.Current.CancellationToken))
            .ToArray();

        var results = await Task.WhenAll(tasks);

        foreach (var (requestId, response) in results)
        {
            Assert.Contains(requestId, response, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Post_PercentEncodesObjectFormValues()
    {
        await using var server = new LoopbackHttpServer(1);
        var response = await HttpClientHelper.Post(new HttpClientParam
        {
            Url = server.BaseAddress + "form",
            PostParam = new { message = "a b&c", unicode = "中文" },
            Headers = new Dictionary<string, string> { ["X-Request-Id"] = "post-one" }
        });

        Assert.Contains("message=a+b%26c", response, StringComparison.Ordinal);
        Assert.Contains("unicode=%E4%B8%AD%E6%96%87", response, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("post-one", response, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetStream_ReturnsReadableResponseOwnedStream()
    {
        await using var server = new LoopbackHttpServer(1);
        await using var stream = await HttpClientHelper.GetStream(server.BaseAddress + "stream");
        using var reader = new StreamReader(stream, Encoding.UTF8);

        var response = await reader.ReadToEndAsync(TestContext.Current.CancellationToken);

        Assert.Contains("/stream", response, StringComparison.Ordinal);
    }

    [Fact]
    public async Task MissingUrl_IsRejectedBeforeSending()
    {
        var exception = await Assert.ThrowsAsync<ArgumentException>(
            () => HttpClientHelper.Get(new HttpClientParam { Url = " " }));

        Assert.Contains("Url", exception.Message, StringComparison.Ordinal);
    }

    private sealed class LoopbackHttpServer : IAsyncDisposable
    {
        private readonly TcpListener _listener;
        private readonly Task _serverTask;

        public LoopbackHttpServer(int expectedRequests)
        {
            _listener = new TcpListener(IPAddress.Loopback, 0);
            _listener.Start();
            var endpoint = (IPEndPoint)_listener.LocalEndpoint;
            BaseAddress = $"http://127.0.0.1:{endpoint.Port}/";
            _serverTask = ServeAsync(expectedRequests, TestContext.Current.CancellationToken);
        }

        public string BaseAddress { get; }

        public async ValueTask DisposeAsync()
        {
            try
            {
                await _serverTask;
            }
            finally
            {
                _listener.Stop();
            }
        }

        private async Task ServeAsync(int expectedRequests, CancellationToken cancellationToken)
        {
            var handlers = new List<Task>(expectedRequests);
            try
            {
                for (var index = 0; index < expectedRequests; index++)
                {
                    var client = await _listener.AcceptTcpClientAsync(cancellationToken);
                    handlers.Add(HandleAsync(client, cancellationToken));
                }
                await Task.WhenAll(handlers);
            }
            finally
            {
                _listener.Stop();
            }
        }

        private static async Task HandleAsync(TcpClient client, CancellationToken cancellationToken)
        {
            using (client)
            await using (var stream = client.GetStream())
            {
                var headerBytes = await ReadHeadersAsync(stream, cancellationToken);
                var headerText = Encoding.ASCII.GetString(headerBytes);
                var lines = headerText.Split(new[] { "\r\n" }, StringSplitOptions.None);
                var requestLine = lines[0];
                var headers = lines.Skip(1)
                    .Where(line => line.Contains(':'))
                    .Select(line => line.Split(new[] { ':' }, 2))
                    .ToDictionary(parts => parts[0].Trim(), parts => parts[1].Trim(), StringComparer.OrdinalIgnoreCase);
                var contentLength = headers.TryGetValue("Content-Length", out var rawLength)
                    && int.TryParse(rawLength, out var parsedLength)
                    ? parsedLength
                    : 0;
                var bodyBytes = new byte[contentLength];
                var offset = 0;
                while (offset < contentLength)
                {
                    var read = await stream.ReadAsync(
                        bodyBytes.AsMemory(offset, contentLength - offset),
                        cancellationToken);
                    if (read == 0) throw new EndOfStreamException("HTTP request body ended unexpectedly.");
                    offset += read;
                }

                var requestId = headers.GetValueOrDefault("X-Request-Id")
                    ?? headers.GetValueOrDefault("X_Request_Id")
                    ?? string.Empty;
                var userAgent = headers.GetValueOrDefault("User-Agent") ?? string.Empty;
                var body = Encoding.UTF8.GetString(bodyBytes);
                var responseText = string.Join("\n", requestLine, requestId, userAgent, body);
                var responseBody = Encoding.UTF8.GetBytes(responseText);
                var responseHeaders = Encoding.ASCII.GetBytes(
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: text/plain; charset=utf-8\r\n" +
                    $"Content-Length: {responseBody.Length}\r\n" +
                    "Connection: close\r\n\r\n");
                await stream.WriteAsync(responseHeaders, cancellationToken);
                await stream.WriteAsync(responseBody, cancellationToken);
                await stream.FlushAsync(cancellationToken);
            }
        }

        private static async Task<byte[]> ReadHeadersAsync(
            NetworkStream stream,
            CancellationToken cancellationToken)
        {
            const int maxHeaderBytes = 64 * 1024;
            var bytes = new List<byte>(1024);
            var tail = 0u;
            var buffer = new byte[1];
            while (bytes.Count < maxHeaderBytes)
            {
                var read = await stream.ReadAsync(buffer.AsMemory(0, 1), cancellationToken);
                if (read == 0) throw new EndOfStreamException("HTTP headers ended unexpectedly.");
                var value = buffer[0];
                bytes.Add(value);
                tail = (tail << 8) | value;
                if (tail == 0x0D0A0D0A) return bytes.ToArray();
            }
            throw new InvalidDataException("HTTP headers exceeded the test limit.");
        }
    }
}
