---
name: v8-mq-mqtt
description: Microi V8 消息队列与 MQTT 指南。用于使用 V8.MQ.SendMsg、RabbitMQ 队列、MQTT 事件处理、主题、载荷、客户端 Id 和异步集成。
---

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

### MQTT 事件类型

MQTT 通过一个接口引擎处理所有事件，通过 `V8.EventName` 判断当前事件类型：

| V8.EventName | 说明 |
|---|---|
| `StartServer` | MQTT 服务启动 |
| `Connected` | 客户端连接 |
| `Disconnected` | 客户端断开连接 |
| `MessageReceived` | 收到客户端消息 |
| `StopServer` | MQTT 服务停止 |

### V8.MQTT 上下文

| 属性 | 说明 |
|---|---|
| `V8.MQTT.ClientId` | 客户端 Id |
| `V8.MQTT.Topic` | 消息主题 |
| `V8.MQTT.Payload` | 消息内容（在 MessageReceived 事件中） |

子租户必须 `MqttEnable=1` 并配置独立 `MqttAccount/MqttPwd`。子租户不能通过 `MqttAllowAnonymous=1` 或 `MqttTopicIsolation=0` 关闭边界；缺少完整凭据时拒绝连接。Topic 统一为 `tenant/{lowerOsClient}/{businessTopic}`，服务端 publish、subscribe、retained、ResponseTopic 都会校验并拒绝其它租户、系统 Topic 和共享订阅绕过。

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

} else if (eventName === 'MessageReceived') {
  // 处理设备上报的数据
  var clientId = V8.MQTT.ClientId;
  var topic = V8.MQTT.Topic;
  var payload = V8.MQTT.Payload;

  console.log('收到消息: ' + clientId + ' - ' + topic);

  // 存储到 MongoDB（适合海量数据）
  V8.MongoDb.AddFormData({
    DbName: 'iot_data',
    TableName: 'device_msg_' + DateNow('yyyy_MM'),
    _FormData: {
      DeviceId: clientId,
      Topic: topic,
      Payload: payload,
      CreateTime: DateNow('yyyy-MM-dd HH:mm:ss')
    }
  });

  // 解析特定主题的数据
  var temperatureTopic = 'tenant/' + V8.OsClient.toLowerCase() + '/sensor/temperature';
  if (topic === temperatureTopic) {
    var temp = parseFloat(payload);
    if (temp > 80) {
      // 温度报警
      V8.ApiEngine.Run('send-alarm', {
        deviceId: clientId,
        type: 'temperature',
        value: temp
      });
    }
  }

} else if (eventName === 'StopServer') {
  console.log('MQTT 服务已停止');
}
```

## 注意事项

- MQ 消费者接口引擎通过 `V8.Param.Message` 获取消息，包含 `EventId`、兼容 `Id`、`OsClient`、`Message`、`CurrentUserId`
- MQ 适合异步解耦、削峰填谷、耗时操作异步化
- MQTT 所有事件在同一个接口引擎中处理，通过 `V8.EventName` 区分
- MQTT 适合 IoT 设备管理、实时数据采集
- 海量 MQTT 数据建议存入 MongoDB 而非 MySQL
- MQ 和 MQTT 的租户凭据在 SaaS 引擎中管理，但必须先在真实 Broker 创建对应资源，不能只写数据库字段
- `ConnectedClients` 只代表当前 MQTT 节点的诊断快照，不是集群全局在线事实
- 内嵌 MQTT Broker 不具备跨节点共享会话/订阅/retained 的集群一致性；多 API 节点生产部署应使用支持集群的外部 Broker，或把内嵌 Broker 固定到独立节点并由负载入口路由，不能让每个 API 节点各自充当一套独立 Broker
