using Newtonsoft.Json;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Dos.Common
{
    public class MapperHelper
    {
        private static readonly ConcurrentDictionary<Type, System.Reflection.PropertyInfo[]> WritablePropertyCache =
            new ConcurrentDictionary<Type, System.Reflection.PropertyInfo[]>();
        private static readonly ConcurrentDictionary<Type, Dictionary<string, System.Reflection.PropertyInfo>> ReadablePropertyCache =
            new ConcurrentDictionary<Type, Dictionary<string, System.Reflection.PropertyInfo>>();

        public static TTo Map<TFrom, TTo>(TFrom from)
        {
            //if (typeof(TFrom) == Types.Object)
            {
                return EntityCopy<TTo>(from);
            }
            //var mapper = EmitMapper.ObjectMapperManager.DefaultInstance.GetMapper<TFrom, TTo>();
            //return mapper.Map(from);
        }
        public static TTo MapNotNull<TFrom, TTo>(TFrom from)
        {
            //if (typeof(TFrom) == Types.Object)
            {
                return EntityCopyNotNull<TTo>(from);
            }
            //var mapper = EmitMapper.ObjectMapperManager.DefaultInstance.GetMapper<TFrom, TTo>();
            //return mapper.Map(from);
        }
        public static TTo MapNotNull<TFrom, TTo>(TFrom from, TTo to)
        {
            //if (typeof(TFrom) == Types.Object)
            {
                return EntityCopyNotNull<TFrom, TTo>(from, to);
            }
            //var mapper = EmitMapper.ObjectMapperManager.DefaultInstance.GetMapper<TFrom, TTo>();
            //return mapper.Map(from);
        }
        public static List<TTo> Map<TFrom, TTo>(List<TFrom> from)
        {
            //if (typeof(TFrom) == Types.Object)
            {
                return EntityCopy<TFrom, TTo>(from);
            }
            // var mapper = EmitMapper.ObjectMapperManager.DefaultInstance.GetMapper<List<TFrom>, List<TTo>>();
            //return mapper.Map(from);
        }
        public static TResult EntityCopy<TResult>(object input)
        {
            if (input == null)
            {
                return default(TResult);
            }
            if (input.GetType() == typeof(TResult))
            {
                return (TResult)input;
            }
            return (TResult)EntityCopy(input, typeof(TResult), false);
        }
        public static TTo EntityCopyNotNull<TTo>(object fromInput)
        {
            if (fromInput == null)
            {
                return default(TTo);
            }
            if (fromInput.GetType() == typeof(TTo))
            {
                return (TTo)fromInput;
            }
            return (TTo)EntityCopy(fromInput, typeof(TTo), true);
        }
        /// <summary>
        /// 这里的TResult就是上面传过来的TTo
        /// </summary>
        /// <typeparam name="TFrom"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="input"></param>
        /// <param name="toInput"></param>
        /// <returns></returns>
        public static TTo EntityCopyNotNull<TFrom, TTo>(object fromInput, object toInput)
        {
            if (fromInput == null)
            {
                //return default(TResult);
                return (TTo)toInput;
            }
            if (fromInput.GetType() == typeof(TTo))
            {
                return (TTo)fromInput;
            }
            return (TTo)EntityCopy(fromInput, typeof(TTo), true, toInput, typeof(TFrom));
        }
        /// <summary>
        /// 
        /// </summary>
        /// <typeparam name="TEntity"></typeparam>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="input"></param>
        /// <returns></returns>
        public static List<TResult> EntityCopy<TEntity, TResult>(IList<TEntity> input)
        {
            return input.Select(entity => EntityCopy<TResult>(entity)).ToList();
        }
        private static readonly HashSet<string> NotSerializeType = new HashSet<string>(StringComparer.Ordinal){
            "String",
            "DateTime",
            "Int",
            "Long",
            "Float",
            "Double",
            "Decimal",
            "Bool",
            "Byte",
            "Guid"
        };
        /// <summary>
        /// 
        /// </summary>
        /// <param name="input"></param>
        /// <param name="targetType"></param>
        /// <param name="notNull"></param>
        /// <param name="toInput"></param>
        /// <param name="fromType"></param>
        /// <returns></returns>
        public static object EntityCopy(object fromInput, Type toType, bool notNull, object toInput = null, Type fromType = null)
        {
            if (fromInput == null) throw new ArgumentNullException(nameof(fromInput));
            if (toType == null) throw new ArgumentNullException(nameof(toType));

            //emitmapper
            var objResult = Activator.CreateInstance(toType)
                ?? throw new InvalidOperationException($"无法创建目标类型 {toType.FullName} 的实例。");
            var properties = GetWritableProperties(toType);
            var type = fromInput.GetType();
            var sourceProperties = GetReadableProperties(type);
            var fallbackProperties = toInput == null
                ? null
                : GetReadableProperties(toInput.GetType());
            foreach (var info in properties)
            {
                if (!sourceProperties.TryGetValue(info.Name, out var property)) continue;
                var objTemp = property.GetValue(fromInput, null);
                //如果允许空，那么就没必要判断 toInput了，因为要把空值从fromInput赋值给objResult
                if (notNull && objTemp == null)
                {
                    if (toInput != null)
                    {
                        if (fallbackProperties == null
                            || !fallbackProperties.TryGetValue(info.Name, out var toProperty)) continue;
                        var toObjTemp = toProperty.GetValue(toInput, null);
                        if (toObjTemp == null)
                        {
                            continue;
                        }
                        var toPropertyName = toProperty.PropertyType.Name;
                        //如果为空，才从fromInput赋值进来，但实际上肯定为空
                        //if (info.GetValue(objResult) == null)
                        {
                            //这里需要实现如果属性是一个自定义Class，也需要序列化
                            if (info.PropertyType.Name == "String"
                                && (toPropertyName == "List`1" || !NotSerializeType.Contains(toPropertyName))
                                )
                            {
                                info.SetValue(objResult, JsonHelper.Serialize(toObjTemp), null);
                            }
                            else
                            {
                                info.SetValue(objResult, toObjTemp, null);
                            }
                        }
                    }
                    continue;
                }
                var propertyName = property.PropertyType.Name;
                //这里需要实现如果属性是一个自定义Class，也需要序列化
                if (info.PropertyType.Name == "String"
                    && (propertyName == "List`1" || !NotSerializeType.Contains(propertyName))
                    )
                {
                    info.SetValue(objResult, JsonHelper.Serialize(objTemp), null);
                }
                else if (info.PropertyType.Name == "Int32" && objTemp != null)
                {
                    var objTempStr = objTemp.ToString().ToLower();
                    if (objTempStr == "true" || objTempStr == "false")
                    {
                        info.SetValue(objResult, objTempStr == "true" ? 1 : 0, null);
                    }
                    else
                    {
                        info.SetValue(objResult, objTemp, null);
                    }
                }
                else
                {
                    info.SetValue(objResult, objTemp, null);
                }
            }
            //if (toInput != null)
            //{
            //    var fromProperties = fromType.GetProperties();
            //    var toGetType = toInput.GetType();
            //    foreach (var info in fromProperties)
            //    {
            //        if (!info.CanWrite) continue;
            //        var property = toGetType.GetProperty(info.Name);
            //        if (property == null) continue;
            //        var objTemp = property.GetValue(toInput, null);
            //        if (notNull && objTemp == null)
            //        {
            //            continue;
            //        }
            //        var propertyName = property.PropertyType.Name;
            //        if (info.GetValue(objResult) == null)
            //        {
            //            //这里需要实现如果属性是一个自定义Class，也需要序列化
            //            if (info.PropertyType.Name == "String"
            //                && (propertyName == "List`1" || !NotSerializeType.Contains(propertyName))
            //                )
            //            {
            //                info.SetValue(objResult, JsonConvert.SerializeObject(objTemp), null);
            //            }
            //            else
            //            {
            //                info.SetValue(objResult, objTemp, null);
            //            }
            //        }
            //    }
            //}
            return objResult;
        }

        private static System.Reflection.PropertyInfo[] GetWritableProperties(Type type)
        {
            return WritablePropertyCache.GetOrAdd(type, value => value
                .GetProperties()
                .Where(property => property.CanWrite)
                .ToArray());
        }

        private static Dictionary<string, System.Reflection.PropertyInfo> GetReadableProperties(Type type)
        {
            return ReadablePropertyCache.GetOrAdd(type, value => value
                .GetProperties()
                .Where(property => property.CanRead)
                .ToDictionary(property => property.Name, StringComparer.Ordinal));
        }
    }
}
