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
| `PageTabs` | 列表页顶部页签切换 | `Id, Name`，当前模块筛选用 `V8Code`；跨模块切换用 `TargetSysMenuId` |
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
  "Url": "",                  // 可选：直接跳转 URL（不与 V8Code 同用）
  "TargetSysMenuId": "",      // 仅 PageTabs：关联另一个 sys_menu.Id，替换路由并完整加载目标模块
  "RunBackground": false,      // 可选：true 时以后台任务执行接口引擎
  "BackgroundTask": false,     // 可选：兼容别名
  "IsBackgroundTask": false,   // 可选：兼容别名
  "ApiEngineKey": ""           // 可选：后台任务要执行的接口引擎 Key
}
```

### PageTabs 关联模块

- `TargetSysMenuId` 为空时，页签仍在当前模块执行 `V8Code` 和重新查询。
- `TargetSysMenuId` 指向其它模块时，点击会替换当前路由，并使用目标模块自己的表单引擎、字段、查询接口替换、按钮和分页配置完整初始化。
- 目标模块可以设置 `Display=0、AppDisplay=0` 隐藏左侧菜单，但必须给使用角色分配菜单权限，否则动态路由中找不到目标模块。
- 组成一组的所有模块应保存同一套 PageTabs；跨模块页签负责导航，目标模块加载后再根据路由 `Tab` 执行对应页签 V8。
- 禁止在 `diy-table` 或 mixin 中按模块名、Url、表名写死页签数据源。

### V8CodeShow（显隐控制）—— 支持 `return` 和 `V8.Result`

未配置 `V8CodeShow`，或代码执行后既没有 `return true/false`、也没有设置
`V8.Result = true/false` 时，显示条件默认按“显示”处理；只有明确
`return false` 或 `V8.Result = false` 才由显示条件隐藏按钮。角色按钮权限仍是
独立约束，不应通过省略显示条件绕过。

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
| `V8.OpenAppDialog({...})` | 按 AppKey 打开已发布在线微服务定制页 |
| `V8.FormSubmit({...})` | 提交当前表单 |
| `V8.FormSet(field, val)` | 修改表单字段 |
| `V8.ApiEngine.Run({...})` | 调用接口引擎（业务逻辑必走）|
| `V8.ApiEngine.RunBackground(...)` | 启动后台任务（用于安装、导入、初始化等长任务）|

### V8Code 格式化强制要求
- AI、MCP、VS Code 插件或脚本生成 `V8Code` / `V8CodeShow` 时，必须保存为可读的多行 JavaScript，包含换行和缩进；禁止把完整逻辑压成一整行。
- 写入 `sys_menu.MoreBtns/FormBtns/PageTabs/BatchSelectMoreBtns` 等 JSON 字符串时，也要先按 `.js` 文件格式组织代码，再通过 `JSON.stringify` 或等价方式转义保存。
- `V8.OpenAnyTable`、`V8.OpenAnyForm`、`V8.ApiEngine.Run`、确认弹窗、回调函数等嵌套结构必须分行，回调内部逻辑至少缩进一级。
- 只允许极短的单表达式显隐代码写成一行，例如 `V8.Result = true;`；一旦包含 `if`、`return`、`function`、`async`、数组/对象字面量或接口调用，就必须多行格式化。

格式化示例：
```js
var projectId = V8.Form && V8.Form.Id ? V8.Form.Id : "";
if (!projectId) {
  V8.Tips("缺少项目Id，无法打开关联清单。", false);
  return;
}

