using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Mvc.Controllers;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class ApiEngineRoleAuthorizationTests
{
    private const string PersonalRoleId = "f41e38ff-8470-4689-a440-4f162bcfed84";

    [Fact]
    public void OnlyGetRole_RequiresAnExplicitApiEngineRole()
    {
        var user = NewUser(PersonalRoleId, onlyGet: true);

        var blankPolicy = ApiEngineRoleAuthorization.Evaluate(user, "");
        var emptyPolicy = ApiEngineRoleAuthorization.Evaluate(user, "[]");

        Assert.False(blankPolicy.IsAllowed);
        Assert.False(emptyPolicy.IsAllowed);
        Assert.True(emptyPolicy.HasOnlyGet);
        Assert.False(emptyPolicy.HasExplicitRoles);
        Assert.False(emptyPolicy.HasMalformedPolicy);
    }

    [Fact]
    public void OnlyGetRole_CanRunAnExplicitlyAuthorizedApiEngine()
    {
        var user = NewUser(PersonalRoleId, onlyGet: true);
        var policy = new JArray(new JObject
        {
            ["Id"] = PersonalRoleId,
            ["Name"] = "个人版角色"
        }).ToString();

        var result = ApiEngineRoleAuthorization.Evaluate(user, policy);

        Assert.True(result.IsAllowed);
        Assert.True(result.HasOnlyGet);
        Assert.True(result.HasExplicitRoles);
    }

    [Fact]
    public void ExplicitRole_UsesExactIdsInsteadOfSubstringMatches()
    {
        var user = NewUser(PersonalRoleId, onlyGet: true);
        var policy = new JArray(PersonalRoleId + "-other").ToString();

        var result = ApiEngineRoleAuthorization.Evaluate(user, policy);

        Assert.False(result.IsAllowed);
        Assert.True(result.HasExplicitRoles);
    }

    [Fact]
    public void NormalRole_PreservesEmptyPolicyCompatibility()
    {
        var user = NewUser("ordinary-role", onlyGet: false);

        var result = ApiEngineRoleAuthorization.Evaluate(user, "[]");

        Assert.True(result.IsAllowed);
        Assert.False(result.HasOnlyGet);
        Assert.False(result.HasExplicitRoles);
    }

    [Fact]
    public void PlatformAdministrator_BypassesStaleApiRoleIds()
    {
        var user = NewUser("current-admin-role", onlyGet: false);
        user["Level"] = DiyCommon.MaxRoleLevel;

        var result = ApiEngineRoleAuthorization.Evaluate(
            user,
            new JArray("retired-admin-role").ToString());

        Assert.True(result.IsAllowed);
    }

    [Fact]
    public void MalformedRolePolicies_FailClosed()
    {
        var user = NewUser(PersonalRoleId, onlyGet: true);

        var malformedApiRole = ApiEngineRoleAuthorization.Evaluate(user, "not-json");
        user["_Roles"][0]["BaseLimit"] = "not-json";
        var malformedBaseLimit = ApiEngineRoleAuthorization.Evaluate(user, "[]");

        Assert.False(malformedApiRole.IsAllowed);
        Assert.True(malformedApiRole.HasMalformedPolicy);
        Assert.False(malformedBaseLimit.IsAllowed);
        Assert.True(malformedBaseLimit.HasMalformedPolicy);
    }

    [Theory]
    [InlineData("ApiEngine", "Run", true)]
    [InlineData("ApiEngine", "Run_FormData", true)]
    [InlineData("ApiEngine", "Run_Request_Get", true)]
    [InlineData("ApiEngine", "Run_Response_File", true)]
    [InlineData("ApiEngine", "Run_Response_Html", true)]
    [InlineData("BackgroundTask", "RunApiEngine", true)]
    [InlineData("BackgroundTask", "Cancel", false)]
    [InlineData("FormEngine", "UptFormData", false)]
    [InlineData("ApiEngine", "StopHttp", false)]
    public void OnlyGetDeferral_IsLimitedToGuardedExecutionActions(
        string controller,
        string action,
        bool expected)
    {
        var descriptor = new ControllerActionDescriptor
        {
            ControllerName = controller,
            ActionName = action
        };

        Assert.Equal(
            expected,
            DiyFilter<dynamic>.DefersOnlyGetToApiEngineRoleAuthorization(descriptor));
    }

    [Theory]
    [InlineData("SysUser", "RefreshLoginUser", true)]
    [InlineData("Ai", "RelayTokenSummary", true)]
    [InlineData("BackgroundTask", "List", true)]
    [InlineData("BackgroundTask", "RunApiEngine", true)]
    [InlineData("BackgroundTask", "ClearCompleted", false)]
    [InlineData("BackgroundTask", "Remove", false)]
    [InlineData("SysUser", "UptSysUser", false)]
    [InlineData("Ai", "UpdateModel", false)]
    public void OnlyGetActionAllowlist_IsExact(
        string controller,
        string action,
        bool expected)
    {
        var descriptor = new ControllerActionDescriptor
        {
            ControllerName = controller,
            ActionName = action
        };

        Assert.Equal(
            expected,
            DiyFilter<dynamic>.AllowsOnlyGetAction(descriptor));
    }

    private static JObject NewUser(string roleId, bool onlyGet)
    {
        return new JObject
        {
            ["Id"] = "user-1",
            ["RoleIds"] = new JArray(new JObject
            {
                ["Id"] = roleId,
                ["Name"] = "role"
            }),
            ["_Roles"] = new JArray(new JObject
            {
                ["Id"] = roleId,
                ["Name"] = "role",
                ["BaseLimit"] = onlyGet
                    ? new JArray("OnlyGet").ToString()
                    : new JArray().ToString()
            })
        };
    }
}
