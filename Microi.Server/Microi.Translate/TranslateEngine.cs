using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using Dos.Common;
using MongoDB.Bson.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Tea;

namespace Microi.net
{
    public partial class TranslateEngine : ITranslateEngine
    {
        private static readonly ConcurrentDictionary<string, string> HttpTranslateLanguageCache = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, DateTime> HttpTranslateLanguageCacheAt = new ConcurrentDictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);

        private sealed class TranslateProviderConfig
        {
            public string Provider { get; set; }
            public string Endpoint { get; set; }
            public string Key { get; set; }
            public string Secret { get; set; }
            public string Url { get; set; }
            public string ApiKey { get; set; }
            public int Timeout { get; set; } = 10;
            public string SourceOsClient { get; set; }
        }

        /// <term><b>Description:</b></term>
        /// <description>
        /// <para>使用AK&amp;SK初始化账号Client</para>
        /// </description>
        ///
        /// <returns>
        /// Client
        /// </returns>
        ///
        /// <term><b>Exception:</b></term>
        /// Exception
        public static AlibabaCloud.SDK.Alimt20181012.Client CreateClient(string key, string secret, string enpoint)
        {
            // 工程代码泄露可能会导致 AccessKey 泄露，并威胁账号下所有资源的安全性。以下代码示例仅供参考。
            // 建议使用更安全的 STS 方式，更多鉴权访问方式请参见：https://help.aliyun.com/document_detail/378671.html。
            AlibabaCloud.OpenApiClient.Models.Config config = new AlibabaCloud.OpenApiClient.Models.Config
            {
                // 必填，请确保代码运行环境设置了环境变量 ALIBABA_CLOUD_ACCESS_KEY_ID。
                AccessKeyId = key,
                // 必填，请确保代码运行环境设置了环境变量 ALIBABA_CLOUD_ACCESS_KEY_SECRET。
                AccessKeySecret = secret,
            };
            // Endpoint 请参考 https://api.aliyun.com/product/alimt
            config.Endpoint = enpoint;
            return new AlibabaCloud.SDK.Alimt20181012.Client(config);
        }

        /// <summary>
        /// 传入OsClient、Lang、SourceText
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public TranslateParam DynamicToParam(dynamic dynamicParam)
        {
            JObject jobjParam = JsonHelper.ToJObject(dynamicParam);
            TranslateParam param = jobjParam.ToObject<TranslateParam>(DiyCommon.GetJsonSerializer());
            return param;
        }

        public DosResult Translate(dynamic dynamicParam)
        {
            return Translate(DynamicToParam(dynamicParam));
        }

        public DosResult Translate(object sourceText, object lang)
        {
            return Translate(new TranslateParam()
            {
                SourceText = ToV8String(sourceText),
                Lang = ToV8String(lang)
            });
        }

        public DosResult Translate(object sourceText, object lang, object fromLangOrOsClient)
        {
            var third = ToV8String(fromLangOrOsClient);
            var param = new TranslateParam()
            {
                SourceText = ToV8String(sourceText),
                Lang = ToV8String(lang)
            };
            if (LooksLikeLang(third))
            {
                param.FromLang = third;
            }
            else
            {
                param.OsClient = third;
            }
            return Translate(param);
        }

        public DosResult Translate(object sourceText, object lang, object fromLang, object osClient)
        {
            return Translate(new TranslateParam()
            {
                SourceText = ToV8String(sourceText),
                Lang = ToV8String(lang),
                FromLang = ToV8String(fromLang),
                OsClient = ToV8String(osClient)
            });
        }

        public string GetLang(string key, string lang = "cn", string osClient = "")
        {
            osClient = ResolveExecutionOsClient(osClient);
            return DiyMessage.GetLang(osClient, key, lang);
        }

        public JObject GetLangData(string key, string osClient = "")
        {
            osClient = ResolveExecutionOsClient(osClient);
            try
            {
                return DiyMessage.Msg[osClient][key];
            }
            catch
            {
                return null;
            }
        }

