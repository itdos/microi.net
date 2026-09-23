using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microi.net;

namespace Dos.Common.Tests;

public sealed class MultiClientLoginSessionTests
{
    private static string Token(string session, string did = "shared-device") =>
        new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(claims:
        [
            new Claim("UserId", "same-user"),
            new Claim("OsClient", "tenant"),
            new Claim("ClientType", "Mobile"),
            new Claim("Did", did),
            new Claim("MicroiSessionId", session)
        ]));

    private static TokensModel Entry(string token, string did = "shared-device") => new()
    {
        Token = token,
        Did = did,
        ClientType = "Mobile",
        AuthVersion = DiyToken.CurrentAuthVersion
    };

    [Fact]
    public void TwoMiniProgramsWithTheSameDid_KeepBothLoginSessions()
    {
        var first = Token("mini-program-one");
        var second = Token("mini-program-two");
        var entries = new List<TokensModel> { Entry(first) };

        DiyToken.AddOrRotateSessionToken(entries, Entry(second), null, DateTime.Now);

        Assert.Equal(2, entries.Count);
        Assert.Contains(entries, item => item.Token == first && item.RetiredTime == null);
        Assert.Contains(entries, item => item.Token == second && item.RetiredTime == null);
        Assert.NotEqual(
            OnlineTerminalService.GetTerminalIdentity(new ClientTerminalInfo { Did = "shared-device", ClientType = "Mobile", TokenHash = "one" }),
            OnlineTerminalService.GetTerminalIdentity(new ClientTerminalInfo { Did = "shared-device", ClientType = "Mobile", TokenHash = "two" }));
    }

    [Fact]
    public void RefreshAndLogout_AffectOnlyTheSourceLoginSession()
    {
        var first = Token("mini-program-one");
        var second = Token("mini-program-two");
        var rotated = Token("mini-program-one", "new-device-id");
        var entries = new List<TokensModel> { Entry(first), Entry(second) };
        var now = DateTime.Now;

        Assert.Equal(rotated, DiyToken.AddOrRotateSessionToken(entries, Entry(rotated), first, now));
        Assert.NotNull(entries.Single(item => item.Token == first).RetiredTime);
        Assert.Null(entries.Single(item => item.Token == second).RetiredTime);
        Assert.Equal(rotated, DiyToken.AddOrRotateSessionToken(entries, Entry(Token("mini-program-one")), first, now));
        Assert.Equal(3, entries.Count);

        var remaining = DiyToken.WithoutLoginSession(entries, rotated);
        Assert.Single(remaining);
        Assert.Equal(second, remaining[0].Token);
    }

    [Fact]
    public void LegacyTokenWithoutSessionClaim_HasStableDistinctFallback()
    {
        var first = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(claims: [new Claim("Did", "Empty"), new Claim("jti", "one")]));
        var second = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(claims: [new Claim("Did", "Empty"), new Claim("jti", "two")]));
        Assert.Equal(DiyToken.GetLoginSessionId(first), DiyToken.GetLoginSessionId(first));
        Assert.NotEqual(DiyToken.GetLoginSessionId(first), DiyToken.GetLoginSessionId(second));
    }

    [Fact]
    public void MissingDid_IsUniquePerLoginAndStableDuringRefresh()
    {
        var first = DiyToken.ResolveLoginDid("Empty", "session-one");
        var second = DiyToken.ResolveLoginDid(null!, "session-two");
        Assert.NotEqual(first, second);
        Assert.Equal(first, DiyToken.ResolveLoginDid("Empty", "session-one"));
        Assert.Equal("device-123", DiyToken.ResolveLoginDid("device-123", "session-one"));
    }
}
