using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class DataSourceEngineAuthorizationTests
{
    private static readonly JObject OrdinaryUser = new()
    {
        ["Level"] = 1,
        ["RoleIds"] = "[\"customer-role\"]"
    };

    [Fact]
    public void AnonymousCaller_RequiresAllowAnonymous()
    {
        Assert.False(DataSourceEngine.IsClientExecutionAuthorized(null, "[]", false));
        Assert.True(DataSourceEngine.IsClientExecutionAuthorized(null, "[]", true));
    }

    [Fact]
    public void AuthenticatedCaller_KeepsLegacyEmptyRolePolicy()
    {
        Assert.True(DataSourceEngine.IsClientExecutionAuthorized(OrdinaryUser, null, false));
        Assert.True(DataSourceEngine.IsClientExecutionAuthorized(OrdinaryUser, "", false));
        Assert.True(DataSourceEngine.IsClientExecutionAuthorized(OrdinaryUser, "[]", false));
    }

    [Fact]
    public void ExplicitRolePolicy_RequiresExactRoleIdMatch()
    {
        Assert.True(DataSourceEngine.IsClientExecutionAuthorized(
            OrdinaryUser,
            "[\"customer-role\"]",
            false));
        Assert.False(DataSourceEngine.IsClientExecutionAuthorized(
            OrdinaryUser,
            "[\"customer-role-other\"]",
            false));
    }

    [Fact]
    public void ExplicitRolePolicy_SupportsObjectRoleLists()
    {
        var objectRoleUser = new JObject
        {
            ["Level"] = 1,
            ["RoleIds"] = "[{\"Id\":\"customer-role\",\"Name\":\"客户角色\"}]"
        };

        Assert.True(DataSourceEngine.IsClientExecutionAuthorized(
            objectRoleUser,
            "[{\"Id\":\"customer-role\",\"Name\":\"客户角色\"}]",
            false));
    }

    [Fact]
    public void MalformedNonEmptyRolePolicy_FailsClosed()
    {
        Assert.False(DataSourceEngine.IsClientExecutionAuthorized(
            OrdinaryUser,
            "not-json",
            false));
    }

    [Fact]
    public void PlatformAdministrator_BypassesRolePolicy()
    {
        var administrator = new JObject
        {
            ["Level"] = DiyCommon.MaxRoleLevel,
            ["RoleIds"] = "[]"
        };

        Assert.True(DataSourceEngine.IsClientExecutionAuthorized(
            administrator,
            "[\"other-role\"]",
            false));
    }
}
