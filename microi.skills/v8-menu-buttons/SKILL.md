---
name: v8-menu-buttons
description: Microi 菜单按钮与 Tab V8 指南。用于配置 sys_menu MoreBtns、FormBtns、BatchSelectMoreBtns、PageTabs、PageBtns、ExportMoreBtns、显隐代码和行操作。
---

# v8-menu-buttons — 菜单按钮 / Tab / 批量操作 V8 写法

> 适用于 sys_menu 表的 MoreBtns、FormBtns、BatchSelectMoreBtns、PageTabs、ExportMoreBtns、PageBtns 字段。
> 这些字段统一存为 **JSON 字符串**（数组），每个数组元素是一个按钮/Tab 对象。
> AI 通过 MCP `microi_create_module` 创建菜单时应**主动**传入这些字段，业务系统才"活"。

---

## 1. 字段总览

| 字段 | 渲染位置 | 必填项 |
|------|---------|--------|
| `MoreBtns` | 列表每行尾的"…更多"操作 | `Id, Name, V8Code`，建议 `ShowRow:true` |
| `FormBtns` | 表单右上角 / 移动端 FAB | `Id, Name, V8Code` |
| `BatchSelectMoreBtns` | 列表勾选多行后顶部出现 | `Id, Name, V8Code`，按钮里用 `V8.TableRowSelected` 取选中行 |
| `PageTabs` | 列表页顶部页签切换 | `Id, Name, V8Code`，`V8Code` 通常调用 `V8.SearchSet({...})` |
| `ExportMoreBtns` | 列表"导出"下拉的扩展 | `Id, Name, V8Code` |
| `PageBtns` | 页面级顶部按钮 | `Id, Name, V8Code` |

---

## 2. 按钮对象 Schema

```jsonc
{
  "Id": "01K...",            // ULID 或 GUID，必填且唯一
  "Sort": 0,                  // 排序
  "Name": "指派",             // 中文按钮名
  "Icon": "fas fa-user",      // 可选，FontAwesome 类名
  "BtnStyle": "primary",      // primary | success | warning | danger | (空)
  "IsVisible": true,          // 是否参与渲染（false 则完全隐藏）
  "ShowRow": true,            // MoreBtns 必填：true 显示在行内，false 收进"更多"
  "V8CodeShow": "...",        // 显隐表达式 JS：return true/false 或赋值 V8.Result=true/false
  "V8Code": "...",            // 点击执行的 JS（前端 V8 上下文）
  "Url": ""                   // 可选：直接跳转 URL（不与 V8Code 同用）
}
```

### V8CodeShow（显隐控制）—— 支持 `return` 和 `V8.Result`

推荐写法：直接返回布尔值。

```js
// 仅当状态为"待指派"且无负责人时显示
return V8.Form.Status == '待指派' && !V8.Form.AssigneeId;
```

兼容旧写法：给 `V8.Result` 赋布尔值。

```js
// 仅当状态为"待指派"且无负责人时显示
if (V8.Form.Status == '待指派' && !V8.Form.AssigneeId) {
  V8.Result = true;
} else {
  V8.Result = false;
}
```

### V8Code 上下文常用变量
| 变量 | 说明 |
|------|------|
| `V8.Form` | 当前行/表单数据 |
| `V8.FormMode` | `Add` / `Edit` / `View` |
| `V8.TableId` | 当前 diy_table 的 Id |
| `V8.TableRowSelected` | 批量按钮里勾选的行数组 |
| `V8.CurrentUser` | 登录用户 |
| `V8.ClientType` | `PC` / `App` / `Wechat` |
| `V8.Tips(msg, ok?)` | 浮层提示 |
| `V8.ConfirmTips(msg, cb)` | 确认弹窗 |
| `V8.RefreshTable({_PageIndex:1})` | 刷新列表 |
| `V8.SearchSet({Field:value})` | 设置/重置筛选条件（PageTabs 常用）|
| `V8.OpenAnyForm({...})` | 弹出任意表单（核心：可替换提交事件）|
| `V8.FormSubmit({...})` | 提交当前表单 |
| `V8.FormSet(field, val)` | 修改表单字段 |
| `V8.ApiEngine.Run({...})` | 调用接口引擎（业务逻辑必走）|

---

## 3. 模式 A：弹窗收集参数 → 调接口引擎（最常用）

