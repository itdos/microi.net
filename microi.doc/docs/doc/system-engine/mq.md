# 📨 MQ 消息队列（RabbitMQ）

Microi.MQ 是吾码基于 RabbitMQ 的租户级可靠异步通道。生产端可以从后端 V8、
平台接口或 C# 发布消息；消费端根据 `diy_queue_receive` 配置，把消息交给接口引擎
或受控 .NET 处理器，并在业务成功后手动 Ack。

<div class="mci-doc-grid">
  <article class="mci-doc-card">
    <span class="mci-doc-chip">Durable</span>
    <h3>持久队列与消息</h3>
    <p>队列声明为 durable，消息标记为 persistent，发布通过 RabbitMQ 事务提交。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">SaaS</span>
    <h3>租户连接与队列隔离</h3>
    <p>每个租户使用专用账号、密码和 vhost，逻辑队列自动加入租户物理前缀。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">V8</span>
    <h3>接口引擎直接消费</h3>
    <p>消息自动进入指定 ApiEngineKey，返回 Code=1 后 Ack，无需编写常驻 Worker。</p>
  </article>
  <article class="mci-doc-card">
    <span class="mci-doc-chip">Trace</span>
    <h3>事件与调用链可追踪</h3>
    <p>EventId、MessageId、OsClient 和 W3C Trace 上下文贯穿发送、消费与日志。</p>
  </article>
</div>

## MQ 与 MQTT 怎么选

| 能力 | MQ 消息队列 | MQTT 引擎 |
| --- | --- | --- |
| 底层协议 | RabbitMQ / AMQP | MQTT |
| 典型对象 | 后端服务、接口引擎、异步任务 | IoT 设备、网关、实时遥测 |
| 消费模型 | Queue + competing consumers | Topic 发布/订阅 |
| 主要入口 | `V8.MQ.SendMsg`、`diy_queue_receive` | `V8.EventName`、`V8.MQTT` |
| 当前文档 | 本页 | [MQTT 引擎（IoT 物联网）](./mqtt-engine) |

MQ 适合业务异步解耦、削峰、外部系统同步、通知分发和耗时处理。设备连接、Topic
ACL、QoS、Retain 与服务端下行属于 MQTT，不应混在 RabbitMQ 队列配置中。

## 一条消息如何穿过吾码

```text
后端 V8 / 管理端 HTTP / C# 服务
                │
                │ QueueName + EventId + Message
                ▼
      租户解析与逻辑队列规范化
                │
                ▼
  microi.<lowerOsClient>.<logicalQueue>
                │
       durable queue + persistent message
                │
                ▼
       RabbitMQ competing consumers
                │  prefetch=1 / manual Ack
                ▼
       diy_queue_receive 路由配置
          ├─ Type=1：接口引擎
          └─ Type=2：主租户受控 DLL
                │
                ▼
     Code=1 → Ack；失败 → Reject/有限重入队
                │
                ▼
        diy_queue_receive_log + 系统日志 + Trace
```

## 源码组成

| 源码 | 职责 |
| --- | --- |
| `MicroiMQExtension` | `AddMicroiMQ` 注入、`UseMicroiMQ` 启动消费者 |
| `TenantRabbitMQConnectionBase` | 按租户和 publisher/consumer 角色缓存连接 |
| `MicroiRabbitMQSingleConnection` | 当前默认连接实现，支持单地址或多端点列表 |
| `MicroiRabbitMQClusterConnection` | 保留的多端点连接实现 |
| `MicroiRabbitMQPublish` | 队列规范化、消息信封、事务发布和发送日志 |
| `MicroiRabbitMQConsumer` | 多租户配置同步、消费、校验、Ack/Reject 和重试 |
| `MicroiMQMessageModel` | `EventId/Id/OsClient/Trace/Message/CurrentUserId` 信封 |
| `platform-mq`、`V8EngineMQ` | 应用商城 Managed 管理接口与后端 V8 发送原子能力 |

启动时先注入插件，再在应用构建完成后启动消费者：

```csharp
builder.Services.AddMicroiMQ();

var app = builder.Build();
app.UseMicroiMQ();
```

`UseMicroiMQ()` 会启动后台配置同步，并在停止时取消同步任务、释放消费通道；
RabbitMQ 连接启用了自动恢复和拓扑恢复。

## RabbitMQ 部署

### Docker Compose 开发示例

