using System.Reflection;
using Aliyun.OSS.Common;
using Dos.Common;
using Microi.net;

namespace Microi.Tests.Common;

public class MicroiHdfsStreamErrorContractTests
{
    private static T WithServiceErrorCode<T>(T exception, string? code) where T : ServiceException
    {
        // SDK 的 ErrorCode 由内部响应解析器赋值；反射仅用于构造等价测试响应，不放宽生产判断。
        typeof(ServiceException).GetProperty(nameof(ServiceException.ErrorCode))!.SetValue(exception, code);
        return exception;
    }

    private static DosResult ReadOssFailure(Exception exception)
    {
        var method = typeof(MicroiHDFSAliyun).GetMethod("BuildObjectStreamReadFailure",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (DosResult)method.Invoke(null, new object[]
        {
            new HDFSParam { FileFullPath = "assets/nosuchkey.js", Limit = false },
            "nosuchkey", exception
        })!;
    }

    private static bool PublisherTreatsAsMissing(DosResult result)
    {
        var method = typeof(V8McpLogic).GetMethod("IsApplicationCdnMissingPublicObject",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return (bool)method.Invoke(null, new object[] { result })!;
    }

    [Theory]
    [InlineData("NoSuchKey", true)]
    [InlineData("NoSuchBucket", false)]
    [InlineData("AccessDenied", false)]
    [InlineData("Forbidden", false)]
    [InlineData("nosuchkey", false)]
    [InlineData(" NoSuchKey", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void OssProviderPreservesExplicitMissingKeyAndRejectsOtherServiceErrors(string? code, bool missing)
    {
        // 即使诊断、桶名和路径都含 NoSuchKey，只允许 OSS 真实服务异常中的精确错误码。
        var result = ReadOssFailure(WithServiceErrorCode(
            new OssException("NoSuchKey; Object=assets/nosuchkey.js"), code));
        Assert.Equal(0, result.Code);
        Assert.Contains("nosuchkey", result.Msg);
        Assert.Equal(missing, PublisherTreatsAsMissing(result));
        if (!missing) Assert.Null(result.DataAppend);
    }

    [Fact]
    public void OssProviderDoesNotInferMissingFromMessagesGenericServiceErrorsOrInnerExceptions()
    {
        foreach (var exception in new Exception[]
        {
            new Exception("The specified key does not exist. NoSuchKey 对象不存在 HTTP 404"),
            WithServiceErrorCode(new ServiceException("NoSuchKey"), "NoSuchKey"),
            new IOException("NoSuchKey", WithServiceErrorCode(new OssException("missing"), "NoSuchKey")),
            WithServiceErrorCode(new OssException("HTTP 403 AccessDenied NoSuchKey"), "AccessDenied")
        })
        {
            var result = ReadOssFailure(exception);
            Assert.Equal(0, result.Code);
            Assert.Null(result.DataAppend);
            Assert.False(PublisherTreatsAsMissing(result));
        }
    }
}
