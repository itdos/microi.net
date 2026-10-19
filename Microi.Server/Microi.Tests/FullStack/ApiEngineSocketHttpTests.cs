using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.FullStack;

/// <summary>实际双节点验证通用实时接口，不依赖任何业务应用源码或配对规则。</summary>
[Collection(BackendReleaseGateCollection.CollectionName)]
[Trait("Category", "FullStack")]
public sealed class ApiEngineSocketHttpTests
{
    [Fact]
    public async Task DuplexSocket_UsesCrossNodeDelivery_RejectsHttpForgery_AndRechecksAnonymousPermission()
    {
        string Required(string key) => Environment.GetEnvironmentVariable(key) ?? throw new InvalidOperationException("缺少 " + key);
        Assert.Equal("YES", Required("MICROI_TEST_ALLOW_WRITES"));
        var tenant = Required("MICROI_TEST_OSCLIENT");
        Assert.StartsWith("StandardSuite", tenant);
        var first = new Uri(Required("MICROI_TEST_API_BASE"));
        var peer = new Uri(Required("MICROI_TEST_PEER_API_BASE"));
        Assert.True(first.IsLoopback && peer.IsLoopback);
        Assert.NotEqual(first, peer);
        using var http = new HttpClient { BaseAddress = first, Timeout = TimeSpan.FromSeconds(30) };
        http.DefaultRequestHeaders.TryAddWithoutValidation("authorization", Required("MICROI_TEST_TOKEN"));
        http.DefaultRequestHeaders.TryAddWithoutValidation("osclient", tenant);
        http.DefaultRequestHeaders.TryAddWithoutValidation("did", Required("MICROI_TEST_DID"));
        var id = Guid.NewGuid().ToString("N");
        var engine = "std_socket_" + id;
        var code = """
            var trusted = V8.Method.RequireApiEngineSocketContext();
            if (!trusted || trusted.Code !== 1) return {Code:0,Msg:'untrusted'};
            if (V8.Param.Socket.Event !== 'Message') return {Code:1};
            var m = V8.Param.Message || {};
            if (m.target) return {Code:1,Data:{accepted:true},DataAppend:{SocketMessages:[{
              ConnectionId:m.target,Data:{kind:'probe',value:String(m.value)}
            }]}};
            return {Code:1,Data:{connection:V8.Param.Socket.ConnectionId,event:V8.Param.Socket.Event}};
            """;
        async Task<JObject> Post(string route, object body, bool success = true)
        {
            using var response = await http.PostAsJsonAsync(route, body,
                new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = null }, TestContext.Current.CancellationToken);
            response.EnsureSuccessStatusCode();
            var result = JObject.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            if (success) Assert.Equal(1, result["Code"]?.Value<int>());
            return result;
        }
        var created = false;
        try
        {
            await Post("api/FormEngine/AddFormData", new { FormEngineKey = "sys_apiengine", OsClient = tenant,
                Id = id, ApiEngineKey = engine, ApiName = "隔离双向实时协议验收", ApiV8Code = code,
                IsEnable = 1, AllowAnonymous = 1, StopHttp = 0, ApiRole = "[]", ResponseType = "SignalR" });
            created = true;
            await using var a = await Wire.Connect(first, tenant, engine);
            await using var b = await Wire.Connect(peer, tenant, engine);
            var identity = await b.Invoke(new JObject());
            Assert.Equal(1, identity["Code"]?.Value<int>());
            Assert.Equal("Message", identity["Data"]?["event"]?.ToString());
            var accepted = await a.Invoke(new JObject { ["target"] = identity["Data"]!["connection"], ["value"] = id });
            Assert.Equal(1, accepted["Code"]?.Value<int>());
            Assert.Null(accepted["DataAppend"]);
            var delivery = await b.Next(frame => frame["type"]?.Value<int>() == 1);
            Assert.Equal("EngineMessage", delivery["target"]?.ToString());
            Assert.Equal(id, delivery["arguments"]?[0]?["value"]?.ToString());
            // 普通 HTTP 即便携带登录身份及仿造 Socket 信封，也不能获取可信实时上下文。
            var forged = await Post("apiengine/" + engine, new {
                Socket = new { Event = "Message", ConnectionId = "forged" }, Message = new { target = "forged" }
            }, false);
            Assert.NotEqual(1, forged["Code"]?.Value<int>());
            // 权限变更必须影响已经连接的匿名会话，而不只是新建连接。
            await Post("api/V8Engine/SetEngineAnonymous", new { ApiEngineKeys = new[] { engine }, AllowAnonymous = 0 });
            Assert.NotEqual(1, (await a.Invoke(new JObject()))["Code"]?.Value<int>());
            Assert.NotEqual(1, (await b.Invoke(new JObject()))["Code"]?.Value<int>());
        }
        finally
        {
            if (created)
            {
                await Post("api/FormEngine/DelFormData", new { FormEngineKey = "sys_apiengine", OsClient = tenant, Id = id });
                var readback = await Post("api/FormEngine/GetFormData", new { FormEngineKey = "sys_apiengine", OsClient = tenant, Id = id }, false);
                Assert.Equal(2, readback["Code"]?.Value<int>());
            }
        }
    }

    // 使用 BCL WebSocket 发送 SignalR JSON 协议，避免为测试引入另一套运行时依赖。
    private sealed class Wire : IAsyncDisposable
    {
        private readonly ClientWebSocket socket = new();
        private readonly Queue<JObject> buffered = new();
        private readonly List<byte> partial = new();
        private int request;
        internal static async Task<Wire> Connect(Uri endpoint, string tenant, string engine)
        {
            var client = new Wire();
            var url = new UriBuilder(endpoint) { Scheme = endpoint.Scheme == "https" ? "wss" : "ws", Path = "/api-engine-socket",
                Query = "OsClient=" + Uri.EscapeDataString(tenant) + "&ApiEngineKey=" + Uri.EscapeDataString(engine) };
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(15));
                await client.socket.ConnectAsync(url.Uri, timeout.Token);
                await client.Send(new JObject { ["protocol"] = "json", ["version"] = 1 });
                var handshake = await client.Next(_ => true);
                Assert.Null(handshake["error"]);
                return client;
            }
            catch { await client.DisposeAsync(); throw; }
        }
        private async Task Send(JObject frame)
        {
            var bytes = Encoding.UTF8.GetBytes(frame.ToString(Newtonsoft.Json.Formatting.None) + "\u001e");
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            await socket.SendAsync(bytes.AsMemory(), WebSocketMessageType.Text, true, timeout.Token);
        }
        internal async Task<JObject> Invoke(JObject message)
        {
            var invocation = (++request).ToString();
            await Send(new JObject { ["type"] = 1, ["invocationId"] = invocation, ["target"] = "Invoke",
                ["arguments"] = new JArray(Guid.NewGuid().ToString("N"), message) });
            var completed = await Next(frame => frame["type"]?.Value<int>() == 3 && frame["invocationId"]?.ToString() == invocation);
            Assert.Null(completed["error"]);
            return Assert.IsType<JObject>(completed["result"]);
        }
        internal async Task<JObject> Next(Func<JObject, bool> predicate)
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(15));
            var bytes = new byte[8192];
            while (true)
            {
                while (buffered.TryDequeue(out var frame))
                {
                    Assert.NotEqual(7, frame["type"]?.Value<int>());
                    if (predicate(frame)) return frame;
                }
                var received = await socket.ReceiveAsync(bytes.AsMemory(), timeout.Token);
                Assert.NotEqual(WebSocketMessageType.Close, received.MessageType);
                for (var i = 0; i < received.Count; i++)
                {
                    if (bytes[i] == 0x1e) { buffered.Enqueue(JObject.Parse(Encoding.UTF8.GetString(partial.ToArray()))); partial.Clear(); }
                    else partial.Add(bytes[i]);
                }
                Assert.True(partial.Count < 65536);
            }
        }
        public async ValueTask DisposeAsync()
        {
            try
            {
                if (socket.State == WebSocketState.Open)
                {
                    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
                    await socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "test-complete", timeout.Token);
                }
            }
            finally { socket.Dispose(); }
        }
    }
}
