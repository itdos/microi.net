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

定制页嵌入标准列表时，优先复用 `diy-table` 的运行时 props，不要复制表格实现：

- `PropsSelectApi`、`PropsRequestParams`：覆盖列表接口并追加业务参数；禁止透传 Token/Authorization。
- `PropsVirtualFields`、`PropsSelectFields`、`PropsSearchFields`：补充接口虚拟字段并精确控制列和搜索项。
- `PropsMenuModelPatch`：仅在当前实例覆盖 `MoreBtns`、`BatchSelectMoreBtns`、`PageTabs`、显隐代码等，不写回 `sys_menu`。
- `PropsHideImportExport`、`PropsHideMoreFunctions`、`PropsHideAdminDesign`：嵌入页需要保持原业务工具边界时隐藏标准辅助工具。
- 业务动作仍由 `ParentV8` 暴露给按钮/模板 V8；`diy-table` 只负责通用渲染、权限和分页。

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

### 在线微服务弹窗（OpenAppDialog）

`V8.OpenAppDialog` 是 V8 定制页面的标准入口，宿主实现位于：

| 文件 | 职责 |
|------|------|
| `views/micro-app/dialog.vue` | 按 `AppKey + Version` 解析 `/micro-app/{OsClient}/{AppKey}/{Version}/index.html`，挂载 micro-app 并处理结果协议。 |
| `views/form-engine/mixins/diy-table-navigation.mixin.js` | 向列表、PageBtns、MoreBtns、BatchSelectMoreBtns 暴露 `OpenAppDialog`。 |
| `views/form-engine/mixins/diy-form-navigation.mixin.js` | 向表单 V8 暴露同一套 `OpenAppDialog` 参数。 |
| `views/form-engine/diy-table.vue`、`diy-form.vue` | 将方法挂到运行时 `V8` 对象并承载通用弹窗。 |

扩展或修复时必须保持表格与表单两条入口的参数一致：`AppKey`、`RoutePath/MicroRoute`、`Version`、`Title`、`TitleIcon`、`Width`、`OpenType`、`Data`、`OnSuccess`、`OnCancel`、`OnError`。

- `Data` 映射为子应用的 `dialogData`，必须是普通业务数据；函数回调保留在宿主，不放进 micro-app data。
- 宿主自动下发 `apiBase`、`osClient`、`token`、`appKey`、`version`、`microRoute`、`dialog:true` 和 `route`。
- 子应用发送 `app-dialog:success` 或 `app-dialog:cancel` 后自动关闭；`app-dialog:error` 只触发错误回调，不自动关闭。
- `OpenAppDialog` 用于发布后的在线微服务；`OpenDialog` 用于前端源码中预注册的 Vue 组件。
- Token 通过 micro-app data 下发，禁止拼进加载 URL，避免日志、历史记录和代理链路泄露。
- 新增参数或修改返回协议时，必须同步更新 `microi.doc/docs/doc/v8-engine/v8-client.md`、`v8-menu-buttons/SKILL.md` 和 `v8-frontend-events/SKILL.md`。

---

### 系统子菜单入口页（MenuChildrenGrid）

`Microi.Client/src/views/system/menu-children-grid.vue` 是左侧父级菜单的落地入口页。修改此类页面时必须同时读取 `microi.skills/ui-design/SKILL.md` 的“PC 后台菜单宫格 / 入口页规范”。

- 不要让宽屏通过纯 `auto-fill + 1fr` 一行挤出 10 个以上菜单；常规后台宽度推荐 6-8 个入口/行，并通过固定列宽、`max-width` 和 `justify-content:start` 控制密度。
- 菜单卡片必须宽高一致，图标、菜单名称、子菜单统计要按固定槽位对齐；有无子菜单统计都不能导致标题位置上下漂移。
- 子菜单统计应靠近菜单名称，间距约 4-6px；卡片内部必须保留足够 padding，不能让图标、标题或统计贴边。
- 改完必须截图验收桌面宽屏和移动宽度，重点检查每行数量、图标/标题/统计对齐、文字溢出和横向滚动。

---

## 6. 修改前必查清单

### `diy-table` 嵌入分页条数

