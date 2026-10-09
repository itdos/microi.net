---
name: microi-codex
description: 在 Microi Agent、Codex 或 DeepSeek Harness 中完成 Microi吾码 VS Code 扩展的等价工作流，包括连接与登录、AI/MCP 初始化、V8/表单/模块/工作流同步、远程执行与诊断、性能测试、微应用、Playwright 和发布回读。用户提到吾码、Microi、V8引擎、Microi-V8-Engine 或要求使用吾码 AI 插件时使用。
---

# Microi吾码 Codex / DeepSeek Harness Plugin

本插件与 `Microi.Agent`、`@microi.net/cli` 共用配置、Token、MCP Server 和 Microi Skills。不要另写原生 HTTP、SQL 或第二套认证实现。

本地 HTTPS 连接同样必须验证证书。MCP 不因 `localhost/127.0.0.1` 自动设置
`NODE_TLS_REJECT_UNAUTHORIZED=0`，也不能覆盖调用方的严格策略。开发节点使用受信
证书；必要时在启动 MCP 前通过 `NODE_EXTRA_CA_CERTS` 指定已核验的公开 CA PEM。
分别验证正确 CA 可连接、陌生 CA/无信任证书被拒绝；配置了 CA 不等于实际启用了
证书验证，须核对最终进程与真实握手结果。证书私钥和会话 Token 不进入日志。

平台 Api/Web 版本入口可生成独立开发工具连接。收到连接 JSON 时，用 `microi auth import --session-stdin` 从标准输入导入，再运行 `microi ai init` 和 `microi doctor`；禁止将 Token 放入命令行、源码或日志，不再索取账号密码。开发 Token 使用现有终端有效期，可独立撤销；它只授权该业务租户，不能替代 Microi Agent 的官方 AI 计费账号登录。访问密钥的最小业务 scope 不能替代完整 MCP 管理身份。第三方 App Secret 默认进入系统设置“安全与服务接入”，优先使用 `microi_manage_server_private_secret`。

每次 Microi 对话先完整读取工作区 `microi.skills/workspace-conventions/SKILL.md`；工作区尚未初始化时读取本插件同级 `../workspace-conventions/SKILL.md`。按其中首部完成创始人身份识别及平台功能四项同步检查，再进入专项流程；完整规则只维护该基础入口，不复制到本路由。

## Microi Agent 桌面宿主

- 完整版在所有平台用物理 `node_modules/node/bin/node[.exe]` 启动 Harness、Worker 和插件命令，不能换成 Electron Helper/utilityProcess；后者会在特定 Electron 指纹下被原生加载器拒绝。每次发布最终安装包先运行 `test:packaged-desktop`，设置真实产物与独立证据目录，验收生产 main 两次正常启动、Worker IPC、员工引导及 Harness 重启，并核对日志 `electron=none`。直接启动 Harness、签名公证成功或跳过完整应用用例均不足以证明用户能正常启动；不同系统和架构覆盖分别记录。同步上游必须保留该选择器、门禁脚本与回归用例。
- 桌面包内置技能目录；干净工作区输入 `/microi` 可发现吾码入口，再读取基础规范与专项技能。查不到时先核对当前桌面版本及内置技能资源，不要求用户复制开发机目录，也不要把 MCP 工具名当成斜杠技能名。
- 对话输入框上下键回填成功提交的提示词，向下可恢复未发送草稿。菜单、输入法候选、选区和多行正常光标移动优先；不要在用户编辑文本时强行覆盖草稿。
- 消息编辑/撤回通过真实会话分叉到该消息之前的已完成轮次；原会话和已经执行的文件修改保留。撤回将消息恢复为草稿，编辑则重新发送；这不是撤销文件系统。图片随草稿恢复，无法安全恢复的文件附件明确拒绝，不能静默删除附件或只改屏幕文字而保留旧模型上下文。
- AI 员工桌面工作台提供十岗、任务草稿、执行、成果审阅、已验收依赖、目标和预算。云端执行复用员工中心；本机执行使用显式受限 OpenClaw Agent 与已有 Gateway。Harness 的会话/技能/定时能力不能证明 OpenClaw 的渠道、Gateway、设备节点与全部 cron 语义已完整内置。相关配置和验收读取 `ai-engine/references/ai-employees.md`。

