# 🔔 消息通知

> 在“系统引擎 → 消息通知”统一管理系统公告、业务通知和投递记录。原有邮件、短信、微信公众号模板消息和平台内部通知继续使用原数据与接口；公告增加跨租户、产品版本及重启后提醒。数据库保存投递事实，SignalR 加快提醒到达。

---

## 能力范围

| 通知方式 | 配置/执行 | 说明 |
|---|---|---|
| 微信公众号模板消息 | `wx_mp` + `wx_tpl_msg` + `wechat_send_tpl_msg` | 发送主体是公众号或服务号，接收人需要对应 OpenId |
| 短信 | `mic_msgset.ChannelApiEngineMap` 指定适配器 | 适配器读取用户手机号并按 `EventId` 幂等 |
| 邮件 | `mic_email_server` 或自定义适配器 | 适配器读取邮箱，返回结果写入事件日志 |
| 平台内部 | `V8.Notification.Send` + SignalR | 通知先持久化，在线用户即时收到；离线后仍可在通知中心回读 |
| 系统公告 | 消息通知微服务 + `platform-reminder-runtime` | 面向本租户用户、子租户或官方产品版本的居中弹窗，支持试用到期、公告、定时与撤回 |

“公众号/服务号”和“小程序”不是同一种配置：

- `wx_mp` 保存公众号或服务号发送凭据，`wx_tpl_msg.WxMpId` 指定谁来发送模板消息；
- `wx_mini_program` 保存小程序配置，模板中的 `MiniProgramAppId/MiniProgramPagePath` 只是点击消息后的可选跳转目标；
- 不能使用小程序 AppId 调用公众号模板消息发送接口，也不能因为配置了小程序跳转就省略公众号/服务号发送主体。

## 一个入口，两种配置方式

若同时安装了“系统日志/监控”，请一并更新到 v7.2.2 或后续版本。该应用与消息通知、SaaS、商城共用平台内置微服务；旧监控包携带的历史运行页面可能在安装时覆盖新页面。新版四个应用统一交付运行资源，批量更新后仍保留消息通知入口及原有业务配置。

应用商城只需安装“消息通知”应用。管理页提供三个区域：

| 区域 | 适合什么场景 | 操作与数据 |
|---|---|---|
| 系统公告 | 维护公告、试用到期、定时弹窗、版本说明 | 编辑内容、接收对象、时间计划，预览后发布；发布快照和回执独立保存 |
| 业务通知 | 审批待办、订单变化、邮件/短信/微信/平台内部消息 | 维护通知 Key、通道、固定用户/角色、模板和适配器；业务代码调用 `msg_event` 发送 |
| 投递记录 | 核对某条业务通知的渠道结果与已读状态 | 按标题、渠道分页查询原 `mic_msg_event_log` |

原“消息通知设置”入口并入“业务通知”。原 `mic_msgset` 物理表、稳定 Key、接收人、模板引用和历史日志继续保留，安装或升级不会清空配置。SaaS 引擎没有公告按钮、提醒 Tab 或嵌入表单。

业务通知保存不发送消息，“检查配置”只验证引用和必填项。多人同时编辑时通过 `ConfigRevision` 校验，后提交的人需要刷新再编辑。失效配置仍可停用，再次启用时重新检查接收人、模板和适配器。

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

## 平台提醒：公告、试用到期与定时弹窗

平台管理员统一在“系统引擎 → 消息通知 → 系统公告”新增和维护提醒，使用 `microi-platform-service` 的独立管理页面。在这里选择单个、多个或全部子租户、本租户用户，以及官方可用的产品版本范围。SaaS 引擎不再放置提醒按钮、提醒 Tab 或嵌入组件。

### 接收范围与配置

| 接收范围 | 可操作身份 | 接收对象 |
|---|---|---|
| 本租户用户 | 当前租户平台管理员 | 指定用户或当前租户全部用户 |
| 子租户 | 主租户平台管理员 | 当前部署环境和网络下启用的指定、批量或全部子租户，再选择收到公告的帐号范围 |
| 官方产品版本 | 后端现有 License 发放能力判定的官方服务管理员 | 明确勾选开源版、个人版、企业版；默认不向全部版本发布 |