V8.OpenAnyTable({
  SysMenuId: "01K...",
  DialogType: "Drawer",
  Width: "80vw",
  MultipleSelect: false,
  PropsWhere: [
    ["XiangmuID", "=", projectId]
  ],
  SubmitEvent: async function(selectData, callback) {
    callback({
      Code: 1,
      Data: selectData
    });
  }
});
```

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

## 4.1 模式 B2：在线微服务定制页（OpenAppDialog）

当弹窗包含复杂布局、多步骤交互、实时校验或后续需要 AI 在线维护时，优先把页面实现为在线微服务，按钮 V8 代码只负责打开页面、传入上下文和接收结果。不要把长篇 HTML/CSS 写进 `V8Code`。

```js
V8.OpenAppDialog({
  AppKey: 'order_batch_processor',
  RoutePath: '/execute',
  Title: '批量处理订单',
  TitleIcon: 'fas fa-layer-group',
  Width: 'min(960px, calc(100vw - 32px))',
  OpenType: 'Dialog',
  Data: {
    ids: (V8.TableRowSelected || []).map(function (row) { return row.Id; }),
    source: 'order-list'
  },
  OnSuccess: function (data) {
    V8.Tips(data.message || '处理成功', true);
    V8.RefreshTable({ _PageIndex: -1 });
  },
  OnCancel: function () {},
  OnError: function (error) {
    V8.Tips(error.message || '应用执行失败', false);
  }
});
```

参数规则：

| 参数 | 必传 | 默认值 | 用法 |
|------|------|--------|------|
| `AppKey` | 是 | - | `sys_microiservice.MsKey`，目标微服务必须已经编译发布。 |
| `RoutePath` | 否 | `/` | 子应用内部路由；`MicroRoute` 是兼容别名，优先取 `RoutePath`。 |
| `Version` | 否 | 当前 `BuildVersion` | 固定加载某个发布版本；通常省略以使用当前版本。 |
| `Title` | 否 | `应用` | Dialog/Drawer 标题。 |
| `TitleIcon` | 否 | `fas fa-window-maximize` | 标题图标 class。 |
| `Width` | 否 | `min(920px, calc(100vw - 32px))` | CSS 宽度值，推荐带移动端安全边距。 |
| `OpenType` | 否 | `Dialog` | `Dialog` 或 `Drawer`。 |
| `Data` | 否 | `{}` | 业务参数，子应用从 `window.microApp.getData().dialogData` 获取；只放普通可序列化数据。 |
| `OnSuccess(data)` | 否 | - | 子应用成功回调，回调后自动关闭。 |
| `OnCancel(data)` | 否 | - | 子应用取消回调，回调后自动关闭。 |
| `OnError(error)` | 否 | - | 加载或执行错误回调，不自动关闭。 |

宿主还会自动传入 `apiBase`、`osClient`、`token`、`appKey`、`version`、`microRoute`、`dialog:true`。子应用返回协议：

```js
window.microApp.dispatch({ type: 'app-dialog:success', data: { message: '已提交' } });
window.microApp.dispatch({ type: 'app-dialog:cancel', data: {} });
window.microApp.dispatch({ type: 'app-dialog:error', data: { message: '校验失败' } });
```

- `success` / `cancel` 会自动关闭，`error` 保持页面打开。
- 禁止把回调函数放进 `Data`；回调必须使用 `OnSuccess` / `OnCancel` / `OnError`。
- 不要把 Token 拼接到 URL；使用宿主自动下发的 `token`。
- `OpenAppDialog` 加载在线微服务；`OpenDialog` 加载 Microi.Client 内已注册的 Vue 组件，两者不要混用。

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

## 8. 模式 F：后台任务按钮（长任务）

应用安装、初始化多语言、批量导入、批量修复、跨系统同步等可能超过浏览器或网关等待时间的操作，必须优先设计为后台任务。前端按钮只负责提交任务，后台任务列表通过 WebSocket/SignalR 推送进度。

推荐直接使用按钮字段：

```jsonc
{
  "Name": "安装",
  "BtnStyle": "primary",
  "ShowRow": true,
  "RunBackground": true,
  "ApiEngineKey": "import-microi-store-package",
  "V8Code": "return { Package: V8.Form, _BackgroundTaskTitle: '安装应用：' + (V8.Form.Name || '') };"
}
```

也可以在 V8Code 中显式调用：

```js
V8.ApiEngine.RunBackground('import-microi-store-package', {
  Package: V8.Form
}, '安装应用：' + (V8.Form.Name || ''));
```

接口引擎中必须上报真实进度。平台创建后台任务时会自动把 `_BackgroundTaskId` 注入 `V8.Param`，V8 代码不要自己生成任务 Id，也不要只在结束时写一个固定百分比。

```js
var backgroundTaskId = V8.Param._BackgroundTaskId || V8.Param.BackgroundTaskId || V8.Param.TaskId || '';
var reportProgress = function(current, total, msg) {
  if (!backgroundTaskId || !V8.Method || !V8.Method.UpdateBackgroundTask) return;
  V8.Method.UpdateBackgroundTask({
    _BackgroundTaskId: backgroundTaskId,
    Current: current,
    Total: total,
    Progress: Math.floor(current * 100 / total),
    Msg: msg,
    Message: msg
  });
};

