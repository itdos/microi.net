using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Extensions.Primitives;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net.Api.ModelBinders
{
    #region JSON 转换器

    /// <summary>
    /// 宽松的数字转换器，允许浮点数转整数（如 85.5 -> 85）
    /// </summary>
    public class LenientNumberConverter : JsonConverter
    {
        private static readonly HashSet<Type> _supportedTypes = new HashSet<Type>
        {
            typeof(int), typeof(int?),
            typeof(long), typeof(long?),
            typeof(short), typeof(short?),
            typeof(byte), typeof(byte?)
        };

        public override bool CanConvert(Type objectType) => _supportedTypes.Contains(objectType);

        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.Null)
            {
                return Nullable.GetUnderlyingType(objectType) != null ? null : Activator.CreateInstance(objectType);
            }

            try
            {
                var targetType = Nullable.GetUnderlyingType(objectType) ?? objectType;
                double value;

                if (reader.TokenType == JsonToken.Float || reader.TokenType == JsonToken.Integer)
                {
                    value = Convert.ToDouble(reader.Value);
                }
                else if (reader.TokenType == JsonToken.String)
                {
                    var stringValue = reader.Value?.ToString();
                    if (string.IsNullOrWhiteSpace(stringValue))
                    {
                        return Nullable.GetUnderlyingType(objectType) != null ? null : Activator.CreateInstance(objectType);
                    }
                    value = double.Parse(stringValue, CultureInfo.InvariantCulture);
                }
                else
                {
                    return Convert.ChangeType(reader.Value, targetType);
                }

                // 使用 switch 表达式简化
                return targetType.Name switch
                {
                    nameof(Int32) => (int)Math.Round(value),
                    nameof(Int64) => (long)Math.Round(value),
                    nameof(Int16) => (short)Math.Round(value),
                    nameof(Byte) => (byte)Math.Round(value),
                    _ => Convert.ChangeType(value, targetType)
                };
            }
            catch
            {
                return Nullable.GetUnderlyingType(objectType) != null ? null : Activator.CreateInstance(objectType);
            }
        }

        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer) => writer.WriteValue(value);
    }

    #endregion

    #region 核心绑定器

    /// <summary>
    /// 全参数模型绑定器
    /// 
    /// 功能特性：
    /// 1. 多数据源支持：JSON Body > Query String > Form-Data（按优先级）
    /// 2. 简单类型绑定：string, int, long, DateTime, Guid, enum 等
    /// 3. 复杂类型绑定：自动反射创建实例并填充属性
    /// 4. 数组/集合绑定：支持 FieldIds[0], FieldIds[1] 和 FieldIds=1&amp;FieldIds=2 两种格式
    /// 5. 大小写不敏感：属性匹配时忽略大小写
    /// 6. 宽松类型转换：支持 "1" -> true, "85.5" -> 85 等
    /// 7. 文件上传排除：IFormFile 类型自动跳过
    /// 
    /// 性能优化：
    /// 1. 类型缓存：缓存 PropertyInfo、简单类型判断结果
    /// 2. JSON 缓存：同一请求多参数共享 JSON 解析结果
    /// 3. 请求体限制：超过 10MB 自动跳过
    /// 4. 延迟解析：只在需要时才解析 JSON
    /// </summary>
    public class FormDataOrJsonModelBinder : IModelBinder
    {
        #region 常量和缓存

        /// <summary>最大请求体大小限制（10MB）</summary>
        private const int MaxBufferSize = 10 * 1024 * 1024;

        /// <summary>HTTP 上下文中缓存 JSON 的键</summary>
        private const string JsonCacheKey = "__FormDataOrJsonModelBinder_JsonCache__";

        /// <summary>简单类型缓存（线程安全）</summary>
        private static readonly ConcurrentDictionary<Type, bool> _simpleTypeCache = new();

        /// <summary>属性信息缓存（线程安全）</summary>
        private static readonly ConcurrentDictionary<Type, PropertyInfo[]> _propertyCache = new();

        /// <summary>集合类型缓存</summary>
        private static readonly ConcurrentDictionary<Type, bool> _collectionTypeCache = new();

        /// <summary>JSON 序列化设置（复用）</summary>
        private static readonly JsonSerializerSettings _jsonSettings = new()
        {
            FloatParseHandling = FloatParseHandling.Decimal,
            DateParseHandling = DateParseHandling.None,
            Converters = { new LenientNumberConverter() }
        };

        /// <summary>简单类型集合（用于快速判断）</summary>
        private static readonly HashSet<Type> _simpleTypes = new()
        {
            typeof(string), typeof(char), typeof(bool),
            typeof(byte), typeof(sbyte),
            typeof(short), typeof(ushort),
            typeof(int), typeof(uint),
            typeof(long), typeof(ulong),
            typeof(float), typeof(double), typeof(decimal),
            typeof(DateTime), typeof(DateTimeOffset), typeof(TimeSpan),
            typeof(Guid), typeof(Uri)
        };

        #endregion

        #region 主绑定逻辑

        public async Task BindModelAsync(ModelBindingContext bindingContext)
        {
            if (bindingContext == null)
                throw new ArgumentNullException(nameof(bindingContext));

            var request = bindingContext.HttpContext.Request;
            var modelType = bindingContext.ModelType;
            var modelName = GetModelName(bindingContext, modelType);

            // 文件上传请求：跳过自定义绑定
            if (IsFileUploadRequest(request))
            {
                bindingContext.Result = ModelBindingResult.Failed();
                return;
            }

            // 按优先级尝试绑定：JSON > Query > Form
            if (await TryBindFromJsonAsync(bindingContext, request, modelType, modelName))
                return;

            if (TryBindFromQuery(bindingContext, request, modelType, modelName))
                return;

            if (TryBindFromForm(bindingContext, request, modelType, modelName))
                return;

            // 所有方式都失败，让框架默认处理
            bindingContext.Result = ModelBindingResult.Failed();
        }

        /// <summary>
        /// 获取参数名称（处理 ModelName 为空的情况）
        /// </summary>
        private static string GetModelName(ModelBindingContext bindingContext, Type modelType)
        {
            var modelName = bindingContext.ModelName;

            if (!string.IsNullOrEmpty(modelName))
                return modelName;

            // 从 ActionDescriptor 获取参数名
            if (bindingContext.ActionContext.ActionDescriptor is ControllerActionDescriptor actionDescriptor)
            {
                var parameter = actionDescriptor.Parameters
                    .FirstOrDefault(p => p.ParameterType == modelType && p.BindingInfo?.BindingSource == null);

                if (parameter != null)
                    return parameter.Name;
            }

            return modelName;
        }

        #endregion

        #region JSON 绑定

        /// <summary>
        /// 从 JSON Body 绑定参数
        /// </summary>
        private async Task<bool> TryBindFromJsonAsync(
            ModelBindingContext bindingContext,
            HttpRequest request,
            Type modelType,
            string modelName)
        {
            // 检查 Content-Type
            if (!IsJsonContentType(request.ContentType))
                return false;

            try
            {
                // 检查请求体大小
                if (request.ContentLength > MaxBufferSize)
                {
                    bindingContext.ModelState.AddModelError(modelName,
                        $"请求体过大（{request.ContentLength / 1024 / 1024}MB），超过限制（{MaxBufferSize / 1024 / 1024}MB）");
                    return false;
                }

                // 获取或缓存 JSON 字符串
                var json = await GetOrReadJsonAsync(bindingContext.HttpContext, request);

                if (string.IsNullOrWhiteSpace(json))
                    return false;

                // 根据类型选择绑定方式
                return IsSimpleType(modelType)
                    ? BindSimpleTypeFromJson(bindingContext, json, modelType, modelName)
                    : BindComplexTypeFromJson(bindingContext, json, modelType);
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// 获取或读取 JSON（支持缓存，避免多参数重复读取）
        /// </summary>
        private static async Task<string> GetOrReadJsonAsync(HttpContext httpContext, HttpRequest request)
        {
            // 尝试从缓存获取
            if (httpContext.Items.TryGetValue(JsonCacheKey, out var cached) && cached is string cachedJson)
                return cachedJson;

            // 启用缓冲并读取
            request.EnableBuffering();

            using var reader = new StreamReader(request.Body, Encoding.UTF8, true, 4096, true);
            var json = await reader.ReadToEndAsync();
            request.Body.Position = 0;

            // 缓存结果
            httpContext.Items[JsonCacheKey] = json;

            return json;
        }

        /// <summary>
        /// 检查是否为 JSON Content-Type
        /// </summary>
        private static bool IsJsonContentType(string contentType)
        {
            if (string.IsNullOrEmpty(contentType))
                return false;

            return contentType.Contains("application/json", StringComparison.OrdinalIgnoreCase) ||
                   contentType.Contains("text/json", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 从 JSON 绑定简单类型
        /// </summary>
        private static bool BindSimpleTypeFromJson(
            ModelBindingContext bindingContext,
            string json,
            Type modelType,
            string modelName)
        {
            try
            {
                var jObject = JObject.Parse(json);

                // 大小写不敏感查找
                var property = jObject.Properties()
                    .FirstOrDefault(p => string.Equals(p.Name, modelName, StringComparison.OrdinalIgnoreCase));

                if (property?.Value == null)
                    return false;

                // 处理 null 值
                if (property.Value.Type == JTokenType.Null)
                {
                    if (modelType == typeof(string) || Nullable.GetUnderlyingType(modelType) != null)
                    {
                        bindingContext.Result = ModelBindingResult.Success(null);
                        return true;
                    }
                    return false;
                }

                // 转换值
                var value = ConvertJToken(property.Value, modelType);
                if (value != null || modelType == typeof(string))
                {
                    bindingContext.Result = ModelBindingResult.Success(value);
                    return true;
                }

                return false;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// 从 JSON 绑定复杂类型
        /// </summary>
        private static bool BindComplexTypeFromJson(
            ModelBindingContext bindingContext,
            string json,
            Type modelType)
        {
            try
            {
                var model = JsonConvert.DeserializeObject(json, modelType, _jsonSettings);
                if (model != null)
                {
                    bindingContext.Result = ModelBindingResult.Success(model);
                    return true;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        #endregion

        #region Query String 绑定

        /// <summary>
        /// 从 Query String 绑定参数
        /// </summary>
        private bool TryBindFromQuery(
            ModelBindingContext bindingContext,
            HttpRequest request,
            Type modelType,
            string modelName)
        {
            if (!request.Query.Any())
                return false;

            try
            {
                if (IsSimpleType(modelType))
                {
                    // 大小写不敏感查找
                    var key = request.Query.Keys.FirstOrDefault(k =>
                        string.Equals(k, modelName, StringComparison.OrdinalIgnoreCase));

                    if (key != null)
                    {
                        var value = request.Query[key].ToString();
                        if (!string.IsNullOrEmpty(value))
                        {
                            var converted = ConvertString(value, modelType);
                            if (converted != null || modelType == typeof(string))
                            {
                                bindingContext.Result = ModelBindingResult.Success(converted);
                                return true;
                            }
                        }
                    }
                    return false;
                }

                return BindComplexTypeFromCollection(bindingContext, request.Query, modelType);
            }
            catch
            {
                return false;
            }
        }

        #endregion

        #region Form-Data 绑定

        /// <summary>
        /// 从 Form-Data 绑定参数
        /// </summary>
        private bool TryBindFromForm(
            ModelBindingContext bindingContext,
            HttpRequest request,
            Type modelType,
            string modelName)
        {
            if (!request.HasFormContentType)
                return false;

            try
            {
                if (IsSimpleType(modelType))
                {
                    // 大小写不敏感查找
                    var key = request.Form.Keys.FirstOrDefault(k =>
                        string.Equals(k, modelName, StringComparison.OrdinalIgnoreCase));

                    if (key != null)
                    {
                        var value = request.Form[key].ToString();
                        if (!string.IsNullOrEmpty(value))
                        {
                            var converted = ConvertString(value, modelType);
                            if (converted != null || modelType == typeof(string))
                            {
                                bindingContext.Result = ModelBindingResult.Success(converted);
                                return true;
                            }
                        }
                    }
                    return false;
                }

                return BindComplexTypeFromCollection(bindingContext, request.Form, modelType);
            }
            catch
            {
                return false;
            }
        }

        #endregion

        #region 复杂类型绑定

        /// <summary>
        /// 从键值对集合绑定复杂类型
        /// </summary>
        private bool BindComplexTypeFromCollection(
            ModelBindingContext bindingContext,
            IEnumerable<KeyValuePair<string, StringValues>> collection,
            Type modelType)
        {
            try
            {
                var instance = Activator.CreateInstance(modelType);
                var properties = GetCachedProperties(modelType);
                var collectionDict = collection.ToDictionary(x => x.Key, x => x.Value, StringComparer.OrdinalIgnoreCase);

                foreach (var property in properties)
                {
                    if (!property.CanWrite)
                        continue;

                    var propertyName = property.Name;

                    // 检查索引格式数组
                    var indexedValues = GetIndexedValues(collectionDict, propertyName);
                    if (indexedValues?.Count > 0)
                    {
                        SetCollectionProperty(property, instance, indexedValues);
                        continue;
                    }

                    // 检查普通键值
                    if (collectionDict.TryGetValue(propertyName, out var values))
                    {
                        if (values.Count > 1 || IsCollectionType(property.PropertyType))
                        {
                            SetCollectionProperty(property, instance, values.ToList()!);
                        }
                        else
                        {
                            SetSimpleProperty(property, instance, values.ToString());
                        }
                    }
                }

                bindingContext.Result = ModelBindingResult.Success(instance);
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// 提取索引格式的数组值（如 FieldIds[0], FieldIds[1]）
        /// </summary>
        private static List<string> GetIndexedValues(
            Dictionary<string, StringValues> collection,
            string propertyName)
        {
            var pattern = $"{propertyName}[";
            var indexedItems = new SortedDictionary<int, string>();

            foreach (var (key, value) in collection)
            {
                if (!key.StartsWith(pattern, StringComparison.OrdinalIgnoreCase))
                    continue;

                var closeBracket = key.IndexOf(']', pattern.Length);
                if (closeBracket <= pattern.Length)
                    continue;

                var indexStr = key.AsSpan(pattern.Length, closeBracket - pattern.Length);
                if (int.TryParse(indexStr, out var index))
                {
                    indexedItems[index] = value.ToString();
                }
            }

            return indexedItems.Count > 0 ? indexedItems.Values.ToList() : null;
        }

        /// <summary>
        /// 设置集合类型属性
        /// </summary>
        private static void SetCollectionProperty(PropertyInfo property, object instance, IList<string> values)
        {
            try
            {
                var propertyType = property.PropertyType;
                var elementType = GetElementType(propertyType);

                if (elementType == null)
                    return;

                var listType = typeof(List<>).MakeGenericType(elementType);
                var list = (IList)Activator.CreateInstance(listType);

                foreach (var value in values)
                {
                    if (string.IsNullOrWhiteSpace(value))
                        continue;

                    var converted = ConvertString(value, elementType);
                    if (converted != null)
                        list.Add(converted);
                }

                if (propertyType.IsArray)
                {
                    var array = Array.CreateInstance(elementType, list.Count);
                    list.CopyTo(array, 0);
                    property.SetValue(instance, array);
                }
                else
                {
                    property.SetValue(instance, list);
                }
            }
            catch
            {
                // 忽略单个属性的错误
            }
        }

        /// <summary>
        /// 设置简单类型属性
        /// </summary>
        private static void SetSimpleProperty(PropertyInfo property, object instance, string value)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(value) && property.PropertyType != typeof(string))
                    return;

                var converted = ConvertString(value, property.PropertyType);
                if (converted != null || property.PropertyType == typeof(string))
                {
                    property.SetValue(instance, converted);
                }
            }
            catch
            {
                // 忽略单个属性的错误
            }
        }

        /// <summary>
        /// 获取集合元素类型
        /// </summary>
        private static Type GetElementType(Type type)
        {
            if (type.IsArray)
                return type.GetElementType();

            if (type.IsGenericType)
                return type.GetGenericArguments().FirstOrDefault();

            return null;
        }

        #endregion

        #region 类型转换

        /// <summary>
        /// 将 JToken 转换为目标类型
        /// </summary>
        private static object ConvertJToken(JToken token, Type targetType)
        {
            if (token == null || token.Type == JTokenType.Null)
                return null;

            try
            {
                var underlyingType = Nullable.GetUnderlyingType(targetType) ?? targetType;

                // 常见类型快速处理
                if (underlyingType == typeof(string))
                    return token.ToString();

                if (underlyingType == typeof(bool))
                {
                    if (token.Type == JTokenType.Boolean)
                        return token.ToObject<bool>();
                    if (token.Type == JTokenType.Integer)
                        return token.ToObject<int>() != 0;
                    if (token.Type == JTokenType.String)
                        return ConvertToBool(token.ToString());
                }

                if (underlyingType.IsEnum)
                {
                    return token.Type == JTokenType.Integer
                        ? Enum.ToObject(underlyingType, token.ToObject<int>())
                        : Enum.Parse(underlyingType, token.ToString(), true);
                }

                // 其他类型使用 Newtonsoft.Json 处理
                return token.ToObject(targetType);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 将字符串转换为目标类型
        /// </summary>
        private static object ConvertString(string value, Type targetType)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            try
            {
                var underlyingType = Nullable.GetUnderlyingType(targetType) ?? targetType;

                // 字符串直接返回
                if (underlyingType == typeof(string))
                    return value;

                // 布尔值特殊处理
                if (underlyingType == typeof(bool))
                    return ConvertToBool(value);

                // 整数类型支持浮点字符串
                if (underlyingType == typeof(int))
                {
                    if (value.Contains('.'))
                        return (int)Math.Round(double.Parse(value, CultureInfo.InvariantCulture));
                    return int.Parse(value, CultureInfo.InvariantCulture);
                }

                if (underlyingType == typeof(long))
                {
                    if (value.Contains('.'))
                        return (long)Math.Round(double.Parse(value, CultureInfo.InvariantCulture));
                    return long.Parse(value, CultureInfo.InvariantCulture);
                }

                // 浮点类型
                if (underlyingType == typeof(double))
                    return double.Parse(value, CultureInfo.InvariantCulture);

                if (underlyingType == typeof(float))
                    return float.Parse(value, CultureInfo.InvariantCulture);

                if (underlyingType == typeof(decimal))
                    return decimal.Parse(value, CultureInfo.InvariantCulture);

                // 日期时间
                if (underlyingType == typeof(DateTime))
                    return DateTime.Parse(value, CultureInfo.InvariantCulture);

                if (underlyingType == typeof(DateTimeOffset))
                    return DateTimeOffset.Parse(value, CultureInfo.InvariantCulture);

                if (underlyingType == typeof(TimeSpan))
                    return TimeSpan.Parse(value, CultureInfo.InvariantCulture);

                // GUID
                if (underlyingType == typeof(Guid))
                    return Guid.Parse(value);

                // 枚举
                if (underlyingType.IsEnum)
                {
                    return int.TryParse(value, out var enumInt)
                        ? Enum.ToObject(underlyingType, enumInt)
                        : Enum.Parse(underlyingType, value, true);
                }

                // 其他类型尝试 JSON 反序列化
                return JsonConvert.DeserializeObject(value, targetType);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 字符串转布尔值（支持多种格式）
        /// </summary>
        private static bool? ConvertToBool(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;

            var lower = value.Trim().ToLowerInvariant();

            return lower switch
            {
                "true" or "1" or "yes" or "on" or "是" => true,
                "false" or "0" or "no" or "off" or "否" => false,
                _ => bool.TryParse(value, out var result) ? result : null
            };
        }

        #endregion

        #region 类型判断（带缓存）

        /// <summary>
        /// 判断是否为简单类型（带缓存）
        /// </summary>
        private static bool IsSimpleType(Type type)
        {
            return _simpleTypeCache.GetOrAdd(type, t =>
            {
                var underlyingType = Nullable.GetUnderlyingType(t) ?? t;

                return underlyingType.IsPrimitive ||
                       _simpleTypes.Contains(underlyingType) ||
                       underlyingType.IsEnum;
            });
        }

        /// <summary>
        /// 判断是否为集合类型（带缓存）
        /// </summary>
        private static bool IsCollectionType(Type type)
        {
            return _collectionTypeCache.GetOrAdd(type, t =>
            {
                if (t == typeof(string))
                    return false;

                if (t.IsArray)
                    return true;

                if (t.IsGenericType)
                {
                    var genericDef = t.GetGenericTypeDefinition();
                    return genericDef == typeof(List<>) ||
                           genericDef == typeof(IList<>) ||
                           genericDef == typeof(IEnumerable<>) ||
                           genericDef == typeof(ICollection<>) ||
                           genericDef == typeof(IReadOnlyList<>) ||
                           genericDef == typeof(IReadOnlyCollection<>);
                }

                return typeof(IEnumerable).IsAssignableFrom(t);
            });
        }

        /// <summary>
        /// 获取缓存的属性信息
        /// </summary>
        private static PropertyInfo[] GetCachedProperties(Type type)
        {
            return _propertyCache.GetOrAdd(type, t =>
                t.GetProperties(BindingFlags.Public | BindingFlags.Instance));
        }

        /// <summary>
        /// 检测是否为文件上传请求
        /// </summary>
        private static bool IsFileUploadRequest(HttpRequest request)
        {
            if (request.ContentType == null)
                return false;

            return request.ContentType.Contains("multipart/form-data", StringComparison.OrdinalIgnoreCase) &&
                   request.HasFormContentType &&
                   request.Form.Files.Count > 0;
        }

        #endregion
    }

    #endregion

    #region 绑定器提供器

    /// <summary>
    /// 全参数模型绑定器提供器
    /// 支持 JSON、Form-Data、Query String 的全参数自动绑定
    /// </summary>
    public class FormDataOrJsonModelBinderProvider : IModelBinderProvider
    {
        /// <summary>
        /// 需要排除的类型（使用框架默认绑定）
        /// </summary>
        private static readonly HashSet<Type> _excludedTypes = new()
        {
            typeof(IFormFile),
            typeof(IFormFileCollection),
            typeof(CancellationToken),
            typeof(Stream)
        };

        public IModelBinder GetBinder(ModelBinderProviderContext context)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var modelType = context.Metadata.ModelType;

            // 排除特殊类型
            if (_excludedTypes.Any(t => t.IsAssignableFrom(modelType)))
                return null;

            // 排除 HttpContext 等系统类型
            if (modelType.Namespace?.StartsWith("Microsoft.AspNetCore") == true)
                return null;

            return new FormDataOrJsonModelBinder();
        }
    }

    #endregion
}
