---
name: v8-mq-mqtt
description: Microi V8 消息队列与 MQTT 生产指南。用于 V8.MQ.SendMsg、RabbitMQ 消费与幂等，以及内嵌 MQTT Broker、SaaS 租户认证、Topic ACL、TLS、QoS/Retain、七类 V8.MQTT 事件、设备级接口引擎、服务端下行、IoT 数据分层和多节点部署验收。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi V8 消息队列与 MQTT

你正在开发 Microi 吾码平台的 V8 引擎代码，需要使用 RabbitMQ 消息队列或 MQTT 物联网协议。

## V8.MQ — RabbitMQ 消息队列

### 生产消息（后端）

```javascript
// 在 async 接口引擎或 V8 事件中发送消息。
// 业务重试必须复用同一个 EventId，供消费者幂等去重。
var result = await V8.MQ.SendMsg({
  QueueName: 'order_process',
  EventId: V8.Param.eventId || V8.Method.NewUlid(),
  Message: {
    ProductId: '123',
    Count: 2,
    OrderId: V8.Param.orderId
  }
});
if (result.Code !== 1) return result;
```

逻辑队列名由服务端规范为 `microi.{lowerOsClient}.{queueName}`。V8 上下文、登录 Token 与后台显式 `OsClient` 是权威租户，body 不能切换到其它租户队列。

### 生产消息（前端）

```javascript
V8.Post('/api/mq/sendmsg', {
  QueueName: 'queue_name',
  EventId: stableEventId,
  Message: { ProductId: '123', Count: 2 }
}, function(result) {
  if (result.Code === 1) V8.Tips('消息已发送', true);
}, null, {}, 'json');
```

### 消费消息

消费者是一个接口引擎，在 `diy_queue_receive` 表中配置队列名和接口引擎 Key 后，消息到达时自动调用。

```javascript
// 消费者接口引擎
var message = V8.Param.Message;   // object 类型
// message.EventId     — 稳定业务幂等 Id
// message.Id          — EventId 的兼容别名
// message.OsClient    — 消息所属租户
// message.Message     — 消息内容
// message.CurrentUserId — 生产消息的用户 Id

// 处理业务逻辑
var data = message.Message;
V8.FormEngine.UptFormData('Product', {
  Id: data.ProductId,
  Stock: data.Count
});
```

### 实战模式：异步处理耗时操作

```javascript
// 接口引擎：接收请求后发送到队列，快速返回
await V8.MQ.SendMsg({
  QueueName: 'order_process',
  EventId: V8.Param.eventId,
  Message: {
    orderId: V8.Param.orderId,
    action: 'create',
    userId: V8.CurrentUser.Id
  }
});

return { Code: 1, Msg: '订单处理中，请稍候查看结果' };
```

```javascript
// 消费者接口引擎：异步处理订单
var msg = V8.Param.Message;
var data = msg.Message;

try {
  // 耗时操作：调用第三方 ERP 接口
  var erpResult = V8.Http.Post({
    Url: 'https://erp.company.com/api/order',
    PostParamString: JSON.stringify({ orderId: data.orderId }),
    ParamType: 'json',
    Timeout: 30
  });

  V8.FormEngine.UptFormData('Order', {
    Id: data.orderId,
    SyncStatus: 'success',
    SyncTime: DateNow('yyyy-MM-dd HH:mm:ss')
  });
} catch (ex) {
  V8.FormEngine.UptFormData('Order', {
    Id: data.orderId,
    SyncStatus: 'failed',
    SyncError: ex.message
  });
  console.error('订单同步失败: ' + ex.message);
}
```

### MQ 配置

主租户提供共享 Broker 地址 `MQHost/MQPort`。每个子租户必须在 RabbitMQ 中真实创建独立的 `MQUserName/MQPassword/MQVitrualHost`，并把权限限制在自己的 vhost 与 `microi.{osClient}.*` 队列；缺少凭据或与其它租户共用 user/password/vhost 时失败关闭，不回退主租户管理员账号。

在 `diy_queue_receive` 表新增记录后，平台启动时自动订阅：

| 字段 | 含义 |
|------|------|
| `Type` | `接口引擎`（固定） |
| `QueueName` | 逻辑队列名（与生产端 `SendMsg({ QueueName, ... })` 一致） |
| `ApiEngineKey` | 消费者接口引擎 Key |
| `IsEnable` | 是否启用 |
| `OsClient` | 所属租户（多租户隔离） |

> ⚠️ 修改 `diy_queue_receive` 后需重启平台才会生效订阅。

多节点会对同一租户队列使用 RabbitMQ competing consumer，但“只有一个节点收到”不等于业务只执行一次。消息 envelope 的 `EventId` 是稳定幂等键，消费者必须配合数据库唯一约束、inbox/条件更新保证副作用仅一次；连接凭据轮换后当前版本需要重启节点重建连接。

---

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

## 注意事项

- MQ 消费者接口引擎通过 `V8.Param.Message` 获取消息，包含 `EventId`、兼容 `Id`、`OsClient`、`Message`、`CurrentUserId`
- MQ 适合异步解耦、削峰填谷、耗时操作异步化
- MQTT 七类事件在同一个接口引擎中处理，通过 `V8.EventName` 区分
- MQTT 适合 IoT 设备管理、实时数据采集
- 设备/告警/工单等业务事实优先进入关系库，高频遥测可进入 MongoDB，大附件进入对象存储
- RabbitMQ 租户凭据在 SaaS 引擎登记前必须先在真实 RabbitMQ 创建 user/vhost/权限；内嵌 MQTT Broker 直接校验 SaaS 中的 MQTT 凭据，使用外部 MQTT Broker 时另行完成真实 Broker 账号、ACL 与适配器配置
- `ConnectedClients` 只代表当前 MQTT 节点的诊断快照，不是集群全局在线事实
- 内嵌 MQTT Broker 不具备跨节点共享会话/订阅/retained 的集群一致性；多 API 节点生产部署应使用支持集群的外部 Broker，或把内嵌 Broker 固定到独立节点并由负载入口路由，不能让每个 API 节点各自充当一套独立 Broker
- MQTT 生产配置、安全语义、事件字段可用性和上线清单以 [MQTT 生产参考](references/mqtt-production.md) 为准
