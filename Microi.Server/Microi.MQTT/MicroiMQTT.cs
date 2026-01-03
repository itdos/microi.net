using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using MQTTnet;
using MQTTnet.Protocol;
using MQTTnet.Server;
using Newtonsoft.Json;

namespace Microi.net
{ 
    /// <summary>
    /// Microi.MQTT，暂时未考虑集群、分布式，后期升级
    /// </summary>
    public class MicroiMQTT : IMicroiMQTT
    {
        private MqttServer _mqttServer; // 注意：旧版使用具体类而非接口
        public bool IsRunning { get; private set; }

        public static Dictionary<string, string> ConnectedClients = new Dictionary<string, string>();

        public async Task StartServerAsync(OsClientSecret clientModel)
        {
            try
            {
                Console.WriteLine("Microi：【成功】MQTT服务启动中...");
                if (IsRunning) return;

                var port = 1883;
                if (clientModel != null && clientModel.MqttPort != null && clientModel.MqttPort > 0)
                {
                    port = clientModel.MqttPort.Value;
                }

                // 1. 创建选项（旧版无WithConnectionValidator）
                var options = new MqttServerOptionsBuilder()
                    .WithDefaultEndpoint()
                    .WithDefaultEndpointPort(port)
                    .WithDefaultEndpointBoundIPAddress(IPAddress.Any)
                    .Build();

                _mqttServer = new MqttFactory().CreateMqttServer(options) as MqttServer;

                // 2. 事件注册替代委托:cite[1]
                _mqttServer.ValidatingConnectionAsync += OnValidateConnection;
                _mqttServer.ClientConnectedAsync += OnClientConnected;
                _mqttServer.ClientDisconnectedAsync += OnClientDisconnected;
                _mqttServer.InterceptingPublishAsync += OnMessageReceived;
                _mqttServer.RetainedMessageChangedAsync += OnRetainedMessageChanged;
                await _mqttServer.StartAsync();
                IsRunning = true;
                
                Console.WriteLine("Microi：【成功】MQTT服务启动成功！");
                
                //触发接口引擎
                if (!clientModel.MqttApiEngine.DosIsNullOrWhiteSpace())
                {
                    var dbs = OsClient.GetAllClientDataBase(clientModel);
                    var resultSysConfig = await MicroiEngine.FormEngine.GetSysConfig(clientModel.OsClient);
                    var apiEngineResult = await MicroiEngine.ApiEngine.GetApiEngineModel(new ApiEngineParam()
                    {
                        OsClient = clientModel.OsClient,
                        Id = clientModel.MqttApiEngine
                    });
                    if (apiEngineResult.Code == 1)
                    {
                        var apiV8Code = (string)apiEngineResult.Data.ApiV8Code;
                        //解密
                        try
                        {
                            if (DiyCommon.IsBase64String(apiV8Code))
                            {
                                apiV8Code = Encoding.Default.GetString(Convert.FromBase64String(apiV8Code));
                            }
                        }
                        catch (Exception ex)
                        {
                        }
                        if (!apiV8Code.DosIsNullOrWhiteSpace())
                        {
                            var v8EngineParam = new V8EngineParam()
                            {
                                Db = clientModel.Db,
                                DbRead = clientModel.DbRead,
                                Dbs = dbs,
                                Action = new Dictionary<string, object>(),
                                Param = new Dictionary<string, object>(),
                                SysConfig = resultSysConfig.Data,
                                EventName = "StartServer",
                                OsClient = clientModel.OsClient,
                                MQTT = new MqttParam()
                                {
                                }
                            };
                            try
                            {
                                v8EngineParam.V8Code = apiV8Code;
                                var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                                if(v8RunResult.Code != 1)
                                {
                                    return;
                                }
                                v8EngineParam = v8RunResult.Data;
                            }
                            catch (Exception ex)
                            {

                            }
                        }
                    }

                }
            }
            catch (System.Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】MQTT服务启动失败：" + ex.Message);
            }
        }

        public async Task PublishAsync(MqttApplicationMessage message)
        {
            if (_mqttServer == null || !IsRunning)
                throw new System.InvalidOperationException("MQTT server not running");

            await _mqttServer.InjectApplicationMessage(
                new InjectedMqttApplicationMessage(message)
            );
        }

