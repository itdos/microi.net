using Dos.Common;
using Newtonsoft.Json;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiRabbitMQPublish : IMicroiMQ
    {
        private readonly IMicroiMQConnection _mqConnection;

        public MicroiRabbitMQPublish(IMicroiMQConnection mqConnection)
        {
            _mqConnection = mqConnection;
        }

        public async Task CloseChannelAsync(string osClient, string queueName)
        {
            var tenant = ResolveOperationTenant(osClient);
            var physicalQueue = TenantConfigurationSecurity.NormalizeQueueName(tenant, queueName);
            var mapKey = MicroiRabbitMQConsumer.BuildMapKey(tenant, physicalQueue);
            if (!MicroiRabbitMQConsumer.list.TryRemove(mapKey, out var receiveInfo)) return;

            if (receiveInfo.Channel != null)
            {
                await receiveInfo.Channel.DisposeAsync().ConfigureAwait(false);
            }
        }

        public async Task ReceiveMsgAsync(string osClient, string queueName)
        {
            var tenant = ResolveOperationTenant(osClient);
            var physicalQueue = TenantConfigurationSecurity.NormalizeQueueName(tenant, queueName);
            var connection = await _mqConnection.GetReceiveConnectionAsync(tenant).ConfigureAwait(false);
            var channel = await connection.CreateChannelAsync().ConfigureAwait(false);

            try
            {
                await channel.QueueDeclareAsync(
                    queue: physicalQueue,
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null).ConfigureAwait(false);
                await channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false).ConfigureAwait(false);

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.ReceivedAsync += async (_, eventArgs) =>
                {
                    await channel.BasicAckAsync(
                        deliveryTag: eventArgs.DeliveryTag,
                        multiple: false).ConfigureAwait(false);
                };
                await channel.BasicConsumeAsync(
                    queue: physicalQueue,
                    autoAck: false,
                    consumer: consumer).ConfigureAwait(false);

                var mapKey = MicroiRabbitMQConsumer.BuildMapKey(tenant, physicalQueue);
                var info = new MicroiMQReceiveInfo
                {
                    OsClient = tenant,
                    LogicalQueueName = queueName,
                    QueueName = physicalQueue,
                    Channel = channel
                };
                if (!MicroiRabbitMQConsumer.list.TryAdd(mapKey, info))
                {
                    await channel.DisposeAsync().ConfigureAwait(false);
                }
            }
            catch
            {
                await channel.DisposeAsync().ConfigureAwait(false);
                throw;
            }
        }

        /// <summary>
        /// 将消息发送到当前租户的物理队列。事务提交由 RabbitMQ broker 确认；
        /// EventId 是跨节点重投时的稳定幂等键，但业务消费者仍必须按 EventId 幂等处理。
        /// </summary>
        public async Task<DosResult> SendMsg(MicroiMQSendInfo sendInfo)
        {
            var result = new DosResult { Code = 1, Msg = "发送成功" };
            var status = "成功";
            var statusInfo = "正常";
            string tenant = null;
            string physicalQueue = null;
            string eventId = null;

            try
            {
                if (sendInfo == null)
                {
                    throw new ArgumentNullException(nameof(sendInfo));
                }

                eventId = NormalizeEventId(sendInfo.EventId);
                tenant = ResolveTenant(sendInfo);
                physicalQueue = TenantConfigurationSecurity.NormalizeQueueName(tenant, sendInfo.QueueName);
                sendInfo.OsClient = tenant;
                sendInfo.QueueName = physicalQueue;
                sendInfo.EventId = eventId;

                var connection = await _mqConnection
                    .GetPublishConnectionAsync(tenant)
                    .ConfigureAwait(false);
                await using var channel = await connection.CreateChannelAsync().ConfigureAwait(false);

                await channel.QueueDeclareAsync(
                    queue: physicalQueue,
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null).ConfigureAwait(false);

                var message = new MicroiMQMessageModel
                {
                    EventId = eventId,
                    Id = eventId,
                    OsClient = tenant,
                    Message = sendInfo.Message,
                    CurrentUserId = sendInfo.CurrentToken?.CurrentUser?.GetValue("Id")?.ToString()
                };
                var body = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(message));
                var properties = new BasicProperties
                {
                    Persistent = true,
                    ContentType = "application/json",
                    Type = "microi.tenant-message.v1",
                    MessageId = eventId
                };

                // RabbitMQ transaction makes broker acceptance explicit. Every async operation is awaited;
                // omitting TxCommitAsync would silently lose messages when the channel is disposed.
                await channel.TxSelectAsync().ConfigureAwait(false);
                await channel.BasicPublishAsync(
                    exchange: string.Empty,
                    routingKey: physicalQueue,
                    mandatory: true,
                    basicProperties: properties,
                    body: body).ConfigureAwait(false);
                await channel.TxCommitAsync().ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                result.Code = 0;
                result.Msg = ex.Message;
                status = "失败";
                statusInfo = ex.ToString();
            }
            finally
            {
                TryWriteSendLog(sendInfo, tenant, physicalQueue, eventId, status, statusInfo);
            }

            return result;
        }

        private static string ResolveTenant(MicroiMQSendInfo sendInfo)
        {
            var requestedTenant = sendInfo.OsClient?.Trim();
            if (V8TenantContext.IsActive)
            {
                var v8Tenant = V8TenantContext.Current.OsClient;
                if (!string.IsNullOrWhiteSpace(requestedTenant)
                    && !string.Equals(requestedTenant, v8Tenant, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("V8 只能向当前租户的 RabbitMQ 命名空间发送消息。");
                }
                return TenantRabbitMQConnectionSettings.NormalizeTenant(v8Tenant);
            }

            var tokenTenant = sendInfo.CurrentToken?.OsClient?.Trim();
            if (!string.IsNullOrWhiteSpace(tokenTenant))
            {
                if (!string.IsNullOrWhiteSpace(requestedTenant)
                    && !string.Equals(requestedTenant, tokenTenant, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException(
                        $"当前 Token 属于租户[{tokenTenant}]，禁止向租户[{requestedTenant}]发送 RabbitMQ 消息。");
                }
                return tokenTenant;
            }

            return TenantRabbitMQConnectionSettings.NormalizeTenant(requestedTenant);
        }

        private static string ResolveOperationTenant(string requestedTenant)
        {
            if (!V8TenantContext.IsActive)
            {
                return TenantRabbitMQConnectionSettings.NormalizeTenant(requestedTenant);
            }

            var v8Tenant = V8TenantContext.Current.OsClient;
            if (!string.IsNullOrWhiteSpace(requestedTenant)
                && !string.Equals(requestedTenant, v8Tenant, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("V8 只能管理当前租户的 RabbitMQ 队列。");
            }
            return TenantRabbitMQConnectionSettings.NormalizeTenant(v8Tenant);
        }

        private static string NormalizeEventId(string eventId)
        {
            var normalized = eventId?.Trim();
            if (string.IsNullOrWhiteSpace(normalized)) return Ulid.NewUlid().ToString();
            if (normalized.Length > 128)
            {
                throw new ArgumentException("RabbitMQ EventId 长度不能超过 128 个字符。", nameof(eventId));
            }
            foreach (var character in normalized)
            {
                if (char.IsControl(character))
                {
                    throw new ArgumentException("RabbitMQ EventId 不能包含控制字符。", nameof(eventId));
                }
            }
            return normalized;
        }

        private static void TryWriteSendLog(
            MicroiMQSendInfo sendInfo,
            string tenant,
            string queueName,
            string eventId,
            string status,
            string statusInfo)
        {
            if (string.IsNullOrWhiteSpace(tenant)) return;
            try
            {
                MicroiEngine.FormEngine.AddFormData(MicroiMQConst.queueLogTable, new
                {
                    Type = "发送",
                    QueueName = queueName ?? sendInfo?.QueueName,
                    Message = sendInfo?.Message,
                    SendTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    Status = status,
                    StatusInfo = statusInfo,
                    MessageId = eventId,
                    OsClient = tenant
                });
            }
            catch (Exception logException)
            {
                Console.WriteLine(
                    $"Microi：【Error异常】租户[{tenant}]的 MQ 发送日志写入失败：{logException.Message}");
            }
        }
    }
}
