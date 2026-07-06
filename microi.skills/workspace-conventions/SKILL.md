---
name: workspace-conventions
description: Microi 工作区全局约定。用于在本工作区工作时，确保临时文件、生成产物和项目专属内容放在正确位置，不污染仓库根目录。
applyTo: "**"
---

# Microi 工作区全局约定

## 任务启动前 Skill 读取规则（强制）

AI 处理任何 Microi 低代码、V8、MCP、OpenClaw、采集引擎、前端、后端、UniApp、文档、测试或交付任务前，必须先按任务类型读取相关 `microi.skills/**/SKILL.md`。不能等到写代码或出问题后才补读。

- 通用任务至少读取本文件；涉及完整交付、MCP 建模、远端 V8、菜单、字段或生产数据时，同时读取 `microi-system-delivery`。
- 涉及采集引擎、浏览器 Worker、验证码、站点规则、导出产物时，同时读取 `spider-engine`。
- 涉及 V8 CRUD、SQL、上传下载、导入导出、菜单按钮、表单事件、前端页面或自动化测试时，继续读取对应专项 Skill。
- 最终交付说明必须能逐条对应用户编号需求；不得遗漏、合并或把仍可执行的需求写成“下一步继续”。

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

## Skills 通用化原则

编写或更新 `microi.skills/` 下的技能文档时，**不能加入特定项目名称、特定本地路径或特定业务规则**，必须保持通用性：

- ❌ 不允许：`d:\Work\microi.net.all\AI-Project\数字经济商城\mci.lsg.uniapp`
- ❌ 不允许：`乐闪购`、`任亿` 等客户/项目名称
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

## 配置文件说明中文优先规则

AI 新增或修改 Microi 配置文件时，凡是面向开发者、部署人员或用户阅读的自然语言描述，默认必须写中文。适用范围包括 `appsettings*.json`、`docker-compose*.yml`、`launchSettings.json`、`*.example`、安装脚本注释、部署说明和示例配置。

- `Description`、`Important`、`EnvironmentVariables` 的说明文字、JSON/YAML 注释、示例说明、字段说明默认使用中文。
- 字段名、环境变量名、枚举值、路由、类名、方法名、包名、协议名等标识符保持原始英文，不要为了中文化而破坏程序读取。
- 如果配置面向海外交付，才可以在中文说明后补充英文括注；不要整段只写英文。
- 修改配置说明后，必须确认 JSON/YAML 仍可解析，不能因为中文标点或注释方式导致配置文件失效。

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
- 菜单按钮可使用 `RunBackground` / `BackgroundTask` / `IsBackgroundTask` 配合 `ApiEngineKey` 启动后台任务；接口引擎内用 `V8.Method.UpdateBackgroundTask` 上报进度。
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

`Microi.VSCode` 发布时会通过 `bump-version.js` 自动自增插件版本，并把 `microi.skills/.microi-skills-version.json` 中的 skills 发布版本写成同一个插件版本号；skills 不再独立自增。skills 同步到工作区时仍以每个文件的 hash 判断是否可覆盖：本地未改过的旧插件文件可自动升级，本地已修改的文件必须保留用户版本，不得仅凭版本号覆盖。

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

普通本地启动默认不要额外设置 `ASPNETCORE_ENVIRONMENT` 或 `DOTNET_ENVIRONMENT`；如果这些变量已由 `launchSettings.json`、`launch.json`、终端环境或测试脚本显式设置，`.microi-local` 不会覆盖它们。访问地址通常是 `https://localhost:7266`，实际监听配置来自 `Microi.Server/Microi.net.Api/Properties/launchSettings.json` 的 `Microi.net.Api` profile。

**本地后端自动重启要求（强制）**：本地联调需要启动或重启 `Microi.net.Api` 时，AI 允许自动定位并停止占用 `7266` 的本项目 `Microi.net.Api`/`dotnet` 进程，然后在 `Microi.Server/Microi.net.Api` 目录执行 `dotnet run --launch-profile Microi.net.Api`。优先使用用户能在 VS Code 中看到和停止的终端（包含 VS Code 集成终端、VS Code 任务终端、用户明确允许的 VS Code 可追踪隐藏终端）；如果当前工具没有 VS Code 终端能力，允许使用本机可见的 `cmd`/PowerShell 窗口启动，禁止使用脱离用户可见窗口的后台服务或守护进程。若 `7266` 实在无法释放，允许临时启动 `7267`，并同步把本地 `Microi.Client/src/config.json` 的 API 地址改到 `https://localhost:7267`；任务结束前必须说明端口变更。不要误杀数据库、Redis、Node 前端或其它业务进程。

## 本地租户与测试凭据读取约定

AI 在本地启动后端、跑 Playwright、做登录态页面截图或调用需要登录的接口前，必须先尝试从本地配置判断租户和测试账号，不要直接以“未登录无法测试”结束：

