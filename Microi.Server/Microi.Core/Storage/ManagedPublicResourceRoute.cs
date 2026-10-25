using System;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.net
{
    /// <summary>
    /// 公开资源路由的可信后端输入；不能从 HTTP/V8 参数直接反序列化后用于决策。
    /// 当前切片不注册消费者。后续宿主必须从当前租户主库权威版本和配置构造此对象。
    /// </summary>
    internal sealed class ManagedPublicResourceContext
    {
        internal string Tenant { get; set; }
        internal string SourceTenant { get; set; }
        internal string ResourceId { get; set; }
        internal string SourceRevision { get; set; }
        internal string ObjectKey { get; set; }
        internal string DeliveryScope { get; set; }
        internal string ContentHash { get; set; }
        internal long Size { get; set; }
        internal bool IsAuthoritativePublicVersion { get; set; }
        internal bool Enabled { get; set; }
        internal string OriginalUrl { get; set; }
        internal string FileServer { get; set; }
        internal string FileServerBak { get; set; }
        // 由可信后端目标存储绑定提供，不能从租户名或 FileServerBak 主机名猜测。
        internal string BackupPublicBucket { get; set; }
        internal decimal? FileServerBakThresholdGiB { get; set; }
        internal int FileServerBakWindowHours { get; set; } = 24;
    }

    /// <summary>
    /// 由未来可信采集/复制发行者共同核实的事实载荷。普通表中的 Ready/Bytes 不能替代其认证收据。
    /// 此类型及签发器不暴露给 V8，也不读取配置、表、网络或凭据。
    /// </summary>
    internal sealed class ManagedPublicResourceEvidence
    {
        internal string Tenant { get; set; }
        internal string SourceTenant { get; set; }
        internal string ResourceId { get; set; }
        internal string SourceRevision { get; set; }
        internal string ObjectKey { get; set; }
        internal string DeliveryScope { get; set; }
        internal string ContentHash { get; set; }
        internal long Size { get; set; }
        internal string TargetConfigHash { get; set; }
        internal string Metric { get; set; }
        internal string CoverageScope { get; set; }
        internal bool CoverageComplete { get; set; }
        internal long WindowStartUtc { get; set; }
        internal long WindowEndUtc { get; set; }
        internal long ObservedThroughUtc { get; set; }
        internal long CollectedAtUtc { get; set; }
        internal long TrafficFreshUntilUtc { get; set; }
        internal long ActualBytes { get; set; }
        internal string ReplicaSha256 { get; set; }
        internal string ReplicaObjectKey { get; set; }
        internal bool ReplicaWriteOnceVerified { get; set; }
        internal long ReplicaSize { get; set; }
        internal long ReplicaVerifiedAtUtc { get; set; }
        internal bool StrictTls { get; set; }
        internal bool AnonymousReadVerified { get; set; }
        internal long HealthVerifiedAtUtc { get; set; }
        internal long HealthValidUntilUtc { get; set; }
        internal long IssuedAtUtc { get; set; }
        internal long ExpiresAtUtc { get; set; }
    }

    /// <summary>仅包含路由结果与固定原因码，不返回认证收据、密钥或原始异常。</summary>
    internal sealed class ManagedPublicResourceRouteDecision
    {
        internal bool UseBackup { get; set; }
        internal string ReasonCode { get; set; }
        internal string SelectedUrl { get; set; }
        internal string ConfigHash { get; set; }
        internal long ExpiresAtUtc { get; set; }
    }

    /// <summary>
    /// 不执行网络和数据写入的公开资源决策原子。没有可信认证收据始终保留原路径。
    /// 它不是采集器、复制器或线上开关；上线还需受保护的 sys_osclients 密钥和可信发行者集成。
    /// </summary>
    internal static class ManagedPublicResourceRoute
    {
        internal const string Protocol = "ManagedPublicResourceRoute/1";
        internal const long MaxSafeInteger = 9007199254740991;
        internal const long WindowSeconds = 86400;
        internal const long MaxTrafficLagSeconds = 172800; // 已有离线日志可能延迟48小时；超出仍未知。
        internal const long MaxReceiptSeconds = 300;
        internal const long MaxHealthSeconds = 300;
        internal const long MaxReplicaAgeSeconds = 86400;

        internal static ManagedPublicResourceRouteDecision Resolve(
            ManagedPublicResourceContext current, string receipt,
            ManagedPublicResourceReceiptCodec codec, DateTimeOffset now)
        {
            var fallback = current?.OriginalUrl ?? string.Empty;
            ManagedPublicResourceRouteDecision Original(string reason) => new ManagedPublicResourceRouteDecision
            { UseBackup = false, ReasonCode = reason, SelectedUrl = fallback };

            var clock = now.ToUnixTimeSeconds();
            if (current == null || !ValidTenant(current.Tenant)
                || !string.Equals(current.Tenant, current.SourceTenant, StringComparison.OrdinalIgnoreCase))
                return Original("CurrentTenantRequired");
            if (!current.Enabled || !current.IsAuthoritativePublicVersion)
                return Original("AuthoritativePublicVersionRequired");
            // 依赖组、主壳启动JS及含外部依赖的模型不在首个原子切片内。
            if (!Equal(current.DeliveryScope, "StandalonePublicObject"))
                return Original("UnsupportedDeliveryScope");
            if (!ValidId(current.ResourceId) || !ValidHash(current.SourceRevision)
                || !ValidHash(current.ContentHash) || current.Size <= 0 || current.Size > MaxSafeInteger
                || !ValidObjectKey(current.Tenant, current.ObjectKey)
                || !TryReplicaObjectKey(current, out var replicaKey))
                return Original("InvalidResourceIdentity");
            // 首个切片只实现完整24小时；其它已保存窗口不会被悄悄按24小时执行。
            if (current.FileServerBakWindowHours != 24) return Original("UnsupportedWindow");
            if (!TryThreshold(current.FileServerBakThresholdGiB, out var threshold))
                return Original("ThresholdMissingOrInvalid");
            if (!TryConfigHash(current, out var configHash, out var backup))
                return Original("BackupConfigurationInvalid");
            if (codec == null || !codec.TryRead(receipt, out var proof))
                return Original("TrustedReceiptRequired");

            if (!string.Equals(proof.Tenant, current.Tenant, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(proof.SourceTenant, current.SourceTenant, StringComparison.OrdinalIgnoreCase)
                || !Equal(proof.ResourceId, current.ResourceId) || !Equal(proof.SourceRevision, current.SourceRevision)
                || !Equal(proof.ObjectKey, current.ObjectKey) || !Equal(proof.DeliveryScope, current.DeliveryScope)
                || !Equal(proof.ContentHash, current.ContentHash)
                || proof.Size != current.Size)
                return Original("ResourceIdentityChanged");
            if (!Equal(proof.TargetConfigHash, configHash)) return Original("TargetConfigurationChanged");
            if (!Between(proof.IssuedAtUtc, 1, clock) || !Between(proof.ExpiresAtUtc, clock + 1, clock + MaxReceiptSeconds)
                || proof.ExpiresAtUtc - proof.IssuedAtUtc > MaxReceiptSeconds)
                return Original("ReceiptExpiredOrInvalid");
            if (!proof.CoverageComplete || !Equal(proof.Metric, "PublicDeliveryBytes")
                || !Equal(proof.CoverageScope, "AllManagedDelivery"))
                return Original("CompleteDeliveryCoverageRequired");
            // 截断、缺口和其它日期的窗口不能因重新签发短期收据而变成新鲜数据。
            if (!Between(proof.WindowStartUtc, 1, clock)
                || !Between(proof.WindowEndUtc, proof.WindowStartUtc, clock)
                || proof.WindowEndUtc - proof.WindowStartUtc != WindowSeconds
                || clock - proof.WindowEndUtc > MaxTrafficLagSeconds
                || !Between(proof.ObservedThroughUtc, proof.WindowEndUtc, proof.CollectedAtUtc)
                || !Between(proof.CollectedAtUtc, proof.WindowEndUtc, proof.IssuedAtUtc)
                || !Between(proof.TrafficFreshUntilUtc, clock + 1, proof.WindowEndUtc + MaxTrafficLagSeconds))
                return Original("TrafficWindowExpiredOrInvalid");
            if (proof.ActualBytes < threshold || proof.ActualBytes > MaxSafeInteger)
                return Original("TrafficBelowThresholdOrInvalid");
            if (proof.ReplicaSize != current.Size || !Equal(proof.ReplicaSha256, current.ContentHash)
                || !Equal(proof.ReplicaObjectKey, replicaKey) || !proof.ReplicaWriteOnceVerified
                || !Between(proof.ReplicaVerifiedAtUtc, Math.Max(1, clock - MaxReplicaAgeSeconds + 1), proof.IssuedAtUtc))
                return Original("VerifiedReplicaRequired");
            // 必须针对这个不可变目标做无签名的严格HTTPS可读检查；签名GET或仅主机健康不算。
            if (!proof.StrictTls || !proof.AnonymousReadVerified
                || !Between(proof.HealthVerifiedAtUtc, Math.Max(1, clock - MaxHealthSeconds), proof.IssuedAtUtc)
                || !Between(proof.HealthValidUntilUtc, clock + 1, proof.HealthVerifiedAtUtc + MaxHealthSeconds))
                return Original("FreshStrictTlsHealthRequired");

            return new ManagedPublicResourceRouteDecision
            {
                UseBackup = true, ReasonCode = "VerifiedBackup",
                SelectedUrl = backup + "/" + string.Join("/", replicaKey.Split('/').Select(Uri.EscapeDataString)),
                ConfigHash = configHash,
                ExpiresAtUtc = Math.Min(proof.ExpiresAtUtc, Math.Min(proof.TrafficFreshUntilUtc,
                    Math.Min(proof.HealthValidUntilUtc, proof.ReplicaVerifiedAtUtc + MaxReplicaAgeSeconds)))
            };
        }

        /// <summary>
        /// 单文件副本使用版本+内容寻址，禁止覆盖原始可变路径。未来复制器还须保证只创建、
        /// 不覆盖，核对该写入边界后才能签 ReplicaWriteOnceVerified；仅拼出此键不能证明不可变。
        /// </summary>
        internal static bool TryReplicaObjectKey(ManagedPublicResourceContext current, out string key)
        {
            key = null;
            if (current == null || !ValidTenant(current.Tenant) || !ValidHash(current.SourceRevision)
                || !ValidHash(current.ContentHash) || !ValidObjectKey(current.Tenant, current.ObjectKey)) return false;
            var leaf = current.ObjectKey.Substring(current.ObjectKey.LastIndexOf('/') + 1);
            var candidate = current.Tenant.ToLowerInvariant() + "/managed-public/v1/" + current.SourceRevision
                + "/" + current.ContentHash + "/" + leaf;
            if (Encoding.UTF8.GetByteCount(candidate) > 1024) return false;
            key = candidate;
            return true;
        }

        internal static bool TryConfigHash(ManagedPublicResourceContext current, out string hash, out string backup)
        {
            hash = null; backup = null;
            if (current == null || !ValidTenant(current.Tenant)
                || !TryBase(current.FileServer, false, out var original)
                || !TryBase(current.FileServerBak, true, out var backupBase)
                || !ValidBucket(current.BackupPublicBucket)
                || !TryThreshold(current.FileServerBakThresholdGiB, out var bytes)) return false;
            backup = backupBase + "/" + current.BackupPublicBucket;
            // 长度前缀避免分隔符混淆；包含主机基址、显式目标公有桶、阈值和窗口，任一变更令旧证明失效。
            var parts = new[] { Protocol, current.Tenant.ToLowerInvariant(), original, backupBase, current.BackupPublicBucket,
                bytes.ToString(CultureInfo.InvariantCulture), current.FileServerBakWindowHours.ToString(CultureInfo.InvariantCulture) };
            var canonical = string.Concat(parts.Select(value => value.Length.ToString(CultureInfo.InvariantCulture) + ":" + value));
            using (var sha = SHA256.Create()) hash = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(canonical))).Replace("-", "").ToLowerInvariant();
            return true;
        }

        private static bool TryThreshold(decimal? gib, out long bytes)
        {
            bytes = 0;
            if (!gib.HasValue || gib.Value <= 0 || gib.Value > 1000000m) return false;
            bytes = (long)decimal.Ceiling(gib.Value * 1073741824m);
            return bytes > 0 && bytes <= MaxSafeInteger;
        }

        private static bool TryBase(string value, bool requireHttps, out string normalized)
        {
            normalized = null;
            // 必须在Uri规范化前拒绝编码斜杠/点段、反斜杠和控制字符，防止规范化掩盖配置歧义。
            if (string.IsNullOrEmpty(value) || value.Length > 2048 || value.Any(char.IsWhiteSpace)
                || value.Any(char.IsControl) || value.IndexOfAny(new[] { '\\', '%', '?', '#', '@' }) >= 0
                || !Uri.TryCreate(value, UriKind.Absolute, out var uri)
                || (uri.Scheme != Uri.UriSchemeHttps && (requireHttps || uri.Scheme != Uri.UriSchemeHttp))
                || uri.HostNameType != UriHostNameType.Dns || !uri.Host.Contains(".")
                || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0) return false;
            var start = value.IndexOf("://", StringComparison.Ordinal);
            if (start < 0) return false;
            var slash = value.IndexOf('/', start + 3);
            var rawPath = slash < 0 ? string.Empty : value.Substring(slash);
            if (rawPath.Contains("//") || rawPath.Split('/').Any(part => part == "." || part == "..")) return false;
            normalized = uri.GetLeftPart(UriPartial.Path).TrimEnd('/');
            return true;
        }

        private static bool ValidObjectKey(string tenant, string value)
        {
            if (string.IsNullOrEmpty(value) || value.Length > 1000 || value.Any(char.IsWhiteSpace)
                || value.Any(char.IsControl) || value.IndexOfAny(new[] { '\\', '%', '?', '#', ':' }) >= 0) return false;
            try { if (new UTF8Encoding(false, true).GetByteCount(value) > 1024) return false; }
            catch (EncoderFallbackException) { return false; }
            var parts = value.Split('/');
            if (parts.Any(p => p.Length == 0 || p == "." || p == ".."
                || Regex.IsMatch(p, @"\A(?:\.git|\.env|private|private-source|privatesource|source|_origin)\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))) return false;
            var owner = tenant.ToLowerInvariant();
            return value.StartsWith(owner + "/", StringComparison.Ordinal)
                || value.StartsWith("microi/application-assets/v3/tenants/" + owner + "/", StringComparison.Ordinal);
        }

        private static bool ValidTenant(string value) => value != null && Regex.IsMatch(value, @"\A[A-Za-z0-9_-]{1,64}\z", RegexOptions.CultureInvariant);
        private static bool ValidId(string value) => value != null && Regex.IsMatch(value, @"\A[A-Za-z0-9-]{1,36}\z", RegexOptions.CultureInvariant);
        private static bool ValidHash(string value) => value != null && Regex.IsMatch(value, @"\A[a-f0-9]{64}\z", RegexOptions.CultureInvariant);
        private static bool ValidBucket(string value) => value != null
            && Regex.IsMatch(value, @"\A[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\z", RegexOptions.CultureInvariant)
            && !value.Contains("..") && !value.Contains(".-") && !value.Contains("-.")
            && !Regex.IsMatch(value, @"\A[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\z", RegexOptions.CultureInvariant);
        private static bool Equal(string a, string b) => string.Equals(a, b, StringComparison.Ordinal);
        private static bool Between(long value, long min, long max) => value >= min && value <= max;
    }
}
