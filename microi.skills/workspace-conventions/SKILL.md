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

## .venv Python 环境说明

工作区根目录的 `.venv/` 是 Python 虚拟环境，**保留，不要删除**。已安装：
- `playwright` — Playwright E2E 测试
- `openai` — AI 接口调用
- `httpx` — HTTP 客户端
- 其他工具（flake8、pytest 等）

AI 执行 Python 脚本时应使用 `.venv\Scripts\python.exe`（Windows）而非系统 Python。
