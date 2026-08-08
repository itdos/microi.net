<!-- DOC-SYNC: 核心定位、能力矩阵、安装命令和发布流程需与 Microi.VSCode/README.md 保持一致。 -->

<p align="center">
  <img src="https://static.itdos.com/upload/img/microi-red-256.png" width="112" alt="Microi吾码">
</p>

<h1 align="center">Microi吾码 AI 开发工具：VS Code 插件 + CLI + Codex Plugin</h1>

<p align="center">
  <strong>用自然语言开发完整的复杂业务系统，让低代码从“拖拉拽”进入“AI 直接交付”。</strong>
</p>

<p align="center" style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px;">
  <a href="https://microi.net/"><img src="https://img.shields.io/badge/官网-microi.net-2563eb" alt="Microi 官网"></a>
  <img src="https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC" alt="VS Code 1.85+">
  <img src="https://img.shields.io/badge/CLI-Node.js%2018%2B-339933" alt="Microi CLI">
  <img src="https://img.shields.io/badge/Codex-Plugin-111827" alt="Microi Codex Plugin">
  <img src="https://img.shields.io/badge/MCP-110%2B%20平台工具-8b5cf6" alt="110+ MCP 工具">
  <img src="https://img.shields.io/badge/AI-Copilot%20%7C%20Cursor%20%7C%20Trae%20%7C%20Claude%20%7C%20Codex-059669" alt="AI 客户端">
  <img src="https://img.shields.io/badge/License-MIT-f59e0b" alt="MIT License">
</p>

---

## 同一套 AI 能力，三种使用入口

传统低代码把开发从“写大量代码”变成了“手动建表、逐个添加字段、拖拽控件、配置菜单、拼界面 JSON、设计打印模板和工作流”。Microi吾码进一步把这些操作变成自然语言，并提供三个互补入口：

- **VS Code 插件**：适合需要资源树、编辑器按钮、Diff、可视化状态、远程执行和逐行调试的用户。
- **`@microi.net/cli`**：产品展示名为 `microi.net/cli`，适合只使用 Codex CLI、Claude Code、Trae 或普通终端、不想安装 IDE 的用户；可在命令行完成连接、登录、AI/MCP 初始化和 V8 资源同步。
- **`@microi.net/codex-plugin`**：Codex 原生 Plugin，直接打包同源 MCP、CLI 和全套 Microi Skills，适合以 Codex 对话为主要开发入口的用户。

三者不是三套实现。它们位于同一个 `Microi.VSCode` 仓库，复用相同的连接、认证、同步、MCP 和 AI 知识注入代码，并共用工作区配置、Token 与同步基线。可以只安装一种，也可以同时使用。

> 你描述业务目标，AI 通过插件内置的 Microi MCP、平台知识库和 Skills，完成业务蓝图、数据模型、表单字段、菜单权限、接口引擎、V8 事件、数据源、界面引擎、打印引擎、工作流、定时任务、前端微服务以及自动化测试。

这意味着，无论是 OA、ERP、MES、CRM、WMS、项目管理、售后服务、商城、预约、物联网，还是高度定制的行业系统，都可以从一段业务需求开始，由 AI 按 Microi 平台规范规划、生成、验证并持续迭代。

对业务人员，它是一套以自然语言为主要交互方式、无需手写代码的系统开发方案；对专业研发人员，AI 生成的 V8、前端源码、元数据和测试仍然可查看、可调试、可 Git 管理、可人工接管。

```text
自然语言需求
    ↓
业务蓝图 / 现有系统 / 实时数据库结构
    ↓
Manifest 全系统规划 + dry-run 预演
    ↓
用户确认后通过 MCP 写入 Microi
    ↓
表单 · 菜单 · 权限 · V8 · 页面 · 打印 · 流程 · 微服务
    ↓
远端回读 · 系统验收 · E2E · 压测 · 本地/远端同步
```

### 可以直接这样对 AI 说

```text
请为当前租户创建一套设备维保系统：包含客户、设备、保养计划、工单、配件、
巡检记录和知识库；设计管理员、调度员、工程师三类角色；工单支持派单、接单、
处理、验收、回访和超时提醒；生成 PC 后台、移动端字段布局、运营驾驶舱、工单
打印模板、审批流与 Playwright 验收用例。先读取现有蓝图和数据库，给出 dry-run
计划，确认后再写入，最后验证系统并报告同步状态。
```

也可以从任意局部开始：

- “把这份需求文档整理成业务蓝图和完整系统 Manifest。”
- “为客户表补齐联系人子表、查询条件、列表列、统计字段和移动端卡片字段。”
- “生成一个销售运营驾驶舱，包含核心指标、趋势图、排行榜和待办列表。”
- “设计一张 A4 工单打印模板，包含设备信息、处理明细、图片和签字区。”
- “把这个复杂弹窗改成可维护的前端微服务，并在 Microi 中发布。”
- “检查当前系统的表、字段、接口、菜单、工作流和蓝图是否发生漂移。”

## AI 如何交付一套完整系统

插件把“自然语言”与“真实平台能力”连接起来，不依赖 AI 猜测表结构，也不只是生成一段无法落地的示例代码。

