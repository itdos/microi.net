using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

/// <summary>
/// 原始 TCP 入站仅从主租户的受保护配置加载。设备字节不能选择租户、接口引擎或端口。
/// 空规则/明确禁用不监听；非空规则缺项或损坏时只使 TCP 入站故障关闭并记日志，HTTP API 保持运行。
/// </summary>
public static class TcpIngressRules
{
    public const int DefaultListenPort = 1885;
    private static readonly Regex ApiEngineKeyPattern = new(
        "^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$", RegexOptions.CultureInvariant);

    public static TcpIngressRule? Parse(string? json, JToken? configuredPort = null)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        JObject value;
        try { value = JObject.Parse(json); }
        catch (Exception ex) { throw new InvalidOperationException("TcpIngressRulesJson 不是有效 JSON 对象。", ex); }

        if (value["enabled"] != null)
            throw new InvalidOperationException("TCP 启停只能配置在主租户 TcpIngressEnable 字段，不得重复写入规则 JSON。");
        if (value["listenPort"] != null)
            throw new InvalidOperationException("TCP 监听端口只能配置在主租户 TcpIngressPort 字段，不得重复写入规则 JSON。");
        var osClient = RequireText(value, "osClient", 128);
        try { osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient); }
        catch (Exception ex) { throw new InvalidOperationException("TcpIngressRulesJson.osClient 无效。", ex); }
        var apiEngineKey = RequireText(value, "apiEngineKey", 128);
        if (!ApiEngineKeyPattern.IsMatch(apiEngineKey))
            throw new InvalidOperationException("TcpIngressRulesJson.apiEngineKey 无效。");

        var listenPort = ParsePort(configuredPort);
        var maxFrameBytes = ReadInt(value, "maxFrameBytes", 4096, value["framing"] == null ? 20 : 1, 65535);
        var maxConnections = ReadInt(value, "maxConnections", 100, 1, 1000);
        var idleTimeoutSeconds = ReadInt(value, "idleTimeoutSeconds", 90, 10, 3600);
        var executionTimeoutSeconds = ReadInt(value, "executionTimeoutSeconds", 5, 1, 120);
        var maxQueuedFrames = ReadInt(value, "maxQueuedFramesPerConnection", 8, 1, 32);
        // 缺失响应默认仍关闭连接；仅管理员明确启用，且内部引擎逐帧声明 None，才允许无需再应答的消息。
        if (value["allowNoResponse"] != null && value["allowNoResponse"]!.Type != JTokenType.Boolean)
            throw new InvalidOperationException("TcpIngressRulesJson.allowNoResponse 必须为布尔值。");
        var allowNoResponse = value.Value<bool?>("allowNoResponse") == true;
        // 每条连接都会分配接收缓冲。不能让合法但极端的三个上限相乘耗尽 API 内存。
        var perConnectionBytes = (long)maxFrameBytes * maxQueuedFrames;
        if (perConnectionBytes > 256 * 1024
            || perConnectionBytes * maxConnections > 32L * 1024 * 1024)
            throw new InvalidOperationException("TcpIngressRulesJson 接收缓冲总预算超限（单连接 256 KiB、全节点 32 MiB）。");
        TcpFramePolicy requestPolicy;
        TcpFramePolicy responsePolicy;
        try
        {
            requestPolicy = TcpFramePolicy.Parse(value, false);
            responsePolicy = TcpFramePolicy.Parse(value, true);
        }
        catch (ArgumentException ex) { throw new InvalidOperationException(ex.Message, ex); }
        var lengthOffset = requestPolicy.LengthOffset;
        var lengthAdjustment = requestPolicy.LengthAdjustment;
        var correlationOffset = ReadRequiredInt(value, "correlationOffset", 0, 128);
        var correlationLength = ReadRequiredInt(value, "correlationLength", 1, 64);
        var requestHeader = requestPolicy.Header;
        var responseHeader = responsePolicy.Header;
        var tail = requestPolicy.Tail;
        var downlink = IoTDownlinkPolicy.Parse(value);
        if (correlationOffset + correlationLength + tail.Length + requestPolicy.ChecksumBytes > maxFrameBytes)
            throw new InvalidOperationException("TcpIngressRulesJson 帧偏移与长度上限不兼容。");
        if (new[] { requestPolicy, responsePolicy }.Any(p => p.Mode == "FixedLength"
                && correlationOffset + correlationLength + p.Tail.Length + p.ChecksumBytes > p.FixedLength))
            throw new InvalidOperationException("固定帧长无法容纳应答关联区间。");

        if (value["allowedCidrs"] is not JArray allowed || allowed.Count == 0 || allowed.Count > 64)
            throw new InvalidOperationException("TcpIngressRulesJson.allowedCidrs 必须包含 1 至 64 个来源网段。");
        if (value["allowAnySource"] != null && value["allowAnySource"]!.Type != JTokenType.Boolean)
            throw new InvalidOperationException("TcpIngressRulesJson.allowAnySource 必须为布尔值。");
        var allowAnySource = value.Value<bool?>("allowAnySource") == true;
        // 兼容已部署规则中的显式全网例外；不因增加下行能力放宽默认来源限制或允许混合网段。
        if (allowAnySource && (allowed.Count != 1 || allowed[0]?.Type != JTokenType.String
            || allowed[0]!.Value<string>() != "0.0.0.0/0"))
            throw new InvalidOperationException("allowAnySource=true 时 allowedCidrs 必须且只能为 [\"0.0.0.0/0\"]。");
        var cidrs = allowed.Select(item => TcpIngressCidr.Parse(item.Type == JTokenType.String
                ? item.Value<string>() : null, allowAnySource))
            .ToArray();

        return new TcpIngressRule(
            osClient, apiEngineKey, listenPort, cidrs, requestHeader, responseHeader, tail,
            lengthOffset, lengthAdjustment, correlationOffset, correlationLength,
            maxFrameBytes, maxConnections, idleTimeoutSeconds, executionTimeoutSeconds,
            maxQueuedFrames, downlink, requestPolicy, responsePolicy, allowNoResponse);
    }

    public static int ParsePort(JToken? configuredPort)
    {
        if (configuredPort == null || configuredPort.Type is JTokenType.Null or JTokenType.Undefined
            || (configuredPort.Type == JTokenType.String
                && string.IsNullOrWhiteSpace(configuredPort.Value<string>())))
            return DefaultListenPort;
        if (configuredPort.Type is not (JTokenType.Integer or JTokenType.String)
            || !int.TryParse(configuredPort.ToString().Trim(), NumberStyles.None,
                CultureInfo.InvariantCulture, out var port)
            || port is < 1 or > 65535)
            throw new InvalidOperationException("主租户 TcpIngressPort 必须是 1 至 65535 的整数。");
        return port;
    }

    public static bool ParseEnable(JToken? configuredEnable)
    {
        if (configuredEnable == null
            || configuredEnable.Type is JTokenType.Null or JTokenType.Undefined
            || (configuredEnable.Type == JTokenType.String
                && string.IsNullOrWhiteSpace(configuredEnable.Value<string>())))
            return true;
        if (configuredEnable.Type is not (JTokenType.Integer or JTokenType.String)
            || !int.TryParse(configuredEnable.ToString().Trim(), NumberStyles.None,
                CultureInfo.InvariantCulture, out var enabled)
            || enabled is not (0 or 1))
            throw new InvalidOperationException("主租户 TcpIngressEnable 只能为空、0 或 1。");
        return enabled == 1;
    }

    private static string RequireText(JObject value, string name, int maxLength)
    {
        var text = value[name]?.Type == JTokenType.String ? value[name]!.Value<string>()?.Trim() : null;
        if (string.IsNullOrWhiteSpace(text) || text.Length > maxLength || text.Any(char.IsControl))
            throw new InvalidOperationException($"TcpIngressRulesJson.{name} 缺失或无效。");
        return text;
    }

    private static int ReadInt(JObject value, string name, int defaultValue, int min, int max)
    {
        var token = value[name];
        if (token == null) return defaultValue;
        if (token.Type != JTokenType.Integer || !int.TryParse(token.ToString(), out var number)
            || number < min || number > max)
            throw new InvalidOperationException($"TcpIngressRulesJson.{name} 超出允许范围 {min}-{max}。");
        return number;
    }

    private static int ReadRequiredInt(JObject value, string name, int min, int max)
    {
        if (value[name] == null)
            throw new InvalidOperationException($"TcpIngressRulesJson.{name} 必须明确配置。");
        return ReadInt(value, name, 0, min, max);
    }

    private static byte[] ReadHex(JObject value, string name, int requiredBytes)
    {
        var text = RequireText(value, name, requiredBytes * 2);
        if (text.Length != requiredBytes * 2)
            throw new InvalidOperationException($"TcpIngressRulesJson.{name} 必须是 {requiredBytes} 字节十六进制。");
        try { return Convert.FromHexString(text); }
        catch (FormatException ex) { throw new InvalidOperationException($"TcpIngressRulesJson.{name} 不是十六进制。", ex); }
    }
}

