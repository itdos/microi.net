---
name: microi-ai-application
description: Microi 吾码 AI 应用的创建、迁移、工程化开发和交付规范。用于 Web、MicroService、UniApp、H5、响应式网站或游戏类 AI 应用，尤其是选择前端技术栈、生成 Vue 工程、维护 TypeScript 源码、接入登录与接口引擎、构建发布、二次开发和多端验收。
---

> **Microi吾码基础规范（强制）：** 任何 AI 模型与宿主每次新建或接续吾码任务，先完整读取 `../workspace-conventions/SKILL.md`，必须执行版本播报、`@microi.net/cli` 后台自动升级、Skills/MCP 同步和进度播报。安装与诊断读取 `../microi-codex-installer/SKILL.md`；更新失败延后重试，不阻断当前工作。

# Microi AI 应用

## 默认技术基线

新建或整体升级的 Web、MicroService 和 H5 AI 应用默认使用：

- Vue 3 单文件组件与 Composition API，优先 `<script setup lang="ts">`。
- Vite 作为开发服务器和生产构建工具，`base: './'`。
- TypeScript 严格类型检查；业务模型、接口入参、快照、事件和状态机不得长期使用散装 `any`。
- 原生 ESM 继续作为模块标准。Vue 与 Vite 本身就在 ESM 之上工作，不能把“ESM”和“Vue + Vite”描述成互斥方案。
- 依赖使用受支持的稳定版本并提交 lockfile。先验证 Node LTS、Vue、Vite、TypeScript 和插件的兼容范围，不盲目追随预发布版。

Vue Router 只在有多个可分享路由时引入；Pinia 只在跨页面或跨组件共享复杂状态时引入。单页局部状态使用组合函数。后台数据录入可以使用 Element Plus；独立 Web、官网和游戏界面使用 Microi.UI / MCI-UI token 与项目组件。

UniApp 使用 Vue 3 + TypeScript 的官方 Vite 工具链，并同时遵守 `microi-uniapp-frontend`。Canvas/WebGL 游戏仍让渲染循环保持独立模块，Vue 负责大厅、登录、房间、设置、HUD 和结算等 DOM 界面。

仅在用户明确要求、目标运行环境不能构建，或内容确实是一次性且无状态的极小静态页时，才允许原生 HTML/JavaScript 例外；在交付说明中记录原因、升级路径和验收范围。

详细目录、类型边界和配置样例见 [references/frontend-baseline.md](references/frontend-baseline.md)。

## 开始前

1. 调用 `microi_list_applications` 盘点目标 `ApiBase + OsClient` 的全部在线应用。
2. 对目标应用调用 `microi_get_application_context`，核对类型、源码清单、版本和构建产物；只读清单不能代替源码完整性检查。
3. 确认 `ApplicationType`：独立站点和游戏用 `Web`，宿主内多页面定制用 `MicroService`，跨端应用用 `UniApp`。
4. 读取 `microi-frontend-sdk`、`ui-design`；MicroService 再读取 `microi-microservice`，UniApp 再读取 `microi-uniapp-frontend`，游戏或复杂媒体再读取 `ui-design/references/motion-and-media.md`。
5. 在项目根目录维护 `.microi-micro-app.json`；源码必须位于当前租户的 `Microi-V8-Engine/.../AI应用/{appKey}`，不得跨租户复用目录。

当前服务器、当前租户的 `AI应用/{appKey}` 是每个 Web、UniApp、MicroService 或平台 AI 应用的唯一源码根。界面源码、Manifest、接口引擎、资源策略、安装测试、离线包生成与应用商城上传素材都必须归入对应应用目录共同演进；禁止创建平行的 `microi.apps/` 发行根或在应用目录中嵌套第二份可编辑工程。纯平台应用即使没有前端运行时，也放在官方租户的 `AI应用/{appKey}`，由自身构建脚本生成商城包。

## 工程边界

