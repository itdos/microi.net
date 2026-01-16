#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：JsonHelper
* Copyright(c) www.microi.net
* CLR 版本: .NET Standard 2.1
* 创 建 人：Microi
* 电子邮箱：admin@microi.net
* 创建日期：2026/01/14
* 文件描述：JSON 序列化/反序列化工具类
*           使用 Newtonsoft.Json
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Dos.Common
{
    /// <summary>
    /// JSON 序列化/反序列化工具类
    /// 使用 Newtonsoft.Json
    /// </summary>
    public static class JsonHelper
    {
        /// <summary>
        /// 默认 JSON 序列化设置
        /// </summary>
        private static readonly JsonSerializerSettings _defaultSettings = new JsonSerializerSettings
        {
            DateFormatString = "yyyy-MM-dd HH:mm:ss",
            NullValueHandling = NullValueHandling.Ignore,
            ReferenceLoopHandling = ReferenceLoopHandling.Ignore
        };

        /// <summary>
        /// 带缩进的 JSON 序列化设置
        /// </summary>
        private static readonly JsonSerializerSettings _indentedSettings = new JsonSerializerSettings
        {
            DateFormatString = "yyyy-MM-dd HH:mm:ss",
            NullValueHandling = NullValueHandling.Ignore,
            ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
            Formatting = Formatting.Indented
        };

        /// <summary>
        /// 序列化对象为 JSON 字符串
        /// </summary>
        /// <typeparam name="T">对象类型</typeparam>
        /// <param name="obj">要序列化的对象</param>
        /// <param name="indented">是否格式化输出（默认否）</param>
        /// <returns>JSON 字符串</returns>
        public static string Serialize<T>(T obj, bool indented = false)
        {
            if (obj == null) return null;
            
            try
            {
                return JsonConvert.SerializeObject(obj, 
                    indented ? _indentedSettings : _defaultSettings);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 序列化对象为 JSON 字符串（非泛型版本）
        /// </summary>
        /// <param name="obj">要序列化的对象</param>
        /// <param name="indented">是否格式化输出</param>
        /// <returns>JSON 字符串</returns>
        public static string Serialize(object obj, bool indented = false)
        {
            if (obj == null) return null;
            
            try
            {
                return JsonConvert.SerializeObject(obj, 
                    indented ? _indentedSettings : _defaultSettings);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 反序列化 JSON 字符串为对象
        /// </summary>
        /// <typeparam name="T">目标类型</typeparam>
        /// <param name="json">JSON 字符串</param>
        /// <returns>反序列化后的对象</returns>
        public static T Deserialize<T>(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return default;

            try
            {
                return JsonConvert.DeserializeObject<T>(json);
            }
            catch
            {
                return default;
            }
        }

        /// <summary>
        /// 反序列化 JSON 字符串为对象（非泛型版本）
        /// </summary>
        /// <param name="json">JSON 字符串</param>
        /// <param name="type">目标类型</param>
        /// <returns>反序列化后的对象</returns>
        public static object Deserialize(string json, Type type)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            
            try
            {
                return JsonConvert.DeserializeObject(json, type);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 尝试序列化，失败返回 null
        /// </summary>
        public static string TrySerialize<T>(T obj)
        {
            try
            {
                return Serialize(obj);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 尝试反序列化，失败返回默认值
        /// </summary>
        public static T TryDeserialize<T>(string json, T defaultValue = default)
        {
            try
            {
                var result = Deserialize<T>(json);
                return result == null ? defaultValue : result;
            }
            catch
            {
                return defaultValue;
            }
        }

        /// <summary>
        /// 安全地将 dynamic 对象转换为 JObject
        /// </summary>
        public static JObject ToJObject(dynamic obj)
        {
            if (obj == null) return null;

            // 如果已经是 JObject，直接返回
            if (obj is JObject jobj)
            {
                return jobj;
            }

            // 尝试直接转换
            try
            {
                return JObject.FromObject(obj);
            }
            catch
            {
                // 最后尝试：序列化再反序列化
                try
                {
                    var jsonStr = Serialize(obj);
                    return JObject.Parse(jsonStr);
                }
                catch (Exception ex)
                {
                    throw new Exception($"无法将对象转换为 JObject: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// 安全地将 dynamic 对象转换为 JArray
        /// </summary>
        public static JArray ToJArray(dynamic obj)
        {
            if (obj == null) return null;

            // 如果已经是 JArray，直接返回
            if (obj is JArray jarray)
            {
                return jarray;
            }

            // 尝试直接转换
            try
            {
                return JArray.FromObject(obj);
            }
            catch
            {
                // 最后尝试：序列化再反序列化
                try
                {
                    var jsonStr = Serialize(obj);
                    return JArray.Parse(jsonStr);
                }
                catch (Exception ex)
                {
                    throw new Exception($"无法将对象转换为 JArray: {ex.Message}");
                }
            }
        }
    }
}
