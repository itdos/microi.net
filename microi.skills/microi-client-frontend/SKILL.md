---
name: microi-client-frontend
description: Microi.Client 源码架构指南。用于修改 Microi.Client Vue 前端代码，尤其是本地 ApiBase/OsClient URL 切换、浏览器租户隔离、表单引擎、diy-table、diy-form-full、工作流面板、sys_menu 按钮、前端 V8 事件、路由、微服务宿主 keep-alive/TagsView 缓存/白屏恢复，以及页面、弹窗和抽屉行为。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi.Client 前台源码架构说明

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=microi-client-frontend-000 sha256=9b949c68b0867fc1ecf2e6cb1fd1bec45d22c01ad3be63485e0376d0183d1795 -->
## 单行文本插槽按钮约定

- `diy-input.vue` 的插槽按钮行为存储在 `diy_field.Config.SlotButtonV8Code`。
- 点击事件通过 `CallbackRunV8Code` 进入 `diy-form.vue` 的统一前端 V8 上下文，事件名为 `FieldSlotButtonClick`。
- 禁止再新增或依赖 `OpenTableId` 一类硬编码目标；打开表格、表单、微服务或调用接口均由 V8 代码决定。
- 历史键 `ReadOnlyButton` 继续兼容，设计器显示为【禁用插槽按钮】。

> 适用于修改 `Microi.Client/` 前台源码。新 AI 对话在动 `Microi.Client/src/views/form-engine` 前，应先阅读本 Skill，避免把分散在 SFC、mixins、utils、路由和低代码配置里的逻辑误判成不存在。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-client-frontend-001 sha256=c17e7292fa264d10c6d21a2d634b60f40e12bb7168e69a46a85f351f5ed48f2f -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-client-frontend-002 sha256=9fae6ea3c3b238d5d830f308599d7512d1ed6364cb495d432278ada8680f769e -->
## 2. 表单引擎三层结构

### 模块级跨端视图

- Detail/Edit/List/Card 视图属于 `sys_menu`，使用物理字段 `EnableViewSchema`、`ViewSchemaVersion`、`ViewConfigVersion`、`ViewSchema`。其中 `EnableViewSchema` 只控制 Detail/Edit 自定义表单视图，List/Card 有有效配置时始终生效；两个版本字段可空，默认按 `1.0/1` 处理。
- 顶层 PC `diy-table` 即使没有 List ViewSchema，也默认显示约 40 至 52px 的紧凑模块标题。`selectModuleView()` 只能对 List/Card 绕过 `EnableViewSchema`；Detail/Edit 必须继续显式启用，不能被列表 fallback 误接管。
- 存量模块没有 Hero 配置时，PC/移动端从真实 `StatisticsFields`、`DataCount/PageCount`、当前页数值求和或当前页真实状态分布生成兜底指标；当前页口径必须写进标签，严禁随机值或伪造全表汇总。
- `Layout.List.Columns[].MinWidth` 优先于普通 `diy_field.TableWidth` 和末列自适应；缺少持久宽度时按标题/地址、日期/编码、数值、状态等字段语义稳定推断。
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

### 框架来源标识与水印（强制）

- 微服务和定制组件的来源标识必须由 Microi.Client 宿主统一渲染，子应用不得各自实现。来源标识是框架内置的常驻可发现能力，不得再创建 `RenderSourceBadgeMode`、自动收起、全局关闭等租户配置。
- `V8.OpenAppDialog` / Drawer 等标准弹层的来源标识放在标题文字之后，始终显示且不提供关闭按钮；菜单/整页微服务由 `micro-app/host.vue` 在内容区右上角直接渲染，必须提供只作用于当前页面实例的手动关闭按钮，切换实例后恢复显示。不得依赖外围路由组件猜测菜单微服务，避免动态路由元数据不同步导致漏标。
- 来源标识必须使用可点击的 `button` 语义与 `cursor:pointer`。点击后用可拖动、居中、亮/暗色适配的大圆角 Element Plus 弹层展示 AppKey、PageKey、应用内/框架路由、版本、源码定位、运行入口、发布/挂载状态和租户坐标，并生成可复制的 MCP 修改指令；公开详情不得包含 DiyToken、访问密钥、私有配置或用户敏感字段。
- 框架水印覆盖 `100vw × 100vh` 且固定 `pointer-events:none`。开启后内容空值默认 `$SysTitle$ - $UserName$`（用户名为空回退账号）、方向默认 `DiagonalUp`、密度默认 `Comfortable`、字号空值/0 默认 14，透明度空值/0 默认 30；亮色、深色、弹层、键盘和减少动态效果模式都要验收。

