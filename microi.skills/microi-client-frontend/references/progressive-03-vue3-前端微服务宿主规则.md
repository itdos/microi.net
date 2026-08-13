# microi-client-frontend 详细参考 3

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=microi-client-frontend-011 sha256=cdb6c4e59594572e4c1264856f42f428af215c8515b6ee14d0da4442555cc268 -->
## Vue3 前端微服务宿主规则

`sys_menu.OpenType=MicroService` 时，动态路由必须把 `MicroServiceId`、`MicroServicePageId`、`MicroServiceRoutePath` 和真实入口 `MicroAppUrl` 写入 route meta；浏览器侧菜单路由使用 `/#/micro-app/{MsKey}/{RoutePath}`，不要再生成 `/micro-app-host/{menuId}`，否则地址过长且刷新或直接访问菜单路由容易加载空白页。

同一个编译后的微服务可以绑定多个后台菜单和内部页面。`MicroAppHost` 的 `<micro-app name>` 必须包含菜单 Id、路由路径或其它实例维度，避免多个菜单共享同一个 appKey 时触发 `app name conflict`。入口 URL 中的 `microRoute/routePath` 只用于解析，最终应通过 `data.microRoute` 传给子应用，入口文件 URL 保持稳定。

菜单微服务的缓存所有权固定为一层：动态菜单和友好路由都设置 `meta.keepAlive=false`、`meta.microAppHost=true`，`AppMain` 不缓存 Vue 宿主；`host.vue` 的 `<micro-app keep-alive>` 才保存子应用 DOM、路由和状态。`AppMain` 对菜单微服务使用 `$route.fullPath` 作为宿主 key，宿主创建时立即快照 path/fullPath/meta/query，之后不得监听全局 `$route` 去改写即将隐藏的旧宿主。普通 Vue 页面继续使用原有 `KeepAlive`，菜单微服务也不得占用或淘汰 `cachedViews` 槽位。

运行时缓存集中维护在 `utils/microAppRuntimeCache.js`：实例名必须由租户、AppKey、fullPath、版本和入口的安全指纹稳定生成，长度受限且不暴露 Token/查询原文。菜单 Id 可能在友好路由首屏之后才随动态菜单元数据补齐，只能进入权限上下文，禁止参与实例身份；否则首次返回同一路由会被误判为新实例。全局最多保留 5 个实例，只淘汰最久未使用的 hidden 实例。TagsView 的关闭当前/其它/全部和访问记录淘汰必须按 fullPath 精确销毁；退出登录、Token 重置、角色切换必须清空全部；同一路由版本/入口变化必须替换旧实例。销毁统一调用 `unmountApp(name,{destroy:true,clearData:true})`，不能只从本地 Map 删除。

宿主监听 `beforeshow/aftershow/afterhidden`：恢复时用 `forceSetData` 下发最新 Token、OsClient、权限、主题、路由和视口，并重新执行可见 DOM 健康检查；隐藏时停止宿主看门狗并把实例放入 LRU。`microAppData.cache` 与 `hostCapabilities.lifecycle` 要公开缓存模式、所有者、上限和 `appstate-change` 状态，错误诊断同时显示 cacheMode/cacheState/cacheInstance。可见 DOM 不健康时只自动销毁重建一次，禁止恢复阶段无限重试。

菜单型微服务的宿主操作集中维护在 `views/micro-app/host-bridge.js` 和 `host.vue`。
`microAppData.hostCapabilities` 必须下发 `microi.host.v1` 协议、`tab` 模式、请求/结果事件名和动作清单；
子应用只允许 dispatch `micro-app:host-action`，不能接收父页面函数或直接操作 TagsView/Router。
标准动作包括 `closeTab/navigate/replaceTab/back/forward/reloadTab/setTabTitle/showMessage`：
关闭当前 Tab 要复用 `useTagsViewStore` 的当前 `fullPath`，拒绝固定/最后一个 Tab；`navigate`
保留当前 Tab，`replaceTab` 删除旧 Tab；返回/前进只使用站内 history；右键刷新和 `reloadTab`
都重新解析并挂载当前微服务。路由输入必须拒绝外部 URL、协议相对地址、反斜杠、登录、访问密钥和
内部 redirect，并在跳转前用当前 Router 解析，404/未注册动态路由失败关闭。宿主结果用
`micro-app:host-action-result` 尽力回传，但关闭或跳转会卸载子应用，不能承诺结果事件必达。

