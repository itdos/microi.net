using System.Reflection;
using Microi.net;

namespace Dos.Common.Tests;

[Collection(SaaSRuntimeConfigurationCollection.Name)]
public class DiyHttpSsrfCompatibilityTests
{
    [Fact]
    public void Compatibility_mode_does_not_reject_legacy_targets()
    {
        WithSsrfConfiguration(null, null, () =>
        {
            Assert.True(Validate("ftp://user:password@192.168.0.40/file").Allowed);
            Assert.True(Validate("http://127.0.0.1:1052/api/ApiEngine/Run").Allowed);
            Assert.True(Validate("http://192.168.0.40:10052/flux/query").Allowed);
            Assert.True(Validate("http://10.10.68.38:1052/api/ApiEngine/Run").Allowed);
            Assert.True(Validate("http://169.254.169.254/latest/meta-data").Allowed);
        });
    }

    [Fact]
    public void Strict_mode_rejects_non_http_credentials_and_private_targets()
    {
        WithSsrfConfiguration(true, null, () =>
        {
            Assert.False(Validate("ftp://example.com/file").Allowed);
            Assert.False(Validate("http://user:password@example.com/data").Allowed);
            Assert.False(Validate("http://127.0.0.1:1052/health").Allowed);
            Assert.False(Validate("http://192.168.0.40:10052/flux/query").Allowed);
            Assert.False(Validate("http://10.10.68.38:1052/api/ApiEngine/Run").Allowed);
            Assert.False(Validate("http://169.254.169.254/latest/meta-data").Allowed);
        });
    }

    [Fact]
    public void Strict_mode_exact_allowlist_can_restore_a_controlled_private_host()
    {
        WithSsrfConfiguration(true, "192.168.0.40", () =>
        {
            Assert.True(Validate("http://192.168.0.40:10052/flux/query").Allowed);
            Assert.False(Validate("http://192.168.0.41:10052/flux/query").Allowed);
        });
    }

    private static (bool Allowed, string Reason) Validate(string url)
    {
        var method = typeof(DiyHttp).GetMethod(
            "ValidateSsrfUrl",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);

        var result = method.Invoke(null, new object[] { url, false });
        Assert.NotNull(result);
        return ((bool allowed, string reason))result;
    }

    private static void WithSsrfConfiguration(
        bool? enabled,
        string? allowedHosts,
        Action action)
    {
        SaaSRuntimeConfigurationScope.RunSsrf(enabled, allowedHosts, action);
    }
}
