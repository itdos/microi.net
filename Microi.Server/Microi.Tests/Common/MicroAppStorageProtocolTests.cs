using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Dos.Common;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

// FormEngine 服务定位器属于共享测试状态，必须与其它租户上下文测试串行并原样恢复。
[Collection("TenantContextGlobal")]
public class MicroAppStorageProtocolTests
{
    private const string Html = "<!doctype html><html><head><title>fixture</title></head><body>fixture</body></html>";

    public class ConfigProxy : DispatchProxy
    {
        public object? Config;
        public string? Tenant;
        public int Code = 1;
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name != nameof(IFormEngine.GetSysConfig)) throw new InvalidOperationException(method.Name);
            Tenant = (string)args![0]!;
            return Task.FromResult(new DosResult<dynamic>(Code, Config));
        }
    }

    private sealed class ConfigScope : IDisposable
    {
        private readonly FieldInfo field = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        private readonly object? previous;
        private readonly ServiceProvider provider;
        public ConfigProxy Proxy { get; }
        public ConfigScope(object? config, int code = 1)
        {
            var forms = DispatchProxy.Create<IFormEngine, ConfigProxy>();
            Proxy = (ConfigProxy)forms;
            Proxy.Config = config;
            Proxy.Code = code;
            provider = new ServiceCollection().AddSingleton(forms).BuildServiceProvider();
            previous = field.GetValue(null);
            field.SetValue(null, provider);
        }
        public void Dispose() { field.SetValue(null, previous); provider.Dispose(); }
    }

    private static Task<string> FileServer() => (Task<string>)typeof(MicroAppController)
        .GetMethod("GetFileServer", BindingFlags.Static | BindingFlags.NonPublic)!.Invoke(null, ["fixture-tenant"])!;

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task TenantFileServerKeepsItsConfiguredDomainAndBucketPath(bool jsonObject)
    {
        object config = jsonObject ? new JObject { ["FileServer"] = "https://files.example.test/public" }
            : new { FileServer = "https://files.example.test/public" };
        using var scope = new ConfigScope(config);
        Assert.Equal("https://files.example.test/public", await FileServer());
        Assert.Equal("fixture-tenant", scope.Proxy.Tenant);
    }

    [Theory]
    [InlineData(null, 0)]
    [InlineData("", 1)]
    [InlineData("javascript:alert(1)", 1)]
    [InlineData("https://user:secret@files.example.test/public", 1)]
    [InlineData("https://files.example.test/public?signature=secret", 1)]
    public async Task MissingOrInvalidFileServerDoesNotFallBackToAnotherTenant(string? url, int code)
    {
        using var scope = new ConfigScope(url == null ? null : new JObject { ["FileServer"] = url }, code);
        Assert.Equal("", await FileServer());
    }

    private static WebApplication NewHost()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.Services.AddControllers();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        return builder.Build();
    }

    [Theory]
    [InlineData("MinIO", false, "index.html", "text/html")]
    [InlineData("MinIO", true, "app.JS", "javascript")]
    [InlineData("MinIO", false, "app.css", "text/css")]
    [InlineData("S3", true, "index.html", "text/html")]
    [InlineData("S3", false, "app.js", "javascript")]
    [InlineData("S3", false, "app.css", "text/css")]
    [InlineData("Aliyun", false, "index.html", "text/html")]
    [InlineData("Aliyun", true, "app.js", "javascript")]
    [InlineData("Aliyun", false, "app.css", "text/css")]
    [InlineData("MinIO", false, "photo.png", "image/png")]
    [InlineData("S3", true, "document.pdf", "application/pdf")]
    [InlineData("Aliyun", false, "asset.bin", "application/octet-stream")]
    [InlineData("MinIO", false, "app.mjs", "javascript")]
    [InlineData("S3", false, "app.wasm", "application/wasm")]
    [InlineData("Aliyun", true, "icon.svg", "image/svg+xml")]
    [InlineData("MinIO", false, "font.woff2", "font/woff2")]
    public async Task RealStorageSdkUploadsUseBrowserCompatibleMetadata(string provider, bool isPrivate, string file, string type)
    {
        await using var host = NewHost();
        var puts = new List<(string Path, string ContentType, byte[] Bytes)>();
        var objects = new Dictionary<string, byte[]>();
        host.Run(async context =>
        {
            if (context.Request.Method == "PUT")
            {
                using var body = new MemoryStream();
                await context.Request.Body.CopyToAsync(body);
                puts.Add((context.Request.Path, context.Request.ContentType ?? "", body.ToArray()));
                objects[context.Request.Path] = body.ToArray();
                context.Response.Headers.ETag = "\"fixture-etag\"";
                return;
            }
            if (context.Request.Query.ContainsKey("location"))
            {
                context.Response.ContentType = "application/xml";
                await context.Response.WriteAsync("<LocationConstraint xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\">us-east-1</LocationConstraint>");
                return;
            }
            if (objects.TryGetValue(context.Request.Path, out var stored))
            {
                context.Response.Headers.ETag = "\"fixture-etag\"";
                context.Response.ContentLength = stored.Length;
                if (context.Request.Method != "HEAD") await context.Response.Body.WriteAsync(stored);
                return;
            }
            // MinIO 的成功条件还包括桶与对象 HEAD 回读；夹具必须实现 SDK 真正访问的协议。
            if (context.Request.Method == "HEAD" && context.Request.Path.Value!.Count(c => c == '/') == 1) return;
            context.Response.StatusCode = 404;
        });
        await host.StartAsync();
        var endpoint = host.Urls.Single();
        var config = new JObject
        {
            ["MinIOEndPoint"] = endpoint.Replace("http://", ""), ["MinIOEndPointInternet"] = endpoint.Replace("http://", ""),
            ["MinIORegion"] = "us-east-1", ["MinIOAccessKey"] = "fixture-access", ["MinIOSecretKey"] = "fixture-secret",
            ["MinIOPublicBucketName"] = "public", ["MinIOPrivateBucketName"] = "private",
            ["AliOssPublicEndpoint"] = endpoint, ["AliOssPrivateEndpoint"] = endpoint,
            ["AliOssPublicBucketName"] = "public", ["AliOssPrivateBucketName"] = "private",
            ["AliOssPublicAccessKeyId"] = "fixture-access", ["AliOssPrivateAccessKeyId"] = "fixture-access",
            ["AliOssPublicAccessKeySecret"] = "fixture-secret", ["AliOssPrivateAccessKeySecret"] = "fixture-secret"
        };
        var bytes = Encoding.UTF8.GetBytes(file.EndsWith("html") ? Html : "fixture body");
        using var source = new MemoryStream(bytes);
        IMicroiHDFS storage = provider switch { "MinIO" => new MicroiHDFSMinIO(), "S3" => new MicroiHDFSAmazonS3(), _ => new MicroiHDFSAliyun() };
        var result = await Task.Run(() => storage.PutObject(new HDFSParam
        {
            ClientModel = new OsClientSecret { OsClient = "fixture-tenant", OsClientModel = config },
            Limit = isPrivate, FileFullPath = "/fixture-tenant/app/" + file, FileStream = source, ContentLength = bytes.Length
        }));
        Assert.True(result.Code == 1, result.Msg);
        var request = Assert.Single(puts);
        Assert.Equal("/" + (isPrivate ? "private" : "public") + "/fixture-tenant/app/" + file, request.Path);
        Assert.Contains(type, request.ContentType, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(bytes, request.Bytes);
    }

    // HTTP 上游真实返回二进制标签；网关仍须输出已提交清单中的正确类型，并拒绝错误正文。
    [Theory]
    [InlineData("index.html", "application/octet-stream", Html, true)]
    [InlineData("assets/app.js", "application/octet-stream", "export const value = 1;", true)]
    [InlineData("assets/app.css", "application/octet-stream", "body { color: blue; }", true)]
    [InlineData("index.html", "text/html", Html, true)]
    [InlineData("index.html", "application/octet-stream", "<Error><Code>NoSuchKey</Code></Error>", false)]
    [InlineData("index.html", "text/html", "<html>incomplete</html>", false)]
    [InlineData("assets/app.js", "text/html", Html, false)]
    public async Task ImmutableProxyRecoversLegacyMimeWithoutAcceptingStorageErrorPages(string path, string type, string body, bool success)
    {
        await using var host = NewHost();
        host.Run(async context => { context.Response.ContentType = type; await context.Response.WriteAsync(body); });
        await host.StartAsync();
        using var scope = new ConfigScope(new JObject { ["FileServer"] = host.Urls.Single() + "/public" });
        var http = new DefaultHttpContext();
        http.Request.Method = "GET";
        http.Response.Body = new MemoryStream();
        var controller = new MicroAppController { ControllerContext = new ControllerContext { HttpContext = http } };
        var bytes = Encoding.UTF8.GetBytes(body);
        var manifest = new JObject
        {
            ["Path"] = path, ["Size"] = bytes.Length,
            ["Sha256"] = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant()
        };
        var method = typeof(MicroAppController).GetMethod("ProxyApplicationAssetV3", BindingFlags.NonPublic | BindingFlags.Instance)!;
        var result = await (Task<IActionResult>)method.Invoke(controller, ["fixture-tenant", host.Urls.Single() + "/public/" + path, path, manifest])!;
        if (!success) { Assert.Equal(502, Assert.IsType<ObjectResult>(result).StatusCode); return; }
        Assert.Equal("nosniff", http.Response.Headers["X-Content-Type-Options"]);
        var output = result is FileContentResult fileResult ? fileResult.FileContents : ((MemoryStream)http.Response.Body).ToArray();
        var outputType = result is FileContentResult f ? f.ContentType : http.Response.ContentType;
        Assert.Equal(bytes, output);
        Assert.Contains(path.EndsWith("html") ? "text/html" : path.EndsWith("js") ? "javascript" : "text/css", outputType!);
    }

    [Theory]
    [InlineData("index.html", false)]
    [InlineData("index.html", true)]
    [InlineData("assets/app.mjs", false)]
    [InlineData("assets/app.mjs", true)]
    [InlineData("assets/app.css", false)]
    [InlineData("assets/app.css", true)]
    public async Task RealHttpGatewayReturnsTheSameMimeAndIdentityForGetAndHead(string path, bool head)
    {
        var bytes = Encoding.UTF8.GetBytes(path.EndsWith("html") ? Html : "fixture body");
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var asset = new JObject { ["Path"] = path, ["Size"] = bytes.Length, ["Sha256"] = hash };
        var proxy = typeof(MicroAppController).GetMethod("ProxyApplicationAssetV3", BindingFlags.NonPublic | BindingFlags.Instance)!;
        await using var host = NewHost();
        host.Run(async context =>
        {
            if (context.Request.Path.StartsWithSegments("/public"))
            {
                context.Response.ContentType = "application/octet-stream";
                context.Response.ContentLength = bytes.Length;
                if (context.Request.Method != "HEAD") await context.Response.Body.WriteAsync(bytes);
                return;
            }
            var controller = new MicroAppController { ControllerContext = new ControllerContext { HttpContext = context } };
            var result = await (Task<IActionResult>)proxy.Invoke(controller,
                ["fixture-tenant", host.Urls.Single() + "/public/" + path, path, asset])!;
            await result.ExecuteResultAsync(new ActionContext(context, new RouteData(), new ActionDescriptor()));
        });
        await host.StartAsync();
        using var scope = new ConfigScope(new JObject { ["FileServer"] = host.Urls.Single() + "/public" });
        using var client = new HttpClient();
        using var response = await client.SendAsync(new HttpRequestMessage(head ? HttpMethod.Head : HttpMethod.Get,
            host.Urls.Single() + "/gateway/" + path));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("\"" + hash + "\"", response.Headers.ETag!.ToString());
        Assert.Contains(path.EndsWith("html") ? "text/html" : path.EndsWith("mjs") ? "javascript" : "text/css",
            response.Content.Headers.ContentType!.ToString());
        Assert.Equal(bytes.Length, response.Content.Headers.ContentLength);
        Assert.Equal(head ? [] : bytes, await response.Content.ReadAsByteArrayAsync());
    }

    [Theory]
    [InlineData(404, false, false)]
    [InlineData(403, false, false)]
    [InlineData(503, false, false)]
    [InlineData(200, true, false)]
    [InlineData(200, false, true)]
    public async Task ImmutableEntryStillRejectsUpstreamErrorsSizeDriftAndHashDrift(int status, bool badSize, bool badHash)
    {
        await using var host = NewHost();
        host.Run(async context => { context.Response.StatusCode = status; context.Response.ContentType = "application/octet-stream"; await context.Response.WriteAsync(Html); });
        await host.StartAsync();
        using var scope = new ConfigScope(new JObject { ["FileServer"] = host.Urls.Single() });
        var context = new DefaultHttpContext();
        context.Request.Method = "GET";
        var controller = new MicroAppController { ControllerContext = new ControllerContext { HttpContext = context } };
        var bytes = Encoding.UTF8.GetBytes(Html);
        var asset = new JObject { ["Size"] = bytes.Length + (badSize ? 1 : 0), ["Sha256"] = badHash ? new string('0', 64) : Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant() };
        var method = typeof(MicroAppController).GetMethod("ProxyApplicationAssetV3", BindingFlags.NonPublic | BindingFlags.Instance)!;
        var result = await (Task<IActionResult>)method.Invoke(controller, ["fixture-tenant", host.Urls.Single() + "/index.html", "index.html", asset])!;
        Assert.Equal(status == 200 ? 502 : status, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    private sealed class ForwardReadStream(byte[] bytes) : Stream
    {
        private readonly MemoryStream inner = new(bytes);
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count) => inner.Read(buffer, offset, count);
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken token) => inner.ReadAsync(buffer, offset, count, token);
        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        protected override void Dispose(bool disposing) { if (disposing) inner.Dispose(); base.Dispose(disposing); }
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task OssNonSeekableMultipartSetsFinalObjectMimeAtInitiation(bool isPrivate)
    {
        await using var host = NewHost();
        string? initialType = null;
        var parts = new List<byte[]>();
        host.Run(async context =>
        {
            context.Response.ContentType = "application/xml";
            if (context.Request.Query.ContainsKey("uploads"))
            {
                initialType = context.Request.ContentType;
                await context.Response.WriteAsync("<InitiateMultipartUploadResult><Bucket>public</Bucket><Key>fixture-tenant/app/app.js</Key><UploadId>fixture-upload</UploadId></InitiateMultipartUploadResult>");
            }
            else if (context.Request.Method == "PUT")
            {
                using var body = new MemoryStream();
                await context.Request.Body.CopyToAsync(body);
                parts.Add(body.ToArray());
                context.Response.Headers.ETag = "\"fixture-part-etag\"";
            }
            else if (context.Request.Method == "POST")
                await context.Response.WriteAsync("<CompleteMultipartUploadResult><Location>fixture</Location><Bucket>public</Bucket><Key>fixture-tenant/app/app.js</Key><ETag>fixture-etag</ETag></CompleteMultipartUploadResult>");
            else context.Response.StatusCode = 400;
        });
        await host.StartAsync();
        var endpoint = host.Urls.Single();
        var config = new JObject
        {
            ["AliOssPublicEndpoint"] = endpoint, ["AliOssPrivateEndpoint"] = endpoint,
            ["AliOssPublicBucketName"] = "public", ["AliOssPrivateBucketName"] = "private",
            ["AliOssPublicAccessKeyId"] = "fixture-access", ["AliOssPrivateAccessKeyId"] = "fixture-access",
            ["AliOssPublicAccessKeySecret"] = "fixture-secret", ["AliOssPrivateAccessKeySecret"] = "fixture-secret"
        };
        var bytes = Encoding.UTF8.GetBytes("export const value = 1;");
        using var source = new ForwardReadStream(bytes);
        var result = await Task.Run(() => new MicroiHDFSAliyun().PutObject(new HDFSParam
        {
            ClientModel = new OsClientSecret { OsClient = "fixture-tenant", OsClientModel = config },
            Limit = isPrivate, FileFullPath = "/fixture-tenant/app/app.js", FileStream = source, ContentLength = bytes.Length
        }));
        Assert.True(result.Code == 1, result.Msg);
        Assert.Contains("javascript", initialType!);
        Assert.Equal(bytes, Assert.Single(parts));
    }
}
