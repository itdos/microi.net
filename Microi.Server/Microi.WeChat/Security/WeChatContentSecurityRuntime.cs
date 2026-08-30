using System;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 微信内容安全接口引擎可信原子。状态查询与回调业务由官方接口引擎分派；
    /// 插件只负责当前登录态校验、微信签名/AES 和受签名 HTTP 响应。
    /// </summary>
    public sealed class WeChatContentSecurityRuntime : IPlatformApiRuntime
    {
        private const int MaxCallbackCharacters = 256 * 1024;
        private readonly WeChatContentSecurityService _service;

        public WeChatContentSecurityRuntime(WeChatContentSecurityService service)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
        }

        public async Task<object> ExecuteAsync(string action, JObject parameters)
        {
            parameters ??= new JObject();
            switch ((action ?? string.Empty).Trim())
            {
                case "Status":
                    return await GetStatusAsync(parameters).ConfigureAwait(false);
                case "Callback":
                    return await ProcessCallbackAsync(parameters).ConfigureAwait(false);
                default:
                    return new DosResult(0, null, "不支持的微信内容安全动作。");
            }
        }

        private async Task<object> GetStatusAsync(JObject parameters)
        {
            string osClient;
            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(
                    parameters["OsClient"]?.ToString());
            }
            catch
            {
                return new DosResult(0, null, WeChatContentSecurityService.UnavailableContentMessage);
            }
            var current = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            var userId = current?.CurrentUser?["Id"]?.ToString();
            if (userId.DosIsNullOrWhiteSpace()
                || !string.Equals(current?.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
                return new DosResult(1001, null, "登录身份已过期，请重新登录。");
            return await _service.GetStatusAsync(
                osClient,
                parameters["ReviewId"]?.ToString(),
                userId).ConfigureAwait(false);
        }

        private async Task<object> ProcessCallbackAsync(JObject parameters)
        {
            if (!WeChatContentSecurityService.TryResolveCallbackTenant(
                    parameters["routeOsClient"]?.ToString(),
                    parameters["OsClient"]?.ToString(),
                    out var osClient))
                return SignedResponse(400, string.Empty);

            var method = parameters["_HttpMethod"]?.ToString();
            if (string.Equals(method, "GET", StringComparison.OrdinalIgnoreCase))
            {
                var challenge = _service.ResolveCallbackChallenge(
                    osClient,
                    parameters["signature"]?.ToString(),
                    parameters["msg_signature"]?.ToString(),
                    parameters["timestamp"]?.ToString(),
                    parameters["nonce"]?.ToString(),
                    parameters["echostr"]?.ToString());
                return challenge == null
                    ? SignedResponse(401, string.Empty)
                    : SignedResponse(200, challenge);
            }

            var body = parameters["_RawBody"]?.ToString() ?? string.Empty;
            if (body.Length == 0 || body.Length > MaxCallbackCharacters)
                return SignedResponse(400, string.Empty);
            var accepted = await _service.ProcessCallbackAsync(
                    osClient,
                    body,
                    parameters["signature"]?.ToString(),
                    parameters["msg_signature"]?.ToString(),
                    parameters["timestamp"]?.ToString(),
                    parameters["nonce"]?.ToString())
                .ConfigureAwait(false);
            return accepted ? SignedResponse(200, "success") : SignedResponse(401, string.Empty);
        }

        private static DosResult SignedResponse(int statusCode, string body)
        {
            var response = new JObject
            {
                ["StatusCode"] = statusCode,
                ["ContentType"] = "text/plain; charset=utf-8",
                ["Body"] = body ?? string.Empty,
                ["Headers"] = new JObject { ["Cache-Control"] = "no-store" }
            };
            var context = V8TenantContext.Current;
            return new DosResult(1, null)
            {
                DataAppend = new JObject
                {
                    ["HttpResponse"] = response,
                    ["HttpResponseSignature"] = ApiEngineHttpResponseSecurity.Sign(
                        response,
                        context?.OsClient,
                        context?.ApiEngineKey)
                }
            };
        }
    }
}
