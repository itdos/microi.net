#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8BuiltInExtensions.cs
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：V8 内置扩展注册（请在此处管理所有内置扩展）
*******************************************************/
#endregion

namespace Microi.net
{
    /// <summary>
    /// V8 内置扩展注册配置
    /// 
    /// ============ 使用说明 ============
    /// 
    /// 此类用于注册 Microi.V8Engine 提供的所有内置扩展对象
    /// 用户在脚本中可以访问这些扩展：【V8.Alipay】、【V8.WeChat】 等
    /// 
    /// 【如何在 Microi.V8Engine 中添加新的内置扩展】
    /// 1. 在此类的 Initialize() 方法中添加一行：
    ///    V8ExtensionRegistry.Register("ExtensionName", () => new YourExtension());
    /// 2. 重新编译 Microi.V8Engine
    /// 3. 用户脚本就可以立即使用：V8.ExtensionName
    /// 
    /// 【示例】
    /// // 添加新的支付接口扩展
    /// V8ExtensionRegistry.Register("NewPay", () => new NewPayService());
    /// 
    /// ================================
    /// </summary>
    public static class V8Extend
    {
        /// <summary>
        /// 初始化所有内置扩展
        /// 此方法由 V8ExtensionRegistry 的静态构造函数自动调用
        /// </summary>
        internal static void Initialize()
        {
            // ============================================
            // 【支付相关扩展】
            // ============================================
            
            /// <summary>支付宝支付接口</summary>
            V8ExtensionRegistry.Register("Alipay", () => new Alipay());

            /// <summary>支付宝 V3 接口</summary>
            V8ExtensionRegistry.Register("AlipayV3", () => new AlipayV3());

            // ============================================
            // 【社交相关扩展】
            // ============================================
            
            /// <summary>微信接口（支付、消息等）</summary>
            V8ExtensionRegistry.Register("WeChat", () => new WeChat());

            // ============================================
            // 【DNS 相关扩展】
            // ============================================
            
            /// <summary>阿里 DNS 接口</summary>
            V8ExtensionRegistry.Register("Alidns", () => new Alidns());

            V8ExtensionRegistry.Register("System", () => new SystemInfo());

            // ============================================
            // 【用户自定义扩展 - 在此添加你的扩展】
            // ============================================
            // 示例：
            // V8ExtensionRegistry.Register("CustomService", () => new CustomService());
        }
    }
}