        public string GetLangCode(string key, string osClient = "")
        {
            osClient = ResolveExecutionOsClient(osClient);
            try
            {
                var jObj = DiyMessage.Msg[osClient][key];
                return jObj["Code"]?.ToString() ?? key;
            }
            catch
            {
                return key;
            }
        }

        private static string ToV8String(object value)
        {
            return value == null ? "" : value.ToString();
        }

        private static bool LooksLikeLang(string value)
        {
            value = (value ?? "").Trim().ToLower();
            return value == "auto"
                || value == "zh"
                || value == "cn"
                || value == "zh-cn"
                || value == "zh-hans"
                || value == "zh-hant"
                || value == "zh-tw"
                || value == "tw"
                || value == "zt"
                || value == "en"
                || value == "en-us"
                || value == "en-gb"
                || value == "my"
                || value == "mm"
                || value == "ja"
                || value == "jp"
                || value == "ko"
                || value == "ar"
                || value == "fr"
                || value == "de"
                || value == "es"
                || value == "hi"
                || value == "id"
                || value == "it"
                || value == "ms"
                || value == "nl"
                || value == "pl"
                || value == "pt"
                || value == "ru"
                || value == "th"
                || value == "tl"
                || value == "tr"
                || value == "uk"
                || value == "ur"
                || value == "vi";
        }

        public DosResult Translate(TranslateParam param)
        {
            if (param == null)
            {
                return new DosResult(0, null, "SourceText is required.");
            }
            param.OsClient = ResolveExecutionOsClient(param.OsClient);
            if (param.SourceText.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "SourceText is required.");
            }
            var providerConfigs = GetProviderConfigs(param.OsClient);
            if (providerConfigs.Count == 0)
            {
                return new DosResult(2, param.SourceText, "Translate provider is not configured.");
            }

            DosResult lastResult = null;
            foreach (var providerConfig in providerConfigs)
            {
                if (providerConfig.Provider == "libretranslate" || providerConfig.Provider == "http")
                {
                    lastResult = TranslateByHttp(param, providerConfig);
                    if (lastResult.Code == 1)
                    {
                        return lastResult;
                    }
                    continue;
                }

                if (providerConfig.Provider != "aliyun")
                {
                    continue;
                }

                if (providerConfig.Endpoint.DosIsNullOrWhiteSpace()
                    || providerConfig.Key.DosIsNullOrWhiteSpace()
                    || providerConfig.Secret.DosIsNullOrWhiteSpace())
                {
                    lastResult = new DosResult(2, param.SourceText, "Aliyun translate config is incomplete.");
                    continue;
                }

                lastResult = TranslateByAliyun(param, providerConfig);
                if (lastResult.Code == 1)
                {
                    return lastResult;
                }
            }

