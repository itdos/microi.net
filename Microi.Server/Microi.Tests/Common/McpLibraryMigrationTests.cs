using System.Reflection;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Microi.Tests.Common;

public sealed class McpLibraryMigrationTests
{
    [Fact]
    public void RuntimeAndProtocolTypesBelongToMcpWhileControllerStaysInApi()
    {
        foreach (var type in new[] { typeof(V8McpLogic), typeof(V8McpService), typeof(V8McpDebugSession),
                     typeof(V8McpEndpointService), typeof(V8McpAuthorizationFilter), typeof(V8McpRequiredBodyAttribute),
                     typeof(V8DebugWebSocketMiddleware), typeof(ApplicationAssetAliasReconciliationWorkerService) })
            Assert.Equal("Microi.MCP", type.Assembly.GetName().Name);
        Assert.Equal("Microi.net.Api", typeof(V8EngineController).Assembly.GetName().Name);
        Assert.DoesNotContain(typeof(MicroiEngine).Assembly.GetReferencedAssemblies(), a => a.Name == "Microi.MCP");
        Assert.DoesNotContain(typeof(V8McpLogic).Assembly.GetTypes(), t => typeof(ControllerBase).IsAssignableFrom(t));
    }

    [Fact]
    public void EveryHttpActionHasAnIdenticalServiceSignature()
    {
        var actions = typeof(V8EngineController).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any()).ToArray();
        Assert.Equal(115, actions.Length);
        foreach (var action in actions)
        {
            var implementation = typeof(V8McpEndpointService).GetMethod(action.Name);
            Assert.NotNull(implementation);
            Assert.Equal(action.ReturnType, implementation.ReturnType);
            Assert.Equal(action.GetParameters().Select(p => (p.Name, p.ParameterType, p.HasDefaultValue, p.DefaultValue)),
                implementation.GetParameters().Select(p => (p.Name, p.ParameterType, p.HasDefaultValue, p.DefaultValue)));
        }
    }

    [Fact]
    public void RegisteringMcpTwiceKeepsExactlyOneRecoveryWorker()
    {
        var services = new ServiceCollection();
        services.AddMicroiMcp().AddMicroiMcp();
        var workers = services.Where(d => d.ServiceType == typeof(IHostedService)
            && d.ImplementationType == typeof(ApplicationAssetAliasReconciliationWorkerService));
        Assert.Single(workers);
    }
}