```js
V8.OpenAnyForm({
  TableName: 'Diy_Order',
  DialogType: 'Dialog',
  Id: V8.Form.Id,
  FormMode: 'Edit',
  SelectFields: ['AssigneeId', 'AssigneeName', 'AssignTime'],  // 只显示这几个字段
  Width: '600px',
  EventReplace: {
    // 替换默认提交：改为调用业务接口引擎
    Submit: async function (v8, param, callback) {
      var result = await V8.ApiEngine.Run({
        ApiEngineKey: 'order_assign',
        Id: v8.Form.Id,
        AssigneeId: v8.Form.AssigneeId,
        AssigneeName: v8.Form.AssigneeName
      });
      callback(result);              // 必须 callback
      V8.RefreshTable({ _PageIndex: 1 });
    }
  }
});
```

## 4. 模式 B：直接确认 + 接口调用

```js
V8.ConfirmTips('确认领取该任务？', function () {
  V8.ApiEngine.Run({
    ApiEngineKey: 'order_take',
    Id: V8.Form.Id
  }, function (r) {
    if (r.Code == 1) V8.Tips('领取成功', true);
    else V8.Tips(r.Msg || '失败', false);
    V8.RefreshTable({ _PageIndex: 1 });
  });
});
```

## 5. 模式 C：状态机推进（无需弹窗）

```js
var next = '';
switch (V8.Form.Status) {
  case '待完成': next = '待验收'; break;
  case '待验收': next = '待评价'; break;
}
if (next) {
  V8.UptDiyTableRow({
    TableId: V8.TableId, Id: V8.Form.Id,
    _RowModel: { Status: next }
  }, function () { V8.RefreshTable({ _PageIndex: -1 }); });
}
```

## 6. 模式 D：批量操作（BatchSelectMoreBtns）

```js
var rows = V8.TableRowSelected;
if (!rows || rows.length == 0) { V8.Tips('请先勾选数据'); return; }
var ids = rows.map(function (r) { return r.Id; });
V8.ConfirmTips('确认删除选中的 ' + ids.length + ' 条？', function () {
  V8.FormEngine.DelFormDataByWhere({
    FormEngineKey: 'Diy_Order',
    _Where: [{ Name: 'Id', Value: JSON.stringify(ids), Type: 'In' }]
  }, function (r) {
    if (r.Code == 1) { V8.Tips('删除成功'); V8.RefreshTable({ _PageIndex: 1 }); }
    else V8.Tips(r.Msg, false);
  });
});
```

## 7. 模式 E：PageTabs 切换筛选

```js
// PageTab："待办"
V8.SearchSet({ Status: '待办' });

// PageTab："全部"
V8.SearchSet({ Status: '' });
```

`V8CodeShow` 控制此 Tab 在哪种端显示：
```js
// 只在 App 端显示
return V8.ClientType != 'PC';
```

---

## 8. 通过 MCP 创建菜单 + 按钮（一次到位）

> AI 在 `microi_create_module` 调用时，把按钮 JSON **作为字符串** 传入对应字段。

