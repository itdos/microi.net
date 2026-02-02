using Microsoft.AspNetCore.Mvc.ModelBinding;
using Newtonsoft.Json;
using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

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
    /// </summary>
    public class FormDataOrJsonModelBinder : IModelBinder
    {
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
                    if (request.HasFormContentType && request.Form.ContainsKey(key))
                    {
                        var value = request.Form[key].ToString();
                        SetPropertyValue(property, instance, value);
                    }
                    // 然后从 Query String 中获取
                    else if (request.Query.ContainsKey(key))
                    {
                        var value = request.Query[key].ToString();
                        SetPropertyValue(property, instance, value);
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

        private void SetPropertyValue(System.Reflection.PropertyInfo property, object instance, string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return;

            try
            {
                var targetType = property.PropertyType;
                var isNullable = false;
                
                // 处理可空类型
                if (targetType.IsGenericType && targetType.GetGenericTypeDefinition() == typeof(Nullable<>))
                {
                    isNullable = true;
                    targetType = Nullable.GetUnderlyingType(targetType);
                }

                object convertedValue;

                if (targetType == typeof(string))
                {
                    convertedValue = value;
                }
                else if (targetType == typeof(int))
                {
                    // 支持带小数点的字符串转int（如 "1.0" -> 1）
                    if (value.Contains(".") || value.Contains(","))
                    {
                        convertedValue = (int)Math.Round(double.Parse(value));
                    }
                    else
                    {
                        convertedValue = int.Parse(value);
                    }
                }
                else if (targetType == typeof(long))
                {
                    // 支持带小数点的字符串转long
                    if (value.Contains(".") || value.Contains(","))
                    {
                        convertedValue = (long)Math.Round(double.Parse(value));
                    }
                    else
                    {
                        convertedValue = long.Parse(value);
                    }
                }
                else if (targetType == typeof(double))
                {
                    convertedValue = double.Parse(value);
                }
                else if (targetType == typeof(float))
                {
                    convertedValue = float.Parse(value);
                }
                else if (targetType == typeof(decimal))
                {
                    convertedValue = decimal.Parse(value);
                }
                else if (targetType == typeof(bool))
                {
                    // 支持多种布尔值表示：true/false, 1/0, yes/no
                    var lowerValue = value.ToLower().Trim();
                    if (lowerValue == "1" || lowerValue == "yes" || lowerValue == "on")
                    {
                        convertedValue = true;
                    }
                    else if (lowerValue == "0" || lowerValue == "no" || lowerValue == "off")
                    {
                        convertedValue = false;
                    }
                    else
                    {
                        convertedValue = bool.Parse(value);
                    }
                }
                else if (targetType == typeof(DateTime))
                {
                    convertedValue = DateTime.Parse(value);
                }
                else if (targetType == typeof(Guid))
                {
                    convertedValue = Guid.Parse(value);
                }
                else if (targetType.IsEnum)
                {
                    // 支持数字和字符串枚举值
                    if (int.TryParse(value, out var enumInt))
                    {
                        convertedValue = Enum.ToObject(targetType, enumInt);
                    }
                    else
                    {
                        convertedValue = Enum.Parse(targetType, value, true);
                    }
                }
                else
                {
                    // 对于复杂类型，尝试JSON反序列化
                    convertedValue = JsonConvert.DeserializeObject(value, targetType);
                }

                property.SetValue(instance, convertedValue);
            }
            catch (Exception ex)
            {
                // 转换失败时保持默认值，不影响其他字段的绑定
                // 可以记录日志以便调试
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
