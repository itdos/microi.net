---
name: v8-mq-mqtt
description: Microi V8 消息队列与 MQTT 生产指南。用于 V8.MQ.SendMsg、RabbitMQ 消费与幂等，以及内嵌 MQTT Broker、SaaS 租户认证、Topic ACL、TLS、QoS/Retain、七类 V8.MQTT 事件、设备级接口引擎、服务端下行、IoT 数据分层和多节点部署验收。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 消息队列与 MQTT

你正在开发 Microi 吾码平台的 V8 引擎代码，需要使用 RabbitMQ 消息队列或 MQTT 物联网协议。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-mq-mqtt-000 sha256=a883bb502b306ada654b8f45bd6f955c84049f3a032568e5ef8e25e24aa1c2c6 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-mq-mqtt-001 sha256=1f51deb2673c77cdd3a096ca658dfe0f025531760f1aee04987f3bb2723131cf -->
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
<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-v8-mqtt-iot-物联网.md](references/progressive-01-v8-mqtt-iot-物联网.md)：V8.MQTT — IoT 物联网
<!-- microi-progressive:end -->
