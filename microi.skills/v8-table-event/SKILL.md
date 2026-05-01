# Microi V8 表单事件开发

你正在开发 Microi 吾码平台的 V8 表单事件。事件绑定在表单引擎的表上，在数据操作的不同阶段自动触发。

## 事件类型

| 事件 | 运行端 | V8.EventName | 触发时机 | 用途 |
|------|--------|-------------|---------|------|
| `InFormV8.js` | **前端** | `FormIn` | 表单打开时 | 初始化字段显隐、默认值 |
| `SubmitFormV8.js` | **前端** | `FormSubmitBefore` | 表单提交时 | 前端校验、数据预处理 |
| `OutFormV8.js` | **前端** | `FormOut` | 表单提交后离开时 | 刷新列表、跳转 |
| `SubmitBeforeServerV8.js` | **后端** | `FormSubmitBefore` | 数据写入 DB 之前 | 服务端校验、数据加工 |
| `SubmitAfterServerV8.js` | **后端** | `FormSubmitAfter` | 数据写入 DB 之后 | 触发通知、同步其它表、日志 |
| `DataFilterV8.js` | **后端** | `DataFilter` | 获取列表/表单数据后 | 每行数据加工、脱敏、补充字段 |

## 事件触发规则

- 后端 V8 事件 / 接口引擎中调用 `V8.FormEngine` 增删改 → **不触发**表单 V8 事件
- 传入 `_InvokeType: 'Client'` → **触发**表单 V8 事件
- Postman 等直接调用接口 → 前端事件**不执行**，后端事件**仍执行**
- 服务器端提交前/后 V8 事件在**同一事务**中执行

## ⚠️ 关键陷阱（必读）

### 1. 设计模式保护（前端事件必加）

```javascript
// 防止【表单设计器】中编辑字段时误触发事件
if (V8.LoadMode === 'Design') return;
```

### 2. 死循环禁忌

- ❌ **禁止** 在 `SubmitFormV8.js` 中调 `V8.FormSubmit()` —— 无限递归
- ❌ **禁止** 在 `FieldValueChange` 中 `V8.FormSet(同字段, ...)` —— 循环触发
- ❌ **禁止** 在后端 `SubmitBeforeServerV8.js` 中再 `UptFormData(本表, V8.Form.Id)` 不加 `_InvokeType:'Server'` —— 表单事件递归

### 3. 阻止提交（后端）

后端事件返回 `{ Code: 0, Msg: '错误' }` 平台自动回滚事务并阻止提交：

```javascript
if (V8.Form.Money > 100000 && V8.CurrentUser.RoleName.indexOf('总经理') === -1) {
  return { Code: 0, Msg: '金额超过 10 万必须总经理提交' };
}
```

### 4. 共享事务操作其它表

```javascript
// 在 SubmitBeforeServerV8 / SubmitAfterServerV8 中
V8.FormEngine.UptFormData('OtherTable', { Id: 'x', Field: 'v' }, V8.DbTrans);
V8.ApiEngine.Run('other-engine', { Form: V8.Form }, V8.DbTrans);
// 不传 V8.DbTrans 会导致并行事务、可能死锁或脏读
```

### 5. 模板引擎与 DataFilterV8 的区别

- 数据**加工**（计算字段、脱敏、查关联表名）→ 用 `DataFilterV8`（后端，每行执行，可用 `V8.CacheData` 防 N+1）
- 数据**渲染**（颜色徽章、HTML、图片）→ 用【表格 V8 模板引擎】，详见 `v8-template-engine/SKILL.md`

---

## 前端事件特有 API

