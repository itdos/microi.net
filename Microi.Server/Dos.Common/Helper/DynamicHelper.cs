using System;
using System.Collections.Generic;
using System.Dynamic;
using Newtonsoft.Json.Linq;

namespace Dos.Common
{
    public static class DynamicHelper
    {
        /// <summary>
        /// 从 dynamic 对象中安全获取指定字段的值
        /// 支持 IDictionary、JObject、ExpandoObject、FastExpando 等类型
        /// </summary>
        private static object GetFieldValue(dynamic dynamicModel, string fieldName)
        {
            if (dynamicModel == null)
                return null;
                
            // 优先检查 IDictionary<string, object>（FastExpando 实现了此接口）
            if (dynamicModel is IDictionary<string, object> dict)
            {
                return dict.TryGetValue(fieldName, out var val) ? val : null;
            }
            
            // 检查 JObject
            if (dynamicModel is JObject jObj)
            {
                var token = jObj[fieldName];
                if (token == null || token.Type == JTokenType.Null)
                    return null;
                return token;
            }
            
            // 检查 ExpandoObject
            if (dynamicModel is ExpandoObject expando)
            {
                var expandoDict = (IDictionary<string, object>)expando;
                return expandoDict.TryGetValue(fieldName, out var val) ? val : null;
            }
            
            // 最后尝试索引器访问（可能抛出异常）
            return dynamicModel[fieldName];
        }
        
        public static bool GetDynamicBoolValue(dynamic dynamicModel, string fieldName, bool defaultValue = false)
        {
            if (dynamicModel == null) 
                return defaultValue;

            try
            {
                object value = GetFieldValue(dynamicModel, fieldName);
                
                if (value == null)
                    return defaultValue;
                
                // 根据实际类型进行转换，避免 try-catch
                if (value is bool boolVal)
                    return boolVal;
                
                if (value is int intVal)
                    return intVal == 1;
                
                if (value is long longVal)
                    return longVal == 1;
                
                if (value is string strVal)
                    return strVal == "1" || strVal.Equals("True", StringComparison.OrdinalIgnoreCase);
                
                // 处理 JToken/JValue 类型
                if (value is JToken jToken)
                {
                    if (jToken.Type == JTokenType.Null)
                        return defaultValue;
                    if (jToken.Type == JTokenType.Boolean)
                        return jToken.Value<bool>();
                    if (jToken.Type == JTokenType.Integer)
                        return jToken.Value<int>() == 1;
                    if (jToken.Type == JTokenType.String)
                    {
                        var str = jToken.Value<string>();
                        return str == "1" || str?.Equals("True", StringComparison.OrdinalIgnoreCase) == true;
                    }
                }
                
                // 最后尝试 ToString
                var strValue = value.ToString();
                return strValue == "1" || strValue.Equals("True", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return defaultValue;
            }
        }

        public static string GetDynamicStringValue(dynamic dynamicModel, string fieldName, string defaultValue = "")
        {
            if (dynamicModel == null)
                return defaultValue;

            try
            {
                object value = GetFieldValue(dynamicModel, fieldName);
                
                if (value == null)
                    return defaultValue;
                
                // 处理 JToken 类型
                if (value is JToken jToken)
                {
                    if (jToken.Type == JTokenType.Null)
                        return defaultValue;
                    return jToken.ToString() ?? defaultValue;
                }
                
                if (value is string strVal)
                    return strVal ?? defaultValue;
                
                return value.ToString() ?? defaultValue;
            }
            catch
            {
                return defaultValue;
            }
        }

        public static int GetDynamicIntValue(dynamic dynamicModel, string fieldName, int defaultValue = 0)
        {
            if (dynamicModel == null)
                return defaultValue;

            try
            {
                object value = GetFieldValue(dynamicModel, fieldName);
                
                if (value == null)
                    return defaultValue;
                
                // 直接是 int 类型
                if (value is int intVal)
                    return intVal;
                
                // 处理 long、short、byte 等整数类型
                if (value is long longVal)
                    return longVal <= int.MaxValue && longVal >= int.MinValue ? (int)longVal : defaultValue;
                
                if (value is short shortVal)
                    return shortVal;
                
                if (value is byte byteVal)
                    return byteVal;
                
                // 处理布尔值（true=1, false=0）
                if (value is bool boolVal)
                    return boolVal ? 1 : 0;
                
                // 处理 JToken 类型
                if (value is JToken jToken)
                {
                    if (jToken.Type == JTokenType.Null)
                        return defaultValue;
                    if (jToken.Type == JTokenType.Integer)
                        return jToken.Value<int>();
                    if (jToken.Type == JTokenType.Boolean)
                        return jToken.Value<bool>() ? 1 : 0;
                    if (jToken.Type == JTokenType.String)
                    {
                        var str = jToken.Value<string>();
                        return int.TryParse(str, out var result) ? result : defaultValue;
                    }
                }
                
                // 处理字符串
                if (value is string strVal)
                    return int.TryParse(strVal, out var result) ? result : defaultValue;
                
                // 最后尝试 ToString 后解析
                var strValue = value.ToString();
                return int.TryParse(strValue, out var finalResult) ? finalResult : defaultValue;
            }
            catch
            {
                return defaultValue;
            }
        }
    }
}