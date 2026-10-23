# 消息通知契约

## 表结构并集

### `mic_msgset`

| 字段 | 用途 |
|---|---|
| `Key` | 稳定业务键，租户内唯一 |
| `Title` | 配置名称/默认标题 |
| `IsEnable` | 总开关 |
| `Type` | 多选渠道：微信公众号模板消息、短信、邮件、平台内部 |
| `Receivers` | 固定接收用户 JSON |
| `ReceiversRoles` | 固定接收角色 JSON |
| `WxTplMsgId` | 公众号模板配置 Id |
| `ChannelApiEngineMap` | 渠道到适配器接口引擎 Key 的 JSON 映射 |
| `TenantId/TenantName` | 业务层租户信息；不能替代 MCP 的 OsClient 边界 |
| `TableChild99` | 兼容已有子表配置 |

### `wx_tpl_msg`

| 字段 | 用途 |
|---|---|
| `Key/Title/TemplateId/Content/Remark/LinkUrl` | 模板业务键、标题、微信模板 Id、内容与普通跳转 |
| `WxMpId/WxMpName` | 发送模板消息的公众号或服务号；关联 `wx_mp` |
| `MiniProgramId/MiniProgramName` | 可选小程序配置；关联 `wx_mini_program` |
| `MiniProgramAppId/MiniProgramPagePath` | 模板消息的可选小程序跳转目标 |

公众号和服务号都属于微信公众帐号，由 `wx_mp` 保存发送凭据。小程序由 `wx_mini_program` 保存，不能使用小程序 AppId 调用公众号模板消息发送接口。

### `mic_msg_event_log`

| 字段 | 用途 |
|---|---|
| `EventId` | 调用方稳定幂等键 |
| `MsgEventId` | 关联的消息设置 Id |
| `ChannelType` | 本条日志对应的渠道 |
| `ReceiverUserId` | 单一接收用户 Id |
| `Receivers` | 接收人安全快照 JSON |
| `Title/MsgContent/LinkUrl/Payload` | 通知展示快照 |
| `IsRead/ReadTime` | 平台内部通知已读状态 |
| `IsSuccess/MsgResult` | 分发状态和经过脱敏的结果 |

索引基线：

- 唯一：`EventId, ChannelType, ReceiverUserId`；共享表模型再前置 `OsClient`。
- 普通：`ReceiverUserId, ChannelType, IsRead, CreateTime`。
- `mic_msgset.Key`、`wx_tpl_msg.Key` 在租户业务库内唯一。

## V8 接口

### `msg_event`

输入：

```js
{
  MsgKey: '策略 Key',
  EventId: '稳定幂等键',
  ReceiverUserId: '可选单用户',
  ReceiverUserIds: ['可选用户数组'],
  Title: '可覆盖配置标题',
  Content: '正文',
  LinkUrl: '/#/route',
  Payload: { BusinessId: '...' }
}
```

处理顺序：校验当前租户与登录上下文 → 读取启用策略 → 合并固定用户、角色用户和参数用户 → 去重/限流 → 按接收人和渠道插入日志 claim → 仅对 claim 成功项分发 → 汇总成功、失败、重复。出现部分失败时仍要提交已经产生的日志与外部副作用，并把失败逐项返回，不能为了漂亮的 `Code` 回滚成功事实。

### `msg_internal_list`

- 仅返回 `V8.CurrentUser.Id` 的 `ChannelType=平台内部` 记录。
- 支持 `PageIndex/PageSize`，`PageSize` 最大 100。
- `DataAppend.UnreadCount` 返回同一用户权威未读数。
- 每条记录统一投影 `SenderUserId/Account=AI`、`SenderName=AI助手`、`ReadOnly=false`；聊天侧只能固定一个 AI 助手联系人，并将通知权威历史与 AI 聊天历史按时间合并。
- 兼容旧 `MICROI_PLATFORM_ADMIN/admin` 元数据时只改显示投影，不批量删除或改写 `mic_msg_event_log` 历史事实。

### `msg_internal_mark_read`

- `{ Id }` 只允许更新当前用户拥有的单条平台内部通知。
- `{ All: true }` 更新当前用户全部未读平台内部通知。
- 不接受客户端指定 `ReceiverUserId` 越权操作。

### `V8.Notification.Send`

