using System.Net;
using System.Net.Sockets;
using Jint;
using Microi.net;
using Microi.net.Api;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

/// <summary>运行真实 Jint/Socket；共享存储替身只用于隔离 Redis 和注入断线/持久化故障。</summary>
public class IoTDownlinkTests
{
    private const string Device = "0199999999999999";
    private static readonly byte[] Heartbeat = Convert.FromHexString("AA3333800012019999999999999900110100FA43FCFF");
    private static readonly byte[] Ack = Convert.FromHexString("BB66668000110199999999999999001100EC8AFCFF");

    private static JObject Configuration() => JObject.Parse("""
        {"osClient":"fixture","apiEngineKey":"fixture-uplink","allowedCidrs":["127.0.0.1/32"],
         "requestHeaderHex":"AA333380","responseHeaderHex":"BB666680","tailHex":"FCFF",
         "lengthOffset":4,"lengthAdjustment":4,"correlationOffset":6,"correlationLength":10,
         "downlink":{"enabled":true,"deviceOffset":6,"deviceLength":8,"sendApiEngineKeys":["fixture-control"],"pollIntervalMilliseconds":100}}
        """);
    private static TcpIngressRule Rule() => TcpIngressRules.Parse(Configuration().ToString())!;

    // 两套匿名夹具协议的字节结构不同；平台层无需识别任何厂商名或操作码。
    private static TcpIngressRule AlternateRule(string mode = "LengthPrefix", string checksum = "Crc16Modbus")
    {
        var config = Configuration();
        config["requestHeaderHex"] = "A1"; config["responseHeaderHex"] = "B2"; config["tailHex"] = "0D0A";
        config["lengthOffset"] = 1; config["lengthAdjustment"] = 0;
        config["correlationOffset"] = 3; config["correlationLength"] = 2;
        config["framing"] = new JObject { ["mode"] = mode, ["lengthBytes"] = 2, ["lengthByteOrder"] = "LittleEndian",
            ["checksum"] = checksum, ["checksumByteOrder"] = "LittleEndian", ["fixedLength"] = checksum == "None" ? 8 : 10 };
        config["downlink"]!["deviceOffset"] = 3; config["downlink"]!["deviceLength"] = 2;
        return TcpIngressRules.Parse(config.ToString())!;
    }

    private static byte[] AlternateFrame(bool response, string checksum = "Crc16Modbus")
    {
        var frame = Convert.FromHexString((response ? "B2" : "A1") + (checksum == "None" ? "0800" : "0A00") + "010255" + (checksum == "None" ? "" : "0000") + "0D0A");
        if (checksum != "None")
        {
            var crc = TcpFramePolicy.ComputeChecksum(frame.AsSpan(0, frame.Length - 4), checksum);
            frame[^4] = (byte)crc; frame[^3] = (byte)(crc >> 8);
        }
        return frame;
    }

    [Theory]
    [InlineData("LengthPrefix", "Crc16Modbus")]
    [InlineData("FixedLength", "Crc16Modbus")]
    [InlineData("Delimiter", "None")]
    public void Alternate_protocols_validate_without_vendor_specific_runtime(string mode, string checksum)
    {
        var rule = AlternateRule(mode, checksum);
        var request = AlternateFrame(false, checksum); var response = AlternateFrame(true, checksum);
        Assert.Equal(TcpIngressFrameReadStatus.NeedMore, TcpIngressFrameCodec.TryReadFrame(request.AsSpan(0, 4), rule, out _, out _));
        Assert.Equal(TcpIngressFrameReadStatus.Complete, TcpIngressFrameCodec.TryReadFrame(request.Concat(request).ToArray(), rule, out var length, out _));
        Assert.Equal(request.Length, length);
        Assert.True(TcpIngressFrameCodec.ValidateResponse(response, request, rule));
        Assert.Equal(response, rule.Downlink!.ValidateDownlink("0102", Convert.ToHexString(response)));
        Assert.Throws<ArgumentException>(() => rule.Downlink.ValidateDownlink("0103", Convert.ToHexString(response)));
        response[^1] ^= 1;
        Assert.False(TcpIngressFrameCodec.ValidateResponse(response, request, rule));
    }

