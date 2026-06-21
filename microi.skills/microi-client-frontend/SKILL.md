---
name: microi-client-frontend
description: Microi.Client 源码架构指南。用于修改 Microi.Client Vue 前端代码，尤其是表单引擎、diy-table、diy-form-full、工作流面板、sys_menu 按钮、前端 V8 事件、路由以及页面/弹窗/抽屉行为。
---

# Microi.Client 前台源码架构说明

> 适用于修改 `Microi.Client/` 前台源码。新 AI 对话在动 `Microi.Client/src/views/form-engine` 前，应先阅读本 Skill，避免把分散在 SFC、mixins、utils、路由和低代码配置里的逻辑误判成不存在。

---

## 1. 技术栈和源码入口

- Vue 3 + Options API + mixins，构建工具是 Vite。
- UI 主要使用 Element Plus、FontAwesome、项目内 `dynamic-icon`。
- 状态入口：`src/pinia`，常用 `useDiyStore()` 读取 `GetCurrentUser`、`OsClient`、终端类型等。
- 低代码主入口集中在 `src/views/form-engine/`，不要只看一个 `.vue` 文件就下结论。

常见入口：

| 场景 | 关键文件 |
|------|----------|
| 列表页 | `diy-table.vue` + `mixins/diy-table-*.mixin.js` |
| 表单容器 | `diy-form-full.vue` + `mixins/diy-form-full-*.mixin.js` |
| 表单字段渲染 | `diy-form.vue` + `mixins/diy-form-*.mixin.js` |
| 字段组件 | `diy-field-component/*.vue` |
| 工作流右侧面板 | `form-right-panel.vue`、`workflow/wf-work-handler.vue` |
| 表单设计器 | `diy-design.vue`、`diy-components/*` |
| 通用 V8/低代码工具 | `src/utils/diy.common.js`、`src/utils/v8-*.js` |

---

## 2. 表单引擎三层结构

### `diy-table.vue`

列表页/模块页容器，负责：

- 读取 `sys_menu` 得到 `SysMenuModel`。
- 读取 `diy_table` / `diy_field` 得到表结构和字段列表。
- 渲染搜索、表格、卡片、行按钮、批量按钮、页面按钮、PageTabs。
- 打开表单：通过 `refDiyTable_DiyFormDialog.Init({...})` 调用 `diy-form-full.vue`。
- 权限：`SysMenuId`、`GetCurrentUser._RoleLimits`、`Permission` 控制增删改查和动态按钮。

### `diy-form-full.vue`

表单外壳，不直接渲染字段。它负责：

- Page/Dialog/Drawer 三种打开方式。
- 顶部保存、编辑、关闭、删除、`sys_menu.FormBtns` 动态按钮。
- 移动端 FAB 菜单。
- 右侧数据日志、评论、工作流面板。
- 调用内部 `DiyForm` 并接收 `CallbackSetFormData`、`CallbackSetDiyTableModel`。
- 自身根据 `SysMenuId` 拉取 `sys_menu`，再执行 `HandlerBtns/HandlerBtnsAsync` 计算 `FormBtns` 显隐。

注意：`diy-form-full.vue` 的方法大量来自 mixins：

| mixin | 职责 |
|-------|------|
| `diy-form-full-state.mixin.js` | data/computed、路由 Page 模式、mounted/activated/deactivated |
| `diy-form-full-dialog.mixin.js` | OpenDetail、Dialog/Drawer/Page 初始化、关闭和重载 |
| `diy-form-full-data.mixin.js` | 保存、删除、刷新表单/子表等数据操作 |
| `diy-form-full-workflow.mixin.js` | StartWork/SendWork 与表单提交整合 |
| `diy-form-full-mobile.mixin.js` | 移动端 FAB、手势返回、位置保存 |
| `diy-form-full-permission.mixin.js` | 权限判断 |
| `diy-form-full-cleanup.mixin.js` | 清理 watcher、全局事件、引用 |

### `diy-form.vue`

真正的字段表单，负责：

- 根据 `diy_field` 分组/Tab/布局渲染字段组件。
- 执行字段前端 V8、表单前端 V8、模板 V8。
- 维护 `FormDiyTableModel`、`OldForm`、`DiyFieldList`。
- 对外 emit `CallbackSetFormData` 和 `CallbackSetDiyTableModel` 给 `diy-form-full.vue`。

---

## 3. 动态按钮系统

按钮配置来自 `sys_menu`：

| 字段 | 渲染位置 |
|------|----------|
| `MoreBtns` | 列表行按钮/更多按钮 |
| `FormBtns` | 表单右上角、移动端 FAB |
| `BatchSelectMoreBtns` | 列表多选后批量按钮 |
| `PageBtns` | 列表页顶部按钮 |
| `PageTabs` | 列表页 Tab |
| `ExportMoreBtns` | 导出下拉扩展 |

按钮显隐链路：

