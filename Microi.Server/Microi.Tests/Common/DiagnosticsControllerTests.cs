using Dos.Common;
using Microi.net.Api;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using Dos.Common.Tests;

namespace Microi.Tests.Common;

[Collection(SaaSRuntimeConfigurationCollection.Name)]
public class DiagnosticsControllerTests
{
    [Fact]
    public void Diagnostics_ExposeOneStableProcessInstanceId()
    {
        SaaSRuntimeConfigurationScope.Run(new JObject
        {
            ["Id"] = "diagnostics-tenant-row",
            ["AuthSecret"] = "diagnostics_restart_stable_secret_0123456789"
        }, () =>
        {
            var firstController = CreateController();
            var secondController = CreateController();

            var firstLiveness = ReadBody(firstController.Liveness());
            var secondLiveness = ReadBody(secondController.Liveness());
            var health = ReadBody(firstController.HealthCheck());

            var firstId = firstLiveness.SelectToken("Data.InstanceId")?.Value<string>();
            var secondId = secondLiveness.SelectToken("Data.InstanceId")?.Value<string>();
            var healthId = health.SelectToken("Data.InstanceId")?.Value<string>();

            Assert.Matches("^[a-f0-9]{32}$", firstId ?? string.Empty);
            Assert.Equal(firstId, secondId);
            Assert.Equal(firstId, healthId);
            Assert.True(health.SelectToken("Data.JwtSigningKey.Ready")?.Value<bool>());
            Assert.Contains(
                health.SelectToken("Data.JwtSigningKey.Source")?.Value<string>(),
                new[] { "sys_osclients", "Configuration" });
            Assert.Matches(
                "^[a-f0-9]{16}$",
                health.SelectToken("Data.JwtSigningKey.Fingerprint")?.Value<string>() ?? string.Empty);
        });
    }

    [Fact]
    public void Diagnostics_RejectsTrafficWithoutStableJwtSigningKey()
    {
        SaaSRuntimeConfigurationScope.Run(new JObject
        {
            ["AuthSecret"] = string.Empty
        }, () =>
        {
            var response = CreateController().HealthCheck();
            var unavailable = Assert.IsType<ObjectResult>(response.Result);
            Assert.Equal(503, unavailable.StatusCode);

            var body = JObject.FromObject(Assert.IsType<DosResult>(unavailable.Value));
            Assert.Equal(0, body["Code"]?.Value<int>());
            Assert.False(body.SelectToken("Data.JwtSigningKey.Ready")?.Value<bool>());
            Assert.Equal(
                "Unavailable",
                body.SelectToken("Data.JwtSigningKey.Source")?.Value<string>());
        });
    }

    private static DiagnosticsController CreateController()
    {
        var options = new ProcessMemoryGuardOptions
        {
            Enabled = true,
            EffectiveMemoryBytes = 8L * 1024 * 1024 * 1024,
            EffectiveMemorySource = "Test",
            SoftLimitBytes = 6L * 1024 * 1024 * 1024,
            HardLimitBytes = 7L * 1024 * 1024 * 1024
        };
        return new DiagnosticsController(new ProcessMemoryPressureState(options));
    }

    private static JObject ReadBody(ActionResult<DosResult> result)
    {
        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.NotNull(ok.Value);
        return JObject.FromObject(ok.Value);
    }
}