1. **发现事实**：读取当前服务器、OsClient、业务蓝图、数据库结构、菜单、接口引擎以及已有 Web / UniApp / MicroService 应用。
2. **理解业务**：梳理角色、业务域、数据关系、状态机、权限、流程、页面、打印和验收标准。
3. **生成计划**：将需求转换为完整 Manifest，通过 `microi_plan_system` 或 `microi_generate_system dryRun:true` 预演，不直接写入。
4. **确认执行**：用户确认后，创建或升级表、字段、模块、权限、接口、事件、数据源、页面、打印、工作流和任务。
5. **补齐定制界面**：常规业务优先使用表单引擎和界面引擎；复杂交互通过前端微服务实现，并保留完整源码。
6. **回读与验收**：验证每个资源是否真实存在、字段和菜单配置是否完整、工作流拓扑是否正确、远端代码是否生效。
7. **自动化交付**：生成并运行 Playwright E2E、网络与资源守卫，按需执行性能测试，再检查本地与远端同步状态。

所有关键写入工具都保留确认、审计、超时回读与幂等保护。全系统生成默认先 dry-run；真实写入需要明确的 `confirmExecution`，避免一句含糊的对话直接改动业务系统。

## 核心能力

| 能力 | 说明 |
|---|---|
| **自然语言生成完整系统** | 从需求直接生成业务蓝图、Manifest、表、字段、表单布局、菜单树、权限、接口、事件、数据源、页面、打印、工作流、任务和测试。 |
| **内置 Microi MCP Server** | VSIX、CLI npm 包与 Codex Plugin 都打包同一 MCP Server，普通用户无需克隆 `microi.mcp`；一键配置后，AI 可直接读取和操作当前 Microi 租户。 |
| **110+ 个平台工具** | 当前源码已超过 110 个注册工具，覆盖系统发现、低代码建模、V8、页面、打印、流程、微服务、测试、文件、Redis 和 MongoDB 日志等能力；精确清单以运行时 `tools/list` 为准。 |
| **AI 知识库与 Skills 自动注入** | 自动生成 `AGENTS.md`、`CLAUDE.md`、Copilot/Cursor 指令、V8 类型定义和 `microi.skills/`，AI 无需反复“喂文档”。 |
| **实时数据库理解** | AI 可通过 MCP 查询实时表结构，也可按需读取每个 OsClient 的 `.microi-db-schema.md` 快照；大型数据库不会塞满公共指令文件。 |
| **V8 全资源本地化** | 接口引擎、表单事件、字段事件、模块按钮/Tab、模块 Join/Where、工作流节点代码均可拉取为本地 `.js` 文件。 |
| **远程执行与调试** | VS Code 提供 DAP 可视化调试；CLI 与 Codex Plugin 通过同源 MCP/Skill 完成远程执行、堆栈诊断、最小补丁和复测，UI 形态不同但不复制远端实现。 |
| **安全同步与冲突检测** | 支持单文件推送、服务器一键同步、远端 Diff、同步结果下钻和双端修改冲突拦截。 |
| **前端微服务全生命周期** | 创建、拉取、构建、发布、同步私有源码、维护路由清单并检查源码冲突。 |
| **AI 模型统一配置** | 在插件中维护模型库，并分别同步到 Claude Code、Codex 和 GitHub Copilot；内置 DeepSeek、通义千问、MiniMax、腾讯混元、OpenRouter 等快捷预设。 |
| **Playwright E2E** | 生成 Microi 专用测试工程、登录与接口辅助方法、冒烟测试、契约测试、网络守卫、视觉与资源检查，并打开 HTML 报告。 |
| **性能压力测试** | 对接口引擎、V8 事件和表 CRUD 执行并发/升压测试，输出 RPS、平均耗时、P95/P99、错误率、趋势与错误 Top。 |
| **多服务器 / 多租户** | 同一工作区可管理多个服务器和 OsClient，连接、Token、MCP 配置和本地目录彼此隔离；VS Code、CLI 与 Codex Plugin 共用这些数据。 |

## MCP 工具覆盖哪些平台能力

插件内置 MCP 不是一个“万能写入接口”，而是一组按 Microi 业务对象设计、带参数校验与安全边界的专业工具。

| 领域 | 代表能力 / 工具 |
|---|---|
| 系统与结构发现 | `microi_get_status`、`microi_get_db_schema`、字段、模块、角色、接口、事件和应用清单读取 |
| 业务架构蓝图 | `microi_get_blueprint_schema`、`microi_list_blueprints`、`microi_get_blueprint`、保存、校验与历史追踪 |
| 全系统 Manifest | `microi_get_manifest_schema`、`microi_plan_system`、`microi_generate_system`、`microi_validate_system` |
| 表单与数据模型 | 创建表、添加/批量更新字段、关联字段修复、字段控件配置、表属性更新、结构缓存刷新 |
| 菜单与权限 | 创建菜单模块、维护列表/搜索/统计/移动端字段、按钮与 Tab、角色和菜单权限 |
| V8 与接口引擎 | 创建/读取/保存/执行接口引擎，表单与字段事件，模块按钮代码，工作流节点 V8，匿名访问配置 |
| 数据源与业务数据 | SQL/V8/JSON 数据源，表数据查询/新增/修改/种子数据，文件上传 |
| 界面引擎 | 从自然语言生成、校验和保存 Page Engine 页面与运营驾驶舱 |
| 打印引擎 | 从自然语言生成、校验和保存 hiprint 打印模板与运行数据结构 |
| 工作流与任务 | 工作流包、拓扑检查、条件路线测试、节点 V8、定时任务 |
| 在线 AI 应用 | 发现 Web / UniApp / MicroService，读取完整源码上下文，创建、同步和发布前端微服务 |
| 测试与验收 | Playwright 上下文、E2E 计划、系统后置验收、页面/打印/菜单配置校验 |
| 运行维护 | Redis 统计、SCAN、读取、删除、替换、重命名、TTL；MongoDB 日志查询与写入 |

