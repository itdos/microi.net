using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver.Core.Bindings;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiRabbitMQConsumer : IMicroiMQConsumer
    {

        public static List<MicroiMQReceiveInfo> list = new List<MicroiMQReceiveInfo>();

        private IMicroiMQConnection mqConnection;

        private static FormEngine _formEngine = new FormEngine();
        private static MicroiCacheRedis cache = new MicroiCacheRedis(OsClient.OsClientName);
        private static ApiEngine _apiEngineLogic = new ApiEngine();
        public MicroiRabbitMQConsumer(IMicroiMQConnection mqConnection)
        {
            this.mqConnection = mqConnection;
        }

        /// <summary>
        /// 启动消费端
        /// </summary>
        public void ConsumerInit()
        {
            Task.Run(() =>
            {
                var param = new
                {
                    FormEngineKey = MicroiMQConst.queueTable,
                    OsClient = OsClient.OsClientName
                };
                DosResultList<dynamic> resultList = _formEngine.GetTableData(param);
                if (resultList.Code == 1 && resultList.Data != null)
                {
                    foreach (var item in resultList.Data)
                    {
                        list.Add(new MicroiMQReceiveInfo()
                        {
                            QueueName = item.QueueName,
                            Type = Convert.ToInt32(item.Type),
                            FailToReject = item.FailToReject == "是" ? true : false,
                            DllName = item.DllName,
                            ClassName = item.ClassName,
                            MethodName = item.MethodName,
                            ApiEngineKey = item.ApiEngineKey,
                            Count = item.Count,
                            Id = item.Id
                        });
                    }
                }
                foreach (var item in list)
                {
                    RegisterMQ(item);
                }
                AddOrRemoveReceive();
            });           
        }

        /// <summary>
        /// 注册MQ
        /// </summary>
        /// <param name="item"></param>
        /// <returns></returns>
        private bool RegisterMQ(MicroiMQReceiveInfo item)
        {
            IModel channel = null;
            try
            {
                var conn = mqConnection.GetReceiveConnection();
                {
                    channel = conn.CreateModel();
                    {
                        channel.QueueDeclare(queue: item.QueueName, durable: true, exclusive: false, autoDelete: false, arguments: null);
                        // BasicQos 方法设置prefetchCount = 1。这样RabbitMQ就会使得每个Consumer在同一个时间点最多处理一个Message。
                        // 换句话说，在接收到该Consumer的ack前，他它不会将新的Message分发给它
                        channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);
                        EventingBasicConsumer consumer = new EventingBasicConsumer(channel);
                        channel.BasicConsume(queue: item.QueueName, autoAck: false, consumer: consumer);
                        item.Channel = channel;
                        consumer.Received += (model, ea) => HandleMessage(item, ea, channel);
                    }
                }
                return true;
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                if (channel != null && channel.IsOpen)
                {
                    channel.Close();
                }
                return false;
            }
        }

        /// <summary>
        /// 定时从数据库获取所有监听队列数据，发现有新增的需要启动监听,发现删除的的需要删除
        /// </summary>
        private void AddOrRemoveReceive()
        {
            while (true)
            {
                try
                {
                    var osClientName = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
                    var clientModel = OsClient.GetClient(osClientName);
                    //string mqListenerTime = string.IsNullOrEmpty(clientModel.MQListenerTime) ? "180" : clientModel.MQListenerTime;
                    int listenerTime = 180;
                    try
                    {
                        listenerTime = string.IsNullOrEmpty(clientModel.MQListenerTime) ? 180 : Convert.ToInt32(clientModel.MQListenerTime);
                    }
                    catch(Exception e) 
                    {
                        listenerTime = 180;
                    }
                    Thread.Sleep(TimeSpan.FromSeconds(listenerTime));
                    List<MicroiMQReceiveInfo> databaseList = new List<MicroiMQReceiveInfo>();
                    // 此处需要从数据库获取数据
                    var param = new
                    {
                        FormEngineKey = MicroiMQConst.queueTable,
                        OsClient = OsClient.OsClientName
                    };
                    DosResultList<dynamic> resultList = _formEngine.GetTableData(param);
                    if (resultList.Code == 1 && resultList.Data != null)
                    {
                        foreach (var item in resultList.Data)
                        {
                            databaseList.Add(new MicroiMQReceiveInfo()
                            {
                                QueueName = item.QueueName,
                                Type = Convert.ToInt32(item.Type),
                                FailToReject = item.FailToReject == "是" ? true : false,
                                DllName = item.DllName,
                                ClassName = item.ClassName,
                                MethodName = item.MethodName,
                                ApiEngineKey = item.ApiEngineKey,
                                Count = item.Count,
                                Id = item.Id
                            });
                        }
                    }
                    // 获取数据库有但是list集合没有，需要添加
                    var addList = databaseList.Where(x => !list.Any(a => x.QueueName == a.QueueName)).ToList();
                    if (addList != null && addList.Count > 0)
                    {
                        addList.ForEach(item =>
                        {
                            if (RegisterMQ(item))
                            {
                                list.Add(item);
                            }
                        });
                    }
                    // 获取list集合有数据库没有，需要删除
                    var removeList = list.Where(x => !databaseList.Any(a => x.QueueName == a.QueueName)).ToList();
                    if (removeList != null && removeList.Count > 0)
                    {
                        removeList.ForEach(item =>
                        {
                            if (item.Channel != null && item.Channel.IsOpen)
                            {
                                item.Channel.Close();
                            }
                            list.Remove(item);
                        });
                    }
                    databaseList = null;
                }
                catch(Exception ex)
                {
                    Console.WriteLine(ex);
                }
               
            }

        }


        private void HandleMessage(MicroiMQReceiveInfo item,BasicDeliverEventArgs ea, IModel channel)
        {
            bool success = false;
            string receiveTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            string statusInfo = "正常";
            string status = "成功";
            var body = ea.Body.ToArray();
            MicroiMQMessageModel messageModel = JsonConvert.DeserializeObject<MicroiMQMessageModel>(Encoding.UTF8.GetString(body));
            string msg = messageModel.Msg;
            try
            {                
                if (item.Type.Equals(Convert.ToInt32(MicroiMQConst.MQTypeApiEngineKey))) // 接口引擎处理业务逻辑
                {
                    JObject obj = new JObject();
                    obj["Message"] = messageModel.Msg;
                    obj["ApiEngineKey"] = item.ApiEngineKey;
                    //调用接口引擎
                     success = (bool)_apiEngineLogic.Run(obj);
                }
                else // 定制接口处理业务逻辑
                {
                    string saveFilePath = $"{Directory.GetCurrentDirectory()}\\{item.DllName}";
                    Assembly assembly = Assembly.LoadFrom(saveFilePath);
                    //类名称
                    Type tp = assembly.GetType(item.ClassName);
                    //方法
                    MethodInfo method = tp.GetMethod(item.MethodName);
                    object obj = Activator.CreateInstance(tp);
                    object[] parameters = new object[1] { messageModel.Msg };
                    success = (bool)method.Invoke(obj, parameters);
                }
                if (success)
                {
                    // 回ack,服务器删除消息
                    channel.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
                }
                else if (item.FailToReject)
                {
                    status = "失败";
                    string str = "消息消费失败, 重新返回消息队列";
                    statusInfo = FailToRejectHandler(item,messageModel,ea,channel, str);
                }
                else
                {
                    status = "失败";
                    statusInfo = "消息消费失败,删除消息";
                    // 删除消息
                    channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: false);
                }
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                Console.WriteLine("消息处理异常" + ex);
                status = "失败";
                if (item.FailToReject)
                {
                    string str = "消息处理异常,重新返回消息队列";
                    statusInfo = FailToRejectHandler(item, messageModel, ea, channel, str);
                }
                else
                {
                    statusInfo = "消息处理异常,删除消息";
                    channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: false);
                }
            }
            // 写入消息日志
            _formEngine.AddFormData(new
            {
                FormEngineKey = MicroiMQConst.queueLogTable,
                _RowModel = new Dictionary<string, string>()
                    {
                        { "Type", "接收"},
                        { "QueueName", item.QueueName},
                        { "Message", msg},
                        { "ReceiveTime", receiveTime},
                        { "CompleteTime", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")},
                        { "Status", status},
                        { "StatusInfo", statusInfo},
                        { "MessageId", messageModel.Id}
                    },
                OsClient = OsClient.OsClientName
            });
        }

        private string FailToRejectHandler(MicroiMQReceiveInfo item, MicroiMQMessageModel messageModel, BasicDeliverEventArgs ea, IModel channel,string msg)
        {
            string statusInfo = msg;
            string key = "mq_" + messageModel.Id;
            if(cache.KeyExist(key))
            {
                int count = Convert.ToInt32(cache.Get(key));
                if (count >= item.Count)
                {
                    statusInfo = "消息达到重回队列次数，删除消息";
                    channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: false);
                }
                else
                {
                    cache.Set(key, count+1);
                    // 消息重回队列
                    channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: true);
                }
            }
            else
            {
                cache.Set(key, 1);
                // 消息重回队列
                channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: true);
            }
            return statusInfo;
        }
        
    }
}
