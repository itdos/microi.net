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

    [Fact]
    public void Category_OmittedForExistingApp_PreservesExistingValue()
    {
        var existing = new JObject { ["Category"] = "game" };

        Assert.Equal("game", V8McpLogic.ResolveMicroServiceSourceCategory(new JObject(), existing));
    }

    [Fact]
    public void Category_ExplicitValueOverridesExistingValue()
    {
        var source = new JObject { ["Category"] = "education" };
        var existing = new JObject { ["Category"] = "game" };

        Assert.Equal("education", V8McpLogic.ResolveMicroServiceSourceCategory(source, existing));
    }

    [Fact]
    public void Category_NewAppWithoutValue_DefaultsToTools()
    {
        Assert.Equal("tools", V8McpLogic.ResolveMicroServiceSourceCategory(new JObject(), null));
    }

    [Fact]
    public void PublicPublishPath_ExistingApp_IsNeverChangedBySourceSync()
    {
        var existing = new JObject
        {
            ["PublicPublishPath"] = "micro-app/v3/tenants/itdos/kinds/runtime/apps/demo/assets/"
        };

        Assert.Null(V8McpLogic.ResolveNewMicroServiceSourcePublicPublishPath(existing, "Web", "demo"));
    }

    [Theory]
    [InlineData("MicroService", "micro-app/demo/")]
    [InlineData("Web", "ai-app-publish/demo/")]
    [InlineData("UniApp", "ai-app-publish/demo/")]
    public void PublicPublishPath_NewApp_UsesApplicationTypeDefault(string applicationType, string expected)
    {
        Assert.Equal(
            expected,
            V8McpLogic.ResolveNewMicroServiceSourcePublicPublishPath(null, applicationType, "demo"));
    }
}
