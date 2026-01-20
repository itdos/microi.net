using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Dos.Common.Helper;
using Newtonsoft.Json.Linq;

namespace Dos.Common
{
    /// <summary>
    /// 通用扩展
    /// </summary>
    public static class CommonExpand
    {
        #region string
        public static string SHA512(this string input)
        {
            if (string.IsNullOrEmpty(input))
                return string.Empty;

            using (var sha = System.Security.Cryptography.SHA512.Create())
            {
                var bytes = Encoding.UTF8.GetBytes(input);
                var hash = sha.ComputeHash(bytes);
                return Convert.ToBase64String(hash);
            }
        }
        public static string SHA256(this string input)
        {
            if (string.IsNullOrEmpty(input))
                return string.Empty;

            using (var sha = System.Security.Cryptography.SHA256.Create())
            {
                var bytes = Encoding.UTF8.GetBytes(input);
                var hash = sha.ComputeHash(bytes);
                return Convert.ToBase64String(hash);
            }
        }
        public static List<string> SplitCsv(this string csvList, bool nullOrWhitespaceInputReturnsNull = false)
        {
            if (string.IsNullOrWhiteSpace(csvList))
                return nullOrWhitespaceInputReturnsNull ? null : new List<string>();

            return csvList
                .TrimEnd(',')
                .DosSplit(',')
                .AsEnumerable<string>()
                .Select(s => s.Trim())
                .ToList();
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static string DosTrim(this string str)
        {
            if (str != null)
            {
                return str.Trim();
            }
            return null;
        }
        public static bool DosContains(this string str, string value)
        {
            if (str != null)
            {
                return str.Contains(value);
            }
            return false;
        }
        public static string[] DosSplit(this string str, char value, StringSplitOptions options = StringSplitOptions.None)
        {
            if (str != null)
            {
                return str.Split(value, options);
            }
            return new string[0];
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static bool DosIsNullOrWhiteSpace(this string str)
        {
            return string.IsNullOrWhiteSpace(str);
        }
        public static string DosToLower(this string str)
        {
            if(str == null){
                return null;
            }
            return str.ToLower();
        }
        /// <summary>
        /// 原字符串若为null或空字符串，返回defaultValue参数。反之返回原字符串。
        /// </summary>
        public static string DosIsNullOrWhiteSpace(this string value, string defaultValue)
        => string.IsNullOrWhiteSpace(value) ? defaultValue : value;
        /// <summary>
        /// 
        /// </summary>
        /// <param name="str"></param>
        /// <param name="trimChars"></param>
        /// <returns></returns>
        public static string DosTrim(this string str, params char[] trimChars)
        {
            if (str != null)
            {
                return str.Trim(trimChars);
            }
            return null;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="str"></param>
        /// <param name="trimChars"></param>
        /// <returns></returns>
        public static string DosReplace(this string str, string str1, string str2)
        {
            if (str != null)
            {
                return str.Replace(str1, str2);
            }
            return null;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="str"></param>
        /// <param name="trimChars"></param>
        /// <returns></returns>
        public static string DosTrimStart(this string str, params char[] trimChars)
        {
            if (str != null)
            {
                return str.TrimStart(trimChars);
            }
            return null;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="str"></param>
        /// <param name="trimChars"></param>
        /// <returns></returns>
        public static string DosTrimEnd(this string str, params char[] trimChars)
        {
            if (str != null)
            {
                return str.TrimEnd(trimChars);
            }
            return null;
        }
        /// <summary>
        /// 是否是Guid
        /// </summary>
        /// <Param name="key"></Param>
        /// <returns></returns>
        public static bool DosIsGuid(this string key)
        {
            Guid g;
            return Guid.TryParse(key, out g);
        }
        /// <summary>
        /// 获取字节数
        /// str：需要获取的字符串
        /// </summary>
        public static int DosLength(this string str)
        {
            return StringHelper.Length(str);
        }
        /// <summary>
        /// 按字节数截取指定字节
        /// </summary>
        /// <Param name="str">需要获取的字符串</Param>
        /// <Param name="length">获取的字节长度</Param>
        /// <returns></returns>
        public static string DosSubString(this string str, int length)
        {
            return StringHelper.SubString(str, length);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        public static bool DosIsMobilePhone(this string str)
        {
            return RegexHelper.IsMobilePhone(str);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="email"></param>
        /// <returns></returns>
        public static bool DosIsEmail(this string email)
        {
            return RegexHelper.IsEmail(email);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="idCard"></param>
        /// <returns></returns>
        public static bool DosIsIdCard(this string idCard)
        {
            return RegexHelper.IsIdCard(idCard);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="ip"></param>
        /// <returns></returns>
        public static bool DosIsIp(this string ip)
        {
            return RegexHelper.IsIP(ip);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="strUrl"></param>
        /// <returns></returns>
        public static bool DosIsUrl(this string strUrl)
        {
            return RegexHelper.IsUrl(strUrl);
        }
        public static string DosFileSize(this long length)
        {
            return FileHelper.GetFileSize(length);
        }
        ///  <summary>
        ///  去除HTML标记  
        ///  </summary>   
        ///  <param name="htmlString">包括HTML的源码</param>   
        ///  <returns>已经去除后的文字</returns>   
        public static string DosRemoveHtml(this string htmlString)
        {
            return RegexHelper.RemoveHtml(htmlString);
        }

        #endregion

        #region MemberInfo
        private static Dictionary<MemberInfo, Object> _micache1 = new Dictionary<MemberInfo, Object>();
        private static Dictionary<MemberInfo, Object> _micache2 = new Dictionary<MemberInfo, Object>();
        /// <summary>
        /// 获取自定义特性，带有缓存功能，避免因.Net内部GetCustomAttributes没有缓存而带来的损耗
        /// </summary>
        /// <typeparam name="TAttribute"></typeparam>
        /// <param name="member"></param>
        /// <param name="inherit"></param>
        /// <returns></returns>
        public static TAttribute[] DosGetCustomAttributes<TAttribute>(this MemberInfo member, Boolean inherit)
        {
            if (member == null) return new TAttribute[0];

            // 根据是否可继承，分属两个缓存集合
            var cache = inherit ? _micache1 : _micache2;

            object obj = null;
            if (cache.TryGetValue(member, out obj)) return (TAttribute[])obj;
            lock (cache)
            {
                if (cache.TryGetValue(member, out obj)) return (TAttribute[])obj;

                var atts = member.GetCustomAttributes(typeof(TAttribute), inherit) as TAttribute[];
                var att = atts ?? new TAttribute[0];
                cache[member] = att;
                return att;
            }
        }
        /// <summary>获取自定义属性</summary>
        /// <typeparam name="TAttribute"></typeparam>
        /// <param name="member"></param>
        /// <param name="inherit"></param>
        /// <returns></returns>
        public static TAttribute DosGetCustomAttribute<TAttribute>(this MemberInfo member, Boolean inherit)
        {
            var atts = member.DosGetCustomAttributes<TAttribute>(inherit);
            if (atts == null || atts.Length < 1) return default(TAttribute);
            return atts[0];
        }
        #endregion

        #region JToken
        /// <summary>
        /// 安全地获取 JToken 的值，如果 JToken 为 null 或值为 null 则返回默认值
        /// </summary>
        public static T Val<T>(this JToken token)
        {
            if (token == null || token.Type == JTokenType.Null)
            {
                return default(T);
            }
            try
            {
                return token.ToObject<T>();
            }
            catch (System.Exception ex)
            {
                Console.WriteLine($"Microi：【警告】JToken.Val<{typeof(T).Name}>() 转换失败: {ex.Message}");
                return default(T);
            }
        }
        /// <summary>
        /// 安全地将对象转换为 JToken，如果对象为 null 则返回 JValue.CreateNull()
        /// </summary>
        public static JToken ToJToken(this object value)
        {
            if (value == null)
            {
                return JValue.CreateNull();
            }
            try
            {
                return JTokenEx.FromObject(value);
            }
            catch (System.Exception ex)
            {
                Console.WriteLine($"Microi：【警告】ToJToken() 转换失败: {ex.Message}");
                return JValue.CreateNull();
            }
        }
        
        #endregion
    }

    /// <summary>
    /// JToken 静态帮助类
    /// </summary>
    public static class JTokenEx
    {
        /// <summary>
        /// 安全地将对象转换为 JToken，如果对象为 null 则返回 JValue.CreateNull()
        /// 用法: JTokenEx.FromObj(colValue)
        /// </summary>
        public static JToken FromObj(object value)
        {
            if (value == null)
            {
                return null;
                return JValue.CreateNull();
            }
            try
            {
                return JToken.FromObject(value);
            }
            catch (System.Exception ex)
            {
                Console.WriteLine($"Microi：【警告】JTokenEx.FromObj() 转换失败: {ex.Message}");
                return null;
                return JValue.CreateNull();
            }
        }
        public static JToken FromObject(object value)
        {
            return FromObj(value);
        }
    }
}