using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class ApiEngineSocketProtocolTests
{
    [Fact]
    public async Task Binding_is_async_scoped_exact_and_cannot_be_forged_by_an_http_request()
    {
        Assert.False(ApiEngineSocketRuntime.IsTransportAllowed("tenant", "engine", "SignalR"));
        Assert.True(ApiEngineSocketRuntime.IsTransportAllowed("tenant", "engine", "JSON"));
        using (ApiEngineSocketRuntime.Enter("tenant", "engine"))
        {
            await Task.Yield();
            Assert.True(ApiEngineSocketRuntime.IsTransportAllowed("tenant", "engine", "SignalR"));
            Assert.False(ApiEngineSocketRuntime.IsTransportAllowed("other", "engine", "SignalR"));
            Assert.False(ApiEngineSocketRuntime.IsTransportAllowed("tenant", "other", "SignalR"));
            Assert.False(ApiEngineSocketRuntime.IsTransportAllowed("tenant", "engine", "JSON"));
            // 普通嵌套接口调用保持原有传输行为。
            Assert.True(ApiEngineSocketRuntime.IsTransportAllowed("tenant", "child", "JSON"));
        }
        Assert.False(ApiEngineSocketRuntime.IsTransportAllowed("tenant", "engine", "SignalR"));
    }

    [Fact]
    public void Rollback_never_delivers_and_transport_routing_never_leaks_to_caller()
    {
        var failed = JObject.Parse("{Code:0,DataAppend:{SocketMessages:[{ConnectionId:'other',Data:{type:'command'}}]}}");
        Assert.Empty(ApiEngineSocketRuntime.ExtractDeliveries(failed));
        Assert.Null(failed["DataAppend"]?["SocketMessages"]);
        var ok = JObject.Parse("{Code:1,Data:{accepted:true},DataAppend:{SocketMessages:[{ConnectionId:'other',Data:{type:'command'}}]}}");
        var deliveries = ApiEngineSocketRuntime.ExtractDeliveries(ok);
        Assert.Single(deliveries);
        Assert.Equal("other", deliveries[0].ConnectionId);
        Assert.Null(ok["DataAppend"]?["SocketMessages"]);
        Assert.True((bool)ok["Data"]!["accepted"]!);
    }

    [Theory]
    [InlineData("tenant-a", "engine-a")]
    [InlineData("tenant-b", "engine-a")]
    [InlineData("tenant-a", "engine-b")]
    public void Recipient_is_namespaced_by_tenant_and_engine(string tenant, string engine)
    {
        var actual = ApiEngineSocketRuntime.Group(tenant, engine, "same-connection");
        Assert.Equal(actual, ApiEngineSocketRuntime.Group(tenant.ToUpperInvariant(), engine.ToUpperInvariant(), "same-connection"));
        Assert.NotEqual(actual, ApiEngineSocketRuntime.Group(tenant + "-other", engine, "same-connection"));
        Assert.NotEqual(actual, ApiEngineSocketRuntime.Group(tenant, engine + "-other", "same-connection"));
    }

    [Fact]
    public void Malformed_or_oversized_commands_and_deliveries_are_rejected()
    {
        Assert.Throws<ArgumentException>(() => ApiEngineSocketRuntime.ValidateMessage("../escape", new JObject()));
        Assert.Throws<ArgumentException>(() => ApiEngineSocketRuntime.ValidateMessage("valid", new JObject { ["text"] = new string('x', 13000) }));
        var deep = new JObject(); var cursor = deep;
        for (var i = 0; i < 20; i++) { var child = new JObject(); cursor["child"] = child; cursor = child; }
        Assert.Throws<ArgumentException>(() => ApiEngineSocketRuntime.ValidateMessage("valid", deep));
        var result = JObject.Parse("{Code:1,DataAppend:{SocketMessages:[{ConnectionId:'valid',Data:{}},{ConnectionId:'../bad',Data:{}}]}}");
        Assert.Throws<ArgumentException>(() => ApiEngineSocketRuntime.ExtractDeliveries(result));
        Assert.False(ApiEngineSocketRuntime.IsCoordinate("tenant/../../other"));
        Assert.False(ApiEngineSocketRuntime.IsCoordinate("engine\r\nother"));
    }

    [Fact]
    public void Response_projection_excludes_diagnostics_and_bounds_public_data()
    {
        var failed = JObject.Parse("{Code:0,Msg:'private stack',Data:{private:'value'},DataAppend:{DetailMsg:'private stack'}}");
        var projected = ApiEngineSocketRuntime.ProjectResponse(failed);
        Assert.DoesNotContain("private", projected.ToString());
        Assert.Null(projected["DataAppend"]);
        Assert.Throws<ArgumentException>(() => ApiEngineSocketRuntime.ProjectResponse(new JObject
        { ["Code"] = 1, ["Data"] = new string('x', 33000) }));
    }
}
