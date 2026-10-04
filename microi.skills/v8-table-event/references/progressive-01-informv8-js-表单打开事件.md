# v8-table-event 详细参考 1

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=v8-table-event-005 sha256=e4b6982f63971cf590b635f89643ba437bfd714cb78fe5d9690d43100e07c2c1 -->
## InFormV8.js — 表单打开事件

```javascript
// 新增时设置默认值
if (V8.FormMode === 'Add') {
  V8.FormSet('Status', 1);
  V8.FormSet('CreateTime', DateNow('yyyy-MM-dd HH:mm:ss'));
  V8.FormSet('CreatorId', V8.CurrentUser.Id);
  V8.FormSet('CreatorName', V8.CurrentUser.Name);
}

// 编辑时禁用某些字段
if (V8.FormMode === 'Edit') {
  V8.FieldSet('Account', 'Readonly', true);  // 账号不可修改
}

// 查看模式隐藏操作按钮
if (V8.FormMode === 'View') {
  V8.HideFormBtn('Save');
}

// 根据角色控制字段可见性
if (V8.CurrentUser.RoleName.indexOf('管理员') === -1) {
  V8.FieldSet('AuditField', 'Visible', false);
}
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-table-event-006 sha256=961c57d02a597e26abddc7c4d3b9f8f2f0b1f4ba6f8164ee3bbe7800bd78804b -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-table-event-007 sha256=e074fbd1736d4a80e58c4b4c06338a40b5f8f89045eddf0d09f325ff1d48a7d4 -->
## SubmitBeforeServerV8.js — 服务端提交前

```javascript
// V8.Form 是即将写入数据库的数据
// V8.OldForm 是修改前的旧数据（仅更新时有值）
// V8.FormSubmitAction：'Insert' / 'Update' / 'Delete'

// 新增时：自动填充审计字段
if (V8.FormSubmitAction === 'Insert') {
  V8.Form.CreateTime = DateNow('yyyy-MM-dd HH:mm:ss');
  V8.Form.CreateUserId = V8.CurrentUser.Id;
}

// 更新时：记录修改人
if (V8.FormSubmitAction === 'Update') {
  V8.Form.UpdateTime = DateNow('yyyy-MM-dd HH:mm:ss');
  V8.Form.UpdateUserId = V8.CurrentUser.Id;
}

// 删除时：校验是否允许删除
if (V8.FormSubmitAction === 'Delete') {
  var related = V8.FormEngine.GetTableDataCount('OrderDetail', {
    _Where: [['OrderId', '=', V8.Form.Id]]
  });
  if (related.DataCount > 0) {
    return { Code: 0, Msg: '该订单下有明细数据，不允许删除' };
  }
}

// 唯一性校验
if (V8.FormSubmitAction === 'Insert' || V8.FormSubmitAction === 'Update') {
  var where = [['Code', '=', V8.Form.Code]];
  if (V8.FormSubmitAction === 'Update') {
    where.push(['AND', 'Id', '<>', V8.Form.Id]);
  }
  var exist = V8.FormEngine.GetFormData('Product', { _Where: where });
  if (exist.Code === 1 && exist.Data) {
    return { Code: 0, Msg: '编码已存在' };
  }
}

// 返回 { Code: 0, Msg: '...' } 阻止提交并自动回滚事务
// 无需手动调用 V8.DbTrans.Rollback()
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-table-event-008 sha256=d013a6f8b5cc1c114e7563fc98322ea6fa5ffce93e10d6bdf489c82344985082 -->
## SubmitAfterServerV8.js — 服务端提交后

```javascript
// 此时数据已成功写入数据库（仍在事务中）
// 返回 { Code: 0 } 仍可回滚事务

// 新增后：自动创建关联数据。保持默认 Server 调用，不触发目标表事件
if (V8.FormSubmitAction === 'Insert') {
  V8.FormEngine.AddFormData('UserProfile', {
    UserId: V8.Form.Id,
    NickName: V8.Form.Name
  }, V8.DbTrans);
}

// 更新后：同步更新其它表的冗余字段
if (V8.FormSubmitAction === 'Update') {
  if (V8.OldForm.Name !== V8.Form.Name) {
    V8.FormEngine.UptFormDataByWhere('OrderHeader', {
      _Where: [['CustomerId', '=', V8.Form.Id]],
      CustomerName: V8.Form.Name
    });
  }
}

// 通知（调用其他接口引擎，可共享事务）
V8.ApiEngine.Run('send-notification', {
  userId: V8.Form.Id,
  type: V8.FormSubmitAction
}, V8.DbTrans);

// 记录操作日志
V8.Method.AddSysLog({
  Title: V8.FormSubmitAction + ' ' + V8.TableModel.Name,
  Content: JSON.stringify({ Id: V8.Form.Id }),
  Type: '业务日志'
});
```

