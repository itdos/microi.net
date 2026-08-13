# workspace-conventions 详细参考 2

> 按需读取；本文件由 SKILL.md 的原章节无损拆分。

<!-- microi-progressive:chunk id=workspace-conventions-024 sha256=4e97c278d0a813e23c2c56b11aec8b157b2b100ed6f46ea07d45dbe9954ca5aa -->
## Microi.net.Api 本地启动约定

默认本地后端项目是 `Microi.Server/Microi.net.Api/Microi.net.Api.csproj`。AI 需要启动后端、验证接口、跑 Playwright、回读接口引擎或排查前后端联调问题时，优先使用下面的 PowerShell 命令：

```powershell
Push-Location Microi.Server/Microi.net.Api
dotnet run --launch-profile Microi.net.Api
Pop-Location
```

必须先进入 `Microi.Server/Microi.net.Api` 再启动。`Program.cs` 会在 `WebApplication.CreateBuilder(args)` 之前读取当前目录下的 `.microi-local`，将其中的环境名写入 `ASPNETCORE_ENVIRONMENT` / `DOTNET_ENVIRONMENT`，随后加载 `appsettings.{环境名}.json`。如果从仓库根目录直接运行并导致配置读取异常，先改用上面的 `Push-Location` 方式。

普通本地启动默认不要额外设置 `ASPNETCORE_ENVIRONMENT` 或 `DOTNET_ENVIRONMENT`；如果这些变量已由 `launchSettings.json`、`launch.json`、终端环境或测试脚本显式设置，`.microi-local` 不会覆盖它们。实际监听地址必须读取 `Microi.Server/Microi.net.Api/Properties/launchSettings.json` 的 `Microi.net.Api` profile；当前标准工作区是后端 `61501`、前端 `61500`，不能继续硬编码历史 `7266/1988`。

**本地后端自动重启要求（强制）**：本地联调需要启动或重启 `Microi.net.Api` 时，先检查 `.tmp/microi-process-state/release.lock`；发布锁存在时禁止启动或重启。无发布时先回读标准端口和 `/api/Diagnostics/liveness`，健康服务默认复用；只有本任务修改了需重载的后端代码、服务不健康或用户明确要求重启时，才可精确停止当前工作区的后端进程，然后在 `Microi.Server/Microi.net.Api` 目录执行 `dotnet run --launch-profile Microi.net.Api`。优先使用用户能在 VS Code 中看到和停止的终端（包含 VS Code 集成终端、VS Code 任务终端、用户明确允许的 VS Code 可追踪隐藏终端）；如果当前工具没有 VS Code 终端能力，允许使用本机可见的 `cmd`/PowerShell 窗口启动，禁止使用脱离用户可见窗口的后台服务或守护进程。不要误杀数据库、Redis、Node 前端或其它业务进程。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-025 sha256=07c3d729c8f1e9a2bf93ff00937e5d6eae4602d346e4f9254b03a33211ac4848 -->
## 多 AI 对话共享本地服务与发布互斥（强制）

同一工作区的 4、5 个 AI 对话共用同一份源码和固定端口时，`61500/61501` 是工作区级单例共享服务，不属于某个对话。端口相同意味着无法让每个对话拥有一套独立进程；正确模型是“复用健康服务 + 需要重载时串行重启 + 发布时独占”，不能让每个对话都无条件先杀再启动。