每个范围都可以选择“所有系统帐号”或“仅超级管理员”。面向子租户和产品版本时，默认选择“仅超级管理员”；由接收服务器从当前 DiyToken、有效用户和本地角色重新核验。发布方不能读取其它服务器的角色列表，也不能通过传入角色名称、用户等级或帐号 Id 伪造接收资格。旧公告未填写帐号范围时维持原来的全部帐号语义。

新增提醒时填写标题、纯文本内容、内置图标、提醒级别、优先级，以及可选的安全链接。正文最多 8000 字符；指定接收对象最多 200 个，更大范围选择“全部”。试用提醒必须绑定单个子租户，填写试用到期时间和提前分钟数，不会修改租户 License 或限制登录。

| 提醒类型 | 时间与显示方式 |
|---|---|
| 维护公告 | 到开始时间后生效，支持一次性主动发布 |
| 试用到期 | 到期时间减提前分钟数后生效，可选择每次进入或刷新系统显示 |
| 定时提醒 | 一次、每日、每周或按分钟间隔；每日/每周按固定 24 小时/7 天计算 |

全部提醒都必须设置结束时间，避免历史公告永久弹出。“仅提醒一次”按用户和本次提醒周期记录关闭状态；“每次进入/刷新”按浏览器页面会话记录，切换系统菜单不会反复弹。定时提醒进入新周期后可以再次显示；离线后仅显示当前周期，不补弹错过的全部历史周期。界面按浏览器时区显示，接口和数据库快照使用含时区的 UTC 时间。

### 每次后端重启后提示一次

显示频率选择“每次后端重启后提示一次”（`AfterServerRestart`）。在有效期内，符合范围的帐号成功登录并首次进入系统时可领取该公告，同一服务启动批次内刷新、重新登录和多开页面不会再次领取。用户无需手动关闭后才能去重；关闭记录仍用于保留当前弹窗状态。

启动标识由后端取得真实进程启动时间，在宿主开始接收请求前登记，通过主租户当前运行分区的共享 Redis 原子选定最新启动批次；接收和关闭回执按各接收租户、帐号隔离。多节点请求切换不会因落到旧节点而重复提示；滚动发布出现更新的节点启动批次时可再次提醒。启动批次暂时无法核验时先不显示此类公告，普通业务通知和其它公告继续工作。

“仅超级管理员”与“重启后提醒”要求接收协议 2。官方源不会把受限公告下发给旧协议服务器，避免旧端忽略帐号范围后向普通用户显示。升级后端、PC 前端和消息通知应用后才能获得完整行为。重启频率不允许同时叠加每日、每周等周期计划。

版本介绍可配置安全链接 `https://microi.net/doc/edition-comparison.html`，用户点击后在新标签页打开。

### 发布、撤回与接收

1. 选择范围和对象，编辑内容后先保存草稿。保存草稿不会发送，新草稿也不会自动替换已发布内容。
2. 使用预览核对弹窗，再点击“发布”。同一草稿版本重复提交复用同一发布记录；并发编辑要求匹配 `ExpectedRevision`。
3. 接收人在页面中央看到可拖动、可关闭的对话框。多条提醒按优先级和时间依次展示，关闭状态保存在当前接收租户的数据库中。
4. 如需停止提醒，点击“撤回”。再次发布已撤回版本前，先保存新版草稿。发布历史保留每次不可变的内容与对象快照。

前端监听 `ReceivePlatformReminder`，收到 SignalR 信号后从收件箱接口读取权威内容。连接正常时仍约每 60 秒对账，断线时约每 15 秒轮询；到点计划、登录、重连和页面重新可见也会触发刷新，接口错误采用有上限的退避。关闭回执暂时失败会重试，当前页面先保持关闭。

`platform-reminder-tick` 由任务调度按 `0 * * * * ?` 每分钟唤醒在线客户端。任务只负责加快发现，提醒是否到点由已发布的计划计算，因此任务暂停或实时事件丢失后仍可由接口轮询恢复。撤回通过信号或下一次对账收回，过期提醒会从当前弹窗移除。

