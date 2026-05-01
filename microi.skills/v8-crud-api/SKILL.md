# Microi V8 CRUD API 接口引擎开发

你正在开发 Microi 吾码平台的 V8 接口引擎。接口引擎是运行在服务端的 JavaScript 函数，通过 `V8.FormEngine` 操作数据库，通过 `V8.Result` 或 `return` 返回结果。

## 核心规则

- 接口引擎文件是纯 JavaScript（Jint 引擎，非 Node.js）
- 全局对象 `V8` 是所有后端能力的入口
- 通过 `V8.Param` 获取前端传入的参数（URL参数 / form-data / payload-json）
- 通过 `V8.CurrentUser` 获取当前登录用户信息
- 返回结果统一格式：`{ Code: 1, Data: any, Msg: '成功' }`
- 所有 FormEngine 方法在服务器端支持第三个参数传入 `V8.DbTrans`（事务对象）
- 服务端调用 FormEngine 默认**不触发**表单 V8 事件，加 `_InvokeType: 'Client'` 才触发
- 接口内 `return Code=1` 自动提交事务、`Code≠1` 自动回滚事务，**禁止**手动 Commit/Rollback

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

## 注意事项

- `_Where` 是参数化查询，自动防 SQL 注入，**不要拼接 SQL 字符串**
- `AddFormData` 不需要传 `Id`，后端自动生成 GUID
- `UptFormData` 必须包含 `Id` 字段
- 如需触发表单 V8 事件，在参数中加 `_InvokeType: 'Client'`
- 返回值中 `Code: 1` 表示成功，`Code: 0` 表示失败，`Code: 2` 表示数据不存在
- 分页参数使用 `_PageIndex` 和 `_PageSize`（带下划线前缀）
- 列表返回总数字段为 `result.DataCount`（非 Total）
