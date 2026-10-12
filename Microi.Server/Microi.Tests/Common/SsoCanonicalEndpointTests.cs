using System.Reflection;
using Microi.net;
using Microsoft.AspNetCore.WebUtilities;

namespace Microi.Tests.Common;

public sealed class SsoCanonicalEndpointTests
{
    private static SsoConnectionOptions CurrentClient(bool enabled = true, string scopes = "openid profile email",
        string callback = "https://client.example.test/callback?OsClient=tenant") => new()
    {
        Key = "fixture-client", ClientId = "fixture-public-client", ClientAuthMethod = "none",
        Enabled = enabled, Direction = SsoSecurity.OutboundDirection, Protocol = "OIDC",
        Scopes = scopes.Split(' '), RedirectUris = [callback]
    };

    private static bool GrantAllowed(string method, params object?[] arguments)
    {
        var policy = typeof(SsoProtocolRuntime).GetMethod(method, BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(policy);
        return Assert.IsType<bool>(policy!.Invoke(null, arguments));
    }

    [Theory]
    [InlineData(true, "openid profile email", "openid profile email", true)]
    [InlineData(true, "email openid profile", "openid profile email", true)]
    [InlineData(true, "openid profile email", "openid profile", false)]
    [InlineData(true, "openid profile email", "openid email", false)]
    [InlineData(true, "openid profile", "openid profile email", true)]
    [InlineData(false, "openid profile email", "openid profile email", false)]
    public void CurrentProtocolGrant_RejectsDisabledClient_AndAnyWithdrawnScope(
        bool enabled, string grantedScope, string currentScopes, bool expected)
    {
        Assert.Equal(expected, GrantAllowed("IsCurrentOutboundGrantAllowed", CurrentClient(enabled, currentScopes),
            "fixture-public-client", grantedScope));
    }

    [Fact]
    public void CurrentProtocolGrant_RejectsMissingOrReplacedClient_AndInboundConnections()
    {
        Assert.False(GrantAllowed("IsCurrentOutboundGrantAllowed", null, "fixture-public-client", "openid"));
        Assert.False(GrantAllowed("IsCurrentOutboundGrantAllowed", CurrentClient(), "another-client", "openid"));
        var inbound = CurrentClient();
        inbound.Direction = SsoSecurity.InboundDirection;
        Assert.False(GrantAllowed("IsCurrentOutboundGrantAllowed", inbound, inbound.ClientId, "openid"));
    }

    [Theory]
    [InlineData("https://client.example.test/callback?OsClient=tenant", "https://client.example.test/callback?OsClient=tenant", true)]
    [InlineData("https://client.example.test/new-callback?OsClient=tenant", "https://client.example.test/callback?OsClient=tenant", false)]
    [InlineData("https://client.example.test/callback?OsClient=another", "https://client.example.test/callback?OsClient=tenant", false)]
    [InlineData("https://client.example.test/callback?OsClient=tenant", "https://client.example.test/callback?OsClient=another", false)]
    public void AuthorizationCode_RequiresOriginalExactCallback_ToRemainRegistered(
        string currentCallback, string submittedCallback, bool expected)
    {
        Assert.Equal(expected, GrantAllowed("IsOutboundAuthorizationCodeAllowed", CurrentClient(callback: currentCallback),
            "fixture-public-client", "https://client.example.test/callback?OsClient=tenant", "openid profile email", submittedCallback));
    }

    [Theory]
    [InlineData("openid profile email", "openid profile email", true)]
    [InlineData("email openid profile", "openid profile email", true)]
    [InlineData("openid profile email", "openid profile", false)]
    [InlineData("openid roles", "openid profile email", false)]
    [InlineData("profile", "openid profile", false)]
    [InlineData("", "openid profile", false)]
    public void ScopeRevalidation_RejectsAnyRemovedScope(string requested, string allowed, bool expected)
    {
        var check = typeof(SsoProtocolRuntime).GetMethod("IsOutboundScopeAllowed", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(check);
        Assert.Equal(expected, check!.Invoke(null, [requested, allowed.Split(' ')]));
    }

    [Theory]
    [InlineData(null, "official-user", true)]
    [InlineData("official-user", "official-user", true)]
    [InlineData("another-user", "official-user", false)]
    [InlineData("official-user", "", false)]
    public void ExpectedAuthorizationUser_PreservesLegacyCall_AndRejectsAccountSwitch(
        string? expectedUser, string currentUser, bool expected)
    {
        var check = typeof(SsoProtocolRuntime).GetMethod("IsExpectedAuthorizationUser", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(check);
        Assert.Equal(expected, check!.Invoke(null, [expectedUser, currentUser]));
    }

    private static string? Invoke(string method, params object?[] arguments)
    {
        var builder = typeof(SsoProtocolRuntime).GetMethods(BindingFlags.NonPublic | BindingFlags.Static)
            .SingleOrDefault(candidate => candidate.Name == method
                && candidate.GetParameters().Length == arguments.Length);
        Assert.NotNull(builder);
        return (string?)builder!.Invoke(null, arguments);
    }

    [Theory]
    [InlineData("https://api.example.test", "http", "internal:80", "", "https://api.example.test/sso/tenant")]
    [InlineData("https://api.example.test/gateway/", "http", "attacker.invalid", "/private", "https://api.example.test/gateway/sso/tenant")]
    [InlineData("", "https", "api.example.test:8443", "/gateway", "https://api.example.test:8443/gateway/sso/tenant")]
    [InlineData(null, "http", "localhost:61501", "", "http://localhost:61501/sso/tenant")]
    public void Issuer_UsesAuthoritativeApiBase_WithSecureLegacyFallback(
        string? apiBase, string scheme, string host, string pathBase, string expected)
    {
        Assert.Equal(expected, Invoke("BuildProviderIssuer", apiBase, scheme, host, pathBase, "tenant"));
    }

    [Theory]
    [InlineData("http://api.example.test")]
    [InlineData("https://user:password@api.example.test")]
    [InlineData("https://api.example.test?redirect=attacker")]
    [InlineData("https://api.example.test#fragment")]
    [InlineData("/relative")]
    [InlineData("file:///tmp/callback")]
    [InlineData("")]
    public void Issuer_RejectsUnsafeConfiguration_AndInsecurePublicFallback(string apiBase)
    {
        Assert.Null(Invoke("BuildProviderIssuer", apiBase, "http", "api.example.test", "", "tenant"));
    }

    [Theory]
    [InlineData("https://api.microi.net", "iTdos")]
    [InlineData("https://api.itdos.com", "iTdos")]
    [InlineData("https://api.microi.net/gateway/", "itdos")]
    public void OfficialAuthorization_UsesOfficialWebsite_OnlyFromTrustedTenantConfiguration(
        string apiBase, string osClient)
    {
        var url = Invoke("BuildFrontendAuthorizationUrl", apiBase, "http", "internal:80", "", osClient, "request-value");
        var uri = new Uri(Assert.IsType<string>(url));
        Assert.Equal("https://microi.net/microi-authorize.html", uri.GetLeftPart(UriPartial.Path));
        Assert.Equal("request-value", QueryHelpers.ParseQuery(uri.Query)["request"].ToString());
        Assert.Empty(uri.Fragment);
    }

    [Theory]
    [InlineData("https://api.example.test", "iTdos", "https://api.example.test/?OsClient=iTdos#/sso-authorize?request=request-value")]
    [InlineData("https://api.microi.net", "another", "https://api.microi.net/?OsClient=another#/sso-authorize?request=request-value")]
    [InlineData("", "iTdos", "https://api.microi.net/?OsClient=iTdos#/sso-authorize?request=request-value")]
    [InlineData("https://api.example.test/gateway/", "tenant", "https://api.example.test/gateway/?OsClient=tenant#/sso-authorize?request=request-value")]
    public void Authorization_DoesNotTrustRequestHostForOfficialHandoff_AndPreservesSelfHostedRoute(
        string apiBase, string osClient, string expected)
    {
        Assert.Equal(expected, Invoke("BuildFrontendAuthorizationUrl", apiBase, "https", "api.microi.net", "", osClient, "request-value"));
    }
}
