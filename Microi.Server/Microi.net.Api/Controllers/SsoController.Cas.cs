using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net.Api
{
    public sealed partial class SsoController
    {
        private sealed class CasTicketPayload
        {
            public string OsClient { get; set; }
            public string ConnectionKey { get; set; }
            public string Service { get; set; }
            public string UserId { get; set; }
            public long AuthTime { get; set; }
            public string ExpiresAt { get; set; }
        }

        private async Task<JsonResult> BeginCasAsync(
            string osClient,
            SsoConnectionOptions connection,
            string returnOrigin)
        {
            if (connection.CasServerUrl.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "CAS 连接未配置服务器地址。"));
            try { SsoSecurity.RequireAbsoluteEndpoint(connection.CasServerUrl, connection.AllowPrivateEndpoint); }
            catch { return Json(new DosResult(0, null, "CAS 服务器地址无效。")); }
            var normalizedOrigin = ResolveReturnOrigin(returnOrigin);
            if (normalizedOrigin == null) return Json(new DosResult(0, null, "SSO 回传 Origin 无效。"));
            var stateValue = SsoSecurity.NewOpaqueValue();
            var callback = BuildInboundCallbackUrl("CasCallback", osClient, connection.Key);
            callback = AppendQuery(callback, new Dictionary<string, string> { ["state"] = stateValue });
            var now = DateTimeOffset.UtcNow;
            var state = new InboundState
            {
                OsClient = osClient,
                ConnectionKey = connection.Key,
                Protocol = "CAS",
                RedirectUri = callback,
                ReturnOrigin = normalizedOrigin,
                CreatedAt = now.ToString("O"),
                ExpiresAt = now.Add(InboundStateLifetime).ToString("O")
            };
            var saved = await Cache(osClient).StringSetAsync(InboundStateKey(osClient, stateValue),
                JsonConvert.SerializeObject(state), InboundStateLifetime, When.NotExists).ConfigureAwait(false);
            if (!saved) return Json(new DosResult(0, null, "CAS 安全状态创建失败，请重试。"));
            var authorizeUrl = AppendQuery(connection.CasServerUrl.TrimEnd('/') + "/login",
                new Dictionary<string, string> { ["service"] = callback });
            Response.Headers.CacheControl = "no-store";
            return Json(new DosResult(1, new
            {
                Provider = connection.Key,
                connection.Name,
                Protocol = "CAS",
                AuthorizeUrl = authorizeUrl,
                CallbackUrl = callback,
                ExpiresInSeconds = (int)InboundStateLifetime.TotalSeconds,
                Popup = new { Width = 720, Height = 760 }
            }));
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> CasCallback(
            string ticket,
            string state,
            string OsClient,
            string ConnectionKey)
        {
            if (ticket.DosIsNullOrWhiteSpace() || !IsOpaque(state))
                return PopupResult(null, ConnectionKey, false, "CAS 未返回有效 Service Ticket。", null);
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return PopupResult(null, ConnectionKey, false, tenant.Msg, null);
            InboundState stateModel = null;
            try
            {
                var raw = await Cache(tenant.Data).StringGetDeleteAsync(InboundStateKey(tenant.Data, state))
                    .ConfigureAwait(false);
                if (raw.HasValue) stateModel = JsonConvert.DeserializeObject<InboundState>(raw.ToString());
            }
            catch { }
            if (!IsValidInboundState(stateModel, tenant.Data, ConnectionKey, "CAS"))
                return PopupResult(null, ConnectionKey, false, "CAS 安全状态不存在、已过期或已使用。", null);
            var connection = await FindConnectionAsync(tenant.Data, ConnectionKey,
                SsoSecurity.InboundDirection).ConfigureAwait(false);
            if (connection == null || !connection.Enabled || connection.Protocol != "CAS")
                return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, "CAS 连接已停用或配置已变更。", null);
            var validatePath = connection.CasVersion == "3.0" ? "/p3/serviceValidate" : "/serviceValidate";
            var validateUrl = AppendQuery(connection.CasServerUrl.TrimEnd('/') + validatePath,
                new Dictionary<string, string> { ["service"] = stateModel.RedirectUri, ["ticket"] = ticket });
            var response = await ExternalGetTextAsync(validateUrl, connection.AllowPrivateEndpoint).ConfigureAwait(false);
            if (response.Code != 1)
                return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, response.Msg, null);
            var profile = ParseCasSuccess(response.Data);
            if (profile == null)
                return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, "CAS Service Ticket 验证失败。", null);
            var user = await ResolveFederatedUserAsync(tenant.Data, connection, profile).ConfigureAwait(false);
            if (user.Code != 1) return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, user.Msg, null);
            var loginTicket = await CreateLoginTicketAsync(tenant.Data, connection, user.Data["Id"]?.ToString())
                .ConfigureAwait(false);
            if (loginTicket.DosIsNullOrWhiteSpace())
                return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, "SSO 登录票据创建失败。", null);
            QueueAudit(tenant.Data, user.Data["Id"]?.ToString(), "InboundSsoVerified", true,
                connection.Key, "CAS", null);
            return PopupResult(stateModel.ReturnOrigin, connection.Key, true,
                "CAS 身份验证成功，正在进入系统。", loginTicket);
        }

        [HttpGet("/cas/{OsClient}/login")]
        [AllowAnonymous]
        public async Task<IActionResult> CasLogin(string OsClient, string service, string renew, string gateway)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return BadRequest("invalid tenant");
            var client = await FindCasServiceAsync(tenant.Data, service).ConfigureAwait(false);
            if (client == null) return BadRequest("service is not registered");
            var pending = new AuthorizationRequestState
            {
                OsClient = tenant.Data,
                Protocol = "CAS",
                ConnectionKey = client.Key,
                ClientId = client.ClientId,
                Service = service,
                CreatedAt = DateTimeOffset.UtcNow.ToString("O"),
                ExpiresAt = DateTimeOffset.UtcNow.Add(AuthorizationRequestLifetime).ToString("O")
            };
            var session = await GetProviderSessionAsync(tenant.Data).ConfigureAwait(false);
            if (session != null && !string.Equals(renew, "true", StringComparison.OrdinalIgnoreCase))
            {
                var redirect = await CompleteCasPendingAsync(pending, session.CurrentUser, session.AuthTime).ConfigureAwait(false);
                return redirect.Code == 1 ? Redirect(redirect.Data) : StatusCode(503, redirect.Msg);
            }
            if (string.Equals(gateway, "true", StringComparison.OrdinalIgnoreCase)) return Redirect(service);
            var requestId = SsoSecurity.NewOpaqueValue();
            var saved = await Cache(tenant.Data).StringSetAsync(AuthorizationRequestKey(tenant.Data, requestId),
                JsonConvert.SerializeObject(pending), AuthorizationRequestLifetime, When.NotExists).ConfigureAwait(false);
            return saved
                ? Redirect(BuildFrontendAuthorizationUrl(tenant.Data, requestId))
                : StatusCode(503, "authorization state failed");
        }

        [HttpGet("/cas/{OsClient}/serviceValidate")]
        [HttpGet("/cas/{OsClient}/p3/serviceValidate")]
        [AllowAnonymous]
        public async Task<IActionResult> CasServiceValidate(string OsClient, string service, string ticket)
        {
            SetNoStore();
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return CasFailure("INVALID_REQUEST", "tenant is invalid");
            var client = await FindCasServiceAsync(tenant.Data, service).ConfigureAwait(false);
            if (client == null) return CasFailure("INVALID_SERVICE", "service is not registered");
            var payload = await ConsumeCasTicketAsync(tenant.Data, ticket).ConfigureAwait(false);
            if (payload == null || !SsoSecurity.FixedEquals(payload.Service, service)
                || !SsoSecurity.FixedEquals(payload.ConnectionKey, client.Key))
                return CasFailure("INVALID_TICKET", "ticket is invalid, expired, reused or bound to another service");
            var user = await GetEnabledUserAsync(tenant.Data, payload.UserId).ConfigureAwait(false);
            if (user == null) return CasFailure("INVALID_TICKET", "user is disabled");
            QueueAudit(tenant.Data, payload.UserId, "OutboundCasTicketConsumed", true, client.Key, "CAS", null);
            return CasSuccess(user);
        }

        [HttpGet("/cas/{OsClient}/validate")]
        [AllowAnonymous]
        public async Task<IActionResult> Cas10Validate(string OsClient, string service, string ticket)
        {
            SetNoStore();
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return Content("no\n\n", "text/plain", Encoding.UTF8);
            var client = await FindCasServiceAsync(tenant.Data, service).ConfigureAwait(false);
            var payload = client == null ? null : await ConsumeCasTicketAsync(tenant.Data, ticket).ConfigureAwait(false);
            if (payload == null || !SsoSecurity.FixedEquals(payload.Service, service)
                || !SsoSecurity.FixedEquals(payload.ConnectionKey, client.Key))
                return Content("no\n\n", "text/plain", Encoding.UTF8);
            var user = await GetEnabledUserAsync(tenant.Data, payload.UserId).ConfigureAwait(false);
            return user == null
                ? Content("no\n\n", "text/plain", Encoding.UTF8)
                : Content("yes\n" + (user["Account"]?.ToString() ?? payload.UserId) + "\n", "text/plain", Encoding.UTF8);
        }

        [HttpGet("/cas/{OsClient}/logout")]
        [AllowAnonymous]
        public async Task<IActionResult> CasLogout(string OsClient, string service)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return BadRequest();
            var sessionId = Request.Cookies[ProviderCookieName(tenant.Data)];
            if (IsOpaque(sessionId)) await Cache(tenant.Data).KeyDeleteAsync(ProviderSessionKey(tenant.Data, sessionId));
            Response.Cookies.Delete(ProviderCookieName(tenant.Data), new Microsoft.AspNetCore.Http.CookieOptions
            {
                Path = "/"
            });
            if (!service.DosIsNullOrWhiteSpace()
                && await FindCasServiceAsync(tenant.Data, service).ConfigureAwait(false) != null)
                return Redirect(service);
            return Content("已退出当前 CAS 浏览器会话。", "text/plain", Encoding.UTF8);
        }

        private static async Task<DosResult<string>> CompleteCasPendingAsync(
            AuthorizationRequestState pending,
            JObject user,
            long authTime)
        {
            if (pending == null || user == null || pending.Service.DosIsNullOrWhiteSpace())
                return new DosResult<string>(0, null, "CAS 授权请求无效。");
            var client = await FindCasServiceAsync(pending.OsClient, pending.Service).ConfigureAwait(false);
            if (client == null || !SsoSecurity.FixedEquals(client.Key, pending.ConnectionKey))
                return new DosResult<string>(0, null, "CAS Service 注册已变更。");
            var ticket = "ST-" + SsoSecurity.NewOpaqueValue(48);
            var payload = new CasTicketPayload
            {
                OsClient = pending.OsClient,
                ConnectionKey = client.Key,
                Service = pending.Service,
                UserId = user["Id"]?.ToString(),
                AuthTime = authTime,
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(2).ToString("O")
            };
            var saved = await Cache(pending.OsClient).StringSetAsync(CasTicketKey(pending.OsClient, ticket),
                JsonConvert.SerializeObject(payload), TimeSpan.FromMinutes(2), When.NotExists).ConfigureAwait(false);
            if (!saved) return new DosResult<string>(0, null, "CAS Service Ticket 创建失败。");
            QueueAudit(pending.OsClient, payload.UserId, "OutboundCasAuthorized", true, client.Key, "CAS", null);
            return new DosResult<string>(1, AppendQuery(pending.Service,
                new Dictionary<string, string> { ["ticket"] = ticket }));
        }

        private static async Task<SsoConnectionOptions> FindCasServiceAsync(string osClient, string service)
        {
            if (service.DosIsNullOrWhiteSpace()) return null;
            return (await LoadConnectionsAsync(osClient).ConfigureAwait(false)).FirstOrDefault(item =>
                item.Enabled && item.IsOutbound && item.Protocol == "CAS"
                && SsoSecurity.IsExactRedirectUriAllowed(service, item.RedirectUris, item.AllowLoopbackRedirectUri));
        }

        private static async Task<CasTicketPayload> ConsumeCasTicketAsync(string osClient, string ticket)
        {
            if (ticket.DosIsNullOrWhiteSpace() || !ticket.StartsWith("ST-", StringComparison.Ordinal)
                || ticket.Length > 300) return null;
            try
            {
                var raw = await Cache(osClient).StringGetDeleteAsync(CasTicketKey(osClient, ticket)).ConfigureAwait(false);
                if (!raw.HasValue) return null;
                var payload = JsonConvert.DeserializeObject<CasTicketPayload>(raw.ToString());
                return payload != null && SsoSecurity.FixedEquals(payload.OsClient, osClient)
                       && DateTimeOffset.TryParse(payload.ExpiresAt, out var expires)
                       && expires > DateTimeOffset.UtcNow
                    ? payload
                    : null;
            }
            catch { return null; }
        }

        private static FederatedProfile ParseCasSuccess(string xml)
        {
            try
            {
                var settings = new XmlReaderSettings
                {
                    DtdProcessing = DtdProcessing.Prohibit,
                    XmlResolver = null,
                    MaxCharactersInDocument = 1024 * 1024
                };
                var document = new XmlDocument { XmlResolver = null };
                using var reader = XmlReader.Create(new System.IO.StringReader(xml), settings);
                document.Load(reader);
                var success = document.SelectSingleNode("//*[local-name()='authenticationSuccess']");
                var user = success?.SelectSingleNode("./*[local-name()='user']")?.InnerText?.Trim();
                if (user.DosIsNullOrWhiteSpace()) return null;
                var claims = new JObject { ["user"] = user, ["sub"] = user, ["preferred_username"] = user };
                var attributes = success.SelectSingleNode("./*[local-name()='attributes']");
                if (attributes != null)
                {
                    foreach (XmlNode node in attributes.ChildNodes)
                    {
                        if (node.NodeType != XmlNodeType.Element) continue;
                        var name = node.LocalName;
                        if (claims[name] == null) claims[name] = node.InnerText?.Trim() ?? string.Empty;
                    }
                }
                return new FederatedProfile
                {
                    Subject = user,
                    Account = claims["username"]?.ToString() ?? user,
                    Name = claims["displayName"]?.ToString() ?? claims["name"]?.ToString() ?? user,
                    Email = claims["email"]?.ToString(),
                    Claims = claims
                };
            }
            catch { return null; }
        }

        private IActionResult CasSuccess(JObject user)
        {
            var account = XmlEscape(user["Account"]?.ToString() ?? user["Id"]?.ToString());
            var name = XmlEscape(user["Name"]?.ToString() ?? string.Empty);
            var email = XmlEscape(user["Email"]?.ToString() ?? string.Empty);
            var xml = "<cas:serviceResponse xmlns:cas=\"http://www.yale.edu/tp/cas\"><cas:authenticationSuccess>"
                      + "<cas:user>" + account + "</cas:user><cas:attributes><cas:name>" + name
                      + "</cas:name><cas:email>" + email + "</cas:email></cas:attributes>"
                      + "</cas:authenticationSuccess></cas:serviceResponse>";
            return Content(xml, "application/xml", Encoding.UTF8);
        }

        private IActionResult CasFailure(string code, string message)
        {
            var xml = "<cas:serviceResponse xmlns:cas=\"http://www.yale.edu/tp/cas\"><cas:authenticationFailure code=\""
                      + XmlEscape(code) + "\">" + XmlEscape(message)
                      + "</cas:authenticationFailure></cas:serviceResponse>";
            return Content(xml, "application/xml", Encoding.UTF8);
        }

        private static string XmlEscape(string value) =>
            System.Security.SecurityElement.Escape(value ?? string.Empty) ?? string.Empty;

        private static string CasTicketKey(string osClient, string ticket) =>
            $"Microi:{osClient}:SSO:CasTicket:{SsoSecurity.HashOpaqueToken(ticket)}";
    }
}