### 用户级界面偏好（强制）

- 主题色、浅色/深色、菜单子级展开方式等需要“换设备仍生效”的选择必须保存到当前 DiyToken 用户的 `sys_user` 白名单字段；`localStorage` 只作为未安装新字段租户和匿名启动阶段的兼容回退，不能作为跨设备事实源。
- 已安装用户偏好字段时优先级固定为“当前用户显式值 → 租户 `sys_config` → 平台安全默认”；个人菜单值 `System` 表示继承租户配置。不得让上一位用户的浏览器本地主题覆盖下一位已登录用户。
- 自助保存优先使用官方 `Managed` 接口引擎，由 `V8.CurrentUser.Id` 与 `V8.OsClient` 推导用户和租户，并在服务端构造固定白名单更新对象；接口参数禁止决定目标 Id/OsClient，也禁止写入 Account、Phone、Tenant、Dept、Role、Level、State、Pwd、认证因子和登录审计字段。只有缺少可复用可信原子能力时才新增 C# DTO/端点。保存成功后调用 `V8.Method.RefreshLoginUser` 刷新登录缓存，并让微服务宿主重新同步 `CurrentUser`。
- 右上角即时切换可以乐观应用并短防抖保存；远端保存失败时保留当前设备效果并明确提示。个人中心和右上角必须调用同一个应用包交付的白名单接口引擎（当前为 `platform-user-update-preferences`），不能分别形成两套字段、枚举或优先级。

---

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-client-frontend-003 sha256=a3e2b822a3c2aacea83d3cae796132786e3be45f3a18ceb621c477b6bd1a2442 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-client-frontend-004 sha256=53d475c7c494a5b6e9e2436c986c458ee539807426978fd99a27a1d7eb967881 -->
## 7. 验证建议

### 本地 ApiBase 与 OsClient 解析（强制）

- `app.use(router)` 会立即触发首个路由守卫。守卫中的 SSO、认证、菜单请求必须等待 `initApp()` 完成真实租户和系统配置初始化；初始化失败时取消导航并保留启动错误界面。释放初始化等待必须早于 `router.isReady()`，避免彼此等待；禁止将缓存尚未建立时的 `GetOsClient()` 默认值 `iTdos` 发给客户服务器。

- 身份和菜单只读初始化的短暂失败最多读取三次，间隔 300/1000ms；认证失效立即回登录页并保留原深链接，HTTP 403 和已耗尽的菜单依赖重试不得继续重试。重试期间退出登录应停止后续读取，不得用清空 Token、伪造角色或放行保护路由掩盖错误。持续失败用 `next(error)` 保留身份/菜单阶段和原始原因，禁止用 `next(false)` 把它替换为 `Navigation aborted`；启动界面不能据此断言后端断网。当前用户请求的传输失败必须 reject，不能留下永久 pending 的 Promise。修改这条链路时运行 `route-bootstrap-recovery.spec.mjs`，并用真实路由验证健康登录、短暂失败恢复、持续失败提示和过期会话跳转。

- `ApiServiceUnavailable` 确认连接故障后，每轮探测结束 5 秒后继续请求固定匿名健康接口；单次请求超时 5 秒，自动与手动检测共用在途请求。后端返回有效健康正文后停止轮询，启动失败的页面只重载一次原 URL，已经就绪的业务页面原地撤掉异常层并保留输入，禁止重放失败的业务写入。旧版健康接口也必须返回有效的 Healthy 正文，不能把反向代理 HTML/404 当作恢复。安全拦截继续按后端解除时间检查，不用连接故障轮询缩短封禁。定向回归使用 `api-service-recovery.spec.mjs` 与 `api-service-status.spec.mjs`，浏览器必须验证断连到自动恢复全过程。

