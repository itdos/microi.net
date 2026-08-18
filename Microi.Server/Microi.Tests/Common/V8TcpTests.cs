using System.Net;
using System.Net.Sockets;
using System.Text;
using Jint;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class V8TcpTests
{
    [Fact]
    public async Task Registry_exposes_tcp_and_send_accepts_real_javascript_byte_array()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var serverTask = ReceiveExactlyAsync(listener, 4);

        Assert.Contains(V8ExtensionRegistry.GetRegisteredNames(),
            name => string.Equals(name, "Tcp", StringComparison.OrdinalIgnoreCase));

        var engine = new Engine();
        engine.Execute("var V8 = {};");
        V8ExtensionRegistry.InjectAll(engine);
        engine.SetValue("tcpTestPort", port);

        var summary = engine.Evaluate(
            """
            (function () {
                var result = V8.Tcp.Send({
                    Host: '127.0.0.1',
                    Port: tcpTestPort,
                    Bytes: [27, 64, 65, 10],
                    ConnectTimeout: 5,
                    SendTimeout: 5
                });
                return result.Code + '|' + result.Data.BytesSent;
            })()
            """).AsString();

        var received = await serverTask.WaitAsync(TimeSpan.FromSeconds(5),
            TestContext.Current.CancellationToken);
        Assert.Equal("1|4", summary);
        Assert.Equal(new byte[] { 27, 64, 65, 10 }, received);
    }

    [Fact]
    public async Task SendAndReceive_supports_hex_and_returns_all_response_formats()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var requestTask = ReplyAsync(listener, new byte[] { 6, 0, 255 });

        var result = await new V8Tcp().SendAndReceiveAsync(new
        {
            Host = "127.0.0.1",
            Port = port,
            Hex = "0x1B 0x40 41-0A",
            ConnectTimeout = 5,
            SendTimeout = 5,
            ReceiveTimeout = 5,
            MaxReceiveBytes = 32
        });

        var request = await requestTask.WaitAsync(TimeSpan.FromSeconds(5),
            TestContext.Current.CancellationToken);
        Assert.Equal(new byte[] { 27, 64, 65, 10 }, request);
        Assert.Equal(1, result.Code);

        var payload = JObject.FromObject(result.Data!);
        Assert.Equal(4, payload.Value<int>("BytesSent"));
        Assert.Equal(3, payload.Value<int>("BytesReceived"));
        Assert.Equal("BgD/", payload.Value<string>("ByteBase64"));
        Assert.Equal("0600FF", payload.Value<string>("Hex"));
        Assert.Equal("RemoteClosed", payload.Value<string>("ReceiveEndReason"));
        Assert.False(payload.Value<bool>("Truncated"));
        Assert.Equal(new byte[] { 6, 0, 255 }, payload["RawBytes"]!.ToObject<byte[]>());
    }

    [Fact]
    public void Send_rejects_ambiguous_or_out_of_range_payload_without_opening_socket()
    {
        var tcp = new V8Tcp();

        var ambiguous = tcp.Send(new
        {
            Host = "127.0.0.1",
            Port = 9100,
            Bytes = new[] { 1 },
            Hex = "01"
        });
        var invalidByte = tcp.Send(new
        {
            Host = "127.0.0.1",
            Port = 9100,
            Bytes = new[] { 256 }
        });

        Assert.Equal(0, ambiguous.Code);
        Assert.Contains("必须且只能提供一种", ambiguous.Msg);
        Assert.Equal(0, invalidByte.Code);
        Assert.Contains("0 到 255", invalidByte.Msg);
    }

    [Fact]
    public async Task Send_supports_base64_payload()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var serverTask = ReceiveExactlyAsync(listener, 3);

        var result = await new V8Tcp().SendAsync(new
        {
            Host = "127.0.0.1",
            Port = port,
            ByteBase64 = Convert.ToBase64String(new byte[] { 0, 127, 255 }),
            ConnectTimeout = 5,
            SendTimeout = 5
        });

        Assert.Equal(1, result.Code);
        Assert.Equal(new byte[] { 0, 127, 255 },
            await serverTask.WaitAsync(TimeSpan.FromSeconds(5),
                TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Send_supports_gb18030_text_for_network_receipt_printers()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        var expected = Encoding.GetEncoding(54936).GetBytes("吾码");
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var serverTask = ReceiveExactlyAsync(listener, expected.Length);

        var result = await new V8Tcp().SendAsync(new
        {
            Host = "127.0.0.1",
            Port = port,
            Text = "吾码",
            Encoding = "gb18030",
            ConnectTimeout = 5,
            SendTimeout = 5
        });

        Assert.Equal(1, result.Code);
        Assert.Equal(expected, await serverTask.WaitAsync(TimeSpan.FromSeconds(5),
            TestContext.Current.CancellationToken));
    }

    [Fact]
    public void Send_rejects_payload_above_hard_limit_before_connecting()
    {
        var result = new V8Tcp().Send(new
        {
            Host = "127.0.0.1",
            Port = 9100,
            Bytes = new byte[4 * 1024 * 1024 + 1]
        });

        Assert.Equal(0, result.Code);
        Assert.Contains("4 MiB", result.Msg);
    }

    [Fact]
    public async Task SendAndReceive_returns_partial_bytes_with_timeout_end_reason()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var serverTask = ReplyAndHoldOpenAsync(listener, new byte[] { 6 },
            TimeSpan.FromSeconds(2), TestContext.Current.CancellationToken);

        var result = await new V8Tcp().SendAndReceiveAsync(new
        {
            Host = "127.0.0.1",
            Port = port,
            Hex = "01",
            ConnectTimeout = 5,
            SendTimeout = 5,
            ReceiveTimeout = 1,
            MaxReceiveBytes = 32
        });

        Assert.Equal(1, result.Code);
        var payload = JObject.FromObject(result.Data!);
        Assert.Equal("Timeout", payload.Value<string>("ReceiveEndReason"));
        Assert.Equal("06", payload.Value<string>("Hex"));
        Assert.False(payload.Value<bool>("Truncated"));
        await serverTask.WaitAsync(TimeSpan.FromSeconds(5),
            TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task SendAndReceive_marks_response_truncated_at_max_receive_bytes()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        var requestTask = ReplyAsync(listener, Enumerable.Range(0, 16)
            .Select(value => (byte)value).ToArray());

        var result = await new V8Tcp().SendAndReceiveAsync(new
        {
            Host = "127.0.0.1",
            Port = port,
            Hex = "01",
            ConnectTimeout = 5,
            SendTimeout = 5,
            ReceiveTimeout = 5,
            MaxReceiveBytes = 4
        });

        await requestTask.WaitAsync(TimeSpan.FromSeconds(5),
            TestContext.Current.CancellationToken);
        Assert.Equal(1, result.Code);
        var payload = JObject.FromObject(result.Data!);
        Assert.Equal(4, payload.Value<int>("BytesReceived"));
        Assert.Equal("MaxReceiveBytes", payload.Value<string>("ReceiveEndReason"));
        Assert.True(payload.Value<bool>("Truncated"));
        Assert.Equal("00010203", payload.Value<string>("Hex"));
    }

    private static async Task<byte[]> ReceiveExactlyAsync(TcpListener listener, int length)
    {
        using var client = await listener.AcceptTcpClientAsync();
        using var stream = client.GetStream();
        var bytes = new byte[length];
        var offset = 0;
        while (offset < bytes.Length)
        {
            var read = await stream.ReadAsync(bytes.AsMemory(offset));
            if (read == 0) break;
            offset += read;
        }
        return bytes[..offset];
    }

    private static async Task<byte[]> ReplyAsync(TcpListener listener, byte[] response)
    {
        using var client = await listener.AcceptTcpClientAsync();
        using var stream = client.GetStream();
        var buffer = new byte[64];
        var read = await stream.ReadAsync(buffer);
        await stream.WriteAsync(response);
        await stream.FlushAsync();
        client.Close();
        return buffer[..read];
    }

    private static async Task ReplyAndHoldOpenAsync(TcpListener listener, byte[] response,
        TimeSpan holdOpen, CancellationToken cancellationToken)
    {
        using var client = await listener.AcceptTcpClientAsync(cancellationToken);
        using var stream = client.GetStream();
        var request = new byte[1];
        await stream.ReadExactlyAsync(request, cancellationToken);
        await stream.WriteAsync(response, cancellationToken);
        await stream.FlushAsync(cancellationToken);
        await Task.Delay(holdOpen, cancellationToken);
    }
}
