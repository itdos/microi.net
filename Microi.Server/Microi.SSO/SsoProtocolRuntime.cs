using System;
using System.Collections.Generic;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
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
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// Microi 双向 SSO 可信协议原子。
    /// 外部 OIDC/CAS 身份只负责认证与主体映射，进入平台时仍签发 DiyToken；
    /// Microi 作为身份提供方时使用独立、短期、可撤销的协议票据，不把 DiyToken
    /// 暴露给第三方系统。
    /// </summary>
    // 此类型不是 MVC Controller；24 个公开地址全部由官方 Managed 接口引擎承接。
    public sealed partial class SsoProtocolRuntime : ISsoProtocolRuntime
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
        private ControllerContext _controllerContext;

        // 可信协议原子只借用 ASP.NET Core 的 IActionResult 执行器来生成规范 HTTP
        // 响应，不继承 ControllerBase，也不参与 MVC Controller 发现或路由注册。
        private HttpContext HttpContext => _controllerContext.HttpContext;
        private HttpRequest Request => HttpContext.Request;
        private HttpResponse Response => HttpContext.Response;

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

        /// <summary>
        /// 按官方接口引擎声明的固定 Operation 执行一个协议原子，并把 MVC 结果捕获为
        /// 通用 HttpResponse 契约。使用隔离 HttpContext，避免可信原子在接口引擎事务
        /// 成功前直接写入真实响应头或 Cookie。
        /// </summary>
        public async Task<JObject> ExecuteAsync(
            string operation,
            JObject parameters,
            HttpContext sourceContext)
        {
            if (sourceContext == null) throw new InvalidOperationException("SSO 协议原子缺少 HTTP 上下文。");
            parameters ??= new JObject();
            var capture = await CreateCaptureContextAsync(sourceContext).ConfigureAwait(false);
            _controllerContext = new ControllerContext { HttpContext = capture };

            IActionResult actionResult;
            switch ((operation ?? string.Empty).Trim())
            {
                case "Begin":
                    actionResult = await Begin(new BeginRequest
                    {
                        OsClient = ParamText(parameters, "OsClient"),
                        ConnectionKey = ParamText(parameters, "ConnectionKey"),
                        ReturnOrigin = ParamText(parameters, "ReturnOrigin")
                    }).ConfigureAwait(false);
                    break;
                case "CompleteAuthorization":
                    actionResult = await CompleteAuthorization(new CompleteAuthorizationRequest
                    {
                        OsClient = ParamText(parameters, "OsClient"),
                        RequestId = ParamText(parameters, "RequestId")
                    }).ConfigureAwait(false);
                    break;
                case "OidcCallback":
                    actionResult = await OidcCallback(
                        ParamText(parameters, "code"), ParamText(parameters, "state"),
                        ParamText(parameters, "error"), ParamText(parameters, "error_description"),
                        ParamText(parameters, "OsClient"), ParamText(parameters, "ConnectionKey"))
                        .ConfigureAwait(false);
                    break;
                case "OidcDiscovery":
                    actionResult = await Discovery(ParamText(parameters, "OsClient")).ConfigureAwait(false);
                    break;
                case "OidcJwks":
                    actionResult = await Jwks(ParamText(parameters, "OsClient")).ConfigureAwait(false);
                    break;
                case "OidcAuthorize":
                    actionResult = await Authorize(
                        ParamText(parameters, "OsClient"), ParamText(parameters, "client_id"),
                        ParamText(parameters, "redirect_uri"), ParamText(parameters, "response_type"),
                        ParamText(parameters, "scope"), ParamText(parameters, "state"),
                        ParamText(parameters, "nonce"), ParamText(parameters, "code_challenge"),
                        ParamText(parameters, "code_challenge_method"), ParamText(parameters, "prompt"))
                        .ConfigureAwait(false);
                    break;
                case "OidcToken":
                    actionResult = await Token(ParamText(parameters, "OsClient")).ConfigureAwait(false);
                    break;
                case "OidcUserInfo":
                    actionResult = await UserInfo(ParamText(parameters, "OsClient")).ConfigureAwait(false);
                    break;
                case "OidcIntrospect":
                    actionResult = await Introspect(ParamText(parameters, "OsClient")).ConfigureAwait(false);
                    break;
                case "OidcRevoke":
                    actionResult = await Revoke(ParamText(parameters, "OsClient")).ConfigureAwait(false);
                    break;
                case "OidcEndSession":
                    actionResult = await EndSession(
                        ParamText(parameters, "OsClient"), ParamText(parameters, "id_token_hint"),
                        ParamText(parameters, "post_logout_redirect_uri"), ParamText(parameters, "state"))
                        .ConfigureAwait(false);
                    break;
                case "CasCallback":
                    actionResult = await CasCallback(
                        ParamText(parameters, "ticket"), ParamText(parameters, "state"),
                        ParamText(parameters, "OsClient"), ParamText(parameters, "ConnectionKey"))
                        .ConfigureAwait(false);
                    break;
                case "CasLogin":
                    actionResult = await CasLogin(
                        ParamText(parameters, "OsClient"), ParamText(parameters, "service"),
                        ParamText(parameters, "renew"), ParamText(parameters, "gateway"))
                        .ConfigureAwait(false);
                    break;
                case "CasServiceValidate":
                    actionResult = await CasServiceValidate(
                        ParamText(parameters, "OsClient"), ParamText(parameters, "service"),
                        ParamText(parameters, "ticket")).ConfigureAwait(false);
                    break;
                case "CasValidate":
                    actionResult = await Cas10Validate(
                        ParamText(parameters, "OsClient"), ParamText(parameters, "service"),
                        ParamText(parameters, "ticket")).ConfigureAwait(false);
                    break;
                case "CasLogout":
                    actionResult = await CasLogout(
                        ParamText(parameters, "OsClient"), ParamText(parameters, "service"))
                        .ConfigureAwait(false);
                    break;
                case "SamlBegin":
                    actionResult = await SamlBegin(
                        ParamText(parameters, "OsClient"), ParamText(parameters, "ConnectionKey"),
                        ParamText(parameters, "state")).ConfigureAwait(false);
                    break;
                case "SamlAcs":
                    actionResult = await SamlAcs(
                        ParamText(parameters, "OsClient"), ParamText(parameters, "ConnectionKey"))
                        .ConfigureAwait(false);
                    break;
                case "SamlLogin":
                    actionResult = await SamlLogin(ParamText(parameters, "OsClient")).ConfigureAwait(false);
                    break;
                case "SamlComplete":
                    actionResult = await SamlComplete(
                        ParamText(parameters, "OsClient"), ParamText(parameters, "handoff"))
                        .ConfigureAwait(false);
                    break;
                case "SamlIdpMetadata":
                    actionResult = await SamlIdpMetadata(ParamText(parameters, "OsClient")).ConfigureAwait(false);
                    break;
                case "SamlSpMetadata":
                    actionResult = await SamlSpMetadata(
                        ParamText(parameters, "OsClient"), ParamText(parameters, "ConnectionKey"))
                        .ConfigureAwait(false);
                    break;
                case "SamlLogout":
                    actionResult = await SamlLogout(ParamText(parameters, "OsClient")).ConfigureAwait(false);
                    break;
                default:
                    throw new InvalidOperationException("不支持的 SSO 协议原子：" + operation);
            }

            await actionResult.ExecuteResultAsync(_controllerContext).ConfigureAwait(false);
            capture.Response.Body.Position = 0;
            string body;
            using (var reader = new StreamReader(
                       capture.Response.Body,
                       Encoding.UTF8,
                       detectEncodingFromByteOrderMarks: true,
                       bufferSize: 1024,
                       leaveOpen: true))
            {
                body = await reader.ReadToEndAsync().ConfigureAwait(false);
            }

            var headers = new JObject();
            foreach (var header in capture.Response.Headers)
            {
                if (string.Equals(header.Key, "Content-Type", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(header.Key, "Content-Length", StringComparison.OrdinalIgnoreCase)) continue;
                headers[header.Key] = header.Value.Count <= 1
                    ? JToken.FromObject(header.Value.ToString())
                    : JArray.FromObject(header.Value.ToArray());
            }
            return new JObject
            {
                ["StatusCode"] = capture.Response.StatusCode,
                ["ContentType"] = capture.Response.ContentType ?? "text/plain; charset=utf-8",
                ["Body"] = body,
                ["Headers"] = headers
            };
        }

        private static async Task<DefaultHttpContext> CreateCaptureContextAsync(HttpContext source)
        {
            var capture = new DefaultHttpContext
            {
                RequestServices = source.RequestServices,
                User = source.User,
                TraceIdentifier = source.TraceIdentifier
            };
            capture.Connection.RemoteIpAddress = source.Connection.RemoteIpAddress;
            capture.Connection.RemotePort = source.Connection.RemotePort;
            capture.Request.Method = source.Request.Method;
            capture.Request.Scheme = source.Request.Scheme;
            capture.Request.Host = source.Request.Host;
            capture.Request.PathBase = source.Request.PathBase;
            capture.Request.Path = source.Request.Path;
            capture.Request.QueryString = source.Request.QueryString;
            capture.Request.Protocol = source.Request.Protocol;
            foreach (var header in source.Request.Headers)
                capture.Request.Headers[header.Key] = header.Value;

            if (source.Request.HasFormContentType)
            {
                var form = await source.Request.ReadFormAsync().ConfigureAwait(false);
                capture.Features.Set<IFormFeature>(new FormFeature(form));
            }
            else
            {
                if (source.Request.Body?.CanSeek == true) source.Request.Body.Position = 0;
                capture.Request.Body = source.Request.Body ?? Stream.Null;
            }
            capture.Response.Body = new MemoryStream();
            return capture;
        }

        private static string ParamText(JObject parameters, string name)
        {
            return parameters?.GetValue(name, StringComparison.OrdinalIgnoreCase)?.ToString() ?? string.Empty;
        }

        // 这些小型结果工厂只负责构造协议响应。公开路由、鉴权策略与业务编排均在
        // Managed 接口引擎中；这里没有 ControllerBase，也没有任何 MVC 路由特性。
        private static JsonResult Json(object value) => new JsonResult(value);
        private static BadRequestResult BadRequest() => new BadRequestResult();
        private static BadRequestObjectResult BadRequest(object value) => new BadRequestObjectResult(value);
        private static NotFoundResult NotFound() => new NotFoundResult();
        private static OkResult Ok() => new OkResult();
        private static ObjectResult StatusCode(int statusCode, object value) =>
            new ObjectResult(value) { StatusCode = statusCode };
        private static RedirectResult Redirect(string url) => new RedirectResult(url);
        private static ContentResult Content(string content, string contentType) =>
            new ContentResult { Content = content, ContentType = contentType, StatusCode = StatusCodes.Status200OK };
        private static ContentResult Content(string content, string contentType, Encoding encoding)
        {
            var resolvedContentType = contentType ?? "text/plain";
            if (encoding != null
                && resolvedContentType.IndexOf("charset=", StringComparison.OrdinalIgnoreCase) < 0)
                resolvedContentType += "; charset=" + encoding.WebName;
            return Content(content, resolvedContentType);
        }

        public async Task<JsonResult> Begin(BeginRequest request)
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

        public async Task<JsonResult> CompleteAuthorization(CompleteAuthorizationRequest request)
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
