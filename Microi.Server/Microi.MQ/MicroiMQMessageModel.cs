using System;
using System.Collections.Generic;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public class MicroiMQMessageModel
    {
        /// <summary>
        /// 全局稳定事件 Id。生产者重试时应复用该 Id，消费者据此实现业务幂等。
        /// </summary>
        public string EventId { get; set; }

        /// <summary>
        /// 兼容历史消息字段。新消息同时写入 EventId 与 Id，值保持一致。
        /// </summary>
        public string Id { get; set; }

        /// <summary>
        /// 消息所属租户。消费者必须与监听队列的租户进行一致性校验。
        /// </summary>
        public string OsClient { get; set; }

        /// <summary>W3C调用链上下文；仅用于诊断，不参与消息身份校验。</summary>
        public string TraceParent { get; set; }
        public string TraceState { get; set; }

        /// <summary>
        /// 暂时无用
        /// </summary>
        // public int Count {  get; set; }
        /// <summary>
        /// 消息内容
        /// </summary>

        public object Message { get; set; }
        /// <summary>
        /// 这里没必要发送整个用户的token，发送Id即可 ，消费消息时根据Id再次从redis取token
        /// </summary>
        public string CurrentUserId { get; set; }

        [JsonIgnore]
        public string StableEventId => string.IsNullOrWhiteSpace(EventId) ? Id : EventId;
    }
}
