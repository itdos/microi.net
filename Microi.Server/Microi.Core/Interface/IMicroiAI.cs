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
using Dos.Common;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    /// <summary>
    /// AI接口
    /// </summary>
    public interface IMicroiAI
    {
        /// <summary>
        /// AI对话
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> Chat(AiParam param);
        
        /// <summary>
        /// 自然语言转SQL并执行查询
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> NL2SQL(NL2SQLParam param);
        
        /// <summary>
        /// 自然语言转SQL并执行查询（流式版本，支持实时输出）
        /// </summary>
        /// <param name="param"></param>
        /// <param name="onChunkReceived">流式数据块回调函数</param>
        /// <returns></returns>
        Task<DosResult> NL2SQLStreaming(NL2SQLParam param, Func<string, Task> onChunkReceived);
        
        /// <summary>
        /// 处理聊天消息（统一的AI聊天入口，包含意图识别）
        /// </summary>
        /// <param name="param">聊天参数</param>
        /// <param name="onChunkReceived">流式输出回调（可选）</param>
        /// <returns>返回AI回复结果</returns>
        Task<ChatMessageResult> HandleChatMessage(ChatMessageParam param, Func<string, Task> onChunkReceived = null);
        
        /// <summary>
        /// 初始化Schema缓存（使用向量数据库）
        /// </summary>
        /// <param name="osClient">租户标识</param>
        /// <param name="aiModel">AI模型（用于获取Qdrant配置）</param>
        Task<DosResult> InitializeSchemaCache(string osClient);
        
        /// <summary>
        /// 刷新Schema缓存（重建Qdrant向量数据库）
        /// </summary>
        /// <param name="osClient">租户标识</param>
        /// <param name="aiModel">AI模型（用于获取Qdrant配置）</param>
        Task<DosResult> RefreshSchemaCache(string osClient, string aiModel);
        
        /// <summary>
        /// 差量同步Schema缓存（只同步新增/修改的表和字段）
        /// </summary>
        /// <param name="osClient">租户标识</param>
        Task<DosResult> IncrementalSyncSchemaCache(string osClient);

        /// <summary>
        /// 自然语言转V8引擎代码（流式输出，打字机效果）
        /// </summary>
        /// <param name="param">请求参数</param>
        /// <param name="onChunkReceived">流式数据块回调函数</param>
        /// <returns></returns>
        Task<DosResult> NL2V8Engine(NL2V8Param param, Func<string, Task> onChunkReceived);

        /// <summary>
        /// 自然语言转V8引擎代码（非流式版本）
        /// </summary>
        /// <param name="param">请求参数</param>
        /// <returns></returns>
        Task<DosResult> NL2V8Engine(NL2V8Param param);
    }
}
