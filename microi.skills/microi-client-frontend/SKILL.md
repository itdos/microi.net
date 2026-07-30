---
name: microi-client-frontend
description: Microi.Client 源码架构指南。用于修改 Microi.Client Vue 前端代码，尤其是表单引擎、diy-table、diy-form-full、工作流面板、sys_menu 按钮、前端 V8 事件、路由以及页面/弹窗/抽屉行为。
---

# Microi.Client 前台源码架构说明

## 单行文本插槽按钮约定

- `diy-input.vue` 的插槽按钮行为存储在 `diy_field.Config.SlotButtonV8Code`。
- 点击事件通过 `CallbackRunV8Code` 进入 `diy-form.vue` 的统一前端 V8 上下文，事件名为 `FieldSlotButtonClick`。
- 禁止再新增或依赖 `OpenTableId` 一类硬编码目标；打开表格、表单、微服务或调用接口均由 V8 代码决定。
- 历史键 `ReadOnlyButton` 继续兼容，设计器显示为【禁用插槽按钮】。

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

### 模块级跨端视图

- Detail/Edit/List/Card 视图属于 `sys_menu`，使用物理字段 `EnableViewSchema`、`ViewSchemaVersion`、`ViewConfigVersion`、`ViewSchema`。
- `diy_table.DiyConfig`、`diy_field.DiyConfig`、`sys_menu.DiyConfig` 均为废弃兼容字段；禁止向其中写入任何新功能配置。
- Text、Select、ImgUpload、Map 等数据控件继续放在 `diy-field-component`。
- EntityHero、MetricStrip、ActionGrid、ResponsiveSection 是独立展示区块，放在 `form-view-blocks`，禁止用虚拟字段或 DevComponent 模拟。
- PC 详情使用只读视图渲染器，编辑继续复用完整 `DiyForm`。未被视图区块引用的字段必须有兜底分组，不能因移动端视图精简而丢失 PC 字段。
- 小程序只执行白名单 ActionSchema，不执行任意前端 V8。复杂业务统一调用接口引擎，重要提交校验放在后端表单事件。
- 新视图缺失、禁用或解析失败时必须回退到现有模块/表单，禁止白屏。

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

### 前端 V8 上下文不是固定 DTO

`DiyCommon.SetV8DefaultValue()` 只创建基础能力，`diy-table.vue`、`diy-form.vue`、`diy-form-full.vue` 和各 mixin 会按事件再挂载动态属性。新增 API 或修正文档时必须同时核对这些入口，不能只看一个 `V8` 对象字面量。

常见上下文差异：

| 场景 | 可靠上下文 |
|------|------------|
| 表单字段值变化 | `V8.Form`、`V8.ThisValue`、`V8.EventName='FieldValueChange'` |
| 普通 `diy-form` 字段变化 | 不保证存在 `V8.OldValue`；需要旧值时应由业务代码自己保存 |
| 列表行内编辑 | `V8.Row`、`V8.RowIndex`、`V8.ThisValue`、`V8.OldValue` |
| 表单字段键盘事件 | `V8.EventName='FieldOnKeyup'`、`V8.KeyCode` |
| 列表字段键盘事件 | `V8.EventName='TableFieldOnKeyup'`、`V8.KeyCode` |
| 字段插槽按钮 | `V8.EventName='FieldSlotButtonClick'`、`V8.Event` |
| 列表按钮/批量按钮 | `V8.Row` 或 `V8.Rows`、`V8.TableRowSelected`、`V8.SysMenuId` |

`V8.FormSet()` 在普通 `diy-form` 中可能继续触发目标字段 V8；在 `diy-table` 行/模板上下文中通常只更新当前行或模板数据。需要静默赋值时直接修改当前上下文模型，并防止字段事件递归。

标准前端 V8 会挂载 `FormEngine`、`ApiEngine`、`DataSourceEngine`、`Http`、`Base64` 等能力；虽然 `DiyCommon.ModuleEngine` 有底层实现，标准全局 V8 当前并未挂载 `V8.ModuleEngine`，文档和编辑器提示不得把它当作可用 API。

`V8.SysConfig` 是面向浏览器的脱敏公开配置投影，不得依赖其中出现数据库连接串、对象存储密钥、短信/邮件密码或其它 SaaS 私密字段。

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

`PageTabs.TargetSysMenuId` 是通用的跨模块页签协议。未配置时继续执行当前模块的页签 V8；配置其它 `sys_menu.Id` 时，`diy-table.vue` 使用动态路由替换当前地址，让目标模块按自身 `sys_menu / diy_table / diy_field` 完整重建，并移除旧的顶部访问标签。不得为应用商城或其它单一模块在 schema/data mixin 中增加专用数据源分支。

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
- `diy-design.vue` 会复用同一个命名路由与 keep-alive 实例。必须以 `TableId + PageType` 作为表单实例 Key，并监听 `$route.fullPath`、在 `activated` 中同步路由上下文、清理旧表字段状态并重新加载；只依赖首次 `mounted` 会造成从列表跳转后白屏或显示上一张表。

