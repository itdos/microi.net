#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) iTdos
* CLR 版本: 4.0.30319.18408
* 创 建 人：steven hu
* 电子邮箱：
* 官方网站：www.iTdos.com
* 创建日期：2010-2-10
* 文件描述：
******************************************************
* 修 改 人：iTdos
* 修改日期：2018-05-17
* 备注描述：
*******************************************************/
#endregion
namespace Dos.ORM
{
    using System;
    using System.Collections.Concurrent;
    using System.Reflection;
    using System.Reflection.Emit;

    /// <summary>
    /// 
    /// </summary>
    /// <param name="target"></param>
    /// <param name="parameters"></param>
    /// <returns></returns>
    public delegate object FastInvokeHandler(object target, object[] parameters);

    /// <summary>
    /// 
    /// </summary>
    /// <returns></returns>
    public delegate object FastCreateInstanceHandler();

    /// <summary>
    /// 
    /// </summary>
    /// <param name="target"></param>
    /// <returns></returns>
    public delegate object FastPropertyGetHandler(object target);

    /// <summary>
    /// 
    /// </summary>
    /// <param name="target"></param>
    /// <param name="parameter"></param>
    public delegate void FastPropertySetHandler(object target, object parameter);

    /// <summary>
    /// 
    /// </summary>
    public static class DynamicCalls
    {
        /// <summary>
        /// 用于存放GetMethodInvoker的Dictionary
        /// </summary>
        private static readonly ConcurrentDictionary<MethodInfo, FastInvokeHandler> dictInvoker
            = new ConcurrentDictionary<MethodInfo, FastInvokeHandler>();
        private static readonly object invokerSync = new object();

        public static FastInvokeHandler GetMethodInvoker(MethodInfo methodInfo)
        {
            if (methodInfo == null) throw new ArgumentNullException(nameof(methodInfo));
            if (dictInvoker.TryGetValue(methodInfo, out var cached)) return cached;
            lock (invokerSync)
            {
                if (dictInvoker.TryGetValue(methodInfo, out cached)) return cached;

                DynamicMethod dynamicMethod = new DynamicMethod(string.Empty, typeof(object), new Type[] { typeof(object), typeof(object[]) }, methodInfo.DeclaringType.Module);

                ILGenerator ilGenerator = dynamicMethod.GetILGenerator();

                ParameterInfo[] parameters = methodInfo.GetParameters();

                Type[] paramTypes = new Type[parameters.Length];

                for (int i = 0; i < paramTypes.Length; i++)
                {
                    if (parameters[i].ParameterType.IsByRef)
                        paramTypes[i] = parameters[i].ParameterType.GetElementType();
                    else
                        paramTypes[i] = parameters[i].ParameterType;
                }

                LocalBuilder[] locals = new LocalBuilder[paramTypes.Length];

                for (int i = 0; i < paramTypes.Length; i++)
                {
                    locals[i] = ilGenerator.DeclareLocal(paramTypes[i], true);
                }

                for (int i = 0; i < paramTypes.Length; i++)
                {
                    ilGenerator.Emit(OpCodes.Ldarg_1);
                    EmitFastInt(ilGenerator, i);
                    ilGenerator.Emit(OpCodes.Ldelem_Ref);
                    EmitCastToReference(ilGenerator, paramTypes[i]);
                    ilGenerator.Emit(OpCodes.Stloc, locals[i]);
                }

                if (!methodInfo.IsStatic)
                {
                    ilGenerator.Emit(OpCodes.Ldarg_0);
                    EmitTarget(ilGenerator, methodInfo.DeclaringType);
                }

                for (int i = 0; i < paramTypes.Length; i++)
                {
                    if (parameters[i].ParameterType.IsByRef)
                        ilGenerator.Emit(OpCodes.Ldloca_S, locals[i]);
                    else
                        ilGenerator.Emit(OpCodes.Ldloc, locals[i]);
                }
                ilGenerator.EmitCall(
                    methodInfo.IsStatic || methodInfo.DeclaringType.IsValueType ? OpCodes.Call : OpCodes.Callvirt,
                    methodInfo,
                    null);

                if (methodInfo.ReturnType == typeof(void))
                {
                    ilGenerator.Emit(OpCodes.Ldnull);
                }
                else
                {
                    EmitBoxIfNeeded(ilGenerator, methodInfo.ReturnType);
                }
                for (int i = 0; i < paramTypes.Length; i++)
                {
                    if (parameters[i].ParameterType.IsByRef)
                    {
                        ilGenerator.Emit(OpCodes.Ldarg_1);
                        EmitFastInt(ilGenerator, i);
                        ilGenerator.Emit(OpCodes.Ldloc, locals[i]);
                        if (locals[i].LocalType.IsValueType)
                            ilGenerator.Emit(OpCodes.Box, locals[i].LocalType);
                        ilGenerator.Emit(OpCodes.Stelem_Ref);
                    }
                }
                ilGenerator.Emit(OpCodes.Ret);
                FastInvokeHandler invoker = (FastInvokeHandler)dynamicMethod.CreateDelegate(typeof(FastInvokeHandler));
                dictInvoker[methodInfo] = invoker;
                return invoker;
            }
        }

