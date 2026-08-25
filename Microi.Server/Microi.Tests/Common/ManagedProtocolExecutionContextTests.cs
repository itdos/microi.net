using Microi.net;
using Xunit;

namespace Microi.Tests.Common;

public sealed class ManagedProtocolExecutionContextTests
{
    [Fact]
    public void ManagedCompatibilityRunner_IsNotExposedOnV8ApiEnginePublicSurface()
    {
        const string hostOnlyMethod = "RunManagedCompatibilityAsync";
        Assert.Null(typeof(IApiEngine).GetMethod(hostOnlyMethod));
        Assert.Null(typeof(ApiEngine).GetMethod(
            hostOnlyMethod,
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public));
    }

    [Fact]
    public void StopHttpBypass_RequiresMatchingUnconsumedHostProtocolScope()
    {
        var request = new Newtonsoft.Json.Linq.JObject
        {
            ["ApiEngineKey"] = "platform-external-login-binding",
            ["OsClient"] = "tenant-a"
        };
        Assert.True(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
            true, "Client", false, request));

        using (V8TrustedExecutionContext.EnterManagedProtocol(
                   "platform-external-login-binding",
                   "tenant-a"))
        {
            Assert.False(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
                true, "Client", true, request));
            request["OsClient"] = "tenant-b";
            Assert.True(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
                true, "Client", true, request));
            request["OsClient"] = "tenant-a";
            Assert.True(V8TrustedExecutionContext.TryConsumeManagedProtocol(
                "platform-external-login-binding", "tenant-a"));
            Assert.True(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
                true, "Client", true, request));
        }
    }

    [Fact]
    public void ManagedProtocolContext_CannotBeForgedReplayedOrUsedByAnotherEngine()
    {
        using var tenantScope = V8TenantContext.Enter(
            "tenant-a",
            "platform-external-login-binding");
        var method = new V8Method();

        Assert.NotEqual(1, method.RequireManagedProtocolContext().Code);

        using (V8TrustedExecutionContext.EnterManagedProtocol(
                   "platform-external-login-binding",
                   "tenant-a"))
        {
            using (V8TenantContext.Enter("tenant-a", "platform-runtime-custom-hook"))
            {
                Assert.NotEqual(1, method.RequireManagedProtocolContext().Code);
            }

            Assert.Equal(1, method.RequireManagedProtocolContext().Code);
            Assert.NotEqual(1, method.RequireManagedProtocolContext().Code);

            using (V8TenantContext.Enter("tenant-b", "platform-external-login-binding"))
            {
                Assert.NotEqual(1, method.RequireManagedProtocolContext().Code);
            }
        }

        Assert.NotEqual(1, method.RequireManagedProtocolContext().Code);
    }

    [Fact]
    public void ManagedProtocolContext_NestedScopeRestoresOuterSingleUseAuthorization()
    {
        var method = new V8Method();
        using var outer = V8TrustedExecutionContext.EnterManagedProtocol(
            "platform-external-login-binding",
            "tenant-a");

        using (V8TrustedExecutionContext.EnterManagedProtocol(
                   "platform-wechat-user-binding",
                   "tenant-a"))
        using (V8TenantContext.Enter("tenant-a", "platform-wechat-user-binding"))
        {
            Assert.Equal(1, method.RequireManagedProtocolContext().Code);
            Assert.NotEqual(1, method.RequireManagedProtocolContext().Code);
        }

        using (V8TenantContext.Enter("tenant-a", "platform-external-login-binding"))
        {
            Assert.Equal(1, method.RequireManagedProtocolContext().Code);
            Assert.NotEqual(1, method.RequireManagedProtocolContext().Code);
        }
    }
}
