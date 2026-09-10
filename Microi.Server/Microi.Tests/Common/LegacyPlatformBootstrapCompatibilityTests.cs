using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public sealed class LegacyPlatformBootstrapCompatibilityTests
{
    [Theory]
    [InlineData("/api/SysUser/Login", "Logout", "Login")]
    [InlineData("/API/SYSUSER/REFRESHTOKEN", "Login", "RefreshToken")]
    [InlineData("/apiengine/platform-sys-user-session", "login", "Login")]
    [InlineData("/apiengine/platform-sys-menu", "getsysmenustep", "GetSysMenuStep")]
    [InlineData("/api/os/getDateTimeNow", "GetHID", "GetDateTimeNow")]
    [InlineData("/api/SysLog/addSysLog", "UserLogin", "AddSysLog")]
    [InlineData("/apiengine/platform-os-legacy-compatibility", "getdatetimenow", "GetDateTimeNow")]
    [InlineData("/apiengine/platform-client-log", "", "AddSysLog")]
    [InlineData("/api/SysDept/GetSysDeptStep", "", "GetSysDeptStep")]
    [InlineData("/API/SYSDEPT/GETSYSDEPTSTEP", "DelSysDept", "GetSysDeptStep")]
    public void RoutesPinLegacyActionsAndNormalizeCanonicalActions(string path, string input, string expected)
        => Assert.Equal(expected, LegacyMobileCompatibilityController.ResolveRoute(path, input)?.Action);

    [Theory]
    [InlineData("/api/SysUser/GetSysUserPassword", "")]
    [InlineData("/api/SysUser/AddSysUser", "")]
    [InlineData("/api/HDFS/GetPrivateFileUrl", "")]
    [InlineData("/api/DataSourceEngine/Run", "")]
    [InlineData("/apiengine/platform-sys-menu", "DelSysMenu")]
    [InlineData("/apiengine/platform-sys-user-session", "SetPassword")]
    [InlineData("/LegacyMobileCompatibility/Run", "Login")]
    [InlineData("/apiengine/platform-os-legacy-compatibility", "GetHID")]
    [InlineData("/api/SysDept/DelSysDept", "")]
    [InlineData("/apiengine/platform-sys-dept", "DelSysDept")]
    public void RecoveryCannotBecomeAGenericBusinessOrCredentialGateway(string path, string action)
        => Assert.Null(LegacyMobileCompatibilityController.ResolveRoute(path, action));

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public void AddressThenAliasThenFixedKeyHasPriorityIncludingDisabledResources(int stage)
    {
        var calls = new List<int>();
        var model = new JObject { ["ApiEngineKey"] = "configured-key", ["IsEnable"] = 0, ["StopHttp"] = 1 };
        DosResult<dynamic> Read(int index)
        {
            calls.Add(index);
            return new DosResult<dynamic>(1, index == stage ? model : null);
        }
        var result = LegacyMobileCompatibilityController.ResolveConfiguredEngine("/api/SysUser/Login",
            "platform-sys-user-session", _ => Read(0), _ => Read(1), _ => Read(2));
        Assert.Same(model, (object)result.Data);
        Assert.Equal(Enumerable.Range(0, stage + 1), calls);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public void FailedAuthoritativeReadNeverProvesAnEngineMissing(int failureStage)
    {
        var calls = 0;
        DosResult<dynamic> Read() => calls++ == failureStage
            ? new DosResult<dynamic>(0, null, "read failed") : new DosResult<dynamic>(1, null);
        var result = LegacyMobileCompatibilityController.ResolveConfiguredEngine("/api/SysUser/Login",
            "platform-sys-user-session", _ => Read(), _ => Read(), _ => Read());
        Assert.Equal(0, result.Code);
        Assert.Equal(failureStage + 1, calls);
    }

    [Fact]
    public void OnlyCompleteAuthoritativeAbsenceEnablesRecovery()
    {
        var calls = 0;
        DosResult<dynamic> Missing() { calls++; return new DosResult<dynamic>(1, null); }
        var result = LegacyMobileCompatibilityController.ResolveConfiguredEngine("/api/SysUser/Login",
            "platform-sys-user-session", _ => Missing(), _ => Missing(), _ => Missing());
        Assert.Equal(1, result.Code);
        Assert.Null((object?)result.Data);
        Assert.Equal(3, calls);
    }

    [Fact]
    public void DisabledOrAmbiguousTemplatesCannotFallThroughToCompiledLogin()
    {
        var disabled = new JObject { ["ApiEngineKey"] = "configured-template",
            ["ApiAddress"] = "/api/SysUser/{Action}", ["IsEnable"] = 0 };
        var match = LegacyMobileCompatibilityController.ResolveConfiguredTemplate(
            "/api/SysUser/Login", "tenant-a", new object[] { disabled });
        Assert.Same(disabled, (object)match.Data);
        var ambiguous = LegacyMobileCompatibilityController.ResolveConfiguredTemplate(
            "/api/SysUser/Login", "tenant-a", new object[] { disabled, disabled.DeepClone() });
        Assert.Equal(0, ambiguous.Code);
        var result = LegacyMobileCompatibilityController.ResolveConfiguredEngine(
            "/api/SysUser/Login", "platform-sys-user-session",
            _ => new DosResult<dynamic>(1, null), _ => new DosResult<dynamic>(1, null),
            _ => throw new InvalidOperationException("Fixed Key must not override a configured template"), _ => match);
        Assert.Same(disabled, (object)result.Data);
    }

    [Fact]
    public void TenantSuffixAndQueryMustAgree()
    {
        Assert.Throws<ArgumentException>(() => LegacyMobileCompatibilityController.ResolveTenant(
            "/api/SysUser/Login--OsClient--tenant-a--", "tenant-b", new JObject(), "", ""));
        Assert.Equal("tenant-a", LegacyMobileCompatibilityController.ResolveTenant(
            "/api/SysUser/Login--OsClient--tenant-a--", "tenant-a",
            new JObject { ["OsClient"] = "tenant-b" }, "tenant-c", "tenant-d"));
        Assert.Equal("tenant-b", LegacyMobileCompatibilityController.ResolveTenant(
            "/api/SysUser/Login", "", new JObject { ["osclient"] = "tenant-b" }, "", "tenant-d"));
    }

    [Fact]
    public void LegacyMenuReadsSelectNestedAuthorizedRowsAndPreserveParentFiltering()
    {
        var tree = JArray.Parse("""
            [{"Id":"root","ParentId":"","_Child":[
              {"Id":"child","ParentId":"root","Class":"work","_Child":[
                {"Id":"grandchild","ParentId":"child"}]}]}]
            """);
        var found = PlatformBootstrapCompatibilityService.SelectAuthorizedMenus(
            "GetSysMenuModel", "grandchild", null, null, tree);
        Assert.Equal(1, found.Code);
        Assert.Equal("grandchild", ((JObject)found.Data)["Id"]);
        var children = PlatformBootstrapCompatibilityService.SelectAuthorizedMenus(
            "GetSysMenu", null, "root", "work", tree);
        var rows = JArray.FromObject(children.Data);
        Assert.Single(rows);
        Assert.Equal("child", rows[0]["Id"]);
        Assert.Null(rows[0]["_Child"]);
        Assert.Equal(2, PlatformBootstrapCompatibilityService.SelectAuthorizedMenus(
            "GetSysMenuModel", "unauthorized", null, null, tree).Code);
        Assert.NotNull(tree[0]["_Child"]);
    }

    [Fact]
    public void RequestCannotInjectIdentityRoutingOrPasswordBypass()
    {
        var source = JObject.Parse("""
            {"action":"Logout","_currentuser":{"Id":"forged"},"APIENGINEKEY":"evil",
             "ApiAddress":"/evil","_TrustedServerInvocation":true,"_DevBypassPwd":true,
             "osclient":"evil","_AutomationTestLogin":true,"Account":"admin"}
            """);
        var result = LegacyMobileCompatibilityController.PrepareRequest(source, "tenant-a", "Login");
        Assert.Equal("Login", result["Action"]);
        Assert.Equal("tenant-a", result["OsClient"]);
        Assert.False(result["_DevBypassPwd"]!.Value<bool>());
        Assert.True(result["_AutomationTestLogin"]!.Value<bool>());
        foreach (var key in new[] { "ApiEngineKey", "ApiAddress", "_CurrentUser", "_TrustedServerInvocation" })
            Assert.Null(result.GetValue(key, StringComparison.OrdinalIgnoreCase));
        Assert.Equal("Logout", source["action"]);
    }

    [Fact]
    public async Task LegacyClockRetainsAnonymousDosResultAndHistoricalFormat()
    {
        var result = Assert.IsType<DosResult>(await PlatformBootstrapCompatibilityService.ExecuteAsync(
            "GetDateTimeNow", new JObject { ["OsClient"] = "tenant-a" }, null));
        Assert.Equal(1, result.Code);
        var value = Assert.IsType<string>(result.Data);
        Assert.Matches(@"^\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}$", value);
        Assert.True(Math.Abs((DateTime.Now - DateTime.ParseExact(value, "yyyy/MM/dd HH:mm:ss",
            System.Globalization.CultureInfo.InvariantCulture)).TotalSeconds) < 5);
    }

    [Fact]
    public void LegacyLogPinsActorAndTruncatesContentWithoutAddingRoutingAction()
    {
        var input = new JObject { ["title"] = " Test ", ["content"] = new string('x', 21000),
            ["UserId"] = "forged", ["UserName"] = "forged", ["OsClient"] = "other", ["Source"] = "Audit" };
        var prepared = LegacyMobileCompatibilityController.PrepareRequest(input, "tenant-a", "AddSysLog");
        Assert.Null(prepared["Action"]);
        var log = PlatformBootstrapCompatibilityService.BuildLegacyClientLog(prepared, "tenant-a",
            new JObject { ["Id"] = "real-user", ["Name"] = "Real" }, out var error);
        Assert.Null(error);
        Assert.Equal("tenant-a", log.OsClient);
        Assert.Equal("real-user", log.UserId);
        Assert.Equal("Real", log.UserName);
        Assert.Equal("Legacy", log.Category);
        Assert.Equal("ClientLog", log.Action);
        Assert.Equal("LegacyClientEndpoint", log.Source);
        Assert.Equal("Test", log.Title);
        Assert.Equal(20001, log.Content.Length);
        Assert.True(LegacyMobileCompatibilityController.ResolveRoute("/api/SysLog/AddSysLog", "").Authenticated);
    }

    [Theory]
    [InlineData("Action", "Login")]
    [InlineData("category", "Audit")]
    [InlineData("type", "用户登录")]
    [InlineData("Title", "")]
    public void LegacyLogCannotForgeBehaviorEvents(string field, string value)
    {
        var source = new JObject { ["Title"] = "Test", [field] = value };
        var request = LegacyMobileCompatibilityController.PrepareRequest(source, "tenant-a", "AddSysLog");
        var log = PlatformBootstrapCompatibilityService.BuildLegacyClientLog(request, "tenant-a",
            new JObject { ["Id"] = "user" }, out var error);
        Assert.Null(log);
        Assert.False(string.IsNullOrWhiteSpace(error));
    }

    [Fact]
    public async Task AnonymousLogIsRejectedBeforeStorage()
    {
        var result = Assert.IsType<DosResult>(await PlatformBootstrapCompatibilityService.ExecuteAsync(
            "AddSysLog", new JObject { ["OsClient"] = "tenant-a", ["Title"] = "Test" }, null));
        Assert.Equal(1001, result.Code);
    }

    [Fact]
    public async Task DepartmentTreeRequiresIdentityAndPinsTrustedQueryContext()
    {
        var route = LegacyMobileCompatibilityController.ResolveRoute("/api/SysDept/GetSysDeptStep", "");
        Assert.NotNull(route);
        Assert.True(route.Authenticated);
        Assert.Equal("platform-sys-dept", route.EngineKey);
        var anonymous = Assert.IsType<DosResult>(await PlatformBootstrapCompatibilityService.ExecuteAsync(
            "GetSysDeptStep", new JObject { ["OsClient"] = "tenant-a" }, null));
        Assert.Equal(1001, anonymous.Code);
    }
}
