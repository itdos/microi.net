---
name: v8-debugging
description: Microi V8 调试与日志指南。用于排查接口引擎、V8 事件、console.log、DataAppend.DebugLog、sys_log、异常处理和远程执行问题。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi V8 调试与日志

你正在为 Microi 吾码平台编写 V8 引擎代码，需要在开发/测试/生产环境进行排错。本指南提供调试模式、异常捕获、系统日志、调试输出的标准做法。

MongoDB 运行日志通过 `microi_query_mongodb_logs` 只读查询；必须限制租户、时间窗、页大小和返回字段，不在结果或回答中输出 Token、连接串、Secret 或完整敏感请求体。

## 三种输出通道

| 通道 | 何处看 | 用途 |
|------|--------|------|
| 后端 V8 的 `console.log` / `console.error` | 租户系统日志（MongoDB）；MCP/调试执行同时返回当次 `ConsoleOutput` | 临时诊断、性能日志 |
| `DataAppend.DebugLog`（返回给前端） | 浏览器开发者工具 / Postman 响应 | 当次请求的关键节点、变量值 |
| `V8.Method.AddSysLog({...})` | 系统日志页 / `sys_log` 表 | 业务操作审计、第三方回调记录 |

## 调试模式 isDebugLog

调试开关必须同时满足“服务端允许调试 + 当前用户 `Level >= 9999`”。不能只相信 URL/query 的 `isDebugLog=1`，匿名或普通用户否则可获得内部数据与堆栈。

```javascript
var isAdmin = V8.CurrentUser && Number(V8.CurrentUser.Level || 0) >= 9999;
var isDebugLog = isAdmin &&
  V8.SysConfig &&
  V8.SysConfig.EnableV8Debug === 1 &&
  (V8.Param.isDebugLog === '1' || V8.Param.isDebugLog === true);
var debugLog = [];
function dbg(msg, data) {
  if (!isDebugLog) return;
  debugLog.push({
    time: DateNow('HH:mm:ss.fff'),
    msg: msg,
    data: data
  });
}

dbg('开始查询参数', {
  Keyword: String(V8.Param.Keyword || '').substring(0, 100),
  PageIndex: V8.Param.PageIndex
});

var products = V8.FormEngine.GetTableData('Product', {
  _Where: [['Status', '=', 1]]
});
dbg('查询结果', { Code: products.Code, Count: products.Data && products.Data.length });

// ... 业务处理 ...

return {
  Code: 1,
  Data: result,
  DataAppend: isDebugLog ? { DebugLog: debugLog } : null
};
```

管理员在服务端显式开启调试后，才可用 `?isDebugLog=1` 查看当次请求的脱敏节点日志。生产环境默认关闭，调试完成后立即关闭。

## Jint 内存上限错误

出现 `Script has allocated ... but is limited to ...` 时，不要把它解释为
数据库返回数据的实际大小，也不要直接关闭内存限制。

- Jint `LimitMemory` 使用当前执行线程的**累计托管分配字节数**，不是当前
  存活堆或进程工作集；中间对象即使已经被 GC 回收，累计值也不会减少。
- 平台必须在宿主对象、扩展和全局 V8 准备完成后调用
  `engine.Constraints.Reset()`，让全局 V8 和当前接口 V8 各自获得完整预算；
  用户脚本以及脚本调用的 CLR/FormEngine 逻辑仍受同一阶段预算限制。
- 默认单次执行预算为 2048 MB，默认节点硬上限为 8192 MB；根调用树默认
  8192 MB、节点硬上限 32768 MB。存量接口仅把仍等于
  历史默认值 1024 MB 的记录迁移到 2048 MB；客户明确设置的其它值不覆盖。
- 旧版嵌套接口会让子引擎的初始化、查询、JSON 和业务分配被每一层父引擎
  重复计数，因此四层、少量数据也可能提前触发 2GB。新版默认启用父子单层
  预算隔离，每层独立计数，同时由根调用树默认 8192MB 的总预算兜底。
- `LimitRecursion` 只限制当前 JavaScript 函数递归，不限制
  `V8.ApiEngine.Run` 层数；接口嵌套默认 32、节点硬上限默认 64。
- 排查时记录 `ApiEngineKey`、实际 `LimitMemory`、返回行数、选择字段、
  分页大小、`V8.Limits`、`DataAppend.V8Limit` 调用路径和重现脚本。若
  2048 MB 仍触发，继续减少一次性对象图、流式或
  分批处理；不得把上限无限提高或取消。
- `V8_MEMORY_LIMIT` 表示单层预算，`V8_CALL_TREE_MEMORY_LIMIT` 表示整棵
  调用树，`V8_STATEMENTS_LIMIT`、`V8_RECURSION_LIMIT`、`V8_TIMEOUT`、
  `V8_NESTED_DEPTH_LIMIT` 和 `V8_EXECUTION_QUEUE_TIMEOUT` 必须分别处理。
- 后台任务总时长可以超过 10/30 分钟，但单片仍受上述预算；使用
  `HasMore + Checkpoint` 续跑，不要只提高单次超时或内存。