### `/online-office` 匿名只读路由

- 路由 `meta.anonymous=true` 只表示无需登录即可进入页面，不代表页面内的文件自动公开。组件仍必须校验文件边界。
- 匿名公有存储场景只允许当前 `OsClient` 目录下的 `filePathName`；接口响应文件场景用 `fileUrl` 接收当前平台正式 `ApiBase`，或由同端口本地后端读取的 loopback `/apiengine/...`，并要求 URL 显式携带当前 `OsClient`。两种场景都拒绝私有文件、跨租户路径、路径穿越和任意第三方域名。
- `fileUrl` 路径没有文件扩展名时必须同时传 `fileName` 或 `fileType`。组件先调用 `/api/HDFS/PrepareOfficePreviewFromUrl`，由后端严格校验当前平台、当前 `OsClient` 和单层 `/apiengine/{key}`，再把响应文件透明缓存到当前租户公有对象存储；OnlyOffice 使用返回的公网静态地址。开发环境 loopback 只允许同端口本地后端读取，不能简单替换 origin，也不能把该接口扩展成通用 URL 代理。
- `canEdit` 不能直接作为授权结果。最终允许编辑必须同时满足有效登录态；匿名即使传 `canEdit=1` 也强制使用 OnlyOffice `mode:'view'` 和 `permissions.edit=false`。
- 私有文件调用 `/api/HDFS/GetPrivateFileUrl` 时传 `ForOfficePreview:true`，让远程 OnlyOffice 使用租户公网 `ApiBase` 的审计代理地址，避免 `localhost` 导致“下载失败”。
- `layout/index.vue` 仅在“路由要求隐藏外壳且当前无有效登录用户”时隐藏 Sidebar/Navbar/TagsView；登录用户打开同一路由仍保留正常系统布局。
- 不要把匿名路由简单加入全局白名单后跳过组件鉴权；过期 Token 要清理，公有文件校验失败必须停止创建 OnlyOffice 配置。

### 在线微服务弹窗（OpenAppDialog）

`V8.OpenAppDialog` 是 V8 定制页面的标准入口，宿主实现位于：

| 文件 | 职责 |
|------|------|
| `views/micro-app/dialog.vue` | 按 `AppKey` 解析稳定入口 `/micro-app/{OsClient}/{AppKey}/index.html?v={Version}`；版本只用于缓存失效，不得写进入口路径。 |
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

### 前端 V8.Http 与后端同构契约

`Microi.Client` 的前端 V8 运行时在 `src/utils/diy.common.js` 挂载 `V8.Http`，实现位于 `src/utils/v8-http.js`。修改 HTTP 能力时必须保持：

- 新接口使用与后端一致的 PascalCase 对象参数：`Get/GetResponse`、`Post/PostResponse`、`Patch/PatchResponse`。
- GET 使用 `GetParam`，POST 使用 `PostParam/PostParamString`，PATCH 使用 `PatchParam/PatchParamString`。
- 通用参数包括 `Url`、`ParamType`、`Timeout/TimeOut`、`Headers/Header`、`FilesByteBase64/FilesByteString/FilesByte`。
- 浏览器端必须 `await V8.Http.*`；字符串方法返回原始文本，Response 方法返回 `Content/Headers/RawBytes/StatusCode/ErrorMessage`。
- 表单事件、按钮 V8 等宿主前端新代码必须优先使用 `V8.Http`，不得再把旧 `V8.Post/Get` 作为新功能首选。
- 历史 `V8.Post/Get` 及其回调、Promise 写法必须继续保留，不能通过重命名或替换破坏旧 V8 代码。
- 相对地址或当前 `ApiBase` 才能自动携带登录头；外部绝对地址禁止自动附加吾码 Token。第三方浏览器请求需满足 CORS。
- 修改后至少运行 `npm run test:v8-http` 和 `npm run build`，并同步前后端代码编辑器提示与官方文档。

### FormEngine 前端封装以 `diy.common.js` 为准

前端 `DiyCommon.FormEngine` 不是后端 `FormEngine` 方法的一比一暴露，动表单引擎数据前必须先查 `Microi.Client/src/utils/diy.common.js` 的真实封装。当前前端方法为：

| 类型 | 方法 |
|------|------|
| 通用底层 | `CommonFormEngineFunc` |
| 单条/列表读取 | `GetFormData`、`GetFormDataAnonymous`、`GetTableData`、`GetTableTree` |
| 新增 | `AddFormData`、`AddFormDataBatch` |
| 修改 | `UptFormData`、`UptFormDataBatch`、`UptFormDataByWhere` |
| 删除 | `DelFormData`、`DelFormDataBatch`、`DelFormDataByWhere` |

这些方法支持 Promise，历史回调参数继续兼容。前端当前没有 `GetTableDataCount`、`GetTableDataTree`、`AddTableData`、`UptTableData`、`DelTableData`、`AddField`；不能因为后端 V8 存在同名或相近能力，就在浏览器端直接调用。

单条新增评论、日志、草稿等业务数据时使用：

