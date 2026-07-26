using Microi.net;

namespace Dos.Common.Tests;

public class TokenRotationSecurityTests
{
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
}