`navigate/replaceTab` 只用于主框架级跳转；同一微服务内部菜单必须在子应用内用 Vue Router、
状态或 iframe Hash 切换，并将异步页面的 `Suspense` 骨架屏限制在内容区域。不得通过改变主框架
`$route.fullPath` 实现内部页面切换，否则 TagsView 会重建整个微服务。宿主根节点与 `<micro-app>`
元素必须建立 `contain: layout paint`、`isolation:isolate` 的绘制边界；子应用仍必须把主题/reset/
元素选择器限定在 AppKey 唯一的 `[data-mci-ui-root="{AppKey}"]`，不能只写宿主也会命中的裸属性
选择器，禁止以 `:root/html/body` 或固定全屏装饰污染主框架。

`OpenAppDialog` 不暴露 Tab 模式能力；弹窗成功/取消/失败继续使用
`app-dialog:success/cancel/error`。修改桥接时至少运行
`node --test tests/micro-app-host-bridge.spec.mjs tests/micro-app-runtime-contract.spec.mjs`，并同步
`microi.doc/docs/doc/system-engine/micro-app.md` 与 `microi-microservice` Skill。

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
- 最终通过 `microi_get_application_context`、`microi_get_microservice`、`microi_get_module` 和真实登录后的友好菜单路由逐层验收；多个菜单至少往返切换 8 轮，检查标题与子路由不串页、缓存范围内输入/筛选/滚动保持、无 404/5xx/白屏/永久骨架屏/实例冲突。再打开第 6 个实例验证 LRU 冷启动，并关闭 Tab/退出登录验证精确销毁；保存 fullPage 截图后用 `view_image` 复核。

### 表单下拉 Data 动态对象选项

表单 V8 通过 `V8.FieldSet('字段名', 'Data', objectRows)` 动态写入下拉数据时，如果 `objectRows` 是对象数组，即使 `diy_field.Config.DataSource='Data'`，前端也必须按对象数据源处理，并使用 `SelectLabel/SelectSaveField` 或常见字段兜底生成 label/value。禁止把对象数组按普通字符串 Data 源过滤，否则会出现接口已有数据但下拉显示“无数据”的回归。

### 复盘：历史 OpenIframe 打印入口在 Vue3 弹窗中空白

- 触发场景：同一租户的旧正式版打印正常，最新版列表点击打印只打开空白抽屉；数据库中的当前按钮已改成 `PrintEngineView`，但运行态菜单缓存仍可能返回历史 `ComponentName: 'OpenIframe'`。
- 根因：Vue3 全局组件表移除了 Vue2 的 `OpenIframe` 注册，动态组件只能渲染成未知标签；同时历史 `DataApi` 可能带有 `https:/host` 这种单斜杠协议地址。
- 通用规则：必须保留 `OpenIframe` 兼容入口。含 `PrintId` 的旧打印参数转交当前内置 `PrintEngineView`，普通 URL 弹窗继续使用 iframe；打印数据地址进入请求层前统一修正单斜杠 HTTP(S) 协议。排查时必须同时核对数据库 V8 与浏览器运行态 V8，不能只比较服务器记录。
- 分层排查：打印画布恢复后仍无业务数据时，继续直接运行 `DataApi` 及其 `V8.ApiEngine.Run` 依赖，逐一对比测试/正式环境的 `IsEnable/StopHttp/AllowAnonymous` 和真实返回；旧后端对仅赋值 `V8.Result` 的依赖可能需要同时保留赋值并显式 `return V8.Result`。不得把前端空白、数据接口失败和浏览器打印输出混成同一个结论。
- 自动化检查：打开真实列表连续点击两次旧打印按钮，断言抽屉内出现打印引擎、打印数据接口成功、出现浏览器打印日志，并且没有未知组件警告、递归更新、页面异常或失败请求；保存首次和重复点击截图。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-client-frontend-012 sha256=77e4f6a9fd4ed647275e9abeee2ea9589271c19af11602db5a73f74950b937bf -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=microi-client-frontend-013 sha256=41c4bd99de48ccd402eb1d2dc551cf19a4472abce542b7904bf7ee61bdd43f0a -->
## 浏览器访问密钥路由