- 桌面与手机配对的本机 HTTP 监听必须避开 Fetch 标准禁止端口。系统自动分配的端口也可能不可浏览器访问；只有浏览器允许的真实监听端口才能进入配对 URL。自动命中禁止端口时关闭监听再有界重选，显式配置禁止端口须报错；权限和占用错误仍保留原错误，不改变系统动态端口范围、不绕过浏览器安全策略。同步上游时保护共同端口选择器、配对监听与对应回归。

- 同步上游前读取内部源码根目录 `.microi-upstream.json`、`同步dsh-desktop上游.md` 与维护交接记录；分别核对 dsh-desktop 提交、Harness 官方 tag/提交、npm 版本与锁定 integrity。三方比较和补丁意图迁移、干净 `npm ci`、回归及真实界面验收通过后才能推进基线。禁止用整目录覆盖或删除补丁来通过同步。Harness 的同级权限请求应直接使用当前有效模式；提升权限必须填写非空理由，普通调用不要附带这两个升级字段。
- Microi Agent 是内部仓库中的独立桌面发行物，直接基于 DataElement/dsh-desktop 与 DeepSeek Harness 二次开发，内置固定版本的 Harness SDK、Node.js、MCP / CLI / Skills；不是需要额外 Agent Token 的 CLI 别名。
- 官方 AI 登录只走桌面账号窗口，固定 `https://api.itdos.com`、`OsClient=iTdos`，使用当前用户的中转 Key 和额度。不要让用户把密码或 AI Key 写入对话、命令行、MCP 参数或模型配置。
- 业务连接在「服务器连接（MCP）」中单独添加、登录；官方 AI 账号不授予业务租户权限。项目初始化和资源同步优先使用桌面「项目资源」；其余业务继续调用同源 MCP 的原工具。
- macOS 登录凭据通过桌面 Keychain/受限 IPC 管理；不要在 macOS 改跑当前只支持 Windows 凭据恢复的 `microi auth login`。不要手改 Token 文件。
- 桌面安装包中的 Harness、Node 和同源资产随桌面版本升级；不运行 npm 自更新去改写正在使用或已签名的安装目录。外部 Codex / WorkBuddy / CLI 的后台更新规则保持不变。
- 桌面 UI 沿用 dsh-desktop 的设计系统；首页保留 dsh 原生会话区，并在下方用无外层卡片边框、无整块背景的差异层完整展示吾码 AI 大类与 29 项图像工具。工具 Id、名称和分类以 `Microi.Client/src/views/ai-engine/ai-image-tool-directory.js` 为事实源，点击时在「Microi吾码」主面板打开原生三栏工作台，禁止跳转浏览器页面；模型来源可选当前对话模型、吾码官方中转站或已登录服务器连接。服务器连接入口和“预览版”不重复放进首页。AI 数据分析明确使用 `microi_run_engine` 调用 `mci_ai_data_assistant`，不能改成绕过 MCP 的直接数据库访问。
- Microi Agent 左侧「功能区」动态读取 dsh 的 `settings.section` 注册表，并在主界面 `main` 面板中渲染原设置组件；第一项「Microi吾码」合并官方账号和吾码 AI，第二项为「服务器连接（MCP）」，之后提供 AI 员工、采集引擎、环境与服务管理入口，再接 dsh 原生设置。功能区与工作区可拖动调高，默认无滚动条；首页/聊天页不显示虚假选中态。底部入口显示「关于 v版本号」及 `LicenseType` 版本标签，连接手机入口保持同一行。品牌显示 `Microi Agent` 与 `HARNESS` 标签，新安装默认浅色，用户仍可切换浅色/深色。
- 桌面安装包版本从 `1.0.0` 开始，使用吾码三段十进制进位规则。正式新版本先在发布源码中执行 `version:bump`，核对并提交三个版本文件；Mac 拉取后使用 `bash ./一键打包Mac.sh` 在临时 Git 工作树中打包当前已提交版本，默认不再升版，失败也不能把生成文件留在原检出目录。`--current` 仅作旧命令兼容；同版本本地重打包不得覆盖已公开的不可变产物。测试、类型检查和普通 Web 构建不升版。
- Windows 安装包的构建成功、Authenticode 签名、SmartScreen/商店信任、HDFS 上传与 CDN 回读是不同证据；双击 `一键打包Windows.cmd` 时自动探测 Microsoft Artifact Signing 或本机可信证书，没有凭据则继续生成明确标记的未签名包，显式 `-Signing Signed` 才失败关闭。签名必须先覆盖安装器及独立执行文件，再计算发布 SHA256。macOS 默认 `bash ./一键打包Mac.sh` 同样自动探测并在无凭据时生成未签名包；`--signed` 是正式门禁，必须在缺少证书或公证钥匙串时失败，并通过 `codesign`、`spctl`、`stapler validate` 后才标记已签名公证。
- Harness 本机探测必须以独立硬计时器约束 TCP 连接和响应头，Node 失败后用 Chromium 复核。两个通道在认证地址公布后连续连接失败时，仅重启一次到 IPv6 `::1`；IPv6 也必须实际取得有效 HTTP 响应，不得伪造就绪、绑定所有网卡或关闭鉴权。普通模式与安全模式使用同一规则，500 响应不得触发网络回退或算作就绪。日志同时记录桌面版本、实际监听地址和进程内 HTTP 自检；探测不带凭据、不跟随重定向、不输出自检 Token。恢复日志只去除缓冲区之间的重叠，不能用全局 Set 删除重试中的相同超时。发布运行 `scripts/verify-harness-startup.mjs`，以包内 Node/Harness、真实 Chromium 页面验证普通与安全模式、Node 超时回退、IPv4 双通道受阻后 IPv6 鉴权和双通道真实无响应的有界失败。Mac 验收与 Windows 真机、安装升级、客户设备验收分别记录。
- Windows 的 IPv4/IPv6 TCP 都连接失败时，允许回退到本次启动创建的私有命名管道。必须先从管道取得真实 HTTP 响应，再沿用 Harness 原有 Host、Origin、启动 Token 和签名 Cookie 验证；不得跳过鉴权或开放公网。HTTP 请求与 `/api/remote.mux` 会话流都要验收，IPC 仅限当前主窗口顶层页面和固定端点，不暴露凭据、管道路径或任意代理能力。`scripts/verify-harness-pipe.mjs` 的 macOS Unix socket 验证不等于 Windows 命名管道或客户设备已通过。
- 当前 Electron 桌面运行时不能直接打包 iOS/Android，也不能把现有 DMG 原样提交 Mac App Store。移动端和 MAS 版应作为受限客户端，复用账号、模型、会话、MCP 与桌面配对协议，把 Node/Harness/Shell/插件执行放到配对桌面或合规远端；分别完成 Apple/Google 签名和商店审核。
- MAS 使用独立 `electron.vite.mas.config.ts` 与 `electron-builder.mas.cjs` 构建最小客户端，应用包只含客户端入口、受限 preload、静态界面和版权材料；不能把父工程依赖、Harness、独立 Node 或站外更新器混入沙盒包。正式包使用 Mac App Distribution 与 Mac Installer Distribution；本机验证使用 Mac Development 和包含该设备的开发描述文件。签名钥匙串必须先用实际保存的密码完成锁定、解锁往返验证，再启动构建；记录密码不得被重复生成过程覆盖。签名包、本机运行、Apple 上传处理、提交审核和正式上架分别回读，不能以包已生成代替上架。商店截屏使用经过验证的真实客户端界面，按 Apple 接受的高清尺寸上传，保留原始高清 Logo。
- Windows Microsoft Store 使用分配给产品的 MSIX Identity/Publisher，上传包由商店签名。MSIX 运行时以 Electron 的 `process.windowsStore` 识别，禁止调用官网 EXE 更新、降级或安装入口；手动检查更新转到该产品的 Microsoft Store 页面，版本列表不请求 NSIS 归档。包内 PE/x64、Manifest/BlockMap 校验、Windows 原生运行、商店认证和正式可下载分别记录。官网 Windows/macOS 下载按钮旁可展示真实商店产品链接，但审核中必须明确标注，不能把未开放页面称为已上架。
- 闭源商业项目要求免费可信 EXE 下载时，已发布的免费 Store MSIX 可使用 Microsoft Store Web Installer：从官方 badge 生成器的 Direct 模式取得该产品 `get.microsoft.com/installer/download/` 链接，验证真实下载的 Microsoft 签名及文件摘要。这是联网安装当前商店版的小型 EXE，不是给官网完整 NSIS EXE 签名；保留两渠道并说明版本差异，不把下载成功写成原生安装通过，不将动态安装器冒充固定版本 CDN 产物。按当前包 Manifest 的 MinVersion 和架构记录系统条件，分别说明旧 Windows、x86、ARM 仿真、LTSC/Server、离线与企业策略边界；不降低安全策略或虚构全部系统验收。自签名不能产生公众信任，免费开源签名服务不适用于私有商业源码。
- 复用已签名 MAS 应用制作开发测试包时，必须替换 `Contents/embedded.provisionprofile`，核对描述文件中的证书与开发签名及当前设备一致；`codesign --verify` 通过仍不能替代实际启动。资料目录中的描述文件保持私有权限，复制到安装包后设为普通用户可读，并检查整个有效载荷，避免 ITMS-90255。沙盒阻止调试监听时不得扩大正式包的网络监听权限；自动化测试入口只放入独立开发副本，正式入口、preload 与界面应核对同源，测试入口和配对口令不得进入正式安装包。安装包上传成功后仍要回读 Apple 处理状态、选择构建、上传高清素材并实际提交审核。
- 官方账号页和关于标签通过 `platform-current-user` 接口引擎读取当前 `sys_user.LicenseType`。桌面相关平台业务逻辑优先通过 `microi_itdos` 接口引擎实现；只有接口引擎缺少必需底层原子能力时才能改后端源码，并说明原因。
- 正式 Windows/macOS 安装包必须内置固定版本且经过 SHA-256 校验的 cloudflared，运行时优先使用安装包 `resources/bin`，避免首次联网临时下载。检查更新从 `https://api.itdos.com/microi-code/updates/` 的匿名接口引擎读取 YAML/JSON，安装包二进制仍通过 HDFS 流式发布。
- Windows 安装验收必须包含旧卸载器损坏后的升级、同版本重装、超过 260 字符的路径以及全部文件 SHA-256 回读。安装器使用当次发布的兼容卸载器，并用固定哈希的 Unicode 7-Zip 直接解压到目标目录，禁止恢复临时目录解压后使用 NSIS `CopyFiles` 复制的流程；该流程会将路径或复制错误误报为“应用无法关闭”。进程检查仅匹配安装目录内的产品主程序及内置 Node，不能按整个目录匹配安装器或无关程序。
- 长路径验收必须先安装完整旧版本，再在同一目录覆盖升级及再次重装，不能只在空目录或仅含模拟卸载器的目录安装。卸载清理、旧文件备份迁移和失败回滚均须支持 Windows 扩展路径；通过真实 NSIS 与独占文件句柄验证长路径迁移和占用回滚，不能仅用 JS 文件操作或首次解压测试替代。
- Windows 1.2.7 起安装失败诊断直接集成于安装器：失败窗口提供「复制安装日志」与「打开日志」，不另发独立诊断工具。`build/microi-installer-log.nsh` 在实际清理/解压/回滚步骤写入安装目录外的 UTF-8 日志，`build/microi-installer-diagnostics.ps1` 作为内嵌的只读补充，记录 Win32 访问错误和 Restart Manager 占用 PID。整份日志通过原生 Unicode 剪贴板复制；超过容量时明确拒绝而不截断。验收须真实点击复制按钮、核对中文长日志、占用文件的 Win32=32 与回滚；卸载退出码 2 不等同于 Win32 错误码 2，本机通过不代表客户机升级通过。
- Windows 1.2.8 起升级先在安装盘同级目录完整解压，再切换程序目录；旧文件仅同盘重命名，禁止回退到逐文件跨盘搬运。`build/microi-installer-transaction.nsh` 与相关 NSIS 补丁必须随上游同步永久保留。Win32=33 是文件区域锁错误，不能仅凭此指认某个安全软件；验收须在安装盘与 TEMP 不同的条件下持有真实字节锁，证明旧跨盘操作失败而新版安装成功，并验证持续占用、回滚与未知目标目录冲突。未恢复的同盘备份必须在安装退出后保留，不能存入会自动删除的临时目录；完整源文件哈希检查与客户设备验收分别记录。
- Windows 1.3.7 修复候选针对新版 stage 启用时 Win32=5 的单次失败：对 5/32/33 有限重试，再仅在成功新建的目标目录内做同盘文件重命名；以固定 UTF-16 日志记录迁移意图，部分失败逐项搬回，已有目标、未知文件与旧备份均不覆盖。回滚 EOF 和短记录必须停止，目录枚举句柄先关闭再删除空目录。真实 NSIS 回归覆盖短暂/持续错误 5、中途错误 5、文件冲突和未知目标；Wine 结果与 Windows 原生覆盖升级/全部文件哈希/最终程序启动分别报告。
- Windows 1.2.9 起本机启动探测必须使用覆盖 TCP 连接和响应头的硬超时；Harness 输出认证地址后，Node 请求失败可使用实际渲染页面的 Chromium 网络通道回退，严格限制为本次 `http://127.0.0.1:端口/`、不带凭据、不跟随重定向。记录两个通道的真实错误；只有响应正常且存在本次认证信息才可启动页面。恢复日志只能去除缓冲区之间的重叠，不能用全局 Set 删除重试中的相同超时。发布必须运行 `scripts/verify-harness-startup.mjs`，使用发布包内 Node/Harness 验证普通与安全模式、注入 Node 超时后由真实 Chromium 渲染新会话控件，以及双通道真实不响应的有界失败；本机验证不能称为客户设备已通过。
- 桌面平台 Worker 必须在真实安装包内验证 IPC 与 Windows DPAPI。旧保险库只有成功解密且明文为零字节时才允许迁移为空文档；损坏或其他 Windows 用户的保险库保留原文件并返回具体错误。启动初始化拒绝不能让 Node 服务退出；单元测试、安装成功与真实桌面账号/AI 员工页面联调是三个独立验收层。
- dsh-desktop 升级必须遵循 `Microi.Agent/同步dsh-desktop上游.md` 的三方同步流程和补丁意图清单；`microi/`、`packages/microi-code-*` 与桥接代码是永久保护区，普通上游文件使用三方比较，补丁必须经 `npm ci` 重放。关于页、NOTICE、MIT License、DataElement 版权与两个上游仓库链接不得删除。停止或退出后的任务保留历史，当前 SDK 的跨进程历史仅供查看，需新建任务引用继续。

### 默认中文输出

- 面向用户的回答、计划、工具说明、错误解释和可见进度默认使用简体中文；代码、协议字段、命令、模型名称和路径保留原文。
- 这条规则通过 Microi Skills 同步到 Microi Agent、Codex、DeepSeek Harness、WorkBuddy、CodeBuddy 和 OpenCode 的工作区指令；宿主或模型支持自定义系统提示时，也应将同一条规则放在最高优先级的用户可见输出约束中。
- 中文规则只能约束可见回答、计划和工具摘要；模型服务内部隐藏思考的语言由模型决定，客户端不能保证每一个内部 token 都是中文，也不应把内部思考当成可导出内容。

## 非阻塞自动更新（强制）

每次新建或接续吾码任务必须执行 `workspace-conventions` 的版本检查、首次“Microi吾码开发工具版本”播报与后台自动升级，不限模型。先调用 `microi_codex action="profiles"` 读取 `toolchain` 中的当前已加载版本、工作区 Skills 版本和自动更新状态；未知项准确标记，不能把当前进程版本当成全局 CLI 或 npm 最新版。完整强制规范只维护在基础入口。

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
