using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 接口引擎受控 HTTP 响应契约。普通接口引擎可以返回状态码、正文、Content-Type
    /// 与安全响应头；Set-Cookie 等会改变浏览器安全状态的响应头只接受平台可信原子签名。
    /// </summary>
    public sealed class ApiEngineHttpResponse
    {
        public int StatusCode { get; set; } = 200;
        public string ContentType { get; set; } = "text/plain; charset=utf-8";
        public string Body { get; set; } = string.Empty;
        /// <summary>
        /// 可选二进制正文。接口引擎通过 BodyBase64 传输，宿主严格解码并限制为 8MB；
        /// 与文本 Body 互斥，避免把二进制误按 UTF-8 二次编码。
        /// </summary>
        public byte[] BodyBytes { get; set; }
        public IReadOnlyDictionary<string, IReadOnlyList<string>> Headers { get; set; } =
            new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase);
        public bool Trusted { get; set; }
    }

    /// <summary>
    /// 平台可信原子对精确响应内容签名，防止租户脚本篡改协议原子返回的 Cookie、
    /// 重定向或安全响应头。密钥只存在于当前进程内存，不进入配置、日志和 V8 上下文。
    /// </summary>
    public static class ApiEngineHttpResponseSecurity
    {
        private static readonly byte[] ProcessKey = CreateProcessKey();

        public static string Sign(JObject response, string osClient, string apiEngineKey)
        {
            var payload = BuildSignaturePayload(response, osClient, apiEngineKey);
            using var hmac = new HMACSHA256(ProcessKey);
            return Base64Url(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
        }

        public static bool Verify(JObject response, string signature, string osClient, string apiEngineKey)
        {
            if (response == null || string.IsNullOrWhiteSpace(signature)) return false;
            byte[] supplied;
            byte[] expected;
            try
            {
                supplied = Base64UrlDecode(signature);
                expected = Base64UrlDecode(Sign(response, osClient, apiEngineKey));
            }
            catch
            {
                return false;
            }
            return supplied.Length == expected.Length
                   && CryptographicOperations.FixedTimeEquals(supplied, expected);
        }

        private static string BuildSignaturePayload(JObject response, string osClient, string apiEngineKey)
        {
            return (osClient ?? string.Empty).Trim().ToLowerInvariant() + "\n"
                   + (apiEngineKey ?? string.Empty).Trim().ToLowerInvariant() + "\n"
                   + Canonicalize(response);
        }

        private static string Canonicalize(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null) return "null";
            if (token is JObject obj)
            {
                return "{" + string.Join(",", obj.Properties()
                    .OrderBy(property => property.Name, StringComparer.Ordinal)
                    .Select(property => JsonConvert.SerializeObject(property.Name) + ":" + Canonicalize(property.Value))) + "}";
            }
            if (token is JArray array)
                return "[" + string.Join(",", array.Select(Canonicalize)) + "]";
            return token.ToString(Formatting.None);
        }

        private static byte[] CreateProcessKey()
        {
            var key = new byte[32];
            using var random = RandomNumberGenerator.Create();
            random.GetBytes(key);
            return key;
        }

        private static string Base64Url(byte[] value) =>
            Convert.ToBase64String(value ?? Array.Empty<byte>()).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        private static byte[] Base64UrlDecode(string value)
        {
            var normalized = (value ?? string.Empty).Replace('-', '+').Replace('_', '/');
            normalized += new string('=', (4 - normalized.Length % 4) % 4);
            return Convert.FromBase64String(normalized);
        }
    }

    /// <summary>
    /// 将 V8 返回的 DataAppend.HttpResponse 解析为宿主可执行响应，并统一执行头部、
    /// 大小、跳转地址和可信签名校验。解析失败时宿主必须返回结构化错误而不能半写响应。
    /// </summary>
    public static class ApiEngineHttpResponseContract
    {
        private const int MaxBodyChars = 8 * 1024 * 1024;
        private const int MaxBodyBytes = 8 * 1024 * 1024;
        private const int MaxHeaderCount = 64;
        private const int MaxHeaderValueChars = 16 * 1024;

        private static readonly HashSet<string> ForbiddenHeaders = new HashSet<string>(
            new[] { "Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization", "TE", "Trailer", "Transfer-Encoding", "Upgrade", "Content-Length", "Host" },
            StringComparer.OrdinalIgnoreCase);

        private static readonly HashSet<string> UnsignedAllowedHeaders = new HashSet<string>(
            new[]
            {
                "Cache-Control", "Pragma", "Location", "WWW-Authenticate", "Content-Disposition",
                "Content-Language", "Content-Security-Policy", "X-Content-Type-Options",
                "Referrer-Policy", "X-Frame-Options", "Retry-After"
            },
            StringComparer.OrdinalIgnoreCase);

        public static bool TryRead(
            object result,
            string osClient,
            string apiEngineKey,
            out ApiEngineHttpResponse response,
            out string error)
        {
            response = null;
            error = string.Empty;
            JObject resultObject;
            try
            {
                resultObject = result as JObject ?? JObject.FromObject(result);
            }
            catch
            {
                error = "HTTP 响应接口引擎必须返回对象。";
                return false;
            }

            var append = resultObject["DataAppend"] as JObject;
            var raw = append?["HttpResponse"] as JObject;
            if (raw == null)
            {
                error = "HTTP 响应接口引擎必须返回 DataAppend.HttpResponse。";
                return false;
            }

            var trusted = ApiEngineHttpResponseSecurity.Verify(
                raw,
                append?["HttpResponseSignature"]?.ToString(),
                osClient,
                apiEngineKey);
            var statusCode = raw.Value<int?>("StatusCode") ?? 200;
            if (statusCode < 100 || statusCode > 599)
            {
                error = "HTTP StatusCode 必须在 100 到 599 之间。";
                return false;
            }

            var contentType = (raw["ContentType"]?.ToString() ?? "text/plain; charset=utf-8").Trim();
            if (!IsSingleLine(contentType) || contentType.Length > 200)
            {
                error = "HTTP ContentType 格式无效。";
                return false;
            }
            var body = raw["Body"]?.Type == JTokenType.Null ? string.Empty : raw["Body"]?.ToString() ?? string.Empty;
            if (body.Length > MaxBodyChars)
            {
                error = "HTTP 响应正文超过 8MB 限制。";
                return false;
            }
            byte[] bodyBytes = null;
            var bodyBase64 = raw["BodyBase64"]?.Type == JTokenType.Null
                ? string.Empty
                : raw["BodyBase64"]?.ToString() ?? string.Empty;
            if (body.Length > 0 && bodyBase64.Length > 0)
            {
                error = "HTTP 响应 Body 与 BodyBase64 不能同时设置。";
                return false;
            }
            if (bodyBase64.Length > 0)
            {
                // Base64 文本上限先行拦截，避免在解码前分配超大缓冲区。
                if (bodyBase64.Length > ((MaxBodyBytes + 2) / 3) * 4 + 8)
                {
                    error = "HTTP 二进制响应正文超过 8MB 限制。";
                    return false;
                }
                try
                {
                    bodyBytes = Convert.FromBase64String(bodyBase64);
                }
                catch (FormatException)
                {
                    error = "HTTP BodyBase64 不是有效的 Base64。";
                    return false;
                }
                if (bodyBytes.Length > MaxBodyBytes)
                {
                    error = "HTTP 二进制响应正文超过 8MB 限制。";
                    return false;
                }
            }

            var headers = new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase);
            if (raw["Headers"] is JObject headerObject)
            {
                if (headerObject.Properties().Count() > MaxHeaderCount)
                {
                    error = "HTTP 响应头数量超过限制。";
                    return false;
                }
                foreach (var property in headerObject.Properties())
                {
                    var name = property.Name?.Trim() ?? string.Empty;
                    if (!IsHeaderName(name) || ForbiddenHeaders.Contains(name))
                    {
                        error = $"HTTP 响应头不允许设置：{name}";
                        return false;
                    }
                    if (!trusted && !UnsignedAllowedHeaders.Contains(name))
                    {
                        error = $"普通接口引擎不允许设置响应头：{name}";
                        return false;
                    }
                    var values = property.Value is JArray array
                        ? array.Select(item => item?.ToString() ?? string.Empty).ToArray()
                        : new[] { property.Value?.ToString() ?? string.Empty };
                    if (values.Length == 0 || values.Any(value => !IsSingleLine(value) || value.Length > MaxHeaderValueChars))
                    {
                        error = $"HTTP 响应头值格式无效：{name}";
                        return false;
                    }
                    if (string.Equals(name, "Location", StringComparison.OrdinalIgnoreCase)
                        && values.Any(value => !IsSafeRedirect(value)))
                    {
                        error = "HTTP Location 只允许站内地址、HTTPS 地址或本机开发地址。";
                        return false;
                    }
                    headers[name] = values;
                }
            }

            if ((statusCode == 204 || statusCode == 304)
                && (body.Length > 0 || (bodyBytes?.Length ?? 0) > 0))
            {
                error = $"HTTP {statusCode.ToString(CultureInfo.InvariantCulture)} 响应不能包含正文。";
                return false;
            }
            response = new ApiEngineHttpResponse
            {
                StatusCode = statusCode,
                ContentType = contentType,
                Body = body,
                BodyBytes = bodyBytes,
                Headers = headers,
                Trusted = trusted
            };
            return true;
        }

        private static bool IsSingleLine(string value) =>
            value != null && value.IndexOf('\r') < 0 && value.IndexOf('\n') < 0;

        private static bool IsHeaderName(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length > 100) return false;
            return value.All(ch => char.IsLetterOrDigit(ch) || ch == '-');
        }

        private static bool IsSafeRedirect(string value)
        {
            if (!IsSingleLine(value) || string.IsNullOrWhiteSpace(value)) return false;
            if (value.StartsWith("/", StringComparison.Ordinal) && !value.StartsWith("//", StringComparison.Ordinal)) return true;
            if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || !string.IsNullOrEmpty(uri.UserInfo)) return false;
            if (uri.Scheme == Uri.UriSchemeHttps) return true;
            return uri.Scheme == Uri.UriSchemeHttp
                   && (string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase)
                       || uri.Host == "127.0.0.1" || uri.Host == "::1");
        }
    }
}
