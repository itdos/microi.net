---
name: v8-api-config
description: Microi V8 接口引擎配置指南。用于设置 ApiEngineKey、ApiAddress、StopHttp、AllowAnonymous、ResponseFile、锁、日志、超时和 HTTP 暴露。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 接口引擎配置

你正在配置 Microi 吾码平台的接口引擎（API 引擎）。除了 JS 代码本身，每个接口还有一系列**安全/性能配置项**，写代码时必须了解这些选项以决定是否需要调整。

## 配置项总览

| 字段 | 说明 | 默认 |
|------|------|------|
| `ApiEngineKey` | 接口唯一标识（URL 路径） | 必填 |
| `ApiAddress` | 自定义接口地址（覆盖默认 `/apiengine/{Key}`） | 空 |
| `RequestType` | `Get` / `Post` / `Both` | `Both` |
| `ParamType` | `form` / `json` / `url` —— 但 V8.Param 都能统一接收 | `Both` |
| `IsAnonymous` | 允许匿名调用（无 Token） | `false` |
| `StopHttp` | 禁止外部 HTTP 调用（仅允许 V8.ApiEngine.Run 内部调用） | `false` |
| `IsResponseFile` | 是否响应文件（开启后 Data 必须是文件结构） | `false` |
| `LockKey` | 分布式锁 Key（同一时刻全集群只能执行一次） | 空 |
| `LockTimeout` | 锁超时秒数 | `30` |
| `LockMsg` | 加锁失败时返回提示 | `操作过于频繁` |
| `RateLimit` | 频率限制（如 `60/m` 每分钟60次） | 空 |
| `LogParam` | 是否记录请求参数到 `sys_log` | `false` |
| `LogResult` | 是否记录返回值到 `sys_log` | `false` |

### 资源预算与嵌套调用（强制理解）

- `LimitMemory` 是单个 Jint 引擎的**累计托管分配预算**，不是实时堆占用或服务器预留内存。默认 2048MB、节点硬上限默认 8192MB。
- `V8.ApiEngine.Run` 多层嵌套是正常能力。新版默认隔离父子引擎的单层分配计数，子层不会再被每个父层重复计费；根调用树另有默认 8192MB 总预算。
- 接口嵌套深度默认 32、节点硬上限默认 64；它与 `LimitRecursion` 的 JavaScript 函数递归不是同一限制。
- 嵌套调用不重复占用全局/租户并发名额，同一调用树重入同 Key 也不会自锁；不同子接口 Key 仍受自己的 Key 并发门保护。
- `V8.Limits` 可读取本片有效预算和当前深度。异常优先检查 `DataAppend.V8Limit.Code`，不要看到“2GB”就判断服务器真实吃满 2GB。
- 后台任务使用同一执行引擎。总任务可以运行数小时，但单片仍受 `Timeout/MaxStatements/LimitMemory` 约束；超过 10 分钟必须返回 `HasMore + Checkpoint` 分片续跑，不能只把 `Timeout` 调到 1800/3600。
- 接口引擎使用正向 `V8Limit`：默认 `0/false`，不设置当前 Jint Engine 的单次超时、语句、函数递归、累计分配和 Promise 固定等待预算；只有 `1/true` 才应用 `Timeout/MaxStatements/LimitMemory/LimitRecursion`。常驻内存保护、取消令牌、并发、接口嵌套深度、权限沙箱及数据库限制在两种状态下都保留。老 `V8Unlimited` 只作协议兼容；MCP/Manifest 新配置统一写 `v8Limit`。

### 通用实时事件（SignalR）

订单、协作、设备、审批或多人房间需要实时刷新时，业务写命令仍由接口引擎执行并提交事务；成功结果通过 `DataAppend.RealtimeEvent` 声明提交后事件。新业务统一使用通用 v2 Hub `/api-engine-realtime`，不要再新建业务专用 Hub 或把权威状态放进 C# 进程内字典。

```javascript
return {
  Code: 1,
  Data: snapshot,
  DataAppend: { RealtimeEvent: {
    EventId: requestId,
    ChannelKey: 'order_updates',
    SubjectId: order.Id,
    Version: order.VersionNo,
    EventType: 'StatusChanged',
    Data: { Status: order.Status }
  } }
};
```