- 启动前先检查端口、健康接口、PID、命令行和工作区路径。健康且代码无需重载时直接复用；不得仅为声明“本对话拥有服务”而重启。
- 长期本地后端必须通过项目目录里的 `dotnet run --launch-profile Microi.net.Api` 使用开发输出。禁止把 `bin/Release/net10.0` 或 `bin/Release/publish` 的 `dotnet Microi.net.Api.dll` 当长期 E2E 服务；运行中的 Release DLL 会让后续 `dotnet build` 报 `MSB3021/MSB3027` 文件锁。
- 一键编译发布会创建 `.tmp/microi-process-state/release.lock`，并调用 `Microi.Server/tools/Microi.LocalProcessManager.ps1 -Action PrepareRelease`。它只结束命令行和工作区均匹配的 `61501` 后端、`61500` Vite 以及额外 Release 后端，并验证 Release DLL 可独占打开；遇到身份不匹配的端口占用必须停止，不得按进程名全杀。
- Vite 子进程可能由相对 `node_modules/vite/bin/vite.js` 启动，父 npm/终端退出后命令行不再包含工作区绝对路径。Windows 进程管理器应先匹配命令行绝对路径；无法匹配时只读回读进程 CWD，只有 CWD 精确等于当前工作区 `Microi.Client` 且入口确为 Vite 才可结束。CWD 无法读取、属于其它目录或仅仅“父进程不存在”时必须失败关闭。
- 发布锁存在期间，所有 AI 自动启动、服务自愈和 Playwright `webServer` 都必须等待或退出，禁止重新抢占 `61500/61501`。发布正常结束或中断时由脚本释放锁；无法证明锁持有者已退出时不得自行删除锁。
- Edge/Chrome 主浏览器、VS Code 持有的 Playwright Test Server、语言服务和 MCP Node 进程不属于发布文件锁清理范围。浏览器自动化必须关闭本用例创建的 context/browser；不得通过 `taskkill /IM chrome.exe|msedge.exe|node.exe|dotnet.exe` 清空整机进程。
- 人工盘点使用：`powershell -NoProfile -ExecutionPolicy Bypass -File Microi.Server/tools/Microi.LocalProcessManager.ps1 -Action Status`。需要单独停止当前工作区服务时使用 `-Action StopBackend` 或 `-Action StopFrontend`，不再让用户根据任务管理器猜进程。

### 共享前端服务不等于共享浏览器会话

多个 AI 对话可以复用同一个 `61500` Vite 进程，但不能复用同一个浏览器存储上下文测试不同
`ApiBase + OsClient`。`Microi.Client` 对 localhost 同源持久化 Token、CurrentUser、ApiBase、
OsClient 等状态；同一 Profile/Context 内切换租户会污染其它窗口。

- 本地 URL 的最高优先级参数位于 `#` 之前：
  `/?OsClient=<tenant>&ApiBase=<encodeURIComponent(apiBase)>#/route`。
- 手工第二个不同租户至少使用无痕窗口；多个无痕窗口可能共享同一临时会话，因此更多并发目标使用
  独立 Profile 或独立 `--user-data-dir`。
- Playwright/Codex 为每组目标创建独立 `browser.newContext()`，一个 context 内不得用多个 Page
  混测不同租户。只关闭本任务创建的 context/browser，不结束用户浏览器。
- 线上目标先在一次性 context 等待页面初始化并读取 `window.__MICROI_RUNTIME_ENDPOINT__`；旧版本
  回退读取 URL、`window.ApiBase/window.OsClient`、`localStorage['microi.net']`，必要时调用域名租户
  解析接口。不能根据站点标题猜 OsClient，也不能把 Token 放入本地 URL。
- 目标 API 还需允许 `http://localhost:61500` 的 CORS。运行目标识别、本地源码验证与线上部署验收
  分层报告。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-026 sha256=73207c0cfcc442a177c47c36503dd6145fc826e23e79df3913861f65d8d16df3 -->
## 本地租户与测试凭据读取约定

AI 在本地启动后端、跑 Playwright、做登录态页面截图或调用需要登录的接口前，必须先尝试从本地配置判断租户和测试账号，不要直接以“未登录无法测试”结束：

