using System.Text;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class IdentityVerificationSecurityTests
{
    [Theory]
    [InlineData("ChangePassword")]
    [InlineData("Approve.Payment_v1")]
    [InlineData("reveal-secret:device-1")]
    public void NormalizePurpose_AcceptsStableBusinessPurposes(string purpose)
    {
        Assert.Equal(purpose, IdentityVerificationSecurity.NormalizePurpose(purpose));
    }

    [Theory]
    [InlineData("")]
    [InlineData("has space")]
    [InlineData("bad/route")]
    public void NormalizePurpose_RejectsAmbiguousValues(string purpose)
    {
        Assert.Throws<ArgumentException>(() => IdentityVerificationSecurity.NormalizePurpose(purpose));
    }

    [Fact]
    public void NormalizeActionHash_RequiresNonLoginBindingAndStableAlphabet()
    {
        Assert.Equal(string.Empty, IdentityVerificationSecurity.NormalizeActionHash(null, required: false));
        Assert.Throws<ArgumentException>(() => IdentityVerificationSecurity.NormalizeActionHash(null, required: true));
        Assert.Throws<ArgumentException>(() => IdentityVerificationSecurity.NormalizeActionHash("short", required: true));
        Assert.Throws<ArgumentException>(() => IdentityVerificationSecurity.NormalizeActionHash(
            "0123456789abcdef+unsafe", required: true));

        const string valid = "0123456789abcdef0123456789abcdef";
        Assert.Equal(valid, IdentityVerificationSecurity.NormalizeActionHash(valid, required: true));
    }

    [Fact]
    public void PasswordChangeActionHash_IsDeterministicAndBindsUserAndNewPassword()
    {
        var baseline = IdentityVerificationSecurity.ComputePasswordChangeActionHash("user-a", "encoded-new-password");
        Assert.Equal(64, baseline.Length);
        Assert.Equal(baseline, IdentityVerificationSecurity.ComputePasswordChangeActionHash("user-a", "encoded-new-password"));
        Assert.NotEqual(baseline, IdentityVerificationSecurity.ComputePasswordChangeActionHash("user-b", "encoded-new-password"));
        Assert.NotEqual(baseline, IdentityVerificationSecurity.ComputePasswordChangeActionHash("user-a", "other-password"));
    }

    [Theory]
    [InlineData("", "https://os.jifulii.com", "os.jifulii.com")]
    [InlineData("os.jifulii.com", "https://os.jifulii.com", "os.jifulii.com")]
    [InlineData("jifulii.com", "https://os.jifulii.com", "jifulii.com")]
    public void PasskeyRpId_AcceptsCurrentHostOrParentDomain(
        string configuredRpId,
        string origin,
        string expected)
    {
        Assert.Equal(expected,
            IdentityVerificationSecurity.NormalizePasskeyRelyingPartyId(configuredRpId, origin));
    }

    [Theory]
    [InlineData("api.itdos.com", "https://os.jifulii.com")]
    [InlineData("eviljifulii.com", "https://os.jifulii.com")]
    public void PasskeyRpId_RejectsUnrelatedDomainWithChineseResolution(string configuredRpId, string origin)
    {
        var error = Assert.Throws<ArgumentException>(() =>
            IdentityVerificationSecurity.NormalizePasskeyRelyingPartyId(configuredRpId, origin));

        Assert.Contains("当前站点域名不匹配", error.Message, StringComparison.Ordinal);
        Assert.Contains("系统设置 → 登录与身份", error.Message, StringComparison.Ordinal);
        Assert.Contains("PasskeyOrigins", error.Message, StringComparison.Ordinal);
        Assert.Contains("os.jifulii.com", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void OpaqueChallenges_AreStrongUrlSafeAndUnique()
    {
        var first = IdentityVerificationSecurity.NewOpaqueValue();
        var second = IdentityVerificationSecurity.NewOpaqueValue();

        Assert.True(IdentityVerificationSecurity.IsOpaqueValue(first));
        Assert.True(IdentityVerificationSecurity.IsOpaqueValue(second));
        Assert.NotEqual(first, second);
        Assert.All(Encoding.ASCII.GetBytes(first), value => Assert.InRange(value, (byte)'-', (byte)'z'));
    }

    [Fact]
    public void FaceGatewaySecret_IsNeverInheritedOrProjectedToV8()
    {
        Assert.False(TenantConfigurationSecurity.ShouldCopyFromMain("FaceApiKey"));

        var projection = TenantConfigurationSecurity.CreateV8Projection(new Newtonsoft.Json.Linq.JObject
        {
            ["FaceApiKey"] = "must-not-leak",
            ["FaceApiBase"] = "https://face.example.test",
            ["FaceVerificationEnabled"] = 1
        });

        Assert.Null(projection["FaceApiKey"]);
        Assert.Equal("https://face.example.test", projection["FaceApiBase"]?.ToString());
    }

    [Fact]
    public void Totp_Rfc6238VectorAndBase32RoundTrip_AreStable()
    {
        var secret = Encoding.ASCII.GetBytes("12345678901234567890");
        var encoded = IdentityVerificationSecurity.Base32Encode(secret);

        Assert.Equal(secret, IdentityVerificationSecurity.Base32Decode(encoded));
        Assert.Equal("94287082", IdentityVerificationSecurity.ComputeTotpCode(secret, 1, digits: 8));
        Assert.Equal(1, IdentityVerificationSecurity.FindMatchingTotpCounter(
            secret,
            "94287082",
            DateTimeOffset.FromUnixTimeSeconds(59),
            window: 0,
            digits: 8));
    }

    [Fact]
    public void TotpCipher_UsesCanonicalTenantCasingAcrossAnonymousLogin()
    {
        const string canonicalTenant = "TotpCaseFixture";
        var client = new OsClientSecret
        {
            OsClient = canonicalTenant,
            OsClientModel = new JObject
            {
                ["AuthSecret"] = "totp-case-fixture-auth-secret-0123456789abcdef"
            }
        };
        OsClientExtend.ClientList[canonicalTenant] = client;
        try
        {
            var expected = Encoding.ASCII.GetBytes("12345678901234567890");
            var cipher = IdentityVerificationSecurity.ProtectTotpSecret(
                canonicalTenant,
                IdentityVerificationSecurity.Base32Encode(expected));

            var actual = IdentityVerificationSecurity.UnprotectTotpSecret(
                canonicalTenant.ToLowerInvariant(),
                cipher);

            Assert.Equal(expected, actual);
        }
        finally
        {
            OsClientExtend.ClientList.TryRemove(canonicalTenant, out _);
        }
    }

    [Fact]
    public void TotpCipher_ExplainsRecoveryWhenAuthSecretChanged()
    {
        const string tenant = "TotpSecretChangeFixture";
        var client = new OsClientSecret
        {
            OsClient = tenant,
            OsClientModel = new JObject
            {
                ["AuthSecret"] = "totp-before-change-auth-secret-0123456789abcdef"
            }
        };
        OsClientExtend.ClientList[tenant] = client;
        try
        {
            var cipher = IdentityVerificationSecurity.ProtectTotpSecret(
                tenant,
                IdentityVerificationSecurity.Base32Encode(
                    Encoding.ASCII.GetBytes("12345678901234567890")));
            client.OsClientModel["AuthSecret"] = "totp-after-change-auth-secret-abcdef0123456789";

            var error = Assert.Throws<System.Security.Cryptography.CryptographicException>(() =>
                IdentityVerificationSecurity.UnprotectTotpSecret(tenant, cipher));

            Assert.Contains("重新登记 Authenticator", error.Message, StringComparison.Ordinal);
            Assert.Contains("AuthSecret", error.Message, StringComparison.Ordinal);
            Assert.DoesNotContain("authentication tag", error.Message, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            OsClientExtend.ClientList.TryRemove(tenant, out _);
        }
    }
}
