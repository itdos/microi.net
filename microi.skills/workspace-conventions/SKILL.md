---
name: workspace-conventions
description: Microi 工作区全局约定。Use when working in this workspace to ensure temp files, generated artifacts, and project-specific content are placed correctly and do not pollute the repository root.
applyTo: "**"
---

# Microi 工作区全局约定

## 临时文件与 AI 产物放置规则（强制）

AI 在工作区任意任务中生成的**一次性临时脚本、诊断文件、测试截图、临时报告**，**严禁放在工作区根目录（`d:\Work\microi.net.all\`）**，必须放在指定位置：

| 类型 | 指定位置 |
|------|---------|
| 一次性脚本（.py / .mjs / .ps1 / .sh） | `.tmp/` |
| 诊断截图、调试图片 | `.tmp/screenshots/` |
| E2E 测试产物（Microi.VSCode 插件生成） | `.microi-e2e/` |
| 前端项目 E2E 截图/报告 | `<前端项目>/tests/e2e/screenshots/` 和 `/report/` |
| 性能测试 HTML 报告 | `.microi-performance/` |
| 项目专属临时文件 | `<对应子项目目录>/` 内，不要写到根目录 |

**严禁在根目录创建**：
- 任何 `*.mjs`、`*.py`、`*.ps1`、`*.sh` 一次性临时脚本
- 任何 `screenshots/`、`dark-mode-*/`、`test-*/`、`debug-*/` 临时目录
- 孤立的 `node_modules/`（根目录没有 `package.json`，不应安装 npm 包）
- 孤立的 `obj/`、`dist/`、`build/`（非对应项目文件）

`.tmp/` 已在 `.gitignore` 中排除，可以随意创建临时文件。任务完成后如无保留价值可以不清理。

## Skills 通用化原则

编写或更新 `microi.skills/` 下的技能文档时，**不能加入特定项目名称、特定本地路径或特定业务规则**，必须保持通用性：

- ❌ 不允许：`d:\Work\microi.net.all\AI-Project\数字经济商城\mci.lsg.uniapp`
- ❌ 不允许：`乐闪购`、`任亿` 等客户/项目名称
- ❌ 不允许：某项目特定的费率、字段名、接口 Key 作为"规范"
- ✅ 允许：使用 `<项目路径>`、`<OsClient>` 等占位符
- ✅ 允许：通用的最佳实践、模式和约定
- ✅ 项目特定规则应维护在各项目自己的目录内（如 `AI-Project/<项目>/` 或项目根的 `tests/`）

## Microi 版本号规则

Microi 通用版本号采用 `主版本.次版本.修订版本` 三段数字格式，从 `1.0.0` 开始。每次发布时最后一位加 1；当某一位超过 `9` 时向前一位进位并将当前位归 `0`，例如 `1.0.9 -> 1.1.0`、`1.9.9 -> 2.0.0`。

`Microi.VSCode` 发布时会通过 `bump-version.js` 自动自增插件版本和 `microi.skills/.microi-skills-version.json` 中的 skills 发布版本。skills 同步到工作区时仍以每个文件的 hash 判断是否可覆盖：本地未改过的旧插件文件可自动升级，本地已修改的文件必须保留用户版本，不得仅凭版本号覆盖。

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

普通本地启动默认不要额外设置 `ASPNETCORE_ENVIRONMENT` 或 `DOTNET_ENVIRONMENT`；如果这些变量已由 `launchSettings.json`、`launch.json`、终端环境或测试脚本显式设置，`.microi-local` 不会覆盖它们。访问地址通常是 `https://localhost:7266`，实际监听配置来自 `Microi.Server/Microi.net.Api/Properties/launchSettings.json` 的 `Microi.net.Api` profile。

## DevLoginBypass 多租户约定

当本地 E2E/API 自动化需要对多个租户免验证码登录时，在当前生效的 `appsettings.{Environment}.json` 中配置 `DevLoginBypass:Accounts`：

```json
"DevLoginBypass": {
  "Enabled": true,
  "SkipCaptcha": true,
  "OnlyLoopback": true,
  "DefaultAccount": "admin",
  "DefaultPassword": "<default-password>",
  "Accounts": [
    { "OsClient": "<tenant-a>", "Account": "<account>", "Password": "<password>" },
    { "OsClient": "<tenant-b>", "Account": "<account>", "Password": "<password>" }
  ]
}
```

本地旁路配置必须保留 `OnlyLoopback=true`。自动化脚本可传 `Pwd="_DEV_BYPASS_"`，API 应按请求的 `OsClient` 替换为配置密码后继续走真实密码校验。不要把具体项目租户名或密码写进 skill；真实值只放环境配置文件。

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

## V8 缓存刷新约定

如果 AI 绕过平台表单提交事件，直接通过 MCP、数据库脚本或自写同步工具更新 `sys_apiengine`、`diy_table`、`diy_field`、`sys_menu`、`wf_node` 等远端 V8 代码，收尾时除了同步本地文件，还必须刷新运行中服务的缓存。至少清理当前 `<OsClient>` 下对应资源的 `Microi:<OsClient>:FormData:<table>:<key>`、`Id` 和地址形式缓存；若可用，优先调用平台缓存接口或插件内置同步流程。清缓存后要重新调用受影响接口做一次真实验证，避免本地/远端代码已一致但 API 仍执行旧缓存代码。

## .venv Python 环境说明

工作区根目录的 `.venv/` 是 Python 虚拟环境，**保留，不要删除**。已安装：
- `playwright` — Playwright E2E 测试
- `openai` — AI 接口调用
- `httpx` — HTTP 客户端
- 其他工具（flake8、pytest 等）

AI 执行 Python 脚本时应使用 `.venv\Scripts\python.exe`（Windows）而非系统 Python。
