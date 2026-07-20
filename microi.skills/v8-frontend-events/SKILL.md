---
name: v8-frontend-events
description: Microi 前端 V8 事件指南。用于编写浏览器端字段事件、按钮、列表事件、V8.EventName、V8.Form、动态显隐、校验和界面交互。
---

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

### FieldSlotButtonClick — 单行文本插槽按钮

单行文本 `Text` 开启【插槽按钮】后，必须在【插槽按钮V8代码】中配置行为，不要再写“弹出表格Id”。

```javascript
// V8.EventName === 'FieldSlotButtonClick'
// V8.ThisValue — 当前输入框值
// V8.Event     — 原生点击事件

if (V8.LoadMode === 'Design') return;

V8.OpenAnyTable({ TableName: 'sys_user', Title: '选择用户' });
// 或 V8.OpenAnyForm / V8.OpenAppDialog / V8.ApiEngine.Run 等任意前端 V8 能力
```

`ReadOnlyButton` 的产品文案是【禁用插槽按钮】：只控制按钮是否可点击，不等同于字段只读，应保留用于权限和状态控制。

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
// 推荐：直接 return boolean
return V8.Form.Status === '待审核' && V8.CurrentUser.RoleName.indexOf('审批员') !== -1;

// 兼容旧写法：V8.Result = true/false
// V8.Result = V8.Form.Status === '待审核';
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
| `V8.FormSet(field, value)` | 设置表单字段值并触发目标字段的值变更 V8；下拉框可传对象 |
| `V8.FieldSet(field, prop, value)` | 设置字段属性（Visible/Required/Disabled/Data） |
| `V8.FormSubmit({CloseForm:true})` | 提交当前表单 |
| `V8.RefreshTable({_PageIndex:1})` | 刷新表格（-1 保持当前页） |
| `V8.SearchSet({field: value})` | 设置筛选条件 |
| `V8.OpenAnyForm({...})` | 打开任意表单（弹窗/抽屉） |
| `V8.OpenAnyTable({...})` | 打开任意列表 |
| `V8.OpenDialog({...})` | 打开自定义弹窗 |
| `V8.OpenAppDialog({...})` | 按 AppKey 打开已发布在线微服务页面，支持 Dialog/Drawer 与结果回调 |
| `V8.ApiEngine.Run({ApiEngineKey, ...})` | 调接口引擎（前端，参数对象格式） |
| `V8.FormEngine.GetTableData(name, params, cb)` | 前端查列表（参数对象、回调或 await） |
| `V8.Post(url, data, cb, errCb, headers, contentType)` | 通用 POST |

### 在线微服务弹窗 V8.OpenAppDialog

复杂定制页面使用 `V8.OpenAppDialog`，不要在 V8 事件中内嵌大量 HTML/CSS：

```js
V8.OpenAppDialog({
  AppKey: 'customer_profile_editor',       // 必传：sys_microiservice.MsKey
  RoutePath: '/edit',                      // 可选，默认 /
  Version: '',                             // 可选，空值自动使用当前 BuildVersion
  Title: '编辑客户资料',
  TitleIcon: 'fas fa-user-edit',
  Width: 'min(920px, calc(100vw - 32px))',
  OpenType: 'Dialog',                      // Dialog / Drawer
  Data: { id: V8.Form.Id },                // 子应用 dialogData，只放普通数据
  OnSuccess: function (data) {
    V8.RefreshTable({ _PageIndex: -1 });
  },
  OnCancel: function (data) {},
  OnError: function (error) {
    V8.Tips(error.message || '加载失败', false);
  }
});
```

子应用用 `window.microApp.getData()` 获取自动下发的 `apiBase`、`osClient`、`token`、`appKey`、`version`、`microRoute`、`dialog` 和 `dialogData`；用 `window.microApp.dispatch({type:'app-dialog:success', data:{...}})` 返回成功结果。完整参数表和结果协议见 `v8-menu-buttons/SKILL.md`。

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
⚠️ **避免** 在 `FieldValueChange` 里 `V8.FormSet(同字段)` —— 前端会阻止同步直接重入，但异步回写或多字段互相赋值仍可能形成循环；需要静默赋值时使用 `V8.Form.字段名 = value`
❌ **禁止** 在 `InFormV8.js` 里写大量同步 `V8.FormEngine.Get*` —— 阻塞渲染

### 下拉框对象赋值

```javascript
// 会更新下拉选项并触发 SelectUser 的值变更 V8。
// 对象至少包含 SelectSaveField、SelectLabel 对应的属性；字段事件需要的其它属性也要传入。
V8.FormSet('SelectUser', { Id: 'u1', Name: '张三', DeptId: 'd1' });

// 响应式静默赋值：界面会更新，但不触发目标字段 V8，
// 也不会执行 FormSet 的修改字段记录、模板通知等处理。
V8.Form.SelectUser = { Id: 'u1', Name: '张三', DeptId: 'd1' };
```

## 设计模式保护（CRITICAL）

```javascript
// 任何前端字段事件都应在头部加这个判断！
if (V8.LoadMode === 'Design') return;
```
否则在【表单设计器】中编辑字段时，事件会被误触发，可能弹提示、报错或触发副作用。
