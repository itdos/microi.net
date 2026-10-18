# 工作区与平台专项保障

> 原规则按适用范围无损迁移；触发对应工作时必须完整读取相关章节。

<!-- microi-progressive:chunk id=workspace-conventions-002 sha256=795821e68c0c347c68f8cdcb6e2f81defa9a172650216288c10d313075e3247d -->
## 分布式部署与重启安全规范（强制）

Microi 平台后端功能必须默认按多节点部署设计：多个 API/Worker 节点位于同一负载均衡入口之后，共享业务数据库、MongoDB 和 Redis，并可能在请求执行过程中滚动发布、硬重启或发生网络分区。不得先按单机实现、上线后再补分布式保护。

- 进程内 `static`、单例、内存字典、本机定时器和本地文件只能用于单节点优化、缓冲或诊断，不能作为全局唯一状态、全局锁、任务是否执行过或业务完成的事实源。会跨请求、跨节点或跨重启使用的状态必须进入共享数据库、Redis 或可靠消息系统，并按 `OsClient` 隔离。
- `Microi.Job`、定时扫描、消息消费、补偿任务和启动初始化等可能被每个节点同时触发的逻辑，必须使用带租约和超时的分布式锁或数据库抢占；锁 Key 至少包含租户和任务唯一标识。锁必须有唯一持有者令牌、续租、超时自动释放和“仅持有者可释放”语义，必要时增加 fencing token，禁止只用 `static bool`、普通 `lock` 或不带过期时间的 Redis Key。
- 分布式锁只能减少并发执行，不能代替业务幂等。任务、接口重试、消息重投和跨节点故障转移必须同时使用稳定幂等键、数据库唯一约束/条件更新、状态机或 outbox/inbox；扣款、库存、积分、流水等副作用不得因为锁过期、节点暂停或重试而执行两次。
- 用户会话、临时票据、去重窗口、进度和任务租约默认放共享 Redis/数据库；本机缓存必须允许丢失，并通过版本号、短 TTL、发布订阅失效或数据库回源容忍节点间不一致。禁止把用户固定绑定到某节点才能保证正确性。
- 每个节点可以保留独立异步队列，但事件必须在产生时分配全局唯一 `EventId`，消费端按该 Id 幂等写入。故障 spool/WAL 必须使用固定目录的持久卷，节点标识由平台自动生成，不为此增加环境变量；共享目录也必须允许多个节点并发重放且不产生重复业务结果。
- 服务停机要先停止接收新工作，再在有上限的宽限期内排空或持久化已接收工作；重启后自动扫描并幂等恢复未完成任务、临时文件和 outbox。启动迁移、建索引、种子数据和缓存预热必须可重复运行，多节点同时启动不能报错或产生重复数据。
- 发布期间新旧版本会短暂并存。数据库、缓存值、消息和 API 合约必须遵守“先扩展、后迁移、再收缩”的向前/向后兼容顺序，不能要求所有节点同一时刻升级完成。
- 健康检查必须区分 liveness、readiness 和依赖降级；节点未完成恢复或正在排空时应退出流量，而不是继续接单后硬终止。单个节点的熔断、计数和告警只代表本节点，平台级判断必须聚合全部节点。
- 验收至少启动 2 个节点连接同一组 Redis/数据库，并覆盖：同一定时任务同时到点、同一请求/消息重复投递、锁持有者中途退出、MongoDB/Redis 短暂故障、写入后响应前重启、滚动升级和未排空时强制结束。最终断言应包括业务副作用仅一次、日志/消息可幂等恢复、无永久死锁、无重复初始化、旧新版本可共存。
- 若要求宿主机掉电或 `kill -9` 窗口内也绝对零丢失，必须在返回业务成功前取得外部持久消息队列、共享 outbox 或同步 WAL 的持久化确认；“内存队列随后异步落盘”不能宣称覆盖尚未持久化的强杀窗口。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-003 sha256=478664d863219c724b8d19d25e7ac17420add6229c9efab5b75823d815aede53 -->
## 本地资源与 OOM 保护规范（强制）

AI 在用户本机启动 Node.js、Vite、Webpack、dotnet build、Java、Docker build、浏览器自动化、压力测试或其他可能长时间占用 CPU/内存的进程前，必须先评估资源，不得为了“让构建跑过”无限抬高堆内存或 Worker 数。

