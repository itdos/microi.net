#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8ExtensionRegistry.cs
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：V8 扩展注册管理器
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using Jint;

namespace Microi.net
{
    /// <summary>
    /// V8 扩展注册管理器
    /// 
    /// 此类在 Microi.V8Engine 中负责：
    /// 1. 管理 V8 扩展对象的注册
    /// 2. 在应用启动时自动注册本库内的扩展（Alipay、WeChat 等）
    /// 3. 提供公开 API 供用户扩展自定义对象
    /// 
    /// 【所有扩展注册请在 V8BuiltInExtensions.cs 中管理】
    /// </summary>
    public static class V8ExtensionRegistry
    {
        private static readonly Dictionary<string, Func<object>> _extensions = 
            new Dictionary<string, Func<object>>(StringComparer.OrdinalIgnoreCase);

        private static readonly object _lockObj = new object();
        private static bool _initialized = false;

        /// <summary>
        /// 静态构造函数 - 自动在库加载时注册内置扩展
        /// </summary>
        static V8ExtensionRegistry()
        {
            InitializeBuiltInExtensions();
        }

        /// <summary>
        /// 初始化 Microi.V8Engine 内置扩展
        /// </summary>
        private static void InitializeBuiltInExtensions()
        {
            lock (_lockObj)
            {
                if (_initialized) return;

                // 调用专门的扩展配置类来注册所有内置扩展
                V8Extend.Initialize();

                _initialized = true;
            }
        }

        /// <summary>
        /// 注册一个 V8 扩展对象
        /// 
        /// 用途：Microi.V8Engine 内部自动注册，或用户自定义扩展
        /// </summary>
        /// <param name="name">扩展名称（如 "Alipay", "WeChat"）</param>
        /// <param name="factory">创建扩展对象的委托</param>
        /// <example>
        /// // 自动注册（在 V8BuiltInExtensions 中）
        /// Register("Alipay", () => new Alipay());
        /// 
        /// // 用户自定义扩展（可选，可在启动时调用）
        /// V8ExtensionRegistry.Register("CustomService", () => new MyCustomService());
        /// </example>
        public static void Register(string name, Func<object> factory)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentNullException(nameof(name));
            if (factory == null)
                throw new ArgumentNullException(nameof(factory));

            lock (_lockObj)
            {
                _extensions[name] = factory;
            }
        }

        /// <summary>
        /// 注销一个 V8 扩展对象
        /// </summary>
        public static void Unregister(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return;

            lock (_lockObj)
            {
                _extensions.Remove(name);
            }
        }

        /// <summary>
        /// 将所有已注册的扩展注入到 Jint 引擎
        /// 此方法由 V8Engine.Run() 自动调用，无需手动调用
        /// </summary>
        public static void InjectAll(Engine engine)
        {
            if (engine == null) return;

            lock (_lockObj)
            {
                // 为每个已注册的扩展创建实例并注入
                foreach (var kvp in _extensions)
                {
                    try
                    {
                        var extensionObject = kvp.Value();
                        if (extensionObject != null)
                        {
                            // 作为全局变量注入（用户脚本可直接访问：Alipay、WeChat）
                            engine.SetValue(kvp.Key, extensionObject);
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"注入扩展 '{kvp.Key}' 失败: {ex.Message}");
                    }
                }
            }

            // 将扩展也挂到 V8 对象上（用户脚本可访问：V8.Alipay、V8.WeChat）
            try
            {
                lock (_lockObj)
                {
                    var jsCode = string.Join("\n", GenerateV8PropertyAssignments());
                    if (!string.IsNullOrEmpty(jsCode))
                    {
                        engine.Execute(jsCode);
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"挂载扩展到 V8 对象失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 生成将全局扩展挂到 V8 对象的 JavaScript 代码
        /// </summary>
        private static IEnumerable<string> GenerateV8PropertyAssignments()
        {
            foreach (var name in _extensions.Keys)
            {
                yield return $"V8.{name} = {name};";
            }
        }

        /// <summary>
        /// 获取已注册的扩展名称列表（用于调试）
        /// </summary>
        public static IEnumerable<string> GetRegisteredNames()
        {
            lock (_lockObj)
            {
                return new List<string>(_extensions.Keys);
            }
        }

        /// <summary>
        /// 清空所有已注册的扩展
        /// </summary>
        public static void Clear()
        {
            lock (_lockObj)
            {
                _extensions.Clear();
                _initialized = false;
            }
        }
    }
}