下面只创建 Broker 管理账号。生产租户运行账号必须在 Broker 中另行创建，不能把
管理账号直接填入每个租户的 SaaS 配置。

::: details 展开查看 Docker Compose

```yaml
services:
  rabbitmq:
    image: rabbitmq:management-alpine
    container_name: microi-rabbitmq
    restart: unless-stopped
    ports:
      - "1672:5672"   # AMQP
      - "1673:15672" # Web 管理面板
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_ADMIN_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_ADMIN_PASSWORD}
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - /volume1/docker/rabbitmq/lib:/var/lib/rabbitmq
      - /volume1/docker/rabbitmq/log:/var/log/rabbitmq
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "10"
```

:::

管理面板示例地址为 `http://<BrokerHost>:1673`，Microi 的 AMQP 端口则填写
`1672`。生产环境还要配置持久卷备份、健康检查、资源上限、TLS、监控和 Broker
高可用；仅看到容器运行不等于消息可靠性已经验收。

### 每个租户必须先创建真实 Broker 资源

共享 Host/Port 可以由多个租户复用，但每个租户必须在 RabbitMQ 中真实创建：

1. 独立 user；
2. 独立随机 password；
3. 独立 vhost；
4. 只允许该 user 访问该 vhost 和 `microi.<lowerOsClient>.*` 的 ACL。

Microi 会检查当前加载的租户配置。任意两个租户共用 `MQUserName`、`MQPassword`
或 `MQVitrualHost` 时会失败关闭；字段缺失也不会回退主租户管理员账号。

::: danger 不要把 Broker 管理员作为租户运行账号
应用侧的租户隔离不能替代 RabbitMQ 自身的 user/vhost/permission。即使物理队列名
带租户前缀，共用管理员账号仍然可以绕过应用访问其它队列。
:::

## SaaS 引擎 MQ 配置

在 **系统引擎 → SaaS 引擎 → MQ 消息队列配置** 中维护：

| 字段 | 作用 | 当前源码语义 |
| --- | --- | --- |
| `MQHost` | Broker 地址 | 支持逗号分隔多个 Host |
| `MQPort` | AMQP 端口 | 必须为 1–65535 |
| `MQUserName` | 租户 user | 必填，且不能与其它租户重复 |
| `MQPassword` | 租户密码 | 必填，且不能与其它租户重复 |
| `MQVitrualHost` | 租户 vhost | 字段名保留历史拼写；必填且不能重复 |
| `MQUseTls` | 启用 TLS | 支持 `1/true/yes` |
| `MQTlsServerName` | TLS Server Name | 未填时使用第一个 MQHost |
| `MQListenerTime` | 消费配置同步间隔 | 默认最多 180 秒；正数配置可缩短，最低 15 秒 |
| `MQType` | 历史连接类型字段 | 当前默认注入不依赖该值切换实现 |

当前 `AddMicroiMQ()` 默认注册 `MicroiRabbitMQSingleConnection`。当 `MQHost` 只有
一个地址时直接连接；有多个地址时仍会把端点列表交给 RabbitMQ.Client。源码中的
`MicroiRabbitMQClusterConnection` 已保留，但当前 DI 分支没有按 `MQType` 自动切换。

变更 Host、端口、凭据、vhost 或 TLS 后，当前已打开的租户连接不会主动按配置
指纹重建，应滚动重启对应 Microi 节点。只修改队列与处理器配置时不需要重启，
后台同步会在下一周期应用。

