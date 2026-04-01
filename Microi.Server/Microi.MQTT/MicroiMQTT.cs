using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using MQTTnet;
using MQTTnet.Packets;
using MQTTnet.Protocol;
using MQTTnet.Server;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Microi.MQTT，支持SaaS多租户，暂时未考虑集群、分布式，后期升级
    /// </summary>
    public class MicroiMQTT : IMicroiMQTT
    {
        private MqttServer _mqttServer;
        public bool IsRunning { get; private set; }

        /// <summary>
        /// 客户端连接映射：ClientId → OsClient（租户标识），线程安全
        /// </summary>
        public static ConcurrentDictionary<string, string> ConnectedClients = new ConcurrentDictionary<string, string>();

        public async Task StartServerAsync(OsClientSecret clientModel)
        {
            try
            {
                Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT服务启动中...");
                if (IsRunning) return;

                var port = 1883;
                if (clientModel != null && clientModel.OsClientModel["MqttPort"] != null && clientModel.OsClientModel["MqttPort"].Val<int>() > 0)
                {
                    port = clientModel.OsClientModel["MqttPort"].Val<int>();
                }

                var options = new MqttServerOptionsBuilder()
                    .WithDefaultEndpoint()
                    .WithDefaultEndpointPort(port)
                    .WithDefaultEndpointBoundIPAddress(IPAddress.Any)
                    .Build();

                _mqttServer = new MqttFactory().CreateMqttServer(options) as MqttServer;

                _mqttServer.ValidatingConnectionAsync += OnValidateConnection;
                _mqttServer.ClientConnectedAsync += OnClientConnected;
                _mqttServer.ClientDisconnectedAsync += OnClientDisconnected;
                _mqttServer.InterceptingPublishAsync += OnMessageReceived;
                _mqttServer.RetainedMessageChangedAsync += OnRetainedMessageChanged;
                await _mqttServer.StartAsync();
                IsRunning = true;

                Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT服务启动成功！TCP端口:{port}");

                // 触发所有配置了MqttApiEngine的租户的StartServer事件
                await FireV8EventForAllTenantsAsync("StartServer", new MqttParam());
            }
            catch (System.Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT服务启动失败：{ex.Message}");
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

        #region SaaS多租户：租户解析与V8引擎调用

        /// <summary>
        /// 解析客户端的OsClient租户标识
        /// 优先级：UserProperties(MQTT v5) > ConnectedClients缓存 > 主租户回退
        /// </summary>
        private string ResolveOsClient(string clientId, List<MqttUserProperty> userProperties = null)
        {
            // 1. 尝试从UserProperties获取（MQTT v5）
            var osClient = userProperties?.Find(d => d.Name == "OsClient")?.Value;
            if (!osClient.DosIsNullOrWhiteSpace())
            {
                return osClient;
            }

            // 2. 尝试从已连接客户端映射获取（验证阶段已注册）
            if (!clientId.DosIsNullOrWhiteSpace() && ConnectedClients.TryGetValue(clientId, out var cached))
            {
                return cached;
            }

            // 3. 回退到主租户
            return OsClient.GetConfigOsClient();
        }

        /// <summary>
        /// 执行指定租户的MQTT V8引擎事件
        /// </summary>
        private async Task RunMqttV8EngineAsync(string osClient, string eventName, MqttParam mqttParam)
        {
            try
            {
                var clientModel = OsClient.GetClient(osClient);
                if (clientModel == null)
                {
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT V8事件：未找到OsClient配置 osClient={osClient}, Event={eventName}");
                    return;
                }

                var mqttApiEngine = clientModel.OsClientModel?["MqttApiEngine"]?.Val<string>();
                if (mqttApiEngine.DosIsNullOrWhiteSpace()) return;

                var dbs = OsClient.GetAllClientDataBase(clientModel);
                var resultSysConfig = await MicroiEngine.FormEngine.GetSysConfig(osClient);
                var apiEngineResult = await MicroiEngine.ApiEngine.GetApiEngineModel(new ApiEngineParam()
                {
                    OsClient = clientModel.OsClient,
                    Id = mqttApiEngine
                });
                if (apiEngineResult.Code != 1) return;

                var apiV8Code = (string)apiEngineResult.Data.ApiV8Code;
                try
                {
                    if (DiyCommon.IsBase64String(apiV8Code))
                    {
                        apiV8Code = Encoding.Default.GetString(Convert.FromBase64String(apiV8Code));
                    }
                }
                catch { }
                if (apiV8Code.DosIsNullOrWhiteSpace()) return;

                var v8EngineParam = new V8EngineParam()
                {
                    Db = clientModel.Db,
                    DbRead = clientModel.DbRead,
                    Dbs = dbs,
                    Action = new Dictionary<string, object>(),
                    Param = new JObject(),
                    SysConfig = resultSysConfig.Data,
                    EventName = eventName,
                    OsClient = osClient,
                    MQTT = mqttParam ?? new MqttParam()
                };

                v8EngineParam.V8Code = apiV8Code;
                await MicroiEngine.V8Engine.Run(v8EngineParam);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT V8事件执行异常：osClient={osClient}, Event={eventName}, Error={ex.Message}");
            }
        }

        /// <summary>
        /// 对所有配置了MqttApiEngine的租户触发V8事件（StartServer/StopServer）
        /// </summary>
        private async Task FireV8EventForAllTenantsAsync(string eventName, MqttParam mqttParam)
        {
            foreach (var item in OsClient.ClientList)
            {
                try
                {
                    var mqttApiEngine = item.Value.OsClientModel?["MqttApiEngine"]?.Val<string>();
                    if (!mqttApiEngine.DosIsNullOrWhiteSpace())
                    {
                        await RunMqttV8EngineAsync(item.Key, eventName, mqttParam);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT {eventName}事件触发异常：osClient={item.Key}, Error={ex.Message}");
                }
            }
        }

        /// <summary>
        /// 安全解析Payload，JSON解析失败时返回原始字符串
        /// </summary>
        private static (string raw, object parsed) ParsePayload(ArraySegment<byte> payloadSegment)
        {
            var raw = payloadSegment.Count > 0
                ? Encoding.UTF8.GetString(payloadSegment.ToArray<byte>())
                : string.Empty;
            object parsed;
            try { parsed = JsonConvert.DeserializeObject(raw); }
            catch { parsed = raw; }
            return (raw, parsed);
        }

        #endregion

        #region MQTT事件处理

        // 连接验证：解析租户 → 验证凭据 → 注册ClientId映射
        private Task OnValidateConnection(ValidatingConnectionEventArgs args)
        {
            try
            {
                Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT连接开始验证！ ClientId：{args.ClientId}");
                if (string.IsNullOrEmpty(args.ClientId))
                {
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：ClientId为空");
                    args.ReasonCode = MqttConnectReasonCode.ClientIdentifierNotValid;
                    return Task.CompletedTask;
                }

                // 解析租户：优先UserProperties(MQTT v5)，回退到主租户
                var osClient = args.UserProperties?.Find(d => d.Name == "OsClient")?.Value;
                OsClientSecret clientModel = null;
                if (!osClient.DosIsNullOrWhiteSpace())
                {
                    clientModel = OsClient.GetClient(osClient);
                }
                if (clientModel == null)
                {
                    osClient = OsClient.GetConfigOsClient();
                    clientModel = OsClient.GetClient(osClient);
                }
                if (clientModel == null)
                {
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：未找到OsClient配置");
                    args.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
                    return Task.CompletedTask;
                }

                // 验证该租户配置的MQTT账号密码
                var mqttPwd = clientModel.OsClientModel?["MqttPwd"]?.Val<string>();
                var mqttAccount = clientModel.OsClientModel?["MqttAccount"]?.Val<string>();
                if (!mqttAccount.DosIsNullOrWhiteSpace() || !mqttPwd.DosIsNullOrWhiteSpace())
                {
                    if (args.Password != mqttPwd || args.UserName != mqttAccount)
                    {
                        Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：用户名或密码不匹配 ClientId：{args.ClientId}, UserName：{args.UserName}, OsClient：{osClient}");
                        args.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
                        return Task.CompletedTask;
                    }
                }

                // 验证通过：立即注册ClientId→OsClient映射，后续事件直接查询
                ConnectedClients[args.ClientId] = osClient;
                args.ReasonCode = MqttConnectReasonCode.Success;
                Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT连接验证成功！ ClientId：{args.ClientId}, OsClient：{osClient}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT连接验证异常：{ex.Message}\n{ex.StackTrace}");
                args.ReasonCode = MqttConnectReasonCode.UnspecifiedError;
            }
            return Task.CompletedTask;
        }

        // 客户端连接事件：触发对应租户的Connected V8事件
        private async Task<Task> OnClientConnected(ClientConnectedEventArgs args)
        {
            // 从ConnectedClients获取OsClient（验证阶段已注册）
            var osClient = ResolveOsClient(args.ClientId, args.UserProperties);
            Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT连接成功！ ClientId：{args.ClientId}, OsClient：{osClient}");

            // 确保映射已注册（防御性）
            ConnectedClients[args.ClientId] = osClient;

            // 触发该租户的Connected V8事件
            await RunMqttV8EngineAsync(osClient, "Connected", new MqttParam()
            {
                ClientId = args.ClientId
            });

            return Task.CompletedTask;
        }

        // 客户端断开事件：先获取租户映射再清理，触发对应租户的Disconnected V8事件
        private async Task<Task> OnClientDisconnected(ClientDisconnectedEventArgs args)
        {
            // 先获取OsClient再清理（断开时UserProperties可能不可用）
            ConnectedClients.TryGetValue(args.ClientId, out var osClient);
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = args.UserProperties?.Find(d => d.Name == "OsClient")?.Value;
            }
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = OsClient.GetConfigOsClient();
            }

            Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT断开连接！ ClientId：{args.ClientId}, OsClient：{osClient}");

            // 清理连接记录
            ConnectedClients.TryRemove(args.ClientId, out _);

            // 触发该租户的Disconnected V8事件
            await RunMqttV8EngineAsync(osClient, "Disconnected", new MqttParam()
            {
                ClientId = args.ClientId
            });

            return Task.CompletedTask;
        }

        // 保留消息变更事件：路由到对应租户的V8事件
        private async Task<Task> OnRetainedMessageChanged(RetainedMessageChangedEventArgs args)
        {
            Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT消息变更！ ClientId：{args.ClientId}");

            var osClient = ResolveOsClient(args.ClientId);
            var (raw, parsed) = ParsePayload(args.ChangedRetainedMessage.PayloadSegment);
            var topic = args.ChangedRetainedMessage.Topic;

            Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT消息变更！ payload：{raw}, OsClient：{osClient}");

            await RunMqttV8EngineAsync(osClient, "MessageChanged", new MqttParam()
            {
                Topic = topic,
                Payload = parsed,
                ClientId = args.ClientId
            });

            return Task.CompletedTask;
        }

        // 消息接收处理：路由到对应租户的V8事件
        private async Task<Task> OnMessageReceived(InterceptingPublishEventArgs args)
        {
            var osClient = ResolveOsClient(args.ClientId);
            var (raw, parsed) = ParsePayload(args.ApplicationMessage.PayloadSegment);
            var topic = args.ApplicationMessage.Topic;

            await RunMqttV8EngineAsync(osClient, "MessageReceived", new MqttParam()
            {
                Topic = topic,
                Payload = parsed,
                ClientId = args.ClientId
            });

            return Task.CompletedTask;
        }

        #endregion

        public async Task StopServerAsync()
        {
            if (_mqttServer == null || !IsRunning) return;

            // 触发所有配置了MqttApiEngine的租户的StopServer事件
            await FireV8EventForAllTenantsAsync("StopServer", new MqttParam());

            _mqttServer.ValidatingConnectionAsync -= OnValidateConnection;
            _mqttServer.ClientConnectedAsync -= OnClientConnected;
            _mqttServer.ClientDisconnectedAsync -= OnClientDisconnected;
            _mqttServer.InterceptingPublishAsync -= OnMessageReceived;
            _mqttServer.RetainedMessageChangedAsync -= OnRetainedMessageChanged;

            await _mqttServer.StopAsync();
            IsRunning = false;
        }
    }
}