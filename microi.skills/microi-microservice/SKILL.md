---
name: microi-microservice
description: Microi 前端微服务 MicroService 开发与交付指南。用于创建、读取、修改、构建、发布或修复 Vue3 微应用，维护 microi.routes.json，绑定 sys_menu，使用 V8.OpenAppDialog，或通过 MCP 管理 Web、UniApp、MicroService 应用源码和运行时。
---

# Microi 前端微服务

这里的 MicroService 是运行在吾码主站中的前端微应用，不是 .NET/Java 后端微服务。
它适合复杂租户页面、多页面应用、完整表格/上传/步骤交互和独立版本交付；业务事务、
权限和最终校验仍放接口引擎或可信后端。

完整数据模型、文件/路由协议和宿主通信见 `references/runtime-delivery.md`。

## 何时使用

| 需求 | 选择 |
|---|---|
| 简单确认 | `V8.ConfirmTips` |
| 标准单表新增/编辑/查看 | FormEngine / `V8.OpenAnyForm` |
| 主前端已注册组件 | `V8.OpenDialog` |
| 3 个以上字段、联动、上传、表格、Tab、步骤条、代码编辑 | MicroService + `V8.OpenAppDialog` |
| 复杂区域需要固定嵌入表单、独立发布且不进入主前端 | `DevComponent` + MicroService 路由 |
| 独立菜单、多页面、AI 在线编辑、本地 Vite、独立发布 | MicroService |

## 默认发现顺序

开始写代码前：

1. `microi_list_applications` 盘点当前租户全部 Web、UniApp、MicroService 和文件清单。
2. `microi_get_application_context` 默认只读取元数据、文件哈希、运行时和页面；需要少量正文时显式开启内容读取。
3. 单个大文件按需使用 `microi_get_application_file`，不要为了查看清单把全量源码 Base64 拉入上下文。
4. 合适应用存在时在其中新增页面/路由，不创建“一页一个微服务”。
5. 没有合适应用时才脚手架/创建新 AppKey。

所有读写必须使用同一 MCP、ApiBase 和 OsClient。写操作先 dry-run，再按用户授权确认。

## 源码与产物分离

- `sys_microistore`：应用主数据。
- `mci_ai_app_file`：私有源码清单，内容在私有 HDFS。
- `mci_ai_app_version`：构建版本。
- `sys_microiservice`：已发布运行时。
- `sys_microiservice_page`：页面路由。
- 编译后的 HTML/JS/CSS/图片放公有 HDFS，源码不公开。

不能从 `sys_microiservice` 公有产物反推完整源码，也不把大 JS/CSS 长期塞数据库 JSON。

## 本地工程

新建和整体升级项目的通用前端架构遵守 `microi-ai-application`：默认使用 Vue 3 单文件组件、Composition API、Vite 和严格 TypeScript。本 Skill 继续负责 MicroService 特有的 Manifest、页面路由、宿主上下文、菜单绑定与发布协议。

项目至少有：

```text
.microi-micro-app.json
microi.routes.json
package.json
package-lock.json
tsconfig.json
vite.config.ts
index.html
src/
```

AppKey 稳定且只含安全字符。`microi.routes.json` 是页面事实源，删除/新增路由后由
发布流程同步 `sys_microiservice_page`，不要从 Vue 源码猜路由。

本地项目必须位于当前连接对应的 `Microi-V8-Engine/{系统名称} ({ApiBase域名})/{OsClient}.{OsClientType}.{OsClientNetwork}/AI应用/{appKey}`。`microi.apps/` 是官方应用商城发行包工程目录，不是 MicroService 源码目录；发行包只能引用、构建或快照当前租户的唯一源码，不得在包内嵌套第二份可编辑 `microservice/` 工程。

构建前遵守本地 OOM 保护；已有 dev server 可复用时不重复启动。新脚手架必须支持独立
访问时的平台帐号登录，但独立 Vite 预览仍没有菜单/弹窗等完整宿主上下文，不能替代宿主验收。

