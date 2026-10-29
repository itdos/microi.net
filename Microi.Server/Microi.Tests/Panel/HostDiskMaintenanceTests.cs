using System.Net;
using System.Reflection;
using System.Text;
using System.Text.Json.Nodes;
using Microi.Panel;
using Microi.Panel.Panel;

namespace Microi.Tests.Panel;

public sealed class HostDiskMaintenanceTests
{
    private sealed class Handler(Func<HttpRequestMessage, Task<HttpResponseMessage>> reply): HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)=>reply(request);
    }
    private static HostDiskMaintenanceClient Client(Handler handler)=>(HostDiskMaintenanceClient)typeof(HostDiskMaintenanceClient)
        .GetConstructor(BindingFlags.Instance|BindingFlags.NonPublic,null,[typeof(HttpMessageHandler)],null)!.Invoke([handler]);
    private static HttpResponseMessage Reply(string body,HttpStatusCode status=HttpStatusCode.OK)=>new(status){Content=new StringContent(body,Encoding.UTF8,"application/json")};
    [Fact]
    public async Task FixedProtocolWithBoundedJsonProtectsUpdateAndDoesNotExposeCommands()
    {
        using var client=Client(new(async request=>{
            Assert.Equal("http://localhost/preflight",request.RequestUri!.AbsoluteUri);
            Assert.Equal(HttpMethod.Post,request.Method);
            Assert.NotNull(request.Content!.Headers.ContentLength);
            Assert.NotEqual(true,request.Headers.TransferEncodingChunked);
            var body=JsonNode.Parse(await request.Content.ReadAsStringAsync())!.AsObject();
            Assert.Equal(new[]{"images","operationId","requiredBytes"},body.Select(x=>x.Key).Order().ToArray());
            Assert.Single(body["images"]!.AsArray());
            return Reply("{\"ready\":true,\"operationId\":\"owned-update\"}");
        }));
        await client.Protect("owned-update",["example.test/api:v1","example.test/api:v1"],2147483648,CancellationToken.None);
    }
    [Theory]
    [InlineData("{}")]
    [InlineData("{\"protocol\":2,\"volumesNeverDeleted\":true,\"policy\":{}}")]
    [InlineData("{\"protocol\":1,\"volumesNeverDeleted\":false,\"policy\":{}}")]
    public async Task MissingOrDifferentSafetyProtocolCannotReportAvailable(string body)
    {
        using var client=Client(new(_=>Task.FromResult(Reply(body))));
        Assert.Null(await client.OptionalStatus(CancellationToken.None));
    }
    [Fact]
    public async Task WrongOperationReceiptStopsUpdate()
    {
        using var client=Client(new(_=>Task.FromResult(Reply("{\"ready\":true,\"operationId\":\"another-update\"}"))));
        await Assert.ThrowsAsync<OpsException>(()=>client.Protect("owned-update",[],0,CancellationToken.None));
    }
    [Theory]
    [InlineData("not-json")]
    [InlineData("[]")]
    public async Task InvalidResponsesDoNotReportSuccess(string body)
    {
        using var client=Client(new(_=>Task.FromResult(Reply(body))));
        await Assert.ThrowsAsync<OpsException>(()=>client.Preview(CancellationToken.None));
    }
    [Fact]
    public async Task ServiceRejectionRemainsAnError()
    {
        using var client=Client(new(_=>Task.FromResult(Reply("{\"error\":\"空间预算不足\"}",HttpStatusCode.Conflict))));
        var error=await Assert.ThrowsAsync<OpsException>(()=>client.Preview(CancellationToken.None));
        Assert.Contains("空间预算不足",error.Message);
    }
}
