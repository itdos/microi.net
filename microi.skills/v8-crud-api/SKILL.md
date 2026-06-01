---
name: v8-crud-api
description: Microi V8 CRUD API engine development. Use when writing server-side JavaScript with V8.FormEngine Add/Upt/Del/GetTableData, DosResult returns, transactions, and validation.
---

# Microi V8 CRUD API 接口引擎开发

你正在开发 Microi 吾码平台的 V8 接口引擎。接口引擎是运行在服务端的 JavaScript 函数，通过 `V8.FormEngine` 操作数据库，通过 `V8.Result` 或 `return` 返回结果。

## 本地优先与版本头（必做）

AI 本地开发接口引擎时，优先修改 `microi-v8-engine/<租户>/<项目>/接口引擎/.../*.js` 本地文件，再通过 MCP 或 VS Code 插件同步到数据库。插件提示“本地和远端不一致”时，必须先读取本地与远端代码并合并有效差异，不能盲目用任一侧覆盖另一侧。

每一次修改、上传、推送接口引擎代码，都必须维护文件顶部版本区域。版本号从 `v1.0.0` 开始；每次上传/推送/修改递增 1；补丁位和次版本位最大为 9 并向前进位（`v1.0.9 -> v1.1.0`、`v1.9.9 -> v2.0.0`、`v9.9.9 -> v10.0.0`）。代码头只写完整功能说明，不写修改历史、时间戳或 ChangeLog。推荐格式：

```javascript
/*
 * V8 ApiEngine
 * ApiEngineKey: your_api_engine_key
 * Version: v1.0.0
 * Function:
 * - 完整说明该接口引擎负责的业务功能、输入参数、关键返回字段和重要副作用。
 */
```

同步流程：`确认后端可达（不可达则自动启动 Microi.Server/Microi.net.Api/Microi.net.Api.csproj） -> 读取远端 -> 修改本地并递增语义版本头 -> JS 语法检查 -> 保存远端 -> 回读远端确认代码头 Version 与 sys_apiengine.Version 一致 -> 用 HTTP /apiengine/{key}--OsClient--{osClient}-- 复测`。只用 MCP 保存成功不算完成，必须至少做回读或 HTTP 验证。

如果保存或回读时出现 `fetch failed`、`ECONNREFUSED`、`000 Failed to connect`、端口无人监听等服务不可达问题，不能提前中止。必须自动执行 `dotnet run --project Microi.Server/Microi.net.Api/Microi.net.Api.csproj --launch-profile Microi.net.Api` 启动后端，等待 `https://localhost:7266` 可达后重试同步；涉及 PC 页面联调或 Playwright 时，还要自动启动 `Microi.Client`：`npm run dev -- --host 0.0.0.0 --port 1988`。只有启动失败、依赖缺失、数据库连接失败或端口冲突无法处理时才报告阻塞。

版本与历史同步规则：通过 MCP 或 VS Code 插件保存接口引擎时，必须同步写入 `sys_apiengine.Version`；修改记录只写入 `sys_apiengine.ChangeHistory`，不得写进代码头。`ChangeHistory` 是“修改历史说明”，每次更新都必须把最新说明拼接到最前面，并保留原有全部历史文字，禁止覆盖、清空或只保留最新一条。旧数据库可能没有 `Version`、`ChangeHistory` 字段，工具必须检测字段或失败回退，保证旧库仍可只更新 `ApiV8Code` 与 `UpdateTime`。

生成接口引擎代码时，代码内容本身（文件头、普通注释、`console.log`、返回 `Msg` 等）不要包含 `Microi`、`吾码` 等平台品牌文字，除非业务数据或字段值本身必须如此。生成代码要有可维护注释：每个 `function` 前写清用途、关键参数和返回值；跨表事务、权限校验、状态机、金额/库存计算、复杂 `_Where` 条件等代码段前写短注释说明业务原因；避免“给变量赋值”这类无信息量注释。

## 核心规则

- 接口引擎文件是纯 JavaScript（Jint 引擎，非 Node.js）
- 全局对象 `V8` 是所有后端能力的入口
- 通过 `V8.Param` 获取前端传入的参数（URL参数 / form-data / payload-json）
- 通过 `V8.CurrentUser` 获取当前登录用户信息
- 返回结果统一格式：`{ Code: 1, Data: any, Msg: '成功' }`
- 所有 FormEngine 方法在服务器端支持第三个参数传入 `V8.DbTrans`（事务对象）
- 服务端调用 FormEngine 默认**不触发**表单 V8 事件，加 `_InvokeType: 'Client'` 才触发
- 接口内 `return Code=1` 自动提交事务、`Code≠1` 自动回滚事务，**禁止**手动 Commit/Rollback

