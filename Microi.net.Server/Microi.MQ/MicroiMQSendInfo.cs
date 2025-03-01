using System;
using System.Collections.Generic;
using System.Text;

namespace Microi.net
{
    public  class MicroiMQSendInfo
    {
        /// <summary>
        /// 队列名称
        /// </summary>
        public string QueueName {  get; set; }
        /// <summary>
        /// 消息
        /// </summary>
        public string Msg { get; set; }
    }
}
