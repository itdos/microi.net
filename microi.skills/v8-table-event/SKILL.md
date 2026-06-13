---
name: v8-table-event
description: Microi V8 表单事件开发。用于编写 InFormV8、SubmitFormV8、SubmitBeforeServerV8、SubmitAfterServerV8、OutFormV8、DataFilterV8 和事务感知事件。
---

# Microi V8 表单事件开发

你正在开发 Microi 吾码平台的 V8 表单事件。事件绑定在表单引擎的表上，在数据操作的不同阶段自动触发。

## 本地优先与版本头（必做）

AI 本地开发表单 V8 事件时，优先修改 `microi-v8-engine/<租户>/<项目>/表单引擎/.../<EventType>.js` 本地文件，再通过 MCP 或 VS Code 插件同步到数据库。若插件显示“本地和远端不一致”，先读取本地与远端并合并有效差异，不能直接覆盖。

每一次修改、上传、推送 `InFormV8.js`、`SubmitFormV8.js`、`SubmitBeforeServerV8.js`、`SubmitAfterServerV8.js`、`OutFormV8.js`、`DataFilterV8.js` 等事件文件，都必须维护顶部版本区域。版本号从 `v1.0.0` 开始；每次上传/推送/修改递增 1；补丁位和次版本位最大为 9 并向前进位（`v1.0.9 -> v1.1.0`、`v1.9.9 -> v2.0.0`、`v9.9.9 -> v10.0.0`）。代码头只写完整功能说明，不写修改历史、时间戳或 ChangeLog。

```javascript
/*
 * V8 Event
 * TableKey: 示例表Key
 * EventType: SubmitBeforeServerV8
 * Version: v1.0.0
 * 功能说明：
 * - 完整说明该事件的触发时机、校验/加工逻辑、读写字段和阻止提交条件。
 */
```

同步流程：`读取远端 -> 修改本地并递增语义版本头 -> JS 语法检查 -> 保存远端 -> 回读远端确认版本头一致 -> 执行触发该事件的最小表单操作验证`。修改记录不得写进事件代码头；如果将来事件存储表增加 `Version`/`ChangeHistory` 字段，工具也必须按接口引擎同样规则兼容写入：最新说明拼接到最前面，并保留原有全部历史文字。

生成 V8 事件代码时，代码内容本身（文件头、普通注释、`console.log`、返回 `Msg` 等）不要包含 `Microi`、`吾码` 等平台品牌文字，除非业务数据或字段值本身必须如此。生成代码要有可维护注释：每个 `function` 前写清用途、关键参数和返回值；提交前校验、提交后联动、字段显隐、数据脱敏、跨表写入、复杂条件判断等代码段前写短注释说明业务原因；避免“给变量赋值”这类无信息量注释。

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