## 代码格式与中文输出（必做）

- 生成或修改接口引擎代码时必须是可读的多行格式，禁止把整段业务逻辑压成一行、禁止生成 minified 风格代码。
- 中文业务提示、返回 `Msg`、注释、按钮文案必须直接写正常中文，禁止输出 `\u64cd\u4f5c\u6210\u529f` 这类 Unicode 转义串。
- 保存前必须做 JS 语法检查；如果使用脚本生成代码，必须先格式化再写入本地文件/数据库。
- 代码头只写当前功能说明；修改历史写到 `ChangeHistory`，不要塞进代码头。
- 示例返回：`return { Code: 1, Msg: '操作成功', Data: data };`，不要写成 `return{Code:1,Msg:'\u64cd\u4f5c\u6210\u529f',Data:data};`。

## DosResult 状态码

| Code | 含义 |
|------|------|
| `1` | 成功 |
| `0` | 业务失败（自动回滚） |
| `2` | `GetFormData` 数据不存在（特殊值，仍属正常查询）|
| `1001` | Token 失效 |
| `1002` | 身份验证失败 |

```javascript
// GetFormData Code=2 的处理
var r = V8.FormEngine.GetFormData('Order', { Id: V8.Param.id });
if (r.Code === 2) return { Code: 0, Msg: '订单不存在' };
if (r.Code !== 1) return r;
// r.Data 才是真实数据
```

## 全局日期函数

```javascript
DateNow('yyyy-MM-dd HH:mm:ss')                // 当前时间字符串
DateFormat(new Date(), 'yyyy-MM-dd')          // 格式化
DateAdd(new Date(), 'd', 7, 'yyyy-MM-dd')     // 加减（s/m/h/d/w/q/M/y）
```

## 查询列表（分页）

```javascript
var result = V8.FormEngine.GetTableData('SysUser', {
  _Where: [
    ['Status', '=', 1],
    ['AND', 'Name', 'Like', V8.Param.keyword || '']
  ],
  _SelectFields: ['Id', 'Account', 'Name', 'Phone', 'CreateTime'],
  _OrderBy: 'CreateTime',
  _OrderByType: 'DESC',
  _PageIndex: V8.Param.pageIndex || 1,
  _PageSize: V8.Param.pageSize || 20
});

return { Code: 1, Data: result.Data, Total: result.DataCount, Msg: '成功' };
```

### 多字段排序

```javascript
var result = V8.FormEngine.GetTableData('SysUser', {
  _Where: [['Status', '=', 1]],
  _OrderBys: { 'CreateTime': 'desc', 'Name': 'asc' }
});
```

### 匿名查询（无需登录）

```javascript
var result = V8.FormEngine.GetTableDataAnonymous('Article', {
  _Where: [['IsPublished', '=', 1]],
  _PageSize: 10
});
```

### 获取树形数据

```javascript
// 表单属性需开启【树形结构】
var result = V8.FormEngine.GetTableDataTree('Department', {});
```

### 仅获取数据条数

```javascript
var result = V8.FormEngine.GetTableDataCount('SysUser', {
  _Where: [['Status', '=', 1]]
});
// result.DataCount 为总数
```

## 查询单条

```javascript
if (!V8.Param.id) {
  return { Code: 0, Msg: 'id 不能为空' };
}

var result = V8.FormEngine.GetFormData('SysUser', {
  _Where: [['Id', '=', V8.Param.id]],
  _SelectFields: ['Id', 'Account', 'Name', 'Phone']
});
// 也可以用 Id 直接查：{ Id: 'xxx' }

if (result.Code !== 1 || !result.Data) {
  return { Code: 0, Msg: '数据不存在' };
}

return { Code: 1, Data: result.Data };
```

## 新增

```javascript
if (!V8.Param.Account || !V8.Param.Name) {
  return { Code: 0, Msg: '账号和姓名不能为空' };
}

// 检查唯一性
var exist = V8.FormEngine.GetFormData('SysUser', {
  _Where: [['Account', '=', V8.Param.Account]]
});
if (exist.Code === 1 && exist.Data) {
  return { Code: 0, Msg: '账号已存在' };
}

var result = V8.FormEngine.AddFormData('SysUser', {
  // Id 不传会自动生成 GUID
  Account: V8.Param.Account,
  Name: V8.Param.Name,
  Phone: V8.Param.Phone || '',
  Status: 1
});
// result.Data 包含 Id, CreateTime, UserId 等自动生成字段

return { Code: result.Code, Data: result.Data, Msg: result.Code === 1 ? '新增成功' : result.Msg };
```

