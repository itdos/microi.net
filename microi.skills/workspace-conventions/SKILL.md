---
name: workspace-conventions
description: Microi 工作区全局约定。用于在本工作区工作时，确保临时文件、生成产物和项目专属内容放在正确位置，不污染仓库根目录。
---

# Microi 工作区全局约定

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=workspace-conventions-000 sha256=69e7d2eba409a0e2095bb24e1b4f4b758e5749e43df34dcf696d47de40e57627 -->
## 任务启动前 Skill 读取规则（强制）

AI 处理任何 Microi 低代码、V8、MCP、OpenClaw、采集引擎、前端、后端、UniApp、文档、测试或交付任务前，必须先按任务类型读取相关 `microi.skills/**/SKILL.md`。不能等到写代码或出问题后才补读。

- 通用任务至少读取本文件；涉及完整交付、MCP 建模、远端 V8、菜单、字段或生产数据时，同时读取 `microi-system-delivery`。
- 涉及采集引擎、浏览器 Worker、验证码、站点规则、导出产物时，同时读取 `spider-engine`。
- 涉及 V8 CRUD、SQL、上传下载、导入导出、菜单按钮、表单事件、前端页面或自动化测试时，继续读取对应专项 Skill。
- 最终交付说明必须能逐条对应用户编号需求；不得遗漏、合并或把仍可执行的需求写成“下一步继续”。

### Microi吾码非阻塞自动更新（强制）

- VS Code 扩展、`@microi.net/cli` 与 Codex 插件默认自动检查和安装更新。任一 Microi 任务开始时可后台投递 `microi update --background --workspace "<工作区绝对路径>" --json`，但不得等待它完成才开始业务分析、MCP 调用、源码修改、构建或发布。
- CLI 最新版只从 npm 官方 registry 查询：`npm view '@microi.net/cli' version --json --prefer-online --registry=https://registry.npmjs.org/`；VS Code 扩展只使用官方扩展宿主的自动更新/安装命令。不得使用第三方 registry 或不明镜像冒充官方更新。
- 后台更新完整闭环包含全局 CLI、`microi@microi-net`、`microi ai init`、`microi doctor` 与 `microi codex status`。`codex install --yes` 的 `--yes` 只兼容旧脚本，不是用户继续工作的授权开关。
- 当前运行中的 VS Code Extension Host、CLI、Codex Router、MCP 和对话继续使用已加载版本。禁止为了更新终止进程、强制重载、要求立即新建任务或拒绝新工作；新版只在后续新进程或宿主自然重启时接管。
- npm 官方 registry 无法访问、权限不足、文件被运行中进程占用、安装失败或宿主不能热更新时，必须写入可诊断状态并延后重试。可以非模态提示“立即重试/查看日志”，但用户忽略、关闭或暂不处理时，当前、正在进行和新建的 Microi 工作仍必须继续。
- 只有任务明确依赖旧版本不存在的具体能力时，才准确说明该能力边界与可用降级方案；不得用“最新版未通过”“尚未授权升级”作为整项任务的失败理由。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-001 sha256=fbe1ea5c5eeefb9d5da222748d61c4215befd9aaf419dd80a1d5a663517ba58a -->
## Microi吾码工作进度播报规范（强制）

AI 在任何新建或已有对话中处理 Microi吾码任务并向用户输出工作过程记录时，必须默认执行本规范，无需用户再次提醒：

- 每累计输出 3-5 次面向用户的工作过程记录，根据任务复杂度和实际阶段选择合适时机，追加一次进度播报；首次播报不得晚于第 5 次工作过程记录。工具调用结果、系统消息和最终答复不计入次数。
- 播报必须以“Microi吾码本次工作进度”开头，让用户明确知道这是【Microi吾码】规范；不得改成含义模糊的“当前进度”，也不得描述为 AI 自带功能。
- 每次播报必须同时包含四项快速估算：已完成进度百分比、预计还需要多长时间结束、目前大概已消耗多少 token、预计总共需要消耗多少 token。
- 预计剩余时间不足 60 分钟时使用分钟；达到 60 分钟后换算为“X小时Y分钟”；达到 24 小时后换算为“X天Y小时Z分钟”。为 0 的低位单位可以省略，禁止继续只显示累计分钟数。
- 进度、时间和 token 只需快速估算，不得为了提高估算精度中断主要工作，也不得声称这些数据来自平台精确计量。token 较多时可用 `k` 简写。
- 推荐使用紧凑格式：`Microi吾码本次工作进度：约 55%；预计还需 12 分钟；目前已消耗约 8k tokens；预计总计约 15k tokens。以上为快速估算。`
- 短任务若在不足 3 次工作过程记录时已经完成，不得为了凑次数拆分无意义消息；可直接在最终交付中简要汇总。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-002 sha256=3512f626491064504d48119f11cd9f4dde9534b7cb4a88d8bc940892ac99bd9c -->
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
<!-- microi-progressive:chunk id=workspace-conventions-003 sha256=f11353ab84b85f319d592dac979e9a44fac3bc5aa50f827ad5aaa728f83fa18d -->
## 本地资源与 OOM 保护规范（强制）

