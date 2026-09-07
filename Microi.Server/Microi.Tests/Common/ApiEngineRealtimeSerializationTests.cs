using System.Buffers;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Protocol;
using Microsoft.Extensions.DependencyInjection;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class ApiEngineRealtimeSerializationTests
{
    [Theory]
    [InlineData("json")]
    [InlineData("messagepack")]
    public void Public_event_serializes_with_every_registered_backplane_protocol(string protocolName)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        // Resolve serializers only: no Hub context, Redis socket or remote mutation is created.
        services.AddMicroiRealtimeTransport("localhost:1,abortConnect=false", false);
        using var provider = services.BuildServiceProvider();
        var protocols = provider.GetServices<IHubProtocol>().Where(item => item.Name == protocolName).ToArray();
        Assert.NotEmpty(protocols);
        var original = new ApiEngineRealtimeEvent
        {
            EventId = "qa-serialization-1", ChannelKey = "xqc_room", SubjectId = "room-1",
            Version = 2, EventType = "Ready", OccurredAt = "2026-09-07T02:00:00Z",
            Data = JObject.Parse("""{"AppKey":"xiangqi-3d-cocos-arena","Ready":true,"List":[1,null,{"Name":"棋友"}]}""")
        };
        var projected = ApiEngineRealtimeRuntime.CreateTransportPayload(original);
        foreach (var protocol in protocols)
        {
            var buffer = new ArrayBufferWriter<byte>();
            protocol.WriteMessage(new InvocationMessage("RealtimeEvent", new object[] { projected }), buffer);
            Assert.True(buffer.WrittenCount > 0);
            var input = new ReadOnlySequence<byte>(buffer.WrittenMemory);
            Assert.True(protocol.TryParseMessage(ref input, new PublicPayloadBinder(), out var parsed));
            var invocation = Assert.IsType<InvocationMessage>(parsed);
            Assert.Equal("RealtimeEvent", invocation.Target);
            var parsedArgument = Assert.Single(invocation.Arguments);
            // System.Text.Json keeps object-valued properties as JsonElement; Newtonsoft keeps JToken.
            // Compare their actual JSON wire values, not reflection over the other serializer's DOM type.
            var roundTripJson = protocol.GetType().Name == "JsonHubProtocol"
                ? System.Text.Json.JsonSerializer.Serialize(parsedArgument)
                : Newtonsoft.Json.JsonConvert.SerializeObject(parsedArgument);
            Assert.True(JToken.DeepEquals(JToken.Parse(Newtonsoft.Json.JsonConvert.SerializeObject(projected)),
                JToken.Parse(roundTripJson)), protocol.GetType().Name + ": " + roundTripJson);
            var completion = ApiEngineRealtimeRuntime.CreateSubscriptionTransportPayload(new ApiEngineRealtimeSubscriptionResult
            {
                ChannelKey = original.ChannelKey, SubjectId = original.SubjectId, Version = 2, Latest = original,
                LeaseExpiresAt = "2026-09-07T02:01:00Z"
            });
            protocol.WriteMessage(CompletionMessage.WithResult("subscription-1", completion), buffer);
            Assert.True(buffer.WrittenCount > 0);
        }
        Assert.True(JToken.DeepEquals(JToken.FromObject(original), JToken.FromObject(projected)));
        var projectedData = Assert.IsType<Dictionary<string, object>>(projected["Data"]);
        projectedData["AppKey"] = "changed-copy";
        Assert.Equal("xiangqi-3d-cocos-arena", original.Data["AppKey"]?.Value<string>());
    }

    private sealed class PublicPayloadBinder : IInvocationBinder
    {
        public IReadOnlyList<Type> GetParameterTypes(string methodName) => new[] { typeof(Dictionary<string, object>) };
        public Type GetReturnType(string invocationId) => typeof(Dictionary<string, object>);
        public Type GetStreamItemType(string streamId) => typeof(object);
    }
}
