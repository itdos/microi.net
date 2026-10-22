using System.Net;
using System.Net.Sockets;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

/// <summary>
/// 原始 TCP 入站的离线协议回归：真实设备按字节流发送，HTTP 接口引擎仅负责业务和生成应答帧。
/// 用协议文档中的心跳向量锁定帧边界与回包关联，避免把 TCP 分包误当成坏设备数据。
/// </summary>
public class TcpIngressProtocolTests
{
    private const string RuleJson = """
        {
          "osClient": "xjy",
          "apiEngineKey": "xinjiyuan-device-uplink",
          "allowedCidrs": ["127.0.0.1/32"],
          "requestHeaderHex": "AA333380",
          "responseHeaderHex": "BB666680",
          "tailHex": "FCFF",
          "lengthOffset": 4,
          "lengthAdjustment": 4,
          "correlationOffset": 6,
          "correlationLength": 10,
          "maxFrameBytes": 4096,
          "maxConnections": 100,
          "idleTimeoutSeconds": 90,
          "executionTimeoutSeconds": 5,
          "maxQueuedFramesPerConnection": 8
        }
        """;

    private static readonly byte[] Heartbeat = Convert.FromHexString(
        "AA3333800012019999999999999900110100FA43FCFF");

    private static readonly byte[] SuccessAck = Convert.FromHexString(
        "BB66668000110199999999999999001100EC8AFCFF");