### 数据与接口

| 表 | 保存内容 |
|---|---|
| `mci_platform_reminder` | 草稿规则、版本和当前发布状态 |
| `mci_platform_reminder_batch` | 不可变的发布内容、有效期、发布版本及撤回状态 |
| `mci_platform_reminder_target` | 发布记录与用户、租户或产品版本的映射；全部范围仅保存一条通配映射 |
| `mci_platform_reminder_receipt` | 当前租户、当前用户的领取与关闭回执；`ShownAt / ClosedAt` 区分已领取与已关闭，稳定主键完成去重 |

`platform-reminder-runtime` 提供 `Capabilities / Recipients / List / Get / Validate / Save / Publish / Withdraw / History / Inbox / Presented / Acknowledge`。管理员身份和租户从真实 DiyToken 重新验证，客户端不能传入用户或官方标志代替授权。管理表不开放普通客户端直接 CRUD；发布状态、快照和接收范围在同一 `V8.DbTrans` 事务中提交。最小发布示例：

```js
// 先通过管理界面或 Save 保存草稿，重复请求使用相同 RequestId。
var result = V8.ApiEngine.Run('platform-reminder-runtime', {
  Action: 'Publish', Id: '<草稿Id>', ExpectedRevision: 1,
  RequestId: '<稳定的16至80位请求标识>'
}, V8.DbTrans);
return result;
```

其它服务器的后端只从固定 `https://api.itdos.com/apiengine/platform-reminder-official-feed?OsClient=iTdos` 读取官方已发布的产品版本提醒，并按自身真实 License 再筛选。请求不发送用户、数据库连接、License 密钥或设备指纹，也不能通过配置更换源或跟随重定向。官方源故障会降级并返回告警，本地提醒继续工作；缓存和对账会使跨服务器发布、撤回存在短暂延迟。

### 安装与升级

先升级支持接收协议 2 的平台后端和 PC 前端，再更新“应用商城”并安装最新版“消息通知”；存量 SaaS 入口清理还需要更新“SaaS 引擎”。相关平台包携带同一内置微服务产物；只有“消息通知”拥有提醒接口、`platform-message-notification-config` 配置接口和提醒调度任务，SaaS 基础包同步交付统一菜单与空库结构。新版安装器根据 `DiyFieldRetirements` 幂等退役旧 SaaS 提醒组件元数据，清理按钮和 Tab；保留存量物理列、提醒数据及回执。仅安装应用包不能让旧平台二进制自动获得新增的可信原子。

包只分发结构、索引、接口、入口和编译产物，不包含真实提醒、接收对象或关闭历史。多节点共享数据库和 Redis，SignalR 只传刷新信号；验收分别检查包版本/哈希、索引、接口回读、登录弹窗、关闭后刷新、断线轮询、撤回与过期。

## 使用自己的 MCP 让 AI 配置通知

安装应用并更新吾码 MCP 与 Skills 后，AI 使用当前用户自己的连接维护配置，不能复用官方连接替别人配置。可以直接描述：“新增订单待审批通知，发送平台内部和邮件，接收人为采购主管角色，先检查配置并保存。”

| MCP 工具 | 用途 |
|---|---|
| `microi_get_notification_context` | 发现能力、原通知配置、公告、当前租户用户/角色、模板、适配器接口 Key 和投递记录 |
| `microi_configure_business_notification` | 校验或保存原 `mic_msgset` 配置；不调用发送接口 |
| `microi_manage_system_reminder` | 校验、保存草稿、发布或撤回公告；支持帐号范围与重启频率 |

配置工具先返回预览；用户已经授权写入时，AI 在核对连接与内容后带精确 `confirmExecution` 执行。业务配置保存使用 `Save:<Id或Key>`；公告操作使用 `<Action>:<Id或RequestId>`。修改已有记录必须携带最新版本，公告保存与发布使用稳定请求标识，写入后自动回读。

