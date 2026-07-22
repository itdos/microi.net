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
        /// 旧版原生发布入口。由于没有可验证的租户上下文，实现必须拒绝调用。
        /// </summary>
        [Obsolete("原生 MQTT 发布缺少租户上下文，请使用 PublishAsync(osClient, ...)。")]
        Task PublishAsync(MqttApplicationMessage message);
        /// <summary>
        /// 按租户安全发布原生 MQTT 消息；Topic 会在服务端强制规范化。
        /// </summary>
        Task PublishAsync(string osClient, MqttApplicationMessage message);
        /// <summary>
        /// 按租户安全发布消息：强制将 Topic 收敛到 tenant/{osClient}/ 命名空间。
        /// </summary>
        /// <param name="osClient">租户标识</param>
        /// <param name="topic">业务 Topic（无需带租户前缀）</param>
        /// <param name="payload">消息体</param>
        /// <param name="qos">QoS 0/1/2</param>
        /// <param name="retain">是否保留消息</param>
        Task PublishAsync(string osClient, string topic, string payload, int qos = 0, bool retain = false);
        bool IsRunning { get; }
        /// <summary>
        /// 旧版当前节点连接快照。Key 已为 tenant+ClientId 复合键，
        /// 仅用于诊断，不能作为集群在线业务事实。
        /// </summary>
        [Obsolete("请使用 GetConnectedClients(osClient) 获取当前租户、当前节点的连接快照。")]
        IReadOnlyDictionary<string, string> ConnectedClients { get; }
        /// <summary>只返回指定租户在当前 MQTT 节点的连接快照（Key=ClientId）。</summary>
        IReadOnlyDictionary<string, string> GetConnectedClients(string osClient);
    }
}
