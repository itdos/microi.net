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
        // 缺少应用包字段或身份表时必须保持关闭，避免旧租户升级后出现不可用的登录入口。
        public bool Enabled { get; set; }
        public bool PasskeyEnabled { get; set; } = true;
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
            return new IdentityVerificationOptions
            {
                Enabled = ReadBool(model, "IdentityVerificationEnabled", false),
                PasskeyEnabled = ReadBool(model, "PasskeyEnabled", true),
                FaceEnabled = ReadBool(model, "FaceVerificationEnabled", false),
                RequirePasswordChangeStepUp = ReadBool(model, "RequirePasswordChangeStepUp", true),
                PasskeyRpId = model["PasskeyRpId"]?.ToString()?.Trim() ?? "",
                PasskeyOrigins = ParseList(model["PasskeyOrigins"]),
                FaceProvider = model["FaceProvider"]?.ToString()?.Trim() ?? "MicroiFaceGatewayV1",
                FaceApiBase = model["FaceApiBase"]?.ToString()?.Trim().TrimEnd('/') ?? "",
                FaceApiKey = model["FaceApiKey"]?.ToString() ?? ""
            };
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
                    new { OsClient = osClient, _Where = commonWhere, _PageIndex = 1, _PageSize = 1, _SelectFields = new[] { "Id" } })
                    .ConfigureAwait(false);
                if (credential.Code == 1 && credential.Data != null && JArray.FromObject(credential.Data).Count > 0) return true;
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