/// <summary>已验证的单端口、单租户、单接口引擎 TCP 入站规则。</summary>
public sealed class TcpIngressRule
{
    internal TcpIngressRule(string osClient, string apiEngineKey, int listenPort,
        IReadOnlyList<TcpIngressCidr> allowedCidrs, byte[] requestHeader, byte[] responseHeader,
        byte[] tail, int lengthOffset, int lengthAdjustment, int correlationOffset,
        int correlationLength, int maxFrameBytes, int maxConnections, int idleTimeoutSeconds,
        int executionTimeoutSeconds, int maxQueuedFramesPerConnection, IoTDownlinkPolicy? downlink = null,
        TcpFramePolicy? requestPolicy = null, TcpFramePolicy? responsePolicy = null, bool allowNoResponse = false)
    {
        OsClient = osClient;
        ApiEngineKey = apiEngineKey;
        ListenPort = listenPort;
        AllowedCidrs = allowedCidrs;
        RequestHeader = requestHeader;
        ResponseHeader = responseHeader;
        Tail = tail;
        LengthOffset = lengthOffset;
        LengthAdjustment = lengthAdjustment;
        CorrelationOffset = correlationOffset;
        CorrelationLength = correlationLength;
        MaxFrameBytes = maxFrameBytes;
        MaxConnections = maxConnections;
        IdleTimeoutSeconds = idleTimeoutSeconds;
        ExecutionTimeoutSeconds = executionTimeoutSeconds;
        MaxQueuedFramesPerConnection = maxQueuedFramesPerConnection;
        Downlink = downlink;
        RequestPolicy = requestPolicy!;
        ResponsePolicy = responsePolicy!;
        AllowNoResponse = allowNoResponse;
    }

