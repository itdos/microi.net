---
name: workspace-conventions
description: Microi 工作区全局约定。用于在本工作区工作时，确保临时文件、生成产物和项目专属内容放在正确位置，不污染仓库根目录。
---

# Microi 工作区全局约定

## 任务启动前 Skill 读取规则（强制）

AI 处理任何 Microi 低代码、V8、MCP、OpenClaw、采集引擎、前端、后端、UniApp、文档、测试或交付任务前，必须先按任务类型读取相关 `microi.skills/**/SKILL.md`。不能等到写代码或出问题后才补读。

- 通用任务至少读取本文件；涉及完整交付、MCP 建模、远端 V8、菜单、字段或生产数据时，同时读取 `microi-system-delivery`。
- 涉及采集引擎、浏览器 Worker、验证码、站点规则、导出产物时，同时读取 `spider-engine`。
- 涉及 V8 CRUD、SQL、上传下载、导入导出、菜单按钮、表单事件、前端页面或自动化测试时，继续读取对应专项 Skill。
- 最终交付说明必须能逐条对应用户编号需求；不得遗漏、合并或把仍可执行的需求写成“下一步继续”。

## Microi吾码工作进度播报规范（强制）

AI 在任何新建或已有对话中处理 Microi吾码任务并向用户输出工作过程记录时，必须默认执行本规范，无需用户再次提醒：

- 每累计输出 3-5 次面向用户的工作过程记录，根据任务复杂度和实际阶段选择合适时机，追加一次进度播报；首次播报不得晚于第 5 次工作过程记录。工具调用结果、系统消息和最终答复不计入次数。
- 播报必须以“Microi吾码本次工作进度”开头，让用户明确知道这是【Microi吾码】规范；不得改成含义模糊的“当前进度”，也不得描述为 AI 自带功能。
- 每次播报必须同时包含四项快速估算：已完成进度百分比、预计还需要多长时间结束、目前大概已消耗多少 token、预计总共需要消耗多少 token。
- 预计剩余时间不足 60 分钟时使用分钟；达到 60 分钟后换算为“X小时Y分钟”；达到 24 小时后换算为“X天Y小时Z分钟”。为 0 的低位单位可以省略，禁止继续只显示累计分钟数。
- 进度、时间和 token 只需快速估算，不得为了提高估算精度中断主要工作，也不得声称这些数据来自平台精确计量。token 较多时可用 `k` 简写。
- 推荐使用紧凑格式：`Microi吾码本次工作进度：约 55%；预计还需 12 分钟；目前已消耗约 8k tokens；预计总计约 15k tokens。以上为快速估算。`
- 短任务若在不足 3 次工作过程记录时已经完成，不得为了凑次数拆分无意义消息；可直接在最终交付中简要汇总。

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


## 本地资源与 OOM 保护规范（强制）

AI 在用户本机启动 Node.js、Vite、Webpack、dotnet build、Java、Docker build、浏览器自动化、压力测试或其他可能长时间占用 CPU/内存的进程前，必须先评估资源，不得为了“让构建跑过”无限抬高堆内存或 Worker 数。

- 启动前检查物理内存总量、当前占用率、可用内存，并检查是否已有同类 dev server/构建进程。已有可复用服务时禁止重复启动。
- 默认只允许一个高资源任务运行；显式限制 Worker/并发数，优先按项目、包、模块、测试分组或文件分片执行，不得并行启动多个全量构建。
- 启动重任务前按“当前阶段进程树预算 + 系统安全余量”判断：阶段预算优先采用实测峰值；尚无实测时，用已限制的堆/容器上限加明确的原生进程、Worker 与缓冲开销。系统安全余量取 `max(1.5 GB, 物理内存的 5%)`，不得再按固定 20% 将大内存机器的启动门槛线性放大。顺序执行的阶段分别计算，禁止把不会并发的阶段峰值相加。机器总内存占用达到 95% 时，立即暂停或终止 AI 启动的重任务及其子进程，不得等待 OOM。
- 禁止将 `--max-old-space-size`、JVM heap、Docker memory 或类似上限设为接近物理内存总量。除非用户明确授权独占构建窗口，单个 AI 启动的进程树不得持续占用超过物理内存的 25%。
- 后台/长任务必须记录根 PID、子进程、启动时间和独立日志，每 15-30 秒监测一次进程树内存与全机可用内存。任务失败、中断或达阈值时必须停止整个子进程树，不得遗留孤儿 Node/dotnet/Java 进程。
- 全量构建无法在上述阈值内完成时，先停止并改用定向 lint、类型检查、按模块构建或按测试文件验证。如仍必须进行全量验收，应明确报告资源瓶颈，交由 CI/专用构建机或经用户明确同意的独占时段执行，禁止在用户正在使用的 VS Code 会话里硬跑。

## 临时文件与 AI 产物放置规则（强制）

