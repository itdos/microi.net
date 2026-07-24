using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public class MicroiCaptchaRecognizeParam : BaseParam
    {
        public string Provider { get; set; }
        public string ImageBase64 { get; set; }
        public string ExpressionText { get; set; }
        public string AllowedChars { get; set; }
        public string Endpoint { get; set; }
        public string HeadersJson { get; set; }
        public int? TimeoutSeconds { get; set; }
    }

    public class MicroiCaptchaRecognizeResult
    {
        public string Provider { get; set; }
        public string Text { get; set; }
        public decimal Confidence { get; set; }
        public bool IsResolved { get; set; }
        public bool NeedManual { get; set; }
        public string Msg { get; set; }
        public string Raw { get; set; }
    }

    public interface IMicroiCaptchaRecognizer
    {
        Task<DosResult<MicroiCaptchaRecognizeResult>> RecognizeAsync(MicroiCaptchaRecognizeParam param);
    }

    /// <summary>
    /// 采集 Worker 使用的验证码识别门面。
    /// 重型 OCR 模型建议运行在独立本地服务中，避免拖慢 API 主进程。
    /// </summary>
    public class MicroiCaptchaRecognizer : IMicroiCaptchaRecognizer
    {
        private const int DefaultTimeoutSeconds = 8;
        private const int MaxTimeoutSeconds = 15;
        private const int MaxInputImageBytes = 2 * 1024 * 1024;
        private const int MaxResponseBytes = 256 * 1024;
        private const int MaxProviderLength = 64;
        private const int MaxAllowedCharsLength = 256;
        private const int MaxExpressionTextLength = 512;
        private static readonly HttpClient HttpClient = new HttpClient();
        private readonly IConfiguration _configuration;

        public MicroiCaptchaRecognizer(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<DosResult<MicroiCaptchaRecognizeResult>> RecognizeAsync(MicroiCaptchaRecognizeParam param)
        {
            param = param ?? new MicroiCaptchaRecognizeParam();
            var provider = (param.Provider ?? _configuration?["CaptchaOcr:Provider"] ?? "Auto").DosTrim();
            if (provider.DosIsNullOrWhiteSpace())
            {
                provider = "Auto";
            }

            try
            {
                if (provider.Length > MaxProviderLength)
                {
                    return new DosResult<MicroiCaptchaRecognizeResult>(1, Manual("Invalid", "验证码识别 Provider 长度超出限制。"));
                }
                if ((param.AllowedChars?.Length ?? 0) > MaxAllowedCharsLength
                    || (param.ExpressionText?.Length ?? 0) > MaxExpressionTextLength)
                {
                    return new DosResult<MicroiCaptchaRecognizeResult>(1, Manual(provider, "验证码识别文本参数长度超出限制。"));
                }

                if (IsAutoProvider(provider))
                {
                    var arithmetic = TryRecognizeArithmetic(param.ExpressionText, provider);
                    if (arithmetic.IsResolved)
                    {
                        return new DosResult<MicroiCaptchaRecognizeResult>(1, arithmetic);
                    }

                    var configuredProvider = _configuration?["CaptchaOcr:Provider"];
                    var configuredEndpoint = GetConfiguredEndpoint(configuredProvider);
                    if (!configuredProvider.DosIsNullOrWhiteSpace() && !configuredEndpoint.DosIsNullOrWhiteSpace())
                    {
                        return await RecognizeByHttpAsync(param, configuredProvider);
                    }

                    return new DosResult<MicroiCaptchaRecognizeResult>(1, Manual(provider, "未配置 OCR 服务，已进入人工兜底。"));
                }

                if (IsArithmeticProvider(provider))
                {
                    return new DosResult<MicroiCaptchaRecognizeResult>(1, TryRecognizeArithmetic(param.ExpressionText, provider));
                }

                if (IsHttpProvider(provider))
                {
                    return await RecognizeByHttpAsync(param, provider);
                }

                return new DosResult<MicroiCaptchaRecognizeResult>(1, Manual(provider, "未知验证码识别 Provider，已进入人工兜底。"));
            }
            catch (Exception)
            {
                return new DosResult<MicroiCaptchaRecognizeResult>(1, Manual(provider, "验证码识别异常，已进入人工兜底。"));
            }
        }

        private static bool IsAutoProvider(string provider)
        {
            return provider.Equals("Auto", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsArithmeticProvider(string provider)
        {
            return provider.Equals("Arithmetic", StringComparison.OrdinalIgnoreCase)
                   || provider.Equals("ArithmeticExpression", StringComparison.OrdinalIgnoreCase)
                   || provider.Equals("Math", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsHttpProvider(string provider)
        {
            return provider.Equals("Http", StringComparison.OrdinalIgnoreCase)
                   || provider.EndsWith("Http", StringComparison.OrdinalIgnoreCase)
                   || provider.Equals("DdddOcr", StringComparison.OrdinalIgnoreCase)
                   || provider.Equals("PaddleOcr", StringComparison.OrdinalIgnoreCase)
                   || provider.Equals("Tesseract", StringComparison.OrdinalIgnoreCase);
        }

        private async Task<DosResult<MicroiCaptchaRecognizeResult>> RecognizeByHttpAsync(MicroiCaptchaRecognizeParam param, string provider)
        {
            if (param.ImageBase64.DosIsNullOrWhiteSpace())
            {
                return new DosResult<MicroiCaptchaRecognizeResult>(1, Manual(provider, "未提供验证码图片，已进入人工兜底。"));
            }

            if (!TryNormalizeImageBase64(param.ImageBase64, out var normalizedImage, out var validationMessage))
            {
                return new DosResult<MicroiCaptchaRecognizeResult>(1, Manual(provider, validationMessage));
            }

            var endpoint = GetConfiguredEndpoint(provider);
            if (endpoint.DosIsNullOrWhiteSpace())
            {
                return new DosResult<MicroiCaptchaRecognizeResult>(1, Manual(provider, "未配置 OCR 服务地址，已进入人工兜底。"));
            }
            if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var endpointUri)
                || (endpointUri.Scheme != Uri.UriSchemeHttp && endpointUri.Scheme != Uri.UriSchemeHttps))
            {
                return new DosResult<MicroiCaptchaRecognizeResult>(1, Manual(provider, "OCR 服务地址配置无效，已进入人工兜底。"));
            }

            var timeoutSeconds = Math.Max(1, Math.Min(MaxTimeoutSeconds, ReadInt("CaptchaOcr:TimeoutSeconds", DefaultTimeoutSeconds)));
            var payload = new
            {
                osClient = param.OsClient,
                provider = provider,
                imageBase64 = normalizedImage,
                image = normalizedImage,
                allowedChars = param.AllowedChars,
                expressionText = param.ExpressionText
            };

            using (var request = new HttpRequestMessage(HttpMethod.Post, endpointUri))
            {
                request.Content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
                AddConfiguredHeaders(request, provider);

                using (var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds)))
                {
                    using (var response = await HttpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cts.Token))
                    {
                        var raw = await ReadResponseBodyWithLimitAsync(response, cts.Token);
                        if (!response.IsSuccessStatusCode)
                        {
                            return new DosResult<MicroiCaptchaRecognizeResult>(1, Manual(provider, "OCR 服务返回异常：" + (int)response.StatusCode, raw));
                        }

                        var parsed = ParseOcrResponse(raw, provider, param.AllowedChars);
                        return new DosResult<MicroiCaptchaRecognizeResult>(1, parsed);
                    }
                }
            }
        }

        private int ReadInt(string key, int defaultValue)
        {
            var value = _configuration?[key];
            if (int.TryParse(value, out var result))
            {
                return result;
            }
            return defaultValue;
        }

        private string GetConfiguredEndpoint(string provider)
        {
            if (!provider.DosIsNullOrWhiteSpace())
            {
                var providerEndpoint = _configuration?[$"CaptchaOcr:{provider}:Endpoint"];
                if (!providerEndpoint.DosIsNullOrWhiteSpace())
                {
                    return providerEndpoint;
                }
            }

            return _configuration?["CaptchaOcr:Endpoint"];
        }

        private void AddConfiguredHeaders(HttpRequestMessage request, string provider)
        {
            var headersJson = !provider.DosIsNullOrWhiteSpace()
                ? _configuration?[$"CaptchaOcr:{provider}:HeadersJson"]
                : null;
            if (headersJson.DosIsNullOrWhiteSpace())
            {
                headersJson = _configuration?["CaptchaOcr:HeadersJson"];
            }
            if (headersJson.DosIsNullOrWhiteSpace())
            {
                return;
            }

            try
            {
                var headers = JsonConvert.DeserializeObject<Dictionary<string, string>>(headersJson);
                if (headers == null)
                {
                    return;
                }

                foreach (var item in headers)
                {
                    if (!item.Key.DosIsNullOrWhiteSpace() && item.Value != null)
                    {
                        request.Headers.TryAddWithoutValidation(item.Key, item.Value);
                    }
                }
            }
            catch
            {
                // 可选请求头无效时不影响人工兜底。
            }
        }

        private static bool TryNormalizeImageBase64(string value, out string normalized, out string message)
        {
            normalized = StripBase64Prefix(value)?.Trim();
            message = null;
            if (normalized.DosIsNullOrWhiteSpace())
            {
                message = "未提供验证码图片，已进入人工兜底。";
                return false;
            }

            var maxEncodedChars = ((long)MaxInputImageBytes + 2L) / 3L * 4L;
            if (normalized.Length > maxEncodedChars)
            {
                message = $"验证码图片不能超过 {MaxInputImageBytes / 1024 / 1024} MB。";
                return false;
            }

            try
            {
                var bytes = Convert.FromBase64String(normalized);
                if (bytes.Length == 0 || bytes.Length > MaxInputImageBytes)
                {
                    message = $"验证码图片不能超过 {MaxInputImageBytes / 1024 / 1024} MB。";
                    return false;
                }
            }
            catch (FormatException)
            {
                message = "验证码图片不是有效的 Base64 内容。";
                return false;
            }

            return true;
        }

        private static async Task<string> ReadResponseBodyWithLimitAsync(HttpResponseMessage response, CancellationToken cancellationToken)
        {
            if (response.Content.Headers.ContentLength.HasValue
                && response.Content.Headers.ContentLength.Value > MaxResponseBytes)
            {
                throw new InvalidOperationException($"OCR 服务响应不能超过 {MaxResponseBytes / 1024} KB。");
            }

            using (var stream = await response.Content.ReadAsStreamAsync())
            using (var buffer = new MemoryStream())
            {
                var chunk = new byte[8192];
                while (true)
                {
                    var read = await stream.ReadAsync(chunk, 0, chunk.Length, cancellationToken);
                    if (read <= 0)
                    {
                        break;
                    }
                    if (buffer.Length + read > MaxResponseBytes)
                    {
                        throw new InvalidOperationException($"OCR 服务响应不能超过 {MaxResponseBytes / 1024} KB。");
                    }
                    buffer.Write(chunk, 0, read);
                }
                return Encoding.UTF8.GetString(buffer.ToArray());
            }
        }

        private static MicroiCaptchaRecognizeResult ParseOcrResponse(string raw, string provider, string allowedChars)
        {
            if (raw.DosIsNullOrWhiteSpace())
            {
                return Manual(provider, "OCR 服务返回空内容。", raw);
            }

            var text = raw.DosTrim();
            decimal confidence = 0;

            try
            {
                var token = JToken.Parse(raw);
                text = FindText(token);
                confidence = FindConfidence(token);
            }
            catch
            {
                // 支持 OCR 服务直接返回纯文本。
            }

            text = NormalizeText(text, allowedChars);
            if (text.DosIsNullOrWhiteSpace())
            {
                return Manual(provider, "OCR 未识别出有效内容。", raw);
            }

            return new MicroiCaptchaRecognizeResult
            {
                Provider = provider,
                Text = text,
                Confidence = confidence > 0 ? confidence : 0.6M,
                IsResolved = true,
                NeedManual = false,
                Msg = "识别成功。",
                Raw = raw
            };
        }

        private static string FindText(JToken token)
        {
            if (token == null)
            {
                return null;
            }

            if (token.Type == JTokenType.String)
            {
                return token.Value<string>();
            }

            var keys = new[] { "Text", "text", "Result", "result", "Code", "code", "Captcha", "captcha", "Value", "value" };
            foreach (var key in keys)
            {
                var child = token[key];
                if (child != null)
                {
                    if (child.Type == JTokenType.String || child.Type == JTokenType.Integer || child.Type == JTokenType.Float)
                    {
                        return child.ToString();
                    }

                    var nested = FindText(child);
                    if (!nested.DosIsNullOrWhiteSpace())
                    {
                        return nested;
                    }
                }
            }

            return null;
        }

        private static decimal FindConfidence(JToken token)
        {
            if (token == null)
            {
                return 0;
            }

            var keys = new[] { "Confidence", "confidence", "Score", "score", "Prob", "prob" };
            foreach (var key in keys)
            {
                var child = token[key];
                if (child != null && decimal.TryParse(child.ToString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var value))
                {
                    return value;
                }
            }

            if (token.Type == JTokenType.Object || token.Type == JTokenType.Array)
            {
                foreach (var child in token.Children())
                {
                    var nested = FindConfidence(child);
                    if (nested > 0)
                    {
                        return nested;
                    }
                }
            }

            return 0;
        }

        private static MicroiCaptchaRecognizeResult TryRecognizeArithmetic(string expressionText, string provider)
        {
            if (expressionText.DosIsNullOrWhiteSpace())
            {
                return Manual(provider, "未提供算术表达式，已进入人工兜底。");
            }

            var text = NormalizeArithmeticText(expressionText);
            var match = Regex.Match(text, @"([0-9零〇一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾两]+)\s*([+\-×xX*/÷加减乘除])\s*([0-9零〇一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾两]+)");
            if (!match.Success)
            {
                return Manual(provider, "算术表达式无法解析，已进入人工兜底。");
            }

            if (!TryParseNumber(match.Groups[1].Value, out var left) || !TryParseNumber(match.Groups[3].Value, out var right))
            {
                return Manual(provider, "算术表达式数字无法解析，已进入人工兜底。");
            }

            var op = match.Groups[2].Value;
            decimal value;
            if (op == "+" || op == "加")
            {
                value = left + right;
            }
            else if (op == "-" || op == "减")
            {
                value = left - right;
            }
            else if (op == "×" || op == "x" || op == "X" || op == "*" || op == "乘")
            {
                value = left * right;
            }
            else if (op == "÷" || op == "/" || op == "除")
            {
                if (right == 0)
                {
                    return Manual(provider, "算术表达式除数为 0，已进入人工兜底。");
                }
                value = left / right;
            }
            else
            {
                return Manual(provider, "算术表达式运算符无法解析，已进入人工兜底。");
            }

            var result = value == Math.Truncate(value)
                ? Convert.ToInt64(value).ToString(CultureInfo.InvariantCulture)
                : value.ToString("0.##", CultureInfo.InvariantCulture);

            return new MicroiCaptchaRecognizeResult
            {
                Provider = provider,
                Text = result,
                Confidence = 1,
                IsResolved = true,
                NeedManual = false,
                Msg = "算术验证码解析成功。",
                Raw = expressionText
            };
        }

        private static string NormalizeArithmeticText(string text)
        {
            return text.Replace("＋", "+")
                .Replace("－", "-")
                .Replace("—", "-")
                .Replace("＝", "=")
                .Replace("？", "?")
                .Replace("几", "?")
                .Replace("等于", "=")
                .Replace("等於", "=");
        }

        private static bool TryParseNumber(string text, out decimal value)
        {
            text = text.DosTrim();
            if (decimal.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, out value))
            {
                return true;
            }

            var digits = new Dictionary<char, int>
            {
                { '零', 0 }, { '〇', 0 }, { '一', 1 }, { '二', 2 }, { '两', 2 }, { '三', 3 }, { '四', 4 },
                { '五', 5 }, { '六', 6 }, { '七', 7 }, { '八', 8 }, { '九', 9 },
                { '壹', 1 }, { '贰', 2 }, { '叁', 3 }, { '肆', 4 }, { '伍', 5 }, { '陆', 6 },
                { '柒', 7 }, { '捌', 8 }, { '玖', 9 }
            };

            if (text.Contains("十") || text.Contains("拾"))
            {
                var parts = text.Split(new[] { '十', '拾' }, StringSplitOptions.None);
                var tens = parts[0].DosIsNullOrWhiteSpace() ? 1 : ParseSingleChineseDigit(parts[0], digits);
                var ones = parts.Length > 1 && !parts[1].DosIsNullOrWhiteSpace() ? ParseSingleChineseDigit(parts[1], digits) : 0;
                if (tens >= 0 && ones >= 0)
                {
                    value = tens * 10 + ones;
                    return true;
                }
            }

            if (text.Length == 1 && digits.TryGetValue(text[0], out var digit))
            {
                value = digit;
                return true;
            }

            value = 0;
            return false;
        }

        private static int ParseSingleChineseDigit(string text, Dictionary<char, int> digits)
        {
            text = text.DosTrim();
            if (text.Length == 1 && digits.TryGetValue(text[0], out var value))
            {
                return value;
            }
            return -1;
        }

        private static string NormalizeText(string text, string allowedChars)
        {
            if (text.DosIsNullOrWhiteSpace())
            {
                return null;
            }

            text = Regex.Replace(text, @"\s+", string.Empty).DosTrim();
            if (allowedChars.DosIsNullOrWhiteSpace())
            {
                return text;
            }

            var allowed = new HashSet<char>(allowedChars);
            var builder = new StringBuilder();
            foreach (var item in text)
            {
                if (allowed.Contains(item))
                {
                    builder.Append(item);
                }
            }

            return builder.ToString();
        }

        private static string StripBase64Prefix(string value)
        {
            if (value.DosIsNullOrWhiteSpace())
            {
                return value;
            }

            var index = value.IndexOf("base64,", StringComparison.OrdinalIgnoreCase);
            return index >= 0 ? value.Substring(index + "base64,".Length) : value;
        }

        private static MicroiCaptchaRecognizeResult Manual(string provider, string msg, string raw = null)
        {
            return new MicroiCaptchaRecognizeResult
            {
                Provider = provider,
                Text = string.Empty,
                Confidence = 0,
                IsResolved = false,
                NeedManual = true,
                Msg = msg,
                Raw = raw
            };
        }
    }
}
