using System;
using System.Collections.Generic;

#nullable enable

namespace Microi.net
{
    public class AiParam
    {
        public string? UserChatMsg { get; set; }
        public string? SystemChatMsg { get; set; }
        public string? ApiKey { get; set; }
        public string? Endpoint { get; set; }
        public string? AiModel { get; set; }
        /// <summary>
        /// mic_ai 表主键。前端传入后，后端优先按 Id 精确读取模型配置。
        /// </summary>
        public string? AiModelId { get; set; }
        /// <summary>
        /// 兼容部分调用方使用 AiId 传递 mic_ai 主键。
        /// </summary>
        public string? AiId { get; set; }
        public string? OsClient { get; set; }
        /// <summary>
        /// 当前登录用户 Id，由 Controller 从 Token 注入，前端不要自行伪造。
        /// </summary>
        public string? CurrentUserId { get; set; }
        /// <summary>
        /// 当前登录用户名称，由 Controller 从 Token 注入。
        /// </summary>
        public string? CurrentUserName { get; set; }
        /// <summary>
        /// 对话Id。前端只传这个Id，后端会从 mic_ai_record 读取历史并压缩上下文。
        /// </summary>
        public string? ConversationId { get; set; }
        /// <summary>
        /// 对话来源，如 ai-engine-workbench、ai-app-workbench。
        /// </summary>
        public string? Source { get; set; }
        /// <summary>
        /// 对话模式，如 chat、data、code、builder、project。
        /// </summary>
        public string? Mode { get; set; }
        /// <summary>
        /// 推理强度：auto / low / medium / high。auto 表示不向模型传 reasoning_effort。
        /// 仅对支持该参数的推理模型生效。
        /// </summary>
        public string? ReasoningEffort { get; set; }
        public List<AiAttachmentParam>? Attachments { get; set; }
        /// <summary>
        /// 对话历史。推荐仅由后端上下文压缩逻辑填充，前端不要长期传入大量历史。
        /// </summary>
        public List<ChatHistoryItem>? ChatHistory { get; set; }

    }

    /// <summary>
    /// AI 对话附件。图片会随请求传给支持视觉的模型；文本类附件会拼入用户消息。
    /// </summary>
    public class AiAttachmentParam
    {
        public string? FileName { get; set; }
        public string? ContentType { get; set; }
        public string? FileByteBase64 { get; set; }
        public string? Text { get; set; }
        public long Size { get; set; }
    }

    /// <summary>
    /// 自然语言转SQL参数
    /// </summary>
    public class NL2SQLParam
    {
        /// <summary>
        /// 用户的自然语言问题，如：今天订单数量多少
        /// </summary>
        public string? Question { get; set; }
        
        /// <summary>
        /// AI模型名称
        /// </summary>
        public string? AiModel { get; set; }
        /// <summary>
        /// mic_ai 表主键。前端传入后，后端优先按 Id 精确读取模型配置。
        /// </summary>
        public string? AiModelId { get; set; }
        /// <summary>
        /// 兼容部分调用方使用 AiId 传递 mic_ai 主键。
        /// </summary>
        public string? AiId { get; set; }
        /// <summary>
        /// 当前登录用户 Id，由 Controller 从 Token 注入。
        /// </summary>
        public string? CurrentUserId { get; set; }
        /// <summary>
        /// 当前登录用户名称，由 Controller 从 Token 注入。
        /// </summary>
        public string? CurrentUserName { get; set; }
        /// <summary>
        /// 推理强度：auto / low / medium / high。
        /// </summary>
        public string? ReasoningEffort { get; set; }
        
        /// <summary>
        /// 租户标识
        /// </summary>
        public string? OsClient { get; set; }
        
        /// <summary>
        /// 允许查询的表名列表（白名单），为空则允许所有表
        /// </summary>
        public List<string>? AllowedTables { get; set; }
    }

    /// <summary>
    /// NL2SQL返回结果
    /// </summary>
    public class NL2SQLResult
    {
        /// <summary>
        /// 用户的原始问题
        /// </summary>
        public string? Question { get; set; }
        
        /// <summary>
        /// AI生成的SQL语句
        /// </summary>
        public string? GeneratedSQL { get; set; }
        
