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
using System.Threading;
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
        /// 返回 AI 当前实际使用的统一授权状态。
        /// License 验证接口也必须读取此结果，避免授权页与 AI 功能判断分叉。
        /// </summary>
        OnlineAiLicenseState GetOnlineAiLicenseState();

        /// <summary>
        /// AI对话
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> Chat(AiParam param);

        /// <summary>
        /// 获取当前用户 AI 中转站 Token 额度。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> GetRelayTokenSummary(AiParam param);

        /// <summary>
        /// 构建无需调用大模型即可直接回答的运行态问题（如当前模型）。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        string TryBuildBuiltinChatReply(AiParam param);

        /// <summary>
        /// 识别 AI 引擎语义意图。Controller 只负责转发，具体规则和 AI 路由逻辑放在 AI 服务中维护。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<(string Mode, string Reason, string Source)> ResolveIntentAsync(AiParam param);

        /// <summary>
        /// 返回可直接用于 HTTP/SignalR 传输的意图识别结果。
        /// 模式名称和路由语义由 AI 领域层统一维护，接口层不重复实现。
        /// </summary>
        Task<DosResult> ResolveIntentResultAsync(AiParam param);

        /// <summary>
        /// AI对话（流式输出）
        /// </summary>
        /// <param name="param"></param>
        /// <param name="onChunkReceived">流式数据块回调函数</param>
        /// <returns></returns>
        Task<DosResult> ChatStream(AiParam param, Func<string, Task> onChunkReceived);

        /// <summary>
        /// 执行完整 AI 对话流程：内置回答、历史上下文恢复和模型调用。
        /// MVC 层只负责绑定可信用户/租户并传输结果。
        /// </summary>
        Task<DosResult> ChatWithContextAsync(AiParam param);

        /// <summary>
        /// 执行完整流式 AI 对话流程：内置回答、历史上下文恢复和模型调用。
        /// </summary>
        Task<DosResult> ChatStreamWithContextAsync(
            AiParam param,
            Func<string, Task> onChunkReceived);
        
        /// <summary>
        /// 自然语言转SQL并执行查询
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        Task<DosResult> NL2SQL(NL2SQLParam param);

        /// <summary>
        /// 根据已认证的服务端用户与租户上下文，为 NL2SQL 构建不可伪造的
        /// 表白名单、行数上限和旧数据库兼容授权。
        /// </summary>
        Task<DosResult> AuthorizeNl2SqlAsync(
            NL2SQLParam param,
            object currentUser,
            string authenticatedOsClient);

        /// <summary>
        /// 使用已认证用户和租户执行完整 NL2SQL 授权与查询。
        /// </summary>
        Task<DosResult> NL2SQLAuthorizedAsync(
            NL2SQLParam param,
            object currentUser,
            string authenticatedOsClient);

        /// <summary>
        /// 从服务端持久化记录恢复当前用户的 AI 会话上下文，并在需要时完成
        /// 历史过滤与摘要压缩。HTTP/SignalR 层只负责写入可信身份。
        /// </summary>
        Task ApplyConversationContextAsync(AiParam param);

        /// <summary>
        /// 修改当前用户整组 AI 对话标题。
        /// </summary>
        Task<DosResult> UpdateConversationTitleAsync(
            string currentUserId,
            string authenticatedOsClient,
            string conversationId,
            string title,
            string source);

        /// <summary>
        /// 获取当前租户可配置到 NL2SQL 角色策略的普通业务表。
        /// </summary>
        Task<DosResult> GetNl2SqlPolicyTableOptionsAsync(
            string authenticatedOsClient);
        
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
        /// SignalR 等可信服务端入口的完整聊天编排。
        /// AI 领域层负责选择租户模型、构建数据白名单并执行聊天；
        /// 传输层不得直接查询 mic_ai 或拼装授权结果。
        /// </summary>
        Task<ChatMessageResult> HandleTrustedChatMessageAsync(
            ChatMessageParam param,
            object currentUser,
            string authenticatedOsClient,
            Func<string, Task> onChunkReceived = null);
        
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

        /// <summary>
        /// 使用可信服务端身份创建 MiniMax 视频异步任务。
        /// </summary>
        Task<DosResult> CreateMiniMaxVideoAsync(
            string currentUserId,
            string authenticatedOsClient,
            MiniMaxVideoCreateParam param,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// 使用可信服务端 Provider Key 查询 MiniMax Token Plan 脱敏用量。
        /// </summary>
        Task<DosResult> GetMiniMaxTokenPlanRemainsAsync(
            string currentUserId,
            string authenticatedOsClient,
            object currentUser,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// 使用可信服务端身份和签名句柄查询 MiniMax 视频任务。
        /// </summary>
        Task<DosResult> GetMiniMaxVideoTaskAsync(
            string currentUserId,
            string authenticatedOsClient,
            MiniMaxVideoTaskParam param,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// 使用可信服务端身份和签名句柄获取 MiniMax 临时下载地址。
        /// </summary>
        Task<DosResult> GetMiniMaxVideoFileAsync(
            string currentUserId,
            string authenticatedOsClient,
            MiniMaxVideoFileParam param,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// 将 MiniMax 视频转存到当前租户 HDFS；currentUser 必须是服务端认证上下文。
        /// </summary>
        Task<DosResult> PersistMiniMaxVideoFileAsync(
            string currentUserId,
            string authenticatedOsClient,
            object currentUser,
            MiniMaxVideoFileParam param,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// 使用可信服务端身份生成 MiniMax 纯音乐并直接转存当前租户 HDFS。
        /// </summary>
        Task<DosResult> GenerateMiniMaxMusicAsync(
            string currentUserId,
            string authenticatedOsClient,
            object currentUser,
            MiniMaxMusicGenerateParam param,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// 使用可信服务端身份生成 MiniMax 男女短对白并直接转存当前租户 HDFS。
        /// </summary>
        Task<DosResult> GenerateMiniMaxSpeechAsync(
            string currentUserId,
            string authenticatedOsClient,
            object currentUser,
            MiniMaxSpeechGenerateParam param,
            CancellationToken cancellationToken = default);
    }
}
