using System;
using System.Collections.Generic;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net.Api
{
    /// <summary>
    /// Microi 双向 SSO 最小协议网关。
    /// 外部 OIDC/CAS 身份只负责认证与主体映射，进入平台时仍签发 DiyToken；
    /// Microi 作为身份提供方时使用独立、短期、可撤销的协议票据，不把 DiyToken
    /// 暴露给第三方系统。
    /// </summary>
    [EnableCors("any")]
    // 固定显式路由，保证协议网关类名调整后旧版客户端和第三方回调地址完全不变。
    [Route("api/Sso/[action]")]
    public sealed partial class SsoProtocolGatewayController : Controller
    {
        private const string ConnectionRuntimeApiEngineKey = "sso_connection_runtime";
        private const string ResolveIdentityApiEngineKey = "sso_resolve_federated_identity";
        private const string ProtocolEventApiEngineKey = "sso_protocol_event";
        private const string OutboundClaimsApiEngineKey = "sso_outbound_claims";
        private const string UserRuntimeApiEngineKey = "sso_user_runtime";
        private const string SigningKeySetting = "SSO.OIDC.SigningPrivateKey";
        private const string PairwiseKeySetting = "SSO.OIDC.PairwiseSubjectKey";
        private static readonly TimeSpan InboundStateLifetime = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan LoginTicketLifetime = TimeSpan.FromSeconds(90);
        private static readonly TimeSpan AuthorizationRequestLifetime = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan AuthorizationCodeLifetime = TimeSpan.FromMinutes(3);
        private static readonly TimeSpan ProviderSessionLifetime = TimeSpan.FromMinutes(20);

        public sealed class BeginRequest
        {
            public string OsClient { get; set; }
            public string ConnectionKey { get; set; }
            public string ReturnOrigin { get; set; }
        }

        public sealed class CompleteAuthorizationRequest
        {
            public string OsClient { get; set; }
            public string RequestId { get; set; }
        }

        private sealed class InboundState
        {
            public string OsClient { get; set; }
            public string ConnectionKey { get; set; }
            public string Protocol { get; set; }
            public string Nonce { get; set; }
            public string PkceVerifier { get; set; }
            public string RedirectUri { get; set; }
            public string ReturnOrigin { get; set; }
            public string SamlRequestId { get; set; }
            public string CreatedAt { get; set; }
            public string ExpiresAt { get; set; }
        }

        private sealed class AuthorizationRequestState
        {
            public string OsClient { get; set; }
            public string Protocol { get; set; }
            public string ConnectionKey { get; set; }
            public string ClientId { get; set; }
            public string RedirectUri { get; set; }
            public string ResponseType { get; set; }
            public string Scope { get; set; }
            public string State { get; set; }
            public string Nonce { get; set; }
            public string CodeChallenge { get; set; }
            public string CodeChallengeMethod { get; set; }
            public string Service { get; set; }
            public string SamlRequestId { get; set; }
            public string RelayState { get; set; }
            public string CreatedAt { get; set; }
            public string ExpiresAt { get; set; }
        }

        private sealed class AuthorizationCodePayload
        {
            public string OsClient { get; set; }
            public string ConnectionKey { get; set; }
            public string ClientId { get; set; }
            public string RedirectUri { get; set; }
            public string Scope { get; set; }
            public string Nonce { get; set; }
            public string CodeChallenge { get; set; }
            public string UserId { get; set; }
            public long AuthTime { get; set; }
            public string ExpiresAt { get; set; }
        }

        private sealed class ProtocolTokenPayload
        {
            public string OsClient { get; set; }
            public string ConnectionKey { get; set; }
            public string ClientId { get; set; }
            public string UserId { get; set; }
            public string Subject { get; set; }
            public string Scope { get; set; }
            public string TokenType { get; set; }
            public string FamilyId { get; set; }
            public string ExpiresAt { get; set; }
        }

        private sealed class FederatedProfile
        {
            public string Subject { get; set; }
            public string Account { get; set; }
            public string Name { get; set; }
            public string Email { get; set; }
            public JObject Claims { get; set; } = new JObject();
        }

        private sealed class ProviderSession
        {
            public string OsClient { get; set; }
            public string DiyToken { get; set; }
            public string UserId { get; set; }
            public long AuthTime { get; set; }
            public string ExpiresAt { get; set; }
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> Begin([FromBody] BeginRequest request)
        {
            var tenant = ResolveAnonymousTenant(request?.OsClient);
            if (tenant.Code != 1) return Json(tenant);
            if (!await AllowAnonymousAttemptAsync(tenant.Data, "Begin").ConfigureAwait(false))
                return Json(new DosResult(0, null, "SSO 发起过于频繁，请稍后再试。"));
            var connection = await FindConnectionAsync(tenant.Data, request?.ConnectionKey,
                SsoSecurity.InboundDirection).ConfigureAwait(false);
            if (connection == null || !connection.Enabled)
                return Json(new DosResult(0, null, "SSO 连接不存在或未启用。"));
            if (connection.Protocol == "OIDC")
                return await BeginOidcAsync(tenant.Data, connection, request?.ReturnOrigin).ConfigureAwait(false);
            if (connection.Protocol == "CAS")
                return await BeginCasAsync(tenant.Data, connection, request?.ReturnOrigin).ConfigureAwait(false);
            if (connection.Protocol == "SAML2")
                return await BeginSamlAsync(tenant.Data, connection, request?.ReturnOrigin).ConfigureAwait(false);
            return Json(new DosResult(0, null, "LegacyToken 只保留兼容，不通过标准 SSO 入口发起。"));
        }

        [HttpPost]
        public async Task<JsonResult> CompleteAuthorization([FromBody] CompleteAuthorizationRequest request)
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            if (request != null && !request.OsClient.DosIsNullOrWhiteSpace()
                && !string.Equals(request.OsClient, token.Data.OsClient, StringComparison.OrdinalIgnoreCase))
                return Json(new DosResult(0, null, "禁止跨租户完成 SSO 授权。"));
            if (!IsOpaque(request?.RequestId)) return Json(new DosResult(0, null, "SSO 授权请求无效。"));
            AuthorizationRequestState pending = null;
            try
            {
                var raw = await Cache(token.Data.OsClient)
                    .StringGetDeleteAsync(AuthorizationRequestKey(token.Data.OsClient, request.RequestId))
                    .ConfigureAwait(false);
                if (raw.HasValue) pending = JsonConvert.DeserializeObject<AuthorizationRequestState>(raw.ToString());
            }
            catch { }
            if (!IsValidPending(pending, token.Data.OsClient))
                return Json(new DosResult(0, null, "SSO 授权请求不存在、已过期或已使用。"));
            await EstablishProviderSessionAsync(token.Data).ConfigureAwait(false);
            var redirect = await CompletePendingAuthorizationAsync(pending, token.Data.CurrentUser,
                DateTimeOffset.UtcNow.ToUnixTimeSeconds()).ConfigureAwait(false);
            if (redirect.Code != 1) return Json(redirect);
            return Json(new DosResult(1, new { RedirectUrl = redirect.Data }));
        }

    }
}
