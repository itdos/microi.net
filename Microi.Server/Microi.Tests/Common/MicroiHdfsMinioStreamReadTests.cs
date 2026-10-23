using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using Dos.Common;
using Microi.net;
using Minio;
using Minio.DataModel.Args;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class MicroiHdfsMinioStreamReadTests
{
    private const string ObjectPath = "/private/tenant/.microi-upload/session.json";

    // 同一凭据允许 GET 对象、拒绝桶级/HEAD 请求，重现存储代理和最小权限策略。
    private sealed class ObjectOnlyHandler(Func<CancellationToken, Task<HttpResponseMessage>> response) : HttpMessageHandler
    {
        public List<(HttpMethod Method, string Path, bool Signed)> Requests { get; } = new();

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            var uri = request.RequestUri!;
            Requests.Add((request.Method, uri.AbsolutePath, uri.Query.Contains("X-Amz-Signature=", StringComparison.OrdinalIgnoreCase)));
            if (request.Method != HttpMethod.Get || uri.AbsolutePath != ObjectPath)
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden)
                {
                    RequestMessage = request,
                    Content = new StringContent("")
                });
            return response(token);
        }
    }

    // Length/Position 均不可用，确保不会为回退或大小统计依赖目标流可 seek。
    private sealed class NonSeekableDestination : Stream
    {
        private readonly MemoryStream _inner = new();
        public byte[] Bytes => _inner.ToArray();
        public bool Closed { get; private set; }
        public int MaxWrite { get; private set; }
        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => !Closed;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new InvalidOperationException("必须异步写入");
        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        {
            MaxWrite = Math.Max(MaxWrite, count);
            return _inner.WriteAsync(buffer, offset, count, cancellationToken);
        }
        protected override void Dispose(bool disposing)
        {
            Closed = true;
            if (disposing) _inner.Dispose();
            base.Dispose(disposing);
        }
    }

    private static IMinioClient CreateClient(HttpClient http, bool configureRegion = true)
    {
        var client = new MinioClient().WithEndpoint("minio.test", 9000)
            .WithCredentials("test-access", "test-secret").WithHttpClient(http);
        if (configureRegion) client = client.WithRegion("us-east-1");
        return client.Build();
    }

    // 模拟已收到一段正文后上游断连或用户取消；响应本身没有 Content-Length。
    private sealed class InterruptedSource(int failure, CancellationTokenSource cancellation) : Stream
    {
        private bool _read;
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken token)
        {
            if (_read)
            {
                if (failure == 1) throw new IOException("connection lost: X-Amz-Signature=secret");
                if (failure == 2) cancellation.Cancel();
                token.ThrowIfCancellationRequested();
                return Task.FromResult(0);
            }
            _read = true;
            buffer[offset] = 1;
            buffer[offset + 1] = 2;
            buffer[offset + 2] = 3;
            return Task.FromResult(3);
        }
    }

    private static async Task<DosResult> ReadAsync(
        IMinioClient client, HttpClient http, Stream target,
        CancellationToken token = default, int? timeout = null)
    {
        var method = typeof(MicroiHDFSMinIO).GetMethod("CopySignedObjectToStreamAsync", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return await (Task<DosResult>)method.Invoke(null,
            new object?[] { client, "private", ObjectPath["/private/".Length..], target, timeout, token, http })!;
    }

    // 未知长度的错误流用于验证真实读取上限；有完整 XML 也必须等到 EOF 才能确认语义。
    private sealed class ErrorSource(string text, bool stallAtEnd = false) : Stream
    {
        private readonly MemoryStream _inner = new(System.Text.Encoding.UTF8.GetBytes(text));
        public int BytesRead { get; private set; }
        public TaskCompletionSource EndReached { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken token)
        {
            var read = await _inner.ReadAsync(buffer, offset, count, token);
            BytesRead += read;
            if (read == 0 && stallAtEnd)
            {
                EndReached.TrySetResult();
                await Task.Delay(Timeout.Infinite, token);
            }
            return read;
        }
        protected override void Dispose(bool disposing)
        {
            if (disposing) _inner.Dispose();
            base.Dispose(disposing);
        }
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ObjectReadableButHeadDeniedStillReadsEveryByteWithTheSameCredentials(bool configureRegion)
    {
        var bytes = Enumerable.Range(0, 400_013).Select(i => (byte)i).ToArray();
        var handler = new ObjectOnlyHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new ByteArrayContent(bytes),
            Headers = { ETag = new EntityTagHeaderValue("\"object-etag\"") }
        }));
        using var http = new HttpClient(handler);
        using var client = CreateClient(http, configureRegion);

        // 先证明原 SDK 路径确实触发被拒绝的预检查，目标对象本身并非无权访问。
        await Assert.ThrowsAnyAsync<Exception>(() => client.GetObjectAsync(new GetObjectArgs()
            .WithBucket("private").WithObject(ObjectPath["/private/".Length..])
            .WithCallbackStream(_ => throw new InvalidOperationException("不应进入对象回调"))));
        Assert.Contains(handler.Requests, request => request.Method == HttpMethod.Head);
        handler.Requests.Clear();

        using var destination = new NonSeekableDestination();
        var result = await ReadAsync(client, http, destination);

        Assert.Equal(1, result.Code);
        Assert.Equal(bytes, destination.Bytes);
        Assert.False(destination.Closed);
        Assert.InRange(destination.MaxWrite, 1, 128 * 1024);
        Assert.Equal(bytes.LongLength, JObject.FromObject((object)result.Data)["Size"]!.Value<long>());
        Assert.Equal("object-etag", JObject.FromObject((object)result.Data)["ETag"]!.Value<string>());
        var request = Assert.Single(handler.Requests);
        Assert.Equal((HttpMethod.Get, ObjectPath, true), request);
    }

    [Theory]
    [InlineData(403)]
    [InlineData(404)]
    [InlineData(302)]
    [InlineData(206)]
    [InlineData(500)]
    public async Task NonFullSuccessDoesNotCopyErrorBodiesOrRetry(int status)
    {
        var handler = new ObjectOnlyHandler(_ => Task.FromResult(new HttpResponseMessage((HttpStatusCode)status)
        {
            Content = new StringContent("error-body-with-secret"),
            Headers = { Location = new Uri("https://untrusted.test/redirect") }
        }));
        using var http = new HttpClient(handler);
        using var client = CreateClient(http);
        using var destination = new NonSeekableDestination();
        var result = await ReadAsync(client, http, destination);
        Assert.Equal(0, result.Code);
        Assert.Contains($"HTTP {status}", result.Msg);
        Assert.DoesNotContain("error-body-with-secret", result.Msg);
        Assert.Empty(destination.Bytes);
        Assert.Single(handler.Requests);
    }

    // 发布器必须能区分首次 CDN 投影尚未创建的对象与代理/权限故障；不接受仅凭 404 放行。
    private static bool PublisherTreatsAsMissing(string message)
    {
        var method = typeof(V8McpLogic).GetMethod("IsApplicationCdnMissingPublicObject",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (bool)method.Invoke(null, new object[] { message })!;
    }

    [Theory]
    [InlineData("<Error><Code>NoSuchKey</Code></Error>")]
    [InlineData("<?xml version=\"1.0\"?><Error><Code>NoSuchKey</Code><Key>tenant/.microi-upload/session.json</Key><BucketName>private</BucketName><Message>secret-error-detail</Message></Error>")]
    [InlineData("<Error xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Code>NoSuchKey</Code></Error>")]
    public async Task ExactS3MissingKeyRemainsAFailedReadButAllowsFirstCdnProjection(string xml)
    {
        var handler = new ObjectOnlyHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound)
        {
            Content = new StringContent(xml, System.Text.Encoding.UTF8, "application/xml")
        }));
        using var http = new HttpClient(handler);
        using var client = CreateClient(http);
        using var destination = new NonSeekableDestination();
        var result = await ReadAsync(client, http, destination);
        Assert.Equal(0, result.Code);
        Assert.Contains("HTTP 404", result.Msg);
        Assert.Contains("NoSuchKey", result.Msg);
        Assert.True(PublisherTreatsAsMissing(result.Msg));
        Assert.DoesNotContain("secret-error-detail", result.Msg);
        Assert.Empty(destination.Bytes);
        Assert.False(destination.Closed);
        Assert.Single(handler.Requests);
    }

    [Theory]
    [InlineData(404, "<Error><Code>NoSuchBucket</Code></Error>")]
    [InlineData(404, "<Error><Code>AccessDenied</Code><Message>NoSuchKey</Message></Error>")]
    [InlineData(403, "<Error><Code>NoSuchKey</Code></Error>")]
    [InlineData(500, "<Error><Code>NoSuchKey</Code></Error>")]
    [InlineData(404, "<html><Code>NoSuchKey</Code></html>")]
    [InlineData(404, "<Error><Message>NoSuchKey</Message></Error>")]
    [InlineData(404, "<Error><Code>NoSuchKey</Code><Code>AccessDenied</Code></Error>")]
    [InlineData(404, "<Error><Code><Value>NoSuchKey</Value></Code></Error>")]
    [InlineData(404, "<Error><Code>NoSuchKey</Code><Key>another-tenant/object</Key></Error>")]
    [InlineData(404, "<Error><Code>NoSuchKey</Code><BucketName>another-bucket</BucketName></Error>")]
    [InlineData(404, "<Error><Code>NoSuchKey</Code><Key>tenant/.microi-upload/session.json</Key><Key>tenant/.microi-upload/session.json</Key></Error>")]
    [InlineData(404, "<Error xmlns=\"urn:proxy\"><Code>NoSuchKey</Code></Error>")]
    [InlineData(404, "<!DOCTYPE Error [<!ENTITY code 'NoSuchKey'>]><Error><Code>&code;</Code></Error>")]
    [InlineData(404, "<Error><Code>NoSuchKey</Code>")]
    [InlineData(404, "proxy: NoSuchKey secret-error-detail")]
    public async Task UntrustedOrNonMissingErrorsCannotAuthorizeCdnOverwrite(int status, string xml)
    {
        var handler = new ObjectOnlyHandler(_ => Task.FromResult(new HttpResponseMessage((HttpStatusCode)status)
        {
            Content = new StringContent(xml)
        }));
        using var http = new HttpClient(handler);
        using var client = CreateClient(http);
        using var destination = new NonSeekableDestination();
        var result = await ReadAsync(client, http, destination);
        Assert.Equal(0, result.Code);
        Assert.Contains($"HTTP {status}", result.Msg);
        Assert.False(PublisherTreatsAsMissing(result.Msg));
        Assert.DoesNotContain("secret-error-detail", result.Msg);
        Assert.Empty(destination.Bytes);
        Assert.Single(handler.Requests);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task OversizedS3ErrorCannotAuthorizeCdnProjection(bool declaredLength)
    {
        var xml = "<Error><Code>NoSuchKey</Code><Message>" + new string('x', 16384) + "</Message></Error>";
        var source = new ErrorSource(xml);
        var handler = new ObjectOnlyHandler(_ =>
        {
            var content = new StreamContent(source);
            content.Headers.ContentLength = declaredLength ? System.Text.Encoding.UTF8.GetByteCount(xml) : null;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound) { Content = content });
        });
        using var http = new HttpClient(handler);
        using var client = CreateClient(http);
        using var destination = new NonSeekableDestination();
        var result = await ReadAsync(client, http, destination);
        Assert.Equal(0, result.Code);
        Assert.False(PublisherTreatsAsMissing(result.Msg));
        Assert.Empty(destination.Bytes);
        Assert.Single(handler.Requests);
        Assert.Equal(declaredLength ? 0 : 8193, source.BytesRead);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task S3ErrorBodyHonorsCancellationAndTimeoutBeforeRecognizingXml(bool cancel)
    {
        using var cancellation = new CancellationTokenSource();
        var source = new ErrorSource("<Error><Code>NoSuchKey</Code></Error>", stallAtEnd: true);
        var handler = new ObjectOnlyHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound)
        {
            Content = new StreamContent(source)
        }));
        using var http = new HttpClient(handler);
        using var client = CreateClient(http);
        using var destination = new NonSeekableDestination();
        var pending = ReadAsync(client, http, destination, cancellation.Token, timeout: cancel ? 10 : 1);
        await source.EndReached.Task.WaitAsync(TimeSpan.FromSeconds(5), TestContext.Current.CancellationToken);
        if (cancel) cancellation.Cancel();
        var result = await pending.WaitAsync(TimeSpan.FromSeconds(5), TestContext.Current.CancellationToken);
        Assert.Equal(0, result.Code);
        Assert.Contains(cancel ? "已取消" : "超时", result.Msg);
        Assert.False(PublisherTreatsAsMissing(result.Msg));
        Assert.Empty(destination.Bytes);
        Assert.Single(handler.Requests);
    }

    [Theory]
    [InlineData(0, 0, true)]
    [InlineData(123, 123, true)]
    [InlineData(123, 124, false)]
    [InlineData(123, 122, false)]
    [InlineData(123, -1, true)]
    public async Task FullStreamMustMatchItsDeclaredLength(int actual, long declared, bool success)
    {
        var handler = new ObjectOnlyHandler(_ =>
        {
            var content = new StreamContent(new MemoryStream(new byte[actual]));
            content.Headers.ContentLength = declared < 0 ? null : declared;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = content });
        });
        using var http = new HttpClient(handler);
        using var client = CreateClient(http);
        using var destination = new NonSeekableDestination();
        var result = await ReadAsync(client, http, destination);
        Assert.Equal(success ? 1 : 0, result.Code);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task CancellationIsPassedToTheReadAndDoesNotRetry()
    {
        using var cancellation = new CancellationTokenSource();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new ObjectOnlyHandler(async token =>
        {
            entered.SetResult();
            await Task.Delay(Timeout.Infinite, token);
            throw new InvalidOperationException();
        });
        using var http = new HttpClient(handler);
        using var client = CreateClient(http);
        using var destination = new NonSeekableDestination();
        var pending = ReadAsync(client, http, destination, cancellation.Token);
        await entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
        cancellation.Cancel();
        var result = await pending;
        Assert.Equal(0, result.Code);
        Assert.Contains("已取消", result.Msg);
        Assert.Empty(destination.Bytes);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task ReadTimeoutAppliesAndDoesNotRetry()
    {
        var handler = new ObjectOnlyHandler(async token =>
        {
            await Task.Delay(Timeout.Infinite, token);
            throw new InvalidOperationException();
        });
        using var http = new HttpClient(handler);
        using var client = CreateClient(http);
        using var destination = new NonSeekableDestination();
        var result = await ReadAsync(client, http, destination, timeout: 1).WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(0, result.Code);
        Assert.Contains("超时", result.Msg);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task NetworkErrorsCannotExposeTheSignedUrl()
    {
        var handler = new ObjectOnlyHandler(_ => throw new HttpRequestException("https://minio.test/private/object?X-Amz-Signature=secret"));
        using var http = new HttpClient(handler);
        using var client = CreateClient(http);
        using var destination = new NonSeekableDestination();
        var result = await ReadAsync(client, http, destination);
        Assert.Equal(0, result.Code);
        Assert.Contains("HttpRequestException", result.Msg);
        Assert.DoesNotContain("X-Amz", result.Msg);
        Assert.DoesNotContain("secret", result.Msg);
        Assert.Single(handler.Requests);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public async Task UnknownLengthStreamReadsOnceAndCannotSucceedAfterPartialFailure(int failure)
    {
        using var cancellation = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        var handler = new ObjectOnlyHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StreamContent(new InterruptedSource(failure, cancellation))
        }));
        using var http = new HttpClient(handler);
        using var client = CreateClient(http);
        using var destination = new NonSeekableDestination();
        var result = await ReadAsync(client, http, destination, cancellation.Token);
        Assert.Equal(failure == 0 ? 1 : 0, result.Code);
        Assert.Equal(new byte[] { 1, 2, 3 }, destination.Bytes);
        Assert.False(destination.Closed);
        Assert.DoesNotContain("X-Amz", result.Msg ?? "");
        if (failure == 1) Assert.Contains("IOException", result.Msg);
        if (failure == 2) Assert.Contains("已取消", result.Msg);
        Assert.Single(handler.Requests);
    }
}
