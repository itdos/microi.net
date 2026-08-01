using Dos.Common;
using Microi.net.Api;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class DiagnosticsControllerTests
{
    [Fact]
    public void Diagnostics_ExposeOneStableProcessInstanceId()
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