        // 3. 连接验证（通过事件处理）
        private Task OnValidateConnection(ValidatingConnectionEventArgs args)
        {
            Console.WriteLine($"Microi：MQTT连接开始验证！ ClientId：{ args.ClientId}");
            // 放宽验证条件（根据实际需求调整）
            if (string.IsNullOrEmpty(args.ClientId))
            {
                args.ReasonCode = MqttConnectReasonCode.ClientIdentifierNotValid;
                return Task.CompletedTask;
            }
            //获取OsClient值
            var osClient = args.UserProperties?.Find(d => d.Name == "OsClient")?.Value;
            //获取clientModel
            OsClientSecret clientModel = null;
            if (!osClient.DosIsNullOrWhiteSpace())
            {
                clientModel = OsClient.GetClient(osClient);
            }
            if (clientModel == null)
            {
                clientModel = OsClient.GetClient(OsClient.GetConfigOsClient());
            }

            // 可选：仅验证密码（根据您的安全需求）
            if (args.Password != clientModel.MqttPwd || args.UserName != clientModel.MqttAccount) // 使用您设置的密码
            {
                args.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
                return Task.CompletedTask;
            }
            args.ReasonCode = MqttConnectReasonCode.Success;
            Console.WriteLine($"Microi：MQTT连接验证成功！ ClientId：{ args.ClientId}");
            return Task.CompletedTask;
        }

        // 4. 客户端连接事件
        private async Task<Task> OnClientConnected(ClientConnectedEventArgs args)
        {
            Console.WriteLine($"Microi：【成功】MQTT连接成功！ ClientId：{ args.ClientId}");
            //获取OsClient值
            var osClient = args.UserProperties?.Find(d => d.Name == "OsClient")?.Value;
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = OsClient.GetConfigOsClient();
            }
            //获取clientModel
            OsClientSecret clientModel = OsClient.GetClient(osClient);
            //触发接口引擎
            if (!clientModel.MqttApiEngine.DosIsNullOrWhiteSpace())
            { 
                var dbs = OsClient.GetAllClientDataBase(clientModel);
                var resultSysConfig = await MicroiEngine.FormEngine.GetSysConfig(osClient);
                var apiEngineResult = await MicroiEngine.ApiEngine.GetApiEngineModel(new ApiEngineParam()
                {
                    OsClient = clientModel.OsClient,
                    Id = clientModel.MqttApiEngine
                });
                if (apiEngineResult.Code == 1)
                {
                    var apiV8Code = (string)apiEngineResult.Data.ApiV8Code;
                    //解密
                    try
                    {
                        if (DiyCommon.IsBase64String(apiV8Code))
                        {
                            apiV8Code = Encoding.Default.GetString(Convert.FromBase64String(apiV8Code));
                        }
                    }
                    catch (Exception ex)
                    {
                    }
                    if (!apiV8Code.DosIsNullOrWhiteSpace())
                    {
                        var v8EngineParam = new V8EngineParam()
                        {
                            Db = clientModel.Db,
                            DbRead = clientModel.DbRead,
                            Dbs = dbs,
                            Action = new Dictionary<string, object>(),
                            Param = new Dictionary<string, object>(),
                            SysConfig = resultSysConfig.Data,
                            EventName = "Connected",
                            OsClient = osClient,
                            MQTT = new MqttParam()
                            {
                                ClientId = args.ClientId
                            }
                        };
                        try
                        {
                            v8EngineParam.V8Code = apiV8Code;
                            var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                            if(v8RunResult.Code != 1)
                            {
                                // return new DosResult(0, null, v8RunResult.Msg, 0, v8RunResult.DataAppend);
                            }
                            v8EngineParam = v8RunResult.Data;
                        }
                        catch (Exception ex)
                        {

                        }
                    }
                }
                
            }
            //暂时未考虑分布式
            if (ConnectedClients.ContainsKey(args.ClientId))
            {
                ConnectedClients[args.ClientId] = osClient;
            }
            else
            {
                ConnectedClients.Add(args.ClientId, osClient);
            }
            return Task.CompletedTask;
        }

