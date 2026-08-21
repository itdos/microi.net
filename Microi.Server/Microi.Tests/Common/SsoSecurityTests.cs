using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class SsoSecurityTests
{
    [Theory]
    [InlineData("OIDC")]
    [InlineData("saml2")]
    [InlineData("Cas")]
    [InlineData("LegacyToken")]
    public void ProtocolAndDirection_AreStrictlyNormalized(string protocol)
    {
        Assert.Equal(protocol.ToUpperInvariant(), SsoSecurity.NormalizeProtocol(protocol));
        Assert.Equal(SsoSecurity.InboundDirection,
            SsoSecurity.NormalizeDirection("externaltoMicroi"));
        Assert.Equal(SsoSecurity.OutboundDirection,
            SsoSecurity.NormalizeDirection("MICROITOEXTERNAL"));
        Assert.Throws<ArgumentException>(() => SsoSecurity.NormalizeProtocol("OAuth1"));
        Assert.Throws<ArgumentException>(() => SsoSecurity.NormalizeDirection("Both"));
    }

    [Fact]
    public void EndpointPolicy_RequiresHttpsExceptExplicitLoopback()
    {
        Assert.Equal("https://id.example.test/.well-known/openid-configuration",
            SsoSecurity.RequireAbsoluteEndpoint(
                "https://id.example.test/.well-known/openid-configuration").AbsoluteUri);
        Assert.Throws<ArgumentException>(() =>
            SsoSecurity.RequireAbsoluteEndpoint("http://id.example.test/authorize", true));
        Assert.Throws<ArgumentException>(() =>
            SsoSecurity.RequireAbsoluteEndpoint("https://name:secret@id.example.test/authorize"));
        Assert.Equal("http://localhost:61501/callback",
            SsoSecurity.RequireAbsoluteEndpoint(
                "http://localhost:61501/callback", allowLoopbackHttp: true).AbsoluteUri);
    }

    [Fact]
    public void RedirectUri_IsExactAndDoesNotAcceptPrefixOrFragment()
    {
        var configured = new JArray(
            "https://client.example.test/callback",
            "https://client.example.test/callback/two");

        Assert.True(SsoSecurity.IsExactRedirectUriAllowed(
            "https://client.example.test/callback", configured));
        Assert.False(SsoSecurity.IsExactRedirectUriAllowed(
            "https://client.example.test/callback/evil", configured));
        Assert.False(SsoSecurity.IsExactRedirectUriAllowed(
            "https://client.example.test/callback#token", configured));
        Assert.False(SsoSecurity.IsExactRedirectUriAllowed(
            "https://client.example.test.evil/callback", configured));
    }

    [Fact]
    public void PkceS256_UsesStrongVerifierAndFixedValidation()
    {
        var verifier = SsoSecurity.CreatePkceVerifier();
        var challenge = SsoSecurity.CreatePkceChallenge(verifier);

        Assert.InRange(verifier.Length, 43, 128);
        Assert.True(SsoSecurity.VerifyPkceS256(verifier, challenge));
        Assert.False(SsoSecurity.VerifyPkceS256(verifier + "x", challenge));
        Assert.False(SsoSecurity.VerifyPkceS256("short", challenge));
    }

    [Fact]
    public void ClientSecret_IsSaltedAndCanBeRotatedWithoutPlaintextStorage()
    {
        const string secret = "sso-client-secret-value-with-enough-entropy-01";
        var first = SsoSecurity.HashClientSecret(secret, iterations: 100000);
        var second = SsoSecurity.HashClientSecret(secret, iterations: 100000);

        Assert.NotEqual(first, second);
        Assert.True(SsoSecurity.VerifyClientSecret(secret, first));
        Assert.False(SsoSecurity.VerifyClientSecret(secret + "x", first));
        Assert.DoesNotContain(secret, first, StringComparison.Ordinal);
    }

    [Fact]
    public void ScopeValidation_RejectsEscalationAndRequiresOpenId()
    {
        var allowed = new JArray("openid", "profile", "email");

        Assert.Equal(new[] { "openid", "profile" },
            SsoSecurity.NormalizeScopes("openid profile", allowed, requireOpenId: true));
        Assert.Empty(SsoSecurity.NormalizeScopes("profile", allowed, requireOpenId: true));
        Assert.Empty(SsoSecurity.NormalizeScopes("openid admin", allowed, requireOpenId: true));
    }

    [Fact]
    public void PairwiseSubject_IsStableButSeparatedByTenantClientAndUser()
    {
        const string key = "pairwise-subject-fixture-key-material";
        var baseline = SsoSecurity.CreatePairwiseSubject("iTdos", "client.one", "user-a", key);

        Assert.Equal(baseline,
            SsoSecurity.CreatePairwiseSubject("iTdos", "client.one", "user-a", key));
        Assert.NotEqual(baseline,
            SsoSecurity.CreatePairwiseSubject("iTdos", "client.two", "user-a", key));
        Assert.NotEqual(baseline,
            SsoSecurity.CreatePairwiseSubject("iTdos", "client.one", "user-b", key));
        Assert.NotEqual(baseline,
            SsoSecurity.CreatePairwiseSubject("other", "client.one", "user-a", key));
        Assert.NotEmpty(SsoSecurity.CreatePairwiseSubject(
            "iTdos", "https://service.example.test/saml/metadata", "user-a", key));
    }

    [Fact]
    public void ConnectionProjection_NeverExposesSecretsOrAdministrativeMappings()
    {
        var option = SsoConnectionOptions.FromRow(new JObject
        {
            ["Id"] = "fixture-row",
            ["SsoKey"] = "corp-oidc",
            ["Name"] = "企业身份中心",
            ["Direction"] = SsoSecurity.InboundDirection,
            ["Protocol"] = "OIDC",
            ["IsEnable"] = 1,
            ["ClientId"] = "microi-client",
            ["ClientSecretSettingKey"] = "SSO.corp.ClientSecret",
            ["ClaimMappings"] = new JObject { ["employee_no"] = "Account" },
            ["RoleMappings"] = new JObject { ["admin"] = "role-id" },
            ["Scopes"] = new JArray("openid", "profile")
        });

        var publicRow = option.ToPublicProjection();
        Assert.Equal("corp-oidc", publicRow["ConnectionKey"]?.ToString());
        Assert.Equal("OIDC", publicRow["Protocol"]?.ToString());
        Assert.Null(publicRow["ClientId"]);
        Assert.Null(publicRow["ClientSecretSettingKey"]);
        Assert.Null(publicRow["ClaimMappings"]);
        Assert.Null(publicRow["RoleMappings"]);
    }

    [Fact]
    public void LegacyRows_AreRecognizedButKeptInCompatibilityProtocol()
    {
        var option = SsoConnectionOptions.FromRow(new JObject
        {
            ["Id"] = "12345678-existing",
            ["IsEnable"] = 1,
            ["ServerSsoApi"] = "https://legacy.example.test/validate",
            ["ClientSsoApi"] = "/api/SysUser/SsoPengrui",
            ["TokenName"] = "ticket"
        });

        Assert.Equal("legacy-12345678", option.Key);
        Assert.Equal("LEGACYTOKEN", option.Protocol);
        Assert.Equal(SsoSecurity.InboundDirection, option.Direction);
    }

    [Theory]
    [InlineData("/apiengine/sso_legacy_token_login", true)]
    [InlineData("/API/SysUser/SsoPengrui", false)]
    [InlineData("/API/Sso/Legacy", false)]
    [InlineData("https://evil.example.test/collect", false)]
    [InlineData("//evil.example.test/collect", false)]
    [InlineData("/api\\evil", false)]
    public void LegacyClientApi_IsRestrictedToSameOriginApiPath(string value, bool expected)
    {
        Assert.Equal(expected, SsoSecurity.IsSafeLegacyClientApi(value));
    }

    [Theory]
    [InlineData("ticket", true)]
    [InlineData("microi_sso-token", true)]
    [InlineData("ticket[0]", false)]
    [InlineData("", false)]
    public void LegacyTokenName_IsSafeForUrlMatching(string value, bool expected)
    {
        Assert.Equal(expected, SsoSecurity.IsSafeLegacyTokenName(value));
    }
}
