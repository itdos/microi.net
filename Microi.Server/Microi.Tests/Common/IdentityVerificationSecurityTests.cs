using System.Text;
using Microi.net;

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
}
