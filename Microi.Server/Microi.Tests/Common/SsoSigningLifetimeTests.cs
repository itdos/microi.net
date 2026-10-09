using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;
using Microi.net;

namespace Microi.Tests.Common;

/// <summary>
/// 请求级 RSA 与跨请求签名器缓存的生命周期回归。夹具使用真实 IdentityModel，
/// 不接数据库、不变更全局工厂，也不把生成的 Token 或私钥写入日志。
/// </summary>
public sealed class SsoSigningLifetimeTests
{
    private const string Issuer = "https://issuer.example.test";
    private const string Audience = "client-a";

    [Fact]
    public void LegacyCachedSigner_ReproducesSecondRequestDisposedRsa()
    {
        using var generated = RSA.Create(2048);
        var encoded = generated.ExportPkcs8PrivateKey();
        var legacyFactory = new CryptoProviderFactory { CacheSignatureProviders = true };
        try
        {
            // 保留修复前的精确生命周期：同私钥加载两次，第一次结束释放 RSA，
            // 第二次按密钥摘要命中仍引用第一次 RSA 的缓存签名器。
            Assert.NotEmpty(SignWithImportedKey(encoded, rsa => new RsaSecurityKey(rsa)
            {
                KeyId = "legacy-request-key", CryptoProviderFactory = legacyFactory
            }));
            var failure = Assert.ThrowsAny<Exception>(() => SignWithImportedKey(encoded, rsa => new RsaSecurityKey(rsa)
            {
                KeyId = "legacy-request-key", CryptoProviderFactory = legacyFactory
            }));
            Assert.IsType<ObjectDisposedException>(failure);
        }
        finally
        {
            (legacyFactory.CryptoProviderCache as IDisposable)?.Dispose();
        }
    }

    [Fact]
    public void RequestScopedSigner_SignsAndValidatesRepeatedRequests()
    {
        using var generated = RSA.Create(2048);
        var encoded = generated.ExportPkcs8PrivateKey();
        var firstToken = string.Empty;
        for (var request = 0; request < 6; request++)
        {
            var token = SignWithImportedKey(encoded, rsa => SsoSecurity.CreateRequestScopedRsaKey(rsa, "same-key"));
            if (request == 0) firstToken = token;
            Assert.Equal("test-user", ValidateWithImportedKey(encoded, token).FindFirst("sub")?.Value);
            // 退出校验会验证之前已签发的 id_token_hint，不能只测本次新 Token。
            Assert.Equal("test-user", ValidateWithImportedKey(encoded, firstToken).FindFirst("sub")?.Value);
        }
    }

    [Fact]
    public async Task RequestScopedSigner_SupportsConcurrentRequestsWithoutRetainingRsa()
    {
        using var generated = RSA.Create(2048);
        var encoded = generated.ExportPkcs8PrivateKey();
        await Parallel.ForEachAsync(Enumerable.Range(0, 12), new ParallelOptions { MaxDegreeOfParallelism = 2 }, (request, _) =>
        {
            var token = SignWithImportedKey(encoded, rsa => SsoSecurity.CreateRequestScopedRsaKey(rsa, "concurrent-key"));
            Assert.Equal("test-user", ValidateWithImportedKey(encoded, token).FindFirst("sub")?.Value);
            return ValueTask.CompletedTask;
        });
    }

    [Fact]
    public void RequestScopedSigner_RejectsTamperedTokenAndAnotherTenantKey()
    {
        using var generated = RSA.Create(2048);
        using var anotherTenant = RSA.Create(2048);
        var encoded = generated.ExportPkcs8PrivateKey();
        var token = SignWithImportedKey(encoded, rsa => SsoSecurity.CreateRequestScopedRsaKey(rsa, "tenant-key"));
        Assert.ThrowsAny<SecurityTokenException>(() => ValidateWithImportedKey(anotherTenant.ExportPkcs8PrivateKey(), token));
        var parts = token.Split('.');
        var payload = JwtPayload.Base64UrlDeserialize(parts[1]);
        payload["sub"] = "tampered-user";
        parts[1] = payload.Base64UrlEncode();
        Assert.ThrowsAny<SecurityTokenException>(() => ValidateWithImportedKey(encoded, string.Join('.', parts)));
    }

    [Theory]
    [InlineData("https://another-issuer.example.test", Audience)]
    [InlineData(Issuer, "another-client")]
    public void RequestScopedSigner_KeepsIssuerAndAudienceValidation(string issuer, string audience)
    {
        using var generated = RSA.Create(2048);
        var encoded = generated.ExportPkcs8PrivateKey();
        var token = SignWithImportedKey(encoded, rsa => SsoSecurity.CreateRequestScopedRsaKey(rsa, "validation-key"));
        Assert.ThrowsAny<SecurityTokenException>(() => ValidateWithImportedKey(encoded, token, issuer, audience));
    }

    [Fact]
    public void RequestScopedSigner_DoesNotChangeGlobalFactoryOrDisposeCallerRsa()
    {
        var globalFactory = CryptoProviderFactory.Default;
        var defaultCaching = CryptoProviderFactory.DefaultCacheSignatureProviders;
        using var rsa = RSA.Create(2048);
        var key = SsoSecurity.CreateRequestScopedRsaKey(rsa, "request-key");
        Assert.False(key.CryptoProviderFactory.CacheSignatureProviders);
        Assert.Same(globalFactory, CryptoProviderFactory.Default);
        Assert.Equal(defaultCaching, CryptoProviderFactory.DefaultCacheSignatureProviders);
        Assert.NotEmpty(rsa.ExportSubjectPublicKeyInfo());
        Assert.Throws<ArgumentNullException>(() => SsoSecurity.CreateRequestScopedRsaKey(null!, "invalid"));
    }

    private static string SignWithImportedKey(byte[] encoded, Func<RSA, RsaSecurityKey> createKey)
    {
        using var rsa = RSA.Create();
        rsa.ImportPkcs8PrivateKey(encoded, out _);
        var token = new JwtSecurityToken(Issuer, Audience, [new Claim("sub", "test-user")],
            DateTime.UtcNow.AddSeconds(-30), DateTime.UtcNow.AddMinutes(5),
            new SigningCredentials(createKey(rsa), SecurityAlgorithms.RsaSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static ClaimsPrincipal ValidateWithImportedKey(byte[] encoded, string token,
        string issuer = Issuer, string audience = Audience)
    {
        using var rsa = RSA.Create();
        rsa.ImportPkcs8PrivateKey(encoded, out _);
        return new JwtSecurityTokenHandler { MapInboundClaims = false }.ValidateToken(token, new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = SsoSecurity.CreateRequestScopedRsaKey(rsa, "validation-key"),
            RequireSignedTokens = true,
            ValidateIssuer = true, ValidIssuer = issuer,
            ValidateAudience = true, ValidAudience = audience,
            ValidateLifetime = true, RequireExpirationTime = true,
            ValidAlgorithms = [SecurityAlgorithms.RsaSha256]
        }, out _);
    }
}