迁移 Vue2 定制页到独立 Vite 微服务时，不得假设宿主会提供 Tailwind/UnoCSS 等原子类；
页面依赖的宽高、颜色、间距、响应式和打印/下载样式必须由组件自身的语义 class 明确声明，
并检查最终 CSS 产物确实包含这些规则。合并多个客户分支的同名组件前逐份比对功能，选择
业务能力超集并保留各分支共同的数据契约；不能仅按文件名去重，否则会静默丢失某一分支的
筛选、确认、导入参数或状态同步。验收需用旧版截图逐项核对标题、工具栏、选项、按钮、表格
和分页，而不只确认组件已挂载。

### 本地源码同步禁止人工分段

- 已有本地工程时，`microi_sync_microservice_source` 首选只传项目绝对路径 `directory`；先 dry-run 审阅文件数、总大小、逐文件哈希和清单哈希，再传 `confirmExecution`。
- 源码扫描、读取、哈希和上传内容组装必须在 MCP 进程内完成，模型上下文只接触清单。禁止让 AI 读取整个源码为 Base64，禁止生成 `.sync-seg-*`、`sync-source-files.json`，禁止把一个真实源码文件拆成多个临时文件反复调用工具。
- 目录扫描必须排除 `node_modules`、`dist`、`build`、`coverage`、缓存、版本库和 UniApp 构建目录；发现 `.env`、证书、私钥、符号链接或越过根目录时失败关闭。
- AI 工具单次读取上限不是 MicroService 源码文件上限。即使 `microi.v8.js` 等文件超过 50KB，也应保持一个完整文件，由 MCP 直接从磁盘读取。
- `sourceFiles` 仅用于调用方本来就持有内存文件的旧版兼容场景；不得把它作为本地工程默认路径，也不得用人工切片规避上下文限制。

## 发布

- 创建/更新元数据：`microi_create_microservice`。
- 同步私有源码：`microi_sync_microservice_source`；本地工程必须优先传 `directory`，不构造 Base64 文件数组。
- 真实编译目录优先 `microi_publish_application_directory_stream` 流式发布。
- 发布动作必须明确区分两种模式：默认“源码+编译产物”先把完整工程同步到私有桶并逐文件回读 SHA-256，再把 `dist` 流式发布到公有桶；显式“仅编译产物”只更新公有桶，必须在界面中告知其他用户仍会拉取上一次私有源码，禁止暗示源码已同步。
- 私有源码同步使用 `ReplacePrivateSourceOnly` 精确清理过期源码；兼容调用可以继续接受 `replace`，但实现不得用旧式全表 `Replace=true` 删除同一应用的公有运行产物元数据。
- `mci_ai_app_file` 同时存在私有源码和公有编译产物。源码拉取/差异比较必须优先按 `StorageScope=PublicBuildStream|PublicBuildStreamArchived|PublicBuildOnly` 排除公有产物，并保留旧数据中 `HdfsPath == PublishHdfsPath` 的兼容判断；不能仅靠两个路径相等识别，否则版本路径与稳定别名不同的流式产物会被误读成私有源码。
- 只有服务器不支持流式端点且产物很小时，才兼容 `microi_publish_microservice`。
- 正常发布支持最多 20,000 个文件、总计 20GB；逐文件从磁盘流入 HDFS，不生成整包 Buffer/Base64。几百 MB、1GB 级项目不得自动降级到旧 Base64 发布器。
- `StorageMode=db` 仅是显式的小型应急恢复模式，不是正常发布容量；当前最多 256 文件/5MB。超过该边界必须修复租户 HDFS/网关并恢复流式文件模式，不能调大数据库内联上限来承载大项目。
- 每次交付使用同一 `DeliveryBatchId`，并保存 `SourceManifestHash` 与 `RuntimeManifestHash`；源码同步、运行清单、页面切换和入口探测必须能关联到同一批次。
- 发布后用 `microi_get_application_context`、`microi_get_microservice` 回读。
- 回读成功还不等于页面可用：必须直接请求稳定入口、版本入口和清单内的 JS/CSS；入口 `502` 且运行时/清单存在时，优先检查 API 节点是否能通过租户 MinIO 内网端点读取公有桶对象。不要反复发布同一份产物掩盖存储读取故障。
- 服务器暂未部署修复且产物很小时，可把 `StorageMode=db` 与内联 `ContentBase64` 作为短期恢复手段；必须明确记录为临时方案。修复部署后重新流式发布到公有 HDFS，并恢复 `StorageMode=file`，禁止长期把大 JS/CSS 放在数据库 JSON。
- 子租户发布时，源码、版本资产、回读验签、页面与缓存全部绑定当前 Token 的 `OsClient`；禁止回退到主租户或宿主服务器默认租户。切换前必须由当前 API 节点通过该子租户 HDFS 配置读回每个版本文件并校验大小/SHA-256。

