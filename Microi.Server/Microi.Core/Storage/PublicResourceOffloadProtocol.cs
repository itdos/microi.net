using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 热点分流第二版协议。完整自然日的云报表可以是迟到的正向下界：已确认超过阈值即可
    /// 晋级，缺行/空集合永不解释为零。晋级后按源版本保持，避免 OSS 流量下降导致反复切回。
    /// 不修改第一版未接线原子的证据语义，也不把旧日志榜单伪装为本日完整计量。
    /// </summary>
    internal static class PublicResourceOffloadProtocol
    {
        internal const string Contract = "PublicResourceOffload/2";
        internal const string Prefix = "_microi-hotspot/public/v2/";
        internal const long GiB = 1073741824;

        internal static bool Identifier(string text, int max = 120) => text != null && text.Length <= max
            && Regex.IsMatch(text, @"\A[a-zA-Z0-9_-]+\z", RegexOptions.CultureInvariant);
        internal static bool Hash(string text) => text != null
            && Regex.IsMatch(text, @"\A[a-f0-9]{64}\z", RegexOptions.CultureInvariant);
        internal static string Digest(string text)
        {
            using var sha = SHA256.Create();
            return Hex(sha.ComputeHash(Encoding.UTF8.GetBytes(text)));
        }
        internal static string Hex(byte[] bytes) => BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();

        internal static bool AssetPath(string path) => !string.IsNullOrWhiteSpace(path) && path.Length <= 1000
            && !path.StartsWith("/", StringComparison.Ordinal) && !path.Any(char.IsControl)
            && path.IndexOfAny(new[] { '\\', '%', '?', '#', ':' }) < 0
            && path.Split('/').All(part => part.Length > 0 && part != "." && part != ".."
                && !Regex.IsMatch(part, @"\A(?:\.git|\.env|private|private-source|privatesource|source|_origin)\z",
                    RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
            && !path.EndsWith(".map", StringComparison.OrdinalIgnoreCase);

        internal static bool PublicObject(string tenant, string key) => Identifier(tenant, 64) && AssetPath(key)
            && (key.StartsWith(tenant.ToLowerInvariant() + "/", StringComparison.Ordinal)
                || key.StartsWith("microi/application-assets/v3/tenants/" + tenant.ToLowerInvariant() + "/", StringComparison.Ordinal));

        internal static string HttpsOrigin(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length > 2048 || value.Any(char.IsWhiteSpace)
                || value.IndexOfAny(new[] { '\\', '%', '?', '#', '@' }) >= 0
                || !Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme != "https"
                || uri.HostNameType != UriHostNameType.Dns || !uri.Host.Contains(".")
                || uri.UserInfo.Length > 0 || uri.AbsolutePath != "/") return null;
            return uri.GetLeftPart(UriPartial.Authority);
        }

        internal static bool CompleteDay(DateTimeOffset from, DateTimeOffset to, DateTimeOffset now) =>
            from.Offset == TimeSpan.Zero && to.Offset == TimeSpan.Zero && to - from == TimeSpan.FromDays(1)
            && from.AddHours(8).TimeOfDay == TimeSpan.Zero && to <= now;

        internal static bool ReachedThreshold(long? confirmedBytes, decimal? configuredGiB) =>
            confirmedBytes.HasValue && confirmedBytes.Value >= 0 && configuredGiB.HasValue
            && configuredGiB.Value > 0 && configuredGiB.Value <= 1000000m
            && confirmedBytes.Value >= decimal.Ceiling(configuredGiB.Value * GiB);

        /// <summary>共享缓存不是信任根；任何被普通缓存工具改写的状态都必须验签失败。</summary>
        internal static string Seal(JObject payload, string tenant, string protectedSecret)
        {
            if (!Identifier(tenant, 64) || string.IsNullOrEmpty(protectedSecret) || protectedSecret.Length < 16)
                throw new InvalidOperationException("OffloadSigningConfigurationMissing");
            var json = payload.ToString(Formatting.None);
            if (Encoding.UTF8.GetByteCount(json) > 4 * 1024 * 1024) throw new InvalidOperationException("OffloadStateTooLarge");
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(protectedSecret));
            var mac = hmac.ComputeHash(Encoding.UTF8.GetBytes(Contract + "\n" + tenant.ToLowerInvariant() + "\n" + json));
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(json)) + "." + Hex(mac);
        }

        internal static JObject Open(string wire, string tenant, string protectedSecret)
        {
            if (wire == null || wire.Length > 6 * 1024 * 1024 || string.IsNullOrEmpty(protectedSecret)) return null;
            var split = wire.LastIndexOf('.');
            if (split <= 0 || !Hash(wire.Substring(split + 1))) return null;
            try
            {
                var json = Encoding.UTF8.GetString(Convert.FromBase64String(wire.Substring(0, split)));
                var payload = JObject.Parse(json);
                var expected = Seal(payload, tenant, protectedSecret);
                var left = Encoding.ASCII.GetBytes(expected.Substring(expected.LastIndexOf('.') + 1));
                var right = Encoding.ASCII.GetBytes(wire.Substring(split + 1));
                return CryptographicOperations.FixedTimeEquals(left, right) ? payload : null;
            }
            catch { return null; }
        }

        internal static string BackupUrl(string origin, string bucket, string prefix, string assetPath)
        {
            var normalized = HttpsOrigin(origin);
            if (normalized == null || !Regex.IsMatch(bucket ?? "", @"\A[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\z")
                || bucket.Contains("..") || prefix == null
                || !Regex.IsMatch(prefix, @"\A_microi-hotspot/public/v2/[a-z0-9_-]{1,64}/[a-z0-9_-]{1,120}/[a-f0-9]{64}/[a-f0-9]{32}/\z")
                || !AssetPath(assetPath))
                return null;
            return normalized + "/" + bucket + "/" + string.Join("/", (prefix + assetPath).Split('/').Select(Uri.EscapeDataString));
        }

        internal static bool MimeMatches(string path, string mediaType)
        {
            var expected = ObjectStorageContentTypes.GetContentType(path).Split(';')[0];
            return string.Equals(expected, mediaType, StringComparison.OrdinalIgnoreCase)
                || expected == "text/javascript" && string.Equals(mediaType, "application/javascript", StringComparison.OrdinalIgnoreCase);
        }
    }
}
