using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public sealed class LicenseCaptchaSecurityTests
{
    [Theory]
    [InlineData(true, true)]
    [InlineData(false, false)]
    [InlineData(1, true)]
    [InlineData(0, false)]
    [InlineData("1", true)]
    [InlineData("0", false)]
    [InlineData("true", true)]
    [InlineData("false", false)]
    public void CaptchaPolicy_UsesSysConfigEnableCaptcha(object configuredValue, bool expected)
    {
        var sysConfig = new JObject
        {
            ["EnableCaptcha"] = JToken.FromObject(configuredValue)
        };

        Assert.Equal(expected, LicenseCaptchaSecurity.IsCaptchaRequired(sysConfig));
    }

    [Fact]
    public void CaptchaPolicy_FailsClosedWhenConfigIsMissing()
    {
        Assert.True(LicenseCaptchaSecurity.IsCaptchaRequired(null));
        Assert.True(LicenseCaptchaSecurity.IsCaptchaRequired(new JObject()));
    }

    [Fact]
    public void CaptchaId_IsOpaqueTenantScopedAndStrictlyParsed()
    {
        var captchaId = LicenseCaptchaSecurity.CreateCaptchaId();

        Assert.StartsWith(LicenseCaptchaSecurity.CaptchaIdPrefix, captchaId, StringComparison.Ordinal);
        Assert.True(LicenseCaptchaSecurity.TryBuildCacheKey("iTdos", captchaId, out var cacheKey));
        Assert.StartsWith("Microi:iTdos:LicenseCaptcha:", cacheKey, StringComparison.Ordinal);
        Assert.Equal(32, cacheKey.Split(':')[3].Length);

        Assert.False(LicenseCaptchaSecurity.TryBuildCacheKey("", captchaId, out _));
        Assert.False(LicenseCaptchaSecurity.TryBuildCacheKey("iTdos", "other:" + Guid.NewGuid().ToString("N"), out _));
        Assert.False(LicenseCaptchaSecurity.TryBuildCacheKey("iTdos", captchaId + ":extra", out _));
        Assert.False(LicenseCaptchaSecurity.TryBuildCacheKey("iTdos", "license:Captcha:../../admin", out _));
    }

    [Fact]
    public void LicenseController_UsesOfficialPolicyAndSharedOneTimeCaptchaStorage()
    {
        var root = FindRepositoryRoot();
        var controllerSource = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "LicenseController.cs"));
        var securitySource = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Core", "Security", "LicenseCaptchaSecurity.cs"));

        Assert.Contains("LicenseServerStore.ResolveMainOsClient()", controllerSource, StringComparison.Ordinal);
        Assert.Contains("GetSysConfig(mainOsClient, null)", controllerSource, StringComparison.Ordinal);
        Assert.Contains("CaptchaRequired = policy.CaptchaRequired", controllerSource, StringComparison.Ordinal);
        Assert.Contains("LicenseCaptchaSecurity.StoreAsync", controllerSource, StringComparison.Ordinal);
        Assert.Contains("LicenseCaptchaSecurity.ValidateAndConsumeAsync", controllerSource, StringComparison.Ordinal);
        Assert.DoesNotContain("_captcha.Validate", controllerSource, StringComparison.Ordinal);

        Assert.Contains("StringSetAsync", securitySource, StringComparison.Ordinal);
        Assert.Contains("When.NotExists", securitySource, StringComparison.Ordinal);
        Assert.Contains("StringGetDeleteAsync", securitySource, StringComparison.Ordinal);
        Assert.Contains("FixedTimeEquals", securitySource, StringComparison.Ordinal);
        Assert.DoesNotContain("Environment.GetEnvironmentVariable", controllerSource, StringComparison.Ordinal);
        Assert.DoesNotContain("Environment.GetEnvironmentVariable", securitySource, StringComparison.Ordinal);
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "Microi.Server"))
                && Directory.Exists(Path.Combine(current.FullName, "Microi.Client")))
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("Unable to locate the Microi repository root.");
    }
}