- Hub 方法固定为 `SubscribeChannel({ ChannelKey, SubjectId })` 与 `UnsubscribeChannel(...)`，客户端事件固定为 `RealtimeEvent`。订阅成功会返回 `ProtocolVersion/ChannelKey/SubjectId/Version/Latest/RenewAfterMilliseconds/LeaseExpiresAt`。
- 连接只接受当前有效的普通登录 Token。现有 AccessKey 权限模型没有 `realtime:subscribe` scope，平台会直接拒绝；在平台正式增加并校验该 scope 前，不得用 AccessKey 建立实时订阅。
- 对应订阅授权接口固定为 `realtime_{channel_key}_authorize`。它必须用 `V8.CurrentUser` 校验资源权限，并精确回显 `Authorized/ChannelKey/SubjectId/Version`；不能信任客户端传入的 UserId、OsClient 或 ApiEngineKey。
- 订阅使用 30 秒时隙租约。客户端必须按服务端返回的 `RenewAfterMilliseconds` 再次调用同一个 `SubscribeChannel` 续租；每次续租都会重新验证登录 Token、经过共享 Redis 限流，并重新执行授权接口引擎。不要把一次订阅误当成连接全生命周期永久授权。
- 当前共享 Redis 限流按 `OsClient + UserId` 聚合为 10 秒最多 96 次订阅授权，跨标签页、API 节点和滚动发布共同生效；Redis 不可用时实时订阅失败关闭，业务必须继续走 HTTP Snapshot。
- `EventId` 在业务重试时保持稳定；平台先用 Redis 短 Claim 协调跨节点发布，只有真实广播成功后才写 24 小时完成标记，避免“先去重、后崩溃”永久漏发。客户端仍必须按 `EventId` 去重，因为故障恢复可能产生重复通知。
- `Version` 按同一 `ChannelKey + SubjectId` 单调递增。低版本事件作为过期事件拒绝广播；同版本但内容指纹不同视为版本冲突并拒绝；重放相同事件不推进 latest。
- 宿主只读取成功 DosResult 中固定大小写的 `DataAppend.RealtimeEvent`，并只广播 `EventId/ChannelKey/SubjectId/Version/EventType/Data/OccurredAt`。`Data` 最大 32KB，只能放该群组所有订阅者都可见的安全投影；个性化私有数据通过按当前用户裁剪的 Snapshot 获取。
- 客户端按 `EventId` 去重、按 `Version` 检测乱序和缺口；连接失败、续租失败、重连或发现缺口时立即重新拉 HTTP Snapshot，并保留有界轮询兜底。共享存储/状态机才是事实源。
- 旧 `/game-realtime` 只作兼容。新业务默认使用通用协议，完整契约见官方 `v8-server.md`。

## 1. 匿名调用（IsAnonymous）

公开接口（登录、注册、忘记密码、验证码、扫码登录、第三方回调）必须开启：

```javascript
// 例：发送验证码（匿名）
if (!V8.Param.phone) return { Code: 0, Msg: '手机号不能为空' };
if (!/^1[3-9]\d{9}$/.test(V8.Param.phone)) return { Code: 0, Msg: '手机号格式错误' };

// 防刷：1分钟同一手机号最多1次
var key = 'Microi:' + V8.OsClient + ':SmsCode:' + V8.Param.phone;
if (V8.Cache.Exists(key)) return { Code: 0, Msg: '请稍后再试' };

var code = Math.floor(100000 + Math.random() * 900000).toString();
V8.Cache.Set(key, code, 60);
// ... 调短信网关 ...
return { Code: 1, Msg: '验证码已发送' };
```

### 1.1 会员端 Token 优先级

移动端/会员端自建 Token 与 Microi 后台 JWT 并存时，会员业务接口应明确 Token 优先级。MCP、后台自动化测试、PC 管理端代理调用常会在 `V8.Header.Token` 中带平台 JWT，如果接口要校验会员登录态，推荐优先读取显式会员参数或专用 Header，再回退平台 Header：

```javascript
function getMemberToken() {
  var p = V8.Param || {};
  var h = V8.Header || {};
  var token = p.Token || p.token || h.MallMemberToken || h.mallmembertoken || h.Token || h.token || h.Authorization || h.authorization || '';
  token = String(token || '').trim();
  if (token.indexOf('Bearer ') === 0) token = token.substring(7).trim();
  return token;
}
```

不要让后台 JWT 覆盖前端显式传入的会员 Token，否则 MCP/Playwright 用会员账号做自动化测试时会误判为未登录。

## 2. 禁止外部调用（StopHttp）

仅供其他接口引擎/V8 事件内部调用，不允许直接 HTTP 请求触发：

```javascript
// 例：核心扣款接口（StopHttp=true）
// 只能从 order_pay、refund 等接口通过 V8.ApiEngine.Run 调用
V8.Db.FromSql('UPDATE Account SET Balance = Balance - @p0 WHERE Id = @p1')
  .AddInParameter("@p0", V8.Param.amount)
  .AddInParameter("@p1", V8.Param.accountId)
  .ExecuteNonQuery();
return { Code: 1 };
```

外部调用直接 `/apiengine/account_deduct` 会被拒绝。

## 3. 分布式锁（LockKey）

集群部署时可用接口引擎 `LockKey` 减少同一任务的并发执行（如：每月对账、自动补单）：