- `src/components` 保存可复用展示组件，`src/pages` 保存页面，`src/composables` 保存 UI 用例，`src/domain` 保存纯 TypeScript 业务规则，`src/services` 保存 API/实时通信适配，`src/platform` 保存 Microi 桥接。
- 规则核心不得依赖 Vue、DOM、localStorage 或 SignalR，保持确定性并可单元测试。
- 页面不得直接拼 `/apiengine`、Token、上传或文件地址；统一使用项目级 Microi SDK 实例和薄服务层。
- 公有 HDFS 应用使用标准 `microi-ai-app-auth.js` 登录桥。服务端始终从 Token 恢复 `V8.CurrentUser`，覆盖客户端提交的用户标识。
- 写操作、发牌、出牌、结算、库存或审批等业务事实走接口引擎或可信后端事务。通用 SignalR 只广播成功结果中 `DataAppend.RealtimeEvent` 的公共投影，私有或按用户裁剪的权威 Snapshot 继续走 HTTP 接口引擎；共享数据库、Redis 或状态机才是事实源。事件携带 `EventId` 与单调 `Version`，客户端检测版本缺口后重新拉取 Snapshot，断线重连按 EventId 幂等恢复。
- 新业务使用平台通用 v2 `/api-engine-realtime`，以普通登录 Token 调用 `SubscribeChannel`。30 秒时隙租约必须按返回的 `RenewAfterMilliseconds` 重复订阅续租，每次续租由 `realtime_{channel_key}_authorize` 按 `V8.CurrentUser` 重新授权；现有 AccessKey 在没有 `realtime:subscribe` scope 时拒绝。不要为每个游戏或业务再新增专用 C# Hub；旧 `/game-realtime` 仅作兼容。
- 环境配置从 `window.__MICROI_APP_CONTEXT__`、宿主上下文和模式文件解析。生产构建拒绝 localhost；开发地址只写 `.env.development.local`。

## 调用平台 AI

- 运行在吾码表单、表格、按钮或接口引擎上下文中的代码优先使用第一等 `V8.AI`：普通对话用 `await V8.AI.Chat(param)`，真实打字机输出用 `await V8.AI.ChatStream(param, onChunk, { Signal })`。前端实现会复用当前 ApiBase、登录 Token、设备/语言头和 Token 轮换；后端实现会固定绑定当前 `OsClient` 与认证用户。
- 独立 Web、MicroService、UniApp 的工程代码在 `src/services/ai.ts` 建立薄适配，调用当前平台 `POST /api/Ai/Chat` 或 SSE `POST /api/Ai/ChatStream`；从标准 Microi SDK/宿主上下文取得认证，不在页面中拼 Token、Endpoint、供应商 ApiKey 或任意 Header。
- 请求只传业务白名单字段，如 `UserChatMsg`、`AiModel`、`AiModelId`、`RelayModel`、`ConversationId`、`Mode`、`ReasoningEffort`、`Attachments`。服务端身份、租户、模型 Endpoint 和密钥不可由页面覆盖；NL2SQL 必须走专用受控入口，不能把页面提交的表名当授权。
- 外部 Agent 使用 MCP 的 `microi_chat` 获取最终对话结果；它不提供逐 token MCP 流，也不等于平台在线模型已经获得其它 MCP Tool 的 Agent Loop。需要写平台数据时仍调用对应写 Tool，执行确认、幂等和远端回读。
- 服务器 License 在本机通过官方公钥验签；有效 License 不要求每次 AI 调用访问官网。官方中转模型还会单独校验 `sk-microi-*` 和账号额度，这两套授权不能相互替代。

## Vue 实现规则

- SFC 模板承担真实 DOM 结构；事件使用 Vue 绑定，状态使用 `ref/reactive/computed`，副作用在组合函数的生命周期内注册并清理。
- 组件以业务语义命名，如 `RoomLobby`、`GameTable`、`AudioMixer`、`SettlementDialog`，不要按颜色或位置命名。
- 长连接、轮询、音频上下文、动画帧、观察器和全局事件必须在卸载时释放；页面隐藏时暂停非必要工作。
- 响应式布局至少覆盖 1440px 桌面和 390px 移动视口；使用安全区、44px 触控目标、键盘焦点和 `prefers-reduced-motion`。
- 音频应用必须区分背景音乐、人声和效果音，分别调节、静音和持久化；浏览器首次用户手势前不得强制播放。
- 不使用原生 `alert/confirm/prompt`；使用宿主反馈或可访问的 MCI 弹层。

## 存量迁移

### Cocos/WebGL 清晰度和资源生命周期

