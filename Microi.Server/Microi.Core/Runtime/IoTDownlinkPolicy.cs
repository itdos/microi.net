using System;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 由受保护的 TcpIngressRulesJson 加载的下行边界；没有 downlink 配置时保持原入站行为。
    /// 设备操作码与业务权限不进入本类型，帧结构仍受管理员选定的协议规则约束。
    /// </summary>
    public sealed class IoTDownlinkPolicy
    {
        public string OsClient { get; private set; }
        public string[] SendApiEngineKeys { get; private set; }
        public int DeviceOffset { get; private set; }
        public int DeviceLength { get; private set; }
        public int DownlinkDeviceOffset { get; private set; }
        public TcpFramePolicy FramePolicy { get; private set; }
        public TcpFramePolicy RequestFramePolicy { get; private set; }
        public int MaxPendingCommands { get; private set; }
        public int MaxExpireSeconds { get; private set; }
        public int DeduplicateSeconds { get; private set; }
        public int LeaseSeconds { get; private set; }
        public int PollIntervalMilliseconds { get; private set; }
        public int MaxFrameBytes { get; private set; }
        public int LengthOffset { get; private set; }
        public int LengthAdjustment { get; private set; }
        public byte[] ResponseHeader { get; private set; }
        public byte[] Tail { get; private set; }
        public string Fingerprint { get; private set; }

        public static IoTDownlinkPolicy Parse(JObject root)
        {
            if (root?["downlink"] == null) return null;
            if (!(root["downlink"] is JObject options)) throw new ArgumentException("downlink 必须是对象。");
            if (options["enabled"]?.Type != JTokenType.Boolean) throw new ArgumentException("downlink.enabled 必须显式配置布尔值。");
            if (!options.Value<bool>("enabled")) return null;
            var keys = options["sendApiEngineKeys"] as JArray;
            if (keys == null || keys.Count < 1 || keys.Count > 32
                || keys.Any(k => k.Type != JTokenType.String || !Regex.IsMatch(k.ToString(), @"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")))
                throw new ArgumentException("downlink.sendApiEngineKeys 必须明确列出 1 至 32 个允许发送的接口引擎 Key。");
            var policy = new IoTDownlinkPolicy
            {
                OsClient = TenantConfigurationSecurity.NormalizeTenantId(root.Value<string>("osClient")),
                SendApiEngineKeys = keys.Select(k => k.ToString()).Distinct(StringComparer.OrdinalIgnoreCase).ToArray(),
                DeviceOffset = Number(options, "deviceOffset", -1, 0, 128),
                DeviceLength = Number(options, "deviceLength", -1, 1, 32),
                MaxPendingCommands = Number(options, "maxPendingCommands", 32, 1, 128),
                MaxExpireSeconds = Number(options, "maxExpireSeconds", 120, 1, 600),
                DeduplicateSeconds = Number(options, "deduplicateSeconds", 86400, 600, 604800),
                LeaseSeconds = Number(options, "leaseSeconds", 30, 10, 120),
                PollIntervalMilliseconds = Number(options, "pollIntervalMilliseconds", 500, 100, 5000),
                MaxFrameBytes = Number(root, "maxFrameBytes", 4096, 1, 65535),
                FramePolicy = TcpFramePolicy.Parse(root, true),
                Fingerprint = Hash(root.ToString(Newtonsoft.Json.Formatting.None))
            };
            var incoming = TcpFramePolicy.Parse(root, false);
            policy.RequestFramePolicy = incoming;
            policy.DownlinkDeviceOffset = Number(options, "downlinkDeviceOffset", policy.DeviceOffset, 0, 128);
            policy.LengthOffset = policy.FramePolicy.LengthOffset;
            policy.LengthAdjustment = policy.FramePolicy.LengthAdjustment;
            policy.ResponseHeader = policy.FramePolicy.Header;
            policy.Tail = policy.FramePolicy.Tail;
            if (!ValidDeviceRegion(incoming, policy.DeviceOffset, policy.DeviceLength)
                || !ValidDeviceRegion(policy.FramePolicy, policy.DownlinkDeviceOffset, policy.DeviceLength)
                || (long)policy.MaxPendingCommands * policy.MaxFrameBytes > 512 * 1024
                || policy.PollIntervalMilliseconds * 3 >= policy.LeaseSeconds * 1000)
                throw new ArgumentException("downlink 的设备区域、队列预算或租约参数不兼容。");
            return policy;
        }

        private static bool ValidDeviceRegion(TcpFramePolicy frame, int offset, int length)
        {
            var end = offset + length;
            return offset >= frame.Header.Length
                && (frame.Mode != "LengthPrefix" || end <= frame.LengthOffset || offset >= frame.LengthOffset + frame.LengthBytes)
                && end + frame.Tail.Length + frame.ChecksumBytes <= (frame.Mode == "FixedLength" ? frame.FixedLength : frame.MaxFrameBytes);
        }

        /// <summary>DeviceId 是协议中设备地址的规范十六进制；业务记录 Id 由接口引擎映射。</summary>
        public string NormalizeDeviceId(string deviceId) => ToHex(Hex(deviceId, DeviceLength));

        public string ReadDeviceId(byte[] frame, bool downlink = false)
        {
            var offset = downlink ? DownlinkDeviceOffset : DeviceOffset;
            var format = downlink ? FramePolicy : RequestFramePolicy;
            if (frame == null || frame.Length < offset + DeviceLength + format.Tail.Length + format.ChecksumBytes)
                throw new ArgumentException("帧中缺少完整设备地址。");
            return ToHex(frame.Skip(offset).Take(DeviceLength).ToArray());
        }

        /// <summary>主动下行独立检查长度、CRC 和目标设备；不放宽原心跳 ACK 的命令关联校验。</summary>
        public byte[] ValidateDownlink(string deviceId, string frameHex)
        {
            if (string.IsNullOrEmpty(frameHex) || frameHex.Length > MaxFrameBytes * 2 || frameHex.Length % 2 != 0)
                throw new ArgumentException("FrameHex 长度无效。");
            var frame = Hex(frameHex, frameHex.Length / 2);
            var minimum = DownlinkDeviceOffset + DeviceLength + Tail.Length + FramePolicy.ChecksumBytes;
            if (frame.Length < minimum || !FramePolicy.Validate(frame)
                || !string.Equals(ReadDeviceId(frame, true), NormalizeDeviceId(deviceId), StringComparison.Ordinal))
                throw new ArgumentException("下行帧结构或目标设备不匹配。");
            return frame;
        }

        internal static int Number(JObject value, string name, int fallback, int min, int max)
        {
            var token = value[name];
            // Jint 的 JS Number 经 CLR/JSON 转换后可能成为 30.0，仍应按整数接收；拒绝小数、字符串和非有限值。
            var number = (double)fallback;
            if (token != null)
            {
                if (token.Type != JTokenType.Integer && token.Type != JTokenType.Float)
                    throw new ArgumentException(name + " 必须为整数。");
                number = token.Value<double>();
                if (double.IsNaN(number) || double.IsInfinity(number) || Math.Truncate(number) != number)
                    throw new ArgumentException(name + " 必须为有限整数。");
            }
            if (number < min || number > max) throw new ArgumentException(name + " 超出允许范围。");
            return (int)number;
        }

        internal static byte[] Hex(string text, int bytes)
        {
            if (text == null || text.Length != bytes * 2 || !Regex.IsMatch(text, @"\A[0-9a-fA-F]+\z"))
                throw new ArgumentException("必须提供定长、无分隔符的十六进制。");
            return Enumerable.Range(0, bytes).Select(i => byte.Parse(text.Substring(i * 2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture)).ToArray();
        }

        internal static string ToHex(byte[] bytes) => BitConverter.ToString(bytes).Replace("-", "");
        internal static string Hash(string value)
        {
            using (var sha = SHA256.Create()) return ToHex(sha.ComputeHash(Encoding.UTF8.GetBytes(value)));
        }

    }
}
