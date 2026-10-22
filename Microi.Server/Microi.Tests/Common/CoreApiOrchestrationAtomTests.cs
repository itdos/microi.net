using Dos.Common;
using Jint;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class CoreApiOrchestrationAtomTests
{
    [Fact]
    public void PublicProjectionIsBoundToEngineAndDoesNotMutateInput()
    {
        var method = new V8Method();
        var input = new JObject { ["SysTitle"] = "Test", ["ServerPrivateSettings"] = new JObject {
            ["Password"] = "not-public" }, ["OsClientDbConn"] = "Password=not-public" };
        using (V8TenantContext.Enter("tenant-a", "other-engine"))
            Assert.Equal(0, method.ProjectPublicSysConfig(input).Code);
        using (V8TenantContext.Enter("tenant-a", "platform-sys-config"))
        {
            var result = method.ProjectPublicSysConfig(input);
            Assert.Equal(1, result.Code);
            var projected = JObject.FromObject(result.Data);
            Assert.Equal("Test", projected["SysTitle"]?.ToString());
            Assert.DoesNotContain("not-public", projected.ToString());
            Assert.NotNull(input["ServerPrivateSettings"]);
        }
    }

    [Fact]
    public void LicenseAtomsRejectWrongEngineAndCrossTenantIdentityBeforeDataAccess()
    {
        var method = new V8Method();
        using (V8TenantContext.Enter("tenant-a", "other-engine"))
        {
            Assert.Equal(0, method.ReadLicenseVerification().Code);
            Assert.Equal(0, method.ReadLicenseSubject().Code);
            Assert.Equal(0, method.ReadAiLicenseVerification().Code);
            Assert.Equal(0, method.ReadLicenseServerNodes().Code);
            Assert.Equal(0, method.ReadLicenseAccessScope().Code);
        }
        using (V8TenantContext.Enter("tenant-a", "platform-license-management-state"))
        using (V8TrustedExecutionContext.EnterForTenant(new JObject { ["Id"] = "user", ["Level"] = 9999 }, "tenant-b"))
        {
            Assert.Equal(0, method.ReadLicenseVerification().Code);
            Assert.Equal(0, method.ReadLicenseSubject().Code);
            Assert.Equal(0, method.ReadLicenseAccessScope().Code);
        }
    }

    [Fact]
    public async Task PublicConfigRunsInActualJintWithClrAtoms()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && !Directory.Exists(Path.Combine(directory.FullName, "Microi.Server", "OfficialApplications")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        var source = File.ReadAllText(Path.Combine(directory!.FullName, "Microi.Server", "OfficialApplications", "Resource", "platform-sys-config.js"));
        using var context = V8TenantContext.Enter("tenant-a", "platform-sys-config");
        using var engine = new V8Engine().CreateEngine();
        engine.SetValue("hostMethod", new V8Method());
        engine.Execute("var V8={OsClient:'tenant-a',Param:{},Method:hostMethod,FormEngine:{GetSysConfig:async function(){return {Code:1,Data:{SysTitle:'Jint',ServerPrivateSettings:{Password:'not-public'}}};}}};");
        var result = await engine.EvaluateAsync("(async function(){" + source + "})()", cancellationToken: TestContext.Current.CancellationToken);
        engine.SetValue("output", result);
        var json = engine.Evaluate("JSON.stringify(output)").AsString();
        Assert.Equal(1, JObject.Parse(json).Value<int>("Code"));
        Assert.Equal("Jint", JObject.Parse(json)["Data"]?["SysTitle"]?.ToString());
        Assert.DoesNotContain("not-public", json);
    }
}