`ReceiverUserId/ReceiverUserIds` 必填其一，最多 200 个；`Title` 最长 200 字符；`Content` 与序列化后的 `Payload` 各最多 32 KiB；`LinkUrl` 最长 500 字符且只允许站内路径、锚点、HTTP/HTTPS。事件名固定为 `ReceivePlatformNotification`。

## 历史聊天定位维护

`platform-chat-runtime` v1.2.0 保留未迁移租户的旧协议；安装包更新不等于历史定位迁移。旧年度无定位消息跨年重放的限制仍存在，不能用历史分页通过代替幂等验收。

由已授权当前租户超级管理员通过 `microi_run_engine` 调用固定 `platform-chat-maintenance` v1.0.0，禁止临时引擎、原生 SQL 或跨租户写入替代：

1. 核实所有旧写入节点和直接写库者已经退出，新 Core/MongoDB/API 与 Managed 正文已经部署。未满足时不启动维护。
2. `Begin` 带稳定的 32 位小写十六进制 `OperationId`，保存返回 `Epoch`；关闭本租户整个聊天运行时的新调用（包括读取）。`Drain` 带同一 Epoch，直到真实活动调用归零、`WritersDrained=true`。
3. `Start` 带 `MaintenanceConfirmed=true` 与 8–100 位字母、数字、下划线或连字符的 `FenceId`；客户端确认只表示维护意图，可信排空由宿主验证。`Step` 每批最多 100 行、8 分区，每批独立稳定 `OperationId`（同 FenceId 格式）及上一迁移 `Revision` 作为 `ExpectedRevision`；未知结果重试同批标识，不能整个扫描重复一个标识。
4. `Status` 的 `Data.Migration` 必须同时满足 Completed、ScanComplete、零冲突、IndexesReady，FenceEpoch 等于 `Data.Gate.Epoch`；`End` 带同一 Epoch，并由引擎采用刚读取的原生修订号做条件释放。未知响应先 Status 回读。

`V8.Method.ManageManagedStorageMaintenance` / `V8.Method.RequireManagedStorageMaintenance` 只允许可信固定 Key、当前租户、真实超级管理员、非访问密钥会话。准入/活动票据在共享 MongoDB 中保存，不能直接通过 V8 CRUD、反射或禁止 ExecutionContext 流动的 API 绕开。Begin/Drain 的状态不能靠 V8.Param 伪造。

跨分区同 Id 即冲突，无论正文是否相同；原文全部保留。无时区历史时间、非法 Id、目录变化或未知存储结果都不能算完成。只在无迁移状态、同 Epoch 已 Drain 且无活动持有者时允许 AbortUnstarted；已有状态应恢复原操作，不强制回退旧协议。崩溃票据不自动过期；恢复前须有旧写入者确已退出的运维证据，不能清空控制集合。

迁移后历史查询使用权威定位索引与有界原文回查，普通页不 Count；未读计数独立执行。未知未读数保留 null/未知，Hub 不能推送虚假的 0。验收分别记录 VM 行为、真实 MongoDB、真实 HTTP/SignalR、多节点维护及线上部署；单机 Primary/Majority 成功不等于副本集故障切换通过。

## 验收矩阵

| 场景 | 断言 |
|---|---|
| 重复请求 | 同一接收人/渠道只存在一条日志，适配器不重复产生业务副作用 |
| 两节点同时发送 | 唯一索引只有一个 claim 成功，两节点都不崩溃 |
| 写入后节点退出 | 日志仍可查询；发送状态可审计、可补偿 |
| SignalR/Redis 短故障 | 业务写入不回滚，客户端列表回读恢复 |
| SignalR Hub 调用聊天运行时 | `StopHttp=1` 保持关闭；仅固定 Key/租户/权威用户绑定的一次性宿主上下文可通过，V8 原子消费一次 |
| 事务回滚 | 不产生实时通知，业务日志随事务回滚 |
| 离线用户 | 下次打开通知中心能看到并标记已读 |
| 越权读取/已读 | 其它用户 Id 无效，记录不改变 |
| 微信配置 | `WxMpId` 决定发送主体，小程序字段只决定跳转 |
| 应用安装 | 无密钥、OpenId、历史日志或固定用户；安装后字段/索引/接口回读一致 |
