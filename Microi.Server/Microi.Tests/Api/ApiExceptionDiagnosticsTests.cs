using System.Data;
using System.IO;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microi.net.Api;
using Newtonsoft.Json.Linq;
using System.Text.RegularExpressions;

namespace Microi.Tests.Api;

public sealed class ApiExceptionDiagnosticsTests
{
    [Fact]
    public void SafeProjection_PreservesActionableRootCauseAndRemovesSecretsAndStack()
    {
        var exception = new InvalidOperationException(
            "wrapper Authorization: Bearer top-secret-token",
            new DataException(
                "Unknown column 'OsClient' in 'field list'; " +
                "Password=db-password; Server=prod-db.internal; Database=customer; " +
                "token=eyJabcdefghijk.abcdefghijkl.abcdefghijkl\r\n" +
                "   at Secret.Namespace.Repository.Execute() in D:\\private\\Repository.cs:line 42"));

        var diagnostic = ApiExceptionDiagnostics.Create(exception);
        var message = ApiExceptionDiagnostics.BuildUserMessage(
            "服务器处理失败。",
            diagnostic,
            "trace-safe-001");
        var combined = message + " " + diagnostic.DevelopmentDetail;

        Assert.Equal("InvalidOperationException", diagnostic.ExceptionType);
        Assert.Equal("DataException", diagnostic.RootCauseType);
        Assert.Contains("Unknown column 'OsClient'", diagnostic.RootCauseSummary);
        Assert.Contains("trace-safe-001", message);
        Assert.Contains("恢复建议", message);
        Assert.DoesNotContain("top-secret-token", combined);
        Assert.DoesNotContain("db-password", combined);
        Assert.DoesNotContain("prod-db.internal", combined);
        Assert.DoesNotContain("customer", combined);
        Assert.DoesNotContain("eyJabcdefghijk", combined);
        Assert.DoesNotContain("Secret.Namespace", combined);
        Assert.DoesNotContain("Repository.cs", combined);
    }

    [Fact]
    public void Sanitizer_RedactsQuotedJsonMicroiAliasesStandalonePathsAndControlCharacters()
    {
        var unsafeMessage =
            "Unknown column 'OsClient'; " +
            "{\"DiyToken\":\"token-json-secret\",\"AuthSecret\":\"auth-json-secret\"," +
            "\"OsClientRedisPwd\":\"redis-json-secret\",\"SecretCipher\":\"cipher-json-secret\"," +
            "\"Cookie\":\"session=cookie-json-secret\"}; " +
            "file=C:\\private\\microi\\config.json; unix=/etc/microi/private.json\u0001\u202E";

        var safe = ApiExceptionDiagnostics.SanitizeMessage(unsafeMessage);

        Assert.Contains("Unknown column 'OsClient'", safe);
        Assert.DoesNotContain("token-json-secret", safe);
        Assert.DoesNotContain("auth-json-secret", safe);
        Assert.DoesNotContain("redis-json-secret", safe);
        Assert.DoesNotContain("cipher-json-secret", safe);
        Assert.DoesNotContain("cookie-json-secret", safe);
        Assert.DoesNotContain("C:\\private", safe);
        Assert.DoesNotContain("/etc/microi", safe);
        Assert.All(safe, character =>
        {
            Assert.False(char.IsControl(character));
            Assert.NotEqual(System.Globalization.UnicodeCategory.Format, char.GetUnicodeCategory(character));
        });
    }

    [Fact]
    public void Sanitizer_PreTruncatesHugeInputAndKeepsResponseBounded()
    {
        var unsafeMessage = "Unknown column 'OsClient'; " + new string('x', 250_000) + "\u0000";

        var safe = ApiExceptionDiagnostics.SanitizeMessage(unsafeMessage);

        Assert.Contains("Unknown column 'OsClient'", safe);
        Assert.True(safe.Length <= 323);
        Assert.All(safe, character => Assert.False(char.IsControl(character)));
    }

    [Fact]
    public void RegexTimeout_ReturnsFixedFailClosedSummary()
    {
        var adversarialRegex = new Regex(
            "(a+)+$",
            RegexOptions.CultureInvariant,
            TimeSpan.FromTicks(1));

        var safe = ApiExceptionDiagnostics.ReplaceSensitivePatternOrFallback(
            new string('a', 50_000) + "!",
            adversarialRegex,
            "***");

        Assert.Equal(ApiExceptionDiagnostics.SanitizationFailureSummary, safe);
    }

    [Fact]
    public async Task Middleware_ProductionShapeContainsSafeDiagnosticsWithoutStackOrSecrets()
    {
        var context = NewContext("/api/FormEngine/GetTableData", "trace-global-001");
        var middleware = new GlobalExceptionHandler(_ =>
            throw new InvalidOperationException(
                "wrapper password=outer-secret",
                new DataException("Unknown column 'OsClient'; connectionString='Server=secret-host;Pwd=secret-pwd'")));

        await middleware.InvokeAsync(context);

        var payload = await ReadPayloadAsync(context);
        var serialized = payload.ToString();
        Assert.Equal(0, payload.Value<int>("Code"));
        Assert.Contains("Unknown column 'OsClient'", payload.Value<string>("Msg"));
        Assert.Contains("trace-global-001", payload.Value<string>("Msg"));
        Assert.Contains("恢复建议", payload.Value<string>("Msg"));
        Assert.Equal("UnhandledServerError", payload["DataAppend"]?.Value<string>("ErrorType"));
        Assert.Equal("InvalidOperationException", payload["DataAppend"]?.Value<string>("ExceptionType"));
        Assert.Equal("DataException", payload["DataAppend"]?.Value<string>("RootCauseType"));
        Assert.Contains("Unknown column", payload["DataAppend"]?.Value<string>("RootCauseSummary"));
        Assert.False(string.IsNullOrWhiteSpace(payload["DataAppend"]?.Value<string>("RecoverySuggestion")));
        Assert.Null(payload["DataAppend"]?["StackTrace"]);
        Assert.DoesNotContain("outer-secret", serialized);
        Assert.DoesNotContain("secret-host", serialized);
        Assert.DoesNotContain("secret-pwd", serialized);
    }