`SubmitAfterServerV8` 的“After”仍是“写入后、提交前”。需要在事务真正提交后才发布的缓存版本、跨节点通知等副作用，不能直接在事件中执行。平台为 `microi_database` 提供专用 `V8.Method.RefreshExtensionDatabases()`：事件调用时只登记提交后回调，提交成功才递增当前租户共享 Redis 版本，回滚时自动丢弃。普通业务的外部消息仍优先使用同事务 outbox，不能把任意不可撤销副作用都塞进内存回调。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-table-event-009 sha256=406c88d14167773a0d7597d4b622f9a53c2046f4d4cfd740cfb5addd13f80434 -->
## DataFilterV8.js — 服务端数据处理事件

获取列表/表单数据后，每行数据都会执行一次此事件。

```javascript
// V8.RowIndex — 当前行索引（从 0 开始）
// V8.Form — 当前行数据
// V8.NotSaveField — 指定哪些字段编辑时不保存（数组）
// V8.CacheData — 用于缓存数据，避免每行重复查询

// 补充计算字段
V8.Form.TotalPrice = V8.Form.Price * V8.Form.Quantity;

// 指定某些字段不保存（仅在编辑表单时有效）
V8.NotSaveField = ['TotalPrice', 'CompanyName'];

// 使用 CacheData 避免 N+1 查询
if (!V8.CacheData.deptMap) {
  var depts = V8.FormEngine.GetTableData('Department', {});
  var map = {};
  for (var i = 0; i < depts.Data.length; i++) {
    map[depts.Data[i].Id] = depts.Data[i].Name;
  }
  V8.CacheData.deptMap = map;
}
V8.Form.DeptName = V8.CacheData.deptMap[V8.Form.DeptId] || '';

// 数据脱敏
if (V8.Form.Phone) {
  V8.Form.Phone = V8.Form.Phone.substring(0, 3) + '****' + V8.Form.Phone.substring(7);
}
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-table-event-010 sha256=e41feb40c52d46b7df9c18bf19fe3800194bbc92ce7415864529c69e09b335bc -->
## 事件上下文变量

### 前端事件

| 变量 | 说明 | 可用事件 |
|------|------|---------|
| `V8.Form` | 当前表单数据；原生新增提交前可能没有 Id，依赖真实主键的跨表写入在提交后事件执行 | 全部 |
| `V8.OldForm` | 已加载的修改前旧数据 | 普通表单；提交前/后 |
| `V8.FormMode` | `'Add'` / `'Edit'` / `'View'` | 全部 |
| `V8.FormOutAction` | `'Insert'`/`'Update'`/`'Close'`/`'Delete'` | FormOut |
| `V8.FormSubmitAction` | `'Insert'` / `'Update'` / `'Delete'` | SubmitBefore |
| `V8.EventName` | 当前事件名 | 全部 |
| `V8.CurrentUser` | 当前用户 | 全部 |
| `V8.TableId` / `V8.TableName` | 当前表 Id / Name | 全部 |
| `V8.SelectedData` / `V8.TableRowSelected` | 选中的行数组 | 列表/批量按钮 |
| `V8.CurrentTableData` | 当前表当页数据 | 全部 |
| `V8.ClientType` | `'PC'`/`'IOS'`/`'Android'`/`'H5'`/`'WeChat'` | 全部 |
| `V8.ThisValue` | 当前字段新值：可能是对象、原始值或行内 `{New,Old}` | FieldValueChange |
| `V8.OldValue` | 当前字段旧值，仅行内编辑可靠 | 表格行内 FieldValueChange |
| `V8.KeyCode` | 键盘事件的键码 | FieldOnKeyup |
| `V8.Event` | 原生事件；键盘事件目前不提供 | FieldSlotButtonClick 等显式事件 |
| `V8.ParentV8` | 子表中访问父表 V8 对象 | 子表事件 |

### 后端事件

| 变量 | 说明 | 可用事件 |
|------|------|---------|
| `V8.Form` | 当前表单/行数据 | 全部 |
| `V8.OldForm` | 提交前旧数据 | SubmitBefore/After |
| `V8.FormSubmitAction` | `'Insert'`/`'Update'`/`'Delete'` | SubmitBefore/After |
| `V8.TableModel` | 表模型（Id, Name 等） | SubmitBefore/After |
| `V8.EventName` | 当前事件名 | 全部 |
| `V8.InvokeType` | `'Server'`/`'Client'` | 全部 |
| `V8.CurrentUser` | 当前用户 | 全部 |
| `V8.RowIndex` | 行索引（从 0） | DataFilter |
| `V8.NotSaveField` | 不保存的字段（数组，可写） | DataFilter |
| `V8.CacheData` | 缓存数据（避免 N+1，可写） | DataFilter |

<!-- /microi-progressive:chunk -->
