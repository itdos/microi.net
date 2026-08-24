using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// LibreTranslate-compatible business surface. Operational endpoints such as
    /// API-key administration, metrics and frontend settings remain private to the
    /// translation service and are intentionally not proxied to V8/API/MCP callers.
    /// </summary>
    public partial class TranslateEngine
    {
        private const int MaxTextCharacters = 50000;
        private const int MaxBatchItems = 50;
        private const int MaxBatchCharacters = 200000;
        private const int MaxAlternatives = 10;
        private const int MaxFileBytes = 20 * 1024 * 1024;
        private const int MaxTranslatedFileBytes = 25 * 1024 * 1024;

        private static readonly HashSet<string> SupportedFileExtensions =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                ".txt", ".html", ".htm", ".odt", ".odp", ".docx", ".pptx",
                ".xlsx", ".epub", ".pdf"
            };

        private static readonly HttpClient LibreHttpClient = CreateLibreHttpClient();

        private static HttpClient CreateLibreHttpClient()
        {
            var handler = new HttpClientHandler
            {
                AllowAutoRedirect = false,
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
            };
            return new HttpClient(handler)
            {
                Timeout = Timeout.InfiniteTimeSpan
            };
        }

        public DosResult<MicroiTranslateTextResult> TranslateText(MicroiTranslateTextParam param)
        {
            param = param ?? new MicroiTranslateTextParam();
            param.OsClient = ResolveExecutionOsClient(param.OsClient);
            var textsResult = ValidateTextInput(param);
            if (textsResult.Code != 1)
            {
                return new DosResult<MicroiTranslateTextResult>(textsResult.Code, null, textsResult.Msg);
            }

            var texts = textsResult.Data;
            var configs = GetProviderConfigs(param.OsClient);
            if (configs.Count == 0)
            {
                return new DosResult<MicroiTranslateTextResult>(2, null, "Translate provider is not configured.");
            }

            DosResult<MicroiTranslateTextResult> lastResult = null;
            foreach (var config in configs)
            {
                if (IsLibreProvider(config))
                {
                    lastResult = TranslateTextByLibre(param, texts, config);
                    if (lastResult.Code == 1) return lastResult;
                    continue;
                }

                if (config.Provider == "aliyun")
                {
                    if (texts.Count != 1
                        || !string.Equals(NormalizeFormat(param.Format), "text", StringComparison.Ordinal)
                        || (param.Alternatives ?? 0) != 0)
                    {
                        lastResult = new DosResult<MicroiTranslateTextResult>(
                            2,
                            null,
                            "The configured provider does not support batch, HTML or alternative translations through this API.");
                        continue;
                    }

                    var legacy = TranslateByAliyun(new TranslateParam
                    {
                        OsClient = param.OsClient,
                        SourceText = texts[0],
                        FromLang = param.FromLang,
                        Lang = param.Lang
                    }, config);
                    if (legacy.Code == 1)
                    {
                        var translated = legacy.Data?.ToString() ?? "";
                        return new DosResult<MicroiTranslateTextResult>(1, new MicroiTranslateTextResult
                        {
                            Provider = "Aliyun",
                            IsBatch = false,
                            SourceLanguage = NormalizeHttpTranslateLang(param.FromLang),
                            TargetLanguage = NormalizeHttpTranslateLang(param.Lang),
                            Format = "text",
                            TranslatedText = translated,
                            TranslatedTexts = new List<string> { translated }
                        });
                    }
                    lastResult = new DosResult<MicroiTranslateTextResult>(legacy.Code, null, legacy.Msg);
                }
            }

            return lastResult ?? new DosResult<MicroiTranslateTextResult>(2, null, "Translate provider is not configured.");
        }

        public DosResult<List<MicroiTranslateDetection>> Detect(MicroiTranslateDetectParam param)
        {
            param = param ?? new MicroiTranslateDetectParam();
            param.OsClient = ResolveExecutionOsClient(param.OsClient);
            var text = param.SourceText ?? "";
            if (string.IsNullOrWhiteSpace(text))
                return new DosResult<List<MicroiTranslateDetection>>(0, null, "SourceText is required.");
            if (text.Length > MaxTextCharacters)
                return new DosResult<List<MicroiTranslateDetection>>(0, null, $"SourceText cannot exceed {MaxTextCharacters} characters.");

            var configResult = GetLibreConfig(param.OsClient);
            if (configResult.Code != 1)
                return new DosResult<List<MicroiTranslateDetection>>(configResult.Code, null, configResult.Msg);
            var config = configResult.Data;
            if (!TryBuildProviderUri(config, "detect", out var uri, out var uriError))
                return new DosResult<List<MicroiTranslateDetection>>(2, null, uriError);

            var body = new JObject { ["q"] = text };
            AddApiKey(body, config.ApiKey);
            var response = SendJson(HttpMethod.Post, uri, body, config);
            if (response.Code != 1)
                return new DosResult<List<MicroiTranslateDetection>>(response.Code, null, response.Msg);
            try
            {
                var token = JToken.Parse(response.Data);
                var detections = ParseDetections(token);
                return detections.Count == 0
                    ? new DosResult<List<MicroiTranslateDetection>>(0, null, "Translate detection response is empty.")
                    : new DosResult<List<MicroiTranslateDetection>>(1, detections);
            }
            catch
            {
                return new DosResult<List<MicroiTranslateDetection>>(0, null, "Translate detection response is invalid.");
            }
        }

        public DosResult<List<MicroiTranslateLanguage>> GetLanguages(string osClient = "")
        {
            osClient = ResolveExecutionOsClient(osClient);
            var configResult = GetLibreConfig(osClient);
            if (configResult.Code != 1)
                return new DosResult<List<MicroiTranslateLanguage>>(configResult.Code, null, configResult.Msg);
            var config = configResult.Data;
            if (!TryBuildProviderUri(config, "languages", out var uri, out var uriError))
                return new DosResult<List<MicroiTranslateLanguage>>(2, null, uriError);

            // LibreTranslate /languages is intentionally API-key exempt. Keeping the
            // key out of the query string also prevents it from entering proxy logs.
            var response = SendJson(HttpMethod.Get, uri, null, config);
            if (response.Code != 1)
                return new DosResult<List<MicroiTranslateLanguage>>(response.Code, null, response.Msg);
            try
            {
                var array = JArray.Parse(response.Data);
                var languages = array.OfType<JObject>().Select(item => new MicroiTranslateLanguage
                {
                    Code = item.Value<string>("code") ?? "",
                    Name = item.Value<string>("name") ?? "",
                    Targets = item["targets"] is JArray targets
                        ? targets.Values<string>().Where(value => !string.IsNullOrWhiteSpace(value)).ToList()
                        : new List<string>()
                }).Where(item => !string.IsNullOrWhiteSpace(item.Code)).ToList();
                return new DosResult<List<MicroiTranslateLanguage>>(1, languages);
            }
            catch
            {
                return new DosResult<List<MicroiTranslateLanguage>>(0, null, "Translate languages response is invalid.");
            }
        }

        public DosResult<MicroiTranslateFileResult> TranslateFile(MicroiTranslateFileParam param)
        {
            param = param ?? new MicroiTranslateFileParam();
            param.OsClient = ResolveExecutionOsClient(param.OsClient);
            if (!TryDecodeFile(param.FileByteBase64, param.FileName, out var bytes, out var fileName, out var fileError))
                return new DosResult<MicroiTranslateFileResult>(0, null, fileError);

            var configResult = GetLibreConfig(param.OsClient);
            if (configResult.Code != 1)
                return new DosResult<MicroiTranslateFileResult>(configResult.Code, null, configResult.Msg);
            var config = configResult.Data;
            if (!TryBuildProviderUri(config, "translate_file", out var uri, out var uriError))
                return new DosResult<MicroiTranslateFileResult>(2, null, uriError);

            var target = NormalizeHttpTranslateLang(param.Lang);
            var source = NormalizeHttpTranslateLang(param.FromLang);
            if (string.IsNullOrWhiteSpace(target))
                return new DosResult<MicroiTranslateFileResult>(0, null, "Target language is required.");
            if (!TryResolveHttpTranslateTarget(config.Url, target, config, out target, out var targetError))
                return new DosResult<MicroiTranslateFileResult>(2, null, targetError);
            if (string.IsNullOrWhiteSpace(source) || source == "cn") source = "auto";
            else if (source != "auto")
            {
                if (!TryResolveHttpTranslateTarget(config.Url, source, config, out var resolvedSource, out var sourceError))
                    return new DosResult<MicroiTranslateFileResult>(2, null, sourceError);
                source = resolvedSource;
            }

            try
            {
                using (var multipart = new MultipartFormDataContent())
                using (var fileContent = new ByteArrayContent(bytes))
                using (var request = new HttpRequestMessage(HttpMethod.Post, uri))
                using (var cancellation = CreateTimeout(config))
                {
                    fileContent.Headers.ContentType = new MediaTypeHeaderValue(GetContentType(fileName));
                    multipart.Add(fileContent, "file", fileName);
                    multipart.Add(new StringContent(source), "source");
                    multipart.Add(new StringContent(target), "target");
                    if (!string.IsNullOrWhiteSpace(config.ApiKey))
                        multipart.Add(new StringContent(config.ApiKey), "api_key");
                    request.Content = multipart;

                    using (var response = LibreHttpClient.SendAsync(request, cancellation.Token).ConfigureAwait(false).GetAwaiter().GetResult())
                    {
                        if (!response.IsSuccessStatusCode)
                            return new DosResult<MicroiTranslateFileResult>(MapProviderStatus(response.StatusCode), null, SafeProviderFailure(response.StatusCode));
                        var responseText = response.Content.ReadAsStringAsync().ConfigureAwait(false).GetAwaiter().GetResult();
                        var responseObject = JObject.Parse(responseText);
                        var downloadValue = responseObject.Value<string>("translatedFileUrl");
                        if (!TryResolveSameOriginDownloadUri(uri, downloadValue, out var downloadUri))
                            return new DosResult<MicroiTranslateFileResult>(0, null, "Translate file response returned an unsafe download URL.");

                        using (var downloadRequest = new HttpRequestMessage(HttpMethod.Get, downloadUri))
                        using (var downloadResponse = LibreHttpClient.SendAsync(downloadRequest, cancellation.Token).ConfigureAwait(false).GetAwaiter().GetResult())
                        {
                            if (!downloadResponse.IsSuccessStatusCode)
                                return new DosResult<MicroiTranslateFileResult>(MapProviderStatus(downloadResponse.StatusCode), null, "Translated file download failed.");
                            if (downloadResponse.Content.Headers.ContentLength > MaxTranslatedFileBytes)
                                return new DosResult<MicroiTranslateFileResult>(0, null, "Translated file exceeds the 25 MB response limit.");
                            if (!TryReadContentWithLimit(
                                    downloadResponse.Content,
                                    MaxTranslatedFileBytes,
                                    cancellation.Token,
                                    out var translatedBytes))
                                return new DosResult<MicroiTranslateFileResult>(0, null, "Translated file is empty or exceeds the 25 MB response limit.");
                            var outputName = GetSafeDownloadFileName(downloadResponse, downloadUri, fileName);
                            return new DosResult<MicroiTranslateFileResult>(1, new MicroiTranslateFileResult
                            {
                                Provider = DisplayProvider(config),
                                FileName = outputName,
                                ContentType = downloadResponse.Content.Headers.ContentType?.MediaType ?? GetContentType(outputName),
                                FileByteBase64 = Convert.ToBase64String(translatedBytes),
                                ByteLength = translatedBytes.LongLength
                            });
                        }
                    }
                }
            }
            catch (OperationCanceledException)
            {
                return new DosResult<MicroiTranslateFileResult>(0, null, "Translate file request timed out.");
            }
            catch
            {
                return new DosResult<MicroiTranslateFileResult>(0, null, "Translate file request failed.");
            }
        }

        public DosResult<MicroiTranslateSuggestionResult> Suggest(MicroiTranslateSuggestParam param)
        {
            param = param ?? new MicroiTranslateSuggestParam();
            param.OsClient = ResolveExecutionOsClient(param.OsClient);
            if (string.IsNullOrWhiteSpace(param.SourceText) || string.IsNullOrWhiteSpace(param.SuggestedText))
                return new DosResult<MicroiTranslateSuggestionResult>(0, null, "SourceText and SuggestedText are required.");
            if (param.SourceText.Length > MaxTextCharacters || param.SuggestedText.Length > MaxTextCharacters)
                return new DosResult<MicroiTranslateSuggestionResult>(0, null, $"Suggestion texts cannot exceed {MaxTextCharacters} characters each.");
            var source = NormalizeHttpTranslateLang(param.FromLang);
            var target = NormalizeHttpTranslateLang(param.Lang);
            if (string.IsNullOrWhiteSpace(source) || source == "auto" || string.IsNullOrWhiteSpace(target))
                return new DosResult<MicroiTranslateSuggestionResult>(0, null, "Explicit source and target languages are required for suggestions.");

            var configResult = GetLibreConfig(param.OsClient);
            if (configResult.Code != 1)
                return new DosResult<MicroiTranslateSuggestionResult>(configResult.Code, null, configResult.Msg);
            var config = configResult.Data;
            if (!TryBuildProviderUri(config, "suggest", out var uri, out var uriError))
                return new DosResult<MicroiTranslateSuggestionResult>(2, null, uriError);
            if (!TryResolveHttpTranslateTarget(config.Url, source, config, out source, out var sourceError))
                return new DosResult<MicroiTranslateSuggestionResult>(2, null, sourceError);
            if (!TryResolveHttpTranslateTarget(config.Url, target, config, out target, out var targetError))
                return new DosResult<MicroiTranslateSuggestionResult>(2, null, targetError);
            var body = new JObject
            {
                ["q"] = param.SourceText,
                ["s"] = param.SuggestedText,
                ["source"] = source,
                ["target"] = target
            };
            AddApiKey(body, config.ApiKey);
            var response = SendJson(HttpMethod.Post, uri, body, config);
            if (response.Code != 1)
                return new DosResult<MicroiTranslateSuggestionResult>(response.Code, null, response.Msg);
            try
            {
                var success = JObject.Parse(response.Data).Value<bool?>("success") == true;
                return success
                    ? new DosResult<MicroiTranslateSuggestionResult>(1, new MicroiTranslateSuggestionResult { Provider = DisplayProvider(config), Success = true })
                    : new DosResult<MicroiTranslateSuggestionResult>(0, null, "Translation suggestion was not accepted by the provider.");
            }
            catch
            {
                return new DosResult<MicroiTranslateSuggestionResult>(0, null, "Translate suggestion response is invalid.");
            }
        }

        public DosResult<MicroiTranslateHealthResult> Health(string osClient = "")
        {
            osClient = ResolveExecutionOsClient(osClient);
            var configResult = GetLibreConfig(osClient);
            if (configResult.Code != 1)
                return new DosResult<MicroiTranslateHealthResult>(configResult.Code, null, configResult.Msg);
            var config = configResult.Data;
            if (!TryBuildProviderUri(config, "health", out var uri, out var uriError))
                return new DosResult<MicroiTranslateHealthResult>(2, null, uriError);
            var response = SendJson(HttpMethod.Get, uri, null, config);
            if (response.Code != 1)
                return new DosResult<MicroiTranslateHealthResult>(response.Code, new MicroiTranslateHealthResult
                {
                    Provider = DisplayProvider(config), Status = "unavailable", Healthy = false
                }, response.Msg);
            string status;
            try { status = JObject.Parse(response.Data).Value<string>("status") ?? "ok"; }
            catch { status = "ok"; }
            return new DosResult<MicroiTranslateHealthResult>(1, new MicroiTranslateHealthResult
            {
                Provider = DisplayProvider(config),
                Status = status,
                Healthy = string.Equals(status, "ok", StringComparison.OrdinalIgnoreCase),
                SupportsBatch = true,
                SupportsHtml = true,
                SupportsAlternatives = true,
                SupportsDetection = true,
                SupportsFiles = true,
                SupportsSuggestions = true
            });
        }

        private DosResult<MicroiTranslateTextResult> TranslateTextByLibre(
            MicroiTranslateTextParam param,
            List<string> texts,
            TranslateProviderConfig config)
        {
            if (!TryBuildProviderUri(config, "translate", out var uri, out var uriError))
                return new DosResult<MicroiTranslateTextResult>(2, null, uriError);
            var target = NormalizeHttpTranslateLang(param.Lang);
            var source = NormalizeHttpTranslateLang(param.FromLang);
            if (string.IsNullOrWhiteSpace(target))
                return new DosResult<MicroiTranslateTextResult>(0, null, "Target language is required.");
            if (!TryResolveHttpTranslateTarget(config.Url, target, config, out target, out var targetError))
                return new DosResult<MicroiTranslateTextResult>(2, null, targetError);
            if (string.IsNullOrWhiteSpace(source) || source == "cn") source = "auto";
            else if (source != "auto")
            {
                if (!TryResolveHttpTranslateTarget(config.Url, source, config, out var resolvedSource, out var sourceError))
                    return new DosResult<MicroiTranslateTextResult>(2, null, sourceError);
                source = resolvedSource;
            }

            var format = NormalizeFormat(param.Format);
            var alternatives = param.Alternatives ?? 0;
            var body = new JObject
            {
                ["q"] = texts.Count == 1 ? (JToken)texts[0] : new JArray(texts),
                ["source"] = source,
                ["target"] = target,
                ["format"] = format,
                ["alternatives"] = alternatives
            };
            AddApiKey(body, config.ApiKey);
            var response = SendJson(HttpMethod.Post, uri, body, config);
            if (response.Code != 1)
                return new DosResult<MicroiTranslateTextResult>(response.Code, null, response.Msg);
            try
            {
                var responseObject = JObject.Parse(response.Data);
                var translatedToken = responseObject["translatedText"];
                var translatedTexts = translatedToken is JArray translatedArray
                    ? translatedArray.Values<string>().Select(value => value ?? "").ToList()
                    : new List<string> { translatedToken?.ToString() ?? "" };
                if (translatedTexts.Count != texts.Count || translatedTexts.Any(string.IsNullOrWhiteSpace))
                    return new DosResult<MicroiTranslateTextResult>(0, null, "Translate response is missing translated text.");
                var detected = ParseDetections(responseObject["detectedLanguage"]);
                var alternativeGroups = ParseAlternativeGroups(responseObject["alternatives"], texts.Count);
                return new DosResult<MicroiTranslateTextResult>(1, new MicroiTranslateTextResult
                {
                    Provider = DisplayProvider(config),
                    IsBatch = texts.Count > 1,
                    SourceLanguage = source,
                    TargetLanguage = target,
                    Format = format,
                    TranslatedText = translatedTexts[0],
                    TranslatedTexts = translatedTexts,
                    DetectedLanguage = detected.FirstOrDefault(),
                    DetectedLanguages = detected,
                    Alternatives = alternativeGroups.FirstOrDefault() ?? new List<string>(),
                    AlternativeGroups = alternativeGroups
                });
            }
            catch
            {
                return new DosResult<MicroiTranslateTextResult>(0, null, "Translate response is invalid.");
            }
        }

        private static DosResult<List<string>> ValidateTextInput(MicroiTranslateTextParam param)
        {
            var hasSingle = !string.IsNullOrWhiteSpace(param.SourceText);
            var hasBatch = param.SourceTexts != null && param.SourceTexts.Count > 0;
            if (hasSingle == hasBatch)
                return new DosResult<List<string>>(0, null, "Provide exactly one of SourceText or SourceTexts.");
            var texts = hasSingle ? new List<string> { param.SourceText } : param.SourceTexts.ToList();
            if (texts.Count > MaxBatchItems)
                return new DosResult<List<string>>(0, null, $"SourceTexts cannot contain more than {MaxBatchItems} items.");
            if (texts.Any(string.IsNullOrWhiteSpace))
                return new DosResult<List<string>>(0, null, "Source text items cannot be empty.");
            if (texts.Any(text => text.Length > MaxTextCharacters))
                return new DosResult<List<string>>(0, null, $"Each source text cannot exceed {MaxTextCharacters} characters.");
            if (texts.Sum(text => text.Length) > MaxBatchCharacters)
                return new DosResult<List<string>>(0, null, $"Source texts cannot exceed {MaxBatchCharacters} total characters.");
            var format = NormalizeFormat(param.Format);
            if (format != "text" && format != "html")
                return new DosResult<List<string>>(0, null, "Format must be text or html.");
            if ((param.Alternatives ?? 0) < 0 || (param.Alternatives ?? 0) > MaxAlternatives)
                return new DosResult<List<string>>(0, null, $"Alternatives must be between 0 and {MaxAlternatives}.");
            return new DosResult<List<string>>(1, texts);
        }

        private DosResult<TranslateProviderConfig> GetLibreConfig(string osClient)
        {
            var config = GetProviderConfigs(osClient).FirstOrDefault(IsLibreProvider);
            return config == null
                ? new DosResult<TranslateProviderConfig>(2, null, "LibreTranslate-compatible provider is not configured for the current tenant.")
                : new DosResult<TranslateProviderConfig>(1, config);
        }

        private static bool IsLibreProvider(TranslateProviderConfig config)
        {
            return config != null && (config.Provider == "libretranslate" || config.Provider == "http");
        }

        private static string DisplayProvider(TranslateProviderConfig config)
        {
            return config?.Provider == "http" ? "Http" : "LibreTranslate";
        }

        private static string HashSensitive(string value)
        {
            if (string.IsNullOrEmpty(value)) return "none";
            using (var sha256 = SHA256.Create())
            {
                var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(value));
                return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
            }
        }

        private static string NormalizeFormat(string format)
        {
            return string.IsNullOrWhiteSpace(format) ? "text" : format.Trim().ToLowerInvariant();
        }

        private static void AddApiKey(JObject body, string apiKey)
        {
            if (!string.IsNullOrWhiteSpace(apiKey)) body["api_key"] = apiKey;
        }

        private static bool TryBuildProviderUri(
            TranslateProviderConfig config,
            string operation,
            out Uri uri,
            out string error)
        {
            uri = null;
            error = "";
            var baseUrl = NormalizeHttpTranslateBaseUrl(config?.Url);
            if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var baseUri)
                || (baseUri.Scheme != Uri.UriSchemeHttp && baseUri.Scheme != Uri.UriSchemeHttps)
                || !string.IsNullOrWhiteSpace(baseUri.UserInfo))
            {
                error = "TranslateUrl must be an absolute HTTP(S) URL without embedded credentials.";
                return false;
            }
            var builder = new UriBuilder(baseUri)
            {
                Query = "",
                Fragment = "",
                Path = baseUri.AbsolutePath.TrimEnd('/') + "/" + operation.TrimStart('/')
            };
            uri = builder.Uri;
            return true;
        }

        private static CancellationTokenSource CreateTimeout(TranslateProviderConfig config)
        {
            var timeoutSeconds = Math.Max(1, Math.Min(config?.Timeout ?? 10, 300));
            return new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
        }

        private static DosResult<string> SendJson(
            HttpMethod method,
            Uri uri,
            JObject body,
            TranslateProviderConfig config)
        {
            try
            {
                using (var request = new HttpRequestMessage(method, uri))
                using (var cancellation = CreateTimeout(config))
                {
                    if (body != null)
                        request.Content = new StringContent(body.ToString(Newtonsoft.Json.Formatting.None), Encoding.UTF8, "application/json");
                    using (var response = LibreHttpClient.SendAsync(request, cancellation.Token).ConfigureAwait(false).GetAwaiter().GetResult())
                    {
                        if (!response.IsSuccessStatusCode)
                            return new DosResult<string>(MapProviderStatus(response.StatusCode), null, SafeProviderFailure(response.StatusCode));
                        var responseText = response.Content.ReadAsStringAsync().ConfigureAwait(false).GetAwaiter().GetResult();
                        return new DosResult<string>(1, responseText);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                return new DosResult<string>(0, null, "Translation provider request timed out.");
            }
            catch
            {
                return new DosResult<string>(0, null, "Translation provider request failed.");
            }
        }

        private static int MapProviderStatus(HttpStatusCode statusCode)
        {
            return statusCode == HttpStatusCode.BadRequest || statusCode == HttpStatusCode.NotFound ? 2 : 0;
        }

        private static string SafeProviderFailure(HttpStatusCode statusCode)
        {
            var code = (int)statusCode;
            if (code == 400) return "Translation provider rejected the request or language pair.";
            if (code == 403) return "Translation provider rejected authentication or disabled this feature.";
            if (code == 404) return "Translation provider does not expose this feature.";
            if (code == 429) return "Translation provider rate limit exceeded.";
            return $"Translation provider returned HTTP {code}.";
        }

        private static List<MicroiTranslateDetection> ParseDetections(JToken token)
        {
            var result = new List<MicroiTranslateDetection>();
            if (token == null || token.Type == JTokenType.Null) return result;
            IEnumerable<JToken> items;
            if (token is JArray array)
                items = array.Children();
            else
                items = new[] { token };
            foreach (var item in items)
            {
                if (item is JObject obj)
                {
                    var language = obj.Value<string>("language") ?? obj.Value<string>("code") ?? "";
                    if (!string.IsNullOrWhiteSpace(language))
                        result.Add(new MicroiTranslateDetection { Language = language, Confidence = obj.Value<decimal?>("confidence") ?? 0m });
                }
                else
                {
                    var language = item.ToString();
                    if (!string.IsNullOrWhiteSpace(language))
                        result.Add(new MicroiTranslateDetection { Language = language, Confidence = 0m });
                }
            }
            return result;
        }

        private static List<List<string>> ParseAlternativeGroups(JToken token, int textCount)
        {
            var result = new List<List<string>>();
            if (!(token is JArray array))
            {
                while (result.Count < textCount) result.Add(new List<string>());
                return result;
            }
            if (array.Count == 0 || array.First is JValue)
                result.Add(array.Values<string>().Where(value => !string.IsNullOrWhiteSpace(value)).ToList());
            else
                result.AddRange(array.Children<JArray>().Select(group => group.Values<string>().Where(value => !string.IsNullOrWhiteSpace(value)).ToList()));
            while (result.Count < textCount) result.Add(new List<string>());
            return result;
        }

        private static bool TryDecodeFile(
            string base64,
            string requestedFileName,
            out byte[] bytes,
            out string fileName,
            out string error)
        {
            bytes = null;
            fileName = "";
            error = "";
            try
            {
                var rawName = requestedFileName ?? "";
                if (rawName.Length > 255 || rawName.Any(char.IsControl)) throw new InvalidDataException();
                fileName = Path.GetFileName(rawName.Replace('\\', '/').Trim());
                var extension = Path.GetExtension(fileName);
                if (string.IsNullOrWhiteSpace(fileName) || !SupportedFileExtensions.Contains(extension))
                {
                    error = "FileName must use a LibreTranslate-supported TXT, HTML, ODT, ODP, DOCX, PPTX, XLSX, EPUB or PDF extension.";
                    return false;
                }
                var normalized = (base64 ?? "").Trim();
                if (normalized.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                {
                    var comma = normalized.IndexOf(',');
                    if (comma < 0 || normalized.Substring(0, comma).IndexOf(";base64", StringComparison.OrdinalIgnoreCase) < 0)
                        throw new InvalidDataException();
                    normalized = normalized.Substring(comma + 1);
                }
                normalized = new string(normalized.Where(character => !char.IsWhiteSpace(character)).ToArray());
                if (normalized.Length == 0 || normalized.Length > ((MaxFileBytes + 2) / 3 * 4 + 16))
                {
                    error = "Translation file must be greater than 0 bytes and no more than 20 MB.";
                    return false;
                }
                bytes = Convert.FromBase64String(normalized);
                if (bytes.Length == 0 || bytes.Length > MaxFileBytes)
                {
                    error = "Translation file must be greater than 0 bytes and no more than 20 MB.";
                    return false;
                }
                if (string.Equals(extension, ".pdf", StringComparison.OrdinalIgnoreCase)
                    && (bytes.Length < 4 || Encoding.ASCII.GetString(bytes, 0, 4) != "%PDF"))
                {
                    error = "PDF file signature is invalid.";
                    return false;
                }
                if (new[] { ".odt", ".odp", ".docx", ".pptx", ".xlsx", ".epub" }.Contains(extension, StringComparer.OrdinalIgnoreCase)
                    && (bytes.Length < 2 || bytes[0] != (byte)'P' || bytes[1] != (byte)'K'))
                {
                    error = "Office/OpenDocument/EPUB file signature is invalid.";
                    return false;
                }
                if (new[] { ".txt", ".html", ".htm" }.Contains(extension, StringComparer.OrdinalIgnoreCase)
                    && bytes.Take(Math.Min(bytes.Length, 4096)).Any(value => value == 0))
                {
                    error = "Text/HTML input contains binary null bytes.";
                    return false;
                }
                return true;
            }
            catch
            {
                error = "FileByteBase64 is invalid.";
                bytes = null;
                fileName = "";
                return false;
            }
        }

        private static bool TryReadContentWithLimit(
            HttpContent content,
            int maxBytes,
            CancellationToken cancellationToken,
            out byte[] bytes)
        {
            bytes = null;
            using (var input = content.ReadAsStreamAsync().ConfigureAwait(false).GetAwaiter().GetResult())
            using (var output = new MemoryStream())
            {
                var buffer = new byte[81920];
                while (true)
                {
                    var read = input.ReadAsync(buffer, 0, buffer.Length, cancellationToken)
                        .ConfigureAwait(false).GetAwaiter().GetResult();
                    if (read <= 0) break;
                    if (output.Length + read > maxBytes) return false;
                    output.Write(buffer, 0, read);
                }
                if (output.Length == 0) return false;
                bytes = output.ToArray();
                return true;
            }
        }

        private static bool TryResolveSameOriginDownloadUri(Uri requestUri, string value, out Uri downloadUri)
        {
            downloadUri = null;
            if (string.IsNullOrWhiteSpace(value)) return false;
            if (!Uri.TryCreate(requestUri, value, out var candidate)) return false;
            if (candidate.Scheme != requestUri.Scheme
                || !string.Equals(candidate.Host, requestUri.Host, StringComparison.OrdinalIgnoreCase)
                || candidate.Port != requestUri.Port
                || !string.IsNullOrWhiteSpace(candidate.UserInfo)) return false;
            downloadUri = candidate;
            return true;
        }

        private static string GetSafeDownloadFileName(HttpResponseMessage response, Uri uri, string fallback)
        {
            var candidate = response.Content.Headers.ContentDisposition?.FileNameStar
                            ?? response.Content.Headers.ContentDisposition?.FileName
                            ?? Path.GetFileName(uri.LocalPath)
                            ?? fallback;
            candidate = Path.GetFileName((candidate ?? fallback).Trim('"'));
            return string.IsNullOrWhiteSpace(candidate) ? fallback : candidate;
        }

        private static string GetContentType(string fileName)
        {
            switch ((Path.GetExtension(fileName) ?? "").ToLowerInvariant())
            {
                case ".pdf": return "application/pdf";
                case ".html":
                case ".htm": return "text/html";
                case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                case ".pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                case ".odt": return "application/vnd.oasis.opendocument.text";
                case ".odp": return "application/vnd.oasis.opendocument.presentation";
                case ".epub": return "application/epub+zip";
                default: return "text/plain";
            }
        }
    }
}