AI 在工作区任意任务中生成的**一次性临时脚本、诊断文件、测试截图、临时报告**，**严禁放在工作区根目录（`d:\Work\microi.net.all\`）**，必须放在指定位置：

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

以上路径只作为通用工作区相对路径规范，不写入具体本机盘符。跨仓库、空工作区或普通用户项目中，如果路径不存在，以插件生成的 `AGENTS.md`、MCP 配置和实际文件树为准。

## Skills 通用化原则

编写或更新 `microi.skills/` 下的技能文档时，**不能加入特定项目名称、特定本地路径或特定业务规则**，必须保持通用性：

- ❌ 不允许：`d:\Work\microi.net.all\AI-Project\客户项目\mci.demo.uniapp`
- ❌ 不允许：任何客户、租户或交付项目名称
- ❌ 不允许：某项目特定的费率、字段名、接口 Key 作为"规范"
- ✅ 允许：使用 `<项目路径>`、`<OsClient>` 等占位符
- ✅ 允许：通用的最佳实践、模式和约定
- ✅ 项目特定规则应维护在各项目自己的目录内（如 `AI-Project/<项目>/` 或项目根的 `tests/`）

## Skills 中文优先规则

编写、补充或重构 Microi 吾码相关技能文档和 AI 指令文件时，**能用中文就必须用中文**。适用范围包括 `microi.skills/**/SKILL.md`、`microi.skills/README.md`、`AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md`、`.cursorrules`、`.cursor/rules/*.mdc` 以及 VS Code 插件生成这些文件的模板源码。

- 标题、段落、清单说明、验收标准、注意事项、示例代码注释、提交说明和生成文案默认使用中文。
- 只有代码/API 标识符、文件名、命令、环境变量、协议名、请求头、JSON/YAML 字段名、CSS 类名、路由、包名、框架/产品专有名词、必须原样返回的错误文本等确实不能翻译的内容才保留英文。
- 如果为了搜索、触发或兼容必须保留英文术语，采用“中文说明 + 英文标识”的写法，例如 `技能文件（Skill）`，不要整段英文说明。
- 更新 VS Code 插件生成模板时，要同步检查当前已生成的 `AGENTS.md`、`CLAUDE.md`、`.github/copilot-instructions.md`、`.cursorrules` 和 Cursor rules，避免模板下一次刷新又把英文写回来。
- 收尾时用 `rg` 扫描明显英文规范短语（如 `Use when`、`Required:`、`Forbidden:`、`Acceptance:`、`Quick Workflow`、`MCP default visibility`）。剩余英文必须属于必要标识符或专有名词。

## 官方文档原位增补与中文单源规则（强制）

修改 Microi 官方文档前，必须先用 `rg` 查找已有页面、标题和示例，并在最匹配的现有页面原位补充。不得因为方便就新建相近主题的 Markdown 页面、导航项或页面路由，避免同一 API 的说明散落多处。只有现有目录确实没有承载该独立主题的页面，而且新页面具有长期独立维护价值时，才允许新增页面，并需同时说明新建原因和导航归属。

- 前端 V8 API 的主文档固定维护在 `microi.doc/docs/doc/v8-engine/v8-client.md`。
- 后端 V8 / 接口引擎 API 的主文档固定维护在 `microi.doc/docs/doc/v8-engine/v8-server.md`。
- 导入导出等专题页可以保留深度案例，但新增或修改 `V8.Office`、`V8.Http` 等公共 API 时，必须先补齐上述前端/后端 V8 主文档，再按需同步专题页，不能另建重复 API 页面。
- `microi.doc/docs/doc/` 是人工维护的中文文档单源；`microi.doc/docs/en/` 由官网统一翻译生成。日常功能开发只修改中文文档，不手工修改英文版，不为“中英文同步”重复写一遍。
- 文档改动后执行 `npm run docs:build`；验收时检查本次没有无理由新增 `.md` 页面或导航路由。

## 多对话共享工作区变更归属保护（强制）

同一工作区可能同时被用户、其它 Codex 对话、IDE、自动化任务或外部 Git 操作修改。任务启动前已经存在、或无法用本对话证据严格证明归属的差异，一律视为他人资产并保留；“工作区是脏的”不是清理授权。

- 开始修改前先保存只读基线，至少包括 `git status --short`、目标文件的 `git diff -- <file>`，必要时记录文件 SHA-256。VS Code 重启、上下文压缩或接续中断任务后，必须重新建立基线，不能沿用对差异归属的猜测。
- 修改时间接近当前时间、提交位于最新 `HEAD`、提交作者与当前用户相同、提交信息与当前任务相关、分支已经同步到 `origin`，都不能证明改动来自本对话；其它对话可能在同一时间和身份下提交或推送。
- 可撤回的范围只能来自本对话可核验的写入证据，例如已记录的精确 `apply_patch`、写入前后内容或明确由本对话创建且逐项可对应的 hunk。即使能证明归属，也只能反向修改这些精确 hunk，不能扩大到整文件、整提交或相邻改动。
- 执行撤回、覆盖、删除、格式化、生成器重写或 `git revert` 前，必须按 hunk 核对 `git diff` 与相关 `git show`；`git blame`、`reflog` 和提交时间只能辅助调查，不能单独作为归属证明。证据不足时停止修改并询问用户。
- 禁止为了获得干净工作区而使用整文件覆盖、`git checkout -- <file>`、`git restore <file>`、`git reset --hard` 或删除未跟踪文件；这些操作可能抹掉其它对话尚未提交的成果。
- 修复误撤回时，只恢复被本对话删除的原始字节/行，随后断言目标 hunk 已恢复、其它既有差异保持不变，并在最终说明中明确列出仍存在但未触碰的并行改动。
- 对 `microi.doc/docs/doc/about/update-log.md` 尤其严格：已经发布的条目即使日期是当天、位于最新提交或内容覆盖当前任务，也必须默认属于既有发布成果。除非用户明确要求修改，或本对话持有精确新增证据，否则不得删除、重写或降级该条目。

## 版本更新日志保护规则（强制）

- 日常功能开发、缺陷修复、测试、普通文档补充、Skill 完善和代码重构期间，不得修改 `microi.doc/docs/doc/about/update-log.md`。
- 只有用户明确提出“发布版本”“准备发版”“更新版本日志”或直接点名要求修改该文件时，才允许编辑更新日志；“完善文档”或“补充官网说明”不等于授权修改版本日志。
- 如果本轮误改了更新日志，必须先按上节完成多对话归属核验；只撤回有本对话精确写入证据的 hunk。必须保留用户、其它对话或其它任务的已提交和未提交内容，归属不明时不得修改并应询问用户。

## 配置文件说明中文优先规则

AI 新增或修改 Microi 配置文件时，凡是面向开发者、部署人员或用户阅读的自然语言描述，默认必须写中文。适用范围包括 `appsettings*.json`、`docker-compose*.yml`、`launchSettings.json`、`*.example`、安装脚本注释、部署说明和示例配置。

- `Description`、`Important`、`EnvironmentVariables` 的说明文字、JSON/YAML 注释、示例说明、字段说明默认使用中文。
- 字段名、环境变量名、枚举值、路由、类名、方法名、包名、协议名等标识符保持原始英文，不要为了中文化而破坏程序读取。
- 如果配置面向海外交付，才可以在中文说明后补充英文括注；不要整段只写英文。
- 修改配置说明后，必须确认 JSON/YAML 仍可解析，不能因为中文标点或注释方式导致配置文件失效。

## 后端 API 配置白名单与 SaaS 单一事实源（强制）

- `Microi.net.Api` 的 `AppSettings` 与同名容器环境变量只允许：`OsClient`、`OsClientType`、`OsClientNetwork`、`OsClientDbType`、`OsClientDbConn`、`OsClientRedisHost`、`OsClientRedisPort`、`OsClientRedisPwd`、`OsClientRedisDataBase`、`OsClientDbMongoConn`。
- 除上述十项外，任何业务开关、重试、超时、限额、安全策略、密钥或可执行文件路径通常都必须进入 SaaS 引擎 `sys_osclients` 的合适 Tab，并提供幂等升级、默认值、缓存刷新、敏感字段脱敏和子租户隔离。官方 License 信任链是固定例外：恢复重试次数/间隔使用代码常量，签发私钥固定只读挂载 `/app/microi_private.pem`，不得建立对应 SaaS 字段。禁止新增 `MICROI_*`、`DOS_ORM_*`、额外 `AppSettings` 节点或通用动态环境变量读取。
- `ASPNETCORE_*`、`DOTNET_*` 是框架宿主配置；`PW_*`、MCP、构建、安装器和发布脚本变量只服务各自工具进程。它们不能成为生产 API 的业务配置入口。
- 修改后必须用源码测试扫描生产 `.cs`、API `appsettings.json` 及在线/离线 Compose，精确断言十项白名单。不能用注释约定代替自动化守卫。
- 一键安装恢复客户旧库时只允许定位精确主租户三元组；缺失则幂等创建，重复则停止，不能批量重写其它子租户。新主租户行不得持久化数据库、MongoDB 或 Redis 连接，安装器对 MinIO/OCR 等业务配置的后续更新也必须带同一三元组、活动状态条件并做唯一回读。

## 多语言优先约定

Microi 平台默认支持多语言。AI 修改 `Microi.Client`、`Microi.Server`、`Microi-V8-Engine`、MCP 建模数据、菜单按钮、接口引擎或表单 V8 事件时，凡是用户可见文字都必须先考虑多语言，不要把中文提示、按钮名、Tab 名、菜单名、字段名、Toast/Msg 等硬写死后结束任务。
- 前端框架固定文案优先使用 `$t('Msg.xxx')` 或项目现有 i18n 工具；中文简体、中文繁体、英语作为前端兜底包，其它语言应来自后端 `diy_lang` 缓存/接口返回，不要随意把十几种语言全写死到前端源码。
- 后端返回给前端的表名、字段名、菜单名、按钮名、Tab 名、错误提示等，优先从 `diy_lang` 缓存取值；没有词条时再返回原文，并异步补齐词条。
- V8 接口引擎、表单 V8 事件、菜单按钮 V8 若需要返回中文 `Msg`、通知、按钮提示或日志标题，应优先使用 `V8.TranslateEngine.GetLang(key)` / 约定多语言 Key，或至少为后端自动同步留下稳定 Key，不要只写一次性中文字符串。
- 通过 MCP 创建或维护 `diy_lang` 数据时必须保持树形结构：`系统`、`模块引擎`、`表单引擎`、`业务数据` 等分类。菜单名称归 `模块引擎`；表名、字段名、V8 按钮名、Tab 名归 `表单引擎`；固定框架文案归 `系统`；业务数据默认不写入 `diy_lang`，除非用户明确要求某类业务表进入词库。
- 不允许把所有多语言映射都创建到 `diy_lang` 根目录。新增词条前先查询是否已有同 Key/同分类数据；写入后需要刷新/回读多语言缓存。
- 完成多语言相关改动后，至少切换一次目标语言或调用对应接口验证；涉及页面的任务优先用 Playwright 截图确认关键区域没有残留明显中文。

## 后台菜单层级默认规则

AI 通过 MCP、Manifest、V8 或平台 API 创建/修复 Microi 后台菜单时，默认必须规划为至少两级菜单树。真实系统不能把一批 CRUD、报表、日志、设置页直接平铺到根级菜单。

- 顶级菜单只放业务域、系统域或产品域父菜单，例如系统引擎、业务中心、运营管理、基础资料等。
- 具体表单 CRUD、报表、导出、日志、规则、配置、任务页必须挂在对应父级或二级分类下。
- 同一业务域下超过 3 个叶子模块时，优先再按基础资料、业务执行、配置中心、日志记录、数据产物等通用类别分组。
- 通过 MCP/Manifest 创建菜单时，必须显式包含父菜单和子菜单关系；叶子菜单必须写入正确 `ParentId`，并在交付说明中列出最终菜单树。
- 改造已生成菜单时，不能只停留在文档建议。必须回读 `sys_menu`，列出现有菜单、目标父级、`ParentId`/`Sort` 迁移关系，更新管理员角色权限，再次回读验证菜单树深度。
- 只有表单内嵌子表、隐藏路由、系统内部入口等不应出现在导航中的菜单可以例外隐藏；隐藏菜单必须明确设置 `Display=0`、`AppDisplay=0`，并避免误标为有子级的空父菜单。

## 后台任务与安全防护约定

Microi 平台级长任务和安全防护属于系统能力，AI 修改框架、MCP 或 V8 示例时必须同步考虑：

- 应用安装、初始化多语言、批量导入、批量修复、跨系统同步等长任务优先接入后台任务中心，进度通过吾码标准 WebSocket/SignalR 推送，不要默认用前端轮询接口。
- 菜单按钮可使用 `RunBackground` / `BackgroundTask` / `IsBackgroundTask` 配合 `ApiEngineKey` 启动后台任务；接口引擎内必须用 `V8.Method.UpdateBackgroundTask` 上报进度。
- 后台任务按钮创建后，平台会向接口引擎参数注入 `_BackgroundTaskId`。V8 代码应读取 `_BackgroundTaskId` / `BackgroundTaskId` / `TaskId`，按真实阶段或处理条数上报 `Current`、`Total`、`Progress`、`Msg` / `Message`。不要写假进度、不要只在结束时写 100%，成功返回 `Code:1` 后由平台统一置为 100%。
- 后台任务运行态会写入 Redis 并推送通知中心；清除已完成应同时清理内存态和 Redis 态。新增类似能力时要验证刷新页面后任务仍可见、进度百分比正确、完成后可清除。
- 平台级安全、访问审计、后台任务、运行态监控等系统表统一使用 `mci_` 前缀；普通业务系统表不要使用 `mci_` 前缀，避免与平台能力混淆。
- 恶意攻击防护只能根据短时间高频、异常状态码爆发、扫描不存在路径、封禁后继续访问等行为判断，不能因为接口执行时间长或排队时间长就封禁用户。
- 攻击事件、IP 封禁/解封记录应异步写入 MySQL `mci_` 表并写系统日志；同一 IP、同一原因、同一时间窗必须去重合并，不要重复写大量相同失败原因。
- 手动封禁、手动解封、自动解封都要有审计记录。封禁响应要返回 DosResult 风格 JSON，便于前端明确提示。

## 业务逻辑优先接口引擎约定

AI 为 Microi 平台新增或修改任何业务逻辑、后台工具、数据维护能力、官网流程、在线 AI 能力、导入导出、初始化、修复任务、页面配套接口或租户 SaaS 流程时，默认优先使用接口引擎实现，不要直接新增 `Microi.net.Api` Controller 或把业务分支写死到 C# 后端。

- 能用 `V8.FormEngine`、`V8.Db`、`V8.Method`、`V8.Http`、`V8.Office`、`V8.ApiEngine` 完成的功能，必须优先建 `sys_apiengine` 接口引擎，并通过前端 `DiyCommon.ApiEngine.Run` 或菜单按钮调用。
- 需要持久化的数据结构必须优先通过 MCP / Manifest 创建标准低代码表、字段和菜单，让表能在表单引擎中可见、可维护、可授权；不要只在 C# 中 `CREATE TABLE` 物理表。
- 如果接口引擎缺少底层能力，优先扩展 V8 能力（例如 `V8.Method`、`V8.FormEngine`、HDFS 辅助方法），再让接口引擎调用新增能力；只有跨平台核心框架、协议层、鉴权管线、SignalR/WebSocket、ORM、任务调度内核等接口引擎无法表达的能力，才新增或修改 C# Controller/Service。
- 新增 C# Controller 前必须能说明为什么不能用接口引擎实现，并在交付说明中列出原因、影响范围和版本升级要求。
- 从 C# Controller 迁移到接口引擎时，前端不得继续调用旧 `/api/<Controller>/<Action>`；应统一改为 `DiyCommon.ApiEngine.Run('<ApiEngineKey>', params)`，并保留 DosResult 返回格式。

## 在线 AI 应用上下文默认发现规则（强制）

AI 开始处理定制页面、弹窗、Web、UniApp、微服务或应用商城任务时，不能只搜索本地目录。只要当前 MCP 已连接到目标 `OsClient`，必须先读取在线 AI 应用上下文：

1. 调用 `microi_list_applications` 获取当前租户全部 `Web / UniApp / MicroService` 应用和完整文件清单。
2. 找到候选应用后调用 `microi_get_application_context`，默认 `includeContents=true`，读取所有可读源码内容以及微服务运行页面。
3. 只需核对单个大文件或二进制文件时，再调用 `microi_get_application_file` 精确读取。
4. 已存在合适微服务时优先在原应用内新增页面/路由；不存在时才调用 `microi_create_microservice`、`microi_sync_microservice_source`、`microi_publish_microservice` 创建并发布。

三个读取工具的关键参数：

| 工具 | 参数 | 说明 |
|---|---|---|
| `microi_list_applications` | `appType` | 可选：`Web`、`UniApp`、`MicroService`；省略表示全部类型 |
|  | `keyword` | 可选：按名称、`AppKey`、类型、描述筛选 |
|  | `includeFiles` | 默认 `true`，返回每个应用完整文件清单 |
| `microi_get_application_context` | `appIdOrKey` | 必填，支持统一应用商城 `sys_microistore.Id` 或 `AppKey` |
|  | `includeContents` | 默认 `true`；读取私有 HDFS 源码内容 |
|  | `maxFileBytes` | 可选，默认单文件 2MB |
|  | `maxTotalBytes` | 可选，默认单应用 50MB |
| `microi_get_application_file` | `appIdOrKey`、`filePath` | 必填；`filePath` 必须来自文件清单 |

如果 MCP 返回登录过期，必须先修复或刷新目标 MCP 身份，再继续把 MCP 读取结果当作当前事实；不能因为读取失败就假设在线应用不存在并重复创建。

## VS Code 插件空目录生成规则

Microi.VSCode 面向普通用户时，用户本地可能只是一个空工作区。插件生成 AI 指令文件时不能假设用户已经有 `microi.skills/`、`Microi-V8-Engine/`、`AI-Project/` 或某个固定前端项目目录。

强制要求：
- 插件的“初始化AI配置”必须能在空目录生成 `microi.skills/`、`.github/copilot-instructions.md`、`AGENTS.md`、`CLAUDE.md`、`.cursorrules`、`.cursor/rules/microi-skills.mdc`、类型提示、`jsconfig.json` 和 MCP 配置。
- Cursor rule 的 `globs` 必须覆盖任意新建项目目录下的常见源码、配置和文档文件，例如 `**/*.{vue,js,ts,jsx,tsx,css,scss,json,md,mdc,cs,csproj,xml,yml,yaml}`，不能只覆盖 `Microi-V8-Engine/**/*.js`。
- 生成文案必须明确：普通用户不需要手动克隆 skills，也不需要每次对 AI 说“严格遵循 microi.skills”；只要插件初始化成功，AI 就应默认按 skills 工作。
- 插件升级时应继续保护用户本地修改过的 skill 文件，只覆盖插件曾生成且用户未改过的文件。

## Microi 版本号规则

Microi 通用版本号采用 `主版本.次版本.修订版本` 三段数字格式，从 `1.0.0` 开始。每次发布时最后一位加 1；当某一位超过 `9` 时向前一位进位并将当前位归 `0`，例如 `1.0.9 -> 1.1.0`、`1.9.9 -> 2.0.0`、`9.9.9 -> 10.0.0`。

接口引擎代码头、表单/工作流 V8 事件代码头、前端微服务 `sys_microiservice.BuildVersion` 与 `sys_microiservice_page.BuildVersion` 这类业务发布版本统一使用带 `v` 前缀的格式：`v1.0.0 -> v1.0.1 -> v1.0.9 -> v1.1.0 -> v1.9.9 -> v2.0.0 -> v9.9.9 -> v10.0.0`。禁止使用时间戳、随机串或日期作为 BuildVersion；前端微服务上传到分布式存储的目录也必须使用同一个 BuildVersion 分段，便于回溯与 CDN 缓存隔离。

`Microi.VSCode` 发布时会通过 `bump-version.js` 自动自增插件版本，并把 `microi.skills/.microi-skills-version.json` 中的 skills 发布版本写成同一个插件版本号；skills 不再独立自增。`.microi-skills-version.json` 只用于记录 skills 包版本和提示用户当前来源，不能单独作为覆盖依据。

插件初始化或升级同步 `microi.skills/` 时，必须以 `.microi-skills-manifest.json` 的逐文件 hash 判断是否可覆盖：本地文件不存在则写入；本地文件与旧 manifest hash 一致说明用户未改，可自动升级；本地文件已被用户修改、或本地版本比插件捆绑版本更新时，必须保留用户版本并提示差异。不能因为插件版本号更高或更低，就粗暴覆盖本地 skills。创始人本地随时修改 skills 的工作区尤其要保护；普通用户未修改过的旧 skills 才应该被最新插件覆盖升级。

## C# dynamic 强类型落地规则

后端源码中从 `dynamic`、`JObject`、`ExpandoObject`、表单参数或 `DynamicHelper` 读取出来的值，如果后续要调用字符串方法、扩展方法或参与强类型判断，必须先显式落到强类型变量。不要用 `var` 承接 `DynamicHelper.GetDynamicStringValue(...)` 后再调用 `DosIsNullOrWhiteSpace()` 这类扩展方法，因为调用点可能仍按 dynamic 绑定，运行时会出现 `'string' does not contain a definition for ...`。

错误写法：

```csharp
var tableName = DynamicHelper.GetDynamicStringValue(diyTableModel, "Name", "");
if (tableName.DosIsNullOrWhiteSpace()) { return; }
```

推荐写法：

```csharp
string tableName = DynamicHelper.GetDynamicStringValue(diyTableModel, "Name", "");
if (string.IsNullOrWhiteSpace(tableName)) { return; }
```

如果方法内部只通过 `DynamicHelper` 读取对象字段，方法参数优先声明为 `object`，不要声明为 `dynamic`。这样可以减少 C# 运行时动态绑定进入普通字符串工具链的机会。

## 根目录保留文件说明

根目录只允许存在以下类型的文件和目录：

| 路径 | 说明 | 是否可删除 |
|------|------|-----------|
| `.github/` | GitHub Actions、Copilot 配置 | 否 |
| `.venv/` | Python 虚拟环境，AI 代理使用 | 否（必要） |
| `.vscode/` | VS Code 工作区配置 | 否 |
| `microi.skills/` | 通用技能文档库 | 否 |
| `Microi.Server/` | .NET 后端 | 否 |
| `Microi.Client/` | PC 前端 Vue3 | 否 |
| `microi-v8-engine/` | V8 接口引擎代码 | 否 |
| `AI-Project/` | 各租户/项目 | 否 |
| `switch-env.ps1` | 本地环境切换工具 | 否（有用） |
| `.tmp/` | AI 临时文件（gitignored） | 可删整个目录 |
| `.microi-e2e/` | Microi.VSCode 插件 E2E 产物 | 可定期清理 |
| `.microi-performance/` | 性能测试报告 | 可定期清理 |

## Microi.net.Api 本地启动约定

默认本地后端项目是 `Microi.Server/Microi.net.Api/Microi.net.Api.csproj`。AI 需要启动后端、验证接口、跑 Playwright、回读接口引擎或排查前后端联调问题时，优先使用下面的 PowerShell 命令：

```powershell
Push-Location Microi.Server/Microi.net.Api
dotnet run --launch-profile Microi.net.Api
Pop-Location
```

必须先进入 `Microi.Server/Microi.net.Api` 再启动。`Program.cs` 会在 `WebApplication.CreateBuilder(args)` 之前读取当前目录下的 `.microi-local`，将其中的环境名写入 `ASPNETCORE_ENVIRONMENT` / `DOTNET_ENVIRONMENT`，随后加载 `appsettings.{环境名}.json`。如果从仓库根目录直接运行并导致配置读取异常，先改用上面的 `Push-Location` 方式。

普通本地启动默认不要额外设置 `ASPNETCORE_ENVIRONMENT` 或 `DOTNET_ENVIRONMENT`；如果这些变量已由 `launchSettings.json`、`launch.json`、终端环境或测试脚本显式设置，`.microi-local` 不会覆盖它们。实际监听地址必须读取 `Microi.Server/Microi.net.Api/Properties/launchSettings.json` 的 `Microi.net.Api` profile；当前标准工作区是后端 `61501`、前端 `61500`，不能继续硬编码历史 `7266/1988`。

**本地后端自动重启要求（强制）**：本地联调需要启动或重启 `Microi.net.Api` 时，先检查 `.tmp/microi-process-state/release.lock`；发布锁存在时禁止启动或重启。无发布时先回读标准端口和 `/api/Diagnostics/liveness`，健康服务默认复用；只有本任务修改了需重载的后端代码、服务不健康或用户明确要求重启时，才可精确停止当前工作区的后端进程，然后在 `Microi.Server/Microi.net.Api` 目录执行 `dotnet run --launch-profile Microi.net.Api`。优先使用用户能在 VS Code 中看到和停止的终端（包含 VS Code 集成终端、VS Code 任务终端、用户明确允许的 VS Code 可追踪隐藏终端）；如果当前工具没有 VS Code 终端能力，允许使用本机可见的 `cmd`/PowerShell 窗口启动，禁止使用脱离用户可见窗口的后台服务或守护进程。不要误杀数据库、Redis、Node 前端或其它业务进程。

## 多 AI 对话共享本地服务与发布互斥（强制）

同一工作区的 4、5 个 AI 对话共用同一份源码和固定端口时，`61500/61501` 是工作区级单例共享服务，不属于某个对话。端口相同意味着无法让每个对话拥有一套独立进程；正确模型是“复用健康服务 + 需要重载时串行重启 + 发布时独占”，不能让每个对话都无条件先杀再启动。

- 启动前先检查端口、健康接口、PID、命令行和工作区路径。健康且代码无需重载时直接复用；不得仅为声明“本对话拥有服务”而重启。
- 长期本地后端必须通过项目目录里的 `dotnet run --launch-profile Microi.net.Api` 使用开发输出。禁止把 `bin/Release/net10.0` 或 `bin/Release/publish` 的 `dotnet Microi.net.Api.dll` 当长期 E2E 服务；运行中的 Release DLL 会让后续 `dotnet build` 报 `MSB3021/MSB3027` 文件锁。
- 一键编译发布会创建 `.tmp/microi-process-state/release.lock`，并调用 `Microi.Server/tools/Microi.LocalProcessManager.ps1 -Action PrepareRelease`。它只结束命令行和工作区均匹配的 `61501` 后端、`61500` Vite 以及额外 Release 后端，并验证 Release DLL 可独占打开；遇到身份不匹配的端口占用必须停止，不得按进程名全杀。
- 发布锁存在期间，所有 AI 自动启动、服务自愈和 Playwright `webServer` 都必须等待或退出，禁止重新抢占 `61500/61501`。发布正常结束或中断时由脚本释放锁；无法证明锁持有者已退出时不得自行删除锁。
- Edge/Chrome 主浏览器、VS Code 持有的 Playwright Test Server、语言服务和 MCP Node 进程不属于发布文件锁清理范围。浏览器自动化必须关闭本用例创建的 context/browser；不得通过 `taskkill /IM chrome.exe|msedge.exe|node.exe|dotnet.exe` 清空整机进程。
- 人工盘点使用：`powershell -NoProfile -ExecutionPolicy Bypass -File Microi.Server/tools/Microi.LocalProcessManager.ps1 -Action Status`。需要单独停止当前工作区服务时使用 `-Action StopBackend` 或 `-Action StopFrontend`，不再让用户根据任务管理器猜进程。

## 本地租户与测试凭据读取约定

AI 在本地启动后端、跑 Playwright、做登录态页面截图或调用需要登录的接口前，必须先尝试从本地配置判断租户和测试账号，不要直接以“未登录无法测试”结束：

1. 读取 `Microi.Server/Microi.net.Api/.microi-local`，得到当前环境名，例如 `<Environment>`。
2. 读取 `Microi.Server/Microi.net.Api/appsettings.<Environment>.json`，或测试脚本传入的 `PW_APPSETTINGS_PATH`。
3. 测试账号密码只从用户本轮明确提供、受保护的测试进程变量 `PW_TEST_ACCOUNT` / `PW_TEST_PASSWORD`、CI Secret 或既有安全登录态取得；不得把凭据写入 `appsettings.*.json`、源码或测试报告。
4. `MICROI_OSCLIENT`、`PW_OS_CLIENT` 等只属于自动化工具进程，不是 API 生产环境变量；显式设置时可用于选择测试租户。
5. `.microi-local`、Token、数据库连接串、Redis 密码和测试凭据都视为本地敏感配置。最终回复、日志摘要和测试报告中不得输出真实值，只能写 `<redacted>`、`本地配置账号` 或 `本地配置凭据`。

## 自动化登录约定

本地和远端 E2E 统一传真实 `Account` / `Pwd`。需要跳过图形验证码时，只能在目标租户 `sys_config.AutoTestSkipCaptcha=true` 后传 `_AutomationTestLogin=true`；它只跳过验证码，绝不能绕过密码校验。禁止恢复 `DevLoginBypass`、`X-Microi-Dev-Key`、`_DEV_BYPASS_` 或让脚本自动改写后端 `appsettings`。测试完成后不持久化账号密码。

## V8 远端/本地同步收尾约定

AI 通过 MCP、接口引擎、数据库脚本或平台 API 修改任何远端 V8 代码后，任务结束前必须把远端当前生效代码同步回本地 `Microi-V8-Engine/<server>/<osClient>/` 目录，并做一次同步状态复核。

适用范围包括：
- `sys_apiengine.ApiV8Code` 接口引擎
- `diy_table` 表单 V8 事件
- `diy_field` 字段 V8 事件
- `sys_menu` 模块按钮/Tab V8 代码
- `wf_node` 工作流节点 V8 代码
- `sys_datasource` 数据源 V8 代码

收尾流程：
- 若远端是通过 MCP 写入的，以远端当前生效代码为准回写本地文件。
- 若本地文件是先手工修改的，先推送到远端，再重新拉取/复核，确保本地与远端一致。
- 优先使用 Microi.VSCode 插件的同步/查看同步状态能力；没有可调用插件时，可在 `.tmp/` 写一次性同步脚本，但脚本必须先 dry-run 输出差异摘要，再 apply。
- 复核结果应确认 touched 范围内 `Changed=0`、`Created=0`、`LocalOnly=0` 或说明剩余差异原因。
- 空 V8 代码不生成本地 `.js` 文件；若已有空 `.js` 文件，收尾同步时应删除，避免被误判为本地未推送。
- AI 收尾不能只看自写脚本的 dry-run；只要工作区安装了 Microi.VSCode 插件，就必须按插件“查看同步状态”的口径再复核一次。最终回复中要明确说明插件口径是否为 0；若仍有本地未推送/远端差异，必须列出具体资源类型、Key 和本地文件路径，不能只报数量。
- 当远端代码与本地代码完全一致但插件仍提示“本地未推送”时，优先校准 `.microi-meta.json` 的 `updateTime/filePath` 与本地文件 `mtime`，并再次执行插件口径同步检查；不要让时间戳误差遗留给用户。
- AI 通过 MCP/API 直接写远端 V8 后，必须立即回读远端当前生效代码到本地并校准 `.microi-meta.json` 与文件 `mtime`。这不是可选清理动作，而是交付完成条件；否则 VS Code 插件会按时间戳继续提示“本地未推送”。
- 若同步状态非 0，必须先列出具体文件并分类处理：正文一致仅校准 meta/mtime，远端较新则拉回，本地较新则推送，双方都改过则人工合并。生产资金/资产系统不能为清状态盲目覆盖远端。

## V8 缓存刷新约定

如果 AI 绕过平台表单提交事件，直接通过 MCP、数据库脚本或自写同步工具更新 `sys_apiengine`、`diy_table`、`diy_field`、`sys_menu`、`wf_node` 等远端 V8 代码，收尾时除了同步本地文件，还必须刷新运行中服务的缓存。至少清理当前 `<OsClient>` 下对应资源的 `Microi:<OsClient>:FormData:<table>:<key>`、`Id` 和地址形式缓存；若可用，优先调用平台缓存接口或插件内置同步流程。清缓存后要重新调用受影响接口做一次真实验证，避免本地/远端代码已一致但 API 仍执行旧缓存代码。

## MCP 元数据更新验收约定

AI 通过 MCP 修改 `diy_field`、`diy_table`、`sys_menu`、`sys_osclients`、`sys_config` 等平台元数据后，不能只看写入返回成功，必须按前端真实消费方式回读验证：

1. 修改 `Select`、`Radio`、`Checkbox`、`MultipleSelect` 等选项组件时，必须回读字段的 `Component`、`Data`、`Config`。已有字段更新时不要假设 `"key|label"` 字符串会被 `microi_update_field` 自动解析；KeyValue 数据源推荐直接把 `Data` 写成 JSON 数组 `[{"Key":"Aliyun","Value":"阿里云机器翻译"}]`，并确保 `Config.DataSource=KeyValue`、`SelectLabel=Value`、`SelectSaveField=Key`。
2. 修改字段、表、菜单后，必须调用 `microi_get_field_list` / `microi_get_table_data` 回读关键字段，并调用 `microi_refresh_schema_cache` 或对应清缓存接口刷新 Redis。涉及 SaaS 引擎、系统设置、菜单按钮、接口引擎等运行态缓存时，还要调用对应租户清缓存接口并重新请求受影响页面/API。
3. 最终交付说明必须写清楚：改了哪个表/字段，回读值是什么，刷新了哪些缓存，验证入口是什么。若某个缓存刷新接口失败或只能部分成功，需要把失败消息原样摘要出来，不能把“写入成功”当作“页面一定生效”。

## MCP 可用性排查约定

VS Code、Cursor 或 Codex 设置界面显示某个 MCP 服务器“已启用”，不代表当前 AI 会话一定已经成功加载了对应工具。AI 在声称“可以通过 MCP 操作”之前，必须完成一次真实可调用性验证：

- 先用当前会话可用的工具发现能力查找目标 MCP 工具；若工具发现为 0，不能继续假设 MCP 可用。
- 再用 MCP 资源/模板列表或最小 `initialize` / `tools/list` 探测确认服务器握手成功。若返回 `handshaking with MCP server failed`、`initialize response`、`connection closed` 等错误，要明确说明“配置存在但当前会话不可调用”。
- 同时检查 `.vscode/mcp.json`、`.cursor/mcp.json`、`.mcp.json` 和 `~/.codex/config.toml` 是否能解析，并确认目标服务器名、`MICROI_API_URL`、`MICROI_OS_CLIENT`、`MICROI_TOKEN_FILE` 已写入。
- 如果手动启动 `mcp-server.js` 能响应，而当前 AI 会话仍握手失败，应优先怀疑 MCP stdio 协议兼容、初始化响应格式/大小、服务器进程提前退出或插件生成的 Codex 配置顺序问题，而不是简单归因于“用户没启用”。
- 当 MCP 工具数量较多时，`tools/list` 的前段必须优先返回通用建模和维护工具，例如 `microi_get_db_schema`、`microi_get_field_list`、`microi_add_field`、`microi_update_field`、`microi_refresh_schema_cache`、`microi_create_table`、`microi_create_module`、`microi_get_event_code`、`microi_save_event_code`。部分 AI 客户端或模型上下文只注入前若干个工具，若核心工具排在后面，会误报“缺少 MCP 工具”。
- MCP 的初始化说明必须使用真实 `MICROI_OS_CLIENT` 作为租户边界。中文显示名通过 ASCII 的 `MICROI_LABEL_BASE64` 传输并在 MCP 内解码，旧版 `MICROI_LABEL` 只作兼容；显示名不能当成租户 Key 写入“只能管理某租户”的安全提示。
- 遇到 `ByteString`、`greater than 255` 或“第 N 个字符无法写入 Header”时，必须先检查实际异常索引和所有 HTTP Header 来源。Microi MCP 的设备标识来自 `did` / `MICROI_MCP_DID`；默认值若直接拼接中文 Windows 主机名，会在 `MCP:` 后第 4 个字符报错。`MICROI_LABEL_BASE64` 只用于显示，不会作为业务 HTTP Header 发送，禁止在未核对调用链前把错误归因于中文 Label。插件和 MCP 必须把 DID 规范化为稳定的可打印 ASCII。
- MCP 连接失败时，AI 在完成配置、进程、Header、`initialize`、`tools/list` 和只读状态调用的证据链之前，不得修改 Token、租户、服务器地址或执行远端写入。连接恢复后先完成只读基线盘点，再按用户授权开始写入。
- 修复 Microi.VSCode 插件的 MCP 生成逻辑后，必须重新生成配置、重启对应 MCP server，并在当前 AI 会话中再次验证工具发现与一次只读工具调用。

## MCP 写入超时与降级约定

- 写请求超时后的远端回读必须使用独立的短超时，不能继续沿用普通查询的长超时。否则一次 60 秒写超时后，每次回读还可能等待 120 秒，AI 会长期停留在“等待远端回读”，用户误以为菜单按钮或接口引擎完全写不进去。
- `microi_create_engine` 必须与代码保存、事件保存、菜单更新一样使用写请求超时和远端回读确认。创建响应异常但按 `ApiEngineKey` 回读到相同代码时，返回 `RecoveredAfterTransportError:true`；禁止因超时重复创建同一个接口引擎。
- 后端创建接口引擎时，数据库新增成功后的路由缓存刷新必须设置硬超时。缓存刷新失败或超时不能把已经成功入库的创建结果伪装成失败，更不能让 HTTP 请求无限等待；响应中应通过 `CacheRefresh` 报告缓存状态。

- 接口引擎代码只用 `microi_save_engine_code`，表单事件只用 `microi_save_event_code`，菜单按钮和 Tab 只用 `microi_update_module`。这些标准工具负责版本、校验、缓存和超时回读。
- 请求超时是“结果不确定”，不是“写入失败”。标准工具返回 `RecoveredAfterTransportError:true` 时，表示已经通过远端回读确认成功，不得再次写入。
- 标准工具明确返回“回读未确认”时，只调用对应 get 工具继续核对一次。没有用户明确授权，不得改走原生 FormEngine HTTP、直接 SQL、表定义增量更新，也不得创建一次性维护接口引擎绕过原端点。
- `MoreBtns`、`FormBtns`、`BatchSelectMoreBtns`、`PageTabs`、`ExportMoreBtns`、`PageBtns` 一律向 MCP 传明文 JSON 数组。租户 `sys_menu` 表单事件中的 Base64 解码属于平台内部兼容逻辑，AI 不得据此手工 Base64 编码。
- AI/终端工具显示的 `…N tokens truncated…`、`Exit code: N`、`Chunk ID:`、`Wall time:` 等是宿主输出标记，不是 V8 源码。禁止复制到本地文件或 MCP 写入参数；读取长源码必须按工具返回的字符范围分段取完，并核对完整源码 SHA-256。标准 MCP 写工具和插件推送检测到这些标记时必须拒绝写入。
- 远端源码不少于 8000 字符，而新源码减少超过 15% 时，应先视为可能只拿到了截断片段并停止写入。只有核对完整源码且确需大幅删减时，才使用写工具提供的显式大幅删减确认参数。
- 发生连续写入超时时，要先停止并发写入，记录具体工具、资源 Key、耗时和回读结果；禁止用“服务器整体不可用”“缓存锁死”等没有日志证据的结论代替诊断。

## Codex MCP 单入口约定

- Codex 对普通 MCP 大工具集可能无法稳定注入时，使用插件生成的 `microi_codex` 单入口，不要据此判断服务器或帐号不可用。
- `microi_codex` 的 `action="list_tools"` 可按 `params.keyword` 查找工具，`action="describe_tool"` + `params.name` 可读取参数说明；执行时 action 使用原始 `microi_*` 工具名，参数放在 `params`。
- 单入口只负责路由，必须复用原工具的参数 schema、写入确认、审计、超时回读和错误返回。不得因为只暴露一个 Codex 工具而放宽远端写入保护。
- 如果 Codex 仍不注入 `microi_codex`，优先使用它实际提供的资源工具：先 `list_mcp_resources` 并读取 `microi://codex/status` / `microi://codex/tools`；通用调用先 `list_mcp_resource_templates`，再读取 `microi://codex/action/{action}/{params}`，其中 `params` 是 URI 编码后的 JSON 对象。
- 资源模板只是兼容传输层，执行的仍是原始 `microi_*` handler。写操作同样必须携带原工具要求的 `confirmExecution`，不得把 resource read 当成绕过确认的通道。
- VS Code/Copilot、Cursor、Claude Code 仍使用完整 MCP 工具集；不要把 Codex 的 `enabled_tools = ["microi_codex"]` 复制到其他客户端配置。