```javascript
// 设置字段值（触发值变更事件）
V8.FormSet('FieldName', 'value');
V8.FormSet('DropdownField', { Id: 1, Name: '选项' }); // 下拉框

// 设置字段属性
V8.FieldSet('FieldName', 'Visible', false);     // 隐藏字段
V8.FieldSet('FieldName', 'Readonly', true);      // 只读字段
V8.FieldSet('FieldName', 'Required', true);      // 必填
V8.FieldSet('FieldName', 'Data', [{Id:1, Name:'选项'}]); // 动态设置数据源

// 访问字段属性
var isReadonly = V8.Field.UserName.Readonly;
// 属性：Name, Label, Config, Data, Readonly, Visible, Placeholder 等

// 前端提示
V8.Tips('操作成功', true);    // 成功提示（1秒消失）
V8.Tips('操作失败', false);   // 错误提示（5秒消失）

// 确认框
V8.ConfirmTips('确定删除？', function() { /* 确定 */ }, function() { /* 取消 */ });

// 前端 HTTP 请求
V8.Post('/api/xxx', { key: 'value' }, function(res) { });
V8.Get('/api/xxx', {}, function(res) { });

// 前端调用接口引擎
var result = await V8.ApiEngine.Run('engineKey', { param1: 'value' });

// 当前表单模式
V8.FormMode      // 'Add' / 'Edit' / 'View'
V8.FormOutAction // 'Insert' / 'Update' / 'Close' / 'Delete'

// 刷新表格
V8.RefreshTable({ _PageIndex: 1 });  // -1 = 最后一页

// 表单操作
V8.FormSubmit({ CloseForm: true });   // 提交表单（不能在提交前事件中调用）
V8.FormClose();                        // 关闭表单
V8.ReloadForm({ Id: 'xxx' }, 'Edit'); // 重新加载

// 按钮和Tab控制
V8.HideFormBtn('Update');  // 隐藏按钮：'Delete' / 'Save' / 'Update'
V8.HideFormTab('tabName'); // 隐藏Tab
V8.ShowFormTab('tabName'); // 显示Tab
V8.ClickFormTab('tabName'); // 选中Tab
```

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

## SubmitAfterServerV8.js — 服务端提交后

```javascript
// 此时数据已成功写入数据库（仍在事务中）
// 返回 { Code: 0 } 仍可回滚事务

// 新增后：自动创建关联数据（使用 _InvokeType: 'Client' 避免递归）
if (V8.FormSubmitAction === 'Insert') {
  V8.FormEngine.AddFormData('UserProfile', {
    UserId: V8.Form.Id,
    NickName: V8.Form.Name,
    _InvokeType: 'Client'
  });
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

## 事件上下文变量

### 前端事件

| 变量 | 说明 | 可用事件 |
|------|------|---------|
| `V8.Form` | 当前表单数据（新增时也有 Id） | 全部 |
| `V8.OldForm` | 修改前旧数据 | 提交前/后 |
| `V8.FormMode` | `'Add'` / `'Edit'` / `'View'` | 全部 |
| `V8.FormOutAction` | `'Insert'`/`'Update'`/`'Close'`/`'Delete'` | FormOut |
| `V8.FormSubmitAction` | `'Insert'` / `'Update'` / `'Delete'` | SubmitBefore |
| `V8.EventName` | 当前事件名 | 全部 |
| `V8.CurrentUser` | 当前用户 | 全部 |
| `V8.TableId` / `V8.TableName` | 当前表 Id / Name | 全部 |
| `V8.SelectedData` | 选中的行数组 | 全部 |
| `V8.CurrentTableData` | 当前表当页数据 | 全部 |
| `V8.ClientType` | `'PC'`/`'IOS'`/`'Android'`/`'H5'`/`'WeChat'` | 全部 |
| `V8.ThisValue` | 下拉框选择后的值对象 | FieldValueChange |
| `V8.KeyCode` | 键盘事件的键码 | FieldOnKeyup |
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

## 前端事件名（V8.EventName 可能的值）

| 值 | 说明 |
|---|---|
| `FormIn` | 进入表单事件 |
| `FormSubmitBefore` | 提交前事件 |
| `FormOut` | 离开表单事件 |
| `FieldValueChange` | 字段值变更事件 |
| `FieldOnKeyup` | 文本框键盘事件 |
| `V8BtnRun` | V8 按钮执行事件 |
| `V8BtnLimit` | V8 按钮是否显示事件 |
| `BtnFormDetailRun` | 详情按钮 V8 按钮 |
| `TableRowClick` | 表格行点击 V8 事件 |
| `OpenTableBefore` | 弹出表格前事件 |
| `OpenTableSubmit` | 弹出表格提交事件 |
| `PageTab` | 多 Tab 页签 V8 事件 |
| `WFNodeStart` | 流程节点开始 V8 事件 |
| `WFNodeEnd` | 流程节点结束 V8 事件 |

## 注意事项

- 前端事件可使用 `window` 对象和 `async/await`，后端事件不可以
- 后端提交前/后事件返回 `{ Code: 0, Msg: '...' }` 可阻止数据写入并回滚事务
- 直接修改 `V8.Form` 的字段值即可改变最终写入的数据
- 后端事件中使用 `V8.FormEngine` 操作数据时，加 `_InvokeType: 'Client'` 避免递归触发事件
- `V8.FormSubmitAction` 的值是 `'Insert'`/`'Update'`/`'Delete'`（非 Add/Upt/Del）
- 在 DataFilterV8 中使用 `V8.CacheData` 缓存查询结果，避免每行执行 N+1 查询
