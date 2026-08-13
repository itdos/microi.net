# v8-crud-api 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-crud-api-007 sha256=9b2d8de72a10d57a8c969f8b176ebd9892c5810d66ed977d856f294fe4743e0b -->
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

return { Code: 1, Data: result.Data, DataCount: result.DataCount, Msg: '成功' };
```

### 请求内异步查询

后端接口引擎可在本次请求内使用真实异步查询；前端 V8 不使用这个方法名：

```javascript
var result = await V8.FormEngine.GetTableDataAsync('SysUser', {
  _Where: [['Status', '=', 1]],
  _SelectFields: ['Id', 'Account', 'Name'],
  _PageIndex: 1,
  _PageSize: 20
});

return { Code: 1, Data: result.Data, DataCount: result.DataCount };
```

必须 `await` 结果。需要接口先返回、后续再批量处理时，应改用平台后台任务、Job、MQ 或 outbox，而不是丢弃 Promise。

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

匿名新增的公开入口是
`POST /api/formengine/AddFormDataAnonymous`，且目标表必须显式允许匿名新增。
当前后端 `V8.FormEngine` 接口不公开
`V8.FormEngine.AddFormDataAnonymous`；接口引擎内部仍使用
`V8.FormEngine.AddFormData(...)` 并遵守可信执行身份。不要仅因为历史文档出现
该名称就为匿名业务接口关闭服务端校验。

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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-008 sha256=f7141662789ec6013eb3a7723d9c76449f3ef705e76c694e0fa6b1a065869f6a -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-009 sha256=b4c668215e95f9c25b0581251b5ba0a3ac52ac30a5deed994383d22334c3f484 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-010 sha256=62326b11ca42eb72bddd7e9e72974aa6b1e36f3a85c10ac19e677fed197b03ec -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-011 sha256=26127cc70449e261cd49bf5925419f637dae200e7a1ef01bb2385d3197d2e2a9 -->
## 事务处理

```javascript
// 接口引擎中 V8.Db 自动开启事务：
// 返回DosResult/带Code对象：仅Code=1提交，其他值回滚
// 返回对象但没有Code：回滚
// 返回字符串/数字/数组/布尔/null且未异常：提交
// 手动调用 V8.DbTrans.Commit() 或 Rollback() 无效，由平台统一管理

// FormEngine 可传入事务对象（第三个参数）
V8.FormEngine.AddFormData('Table1', { Name: '测试' }, V8.DbTrans);
V8.FormEngine.UptFormData('Table2', { Id: 'xxx', Status: 1 }, V8.DbTrans);

// 调用其他接口引擎也可共享事务
V8.ApiEngine.Run('other-engine-key', { Id: 'xxx' }, V8.DbTrans);
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-012 sha256=ea59e9c92b84986701a412f53a907fb2243bc7698422c1361d82280d1e4a3e4f -->
## 请求内异步与后台处理

```javascript
// 本次请求必须拿到结果时，使用真实Async API并await
var resp = await V8.Http.PostResponseAsync({
  Url: 'https://other.com/notify',
  PostParam: { Id: V8.Param.id },
  Timeout: 10
});
return resp.StatusCode >= 200 && resp.StatusCode < 300
  ? { Code: 1 }
  : { Code: 0, Msg: '通知失败' };
```

禁止用 `setTimeout` / `Task.Run` 实现“立即返回、后台继续”：接口返回后 Jint Engine、租户上下文、事务和执行租约会释放。脱离请求的任务使用后台任务、Job、MQ 或 outbox，并按 `EventId` 幂等处理与恢复。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-013 sha256=d4d96c1d82d1fba71100919ff7b0d48441610fdef4602097723cffdcdaaeebf4 -->
## 动态加字段（运行时改表结构）

```javascript
V8.FormEngine.AddField({
  TableName: 'diy_test',
  Name: 'Age',
  Type: 'int',          // 仅使用平台允许的varchar(N)/mediumtext/longtext/int/bigint/decimal(18,N)
  Label: '年龄',
  Component: 'NumberText',
  TableWidth: '100',
  Visible: 1
});
```

> 风险：会执行 DDL（ALTER TABLE）。仅在低代码自定义配置场景使用，业务运行时**不要**频繁调用。

日期时间字段统一使用 `varchar(25)` 保存 `yyyy-MM-dd HH:mm:ss`，组件使用 `DateTime`。禁止 `datetime/date/timestamp/float/double/boolean/string/text/nvarchar` 等平台不允许的物理类型。动态表/字段属于控制面能力，只允许 `Level >= 9999` 的可信管理脚本使用。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-crud-api-014 sha256=42b43027eb510916aed85a3a21ea8a1c1c7697581ac8c48863e8ba8d0c793784 -->
## 旧版 _Where 兼容

```javascript
// 老版本前端 / 老接口可能传旧格式 _Where：[{ Name, Value, Type, AndOr, Group }, ...]
// 转换成新格式：
var newWhere = V8.Method.ParseWhere(V8.Param._Where);
V8.FormEngine.GetTableData('Table', { _Where: newWhere });
```

<!-- /microi-progressive:chunk -->
