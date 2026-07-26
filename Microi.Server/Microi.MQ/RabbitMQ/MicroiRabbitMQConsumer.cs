using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiRabbitMQConsumer : IMicroiMQConsumer
    {
        public static readonly ConcurrentDictionary<string, MicroiMQReceiveInfo> list =
            new ConcurrentDictionary<string, MicroiMQReceiveInfo>(StringComparer.Ordinal);

        private static readonly ConcurrentDictionary<string, int> _failedAttempts =
            new ConcurrentDictionary<string, int>(StringComparer.Ordinal);

        private readonly IMicroiMQConnection _mqConnection;
        private readonly CancellationTokenSource _cts = new CancellationTokenSource();
        private Task _backgroundTask;
        private int _started;

        private static void WriteMqLog(string osClient, string action, string title, string content, int level = 2, string targetId = null, bool? success = false)
        {
            MicroiEngine.QueueSystemLog(osClient, "RabbitMQ", action, title, content, level, success, targetId);
        }

        public MicroiRabbitMQConsumer(IMicroiMQConnection mqConnection)
        {
            _mqConnection = mqConnection;
        }

        internal static string BuildMapKey(string osClient, string physicalQueueName)
        {
            var tenant = TenantRabbitMQConnectionSettings.NormalizeTenant(osClient).ToLowerInvariant();
            return tenant + "|" + (physicalQueueName ?? string.Empty);
        }

        /// <summary>
        /// 启动所有已启用租户的 RabbitMQ 消费者。每个节点都会注册消费者；RabbitMQ 的
        /// competing-consumer 语义负责节点间分发。锁只能避免并发执行，业务处理仍必须使用
        /// envelope.EventId 做 inbox/唯一约束/条件更新等幂等保护。
        /// </summary>
        public void ConsumerInit()
        {
            if (Interlocked.Exchange(ref _started, 1) == 1) return;
            _backgroundTask = Task.Run(() => RunAsync(_cts.Token));
        }

        private async Task RunAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    await ReconcileAllTenantsAsync(cancellationToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    WriteMqLog(OsClientDefault.OsClient, "ConsumerReconcileFailed", "MQ 多租户消费者同步失败", ex.ToString(), 2);
                }

                try
                {
                    await Task.Delay(GetListenerInterval(), cancellationToken).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    break;
                }
            }

            WriteMqLog(OsClientDefault.OsClient, "ConsumerReconcileStopped", "MQ 多租户消费者后台同步已停止", "后台同步任务已正常停止。", 1, success: true);
        }

        private async Task ReconcileAllTenantsAsync(CancellationToken cancellationToken)
        {
            var desired = new Dictionary<string, MicroiMQReceiveInfo>(StringComparer.Ordinal);
            var tenants = OsClientExtend.ClientList.Keys
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
                .ToArray();

            foreach (var tenant in tenants)
            {
                cancellationToken.ThrowIfCancellationRequested();
                foreach (var receiver in LoadTenantReceivers(tenant))
                {
                    desired[BuildMapKey(receiver.OsClient, receiver.QueueName)] = receiver;
                }
            }

            foreach (var pair in desired)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (list.TryGetValue(pair.Key, out var existing))
                {
                    CopyMutableConfiguration(pair.Value, existing);
                    continue;
                }

                if (await RegisterMQAsync(pair.Value, cancellationToken).ConfigureAwait(false))
                {
                    if (!list.TryAdd(pair.Key, pair.Value))
                    {
                        await DisposeChannelAsync(pair.Value).ConfigureAwait(false);
                    }
                }
            }

            var stale = list
                .Where(pair => pair.Value.ManagedByDatabase && !desired.ContainsKey(pair.Key))
                .ToArray();
            foreach (var pair in stale)
            {
                if (list.TryRemove(pair.Key, out var removed))
                {
                    await DisposeChannelAsync(removed).ConfigureAwait(false);
                    _failedAttempts.TryRemove(pair.Key, out _);
                }
            }
        }

        private static IReadOnlyList<MicroiMQReceiveInfo> LoadTenantReceivers(string osClient)
        {
            var result = new List<MicroiMQReceiveInfo>();
            try
            {
                var tableResult = MicroiEngine.FormEngine.GetTableData(new
                {
                    FormEngineKey = MicroiMQConst.queueTable,
                    OsClient = osClient
                });
                if (tableResult.Code != 1 || tableResult.Data == null) return result;

                foreach (var row in tableResult.Data)
                {
                    try
                    {
                        var logicalQueue = Convert.ToString(row.QueueName)?.Trim();
                        var physicalQueue = TenantConfigurationSecurity.NormalizeQueueName(osClient, logicalQueue);
                        var handlerType = Convert.ToInt32(row.Type);
                        if (handlerType == Convert.ToInt32(MicroiMQConst.MQTypeApiEngineKey)
                            && string.IsNullOrWhiteSpace(Convert.ToString(row.ApiEngineKey)))
                        {
                            throw new InvalidOperationException("接口引擎消费者缺少 ApiEngineKey。");
                        }
                        if (handlerType != Convert.ToInt32(MicroiMQConst.MQTypeApiEngineKey)
                            && !string.Equals(osClient, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase))
                        {
                            throw new InvalidOperationException("子租户只允许使用接口引擎 MQ 消费者，禁止动态 DLL 处理器。");
                        }

                        result.Add(new MicroiMQReceiveInfo
                        {
                            OsClient = osClient,
                            LogicalQueueName = logicalQueue,
                            QueueName = physicalQueue,
                            ManagedByDatabase = true,
                            Type = handlerType,
                            FailToReject = Convert.ToString(row.FailToReject) == "是",
                            DllName = row.DllName,
                            ClassName = row.ClassName,
                            MethodName = row.MethodName,
                            ApiEngineKey = row.ApiEngineKey,
                            Count = Math.Max(0, Convert.ToInt32(row.Count)),
                            Id = row.Id
                        });
                    }
                    catch (Exception rowException)
                    {
                        WriteMqLog(osClient, "InvalidConsumerConfiguration", "MQ 消费配置无效，已拒绝启用", rowException.ToString(), 2);
                    }
                }
            }
            catch (Exception ex)
            {
                // 某个租户没有 MQ 表或数据库暂时不可用，不得阻断其它租户的消费者。
                WriteMqLog(osClient, "LoadConsumerConfigurationFailed", "读取 MQ 消费配置失败", ex.ToString(), 2);
            }
            return result;
        }

        private async Task<bool> RegisterMQAsync(
            MicroiMQReceiveInfo item,
            CancellationToken cancellationToken)
        {
            var mapKey = BuildMapKey(item.OsClient, item.QueueName);
            IChannel channel = null;
            try
            {
                var connection = await _mqConnection
                    .GetReceiveConnectionAsync(item.OsClient, cancellationToken)
                    .ConfigureAwait(false);
                channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken).ConfigureAwait(false);
                await channel.QueueDeclareAsync(
                    queue: item.QueueName,
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null,
                    cancellationToken: cancellationToken).ConfigureAwait(false);
                await channel.BasicQosAsync(
                    prefetchSize: 0,
                    prefetchCount: 1,
                    global: false,
                    cancellationToken: cancellationToken).ConfigureAwait(false);

                var consumer = new AsyncEventingBasicConsumer(channel);
                consumer.ReceivedAsync += (_, eventArgs) => HandleMessageAsync(item, eventArgs, channel);
                await channel.BasicConsumeAsync(
                    queue: item.QueueName,
                    autoAck: false,
                    consumer: consumer,
                    cancellationToken: cancellationToken).ConfigureAwait(false);

                item.Channel = channel;
                _failedAttempts.TryRemove(mapKey, out _);
                return true;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                if (channel != null) await channel.DisposeAsync().ConfigureAwait(false);
                throw;
            }
            catch (Exception ex)
            {
                if (channel != null) await channel.DisposeAsync().ConfigureAwait(false);
                var attempt = _failedAttempts.AddOrUpdate(mapKey, 1, (_, oldValue) => oldValue + 1);
                if (attempt <= 3 || attempt % 10 == 0)
                {
                    if (!(ex is TenantRabbitMQConfigurationException))
                    {
                        WriteMqLog(
                            item.OsClient,
                            "RegisterConsumerFailed",
                            "注册 MQ 消费队列失败",
                            $"第{attempt}次失败，未回退主租户凭据。{ex}",
                            2,
                            item.QueueName);
                    }
                }
                return false;
            }
        }

        private async Task HandleMessageAsync(
            MicroiMQReceiveInfo item,
            BasicDeliverEventArgs eventArgs,
            IChannel channel)
        {
            var receiveTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var status = "失败";
            var statusInfo = "未处理";
            MicroiMQMessageModel envelope = null;

            try
            {
                var rawJson = Encoding.UTF8.GetString(eventArgs.Body.ToArray());
                try
                {
                    envelope = JsonConvert.DeserializeObject<MicroiMQMessageModel>(rawJson);
                }
                catch (Exception ex)
                {
                    statusInfo = "消息反序列化失败：" + ex.Message;
                    await channel.BasicRejectAsync(eventArgs.DeliveryTag, requeue: false).ConfigureAwait(false);
                    return;
                }

                var validationError = ValidateEnvelope(item, envelope, eventArgs.BasicProperties?.MessageId);
                if (validationError != null)
                {
                    statusInfo = validationError;
                    WriteMqLog(item.OsClient, "EnvelopeRejected", "MQ 消息安全校验失败，已拒绝消费", validationError, 3, item.QueueName);
                    await channel.BasicRejectAsync(eventArgs.DeliveryTag, requeue: false).ConfigureAwait(false);
                    return;
                }

                var success = await ExecuteHandlerAsync(item, envelope).ConfigureAwait(false);
                if (success)
                {
                    status = "成功";
                    statusInfo = "正常";
                    await channel.BasicAckAsync(eventArgs.DeliveryTag, multiple: false).ConfigureAwait(false);
                    await ClearRetryStateAsync(item, envelope.StableEventId).ConfigureAwait(false);
                }
                else if (item.FailToReject)
                {
                    statusInfo = await RequeueOrRejectAsync(
                        item,
                        envelope,
                        eventArgs,
                        channel,
                        "消息消费失败").ConfigureAwait(false);
                }
                else
                {
                    statusInfo = "消息消费失败，已删除消息";
                    await channel.BasicRejectAsync(eventArgs.DeliveryTag, requeue: false).ConfigureAwait(false);
                }
            }
            catch (Exception ex)
            {
                statusInfo = "消息处理异常：" + ex.Message;
                WriteMqLog(item.OsClient, "MessageHandlingFailed", "MQ 消息处理失败", ex.ToString(), 2, item.QueueName);
                try
                {
                    if (envelope != null && item.FailToReject)
                    {
                        statusInfo = await RequeueOrRejectAsync(
                            item,
                            envelope,
                            eventArgs,
                            channel,
                            statusInfo).ConfigureAwait(false);
                    }
                    else if (channel.IsOpen)
                    {
                        await channel.BasicRejectAsync(eventArgs.DeliveryTag, requeue: false).ConfigureAwait(false);
                    }
                }
                catch
                {
                    // 连接中断时 RabbitMQ 会把未 Ack 消息重新派发；业务端仍须按 EventId 幂等。
                }
            }
            finally
            {
                TryWriteReceiveLog(item, envelope, receiveTime, status, statusInfo);
            }
        }

        private static string ValidateEnvelope(
            MicroiMQReceiveInfo item,
            MicroiMQMessageModel envelope,
            string brokerMessageId)
        {
            if (envelope == null) return "消息 envelope 为空";
            if (string.IsNullOrWhiteSpace(envelope.OsClient)) return "消息 envelope 未携带 OsClient";
            if (!string.Equals(envelope.OsClient, item.OsClient, StringComparison.OrdinalIgnoreCase))
            {
                return $"消息租户[{envelope.OsClient}]与队列租户[{item.OsClient}]不一致";
            }
            if (string.IsNullOrWhiteSpace(envelope.StableEventId)) return "消息 envelope 未携带 EventId/Id";
            if (!string.IsNullOrWhiteSpace(envelope.EventId)
                && !string.IsNullOrWhiteSpace(envelope.Id)
                && !string.Equals(envelope.EventId, envelope.Id, StringComparison.Ordinal))
            {
                return "消息 envelope 的 EventId 与兼容字段 Id 不一致";
            }
            if (!string.IsNullOrWhiteSpace(brokerMessageId)
                && !string.Equals(brokerMessageId, envelope.StableEventId, StringComparison.Ordinal))
            {
                return "RabbitMQ MessageId 与 envelope EventId 不一致";
            }
            return null;
        }

        private static async Task<bool> ExecuteHandlerAsync(
            MicroiMQReceiveInfo item,
            MicroiMQMessageModel envelope)
        {
            if (item.Type == Convert.ToInt32(MicroiMQConst.MQTypeApiEngineKey))
            {
                var param = new JObject
                {
                    ["OsClient"] = item.OsClient,
                    ["Message"] = JTokenEx.FromObject(envelope),
                    ["EventId"] = envelope.StableEventId
                };
                var apiResult = await MicroiEngine.ApiEngine
                    .RunAsync(item.ApiEngineKey, param)
                    .ConfigureAwait(false);
                if (apiResult == null) return true;
                try
                {
                    return JObject.FromObject(apiResult).ToObject<DosResult>()?.Code == 1;
                }
                catch
                {
                    // 保留历史约定：非 DosResult 返回值视为接口引擎已成功执行。
                    return true;
                }
            }

            var applicationRoot = Path.GetFullPath(Directory.GetCurrentDirectory());
            var saveFilePath = Path.GetFullPath(Path.Combine(applicationRoot, item.DllName ?? string.Empty));
            var rootPrefix = applicationRoot.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                             + Path.DirectorySeparatorChar;
            if (!saveFilePath.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(Path.GetExtension(saveFilePath), ".dll", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("MQ DLL 处理器路径不在应用目录或扩展名无效。");
            }
            var assembly = Assembly.LoadFrom(saveFilePath);
            var type = assembly.GetType(item.ClassName, throwOnError: true);
            var method = type.GetMethod(item.MethodName)
                         ?? throw new MissingMethodException(item.ClassName, item.MethodName);
            var instance = Activator.CreateInstance(type);
            return Convert.ToBoolean(method.Invoke(instance, new[] { envelope.Message }));
        }

        private static async Task<string> RequeueOrRejectAsync(
            MicroiMQReceiveInfo item,
            MicroiMQMessageModel envelope,
            BasicDeliverEventArgs eventArgs,
            IChannel channel,
            string reason)
        {
            var cache = MicroiEngine.CacheTenant.Cache(item.OsClient);
            var key = RetryKey(item.OsClient, envelope.StableEventId);
            var rawCount = await cache.GetAsync<object>(key).ConfigureAwait(false);
            var currentCount = rawCount == null ? 0 : Convert.ToInt32(rawCount);
            if (currentCount >= item.Count)
            {
                await cache.RemoveAsync(key).ConfigureAwait(false);
                await channel.BasicRejectAsync(eventArgs.DeliveryTag, requeue: false).ConfigureAwait(false);
                return reason + "，已达到最大重试次数并删除消息";
            }

            await cache.SetAsync(key, currentCount + 1, TimeSpan.FromDays(7)).ConfigureAwait(false);
            await channel.BasicRejectAsync(eventArgs.DeliveryTag, requeue: true).ConfigureAwait(false);
            return reason + $"，已重新入队（{currentCount + 1}/{item.Count}）";
        }

        private static async Task ClearRetryStateAsync(MicroiMQReceiveInfo item, string eventId)
        {
            try
            {
                await MicroiEngine.CacheTenant
                    .Cache(item.OsClient)
                    .RemoveAsync(RetryKey(item.OsClient, eventId))
                    .ConfigureAwait(false);
            }
            catch
            {
                // 重试计数清理失败不应把已经成功处理的业务消息重新投递。
            }
        }

        private static string RetryKey(string osClient, string eventId)
        {
            return $"Microi:{osClient}:MQ:Retry:{eventId}";
        }

        private static void TryWriteReceiveLog(
            MicroiMQReceiveInfo item,
            MicroiMQMessageModel envelope,
            string receiveTime,
            string status,
            string statusInfo)
        {
            try
            {
                MicroiEngine.FormEngine.AddFormData(new
                {
                    FormEngineKey = MicroiMQConst.queueLogTable,
                    _RowModel = new Dictionary<string, object>
                    {
                        ["Type"] = "接收",
                        ["QueueName"] = item.QueueName,
                        ["Message"] = envelope?.Message,
                        ["ReceiveTime"] = receiveTime,
                        ["CompleteTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                        ["Status"] = status,
                        ["StatusInfo"] = statusInfo,
                        ["MessageId"] = envelope?.StableEventId
                    },
                    OsClient = item.OsClient
                });
            }
            catch (Exception ex)
            {
                WriteMqLog(item.OsClient, "ReceiveAuditWriteFailed", "MQ 接收记录写入失败", ex.ToString(), 2, item.QueueName);
            }
        }

        private static TimeSpan GetListenerInterval()
        {
            var seconds = 180;
            foreach (var client in OsClientExtend.ClientList.Values)
            {
                var configured = client?.OsClientModel?["MQListenerTime"]?.Val<int>() ?? 0;
                if (configured > 0) seconds = Math.Min(seconds, configured);
            }
            return TimeSpan.FromSeconds(Math.Max(15, Math.Min(3600, seconds)));
        }

        private static void CopyMutableConfiguration(
            MicroiMQReceiveInfo source,
            MicroiMQReceiveInfo target)
        {
            target.Type = source.Type;
            target.FailToReject = source.FailToReject;
            target.DllName = source.DllName;
            target.ClassName = source.ClassName;
            target.MethodName = source.MethodName;
            target.ApiEngineKey = source.ApiEngineKey;
            target.Count = source.Count;
            target.Id = source.Id;
            target.LogicalQueueName = source.LogicalQueueName;
        }

        private static async Task DisposeChannelAsync(MicroiMQReceiveInfo item)
        {
            if (item?.Channel != null)
            {
                await item.Channel.DisposeAsync().ConfigureAwait(false);
                item.Channel = null;
            }
        }

        public void Stop()
        {
            try
            {
                _cts.Cancel();
                _backgroundTask?.ConfigureAwait(false).GetAwaiter().GetResult();
                foreach (var pair in list.ToArray())
                {
                    if (list.TryRemove(pair.Key, out var item))
                    {
                        DisposeChannelAsync(item).ConfigureAwait(false).GetAwaiter().GetResult();
                    }
                }
                _failedAttempts.Clear();
                WriteMqLog(OsClientDefault.OsClient, "ConsumerStopped", "MQ 多租户消费者已停止", "消费者连接与通道已释放。", 1, success: true);
            }
            catch (Exception ex)
            {
                WriteMqLog(OsClientDefault.OsClient, "ConsumerStopFailed", "MQ 多租户消费者停止失败", ex.ToString(), 3);
            }
        }
    }
}
