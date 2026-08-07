using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net.Api
{
    /// <summary>
    /// Gitee、微信开放平台扫码和 GitHub 登录的最小协议网关。
    /// 外部身份只负责证明已绑定主体，最终平台会话始终由 DiyToken 签发。
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public sealed class ExternalLoginController : Controller
    {
        private const string BindingTable = "mci_user_external_identity";
        private static readonly TimeSpan StateLifetime = TimeSpan.FromMinutes(5);
        private static readonly TimeSpan LoginTicketLifetime = TimeSpan.FromSeconds(90);
        private readonly IHttpClientFactory _httpClientFactory;

        public ExternalLoginController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public sealed class BeginRequest
        {
            public string OsClient { get; set; }
            public string Provider { get; set; }
            public string Mode { get; set; } = "Login";
            public string ReturnOrigin { get; set; }
        }

        public sealed class CompleteLoginRequest
        {
            public string OsClient { get; set; }
            public string Ticket { get; set; }
            public string Did { get; set; }
            public string _ClientType { get; set; }
        }

        public sealed class BindingMutationRequest
        {
            public string Id { get; set; }
        }

        private sealed class OAuthState
        {
            public string OsClient { get; set; }
            public string Provider { get; set; }
            public string Mode { get; set; }
            public string UserId { get; set; }
            public string ReturnOrigin { get; set; }
            public string RedirectUri { get; set; }
            public string CreatedAt { get; set; }
            public string ExpiresAt { get; set; }
        }

        private sealed class ExternalProfile
        {
            public string Subject { get; set; }
            public string AccountName { get; set; }
            public string DisplayName { get; set; }
            public string Email { get; set; }
            public string Avatar { get; set; }
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> Begin([FromBody] BeginRequest request)
        {
            var osClientResult = await ResolveOsClientAsync(request?.OsClient, true).ConfigureAwait(false);
            if (osClientResult.Code != 1) return Json(osClientResult);
            var osClient = osClientResult.Data;
            if (!await AllowBeginAsync(osClient).ConfigureAwait(false))
                return Json(new DosResult(0, null, "外部登录发起过于频繁，请稍后再试。"));

            var provider = ExternalLoginProviderCatalog.ResolveOne(osClient, request?.Provider);
            if (provider == null || !provider.Enabled)
                return Json(new DosResult(0, null, "当前租户未启用该登录方式。"));
            if (!provider.Configured)
                return Json(new DosResult(0, null, "该登录方式尚未完成 ClientId/Secret 配置。"));

            var mode = string.Equals(request?.Mode, "Bind", StringComparison.OrdinalIgnoreCase) ? "Bind" : "Login";
            string userId = null;
            if (mode == "Bind")
            {
                var token = await RequireUserTokenAsync().ConfigureAwait(false);
                if (token.Code != 1) return Json(token);
                if (!string.Equals(token.Data.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
                    return Json(new DosResult(0, null, "禁止跨租户绑定外部身份。"));
                userId = token.Data.CurrentUser["Id"]?.ToString();
            }

            var returnOrigin = ResolveReturnOrigin(request?.ReturnOrigin);
            if (returnOrigin == null)
                return Json(new DosResult(0, null, "外部登录回传 Origin 无效。"));
            var redirectUri = BuildCallbackUrl(osClient, provider.Key);
            var stateValue = IdentityVerificationSecurity.NewOpaqueValue();
            var now = DateTimeOffset.UtcNow;
            var state = new OAuthState
            {
                OsClient = osClient,
                Provider = provider.Key,
                Mode = mode,
                UserId = userId,
                ReturnOrigin = returnOrigin,
                RedirectUri = redirectUri,
                CreatedAt = now.ToString("O"),
                ExpiresAt = now.Add(StateLifetime).ToString("O")
            };
            var written = await MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase()
                .StringSetAsync(StateKey(osClient, stateValue), JsonConvert.SerializeObject(state), StateLifetime, When.NotExists)
                .ConfigureAwait(false);
            if (!written) return Json(new DosResult(0, null, "外部登录安全状态创建失败，请重试。"));
            var authorizeUrl = BuildAuthorizeUrl(provider, redirectUri, stateValue);
            return Json(new DosResult(1, new
            {
                Provider = provider.Key,
                provider.Name,
                AuthorizeUrl = authorizeUrl,
                CallbackUrl = redirectUri,
                ExpiresInSeconds = (int)StateLifetime.TotalSeconds,
                Popup = new { Width = provider.Key == "WeChat" ? 560 : 720, Height = 760 }
            }));
        }

        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> Callback(string code, string state, string OsClient, string Provider)
        {
            if (code.DosIsNullOrWhiteSpace() || !IdentityVerificationSecurity.IsOpaqueValue(state))
                return PopupResult(null, null, false, "外部授权已取消或未返回授权码。", null);
            OAuthState stateModel;
            try
            {
                OsClient = TenantConfigurationSecurity.NormalizeTenantId(OsClient);
                var raw = await MicroiEngine.CacheTenant.Cache(OsClient).GetIDatabase()
                    .StringGetDeleteAsync(StateKey(OsClient, state)).ConfigureAwait(false);
                stateModel = raw.HasValue ? JsonConvert.DeserializeObject<OAuthState>(raw.ToString()) : null;
            }
            catch { stateModel = null; }
            if (stateModel == null
                || !FixedEquals(stateModel.OsClient, OsClient)
                || !FixedEquals(stateModel.Provider, Provider)
                || !DateTimeOffset.TryParse(stateModel.ExpiresAt, out var expiresAt)
                || expiresAt <= DateTimeOffset.UtcNow)
            {
                return PopupResult(null, null, false, "外部登录安全状态不存在、已过期或已使用。", null);
            }

            var provider = ExternalLoginProviderCatalog.ResolveOne(OsClient, Provider);
            if (provider == null || !provider.Configured)
                return PopupResult(stateModel.ReturnOrigin, Provider, false, "登录方式已停用或配置已变更。", null);
            try
            {
                var profile = await ExchangeProfileAsync(provider, code, stateModel.RedirectUri).ConfigureAwait(false);
                if (profile == null || profile.Subject.DosIsNullOrWhiteSpace())
                    return PopupResult(stateModel.ReturnOrigin, Provider, false, "外部平台未返回可绑定的用户身份。", null);
                if (stateModel.Mode == "Bind")
                {
                    var save = await UpsertBindingAsync(OsClient, stateModel.UserId, provider, profile).ConfigureAwait(false);
                    QueueAudit(OsClient, stateModel.UserId, "BindExternalIdentity", save.Code == 1, provider.Key, null);
                    return PopupResult(stateModel.ReturnOrigin, provider.Key, save.Code == 1,
                        save.Code == 1 ? $"{provider.Name}绑定成功。" : save.Msg, null);
                }

                var binding = await FindBindingAsync(OsClient, provider.Key, profile.Subject).ConfigureAwait(false);
                if (binding == null)
                {
                    QueueAudit(OsClient, null, "ExternalLoginRejected", false, provider.Key, "NotBound");
                    return PopupResult(stateModel.ReturnOrigin, provider.Key, false,
                        $"该{provider.Name}身份尚未绑定吾码账号，请先登录后到个人中心完成绑定。", null);
                }
                var userId = binding["BoundUserId"]?.ToString();
                var user = await GetEnabledUserForTokenAsync(OsClient, userId).ConfigureAwait(false);
                if (user == null)
                    return PopupResult(stateModel.ReturnOrigin, provider.Key, false, "绑定的吾码账号不存在或已停用。", null);

                var loginTicket = IdentityVerificationSecurity.NewOpaqueValue();
                var ticketPayload = new JObject
                {
                    ["OsClient"] = OsClient,
                    ["UserId"] = userId,
                    ["Provider"] = provider.Key,
                    ["ExpiresAt"] = DateTimeOffset.UtcNow.Add(LoginTicketLifetime).ToString("O")
                };
                var saved = await MicroiEngine.CacheTenant.Cache(OsClient).GetIDatabase()
                    .StringSetAsync(LoginTicketKey(OsClient, loginTicket), ticketPayload.ToString(Formatting.None),
                        LoginTicketLifetime, When.NotExists).ConfigureAwait(false);
                if (!saved) return PopupResult(stateModel.ReturnOrigin, provider.Key, false, "登录票据创建失败，请重试。", null);
                _ = MicroiEngine.FormEngine.UptFormDataAsync(BindingTable, new
                {
                    Id = binding["Id"]?.ToString(),
                    LastLoginTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    AccountName = NormalizeText(profile.AccountName, 200),
                    DisplayName = NormalizeText(profile.DisplayName, 200),
                    Avatar = NormalizeText(profile.Avatar, 1000),
                    OsClient
                });
                return PopupResult(stateModel.ReturnOrigin, provider.Key, true, "身份验证成功，正在进入系统。", loginTicket);
            }
            catch
            {
                QueueAudit(OsClient, null, "ExternalLoginFailed", false, Provider, "ProviderExchangeFailed");
                return PopupResult(stateModel.ReturnOrigin, Provider, false, "外部登录服务暂时不可用，请稍后重试。", null);
            }
        }

        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> CompleteLogin([FromBody] CompleteLoginRequest request)
        {
            var osClientResult = await ResolveOsClientAsync(request?.OsClient, true).ConfigureAwait(false);
            if (osClientResult.Code != 1) return Json(osClientResult);
            var osClient = osClientResult.Data;
            if (!IdentityVerificationSecurity.IsOpaqueValue(request?.Ticket))
                return Json(new DosResult(0, null, "外部登录票据无效。"));
            JObject payload = null;
            try
            {
                var raw = await MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase()
                    .StringGetDeleteAsync(LoginTicketKey(osClient, request?.Ticket)).ConfigureAwait(false);
                if (raw.HasValue) payload = JObject.Parse(raw.ToString());
            }
            catch { }
            if (payload == null
                || !FixedEquals(payload["OsClient"]?.ToString(), osClient)
                || !DateTimeOffset.TryParse(payload["ExpiresAt"]?.ToString(), out var expiresAt)
                || expiresAt <= DateTimeOffset.UtcNow)
            {
                return Json(new DosResult(0, null, "外部登录票据不存在、已过期或已使用。"));
            }
            var user = await GetEnabledUserForTokenAsync(osClient, payload["UserId"]?.ToString()).ConfigureAwait(false);
            if (user == null) return Json(new DosResult(0, null, "系统用户不存在或已停用。"));
            QueueAudit(osClient, user["Id"]?.ToString(), "ExternalLogin", true, payload["Provider"]?.ToString(), null);
            return await CreateDiyTokenLoginResultAsync(osClient, user, request?._ClientType, request?.Did,
                "External:" + payload["Provider"]?.ToString()).ConfigureAwait(false);
        }

        [HttpPost]
        public async Task<JsonResult> ListBindings()
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var providers = ExternalLoginProviderCatalog.Resolve(token.Data.OsClient)
                .OrderBy(item => item.Sort)
                .Select(item => new
                {
                    item.Key,
                    item.Name,
                    item.Description,
                    item.Icon,
                    item.Enabled,
                    Configured = item.Configured
                }).ToList();
            var bindings = await ListBindingsByUserAsync(token.Data.OsClient,
                token.Data.CurrentUser["Id"]?.ToString()).ConfigureAwait(false);
            return Json(new DosResult(1, new
            {
                Providers = providers,
                Bindings = bindings.Select(item => new
                {
                    Id = item["Id"]?.ToString(),
                    Provider = item["ProviderKey"]?.ToString(),
                    AccountName = item["AccountName"]?.ToString(),
                    DisplayName = item["DisplayName"]?.ToString(),
                    Avatar = item["Avatar"]?.ToString(),
                    BindTime = item["BindTime"]?.ToString(),
                    LastLoginTime = item["LastLoginTime"]?.ToString()
                }).ToList()
            }));
        }

        [HttpPost]
        public async Task<JsonResult> RevokeBinding([FromBody] BindingMutationRequest request)
        {
            var token = await RequireUserTokenAsync().ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var item = await FindOwnedBindingAsync(token.Data.OsClient,
                token.Data.CurrentUser["Id"]?.ToString(), request?.Id).ConfigureAwait(false);
            if (item == null) return Json(new DosResult(0, null, "外部身份绑定不存在。"));
            var result = await MicroiEngine.FormEngine.UptFormDataAsync(BindingTable, new
            {
                Id = request.Id,
                State = 0,
                IsDeleted = 1,
                OsClient = token.Data.OsClient
            }).ConfigureAwait(false);
            QueueAudit(token.Data.OsClient, token.Data.CurrentUser["Id"]?.ToString(), "RevokeExternalIdentity",
                result.Code == 1, item["ProviderKey"]?.ToString(), null);
            return Json(result);
        }

        private async Task<ExternalProfile> ExchangeProfileAsync(
            ExternalLoginProviderOptions provider,
            string code,
            string redirectUri)
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(20);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Microi-External-Login/1.0");
            string accessToken;
            string openId = null;
            if (provider.Key == "WeChat")
            {
                var tokenUrl = provider.TokenEndpoint
                    + "?appid=" + Uri.EscapeDataString(provider.ClientId)
                    + "&secret=" + Uri.EscapeDataString(provider.ClientSecret)
                    + "&code=" + Uri.EscapeDataString(code)
                    + "&grant_type=authorization_code";
                var tokenJson = await ReadJsonAsync(client, new HttpRequestMessage(HttpMethod.Get, tokenUrl)).ConfigureAwait(false);
                accessToken = tokenJson["access_token"]?.ToString();
                openId = tokenJson["openid"]?.ToString();
                if (accessToken.DosIsNullOrWhiteSpace() || openId.DosIsNullOrWhiteSpace())
                    throw new InvalidOperationException("WeChatTokenExchangeFailed");
                var profileUrl = provider.UserInfoEndpoint
                    + "?access_token=" + Uri.EscapeDataString(accessToken)
                    + "&openid=" + Uri.EscapeDataString(openId)
                    + "&lang=zh_CN";
                var profile = await ReadJsonAsync(client, new HttpRequestMessage(HttpMethod.Get, profileUrl)).ConfigureAwait(false);
                return new ExternalProfile
                {
                    Subject = profile["unionid"]?.ToString() ?? openId,
                    AccountName = openId,
                    DisplayName = profile["nickname"]?.ToString(),
                    Avatar = profile["headimgurl"]?.ToString()
                };
            }

            var form = new Dictionary<string, string>
            {
                ["client_id"] = provider.ClientId,
                ["client_secret"] = provider.ClientSecret,
                ["code"] = code,
                ["redirect_uri"] = redirectUri
            };
            if (provider.Key == "Gitee") form["grant_type"] = "authorization_code";
            using (var tokenRequest = new HttpRequestMessage(HttpMethod.Post, provider.TokenEndpoint))
            {
                tokenRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                tokenRequest.Content = new FormUrlEncodedContent(form);
                var tokenJson = await ReadJsonAsync(client, tokenRequest).ConfigureAwait(false);
                accessToken = tokenJson["access_token"]?.ToString();
            }
            if (accessToken.DosIsNullOrWhiteSpace()) throw new InvalidOperationException("OAuthTokenExchangeFailed");
            using var profileRequest = new HttpRequestMessage(HttpMethod.Get, provider.UserInfoEndpoint);
            profileRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            profileRequest.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            var user = await ReadJsonAsync(client, profileRequest).ConfigureAwait(false);
            return new ExternalProfile
            {
                Subject = user["id"]?.ToString(),
                AccountName = user["login"]?.ToString(),
                DisplayName = user["name"]?.ToString() ?? user["login"]?.ToString(),
                Email = user["email"]?.ToString(),
                Avatar = user["avatar_url"]?.ToString()
            };
        }

        private static async Task<JObject> ReadJsonAsync(HttpClient client, HttpRequestMessage request)
        {
            using (request)
            using (var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false))
            {
                var text = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                if (!response.IsSuccessStatusCode || text.Length > 1024 * 1024)
                    throw new InvalidOperationException("ExternalProviderHttpFailure");
                return JObject.Parse(text);
            }
        }

        private string BuildCallbackUrl(string osClient, string provider)
        {
            return $"{Request.Scheme}://{Request.Host}{Request.PathBase}/api/ExternalLogin/Callback"
                   + $"?OsClient={Uri.EscapeDataString(osClient)}&Provider={Uri.EscapeDataString(provider)}";
        }

        private static string BuildAuthorizeUrl(ExternalLoginProviderOptions provider, string redirectUri, string state)
        {
            var query = "client_id=" + Uri.EscapeDataString(provider.ClientId)
                        + "&redirect_uri=" + Uri.EscapeDataString(redirectUri)
                        + "&response_type=code"
                        + "&scope=" + Uri.EscapeDataString(provider.Scope ?? string.Empty)
                        + "&state=" + Uri.EscapeDataString(state);
            return provider.AuthorizationEndpoint + "?" + query
                   + (provider.Key == "WeChat" ? "#wechat_redirect" : string.Empty);
        }

        private string ResolveReturnOrigin(string requested)
        {
            var headerOrigin = Request.Headers["Origin"].ToString().Trim();
            var value = (requested ?? string.Empty).Trim();
            if (value.Length == 0) value = headerOrigin;
            if (headerOrigin.Length > 0 && !string.Equals(value, headerOrigin, StringComparison.OrdinalIgnoreCase)) return null;
            if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || !string.IsNullOrEmpty(uri.UserInfo)) return null;
            var secure = uri.Scheme == Uri.UriSchemeHttps;
            var loopback = uri.Scheme == Uri.UriSchemeHttp
                           && (uri.Host == "localhost" || uri.Host == "127.0.0.1" || uri.Host == "::1");
            return secure || loopback ? uri.GetLeftPart(UriPartial.Authority).TrimEnd('/') : null;
        }

        private IActionResult PopupResult(string targetOrigin, string provider, bool success, string message, string ticket)
        {
            targetOrigin = targetOrigin.DosIsNullOrWhiteSpace() ? "*" : targetOrigin;
            var payload = new JObject
            {
                ["type"] = "microi-external-login",
                ["provider"] = provider ?? string.Empty,
                ["success"] = success,
                ["message"] = message ?? string.Empty,
                ["ticket"] = ticket ?? string.Empty
            };
            var json = SafeJsonForScript(payload.ToString(Formatting.None));
            var targetJson = SafeJsonForScript(JsonConvert.SerializeObject(targetOrigin));
            var title = success ? "身份验证成功" : "身份验证未完成";
            var html = "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                       + "<title>" + WebUtility.HtmlEncode(title) + "</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0b1220;color:#eef5ff}.card{max-width:420px;padding:28px;border:1px solid #ffffff24;border-radius:20px;background:#ffffff0d;text-align:center;box-shadow:0 24px 70px #0007}.dot{width:54px;height:54px;margin:auto;display:grid;place-items:center;border-radius:50%;background:"
                       + (success ? "#27b67a" : "#e45b69") + ";font-size:28px}p{color:#aebbd0;line-height:1.7}</style></head><body><div class=\"card\"><div class=\"dot\">"
                       + (success ? "✓" : "!") + "</div><h1>" + WebUtility.HtmlEncode(title) + "</h1><p>"
                       + WebUtility.HtmlEncode(message ?? string.Empty) + "</p><small>窗口将自动关闭</small></div><script>(function(){var data="
                       + json + ";try{if(window.opener&&!window.opener.closed){window.opener.postMessage(data," + targetJson + ");setTimeout(function(){window.close()},450);}}catch(e){}})();</script></body></html>";
            Response.Headers.CacheControl = "no-store";
            Response.Headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
            return Content(html, "text/html", Encoding.UTF8);
        }

        private static string SafeJsonForScript(string value)
        {
            return (value ?? string.Empty).Replace("<", "\\u003c").Replace(">", "\\u003e").Replace("&", "\\u0026")
                .Replace("\u2028", "\\u2028").Replace("\u2029", "\\u2029");
        }

        private static async Task<DosResult> UpsertBindingAsync(
            string osClient,
            string userId,
            ExternalLoginProviderOptions provider,
            ExternalProfile profile)
        {
            if (userId.DosIsNullOrWhiteSpace()) return new DosResult(0, null, "当前用户身份无效。");
            var bySubject = await FindBindingAsync(osClient, provider.Key, profile.Subject, includeDisabled: true).ConfigureAwait(false);
            if (bySubject != null && !string.Equals(bySubject["BoundUserId"]?.ToString(), userId, StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "该外部身份已绑定其它吾码账号。");
            var byUserProvider = bySubject ?? await FindBindingByUserProviderAsync(
                osClient, userId, provider.Key, includeDisabled: true).ConfigureAwait(false);
            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var form = new JObject
            {
                ["Id"] = byUserProvider?["Id"]?.ToString() ?? Guid.NewGuid().ToString(),
                ["BoundUserId"] = userId,
                ["ProviderKey"] = provider.Key,
                ["ProviderSubject"] = profile.Subject,
                ["AccountName"] = NormalizeText(profile.AccountName, 200),
                ["DisplayName"] = NormalizeText(profile.DisplayName, 200),
                ["Email"] = NormalizeText(profile.Email, 300),
                ["Avatar"] = NormalizeText(profile.Avatar, 1000),
                ["State"] = 1,
                ["IsDeleted"] = 0,
                ["BindTime"] = byUserProvider?["BindTime"]?.ToString() ?? now,
                ["LastVerifiedTime"] = now,
                ["OsClient"] = osClient
            };
            return byUserProvider == null
                ? await MicroiEngine.FormEngine.AddFormDataAsync(BindingTable, form).ConfigureAwait(false)
                : await MicroiEngine.FormEngine.UptFormDataAsync(BindingTable, form).ConfigureAwait(false);
        }

        private static async Task<JObject> FindBindingByUserProviderAsync(
            string osClient,
            string userId,
            string provider,
            bool includeDisabled = false)
        {
            if (userId.DosIsNullOrWhiteSpace() || provider.DosIsNullOrWhiteSpace()) return null;
            try
            {
                var where = new List<DiyWhere>
                {
                    new DiyWhere { Name = "BoundUserId", Type = "=", Value = userId },
                    new DiyWhere { Name = "ProviderKey", Type = "=", Value = provider }
                };
                if (!includeDisabled)
                {
                    where.Add(new DiyWhere { Name = "State", Type = "=", Value = 1 });
                    where.Add(new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 });
                }
                var result = await MicroiEngine.FormEngine.GetFormDataAsync(BindingTable, new
                {
                    OsClient = osClient,
                    _Where = where,
                    _OrderBy = "UpdateTime",
                    _OrderByType = "DESC"
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private static async Task<JObject> FindBindingAsync(
            string osClient,
            string provider,
            string subject,
            bool includeDisabled = false)
        {
            if (provider.DosIsNullOrWhiteSpace() || subject.DosIsNullOrWhiteSpace()) return null;
            try
            {
                var where = new List<DiyWhere>
                {
                    new DiyWhere { Name = "ProviderKey", Type = "=", Value = provider },
                    new DiyWhere { Name = "ProviderSubject", Type = "=", Value = subject }
                };
                if (!includeDisabled)
                {
                    where.Add(new DiyWhere { Name = "State", Type = "=", Value = 1 });
                    where.Add(new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 });
                }
                var result = await MicroiEngine.FormEngine.GetFormDataAsync(BindingTable, new
                {
                    OsClient = osClient,
                    _Where = where
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private static async Task<List<JObject>> ListBindingsByUserAsync(string osClient, string userId)
        {
            if (userId.DosIsNullOrWhiteSpace()) return new List<JObject>();
            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync(BindingTable, new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "BoundUserId", Type = "=", Value = userId },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    },
                    _PageIndex = 1,
                    _PageSize = 100
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null
                    ? JArray.FromObject(result.Data).OfType<JObject>().ToList()
                    : new List<JObject>();
            }
            catch { return new List<JObject>(); }
        }

        private static async Task<JObject> FindOwnedBindingAsync(string osClient, string userId, string id)
        {
            if (id.DosIsNullOrWhiteSpace()) return null;
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync(BindingTable, new
                {
                    Id = id,
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "BoundUserId", Type = "=", Value = userId },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).ConfigureAwait(false);
                return result.Code == 1 && result.Data != null ? JObject.FromObject(result.Data) : null;
            }
            catch { return null; }
        }

        private static async Task<JObject> GetEnabledUserForTokenAsync(string osClient, string userId)
        {
            if (userId.DosIsNullOrWhiteSpace()) return null;
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    Id = userId,
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).ConfigureAwait(false);
                if (result.Code != 1 || result.Data == null) return null;
                var user = MicroiEngine.V8Method.SetSysUserRoleInfo(result.Data, osClient);
                user["Pwd"] = string.Empty;
                return user;
            }
            catch { return null; }
        }

        private async Task<JsonResult> CreateDiyTokenLoginResultAsync(
            string osClient,
            JObject user,
            string clientType,
            string did,
            string loginMethod)
        {
            var token = await new DiyToken().GetAccessToken(new DiyTokenParam
            {
                CurrentUser = user,
                OsClient = osClient,
                _ClientType = clientType.DosIsNullOrWhiteSpace() ? "PC" : clientType,
                Did = did
            }).ConfigureAwait(false);
            if (token.Code != 1) return Json(token);
            var sysConfigResult = await MicroiEngine.FormEngine.GetSysConfig(osClient).ConfigureAwait(false);
            dynamic homePage = null;
            try { homePage = (await new SysMenuLogic().GetSysMenuHomePage(new SysMenuParam { OsClient = osClient }).ConfigureAwait(false)).Data; }
            catch { }
            var result = new DosResult<dynamic>(1, user)
            {
                DataAppend = new
                {
                    SysMenuHomePage = homePage,
                    SysConfig = sysConfigResult.Code == 1
                        ? TenantConfigurationSecurity.CreatePublicSysConfigProjection(sysConfigResult.Data, osClient)
                        : null,
                    LoginMethod = loginMethod
                }
            };
            _ = MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
            {
                Id = user["Id"]?.ToString(),
                LastLoginIP = IPHelper.GetClientIP(HttpContext).Data,
                LastLoginTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                OsClient = osClient
            });
            return Json(result);
        }

        private static async Task<DosResult<CurrentToken>> RequireUserTokenAsync()
        {
            var token = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            if (token?.CurrentUser == null)
                return new DosResult<CurrentToken>(1001, null, "登录身份已过期。请重新登录。");
            if (UserAccessKeySecurity.IsSession(token.CurrentUser))
                return new DosResult<CurrentToken>(0, null, "访问密钥会话不能绑定外部身份。");
            return new DosResult<CurrentToken>(1, token);
        }

        private static async Task<DosResult<string>> ResolveOsClientAsync(string requested, bool allowAnonymous)
        {
            try
            {
                var token = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
                if (token?.CurrentUser != null)
                {
                    if (!requested.DosIsNullOrWhiteSpace()
                        && !string.Equals(requested.Trim(), token.OsClient, StringComparison.OrdinalIgnoreCase))
                        return new DosResult<string>(0, null, "请求租户与当前登录身份不一致。");
                    return new DosResult<string>(1, token.OsClient);
                }
            }
            catch { }
            if (!allowAnonymous) return new DosResult<string>(1001, null, "请先登录。");
            try
            {
                var osClient = TenantConfigurationSecurity.NormalizeTenantId(requested);
                return OsClientExtend.GetClient(osClient) == null
                    ? new DosResult<string>(0, null, "租户不存在。")
                    : new DosResult<string>(1, osClient);
            }
            catch { return new DosResult<string>(0, null, "OsClient 无效。"); }
        }

        private async Task<bool> AllowBeginAsync(string osClient)
        {
            try
            {
                var ip = IPHelper.GetClientIP(HttpContext).Data ?? "unknown";
                var hash = EncryptHelper.MD5Encrypt(ip, 16);
                var key = $"Microi:{osClient}:ExternalLogin:Rate:{hash}";
                var db = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
                var count = await db.StringIncrementAsync(key).ConfigureAwait(false);
                if (count == 1) await db.KeyExpireAsync(key, TimeSpan.FromMinutes(5)).ConfigureAwait(false);
                return count <= 20;
            }
            catch { return false; }
        }

        private static string StateKey(string osClient, string state) =>
            $"Microi:{osClient}:ExternalLogin:State:{state}";

        private static string LoginTicketKey(string osClient, string ticket) =>
            $"Microi:{osClient}:ExternalLogin:Ticket:{ticket}";

        private static string NormalizeText(string value, int maxLength)
        {
            var text = new string((value ?? string.Empty).Where(ch => !char.IsControl(ch)).ToArray()).Trim();
            return text.Length <= maxLength ? text : text.Substring(0, maxLength);
        }

        private static bool FixedEquals(string left, string right)
        {
            var leftBytes = Encoding.UTF8.GetBytes(left ?? string.Empty);
            var rightBytes = Encoding.UTF8.GetBytes(right ?? string.Empty);
            return leftBytes.Length == rightBytes.Length
                   && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
        }

        private static void QueueAudit(string osClient, string userId, string action, bool success, string provider, string reason)
        {
            MicroiEngine.QueueSysLog(new SysLogParam
            {
                OsClient = osClient,
                UserId = userId,
                Category = "Security",
                Action = action,
                Source = "ExternalLogin",
                TargetType = "ExternalIdentity",
                Success = success,
                OccurredAt = DateTime.Now,
                Type = "安全审计",
                Title = action,
                Content = JsonConvert.SerializeObject(new { Success = success, Provider = provider, Reason = reason }),
                Level = success ? 1 : 2
            });
        }
    }
}