1. 读取 `Microi.Server/Microi.net.Api/.microi-local`，得到当前环境名，例如 `<Environment>`。
2. 读取 `Microi.Server/Microi.net.Api/appsettings.<Environment>.json`，或测试脚本传入的 `PW_APPSETTINGS_PATH`。
3. 测试账号密码只从用户本轮明确提供、受保护的测试进程变量 `PW_TEST_ACCOUNT` / `PW_TEST_PASSWORD`、CI Secret 或既有安全登录态取得；不得把凭据写入 `appsettings.*.json`、源码或测试报告。
4. `MICROI_OSCLIENT`、`PW_OS_CLIENT` 等只属于自动化工具进程，不是 API 生产环境变量；显式设置时可用于选择测试租户。
5. `.microi-local`、Token、数据库连接串、Redis 密码和测试凭据都视为本地敏感配置。最终回复、日志摘要和测试报告中不得输出真实值，只能写 `<redacted>`、`本地配置账号` 或 `本地配置凭据`。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-027 sha256=84988eac9cf7543a192b3e829b879afb7b35ef92798dc9ea69243f173a8ab674 -->
## 自动化登录约定

本地和远端 E2E 统一传真实 `Account` / `Pwd`。需要跳过图形验证码时，只能在目标租户 `sys_config.AutoTestSkipCaptcha=true` 后传 `_AutomationTestLogin=true`；它只跳过验证码，绝不能绕过密码校验。禁止恢复 `DevLoginBypass`、`X-Microi-Dev-Key`、`_DEV_BYPASS_` 或让脚本自动改写后端 `appsettings`。测试完成后不持久化账号密码。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-028 sha256=544ab4d52c661e65fb2b0364a3a2107815af366d719f0b1d1cde7b4837226458 -->
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

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-029 sha256=e90e532f9448b67f98f28a68fd4ea45b79868cf25fc14c5283b9074e91559f27 -->
## V8 缓存刷新约定

如果 AI 绕过平台表单提交事件，直接通过 MCP、数据库脚本或自写同步工具更新 `sys_apiengine`、`diy_table`、`diy_field`、`sys_menu`、`wf_node` 等远端 V8 代码，收尾时除了同步本地文件，还必须刷新运行中服务的缓存。至少清理当前 `<OsClient>` 下对应资源的 `Microi:<OsClient>:FormData:<table>:<key>`、`Id` 和地址形式缓存；若可用，优先调用平台缓存接口或插件内置同步流程。清缓存后要重新调用受影响接口做一次真实验证，避免本地/远端代码已一致但 API 仍执行旧缓存代码。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-030 sha256=c25d0aaffec64d8a66cda36acd9ec337eda99a4411fddb0e966e45247ba574de -->
## MCP 元数据更新验收约定

AI 通过 MCP 修改 `diy_field`、`diy_table`、`sys_menu`、`sys_osclients`、`sys_config` 等平台元数据后，不能只看写入返回成功，必须按前端真实消费方式回读验证：

1. 修改 `Select`、`Radio`、`Checkbox`、`MultipleSelect` 等选项组件时，必须回读字段的 `Component`、`Data`、`Config`。已有字段更新时不要假设 `"key|label"` 字符串会被 `microi_update_field` 自动解析；KeyValue 数据源推荐直接把 `Data` 写成 JSON 数组 `[{"Key":"Aliyun","Value":"阿里云机器翻译"}]`，并确保 `Config.DataSource=KeyValue`、`SelectLabel=Value`、`SelectSaveField=Key`。
2. 修改字段、表、菜单后，必须调用 `microi_get_field_list` / `microi_get_table_data` 回读关键字段，并调用 `microi_refresh_schema_cache` 或对应清缓存接口刷新 Redis。涉及 SaaS 引擎、系统设置、菜单按钮、接口引擎等运行态缓存时，还要调用对应租户清缓存接口并重新请求受影响页面/API。
3. 最终交付说明必须写清楚：改了哪个表/字段，回读值是什么，刷新了哪些缓存，验证入口是什么。若某个缓存刷新接口失败或只能部分成功，需要把失败消息原样摘要出来，不能把“写入成功”当作“页面一定生效”。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-031 sha256=3c25a4f5f2571612f6b441e88f4865f916aab0aed3cfe5d06a3be51a736dde0f -->
## MCP 可用性排查约定