    [Fact]
    public async Task Middleware_PressureResponseKeepsBusyContractAndAddsRecoveryEvidence()
    {
        var context = NewContext("/api/FormEngine/GetTableData", "trace-pressure-001");
        var middleware = new GlobalExceptionHandler(_ =>
            throw new InvalidOperationException("too many connections; password=pressure-secret"));

        await middleware.InvokeAsync(context);

        var payload = await ReadPayloadAsync(context);
        Assert.Contains("系统繁忙", payload.Value<string>("Msg"));
        Assert.Contains("trace-pressure-001", payload.Value<string>("Msg"));
        Assert.Contains("恢复建议", payload.Value<string>("Msg"));
        Assert.Equal("ServerPressure", payload["DataAppend"]?.Value<string>("ErrorType"));
        Assert.DoesNotContain("pressure-secret", payload.ToString());
    }

    [Fact]
    public async Task Middleware_WrappedTimeoutUsesTimeoutContract()
    {
        var context = NewContext("/api/FormEngine/GetTableData", "trace-timeout-001");
        var middleware = new GlobalExceptionHandler(_ =>
            throw new InvalidOperationException(
                "wrapped request failure",
                new TimeoutException("dependency timed out")));

        await middleware.InvokeAsync(context);

        var payload = await ReadPayloadAsync(context);
        Assert.Contains("系统处理超时", payload.Value<string>("Msg"));
        Assert.Equal("RequestTimeout", payload["DataAppend"]?.Value<string>("ErrorType"));
        Assert.Equal(nameof(TimeoutException), payload["DataAppend"]?.Value<string>("RootCauseType"));
    }

    [Fact]
    public async Task Middleware_NonFirstAggregatePressureBranchUsesBusyContract()
    {
        var context = NewContext("/api/FormEngine/GetTableData", "trace-aggregate-001");
        var middleware = new GlobalExceptionHandler(_ =>
            throw new AggregateException(
                new InvalidOperationException("first unrelated branch"),
                new IOException("too many connections; AuthSecret=aggregate-secret")));

        await middleware.InvokeAsync(context);

        var payload = await ReadPayloadAsync(context);
        Assert.Contains("系统繁忙", payload.Value<string>("Msg"));
        Assert.Equal("ServerPressure", payload["DataAppend"]?.Value<string>("ErrorType"));
        Assert.Equal(nameof(IOException), payload["DataAppend"]?.Value<string>("RootCauseType"));
        Assert.DoesNotContain("aggregate-secret", payload.ToString());
    }

    [Fact]
    public void DiyFilter_UsesSameSafeExceptionContract()
    {
        var httpContext = new DefaultHttpContext();
        httpContext.TraceIdentifier = "trace-filter-001";
        httpContext.Request.Method = HttpMethods.Post;
        httpContext.Request.Path = "/api/FormEngine/UptFormData";
        var actionContext = new ActionContext(
            httpContext,
            new RouteData(),
            new ActionDescriptor());
        var exceptionContext = new ExceptionContext(actionContext, new List<IFilterMetadata>())
        {
            Exception = new InvalidOperationException(
                "wrapper token=filter-secret",
                new DataException("Unknown column 'OsClient' in 'field list'"))
        };

        new DiyFilter<dynamic>().OnException(exceptionContext);

        Assert.True(exceptionContext.ExceptionHandled);
        var result = Assert.IsType<JsonResult>(exceptionContext.Result);
        var dosResult = Assert.IsType<DosResult>(result.Value);
        var payload = JObject.FromObject(dosResult);
        Assert.Contains("Unknown column 'OsClient'", dosResult.Msg);
        Assert.Contains("trace-filter-001", dosResult.Msg);
        Assert.Equal("DataException", payload["DataAppend"]?.Value<string>("RootCauseType"));
        Assert.False(string.IsNullOrWhiteSpace(payload["DataAppend"]?.Value<string>("RecoverySuggestion")));
        Assert.Null(payload["DataAppend"]?["StackTrace"]);
        Assert.DoesNotContain("filter-secret", payload.ToString());
    }

    private static DefaultHttpContext NewContext(string path, string traceId)
    {
        var context = new DefaultHttpContext();
        context.TraceIdentifier = traceId;
        context.Request.Method = HttpMethods.Post;
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static async Task<JObject> ReadPayloadAsync(DefaultHttpContext context)
    {
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body);
        return JObject.Parse(await reader.ReadToEndAsync(TestContext.Current.CancellationToken));
    }
}
