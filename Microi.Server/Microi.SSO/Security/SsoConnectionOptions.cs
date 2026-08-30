using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// diy_sso 的协议无关运行时投影。数据库字段属于应用包；这里刻意只读取
    /// 已知白名单字段，避免把密文、哈希或租户自定义列投影到匿名能力接口。
    /// </summary>
    public sealed class SsoConnectionOptions
    {
        public string Id { get; set; }
        public string Key { get; set; }
        public string Name { get; set; }
        public string Direction { get; set; }
        public string Protocol { get; set; }
        public string Description { get; set; }
        public string Icon { get; set; }
        public int Sort { get; set; }
        public bool Enabled { get; set; }
        public bool IsDefault { get; set; }

        public string Issuer { get; set; }
        public string DiscoveryUrl { get; set; }
        public string AuthorizationEndpoint { get; set; }
        public string TokenEndpoint { get; set; }
        public string UserInfoEndpoint { get; set; }
        public string JwksUri { get; set; }
        public string EndSessionEndpoint { get; set; }
        public string IntrospectionEndpoint { get; set; }
        public string RevocationEndpoint { get; set; }
        public string ClientId { get; set; }
        public string ClientAuthMethod { get; set; } = "client_secret_basic";
        public string ClientSecretSettingKey { get; set; }
        public IReadOnlyList<string> Scopes { get; set; } = Array.Empty<string>();
        public IReadOnlyList<string> RedirectUris { get; set; } = Array.Empty<string>();
        public IReadOnlyList<string> PostLogoutRedirectUris { get; set; } = Array.Empty<string>();
        public string SubjectClaim { get; set; } = "sub";
        public string AccountClaim { get; set; } = "preferred_username";
        public string NameClaim { get; set; } = "name";
        public string EmailClaim { get; set; } = "email";
        public string RoleClaim { get; set; } = "roles";
        public JObject ClaimMappings { get; set; } = new JObject();
        public JObject RoleMappings { get; set; } = new JObject();
        public string ProvisioningMode { get; set; } = "BoundOnly";
        public IReadOnlyList<string> JitDefaultRoleIds { get; set; } = Array.Empty<string>();
        public bool RequirePkce { get; set; } = true;
        public bool RequireNonce { get; set; } = true;
        public bool ValidateIssuer { get; set; } = true;
        public bool ValidateAudience { get; set; } = true;
        public bool AllowPrivateEndpoint { get; set; }
        public bool AllowLoopbackRedirectUri { get; set; }
        public int AccessTokenLifetimeMinutes { get; set; } = 15;
        public int RefreshTokenLifetimeDays { get; set; } = 14;

        public string EntityId { get; set; }
        public string MetadataUrl { get; set; }
        public string SingleSignOnUrl { get; set; }
        public string SingleLogoutUrl { get; set; }
        public string AssertionConsumerServiceUrl { get; set; }
        public string SigningCertificateSettingKey { get; set; }
        public string ValidationCertificateSettingKey { get; set; }
        public string EncryptionCertificateSettingKey { get; set; }
        public bool RequireSignedAssertions { get; set; } = true;
        public bool EncryptAssertions { get; set; }

        public string CasServerUrl { get; set; }
        public string CasVersion { get; set; } = "3.0";

        public string ServerSsoApi { get; set; }
        public string ClientSsoApi { get; set; }
        public string TokenName { get; set; }
        public string GetTokenType { get; set; }

        public bool IsInbound => string.Equals(Direction, SsoSecurity.InboundDirection,
            StringComparison.OrdinalIgnoreCase);

        public bool IsOutbound => string.Equals(Direction, SsoSecurity.OutboundDirection,
            StringComparison.OrdinalIgnoreCase);

        public static SsoConnectionOptions FromRow(JObject row)
        {
            if (row == null) return null;
            var legacy = Text(row, "SsoKey").Length == 0
                         && (Text(row, "ServerSsoApi").Length > 0
                             || Text(row, "ClientSsoApi").Length > 0
                             || Text(row, "TokenName").Length > 0);
            var id = Text(row, "Id");
            var key = legacy
                ? "legacy-" + (id.Length >= 8 ? id.Substring(0, 8) : id.PadRight(8, '0'))
                : SsoSecurity.NormalizeConnectionKey(Text(row, "SsoKey"));
            var protocol = legacy ? "LEGACYTOKEN" : SsoSecurity.NormalizeProtocol(Text(row, "Protocol"));
            var direction = legacy
                ? SsoSecurity.InboundDirection
                : SsoSecurity.NormalizeDirection(Text(row, "Direction"));
            return new SsoConnectionOptions
            {
                Id = id,
                Key = key,
                Name = Text(row, "Name", Text(row, "Remark", key)),
                Direction = direction,
                Protocol = protocol,
                Description = Text(row, "Description", Text(row, "Remark")),
                Icon = Text(row, "Icon"),
                Sort = Int(row, "Sort", 100, 0, 100000),
                Enabled = Flag(row, "IsEnable", true),
                IsDefault = Flag(row, "IsDefault", false),

                Issuer = Text(row, "Issuer"),
                DiscoveryUrl = Text(row, "DiscoveryUrl"),
                AuthorizationEndpoint = Text(row, "AuthorizationEndpoint"),
                TokenEndpoint = Text(row, "TokenEndpoint"),
                UserInfoEndpoint = Text(row, "UserInfoEndpoint"),
                JwksUri = Text(row, "JwksUri"),
                EndSessionEndpoint = Text(row, "EndSessionEndpoint"),
                IntrospectionEndpoint = Text(row, "IntrospectionEndpoint"),
                RevocationEndpoint = Text(row, "RevocationEndpoint"),
                ClientId = Text(row, "ClientId"),
                ClientAuthMethod = NormalizeClientAuthMethod(Text(row, "ClientAuthMethod", "client_secret_basic")),
                ClientSecretSettingKey = Text(row, "ClientSecretSettingKey"),
                Scopes = SsoSecurity.ParseStringList(row["Scopes"]),
                RedirectUris = SsoSecurity.ParseStringList(row["RedirectUris"]),
                PostLogoutRedirectUris = SsoSecurity.ParseStringList(row["PostLogoutRedirectUris"]),
                SubjectClaim = Text(row, "SubjectClaim", "sub"),
                AccountClaim = Text(row, "AccountClaim", "preferred_username"),
                NameClaim = Text(row, "NameClaim", "name"),
                EmailClaim = Text(row, "EmailClaim", "email"),
                RoleClaim = Text(row, "RoleClaim", "roles"),
                ClaimMappings = Object(row, "ClaimMappings"),
                RoleMappings = Object(row, "RoleMappings"),
                ProvisioningMode = NormalizeProvisioningMode(Text(row, "ProvisioningMode", "BoundOnly")),
                JitDefaultRoleIds = SsoSecurity.ParseStringList(row["JitDefaultRoleIds"]),
                RequirePkce = Flag(row, "RequirePkce", true),
                RequireNonce = Flag(row, "RequireNonce", true),
                ValidateIssuer = Flag(row, "ValidateIssuer", true),
                ValidateAudience = Flag(row, "ValidateAudience", true),
                AllowPrivateEndpoint = Flag(row, "AllowPrivateEndpoint", false),
                AllowLoopbackRedirectUri = Flag(row, "AllowLoopbackRedirectUri", false),
                AccessTokenLifetimeMinutes = Int(row, "AccessTokenLifetimeMinutes", 15, 5, 1440),
                RefreshTokenLifetimeDays = Int(row, "RefreshTokenLifetimeDays", 14, 1, 90),

                EntityId = Text(row, "EntityId"),
                MetadataUrl = Text(row, "MetadataUrl"),
                SingleSignOnUrl = Text(row, "SingleSignOnUrl"),
                SingleLogoutUrl = Text(row, "SingleLogoutUrl"),
                AssertionConsumerServiceUrl = Text(row, "AssertionConsumerServiceUrl"),
                SigningCertificateSettingKey = Text(row, "SigningCertificateSettingKey"),
                ValidationCertificateSettingKey = Text(row, "ValidateCertSettingKey",
                    Text(row, "ValidationCertificateSettingKey")),
                EncryptionCertificateSettingKey = Text(row, "EncryptCertSettingKey",
                    Text(row, "EncryptionCertificateSettingKey")),
                RequireSignedAssertions = Flag(row, "RequireSignedAssertions", true),
                EncryptAssertions = Flag(row, "EncryptAssertions", false),

                CasServerUrl = Text(row, "CasServerUrl"),
                CasVersion = NormalizeCasVersion(Text(row, "CasVersion", "3.0")),
                ServerSsoApi = Text(row, "ServerSsoApi"),
                ClientSsoApi = Text(row, "ClientSsoApi"),
                TokenName = Text(row, "TokenName", "token"),
                GetTokenType = Text(row, "GetTokenType", "Url")
            };
        }

        public JObject ToPublicProjection()
        {
            return new JObject
            {
                ["ConnectionKey"] = Key,
                ["Name"] = Name,
                ["Protocol"] = Protocol,
                ["Description"] = Description,
                ["Icon"] = Icon,
                ["Sort"] = Sort,
                ["IsDefault"] = IsDefault,
                ["BeginUrl"] = $"/api/Sso/Begin?ConnectionKey={Uri.EscapeDataString(Key)}"
            };
        }

        private static string NormalizeProvisioningMode(string value)
        {
            var normalized = (value ?? string.Empty).Trim();
            return new[] { "BoundOnly", "JitCreate", "JitMatch" }
                       .FirstOrDefault(item => string.Equals(item, normalized, StringComparison.OrdinalIgnoreCase))
                   ?? "BoundOnly";
        }

        private static string NormalizeCasVersion(string value)
        {
            var normalized = (value ?? string.Empty).Trim();
            return new[] { "1.0", "2.0", "3.0" }.Contains(normalized, StringComparer.Ordinal)
                ? normalized
                : "3.0";
        }

        private static string NormalizeClientAuthMethod(string value)
        {
            var normalized = (value ?? string.Empty).Trim();
            return new[] { "client_secret_basic", "client_secret_post", "none" }
                       .FirstOrDefault(item => string.Equals(item, normalized, StringComparison.OrdinalIgnoreCase))
                   ?? "client_secret_basic";
        }

        private static string Text(JObject row, string name, string fallback = "")
        {
            var value = row?[name];
            return value == null || value.Type == JTokenType.Null
                ? fallback
                : (value.ToString() ?? string.Empty).Trim();
        }

        private static bool Flag(JObject row, string name, bool fallback)
        {
            var token = row?[name];
            if (token == null || token.Type == JTokenType.Null) return fallback;
            if (token.Type == JTokenType.Boolean) return token.Value<bool>();
            if (token.Type == JTokenType.Integer) return token.Value<long>() != 0;
            var value = token.ToString().Trim();
            if (new[] { "1", "true", "yes", "on", "enabled" }.Contains(value, StringComparer.OrdinalIgnoreCase))
                return true;
            if (new[] { "0", "false", "no", "off", "disabled" }.Contains(value, StringComparer.OrdinalIgnoreCase))
                return false;
            return fallback;
        }

        private static int Int(JObject row, string name, int fallback, int min, int max)
        {
            return int.TryParse(Text(row, name), out var value) && value >= min && value <= max
                ? value
                : fallback;
        }

        private static JObject Object(JObject row, string name)
        {
            var token = row?[name];
            if (token is JObject obj) return (JObject)obj.DeepClone();
            try { return JObject.Parse(token?.ToString() ?? string.Empty); }
            catch { return new JObject(); }
        }
    }
}
