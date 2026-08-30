using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// SSO 协议无关的安全原语。这里只处理输入规范化、精确回跳、PKCE、客户端
    /// Secret 和稳定主体，不创建第二套平台会话；外部身份验证成功后仍由 DiyToken
    /// 承担租户、终端与业务权限。
    /// </summary>
    public static class SsoSecurity
    {
        public const string InboundDirection = "ExternalToMicroi";
        public const string OutboundDirection = "MicroiToExternal";

        private static readonly Regex KeyPattern = new Regex(
            @"^[A-Za-z][A-Za-z0-9._:-]{1,99}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex LegacyTokenNamePattern = new Regex(
            @"^[A-Za-z][A-Za-z0-9_.-]{0,63}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly HashSet<string> SupportedProtocols = new HashSet<string>(
            new[] { "OIDC", "SAML2", "CAS", "LegacyToken" },
            StringComparer.OrdinalIgnoreCase);

        public static string NormalizeConnectionKey(string value)
        {
            var key = (value ?? string.Empty).Trim();
            if (!KeyPattern.IsMatch(key))
                throw new ArgumentException("SSO Key 必须以字母开头，只能包含字母、数字、点、下划线、中划线和冒号，长度为2到100。", nameof(value));
            return key;
        }

        public static string NormalizeProtocol(string value)
        {
            var protocol = (value ?? string.Empty).Trim().ToUpperInvariant();
            if (!SupportedProtocols.Contains(protocol))
                throw new ArgumentException("SSO 协议仅支持 OIDC、SAML2、CAS 或 LegacyToken。", nameof(value));
            return protocol;
        }

        public static string NormalizeDirection(string value)
        {
            var direction = (value ?? string.Empty).Trim();
            if (string.Equals(direction, InboundDirection, StringComparison.OrdinalIgnoreCase))
                return InboundDirection;
            if (string.Equals(direction, OutboundDirection, StringComparison.OrdinalIgnoreCase))
                return OutboundDirection;
            throw new ArgumentException("SSO 方向仅支持 ExternalToMicroi 或 MicroiToExternal。", nameof(value));
        }

        public static Uri RequireAbsoluteEndpoint(string value, bool allowLoopbackHttp = false)
        {
            if (!Uri.TryCreate((value ?? string.Empty).Trim(), UriKind.Absolute, out var uri)
                || !string.IsNullOrEmpty(uri.UserInfo)
                || !string.IsNullOrEmpty(uri.Fragment))
            {
                throw new ArgumentException("SSO 地址必须是绝对 URL，且不能包含用户凭据或片段。", nameof(value));
            }

            if (uri.Scheme == Uri.UriSchemeHttps) return uri;
            if (allowLoopbackHttp
                && uri.Scheme == Uri.UriSchemeHttp
                && (string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(uri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(uri.Host, "::1", StringComparison.OrdinalIgnoreCase)))
            {
                return uri;
            }
            throw new ArgumentException("SSO 地址必须使用 HTTPS；只有显式允许的本机联调可使用 HTTP loopback。", nameof(value));
        }

        public static IReadOnlyList<string> ParseStringList(object value, int maxItems = 100, int maxItemLength = 2048)
        {
            IEnumerable<string> source;
            if (value == null)
            {
                source = Array.Empty<string>();
            }
            else if (value is JArray array)
            {
                source = array.Select(item => item?.ToString());
            }
            else if (value is IEnumerable<string> strings)
            {
                source = strings;
            }
            else
            {
                var text = value.ToString()?.Trim() ?? string.Empty;
                if (text.StartsWith("[", StringComparison.Ordinal))
                {
                    try { source = JArray.Parse(text).Select(item => item?.ToString()); }
                    catch { source = SplitList(text); }
                }
                else
                {
                    source = SplitList(text);
                }
            }

            var result = source
                .Select(item => (item ?? string.Empty).Trim())
                .Where(item => item.Length > 0)
                .Distinct(StringComparer.Ordinal)
                .ToList();
            if (result.Count > maxItems || result.Any(item => item.Length > maxItemLength))
                throw new ArgumentException("SSO 列表配置的条数或单项长度超出限制。", nameof(value));
            return result;
        }

        public static bool IsExactRedirectUriAllowed(string candidate, object configuredUris, bool allowLoopbackHttp = false)
        {
            Uri candidateUri;
            try { candidateUri = RequireAbsoluteEndpoint(candidate, allowLoopbackHttp); }
            catch { return false; }

            foreach (var configured in ParseStringList(configuredUris))
            {
                Uri configuredUri;
                try { configuredUri = RequireAbsoluteEndpoint(configured, allowLoopbackHttp); }
                catch { continue; }
                if (string.Equals(candidateUri.AbsoluteUri, configuredUri.AbsoluteUri, StringComparison.Ordinal))
                    return true;
            }
            return false;
        }

        /// <summary>
        /// Legacy URL-token compatibility is intentionally limited to the
        /// marketplace-delivered same-origin ApiEngine. Returning a generic API,
        /// absolute URL or protocol-relative URL could forward a credential to an
        /// unrelated endpoint or silently revive deleted native business logic.
        /// </summary>
        public static bool IsSafeLegacyClientApi(string value)
        {
            var path = (value ?? string.Empty).Trim();
            return string.Equals(path, "/apiengine/sso_legacy_token_login",
                StringComparison.OrdinalIgnoreCase);
        }

        public static bool IsSafeLegacyTokenName(string value) =>
            LegacyTokenNamePattern.IsMatch((value ?? string.Empty).Trim());

        public static string NewOpaqueValue(int byteCount = 32)
        {
            if (byteCount < 16 || byteCount > 128)
                throw new ArgumentOutOfRangeException(nameof(byteCount), "随机值必须使用16到128字节熵。 ");
            var bytes = new byte[byteCount];
            using (var random = RandomNumberGenerator.Create()) random.GetBytes(bytes);
            return Base64Url(bytes);
        }

        public static string CreatePkceVerifier() => NewOpaqueValue(48);

        public static string CreatePkceChallenge(string verifier)
        {
            var value = (verifier ?? string.Empty).Trim();
            if (value.Length < 43 || value.Length > 128)
                throw new ArgumentException("PKCE verifier 长度必须为43到128。", nameof(verifier));
            return Base64Url(ComputeSha256(Encoding.ASCII.GetBytes(value)));
        }

        public static bool VerifyPkceS256(string verifier, string expectedChallenge)
        {
            try { return FixedEquals(CreatePkceChallenge(verifier), (expectedChallenge ?? string.Empty).Trim()); }
            catch { return false; }
        }

        public static string HashClientSecret(string secret, int iterations = 210000)
        {
            var value = secret ?? string.Empty;
            if (value.Length < 32 || value.Length > 512)
                throw new ArgumentException("OIDC 客户端 Secret 长度必须为32到512。", nameof(secret));
            if (iterations < 100000 || iterations > 1000000)
                throw new ArgumentOutOfRangeException(nameof(iterations));
            var salt = new byte[16];
            using (var random = RandomNumberGenerator.Create()) random.GetBytes(salt);
            byte[] hash;
            using (var deriveBytes = new Rfc2898DeriveBytes(value, salt, iterations, HashAlgorithmName.SHA256))
                hash = deriveBytes.GetBytes(32);
            return string.Join("$", "pbkdf2-sha256", iterations.ToString(CultureInfo.InvariantCulture),
                Convert.ToBase64String(salt), Convert.ToBase64String(hash));
        }

        public static bool VerifyClientSecret(string secret, string encoded)
        {
            try
            {
                var parts = (encoded ?? string.Empty).Split('$');
                if (parts.Length != 4 || !string.Equals(parts[0], "pbkdf2-sha256", StringComparison.Ordinal)) return false;
                if (!int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var iterations)
                    || iterations < 100000 || iterations > 1000000) return false;
                var salt = Convert.FromBase64String(parts[2]);
                var expected = Convert.FromBase64String(parts[3]);
                if (salt.Length < 16 || expected.Length != 32) return false;
                byte[] actual;
                using (var deriveBytes = new Rfc2898DeriveBytes(secret ?? string.Empty, salt, iterations, HashAlgorithmName.SHA256))
                    actual = deriveBytes.GetBytes(expected.Length);
                return CryptographicOperations.FixedTimeEquals(actual, expected);
            }
            catch { return false; }
        }

        public static string HashOpaqueToken(string token)
        {
            var hash = ComputeSha256(Encoding.UTF8.GetBytes(token ?? string.Empty));
            return string.Concat(hash.Select(value => value.ToString("x2", CultureInfo.InvariantCulture)));
        }

        public static string CreatePairwiseSubject(string osClient, string clientId, string userId, string keyMaterial)
        {
            var tenant = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            var client = new string((clientId ?? string.Empty)
                .Where(ch => !char.IsControl(ch))
                .ToArray()).Trim();
            if (client.Length == 0 || client.Length > 300)
                throw new ArgumentException("SSO 客户端标识长度必须为1到300且不能包含控制字符。", nameof(clientId));
            var user = (userId ?? string.Empty).Trim();
            if (user.Length == 0 || user.Length > 100) throw new ArgumentException("用户 Id 无效。", nameof(userId));
            if (string.IsNullOrWhiteSpace(keyMaterial)) throw new ArgumentException("主体派生密钥不能为空。", nameof(keyMaterial));
            using var hmac = new HMACSHA256(ComputeSha256(Encoding.UTF8.GetBytes(keyMaterial)));
            return Base64Url(hmac.ComputeHash(Encoding.UTF8.GetBytes($"Microi:SSO:sub:v1:{tenant}:{client}:{user}")));
        }

        public static IReadOnlyList<string> NormalizeScopes(string requested, object allowed, bool requireOpenId)
        {
            var allowedSet = new HashSet<string>(ParseStringList(allowed), StringComparer.Ordinal);
            var requestedItems = (requested ?? string.Empty)
                .Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Distinct(StringComparer.Ordinal)
                .ToList();
            if (requestedItems.Count == 0 || requestedItems.Count > 50) return Array.Empty<string>();
            if (requireOpenId && !requestedItems.Contains("openid", StringComparer.Ordinal)) return Array.Empty<string>();
            return requestedItems.All(allowedSet.Contains)
                ? (IReadOnlyList<string>)requestedItems
                : Array.Empty<string>();
        }

        public static bool FixedEquals(string left, string right)
        {
            var leftBytes = Encoding.UTF8.GetBytes(left ?? string.Empty);
            var rightBytes = Encoding.UTF8.GetBytes(right ?? string.Empty);
            return leftBytes.Length == rightBytes.Length
                   && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
        }

        private static IEnumerable<string> SplitList(string value)
        {
            return (value ?? string.Empty).Split(
                new[] { '\r', '\n', ',', ';' },
                StringSplitOptions.RemoveEmptyEntries);
        }

        private static string Base64Url(byte[] value)
        {
            return Convert.ToBase64String(value ?? Array.Empty<byte>())
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }

        private static byte[] ComputeSha256(byte[] value)
        {
            using (var sha = SHA256.Create()) return sha.ComputeHash(value ?? Array.Empty<byte>());
        }
    }
}
