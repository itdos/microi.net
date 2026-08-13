---
name: microi-codex
description: 在 Codex 中完成 Microi吾码 VS Code 扩展的等价工作流，包括连接与登录、AI/MCP 初始化、V8/表单/模块/工作流同步、远程执行与诊断、性能测试、微应用、Playwright 和发布回读。用户提到吾码、Microi、V8引擎、Microi-V8-Engine 或要求使用吾码 Codex 插件时使用。
---

# Microi吾码 Codex Plugin

本插件与 `Microi.VSCode`、`@microi.net/cli` 共用配置、Token、MCP Server 和 Microi Skills。不要另写原生 HTTP、SQL 或第二套认证实现。

## 非阻塞自动更新（强制）

Codex Router 启动后会异步调用 bundled CLI 的 `microi update --background`。需要了解完整安装/诊断机制时读取同级 `microi-codex-installer/SKILL.md`；更新检查不得发生在用户工作之前，也不得让任务等待。

自动更新会从 npm 官方 registry 升级 CLI，更新 Codex 插件并重新初始化工作区 AI/MCP。当前 Router 和已经启动的 MCP 继续使用旧版本，不被杀死或强制重载；新版供后续新进程使用。自动更新失败、被占用或用户暂不重载时，只记录/提示并继续当前、正在进行和新建任务；不得要求升级授权，也不得把版本状态当作业务门禁。

## 先确认工作区连接

1. 调用 `microi_codex`，传 `{ "action": "profiles" }`。
2. 只有一个已登录连接时，后续可以省略 `profile`；存在多个连接时，始终传 `profiles` 返回的稳定 `name`。
3. 尚未初始化时，插件根目录是本文件向上两级；使用其中的 `scripts/microi-cli.js`：
   - `node <plugin-root>/scripts/microi-cli.js init --workspace <workspace>`
   - 多连接：`profile list|add|remove`
   - 登录：`auth login|status|logout --profile <name>`
   - 诊断：`doctor --json`
4. 登录会在真实终端中隐式输入密码；不要把密码写入命令、日志、Skill、MCP 参数或任何明文文件。Windows 工作区把自动续登凭据以当前用户 DPAPI 加密后写入 `Microi-V8-Engine/.microi-workspace-secrets.dpapi.json`，MCP 配置只传保险库路径和非敏感 Key 名；Token 继续写入同目录 `.microi-mcp-tokens.json`，并按 API、OsClient、Type、Network 四段身份隔离。两个文件都必须加入本地 Git exclude。

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
- CLI、VS Code 插件与 Codex 插件可以在同一工作区并存；三者必须复用同一配置/Token/MCP 协议，带版本写入实行较新 provider 优先，禁止旧入口回写降级。`doctor.coexistence` 未通过时准确报告兼容风险并后台修复，但不得因此停止无关工作。
- 推送前先做远端差异检查。写请求超时只表示结果不确定，使用对应 get 工具短超时回读，禁止盲目重复创建或覆盖。
- 配置和 Token 文件使用现有原子写与锁协议；不要手工拼接或清空用户已有 MCP 配置。
- VS Code/MCP Token 默认访问期为 20 天，租户显式配置仍优先。遇到“Token 签名验证失败”不能误报成到期：MCP 先重载工作区 DPAPI 保险库并对精确 Profile 自动续登，再原子更新 Token 与 MCP；保险库不存在或解密失败时才要求交互登录，且绝不打印帐号密码。
- 同一 `OsClient` 可以有 Product/Internal、Product/Internet 等运行记录，但 JWT 身份只绑定 `OsClient`，因此所有有效运行记录必须收敛为同一 `AuthSecret`。后端启动在加载 JWT 前执行 CAS 收敛；同版本冲突保留稳定的最早强密钥，只有可信后端写入新的唯一 `AuthSecretRotateVersion` 才表示显式轮换。禁止在后端更新时随机改密钥或按 Network 各自验签。
- Codex Plugin 路由器只选择连接，业务行为必须继续走原 MCP bundle。

完整 VS Code 命令覆盖关系见插件根目录 `assets/feature-matrix.json`。
