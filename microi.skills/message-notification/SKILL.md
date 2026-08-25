---
name: message-notification
description: 设计、实现、迁移和验收 Microi 多通道消息通知。用于涉及 wx_tpl_msg、mic_msgset、mic_msg_event_log、微信公众号或服务号模板消息、小程序跳转、短信、邮件、平台内部通知、V8.Notification、通知中心 SignalR、msg_event、消息幂等或通知应用商城交付的任务。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi 消息通知

## 目标

交付“配置可维护、事件先持久化、实时可降级、多节点不重复、租户不串线”的通知能力。支持微信公众号/服务号模板消息、短信、邮件和平台内部通知；小程序是公众号模板消息的跳转目标，不是独立的公众号发送主体。

## 开始前

1. 读取工作区 `AGENTS.md`，并按任务同时读取 `microi-db-schema`、`v8-api-config`、`v8-frontend-events`、`microi-client-frontend`；涉及商城时再读 `app-store`，涉及浏览器时再读 `playwright-e2e`。
2. 用用户点名的 MCP 连接读取实时结构，不以本地字典替代远端事实。至少读取 `wx_tpl_msg`、`mic_msgset`、`mic_msg_event_log`，按需读取 `wx_mp`、`wx_mini_program`、`sys_menu` 和接口引擎。
3. 多租户比较按字段语义合并：保留双方新增字段、控件、说明和数据源，再把并集同步到双方。每次写入后重新读取字段、物理索引和接口源码。
4. 只有用户明确要求时才复制渠道配置。复制微信公众号/小程序密钥时不在输出中打印秘密；模板、发送主体和小程序跳转引用必须一起回读验证。

## 核心模型

- `mic_msgset`：通知策略。`Key` 是稳定业务键，`Type` 是多选渠道，`ChannelApiEngineMap` 配置短信、邮件或自定义渠道适配器。
- `wx_tpl_msg`：微信公众号/服务号模板。`WxMpId` 决定发送主体；`MiniProgramId`、`MiniProgramAppId`、`MiniProgramPagePath` 仅表示点击模板消息后跳入的小程序。
- `mic_msg_event_log`：每位接收人、每个渠道的权威事件记录。至少包含稳定 `EventId`、`ChannelType`、`ReceiverUserId`、标题、内容、链接、Payload、已读状态和结果。
- 唯一约束：`EventId + ChannelType + ReceiverUserId`。租户使用独立业务库时表内无需虚构 `OsClient` 字段；共享库模型则必须把租户键加入唯一约束。

完整字段、接口和可靠性契约见 [references/contracts.md](references/contracts.md)。

## 实现流程

### 1. 合并结构

对两个租户分别读取字段列表，按 `Name` 生成差异表。新增缺失字段后刷新缓存，并回读：

- `mic_msgset.Type` 包含 `微信公众号模板消息`、`短信`、`邮件`、`平台内部`；
- `mic_msgset.ChannelApiEngineMap` 为 JSON 对象；
- `wx_tpl_msg` 同时有 `WxMpId/WxMpName` 和小程序跳转字段；
- `mic_msg_event_log` 有完整的事件、接收人、渠道、内容和已读字段；
- 业务唯一索引与常用未读查询索引存在。

不要用一次性 SQL 修某个租户而跳过通用表单/资源升级路径。应用包与平台升级资源必须携带同一结构。

### 2. 配置发送策略

`mic_msgset.Key` 对业务长期稳定。接收人可以来自固定用户、角色和调用参数，必须去重并限制扇出。渠道适配器统一接收：

```js
{
  EventId: '业务稳定幂等键',
  ChannelType: '短信',
  User: { Id: '...', Phone: '...', Email: '...', WxOpenId: '...' },
  Title: '审批提醒',
  Content: '您有一条待审批记录',
  LinkUrl: '/#/approval/123',
  Payload: { BusinessId: '123' }
}
```