- 启动前检查物理内存总量、当前占用率、可用内存，并检查是否已有同类 dev server/构建进程。已有可复用服务时禁止重复启动。
- API、PC 框架、官网和 Agent 发布按各自范围独立排队，可以并行执行；同一范围的发布互斥，不得用一个全局发布窗口阻塞无关产品。并行任务必须隔离输出、日志、测试目录和临时服务，显式限制 Worker/并发数；仅在实际共享输出、服务或资源预算不足时串行。
- 启动重任务前按“当前并行阶段的进程树预算总和 + 系统安全余量”判断：阶段预算优先采用实测峰值；尚无实测时，用已限制的堆/容器上限加明确的原生进程、Worker 与缓冲开销。系统安全余量取 `max(1.5 GB, 物理内存的 5%)`，不得再按固定 20% 将大内存机器的启动门槛线性放大。顺序执行的阶段分别计算，禁止把不会并发的阶段峰值相加。机器总内存占用达到 95% 时，立即暂停或终止 AI 启动的重任务及其子进程，不得等待 OOM。
- 禁止将 `--max-old-space-size`、JVM heap、Docker memory 或类似上限设为接近物理内存总量。除非用户明确授权独占构建窗口，单个 AI 启动的进程树不得持续占用超过物理内存的 25%。
- 后台/长任务必须记录根 PID、子进程、启动时间和独立日志，每 15-30 秒监测一次进程树内存与全机可用内存。任务失败、中断或达阈值时必须停止整个子进程树，不得遗留孤儿 Node/dotnet/Java 进程。
- 全量构建无法在上述阈值内完成时，先停止并改用定向 lint、类型检查、按模块构建或按测试文件验证。如仍必须进行全量验收，应明确报告资源瓶颈，交由 CI/专用构建机或经用户明确同意的独占时段执行，禁止在用户正在使用的 VS Code 会话里硬跑。
- **本地测试程序与依赖生命周期（强制）**：优先复用健康源码/Vite，或在隔离目录启动已编译的吾码程序；共用已授权开发/测试依赖，用库、租户和命名空间隔离，不按 AI 任务或节点批量创建 Docker/Compose。新建本地 Docker 测试依赖须有必要性、最小清单及用户针对该动作的授权，一般开发、Full 或镜像发布不自动包含此动作。每轮成功、失败、取消及资源阻塞退出均收回自建进程、浏览器和临时容器并独立回读，保留既有共享服务；报告内存不足前先收回本任务遗留占用。详见[本地测试程序与依赖生命周期](progressive-02-microi-net-api-本地启动约定.md#本地测试程序与依赖生命周期强制)。

### `Microi.Client` 框架前端构建频率（强制）

- 修改吾码低代码平台框架前端 `Microi.Client/` 时，开发阶段必须优先复用已运行的 Vite 开发服务，通过热模块更新（HMR）、定向静态测试和浏览器回归验证改动。禁止把 `npm run build` 当作每轮修改后的常规检查，禁止因切换需求、修改单个组件或上下文压缩而重复执行全量构建。
- 只有全部框架前端源码修改、定向测试和浏览器验收均已完成后，才允许在最终收尾阶段执行一次 `npm run build`，用于确认正式产物能否生成。执行前仍须按本节检查内存、同类进程和构建预算；已经成功且之后没有再修改框架前端源码时不得重复构建。
- Vite 热更新未生效时，先检查页面、控制台、文件监听和当前 61500 开发服务归属；确需重启时按共享进程与发布锁规范精确停止本工作区原有 `npm run dev`，再重新执行 `npm run dev`。不得用 `npm run build` 代替开发服务重启，也不得结束所有 `node`、浏览器或其它对话的进程。
- 本规则只约束 `Microi.Client/` 吾码框架前端源码。独立 MicroService、Web、UniApp 等应用源码仍按其交付 Skill 在发布前执行自身必要的构建；不得因为本规则跳过微服务正式产物生成。
<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-004 sha256=443f093b8ae93e4f62df416006bc34969a6d8cde4741745acc5fdec829d957da -->
## 临时文件与 AI 产物放置规则（强制）

- 长期交付资料归对应 `AI-Project/` 项目；不得重新生成公开根仓 `output/`。本工作区既有资料在 `AI-Project/microi/文档/历史交付资料/output/`，第三方推广 Skill 在 `AI-Project/microi/推广/skills/yixiaoer/`，均不随公开源码分发。
- `Microi.net.Api` 只负责协议、请求上下文、鉴权接入、DI 和宿主生命周期；状态机、Redis、持久化、业务权限与调度归 Core 或插件，其它项目不得反向依赖 API 宿主。业务编排继续优先接口引擎。

AI 在工作区任意任务中生成的**一次性临时脚本、诊断文件、测试截图、临时报告**，**严禁放在工作区根目录（`<workspace-root>/`）**，必须放在指定位置：

| 类型 | 指定位置 |
|------|---------|
| 一次性脚本（.py / .mjs / .ps1 / .sh） | `.tmp/` |
| 诊断截图、调试图片 | `.tmp/screenshots/` |
| E2E 配置、用例和帮助器（Microi.Agent 插件生成） | `<projectRoot>/.microi-e2e/` |
| E2E 截图、报告、trace、video、test-results | `<gitRoot>/.tmp/microi-e2e/<项目相对路径>/` |
| AI 一次性 E2E 脚本、截图、日志、报告 | `.tmp/`、`.tmp/screenshots/`、`.tmp/reports/` |
| 性能测试 HTML 报告 | `.microi-performance/` |
| 项目专属临时文件 | `<对应子项目目录>/` 内，不要写到根目录 |

**严禁在根目录创建**：
- 任何 `*.mjs`、`*.py`、`*.ps1`、`*.sh` 一次性临时脚本
- 任何 `.tmp-*.js`、`.tmp-*.json`、`.tmp-*.txt`、`.tmp-*/` 这类伪临时文件或目录
- 任何 `screenshots/`、`dark-mode-*/`、`test-*/`、`debug-*/` 临时目录
- 孤立的 `node_modules/`（根目录没有 `package.json`，不应安装 npm 包）
- 孤立的 `obj/`、`dist/`、`build/`（非对应项目文件）

`.tmp/` 已在 `.gitignore` 中排除，但创建临时文件必须登记归属，并在每轮测试结束后按 [测试临时文件随任务清理](../SKILL.md#测试临时文件必须随任务清理强制) 删除已无用途的自有产物；必要证据先最小归档，确需暂留的文件记录原因与清理时机，不能无限堆积。

**2026-06 强制补充**：AI 不得在任何子项目目录下放置一次性日志、自动化截图、接口回收文件或调试脚本。像 `Microi.Server/Microi.net.Api/.tmp-*.log`、`Microi.Client/*.png` 这类文件一律视为规范失败，必须移到 `<workspace-root>/.tmp/` 或 `<workspace-root>/.tmp/screenshots/`。正式 Playwright 工程由 Microi.Agent 插件生成时可以继续使用 `.microi-e2e/`，但 AI 为某个任务手写的一次性 Playwright 脚本、报告和截图仍然必须放在 `.tmp/`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-005 sha256=f627ee155b40014af76926b3a432601aa3f6bec5a7eb98ca0540c83fa41f1e5a -->
## Microi 源码路径速查（工作区根相对路径）

当用户提到“吾码后端源码”“吾码前端源码”“表单引擎源码”“官网源码”等简称时，默认按下列路径定位；如果当前工作区缺少对应目录，再用 `rg --files` 或目录搜索确认实际位置。

| 用户常用说法 | 默认路径 |
|--------------|----------|
| 吾码 MCP 前端源码 | `microi.mcp/` |
| 吾码 MCP 后端源码 | `Microi.Server/Microi.MCP/`；HTTP 接口声明保留在 `Microi.Server/Microi.net.Api/Controllers/V8EngineController.cs` |
| 吾码 skills / 知识库 | `microi.skills/` |
| 吾码 VS Code 插件项目 | `Microi.Agent/` |
| 吾码低代码平台后台系统前端源码 | `Microi.Client/` |
| 吾码后台系统前端移动端自适应源码 | `Microi.Client/src/views/mobile/` |
| 吾码低代码后端源码 | `Microi.Server/` |
| 吾码表单引擎源码 | `Microi.Client/src/views/form-engine/` |
| 吾码表单设计器源码 | `Microi.Client/src/views/form-engine/diy-design.vue` |
| 吾码数据表格渲染源码 | `Microi.Client/src/views/form-engine/diy-table.vue` |
| 吾码表单渲染源码 | `Microi.Client/src/views/form-engine/diy-form.vue` |
| 吾码地图控件源码 | `Microi.Client/src/views/form-engine/diy-field-component/diy-map.vue` |
| 吾码界面引擎源码 | `Microi.Client/src/views/page-engine/` |
| 吾码打印引擎源码 | `Microi.Client/src/views/print-engine/` |
| 吾码 App 源码 | `microi.app/` |
| 吾码 UniApp 源码 | `microi.uniapp/` |
| 吾码官方网站 / 文档源码 | `microi.doc/` |
| 吾码 AI 应用及应用商城发行源码 | 默认位于 `Microi-V8-Engine/{系统名称} ({ApiBase域名})/{OsClient}.{OsClientType}.{OsClientNetwork}/AI应用/{appKey}/`；受审计的独立源码仓库必须由发布契约显式指定 |

`Microi.MCP` 与 `Microi.AI` 一样使用独立内部 Git 仓库和统一 DLL 混淆流程。`Microi.Anderson.sln` 加载源码，`Microi.net.sln` 消费同平台版本 NuGet；MCP 实现不得放回 Core 或 Controller，Core 仅保留非 MCP 入口也需要的通用原子。根公开仓必须排除 `Microi.Server/Microi.MCP/` 的普通文件和 gitlink，发布源码指纹须覆盖该独立仓库。

以上路径只作为通用工作区相对路径规范，不写入具体本机盘符。跨仓库、空工作区或普通用户项目中，如果路径不存在，以插件生成的 `AGENTS.md`、MCP 配置和实际文件树为准。

每个 `AI应用/{appKey}` 必须只有一个可编辑事实源，统一承载界面、微服务、Manifest、接口引擎、资源策略、测试、构建脚本与商城上传素材。普通应用默认使用当前连接下的 `Microi-V8-Engine` 目录；受审计的官方内置应用若由独立 Git 仓库维护，必须由版本管理的发布契约唯一指向该源码根，并让构建、跨工程测试和发行包共同读取契约。此时同名 `Microi-V8-Engine` 目录只是远端同步镜像，不得回退为构建源。禁止靠目录探测在多份副本之间自动择新，也禁止另建无契约的 `microi.apps/` 平行发行根。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-006 sha256=fb29cd39fe580e3e38df4c0483e5530f876697418f38b391aa421606c8fc6fe5 -->
## Skills 通用化原则

编写或更新 `microi.skills/` 下的技能文档时，**不能加入特定项目名称、特定本地路径或特定业务规则**，必须保持通用性：

- ❌ 不允许：`<workspace-root>/某客户项目/某业务应用`
- ❌ 不允许：任何客户、租户或交付项目名称
- ❌ 不允许：某项目特定的费率、字段名、接口 Key 作为"规范"
- ✅ 允许：使用 `<项目路径>`、`<OsClient>` 等占位符
- ✅ 允许：通用的最佳实践、模式和约定
- ✅ 项目特定规则应维护在各项目自己的目录内（如 `AI-Project/<项目>/` 或项目根的 `tests/`）

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-007 sha256=c23d7942a3b6176b464fe267546c09dcadf990c2c243576c267c644b4502795d -->
## Skills 中文优先规则

编写、补充或重构 Microi 吾码相关技能文档和 AI 指令文件时，**能用中文就必须用中文**。适用范围包括 `microi.skills/**/SKILL.md`、`microi.skills/README.md`、`AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md`、`.cursorrules`、`.cursor/rules/*.mdc` 以及 VS Code 插件生成这些文件的模板源码。

- 标题、段落、清单说明、验收标准、注意事项、示例代码注释、提交说明和生成文案默认使用中文。
- 只有代码/API 标识符、文件名、命令、环境变量、协议名、请求头、JSON/YAML 字段名、CSS 类名、路由、包名、框架/产品专有名词、必须原样返回的错误文本等确实不能翻译的内容才保留英文。
- 如果为了搜索、触发或兼容必须保留英文术语，采用“中文说明 + 英文标识”的写法，例如 `技能文件（Skill）`，不要整段英文说明。
- 更新 VS Code 插件生成模板时，要同步检查当前已生成的 `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md`、`.cursorrules` 和 Cursor rules，避免模板下一次刷新又把英文写回来。
- 收尾时用 `rg` 扫描明显英文规范短语（如 `Use when`、`Required:`、`Forbidden:`、`Acceptance:`、`Quick Workflow`、`MCP default visibility`）。剩余英文必须属于必要标识符或专有名词。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-008 sha256=cd38647f4ae3c186e247c06ce44b45e42ce7e664d58fbed82c93595547638a7c -->
## 官方文档原位增补与中文单源规则（强制）

修改 Microi 官方文档前，必须先用 `rg` 查找已有页面、标题和示例，并在最匹配的现有页面原位补充。不得因为方便就新建相近主题的 Markdown 页面、导航项或页面路由，避免同一 API 的说明散落多处。只有现有目录确实没有承载该独立主题的页面，而且新页面具有长期独立维护价值时，才允许新增页面，并需同时说明新建原因和导航归属。

- 前端 V8 API 的主文档固定维护在 `microi.doc/docs/doc/v8-engine/v8-client.md`。
- 后端 V8 / 接口引擎 API 的主文档固定维护在 `microi.doc/docs/doc/v8-engine/v8-server.md`。
- 导入导出等专题页可以保留深度案例，但新增或修改 `V8.Office`、`V8.Http` 等公共 API 时，必须先补齐上述前端/后端 V8 主文档，再按需同步专题页，不能另建重复 API 页面。
- `microi.doc/docs/doc/` 是人工维护的中文文档单源；`microi.doc/docs/en/` 由官网统一翻译生成。日常功能开发只修改中文文档，不手工修改英文版，不为“中英文同步”重复写一遍。
- 文档改动后执行 `npm run docs:build`；验收时检查本次没有无理由新增 `.md` 页面或导航路由。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-009 sha256=bec8162387c470c0cad1252645dbb4ecdafb0abb5f9b042525b6df8671e77ab0 -->
## 多对话共享工作区变更归属保护（强制）

### 功能验收后的源码提交与推送（强制）

- 每个已完成并通过相应验收的功能、修复或独立里程碑，必须把本任务源码、测试和必要文档按实际 Git 仓库分别提交并推送；不能仅保存在工作区、stash、临时目录或已发布产物中。用户明确要求不提交/不推送、只读任务和未完成的实验除外，不为无改动仓库制造空提交。
- 提交前回读工作树、暂存区、上游和远端；按可核验的本任务 hunk 暂存，保留其它对话的改动与既有暂存项。公开根仓只提交公开代码；闭源目录只从各自独立仓库根提交并推送到其已有内部远端，严格执行公开仓闭源路径门禁，不能用 gitlink 或强制添加绕过隔离。
- 推送前先获取上游的新提交并安全整合；共享工作区有并行改动时优先在隔离候选中合并，不用整树 stash/reset 覆盖他人成果，不强推共享分支，不绕过仓库 Hook。需要精确回滚时保留独立、说明清楚的功能提交；回滚已推送功能通常使用新的反向提交，不改写共享历史。
- 正式发布的候选必须包含此前已交付功能和本任务已核验的源码，先按仓安全本地提交，再冻结完整构建输入与内容哈希；仅更新说明页面时也要核对整个站点候选。Git 远端推送与提交号回读默认在制品发布前完成；若用户明确授权“Git 推送失败不阻断 NuGet/Docker”，仅允许把这两类平台制品的远端推送移到并行或后续步骤，不放宽 Full、闭源隔离、加密、候选/产物一致性及渠道回读。隔离工作树没有未提交变更不等于已包含最新功能；发布锁也不能代替源码完整性检查。
- 收尾逐仓记录本地提交号、远端分支和回读结果，区分源码、NuGet、Docker 与客户部署。远端网络、认证或容量故障时作有界诊断，保留本地提交、失败原因和待补推清单；在上述用户明确授权且本地候选已完成全部制品门禁时，可继续独立发布 NuGet/Docker，但必须如实标记源码尚未推送，不能宣称完整交付。源码冲突、归属不明、保护路径违规或候选漂移不是“Git 推送故障”，必须先处理，不能借例外发布不确定源码。

- **Git 大文件推送确认（强制）**：每次 Git 推送前检查全部待推送提交中新引入的 Blob；单个达到 10 MiB 或合计达到 50 MiB 时，必须提供路径、实际大小、SHA-256 和目标仓库/分支，取得用户对具体清单的确认后才推送。一般提交推送授权不能代替大文件确认；完整检查、CDN 引用、历史瘦身与失败回执规则见[Git 大文件推送确认](progressive-03-cli-与-ide-插件错版共存约定.md#git-大文件推送确认强制)。

同一工作区可能同时被用户、其它 Codex 对话、IDE、自动化任务或外部 Git 操作修改。任务启动前已经存在、或无法用本对话证据严格证明归属的差异，一律视为他人资产并保留；“工作区是脏的”不是清理授权。

- 开始修改前先保存只读基线，至少包括 `git status --short`、目标文件的 `git diff -- <file>`，必要时记录文件 SHA-256。VS Code 重启、上下文压缩或接续中断任务后，必须重新建立基线，不能沿用对差异归属的猜测。
- 修改时间接近当前时间、提交位于最新 `HEAD`、提交作者与当前用户相同、提交信息与当前任务相关、分支已经同步到 `origin`，都不能证明改动来自本对话；其它对话可能在同一时间和身份下提交或推送。
- 可撤回的范围只能来自本对话可核验的写入证据，例如已记录的精确 `apply_patch`、写入前后内容或明确由本对话创建且逐项可对应的 hunk。即使能证明归属，也只能反向修改这些精确 hunk，不能扩大到整文件、整提交或相邻改动。
- 执行撤回、覆盖、删除、格式化、生成器重写或 `git revert` 前，必须按 hunk 核对 `git diff` 与相关 `git show`；`git blame`、`reflog` 和提交时间只能辅助调查，不能单独作为归属证明。证据不足时停止修改并询问用户。
- 禁止为了获得干净工作区而使用整文件覆盖、`git checkout -- <file>`、`git restore <file>`、`git reset --hard` 或删除未跟踪文件；这些操作可能抹掉其它对话尚未提交的成果。
- 修复误撤回时，只恢复被本对话删除的原始字节/行，随后断言目标 hunk 已恢复、其它既有差异保持不变，并在最终说明中明确列出仍存在但未触碰的并行改动。
- 对 `microi.doc/docs/doc/about/update-log.md` 尤其严格：已经发布的条目即使日期是当天、位于最新提交或内容覆盖当前任务，也必须默认属于既有发布成果。除非用户明确要求修改，或本对话持有精确新增证据，否则不得删除、重写或降级该条目。

## 本地多租户浏览器隔离（强制）

- 本地 `Microi.Client` 使用 `src/config.json.ApiBaseDev` 作为默认 API；URL 中位于 `#` 之前的
  `ApiBase` 与 `OsClient` 是当前页面最高优先级，标准形式为
  `http://localhost:61500/?OsClient=<tenant>&ApiBase=<encodeURIComponent(apiBase)>#/route`。
- 同一个浏览器 Profile/Context 下的 localhost 页面共享 localStorage、Pinia、Token、CurrentUser、
  ApiBase 和 OsClient。并行测试不同目标时，一组 `ApiBase + OsClient` 必须对应一个独立浏览器
  Context/Profile；Playwright/Codex 使用 `browser.newContext()`，不得只在同一 context 中新开 Page。
- 人工测试的第二个不同租户至少使用无痕窗口；多个无痕窗口可能共享同一临时会话，三个以上并行
  目标必须使用独立 Profile、独立 `--user-data-dir` 或自动化独立 context。
- AI 收到线上吾码地址时，先在一次性独立 context 读取
  `window.__MICROI_RUNTIME_ENDPOINT__`；旧版再回退到页面全局值、同源缓存和域名解析。确认实际
  ApiBase/OsClient 后，才在新的独立 context 打开本地 URL。详细流程读取 `microi-client-frontend`、
  `playwright-e2e` 与 `microi-deployment`。

<!-- /microi-progressive:chunk -->
