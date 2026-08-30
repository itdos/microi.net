using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class DiagnosticsControllerTests
{
    [Fact]
    public void DiagnosticsRoutes_AreOwnedByAnonymousManagedApiEngine()
    {
        var root = FindRepositoryRoot();
        var controllerPath = Path.Combine(
            root, "Microi.Server", "Microi.net.Api", "Controllers", "DiagnosticsController.cs");
        var source = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Resource", "platform-service-health.js"));
        var package = JObject.Parse(File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Resource", "app.microi.saas-engine.json")));
        var engine = package["SysApiEngines"]!.Values<JObject>()
            .Single(item => item.Value<string>("ApiEngineKey") == "platform-service-health");

        Assert.False(File.Exists(controllerPath));
        Assert.Equal(1, engine.Value<int>("AllowAnonymous"));
        Assert.Equal(0, engine.Value<int>("StopHttp"));
        Assert.Contains("/api/Diagnostics/health", engine.Value<string>("ApiRoutes"));
        Assert.Contains("/api/Diagnostics/liveness", engine.Value<string>("ApiRoutes"));
        Assert.Contains("V8.Method.GetBackendVersion", source, StringComparison.Ordinal);
        Assert.DoesNotContain("platform-runtime-custom-hook", source, StringComparison.Ordinal);
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
