using System;
using System.Collections.Generic;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public class MicroiMQMessageModel
    {
        /// <summary>
        /// 消息Id
        /// </summary>
        public string Id { get; set; }

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
    }
}