```javascript
// 配置：LockKey = month_settlement，LockTimeout = 600
// 平台使用共享锁协调多节点；锁超时、节点暂停和网络分区仍可能触发重试
var month = DateNow('yyyy-MM');
V8.Db.FromSql('INSERT INTO MonthSettle SELECT ... WHERE Month = @p0')
  .AddInParameter("@p0", month)
  .ExecuteNonQuery();
return { Code: 1 };
```

`LockKey` 可包含 `${V8.OsClient}` 实现按租户独立锁。

分布式锁不是“业务只执行一次”的最终保证。扣款、库存、积分、流水、对账等副作用还必须使用稳定幂等键、数据库唯一约束/条件更新、状态机或 outbox/inbox；锁 Key 至少包含 `OsClient + 业务唯一标识`，超时必须大于正常执行时间。所需唯一索引必须写入 Manifest `tables[].indexes` 并通过 `microi_create_table_index` 创建、`microi_get_table_indexes` 回读，接口引擎本身禁止执行索引 DDL。

## 4. 自定义路径（ApiAddress）

让接口暴露为 `/wechat/notify` 而非 `/apiengine/wechat_notify`，对接第三方时常用：

```
ApiAddress: /wechat/notify
```

## 5. 响应文件（IsResponseFile）

开启后接口可直接输出二进制流：

后端会统一处理响应头和文件头校验：图片/PDF 浏览器直接打开，其它文件下载；V8 代码只返回文件三字段，不要在接口里手写复杂的魔数判断。`ContentType` 必须匹配真实字节，金蝶 PLM `KD_C_PLM` 等业务封装流不能伪装成 `application/pdf`。

响应文件动态路由必须同时接受 `GET` 和 `HEAD`。OnlyOffice 等服务端预览器可能先用 `HEAD` 探测文件类型、长度和可达性；如果浏览器直接下载正常但 `HEAD` 返回 `405`，在线预览仍可能一直停在“加载文档”。

```javascript
// 必须返回特定结构
return {
  Code: 1,
  Data: {
    FileName: 'report.xlsx',
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    FileByteBase64: System.Convert.ToBase64String(byteArr)
  }
};
```

详见 `v8-file-upload/SKILL.md`。

## 6. 频率限制（RateLimit）

防爬虫、防刷：

| 配置 | 含义 |
|------|------|
| `60/m` | 每分钟 60 次 |
| `1000/h` | 每小时 1000 次 |
| `100/s` | 每秒 100 次 |

按客户端 IP + 接口 维度限流。

## 7. 日志记录（LogParam / LogResult）

支付、撤销等敏感接口建议开启，自动记到 `sys_log` 用于审计回溯：

```
LogParam = true     # 记录每次入参
LogResult = true    # 记录每次返回
```

> ❌ 接口返回结果含敏感数据（密码、token、密钥）时不要打开 `LogResult`

## 8. 保存后 HTTP 复测

通过 MCP 维护接口引擎时，先用 `microi_list_engines` 发现现有接口，再用
`microi_get_engine_code` 读取源码；修改后使用 `microi_save_engine_code`
保存并回读。只有确认目标不存在时才调用创建工具，避免重复
`ApiEngineKey`。`microi_run_engine` 适合做引擎上下文内的最小调试，但不能
代替下方真实 HTTP 复测。

`microi_run_engine` 只能证明引擎代码在 MCP/内部执行上下文可运行，不能证明移动端或外部 HTTP 能调用。新建或更新接口后必须再走一次真实 HTTP 路径：

```text
POST /apiengine/{ApiEngineKey}
Headers: Content-Type=application/json, osclient={OsClient}, apiengine=1
Body: {"Action":"Bootstrap","OsClient":"{OsClient}"}

# 兼容旧入口
POST /api/ApiEngine/Run
Headers: Content-Type=application/json, OsClient={OsClient}
Body: {"ApiEngineKey":"your_key","Action":"Bootstrap"}
```

复测重点：