## 菜单、弹窗与表单嵌入

菜单 `OpenType=MicroService` 时一次绑定 `MicroServiceId`、
`MicroServicePageId`、`MicroServiceRoutePath`、`MicroServiceKey`。
完整系统 Manifest 不得固化不同租户会变化的两个 Id；模块声明 `openType=MicroService`、`microServiceKey` 和 `microServiceRoutePath` 即可，由 `microi_generate_system` 在任何写入前回读 `sys_microiservice/sys_microiservice_page`，解析并校验当前租户的 `MicroServiceId/MicroServicePageId`。微服务或页面不存在时必须在首个写操作前失败，不能留下半套系统。
复杂弹窗用 `V8.OpenAppDialog`，业务参数放 `Data`，回调放顶层。

### 独立、菜单、弹层与表单嵌入四种入口

- 同一发布物必须支持：直接打开独立运行、`sys_menu` 使用 `/micro-app/{AppKey}/{RoutePath}` 打开指定路由、`V8.OpenAppDialog` 按 AppKey/RoutePath 以 Dialog 或 Drawer 打开、表单 `DevComponent` 按组件路径别名嵌入指定 RoutePath。
- 表单嵌入时，在 `microi.routes.json` 的目标页面声明稳定、唯一的 `LegacyComponentPaths`；字段 `Config.DevComponentPath` 与其归一化后匹配。主前端存在同路径 Vue 文件时本地组件优先；不存在时 `DynamicComponentCache` 才交给 MicroService 组件宿主。新项目使用不与 `/src/views` 真实文件冲突的虚拟路径，历史字段无需逐租户改配置。
- 组件宿主必须下发 `componentMode=true`、可序列化的 `componentData`、当前路由和权限上下文；子应用用 `dev-component:resize` 同步 80～1600px 高度，用 `dev-component:event` 回传 `update:modelValue`、`CallbackFormValueChange`、`FormSet` 或 `ParentFormSet`。禁止依赖父页面 DOM、Vue 实例、函数或 `ParentV8` 跨 iframe 传递。
- 菜单路由必须同时回读并传入 `SysMenuId`、`ModuleEngineKey`、`DiyTableId`；弹层与表单组件默认继承调用菜单，也允许跨模块时显式传真实授权模块。宿主统一下发 `{ sysMenuId, moduleEngineKey, diyTableId }` 的 `permissionContext`。
- `permissionContext` 只是选择正确 API 调用上下文，不是授权凭证。后端仍依据 DiyToken、OsClient、角色、菜单、表、按钮和数据范围校验；禁止删除权限参数、改成匿名接口或写死管理员 Token 来消除“没权限”。

### 独立运行的认证门

