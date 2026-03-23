# Microi V8 表单事件开发

你正在开发 Microi 吾码平台的 V8 表单事件。事件绑定在表单引擎的表上，在数据操作的不同阶段自动触发。

## 事件类型

| 事件 | 运行端 | 触发时机 | 用途 |
|------|--------|---------|------|
| `InFormV8.js` | **前端** | 表单打开时 | 初始化字段显隐、默认值 |
| `OutFormV8.js` | **前端** | 表单关闭后 | 刷新列表、跳转 |
| `SubmitFormV8.js` | **前端** | 表单提交时 | 前端校验、数据预处理 |
| `SubmitBeforeServerV8.js` | **后端** | 数据写入 DB 之前 | 服务端校验、数据加工、审批 |
| `SubmitAfterServerV8.js` | **后端** | 数据写入 DB 之后 | 触发通知、同步其它表、日志 |

## 前端事件特有 API

```javascript
// 设置字段值
V8.FormSet('FieldName', 'value');

// 设置字段属性
V8.FieldSet('FieldName', 'Visible', false);     // 隐藏字段
V8.FieldSet('FieldName', 'Disabled', true);      // 禁用字段
V8.FieldSet('FieldName', 'Required', true);      // 必填

// 前端提示
V8.Tips('操作成功', true);   // 成功提示
V8.Tips('操作失败', false);  // 错误提示

// 前端 HTTP 请求
V8.Post('/api/xxx', { key: 'value' }, function(res) {
  // res 是接口返回数据
});

// 当前操作类型
V8.FormOutAction  // 'Add' | 'Update' | 'Delete'
```

## InFormV8.js — 表单打开事件

```javascript
// 新增时设置默认值
if (V8.FormOutAction === 'Add') {
  V8.FormSet('Status', 1);
  V8.FormSet('CreateTime', DateNow('yyyy-MM-dd HH:mm:ss'));
  V8.FormSet('CreatorId', V8.CurrentUser.Id);
  V8.FormSet('CreatorName', V8.CurrentUser.Name);
}

// 编辑时隐藏某些字段
if (V8.FormOutAction === 'Update') {
  V8.FieldSet('Account', 'Disabled', true);  // 账号不可修改
}

// 根据角色控制字段可见性
if (V8.CurrentUser.RoleName.indexOf('管理员') === -1) {
  V8.FieldSet('AuditField', 'Visible', false);
}
```

## SubmitFormV8.js — 前端提交校验

```javascript
// 自定义校验
var phone = V8.Form.Phone;
if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
  V8.Tips('手机号格式不正确', false);
  return false;  // 返回 false 阻止提交
}

// 业务逻辑校验
if (V8.Form.StartDate > V8.Form.EndDate) {
  V8.Tips('开始日期不能大于结束日期', false);
  return false;
}
```

## SubmitBeforeServerV8.js — 服务端提交前

```javascript
// V8.Form 是即将写入数据库的数据
// V8.OldForm 是修改前的旧数据（仅更新时有值）
// V8.FormSubmitAction 是 'Add' / 'Upt' / 'Del'

// 新增时：自动填充审计字段
if (V8.FormSubmitAction === 'Add') {
  V8.Form.CreateTime = DateNow('yyyy-MM-dd HH:mm:ss');
  V8.Form.CreateUserId = V8.CurrentUser.Id;
}

// 更新时：记录修改人
if (V8.FormSubmitAction === 'Upt') {
  V8.Form.UpdateTime = DateNow('yyyy-MM-dd HH:mm:ss');
  V8.Form.UpdateUserId = V8.CurrentUser.Id;
}

// 删除时：校验是否允许删除
if (V8.FormSubmitAction === 'Del') {
  var related = V8.FormEngine.GetTableDataCount('OrderDetail', {
    _Where: [['OrderId', '=', V8.Form.Id]]
  });
  if (related.Data > 0) {
    return { Code: 0, Msg: '该订单下有明细数据，不允许删除' };
  }
}

// 唯一性校验
if (V8.FormSubmitAction === 'Add' || V8.FormSubmitAction === 'Upt') {
  var where = [['Code', '=', V8.Form.Code]];
  if (V8.FormSubmitAction === 'Upt') {
    where.push(['AND', 'Id', '<>', V8.Form.Id]);
  }
  var exist = V8.FormEngine.GetFormData('Product', { _Where: where });
  if (exist.Code === 1 && exist.Data) {
    return { Code: 0, Msg: '编码已存在' };
  }
}
```

## SubmitAfterServerV8.js — 服务端提交后

```javascript
// 此时数据已成功写入数据库
// V8.Form 是最终写入的数据

// 新增后：自动创建关联数据
if (V8.FormSubmitAction === 'Add') {
  V8.FormEngine.AddFormData('UserProfile', {
    UserId: V8.Form.Id,
    NickName: V8.Form.Name,
    CreateTime: DateNow('yyyy-MM-dd HH:mm:ss')
  });
}

// 更新后：同步更新其它表的冗余字段
if (V8.FormSubmitAction === 'Upt') {
  if (V8.OldForm.Name !== V8.Form.Name) {
    V8.FormEngine.UptFormDataByWhere('OrderHeader', {
      _Where: [['CustomerId', '=', V8.Form.Id]],
      CustomerName: V8.Form.Name
    });
  }
}

// 通知（调用其他接口引擎）
V8.ApiEngine.Run('send-notification', {
  userId: V8.Form.Id,
  type: V8.FormSubmitAction,
  tableName: V8.TableModel.Name
});

// 记录操作日志
V8.Method.AddSysLog(
  V8.FormSubmitAction + ' ' + V8.TableModel.Name,
  JSON.stringify({ Id: V8.Form.Id, Action: V8.FormSubmitAction }),
  '业务日志'
);
```

## 事件上下文变量

| 变量 | 说明 | 可用事件 |
|------|------|---------|
| `V8.Form` | 当前表单数据 | 全部 |
| `V8.OldForm` | 提交前旧数据 | SubmitBefore/After |
| `V8.FormSubmitAction` | `'Add'` / `'Upt'` / `'Del'` | SubmitBefore/After |
| `V8.TableModel` | 表模型（Name, Description 等） | SubmitBefore/After |
| `V8.TableData` | 关联表格数据 | SubmitBefore/After |
| `V8.EventName` | 当前事件名 | 全部 |
| `V8.CurrentUser` | 当前用户 | 全部 |

## 注意事项

- 前端事件可使用 `window` 对象，后端事件不可以
- `SubmitBeforeServerV8.js` 返回 `{ Code: 0, Msg: '...' }` 可阻止数据写入
- 直接修改 `V8.Form` 的字段值即可改变最终写入的数据
- 后端事件中使用 `V8.FormEngine` 操作数据时，加 `_InvokeType: 'Client'` 避免递归触发事件