例如让 AI：“给全部子租户的超级管理员新增一条维护公告，明天 22:00 生效，次日 02:00 结束，先保存草稿供我检查。”AI 应先读取 `Capabilities` 和 `Recipients`，将本地时间转换成含时区的时间，设置 `ScopeType=Tenants`、`AccountScope=SuperAdmins`、`AllTargets=true`，只执行 `Save`。只有用户授权发布后才执行 `Publish`。

普通服务器没有产品版本发布权。请求指定 `Editions` 不会提升权限；官方管理员也必须明确选择 `OpenSource / Personal / Enterprise`，不能自动扩大发送范围。自定义短信、邮件供应商通过现有接口引擎和 `V8.Http` 配置适配器，密钥不进入通知规则或 MCP 审计。

## 数据表

### `mic_msgset`：通知策略

| 字段 | 说明 |
|---|---|
| `Key` | 业务稳定 Key，租户内唯一，例如 `order_wait_approve` |
| `Title` | 配置名称，也是未覆盖时的默认通知标题 |
| `IsEnable` | 通知总开关 |
| `ConfigRevision` | 编辑版本；旧记录按 0 读取，保存后递增，冲突不会覆盖 |
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

同一条平台内部通知还会投影到右上角唯一固定的“AI助手”会话，不再创建独立的系统联系人。通知中心和聊天会话共用 `mic_msg_event_log` 这一份权威历史与已读状态：聊天侧不另存一份通知，也不把 SignalR 事件当作历史记录；AI 点对点历史仍由聊天存储负责，前端按时间把两类权威记录合并展示，用户可以在同一会话继续向 AI 助手提问。新通知统一返回 `SenderUserId/Account=AI`、`SenderName=AI助手`；旧记录中保存的历史系统发送人元数据也由客户端兼容投影为 AI 助手，不需要破坏性迁移或删除历史日志。

SignalR 连接必须同时携带当前最新 DiyToken 和显式 `OsClient`，服务端以 Token 解析出的用户与租户覆盖客户端提交的发送人字段；访问密钥会话不允许建立实时聊天连接或发送消息。聊天图标显示“已连接、连接中、重连中、已断开、重连暂停”等状态；自动重连采用 `0/2/5/10/30` 秒有限退避，达到上限后暂停，只有用户手动重试或登录身份/租户变化才开启新一轮，禁止无限高频重连。重连成功后再回读通知与聊天快照。

旧的 `V8.SendSystemMessage` 仍用于聊天系统兼容消息。新业务通知使用 `V8.Notification`，才能获得策略、多渠道、事件日志、幂等和通知中心已读状态。

## 配置步骤

1. 在“微信公众号配置”中新增公众号或服务号，并妥善保存凭据。
2. 如需跳转小程序，在“小程序配置”中新增小程序；它不替代第 1 步。
3. 在“公众号模板消息”中设置唯一 Key、`WxMpId`、模板 Id 和内容，按需设置普通链接或小程序跳转。
4. 在“系统引擎 → 消息通知 → 业务通知”中设置唯一 Key、启用状态、通知方式、固定用户/角色和模板；短信/邮件选择适配器接口 Key。
5. 业务代码以稳定 `EventId` 调用 `msg_event`。
6. 从“投递记录”核对每个接收人/渠道的状态，再在通知中心验证在线提示、离线回读和已读。

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
- 应用商城包必须随 `mic_msgset`、`mic_msg_event_log`、`wx_tpl_msg` 一并发布 `wx_mp`、`wx_mini_program` 的结构与表单元数据；后两者不附带数据集。这样既满足 `sys_user.WxMpId` 等跨模块 Select 数据源依赖，也不会发布真实渠道密钥、用户配置和历史事件。

### 官方聊天运行时与租户扩展

“消息通知” v1.0.9 单一拥有两个 `Managed` 核心：`platform-chat-system-message` 是旧系统消息 Controller 的最小门面，完成超级管理员校验后只转调 `platform-chat-runtime`；`platform-chat-runtime` 统一编排普通消息持久化、联系人、未读数、历史和已读、删除。两者均 `StopHttp=1`，源码顶部明确提示官方应用安装/更新/重装会恢复官方版，不应直接写入租户定制逻辑。v1.0.8 为聊天运行时分配了跨官方应用全局唯一的稳定 Id，避免与 AI 运行时在同一租户安装时发生主键冲突。