- 嵌入菜单、表单定制组件或 `V8.OpenAppDialog` 时直接复用宿主 Token，不显示第二套登录页；同一个 V8 SDK 实例继续处理 Token 轮换。
- 独立访问时先配置当前 `apiBase/osClient` 并复用本地有效 Token；没有有效 Token 才显示吾码帐号密码登录。
- 页面启动时调用 `V8.GetSysConfig(true)`，用统一 `isEnabledFlag` 解析 `EnableCaptcha`。开启时请求 `GET /api/Captcha/GetCaptcha?OsClient=...`、读取响应头 `captchaid`，登录提交 `_CaptchaId/_CaptchaValue`；关闭时不渲染、不提交验证码字段。
- 登录使用统一 `V8.Login` 与 DiyToken，不创建第二套用户体系。Token 失效后回到认证门；禁止在 URL、日志、源码、`.env` 或业务数据中保存 Token。
- “无权限”排查顺序固定为：Token/OsClient → 目标 `ModuleEngineKey` → 宿主 `permissionContext` → 当前角色的菜单/表/按钮/数据范围。登录成功不等于拥有全部模块权限。

微服务内部禁止调用浏览器原生 `alert/confirm/prompt`。优先复用宿主 `Tips`/`V8.ConfirmTips`；需要由子应用自行承载时，使用 teleport 到 `body` 的品牌化可访问弹层，固定在当前视口正中央并高于宿主滚动内容。长列表只允许一次性加载后在前端内存搜索时，不得随着关键词重复请求服务器。

Token 只通过宿主上下文传递，不硬编码、不放 URL、不写日志。子应用回传成功/取消/
错误事件，宿主负责提示、关闭和刷新。

菜单型微服务通过 `window.microApp.getData().hostCapabilities` 发现主框架能力，禁止直接操作
父页面 DOM、Pinia 或 Vue Router。能力协议固定为 `microi.host.v1`，请求使用：

```js
window.microApp.dispatch({
  type: 'micro-app:host-action',
  action: 'closeTab',
  requestId: 'optional-id',
  data: {}
});
```

AI 生成菜单微服务时，应优先封装一个 `callMicroiHost(action, data)`，先检查
`hostCapabilities.actions`，再 dispatch。当前标准动作是：`closeTab`、`navigate`、
`replaceTab`、`back`、`forward`、`reloadTab`、`setTabTitle`、`showMessage`。
`navigate/replaceTab` 只传以 `/` 开头的站内 path 或 `{name,params,query,hash}`；禁止传
外部 URL、登录页、访问密钥页或内部 redirect。目标仍要存在于当前用户动态路由并经过路由守卫，
宿主桥接不授予菜单或数据权限。业务保存成功后才能关闭/跳转，不能把尽力返回的
`micro-app:host-action-result` 当作业务持久化确认。

`closeTab` 与 TagsView 当前页签关闭语义一致，固定页签和最后一个页签拒绝关闭；顶部 Tab
右键刷新与 `reloadTab` 都应重载当前微服务。`OpenAppDialog` 页面不使用 Tab 动作，继续发送
`app-dialog:success/cancel/error` 关闭弹窗并回传结果。

`sys_microiservice_page` 是友好路由的页面事实源，`sys_menu` 只负责导航和角色权限。
无需出现在导航中的按钮页/详情页应在页面元数据设置 `InternalOnly=true`，不创建伪隐藏菜单。

宿主必须提供 `--micro-app-available-width`、`--micro-app-available-height`、
`--micro-app-safe-area-bottom`，并用 `ResizeObserver`/`visualViewport` 同步 `host:resize`。
子应用根容器使用 `min-height: var(--micro-app-available-height, 100vh)`；`100vh` 只能作为脱离
吾码宿主独立预览时的回退值。不得直接写死 `min-height: 100vh`、`calc(100vh - 100px)` 等
只适配浏览器视口或某个主站布局的高度，否则嵌入 TagsView、弹窗或移动端时会被裁剪或产生双滚动。

加载/协议/运行时异常只由宿主兜底显示；子应用业务错误标记 `handled=true` 后宿主不得重复提示。
加载失败页至少显示 AppKey、PageKey、路由、版本、入口、HTTP 状态、发布状态、资产来源、挂载状态和安全原因码，并提供重试、返回与复制诊断。

### 首次挂载、iframe 交互与接口契约

