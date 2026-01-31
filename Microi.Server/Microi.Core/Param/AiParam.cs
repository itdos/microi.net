using System;
using System.Collections.Generic;

namespace Microi.net
{
    public class AiParam
    {
        public string UserChatMsg { get; set; }
        public string SystemChatMsg { get; set; }
        public string ApiKey { get; set; }
        public string Endpoint { get; set; }
        public string AiModel { get; set; }

    }

    /// <summary>
    /// 自然语言转SQL参数
    /// </summary>
    public class NL2SQLParam
    {
        /// <summary>
        /// 用户的自然语言问题，如：今天订单数量多少
        /// </summary>
        public string Question { get; set; }
        
        /// <summary>
        /// AI模型名称
        /// </summary>
        public string AiModel { get; set; }
        
        /// <summary>
        /// 租户标识
        /// </summary>
        public string OsClient { get; set; }
        
        /// <summary>
        /// 允许查询的表名列表（白名单），为空则允许所有表
        /// </summary>
        public List<string> AllowedTables { get; set; }
    }

    /// <summary>
    /// NL2SQL返回结果
    /// </summary>
    public class NL2SQLResult
    {
        /// <summary>
        /// 用户的原始问题
        /// </summary>
        public string Question { get; set; }
        
        /// <summary>
        /// AI生成的SQL语句
        /// </summary>
        public string GeneratedSQL { get; set; }
        
        /// <summary>
        /// SQL执行结果
        /// </summary>
        public object QueryResult { get; set; }
        
        /// <summary>
        /// 自然语言答案
        /// </summary>
        public string Answer { get; set; }
        
        /// <summary>
        /// SQL来源：模板匹配 / AI生成
        /// </summary>
        public string Source { get; set; }
    }

    /// <summary>
    /// 聊天消息参数（统一入口）
    /// </summary>
    public class ChatMessageParam
    {
        /// <summary>
        /// 用户问题
        /// </summary>
        public string Question { get; set; }
        
        /// <summary>
        /// AI模型名称
        /// </summary>
        public string AiModel { get; set; }
        
        /// <summary>
        /// 租户标识
        /// </summary>
        public string OsClient { get; set; }
        
        /// <summary>
        /// 允许查询的表名列表（白名单），为空则允许所有表
        /// </summary>
        public List<string> AllowedTables { get; set; }
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
        public string ResponseType { get; set; }
        
        /// <summary>
        /// AI回复内容
        /// </summary>
        public string Content { get; set; }
        
        /// <summary>
        /// SQL查询结果（仅NL2SQL模式）
        /// </summary>
        public object QueryResult { get; set; }
        
        /// <summary>
        /// 生成的SQL（仅NL2SQL模式）
        /// </summary>
        public string GeneratedSQL { get; set; }
    }

}