```js
await DiyCommon.FormEngine.AddFormData("table_name", {
  Field: "value"
});
```

或：

```js
DiyCommon.FormEngine.AddFormData("table_name", { Field: "value" }, function (result) {});
```

前端 FormEngine 还必须使用统一的菜单上下文封装：

- 当前菜单绑定表会自动补真实 `_SysMenuId`。
- 跨表调用不能继承当前菜单 Id，否则会把无关菜单的数据范围错误套到目标表；未显式指定目标菜单时，由后端从当前用户的版本化授权缓存中推断其对目标表的菜单/表级权限。
- 传入 `_SysMenuId`、历史 `SysMenuId` 或 `ModuleEngineKey` 表示调用方选择了明确菜单，后端必须按该菜单严格校验，失败时不能回退。
- 受保护的平台表始终受敏感资源策略限制。`_InvokeType:'Client'` 只控制表单事件触发方式，不是授权绕过参数。
- `TableChild` 使用运行时生成的不透明 `_TableChildAuth`；后端会重新验证父菜单、父记录、字段关系、外键和数据范围。业务代码不得手工伪造。
- 导入、导出必须锚定真实菜单；通用 CRUD 的历史无菜单兼容不能扩展到批量数据传输。

前端作用域封装在注入菜单/子表上下文时必须克隆待修改对象，不得把内部 `_SysMenuId` / `_TableChildAuth` 写回调用者；字符串、对象、批量参数、回调和 Promise 语义都要保持兼容。授权快照由后端按租户/用户隔离，使用共享 Redis 版本号和带 TTL 的快照；外部授权检查读取共享版本，权限变更后旧快照不可达，Redis 故障则回源数据库。不能在每次 CRUD 里重新查询整套角色/菜单，也不能用进程内缓存作为多节点事实源。

### OpenAnyTable / 模板 HTML / ConfirmTips 安全边界

- `OpenAnyTable` 应传已授权的 `SysMenuId` / `ModuleEngineKey` 和 `SubmitEvent`，由目标模块按自身表、字段和权限初始化。不要先通过通用 FormEngine 读取 `sys_menu` 来发现任意模块，也不要只传物理 `TableName` 试图绕过菜单。
- 表格/表单 V8 模板结果通过 `v-safe-html` / DOMPurify 渲染；`onclick`、`onerror`、`javascript:` 等危险内容会被移除。交互请使用平台按钮、插槽或安全链接，不要把内联事件写进模板字符串。
- `V8.ConfirmTips` 内部使用 Element Plus 的 HTML 模式。只允许固定可信 HTML；数据库、URL、用户输入等动态值必须先进行 HTML/属性转义，路由参数还要 `encodeURIComponent`。它是回调式确认框，不能假定 `await V8.ConfirmTips()` 会直接返回用户选择。
- 前端 `V8.Base64` 来自 `js-base64`，真实方法是 `encode`、`decode`、`isValid`，不要写成后端的 `StringToBase64/Base64ToString`。

### V8 文档与编辑器提示同步

修改前端 V8 能力、属性、事件名或参数契约时，至少同步核对：

- 运行时：`src/utils/diy.common.js`、`diy-table.vue`、`diy-form.vue`、`diy-form-full.vue` 及其 mixins。
- Monaco 提示：`src/views/form-engine/diy-components/v8-api-definitions.js`。

### DevComponent 聚合多个原字段

不属于通用表单控件、只服务某张平台配置表的复杂设计器，放在 `src/views/form-engine/diy-components/`，不要加入 `diy-field-component` 标准控件目录。选择一个现有物理字段作为 `DevComponent` 入口，在 `Config` 中写 `DevComponentName/DevComponentPath`；组件通过 `FormDiyTableModel` 读取同表其它字段，并同时发出 `ParentFormSet(fieldName, value)` 与 `CallbackFormValueChange` 更新它们。

`sys_menu` 的数据权限设计器固定使用 `SqlWhere` 作为入口，聚合 `SqlWhere / SqlJoin / JoinTables`：

