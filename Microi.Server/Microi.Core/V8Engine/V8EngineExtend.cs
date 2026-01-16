#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8EngineExtend.cs
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：V8引擎扩展基类（抽象声明，具体实现在 Microi.V8Engine）
*******************************************************/
#endregion

namespace Microi.net
{
    /// <summary>
    /// V8引擎扩展基类（抽象声明）
    /// 
    /// 设计说明：
    /// - 此类在 Microi.Core 中声明，定义扩展接口规范（虚属性）
    /// - 具体的扩展方法实现在 Microi.V8Engine/V8EngineExtend.cs 中（override）
    /// - 这样可以避免循环依赖：Microi.Core 不依赖 Microi.V8Engine
    /// - V8EngineParam 继承此基类，从而获得扩展功能
    /// </summary>
    public partial class V8EngineExtend
    {
        // 虚属性声明（具体实现由子类提供）
        // 这样 V8EngineParam 继承时可以访问这些属性
    }
}