- 若业务链必须在一个共享数据库事务中全部提交或全部回滚，分片会改变业务
  语义，可由管理员为对应 `sys_apiengine` 或 `diy_table` 开启
  `V8Unlimited`。此时 `V8.Limits.UnlimitedRuntime=true`，只解除当前 Jint
  的超时、语句、函数递归、累计分配和 Promise 等待限制；常驻内存保护、
  外部取消、并发、接口嵌套深度、权限沙箱与数据库限制仍在。先排查数据库
  长事务锁、日志和回滚风险，下游接口/表事件需分别开启，不能从请求参数启用。
- 服务端另有一个内置受信任特例：主租户中由持久队列恢复的
  `import-microi-store-package`：必须同时具备可信用户快照、`Level >= 9999`
  和 TaskId，才允许 `V8.Limits.MemoryAccounting=ResidentMemoryGuardOnly`。
  此模式不是“无限内存”，而是改用容器优先的进程 RSS 防线：95% 拒绝新工作、
  98% 有界停机；导入器仍必须按资产分片并可从 checkpoint 幂等恢复。前台调用、
  子租户或其它 Key 看到该模式都属于安全缺陷。
- 回归至少验证 Jint 包版本、约束重置、默认/硬上限，以及 400 行左右普通
  FormEngine 查询与数据加工不会被平台准备阶段的累计分配误伤。

## try/catch 异常捕获 + 详情上报

```javascript
try {
  var r = V8.Http.Post({
    Url: 'https://api.partner.com/sync',
    PostParam: {
      Id: V8.Param.Id,
      Action: V8.Param.Action
    },
    ParamType: 'json',
    Timeout: 30
  });
  if (!r || r.indexOf('"code":0') === 0) {
    throw new Error('合作方接口失败：' + r);
  }
  return { Code: 1, Data: JSON.parse(r) };
} catch (ex) {
  // 完整异常信息
  var traceId = V8.Method.NewUlid();
  var errorDetails = {
    traceId: traceId,
    message: ex.message,
    stack:   ex.stack,
    line:    ex.lineNumber,
    column:  ex.columnNumber,
    fileName: ex.fileName,
    when:    DateNow('yyyy-MM-dd HH:mm:ss')
  };
  console.error('SyncError', JSON.stringify(errorDetails));

  V8.Method.AddSysLog({
    Type: 'IntegrationError',
    Title: '合作方同步失败',
    Content: JSON.stringify(errorDetails),
    Level: 3   // 1=Info / 2=Warn / 3=Error
  });

  return {
    Code: 0,
    Msg: '同步失败，请按追踪号查询日志',
    DataAppend: isDebugLog ? { TraceId: traceId } : null
  };
}
```

## V8.Method.AddSysLog — 业务审计日志

```javascript
V8.Method.AddSysLog({
  Type: 'OrderCreate',           // 自定义类型，便于过滤
  Title: '客户【' + V8.Form.CustomerName + '】下单',
  Content: JSON.stringify({
    OrderId: V8.Form.Id,
    Amount: V8.Form.TotalAmount,
    UserId: V8.CurrentUser.Id
  }),
  Level: 1                        // 1=Info, 2=Warn, 3=Error
});
```

日志保存在按租户、月份拆分的 MongoDB 系统日志集合中，可在系统日志菜单查看并按 Type 过滤。所有 `AddSysLog` 调用统一进入后端异步队列，由后台批量写 MongoDB；批次先写本地 spool，MongoDB 故障和正常重启后自动幂等重放，因此业务请求不得自行启动线程或直接并发写 MongoDB。

- 容器环境把固定目录 `logs/syslog-spool` 挂载到持久卷，不为路径增加环境变量。
- 分布式部署的节点标识由平台自动生成；所有节点写同一 MongoDB 时仍按全局 `EventId` upsert。详情状态和私有文件票据存共享 Redis，本机内存只作故障兜底，不能依赖粘性会话。
- 多节点可能同时观察到的菜单、详情关闭、附件分片和登录生命周期事件要使用确定性 `EventId`，不能只靠本机字典去重；服务正常停止会落盘排空，重启会自动重放。
- 平台用户行为统一使用结构化字段 `Category`、`Action`、`Source`、`TargetType`、`TargetId`、`SessionId`、`DurationSeconds`、`Success`、`OccurredAt`。
- 用户显示采用 `Name(Account)`；禁止记录密码、原始 Token、Authorization、Secret、ApiKey、连接字符串，内容还必须限长。
- 前端只能上报纯 UI 行为信号；菜单访问、CRUD、导入导出、登录生命周期、私有文件实际访问等必须以后端真实执行点为事实源。

### 匿名登录/第三方授权接口的追踪日志

微信手机号、OAuth、短信快捷登录等匿名接口必须生成追踪号并按阶段记录失败。开发者工具成功不能替代体验版/真机验证。

