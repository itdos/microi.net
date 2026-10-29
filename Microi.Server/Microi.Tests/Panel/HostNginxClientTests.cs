using System.Net;
using System.Reflection;
using System.Text;
using System.Text.Json.Nodes;
using Microi.Panel;
using Microi.Panel.Panel;

namespace Microi.Tests.Panel;

public sealed class HostNginxClientTests
{
    private const string Instance="baota-native",Site="example.conf";
    private static readonly string Fingerprint=new('a',64),Sha=new('b',64);
    private static readonly string RequestId=Guid.NewGuid().ToString();
    private sealed class ReplyHandler(Func<HttpRequestMessage,Task<HttpResponseMessage>> reply):HttpMessageHandler
    {
        public int Calls{get;private set;}
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            Calls++;
            if(request.Content is not null)
            {
                var declared=request.Content.Headers.ContentLength;
                Assert.NotNull(declared);Assert.NotEqual(true,request.Headers.TransferEncodingChunked);Assert.NotEqual(true,request.Headers.ExpectContinue);
                Assert.Equal("application/json; charset=utf-8",request.Content.Headers.ContentType!.ToString());
                Assert.Equal((await request.Content.ReadAsByteArrayAsync(ct)).LongLength,declared);
            }
            return await reply(request);
        }
    }
    private static HttpResponseMessage Reply(JsonNode value)=>new(HttpStatusCode.OK){Content=new StringContent(value.ToJsonString(),Encoding.UTF8,"application/json")};
    private static ReplyHandler Handler(JsonObject value)=>new(_=>Task.FromResult(Reply(value)));
    // 只替换内部HTTP传输，完整执行生产客户端解析和回执验证，不开放生产socket配置入口。
    private static HostNginxService Client(ReplyHandler handler)=>(HostNginxService)typeof(HostNginxService)
        .GetConstructor(BindingFlags.Instance|BindingFlags.NonPublic,null,[typeof(HttpMessageHandler)],null)!.Invoke([handler]);
    private static string Hash(string value)=>Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static JsonObject WriteReceipt()=>new(){["instanceId"]=Instance,["siteId"]=Site,["fingerprint"]=Fingerprint,["requestId"]=RequestId,
        ["validated"]=true,["reloaded"]=true,["configSha256"]=Hash("server { listen 80; }")};
    private static HostNginxSaveRequest SaveRequest(string content="server { listen 80; }")=>new(Instance,Site,Fingerprint,Sha,RequestId,content,Site);

    [Fact]
    public async Task ChineseConfigurationHasKnownUtf8ContentLengthBeforeReadingTheBody()
    {
        const string content="server { listen 80; # 中文站点\n }";
        var transport=new ReplyHandler(async request=>
        {
            // 提前检查可计算长度，避免先缓冲 JsonContent 后掩盖真实 HTTP 分块传输。
            var declared=request.Content!.Headers.ContentLength;
            Assert.NotNull(declared);Assert.NotEqual(true,request.Headers.TransferEncodingChunked);Assert.NotEqual(true,request.Headers.ExpectContinue);
            Assert.Equal("application/json; charset=utf-8",request.Content.Headers.ContentType!.ToString());
            var bytes=await request.Content.ReadAsByteArrayAsync();Assert.Equal(bytes.LongLength,declared);
            var body=JsonNode.Parse(bytes)!;Assert.Equal(content,body["content"]!.GetValue<string>());
            var receipt=WriteReceipt();receipt["configSha256"]=Hash(content);return Reply(receipt);
        });
        using var client=Client(transport);
        await client.Save(SaveRequest(content),TestContext.Current.CancellationToken);Assert.Equal(1,transport.Calls);
    }

    [Theory]
    [InlineData("attach")][InlineData("test")][InlineData("reload")]
    public async Task EmptyHttpSuccessNeverConfirmsAMutation(string action)
    {
        using var client=Client(Handler(new()));
        var error=await Assert.ThrowsAsync<OpsException>(()=>Control(client,action));Assert.Equal(502,error.Status);
    }
    private static Task<JsonObject> Control(HostNginxService client,string action)=>action switch
    {"attach"=>client.Attach(new(Instance,Fingerprint,Instance),TestContext.Current.CancellationToken),"test"=>client.Test(new(Instance,Fingerprint,Instance),TestContext.Current.CancellationToken),_=>client.Reload(new(Instance,Fingerprint,Instance),TestContext.Current.CancellationToken)};
    [Theory]
    [InlineData("attach")][InlineData("test")][InlineData("reload")]
    public async Task ControlsRequireTypedPositiveReceipts(string action)
    {
        var receipt=WriteReceipt();receipt["attached"]=true;
        using(var client=Client(Handler(receipt)))Assert.Equal(Instance,(await Control(client,action))["instanceId"]!.GetValue<string>());
        receipt[action=="attach"?"attached":action=="test"?"validated":"reloaded"]="true";
        using(var client=Client(Handler(receipt)))Assert.Equal(502,(await Assert.ThrowsAsync<OpsException>(()=>Control(client,action))).Status);
    }
    [Theory]
    [InlineData("instanceId","other")][InlineData("fingerprint","ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")]
    [InlineData("siteId","other.conf")][InlineData("requestId","00000000-0000-0000-0000-000000000000")]
    [InlineData("configSha256","invalid")][InlineData("validated","true")][InlineData("reloaded","true")]
    public async Task SavedConfigurationReceiptMustMatchExactRequest(string field,string wrong)
    {
        var receipt=WriteReceipt();receipt[field]=wrong;using var client=Client(Handler(receipt));
        Assert.Equal(502,(await Assert.ThrowsAsync<OpsException>(()=>client.Save(SaveRequest(),TestContext.Current.CancellationToken))).Status);
    }
    [Theory]
    [InlineData("{}")][InlineData("{\"instances\":[],\"errors\":[]}")]
    [InlineData("{\"instances\":[],\"errors\":[],\"protocol\":2}")]
    [InlineData("{\"instances\":[],\"errors\":[],\"protocol\":\"1\"}")]
    public async Task DiscoveryRejectsMissingOrIncompatibleProtocol(string json)
    {
        using var client=Client(Handler(JsonNode.Parse(json)!.AsObject()));
        Assert.Equal(502,(await Assert.ThrowsAsync<OpsException>(()=>client.Instances(TestContext.Current.CancellationToken))).Status);
    }
    [Fact]
    public async Task DiscoveryAcceptsExplicitProtocolAndEmptyActualInventory()
    {
        using var client=Client(Handler(new(){["instances"]=new JsonArray(),["errors"]=new JsonArray(),["protocol"]=1}));
        Assert.Empty((await client.Instances(TestContext.Current.CancellationToken))["instances"]!.AsArray());
    }
    [Theory]
    [InlineData("number")][InlineData("domains-missing")][InlineData("domains-number")]
    public async Task ConfigurationCannotReturnUntypedContentOrDomains(string invalid)
    {
        var receipt=new JsonObject{["instanceId"]=Instance,["siteId"]=Site,["fingerprint"]=Fingerprint,["sha256"]=Hash("server {}"),["content"]="server {}",["domains"]=new JsonArray("example.test")};
        if(invalid=="number")receipt["content"]=42;
        if(invalid=="domains-missing")receipt.Remove("domains");
        if(invalid=="domains-number")receipt["domains"]=new JsonArray(42);
        using var client=Client(Handler(receipt));Assert.Equal(502,(await Assert.ThrowsAsync<OpsException>(()=>client.Configuration(Instance,Site,TestContext.Current.CancellationToken))).Status);
    }
    [Fact]
    public async Task ConfigurationChecksQueryIdentityAndReturnsCurrentDomainSnapshot()
    {
        var receipt=new JsonObject{["instanceId"]=Instance,["siteId"]=Site,["fingerprint"]=Fingerprint,["sha256"]=Hash("server {}"),["content"]="server {}",["domains"]=new JsonArray("current.test")};
        using(var client=Client(Handler(receipt)))Assert.Equal("current.test",(await client.Configuration(Instance,Site,TestContext.Current.CancellationToken))["domains"]![0]!.GetValue<string>());
        receipt["siteId"]="stale.conf";
        using(var client=Client(Handler(receipt)))await Assert.ThrowsAsync<OpsException>(()=>client.Configuration(Instance,Site,TestContext.Current.CancellationToken));
    }
    private static JsonObject PreparedReceipt()
    {
        var value=WriteReceipt();value["prepared"]=true;value["isolationId"]=Sha;value["challengeHostPath"]="/www/example/.microi-acme-"+Sha;
        value["domains"]=new JsonArray("example.test");return value;
    }
    [Fact]
    public async Task Http01SendsDomainsBeforeHostCanPrepareTheRoute()
    {
        var transport=new ReplyHandler(async request=>
        {
            Assert.Equal("/nginx/http01",request.RequestUri!.AbsolutePath);
            var body=JsonNode.Parse(await request.Content!.ReadAsStringAsync())!;
            Assert.Equal("example.test",body["expectedDomains"]![0]!.GetValue<string>());
            return Reply(PreparedReceipt());
        });
        using var client=Client(transport);
        await client.PrepareHttp01(new(Instance,Site,Fingerprint,Sha,RequestId,Site,["example.test"]),TestContext.Current.CancellationToken);Assert.Equal(1,transport.Calls);
    }
    [Theory]
    [InlineData("different")][InlineData("null")][InlineData("number")][InlineData("duplicate")]
    public async Task Http01RejectsAReceiptForDifferentOrMalformedDomains(string invalid)
    {
        var receipt=PreparedReceipt();receipt["domains"]=invalid switch
        {"different"=>new JsonArray("stale.test"),"null"=>null,"number"=>new JsonArray(5),_=>new JsonArray("example.test","example.test")};
        using var client=Client(Handler(receipt));
        Assert.Equal(502,(await Assert.ThrowsAsync<OpsException>(()=>client.PrepareHttp01(new(Instance,Site,Fingerprint,Sha,RequestId,Site,["example.test"]),TestContext.Current.CancellationToken))).Status);
    }
    [Theory]
    [InlineData("missing")][InlineData("wrong-hash")][InlineData("duplicate")]
    public async Task TlsReceiptMustCoverEachRequestedSniExactlyOnce(string invalid)
    {
        var rows=new JsonArray(new JsonObject{["serverName"]="a.test",["sha256"]=Sha},new JsonObject{["serverName"]="b.test",["sha256"]=Fingerprint});
        if(invalid=="missing")rows.RemoveAt(1);
        if(invalid=="wrong-hash")rows[1]!["sha256"]=Sha;
        if(invalid=="duplicate")rows[1]=rows[0]!.DeepClone();
        using var client=Client(Handler(new(){["verified"]=true,["certificates"]=rows}));
        Assert.Equal(502,(await Assert.ThrowsAsync<OpsException>(()=>client.VerifyManagedTls(new("owner","nginx","container",[new("a.test",Sha),new("b.test",Fingerprint)]),TestContext.Current.CancellationToken))).Status);
    }
    [Fact]
    public async Task TlsReceiptDoesNotAcceptDuplicateRequestDomains()
    {
        var receipt=new JsonObject{["verified"]=true,["certificates"]=new JsonArray(new JsonObject{["serverName"]="a.test",["sha256"]=Sha})};
        using(var client=Client(Handler(receipt)))await client.VerifyManagedTls(new("owner","nginx","container",[new("a.test",Sha)]),TestContext.Current.CancellationToken);
        receipt["certificates"]!.AsArray().Add(new JsonObject{["serverName"]="a.test",["sha256"]=Sha});
        using(var client=Client(Handler(receipt)))await Assert.ThrowsAsync<OpsException>(()=>client.VerifyManagedTls(new("owner","nginx","container",[new("a.test",Sha),new("a.test",Sha)]),TestContext.Current.CancellationToken));
    }
    [Fact]
    public async Task ConfigurationBudgetCountsUtf8BytesBeforeTransport()
    {
        var transport=new ReplyHandler(async request=>
        {
            var body=JsonNode.Parse(await request.Content!.ReadAsStringAsync())!;
            var receipt=WriteReceipt();receipt["configSha256"]=Hash(body["content"]!.GetValue<string>());return Reply(receipt);
        });using var client=Client(transport);
        await client.Save(SaveRequest(new string('a',128*1024)),TestContext.Current.CancellationToken);
        await client.Save(SaveRequest(new string('中',43690)),TestContext.Current.CancellationToken);
        Assert.Equal(2,transport.Calls);
        await Assert.ThrowsAsync<OpsException>(()=>client.Save(SaveRequest(new string('中',43691)),TestContext.Current.CancellationToken));
        await Assert.ThrowsAsync<OpsException>(()=>client.Save(SaveRequest(new string('a',128*1024+1)),TestContext.Current.CancellationToken));
        await Assert.ThrowsAsync<OpsException>(()=>client.Save(SaveRequest("server\0{}"),TestContext.Current.CancellationToken));
        Assert.Equal(2,transport.Calls);
    }
}
