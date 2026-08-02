using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class TokenRotationSecurityTests
{
    private const string StableSigningSecret = "mci_restart_stable_secret_0123456789_ABCDEFGHIJK";

    [Fact]
    public void RetiredToken_RemainsValidInsideRotationGracePeriod()
    {
        var now = DateTime.Now;
        var oldToken = new TokensModel
        {
            Token = "old-token",
            AuthVersion = DiyToken.CurrentAuthVersion,
            RetiredTime = now.Subtract(DiyToken.TokenRotationGracePeriod).AddSeconds(1)
        };
        var current = new CurrentToken
        {
            AuthVersion = DiyToken.CurrentAuthVersion,
            Token = "new-token",
            Tokens =
            [
                new TokensModel
                {
                    Token = "new-token",
                    AuthVersion = DiyToken.CurrentAuthVersion
                },
                oldToken
            ]
        };

        Assert.True(DiyToken.IsTokenEntryWithinRotationGrace(oldToken, now));
        Assert.Same(oldToken, DiyToken.GetActiveCachedTokenEntry(current, "old-token"));
    }

    [Fact]
    public void RetiredToken_IsRejectedAfterRotationGracePeriod()
    {
        var now = DateTime.Now;
        var oldToken = new TokensModel
        {
            Token = "old-token",
            AuthVersion = DiyToken.CurrentAuthVersion,
            RetiredTime = now.Subtract(DiyToken.TokenRotationGracePeriod).AddSeconds(-1)
        };
        var current = new CurrentToken
        {
            AuthVersion = DiyToken.CurrentAuthVersion,
            Token = "new-token",
            Tokens = [oldToken]
        };

        Assert.False(DiyToken.IsTokenEntryWithinRotationGrace(oldToken, now));
        Assert.Null(DiyToken.GetActiveCachedTokenEntry(current, "old-token"));
    }

    [Fact]
    public void ProcessTemporarySecret_IsNeverAcceptedAsSigningSource()
    {
        var firstPlaceholder = CreateClient(null, StableSigningSecret);
        var secondPlaceholder = CreateClient(null, StableSigningSecret + "_different");

        var firstStatus = DiyToken.EvaluateJwtSigningKeyStatus(
            firstPlaceholder,
            configuredRootSecret: string.Empty);
        var secondStatus = DiyToken.EvaluateJwtSigningKeyStatus(
            secondPlaceholder,
            configuredRootSecret: string.Empty);

        Assert.False(firstStatus.Ready);
        Assert.False(firstStatus.Durable);
        Assert.Equal("ProcessTemporary", firstStatus.Source);
        Assert.False(secondStatus.Ready);
        Assert.Empty(firstStatus.Fingerprint);
        Assert.Empty(secondStatus.Fingerprint);
    }

    [Fact]
    public void PersistedSigningSecret_ValidatesTokenAfterProcessRestart()
    {
        var beforeRestart = CreateClient("tenant-row-id", StableSigningSecret);
        var afterRestart = CreateClient("tenant-row-id", StableSigningSecret);
        var beforeStatus = DiyToken.EvaluateJwtSigningKeyStatus(
            beforeRestart,
            configuredRootSecret: string.Empty);
        var afterStatus = DiyToken.EvaluateJwtSigningKeyStatus(
            afterRestart,
            configuredRootSecret: string.Empty);

        Assert.True(beforeStatus.Ready);
        Assert.True(beforeStatus.Durable);
        Assert.Equal("sys_osclients", beforeStatus.Source);
        Assert.Equal(beforeStatus.Fingerprint, afterStatus.Fingerprint);

        var oldToken = CreateSignedToken(DiyToken.ResolveJwtSigningKey(beforeRestart));
        var principal = ValidateSignedToken(
            oldToken,
            DiyToken.ResolveJwtSigningKey(afterRestart));

        Assert.Equal("restart-user", principal.FindFirst("UserId")?.Value);
    }

    [Fact]
    public void ConfiguredRootSecret_IsDurableWithoutTenantRowIdentity()
    {
        var configuredClient = CreateClient(null, StableSigningSecret);

        var status = DiyToken.EvaluateJwtSigningKeyStatus(
            configuredClient,
            configuredRootSecret: StableSigningSecret);

        Assert.True(status.Ready);
        Assert.True(status.Durable);
        Assert.Equal("Configuration", status.Source);
        Assert.Matches("^[a-f0-9]{16}$", status.Fingerprint);
    }

    private static OsClientSecret CreateClient(string? id, string secret)
    {
        var model = new JObject
        {
            ["AuthSecret"] = secret
        };
        if (!string.IsNullOrWhiteSpace(id)) model["Id"] = id;
        return new OsClientSecret
        {
            OsClient = "restart-tenant",
            OsClientModel = model
        };
    }

    private static string CreateSignedToken(string signingKey)
    {
        var handler = new JwtSecurityTokenHandler();
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new System.Security.Claims.ClaimsIdentity(
                [new System.Security.Claims.Claim("UserId", "restart-user")]),
            Expires = DateTime.UtcNow.AddMinutes(5),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                SecurityAlgorithms.HmacSha256)
        };
        return handler.WriteToken(handler.CreateToken(descriptor));
    }

    private static System.Security.Claims.ClaimsPrincipal ValidateSignedToken(
        string token,
        string signingKey)
    {
        return new JwtSecurityTokenHandler().ValidateToken(token, new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.Zero,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey))
        }, out _);
    }
}
