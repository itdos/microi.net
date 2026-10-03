using System.Reflection;
using Microi.net;
using Microsoft.AspNetCore.WebUtilities;

namespace Microi.Tests.Common;

public class ExternalLoginAuthorizationTests
{
    [Theory]
    [InlineData("WeChat", "https://open.weixin.qq.com/connect/qrconnect", "appid", "snsapi_login", "#wechat_redirect")]
    [InlineData("Gitee", "https://gitee.com/oauth/authorize", "client_id", "user_info", "")]
    [InlineData("GitHub", "https://github.com/login/oauth/authorize", "client_id", "read:user user:email", "")]
    public void AuthorizationUrl_UsesProviderProtocolAndPreservesEncodedValues(
        string providerKey, string endpoint, string idParameter, string scope, string fragment)
    {
        const string clientId = "application-id&other=invalid";
        const string secret = "private-client-secret-must-not-be-in-browser";
        const string callback = "https://api.example.test/api/ExternalLogin/Callback?OsClient=tenant&Provider=WeChat";
        const string state = "opaque-state&redirect_uri=https://invalid.example";
        var provider = new ExternalLoginProviderOptions
        {
            Key = providerKey,
            ClientId = clientId,
            ClientSecret = secret,
            AuthorizationEndpoint = endpoint,
            Scope = scope
        };

        // 直接执行网关使用的构造器，防止只检查模板而遗漏微信与标准 OAuth 的参数差异。
        var builder = typeof(ExternalLoginRuntime).GetMethod(
            "BuildAuthorizeUrl", BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(builder);
        var url = Assert.IsType<string>(builder!.Invoke(null, [provider, callback, state]));
        var uri = new Uri(url);
        var query = QueryHelpers.ParseQuery(uri.Query);

        Assert.Equal(endpoint, uri.GetLeftPart(UriPartial.Path));
        Assert.Equal(clientId, query[idParameter].ToString());
        Assert.False(query.ContainsKey(idParameter == "appid" ? "client_id" : "appid"));
        Assert.Equal(callback, query["redirect_uri"].ToString());
        Assert.Equal("code", query["response_type"].ToString());
        Assert.Equal(scope, query["scope"].ToString());
        Assert.Equal(state, query["state"].ToString());
        Assert.Equal(fragment, uri.Fragment);
        Assert.Equal(5, query.Count);
        Assert.DoesNotContain(secret, url, StringComparison.Ordinal);
        Assert.False(query.ContainsKey("client_secret"));
    }
}
