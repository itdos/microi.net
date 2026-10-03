---
title: Microi Agent
titleTemplate: 吾码桌面 AI 开发工作台
description: 下载 Microi Agent Windows 与 macOS 安装包，了解吾码账号、AI 中转站、MCP、Skills、DeepSeek Harness 与 dsh-desktop 的完整集成方式。
pageClass: mci-microi-code-page
aside: true
outline: [2, 3]
---

# Microi Agent

Microi Agent 是基于 dsh-desktop 与 DeepSeek Harness 二次开发的吾码桌面 AI 工作台，提供 Windows 与 macOS 下载、版本校验和完整使用说明。

<MicroiAgentShowcase />

## AI 员工与对话工作流

1. 在「Microi吾码」登录官方账号，或在「服务器连接（MCP）」登录自己的业务租户；「AI 员工」只读取所选连接下当前负责人的团队。未登录会显示明确的连接入口。
2. 在「岗位团队」查看十个岗位的职责与交付成果，通过「岗位设置」调整名称、补充要求和启用状态。在「新建任务」填写成果目标、参考资料与可核验的验收标准，先保存草稿，再派发执行。
3. 云端任务无需本机常驻；派发后提交后台执行。任务依次显示排队、执行、待验收及已验收状态。打开成果，填写验收意见后接受或退回；后续岗位只能把已验收任务选为前置成果，最多五项。
4. 在「目标与节奏」设置有界的每日目标，在「执行设置」查看日 Token 预算与本机节点。未知供应商 usage 按保守预留计入预算；界面中的预算不是供应商计费的绝对封顶。

成果是可审阅草稿。代码、测试计划、财务、招聘或营销文字不代表代码已经部署、测试已经执行、款项已支付、人员已录用或消息已发送。真实执行需要对应工具授权、日志、产物与回读。

### Harness 和 OpenClaw 的关系