- `IsEnable=1`、`StopHttp=0`、公开接口 `AllowAnonymous=1`。
- JSON Body 会恢复到 `V8.Param`；同名参数已由 Query/Form 绑定时保持既有值，避免改变旧调用优先级。直接动态路由与兼容入口都要覆盖 JSON Body 测试，不能只用 Query 参数证明可用。
- HTTP 请求中的 `_CurrentUser`、`_InvokeType:'Server'`、`_TrustedServerInvocation` 都不能建立可信服务端身份；当前用户和调用类型必须由认证中间件与接口层重新写入。
- `ApiAddress` 不能为空字符串；空字符串可能导致 404。
- 响应不能是空 body、字符串 `null`、非 JSON；业务接口必须返回标准 DosResult。
- 普通 `POST/PUT/PATCH/DELETE` 必须使用稳定路径 `/apiengine/{ApiEngineKey}`，租户放在唯一的 `osclient` Header，并可在 JSON/Form Body 中冗余传入；禁止无脑给路径追加 `--OsClient--...--`。普通 GET 优先 Header 或 `?OsClient=`。只有微信/支付等第三方回调（包括 POST）、浏览器直接下载等调用方确实无法设置 Header 或 Query 的场景，才使用 `--OsClient--{OsClient}--` 特殊路径；Query 参数名固定为 `OsClient`，禁止 `o` 等缩写。
- 需要 C# 验签/AES 解密或隐藏 SaaS 密钥的回调，使用“最小协议网关 + `Managed` 核心接口 + `CreateIfMissing` 租户 Hook”。网关不得承载日志、写表、通知等业务逻辑；传给 V8 的事件必须脱敏，并包含稳定 `EventId` 供 Hook 幂等。
- 更新接口代码时保留 HTTP 元数据，避免只覆盖 JS 代码却把匿名、启用、自定义地址等配置冲掉。

## 请求内异步与可靠后台任务

接口默认同步返回。对本次请求必须完成的异步 I/O，调用真实的 `*Async` 方法并 `await`。常用入口包括 `V8.Http.*Async`、`V8.FormEngine.GetTableDataAsync` 和 `V8.ApiEngine.RunAsync`：

```javascript
var resp = await V8.Http.GetResponseAsync({
  Url: 'https://example.com/health',
  Timeout: 5
});
if (resp.StatusCode < 200 || resp.StatusCode >= 300) {
  return { Code: 0, Msg: '上游调用失败' };
}

var users = await V8.FormEngine.GetTableDataAsync('SysUser', {
  _Where: [['Status', '=', 1]],
  _SelectFields: ['Id', 'Name'],
  _PageSize: 20
});

var summary = await V8.ApiEngine.RunAsync('build-user-summary', {
  Users: users.Data
});
return { Code: 1, Data: { Upstream: resp.Content, Summary: summary.Data } };
```

禁止用 `setTimeout` 或 `System.Threading.Tasks.Task.Run` 实现“接口先返回、后台继续执行”：`V8Engine.Run` 返回后会释放 Jint Engine、租户上下文、事务和并发租约，回调不可靠，也没有持久化、重试、幂等或重启恢复保证。

需要先响应再处理时，使用接口引擎后台任务按钮（`RunBackground + ApiEngineKey`）、Job、MQ 或 outbox；消费者按全局 `EventId` 幂等处理并持久化进度。AI 发现预计超过 2 分钟、500 条、1000 个扇出子操作、100 次外部调用，或安装/初始化/迁移/备份/全量生成等任务时，必须主动切换为后台任务；预计超过 10 分钟时还必须设计 checkpoint 分片。见 `job-engine`、`v8-menu-buttons`、`v8-mq-mqtt` 和 `microi-system-delivery`。

## 接口安全检查清单

- [ ] 公开接口是否仅开启 `IsAnonymous`，敏感接口是否关闭？
- [ ] 内部接口是否开启 `StopHttp`？
- [ ] 写操作（扣款、对账、补单）是否配置 `LockKey`？
- [ ] 锁之外是否还有幂等键、唯一约束/条件更新或状态机？
- [ ] 频率敏感接口是否配置 `RateLimit`？
- [ ] 审计需求接口是否开启 `LogParam`？
- [ ] 文件响应接口是否开启 `IsResponseFile`？
- [ ] 接口代码内是否仍校验 `V8.CurrentUser`（`IsAnonymous=true` 时尤其重要）？
- [ ] 是否没有使用 `setTimeout` / `Task.Run` 承担请求外后台任务？
- [ ] 大任务是否按阈值主动使用后台任务，超过 10 分钟是否有 `HasMore + Checkpoint`？
- [ ] 是否区分累计分配、调用树预算、JS递归与接口嵌套，而不是盲目抬高全部限制？
- [ ] 是否确认 `V8Limit=false` 表示接口不限 Jint 单次预算、`true` 才启用限制，并避免继续写入旧 `V8Unlimited` 字段？
- [ ] 保存后是否通过稳定路径 `/apiengine/{key}` + `osclient` Header 做过 HTTP 复测？特殊 GET/HEAD 路径是否仅用于无法设置 Header/Form/Query 的场景？

## 常见错误

❌ 把支付回调接口设为非匿名 → 第三方无 Token → 回调失败  
❌ 内部接口忘开 `StopHttp` → 被外部直接调用绕过校验  
❌ 对账接口未配置 `LockKey` → 集群多实例并发执行 → 数据双倍  
❌ 文件下载接口未开 `IsResponseFile` → 返回 JSON 而非文件流