## .venv Python 环境说明

工作区根目录的 `.venv/` 是 Python 虚拟环境，**保留，不要删除**。已安装：
- `playwright` — Playwright E2E 测试
- `openai` — AI 接口调用
- `httpx` — HTTP 客户端
- 其他工具（flake8、pytest 等）

AI 执行 Python 脚本时应使用 `.venv\Scripts\python.exe`（Windows）而非系统 Python。
## 后端代码改动后的重启验收

AI 只要修改了 `Microi.Server/**` 下会影响 `Microi.net.Api` 运行结果的后端源码、配置、控制器、服务、依赖项目或接口行为，任务收尾前必须完成一次“编译 + 重启本地后端 + 健康验证”，不要只用隔离输出目录 build 后结束。

强制流程：

1. 先执行后端编译验证。若 launch profile 当前端口上的开发服务导致 `bin/Debug/net10.0` DLL 被锁，可以先精确停止当前工作区的 `Microi.net.Api` 进程后重新编译；只有用户明确要求不中断正在运行服务时，才允许用临时输出目录作为补充验证，并必须说明运行服务尚未替换。
2. 从 `launchSettings.json` 回读实际端口，查找并停止该端口上的本地 `Microi.net.Api` 进程。只停止命令行与当前工作区匹配的 Microi 后端，不要误杀数据库、Redis、Node 前端或其它业务进程。
3. 必须进入 `Microi.Server/Microi.net.Api` 目录启动：
   ```powershell
   dotnet run --launch-profile Microi.net.Api
   ```
   启动优先发生在用户能在 VS Code 中看到和停止的终端中，方便用户查看日志并手动停止；用户明确允许时，可以使用 VS Code 可追踪的隐藏终端/任务终端。当前工具环境没有 VS Code 终端能力时，允许使用本机可见的 `cmd`/PowerShell 窗口启动；禁止使用脱离用户可见窗口的后台服务或守护进程方式启动。标准端口无法释放时，只有同步更新前端本地 `ApiBase` 和测试变量后才可使用明确的临时端口，并在任务结束时说明。
