using System.Reflection;
using Microi.net.Api;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class V8McpAuthorizationTests
{
    [Fact]
    public void EveryV8McpActionDeclaresOneCapabilityAndControllerIsFailClosed()
    {
        var controllerType = typeof(V8EngineController);
        Assert.NotNull(controllerType.GetCustomAttribute<V8McpAuthorizationAttribute>(true));

        var actions = controllerType
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Where(method => method.GetCustomAttributes<HttpMethodAttribute>(true).Any())
            .ToArray();

        Assert.Equal(104, actions.Length);
        foreach (var action in actions)
        {
            var declarations = action.GetCustomAttributes<V8McpCapabilityAttribute>(true).ToArray();
            Assert.Single(declarations);
        }
    }

    [Fact]
    public void SensitiveOperationsRequireAdminScope()
    {
        var adminActions = new[]
        {
            nameof(V8EngineController.TransitionApplicationStreamGate),
            nameof(V8EngineController.ExecuteExternalDatabaseSql),
            nameof(V8EngineController.SaveDatabaseConnection),
            nameof(V8EngineController.GetPlaywrightContext),
            nameof(V8EngineController.SetRolePermission),
            nameof(V8EngineController.SetEngineAnonymous),
        };

        foreach (var actionName in adminActions)
        {
            var method = typeof(V8EngineController).GetMethod(actionName);
            var declaration = method?.GetCustomAttribute<V8McpCapabilityAttribute>(true);
            Assert.NotNull(declaration);
            Assert.Equal(V8McpScope.Admin, declaration.Scope);
        }
    }

    [Fact]
    public void AccessKeyCapabilityScopesAreLeastPrivilege()
    {
        var method = typeof(V8McpAuthorizationFilter).GetMethod(
            "HasCapability",
            BindingFlags.Static | BindingFlags.NonPublic);
        Assert.NotNull(method);

        var readOnly = new JObject
        {
            ["_AccessKeySession"] = true,
            ["_AccessKeyScopes"] = new JArray("mcp:read")
        };
        Assert.True(Invoke(method, readOnly, V8McpScope.Read));
        Assert.False(Invoke(method, readOnly, V8McpScope.Write));
        Assert.False(Invoke(method, readOnly, V8McpScope.Execute));
        Assert.False(Invoke(method, readOnly, V8McpScope.Admin));

        var administratorKey = new JObject
        {
            ["_AccessKeySession"] = true,
            ["_AccessKeyScopes"] = new JArray("mcp:admin")
        };
        foreach (var scope in Enum.GetValues<V8McpScope>())
        {
            Assert.True(Invoke(method, administratorKey, scope));
        }
    }

    private static bool Invoke(MethodInfo method, JObject user, V8McpScope scope)
    {
        return (bool)(method.Invoke(null, new object[] { user, scope }) ?? false);
    }
}

