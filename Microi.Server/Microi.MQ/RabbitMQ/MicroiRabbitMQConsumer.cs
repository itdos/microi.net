using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Http;
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
using System.Threading.Channels;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiRabbitMQConsumer : IMicroiMQConsumer
    {
        public static ConcurrentDictionary<string, MicroiMQReceiveInfo> list = new ConcurrentDictionary<string, MicroiMQReceiveInfo>();
        private IMicroiMQConnection mqConnection;
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
                DosResultList<dynamic> resultList = MicroiEngine.FormEngine.GetTableData(param);
                if (resultList.Code == 1 && resultList.Data != null)
                {
                    foreach (var item in resultList.Data)
                    {
                        var model = new MicroiMQReceiveInfo()
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
                        };
                        bool addResult = list.TryAdd(item.QueueName, model);
                        if (!addResult)
                        {
                            Console.WriteLine($"Microi：【Error异常】添加MQ失败：" + JsonConvert.SerializeObject(model));
                        }
                    }
                }
                foreach (var item in list)
                {
                    RegisterMQ(item.Value);
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
            //IModel channel = null;
            IChannel channel = null;
            try
            {
                var conn = mqConnection.GetReceiveConnection();
                {
                    //channel = conn.CreateModel();
                    channel = conn.CreateChannelAsync().Result;
                    {
                        //channel.QueueDeclare(queue: item.QueueName, durable: true, exclusive: false, autoDelete: false, arguments: null);
                        channel.QueueDeclareAsync(queue: item.QueueName, durable: true, exclusive: false, autoDelete: false, arguments: null);
                        // BasicQos 方法设置prefetchCount = 1。这样RabbitMQ就会使得每个Consumer在同一个时间点最多处理一个Message。
                        // 换句话说，在接收到该Consumer的ack前，他它不会将新的Message分发给它
                        //channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);
                        channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false);
                        //EventingBasicConsumer consumer = new EventingBasicConsumer(channel);
                        var consumer = new AsyncEventingBasicConsumer(channel);
                        //channel.BasicConsume(queue: item.QueueName, autoAck: false, consumer: consumer);
                        channel.BasicConsumeAsync(queue: item.QueueName, autoAck: false, consumer: consumer);
                        item.Channel = channel;
                        //consumer.Received += (model, ea) => HandleMessage(item, ea, channel);
                        consumer.ReceivedAsync += (model, ea) => HandleMessage(item, ea, channel);
                    }
                }
                return true;
            }
            catch (Exception ex)
            {
                
                if (channel != null && channel.IsOpen)
                {
                    //channel.Close();
                    channel.DisposeAsync();
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
                    DosResultList<dynamic> resultList = MicroiEngine.FormEngine.GetTableData(param);
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
                    var addList = databaseList.Where(x => !list.Any(a => x.QueueName == a.Value.QueueName)).ToList();
                    if (addList != null && addList.Count > 0)
                    {
                        addList.ForEach(item =>
                        {
                            if (RegisterMQ(item))
                            {
                                var addResult = list.TryAdd(item.QueueName, item);
                                if (!addResult)
                                {
                                    Console.WriteLine($"Microi：【Error异常】添加MQ失败：" + JsonConvert.SerializeObject(item));
                                }
                            }
                        });
                    }
                    // 获取list集合有数据库没有，需要删除
                    var removeList = list.Where(x => !databaseList.Any(a => x.Value.QueueName == a.QueueName)).ToList();
                    if (removeList != null && removeList.Count > 0)
                    {
                        removeList.ForEach(item =>
                        {
                            if (item.Value.Channel != null && item.Value.Channel.IsOpen)
                            {
                                //item.Channel.Close();
                                item.Value.Channel.DisposeAsync();
                            }
                            var delResult = list.Remove(item.Value.QueueName, out _);
                            if (!delResult)
                            {
                                Console.WriteLine($"Microi：【Error异常】添加MQ失败：" + JsonConvert.SerializeObject(item));
                            }
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


        //private void HandleMessage(MicroiMQReceiveInfo item,BasicDeliverEventArgs ea, IModel channel)
        private async Task HandleMessage(MicroiMQReceiveInfo item, BasicDeliverEventArgs ea, IChannel channel)
        {
            bool success = false;
            string receiveTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            string statusInfo = "正常";
            string status = "成功";
            var body = ea.Body.ToArray();
            MicroiMQMessageModel messageModel = JsonConvert.DeserializeObject<MicroiMQMessageModel>(Encoding.UTF8.GetString(body));
            var msg = messageModel.Message;
            try
            {                
                if (item.Type.Equals(Convert.ToInt32(MicroiMQConst.MQTypeApiEngineKey))) // 接口引擎处理业务逻辑
                {
                    JObject obj = new JObject();
                    obj["Message"] = JToken.FromObject(messageModel);
                    //调用接口引擎
                    // success = (bool)_apiEngineLogic.Run(obj);
                    var apiEngineResult = await MicroiEngine.ApiEngine.RunAsync(item.ApiEngineKey, obj);
                    if(apiEngineResult == null)
                    {
                        success = true;
                    }
                    else
                    {
                        try
                        {
                            var tmpResult = ((JObject)JObject.FromObject(apiEngineResult)).ToObject<DosResult>();
                            if(tmpResult == null || tmpResult.Code != 1)
                            {
                                success = false;
                            }
                            else
                            {
                                success = true;
                            }
                        }
                        catch (System.Exception)
                        {
                            success = true;
                        }
                    }
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
                    object[] parameters = new object[1] { messageModel.Message };
                    success = (bool)method.Invoke(obj, parameters);
                }
                if (success)
                {
                    // 回ack,服务器删除消息
                    //channel.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
                    channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false);
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
                    //channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: false);
                    channel.BasicRejectAsync(deliveryTag: ea.DeliveryTag, requeue: false);
                }
            }
            catch (Exception ex)
            {
                        
                
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
                    //channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: false);
                    channel.BasicRejectAsync(deliveryTag: ea.DeliveryTag, requeue: false);
                }
            }
            // 写入消息日志
            MicroiEngine.FormEngine.AddFormData(new
            {
                FormEngineKey = MicroiMQConst.queueLogTable,
                _RowModel = new Dictionary<string, object>()
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

        //private string FailToRejectHandler(MicroiMQReceiveInfo item, MicroiMQMessageModel messageModel, BasicDeliverEventArgs ea, IModel channel,string msg)
        private string FailToRejectHandler(MicroiMQReceiveInfo item, MicroiMQMessageModel messageModel, BasicDeliverEventArgs ea, IChannel channel,string msg)
        {
            string statusInfo = msg;
            string key = "MicroiMQ:" + messageModel.Id;
            // todo ： 这里是否应该考虑到osClient的cache？
            if(MicroiEngine.CacheTenant.Default().KeyExist(key))
            {
                // todo ： 这里是否应该考虑到osClient的cache？
                int count = Convert.ToInt32(MicroiEngine.CacheTenant.Default().Get(key));
                if (count >= item.Count)
                {
                    statusInfo = "消息达到重回队列次数，删除消息";
                    //channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: false);
                    channel.BasicRejectAsync(deliveryTag: ea.DeliveryTag, requeue: false);
                }
                else
                {
                    MicroiEngine.CacheTenant.Default().Set(key, count+1);
                    // 消息重回队列
                    //channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: true);
                    channel.BasicRejectAsync(deliveryTag: ea.DeliveryTag, requeue: true);
                }
            }
            else
            {
                MicroiEngine.CacheTenant.Default().Set(key, 1);
                // 消息重回队列
                //channel.BasicReject(deliveryTag: ea.DeliveryTag, requeue: true);
                channel.BasicRejectAsync(deliveryTag: ea.DeliveryTag, requeue: true);
            }
            return statusInfo;
        }
        
    }
}
