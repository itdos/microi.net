using Dos.Common;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Channels;
using System.Threading.Tasks;
using System.Xml.Linq;

namespace Microi.net
{
    public class MicroiRabbitMQPublish : IMicroiMQ
    {
        private IMicroiMQConnection mqConnection;
        public MicroiRabbitMQPublish(IMicroiMQConnection mqConnection) 
        { 
            this.mqConnection = mqConnection;
        }
        public void CloseChannel(string queueName)
        {
            var obj = MicroiRabbitMQConsumer.list.Where(x=>x.Value.QueueName == queueName).ToList();
            if(obj.Any())
            {
                var objFirst = obj.First().Value;
                if(objFirst.Channel != null && objFirst.Channel.IsOpen)
                {
                    //obj.Channel.Close();
                    objFirst.Channel.CloseAsync();
                }
                MicroiRabbitMQConsumer.list.Remove(objFirst.QueueName, out _);
            }
        }

        public void ReceiveMsg(string queueName)
        {
            IConnection conn = null;
            try
            {
                conn = mqConnection.GetPublishConnection();
                {
                    //var channel = conn.CreateModel();
                    var channel = conn.CreateChannelAsync().Result;
                    {
                        //channel.QueueDeclare(queue: queueName, durable: true, exclusive: false, autoDelete: false, arguments: null);
                        channel.QueueDeclareAsync(queue: queueName, durable: true, exclusive: false, autoDelete: false, arguments: null);
                        // BasicQos 方法设置prefetchCount = 1。这样RabbitMQ就会使得每个Consumer在同一个时间点最多处理一个Message。
                        // 换句话说，在接收到该Consumer的ack前，他它不会将新的Message分发给它
                        //channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);
                        channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false);
                        //EventingBasicConsumer consumer = new EventingBasicConsumer(channel);
                        var consumer = new AsyncEventingBasicConsumer(channel);
                        //channel.BasicConsume(queue: queueName, autoAck: false, consumer: consumer);                     
                        channel.BasicConsumeAsync(queue: queueName, autoAck: false, consumer: consumer);
                        //consumer.Received += (model, ea) =>
                        //{
                        //    var body = ea.Body.ToArray();
                        //    var message = Encoding.UTF8.GetString(body);
                        //    Console.WriteLine(message);
                        //    Console.WriteLine(consumer.ConsumerTags.Length);
                        //    Console.WriteLine(consumer.ConsumerTags[0]);
                        //    channel.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
                        //    //channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: false);
                        //};
                        consumer.ReceivedAsync += async (model, ea) =>
                        {
                            var body = ea.Body.ToArray();
                            var message = Encoding.UTF8.GetString(body);
                            channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false);
                        };
                        // 涉及到集群有问题
                        MicroiRabbitMQConsumer.list.TryAdd(queueName, new MicroiMQReceiveInfo
                        {
                            QueueName = queueName,
                            Channel = channel
                        });
                    }
                }
            }
            catch(Exception ex)
            {
                Console.WriteLine("zhuangtai:" + conn.IsOpen + ",连接状态"+ex.Message);
            }
            
        }


        /// <summary>
        /// 发送消息到队列
        /// </summary>
        /// <param name="queueName">队列名称</param>
        /// <param name="msg">消息需要序列化</param>
        /// <returns></returns>
        //public MqResult SendMsg(SendInfo sendInfo)
        //{
        //    MqResult mqResult = new MqResult();
        //    string statusInfo = "正常";
        //    string status = "成功";
        //    try
        //    {
        //        var conn = mqConnection.GetPublishConnection();
        //        {
        //            using (var channel = conn.CreateModel())
        //            {
        //                // 队列需要持久化
        //                channel.QueueDeclare(sendInfo.QueueName, true, false, false, null);
        //                MessageModel messageModel = new MessageModel()
        //                {
        //                    Id = Guid.NewGuid().ToString(),
        //                    Msg = sendInfo.Msg,
        //                };
        //                var body = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(messageModel));
        //                IBasicProperties properties = channel.CreateBasicProperties();
        //                // 消息需要持久化
        //                properties.DeliveryMode = 2;
        //                //开启消息确认模式
        //                channel.ConfirmSelect();
        //                /*-------------Return机制：不可达的消息消息监听--------------*/
        //                //这个事件就是用来监听我们一些不可达的消息的内容的：比如某些情况下交换机没有绑定到队列的情况下
        //                EventHandler<BasicReturnEventArgs> evreturn = new EventHandler<BasicReturnEventArgs>((o, basic) =>
        //                {
        //                    mqResult.Code = 0;
        //                    mqResult.Msg = basic.ReplyText;
        //                    //mqResult.Data = Encoding.UTF8.GetString(basic.Body.span);
        //                    statusInfo = "发送失败";
        //                    status = "失败";
        //                });
        //                channel.BasicReturn += evreturn;
        //                //消息发送成功的时候进入到这个事件：即RabbitMq服务器告诉生产者，我已经成功收到了消息
        //                EventHandler<BasicAckEventArgs> BasicAcks = new EventHandler<BasicAckEventArgs> ((o, basic) =>
        //                {
        //                    mqResult.Code = 1;
        //                    mqResult.Msg = "发送成功";
        //                });
        //                //消息发送失败的时候进入到这个事件：即RabbitMq服务器告诉生产者，你发送的这条消息我没有成功的投递到Queue中，或者说我没有收到这条消息。
        //                EventHandler<BasicNackEventArgs> BasicNacks = new EventHandler<BasicNackEventArgs>((o, basic) =>
        //                {
        //                    mqResult.Code = 0;
        //                    mqResult.Msg = "发送失败";
        //                    statusInfo = "发送失败";
        //                    status = "失败";
        //                });
        //                channel.BasicAcks += BasicAcks;
        //                channel.BasicNacks += BasicNacks;
        //                // 绑定到默认交换机
        //                channel.BasicPublish("", sendInfo.QueueName, properties, body);
        //            }
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        mqResult.Code = 0;
        //        mqResult.Msg = ex.Message;
        //    }
        //    finally
        //    {
        //        _formEngine.AddFormData(new
        //        {
        //            FormEngineKey = MQConst.queueLogTable,
        //            _RowModel = new Dictionary<string, string>()
        //            {
        //                { "Type", "发送"},
        //                { "QueueName", sendInfo.QueueName},
        //                { "Message", sendInfo.Msg},
        //                { "SendTime", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")},
        //                { "Status", status},
        //                { "StatusInfo", statusInfo},
        //            },
        //            OsClient = OsClient.OsClientName
        //        });
                
        //    }
        //    return mqResult;
        //}

        /// <summary>
        /// 发送消息到队列
        /// </summary>
        /// <param name="queueName">队列名称</param>
        /// <param name="msg">消息需要序列化</param>
        /// <returns></returns>
        public async Task<DosResult> SendMsg(MicroiMQSendInfo sendInfo)
        {
            DosResult mqResult = new DosResult()
            {
                Code = 1,
                Msg = "发送成功"
            };
            string statusInfo = "正常";
            string status = "成功";
            string messageId = Ulid.NewUlid().ToString();
            try
            {
                var conn = mqConnection.GetPublishConnection();
                {
                    //using (var channel = conn.CreateModel())
                    using (var channel = await conn.CreateChannelAsync())
                    {
                        // 队列需要持久化
                        //channel.QueueDeclare(sendInfo.QueueName, true, false, false, null);
                        channel.QueueDeclareAsync(sendInfo.QueueName, true, false, false, null);
                        MicroiMQMessageModel messageModel = new MicroiMQMessageModel()
                        {
                            Id = messageId,
                            Message = sendInfo.Message,
                            //这里没必要发送整个用户的token，发送Id即可 ，消费消息时根据Id再次从redis取token
                            CurrentUserId = sendInfo.CurrentToken?.CurrentUser?.GetValue("Id")?.ToString()
                        };
                        var body = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(messageModel));
                        //IBasicProperties properties = channel.CreateBasicProperties();
                        // 消息需要持久化
                        //properties.DeliveryMode = 2;
                        var properties = new BasicProperties { Persistent = true };

                        //开启消息确认模式
                        //channel.ConfirmSelect();
                        channel.TxSelectAsync();

                        // 绑定到默认交换机
                        //channel.BasicPublish("", sendInfo.QueueName, properties, body);
                        await channel.BasicPublishAsync("", sendInfo.QueueName, false, properties, body);
                        //if (!channel.WaitForConfirms())
                        //{
                        //    statusInfo = "发送失败";
                        //    status = "失败";
                        //    mqResult.Code = 0;
                        //    mqResult.Msg = "发送失败";
                        //}
                    }
                }
            }
            catch (Exception ex)
            {
                mqResult.Code = 0;
                mqResult.Msg = ex.Message;
                status = "失败";
                statusInfo = ex.ToString();
            }
            finally
            {
                MicroiEngine.FormEngine.AddFormData(MicroiMQConst.queueLogTable, new
                {
                    Type = "发送",
                    QueueName = sendInfo.QueueName,
                    Message = sendInfo.Message,
                    SendTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    Status = status,
                    StatusInfo = statusInfo,
                    MessageId = messageId,
                    OsClient = OsClient.OsClientName
                });
            }
            return mqResult;
        }

    }
}
