using System;
using System.Collections.Generic;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net.Api
{
    public sealed partial class SsoController
    {
        private sealed class OidcSigningMaterial : IDisposable
        {
            public RSA Rsa { get; set; }
            public RsaSecurityKey Key { get; set; }
            public SigningCredentials Credentials { get; set; }
            public JObject PublicJwk { get; set; }
            public void Dispose() => Rsa?.Dispose();
        }

        private async Task<JsonResult> BeginOidcAsync(
            string osClient,
            SsoConnectionOptions connection,
            string returnOrigin)
        {
            if (connection.ClientId.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "OIDC 连接未配置 ClientId。"));
            var metadataResult = await LoadOidcMetadataAsync(connection).ConfigureAwait(false);
            if (metadataResult.Code != 1) return Json(metadataResult);
            var metadata = metadataResult.Data;
            var issuer = metadata["issuer"]?.ToString();
            if (connection.ValidateIssuer && !connection.Issuer.DosIsNullOrWhiteSpace()
                && !SsoSecurity.FixedEquals(connection.Issuer.TrimEnd('/'), (issuer ?? string.Empty).TrimEnd('/')))
                return Json(new DosResult(0, null, "OIDC Discovery 返回的 issuer 与连接配置不一致。"));
            var authorizeEndpoint = metadata["authorization_endpoint"]?.ToString();
            try { SsoSecurity.RequireAbsoluteEndpoint(authorizeEndpoint, connection.AllowPrivateEndpoint); }
            catch { return Json(new DosResult(0, null, "OIDC authorization_endpoint 无效。")); }
            var normalizedOrigin = ResolveReturnOrigin(returnOrigin);
            if (normalizedOrigin == null)
                return Json(new DosResult(0, null, "SSO 回传 Origin 无效。"));

            var stateValue = SsoSecurity.NewOpaqueValue();
            var verifier = SsoSecurity.CreatePkceVerifier();
            var nonce = SsoSecurity.NewOpaqueValue();
            var callback = BuildInboundCallbackUrl("OidcCallback", osClient, connection.Key);
            var now = DateTimeOffset.UtcNow;
            var state = new InboundState
            {
                OsClient = osClient,
                ConnectionKey = connection.Key,
                Protocol = "OIDC",
                Nonce = nonce,
                PkceVerifier = verifier,
                RedirectUri = callback,
                ReturnOrigin = normalizedOrigin,
                CreatedAt = now.ToString("O"),
                ExpiresAt = now.Add(InboundStateLifetime).ToString("O")
            };
            var saved = await Cache(osClient).StringSetAsync(InboundStateKey(osClient, stateValue),
                JsonConvert.SerializeObject(state), InboundStateLifetime, When.NotExists).ConfigureAwait(false);
            if (!saved) return Json(new DosResult(0, null, "OIDC 安全状态创建失败，请重试。"));
            var scopes = connection.Scopes.Count > 0
                ? connection.Scopes
                : new[] { "openid", "profile", "email" };
            if (!scopes.Contains("openid", StringComparer.Ordinal))
                return Json(new DosResult(0, null, "OIDC Scopes 必须包含 openid。"));
            var query = new Dictionary<string, string>
            {
                ["client_id"] = connection.ClientId,
                ["redirect_uri"] = callback,
                ["response_type"] = "code",
                ["scope"] = string.Join(" ", scopes),
                ["state"] = stateValue,
                ["nonce"] = nonce,
                ["code_challenge"] = SsoSecurity.CreatePkceChallenge(verifier),
                ["code_challenge_method"] = "S256"
            };
            var authorizeUrl = AppendQuery(authorizeEndpoint, query);
            Response.Headers.CacheControl = "no-store";
            return Json(new DosResult(1, new
            {
                Provider = connection.Key,
                connection.Name,
                Protocol = "OIDC",
                AuthorizeUrl = authorizeUrl,
                CallbackUrl = callback,
                ExpiresInSeconds = (int)InboundStateLifetime.TotalSeconds,
                Popup = new { Width = 720, Height = 760 }
            }));
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> OidcCallback(
            string code,
            string state,
            string error,
            string error_description,
            string OsClient,
            string ConnectionKey)
        {
            if (!error.DosIsNullOrWhiteSpace())
                return PopupResult(null, ConnectionKey, false, "OIDC 授权未完成：" + NormalizeText(error, 120), null);
            if (code.DosIsNullOrWhiteSpace() || !IsOpaque(state))
                return PopupResult(null, ConnectionKey, false, "OIDC 未返回有效授权码。", null);
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
            if (!IsValidInboundState(stateModel, tenant.Data, ConnectionKey, "OIDC"))
                return PopupResult(null, ConnectionKey, false, "OIDC 安全状态不存在、已过期或已使用。", null);
            var connection = await FindConnectionAsync(tenant.Data, ConnectionKey,
                SsoSecurity.InboundDirection).ConfigureAwait(false);
            if (connection == null || !connection.Enabled || connection.Protocol != "OIDC")
                return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, "OIDC 连接已停用或配置已变更。", null);
            try
            {
                var metadataResult = await LoadOidcMetadataAsync(connection).ConfigureAwait(false);
                if (metadataResult.Code != 1)
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, metadataResult.Msg, null);
                var metadata = metadataResult.Data;
                var tokenEndpoint = metadata["token_endpoint"]?.ToString();
                var secret = connection.ClientAuthMethod == "none"
                    ? string.Empty
                    : LoadSecretSetting(tenant.Data, connection.ClientSecretSettingKey);
                if (connection.ClientAuthMethod != "none" && secret.DosIsNullOrWhiteSpace())
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false,
                        "OIDC Client Secret 未在租户系统设置中配置。", null);
                var form = new Dictionary<string, string>
                {
                    ["grant_type"] = "authorization_code",
                    ["code"] = code,
                    ["redirect_uri"] = stateModel.RedirectUri,
                    ["client_id"] = connection.ClientId,
                    ["code_verifier"] = stateModel.PkceVerifier
                };
                var headers = new Dictionary<string, string> { ["Accept"] = "application/json" };
                if (connection.ClientAuthMethod == "client_secret_basic")
                {
                    headers["Authorization"] = "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes(
                        Uri.EscapeDataString(connection.ClientId) + ":" + Uri.EscapeDataString(secret)));
                }
                else if (connection.ClientAuthMethod == "client_secret_post")
                {
                    form["client_secret"] = secret;
                }
                var tokenResponse = await ExternalPostFormAsync(tokenEndpoint, form, headers,
                    connection.AllowPrivateEndpoint).ConfigureAwait(false);
                if (tokenResponse.Code != 1)
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, tokenResponse.Msg, null);
                var idToken = tokenResponse.Data["id_token"]?.ToString();
                if (idToken.DosIsNullOrWhiteSpace())
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, "OIDC 未返回 id_token。", null);
                var profileResult = await ValidateInboundIdTokenAsync(tenant.Data, connection, metadata,
                    idToken, stateModel.Nonce).ConfigureAwait(false);
                if (profileResult.Code != 1)
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, profileResult.Msg, null);
                var profile = profileResult.Data;
                var accessToken = tokenResponse.Data["access_token"]?.ToString();
                var userInfoEndpoint = metadata["userinfo_endpoint"]?.ToString();
                if (!accessToken.DosIsNullOrWhiteSpace() && !userInfoEndpoint.DosIsNullOrWhiteSpace())
                {
                    var info = await ExternalGetJsonAsync(userInfoEndpoint,
                        new Dictionary<string, string> { ["Authorization"] = "Bearer " + accessToken },
                        connection.AllowPrivateEndpoint).ConfigureAwait(false);
                    if (info.Code == 1
                        && SsoSecurity.FixedEquals(info.Data[connection.SubjectClaim]?.ToString(), profile.Subject))
                    {
                        MergeClaims(profile.Claims, info.Data);
                        ApplyProfileClaims(profile, connection);
                    }
                }
                var userResult = await ResolveFederatedUserAsync(tenant.Data, connection, profile).ConfigureAwait(false);
                if (userResult.Code != 1)
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, userResult.Msg, null);
                var ticket = await CreateLoginTicketAsync(tenant.Data, connection, userResult.Data["Id"]?.ToString())
                    .ConfigureAwait(false);
                if (ticket.DosIsNullOrWhiteSpace())
                    return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false, "SSO 登录票据创建失败，请重试。", null);
                QueueAudit(tenant.Data, userResult.Data["Id"]?.ToString(), "InboundSsoVerified", true,
                    connection.Key, "OIDC", null);
                return PopupResult(stateModel.ReturnOrigin, connection.Key, true,
                    "OIDC 身份验证成功，正在进入系统。", ticket);
            }
            catch
            {
                QueueAudit(tenant.Data, null, "InboundSsoFailed", false, ConnectionKey, "OIDC", "ProtocolFailure");
                return PopupResult(stateModel.ReturnOrigin, ConnectionKey, false,
                    "OIDC 登录服务暂时不可用，请联系管理员检查元数据、证书和 Claim 映射。", null);
            }
        }

        [HttpGet("/sso/{OsClient}/.well-known/openid-configuration")]
        [AllowAnonymous]
        public async Task<IActionResult> Discovery(string OsClient)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return NotFound();
            var clients = (await LoadConnectionsAsync(tenant.Data).ConfigureAwait(false))
                .Where(item => item.Enabled && item.IsOutbound && item.Protocol == "OIDC").ToList();
            if (clients.Count == 0) return NotFound();
            var issuer = BuildProviderIssuer(tenant.Data);
            Response.Headers.CacheControl = "public, max-age=300";
            return Json(new JObject
            {
                ["issuer"] = issuer,
                ["authorization_endpoint"] = issuer + "/authorize",
                ["token_endpoint"] = issuer + "/token",
                ["userinfo_endpoint"] = issuer + "/userinfo",
                ["jwks_uri"] = issuer + "/jwks",
                ["introspection_endpoint"] = issuer + "/introspect",
                ["revocation_endpoint"] = issuer + "/revoke",
                ["end_session_endpoint"] = issuer + "/logout",
                ["response_types_supported"] = new JArray("code"),
                ["response_modes_supported"] = new JArray("query"),
                ["grant_types_supported"] = new JArray("authorization_code", "refresh_token"),
                ["subject_types_supported"] = new JArray("pairwise"),
                ["id_token_signing_alg_values_supported"] = new JArray("RS256"),
                ["scopes_supported"] = new JArray("openid", "profile", "email", "roles"),
                ["claims_supported"] = new JArray("sub", "name", "preferred_username", "email", "roles"),
                ["code_challenge_methods_supported"] = new JArray("S256"),
                ["token_endpoint_auth_methods_supported"] = new JArray(
                    clients.Select(item => item.ClientAuthMethod).Distinct(StringComparer.Ordinal).ToArray())
            });
        }

        [HttpGet("/sso/{OsClient}/jwks")]
        [AllowAnonymous]
        public async Task<IActionResult> Jwks(string OsClient)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return NotFound();
            if (!await HasOutboundOidcAsync(tenant.Data).ConfigureAwait(false)) return NotFound();
            using var material = await GetSigningMaterialAsync(tenant.Data).ConfigureAwait(false);
            if (material == null) return StatusCode(503, new { error = "temporarily_unavailable" });
            Response.Headers.CacheControl = "public, max-age=300";
            return Json(new JObject { ["keys"] = new JArray(material.PublicJwk) });
        }

        [HttpGet("/sso/{OsClient}/authorize")]
        [AllowAnonymous]
        public async Task<IActionResult> Authorize(
            string OsClient,
            string client_id,
            string redirect_uri,
            string response_type,
            string scope,
            string state,
            string nonce,
            string code_challenge,
            string code_challenge_method,
            string prompt)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return OidcError(null, state, "invalid_request", "tenant is invalid");
            var connection = await FindOutboundClientAsync(tenant.Data, "OIDC", client_id).ConfigureAwait(false);
            if (connection == null || !connection.Enabled)
                return OidcError(null, state, "unauthorized_client", "client is not registered");
            if (!SsoSecurity.IsExactRedirectUriAllowed(redirect_uri, connection.RedirectUris,
                    connection.AllowLoopbackRedirectUri))
                return BadRequest(new { error = "invalid_request", error_description = "redirect_uri is not registered" });
            if (!string.Equals(response_type, "code", StringComparison.Ordinal)
                || !string.Equals(code_challenge_method, "S256", StringComparison.Ordinal)
                || code_challenge.DosIsNullOrWhiteSpace()
                || nonce.DosIsNullOrWhiteSpace())
                return OidcError(redirect_uri, state, "invalid_request", "code, nonce and PKCE S256 are required");
            var scopes = SsoSecurity.NormalizeScopes(scope, connection.Scopes, requireOpenId: true);
            if (scopes.Count == 0)
                return OidcError(redirect_uri, state, "invalid_scope", "requested scope is not allowed");
            var pending = NewPendingAuthorization(tenant.Data, connection, client_id, redirect_uri,
                string.Join(" ", scopes), state, nonce, code_challenge);
            var session = await GetProviderSessionAsync(tenant.Data).ConfigureAwait(false);
            if (session != null)
            {
                var redirect = await CompletePendingAuthorizationAsync(pending, session.CurrentUser,
                    session.AuthTime).ConfigureAwait(false);
                return redirect.Code == 1
                    ? Redirect(redirect.Data)
                    : OidcError(redirect_uri, state, "server_error", redirect.Msg);
            }
            if (string.Equals(prompt, "none", StringComparison.Ordinal))
                return OidcError(redirect_uri, state, "login_required", "Microi sign-in is required");
            var requestId = SsoSecurity.NewOpaqueValue();
            var saved = await Cache(tenant.Data).StringSetAsync(AuthorizationRequestKey(tenant.Data, requestId),
                JsonConvert.SerializeObject(pending), AuthorizationRequestLifetime, When.NotExists).ConfigureAwait(false);
            if (!saved) return OidcError(redirect_uri, state, "temporarily_unavailable", "authorization state failed");
            return Redirect(BuildFrontendAuthorizationUrl(tenant.Data, requestId));
        }

        [HttpPost("/sso/{OsClient}/token")]
        [AllowAnonymous]
        public async Task<IActionResult> Token(string OsClient)
        {
            SetNoStore();
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return OAuthError("invalid_request", "tenant is invalid", 400);
            if (!Request.HasFormContentType) return OAuthError("invalid_request", "form encoding is required", 400);
            var form = await Request.ReadFormAsync().ConfigureAwait(false);
            var authenticated = await AuthenticateOutboundClientAsync(tenant.Data, "OIDC", form).ConfigureAwait(false);
            if (authenticated.Code != 1) return OAuthError("invalid_client", authenticated.Msg, 401);
            var client = authenticated.Data;
            var grantType = form["grant_type"].ToString();
            if (grantType == "authorization_code")
                return await ExchangeAuthorizationCodeAsync(tenant.Data, client, form).ConfigureAwait(false);
            if (grantType == "refresh_token")
                return await ExchangeRefreshTokenAsync(tenant.Data, client, form).ConfigureAwait(false);
            return OAuthError("unsupported_grant_type", "only authorization_code and refresh_token are supported", 400);
        }

        [HttpGet("/sso/{OsClient}/userinfo")]
        [HttpPost("/sso/{OsClient}/userinfo")]
        [AllowAnonymous]
        public async Task<IActionResult> UserInfo(string OsClient)
        {
            SetNoStore();
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return OAuthError("invalid_token", "tenant is invalid", 401);
            var payload = await ReadAccessTokenAsync(tenant.Data).ConfigureAwait(false);
            if (payload == null) return OAuthError("invalid_token", "access token is invalid or expired", 401);
            if (!SsoSecurity.FixedEquals(payload.OsClient, tenant.Data))
                return OAuthError("invalid_token", "token tenant does not match", 401);
            var user = await GetEnabledUserAsync(payload.OsClient, payload.UserId).ConfigureAwait(false);
            if (user == null) return OAuthError("invalid_token", "user is disabled", 401);
            var claims = await BuildOutboundClaimsAsync(payload.OsClient, user, payload.Subject, payload.Scope)
                .ConfigureAwait(false);
            return claims.Code == 1
                ? Json(claims.Data)
                : OAuthError("server_error", claims.Msg ?? "claim projection failed", 503);
        }

        [HttpPost("/sso/{OsClient}/introspect")]
        [AllowAnonymous]
        public async Task<IActionResult> Introspect(string OsClient)
        {
            SetNoStore();
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return OAuthError("invalid_request", "tenant is invalid", 400);
            if (!Request.HasFormContentType) return Json(new { active = false });
            var form = await Request.ReadFormAsync().ConfigureAwait(false);
            var authenticated = await AuthenticateOutboundClientAsync(tenant.Data, "OIDC", form).ConfigureAwait(false);
            if (authenticated.Code != 1) return OAuthError("invalid_client", authenticated.Msg, 401);
            var rawToken = form["token"].ToString();
            var payload = await ReadProtocolTokenAsync(tenant.Data, rawToken).ConfigureAwait(false);
            if (payload == null || !string.Equals(payload.ClientId, authenticated.Data.ClientId, StringComparison.Ordinal))
                return Json(new { active = false });
            var exp = DateTimeOffset.Parse(payload.ExpiresAt).ToUnixTimeSeconds();
            return Json(new
            {
                active = true,
                client_id = payload.ClientId,
                sub = payload.Subject,
                scope = payload.Scope,
                token_type = payload.TokenType,
                exp,
                iss = BuildProviderIssuer(tenant.Data)
            });
        }

        [HttpPost("/sso/{OsClient}/revoke")]
        [AllowAnonymous]
        public async Task<IActionResult> Revoke(string OsClient)
        {
            SetNoStore();
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return OAuthError("invalid_request", "tenant is invalid", 400);
            if (!Request.HasFormContentType) return Ok();
            var form = await Request.ReadFormAsync().ConfigureAwait(false);
            var authenticated = await AuthenticateOutboundClientAsync(tenant.Data, "OIDC", form).ConfigureAwait(false);
            if (authenticated.Code != 1) return OAuthError("invalid_client", authenticated.Msg, 401);
            var token = form["token"].ToString();
            var payload = await ReadProtocolTokenAsync(tenant.Data, token).ConfigureAwait(false);
            if (payload != null && string.Equals(payload.ClientId, authenticated.Data.ClientId, StringComparison.Ordinal))
            {
                await Cache(tenant.Data).KeyDeleteAsync(ProtocolTokenKey(tenant.Data, token)).ConfigureAwait(false);
                if (!payload.FamilyId.DosIsNullOrWhiteSpace())
                    await Cache(tenant.Data).StringSetAsync(RefreshFamilyRevokedKey(tenant.Data, payload.FamilyId), "1",
                        TimeSpan.FromDays(authenticated.Data.RefreshTokenLifetimeDays)).ConfigureAwait(false);
            }
            return Ok();
        }

        [HttpGet("/sso/{OsClient}/logout")]
        [AllowAnonymous]
        public async Task<IActionResult> EndSession(string OsClient, string id_token_hint,
            string post_logout_redirect_uri, string state)
        {
            var tenant = ResolveAnonymousTenant(OsClient);
            if (tenant.Code != 1) return BadRequest();
            SsoConnectionOptions client = null;
            if (!id_token_hint.DosIsNullOrWhiteSpace())
            {
                try
                {
                    var jwt = new JwtSecurityTokenHandler().ReadJwtToken(id_token_hint);
                    var audience = jwt.Audiences.SingleOrDefault();
                    client = await FindOutboundClientAsync(tenant.Data, "OIDC", audience).ConfigureAwait(false);
                    if (client != null)
                    {
                        using var material = await GetSigningMaterialAsync(tenant.Data).ConfigureAwait(false);
                        if (material == null) client = null;
                        else
                        {
                            new JwtSecurityTokenHandler { MapInboundClaims = false }.ValidateToken(id_token_hint,
                                new TokenValidationParameters
                                {
                                    ValidateIssuerSigningKey = true,
                                    IssuerSigningKey = material.Key,
                                    RequireSignedTokens = true,
                                    ValidateIssuer = true,
                                    ValidIssuer = BuildProviderIssuer(tenant.Data),
                                    ValidateAudience = true,
                                    ValidAudience = client.ClientId,
                                    ValidateLifetime = true,
                                    RequireExpirationTime = true,
                                    ClockSkew = TimeSpan.FromMinutes(2),
                                    ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 }
                                }, out _);
                        }
                    }
                }
                catch { client = null; }
            }
            if (!post_logout_redirect_uri.DosIsNullOrWhiteSpace()
                && (client == null || !SsoSecurity.IsExactRedirectUriAllowed(post_logout_redirect_uri,
                    client.PostLogoutRedirectUris, client.AllowLoopbackRedirectUri)))
                return BadRequest(new { error = "invalid_request", error_description = "post logout redirect is not registered" });
            var cookieName = ProviderCookieName(tenant.Data);
            var sessionId = Request.Cookies[cookieName];
            if (IsOpaque(sessionId)) await Cache(tenant.Data).KeyDeleteAsync(ProviderSessionKey(tenant.Data, sessionId));
            Response.Cookies.Delete(cookieName, new CookieOptions { Path = "/" });
            if (post_logout_redirect_uri.DosIsNullOrWhiteSpace()) return Content("已退出当前 SSO 浏览器会话。", "text/plain", Encoding.UTF8);
            return Redirect(AppendQuery(post_logout_redirect_uri,
                state.DosIsNullOrWhiteSpace() ? null : new Dictionary<string, string> { ["state"] = state }));
        }

        private async Task<IActionResult> ExchangeAuthorizationCodeAsync(
            string osClient,
            SsoConnectionOptions client,
            IFormCollection form)
        {
            var code = form["code"].ToString();
            if (!IsOpaque(code)) return OAuthError("invalid_grant", "authorization code is invalid", 400);
            AuthorizationCodePayload payload = null;
            try
            {
                var raw = await Cache(osClient).StringGetDeleteAsync(AuthorizationCodeKey(osClient, code))
                    .ConfigureAwait(false);
                if (raw.HasValue) payload = JsonConvert.DeserializeObject<AuthorizationCodePayload>(raw.ToString());
            }
            catch { }
            if (payload == null || !DateTimeOffset.TryParse(payload.ExpiresAt, out var expires)
                || expires <= DateTimeOffset.UtcNow
                || !SsoSecurity.FixedEquals(payload.ClientId, client.ClientId)
                || !SsoSecurity.FixedEquals(payload.RedirectUri, form["redirect_uri"].ToString())
                || !SsoSecurity.VerifyPkceS256(form["code_verifier"].ToString(), payload.CodeChallenge))
                return OAuthError("invalid_grant", "authorization code is invalid, expired or already used", 400);
            var user = await GetEnabledUserAsync(osClient, payload.UserId).ConfigureAwait(false);
            if (user == null) return OAuthError("invalid_grant", "user is disabled", 400);
            return await IssueProtocolTokensAsync(osClient, client, user, payload.Scope, payload.Nonce,
                payload.AuthTime).ConfigureAwait(false);
        }

        private async Task<IActionResult> ExchangeRefreshTokenAsync(
            string osClient,
            SsoConnectionOptions client,
            IFormCollection form)
        {
            var refresh = form["refresh_token"].ToString();
            if (!IsOpaque(refresh)) return OAuthError("invalid_grant", "refresh token is invalid", 400);
            ProtocolTokenPayload payload = null;
            try
            {
                var raw = await Cache(osClient).ScriptEvaluateAsync(@"
local raw = redis.call('get', KEYS[1])
if not raw then return false end
local payload = cjson.decode(raw)
redis.call('del', KEYS[1])
redis.call('set', KEYS[2], payload.FamilyId, 'PX', ARGV[1])
return raw",
                    new RedisKey[] { ProtocolTokenKey(osClient, refresh), RefreshUsedKey(osClient, refresh) },
                    new RedisValue[] { (long)TimeSpan.FromDays(client.RefreshTokenLifetimeDays).TotalMilliseconds })
                    .ConfigureAwait(false);
                if (!raw.IsNull) payload = JsonConvert.DeserializeObject<ProtocolTokenPayload>(raw.ToString());
            }
            catch { }
            if (payload == null)
            {
                var usedFamily = await Cache(osClient).StringGetAsync(RefreshUsedKey(osClient, refresh)).ConfigureAwait(false);
                if (usedFamily.HasValue)
                    await Cache(osClient).StringSetAsync(RefreshFamilyRevokedKey(osClient, usedFamily.ToString()), "1",
                        TimeSpan.FromDays(client.RefreshTokenLifetimeDays)).ConfigureAwait(false);
                return OAuthError("invalid_grant", "refresh token is invalid, expired, reused or revoked", 400);
            }
            if (payload.TokenType != "refresh_token"
                || !SsoSecurity.FixedEquals(payload.ClientId, client.ClientId)
                || !DateTimeOffset.TryParse(payload.ExpiresAt, out var expires)
                || expires <= DateTimeOffset.UtcNow
                || await Cache(osClient).KeyExistsAsync(RefreshFamilyRevokedKey(osClient, payload.FamilyId)).ConfigureAwait(false))
                return OAuthError("invalid_grant", "refresh token is invalid, expired or revoked", 400);
            var requestedScope = form["scope"].ToString();
            var scope = requestedScope.DosIsNullOrWhiteSpace() ? payload.Scope : requestedScope;
            var normalized = SsoSecurity.NormalizeScopes(scope, payload.Scope.Split(' '), requireOpenId: true);
            if (normalized.Count == 0) return OAuthError("invalid_scope", "scope escalation is forbidden", 400);
            var user = await GetEnabledUserAsync(osClient, payload.UserId).ConfigureAwait(false);
            if (user == null) return OAuthError("invalid_grant", "user is disabled", 400);
            return await IssueProtocolTokensAsync(osClient, client, user, string.Join(" ", normalized), null,
                DateTimeOffset.UtcNow.ToUnixTimeSeconds(), payload.FamilyId).ConfigureAwait(false);
        }

        private async Task<IActionResult> IssueProtocolTokensAsync(
            string osClient,
            SsoConnectionOptions client,
            JObject user,
            string scope,
            string nonce,
            long authTime,
            string familyId = null)
        {
            familyId = familyId.DosIsNullOrWhiteSpace() ? SsoSecurity.NewOpaqueValue() : familyId;
            var pairwiseKey = await GetOrCreateSecretAsync(osClient, PairwiseKeySetting, 48,
                "OIDC pairwise subject 派生密钥").ConfigureAwait(false);
            if (pairwiseKey.DosIsNullOrWhiteSpace()) return OAuthError("server_error", "subject key is unavailable", 503);
            var subject = SsoSecurity.CreatePairwiseSubject(osClient, client.ClientId,
                user["Id"]?.ToString(), pairwiseKey);
            var accessToken = SsoSecurity.NewOpaqueValue(48);
            var refreshToken = SsoSecurity.NewOpaqueValue(64);
            var now = DateTimeOffset.UtcNow;
            var accessExpiry = now.AddMinutes(client.AccessTokenLifetimeMinutes);
            var refreshExpiry = now.AddDays(client.RefreshTokenLifetimeDays);
            var accessPayload = new ProtocolTokenPayload
            {
                OsClient = osClient, ConnectionKey = client.Key, ClientId = client.ClientId,
                UserId = user["Id"]?.ToString(), Subject = subject, Scope = scope,
                TokenType = "access_token", FamilyId = familyId, ExpiresAt = accessExpiry.ToString("O")
            };
            var refreshPayload = new ProtocolTokenPayload
            {
                OsClient = osClient, ConnectionKey = client.Key, ClientId = client.ClientId,
                UserId = user["Id"]?.ToString(), Subject = subject, Scope = scope,
                TokenType = "refresh_token", FamilyId = familyId, ExpiresAt = refreshExpiry.ToString("O")
            };
            var accessSaved = await Cache(osClient).StringSetAsync(ProtocolTokenKey(osClient, accessToken),
                JsonConvert.SerializeObject(accessPayload), accessExpiry - now, When.NotExists).ConfigureAwait(false);
            var refreshSaved = await Cache(osClient).StringSetAsync(ProtocolTokenKey(osClient, refreshToken),
                JsonConvert.SerializeObject(refreshPayload), refreshExpiry - now, When.NotExists).ConfigureAwait(false);
            if (!accessSaved || !refreshSaved) return OAuthError("server_error", "token storage failed", 503);
            var idToken = await CreateIdTokenAsync(osClient, client, user, subject, scope, nonce, authTime)
                .ConfigureAwait(false);
            if (idToken.DosIsNullOrWhiteSpace()) return OAuthError("server_error", "signing key is unavailable", 503);
            QueueAudit(osClient, user["Id"]?.ToString(), "OutboundOidcTokenIssued", true, client.Key, "OIDC", null);
            return Json(new
            {
                token_type = "Bearer",
                access_token = accessToken,
                expires_in = client.AccessTokenLifetimeMinutes * 60,
                refresh_token = refreshToken,
                scope,
                id_token = idToken
            });
        }

        private async Task<string> CreateIdTokenAsync(
            string osClient,
            SsoConnectionOptions client,
            JObject user,
            string subject,
            string scope,
            string nonce,
            long authTime)
        {
            using var material = await GetSigningMaterialAsync(osClient).ConfigureAwait(false);
            if (material == null) return null;
            var now = DateTimeOffset.UtcNow;
            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, subject),
                new Claim(JwtRegisteredClaimNames.Jti, SsoSecurity.NewOpaqueValue()),
                new Claim("auth_time", authTime.ToString(CultureInfo.InvariantCulture), ClaimValueTypes.Integer64)
            };
            if (!nonce.DosIsNullOrWhiteSpace()) claims.Add(new Claim("nonce", nonce));
            var projection = await BuildOutboundClaimsAsync(osClient, user, subject, scope).ConfigureAwait(false);
            if (projection.Code != 1 || projection.Data == null) return null;
            foreach (var property in projection.Data.Properties().Where(item => item.Name != "sub"))
            {
                if (property.Value is JArray array)
                    foreach (var value in array) claims.Add(new Claim(property.Name, value?.ToString() ?? string.Empty));
                else claims.Add(new Claim(property.Name, property.Value?.ToString() ?? string.Empty));
            }
            var token = new JwtSecurityToken(
                issuer: BuildProviderIssuer(osClient),
                audience: client.ClientId,
                claims: claims,
                notBefore: now.UtcDateTime,
                expires: now.AddMinutes(5).UtcDateTime,
                signingCredentials: material.Credentials);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private async Task<DosResult<FederatedProfile>> ValidateInboundIdTokenAsync(
            string osClient,
            SsoConnectionOptions connection,
            JObject metadata,
            string idToken,
            string nonce)
        {
            var jwksUri = metadata["jwks_uri"]?.ToString();
            var jwksResult = await ExternalGetJsonAsync(jwksUri, null, connection.AllowPrivateEndpoint)
                .ConfigureAwait(false);
            if (jwksResult.Code != 1) return new DosResult<FederatedProfile>(0, null, "OIDC JWKS 获取失败。");
            IEnumerable<SecurityKey> signingKeys;
            try { signingKeys = new JsonWebKeySet(jwksResult.Data.ToString(Formatting.None)).GetSigningKeys(); }
            catch { return new DosResult<FederatedProfile>(0, null, "OIDC JWKS 格式无效。"); }
            var parameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKeys = signingKeys,
                RequireSignedTokens = true,
                ValidateIssuer = connection.ValidateIssuer,
                ValidIssuer = metadata["issuer"]?.ToString(),
                ValidateAudience = connection.ValidateAudience,
                ValidAudience = connection.ClientId,
                ValidateLifetime = true,
                RequireExpirationTime = true,
                ClockSkew = TimeSpan.FromMinutes(2),
                ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256, SecurityAlgorithms.EcdsaSha256 }
            };
            ClaimsPrincipal principal;
            try
            {
                principal = new JwtSecurityTokenHandler { MapInboundClaims = false }
                    .ValidateToken(idToken, parameters, out _);
            }
            catch { return new DosResult<FederatedProfile>(0, null, "OIDC id_token 签名、issuer、audience 或有效期验证失败。"); }
            var claims = ClaimsToObject(principal.Claims);
            if (connection.RequireNonce
                && !SsoSecurity.FixedEquals(claims["nonce"]?.ToString(), nonce))
                return new DosResult<FederatedProfile>(0, null, "OIDC nonce 验证失败。");
            var profile = new FederatedProfile { Claims = claims };
            ApplyProfileClaims(profile, connection);
            if (profile.Subject.DosIsNullOrWhiteSpace())
                return new DosResult<FederatedProfile>(0, null, "OIDC id_token 缺少稳定 subject。");
            return new DosResult<FederatedProfile>(1, profile);
        }
    }
}
