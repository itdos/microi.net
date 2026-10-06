using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microi.net;
using Minio;
using Minio.DataModel.Args;

namespace Microi.Tests.Common;

public sealed class MicroiHdfsMinioCopyTests
{
    private static HttpClient CopyClient(HttpMessageHandler transport) => (HttpClient)typeof(MicroiHDFSMinIO)
        .GetMethod("CreateCopyHttpClient", BindingFlags.NonPublic | BindingFlags.Static)!
        .Invoke(null, [transport])!;

    // 使用真实 SDK 7 生成签名，独立按线上 HTTP 头重算 SigV4；错误头必须被拒绝。
    // 该夹具只证明协议回归，真实 MinIO 的字节/MIME/双节点恢复由集成验收另行验证。
    private sealed class SignedCopyServer(string contentType) : HttpMessageHandler
    {
        public int Copies { get; private set; }
        public bool SignatureMatches { get; private set; }
        public string? ReceivedType { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        {
            token.ThrowIfCancellationRequested();
            if (request.Method == HttpMethod.Head)
            {
                var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent([]) };
                response.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
                response.Content.Headers.ContentLength = 19;
                response.Content.Headers.LastModified = DateTimeOffset.Parse("2026-10-07T00:00:00Z", CultureInfo.InvariantCulture);
                response.Headers.ETag = new EntityTagHeaderValue("\"source-etag\"");
                response.Headers.TryAddWithoutValidation("x-amz-meta-fixture", "retained");
                return Task.FromResult(response);
            }
            Assert.Equal(HttpMethod.Put, request.Method);
            Copies++;
            var values = request.Content!.Headers.GetValues("Content-Type").ToArray();
            ReceivedType = string.Join(",", values);
            var authorization = request.Headers.GetValues("Authorization").Single();
            var scope = Regex.Match(authorization, @"Credential=test-access/([^,]+)").Groups[1].Value;
            var names = Regex.Match(authorization, @"SignedHeaders=([^,]+)").Groups[1].Value;
            var signature = Regex.Match(authorization, @"Signature=([a-f0-9]+)").Groups[1].Value;
            string Header(string name) => string.Join(",", request.Headers.TryGetValues(name, out var headers)
                ? headers : request.Content.Headers.GetValues(name));
            var canonicalHeaders = string.Concat(names.Split(';').Select(name => name + ":"
                + Regex.Replace(Header(name).Trim(), @"\s+", " ") + "\n"));
            var canonical = request.Method + "\n" + request.RequestUri!.AbsolutePath + "\n\n"
                + canonicalHeaders + "\n" + names + "\n" + Header("x-amz-content-sha256");
            var stringToSign = "AWS4-HMAC-SHA256\n" + Header("x-amz-date") + "\n" + scope + "\n"
                + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)));
            var key = Encoding.UTF8.GetBytes("AWS4test-secret");
            foreach (var part in scope.Split('/')) key = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(part));
            SignatureMatches = signature == Convert.ToHexStringLower(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(stringToSign)));
            // SDK ObjectStat 将自定义元数据去掉 x-amz-meta- 前缀后转交复制。
            // 存储服务的默认 COPY 保留源元数据；本修复不能切换成 REPLACE。
            Assert.Equal("retained", Header("fixture"));
            Assert.False(request.Headers.Contains("x-amz-metadata-directive"));
            Assert.Contains("source.css", Header("x-amz-copy-source"));
            var body = SignatureMatches
                ? "<CopyObjectResult><LastModified>2026-10-07T00:00:00Z</LastModified><ETag>\"copied-etag\"</ETag></CopyObjectResult>"
                : "<Error><Code>SignatureDoesNotMatch</Code><Message>Wire headers differ from signed headers</Message></Error>";
            return Task.FromResult(new HttpResponseMessage(SignatureMatches ? HttpStatusCode.OK : HttpStatusCode.Forbidden)
            { Content = new StringContent(body, Encoding.UTF8, "application/xml") });
        }
    }

    private static IMinioClient Sdk(HttpClient http) => new MinioClient().WithEndpoint("minio.test", 9000)
        .WithCredentials("test-access", "test-secret").WithRegion("us-east-1").WithHttpClient(http).Build();
    private static CopyObjectArgs Args(string bucket) => new CopyObjectArgs().WithBucket(bucket).WithObject("tenant/copied.css")
        .WithCopyObjectSource(new CopySourceObjectArgs().WithBucket(bucket).WithObject("tenant/source.css"));

    [Theory]
    [InlineData("text/css; charset=utf-8")]
    [InlineData("text/javascript; charset=utf-8")]
    [InlineData("text/html; charset=utf-8")]
    public async Task OldSdkCopySendsDefaultMimeAlongsideSignedSourceMimeAndFails(string type)
    {
        var server = new SignedCopyServer(type);
        using var http = new HttpClient(server);
        using var sdk = Sdk(http);
        await Assert.ThrowsAnyAsync<Exception>(() => sdk.CopyObjectAsync(Args("public")));
        Assert.False(server.SignatureMatches);
        Assert.Equal("text/plain; charset=utf-8," + type, server.ReceivedType);
        Assert.Equal(1, server.Copies);
    }

    [Theory]
    [InlineData("public", "text/css; charset=utf-8")]
    [InlineData("private", "text/javascript; charset=utf-8")]
    [InlineData("public", "text/html; charset=utf-8")]
    [InlineData("private", "application/json; charset=utf-8")]
    [InlineData("public", "text/css; charset=iso-8859-1")]
    [InlineData("private", "application/octet-stream")]
    [InlineData("public", "image/svg+xml")]
    [InlineData("private", "text/plain; charset=utf-8")]
    public async Task CopyRetainsExactSourceMimeMetadataAndValidSdkSignature(string bucket, string type)
    {
        var server = new SignedCopyServer(type);
        using var http = CopyClient(server);
        using var sdk = Sdk(http);
        await sdk.CopyObjectAsync(Args(bucket));
        Assert.True(server.SignatureMatches);
        Assert.Equal(type, server.ReceivedType);
        Assert.Equal(1, server.Copies);
    }

    private sealed class CountTransport : HttpMessageHandler
    {
        public int Calls { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
        { Calls++; return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)); }
    }

    [Theory]
    [InlineData("", "text/plain; charset=utf-8", "text/css; charset=utf-8")]
    [InlineData("Bearer invalid", "text/plain; charset=utf-8", "text/css; charset=utf-8")]
    [InlineData("AWS4-HMAC-SHA256 Credential=x, SignedHeaders=host, Signature=invalid", "text/plain; charset=utf-8", "text/css; charset=utf-8")]
    [InlineData("AWS4-HMAC-SHA256 Credential=x, SignedHeaders=content-type;host, Signature=invalid", "application/json", "text/css; charset=utf-8")]
    [InlineData("AWS4-HMAC-SHA256 Credential=x, SignedHeaders=content-type;host, Signature=invalid", "text/plain; charset=utf-8", "invalid mime")]
    public async Task UnknownDuplicateOrUnsignedHeadersFailBeforeTransport(string auth, string first, string second)
    {
        var transport = new CountTransport();
        using var http = CopyClient(transport);
        using var request = new HttpRequestMessage(HttpMethod.Put, "http://minio.test/object") { Content = new ByteArrayContent([]) };
        request.Content.Headers.TryAddWithoutValidation("Content-Type", new[] { first, second });
        if (auth.Length > 0) request.Headers.TryAddWithoutValidation("Authorization", auth);
        await Assert.ThrowsAsync<InvalidOperationException>(() => http.SendAsync(request));
        Assert.Equal(0, transport.Calls);
    }

    [Fact]
    public async Task CancellationDoesNotStartOrRetryCopy()
    {
        var server = new SignedCopyServer("text/css; charset=utf-8");
        using var http = CopyClient(server);
        using var sdk = Sdk(http);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => sdk.CopyObjectAsync(Args("private"), cancellation.Token));
        Assert.Equal(0, server.Copies);
    }
}
