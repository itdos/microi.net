using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 通用 OCR 网关。当前内置 PaddleX/PaddleOCR 3.x 基础服务与高稳定性 KServe
    /// 协议适配；模型运行在独立服务中，API 节点只负责租户隔离、安全校验和结果归一化。
    /// </summary>
    public sealed class MicroiOcr : IMicroiOcr
    {
        public const string HttpClientName = "Microi.OCR";
        public const int DefaultTimeoutSeconds = 60;
        public const int MaximumTimeoutSeconds = 300;
        public const int DefaultMaximumFileMegabytes = 20;
        public const int AbsoluteMaximumFileMegabytes = 100;
        public const int DefaultMaximumPages = 10;
        public const int AbsoluteMaximumPages = 100;
        public const int MaximumResponseBytes = 16 * 1024 * 1024;

        private const int MaximumHeadersJsonCharacters = 16 * 1024;
        private const int MaximumHeaderCount = 20;
        private const int MaximumHeaderNameCharacters = 128;
        private const int MaximumHeaderValueCharacters = 4096;
        private const int MaximumEndpointCharacters = 2048;

        private static readonly HashSet<string> BlockedHeaders = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Host", "Content-Length", "Content-Type", "Connection", "Transfer-Encoding",
            "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization", "TE", "Trailer", "Upgrade"
        };

        private readonly IHttpClientFactory _httpClientFactory;

        public MicroiOcr(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
        }

        public async Task<DosResult<MicroiOcrRecognizeResult>> RecognizeAsync(
            MicroiOcrRecognizeParam param,
            CancellationToken cancellationToken = default(CancellationToken))
        {
            param = param ?? new MicroiOcrRecognizeParam();
            var stopwatch = Stopwatch.StartNew();
            var traceId = Guid.NewGuid().ToString("N");
            OcrTenantSettings settings = null;
            try
            {
                if (string.IsNullOrWhiteSpace(param.OsClient))
                {
                    return Failure("OsClient 不能为空。");
                }

                var osClient = TenantConfigurationSecurity.NormalizeTenantId(param.OsClient);
                settings = OcrTenantSettings.Resolve(osClient);
                if (!settings.Enabled)
                {
                    return Failure("当前租户未启用 OCR 识别。");
                }
                if (!settings.TryGetProtocol(out var protocol))
                {
                    return Failure("OCR Provider 配置无效，仅支持 PaddleX/PaddleOCR 或 PaddleXHighStability。");
                }
                if (!TryValidateEndpoint(settings.Endpoint, out var endpoint, out var endpointError))
                {
                    return Failure(endpointError);
                }
                if (!TryNormalizeFile(param.FileByteBase64, param.FileName, settings.MaximumFileBytes,
                        out var normalizedBase64, out var fileType, out var detectedFormat, out var fileError))
                {
                    return Failure(fileError);
                }
                var optionError = ValidateOptions(param);
                if (!string.IsNullOrWhiteSpace(optionError))
                {
                    return Failure(optionError);
                }

                var providerPayload = BuildPaddlePayload(param, normalizedBase64, fileType, settings.MinimumConfidence);
                var requestPayload = protocol == OcrProviderProtocol.PaddleXHighStability
                    ? BuildHighStabilityPayload(providerPayload)
                    : providerPayload;

                using (var request = new HttpRequestMessage(HttpMethod.Post, endpoint))
                {
                    request.Content = new StringContent(
                        requestPayload.ToString(Formatting.None),
                        Encoding.UTF8,
                        "application/json");
                    var headerError = AddConfiguredHeaders(request, settings);
                    if (!string.IsNullOrWhiteSpace(headerError))
                    {
                        return Failure(headerError);
                    }

                    using (var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken))
                    {
                        linkedCts.CancelAfter(TimeSpan.FromSeconds(settings.TimeoutSeconds));
                        var client = _httpClientFactory.CreateClient(HttpClientName);
                        using (var response = await client.SendAsync(
                                   request,
                                   HttpCompletionOption.ResponseHeadersRead,
                                   linkedCts.Token).ConfigureAwait(false))
                        {
                            var raw = await ReadResponseBodyWithLimitAsync(response, linkedCts.Token)
                                .ConfigureAwait(false);
                            if (!response.IsSuccessStatusCode)
                            {
                                LogFailure(osClient, settings, traceId,
                                    "ProviderHttpError", $"Status={(int)response.StatusCode}");
                                return Failure($"OCR 服务返回 HTTP {(int)response.StatusCode}。", traceId);
                            }

                            var effectiveThreshold = Math.Max(
                                settings.MinimumConfidence,
                                param.TextRecScoreThresh ?? 0);
                            var parsed = ParseProviderResponse(
                                raw,
                                settings.Provider,
                                settings.MaximumPages,
                                traceId,
                                effectiveThreshold);
                            if (parsed.Code != 1)
                            {
                                LogFailure(osClient, settings, traceId, "ProviderResponseInvalid", parsed.Msg);
                                return parsed;
                            }
                            parsed.Data.FileName = NormalizeFileName(param.FileName);
                            parsed.Data.FileType = detectedFormat;
                            parsed.Data.ElapsedMilliseconds = stopwatch.ElapsedMilliseconds;
                            return parsed;
                        }
                    }
                }
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                LogFailure(param.OsClient, settings, traceId, "ProviderTimeout", "OCR provider request timed out.");
                return Failure("OCR 服务调用超时。");
            }
            catch (OperationCanceledException)
            {
                return Failure("OCR 请求已取消。");
            }
            catch (Exception ex)
            {
                LogFailure(param.OsClient, settings, traceId, "RecognizeFailed", ex.GetType().Name);
                return Failure("OCR 识别失败，请检查租户配置和 OCR 服务状态。", traceId);
            }
        }

        /// <summary>
        /// 解析 PaddleX 基础服务或高稳定性 KServe 外层协议，供协议回归测试复用。
        /// 不返回原始响应，避免图像 Base64 和上游内部信息泄漏到业务接口。
        /// </summary>
        public static DosResult<MicroiOcrRecognizeResult> ParseProviderResponse(
            string raw,
            string provider,
            int maximumPages,
            string fallbackTraceId = null,
            decimal minimumConfidence = 0)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                return Failure("OCR 服务返回空响应。", fallbackTraceId);
            }

            try
            {
                var root = JToken.Parse(raw);
                root = UnwrapHighStabilityResponse(root);
                var traceId = ReadScalar(root, "logId", "LogId", "traceId", "TraceId");
                if (string.IsNullOrWhiteSpace(traceId)) traceId = fallbackTraceId;

                var errorCode = ReadInteger(root, "errorCode", "ErrorCode");
                if (errorCode.HasValue && errorCode.Value != 0)
                {
                    var errorMessage = ReadScalar(root, "errorMsg", "ErrorMsg", "message", "Message");
                    return Failure("OCR 服务处理失败：" + SafeProviderMessage(errorMessage), traceId);
                }

                var ocrResults = root.SelectToken("result.ocrResults") as JArray
                                 ?? root.SelectToken("Result.OcrResults") as JArray
                                 ?? root["ocrResults"] as JArray;
                if (ocrResults == null)
                {
                    var directText = ReadScalar(root, "text", "Text");
                    if (string.IsNullOrWhiteSpace(directText))
                    {
                        return Failure("OCR 服务响应结构不受支持。", traceId);
                    }
                    var directPage = new MicroiOcrPage { PageIndex = 0, Text = directText.Trim() };
                    var directResult = new DosResult<MicroiOcrRecognizeResult>(1, new MicroiOcrRecognizeResult
                    {
                        Provider = provider,
                        TraceId = traceId,
                        Text = directPage.Text,
                        PageCount = 1,
                        Pages = new List<MicroiOcrPage> { directPage }
                    }, "识别成功。");
                    ApplyMinimumConfidence(directResult.Data, Math.Max(0, Math.Min(1, minimumConfidence)));
                    return directResult;
                }

                var boundedMaximumPages = Math.Max(1, Math.Min(AbsoluteMaximumPages, maximumPages));
                if (ocrResults.Count > boundedMaximumPages)
                {
                    return Failure($"OCR 服务返回 {ocrResults.Count} 页，超过租户上限 {boundedMaximumPages} 页。", traceId);
                }

                var pages = new List<MicroiOcrPage>();
                for (var pageIndex = 0; pageIndex < ocrResults.Count; pageIndex++)
                {
                    var item = ocrResults[pageIndex];
                    var pruned = item?["prunedResult"] ?? item?["res"] ?? item;
                    pages.Add(ParsePage(pruned, pageIndex));
                }

                var allRegions = pages.SelectMany(item => item.Regions).ToList();
                var scoredRegions = allRegions.Where(item => item.Confidence > 0).ToList();
                var text = string.Join("\n", pages
                    .Select(item => item.Text)
                    .Where(item => !string.IsNullOrWhiteSpace(item)));
                var result = new DosResult<MicroiOcrRecognizeResult>(1, new MicroiOcrRecognizeResult
                {
                    Provider = provider,
                    TraceId = traceId,
                    Text = text,
                    AverageConfidence = scoredRegions.Count == 0
                        ? 0
                        : decimal.Round(scoredRegions.Average(item => item.Confidence), 6),
                    PageCount = pages.Count,
                    Pages = pages
                }, "识别成功。");
                ApplyMinimumConfidence(result.Data, Math.Max(0, Math.Min(1, minimumConfidence)));
                return result;
            }
            catch (JsonException)
            {
                return Failure("OCR 服务返回的不是有效 JSON。", fallbackTraceId);
            }
            catch (Exception)
            {
                return Failure("OCR 服务响应解析失败。", fallbackTraceId);
            }
        }

        private static JObject BuildPaddlePayload(
            MicroiOcrRecognizeParam param,
            string fileBase64,
            int fileType,
            decimal minimumConfidence)
        {
            var payload = new JObject
            {
                ["file"] = fileBase64,
                ["fileType"] = fileType,
                // 平台只返回结构化文本，禁止上游回传可视化图片导致响应被 Base64 放大。
                ["visualize"] = false
            };
            AddOptional(payload, "useDocOrientationClassify", param.UseDocOrientationClassify);
            AddOptional(payload, "useDocUnwarping", param.UseDocUnwarping);
            AddOptional(payload, "useTextlineOrientation", param.UseTextlineOrientation);
            AddOptional(payload, "returnWordBox", param.ReturnWordBox);
            // 租户设置是服务端下限，调用方只能进一步提高，不能绕过。
            var threshold = Math.Max(param.TextRecScoreThresh ?? 0, minimumConfidence);
            if (threshold > 0) payload["textRecScoreThresh"] = threshold;
            return payload;
        }

        private static void ApplyMinimumConfidence(MicroiOcrRecognizeResult result, decimal threshold)
        {
            if (result == null || threshold <= 0) return;
            foreach (var page in result.Pages)
            {
                page.Regions = page.Regions
                    .Where(region => region.Confidence >= threshold)
                    .ToList();
                page.Text = string.Join("\n", page.Regions.Select(region => region.Text));
                page.AverageConfidence = page.Regions.Count == 0
                    ? 0
                    : decimal.Round(page.Regions.Average(region => region.Confidence), 6);
            }
            result.Text = string.Join("\n", result.Pages
                .Select(page => page.Text)
                .Where(text => !string.IsNullOrWhiteSpace(text)));
            var regions = result.Pages.SelectMany(page => page.Regions).ToList();
            result.AverageConfidence = regions.Count == 0
                ? 0
                : decimal.Round(regions.Average(region => region.Confidence), 6);
        }

        private static JObject BuildHighStabilityPayload(JObject providerPayload)
        {
            return new JObject
            {
                ["inputs"] = new JArray
                {
                    new JObject
                    {
                        ["name"] = "input",
                        ["shape"] = new JArray(1, 1),
                        ["datatype"] = "BYTES",
                        ["data"] = new JArray(providerPayload.ToString(Formatting.None))
                    }
                },
                ["outputs"] = new JArray { new JObject { ["name"] = "output" } }
            };
        }

        private static JToken UnwrapHighStabilityResponse(JToken root)
        {
            var output = root?.SelectToken("outputs[0].data[0]");
            if (output == null) return root;
            if (output.Type == JTokenType.String)
            {
                var value = output.Value<string>();
                if (!string.IsNullOrWhiteSpace(value)) return JToken.Parse(value);
            }
            return output.Type == JTokenType.Object ? output : root;
        }

        private static MicroiOcrPage ParsePage(JToken pruned, int pageIndex)
        {
            var texts = ReadArray(pruned, "rec_texts", "recTexts", "texts", "Texts")
                .Select(item => item?.ToString() ?? string.Empty)
                .ToList();
            var scores = ReadArray(pruned, "rec_scores", "recScores", "scores", "Scores")
                .Select(ToDecimal)
                .ToList();
            var boxes = ReadArray(pruned, "rec_polys", "recPolys", "rec_boxes", "recBoxes", "dt_polys");
            var regions = new List<MicroiOcrRegion>();
            for (var i = 0; i < texts.Count; i++)
            {
                var text = texts[i]?.Trim();
                if (string.IsNullOrWhiteSpace(text)) continue;
                regions.Add(new MicroiOcrRegion
                {
                    Text = text,
                    Confidence = i < scores.Count ? scores[i] : 0,
                    Polygon = i < boxes.Count ? NormalizePolygon(boxes[i]) : new List<List<decimal>>()
                });
            }

            // 某些兼容服务只返回一段文本，没有 rec_texts 数组。
            if (regions.Count == 0)
            {
                var directText = ReadScalar(pruned, "text", "Text");
                if (!string.IsNullOrWhiteSpace(directText))
                {
                    regions.Add(new MicroiOcrRegion { Text = directText.Trim() });
                }
            }

            var scored = regions.Where(item => item.Confidence > 0).ToList();
            return new MicroiOcrPage
            {
                PageIndex = pageIndex,
                Text = string.Join("\n", regions.Select(item => item.Text)),
                AverageConfidence = scored.Count == 0
                    ? 0
                    : decimal.Round(scored.Average(item => item.Confidence), 6),
                Regions = regions
            };
        }

        private static List<List<decimal>> NormalizePolygon(JToken token)
        {
            var result = new List<List<decimal>>();
            if (!(token is JArray array)) return result;
            if (array.Count >= 4 && array.All(item => item.Type != JTokenType.Array))
            {
                // rec_boxes: [x1, y1, x2, y2]
                var x1 = ToDecimal(array[0]);
                var y1 = ToDecimal(array[1]);
                var x2 = ToDecimal(array[2]);
                var y2 = ToDecimal(array[3]);
                result.Add(new List<decimal> { x1, y1 });
                result.Add(new List<decimal> { x2, y1 });
                result.Add(new List<decimal> { x2, y2 });
                result.Add(new List<decimal> { x1, y2 });
                return result;
            }
            foreach (var point in array.OfType<JArray>())
            {
                if (point.Count >= 2)
                    result.Add(new List<decimal> { ToDecimal(point[0]), ToDecimal(point[1]) });
            }
            return result;
        }

        private static JArray ReadArray(JToken token, params string[] names)
        {
            if (token == null) return new JArray();
            foreach (var name in names)
            {
                if (token[name] is JArray array) return array;
            }
            return new JArray();
        }

        private static decimal ToDecimal(JToken value)
        {
            if (value == null) return 0;
            return decimal.TryParse(value.ToString(), System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var result)
                ? result
                : 0;
        }

        private static string AddConfiguredHeaders(HttpRequestMessage request, OcrTenantSettings settings)
        {
            Dictionary<string, string> headers = null;
            if (!string.IsNullOrWhiteSpace(settings.HeadersJson))
            {
                if (settings.HeadersJson.Length > MaximumHeadersJsonCharacters)
                    return "OCR 请求头配置长度超出限制。";
                try
                {
                    headers = JsonConvert.DeserializeObject<Dictionary<string, string>>(settings.HeadersJson);
                }
                catch (JsonException)
                {
                    return "OCR 请求头配置不是有效 JSON 对象。";
                }
            }
            headers = headers ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (headers.Count > MaximumHeaderCount) return $"OCR 请求头不能超过 {MaximumHeaderCount} 个。";

            if (!string.IsNullOrWhiteSpace(settings.ApiKey)
                && !headers.Keys.Any(key => key.Equals("Authorization", StringComparison.OrdinalIgnoreCase)))
            {
                headers["Authorization"] = "Bearer " + settings.ApiKey.Trim();
            }
            foreach (var item in headers)
            {
                var name = item.Key?.Trim();
                var value = item.Value;
                if (string.IsNullOrWhiteSpace(name)
                    || name.Length > MaximumHeaderNameCharacters
                    || value == null
                    || value.Length > MaximumHeaderValueCharacters
                    || BlockedHeaders.Contains(name)
                    || name.Any(character => character <= 31 || character >= 127)
                    || value.Any(character => character == '\r' || character == '\n'))
                {
                    return "OCR 请求头配置包含不安全或超长字段。";
                }
                if (!request.Headers.TryAddWithoutValidation(name, value))
                    return "OCR 请求头配置无法应用。";
            }
            return null;
        }

        private static bool TryNormalizeFile(
            string value,
            string fileName,
            int maximumBytes,
            out string normalized,
            out int fileType,
            out string detectedFormat,
            out string message)
        {
            normalized = StripBase64Prefix(value)?.Trim();
            fileType = -1;
            detectedFormat = null;
            message = null;
            if (string.IsNullOrWhiteSpace(normalized))
            {
                message = "FileByteBase64 不能为空。";
                return false;
            }
            var maximumEncodedCharacters = ((long)maximumBytes + 2L) / 3L * 4L;
            if (normalized.Length > maximumEncodedCharacters)
            {
                message = $"OCR 文件不能超过 {maximumBytes / 1024 / 1024} MB。";
                return false;
            }
            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(normalized);
            }
            catch (FormatException)
            {
                message = "FileByteBase64 不是有效的 Base64 内容。";
                return false;
            }
            if (bytes.Length == 0 || bytes.Length > maximumBytes)
            {
                message = $"OCR 文件不能超过 {maximumBytes / 1024 / 1024} MB。";
                return false;
            }
            detectedFormat = DetectFileFormat(bytes);
            if (detectedFormat == null)
            {
                message = "OCR 仅支持 PDF、PNG、JPEG、GIF、BMP、TIFF 或 WebP 文件。";
                return false;
            }
            fileType = detectedFormat == "PDF" ? 0 : 1;
            if (!FileNameMatchesDetectedFormat(fileName, detectedFormat, out message)) return false;
            return true;
        }

        private static string StripBase64Prefix(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return value;
            var commaIndex = value.IndexOf(',');
            return value.StartsWith("data:", StringComparison.OrdinalIgnoreCase) && commaIndex >= 0
                ? value.Substring(commaIndex + 1)
                : value;
        }

        private static bool IsPdf(byte[] bytes)
        {
            return bytes.Length >= 5
                   && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44
                   && bytes[3] == 0x46 && bytes[4] == 0x2D;
        }

        private static string DetectFileFormat(byte[] bytes)
        {
            if (IsPdf(bytes)) return "PDF";
            if (bytes.Length < 4) return null;
            var jpeg = bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
            var png = bytes.Length >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50
                      && bytes[2] == 0x4E && bytes[3] == 0x47;
            var gif = bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x38;
            var bmp = bytes[0] == 0x42 && bytes[1] == 0x4D;
            var tiff = (bytes[0] == 0x49 && bytes[1] == 0x49 && bytes[2] == 0x2A && bytes[3] == 0x00)
                       || (bytes[0] == 0x4D && bytes[1] == 0x4D && bytes[2] == 0x00 && bytes[3] == 0x2A);
            var webp = bytes.Length >= 12 && Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF"
                       && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP";
            if (jpeg) return "JPEG";
            if (png) return "PNG";
            if (gif) return "GIF";
            if (bmp) return "BMP";
            if (tiff) return "TIFF";
            if (webp) return "WEBP";
            return null;
        }

        private static bool FileNameMatchesDetectedFormat(
            string fileName,
            string detectedFormat,
            out string message)
        {
            message = null;
            if (string.IsNullOrWhiteSpace(fileName)) return true;
            string extension;
            try
            {
                extension = Path.GetExtension(NormalizeFileName(fileName));
            }
            catch (ArgumentException)
            {
                message = "FileName 格式无效。";
                return false;
            }
            if (string.IsNullOrWhiteSpace(extension)) return true;
            var normalizedExtension = extension.TrimStart('.').ToUpperInvariant();
            var matches = detectedFormat == "JPEG"
                ? normalizedExtension == "JPG" || normalizedExtension == "JPEG"
                : detectedFormat == "TIFF"
                    ? normalizedExtension == "TIF" || normalizedExtension == "TIFF"
                    : normalizedExtension == detectedFormat;
            if (matches) return true;
            message = $"FileName 扩展名与文件内容不一致，实际检测为 {detectedFormat}。";
            return false;
        }

        private static string ValidateOptions(MicroiOcrRecognizeParam param)
        {
            if (param.TextRecScoreThresh.HasValue
                && (param.TextRecScoreThresh.Value < 0 || param.TextRecScoreThresh.Value > 1))
                return "TextRecScoreThresh 必须在 0 到 1 之间。";
            if ((param.FileName?.Length ?? 0) > 255) return "FileName 不能超过 255 个字符。";
            return null;
        }

        private static bool TryValidateEndpoint(string value, out Uri uri, out string message)
        {
            uri = null;
            message = null;
            if (string.IsNullOrWhiteSpace(value))
            {
                message = "当前租户未配置 OCR 服务地址。";
                return false;
            }
            var endpoint = value.Trim();
            if (endpoint.Length > MaximumEndpointCharacters
                || !Uri.TryCreate(endpoint, UriKind.Absolute, out uri)
                || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
                || !string.IsNullOrEmpty(uri.UserInfo)
                || !string.IsNullOrEmpty(uri.Fragment))
            {
                message = "OCR 服务地址配置无效。";
                uri = null;
                return false;
            }
            return true;
        }

        private static async Task<string> ReadResponseBodyWithLimitAsync(
            HttpResponseMessage response,
            CancellationToken cancellationToken)
        {
            if (response.Content.Headers.ContentLength.HasValue
                && response.Content.Headers.ContentLength.Value > MaximumResponseBytes)
                throw new InvalidOperationException("OCR 服务响应超过 16 MB 上限。");

            using (var stream = await response.Content.ReadAsStreamAsync().ConfigureAwait(false))
            using (var buffer = new MemoryStream())
            {
                var chunk = new byte[8192];
                while (true)
                {
                    var read = await stream.ReadAsync(chunk, 0, chunk.Length, cancellationToken).ConfigureAwait(false);
                    if (read <= 0) break;
                    if (buffer.Length + read > MaximumResponseBytes)
                        throw new InvalidOperationException("OCR 服务响应超过 16 MB 上限。");
                    buffer.Write(chunk, 0, read);
                }
                return Encoding.UTF8.GetString(buffer.ToArray());
            }
        }

        private static string SafeProviderMessage(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return "未提供错误详情。";
            var normalized = value.Replace("\r", " ").Replace("\n", " ").Trim();
            return normalized.Length <= 500 ? normalized : normalized.Substring(0, 500);
        }

        private static string ReadScalar(JToken token, params string[] names)
        {
            if (token == null) return null;
            foreach (var name in names)
            {
                var value = token[name];
                if (value != null && value.Type != JTokenType.Null
                    && value.Type != JTokenType.Object && value.Type != JTokenType.Array)
                    return value.ToString();
            }
            return null;
        }

        private static int? ReadInteger(JToken token, params string[] names)
        {
            var value = ReadScalar(token, names);
            return int.TryParse(value, out var result) ? result : (int?)null;
        }

        private static void AddOptional(JObject target, string name, bool? value)
        {
            if (value.HasValue) target[name] = value.Value;
        }

        private static string NormalizeFileName(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            var fileName = Path.GetFileName(value.Trim());
            return fileName.Length <= 255 ? fileName : fileName.Substring(fileName.Length - 255);
        }

        private static DosResult<MicroiOcrRecognizeResult> Failure(string message, string traceId = null)
        {
            return new DosResult<MicroiOcrRecognizeResult>(0, null,
                string.IsNullOrWhiteSpace(traceId) ? message : $"{message} TraceId={traceId}");
        }

        private static void LogFailure(
            string osClient,
            OcrTenantSettings settings,
            string traceId,
            string action,
            string detail)
        {
            try
            {
                var host = settings?.EndpointUri?.Host ?? string.Empty;
                MicroiEngine.QueueSystemLog(
                    osClient,
                    "OCR",
                    action,
                    "OCR识别失败",
                    $"Provider={settings?.Provider}; Host={host}; TraceId={traceId}; Detail={detail}",
                    2,
                    false,
                    traceId);
            }
            catch
            {
                // 诊断是旁路能力，绝不影响 OCR 主流程。
            }
        }

        private enum OcrProviderProtocol
        {
            PaddleXBasic,
            PaddleXHighStability
        }

        private sealed class OcrTenantSettings
        {
            public bool Enabled { get; private set; }
            public string Provider { get; private set; }
            public string Endpoint { get; private set; }
            public Uri EndpointUri { get; private set; }
            public string ApiKey { get; private set; }
            public string HeadersJson { get; private set; }
            public int TimeoutSeconds { get; private set; }
            public int MaximumFileBytes { get; private set; }
            public int MaximumPages { get; private set; }
            public decimal MinimumConfidence { get; private set; }

            public static OcrTenantSettings Resolve(string osClient)
            {
                var client = OsClientExtend.GetClient(osClient);
                var model = client?.OsClientModel
                            ?? throw new InvalidOperationException("当前租户运行配置不存在。");
                var endpoint = ReadString(model, "OcrEndpoint");
                Uri.TryCreate(endpoint, UriKind.Absolute, out var endpointUri);
                var maximumFileMegabytes = Clamp(ReadInt(model, "OcrMaxFileMB", DefaultMaximumFileMegabytes),
                    1, AbsoluteMaximumFileMegabytes);
                return new OcrTenantSettings
                {
                    Enabled = ReadInt(model, "OcrEnabled", 0) == 1,
                    Provider = ReadString(model, "OcrProvider", "PaddleX"),
                    Endpoint = endpoint,
                    EndpointUri = endpointUri,
                    ApiKey = ReadString(model, "OcrApiKey"),
                    HeadersJson = ReadString(model, "OcrHeadersJson"),
                    TimeoutSeconds = Clamp(ReadInt(model, "OcrTimeoutSeconds", DefaultTimeoutSeconds),
                        1, MaximumTimeoutSeconds),
                    MaximumFileBytes = maximumFileMegabytes * 1024 * 1024,
                    MaximumPages = Clamp(ReadInt(model, "OcrMaxPages", DefaultMaximumPages),
                        1, AbsoluteMaximumPages),
                    MinimumConfidence = Clamp(ReadDecimal(model, "OcrMinConfidence", 0), 0, 1)
                };
            }

            public bool TryGetProtocol(out OcrProviderProtocol protocol)
            {
                var value = (Provider ?? string.Empty).Trim();
                if (value.Equals("PaddleX", StringComparison.OrdinalIgnoreCase)
                    || value.Equals("PaddleOCR", StringComparison.OrdinalIgnoreCase)
                    || value.Equals("PaddleXBasic", StringComparison.OrdinalIgnoreCase))
                {
                    protocol = OcrProviderProtocol.PaddleXBasic;
                    return true;
                }
                if (value.Equals("PaddleXHighStability", StringComparison.OrdinalIgnoreCase)
                    || value.Equals("PaddleXKServe", StringComparison.OrdinalIgnoreCase))
                {
                    protocol = OcrProviderProtocol.PaddleXHighStability;
                    return true;
                }
                protocol = OcrProviderProtocol.PaddleXBasic;
                return false;
            }

            private static string ReadString(JObject model, string name, string fallback = "")
            {
                var value = model?[name]?.ToString();
                return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
            }

            private static int ReadInt(JObject model, string name, int fallback)
            {
                return int.TryParse(model?[name]?.ToString(), out var result) ? result : fallback;
            }

            private static decimal ReadDecimal(JObject model, string name, decimal fallback)
            {
                return decimal.TryParse(model?[name]?.ToString(),
                    System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out var result) ? result : fallback;
            }

            private static int Clamp(int value, int minimum, int maximum)
            {
                return Math.Max(minimum, Math.Min(maximum, value));
            }

            private static decimal Clamp(decimal value, decimal minimum, decimal maximum)
            {
                return Math.Max(minimum, Math.Min(maximum, value));
            }
        }
    }
}
