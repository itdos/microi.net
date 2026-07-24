using System.Reflection;
using Microi.net;

namespace Dos.Common.Tests;

[Collection("SsrfEnvironment")]
public class DiyHttpSsrfCompatibilityTests
{
    private static readonly object EnvironmentLock = new();

    [Fact]
    public void Compatibility_mode_does_not_reject_legacy_targets()
    {
        WithSsrfEnvironment(null, null, () =>
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
        WithSsrfEnvironment("true", null, () =>
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
        WithSsrfEnvironment("true", "192.168.0.40", () =>
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

        var result = method.Invoke(null, new object[] { url });
        Assert.NotNull(result);
        return ((bool allowed, string reason))result;
    }

    private static void WithSsrfEnvironment(
        string? enabled,
        string? allowedHosts,
        Action action)
    {
        lock (EnvironmentLock)
        {
            const string enabledKey = "MICROI_SSRF_PROTECTION_ENABLED";
            const string allowedHostsKey = "MICROI_SSRF_ALLOWED_HOSTS";
            var oldEnabled = Environment.GetEnvironmentVariable(
                enabledKey,
                EnvironmentVariableTarget.Process);
            var oldAllowedHosts = Environment.GetEnvironmentVariable(
                allowedHostsKey,
                EnvironmentVariableTarget.Process);

            try
            {
                Environment.SetEnvironmentVariable(
                    enabledKey,
                    enabled,
                    EnvironmentVariableTarget.Process);
                Environment.SetEnvironmentVariable(
                    allowedHostsKey,
                    allowedHosts,
                    EnvironmentVariableTarget.Process);
                action();
            }
            finally
            {
                Environment.SetEnvironmentVariable(
                    enabledKey,
                    oldEnabled,
                    EnvironmentVariableTarget.Process);
                Environment.SetEnvironmentVariable(
                    allowedHostsKey,
                    oldAllowedHosts,
                    EnvironmentVariableTarget.Process);
            }
        }
    }
}
