---
name: playwright-e2e
description: 按 Microi 系统真实业务逻辑进行 Playwright 全自动化、全面测试。用于测试 PC Vue、本地多 ApiBase/OsClient 独立浏览器上下文、远端运行目标识别、前端微服务菜单切换与 keep-alive/LRU、uni-app H5、网站、界面引擎、移动商城、ApiEngine/FormEngine 契约、登录流程、写入闭环、网络防护、截图、报告和 Playwright Test for VSCode 集成。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi 吾码 Playwright E2E 自动化测试

> **2026-05 更新（重要）**：Microi.VSCode 插件生成的所有 E2E 产物现已统一隔离到 `<projectRoot>/.microi-e2e/` 目录，**不再**写入 `tests/e2e/`、根目录 `playwright.config.js` 或 `.env.e2e.example`。
> - `playwright.config.js` 位于 `.microi-e2e/playwright.config.js`，`testDir` 为 `./` （即 `.microi-e2e/specs/`）
> - 报告路径 `.microi-e2e/report/`，截图 `.microi-e2e/screenshots/`
> - 上下文 `.microi-e2e/.microi-playwright-context.json`
> - 本文档下方仍有大量 `tests/e2e/...` 写法，均为历史风格示意，**实际生成路径以 `.microi-e2e/` 为准**。手写测试（如 `tests/blueprint-e2e.spec.mjs`）不受影响。

`E2E` 是 `End-to-End`，中文通常叫"端到端测试"。它强调从用户入口开始，穿过前端页面、接口引擎、表单引擎、权限、缓存、数据库等真实链路，验证一条业务路径是否真的可交付。

<!-- microi-progressive:begin -->
<!-- microi-progressive:chunk id=playwright-e2e-000 sha256=f04614f276c139cfa50b9e46e89857675c6dc5e7cf0cfbfde76d6e6dbe9746c9 -->
## 是否需要 `-e2e` 后缀

建议保留 `playwright-e2e` 这个 skill 名称。

- Playwright 也能做接口测试、组件测试和截图巡检，但在 Microi 中最关键的价值是“像真实用户一样跑通低代码系统”。
- `-e2e` 能让 AI 明确区分它和 `v8-debugging`、`v8-crud-api`、`playwright-ct` 等其他能力。
- 如果未来要补更细的能力，可以新增 `playwright-api` 或 `visual-regression`，不要把当前 skill 改成泛泛的 `playwright`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-001 sha256=703786ae7a5a52cb39664f1c82de7fb7aa7dfece511046d3757da64918c23063 -->
## 适用范围

- PC 管理端：`Microi.Client`、租户后台、运营后台。
- uni-app H5：移动商城、会员中心、H5 工作台。
- Page Engine 页面：大屏、仪表盘、官网页面。
- 接口引擎验收：直接用 Playwright `request` 调 `/apiengine/{ApiEngineKey}`。
- 交付冒烟：登录、主导航、核心业务流、退出登录、关键页面截图。

不适合把 Playwright 用来替代 V8 单函数调试。单个接口引擎的入参输出优先用 VS Code 插件远程执行、MCP `microi_run_engine` 或后端单元测试。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-002 sha256=a2524636727c51268a2daefdd617e5b90e105e245143b652bc095ac857ad4995 -->
## 临时文件与产物放置规则（必须遵守）

AI 在工作区内生成的**一次性临时脚本、诊断文件、截图、测试报告**等，**绝对不能放在工作区根目录**，必须放在以下指定位置：

| 类型 | 放置位置 |
|------|---------|
| 一次性 Python/JS/PS1 脚本 | `<workspace-root>/.tmp/` |
| 诊断截图、调试输出 | `<workspace-root>/.tmp/screenshots/` 或子目录 |
| E2E 测试产物（Microi.VSCode 插件生成） | `<workspace-root>/.microi-e2e/` |
| AI 一次性 Playwright 脚本、截图、日志、报告 | `<workspace-root>/.tmp/`、`<workspace-root>/.tmp/screenshots/`、`<workspace-root>/.tmp/reports/` |
| 性能测试报告 | `<workspace-root>/.microi-performance/`（仅限此目录） |

**禁止在根目录创建的文件类型**：`*.mjs`、`*.py`、`*.ps1`、`*.sh`（一次性脚本）、`*.png`、`screenshots/`、`node_modules/`（无 package.json 时）、`obj/`（非 .NET 项目文件）、`dark-mode-*/`、`test-*/` 等临时目录。

`.tmp/` 目录已在 `.gitignore` 中排除，AI 可以在此自由创建临时文件。任务完成后如无价值可以不清理，也可以整体删除该目录。