- 定制页或界面引擎嵌入 `diy-table.vue` 时，可通过 `PageSizeList` props 追加分页条数，例如首页使用 `[10]`。
- `PageSizeList` 必须与系统 `PageSizes`、菜单默认条数合并后转为正整数、去重并升序排列，不能覆盖系统已有候选值。
- `sys_menu.DefaultPageSize` 明确配置时优先采用菜单值；未配置时默认采用最终候选列表中的最小值，保证紧凑嵌入页能稳定使用 10 条而不被全局默认值改回 15 条。
- 界面引擎、工作台等移动端嵌入列表应传 `PropsEmbedded=true`：隐藏独立列表页的固定移动端返回栏和全局 FAB，同时让有权限的新增、PageBtns、批量操作继续在当前容器工具栏显示，避免按钮漂浮覆盖其它首页组件。

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

### Element Plus 弹窗默认交互

新增或改造 `Microi.Client` 的 `el-dialog` 时，默认必须上下左右居中并支持 PC 端标题栏拖动。除非有明确的移动端抽屉/全屏业务理由，否则不要让弹窗贴在左上角、底部或跟随内容自然流偏移。

落地规则：

- `el-dialog` 默认添加 `align-center` 和 `draggable`；复杂弹窗建议 `append-to-body`，避免被局部容器裁切。
- 弹窗宽度用响应式约束，如 `width="min(1280px, calc(100vw - 48px))"`，避免宽屏过窄、窄屏溢出。
- 标题栏应保持清晰的拖动热区，可给 `.el-dialog__header` 设置 `cursor: move`，但不能遮挡关闭按钮。
- 弹窗内部的表格、树、编辑区要设置稳定高度或最大高度，避免内容撑出视口导致默认居中失效。
- 修改后验收默认打开态和拖动后状态：弹窗仍在可视区域内，标题/按钮/输入框不被导航、遮罩或浏览器边缘遮挡。

## 7.1 登录验证码与 Sys_Config

修改 `Microi.Client/src/views/login/index.vue` 或任何 PC 端登录扩展时，必须遵守平台登录验证码契约：

- 登录页加载系统配置后，用统一的 `isEnabledFlag(SysConfig.EnableCaptcha)` 判断是否开启验证码。`EnableCaptcha` 可能是 `1`、`true`、`'1'`、`'true'`，不能直接 `!!SysConfig.EnableCaptcha`。
- 开启时显示验证码输入框，调用 `GET /api/Captcha/GetCaptcha` 获取图片，读取响应头 `captchaid`，调用 `/api/SysUser/login` 时提交 `_CaptchaId/_CaptchaValue`。
- 登录失败时刷新验证码并清空输入；未开启时隐藏验证码并且不提交空验证码字段。
- PC 端和移动端都调用同一个后端登录契约，不能只在某一端支持验证码。
- 修改后要至少验证 `EnableCaptcha=1`、`EnableCaptcha='1'`、`EnableCaptcha=false` 三种情况。

文件同步、跨平台导入等需要登录另一套 Microi API 的前端工具，也必须复用同一验证码契约：

- 用户填写远程 `ApiBase` 和 `OsClient` 后，先请求远程 `/api/FormEngine/GetSysConfig`，按 `isEnabledFlag(EnableCaptcha)` 判断是否需要验证码，不能先盲目调用登录接口。
- 需要验证码时，自动请求远程 `/api/Captcha/GetCaptcha?OsClient=<OsClient>`，读取响应头 `captchaid` 并显示验证码图片；用户输入后，远程 `/api/SysUser/login` 必须同时提交 `_CaptchaId/_CaptchaValue`。
- 远程地址或租户变化时清空旧验证码和 Token；登录失败时刷新验证码。未开启验证码时不得显示验证码输入，也不得提交空验证码字段。
- 远程响应头必须通过 CORS 暴露 `captchaid` 和 `authorization`；前端还应兼容登录响应体中的 Token，避免只依赖响应头。

## Microi 前端 SDK 约束

当修改 `Microi.Client` 之外的 Vue3 前端、PC 官网、移动 H5 或定制微前端页面时，必须优先读取 `microi.skills/microi-frontend-sdk/SKILL.md` 并使用 `microi.skills/microi.v8.js`。`Microi.Client` 主后台已有平台请求与 Pinia 体系时，可以复用现有平台能力；但新增独立页面、外部站点、插件页、嵌入式页面不得再复制旧 Vue2/Vuex 版 `microi.v8.js`。

