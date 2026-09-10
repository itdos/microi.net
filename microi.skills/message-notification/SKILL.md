---
name: message-notification
description: 设计、实现、迁移和验收 Microi 多通道消息通知与平台提醒。用于平台提醒、SaaS 系统提醒、试用到期、维护公告、定时弹窗、官方版本提醒、wx_tpl_msg、mic_msgset、mic_msg_event_log、公众号模板消息、短信、邮件、V8.Notification、SignalR、msg_event、消息幂等或通知应用商城交付。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi 消息通知

## 统一配置入口与 MCP

- 安装同一个 `app.microi.message-notification` 应用后，统一从“系统引擎 → 消息通知”进入系统公告、业务通知与投递记录。禁止再建独立“系统提醒”应用或向 SaaS 表单添加入口。旧 `/xiaoxitongzhisz` 配置并入业务通知，原 `mic_msgset` 和历史数据保留。
- 先用当前用户自己的 MCP 调用 `microi_get_notification_context`，读取 `Capabilities / BusinessRules / BusinessRule / Reminders / Reminder / Recipients / Templates / Adapters / Logs / History`。`Adapters` 按关键词分页发现本租户已启用的接口 Key，不读取源码或密钥。用户和角色只在当前租户读取，跨租户/产品版本仅选择 `AllAccounts / SuperAdmins`，不得读取其它服务器角色。
- `microi_configure_business_notification` 的 `Validate` 不写入、不发送；`Save` 写原通知表，通过固定 `platform-message-notification-config` 接口编排。确认串为 `Save:<id或Key>`；修改必须传 `expectedRevision`，不能把密钥写进 `ChannelApiEngineMap`。
- `microi_manage_system_reminder` 提供 `Validate / Save / Publish / Withdraw`，确认串为 `<action>:<id或requestId>`。保存仅草稿；发布前核对用户已经授权的具体内容、范围与时间。保存/发布使用稳定 `requestId`，编辑/发布/撤回传最新 `expectedRevision`，超时先按原 Id/Key 回读，禁止换请求标识盲目新建。
- `AccountScope` 在本租户 `Users` 默认 `AllAccounts`，在 `Tenants / Editions` 默认 `SuperAdmins`；不要让已指定的普通帐号被默认管理员筛选误排除。用户显式指定的帐号范围优先。
- 配置接口只管理原表、校验引用和读取脱敏投递记录；实际发送继续调用 `msg_event`。`ConfigRevision` 缺省按 0 兼容旧记录，更新使用同事务条件写，失败不能覆盖别人修改。停用旧配置允许保留失效引用，再启用时重新核验。
- MCP 缺少上述工具时优先更新本机插件/CLI；当前宿主未重载可复用已有 `microi_run_engine` 调用同一固定接口，不另建临时维护引擎或绕过授权。明确区分本机工具打包成功与用户渠道已发布。

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

## 平台提醒的使用与交付