VS Code、Cursor 或 Codex 设置界面显示某个 MCP 服务器“已启用”，不代表当前 AI 会话一定已经成功加载了对应工具。AI 在声称“可以通过 MCP 操作”之前，必须完成一次真实可调用性验证：

- 先用当前会话可用的工具发现能力查找目标 MCP 工具；若工具发现为 0，不能继续假设 MCP 可用。
- 再用 MCP 资源/模板列表或最小 `initialize` / `tools/list` 探测确认服务器握手成功。若返回 `handshaking with MCP server failed`、`initialize response`、`connection closed` 等错误，要明确说明“配置存在但当前会话不可调用”。
- 同时检查 `.vscode/mcp.json`、`.cursor/mcp.json`、`.mcp.json` 和 `~/.codex/config.toml` 是否能解析，并确认目标服务器名、`MICROI_API_URL`、`MICROI_OS_CLIENT`、`MICROI_TOKEN_FILE` 已写入。
- 如果手动启动 `mcp-server.js` 能响应，而当前 AI 会话仍握手失败，应优先怀疑 MCP stdio 协议兼容、初始化响应格式/大小、服务器进程提前退出或插件生成的 Codex 配置顺序问题，而不是简单归因于“用户没启用”。
- 当 MCP 工具数量较多时，`tools/list` 的前段必须优先返回通用建模和维护工具，例如 `microi_get_db_schema`、`microi_get_field_list`、`microi_add_field`、`microi_update_field`、`microi_refresh_schema_cache`、`microi_create_table`、`microi_create_module`、`microi_get_event_code`、`microi_save_event_code`。部分 AI 客户端或模型上下文只注入前若干个工具，若核心工具排在后面，会误报“缺少 MCP 工具”。
- MCP 的初始化说明必须使用真实 `MICROI_OS_CLIENT` 作为租户边界。中文显示名通过 ASCII 的 `MICROI_LABEL_BASE64` 传输并在 MCP 内解码，旧版 `MICROI_LABEL` 只作兼容；显示名不能当成租户 Key 写入“只能管理某租户”的安全提示。
- 遇到 `ByteString`、`greater than 255` 或“第 N 个字符无法写入 Header”时，必须先检查实际异常索引和所有 HTTP Header 来源。Microi MCP 的设备标识来自 `did` / `MICROI_MCP_DID`；默认值若直接拼接中文 Windows 主机名，会在 `MCP:` 后第 4 个字符报错。`MICROI_LABEL_BASE64` 只用于显示，不会作为业务 HTTP Header 发送，禁止在未核对调用链前把错误归因于中文 Label。插件和 MCP 必须把 DID 规范化为稳定的可打印 ASCII。
- MCP 连接失败时，AI 在完成配置、进程、Header、`initialize`、`tools/list` 和只读状态调用的证据链之前，不得修改 Token、租户、服务器地址或执行远端写入。连接恢复后先完成只读基线盘点，再按用户授权开始写入。
- 修复 Microi.VSCode 插件的 MCP 生成逻辑后，必须重新生成配置、重启对应 MCP server，并在当前 AI 会话中再次验证工具发现与一次只读工具调用。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-032 sha256=230c8683389d2b1ee4f5ba88dc4e51cb4dc4eb6a89b76a142b07f479ff5be1c8 -->
## MCP 写入超时与降级约定