1. 读取 `Microi.Server/Microi.net.Api/.microi-local`，得到当前环境名，例如 `<Environment>`。
2. 读取 `Microi.Server/Microi.net.Api/appsettings.<Environment>.json`，或测试脚本传入的 `PW_APPSETTINGS_PATH`。
3. 从 `DevLoginBypass.Accounts` 中按 `OsClient` 匹配账号密码；没有匹配时使用 `DevLoginBypass.DefaultAccount` / `DefaultPassword`。
4. 如果环境变量 `MICROI_OSCLIENT`、`PW_OS_CLIENT`、`PW_TEST_ACCOUNT`、`PW_TEST_PASSWORD` 已显式设置，以环境变量为准。
5. `appsettings.*.json`、`.microi-local`、Token、数据库连接串、Redis 密码都视为本地敏感配置。可以读取并用于自动化，但最终回复、日志摘要和测试报告中不得输出真实值，只能写 `<redacted>`、`本地配置账号` 或 `本地配置凭据`。

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
- MCP 的初始化说明必须使用真实 `MICROI_OS_CLIENT` 作为租户边界，`MICROI_LABEL` 只能作为显示名称，不能把中文显示名当成租户 Key 写入“只能管理某租户”的安全提示。
- 修复 Microi.VSCode 插件的 MCP 生成逻辑后，必须重新生成配置、重启对应 MCP server，并在当前 AI 会话中再次验证工具发现与一次只读工具调用。

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

1. 先执行后端编译验证。若 7266 正在运行导致 `bin/Debug/net10.0` DLL 被锁，可以先停止当前 `Microi.net.Api` 进程后重新编译；只有用户明确要求不中断正在运行服务时，才允许用临时输出目录作为补充验证，并必须说明运行服务尚未替换。
2. 查找并停止占用 `https://localhost:7266` 或 `http://localhost:7266` 的本地 `Microi.net.Api` 进程。只停止 Microi 后端相关进程，不要误杀数据库、Redis、Node 前端或其它业务进程。
3. 必须进入 `Microi.Server/Microi.net.Api` 目录启动：
   ```powershell
   dotnet run --launch-profile Microi.net.Api
   ```
   启动优先发生在用户能在 VS Code 中看到和停止的终端中，方便用户查看日志并手动停止；用户明确允许时，可以使用 VS Code 可追踪的隐藏终端/任务终端。当前工具环境没有 VS Code 终端能力时，允许使用本机可见的 `cmd`/PowerShell 窗口启动；禁止使用脱离用户可见窗口的后台服务或守护进程方式启动。若 `7266` 无法释放，允许临时使用 `7267`，并同步修改本地 `Microi.Client/src/config.json` 指向新端口。
4. 启动后轮询验证 `https://localhost:7266` 或 launch profile 实际地址可访问；至少确认端口已监听、进程存在、最近日志没有立即崩溃。涉及新增 API 时，再调用新增/受影响接口做一次真实请求。
5. 最终回复必须明确说明：后端已重新编译、旧进程 PID 是否停止、新进程 PID、7266 是否监听、验证的 URL 或接口。若因为用户明确要求不中断、端口被非 Microi 进程占用或配置缺失导致无法重启，必须把阻塞原因说具体。

这条规则优先于“避免打断正在运行服务”的默认谨慎策略；本地开发联调场景下，用户通常需要运行中的 7266 后端加载最新代码。

## MCP 可调用性诊断补充

当用户反馈“Codex/VS Code 设置中能看到 MCP，但当前 AI 会话不能调用对应工具”时，不能只回答“当前会话没有注入”。必须按层排查：

1. 先确认 `.vscode/mcp.json`、`.cursor/mcp.json`、工作区根 `.mcp.json` 和 `~/.codex/config.toml` 都能解析，且目标 server key 为稳定 ASCII 格式，例如 `microi_itdos`，不要使用中文名或横杠。
2. 再用 Microi.VSCode 插件的“诊断 MCP 可调用性”命令，或等价脚本直接启动对应 `mcp-server.js` / `mcp-codex-stdio-adapter.js`，执行 `initialize` 和 `tools/list`，确认 `microi_get_db_schema`、`microi_get_field_list`、`microi_add_field`、`microi_update_field`、`microi_refresh_schema_cache` 等核心工具真实返回。
3. 如果当前 AI 客户端支持工具发现或延迟加载，AI 必须先主动执行工具发现/热加载流程，例如 `tool_search`、客户端 MCP refresh、Microi.VSCode 的启动/诊断命令；不要先让用户手动重启、重载或重新生成 MCP。
4. 如果真实握手成功但 Codex 当前对话仍没有注入 `mcp__...` 工具，AI 仍应优先使用等价的 MCP stdio JSON-RPC 直连 fallback 完成当前任务：读取对应 MCP 配置、启动 adapter/server、执行 `initialize`、`tools/list`、`tools/call`，并严格遵守该 MCP 绑定的 API Server 和 OsClient 边界。直连脚本必须放在 `.tmp/` 或使用一次性 stdin，不得散落到项目目录。
5. 只有在客户端不支持热加载、直连 fallback 也无法完成任务，或写操作边界无法确认时，才告知用户需要新开对话、重载 Codex 或检查 MCP 配置。说明必须写清楚：MCP 配置和进程是否可用、当前会话为什么没有注入工具、已经尝试过哪些自动恢复动作。
6. 如果握手失败，要把失败层级说清楚：配置文件解析失败、路径不存在、token 文件缺失、MCP 进程启动失败、`initialize` 失败、`tools/list` 缺核心工具，不能把这些问题混成“用户没启用 MCP”。
7. Microi.VSCode 生成 MCP 配置时应清理旧的中文/横杠 Microi MCP key，只保留 `microi_<osClient>` 或 `microi_<osClient>_<host>` 形式，避免不同 AI 客户端因 namespace 不稳定而无法注入工具。