1. `DiyCommon.ForConvertSysMenu()` 把 JSON 字符串转成数组并补默认值。
2. `HandlerBtns()` / `HandlerBtnsAsync()` 遍历按钮。
3. `LimitMoreBtn()` / `LimitMoreBtnAsync()` 构建前端 V8 上下文。
4. 执行 `btn.V8CodeShow`，支持两种写法：

```js
return V8.Form.Status == '待审核';
```

```js
V8.Result = V8.Form.Status == '待审核';
```

5. 点击时 `RunMoreBtn()` 执行 `btn.V8Code`。

修改按钮逻辑时必须同时检查：

- `diy-form-full.vue`：表单 `FormBtns`。
- `mixins/diy-table-actions.mixin.js`：列表按钮、PageBtns、BatchSelectMoreBtns、PageTabs 等。
- `left-right/RightView.vue`、`left-right/RightForm.vue`：旧版左右布局兼容。
- `src/utils/v8-button-visibility.js`：统一的 `V8CodeShow` 执行与布尔结果解析。

---

## 4. 工作流与表单提交

工作流相关文件：

| 文件 | 说明 |
|------|------|
| `form-right-panel.vue` | 右侧 Tab 容器，展示日志/评论/工作流 |
| `workflow/wf-work-handler.vue` | StartWork/SendWork UI 与提交参数构建 |
| `mixins/diy-form-full-workflow.mixin.js` | 把工作流提交接到 `diy-form-full` 的保存链路 |
| `diy-components/diy-workflow-line-condition.vue` | 条件路线图形配置与 V8 marker 生成 |

关键规则：

- 首次发起流程时，前端可能已经生成 `Id`，但业务表还没有行；必须走 `Add` 或传 `_NoLineForAdd=true`。
- `StartWorkWithForm` 用于“保存表单 + 发起流程”原子化提交。
- 工作流路线标题是拓扑关系 `{起点节点} 到 {终点节点}`，条件名称不能覆盖 `wf_line.LineName`。
- 条件 V8 推荐设置 `V8.NextNodeId`，兼容 `V8.LineValue`。

---

## 5. 路由与打开方式

`diy-form-full.vue` 支持三类形态：

| 打开方式 | 特征 |
|----------|------|
| Dialog | `ShowFieldForm=true`，内部 `DiyForm` 使用 `ref="fieldForm"` |
| Drawer | `ShowFieldFormDrawer=true`，`onDrawerOpened()` 中调用 `fieldForm.Init()` |
| Page | 路由 `/diy/form-page/:TableId/:TableRowId?`，`IsPageMode=true`，内部 `fieldFormPage` 通过 props 自动初始化 |

Page 模式要特别注意：

- `SysMenuId` 可能来自 query `SysMenuId`、query `Id`、或 route meta。
- `CallbackSetFormData` 到达后才能可靠评估 `FormBtns`，因为此时才有当前表单数据。
- keep-alive 会触发 `activated/deactivated`，不要只在 `mounted` 里写一次性逻辑。

---

## 6. 修改前必查清单

修改 `Microi.Client` 前，至少搜索：

```text
目标方法名 | 目标字段名 | V8CodeShow | SysMenuModel | CallbackSetFormData | HandlerBtns | RunMoreBtn
```

并确认：

- 方法是否在 mixin 中，而不是当前 SFC。
- PC/移动端是否有两套模板。
- Page/Dialog/Drawer 是否都需要同样修复。
- 旧版 `left-right` 是否仍需兼容。
- 是否同时影响列表页按钮和表单按钮。
- 是否需要更新 `microi.skills/v8-menu-buttons/SKILL.md` 或前端 V8 typings。

---

## 7. 验证建议

- 修改 Vue/JS 后先跑 VS Code Problems 或 `get_errors`。
- 影响核心前端时跑 `Microi.Client` 的 `npm run build`。
- 如果改了工作流、表单保存、按钮 V8，建议用实际 `sys_menu` 配置测试：
  - `FormBtns` 是否出现在表单右上角/FAB。

---

## 8. 运行时高频坑复盘

### FormEngine 前端封装以 `diy.common.js` 为准

前端 `DiyCommon.FormEngine` 不是后端 `FormEngine` 方法的一比一暴露，动表单引擎数据前必须先查 `Microi.Client/src/utils/diy.common.js` 的真实封装。单条新增评论、日志、草稿、配置等业务数据时使用：

```js
await DiyCommon.FormEngine.AddFormData("table_name", {
  Field: "value"
});
```

或：

```js
DiyCommon.FormEngine.AddFormData("table_name", { Field: "value" }, function (result) {});
```

不要凭后端存在 `AddTableData` 就在前端写 `DiyCommon.FormEngine.AddTableData(...)`；该封装在 Microi.Client 中可能不存在，单条数据也不应该走批量新增。批量新增前先确认当前前端封装是否是 `AddFormDataBatch`，并按项目已有调用方式传参。

### Pinia persisted-state 覆盖 state 默认值

当主题色、语言、布局等状态同时支持“系统默认值”和“用户手动选择”时，不能只在 `state()` 中写 fallback。Pinia persisted-state hydrate 会在 store 初始化后把本地旧值覆盖回来，导致 `SysConfig.ThemeColor` 等系统默认永远不生效。

