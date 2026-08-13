using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using Microi.net;
using Minio;

namespace Microi.Tests.Common;

public class MicroiHdfsMinioEndpointTests
{
    private static bool ShouldUseInternetEndpoint(bool? networkIsInternet, string returnFileType)
    {
        var method = typeof(MicroiHDFSMinIO).GetMethod(
            "ShouldUseInternetEndpoint",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        return (bool)method!.Invoke(null, new object?[] { networkIsInternet, returnFileType })!;
    }

    private static bool? ResolvePrivateFileNetworkPreference(
        bool auditProxyEnabled,
        bool? limit,
        string returnFileType)
    {
        var method = typeof(MicroiHDFS).GetMethod(
            "ResolvePrivateFileNetworkPreference",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        return (bool?)method!.Invoke(null, new object?[]
        {
            auditProxyEnabled,
            limit,
            returnFileType
        });
    }

    private static string ResolvePlatformStoragePath(string osClient, string filePath)
    {
        var method = typeof(MicroiHDFS).GetMethod(
            "ResolvePlatformStoragePath",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        return (string)method!.Invoke(null, new object?[] { osClient, filePath })!;
    }

    private static bool? ResolveUploadNetworkPreference(bool hasHttpContext)
    {
        var method = typeof(MicroiHDFS).GetMethod(
            "ResolveUploadNetworkPreference",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (bool?)method!.Invoke(null, new object?[] { hasHttpContext });
    }

    private static string BuildUploadReadbackDiagnostic(Exception exception, string bucket, string objectName)
    {
        var method = typeof(MicroiHDFSMinIO).GetMethod(
            "BuildUploadReadbackDiagnostic",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (string)method!.Invoke(null, new object?[] { exception, bucket, objectName })!;
    }

    private static string BuildAliyunFailureDiagnostic(
        string operation,
        bool limit,
        string bucket,
        string objectName,
        Exception exception)
    {
        var method = typeof(MicroiHDFSAliyun).GetMethod(
            "BuildOssFailureMessage",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (string)method!.Invoke(null, new object?[]
        {
            operation,
            new HDFSParam { Limit = limit, FileFullPath = objectName },
            bucket,
            exception
        })!;
    }

    private static bool IsRangeReadbackObjectPresent(
        int statusCode,
        long? contentLength,
        long? contentRangeLength,
        int bytesRead)
    {
        var method = typeof(MicroiHDFSMinIO).GetMethod(
            "IsRangeReadbackObjectPresent",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (bool)method!.Invoke(null, new object?[]
        {
            statusCode,
            contentLength,
            contentRangeLength,
            bytesRead
        })!;
    }

    private static bool IsRangeReadbackVerified(
        int statusCode,
        long? contentLength,
        long? contentRangeLength,
        int bytesRead,
        long expectedSize)
    {
        var method = typeof(MicroiHDFSMinIO).GetMethod(
            "IsRangeReadbackVerified",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (bool)method!.Invoke(null, new object?[]
        {
            statusCode,
            contentLength,
            contentRangeLength,
            bytesRead,
            expectedSize
        })!;
    }

    private sealed class RecordingRangeHandler : HttpMessageHandler
    {
        public HttpMethod? RequestMethod { get; private set; }
        public RangeHeaderValue? Range { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestMethod = request.Method;
            Range = request.Headers.Range;
            var content = new ByteArrayContent(new byte[] { 0x2A });
            content.Headers.ContentRange = new ContentRangeHeaderValue(0, 0, 123);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.PartialContent)
            {
                Content = content
            });
        }
    }

    [Theory]
    [InlineData(null, "Byte", false)]
    [InlineData(null, "Url", true)]
    [InlineData(false, "Url", false)]
    [InlineData(true, "Byte", true)]
    public void ServerSideByteReadsPreferInternalEndpointUnlessExplicitlyOverridden(
        bool? networkIsInternet,
        string returnFileType,
        bool expected)
    {
        Assert.Equal(expected, ShouldUseInternetEndpoint(networkIsInternet, returnFileType));
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, null)]
    public void BackgroundUploadsForceInternalEndpointWhileHttpKeepsDeploymentSelection(
        bool hasHttpContext,
        bool? expected)
    {
        Assert.Equal(expected, ResolveUploadNetworkPreference(hasHttpContext));
    }

    [Theory]
    [InlineData(true, true, "Url", false)]
    [InlineData(true, null, "Url", false)]
    [InlineData(false, true, "Url", null)]
    [InlineData(true, false, "Url", null)]
    [InlineData(true, true, "Byte", null)]
    public void PrivateAuditGatewayUsesInternalObjectEndpointOnlyForPrivateUrlResponses(
        bool auditProxyEnabled,
        bool? limit,
        string returnFileType,
        bool? expected)
    {
        Assert.Equal(expected, ResolvePrivateFileNetworkPreference(
            auditProxyEnabled,
            limit,
            returnFileType));
    }

    [Theory]
    [InlineData("iTdos", "/itdos/database-backups/tasks/a/attempt-1.zip", "/database-backups/tasks/a/attempt-1.zip")]
    [InlineData("iTdos", "/ITDOS/database-backups/tasks/a/attempt-1.zip", "/database-backups/tasks/a/attempt-1.zip")]
    [InlineData("iTdos", "/database-backups/tasks/a/attempt-1.zip", "/database-backups/tasks/a/attempt-1.zip")]
    [InlineData("iTdos", "/itdos/user-files/a.zip", "/itdos/user-files/a.zip")]
    [InlineData("iTdos", "/other/database-backups/a.zip", "/other/database-backups/a.zip")]
    public void PlatformBackupPathRemovesOnlyTheSyntheticTenantPrefix(
        string osClient,
        string filePath,
        string expected)
    {
        Assert.Equal(expected, ResolvePlatformStoragePath(osClient, filePath));
    }

    [Theory]
    [InlineData("minio.internal:9000", false, "minio.internal", 9000, false)]
    [InlineData("https://files.example.com:9443/", false, "files.example.com", 9443, true)]
    [InlineData("http://10.0.0.8:9000", true, "10.0.0.8", 9000, false)]
    [InlineData("files.example.com", true, "files.example.com", 443, true)]
    public void EndpointNormalization_AcceptsHostPortAndAbsoluteHttpUrls(
        string endpoint,
        bool configuredSsl,
        string expectedHost,
        int expectedPort,
        bool expectedSsl)
    {
        var actual = MicroiHDFSMinIO.NormalizeEndpoint(endpoint, configuredSsl);

        Assert.Equal(expectedHost, actual.Host);
        Assert.Equal(expectedPort, actual.Port);
        Assert.Equal(expectedSsl, actual.UseSsl);
    }

    [Theory]
    [InlineData("https://user:secret@files.example.com:9443")]
    [InlineData("https://files.example.com/mci-public")]
    [InlineData("https://files.example.com:9443?bucket=mci-public")]
    [InlineData("ftp://files.example.com:21")]
    public void EndpointNormalization_RejectsCredentialsPathsQueriesAndUnsupportedSchemes(string endpoint)
    {
        var exception = Assert.Throws<ArgumentException>(() =>
            MicroiHDFSMinIO.NormalizeEndpoint(endpoint, configuredSsl: false));

        Assert.Contains("MinIO Endpoint", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void UploadReadbackAccessDenied_ReturnsChinesePolicyAndProxyResolution()
    {
        var message = BuildUploadReadbackDiagnostic(
            new InvalidOperationException("Access denied on the resource: /public/"),
            "public",
            "tenant-a/avatar.png");

        Assert.Contains("HEAD/Stat 回读被拒绝", message, StringComparison.Ordinal);
        Assert.Contains("s3:GetObject", message, StringComparison.Ordinal);
        Assert.Contains("s3:ListBucket", message, StringComparison.Ordinal);
        Assert.Contains("s3:GetBucketLocation", message, StringComparison.Ordinal);
        Assert.Contains("proxy_cache_convert_head off", message, StringComparison.Ordinal);
        Assert.Contains("签名 Range GET", message, StringComparison.Ordinal);
        Assert.Contains("不会跳过上传后回读校验", message, StringComparison.Ordinal);
    }

    [Fact]
    public void AliyunForbiddenDiagnostic_IdentifiesScopeObjectPermissionsAndSolution()
    {
        var message = BuildAliyunFailureDiagnostic(
            "对象存在性检查",
            true,
            "tenant-private",
            "tenant/ai-app-source/app/SOURCE-PROVENANCE.json",
            new InvalidOperationException("Response status code does not indicate success: 403 (Forbidden)."));

        Assert.Contains("ErrorType=OBJECT_STORAGE_FORBIDDEN", message, StringComparison.Ordinal);
        Assert.Contains("StorageScope=私有桶", message, StringComparison.Ordinal);
        Assert.Contains("Bucket=tenant-private", message, StringComparison.Ordinal);
        Assert.Contains("SOURCE-PROVENANCE.json", message, StringComparison.Ordinal);
        Assert.Contains("oss:GetObject", message, StringComparison.Ordinal);
        Assert.Contains("oss:PutObject", message, StringComparison.Ordinal);
        Assert.Contains("解决方案=", message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(206, 1L, 123L, 1, 123L, true)]
    [InlineData(206, null, 123L, 1, 123L, true)]
    [InlineData(206, 1L, 122L, 1, 123L, false)]
    [InlineData(206, 1L, 123L, 0, 123L, false)]
    [InlineData(200, 123L, null, 1, 123L, true)]
    [InlineData(200, null, null, 1, 123L, false)]
    [InlineData(200, 0L, null, 0, 0L, true)]
    [InlineData(416, null, 0L, 0, 0L, true)]
    public void SignedRangeReadbackRequiresExactSizeAndOneContentByte(
        int statusCode,
        long? contentLength,
        long? contentRangeLength,
        int bytesRead,
        long expectedSize,
        bool expected)
    {
        Assert.Equal(expected, IsRangeReadbackVerified(
            statusCode,
            contentLength,
            contentRangeLength,
            bytesRead,
            expectedSize));
    }

    [Theory]
    [InlineData(206, 1L, 123L, 1, true)]
    [InlineData(200, 0L, null, 0, true)]
    [InlineData(416, null, 0L, 0, true)]
    [InlineData(404, null, null, 0, false)]
    [InlineData(403, null, null, 0, false)]
    public void SignedRangeExistenceProbeDistinguishesMissingAndUnreadableObjects(
        int statusCode,
        long? contentLength,
        long? contentRangeLength,
        int bytesRead,
        bool expected)
    {
        Assert.Equal(expected, IsRangeReadbackObjectPresent(
            statusCode,
            contentLength,
            contentRangeLength,
            bytesRead));
    }

    [Fact]
    public async Task SignedRangeReadbackUsesGetWithOneByteRangeWithoutStatPreflight()
    {
        var handler = new RecordingRangeHandler();
        using var httpClient = new HttpClient(handler);
        var minioClient = new MinioClient()
            .WithEndpoint("minio.test", 9000)
            .WithCredentials("test-access", "test-secret")
            .WithRegion("us-east-1")
            .Build();
        var method = typeof(MicroiHDFSMinIO).GetMethods(
                BindingFlags.NonPublic | BindingFlags.Static)
            .Single(candidate => candidate.Name == "ReadObjectRangeAsync"
                                 && candidate.GetParameters().Length == 4);

        var task = (Task)method.Invoke(null, new object?[]
        {
            minioClient,
            "public",
            "qiqiang/test.bin",
            httpClient
        })!;
        await task;
        var result = task.GetType().GetProperty("Result")!.GetValue(task)!;
        var resultType = result.GetType();

        Assert.Equal(HttpMethod.Get, handler.RequestMethod);
        var range = Assert.Single(handler.Range!.Ranges);
        Assert.Equal(0, range.From);
        Assert.Equal(0, range.To);
        Assert.Equal(HttpStatusCode.PartialContent,
            resultType.GetProperty("StatusCode")!.GetValue(result));
        Assert.Equal(123L,
            resultType.GetProperty("ContentRangeLength")!.GetValue(result));
        Assert.Equal(1,
            resultType.GetProperty("BytesRead")!.GetValue(result));
    }
}