完整租户基础设施边界见 [SaaS 引擎](./saas-engine#mq消息队列配置)。

## 创建消费队列

在 `diy_queue_receive` 新增记录。平台会周期读取所有已加载租户，新增消费者、更新
处理配置，并关闭数据库中已删除或改名的旧消费者。

| 字段 | 说明 |
| --- | --- |
| `QueueName` | 逻辑队列名，例如 `order_process` |
| `Type` | `1`=接口引擎，`2`=定制 DLL |
| `ApiEngineKey` | Type=1 时必填，消息到达后执行的接口引擎 Key |
| `FailToReject` | 值为“是”时失败后允许有限重入队；否则直接 Reject 且不重入队 |
| `Count` | 最大重入队次数；`0` 表示第一次失败就删除消息 |
| `DllName/ClassName/MethodName` | Type=2 的程序集路径、类型和方法 |

逻辑队列名只能包含字母、数字、点、下划线和中划线，长度 1–200，并且首字符
必须是字母或数字。服务端会转换为：

```text
逻辑队列：order_process
租户：Factory_A
物理队列：microi.factory_a.order_process
```

如果传入已带当前租户物理前缀的名称，服务端会先去掉前缀再规范化；传入其它
租户的 `microi.*` 队列会被拒绝。

### 接口引擎与 DLL 处理器边界

Type=1 是推荐方式，所有租户均可使用。Type=2 只允许默认主租户：DLL 必须位于
应用根目录内、扩展名必须为 `.dll`，方法接收消息业务体并返回可转换为 `bool` 的
结果。子租户的动态 DLL 配置会被拒绝，避免租户通过路径或反射加载任意代码。

低代码业务优先使用接口引擎；只有平台确实缺少可复用原子能力时才新增可信 C#。

## 生产消息

### 后端 V8

```javascript
var orderId = String(V8.Param.OrderId || '');
var orderVersion = String(V8.Param.OrderVersion || '1');
if (!orderId) return { Code: 0, Msg: '缺少 OrderId' };

// 业务重试必须复用同一个 EventId，不能每次重新生成。
var eventId = 'order-sync:' + orderId + ':v' + orderVersion;
var sendResult = V8.MQ.SendMsg({
  QueueName: 'order_process',
  EventId: eventId,
  Message: {
    OrderId: orderId,
    Action: 'sync',
    RequestedBy: V8.CurrentUser.Id
  }
});

if (!sendResult || sendResult.Code !== 1) {
  return sendResult || { Code: 0, Msg: 'MQ 发送无返回' };
}
return { Code: 1, Data: { EventId: eventId }, Msg: '订单已进入异步队列' };
```

`V8EngineMQ.SendMsg` 当前是同步包装：它等待 RabbitMQ 发布任务结束后返回
`DosResult`。接口引擎不需要把它当作脱离请求的后台线程；真正的异步工作由
RabbitMQ 消费端完成。

### 管理端 HTTP

```javascript
V8.ApiEngine.Run('platform-mq', {
  Action: 'Send',
  QueueName: 'order_process',
  EventId: stableEventId,
  Message: {
    OrderId: orderId,
    Action: 'sync'
  }
}).then(function (result) {
  V8.Tips(result.Code === 1 ? '消息已发送' : result.Msg, result.Code === 1);
});
```

`platform-mq` 由 SaaS 引擎官方应用以 Managed 资源交付，只允许当前租户超级管理员；
可信原子层会固定租户、校验队列名，并限制单条消息最大 1 MB。普通业务前端应调用
自己的受权接口引擎，再由后端接口引擎执行 `V8.MQ.SendMsg`；不能直接把平台级
MQ 发送能力开放给任意用户。

HTTP Token 和 V8 运行上下文是权威租户。Body 中伪造其它 `OsClient` 会被拒绝；
没有 Token/V8 上下文的可信后台调用必须显式传入租户，不能回退主租户。

### C# 平台调用

```csharp
var result = await MicroiEngine.MQ.SendMsg(new MicroiMQSendInfo
{
    OsClient = osClient,
    QueueName = "order_process",
    EventId = eventId,
    Message = payload,
    CurrentToken = currentToken
});
```

## 消息信封与发布确认

生产者会把业务体包装为：

| 字段 | 说明 |
| --- | --- |
| `EventId` | 稳定业务幂等 Id；为空时服务端生成 ULID |
| `Id` | 兼容旧消费者，值与 EventId 相同 |
| `OsClient` | 服务端确认的消息租户 |
| `TraceParent/TraceState` | 当前可信 W3C 调用链上下文 |
| `Message` | 原始业务消息对象 |
| `CurrentUserId` | 生产消息的当前用户 Id，不发送完整 Token |

自定义 `EventId` 最长 128 字符且不能包含控制字符。RabbitMQ 属性同时写入：

- `Persistent = true`；
- `ContentType = application/json`；
- `Type = microi.tenant-message.v1`；
- `MessageId = EventId`；
- `traceparent/tracestate` Header。

发布前会声明 durable、非独占、非自动删除队列，再执行 `TxSelect →
BasicPublish(mandatory=true) → TxCommit`。只有事务提交完成才返回 `Code=1`。

::: warning RabbitMQ 提交不等于业务恰好一次
Broker 已接受消息后，HTTP 响应仍可能丢失；连接也可能在业务处理成功、Ack 到达
Broker 之前中断。生产重试必须复用同一个 EventId，消费端必须幂等。RabbitMQ
事务也不能与业务数据库事务自动组成同一个原子事务，需要 outbox 时应显式设计。
:::

## 消费消息

接口引擎通过 `V8.Param.Message` 得到完整信封，并可从 `V8.Param.EventId` 直接取得
稳定 Id：

```javascript
var envelope = V8.Param.Message || {};
var eventId = String(V8.Param.EventId || envelope.EventId || envelope.Id || '');
if (!eventId) return { Code: 0, Msg: '消息缺少 EventId' };

var data = envelope.Message || {};
if (!data.OrderId) return { Code: 0, Msg: '消息缺少 OrderId' };

// 在真实业务中，先用“消费者Key + EventId”唯一约束或 inbox 原子 claim。
// 重复事件应返回 Code=1，让 RabbitMQ Ack，而不是再次执行副作用。
var result = V8.FormEngine.UptFormData('Order', {
  Id: data.OrderId,
  SyncStatus: 'success',
  SyncTime: DateNow('yyyy-MM-dd HH:mm:ss')
});

return result && result.Code === 1
  ? { Code: 1, Data: { EventId: eventId } }
  : { Code: 0, Msg: (result && result.Msg) || '订单更新失败' };
```

上例只展示消息结构和返回约定，不构成完整幂等实现。库存、资金、积分、流水、
第三方同步等副作用必须建立 inbox/唯一索引、条件状态迁移或供应商幂等键。

### Ack、Reject 与返回值

| 处理结果 | RabbitMQ 动作 |
| --- | --- |
| 接口引擎返回可解析的 `DosResult` 且 `Code=1` | `BasicAck` |
| 接口引擎返回 `null` 或非 `DosResult` | 兼容旧约定，视为成功并 Ack |
| `Code!=1` 且 `FailToReject` 不是“是” | Reject，`requeue=false`，消息删除 |
| `Code!=1` 且允许重试、未达到 `Count` | Reject，`requeue=true`，重新入队 |
| 达到 `Count` | 清理重试状态并 Reject，消息删除 |
| 信封非法或跨租户 | 直接 Reject，不重入队 |

为了让语义明确，消费者接口引擎应始终返回标准 `DosResult`，不要依赖“无法解析
也算成功”的历史兼容行为。

每个消费通道设置 `prefetchCount=1`、`autoAck=false`。失败重试次数保存在当前租户
Redis：`Microi:{OsClient}:MQ:Retry:{EventId}`，TTL 为 7 天；成功 Ack 后尽力删除。

::: warning 当前重试没有延迟队列或内置 DLQ
`requeue=true` 会立即重新入队，源码没有指数退避、延迟交换器或死信队列。请设置
较小的 `Count`，让永久错误尽快进入可审计失败；需要延迟重试/DLQ 时应在 RabbitMQ
拓扑或专用补偿任务中显式实现，不能把“最终删除”描述为已进入死信队列。
:::

## 消费前安全校验

消费者在调用业务处理器前会检查：

1. 信封能够反序列化；
2. `OsClient` 与监听队列租户一致；
3. 至少存在 `EventId` 或兼容 `Id`；
4. 同时存在 `EventId/Id` 时两者完全一致；
5. RabbitMQ `MessageId` 与稳定 EventId 一致；
6. W3C `traceparent` 合法，Header 与信封一致。

失败消息不会进入业务接口引擎，并记录租户、队列和拒绝原因。业务 Payload 中的
`OsClient` 不是权威身份，处理器只应使用已经校验的信封和 V8 当前租户。

## 多节点、配置同步与优雅停机

每个 Microi API 节点都会为同一租户队列注册消费者。RabbitMQ 使用 competing
consumer 分发消息，因此一条投递通常只到一个节点；但这不等于副作用只执行一次。
节点在 Ack 前中断时，未确认消息会重新投递。

后台同步默认每 180 秒扫描一次全部已加载租户。`MQListenerTime` 的当前实现取所有
正数配置与 180 秒之间的最小值，并限制最低 15 秒，因此它只能缩短全节点同步间隔，
不能把间隔提高到 180 秒以上。

同步行为包括：

- 新增队列时创建通道并订阅；
- 修改 `ApiEngineKey/FailToReject/Count` 等处理配置时更新运行对象；
- 删除或改名后关闭旧的数据库托管通道；
- 单个租户配置/数据库失败不会阻断其它租户；重复失败日志会被节流。

停机时消费者先取消后台同步，再释放全部通道。连接由 DI 容器异步释放；生产发布
仍应给节点有限的排空时间，避免尚未 Ack 的消息在滚动升级中产生无谓重投。

`IMicroiMQ.ReceiveMsgAsync` 是低层临时通道入口，当前实现收到消息后直接 Ack，
不调用业务处理器。正常业务不要使用它代替 `diy_queue_receive`；
`CloseChannelAsync(osClient, queueName)` 也必须同时指定租户，防止误关其它租户通道。

## 日志与可观测性

发送和接收记录写入 `diy_queue_receive_log`：

- 发送：物理队列、业务消息、发送时间、状态、错误和 MessageId；
- 接收：物理队列、业务消息、接收/完成时间、状态、错误和 MessageId。

日志写入失败不会反过来改变已完成的 Broker 动作，相关异常会进入 RabbitMQ 系统
日志。发送与消费还创建 `Microi.MQ.Publish`、`Microi.MQ.Consume <queue>` Activity，
可以用 EventId/MessageId 和 Trace 定位跨节点链路。

审计日志不等于 inbox。即使日志中已经存在同一 EventId，业务消费者仍需用数据库
唯一约束或原子状态迁移完成并发去重。

## 可靠性设计

| 风险窗口 | 推荐处理 |
| --- | --- |
| 数据库提交成功、MQ 发布失败 | 同事务写 outbox，由可靠 Worker 重试发布 |
| MQ 发布成功、响应丢失 | 生产者复用同一 EventId 重试 |
| 业务完成、Ack 前连接中断 | 消费者按 EventId 幂等，重复消息返回成功 |
| 第三方接口结果未知 | 用供应商幂等号查询，不盲目重发 |
| 永久错误或毒消息 | 有限重试后进入显式 DLQ/人工补偿，不无限热循环 |
| 多节点滚动升级 | 信封和处理器保持向前/向后兼容，先扩展后收缩 |

durable queue、persistent message 和事务提交仍依赖 RabbitMQ 自身的持久化、复制
与磁盘策略。要求 Broker 节点故障或宿主机掉电窗口零丢失时，还必须验收 RabbitMQ
集群/Quorum Queue、磁盘确认和恢复流程；Microi 源码中的标志位不能替代 Broker
级高可用配置。

## 常见问题

| 现象 | 优先检查 |
| --- | --- |
| 发送返回“配置不存在/缺字段” | 当前租户是否有完整 Host、Port、user、password、vhost |
| 子租户被拒绝连接 | 是否与其它租户共用了 user、password 或 vhost |
| 看到逻辑队列却收不到消息 | RabbitMQ 中实际名称是否为 `microi.<tenant>.<queue>` |
| 修改消费者后暂未生效 | 等待下一同步周期，检查 `MQListenerTime` 与系统日志 |
| 修改密码后仍使用旧连接 | 滚动重启 Microi 节点，让租户连接重新创建 |
| 消息不断快速重试 | `FailToReject=是` 且处理器持续失败；当前没有退避/DLQ |
| 多节点偶尔重复执行 | Ack 前断线或客户端重发；检查 EventId 与 inbox 唯一约束 |
| 接口引擎返回错误但消息被 Ack | 是否返回了非 DosResult；始终显式返回 `{Code:0/1}` |
| 日志有发送成功但业务未完成 | 发送成功只证明 Broker 提交，不证明消费者副作用成功 |

## 最低验收清单

- 每个租户使用真实独立 RabbitMQ user/vhost/ACL，交叉凭据与跨租户队列均被拒绝；
- 发送后核对物理队列、persistent 属性、EventId/MessageId 和事务提交结果；
- 两个 API 节点共同消费，重复投递时业务副作用仍只有一次；
- 接口引擎 `Code=1/0`、异常、非法信封、`FailToReject` 和最大重试均符合表格语义；
- 新增、修改、删除 `diy_queue_receive` 后在同步周期内生效；
- 节点在处理后、Ack 前退出时，消息能够重投并由幂等逻辑安全吸收；
- 凭据轮换通过滚动重启重建连接，停机释放通道且没有永久卡住的消费者；
- 发送/接收日志、系统日志和 Trace 能通过同一 EventId 对齐。

完整 V8 生产规范见 `microi.skills/v8-mq-mqtt/SKILL.md`。