通用规则：

- 本地值只表示用户显式选择；系统默认值应在计算属性/运行时兜底中读取。
- 对历史默认值（如 `#409eff`）要在 persisted-state `afterHydrate` 中归一化为空，避免旧默认被误判为用户手动选择。
- 主题色相关组件、图标、导航、移动端个人中心都要使用同一条 fallback：用户手动值 > `SysConfig.ThemeColor` > 平台默认值。

### Element Plus 弹层 teleport 导致父弹层提前关闭

`el-date-picker`、`el-select` 等组件默认可能把面板 teleport 到 `body`。如果它们位于 `el-popover`、列头菜单、自定义 document-click 菜单里，选择日期/下拉项会被父级误判为外部点击，导致搜索弹窗立即关闭、筛选无法完成。

通用规则：

- 嵌套在父弹层内的日期/下拉控件优先设置 `:teleported="false"`。
- 自定义 document click 关闭逻辑必须忽略 `.el-popper`、`.el-picker__popper`、`.el-select__popper` 内部点击。
- 修改后要验证：打开更多搜索 -> 选择日期 -> 面板不提前关闭 -> 应用筛选成功。
  - `V8CodeShow: return false;` 是否隐藏。
  - `V8CodeShow: return true;` 是否显示。
  - `V8CodeShow: V8.Result = false;` 是否仍兼容。

## 7.1 登录验证码与 Sys_Config

修改 `Microi.Client/src/views/login/index.vue` 或任何 PC 端登录扩展时，必须遵守平台登录验证码契约：

- 登录页加载系统配置后，用统一的 `isEnabledFlag(SysConfig.EnableCaptcha)` 判断是否开启验证码。`EnableCaptcha` 可能是 `1`、`true`、`'1'`、`'true'`，不能直接 `!!SysConfig.EnableCaptcha`。
- 开启时显示验证码输入框，调用 `GET /api/Captcha/GetCaptcha` 获取图片，读取响应头 `captchaid`，调用 `/api/SysUser/login` 时提交 `_CaptchaId/_CaptchaValue`。
- 登录失败时刷新验证码并清空输入；未开启时隐藏验证码并且不提交空验证码字段。
- PC 端和移动端都调用同一个后端登录契约，不能只在某一端支持验证码。
- 修改后要至少验证 `EnableCaptcha=1`、`EnableCaptcha='1'`、`EnableCaptcha=false` 三种情况。

## Microi 前端 SDK 约束

当修改 `Microi.Client` 之外的 Vue3 前端、PC 官网、移动 H5 或定制微前端页面时，必须优先读取 `microi.skills/microi-frontend-sdk/SKILL.md` 并使用 `microi.skills/microi.v8.js`。`Microi.Client` 主后台已有平台请求与 Pinia 体系时，可以复用现有平台能力；但新增独立页面、外部站点、插件页、嵌入式页面不得再复制旧 Vue2/Vuex 版 `microi.v8.js`。

- 只保留 Vue3 写法，不新增 `Vue.prototype`、Vue2 条件编译或 Vuex 依赖。
- 业务请求、Token、上传、资源 URL 解析统一委托 SDK 或 Microi.Client 现有平台请求层。
- 后台仍使用 Element Plus；官网/产品站/文档站优先遵守 `microi.skills/ui-design/SKILL.md` 的 MCI-UI 策略。

## Vue3 前端微服务宿主规则

`sys_menu.OpenType=MicroService` 时，动态路由必须把 `MicroServiceId`、`MicroServicePageId`、`MicroServiceRoutePath` 和真实入口 `MicroAppUrl` 写入 route meta；浏览器侧菜单路由使用 `/#/micro-app/{MsKey}/{RoutePath}`，不要再生成 `/micro-app-host/{menuId}`，否则地址过长且刷新或直接访问菜单路由容易加载空白页。

同一个编译后的微服务可以绑定多个后台菜单和内部页面。`MicroAppHost` 的 `<micro-app name>` 必须包含菜单 Id、路由路径或其它实例维度，避免多个菜单共享同一个 appKey 时触发 `app name conflict`。入口 URL 中的 `microRoute/routePath` 只用于解析，最终应通过 `data.microRoute` 传给子应用，入口文件 URL 保持稳定。

后台配置必须配套维护 `sys_microiservice_page` 路由子表，并在 `sys_microiservice` 表单上用隐藏子模块 + `TableChild` 显示页面/路由。`sys_menu` 选择微服务时要由前端 V8 事件实时加载页面列表，不能完全依赖 SQL 下拉里的表单变量替换。

隐藏的 `TableChild`/子表菜单不得设置 `HasChild=1`。`Display=0` 或 `AppDisplay=0` 的菜单只用于表单子表承载，不应该让左侧菜单把上级业务菜单识别成空文件夹；前端动态路由和侧边栏判断父/子菜单时也必须只统计可见子菜单。