- `/micro-app/:appKey/:microPath(.*)*` 是平台协议路由，不是租户菜单。它必须在首轮 URL 解析前作为宿主固定路由注册，且宿主组件要进入首屏主包；不能等登录后的菜单请求或异步路由注入，否则直接打开、书签或浏览器刷新会先命中空 `RouterView`，网络抖动时就表现为“刷新一次才出现”。页面是否存在仍由 `MicroApp/Resolve(RequirePage=true)` 和登录守卫校验，固定注册路由不授予菜单或数据权限。
- `micro-app` 的 `mounted` 生命周期只表示容器和脚本执行流程完成，不能单独证明子框架已经在 `#app` 渲染出可见内容。宿主给每次解析和重挂载分别下发 `hostGeneration`、`hostMountAttempt`；子应用在 Vue/React 根节点挂载并完成 `nextTick + requestAnimationFrame` 后用 `forceDispatch` 回传 `micro-app:ready`。宿主只接受与当前解析世代、挂载尝试都一致的就绪事件，再复核 `micro-app-body`、`#app` 的非空内容、可见样式以及非零宽高；`micro-app-body` 尚未创建必须判为“仍未渲染”，绝不能当成未知但成功。超时只自动销毁重建一次，第二次失败显示稳定诊断，禁止让白屏永久停留在 `mounted` 状态。
- iframe 内的 pointer/click 不会冒泡到宿主 document。子应用应在捕获阶段发送 `micro-app:interaction`，宿主再广播统一的“关闭全局浮层”事件。`@micro-zoe/micro-app` EventCenter 会去重内容相同的普通 dispatch，连续交互事件必须使用 `forceDispatch`；否则只能收到第一次点击。宿主的 Select/Popover 等浮层若 teleport 到 `body`，收到通知后还要显式执行组件的 click-outside/close 路径并清理搜索值和焦点，不能只依赖 `blur`。
- 调接口时以真实 `DosResult.Data` DTO 为准，不能仅凭界面名称猜成数组。例如在线终端接口返回的是用户视图对象 `{ Terminals: [...] }`，前端应读取 `Data.Terminals`，只把 `Data` 直接数组作为旧版兼容；列表 key 优先使用 `ConnectionId`、`DeviceClientId` 等稳定标识。修复前先沿 Controller → Service → 序列化对象 → 子应用解析完整核对契约，避免为正确的后端响应另写一个平行接口。
- 发布前统一更新 `package.json`、`package-lock.json` 根包版本、`.microi-micro-app.json`、应用 `CurrentVersion/BuildVersion`、微服务与页面 `BuildVersion`。应用商城候选包可以先嵌入待发布源码和构建产物，但 `.resource-sync-base` 只能在官方远端发布完成、逐文件内容哈希回读一致后由资源同步器推进，禁止把本地候选提前写成共同基线。

## 验收

- 源码、构建文件、运行时、页面路由和菜单五层分别回读。
- 组合发布成功前，私有源码回读必须与本地源码在路径集合、文件数、字节数、逐文件 SHA-256 和规范化清单哈希上完全一致；任何缺失、多余或读取错误都要阻止运行版本切换。
- 直接刷新友好路由与连续切换多个微应用不 404、白屏或实例名冲突。
- Dialog/Drawer 成功、取消、错误和关闭协议正确。
- 表单 `DevComponentPath` 能匹配页面 `LegacyComponentPaths`，指定路由正常加载；Add/Edit/View/只读、字段值回写和自动高度均通过。
- 独立地址覆盖“已有 Token 自动进入”和“无 Token 显示帐号密码”；`EnableCaptcha` 开/关各验一次，验证码响应头和登录参数正确。
- 宿主 API 请求携带当前 Token/OsClient/`permissionContext`，普通用户用真实授权模块成功、未授权模块仍明确拒绝。
- 至少验证桌面和窄屏；上传、表格、滚动、弹窗底部操作不被截断。
- 长弹窗滚动到顶部/中部/底部后，错误提示和确认层仍位于当前视口中央；自动化监听到原生 JavaScript 对话框直接判失败。
- 本地构建、MCP 发布和真实浏览器验收分别说明，未执行的层不宣称通过。
