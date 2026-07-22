using System;
using System.Collections.Generic;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public class MicroiMQSendInfo
    {
        /// <summary>
        /// 消息所属租户。HTTP 调用时由认证 Token 覆盖，不能信任客户端自行指定的其它租户。
        /// 后台调用没有 Token 时必须显式传入，禁止回退到主租户。
        /// </summary>
        public string OsClient { get; set; }

        /// <summary>
        /// 可选的业务幂等事件 Id。生产重试时传入同一个值；为空时由服务端生成 ULID。
        /// </summary>
        public string EventId { get; set; }

        /// <summary>
        /// 队列名称
        /// </summary>
        public string QueueName { get; set; }
        /// <summary>
        /// 消息
        /// </summary>
        public object Message { get; set; }
        /// <summary>
        /// 生产消息的用户
        /// </summary>
        public CurrentToken CurrentToken { get; set; }
    }
}
