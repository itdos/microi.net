using Microi.License;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class LicenseAccountEntitlementTests
{
    private static readonly DateTime Now = new(2026, 9, 14, 0, 0, 0, DateTimeKind.Utc);
    private static JObject User(string type = "Enterprise", string expiry = "2036-09-14 00:00:00") =>
        new() { ["LicenseType"] = type, ["LicenseExpirationDate"] = expiry };
    [Fact]
    public void ShortLicenseIsAllowedAndDefaultsNeverExceedAccountExpiry()
    {
        Assert.Null(LicenseAccountEntitlement.Resolve(User(), null, Now.AddMonths(1), null, Now,
            out var product, out var end, out var update));
        Assert.Equal("Enterprise", product);
        Assert.Equal(Now.AddMonths(1), end);
        Assert.Equal(end, update);
        Assert.Null(LicenseAccountEntitlement.Resolve(User(), null, null, null, Now, out _, out end, out _));
        Assert.Equal(Now.AddYears(10), end);
    }
    [Theory]
    [InlineData("Personal", "Enterprise", "2036-09-14", 1)]
    [InlineData("Enterprise", "Enterprise", "2026-09-13", 1)]
    [InlineData("Enterprise", "Enterprise", "", 1)]
    [InlineData("Enterprise", "Enterprise", "2036-09-14", 121)]
    [InlineData("Enterprise", "Enterprise", "2036-09-14", -1)]
    [InlineData("Enterprise", "Unknown", "2036-09-14", 1)]
    public void InvalidOrExpandedRightsAreRejected(string type, string request, string expiry, int months)
        => Assert.NotNull(LicenseAccountEntitlement.Resolve(User(type, expiry), request,
            Now.AddMonths(months), null, Now, out _, out _, out _));
    [Fact]
    public void PersonalMayNotExtendUpdateServicesPastRuntime()
        => Assert.NotNull(LicenseAccountEntitlement.Resolve(User("Personal"), "Personal", Now.AddMonths(1),
            Now.AddMonths(2), Now, out _, out _, out _));
}