- `src/config.json.ApiBaseDev` 是本地默认 API；URL 中 `#` 之前的 `ApiBase`、`OsClient` 必须同时
  高于 `index.html`、config、Pinia 与 localStorage。解析统一走
  `src/utils/runtime-endpoint-query.js`，禁止在新入口另写正则形成不同优先级。
- URL 只允许有效的 HTTP(S) ApiBase 和安全 OsClient。页面初始化后通过不含 Token 的
  `window.__MICROI_RUNTIME_ENDPOINT__` 暴露实际值，便于 AI/自动化确认没有误连配置文件中的服务器。
- 页面已解析的租户必须进入真实 HTTP 请求。`DiyCommon.UseAxios/UseAxiosAll` 与共享 axios 请求层统一通过 `request-tenant-context.js` 补当前 API 的 `osclient` 请求头；保留调用者显式的路径、Query、参数或 Header 租户，不给其它服务器或相邻 API 子路径自动添加页面租户。JSON 正文在动态路由阶段可能尚未读取，不能只依赖正文或旧 Token 选择租户。验收必须增加同源旧 Token 指向其它/不存在租户的真实后端场景：`platform-current-user` 应走页面租户并返回登录失效，保留原深链接进入登录页，不得显示“无法确认接口配置”或让 SSO 发现返回错误租户的 404；定向回归为 `request-tenant-context.spec.mjs`。
- 首次身份读取的业务/传输失败交给路由守卫处理，`getInfo` 不调用带全局通知副作用的 `DiyCommon.Result`，同时抑制请求层通知和抢先登录跳转；`App.PageInit` 等待首次导航成功后再启动续签/用户刷新，导航失败时结束。既要验证干净会话，也要验证旧登录缓存和失败后重复刷新，不能以隔离浏览器成功代替用户当前会话验收。
- 同源浏览器窗口仍共享 Token、CurrentUser 等持久化状态。不同 `ApiBase + OsClient` 并行测试必须
  使用独立 browser context/profile；URL 最高优先级不等于登录态隔离。
- 修改该链路时运行 `node --test tests/runtime-endpoint-query.spec.mjs`，再使用两个独立
  `browser.newContext()` 验证两组运行目标互不串号。

### 菜单微服务缓存与恢复（强制）

- 动态菜单宿主的 Vue 路由保持 `keepAlive:false`，由 `<micro-app keep-alive>` 独占运行时状态；契约固定为 `runtime-keep-alive`，禁止 Vue `KeepAlive` 和 micro-app 双层缓存。
- 每个顶部 Tab 按完整路由生成稳定实例身份，最多保留 5 个隐藏实例并按 LRU 淘汰。关闭 Tab、退出登录、Token/角色变化以及版本或入口变化时必须精确销毁对应运行时。
- 恢复时强制同步宿主上下文并检查真实可见 DOM；子应用监听 `appstate-change`，在 `afterhidden` 幂等暂停轮询、WebSocket 和观察器，在 `aftershow` 幂等恢复并重新测量布局，同时保留用户输入、筛选、滚动和内部路由。
- 修改宿主、TagsView 或权限路由时，必须同时读取 [Vue3 前端微服务宿主规则](references/progressive-03-vue3-前端微服务宿主规则.md) 并运行微服务缓存契约测试。

- 修改 Vue/JS 后先跑 VS Code Problems 或 `get_errors`。
- 影响核心前端时跑 `Microi.Client` 的 `npm run build`。
- 如果改了工作流、表单保存、按钮 V8，建议用实际 `sys_menu` 配置测试：
  - `FormBtns` 是否出现在表单右上角/FAB。

---

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-3-动态按钮系统.md](references/progressive-01-3-动态按钮系统.md)：3. 动态按钮系统；5. 路由与打开方式；6. 修改前必查清单
- [references/progressive-02-8-运行时高频坑复盘.md](references/progressive-02-8-运行时高频坑复盘.md)：8. 运行时高频坑复盘；7.1 登录验证码与 Sys_Config；Microi 前端 SDK 约束
- [references/progressive-03-vue3-前端微服务宿主规则.md](references/progressive-03-vue3-前端微服务宿主规则.md)：Vue3 前端微服务宿主规则；在线 AI 应用与微服务页面协作；浏览器访问密钥路由
<!-- microi-progressive:end -->
