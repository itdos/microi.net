using System;
using System.Collections;
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
            if (lang == "zh-cn" || lang == "zh" || lang == "cn")
            {
                return jObj["ZhCN"]?.ToString() ?? key;
            }
            else if (lang == "en")
            {
                return jObj["En"]?.ToString() ?? key;
            }
            else if (lang == "zh-tw")
            {
                return jObj["ZhTW"]?.ToString() ?? key;
            }
            return jObj[lang]?.ToString() ?? key;
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
