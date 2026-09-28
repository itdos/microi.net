using System.Net;
using System.Net.Http;
using System.Text;
using Microi.License;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public sealed class LicenseStartupReportingTests
{
    [Theory]
    [InlineData("", "")]
    [InlineData("Personal", "Customer")]
    [InlineData("Enterprise", "Customer")]
    public async Task StartupReportIncludesOpenSourceAndLicensedNodes(string productType, string company)
    {
        Uri? target = null;
        string? body = null;
        using var client = new HttpClient(new RecordingHandler(async request =>
        {
            target = request.RequestUri;
            body = await request.Content!.ReadAsStringAsync();
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{\"Code\":1}", Encoding.UTF8, "application/json")
            };
        }));

        var success = await LicenseStartupReporter.ReportAsync(client, new LicenseInfo
        {
            HID = "device-123",
            Company = company,
            ProductType = productType,
            ExpirationDate = DateTime.UtcNow.AddYears(1)
        }, TestContext.Current.CancellationToken);

        Assert.True(success);
        Assert.Equal("https://api.itdos.com/apiengine/check-license?OsClient=iTdos", target?.ToString());
        var json = JObject.Parse(body!);
        Assert.Equal("device-123", json.Value<string>("HID"));
        Assert.Equal(productType, json.Value<string>("ProductType"));
        Assert.Equal(company, json.Value<string>("Company"));
        Assert.Null(json["Signature"]);
        Assert.Null(json["LicenseContent"]);
    }

    [Theory]
    [InlineData(HttpStatusCode.ServiceUnavailable, "{\"Code\":1}")]
    [InlineData(HttpStatusCode.OK, "{\"Code\":0}")]
    [InlineData(HttpStatusCode.OK, "invalid-json")]
    public async Task FailedReportIsNotCountedAsDelivered(HttpStatusCode status, string response)
    {
        using var client = new HttpClient(new RecordingHandler(_ => Task.FromResult(
            new HttpResponseMessage(status) { Content = new StringContent(response) })));

        Assert.False(await LicenseStartupReporter.ReportAsync(client,
            new LicenseInfo { HID = "device-123" }, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task MissingHardwareIdDoesNotSendAReport()
    {
        var sent = false;
        using var client = new HttpClient(new RecordingHandler(_ =>
        {
            sent = true;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        }));

        Assert.False(await LicenseStartupReporter.ReportAsync(client,
            new LicenseInfo { HID = "" }, TestContext.Current.CancellationToken));
        Assert.False(sent);
    }

    private sealed class RecordingHandler(
        Func<HttpRequestMessage, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken) => send(request);
    }
}