### Codex 大工具集兼容

部分 Codex 版本不会稳定注入超大 MCP 工具集。插件会为 Codex 配置 `microi_codex` 单入口：AI 可先用 `list_tools` / `describe_tool` 发现全部原始工具，再通过同一入口调用；参数校验、写入确认、审计和远端回读不会被绕过。

如果当前 Codex 仍未注入工具，MCP 还提供 `microi://codex/status`、`microi://codex/tools` 和通用 action 资源模板作为兼容通道。VS Code/Copilot、Cursor、Trae 与 Claude Code 继续使用完整 MCP 工具集。

## 支持的 AI 客户端

执行插件命令 **`Microi: 初始化AI配置`** 或 CLI 命令 **`microi ai init`** 后，工具会针对不同 AI 客户端生成各自能够自动识别的指令与 MCP 配置。

| AI 客户端 | 项目知识与规则 | MCP 配置 | 模型配置 |
|---|---|---|---|
| GitHub Copilot / VS Code Agent | `.github/copilot-instructions.md`、V8 typings、Skills | `.vscode/mcp.json` | 支持同步吾码模型库到 Copilot Provider |
| Cursor | `.cursorrules`、`.cursor/rules/microi-skills.mdc`、V8 typings | `.cursor/mcp.json` | 使用 Cursor 自身模型能力 |
| Trae | `AGENTS.md`、Skills、V8 typings | `.trae/mcp.json` | 首次使用需开启项目级 MCP |
| Claude Code | `CLAUDE.md`、Skills | 工作区根 `.mcp.json` | 支持检测/安装 Claude Code，并同步模型库 |
| Codex | `AGENTS.md`、Skills | `~/.codex/config.toml` | 支持同步 Provider、模型目录与环境配置 |

VS Code 插件和 CLI 都支持本地 stdio MCP；远程 SSE 与可视化生命周期管理当前由插件提供：

- **本地 stdio MCP**：推荐方式，由 AI 客户端自动启动 VSIX 或 CLI 包内置的 MCP Server。
- **远程 SSE MCP**：适合团队共享，需要提前部署远程 MCP 服务。
- **一键诊断**：真实执行 `initialize`、`tools/list` 和 `microi_get_status`，区分“配置已存在”与“当前真的可调用”。
- **生命周期管理**：在 Microi 侧栏启动、停止、重启、查看输出、查看配置、启用/禁用或移除 MCP Server。

> Codex 已打开的会话通常不会热加载新增 MCP。首次生成配置后，请新开 Codex 对话或重载 Codex；其他客户端也可能要求首次批准新 MCP Server。

## 零配置知识库：AI 自动理解 Microi

插件把稳定知识、专项规范和实时业务结构分层管理：

- **公共知识层**：V8 API、`_Where` 语法、上下文变量、表单事件、HTTP/缓存/数据库/Office 等稳定知识。
- **Skills 规范层**：低代码建模、V8、表单布局、菜单按钮、界面引擎、打印引擎、UniApp、前端微服务、E2E、性能测试和全系统交付规范。
- **实时事实层**：当前 OsClient 的数据库、菜单、接口、事件、应用与蓝图，优先通过 MCP 查询。
- **本地快照层**：`.microi-db-schema.md` 与本地 V8/前端源码，便于离线分析、Diff 和 Git 管理。

即使只是一个空目录，也可以通过 VS Code 插件或 CLI 直接初始化。工具会生成或维护：

```text
工作区根目录/
├── AGENTS.md
├── CLAUDE.md
├── .github/copilot-instructions.md
├── .cursorrules
├── .cursor/rules/microi-skills.mdc
├── microi.skills/
├── .vscode/mcp.json
├── .cursor/mcp.json
├── .trae/mcp.json
├── .mcp.json
└── Microi-V8-Engine/
    ├── .microi-typings/v8-engine.d.ts
    ├── jsconfig.json
    └── {服务器}/{OsClient.Type.Network}/
        ├── .microi-db-schema.md
        ├── 接口引擎/
        ├── 表单引擎/
        ├── 模块引擎/
        ├── 流程引擎/
        └── AI应用/
```

MCP 配置、Token 文件、数据库快照和运行态元数据会加入本地 Git exclude，避免把个人服务器信息误提交给团队。工具升级 Skills 时使用逐文件 hash 判断：自动生成且用户未修改的文件可以安全升级，本地已经改过的文件会被保留。

## 快速开始：任选 VS Code 或纯命令行

两种入口都要求拥有可访问的 Microi吾码服务器与帐号。最终生成的 `AGENTS.md`、Skills、MCP 配置和 `Microi-V8-Engine/` 目录一致。

### 方案 A：VS Code 插件

要求 VS Code `1.85.0` 或更高版本。

1. 在扩展市场搜索 **`Microi吾码`**，或从扩展面板安装 `v8-engine-x.x.x.vsix`。
2. 打开 **`Microi: 插件配置`**，输入 API Base URL 和 OsClient，点击“检测服务器，登录并保存连接”。
3. 输入帐号、密码；服务端开启验证码时一并输入。凭据保存在当前工作区作用域的 VS Code `SecretStorage`。
4. 执行 **`Microi: 初始化AI配置`**，生成 AI 指令、Skills、V8 typings、`jsconfig.json` 和 MCP 配置。
5. 如需复查，执行 **`Microi MCP: 诊断 MCP 可调用性`**。
6. 需要人工编辑、Git 管理或远程调试时，在服务器节点执行 **“拉取此服务器代码”**。