- 居中可关闭的公告、试用到期与定时提醒统一从“系统引擎 → 消息通知 → 系统公告”配置，使用 `platform-reminder-runtime` 和内置 `microi-platform-service` 的 `/platform-reminders` 页面。在同一页面选择单个、多个或全部租户及用户；不得再向 SaaS 引擎添加提醒按钮、提醒 Tab 或嵌入组件，也不得改为 `TableChild` 或在 V8 中拼接复杂 HTML。
- 四张表分别是 `mci_platform_reminder` 草稿、`mci_platform_reminder_batch` 发布快照、`mci_platform_reminder_target` 接收映射和 `mci_platform_reminder_receipt` 关闭回执。普通客户端不能直接写表。保存草稿不发送；版本条件更新、批次稳定主键、接收映射与状态修改必须共享 `V8.DbTrans`，不要混用独立 `V8.Db.FromSql` 写入。
- `Users` 面向当前租户用户，`Tenants` 仅允许主租户选择当前环境和网络的启用子租户，`Editions` 仅由宿主现有 License 发放判断确定官方身份。官方选项需明确选择 `OpenSource / Personal / Enterprise`，不得默认给全部版本发送。请求中的用户、租户、官方标志和产品版本不构成授权。
- 试用提醒只绑定一个子租户，配置到期时间和提前分钟数，不改 License。所有提醒都必须有有效结束时间，支持 `Once / EveryEntry / AfterServerRestart`；定时支持一次、每日、每周和分钟间隔。每日/每周是固定时间间隔；时间传 UTC，界面显示浏览器时区；恢复上线不补弹所有历史周期。
- 后端三个 Managed Key 为 `platform-reminder-runtime / platform-reminder-official-feed / platform-reminder-tick`。运行时动作包括 `Capabilities / Recipients / List / Get / Validate / Save / Publish / Withdraw / History / Inbox / Presented / Acknowledge`。发布需草稿 Id、`ExpectedRevision` 和稳定 `RequestId`；每次进入模式的收件箱和回执需稳定的本页面 `EntryId`。
- `AccountScope=SuperAdmins` 由接收服务的真实 DiyToken、数据库用户和有效本地角色核验；`AllAccounts` 面向全部帐号。缺省字段保留旧公告的全部帐号语义；新 UI 和 MCP 的跨租户/版本默认范围为超级管理员。普通服务器不能伪造官方 License 发放身份。
- `AfterServerRestart` 用可信后端进程启动标识和主租户当前运行分区的共享 Redis 最新批次计算 occurrence，`Presented` 按数据库稳定回执主键抢占领取资格；同帐号多页面只有一个领取，刷新和重新登录不再次弹出。展示成功前回执应已持久化；响应丢失以同一个页面 `EntryId` 恢复，不以 localStorage 作为事实源。`ShownAt` 与 `ClosedAt` 分离，当前已领取弹窗需保留到关闭、撤回或过期。
- 超级管理员范围和重启频率的最低接收协议为 2；官方 feed 必须对协议 1 隐去此类公告，接收端出缓存后再次按当前身份裁剪。未知范围、异常协议或无法核验的启动批次失败关闭。重启频率不能再叠加周期计划；多节点滚动发布采用共享最新启动批次，验证负载切换不回退、不重复。
- 定时任务 `platform-reminder-tick` 每分钟只发送唤醒信号；权威计划与回执保存在数据库。前端监听 `ReceivePlatformReminder` 后回读，SignalR 正常约 60 秒对账、断线约 15 秒轮询并对错误退避；关闭失败重试、撤回和过期收回，禁止使用本机定时器或 localStorage 作为已读事实源。
- 跨服务器官方源由 `Microi.net` 固定请求 `api.itdos.com`，不允许任意 URL/重定向、不发送用户或密钥，按真实本地 License 筛选并缓存；官方源降级不得阻断本地提醒。匿名 feed 只暴露已发布的版本公告，不可读草稿、租户目标或回执。
- 官方“消息通知”包单一拥有配置接口 `platform-message-notification-config`、三个提醒接口、四表六索引、统一菜单、每分钟任务与当前内置微服务产物；SaaS 包同步统一菜单、基础空库结构和旧布局退役声明。先更新支持 `DiyFieldRetirements` 的商城，再安装新版 SaaS 包，清理旧入口且保留业务数据。商城包的内置微服务版本需同步。导出母版可能不带物理索引，按已验证 Manifest 补独立 `CREATE INDEX`，由安装器幂等检查；禁止发布测试提醒、真实接收人或回执数据。
- 共享微服务发布闭包还包含独立“系统日志/监控”包，不能只核对 SaaS、商城和消息通知。先读取相关商城选择清单与实际包，确认 `microi-platform-service` 的所有携带者；按 `platform-service-release.json` 校验同一版本、构建字节与路由。监控包从 `system-observability-package-source.json` 和当前共享运行包经 `configure-system-observability-package.mjs` 再生成，元数据变化要先合并官方母版并升独立包版本。发布前验证各包，安装全部平台应用后再验消息通知页面，避免后安装的旧运行包覆盖新页面；不能通过修改安装器的 Managed 覆盖语义规避。
- MCP 复用 `microi_get_db_schema / microi_generate_system / microi_admin_table_data / microi_save_engine_code / microi_run_engine`，以及在线应用发现、源码同步和流式发布工具；入口调整使用 `microi_update_module / microi_update_table / microi_delete_field`，写后回读确认不存在旧入口。
- 源码升级与应用安装缺一不可。验收覆盖正式 SDK 的 JSON 字符串响应、居中/拖动/关闭、每次刷新、单/多/全租户入口、权限隔离、重复发布、事务失败、到点/过期、断线轮询；多节点与实际其它服务器需要独立集成证据，不能由单机或模型测试替代。

## 最低验收

1. 两个 MCP 租户的字段、数据源、物理索引和三段接口代码回读一致。
2. 重复 `EventId`、重复接收人和两个 API 节点并发发送，持久副作用仅一次。
3. 事务回滚不推送；提交后在线用户即时收到，离线/SignalR/Redis 故障后登录仍能回读。
4. 用户只能查询和标记自己的通知；危险链接、超长正文、跨租户接收人和匿名调用被拒绝。
5. 公众号/服务号发送主体与小程序跳转目标分别验证，不把 `MiniProgramAppId` 当作模板发送主体。
6. 源码定向测试、后端编译、远端 MCP 回读、真实浏览器点击和商城安装/校验分别报告；未执行的生产发布不得写成已上线。
7. 聊天空 Token/访问密钥/伪造租户失败关闭；相同 `RequestId` 并发只有一份 Mongo 事实，不同载荷冲突拒绝；已持久后 SignalR/After Hook 失败仍返回成功并可回读。