- 组件路径为 `@/views/form-engine/diy-components/diy-data-permission-designer.vue`，名称为 `DiyDataPermissionDesigner`；旧 `SqlJoin/JoinTables` 字段只隐藏，不删除、不改物理列。
- 设计器只保留【可见范围 / 关联关系】两个 Tab：桌面端左侧展示图形配置，右侧固定展示实时 SQL；可见范围右侧的单个代码编辑器展示最终 `SqlWhere`，关联关系右侧的只读代码编辑器展示 `SqlJoin`，窄屏才回落为上下布局。禁止重新加入“原始值”Tab，以及“重新读取 / 应用到表单 / 从原始值反推 / 同步原始值”等手工同步按钮。
- 图形配置变化后应防抖并自动写回 `SqlWhere / SqlJoin / JoinTables`，用户只需保存模块。最终 `SqlWhere` 代码编辑器始终允许手动编辑，不设置“自动生成 / 高级手写”模式开关；只有左侧图形配置变化时才重新生成并覆盖右侧正文，直接手写时以编辑器正文为准。历史手写 SQL 原样进入编辑器，禁止自动拆解成多个 OR 或短暂生成 `1 = 0`。
- 自动生成的最终 `SqlWhere` 使用带固定前缀 `-- 【权限说明】` 的单行中文注释，就近解释外层括号、租户隔离、AND/OR 组合、超级管理员、普通用户范围、全量角色/岗位/部门、图形条件和闭合括号；不得再生成整段 `/* ... */` 说明。后端还要兼容剥离历史 `-- 【吾码权限说明】`。图形配置使用首行紧凑明文 JSON `-- MICROI_DATA_PERMISSION_CONFIG:{...}` 恢复，省略默认值且不重复保存 `SqlJoin/JoinTables`；旧 `-- MICROI_DATA_PERMISSION_V1:...` Base64 marker 只读兼容、不再生成，设计器不得展示 marker。后端执行前只剥离这些平台专用注释，用户手写注释必须保留。`SqlJoin` 继续保存 JOIN，`JoinTables` 继续保存关联表 JSON，后端协议不变。
- 有新旧 marker 的配置必须无损回显；没有 marker 的历史手写 SQL 只能原样保留或安全解析字段提示。标准表单对 `CodeEditor` 使用的 `_CodeEditorTransport` 必须由 FormEngine 控制器在进入业务逻辑前统一解码，数据库只保存明文；非法批次不得产生部分解码。
- 角色、岗位、部门属于查看者放行规则；本人、本人和下级、部门范围属于行范围。超级管理员默认放行，但启用 TenantId 隔离时也不能跨租户。所有表名、别名和字段名生成前做标识符白名单，固定值转义单引号。
- 官方 `microi_itdos` 与开发租户更新 `diy_field` 后都要刷新 `sys_menu` 表/字段缓存并回读 `Component/Visible/AppVisible/Config`；应用商城资源同步修改 `Microi.Upgrade/Resource/app.microi.module-engine.json`。
- 官方文档：`microi.doc/docs/doc/v8-engine/v8-client.md`。
- Skills：`v8-frontend-events`、`v8-table-event`、`v8-menu-buttons`、`v8-template-engine`、`v8-formengine-http` 和本 Skill。

固定高度的 `diy-form-full` 弹窗只能有一个纵向滚动容器：由弹窗直属 `.el-dialog__body` 承载滚动，Element Plus 的 overlay 和表单顶层 `.el-tabs__content` 必须禁用独立滚动。禁止同时保留 overlay、dialog body、tabs content 三层纵向滚动条；切换表单 Tab 时弹窗外框高度不得变化。

自动化静态检查至少覆盖方法名、事件名、示例参数和危险 HTML；真实页面还要验证表单/列表两种上下文、普通角色菜单范围、跨表历史 V8、TableChild、并发 Token 续签及移动端。

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

### 复盘：模板渲染期间构造 V8 上下文导致递归更新

- 触发场景：列表行按钮通过 `V8.OpenDialog` 首次打开打印引擎等异步组件时，页面报 `Maximum recursive updates exceeded in component <DiyTableRowlist>`，严重时浏览器卡死。
- 根因：模板绑定直接调用 `GetDiyCustomDialogDataAppend()`；该方法内部执行 `SetV8DefaultValue()`，而后者会更新表格选择态、工作流和 V8 缓存等响应式数据，形成“渲染 -> 写状态 -> 再渲染”的闭环。
- 通用规则：模板渲染函数必须保持无副作用。弹窗所需 V8 上下文应在 `OpenDialog` 点击事件中一次性生成并保存，模板只绑定稳定的数据对象；禁止在模板表达式、render 函数、computed getter 中调用会写响应式状态的方法。
- 自动化检查：在真实列表点击一次和连续点击两次 `V8.OpenDialog` 行按钮，断言弹窗正常打开、页面仍可交互，控制台不出现 `Maximum recursive updates`、Vue errorHandler 或未处理 Promise 错误。

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

### PC/移动自适应 Token 续签

- PC 登录传 `_ClientType:'PC'`；`diyStore.IsPhoneView` 的移动自适应登录传 `_ClientType:'Mobile'`。完整协议以 `microi-frontend-sdk/SKILL.md` 为准。
- `DiyCommon.getToken()` 是 Microi.Client 请求发送时的 Token 单一事实源；不得先用 Pinia、组件 data 或其它副本判断“是否需要携带 X-Token”，否则持久化恢复或并发续签后会把有效 Token 漏掉。受保护请求收到新 `authorization/token` 后，必须先更新公共存储，再同步 Pinia；登录成功也要在生成动态路由前完成同样的同步。
- `TokenExpires` 表示“下次应检查续签的时间”，不能固定成所有终端 15 分钟；应从 JWT `exp` 和 `MicroiTokenIssuedAt` 按 10% 提前量计算，最少 5 分钟、最多 1 天。
- `App.vue` 除一分钟维护定时器外，还必须监听 `visibilitychange`、`focus`、`pageshow`。标签页从浏览器休眠恢复时先走 single-flight RefreshToken，再发业务请求。
- `Code=1001/1002` 或明确的 `NoLogin / Token签名验证失败` 时展示后端原始 `Msg`。确认失败响应对应的仍是当前 Token 后，必须清理 Token，并携带当前 Hash 用 `location.replace` 完整进入登录页，重建旧页签的动态路由与组件状态，禁止停留在空白页。
- 多 Tab 共享 Token 时，旧请求返回不得覆盖新 Token，也不得因旧 Token 的失效响应清除另一个 Tab 已写入的新 Token。

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

