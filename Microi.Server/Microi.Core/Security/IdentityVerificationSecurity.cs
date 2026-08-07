using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 租户级身份验证策略。Passkey 只负责证明设备私钥和用户验证，最终会话仍由 DiyToken 签发。
    /// 严格人脸验证通过外部网关完成，平台数据库只保存供应商侧主体引用，不保存人脸原图或模板。
    /// </summary>
    public sealed class IdentityVerificationOptions
    {
        // 身份能力随官方平台应用默认开启；租户明确写入 0 后仍保持关闭。
        public bool Enabled { get; set; } = true;
        public bool PasskeyEnabled { get; set; } = true;
        public bool TotpEnabled { get; set; } = true;
        public string TotpIssuer { get; set; } = "Microi";
        public bool FaceEnabled { get; set; }
        public bool RequirePasswordChangeStepUp { get; set; } = true;
        public string PasskeyRpId { get; set; } = "";
        public IReadOnlyList<string> PasskeyOrigins { get; set; } = Array.Empty<string>();
        public string FaceProvider { get; set; } = "MicroiFaceGatewayV1";
        public string FaceApiBase { get; set; } = "";
        public string FaceApiKey { get; set; } = "";

        public static IdentityVerificationOptions Resolve(string osClient)
        {
            var client = OsClientExtend.GetClient(osClient);
            var model = client?.OsClientModel ?? new JObject();
            var settings = TenantSystemSettingsSecurity.LoadSnapshot(osClient);
            var legacyFaceApiKey = model["FaceApiKey"]?.ToString() ?? "";
            return new IdentityVerificationOptions
            {
                Enabled = TenantSystemSettingsSecurity.GetBool(settings, "Login.Identity.Enabled",
                    ReadBool(model, "IdentityVerificationEnabled", true), true),
                PasskeyEnabled = TenantSystemSettingsSecurity.GetBool(settings, "Login.Passkey.Enabled",
                    ReadBool(model, "PasskeyEnabled", true), true),
                TotpEnabled = TenantSystemSettingsSecurity.GetBool(settings, "Login.Authenticator.Enabled",
                    ReadBool(model, "AuthenticatorTotpEnabled", true), true),
                TotpIssuer = NormalizeIssuer(ReadSettingText(settings, "Login.Authenticator.Issuer",
                    model["AuthenticatorIssuer"]?.ToString())),
                FaceEnabled = TenantSystemSettingsSecurity.GetBool(settings, "Login.Face.Enabled",
                    ReadBool(model, "FaceVerificationEnabled", false), true),
                RequirePasswordChangeStepUp = TenantSystemSettingsSecurity.GetBool(settings,
                    "Security.PasswordChange.RequireStepUp",
                    ReadBool(model, "RequirePasswordChangeStepUp", true), true),
                PasskeyRpId = ReadSettingText(settings, "Login.Passkey.RpId",
                    model["PasskeyRpId"]?.ToString()).Trim(),
                PasskeyOrigins = ParseList(new JValue(ReadSettingText(settings, "Login.Passkey.Origins",
                    model["PasskeyOrigins"]?.ToString()))),
                FaceProvider = ReadSettingText(settings, "Login.Face.Provider",
                    model["FaceProvider"]?.ToString() ?? "MicroiFaceGatewayV1").Trim(),
                FaceApiBase = ReadSettingText(settings, "Login.Face.ApiBase",
                    model["FaceApiBase"]?.ToString()).Trim().TrimEnd('/'),
                FaceApiKey = ReadSettingSecret(settings, "Login.Face.ApiKey", legacyFaceApiKey)
            };
        }

        private static string ReadSettingText(
            IReadOnlyDictionary<string, TenantSystemSettingValue> settings,
            string key,
            string fallback)
        {
            if (settings != null && settings.TryGetValue(key, out var item) && item.IsEnabled && !item.IsSecret)
                return item.Value ?? string.Empty;
            return fallback ?? string.Empty;
        }

        private static string ReadSettingSecret(
            IReadOnlyDictionary<string, TenantSystemSettingValue> settings,
            string key,
            string fallback)
        {
            try
            {
                return TenantSystemSettingsSecurity.GetText(settings, key, fallback ?? string.Empty, true);
            }
            catch
            {
                // 密文损坏时失败关闭，不让人脸网关使用错误或泄露的凭据。
                return string.Empty;
            }
        }

        private static bool ReadBool(JObject model, string name, bool defaultValue)
        {
            var token = model[name];
            if (token == null || token.Type == JTokenType.Null) return defaultValue;
            if (token.Type == JTokenType.Boolean) return token.Value<bool>();
            var value = token.ToString().Trim().ToLowerInvariant();
            if (value.Length == 0) return defaultValue;
            return value == "1" || value == "true" || value == "yes" || value == "on"
                || value == "开启" || value == "启用";
        }

        private static string NormalizeIssuer(string value)
        {
            var issuer = (value ?? "").Trim();
            if (issuer.Length == 0) issuer = "Microi";
            if (issuer.Length > 50) issuer = issuer.Substring(0, 50);
            return new string(issuer.Where(ch => !char.IsControl(ch) && ch != ':' && ch != '\r' && ch != '\n').ToArray());
        }

        private static IReadOnlyList<string> ParseList(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null) return Array.Empty<string>();
            if (token is JArray array)
            {
                return array.Values<string>()
                    .Select(item => item?.Trim())
                    .Where(item => !string.IsNullOrWhiteSpace(item))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
            }

            var text = token.ToString().Trim();
            if (text.StartsWith("[", StringComparison.Ordinal))
            {
                try { return ParseList(JArray.Parse(text)); } catch { }
            }
            return text.Split(new[] { ',', ';', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(item => item.Trim())
                .Where(item => item.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
    }

    public sealed class IdentityVerificationTicketPayload
    {
        public string OsClient { get; set; }
        public string UserId { get; set; }
        public string Purpose { get; set; }
        public string ActionHash { get; set; }
        public string Method { get; set; }
        public string AuthenticatorId { get; set; }
        public string Did { get; set; }
        public string VerifiedAt { get; set; }
        public string ExpiresAt { get; set; }
    }

    /// <summary>
    /// 二次身份验证票据服务。票据只在共享 Redis 中短时存在，并通过 GETDEL 原子消费，
    /// 因此跨节点、重试和滚动发布场景下也不能重复授权同一敏感操作。
    /// </summary>
    public static class IdentityVerificationSecurity
    {
        private static readonly TimeSpan TicketLifetime = TimeSpan.FromMinutes(2);
        private const string TicketPrefix = "Microi:{0}:IdentityVerification:Ticket:{1}";
        private const string TotpCipherPrefix = "totp-v1";
        private const string Base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

        public static string NormalizePurpose(string purpose)
        {
            var value = (purpose ?? "").Trim();
            if (value.Length < 1 || value.Length > 80
                || value.Any(ch => !(char.IsLetterOrDigit(ch) || ch == '.' || ch == '_'
                    || ch == ':' || ch == '-')))
            {
                throw new ArgumentException("验证用途只能包含字母、数字、点、横线、下划线或冒号，长度为1到80。", nameof(purpose));
            }
            return value;
        }

        public static string NormalizeActionHash(string actionHash, bool required)
        {
            var value = (actionHash ?? "").Trim();
            if (value.Length == 0 && !required) return "";
            if (value.Length < 16 || value.Length > 128
                || value.Any(ch => !(char.IsLetterOrDigit(ch) || ch == '-' || ch == '_'
                    || ch == ':' || ch == '.')))
            {
                throw new ArgumentException("ActionHash 格式无效。", nameof(actionHash));
            }
            return value;
        }

        /// <summary>
        /// 校验 WebAuthn RP ID 与发起验证的前端 Origin 是否属于同一站点范围。
        /// 浏览器要求 RP ID 等于当前域名，或是当前域名的可注册父域；在下发挑战前
        /// 先做这一层可解释校验，避免把浏览器的英文 SecurityError 直接暴露给用户。
        /// </summary>
        public static string NormalizePasskeyRelyingPartyId(string configuredRpId, string origin)
        {
            if (!Uri.TryCreate((origin ?? "").Trim(), UriKind.Absolute, out var originUri)
                || string.IsNullOrWhiteSpace(originUri.IdnHost))
            {
                throw new ArgumentException("Passkey 请求来源无效，请通过 HTTPS 站点重新访问。", nameof(origin));
            }

            var originHost = originUri.IdnHost.Trim().TrimEnd('.').ToLowerInvariant();
            var rpId = string.IsNullOrWhiteSpace(configuredRpId)
                ? originHost
                : configuredRpId.Trim().TrimEnd('.').ToLowerInvariant();
            if (rpId.Length < 1 || rpId.Length > 253
                || rpId.Any(ch => !(char.IsLetterOrDigit(ch) || ch == '.' || ch == '-')))
            {
                throw new ArgumentException(
                    "Passkey RP ID 配置无效：只能填写域名，不能包含协议、端口、路径或空格。",
                    nameof(configuredRpId));
            }

            var isSameHost = string.Equals(originHost, rpId, StringComparison.OrdinalIgnoreCase);
            var isParentDomain = originHost.EndsWith("." + rpId, StringComparison.OrdinalIgnoreCase);
            if (!isSameHost && !isParentDomain)
            {
                var currentOrigin = originUri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
                throw new ArgumentException(
                    $"Passkey RP ID 与当前站点域名不匹配。当前站点：{currentOrigin}；"
                    + $"当前域名：{originHost}；已配置 RP ID：{rpId}。"
                    + "请由租户管理员进入“系统设置 → 登录与身份”，将 Passkey RP ID 设置为当前域名，"
                    + "或设置为当前域名的可注册父域；同时把当前站点完整 Origin 加入 PasskeyOrigins，"
                    + "保存后重新登记通行密钥。",
                    nameof(configuredRpId));
            }

            return rpId;
        }

        public static string ComputePasswordChangeActionHash(string userId, string encodedNewPassword)
        {
            using (var sha = SHA256.Create())
            {
                var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(
                    $"Microi:ChangePassword:v1:{userId ?? ""}:{encodedNewPassword ?? ""}"));
                return ToHex(bytes);
            }
        }

        public static async Task<DosResult<dynamic>> IssueTicketAsync(
            string osClient,
            string userId,
            string purpose,
            string actionHash,
            string method,
            string authenticatorId,
            string did)
        {
            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
                purpose = NormalizePurpose(purpose);
                actionHash = NormalizeActionHash(actionHash, !string.Equals(purpose, "Login", StringComparison.Ordinal));
                if (userId.DosIsNullOrWhiteSpace()) return new DosResult<dynamic>(0, null, "用户身份不能为空。");

                var ticket = NewOpaqueValue();
                var now = DateTimeOffset.UtcNow;
                var payload = new IdentityVerificationTicketPayload
                {
                    OsClient = osClient,
                    UserId = userId,
                    Purpose = purpose,
                    ActionHash = actionHash,
                    Method = (method ?? "").Trim(),
                    AuthenticatorId = (authenticatorId ?? "").Trim(),
                    Did = (did ?? "").Trim(),
                    VerifiedAt = now.ToString("O"),
                    ExpiresAt = now.Add(TicketLifetime).ToString("O")
                };
                var key = string.Format(TicketPrefix, osClient, ticket);
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var written = await cache.GetIDatabase()
                    .StringSetAsync(key, JsonConvert.SerializeObject(payload), TicketLifetime, StackExchange.Redis.When.NotExists)
                    .ConfigureAwait(false);
                return written
                    ? new DosResult<dynamic>(1, new
                    {
                        Ticket = ticket,
                        payload.Purpose,
                        payload.Method,
                        payload.VerifiedAt,
                        payload.ExpiresAt
                    })
                    : new DosResult<dynamic>(0, null, "身份验证票据生成失败，请重试。");
            }
            catch (Exception ex)
            {
                return new DosResult<dynamic>(0, null, "身份验证票据生成失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<IdentityVerificationTicketPayload>> ConsumeTicketAsync(
            string osClient,
            string userId,
            string ticket,
            string purpose,
            string actionHash)
        {
            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
                purpose = NormalizePurpose(purpose);
                actionHash = NormalizeActionHash(actionHash, !string.Equals(purpose, "Login", StringComparison.Ordinal));
                ticket = (ticket ?? "").Trim();
                if (!IsOpaqueValue(ticket))
                    return new DosResult<IdentityVerificationTicketPayload>(0, null, "身份验证票据格式无效。");

                var key = string.Format(TicketPrefix, osClient, ticket);
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var value = await cache.GetIDatabase().StringGetDeleteAsync(key).ConfigureAwait(false);
                if (!value.HasValue)
                    return new DosResult<IdentityVerificationTicketPayload>(0, null, "身份验证票据不存在、已过期或已使用。");

                var payload = JsonConvert.DeserializeObject<IdentityVerificationTicketPayload>(value.ToString());
                if (payload == null
                    || !FixedEquals(payload.OsClient, osClient)
                    || !FixedEquals(payload.UserId, userId)
                    || !FixedEquals(payload.Purpose, purpose)
                    || !FixedEquals(payload.ActionHash ?? "", actionHash ?? "")
                    || !DateTimeOffset.TryParse(payload.ExpiresAt, out var expiresAt)
                    || expiresAt <= DateTimeOffset.UtcNow)
                {
                    return new DosResult<IdentityVerificationTicketPayload>(0, null, "身份验证票据与当前用户或操作不匹配。");
                }
                return new DosResult<IdentityVerificationTicketPayload>(1, payload);
            }
            catch (Exception ex)
            {
                return new DosResult<IdentityVerificationTicketPayload>(0, null, "身份验证票据校验失败：" + ex.Message);
            }
        }

        public static async Task<bool> UserHasStepUpFactorAsync(
            string osClient,
            string userId,
            bool allowPasskey = true,
            bool allowTotp = true,
            bool allowFace = true)
        {
            if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace()) return false;
            var commonWhere = new List<DiyWhere>
            {
                new DiyWhere { Name = "UserId", Type = "=", Value = userId },
                new DiyWhere { Name = "State", Type = "=", Value = 1 },
                new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
            };
            if (allowPasskey) try
            {
                var credential = await MicroiEngine.FormEngine.GetTableDataAsync(
                    "mci_identity_credential",
                    new
                    {
                        OsClient = osClient,
                        _Where = commonWhere.Concat(new[]
                        {
                            new DiyWhere { Name = "AllowStepUp", Type = "=", Value = 1 }
                        }).ToList(),
                        _PageIndex = 1,
                        _PageSize = 1,
                        _SelectFields = new[] { "Id" }
                    })
                    .ConfigureAwait(false);
                if (credential.Code == 1 && credential.Data != null && JArray.FromObject(credential.Data).Count > 0) return true;
            }
            catch { }
            if (allowTotp) try
            {
                var totp = await MicroiEngine.FormEngine.GetTableDataAsync(
                    "mci_identity_totp",
                    new
                    {
                        OsClient = osClient,
                        _Where = commonWhere.Concat(new[]
                        {
                            new DiyWhere { Name = "AllowStepUp", Type = "=", Value = 1 }
                        }).ToList(),
                        _PageIndex = 1,
                        _PageSize = 1,
                        _SelectFields = new[] { "Id" }
                    })
                    .ConfigureAwait(false);
                if (totp.Code == 1 && totp.Data != null && JArray.FromObject(totp.Data).Count > 0) return true;
            }
            catch { }
            if (allowFace) try
            {
                var face = await MicroiEngine.FormEngine.GetTableDataAsync(
                    "mci_identity_face",
                    new { OsClient = osClient, _Where = commonWhere, _PageIndex = 1, _PageSize = 1, _SelectFields = new[] { "Id" } })
                    .ConfigureAwait(false);
                return face.Code == 1 && face.Data != null && JArray.FromObject(face.Data).Count > 0;
            }
            catch { }
            return false;
        }

        public static string GenerateTotpSecret(int byteLength = 20)
        {
            if (byteLength < 16 || byteLength > 64) throw new ArgumentOutOfRangeException(nameof(byteLength));
            var bytes = new byte[byteLength];
            RandomNumberGenerator.Fill(bytes);
            return Base32Encode(bytes);
        }

        public static string Base32Encode(byte[] value)
        {
            if (value == null || value.Length == 0) return "";
            var builder = new StringBuilder((value.Length * 8 + 4) / 5);
            var buffer = 0;
            var bitsLeft = 0;
            foreach (var item in value)
            {
                buffer = (buffer << 8) | item;
                bitsLeft += 8;
                while (bitsLeft >= 5)
                {
                    bitsLeft -= 5;
                    builder.Append(Base32Alphabet[(buffer >> bitsLeft) & 31]);
                }
            }
            if (bitsLeft > 0) builder.Append(Base32Alphabet[(buffer << (5 - bitsLeft)) & 31]);
            return builder.ToString();
        }

        public static byte[] Base32Decode(string value)
        {
            var normalized = new string((value ?? "")
                .ToUpperInvariant()
                .Where(ch => !char.IsWhiteSpace(ch) && ch != '-' && ch != '=')
                .ToArray());
            if (normalized.Length == 0) return Array.Empty<byte>();
            var result = new List<byte>(normalized.Length * 5 / 8);
            var buffer = 0;
            var bitsLeft = 0;
            foreach (var character in normalized)
            {
                var index = Base32Alphabet.IndexOf(character);
                if (index < 0) throw new FormatException("Authenticator 密钥格式无效。");
                buffer = (buffer << 5) | index;
                bitsLeft += 5;
                if (bitsLeft >= 8)
                {
                    bitsLeft -= 8;
                    result.Add((byte)((buffer >> bitsLeft) & 0xff));
                }
            }
            return result.ToArray();
        }

        public static string ComputeTotpCode(byte[] secret, long counter, int digits = 6)
        {
            if (secret == null || secret.Length < 16) throw new ArgumentException("Authenticator 密钥长度无效。", nameof(secret));
            if (digits < 6 || digits > 8) throw new ArgumentOutOfRangeException(nameof(digits));
            var counterBytes = new byte[8];
            for (var index = counterBytes.Length - 1; index >= 0; index--)
            {
                counterBytes[index] = (byte)(counter & 0xff);
                counter >>= 8;
            }
            using var hmac = new HMACSHA1(secret);
            var hash = hmac.ComputeHash(counterBytes);
            var offset = hash[^1] & 0x0f;
            var binary = ((hash[offset] & 0x7f) << 24)
                | ((hash[offset + 1] & 0xff) << 16)
                | ((hash[offset + 2] & 0xff) << 8)
                | (hash[offset + 3] & 0xff);
            var modulo = digits == 8 ? 100_000_000 : digits == 7 ? 10_000_000 : 1_000_000;
            return (binary % modulo).ToString(new string('0', digits));
        }

        public static long FindMatchingTotpCounter(
            byte[] secret,
            string code,
            DateTimeOffset now,
            int window = 1,
            int periodSeconds = 30,
            int digits = 6)
        {
            code = new string((code ?? "").Where(char.IsDigit).ToArray());
            if (code.Length != digits || window < 0 || window > 5 || periodSeconds < 15) return -1;
            var currentCounter = now.ToUnixTimeSeconds() / periodSeconds;
            var supplied = Encoding.ASCII.GetBytes(code);
            for (var delta = -window; delta <= window; delta++)
            {
                var counter = currentCounter + delta;
                if (counter < 0) continue;
                var expected = Encoding.ASCII.GetBytes(ComputeTotpCode(secret, counter, digits));
                if (CryptographicOperations.FixedTimeEquals(expected, supplied)) return counter;
            }
            return -1;
        }

        public static string ProtectTotpSecret(string osClient, string base32Secret)
        {
            var secret = Base32Decode(base32Secret);
            if (secret.Length < 16) throw new ArgumentException("Authenticator 密钥长度无效。", nameof(base32Secret));
            var tenantId = ResolveCanonicalTotpTenantId(osClient);
            var key = DeriveTotpEncryptionKey(tenantId);
            var nonce = new byte[12];
            using (var random = RandomNumberGenerator.Create()) random.GetBytes(nonce);
            var ciphertext = new byte[secret.Length];
            var tag = new byte[16];
            using (var aes = new AesGcm(key))
            {
                aes.Encrypt(nonce, secret, ciphertext, tag, Encoding.UTF8.GetBytes($"Microi:TOTP:{tenantId}"));
            }
            CryptographicOperations.ZeroMemory(secret);
            return string.Join('.', TotpCipherPrefix,
                Base64UrlEncode(nonce), Base64UrlEncode(ciphertext), Base64UrlEncode(tag));
        }

        public static byte[] UnprotectTotpSecret(string osClient, string protectedValue)
        {
            var parts = (protectedValue ?? "").Split('.');
            if (parts.Length != 4 || !string.Equals(parts[0], TotpCipherPrefix, StringComparison.Ordinal))
                throw new CryptographicException("Authenticator 密钥密文版本无效。");
            var nonce = Base64UrlDecode(parts[1]);
            var ciphertext = Base64UrlDecode(parts[2]);
            var tag = Base64UrlDecode(parts[3]);
            if (nonce.Length != 12 || tag.Length != 16 || ciphertext.Length < 16)
                throw new CryptographicException("Authenticator 密钥密文结构无效，请重新登记 Authenticator。");

            Exception lastError = null;
            foreach (var tenantId in GetTotpTenantIdCandidates(osClient))
            {
                var plaintext = new byte[ciphertext.Length];
                try
                {
                    using (var aes = new AesGcm(DeriveTotpEncryptionKey(tenantId)))
                    {
                        aes.Decrypt(nonce, ciphertext, tag, plaintext,
                            Encoding.UTF8.GetBytes($"Microi:TOTP:{tenantId}"));
                    }
                    return plaintext;
                }
                catch (CryptographicException ex)
                {
                    lastError = ex;
                    CryptographicOperations.ZeroMemory(plaintext);
                }
            }

            throw new CryptographicException(
                "Authenticator 密钥无法解密。系统已兼容租户标识大小写；若仍出现此提示，说明绑定后 AuthSecret 已变化或各节点配置不一致。"
                + "请先使用账号密码登录，在“个人中心 → 验证器”移除并重新登记 Authenticator；管理员同时检查 SaaS 引擎 sys_osclients.AuthSecret 是否稳定且各节点一致。",
                lastError);
        }

        private static byte[] DeriveTotpEncryptionKey(string osClient)
        {
            osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            var client = OsClientExtend.ClientList
                .FirstOrDefault(item => string.Equals(item.Key, osClient, StringComparison.OrdinalIgnoreCase))
                .Value;
            if (client == null)
            {
                try { client = OsClientExtend.GetClient(osClient); }
                catch { }
            }
            var authSecret = client?.OsClientModel?["AuthSecret"]?.ToString();
            if (authSecret.DosIsNullOrWhiteSpace()) throw new CryptographicException("租户认证密钥尚未就绪。");
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(authSecret));
            return hmac.ComputeHash(Encoding.UTF8.GetBytes($"Microi:Identity:TOTP:v1:{osClient}"));
        }

        private static string ResolveCanonicalTotpTenantId(string osClient)
        {
            var normalized = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            var cached = OsClientExtend.ClientList
                .FirstOrDefault(item => string.Equals(item.Key, normalized, StringComparison.OrdinalIgnoreCase))
                .Value;
            if (cached != null && !cached.OsClient.DosIsNullOrWhiteSpace())
                return TenantConfigurationSecurity.NormalizeTenantId(cached.OsClient);
            try
            {
                var loaded = OsClientExtend.GetClient(normalized);
                if (loaded != null && !loaded.OsClient.DosIsNullOrWhiteSpace())
                    return TenantConfigurationSecurity.NormalizeTenantId(loaded.OsClient);
            }
            catch { }
            return normalized;
        }

        private static IEnumerable<string> GetTotpTenantIdCandidates(string osClient)
        {
            var normalized = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            return new[]
                {
                    ResolveCanonicalTotpTenantId(normalized),
                    normalized,
                    normalized.ToLowerInvariant()
                }
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.Ordinal);
        }

        private static byte[] Base64UrlDecode(string value)
        {
            var text = (value ?? "").Replace('-', '+').Replace('_', '/');
            text = text.PadRight(text.Length + ((4 - text.Length % 4) % 4), '=');
            return Convert.FromBase64String(text);
        }

        public static string NewOpaqueValue()
        {
            var bytes = new byte[32];
            using (var random = RandomNumberGenerator.Create()) random.GetBytes(bytes);
            return Base64UrlEncode(bytes);
        }

        public static bool IsOpaqueValue(string value)
        {
            return !string.IsNullOrWhiteSpace(value)
                && value.Length >= 32 && value.Length <= 96
                && value.All(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_');
        }

        public static string HashIdentifier(byte[] value)
        {
            using (var sha = SHA256.Create())
            {
                return ToHex(sha.ComputeHash(value ?? Array.Empty<byte>()));
            }
        }

        public static string Base64UrlEncode(byte[] value)
        {
            return Convert.ToBase64String(value ?? Array.Empty<byte>()).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }

        private static string ToHex(byte[] value)
        {
            return BitConverter.ToString(value ?? Array.Empty<byte>()).Replace("-", "").ToLowerInvariant();
        }

        private static bool FixedEquals(string left, string right)
        {
            var leftBytes = Encoding.UTF8.GetBytes(left ?? "");
            var rightBytes = Encoding.UTF8.GetBytes(right ?? "");
            return leftBytes.Length == rightBytes.Length
                && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
        }
    }
}
