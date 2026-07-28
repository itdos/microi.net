---
name: v8-api-config
description: Microi V8 接口引擎配置指南。用于设置 ApiEngineKey、ApiAddress、StopHttp、AllowAnonymous、ResponseFile、锁、日志、超时和 HTTP 暴露。
---

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

`microi_run_engine` 只能证明引擎代码在 MCP/内部执行上下文可运行，不能证明移动端或外部 HTTP 能调用。新建或更新接口后必须再走一次真实 HTTP 路径：

```text
POST /apiengine/{ApiEngineKey}--OsClient--{OsClient}--
Headers: Content-Type=application/json, OsClient={OsClient}, apiengine=1
Body: {"Action":"Bootstrap"}

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
- Header `OsClient` 只能作为补充，URL 路径里的 `--OsClient--{OsClient}--` 更稳。避免用 `?OsClient=` 做 ApiEngine 复测；部分动态路由会把 querystring 参与 `ApiAddress` 匹配并误报引擎不存在。
- 更新接口代码时保留 HTTP 元数据，避免只覆盖 JS 代码却把匿名、启用、自定义地址等配置冲掉。

## 请求内异步与可靠后台任务

接口默认同步返回。对本次请求必须完成的异步 I/O，调用真实的 `*Async` 方法并 `await`：

```javascript
var resp = await V8.Http.GetResponseAsync({
  Url: 'https://example.com/health',
  Timeout: 5
});
if (resp.StatusCode < 200 || resp.StatusCode >= 300) {
  return { Code: 0, Msg: '上游调用失败' };
}
return { Code: 1, Data: resp.Content };
```

禁止用 `setTimeout` 或 `System.Threading.Tasks.Task.Run` 实现“接口先返回、后台继续执行”：`V8Engine.Run` 返回后会释放 Jint Engine、租户上下文、事务和并发租约，回调不可靠，也没有持久化、重试、幂等或重启恢复保证。

需要先响应再处理时，使用接口引擎后台任务按钮（`RunBackground + ApiEngineKey`）、Job、MQ 或 outbox；消费者按全局 `EventId` 幂等处理并持久化进度。见 `v8-menu-buttons`、`v8-mq-mqtt` 和 `microi-system-delivery`。

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
- [ ] 保存后是否通过 `/apiengine/{key}--OsClient--{osClient}--` 做过 HTTP 复测？

## 常见错误

❌ 把支付回调接口设为非匿名 → 第三方无 Token → 回调失败  
❌ 内部接口忘开 `StopHttp` → 被外部直接调用绕过校验  
❌ 对账接口未配置 `LockKey` → 集群多实例并发执行 → 数据双倍  
❌ 文件下载接口未开 `IsResponseFile` → 返回 JSON 而非文件流