    [Fact]
    public void Absent_rule_never_creates_a_listener_rule_but_damaged_rule_fails_validation()
    {
        Assert.Null(TcpIngressRules.Parse(null));
        Assert.Null(TcpIngressRules.Parse(null, new JValue(19011)));
        Assert.Null(TcpIngressRules.Parse(""));
        Assert.Null(TcpIngressRules.Parse("  "));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse("{}"));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse("{not-json"));
    }

    [Fact]
    public void Main_tenant_enable_switch_accepts_null_empty_and_one_but_zero_disables()
    {
        Assert.True(TcpIngressRules.ParseEnable(null));
        Assert.True(TcpIngressRules.ParseEnable(JValue.CreateNull()));
        Assert.True(TcpIngressRules.ParseEnable(new JValue("")));
        Assert.True(TcpIngressRules.ParseEnable(new JValue("  ")));
        Assert.True(TcpIngressRules.ParseEnable(new JValue(1)));
        Assert.True(TcpIngressRules.ParseEnable(new JValue("1")));
        Assert.False(TcpIngressRules.ParseEnable(new JValue(0)));
        Assert.False(TcpIngressRules.ParseEnable(new JValue("0")));
    }

    [Fact]
    public void Main_tenant_enable_switch_rejects_unrecognized_values_and_json_cannot_duplicate_it()
    {
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.ParseEnable(new JValue(2)));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.ParseEnable(new JValue(-1)));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.ParseEnable(new JValue("true")));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.ParseEnable(new JValue(true)));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(
            RuleJson.Replace("\"osClient\": \"xjy\",",
                "\"enabled\": true, \"osClient\": \"xjy\",", StringComparison.Ordinal)));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(
            RuleJson.Replace("\"osClient\": \"xjy\",",
                "\"enabled\": false, \"osClient\": \"xjy\",", StringComparison.Ordinal)));
    }

    [Theory]
    [InlineData("[", "]")]
    [InlineData("\"", "\"")]
    public void Runtime_switch_query_is_parameterized_by_all_three_main_tenant_keys_and_accepts_legacy_null_delete_flag(
        string leftQuote, string rightQuote)
    {
        var sql = TcpIngressSwitchQuery.Build(leftQuote, rightQuote);

        Assert.Contains($"SELECT {leftQuote}TcpIngressEnable{rightQuote} FROM {leftQuote}sys_osclients{rightQuote}", sql);
        Assert.Contains($"{leftQuote}OsClient{rightQuote} = @osClient", sql);
        Assert.Contains($"{leftQuote}OsClientType{rightQuote} = @osClientType", sql);
        Assert.Contains($"{leftQuote}OsClientNetwork{rightQuote} = @osClientNetwork", sql);
        Assert.Contains($"{leftQuote}IsEnable{rightQuote} = 1", sql);
        Assert.Contains($"({leftQuote}IsDeleted{rightQuote} = 0 OR {leftQuote}IsDeleted{rightQuote} IS NULL)", sql);
    }

    [Fact]
    public void Enabled_rule_binds_fixed_tenant_engine_default_port_and_narrow_cidr()
    {
        var rule = Rule();

        Assert.Equal("xjy", rule.OsClient);
        Assert.Equal("xinjiyuan-device-uplink", rule.ApiEngineKey);
        Assert.Equal(1885, TcpIngressRules.DefaultListenPort);
        Assert.Equal(1885, rule.ListenPort);
        Assert.Equal(4096, rule.MaxFrameBytes);
        Assert.True(rule.IsAllowed(IPAddress.Loopback));
        Assert.True(rule.IsAllowed(IPAddress.Parse("::ffff:127.0.0.1")));
        Assert.False(rule.IsAllowed(IPAddress.Parse("127.0.0.2")));
        Assert.False(rule.IsAllowed(IPAddress.Parse("8.8.8.8")));
        Assert.False(rule.IsAllowed(IPAddress.IPv6Loopback));
    }

    [Fact]
    public void Main_tenant_port_overrides_default_but_json_cannot_override_it()
    {
        Assert.Equal(19011, TcpIngressRules.Parse(RuleJson, new JValue(19011))!.ListenPort);
        Assert.Equal(19011, TcpIngressRules.ParsePort(new JValue("19011")));
        Assert.Equal(1885, TcpIngressRules.ParsePort(null));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(
            RuleJson.Replace("\"osClient\": \"xjy\",",
                "\"listenPort\": 1052, \"osClient\": \"xjy\",", StringComparison.Ordinal),
            new JValue(19011)));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(65536)]
    public void Main_tenant_port_rejects_out_of_range_values(int port)
    {
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.ParsePort(new JValue(port)));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(RuleJson, new JValue(port)));
    }

    [Fact]
    public void Main_tenant_port_rejects_non_integer_values()
    {
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.ParsePort(new JValue("abc")));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.ParsePort(new JValue("80.0")));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.ParsePort(new JValue(true)));
    }

    [Fact]
    public void Heartbeat_and_ack_match_documented_lengths_crc_and_correlation()
    {
        var rule = Rule();

        Assert.Equal(22, Heartbeat.Length);
        Assert.Equal(21, SuccessAck.Length);
        Assert.Equal((ushort)0xFA43, TcpIngressFrameCodec.Crc16Xmodem(Heartbeat.AsSpan(0, 18)));
        Assert.Equal((ushort)0xEC8A, TcpIngressFrameCodec.Crc16Xmodem(SuccessAck.AsSpan(0, 17)));
        Assert.True(TcpIngressFrameCodec.ValidateRequest(Heartbeat, rule));
        Assert.True(TcpIngressFrameCodec.ValidateResponse(SuccessAck, Heartbeat, rule));

        var status = TcpIngressFrameCodec.TryReadFrame(
            Heartbeat, rule, out var totalLength, out var error);
        Assert.Equal(TcpIngressFrameReadStatus.Complete, status);
        Assert.Equal(Heartbeat.Length, totalLength);
        Assert.Equal(string.Empty, error);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(4)]
    [InlineData(5)]
    [InlineData(6)]
    [InlineData(14)]
    [InlineData(21)]
    public void Partial_heartbeat_waits_for_remaining_tcp_bytes(int receivedBytes)
    {
        var status = TcpIngressFrameCodec.TryReadFrame(
            Heartbeat.AsSpan(0, receivedBytes), Rule(), out _, out var error);

        Assert.Equal(TcpIngressFrameReadStatus.NeedMore, status);
        Assert.Equal(string.Empty, error);
    }

    [Fact]
    public void Coalesced_heartbeats_are_two_distinct_frames_with_two_ack_opportunities()
    {
        var rule = Rule();
        var combined = Heartbeat.Concat(Heartbeat).ToArray();
        var replies = new List<byte[]>();
        var consumed = 0;

        // 模拟一条 TCP 连接中一次读取到两帧；每帧都必须独立执行接口引擎并回包。
        while (consumed < combined.Length)
        {
            var status = TcpIngressFrameCodec.TryReadFrame(
                combined.AsSpan(consumed), rule, out var frameLength, out _);
            Assert.Equal(TcpIngressFrameReadStatus.Complete, status);
            Assert.Equal(Heartbeat.Length, frameLength);
            Assert.True(TcpIngressFrameCodec.ValidateResponse(
                SuccessAck, combined.AsSpan(consumed, frameLength), rule));
            replies.Add(SuccessAck);
            consumed += frameLength;
        }

        Assert.Equal(2, replies.Count);
        Assert.Equal(combined.Length, consumed);
        Assert.Equal(SuccessAck.Concat(SuccessAck), replies.SelectMany(bytes => bytes));
    }

    [Fact]
    public async Task Loopback_connection_returns_two_binary_acks_for_split_and_repeated_heartbeats()
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(
            TestContext.Current.CancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(5));
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var device = new TcpClient();
        await device.ConnectAsync(IPAddress.Loopback, port, deadline.Token);
        var accepted = await listener.AcceptTcpClientAsync(deadline.Token);
        var executions = 0;
        var session = TcpIngressSession.RunAsync(accepted, Rule(), (request, _) =>
        {
            Assert.Equal(Heartbeat, request);
            Interlocked.Increment(ref executions);
            return Task.FromResult<byte[]?>(SuccessAck);
        }, deadline.Token);

        // 设备分片发首帧，随后在同一连接继续发相同的下一次心跳。
        var stream = device.GetStream();
        await stream.WriteAsync(Heartbeat.AsMemory(0, 7), deadline.Token);
        await Task.Delay(20, deadline.Token);
        await stream.WriteAsync(Heartbeat.AsMemory(7), deadline.Token);
        await stream.WriteAsync(Heartbeat, deadline.Token);
        var replies = new byte[SuccessAck.Length * 2];
        await stream.ReadExactlyAsync(replies, deadline.Token);

        Assert.Equal(SuccessAck.Concat(SuccessAck), replies);
        Assert.Equal(2, Volatile.Read(ref executions));
        device.Close();
        await session.WaitAsync(deadline.Token);
    }

    [Fact]
    public async Task Loopback_connection_closes_without_engine_call_for_corrupt_crc()
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(
            TestContext.Current.CancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(5));
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        using var device = new TcpClient();
        await device.ConnectAsync(IPAddress.Loopback,
            ((IPEndPoint)listener.LocalEndpoint).Port, deadline.Token);
        var accepted = await listener.AcceptTcpClientAsync(deadline.Token);
        var executions = 0;
        var session = TcpIngressSession.RunAsync(accepted, Rule(), (_, _) =>
        {
            Interlocked.Increment(ref executions);
            return Task.FromResult<byte[]?>(SuccessAck);
        }, deadline.Token);

        var corrupt = ReplaceByte(Heartbeat, 17, 0x01);
        var stream = device.GetStream();
        await stream.WriteAsync(corrupt, deadline.Token);
        var oneByte = new byte[1];
        Assert.Equal(0, await stream.ReadAsync(oneByte, deadline.Token));
        await session.WaitAsync(deadline.Token);
        Assert.Equal(0, Volatile.Read(ref executions));
    }

    [Fact]
    public async Task Concurrent_partial_sessions_stop_without_waiting_for_idle_timeout()
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(
            TestContext.Current.CancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(5));
        using var stopping = new CancellationTokenSource();
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var firstDevice = new TcpClient();
        using var secondDevice = new TcpClient();
        await firstDevice.ConnectAsync(IPAddress.Loopback, port, deadline.Token);
        await secondDevice.ConnectAsync(IPAddress.Loopback, port, deadline.Token);
        var firstAccepted = await listener.AcceptTcpClientAsync(deadline.Token);
        var secondAccepted = await listener.AcceptTcpClientAsync(deadline.Token);
        var executions = 0;
        Task<byte[]?> UnexpectedExecution(byte[] _, CancellationToken __)
        {
            Interlocked.Increment(ref executions);
            return Task.FromResult<byte[]?>(SuccessAck);
        }
        var sessions = new[]
        {
            TcpIngressSession.RunAsync(firstAccepted, Rule(), UnexpectedExecution, stopping.Token),
            TcpIngressSession.RunAsync(secondAccepted, Rule(), UnexpectedExecution, stopping.Token)
        };
        await firstDevice.GetStream().WriteAsync(Heartbeat.AsMemory(0, 7), deadline.Token);
        await secondDevice.GetStream().WriteAsync(Heartbeat.AsMemory(0, 7), deadline.Token);

        // 停机无需等待 90 秒空闲超时；两个未完成帧应一起取消且不得调用业务接口。
        stopping.Cancel();
        try { await Task.WhenAll(sessions).WaitAsync(deadline.Token); }
        catch (OperationCanceledException) when (stopping.IsCancellationRequested) { }
        Assert.All(sessions, task =>
        {
            Assert.True(task.IsCompleted);
            Assert.False(task.IsFaulted);
        });
        Assert.Equal(0, Volatile.Read(ref executions));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Missing_or_wrong_device_ack_closes_connection_without_sending_bytes(
        bool wrongDevice)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(
            TestContext.Current.CancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(5));
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        using var device = new TcpClient();
        await device.ConnectAsync(IPAddress.Loopback,
            ((IPEndPoint)listener.LocalEndpoint).Port, deadline.Token);
        var accepted = await listener.AcceptTcpClientAsync(deadline.Token);
        var executions = 0;
        var wrongAck = WithValidCrc(ReplaceByte(SuccessAck, 6, 0x02));
        var session = TcpIngressSession.RunAsync(accepted, Rule(), (_, _) =>
        {
            Interlocked.Increment(ref executions);
            return Task.FromResult<byte[]?>(wrongDevice ? wrongAck : null);
        }, deadline.Token);

        var stream = device.GetStream();
        await stream.WriteAsync(Heartbeat, deadline.Token);
        var oneByte = new byte[1];
        Assert.Equal(0, await stream.ReadAsync(oneByte, deadline.Token));
        await session.WaitAsync(deadline.Token);
        Assert.Equal(1, Volatile.Read(ref executions));
    }

    [Fact]
    public async Task Valid_protocol_failure_ack_is_written_as_binary_without_business_code_filter()
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(
            TestContext.Current.CancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(5));
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        using var device = new TcpClient();
        await device.ConnectAsync(IPAddress.Loopback,
            ((IPEndPoint)listener.LocalEndpoint).Port, deadline.Token);
        var accepted = await listener.AcceptTcpClientAsync(deadline.Token);
        var failureAck = WithValidCrc(ReplaceByte(SuccessAck, 16, 0x01));
        Assert.True(TcpIngressFrameCodec.ValidateResponse(failureAck, Heartbeat, Rule()));
        var session = TcpIngressSession.RunAsync(accepted, Rule(), (_, _) =>
            Task.FromResult<byte[]?>(failureAck), deadline.Token);

        var stream = device.GetStream();
        await stream.WriteAsync(Heartbeat, deadline.Token);
        var actual = new byte[failureAck.Length];
        await stream.ReadExactlyAsync(actual, deadline.Token);
        Assert.Equal(failureAck, actual);
        device.Close();
        await session.WaitAsync(deadline.Token);
    }

    [Fact]
    public void Invalid_header_length_crc_and_tail_are_not_accepted_or_forwarded()
    {
        var rule = Rule();
        AssertInvalid(ReplaceByte(Heartbeat, 0, 0xAB), rule);
        AssertInvalid(ReplaceByte(Heartbeat, 5, 0x11), rule);
        AssertInvalid(ReplaceByte(Heartbeat, 4, 0xFF), rule);
        AssertInvalid(ReplaceByte(Heartbeat, 17, 0x01), rule);
        AssertInvalid(ReplaceByte(Heartbeat, Heartbeat.Length - 1, 0x00), rule);

        // 声明长度仍在上限内、实际仅收到一部分时是 TCP 分包，不能误拒绝。
        var longerPartial = ReplaceByte(Heartbeat, 5, 0xFF);
        Assert.Equal(TcpIngressFrameReadStatus.NeedMore,
            TcpIngressFrameCodec.TryReadFrame(longerPartial, rule, out _, out _));
    }

    [Fact]
    public void Tcp_engine_must_be_hidden_from_http_and_not_anonymous()
    {
        Assert.False(TcpIngressEnginePolicy.IsEligible(null));
        Assert.True(TcpIngressEnginePolicy.IsEligible(JObject.Parse(
            """{"StopHttp":true,"AllowAnonymous":false,"IsEnable":true}""")));
        Assert.False(TcpIngressEnginePolicy.IsEligible(JObject.Parse(
            """{"StopHttp":false,"AllowAnonymous":false,"IsEnable":true}""")));
        Assert.False(TcpIngressEnginePolicy.IsEligible(JObject.Parse(
            """{"StopHttp":true,"AllowAnonymous":true,"IsEnable":true}""")));
        Assert.False(TcpIngressEnginePolicy.IsEligible(JObject.Parse(
            """{"StopHttp":true,"AllowAnonymous":false,"IsEnable":false}""")));
        Assert.False(TcpIngressEnginePolicy.IsEligible(JObject.Parse(
            """{"AllowAnonymous":false,"IsEnable":true}""")));
    }

    [Fact]
    public void Ack_from_another_device_or_command_is_rejected_even_with_valid_crc()
    {
        var rule = Rule();
        var otherDevice = WithValidCrc(ReplaceByte(SuccessAck, 6, 0x02));
        var otherCommand = WithValidCrc(ReplaceByte(SuccessAck, 15, 0x12));
        var badCrc = ReplaceByte(SuccessAck, SuccessAck.Length - 4, 0x00);
        var badTail = ReplaceByte(SuccessAck, SuccessAck.Length - 1, 0x00);

        Assert.False(TcpIngressFrameCodec.ValidateResponse(otherDevice, Heartbeat, rule));
        Assert.False(TcpIngressFrameCodec.ValidateResponse(otherCommand, Heartbeat, rule));
        Assert.False(TcpIngressFrameCodec.ValidateResponse(badCrc, Heartbeat, rule));
        Assert.False(TcpIngressFrameCodec.ValidateResponse(badTail, Heartbeat, rule));
    }

    [Fact]
    public void Business_failure_result_still_decodes_its_valid_protocol_failure_ack()
    {
        var failureAck = WithValidCrc(ReplaceByte(SuccessAck, 16, 0x01));
        var result = new
        {
            Code = 0,
            Msg = "业务处理失败",
            Data = new { ResponseFrameHex = Convert.ToHexString(failureAck) }
        };

        Assert.True(TcpIngressFrameCodec.TryDecodeResponse(
            result, Heartbeat, Rule(), out var decoded));
        Assert.Equal(failureAck, decoded);
    }

    [Fact]
    public void Response_decoder_rejects_missing_corrupt_or_unrelated_ack()
    {
        var wrongDevice = WithValidCrc(ReplaceByte(SuccessAck, 6, 0x02));
        var badCrc = ReplaceByte(SuccessAck, SuccessAck.Length - 4, 0x00);
        Assert.False(TcpIngressFrameCodec.TryDecodeResponse(
            new { Code = 0, Data = new { ResponseFrameHex = Convert.ToHexString(wrongDevice) } },
            Heartbeat, Rule(), out var unrelated));
        Assert.Empty(unrelated);
        Assert.False(TcpIngressFrameCodec.TryDecodeResponse(
            new { Code = 1, Data = new { ResponseFrameHex = Convert.ToHexString(badCrc) } },
            Heartbeat, Rule(), out var corrupt));
        Assert.Empty(corrupt);
        Assert.False(TcpIngressFrameCodec.TryDecodeResponse(
            new { Code = 1, Data = (object?)null }, Heartbeat, Rule(), out var missing));
        Assert.Empty(missing);
    }

    [Fact]
    public void Enabled_rule_rejects_implicit_public_source_missing_source_and_bad_routing()
    {
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(
            RuleJson.Replace("127.0.0.1/32", "0.0.0.0/0", StringComparison.Ordinal)));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(
            RuleJson.Replace("[\"127.0.0.1/32\"]", "[]", StringComparison.Ordinal)));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(
            RuleJson.Replace("xinjiyuan-device-uplink", "../other-engine", StringComparison.Ordinal)));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(
            RuleJson.Replace("\"xjy\"", "\"\"", StringComparison.Ordinal)));
    }

    [Fact]
    public void Explicit_public_source_accepts_all_ipv4_but_never_ipv6()
    {
        var rule = TcpIngressRules.Parse(RuleJson
            .Replace("\"allowedCidrs\":", "\"allowAnySource\": true, \"allowedCidrs\":", StringComparison.Ordinal)
            .Replace("127.0.0.1/32", "0.0.0.0/0", StringComparison.Ordinal))!;

        Assert.True(rule.AllowAnySource);
        Assert.True(rule.IsAllowed(IPAddress.Parse("1.2.3.4")));
        Assert.True(rule.IsAllowed(IPAddress.Parse("203.0.113.8")));
        Assert.True(rule.IsAllowed(IPAddress.Parse("::ffff:203.0.113.8")));
        Assert.False(rule.IsAllowed(IPAddress.IPv6Loopback));
    }

    [Fact]
    public void Explicit_false_does_not_authorize_public_source()
    {
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(RuleJson
            .Replace("\"allowedCidrs\":", "\"allowAnySource\": false, \"allowedCidrs\":", StringComparison.Ordinal)
            .Replace("127.0.0.1/32", "0.0.0.0/0", StringComparison.Ordinal)));
    }

    [Fact]
    public void Existing_multiple_narrow_sources_remain_supported()
    {
        var rule = TcpIngressRules.Parse(RuleJson.Replace(
            "[\"127.0.0.1/32\"]", "[\"127.0.0.1/32\",\"192.0.2.0/24\"]", StringComparison.Ordinal))!;

        Assert.False(rule.AllowAnySource);
        Assert.True(rule.IsAllowed(IPAddress.Parse("127.0.0.1")));
        Assert.True(rule.IsAllowed(IPAddress.Parse("192.0.2.27")));
        Assert.False(rule.IsAllowed(IPAddress.Parse("192.0.3.27")));
    }

    [Theory]
    [InlineData("[\"127.0.0.1/32\"]")]
    [InlineData("[\"1.2.3.4/0\"]")]
    [InlineData("[\"0.0.0.0/0\",\"127.0.0.1/32\"]")]
    public void Explicit_public_source_rejects_ambiguous_networks(string networks)
    {
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(RuleJson
            .Replace("\"allowedCidrs\":", "\"allowAnySource\": true, \"allowedCidrs\":", StringComparison.Ordinal)
            .Replace("[\"127.0.0.1/32\"]", networks, StringComparison.Ordinal)));
    }

    [Fact]
    public void Public_source_opt_in_requires_a_boolean()
    {
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(RuleJson
            .Replace("\"allowedCidrs\":", "\"allowAnySource\": \"true\", \"allowedCidrs\":", StringComparison.Ordinal)
            .Replace("127.0.0.1/32", "0.0.0.0/0", StringComparison.Ordinal)));
    }

    [Fact]
    public void Enabled_rule_rejects_memory_budget_that_would_exhaust_a_shared_api_process()
    {
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(
            RuleJson.Replace("\"maxFrameBytes\": 4096", "\"maxFrameBytes\": 65535",
                StringComparison.Ordinal)
                .Replace("\"maxQueuedFramesPerConnection\": 8",
                    "\"maxQueuedFramesPerConnection\": 32", StringComparison.Ordinal)));
        Assert.Throws<InvalidOperationException>(() => TcpIngressRules.Parse(
            RuleJson.Replace("\"maxConnections\": 100", "\"maxConnections\": 1000",
                StringComparison.Ordinal)
                .Replace("\"maxFrameBytes\": 4096", "\"maxFrameBytes\": 8192",
                    StringComparison.Ordinal)));
    }

    private static TcpIngressRule Rule() => TcpIngressRules.Parse(RuleJson)!;

    private static void AssertInvalid(byte[] frame, TcpIngressRule rule)
    {
        var status = TcpIngressFrameCodec.TryReadFrame(frame, rule, out _, out var error);
        Assert.Equal(TcpIngressFrameReadStatus.Invalid, status);
        Assert.NotEqual(string.Empty, error);
        Assert.False(TcpIngressFrameCodec.ValidateRequest(frame, rule));
    }

    private static byte[] ReplaceByte(byte[] source, int index, byte value)
    {
        var copy = (byte[])source.Clone();
        copy[index] = value;
        return copy;
    }

    private static byte[] WithValidCrc(byte[] source)
    {
        var copy = (byte[])source.Clone();
        var offset = copy.Length - 4;
        var crc = TcpIngressFrameCodec.Crc16Xmodem(copy.AsSpan(0, offset));
        copy[offset] = (byte)(crc >> 8);
        copy[offset + 1] = (byte)crc;
        return copy;
    }
}