reportProgress(1, 5, '正在读取数据');
// ...执行第 1 阶段
reportProgress(2, 5, '正在写入表结构');
// ...执行第 2 阶段
```

推荐用“阶段数”或“已处理条数 / 总条数”上报 `Current/Total`，平台会同步写入 Redis 并推送通知中心百分比。耗时循环中每处理一批数据都应调用一次 `reportProgress`，例如每 50 或 100 条更新一次，避免用户看到长期停留。

后台任务不能隐藏真实失败。失败时返回 `Code:0` 和清晰 `Msg`，并把关键阶段写入任务进度或系统日志。接口引擎成功返回 `Code:1` 时平台会把任务置为 100%；不要在中途把 `Progress` 写到 100。

### 复盘：主租户默认值误清空子租户后台任务身份

- 触发场景：同一套前后端中，独立部署的主租户可正常执行后台安装，挂在平台主库下的子租户却间歇性提示“只有超级管理员才能安装”；数据库中的 admin 实际已经是最高等级。
- 根因：任务提交时虽然已从登录令牌保存可信用户快照，但后台线程脱离 HTTP 请求后再次调用 `GetCurrentToken()`，得到的只是服务默认主租户；普通接口的跨租户保护发现默认租户与任务 `OsClient` 不同，误把可信用户快照清空。线程是否赶在原请求上下文释放前运行还会造成偶发成功、偶发失败。
- 通用规则：后台任务必须在提交阶段由服务端读取并克隆 `CurrentUser + OsClient`，通过不暴露给客户端/V8 的可信执行入口传给接口引擎；客户端参数中的 `_CurrentUser` 必须删除。普通 HTTP 接口继续执行跨租户身份清空，但不得用无真实 Token 的默认租户结果覆盖后台任务可信身份。
- 自动化检查：使用“服务默认租户 A + 子租户 B”的部署配置，以 B 的超级管理员连续提交多次后台接口任务，并在原请求结束后才放行执行；断言每次 V8 的 `CurrentUser.Id/Level` 与提交者一致，同时验证携带 A Token 调用 B 普通接口仍会按匿名处理。

---

## 9. 通过 MCP 创建菜单 + 按钮（一次到位）

> AI 在 `microi_create_module` 调用时，把按钮 JSON **作为字符串** 传入对应字段。

```js
var moreBtns = [
  {
    Id: "01K...",
    Name: "指派",
    BtnStyle: "primary",
    IsVisible: true,
    ShowRow: true,
    V8CodeShow: "V8.Result = (V8.Form.Status == '待指派');",
    V8Code: `
var assignResult = await V8.ApiEngine.Run({
  ApiEngineKey: "aftersale_assign",
  Id: V8.Form.Id,
  AssigneeId: V8.Form.AssigneeId
});

V8.Tips(assignResult.Code == 1 ? "指派成功" : assignResult.Msg, assignResult.Code == 1);
V8.RefreshTable({ _PageIndex: 1 });
`
  }
];

