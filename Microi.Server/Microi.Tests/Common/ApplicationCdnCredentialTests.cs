using System;
using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public class ApplicationCdnCredentialTests
{
    private static bool IsMissingPublicObject(string error)
    {
        var method = typeof(V8McpLogic).GetMethod("IsApplicationCdnMissingPublicObject",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (bool)method.Invoke(null, new object[] { error })!;
    }

    [Fact]
    public void PublicProjectionCopiesOnlyAfterExplicitMissingKey()
    {
        Assert.True(IsMissingPublicObject("The specified key does not exist."));
        Assert.True(IsMissingPublicObject("NoSuchKey"));
        Assert.False(IsMissingPublicObject("AccessDenied"));
        Assert.False(IsMissingPublicObject("Socket timeout"));
        Assert.False(IsMissingPublicObject(null));
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
}