```jsonc
{
  "name": "售后任务",
  "diyTableId": "<TableId>",
  "icon": "fab fa-first-order",
  "moreBtns": "[{\"Id\":\"01K...\",\"Name\":\"指派\",\"BtnStyle\":\"primary\",\"IsVisible\":true,\"ShowRow\":true,\"V8CodeShow\":\"V8.Result = (V8.Form.Status=='\\''待指派'\\'')\",\"V8Code\":\"V8.OpenAnyForm({TableName:'Diy_AfterSale',Id:V8.Form.Id,FormMode:'Edit',SelectFields:['AssigneeId','AssigneeName'],Width:'600px',EventReplace:{Submit:async function(v8,p,cb){var r=await V8.ApiEngine.Run({ApiEngineKey:'aftersale_assign',Id:v8.Form.Id,AssigneeId:v8.Form.AssigneeId});cb(r);V8.RefreshTable({_PageIndex:1});}}});\"}]",
  "formBtns":  "[{\"Id\":\"01K...\",\"Name\":\"完成\",\"BtnStyle\":\"success\",\"IsVisible\":true,\"V8CodeShow\":\"V8.Result=(V8.Form.Status=='\\''待完成'\\'')\",\"V8Code\":\"V8.FormSet('Status','待验收');V8.FormSubmit({CloseForm:true});\"}]",
  "pageTabs":  "[{\"Id\":\"01K...\",\"Name\":\"全部\",\"V8Code\":\"V8.SearchSet({});\",\"V8CodeShow\":\"V8.Result=true;\"},{\"Id\":\"01K...\",\"Name\":\"待办\",\"V8Code\":\"V8.SearchSet({Status:'\\''待办'\\''});\"}]",
  "batchSelectMoreBtns": "[{\"Id\":\"01K...\",\"Name\":\"批量删除\",\"V8Code\":\"var rows=V8.TableRowSelected;if(!rows.length){V8.Tips('\\''请勾选'\\'');return;}var ids=rows.map(r=>r.Id);V8.ConfirmTips('\\''确认删除？'\\'',function(){V8.FormEngine.DelFormDataByWhere({FormEngineKey:'\\''Diy_AfterSale'\\'',_Where:[{Name:'\\''Id'\\'',Value:JSON.stringify(ids),Type:'\\''In'\\''}]},function(r){V8.Tips(r.Code==1?'\\''ok'\\'':r.Msg);V8.RefreshTable({_PageIndex:1});});});\"}]"
}
```

> ⚠️ 真实调用时直接传 JSON 字符串即可；JS 模板字符串里嵌单引号建议改为双引号或转义。

---

## 9. 与接口引擎配套的工作流

业务按钮通常与接口引擎配套：

1. **microi_create_engine** 先创建 ApiEngineKey（如 `aftersale_assign`），写好后端事务/校验/通知逻辑
2. **microi_create_module** 创建菜单时把按钮的 `V8Code` 设为 `V8.ApiEngine.Run({ApiEngineKey:'aftersale_assign',...})`
3. AI 在生成菜单时**应主动**：
   - 识别业务动作（指派/接单/审核/完成/驳回/导出/批量处理/状态推进）
   - 为每个动作创建一个接口引擎
   - 在 `moreBtns` / `formBtns` 中绑定按钮 → 接口

---

## 9.1 后台直充/调账类行按钮

会员积分、余额、库存、额度等会改动资产的后台行按钮，必须采用“前端按钮只收参数，后端接口负责事务”的模式。

规则：
- `MoreBtns` 使用 `ShowRow:true`，按钮只负责 `V8.ConfirmTips` 弹窗、读取金额/备注、调用接口和刷新表格。
- 不要在 `V8Code` 里直接写 `V8.FormEngine.UptFormData` 改余额；余额更新、订单/流水生成、幂等校验都放到 ApiEngine。
- 后端接口必须校验 `MemberId/Amount`，金额必须大于 0，并同时写资产主表和对应流水表；如系统已有订单表参与统计，也要同步生成已完成/已支付订单。
- 备注字段要有默认值，例如 `平台直充积分`，并允许管理员在弹窗中修改。
- 验证时至少做一次小额测试，读回主表余额、订单表和流水表；测试备注要明确标识，方便审计。

按钮 V8Code 骨架：

```js
var row = V8.Form || {};
var uid = 'admin_recharge_' + String(row.Id || '').replace(/[^a-zA-Z0-9_]/g, '');
var html = '<div style="text-align:left;min-width:360px;line-height:1.6">'
  + '<div style="margin-bottom:10px">会员：<b>' + (row.NickName || row.Phone || row.Id || '') + '</b></div>'
  + '<input id="' + uid + '_amount" type="number" min="0" step="0.01" placeholder="请输入充值积分" />'
  + '<textarea id="' + uid + '_remark">平台直充积分</textarea>'
  + '</div>';

V8.ConfirmTips(html, function () {
  var amount = Number((document.getElementById(uid + '_amount') || {}).value || 0);
  var remark = ((document.getElementById(uid + '_remark') || {}).value || '平台直充积分');
  if (!amount || amount <= 0) { V8.Tips('请输入大于0的充值积分', false); return; }
  V8.ApiEngine.Run({ ApiEngineKey: 'xxx_admin_recharge', MemberId: row.Id, Amount: amount, Remark: remark }, function (r) {
    V8.Tips(r && r.Code == 1 ? '充值成功' : ((r && r.Msg) || '充值失败'), r && r.Code == 1);
    if (r && r.Code == 1) V8.RefreshTable({ _PageIndex: -1 });
  });
}, null, { Title: '后台充值积分', OkText: '确认充值', CancelText: '取消' });
```

