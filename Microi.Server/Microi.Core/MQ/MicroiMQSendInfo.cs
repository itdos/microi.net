using System;
using System.Collections.Generic;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public class MicroiMQSendInfo
    {
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
