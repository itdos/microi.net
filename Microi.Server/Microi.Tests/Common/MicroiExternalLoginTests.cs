using System.Net;
using System.Reflection;
using Microi.net;
using Microsoft.AspNetCore.WebUtilities;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class MicroiExternalLoginTests
{
    [Theory]
    [InlineData(true, "deployment-123", true)]
    [InlineData(false, "deployment-123", false)]
    [InlineData(true, "another-client", false)]
    [InlineData(true, "", false)]
    public void MicroiLoginTicket_FailsClosedWhenProviderOrClientChanges(bool enabled, string clientId, bool expected)
    {
        var validate = typeof(ExternalLoginRuntime).GetMethod("IsProviderTicketValid", BindingFlags.NonPublic | BindingFlags.Static)!;
        var provider = new ExternalLoginProviderOptions { Key = "Microi", ClientId = clientId, Enabled = enabled };
        Assert.Equal(expected, validate.Invoke(null, [provider, new JObject { ["ClientId"] = "deployment-123" }]));
    }

    [Fact]
    public void PublicMicroiClient_DoesNotRequireOrExposeSharedSecret()
    {
        var microi = new ExternalLoginProviderOptions { Key = "Microi", Enabled = true, ClientId = "deployment-123" };
        Assert.True(microi.Configured);
        Assert.False(new ExternalLoginProviderOptions { Key = "Gitee", Enabled = true, ClientId = "gitee" }.Configured);
        microi.Enabled = false;
        Assert.False(microi.Configured);
        microi.Enabled = true;
        microi.ClientId = "";
        Assert.False(microi.Configured);
    }

    [Fact]
    public void MicroiAuthorization_UsesPkceNonceAndExactOfficialEndpoint()
    {
        var builder = typeof(ExternalLoginRuntime).GetMethod("BuildMicroiAuthorizeUrl", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(builder);
        var verifier = SsoSecurity.CreatePkceVerifier();
        var provider = new ExternalLoginProviderOptions { Key = "Microi", ClientId = "deployment-123", Scope = "openid profile email", AuthorizationEndpoint = "https://api.microi.net/sso/iTdos/authorize" };
        const string callback = "https://tenant.example/api/ExternalLogin/Callback?OsClient=tenant&Provider=Microi";
        var url = Assert.IsType<string>(builder!.Invoke(null, [provider, callback, "state", verifier, "nonce"]));
        var uri = new Uri(url);
        var query = QueryHelpers.ParseQuery(uri.Query);
        Assert.Equal("https://api.microi.net/sso/iTdos/authorize", uri.GetLeftPart(UriPartial.Path));
        Assert.Equal(callback, query["redirect_uri"]);
        Assert.Equal("S256", query["code_challenge_method"]);
        Assert.True(SsoSecurity.VerifyPkceS256(verifier, query["code_challenge"]!));
        Assert.Equal("nonce", query["nonce"]);
        Assert.DoesNotContain(verifier, url);
        Assert.False(query.ContainsKey("client_secret"));
    }

    [Fact]
    public async Task MicroiExchange_UsesBackchannelPkceAndStableSubjectWithoutSendingSecret()
    {
        var handler = new ProviderHandler();
        var runtime = new ExternalLoginRuntime(new Factory(handler));
        var exchange = typeof(ExternalLoginRuntime).GetMethod("ExchangeProfileAsync", BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.NotNull(exchange);
        var provider = new ExternalLoginProviderOptions { Key = "Microi", ClientId = "deployment-123", ClientSecret = "never-send-this", TokenEndpoint = "https://api.microi.net/sso/iTdos/token", UserInfoEndpoint = "https://api.microi.net/sso/iTdos/userinfo" };
        // 真正执行 HTTP 交换边界；相同昵称、邮箱不能取代不可变的官方 sub。
        var task = Assert.IsAssignableFrom<Task>(exchange!.Invoke(runtime, [provider, "authorization-code", "https://tenant.example/callback", SsoSecurity.CreatePkceVerifier()]));
        await task;
        var profile = task.GetType().GetProperty("Result")!.GetValue(task)!;
        Assert.Equal("official-pairwise-sub", profile.GetType().GetProperty("Subject")!.GetValue(profile));
        Assert.Equal("authorization_code", handler.TokenForm!["grant_type"]);
        Assert.Equal("deployment-123", handler.TokenForm["client_id"]);
        Assert.False(handler.TokenForm.ContainsKey("client_secret"));
        Assert.NotEmpty(handler.TokenForm["code_verifier"].ToString());
        Assert.Equal("Bearer", handler.AuthorizationScheme);
        Assert.Equal(2, handler.RequestCount);
    }

    [Theory]
    [InlineData("{\"name\":\"admin\",\"email\":\"admin@example.test\"}")]
    [InlineData("{\"sub\":\"\"}")]
    public async Task MicroiExchange_RejectsMissingSubject(string profileJson)
    {
        var runtime = new ExternalLoginRuntime(new Factory(new ProviderHandler(profileJson)));
        var exchange = typeof(ExternalLoginRuntime).GetMethod("ExchangeProfileAsync", BindingFlags.NonPublic | BindingFlags.Instance)!;
        var provider = new ExternalLoginProviderOptions { Key = "Microi", ClientId = "deployment", TokenEndpoint = "https://api.microi.net/sso/iTdos/token", UserInfoEndpoint = "https://api.microi.net/sso/iTdos/userinfo" };
        var task = Assert.IsAssignableFrom<Task>(exchange.Invoke(runtime, [provider, "code", "https://tenant.example/callback", SsoSecurity.CreatePkceVerifier()]));
        await Assert.ThrowsAsync<InvalidOperationException>(async () => await task);
    }

    private sealed class Factory(ProviderHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class ProviderHandler(string profileJson = "{\"sub\":\"official-pairwise-sub\",\"preferred_username\":\"official-user\",\"name\":\"吾码用户\",\"email\":\"user@example.test\",\"picture\":\"https://file.microi.net/avatar.png\"}") : HttpMessageHandler
    {
        public Dictionary<string, Microsoft.Extensions.Primitives.StringValues>? TokenForm { get; private set; }
        public string? AuthorizationScheme { get; private set; }
        public int RequestCount { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            Assert.Equal("api.microi.net", request.RequestUri!.Host);
            if (request.RequestUri.AbsolutePath.EndsWith("/token"))
            {
                Assert.Equal(HttpMethod.Post, request.Method);
                TokenForm = QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(cancellationToken));
                return new(HttpStatusCode.OK) { Content = new StringContent("{\"access_token\":\"short-protocol-token\",\"token_type\":\"Bearer\"}") };
            }
            Assert.Equal("/sso/iTdos/userinfo", request.RequestUri.AbsolutePath);
            AuthorizationScheme = request.Headers.Authorization?.Scheme;
            return new(HttpStatusCode.OK) { Content = new StringContent(profileJson) };
        }
    }
}