### 批量新增

```javascript
var addList = [];
for (var i = 0; i < V8.Param.items.length; i++) {
  addList.push({
    FormEngineKey: 'SysUser',  // 支持不同表混合批量
    Account: V8.Param.items[i].Account,
    Name: V8.Param.items[i].Name
  });
}
var result = V8.FormEngine.AddTableData(addList);
```

## 更新

```javascript
if (!V8.Param.Id) {
  return { Code: 0, Msg: 'Id 不能为空' };
}

var result = V8.FormEngine.UptFormData('SysUser', {
  Id: V8.Param.Id,          // 必传
  Name: V8.Param.Name,
  Phone: V8.Param.Phone,
  _NotSaveField: ['Account'],  // 可选：忽略这些字段不更新
  _NoLineForAdd: true,         // 可选：数据不存在时自动插入
  _ForceUpt: true              // 可选：强制修改自动编号字段
});

return { Code: result.Code, Msg: result.Code === 1 ? '更新成功' : result.Msg };
```

### 批量更新

```javascript
var uptList = [];
for (var i = 0; i < V8.Param.items.length; i++) {
  uptList.push({
    FormEngineKey: 'SysUser',
    Id: V8.Param.items[i].Id,
    Status: V8.Param.items[i].Status
  });
}
V8.FormEngine.UptTableData(uptList);
```

## 删除

```javascript
// 删除单条
var result = V8.FormEngine.DelFormData('SysUser', { Id: V8.Param.Id });

// 批量删除（传 Ids 数组）
var result = V8.FormEngine.DelFormData('SysUser', { Ids: V8.Param.Ids });

return { Code: result.Code, Msg: result.Code === 1 ? '删除成功' : result.Msg };
```

### 批量删除（跨表）

```javascript
var delList = [];
delList.push({ FormEngineKey: 'OrderDetail', Id: V8.Param.detailId });
delList.push({ FormEngineKey: 'OrderHeader', Id: V8.Param.orderId });
V8.FormEngine.DelTableData(delList);
```

## 按条件批量操作

```javascript
// 按条件更新
V8.FormEngine.UptFormDataByWhere('SysUser', {
  _Where: [['DeptId', '=', V8.Param.deptId]],
  Status: 0,
  _NoLineForAdd: true  // 可选：不存在时插入
});

// 按条件删除（不支持 _Where 以外的删除方式）
V8.FormEngine.DelFormDataByWhere('SysUser', {
  _Where: [['Status', '=', 0], ['AND', 'CreateTime', '<', '2024-01-01']]
});
```

## 事务处理

```javascript
// 接口引擎中 V8.Db 自动开启事务：
// 返回 Code=1 → 自动提交事务
// 返回 Code≠1 → 自动回滚事务
// 手动调用 V8.DbTrans.Commit() 或 Rollback() 无效，由平台统一管理

// FormEngine 可传入事务对象（第三个参数）
V8.FormEngine.AddFormData('Table1', { Name: '测试' }, V8.DbTrans);
V8.FormEngine.UptFormData('Table2', { Id: 'xxx', Status: 1 }, V8.DbTrans);

// 调用其他接口引擎也可共享事务
V8.ApiEngine.Run('other-engine-key', { Id: 'xxx' }, V8.DbTrans);
```

## 异步执行（不阻塞响应）

```javascript
// setTimeout：接口立即返回，后台继续执行
setTimeout(function() {
  V8.FormEngine.UptFormData('Order', { Id: V8.Param.id, SyncStatus: 'done' });
  V8.Http.Post({ Url: 'https://other.com/notify', PostParam: {} });
}, 100);

return { Code: 1, Msg: '已接收，后台处理中' };
```

> 长任务（>30s）应改用 MQ 消费者模式，见 `v8-mq-mqtt/SKILL.md`

## 动态加字段（运行时改表结构）

```javascript
V8.FormEngine.AddField({
  TableName: 'diy_test',
  Name: 'Age',
  Type: 'int',          // varchar / nvarchar / int / decimal / datetime / text
  Label: '年龄',
  Component: 'NumberText',
  TableWidth: '100',
  Visible: 1
});
```

> 风险：会执行 DDL（ALTER TABLE）。仅在低代码自定义配置场景使用，业务运行时**不要**频繁调用。

