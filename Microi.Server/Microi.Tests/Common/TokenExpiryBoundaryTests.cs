using System.IdentityModel.Tokens.Jwt;
using Microi.net;

namespace Dos.Common.Tests;

public class TokenExpiryBoundaryTests
{
    [Fact]
    public void JwtBeforeCurrentTime_IsExpired()
    {
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(expires: now.AddMinutes(-1));

        Assert.True(DiyToken.IsJwtExpired(token, now));
    }

    [Fact]
    public void JwtAfterCurrentTime_RemainsActive()
    {
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(expires: now.AddMinutes(1));

        Assert.False(DiyToken.IsJwtExpired(token, now));
    }

    [Fact]
    public void JwtWithoutExpiry_RemainsCompatible()
    {
        Assert.False(DiyToken.IsJwtExpired(new JwtSecurityToken(), DateTime.UtcNow));
    }
}