- 只保留 Vue3 写法，不新增 `Vue.prototype`、Vue2 条件编译或 Vuex 依赖。
- 业务请求、Token、上传、资源 URL 解析统一委托 SDK 或 Microi.Client 现有平台请求层。
- 后台仍使用 Element Plus；官网/产品站/文档站优先遵守 `microi.skills/ui-design/SKILL.md` 的 MCI-UI 策略。

## Vue3 前端微服务宿主规则

`sys_menu.OpenType=MicroService` 时，动态路由必须把 `MicroServiceId`、`MicroServicePageId`、`MicroServiceRoutePath` 和真实入口 `MicroAppUrl` 写入 route meta；浏览器侧菜单路由使用 `/#/micro-app/{MsKey}/{RoutePath}`，不要再生成 `/micro-app-host/{menuId}`，否则地址过长且刷新或直接访问菜单路由容易加载空白页。

同一个编译后的微服务可以绑定多个后台菜单和内部页面。`MicroAppHost` 的 `<micro-app name>` 必须包含菜单 Id、路由路径或其它实例维度，避免多个菜单共享同一个 appKey 时触发 `app name conflict`。入口 URL 中的 `microRoute/routePath` 只用于解析，最终应通过 `data.microRoute` 传给子应用，入口文件 URL 保持稳定。

后台配置必须配套维护 `sys_microiservice_page` 路由子表，并在 `sys_microiservice` 表单上用隐藏子模块 + `TableChild` 显示页面/路由。`sys_menu` 选择微服务时要由前端 V8 事件实时加载页面列表，不能完全依赖 SQL 下拉里的表单变量替换。

`sys_menu.MicroServiceId` 的字段值变更 V8 必须把 `V8.ThisValue` 传给页面列表加载函数，例如 `window.LoadMicroServicePages(V8, false, V8.ThisValue || V8.Form.MicroServiceId)`；不要只读取 `V8.Form.MicroServiceId`，因为字段变更触发瞬间表单模型可能仍是旧值或显示文本。页面列表加载函数必须支持从选中对象、保存 Id、`名称（MsKey）` 文本中解析服务，并在按 `MicroServiceId` 查询为空时按 `MicroServiceKey` 兜底查询。

`sys_menu` 的“选择微服务页面”联动必须允许读取草稿页面，不能在前端 V8 或 SQL 下拉里固定过滤 `sys_microiservice_page.IsEnable=1`。新建微服务后页面子表会先以草稿存在，过滤已启用会导致后台菜单无法选择页面；运行期可用性由菜单发布状态、微服务编译产物和宿主加载结果共同校验。

隐藏的 `TableChild`/子表菜单不得设置 `HasChild=1`。`Display=0` 或 `AppDisplay=0` 的菜单只用于表单子表承载，不应该让左侧菜单把上级业务菜单识别成空文件夹；前端动态路由和侧边栏判断父/子菜单时也必须只统计可见子菜单。

VS Code 插件创建前端微服务时，目录名必须以用户输入的微服务名称为准；除非法定文件名字符需要替换，否则不得自动追加 `{OsClient}~` 前缀。微服务名称可以包含中文、英文、数字和常见符号；`MsKey/appKey` 必须从名称生成可读且稳定的唯一值，同租户下冲突时只追加 `-2`、`-3` 这类序号，禁止因为中文被过滤而退化成租户默认 Key 并覆盖其它微服务。

`MsKey/appKey` 生成遇到中文时必须转成拼音安全串：前两个汉字取完整拼音，后续汉字取拼音首字母；英文和数字保留并转小写；空格、中文标点和常见特殊符号转成 `-` 或 `_`；最终只允许 ASCII 字母、数字、`-`、`_`。例如 `测试微服务六` 应生成类似 `ceshiwfwl`，禁止生成 `/micro-app/%E6%B5%8B...` 这类浏览器编码路由。