适配器必须按 `EventId` 幂等。不要把密钥放进 `ChannelApiEngineMap` 或 Payload；密钥保存在对应渠道配置表或租户安全配置中。

### 3. 后端发送

业务代码优先调用 `msg_event`，由它读取策略、解析接收人、原子登记日志后分发。调用方在重试时保持同一个 `EventId`：

```js
return V8.ApiEngine.Run('msg_event', {
  MsgKey: 'order_wait_approve',
  EventId: 'order-wait-approve-' + V8.Param.OrderId,
  ReceiverUserIds: [V8.Param.ApproverId],
  Content: '订单 ' + V8.Param.OrderNo + ' 等待审批',
  LinkUrl: '/#/orders/detail?id=' + V8.Param.OrderId,
  Payload: { OrderId: V8.Param.OrderId }
}, V8.DbTrans);
```

`V8.Notification.Send` 是宿主的“平台内部实时提示”原语。它不替代日志 claim，通常只由 `msg_event` 在日志成功登记后调用。事务存在时，推送在提交后进行有界等待；回滚不得推送。

### 4. 前端通知中心

前端 V8 使用 `V8.Notification.List` 获取当前登录用户的权威快照，使用 `MarkRead` 标记本人通知。SignalR 固定事件 `ReceivePlatformNotification` 只用于低延迟刷新：客户端按 `Id/EventId` 去重，收到后仍以列表接口回读为准。

```js
await V8.Notification.Send('order_wait_approve', {
  EventId: 'order-wait-approve-' + V8.Form.Id,
  ReceiverUserIds: [V8.Form.ApproverId],
  Content: '订单等待审批'
});

var result = await V8.Notification.List({ PageIndex: 1, PageSize: 20 });
await V8.Notification.MarkRead(result.Data[0].Id);
await V8.Notification.MarkRead({ All: true });
```

列表和已读接口必须以 `V8.CurrentUser.Id` 作为服务端过滤条件，不能信任客户端传入的用户 Id。外链只允许站内路径、锚点或 `http/https`。

### 5. 多节点可靠性

- 数据库日志是事实源，SignalR 是可丢失提示；Redis backplane 使任一节点能通知连接在其它节点的用户。
- “先查询再新增”不能防并发；依赖唯一索引抢占。同一事件重复投递只能产生一份 `EventId + 渠道 + 接收人` 记录。
- 外部供应商在“已发送但响应丢失”时无法凭本地状态保证恰好一次。适配器必须把 `EventId` 传给支持幂等的供应商；不支持时进入可审计的人工确认/重试状态。
- 发布中新旧版本短暂共存，先扩展字段与接口，再发布读写代码，最后才收缩旧字段。

## 应用商城交付

“消息通知”应用包必须包含 `mic_msgset`、`mic_msg_event_log`、`wx_tpl_msg`、`wx_mp`、`wx_mini_program` 五张结构资源，以及相关菜单、`msg_event`、`msg_internal_list`、`msg_internal_mark_read`、`platform-chat-system-message`、`platform-chat-runtime`、`platform-message-notification-custom-hook` 和必要索引。`wx_mp`、`wx_mini_program` 只交付物理表结构与表单字段元数据，不得携带数据集；否则既可能泄露真实公众号/小程序密钥，也会覆盖目标租户配置。`sys_user.WxMpId` 和 `wx_tpl_msg` 会读取 `wx_mp`，漏包会使 `/system/diy-user` 等无关页面在加载 Select 数据源时触发 `GetDiyFieldSqlData` 缺表错误。包内不得包含真实公众号 Token/AppSecret、用户接收人、OpenId、历史发送记录或租户专属 URL。先 `ValidateOnly`，再在全新或缺表目标租户真实安装，回读五张表、应用版本和依赖页面；结构校验不能替代真实安装验收。