4. 启动后轮询验证 launch profile 实际地址可访问；至少确认端口已监听、进程存在、最近日志没有立即崩溃。涉及新增 API 时，再调用新增/受影响接口做一次真实请求。
5. 最终回复必须明确说明：后端已重新编译、旧进程 PID 是否停止、新进程 PID、实际端口是否监听、验证的 URL 或接口。若因为用户明确要求不中断、端口被非 Microi 进程占用或配置缺失导致无法重启，必须把阻塞原因说具体。

这条规则优先于“避免打断正在运行服务”的默认谨慎策略；本地开发联调场景下，用户通常需要 launch profile 当前端口上的后端加载最新代码。

## MCP 可调用性诊断补充

当用户反馈“Codex/VS Code 设置中能看到 MCP，但当前 AI 会话不能调用对应工具”时，不能只回答“当前会话没有注入”。必须按层排查：

1. 先确认 `.vscode/mcp.json`、`.cursor/mcp.json`、工作区根 `.mcp.json` 和 `~/.codex/config.toml` 都能解析，且目标 server key 为稳定 ASCII 格式，例如 `microi_itdos`，不要使用中文名或横杠。
2. 再用 Microi.VSCode 插件的“诊断 MCP 可调用性”命令，或等价脚本直接启动对应 `mcp-server.js` / `mcp-codex-stdio-adapter.js`，执行 `initialize` 和 `tools/list`，确认 `microi_get_db_schema`、`microi_get_field_list`、`microi_add_field`、`microi_update_field`、`microi_refresh_schema_cache` 等核心工具真实返回。
3. 如果当前 AI 客户端支持工具发现或延迟加载，AI 必须先主动执行工具发现/热加载流程，例如 `tool_search`、客户端 MCP refresh、Microi.VSCode 的启动/诊断命令；不要先让用户手动重启、重载或重新生成 MCP。
4. 如果真实握手成功但 Codex 当前对话仍没有注入 `mcp__...` 工具，AI 仍应优先使用等价的 MCP stdio JSON-RPC 直连 fallback 完成当前任务：读取对应 MCP 配置、启动 adapter/server、执行 `initialize`、`tools/list`、`tools/call`，并严格遵守该 MCP 绑定的 API Server 和 OsClient 边界。直连脚本必须放在 `.tmp/` 或使用一次性 stdin，不得散落到项目目录。
5. 只有在客户端不支持热加载、直连 fallback 也无法完成任务，或写操作边界无法确认时，才告知用户需要新开对话、重载 Codex 或检查 MCP 配置。说明必须写清楚：MCP 配置和进程是否可用、当前会话为什么没有注入工具、已经尝试过哪些自动恢复动作。
6. 如果握手失败，要把失败层级说清楚：配置文件解析失败、路径不存在、token 文件缺失、MCP 进程启动失败、`initialize` 失败、`tools/list` 缺核心工具，不能把这些问题混成“用户没启用 MCP”。
7. Microi.VSCode 生成 MCP 配置时应清理旧的中文/横杠 Microi MCP key，只保留 `microi_<osClient>` 或 `microi_<osClient>_<host>` 形式，避免不同 AI 客户端因 namespace 不稳定而无法注入工具。