        /// <summary>
        /// 用于存放GetInstanceCreator的Dictionary
        /// </summary>
        private static readonly ConcurrentDictionary<Type, FastCreateInstanceHandler> dictCreator
            = new ConcurrentDictionary<Type, FastCreateInstanceHandler>();
        private static readonly object creatorSync = new object();

        /// <summary>
        /// 
        /// </summary>
        /// <param name="type"></param>
        /// <returns></returns>
        public static FastCreateInstanceHandler GetInstanceCreator(Type type)
        {
            if (type == null) throw new ArgumentNullException(nameof(type));
            if (dictCreator.TryGetValue(type, out var cached)) return cached;
            lock (creatorSync)
            {
                if (dictCreator.TryGetValue(type, out cached)) return cached;
                DynamicMethod dynamicMethod = new DynamicMethod(string.Empty, typeof(object), new Type[0], typeof(DynamicCalls).Module);

                ILGenerator ilGenerator = dynamicMethod.GetILGenerator();
                if (type.IsValueType)
                {
                    var value = ilGenerator.DeclareLocal(type);
                    ilGenerator.Emit(OpCodes.Ldloca_S, value);
                    ilGenerator.Emit(OpCodes.Initobj, type);
                    ilGenerator.Emit(OpCodes.Ldloc, value);
                    ilGenerator.Emit(OpCodes.Box, type);
                }
                else
                {
                    if (type.IsAbstract)
                        throw new ArgumentException("抽象类型不能创建实例。", nameof(type));
                    var constructor = type.GetConstructor(Type.EmptyTypes)
                        ?? throw new MissingMethodException(type.FullName, ".ctor()");
                    ilGenerator.Emit(OpCodes.Newobj, constructor);
                }

                ilGenerator.Emit(OpCodes.Ret);

                FastCreateInstanceHandler creator = (FastCreateInstanceHandler)dynamicMethod.CreateDelegate(typeof(FastCreateInstanceHandler));

                dictCreator[type] = creator;

                return creator;
            }
        }

        /// <summary>
        /// 用于存放GetPropertyGetter的Dictionary
        /// </summary>
        private static readonly ConcurrentDictionary<PropertyInfo, FastPropertyGetHandler> dictGetter
            = new ConcurrentDictionary<PropertyInfo, FastPropertyGetHandler>();
        private static readonly object getterSync = new object();

        public static FastPropertyGetHandler GetPropertyGetter(PropertyInfo propInfo)
        {
            if (propInfo == null) throw new ArgumentNullException(nameof(propInfo));
            if (propInfo.GetIndexParameters().Length != 0)
                throw new ArgumentException("索引属性不支持无参数快速读取。", nameof(propInfo));
            var getMethod = propInfo.GetGetMethod()
                ?? throw new ArgumentException("属性没有公共 getter。", nameof(propInfo));
            if (dictGetter.TryGetValue(propInfo, out var cached)) return cached;
            lock (getterSync)
            {
                if (dictGetter.TryGetValue(propInfo, out cached)) return cached;

                DynamicMethod dynamicMethod = new DynamicMethod(string.Empty, typeof(object), new Type[] { typeof(object) }, propInfo.DeclaringType.Module);

                ILGenerator ilGenerator = dynamicMethod.GetILGenerator();

                if (!getMethod.IsStatic)
                {
                    ilGenerator.Emit(OpCodes.Ldarg_0);
                    EmitTarget(ilGenerator, propInfo.DeclaringType);
                }

                ilGenerator.EmitCall(
                    getMethod.IsStatic || propInfo.DeclaringType.IsValueType ? OpCodes.Call : OpCodes.Callvirt,
                    getMethod,
                    null);

                EmitBoxIfNeeded(ilGenerator, propInfo.PropertyType);

                ilGenerator.Emit(OpCodes.Ret);

                FastPropertyGetHandler getter = (FastPropertyGetHandler)dynamicMethod.CreateDelegate(typeof(FastPropertyGetHandler));

                dictGetter[propInfo] = getter;

                return getter;
            }
        }

