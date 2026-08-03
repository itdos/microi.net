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

### `msg_internal_mark_read`

- `{ Id }` 只允许更新当前用户拥有的单条平台内部通知。
- `{ All: true }` 更新当前用户全部未读平台内部通知。
- 不接受客户端指定 `ReceiverUserId` 越权操作。

### `V8.Notification.Send`

`ReceiverUserId/ReceiverUserIds` 必填其一，最多 200 个；`Title` 最长 200 字符；`Content` 与序列化后的 `Payload` 各最多 32 KiB；`LinkUrl` 最长 500 字符且只允许站内路径、锚点、HTTP/HTTPS。事件名固定为 `ReceivePlatformNotification`。

## 验收矩阵

| 场景 | 断言 |
|---|---|
| 重复请求 | 同一接收人/渠道只存在一条日志，适配器不重复产生业务副作用 |
| 两节点同时发送 | 唯一索引只有一个 claim 成功，两节点都不崩溃 |
| 写入后节点退出 | 日志仍可查询；发送状态可审计、可补偿 |
| SignalR/Redis 短故障 | 业务写入不回滚，客户端列表回读恢复 |
| 事务回滚 | 不产生实时通知，业务日志随事务回滚 |
| 离线用户 | 下次打开通知中心能看到并标记已读 |
| 越权读取/已读 | 其它用户 Id 无效，记录不改变 |
| 微信配置 | `WxMpId` 决定发送主体，小程序字段只决定跳转 |
| 应用安装 | 无密钥、OpenId、历史日志或固定用户；安装后字段/索引/接口回读一致 |