前端微服务源码必须直接并入 V8 租户目录：`Microi-V8-Engine/{系统名称} ({ApiBase域名})/{OsClient}.{OsClientType}.{OsClientNetwork}/AI应用/{appKey}`，不得再为新项目创建独立的 `Microi-MicroApp` 根目录。这样接口引擎、表单引擎、模块引擎、流程引擎和 AI 应用可以在同一租户 Git 仓库中统一管理。不同服务器或租户的相同 `appKey` 不能共用本地目录。插件要提供“拉取服务器前端微服务”，通过在线应用上下文读取 `mci_ai_app_file` 的私有 HDFS 源码；`sys_microiservice` 只有公有运行产物时必须明确提示“无私有源码”，不得生成伪源码。旧版 `Microi-MicroApp` 目录只兼容展示；迁移到 `AI应用` 必须先明确提示用户，不得静默移动、覆盖或删除。

前端微服务拉取必须维护独立的源码同步基线（不得混入要上传的业务源码），用“上次同步基线 / 当前本地 / 当前私有 HDFS 源码”做三方比较。已有本地目录时必须先统计仅本地修改、仅远端修改和双方冲突，支持查看逐文件同步状态；只有用户明确选择强制拉取后，才可按远端源码覆盖同名文件并删除远端已不存在的受管源码文件。`node_modules`、构建目录、Git/IDE 配置和插件本地元数据不参与比较、覆盖或源码上传。

微服务项目节点必须把“构建并推送”和“查看同步状态”都作为可见的行内操作。同步检测结果不得只放在一次性的顶部 QuickPick 中；一次检测后应保留在侧边“同步结果”树，按冲突、服务器较新、本地未推送分组，允许用户连续切换并打开多个文件差异而不重复扫描服务器。

推送前端微服务时必须按 `sys_microiservice.MsKey` 定位唯一微服务。如果本地项目的 `appKey` 已被远端其它微服务占用，必须先修正本地 `appKey` 再新增/更新，不得直接覆盖。`sys_microiservice.BuildVersion` 和 `sys_microiservice_page.BuildVersion` 从 `v1.0.0` 开始递增，规则为 `v1.0.9 -> v1.1.0`、`v1.9.9 -> v2.0.0`、`v9.9.9 -> v10.0.0`；上传到分布式存储/CDN 的路径必须包含该版本号，禁止继续使用时间戳目录。

VS Code 插件执行前端微服务构建前必须先安全清理当前项目自己的 `distDir`（默认 `dist`），并校验待删除目录位于微服务项目目录内；推送时只能收集本次干净构建产生的文件。禁止把旧 chunk、旧 hash 文件或历史构建残留写入 `AssetManifestJson` / `AssetsJson`，否则会造成数据库附件列表与当前 `index.html` 不一致。

“构建并推送前端微服务”必须在本地构建通过后，先把完整受管源码同步到当前租户私有 HDFS（主数据写入 `sys_microistore`，源码清单写入 `mci_ai_app_file`），再发布公有 HDFS 编译产物并更新 `sys_microiservice / sys_microiservice_page`。源码同步失败必须终止发布并向用户报错，禁止吞掉异常后留下“新运行产物已发布但没有对应源码”的半完成状态。

### MCP 创建本地 Vue 微服务闭环

- VS Code 生成本地 stdio MCP 配置时必须注入 `MICROI_WORKSPACE_ROOT`、`MICROI_SYNC_ROOT` 和当前服务器/租户的 `MICROI_AI_APPLICATIONS_DIR`。路径由插件的服务器目录名、`OsClient.Type.Network` 和 `AI应用` 规则计算，AI 不得根据 MCP 进程 `cwd` 猜工作区或租户目录。
- 新建 Vue 微服务先调用 `microi_scaffold_vue_microservice` 且不传 `confirmExecution`，核对目标目录、路由和文件清单；确认后把 `confirmExecution` 精确设为 `appKey`。工具只能写入真实且名为 `AI应用` 的目录，按 AppKey 原子创建，目标存在且不是同一清单时必须拒绝覆盖。
- `routes` 是页面源码、`microi.routes.json`、发布路由和菜单绑定的共同事实源；一条路由只生成一个页面文件，必须明确 `path/name/title/sourceFile/isHome`。不能为了提供默认首页额外生成一个未被需求或菜单使用的第三页面。
- 脚手架完成后依次执行：`npm install`、本地构建、`microi_create_microservice`、`microi_sync_microservice_source`、`microi_publish_application_directory_stream`。真实编译目录优先流式发布；只有当前服务器尚未部署流式端点且产物很小时，才允许临时使用兼容的 `microi_publish_microservice`，并在交付结论中如实注明。
- 发布回读取得 `sys_microiservice.Id` 与每条 `sys_microiservice_page.Id` 后，使用 `microi_create_module` 一次传入 `openType=MicroService`、`microServiceId`、`microServicePageId`、`microServiceRoutePath`、`microServiceKey`。菜单工具必须写后回读这些字段；不得长期依赖“先建普通 URL 菜单，再手工补字段”的两步绕路。
- 最终通过 `microi_get_application_context`、`microi_get_microservice`、`microi_get_module` 和真实登录后的两个友好菜单路由逐层验收；连续切换两个菜单，检查页面标题、MicroApp 上下文、Vue 交互、无 404/5xx/白屏/实例冲突，并保存 fullPage 截图后用 `view_image` 复核。