        /// <summary>
        /// 用于存放SetPropertySetter的Dictionary
        /// </summary>
        private static readonly ConcurrentDictionary<PropertyInfo, FastPropertySetHandler> dictSetter
            = new ConcurrentDictionary<PropertyInfo, FastPropertySetHandler>();
        private static readonly object setterSync = new object();

        public static FastPropertySetHandler GetPropertySetter(PropertyInfo propInfo)
        {
            if (propInfo == null) throw new ArgumentNullException(nameof(propInfo));
            if (propInfo.GetIndexParameters().Length != 0)
                throw new ArgumentException("索引属性不支持无参数快速写入。", nameof(propInfo));
            var setMethod = propInfo.GetSetMethod()
                ?? throw new ArgumentException("属性没有公共 setter。", nameof(propInfo));
            if (dictSetter.TryGetValue(propInfo, out var cached)) return cached;
            lock (setterSync)
            {
                if (dictSetter.TryGetValue(propInfo, out cached)) return cached;

                DynamicMethod dynamicMethod = new DynamicMethod(string.Empty, null, new Type[] { typeof(object), typeof(object) }, propInfo.DeclaringType.Module);

                ILGenerator ilGenerator = dynamicMethod.GetILGenerator();

                if (!setMethod.IsStatic)
                {
                    ilGenerator.Emit(OpCodes.Ldarg_0);
                    EmitTarget(ilGenerator, propInfo.DeclaringType);
                }

                ilGenerator.Emit(OpCodes.Ldarg_1);

                EmitCastToReference(ilGenerator, propInfo.PropertyType);

                ilGenerator.EmitCall(
                    setMethod.IsStatic || propInfo.DeclaringType.IsValueType ? OpCodes.Call : OpCodes.Callvirt,
                    setMethod,
                    null);

                ilGenerator.Emit(OpCodes.Ret);

                FastPropertySetHandler setter = (FastPropertySetHandler)dynamicMethod.CreateDelegate(typeof(FastPropertySetHandler));

                dictSetter[propInfo] = setter;

                return setter;
            }
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="ilGenerator"></param>
        /// <param name="type"></param>
        private static void EmitCastToReference(ILGenerator ilGenerator, System.Type type)
        {
            if (type.IsValueType)
            {
                ilGenerator.Emit(OpCodes.Unbox_Any, type);
            }
            else
            {
                ilGenerator.Emit(OpCodes.Castclass, type);
            }
        }

        private static void EmitTarget(ILGenerator ilGenerator, Type declaringType)
        {
            if (declaringType == null)
                throw new ArgumentException("属性缺少声明类型。", nameof(declaringType));
            if (declaringType.IsValueType)
            {
                ilGenerator.Emit(OpCodes.Unbox, declaringType);
            }
            else
            {
                ilGenerator.Emit(OpCodes.Castclass, declaringType);
            }
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="ilGenerator"></param>
        /// <param name="type"></param>
        private static void EmitBoxIfNeeded(ILGenerator ilGenerator, System.Type type)
        {
            if (type.IsValueType)
            {
                ilGenerator.Emit(OpCodes.Box, type);
            }
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="ilGenerator"></param>
        /// <param name="value"></param>
        private static void EmitFastInt(ILGenerator ilGenerator, int value)
        {
            switch (value)
            {
                case -1:
                    ilGenerator.Emit(OpCodes.Ldc_I4_M1);
                    return;
                case 0:
                    ilGenerator.Emit(OpCodes.Ldc_I4_0);
                    return;
                case 1:
                    ilGenerator.Emit(OpCodes.Ldc_I4_1);
                    return;
                case 2:
                    ilGenerator.Emit(OpCodes.Ldc_I4_2);
                    return;
                case 3:
                    ilGenerator.Emit(OpCodes.Ldc_I4_3);
                    return;
                case 4:
                    ilGenerator.Emit(OpCodes.Ldc_I4_4);
                    return;
                case 5:
                    ilGenerator.Emit(OpCodes.Ldc_I4_5);
                    return;
                case 6:
                    ilGenerator.Emit(OpCodes.Ldc_I4_6);
                    return;
                case 7:
                    ilGenerator.Emit(OpCodes.Ldc_I4_7);
                    return;
                case 8:
                    ilGenerator.Emit(OpCodes.Ldc_I4_8);
                    return;
            }
            if (value > -129 && value < 128)
            {
                ilGenerator.Emit(OpCodes.Ldc_I4_S, (SByte)value);
            }
            else
            {
                ilGenerator.Emit(OpCodes.Ldc_I4, value);
            }
        }
    }
}

