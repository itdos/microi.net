using System.IO;
using Microsoft.AspNetCore.Http;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Api;

public class RequestBodyLimitErrorTests
{
    [Fact]
    public void DetectsKestrelPayloadTooLargeException()
    {
        var exception = new BadHttpRequestException(
            "Request body too large.",
            StatusCodes.Status413PayloadTooLarge);

        Assert.True(RequestBodyLimitError.IsRequestBodyTooLarge(exception));
    }

    [Fact]
    public void DetectsMultipartLimitThroughInnerException()
    {
        var exception = new Exception(
            "Form parsing failed.",
            new InvalidDataException("Multipart body length limit 268435456 exceeded."));

        Assert.True(RequestBodyLimitError.IsRequestBodyTooLarge(exception));
    }

    [Fact]
    public void DoesNotClassifyUnrelatedInvalidDataException()
    {
        var exception = new InvalidDataException("ZIP package contains more than one SQL file.");

        Assert.False(RequestBodyLimitError.IsRequestBodyTooLarge(exception));
    }

    [Theory]
    [InlineData("/api/HDFS/Upload")]
    [InlineData("/api/HDFS/UploadAnonymous")]
    [InlineData("/api/HDFS/FileManageUpload")]
    public void RecognizesHdfsUploadRoutes(string path)
    {
        Assert.True(RequestBodyLimitError.IsHdfsUploadPath(new PathString(path)));
    }

    [Fact]
    public void HdfsMessageExplainsBusinessAndInfrastructureLimits()
    {
        var message = RequestBodyLimitError.GetUserMessage(new PathString("/api/HDFS/Upload"));

        Assert.Contains("进入 HDFS 业务校验前", message);
        Assert.Contains("SaaS 引擎", message);
        Assert.Contains("client_max_body_size", message);
        Assert.Contains("2048MB", message);
        Assert.DoesNotContain("MICROI_HTTP_MAX_REQUEST_BODY_MB", message);
        Assert.DoesNotContain("MICROI_FILE_UPLOAD_MAX_MULTIPART_MB", message);
    }

    [Fact]
    public async Task MiddlewareReturnsHttp200DosResultForRequestBodyLimit()
    {
        var context = new DefaultHttpContext();
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = "/api/HDFS/Upload";
        context.Response.Body = new MemoryStream();
        var middleware = new GlobalExceptionHandler(_ =>
            throw new BadHttpRequestException(
                "Request body too large.",
                StatusCodes.Status413PayloadTooLarge));

        await middleware.InvokeAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        var payload = JObject.Parse(await reader.ReadToEndAsync(TestContext.Current.CancellationToken));
        Assert.Equal(0, payload.Value<int>("Code"));
        Assert.Contains("SaaS 引擎", payload.Value<string>("Msg"));
        Assert.Equal(
            RequestBodyLimitError.ErrorType,
            payload["DataAppend"]?.Value<string>("ErrorType"));
        Assert.Equal(
            RequestBodyLimitError.Layer,
            payload["DataAppend"]?.Value<string>("Layer"));
    }
}
