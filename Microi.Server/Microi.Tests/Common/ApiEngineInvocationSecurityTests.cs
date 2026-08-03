using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class ApiEngineInvocationSecurityTests
{
    [Fact]
    public void StopHttp_BlocksOrdinaryClientInvocation()
    {
        Assert.True(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
            true,
            "Client",
            false,
            TrustedWorkerParam()));
    }

    [Fact]
    public void StopHttp_AllowsOnlyCompletePersistedWorkerEnvelope()
    {
        var param = TrustedWorkerParam();

        Assert.False(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
            true,
            "Client",
            true,
            param));

        foreach (var field in new[]
                 {
                     "_TrustedServerInvocation",
                     "_BackgroundTaskId",
                     "_BackgroundTask",
                     "_BackgroundTaskFencingToken"
                 })
        {
            var incomplete = (JObject)param.DeepClone();
            incomplete.Remove(field);
            Assert.True(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
                true,
                "Client",
                true,
                incomplete));
        }
    }

    [Fact]
    public void StopHttp_BlocksMismatchedOrInvalidWorkerLease()
    {
        var mismatchedTask = TrustedWorkerParam();
        mismatchedTask["_BackgroundTask"]!["Id"] = "another-task";
        Assert.True(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
            true,
            "Client",
            true,
            mismatchedTask));

        var invalidFence = TrustedWorkerParam();
        invalidFence["_BackgroundTaskFencingToken"] = 0;
        Assert.True(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
            true,
            "Client",
            true,
            invalidFence));
    }

    [Fact]
    public void StopHttp_DoesNotAffectServerOrDisabledPolicy()
    {
        Assert.False(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
            true,
            "Server",
            false,
            new JObject()));
        Assert.False(ApiEngineInvocationSecurity.ShouldBlockStopHttp(
            false,
            "Client",
            false,
            new JObject()));
    }

    private static JObject TrustedWorkerParam()
    {
        return new JObject
        {
            ["_TrustedServerInvocation"] = true,
            ["_BackgroundTaskId"] = "task-01",
            ["_BackgroundTaskFencingToken"] = 3,
            ["_BackgroundTask"] = new JObject
            {
                ["Id"] = "task-01",
                ["FencingToken"] = 3
            }
        };
    }
}
