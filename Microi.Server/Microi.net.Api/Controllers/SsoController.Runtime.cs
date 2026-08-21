using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
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
        private sealed class ValidatedProviderSession
        {
            public JObject CurrentUser { get; set; }
            public long AuthTime { get; set; }
        }

        private static IDatabase Cache(string osClient) =>
            MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();

        private static DosResult<string> ResolveAnonymousTenant(string requested)
        {
            try
            {
                var osClient = TenantConfigurationSecurity.NormalizeTenantId(requested);
                return OsClientExtend.GetClient(osClient) == null
                    ? new DosResult<string>(0, null, "租户不存在。")
                    : new DosResult<string>(1, osClient);
            }
            catch { return new DosResult<string>(0, null, "OsClient 无效。"); }
        }

        private static async Task<JObject> RunSsoApiEngineAsync(
            string apiEngineKey,
            string osClient,
            JObject parameters)
        {
            try
            {
                parameters ??= new JObject();
                parameters["OsClient"] = osClient;
                parameters["_TrustedSsoProtocol"] = true;
                object raw = await MicroiEngine.ApiEngine.RunAsync(apiEngineKey, parameters).ConfigureAwait(false);
                var token = raw is string text ? JToken.Parse(text) : raw as JToken ?? JToken.FromObject(raw);
                return token as JObject ?? new JObject
                {
                    ["Code"] = 0,
                    ["Msg"] = "SSO 接口引擎返回格式无效。"
                };
            }
            catch
            {
                return new JObject
                {
                    ["Code"] = 0,
                    ["Msg"] = "SSO 应用接口引擎不可用，请安装或升级官方 SSO 身份联邦应用。"
                };
            }
        }

        private static async Task<List<SsoConnectionOptions>> LoadConnectionsAsync(string osClient)
        {
            var result = await RunSsoApiEngineAsync(ConnectionRuntimeApiEngineKey, osClient, null)
                .ConfigureAwait(false);
            if (result.Value<int?>("Code") != 1 || result["Data"] == null)
                return new List<SsoConnectionOptions>();
            try
            {
                var rows = result["Data"] as JArray ?? JArray.FromObject(result["Data"]);
                var output = new List<SsoConnectionOptions>();
                foreach (var row in rows.OfType<JObject>())
                {
                    try
                    {
                        var item = SsoConnectionOptions.FromRow(row);
                        if (item != null) output.Add(item);
                    }
                    catch
                    {
                        QueueAudit(osClient, null, "InvalidSsoConfiguration", false,
                            row["SsoKey"]?.ToString(), row["Protocol"]?.ToString(), "ValidationFailed");
                    }
                }
                return output;
            }
            catch { return new List<SsoConnectionOptions>(); }
        }

        private static async Task<SsoConnectionOptions> FindConnectionAsync(
            string osClient,
            string key,
            string direction)
        {
            if (key.DosIsNullOrWhiteSpace()) return null;
            return (await LoadConnectionsAsync(osClient).ConfigureAwait(false)).FirstOrDefault(item =>
                item.Enabled
                && string.Equals(item.Key, key.Trim(), StringComparison.OrdinalIgnoreCase)
                && string.Equals(item.Direction, direction, StringComparison.OrdinalIgnoreCase));
        }

        private static async Task<SsoConnectionOptions> FindOutboundClientAsync(
            string osClient,
            string protocol,
            string clientId)
        {
            if (clientId.DosIsNullOrWhiteSpace()) return null;
            return (await LoadConnectionsAsync(osClient).ConfigureAwait(false)).FirstOrDefault(item =>
                item.Enabled && item.IsOutbound
                && string.Equals(item.Protocol, protocol, StringComparison.OrdinalIgnoreCase)
                && string.Equals(item.ClientId, clientId, StringComparison.Ordinal));
        }

        private static async Task<bool> HasOutboundOidcAsync(string osClient) =>
            (await LoadConnectionsAsync(osClient).ConfigureAwait(false))
                .Any(item => item.Enabled && item.IsOutbound && item.Protocol == "OIDC");

        private async Task<bool> AllowAnonymousAttemptAsync(string osClient, string action)
        {
            try
            {
                var ip = IPHelper.GetClientIP(HttpContext).Data ?? "unknown";
                var hash = EncryptHelper.MD5Encrypt(ip, 16);
                var key = $"Microi:{osClient}:SSO:Rate:{NormalizeText(action, 30)}:{hash}";
                var count = await Cache(osClient).StringIncrementAsync(key).ConfigureAwait(false);
                if (count == 1) await Cache(osClient).KeyExpireAsync(key, TimeSpan.FromMinutes(5)).ConfigureAwait(false);
                return count <= 30;
            }
            catch { return false; }
        }

        private static bool IsValidInboundState(
            InboundState state,
            string osClient,
            string connectionKey,
            string protocol)
        {
            return state != null
                   && SsoSecurity.FixedEquals(state.OsClient, osClient)
                   && SsoSecurity.FixedEquals(state.ConnectionKey, connectionKey)
                   && SsoSecurity.FixedEquals(state.Protocol, protocol)
                   && DateTimeOffset.TryParse(state.ExpiresAt, out var expires)
                   && expires > DateTimeOffset.UtcNow;
        }

        private static bool IsValidPending(AuthorizationRequestState pending, string osClient)
        {
            return pending != null
                   && SsoSecurity.FixedEquals(pending.OsClient, osClient)
                   && DateTimeOffset.TryParse(pending.ExpiresAt, out var expires)
                   && expires > DateTimeOffset.UtcNow;
        }

        private static bool IsOpaque(string value)
        {
            if (value.DosIsNullOrWhiteSpace() || value.Length < 20 || value.Length > 256) return false;
            return value.All(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_');
        }

        private string ResolveReturnOrigin(string requested)
        {
            var headerOrigin = Request.Headers.Origin.ToString().Trim();
            var value = (requested ?? string.Empty).Trim();
            if (value.Length == 0) value = headerOrigin;
            if (headerOrigin.Length > 0 && !string.Equals(value, headerOrigin, StringComparison.OrdinalIgnoreCase)) return null;
            if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
                || !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Fragment)) return null;
            var secure = uri.Scheme == Uri.UriSchemeHttps;
            var loopback = uri.Scheme == Uri.UriSchemeHttp
                           && (uri.Host == "localhost" || uri.Host == "127.0.0.1" || uri.Host == "::1");
            return secure || loopback ? uri.GetLeftPart(UriPartial.Authority).TrimEnd('/') : null;
        }

        private string BuildInboundCallbackUrl(string action, string osClient, string connectionKey)
        {
            var baseUrl = $"{Request.Scheme}://{Request.Host}{Request.PathBase}/api/Sso/{action}";
            return AppendQuery(baseUrl, new Dictionary<string, string>
            {
                ["OsClient"] = osClient,
                ["ConnectionKey"] = connectionKey
            });
        }

        private string BuildProviderIssuer(string osClient) =>
            $"{Request.Scheme}://{Request.Host}{Request.PathBase}/sso/{Uri.EscapeDataString(osClient)}".TrimEnd('/');

        private string BuildFrontendAuthorizationUrl(string osClient, string requestId)
        {
            var root = $"{Request.Scheme}://{Request.Host}{Request.PathBase}/";
            return root + "?OsClient=" + Uri.EscapeDataString(osClient)
                   + "#/sso-authorize?request=" + Uri.EscapeDataString(requestId);
        }

        private static string AppendQuery(string url, IReadOnlyDictionary<string, string> values)
        {
            if (values == null || values.Count == 0) return url;
            var separator = (url ?? string.Empty).Contains("?", StringComparison.Ordinal) ? "&" : "?";
            return url + separator + string.Join("&", values
                .Where(item => item.Value != null)
                .Select(item => Uri.EscapeDataString(item.Key) + "=" + Uri.EscapeDataString(item.Value)));
        }

        private async Task<DosResult<JObject>> LoadOidcMetadataAsync(SsoConnectionOptions connection)
        {
            var url = connection.DiscoveryUrl;
            if (url.DosIsNullOrWhiteSpace() && !connection.Issuer.DosIsNullOrWhiteSpace())
                url = connection.Issuer.TrimEnd('/') + "/.well-known/openid-configuration";
            if (url.DosIsNullOrWhiteSpace())
                return new DosResult<JObject>(0, null, "OIDC 连接未配置 DiscoveryUrl 或 Issuer。");
            var result = await ExternalGetJsonAsync(url, null, connection.AllowPrivateEndpoint).ConfigureAwait(false);
            if (result.Code != 1) return result;
            foreach (var required in new[] { "issuer", "authorization_endpoint", "token_endpoint", "jwks_uri" })
            {
                if (result.Data[required]?.ToString().DosIsNullOrWhiteSpace() != false)
                    return new DosResult<JObject>(0, null, "OIDC Discovery 缺少 " + required + "。");
            }
            return result;
        }

        private static async Task<DosResult<JObject>> ExternalGetJsonAsync(
            string url,
            IDictionary<string, string> headers,
            bool allowPrivateEndpoint)
        {
            try
            {
                SsoSecurity.RequireAbsoluteEndpoint(url, allowPrivateEndpoint);
                var response = await MicroiEngine.Http.GetResponseAsync(new
                {
                    Url = url,
                    Headers = headers,
                    Timeout = 20,
                    RequireSsrfProtection = !allowPrivateEndpoint
                }).ConfigureAwait(false);
                if (response == null || response.StatusCode < 200 || response.StatusCode >= 300
                    || response.Content == null || response.Content.Length > 1024 * 1024)
                    return new DosResult<JObject>(0, null, "SSO 外部端点请求失败。");
                return new DosResult<JObject>(1, JObject.Parse(response.Content));
            }
            catch { return new DosResult<JObject>(0, null, "SSO 外部端点不可用或响应格式无效。"); }
        }

        private static async Task<DosResult<JObject>> ExternalPostFormAsync(
            string url,
            IDictionary<string, string> form,
            IDictionary<string, string> headers,
            bool allowPrivateEndpoint)
        {
            try
            {
                SsoSecurity.RequireAbsoluteEndpoint(url, allowPrivateEndpoint);
                var response = await MicroiEngine.Http.PostResponseAsync(new
                {
                    Url = url,
                    PostParam = form,
                    ParamType = "form",
                    Headers = headers,
                    Timeout = 20,
                    RequireSsrfProtection = !allowPrivateEndpoint
                }).ConfigureAwait(false);
                if (response == null || response.StatusCode < 200 || response.StatusCode >= 300
                    || response.Content == null || response.Content.Length > 1024 * 1024)
                    return new DosResult<JObject>(0, null, "SSO 外部 Token 端点请求失败。");
                return new DosResult<JObject>(1, JObject.Parse(response.Content));
            }
            catch { return new DosResult<JObject>(0, null, "SSO 外部 Token 端点不可用或响应格式无效。"); }
        }

        private static async Task<DosResult<string>> ExternalGetTextAsync(
            string url,
            bool allowPrivateEndpoint)
        {
            try
            {
                SsoSecurity.RequireAbsoluteEndpoint(url, allowPrivateEndpoint);
                var response = await MicroiEngine.Http.GetResponseAsync(new
                {
                    Url = url,
                    Timeout = 20,
                    RequireSsrfProtection = !allowPrivateEndpoint
                }).ConfigureAwait(false);
                if (response == null || response.StatusCode < 200 || response.StatusCode >= 300
                    || response.Content == null || response.Content.Length > 1024 * 1024)
                    return new DosResult<string>(0, null, "SSO 外部端点请求失败。");
                return new DosResult<string>(1, response.Content);
            }
            catch { return new DosResult<string>(0, null, "SSO 外部端点不可用。"); }
        }

        private static JObject ClaimsToObject(IEnumerable<System.Security.Claims.Claim> claims)
        {
            var result = new JObject();
            foreach (var group in (claims ?? Enumerable.Empty<System.Security.Claims.Claim>()).GroupBy(item => item.Type))
            {
                var values = group.Select(item => item.Value).Distinct(StringComparer.Ordinal).ToList();
                result[group.Key] = values.Count == 1 ? new JValue(values[0]) : new JArray(values);
            }
            return result;
        }

        private static void MergeClaims(JObject target, JObject source)
        {
            if (target == null || source == null) return;
            foreach (var property in source.Properties()) target[property.Name] = property.Value.DeepClone();
        }

        private static void ApplyProfileClaims(FederatedProfile profile, SsoConnectionOptions connection)
        {
            profile.Subject = ClaimText(profile.Claims, connection.SubjectClaim);
            profile.Account = ClaimText(profile.Claims, connection.AccountClaim);
            profile.Name = ClaimText(profile.Claims, connection.NameClaim);
            profile.Email = ClaimText(profile.Claims, connection.EmailClaim);
            foreach (var mapping in connection.ClaimMappings.Properties())
            {
                var value = ClaimText(profile.Claims, mapping.Name);
                switch ((mapping.Value?.ToString() ?? string.Empty).Trim().ToLowerInvariant())
                {
                    case "account": if (!value.DosIsNullOrWhiteSpace()) profile.Account = value; break;
                    case "name": if (!value.DosIsNullOrWhiteSpace()) profile.Name = value; break;
                    case "email": if (!value.DosIsNullOrWhiteSpace()) profile.Email = value; break;
                    case "subject": if (!value.DosIsNullOrWhiteSpace()) profile.Subject = value; break;
                }
            }
        }

        private static string ClaimText(JObject claims, string name)
        {
            var token = claims?[name];
            return token is JArray array ? array.FirstOrDefault()?.ToString() : token?.ToString();
        }

        private static async Task<DosResult<JObject>> ResolveFederatedUserAsync(
            string osClient,
            SsoConnectionOptions connection,
            FederatedProfile profile)
        {
            if (profile?.Subject.DosIsNullOrWhiteSpace() != false || profile.Subject.Length > 500)
                return new DosResult<JObject>(0, null, "外部身份 subject 无效。");
            var result = await RunSsoApiEngineAsync(ResolveIdentityApiEngineKey, osClient, new JObject
            {
                ["Connection"] = JObject.FromObject(connection),
                ["Profile"] = JObject.FromObject(profile)
            }).ConfigureAwait(false);
            if (result.Value<int?>("Code") != 1 || result["Data"] is not JObject user)
                return new DosResult<JObject>(0, null,
                    result.Value<string>("Msg") ?? "SSO 用户解析失败。");
            return new DosResult<JObject>(1, user);
        }

        private static async Task<JObject> GetEnabledUserAsync(string osClient, string userId)
        {
            if (userId.DosIsNullOrWhiteSpace()) return null;
            var result = await RunSsoApiEngineAsync(UserRuntimeApiEngineKey, osClient, new JObject
            {
                ["UserId"] = userId
            }).ConfigureAwait(false);
            return result.Value<int?>("Code") == 1 ? result["Data"] as JObject : null;
        }

        private static async Task<string> CreateLoginTicketAsync(
            string osClient,
            SsoConnectionOptions connection,
            string userId)
        {
            var ticket = SsoSecurity.NewOpaqueValue();
            var payload = new JObject
            {
                ["OsClient"] = osClient,
                ["UserId"] = userId,
                ["ConnectionKey"] = connection.Key,
                ["Protocol"] = connection.Protocol,
                ["ExpiresAt"] = DateTimeOffset.UtcNow.Add(LoginTicketLifetime).ToString("O")
            };
            var saved = await Cache(osClient).StringSetAsync(LoginTicketKey(osClient, ticket),
                payload.ToString(Formatting.None), LoginTicketLifetime, When.NotExists).ConfigureAwait(false);
            return saved ? ticket : null;
        }

        private AuthorizationRequestState NewPendingAuthorization(
            string osClient,
            SsoConnectionOptions connection,
            string clientId,
            string redirectUri,
            string scope,
            string state,
            string nonce,
            string challenge)
        {
            var now = DateTimeOffset.UtcNow;
            return new AuthorizationRequestState
            {
                OsClient = osClient,
                Protocol = connection.Protocol,
                ConnectionKey = connection.Key,
                ClientId = clientId,
                RedirectUri = redirectUri,
                ResponseType = "code",
                Scope = scope,
                State = state,
                Nonce = nonce,
                CodeChallenge = challenge,
                CodeChallengeMethod = "S256",
                CreatedAt = now.ToString("O"),
                ExpiresAt = now.Add(AuthorizationRequestLifetime).ToString("O")
            };
        }

        private static async Task<DosResult<string>> CompletePendingAuthorizationAsync(
            AuthorizationRequestState pending,
            JObject user,
            long authTime)
        {
            if (!IsValidPending(pending, pending?.OsClient))
                return new DosResult<string>(0, null, "SSO 授权请求已过期。");
            if (pending.Protocol == "SAML2")
                return await CompleteSamlPendingAsync(pending, user, authTime).ConfigureAwait(false);
            if (pending.Protocol == "CAS")
                return await CompleteCasPendingAsync(pending, user, authTime).ConfigureAwait(false);
            if (pending.Protocol != "OIDC")
                return new DosResult<string>(0, null, "不支持的 SSO 授权协议。");
            var client = await FindOutboundClientAsync(pending.OsClient, "OIDC", pending.ClientId).ConfigureAwait(false);
            if (client == null
                || !SsoSecurity.IsExactRedirectUriAllowed(pending.RedirectUri, client.RedirectUris,
                    client.AllowLoopbackRedirectUri))
                return new DosResult<string>(0, null, "OIDC 客户端或回调地址已变更。");
            var code = SsoSecurity.NewOpaqueValue(48);
            var now = DateTimeOffset.UtcNow;
            var payload = new AuthorizationCodePayload
            {
                OsClient = pending.OsClient,
                ConnectionKey = client.Key,
                ClientId = client.ClientId,
                RedirectUri = pending.RedirectUri,
                Scope = pending.Scope,
                Nonce = pending.Nonce,
                CodeChallenge = pending.CodeChallenge,
                UserId = user?["Id"]?.ToString(),
                AuthTime = authTime,
                ExpiresAt = now.Add(AuthorizationCodeLifetime).ToString("O")
            };
            var saved = await Cache(pending.OsClient).StringSetAsync(AuthorizationCodeKey(pending.OsClient, code),
                JsonConvert.SerializeObject(payload), AuthorizationCodeLifetime, When.NotExists).ConfigureAwait(false);
            if (!saved) return new DosResult<string>(0, null, "OIDC 授权码创建失败。");
            QueueAudit(pending.OsClient, payload.UserId, "OutboundOidcAuthorized", true, client.Key, "OIDC", null);
            return new DosResult<string>(1, AppendQuery(pending.RedirectUri,
                new Dictionary<string, string> { ["code"] = code, ["state"] = pending.State }));
        }

        private async Task EstablishProviderSessionAsync(CurrentToken token)
        {
            if (token?.CurrentUser == null || token.Token.DosIsNullOrWhiteSpace()) return;
            var sessionId = SsoSecurity.NewOpaqueValue();
            var now = DateTimeOffset.UtcNow;
            var model = new ProviderSession
            {
                OsClient = token.OsClient,
                DiyToken = token.Token,
                UserId = token.CurrentUser["Id"]?.ToString(),
                AuthTime = now.ToUnixTimeSeconds(),
                ExpiresAt = now.Add(ProviderSessionLifetime).ToString("O")
            };
            var saved = await Cache(token.OsClient).StringSetAsync(ProviderSessionKey(token.OsClient, sessionId),
                JsonConvert.SerializeObject(model), ProviderSessionLifetime, When.NotExists).ConfigureAwait(false);
            if (!saved) return;
            Response.Cookies.Append(ProviderCookieName(token.OsClient), sessionId, new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                MaxAge = ProviderSessionLifetime,
                IsEssential = true
            });
        }

        private async Task<ValidatedProviderSession> GetProviderSessionAsync(string osClient)
        {
            var sessionId = Request.Cookies[ProviderCookieName(osClient)];
            if (!IsOpaque(sessionId)) return null;
            try
            {
                var raw = await Cache(osClient).StringGetAsync(ProviderSessionKey(osClient, sessionId)).ConfigureAwait(false);
                if (!raw.HasValue) return null;
                var model = JsonConvert.DeserializeObject<ProviderSession>(raw.ToString());
                if (model == null || !SsoSecurity.FixedEquals(model.OsClient, osClient)
                    || !DateTimeOffset.TryParse(model.ExpiresAt, out var expires) || expires <= DateTimeOffset.UtcNow)
                    return null;
                var current = await DiyToken.GetCurrentToken(model.DiyToken, osClient).ConfigureAwait(false);
                if (current?.CurrentUser == null
                    || !SsoSecurity.FixedEquals(current.CurrentUser["Id"]?.ToString(), model.UserId)
                    || UserAccessKeySecurity.IsSession(current.CurrentUser)) return null;
                return new ValidatedProviderSession { CurrentUser = current.CurrentUser, AuthTime = model.AuthTime };
            }
            catch { return null; }
        }

        private async Task<DosResult<SsoConnectionOptions>> AuthenticateOutboundClientAsync(
            string osClient,
            string protocol,
            IFormCollection form)
        {
            string clientId = form?["client_id"].ToString();
            string clientSecret = form?["client_secret"].ToString();
            var authorization = Request.Headers.Authorization.ToString();
            var usedBasic = authorization.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase);
            if (usedBasic)
            {
                try
                {
                    var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(authorization.Substring(6).Trim()));
                    var separator = decoded.IndexOf(':');
                    if (separator >= 0)
                    {
                        clientId = Uri.UnescapeDataString(decoded.Substring(0, separator));
                        clientSecret = Uri.UnescapeDataString(decoded.Substring(separator + 1));
                    }
                }
                catch { return new DosResult<SsoConnectionOptions>(0, null, "client authentication is malformed"); }
            }
            var client = await FindOutboundClientAsync(osClient, protocol, clientId).ConfigureAwait(false);
            if (client == null) return new DosResult<SsoConnectionOptions>(0, null, "client is not registered");
            if (client.ClientAuthMethod == "none")
                return usedBasic || !clientSecret.DosIsNullOrWhiteSpace()
                    ? new DosResult<SsoConnectionOptions>(0, null, "public client must not send a client secret")
                    : new DosResult<SsoConnectionOptions>(1, client);
            if (client.ClientAuthMethod == "client_secret_basic" && !usedBasic)
                return new DosResult<SsoConnectionOptions>(0, null, "client_secret_basic is required");
            if (client.ClientAuthMethod == "client_secret_post" && usedBasic)
                return new DosResult<SsoConnectionOptions>(0, null, "client_secret_post is required");
            var encoded = LoadSecretSetting(osClient, client.ClientSecretSettingKey);
            if (encoded.DosIsNullOrWhiteSpace() || !SsoSecurity.VerifyClientSecret(clientSecret, encoded))
                return new DosResult<SsoConnectionOptions>(0, null, "client credentials are invalid");
            return new DosResult<SsoConnectionOptions>(1, client);
        }

        private static string LoadSecretSetting(string osClient, string key)
        {
            if (key.DosIsNullOrWhiteSpace()) return string.Empty;
            try
            {
                var settings = TenantSystemSettingsSecurity.LoadSnapshot(osClient);
                return TenantSystemSettingsSecurity.GetText(settings,
                    TenantSystemSettingsSecurity.NormalizeKey(key), string.Empty, decryptSecret: true);
            }
            catch { return string.Empty; }
        }

        private static async Task<DosResult> UpsertSecretSettingAsync(
            string osClient,
            string key,
            string plainValue,
            string category,
            string description)
        {
            try
            {
                key = TenantSystemSettingsSecurity.NormalizeKey(key);
                var existing = await MicroiEngine.FormEngine.GetFormDataAsync(TenantSystemSettingsSecurity.TableName, new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere> { new DiyWhere { Name = "ConfigKey", Type = "=", Value = key } }
                }).ConfigureAwait(false);
                var form = new JObject
                {
                    ["Id"] = existing.Code == 1 && existing.Data != null
                        ? JObject.FromObject(existing.Data)["Id"]?.ToString()
                        : Guid.NewGuid().ToString(),
                    ["ConfigKey"] = key,
                    ["ConfigValue"] = string.Empty,
                    ["SecretCipher"] = TenantSystemSettingsSecurity.ProtectSecret(osClient, key, plainValue),
                    ["ValueType"] = "String",
                    ["Category"] = NormalizeText(category, 80),
                    ["Description"] = NormalizeText(description, 500),
                    ["IsPublic"] = 0,
                    ["IsSecret"] = 1,
                    ["IsEnabled"] = 1,
                    ["ValueSource"] = "RuntimeGenerated",
                    ["OsClient"] = osClient
                };
                return existing.Code == 1 && existing.Data != null
                    ? await MicroiEngine.FormEngine.UptFormDataAsync(TenantSystemSettingsSecurity.TableName, form).ConfigureAwait(false)
                    : await MicroiEngine.FormEngine.AddFormDataAsync(TenantSystemSettingsSecurity.TableName, form).ConfigureAwait(false);
            }
            catch { return new DosResult(0, null, "租户系统设置密钥保存失败。"); }
        }

        private static async Task<string> GetOrCreateSecretAsync(
            string osClient,
            string key,
            int byteCount,
            string description)
        {
            var existing = LoadSecretSetting(osClient, key);
            if (!existing.DosIsNullOrWhiteSpace()) return existing;
            var lease = SsoSecurity.NewOpaqueValue();
            var lockKey = $"Microi:{osClient}:SSO:SecretInit:{key}";
            var acquired = await Cache(osClient).StringSetAsync(lockKey, lease, TimeSpan.FromSeconds(30), When.NotExists)
                .ConfigureAwait(false);
            if (!acquired)
            {
                for (var index = 0; index < 10; index++)
                {
                    await Task.Delay(150).ConfigureAwait(false);
                    existing = LoadSecretSetting(osClient, key);
                    if (!existing.DosIsNullOrWhiteSpace()) return existing;
                }
                return null;
            }
            try
            {
                existing = LoadSecretSetting(osClient, key);
                if (!existing.DosIsNullOrWhiteSpace()) return existing;
                var value = SsoSecurity.NewOpaqueValue(byteCount);
                var save = await UpsertSecretSettingAsync(osClient, key, value, "SSO", description).ConfigureAwait(false);
                return save.Code == 1 ? value : null;
            }
            finally
            {
                await Cache(osClient).ScriptEvaluateAsync(
                    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                    new RedisKey[] { lockKey }, new RedisValue[] { lease }).ConfigureAwait(false);
            }
        }

        private static async Task<OidcSigningMaterial> GetSigningMaterialAsync(string osClient)
        {
            var encoded = LoadSecretSetting(osClient, SigningKeySetting);
            if (encoded.DosIsNullOrWhiteSpace())
            {
                var lease = SsoSecurity.NewOpaqueValue();
                var lockKey = $"Microi:{osClient}:SSO:SigningKeyInit";
                var acquired = await Cache(osClient).StringSetAsync(lockKey, lease, TimeSpan.FromSeconds(30), When.NotExists)
                    .ConfigureAwait(false);
                if (!acquired) return null;
                try
                {
                    encoded = LoadSecretSetting(osClient, SigningKeySetting);
                    if (encoded.DosIsNullOrWhiteSpace())
                    {
                        using var generated = RSA.Create(3072);
                        encoded = Convert.ToBase64String(generated.ExportPkcs8PrivateKey());
                        var save = await UpsertSecretSettingAsync(osClient, SigningKeySetting, encoded,
                            "SSO", "OIDC RS256 租户签名私钥").ConfigureAwait(false);
                        if (save.Code != 1) return null;
                    }
                }
                finally
                {
                    await Cache(osClient).ScriptEvaluateAsync(
                        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                        new RedisKey[] { lockKey }, new RedisValue[] { lease }).ConfigureAwait(false);
                }
            }
            try
            {
                var rsa = RSA.Create();
                rsa.ImportPkcs8PrivateKey(Convert.FromBase64String(encoded), out _);
                var parameters = rsa.ExportParameters(false);
                var kid = SsoSecurity.HashOpaqueToken(Convert.ToBase64String(parameters.Modulus)).Substring(0, 24);
                var key = new RsaSecurityKey(rsa) { KeyId = kid };
                return new OidcSigningMaterial
                {
                    Rsa = rsa,
                    Key = key,
                    Credentials = new SigningCredentials(key, SecurityAlgorithms.RsaSha256),
                    PublicJwk = new JObject
                    {
                        ["kty"] = "RSA", ["use"] = "sig", ["alg"] = "RS256", ["kid"] = kid,
                        ["n"] = Base64Url(parameters.Modulus), ["e"] = Base64Url(parameters.Exponent)
                    }
                };
            }
            catch { return null; }
        }

        private static async Task<DosResult<JObject>> BuildOutboundClaimsAsync(
            string osClient,
            JObject user,
            string subject,
            string scope)
        {
            var result = await RunSsoApiEngineAsync(OutboundClaimsApiEngineKey, osClient, new JObject
            {
                ["User"] = user,
                ["Subject"] = subject,
                ["Scope"] = scope
            }).ConfigureAwait(false);
            return result.Value<int?>("Code") == 1 && result["Data"] is JObject claims
                ? new DosResult<JObject>(1, claims)
                : new DosResult<JObject>(0, null,
                    result.Value<string>("Msg") ?? "OIDC Claim 投影失败。");
        }

        private async Task<ProtocolTokenPayload> ReadAccessTokenAsync(string osClient)
        {
            var authorization = Request.Headers.Authorization.ToString();
            if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;
            var token = authorization.Substring(7).Trim();
            var payload = await ReadProtocolTokenAsync(osClient, token).ConfigureAwait(false);
            if (payload?.TokenType != "access_token") return null;
            if (!payload.FamilyId.DosIsNullOrWhiteSpace()
                && await Cache(osClient).KeyExistsAsync(RefreshFamilyRevokedKey(osClient, payload.FamilyId)).ConfigureAwait(false))
                return null;
            return payload;
        }

        private static async Task<ProtocolTokenPayload> ReadProtocolTokenAsync(string osClient, string token)
        {
            if (!IsOpaque(token)) return null;
            try
            {
                var raw = await Cache(osClient).StringGetAsync(ProtocolTokenKey(osClient, token)).ConfigureAwait(false);
                if (!raw.HasValue) return null;
                var payload = JsonConvert.DeserializeObject<ProtocolTokenPayload>(raw.ToString());
                return payload != null
                       && SsoSecurity.FixedEquals(payload.OsClient, osClient)
                       && DateTimeOffset.TryParse(payload.ExpiresAt, out var expires)
                       && expires > DateTimeOffset.UtcNow
                    ? payload
                    : null;
            }
            catch { return null; }
        }

        private IActionResult OidcError(string redirectUri, string state, string error, string description)
        {
            if (redirectUri.DosIsNullOrWhiteSpace()) return BadRequest(new { error, error_description = description });
            return Redirect(AppendQuery(redirectUri, new Dictionary<string, string>
            {
                ["error"] = error,
                ["error_description"] = description,
                ["state"] = state
            }));
        }

        private IActionResult OAuthError(string error, string description, int status)
        {
            Response.StatusCode = status;
            if (status == 401) Response.Headers.WWWAuthenticate = "Basic realm=\"Microi SSO\"";
            return Json(new { error, error_description = description });
        }

        private void SetNoStore()
        {
            Response.Headers.CacheControl = "no-store";
            Response.Headers.Pragma = "no-cache";
        }

        private IActionResult PopupResult(string targetOrigin, string provider, bool success, string message, string ticket)
        {
            targetOrigin = targetOrigin.DosIsNullOrWhiteSpace() ? "*" : targetOrigin;
            var payload = new JObject
            {
                ["type"] = "microi-sso-login", ["provider"] = provider ?? string.Empty,
                ["success"] = success, ["message"] = message ?? string.Empty, ["ticket"] = ticket ?? string.Empty
            };
            var json = SafeJsonForScript(payload.ToString(Formatting.None));
            var targetJson = SafeJsonForScript(JsonConvert.SerializeObject(targetOrigin));
            var title = success ? "身份验证成功" : "身份验证未完成";
            var html = "<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
                       + "<title>" + WebUtility.HtmlEncode(title) + "</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui;background:#0b1220;color:#eef5ff}.card{max-width:420px;padding:28px;border:1px solid #ffffff24;border-radius:20px;background:#ffffff0d;text-align:center}.dot{width:54px;height:54px;margin:auto;display:grid;place-items:center;border-radius:50%;background:"
                       + (success ? "#27b67a" : "#e45b69") + ";font-size:28px}p{color:#aebbd0;line-height:1.7}</style></head><body><div class=\"card\"><div class=\"dot\">"
                       + (success ? "✓" : "!") + "</div><h1>" + WebUtility.HtmlEncode(title) + "</h1><p>"
                       + WebUtility.HtmlEncode(message ?? string.Empty) + "</p><small>窗口将自动关闭</small></div><script>(function(){var data="
                       + json + ";try{if(window.opener&&!window.opener.closed){window.opener.postMessage(data," + targetJson + ");setTimeout(function(){window.close()},450);}}catch(e){}})();</script></body></html>";
            SetNoStore();
            Response.Headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
            return Content(html, "text/html", Encoding.UTF8);
        }

        private static string SafeJsonForScript(string value) =>
            (value ?? string.Empty).Replace("<", "\\u003c").Replace(">", "\\u003e").Replace("&", "\\u0026")
                .Replace("\u2028", "\\u2028").Replace("\u2029", "\\u2029");

        private static async Task<DosResult<CurrentToken>> RequireUserTokenAsync()
        {
            var token = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            if (token?.CurrentUser == null)
                return new DosResult<CurrentToken>(1001, null, "登录身份已过期。请重新登录。");
            if (UserAccessKeySecurity.IsSession(token.CurrentUser))
                return new DosResult<CurrentToken>(0, null, "访问密钥会话不能完成交互式 SSO 授权。");
            return new DosResult<CurrentToken>(1, token);
        }

        private static void QueueAudit(
            string osClient,
            string userId,
            string action,
            bool success,
            string connectionKey,
            string protocol,
            string reason)
        {
            try
            {
                var result = RunSsoApiEngineAsync(ProtocolEventApiEngineKey, osClient, new JObject
                {
                    ["Action"] = action,
                    ["UserId"] = userId,
                    ["ConnectionKey"] = connectionKey,
                    ["Protocol"] = protocol,
                    ["Success"] = success,
                    ["Reason"] = reason,
                    ["OccurredAt"] = DateTime.UtcNow.ToString("O")
                }).GetAwaiter().GetResult();
                if (result.Value<int?>("Code") == 1) return;
            }
            catch { }

            // 应用未安装或审计引擎故障时保留最小安全兜底；不承载可配置业务逻辑。
            MicroiEngine.QueueSysLog(new SysLogParam
            {
                OsClient = osClient,
                UserId = userId,
                Category = "Security",
                Action = action,
                Source = "SsoGatewayFallback",
                TargetType = "SsoConnection",
                TargetId = connectionKey,
                Success = success,
                OccurredAt = DateTime.Now,
                Type = "安全审计",
                Title = action,
                Content = JsonConvert.SerializeObject(new { Success = success, ConnectionKey = connectionKey, Protocol = protocol, Reason = reason }),
                Level = success ? 1 : 2
            });
        }

        private static string NormalizeText(string value, int maxLength)
        {
            var text = new string((value ?? string.Empty).Where(ch => !char.IsControl(ch)).ToArray()).Trim();
            return text.Length <= maxLength ? text : text.Substring(0, maxLength);
        }

        private static string Base64Url(byte[] value) =>
            Convert.ToBase64String(value ?? Array.Empty<byte>()).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        private static string ProviderCookieName(string osClient) =>
            "microi_sso_" + SsoSecurity.HashOpaqueToken(osClient).Substring(0, 12);

        private static string InboundStateKey(string osClient, string state) => $"Microi:{osClient}:SSO:InboundState:{state}";
        private static string LoginTicketKey(string osClient, string ticket) => $"Microi:{osClient}:SSO:LoginTicket:{ticket}";
        private static string AuthorizationRequestKey(string osClient, string id) => $"Microi:{osClient}:SSO:AuthorizationRequest:{id}";
        private static string AuthorizationCodeKey(string osClient, string code) => $"Microi:{osClient}:SSO:AuthorizationCode:{code}";
        private static string ProtocolTokenKey(string osClient, string token) => $"Microi:{osClient}:SSO:Token:{SsoSecurity.HashOpaqueToken(token)}";
        private static string RefreshUsedKey(string osClient, string token) => $"Microi:{osClient}:SSO:RefreshUsed:{SsoSecurity.HashOpaqueToken(token)}";
        private static string RefreshFamilyRevokedKey(string osClient, string family) => $"Microi:{osClient}:SSO:RefreshFamilyRevoked:{family}";
        private static string ProviderSessionKey(string osClient, string id) => $"Microi:{osClient}:SSO:ProviderSession:{id}";
    }
}
