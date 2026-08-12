---
name: microi-codex-installer
description: 当用户在 Codex、WorkBuddy、CodeBuddy、Qoder、Comate、Trae、Cursor、Claude Code 或其它 AI 编程软件中说“安装 @microi.net/cli”“初始化 Microi吾码插件”“添加吾码服务器/MCP”“拉取某连接的所有 V8 代码”，或要求安装、自动升级、启用、诊断吾码 AI 插件时使用。吾码 CLI、Codex 插件及既有工作区 AI/MCP 默认后台自动更新；失败只延后和提示，不得阻断任何工作。
---

# Microi吾码 AI 插件与 CLI 安装

本技能负责发现、安装、初始化、升级和诊断 Microi吾码 AI 开发能力。唯一 npm 包为 `@microi.net/cli`；该包同时提供 `microi` CLI、Codex Plugin、WorkBuddy/CodeBuddy 兼容插件清单、完整 Skills 与同源 MCP。正式 marketplace 名称固定为 `microi-net`，插件选择器固定为 `microi@microi-net`，禁止新建 `microi-official` 或第二个 npm 包。

只要本技能已经由 Microi.VSCode、工作区 `microi.skills` 或已安装插件提供，用户说“帮我初始化 Microi吾码插件”时就必须识别该意图，用户不需要再次说出 npm 包名。全新 Codex 与空目录尚未加载任何吾码 Skill 时，用户只需在首次请求中明确 `@microi.net/cli`，例如“通过 `@microi.net/cli` 安装吾码 Codex 插件”；具备终端与网络权限的 AI 必须直接执行本技能中的确定性安装命令。安装完成后，更短的“初始化吾码”“添加服务器/MCP”“拉取全部 V8”均由插件 Skill 自动识别。

## 非阻塞自动更新（强制）

只要当前宿主已装有 Microi VS Code 扩展、`@microi.net/cli` 或 Codex 插件，就应由宿主/CLI 在后台投递自动更新。更新检查与业务工作并行，绝不能成为分析、MCP 调用、源码修改、构建、测试、发布或新任务的前置门禁。

自动更新只从 npm 官方 registry 读取 CLI 最新版：

```bash
npm view '@microi.net/cli' version --json --prefer-online --registry=https://registry.npmjs.org/
```

CLI、Codex 插件与工作区状态仍可用以下命令只读核对，但核对未完成不妨碍用户继续工作：

```bash
microi version --json
microi codex status --json
microi doctor --workspace "<工作区绝对路径>" --json
```

旧版 CLI 尚不支持 `microi version --json` 时，可使用 `npm list --global '@microi.net/cli' --depth=0 --json` 读取全局安装版本。`microi codex status --json` 的 `expectedVersion` 来自当前 CLI 自带快照，只检查本地一致性，不能代替 npm 在线查询。

标准入口是非阻塞投递命令：

```bash
microi update --background --workspace "<工作区绝对路径>" --json
```

后台进程会依次检查/安装全局 CLI、幂等更新 Codex 插件、执行 `microi ai init`、`microi doctor` 和 `microi codex status`。`codex install --yes` 的 `--yes` 只保留给旧脚本兼容，不再表示必须先取得用户授权。VS Code 扩展同时使用官方扩展宿主的 `workbench.extensions.installExtension` / 自动更新机制；当前 Extension Host 不强制重载。

当前运行中的扩展、CLI、Codex Router 与 MCP 必须继续使用已加载版本，禁止为了升级终止进程、强制重载窗口、结束对话或拒绝新任务。新版本写入版本隔离目录，只在后续新进程或宿主自然重启时接管。npm registry 不可用、版本无法解析、权限不足、文件被占用或安装失败时，写入 `~/.microi/updater/status.json` 并延后重试；可非模态提示“立即重试/查看日志”，但无论用户是否处理，当前、正在进行和新建工作都必须继续。禁止改用第三方 registry 或不明镜像冒充最新版。

## 自然语言入口规则

