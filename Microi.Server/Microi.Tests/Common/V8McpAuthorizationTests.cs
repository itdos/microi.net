using System.Reflection;
using Dos.Common;
using Microi.net.Api;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
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
        Assert.NotNull(controllerType.GetCustomAttribute<V8McpRequiredBodyAttribute>(true));

        var actions = controllerType
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Where(method => method.GetCustomAttributes<HttpMethodAttribute>(true).Any())
            .ToArray();

        Assert.Equal(115, actions.Length);
        foreach (var action in actions)
        {
            var declarations = action.GetCustomAttributes<V8McpCapabilityAttribute>(true).ToArray();
            Assert.Single(declarations);
        }
    }

    [Fact]
    public void EveryRequiredJObjectBodyIsRejectedBeforeTheActionCanDereferenceIt()
    {
        var controllerType = typeof(V8EngineController);
        var requiredBodyActions = controllerType
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Where(method => method.GetCustomAttributes<HttpMethodAttribute>(true).Any())
            .Where(method => method.GetParameters().Any(parameter =>
                !parameter.HasDefaultValue
                && typeof(JObject).IsAssignableFrom(parameter.ParameterType)
                && parameter.GetCustomAttribute<FromBodyAttribute>(true) != null))
            .ToArray();
        Assert.NotEmpty(requiredBodyActions);

        var filter = new V8McpRequiredBodyAttribute();
        foreach (var method in requiredBodyActions)
        {
            var actionContext = new ActionContext(
                new DefaultHttpContext(),
                new RouteData(),
                new ControllerActionDescriptor { MethodInfo = method });
            var context = new ActionExecutingContext(
                actionContext,
                new List<IFilterMetadata>(),
                new Dictionary<string, object?>(),
                new V8EngineController());

            filter.OnActionExecuting(context);

            var result = Assert.IsType<OkObjectResult>(context.Result);
            var body = Assert.IsType<DosResult>(result.Value);
            Assert.Equal(0, body.Code);
            Assert.Equal("请求参数不能为空", body.Msg);
        }
    }

    [Fact]
    public void OptionalCompatibilityBodyRemainsOptional()
    {
        var method = typeof(V8EngineController).GetMethod(nameof(V8EngineController.GetApiEngineList));
        Assert.NotNull(method);
        var actionContext = new ActionContext(
            new DefaultHttpContext(),
            new RouteData(),
            new ControllerActionDescriptor { MethodInfo = method });
        var context = new ActionExecutingContext(
            actionContext,
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            new V8EngineController());

        new V8McpRequiredBodyAttribute().OnActionExecuting(context);

        Assert.Null(context.Result);
    }

    [Fact]
    public void MandatoryFormEngineBodiesAreRejectedBeforeTheirActionsRun()
    {
        var actionNames = new[]
        {
            nameof(FormEngineController.UptFormDataBatch),
            nameof(FormEngineController.UptTableData),
            nameof(FormEngineController.AddFormDataBatch),
            nameof(FormEngineController.AddTableData),
            nameof(FormEngineController.DelFormDataBatch),
            nameof(FormEngineController.DelTableData),
            nameof(FormEngineController.GetTableDataAnonymous),
            nameof(FormEngineController.GetTableDataTreeAnonymous),
            nameof(FormEngineController.GetDiyFieldSqlDataFromBody),
            nameof(FormEngineController.GetFieldsDataFromBody),
            nameof(FormEngineController.ExportDiyTableRowFromBody),
            nameof(FormEngineController.UptDiyFieldListFromBody),
        };

        var filter = new RequiredDosBodyAttribute();
        foreach (var actionName in actionNames)
        {
            var method = typeof(FormEngineController).GetMethod(actionName);
            Assert.NotNull(method);
            Assert.NotNull(method.GetCustomAttribute<RequiredDosBodyAttribute>(true));

            var actionContext = new ActionContext(
                new DefaultHttpContext(),
                new RouteData(),
                new ControllerActionDescriptor { MethodInfo = method });
            var context = new ActionExecutingContext(
                actionContext,
                new List<IFilterMetadata>(),
                new Dictionary<string, object?>(),
                new FormEngineController());

            filter.OnActionExecuting(context);

            var result = Assert.IsType<OkObjectResult>(context.Result);
            var body = Assert.IsType<DosResult>(result.Value);
            Assert.Equal(0, body.Code);
            Assert.Equal("请求参数不能为空", body.Msg);
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
            nameof(V8EngineController.GetAdministrativeCapabilities),
            nameof(V8EngineController.AdministerTableData),
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
