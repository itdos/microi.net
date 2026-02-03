using Microsoft.AspNetCore.Mvc.ModelBinding;
using Newtonsoft.Json;
using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

// // 性能敏感接口 - 使用原生 [FromBody]
// [HttpPost("critical")]
// public async Task<IActionResult> Critical([FromBody] DiyTableRowParam param)

// // 需要兼容多格式的接口 - 使用 FormDataOrJsonModelBinder
// [HttpPost("flexible")]
// public async Task<IActionResult> Flexible(
//     [ModelBinder(typeof(FormDataOrJsonModelBinder))] DiyTableRowParam param)

namespace Microi.net.Api.ModelBinders
{
    /// <summary>
    /// 宽松的数字转换器，允许浮点数转整数
    /// </summary>
    public class LenientNumberConverter : JsonConverter
    {
        public override bool CanConvert(Type objectType)
        {
            // 处理 int, long 及其可空类型
            return objectType == typeof(int) || objectType == typeof(int?) ||
                   objectType == typeof(long) || objectType == typeof(long?) ||
                   objectType == typeof(short) || objectType == typeof(short?) ||
                   objectType == typeof(byte) || objectType == typeof(byte?);
        }

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.Null)
            {
                if (Nullable.GetUnderlyingType(objectType) != null)
                    return null;
                return Activator.CreateInstance(objectType);
            }