## 旧版 _Where 兼容

```javascript
// 老版本前端 / 老接口可能传旧格式 _Where：[{ Name, Value, Type, AndOr, Group }, ...]
// 转换成新格式：
var newWhere = V8.Method.ParseWhere(V8.Param._Where);
V8.FormEngine.GetTableData('Table', { _Where: newWhere });
```

## _Where 条件语法速查

```javascript
// 等于
[['Field', '=', value]]

// 模糊查询
[['Name', 'Like', '张']]      // %张%
[['Name', 'StartLike', '张']] // 张%
[['Name', 'EndLike', '三']]   // %三

// AND / OR
[['A', '=', 1], ['AND', 'B', '>', 10]]
[['A', '=', 1], ['OR', 'B', '=', 2]]

// IN / NotIn
[['Id', 'In', ['id1', 'id2', 'id3']]]
[['Status', 'NotIn', [0, -1]]]

// NULL
[['Field', '=', null]]    // IS NULL
[['Field', '<>', null]]   // IS NOT NULL

// 分组（括号）
[['Name', 'Like', '张'], ['AND', '(', 'Age', '>', 18], ['OR', 'Status', '=', 1, ')']]

// 日期范围
[['CreateTime', '>=', '2024-01-01'], ['AND', 'CreateTime', '<', '2024-02-01']]
```

**支持的操作符：** `=`, `==`, `<>`, `!=`, `>`, `>=`, `<`, `<=`, `Like`, `NotLike`, `StartLike`, `EndLike`, `In`, `NotIn`

## FormEngine 优先原则

**在接口引擎中，所有增删改操作必须优先使用 `V8.FormEngine` 方法，而不是 `V8.Db.FromSql` 写 SQL DML。**

| 场景 | 推荐写法 |
|------|---------|
| 插入一条记录 | `V8.FormEngine.AddFormData` |
| 按 Id 更新 | `V8.FormEngine.UptFormData`（必须传 `Id`） |
| 按条件批量更新 | `V8.FormEngine.UptFormDataByWhere` |
| 删除 | `V8.FormEngine.DelFormData` / `DelFormDataByWhere` |
| 查询单条 | `V8.FormEngine.GetFormData` |
| 查询列表 | `V8.FormEngine.GetTableData`（含分页、过滤、排序） |

`V8.Db.FromSql` **仅**用于以下场景：
- 多表 JOIN、复杂子查询、GROUP BY 聚合
- 动态建表 / ALTER TABLE（DDL）
- 纯只读报表/统计（建议用 `V8.DbRead`）

> **⚠️ Jint 多参数 interop 警告：** `V8.Db.FromSql(sql, p0, p1, p2)` 传入 **3 个及以上**位置参数时（即 SQL + 3+ 值），Jint 会因 .NET 重载解析失败抛出
> `No public methods with the specified arguments were found` 错误。
> 如果必须用原生 SQL，请改用具名参数（`AddInParameter`）形式，或将参数减少到 2 个以内；
> 但最佳实践是换用 `V8.FormEngine.UptFormDataByWhere` / `UptFormData` 来避免该问题。

```javascript
// ❌ 错误：3个以上位置参数，Jint 报 interop 错误
V8.Db.FromSql("UPDATE t SET A=@p0, B=@p1 WHERE Id=@p2", val1, val2, id).ExecuteNonQuery();

// ✅ 正确：改用 FormEngine（优先）
V8.FormEngine.UptFormData('t', { Id: id, A: val1, B: val2 });

// ✅ 也可用 AddInParameter 链式方式（需用 FormEngine 无法表达时）
V8.Db.FromSql("UPDATE t SET A=?a, B=?b WHERE Id=?id")
     .AddInParameter("?a", val1)
     .AddInParameter("?b", val2)
     .AddInParameter("?id", id)
     .ExecuteNonQuery();
```

## 注意事项

- `_Where` 是参数化查询，自动防 SQL 注入，**不要拼接 SQL 字符串**
- `AddFormData` 不需要传 `Id`，后端自动生成 GUID
- `UptFormData` 必须包含 `Id` 字段
- 如需触发表单 V8 事件，在参数中加 `_InvokeType: 'Client'`
- 返回值中 `Code: 1` 表示成功，`Code: 0` 表示失败，`Code: 2` 表示数据不存在
- 分页参数使用 `_PageIndex` 和 `_PageSize`（带下划线前缀）
- 列表返回总数字段为 `result.DataCount`（非 Total）
