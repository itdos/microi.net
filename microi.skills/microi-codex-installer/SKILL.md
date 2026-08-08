---
name: microi-codex-installer
description: 当用户在 Codex、WorkBuddy、CodeBuddy、Qoder、Comate、Trae、Cursor、Claude Code 或其它 AI 编程软件中说“安装 @microi.net/cli”“初始化 Microi吾码插件”“添加吾码服务器/MCP”“拉取某连接的所有 V8 代码”，或要求安装、升级、启用、诊断吾码 AI 插件时使用。用户明确要求安装或初始化即视为对应操作授权；普通 Microi 对话只做只读检测，禁止静默安装或改写全局配置。
---

# Microi吾码 AI 插件与 CLI 安装

本技能负责发现、安装、初始化、升级和诊断 Microi吾码 AI 开发能力。唯一 npm 包为 `@microi.net/cli`；该包同时提供 `microi` CLI、Codex Plugin、WorkBuddy/CodeBuddy 兼容插件清单、完整 Skills 与同源 MCP。正式 marketplace 名称固定为 `microi-net`，插件选择器固定为 `microi@microi-net`，禁止新建 `microi-official` 或第二个 npm 包。

只要本技能已经由 Microi.VSCode、工作区 `microi.skills` 或已安装插件提供，用户说“帮我初始化 Microi吾码插件”时就必须识别该意图，用户不需要再次说出 npm 包名。绝对空白且任何宿主都尚未提供本技能的 AI 会话无法依靠尚未加载的 Skill 自我发现包名；因此冷启动入口统一固化在 VS Code 初始化产物、`@microi.net/cli` 与 Codex Plugin 三处，而不是要求用户记忆第二个包。

## 自然语言入口规则

- 任一 AI 宿主开始处理 Microi吾码低代码、V8、MCP、表单/模块/流程、微应用或平台源码任务时，先判断当前任务是否已经提供 `microi` 的 Skills/MCP/CLI 能力。
- 能力不明确时立即做只读检测，不得等到缺少工具或上下文后才检查。
- 用户明确说“安装 `@microi.net/cli`”“初始化 Microi吾码插件”“添加服务器/MCP”或“拉取某连接全部 V8”时，该请求本身就是对应操作授权；立即执行本技能中的确定性命令，不再重复询问同一授权。
- 用户只是在进行普通 Microi 业务对话、尚未要求安装时，发现插件缺失后必须立即说明将修改 Codex 全局 marketplace、插件配置和本地缓存，并请求一次明确同意。未获同意不得安装、下载或改写全局配置。
- 用户拒绝或暂不安装时，继续使用工作区现有 `microi.skills`、`@microi.net/cli` 或 MCP 完成可完成的工作，不得阻塞或反复提示。

## 检测

优先使用已经安装的 CLI：

```bash
microi codex status --json
```

如果 `microi` 命令不存在，只可先运行不会下载包的本机只读检查：

```bash
codex plugin marketplace list
codex plugin list
```

成功状态必须同时满足：

- marketplace 为 `microi-net`；
- `microi@microi-net` 显示 `installed, enabled`；
- 已安装版本等于 CLI 内置 marketplace 的目标版本。

`microi-official` 和 `microi@microi-official` 仅是旧标识，不得写入新文档或新配置；安装器会在新版安装成功后迁移并清理旧标识。

## 获得授权后安装

已安装全局 CLI 时：

```bash
microi codex install --yes
```

没有全局 CLI，但用户已明确授权安装时：

```bash
npx --yes @microi.net/cli@latest codex install --yes
```

`--yes` 只表示当前用户已经授权这次全局修改，不得由 AI 在普通 Microi 对话中自行补上。只有版本不一致且普通安装不能升级、并确认目标 npm 包已经公开可读时，才使用：

```bash
microi codex install --yes --force
```

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

当前宿主不会热加载新 Skills/MCP 时，新建任务、重载 Skills/MCP 或重启宿主后再验收。

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

只有返回 `ok: true` 且选择器、状态和版本全部正确，才报告安装完成。随后明确提示用户新建 Codex 任务或重载 Codex；当前已经打开的任务通常不会热加载新增 Skills/MCP。

若 npm 返回 `E404`，说明 `@microi.net/cli` 的目标版本尚未公开或仍在传播。不得删除仍可用的旧插件、不得重复发布同一不可变版本，也不得声称安装成功。
