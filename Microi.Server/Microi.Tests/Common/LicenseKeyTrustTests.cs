using System;
using System.Reflection;
using System.Security.Cryptography;
using Microi.License;

namespace Dos.Common.Tests;

public class LicenseKeyTrustTests
{
    [Fact]
    public void EmbeddedOfficialPublicKey_RemainsAcceptedAsTrustAnchor()
    {
        var field = typeof(LicenseValidator).GetField(
            "LegacyEmbeddedPublicKeyBase64",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(field);

        var officialPublicKey = field!.GetRawConstantValue() as string;
        Assert.False(string.IsNullOrWhiteSpace(officialPublicKey));

        var result = new LicenseValidator(officialPublicKey!).ValidateContent("{}");

        Assert.False(result.IsValid);
        Assert.Equal("License文件格式无效", result.Message);
    }

    [Fact]
    public void ArbitraryPublicKey_CannotReplaceOfficialTrustRoot()
    {
        using var rsa = RSA.Create(2048);
        var customPublicKey = Convert.ToBase64String(rsa.ExportRSAPublicKey());

        var result = new LicenseValidator(customPublicKey).ValidateContent("{}");

        Assert.False(result.IsValid);
        Assert.Contains("与内嵌官方授权密钥身份不匹配", result.Message);
    }

    [Fact]
    public void ArbitraryPrivateKey_CannotBecomeOfficialSigningAuthority()
    {
        using var rsa = RSA.Create(2048);
        var customPrivateKey = rsa.ExportRSAPrivateKey();
        var privatePem = "-----BEGIN RSA PRIVATE KEY-----\n"
            + Convert.ToBase64String(customPrivateKey, Base64FormattingOptions.InsertLineBreaks)
            + "\n-----END RSA PRIVATE KEY-----";

        using var generator = new LicenseGenerator(privatePem);

        Assert.False(generator.IsOfficialSigningKey(out var error));
        Assert.Contains("与内嵌官方授权密钥身份不匹配", error);
    }
}