## Windows MCP 控制台闪窗复盘

当用户反馈“打开 Microi.VSCode、添加服务器或初始化 MCP 后连续弹出并立即关闭多个 cmd 窗口”时，应按进程风暴排查，不能只给已有 `spawn` 补 `windowsHide`：

1. MCP 配置文件是各客户端的事实源。内容未变化时必须使用 write-if-changed，禁止仅为“同步”而反复改写文件并触发监听器重启。
2. 生成 `~/.codex/config.toml` 后，禁止再隐式循环执行 `codex mcp list/remove/add`；服务器数量越多，这类逐项 CLI 同步越会放大成几十个瞬时控制台进程。
3. VS Code 已配置 `chat.mcp.autostart` 时，插件后台监测只能检查配置和状态，禁止在侧栏显示、定时轮询、登录、添加连接或初始化流程里再次执行 `workbench.mcp.startServer('*')`。
4. 握手诊断会真实启动每个 stdio MCP，只能由用户显式点击“诊断 MCP 可调用性”触发；常规配置成功提示不得暗中运行整组诊断。
5. Windows 的 VS Code/Cursor 配置优先复用 GUI Electron 宿主 `process.execPath` 并设置 `ELECTRON_RUN_AS_NODE=1`，避免把控制台子系统的外部 `node.exe` 持久化为每个 MCP 的启动命令。Trae 若因空格路径兼容必须经过 `cmd.exe`，仍需使用固定 launcher 并隐藏窗口。
6. 回归测试至少静态断言：Codex CLI 批量注册函数不存在、后台 monitor 不包含 `startServer`、自动配置不包含诊断、Codex 配置内容不变时不改写、Windows GUI 宿主检查早于外部 Node 探测。再在扩展开发宿主中覆盖打开侧栏、添加连接、初始化 MCP，观察无连续控制台闪窗。

