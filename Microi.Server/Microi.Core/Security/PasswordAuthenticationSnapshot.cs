using System;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>可信密码校验与会话签发之间的短期进程内证明，不进入 HTTP、V8 或用户投影。</summary>
    internal sealed class PasswordAuthenticationSnapshot
    {
        private readonly string tenant;
        private readonly string userId;
        private readonly string fingerprint;
        internal string Language { get; }

        private PasswordAuthenticationSnapshot(string tenant, JObject user, string language)
        {
            this.tenant = tenant;
            userId = user["Id"]?.ToString();
            fingerprint = Fingerprint(user);
            Language = language;
        }

        internal static PasswordAuthenticationSnapshot Capture(string tenant, JObject verifiedUser, string language)
        {
            if (string.IsNullOrWhiteSpace(tenant) || !PasswordResetSecurity.IsResettable(verifiedUser)
                || string.IsNullOrWhiteSpace(verifiedUser["Pwd"]?.ToString()))
                throw new InvalidOperationException("VerifiedPasswordCredentialRequired");
            return new PasswordAuthenticationSnapshot(tenant, verifiedUser, language);
        }

        internal bool Matches(string currentTenant, JObject primaryUser)
        {
            return string.Equals(tenant, currentTenant, StringComparison.OrdinalIgnoreCase)
                && PasswordResetSecurity.IsResettable(primaryUser)
                && string.Equals(userId, primaryUser["Id"]?.ToString(), StringComparison.Ordinal)
                && OpaqueTokenSecurity.FixedEquals(fingerprint, Fingerprint(primaryUser));
        }

        private static string Fingerprint(JObject user)
        {
            using var sha = SHA256.Create();
            return Convert.ToBase64String(sha.ComputeHash(Encoding.UTF8.GetBytes(
                (user["PwdEncode"]?.ToString() ?? "") + "\n" + (user["Pwd"]?.ToString() ?? ""))));
        }
    }
}
