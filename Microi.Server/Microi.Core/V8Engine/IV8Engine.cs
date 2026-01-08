#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Threading.Tasks;
using Dos.Common;
using Jint;

namespace Microi.net
{
    /// <summary>
    /// V8引擎接口
    /// </summary>
	public interface IV8Engine
	{
        Engine CreateEngine();
        /// <summary>
        /// 执行V8引擎代码
        /// </summary>
        /// <param name="v8EngineParam"></param>
        /// <returns></returns>
        Task<DosResult<V8EngineParam>> Run(V8EngineParam v8EngineParam);
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        // V8EngineParam RunAsync(V8EngineParam v8EngineParam);//Task<V8EngineParam>
    }
}