创建前端微服务不能只落本地目录。插件必须在 `.microi-micro-app.json` 写入 `osClient/apiBaseUrl/appKey/name` 后立刻刷新左侧树，让目录立即可见，然后再执行远端草稿注册与 `npm install`；远端需注册一条未发布占位记录，并用 `IsEnable=0` 表示尚未推送编译产物。如果目录已存在但远端记录缺失，再次创建同名微服务时必须补注册。左侧树显示微服务项目时，必须优先读取 `.microi-micro-app.json` 的 `osClient/apiBaseUrl` 判断归属，不能再依赖 `{OsClient}` 或 `{OsClient}~` 目录前缀过滤，否则中文或自定义名称目录会被错误隐藏。

推送前端微服务时必须按 `sys_microiservice.MsKey` 定位唯一微服务。如果本地项目的 `appKey` 已被远端其它微服务占用，必须先修正本地 `appKey` 再新增/更新，不得直接覆盖。`sys_microiservice.BuildVersion` 和 `sys_microiservice_page.BuildVersion` 从 `v1.0.0` 开始递增，规则为 `v1.0.9 -> v1.1.0`、`v1.9.9 -> v2.0.0`、`v9.9.9 -> v10.0.0`；上传到分布式存储/CDN 的路径必须包含该版本号，禁止继续使用时间戳目录。

VS Code 插件执行前端微服务构建前必须先安全清理当前项目自己的 `distDir`（默认 `dist`），并校验待删除目录位于微服务项目目录内；推送时只能收集本次干净构建产生的文件。禁止把旧 chunk、旧 hash 文件或历史构建残留写入 `AssetManifestJson` / `AssetsJson`，否则会造成数据库附件列表与当前 `index.html` 不一致。

### 表单下拉 Data 动态对象选项

表单 V8 通过 `V8.FieldSet('字段名', 'Data', objectRows)` 动态写入下拉数据时，如果 `objectRows` 是对象数组，即使 `diy_field.Config.DataSource='Data'`，前端也必须按对象数据源处理，并使用 `SelectLabel/SelectSaveField` 或常见字段兜底生成 label/value。禁止把对象数组按普通字符串 Data 源过滤，否则会出现接口已有数据但下拉显示“无数据”的回归。

## 在线 AI 应用与微服务页面协作

Microi 的在线 AI 应用统一使用 `mci_ai_app / mci_ai_app_file / mci_ai_app_version` 保存 Web、UniApp、MicroService 的应用、私有源码和版本。MicroService 另外使用 `sys_microiservice / sys_microiservice_page` 保存运行元数据和页面路由。

- 开始改页面前先通过 MCP 的 `microi_list_applications` 和 `microi_get_application_context` 读取应用、文件树与源码，不得只看本地目录。
- 在线 AI 工作台应允许三种应用在线编辑、保存、运行/预览、下载源码/编译包、制作离线包、发布应用商城；不能在前端单独拦截 `MicroService` 构建。
- 源码一律上传当前租户私有 HDFS；最终编译文件一律上传公有 HDFS。应用商城包使用 `ApplicationBundle.SchemaVersion=2 + PackageAssets`：编译 ZIP 必须上传公有桶并允许匿名下载，源码 ZIP 按应用选配且默认不发布；数据库只保存公开 ZIP 路径、大小、校验值，禁止再把每个源码/构建文件以 `FileByteBase64` 写入 `AppPakcet`。安装端下载 ZIP 后必须通过目标租户 HDFS 适配器重新上传。旧版 `SourceFiles/BuildAssets` 逐文件 Base64 仅作为向后兼容读取格式。
- V8/Jint 沙箱禁止接口脚本直接访问 `System.IO`。创建和解压应用 ZIP 必须使用受控的 `V8.Method.CreateZip / ExtractZip`，由服务端统一执行 Zip Slip、文件数、单文件大小、解压总大小和异常压缩比检查，禁止放开 `System.IO` 黑名单。
- 商城字段 `AppType` 是历史“应用类别（官方/社区）”；运行类型使用独立 `ApplicationType`，枚举为 `Regular / MicroService / UniApp / Web`，禁止复用 `AppType` 破坏旧筛选。
- 三类前端应用可复用 `ApplicationBundle` 文件传输协议，但运行安装不同：MicroService 还要写 `sys_microiservice_page`，Web/UniApp 只维护 AI 应用与版本，因此商城必须保存明确类型，不能合并成一个含糊枚举。
