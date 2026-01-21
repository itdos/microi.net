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
        /// <summary>
        /// 创建Engine实例（从对象池获取）
        /// 注意：使用完后必须调用 ReturnEngine() 归还到池
        /// </summary>
        Engine CreateEngine(CreateV8EngineParam createV8EngineParam = null);

        /// <summary>
        /// 归还Engine到对象池（使用完Engine后必须调用此方法）
        /// </summary>
        void ReturnEngine(Engine engine);

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

