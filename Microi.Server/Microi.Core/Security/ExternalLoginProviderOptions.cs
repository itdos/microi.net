using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 固定协议、租户自有凭据的外部登录供应商目录。端点由核心代码固定，避免管理员
    /// 自定义 URL 把 OAuth code/Secret 发送到任意主机；名称和开关来自当前租户设置。
    /// </summary>
    public sealed class ExternalLoginProviderOptions
    {
        public string Key { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string Kind { get; set; }
        public string Icon { get; set; }
        public bool Enabled { get; set; }
        public string ClientId { get; set; }
        public string ClientSecret { get; set; }
        public string Scope { get; set; }
        public string AuthorizationEndpoint { get; set; }
        public string TokenEndpoint { get; set; }
        public string UserInfoEndpoint { get; set; }
        public int Sort { get; set; }
        public bool Configured => Enabled
                                  && !string.IsNullOrWhiteSpace(ClientId)
                                  && !string.IsNullOrWhiteSpace(ClientSecret);
    }

    public static class ExternalLoginProviderCatalog
    {
        public static IReadOnlyList<ExternalLoginProviderOptions> Resolve(string osClient)
        {
            var model = OsClientExtend.GetClient(osClient)?.OsClientModel ?? new JObject();
            var settings = TenantSystemSettingsSecurity.LoadSnapshot(osClient);
            if (!TenantSystemSettingsSecurity.GetBool(settings, "Login.External.Enabled", true))
                return Array.Empty<ExternalLoginProviderOptions>();

            return new[]
            {
                Create(settings, model, "Gitee", "Gitee 登录", "使用已绑定的 Gitee 身份安全登录", "oauth", "gitee", 30,
                    "https://gitee.com/oauth/authorize", "https://gitee.com/oauth/token", "https://gitee.com/api/v5/user",
                    "user_info", "GiteeOAuthClientId", "GiteeOAuthClientSecret"),
                Create(settings, model, "WeChat", "微信扫码登录", "使用微信开放平台扫码并登录已绑定账号", "qr", "wechat", 40,
                    "https://open.weixin.qq.com/connect/qrconnect", "https://api.weixin.qq.com/sns/oauth2/access_token",
                    "https://api.weixin.qq.com/sns/userinfo", "snsapi_login", "WeChatAppId", "WeChatAppSecret"),
                Create(settings, model, "GitHub", "GitHub 登录", "使用已绑定的 GitHub 身份安全登录", "oauth", "github", 50,
                    "https://github.com/login/oauth/authorize", "https://github.com/login/oauth/access_token",
                    "https://api.github.com/user", "read:user user:email", null, null)
            };
        }

        public static ExternalLoginProviderOptions ResolveOne(string osClient, string providerKey)
        {
            return Resolve(osClient).FirstOrDefault(item => string.Equals(
                item.Key, (providerKey ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase));
        }

        private static ExternalLoginProviderOptions Create(
            IReadOnlyDictionary<string, TenantSystemSettingValue> settings,
            JObject legacy,
            string key,
            string defaultName,
            string defaultDescription,
            string kind,
            string icon,
            int sort,
            string authorizationEndpoint,
            string tokenEndpoint,
            string userInfoEndpoint,
            string defaultScope,
            string legacyClientId,
            string legacyClientSecret)
        {
            var prefix = "Login." + key + ".";
            var enabled = TenantSystemSettingsSecurity.GetBool(settings, prefix + "Enabled", false);
            var clientId = ReadText(settings, prefix + "ClientId", legacyClientId == null ? "" : legacy[legacyClientId]?.ToString());
            var clientSecret = ReadSecret(settings, prefix + "ClientSecret",
                legacyClientSecret == null ? "" : legacy[legacyClientSecret]?.ToString());
            return new ExternalLoginProviderOptions
            {
                Key = key,
                Name = ReadText(settings, prefix + "Name", defaultName),
                Description = ReadText(settings, prefix + "Description", defaultDescription),
                Kind = kind,
                Icon = icon,
                Enabled = enabled,
                ClientId = clientId,
                ClientSecret = clientSecret,
                Scope = ReadText(settings, prefix + "Scope", defaultScope),
                AuthorizationEndpoint = authorizationEndpoint,
                TokenEndpoint = tokenEndpoint,
                UserInfoEndpoint = userInfoEndpoint,
                Sort = sort
            };
        }

        private static string ReadText(
            IReadOnlyDictionary<string, TenantSystemSettingValue> settings,
            string key,
            string fallback)
        {
            if (settings != null && settings.TryGetValue(key, out var item) && item.IsEnabled && !item.IsSecret)
                return item.Value ?? string.Empty;
            return fallback ?? string.Empty;
        }

        private static string ReadSecret(
            IReadOnlyDictionary<string, TenantSystemSettingValue> settings,
            string key,
            string fallback)
        {
            try { return TenantSystemSettingsSecurity.GetText(settings, key, fallback ?? string.Empty, true); }
            catch { return string.Empty; }
        }
    }
}
