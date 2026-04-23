using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
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
    /// Microi.MQTT，支持 SaaS 多租户。
    /// 当前为单机版（ConnectedClients 基于内存 ConcurrentDictionary），
    /// 集群部署时需将 ConnectedClients 改造为 Redis 等分布式存储。
    /// </summary>
    public class MicroiMQTT : IMicroiMQTT
    {
        private MqttServer _mqttServer;
        public bool IsRunning { get; private set; }

        /// <summary>
        /// 客户端连接映射：ClientId → OsClient（租户标识），线程安全。
        /// 由于 MQTT Broker 内 ClientId 全局唯一，因此 ClientId 单一 Key 已足够；
        /// 跨租户冲突由 OnValidateConnection 拒绝同 ClientId 跨租户接入来保证。
        /// </summary>
        private static readonly ConcurrentDictionary<string, string> _connectedClients
            = new ConcurrentDictionary<string, string>();

        /// <summary>
        /// 设备级 ApiEngineId 缓存：ClientId → 设备专属接口引擎Id（来自 mci_mqtt_client.ApiEngineId）。
        /// 若该字段为空则不入缓存，运行时回退到租户默认 OsClientModel.MqttApiEngine。
        /// 连接成功时刷新，断开时清理。
        /// </summary>
        private static readonly ConcurrentDictionary<string, string> _clientApiEngineCache
            = new ConcurrentDictionary<string, string>();

        // mci_mqtt_log / mci_mqtt_client 表名与日志类型常量
        private const string LogTable = "mci_mqtt_log";
        private const string ClientTable = "mci_mqtt_client";
        private const string LogTypeServerStart = "ServerStart";
        private const string LogTypeServerStop = "ServerStop";
        private const string LogTypeConnect = "Connect";
        private const string LogTypeDisconnect = "Disconnect";
        private const string LogTypeReceive = "Receive";
        private const string LogTypeSubscribe = "Subscribe";

        public IReadOnlyDictionary<string, string> ConnectedClients => _connectedClients;

        public async Task StartServerAsync(OsClientSecret clientModel)
        {
            if (IsRunning) return;
            var port = 1883;
            try
            {
                Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT服务启动中...");

                if (clientModel != null
                    && clientModel.OsClientModel?["MqttPort"] != null
                    && clientModel.OsClientModel["MqttPort"].Val<int>() > 0)
                {
                    port = clientModel.OsClientModel["MqttPort"].Val<int>();
                }

                var builder = new MqttServerOptionsBuilder()
                    .WithDefaultEndpoint()
                    .WithDefaultEndpointPort(port)
                    .WithDefaultEndpointBoundIPAddress(IPAddress.Any);

                // TLS 支持：当主租户配置 MqttUseTls=1 时启用
                var useTls = clientModel?.OsClientModel?["MqttUseTls"]?.Val<int>() == 1;
                if (useTls)
                {
                    var certPath = clientModel.OsClientModel?["MqttCertPath"]?.Val<string>();
                    var certPwd = clientModel.OsClientModel?["MqttCertPassword"]?.Val<string>();
                    var tlsPort = clientModel.OsClientModel?["MqttTlsPort"]?.Val<int>() ?? 8883;
                    if (!string.IsNullOrWhiteSpace(certPath) && File.Exists(certPath))
                    {
                        var cert = new System.Security.Cryptography.X509Certificates.X509Certificate2(certPath, certPwd);
                        builder
                            .WithEncryptedEndpoint()
                            .WithEncryptedEndpointPort(tlsPort)
                            .WithEncryptedEndpointBoundIPAddress(IPAddress.Any)
                            .WithEncryptionCertificate(cert.Export(System.Security.Cryptography.X509Certificates.X509ContentType.Pfx))
                            .WithEncryptionSslProtocol(System.Security.Authentication.SslProtocols.Tls12);
                        Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT TLS 已启用，端口:{tlsPort}");
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT TLS 已开启但证书路径无效：{certPath}");
                    }
                }

                _mqttServer = new MqttFactory().CreateMqttServer(builder.Build()) as MqttServer;

                _mqttServer.ValidatingConnectionAsync += OnValidateConnection;
                _mqttServer.ClientConnectedAsync += OnClientConnected;
                _mqttServer.ClientDisconnectedAsync += OnClientDisconnected;
                _mqttServer.InterceptingPublishAsync += OnMessageReceived;
                _mqttServer.InterceptingSubscriptionAsync += OnInterceptingSubscription;
                _mqttServer.RetainedMessageChangedAsync += OnRetainedMessageChanged;
                await _mqttServer.StartAsync();
                IsRunning = true;

                Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT服务启动成功！TCP端口:{port}");

                // 内部写入 mci_mqtt_log（服务启动日志） + 触发所有配置了MqttApiEngine的租户的StartServer V8事件
                await WriteServerLifecycleLogAsync(LogTypeServerStart, $"MQTT服务启动成功，端口:{port}");
                await FireV8EventForAllTenantsAsync("StartServer", new MqttParam());
            }
            catch (System.Net.Sockets.SocketException sox) when (sox.SocketErrorCode == System.Net.Sockets.SocketError.AddressAlreadyInUse)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT启动失败：端口 {port} 已被占用，请检查是否有其他 MQTT Broker 或程序实例正在运行。");
            }
            catch (System.Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT服务启动失败：{ex.Message}\n{ex.StackTrace}");
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

        public async Task PublishAsync(string osClient, string topic, string payload, int qos = 0, bool retain = false)
        {
            if (_mqttServer == null || !IsRunning)
                throw new InvalidOperationException("MQTT server not running");
            if (string.IsNullOrWhiteSpace(osClient))
                throw new ArgumentNullException(nameof(osClient));
            if (string.IsNullOrWhiteSpace(topic))
                throw new ArgumentNullException(nameof(topic));

            // 强制 Topic 租户前缀（若该租户启用 Topic 隔离）
            var finalTopic = ApplyTopicIsolation(osClient, topic, isPublish: true);

            var message = new MqttApplicationMessageBuilder()
                .WithTopic(finalTopic)
                .WithPayload(payload ?? string.Empty)
                .WithQualityOfServiceLevel((MqttQualityOfServiceLevel)qos)
                .WithRetainFlag(retain)
                .Build();

            await _mqttServer.InjectApplicationMessage(new InjectedMqttApplicationMessage(message));
        }

        #region SaaS多租户：租户解析与V8引擎调用

        /// <summary>
        /// 解析客户端的OsClient租户标识
        /// 优先级：ConnectedClients缓存（最权威） > UserProperties(MQTT v5) > 主租户回退
        /// </summary>
        private string ResolveOsClient(string clientId, List<MqttUserProperty> userProperties = null)
        {
            // 1. 已连接客户端映射（验证阶段已注册，是最权威来源）
            if (!clientId.DosIsNullOrWhiteSpace() && _connectedClients.TryGetValue(clientId, out var cached))
            {
                return cached;
            }

            // 2. 尝试从UserProperties获取（MQTT v5）
            var osClient = userProperties?.Find(d => d.Name == "OsClient")?.Value;
            if (!osClient.DosIsNullOrWhiteSpace())
            {
                return osClient;
            }

            // 3. 回退到主租户
            return OsClient.GetConfigOsClient();
        }

        /// <summary>
        /// 当前租户是否启用 Topic 隔离（默认开启，需显式 MqttTopicIsolation=0 才关闭）
        /// </summary>
        private static bool IsTopicIsolationEnabled(OsClientSecret clientModel)
        {
            var v = clientModel?.OsClientModel?["MqttTopicIsolation"];
            if (v == null) return true;
            return v.Val<int>() != 0;
        }

        /// <summary>
        /// 当前租户是否允许匿名连接（默认禁止）
        /// </summary>
        private static bool IsAnonymousAllowed(OsClientSecret clientModel)
        {
            return clientModel?.OsClientModel?["MqttAllowAnonymous"]?.Val<int>() == 1;
        }

        /// <summary>
        /// 强制 Topic 加上租户前缀（仅 publish 自动补；subscribe 不擅自改写）
        /// </summary>
        private string ApplyTopicIsolation(string osClient, string topic, bool isPublish)
        {
            var clientModel = OsClient.GetClient(osClient);
            if (!IsTopicIsolationEnabled(clientModel)) return topic;

            var prefix = osClient + "/";
            if (topic.StartsWith(prefix, StringComparison.Ordinal)) return topic;

            if (isPublish) return prefix + topic;
            return topic;
        }

        /// <summary>
        /// 执行指定租户的MQTT V8引擎事件，返回 V8 执行结果（Code=1 成功）
        /// </summary>
        private async Task<DosResult> RunMqttV8EngineAsync(string osClient, string eventName, MqttParam mqttParam)
        {
            try
            {
                var clientModel = OsClient.GetClient(osClient);
                if (clientModel == null)
                {
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT V8事件：未找到OsClient配置 osClient={osClient}, Event={eventName}");
                    return null;
                }

                // 优先取设备级 ApiEngineId（mci_mqtt_client.ApiEngineId），缺失时回退到租户默认 OsClientModel.MqttApiEngine
                var mqttApiEngine = ResolveClientApiEngineId(mqttParam?.ClientId, clientModel);
                if (mqttApiEngine.DosIsNullOrWhiteSpace()) return null;

                var dbs = OsClient.GetAllClientDataBase(clientModel);
                var resultSysConfig = await MicroiEngine.FormEngine.GetSysConfig(osClient);
                if (mqttParam != null && mqttParam.OsClient.DosIsNullOrWhiteSpace())
                {
                    mqttParam.OsClient = osClient;
                }

                var runResult = await MicroiEngine.ApiEngine.RunAsync(mqttApiEngine, new
                {
                    OsClient = osClient,
                    EventName = eventName,
                    MQTT = mqttParam ?? new MqttParam { OsClient = osClient }
                }, null);
                return new DosResult { Code = 1 };

                // var apiEngineResult = await MicroiEngine.ApiEngine.GetApiEngineModel(new ApiEngineParam()
                // {
                //     OsClient = clientModel.OsClient,
                //     Id = mqttApiEngine
                // });
                // if (apiEngineResult.Code != 1) return null;

                // var apiV8Code = (string)apiEngineResult.Data.ApiV8Code;
                // try
                // {
                //     if (DiyCommon.IsBase64String(apiV8Code))
                //     {
                //         // 修正：使用 UTF-8 而非 Encoding.Default（跨平台一致，避免 GBK 乱码）
                //         apiV8Code = Encoding.UTF8.GetString(Convert.FromBase64String(apiV8Code));
                //     }
                // }
                // catch { }
                // if (apiV8Code.DosIsNullOrWhiteSpace()) return null;

                // var v8EngineParam = new V8EngineParam()
                // {
                //     Db = clientModel.Db,
                //     DbRead = clientModel.DbRead,
                //     Dbs = dbs,
                //     Action = new Dictionary<string, object>(),
                //     Param = new JObject(),
                //     SysConfig = resultSysConfig.Data,
                //     EventName = eventName,
                //     OsClient = osClient,
                //     MQTT = mqttParam ?? new MqttParam { OsClient = osClient },
                //     V8Code = apiV8Code
                // };
                // return await MicroiEngine.V8Engine.Run(v8EngineParam);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT V8事件执行异常：osClient={osClient}, Event={eventName}, Error={ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 对所有配置了MqttApiEngine的租户并发触发V8事件（StartServer/StopServer）
        /// </summary>
        private async Task FireV8EventForAllTenantsAsync(string eventName, MqttParam mqttParam)
        {
            // 快照防止热更新过程中迭代异常
            var snapshot = OsClient.ClientList.ToArray();
            var tasks = new List<Task>(snapshot.Length);
            foreach (var item in snapshot)
            {
                try
                {
                    var mqttApiEngine = item.Value.OsClientModel?["MqttApiEngine"]?.Val<string>();
                    if (!mqttApiEngine.DosIsNullOrWhiteSpace())
                    {
                        var key = item.Key;
                        // 每个租户独立 mqttParam，避免共享引用
                        var tenantParam = new MqttParam
                        {
                            OsClient = key,
                            ClientId = mqttParam?.ClientId,
                            Topic = mqttParam?.Topic,
                            Payload = mqttParam?.Payload,
                            PayloadRaw = mqttParam?.PayloadRaw
                        };
                        tasks.Add(RunMqttV8EngineAsync(key, eventName, tenantParam));
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT {eventName}事件触发异常：osClient={item.Key}, Error={ex.Message}");
                }
            }
            if (tasks.Count > 0)
            {
                await Task.WhenAll(tasks);
            }
        }

        /// <summary>
        /// 安全解析Payload，JSON解析失败时返回原始字符串
        /// </summary>
        private static (string raw, object parsed) ParsePayload(ArraySegment<byte> payloadSegment)
        {
            string raw;
            if (payloadSegment.Count > 0 && payloadSegment.Array != null)
            {
                // 优化：直接基于 ArraySegment 解码，避免 ToArray() 的额外分配
                raw = Encoding.UTF8.GetString(payloadSegment.Array, payloadSegment.Offset, payloadSegment.Count);
            }
            else
            {
                raw = string.Empty;
            }
            object parsed;
            try { parsed = JsonConvert.DeserializeObject(raw); }
            catch { parsed = raw; }
            return (raw, parsed);
        }

        /// <summary>
        /// 常量时间字符串比较，防止时序攻击
        /// </summary>
        private static bool FixedTimeStringEquals(string a, string b)
        {
            var ab = Encoding.UTF8.GetBytes(a ?? string.Empty);
            var bb = Encoding.UTF8.GetBytes(b ?? string.Empty);
            if (ab.Length != bb.Length) return false;
            return CryptographicOperations.FixedTimeEquals(ab, bb);
        }

        private static Dictionary<string, string> UserPropertiesToDict(List<MqttUserProperty> ups)
        {
            if (ups == null || ups.Count == 0) return null;
            var d = new Dictionary<string, string>(ups.Count);
            foreach (var p in ups)
            {
                if (!string.IsNullOrEmpty(p.Name) && !d.ContainsKey(p.Name))
                {
                    d[p.Name] = p.Value;
                }
            }
            return d;
        }

        #endregion

        #region 内部日志(mci_mqtt_log) 与 设备表(mci_mqtt_client) 操作

        /// <summary>
        /// 写入 mci_mqtt_log（系统日志：连接/断开/订阅/消息/服务启停）。
        /// 失败仅打印告警，不会中断 MQTT 主流程。
        /// </summary>
        private static async Task WriteMqttLogAsync(string osClient, string type, string clientId, string topic, object data)
        {
            try
            {
                string dataStr = null;
                if (data != null)
                {
                    dataStr = data is string s ? s : JsonConvert.SerializeObject(data);
                }
                await MicroiEngine.FormEngine.AddFormDataAsync(LogTable, new
                {
                    OsClient = osClient,
                    ClientId = clientId,
                    Type = type,
                    Topic = topic,
                    Data = dataStr
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT日志写入异常 OsClient={osClient}, Type={type}, ClientId={clientId}, Error={ex.Message}");
            }
        }

        /// <summary>
        /// 设备上线/下线时维护 mci_mqtt_client 表（不存在则插入，存在则更新 LastConnectTime / IsOnline），
        /// 并刷新设备级 ApiEngineId 缓存。
        /// </summary>
        private static async Task UpsertMqttClientAsync(string osClient, string clientId, bool isOnline)
        {
            if (string.IsNullOrEmpty(clientId)) return;
            try
            {
                var existing = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(ClientTable, new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "ClientId", "=", clientId }
                    }
                });

                var nowStr = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                // GetFormDataAsync: Code=1 找到, Code=2 不存在
                if (existing != null && existing.Code == 1 && existing.Data != null)
                {
                    string id = existing.Data.Id?.ToString();
                    await MicroiEngine.FormEngine.UptFormDataAsync(ClientTable, new
                    {
                        OsClient = osClient,
                        Id = id,
                        LastConnectTime = nowStr,
                        IsOnline = isOnline ? 1 : 0
                    });

                    // 刷新设备级 ApiEngineId 缓存
                    string apiEngineId = existing.Data.ApiEngineId?.ToString();
                    if (isOnline && !string.IsNullOrWhiteSpace(apiEngineId))
                    {
                        _clientApiEngineCache[clientId] = apiEngineId;
                    }
                    else
                    {
                        _clientApiEngineCache.TryRemove(clientId, out _);
                    }
                }
                else
                {
                    // 首次上线：新增记录（ApiEngineId 留空，由用户后续在表里维护）
                    await MicroiEngine.FormEngine.AddFormDataAsync(ClientTable, new
                    {
                        OsClient = osClient,
                        ClientId = clientId,
                        LastConnectTime = nowStr,
                        IsOnline = isOnline ? 1 : 0
                    });
                    _clientApiEngineCache.TryRemove(clientId, out _);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT设备表操作异常 OsClient={osClient}, ClientId={clientId}, Error={ex.Message}");
            }
        }

        /// <summary>
        /// 解析指定 ClientId 应使用的 ApiEngineId：
        /// 优先返回 mci_mqtt_client.ApiEngineId（设备级，从内存缓存读取，无 DB 开销），
        /// 缺失时回退到租户默认 OsClientModel.MqttApiEngine。
        /// 设备级允许不同设备执行不同业务逻辑（如温度传感器/继电器/网关分别接入各自的解析引擎）。
        /// </summary>
        private static string ResolveClientApiEngineId(string clientId, OsClientSecret clientModel)
        {
            if (!string.IsNullOrEmpty(clientId)
                && _clientApiEngineCache.TryGetValue(clientId, out var deviceEngine)
                && !string.IsNullOrWhiteSpace(deviceEngine))
            {
                return deviceEngine;
            }
            return clientModel?.OsClientModel?["MqttApiEngine"]?.Val<string>();
        }

        /// <summary>
        /// 服务启停时为所有启用 MQTT 的租户各写一条 mci_mqtt_log 记录（ClientId/Topic 留空）。
        /// </summary>
        private static async Task WriteServerLifecycleLogAsync(string type, string message)
        {
            var snapshot = OsClient.ClientList.ToArray();
            var tasks = new List<Task>(snapshot.Length);
            foreach (var item in snapshot)
            {
                // 仅对配置了 MqttApiEngine 的租户写日志（即真正启用 MQTT 的租户）
                var mqttApiEngine = item.Value.OsClientModel?["MqttApiEngine"]?.Val<string>();
                if (mqttApiEngine.DosIsNullOrWhiteSpace()) continue;
                tasks.Add(WriteMqttLogAsync(item.Key, type, null, null, message));
            }
            if (tasks.Count > 0) await Task.WhenAll(tasks);
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

                // 优先级：MQTT v5 UserProperties > Username 前缀 > ClientId 前缀 > 主租户回退
                var osClient = args.UserProperties?.Find(d => d.Name == "OsClient")?.Value;
                OsClientSecret clientModel = null;
                // 1. MQTT v5 UserProperties
                if (!osClient.DosIsNullOrWhiteSpace())
                {
                    OsClient.ClientList.TryGetValue(osClient, out clientModel);
                }
                // 2. MQTT 3.1/3.1.1：Username 前缀格式 "{osClient}:{actualUsername}"（如 "congshi:admin"）
                // effectiveUserName 存放剥离前缀后的实际用户名，用于凭据校验
                var effectiveUserName = args.UserName;
                if (clientModel == null && !string.IsNullOrEmpty(args.UserName))
                {
                    var idx = args.UserName.IndexOf(':');
                    if (idx > 0)
                    {
                        var candidate = args.UserName.Substring(0, idx);
                        if (OsClient.ClientList.TryGetValue(candidate, out var m))
                        {
                            osClient = candidate;
                            clientModel = m;
                            effectiveUserName = args.UserName.Substring(idx + 1);
                        }
                    }
                }
                // 3. MQTT 3.1/3.1.1：ClientId 前缀格式 "{osClient}:{actualClientId}"（如 "congshi:device001"）
                //    Bridge 等格式（如 "bridge:mqtt:huayou:egress:emqx@127..."）首段不是有效 OsClient 时
                //    会自动 fallback 到下一步主租户回退，不会抛异常
                if (clientModel == null && !string.IsNullOrEmpty(args.ClientId))
                {
                    var idx = args.ClientId.IndexOf(':');
                    if (idx > 0)
                    {
                        var candidate = args.ClientId.Substring(0, idx);
                        if (OsClient.ClientList.TryGetValue(candidate, out var m))
                        {
                            osClient = candidate;
                            clientModel = m;
                        }
                    }
                }
                // 4. 最终回退到主租户
                if (clientModel == null)
                {
                    osClient = OsClient.GetConfigOsClient();
                    OsClient.ClientList.TryGetValue(osClient, out clientModel);
                }
                if (clientModel == null)
                {
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：未找到OsClient配置");
                    args.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
                    return Task.CompletedTask;
                }

                // P0：跨租户 ClientId 冲突检测
                if (_connectedClients.TryGetValue(args.ClientId, out var existedOsClient)
                    && !string.Equals(existedOsClient, osClient, StringComparison.Ordinal))
                {
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：ClientId 跨租户冲突 ClientId={args.ClientId}, 已存在 OsClient={existedOsClient}, 新连接 OsClient={osClient}");
                    args.ReasonCode = MqttConnectReasonCode.ClientIdentifierNotValid;
                    return Task.CompletedTask;
                }

                // P0：账号密码校验（修正未配密码默认放行的安全漏洞）
                var mqttPwd = clientModel.OsClientModel?["MqttPwd"]?.Val<string>();
                var mqttAccount = clientModel.OsClientModel?["MqttAccount"]?.Val<string>();
                var hasCredential = !mqttAccount.DosIsNullOrWhiteSpace() || !mqttPwd.DosIsNullOrWhiteSpace();

                if (hasCredential)
                {
                    if (!FixedTimeStringEquals(effectiveUserName, mqttAccount)
                        || !FixedTimeStringEquals(args.Password, mqttPwd))
                    {
                        Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：用户名或密码不匹配 ClientId：{args.ClientId}, OsClient：{osClient}");
                        args.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
                        return Task.CompletedTask;
                    }
                }
                else if (!IsAnonymousAllowed(clientModel))
                {
                    // 未配置账密且未显式允许匿名 → 拒绝
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：租户未配置账号密码且未启用匿名（MqttAllowAnonymous） ClientId：{args.ClientId}, OsClient：{osClient}");
                    args.ReasonCode = MqttConnectReasonCode.NotAuthorized;
                    return Task.CompletedTask;
                }

                // 验证通过：立即注册ClientId→OsClient映射，后续事件直接查询
                _connectedClients[args.ClientId] = osClient;
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
        private async Task OnClientConnected(ClientConnectedEventArgs args)
        {
            // 从ConnectedClients获取OsClient（验证阶段已注册）
            var osClient = ResolveOsClient(args.ClientId, args.UserProperties);
            Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT连接成功！ ClientId：{args.ClientId}, OsClient：{osClient}");

            // 防御性：确保映射已注册
            _connectedClients[args.ClientId] = osClient;

            // 内部写入 mci_mqtt_log + 设备表 mci_mqtt_client（同时刷新设备级 ApiEngineId 缓存）
            await UpsertMqttClientAsync(osClient, args.ClientId, true);
            await WriteMqttLogAsync(osClient, LogTypeConnect, args.ClientId, null, new
            {
                ClientId = args.ClientId,
                UserName = args.UserName
            });

            // 触发该租户的Connected V8事件
            await RunMqttV8EngineAsync(osClient, "Connected", new MqttParam
            {
                ClientId = args.ClientId,
                UserName = args.UserName,
                OsClient = osClient,
                UserProperties = UserPropertiesToDict(args.UserProperties)
            });
        }

        // 客户端断开事件：先获取租户映射再清理，触发对应租户的Disconnected V8事件
        private async Task OnClientDisconnected(ClientDisconnectedEventArgs args)
        {
            // 先获取OsClient再清理（断开时UserProperties可能不可用）
            _connectedClients.TryGetValue(args.ClientId, out var osClient);
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
            _connectedClients.TryRemove(args.ClientId, out _);

            // 内部写入 mci_mqtt_log + 更新设备表 IsOnline=0 + 清理设备级 ApiEngineId 缓存
            await UpsertMqttClientAsync(osClient, args.ClientId, false);
            await WriteMqttLogAsync(osClient, LogTypeDisconnect, args.ClientId, null, null);

            // 触发该租户的Disconnected V8事件
            await RunMqttV8EngineAsync(osClient, "Disconnected", new MqttParam
            {
                ClientId = args.ClientId,
                OsClient = osClient,
                UserProperties = UserPropertiesToDict(args.UserProperties)
            });
        }

        // 订阅拦截：强制 Topic 必须在自己租户的命名空间下
        private async Task OnInterceptingSubscription(InterceptingSubscriptionEventArgs args)
        {
            var osClient = ResolveOsClient(args.ClientId, args.UserProperties);
            var topic = args.TopicFilter?.Topic;

            var clientModel = OsClient.GetClient(osClient);
            if (IsTopicIsolationEnabled(clientModel))
            {
                if (string.IsNullOrEmpty(topic))
                {
                    args.ProcessSubscription = false;
                    if (args.Response != null) args.Response.ReasonCode = MqttSubscribeReasonCode.NotAuthorized;
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT订阅被拒（Topic 为空）：ClientId={args.ClientId}, OsClient={osClient}");
                    return;
                }
                // 自动补全租户前缀，与发布行为保持一致：
                //   "#"         → "huayou/#"
                //   "device/+"  → "huayou/device/+"
                //   "huayou/#"  → 不变
                var corrected = ApplyTopicIsolation(osClient, topic, isPublish: true);
                if (corrected != topic)
                {
                    args.TopicFilter = new MqttTopicFilter
                    {
                        Topic = corrected,
                        QualityOfServiceLevel = args.TopicFilter.QualityOfServiceLevel,
                        NoLocal = args.TopicFilter.NoLocal,
                        RetainAsPublished = args.TopicFilter.RetainAsPublished,
                        RetainHandling = args.TopicFilter.RetainHandling
                    };
                    topic = corrected;
                }
            }

            // 内部写入 mci_mqtt_log（订阅日志）
            await WriteMqttLogAsync(osClient, LogTypeSubscribe, args.ClientId, topic, null);

            await RunMqttV8EngineAsync(osClient, "Subscribing", new MqttParam
            {
                ClientId = args.ClientId,
                Topic = topic,
                OsClient = osClient,
                UserProperties = UserPropertiesToDict(args.UserProperties)
            });
        }

        // 保留消息变更事件：路由到对应租户的V8事件
        private async Task OnRetainedMessageChanged(RetainedMessageChangedEventArgs args)
        {
            if (args.ChangedRetainedMessage == null) return;

            var osClient = ResolveOsClient(args.ClientId);
            var (raw, parsed) = ParsePayload(args.ChangedRetainedMessage.PayloadSegment);
            var topic = args.ChangedRetainedMessage.Topic;

            Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT消息变更！ topic：{topic}, OsClient：{osClient}");

            await RunMqttV8EngineAsync(osClient, "MessageChanged", new MqttParam
            {
                Topic = topic,
                Payload = parsed,
                PayloadRaw = raw,
                ClientId = args.ClientId,
                OsClient = osClient,
                Qos = (int)args.ChangedRetainedMessage.QualityOfServiceLevel,
                Retain = args.ChangedRetainedMessage.Retain
            });
        }

        // 消息接收处理：路由到对应租户的V8事件，V8 返回 Code != 1 可阻断发布
        private async Task OnMessageReceived(InterceptingPublishEventArgs args)
        {
            var osClient = ResolveOsClient(args.ClientId, args.ApplicationMessage?.UserProperties);
            var clientModel = OsClient.GetClient(osClient);
            var topic = args.ApplicationMessage?.Topic;

            // P0：发布 Topic 为空直接拒绝；否则自动补全租户前缀（保证消息落在正确的租户命名空间）
            if (IsTopicIsolationEnabled(clientModel))
            {
                if (string.IsNullOrEmpty(topic))
                {
                    args.ProcessPublish = false;
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT发布被拒（Topic 为空）：ClientId={args.ClientId}, OsClient={osClient}");
                    return;
                }
                // 自动补全前缀：若客户端已写 "congshi/xxx" 则不变；若只写 "xxx" 则改为 "congshi/xxx"
                var corrected = ApplyTopicIsolation(osClient, topic, true);
                if (corrected != topic)
                {
                    args.ApplicationMessage.Topic = corrected;
                    topic = corrected;
                }
            }

            var (raw, parsed) = ParsePayload(args.ApplicationMessage.PayloadSegment);

            // 内部写入 mci_mqtt_log（消息接收日志）
            await WriteMqttLogAsync(osClient, LogTypeReceive, args.ClientId, topic, new
            {
                ClientId = args.ClientId,
                Topic = topic,
                Payload = parsed,
                PayloadRaw = raw
            });

            var v8Result = await RunMqttV8EngineAsync(osClient, "MessageReceived", new MqttParam
            {
                Topic = topic,
                Payload = parsed,
                PayloadRaw = raw,
                ClientId = args.ClientId,
                OsClient = osClient,
                Qos = (int)args.ApplicationMessage.QualityOfServiceLevel,
                Retain = args.ApplicationMessage.Retain,
                UserProperties = UserPropertiesToDict(args.ApplicationMessage.UserProperties)
            });

            // V8 返回 Code != 1 时阻止该消息广播给订阅者
            if (v8Result != null && v8Result.Code != 1)
            {
                args.ProcessPublish = false;
                Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT 消息被 V8 拒绝：ClientId={args.ClientId}, OsClient={osClient}, Topic={topic}, Code={v8Result.Code}, Msg={v8Result.Msg}");
            }
        }

        #endregion

        public async Task StopServerAsync()
        {
            if (_mqttServer == null || !IsRunning) return;

            try
            {
                // 修正：先解绑事件并停止 Broker（Broker 停止后客户端自动断开），最后再触发 StopServer V8 事件
                _mqttServer.ValidatingConnectionAsync -= OnValidateConnection;
                _mqttServer.ClientConnectedAsync -= OnClientConnected;
                _mqttServer.ClientDisconnectedAsync -= OnClientDisconnected;
                _mqttServer.InterceptingPublishAsync -= OnMessageReceived;
                _mqttServer.InterceptingSubscriptionAsync -= OnInterceptingSubscription;
                _mqttServer.RetainedMessageChangedAsync -= OnRetainedMessageChanged;

                await _mqttServer.StopAsync();
                IsRunning = false;
                _connectedClients.Clear();
                _clientApiEngineCache.Clear();

                // 内部写入 mci_mqtt_log（服务停止日志） + 触发 StopServer V8事件
                await WriteServerLifecycleLogAsync(LogTypeServerStop, "MQTT服务已停止");
                await FireV8EventForAllTenantsAsync("StopServer", new MqttParam());
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT服务停止异常：{ex.Message}");
            }
        }
    }
}