    [Fact]
    public void Configurable_checksum_matches_standard_vectors_and_rejects_unbounded_length()
    {
        var bytes = System.Text.Encoding.ASCII.GetBytes("123456789");
        Assert.Equal(0x31c3, TcpFramePolicy.ComputeChecksum(bytes, "Crc16Xmodem"));
        Assert.Equal(0x4b37, TcpFramePolicy.ComputeChecksum(bytes, "Crc16Modbus"));
        var root = Configuration(); root["lengthOffset"] = 4;
        root.Remove("downlink");
        root["framing"] = new JObject { ["lengthBytes"] = 4 };
        var rule = TcpIngressRules.Parse(root.ToString())!;
        Assert.Equal(TcpIngressFrameReadStatus.Invalid, TcpIngressFrameCodec.TryReadFrame(Convert.FromHexString("AA333380FFFFFFFF"), rule, out _, out _));
        root["framing"]!["lengthBytes"] = 3;
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(root.ToString()));
    }

    [Theory]
    [InlineData(1, false)]
    [InlineData(1, true)]
    [InlineData(4, false)]
    [InlineData(4, true)]
    public void Length_width_byte_order_and_negative_adjustment_are_protocol_configuration(int width, bool littleEndian)
    {
        var root = Configuration();
        root["requestHeaderHex"] = "A1"; root["responseHeaderHex"] = "B2"; root["tailHex"] = "";
        root["lengthOffset"] = 1; root["lengthAdjustment"] = -2;
        root["correlationOffset"] = 1 + width; root["correlationLength"] = 2;
        root["downlink"]!["deviceOffset"] = 1 + width; root["downlink"]!["deviceLength"] = 2;
        root["framing"] = new JObject { ["lengthBytes"] = width,
            ["lengthByteOrder"] = littleEndian ? "LittleEndian" : "BigEndian", ["checksum"] = "None" };
        var frame = new byte[width + 4]; frame[0] = 0xb2;
        for (var i = 0; i < width; i++) frame[1 + i] = (byte)((frame.Length + 2) >> (8 * (littleEndian ? i : width - 1 - i)));
        frame[width + 1] = 1; frame[width + 2] = 2; frame[^1] = 0x55;
        var rule = TcpIngressRules.Parse(root.ToString())!;
        Assert.Equal(frame, rule.Downlink!.ValidateDownlink("0102", Convert.ToHexString(frame)));
        frame[0] = 0xa1;
        Assert.Equal(TcpIngressFrameReadStatus.Complete, TcpIngressFrameCodec.TryReadFrame(frame, rule, out var length, out _));
        Assert.Equal(frame.Length, length);
    }

    [Fact]
    public void Incoming_and_downlink_addresses_can_have_different_offsets()
    {
        var root = Configuration();
        root["downlink"]!["downlinkDeviceOffset"] = 8;
        var policy = IoTDownlinkPolicy.Parse(root)!;
        var frame = Control();
        Convert.FromHexString(Device).CopyTo(frame, 8);
        var crc = TcpFramePolicy.ComputeChecksum(frame.AsSpan(0, frame.Length - 4), "Crc16Xmodem");
        frame[^4] = (byte)(crc >> 8); frame[^3] = (byte)crc;
        Assert.Equal(Device, policy.ReadDeviceId(Heartbeat));
        Assert.Equal(frame, policy.ValidateDownlink(Device, Convert.ToHexString(frame)));
        Assert.Throws<ArgumentException>(() => policy.ReadDeviceId(new byte[10]));
    }

    [Fact]
    public void Checksum_coverage_and_invalid_profile_settings_are_enforced()
    {
        var root = Configuration();
        root["framing"] = new JObject { ["checksumStartOffset"] = 4 };
        var rule = TcpIngressRules.Parse(root.ToString())!;
        Assert.False(TcpIngressFrameCodec.ValidateRequest(Heartbeat, rule));
        var frame = Heartbeat.ToArray();
        var crc = TcpFramePolicy.ComputeChecksum(frame.AsSpan(4, frame.Length - 8), "Crc16Xmodem");
        frame[^4] = (byte)(crc >> 8); frame[^3] = (byte)crc;
        Assert.True(TcpIngressFrameCodec.ValidateRequest(frame, rule));
        root["framing"]!["checksum"] = "ArbitraryScript";
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(root.ToString()));
        root["framing"] = new JObject { ["mode"] = "Delimiter", ["checksum"] = "None" }; root["tailHex"] = "";
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(root.ToString()));
    }

    [Fact]
    public async Task Alternate_protocol_delivers_on_original_socket_without_modifying_iot_atomic()
    {
        var shared = new Store(); var rule = AlternateRule();
        var ack = AlternateFrame(true);
        await using var node = await Node.Start(shared, rule: rule, heartbeat: AlternateFrame(false), ack: ack, device: "0102");
        Assert.Equal(ack, await node.ReadExact(ack.Length));
        await shared.EnqueueAsync("fixture", "0102", "vendor-neutral", Convert.ToHexString(ack), "fixture-control", "u", 30, rule.Downlink!);
        Assert.Equal(ack, await node.ReadExact(ack.Length));
    }

    private static byte[] Control(byte operation = 7)
    {
        var frame = Convert.FromHexString("BB666680001501999999999999990106" + operation.ToString("X2") + "000000010000FCFF");
        var crc = TcpIngressFrameCodec.Crc16Xmodem(frame.AsSpan(0, frame.Length - 4));
        frame[^4] = (byte)(crc >> 8);
        frame[^3] = (byte)crc;
        return frame;
    }

    [Fact]
    public void Registry_exposes_iot_but_cannot_send_without_trusted_engine_context()
    {
        Assert.Contains("IoT", V8ExtensionRegistry.GetRegisteredNames());
        var engine = new Engine();
        engine.Execute("var V8={};");
        V8ExtensionRegistry.InjectAll(engine);
        Assert.Equal(0, engine.Evaluate("V8.IoT.Send({DeviceId:'0199999999999999',CommandId:'one',FrameHex:'00'}).Code").AsNumber());
    }

    [Fact]
    public void Production_sandbox_hides_raw_iot_store_and_context_mutation()
    {
        using var engine = new V8Engine().CreateEngine();
        engine.SetValue("rawIoT", Jint.Runtime.Interop.TypeReference.CreateTypeReference(engine, typeof(IoTCommandRuntime)));
        engine.SetValue("tenantContext", Jint.Runtime.Interop.TypeReference.CreateTypeReference(engine, typeof(V8TenantContext)));
        Assert.Equal("undefined", engine.Evaluate("typeof rawIoT.CreateStore").AsString());
        Assert.Equal("undefined", engine.Evaluate("typeof tenantContext.Enter").AsString());
        Assert.Equal("undefined", engine.Evaluate("typeof tenantContext.Current").AsString());
    }

    [Fact]
    public void Javascript_number_arguments_accept_integral_values_and_reject_fractional_expiry()
    {
        var policy = Rule().Downlink!;
        var engine = new Engine();
        engine.SetValue("device", Device);
        engine.SetValue("frame", Convert.ToHexString(Control()));
        engine.SetValue("validateIoT", new Func<object, int>(input =>
        {
            var request = JObject.Parse(JsonConvert.SerializeObject(input));
            IoTCommandRuntime.ValidateRequest(request, policy, out _, out _, out _, out var expiry);
            return expiry;
        }));
        Assert.Equal(30, engine.Evaluate("validateIoT({DeviceId:device,CommandId:'js',FrameHex:frame,ExpireSeconds:30})").AsNumber());
        var fractional = new JObject { ["DeviceId"] = Device, ["CommandId"] = "fraction", ["FrameHex"] = Convert.ToHexString(Control()), ["ExpireSeconds"] = 30.5 };
        Assert.Throws<ArgumentException>(() => IoTCommandRuntime.ValidateRequest(fractional, policy, out _, out _, out _, out _));
    }

    [Fact]
    public void New_downlink_is_opt_in_and_keeps_existing_ack_correlation_strict()
    {
        var config = Configuration();
        config.Remove("downlink");
        Assert.Null(TcpIngressRules.Parse(config.ToString())!.Downlink);
        Assert.True(TcpIngressFrameCodec.ValidateResponse(Ack, Heartbeat, Rule()));
        Assert.False(TcpIngressFrameCodec.ValidateResponse(Control(), Heartbeat, Rule()));
        Assert.Equal(Control(), Rule().Downlink!.ValidateDownlink(Device, Convert.ToHexString(Control())));
    }

    [Fact]
    public void Existing_explicit_any_source_configuration_is_supported_without_relaxing_default_cidr_rules()
    {
        var root = Configuration();
        root["allowedCidrs"] = new JArray("0.0.0.0/0");
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(root.ToString()));
        root["allowAnySource"] = true;
        Assert.True(TcpIngressRules.Parse(root.ToString())!.IsAllowed(IPAddress.Parse("203.0.113.17")));
        root["allowedCidrs"] = new JArray("0.0.0.0/0", "127.0.0.1/32");
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(root.ToString()));
        root["allowedCidrs"] = new JArray("127.0.0.1/32");
        root["allowAnySource"] = "true";
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(root.ToString()));
    }

    [Fact]
    public void Downlink_rejects_other_device_bad_crc_ambiguous_parameters_and_bad_limits()
    {
        var policy = Rule().Downlink!;
        Assert.Throws<ArgumentException>(() => policy.ValidateDownlink("0000000000000001", Convert.ToHexString(Control())));
        var bad = Control(); bad[17] ^= 1;
        Assert.Throws<ArgumentException>(() => policy.ValidateDownlink(Device, Convert.ToHexString(bad)));
        Assert.Throws<ArgumentException>(() => IoTCommandRuntime.ValidateRequest(new JObject {
            ["DeviceId"]=Device,["CommandId"]="a",["FrameHex"]=Convert.ToHexString(Control()),["OsClient"]="other"
        }, policy, out _, out _, out _, out _));
        var root = Configuration(); root["downlink"]!["sendApiEngineKeys"] = new JArray();
        Assert.Throws<ArgumentException>(() => TcpIngressRules.Parse(root.ToString()));
        root = Configuration(); root["downlink"]!["deviceOffset"] = 3;
        Assert.Throws<ArgumentException>(() => TcpIngressRules.Parse(root.ToString()));
        root = Configuration(); root["downlink"]!["maxPendingCommands"] = 128; root["maxFrameBytes"] = 8192;
        Assert.Throws<ArgumentException>(() => TcpIngressRules.Parse(root.ToString()));
    }

    [Fact]
    public async Task Control_is_delivered_on_existing_socket_without_waiting_for_next_heartbeat()
    {
        var shared = new Store();
        await using var node = await Node.Start(shared);
        Assert.Equal(Ack, await node.ReadFrame());
        var result = await shared.EnqueueAsync("fixture", Device, "control-1", Convert.ToHexString(Control()), "fixture-control", "u", 30, node.Rule.Downlink!);
        Assert.Equal(1, result.Value<int>("Code"));
        Assert.Equal(Control(), await node.ReadFrame());
        await node.Client.GetStream().WriteAsync(Heartbeat);
        Assert.Equal(Ack, await node.ReadFrame());
        Assert.Equal("Written", shared.State("control-1"));
        var duplicate = await shared.EnqueueAsync("fixture", Device, "control-1", Convert.ToHexString(Control()), "fixture-control", "u", 30, node.Rule.Downlink!);
        Assert.True(duplicate["Data"]!.Value<bool>("Duplicate"));
        Assert.Equal(1, shared.Claimed);
    }

    [Fact]
    public async Task Unbound_device_receives_normal_ack_but_has_no_downlink_connection()
    {
        var shared = new Store();
        await using var node = await Node.Start(shared, authorize: false);
        Assert.Equal(Ack, await node.ReadFrame());
        var result = await shared.EnqueueAsync("fixture", Device, "unbound", Convert.ToHexString(Control()), "fixture-control", "u", 30, node.Rule.Downlink!);
        Assert.Equal(0, result.Value<int>("Code"));
        Assert.Equal("Offline", result["Data"]!.Value<string>("State"));
    }

    [Fact]
    public async Task Reconnected_device_routes_to_new_socket_and_old_release_cannot_delete_new_owner()
    {
        var shared = new Store();
        await using var old = await Node.Start(shared);
        await old.ReadFrame();
        await using var current = await Node.Start(shared);
        await current.ReadFrame();
        await old.Stop();
        var result = await shared.EnqueueAsync("fixture", Device, "new-owner", Convert.ToHexString(Control(9)), "fixture-control", "u", 30, current.Rule.Downlink!);
        Assert.Equal(1, result.Value<int>("Code"));
        Assert.Equal(Control(9), await current.ReadFrame());
        var otherTenant = await shared.EnqueueAsync("other", Device, "cross-tenant", Convert.ToHexString(Control()), "fixture-control", "u", 30, current.Rule.Downlink!);
        Assert.Equal(0, otherTenant.Value<int>("Code"));
    }

    [Fact]
    public async Task Failure_after_socket_write_marks_unknown_and_does_not_replay()
    {
        var shared = new Store { FailCompletion = true };
        await using var node = await Node.Start(shared);
        await node.ReadFrame();
        await shared.EnqueueAsync("fixture", Device, "unknown", Convert.ToHexString(Control()), "fixture-control", "u", 30, node.Rule.Downlink!);
        Assert.Equal(Control(), await node.ReadFrame());
        var fault = await Record.ExceptionAsync(() => node.Task.WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.IsType<IOException>(fault);
        Assert.Equal("Unknown", shared.State("unknown"));
        Assert.Equal(1, shared.Claimed);
    }

    [Fact]
    public async Task Claimed_command_is_not_recovered_by_another_connection()
    {
        var shared = new Store(); var policy = Rule().Downlink!;
        await shared.BindAsync("fixture", Device, "a", policy);
        await shared.EnqueueAsync("fixture", Device, "once", Convert.ToHexString(Control()), "fixture-control", "u", 30, policy);
        Assert.NotNull((await shared.ClaimAsync("fixture", Device, "a", policy)).Command);
        Assert.Null((await shared.ClaimAsync("fixture", Device, "a", policy)).Command);
        await shared.BindAsync("fixture", Device, "b", policy);
        Assert.False((await shared.ClaimAsync("fixture", Device, "a", policy)).OwnsConnection);
        Assert.Null((await shared.ClaimAsync("fixture", Device, "b", policy)).Command);
    }

    private sealed class Node : IAsyncDisposable
    {
        public TcpClient Client = null!;
        public TcpIngressRule Rule = IoTDownlinkTests.Rule();
        public Task Task = null!;
        private readonly CancellationTokenSource _stop = new(TimeSpan.FromSeconds(10));
        public static async Task<Node> Start(Store shared, bool authorize = true, TcpIngressRule? rule = null,
            byte[]? heartbeat = null, byte[]? ack = null, string device = Device)
        {
            var node = new Node();
            if (rule != null) node.Rule = rule;
            var bound = shared.Bound = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            using var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            node.Client = new TcpClient();
            await node.Client.ConnectAsync(IPAddress.Loopback, ((IPEndPoint)listener.LocalEndpoint).Port);
            var accepted = await listener.AcceptTcpClientAsync();
            var downlink = new TcpIngressIoTSession(node.Rule, shared);
            node.Task = TcpIngressSession.RunAsync(accepted, node.Rule, (frame, _) =>
            {
                downlink.ObserveResponse(frame, new JObject { ["Code"] = 1, ["Data"] = new JObject { ["IoTDeviceId"] = authorize ? device : null } });
                return System.Threading.Tasks.Task.FromResult<byte[]?>(ack ?? Ack);
            }, node._stop.Token, downlink);
            await node.Client.GetStream().WriteAsync(heartbeat ?? Heartbeat);
            // ACK 写入在 Bind 之前；等待后台任务真正注册，避免把客户端读到 ACK 误当成租约已建立。
            if (authorize) await bound.Task.WaitAsync(TimeSpan.FromSeconds(5));
            return node;
        }
        public async Task<byte[]> ReadFrame()
        {
            using var limit = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var first = new byte[6]; await Client.GetStream().ReadExactlyAsync(first, limit.Token);
            var frame = new byte[((first[4] << 8) | first[5]) + 4];
            first.CopyTo(frame, 0);
            await Client.GetStream().ReadExactlyAsync(frame.AsMemory(6), limit.Token);
            return frame;
        }
        public async Task<byte[]> ReadExact(int length)
        {
            using var limit = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            var bytes = new byte[length]; await Client.GetStream().ReadExactlyAsync(bytes, limit.Token); return bytes;
        }
        public async Task Stop()
        {
            _stop.Cancel(); Client.Dispose();
            try { await Task.WaitAsync(TimeSpan.FromSeconds(5)); }
            catch (Exception ex) when (ex is OperationCanceledException or IOException or InvalidOperationException) { }
        }
        public async ValueTask DisposeAsync() { await Stop(); _stop.Dispose(); }
    }

    private sealed class Store : IIoTCommandStore
    {
        private readonly object _gate = new();
        private readonly Dictionary<string, string> _owners = new();
        private readonly Dictionary<string, JObject> _commands = new();
        private readonly Dictionary<string, Queue<string>> _queues = new();
        public TaskCompletionSource Bound = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public int Claimed;
        public bool FailCompletion;
        private static string Key(string tenant, string device) => tenant + ":" + device;
        public Task BindAsync(string tenant, string device, string session, IoTDownlinkPolicy policy)
        {
            lock (_gate) { _owners[Key(tenant, device)] = session; Bound.TrySetResult(); }
            return System.Threading.Tasks.Task.CompletedTask;
        }
        public Task<bool> RenewAsync(string tenant, string device, string session, IoTDownlinkPolicy policy)
        { lock (_gate) return System.Threading.Tasks.Task.FromResult(_owners.GetValueOrDefault(Key(tenant, device)) == session); }
        public Task ReleaseAsync(string tenant, string device, string session)
        {
            lock (_gate) if (_owners.GetValueOrDefault(Key(tenant, device)) == session) _owners.Remove(Key(tenant, device));
            return System.Threading.Tasks.Task.CompletedTask;
        }
        public Task<JObject> EnqueueAsync(string tenant, string device, string commandId, string frameHex, string caller, string userId, int expireSeconds, IoTDownlinkPolicy policy)
        {
            lock (_gate)
            {
                if (_commands.TryGetValue(commandId, out var existing)) return System.Threading.Tasks.Task.FromResult(new JObject { ["Code"] = 1, ["Data"] = new JObject { ["State"] = existing["State"], ["Duplicate"] = true } });
                if (!_owners.TryGetValue(Key(tenant, device), out var owner)) return System.Threading.Tasks.Task.FromResult(new JObject { ["Code"] = 0, ["Data"] = new JObject { ["State"] = "Offline" } });
                _commands[commandId] = new JObject { ["CommandId"] = commandId, ["FrameHex"] = frameHex, ["State"] = "Queued" };
                if (!_queues.TryGetValue(owner, out var queue)) _queues[owner] = queue = new Queue<string>();
                queue.Enqueue(commandId);
                return System.Threading.Tasks.Task.FromResult(new JObject { ["Code"] = 1, ["Data"] = new JObject { ["State"] = "Queued" } });
            }
        }
        public Task<IoTCommandClaim> ClaimAsync(string tenant, string device, string session, IoTDownlinkPolicy policy)
        {
            lock (_gate)
            {
                var owned = _owners.GetValueOrDefault(Key(tenant, device)) == session;
                JObject? command = null;
                if (owned && _queues.TryGetValue(session, out var queue) && queue.TryDequeue(out var id))
                { command = _commands[id]; command["State"] = "Sending"; Claimed++; }
                return System.Threading.Tasks.Task.FromResult(new IoTCommandClaim { OwnsConnection = owned, Command = command });
            }
        }
        public Task CompleteAsync(string tenant, string device, string session, string commandId, string state, IoTDownlinkPolicy policy)
        {
            if (FailCompletion && state == "Written") throw new IOException("Injected storage failure");
            lock (_gate) _commands[commandId]["State"] = state;
            return System.Threading.Tasks.Task.CompletedTask;
        }
        public string State(string id) { lock (_gate) return _commands[id].Value<string>("State")!; }
    }
}
