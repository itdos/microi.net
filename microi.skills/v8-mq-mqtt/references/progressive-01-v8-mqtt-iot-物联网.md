# v8-mq-mqtt 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-mq-mqtt-002 sha256=1fb410755c51211b4b978d64c9c88fc5649489f4bced8870ebbf255a31b75177 -->
## V8.MQTT — IoT 物联网

先区分两个边界：MQTT 是设备实时双向通道，RabbitMQ 是服务端异步队列；
RS-485、ZigBee、BLE、Modbus 等现场协议需先由网关转换为 MQTT。涉及 MQTT
配置、安全、设备级路由、生产部署或故障排查时，必须继续读取
[MQTT 生产参考](references/mqtt-production.md)，不要只凭下面的快速示例上线。

### 快速实施顺序

1. 先确定拓扑：单节点/独立 MQTT 节点可用内嵌 Broker；多 API 节点不要把
   各节点的会话、订阅和 Retained Message 误认为一个集群。
2. 在 SaaS 引擎为主租户启用监听，并为每个接入租户配置独立完整的
   `MqttAccount`、`MqttPwd` 与 `MqttApiEngine`。
3. 让设备携带 MQTT v5 `OsClient`，或使用 `<OsClient>:<账号>` 用户名、
   `<OsClient>:<设备Id>` ClientId；多个来源同时存在时必须指向同一租户。
4. 在接口引擎按 `V8.EventName` 路由，并只读取 Broker 已校验的 `V8.MQTT`；
   不要从 Payload 重新信任租户、Topic 或设备身份。
5. 用真实客户端验证 TCP/TLS、错误凭据、跨租户 Topic、QoS、Retain、快速重连、
   V8 拒绝、重复消息和节点重启，不能用静态检查代替 Broker/硬件验收。

主租户运行时读取 `MqttPort`（默认 `1883`）以及可选 TLS 配置；子租户自己的
端口不会再启动一套 Broker。`MqttWsPort` 是保留元数据，当前内嵌 Broker 没有
启用 WebSocket 监听。

### MQTT 事件类型

MQTT 通过一个接口引擎处理所有事件，通过 `V8.EventName` 判断当前事件类型：

| V8.EventName | 说明 |
|---|---|
| `StartServer` | MQTT 服务启动 |
| `Connected` | 客户端连接 |
| `Disconnected` | 客户端断开连接 |
| `Subscribing` | Topic 通过 Broker ACL 后发生订阅；用于观察与审计，不承担拒绝语义 |
| `MessageReceived` | 收到客户端消息 |
| `MessageChanged` | Retained Message 发生变化 |
| `StopServer` | MQTT 服务停止 |

### V8.MQTT 上下文

| 属性 | 说明 |
|---|---|
| `V8.MQTT.ClientId` | 客户端 Id |
| `V8.MQTT.OsClient` | Broker 已校验的租户标识 |
| `V8.MQTT.Topic` | 规范化后的完整 Topic |
| `V8.MQTT.Payload` | JSON 自动解析后的对象，或解析失败时的字符串 |
| `V8.MQTT.PayloadRaw` | 原始 UTF-8 Payload 文本 |
| `V8.MQTT.UserName` | 连接事件中的客户端用户名 |
| `V8.MQTT.Qos` | QoS：`0`、`1` 或 `2` |
| `V8.MQTT.Retain` | 是否为 Retained Message |
| `V8.MQTT.UserProperties` | MQTT v5 User Properties；没有时为空 |

子租户必须 `MqttEnable=1` 并配置独立 `MqttAccount/MqttPwd`。子租户不能通过 `MqttAllowAnonymous=1` 或 `MqttTopicIsolation=0` 关闭边界；缺少完整凭据时拒绝连接。Topic 统一为 `tenant/{lowerOsClient}/{businessTopic}`，服务端 publish、subscribe、retained、ResponseTopic 都会校验并拒绝其它租户、`$SYS` 系统 Topic 和 `$share` 共享订阅绕过。

### 完整示例