            try
            {
                var targetType = Nullable.GetUnderlyingType(objectType) ?? objectType;
                
                if (reader.TokenType == JsonToken.Float || reader.TokenType == JsonToken.Integer)
                {
                    var value = Convert.ToDouble(reader.Value);
                    
                    if (targetType == typeof(int))
                        return (int)Math.Round(value);
                    else if (targetType == typeof(long))
                        return (long)Math.Round(value);
                    else if (targetType == typeof(short))
                        return (short)Math.Round(value);
                    else if (targetType == typeof(byte))
                        return (byte)Math.Round(value);
                }
                else if (reader.TokenType == JsonToken.String)
                {
                    var stringValue = reader.Value.ToString();
                    if (string.IsNullOrWhiteSpace(stringValue))
                    {
                        if (Nullable.GetUnderlyingType(objectType) != null)
                            return null;
                        return Activator.CreateInstance(objectType);
                    }
                    
                    var value = double.Parse(stringValue);
                    
                    if (targetType == typeof(int))
                        return (int)Math.Round(value);
                    else if (targetType == typeof(long))
                        return (long)Math.Round(value);
                    else if (targetType == typeof(short))
                        return (short)Math.Round(value);
                    else if (targetType == typeof(byte))
                        return (byte)Math.Round(value);
                }

                return Convert.ChangeType(reader.Value, targetType);
            }
            catch
            {
                if (Nullable.GetUnderlyingType(objectType) != null)
                    return null;
                return Activator.CreateInstance(objectType);
            }
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            // 写入时保持原样
            writer.WriteValue(value);
        }
    }

    /// <summary>
    /// 自定义模型绑定器，同时支持 form-data 和 JSON 格式
    /// 注意：此绑定器会缓存请求体到内存，不适合大文件上传（建议限制在 10MB 以内）
    /// </summary>
    public class FormDataOrJsonModelBinder : IModelBinder
    {
        // 最大请求体大小限制（10MB），超过此大小时跳过 JSON 解析以节省内存
        private const int MaxBufferSize = 10 * 1024 * 1024;

        public async Task BindModelAsync(ModelBindingContext bindingContext)
        {
            if (bindingContext == null)
            {
                throw new ArgumentNullException(nameof(bindingContext));
            }

            var request = bindingContext.HttpContext.Request;
            var modelType = bindingContext.ModelType;

            // 首先尝试从 JSON body 中绑定
            if (request.ContentType != null && 
                (request.ContentType.Contains("application/json") || 
                 request.ContentType.Contains("text/json")))
            {
                try
                {
                    // 性能优化：检查请求体大小，避免过大的请求缓存到内存
                    if (request.ContentLength.HasValue && request.ContentLength.Value > MaxBufferSize)
                    {
                        bindingContext.ModelState.AddModelError(bindingContext.ModelName, 
                            $"请求体过大（{request.ContentLength.Value / 1024 / 1024}MB），超过限制（{MaxBufferSize / 1024 / 1024}MB）");
                        var defaultInstance = Activator.CreateInstance(modelType);
                        bindingContext.Result = ModelBindingResult.Success(defaultInstance);
                        return;
                    }

                    request.EnableBuffering();
                    using (var reader = new StreamReader(request.Body, Encoding.UTF8, true, 1024, true))
                    {
                        var json = await reader.ReadToEndAsync();
                        request.Body.Position = 0;

                        if (!string.IsNullOrWhiteSpace(json))
                        {
                            // 配置 JSON 反序列化设置，允许类型转换
                            var settings = new JsonSerializerSettings
                            {
                                // 处理数字类型转换问题（如 85.5 -> 85）
                                FloatParseHandling = FloatParseHandling.Decimal,
                                // 添加自定义转换器
                                Converters = { new LenientNumberConverter() }
                            };
                            
                            var model = JsonConvert.DeserializeObject(json, modelType, settings);
                            if (model != null)
                            {
                                bindingContext.Result = ModelBindingResult.Success(model);
                                return;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    // JSON 解析失败时记录错误，但继续尝试其他绑定方式
                    System.Diagnostics.Debug.WriteLine($"JSON 绑定失败: {ex.Message}");
                }
            }

            // 如果不是 JSON 或 JSON 绑定失败，尝试从 form-data 或 query string 中绑定
            try
            {
                var instance = Activator.CreateInstance(modelType);
                var properties = modelType.GetProperties();

                foreach (var property in properties)
                {
                    var key = property.Name;
                    
                    // 优先从 Form 中获取
                    if (request.HasFormContentType)
                    {
                        // 检查是否有索引格式的数组数据（如 FieldIds[0], FieldIds[1]）
                        var indexedValues = GetIndexedValues(request.Form, key);
                        if (indexedValues != null && indexedValues.Count > 0)
                        {
                            // 找到了索引格式的数组
                            SetCollectionPropertyValue(property, instance, indexedValues.ToArray());
                        }
                        else if (request.Form.ContainsKey(key))
                        {
                            var values = request.Form[key];
                            // 处理数组类型（form-data 支持多个同名字段）
                            if (values.Count > 1 || IsCollectionType(property.PropertyType))
                            {
                                SetCollectionPropertyValue(property, instance, values);
                            }
                            else
                            {
                                SetPropertyValue(property, instance, values.ToString());
                            }
                        }
                    }
                    // 然后从 Query String 中获取
                    else if (request.Query.ContainsKey(key))
                    {
                        // 检查是否有索引格式的数组数据
                        var indexedValues = GetIndexedValues(request.Query, key);
                        if (indexedValues != null && indexedValues.Count > 0)
                        {
                            // 找到了索引格式的数组
                            SetCollectionPropertyValue(property, instance, indexedValues.ToArray());
                        }
                        else
                        {
                            var values = request.Query[key];
                            // 处理数组类型（query string 也支持多个同名参数）
                            if (values.Count > 1 || IsCollectionType(property.PropertyType))
                            {
                                SetCollectionPropertyValue(property, instance, values);
                            }
                            else
                            {
                                SetPropertyValue(property, instance, values.ToString());
                            }
                        }
                    }
                }

                bindingContext.Result = ModelBindingResult.Success(instance);
            }
            catch (Exception ex)
            {
                // 即使创建实例失败，也返回默认实例而不是 null
                System.Diagnostics.Debug.WriteLine($"模型绑定失败: {ex.Message}");
                bindingContext.ModelState.AddModelError(bindingContext.ModelName, ex.Message);
                
                // 返回默认实例而不是 Failed
                var defaultInstance = Activator.CreateInstance(modelType);
                bindingContext.Result = ModelBindingResult.Success(defaultInstance);
            }
        }

        /// <summary>
        /// 从 Form 或 Query 中提取索引格式的数组值（如 FieldIds[0], FieldIds[1]）
        /// 性能优化：使用 StringComparison.Ordinal 代替 OrdinalIgnoreCase
        /// </summary>
        private System.Collections.Generic.List<string> GetIndexedValues(
            System.Collections.Generic.IEnumerable<System.Collections.Generic.KeyValuePair<string, Microsoft.Extensions.Primitives.StringValues>> collection, 
            string propertyName)
        {
            // 性能优化：使用精确匹配模式，减少字符串比较开销
            var pattern = $"{propertyName}[";
            var patternLength = pattern.Length;
            
            // 查找所有匹配的键（如 FieldIds[0], FieldIds[1], FieldIds[2]）
            // 使用 SortedDictionary 自动排序，避免额外的排序开销
            var indexedItems = new System.Collections.Generic.SortedDictionary<int, string>();
            
            foreach (var item in collection)
            {
                // 性能优化：先检查长度，避免不必要的字符串操作
                if (item.Key.Length <= patternLength)
                    continue;

                // 性能优化：使用 Ordinal 比较，比 OrdinalIgnoreCase 快
                if (item.Key.StartsWith(pattern, StringComparison.Ordinal))
                {
                    // 提取索引：FieldIds[0] -> 0
                    var indexEnd = item.Key.IndexOf(']', patternLength);
                    
                    if (indexEnd > patternLength)
                    {
                        var indexStr = item.Key.Substring(patternLength, indexEnd - patternLength);
                        if (int.TryParse(indexStr, out var index))
                        {
                            indexedItems[index] = item.Value.ToString();
                        }
                    }
                }
            }
            
            // 按索引顺序返回值
            if (indexedItems.Count > 0)
            {
                var result = new System.Collections.Generic.List<string>(indexedItems.Count);
                foreach (var item in indexedItems.Values)
                {
                    result.Add(item);
                }
                return result;
            }
            
            return null;
        }

        /// <summary>
        /// 判断类型是否为集合类型
        /// </summary>
        private bool IsCollectionType(Type type)
        {
            if (type == typeof(string))
                return false;

            return type.IsArray || 
                   (type.IsGenericType && 
                    (type.GetGenericTypeDefinition() == typeof(System.Collections.Generic.List<>) ||
                     type.GetGenericTypeDefinition() == typeof(System.Collections.Generic.IList<>) ||
                     type.GetGenericTypeDefinition() == typeof(System.Collections.Generic.IEnumerable<>) ||
                     type.GetGenericTypeDefinition() == typeof(System.Collections.Generic.ICollection<>)));
        }

        /// <summary>
        /// 设置集合类型属性的值
        /// </summary>
        private void SetCollectionPropertyValue(System.Reflection.PropertyInfo property, object instance, Microsoft.Extensions.Primitives.StringValues values)
        {
            try
            {
                var propertyType = property.PropertyType;
                
                // 获取元素类型
                Type elementType;
                if (propertyType.IsArray)
                {
                    elementType = propertyType.GetElementType();
                }
                else if (propertyType.IsGenericType)
                {
                    elementType = propertyType.GetGenericArguments()[0];
                }
                else
                {
                    return;
                }

                // 创建一个临时列表来存储转换后的值
                var listType = typeof(System.Collections.Generic.List<>).MakeGenericType(elementType);
                var list = (System.Collections.IList)Activator.CreateInstance(listType);

                // 转换每个值
                foreach (var value in values)
                {
                    if (string.IsNullOrWhiteSpace(value))
                        continue;

                    object convertedValue = ConvertValue(value, elementType);
                    if (convertedValue != null)
                    {
                        list.Add(convertedValue);
                    }
                }

                // 设置属性值
                if (propertyType.IsArray)
                {
                    // 转换为数组
                    var array = Array.CreateInstance(elementType, list.Count);
                    list.CopyTo(array, 0);
                    property.SetValue(instance, array);
                }
                else
                {
                    // 直接设置 List
                    property.SetValue(instance, list);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"集合属性 {property.Name} 绑定失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 将字符串值转换为指定类型
        /// </summary>
        private object ConvertValue(string value, Type targetType)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            try
            {
                var isNullable = false;
                
                // 处理可空类型
                if (targetType.IsGenericType && targetType.GetGenericTypeDefinition() == typeof(Nullable<>))
                {
                    isNullable = true;
                    targetType = Nullable.GetUnderlyingType(targetType);
                }

                if (targetType == typeof(string))
                {
                    return value;
                }
                else if (targetType == typeof(int))
                {
                    if (value.Contains(".") || value.Contains(","))
                    {
                        return (int)Math.Round(double.Parse(value));
                    }
                    return int.Parse(value);
                }
                else if (targetType == typeof(long))
                {
                    if (value.Contains(".") || value.Contains(","))
                    {
                        return (long)Math.Round(double.Parse(value));
                    }
                    return long.Parse(value);
                }
                else if (targetType == typeof(double))
                {
                    return double.Parse(value);
                }
                else if (targetType == typeof(float))
                {
                    return float.Parse(value);
                }
                else if (targetType == typeof(decimal))
                {
                    return decimal.Parse(value);
                }
                else if (targetType == typeof(bool))
                {
                    var lowerValue = value.ToLower().Trim();
                    if (lowerValue == "1" || lowerValue == "yes" || lowerValue == "on")
                        return true;
                    else if (lowerValue == "0" || lowerValue == "no" || lowerValue == "off")
                        return false;
                    return bool.Parse(value);
                }
                else if (targetType == typeof(DateTime))
                {
                    return DateTime.Parse(value);
                }
                else if (targetType == typeof(Guid))
                {
                    return Guid.Parse(value);
                }
                else if (targetType.IsEnum)
                {
                    if (int.TryParse(value, out var enumInt))
                    {
                        return Enum.ToObject(targetType, enumInt);
                    }
                    return Enum.Parse(targetType, value, true);
                }
                else
                {
                    // 对于复杂类型，尝试JSON反序列化
                    return JsonConvert.DeserializeObject(value, targetType);
                }
            }
            catch
            {
                return null;
            }
        }

        private void SetPropertyValue(System.Reflection.PropertyInfo property, object instance, string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return;

            try
            {
                var convertedValue = ConvertValue(value, property.PropertyType);
                if (convertedValue != null)
                {
                    property.SetValue(instance, convertedValue);
                }
            }
            catch (Exception ex)
            {
                // 转换失败时保持默认值，不影响其他字段的绑定
                System.Diagnostics.Debug.WriteLine($"属性 {property.Name} 转换失败: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// 模型绑定器提供器
    /// </summary>
    public class FormDataOrJsonModelBinderProvider : IModelBinderProvider
    {
        public IModelBinder GetBinder(ModelBinderProviderContext context)
        {
            if (context == null)
            {
                throw new ArgumentNullException(nameof(context));
            }

            // 可以在这里指定哪些类型使用此绑定器
            // 例如：只对 DiyTableRowParam 类型使用
            if (context.Metadata.ModelType.Name.Contains("Param"))
            {
                return new FormDataOrJsonModelBinder();
            }

            return null;
        }
    }
}