        // 5. 客户端断开事件
        private async Task<Task> OnClientDisconnected(ClientDisconnectedEventArgs args)
        {
            Console.WriteLine($"Microi：MQTT断开连接！ ClientId：{ args.ClientId}");
            //获取OsClient值
            var osClient = args.UserProperties?.Find(d => d.Name == "OsClient")?.Value;
            //获取clientModel
            OsClientSecret clientModel = null;
            if (!osClient.DosIsNullOrWhiteSpace())
            {
                clientModel = OsClient.GetClient(osClient);
            }
            if (clientModel == null)
            {
                clientModel = OsClient.GetClient(OsClient.GetConfigOsClient());
            }
            //触发接口引擎
            if (!clientModel.MqttApiEngine.DosIsNullOrWhiteSpace())
            { 
                var dbs = OsClient.GetAllClientDataBase(clientModel);
                var resultSysConfig = await MicroiEngine.FormEngine.GetSysConfig(osClient);
                var apiEngineResult = await MicroiEngine.ApiEngine.GetApiEngineModel(new ApiEngineParam()
                {
                    OsClient = clientModel.OsClient,
                    Id = clientModel.MqttApiEngine
                });
                if (apiEngineResult.Code == 1)
                {
                    var apiV8Code = (string)apiEngineResult.Data.ApiV8Code;
                    //解密
                    try
                    {
                        if (DiyCommon.IsBase64String(apiV8Code))
                        {
                            apiV8Code = Encoding.Default.GetString(Convert.FromBase64String(apiV8Code));
                        }
                    }
                    catch (Exception ex)
                    {
                    }
                    if (!apiV8Code.DosIsNullOrWhiteSpace())
                    {
                        var v8EngineParam = new V8EngineParam()
                        {
                            Db = clientModel.Db,
                            DbRead = clientModel.DbRead,
                            Dbs = dbs,
                            Action = new Dictionary<string, object>(),
                            Param = new Dictionary<string, object>(),
                            SysConfig = resultSysConfig.Data,
                            EventName = "Disconnected",
                            OsClient = osClient,
                            MQTT = new MqttParam()
                            {
                                ClientId = args.ClientId
                            }
                        };
                        try
                        {
                            v8EngineParam.V8Code = apiV8Code;
                            var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                            if(v8RunResult.Code != 1)
                            {
                                // return new DosResult(0, null, v8RunResult.Msg, 0, v8RunResult.DataAppend);
                            }
                            v8EngineParam = v8RunResult.Data;
                        }
                        catch (Exception ex)
                        {

                        }
                    }
                }
                
            }
            return Task.CompletedTask;
        }