- 写请求超时后的远端回读必须使用独立的短超时，不能继续沿用普通查询的长超时。否则一次 60 秒写超时后，每次回读还可能等待 120 秒，AI 会长期停留在“等待远端回读”，用户误以为菜单按钮或接口引擎完全写不进去。
- `microi_create_engine` 必须与代码保存、事件保存、菜单更新一样使用写请求超时和远端回读确认。创建响应异常但按 `ApiEngineKey` 回读到相同代码时，返回 `RecoveredAfterTransportError:true`；禁止因超时重复创建同一个接口引擎。
- 后端创建接口引擎时，数据库新增成功后的路由缓存刷新必须设置硬超时。缓存刷新失败或超时不能把已经成功入库的创建结果伪装成失败，更不能让 HTTP 请求无限等待；响应中应通过 `CacheRefresh` 报告缓存状态。

- 接口引擎代码只用 `microi_save_engine_code`，表单事件只用 `microi_save_event_code`，菜单按钮和 Tab 只用 `microi_update_module`。这些标准工具负责版本、校验、缓存和超时回读。
- 请求超时是“结果不确定”，不是“写入失败”。标准工具返回 `RecoveredAfterTransportError:true` 时，表示已经通过远端回读确认成功，不得再次写入。
- 标准工具明确返回“回读未确认”时，只调用对应 get 工具继续核对一次。没有用户明确授权，不得改走原生 FormEngine HTTP、直接 SQL、表定义增量更新，也不得创建一次性维护接口引擎绕过原端点。
- `MoreBtns`、`FormBtns`、`BatchSelectMoreBtns`、`PageTabs`、`ExportMoreBtns`、`PageBtns` 一律向 MCP 传明文 JSON 数组。租户 `sys_menu` 表单事件中的 Base64 解码属于平台内部兼容逻辑，AI 不得据此手工 Base64 编码。
- AI/终端工具显示的 `…N tokens truncated…`、`Exit code: N`、`Chunk ID:`、`Wall time:` 等是宿主输出标记，不是 V8 源码。禁止复制到本地文件或 MCP 写入参数；读取长源码必须按工具返回的字符范围分段取完，并核对完整源码 SHA-256。标准 MCP 写工具和插件推送检测到这些标记时必须拒绝写入。
- 远端源码不少于 8000 字符，而新源码减少超过 15% 时，应先视为可能只拿到了截断片段并停止写入。只有核对完整源码且确需大幅删减时，才使用写工具提供的显式大幅删减确认参数。
- 发生连续写入超时时，要先停止并发写入，记录具体工具、资源 Key、耗时和回读结果；禁止用“服务器整体不可用”“缓存锁死”等没有日志证据的结论代替诊断。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-033 sha256=b642bb516a42b50e8b459e5237588e85d71c9715970779e155b88d7c0e8c6536 -->
## Codex MCP 单入口约定

- Codex 对普通 MCP 大工具集可能无法稳定注入时，使用插件生成的 `microi_codex` 单入口，不要据此判断服务器或帐号不可用。
- `microi_codex` 的 `action="list_tools"` 可按 `params.keyword` 查找工具，`action="describe_tool"` + `params.name` 可读取参数说明；执行时 action 使用原始 `microi_*` 工具名，参数放在 `params`。
- 单入口只负责路由，必须复用原工具的参数 schema、写入确认、审计、超时回读和错误返回。不得因为只暴露一个 Codex 工具而放宽远端写入保护。
- 如果 Codex 仍不注入 `microi_codex`，优先使用它实际提供的资源工具：先 `list_mcp_resources` 并读取 `microi://codex/status` / `microi://codex/tools`；通用调用先 `list_mcp_resource_templates`，再读取 `microi://codex/action/{action}/{params}`，其中 `params` 是 URI 编码后的 JSON 对象。
- 资源模板只是兼容传输层，执行的仍是原始 `microi_*` handler。写操作同样必须携带原工具要求的 `confirmExecution`，不得把 resource read 当成绕过确认的通道。
- VS Code/Copilot、Cursor、Claude Code 仍使用完整 MCP 工具集；不要把 Codex 的 `enabled_tools = ["microi_codex"]` 复制到其他客户端配置。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-034 sha256=6ffac2793dea9b1d5953d624103d7aea7800b12deaaf71b3b0f5e3cb5b39ac06 -->
## .venv Python 环境说明