- 固定看板免登录使用常量匿名路由 `/access-login`，密钥使用 `microi_ak_` 前缀，完整链接格式为 `{Microi.Client前端WebBase}/?OsClient={当前租户}#/access-login?access_key={密钥}&redirect={encodeURIComponent后的站内Hash路由}`。例如目标路由 `/mic/data-dashboard/preview/01KK988A0YPHKAM8SF216917HX` 必须生成 `redirect=%2Fmic%2Fdata-dashboard%2Fpreview%2F01KK988A0YPHKAM8SF216917HX`。生成器只复制当前 `OsClient`，不能把其它页面查询参数带进凭据链接，也不能把 API Server 当成前端 WebBase。
- 固定电视、看板和信息屏应保存完整 `/access-login` 链接作为开机主页或受控书签；兑换后的干净目标页不能作为唯一恢复入口。前端清除地址栏中的 `access_key` 后使用短期受限 Token 并接收响应头轮换；永久密钥不等于永久 JWT。浏览器会话丢失时重新打开启动链接即可免密码兑换，禁止在目标页面重复追加密钥或支持 `permanent=1/keep_login=1` 等 URL 参数。
- 管理入口是【系统账号】（`/#/mic-sys-user`）：该路由由通用 `form-engine/diy-table.vue` 承载。【访问密钥】必须保存为该模块 `sys_menu.MoreBtns` 的动态按钮，并设置 `ShowRow:true`，由表格和默认卡片视图的通用 MoreBtns 渲染链直接显示；禁止在表格模板、卡片模板、action-width mixin 中按 `sys_user`、菜单 Id 或 Url 写死按钮。面板作为预注册的 `UserAccessKeyPanel` 定制组件，由按钮调用通用 `V8.OpenDialog({ ComponentName:'UserAccessKeyPanel', DataAppend:{ User:V8.Form } })` 打开；禁止为单个业务面板扩展 `V8.OpenUserAccessKeys` 一类专用 V8 API。按钮名称、图标、排序和显隐均由模块配置维护。创建表单支持 90 天、自定义到期和永久三种有效期，永久记录以空 `ExpiresAt` 表示并显示为“永久”。
- 页面必须先把密钥保存在局部变量，再立即从地址栏清除；不得写入 Cookie、localStorage、sessionStorage、Pinia 或控制台。
- 兑换通过 `POST /api/SysUserAccessKey/Exchange` 的 JSON Body 完成。响应头中的短期 Token 继续交给平台统一请求层保存和轮换。
- 创建界面默认按页面名称勾选，也支持粘贴完整页面网址自动解析；不能要求普通用户手写路由和物理表名。页面/数据均可选择“全部已授权”，内部值为 `*`，含义只是取消密钥层二次白名单，仍与目标帐号实时菜单、表单和行权限取交集。接口引擎与数据源引擎 Key 仍必须准确选择。
- `_AccessKeySession=true` 且页面为准确白名单时只允许清单路径；页面范围为 `*` 时才加载目标帐号实时可用的动态路由，以便全部已授权菜单可访问。该前端限制只是体验和泄露面收窄，服务端仍必须校验 API、表和引擎权限。
- 全部页面模式会调用 `/api/SysMenu/GetSysMenuStep`，服务端只能在 `page:open + AllowedRoutes=*` 时放行；准确页面模式不得为了省事请求完整菜单树。页面渲染过程中使用 `FormEngineKey`、`TableId`、`ModuleEngineKey` 或 `_SysMenuId` 的请求都必须能被服务端映射到同一份表范围，不能通过换参数名绕过，也不能把合法的菜单 Id 请求误判为缺少表引用。
- 列表和表单会把表 Key 或菜单 Id 放进动态友好地址，例如 `/api/FormEngine/GetTableData-{table-key}` 和 `/api/FormEngine/GetFormData-{table-key}`。访问密钥服务端必须先把这些地址归一化为标准 action，再按 `form:read/form:write` 对 URL 后缀与请求体中的表/菜单引用做一致性校验，并把菜单 Id 映射回绑定的 `DiyTableId` 校验数据范围；不能要求前端为了密钥会话退回另一套 URL，也不能对整个 `FormEngine` Controller 无条件放行。
- 不要因为底层帐号是管理员而在访问密钥会话展示控制面入口或触发控制面预加载。`_AccessKeySession=true` 时，密码显示、密钥管理、表/字段/菜单设计、缓存/服务器管理、查看或踢出其它终端等功能必须保持不可用；后台任务中心最多读取和管理当前用户自己的任务。
- `/access-login` 必须在普通 SSO 发现之前直接放行，兑换最多等待 20 秒并给出明确错误，不能让页面永久停在“正在自动登录”。
- 历史 `?token=` 只作兼容：解析后立即清除参数，不输出、不持久化完整 Token，不为新功能生成这种链接。
<!-- /microi-progressive:chunk -->