**2026-06 强制补充**：AI 手写的一次性 Playwright 验证脚本、运行日志、截图和报告只能写到工作区根目录 `.tmp/`。不要写到 `Microi.Client/`、`Microi.Server/`、`microi.doc/` 或其它子项目目录，即使这些目录已有 `tests/` 目录也不例外。只有 Microi.VSCode 插件正式初始化的可复用 E2E 工程，才使用 `.microi-e2e/`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-003 sha256=69b8842a221a0de60f8605c5059deee391be0f16f0b6cbc5ddfb3cfd210268db -->
## 标准目录

前端项目中推荐使用 `tests/e2e`，而不是根目录 `e2e`，这样能和单元测试、组件测试并列。

```text
<frontend-project>/
  playwright.config.js
  tests/
    e2e/
      helpers/
        microi.js
      specs/
        auth.spec.js
        smoke.spec.js
        <business-flow>.spec.js
      screenshots/
      report/
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-004 sha256=2f145cd29044043fb84cefd07fde14c86a4d0f4757443d56e75f5494516453cb -->
## 必备环境变量

```bash
PW_BASE_URL=http://127.0.0.1:5180
PW_API_BASE=https://api.example.com
PW_OS_CLIENT=demo
PW_WEB_SERVER_COMMAND="npm run dev:h5 -- --host 0.0.0.0 --port 5180"
PW_WEB_SERVER_URL=http://127.0.0.1:5180
PW_BROWSER_CHANNEL=msedge
```

常用业务变量：

```bash
PW_LOGIN_ENGINE=member_login
PW_TEST_ACCOUNT=<从本地配置读取或用环境变量覆盖>
PW_TEST_PASSWORD=<从本地配置读取或用环境变量覆盖>
PW_HOME_PATH=/#/pages/index/index
```

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-005 sha256=a66696c3263f060d0b7be309a527fca6a9bad95dd534eabbe84f1b6539770d8e -->
## 本地测试账号自动发现

当没有显式传入 `PW_TEST_ACCOUNT` / `PW_TEST_PASSWORD` / `MICROI_OSCLIENT` 时，AI 不要把账号密码写入后端配置来制造旁路：

1. 读取 `Microi.Server/Microi.net.Api/.microi-local`，取得当前环境名。
2. 账号密码只从用户本轮明确提供、`PW_TEST_ACCOUNT` / `PW_TEST_PASSWORD`、CI Secret 或既有受保护登录态取得；`appsettings.*.json` 不再保存测试账号密码。
3. 这些值只作为自动化进程的登录输入或接口请求参数使用。日志、最终回复、截图说明、报告和异常消息中必须写成 `<redacted>` 或“本地配置凭据”，不要展开真实账号密码、Token、连接串或 Redis 密码。
4. 如果凭据不存在或登录失败，再报告具体阻塞点，例如“未提供受保护测试凭据”“本地后端未启动”“登录接口返回 Code=0”，不要泛泛说无法测试。

### 跨 ApiBase / OsClient 本地自动化（强制）

1. 复用工作区唯一的 `61500` Vite 服务，但每组 `ApiBase + OsClient` 创建独立
   `browser.newContext()`；禁止在同一个 context 的多个 Page 中混测不同租户。
2. 本地入口固定把参数放在 `#` 前：
   `http://localhost:61500/?OsClient=${encodeURIComponent(osClient)}&ApiBase=${encodeURIComponent(apiBase)}#/route`。
   URL 参数应覆盖 `index.html`、`src/config.json`、Pinia 和 localStorage。
3. 页面初始化后读取 `window.__MICROI_RUNTIME_ENDPOINT__`，断言实际 ApiBase/OsClient 与测试目标
   完全一致再登录或点击业务。该对象不得包含 Token。
4. 从线上地址复现时，先在一次性独立 context 读取上述对象；旧版回退到页面全局值、
   `localStorage['microi.net']` 和域名租户解析。不能根据标题猜租户，也不能复用线上 context 跑本地。
5. 人工第二租户至少使用无痕窗口；多个无痕窗口可能共享同一临时会话，更多并行目标使用独立
   Profile/`--user-data-dir`。自动化收尾只关闭自己创建的 context/browser。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-006 sha256=6aeefebda3a9e598564c53c2f8028a4ccefe2291c4c7c7ae4781ca15fb5d0697 -->
## 后端改动后的 E2E 前置动作

如果本轮任务修改过 `Microi.Server/**` 后端源码、配置、控制器、服务、依赖项目或接口行为，跑 Playwright、页面截图、接口验收或前后端联调前，必须先按 `workspace-conventions` 的“后端代码改动后的重启验收”完成：

1. 编译后端。
2. 停止旧的本地 `Microi.net.Api` 进程。
3. 在 `Microi.Server/Microi.net.Api` 目录用 `dotnet run --launch-profile Microi.net.Api` 重新启动。
4. 从 launch profile 回读实际地址（当前标准工作区为 `https://localhost:61501`），验证端口已监听并且进程未立即崩溃。

