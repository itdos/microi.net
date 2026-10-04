using System.Net;
using Aliyun.OSS;
using Aliyun.OSS.Common;
using Dos.Common;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class AliyunFolderMarkerProtocolTests
{
    // 真实 SDK 2.14.1 的 HTTP 夹具：严格要求零字节请求的 Content-Length，不能用 Code=1 掩盖缺头。
    private sealed record SeenRequest(string Method, string Path, string ContentLength, string TransferEncoding, long Bytes);

    private static async Task<(DosResult Result, SeenRequest[] Seen)> CreateMarker(bool isPrivate, string path, bool deny)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        await using var host = builder.Build();
        var seen = new List<SeenRequest>();
        host.Run(async context =>
        {
            using var bytes = new MemoryStream();
            await context.Request.Body.CopyToAsync(bytes);
            var length = context.Request.Headers.ContentLength.ToString();
            seen.Add(new(context.Request.Method, Uri.UnescapeDataString(context.Request.Path.Value!), length,
                context.Request.Headers.TransferEncoding.ToString(), bytes.Length));
            if (length != "0" || deny)
            {
                context.Response.StatusCode = deny ? 403 : 411;
                context.Response.ContentType = "application/xml";
                var code = deny ? "AccessDenied" : "MissingContentLength";
                await context.Response.WriteAsync("<Error><Code>" + code + "</Code><Message>" + code
                    + "</Message><RequestId>fixture</RequestId></Error>");
                return;
            }
            context.Response.StatusCode = 200;
            context.Response.Headers.ETag = "\"empty-marker-fixture\"";
        });
        await host.StartAsync();
        var endpoint = host.Urls.Single();
        var configuration = new JObject
        {
            ["AliOssPrivateBucketName"] = "private", ["AliOssPublicBucketName"] = "public",
            ["AliOssPrivateEndpoint"] = endpoint, ["AliOssPublicEndpoint"] = endpoint,
            ["AliOssPrivateAccessKeyId"] = "fixture-access", ["AliOssPublicAccessKeyId"] = "fixture-access",
            ["AliOssPrivateAccessKeySecret"] = "fixture-secret", ["AliOssPublicAccessKeySecret"] = "fixture-secret"
        };
        try
        {
            var result = await Task.Run(() => new MicroiHDFSAliyun().CreateFolder(new HDFSParam
            {
                ClientModel = new OsClientSecret { OsClient = "itdos", OsClientModel = configuration },
                Limit = isPrivate, FileFullPath = path
            }));
            return (result, seen.ToArray());
        }
        finally { await host.StopAsync(); }
    }

    [Theory]
    [InlineData(true, "/itdos/file/original-request/")]
    [InlineData(false, "/itdos/file/original-request/")]
    [InlineData(true, "/itdos/file/original-request")]
    [InlineData(false, "/itdos/file/original-request")]
    public async Task EmptyMarkerHasExplicitZeroLengthWithoutChangingBucketOrKey(bool isPrivate, string path)
    {
        var (result, seen) = await CreateMarker(isPrivate, path, false);
        Assert.Equal(1, result.Code);
        var request = Assert.Single(seen);
        Assert.Equal("PUT", request.Method);
        Assert.Equal("/" + (isPrivate ? "private" : "public") + "/itdos/file/original-request/", request.Path);
        Assert.Equal("0", request.ContentLength);
        Assert.Equal("", request.TransferEncoding);
        Assert.Equal(0, request.Bytes);
    }

    [Fact]
    public async Task ProviderDenialDoesNotBecomeSuccessfulFolderCreation()
    {
        var (result, seen) = await CreateMarker(true, "/itdos/file/original-request/", true);
        Assert.Equal(0, result.Code);
        Assert.Contains("AccessDenied", result.Msg);
        var request = Assert.Single(seen); // 403 无重试、无对象或桶改址。
        Assert.Equal("0", request.ContentLength);
        Assert.Equal("/private/itdos/file/original-request/", request.Path);
    }
}