应用包中的 `sys_apiengine.Id` 是跨应用共享物理表的稳定主键，必须在全部官方应用范围内全局唯一；不能只检查单包内 Key/Id。发布前必须同时扫描全部官方包的 `Id` 与 `ApiEngineKey`，任一跨包重复都应阻断发布和离线包生成。

系统聊天门面 `platform-chat-system-message`（`Managed`）完成平台超级管理员校验后，只转调本应用单一拥有的 `platform-chat-runtime`（`Managed`）。运行时统一编排 `PersistMessage / PersistSystemMessage / PersistAssistantMessage / GetHistoryAndMarkRead / GetUnreadCount / TouchContact / ListContacts / DeleteContact`；Hub/Controller 旧入口只保留 DiyToken 认证、SignalR 投递和 AI 流式协议，不得直连 MongoDB/FormEngine 复制业务。访问密钥会话、空 Token、伪造租户/发送人必须失败关闭。

`platform-chat-runtime` 以 `V8.CurrentUser` / `V8.OsClient` 为唯一身份与租户事实源，对“租户 + 稳定 RequestId”生成确定性 Mongo `_id`；只有全部载荷哈希一致才复用旧记录。MongoDB 不参与 `V8.DbTrans`，因此消息/已读/联系人成功后即是已提交事实；SignalR、投影或 After Hook 失败必须保持 `Code=1` 并通过 `DataAppend.HookWarning` / `ProjectionWarnings` 告警，不得伪装未发生而引导盲目重试。调用 `V8.MongoDb.UptFormDataByWhere` / `DelFormDataByWhere` 时必须使用包含当前用户/权威资源边界的非空参数化 `_Where`，规则详见 `../v8-mongodb/SKILL.md`。

`platform-chat-runtime` 必须保持 `StopHttp=1`、`AllowAnonymous=0`。SignalR Hub 在 DiyToken 与租户核验后，通过宿主一次性可信协议作用域调用，并携带宿主生成的权威当前用户快照；V8 对 `_InvokeType=Client` 的调用必须先执行 `V8.Method.RequireManagedProtocolContext()` 原子消费。不得为修复 Hub 误报“禁止 HTTP 调用”而开放 `StopHttp`，也不得接受 Param 中的信任布尔值、用户或租户覆盖；接口引擎内部 `Server` 嵌套调用保持原有语义。

租户个性化仅写入 `platform-message-notification-custom-hook`（`CreateIfMissing`），默认正文必须精确为 `return { Code : 1 };`。运行时在 `BeforeChatRuntime / AfterChatRuntime` 调用 Hook：Before 失败在 Mongo 写前阻断，After 失败只告警。Hook 只接收 `Stage`、`SourceApiEngineKey`、`Action`、`ActorUserId`、`PeerUserId`、`MessageId`、`MessageType`；正文、头像、OpenId、Token 与其它秘密不得进入租户扩展。三项接口的源码顶部都要保留官方恢复/租户不覆盖提示，并在包合同测试中逐字核对独立源码、包内副本、所有权策略和 HTTP/匿名开关。

## 最低验收

1. 两个 MCP 租户的字段、数据源、物理索引和三段接口代码回读一致。
2. 重复 `EventId`、重复接收人和两个 API 节点并发发送，持久副作用仅一次。
3. 事务回滚不推送；提交后在线用户即时收到，离线/SignalR/Redis 故障后登录仍能回读。
4. 用户只能查询和标记自己的通知；危险链接、超长正文、跨租户接收人和匿名调用被拒绝。
5. 公众号/服务号发送主体与小程序跳转目标分别验证，不把 `MiniProgramAppId` 当作模板发送主体。
6. 源码定向测试、后端编译、远端 MCP 回读、真实浏览器点击和商城安装/校验分别报告；未执行的生产发布不得写成已上线。
7. 聊天空 Token/访问密钥/伪造租户失败关闭；相同 `RequestId` 并发只有一份 Mongo 事实，不同载荷冲突拒绝；已持久后 SignalR/After Hook 失败仍返回成功并可回读。
