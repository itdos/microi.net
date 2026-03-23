# Microi V8 CRUD API 接口引擎开发

你正在开发 Microi 吾码平台的 V8 接口引擎。接口引擎是运行在服务端的 JavaScript 函数，通过 `V8.FormEngine` 操作数据库，通过 `V8.Result` 或 `return` 返回结果。

## 核心规则

- 接口引擎文件是纯 JavaScript（Jint 引擎，非 Node.js）
- 全局对象 `V8` 是所有后端能力的入口
- 通过 `V8.Param` 获取前端传入的参数
- 通过 `V8.CurrentUser` 获取当前登录用户信息
- 返回结果统一格式：`{ Code: 1, Data: any, Msg: '成功' }`

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
  PageIndex: V8.Param.pageIndex || 1,
  PageSize: V8.Param.pageSize || 20
});

return { Code: 1, Data: result.Data, Total: result.Total, Msg: '成功' };
```

## 查询单条

```javascript
if (!V8.Param.id) {
  return { Code: 0, Msg: 'id 不能为空' };
}

var result = V8.FormEngine.GetFormData('SysUser', {
  _Where: [['Id', '=', V8.Param.id]]
});

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
  Account: V8.Param.Account,
  Name: V8.Param.Name,
  Phone: V8.Param.Phone || '',
  Status: 1,
  CreateTime: DateNow('yyyy-MM-dd HH:mm:ss'),
  CreateUserId: V8.CurrentUser.Id
});

return { Code: result.Code, Data: result.Data, Msg: result.Code === 1 ? '新增成功' : result.Msg };
```

## 更新

```javascript
if (!V8.Param.Id) {
  return { Code: 0, Msg: 'Id 不能为空' };
}

var result = V8.FormEngine.UptFormData('SysUser', {
  Id: V8.Param.Id,
  Name: V8.Param.Name,
  Phone: V8.Param.Phone,
  UpdateTime: DateNow('yyyy-MM-dd HH:mm:ss'),
  UpdateUserId: V8.CurrentUser.Id
});

return { Code: result.Code, Msg: result.Code === 1 ? '更新成功' : result.Msg };
```

## 删除

```javascript
if (!V8.Param.Id) {
  return { Code: 0, Msg: 'Id 不能为空' };
}

var result = V8.FormEngine.DelFormData('SysUser', {
  Id: V8.Param.Id
});

return { Code: result.Code, Msg: result.Code === 1 ? '删除成功' : result.Msg };
```

## 按条件批量操作

```javascript
// 按条件更新
V8.FormEngine.UptFormDataByWhere('SysUser', {
  _Where: [['DeptId', '=', V8.Param.deptId]],
  Status: 0
});

// 按条件删除
V8.FormEngine.DelFormDataByWhere('SysUser', {
  _Where: [['Status', '=', 0], ['AND', 'CreateTime', '<', '2024-01-01']]
});
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

// IN
[['Id', 'In', ['id1', 'id2', 'id3']]]

// NULL
[['Field', '=', null]]    // IS NULL
[['Field', '<>', null]]   // IS NOT NULL

// 分组（括号）
[['Name', 'Like', '张'], ['AND', '(', 'Age', '>', 18], ['OR', 'Status', '=', 1, ')']]
```

## 注意事项

- `_Where` 是参数化查询，自动防 SQL 注入，不要拼接 SQL 字符串
- `AddFormData` 不需要传 `Id`，后端自动生成
- `UptFormData` 必须包含 `Id` 字段
- 如需跳过 V8 事件直接操作数据，在参数中加 `_InvokeType: 'Client'`
- 返回值中 `Code: 1` 表示成功，其他值表示失败
