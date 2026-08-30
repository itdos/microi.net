using System;
using Dos.Common;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;
using RestSharp;
using System.Collections.Generic;

namespace Microi.net
{
    public class V8EngineTranslate
    {
        public TranslateParam DynamicToParam(dynamic dynamicParam)
        {
            JObject jobjParam = JsonHelper.ToJObject(dynamicParam);
            TranslateParam param = jobjParam.ToObject<TranslateParam>(DiyCommon.GetJsonSerializer());//这里时间格式化没有用
            return param;
        }
        public DosResult Translate(dynamic dynamicParam)
        {
            TranslateParam param = DynamicToParam(dynamicParam);
            return MicroiEngine.Translate.Translate(param);
        }
        public DosResult Translate(string sourceText, string lang)
        {
            TranslateParam param = new TranslateParam();
            param.SourceText = sourceText;
            param.Lang = lang;
            return MicroiEngine.Translate.Translate(param);
        }
        public DosResult Translate(object sourceText, object lang)
        {
            return Translate(ToV8String(sourceText), ToV8String(lang));
        }
        public DosResult Translate(string sourceText, string lang, string fromLangOrOsClient)
        {
            TranslateParam param = new TranslateParam();
            param.SourceText = sourceText;
            param.Lang = lang;
            if (LooksLikeLang(fromLangOrOsClient))
            {
                param.FromLang = fromLangOrOsClient;
            }
            else
            {
                param.OsClient = fromLangOrOsClient;
            }
            return MicroiEngine.Translate.Translate(param);
        }
        public DosResult Translate(object sourceText, object lang, object fromLangOrOsClient)
        {
            return Translate(ToV8String(sourceText), ToV8String(lang), ToV8String(fromLangOrOsClient));
        }
        public DosResult Translate(string sourceText, string lang, string fromLang, string osClient)
        {
            TranslateParam param = new TranslateParam();
            param.SourceText = sourceText;
            param.Lang = lang;
            param.FromLang = fromLang;
            param.OsClient = osClient;
            return MicroiEngine.Translate.Translate(param);
        }
        public DosResult Translate(object sourceText, object lang, object fromLang, object osClient)
        {
            return Translate(ToV8String(sourceText), ToV8String(lang), ToV8String(fromLang), ToV8String(osClient));
        }
        public DosResult<MicroiTranslateTextResult> TranslateText(MicroiTranslateTextParam param)
        {
            return MicroiEngine.Translate.TranslateText(param);
        }
        public DosResult<List<MicroiTranslateDetection>> Detect(MicroiTranslateDetectParam param)
        {
            return MicroiEngine.Translate.Detect(param);
        }
        public DosResult<List<MicroiTranslateLanguage>> GetLanguages(string osClient = "")
        {
            return MicroiEngine.Translate.GetLanguages(osClient);
        }
        public DosResult<MicroiTranslateFileResult> TranslateFile(MicroiTranslateFileParam param)
        {
            return MicroiEngine.Translate.TranslateFile(param);
        }
        public DosResult<MicroiTranslateSuggestionResult> Suggest(MicroiTranslateSuggestParam param)
        {
            return MicroiEngine.Translate.Suggest(param);
        }
        public DosResult<MicroiTranslateHealthResult> Health(string osClient = "")
        {
            return MicroiEngine.Translate.Health(osClient);
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
                || value == "zh-tw"
                || value == "tw"
                || value == "en"
                || value == "en-us"
                || value == "en-gb"
                || value == "ja"
                || value == "jp"
                || value == "ko"
                || value == "fr"
                || value == "de"
                || value == "es"
                || value == "ru";
        }
        public string GetLang(string key, string lang = "cn", string osClient = "")
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }
            return DiyMessage.GetLang(osClient, key, lang);
        }
        public JObject GetLangData(string key, string osClient = "")
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }
            if (!osClient.DosIsNullOrWhiteSpace()
                && DiyMessage.Msg.TryGetValue(osClient, out var clientMsg)
                && clientMsg != null
                && clientMsg.TryGetValue(key, out var row))
            {
                return row;
            }
            return null;
        }
        public string GetLangCode(string key, string osClient = "")
        {
            // if (key.DosIsNullOrWhiteSpace())
            // {
            //     return key;
            // }
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }
            if (!osClient.DosIsNullOrWhiteSpace()
                && DiyMessage.Msg.TryGetValue(osClient, out var clientMsg)
                && clientMsg != null
                && clientMsg.TryGetValue(key, out var jObj))
            {
                return jObj["Code"]?.ToString() ?? key;
            }
            return key;
        }
        public DosResult LoadLang(string osClient = "")
        {
            #region 加载多语言
            try
            {
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = DiyToken.GetCurrentOsClient();
                }
                var clientModel = OsClientExtend.GetClient(osClient);
                var langList = clientModel.Db.FromSql("select * from diy_lang").ToList<dynamic>();
                var langLevel2 = new Dictionary<string, JObject>(StringComparer.OrdinalIgnoreCase);
                foreach (var item in langList)
                {
                    JObject itemObj = JObject.FromObject(item);
                    var key = itemObj["Key"]?.ToString()?.Trim();
                    if (key.DosIsNullOrWhiteSpace())
                    {
                        continue;
                    }
                    langLevel2[key] = itemObj;
                }
                DiyMessage.ReplaceTenantMessages(osClient, langLevel2);
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
            #endregion
        }
        public DosResult UptLang(string key, dynamic value, string osClient = "")
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }
            if (key.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(osClient, "ParamError"));
            }
            #region 加载多语言
            try
            {
                DiyMessage.UpsertTenantMessage(osClient, key, JObject.FromObject(value));
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
            #endregion
        }
        public DosResult UptDiyLang(object key, object value, object osClient = null)
        {
            var langKey = ToV8String(key);
            if (langKey.DosIsNullOrWhiteSpace())
            {
                return new DosResult(1);
            }
            return UptLang(langKey, value, ToV8String(osClient));
        }
    }
}
