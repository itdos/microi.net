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

        public static string GetLang(string osClient, string key, string lang = "cn")
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
                lang = lang.ToLower();
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
            catch (System.Exception)
            {
                return key;
            }
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