### 方案 B：Codex CLI / 纯命令行

要求 Node.js `18.18.0` 或更高版本。npm 首次公开发布后安装：

```bash
npm install -g @microi.net/cli
```

CLI 首次发布前，从 `Microi.VSCode` 源码目录本地安装也能完成同样验证：

```bash
npm install -g ./Microi.VSCode/cli
```

进入准备作为 AI 工作区的目录并运行：

```bash
microi init --pull
```

命令会按顺序完成：添加服务器连接、提示输入帐号和密码、在需要时保存验证码图片并提示输入、登录、注入 AI/Skills/typings、配置 MCP，并在显式传入 `--pull` 时拉取全部 V8 资源和数据库结构。密码只存在于当前 CLI 进程内，不写入文件。

如果只初始化 AI 和 MCP、暂不拉取代码：

```bash
microi init
```

首次写入 Codex MCP 后必须新开 Codex 对话；已经打开的对话通常不会热加载新增工具。

### 方案 C：Codex Plugin

Codex Plugin 以 `@microi.net/codex-plugin` 打包，marketplace 固定名为 `microi-net`，选择器为 `microi@microi-net`。普通用户明确同意安装后，可直接让 AI 执行：

```bash
npx --yes @microi.net/cli@latest codex install --yes
```

已安装 CLI 时也可运行 `microi codex status --json` 检测、运行 `microi codex install --yes` 安装。`--yes` 表示用户已经授权修改 Codex 全局 marketplace、插件配置和缓存；普通 Microi 对话不得静默补上该参数。

开发仓库先运行 `npm run codex:build`，再用 `microi codex install --yes --source ./Microi.VSCode` 验收本地 marketplace；重启 ChatGPT/Codex 桌面端后，来源显示为 **Microi.Net**。npm marketplace 模板见 `codex/marketplace.npm.json`。

安装后在新 Codex 任务中先调用 `microi_codex` 的 `profiles` 动作。它会读取 `Microi-V8-Engine/.microi-config.json`；未初始化时，使用插件内置 `scripts/microi-cli.js init --workspace <工作区>`。多连接时把 `profiles` 返回的稳定 `name` 传给后续工具调用。

> npm 包用于 repo/npm marketplace 分发，不会自动进入 ChatGPT/Codex 通用公开插件目录；通用目录仍需按 OpenAI 官方 Plugin 提交流程审核。

### 开始自然语言开发

在 Copilot、Cursor、Trae、Claude Code 或 Codex 中描述系统需求即可。插件和 CLI 都建议让 AI 明确执行以下流程：

```text
先读取当前租户状态、业务蓝图、数据库结构和已有在线应用；
整理完整方案并 dry-run；
我确认后再真实写入；
写入后回读验证、生成 E2E 测试，并检查同步状态。
```

## 三端能力与交互边界

CLI 与 Codex Plugin 的目标是让用户**无需先安装 IDE，也能完整启用 Microi 的 AI 开发能力**，不是把编辑器 UI 生硬复制到终端或对话。三端连接后均通过同一套 MCP 与 Skills 完成平台建模、V8、页面、打印、工作流、微服务和验收。

| 能力 | VS Code 插件 | `@microi.net/cli` | `@microi.net/codex-plugin` |
|---|---|---|---|
| 多服务器连接、帐号/密码/验证码登录 | 可视化表单 | 交互式命令行 | 内置 CLI + `profiles` 路由 |
| AI 指令、Skills、typings、MCP 初始化 | 支持 | 支持 | 自带全套 Skills/MCP，也可注入工作区 |
| V8/字段/模块/流程/数据库结构拉取 | 资源树操作 | `microi pull` | 内置 CLI 或 MCP |
| 远端差异检查、单文件显式推送 | Diff/同步结果视图 | `microi sync status` / `microi push` | CLI + Codex 原生 diff/patch |
| 平台建模与写入 | AI 通过 MCP | AI 通过同一 MCP | `microi_codex` 路由同一原工具 |
| 接口引擎远程执行 | 编辑器按钮；AI MCP | AI MCP | MCP + `v8-debugging` Skill |
| 调试交互 | DAP 断点/变量/Step | 结构化执行与诊断 | 结构化执行、补丁、复测；不复制 DAP UI |
| 前端微服务构建、发布 | 可视化命令 | AI 通过 MCP/终端 | `microi-microservice` Skill + MCP/终端 |
| MCP 进程启停与输出 | 可视化管理 | AI 客户端管理；`doctor` 诊断 | Codex Plugin 宿主管理；路由器报告连接状态 |

## CLI 常用命令

| 命令 | 作用 |
|---|---|
| `microi init [--pull]` | 一次完成连接、登录、AI/MCP 初始化；可选全量拉取 |
| `microi profile list` | 查看连接及登录状态 |
| `microi profile add` / `remove` | 添加或删除服务器连接 |
| `microi auth login` / `status` / `logout` | 管理工作区登录 Token |
| `microi ai init` | 生成或更新 AI 指令、Skills、typings 与 MCP |
| `microi mcp init` | 幂等更新各 AI 客户端 MCP 配置 |
| `microi pull --scope all` | 拉取全部资源；也可选 `api/form/module/workflow/schema` |
| `microi sync status --scope all` | 读取本地与远端差异 |
| `microi push <file>` | 显式推送一个已拉取的 V8 文件 |
| `microi doctor` | 检查 Node、工作区、Profile、Token、AI 与 MCP 文件 |

