using System;
using System.Reflection;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public class ApplicationCdnCredentialTests
{
    private static (Uri Target, bool Required, string Error) RefreshTarget(string url)
    {
        var method = typeof(V8McpLogic).GetMethod("ResolveApplicationCdnRefreshTarget",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return ((Uri, bool, string))method.Invoke(null, new object[] { url })!;
    }

    [Theory]
    [InlineData("http://192.0.2.20:9000/public/tenant/micro-app/planner/index.html")]
    [InlineData("http://[::1]:9000/public/tenant/micro-app/planner/index.html")]
    [InlineData("http://storage.internal:9000/public/tenant/micro-app/planner/index.html")]
    [InlineData("https://storage.example/public/tenant/micro-app/planner/index.html")]
    [InlineData("https://static.itdos.com.example/public/tenant/micro-app/planner/index.html")]
    public void NonOfficialStorageDoesNotRequireAliyunPurge(string url)
    {
        var result = RefreshTarget(url);
        Assert.Null(result.Error);
        Assert.False(result.Required);
        Assert.Equal(new Uri(url), result.Target);
    }

    [Theory]
    [InlineData("https://static.itdos.com/tenant/micro-app/planner/index.html")]
    [InlineData("https://STATIC.ITDOS.COM/tenant/micro-app/planner/index.html")]
    public void OfficialCdnStillRequiresAuthenticatedRefresh(string url)
    {
        var result = RefreshTarget(url);
        Assert.Null(result.Error);
        Assert.True(result.Required);
    }

    [Theory]
    [InlineData("http://static.itdos.com/tenant/micro-app/planner/index.html")]
    [InlineData("https://user:secret@static.itdos.com/tenant/index.html")]
    [InlineData("http://user:secret@192.0.2.20/public/tenant/index.html")]
    [InlineData("https://static.itdos.com/tenant/index.html?credential=unsafe")]
    [InlineData("http://storage.internal/public/tenant/index.html#fragment")]
    [InlineData("ftp://storage.internal/public/tenant/index.html")]
    [InlineData("/tenant/micro-app/planner/index.html")]
    [InlineData("")]
    [InlineData(null)]
    public void InvalidOrDowngradedCdnTargetFailsClosed(string url)
    {
        var result = RefreshTarget(url);
        Assert.NotNull(result.Error);
        Assert.DoesNotContain("secret", result.Error);
        Assert.DoesNotContain("unsafe", result.Error);
    }

    [Theory]
    [InlineData("https://static.itdos.com/tenant/micro-app/planner/assets/main.js", true)]
    [InlineData("http://static.itdos.com/tenant/micro-app/planner/assets/main.js", false)]
    [InlineData("https://other.example/tenant/micro-app/planner/assets/main.js", false)]
    [InlineData("https://static.itdos.com.example/tenant/micro-app/planner/assets/main.js", false)]
    [InlineData("https://static.itdos.com:444/tenant/micro-app/planner/assets/main.js", false)]
    [InlineData("https://user:secret@static.itdos.com/tenant/micro-app/planner/assets/main.js", false)]
    [InlineData("https://static.itdos.com/tenant/micro-app/planner/assets/main.js?credential=unsafe", false)]
    public void RefreshAssetsCannotChangeTrustedAuthorityOrTransport(string url, bool expected)
    {
        var method = typeof(V8McpLogic).GetMethod("IsApplicationCdnRefreshAssetUrl",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        Assert.Equal(expected, method.Invoke(null, new object[] { url,
            new Uri("https://static.itdos.com/tenant/micro-app/planner/index.html") }));
    }

    private static bool IsMissingPublicObject(DosResult result)
    {
        var method = typeof(V8McpLogic).GetMethod("IsApplicationCdnMissingPublicObject",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (bool)method.Invoke(null, new object[] { result })!;
    }

    [Fact]
    public void PublicProjectionCopiesOnlyAfterExplicitMissingKey()
    {
        Assert.True(IsMissingPublicObject(new DosResult(0)
        {
            DataAppend = new { StorageReadErrorCode = "NoSuchKey", StorageReadHttpStatusCode = 404 }
        }));
        // OSS SDK 只公开明确的 ErrorCode；已由提供商验证后仍可沿原协议补写。
        Assert.True(IsMissingPublicObject(new DosResult(0)
        {
            DataAppend = new { StorageReadErrorCode = "NoSuchKey" }
        }));
        Assert.False(IsMissingPublicObject(null));
    }

    [Theory]
    [InlineData("NoSuchKey")]
    [InlineData("The specified key does not exist.")]
    [InlineData("对象不存在")]
    [InlineData("HTTP 403，Bucket=nosuchkey，Object=assets/nosuchkey.js")]
    [InlineData("AccessDenied; Object=assets/对象不存在.js")]
    [InlineData("HTTP 404; Object=assets/The specified key does not exist.js")]
    [InlineData("Socket timeout")]
    public void DiagnosticTextNeverAuthorizesCdnObjectCopy(string message)
    {
        Assert.False(IsMissingPublicObject(new DosResult(0, null, message)));
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("[]")]
    [InlineData("\"NoSuchKey\"")]
    [InlineData("{\"StorageReadErrorCode\":\"AccessDenied\"}")]
    [InlineData("{\"StorageReadErrorCode\":\"NoSuchBucket\"}")]
    [InlineData("{\"StorageReadErrorCode\":\"nosuchkey\"}")]
    [InlineData("{\"StorageReadErrorCode\":\" NoSuchKey\"}")]
    [InlineData("{\"StorageReadErrorCode\":404}")]
    [InlineData("{\"StorageReadErrorCode\":\"NoSuchKey\",\"StorageReadHttpStatusCode\":403}")]
    [InlineData("{\"StorageReadErrorCode\":\"NoSuchKey\",\"StorageReadHttpStatusCode\":\"404\"}")]
    [InlineData("{\"StorageReadErrorCode\":\"NoSuchKey\",\"StorageReadHttpStatusCode\":9223372036854775808}")]
    public void MissingObjectMetadataFailsClosedOnUnknownOrConflictingValues(string metadata)
    {
        Assert.False(IsMissingPublicObject(new DosResult(0, null, "NoSuchKey")
        {
            DataAppend = JToken.Parse(metadata)
        }));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(1002)]
    public void OnlyAFailedReadCanCarryMissingObjectSemantics(int code)
    {
        Assert.False(IsMissingPublicObject(new DosResult(code)
        {
            DataAppend = new { StorageReadErrorCode = "NoSuchKey", StorageReadHttpStatusCode = 404 }
        }));
    }

    private static (string Id, string Secret, string Error) Resolve(JObject settings, JObject saas)
    {
        var method = typeof(V8McpLogic).GetMethod("ResolveApplicationCdnCredentials",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        var result = method.Invoke(null, new object[] { settings, saas });
        Assert.NotNull(result);
        var type = result.GetType();
        return ((string)type.GetField("Item1")!.GetValue(result),
            (string)type.GetField("Item2")!.GetValue(result),
            (string)type.GetField("Item3")!.GetValue(result));
    }

    [Fact]
    public void CurrentTenantCdnCredentialTakesPrecedence()
    {
        var settings = new JObject
        {
            ["Integration.Cdn.Aliyun.AccessKeyId"] = "current-id",
            ["Integration.Cdn.Aliyun.AccessKeySecret"] = "current-secret"
        };
        var saas = new JObject { ["AlidnsKeyId"] = "old-id", ["AlidnsKeySecret"] = "old-secret" };
        var result = Resolve(settings, saas);
        Assert.Equal("current-id", result.Id);
        Assert.Equal("current-secret", result.Secret);
        Assert.Null(result.Error);
    }

    [Fact]
    public void LegacyDnsCredentialKeepsOfficialPublisherUsable()
    {
        var saas = new JObject { ["AlidnsKeyId"] = "dns-id", ["AlidnsKeySecret"] = "dns-secret" };
        var result = Resolve(new JObject(), saas);
        Assert.Equal("dns-id", result.Id);
        Assert.Equal("dns-secret", result.Secret);
        Assert.Null(result.Error);
    }

    [Fact]
    public void TenantDnsCredentialTakesPrecedenceOverLegacySaas()
    {
        var settings = new JObject
        {
            ["Integration.Dns.Aliyun.AccessKeyId"] = "tenant-dns-id",
            ["Integration.Dns.Aliyun.AccessKeySecret"] = "tenant-dns-secret"
        };
        var saas = new JObject { ["AlidnsKeyId"] = "old-id", ["AlidnsKeySecret"] = "old-secret" };
        var result = Resolve(settings, saas);
        Assert.Equal("tenant-dns-id", result.Id);
        Assert.Equal("tenant-dns-secret", result.Secret);
        Assert.Null(result.Error);
    }

    [Fact]
    public void LegacyPublicOssCredentialRemainsCompatible()
    {
        var saas = new JObject
        {
            ["AliOssPublicAccessKeyId"] = "oss-id",
            ["AliOssPublicAccessKeySecret"] = "oss-secret"
        };
        var result = Resolve(new JObject(), saas);
        Assert.Equal("oss-id", result.Id);
        Assert.Equal("oss-secret", result.Secret);
        Assert.Null(result.Error);
    }

    [Fact]
    public void PartialCurrentCredentialFailsClosed()
    {
        var settings = new JObject { ["Integration.Cdn.Aliyun.AccessKeyId"] = "partial-id" };
        var saas = new JObject { ["AlidnsKeyId"] = "old-id", ["AlidnsKeySecret"] = "old-secret" };
        var result = Resolve(settings, saas);
        Assert.Null(result.Id);
        Assert.NotNull(result.Error);
        Assert.Contains("不成对", result.Error);
    }

    [Fact]
    public void NoCredentialFailsWithoutLeakingSecret()
    {
        var result = Resolve(new JObject(), new JObject());
        Assert.Null(result.Id);
        Assert.Null(result.Secret);
        Assert.Contains("不可用", result.Error);
    }

    private static JArray ReadRefreshTasks(JObject response)
    {
        var method = typeof(V8McpLogic).GetMethod("ReadApplicationCdnRefreshTasks",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (JArray)method.Invoke(null, new object[] { response });
    }

    [Fact]
    public void RefreshTaskByIdAcceptsDocumentedDirectTasksArray()
    {
        var response = JObject.Parse("""
            {"Tasks":[{"TaskId":"24840","Status":"Complete"}]}
            """);
        var tasks = ReadRefreshTasks(response);
        Assert.Single(tasks);
        Assert.Equal("Complete", (string)tasks[0]["Status"]);
    }

    [Fact]
    public void RefreshTaskParserKeepsLegacyWrappedTasksCompatible()
    {
        var response = JObject.Parse("""
            {"Tasks":{"CDNTask":[{"TaskId":"24840","Status":"Refreshing"}]}}
            """);
        var tasks = ReadRefreshTasks(response);
        Assert.Single(tasks);
        Assert.Equal("Refreshing", (string)tasks[0]["Status"]);
    }

    [Fact]
    public void RefreshTaskParserRejectsUnrecognizedShape()
    {
        Assert.Null(ReadRefreshTasks(new JObject { ["Tasks"] = "unexpected" }));
    }

    [Theory]
    [InlineData("阿里云 CDN RefreshObjectCaches 失败：QuotaExceeded.Refresh", true)]
    [InlineData("quotaexceeded.refresh", true)]
    [InlineData("QuotaExceeded.Prefetch", false)]
    [InlineData("AccessDenied", false)]
    [InlineData(null, false)]
    public void DirectoryRefreshFallbackOnlyHandlesFileRefreshQuota(string message, bool expected)
    {
        var method = typeof(V8McpLogic).GetMethod("IsApplicationCdnFileQuotaExceeded",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        Assert.Equal(expected, method.Invoke(null, new object[] { message is null ? null : new InvalidOperationException(message) }));
    }
}
