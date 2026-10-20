using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

public enum TcpIngressFrameReadStatus
{
    NeedMore,
    Complete,
    Invalid
}

/// <summary>
/// TCP 是字节流，不保留设备上报边界；先按有界长度拆帧，再验证帧头、CRC 和帧尾。
/// 回包还必须与请求中的设备号和命令号关联，禁止把其它请求的 ACK 写到本连接。
/// </summary>
public static class TcpIngressFrameCodec
{
    /// <summary>
    /// 接口引擎 Code=0 也可能含协议规定的失败 ACK，故只以 Data.ResponseFrameHex
    /// 及帧完整性/关联性决定能否回包，不把业务 Code 当二进制链路状态。
    /// 唯一的免应答例外是配置允许且 Code=1/Data.ResponseMode=None；成功返回空数组表示零字节写入。
    /// </summary>
    public static bool TryDecodeResponse(
        object? result, ReadOnlySpan<byte> request, TcpIngressRule rule, out byte[] response)
    {
        response = Array.Empty<byte>();
        if (result == null || rule == null) return false;
        JObject value;
        try { value = result is JObject json ? json : JObject.FromObject(result); }
        catch { return false; }
        var data = value["Data"] as JObject;
        var mode = data?["ResponseMode"];
        if (mode != null)
        {
            if (mode.Type != JTokenType.String) return false;
            if (mode.Value<string>() == "None")
            {
                // 显式 None 与应答帧互斥；失败、空返回、未知模式或坏物理帧绝不能被伪装成已处理。
                var code = value["Code"];
                return rule.AllowNoResponse && (code?.Type is JTokenType.Integer or JTokenType.Float)
                    && code.Value<double>() == 1 && data?["ResponseFrameHex"] == null
                    && ValidateRequest(request, rule);
            }
            if (mode.Value<string>() != "Reply") return false;
        }
        var responseHex = data?["ResponseFrameHex"]?.Value<string>();
        if (string.IsNullOrWhiteSpace(responseHex)
            || responseHex.Length > rule.MaxFrameBytes * 2
            || (responseHex.Length & 1) != 0)
            return false;
        try { response = Convert.FromHexString(responseHex); }
        catch (FormatException) { return false; }
        if (ValidateResponse(response, request, rule)) return true;
        response = Array.Empty<byte>();
        return false;
    }

    public static TcpIngressFrameReadStatus TryReadFrame(
        ReadOnlySpan<byte> buffer, TcpIngressRule rule, out int totalLength, out string error)
    {
        totalLength = 0;
        error = string.Empty;
        if (rule == null)
        {
            error = "规则不能为空。";
            return TcpIngressFrameReadStatus.Invalid;
        }
        totalLength = rule.RequestPolicy.ReadLength(buffer);
        if (totalLength < 0)
        {
            error = "请求帧长度超出允许范围。";
            return TcpIngressFrameReadStatus.Invalid;
        }
        if (totalLength == 0)
            return TcpIngressFrameReadStatus.NeedMore;
        if (!ValidateRequest(buffer[..totalLength], rule))
        {
            error = "请求帧 CRC 或帧尾无效。";
            return TcpIngressFrameReadStatus.Invalid;
        }
        return TcpIngressFrameReadStatus.Complete;
    }

    public static bool ValidateRequest(ReadOnlySpan<byte> frame, TcpIngressRule rule) =>
        frame.Length >= rule.CorrelationOffset + rule.CorrelationLength + rule.Tail.Length + rule.RequestPolicy.ChecksumBytes
        && rule.RequestPolicy.Validate(frame);

    public static bool ValidateResponse(
        ReadOnlySpan<byte> response, ReadOnlySpan<byte> request, TcpIngressRule rule)
    {
        if (!ValidateRequest(request, rule)
            || !rule.ResponsePolicy.Validate(response)
            || response.Length < rule.CorrelationOffset + rule.CorrelationLength + rule.Tail.Length + rule.ResponsePolicy.ChecksumBytes)
            return false;
        return response.Slice(rule.CorrelationOffset, rule.CorrelationLength)
            .SequenceEqual(request.Slice(rule.CorrelationOffset, rule.CorrelationLength));
    }

    public static ushort Crc16Xmodem(ReadOnlySpan<byte> bytes)
    {
        return TcpFramePolicy.ComputeChecksum(bytes, "Crc16Xmodem");
    }
}