通用选项包括 `--workspace <目录>`、`--profile <序号/OsClient/名称>` 和 `--json`。远端写入仍遵循显式策略；保存本地文件不会自动推送。

## CLI 与 VS Code 插件同时使用

- 两者共用 `Microi-V8-Engine/.microi-config.json`、`.microi-mcp-tokens.json` 和各服务器 `.microi-meta.json`。
- MCP 配置采用幂等合并，只替换 Microi 管理的 server，保留用户已有的其他 MCP；内容未变化时不重写。
- CLI 不保存帐号密码。插件可把凭据放在 VS Code `SecretStorage` 以支持静默续登；两者仍共用最新 Token 文件。
- 本地 V8 文件和同步基线是共同事实源。切换工具前先执行差异检查，任何一端都不要在冲突未处理时强行拉取或推送。
- 多个终端或编辑器同时操作同一工作区时，不要并发推送同一个资源。

## V8 本地开发、执行与调试

插件与 CLI 共用以下 V8 资源；编辑器内执行和逐行调试界面由插件提供：

- 接口引擎代码。
- 表单前端/后端 V8 事件。
- 字段 `V8Code`、`KeyupV8Code`、模板事件等代码。
- 模块按钮、批量按钮、表单按钮、页面按钮与 Tab 显隐代码。
- 工作流节点 V8 事件。

表单事件文件采用“实时字段 Label（EventType）”命名。`SubmitFormV8` 为 `前端表单提交前V8事件（SubmitFormV8）.js`，`OutFormV8` 为 `前端表单提交后V8事件（OutFormV8）.js`；插件拉取时会迁移旧名“前端表单提交V8事件/前端表单退出V8事件”，并同步更新 `.microi-meta.json`。

典型人工开发闭环：

1. 从左侧服务器、表或模块节点拉取资源。
2. 在 `.js` 文件中输入 `V8.` 获得类型提示和智能补全。
3. 保存文件；保存只会更新“本地已修改”状态，**不会静默覆盖远端**。
4. 执行“推送当前文件到数据库”或服务器“一键同步”；插件会为接口引擎和 V8 事件维护语义版本，服务端只在代码内容真实变化时写入新的代码版本记录。
5. 对接口引擎执行“远程执行”或“远程逐行调试”。
6. 在“同步结果”视图查看本地、远端和冲突差异。

### 远程执行

对接口引擎文件执行 **`Microi: 远程执行当前接口引擎`**，在参数面板填写 JSON：

- 使用目标服务器的真实 V8 环境和登录态。
- 输出结果与 `console.log` 记录到 Microi Output。
- 异常会尽量定位到对应源代码行。

### 远程逐行调试

执行 **`Microi: 远程逐行调试当前接口引擎`**，支持：

- 行断点与启动时暂停。
- Continue、Step Over、Step In、Step Out。
- 局部变量、作用域与表达式求值。
- 调试控制台和停止会话。

也可以使用 `launch.json`：

```json
{
  "type": "microi-v8-remote",
  "request": "launch",
  "name": "Microi V8 远程调试",
  "program": "${file}",
  "params": {},
  "stopOnEntry": true
}
```

## 本地与远端同步

每个服务器都有独立 `.microi-meta.json` 基线。同步检查会区分：

- **本地未推送**：本地文件较新或尚未建立远端基线。
- **服务器端已修改**：远端较新，本地未改。
- **冲突**：同一资源本地和远端都发生修改。
- **已同步**：正文和同步基线一致。

“一键同步此服务器代码”会在无冲突时先推送本地较新的文件，再拉取服务器最新代码；存在冲突时停止自动操作并展示冲突列表。首次空目录拉取可以直接执行，已有本地内容时会先提示检测同步状态，避免强制覆盖。

同步结果支持：

- 按服务器或接口/表单/模块/流程分类检查。
- 下钻到资源 Key、名称、文件路径和时间。
- 连续打开 VS Code Diff，不必每次重新扫描。
- 前端微服务文本 Diff 与二进制 SHA-256 状态检查。
- 重新检测和清空结果。

## 前端微服务与复杂定制页面

三个以上字段、复杂联动、上传、表格、Tab、步骤条、代码编辑器或长期维护的弹窗，不需要在 V8 中拼接大段 HTML。AI 可以创建或扩展一个 MicroService，由 Microi 宿主以标准方式打开。

插件提供完整的本地微服务工作流：

| 操作 | 说明 |
|---|---|
| 创建前端微服务 | 生成项目元数据、基础源码、`.microi-micro-app.json` 和路由清单 |
| 拉取服务器前端微服务 | 获取在线 AI 应用的私有源码到本地 |
| 构建 | 执行项目构建并检查 `dist` 产物 |
| 推送 | 上传构建产物并更新 Microi 微服务元数据 |
| 构建并推送 | 一次完成构建、版本更新和发布 |
| 同步源码到在线 AI 应用 | 保存可继续被在线 AI 或其他开发者维护的私有源码 |
| 查看同步状态 | 比较本地与远端源码，识别本地修改、远端修改和冲突 |

前端微服务统一放在当前租户的 `AI应用/{appKey}/`。`microi.routes.json` 作为路由事实源，发布与迁移时会保留必要的历史菜单 URL / 组件路径兼容信息。

## Playwright E2E 自动化测试

插件会把自动化工程生成到目标前端项目的 `.microi-e2e/`，不污染业务源码目录。

