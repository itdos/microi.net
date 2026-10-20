using System;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 厂商无关的有界 TCP 帧描述。只负责字节边界和校验，不解释业务操作码或授权设备。
    /// 未提供 framing 时保留历史 U16BE/XMODEM 格式，显式配置才使用其它格式。
    /// </summary>
    public sealed class TcpFramePolicy
    {
        public string Mode { get; private set; }
        public byte[] Header { get; private set; }
        public byte[] Tail { get; private set; }
        public int LengthOffset { get; private set; }
        public int LengthBytes { get; private set; }
        public bool LittleEndian { get; private set; }
        public int LengthAdjustment { get; private set; }
        public int FixedLength { get; private set; }
        public string Checksum { get; private set; }
        public bool ChecksumLittleEndian { get; private set; }
        public int ChecksumStartOffset { get; private set; }
        public int MaxFrameBytes { get; private set; }
        public int ChecksumBytes => Checksum == "None" ? 0 : 2;
        public int MinimumLength => Math.Max(Header.Length, Mode == "LengthPrefix" ? LengthOffset + LengthBytes : 0)
            + Tail.Length + ChecksumBytes;

        public static TcpFramePolicy Parse(JObject root, bool response, JObject overrideOptions = null)
        {
            if (root["framing"] != null && !(root["framing"] is JObject))
                throw new ArgumentException("framing 必须为对象。");
            var options = overrideOptions ?? root["framing"] as JObject ?? new JObject();
            var extended = overrideOptions != null || root["framing"] != null;
            var policy = new TcpFramePolicy
            {
                Mode = Choice(options, "mode", "LengthPrefix", "LengthPrefix", "FixedLength", "Delimiter"),
                Header = ParseHex(root.Value<string>(response ? "responseHeaderHex" : "requestHeaderHex"), extended ? -1 : 4, 32),
                Tail = ParseHex(root.Value<string>("tailHex"), extended ? -1 : 2, 16),
                LengthOffset = IoTDownlinkPolicy.Number(root, "lengthOffset", extended ? 0 : -1, 0, extended ? 128 : 32),
                LengthBytes = IoTDownlinkPolicy.Number(options, "lengthBytes", 2, 1, 4),
                LittleEndian = Choice(options, "lengthByteOrder", "BigEndian", "BigEndian", "LittleEndian") == "LittleEndian",
                LengthAdjustment = IoTDownlinkPolicy.Number(root, "lengthAdjustment", extended ? 0 : -1, extended ? -65535 : 0, extended ? 65535 : 128),
                FixedLength = IoTDownlinkPolicy.Number(options, "fixedLength", 0, 0, 65535),
                Checksum = Choice(options, "checksum", "Crc16Xmodem", "Crc16Xmodem", "Crc16Modbus", "None"),
                ChecksumLittleEndian = Choice(options, "checksumByteOrder", "BigEndian", "BigEndian", "LittleEndian") == "LittleEndian",
                ChecksumStartOffset = IoTDownlinkPolicy.Number(options, "checksumStartOffset", 0, 0, 128),
                MaxFrameBytes = IoTDownlinkPolicy.Number(root, "maxFrameBytes", 4096, 1, 65535)
            };
            if (policy.LengthBytes == 3 || policy.MinimumLength > policy.MaxFrameBytes
                || (policy.Mode == "LengthPrefix" && policy.LengthOffset < policy.Header.Length)
                || (policy.Mode == "FixedLength" && (policy.FixedLength < Math.Max(1, policy.MinimumLength) || policy.FixedLength > policy.MaxFrameBytes))
                || (policy.Mode == "Delimiter" && policy.Tail.Length == 0))
                throw new ArgumentException("framing 的长度、帧头或结束符不兼容。");
            return policy;
        }

        /// <summary>返回 0 表示尚未收齐，-1 表示无效，其余为首帧长度；不会按报文长度申请内存。</summary>
        public int ReadLength(ReadOnlySpan<byte> buffer)
        {
            var prefix = Math.Min(buffer.Length, Header.Length);
            if (!buffer.Slice(0, prefix).SequenceEqual(Header.AsSpan(0, prefix))) return -1;
            long total;
            if (Mode == "LengthPrefix")
            {
                if (buffer.Length < LengthOffset + LengthBytes) return 0;
                long declared = 0;
                for (var i = 0; i < LengthBytes; i++)
                    declared = (declared << 8) | buffer[LengthOffset + (LittleEndian ? LengthBytes - 1 - i : i)];
                total = declared + LengthAdjustment;
            }
            else if (Mode == "FixedLength") total = FixedLength;
            else
            {
                // 结束符模式要求载荷已做转义，不能把载荷中的裸结束符当作可接受的粘包。
                var index = buffer.Slice(Math.Min(Header.Length, buffer.Length)).IndexOf(Tail);
                if (index < 0) return buffer.Length >= MaxFrameBytes ? -1 : 0;
                total = Header.Length + index + Tail.Length;
            }
            if (total < Math.Max(1, MinimumLength) || total > MaxFrameBytes) return -1;
            return buffer.Length < total ? 0 : (int)total;
        }

        public bool Validate(ReadOnlySpan<byte> frame)
        {
            if (ReadLength(frame) != frame.Length || frame.Length == 0 || !frame.EndsWith(Tail)) return false;
            var offset = frame.Length - Tail.Length - ChecksumBytes;
            if (ChecksumBytes == 0) return true;
            if (offset < ChecksumStartOffset) return false;
            var actual = ChecksumLittleEndian ? frame[offset] | frame[offset + 1] << 8 : frame[offset] << 8 | frame[offset + 1];
            return actual == ComputeChecksum(frame.Slice(ChecksumStartOffset, offset - ChecksumStartOffset), Checksum);
        }

        /// <summary>标准校验算法，参数由可信配置选择，设备业务报文仍由接口引擎形成。</summary>
        public static ushort ComputeChecksum(ReadOnlySpan<byte> bytes, string algorithm)
        {
            var modbus = algorithm == "Crc16Modbus";
            if (!modbus && algorithm != "Crc16Xmodem") throw new ArgumentException("不支持的校验算法。");
            var crc = modbus ? 0xffff : 0;
            foreach (var value in bytes)
            {
                crc ^= modbus ? value : value << 8;
                for (var bit = 0; bit < 8; bit++)
                    crc = modbus ? ((crc & 1) != 0 ? (crc >> 1) ^ 0xa001 : crc >> 1)
                        : (((crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff);
            }
            return (ushort)crc;
        }

        private static byte[] ParseHex(string text, int exact, int maximum)
        {
            if (text == null || text.Length % 2 != 0 || text.Length > maximum * 2 || (exact >= 0 && text.Length != exact * 2))
                throw new ArgumentException("帧头/帧尾必须明确提供允许长度的十六进制字符串。");
            return text.Length == 0 ? Array.Empty<byte>() : IoTDownlinkPolicy.Hex(text, text.Length / 2);
        }

        private static string Choice(JObject options, string name, string fallback, params string[] allowed)
        {
            if (options[name] == null) return fallback;
            if (options[name].Type != JTokenType.String || !allowed.Contains(options.Value<string>(name)))
                throw new ArgumentException("framing." + name + " 无效。");
            return options.Value<string>(name);
        }
    }
}
