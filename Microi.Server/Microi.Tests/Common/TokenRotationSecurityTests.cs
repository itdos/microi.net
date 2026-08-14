using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Microi.net;
using Microi.net.Api;
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
    public void DiyFilterSignatureValidation_UsesOriginalJwtSegments()
    {
        var token = CreateSignedToken(StableSigningSecret);

        Assert.True(DiyFilter<dynamic>.HasValidJwtSignature(token, StableSigningSecret));
        Assert.False(DiyFilter<dynamic>.HasValidJwtSignature(
            token,
            StableSigningSecret + "_different"));
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

    [Fact]
    public void RuntimeVariants_WithSameRotationVersion_KeepOldestStableSigningKey()
    {
        var rows = new[]
        {
            CreateRuntimeVariant("internet", "Product", "Internet", "2021-10-21T17:15:56", "2026-08-11T18:00:21", StableSigningSecret, "rotation-v1"),
            CreateRuntimeVariant("internal", "Product", "Internal", "2021-10-21T17:15:57", "2026-08-12T15:25:38", StableSigningSecret + "_different", "rotation-v1")
        };

        var canonical = TenantJwtSigningKeyCoordinator.SelectCanonicalRow(rows);

        Assert.Equal("internet", canonical?["Id"]?.Value<string>());
        Assert.Equal(StableSigningSecret, canonical?["AuthSecret"]?.Value<string>());
        Assert.Equal(new[] { "iTdos" }, TenantJwtSigningKeyCoordinator.FindDivergentTenants(rows));
    }

    [Fact]
    public void RuntimeVariants_WithDifferentRotationVersions_PreferLatestExplicitRotation()
    {
        var rows = new[]
        {
            CreateRuntimeVariant("old", "Product", "Internet", "2021-10-21T17:15:56", "2026-08-11T18:00:21", StableSigningSecret, "rotation-v1"),
            CreateRuntimeVariant("rotated", "Product", "Internal", "2021-10-21T17:15:57", "2026-08-13T08:00:00", StableSigningSecret + "_rotated", "rotation-v2")
        };

        var canonical = TenantJwtSigningKeyCoordinator.SelectCanonicalRow(rows);

        Assert.Equal("rotated", canonical?["Id"]?.Value<string>());
    }

    [Fact]
    public void RuntimeVariants_AreGroupedOnlyInsideSameTenantBoundary()
    {
        var rows = new[]
        {
            CreateRuntimeVariant("a1", "Product", "Internet", "2021-01-01", "2026-01-01", StableSigningSecret, "rotation-v1", "tenant-a"),
            CreateRuntimeVariant("a2", "Product", "Internal", "2021-01-02", "2026-01-02", StableSigningSecret + "_different", "rotation-v1", "tenant-a"),
            CreateRuntimeVariant("b1", "Product", "Internal", "2021-01-03", "2026-01-03", StableSigningSecret + "_tenant_b", "rotation-v1", "tenant-b")
        };

        Assert.Equal(new[] { "tenant-a" }, TenantJwtSigningKeyCoordinator.FindDivergentTenants(rows));
    }

    [Fact]
    public void RuntimeVariants_WithOnlyWeakSecrets_AreBootstrappedFromStableOldestRow()
    {
        var rows = new[]
        {
            CreateRuntimeVariant("newer", "Product", "Internal", "2022-01-02", "2026-08-13", "short", string.Empty),
            CreateRuntimeVariant("oldest", "Product", "Internet", "2022-01-01", "2026-08-12", string.Empty, string.Empty)
        };

        Assert.Null(TenantJwtSigningKeyCoordinator.SelectCanonicalRow(rows));
        Assert.Equal(
            "oldest",
            TenantJwtSigningKeyCoordinator.SelectBootstrapRow(rows)?["Id"]?.Value<string>());
        Assert.Equal(new[] { "iTdos" }, TenantJwtSigningKeyCoordinator.FindDivergentTenants(rows));
    }

    [Fact]
    public void BootstrapSecret_MatchesInstallerRuleAndIsStrong()
    {
        var first = TenantJwtSigningKeyCoordinator.GenerateStrongAuthSecret();
        var second = TenantJwtSigningKeyCoordinator.GenerateStrongAuthSecret();

        Assert.Matches("^[a-f0-9]{48}$", first);
        Assert.False(DiyToken.IsWeakJwtSecret(first, "iTdos"));
        Assert.NotEqual(first, second);
    }

    [Fact]
    public void DirectTenantDatabase_WithEmptySaaSTable_CreatesOneHostBootstrapAnchor()
    {
        Assert.True(TenantJwtSigningKeyCoordinator.ShouldBootstrapConfiguredTenant(
            Array.Empty<JObject>(),
            "nbcmcdev"));

        var firstId = TenantJwtSigningKeyCoordinator.CreateBootstrapTenantRowId(
            "nbcmcdev",
            "Product",
            "Internal");
        var secondId = TenantJwtSigningKeyCoordinator.CreateBootstrapTenantRowId(
            "NBCMCDEV",
            "product",
            "internal");

        Assert.True(Guid.TryParse(firstId, out _));
        Assert.Equal(firstId, secondId);
    }

    [Fact]
    public void ExistingSaaSRows_DisableAutomaticHostBootstrap()
    {
        var existingDisabledRow = new JObject
        {
            ["Id"] = "disabled-row",
            ["OsClient"] = "nbcmcdev",
            ["IsEnable"] = 0,
            ["IsDeleted"] = 0
        };

        Assert.False(TenantJwtSigningKeyCoordinator.ShouldBootstrapConfiguredTenant(
            new[] { existingDisabledRow },
            "nbcmcdev"));
        Assert.False(TenantJwtSigningKeyCoordinator.ShouldBootstrapConfiguredTenant(
            Array.Empty<JObject>(),
            string.Empty));
    }

    [Theory]
    [InlineData("varchar", true)]
    [InlineData("nvarchar", true)]
    [InlineData("character varying", true)]
    [InlineData("text", true)]
    [InlineData("clob", true)]
    [InlineData("int", false)]
    public void LegacyAuthSecretColumnType_IsValidatedBeforeStartup(
        string dataType,
        bool expected)
    {
        Assert.Equal(expected, TenantJwtSigningKeyCoordinator.IsStringColumnType(dataType));
    }

    [Theory]
    [InlineData("VSCode")]
    [InlineData("MCP")]
    public void DeveloperTerminal_DefaultLifetime_IsTwentyDays(string clientType)
    {
        var client = CreateClient("tenant-row-id", StableSigningSecret);

        Assert.Equal(TimeSpan.FromDays(20), DiyToken.ResolveClientTokenLifetime(client, clientType));
    }

    [Fact]
    public void DeveloperTerminal_ExplicitTenantLifetime_OverridesDefault()
    {
        var client = CreateClient("tenant-row-id", StableSigningSecret);
        client.OsClientModel["VSCodeAccessTokenLifetime"] = 12;
        client.OsClientModel["McpAccessTokenLifetime"] = 16;

        Assert.Equal(TimeSpan.FromDays(12), DiyToken.ResolveClientTokenLifetime(client, "VSCode"));
        Assert.Equal(TimeSpan.FromDays(16), DiyToken.ResolveClientTokenLifetime(client, "MCP"));
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

    private static JObject CreateRuntimeVariant(
        string id,
        string osClientType,
        string osClientNetwork,
        string createTime,
        string updateTime,
        string secret,
        string rotateVersion,
        string osClient = "iTdos")
    {
        return new JObject
        {
            ["Id"] = id,
            ["OsClient"] = osClient,
            ["OsClientType"] = osClientType,
            ["OsClientNetwork"] = osClientNetwork,
            ["CreateTime"] = createTime,
            ["UpdateTime"] = updateTime,
            ["AuthSecret"] = secret,
            ["AuthSecretRotateVersion"] = rotateVersion
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