| 命令 | 作用 |
|---|---|
| `Microi: 初始化端到端自动化测试（Playwright E2E）` | 生成配置、Microi helpers、环境变量示例和基础测试 |
| `Microi: 运行端到端自动化测试（Playwright E2E）` | 运行项目的 `test:e2e` |
| `Microi: 打开端到端测试报告（Playwright Report）` | 打开 HTML 报告 |

初始化时会读取当前连接，并尝试通过后端获取菜单路由与接口引擎上下文，写入 `.microi-playwright-context.json`。生成的基础用例覆盖：

- 公共页面和接口引擎冒烟。
- DosResult 接口契约。
- 登录 Token 注入与认证会话。
- API 4xx/5xx、空响应、字符串 `null` 和无效 JSON 守卫。
- 图片加载、第三方占位资源、横向溢出和明显“开发中/请求失败”文案检查。
- Desktop 与 Mobile 两套浏览器项目。

## 性能压力测试

打开 **`Microi: 性能测试`**，可直接复用当前 Microi 连接测试：

| 目标 | 说明 |
|---|---|
| 接口引擎 | 真实调用 `/apiengine/{ApiEngineKey}`，支持 JSON 参数、并发、总次数、持续时间、升压和超时 |
| V8 事件 | 读取已有表单事件或执行临时代码，通过 `ExecuteV8Event` 隔离测试 |
| 表 CRUD | 对测试表执行新增、查询、修改、删除闭环，真实触发服务端 V8 事件 |

报告展示完成数、成功/失败、RPS、平均耗时、P95、P99、错误率、每秒趋势和错误 Top，并可保存到工作区 `.microi-performance/`。表 CRUD 会产生真实写入，建议使用测试表并保持“每次迭代后删除测试行”开启。

## 多服务器与身份管理

- 同一工作区可保存多个服务器 / OsClient Profile。
- 服务器标题优先从 `SysShortTitle` / `SysTitle` 获取。
- 每个 Profile 独立保存 Token 和本地资源目录；VS Code 插件的密码另存于工作区 SecretStorage，CLI 不落盘保存密码。
- Token 临近失效时自动刷新；服务端状态已失效时按 Profile 精确清理并恢复登录。
- 支持有验证码和无验证码登录。
- MCP Server key、显示名称和设备标识会转换为安全的 ASCII 传输格式，兼容中文 Windows 主机名与不同 AI 客户端。
- Windows 工作区会自动启用当前 Git 仓库的 `core.longpaths=true`，降低深层 V8 目录的长路径问题。

## VS Code 插件配置项

在 VS Code 设置中搜索 `microi`：

| 设置项 | 默认值 | 说明 |
|---|---:|---|
| `microi.apiBaseUrl` | `""` | 单连接模式的 Microi 后端 API 地址 |
| `microi.profiles` | `[]` | 多服务器连接配置列表 |
| `microi.osClient` | `""` | 单连接模式的默认 OsClient |
| `microi.localDir` | `""` | 本地同步目录；留空使用工作区 `Microi-V8-Engine/` |
| `microi.showConsoleOnExecute` | `true` | 远程执行时自动显示 Output |
| `microi.playwright.defaultBaseUrl` | `http://127.0.0.1:5180` | Playwright 默认前端地址 |
| `microi.playwright.defaultApiBaseUrl` | `""` | Playwright 默认 API；留空使用当前连接 |
| `microi.playwright.defaultOsClient` | `""` | Playwright 默认 OsClient；留空使用当前连接 |
| `microi.playwright.browserChannel` | `""` | 浏览器 channel，例如 `msedge` |
| `microi.playwright.appType` | `uniapp-h5` | `uniapp-h5`、`pc-vue` 或 `web` |

## VS Code 插件完整命令清单

按 `Ctrl+Shift+P`（macOS：`Cmd+Shift+P`），输入 `Microi` 查看命令。

### 连接、AI 与 MCP

| 命令 |
|---|
| `Microi: 插件配置` |
| `Microi: 登录` |
| `Microi: 退出登录` |
| `Microi: 切换 OsClient` |
| `Microi: 初始化AI配置` |
| `Microi: 配置 MCP（AI 工具连接）` |
| `Microi MCP: 刷新 MCP 状态` |
| `Microi MCP: 诊断 MCP 可调用性` |
| `Microi MCP: 启动全部 MCP 服务器` |
| `Microi MCP: 启动 MCP 服务器` |
| `Microi MCP: 停止 MCP 服务器` |
| `Microi MCP: 重启 MCP 服务器` |
| `Microi MCP: 显示 MCP 输出` |
| `Microi MCP: 显示 MCP 配置` |
| `Microi MCP: MCP 服务器选项（启用/禁用）` |
| `Microi MCP: 显示已安装 MCP 服务器` |
| `Microi MCP: 删除 MCP 配置` |

### V8、资源与同步

| 命令 |
|---|
| `Microi: 新增接口引擎` |
| `Microi: 新建表单V8事件文件` |
| `Microi: 新建流程节点V8事件文件` |
| `Microi: 新建按钮V8事件文件` |
| `Microi: 拉取此服务器代码` |
| `Microi: 一键同步此服务器代码` |
| `Microi: 拉取此表字段V8事件` |
| `Microi: 拉取此模块子树` |
| `Microi: 搜索引擎文件` |
| `Microi: 拉取数据库结构到AI知识库` |
| `Microi: 推送当前文件到数据库` |
| `Microi: 与远程版本对比` |
| `Microi: 查看同步状态` |
| `Microi: 检测同步冲突` |
| `Microi: 查看同步差异` |
| `Microi: 重新检测同步状态` |
| `Microi: 清空同步结果` |
| `Microi: 打开文件` |
| `Microi: 在资源管理器中打开` |
| `Microi: 复制 ApiEngineKey` |
| `Microi: 刷新` |

