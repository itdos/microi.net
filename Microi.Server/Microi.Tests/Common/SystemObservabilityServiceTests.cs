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

    [Fact]
    public void AnnotateFormEngine_SeparatesGenericRoutesByActionAndTableWithoutCapturingFilters()
    {
        SystemObservabilityService.ResetForTests();
        var context = NewContext("/api/FormEngine/GetTableData", "POST", "203.0.113.31", "");
        context.Response.StatusCode = 200;
        var lease = SystemObservabilityService.Begin(context);

        SystemObservabilityService.AnnotateFormEngine(context, "sys_user", "GetTableData");
        lease!.Complete(context);

        var snapshot = SystemObservabilityService.GetSnapshot(5, 10);
        var endpoint = Assert.Single(snapshot.TopEndpoints);
        Assert.Equal("/api/FormEngine/GetTableData::sys_user", endpoint.Key);
        Assert.Equal("FormEngine", endpoint.EndpointKind);
        Assert.DoesNotContain("Where", endpoint.Key, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void AnnotateControllerResource_SeparatesBoundedApplicationKeyAndRejectsUntrustedValues()
    {
        SystemObservabilityService.ResetForTests();
        var validContext = NewContext("/api/MicroApp/Resolve", "POST", "203.0.113.32", "");
        validContext.Response.StatusCode = 200;
        var validLease = SystemObservabilityService.Begin(validContext);
        SystemObservabilityService.AnnotateControllerResource(
            validContext,
            "MicroApp",
            "Resolve",
            "microi-platform-service");
        validLease!.Complete(validContext);

        var rejectedContext = NewContext("/api/MicroApp/Resolve", "POST", "203.0.113.33", "");
        rejectedContext.Response.StatusCode = 200;
        var rejectedLease = SystemObservabilityService.Begin(rejectedContext);
        SystemObservabilityService.AnnotateControllerResource(
            rejectedContext,
            "MicroApp",
            "Resolve",
            "../../secret?token=value");
        rejectedLease!.Complete(rejectedContext);

        var snapshot = SystemObservabilityService.GetSnapshot(5, 10);
        Assert.Contains(snapshot.TopEndpoints, item =>
            item.Key == "/api/MicroApp/Resolve::microi-platform-service");
        Assert.Contains(snapshot.TopEndpoints, item => item.Key == "/api/MicroApp/Resolve");
        Assert.DoesNotContain(snapshot.TopEndpoints, item =>
            item.Key.Contains("secret", StringComparison.OrdinalIgnoreCase)
            || item.Key.Contains("token", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void NetworkTraffic_AttributesBytesIdentityAndRiskWithoutCapturingQueryOrCredentials()
    {
        NetworkTrafficObservabilityService.ResetForTests();
        var context = NewContext(
            "/api/HDFS/Upload",
            "POST",
            "203.0.113.60",
            "token=must-not-appear&file=private");
        context.Request.ContentType = "multipart/form-data; boundary=test";
        context.Request.ContentLength = 25L * 1024L * 1024L;
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.ContentLength = 256;
        context.Response.StatusCode = 200;
        var lease = NetworkTrafficObservabilityService.Begin(context);

        NetworkTrafficObservabilityService.AnnotateIdentity(
            context,
            "user-1",
            "admin",
            "管理员",
            "tenant-a",
            "PC");
        NetworkTrafficObservabilityService.AnnotateTransfer(
            context,
            "Upload",
            1,
            25L * 1024L * 1024L,
            new[] { "report.zip" },
            new[] { ".zip" });
        lease!.Complete(context, false, 25L * 1024L * 1024L, 256);

        var snapshot = NetworkTrafficObservabilityService.GetSnapshot(5, 10);
        Assert.Equal(25L * 1024L * 1024L, snapshot.AccountedHttpReceivedBytes);
        Assert.Equal(256, snapshot.AccountedHttpSentBytes);
        Assert.Contains(snapshot.TopUsers, item => item.Key == "管理员(admin)");
        var transfer = Assert.Single(snapshot.RecentTransfers);
        Assert.True(transfer.IsUpload);
        Assert.Equal("Warning", transfer.RiskLevel);
        Assert.Equal("203.0.113.60", transfer.Ip);
        Assert.DoesNotContain("token", transfer.Route, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("must-not-appear", transfer.Route, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void NetworkTraffic_RollupRowsAreDeterministicAndBoundedPerDimension()
    {
        NetworkTrafficObservabilityService.ResetForTests();
        for (var i = 0; i < 30; i++)
        {
            var context = NewContext($"/apiengine/report-{i}", "POST", "203.0.113.61", "");
            context.Request.ContentLength = 100 + i;
            context.Response.ContentLength = 200 + i;
            context.Response.StatusCode = 200;
            var lease = NetworkTrafficObservabilityService.Begin(context);
            NetworkTrafficObservabilityService.AnnotateIdentity(
                context,
                "user-2",
                "auditor",
                "审计员",
                "tenant-a");
            lease!.Complete(context, false, 100 + i, 200 + i);
        }

        var nowUtc = DateTime.UtcNow;
        var bucketStartUtc = new DateTime(
            nowUtc.Year,
            nowUtc.Month,
            nowUtc.Day,
            nowUtc.Hour,
            nowUtc.Minute - nowUtc.Minute % 5,
            0,
            DateTimeKind.Utc);
        var first = NetworkTrafficObservabilityService.BuildRollupRows(bucketStartUtc, 5, 10);
        var second = NetworkTrafficObservabilityService.BuildRollupRows(bucketStartUtc, 5, 10);

        Assert.InRange(first.Count, 1, 51);
        Assert.Equal(first.Select(item => item.Id), second.Select(item => item.Id));
        Assert.Equal(first.Count, first.Select(item => item.Id).Distinct().Count());
        Assert.Contains(first, item => item.DimensionType == "Total" && item.RequestCount == 30);
        Assert.Equal(10, first.Count(item => item.DimensionType == "Endpoint"));
    }

    [Fact]
    public void NetworkTraffic_WindowsFilterAdaptersAreExcludedFromInterfaceTotals()
    {
        Assert.False(NetworkTrafficObservabilityService.IsWindowsFilterAdapter(
            "以太网",
            "Intel(R) Ethernet Connection"));
        Assert.False(NetworkTrafficObservabilityService.IsWindowsFilterAdapter(
            "vEthernet (WSL)",
            "Hyper-V Virtual Ethernet Adapter"));
        Assert.True(NetworkTrafficObservabilityService.IsWindowsFilterAdapter(
            "以太网-WFP Native MAC Layer LightWeight Filter-0000",
            "Intel Ethernet-WFP Native MAC Layer LightWeight Filter-0000"));
        Assert.True(NetworkTrafficObservabilityService.IsWindowsFilterAdapter(
            "以太网-QoS Packet Scheduler-0000",
            "Intel Ethernet-QoS Packet Scheduler-0000"));
        Assert.True(NetworkTrafficObservabilityService.IsWindowsFilterAdapter(
            "vSwitch (Default Switch)-Hyper-V Virtual Switch Extension Filter-0000",
            "Hyper-V Virtual Switch Extension Adapter"));
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