工作区根目录的 `.venv/` 是 Python 虚拟环境，**保留，不要删除**。已安装：
- `playwright` — Playwright E2E 测试
- `openai` — AI 接口调用
- `httpx` — HTTP 客户端
- 其他工具（flake8、pytest 等）

AI 执行 Python 脚本时应使用 `.venv\Scripts\python.exe`（Windows）而非系统 Python。
<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-035 sha256=c114dffea6978f289601a8f71aa83a0466f3d934e96e45bb871af179d319a1e3 -->
## 后端代码改动后的重启验收

AI 只要修改了 `Microi.Server/**` 下会影响 `Microi.net.Api` 运行结果的后端源码、配置、控制器、服务、依赖项目或接口行为，任务收尾前必须完成一次“编译 + 重启本地后端 + 健康验证”，不要只用隔离输出目录 build 后结束。

强制流程：

1. 先执行后端编译验证。若 launch profile 当前端口上的开发服务导致 `bin/Debug/net10.0` DLL 被锁，可以先精确停止当前工作区的 `Microi.net.Api` 进程后重新编译；只有用户明确要求不中断正在运行服务时，才允许用临时输出目录作为补充验证，并必须说明运行服务尚未替换。
2. 从 `launchSettings.json` 回读实际端口，查找并停止该端口上的本地 `Microi.net.Api` 进程。只停止命令行与当前工作区匹配的 Microi 后端，不要误杀数据库、Redis、Node 前端或其它业务进程。
3. 必须进入 `Microi.Server/Microi.net.Api` 目录启动：
   ```powershell
   dotnet run --launch-profile Microi.net.Api
   ```
   启动优先发生在用户能在 VS Code 中看到和停止的终端中，方便用户查看日志并手动停止；用户明确允许时，可以使用 VS Code 可追踪的隐藏终端/任务终端。当前工具环境没有 VS Code 终端能力时，允许使用本机可见的 `cmd`/PowerShell 窗口启动；禁止使用脱离用户可见窗口的后台服务或守护进程方式启动。标准端口无法释放时，只有同步更新前端本地 `ApiBase` 和测试变量后才可使用明确的临时端口，并在任务结束时说明。
4. 启动后轮询验证 launch profile 实际地址可访问；至少确认端口已监听、进程存在、最近日志没有立即崩溃。涉及新增 API 时，再调用新增/受影响接口做一次真实请求。
5. 最终回复必须明确说明：后端已重新编译、旧进程 PID 是否停止、新进程 PID、实际端口是否监听、验证的 URL 或接口。若因为用户明确要求不中断、端口被非 Microi 进程占用或配置缺失导致无法重启，必须把阻塞原因说具体。

这条规则优先于“避免打断正在运行服务”的默认谨慎策略；本地开发联调场景下，用户通常需要 launch profile 当前端口上的后端加载最新代码。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-036 sha256=db96c39a15f4b5637ce37555797858320256dda22daf7ac5cdaae2a436fd214c -->
## MCP 可调用性诊断补充

当用户反馈“Codex/VS Code 设置中能看到 MCP，但当前 AI 会话不能调用对应工具”时，不能只回答“当前会话没有注入”。必须按层排查：