### 执行与调试

| 命令 |
|---|
| `Microi: 远程执行当前接口引擎` |
| `Microi: 远程逐行调试当前接口引擎` |
| `Microi: 停止调试会话` |

### 前端微服务

| 命令 |
|---|
| `Microi: 创建前端微服务` |
| `Microi: 拉取服务器前端微服务` |
| `Microi: 构建前端微服务` |
| `Microi: 推送前端微服务到数据库` |
| `Microi: 构建并推送前端微服务` |
| `Microi: 同步微服务源码到在线 AI 应用` |
| `Microi: 查看前端微服务同步状态` |

### 测试

| 命令 |
|---|
| `Microi: 性能测试` |
| `Microi: 初始化端到端自动化测试（Playwright E2E）` |
| `Microi: 运行端到端自动化测试（Playwright E2E）` |
| `Microi: 打开端到端测试报告（Playwright Report）` |

## CLI 与 Codex Plugin 命名、打包与发布

CLI 正式包名为 **`@microi.net/cli`**，安装后暴露命令 **`microi`**；Codex Plugin 正式包名为 **`@microi.net/codex-plugin`**。两个 npm 产品共用 `@microi.net` scope 和版本号。

一套 `Microi.VSCode` 输出三个产品、四个分发目标：VS Code 扩展发布到 Visual Studio Marketplace 与 Open VSX，CLI 和 Codex Plugin 分别发布到 npm。`bump-version.js` 同时更新扩展、CLI、Codex npm 包、Codex manifest、npm marketplace 示例和 bundled Skills；任一版本不一致都会在外部写入前停止。

四个分发目标不支持跨站事务。默认 `npm run publish` 先处理两个扩展市场，再只执行一次 npm 登录/权限检查，随后先发布 Codex Plugin；只有目标 Codex npm 包已公开或本次发布成功，才发布内含一键安装器的 CLI，避免安装器引用 404 版本。任一目标失败不会撤销已完成目标，两个 tarball 都会保留供同源码补发，脚本逐目标公开回读，不把部分完成冒充三端完成。严格发布使用 `npm run publish:preflight:all` 和 `npm run publish:strict`。

### 本地构建与安装验收

```bash
cd Microi.VSCode
npm install
npm run cli:typecheck
npm run build
npm run cli:test
npm run codex:test
python %USERPROFILE%/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/microi
npm run package
node scripts/test-cli-package.js
node scripts/test-codex-plugin-package.js
npm install -g ./cli
microi --help
```

只生成并校验 VSIX、CLI tarball 与 Codex Plugin tarball，不改版本也不上传：

```bash
node publish.js --package-only --no-bump
```

### 首次发布到 npm

1. 登录 npmjs.com，创建免费公开组织 **`microi.net`**；组织名会成为 `@microi.net` scope。若由个人 scope 发布，则 npm 用户名必须正好是 `microi.net`。
2. 确认 npm 账号已加入 `@microi.net` 组织并拥有发布权限。本机未登录时，默认流程会先发布两个扩展市场，再执行一次 `npm login --registry=https://registry.npmjs.org/`，随后先发布 Codex Plugin、再发布 CLI。CI、无人值守或严格预检模式仍应提前登录。
3. 为两个插件市场准备 PAT。本机可设置环境变量 `VSCE_PAT` / `OVSX_PAT`，或把 `publish-tokens.example.json` 复制为已被 Git 忽略的 `publish-tokens.local.json`。不要再使用 `publish-tokens.json`。
4. 如果仓库曾跟踪过 `publish-tokens.json`，应把其中的 PAT 视为已泄露：先在两个平台废弃并重新生成，把新 PAT 放入环境变量或 `publish-tokens.local.json`，再删除旧文件并执行 `git rm --cached publish-tokens.json`。发布脚本遇到该旧路径会主动停止。
5. 回到 `Microi.VSCode` 执行 `npm run publish:preflight`。脚本会同时检查两个 npm 包的 registry/scope 权限，并调用 `vsce verify-pat` 与 `ovsx verify-pat`；仅缺 npm 登录时不会阻断两个扩展市场。要求全部目标在版本递增前通过时，执行 `npm run publish:preflight:all`。
6. 先运行 `npm run package` 检查本地产物；确认后执行 `npm run publish`。
7. 脚本会自动回读本次实际发布的目标；也可手工复核：

```bash
npm view @microi.net/cli version
npm view @microi.net/codex-plugin version
npx vsce show Microi.v8-engine --json
npx ovsx get Microi.v8-engine --metadata
npm install -g @microi.net/cli
microi --help
```

npm 新 scope 或新版本刚发布后，公共 registry 可能短时间不同步。脚本会使用 `--prefer-online` 最长等待约 2 分钟；如果 `npm publish` 已成功返回但回读仍是临时 E404，只报告 `pending-propagation`。此时**不要重复发布或补发同一版本**，稍后执行只读验证：

```bash
npm run publish:verify
```

如果 npm 因未登录、scope、权限或上传错误而不可发布，默认流程仍先完成两个扩展市场，并在项目根保留两个同版本 tarball。**不要再次执行 `npm run publish`**。在源码和对应原始 tarball 未改变时先补发 Codex Plugin，再补发 CLI：

