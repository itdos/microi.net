using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// SSO 对 V8 的最小可信门面。协议、票据、身份联邦和密钥实现均位于
    /// Microi.SSO；Core 只保留精确 ApiEngineKey 授权与 HTTP 响应签名边界。
    /// </summary>
    public partial class V8Method
    {
        private const string SsoResolveIdentityEngineKey = "sso_resolve_federated_identity";
        private const string SsoCompleteLoginEngineKey = "sso_complete_login";
        private const string SsoLegacyLoginEngineKey = "sso_legacy_token_login";
        private const string SsoRotateSecretEngineKey = "sso_rotate_client_secret";

        private static readonly IReadOnlyDictionary<string, string[]> SsoProtocolEngineKeys =
            new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["Begin"] = new[] { "sso_http_begin" },
                ["CompleteAuthorization"] = new[] { "sso_http_complete_authorization" },
                ["OidcCallback"] = new[] { "sso_http_oidc_callback" },
                ["OidcDiscovery"] = new[] { "sso_http_oidc_discovery" },
                ["OidcJwks"] = new[] { "sso_http_oidc_jwks" },
                ["OidcAuthorize"] = new[] { "sso_http_oidc_authorize" },
                ["OidcToken"] = new[] { "sso_http_oidc_token" },
                ["OidcUserInfo"] = new[] { "sso_http_oidc_userinfo" },
                ["OidcIntrospect"] = new[] { "sso_http_oidc_introspect" },
                ["OidcRevoke"] = new[] { "sso_http_oidc_revoke" },
                ["OidcEndSession"] = new[] { "sso_http_oidc_logout" },
                ["CasCallback"] = new[] { "sso_http_cas_callback" },
                ["CasLogin"] = new[] { "sso_http_cas_login" },
                ["CasServiceValidate"] = new[]
                {
                    "sso_http_cas_service_validate", "sso_http_cas_p3_service_validate"
                },
                ["CasValidate"] = new[] { "sso_http_cas_validate" },
                ["CasLogout"] = new[] { "sso_http_cas_logout" },
                ["SamlBegin"] = new[] { "sso_http_saml_begin" },
                ["SamlAcs"] = new[] { "sso_http_saml_acs" },
                ["SamlLogin"] = new[] { "sso_http_saml_login" },
                ["SamlComplete"] = new[] { "sso_http_saml_complete" },
                ["SamlIdpMetadata"] = new[] { "sso_http_saml_idp_metadata" },
                ["SamlSpMetadata"] = new[] { "sso_http_saml_sp_metadata" },
                ["SamlLogout"] = new[] { "sso_http_saml_logout" }
            };

        /// <summary>
        /// 所有可信 V8 原子共用的调用方白名单门禁。只允许当前租户上下文中的
        /// 官方 Managed 接口引擎按精确 Key 调用，禁止普通租户脚本直接触达。
        /// </summary>
        private static DosResult RequireTrustedApiEngine(params string[] allowedKeys)
        {
            var context = V8TenantContext.Current;
            if (context == null || context.OsClient.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "可信原子能力只能在租户接口引擎上下文中调用。");
            if (!(allowedKeys ?? Array.Empty<string>()).Any(key =>
                    string.Equals(key, context.ApiEngineKey, StringComparison.OrdinalIgnoreCase)))
            {
                Console.WriteLine(
                    $"Microi：【安全】拒绝接口引擎[{context.ApiEngineKey ?? "-"}]调用可信原子能力，" +
                    $"OsClient=[{context.OsClient}]。");
                return new DosResult(0, null, "当前接口引擎无权调用该可信原子能力。");
            }
            return null;
        }

        private static string SsoAtomText(JToken token, int maxLength = 0)
        {
            var value = token == null || token.Type == JTokenType.Null
                ? string.Empty
                : (token.ToString() ?? string.Empty).Trim();
            return maxLength > 0 && value.Length > maxLength ? value.Substring(0, maxLength) : value;
        }

        private static DosResult RunSsoTrustedAction(
            string operation,
            dynamic dynamicParam,
            params string[] allowedKeys)
        {
            var denied = RequireTrustedApiEngine(allowedKeys);
            if (denied != null) return denied;
            var runtime = SsoProtocolRuntimeBridge.Current;
            if (runtime == null)
                return new DosResult(0, null, "SSO 插件尚未注册，请检查 Microi.SSO 包和 AddMicroiSSO 配置。");
            return runtime.ExecuteTrusted(
                operation,
                JsonHelper.ToJObject((object)dynamicParam) ?? new JObject());
        }

        public DosResult CreateFederatedUser(dynamic dynamicParam) =>
            RunSsoTrustedAction("CreateFederatedUser", dynamicParam, SsoResolveIdentityEngineKey);

        public DosResult CreateSsoLoginTicket(dynamic dynamicParam) =>
            RunSsoTrustedAction("CreateLoginTicket", dynamicParam, SsoLegacyLoginEngineKey);

        public DosResult CompleteSsoLogin(dynamic dynamicParam) =>
            RunSsoTrustedAction(
                "CompleteLogin",
                dynamicParam,
                SsoCompleteLoginEngineKey,
                SsoLegacyLoginEngineKey);

        public DosResult RotateSsoClientSecret(dynamic dynamicParam) =>
            RunSsoTrustedAction("RotateClientSecret", dynamicParam, SsoRotateSecretEngineKey);

        /// <summary>
        /// 执行固定 SSO 协议原子。公开地址、匿名策略和调用顺序由 Managed 接口引擎
        /// 决定；此处只允许 Operation 对应的精确官方 Key，并对完整 HTTP 响应签名。
        /// </summary>
        public DosResult RunSsoProtocol(dynamic dynamicParam)
        {
            try
            {
                var request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var operation = SsoAtomText(request["Operation"], 80);
                string[] allowedKeys;
                if (!SsoProtocolEngineKeys.TryGetValue(operation, out allowedKeys))
                    return new DosResult(0, null, "SSO 协议原子 Operation 无效。");
                var denied = RequireTrustedApiEngine(allowedKeys);
                if (denied != null) return denied;
                var runtime = SsoProtocolRuntimeBridge.Current;
                if (runtime == null)
                    return new DosResult(0, null, "SSO 插件尚未注册，请检查 Microi.SSO 包和 AddMicroiSSO 配置。");

                var parameters = request["Param"] as JObject
                                 ?? (request["Param"] == null
                                     ? new JObject()
                                     : JObject.FromObject(request["Param"]));
                var context = V8TenantContext.Current;
                var response = runtime.ExecuteAsync(operation, parameters, DiyHttpContext.Current)
                    .GetAwaiter().GetResult();
                var signature = ApiEngineHttpResponseSecurity.Sign(
                    response,
                    context.OsClient,
                    context.ApiEngineKey);
                return new DosResult(1, null)
                {
                    DataAppend = new JObject
                    {
                        ["HttpResponse"] = response,
                        ["HttpResponseSignature"] = signature
                    }
                };
            }
            catch (Exception ex)
            {
                var osClient = V8TenantContext.Current?.OsClient;
                MicroiEngine.QueueSystemLog(
                    osClient,
                    "SsoProtocol",
                    "TrustedAtomFailed",
                    "SSO 可信协议原子执行失败",
                    ex.ToString(),
                    3,
                    false,
                    V8TenantContext.Current?.ApiEngineKey);
                return new DosResult(0, null, "SSO 协议处理失败，请使用 TraceId 查询系统日志。");
            }
        }
    }
}
