using System;
using System.Collections.Specialized;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.ServiceModel.Security;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using ITfoxtec.Identity.Saml2;
using ITfoxtec.Identity.Saml2.Schemas;
using ITfoxtec.Identity.Saml2.Schemas.Metadata;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens.Saml2;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    public sealed partial class SsoProtocolRuntime
    {
        private const string DefaultSamlSigningSetting = "SSO.SAML.SigningCertificate";

        private sealed class SamlHandoff
        {
            public AuthorizationRequestState Pending { get; set; }
            public string UserId { get; set; }
            public long AuthTime { get; set; }
            public string ExpiresAt { get; set; }
        }

        private async Task<JsonResult> BeginSamlAsync(
            string osClient,
            SsoConnectionOptions connection,
            string returnOrigin)
        {
            if (connection.SingleSignOnUrl.DosIsNullOrWhiteSpace()
                || connection.EntityId.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "SAML2 入站连接必须配置外部 IdP EntityId 与 SingleSignOnUrl。"));
            if (connection.ValidationCertificateSettingKey.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "SAML2 入站连接必须配置 IdP 验签证书设置 Key。"));
            var normalizedOrigin = ResolveReturnOrigin(returnOrigin);
            if (normalizedOrigin == null) return Json(new DosResult(0, null, "SSO 回传 Origin 无效。"));
            var stateValue = SsoSecurity.NewOpaqueValue();
            var callback = BuildInboundCallbackUrl("SamlAcs", osClient, connection.Key);
            var now = DateTimeOffset.UtcNow;
            var state = new InboundState
            {
                OsClient = osClient,
                ConnectionKey = connection.Key,
                Protocol = "SAML2",
                RedirectUri = callback,
                ReturnOrigin = normalizedOrigin,
                CreatedAt = now.ToString("O"),
                ExpiresAt = now.Add(InboundStateLifetime).ToString("O")
            };
            var saved = await Cache(osClient).StringSetAsync(InboundStateKey(osClient, stateValue),
                JsonConvert.SerializeObject(state), InboundStateLifetime, When.NotExists).ConfigureAwait(false);
            if (!saved) return Json(new DosResult(0, null, "SAML2 安全状态创建失败，请重试。"));
            var beginUrl = AppendQuery($"{Request.Scheme}://{Request.Host}{Request.PathBase}/api/Sso/SamlBegin",
                new Dictionary<string, string>
                {
                    ["OsClient"] = osClient, ["ConnectionKey"] = connection.Key, ["state"] = stateValue
                });
            Response.Headers["Cache-Control"] = "no-store";
            return Json(new DosResult(1, new
            {
                Provider = connection.Key,
                connection.Name,
                Protocol = "SAML2",
                AuthorizeUrl = beginUrl,
                CallbackUrl = callback,
                MetadataUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}/saml/{Uri.EscapeDataString(osClient)}/sp/{Uri.EscapeDataString(connection.Key)}/metadata",
                ExpiresInSeconds = (int)InboundStateLifetime.TotalSeconds,
                Popup = new { Width = 760, Height = 780 }
            }));
        }

        public async Task<IActionResult> SamlBegin(string OsClient, string ConnectionKey, string state)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1 || !IsOpaque(state)) return BadRequest("SAML request is invalid");
            InboundState stateModel = null;
            try
            {
                var raw = await Cache(tenant.Data).StringGetAsync(InboundStateKey(tenant.Data, state)).ConfigureAwait(false);
                if (raw.HasValue) stateModel = JsonConvert.DeserializeObject<InboundState>(raw.ToString());
            }
            catch { }
            if (!IsValidInboundState(stateModel, tenant.Data, ConnectionKey, "SAML2"))
                return BadRequest("SAML request is expired");
            var connection = await FindConnectionAsync(tenant.Data, ConnectionKey,
                SsoSecurity.InboundDirection).ConfigureAwait(false);
            if (connection == null || connection.Protocol != "SAML2") return BadRequest("SAML connection is disabled");
            var configResult = await BuildInboundSamlConfigurationAsync(tenant.Data, connection).ConfigureAwait(false);
            if (configResult.Code != 1) return StatusCode(503, configResult.Msg);
            var request = new Saml2AuthnRequest(configResult.Data)
            {
                AssertionConsumerServiceUrl = new Uri(stateModel.RedirectUri),
                NameIdPolicy = new NameIdPolicy
                {
                    AllowCreate = true,
                    Format = NameIdentifierFormats.Persistent.OriginalString
                }
            };
            var binding = new Saml2RedirectBinding { RelayState = state };
            binding.Bind(request);
            stateModel.SamlRequestId = request.IdAsString;
            var updated = await Cache(tenant.Data).StringSetAsync(InboundStateKey(tenant.Data, state),
                JsonConvert.SerializeObject(stateModel), InboundStateLifetime, When.Exists).ConfigureAwait(false);
            if (!updated) return BadRequest("SAML request state is expired");
            SetNoStore();
            // RedirectBinding 只负责标准 SAML 报文签名/压缩；HTTP 302 由接口引擎
            // 的受控响应契约统一写出。
            return Redirect(binding.RedirectLocation.AbsoluteUri);
        }

        public async Task<IActionResult> SamlAcs(string OsClient, string ConnectionKey)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1 || !Request.HasFormContentType)
                return PopupResult(null, ConnectionKey, false, "SAML2 回调请求无效。", null);
            var form = await Request.ReadFormAsync().ConfigureAwait(false);
            var relayState = form["RelayState"].ToString();
            if (!IsOpaque(relayState))
                return PopupResult(null, ConnectionKey, false, "SAML2 RelayState 无效。", null);
            InboundState stateModel = null;
            try
            {
                var raw = await Cache(tenant.Data).StringGetAsync(InboundStateKey(tenant.Data, relayState)).ConfigureAwait(false);
                if (raw.HasValue) stateModel = JsonConvert.DeserializeObject<InboundState>(raw.ToString());
            }
            catch { }
            if (!IsValidInboundState(stateModel, tenant.Data, ConnectionKey, "SAML2")
                || stateModel.SamlRequestId.DosIsNullOrWhiteSpace())
                return PopupResult(null, ConnectionKey, false, "SAML2 安全状态不存在、已过期或已使用。", null);
            var connection = await FindConnectionAsync(tenant.Data, ConnectionKey,
                SsoSecurity.InboundDirection).ConfigureAwait(false);
            if (connection == null || connection.Protocol != "SAML2")
                return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, "SAML2 连接已停用。", null);
            var configResult = await BuildInboundSamlConfigurationAsync(tenant.Data, connection).ConfigureAwait(false);
            if (configResult.Code != 1)
                return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, configResult.Msg, null);
            try
            {
                var httpRequest = await CreateSamlHttpRequestAsync(Request).ConfigureAwait(false);
                var response = new Saml2AuthnResponse(configResult.Data);
                httpRequest.Binding.ReadSamlResponse(httpRequest, response);
                if (response.Status != Saml2StatusCodes.Success)
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false,
                        "SAML2 IdP 返回失败状态。", null);
                httpRequest.Binding.Unbind(httpRequest, response);
                if (!SsoSecurity.FixedEquals(response.InResponseToAsString, stateModel.SamlRequestId))
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false,
                        "SAML2 InResponseTo 与原请求不一致。", null);
                var consumed = await Cache(tenant.Data).StringGetDeleteAsync(InboundStateKey(tenant.Data, relayState))
                    .ConfigureAwait(false);
                if (!consumed.HasValue)
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false,
                        "SAML2 Response 已使用。", null);
                var claims = ClaimsToObject(response.ClaimsIdentity?.Claims);
                var nameId = response.NameId?.Value;
                if (!nameId.DosIsNullOrWhiteSpace())
                {
                    claims["nameid"] = nameId;
                    if (claims[connection.SubjectClaim] == null) claims[connection.SubjectClaim] = nameId;
                }
                var profile = new FederatedProfile { Claims = claims };
                ApplyProfileClaims(profile, connection);
                if (profile.Subject.DosIsNullOrWhiteSpace()) profile.Subject = nameId;
                var user = await ResolveFederatedUserAsync(tenant.Data, connection, profile).ConfigureAwait(false);
                if (user.Code != 1)
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, user.Msg, null);
                var ticket = await CreateLoginTicketAsync(tenant.Data, connection, user.Data["Id"]?.ToString())
                    .ConfigureAwait(false);
                if (ticket.DosIsNullOrWhiteSpace())
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, "SSO 登录票据创建失败。", null);
                QueueAudit(tenant.Data, user.Data["Id"]?.ToString(), "InboundSsoVerified", true,
                    connection.Key, "SAML2", null);
                return PopupResult(stateModel.ReturnOrigin, connection.Key, true,
                    "SAML2 身份验证成功，正在进入系统。", ticket);
            }
            catch
            {
                QueueAudit(tenant.Data, null, "InboundSsoFailed", false, ConnectionKey, "SAML2", "SignatureOrAssertionInvalid");
                return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false,
                    "SAML2 Response 签名、证书、Audience、时间或加密断言验证失败。", null);
            }
        }

        private async Task<DosResult<Saml2Configuration>> BuildInboundSamlConfigurationAsync(
            string osClient,
            SsoConnectionOptions connection)
        {
            try
            {
                SsoSecurity.RequireAbsoluteEndpoint(connection.SingleSignOnUrl, connection.AllowPrivateEndpoint);
                var signing = await LoadOrCreateSamlSigningCertificateAsync(osClient,
                    connection.SigningCertificateSettingKey).ConfigureAwait(false);
                var validation = LoadCertificateSetting(osClient, connection.ValidationCertificateSettingKey,
                    requirePrivateKey: false);
                if (signing == null || validation == null)
                    return new DosResult<Saml2Configuration>(0, null, "SAML2 签名或 IdP 验签证书不可用。");
                var entityId = BuildSpEntityId(osClient, connection.Key);
                var config = new Saml2Configuration
                {
                    Issuer = entityId,
                    AllowedIssuer = connection.EntityId,
                    SingleSignOnDestination = new Uri(connection.SingleSignOnUrl),
                    SingleLogoutDestination = connection.SingleLogoutUrl.DosIsNullOrWhiteSpace()
                        ? null : new Uri(connection.SingleLogoutUrl),
                    SigningCertificate = signing,
                    SignAuthnRequest = true,
                    CertificateValidationMode = X509CertificateValidationMode.None,
                    RevocationMode = X509RevocationMode.NoCheck,
                    AudienceRestricted = true
                };
                config.AllowedAudienceUris.Add(entityId);
                config.SignatureValidationCertificates.Add(validation);
                config.DecryptionCertificates.Add(signing);
                return new DosResult<Saml2Configuration>(1, config);
            }
            catch { return new DosResult<Saml2Configuration>(0, null, "SAML2 连接地址或证书配置无效。"); }
        }

        private string BuildSpEntityId(string osClient, string connectionKey) =>
            $"{Request.Scheme}://{Request.Host}{Request.PathBase}/saml/{Uri.EscapeDataString(osClient)}/sp/{Uri.EscapeDataString(connectionKey)}";

        private string BuildIdpEntityId(string osClient) =>
            $"{Request.Scheme}://{Request.Host}{Request.PathBase}/saml/{Uri.EscapeDataString(osClient)}";

        /// <summary>
        /// 将 ASP.NET Core 请求转换成 ITfoxtec 的协议无关请求模型。该适配替代
        /// MvcCore Controller 扩展，使 SAML 原子可以留在 Microi.net 类库中。
        /// </summary>
        private static async Task<ITfoxtec.Identity.Saml2.Http.HttpRequest> CreateSamlHttpRequestAsync(
            HttpRequest request)
        {
            var query = new NameValueCollection(StringComparer.OrdinalIgnoreCase);
            foreach (var item in request.Query)
                foreach (var value in item.Value) query.Add(item.Key, value);

            var form = new NameValueCollection(StringComparer.OrdinalIgnoreCase);
            if (request.HasFormContentType)
            {
                var source = await request.ReadFormAsync().ConfigureAwait(false);
                foreach (var item in source)
                    foreach (var value in item.Value) form.Add(item.Key, value);
            }

            var usePost = string.Equals(request.Method, "POST", StringComparison.OrdinalIgnoreCase)
                          || form["SAMLRequest"] != null || form["SAMLResponse"] != null;
            return new ITfoxtec.Identity.Saml2.Http.HttpRequest
            {
                Method = request.Method,
                QueryString = request.QueryString.Value?.TrimStart('?') ?? string.Empty,
                Query = query,
                Form = form,
                Binding = usePost ? (Saml2Binding)new Saml2PostBinding() : new Saml2RedirectBinding()
            };
        }
    }
}