        private async Task<Task> OnRetainedMessageChanged(RetainedMessageChangedEventArgs args)
        {
            Console.WriteLine($"Microi：MQTT消息变更！ ClientId：{ args.ClientId}");
            //获取OsClient值，根据ClientId获取OsClient值
            var osClient = ConnectedClients[args.ClientId];
            //获取clientModel
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = OsClient.GetConfigOsClient();
            }
            OsClientSecret clientModel = OsClient.GetClient(osClient);
            var payload = args.ChangedRetainedMessage.PayloadSegment.Count > 0
                ? Encoding.UTF8.GetString(args.ChangedRetainedMessage.PayloadSegment.ToArray<byte>())
                : string.Empty;
            var payloadObj = JsonConvert.DeserializeObject(payload);
            var topic = args.ChangedRetainedMessage.Topic;
            Console.WriteLine($"Microi：MQTT消息变更！ payload：{ payload }");
            //触发接口引擎
            if (!clientModel.MqttApiEngine.DosIsNullOrWhiteSpace())
            {
                var dbs = OsClient.GetAllClientDataBase(clientModel);
                var resultSysConfig = await MicroiEngine.FormEngine.GetSysConfig(osClient);
                var apiEngineResult = await MicroiEngine.ApiEngine.GetApiEngineModel(new ApiEngineParam()
                {
                    OsClient = clientModel.OsClient,
                    Id = clientModel.MqttApiEngine
                });
                if (apiEngineResult.Code == 1)
                {
                    var apiV8Code = (string)apiEngineResult.Data.ApiV8Code;
                    //解密
                    try
                    {
                        if (DiyCommon.IsBase64String(apiV8Code))
                        {
                            apiV8Code = Encoding.Default.GetString(Convert.FromBase64String(apiV8Code));
                        }
                    }
                    catch (Exception ex)
                    {
                    }
                    if (!apiV8Code.DosIsNullOrWhiteSpace())
                    {
                        var v8EngineParam = new V8EngineParam()
                        {
                            Db = clientModel.Db,
                            DbRead = clientModel.DbRead,
                            Dbs = dbs,
                            Action = new Dictionary<string, object>(),
                            Param = new Dictionary<string, object>(),
                            SysConfig = resultSysConfig.Data,
                            EventName = "MessageChanged",
                            OsClient = osClient,
                            MQTT = new MqttParam()
                            {
                                Topic = topic,
                                Payload = payloadObj,
                                ClientId = args.ClientId
                            }
                        };
                        try
                        {
                            v8EngineParam.V8Code = apiV8Code;
                            var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                            if(v8RunResult.Code != 1)
                            {
                                // return new DosResult(0, null, v8RunResult.Msg, 0, v8RunResult.DataAppend);
                            }
                            v8EngineParam = v8RunResult.Data;
                        }
                        catch (Exception ex)
                        {

                        }
                    }
                }

            }
            return Task.CompletedTask;
        }

        // 6. 消息接收处理（替代ApplicationMessageInterceptor）
        private async Task<Task> OnMessageReceived(InterceptingPublishEventArgs args)
        {
            Console.WriteLine($"Microi：MQTT接收消息！ ClientId：{ args.ClientId}");
            //获取OsClient值，根据ClientId获取OsClient值
            var osClient = ConnectedClients[args.ClientId];
            //获取clientModel
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = OsClient.GetConfigOsClient();
            }
            OsClientSecret clientModel = OsClient.GetClient(osClient);
            var payload = args.ApplicationMessage.PayloadSegment.Count > 0
                ? Encoding.UTF8.GetString(args.ApplicationMessage.PayloadSegment.ToArray<byte>())
                : string.Empty;
            var payloadObj = JsonConvert.DeserializeObject(payload);
            var topic = args.ApplicationMessage.Topic;
            Console.WriteLine($"Microi：MQTT接收消息！ payload：{ payload }、topic：{ topic }");
            //触发接口引擎
            if (!clientModel.MqttApiEngine.DosIsNullOrWhiteSpace())
            {
                var dbs = OsClient.GetAllClientDataBase(clientModel);
                var resultSysConfig = await MicroiEngine.FormEngine.GetSysConfig(osClient);
                var apiEngineResult = await MicroiEngine.ApiEngine.GetApiEngineModel(new ApiEngineParam()
                {
                    OsClient = clientModel.OsClient,
                    Id = clientModel.MqttApiEngine
                });
                if (apiEngineResult.Code == 1)
                {
                    var apiV8Code = (string)apiEngineResult.Data.ApiV8Code;
                    //解密
                    try
                    {
                        if (DiyCommon.IsBase64String(apiV8Code))
                        {
                            apiV8Code = Encoding.Default.GetString(Convert.FromBase64String(apiV8Code));
                        }
                    }
                    catch (Exception ex)
                    {
                    }
                    if (!apiV8Code.DosIsNullOrWhiteSpace())
                    {
                        var v8EngineParam = new V8EngineParam()
                        {
                            Db = clientModel.Db,
                            DbRead = clientModel.DbRead,
                            Dbs = dbs,
                            Action = new Dictionary<string, object>(),
                            Param = new Dictionary<string, object>(),
                            SysConfig = resultSysConfig.Data,
                            EventName = "MessageReceived",
                            OsClient = osClient,
                            MQTT = new MqttParam()
                            {
                                Topic = topic,
                                Payload = payloadObj,
                                ClientId = args.ClientId
                            }
                        };
                        try
                        {
                            v8EngineParam.V8Code = apiV8Code;
                            var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                            if(v8RunResult.Code != 1)
                            {
                                // return new DosResult(0, null, v8RunResult.Msg, 0, v8RunResult.DataAppend);
                            }
                            v8EngineParam = v8RunResult.Data;
                        }
                        catch (Exception ex)
                        {

                        }
                    }
                }

            }
            return Task.CompletedTask;
        }

        public async Task StopServerAsync()
        {
            if (_mqttServer == null || !IsRunning) return;

            // //获取OsClient值，根据ClientId获取OsClient值
            // var osClient = ConnectedClients[args.ClientId];
            // //获取clientModel
            // if (osClient.DosIsNullOrWhiteSpace())
            // {
            //     osClient = OsClient.GetConfigOsClient();
            // }
            // OsClientSecret clientModel = OsClient.GetClient(osClient);

            // 7. 取消事件注册
            _mqttServer.ValidatingConnectionAsync -= OnValidateConnection;
            _mqttServer.ClientConnectedAsync -= OnClientConnected;
            _mqttServer.ClientDisconnectedAsync -= OnClientDisconnected;
            _mqttServer.ClientDisconnectedAsync -= OnClientDisconnected;
            _mqttServer.RetainedMessageChangedAsync -= OnRetainedMessageChanged;

            await _mqttServer.StopAsync();
            IsRunning = false;
        }
    }
}