        /// <summary>
        /// SQL执行结果
        /// </summary>
        public object? QueryResult { get; set; }
        
        /// <summary>
        /// 自然语言答案
        /// </summary>
        public string? Answer { get; set; }

        /// <summary>
        /// 可展示给前端的分析过程摘要。
        /// 注意：这里只放可审计的执行步骤，不输出模型内部隐式推理。
        /// </summary>
        public string? Thinking { get; set; }
        
        /// <summary>
        /// SQL来源：模板匹配 / AI生成
        /// </summary>
        public string? Source { get; set; }
    }

    /// <summary>
    /// 聊天消息参数（统一入口）
    /// </summary>
    public class ChatMessageParam
    {
        /// <summary>
        /// 用户问题
        /// </summary>
        public string? Question { get; set; }
        
        /// <summary>
        /// AI模型名称
        /// </summary>
        public string? AiModel { get; set; }
        
        /// <summary>
        /// 租户标识
        /// </summary>
        public string? OsClient { get; set; }
        
        /// <summary>
        /// 允许查询的表名列表（白名单），为空则允许所有表
        /// </summary>
        public List<string>? AllowedTables { get; set; }
    }

    /// <summary>
    /// 自然语言转V8引擎代码参数
    /// </summary>
    public class NL2V8Param
    {
        /// <summary>
        /// 用户的自然语言需求描述，如：帮我获取最新的一条生产订单数据
        /// </summary>
        public string? Question { get; set; }

        /// <summary>
        /// AI模型名称
        /// </summary>
        public string? AiModel { get; set; }

        /// <summary>
        /// 租户标识
        /// </summary>
        public string? OsClient { get; set; }

        /// <summary>
        /// 用户编辑器中的当前代码（为空表示编辑器无代码，AI应生成新代码；有值表示用户在询问已有代码相关问题）
        /// </summary>
        public string? CurrentCode { get; set; }

        /// <summary>
        /// 推理强度：auto / low / medium / high。
        /// </summary>
        public string? ReasoningEffort { get; set; }

        /// <summary>
        /// 对话历史（用于多轮对话上下文），按时间正序排列，最多传最近10条
        /// </summary>
        public List<ChatHistoryItem>? ChatHistory { get; set; }
    }

    /// <summary>
    /// 对话历史消息项
    /// </summary>
    public class ChatHistoryItem
    {
        /// <summary>
        /// 角色：system / user / ai / assistant
        /// </summary>
        public string? Role { get; set; }

        /// <summary>
        /// 消息内容
        /// </summary>
        public string? Content { get; set; }
    }

    /// <summary>
    /// NL2V8Engine返回结果
    /// </summary>
    public class NL2V8Result
    {
        /// <summary>
        /// 用户的原始需求描述
        /// </summary>
        public string? Question { get; set; }

        /// <summary>
        /// AI生成的V8引擎代码
        /// </summary>
        public string? GeneratedCode { get; set; }

        /// <summary>
        /// 检索到的相关V8文档章节
        /// </summary>
        public List<string>? RelevantDocs { get; set; }

        /// <summary>
        /// 检索到的相关数据库表
        /// </summary>
        public List<string>? RelevantTables { get; set; }

        /// <summary>
        /// 来源信息
        /// </summary>
        public string? Source { get; set; }
    }

    /// <summary>
    /// 聊天消息处理结果
    /// </summary>
    public class ChatMessageResult
    {
        /// <summary>
        /// 是否成功
        /// </summary>
        public bool Success { get; set; }
        
        /// <summary>
        /// 响应类型：普通聊天 / NL2SQL数据查询 / 异常
        /// </summary>
        public string? ResponseType { get; set; }
        
        /// <summary>
        /// AI回复内容
        /// </summary>
        public string? Content { get; set; }
        
        /// <summary>
        /// SQL查询结果（仅NL2SQL模式）
        /// </summary>
        public object? QueryResult { get; set; }
        
        /// <summary>
        /// 生成的SQL（仅NL2SQL模式）
        /// </summary>
        public string? GeneratedSQL { get; set; }
    }

}