var modulePayload = {
  name: "售后任务",
  diyTableId: "<TableId>",
  icon: "fab fa-first-order",
  moreBtns: JSON.stringify(moreBtns),
  formBtns: JSON.stringify([]),
  pageTabs: JSON.stringify([]),
  batchSelectMoreBtns: JSON.stringify([])
};
```

> ⚠️ 真实调用 `microi_create_module` 时传 `modulePayload.moreBtns` 这样的 JSON 字符串。不要为了“看起来短”把 `V8Code` 压成一行。

---

## 10. 与接口引擎配套的工作流

业务按钮通常与接口引擎配套：

1. **microi_create_engine** 先创建 ApiEngineKey（如 `aftersale_assign`），写好后端事务/校验/通知逻辑
2. **microi_create_module** 创建菜单时把按钮的 `V8Code` 设为 `V8.ApiEngine.Run({ApiEngineKey:'aftersale_assign',...})`
3. AI 在生成菜单时**应主动**：
   - 识别业务动作（指派/接单/审核/完成/驳回/导出/批量处理/状态推进）
   - 为每个动作创建一个接口引擎
   - 在 `moreBtns` / `formBtns` 中绑定按钮 → 接口

---

## 10.1 后台直充/调账类行按钮

会员积分、余额、库存、额度等会改动资产的后台行按钮，必须采用“前端按钮只收参数，后端接口负责事务”的模式。

规则：
- `MoreBtns` 使用 `ShowRow:true`，按钮只负责 `V8.ConfirmTips` 弹窗、读取金额/备注、调用接口和刷新表格。
- 不要在 `V8Code` 里直接写 `V8.FormEngine.UptFormData` 改余额；余额更新、订单/流水生成、幂等校验都放到 ApiEngine。
- 后端接口必须校验 `MemberId/Amount`，金额必须大于 0，并同时写资产主表和对应流水表；如系统已有订单表参与统计，也要同步生成已完成/已支付订单。
- 资产主表更新、`SELECT ... FOR UPDATE` 和流水写入必须全部使用同一个 `V8.DbTrans`；禁止一部分用 `V8.Db`、另一部分写流水，否则后半段报错时可能留下单边余额变化。
- 备注字段要有默认值，例如 `平台直充积分`，并允许管理员在弹窗中修改。
- 验证时至少做一次小额测试，读回主表余额、订单表和流水表；测试备注要明确标识，方便审计。
- 还必须做一次回滚验收：故意让流水写入失败，回读资产主表确认余额完全未变，再修正输入完成成功验收。

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

❌ 依赖非布尔返回值隐藏按钮
✅ 需要隐藏时显式 `return false;` 或 `V8.Result = false;`；未返回布尔值默认显示

❌ `MoreBtns` 不写 `ShowRow:true`，按钮看不见
✅ 行内必须 `ShowRow:true`

❌ 按钮 `Id` 重复或省略
✅ 用 ULID/GUID 保证唯一

❌ `BatchSelectMoreBtns` 用 `V8.Form` 取数据
✅ 必须用 `V8.TableRowSelected`

❌ 在 `V8.ConfirmTips` 中拼接复杂 HTML、表单、列表、Tab、代码编辑器或多步骤向导
✅ 先用 `microi_list_applications` / `microi_get_application_context` 查找现有微服务；优先在已有微服务新增页面，否则通过 MCP 创建微服务，再用 `V8.OpenAppDialog` 打开

## 10.2 复杂定制弹窗必须使用微服务

`V8.ConfirmTips` 只适合纯文本确认或极少量一次性输入。出现以下任一情况即视为复杂页面：三个以上字段、响应式布局、联动校验、上传、表格、Tab、步骤条、代码编辑器、需要复用、后续会持续迭代。

复杂页面标准流程：

1. `microi_list_applications({ appType: 'MicroService' })` 获取现有微服务及文件清单。
2. `microi_get_application_context({ appIdOrKey: '<AppKey>' })` 读取完整源码，判断应新增页面还是新建应用。
3. 新建时使用 `microi_create_microservice` 注册元数据，`microi_sync_microservice_source` 上传私有源码，`microi_publish_microservice` 上传公有编译产物和页面路由。
4. 菜单按钮只负责调用 `V8.OpenAppDialog`，把业务数据放入 `Data`，通过 `OnSuccess / OnError / OnClose` 与宿主交互。

```js
V8.OpenAppDialog({
  AppKey: 'official-admin-app',
  RoutePath: '/tenant/create',
  Title: '创建租户',
  Width: 'min(960px, calc(100vw - 32px))',
  Data: { Source: 'SaaSMenu' },
  OnSuccess: function (result) {
    V8.Tips((result && result.message) || '处理成功', true);
    V8.RefreshTable({ _PageIndex: -1 });
  },
  OnError: function (error) {
    V8.Tips((error && error.message) || '页面处理失败', false);
  }
});
```

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