Microi Agent 的本机开发会话由 DeepSeek Harness 执行；吾码小龙虾的员工领取、续租、受限岗位调用及回传协议已经迁入桌面差异层。Harness 不能替代 OpenClaw 的全部渠道、Gateway、设备节点及 cron 协议，不能因为有对话、技能或定时能力就称为完整 OpenClaw 已内置。[OpenClaw 官方仓库](https://github.com/openclaw/openclaw)、[定时任务说明](https://docs.openclaw.ai/automation/cron-jobs)。

「本机 · OpenClaw 受限节点」需要已有 Gateway 与本机配置。准备岗位仅新增当前租户/负责人独立的十岗目录，保留默认 Agent、模型及密钥；岗位明确禁用工具，只生成草稿。准备后按 Gateway 的要求重启服务，再连接节点。停止节点会停止接单，正在执行和待回传的成果继续保留；失败报告使用原请求重放。Gateway、网络和有效登录必须持续可用，不能把短时自动测试称作连续 24 小时验收。

### 对话历史、编辑与撤回

- 输入框按 `↑` 回填已成功发送的提示词，按 `↓` 向后浏览并恢复未发送草稿。多行文本在开头/末尾才进入历史；输入法、选区、附件及候选菜单优先处理各自操作。
- 已发送用户消息提供「编辑」「撤回」。编辑从该消息之前的已完成轮次分叉并重新发送；撤回将消息恢复为草稿。原会话保留在历史中，新会话的模型上下文不再包含被替换的消息。
- 已执行的文件修改不会随撤回自动恢复。图片随草稿恢复；目前带文件附件的消息会明确提示在新会话重新添加文件，避免静默丢失附件。子智能体消息通过父会话继续处理。
- 正式包内置吾码 Skills；在干净工作区输入 `/microi` 进入吾码流程，不再依赖开发机安装目录。业务服务器仍须独立登录与授权。

## 安装、签名与平台兼容

页面顶部的 Windows 与 macOS 按钮使用固定的 latest 入口，每次点击均从官方更新清单取得当前安装包地址。旧版归档和当前安装包的 SHA-256 可在下方展开“版本记录”后查看；版本越多会自动分页。更新元数据由 [Windows latest.yml](https://api.itdos.com/microi-code/updates/latest/latest.yml)、[macOS latest-mac.yml](https://api.itdos.com/microi-code/updates/latest/latest-mac.yml) 和 [版本目录](https://api.itdos.com/microi-code/updates/versions.json) 提供。macOS 自动更新使用 ZIP，DMG 用于手动安装。

**Windows 与 macOS 1.3.4 已开放下载**：本次升级员工工作台、上下键提示词历史、消息编辑/撤回和内置技能发现。macOS Universal 已签名、公证；官网 Windows EXE 仍未签名。已有启动恢复继续保留。

**Windows 启动恢复说明**：针对 1.3.1 在客户电脑上 IPv4、IPv6 回环 HTTP 连接均超时的问题，新增当前 Harness 私有命名管道恢复，并保留认证、Cookie、WebSocket、工作区和会话。本包未签名；构建、自动回归和 MacBook 上真实 Harness/Electron 验证已通过，**客户 Windows 原生安装与启动仍待确认**。请使用顶部 Windows 按钮下载最新测试包；失败时提供新版 `harness.log`，无需先卸载插件或删除工作区。

- 当前 Windows 版本以页面顶部为准；SHA256 证明文件完整性，不证明发布者身份。内部源码根目录双击 `一键打包Windows.cmd` 或执行 `powershell -ExecutionPolicy Bypass -File .\一键打包Windows.ps1` 即可打包；Auto 模式发现 Microsoft Artifact Signing 或本机证书配置时自动签名，否则明确提示后继续生成未签名包。`-Signing Signed` 才会在缺少凭据时失败。商店版由商店更新，不下载或安装官网 EXE；官网 Windows 1.3.4 测试包仍为未签名 EXE，商店 MSIX 1.3.3 由微软签名。普通 Microsoft 帐号不能直接签官网 EXE。[微软分发说明](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/publish-first-app)
- **Windows 商店版 1.3.3 已发布**：2026 年 10 月 3 日复查，Microsoft 后台显示“在 Microsoft Store 中”，中国区公开产品页已显示 Microi Agent 的名称、发行者、截屏与介绍；商店 MSIX 由微软签名分发。请在 Windows 设备打开 [Microsoft Store](https://apps.microsoft.com/detail/9NKCS76ZMFXR) 查看获取入口。本机 Mac 的产品页没有获取按钮，**Windows 原生获取、安装与启动仍待验收**；商店发布不会改变官网 EXE 的未签名状态。
- 如果旧安装包提示 `Failed to decompress files` 或 `Error opening output file(s)`，请从本页顶部重新下载 Windows latest 安装包后运行；不要重复启动下载目录中缓存的旧安装包。新版安装器改用能处理内置中文技能文件名的解压方式，覆盖安装会保留工作区和会话数据。
- 如果已退出应用仍提示“无法关闭”，旧安装器可能把长路径或文件复制失败误报成应用正在运行。新版使用当次发行的兼容卸载器完成升级；工作区、会话和用户配置保持不变。如果新版仍失败，请使用下面的诊断入口，不要反复重装。
- 1.2.6 修复了已重现的长路径清理问题，但仍有客户报告“旧版本文件清理失败（错误码 2）”。该数字是卸载器退出码，不能直接判断哪个文件失败、是否被占用或缺少权限，也不能据此认为所有客户的升级问题已解决。
- **Windows 1.2.8 安装事务**：针对安装盘与系统临时盘不同、旧文件搬运及回滚出现 Win32=33 的情况，新版先将完整新程序解压到安装盘的同级暂存目录，再切换旧、新目录。旧文件备份仅在同盘重命名，不再逐文件复制到系统临时盘；切换失败会尝试恢复旧目录，未恢复的备份保留在 `安装目录.microi-backup-会话编号`，不会随临时目录删除。成功后清理本次旧程序备份；仍被锁定的残留路径写入日志。请勿手工删除失败日志所指的恢复备份。已覆盖真实字节锁、跨盘安装、中文长路径和失败回滚；客户电脑仍需安装验收。
- **Windows 1.2.9 启动探测**：本机请求的超时现在同时覆盖 TCP 连接和响应头，避免单次连接卡住整个启动流程。Harness 已输出认证地址而 Node 探测失败时，再使用页面同样的 Chromium 网络通道验证；只有收到实际 HTTP 响应且 Harness 已提供本次认证信息才继续加载页面。两条通道都失败时保留各自错误，恢复页显示“本地服务未响应”，不会把重复的超时记录丢掉或据此建议卸载插件。开发验收使用安装包内 Node/Harness，覆盖普通模式、安全模式、Node 超时下的真实 Chromium 页面加载和双通道不响应；这些测试不等同于客户设备已验收。
- **Windows 1.3.1 回环恢复**：客户确认 1.2.9 仍在 `127.0.0.1` 上出现 Node 与 Chromium 双通道连接超时。新版连续确认两次连接失败后，只重启一次 Harness 到新的 IPv6 回环地址 `::1`；仍须取得本次认证信息并收到真实 HTTP 响应才加载页面，不监听公网地址、不绕过认证。IPv6 不可用时停止重试并保留具体错误。本机 HTTP 端口避开浏览器禁止端口，自动选到禁止端口时有界重选，显式配置和真实权限、占用错误继续报错。日志增加实际应用版本、监听地址和子进程内 HTTP 自检，便于区分监听失败与桌面连接失败。请从顶部永久下载入口升级，若仍失败，请提供新 `harness.log`；开发环境通过不能代替该客户 Windows 安装和启动确认。
- **安装仍失败时**：Windows 1.2.7 起已将诊断集成进安装器。失败窗口提供「复制安装日志」和「打开日志」，无需下载独立诊断工具。日志保存在 `%LOCALAPPDATA%\Microi Agent\installer-logs\`；目录不可写时使用 `%TEMP%\Microi-Agent-installer-logs\`，退出安装后仍保留。日志包含实际失败步骤、文件路径、迁移的 Win32 错误、卸载器或 7-Zip 退出码、回滚错误，以及只读文件访问和 Restart Manager 占用 PID 检查。请把复制的日志提供给支持人员；本机测试通过仍不代表该客户设备已通过验收。
- “工作区服务连接已断开”与云端账号未登录是不同问题。新版修复了旧空凭据保险库导致服务退出的情况；对损坏或其他 Windows 用户加密的凭据会保留原文件并报告具体错误，不会静默清空凭据。安装成功后还应打开「Microi吾码」和「AI 员工」检查本机服务连接。
- macOS 正式安装包采用 Universal 通用架构，原生支持 Intel 与 Apple Silicon，最低要求 macOS 13.5。正式发布使用 Developer ID Application 签名，并在发布前完成 Apple 公证及 Gatekeeper 验证；历史未签名包的状态以对应归档记录为准。内部源码根目录执行 `bash ./一键打包Mac.sh --signed --current` 可以按源码当前版本生成签名 DMG/ZIP；默认构建 Universal，也可使用 `--arch arm64` 或 `--arch x64` 选择与宿主匹配的单架构。首次打包会下载并校验固定版本的 cloudflared；网络中断后重新执行同一命令即可续传，也可通过 `MICROI_CLOUDFLARED_ASSET=/已下载的官方压缩包路径` 指定本地文件，哈希不符会停止构建。Dock 图标在 Mac 构建时自动生成合适留白。一键脚本在证书与 `notarytool` 凭据完整时自动启用签名、公证；`--signed` 在缺少凭据时失败。
- 当前 Electron 桌面应用不能直接生成 iOS/Android 安装包。Mac App Store 版采用独立 App Sandbox 客户端，提供本地提示词管理和桌面配对会话；Node/Harness、Shell、项目文件、插件与 MCP 在已配对的桌面或其服务端执行。1.3.2（构建 1.3.3）已于 2026 年 10 月 2 日提交，最近一次后台核对为等待审核；2026 年 10 月 3 日公开入口仍**尚未开放商店下载**；商店入口为 [Mac App Store](https://apps.apple.com/app/id6818076490)。需要完整本机开发能力时，仍使用本页顶部的已签名、公证 DMG。商店版本由 App Store 更新，不安装站外更新或插件。

### Windows 商店版隐私政策 {#windows-store-privacy}

本政策适用于 Microsoft Store 分发的 Microi Agent 桌面版。应用提供 AI 对话、项目工具、MCP 和吾码业务连接；项目、会话、本机配置与日志默认保存在当前用户的数据目录。商店负责应用更新，应用不会用官网 EXE 替换商店安装。

登录吾码账号时，账号信息和认证请求发送到用户选择的吾码服务器。使用 AI、MCP、图片、音频或视频服务时，用户提交的提示词、附件及任务所需的项目内容发送到所选服务；具体保存期限、额度和访问权限由这些服务及所属租户决定。配置第三方模型、MCP 或业务连接前，请了解其隐私政策与权限。应用不内置广告追踪 SDK；本声明不表示用户选择的云服务不收集或保存数据。

AI 对文件、命令和业务数据的访问遵循当前任务授权和工具确认。敏感文件应避免主动提交到不可信服务；用户可在应用内删除会话、断开连接及清除登录状态，清理本机数据前请备份需要保留的内容。云端账号或数据的删除请求请联系对应服务；吾码官方服务的隐私与支持联系邮箱为 admin@microi.net。

### Mac App Store 客户端

提示词功能无需登录：在「提示词」新建、编辑、复制条目，也可主动选择 JSON 文件导入或导出。删除条目后可撤销；导入前检查数量、格式和长度，格式错误时保留原有库。

继续桌面会话的操作为：在完整版 Microi Agent 打开「连接手机」，复制配对链接，在商店版「连接桌面」粘贴，然后在原桌面确认连接。之后选择工作区和会话，发送任务、查看回复并回答执行确认。原桌面需保持运行；公网链接必须为 HTTPS，局域网可使用私有 HTTP 地址。执行权限、模型配置和业务服务器沿用原桌面配置。

### Mac App Store 客户端隐私政策

本政策适用于独立商店沙盒客户端。开发者不通过这个客户端收集分析、广告、追踪或崩溃遥测数据；客户端不内置这些收集 SDK。提示词默认只保存在本机应用容器中，只有用户主动导出时才写入所选文件，不自动上传提示词库。

连接由用户主动提供的桌面配对链接建立。连接地址、一次性配对口令、登录会话和交互内容仅发往所选择的配对目标；公网使用 HTTPS。已配对桌面及其配置的 AI、MCP 和业务服务可能按各自配置保存会话、项目和日志；请同时了解这些服务的隐私政策与访问权限。本声明不表示用户自行选择的服务不收集或保存数据。

「断开并清除登录状态」会清除客户端的配对网站会话存储；不会删除另一桌面的历史会话、项目或业务数据。提示词可在客户端删除或导出；卸载和清理应用容器前请先备份需要保留的条目。文件权限仅用于用户主动选择的提示词导入、导出，不授予访问整个项目目录的权限。隐私问题可通过本页的官方技术支持入口联系开发者。

安装后依次「打开项目 → 登录吾码账号 → 添加业务服务器 → 初始化项目 / 拉取资源」，即可开始开发。AI 使用的是你的官方中转额度，实际可用模型与额度以账号页面为准。停止任务或退出后保留历史记录，后续可在新任务中引用历史继续。

在「服务器连接（MCP）」卡片点击「应用到 Microi Agent」，会读取该应用的 `SysLogo`、`SysShortTitle` / `SysTitle`，并将 Logo 与名称应用到 Microi Agent 左上角。品牌设置只保存在当前电脑的 Electron 本机配置中，不会上传文件、修改业务系统的 `sys_config`，也不会把 `Microi Agent` 写回租户；「恢复 Microi Agent 品牌」只清除本机品牌设置。

### 开源基础、版权与后续同步

Microi Agent 没有重新实现 dsh-desktop。内部源码仓库使用四层结构：

`upstream/dsh-desktop/` 保存未修改的上游快照。

`apps/microi-code/packages/microi-code-*`、`apps/microi-code/packages/dsh-desktop-client-ui/`、`microi/` 与 `src/main/microi-*` 保存永久保护的吾码功能。

`patches/` 记录侧栏插槽、设置席位、首页徽标、品牌文案、提示词历史及消息操作等最小接入差异；同步脚本再对“旧上游、新上游、当前产品”做三方比较。上游未触及的吾码文件继续保留，吾码未修改的上游文件可以自动升级，双方同时修改的文件必须报告冲突并人工合并。

补丁无法重放、测试失败或界面验收不通过时都不会推进上游基线。每次同步都要按补丁意图清单重新验证登录、AI 中转、LicenseType、服务器连接、AI 列表、数据分析、插件安装、功能区、关于页、移动连接、Windows/macOS 构建和更新源。

吾码桌面业务优先通过 `microi_itdos` 接口引擎实现，接口引擎实在缺少所需底层原子能力时才修改后端源码。当前账号版本直接读取现有 `platform-current-user` 返回的 `sys_user.LicenseType`；更新目录由 `https://api.itdos.com/microi-code/updates/` 下的匿名接口引擎提供，安装包二进制由 HDFS 流式上传。Windows/macOS 安装包内置固定版本并校验过 SHA-256 的 cloudflared，互联网连接不再在首次使用时从 GitHub 临时下载约 50 MB 可执行文件。

“关于”页面、安装包和源码长期保留以下声明：Microi Agent 基于 dsh-desktop 与 DeepSeek Harness 二次开发；dsh-desktop `Copyright (c) 2026 DataElement`，按 MIT License 使用，并保留 [dsh-desktop 仓库链接](https://github.com/dataelement/dsh-desktop) 与 [DeepSeek Harness 仓库链接](https://github.com/deepseek-ai/deepseek-harness)。吾码新增的账号、AI 中转站、服务器连接、MCP、Skills、AI 能力和数据分析属于 Microi Agent 的差异层。

::: details 展开完整的开发、安装、调试与上游同步手册

## 同一套 AI 能力，四种使用入口

传统低代码把开发从“写大量代码”变成了“手动建表、逐个添加字段、拖拽控件、配置菜单、拼界面 JSON、设计打印模板和工作流”。Microi吾码进一步把这些操作变成自然语言，并提供四个互补入口：

- **Microi Agent 桌面工作台**：内置 DeepSeek Harness，用吾码官方账号直接开始 AI 开发，支持 Windows / macOS 的原生安装包。
- **VS Code 插件**：适合需要资源树、编辑器按钮、Diff、可视化状态、远程执行和逐行调试的用户。
- **`@microi.net/cli`**：产品展示名为 `microi.net/cli`，适合 Codex、DeepSeek Harness、WorkBuddy、CodeBuddy、Qoder、Comate、Claude Code、Trae 或普通终端用户。
- **多宿主 AI Plugin**：同样来自 `@microi.net/cli`；包根同时携带 Codex/WorkBuddy/CodeBuddy 清单、DeepSeek Harness 原生 bundle、同源 MCP、CLI 和全套 Microi Skills。

四个入口位于同一个独立的 `Microi.Agent` 仓库，复用连接、认证、同步、MCP 和 AI 知识注入代码。业务项目共用连接配置、Token 与同步基线；桌面的官方 AI 账号单独管理。可以只安装一种，也可以同时使用。

> 你描述业务目标，AI 通过插件内置的 Microi MCP、平台知识库和 Skills，完成业务蓝图、数据模型、表单字段、菜单权限、接口引擎、V8 事件、数据源、界面引擎、打印引擎、工作流、定时任务、前端微服务以及自动化测试。

这意味着，无论是 OA、ERP、MES、CRM、WMS、项目管理、售后服务、商城、预约、物联网，还是高度定制的行业系统，都可以从一段业务需求开始，由 AI 按 Microi 平台规范规划、生成、验证并持续迭代。

对业务人员，它是一套以自然语言为主要交互方式、无需手写代码的系统开发方案；对专业研发人员，AI 生成的 V8、前端源码、元数据和测试仍然可查看、可调试、可 Git 管理、可人工接管。

```text
自然语言需求
    ↓
业务蓝图 / 现有系统 / 实时数据库结构
    ↓
Manifest 全系统规划 + dry-run 预演
    ↓
用户确认后通过 MCP 写入 Microi
    ↓
表单 · 菜单 · 权限 · V8 · 页面 · 打印 · 流程 · 微服务
    ↓
远端回读 · 系统验收 · E2E · 压测 · 本地/远端同步
```

### 可以直接这样对 AI 说

```text
请为当前租户创建一套设备维保系统：包含客户、设备、保养计划、工单、配件、
巡检记录和知识库；设计管理员、调度员、工程师三类角色；工单支持派单、接单、
处理、验收、回访和超时提醒；生成 PC 后台、移动端字段布局、运营驾驶舱、工单
打印模板、审批流与 Playwright 验收用例。先读取现有蓝图和数据库，给出 dry-run
计划，确认后再写入，最后验证系统并报告同步状态。
```

也可以从任意局部开始：

- “把这份需求文档整理成业务蓝图和完整系统 Manifest。”
- “为客户表补齐联系人子表、查询条件、列表列、统计字段和移动端卡片字段。”
- “生成一个销售运营驾驶舱，包含核心指标、趋势图、排行榜和待办列表。”
- “设计一张 A4 工单打印模板，包含设备信息、处理明细、图片和签字区。”
- “把这个复杂弹窗改成可维护的前端微服务，并在 Microi 中发布。”
- “检查当前系统的表、字段、接口、菜单、工作流和蓝图是否发生漂移。”

## AI 如何交付一套完整系统

插件把“自然语言”与“真实平台能力”连接起来，不依赖 AI 猜测表结构，也不只是生成一段无法落地的示例代码。

1. **发现事实**：读取当前服务器、OsClient、业务蓝图、数据库结构、菜单、接口引擎以及已有 Web / UniApp / MicroService 应用。
2. **理解业务**：梳理角色、业务域、数据关系、状态机、权限、流程、页面、打印和验收标准。
3. **生成计划**：将需求转换为完整 Manifest，通过 `microi_plan_system` 或 `microi_generate_system dryRun:true` 预演，不直接写入。
4. **确认执行**：用户确认后，创建或升级表、字段、模块、权限、接口、事件、数据源、页面、打印、工作流和任务。
5. **补齐定制界面**：常规业务优先使用表单引擎和界面引擎；复杂交互通过前端微服务实现，并保留完整源码。
6. **回读与验收**：验证每个资源是否真实存在、字段和菜单配置是否完整、工作流拓扑是否正确、远端代码是否生效。
7. **自动化交付**：生成并运行 Playwright E2E、网络与资源守卫，按需执行性能测试，再检查本地与远端同步状态。

所有关键写入工具都保留确认、审计、超时回读与幂等保护。全系统生成默认先 dry-run；真实写入需要明确的 `confirmExecution`，避免一句含糊的对话直接改动业务系统。

## 核心能力

| 能力 | 说明 |
|---|---|
| **自然语言生成完整系统** | 从需求直接生成业务蓝图、Manifest、表、字段、表单布局、菜单树、权限、接口、事件、数据源、页面、打印、工作流、任务和测试。 |
| **内置 Microi MCP Server** | VSIX、CLI npm 包与 Codex Plugin 都打包同一 MCP Server，普通用户无需克隆 `microi.mcp`；一键配置后，AI 可直接读取和操作当前 Microi 租户。 |
| **DeepSeek Harness 原生 Bundle** | npm 包声明 `dsh.bundle.patch`，通过 DSH 官方 profile/plugin 协议加载 `@deepseek-ai/dsh-mcp-client`，复用同一多连接路由器，不维护第二套 Microi API。 |
| **110+ 个平台工具** | 当前源码已超过 110 个注册工具，覆盖系统发现、低代码建模、V8、页面、打印、流程、微服务、测试、文件、Redis 和 MongoDB 日志等能力；精确清单以运行时 `tools/list` 为准。 |
| **AI 知识库与 Skills 自动注入** | 自动生成 `AGENTS.md`、`CLAUDE.md`、Copilot/Cursor 指令、V8 类型定义和 `microi.skills/`，AI 无需反复“喂文档”。 |
| **实时数据库理解** | AI 可通过 MCP 查询实时表结构，也可按需读取每个 OsClient 的 `.microi-db-schema.md` 快照；大型数据库不会塞满公共指令文件。 |
| **V8 全资源本地化** | 接口引擎、表单事件、字段事件、模块按钮/Tab、模块 Join/Where、工作流节点代码均可拉取为本地 `.js` 文件。 |
| **远程执行与调试** | VS Code 提供 DAP 可视化调试；CLI 与 Codex Plugin 通过同源 MCP/Skill 完成远程执行、堆栈诊断、最小补丁和复测，UI 形态不同但不复制远端实现。 |
| **安全同步与冲突检测** | 支持单文件推送、服务器一键同步、远端 Diff、同步结果下钻和双端修改冲突拦截。 |
| **前端微服务全生命周期** | 创建、拉取、构建、发布、同步私有源码、维护路由清单并检查源码冲突。 |
| **AI 模型统一配置** | 在插件中维护模型库，并分别同步到 Claude Code、Codex 和 GitHub Copilot；内置 DeepSeek、通义千问、MiniMax、腾讯混元、OpenRouter 等快捷预设。 |
| **Playwright E2E** | 生成 Microi 专用测试工程、登录与接口辅助方法、冒烟测试、契约测试、网络守卫、视觉与资源检查，并打开 HTML 报告。 |
| **性能压力测试** | 对接口引擎、V8 事件和表 CRUD 执行并发/升压测试，输出 RPS、平均耗时、P95/P99、错误率、趋势与错误 Top。 |
| **多服务器 / 多租户** | 同一工作区可管理多个服务器和 OsClient，连接、Token、MCP 配置和本地目录彼此隔离；VS Code、CLI 与 Codex Plugin 共用这些数据。 |

## MCP 工具覆盖哪些平台能力

插件内置 MCP 不是一个“万能写入接口”，而是一组按 Microi 业务对象设计、带参数校验与安全边界的专业工具。

| 领域 | 代表能力 / 工具 |
|---|---|
| 系统与结构发现 | `microi_get_status`、`microi_get_db_schema`、字段、模块、角色、接口、事件和应用清单读取 |
| 业务架构蓝图 | `microi_get_blueprint_schema`、列表/详情、历史读取、结构化比较、CAS 保存、校验与审计回滚 |
| 全系统 Manifest | `microi_get_manifest_schema`、`microi_plan_system`、`microi_generate_system`、`microi_validate_system` |
| 表单与数据模型 | 创建表、添加/批量更新字段、关联字段修复、字段控件配置、表属性更新、结构缓存刷新 |
| 菜单与权限 | 创建菜单模块、维护列表/搜索/统计/移动端字段、按钮与 Tab、角色和菜单权限 |
| V8 与接口引擎 | 创建/读取/保存/执行接口引擎，表单与字段事件，模块按钮代码，工作流节点 V8，匿名访问配置 |
| 数据源与业务数据 | SQL/V8/JSON 数据源，表数据查询/新增/修改/种子数据，文件上传 |
| 平台管理员数据控制面 | `microi_get_administrative_capabilities` 实时复核 DiyToken、当前租户主库与有效管理员角色；`microi_admin_table_data` 在当前租户执行受确认的通用单表查询/单行增改删，访问密钥拒绝、秘密字段脱敏 |
| 界面引擎 | 从自然语言生成、校验和保存 Page Engine 页面；支持当前哈希、历史、比较、导出与审计回滚 |
| AI 平台治理 | 门户、身份与权限、配置、功能开关、发布审批/执行/回滚、服务流量、Trace、日志生命周期、可观测告警、组件资产、页面源码桥接、协作和可恢复导入 |
| 打印引擎 | 从自然语言生成、校验和保存 hiprint 打印模板与运行数据结构 |
| 工作流与任务 | 工作流包、拓扑检查、条件路线测试、节点 V8、定时任务 |
| 在线 AI 应用 | 发现 Web / UniApp / MicroService，读取完整源码上下文，创建、同步和发布前端微服务 |
| 测试与验收 | Playwright 上下文、E2E 计划、系统后置验收、页面/打印/菜单配置校验 |
| 运行维护 | Redis 统计、SCAN、读取、删除、替换、重命名、TTL；MongoDB 日志查询与写入 |

### Codex 大工具集兼容

部分 Codex 版本不会稳定注入超大 MCP 工具集。插件会为 Codex 配置 `microi_codex` 单入口：AI 可先用 `list_tools` / `describe_tool` 发现全部原始工具，再通过同一入口调用；参数校验、写入确认、审计和远端回读不会被绕过。

如果当前 Codex 仍未注入工具，MCP 还提供 `microi://codex/status`、`microi://codex/tools` 和通用 action 资源模板作为兼容通道。其它兼容客户端继续使用完整 MCP 工具集。

## 支持的 AI 客户端

执行插件命令 **`Microi: 初始化AI配置`** 或 CLI 命令 **`microi ai init`** 后，工具会针对不同 AI 客户端生成各自能够自动识别的指令与 MCP 配置。

| AI 客户端 | 项目知识与规则 | MCP 配置 | 模型配置 |
|---|---|---|---|
| GitHub Copilot / VS Code Agent | `.github/copilot-instructions.md`、V8 typings、Skills | `.vscode/mcp.json` | 支持同步吾码模型库到 Copilot Provider |
| Cursor | `.cursorrules`、`.cursor/rules/microi-skills.mdc`、V8 typings | `.cursor/mcp.json` | 使用 Cursor 自身模型能力 |
| Trae | `AGENTS.md`、Skills、V8 typings | `.trae/mcp.json` | 首次使用需开启项目级 MCP |
| Claude Code | `CLAUDE.md`、Skills | 工作区根 `.mcp.json` | 支持检测/安装 Claude Code，并同步模型库 |
| Codex | `AGENTS.md`、Skills | `~/.codex/config.toml` | 支持同步 Provider、模型目录与环境配置 |
| DeepSeek Harness | `AGENTS.md`、工作区 Skills | `@microi.net/cli` profile bundle | `microi dsh install` 默认安装到 `web` 与 `headless` profile |
| WorkBuddy | `AGENTS.md`；npm 包内含 WorkBuddy Plugin 与全套 Skills | `.workbuddy/mcp.json` | 保存/重载后可用自然语言自动调用 MCP |
| CodeBuddy | `.codebuddy/skills/microi/SKILL.md`、`.codebuddy/rules/microi.md` | 工作区根 `.mcp.json` | 也可安装包内 `microi@microi-net` 原生插件 |
| Qoder | `.qoder/skills/microi/SKILL.md`、`AGENTS.md` | 工作区根 `.mcp.json` | 当前会话可用 `/skills reload` 刷新 |
| 百度 Comate | `.agents/skills/microi/SKILL.md`、`.comate/skills/microi/SKILL.md` | `.comate/mcp.json` | 自动发现项目 Skills |

各宿主路径依据其官方协议实现：

- [WorkBuddy MCP](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)、[Skills](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market) 与 [插件系统](https://www.codebuddy.cn/docs/workbuddy/Plugins)
- [CodeBuddy Skills](https://www.codebuddy.cn/docs/cli/skills)、[MCP](https://www.codebuddy.cn/docs/cli/mcp) 与 [插件规范](https://www.codebuddy.cn/docs/cli/plugins-reference)
- [Qoder Skills](https://docs.qoder.com/en/cli/Skills)、[MCP](https://docs.qoder.com/en/cli/mcp-servers) 与 [AGENTS.md 规则兼容](https://docs.qoder.com/user-guide/rules)
- [百度 Comate Skills](https://cloud.baidu.com/doc/COMATE/s/Nmma28iqe) 与 [MCP.json](https://cloud.baidu.com/doc/COMATE/s/Ymir0x2ye)
- [DeepSeek Harness profile/plugin 协议](https://github.com/deepseek-ai/deepseek-harness/blob/main/apps/cli/reference/README.zh.md) 与 [DSH MCP Client](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/mcp/mcp-client/README.zh.md)

VS Code 插件和 CLI 都支持本地 stdio MCP；远程 SSE 与可视化生命周期管理当前由插件提供：

- **本地 stdio MCP**：推荐方式，由 AI 客户端自动启动 VSIX 或 CLI 包内置的 MCP Server。
- **远程 SSE MCP**：适合团队共享，需要提前部署远程 MCP 服务。
- **一键诊断**：真实执行 `initialize`、`tools/list` 和 `microi_get_status`，区分“配置已存在”与“当前真的可调用”。
- **生命周期管理**：在 Microi 侧栏启动、停止、重启、查看输出、查看配置、启用/禁用或移除 MCP Server。

> Codex 已打开的会话通常不会热加载新增 MCP。首次生成配置后，请新开 Codex 对话或重载 Codex；其他客户端也可能要求首次批准新 MCP Server。
>
> WorkBuddy 官方项目 MCP 路径是 `.workbuddy/mcp.json`；CodeBuddy 与 Qoder 使用根 `.mcp.json`；Comate 使用 `.comate/mcp.json`。CLI 和 VS Code 插件会一次性幂等生成这些文件，但不能绕过各宿主的工作区信任、插件授权或重载机制。
>
> DeepSeek Harness 不读取上述 `.mcp.json`。它使用 `$DSH_HOME/profiles/<profile>/package.json` 中的 bundle 层；安装完成后工具名为 `mcp__microi__microi_codex`，再由同源路由器发现和调用完整 Microi MCP 工具集。

## 零配置知识库：AI 自动理解 Microi

插件把稳定知识、专项规范和实时业务结构分层管理：

- **公共知识层**：V8 API、`_Where` 语法、上下文变量、表单事件、HTTP/缓存/数据库/Office 等稳定知识。
- **Skills 规范层**：低代码建模、V8、表单布局、菜单按钮、界面引擎、打印引擎、UniApp、前端微服务、E2E、性能测试和全系统交付规范。
- **实时事实层**：当前 OsClient 的数据库、菜单、接口、事件、应用与蓝图，优先通过 MCP 查询。
- **本地快照层**：`.microi-db-schema.md` 与本地 V8/前端源码，便于离线分析、Diff 和 Git 管理。

即使只是一个空目录，也可以通过 VS Code 插件或 CLI 直接初始化。工具会生成或维护：

```text
工作区根目录/
├── AGENTS.md
├── CLAUDE.md
├── .github/copilot-instructions.md
├── .cursorrules
├── .cursor/rules/microi-skills.mdc
├── microi.skills/
├── .vscode/mcp.json
├── .cursor/mcp.json
├── .trae/mcp.json
├── .mcp.json
└── Microi-V8-Engine/
    ├── .microi-typings/v8-engine.d.ts
    ├── jsconfig.json
    └── {服务器}/{OsClient.Type.Network}/
        ├── .microi-db-schema.md
        ├── 接口引擎/
        ├── 表单引擎/
        ├── 模块引擎/
        ├── 流程引擎/
        └── AI应用/
```

MCP 配置、Token 文件、Windows DPAPI 凭据保险库、数据库快照和运行态元数据会加入本地 Git exclude，避免把个人服务器信息误提交给团队。工具升级 Skills 时使用逐文件 hash 判断：自动生成且用户未修改的文件可以安全升级，本地已经改过的文件会被保留。

## 快速开始：任选 VS Code 或纯命令行

两种入口都要求拥有可访问的 Microi吾码服务器与帐号。最终生成的 `AGENTS.md`、Skills、MCP 配置和 `Microi-V8-Engine/` 目录一致。

### 方案 A：VS Code 插件

要求 VS Code `1.85.0` 或更高版本。

1. 在扩展市场搜索 **`Microi吾码`**，或从扩展面板安装 `v8-engine-x.x.x.vsix`。
2. 打开 **`Microi: 插件配置`**，输入 API Base URL 和 OsClient，点击“检测服务器，登录并保存连接”。
3. 输入帐号、密码；服务端开启验证码时一并输入。凭据以 VS Code `SecretStorage` 为主，并在 Windows 当前工作区镜像为 DPAPI CurrentUser 加密的 `Microi-V8-Engine/.microi-workspace-secrets.dpapi.json`，供 CLI/MCP 在验签密钥变化后静默续登；不会写入明文配置或 MCP 环境。
4. 执行 **`Microi: 初始化AI配置`**，生成 AI 指令、Skills、V8 typings、`jsconfig.json` 和 MCP 配置。
5. 如需复查，执行 **`Microi MCP: 诊断 MCP 可调用性`**。
6. 需要人工编辑、Git 管理或远程调试时，在服务器节点执行 **“拉取此服务器代码”**。

### 方案 B：任意 AI 编程软件 / 纯命令行

要求 Node.js `18.18.0` 或更高版本。npm 首次公开发布后安装：

```bash
npm install -g @microi.net/cli
```

CLI 首次发布前，从 `Microi.Agent` 源码目录本地安装也能完成同样验证：

```bash
npm install -g ./Microi.Agent/plugins/microi
```

进入准备作为 AI 工作区的目录并运行：

```bash
microi init --pull
```

命令会按顺序完成：添加服务器连接、提示输入帐号和密码、在需要时保存验证码图片并提示输入、登录、注入 AI/Skills/typings、配置 MCP，并在显式传入 `--pull` 时拉取全部 V8 资源和数据库结构。密码不会进入命令行、日志、明文配置或 MCP 环境；Windows 需要自动续登时只写入当前用户 DPAPI 加密的工作区保险库。

如果只初始化 AI 和 MCP、暂不拉取代码：

```bash
microi init
```

首次写入 Codex MCP 后，已经打开的对话继续使用已加载工具且不被强制结束；新增工具在下一次自然新建对话或宿主重启时生效。

在一个完全空白的工作区，可以直接对 DeepSeek Harness、WorkBuddy、CodeBuddy、Qoder、Comate、Trae、Cursor、Claude Code 或 Codex 说：

```text
安装 @microi.net/cli@latest，在当前工作区初始化 Microi吾码插件；
添加 API 地址为 <地址>、OsClient 为 <租户> 的服务器连接并配置 MCP；
登录后拉取该连接的所有 V8 代码和数据库结构，最后运行 doctor 验证。
```

因为第一句话已经明确给出可信 npm 包名，具备终端权限的 Agent 可以直接执行 `npx --yes @microi.net/cli@latest init --workspace <工作区> --pull`。账号、密码和验证码仍通过交互输入，不得写进对话或命令参数。初始化后生成的宿主路由 Skill 会识别更短的“帮我初始化 Microi吾码插件”“拉取某服务器/MCP 的所有 V8 代码”等说法。

### 方案 C：Codex Plugin

Codex Plugin 已合并在 `@microi.net/cli` 中，marketplace 固定名为 `microi-net`，选择器为 `microi@microi-net`。安装器默认非交互执行，可直接让 AI 执行：

```bash
npx --yes @microi.net/cli@latest codex install --yes
```

#### 自动安装流程

因此在全新 Codex 的空目录里，用户可以直接说“**通过 `@microi.net/cli@latest` 安装吾码 Codex 插件**”。具备终端和网络权限的 Codex 会执行上面的确定性命令：npm 仅负责下载，CLI 将包内完整插件复制到当前用户的 `~/.codex/microi-net-marketplace/plugins/microi`（设置 `CODEX_HOME` 时使用对应目录），注册 Codex 官方支持的本地 marketplace，再安装、启用 `microi@microi-net`。Codex 下次自然启动后，“插件”页面显示 **Microi吾码**，来源为 **microi-net**；当前任务不必重载即可继续。

#### 安装后验收

已安装 CLI 时也可运行 `microi codex status --json` 检测、运行 `microi codex install` 安装。`--yes` 只兼容旧版无人值守脚本，不再是允许继续工作的授权开关。

#### 非阻塞自动更新

VS Code 扩展激活、Codex Router 启动以及任一常规 `microi` 命令都会轻量投递：

```bash
microi update --background --workspace "<工作区绝对路径>" --json
```

更新器只从 npm 官方 registry 查询和安装 `@microi.net/cli`，随后幂等更新 Codex 插件、检测到的 DeepSeek Harness profile bundle、工作区 AI 指令、Skills 与 MCP，并执行 `doctor` / `codex status` / `dsh status`。运行中的 VS Code Extension Host、CLI、Codex Router、DSH 会话和 MCP 不被终止或强制重载；新版 MCP 写入 `~/.microi/runtime/versions/<version>`，原子切换 `current.json` 后仅供新进程使用。

断网、权限不足、Windows `EBUSY` 文件占用或宿主暂不支持热更新时，状态写入 `~/.microi/updater/status.json` 并在后台延后重试。界面可以非模态提示“立即重试/查看日志”，但用户不处理也不影响当前、正在进行或新建工作。设置 `microi.automaticUpdates=false` 可显式关闭 VS Code 端自动检查，已有功能仍照常使用。

从开发工具 5.8.0 起，更新器会从已安装的 Node.js 目录查找 npm，包括插件安装的 `~/.microi/nodejs`、Homebrew、Volta 和 NVM；使用绝对入口启动，并为 npm 子进程补齐 Node.js 路径。macOS 从 Dock 启动 VS Code 未继承终端 PATH 时，也能完成更新。日志中的 `spawnSync npm ENOENT` 表示本机未找到 npm 入口；先更新扩展，再在吾码设置中安装本地 Node.js，或安装官方 Node.js。查看 `~/.microi/updater/status.json` 可确认实际结果，安装新版扩展不要求中断当前工作。

开发仓库先运行 `npm run codex:build`，再用 `microi codex install --yes --source ./Microi.Agent` 验收仓库 marketplace；重启 ChatGPT/Codex 桌面端后，来源显示为 **Microi.Net**。npm 安装器生成用户本地 marketplace 所使用的模板见 `codex/marketplace.npm.json`。

安装后在新 Codex 任务中先调用 `microi_codex` 的 `profiles` 动作。它会读取 `Microi-V8-Engine/.microi-config.json`；未初始化时，使用插件内置 `scripts/microi-cli.js init --workspace <工作区>`。多连接时把 `profiles` 返回的稳定 `name` 传给后续工具调用。

> npm 包完成 CLI 下载与用户本地 marketplace 安装，不会自动进入 ChatGPT/Codex 通用公开插件目录；通用目录仍需按 OpenAI 官方 Plugin 提交流程审核。

### 方案 D：DeepSeek Harness 原生 Profile Bundle

DeepSeek Harness 已安装并且 `dsh`、`pnpm` 可用时，可让 AI 直接执行：

```bash
npx --yes @microi.net/cli@latest dsh install
```

这不是把 `.mcp.json` 复制给 DSH：`@microi.net/cli` 自身声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，安装器按官方命令 `dsh plugin --profile <name> add <package>` 将同一 npm 包加入 profile。默认同时覆盖官方 `web`、`headless` profile；只安装一个自定义 profile 时使用 `microi dsh install --profile <名称>`。

安装后运行 `microi dsh status --json`，必须同时回读依赖、已安装版本、bundle patch 文件和 `dsh.profile.bundles` 激活状态。新增 bundle 需要新建 DSH 会话；安装器不会终止当前会话或伪称旧会话已经热加载。开发仓库使用 `microi dsh install --source ./Microi.Agent --force` 验收本地包，公开用户则要等包含 `cordis.patch.yml` 的新版 `@microi.net/cli` 正式发布。

### 方案 E：WorkBuddy / CodeBuddy 原生 Plugin（可选）

`@microi.net/cli` 包根包含 `.workbuddy-plugin/plugin.json`、`.codebuddy-plugin/plugin.json`、两个 marketplace 清单、根 `.mcp.json` 和全套 `skills/`。先运行 `microi plugin path --json` 获取真实 `packageRoot`。CodeBuddy CLI 可把该目录添加为本地 marketplace 并安装 `microi@microi-net`；WorkBuddy 可在插件页添加可信 marketplace，或导入本地 Skill。宿主级插件用于跨项目自动发现；单个项目只执行 `microi init` 也能获得原生 MCP、规则和项目 Skills。

### 开始自然语言开发

在 Copilot、Cursor、Trae、Claude Code、Codex、DeepSeek Harness、WorkBuddy、CodeBuddy、Qoder 或 Comate 中描述系统需求即可。插件和 CLI 都建议让 AI 明确执行以下流程：

```text
先读取当前租户状态、业务蓝图、数据库结构和已有在线应用；
整理完整方案并 dry-run；
我确认后再真实写入；
写入后回读验证、生成 E2E 测试，并检查同步状态。
```

## 三端能力与交互边界

CLI 与多宿主 Plugin 的目标是让用户**无需先安装 IDE，也能完整启用 Microi 的 AI 开发能力**，不是把编辑器 UI 生硬复制到终端或对话。各端连接后均通过同一套 MCP 与 Skills 完成平台建模、V8、页面、打印、工作流、微服务和验收。

| 能力 | VS Code 插件 | `@microi.net/cli` 命令行 | Codex / DeepSeek Harness Plugin（同一 `@microi.net/cli`） |
|---|---|---|---|
| 多服务器连接、帐号/密码/验证码登录 | 可视化表单 | 交互式命令行 | 内置 CLI + `profiles` 路由 |
| AI 指令、Skills、typings、MCP 初始化 | 支持 | 支持 | 自带全套 Skills/MCP，也可注入工作区 |
| V8/字段/模块/流程/数据库结构拉取 | 资源树操作 | `microi pull` | 内置 CLI 或 MCP |
| 远端差异检查、单文件显式推送 | Diff/同步结果视图 | `microi sync status` / `microi push` | CLI + Codex 原生 diff/patch |
| 平台建模与写入 | AI 通过 MCP | AI 通过同一 MCP | `microi_codex` 路由同一原工具 |
| 接口引擎远程执行 | 编辑器按钮；AI MCP | AI MCP | MCP + `v8-debugging` Skill |
| 调试交互 | DAP 断点/变量/Step | 结构化执行与诊断 | 结构化执行、补丁、复测；不复制 DAP UI |
| 前端微服务构建、发布 | 可视化命令 | AI 通过 MCP/终端 | `microi-microservice` Skill + MCP/终端 |
| MCP 进程启停与输出 | 可视化管理 | AI 客户端管理；`doctor` 诊断 | 宿主管理；同源路由器报告连接状态 |

## CLI 常用命令

| 命令 | 作用 |
|---|---|
| `microi init [--pull]` | 一次完成连接、登录、AI/MCP 初始化；可选全量拉取 |
| `microi profile list` | 查看连接、稳定 `mcpName` 及登录状态 |
| `microi profile add` / `remove` | 添加或删除服务器连接 |
| `microi auth login` / `status` / `logout` | 管理工作区登录 Token |
| `microi ai init` | 生成或更新 AI 指令、Skills、typings 与 MCP |
| `microi mcp init` | 幂等更新各 AI 客户端 MCP 配置 |
| `microi update --background` | 后台更新 CLI、Codex/DSH 插件与工作区 AI/MCP；失败延后且不阻断工作 |
| `microi dsh install [--profile <名称>]` | 按 DSH 官方协议安装/升级 `web`、`headless` 或指定 profile bundle |
| `microi dsh status [--profile <名称>] --json` | 回读 DSH CLI、profile 依赖、版本、patch 与激活状态 |
| `microi pull --profile <连接/OsClient/mcpName> --scope all` | 按连接拉取全部资源；也可选 `api/form/module/workflow/schema` |
| `microi plugin path --json` | 查看 npm 包根、DeepSeek Harness bundle 和其它宿主插件清单 |
| `microi sync status --scope all` | 读取本地与远端差异 |
| `microi push <file>` | 显式推送一个已拉取的 V8 文件 |
| `microi doctor` | 检查 Node、工作区、Profile、Token、AI 与 MCP 文件 |

通用选项包括 `--workspace <目录>`、`--profile <序号/OsClient/名称/mcpName>` 和 `--json`。`profile list --json` 会返回可直接用于选择服务器的稳定 `mcpName`。远端写入仍遵循显式策略；保存本地文件不会自动推送。

## CLI 与 VS Code 插件同时使用

- 两者共用 `Microi-V8-Engine/.microi-config.json`、`.microi-mcp-tokens.json` 和各服务器 `.microi-meta.json`。
- MCP 配置采用幂等合并，只替换 Microi 管理的 server，保留用户已有的其他 MCP；内容未变化时不重写。
- Windows 下 CLI、插件和 MCP 通过当前工作区 DPAPI 密文保险库共享静默续登凭据；macOS 使用系统 Keychain，并在 Token 文件内保存不含明文的引用。VS Code `SecretStorage` 仍是插件主存储。其它平台不允许退化为明文或伪加密文件；三者继续共用最新 Token 文件。
- 本地 V8 文件和同步基线是共同事实源。切换工具前先执行差异检查，任何一端都不要在冲突未处理时强行拉取或推送。
- 多个终端或编辑器同时操作同一工作区时，不要并发推送同一个资源。

## V8 本地开发、执行与调试

插件与 CLI 共用以下 V8 资源；编辑器内执行和逐行调试界面由插件提供：

- 接口引擎代码。
- 表单前端/后端 V8 事件。
- 字段 `V8Code`、`KeyupV8Code`、模板事件等代码。
- 模块按钮、批量按钮、表单按钮、页面按钮与 Tab 显隐代码。
- 工作流节点 V8 事件。

表单事件文件采用“实时字段 Label（EventType）”命名。`SubmitFormV8` 为 `前端表单提交前V8事件（SubmitFormV8）.js`，`OutFormV8` 为 `前端表单提交后V8事件（OutFormV8）.js`；插件拉取时会迁移旧名“前端表单提交V8事件/前端表单退出V8事件”，并同步更新 `.microi-meta.json`。

典型人工开发闭环：

1. 从左侧服务器、表或模块节点拉取资源。
2. 在 `.js` 文件中输入 `V8.` 获得类型提示和智能补全。
3. 保存文件；保存只会更新“本地已修改”状态，**不会静默覆盖远端**。
4. 执行“推送当前文件到数据库”或服务器“一键同步”；插件会为接口引擎和 V8 事件维护语义版本，服务端只在代码内容真实变化时写入新的代码版本记录。
5. 对接口引擎执行“远程执行”或“远程逐行调试”。
6. 在“同步结果”视图查看本地、远端和冲突差异。

### 远程执行

对接口引擎文件执行 **`Microi: 远程执行当前接口引擎`**，在参数面板填写 JSON：

- 使用目标服务器的真实 V8 环境和登录态。
- 输出结果与 `console.log` 记录到 Microi Output。
- 异常会尽量定位到对应源代码行。

### 远程逐行调试

执行 **`Microi: 远程逐行调试当前接口引擎`**，支持：

- 行断点与启动时暂停。
- Continue、Step Over、Step In、Step Out。
- 局部变量、作用域与表达式求值。
- 调试控制台和停止会话。

也可以使用 `launch.json`：

```json
{
  "type": "microi-v8-remote",
  "request": "launch",
  "name": "Microi V8 远程调试",
  "program": "${file}",
  "params": {},
  "stopOnEntry": true
}
```

## 本地与远端同步

每个服务器都有独立 `.microi-meta.json` 基线。同步检查会区分：

- **本地未推送**：本地文件较新或尚未建立远端基线。
- **服务器端已修改**：远端较新，本地未改。
- **冲突**：同一资源本地和远端都发生修改。
- **已同步**：正文和同步基线一致。

“一键同步此服务器代码”会在无冲突时先推送本地较新的文件，再拉取服务器最新代码；存在冲突时停止自动操作并展示冲突列表。首次空目录拉取可以直接执行，已有本地内容时会先提示检测同步状态，避免强制覆盖。

同步结果支持：

- 按服务器或接口/表单/模块/流程分类检查。
- 下钻到资源 Key、名称、文件路径和时间。
- 连续打开 VS Code Diff，不必每次重新扫描。
- 前端微服务文本 Diff 与二进制 SHA-256 状态检查。
- 重新检测和清空结果。

## 前端微服务与复杂定制页面

三个以上字段、复杂联动、上传、表格、Tab、步骤条、代码编辑器或长期维护的弹窗，不需要在 V8 中拼接大段 HTML。AI 可以创建或扩展一个 MicroService，由 Microi 宿主以标准方式打开。

插件提供完整的本地微服务工作流：

| 操作 | 说明 |
|---|---|
| 创建前端微服务 | 生成项目元数据、基础源码、`.microi-micro-app.json` 和路由清单 |
| 拉取服务器前端微服务 | 获取在线 AI 应用的私有源码到本地 |
| 构建 | 执行项目构建并检查 `dist` 产物 |
| 推送 | 上传构建产物并更新 Microi 微服务元数据 |
| 构建并推送 | 一次完成构建、版本更新和发布 |
| 同步源码到在线 AI 应用 | 保存可继续被在线 AI 或其他开发者维护的私有源码 |
| 查看同步状态 | 比较本地与远端源码，识别本地修改、远端修改和冲突 |

前端微服务统一放在当前租户的 `AI应用/{appKey}/`。`microi.routes.json` 作为路由事实源，发布与迁移时会保留必要的历史菜单 URL / 组件路径兼容信息。

## Playwright E2E 自动化测试

插件会把自动化工程生成到目标前端项目的 `.microi-e2e/`，不污染业务源码目录。

| 命令 | 作用 |
|---|---|
| `Microi: 初始化端到端自动化测试（Playwright E2E）` | 生成配置、Microi helpers、环境变量示例和基础测试 |
| `Microi: 运行端到端自动化测试（Playwright E2E）` | 运行项目的 `test:e2e` |
| `Microi: 打开端到端测试报告（Playwright Report）` | 打开 HTML 报告 |

初始化时会读取当前连接，并尝试通过后端获取菜单路由与接口引擎上下文，写入 `.microi-playwright-context.json`。生成的基础用例覆盖：

- 公共页面和接口引擎冒烟。
- DosResult 接口契约。
- 登录 Token 注入与认证会话。
- API 4xx/5xx、空响应、字符串 `null` 和无效 JSON 守卫。
- 图片加载、第三方占位资源、横向溢出和明显“开发中/请求失败”文案检查。
- Desktop 与 Mobile 两套浏览器项目。

## 性能压力测试

打开 **`Microi: 性能测试`**，可直接复用当前 Microi 连接测试：

| 目标 | 说明 |
|---|---|
| 接口引擎 | 真实调用 `/apiengine/{ApiEngineKey}`，支持 JSON 参数、并发、总次数、持续时间、升压和超时 |
| V8 事件 | 读取已有表单事件或执行临时代码，通过 `ExecuteV8Event` 隔离测试 |
| 表 CRUD | 对测试表执行新增、查询、修改、删除闭环，真实触发服务端 V8 事件 |

报告展示完成数、成功/失败、RPS、平均耗时、P95、P99、错误率、每秒趋势和错误 Top，并可保存到工作区 `.microi-performance/`。表 CRUD 会产生真实写入，建议使用测试表并保持“每次迭代后删除测试行”开启。

## 多服务器与身份管理

- 同一工作区可保存多个服务器 / OsClient Profile。
- 服务器标题优先从 `SysShortTitle` / `SysTitle` 获取。
- 每个 Profile 独立保存 Token 和本地资源目录；Windows 自动续登凭据仅存于 VS Code `SecretStorage` 与当前工作区 DPAPI CurrentUser 密文保险库，CLI/MCP 不接收明文密码参数。
- VS Code/MCP Token 默认访问期为 20 天，租户显式配置优先。Token 临近失效时自动刷新；服务端验签密钥变化时按 Profile 从保险库自动续登并原子更新 Token/MCP，只有保险库缺失或解密失败才提示人工登录。
- “Token 签名验证失败”不等同于“Token 已过期”。同一 `OsClient` 的 Product/Internal、Product/Internet 等 SaaS 运行记录必须共用一个 `AuthSecret`；后端在 JWT 初始化前做 CAS 收敛，只有可信后端写入新的唯一 `AuthSecretRotateVersion` 才轮换密钥，避免升级或实例切换让刚登录的 Token 失效。
- 支持有验证码和无验证码登录。
- MCP Server key、显示名称和设备标识会转换为安全的 ASCII 传输格式，兼容中文 Windows 主机名与不同 AI 客户端。
- Windows 工作区会自动启用当前 Git 仓库的 `core.longpaths=true`，降低深层 V8 目录的长路径问题。

## VS Code 插件配置项

在 VS Code 设置中搜索 `microi`：

| 设置项 | 默认值 | 说明 |
|---|---:|---|
| `microi.apiBaseUrl` | `""` | 单连接模式的 Microi 后端 API 地址 |
| `microi.profiles` | `[]` | 多服务器连接配置列表 |
| `microi.osClient` | `""` | 单连接模式的默认 OsClient |
| `microi.localDir` | `""` | 本地同步目录；留空使用工作区 `Microi-V8-Engine/` |
| `microi.showConsoleOnExecute` | `true` | 远程执行时自动显示 Output |
| `microi.playwright.defaultBaseUrl` | `http://127.0.0.1:5180` | Playwright 默认前端地址 |
| `microi.playwright.defaultApiBaseUrl` | `""` | Playwright 默认 API；留空使用当前连接 |
| `microi.playwright.defaultOsClient` | `""` | Playwright 默认 OsClient；留空使用当前连接 |
| `microi.playwright.browserChannel` | `""` | 浏览器 channel，例如 `msedge` |
| `microi.playwright.appType` | `uniapp-h5` | `uniapp-h5`、`pc-vue` 或 `web` |

## VS Code 插件完整命令清单

按 `Ctrl+Shift+P`（macOS：`Cmd+Shift+P`），输入 `Microi` 查看命令。

### 连接、AI 与 MCP

| 命令 |
|---|
| `Microi: 插件配置` |
| `Microi: 登录` |
| `Microi: 退出登录` |
| `Microi: 切换 OsClient` |
| `Microi: 初始化AI配置` |
| `Microi: 配置 MCP（AI 工具连接）` |
| `Microi MCP: 刷新 MCP 状态` |
| `Microi MCP: 诊断 MCP 可调用性` |
| `Microi MCP: 启动全部 MCP 服务器` |
| `Microi MCP: 启动 MCP 服务器` |
| `Microi MCP: 停止 MCP 服务器` |
| `Microi MCP: 重启 MCP 服务器` |
| `Microi MCP: 显示 MCP 输出` |
| `Microi MCP: 显示 MCP 配置` |
| `Microi MCP: MCP 服务器选项（启用/禁用）` |
| `Microi MCP: 显示已安装 MCP 服务器` |
| `Microi MCP: 删除 MCP 配置` |

### V8、资源与同步

| 命令 |
|---|
| `Microi: 新增接口引擎` |
| `Microi: 新建表单V8事件文件` |
| `Microi: 新建流程节点V8事件文件` |
| `Microi: 新建按钮V8事件文件` |
| `Microi: 拉取此服务器代码` |
| `Microi: 一键同步此服务器代码` |
| `Microi: 拉取此表字段V8事件` |
| `Microi: 拉取此模块子树` |
| `Microi: 搜索引擎文件` |
| `Microi: 拉取数据库结构到AI知识库` |
| `Microi: 推送当前文件到数据库` |
| `Microi: 与远程版本对比` |
| `Microi: 查看同步状态` |
| `Microi: 检测同步冲突` |
| `Microi: 查看同步差异` |
| `Microi: 重新检测同步状态` |
| `Microi: 清空同步结果` |
| `Microi: 打开文件` |
| `Microi: 在资源管理器中打开` |
| `Microi: 复制 ApiEngineKey` |
| `Microi: 刷新` |

### 执行与调试

| 命令 |
|---|
| `Microi: 远程执行当前接口引擎` |
| `Microi: 远程逐行调试当前接口引擎` |
| `Microi: 停止调试会话` |

### 前端微服务

| 命令 |
|---|
| `Microi: 创建前端微服务` |
| `Microi: 拉取服务器前端微服务` |
| `Microi: 构建前端微服务` |
| `Microi: 推送前端微服务到数据库` |
| `Microi: 构建并推送前端微服务` |
| `Microi: 同步微服务源码到在线 AI 应用` |
| `Microi: 查看前端微服务同步状态` |

### 测试

| 命令 |
|---|
| `Microi: 性能测试` |
| `Microi: 初始化端到端自动化测试（Playwright E2E）` |
| `Microi: 运行端到端自动化测试（Playwright E2E）` |
| `Microi: 打开端到端测试报告（Playwright Report）` |

## CLI 与 Codex Plugin 命名、打包与发布

### 包名与产物边界

唯一 AI/npm 包名为 **`@microi.net/cli`**，安装后暴露命令 **`microi`**，包根同时包含 `.codex-plugin/plugin.json`、`.codebuddy-plugin/plugin.json`、`.workbuddy-plugin/plugin.json`、DeepSeek Harness 的 `dsh.bundle` / `cordis.patch.yml`、对应 marketplace、MCP、路由器与全套 Skills。现有未带 scope 的 **`microi.net`** 是另一项已发布的前端库，继续保持原用途，不能在兼容版本中改造成 CLI。

一套 `Microi.Agent` 输出桌面工作台、VS Code 扩展和 CLI / AI Plugin。Microi Agent 安装包使用独立桌面版本，由吾码 HDFS 公有桶分发；其余产品沿用现有发布链路：VS Code 扩展发布到 Visual Studio Marketplace 与 Open VSX；`@microi.net/cli` 只向 npm 发布一次，同时服务 CLI、Codex、DeepSeek Harness、WorkBuddy、CodeBuddy、Qoder、Comate 等宿主。`bump-version.js` 同时更新扩展、单一 npm 包、各宿主 manifest/marketplace 和 bundled Skills；任一版本不一致都会在外部写入前停止。

### 发布顺序与失败边界

三个分发目标不支持跨站事务，发布按以下边界执行：

1. **身份校验**：`npm run publish` 优先使用 `NPM_TOKEN`，其次读取 `publish-tokens.local.json` 中的 npm Granular Access Token；都不可用时，在版本递增和构建前执行一次交互式 `npm login`。
2. **固定顺序**：授权完成后自动构建，先发布 `@microi.net/cli`，再发布 Visual Studio Marketplace 与 Open VSX。
3. **失败可补发**：任一目标失败不会撤销已完成目标；原始 npm tarball 与 VSIX 会保留，可用同一版本补发。
4. **精准回读**：上传命令成功即结束该目标。只有上传报错或执行补发时，才短时回读对应目标，排除“服务端已写入、客户端收到 5xx 或断线”的不确定状态。
5. **主动验收**：诊断全部公开状态时运行 `npm run publish:verify`；严格发布使用 `npm run publish:preflight:all` 与 `npm run publish:strict`。

### 本地构建与安装验收

```bash
cd Microi.Agent
npm install
npm run cli:typecheck
npm run build
npm run cli:test
npm run codex:test
npm run dsh:test
python %USERPROFILE%/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/microi
npm run package
node scripts/test-cli-package.js
node scripts/test-codex-plugin-package.js
npm install -g ./plugins/microi
microi --help
```

只生成并校验 VSIX 与同时包含 CLI/Codex/DeepSeek Harness Plugin 的单一 npm tarball，不改版本也不上传：

```bash
node publish.js --package-only --no-bump
```

### 首次发布到 npm

1. 登录 npmjs.com，创建免费公开组织 **`microi.net`**；组织名会成为 `@microi.net` scope。若由个人 scope 发布，则 npm 用户名必须正好是 `microi.net`。
2. 推荐在 npmjs.com 的 **Access Tokens** 中生成 Granular Access Token：Packages and scopes 只选择 `@microi.net/cli`（或最小必要的 `@microi.net` scope）、权限设为 **Read and write**，开启 **Bypass 2FA** 并设置有效期。包的 Publishing access 必须允许“2FA 或启用 Bypass 2FA 的 Granular Token”；若设为 disallow tokens，则只能交互发布。把 Token 放入环境变量 `NPM_TOKEN`，或填写到已忽略的 `publish-tokens.local.json` 的 `npm` 字段，禁止写入被 Git 跟踪的文件。脚本只把 Token 传给 npm 子进程，临时 npmrc 只保存 `${NPM_TOKEN}` 占位符，不落盘明文。
3. 为两个插件市场准备 PAT。本机可设置环境变量 `VSCE_PAT` / `OVSX_PAT`，或把 `publish-tokens.example.json` 复制为已被 Git 忽略的 `publish-tokens.local.json`。没有可用 npm Token 或登录会话时，默认发布会在流程最前面执行一次 `npm login --registry=https://registry.npmjs.org/`，完成后全自动继续。不要再使用 `publish-tokens.json`。
4. 如果仓库曾跟踪过 `publish-tokens.json`，应把其中的 PAT 视为已泄露：先在两个平台废弃并重新生成，把新 PAT 放入环境变量或 `publish-tokens.local.json`，再删除旧文件并执行 `git rm --cached publish-tokens.json`。发布脚本遇到该旧路径会主动停止。
5. 回到 `Microi.Agent` 执行 `npm run publish:preflight`。脚本会检查 `@microi.net/cli` 的 registry/scope 权限，并调用 `vsce verify-pat` 与 `ovsx verify-pat`；仅缺 npm 登录时不会阻断两个扩展市场。要求全部目标在版本递增前通过时，执行 `npm run publish:preflight:all`。
6. 先运行 `npm run package` 检查本地产物；确认后执行 `npm run publish`。
7. 正常上传命令成功返回后不做公开 registry/市场回读。看到 `npm 发布完成`、`Visual Studio Marketplace 发布完成` 或 `Open VSX Registry 发布完成` 即结束对应目标；只有上传命令报错或执行补发时才精确确认该版本是否已存在。如需主动诊断全部公开状态，执行 `npm run publish:verify`，或手工复核：

```bash
npm view @microi.net/cli version
npx vsce show Microi.v8-engine --json
npx ovsx get Microi.v8-engine --metadata
npm install -g @microi.net/cli
microi --help
```

npm 新 scope 或新版本刚发布后，公共 registry 可能短时间不同步。只有显式执行 `npm run publish:verify` 时，诊断命令才会使用 `--prefer-online` 做有限重试；这不会触发重复上传，也不影响已成功返回的发布结果。

Open VSX 等市场偶尔会在已经接收 VSIX 后向客户端返回 `503 Service Unavailable`。脚本遇到这类上传错误会短时回读当前精确版本：若已找到该版本，就显示“异常后回读确认”并按成功继续，不会重复上传；若仍无法确认，则干净地报告部分完成并给出补发命令，不再输出未捕获的 Node.js 调用栈。

如果 npm 因登录取消、scope、权限或上传错误而不可发布，默认流程仍继续处理两个扩展市场，并在项目根保留一个同版本 tarball。**不要再次执行 `npm run publish`**。在源码和原始 tarball 未改变时补发唯一 npm 包：

```bash
npm run publish:cli:resume
```

如果 npm 单包已发布、扩展市场未完成，执行 `npm run publish:extensions:resume`。只补一个扩展市场使用 `publish:vsce:resume` 或 `publish:ovsx:resume`。补发不递增版本、不重新构建，而是复用当次保留的原始 VSIX；上传前只确认所选市场的精确版本，若已公开则直接跳过重复上传，不回读其它目标。

> 补发只适用于“同一份源码和产物的当次发布被中断”。如果失败后又修改了代码，必须重新完整发布下一版，不能用相同版本号发布不同产物。

> 发布 `@microi.net/cli` 只完成 CLI 下载与用户本地 marketplace 安装能力，不会自动进入 ChatGPT/Codex 通用公开插件目录；公开目录需另按 OpenAI 官方 Plugin 提交流程审核。

正式发布是外部不可逆操作。不要把 npm Token、服务器 Token 或任何登录密码写入被 Git 跟踪的文件；本机 Token 应限制到单包、最小权限并定期轮换。CI 优先使用 npm Trusted Publishing（OIDC），避免长期保存发布 Token。

## 使用截图

<p align="center">
  <img src="https://static.itdos.com/upload/img/V8引擎本地AI编程连接配置.png" width="49%" alt="Microi 连接配置">
  <img src="https://static.itdos.com/upload/img/V8引擎本地AI编程运行调试.png" width="49%" alt="Microi 运行调试">
</p>

## 常见问题

### MCP 显示已配置，但 AI 仍说没有工具

先执行 **`Microi MCP: 诊断 MCP 可调用性`**。它会验证配置、进程启动、`initialize`、`tools/list` 和只读状态调用，而不只是检查 JSON 文件是否存在。

如果诊断成功但 Codex 当前对话仍没有工具，请新开对话或重载 Codex；当前会话通常不会热加载新 MCP。还可以使用 `microi_codex` 单入口或 MCP 资源兼容通道。

### 保存文件后为什么远端没有变化

当前版本采用显式发布策略：保存只标记本地变更。请执行 **“推送当前文件到数据库”**，或在服务器节点执行 **“一键同步此服务器代码”**。这样可以避免普通保存动作无提示地覆盖远端生产代码。

### 拉取会不会覆盖本地代码

首次空目录可以直接拉取；已有同步基线或本地文件时，插件会先提示检测同步状态。建议先查看同步结果，处理冲突后再一键同步，不要直接强行拉取。

### 空工作区可以使用吗

可以。打开任意空文件夹执行 **`Microi: 初始化AI配置`**，或在该目录运行 `microi init`，都会生成 Skills、AI 指令、V8 typings 和 `jsconfig.json`；添加服务器并登录后，还会生成对应的 MCP 配置。无需提前克隆 Microi 源码或 `microi.skills`。

### 不安装 VS Code，能否完整使用吾码 AI 开发能力

可以。安装 `@microi.net/cli` 后运行 `microi init --pull`；Codex 等宿主读取项目 MCP，DeepSeek Harness 另执行 `microi dsh install` 加载原生 profile bundle。当前对话继续使用已加载版本，新增能力在下一次自然新建对话或宿主启动时接管，不要求立即重载才能继续工作。所谓“完整 AI 开发能力”指自然语言建模、V8、页面、打印、流程、微服务、测试和回读验收；资源树、编辑器 Diff 和断点调试是 IDE 交互能力，只在 VS Code 插件中提供。

### CLI 和 VS Code 插件会不会冲突

不会各建一套配置。两者共用连接、Token、MCP、源码和同步基线。新版共存协议包含：配置/Token 原子写入与未知字段保留；MCP 中写入来源和版本，两者版本不同时由较新版本保持内置 Server 路径；Skills 和 AI 指令 manifest 拒绝被旧 bundle 降级；`microi doctor` 可显示当前 MCP 提供者版本。

已经安装的历史旧版本无法被新代码“隔空修改”，但新版会把 MCP 运行文件放入用户目录的版本隔离目录。已经启动的旧进程继续使用旧文件，新进程读取新版本；若旧全局包仍被历史任务占用，更新器只延后，不会结束任务。两端可以交替操作，但仍不应同时推送同一个远程资源；推送前必须做差异检查。

### `npm install -g @microi.net/cli` 提示包不存在

先用 `npm view @microi.net/cli version --registry=https://registry.npmjs.org/` 回读官方版本，核对当前 registry；新版本发布后的缓存传播可能短暂延迟。开发阶段可在仓库根目录执行 `npm install -g ./Microi.Agent/plugins/microi`。若自动更新日志是 `spawnSync npm ENOENT`，请按上面的“非阻塞自动更新”检查本机 Node.js/npm，而不是重复登录 npm。

### 远程执行与调试不可用

- 确认当前文件属于已拉取的接口引擎，而不是普通 JavaScript 文件。
- 确认目标 Profile 已登录且 Token 有效。
- 检查 Microi Output 中的后端错误。
- 远程逐行调试需要服务器部署对应的 V8 调试能力；不能使用时仍可先远程执行和查看日志。

### 数据库结构很大，会不会拖慢 AI

公共 AI 指令不会内嵌全部业务表。实时结构由 MCP 按需查询，本地结构则按 OsClient 单独保存在 `.microi-db-schema.md`。即使数据库有数百张表，也不会把完整 schema 强塞进每次对话上下文。

## 相关链接

- [Microi吾码官网与官方文档](https://microi.net/)
- [AI 编程指南](https://microi.net/doc/v8-engine/ai-apiengine)
- [MCP Server 完整指南](https://microi.net/doc/v8-engine/mcp-server)
- [GitHub 源码](https://github.com/itdos/microi.net)
- [Gitee 源码](https://gitee.com/ITdos/microi.net)
- [版本更新日志](https://microi.net/doc/about/update-log.html)
- [插件内部开发文档](https://git.itdos.net:88/anderson/microi.vscode/-/blob/master/DEVELOPMENT.md)

## License

[MIT](https://opensource.org/license/mit)

:::

## 更新日志

版本、日期和条目格式沿用[平台更新日志](/doc/about/update-log.html)。安装包版本与 CLI 版本分别管理；历史故障、修复尝试和客户验证边界继续保留。

### v1.3.4 - (2026-10-03)

- **员工工作台**：整理任务、十岗团队、目标与执行设置，提供登录引导、任务筛选、草稿派发、已验收前置成果、成果及审计记录。岗位设置与日预算同步保留，刷新不会覆盖输入中的预算。
- **吾码小龙虾节点迁入**：OpenClaw 受限岗位支持领取、续租、停止接单及结果持久化后幂等回传，配置按租户和负责人隔离；保留已有默认 Agent。完整 Gateway 仍需独立配置，云端成果是待审核草稿。
- **对话交互**：上下键浏览已发送提示词并恢复未发送草稿；已发送消息可编辑、撤回并在分叉会话继续，保留原会话。文件改动不会自动撤销；文件附件须在新会话重新添加。
- **账号与技能**：重整登录表单及员工页面的排版、间距和窄窗口布局；安装包内置 Skills，干净工作区可发现 `/microi`。
- **二开保护与验证**：上游同步脚本保护补丁、员工节点、Skills 和专项测试；旧版失败对照及修复版回归通过。1,045 项回归通过、10 项平台条件跳过，18 项定向回归、4 项界面验收、1 项实际打包应用的原生组件/Harness 验收及 2 项真实云端成果验收通过。客户 Windows 原生安装、完整 OpenClaw Gateway 与连续 24 小时运行仍待验收。
- **发布渠道**：官网 Windows x64 EXE 与 macOS Universal DMG/ZIP 更新为 1.3.4。macOS 已通过 Developer ID 签名、公证、装订及 Gatekeeper；Windows EXE 未签名。Windows 商店仍为独立 1.3.3 MSIX；Mac 沙盒商店版仍按 Apple 审核进度发布。

| 文件 | 大小 | SHA256 |
| --- | --- | --- |
| [Universal DMG](https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.4/requests/36d7514bcc6974cc16784b436931668d866a26bc41aef185093c074d8dd04cdc/assets/Microi-Agent-1.3.4-mac-universal.dmg) | 381,574,856 字节 | `d54a27349627fd9015319d4239ddd120bb9a3d1b3960676be02bec2402d5c5c6` |
| [Universal ZIP](https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.4/requests/36d7514bcc6974cc16784b436931668d866a26bc41aef185093c074d8dd04cdc/assets/Microi-Agent-1.3.4-mac-universal.zip) | 426,242,249 字节 | `967739c2e8f72e81f6dfe6478c9a7f8dfff8dfa857e25caf22c0312ac4048f74` |
| [Windows x64 EXE](https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.4/requests/36d7514bcc6974cc16784b436931668d866a26bc41aef185093c074d8dd04cdc/assets/Microi-Agent-1.3.4-windows-x64-setup.exe) | 155,006,058 字节 | `f220d69e9f4cebc3f05c7e79a031a9cabbd71fce0ccad33d54c775dbadf3b7b3` |

- [Windows 1.3.4 固定更新清单](https://api.itdos.com/microi-code/updates/archive/1.3.4/latest.yml) · [macOS 1.3.4 固定更新清单](https://api.itdos.com/microi-code/updates/archive/1.3.4/latest-mac.yml)。历史版本继续保留。

### Windows 商店 v1.3.3 已发布 - (2026-10-03)

- **商店状态更新**：Microsoft 后台已显示“在 Microsoft Store 中”，中国区公开产品页已展示 Microi Agent、Microi吾码发行者及产品素材；顶部商店入口同步标注“已发布”。请在 Windows 设备查看获取入口；本机 Mac 未显示获取按钮，Windows 原生获取、安装与启动仍待验收。
- **下载渠道保留**：商店 MSIX 由微软签名分发并通过商店更新；官网 Windows 1.3.2 EXE 仍为未签名测试包。官网 macOS 1.3.2 完整签名公证 DMG 继续可用，独立沙盒 Mac App Store 1.3.2（构建 1.3.3）仍等待 Apple 审核。

### Windows 商店 v1.3.3 / Mac App Store 送审 - (2026-10-02)

- **两个商店正式提交**：Windows x64 MSIX 1.3.3 已通过包验证并进入 Microsoft 认证；Mac App Store 1.3.2（构建 1.3.3）正在等待 Apple 审核。均设为审核通过后免费自动发布，审核期间商店入口可能尚未开放下载。
- **官网增加商店入口**：顶部 Windows、macOS 下载按钮下分别提供 Microsoft Store、Mac App Store 链接与实际审核状态，官网已有 EXE、签名公证 DMG 下载继续可用。更新日志仍位于本文最下方。
- **商店更新与隐私**：Windows 商店版停用站外更新清单、下载和 EXE 安装，仅打开本产品商店页；已补充商店隐私政策。Mac 商店版继续采用独立沙盒客户端，完整本机开发能力使用签名公证 DMG。
- **验证与素材**：Windows 商店更新隔离及普通安装更新行为的 9 项回归、TypeScript 检查通过；MSIX 的 15,563 个文件完成解包哈希核对。商店上传高清 Logo 和实际客户端截屏；客户 Windows 原生安装与启动仍待验证。

### Windows v1.3.2 公开测试 - (2026-10-01)

- **开放最新 Windows 测试下载**：官网永久入口、最新更新清单、版本目录与官方下载资源均已更新为 Windows x64 1.3.2；旧版本及 macOS Universal 1.3.2 签名公证文件继续保留。下载资源应用采用独立的 v1.3.3 发布记录，桌面程序版本为 1.3.2。
- **保留验证边界**：1022 项回归通过、10 项平台条件跳过，生产构建及 MacBook 上真实私有管道 HTTP、Cookie 和 WebSocket 验证通过；**客户 Windows 原生安装及启动仍待确认**。EXE 未签名，Microsoft Store 免费签名仍待账号和应用审核。
- **下载与校验**：[Windows x64 测试安装包](https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.3/requests/f111516a6830ae292ea8e9211a7f2ea764215983872309e25da56d054f9c3296/assets/Microi-Agent-1.3.2-windows-x64-setup.exe)，154,982,105 字节；SHA256：`e83b901c911d78e2e03d1feb018e51709f76ca20650ef7fd10cdcac7b8b4cf47`。[Windows 1.3.2 更新清单归档](https://api.itdos.com/microi-code/updates/archive/1.3.2/latest.yml)。发布后已完整下载并核对大小、SHA256 和 SHA512。

### v1.3.2 - (2026-10-01)

- **macOS Universal 更新并完成签名公证**：支持 Intel 与 Apple Silicon；应用与 DMG 均通过 Developer ID 签名、Apple 公证、票据装订及 Gatekeeper 验证。发布后的更新清单按最终文件重新计算 SHA512，保留 macOS 1.2.2 及全部历史归档。
- **修复本机 TCP 双栈失败后的启动恢复**：只有 IPv4 与 IPv6 的实际 HTTP 探测均失败时，才使用当前 Harness 的私有管道；保留原认证、Cookie、中文请求和 WebSocket 事件流。1022 项回归通过；真实 Harness/Electron 在普通与安全模式通过私有管道进入工作台。Windows x64 1.3.2 候选 EXE 已构建，**客户 Windows 原生安装及启动仍待验收**。
- **Windows 免费签名进度**：Microsoft Store 公司账号已进入身份审核；MSIX 身份、商店签名与应用审核尚未完成，公开 Windows 下载及自动更新继续保持 1.3.1。普通 Microsoft 帐号不能给官网 EXE 提供受信任的代码签名；未签名候选包不标为可信发行。
- **macOS 下载与校验**：通过 `microi_itdos` 发布官方应用 v1.3.2，开发工具 5.8.0 的修复与发布见下一项。

| 文件 | 用途 | 大小 |
| --- | --- | --- |
| [Universal DMG](https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.2/requests/68e890672ce07a22a0296500c4ec88a6d62ee0d91729729279dc8348a6ee1e77/assets/Microi-Agent-1.3.2-mac-universal.dmg) | 手动安装 | 380,707,421 字节 |
| [Universal ZIP](https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.2/requests/68e890672ce07a22a0296500c4ec88a6d62ee0d91729729279dc8348a6ee1e77/assets/Microi-Agent-1.3.2-mac-universal.zip) | 自动更新 | 424,992,762 字节 |

- DMG SHA256：`2bb4ba682de125cfefae90251527ff48b97d8ce504f0f1f4110998e661f9d675`。
- ZIP SHA256：`7726972144f5b118faaf81fe1b023da174b67c92b789a131e2bc1aeb31ffef62`。
- [1.3.2 macOS 更新清单归档](https://api.itdos.com/microi-code/updates/archive/1.3.2/latest-mac.yml)。

### 开发工具 v5.8.0 - (2026-10-01)

- **修复 macOS GUI 自动更新找不到 npm**：更新器从本机已安装的 Node.js 目录发现 npm，使用绝对入口，并为子进程补齐路径；明确区分本机运行时缺失和官方 registry 网络故障。更新过程继续保留现有工作、MCP 与会话。
- **合并并同步开发知识**：合并其他电脑推送的 Skills、MCP 和工作流配置更新；npm、Visual Studio Marketplace、Open VSX 均已回读为 5.8.0。本机 VSIX 已安装；使用 VS Code 自带 Electron 和不含 npm 的 GUI 路径执行真实更新器，最终状态为 `completed`，全局 CLI 为 5.8.0。

### v1.3.1 - (2026-10-01)

- **合并另一台电脑的端口修复**：合并 GitLab master 提交 `084e075`，保留双方代码及开发工具 5.7.8。本机 Harness 与手机配对监听避开浏览器禁止端口；自动命中时最多重选 32 次，显式配置禁止端口立即报错，真实占用和权限错误继续保留。
- **保留回环连接恢复和二开**：继续保留 1.3.0 的受限 IPv6 回环恢复、双通道实际 HTTP 验证、监听诊断、吾码品牌、工作区、会话与本机配置；1.3.0 安装包保持归档，macOS Universal 1.2.2 签名发行与清单保持原样。
- **重新测试并构建**：合并后类型检查、生产构建通过，串行 Vitest 1018 项通过、10 项按平台条件跳过。真实 Harness/Chromium 通过 8 项检查，普通/安全模式共四次冷启动约 4.3–11.9 秒；构建前后 1484 个源码和资源输入哈希一致。**客户 Windows 原生安装与启动仍待确认**。
- **Windows 下载与校验**：通过 `microi_itdos` 发布官方下载应用 v1.3.1；本包未签名，安装包 154,956,328 字节，SHA-256 为 `2d76b5d148ea8d26da41d1877a95293837737cee36d95cc80df091befc1feb3c`。[不可变 EXE](https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.1/requests/f9f26f0bea6edc7ca0113fcd90b06026d6ea61ba7138e25bfbed1502d7d34c87/assets/Microi-Agent-1.3.1-windows-x64-setup.exe)与[更新清单归档](https://api.itdos.com/microi-code/updates/archive/1.3.1/latest.yml)可独立校验。

### v1.3.0 - (2026-10-01)

- **修复 IPv4 双通道连接失败后的启动恢复**：在已公布认证地址、Node 与 Chromium 两条通道连续两次连接失败时，只重启一次到新的 IPv6 `::1` 回环端口。真实 HTTP 500 不触发网络地址切换，也不能作为就绪；普通模式与安全模式遵守相同规则。
- **补齐监听与版本诊断**：日志记录实际应用版本、平台、监听地址、地址族及子进程内 HTTP 自检。探测不发送 Cookie、不跟随重定向，不把启动地址中的 Token 写入新增诊断。IPv6 不可用时保留明确错误，不无限循环或误导用户卸载插件。
- **保留二开与并发成果**：合并 GitLab master 的 1.2.9 修复及交接记录，保留本机 Skills 同步；保护新增运行代码、依赖补丁与回归文件，继续保留工作区、会话、账号、品牌及 MCP。官网下载永久 latest 入口，版本日志移至本页最下方；同期已发布的 macOS Universal 1.2.2 签名发行与清单继续保留。
- **完成开发验收**：类型检查与生产构建通过，串行 Vitest 1013 项通过、10 项按平台条件跳过；真实 Harness 与 Chromium 覆盖普通/安全模式各自的 Node 失败和 IPv4 双通道失败，共四次冷启动。该真实页面验收在 MacBook 上执行，**客户 Windows 原生安装与启动仍待确认**。
- **发布 Windows x64 安装包**：通过 `microi_itdos` 发布官方下载应用 v1.3.0，安装包 154,963,108 字节，SHA-256 为 `3a269fb188d526d33eb48334788e7c6a16bf20795d252ecfbace24e9d0956b63`。本包未签名；[不可变 EXE](https://static.itdos.com/microi/application-assets/v3/tenants/itdos/kinds/runtime/apps/microi-code-downloads/releases/v1.3.0/requests/4d8c1107cf309fa37a27405166cba140ef1d3f04011116badaa229f1580d206c/assets/Microi-Agent-1.3.0-windows-x64-setup.exe)与[更新清单归档](https://api.itdos.com/microi-code/updates/archive/1.3.0/latest.yml)可独立校验。

### v1.2.9 - (2026-10-01)

- **Windows 启动超时与恢复页修复**。
- 2026-10-01 发布。客户日志显示普通模式、安全模式均输出了 Harness 地址，换端口后仍出现 `ETIMEDOUT`；进程最后的 `SIGTERM` 是桌面超时处理主动终止，不能据此认定插件崩溃。
- 本机 HTTP 探测增加独立计时器，覆盖 TCP 连接及响应头等待，避免单次请求阻塞整个启动流程。
- 已取得本次 Harness 认证地址而 Node 探测失败时，使用 Chromium 网络通道复核；收到实际有效 HTTP 响应后才加载页面，500 错误仍按失败处理。探测限定当前 `127.0.0.1` 地址和端口，不发送 Cookie、不跟随跳转。
- 合并滚动日志时保留不同启动尝试的重复错误，恢复页同时参考本次错误快照。本地服务超时显示实际错误，不再误报第三方插件失败。
- 保留 MacBook 同期提交的 Windows 跨平台试验打包入口，通过 Git 合并交付。
- 验收：合并后 128 个测试文件、1015 项通过、1 项仅适用 macOS 的检查跳过，类型检查通过。使用安装包内 Node/Harness 与实际 Chromium 页面验收普通模式和安全模式，注入客户观测到的 Node 超时后仍能加载页面；真实安装目录分别约 10.7 秒和 7.8 秒完成该验收。1.2.8 → 1.2.9 升级覆盖 D 盘中文长路径、C 盘临时目录与真实字节范围锁，安装约 66.8 秒，15553 个文件校验通过。
- 上述数据来自开发验收环境，**客户 Windows 11 设备仍需下载安装后确认**；没有把单元测试通过表述为所有客户、所有插件或 AI 员工完整业务均已验收。
- Windows 安装包 SHA-256：`3b30b1e7adb57f8d7910dc500f977d0913937f88aa3852247379a181a5691a41`。该版通过“版本记录”中的历史归档下载；固定文件、不可变归档、发行时更新清单及版本目录均已独立回读校验。顶部 latest 按钮下载实时最新版，不保证仍为 1.2.9。

### v1.2.8 - (2026-09-30)

- **同盘安装事务与安全回滚**。
- 2026-09-30 发布。针对安装目录在 D 盘、临时目录在 C 盘，旧文件搬运及回滚出现 Win32=33 的实际场景，安装器改为：先在安装盘同级目录完整解压新程序 → 同盘重命名旧目录为备份 → 切换新目录 → 成功后清理旧程序备份。
- 切换失败尝试恢复旧目录；未恢复的备份保留在安装盘，不会被 TEMP 清理。日志记录仍被锁定的残留路径。真实跨盘安装、字节锁、中文长路径和失败回滚已覆盖；此版解决安装事务问题，后续仍收到 Harness 启动超时反馈，启动问题继续在 1.2.9 修复。

### v1.2.3～1.2.7 - (2026-09-30)

- **安装故障定位与诊断集成**。
- 这几版于 2026-09-30 逐步发布，属于反复定位过程中形成的修复；客户随后仍反馈安装失败，不能将早期本机回归结果当成最终结论。
- **v1.2.7**：安装器内置持久日志、复制安装日志和打开日志；记录失败步骤、具体文件、退出码、Win32 错误、回滚结果、只读访问和占用 PID；已能提供具体失败证据，后续定位到跨盘旧文件搬运与字节锁问题；诊断直接集成安装器，无需独立工具。
- **v1.2.6**：修复已重现的中文长路径清理和相关卸载问题；客户仍反馈“旧版本文件清理失败（错误码 2）”；该值是卸载器退出码，不能直接等同于 Windows 文件不存在。
- **v1.2.5**：改用内置兼容解压器，补充安装目录进程识别与清理；同步工作区凭据兼容处理；继续覆盖解压、旧版卸载和文件占用场景，尚未消除后续跨盘迁移失败。
- **v1.2.4**：修复安装包解压与输出文件错误，调整安装打包流程；客户仍报告“无法关闭应用”，随后继续排查旧程序处理路径。
- **v1.2.3**：修复已退出应用仍被安装器误判“无法关闭”的路径；后续出现解压和旧文件清理失败，继续修复，没有要求用户反复结束不存在的进程。
- 安装失败日志保存在 `%LOCALAPPDATA%\Microi Agent\installer-logs\`；不可写时使用 `%TEMP%\Microi-Agent-installer-logs\`。退出安装后仍可读取、复制，不要手工删除日志所指的恢复备份。

### v1.2.0～1.2.2 - (2026-09-29～2026-09-30)

- **功能区、AI 员工与启动诊断**。
- 2026-09-29～09-30 发布。
- **v1.2.2**：Windows 采用直连本机地址的 Harness 探测，保留连接错误并尝试新端口；安全模式失败不直接归咎第三方插件；恢复页入口改为 QQ 群 51050055 与吾码官网；修复永久下载入口和更新清单。
- **v1.2.1**：AI 员工任务接入云端草稿与后台排队执行，复用员工中心；任务派发使用稳定请求标识，重试前查询执行状态。
- **v1.2.0**：修复安装包内 UI 依赖未更新导致旧品牌、AI 员工菜单缺失；完善七岗团队、任务派发、产物验收与协同交接入口。
- “工作区服务连接已断开”与云端未登录分别处理：旧空凭据存储迁移后不应终止本机服务；损坏或其他 Windows 用户加密的凭据保留原文件并报告具体错误，不静默清空。安装后应实际打开「Microi吾码」「AI 员工」验证服务连接。多智能体协同仍需使用真实授权账号、模型和业务任务完成执行、交接、验收闭环；菜单可见不代表整个业务已完成验收。

### v1.1.9 - (2026-09-28)

- **更名 Microi Agent 与小龙虾能力整合**。
- 2026-09-28 发布。产品名称、桌面品牌、源码根目录与官网入口改为 Microi Agent；文档入口迁至 `/doc/v8-engine/microi-agent.html`，原入口保留兼容跳转。吾码小龙虾 README 顶部标注已合并至 Microi Agent。
- 功能区新增 AI 员工、采集引擎、环境与服务管理，复用现有云端能力。AI 聊天、技能管理、定时任务等已有 Harness / OpenClaw 能力不重复实现。采集会话隔离凭据和浏览器上下文；不以入口迁移宣称 OpenClaw 的所有节点协议及业务已完整移植。
- 原应用 ID、用户数据目录及部分构建、下载路径继续沿用旧技术名称，保障历史安装、会话和更新兼容；界面展示使用 Microi Agent。

### v1.1.4～1.1.7 - (2026-09-27)

- **macOS、性能与签名边界**。
- 2026-09-27 发布，09-28 补充发布说明。
- **v1.1.7**：发布 Intel / Apple Silicon 通用 DMG 与 ZIP；未签名、未公证版本通过 DMG 手动升级，避免 ZIP 自动安装停滞；补充 macOS 权限、签名、公证、MAS 与移动端能力边界。
- **v1.1.6**：修复 macOS 更新失败后的恢复流程，保留原安装与用户数据。
- **v1.1.5**：优化 Markdown 渲染及解析范围，减少会话页面重复处理。
- **v1.1.4**：改善渲染性能和跨架构 macOS 构建流程。
- 当时发布的 macOS 通用包为 1.1.7；Windows 新版发布不会自动提高 Mac 清单版本。后续 Mac 包需在 MacBook 构建、校验并单独上传，再更新对应清单；macOS 1.2.2 和 1.3.2 的签名发行记录保留在本页日志，当前版本以页首为准。

### v1.1.0～1.1.3 - (2026-09-20～2026-09-24)

- **应用品牌、工作进程与 Mac 打包**。
- 2026-09-20～09-24 更新。
- **v1.1.3**：服务器卡片的应用 Logo、名称正确应用到桌面左上角，只读租户配置并保存本机设置；移除租户系统标题修改及 Logo 上传。Mac cloudflared 下载支持校验、续传和本地文件；一键打包使用隔离工作树，避免生成资源、版本及锁文件污染源码。Mac 1.1.3 DMG / ZIP 曾单独归档。
- **v1.1.2**：工作进程断开时及时拒绝挂起请求，按需重建，避免 `ERR_IPC_CHANNEL_CLOSED` 主进程弹窗；关于版本独立加载，底部区域与手机连接对齐。
- **v1.1.1**：统一 macOS Dock 图标留白；插件安装增加超时与诊断；完善 CLI/MCP 的 macOS Keychain 凭据兼容及测试。
- **v1.1.0**：修复 PPT 与吾码能力区互斥、账号资源自适应；默认浅色主题，新增修改文件审查侧栏和跨平台更新元数据。
- 同步完善官网：删除重复的 Windows/macOS 下载卡片及顶部历史版本链接；版本归档默认折叠并分页，下载入口固定 latest，按钮版本动态获取。历史 CLI 的本机 Keychain 补丁可能被全局重装覆盖，后续应使用已有原生兼容能力的官方 CLI，并重新验证凭据存储；平台 Token 不能替代模型服务账号。

### v1.0 系列 - (2026-09-18～2026-09-20)

- **桌面工作台基础**。
- 2026-09-18～09-20 建立正式桌面版本；1.0.8 为已保留的早期 macOS 归档。
- **v1.0.9**：启动后及每小时检查更新，结果持续可见；完善首页自适应、主题层级、更新桥接与 Mac 构建指引。
- **v1.0.8**：保留早期 macOS Intel 安装包归档，不作为当前 latest。
- **v1.0.7**：完善嵌入式工作区和桌面能力衔接。
- **v1.0.6**：桌面原生图片、音乐、视频工作台及 29 项图像工具；补齐上传、模型参数、异步恢复、结果下载与明暗主题布局。
- **v1.0.5**：完整展开图像能力目录，完善 Windows 打包、签名降级及更新清单。
- **v1.0.4**：扩展首页 AI 能力、官方中转站和 MCP 模型来源。
- **v1.0.3**：增加首页能力卡片、模型来源及个人中心；latest 上传使用暂存后切换，并校验 CDN 缓存回读。
- **v1.0.2**：修复关于版本、折叠侧栏手机入口和服务器连接布局；补齐登录、个人中心、应用品牌入口及上游差异保护。
- **v1.0.1**：恢复桌面壳、更新流程与版本入口。
- **v1.0.0**：首个正式编号版本，工作区、会话、桌面 UI 与吾码功能基础集成。
- 前期 0.1.0 / 0.2.0 为桌面预览和基于 dsh-desktop 重建阶段。未取得可靠发行证据的版本不补造发布记录。

### 文档维护 - (2026-10-01)

- **2026-10-01**。
- 补齐本页完整产品更新历史并恢复桌面右侧「当前页大纲」，保留小屏布局和折叠归档。内部源码根目录新增维护交接文档，记录历次需求、已验证结果、失败尝试、构建发布流程及尚待客户/Mac 真机验收事项；官网文档变化不额外提高桌面版本号。

<!-- microi-agent-macos-signed-1.2.2 -->
### v1.2.2 - (2026-10-01)

- **macOS Universal 签名与公证发行**：支持 Intel 与 Apple Silicon，最低 macOS 13.5。App 与 DMG 已完成 Developer ID Application 签名、Apple 公证和票据装订，Gatekeeper 验证通过；公网下载文件已完整回读并校验大小与 SHA-256。

| 文件 | 用途 | 大小 |
| --- | --- | --- |
| [Universal DMG](https://static.itdos.com/itdos/micro-app/microi-code-downloads/v1.2.2/Microi-Agent-1.2.2-mac-universal.dmg) | 手动安装 | 380,982,170 字节 |
| [Universal ZIP](https://static.itdos.com/itdos/micro-app/microi-code-downloads/v1.2.2/Microi-Agent-1.2.2-mac-universal.zip) | 自动更新 | 425,475,466 字节 |

- DMG SHA-256：`273cb60b06d032e9f3f7951ade0d50c96e978b160a3eee0de28efc9ed8c9a3e4`
- ZIP SHA-256：`577f637fad51837b46f604edf09dafec09a6cccb0574e88bee35ae61875e9a24`
- [1.2.2 更新清单归档](https://api.itdos.com/microi-code/updates/archive/1.2.2/latest-mac.yml)。旧版未签名安装包继续保留在版本记录中。
