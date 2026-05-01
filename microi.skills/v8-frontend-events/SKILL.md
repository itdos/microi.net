# Microi V8 前端事件大全

你正在为 Microi 吾码平台编写 **前端 V8 事件** 代码。前端事件运行在浏览器，通过 `V8.EventName` 区分事件类型，可访问表单/列表/弹窗等丰富的客户端 API。

> **表单生命周期事件**（InFormV8、SubmitFormV8、SubmitBeforeServerV8、SubmitAfterServerV8、OutFormV8、DataFilterV8）见 `v8-table-event/SKILL.md`。  
> **菜单按钮事件**（MoreBtns/FormBtns 等）见 `v8-menu-buttons/SKILL.md`。  
> 本文重点是 **字段事件、按钮事件、列表事件、模板引擎、其它前端钩子**。

## 字段事件（在【字段属性】中配置）

### FieldValueChange — 值变更事件（最常用）

```javascript
// V8.EventName === 'FieldValueChange'
// V8.ThisValue   — 当前字段新值
// V8.OldValue    — 当前字段旧值
// V8.Form        — 整个表单数据
// V8.FormMode    — 'Add' / 'Edit' / 'View'
// V8.LoadMode    — 'Design' 表示设计器中，'View' 是真实表单

// ★ 关键：设计模式下不要执行业务逻辑（防止设计器卡顿）
if (V8.LoadMode === 'Design') return;

// 选择部门 → 联动加载该部门下的人员到 联系人 控件
var deptId = V8.ThisValue && V8.ThisValue.Id;
if (deptId) {
  var users = await V8.FormEngine.GetTableData('sys_user', {
    _SelectFields: ['Id', 'Name', 'Account'],
    _Where: [['DeptId', '=', deptId]]
  });
  V8.FieldSet('Contact', 'Data', users.Code === 1 ? users.Data : []);
} else {
  V8.FieldSet('Contact', 'Data', []);
}

// 联动设置另一字段值
V8.FormSet('CustomerName', V8.ThisValue.Name);

// 联动显隐
V8.FieldSet('TaxNo', 'Visible', V8.ThisValue === '企业');

// 联动必填
V8.FieldSet('Reason', 'Required', V8.ThisValue === '退款');
```

### FieldOnKeyup — 键盘抬起事件

```javascript
// V8.EventName === 'FieldOnKeyup'
// V8.Event       — 原生 KeyboardEvent
// V8.ThisValue   — 当前输入值

if (V8.Event.key === 'Enter') {
  V8.FormSubmit({ CloseForm: false });
}
```

### FieldOnBlur — 失焦事件

```javascript
// 失焦校验手机号
if (V8.ThisValue && !/^1[3-9]\d{9}$/.test(V8.ThisValue)) {
  V8.Tips('手机号格式不正确', false);
  V8.FieldSet('Phone', 'Value', '');
}
```

## 按钮事件

### V8BtnRun — 按钮点击执行（菜单按钮、表单按钮）

```javascript
// V8.Form        — 当前行/表单数据
// V8.FormMode    — Add / Edit / View
// V8.TableId     — 当前 diy_table 的 Id
// V8.TableRowSelected — 批量按钮中选中的行数组
// V8.ClientType  — 'PC' / 'App' / 'Wechat'

V8.ConfirmTips('确认审核通过？', function() {
  V8.ApiEngine.Run({
    ApiEngineKey: 'order_approve',
    Id: V8.Form.Id
  }, function(r) {
    if (r.Code === 1) { V8.Tips('审核成功', true); V8.RefreshTable({ _PageIndex: 1 }); }
    else V8.Tips(r.Msg || '失败', false);
  });
});
```

### V8BtnLimit — 按钮显隐（V8CodeShow）

```javascript
// 必须给 V8.Result 赋 boolean
if (V8.Form.Status === '待审核' && V8.CurrentUser.RoleName.indexOf('审批员') !== -1) {
  V8.Result = true;
} else {
  V8.Result = false;
}
```

## 列表事件

### TableRowClick — 行点击

```javascript
// V8.Form === 被点击的行
console.log('点击行：', V8.Form.Id);
// 自定义跳转
V8.OpenAnyForm({ TableName: 'OrderDetail', Id: V8.Form.Id, FormMode: 'View' });
```

### OpenTableBefore — 打开列表前（拦截/初始化筛选）

```javascript
// 默认只看自己的数据
V8.SearchSet({ OwnerId: V8.CurrentUser.Id });
```

### OpenTableSubmit — 列表查询提交前（追加条件）

```javascript
// V8.Param 是即将发起查询的参数
V8.Param._Where = V8.Param._Where || [];
V8.Param._Where.push(['DeptId', '=', V8.CurrentUser.DeptId]);
```

### PageTab — 页签切换

```javascript
// PageTab："待办"
V8.SearchSet({ Status: '待办' });
V8.RefreshTable({ _PageIndex: 1 });
```

## 模板引擎事件

`TableTemplateEngine` / `FormTemplateEngine` — 见 `v8-template-engine/SKILL.md`。

## 工作流事件（前端）

`WFNodeEnd` — 流程节点结束后前端通知。详见 `v8-workflow/SKILL.md`。

## 常用前端 API

| API | 说明 |
|-----|------|
| `V8.Tips(msg, ok?)` | 浮层提示。`ok=true` 绿色 |
| `V8.ConfirmTips(msg, cb)` | 确认弹窗 |
| `V8.FormSet(field, value)` | 设置表单字段值 |
| `V8.FieldSet(field, prop, value)` | 设置字段属性（Visible/Required/Disabled/Data） |
| `V8.FormSubmit({CloseForm:true})` | 提交当前表单 |
| `V8.RefreshTable({_PageIndex:1})` | 刷新表格（-1 保持当前页） |
| `V8.SearchSet({field: value})` | 设置筛选条件 |
| `V8.OpenAnyForm({...})` | 打开任意表单（弹窗/抽屉） |
| `V8.OpenAnyTable({...})` | 打开任意列表 |
| `V8.OpenDialog({...})` | 打开自定义弹窗 |
| `V8.ApiEngine.Run({ApiEngineKey, ...})` | 调接口引擎（前端，参数对象格式） |
| `V8.FormEngine.GetTableData(name, params, cb)` | 前端查列表（参数对象、回调或 await） |
| `V8.Post(url, data, cb, errCb, headers, contentType)` | 通用 POST |

## 异步写法（async/await vs 回调）

```javascript
// ✅ 推荐 async/await
var r = await V8.FormEngine.GetTableData('Product', { _PageSize: 10 });
if (r.Code === 1) { /* ... */ }

// ✅ 也可回调式
V8.FormEngine.GetTableData('Product', { _PageSize: 10 }, function(r) {
  if (r.Code === 1) { /* ... */ }
});
```

## 死循环陷阱

❌ **禁止** 在 `SubmitFormV8.js` 里调用 `V8.FormSubmit()` —— 会无限递归
❌ **禁止** 在 `FieldValueChange` 里 `V8.FormSet(同字段)` —— 会循环触发自身
❌ **禁止** 在 `InFormV8.js` 里写大量同步 `V8.FormEngine.Get*` —— 阻塞渲染

## 设计模式保护（CRITICAL）

```javascript
// 任何前端字段事件都应在头部加这个判断！
if (V8.LoadMode === 'Design') return;
```
否则在【表单设计器】中编辑字段时，事件会被误触发，可能弹提示、报错或触发副作用。