AI 在用户本机启动 Node.js、Vite、Webpack、dotnet build、Java、Docker build、浏览器自动化、压力测试或其他可能长时间占用 CPU/内存的进程前，必须先评估资源，不得为了“让构建跑过”无限抬高堆内存或 Worker 数。

- 启动前检查物理内存总量、当前占用率、可用内存，并检查是否已有同类 dev server/构建进程。已有可复用服务时禁止重复启动。
- 默认只允许一个高资源任务运行；显式限制 Worker/并发数，优先按项目、包、模块、测试分组或文件分片执行，不得并行启动多个全量构建。
- 启动重任务前按“当前阶段进程树预算 + 系统安全余量”判断：阶段预算优先采用实测峰值；尚无实测时，用已限制的堆/容器上限加明确的原生进程、Worker 与缓冲开销。系统安全余量取 `max(1.5 GB, 物理内存的 5%)`，不得再按固定 20% 将大内存机器的启动门槛线性放大。顺序执行的阶段分别计算，禁止把不会并发的阶段峰值相加。机器总内存占用达到 95% 时，立即暂停或终止 AI 启动的重任务及其子进程，不得等待 OOM。
- 禁止将 `--max-old-space-size`、JVM heap、Docker memory 或类似上限设为接近物理内存总量。除非用户明确授权独占构建窗口，单个 AI 启动的进程树不得持续占用超过物理内存的 25%。
- 后台/长任务必须记录根 PID、子进程、启动时间和独立日志，每 15-30 秒监测一次进程树内存与全机可用内存。任务失败、中断或达阈值时必须停止整个子进程树，不得遗留孤儿 Node/dotnet/Java 进程。
- 全量构建无法在上述阈值内完成时，先停止并改用定向 lint、类型检查、按模块构建或按测试文件验证。如仍必须进行全量验收，应明确报告资源瓶颈，交由 CI/专用构建机或经用户明确同意的独占时段执行，禁止在用户正在使用的 VS Code 会话里硬跑。

### `Microi.Client` 框架前端构建频率（强制）

- 修改吾码低代码平台框架前端 `Microi.Client/` 时，开发阶段必须优先复用已运行的 Vite 开发服务，通过热模块更新（HMR）、定向静态测试和浏览器回归验证改动。禁止把 `npm run build` 当作每轮修改后的常规检查，禁止因切换需求、修改单个组件或上下文压缩而重复执行全量构建。
- 只有全部框架前端源码修改、定向测试和浏览器验收均已完成后，才允许在最终收尾阶段执行一次 `npm run build`，用于确认正式产物能否生成。执行前仍须按本节检查内存、同类进程和构建预算；已经成功且之后没有再修改框架前端源码时不得重复构建。
- Vite 热更新未生效时，先检查页面、控制台、文件监听和当前 61500 开发服务归属；确需重启时按共享进程与发布锁规范精确停止本工作区原有 `npm run dev`，再重新执行 `npm run dev`。不得用 `npm run build` 代替开发服务重启，也不得结束所有 `node`、浏览器或其它对话的进程。
- 本规则只约束 `Microi.Client/` 吾码框架前端源码。独立 MicroService、Web、UniApp 等应用源码仍按其交付 Skill 在发布前执行自身必要的构建；不得因为本规则跳过微服务正式产物生成。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-004 sha256=5cd341a0dd0a827f16129a8587422b53c186d104a562ecb6640e6167567f9c0f -->
## 临时文件与 AI 产物放置规则（强制）

AI 在工作区任意任务中生成的**一次性临时脚本、诊断文件、测试截图、临时报告**，**严禁放在工作区根目录（`<workspace-root>/`）**，必须放在指定位置：

| 类型 | 指定位置 |
|------|---------|
| 一次性脚本（.py / .mjs / .ps1 / .sh） | `.tmp/` |
| 诊断截图、调试图片 | `.tmp/screenshots/` |
| E2E 测试产物（Microi.VSCode 插件生成） | `.microi-e2e/` |
| AI 一次性 E2E 脚本、截图、日志、报告 | `.tmp/`、`.tmp/screenshots/`、`.tmp/reports/` |
| 性能测试 HTML 报告 | `.microi-performance/` |
| 项目专属临时文件 | `<对应子项目目录>/` 内，不要写到根目录 |

**严禁在根目录创建**：
- 任何 `*.mjs`、`*.py`、`*.ps1`、`*.sh` 一次性临时脚本
- 任何 `.tmp-*.js`、`.tmp-*.json`、`.tmp-*.txt`、`.tmp-*/` 这类伪临时文件或目录
- 任何 `screenshots/`、`dark-mode-*/`、`test-*/`、`debug-*/` 临时目录
- 孤立的 `node_modules/`（根目录没有 `package.json`，不应安装 npm 包）
- 孤立的 `obj/`、`dist/`、`build/`（非对应项目文件）

