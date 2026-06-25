using System;
using System.Collections;
using System.Collections.Concurrent;
using System.Collections.Generic;
using Acornima;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public static partial class DiyMessage
    {
        /// <summary>
        /// 默认语言
        /// </summary>
        public const string Lang = "cn";
        /// <summary>
        /// 多语言集合
        /// </summary>
        public static Dictionary<string, Dictionary<string, JObject>> Msg = new Dictionary<string, Dictionary<string, JObject>>();
        private static readonly ConcurrentDictionary<string, string> SourceTextLangCache = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        private static readonly Dictionary<string, JObject> BuiltInMsg = new Dictionary<string, JObject>(StringComparer.OrdinalIgnoreCase)
        {
            { "TableName", JObject.FromObject(new { ZhCN = "表名", En = "Table", ZhTW = "表名" }) },
            { "TableId", JObject.FromObject(new { ZhCN = "表ID", En = "Table ID", ZhTW = "表ID" }) },
            { "Condition", JObject.FromObject(new { ZhCN = "条件", En = "Condition", ZhTW = "條件" }) },
            { "Where", JObject.FromObject(new { ZhCN = "条件", En = "Condition", ZhTW = "條件" }) },
            { "Param", JObject.FromObject(new { ZhCN = "参数", En = "Parameters", ZhTW = "參數" }) },
            { "Parameter", JObject.FromObject(new { ZhCN = "参数", En = "Parameters", ZhTW = "參數" }) },
            { "Id", JObject.FromObject(new { ZhCN = "主键", En = "ID", ZhTW = "主鍵" }) },
            { "FieldId", JObject.FromObject(new { ZhCN = "字段ID", En = "Field ID", ZhTW = "欄位ID" }) },
            { "FieldName", JObject.FromObject(new { ZhCN = "字段名", En = "Field", ZhTW = "欄位名" }) }
        };

        public static string GetLang(string osClient, string key, string lang = "cn")
        {
            // if (key.DosIsNullOrWhiteSpace())
            // {
            //     return key;
            // }
            if (key.DosIsNullOrWhiteSpace())
            {
                return key;
            }
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }
            lang = (lang ?? Lang).ToLower();
            try
            {
                if (!osClient.DosIsNullOrWhiteSpace()
                    && Msg.Count > 0
                    && Msg.TryGetValue(osClient, out var clientMsg)
                    && clientMsg != null
                    && clientMsg.TryGetValue(key, out var jObj))
                {
                    return GetJObjectLang(jObj, key, lang);
                }
            }
            catch (System.Exception)
            {
                // ignore and try built-in messages
            }
            return GetBuiltInLang(key, lang);
        }

        public static JObject GetLangBundle(string osClient, string lang = "cn", string prefix = "")
        {
            var result = new JObject();
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }
            lang = (lang ?? Lang).ToLower();
            try
            {
                if (!osClient.DosIsNullOrWhiteSpace()
                    && Msg.TryGetValue(osClient, out var clientMsg)
                    && clientMsg != null)
                {
                    foreach (var item in clientMsg)
                    {
                        if (!prefix.DosIsNullOrWhiteSpace()
                            && !item.Key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                        {
                            continue;
                        }
                        var value = GetJObjectLang(item.Value, item.Key, lang);
                        if (!value.DosIsNullOrWhiteSpace())
                        {
                            result[item.Key] = value;
                        }
                    }
                }
                foreach (var item in BuiltInMsg)
                {
                    if (!prefix.DosIsNullOrWhiteSpace()
                        && !item.Key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    if (result[item.Key] != null)
                    {
                        continue;
                    }
                    result[item.Key] = GetJObjectLang(item.Value, item.Key, lang);
                }
            }
            catch (System.Exception)
            {
            }
            return result;
        }

        public static bool TryGetLang(string osClient, string key, string lang, out string value)
        {
            value = null;
            if (key.DosIsNullOrWhiteSpace())
            {
                return false;
            }
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }
            lang = (lang ?? Lang).ToLower();
            try
            {
                if (!osClient.DosIsNullOrWhiteSpace()
                    && Msg.Count > 0
                    && Msg.TryGetValue(osClient, out var clientMsg)
                    && clientMsg != null
                    && clientMsg.TryGetValue(key, out var jObj))
                {
                    value = GetJObjectLang(jObj, key, lang);
                    return !value.DosIsNullOrWhiteSpace() && value != key;
                }
            }
            catch (System.Exception)
            {
                return false;
            }
            return false;
        }

        public static bool TryGetLangBySourceText(string osClient, string sourceText, string lang, out string value)
        {
            value = null;
            if (sourceText.DosIsNullOrWhiteSpace() || IsDefaultLang(lang))
            {
                return false;
            }
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }
            var langField = NormalizeLangField(lang);
            var normalizedSource = sourceText.Trim();
            var cacheKey = string.Concat(osClient ?? "", "|", langField, "|", normalizedSource);
            if (SourceTextLangCache.TryGetValue(cacheKey, out var cachedValue))
            {
                if (cachedValue.DosIsNullOrWhiteSpace())
                {
                    return false;
                }
                value = cachedValue;
                return true;
            }
            try
            {
                if (!osClient.DosIsNullOrWhiteSpace()
                    && Msg.TryGetValue(osClient, out var clientMsg)
                    && TryGetLangBySourceText(clientMsg, normalizedSource, lang, out value))
                {
                    SourceTextLangCache[cacheKey] = value;
                    return true;
                }
                if (TryGetLangBySourceText(BuiltInMsg, normalizedSource, lang, out value))
                {
                    SourceTextLangCache[cacheKey] = value;
                    return true;
                }
            }
            catch (System.Exception)
            {
                SourceTextLangCache[cacheKey] = "";
                return false;
            }
            SourceTextLangCache[cacheKey] = "";
            return false;
        }

        public static void ClearSourceTextCache(string osClient = "")
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                SourceTextLangCache.Clear();
                return;
            }
            var prefix = osClient + "|";
            foreach (var key in SourceTextLangCache.Keys)
            {
                if (key.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                {
                    SourceTextLangCache.TryRemove(key, out _);
                }
            }
        }

        private static bool TryGetLangBySourceText(Dictionary<string, JObject> langRows, string sourceText, string lang, out string value)
        {
            value = null;
            if (langRows == null || sourceText.DosIsNullOrWhiteSpace())
            {
                return false;
            }
            foreach (var item in langRows)
            {
                var row = item.Value;
                if (row == null)
                {
                    continue;
                }
                var zhCn = row["ZhCN"]?.ToString()?.Trim();
                var code = row["Code"]?.ToString()?.Trim();
                var key = row["Key"]?.ToString()?.Trim();
                if (!string.Equals(zhCn, sourceText, StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(code, sourceText, StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(key, sourceText, StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(item.Key, sourceText, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                value = GetJObjectLang(row, item.Key, lang);
                return !value.DosIsNullOrWhiteSpace() && !string.Equals(value, sourceText, StringComparison.OrdinalIgnoreCase);
            }
            return false;
        }

        public static string NormalizeLangField(string lang)
        {
            lang = (lang ?? Lang).Trim().ToLower();
            if (lang == "zh-cn" || lang == "zh" || lang == "cn")
            {
                return "ZhCN";
            }
            if (lang == "en" || lang == "en-us" || lang == "en-gb")
            {
                return "En";
            }
            if (lang == "zh-tw" || lang == "zh-hk" || lang == "tw")
            {
                return "ZhTW";
            }
            if (lang == "my" || lang == "my-mm" || lang == "burmese" || lang == "myanmar" || lang == "缅甸语")
            {
                return "My";
            }
            return lang;
        }

        public static string NormalizeTranslateLang(string lang)
        {
            lang = (lang ?? Lang).Trim().ToLower();
            if (lang == "zhcn" || lang == "zh-cn" || lang == "zh" || lang == "cn")
            {
                return "zh";
            }
            if (lang == "zhtw" || lang == "zh-tw" || lang == "zh-hk" || lang == "tw")
            {
                return "zh-tw";
            }
            if (lang == "my" || lang == "my-mm" || lang == "burmese" || lang == "myanmar" || lang == "缅甸语")
            {
                return "my";
            }
            return lang;
        }

        public static bool IsDefaultLang(string lang)
        {
            return NormalizeLangField(lang) == "ZhCN";
        }

        private static string GetBuiltInLang(string key, string lang)
        {
            if (BuiltInMsg.TryGetValue(key, out var jObj))
            {
                return GetJObjectLang(jObj, key, lang);
            }
            return key;
        }

        private static string GetJObjectLang(JObject jObj, string key, string lang)
        {
            var langField = NormalizeLangField(lang);
            if (langField == "ZhCN")
            {
                return jObj["ZhCN"]?.ToString() ?? key;
            }
            else if (langField == "En")
            {
                return jObj["En"]?.ToString() ?? key;
            }
            else if (langField == "ZhTW")
            {
                return jObj["ZhTW"]?.ToString() ?? key;
            }
            return jObj[langField]?.ToString() ?? key;
        }
        public static string GetLangCode(string osClient, string key)
        {
            // if (key.DosIsNullOrWhiteSpace())
            // {
            //     return key;
            // }
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }
            try
            {
                var jObj = Msg[osClient][key];
                return jObj["Code"]?.ToString() ?? key;
            }
            catch (System.Exception)
            {
                return "0";
            }
        }
    }
}
