using System;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8EngineMethodExtend
    {
        /// <summary>
        /// 扩展 V8.Method.TestExtend 方法
        /// </summary>
        /// <param name="testParam"></param>
        /// <returns></returns>
        public string TestExtend(string testParam)
        {
            return "V8.Method.TestExtend：" + testParam;
        }
        /// <summary>
        /// 测试故意抛出异常
        /// </summary>
        /// <param name="testParam"></param>
        /// <returns></returns>
        public JObject TestException()
        {
            return JObject.FromObject(null);
        }

        #region 加密签名辅助函数

        /// <summary>
        /// HMAC-SHA1 签名（返回 Base64 编码）
        /// 用于解决 Jint 无法直接实例化 HMACSHA1 的问题
        /// </summary>
        /// <param name="data">待签名的数据</param>
        /// <param name="key">签名密钥</param>
        /// <returns>Base64 编码的签名字符串</returns>
        public string HmacSha1Sign(string data, string key)
        {
            using (var hmac = new HMACSHA1(Encoding.UTF8.GetBytes(key)))
            {
                var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
                return Convert.ToBase64String(hashBytes);
            }
        }

        /// <summary>
        /// HMAC-SHA256 签名（返回 Base64 编码）
        /// </summary>
        /// <param name="data">待签名的数据</param>
        /// <param name="key">签名密钥</param>
        /// <returns>Base64 编码的签名字符串</returns>
        public string HmacSha256Sign(string data, string key)
        {
            using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key)))
            {
                var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
                return Convert.ToBase64String(hashBytes);
            }
        }

        /// <summary>
        /// MD5 签名（返回 Base64 编码）
        /// </summary>
        /// <param name="data">待签名的数据</param>
        /// <returns>Base64 编码的 MD5 字符串</returns>
        public string Md5Sign(string data)
        {
            using (var md5 = MD5.Create())
            {
                var hashBytes = md5.ComputeHash(Encoding.UTF8.GetBytes(data));
                return Convert.ToBase64String(hashBytes);
            }
        }

        /// <summary>
        /// MD5 签名（返回十六进制字符串）
        /// </summary>
        /// <param name="data">待签名的数据</param>
        /// <returns>十六进制 MD5 字符串</returns>
        public string Md5SignHex(string data)
        {
            using (var md5 = MD5.Create())
            {
                var hashBytes = md5.ComputeHash(Encoding.UTF8.GetBytes(data));
                return BitConverter.ToString(hashBytes).Replace("-", "").ToLower();
            }
        }

        #endregion

        #region JSON 序列化函数

        /// <summary>
        /// JSON 序列化（解决 Jint 的 JSON.stringify 将整数转为浮点格式的问题）
        /// 使用 Newtonsoft.Json 进行序列化，保持整数格式
        /// </summary>
        /// <param name="obj">待序列化的对象</param>
        /// <returns>JSON 字符串</returns>
        public string JsonStringify(object obj)
        {
            return JsonConvert.SerializeObject(obj, new JsonSerializerSettings
            {
                // 不格式化输出（紧凑格式）
                Formatting = Formatting.None,
                // 忽略 null 值
                NullValueHandling = NullValueHandling.Ignore,
                // 保持默认值
                DefaultValueHandling = DefaultValueHandling.Include
            });
        }

        /// <summary>
        /// JSON 序列化（带格式化）
        /// </summary>
        /// <param name="obj">待序列化的对象</param>
        /// <returns>格式化的 JSON 字符串</returns>
        public string JsonStringifyIndented(object obj)
        {
            return JsonConvert.SerializeObject(obj, Formatting.Indented);
        }

        #endregion
    }
}