`.tmp/` 已在 `.gitignore` 中排除，可以随意创建临时文件。任务完成后如无保留价值可以不清理。

**2026-06 强制补充**：AI 不得在任何子项目目录下放置一次性日志、自动化截图、接口回收文件或调试脚本。像 `Microi.Server/Microi.net.Api/.tmp-*.log`、`Microi.Client/*.png` 这类文件一律视为规范失败，必须移到 `<workspace-root>/.tmp/` 或 `<workspace-root>/.tmp/screenshots/`。正式 Playwright 工程由 Microi.VSCode 插件生成时可以继续使用 `.microi-e2e/`，但 AI 为某个任务手写的一次性 Playwright 脚本、报告和截图仍然必须放在 `.tmp/`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-005 sha256=a5df177a3a8dbdaee503667e45497378cbd3f04820090c3d69cc2b90b3456894 -->
## Microi 源码路径速查（工作区根相对路径）

当用户提到“吾码后端源码”“吾码前端源码”“表单引擎源码”“官网源码”等简称时，默认按下列路径定位；如果当前工作区缺少对应目录，再用 `rg --files` 或目录搜索确认实际位置。

| 用户常用说法 | 默认路径 |
|--------------|----------|
| 吾码 MCP 前端源码 | `microi.mcp/` |
| 吾码 MCP 后端源码 | `Microi.Server/Microi.net.Api/Controllers/V8EngineController.cs` |
| 吾码 skills / 知识库 | `microi.skills/` |
| 吾码 VS Code 插件项目 | `Microi.VSCode/` |
| 吾码低代码平台后台系统前端源码 | `Microi.Client/` |
| 吾码后台系统前端移动端自适应源码 | `Microi.Client/src/views/mobile/` |
| 吾码低代码后端源码 | `Microi.Server/` |
| 吾码表单引擎源码 | `Microi.Client/src/views/form-engine/` |
| 吾码界面引擎源码 | `Microi.Client/src/views/page-engine/` |
| 吾码打印引擎源码 | `Microi.Client/src/views/print-engine/` |
| 吾码 App 源码 | `microi.app/` |
| 吾码 UniApp 源码 | `microi.uniapp/` |
| 吾码官方网站 / 文档源码 | `microi.doc/` |
| 吾码 AI 应用及应用商城发行源码 | `Microi-V8-Engine/{系统名称} ({ApiBase域名})/{OsClient}.{OsClientType}.{OsClientNetwork}/AI应用/{appKey}/` |

以上路径只作为通用工作区相对路径规范，不写入具体本机盘符。跨仓库、空工作区或普通用户项目中，如果路径不存在，以插件生成的 `AGENTS.md`、MCP 配置和实际文件树为准。

每个 `AI应用/{appKey}` 必须是界面、微服务、Manifest、接口引擎、资源策略、测试、构建脚本与商城上传素材的唯一事实源。纯平台应用没有前端时仍使用该目录；禁止另建 `microi.apps/` 平行发行根。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-006 sha256=2e2b93098fa72390e148e305ed6cc8cfb154d9a64028cdecb10b39a016e41f41 -->
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
<!-- microi-progressive:chunk id=workspace-conventions-009 sha256=dc7dbe2d2f60466a7170fff65a5df8769bc795b4ab23151a24b665380d7c6e37 -->
## 多对话共享工作区变更归属保护（强制）

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
## 详细参考路由（渐进披露）

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-版本更新日志保护规则-强制.md](references/progressive-01-版本更新日志保护规则-强制.md)：版本更新日志保护规则（强制）；配置文件说明中文优先规则；后端 API 配置白名单与 SaaS 单一事实源（强制）；身份、可逆业务秘密与敏感操作统一规范（强制）；多语言优先约定；后台菜单层级默认规则；后台任务与安全防护约定；业务逻辑优先接口引擎约定；应用商城优先于 Microi.Upgrade（强制）；在线 AI 应用上下文默认发现规则（强制）；VS Code 插件空目录生成规则；Microi 版本号规则；C# dynamic 强类型落地规则；根目录保留文件说明
- [references/progressive-02-microi-net-api-本地启动约定.md](references/progressive-02-microi-net-api-本地启动约定.md)：Microi.net.Api 本地启动约定；多 AI 对话共享本地服务与发布互斥（强制）；本地租户与测试凭据读取约定；自动化登录约定；V8 远端/本地同步收尾约定；V8 缓存刷新约定；MCP 元数据更新验收约定；MCP 可用性排查约定；MCP 写入超时与降级约定；Codex MCP 单入口约定；.venv Python 环境说明；后端代码改动后的重启验收；MCP 可调用性诊断补充；Windows MCP 控制台闪窗复盘
- [references/progressive-03-cli-与-ide-插件错版共存约定.md](references/progressive-03-cli-与-ide-插件错版共存约定.md)：CLI 与 IDE 插件错版共存约定
<!-- microi-progressive:end -->
