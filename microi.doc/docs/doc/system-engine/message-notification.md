# 🔔 消息通知

> Microi 消息通知把业务策略、接收人、发送渠道、事件日志和平台通知中心统一起来。数据库日志是权威事实，SignalR 只负责低延迟提示。

---

## 能力范围

| 通知方式 | 配置/执行 | 说明 |
|---|---|---|
| 微信公众号模板消息 | `wx_mp` + `wx_tpl_msg` + `wechat_send_tpl_msg` | 发送主体是公众号或服务号，接收人需要对应 OpenId |
| 短信 | `mic_msgset.ChannelApiEngineMap` 指定适配器 | 适配器读取用户手机号并按 `EventId` 幂等 |
| 邮件 | `mic_email_server` 或自定义适配器 | 适配器读取邮箱，返回结果写入事件日志 |
| 平台内部 | `V8.Notification.Send` + SignalR | 通知先持久化，在线用户即时收到；离线后仍可在通知中心回读 |

“公众号/服务号”和“小程序”不是同一种配置：

- `wx_mp` 保存公众号或服务号发送凭据，`wx_tpl_msg.WxMpId` 指定谁来发送模板消息；
- `wx_mini_program` 保存小程序配置，模板中的 `MiniProgramAppId/MiniProgramPagePath` 只是点击消息后的可选跳转目标；
- 不能使用小程序 AppId 调用公众号模板消息发送接口，也不能因为配置了小程序跳转就省略公众号/服务号发送主体。

## 整体链路

```text
业务 V8 / 表单事件
        │  MsgKey + EventId + 接收人 + 内容
        ▼
    msg_event
        ├─ 读取 mic_msgset 策略
        ├─ 合并固定用户、角色用户和本次参数用户
        ├─ 按“EventId + 渠道 + 接收人”写 mic_msg_event_log
        └─ 只分发本次成功 claim 的记录
             ├─ 公众号/服务号模板消息
             ├─ 短信/邮件适配器
             └─ V8.Notification.Send
                      │ 事务提交后
                      ▼
              SignalR 实时提示

通知中心打开、重连或提示到达后：msg_internal_list 回读权威快照
```

平台内部通知即使没有在线连接、SignalR 短暂失败或节点重启，持久日志仍然存在。客户端不能把“收到实时事件”当作业务已经完成的唯一依据。

## 数据表

### `mic_msgset`：通知策略

| 字段 | 说明 |
|---|---|
| `Key` | 业务稳定 Key，租户内唯一，例如 `order_wait_approve` |
| `Title` | 配置名称，也是未覆盖时的默认通知标题 |
| `IsEnable` | 通知总开关 |
| `Type` | 多选：`微信公众号模板消息`、`短信`、`邮件`、`平台内部` |
| `Receivers` | 固定接收用户 JSON |
| `ReceiversRoles` | 固定接收角色 JSON；发送时解析为用户并去重 |
| `WxTplMsgId` | 微信公众号/服务号模板配置 Id |
| `ChannelApiEngineMap` | 短信、邮件和自定义渠道到适配器接口引擎 Key 的 JSON 映射 |

`ChannelApiEngineMap` 示例：

```json
{
  "短信": "notification_sms_send",
  "邮件": "notification_email_send"
}
```

### `wx_tpl_msg`：公众号/服务号模板

`WxMpId/WxMpName` 关联发送主体；`TemplateId` 是微信模板 Id；`Content` 是模板内容；`LinkUrl` 是普通链接。若点击后需要进入小程序，再配置 `MiniProgramId/MiniProgramName/MiniProgramAppId/MiniProgramPagePath`。

模板 Key 在租户内唯一。应用商城包不能携带真实公众号 Token、AppSecret、OpenId 或其它租户密钥。

### `mic_msg_event_log`：事件事实

每个接收人、每个渠道保存一条记录，主要字段如下：