SignalR Hub 调用聊天运行时仍保留 `Client` 权限语义，但不能因此把 `StopHttp` 改为 `0`。v1.0.9 由宿主在 DiyToken 和租户核验后，建立绑定固定 `platform-chat-runtime` Key、权威 `OsClient` 与当前用户快照的一次性可信协议上下文；V8 运行时先调用 `V8.Method.RequireManagedProtocolContext()` 原子消费，再执行聊天动作。普通 HTTP、伪造 `_CurrentUser` / `_InvokeType`、错误租户、错误 Key 和重放调用仍在进入业务代码前失败关闭；`platform-chat-system-message` 的内部 `Server` 嵌套调用不消费该 SignalR 上下文。

运行时支持 `PersistMessage` / `PersistSystemMessage` / `PersistAssistantMessage` / `GetHistoryAndMarkRead` / `GetUnreadCount` / `TouchContact` / `ListContacts` / `DeleteContact`。用户和租户只取 `V8.CurrentUser` 与 `V8.OsClient`，忽略客户端伪造的发送人、用户 Id 和 `OsClient`。发送端应提供稳定 `RequestId`；运行时把“租户 + RequestId”哈希成确定性 Mongo `_id`，相同请求仅复用完全一致的已持久事实，载荷不一致则失败关闭。旧客户端未传 `RequestId` 时，兼容 Hub/Controller 会生成 ULID；这只保证单次调用，不能跨 HTTP/SignalR 重试去重。

租户定制统一写入 `platform-message-notification-custom-hook`。该接口使用 `CreateIfMissing`，首次安装后的源码、启用状态和软删除状态都归租户维护；默认正文精确为 `return { Code : 1 };`。运行时在 `BeforeChatRuntime` 与 `AfterChatRuntime` 阶段调用 Hook。Before 失败会在 MongoDB 写入前阻断；MongoDB 不参与 `V8.DbTrans`，所以已持久之后的 After/联系人投影失败不会把主结果反转为失败，而是以 `Code=1` 并在 `DataAppend.HookWarning` / `ProjectionWarnings` 返回告警。

Hook 只接收 `Stage`、`SourceApiEngineKey`、`Action`、`ActorUserId`、`PeerUserId`、`MessageId` 和 `MessageType`，不接收消息正文、头像、OpenId、Token 或其它秘密。C# `DiyWebSocket` 只保留 DiyToken 连接认证、在线连接缓存、SignalR 尽力投递和 AI 流式协议；消息先持久、再投递，投递丢失不会丢历史，重连后从 Managed 运行时回读。旧 Hub 方法与 `/api/DiyChat/SendSystemMessage` 仍保留，但都转发同一份 Managed 逻辑，不再直连 MongoDB/FormEngine 重复业务。

## 验收清单

- 两个租户的三张表字段、通知方式数据源、Mongo 聊天读写和物理索引已回读一致。
- 同一个 `EventId` 重复调用和两个 API 节点并发调用，只产生一次接收人/渠道副作用。
- 在线用户即时收到；离线用户、断网重连和 SignalR 故障后仍能从列表恢复。
- 事务回滚不推送；提交后节点退出，持久日志仍可审计。
- 用户不能读取或标记他人的通知；危险链接和超限参数被拒绝。
- 无 Token、访问密钥、伪造租户/发送人被拒绝；相同 `RequestId` 并发只生成一条消息，不同载荷不得复用。
- 公众号/服务号发送主体与小程序跳转分别验证。
- 源码测试、后端编译、远端回读、真实浏览器和商城安装/校验分别记录，不用本地成功冒充生产部署。

相关 API 见[后端 V8](../v8-engine/v8-server)与[前端 V8](../v8-engine/v8-client)，可靠后台补偿见[任务调度](./job)。
