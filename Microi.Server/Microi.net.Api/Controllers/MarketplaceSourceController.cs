using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 应用商城上游源的最小可信协议网关。
    ///
    /// 商城列表、版本和安装业务继续由应用包中的 V8 接口引擎负责；本控制器只处理
    /// 不能交给浏览器或租户可编辑脚本的安全边界：远端租户发现、验证码转发、MCP
    /// 长会话登录、Token 认证加密保存，以及使用后端持有 Token 的只读代理请求。
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public sealed class MarketplaceSourceController : Controller
    {
        private const string CredentialPrefix = "Marketplace.SourceToken.";
        private const int MaxRemoteResponseBytes = 12 * 1024 * 1024;
        private static readonly Regex SourceIdRegex = new Regex(
            @"^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private readonly IHttpClientFactory _httpClientFactory;

        public MarketplaceSourceController(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public sealed class SourceRequest
        {
            public string SourceId { get; set; }
            public string ApiBase { get; set; }
            public string OsClient { get; set; }
            public string Account { get; set; }
            public string Password { get; set; }
            public string CaptchaId { get; set; }
            public string CaptchaValue { get; set; }
            public string Operation { get; set; }
            public JObject Param { get; set; }
        }

        private sealed class SourceCredential
        {
            public string Token { get; set; }
            public string ApiBase { get; set; }
            public string OsClient { get; set; }
            public string Did { get; set; }
            public string Account { get; set; }
            public DateTime? ExpiresAtUtc { get; set; }
            public DateTime SavedAtUtc { get; set; }
        }

        private sealed class RemoteResult
        {
            public HttpStatusCode StatusCode { get; set; }
            public JObject Body { get; set; }
            public string Authorization { get; set; }
            public string CaptchaId { get; set; }
            public byte[] Bytes { get; set; }
            public string ContentType { get; set; }
        }

        [HttpPost]
        public async Task<JsonResult> Discover([FromBody] SourceRequest request)
        {
            var tokenResult = await RequireAdministratorAsync().ConfigureAwait(false);
            if (tokenResult.Code != 1) return Json(tokenResult);
            if (!TryNormalizeRequest(request, out var sourceId, out var apiBase, out var remoteOsClient, out var error))
                return Json(new DosResult(0, null, error));

            try
            {
                var credential = LoadCredential(tokenResult.Data.OsClient, sourceId, apiBase, remoteOsClient);
                var configResult = await SendJsonAsync(
                    apiBase,
                    "/api/FormEngine/GetSysConfig",
                    remoteOsClient,
                    new JObject { ["OsClient"] = remoteOsClient },
                    null).ConfigureAwait(false);
                if (configResult.Body?["Code"]?.Val<int>() != 1)
                    return Json(new DosResult(0, null,
                        configResult.Body?["Msg"]?.ToString() ?? $"商城源发现失败（HTTP {(int)configResult.StatusCode}）。"));

                var publicCount = await ReadApplicationCountAsync(apiBase, remoteOsClient, null).ConfigureAwait(false);
                var accessibleCount = credential == null
                    ? publicCount
                    : await ReadApplicationCountAsync(apiBase, remoteOsClient, credential).ConfigureAwait(false);
                var config = configResult.Body?["Data"] as JObject ?? new JObject();
                return Json(new DosResult(1, new
                {
                    SourceId = sourceId,
                    ApiBase = apiBase,
                    OsClient = remoteOsClient,
                    SystemTitle = FirstText(config, "SysTitle", "SysShortTitle", "CompanyName", "OsClient")
                                  ?? remoteOsClient,
                    SystemShortTitle = FirstText(config, "SysShortTitle", "SysTitle") ?? remoteOsClient,
                    RequiresCaptcha = Flag(config["EnableCaptcha"]),
                    HasCredential = credential != null,
                    CredentialExpired = credential?.ExpiresAtUtc.HasValue == true
                                        && credential.ExpiresAtUtc.Value <= DateTime.UtcNow,
                    CredentialExpiresAt = credential?.ExpiresAtUtc?.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss"),
                    PublicApplicationCount = publicCount,
                    AccessibleApplicationCount = accessibleCount,
                    PrivateApplicationCount = Math.Max(0, accessibleCount - publicCount),
                    CredentialKey = CredentialKey(sourceId)
                }, "商城源识别成功。"));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, SafeRemoteError(ex)));
            }
        }

        [HttpPost]
        public async Task<JsonResult> Captcha([FromBody] SourceRequest request)
        {
            var tokenResult = await RequireAdministratorAsync().ConfigureAwait(false);
            if (tokenResult.Code != 1) return Json(tokenResult);
            if (!TryNormalizeRequest(request, out _, out var apiBase, out var remoteOsClient, out var error))
                return Json(new DosResult(0, null, error));
            try
            {
                var result = await SendBinaryAsync(
                    apiBase,
                    "/api/Captcha/GetCaptcha?OsClient=" + Uri.EscapeDataString(remoteOsClient),
                    remoteOsClient).ConfigureAwait(false);
                if ((int)result.StatusCode < 200 || (int)result.StatusCode >= 300 || result.Bytes == null)
                    return Json(new DosResult(0, null, $"验证码读取失败（HTTP {(int)result.StatusCode}）。"));
                Response.Headers.CacheControl = "no-store";
                return Json(new DosResult(1, new
                {
                    CaptchaId = result.CaptchaId,
                    ImageDataUrl = $"data:{(result.ContentType ?? "image/png")};base64,{Convert.ToBase64String(result.Bytes)}"
                }));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, SafeRemoteError(ex)));
            }
        }

        [HttpPost]
        public async Task<JsonResult> Login([FromBody] SourceRequest request)
        {
            var tokenResult = await RequireAdministratorAsync().ConfigureAwait(false);
            if (tokenResult.Code != 1) return Json(tokenResult);
            if (!TryNormalizeRequest(request, out var sourceId, out var apiBase, out var remoteOsClient, out var error))
                return Json(new DosResult(0, null, error));
            var account = NormalizeText(request?.Account, 128);
            var password = request?.Password ?? string.Empty;
            if (account.Length == 0 || password.Length == 0)
                return Json(new DosResult(0, null, "请输入商城源帐号和密码。"));
            if (password.Length > 1024)
                return Json(new DosResult(0, null, "密码长度无效。"));
            var sourceUri = new Uri(apiBase, UriKind.Absolute);
            if (!string.Equals(sourceUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
                && !sourceUri.IsLoopback)
                return Json(new DosResult(0, null, "私有商城源登录必须使用 HTTPS；仅本机调试地址允许 HTTP。"));

            try
            {
                var configResult = await SendJsonAsync(
                    apiBase,
                    "/api/FormEngine/GetSysConfig",
                    remoteOsClient,
                    new JObject { ["OsClient"] = remoteOsClient },
                    null).ConfigureAwait(false);
                if (configResult.Body?["Code"]?.Val<int>() != 1)
                    return Json(new DosResult(0, null, configResult.Body?["Msg"]?.ToString() ?? "无法读取商城源登录配置。"));
                var config = configResult.Body?["Data"] as JObject ?? new JObject();
                var publicKey = config["LoginRsaPublicKey"]?.ToString()?.Replace("\\n", "\n").Trim();
                var encryptedPassword = password;
                if (!publicKey.DosIsNullOrWhiteSpace())
                {
                    encryptedPassword = EncryptHelper.RSAEncrypt(password, publicKey);
                    if (!EncryptHelper.IsRSAEncrypted(encryptedPassword))
                        return Json(new DosResult(0, null, "商城源登录公钥无效，密码未发送。"));
                }

                var did = BuildDid(tokenResult.Data.OsClient, sourceId);
                var loginForm = new Dictionary<string, string>
                {
                    ["Account"] = account,
                    ["Pwd"] = encryptedPassword,
                    ["OsClient"] = remoteOsClient,
                    ["_ClientType"] = "MCP",
                    ["Did"] = did
                };
                if (!request.CaptchaId.DosIsNullOrWhiteSpace()) loginForm["_CaptchaId"] = request.CaptchaId.Trim();
                if (!request.CaptchaValue.DosIsNullOrWhiteSpace()) loginForm["_CaptchaValue"] = request.CaptchaValue.Trim();
                var loginResult = await SendFormAsync(
                    apiBase,
                    "/api/SysUser/Login",
                    remoteOsClient,
                    did,
                    loginForm).ConfigureAwait(false);
                if (loginResult.Body?["Code"]?.Val<int>() != 1 || loginResult.Authorization.DosIsNullOrWhiteSpace())
                {
                    QueueAudit(tokenResult.Data, "MarketplaceSourceLogin", false, sourceId, apiBase, remoteOsClient);
                    return Json(new DosResult(loginResult.Body?["Code"]?.Val<int>() ?? 0, null,
                        loginResult.Body?["Msg"]?.ToString() ?? "商城源登录失败。"));
                }

                var credential = new SourceCredential
                {
                    Token = NormalizeToken(loginResult.Authorization),
                    ApiBase = apiBase,
                    OsClient = remoteOsClient,
                    Did = did,
                    Account = account,
                    ExpiresAtUtc = ReadTokenExpiry(loginResult.Authorization),
                    SavedAtUtc = DateTime.UtcNow
                };
                var saveResult = await SaveCredentialAsync(tokenResult.Data.OsClient, sourceId, credential).ConfigureAwait(false);
                QueueAudit(tokenResult.Data, "MarketplaceSourceLogin", saveResult.Code == 1, sourceId, apiBase, remoteOsClient);
                if (saveResult.Code != 1) return Json(saveResult);
                var accessibleCount = await ReadApplicationCountAsync(apiBase, remoteOsClient, credential).ConfigureAwait(false);
                Response.Headers.CacheControl = "no-store";
                return Json(new DosResult(1, new
                {
                    SourceId = sourceId,
                    HasCredential = true,
                    Account = MaskAccount(account),
                    CredentialExpiresAt = credential.ExpiresAtUtc?.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss"),
                    AccessibleApplicationCount = accessibleCount,
                    CredentialKey = CredentialKey(sourceId)
                }, "私有商城源登录成功，长会话凭据已加密保存。"));
            }
            catch (Exception ex)
            {
                QueueAudit(tokenResult.Data, "MarketplaceSourceLogin", false, sourceId, apiBase, remoteOsClient);
                return Json(new DosResult(0, null, SafeRemoteError(ex)));
            }
        }

        [HttpPost]
        public async Task<JsonResult> Query([FromBody] SourceRequest request)
        {
            var tokenResult = await RequireAdministratorAsync().ConfigureAwait(false);
            if (tokenResult.Code != 1) return Json(tokenResult);
            if (!TryNormalizeRequest(request, out var sourceId, out var apiBase, out var remoteOsClient, out var error))
                return Json(new DosResult(0, null, error));
            var operation = (request?.Operation ?? "List").Trim();
            var path = operation switch
            {
                "List" => "/apiengine/get-microi-store-list",
                "Model" => "/apiengine/get-microi-store-model",
                "Versions" => "/apiengine/get-microi-store-versions",
                _ => null
            };
            if (path == null) return Json(new DosResult(0, null, "不支持的商城源只读操作。"));
            try
            {
                var credential = LoadCredential(tokenResult.Data.OsClient, sourceId, apiBase, remoteOsClient);
                var result = await SendJsonAsync(apiBase, path, remoteOsClient,
                    request?.Param ?? new JObject(), credential).ConfigureAwait(false);
                if (result.Body == null)
                    return Json(new DosResult(0, null, $"商城源未返回 JSON（HTTP {(int)result.StatusCode}）。"));
                Response.Headers.CacheControl = "no-store";
                result.Body["DataAppend"] ??= new JObject();
                if (result.Body["DataAppend"] is JObject append)
                {
                    append["SourceAuthenticated"] = credential != null;
                    append["CredentialKey"] = CredentialKey(sourceId);
                    append["SourceId"] = sourceId;
                }
                return Json(result.Body);
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, SafeRemoteError(ex)));
            }
        }

        [HttpPost]
        public async Task<JsonResult> Disconnect([FromBody] SourceRequest request)
        {
            var tokenResult = await RequireAdministratorAsync().ConfigureAwait(false);
            if (tokenResult.Code != 1) return Json(tokenResult);
            if (!TryNormalizeSourceId(request?.SourceId, out var sourceId, out var error))
                return Json(new DosResult(0, null, error));
            var settings = TenantSystemSettingsSecurity.LoadSnapshot(tokenResult.Data.OsClient);
            if (!settings.TryGetValue(CredentialKey(sourceId), out var item))
                return Json(new DosResult(1, null, "该商城源当前没有保存登录凭据。"));
            var result = await MicroiEngine.FormEngine.DelFormDataAsync(TenantSystemSettingsSecurity.TableName, new
            {
                Id = item.Id,
                OsClient = tokenResult.Data.OsClient
            }).ConfigureAwait(false);
            QueueAudit(tokenResult.Data, "MarketplaceSourceDisconnect", result.Code == 1, sourceId, null, null);
            return Json(result.Code == 1
                ? new DosResult(1, null, "商城源登录凭据已移除。")
                : result);
        }

        private async Task<int> ReadApplicationCountAsync(string apiBase, string osClient, SourceCredential credential)
        {
            var result = await SendJsonAsync(apiBase, "/apiengine/get-microi-store-list", osClient,
                new JObject { ["_PageIndex"] = 1, ["_PageSize"] = 1 }, credential).ConfigureAwait(false);
            return result.Body?["Code"]?.Val<int>() == 1
                ? Math.Max(0, result.Body?["DataCount"]?.Val<int>() ?? 0)
                : 0;
        }

        private async Task<RemoteResult> SendJsonAsync(
            string apiBase,
            string path,
            string osClient,
            JObject payload,
            SourceCredential credential)
        {
            using var request = BuildRequest(HttpMethod.Post, apiBase, path, osClient, credential);
            request.Content = new StringContent((payload ?? new JObject()).ToString(Formatting.None), Encoding.UTF8, "application/json");
            return await SendAsync(request, false).ConfigureAwait(false);
        }

        private async Task<RemoteResult> SendFormAsync(
            string apiBase,
            string path,
            string osClient,
            string did,
            IDictionary<string, string> form)
        {
            using var request = BuildRequest(HttpMethod.Post, apiBase, path, osClient, null);
            request.Headers.TryAddWithoutValidation("did", did);
            request.Content = new FormUrlEncodedContent(form);
            return await SendAsync(request, false).ConfigureAwait(false);
        }

        private async Task<RemoteResult> SendBinaryAsync(string apiBase, string path, string osClient)
        {
            using var request = BuildRequest(HttpMethod.Get, apiBase, path, osClient, null);
            return await SendAsync(request, true).ConfigureAwait(false);
        }

        private HttpRequestMessage BuildRequest(
            HttpMethod method,
            string apiBase,
            string path,
            string osClient,
            SourceCredential credential)
        {
            var baseUri = new Uri(apiBase.TrimEnd('/') + "/", UriKind.Absolute);
            var requestUri = new Uri(baseUri, path.TrimStart('/'));
            var request = new HttpRequestMessage(method, requestUri);
            request.Headers.TryAddWithoutValidation("osclient", osClient);
            request.Headers.TryAddWithoutValidation("Accept", "application/json");
            if (credential != null)
            {
                request.Headers.TryAddWithoutValidation("authorization", NormalizeToken(credential.Token));
                request.Headers.TryAddWithoutValidation("did", credential.Did);
            }
            return request;
        }

        private async Task<RemoteResult> SendAsync(HttpRequestMessage request, bool binary)
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(25);
            using var response = await client.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                HttpContext.RequestAborted).ConfigureAwait(false);
            var contentLength = response.Content.Headers.ContentLength;
            if (contentLength.HasValue && contentLength.Value > MaxRemoteResponseBytes)
                throw new InvalidOperationException("商城源响应超过 12MB 安全上限。");
            var bytes = await response.Content.ReadAsByteArrayAsync(HttpContext.RequestAborted).ConfigureAwait(false);
            if (bytes.Length > MaxRemoteResponseBytes)
                throw new InvalidOperationException("商城源响应超过 12MB 安全上限。");
            var result = new RemoteResult
            {
                StatusCode = response.StatusCode,
                Authorization = NormalizeToken(ReadHeader(response, "authorization") ?? ReadHeader(response, "token")),
                CaptchaId = ReadHeader(response, "captchaid"),
                ContentType = response.Content.Headers.ContentType?.MediaType,
                Bytes = binary ? bytes : null
            };
            if (!binary)
            {
                try { result.Body = JObject.Parse(Encoding.UTF8.GetString(bytes)); }
                catch { result.Body = null; }
            }
            return result;
        }

        private static SourceCredential LoadCredential(
            string tenantOsClient,
            string sourceId,
            string apiBase,
            string remoteOsClient)
        {
            try
            {
                var settings = TenantSystemSettingsSecurity.LoadSnapshot(tenantOsClient);
                var raw = TenantSystemSettingsSecurity.GetText(settings, CredentialKey(sourceId), string.Empty, true);
                if (raw.DosIsNullOrWhiteSpace()) return null;
                var credential = JsonConvert.DeserializeObject<SourceCredential>(raw);
                if (credential == null || credential.Token.DosIsNullOrWhiteSpace()) return null;
                if (credential.ExpiresAtUtc.HasValue && credential.ExpiresAtUtc.Value <= DateTime.UtcNow)
                    return null;
                if (!string.Equals(credential.ApiBase?.TrimEnd('/'), apiBase.TrimEnd('/'), StringComparison.OrdinalIgnoreCase)
                    || !string.Equals(credential.OsClient, remoteOsClient, StringComparison.OrdinalIgnoreCase))
                    return null;
                return credential;
            }
            catch
            {
                return null;
            }
        }

        private static async Task<DosResult> SaveCredentialAsync(
            string tenantOsClient,
            string sourceId,
            SourceCredential credential)
        {
            var key = CredentialKey(sourceId);
            var settings = TenantSystemSettingsSecurity.LoadSnapshot(tenantOsClient);
            settings.TryGetValue(key, out var existing);
            var json = JsonConvert.SerializeObject(credential);
            var form = new JObject
            {
                ["Id"] = existing?.Id ?? Guid.NewGuid().ToString(),
                ["ConfigKey"] = key,
                ["ConfigValue"] = string.Empty,
                ["SecretCipher"] = TenantSystemSettingsSecurity.ProtectSecret(tenantOsClient, key, json),
                ["ValueType"] = "String",
                ["Category"] = "应用商城",
                ["Description"] = "私有商城源长会话凭据；只允许可信后端代理使用。",
                ["IsPublic"] = 0,
                ["IsSecret"] = 1,
                ["IsEnabled"] = 1,
                ["Sort"] = 310,
                ["ValueSource"] = "Tenant",
                ["OsClient"] = tenantOsClient
            };
            return existing == null
                ? await MicroiEngine.FormEngine.AddFormDataAsync(TenantSystemSettingsSecurity.TableName, form).ConfigureAwait(false)
                : await MicroiEngine.FormEngine.UptFormDataAsync(TenantSystemSettingsSecurity.TableName, form).ConfigureAwait(false);
        }

        private static bool TryNormalizeRequest(
            SourceRequest request,
            out string sourceId,
            out string apiBase,
            out string osClient,
            out string error)
        {
            sourceId = apiBase = osClient = string.Empty;
            if (!TryNormalizeSourceId(request?.SourceId, out sourceId, out error)) return false;
            osClient = NormalizeText(request?.OsClient, 80);
            if (osClient.Length == 0)
            {
                error = "OsClient 不能为空。";
                return false;
            }
            if (!Uri.TryCreate((request?.ApiBase ?? string.Empty).Trim(), UriKind.Absolute, out var uri)
                || !(uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
                || !string.IsNullOrEmpty(uri.UserInfo)
                || !string.IsNullOrEmpty(uri.Query)
                || !string.IsNullOrEmpty(uri.Fragment))
            {
                error = "ApiBase 必须是无帐号、无 Query 的 http/https 绝对地址。";
                return false;
            }
            apiBase = uri.GetLeftPart(UriPartial.Path).TrimEnd('/');
            if (apiBase.Length > 2048)
            {
                error = "ApiBase 长度不能超过 2048。";
                return false;
            }
            error = null;
            return true;
        }

        private static bool TryNormalizeSourceId(string value, out string sourceId, out string error)
        {
            sourceId = (value ?? string.Empty).Trim();
            if (!SourceIdRegex.IsMatch(sourceId))
            {
                error = "商城源 Id 只能包含字母、数字、下划线和中划线，长度为1到80。";
                return false;
            }
            error = null;
            return true;
        }

        private static string CredentialKey(string sourceId) => CredentialPrefix + sourceId;

        private static string BuildDid(string tenantOsClient, string sourceId)
        {
            var stable = UserBehaviorAudit.HashIdentifier($"{tenantOsClient}:{sourceId}");
            return "Marketplace:" + (stable?.Length > 32 ? stable.Substring(0, 32) : stable);
        }

        private static DateTime? ReadTokenExpiry(string token)
        {
            try
            {
                var jwt = new JwtSecurityTokenHandler().ReadJwtToken(NormalizeToken(token));
                return jwt.ValidTo == DateTime.MinValue ? null : jwt.ValidTo.ToUniversalTime();
            }
            catch { return null; }
        }

        private static string NormalizeToken(string value) =>
            Regex.Replace((value ?? string.Empty).Trim(), @"^Bearer\s+", string.Empty, RegexOptions.IgnoreCase);

        private static string ReadHeader(HttpResponseMessage response, string name) =>
            response.Headers.TryGetValues(name, out var values) ? values.FirstOrDefault() : null;

        private static string FirstText(JObject source, params string[] names)
        {
            foreach (var name in names)
            {
                var value = source?[name]?.ToString()?.Trim();
                if (!value.DosIsNullOrWhiteSpace()) return value;
            }
            return null;
        }

        private static bool Flag(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null) return false;
            if (value.Type == JTokenType.Boolean) return value.Value<bool>();
            if (value.Type == JTokenType.Integer) return value.Value<long>() != 0;
            return new[] { "1", "true", "yes", "on", "enabled" }.Any(item =>
                string.Equals(item, value.ToString().Trim(), StringComparison.OrdinalIgnoreCase));
        }

        private static string NormalizeText(string value, int maxLength)
        {
            var text = new string((value ?? string.Empty).Where(ch => !char.IsControl(ch)).ToArray()).Trim();
            return text.Length <= maxLength ? text : text.Substring(0, maxLength);
        }

        private static string MaskAccount(string account)
        {
            if (account.DosIsNullOrWhiteSpace()) return string.Empty;
            if (account.Length <= 2) return account.Substring(0, 1) + "*";
            return account.Substring(0, 1) + new string('*', Math.Min(6, account.Length - 2)) + account.Substring(account.Length - 1);
        }

        private static string SafeRemoteError(Exception exception)
        {
            if (exception is TaskCanceledException) return "商城源连接超时，请检查 ApiBase、网络或上游服务状态。";
            if (exception is HttpRequestException) return "商城源连接失败，请检查 ApiBase、证书、网络或上游服务状态。";
            var message = NormalizeText(exception?.Message, 300);
            return message.DosIsNullOrWhiteSpace() ? "商城源请求失败。" : message;
        }

        private static async Task<DosResult<CurrentToken>> RequireAdministratorAsync()
        {
            var token = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            if (token?.CurrentUser == null)
                return new DosResult<CurrentToken>(1001, null, "登录身份已过期。请重新登录。");
            if (UserAccessKeySecurity.IsSession(token.CurrentUser))
                return new DosResult<CurrentToken>(0, null, "访问密钥会话不能管理私有商城源。");
            if ((token.CurrentUser["Level"]?.Val<int>() ?? 0) < 999)
                return new DosResult<CurrentToken>(0, null, "只有超级管理员可以管理商城源。");
            return new DosResult<CurrentToken>(1, token);
        }

        private static void QueueAudit(
            CurrentToken token,
            string action,
            bool success,
            string sourceId,
            string apiBase,
            string remoteOsClient)
        {
            MicroiEngine.QueueSysLog(new SysLogParam
            {
                OsClient = token?.OsClient,
                UserId = token?.CurrentUser?["Id"]?.ToString(),
                UserName = token?.CurrentUser?["Name"]?.ToString(),
                Category = "Security",
                Action = action,
                Source = "MarketplaceSourceGateway",
                TargetType = "MarketplaceSource",
                TargetId = sourceId,
                Success = success,
                OccurredAt = DateTime.Now,
                Type = "安全审计",
                Title = action,
                Content = JsonConvert.SerializeObject(new
                {
                    Success = success,
                    SourceId = sourceId,
                    ApiBase = apiBase,
                    RemoteOsClient = remoteOsClient
                }),
                Level = success ? 1 : 2
            });
        }
    }
}