- 任一 AI 宿主开始处理 Microi吾码低代码、V8、MCP、表单/模块/流程、微应用或平台源码任务时，先判断当前任务是否已经提供 `microi` 的 Skills/MCP/CLI 能力。
- 能力不明确时可立即做只读检测或后台投递 `microi update`，但不得等待检测/更新完成才开始用户工作。
- 用户明确说“安装 `@microi.net/cli`”“初始化 Microi吾码插件”“添加服务器/MCP”或“拉取某连接全部 V8”时，直接执行确定性命令，不再询问“是否允许升级”。连接地址、帐号、密码以及远端业务写入仍遵守各自原有确认边界。
- 普通 Microi 对话发现 CLI、Codex 插件、AI bundle 或 MCP 不是最新版时，自动更新并继续任务；如自动更新做不到，只给出不阻塞的重试提示，不得把升级选择变成继续工作的条件。
- 用户关闭自动更新、忽略提示或暂不重载时，当前版本能力照常可用。只在任务确实依赖一个旧版本不存在的具体能力时，准确说明该能力边界并提供降级方案，不能用笼统“版本未通过”拒绝整个任务。

## 检测

需要诊断更新状态时，使用已经安装的 CLI 检查；这些命令是可观测性工具，不是业务门禁：

```bash
microi version --json
microi codex status --json
microi doctor --workspace "<工作区绝对路径>" --json
```

如果 `microi` 命令不存在，只可先运行不会下载包的本机只读检查：

```bash
codex plugin marketplace list
codex plugin list
```

理想状态同时满足：

- 全局 CLI、npm 官方最新版与 Codex 插件版本一致；
- marketplace 为 `microi-net`；
- `microi@microi-net` 显示 `installed, enabled`；
- 已安装版本等于 CLI 内置 marketplace 的目标版本。
- 插件路径位于 `microi-net-marketplace/plugins/microi`，且 `.codex-plugin/plugin.json` 的显示名为 `Microi吾码`。
- `doctor.coexistence.aiBundleVersion` 不低于当前 CLI，MCP provider 没有 `legacy` 或 `upgrade-available`；`newer-provider-preserved` 表示较新的 VS Code/CLI 提供者已被安全保留，可以通过。

`microi-official` 和 `microi@microi-official` 仅是旧标识，不得写入新文档或新配置；安装器会在新版安装成功后迁移并清理旧标识。

## 自动安装与手动恢复

正常情况由 `microi update --background` 自动完成。需要人工立即恢复时，可直接把全局 CLI 更新到 npm 官方最新版：

```bash
npm install --global @microi.net/cli@latest
microi codex install --yes
```

全局安装受宿主限制时可使用下面的临时执行方式；它不能证明一个既有旧版全局 CLI 已被升级：

```bash
npx --yes @microi.net/cli@latest codex install --yes
```

这条命令把 npm 仅作为下载通道：安装器会将包内完整 Codex Plugin 安全复制到当前用户的 `${CODEX_HOME:-~/.codex}/microi-net-marketplace/plugins/microi`，生成 Codex 官方支持的本地 marketplace，注册 `microi-net`，再安装并启用 `microi@microi-net`。完成并重载后，Codex 的“插件”页面必须显示 **Microi吾码**，来源为 **microi-net**。禁止重新写入 Codex 不支持的 `source: npm` marketplace 条目。

在全新 Codex 的空目录中，以下自然语言必须等价执行上述命令，不得仅生成项目 Skill 后就声称 Codex Plugin 已安装：

```text
通过 @microi.net/cli@latest 安装吾码 Codex 插件。
```

`--yes` 仅兼容旧版无人值守脚本，安装器不再把它当作工作授权。只有版本不一致且普通安装不能升级、并确认目标 npm 包已经公开可读时，才使用：

```bash
microi codex install --yes --force
```

CLI 或 Codex 插件安装/升级完成后，后台幂等重新初始化当前工作区 AI 配置并更新 MCP，然后双重验收：

```bash
microi ai init --workspace "<工作区绝对路径>" --json
microi doctor --workspace "<工作区绝对路径>" --json
microi codex status --json
```

不得用单独的 `microi mcp init` 代替完整 AI 重新初始化；`ai init` 已默认包含 MCP 更新。只有诊断表明 MCP 仍有明确残留问题时，才追加 `microi mcp init` 做定向恢复。初始化写入采用幂等/原子方式，不终止已启动的 MCP；当前进程继续旧版本，新进程读取新版本。

开发者从可信本地源码验收时，可以显式指定 marketplace 源：

```bash
microi codex install --yes --source <Microi.VSCode目录>
```

普通用户不得被引导到来历不明的 Git、本地目录或第三方 registry。不得通过 VPN、伪造地区/企业身份或共享账号绕过 OpenAI 地区与身份政策。

