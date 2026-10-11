using System.Buffers.Binary;
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
    /// </summary>
    public static bool TryDecodeResponse(
        object? result, ReadOnlySpan<byte> request, TcpIngressRule rule, out byte[] response)
    {
        response = Array.Empty<byte>();
        if (result == null || rule == null) return false;
        JObject value;
        try { value = result is JObject json ? json : JObject.FromObject(result); }
        catch { return false; }
        var responseHex = (value["Data"] as JObject)?["ResponseFrameHex"]?.Value<string>();
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
        var headerLength = Math.Min(buffer.Length, rule.RequestHeader.Length);
        if (!buffer[..headerLength].SequenceEqual(rule.RequestHeader.AsSpan(0, headerLength)))
        {
            error = "请求帧头无效。";
            return TcpIngressFrameReadStatus.Invalid;
        }
        if (buffer.Length < rule.LengthOffset + 2)
            return TcpIngressFrameReadStatus.NeedMore;

        var declaredLength = BinaryPrimitives.ReadUInt16BigEndian(buffer.Slice(rule.LengthOffset, 2));
        totalLength = declaredLength + rule.LengthAdjustment;
        var minimum = Math.Max(
            Math.Max(rule.RequestHeader.Length, rule.LengthOffset + 2),
            rule.CorrelationOffset + rule.CorrelationLength) + rule.Tail.Length + 2;
        if (totalLength < minimum || totalLength > rule.MaxFrameBytes)
        {
            error = "请求帧长度超出允许范围。";
            return TcpIngressFrameReadStatus.Invalid;
        }
        if (buffer.Length < totalLength)
            return TcpIngressFrameReadStatus.NeedMore;
        if (!ValidateRequest(buffer[..totalLength], rule))
        {
            error = "请求帧 CRC 或帧尾无效。";
            return TcpIngressFrameReadStatus.Invalid;
        }
        return TcpIngressFrameReadStatus.Complete;
    }

    public static bool ValidateRequest(ReadOnlySpan<byte> frame, TcpIngressRule rule) =>
        ValidateFrame(frame, rule, rule.RequestHeader);

    public static bool ValidateResponse(
        ReadOnlySpan<byte> response, ReadOnlySpan<byte> request, TcpIngressRule rule)
    {
        if (!ValidateRequest(request, rule)
            || !ValidateFrame(response, rule, rule.ResponseHeader)
            || response.Length < rule.CorrelationOffset + rule.CorrelationLength)
            return false;
        return response.Slice(rule.CorrelationOffset, rule.CorrelationLength)
            .SequenceEqual(request.Slice(rule.CorrelationOffset, rule.CorrelationLength));
    }

    public static ushort Crc16Xmodem(ReadOnlySpan<byte> bytes)
    {
        ushort crc = 0;
        foreach (var value in bytes)
        {
            crc ^= (ushort)(value << 8);
            for (var bit = 0; bit < 8; bit++)
                crc = (ushort)((crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1);
        }
        return crc;
    }

    private static bool ValidateFrame(
        ReadOnlySpan<byte> frame, TcpIngressRule rule, ReadOnlySpan<byte> header)
    {
        var minimum = Math.Max(
            Math.Max(header.Length, rule.LengthOffset + 2),
            rule.CorrelationOffset + rule.CorrelationLength) + rule.Tail.Length + 2;
        if (frame.Length < minimum || frame.Length > rule.MaxFrameBytes
            || !frame.StartsWith(header) || !frame.EndsWith(rule.Tail))
            return false;
        var declaredLength = BinaryPrimitives.ReadUInt16BigEndian(frame.Slice(rule.LengthOffset, 2));
        if (declaredLength + rule.LengthAdjustment != frame.Length) return false;
        var crcOffset = frame.Length - rule.Tail.Length - 2;
        var expected = BinaryPrimitives.ReadUInt16BigEndian(frame.Slice(crcOffset, 2));
        return expected == Crc16Xmodem(frame[..crcOffset]);
    }
}
