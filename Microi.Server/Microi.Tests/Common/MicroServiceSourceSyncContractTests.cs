using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class MicroServiceSourceSyncContractTests
{
    [Fact]
    public void ApplicationType_OmittedForExistingWebApp_PreservesExistingType()
    {
        var source = new JObject { ["MsKey"] = "microi-unity-taoyuan" };
        var existing = new JObject
        {
            ["ApplicationType"] = "Web",
            ["AppType"] = "Web"
        };

        Assert.Equal("Web", V8McpLogic.ResolveMicroServiceSourceApplicationType(source, existing));
    }

    [Fact]
    public void ApplicationType_ExplicitValueWinsAndIsCanonicalized()
    {
        var source = new JObject
        {
            ["MsKey"] = "microi-unity-taoyuan",
            ["ApplicationType"] = "microservice"
        };
        var existing = new JObject { ["ApplicationType"] = "Web" };

        Assert.Equal("MicroService", V8McpLogic.ResolveMicroServiceSourceApplicationType(source, existing));
    }

    [Fact]
    public void ApplicationType_NewAppWithoutValue_DefaultsToMicroService()
    {
        Assert.Equal(
            "MicroService",
            V8McpLogic.ResolveMicroServiceSourceApplicationType(new JObject(), null));
    }

    [Fact]
    public void ApplicationType_InvalidExplicitValue_RemainsRejectableByCaller()
    {
        var source = new JObject { ["ApplicationType"] = "Platform" };

        Assert.Equal("Platform", V8McpLogic.ResolveMicroServiceSourceApplicationType(source, null));
    }
}
