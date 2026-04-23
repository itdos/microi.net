using System;
using System.Collections.Generic;

namespace Microi.net
{
    public class MqttParam
    {
        public string ClientId { get; set; }
        public object Payload { get; set; }
        /// <summary>
        /// 原始 Payload 文本（JSON 解析失败时也保留）
        /// </summary>
        public string PayloadRaw { get; set; }
        public string Topic { get; set; }
        /// <summary>
        /// 当前事件归属的 SaaS 租户标识
        /// </summary>
        public string OsClient { get; set; }
        /// <summary>
        /// 客户端连接时使用的用户名
        /// </summary>
        public string UserName { get; set; }
        /// <summary>
        /// MQTT Quality of Service: 0/1/2
        /// </summary>
        public int Qos { get; set; }
        /// <summary>
        /// 是否为保留消息
        /// </summary>
        public bool Retain { get; set; }
        /// <summary>
        /// MQTT v5 用户属性
        /// </summary>
        public Dictionary<string, string> UserProperties { get; set; }
    }
}