## CLI 与 IDE 插件错版共存约定

- CLI 与 IDE 插件共用配置、Token、MCP、Skills 或生成文件时，所有持久化协议必须按“新字段可选、旧字段保留、未知字段不删除”设计。不得将 JSON 解析到旧类型后只序列化已知字段。
- 共享 JSON/Token 必须失败关闭：解析失败时保留原文件并停止写入；写入使用同目录临时文件原子替换，多进程可写文件还要使用带超时/死锁恢复的文件锁。
- MCP 配置要写入工具来源与三段版本；替换同名或同 API/OsClient 的 Microi Server 时实行“较新提供者优先”，同时保留非 Microi MCP。Skills/AI 指令也要记录 bundle/file 版本，旧 bundle 不得覆盖新 bundle 已生成的内容。
- 已发布的历史二进制无法被新代码追溯修复。诊断必须把无版本记录标记为 `legacy`，说明更新或用较新一端重新初始化的恢复路径；不得宣称新代码已让任意历史版本绝对共存。
- 多 registry 联合发布没有跨站点原子事务。必须在递增版本前验证本轮必选目标的凭据/权限，对每个产物校验同版本，发布后逐端公开回读。可选目标（例如尚未开通 scope 的 npm CLI）预检或发布失败时，不得阻断已经通过预检的必选目标；必须保留同版本产物、明确报告部分完成并给出精确补发命令。要求全目标成功的发布应提供显式严格模式。补发只能复用完全相同的源码/产物；代码改动后必须发新版本。