```javascript
var traceId = V8.Method.NewGuid().replace(/-/g, '').substring(0, 16);

function fail(stage, message, detail) {
  V8.Method.AddSysLog({
    Type: 'ThirdPartyLogin',
    Title: '授权登录失败[' + stage + '][' + traceId + ']',
    Content: JSON.stringify({
      TraceId: traceId,
      Stage: stage,
      Message: message,
      Detail: detail || {},
      OsClient: V8.OsClient
    }),
    Remark: traceId,
    Level: 3
  });
  return { Code: 0, Msg: '授权登录失败（' + stage + '）：' + message + '；追踪号：' + traceId };
}
```

- 在身份交换、AccessToken、手机号/用户资料交换、账号匹配、注册/更新、Token 签发前维护明确阶段名，所有显式失败和顶层 `catch` 都走同一个 `fail`。
- 日志保留第三方 `errcode/errmsg`，但先脱敏；禁止记录 Secret、AccessToken、授权 code、LoginCode、OpenId、完整手机号和用户 Token。
- `V8.Method.AddSysLog` 写 MongoDB 系统日志，适合 `Code=0` 仍需保留的结构化失败记录；`console.error` 也按当前 `OsClient` 进入 MongoDB，但不替代带追踪号的业务审计日志。
- 前端响应显示同一个追踪号，排查时先按追踪号查系统日志，再结合第三方错误码定位。

## 后端 V8 console 的去向

- 普通接口引擎和表单后端 V8 的 `console.log/info/warn/error` 按租户写入 MongoDB 系统日志，`Source/TargetType` 为 `V8`，可按接口 Key 或事件名定位。
- MCP 远程执行和 V8 调试会通过请求级上下文捕获当次输出并返回 `ConsoleOutput`；不得用进程级 `Console.SetOut`，否则并发请求会互相截取日志。
- Docker/服务器控制台只保留影响平台启动、主租户、日志管道或进程存活的关键日志，不再作为普通 V8 调试日志入口。
- 前端 V8 的 `console.log` 仍在浏览器开发者工具中查看，与后端日志通道无关。

## 性能跟踪（毫秒级耗时）

```javascript
var t0 = Date.now();

var step1 = V8.FormEngine.GetTableData('Big', { _PageSize: 5000 });
var t1 = Date.now();

var step2 = V8.Db.FromSql('SELECT COUNT(*) FROM Order').ToScalar();
var t2 = Date.now();

dbg('耗时', { step1Ms: t1 - t0, step2Ms: t2 - t1, totalMs: t2 - t0 });
```

## 前端调试

```javascript
// 前端 V8 事件中
console.log('当前表单', V8.Form);
console.warn('弃用字段被使用');
console.error('校验失败', V8.Form);

// 在浏览器开发者工具控制台查看
// 或显式弹层：
V8.Tips('调试: ' + JSON.stringify(V8.Form), true);
```

## VS Code 插件输出约定

Microi VS Code 插件的右下角信息、警告和错误通知必须同步写入【输出 → Microi 吾码】，让构建、推送、拉取、登录、同步和调试结果在通知消失后仍可追溯。输出时间使用运行 VS Code 电脑的本地时区，格式统一为 `yyyy-MM-dd HH:mm:ss`，禁止直接使用 `toISOString()` 造成 UTC 时间偏差。

- 后台 Token/会话维护等静默健康探测设置 `silent=true` 后，预期的网络不可达不得反复写成红色错误。
- 用户主动执行拉取、推送或状态检查时，网络错误必须保留错误码、系统调用、地址、端口及聚合错误明细；禁止出现只有 `Error:`、没有原因的空日志。
- 所有右下角通知统一经过通知封装写入输出；带操作按钮的通知还应记录用户选择，禁止业务模块直接调用 `vscode.window.showInformationMessage/showWarningMessage/showErrorMessage` 绕过持久日志。

## 不要在生产泄漏敏感信息

```javascript
// ❌ 危险：返回给前端
return { Code: 0, Msg: ex.message, DataAppend: { Stack: ex.stack } };

// ✅ 只返回关联ID；完整堆栈仅写内部日志
var traceId = V8.Method.NewUlid();
console.error('traceId=' + traceId + ' error=' + ex.message);
return {
  Code: 0,
  Msg: '系统繁忙',
  DataAppend: { TraceId: traceId }
};
```

## DosResult 状态码速查

| Code | 含义 |
|------|------|
| `1` | 成功 |
| `0` | 业务失败（接口引擎中 return 此 Code 自动回滚事务）|
| `2` | `GetFormData` 数据不存在（特殊：仍是查询正常，只是无数据）|
| `1001` | Token 已失效 |
| `1002` | 身份验证失败 |
| 其它非 1 | 视为失败，自动回滚 |

调试时遇到 `Code != 1` 优先看 `Msg`、再开 `isDebugLog=1` 排查。

## 检查清单

- [ ] 接口引擎是否支持 `isDebugLog` 参数？
- [ ] 关键节点是否调用 `dbg()`？
- [ ] 第三方调用是否 `try/catch` + `AddSysLog`？
- [ ] 异常 stack 仅在 debug 模式下返回前端？
- [ ] 业务审计是否 `AddSysLog`（Level 1/2/3）？
- [ ] 性能瓶颈是否打 `TickCount` 耗时？
