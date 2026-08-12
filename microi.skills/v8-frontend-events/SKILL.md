---
name: v8-frontend-events
description: Microi 前端 V8 事件与客户端能力指南。用于编写浏览器端字段、按钮、列表事件，或使用 V8.EventName、V8.Form、V8.Print 蓝牙打印（佳博 GP-M322、ZICOX CC4、TSPL、CPCL、ESC/POS、BLE、SPP）、扫码、弹窗、表单联动和界面交互。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 前端事件大全

你正在为 Microi 吾码平台编写 **前端 V8 事件** 代码。前端事件运行在浏览器，通过 `V8.EventName` 区分事件类型，可访问表单/列表/弹窗等丰富的客户端 API。

> **表单生命周期事件**（InFormV8、SubmitFormV8、SubmitBeforeServerV8、SubmitAfterServerV8、OutFormV8、DataFilterV8）见 `v8-table-event/SKILL.md`。  
> **菜单按钮事件**（MoreBtns/FormBtns 等）见 `v8-menu-buttons/SKILL.md`。  
> 本文重点是 **字段事件、按钮事件、列表事件、模板引擎、其它前端钩子**。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-frontend-events-000 sha256=df2662a9a006d35d989d7ff7316890ffff2c08e422d0e88033f44cdd40210c88 -->
## 能力路由

- 查询前端 V8 全部上下文、导航、表单、列表、网络、引擎与工具入口时，读取 `../v8-utilities/references/client-api-index.md`。
- 需求包含“蓝牙打印、标签打印、TSC/TSPL、CPCL、ESC/POS、小票打印、佳博/GP-M322、ZICOX/芝柯/CC4、BLE/SPP”时，必须先读取 `references/bluetooth-print.md`；需要完整指令签名、型号转换范围、编码或位图参数时，再读取 `references/bluetooth-print-api.md`。
- 浏览器模板打印、PDF/纸张模板、`mic_print`、`PageObj`、`PrintObj` 使用 `print-engine/SKILL.md`，不要与直接蓝牙指令混为一套 API。
- 扫码使用 `V8.Method.ScanCode`，结果从 Promise/回调取得；`V8.ScanCodeRes` 只作兼容结果槽，详见客户端 API 索引。
- 登录后的敏感操作使用 `V8.Identity.Verify` 完成 Passkey/严格人脸交互；前端只取得一次性 Ticket，后端接口引擎必须重算 `ActionHash` 并原子消费，不能把前端成功当作授权。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-frontend-events-001 sha256=a9f8e1aed64db4b57ff762eb557c0d764b5f703a722dc080d273c4111afe234f -->
## 字段事件（在【字段属性】中配置）

### FieldValueChange — 值变更事件（最常用）

```javascript
// V8.EventName === 'FieldValueChange'
// V8.ThisValue   — 当前字段新值
// V8.OldValue    — 仅表格行内字段事件可靠提供；普通表单读取 V8.OldForm
// V8.Form        — 整个表单数据
// V8.FormMode    — 'Add' / 'Edit' / 'View'
// V8.LoadMode    — 'Design' 表示设计器中，'View' 是真实表单

// ★ 关键：设计模式下不要执行业务逻辑（防止设计器卡顿）
if (V8.LoadMode === 'Design') return;

// 选择部门 → 联动加载该部门下的人员到 联系人 控件
var deptId = V8.ThisValue && V8.ThisValue.Id;
if (deptId) {
  var users = await V8.FormEngine.GetTableData('Diy_Employee', {
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
// 表格行内键盘事件为 V8.EventName === 'TableFieldOnKeyup'
// V8.KeyCode     — 键码；当前键盘 V8 不提供原生 V8.Event

if (V8.KeyCode === 13) {
  V8.FormSubmit({ CloseForm: false });
}
```

### V8CodeBlur — 失焦专用代码

```javascript
// 当前运行时仍使用 V8.EventName === 'FieldValueChange'
// V8.ThisValue 是失焦时的当前输入值
// 失焦校验手机号
if (V8.ThisValue && !/^1[3-9]\d{9}$/.test(V8.ThisValue)) {
  V8.Tips('手机号格式不正确', false);
  V8.Form.Phone = ''; // 静默清空，避免再次触发当前字段事件
}
```

### FieldSlotButtonClick — 单行文本插槽按钮

单行文本 `Text` 开启【插槽按钮】后，必须在【插槽按钮V8代码】中配置行为，不要再写“弹出表格Id”。

```javascript
// V8.EventName === 'FieldSlotButtonClick'
// V8.ThisValue — 当前输入框值
// V8.Event     — 原生点击事件

if (V8.LoadMode === 'Design') return;

V8.OpenAnyTable({
  SysMenuId: '目标业务菜单Id',
  MultipleSelect: false,
  SubmitEvent: function (selectData, callback) {
    callback({ Code: 1, Data: selectData });
  }
});
// 或 V8.OpenAnyForm / V8.OpenAppDialog / V8.ApiEngine.Run 等任意前端 V8 能力
```

`ReadOnlyButton` 的产品文案是【禁用插槽按钮】：只控制按钮是否可点击，不等同于字段只读，应保留用于权限和状态控制。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-frontend-events-002 sha256=986a67e78b0274941c6f2ab6589b06b8545f8f3261d4972dc56d4061b019d799 -->
## 按钮事件

### V8BtnRun — 按钮点击执行（菜单按钮、表单按钮）

```javascript
// V8.Form        — 当前行/表单数据
// V8.FormMode    — Add / Edit / View
// V8.TableId     — 当前 diy_table 的 Id
// V8.TableRowSelected — 批量按钮中选中的行数组
// V8.ClientType  — 'PC' / 'IOS' / 'Android' / 'H5' / 'WeChat'

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

`V8CodeShow` 与点击事件使用同一套前端 V8 能力，允许直接使用 `await`。平台所有
按钮入口（列表按钮、表单顶部按钮、更多按钮和子表打开的嵌套表单按钮）都必须走
异步执行器并等待结果后再决定显隐；不得在某一层退回同步 `new Function`，否则同一段
代码在列表可用、进入嵌套表单后会报 `await is only valid in async functions`。回归测试
至少覆盖“主表详情 → 定制子表 → 子记录详情”链路中的含 `await` 显隐代码。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-frontend-events-003 sha256=68aab95ab02bfca93b69eaea1c188650cb7ef13f8566bee81a63c660a4437512 -->
## 模板引擎事件

`TableTemplateEngine` / `FormTemplateEngine` — 见 `v8-template-engine/SKILL.md`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-frontend-events-004 sha256=2db34699ad5433a8c8b194c9ce9909ed4d420d257dd8c6532238215402499c82 -->
## 工作流事件（前端）

`WFNodeEnd` — 流程节点结束后前端通知。详见 `v8-workflow/SKILL.md`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-frontend-events-005 sha256=e7f73123dfc00720f60c49705e91854b6f18cb0506a115a6078481dc37aed41c -->
## 设计模式保护（CRITICAL）

```javascript
// 任何前端字段事件都应在头部加这个判断！
if (V8.LoadMode === 'Design') return;
```
否则在【表单设计器】中编辑字段时，事件会被误触发，可能弹提示、报错或触发副作用。
<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-列表事件.md](references/progressive-01-列表事件.md)：列表事件；常用前端 API；前端 FormEngine 菜单上下文与兼容授权；异步写法（async/await vs 回调）；死循环陷阱
<!-- microi-progressive:end -->
