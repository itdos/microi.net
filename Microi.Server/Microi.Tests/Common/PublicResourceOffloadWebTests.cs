using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class PublicResourceOffloadWebTests
{
    private static (JObject App,JObject Version) Fixture()
    {
        var app = new JObject { ["Id"]="application-id",["AppKey"]="downloads",["ApplicationType"]="Web",
            ["IsPublic"]=1,["Status"]="Published",["BuildStatus"]="Success",["PublishProtocolVersion"]=3,
            ["PublishState"]="Completed",["CommittedPublishVersionId"]="version-id" };
        var version = new JObject { ["Id"]="version-id",["AppId"]="application-id",["VersionNo"]="v1.4.6",
            ["PublishProtocolVersion"]=3,["PublishState"]="Completed",["RequestFingerprint"]=new string('a',64),
            ["ReleasePrefix"]="microi/application-assets/v3/tenants/tenant/kinds/runtime/apps/downloads/releases/v1.4.6/requests/"+new string('a',64),
            ["AssetManifestJson"]="[{\"Path\":\"index.html\",\"Size\":12,\"Sha256\":\""+new string('b',64)+"\",\"FilePathName\":\"attacker/override\"}]" };
        return (app,version);
    }

    [Theory]
    [InlineData("Web")]
    [InlineData("UniApp")]
    public void CommittedWebUsesItsOwnManifestWithoutCreatingServiceRow(string type)
    {
        var f=Fixture();f.App["ApplicationType"]=type;
        var before=f.Version.ToString();
        var service=PublicResourceOffloadRuntime.BuildCommittedPublicWebManifest("Tenant","downloads",f.App,f.Version);
        var assets=JObject.Parse(service.Value<string>("AssetManifestJson")!)["Assets"]!;
        Assert.Equal(f.Version.Value<string>("ReleasePrefix")+"/assets/index.html",assets[0]!.Value<string>("FilePathName"));
        Assert.Equal("v1.4.6",service.Value<string>("BuildVersion"));
        Assert.Equal(before,f.Version.ToString());
    }

    [Theory]
    [InlineData("IsPublic","0")]
    [InlineData("PublishState","\"ProjectionPending\"")]
    [InlineData("Status","\"Draft\"")]
    [InlineData("CommittedPublishVersionId","\"other\"")]
    [InlineData("ApplicationType","\"MicroService\"")]
    public void PrivateUncommittedOrWrongApplicationCannotUseWebFallback(string field,string value)
    {
        var f=Fixture();f.App[field]=JToken.Parse(value);
        Assert.Throws<InvalidOperationException>(()=>PublicResourceOffloadRuntime.BuildCommittedPublicWebManifest("tenant","downloads",f.App,f.Version));
    }

    [Theory]
    [InlineData("AppId","\"another-application\"")]
    [InlineData("PublishState","\"Staging\"")]
    [InlineData("ReleasePrefix","\"microi/application-assets/v3/tenants/other/source\"")]
    [InlineData("AssetManifestJson","\"[]\"")]
    [InlineData("AssetManifestJson","\"[{\\\"Path\\\":\\\"../private-source/key\\\"}]\"")]
    public void WrongCoordinateOrManifestFailsBeforeSourceRead(string field,string value)
    {
        var f=Fixture();f.Version[field]=JToken.Parse(value);
        Assert.Throws<InvalidOperationException>(()=>PublicResourceOffloadRuntime.BuildCommittedPublicWebManifest("tenant","downloads",f.App,f.Version));
    }
}
