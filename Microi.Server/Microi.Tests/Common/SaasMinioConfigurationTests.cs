using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class SaasMinioConfigurationTests
{
    private static JObject Row() => JObject.Parse("""
      {"Id":"row","OsClient":"main","OsClientType":"Product","OsClientNetwork":"Internal","HDFS":"Aliyun",
       "MinIOEndPoint":"https://nas.example.test:1120","MinIOEndPointInternet":"https://nas.example.test:1120",
       "MinIOEndPointSSL":1,"MinIOPrivateEndPointSSL":1,"MinIOPublicBucketName":"public-files",
       "MinIOPrivateBucketName":"private-files","MinIORegion":"","MinIOAccessKey":"fixture-access","MinIOSecretKey":"fixture-secret"}
      """);

    [Fact]
    public void PatchPreservesOmittedSecretsOriginalRowAndOssProvider()
    {
        var row=Row(); var copy=V8McpLogic.ApplySaasMinioPatch(row,new JObject { ["region"]="us-east-1" });
        Assert.Equal("fixture-secret",copy.Value<string>("MinIOSecretKey"));
        Assert.Equal("Aliyun",copy.Value<string>("HDFS")); Assert.Equal("",row.Value<string>("MinIORegion"));
        Assert.Equal("us-east-1",copy.Value<string>("MinIORegion"));
    }

    [Theory]
    [InlineData("{\"HDFS\":\"MinIO\"}")]
    [InlineData("{\"OsClient\":\"other\"}")]
    [InlineData("{\"secretKey\":null}")]
    [InlineData("{\"secretKey\":\"\"}")]
    [InlineData("{\"useSsl\":1}")]
    [InlineData("{\"endpoint\":\"https://user:password@nas.example.test\"}")]
    [InlineData("{\"endpoint\":\"https://nas.example.test/bucket\"}")]
    [InlineData("{\"endpoint\":\"https://nas.example.test?secret=x\"}")]
    [InlineData("{\"endpoint\":\"file:///tmp/a\"}")]
    [InlineData("{\"publicBucket\":\"private-files\"}")]
    public void InvalidPatchFailsClosed(string patch) => Assert.Throws<ArgumentException>(
        ()=>V8McpLogic.ApplySaasMinioPatch(Row(),JObject.Parse(patch)));

    [Fact]
    public void RevisionBindsSecretAndCoordinateWithoutExposingEither()
    {
        var row=Row(); var key="fixture-revision-signing-key";
        var revision=V8McpLogic.SaasMinioRevision(row,key);
        Assert.Matches("^[a-f0-9]{64}$",revision);
        row["MinIOSecretKey"]="changed"; Assert.NotEqual(revision,V8McpLogic.SaasMinioRevision(row,key));
        row=Row(); row["OsClientNetwork"]="Internet";
        Assert.NotEqual(revision,V8McpLogic.SaasMinioRevision(row,key));
    }

    [Fact]
    public void SafeProjectionContainsOnlyPresenceForCredentials()
    {
        var output=V8McpLogic.SaasMinioProjection(Row(),new string('a',64)).ToString();
        Assert.DoesNotContain("fixture-secret",output); Assert.DoesNotContain("fixture-access",output);
        Assert.DoesNotContain("MinIOSecretKey",output); Assert.Contains("HasSecretKey",output);
    }

    [Fact]
    public void HistoricalCredentialBearingEndpointIsNeverReturned()
    {
        var row=Row(); row["MinIOEndPoint"]="https://user:fixture-secret@nas.example.test";
        var projection=V8McpLogic.SaasMinioProjection(row,new string('a',64));
        Assert.Equal(JTokenType.Null,projection["Endpoint"]!.Type);
        Assert.DoesNotContain("fixture-secret",projection.ToString());
    }

    [Fact]
    public async Task AnonymousRejectedBeforeConfigurationOrNetwork()
    {
        var result=await V8McpLogic.ManageSaasMinio(new JObject { ["Action"]="Inspect" },null,CancellationToken.None);
        Assert.Equal(0,result.Code); Assert.Null(result.Data);
    }
}