```bash
npm run publish:codex:resume
npm run publish:cli:resume
```

如果两个 npm 产品已发布、扩展市场未完成，执行 `npm run publish:extensions:resume`。只补一个扩展市场使用 `publish:vsce:resume` 或 `publish:ovsx:resume`。补发不递增版本，并回读全部三端产品的当前版本。

> 补发只适用于“同一份源码和产物的当次发布被中断”。如果失败后又修改了代码，必须重新完整发布下一版，不能用相同版本号发布不同产物。

> 发布 `@microi.net/codex-plugin` 只完成 npm/marketplace 分发，不会自动进入 ChatGPT/Codex 通用公开插件目录；公开目录需另按 OpenAI 官方 Plugin 提交流程审核。

正式发布是外部不可逆操作。不要把 npm Token、服务器 Token 或任何登录密码写入仓库。CI 后续可改用 npm Trusted Publishing，避免长期保存发布 Token。

## 使用截图

<p align="center">
  <img src="https://static.itdos.com/upload/img/V8引擎本地AI编程连接配置.png" width="49%" alt="Microi 连接配置">
  <img src="https://static.itdos.com/upload/img/V8引擎本地AI编程运行调试.png" width="49%" alt="Microi 运行调试">
</p>

## 常见问题

### MCP 显示已配置，但 AI 仍说没有工具

先执行 **`Microi MCP: 诊断 MCP 可调用性`**。它会验证配置、进程启动、`initialize`、`tools/list` 和只读状态调用，而不只是检查 JSON 文件是否存在。

如果诊断成功但 Codex 当前对话仍没有工具，请新开对话或重载 Codex；当前会话通常不会热加载新 MCP。还可以使用 `microi_codex` 单入口或 MCP 资源兼容通道。

### 保存文件后为什么远端没有变化

当前版本采用显式发布策略：保存只标记本地变更。请执行 **“推送当前文件到数据库”**，或在服务器节点执行 **“一键同步此服务器代码”**。这样可以避免普通保存动作无提示地覆盖远端生产代码。

### 拉取会不会覆盖本地代码

首次空目录可以直接拉取；已有同步基线或本地文件时，插件会先提示检测同步状态。建议先查看同步结果，处理冲突后再一键同步，不要直接强行拉取。

### 空工作区可以使用吗

可以。打开任意空文件夹执行 **`Microi: 初始化AI配置`**，或在该目录运行 `microi init`，都会生成 Skills、AI 指令、V8 typings 和 `jsconfig.json`；添加服务器并登录后，还会生成对应的 MCP 配置。无需提前克隆 Microi 源码或 `microi.skills`。

### 不安装 VS Code，能否完整使用吾码 AI 开发能力

可以。安装 `@microi.net/cli` 后运行 `microi init --pull`，再新开 Codex、Claude Code 或 Trae 对话即可使用同一套 MCP 与 Skills。所谓“完整 AI 开发能力”指自然语言建模、V8、页面、打印、流程、微服务、测试和回读验收；资源树、编辑器 Diff 和断点调试是 IDE 交互能力，只在 VS Code 插件中提供。

### CLI 和 VS Code 插件会不会冲突

不会各建一套配置。两者共用连接、Token、MCP、源码和同步基线。新版共存协议包含：配置/Token 原子写入与未知字段保留；MCP 中写入来源和版本，两者版本不同时由较新版本保持内置 Server 路径；Skills 和 AI 指令 manifest 拒绝被旧 bundle 降级；`microi doctor` 可显示当前 MCP 提供者版本。

已经安装的历史旧版本无法被新代码“隔空修改”。如果其 MCP 记录显示 `legacy` 或旧版本，建议更新两端；暂时不更新时，每次运行旧工具后再用较新一端执行 `microi mcp init` 或“配置 MCP”即可修复。两端可以交替操作，但仍不应同时推送同一个远程资源；推送前必须做差异检查。

### `npm install -g @microi.net/cli` 提示包不存在

说明 npm 首次公开发布尚未完成，或当前 registry 不是 npm 官方源。开发阶段可在源码根目录执行 `npm install -g ./Microi.VSCode/cli`；发布后用 `npm view @microi.net/cli version` 回读确认。

### 远程执行与调试不可用

- 确认当前文件属于已拉取的接口引擎，而不是普通 JavaScript 文件。
- 确认目标 Profile 已登录且 Token 有效。
- 检查 Microi Output 中的后端错误。
- 远程逐行调试需要服务器部署对应的 V8 调试能力；不能使用时仍可先远程执行和查看日志。

### 数据库结构很大，会不会拖慢 AI

公共 AI 指令不会内嵌全部业务表。实时结构由 MCP 按需查询，本地结构则按 OsClient 单独保存在 `.microi-db-schema.md`。即使数据库有数百张表，也不会把完整 schema 强塞进每次对话上下文。

## 相关链接

- [Microi吾码官网与官方文档](https://microi.net/)
- [AI 编程指南](https://microi.net/doc/v8-engine/ai-apiengine)
- [MCP Server 完整指南](https://microi.net/doc/v8-engine/mcp-server)
- [GitHub 源码](https://github.com/itdos/microi.net)
- [Gitee 源码](https://gitee.com/ITdos/microi.net)
- [版本更新日志](https://microi.net/doc/about/update-log.html)
- [插件内部开发文档](https://git.itdos.net:88/anderson/microi.vscode/-/blob/master/DEVELOPMENT.md)

## License

[MIT](https://opensource.org/license/mit)
