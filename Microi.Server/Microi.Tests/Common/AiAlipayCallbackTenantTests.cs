using Microi.net.Api;
using Microi.net;

namespace Microi.Tests.Common;

public class AiAlipayCallbackTenantTests
{
    [Fact]
    public void RouteTenant_IsNormalizedAndSelected()
    {
        var ok = AiController.TryResolveAlipayCallbackTenant(
            "iTdos",
            null,
            out var tenant);

        Assert.True(ok);
        Assert.Equal("iTdos", tenant);
    }

    [Fact]
    public void MatchingRouteAndQueryTenant_AreAccepted()
    {
        var ok = AiController.TryResolveAlipayCallbackTenant(
            "iTdos",
            "iTdos",
            out var tenant);

        Assert.True(ok);
        Assert.Equal("iTdos", tenant);
    }

    [Fact]
    public void ConflictingRouteAndQueryTenant_FailClosed()
    {
        var ok = AiController.TryResolveAlipayCallbackTenant(
            "iTdos",
            "otherTenant",
            out var tenant);

        Assert.False(ok);
        Assert.Null(tenant);
    }

    [Theory]
    [InlineData("../iTdos")]
    [InlineData("iTdos?x=1")]
    [InlineData("iTdos/other")]
    public void InvalidRouteTenant_FailsClosed(string value)
    {
        var ok = AiController.TryResolveAlipayCallbackTenant(
            value,
            null,
            out var tenant);

        Assert.False(ok);
        Assert.Null(tenant);
    }

    [Fact]
    public void NotifyUrl_IsBoundToTrustedTenantAndReplacesUntrustedQuery()
    {
        var result = SubscriptionService.BuildTenantBoundAlipayNotifyUrl(
            "https://pay.example/api/Ai/SubAlipayNotify?x=1&OsClient=forged",
            "iTdos");

        Assert.Contains("x=1", result);
        Assert.Contains("OsClient=iTdos", result);
        Assert.DoesNotContain("forged", result);
    }

    [Fact]
    public void NotifyUrl_PathAndTrustedTenantMismatch_FailsClosed()
    {
        Assert.Throws<InvalidOperationException>(() =>
            SubscriptionService.BuildTenantBoundAlipayNotifyUrl(
                "https://pay.example/api/Ai/SubAlipayNotify--OsClient--other--",
                "iTdos"));
    }
}
