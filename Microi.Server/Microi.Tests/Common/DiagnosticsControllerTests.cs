using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class DiagnosticsControllerTests
{
    [Fact]
    public void DiagnosticsRoutes_AreOwnedByHostAndDoNotDependOnTenantRuntime()
    {
        var root = FindRepositoryRoot();
        var controllerPath = Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "DiagnosticsController.cs");
        var source = File.ReadAllText(controllerPath);

        Assert.Contains("[AllowAnonymous]", source, StringComparison.Ordinal);
        Assert.Contains("[HttpGet(\"health\")]", source, StringComparison.Ordinal);
        Assert.Contains("[HttpGet(\"liveness\")]", source, StringComparison.Ordinal);
        Assert.Contains("[HttpGet(\"/apiengine/platform-service-health\")]", source, StringComparison.Ordinal);
        Assert.Contains("[HttpGet(\"/itdos-heart\")]", source, StringComparison.Ordinal);
        Assert.Contains("V8Method.GetCurrentBackendVersion()", source, StringComparison.Ordinal);
        Assert.DoesNotContain("FormEngine", source, StringComparison.Ordinal);
        Assert.DoesNotContain("ApiEngine.Run", source, StringComparison.Ordinal);
        Assert.DoesNotContain("GetSysConfig", source, StringComparison.Ordinal);

        var controller = new DiagnosticsController
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
        var result = controller.Health();
        Assert.Equal(1, result.Code);
        Assert.Equal("no-store, no-cache, must-revalidate",
            controller.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public void JwtSigningKeyStatus_RequiresDurableTenantIdentity()
    {
        var stable = DiyToken.EvaluateJwtSigningKeyStatus(
            new OsClientSecret
            {
                OsClient = "diagnostics",
                OsClientModel = new JObject
                {
                    ["Id"] = "diagnostics-tenant-row",
                    ["AuthSecret"] = "diagnostics_restart_stable_secret_0123456789"
                }
            },
            string.Empty);
        var unavailable = DiyToken.EvaluateJwtSigningKeyStatus(
            new OsClientSecret
            {
                OsClient = "diagnostics",
                OsClientModel = new JObject { ["AuthSecret"] = string.Empty }
            },
            string.Empty);

        Assert.True(stable.Ready);
        Assert.True(stable.Durable);
        Assert.Equal("sys_osclients", stable.Source);
        Assert.Matches("^[a-f0-9]{16}$", stable.Fingerprint);
        Assert.False(unavailable.Ready);
        Assert.Equal("Unavailable", unavailable.Source);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server"))
                && Directory.Exists(Path.Combine(directory.FullName, "Microi.Client")))
                return directory.FullName;
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
