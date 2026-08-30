using System;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace Microi.net
{
    /// <summary>
    /// 与具体登录协议无关的一次性随机值原语。短信登录、强身份验证等 Core
    /// 能力使用本类，SSO 专属 PKCE、客户端密钥与回跳规则留在 Microi.SSO。
    /// </summary>
    public static class OpaqueTokenSecurity
    {
        public static string NewOpaqueValue(int byteCount = 32)
        {
            if (byteCount < 16 || byteCount > 128)
                throw new ArgumentOutOfRangeException(nameof(byteCount), "随机值必须使用16到128字节熵。");
            var bytes = new byte[byteCount];
            using (var random = RandomNumberGenerator.Create()) random.GetBytes(bytes);
            return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }

        public static bool FixedEquals(string left, string right)
        {
            var leftBytes = Encoding.UTF8.GetBytes(left ?? string.Empty);
            var rightBytes = Encoding.UTF8.GetBytes(right ?? string.Empty);
            return leftBytes.Length == rightBytes.Length
                   && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
        }

        public static string HashOpaqueToken(string token)
        {
            byte[] hash;
            using (var sha = SHA256.Create())
                hash = sha.ComputeHash(Encoding.UTF8.GetBytes(token ?? string.Empty));
            return string.Concat(hash.Select(value => value.ToString("x2", CultureInfo.InvariantCulture)));
        }
    }
}
