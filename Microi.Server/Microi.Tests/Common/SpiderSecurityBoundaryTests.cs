using System.Reflection;
using Microi.net;

namespace Dos.Common.Tests;

[Collection(SaaSRuntimeConfigurationCollection.Name)]
public class SpiderSecurityBoundaryTests
{
    [Fact]
    public void CompatibilityMode_KeepsLegacySpiderTargets()
    {
        WithSsrfConfiguration(null, null, () =>
        {
            Assert.True(Validate("ftp://user:password@192.168.0.40/file").Allowed);
            Assert.True(Validate("http://127.0.0.1:1052/health").Allowed);
            Assert.True(Validate("http://169.254.169.254/latest/meta-data").Allowed);
        });
    }

    [Fact]
    public void StrictMode_RejectsUnsafeTargetsAndHonorsExactAllowlist()
    {
        WithSsrfConfiguration(true, "192.168.0.40", () =>
        {
            Assert.False(Validate("ftp://example.com/file").Allowed);
            Assert.False(Validate("http://user:password@example.com").Allowed);
            Assert.False(Validate("http://127.0.0.1:1052/health").Allowed);
            Assert.False(Validate("http://169.254.169.254/latest/meta-data").Allowed);
            Assert.True(Validate("http://192.168.0.40:10052/flux/query").Allowed);
            Assert.False(Validate("http://192.168.0.41:10052/flux/query").Allowed);
        });
    }

    [Fact]
    public async Task V8Caller_CannotProvideExecutableOrProfilePath()
    {
        using (V8TenantContext.Enter("spider_tenant", "spider-engine"))
        {
            var executableResult = await new MicroiSpider().GetRenderHtml(
                new MicroiSpiderParam
                {
                    Url = "http://example.com",
                    ExecutablePath = "untrusted-browser.exe"
                });
            Assert.Equal(0, executableResult.Code);
            Assert.Contains("ExecutablePath", executableResult.Msg);

            var profileResult = await new MicroiSpider().OpenSession(
                new MicroiSpiderSessionParam
                {
                    UserDataDir = "untrusted-profile"
                });
            Assert.Equal(0, profileResult.Code);
            Assert.Contains("UserDataDir", profileResult.Msg);
        }
    }

    [Fact]
    public void SessionScope_BindsTenantAndEngineContext()
    {
        string tenantAEngineA;
        string tenantAEngineB;
        string tenantBEngineA;

        using (V8TenantContext.Enter("tenant-a", "engine-a"))
        {
            tenantAEngineA = ResolveExecutionScope();
        }
        using (V8TenantContext.Enter("tenant-a", "engine-b"))
        {
            tenantAEngineB = ResolveExecutionScope();
        }
        using (V8TenantContext.Enter("tenant-b", "engine-a"))
        {
            tenantBEngineA = ResolveExecutionScope();
        }

        Assert.NotEqual(tenantAEngineA, tenantAEngineB);
        Assert.NotEqual(tenantAEngineA, tenantBEngineA);
        Assert.NotEqual(
            BuildStorageKey(tenantAEngineA, "shared-session"),
            BuildStorageKey(tenantBEngineA, "shared-session"));
    }

    private static (bool Allowed, string Reason) Validate(string url)
    {
        var policyType = typeof(MicroiSpider).Assembly.GetType(
            "Microi.net.SpiderSecurityPolicy");
        var method = policyType?.GetMethod(
            "ValidateUrl",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return Assert.IsType<(bool Allowed, string Reason)>(
            method!.Invoke(null, new object?[] { url }));
    }

    private static string ResolveExecutionScope()
    {
        return InvokePrivateString("ResolveExecutionScope");
    }

    private static string BuildStorageKey(string scope, string sessionId)
    {
        return InvokePrivateString("BuildSessionStorageKey", scope, sessionId);
    }

    private static string InvokePrivateString(string methodName, params object?[] args)
    {
        var method = typeof(MicroiSpider).GetMethod(
            methodName,
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);
        return Assert.IsType<string>(method!.Invoke(null, args));
    }

    private static void WithSsrfConfiguration(
        bool? enabled,
        string? allowedHosts,
        Action action)
    {
        SaaSRuntimeConfigurationScope.RunSsrf(enabled, allowedHosts, action);
    }
}