### 复盘：可选 npm 目标阻断两个扩展市场发布

- 触发场景：联合发布同时包含两个扩展市场和 npm CLI，但 npm 组织 scope 尚未创建，脚本在版本递增前直接退出，导致已经具备权限的两个扩展市场也无法发布。
- 根因：发布脚本把三个 registry 都视为同一个全局硬门禁，并把最容易受账号、scope 和 2FA 影响的 npm 放在扩展市场之前，没有区分必选目标、可选目标和严格发布模式。
- 通用规则：默认发布按目标隔离；先完成并回读必选目标，再独立尝试可选目标。可选目标失败应保留同版本不可变产物并输出补发入口；只有显式严格模式才要求所有目标预检通过后继续。
- 自动化检查：模拟 npm 未登录、scope 404 和 npm publish 非零退出，断言两个扩展市场的发布调用与回读仍会执行；另测严格模式在版本递增前停止，补发命令不递增版本且复用同版本产物。

### 复盘：npm 已接收新版本但公共回读短暂 404

- 触发场景：`npm publish` 已成功返回，npmjs.com 包页面也已出现新包或新版本，但紧随其后的 `npm view <package>@<version> version` 在数十秒内连续返回 E404，联合发布脚本因此把成功发布误报为失败。
- 根因：新 scope/新版本在 npm 网站、写入节点和公共 registry 读取节点之间存在短暂传播窗口；固定少量、短间隔轮询不足以区分“尚未发布”和“已经接收但尚未公开传播”。
- 通用规则：发布命令成功和公共回读确认必须作为两个阶段记录。npm 新版本回读使用 `--prefer-online` 和分钟级有限重试；重试结束仍为 E404 时标记 `pending-propagation`，禁止自动重发同一不可变版本，并提供独立只读验证命令稍后确认。只有发布命令本身失败且公共 registry 也始终不存在时，才进入补发流程。
- 自动化检查：模拟 `npm publish` 成功后前几次 `npm view` 返回 E404、随后返回期望版本，断言不会重复发布；再模拟重试窗口结束仍为 E404，断言输出待传播状态和只读验证命令，而不是提示重新上传同一版本。
