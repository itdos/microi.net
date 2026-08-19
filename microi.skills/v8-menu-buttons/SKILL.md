---
name: v8-menu-buttons
description: Microi 菜单按钮与 Tab V8 指南。用于配置 sys_menu MoreBtns、FormBtns、BatchSelectMoreBtns、PageTabs、PageBtns、ExportMoreBtns、显隐代码和行操作。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# v8-menu-buttons — 菜单按钮 / Tab / 批量操作 V8 写法

> 适用于 sys_menu 表的 MoreBtns、FormBtns、BatchSelectMoreBtns、PageTabs、ExportMoreBtns、PageBtns 字段。
> 这些字段统一存为 **JSON 字符串**（数组），每个数组元素是一个按钮/Tab 对象。
> AI 通过 MCP `microi_create_module` 创建菜单时应**主动**传入这些字段，业务系统才"活"。

---

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=v8-menu-buttons-000 sha256=b706679cdd4bff28f2d20c94dfea2f6f68303d768d53d3907827d43eedfaa72d -->
## 1. 字段总览

| 字段 | 渲染位置 | 必填项 |
|------|---------|--------|
| `MoreBtns` | 列表每行尾的"…更多"操作 | `Id, Name, V8Code`，建议 `ShowRow:true` |
| `FormBtns` | 表单右上角 / 移动端 FAB | `Id, Name, V8Code` |
| `BatchSelectMoreBtns` | 列表勾选多行后顶部出现 | `Id, Name, V8Code`，按钮里用 `V8.TableRowSelected` 取选中行 |
| `PageTabs` | 列表页模块 Hero 下方的页签切换 | `Id, Name`，当前模块筛选用 `V8Code`；跨模块切换用 `TargetSysMenuId` |
| `ExportMoreBtns` | 列表"导出"下拉的扩展 | `Id, Name, V8Code` |
| `PageBtns` | 页面级顶部按钮 | `Id, Name, V8Code` |

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-001 sha256=baf0987fff87b6a144361f9aa19598d30c9e747867bd170de4ccd40447df9377 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-002 sha256=f1e1bc64623a26a6c06bccd3e7da3f7e3b16e76b85d2fb398efe2c74407fba04 -->
## 4. 模式 B：直接确认 + 接口调用

`ConfirmTips` 使用 HTML 模式渲染内容，只传固定文案或经过 HTML 转义的简单文本；不要拼接用户输入、接口消息或数据库富文本。

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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=v8-menu-buttons-003 sha256=ae7e519897a8c331be2f657549997a91cd24a053fe00558e2b51d5c2477fc290 -->
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

### 4.2 业务面板复用通用弹窗宿主

某个模块是否出现入口、入口名称、排序、图标和显隐规则属于 `sys_menu.MoreBtns` 配置，禁止在 `diy-table.vue`、卡片模板或通用 mixin 中按菜单 Id、Url、表名直接渲染业务按钮。主前端已有 Vue 面板时先全局注册组件，再用 `V8.OpenDialog`；独立发布、跨应用升级的页面用 `V8.OpenAppDialog`。禁止为单个业务面板扩展 `V8.Open<业务名>` 包装方法。

系统账号的访问密钥入口示例：

```js
// V8CodeShow
var currentUser = V8.CurrentUser || {};
var currentUserId = String(currentUser.Id || "").toLowerCase();
var targetUserId = String((V8.Form && V8.Form.Id) || "").toLowerCase();
V8.Result = typeof V8.OpenDialog === "function"
  && currentUser._AccessKeySession !== true
  && !!targetUserId
  && (currentUser._IsAdmin === true
    || Number(currentUser.Level || 0) >= 9999
    || currentUserId === targetUserId);
```

```js
// V8Code
var user = V8.Form || {};
V8.OpenDialog({
  ComponentName: "UserAccessKeyPanel",
  Title: "访问密钥 - " + (user.Name || user.Account || ""),
  TitleIcon: "fas fa-key",
  Width: "min(980px, calc(100vw - 32px))",
  OpenType: "Dialog",
  DataAppend: { User: user }
});
```

按钮应设置稳定 `Id`、`ShowRow:true`、`Icon:"fas fa-key"`。前端显隐只改善体验，创建、查询、吊销等接口仍必须在服务端重新校验普通登录会话以及本人/平台管理员权限。

复杂策略编辑器（例如角色 AI 数据权限）应把行按钮持久化到菜单 `MoreBtns`，按钮只通过
`V8.OpenDialog({ ComponentName, DataAppend })` 打开已注册的 Vue 组件。验收需同时回读菜单按钮 JSON、
确认组件进入生产构建，并在真实列表行打开弹层；只保留旧定制页面里的按钮不算低代码菜单已迁移。

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-2-按钮对象-schema.md](references/progressive-01-2-按钮对象-schema.md)：2. 按钮对象 Schema；5. 模式 C：状态机推进（无需弹窗）；6. 模式 D：批量操作（BatchSelectMoreBtns）；7. 模式 E：PageTabs 切换筛选
- [references/progressive-02-8-模式-f-后台任务按钮-长任务.md](references/progressive-02-8-模式-f-后台任务按钮-长任务.md)：8. 模式 F：后台任务按钮（长任务）；9. 通过 MCP 创建菜单 + 按钮（一次到位）；前端 FormEngine 权限与兼容；10. 与接口引擎配套的工作流；10.1 后台直充/调账类行按钮
- [references/progressive-03-10-反模式-避免.md](references/progressive-03-10-反模式-避免.md)：10. 反模式（避免）；10.2 复杂定制弹窗必须使用微服务；11. ⚠️ `V8.CurrentUser` 拿不到的历史陷阱（必看）
<!-- microi-progressive:end -->
