using System.Net;
using Microi.net;
using Microsoft.AspNetCore.Http;

namespace Microi.Tests.Common;

public sealed class SystemObservabilityServiceTests
{
    [Fact]
    public void NormalizeRoute_BoundsHighCardinalitySegmentsAndTenantSuffix()
    {
        Assert.Equal(
            "/api/formengine/get/{id}",
            SystemObservabilityService.NormalizeRoute(
                "/api/formengine/get/6f9619ff-8b86-d011-b42d-00cf4fc964ff?token=secret"));
        Assert.Equal(
            "/apiengine/orders/{id}",
            SystemObservabilityService.NormalizeRoute(
                "/apiengine/orders/123456--OsClient--tenant-a--"));
    }

    [Fact]
    public void Snapshot_TracksApiWithoutSecretsAndSeparatesDiagnosticTraffic()
    {
        SystemObservabilityService.ResetForTests();
        Complete("/apiengine/customer-search", "203.0.113.10", 200, "tenant-a", "token=must-not-appear");
        Complete("/apiengine/mci-system-observability-query", "203.0.113.11", 200, "tenant-a", "cookie=must-not-appear");

        var snapshot = SystemObservabilityService.GetSnapshot(5, 10);

        Assert.Equal(2, snapshot.Requests.RequestCount);
        Assert.Equal(1, snapshot.Requests.DiagnosticRequestCount);
        var endpoint = Assert.Single(snapshot.TopEndpoints);
        Assert.Equal("/apiengine/customer-search", endpoint.Key);
        Assert.DoesNotContain("token", snapshot.RecentRequests[0].Path, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("cookie", snapshot.RecentRequests[1].Path, StringComparison.OrdinalIgnoreCase);
        Assert.Contains(snapshot.TopIps, item => item.Key == "203.0.113.10");
    }

    [Fact]
    public void Begin_IgnoresNonApiAndOptionsRequests()
    {
        SystemObservabilityService.ResetForTests();
        var staticContext = NewContext("/assets/app.js", "GET", "127.0.0.1", "");
        var optionsContext = NewContext("/api/test", "OPTIONS", "127.0.0.1", "");

        Assert.Null(SystemObservabilityService.Begin(staticContext));
        Assert.Null(SystemObservabilityService.Begin(optionsContext));
        Assert.Equal(0, SystemObservabilityService.GetSnapshot().Requests.RequestCount);
    }

    [Fact]
    public void AnnotateApiEngine_UsesBoundIdentifiersWithoutReadingTheRequestBody()
    {
        SystemObservabilityService.ResetForTests();
        var context = NewContext("/api/ApiEngine/Run", "POST", "203.0.113.30", "");
        context.Response.StatusCode = 200;
        var lease = SystemObservabilityService.Begin(context);

        SystemObservabilityService.AnnotateApiEngine(context, "customer-search", "tenant-a");
        lease!.Complete(context);

        var snapshot = SystemObservabilityService.GetSnapshot(5, 10);
        var endpoint = Assert.Single(snapshot.TopEndpoints);
        Assert.Equal("/apiengine/customer-search", endpoint.Key);
        Assert.Equal("customer-search", endpoint.ApiEngineKey);
        Assert.Equal("tenant-a", Assert.Single(snapshot.RecentRequests).RequestedOsClient);
    }

    private static void Complete(string path, string ip, int status, string osClient, string query)
    {
        var context = NewContext(path, "POST", ip, query);
        context.Response.StatusCode = status;
        var lease = SystemObservabilityService.Begin(context);
        Assert.NotNull(lease);
        lease!.Complete(context);
    }

    private static DefaultHttpContext NewContext(
        string path,
        string method,
        string ip,
        string query)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = method;
        context.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        context.TraceIdentifier = Guid.NewGuid().ToString("N");
        context.Request.QueryString = string.IsNullOrWhiteSpace(query)
            ? QueryString.Empty
            : new QueryString("?" + query);
        context.Request.Headers["Diy-OsClient"] = "tenant-a";
        context.Request.Headers["Authorization"] = "Bearer must-not-appear";
        context.Request.Headers["Cookie"] = "DiyToken=must-not-appear";
        return context;
    }
}
