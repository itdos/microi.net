using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using MQTTnet;

namespace Microi.net
{
    public interface IMicroiMQTT
    {
        Task StartServerAsync(OsClientSecret osclientModel = null);
        Task StopServerAsync();
        /// <summary>
        /// 直接发布原生 MQTT 消息（请自行负责 Topic 租户隔离前缀，建议使用 PublishAsync(osClient, ...)）
        /// </summary>
        Task PublishAsync(MqttApplicationMessage message);
        /// <summary>
        /// 按租户安全发布消息：自动将 Topic 加上租户前缀（若启用了 Topic 隔离）。
        /// </summary>
        /// <param name="osClient">租户标识</param>
        /// <param name="topic">业务 Topic（无需带租户前缀）</param>
        /// <param name="payload">消息体</param>
        /// <param name="qos">QoS 0/1/2</param>
        /// <param name="retain">是否保留消息</param>
        Task PublishAsync(string osClient, string topic, string payload, int qos = 0, bool retain = false);
        bool IsRunning { get; }
        /// <summary>
        /// 已连接客户端：Key=ClientId，Value=租户标识
        /// 注意：单机内存字典，集群部署需替换为 Redis 等分布式存储
        /// </summary>
        IReadOnlyDictionary<string, string> ConnectedClients { get; }
    }
}
