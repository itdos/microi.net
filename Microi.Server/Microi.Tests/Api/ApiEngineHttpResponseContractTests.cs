using System.Reflection;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Api;

/// <summary>
/// 接口引擎 HTTP 响应契约同时服务 SSO 等标准协议与普通租户接口；测试重点是
/// “协议能力可用”与“高风险响应头只能由可信原子签名”两条边界。
/// </summary>
public sealed class ApiEngineHttpResponseContractTests
{
    [Fact]
    public void TrustedAtom_CanReturnRedirectAndMultipleCookies()
    {
        var raw = new JObject
        {
            ["StatusCode"] = 302,
            ["ContentType"] = "text/plain; charset=utf-8",
            ["Body"] = string.Empty,
            ["Headers"] = new JObject
            {
                ["Location"] = "https://id.example.com/login",
                ["Set-Cookie"] = new JArray("sso=a; Secure; HttpOnly", "nonce=b; Secure; HttpOnly")
            }
        };
        var result = Wrap(raw, ApiEngineHttpResponseSecurity.Sign(raw, "tenant-a", "sso_http_begin"));

        var success = ApiEngineHttpResponseContract.TryRead(
            result, "tenant-a", "sso_http_begin", out var response, out var error);

        Assert.True(success, error);
        Assert.True(response!.Trusted);
        Assert.Equal(302, response.StatusCode);
        Assert.Equal("https://id.example.com/login", response.Headers["Location"].Single());
        Assert.Equal(2, response.Headers["Set-Cookie"].Count);
    }

    [Fact]
    public void OrdinaryApiEngine_CanReturnCasXmlStatusAndSafeHeaders()
    {
        var raw = new JObject
        {
            ["StatusCode"] = 401,
            ["ContentType"] = "application/xml; charset=utf-8",
            ["Body"] = "<cas:serviceResponse />",
            ["Headers"] = new JObject
            {
                ["Cache-Control"] = "no-store",
                ["WWW-Authenticate"] = "Bearer"
            }
        };

        var success = ApiEngineHttpResponseContract.TryRead(
            Wrap(raw, null), "tenant-a", "ordinary-http-engine", out var response, out var error);

        Assert.True(success, error);
        Assert.False(response!.Trusted);
        Assert.Equal(401, response.StatusCode);
        Assert.Equal("application/xml; charset=utf-8", response.ContentType);
    }

    [Fact]
    public void TrustedAtom_CanReturnBinaryBodyByBase64()
    {
        var expected = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x00, 0xFF };
        var raw = new JObject
        {
            ["StatusCode"] = 200,
            ["ContentType"] = "image/png",
            ["BodyBase64"] = Convert.ToBase64String(expected),
            ["Headers"] = new JObject { ["Cache-Control"] = "no-store" }
        };
        var result = Wrap(raw, ApiEngineHttpResponseSecurity.Sign(raw, "tenant-a", "platform-os-legacy-compatibility"));

        var success = ApiEngineHttpResponseContract.TryRead(
            result,
            "tenant-a",
            "platform-os-legacy-compatibility",
            out var response,
            out var error);

        Assert.True(success, error);
        Assert.True(response!.Trusted);
        Assert.Equal(expected, response.BodyBytes);
        Assert.Equal(string.Empty, response.Body);
    }

    [Fact]
    public void HttpResponse_RejectsAmbiguousTextAndBinaryBodies()
    {
        var raw = new JObject
        {
            ["StatusCode"] = 200,
            ["Body"] = "text",
            ["BodyBase64"] = Convert.ToBase64String(new byte[] { 1, 2, 3 })
        };

        Assert.False(ApiEngineHttpResponseContract.TryRead(
            Wrap(raw, null), "tenant-a", "ordinary-http-engine", out _, out var error));
        Assert.Contains("BodyBase64", error);
    }

    [Fact]
    public void HttpResponse_RejectsInvalidBase64Body()
    {
        var raw = new JObject
        {
            ["StatusCode"] = 200,
            ["BodyBase64"] = "not-base64%%%"
        };

        Assert.False(ApiEngineHttpResponseContract.TryRead(
            Wrap(raw, null), "tenant-a", "ordinary-http-engine", out _, out var error));
        Assert.Contains("Base64", error);
    }

    [Fact]
    public void OrdinaryOrTamperedResponse_CannotSetCookie()
    {
        var raw = new JObject
        {
            ["StatusCode"] = 200,
            ["Headers"] = new JObject { ["Set-Cookie"] = "sso=unsafe" }
        };
        var validSignature = ApiEngineHttpResponseSecurity.Sign(raw, "tenant-a", "sso_http_begin");
        raw["Body"] = "tampered";

        var success = ApiEngineHttpResponseContract.TryRead(
            Wrap(raw, validSignature), "tenant-a", "sso_http_begin", out _, out var error);

        Assert.False(success);
        Assert.Contains("不允许设置响应头", error);
    }

    [Theory]
    [InlineData("//evil.example.com")]
    [InlineData("http://evil.example.com")]
    [InlineData("https://user:password@example.com")]
    public void RedirectLocation_RejectsUnsafeTargets(string location)
    {
        var raw = new JObject
        {
            ["StatusCode"] = 302,
            ["Headers"] = new JObject { ["Location"] = location }
        };

        Assert.False(ApiEngineHttpResponseContract.TryRead(
            Wrap(raw, null), "tenant-a", "ordinary-http-engine", out _, out var error));
        Assert.Contains("Location", error);
    }

    [Fact]
    public void DynamicRoute_MatchesOnlyWholeSafeTemplateSegments()
    {
        var matcher = typeof(DynamicRoute).GetMethod(
            "TryMatchApiAddressTemplate",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(matcher);

        var args = new object?[]
        {
            "/saml/{OsClient}/sp/{ConnectionKey}/metadata",
            "/saml/iTdos/sp/client%20one/metadata",
            null
        };
        Assert.True(Assert.IsType<bool>(matcher!.Invoke(null, args)));
        var values = Assert.IsType<JObject>(args[2]);
        Assert.Equal("iTdos", values["OsClient"]?.ToString());
        Assert.Equal("client one", values["ConnectionKey"]?.ToString());

        var encodedSlash = new object?[]
        {
            "/saml/{OsClient}/sp/{ConnectionKey}/metadata",
            "/saml/iTdos/sp/client%2Fescape/metadata",
            null
        };
        Assert.False(Assert.IsType<bool>(matcher.Invoke(null, encodedSlash)));
    }

    private static JObject Wrap(JObject response, string? signature) => new()
    {
        ["Code"] = 1,
        ["DataAppend"] = new JObject
        {
            ["HttpResponse"] = response,
            ["HttpResponseSignature"] = signature
        }
    };
}