1. 先确认 `.vscode/mcp.json`、`.cursor/mcp.json`、工作区根 `.mcp.json` 和 `~/.codex/config.toml` 都能解析，且目标 server key 为稳定 ASCII 格式，例如 `microi_itdos`，不要使用中文名或横杠。
2. 再用 Microi.VSCode 插件的“诊断 MCP 可调用性”命令，或等价脚本直接启动对应 `mcp-server.js` / `mcp-codex-stdio-adapter.js`，执行 `initialize` 和 `tools/list`，确认 `microi_get_db_schema`、`microi_get_field_list`、`microi_add_field`、`microi_update_field`、`microi_refresh_schema_cache` 等核心工具真实返回。
3. 如果当前 AI 客户端支持工具发现或延迟加载，AI 必须先主动执行工具发现/热加载流程，例如 `tool_search`、客户端 MCP refresh、Microi.VSCode 的启动/诊断命令；不要先让用户手动重启、重载或重新生成 MCP。
4. 如果真实握手成功但 Codex 当前对话仍没有注入 `mcp__...` 工具，AI 仍应优先使用等价的 MCP stdio JSON-RPC 直连 fallback 完成当前任务：读取对应 MCP 配置、启动 adapter/server、执行 `initialize`、`tools/list`、`tools/call`，并严格遵守该 MCP 绑定的 API Server 和 OsClient 边界。直连脚本必须放在 `.tmp/` 或使用一次性 stdin，不得散落到项目目录。
5. 只有在客户端不支持热加载、直连 fallback 也无法完成任务，或写操作边界无法确认时，才告知用户需要新开对话、重载 Codex 或检查 MCP 配置。说明必须写清楚：MCP 配置和进程是否可用、当前会话为什么没有注入工具、已经尝试过哪些自动恢复动作。
6. 如果握手失败，要把失败层级说清楚：配置文件解析失败、路径不存在、token 文件缺失、MCP 进程启动失败、`initialize` 失败、`tools/list` 缺核心工具，不能把这些问题混成“用户没启用 MCP”。
7. Microi.VSCode 生成 MCP 配置时应清理旧的中文/横杠 Microi MCP key，只保留 `microi_<osClient>` 或 `microi_<osClient>_<host>` 形式，避免不同 AI 客户端因 namespace 不稳定而无法注入工具。

<!-- /microi-progressive:chunk -->
<!-- microi-progressive:chunk id=workspace-conventions-037 sha256=d0c37c1f0c5ec999b10ed6f0ccbb4f1f32aa8b0fc998a433d020d6552cc6fb5c -->
## Windows MCP 控制台闪窗复盘

当用户反馈“打开 Microi.VSCode、添加服务器或初始化 MCP 后连续弹出并立即关闭多个 cmd 窗口”时，应按进程风暴排查，不能只给已有 `spawn` 补 `windowsHide`：

1. MCP 配置文件是各客户端的事实源。内容未变化时必须使用 write-if-changed，禁止仅为“同步”而反复改写文件并触发监听器重启。
2. 生成 `~/.codex/config.toml` 后，禁止再隐式循环执行 `codex mcp list/remove/add`；服务器数量越多，这类逐项 CLI 同步越会放大成几十个瞬时控制台进程。
3. VS Code 已配置 `chat.mcp.autostart` 时，插件后台监测只能检查配置和状态，禁止在侧栏显示、定时轮询、登录、添加连接或初始化流程里再次执行 `workbench.mcp.startServer('*')`。
4. 握手诊断会真实启动每个 stdio MCP，只能由用户显式点击“诊断 MCP 可调用性”触发；常规配置成功提示不得暗中运行整组诊断。
5. Windows 的 VS Code/Cursor 配置优先复用 GUI Electron 宿主 `process.execPath` 并设置 `ELECTRON_RUN_AS_NODE=1`，避免把控制台子系统的外部 `node.exe` 持久化为每个 MCP 的启动命令。Trae 若因空格路径兼容必须经过 `cmd.exe`，仍需使用固定 launcher 并隐藏窗口。
6. 回归测试至少静态断言：Codex CLI 批量注册函数不存在、后台 monitor 不包含 `startServer`、自动配置不包含诊断、Codex 配置内容不变时不改写、Windows GUI 宿主检查早于外部 Node 探测。再在扩展开发宿主中覆盖打开侧栏、添加连接、初始化 MCP，观察无连续控制台闪窗。

<!-- /microi-progressive:chunk -->