- 独立棋子/角色要求独立几何与身份，并不要求每个 glTF 重复上传整张纹理图集。同时核验磁盘资源和引擎实际 Texture2D/GFX bytes；主题切换时按自有 addRef/decRef 生命周期释放非活动模型和材质，迟到加载不得复活已销毁页面。
- Cocos 3.8.8 普通 Material 资产的宏与 pipeline states 在 initialize/copy 时设置；不能调用仅对实例有效的 recompileShaders/overridePipelineStates 后就假定生效。实际浏览器要复核绑定的贴图、法线、透明混合和叠加照明，类型检查不替代像素检查。
- 分开记录原生图片尺寸、局部材质密度、渲染缓冲分辨率、截图及真机画质。不得把放大、局部贴图或多图组合标为原生整幅 4K 母版；保留旧收藏与原始溯源。
- 七类动作等视觉测试应采集连续变化的真实网格状态；暂停引擎定格截图仅用于画面复核。FPS 必须在不暂停、不截屏的连续渲染区间单独计量，记录分辨率、GPU/软件渲染器与后台负载。
- 选中、起势、接触和吃子音效按时间轴独立触发。不得选棋就播放炮击或把每种兵种做成同一个音效的简单变调；新声音保留旧母版，削波/循环接缝通过不等于最终听感通过。

采用绞杀式迁移，避免一次重写破坏已经验证的规则：

1. 先把纯规则、API、音频和实时客户端固定为可测试模块。
2. 建立 Vue 3 + Vite + TypeScript 入口、SFC 页面壳和统一平台适配。
3. 按登录/大厅、房间、牌桌或舞台、设置、结算的顺序替换命令式 DOM。
4. 过渡代码只允许放在明确的 `legacy/` 目录，不得新增业务逻辑，并为剩余边界建立测试。
5. 只有命令式 DOM 查询/写入和全局事件已迁移、类型检查通过，才能声明“完整 Vue 架构迁移”；仅用 Vue 挂载旧 HTML 不算完成。

迁移期间保持接口引擎 Key、请求幂等键、版本字段、隐私投影和旧正式 URL 兼容。不要为追求框架统一重写已验证的游戏规则。

## 构建与发布

1. 先检查内存和已有 Node/Vite 进程，只运行一个高资源构建。
2. 依次执行类型检查、单元测试、生产构建和产物静态扫描。
3. 检查 `dist/build` 不含源码、Token、密钥、localhost、source map 或陈旧 chunk。
4. 同步私有源码，再流式发布公有构建目录；源码同步失败不得继续发布。发布前回读并冻结应用的 `CurrentVersion` 与 `AppVersion`，stage 只上传不可变版本资产，finalize 必须同时提交 `ExpectedCurrentVersion` 与 `ExpectedAppVersion` 做 compare-and-set；缺一项、状态漂移或回读不一致都停止，不能自动覆盖较新发布。
   - v3 的应用基线、fence、应用行版本及 active/committed 指针是原始请求的不可变事实；stage 后只按回读更新版本行的 `ExpectedVersionRowVersion`。已提交但仍为 `ProjectionPending` 时，先回读版本与应用，保留原 `RequestId / RequestFingerprint / DeliveryBatchId` 和首次 finalize 的应用基线，重放原请求取得幂等完成回执；禁止把提交后的新指针或 fence 拼入旧请求。只有 `Completed=true` 与 CDN 文件完整性回读同时通过，才继续发布安装包。
5. 每次创建、修改、升级或重新发布 AI 应用，必须在任何源码同步、stage、finalize 或商城制包之前，为目标精确 `AppVersion` 写入 `sys_microistore_changelog`。日志的 `StoreId / Version / Title / ChangeType / Content / ReleaseTime` 必须完整；发布工具显式传入含义一致且非空的 `changeSummary`，发布后同时回读商城子表与 `mci_ai_app_version.ChangeSummary`。缺日志或版本不一致必须停止发布。
6. 官方 Web、UniApp、MicroService 的体验地址统一为 `https://static.itdos.com/{OsClient小写}/micro-app/{AppKey}/index.html`，公有桶对象键与域名后的路径完全一致；不再按运行类型分叉到 `ai-app-publish`，也不把 v3 内部 API resolver 用作公开体验地址。当前版本的全部编译文件写入该应用固定根，历史版本写入同根的 `/{Version}/` 目录；历史目录一旦验证不得覆写成不同字节。
7. 同一版本私有源码文件使用相同的租户、应用、版本相对路径写入私有桶；固定根保存最近一次已完成发布的源码。确实不含源码的编译包在包声明中记录 `Source=NotIncluded`，运行时版本的 `SourceSnapshotPath` 保持空值，不得从公有产物伪造源码。先校验完整公有版本与私有源码快照，再提升固定根的非入口资产和 `index.html`；固定入口切换后提交 CDN 精确路径刷新，回读刷新任务终态和公有入口及引用资源，再更新商城 `PreviewUrl/PublicPublishPath`。刷新任务仅提交成功、单个 CDN 节点 200 或本地构建成功都不算完成。
8. 官网、二维码、分享链接和商城“立即体验”只使用固定根 `index.html`；版本目录仅供回滚与显式历史预览。CDN 直接读取公有桶对象，不要求其做动态版本解析或反向代理。发布器必须使 HTML 引用的 JS/CSS 在切换时已存在，并验证从 `static.itdos.com` 打开的应用仍把业务 API 请求发往目标租户的 `ApiBase`。
   v3 的 `sys_microistore.PreviewUrl/PublicPublishPath` 和版本 `PreviewUrl` 在数据库内保留以 `/` 开头的对象路径，后端完成态检查会与投影路径逐字比较；官网接口与商城工作台对外展示时使用租户 `FileServer` 转为完整 CDN URL。不得为统一展示直接把这些 v3 内部字段改写成绝对 URL。