### 表单下拉 Data 动态对象选项

表单 V8 通过 `V8.FieldSet('字段名', 'Data', objectRows)` 动态写入下拉数据时，如果 `objectRows` 是对象数组，即使 `diy_field.Config.DataSource='Data'`，前端也必须按对象数据源处理，并使用 `SelectLabel/SelectSaveField` 或常见字段兜底生成 label/value。禁止把对象数组按普通字符串 Data 源过滤，否则会出现接口已有数据但下拉显示“无数据”的回归。

### 复盘：历史 OpenIframe 打印入口在 Vue3 弹窗中空白

- 触发场景：同一租户的旧正式版打印正常，最新版列表点击打印只打开空白抽屉；数据库中的当前按钮已改成 `PrintEngineView`，但运行态菜单缓存仍可能返回历史 `ComponentName: 'OpenIframe'`。
- 根因：Vue3 全局组件表移除了 Vue2 的 `OpenIframe` 注册，动态组件只能渲染成未知标签；同时历史 `DataApi` 可能带有 `https:/host` 这种单斜杠协议地址。
- 通用规则：必须保留 `OpenIframe` 兼容入口。含 `PrintId` 的旧打印参数转交当前内置 `PrintEngineView`，普通 URL 弹窗继续使用 iframe；打印数据地址进入请求层前统一修正单斜杠 HTTP(S) 协议。排查时必须同时核对数据库 V8 与浏览器运行态 V8，不能只比较服务器记录。
- 分层排查：打印画布恢复后仍无业务数据时，继续直接运行 `DataApi` 及其 `V8.ApiEngine.Run` 依赖，逐一对比测试/正式环境的 `IsEnable/StopHttp/AllowAnonymous` 和真实返回；旧后端对仅赋值 `V8.Result` 的依赖可能需要同时保留赋值并显式 `return V8.Result`。不得把前端空白、数据接口失败和浏览器打印输出混成同一个结论。
- 自动化检查：打开真实列表连续点击两次旧打印按钮，断言抽屉内出现打印引擎、打印数据接口成功、出现浏览器打印日志，并且没有未知组件警告、递归更新、页面异常或失败请求；保存首次和重复点击截图。

## 在线 AI 应用与微服务页面协作

Microi 的 AI 应用与应用商城只有一个主数据源：`sys_microistore`。运行类型写入 `ApplicationType`：普通平台离线包的新建默认值为 `Regular`，既有商城平台应用/通知仍使用 `Platform`，另外还有 `Web / UniApp / MicroService`；读取端必须兼容 `Regular/Platform`。`Category` 保存游戏、企业、行业、教育等业务分类，`PublisherType` 保存官方/社区来源；`mci_ai_app_file / mci_ai_app_version` 仅作为私有源码清单和构建版本从表，其 `AppId` 必须指向 `sys_microistore.Id`。禁止再向 `mci_ai_app` 创建新的主记录。MicroService 另外使用 `sys_microiservice / sys_microiservice_page` 保存运行元数据和页面路由。

