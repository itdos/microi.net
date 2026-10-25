using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.net
{
    /// <summary>
    /// 公开热点资源证明的内部协议原子，尚未注册到宿主、V8 或 HTTP。
    /// 后续仅由受保护的 sys_osclients 配置注入用途隔离的密钥；普通接口引擎不得持有此实例。
    /// 认证只证明可信发行者背书，不能把普通表字段或请求参数自动升级为真实采集/副本/健康事实。
    /// </summary>
    internal sealed class ManagedPublicResourceReceiptCodec : IDisposable
    {
        private const string WireVersion = "mfr1";
        private const string Purpose = "Microi.ManagedPublicResourceRoute.receipt.v1";
        private const int MaxWireLength = 16384;
        private const int MaxPayloadLength = 8192;
        private const int MaxStringBytes = 4096;
        private static readonly Encoding StrictUtf8 = new UTF8Encoding(false, true);
        private readonly string keyId;
        private readonly object keyGate = new object();
        private byte[] key;

        internal ManagedPublicResourceReceiptCodec(string keyId, byte[] purposeIsolatedKey)
        {
            if (keyId == null || !Regex.IsMatch(keyId, @"\A[A-Za-z0-9_-]{1,64}\z", RegexOptions.CultureInvariant))
                throw new ArgumentException("Invalid receipt key identifier.", nameof(keyId));
            if (purposeIsolatedKey == null || purposeIsolatedKey.Length < 32 || purposeIsolatedKey.Length > 128)
                throw new ArgumentException("A purpose-isolated 256-bit or stronger receipt key is required.", nameof(purposeIsolatedKey));
            this.keyId = keyId;
            key = (byte[])purposeIsolatedKey.Clone();
        }

        /// <summary>
        /// 仅供未来可信后端发行者调用。发行者必须先独立核对权威公开版本、完整流量覆盖、
        /// 精选复制后的 SHA/大小及严格 HTTPS 健康；禁止将普通 V8 提交的事实直接签发。
        /// 当前无生产调用者，也不提供密钥加载、采集或复制能力。
        /// </summary>
        internal string IssueForTrustedProducer(ManagedPublicResourceEvidence evidence)
        {
            if (key == null) throw new ObjectDisposedException(nameof(ManagedPublicResourceReceiptCodec));
            if (evidence == null) throw new ArgumentNullException(nameof(evidence));
            byte[] payload;
            using (var stream = new MemoryStream())
            using (var writer = new BinaryWriter(stream, StrictUtf8, true))
            {
                WriteString(writer, evidence.Tenant);
                WriteString(writer, evidence.SourceTenant);
                WriteString(writer, evidence.ResourceId);
                WriteString(writer, evidence.SourceRevision);
                WriteString(writer, evidence.ObjectKey);
                WriteString(writer, evidence.DeliveryScope);
                WriteString(writer, evidence.ContentHash);
                writer.Write(evidence.Size);
                WriteString(writer, evidence.TargetConfigHash);
                WriteString(writer, evidence.Metric);
                WriteString(writer, evidence.CoverageScope);
                writer.Write(evidence.CoverageComplete);
                writer.Write(evidence.WindowStartUtc);
                writer.Write(evidence.WindowEndUtc);
                writer.Write(evidence.ObservedThroughUtc);
                writer.Write(evidence.CollectedAtUtc);
                writer.Write(evidence.TrafficFreshUntilUtc);
                writer.Write(evidence.ActualBytes);
                WriteString(writer, evidence.ReplicaSha256);
                WriteString(writer, evidence.ReplicaObjectKey);
                writer.Write(evidence.ReplicaWriteOnceVerified);
                writer.Write(evidence.ReplicaSize);
                writer.Write(evidence.ReplicaVerifiedAtUtc);
                writer.Write(evidence.StrictTls);
                writer.Write(evidence.AnonymousReadVerified);
                writer.Write(evidence.HealthVerifiedAtUtc);
                writer.Write(evidence.HealthValidUntilUtc);
                writer.Write(evidence.IssuedAtUtc);
                writer.Write(evidence.ExpiresAtUtc);
                writer.Flush();
                if (stream.Length > MaxPayloadLength) throw new ArgumentException("Receipt payload exceeds protocol limits.", nameof(evidence));
                payload = stream.ToArray();
            }
            var body = WireVersion + "." + keyId + "." + Encode(payload);
            var mac = Authenticate(body);
            if (mac == null) throw new ObjectDisposedException(nameof(ManagedPublicResourceReceiptCodec));
            return body + "." + Encode(mac);
        }

        internal bool TryRead(string receipt, out ManagedPublicResourceEvidence evidence)
        {
            evidence = null;
            if (key == null || string.IsNullOrEmpty(receipt) || receipt.Length > MaxWireLength) return false;
            var parts = receipt.Split('.');
            if (parts.Length != 4 || parts[0] != WireVersion || parts[1] != keyId
                || !TryDecode(parts[2], MaxPayloadLength, out var payload)
                || !TryDecode(parts[3], 32, out var suppliedMac) || suppliedMac.Length != 32) return false;
            var body = parts[0] + "." + parts[1] + "." + parts[2];
            var expectedMac = Authenticate(body);
            if (expectedMac == null || !CryptographicOperations.FixedTimeEquals(expectedMac, suppliedMac)) return false;
            try
            {
                using (var stream = new MemoryStream(payload, false))
                using (var reader = new BinaryReader(stream, StrictUtf8, true))
                {
                    var value = new ManagedPublicResourceEvidence
                    {
                        Tenant = ReadString(reader), SourceTenant = ReadString(reader), ResourceId = ReadString(reader),
                        SourceRevision = ReadString(reader), ObjectKey = ReadString(reader), DeliveryScope = ReadString(reader), ContentHash = ReadString(reader),
                        Size = reader.ReadInt64(), TargetConfigHash = ReadString(reader), Metric = ReadString(reader),
                        CoverageScope = ReadString(reader), CoverageComplete = ReadBoolean(reader),
                        WindowStartUtc = reader.ReadInt64(), WindowEndUtc = reader.ReadInt64(), ObservedThroughUtc = reader.ReadInt64(),
                        CollectedAtUtc = reader.ReadInt64(), TrafficFreshUntilUtc = reader.ReadInt64(), ActualBytes = reader.ReadInt64(),
                        ReplicaSha256 = ReadString(reader), ReplicaObjectKey = ReadString(reader), ReplicaWriteOnceVerified = ReadBoolean(reader),
                        ReplicaSize = reader.ReadInt64(), ReplicaVerifiedAtUtc = reader.ReadInt64(),
                        StrictTls = ReadBoolean(reader), AnonymousReadVerified = ReadBoolean(reader),
                        HealthVerifiedAtUtc = reader.ReadInt64(), HealthValidUntilUtc = reader.ReadInt64(),
                        IssuedAtUtc = reader.ReadInt64(), ExpiresAtUtc = reader.ReadInt64()
                    };
                    if (stream.Position != stream.Length) return false;
                    evidence = value;
                    return true;
                }
            }
            catch (Exception error) when (error is IOException || error is InvalidDataException || error is ArgumentException || error is OverflowException)
            {
                return false;
            }
        }

        public void Dispose()
        {
            lock (keyGate)
            {
                var ownedKey = key;
                key = null;
                if (ownedKey != null) CryptographicOperations.ZeroMemory(ownedKey);
            }
        }

        private byte[] Authenticate(string body)
        {
            lock (keyGate)
            {
                if (key == null) return null;
                using (var hmac = new HMACSHA256(key))
                    return hmac.ComputeHash(StrictUtf8.GetBytes(Purpose + "\n" + body));
            }
        }

        private static void WriteString(BinaryWriter writer, string value)
        {
            var bytes = StrictUtf8.GetBytes(value ?? string.Empty);
            if (bytes.Length > MaxStringBytes) throw new ArgumentException("Receipt field exceeds protocol limits.");
            writer.Write(bytes.Length);
            writer.Write(bytes);
        }

        private static string ReadString(BinaryReader reader)
        {
            var length = reader.ReadInt32();
            if (length < 0 || length > MaxStringBytes || length > reader.BaseStream.Length - reader.BaseStream.Position)
                throw new InvalidDataException("Invalid receipt field length.");
            return StrictUtf8.GetString(reader.ReadBytes(length));
        }

        private static bool ReadBoolean(BinaryReader reader)
        {
            var value = reader.ReadByte();
            if (value > 1) throw new InvalidDataException("Invalid receipt boolean.");
            return value == 1;
        }

        private static string Encode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        private static bool TryDecode(string encoded, int maxBytes, out byte[] bytes)
        {
            bytes = null;
            if (string.IsNullOrEmpty(encoded) || encoded.Length > (maxBytes * 4 + 2) / 3
                || !Regex.IsMatch(encoded, @"\A[A-Za-z0-9_-]+\z", RegexOptions.CultureInvariant)) return false;
            try
            {
                var padded = encoded.Replace('-', '+').Replace('_', '/');
                padded = padded.PadRight((padded.Length + 3) / 4 * 4, '=');
                var decoded = Convert.FromBase64String(padded);
                if (decoded.Length > maxBytes || Encode(decoded) != encoded) return false;
                bytes = decoded;
                return true;
            }
            catch (FormatException) { return false; }
        }
    }
}
