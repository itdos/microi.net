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
    /// 连接字典只是当前 Broker 节点的短期路由与诊断快照，
    /// 租户身份、权限和 Topic ACL 始终以共享租户配置及每次 Broker 拦截校验为准。
    /// </summary>
    public class MicroiMQTT : IMicroiMQTT
    {
        private MqttServer _mqttServer;
        public bool IsRunning { get; private set; }

        /// <summary>
        /// 当前节点客户端连接映射：Key=normalizedTenant+separator+ClientId，Value=normalizedTenant。
        /// 复合键避免设备缓存在 SaaS 租户间串用。
        /// </summary>
        private static readonly ConcurrentDictionary<string, string> _connectedClients
            = new ConcurrentDictionary<string, string>();

        /// <summary>
        /// 设备级 ApiEngineId 缓存：normalizedTenant+separator+ClientId → 设备专属接口引擎Id。
        /// 若该字段为空则不入缓存，运行时回退到租户默认 OsClientModel.MqttApiEngine。
        /// 连接成功时刷新，断开时清理。
        /// </summary>
        private static readonly ConcurrentDictionary<string, string> _clientApiEngineCache
            = new ConcurrentDictionary<string, string>();
        private static readonly object _clientRegistrationSync = new object();
        private const char ClientKeySeparator = '\u001f';
        private const string InternalSenderPrefix = "__microi_internal__:";

        // mci_mqtt_log / mci_mqtt_client 表名与日志类型常量
        private const string LogTable = "mci_mqtt_log";
        private const string ClientTable = "mci_mqtt_client";
        private const string LogTypeServerStart = "ServerStart";
        private const string LogTypeServerStop = "ServerStop";
        private const string LogTypeConnect = "Connect";
        private const string LogTypeDisconnect = "Disconnect";
        private const string LogTypeReceive = "Receive";
        private const string LogTypeSubscribe = "Subscribe";

        public IReadOnlyDictionary<string, string> ConnectedClients
            => new Dictionary<string, string>(_connectedClients);

        public IReadOnlyDictionary<string, string> GetConnectedClients(string osClient)
        {
            if (!TryResolveTenant(osClient, out var normalizedTenant, out _))
                throw new ArgumentException("未找到 MQTT 租户配置。", nameof(osClient));

            var prefix = TenantConfigurationSecurity.NormalizeTenantId(normalizedTenant).ToLowerInvariant()
                + ClientKeySeparator;
            var result = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var item in _connectedClients)
            {
                if (item.Key.StartsWith(prefix, StringComparison.Ordinal))
                {
                    result[item.Key.Substring(prefix.Length)] = normalizedTenant;
                }
            }
            return result;
        }

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
            await Task.Yield();
            throw new InvalidOperationException("原生 MQTT 发布缺少租户上下文，已拒绝。请使用 PublishAsync(osClient, ...)。");
        }

        public async Task PublishAsync(string osClient, MqttApplicationMessage message)
        {
            if (_mqttServer == null || !IsRunning)
                throw new InvalidOperationException("MQTT server not running");
            if (message == null) throw new ArgumentNullException(nameof(message));

            var normalizedTenant = EnsureMqttTenantEnabled(osClient);
            message.Topic = NormalizeTopic(normalizedTenant, message.Topic, false);
            if (!string.IsNullOrWhiteSpace(message.ResponseTopic))
            {
                message.ResponseTopic = NormalizeTopic(normalizedTenant, message.ResponseTopic, false);
            }

            if (message.UserProperties == null) message.UserProperties = new List<MqttUserProperty>();
            message.UserProperties.RemoveAll(item => string.Equals(item.Name, "OsClient", StringComparison.OrdinalIgnoreCase));
            message.UserProperties.Add(new MqttUserProperty("OsClient", normalizedTenant));

            await _mqttServer.InjectApplicationMessage(new InjectedMqttApplicationMessage(message)
            {
                SenderClientId = InternalSenderPrefix + normalizedTenant
            });
        }

        public async Task PublishAsync(string osClient, string topic, string payload, int qos = 0, bool retain = false)
        {
            if (string.IsNullOrWhiteSpace(topic))
                throw new ArgumentNullException(nameof(topic));

            var message = new MqttApplicationMessageBuilder()
                .WithTopic(topic)
                .WithPayload(payload ?? string.Empty)
                .WithQualityOfServiceLevel((MqttQualityOfServiceLevel)qos)
                .WithRetainFlag(retain)
                .Build();

            await PublishAsync(osClient, message);
        }

        #region SaaS多租户：租户解析与V8引擎调用

        /// <summary>
        /// 解析客户端的 OsClient。已验证的当前节点连接映射优先，
        /// 其次仅接受合法且存在的 MQTT v5 OsClient；未知租户绝不回退主租户。
        /// </summary>
        private string ResolveOsClient(string clientId, List<MqttUserProperty> userProperties = null)
        {
            if (TryGetConnectedTenant(clientId, out var connectedTenant))
            {
                return connectedTenant;
            }

            if (!clientId.DosIsNullOrWhiteSpace()
                && clientId.StartsWith(InternalSenderPrefix, StringComparison.Ordinal)
                && TryResolveTenant(clientId.Substring(InternalSenderPrefix.Length), out var internalTenant, out _))
            {
                return internalTenant;
            }

            var candidate = userProperties?.Find(d => string.Equals(d.Name, "OsClient", StringComparison.OrdinalIgnoreCase))?.Value;
            return TryResolveTenant(candidate, out var propertyTenant, out _) ? propertyTenant : null;
        }

        private static string NormalizeClientCacheKey(string osClient, string clientId)
        {
            return TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant()
                + ClientKeySeparator
                + (clientId ?? string.Empty);
        }

        private static bool TryGetConnectedTenant(string clientId, out string osClient)
        {
            osClient = null;
            if (clientId.DosIsNullOrWhiteSpace()) return false;
            var suffix = ClientKeySeparator + clientId;
            foreach (var item in _connectedClients)
            {
                if (item.Key.EndsWith(suffix, StringComparison.Ordinal))
                {
                    osClient = item.Value;
                    return true;
                }
            }
            return false;
        }

        private static bool TryRegisterConnectedClient(string osClient, string clientId, out string existedTenant)
        {
            existedTenant = null;
            lock (_clientRegistrationSync)
            {
                if (TryGetConnectedTenant(clientId, out existedTenant)
                    && !string.Equals(existedTenant, osClient, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
                _connectedClients[NormalizeClientCacheKey(osClient, clientId)] = osClient;
                return true;
            }
        }

        private static void RemoveConnectedClient(string osClient, string clientId)
        {
            if (osClient.DosIsNullOrWhiteSpace() || clientId.DosIsNullOrWhiteSpace()) return;
            _connectedClients.TryRemove(NormalizeClientCacheKey(osClient, clientId), out _);
            _clientApiEngineCache.TryRemove(NormalizeClientCacheKey(osClient, clientId), out _);
        }

        private static bool TryResolveTenant(string candidate, out string normalizedTenant, out OsClientSecret clientModel)
        {
            normalizedTenant = null;
            clientModel = null;
            if (candidate.DosIsNullOrWhiteSpace()) return false;
            try
            {
                normalizedTenant = TenantConfigurationSecurity.NormalizeTenantId(candidate);
            }
            catch
            {
                return false;
            }

            if (OsClient.ClientList.TryGetValue(normalizedTenant, out clientModel))
            {
                normalizedTenant = TenantConfigurationSecurity.NormalizeTenantId(clientModel?.OsClient ?? normalizedTenant);
                return true;
            }
            foreach (var item in OsClient.ClientList)
            {
                string normalizedKey;
                try { normalizedKey = TenantConfigurationSecurity.NormalizeTenantId(item.Key); }
                catch { continue; }
                if (!string.Equals(normalizedKey, normalizedTenant, StringComparison.OrdinalIgnoreCase)) continue;
                clientModel = item.Value;
                normalizedTenant = TenantConfigurationSecurity.NormalizeTenantId(clientModel?.OsClient ?? item.Key);
                return true;
            }
            normalizedTenant = null;
            return false;
        }

        private static bool IsMainTenant(string osClient)
        {
            try
            {
                return string.Equals(
                    TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant(),
                    TenantConfigurationSecurity.NormalizeTenantId(OsClient.GetConfigOsClient()).ToLowerInvariant(),
                    StringComparison.Ordinal);
            }
            catch { return false; }
        }

        private static bool IsMqttEnabled(OsClientSecret clientModel)
            => clientModel?.OsClientModel?["MqttEnable"]?.Val<int>() == 1;

        private static string EnsureMqttTenantEnabled(string osClient)
        {
            if (!TryResolveTenant(osClient, out var normalizedTenant, out var clientModel))
                throw new InvalidOperationException("未找到 MQTT 租户配置。");
            if (!IsMqttEnabled(clientModel))
                throw new InvalidOperationException($"租户[{normalizedTenant}]未启用 MQTT。");
            return normalizedTenant;
        }

        private static bool IsAnonymousAllowed(string osClient, OsClientSecret clientModel)
        {
            return IsMainTenant(osClient)
                && clientModel?.OsClientModel?["MqttAllowAnonymous"]?.Val<int>() == 1;
        }

        private static string NormalizeTopic(string osClient, string topic, bool isSubscription)
        {
            if (topic.DosIsNullOrWhiteSpace()) throw new InvalidOperationException("MQTT Topic 不能为空。");
            if (topic.IndexOf('\0') >= 0) throw new InvalidOperationException("MQTT Topic 包含非法字符。");
            var trimmedTopic = topic.Trim().TrimStart('/');
            if (trimmedTopic.StartsWith("$share/", StringComparison.OrdinalIgnoreCase)
                || trimmedTopic.StartsWith("$SYS/", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("MQTT 共享订阅与 Broker 系统 Topic 不允许绕过租户命名空间。");
            }

            var segments = trimmedTopic.Split('/');
            if (isSubscription)
            {
                for (var i = 0; i < segments.Length; i++)
                {
                    var segment = segments[i];
                    if (segment.IndexOf('#') >= 0 && (segment != "#" || i != segments.Length - 1))
                        throw new InvalidOperationException("MQTT 订阅通配符 # 只能作为最后一个完整段。");
                    if (segment.IndexOf('+') >= 0 && segment != "+")
                        throw new InvalidOperationException("MQTT 订阅通配符 + 必须作为完整段。");
                }
            }
            else if (topic.IndexOf('#') >= 0 || topic.IndexOf('+') >= 0)
            {
                throw new InvalidOperationException("MQTT 发布 Topic 不允许通配符。");
            }

            var normalizedTenant = TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant();
            if (segments.Length > 1
                && !string.Equals(segments[0], "tenant", StringComparison.OrdinalIgnoreCase)
                && TryResolveTenant(segments[0], out var legacyTenant, out _)
                && !string.Equals(legacyTenant, normalizedTenant, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("MQTT Topic 不允许访问其它租户命名空间。");
            }

            return TenantConfigurationSecurity.NormalizeMqttTopic(normalizedTenant, topic, true);
        }

        /// <summary>
        /// 执行指定租户的MQTT V8引擎事件，返回 V8 执行结果（Code=1 成功）
        /// </summary>
        private async Task<DosResult> RunMqttV8EngineAsync(string osClient, string eventName, MqttParam mqttParam)
        {
            try
            {
                if (!TryResolveTenant(osClient, out var normalizedTenant, out var clientModel)
                    || !IsMqttEnabled(clientModel))
                {
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT V8事件：未找到OsClient配置 osClient={osClient}, Event={eventName}");
                    return null;
                }
                osClient = normalizedTenant;

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
                return NormalizeMqttV8Result(runResult);

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
                // 已配置 V8 策略时执行异常必须 fail-closed，避免脚本故障反而放行消息。
                return new DosResult(0, null, $"MQTT V8事件执行失败：{ex.Message}");
            }
        }

        /// <summary>
        /// MQTT 事件引擎兼容普通返回值；只有显式返回 DosResult/Code 时才作为策略结果。
        /// 这样既保留旧脚本无返回值即放行的行为，也确保 Code != 1 能真正阻断发布。
        /// </summary>
        private static DosResult NormalizeMqttV8Result(object runResult)
        {
            if (runResult == null)
            {
                return new DosResult { Code = 1 };
            }
            if (runResult is DosResult dosResult)
            {
                return dosResult;
            }

            try
            {
                var json = JObject.FromObject(runResult);
                var code = json.GetValue("Code", StringComparison.OrdinalIgnoreCase);
                if (code == null)
                {
                    return new DosResult { Code = 1 };
                }
                return json.ToObject<DosResult>()
                    ?? new DosResult(0, null, "MQTT V8事件返回了无效的策略结果。");
            }
            catch
            {
                // 字符串、数字等历史普通返回值不承担 ACL 语义，保持兼容放行。
                return new DosResult { Code = 1 };
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
                    if (IsMqttEnabled(item.Value) && !mqttApiEngine.DosIsNullOrWhiteSpace())
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
                        _clientApiEngineCache[NormalizeClientCacheKey(osClient, clientId)] = apiEngineId;
                    }
                    else
                    {
                        _clientApiEngineCache.TryRemove(NormalizeClientCacheKey(osClient, clientId), out _);
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
                    _clientApiEngineCache.TryRemove(NormalizeClientCacheKey(osClient, clientId), out _);
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
            var clientCacheKey = !string.IsNullOrEmpty(clientId) && clientModel != null
                ? NormalizeClientCacheKey(clientModel.OsClient, clientId)
                : null;
            if (!string.IsNullOrEmpty(clientCacheKey)
                && _clientApiEngineCache.TryGetValue(clientCacheKey, out var deviceEngine)
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
                // 仅对显式启用 MQTT 且配置了事件引擎的租户写日志。
                var mqttApiEngine = item.Value.OsClientModel?["MqttApiEngine"]?.Val<string>();
                if (!IsMqttEnabled(item.Value) || mqttApiEngine.DosIsNullOrWhiteSpace()) continue;
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
                if (string.IsNullOrEmpty(args.ClientId) || args.ClientId.IndexOf(ClientKeySeparator) >= 0)
                {
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：ClientId为空或包含非法字符");
                    args.ReasonCode = MqttConnectReasonCode.ClientIdentifierNotValid;
                    return Task.CompletedTask;
                }

                // 优先级：MQTT v5 OsClient > Username 租户前缀 > ClientId 租户前缀 > 精确主租户账号兼容。
                // 显式未知租户直接拒绝，不再无条件回退主租户。
                var explicitTenant = args.UserProperties?
                    .Find(d => string.Equals(d.Name, "OsClient", StringComparison.OrdinalIgnoreCase))?.Value;
                string osClient = null;
                OsClientSecret clientModel = null;
                var effectiveUserName = args.UserName;

                if (!explicitTenant.DosIsNullOrWhiteSpace())
                {
                    if (!TryResolveTenant(explicitTenant, out osClient, out clientModel))
                    {
                        Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：未知租户 OsClient={explicitTenant}, ClientId={args.ClientId}");
                        args.ReasonCode = MqttConnectReasonCode.NotAuthorized;
                        return Task.CompletedTask;
                    }
                }

                string userPrefixTenant = null;
                OsClientSecret userPrefixModel = null;
                var userPrefixLength = -1;
                if (!string.IsNullOrEmpty(args.UserName))
                {
                    var idx = args.UserName.IndexOf(':');
                    if (idx > 0 && TryResolveTenant(args.UserName.Substring(0, idx), out userPrefixTenant, out userPrefixModel))
                    {
                        userPrefixLength = idx;
                    }
                }

                if (clientModel == null && userPrefixModel != null)
                {
                    osClient = userPrefixTenant;
                    clientModel = userPrefixModel;
                    effectiveUserName = args.UserName.Substring(userPrefixLength + 1);
                }
                else if (clientModel != null && userPrefixModel != null)
                {
                    if (!string.Equals(osClient, userPrefixTenant, StringComparison.OrdinalIgnoreCase))
                    {
                        args.ReasonCode = MqttConnectReasonCode.NotAuthorized;
                        return Task.CompletedTask;
                    }
                    effectiveUserName = args.UserName.Substring(userPrefixLength + 1);
                }

                string clientPrefixTenant = null;
                OsClientSecret clientPrefixModel = null;
                var clientSeparatorIndex = args.ClientId.IndexOf(':');
                if (clientSeparatorIndex > 0)
                {
                    TryResolveTenant(args.ClientId.Substring(0, clientSeparatorIndex), out clientPrefixTenant, out clientPrefixModel);
                }
                if (clientModel == null && clientPrefixModel != null)
                {
                    osClient = clientPrefixTenant;
                    clientModel = clientPrefixModel;
                }
                else if (clientModel != null && clientPrefixModel != null
                    && !string.Equals(osClient, clientPrefixTenant, StringComparison.OrdinalIgnoreCase))
                {
                    args.ReasonCode = MqttConnectReasonCode.NotAuthorized;
                    return Task.CompletedTask;
                }

                // 兼容没有传 OsClient/前缀的旧主租户客户端：只有用户名精确等于主租户 MqttAccount 才能选中主租户。
                if (clientModel == null
                    && TryResolveTenant(OsClient.GetConfigOsClient(), out var mainTenant, out var mainModel))
                {
                    var mainAccount = mainModel.OsClientModel?["MqttAccount"]?.Val<string>();
                    if (!mainAccount.DosIsNullOrWhiteSpace() && FixedTimeStringEquals(args.UserName, mainAccount))
                    {
                        osClient = mainTenant;
                        clientModel = mainModel;
                        effectiveUserName = args.UserName;
                    }
                }

                if (clientModel == null)
                {
                    Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：未明确解析到租户 ClientId={args.ClientId}");
                    args.ReasonCode = MqttConnectReasonCode.NotAuthorized;
                    return Task.CompletedTask;
                }

                if (!IsMqttEnabled(clientModel))
                {
                    Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：租户未启用 MQTT OsClient={osClient}");
                    args.ReasonCode = MqttConnectReasonCode.NotAuthorized;
                    return Task.CompletedTask;
                }

                var mqttPwd = clientModel.OsClientModel?["MqttPwd"]?.Val<string>();
                var mqttAccount = clientModel.OsClientModel?["MqttAccount"]?.Val<string>();
                var hasCompleteCredential = !mqttAccount.DosIsNullOrWhiteSpace() && !mqttPwd.DosIsNullOrWhiteSpace();
                var isChildTenant = !IsMainTenant(osClient);

                // 子租户必须使用自身完整账号密码；MqttAllowAnonymous 和 MqttTopicIsolation=0 对子租户不生效。
                if (isChildTenant && !hasCompleteCredential)
                {
                    Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：子租户未配置独立完整凭据 OsClient={osClient}");
                    args.ReasonCode = MqttConnectReasonCode.NotAuthorized;
                    return Task.CompletedTask;
                }

                if (isChildTenant)
                {
                    var otherCredentials = OsClient.ClientList
                        .Where(pair => !string.Equals(pair.Key, osClient, StringComparison.OrdinalIgnoreCase))
                        .Select(pair => new KeyValuePair<string, string>(
                            pair.Value?.OsClientModel?["MqttAccount"]?.Val<string>(),
                            pair.Value?.OsClientModel?["MqttPwd"]?.Val<string>()))
                        .ToArray();
                    if (TenantConfigurationSecurity.HasTenantServiceCredentialCollision(
                            mqttAccount,
                            mqttPwd,
                            otherCredentials))
                    {
                        Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：子租户账号或密码与其它租户重复，已 fail-closed OsClient={osClient}");
                        args.ReasonCode = MqttConnectReasonCode.NotAuthorized;
                        return Task.CompletedTask;
                    }
                }

                if (hasCompleteCredential)
                {
                    if (!FixedTimeStringEquals(effectiveUserName, mqttAccount)
                        || !FixedTimeStringEquals(args.Password, mqttPwd))
                    {
                        Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：用户名或密码不匹配 ClientId：{args.ClientId}, OsClient：{osClient}");
                        args.ReasonCode = MqttConnectReasonCode.BadUserNameOrPassword;
                        return Task.CompletedTask;
                    }
                }
                else if (!IsAnonymousAllowed(osClient, clientModel))
                {
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：租户未配置账号密码且未启用匿名（MqttAllowAnonymous） ClientId：{args.ClientId}, OsClient：{osClient}");
                    args.ReasonCode = MqttConnectReasonCode.NotAuthorized;
                    return Task.CompletedTask;
                }

                if (!TryRegisterConnectedClient(osClient, args.ClientId, out var existedOsClient))
                {
                    Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT验证失败：ClientId 跨租户冲突 ClientId={args.ClientId}, ExistingOsClient={existedOsClient}, OsClient={osClient}");
                    args.ReasonCode = MqttConnectReasonCode.ClientIdentifierNotValid;
                    return Task.CompletedTask;
                }

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
            var osClient = ResolveOsClient(args.ClientId, args.UserProperties);
            if (osClient.DosIsNullOrWhiteSpace())
            {
                Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT连接事件未解析到租户，已跳过 ClientId={args.ClientId}");
                return;
            }
            Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT连接成功！ ClientId：{args.ClientId}, OsClient：{osClient}");

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
            TryGetConnectedTenant(args.ClientId, out var osClient);
            if (osClient.DosIsNullOrWhiteSpace()) osClient = ResolveOsClient(args.ClientId, args.UserProperties);
            if (osClient.DosIsNullOrWhiteSpace())
            {
                Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT断开事件未解析到租户，不回退主租户 ClientId={args.ClientId}");
                return;
            }

            Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT断开连接！ ClientId：{args.ClientId}, OsClient：{osClient}");

            RemoveConnectedClient(osClient, args.ClientId);

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
            if (osClient.DosIsNullOrWhiteSpace()
                || !TryResolveTenant(osClient, out var normalizedTenant, out var clientModel)
                || !IsMqttEnabled(clientModel))
            {
                args.ProcessSubscription = false;
                if (args.Response != null) args.Response.ReasonCode = MqttSubscribeReasonCode.NotAuthorized;
                Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT订阅被拒：未知或未启用租户 ClientId={args.ClientId}");
                return;
            }
            osClient = normalizedTenant;

            try
            {
                var corrected = NormalizeTopic(osClient, topic, true);
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
            catch (Exception ex)
            {
                args.ProcessSubscription = false;
                if (args.Response != null) args.Response.ReasonCode = MqttSubscribeReasonCode.NotAuthorized;
                Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT订阅被 Topic ACL 拒绝：ClientId={args.ClientId}, OsClient={osClient}, Topic={topic}, Error={ex.Message}");
                return;
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
            if (osClient.DosIsNullOrWhiteSpace()
                || !TryResolveTenant(osClient, out var normalizedTenant, out var clientModel)
                || !IsMqttEnabled(clientModel))
            {
                Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT保留消息未解析到已启用租户，已跳过 ClientId={args.ClientId}");
                return;
            }
            osClient = normalizedTenant;
            var (raw, parsed) = ParsePayload(args.ChangedRetainedMessage.PayloadSegment);
            string topic;
            try
            {
                topic = NormalizeTopic(osClient, args.ChangedRetainedMessage.Topic, false);
                args.ChangedRetainedMessage.Topic = topic;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT保留消息 Topic ACL 拒绝：OsClient={osClient}, Error={ex.Message}");
                return;
            }

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
            var topic = args.ApplicationMessage?.Topic;
            if (osClient.DosIsNullOrWhiteSpace()
                || !TryResolveTenant(osClient, out var normalizedTenant, out var clientModel)
                || !IsMqttEnabled(clientModel))
            {
                args.ProcessPublish = false;
                Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT发布被拒：未知或未启用租户 ClientId={args.ClientId}");
                return;
            }
            osClient = normalizedTenant;

            try
            {
                topic = NormalizeTopic(osClient, topic, false);
                args.ApplicationMessage.Topic = topic;
                if (!string.IsNullOrWhiteSpace(args.ApplicationMessage.ResponseTopic))
                {
                    args.ApplicationMessage.ResponseTopic = NormalizeTopic(osClient, args.ApplicationMessage.ResponseTopic, false);
                }
            }
            catch (Exception ex)
            {
                args.ProcessPublish = false;
                Console.WriteLine($"Microi：【⚠️安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT发布被 Topic ACL 拒绝：ClientId={args.ClientId}, OsClient={osClient}, Topic={topic}, Error={ex.Message}");
                return;
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