| 字段 | 说明 |
|---|---|
| `EventId` | 调用方提供的稳定幂等键；同一次业务重试保持不变 |
| `MsgEventId` | 关联的消息设置 Id |
| `ChannelType` | 本条记录所属渠道 |
| `ReceiverUserId` | 单个接收用户 Id |
| `Title/MsgContent` | 发送时的展示快照 |
| `LinkUrl/Payload` | 安全跳转地址和扩展数据快照 |
| `IsRead/ReadTime` | 平台内部通知的已读状态 |
| `IsSuccess/MsgResult` | 渠道执行结果；结果必须脱敏 |

租户独立业务库使用唯一索引 `EventId + ChannelType + ReceiverUserId`；如果多个租户共表，唯一索引必须再包含 `OsClient`。常用未读查询索引为 `ReceiverUserId + ChannelType + IsRead + CreateTime`。

## 后端 V8 发送

业务接口引擎、表单后端事件和工作流事件优先调用统一的 `msg_event`，不要分别拼接微信、短信、邮件和聊天 HTTP 请求：

```js
var notifyResult = V8.ApiEngine.Run('msg_event', {
  MsgKey: 'order_wait_approve',
  EventId: 'order-wait-approve-' + V8.Param.OrderId,
  ReceiverUserIds: [V8.Param.ApproverId],
  Title: '订单待审批',
  Content: '订单 ' + V8.Param.OrderNo + ' 等待您审批',
  LinkUrl: '/#/orders/detail?id=' + V8.Param.OrderId,
  Payload: {
    BusinessType: 'Order',
    BusinessId: V8.Param.OrderId
  }
}, V8.DbTrans);

if (!notifyResult || notifyResult.Code !== 1) {
  return { Code: 0, Msg: notifyResult ? notifyResult.Msg : '通知调用失败' };
}
return { Code: 1, Data: notifyResult.Data };
```

接收人由配置中的固定用户、固定角色和本次 `ReceiverUserId/ReceiverUserIds` 合并，服务端去重并限制单次扇出。不要传入任意租户或相信客户端指定的用户上下文。

### `EventId` 与重试

`EventId` 必须来自业务稳定键，例如订单 Id + 状态版本，而不是每次重试重新生成 GUID。数据库唯一索引完成原子 claim；“先查询、再新增”无法防住两个 API 节点同时执行。

外部短信、邮件或微信供应商可能出现“已经发送，但响应丢失”。若供应商支持幂等键，适配器必须向它传递 `EventId`；不支持时只能做到可审计的至少一次/人工确认，不能宣称恰好一次。

### 渠道适配器契约

`ChannelApiEngineMap` 指定的接口引擎接收统一参数：

```js
{
  EventId: 'order-wait-approve-123-v2',
  ChannelType: '短信',
  User: {
    Id: 'user-id',
    Phone: '13800000000',
    Email: 'user@example.com',
    WxOpenId: 'openid'
  },
  Title: '订单待审批',
  Content: '订单 SO-001 等待您审批',
  LinkUrl: '/#/orders/detail?id=123',
  Payload: { BusinessId: '123' }
}
```

适配器应校验目标字段、设置超时、按 `EventId` 幂等，并只返回脱敏后的渠道结果。密钥保存在渠道配置或租户安全配置，不写进映射 JSON、Payload、日志或应用包。

## `V8.Notification.Send`

这是后端 V8 的平台内部实时提示原语。正常业务由 `msg_event` 在事件日志 claim 成功后调用；直接调用它不会替你创建 `mic_msg_event_log`：

```js
var push = V8.Notification.Send({
  NotificationId: 'event-123-user-1',
  EventId: 'event-123',
  ReceiverUserIds: ['user-1'],
  Title: '待办提醒',
  Content: '您有一条新的待办',
  LinkUrl: '/#/todo/123',
  Payload: { TodoId: '123' }
});
```

限制：接收人最多 200 个；标题最多 200 字符；正文与序列化 Payload 各最多 32 KiB；链接最多 500 字符，只允许站内路径、锚点或 HTTP/HTTPS。宿主绑定当前 `OsClient`，不能跨租户推送。

存在 `V8.DbTrans` 时，SignalR 推送在事务成功提交后执行最多 1.8 秒的有界等待；此时数据库事务已经释放，回滚不推送。实时发送超时或没有在线连接不应回滚已提交的通知事实。

