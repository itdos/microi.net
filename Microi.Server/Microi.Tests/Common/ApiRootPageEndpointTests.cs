using Microi.net.Api;

namespace Dos.Common.Tests;

public sealed class ApiRootPageEndpointTests
{
    [Fact]
    public void DefaultPage_ContainsCompleteOfficialSiteIframe()
    {
        var html = MicroiApiRootPageEndpoint.ResolveRootPageHtml("  ");

        Assert.Contains("<!doctype html>", html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("src=\"https://microi.net\"", html, StringComparison.Ordinal);
        Assert.Contains("</iframe>", html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("</html>", html, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ConfiguredPage_PreservesTenantHtmlExactly()
    {
        const string configuredHtml = "<html><body>tenant page</body></html>";

        Assert.Equal(
            configuredHtml,
            MicroiApiRootPageEndpoint.ResolveRootPageHtml(configuredHtml));
    }

    [Fact]
    public void RootRoute_IsMappedWithoutRestoringMigratedHomeController()
    {
        var serverRoot = FindServerRoot();
        var apiRoot = Path.Combine(serverRoot, "Microi.net.Api");
        var hostSource = File.ReadAllText(Path.Combine(
            apiRoot,
            "Hosting",
            "MicroiApiHostExtensions.cs"));
        var endpointSource = File.ReadAllText(Path.Combine(
            apiRoot,
            "Hosting",
            "MicroiApiRootPageEndpoint.cs"));

        Assert.Contains("app.MapMicroiApiRootPage();", hostSource, StringComparison.Ordinal);
        Assert.Contains("app.MapGet(\"/\", HandleRootPage)", endpointSource, StringComparison.Ordinal);
        Assert.False(File.Exists(Path.Combine(apiRoot, "Controllers", "HomeController.cs")));
    }

    private static string FindServerRoot() => Microi.Tests.Common.TestProjectPaths.ServerRoot();
}