            return lastResult ?? new DosResult(2, param.SourceText, "Translate provider is not configured.");
        }

        private static string ResolveExecutionOsClient(string requestedOsClient)
        {
            if (requestedOsClient.DosIsNullOrWhiteSpace())
            {
                requestedOsClient = DiyToken.GetCurrentOsClient();
            }
            if (requestedOsClient.DosIsNullOrWhiteSpace() && V8TenantContext.IsActive)
            {
                requestedOsClient = V8TenantContext.Current?.OsClient;
            }
            return V8TenantContext.EnforceOsClient(requestedOsClient);
        }

        private DosResult TranslateByAliyun(TranslateParam param, TranslateProviderConfig providerConfig)
        {
            AlibabaCloud.SDK.Alimt20181012.Client client = CreateClient(providerConfig.Key, providerConfig.Secret, providerConfig.Endpoint);
            AlibabaCloud.SDK.Alimt20181012.Models.TranslateGeneralRequest translateGeneralRequest = new AlibabaCloud.SDK.Alimt20181012.Models.TranslateGeneralRequest();
            translateGeneralRequest.FormatType = "text";
            param.Lang = param.Lang.ToLower();
            if (param.Lang == "zh-cn" || param.Lang == "zh" || param.Lang == "cn")
            {
                param.Lang = "zh";
            }
            translateGeneralRequest.TargetLanguage = param.Lang;
            translateGeneralRequest.SourceLanguage = param.FromLang.DosIsNullOrWhiteSpace() ? "zh" : param.FromLang;
            translateGeneralRequest.Scene = "general";
            translateGeneralRequest.SourceText = param.SourceText;
            AlibabaCloud.TeaUtil.Models.RuntimeOptions runtime = new AlibabaCloud.TeaUtil.Models.RuntimeOptions();
            try
            {
                // 复制代码运行请自行打印 API 的返回值
                var result = client.TranslateGeneralWithOptions(translateGeneralRequest, runtime);
                if (result.StatusCode == 200)
                {
                    var translated = result.Body?.Data?.Translated;
                    if (translated.DosIsNullOrWhiteSpace())
                    {
                        return new DosResult(0, result, result.Body?.Message ?? "Aliyun translate returned empty translated text. Check TranslateKey, TranslateSecret and TranslateEndpoint.");
                    }
                    return new DosResult(1, translated);
                }
                else
                {
                    return new DosResult(0, result, result.Body?.Message ?? "Aliyun translate failed.");
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
            // catch (TeaException error)
            // {
            //     // 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
            //     // 错误 message
            //     Console.WriteLine(error.Message);
            //     // 诊断地址
            //     Console.WriteLine(error.Data["Recommend"]);
            //     AlibabaCloud.TeaUtil.Common.AssertAsString(error.Message);
            // }
            // catch (Exception _error)
            // {
            //     TeaException error = new TeaException(new Dictionary<string, object>
            //     {
            //         { "message", _error.Message }
            //     });
            //     // 此处仅做打印展示，请谨慎对待异常处理，在工程项目中切勿直接忽略异常。
            //     // 错误 message
            //     Console.WriteLine(error.Message);
            //     // 诊断地址
            //     Console.WriteLine(error.Data["Recommend"]);
            //     AlibabaCloud.TeaUtil.Common.AssertAsString(error.Message);
            // }
        }

        private List<TranslateProviderConfig> GetProviderConfigs(string osClient)
        {
            var configs = new List<TranslateProviderConfig>();
            AddProviderConfig(configs, osClient);

            return configs
                .Where(item => item != null && !item.Provider.DosIsNullOrWhiteSpace())
                .GroupBy(item => $"{item.Provider}|{item.Endpoint}|{item.Key}|{item.Url}", StringComparer.OrdinalIgnoreCase)
                .Select(item => item.First())
                .OrderBy(item => item.Provider == "libretranslate" || item.Provider == "http" ? 0 : 1)
                .ToList();
        }

        private static void AddProviderConfig(List<TranslateProviderConfig> configs, string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return;
            }

            try
            {
                var clientModel = OsClientExtend.GetClient(osClient);
                var config = clientModel?.OsClientModel;
                if (config == null)
                {
                    return;
                }

                var provider = config["TranslateProvider"].Val<string>();
                var endpoint = config["TranslateEndpoint"].Val<string>();
                var key = config["TranslateKey"].Val<string>();
                var secret = config["TranslateSecret"].Val<string>();
                var url = config["TranslateUrl"].Val<string>();
                if (url.DosIsNullOrWhiteSpace())
                {
                    url = config["TranslateApiUrl"].Val<string>();
                }
                if (url.DosIsNullOrWhiteSpace())
                {
                    url = config["LibreTranslateUrl"].Val<string>();
                }

                if (provider.DosIsNullOrWhiteSpace())
                {
                    provider = !url.DosIsNullOrWhiteSpace()
                        ? "LibreTranslate"
                        : (!endpoint.DosIsNullOrWhiteSpace()
                            && !key.DosIsNullOrWhiteSpace()
                            && !secret.DosIsNullOrWhiteSpace()
                                ? "Aliyun"
                                : "None");
                }

                provider = NormalizeProviderName(provider);
                if (provider == "none" || provider == "manual" || provider == "off" || provider == "disabled")
                {
                    return;
                }

                var apiKey = config["TranslateApiKey"].Val<string>();
                if (apiKey.DosIsNullOrWhiteSpace() && (provider == "libretranslate" || provider == "http"))
                {
                    apiKey = key;
                }

                configs.Add(new TranslateProviderConfig()
                {
                    Provider = provider,
                    Endpoint = endpoint,
                    Key = key,
                    Secret = secret,
                    Url = url,
                    ApiKey = apiKey,
                    Timeout = config["TranslateTimeout"].Val<int?>() ?? 10,
                    SourceOsClient = osClient
                });
            }
            catch
            {
            }
        }

        private static string NormalizeProviderName(string provider)
        {
            provider = (provider ?? "").Trim().ToLowerInvariant();
            if (provider == "aliyun" || provider == "ali" || provider == "alicloud" || provider == "alibaba" || provider == "alibabacloud" || provider == "阿里云")
            {
                return "aliyun";
            }
            if (provider == "libretranslate" || provider == "libre" || provider == "local" || provider == "本地" || provider == "本地翻译")
            {
                return "libretranslate";
            }
            if (provider == "http" || provider == "api" || provider == "custom" || provider == "自定义" || provider == "通用http")
            {
                return "http";
            }
            if (provider == "none" || provider == "manual" || provider == "off" || provider == "disabled" || provider == "关闭" || provider == "手动")
            {
                return "none";
            }
            return provider;
        }

        private DosResult TranslateByHttp(TranslateParam param, TranslateProviderConfig config)
        {
            var validated = ValidateTextInput(new MicroiTranslateTextParam
            {
                SourceText = param.SourceText,
                FromLang = param.FromLang,
                Lang = param.Lang,
                Format = "text",
                Alternatives = 0
            });
            if (validated.Code != 1)
                return new DosResult(validated.Code, param.SourceText, validated.Msg);
            var result = TranslateTextByLibre(new MicroiTranslateTextParam
            {
                OsClient = param.OsClient,
                SourceText = param.SourceText,
                FromLang = param.FromLang,
                Lang = param.Lang,
                Format = "text",
                Alternatives = 0
            }, validated.Data, config);
            return result.Code == 1
                ? new DosResult(1, result.Data.TranslatedText)
                : new DosResult(result.Code, param.SourceText, result.Msg);
        }

        private static bool TryResolveHttpTranslateTarget(string translateUrl, string target, TranslateProviderConfig config, out string resolvedTarget, out string message)
        {
            message = "";
            resolvedTarget = NormalizeHttpTranslateLang(target);
            if (translateUrl.DosIsNullOrWhiteSpace() || target.DosIsNullOrWhiteSpace())
            {
                return true;
            }

            var baseUrl = NormalizeHttpTranslateBaseUrl(translateUrl);
            if (baseUrl.DosIsNullOrWhiteSpace())
            {
                return true;
            }

            var cacheKey = $"{config?.SourceOsClient}|{baseUrl}|{HashSensitive(config?.ApiKey)}";
            if (HttpTranslateLanguageCache.TryGetValue(cacheKey, out var cached)
                && HttpTranslateLanguageCacheAt.TryGetValue(cacheKey, out var cachedAt)
                && (DateTime.UtcNow - cachedAt).TotalHours < 1)
            {
                return TryResolveTargetInLanguageCache(cached, target, out resolvedTarget, out message);
            }

            try
            {
                using (var cancellation = new System.Threading.CancellationTokenSource(
                           TimeSpan.FromSeconds(Math.Max(1, Math.Min(config?.Timeout ?? 5, 5)))) )
                {
                    var languagesUrl = baseUrl.TrimEnd('/') + "/languages";
                    using (var response = LibreHttpClient.GetAsync(languagesUrl, cancellation.Token).ConfigureAwait(false).GetAwaiter().GetResult())
                    {
                        if (!response.IsSuccessStatusCode)
                        {
                            return true;
                        }
                        var responseText = response.Content.ReadAsStringAsync().ConfigureAwait(false).GetAwaiter().GetResult();
                        var supportedTargets = ParseHttpTranslateLanguages(responseText);
                        if (supportedTargets.Count == 0)
                        {
                            return true;
                        }
                        var cacheValue = "|" + string.Join("|", supportedTargets.OrderBy(item => item)) + "|";
                        HttpTranslateLanguageCache[cacheKey] = cacheValue;
                        HttpTranslateLanguageCacheAt[cacheKey] = DateTime.UtcNow;
                        return TryResolveTargetInLanguageCache(cacheValue, target, out resolvedTarget, out message);
                    }
                }
            }
            catch
            {
                return true;
            }
        }

        private static bool TryResolveTargetInLanguageCache(string cached, string target, out string resolvedTarget, out string message)
        {
            target = NormalizeHttpTranslateLang(target);
            resolvedTarget = target;
            var aliases = GetHttpTranslateLangAliases(target);
            foreach (var alias in aliases)
            {
                if ((cached ?? "").IndexOf("|" + alias + "|", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    resolvedTarget = alias;
                    message = "";
                    return true;
                }
            }
            message = $"HTTP translate target language unsupported: {target}.";
            return false;
        }

        private static HashSet<string> ParseHttpTranslateLanguages(string responseText)
        {
            var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (responseText.DosIsNullOrWhiteSpace())
            {
                return result;
            }
            try
            {
                var token = JToken.Parse(responseText);
                foreach (var item in token.SelectTokens("$..code"))
                {
                    var rawCode = (item?.ToString() ?? "").Trim();
                    if (!rawCode.DosIsNullOrWhiteSpace())
                    {
                        result.Add(rawCode);
                    }
                    var code = NormalizeHttpTranslateLang(rawCode);
                    if (!code.DosIsNullOrWhiteSpace())
                    {
                        result.Add(code);
                    }
                }
                foreach (var item in token.SelectTokens("$..targets[*]"))
                {
                    var rawCode = (item?.ToString() ?? "").Trim();
                    if (!rawCode.DosIsNullOrWhiteSpace())
                    {
                        result.Add(rawCode);
                    }
                    var code = NormalizeHttpTranslateLang(rawCode);
                    if (!code.DosIsNullOrWhiteSpace())
                    {
                        result.Add(code);
                    }
                }
            }
            catch
            {
            }
            return result;
        }

        private static IEnumerable<string> GetHttpTranslateLangAliases(string lang)
        {
            lang = NormalizeHttpTranslateLang(lang);
            if (lang == "zh")
            {
                yield return "zh";
                yield return "zh-CN";
                yield return "cn";
                yield return "zh-Hans";
            }
            else if (lang == "zt")
            {
                yield return "zt";
                yield return "zh-Hant";
                yield return "zh-TW";
                yield return "zh-HK";
                yield return "tw";
            }
            else if (lang == "my")
            {
                yield return "my";
                yield return "mm";
                yield return "burmese";
            }
            else
            {
                yield return lang;
            }
        }

        private static string NormalizeHttpTranslateLang(string lang)
        {
            var normalized = DiyMessage.NormalizeTranslateLang(lang);
            if (normalized == "zh" || normalized == "cn" || normalized == "zh-cn")
            {
                return "zh";
            }
            if (normalized == "zh-tw" || normalized == "zh-hk")
            {
                return "zt";
            }
            if (normalized == "zt")
            {
                return "zt";
            }
            return normalized;
        }

        private static string NormalizeHttpTranslateUrl(string url)
        {
            if (url.DosIsNullOrWhiteSpace())
            {
                return "";
            }
            var normalized = url.Trim().TrimEnd('/');
            return normalized.EndsWith("/translate", StringComparison.OrdinalIgnoreCase)
                ? normalized
                : normalized + "/translate";
        }

        private static string NormalizeHttpTranslateBaseUrl(string url)
        {
            if (url.DosIsNullOrWhiteSpace())
            {
                return "";
            }
            var normalized = url.Trim().TrimEnd('/');
            return normalized.EndsWith("/translate", StringComparison.OrdinalIgnoreCase)
                ? normalized.Substring(0, normalized.Length - "/translate".Length)
                : normalized;
        }
    }
}