## 前端 V8

PC 前端把通知能力挂载为 `V8.Notification`：

```js
// 发送：调用统一 msg_event
await V8.Notification.Send('order_wait_approve', {
  EventId: 'order-wait-approve-' + V8.Form.Id,
  ReceiverUserIds: [V8.Form.ApproverId],
  Content: '订单等待审批'
});

// 当前用户列表和未读数
var listResult = await V8.Notification.List({
  PageIndex: 1,
  PageSize: 20
});

// 标记本人一条通知或全部通知已读
await V8.Notification.MarkRead(listResult.Data[0].Id);
await V8.Notification.MarkRead({ All: true });
```

`msg_internal_list` 和 `msg_internal_mark_read` 都以服务端 `V8.CurrentUser.Id` 过滤；即使客户端伪造 `ReceiverUserId`，也不能读取或修改他人的通知。

前端固定监听 SignalR 事件 `ReceivePlatformNotification`。收到事件后按 `Id/EventId` 去重并刷新通知中心；页面打开、重连和启动时也主动调用列表接口，因此实时链路只是加速器。

旧的 `V8.SendSystemMessage` 仍用于聊天系统兼容消息。新业务通知使用 `V8.Notification`，才能获得策略、多渠道、事件日志、幂等和通知中心已读状态。

## 配置步骤

1. 在“微信公众号配置”中新增公众号或服务号，并妥善保存凭据。
2. 如需跳转小程序，在“小程序配置”中新增小程序；它不替代第 1 步。
3. 在“公众号模板消息”中设置唯一 Key、`WxMpId`、模板 Id 和内容，按需设置普通链接或小程序跳转。
4. 在“消息通知设置”中设置唯一 Key、启用状态、通知方式、固定用户/角色和模板；短信/邮件配置适配器映射。
5. 业务代码以稳定 `EventId` 调用 `msg_event`。
6. 从事件日志核对每个接收人/渠道的 claim 与结果，再在通知中心验证在线提示、离线回读和已读。

## 分布式与升级

- 所有 API 节点共享业务数据库、Redis 和 SignalR backplane；进程内字典不能保存全局通知状态。
- 数据库日志是事实源，SignalR 事件允许丢失和重复；客户端必须去重并回读。
- 新旧版本滚动共存时，按“先增加字段/索引 → 发布兼容接口 → 发布前端 → 最后清理旧结构”的顺序升级。
- 可靠补偿任务需要带租约的分布式锁，但锁不能代替事件唯一约束和渠道幂等。
- 若要求宿主机强杀窗口绝对零丢失，必须在业务成功响应前取得共享 outbox/MQ/WAL 的持久化确认。

## 安全边界

- 三个通知接口都应禁止匿名调用；列表和已读操作只使用当前登录用户。
- 链接必须拒绝 `javascript:`、`data:`、协议相对 URL 等危险地址；渲染正文时不直接执行 HTML。
- 日志和返回值不记录 Token、AppSecret、验证码、完整供应商响应或其它秘密。
- 接收人扇出、正文和 Payload 都要设上限，避免单次 V8 调用拖垮节点。
- 应用商城包只发布结构、菜单、接口和无敏感默认配置，不发布真实渠道数据和历史事件。

## 验收清单

- 两个租户的三张表字段、通知方式数据源和物理索引已回读一致。
- 同一个 `EventId` 重复调用和两个 API 节点并发调用，只产生一次接收人/渠道副作用。
- 在线用户即时收到；离线用户、断网重连和 SignalR 故障后仍能从列表恢复。
- 事务回滚不推送；提交后节点退出，持久日志仍可审计。
- 用户不能读取或标记他人的通知；危险链接和超限参数被拒绝。
- 公众号/服务号发送主体与小程序跳转分别验证。
- 源码测试、后端编译、远端回读、真实浏览器和商城安装/校验分别记录，不用本地成功冒充生产部署。

相关 API 见[后端 V8](../v8-engine/v8-server)与[前端 V8](../v8-engine/v8-client)，可靠后台补偿见[任务调度](./job)。