    public string OsClient { get; }
    public string ApiEngineKey { get; }
    public int ListenPort { get; }
    public byte[] RequestHeader { get; }
    public byte[] ResponseHeader { get; }
    public byte[] Tail { get; }
    public int LengthOffset { get; }
    public int LengthAdjustment { get; }
    public int CorrelationOffset { get; }
    public int CorrelationLength { get; }
    public int MaxFrameBytes { get; }
    public int MaxConnections { get; }
    public int IdleTimeoutSeconds { get; }
    public int ExecutionTimeoutSeconds { get; }
    public int MaxQueuedFramesPerConnection { get; }
    public IoTDownlinkPolicy? Downlink { get; }
    public TcpFramePolicy RequestPolicy { get; }
    public TcpFramePolicy ResponsePolicy { get; }
    public bool AllowNoResponse { get; }
    internal IReadOnlyList<TcpIngressCidr> AllowedCidrs { get; }

    public bool IsAllowed(IPAddress address) => AllowedCidrs.Any(cidr => cidr.Contains(address));
}

internal sealed class TcpIngressCidr
{
    private readonly byte[] _network;
    private readonly int _prefix;

    private TcpIngressCidr(byte[] network, int prefix)
    {
        _network = network;
        _prefix = prefix;
    }

    internal static TcpIngressCidr Parse(string? text, bool allowDefaultRoute = false)
    {
        var parts = text?.Trim().Split('/', 2);
        if (parts == null || parts.Length == 0 || !parts[0].Contains('.')
            || !IPAddress.TryParse(parts[0], out var address)
            || address.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork)
            throw new InvalidOperationException("TcpIngressRulesJson.allowedCidrs 含无效 IP 地址。");
        // 当前监听器只绑定 IPv4；拒绝看似有效却永远不会命中的 IPv6 白名单。
        const int maxPrefix = 32;
        var prefix = maxPrefix;
        var minimumPrefix = allowDefaultRoute ? 0 : 8;
        if (parts.Length == 2 && (!int.TryParse(parts[1], out prefix)
                                  || prefix < minimumPrefix || prefix > maxPrefix))
            throw new InvalidOperationException("TcpIngressRulesJson.allowedCidrs 含无效前缀。");
        return new TcpIngressCidr(address.GetAddressBytes(), prefix);
    }

    internal bool Contains(IPAddress address)
    {
        address = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
        var bytes = address.GetAddressBytes();
        if (bytes.Length != _network.Length) return false;
        var fullBytes = _prefix / 8;
        for (var i = 0; i < fullBytes; i++)
            if (bytes[i] != _network[i]) return false;
        var remainingBits = _prefix % 8;
        if (remainingBits == 0) return true;
        var mask = (byte)(0xff << (8 - remainingBits));
        return (bytes[fullBytes] & mask) == (_network[fullBytes] & mask);
    }
}
