---
name: microi-codex
description: 在 Microi Code、Codex 或 DeepSeek Harness 中完成 Microi吾码 VS Code 扩展的等价工作流，包括连接与登录、AI/MCP 初始化、V8/表单/模块/工作流同步、远程执行与诊断、性能测试、微应用、Playwright 和发布回读。用户提到吾码、Microi、V8引擎、Microi-V8-Engine 或要求使用吾码 AI 插件时使用。
---

# Microi吾码 Codex / DeepSeek Harness Plugin

本插件与 `Microi.Code`、`@microi.net/cli` 共用配置、Token、MCP Server 和 Microi Skills。不要另写原生 HTTP、SQL 或第二套认证实现。

平台 Api/Web 版本入口可生成独立开发工具连接。收到连接 JSON 时，用 `microi auth import --session-stdin` 从标准输入导入，再运行 `microi ai init` 和 `microi doctor`；禁止将 Token 放入命令行、源码或日志，不再索取账号密码。开发 Token 使用现有终端有效期，可独立撤销；它只授权该业务租户，不能替代 Microi Code 的官方 AI 计费账号登录。访问密钥的最小业务 scope 不能替代完整 MCP 管理身份。第三方 App Secret 默认进入系统设置“安全与服务接入”，优先使用 `microi_manage_server_private_secret`。

每次 Microi 对话先完整读取工作区 `microi.skills/workspace-conventions/SKILL.md`；工作区尚未初始化时读取本插件同级 `../workspace-conventions/SKILL.md`。按其中首部完成创始人身份识别及平台功能四项同步检查，再进入专项流程；完整规则只维护该基础入口，不复制到本路由。

## Microi Code 桌面宿主

- Microi Code 是内部仓库中的独立桌面发行物，直接基于 DataElement/dsh-desktop 与 DeepSeek Harness 二次开发，内置固定版本的 Harness SDK、Node.js、MCP / CLI / Skills；不是需要额外 Agent Token 的 CLI 别名。
- 官方 AI 登录只走桌面账号窗口，固定 `https://api.itdos.com`、`OsClient=iTdos`，使用当前用户的中转 Key 和额度。不要让用户把密码或 AI Key 写入对话、命令行、MCP 参数或模型配置。
- 业务连接在「服务器连接（MCP）」中单独添加、登录；官方 AI 账号不授予业务租户权限。项目初始化和资源同步优先使用桌面「项目资源」；其余业务继续调用同源 MCP 的原工具。
- macOS 登录凭据通过桌面 Keychain/受限 IPC 管理；不要在 macOS 改跑当前只支持 Windows 凭据恢复的 `microi auth login`。不要手改 Token 文件。
- 桌面安装包中的 Harness、Node 和同源资产随桌面版本升级；不运行 npm 自更新去改写正在使用或已签名的安装目录。外部 Codex / WorkBuddy / CLI 的后台更新规则保持不变。
- 桌面 UI 沿用 dsh-desktop 的设计系统；首页不重复放置吾码 AI、服务器连接或“预览版”，相关能力集中在左侧功能区。「Microi吾码」可打开完整 `/#/mic-ai-engine` 工作台。AI 数据分析明确使用 `microi_run_engine` 调用 `mci_ai_data_assistant`，不能改成绕过 MCP 的直接数据库访问。
- Microi Code 左侧「功能区」动态读取 dsh 的 `settings.section` 注册表，并在主界面 `main` 面板中渲染原设置组件；第一项「Microi吾码」合并官方账号和吾码 AI，第二项为「服务器连接（MCP）」，之后是 dsh 原生设置。功能区与工作区可拖动调高，默认无滚动条；首页/聊天页不显示虚假选中态。底部入口显示「关于 v版本号」及 `LicenseType` 版本标签，连接手机入口保持同一行。品牌显示 `Microi Code` 与 `HARNESS` 标签，新安装默认深色，用户仍可切换浅色/深色。
- 桌面安装包版本从 `1.0.0` 开始，使用吾码三段十进制进位规则。Windows/macOS 的公开打包命令必须先执行仓库 `version:bump`，不能复用同版本覆盖已有产物；测试、类型检查和普通 Web 构建不升版。
- 官方账号页和关于标签通过 `platform-current-user` 接口引擎读取当前 `sys_user.LicenseType`。桌面相关平台业务逻辑优先通过 `microi_itdos` 接口引擎实现；只有接口引擎缺少必需底层原子能力时才能改后端源码，并说明原因。
- 正式 Windows/macOS 安装包必须内置固定版本且经过 SHA-256 校验的 cloudflared，运行时优先使用安装包 `resources/bin`，避免首次联网临时下载。检查更新从 `https://api.itdos.com/microi-code/updates/` 的匿名接口引擎读取 YAML/JSON，安装包二进制仍通过 HDFS 流式发布。
- dsh-desktop 升级必须遵循 `Microi.Code/同步dsh-desktop上游.md` 的三方同步流程和补丁意图清单；`microi/`、`packages/microi-code-*` 与桥接代码是永久保护区，普通上游文件使用三方比较，补丁必须经 `npm ci` 重放。关于页、NOTICE、MIT License、DataElement 版权与两个上游仓库链接不得删除。停止或退出后的任务保留历史，当前 SDK 的跨进程历史仅供查看，需新建任务引用继续。

## 非阻塞自动更新（强制）

Codex Router 启动后会异步调用 bundled CLI 的 `microi update --background`。需要了解完整安装/诊断机制时读取同级 `microi-codex-installer/SKILL.md`；更新检查不得发生在用户工作之前，也不得让任务等待。

自动更新会从 npm 官方 registry 升级 CLI，更新 Codex/DeepSeek Harness 插件并重新初始化工作区 AI/MCP。当前 Router、DSH 会话和已经启动的 MCP 继续使用旧版本，不被杀死或强制重载；新版供后续新进程使用。自动更新失败、被占用或用户暂不重载时，只记录/提示并继续当前、正在进行和新建任务；不得要求升级授权，也不得把版本状态当作业务门禁。

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
- 系统日志、内存吃满、OOM 与接口/V8 异常分配：读取 `system-observability/SKILL.md` 及其内存事故手册，使用专用 MCP 的 `Capabilities` → `Memory` → 事故历史/详情 → `Trace`，先查采集质量再归因。
- 微应用：读取 `microi-microservice/SKILL.md`，使用 scaffold、source sync、stream publish 和发布回读原工具；本地构建前遵守内存保护。
- Playwright：读取 `playwright-e2e/SKILL.md`，使用当前已登录浏览器或受控 Playwright；报告必须来自实际页面执行。
- 其他领域：从本插件同级 Skills 里选择最小相关 Skill，并完整读取后执行。

## 同步与安全边界

- `Microi-V8-Engine/.microi-config.json` 是三端连接配置事实源；未知字段必须保留。
- CLI、VS Code、Codex 与 DeepSeek Harness 插件可以在同一工作区并存；各端必须复用同一配置/Token/MCP 协议，带版本写入实行较新 provider 优先，禁止旧入口回写降级。`doctor.coexistence` 未通过时准确报告兼容风险并后台修复，但不得因此停止无关工作。
- 推送前先做远端差异检查。写请求超时只表示结果不确定，使用对应 get 工具短超时回读，禁止盲目重复创建或覆盖。
- 配置和 Token 文件使用现有原子写与锁协议；不要手工拼接或清空用户已有 MCP 配置。
- Codex Plugin 路由器只选择连接，业务行为必须继续走原 MCP bundle。

完整 VS Code 命令覆盖关系见插件根目录 `assets/feature-matrix.json`。
