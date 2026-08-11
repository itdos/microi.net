---
name: microi-codex
description: 在 Codex 中完成 Microi吾码 VS Code 扩展的等价工作流，包括连接与登录、AI/MCP 初始化、V8/表单/模块/工作流同步、远程执行与诊断、性能测试、微应用、Playwright 和发布回读。用户提到吾码、Microi、V8引擎、Microi-V8-Engine 或要求使用吾码 Codex 插件时使用。
---

# Microi吾码 Codex Plugin

本插件与 `Microi.VSCode`、`@microi.net/cli` 共用配置、Token、MCP Server 和 Microi Skills。不要另写原生 HTTP、SQL 或第二套认证实现。

## 最新版启动门禁（强制）

当前对话在执行任何 Microi 分析、MCP 调用、源码修改、构建或发布前，必须先完整读取同级 `microi-codex-installer/SKILL.md`，并完成其中“Codex 每任务最新版硬门禁”。至少要执行 `npm view '@microi.net/cli' version --json --prefer-online --registry=https://registry.npmjs.org/`，不能只看本地 `microi codex status`。

若 CLI、Codex 插件、工作区 AI bundle 或 MCP provider 不是最新版，取得一次用户授权后，必须依次执行 `npm install --global @microi.net/cli@latest`、`microi codex install --yes`、`microi ai init --workspace "<工作区绝对路径>" --json`、`microi doctor --workspace "<工作区绝对路径>" --json` 与 `microi codex status --json`。`ai init` 默认包含 MCP 更新，禁止传 `--no-mcp`。插件发生变化后必须新建任务或重载 Codex，再次通过门禁后继续；当前任务不得假装已经热加载新版能力。

## 先确认工作区连接

1. 调用 `microi_codex`，传 `{ "action": "profiles" }`。
2. 只有一个已登录连接时，后续可以省略 `profile`；存在多个连接时，始终传 `profiles` 返回的稳定 `name`。
3. 尚未初始化时，插件根目录是本文件向上两级；使用其中的 `scripts/microi-cli.js`：
   - `node <plugin-root>/scripts/microi-cli.js init --workspace <workspace>`
   - 多连接：`profile list|add|remove`
   - 登录：`auth login|status|logout --profile <name>`
   - 诊断：`doctor --json`
4. 登录会在真实终端中隐式输入密码；不要把密码写入命令、日志、Skill、MCP 参数或工作区文件。Token 继续写入 `Microi-V8-Engine/.microi-mcp-tokens.json`，并按 API、OsClient、Type、Network 四段身份隔离。

## 功能路由

- 连接、登录、拉取、推送、差异和 AI 初始化：使用 bundled CLI 的 `profile`、`auth`、`pull`、`push`、`sync status`、`ai init`、`mcp init`、`doctor`。
- 接口引擎、表单事件、模块、字段、工作流和数据库结构：先用 `action="list_tools"` / `describe_tool`，再调用对应原始 `microi_*` 工具。写工具必须保留确认口令、审计与回读。
- 远程执行与调试：读取 `v8-debugging/SKILL.md`。Codex 用“获取源码 → 远程执行 → 定位堆栈/日志 → 最小补丁 → 再执行”的结构化循环代替 VS Code DAP 的可视化逐行面板；不得把未执行的源码检查称为真机调试成功。
- 性能测试：读取 `performance-testing/SKILL.md`，限制并发并输出样本、P95/P99、错误率和停止条件。
- 微应用：读取 `microi-microservice/SKILL.md`，使用 scaffold、source sync、stream publish 和发布回读原工具；本地构建前遵守内存保护。
- Playwright：读取 `playwright-e2e/SKILL.md`，使用当前已登录浏览器或受控 Playwright；报告必须来自实际页面执行。
- 其他领域：从本插件同级 Skills 里选择最小相关 Skill，并完整读取后执行。

## 同步与安全边界

- `Microi-V8-Engine/.microi-config.json` 是三端连接配置事实源；未知字段必须保留。
- CLI、VS Code 插件与 Codex 插件可以在同一工作区并存；三者必须复用同一配置/Token/MCP 协议，带版本写入实行较新 provider 优先，禁止旧入口回写降级。最新版门禁与 `doctor.coexistence` 未通过时不得声称任意历史版本组合绝对无冲突。
- 推送前先做远端差异检查。写请求超时只表示结果不确定，使用对应 get 工具短超时回读，禁止盲目重复创建或覆盖。
- 配置和 Token 文件使用现有原子写与锁协议；不要手工拼接或清空用户已有 MCP 配置。
- Codex Plugin 路由器只选择连接，业务行为必须继续走原 MCP bundle。

完整 VS Code 命令覆盖关系见插件根目录 `assets/feature-matrix.json`。