9. 新的官方 Web、UniApp、MicroService 发布统一使用支持固定 CDN 投影的 v3 目录流式发布；旧 `ai_app_build` 只保留历史兼容和迁移读取，不作为新版本发布入口。目标 API 的 `ApplicationCdnProjectionSupported` 未启用时先部署后端并停止新发布，不回退到 `ai-app-publish`。
10. 官方 `static.itdos.com` 的刷新凭据从当前租户后端系统设置 `Integration.Cdn.Aliyun.*` 读取，兼容旧的 `Integration.Dns.Aliyun.*` 与 SaaS `AlidnsKeyId/AlidnsKeySecret`；必须成对配置并具备刷新及任务查询权限。刷新任务可能合并多个 URL 到同一任务号，应以全部任务 `Complete` 和 CDN 文件哈希回读为准；不得仅凭提交成功切换商城入口。批量发布须考虑 CDN 每日刷新配额。
11. `SharedPublicRuntime.EntryUrl` 和历史版本目录仅用于历史记录、回滚、摘要校验与审计。回读应用、版本、active 文件清单和 SHA-256；旧清单文件只能可逆归档，不能删除。再分别直接请求稳定当前入口、不可变版本入口及主要 JS/CSS，并断言前者完成加载后地址栏仍不含版本段。

## 完成定义

### 真实写入与源码包可执行性

- 遇到 Jint 的 CLR 类型解析或程序集缺失，先在目标后端复现。优先调用已公开且经过验证的 `V8.Method` 原子，禁止用 `Math.random` 代替正式随机源；使用 UUID 随机位时必须核对宿主运行时的随机保证、避开固定版本位并使用拒绝采样消除模偏差。
- 一次业务操作中的 SQL、行锁、请求幂等响应、库存、凭证和审计必须通过同一个 `V8.DbTrans` 执行。仅验证返回失败不足以证明回滚；自动化测试还须回读每类副作用与请求记录，确认没有永久 `Processing` 或部分提交。
- 领奖码等可逆业务秘密优先使用现有可信宿主的租户／接口绑定保护原子；兼容旧格式时只读旧密钥，不要求新安装租户人工补充未声明配置。真实测试覆盖生成、再次解密、过期、错误码和重复核销。
- 私有源码 ZIP 中的 `package.json`、lockfile、构建／检查脚本与行为测试必须自包含。下载到独立目录后仍可安装、测试并构建，不得引用开发工作区的父目录脚本或缺失工具链。构建回执绑定候选源码和逐文件产物哈希，任一漂移即失效。
- 从业务入口登录真实账号，完成首个写操作及整个生命周期；再验证不同身份、撤权、重复请求、并发与刷新恢复。静态截图、模拟登录或合同正则匹配不能替代这些验收。

- `vue-tsc --noEmit`、单元测试和生产构建通过。
- 源码、lockfile、Manifest、构建版本和远端文件哈希一致。
- 匿名、登录、Token 失效、权限不足、弱网、重连和错误恢复有确定结果。
- PC 和移动真实浏览器截图通过，控制台无错误，刷新/分享 URL 可恢复状态。
- 多人或分布式功能必须使用不同账号和至少两个 API 节点验收；本地单进程或静态代码检查不能宣称生产多人闭环。
