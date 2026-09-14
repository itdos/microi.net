using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class ApiEngineScriptParametersTests
{
    [Fact]
    public void BusinessParametersRemainIndependentWhileHostIdentityStaysOutsideParam()
    {
        var identity = new JObject { ["Id"] = "trusted", ["_Roles"] = new JArray("reader") };
        var business = new JObject { ["_CurrentUser"] = "nested business value", ["Price"] = 1.25m };
        var source = new JObject { ["_CurrentUser"] = identity, ["_currentuser"] = "untrusted alias",
            ["_McpDebugExecute"] = true, ["_McpDebugV8Code"] = "private",
            ["Form"] = business, ["Null"] = null, ["OsClient"] = "tenant-a", ["_InvokeType"] = "Server" };
        var result = ApiEngineScriptParameters.Copy(source);
        Assert.Null(result["_CurrentUser"]); Assert.Null(result["_currentuser"]);
        Assert.Null(result["_McpDebugExecute"]); Assert.Null(result["_McpDebugV8Code"]);
        Assert.Equal("nested business value", result["Form"]!["_CurrentUser"]);
        Assert.Equal("tenant-a", result["OsClient"]); Assert.Equal("Server", result["_InvokeType"]);
        Assert.Equal(JTokenType.Null, result["Null"]!.Type);
        result["Form"]!["Price"] = 99;
        Assert.Equal(1.25m, business["Price"]!.Value<decimal>());
        Assert.Same(identity, source["_CurrentUser"]);
        Assert.Equal("reader", identity["_Roles"]![0]);
    }

    [Fact]
    public void ScriptParameterAllocationDoesNotGrowWithAdministratorPermissions()
    {
        var permissions = new JArray(Enumerable.Range(0, 7403).Select(i => new JObject
        { ["Id"] = i, ["FkId"] = "menu-" + i, ["Permission"] = "View,Add,Update" }));
        var source = new JObject { ["_CurrentUser"] = new JObject { ["_RoleLimits"] = permissions }, ["Action"] = "Get" };
        _ = ApiEngineScriptParameters.Copy(source);
        var before = GC.GetAllocatedBytesForCurrentThread();
        var result = ApiEngineScriptParameters.Copy(source);
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        Assert.True(allocated < 64 * 1024, $"Business argument copy allocated {allocated:N0} bytes.");
        Assert.Equal("Get", result["Action"]); Assert.Equal(7403, permissions.Count);
        Assert.Empty(ApiEngineScriptParameters.Copy(null!));
    }
}