不要只说“代码已编译”或“需要用户自己重启后端”；除非用户明确要求不要中断当前服务，否则 AI 要主动完成重启。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=playwright-e2e-007 sha256=8776ce89491f11cbf6c6e6e9ef0cd430aa21efc60c1dbe1559ec9e905c5d0a9e -->
## 服务自启动纪律（必做）

执行自动化测试、截图巡检、接口引擎回读、`/apiengine/{key}` 验收时，如果本地后端或前端不可达，不能把 `fetch failed`、`ECONNREFUSED`、`000 Failed to connect`、端口无人监听当作任务终点。必须先自动启动所需服务，再继续完整验证。

同一工作区有多个 AI 对话时，服务自启动还必须遵守共享生命周期：

- 先检查 `.tmp/microi-process-state/release.lock`。发布锁存在时禁止 Playwright `webServer`、
  自愈脚本或 AI 重新抢占 `61500/61501`；等待发布结束后重新检查。
- 端口健康且 PID/命令行属于当前工作区时直接复用，不得每个对话都无条件“先杀再启动”。
  必须重载源码时才串行重启，并在状态播报中说明旧/新 PID。
- 本地长期后端使用项目目录中的 `dotnet run --launch-profile Microi.net.Api`，禁止把
  `bin/Release/net10.0` 或 `bin/Release/publish` 的 DLL 作为长期测试服务，否则会锁住
  一键发布的 Release 输出。
- 一次性测试要关闭自己创建的 browser/context 和临时 webServer。VS Code 持有的
  `playwright test-server` 与用户 Edge/Chrome 不属于孤儿清理；禁止按进程名结束所有
  `node/dotnet/chrome/msedge`。
- 只读盘点或精确停止使用 `Microi.Server/tools/Microi.LocalProcessManager.ps1` 的
  `Status`、`StopBackend`、`StopFrontend`，不能让用户在任务管理器里猜 PID。

默认本地后端：

```powershell
Push-Location Microi.Server/Microi.net.Api
dotnet run --launch-profile Microi.net.Api
Pop-Location
```

普通本地启动不要手动设置 `ASPNETCORE_ENVIRONMENT` / `DOTNET_ENVIRONMENT`；后端会读取 `Microi.Server/Microi.net.Api/.microi-local`，再加载对应的 `appsettings.{Env}.json`。如果测试脚本显式注入环境变量，则以脚本注入为准。

默认 PC 前端：

```powershell
Push-Location Microi.Client
npm run dev -- --host 0.0.0.0 --port 61500
Pop-Location
```

uni-app H5 或移动端前端按项目自身命令启动，例如 `npm run dev:h5 -- --host 0.0.0.0 --port 5192` 或测试配置里的 `PW_WEB_SERVER_COMMAND`。如果目标测试同时依赖 PC 管理端和移动 H5，需要分别启动对应前端；不要用一个前端服务替代另一个业务入口。

执行顺序：先检查端口/健康接口是否可达；不可达则用后台终端启动；等待服务输出监听地址；再重试接口同步、页面打开、Playwright 截图和断言。只有启动命令失败、缺少依赖、数据库连接失败、端口冲突无法自动换端口且无替代配置时，才算真正阻塞，并且要报告具体失败命令和错误。

<!-- /microi-progressive:chunk -->
## 详细参考路由（渐进披露）

### 菜单微服务生命周期验收（强制）

菜单型 MicroService 使用 `runtime-keep-alive` 单一缓存所有者。E2E 必须覆盖至少 3 条子路由连续切换 8 轮，确认返回后状态仍在、页面无永久骨架屏或空白；继续打开第 6 个实例，确认 LRU 只淘汰最久未使用的隐藏实例。还要观察 `appstate-change`：`afterhidden` 后后台任务应暂停，`aftershow` 后应幂等恢复；关闭 Tab、关闭其它/全部以及退出登录后，对应运行时必须被销毁。

仅在当前任务涉及对应主题时读取；下列文件合计保留了原 SKILL.md 的全部详细知识。

- [references/progressive-01-全自动登录-免验证码-但不免密码-必读.md](references/progressive-01-全自动登录-免验证码-但不免密码-必读.md)：全自动登录（免验证码，但不免密码）——必读；表单引擎卡死/递归更新全自动化诊断；移动端视觉与资源验收；测试证据必须绑定需求编号；移动端/H5 回归纪律
- [references/progressive-02-文字对比度与可读性自动化检查-必做.md](references/progressive-02-文字对比度与可读性自动化检查-必做.md)：文字对比度与可读性自动化检查（必做）；安装；playwright.config.js 模板
- [references/progressive-03-microi-helper-模板.md](references/progressive-03-microi-helper-模板.md)：Microi helper 模板；典型用例；Microi 专属测试策略；最少冒烟集；完整业务验收门槛；与 MCP 的配合；与 VS Code 插件的配合
- [references/progressive-04-ci-建议.md](references/progressive-04-ci-建议.md)：CI 建议；常见问题；前端微服务 E2E 必测点；动态模块按钮验收
<!-- microi-progressive:end -->