- 开始改页面前先通过 MCP 的 `microi_list_applications` 和 `microi_get_application_context` 读取应用、文件树与源码，不得只看本地目录。
- 在线 AI 工作台应允许三种应用在线编辑、保存、运行/预览、下载源码/编译包、制作离线包、发布应用商城；不能在前端单独拦截 `MicroService` 构建。
- 源码一律上传当前租户私有 HDFS；最终编译文件一律上传公有 HDFS。应用商城包使用 `ApplicationBundle.SchemaVersion=2 + PackageAssets`：编译 ZIP 必须上传公有桶并允许匿名下载，源码 ZIP 按应用选配且默认不发布；数据库只保存公开 ZIP 路径、大小、校验值，禁止再把每个源码/构建文件以 `FileByteBase64` 写入 `AppPakcet`。安装端下载 ZIP 后必须通过目标租户 HDFS 适配器重新上传。旧版 `SourceFiles/BuildAssets` 逐文件 Base64 仅作为向后兼容读取格式。
- V8/Jint 沙箱禁止接口脚本直接访问 `System.IO`。创建和解压应用 ZIP 必须使用受控的 `V8.Method.CreateZip / ExtractZip`，由服务端统一执行 Zip Slip、文件数、单文件大小、解压总大小和异常压缩比检查，禁止放开 `System.IO` 黑名单。
- `AppType` 是历史复用字段，旧包/接口曾把它用于官方/社区来源，也曾把它作为运行类型回退。新代码只在读取旧数据时回退，写入使用 `ApplicationType + PublisherType`，禁止继续扩大混用。
- 三类前端应用可复用 `ApplicationBundle` 文件传输协议，但运行安装不同：MicroService 还要写 `sys_microiservice_page`，Web/UniApp 只维护 AI 应用与版本，因此商城必须保存明确类型，不能合并成一个含糊枚举。
- 在线商城记录可以保存可下载 ZIP 引用；用户下载的离线 JSON 则必须自包含最新运行产物，勾选“同时发布源码”时再额外内嵌私有源码。无源码只限制二次开发，不能阻断已经发布页面的运行。
- 平台自有打包/导入接口不得假设客户全局 V8 已定义 `DateNow` 等辅助函数；应在接口内实现 `DateNow -> System.DateTime.Now -> ISO` 的局部回退，升级时只差量更新平台接口，禁止覆盖客户系统设置中的全局 V8。
- 微服务安装器写入 `sys_microiservice_page` 后，应读取路由元数据中的 `LegacyMenuUrls/LegacyComponentPaths`。插件同步 `microi.routes.json` 时必须同时接受这些字段位于路由顶层或 `meta` 内、camelCase 或 PascalCase，并统一写入 `RouteMetaJson`，禁止静默丢弃。目标服务器可把占位或历史菜单迁移到 `/micro-app/host`，将 `Url` 写成包含稳定 `MsKey` 的 `/micro-app/{MsKey}/{route}` 并补齐服务、页面和路由字段；原开发服务器若已有可运行的原生 `ComponentPath`，重复打包/安装必须保留该菜单，不能破坏现有路由。
- 微服务菜单的友好路由必须优先使用稳定的 `MsKey`，前端菜单查询要携带 `MicroServiceKey/MsKey`；后端资源控制器同时兼容按 `MsKey` 和历史服务 `Id` 查找。动态路由必须把原菜单 URL、`/micro-app/{MsKey}/{route}`、`/micro-app/{Id}/{route}` 注册为同一宿主页的主路径/别名，使新旧书签同时可用，不能要求客户改一次菜单就废弃旧地址。

### AI 应用工作台页面预览映射

- `microi.routes.json` 的页面路由建议显式保存 `sourceFile`（例如 `src/CreateSaasTenant.vue`）；插件创建、读取、同步微服务时必须保留该字段。旧项目没有 `sourceFile` 时，工作台才从 `main.js/routes.js` 的 import、route 条件和文件名约定推断。
- 用户处于“预览”视图时点击页面级 Vue/JSX 文件，应保持预览并切换对应 `microRoute`；点击工具、样式、配置等非页面文件时才切到源码。处于源码视图时点击页面文件仍先显示源码，但要同步记录下次预览的路由。
- 微服务、Web 应用默认 PC 预览，只有 UniApp 默认移动端预览。源码/编译代码树切换使用紧凑圆角分段控件，运行类型必须显示本地化名称，禁止直接用长英文枚举挤压标题。

### AI 对话历史与模型列表

- AI 对话归档状态保存到 `mic_ai_record.Content.Archived`，按 `ConversationId` 成组更新和展示；归档或还原后刷新当前列表，但不得擅自切换【AI对话 / 已归档】Tab。归档是状态变更，不能删除消息记录。
- 对话标题属于 `ConversationId` 分组属性。修改标题时必须更新该会话的全部 `mic_ai_record.Content.Title`，不能只改第一条或只改前端内存；入口应在行悬停操作区并阻止触发会话切换。
- 服务端构造历史上下文时必须排除 assistant 运行期错误（授权失败、网络失败、明确标记的 `Error` 等）。错误提示可以保留在历史界面供排查，但不得进入最近消息或自动摘要，否则旧会话会在故障恢复后继续复述已失效错误。

### 复盘：旧会话被历史授权错误持续污染

- 触发场景：同一模型的新会话正常，旧会话发送任何消息却持续回答旧的“开源版无法使用在线 AI”。
- 根因：运行期授权错误以普通 assistant 消息保存，服务端随后把它重新加入模型上下文，模型把已失效错误当成当前系统事实。
- 通用规则：历史展示和模型上下文必须分层；所有明确的运行期错误都保留用于审计，但在上下文组装、摘要和向量化前统一过滤。
- 自动化检查：先制造一次授权失败并保存错误，再恢复授权后在同一 `ConversationId` 发送普通问题；断言请求上下文不含旧错误且回答恢复正常。
- 中转模型选择器必须显示和提交模型 Id，厂商 `DisplayName` 只能作为辅助说明，不能替代模型 Id。
- `mic_ai` 的中转站配置允许 `AiModel` 为空，实际运行模型来自中转模型选择器；发送校验和所有 AI 请求统一使用“普通模型的 `AiModel` / 中转站的 `RelayModel`”解析结果，同时保留中转站配置的 `AiModelId`。
- AI 引擎列表通过 `PropsSysMenuId` 使用模块设计中的 `SelectFields/SearchFieldIds`；禁止再传硬编码 `PropsSelectFields` 覆盖模块设计，否则新增的【加入AI中转站】等列不会显示。