## 空工作区与多宿主初始化

用户明确要求“初始化 Microi吾码插件/AI 配置”“添加吾码服务器并配置 MCP”时，该请求同时授权在其指定工作区生成吾码 AI 配置；如果还明确要求安装 Codex Plugin，则先按上一节完成全局插件安装。随后优先执行唯一包的初始化命令：

```bash
npx --yes @microi.net/cli@latest init --workspace <工作区>
```

用户还要求首次拉取全部 V8 与数据库结构时增加 `--pull`。用户已经全局安装 CLI 时改用：

```bash
microi init --workspace <工作区> --pull
```

`init` 必须能够在干净空目录中依次添加服务器连接、交互登录、生成 `microi.skills/`、`AGENTS.md`、`CLAUDE.md`、Copilot/Cursor/CodeBuddy 规则、CodeBuddy/Qoder/Comate 项目 Skill、typings、`jsconfig.json`，并配置 Codex、VS Code、Cursor、Trae、Claude Code、WorkBuddy、CodeBuddy、Qoder、Comate MCP。密码只允许隐式输入，禁止放入命令参数、对话记录或生成文件。

原生配置对应关系：

- WorkBuddy：`.workbuddy/mcp.json`；保存并重载后可直接用自然语言调用 MCP。
- CodeBuddy：`.codebuddy/skills/microi/SKILL.md`、`.codebuddy/rules/microi.md` 与根 `.mcp.json`。
- Qoder：`.qoder/skills/microi/SKILL.md`、`AGENTS.md` 与根 `.mcp.json`。
- 百度 Comate：`.agents/skills/microi/SKILL.md`、`.comate/skills/microi/SKILL.md` 与 `.comate/mcp.json`。
- Trae：`AGENTS.md` 与 `.trae/mcp.json`；首次仍需开启项目级 MCP。
- Codex：`AGENTS.md`、完整 Skills、项目及用户 `config.toml`；全局插件是可选增强。

完成后运行：

```bash
microi doctor --workspace <工作区> --json
```

当前宿主不会热加载新 Skills/MCP 时，不要求用户立即重载；当前工作继续，用户自然新建任务、重载 Skills/MCP 或重启宿主后再验收新版能力。

## 按服务器连接拉取全部 V8

已有连接时先列出稳定标识：

```bash
microi profile list --workspace <工作区> --json
```

用户点名连接名称、OsClient、序号或 MCP 名称后执行：

```bash
microi pull --profile <连接名称、OsClient、序号或mcpName> --scope all --workspace <工作区>
```

`profile list --json` 会返回每个连接的稳定 `mcpName`（例如 `microi_demo`），CLI 可直接接受该值。存在同名租户或无法唯一匹配时必须让用户选择，禁止猜服务器。`--scope all` 包含接口引擎、表单事件与字段、模块按钮、工作流和数据库结构。

## WorkBuddy 与 CodeBuddy 原生插件包

`@microi.net/cli` 包根同时携带 `.workbuddy-plugin/plugin.json`、`.codebuddy-plugin/plugin.json`、对应 `marketplace.json`、根 `.mcp.json` 与全部 `skills/`。查看已安装包的真实路径：

```bash
microi plugin path --json
```

CodeBuddy CLI 可把该 `packageRoot` 作为本地 marketplace 添加，再安装 `microi@microi-net`；WorkBuddy 按其插件页面添加可信 marketplace，或从已安装包导入 Skill。插件安装、启用和重载属于宿主自身的信任边界：CLI 只生成包与项目配置，不伪造“已经在 UI 安装成功”。即使不安装宿主级插件，执行 `microi init` 后仍可通过项目 MCP、规则与 Skills 完成当前工作区开发。

## 安装后验收

再次执行：

```bash
microi codex status --json
```

返回 `ok: true` 且选择器、状态和版本全部正确时可报告安装完成；必要时再用 `codex plugin list` 核对路径。若宿主尚未热加载，只说明“新版将在下一次自然启动时生效”，不得要求用户立即新建任务或重载才能继续当前工作。

若 npm 返回 `E404`，说明 `@microi.net/cli` 的目标版本尚未公开或仍在传播。不得删除仍可用的旧插件、不得重复发布同一不可变版本，也不得声称安装成功。
