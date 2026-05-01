# Microi V8 调试与日志

你正在为 Microi 吾码平台编写 V8 引擎代码，需要在开发/测试/生产环境进行排错。本指南提供调试模式、异常捕获、系统日志、调试输出的标准做法。

## 三种输出通道

| 通道 | 何处看 | 用途 |
|------|--------|------|
| `console.log` / `console.error` | docker logs / 服务器控制台 | 长期跟踪、性能日志 |
| `DataAppend.DebugLog`（返回给前端） | 浏览器开发者工具 / Postman 响应 | 当次请求的关键节点、变量值 |
| `V8.Method.AddSysLog({...})` | 系统日志页 / `sys_log` 表 | 业务操作审计、第三方回调记录 |

## 调试模式 isDebugLog

接口引擎建议通过参数开关控制日志详细度：

```javascript
var isDebugLog = V8.Param.isDebugLog === '1' || V8.Param.isDebugLog === true;
var debugLog = [];
function dbg(msg, data) {
  if (!isDebugLog) return;
  debugLog.push({
    time: DateNow('HH:mm:ss.fff'),
    msg: msg,
    data: data
  });
}

dbg('开始查询参数', V8.Param);

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

调用时在 URL 加 `?isDebugLog=1` 即可在响应中看到所有节点的日志，**不影响生产**。

## try/catch 异常捕获 + 详情上报

```javascript
try {
  var r = V8.Http.Post({
    Url: 'https://api.partner.com/sync',
    PostParam: V8.Param,
    ParamType: 'json',
    Timeout: 30
  });
  if (!r || r.indexOf('"code":0') === 0) {
    throw new Error('合作方接口失败：' + r);
  }
  return { Code: 1, Data: JSON.parse(r) };
} catch (ex) {
  // 完整异常信息
  var errorDetails = {
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
    Msg: '同步失败：' + ex.message,
    DataAppend: V8.Param.isDebugLog ? { Stack: ex.stack } : null
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

存在 `sys_log` 表，可以在系统日志菜单查看，可按 Type 过滤。

## console 在 Docker 中查看

```bash
docker logs -f microi-net.api  --tail 100
# 或者
docker compose logs -f api
```

> 在 Linux 部署时 `console.log/error` 直接输出到容器 stdout/stderr，可被日志采集系统（Loki/ELK）收集。

## 性能跟踪（毫秒级耗时）

```javascript
var t0 = System.Environment.TickCount;

var step1 = V8.FormEngine.GetTableData('Big', { _PageSize: 5000 });
var t1 = System.Environment.TickCount;

var step2 = V8.Db.FromSql('SELECT COUNT(*) FROM Order').ToScalar();
var t2 = System.Environment.TickCount;

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

## 不要在生产泄漏敏感信息

```javascript
// ❌ 危险：返回给前端
return { Code: 0, Msg: ex.message, DataAppend: { Stack: ex.stack } };

// ✅ 仅 isDebugLog=1 时才返回
return {
  Code: 0,
  Msg: '系统繁忙',
  DataAppend: V8.Param.isDebugLog === '1' ? { Stack: ex.stack } : null
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
