---
name: microi-ai-application
description: Microi 吾码 AI 应用的创建、迁移、工程化开发和交付规范。用于 Web、MicroService、UniApp、H5、响应式网站或游戏类 AI 应用，尤其是选择前端技术栈、生成 Vue 工程、维护 TypeScript 源码、接入登录与接口引擎、构建发布、二次开发和多端验收。
---

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

## 工程边界

- `src/components` 保存可复用展示组件，`src/pages` 保存页面，`src/composables` 保存 UI 用例，`src/domain` 保存纯 TypeScript 业务规则，`src/services` 保存 API/实时通信适配，`src/platform` 保存 Microi 桥接。
- 规则核心不得依赖 Vue、DOM、localStorage 或 SignalR，保持确定性并可单元测试。
- 页面不得直接拼 `/apiengine`、Token、上传或文件地址；统一使用项目级 Microi SDK 实例和薄服务层。
- 公有 HDFS 应用使用标准 `microi-ai-app-auth.js` 登录桥。服务端始终从 Token 恢复 `V8.CurrentUser`，覆盖客户端提交的用户标识。
- 写操作、发牌、出牌、结算、库存或审批等业务事实走接口引擎或可信后端事务。通用 SignalR 只广播成功结果中 `DataAppend.RealtimeEvent` 的公共投影，私有或按用户裁剪的权威 Snapshot 继续走 HTTP 接口引擎；共享数据库、Redis 或状态机才是事实源。事件携带 `EventId` 与单调 `Version`，客户端检测版本缺口后重新拉取 Snapshot，断线重连按 EventId 幂等恢复。
- 新业务使用平台通用 v2 `/api-engine-realtime`，以普通登录 Token 调用 `SubscribeChannel`。30 秒时隙租约必须按返回的 `RenewAfterMilliseconds` 重复订阅续租，每次续租由 `realtime_{channel_key}_authorize` 按 `V8.CurrentUser` 重新授权；现有 AccessKey 在没有 `realtime:subscribe` scope 时拒绝。不要为每个游戏或业务再新增专用 C# Hub；旧 `/game-realtime` 仅作兼容。
- 环境配置从 `window.__MICROI_APP_CONTEXT__`、宿主上下文和模式文件解析。生产构建拒绝 localhost；开发地址只写 `.env.development.local`。

## Vue 实现规则

- SFC 模板承担真实 DOM 结构；事件使用 Vue 绑定，状态使用 `ref/reactive/computed`，副作用在组合函数的生命周期内注册并清理。
- 组件以业务语义命名，如 `RoomLobby`、`GameTable`、`AudioMixer`、`SettlementDialog`，不要按颜色或位置命名。
- 长连接、轮询、音频上下文、动画帧、观察器和全局事件必须在卸载时释放；页面隐藏时暂停非必要工作。
- 响应式布局至少覆盖 1440px 桌面和 390px 移动视口；使用安全区、44px 触控目标、键盘焦点和 `prefers-reduced-motion`。
- 音频应用必须区分背景音乐、人声和效果音，分别调节、静音和持久化；浏览器首次用户手势前不得强制播放。
- 不使用原生 `alert/confirm/prompt`；使用宿主反馈或可访问的 MCI 弹层。

## 存量迁移

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
5. Web/UniApp 使用 `/{OsClient}/ai-app-publish/{AppKey}/index.html`；MicroService 使用 `/micro-app/{OsClient}/{AppKey}/index.html`。不要因技术栈相同而混淆运行类型。
6. 回读应用、版本、active 文件清单和 SHA-256；旧清单文件只能可逆归档，不能删除。再直接请求稳定入口、不可变版本入口及主要 JS/CSS。

## 完成定义

- `vue-tsc --noEmit`、单元测试和生产构建通过。
- 源码、lockfile、Manifest、构建版本和远端文件哈希一致。
- 匿名、登录、Token 失效、权限不足、弱网、重连和错误恢复有确定结果。
- PC 和移动真实浏览器截图通过，控制台无错误，刷新/分享 URL 可恢复状态。
- 多人或分布式功能必须使用不同账号和至少两个 API 节点验收；本地单进程或静态代码检查不能宣称生产多人闭环。