```javascript
var eventName = V8.EventName;

if (eventName === 'StartServer') {
  console.log('MQTT 服务已启动');

} else if (eventName === 'Connected') {
  console.log('设备已连接: ' + V8.MQTT.ClientId);
  // 记录设备在线状态
  V8.FormEngine.UptFormDataByWhere('Device', {
    _Where: [['DeviceCode', '=', V8.MQTT.ClientId]],
    OnlineStatus: 1,
    LastOnlineTime: DateNow('yyyy-MM-dd HH:mm:ss')
  });

} else if (eventName === 'Disconnected') {
  console.log('设备已断开: ' + V8.MQTT.ClientId);
  V8.FormEngine.UptFormDataByWhere('Device', {
    _Where: [['DeviceCode', '=', V8.MQTT.ClientId]],
    OnlineStatus: 0,
    LastOfflineTime: DateNow('yyyy-MM-dd HH:mm:ss')
  });

} else if (eventName === 'Subscribing') {
  console.log('设备订阅: ' + V8.MQTT.ClientId + ' -> ' + V8.MQTT.Topic);

} else if (eventName === 'MessageReceived') {
  // 处理设备上报的数据
  var clientId = V8.MQTT.ClientId;
  var topic = V8.MQTT.Topic;
  var payload = V8.MQTT.Payload;

  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (ex) {
      return { Code: 0, Msg: 'Payload 必须是合法 JSON。' };
    }
  }
  if (!payload || !payload.eventId) {
    return { Code: 0, Msg: '缺少稳定的 eventId。' };
  }

  console.log('收到消息: ' + clientId + ' - ' + topic);

  // 存储到 MongoDB（适合海量数据）
  V8.MongoDb.AddFormData({
    DbName: 'iot_data',
    TableName: 'device_msg_' + DateNow('yyyy_MM'),
    _FormData: {
      DeviceId: clientId,
      EventId: payload.eventId,
      Topic: topic,
      Payload: payload,
      PayloadRaw: V8.MQTT.PayloadRaw,
      Qos: V8.MQTT.Qos,
      Retain: V8.MQTT.Retain,
      CreateTime: DateNow('yyyy-MM-dd HH:mm:ss')
    }
  });

  // 解析特定主题的数据
  var temperatureTopic = 'tenant/' + V8.OsClient.toLowerCase() + '/sensor/temperature';
  if (topic === temperatureTopic) {
    var temp = Number(payload.temperature);
    if (isNaN(temp)) return { Code: 0, Msg: 'temperature 必须是数字。' };
    if (temp > 80) {
      // 温度报警
      V8.ApiEngine.Run('send-alarm', {
        eventId: payload.eventId,
        deviceId: clientId,
        type: 'temperature',
        value: temp
      });
    }
  }

  return { Code: 1 };

} else if (eventName === 'MessageChanged') {
  console.log('Retained Message 已变化: ' + V8.MQTT.Topic);

} else if (eventName === 'StopServer') {
  console.log('MQTT 服务已停止');
}
```

`MessageReceived` 中只有显式 `Code != 1` 会阻止向订阅者广播；无返回值、普通
字符串/数字、没有 `Code` 的对象和 `Code: 1` 保持兼容放行。已配置事件引擎但
执行异常时失败关闭。其它事件的返回值不改变连接、订阅或生命周期结果。

平台在 V8 前写入接收日志，因此被规则拒绝的消息仍可审计。业务副作用仍必须以
设备提供的稳定 `EventId` 配合唯一约束、inbox/outbox 或条件更新实现幂等；
MQTT QoS、Retain 和连接锁都不等于业务“恰好一次”。

### 设备、下行与部署边界

- 平台自动维护 `mci_mqtt_client` 与 `mci_mqtt_log`；前者支持设备级
  `ApiEngineId` 覆盖租户 `MqttApiEngine`，修改后让设备重新连接刷新当前节点缓存。
- 可信 C# 后端只使用 `IMicroiMQTT.PublishAsync(osClient, ...)` 下行；缺少租户
  上下文的旧重载会拒绝。`V8.MQTT` 当前是事件上下文，不是通用 V8 发布函数。
- 同一 ClientId 快速重连时，旧会话的延迟断开会记录为 `StaleDisconnectIgnored`，
  不会把已接管的新会话误标为离线。
- `ConnectedClients` / `GetConnectedClients(osClient)` 和管理状态接口只表示当前
  MQTT 节点快照，不能作为集群全局在线事实。
- 内嵌 Broker 的会话、订阅、Retained Message 不跨 API 节点共享。多节点生产
  使用独立 MQTT 节点，或外部集群 Broker + 租户感知适配器，并保持业务幂等。

### 变更后的覆盖检查

修改 MQTT 运行时、官网文档或本 Skill 后运行：

```powershell
node microi.skills/v8-mq-mqtt/scripts/check-mqtt-skill-coverage.mjs
```

该检查只证明源码中的事件/上下文字段和关键安全能力已进入文档与 Skill；它不能
证明 Broker、网络、证书、外部集群、真实设备或吞吐已经通过验收。

<!-- /microi-progressive:chunk -->