---

## 10. 反模式（避免）

❌ 把所有业务逻辑塞进 `V8Code`，不创建接口引擎
✅ 前端 `V8Code` 只负责弹窗/确认/刷新；业务逻辑写在接口引擎

❌ `V8CodeShow` 中返回非布尔值，导致按钮显隐继续走默认权限判断
✅ 显式 `return true/false;`，或兼容写法 `V8.Result = true/false;`

❌ `MoreBtns` 不写 `ShowRow:true`，按钮看不见
✅ 行内必须 `ShowRow:true`

❌ 按钮 `Id` 重复或省略
✅ 用 ULID/GUID 保证唯一

❌ `BatchSelectMoreBtns` 用 `V8.Form` 取数据
✅ 必须用 `V8.TableRowSelected`

---

## 11. ⚠️ `V8.CurrentUser` 拿不到的历史陷阱（必看）

### 现象
`diy-form-full.vue`（弹窗 / 详情 / 全屏表单）的 `FormBtns` / `PageBtns` / `PageTabs` / `BatchSelectMoreBtns` / `ExportMoreBtns` 中：
- 编写 `V8.CurrentUser._IsAdmin` 总是 `undefined`
- `V8CodeShow` 里靠用户角色判断的隐藏逻辑全部失效
- 但 `diy-table.vue` 的 `MoreBtns` 同样代码却**正常**

### 根因（2026-05 已修）
`diy.common.js` 中有一个**进程级单例缓存** `DiyCommon._V8BaseInstance`：
```js
// 旧 BUG 写法
DiyCommon._V8BaseInstance = {
  CurrentUser : store.state.DiyStore.GetCurrentUser,   // ← Pinia getter 不在 $state 里，永远 undefined
  CurrentToken: DiyCommon.getToken(),                  // ← 只算了一次，登录态变化后过期
  SysConfig   : store.state.DiyStore.SysConfig,
  ...
}
```
- `store.state.DiyStore` 是 Pinia 的 `$state` 兼容层，**只有 state 字段**，**不包含 getter**。`GetCurrentUser` 是 getter → 取到 `undefined`。
- `_V8BaseInstance` 是模块级单例，第一次构建后所有 `InitV8Code` 都会 `Object.assign(V8, _V8BaseInstance)`。
- `diy-form-full.vue` 调用顺序是：`SetV8DefaultValue` → `InitV8Code` → `Object.assign` 把 V8.CurrentUser 改回 undefined。
- `diy-table.vue` 调用顺序是：`InitV8Code` → `SetV8DefaultValue`，新鲜值后写胜出，所以没问题。

### 正确做法
1. **不要把会话级 / 用户级状态写进进程级单例缓存**（CurrentUser / Token / SysConfig）。
2. 在 `InitV8Code` / `InitV8CodeSync` 的 `Object.assign` 之后，调用 `DiyCommon._RefreshV8DynamicContext(V8)`，始终从 `useDiyStore()` 实例（而不是 `$state`）取最新值：
   ```js
   var diyStore = getDiyStore();
   V8.CurrentUser = diyStore.GetCurrentUser;   // Pinia getter，必须经 store 实例
   V8.SysConfig   = diyStore.SysConfig;
   V8.CurrentToken= DiyCommon.getToken();
   ```
3. 任何按钮组件（包括将来新增的 `PageBtns`、自定义 Tab 等）都**不需要**再单独 set `CurrentUser`，统一由 `_RefreshV8DynamicContext` 保证。

### AI 编写按钮时的检查清单
- [ ] `V8CodeShow` 中读 `V8.CurrentUser.RoleName` / `V8.CurrentUser._IsAdmin` 之前，**不**做 `if (!V8.CurrentUser)` 容错回写——容错会反过来掩盖框架问题。
- [ ] 不要在 `V8Code` 里 `Object.assign(V8, {...})`，避免再次覆盖动态字段。
- [ ] 涉及租户切换（SaaS）的按钮，禁止把 `V8.OsClient` 缓存在 `setTimeout` 闭包里，应每次重新读 `V8.OsClient` 或 `DiyCommon.GetOsClient()`。