### 官网个人中心 i18n

- 官网 Markdown 中英文继续使用独立 URL 以利 SEO；`profile.html` 这类登录态单页使用常规前端 i18n 字典，固定文案必须在源码维护中英文对照，并记住用户选择。
- `profile.html` 只保留导航栏中的一个语言切换入口，切换个人中心字典时不得跳转 `/en/profile.html`；离开个人中心后仍使用 VitePress 原有的路由式语言切换。
- 个人中心路由本身是公开静态页，不能把“能打开 URL”或本地缓存中的用户对象当成有效登录。必须调用受保护接口验证 Token；收到 `1001/1002` 或明确过期消息后清理用户与 Token 缓存，并携带当前 Hash 跳转登录页，不能一边展示个人信息一边在页面底部提示身份过期。
- 官网独立页面必须接收每次受保护请求响应头中的新 `authorization` 并立刻覆盖 Token 缓存，再发起后续并发请求；否则服务端轮换 Token 后继续使用旧 Token，会出现主接口成功、次级接口却提示身份过期的矛盾页面。
- 同一份 ApiKey/Token 摘要在 Overview 与 AI 页面复用同一个组件；Token 额度统一展示“总量/Total”，不要把总量写成“赠送”。复制密钥必须有明确成功或失败提示，并提供 Clipboard API 不可用时的兼容复制。

## 浏览器访问密钥路由

- 固定看板免登录使用常量匿名路由 `/access-login`，密钥使用 `microi_ak_` 前缀，链接格式为 `/?OsClient={当前租户}#/access-login?access_key=...&redirect=...`。生成器只复制当前 `OsClient`，不能把其它页面查询参数带进凭据链接。
- 管理入口是【系统账号】（`/#/mic-sys-user`）：该路由当前由通用 `form-engine/diy-table.vue` 承载，不能只修改旧的专用用户组件。表格和默认卡片视图都必须把【访问密钥】作为帐号行/卡片的直接按钮显示，不能藏入【更多】，也不能要求用户先进入编辑表单。创建表单支持 90 天、自定义到期和永久三种有效期，永久记录以空 `ExpiresAt` 表示并显示为“永久”。
- 页面必须先把密钥保存在局部变量，再立即从地址栏清除；不得写入 Cookie、localStorage、sessionStorage、Pinia 或控制台。
- 兑换通过 `POST /api/SysUserAccessKey/Exchange` 的 JSON Body 完成。响应头中的短期 Token 继续交给平台统一请求层保存和轮换。
- 创建界面默认按页面名称勾选，也支持粘贴完整页面网址自动解析；不能要求普通用户手写路由和物理表名。页面/数据均可选择“全部已授权”，内部值为 `*`，含义只是取消密钥层二次白名单，仍与目标帐号实时菜单、表单和行权限取交集。接口引擎与数据源引擎 Key 仍必须准确选择。
- `_AccessKeySession=true` 且页面为准确白名单时只允许清单路径；页面范围为 `*` 时才加载目标帐号实时可用的动态路由，以便全部已授权菜单可访问。该前端限制只是体验和泄露面收窄，服务端仍必须校验 API、表和引擎权限。
- 全部页面模式会调用 `/api/SysMenu/GetSysMenuStep`，服务端只能在 `page:open + AllowedRoutes=*` 时放行；准确页面模式不得为了省事请求完整菜单树。页面渲染过程中使用 `FormEngineKey` 或 `TableId` 的请求都必须能被服务端映射到同一份表范围，不能通过换参数名绕过。
- 列表和表单会把表 Key 放进动态友好地址，例如 `/api/FormEngine/GetTableData-{table-key}` 和 `/api/FormEngine/GetFormData-{table-key}`。访问密钥服务端必须先把这些地址归一化为标准 action，再按 `form:read/form:write` 与请求体中的表引用做双重校验；不能要求前端为了密钥会话退回另一套 URL，也不能对整个 `FormEngine` Controller 无条件放行。
- 不要因为底层帐号是管理员而在访问密钥会话展示控制面入口或触发控制面预加载。`_AccessKeySession=true` 时，密码显示、密钥管理、表/字段/菜单设计、缓存/服务器管理、查看或踢出其它终端等功能必须保持不可用；后台任务中心最多读取和管理当前用户自己的任务。
- `/access-login` 必须在普通 SSO 发现之前直接放行，兑换最多等待 20 秒并给出明确错误，不能让页面永久停在“正在自动登录”。
- 历史 `?token=` 只作兼容：解析后立即清除参数，不输出、不持久化完整 Token，不为新功能生成这种链接。
