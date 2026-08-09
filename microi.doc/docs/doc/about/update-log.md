# 更新日志

## v7.2.5 - (2026-08-10 03:16)

- **五仓历史、工作树与重复合并完整审计**：以 v7.2.4 对应的根仓 `8779cff39c47670ce9783d3da580459f3968cf68`、Microi.net `f007940c57caf8d00dfb650eb6c93b3ffd4cbe5f`、Microi.AI `314a8e98f974aa1b4179cebde3e5c93b526157f7`、Microi.VSCode `f04de0bed3dcb2076265c86b01f3d27631582e35` 和 WebOS `cf8b4703b51f2ddade779db4081e6d6ee18b6e9e` 为封版锚点，逐仓 `fetch --prune` 后均为 0 ahead／0 behind；五个锚点到本轮提交前都没有新提交、自动 merge、冲突专属增量或英文提交说明，因此不存在重复归纳和漏译。写本节前，根仓有 121 个已跟踪差异文件、161 个未跟踪文件，Microi.net 为 7+5、Microi.AI 为 4+3、Microi.VSCode 为 32+1，WebOS 完全干净；根仓已跟踪净差异为 5023 行新增、369 行删除，三个独立代码仓分别为 450/8、62/6、452/210。`microi.mcp/dist`、前端构建目录、包清单和其它生成物只核对同源关系，不把压缩代码重复冒充新功能；WebOS 没有制造空变更。
- **Microi吾码 AI 平台治理中心成为可安装的官方应用**：新增 `ai-platform-studio` v2.0.1，以 40 张治理表、40 个后台模块、64 个接口引擎、1 个 Quartz 治理任务和 10 路由 Vue 微服务承载门户装配、身份同步、访问治理、配置与灰度发布、服务治理、可观测与告警、资产协作和可恢复导入。57 个核心接口采用 `Managed`，只在目标端 `Local == Base` 时升级；7 个租户扩展 Hook 采用 `CreateIfMissing`，首次创建后永不覆盖。官方商城应用 `01KZK4QBF3NKJVB198NVGMG3J6` 已发布并独立回读：安装包可落地 45 张物理表、873 个字段、40 个模块、64 个引擎、1 个任务和 10 条路由，源码 34 文件／376401 字节、运行资产 3 文件／336613 字节、应用 ZIP 99176 字节的内容哈希均完成核对。
- **身份目录、动态用户组与临时授权形成可信治理闭环**：新增服务端可信身份目录分页读取、Secret 引用、HTTPS/DNS/私网地址和响应上限检查，以及 DryRun、增量游标、字段映射 Hash、冲突队列和安全重放；动态用户组生成不可变成员快照，标签与临时权益记录有效期和回收事实，访问申请支持 Submit/Approve/Reject/Cancel/Reopen。`V8.Method.ReadIdentityDirectoryPage`、真实 FormEngine 权限解释和授权决策说明均从服务端可信身份重算，不接受前端伪造角色、菜单或数据范围；DiyToken 继续作为唯一会话入口，没有引入第二套用户与权限 Token。
- **配置、功能开关和发布运行台账可审计、可恢复**：配置 Schema、Value 与 Secret 引用分离，继承链检查循环和最大深度；配置发布、功能开关、发布计划及回滚统一使用规范化内容 Hash、DryRun、不可变版本和 `ExpectedHash` CAS。发布计划支持目标、门禁、步骤、回滚、生产证据、职责分离审批与轮次一致性；`mci_release_run` 持久化稳定 RunKey/IdempotencyKey、共享租约、fencing token、检查点和逐步结果，每个副作用独立事务提交，失败事实不会被成功状态掩盖，重试从已确认检查点恢复。
- **服务注册、路由、限流、熔断与拓扑进入共享治理面**：服务实例注册、心跳和排空使用数据库／Redis 共享租约，过期实例自动退出解析；路由策略支持目标版本、区域、标签、权重和稳定哈希。调用许可提供共享固定窗口限流、持久结果重建熔断、半开共享配额与降级判定，调用结果按 PermitId 幂等结算，拓扑边与成功/失败统计在同一业务事务更新；进程内状态只作优化，不再作为多节点完成事实。
- **W3C Trace、日志生命周期与告警 Outbox 全链路贯通**：HTTP、接口引擎、后台任务和 MQ 传播 `traceparent`，SysLog 增加 TraceId、SpanId、ParentSpanId、Service、Environment、Version 和 Node 元数据，MongoDB 提供 Trace/时间索引与跨月时间线。日志生命周期支持策略、批次、检查点、gzip JSONL、归档证明、删除回读、失败恢复和幂等重试；告警评估使用持久窗口、连续触发/恢复、去重与抑制，Open/Acknowledged/Resolved/Suppressed 状态清晰，通知经带稳定幂等键和租约的 Outbox 送达。
- **Page Engine 与业务蓝图获得版本历史、语义差异和安全源码桥**：蓝图与页面保存统一使用规范化 UTF-8 JSON、SHA-256、不可变历史、语义 Diff、乐观并发和幂等回滚，前端、MCP 和后端共享版本协议。Page Engine 新增 50 步／20MB 本地 Undo/Redo；Page JSON → Vue SFC 只生成确定性的 `microi.page.sfc.v1` 模板，不执行用户 JSON或注入任意 import；SFC → Page JSON 必须具有完整平台标记、元数据和匹配 Hash，未知或手写 SFC 明确拒绝，普通 Vue 工程继续由微服务承载。
- **组件资产、协作变更集与可恢复导入成为正式平台能力**：`microi.asset.v1` 声明类型、Props、Setters、数据适配器、平台和依赖包，发布器验证语义版本范围、缺失依赖、循环、最大深度、内容 Hash、DryRun 与 CAS，解析器只返回完整性通过的稳定加载顺序。协作会话使用共享租约，变更集携带 BaseHash、协议版本和受限操作边界；导入任务对原文件、解析计划和每行计算稳定 Hash，以 ImportKey/IdempotencyKey、暂存、错误修正、检查点分片、Worker 接管和条件回滚保证跨节点重启可恢复。
- **AI 内容创作、MiniMax 视频和多平台发布队列可通过商城完整交付**：新增 `ai-content-operations` v1.0.4，包含 6 张表、127 个安装字段、7 个菜单、11 个接口引擎、2 组默认数据和每天 08:30／16:30（Asia/Shanghai）的 2 个 Quartz 任务。在线 AI 基于已核验资料快照生成文章，MiniMax 创建/查询/文件读取由 Microi.AI 可信服务端代理并只向 V8 返回签名句柄；抖音、快手以硬质量门禁阻止低质量素材，多平台连接器的第三方凭据只留在本机。发布队列使用稳定幂等键、租约、fencing token、尝试记录和结果回读；10 个核心引擎为 `Managed`，发布参数扩展为 `CreateIfMissing`。官方商城记录 `53048ec0-f65c-456d-b965-02c1411fdbfd` 已由缺少任务资源的 v1.0.3 不可变升级至 v1.0.4，245754 字符包正文 SHA-256 为 `3690212caa2e260a9347385c223ef70485d5866780e88b428e9d4fdca989834a`，版本、数量、任务、策略和既有种子数据均完成写后回读。
- **应用商城发布、资产准备和安装协议继续收口**：发布器精确传递用户请求版本，并强制 `RequestedVersion == Prepared.PackageVersion == AppPakcet.PackageInfo.Version`；菜单、表、接口引擎和任务选择只来自本次包正文，不能沿用旧版本状态。新增源码与运行资产准备、确定性请求和内容哈希回读，修复大型源包、离线自包含包、版本终态、精确菜单合同和安装选择漂移；安装器独立处理 ScheduleJobs checkpoint、受管核心冲突回滚、租户 Hook 永不覆盖和中断恢复。正式发布同步后的官方“应用商城”资源已升至 v7.2.7，并完成资源正文回读。
- **Microi.net 与 Microi.AI 增加可信 V8 原子能力**：Microi.net 新增授权解释、身份目录、日志信号和任务调度方法，可信执行上下文、接口嵌套、租户 AI 与缓存同步传递追踪和服务端身份；Microi.AI 增加 MiniMax 视频创建、任务查询和文件下载代理，供应商 Key、原始 task_id/file_id 不进入可编辑 V8 或业务表。根仓控制器和接口同步暴露最小协议边界，业务编排继续由接口引擎和应用包完成；两子仓程序集版本统一升至 7.2.5。
- **Codex/VS Code 继续坚持单一共享核心**：Microi.VSCode 保持 v4.8.2，由唯一 `@microi.net/cli` 包同时承载 CLI、MCP、多宿主清单和 60 个 Skills；Codex 安装器不再把 npm 包误作远程插件源，而是校验包内插件身份后原子复制到 `${CODEX_HOME}/microi-net-marketplace/plugins/microi`，生成官方支持的本地 marketplace，再安装 `microi@microi-net`。旧 npm／marketplace 标识只在新版完整安装成功后迁移，损坏目标、版本漂移和非受管目录均失败关闭；鉴权恢复、CLI 包、源码包、发布守卫、129 工具握手和各宿主测试同步更新。
- **架构图、官网与 Skills 完整同步**：重制“Microi吾码 AI平台 架构图”为 1920×1080 高清 PNG 与可无限缩放 SVG，中央 V8引擎核心、几十+引擎能力卡、跨端入口、数据与基础设施层及“10×+ 更省 Token、10×+ 更快开发、成熟底座更稳定、开箱即用更快交付”价值带采用高对比矢量排版；图中不出现底层解释器名称，188+ 功能点使用短标签卡片呈现。官网首页、根 README、AI 平台治理、Page 源码桥、应用商城、AI 引擎和 VS Code 文档，以及 `microi.skills`／插件内 Skills 能力地图均已同步；官网另新增开源版／个人版／企业版买断授权对比页，以及 NuGet 官方双节点实时下载统计、超时降级和共享请求组件。
- **自动化验收与真实浏览器缺陷闭环**：AI 平台 Manifest 21/21、商城资源 114/114、治理微服务 4/4、架构图 3/3、Microi.Client 定向 14/14、MCP 97/97、Microi.Server 全量 2235/2235，以及租约、fencing、幂等、Outbox、后台接管、流式发布和健康检查专项 203/203 全部通过；Microi.VSCode 完整类型检查、构建、鉴权恢复、诊断与包测试通过。共享 61501/61500 以管理员身份完成 10 条 PC 和 10 条 390×844 移动路由真实浏览器验收，实际发现并修复移动治理导航与宿主底栏重叠，加入几何断言后 20/20 通过；测试只关闭本任务浏览器。破坏性双节点强杀、网络分区和旧新容器滚动共存未在连接官方数据的共享环境执行，不用契约测试冒充生产混沌成功。
- **v7.2.5 正式制品与公共回读**：`Microi一键编译发布.sh` 按 `7.2.5、4、0、2、2、0` 完成官方资源同步、现代前端、串行压缩、Chrome 49 legacy、后端 Release、DLL 加密、HTTP 200 存活探针、19 个 NuGet 包及前后端正式／测试 Docker 推送，成功轮总耗时 11 分 55 秒、0 个构建错误；5 条提示为 xUnit 分析器建议，不影响制品。后端 `latest/v7.2.5/dev-latest` 摘要收敛为 `sha256:787273640780f0d0b5274a846aaef7bb9ddfe58ff278d45a61fc55013b6a9718`，前端 Web／Client 的 `latest/v7.2.5` 摘要收敛为 `sha256:0a922351b097fc85f8ee6baa6fef82c44e2293c9f7833b5600458bc9afd7bfbc`；Dos.Common、Dos.ORM、Microi.AI、Cache、Captcha、Core、HDFS、Job、MongoDB、MQ、MQTT、Microi.net、OCR、Office、SearchEngine、Spider、Upgrade、V8Engine、WeChat 共 19/19 个 v7.2.5 包完成 NuGet 公共 Flat Container HTTP 200 回读。

## v7.2.4 - (2026-08-08 20:19)

- **五仓提交、推送、工作树与重复合并审计**：以 v7.2.3 对应的根仓 `f9087a2505904483e8e22515adb52d063dcecd29`、Microi.net `7648ff0432eb77a7cc8b806dfaf1f80430fddbe4`、Microi.AI `db16d54d8bc190ef3198812adb4a45d5de1b7768`、Microi.VSCode `04cc90230a229bcc1752d0ac081fa57c3b22d60c` 和 WebOS `cf8b4703b51f2ddade779db4081e6d6ee18b6e9e` 为封版锚点，逐仓 `fetch --prune` 后均为 0 ahead／0 behind。锚点后只有根仓 3 个单父提交：`7f815fa8` 修正官网安装脚本下载源、`37950e3f` 修复旧版 Compose 折行连接串校验、`156cfadf` 修复恢复库数据库名推导与连接配置，累计只涉及安装脚本与 Docker 安装文档 2 个文件、246 行新增和 28 行删除；其余四仓没有新增提交或遗漏推送，五仓均没有自动 merge、冲突专属增量或需要翻译的英文提交说明，因此不存在重复归纳。写本节前，根仓有 23 个已跟踪差异文件，Microi.net、Microi.AI 各 1 个版本文件，Microi.VSCode 有 42 个已跟踪和 8 个未跟踪文件，WebOS 工作树完全干净，排除 `dist/bin/obj/.tmp` 后共 75 个源码／资源／测试／文档路径；其中插件包内的编译后 CLI、Skills 元数据与构建清单只核对同源生成关系，不逐文件冒充新功能。
- **官网安装／修复脚本改用可核验的仓库下载源**：在线安装与 `--repair-app` 命令不再从旧静态站直接获取主脚本，改为使用 Gitee 仓库原始文件地址，并保留 GitHub 浏览镜像说明，避免静态站缓存或文件不同步导致用户拿到旧修复逻辑；离线准备仍按原边界下载其余受控资源，不扩大脚本执行范围。
- **旧版 Compose 折行连接串可被完整回读**：安装器读取 API `environment:` 时由单行截取改为按 YAML 缩进折叠后续续行，再执行连接串完整性判断，修复 `User Id`、密码或其它片段被 Compose 排版拆行后误判为“已截断”的问题。折叠只覆盖当前环境变量的连续缩进行，不跨键吞并配置；恢复前仍保留原 Compose、数据库容器和数据卷，任何无法唯一证明的配置继续失败关闭。
- **恢复库数据库名从现场事实安全推导并贯穿全流程**：修复器按容器标签、MySQL／PostgreSQL 数据库环境变量、现有连接串和 `OsClient` 回退的顺序确定数据库名；自定义 SQL ZIP 还会识别 MySQL 的 `USE/CREATE DATABASE`、SQL Server 的 `USE/CREATE DATABASE`、PostgreSQL 的 `\connect/CREATE DATABASE`，忽略系统库，发现多个候选、非法名称或压缩包二次校验变化时拒绝继续。MySQL、SQL Server、PostgreSQL 的健康检查、建库、导入、连接串、Compose 标签及 `MYSQL_DATABASE/POSTGRES_DB` 使用同一结果，达梦保持 `SYSDBA` 边界；日志只输出数据库名及来源，不泄露凭据，并修复展示变量错用造成的数据库名误报。
- **Microi AI 开发能力统一为一个 npm／多宿主插件产品**：Microi.VSCode 从 v4.7.9 升至 v4.8.2，删除独立 `cli/package.json` 与旧 `@microi.net/codex-plugin` 双包发布路径，统一由 `plugins/microi/` 生成并发布一次 `@microi.net/cli`；同一包同时承载 CLI、Codex Plugin、MCP、59 个领域 Skills，以及 CodeBuddy／WorkBuddy 的 plugin 与 marketplace 清单。版本递增、打包、发布预检、断点续发和公开回读统一校验 VSIX、Open VSX、单一 npm 包、Codex／CodeBuddy／WorkBuddy 清单与 bundled Skills 版本，旧 npm 包名只保留为受控迁移兼容，不再作为新发布目标。
- **WorkBuddy、CodeBuddy、Qoder 与 Comate 获得原生项目入口**：CLI 与 VS Code 插件会分别维护 `.workbuddy/mcp.json`、工作区根 `.mcp.json` 和 `.comate/mcp.json`，按各宿主协议投影 stdio／HTTP 字段，并在读取、诊断、删除、路径升级、Git exclude 和无损合并中覆盖这些位置；非 Microi 的已有 MCP Server 保持不变。初始化同时生成 `.codebuddy/.qoder/.agents/.comate` 下的轻量路由 Skill，以及 CodeBuddy always-apply 规则，完整事实源仍只有根 `microi.skills/`；AI 文档清单按哈希保护用户已修改文件，卸载或重建不会粗暴覆盖。
- **多连接名称、包根发现与 Windows Trae 启动链稳定化**：连接列表新增确定性的 `mcpName`，同一 `OsClient` 多主机时自动附加规范化主机名并处理碰撞，`--profile` 可直接按该名称拉取或诊断；`microi plugin path --json` 返回真实 npm 包根及 WorkBuddy／CodeBuddy 清单路径，宿主安装和工作区信任仍需用户授权。Trae Windows 改用 `cmd.exe + call + mcp-trae-windows-launcher.cmd` 传递含空格的 Node／Electron 与适配器路径；CLI 另用稳定入口包装 `mcp-server.js`，避免旧 VS Code 扩展按参数文件名误改到自身版本目录。Codex／CodeBuddy／WorkBuddy 启动器会校验 manifest、包名、版本和必需脚本后再复用同一 MCP bundle。
- **版本同步与 v7.2.4 前后端正式制品**：Microi.Client、`Directory.Build.props`、根仓 17 个公共组件，以及 Microi.net、Microi.AI 独立仓的程序集、文件和 NuGet 版本统一由 7.2.3 升至 7.2.4；两个服务器子仓没有其它源码差异，WebOS 本版没有新增待提交代码。`Microi一键编译发布.sh` 按 `v7.2.4、4、0、2、2、0` 完成官方资源同步、现代 Vite、串行压缩、Chrome 49 legacy、后端 Release、DLL 加密、真实存活烟测、NuGet 和前后端正式／测试 Docker 推送，最终成功轮耗时 12 分 31 秒；后端 `latest/v7.2.4/dev-latest` 摘要收敛为 `sha256:6bcf1673f02909819e286fbd8b91183af4c977f411d47963125df06387541bb6`，前端 Web／Client 的 `latest/v7.2.4` 摘要收敛为 `sha256:05e4d9be667517236207496a1e54dbc8fd1f5a503909546aaad8e3b601d8cc37`，19/19 个 NuGet v7.2.4 包完成公共 Flat Container HTTP 200 回读。
- **构建与验收边界**：首轮前端、后端、加密和发布链为 0 个构建错误，后端存活探针返回 HTTP 200；9 条 .NET 警告来自已知的 Microsoft.Bcl.Memory 安全公告提示和 xUnit 分析器，不影响该次构建完成。Microi.VSCode v4.8.2 通过完整测试链，包括两套 TypeScript 类型检查、CLI／多宿主插件构建、Trae Windows 含空格路径握手、稳定 CLI MCP 启动、并发配置写入、MCP 多宿主合并、CLI 和多连接 Codex 路由；本节只确认其源码与本地包边界，尚未把它写成 Visual Studio Marketplace、Open VSX 或 npm 外部发布成功。WebOS 无新差异，继续沿用 v7.2.2 已验收的文件夹复开与主题图片图标修复，不重复冒充本版功能。

## v7.2.3 - (2026-08-08 16:58)

- **五仓提交、推送、工作树与重复变更审计**：以 v7.2.2 对应的根仓 `0b92abbfe47c2d63ec0a6771390d26f6edd14af2`、Microi.net `07a831f965a770556981b8bff1e9318a4783a453`、Microi.AI `62d405e4f02624745923a684576c59455129e1ea`、Microi.VSCode `4145fe1734b1b92ed4a17253996c1a72d10c0d43` 和 WebOS `cf8b4703b51f2ddade779db4081e6d6ee18b6e9e` 为封版锚点，逐仓 `fetch --prune` 后均为 0 ahead／0 behind。上一日志提交后只有根仓 `12fc1965` 补充模块“自定义表单视图”标签约束；WebOS `cf8b470` 的文件夹复开与主题图片图标虽在独立仓于 14:42 封版，但已经由 v7.2.2 日志完整归纳，本版只说明其正式进入后续制品，不重复冒充新功能；没有新的自动 merge、冲突专属增量或英文提交说明。写本节前，五仓共 51 个已跟踪差异文件（1325 行新增、716 行删除）和 137 个未跟踪文件；其中 Microi.VSCode 的 118 个文件、约 4.09 MB 是从同源 MCP／CLI／Skills 生成的 Codex Plugin 发布包资产，只核对来源与哈希、不逐文件重复分析。排除该发布包后共有 70 个源码／资源／测试／文档路径，另含 1801 行新文件；Microi.net、Microi.AI 各只有 3 项版本元数据，WebOS 工作树完全干净。
- **客户登录异常确认是安装编排中的数据库连接串被截断**：现场 `microi-install-api` 的规范 Compose 回读为 `OsClientDbConn: Data Source=microi-install-mysql80;Database=microi_demo;User`，并不是完整用户名或密码中含分号。平台补充 MySQL `SslMode` 后，末尾裸片段会被驱动组合识别为不支持的 `user;sslmode` 参数，因此 `/api/SysUser/Login` 尚未查询 `sys_user` 就在 `GetFormData` 建连阶段失败；只拉取 v7.2.3 API 镜像无法凭空恢复已经丢失的连接信息，MCP 也必须先通过同一数据库连接，不能绕过该根因。
- **一键更新／修复器可无损恢复被截断的安装连接串**：`install-microi.sh --repair-app` 不再把“非空但缺少用户、密码或端口”的连接串原样传播；对脚本自身安装、且能唯一匹配的数据库容器，分别从 MySQL `MYSQL_ROOT_PASSWORD`、SQL Server `MSSQL_SA_PASSWORD`、PostgreSQL `POSTGRES_PASSWORD` 或达梦 `SYSDBA_PWD` 恢复完整内部 DNS 连接串，并对分号、引号等凭据字符按连接串语法编码。恢复和校验过程不打印密码，容器不唯一、凭据缺失或结构仍不完整时会在删除 API／Web 前失败关闭；原 Compose、容器元数据、旧镜像恢复点、共享网络、Watchtower 暂停／恢复和只重建无状态 API／Web 的边界继续保留。Docker 文档同步增加该故障入口与恢复说明。
- **MySQL 历史兼容下沉到真实 Provider 边界**：v7.2.2 的引号感知凭据分号修复继续只处理可证明的历史语法，例如 `Password=secret;User;SslMode=None`，不猜测已经完全缺失的帐号或密码；本版新增 `NormalizeProviderSyntax` 并在 `MySqlProvider` 构造时前置调用，使直接 `new DbSession`、旧插件或绕过上层连接工厂的入口也不会把旧格式原样交给 MySql.Data。数据库连接池默认值仍由上层统一规范化，非 MySQL 保持原样，独立未知裸片段继续失败关闭。
- **微应用冷启动白屏改为固定协议路由和真实可见内容确认**：`/micro-app/:appKey/:microPath` 从登录后异步路由移入首轮固定路由，并把宿主组件纳入主包，避免直接链接、书签或刷新时先命中空 `RouterView`；登录守卫与 `MicroApp/Resolve(RequirePage=true)` 仍复核身份和页面事实，不因固定注册而授予菜单或数据权限。宿主不再把 `mounted`、子应用 ready 信号或尚不存在的 `micro-app-body` 当成成功，而是检查 `#app` 的真实子节点／文本、可见样式及非零宽高；首次空白只销毁重建一次，第二次给出稳定诊断。官方 SaaS 引擎包同步至 v6.4.9，内置平台微服务由 v1.5.5／CurrentVersion 12 升至 v1.5.6／13，子应用使用 `nextTick + 双 requestAnimationFrame` 回传渲染尺寸并有界重试，路由数据晚到时可从当前地址恢复；构建资产和共同资源基线完成同步。
- **Microi Codex Plugin 三端同源交付**：Microi.VSCode 新增 `@microi.net/codex-plugin` v4.7.9、`microi-net` marketplace 与 `microi@microi-net` 选择器，发布包从同一仓库复制现有 MCP Server、CLI 和 59 个领域 Skills，再增加 Codex 专用路由 Skill，共 60 个 Skills；55 个 VS Code 命令全部进入功能映射，编辑器 UI 能力按 CLI、MCP、Codex 原生文件操作、浏览器和对应 Skill 映射，不复制第二套远端 API。MCP 路由器读取工作区同一 `.microi-config.json` 和四段身份 Token，支持多连接稳定名称、按连接懒启动同源 MCP 子进程及只读状态资源；插件缓存启动器要求 manifest／npm 包名／版本和脚本同时匹配，并限制在 Codex 官方 cache 内，避免加载伪造或残缺目录。生成发布快照按目录保留上游 Markdown 硬换行与压缩产物原始空白，其余源码仍执行默认空白门禁；源码、路由和真实 tarball 安装检查均在该边界下通过。
- **CLI 显式授权安装、旧标识迁移与四目标发布守卫**：`microi codex status` 可只读检查 Codex CLI、marketplace、插件启用态和目标版本；`microi codex install --yes` 只有在用户已明确授权修改全局 marketplace／插件配置时才安装，目标新版确认成功后才清理旧 `microi-official` 标识，普通安装失败会保留原插件，版本不一致需确认 npm 已公开后显式 `--force`。扩展、CLI、Codex npm 包、plugin manifest、npm marketplace 和 bundled Skills 统一版本；发布脚本新增 Codex 包清单校验、原始 tarball 补发、公开回读与传播中状态，并先发布 Codex npm 包、确认可用后才发布内含安装器的 CLI，避免 CLI 指向 404 包。当前只完成源码、本地 tarball 与安装检查，未执行 Microi.VSCode 的 Visual Studio Marketplace／Open VSX／npm 外部发布，不把本地包测试写成公共插件已上线。
- **模块封版增量、版本同步与 v7.2.3 首轮制品**：模块引擎 v6.9.5 对 `EnableViewSchema` 的临时脚本说明只保留“自定义表单视图”，明确排除旧“传统／跨端视图”文案；该 `12fc1965` 精修和 v7.2.2 已记录的 WebOS `cf8b470` 均随本版后续制品纳入，不重复统计整套功能。Microi.Client、Directory.Build.props、根仓 17 个公共组件，以及 Microi.net、Microi.AI 独立仓的程序集、文件和 NuGet 版本统一由 7.2.2 升至 7.2.3；两个服务器子仓没有其它源码差异，Microi.VSCode 使用自身 v4.7.9。
- **构建、测试与发布验收边界**：安装器 Bash 语法、四数据库连接恢复探针和 Docker Compose 插值均通过；SaaS 安装器契约 17/17、Dos.ORM 兼容 13/13、微应用 8/8、模块资源 5/5 通过。Codex 交付链通过 CLI TypeScript、55 命令源码矩阵、CLI／Codex 构建、60 Skills 包校验、多连接路由、CLI 安装迁移和真实 tarball 安装检查。`Microi一键编译发布.sh` 按 `v7.2.3、4、0、2、2、0` 完成官方资源同步、现代 Vite、串行压缩、Chrome 49 legacy、后端 Release、真实存活烟测、DLL 加密、NuGet 检查和前后端正式／测试镜像推送，最终成功轮耗时 8 分 10 秒；后端 `latest/v7.2.3/dev-latest` 摘要为 `sha256:2f8465ac325ee98152749749889ce96e3aa44fe6b06d0ab817b53c40e79019eb`，前端 Web／Client 摘要为 `sha256:ce5a43b241aa34d1f2a29106dc818b7d5e6e8b8b6aee19d7a9028d7e35b6e621`。19 个 NuGet v7.2.3 包均已存在时按不可变版本处理，没有覆盖重发。随后再次只选模式 `6`，129 个 Markdown 链接、121 个侧栏页面、仓库链接、暗色预绘和 131 个 SEO 页面门禁全部通过，VitePress 1.6.4 构建成功，北京／杭州官网文档镜像均推送成功；npm 审计、Sass legacy API 和大分块提示均为非阻断警告。封版前独立回读确认 19/19 个 NuGet 包为 HTTP 200，后端三个标签与前端四个标签分别收敛到上述摘要，北京／杭州两个文档标签内容一致，`api.itdos.com` 已返回 `7.2.3`。现场客户容器尚需使用新版修复器重建并再次登录验收，因此本节不把源码、镜像、本地 Compose 探针或公共制品发布替代为该客户生产登录成功。

## v7.2.2 - (2026-08-08 14:38)

- **五仓提交、推送、工作树与自动合并去重审计**：以 v7.2.1 对应的根仓 `fb7a6ea06003c144ece9d24b99c8351774406931`、Microi.net `d6b81d63d6261a7daff1b5f1dab753a16ba3abd0`、Microi.AI `41d363ed354cc33ce16f626c75a056c9091bc6c4`、Microi.VSCode `4145fe1734b1b92ed4a17253996c1a72d10c0d43` 和 WebOS `1916c3401e45eeb5ec9afedf48ee6a0f2cdd3eee` 为锚点，逐仓 `fetch --prune` 后本地与上游均为 0 ahead／0 behind。锚点后只有根仓自动合并 `c60a3099`：其来源分支三次提交实际修改 17 个文件、1124 行新增和 67 行删除；以共同祖先 `c2a79265` 对来源分支、以及以上一版本锚点对合并结果计算的稳定 patch-id 均为 `bdcd1011a503844e25baec1c9e2a8ee94c5b5603`，确认没有冲突专属增量，故联系人、图片审核和人员定位三组变更只归纳一次。其余四个独立仓在锚点后均无遗漏提交、推送差异或英文说明。最终写日志前，根仓有 44 个修改文件（1773 行新增、172 行删除），其中 `microi.mcp/dist` 的 5 个编译文件仅占 10 行新增、8 行删除且不作功能分析，非生成差异为 39 个文件、1763 行新增和 164 行删除；Microi.net、Microi.AI 各有 1 个版本文件（各 3 行新增、3 行删除），Microi.VSCode 完全干净，WebOS 有 4 个修改文件（66 行新增、37 行删除）。五仓合计 50 个差异文件、1845 行新增和 215 行删除；排除 `dist/bin/obj/.tmp` 后为 45 个源码／资源／测试／文档文件、1835 行新增和 207 行删除。
- **登录查询兼容未加引号的 MySQL 凭据分号**：`/api/SysUser/Login` 在读取 `sys_user` 前会经过 Dos.ORM 与 MySql.Data 连接串解析；历史租户若把含分号的用户名或密码直接拼入连接串，例如 `Password=secret;User;SslMode=None`，提供程序会把凭据后半段与下一键合并识别成不支持的 `user;sslmode` 选项。本版在统一 ORM／驱动边界增加引号感知的分段与有界修复，只把“紧跟明确 `Password/Pwd/User Id/Uid/Username/User` 且不含等号”的片段还原进凭据，再通过 `DbConnectionStringBuilder` 生成安全引号；连接选项改为按真实键解析，不会被密码中的 `SslMode`、`Max Pool Size` 字样误导。独立的未知裸片段继续失败关闭，不猜测账户、密码或默认 `root`，其它数据库类型保持原样；Dos.ORM Skill 同步明确新配置必须写成 `Password="a;b"`。该能力必须位于有效会话和 V8 之前的数据库提供程序边界，不能由接口引擎替代。
- **连接串回归与登录故障原样复现**：使用当前 MySql.Data 9.7 先独立复现同一 `Option not supported (Parameter 'user;sslmode')` 异常，再验证修复后的用户名、密码、引号、旧 `SslMode=None`、默认池参数和失败关闭语义；Dos.ORM 兼容测试共 12/12 通过。当前工作区没有客户那条敏感连接串，因此本日志只确认提供程序级复现、修复与本地登录调用链验证，不把它替代为客户生产环境的真实登录验收。
- **官方应用商城新装结构与递归上限一致性修复**：完整 Quick 门禁发现官方 `app.microi.store` 包虽已使用应用资产流协议 v3，包内新装 DDL 和字段清单仍停留在旧结构。本版将包升级至 v7.1.15，为 `sys_microistore`、`mci_ai_app_version`、`mci_ai_app_file` 补齐当前协议所需物理列，并新增 28 个默认隐藏、只读的发布状态／清单／栅栏／路由快照／路径哈希字段，使空库首装与存量升级语义一致；18 个接口引擎的 `LimitRecursion` 全部收敛至平台硬上限 5000。`app.microi.form-engine` 同步升级至 v6.9.8 并收敛唯一接口引擎上限，共同基线与官方线上资源完成 SHA 回读一致。回归断言改为校验语义最低版本及“元数据版本＝V8 文件头版本”，避免以后正常升版再次被过时的精确版本字符串阻断。
- **小程序图片安全审核改为静态预览、并发上传与批量轮询**：微信内容安全应用包升级至 v1.0.1，新增登录态保护的 `mci-wechat-content-status-batch` 核心接口；每次最多接收 20 个规范审核 Id，并按权威当前用户和租户逐项核验归属，只返回规范状态、待处理数量和下次轮询时间，不泄露 OpenId、对象路径、标签或供应商载荷。UniApp 上传先立即生成本地静态预览，再以最多 3 个 Worker 并发上传，最后按批次有界轮询；能力不存在时才降级到旧单条状态接口，认证失败立即停止，网络异常不会扇出请求，超时、缺失状态和移除取消均失败关闭。媒体上传组件展示排队／上传／审核／通过／拒绝／失败／超时／取消状态，原生表单在仍有待审或失败文件时阻止提交；源码、应用包、HDFS 文档和批量／降级／并发／取消契约测试同步更新。
- **联系人所属客户与人员定位权限修复**：XJY 原生联系人表单选择所属客户时同时回填显示名称与隐藏 `KehuID`，提交前再次从权威选中项解析并持久化客户 Id，修复列表新增联系人后因外键为空而查询不到结果；静态合同补充对应字段与提交守卫。考勤／打卡的业务菜单解析增加线上实际名称“人员定位”别名，只扩展既有业务配置并继续使用实时菜单权限，不以硬编码绕过授权；相关列表权限脚本同步覆盖。
- **WebOS 文件夹复开与主题图片图标修复**：主题菜单图标默认优先显示菜单图片，加载失败再回退 IconClass；macOS／Windows 桌面只有在 `_Child` 非空时才把菜单识别为文件夹。文件夹弹层改为受控 `v-model`，关闭后不销毁重建 Layer，并禁用滚动锁；点击文件夹子项会先关闭弹层再打开内部窗口、外链或自定义动作，阻止父级冒泡，二级图片图标统一 60×60。窗口管理契约同步验证重复打开／关闭、受控状态和默认图片模式。
- **模块展示配置与自定义表单视图语义收敛**：Git 封版期间新增的 12 个非生成文件把 `EnableViewSchema` 精确收敛为只控制 Detail/Edit 自定义表单视图，List/Card 的模块标题、动态指标、PC 复合列和移动端卡片只要存在有效配置就始终生效。模块展示设计器新增独立“自定义表单视图 JSON”，只允许 Detail/Edit 并合并回完整 ViewSchema；与高级 JSON 同时存在未应用修改时失败关闭，避免相互覆盖，角色视图和未知扩展字段继续保留。`ViewSchemaVersion/ViewConfigVersion` 允许为空并按 `1.0/1` 读取，后续实际变更再递增配置版本；模块引擎资源包源码升级至 v6.9.5，MCP 参数说明、官网文档和 Client／模块 Skills 同步同一边界，5 个 `microi.mcp/dist` 文件只作为对应 TypeScript 的生成结果提交。该增量出现在 v7.2.2 的 NuGet 与前后端 Docker 首轮发布完成之后，本轮只纳入源码、测试和最终官网文档，不重复发布已经公开的不可变 NuGet v7.2.2，也不把它误写为已进入上述首轮运行制品；官方资源与运行制品将在下一正式版本同步。
- **v7.2.2 统一版本与首轮完整制品发布**：Microi.Client、Directory.Build.props、根仓 17 个公共组件，以及 Microi.net、Microi.AI 独立仓的 NuGet、程序集和文件版本统一由 7.2.1 升级至 7.2.2；两个服务器子仓除三项版本元数据外没有其它源码差异。Microi.VSCode 本轮没有代码或版本变化，继续保持 v4.7.8，不创建空提交或虚构插件更新。一键发布按输入 `7.2.2、4、0、2、2、0` 以 `__MICROI_RELEASE_EXIT__=0` 完成，耗时 12 分 26 秒；官方资源同步、现代 Vite、串行压缩、Chrome 49 legacy、后端 Release、Microi.net／Microi.AI 保护、发布产物守卫、真实 liveness、NuGet 和前后端 Docker 推送均成功。
- **测试门禁、公共制品与生产版本独立回读**：空数据库来源门禁 6/6、后端 Quick TRX 2180/2180、应用商城资源定向测试 3/3、应用包 Node 测试 36/36，以及微信内容安全、原生控件、人员定位和 WebOS 六组定向检查全部通过；后追加的模块展示 Client 20/20、资源包 5/5、MCP TypeScript 类型检查和 ViewSchema 6/6 也全部通过，`git diff --check` 无错误。NuGet.org Flat Container 已独立回读 v7.2.2 的 19/19 个包；阿里云后端 `latest/v7.2.2/dev-latest` 三个标签统一为 `sha256:b8a05b7c85c9cd943e10b22400f6e7789f276edad3da019d6a623cc3cde6c060`，前端 Web／Client 的 4 个标签统一为 `sha256:1aaf47cab26c6625958d730000eacc9431203c2830bb6aa1b12c67359fc091b5`；`api.itdos.com/api/Os/GetMicroiNetVersion` 已返回 7.2.2。没有具备隔离租户配置的环境可执行后端 Full，因此不把 Quick 写成 Full；继续保留 `Microsoft.Bcl.Memory 9.0.0` 的 NU1903 高严重性公告、xUnit 分析器、SystemJS、Dockerfile MAINTAINER 及 NuGet License／Readme 等非阻断质量债。

## v7.2.1 - (2026-08-08 08:51)

- **五仓历史、工作树与去重边界完整审计**：以 v7.2.0 对应的根仓 `9821dad36263be9989dcdcddce0ab99adb0dab73`、Microi.net `426db7377c0371cba603052f1a4c8c35d618d8fa`、Microi.AI `a0b6e7c8a35714c3f3d4acc377a3c6199803b0d2`、Microi.VSCode `4145fe1734b1b92ed4a17253996c1a72d10c0d43` 和 WebOS `477a9ec5434711a7ab4c701c858c3a9a0491fe8c` 为锚点，逐仓 `fetch --prune` 后，本地与上游均为 0 ahead／0 behind，锚点后没有遗漏提交、英文说明、自动 merge 或重复分支变更。写日志前，根仓有 30 个已跟踪修改和 3 个未跟踪文件（204 行新增、117 行删除，另有 101 行新文件），Microi.net、Microi.AI 各有 1 个版本文件，Microi.VSCode 完全干净，WebOS 独立仓有 17 个已跟踪修改和 9 个新文件（合计约 2985 行新增、506 行删除）；五仓共 61 个差异路径、约 3296 行新增和 629 行删除，`dist/bin/obj/.tmp` 均已排除。v7.2.0 日志已记录当时未提交的 WebOS 14＋4 个文件，因此本版不把现有 WebOS 脏树全部重复宣称为新增，只归纳其后的多窗口、嵌入隔离、会话权限及交互增量。
- **v7.2.1 统一版本同步**：Microi.Client、Directory.Build.props、根仓 17 个公共组件，以及 Microi.net、Microi.AI 独立仓的 NuGet、程序集和文件版本统一由 7.2.0 升级至 7.2.1；Microi.net 与 Microi.AI 除三项版本元数据外没有其它源码差异。Microi.VSCode 插件与 CLI 本轮无代码或版本变化，继续保持 v4.7.8，不创建空提交或虚构插件更新。
- **WebOS 新增安全高性能多窗口工作台与可复制深链**：macOS／Windows 桌面可同时打开最多 6 个授权应用窗口，支持焦点与 z 序、级联初始位置、拖动、八方向缩放、最小化、最大化／还原、关闭、显示桌面及 Dock 任务切换；拖动和缩放采用 Pointer Events、`requestAnimationFrame` 与半透明 ghost，交互期间暂时隐藏 iframe 重内容，减少重排重绘。活动窗口路由同步到 `#/os?webosApp=`，复制链接后可按实时菜单权限以单窗口最大化恢复；同一菜单内仅允许原表详情或原微应用子路由，跨表、跨应用、404 和 `/os` 递归均失败关闭。
- **WebOS 嵌入运行时、登录态与权限隔离**：同源 iframe 通过 128 位随机 `window.name` nonce 进入内容模式，父子消息同时校验 origin、source 与 nonce；子窗口只读父页白名单启动快照及内存认证广播，不安装 Pinia 持久化，不回写 localStorage／认证 Cookie，不重复执行 OsClient 初始化、CurrentTime、PageInit／RefreshToken、聊天 WebSocket、行为上报或开发内存监控，避免多窗口覆盖共享登录态或成倍建立实时连接。子窗口认证失效统一通知父桌面走平台标准清理与登录恢复；iframe 地址只保留允许的 OsClient，sandbox 收紧能力，外链仅接受 http／https 并固定 `noopener,noreferrer`。
- **WebOS 会话授权、注销与资源回收闭环**：桌面实时菜单树成为窗口权限唯一权威源，Dock 仅作快捷入口且失败不能锁死桌面或反向扩权；菜单网络／业务失败最多重试 3 次，支持取消和 sessionKey 竞态防护，账号、租户或 API 基址切换会清理窗口与旧菜单，权限撤销会立即销毁失权 iframe。WebOS 注销复用平台后端会话吊销及 Token、当前用户、动态路由、权限和页签完整清理；后台 iframe 的路由、标题和脚本聚焦不再抢前台焦点。关闭／卸载时同步销毁 iframe 事件、Sortable、MutationObserver、授权请求、document/window 监听、定时器和 RAF，降低长期使用的卡顿及泄漏风险。
- **WebOS 主题图标、Dock 与上下文菜单增量修复**：在 v7.2.0 已完成的经典工具栏、Icon 优先和玻璃文件夹基础上，文件夹、窗口、右键菜单与聊天表面继续接入亮暗主题变量并同步到子窗口；空白处左键现在会关闭平台右键菜单，菜单内部点击保留，连续右键仍保持单实例且阻止浏览器原生菜单。Windows Dock 保留大量图标横向滚动，并以 Teleport tooltip 提升到应用窗口之上，避免悬浮内容被裁切。没有把所有 WebP 盲目换成 SVG：主题场景优先使用可继承 `currentColor` 的内联 IconClass，只有显式标记为可信单色的 SVG 才通过 CSS mask 染色；全彩图片和 Dock 继续 Icon 优先、失败后回退 IconClass，因为外部 `<img src="*.svg">` 本身不会继承页面主题色。
- **表格中文短表头完整显示**：`diy-table.vue` 的业务列和审计列统一增加 `col-header-label`，通过 flex `min-width:0`、`nowrap`、`word-break:keep-all` 和超长省略号保证“标题／分类／内容”等中文短标题不再逐字或两字换行；排序与三点菜单图标固定宽度、不参与收缩，同时继续遵循字段 `TableWidth` 和原通用列宽算法，没有为 `/#/bwl` 写路由特判。最终浏览器回归中相关表头均为单行，完整标题和菜单入口同时可见。
- **官方菜单图标与应用商城安全范围交付**：通过绑定 `https://api.itdos.com + OsClient=iTdos` 的 `microi_itdos`，精确回读并确认“系统引擎、系统管理、第三方平台”三棵树共 98 个菜单全部具有合理 IconClass 和一对一 `microi_icon` 图片；`app.microi.wallpaper` v1.0.6 已发布、已审核的包内 223 条图标数据包含这 98 个资源，`app.microi.message-notification` v1.0.2 也已同步“模板消息”菜单并完成写后回读。没有把其余 8 个第三方菜单强行发布成不安全的新应用：精确导出虽得到 8 个菜单、5 张表和 22 个字段，但包内为 0 个功能 API，并发现 5 个明文 AppSecret／Token／EncodingAESKey、8 个匿名或硬编码／演示型旧 API、消息通知的未声明表依赖、空列表配置、图标二进制可移植性及“企微应用列表”误挂飞书等问题；待完成可信后端加密、掩码、API ResourcePolicies、依赖与资源归属重构后再独立发布，避免把安全债扩散给安装用户。
- **定向测试与真实 Edge 交互验收**：根层 WebOS／表头／嵌入运行时与 WebOS 独立仓定向契约共 30/30 通过，覆盖内部 URL、表／微应用作用域、外链协议、递归授权、nonce、窗口边界与容量、权限撤销、三次重试和 transport reject、空白左键、主题图标、清理与 Vue SFC 解析；包含更广性能合同的最终组合测试为 40/40。独立 Edge context 使用真实 admin 会话完成 macOS／Windows、主题、文件夹、聊天、连续右键与空白左键、两窗口、ghost 拖动／缩放、最小化／Dock 恢复、最大化／还原、深链和 `/#/bwl` 验收，结束仅关闭本任务 browser/context，不触碰用户浏览器或 VS Code Playwright Test Server。
- **完整制品发布与公共回读**：一键发布按输入 `7.2.1、4、0、2、2、0` 以 `__MICROI_RELEASE_EXIT__=0` 完成，耗时 12 分 25 秒；官网升级资源同步、现代前端、串行压缩、Chrome 49 legacy、后端 Release、Microi.net／Microi.AI 保护、18080 liveness HTTP 200 与发布产物 `logs/PDB=0` 守卫均通过。NuGet.org Flat Container 已独立回读 19/19；阿里云后端 3 个标签统一为 `sha256:17099e0c2d5419daa0fca97e2b9e4996d77f3b44cb6f6acf4565e6bdce3265f5`，前端 4 个标签统一为 `sha256:0458ec885791aa5840fda4e2a50877218f27c0442f44d9e54ded83d27583019e`；`api.itdos.com/api/Os/GetMicroiNetVersion` 已返回 7.2.1，发布锁、18080 和本轮发布进程均清理。继续保留 `Microsoft.Bcl.Memory 9.0.0` 的 NU1903 高严重性公告、xUnit 分析器、SystemJS、Dockerfile MAINTAINER 及 NuGet License／Readme 等非阻断质量债。

## v7.2.0 - (2026-08-08 06:21)

- **四仓历史、待提交差异与独立仓边界完整审计**：上一版本 v7.1.11 对应根仓 `20ad3fc1b4bbe3d2a5a8b74d8b156e8aa58cc941`、Microi.net `e00119e3af3c6eaada08690328b814a4bb26c212`、Microi.AI `8f3909413a43ba828182687fcdd61d513053009e`、Microi.VSCode `b9dcb636ddf3c0cb9a696998ba19f60deb88acd5`；四个锚点到发版前 `HEAD` 均无新增提交、英文提交或 merge，历史中的自动合并早于该边界且不重复归纳。发版后、日志起草前，根仓有 43 个已跟踪修改和 6 个未跟踪源码／测试／静态资源文件（已跟踪净差异 1746 行新增、292 行删除），Microi.net 与 Microi.AI 各有 1 个版本文件；最终复核时 Microi.VSCode 新增 2 个版本文件且无功能源码差异。`dist`、`bin`、`obj`、`.tmp` 等生成物不纳入功能分析。`Microi.Client/src/views/webos` 实际是被根仓忽略的第 5 个独立 Git，当前 14 个已跟踪修改和 4 个未跟踪工具文件已编入本次前端镜像，但不属于用户指定的四仓提交范围，源码仍需另行提交推送。
- **v7.2.0 统一版本发布**：按吾码进位规则由 v7.1.11 升级至 v7.2.0；Microi.Client、Directory.Build.props 及 Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade、缓存、验证码、HDFS、任务、消息队列、MQTT、MongoDB、OCR、Office、搜索、采集、V8、微信等 17 个主仓服务项目同步更新，Microi.net 与 Microi.AI 独立仓的 NuGet 包版本、程序集版本和文件版本也统一为 7.2.0。两个服务器子仓除版本同步外没有其它源码差异；共享工作区中的独立插件发布流程随后把 Microi.VSCode 插件、CLI 与根仓内置 Skills 版本标记由 v4.7.7 升级至 v4.7.8，仍只有版本文件变化。Open VSX 已回读 v4.7.8；写日志时 Visual Studio Marketplace 仍返回 v4.7.7、npm `@microi.net/cli@4.7.8` 仍为 404，因此不把三端公开发布描述为全部成功。
- **多语言初始化升级为可恢复的分布式持久任务**：新增 `DiyLangBackgroundTaskService`，把手工初始化、`Wait=true` 和启动期缺失译文修复统一送入 `mci_background_task`；按租户生成稳定幂等键与并发键，使用可续租租约和 fencing token，支持最多三次重试、进程重启恢复和有界等待。活动任务只有在语义等价或覆盖本次请求时才复用，执行前重新核验平台管理员权威身份，原生 Worker Key 不能经通用后台任务接口直接提交；租约丢失后会在后续数据库批次前停止写入，避免旧持有者覆盖新任务结果。
- **多语言跨节点幂等、兼容迁移与诊断脱敏**：`diy_lang` 新记录改用“租户＋规范化 Key”的确定性 Id；物理表已有 `KeyHash` 时写入小写 SHA-256，尚未进入 Phase A 的旧库不擅自修改表结构。并发插入冲突会回读权威记录并收敛为更新，同时兼容历史随机 Id；翻译供应商的持久任务结果和日志只保留不含凭据的稳定指纹，URL、Token、Secret、API Key 等在落库前统一脱敏。系统设置的“初始化多语言”入口会显示持久任务编号，并新增租约、任务复用、确定性 KeyHash、并发收敛和日志脱敏回归用例。
- **微应用首开白屏自愈与跨 iframe 连续交互修复**：宿主为每次解析／重挂载下发 `hostGeneration` 和 `hostMountAttempt`，只在收到匹配的 `micro-app:ready` 或确认根节点已有内容后进入 mounted；已挂载但仍为空时启用 4 秒内容看门狗并执行一次受控重建。子应用事件改用强制分发，连续点击也能关闭框架全局搜索；宿主同步清理 Element Plus teleport 下拉层、搜索值和焦点，避免旧浮层遮挡微应用。对应 Skill 补充首次就绪、连续交互、真实 DTO 与版本／源码／构建资产同步约束。
- **登录安全弹层、动态主题与个人中心契约修复**：Authenticator 免密码登录升级为独立主题化安全弹层，补齐账户和一次性验证码自动完成、数字过滤、六位长度、自动聚焦、提交忙碌态、键盘操作、移动布局、暗色主题和减少动效；登录壁纸采用前后双层平滑过渡，主题切换增加可取消过场。平台个人中心的在线终端按真实 `Data.Terminals` DTO 读取并兼容旧数组响应，列表优先使用 `ConnectionId`、`DeviceClientId` 等稳定键；官方“SaaS 引擎”包升级至 v6.4.8，内置平台基础服务升级至 v1.5.5／CurrentVersion 12，7 个路由统一同步构建版本。
- **应用商城中断续包版本合同失败关闭**：统一发布器升级至 v1.6.5，应用商城包升级至 v7.1.14；legacy `ExactPublishedVersion` 只兼容历史 `Published` 和新版 `Completed` 成功终态，v3 继续只接受 `Completed`。调用版本、最新不可变版本与 `PreparedAssets.PackageVersion` 必须完全一致，失败、处理中、已取消、旧版本或缺失资产全部拒绝发布；源码、共同基线、商城内嵌副本和契约测试同步，避免中断续包把错误版本写入官方应用。
- **WebOS 桌面、顶栏、Dock 与右键菜单全面收敛**：顶栏复用经典搜索、语言、主题、后台任务、AI 和蓝牙能力并统一为 30×30 居中入口，聊天改用全局 DiyChat 状态、未读数和 IM 重连，个人中心统一跳转平台微应用而不再打开 DiyForm。macOS 小组件恢复数据驱动背景，Windows 桌面修复纵向网格和溢出；两种 Dock 均按 Icon 优先、IconClass 兜底，兼容私有 HDFS／URL、失败回退、主题底板、悬停不截断和移动滚动。文件夹弹层改为主题化玻璃背景，捕获阶段连续右键只关闭并重开一个平台菜单，阻止浏览器原生菜单穿透；倒计时／每日一言恢复缺失资源和 CSS 兜底，外链统一补 `noopener noreferrer`。WebOS 定向契约测试 11/11 通过，根仓补回 `dayworld.jpeg`、`22831288_700x700.jpeg` 和 `logo.svg`。
- **完整制品发布与权威回读**：一键发布按输入 `7.2.0、4、0、2、2、0` 以 `__MICROI_RELEASE_EXIT__=0` 收尾，耗时 12 分 45 秒；现代 Vite、逐文件串行压缩、Chrome 49 legacy、后端 Release（0 个错误、9 个警告）、Microi.net.Api publish、受保护 DLL 替换及 liveness HTTP 200 均通过。19 个 NuGet 包全部被推送端接受，随后 NuGet.org Flat Container 已独立回读 19/19；阿里云后端 3 个标签统一为 `sha256:38f1886c1d557e2679ccac2220a65ceeb339ba04ad18269b925afa8d5d971e70`，前端 4 个标签统一为 `sha256:347bded3b97d7381bd38862fe958e689aa1533012021a5a186c9c02241418cd0`，`api.itdos.com/api/Os/GetMicroiNetVersion` 已返回 7.2.0，发布锁和进程均已清理。继续保留 `Microsoft.Bcl.Memory 9.0.0` 高严重性漏洞公告、SystemJS package type、xUnit 分析器、Dockerfile Maintainer 以及 NuGet License／Readme 等非阻断警告；生产 WebOS 登录点击验收仍在后续工作中，不以版本接口成功替代真实页面验收。

## v7.1.11 - (2026-08-08 03:58)

- **四仓历史与待提交差异完整审计**：本日志上一版本 v7.1.10 对应根仓 `5e446f912afc16b18bf3ded37204ce8d8c72d20f`、Microi.net `7bf402609e5b9cf9a331ee66a63206596deb7ef2`、Microi.AI `26bb0dd5b008d975bc880a094b26dc5913030d0b`、Microi.VSCode `31222f2ca78a94e5d2a1a93ec702fb8e3e475568`；逐仓 `fetch --prune` 后，这四个锚点到本地 `HEAD` 与远端 `origin/master` 的提交范围均为空，因此没有遗漏的英文提交说明、分支合并或自动 merge 重复变更需要再次归纳。主发布完成后，根仓仅有 20 个已跟踪版本文件待提交，Microi.net、Microi.AI 子仓各 1 个项目版本文件，Microi.VSCode 子仓 2 个插件／CLI 版本文件；四仓均无未跟踪或已暂存文件，`dist`、`bin`、`obj` 等生成目录未纳入功能分析。
- **v7.1.11 统一版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务、消息队列、MQTT、MongoDB、OCR、Office、搜索、采集、V8、微信等公共组件由 v7.1.10 统一升级至 v7.1.11；Microi VS Code 插件、独立 CLI 与内置 Skills 由 v4.7.6 升级至 v4.7.7。本版本除版本号和 Skills 更新时间同步外没有新增业务源码差异，功能内容继续继承 v7.1.10，避免把上一版本已经总结的多登录方式、个人中心、SaaS 安全配置等变更重复计算。
- **完整制品发布与权威回读**：第一次执行在版本已更新至 v7.1.11 后因本机 `microi_itdos` Token 过期被官网资源同步保护门禁中止；重新认证绑定 `https://api.itdos.com + OsClient=iTdos` 后继续同一版本并成功完成，未错误递增补丁号。第二次执行以 `__MICROI_RELEASE_EXIT__=0` 收尾，耗时 13 分 18 秒，完成官网升级资源同步、现代前端构建、逐文件串行压缩、Chrome 49 legacy、后端 Release（0 个编译错误）、Microi.net.Api 发布、受保护 DLL 替换、真实 liveness HTTP 200、19 个 NuGet 以及前后端正式／测试 Docker 推送；NuGet Flat Container v7.1.11 已 19/19 公网回读，后端三个标签统一为 `sha256:540e9dab877548ffa3fa6ac7872c9a98b420c7db98314a0a19aad2140278dd3e`，前端四个标签统一为 `sha256:36932dfcbba15c3f8282683a8a5f9386527e56ba70912aaf7641cc3e17ec2bd9`，发布锁和发布进程均已清理。写日志时 `api.itdos.com` 仍运行 v7.1.10，说明公共制品发布成功但生产节点自动拉取尚未完成；继续保留 `Microsoft.Bcl.Memory 9.0.0` 高严重性漏洞公告、xUnit 分析器及 NuGet License／Readme 等非阻断警告。

## v7.1.10 - (2026-08-08 03:28)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务、消息队列、MQTT、MongoDB、OCR、Office、搜索、采集、V8、微信等公共组件统一升级至 v7.1.10，Microi VS Code 插件、独立 CLI 与内置 Skills 升级至 v4.7.6。写日志前根仓库共有 76 个已跟踪文件和 13 个未跟踪源码／文档／测试文件待提交；Microi.net、Microi.AI 子仓库各 1 个版本文件，Microi.VSCode 子仓库 2 个版本文件，四仓均无已暂存内容。`dist`、`bin`、`obj` 等生成目录不纳入功能分析；三个子仓库本轮除版本升级外没有其它源码差异。
- **多登录方式酷炫弹层与租户品牌适配**：登录页把原有大块“生物登录”入口重构为主登录按钮旁的“登录方式”，点击后以桌面／移动自适应弹层展示 Passkey 生物登录、Authenticator 动态口令、严格人脸以及租户已配置的 Gitee、微信、GitHub 等外部登录；可用性、状态和说明由匿名能力接口动态返回，点击可直接进入对应验证流程，Esc、遮罩和焦点行为完整。界面不再固定显示“吾码／Microi”，系统 Logo、标题和说明使用当前租户配置，并继续遵守隐私协议、主题与减少动效设置。
- **Authenticator 解密兼容与 Passkey 中文诊断**：TOTP 新绑定统一使用缓存中的规范租户标识派生 AES-GCM 密钥，解密按规范标识、请求标识和历史小写标识有界兼容，修复 `iTdos/itdos` 大小写漂移导致的 `The computed authentication tag did not match...`；密文结构、AuthSecret 漂移或多节点配置不一致时返回可操作中文方案，前端也不再透传英文认证标签错误。Passkey 在下发挑战前校验 RP ID 必须等于当前域名或其父域，Origin 白名单、HTTPS、跨站 `/.well-known/webauthn`、重新登记等解决方法均以中文展示，不再暴露浏览器原始英文 SecurityError。
- **个人中心、公开头像与微应用首开体验**：右上角“个人设置”升级为“个人中心”，移除重复的独立改密菜单；平台内置微服务 v1.5.4 使用租户系统标题而非固定 MICROI 品牌，安全与登录、验证器、外部账号、偏好与终端等区域跟随主题。`sys_user.Avatar` 继续保存私有头像，新增 `PublicAvatar varchar(2000) + ImgUpload(Limit=false)` 保存公有头像，后端分别限制在 `member/avatar` 与 `member/public-avatar` 目录；头像解析兼容对象、JSON、相对／绝对路径和历史公有／私有数据，Authenticator 可显示真实公开头像与科技 Banner。微应用交互会关闭框架全局搜索浮层，首次打开个人中心的路由、资源与宿主上下文完成线上白屏回归。
- **SaaS 控制面敏感配置与 MinIO 可诊断上传**：只有主租户 Level=9999 控制面读取 `sys_osclients` 详情时，才把当前主租户运行模型中的共享基础设施白名单投影到子租户空字段；投影发生在 V8／DataFilter 之后，并写入 `NotSaveField`，既让最高管理员能看见实际继承的 MinIO 等配置，又不会向普通用户、子租户 V8 或表单保存泄露／复制主租户秘密，且不会为了只读详情强制初始化目标租户。MinIO 上传后仍强制 HEAD／Stat 回读，AccessDenied 会明确指出目标桶、对象、所需读取权限和 Nginx `proxy_cache_convert_head` 排查方向，不以跳过回读掩盖未落盘风险。
- **应用商城布尔迁移、身份包与源码交付**：统一导入器升级至 v1.9.8，把 MySQL `BIT` 识别为数值类型；只有应用包与目标元数据双重声明为 `Switch` 时，才把历史 `True/False`、JSON 布尔和 `0/1` 规范成数值，其它非数字脏数据继续失败关闭，修复旧租户 `IsDeleted/IsEnable/MinIOEndPointSSL` 等字段阻断整包更新。官方“SaaS引擎”升级至 v6.4.7，完整包含身份验证表、动态系统设置、外部身份、`sys_user.PublicAvatar`、平台微服务 23 个源码文件、4 个构建资产及源码／构建 ZIP；`microi_xjy` 后台分片更新任务已 `Succeeded`，物理列、源码清单、个人中心路由和 Banner 均完成远端回读。
- **表格特殊字段与模板样式安全渲染**：PC 表格和卡片统一使用 `DiyTableSpecialCell` 渲染公有／私有图片、附件、子表、地图、二维码、图标、颜色、评分、进度、开关、JSON、富文本、代码和关联字段，并复用签名 URL、预览、详情与子表授权入口。V8 模板允许 `<style>/<styles>` 但会提取并限定到当前单元格作用域，阻止全局选择器、`@import`、`url()` 和危险 CSS；`target=_blank` 自动补 `noopener noreferrer`，避免模板样式污染整页或新窗口劫持。
- **官网内容地图与质量门禁**：新增源码架构与模块地图、AI 工作流／业务蓝图／状态机／流程挖掘、PC／WebOS／移动 Web／UniApp／App 壳、3D／CAD／数据大屏、Microi MCP Server 等专题；首页、侧栏、中英文映射、GitHub 开源入口与 HDFS、V8、VS Code、本地运行说明同步更新。文档构建新增侧栏覆盖和开源仓库链接检查，并与死链、主题、SEO 检查组成统一发布门禁。
- **定向验证与 v7.1.10 公开发布回读**：身份／租户配置／MinIO 后端定向回归 91 项、v6.4.7 内嵌包 3 项、身份前端 11 项、商城导入 40 项以及表格模板／特殊字段／WebOS 13 项通过；PC 1440×900、移动 390×844 登录弹层与线上个人中心首次打开完成真实浏览器回归。完整一键发布以退出码 0 完成现代前端、串行压缩、Chrome 49 legacy、后端 Release、API HTTP 200 存活探测、19 个 NuGet、Microi.net／Microi.AI 受保护产物及前后端正式／测试 Docker 推送；NuGet.org Flat Container v7.1.10 已 19/19 回读，后端标签收敛至 `sha256:10ab2d42...d0bbf`，前端标签收敛至 `sha256:0c5d9f90...58f1d`，`api.itdos.com` 版本接口已返回 7.1.10，发布锁已清理。保留 `Microsoft.Bcl.Memory 9.0.0` 已知高严重性漏洞及少量分析器／Dockerfile 告警；有效手机 TOTP 与真实 Passkey／人脸硬件动作仍需用户当场确认，不能由无设备自动化替代。

## v7.1.4 - (2026-08-07 16:14)

- **版本发布与四仓边界**：写入本日志前，根仓库共有 4 个已跟踪文件和 1 个未跟踪测试文件待提交，Microi.net、Microi.AI 子仓库各有 1 个版本文件待提交，Microi.VSCode 子仓库工作区干净；`dist`、`bin`、`obj` 等生成目录不纳入功能分析。Microi.net 与 Microi.AI 的程序集、文件和 NuGet 版本由 v7.1.3 升至 v7.1.4，VS Code 插件本轮没有源码或版本差异，因此不虚构插件更新内容。
- **个人设置微应用路由解析修复**：微应用页面解析不再把 `PagePath` 重复拼接为应用根路径，支持 `/personal-settings` 等由应用 Manifest 声明的页面路由；线上曾出现的 `MICRO_APP_PAGE_RESOLVE_FAILED` 已在源码中修复，正式生产站点仍以其自动拉取 v7.1.4 后端镜像、重建节点并完成登录点击回归为最终验收。
- **身份验证应用商城正式交付**：遵循“表、字段、配置、微应用优先通过应用商城升级”的平台规范，将官方“吾码 SaaS 引擎”应用由 v6.3.5 升级至 v6.3.6；完整包纳入 `mci_identity_credential`、`mci_identity_device`、`mci_identity_face` 三张身份表、443 个字段资源中的相关身份字段、9 项 `sys_osclients` 身份配置，以及 `microi-platform-service` v1.3.0 的 `/personal-settings` 等 6 个路由和 4 个构建资产。原有 8 个核心接口引擎继续保留逐项 `Managed` 基线与资源策略，未新增重复 .NET 数据迁移或第二套 Token／权限体系。
- **iTdos 身份能力在线开启**：通过绑定 `https://api.itdos.com + OsClient=iTdos + Product/Internal` 的官方 MCP，把设备身份验证、Passkey 和修改密码步进验证设为启用，RP ID 固定为 `os.itdos.com`、Origin 固定为 `https://os.itdos.com`；配置写后数据库精确回读一致，运行时 `GetCapabilities` 返回 `Enabled=true`、`PasskeyEnabled=true`、`PasswordChangeStepUp=true`、`SessionSystem=DiyToken`、`StoresBiometricImages=false`。严格人脸因尚未配置可信 `Microi Face Gateway v1` 地址和密钥而保持关闭，防止只开开关却形成不可用或不安全的登录入口。
- **受保护平台表提交稳定性**：表单提交时优先使用表定义名称；当平台安全投影不向前端返回 `Name` 时，依次回退调用方 `TableName` 与后端支持的 `TableId`，同时传递 `_TableId`，若三者都无法解析则在前端失败关闭，避免发送空 `FormEngineKey` 导致修改个人资料、密码或其它受保护表单失败。新增静态回归用例锁定表身份回退、空值守卫和旧式直接取名路径已移除。
- **一键安装器 Docker 内网与无损修复**：所有独立 Compose 编排默认接入共享 `microi` bridge 网络，API 通过容器 DNS 和内部端口访问数据库、Redis、MongoDB、MinIO，宿主机端口仅用于浏览器、运维和本机健康探测；MinIO 初始化与服务端端点同步改走内网。新增 `bash install-microi.sh --repair-app`，可从容器 Compose 标签和标准目录精确定位现场配置，先保存 Compose、容器元数据与旧镜像恢复点，再仅重建无状态 API/Web 容器；数据库、Redis、MongoDB、MinIO 容器、目录和 volume 均不删除，配置冲突或 liveness/readiness 失败时停止并尝试恢复旧镜像。官网 Docker 文档和 17 项 SaaS/安装器契约测试同步覆盖这一边界。
- **定向测试与 v7.1.4 公开发布**：表单表身份回退 1 项、SaaS/安装器契约 17 项和安装脚本 Bash 语法检查全部通过。一键主发布以 `__MICROI_RELEASE_EXIT__=0` 完成现代前端、串行压缩、Chrome 49 legacy、后端 Release、API HTTP 200 存活探测、Microi.net／Microi.AI NuGet 推送及前后端正式／测试 Docker 发布；后端 0 个编译错误，保留 `Microsoft.Bcl.Memory 9.0.0` 已知高严重性漏洞和少量 xUnit／Dockerfile 分析告警。阿里云后端标签收敛至索引摘要 `sha256:04f4f872...d36782`，前端标签收敛至 `sha256:80c6e80a...fdcc0`；写日志时 NuGet.org Flat Container 尚在传播并返回 404，不能描述为公共下载回读已通过，公共制品发布也不等于所有生产节点已拉取重建或实体人脸／Passkey 设备验收完成。

## v7.1.3 - (2026-08-07 14:55)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、OCR、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v7.1.3；Microi VS Code 插件、独立 CLI 与内置 Skills 升级至 v4.7.5。写入本日志前共有：根仓库 28 个已跟踪文件，Microi.net 6 个已跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 2 个已跟踪文件；四仓均无未跟踪或已暂存文件。Microi.AI 本轮只有程序集、文件和 NuGet 版本差异，Microi.VSCode 本轮只有插件与 CLI 版本差异。
- **主库空数据库制作彻底闭环**：准备阶段接收与发布阶段相同的已校验脱敏 SQL，只预判无条件 `TRUNCATE TABLE` 或无条件 `DELETE FROM` 的表，并在复制 2854 张主库表时直接跳过其 103 张最终必为空表，避免复制大量随后必删的数据；带条件删除、字符串和注释中的伪语句不会误命中。Redis 发布租约发现前任后台任务已进入成功、失败或取消终态时，可用原任务 Id 比较交换安全接管，节点中断后的新任务无需等待旧 TTL；准备响应与进度同时返回复制行数、跳过表数和可核对的阶段信息。
- **七数据库种子包兼容与真实发布**：MySQL 5.7 Dump 解析器补齐 `char(n)`，并在 MySQL 8.0、SQL Server 2022、Oracle 19c、达梦 8、PostgreSQL 17、人大金仓和 MySQL 5.7 的类型映射、字符串大小判断及逻辑文本包络中与有界 `varchar` 一致处理。官方任务 `04993577f60348bf83be1326415fd36f` 已成功复制 294275 行并发布 7 个数据库 ZIP；最终保留 145 张表、86142 行、59 张非空表，敏感业务与应用产物断言均为零。七个 `static.itdos.com/install/microi_empty_*.sql.zip` 已按内容长度和 SHA-256 外部下载回读 7/7 一致，不把后台任务成功或单个 HTTP 200 代替文件验收。
- **V8 嵌套调用树内存保护**：每个 Jint 引擎继续保留独立累计分配预算，同时新增跨嵌套接口／事件的根调用树预算；诊断区分 `V8_MEMORY_LIMIT` 与 `V8_CALL_TREE_MEMORY_LIMIT`，可识别循环编排、过深调用和大对象跨层返回。只有经过认证、受单独数据库／文件边界约束的平台宿主原子操作可暂时排除托管分配计量，普通嵌套 V8 无法通过创建新引擎重置外层预算；作用域随 `AsyncLocal` 调用链传递，异常、取消和退出均按栈恢复。
- **官方商城包与租户回读**：官方 SaaS 引擎应用升级至 v6.3.5，将 `admin_build_sanitized_empty_database` v1.0.8、可更新的 `Managed` 基线和资源策略写入完整应用包；统一导入器 v1.9.2 及商城六项固定资源、批量导入和 AI 应用构建资源均完成源码／内嵌副本／官方远端 SHA-256 回读。卡牌租户重新安装“模块引擎”后，商城实时状态已从“更新”恢复为“重新安装”；方志租户已在旧后端二次稳定复现 MinIO XML 响应解析异常，证明其配置并非普通上传不可用，源码修复已进入 v7.1.3 镜像，但该生产站点仍需拉取新后端镜像后再做最终安装验收。
- **权限、表单与定向回归**：官方建租户接口已补齐超级管理员角色并完成线上写后回读，`admin` 实际调用不再返回“没有权限”，而是进入预期的 Gitee 授权／Star 前置校验；指定表单设计器的空字段补丁合并修复在本地共享服务上完成真实 Edge 点击保存，`UptFormData` 与 `UptDiyFieldList` 均 HTTP 200、`Code=1`。空数据库、V8 内存、七库种子转换后端定向测试 49 项，补充的转换测试 12 项，以及应用商城导入、发布、模块状态和资源同步 Node 定向测试 73 项全部通过。
- **v7.1.3 公开发布回读**：一键发布完整通过现代前端、串行压缩、Chrome 49 legacy、后端 Release、Microi.net／Microi.AI 受保护产物处理、真实 API HTTP 200 存活探测、19 个 NuGet 推送及前后端正式／测试 Docker 发布；后端 0 个编译错误，保留 Microsoft.Bcl.Memory 已知高严重性漏洞及少量分析器警告。发布脚本退出码为 0 且共享发布锁已清理；阿里云后端 3 个标签收敛至 `sha256:8bb0ea3f...bed63`，前端 4 个标签收敛至 `sha256:ccfd06f3...ba139`。NuGet.org 的 19 个 v7.1.3 包已全部被推送端接受，但写日志时 Flat Container 尚在传播并返回 404，因此不把公共索引回读描述为已经通过；公共镜像／包发布也不等于方志等生产节点已经拉取重建。

## v7.1.2 - (2026-08-07 13:23)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、OCR、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v7.1.2；Microi VS Code 插件与独立 CLI 升级至 v4.7.4，应用商城包同步至 v7.1.2。写入本日志前共有：根仓库 76 个已跟踪文件和 9 个未跟踪文件，其中 `microi.mcp/dist` 5 个编译产物不纳入功能分析，实际归纳 80 个源码／文档文件；Microi.net 3 个已跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 6 个已跟踪文件，四仓均无暂存内容。Microi.AI 本轮除程序集、文件和 NuGet 版本升级外没有其它源码差异。
- **DiyToken 身份体系与可逆业务秘密规范**：明确 DiyToken 继续作为吾码多租户、多终端、V8、角色／部门、菜单／表权限、数据范围、终端吊销和 Token 轮换的唯一会话入口；密码、SSO、OAuth、Passkey 或人脸验证成功后仍签发 DiyToken，不引入第二套 ASP.NET Identity 用户／权限 Token。登录密码的新存储使用后端带盐专用哈希；设备口令、第三方业务账号密码等确需再次显示原文的业务字段允许后端可逆加密，列表／导出默认掩码，明文显示必须走独立授权、`no-store`、无明文审计和前端超时清除；DES 保留为兼容格式，新高价值秘密优先使用带版本的现代认证加密与集中密钥管理。
- **Passkey、设备生物识别与严格人脸登录**：新增基于 FIDO2／WebAuthn 的 Passkey 登记、凭据管理和免密登录，Windows Hello、Touch ID、Face ID、Android 设备验证直接复用系统认证器，不需要额外模型 Docker；新增 `Microi Face Gateway v1` 严格人脸／活体协议，可按租户接入云服务或独立 Docker／集群，API Key 只在可信后端读取且不向子租户、V8 或公开配置投影。两类验证都先绑定仍启用的 `sys_user`，最终签发原有 DiyToken，并补齐设备、凭据、人脸绑定、挑战状态和不含生物原始数据的安全审计。
- **改密与 V8 敏感操作步进验证**：具有 Passkey 或严格人脸因子的用户修改密码时，客户端按用户与新密码计算操作摘要，后端从实际请求重新计算并原子消费票据；新增 `V8.Identity.GetCapabilities/CreateActionHash/RegisterPasskey/Verify` 与 `V8.Method.ConsumeIdentityVerificationTicket`，支持审批、显示业务秘密等自定义场景。票据绑定 `OsClient + UserId + Purpose + ActionHash`，在共享 Redis 保存两分钟并通过 `GETDEL` 一次性消费，跨节点、重试和滚动发布不能复用；访问密钥会话拒绝使用，票据也不代替菜单／表／行权限、状态机、事务、幂等和审计。
- **酷炫个人设置微服务入口**：PC 右上角头像菜单与移动端“我的”统一跳转官方 `microi-platform-service/personal-settings` 微服务，替换原有简易弹窗；修改密码可直接定位安全区域，并承载个人资料、头像、登录后首页、Passkey／设备／严格人脸安全因子等常用设置。页面遵循当前系统主题并复用微应用宿主路由，个人设置能力可随官方平台服务应用更新，不把复杂业务固化在主前端 Navbar。
- **MCP 建表、表单合并与 Token 校验修复**：受认证 MCP 建表改用带可信服务端标记的强类型 `DiyTableParam`，避免新表事务尚未提交时被前端事件回查为不存在而回滚；表单字段局部更新合并时忽略非空值类型的 `null/undefined` 补丁，防止未提交字段意外清零，同时保留字符串和可空类型的主动清空语义。DiyToken JWT 签名改为直接校验原始 Base64URL Header／Payload 并使用固定时间比较，避免 JSON 重序列化造成合法 Token 假性签名不一致；平台超级管理员的接口引擎授权继续受租户、登录态和访问密钥白名单约束，但不再被旧 ApiRole Id 阻断可信后台任务。
- **微应用私有源码与公有运行产物隔离**：`mci_ai_app_file` 以 `StorageScope` 区分私有源码与流式公有构建产物，源码上下文、拉取和差异比较会排除 `PublicBuildStream/PublicBuildStreamArchived/PublicBuildOnly`，并兼容旧数据的路径判断；`ReplacePrivateSourceOnly` 只清理过期私有源码，禁止旧式全表替换误删线上运行资产。默认发布在切换运行版本前完成私有 HDFS 路径集合、文件数、字节数、逐文件 SHA-256 和规范化清单哈希回读；VS Code v4.7.4 同时新增带明确确认的“仅编译产物”模式，默认“源码+编译产物”仍为推荐路径。
- **应用商城安装版本身份自愈**：官方导入器升级至 v1.9.2，读取安装记录时按 AppId、StoreId、历史 AppName 依次回退，并在成功安装后更新同一条旧记录，修复早期只有应用名称的租户永久显示“可更新”；运行时、下载资源和内嵌导入器三份版本门与完整性标记同步提高，继续保留接口引擎所有权、断点安装、资源基线和失败回滚保护。
- **空数据库发布与 MinIO 可验证写入**：空数据库重建先按视图、表顺序分批清理，每批使用新连接、120 秒命令上限、瞬时故障重试和发布租约检查，节点重启或 MySQL 结果流异常后可幂等恢复；后台 HDFS 发布固定使用租户内部对象存储地址，上传后强制 `ObjectExist` 回读。MinIO 写入统一执行 `StatObject` 大小校验，即使代理响应解析异常也只在对象真实存在且大小匹配时判定成功；一键发布进程管理器同步识别 Windows 下 `node_modules\\...\\vite\\bin\\vite.js` 命令，但仍要求当前工作区绝对路径或精确 CWD，避免误停其它 Vite。
- **官网文档、Skills 与 API 知识库同步**：新增身份验证专题，系统安全、V8 前后端 API、首页导航与中文映射同步 DiyToken、可逆秘密、Passkey、严格人脸、敏感操作票据和个人设置；工作区、安全、微服务及 V8 工具 Skills 固化相同开发边界。翻译文件示例修正为按上传文件名读取 `V8.FilesByteBase64['contract.docx']`；MCP 源码及生成声明同步建表可信来源和私有源码替换协议。
- **定向验证与 v7.1.2 公开发布回读**：身份、可信建表、表单合并、Token、微应用存储、MinIO 和空库发布后端 86 项，身份前端 7 项，应用商城 40 项，MCP 源码完整性 4 项以及 VS Code 微应用同步脚本全部通过；完整现代前端、串行压缩、Chrome 49 legacy、后端 Release、19 个 NuGet 打包、Microi.net／Microi.AI 受保护产物处理与真实 API HTTP 200 存活探测均成功。后端 0 个编译错误，保留 Microsoft.Bcl.Memory 已知高严重性漏洞及 xUnit 分析器警告；一键主发布以 `__MICROI_RELEASE_EXIT__=0` 完成，NuGet.org 19/19 个 v7.1.2 已通过匿名 V2 包下载、nuspec 版本和包内 DLL SHA-256 回读，v3 索引仍处于传播期；阿里云后端 3 个标签收敛至 `sha256:5f03f602...ef742`，前端 4 个标签收敛至 `sha256:0f10fe8d...cc78`。公共制品成功不等于生产节点已拉取重建，也不把尚未完成的官网应用更新、真实浏览器 Passkey／人脸或实体设备活体测试描述为通过。

## v7.1.1 - (2026-08-07 00:00)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、OCR、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v7.1.1；Microi VS Code 插件、独立 CLI 与内置 Skills 升级至 v4.7.3。写入本日志前的非生成文件待提交基线为：根仓库 31 个已跟踪文件和 2 个未跟踪文件，Microi.net 1 个已跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 2 个已跟踪文件；`microi.mcp/dist`、`bin`、`obj` 等 38 个生成文件不纳入功能分析。Microi.net、Microi.AI 子仓库本轮除程序集、文件和 NuGet 版本升级至 v7.1.1 外没有其它源码差异；Microi.VSCode 子仓库本轮除插件与 CLI 版本升级至 v4.7.3 外没有其它源码差异。
- **Classic 桌面壳层状态恢复**：`ShowClassicTop`、`ShowClassicLeft` 改为当前 URL 的一次性显示策略，初始化、路由切换和退出页签全屏后都会重新按地址同步；参数移除后自动恢复顶栏、侧栏，不再把某个隐藏壳层的业务链接状态残留到后续页面或刷新。非页签全屏状态下按 Esc 可退出 URL 隐藏模式，只清理外层及 Hash Query 中的壳层参数并保留 `OsClient`、`FormDataId` 等其它业务参数；页签全屏继续优先由 TagsView 自身退出，避免同一次按键触发两套恢复逻辑。
- **Pinia 4 持久化兼容**：应用、租户运行态和界面设置三个 Store 的持久化白名单从已失效的 `paths` 迁移为 `pick`，继续只落盘语言、主题、登录租户与必要界面状态，避免升级 Pinia 后白名单失效导致临时壳层状态或其它运行态被意外持久化。
- **MCP 应用资产发布抗代理重置**：MCP 的 JSON 请求和 multipart 流式上传在 Node `fetch`／Undici 被反向代理重置时，会用相同序列化内容切换原生 `http(s)` 传输；应用文件仍以流式、分块方式发送，不在内存中 Base64 化。上传传输文件名改为由资产摘要生成的扩展名中立 `.bin`，原始与原生传输都失败后可自动切换 gzip；服务端仍从受校验的 `RelativePath` 推导真实文件名，减少普通 JS／CSS 编译资产在到达 ASP.NET Core 前被代理规则误拦截的概率。
- **稳定重试、节流与受限兼容回退**：每个应用资产最多执行 3 次上传，始终复用同一个稳定 RequestId，重试间隔为 500ms／1500ms，文件间增加 150ms 节流，降低连续上传触发瞬时网络故障或安全策略误判的概率。只有调用方显式允许、目标为小型既有 MicroService、使用 `stage-and-finalize` 且不属于 v3 发布时，连续流式失败才进入有界 C# 兼容发布；回退前必须再次核对 CurrentVersion／AppVersion 基线，Web 应用、版本漂移或超限资产继续失败关闭，不以兼容路径绕过并发控制。
- **服务端 gzip 安全边界**：应用资产流式接口只接受空编码或 `gzip`，压缩内容解压到带 `DeleteOnClose` 的异步临时文件，按解压后的真实长度执行既有单文件上限与 SHA-256 校验，并在成功、校验失败、取消或异常路径统一释放；未知编码和解压膨胀超限立即拒绝，避免压缩传输把内存占用、文件大小或资产完整性边界放宽。
- **定向回归与完整构建**：Classic 壳层 URL／Esc／Pinia 持久化 7 个用例、MCP 类型检查与完整测试 94 个、后端应用流式发布测试 74 个全部通过，合计 175 项定向检查成功。主发布完成现代前端、逐文件串行压缩、Chrome 49 legacy、后端 Release、19 个 NuGet 打包、Microi.net／Microi.AI 混淆和真实 API 启动探测，存活端点返回 HTTP 200；后端为 0 个编译错误，仅保留 5 个 xUnit 分析器警告，官网六项升级资源也已通过 `microi_itdos` 实时同步与 SHA-256 一致性检查。
- **v7.1.1 公开发布回读**：一键发布以 `__MICROI_RELEASE_EXIT__=0` 完成，NuGet.org 已独立回读 19/19 个 v7.1.1；阿里云后端 `microi-api:latest`、`microi-api:v7.1.1`、`microi-api-dev:latest` 收敛至 `sha256:320f78de...a9c01840`，前端 `microi-web-dev`／`microi-client-dev` 的 `latest`、`v7.1.1` 四个标签收敛至 `sha256:84eea02d...0b80cbc6`。公共包与镜像已发布不等于客户或生产容器已经拉取重建，也不把尚未执行的真实客户网络、浏览器或业务页面验收描述为完成。

## v7.1.0 - (2026-08-06 20:19)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、OCR、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v7.1.0；Microi VS Code 插件与独立 CLI 升级至 v4.7.2。写入本日志前的非生成文件待提交基线为：根仓库 88 个已跟踪文件和 8 个未跟踪文件，Microi.net 1 个已跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 3 个已跟踪文件；四仓均无暂存内容，`dist`、`bin`、`obj` 等编译产物不纳入功能分析。Microi.net 与 Microi.AI 子仓库本轮除程序集、文件和 NuGet 版本升级至 v7.1.0 外没有其它源码差异。
- **上一版后的提交补记与自动合并去重**：从 v7.0.9 发布提交 `f8b0d6ac` 到发布前 `593c2f05` 的最终树净差异纳入本版。`37bec399`、`ad9f8b99` 和 `593c2f05` 均是其它用户分支进入 master 的合并包装，不重复累计；实际新增来源归并为微信小程序内容安全与 `df718a08` 自定义 TabBar 两条功能线，并以当前工作区继续修订后的最终实现为准，已经被后续删除的 Upgrade32 和被替换的回调逻辑不作为独立功能重复记录。
- **真实客户端 IP 与误封治理**：容器运行时只信任路由表实际发现的 RFC1918／ULA 默认网关精确 IP，并继续支持 SaaS 配置的可信代理；若转发头无法把网关还原为真实客户端，当前请求仅审计而不进入 IP 自动封禁，避免 Docker 网桥把所有用户聚合成 `172.x.x.1` 后一人触发整站封锁。错误窗口改为只统计未命中端点的 404／405 路由扫描，业务校验、登录／权限拒绝、上传超限、压力保护、5xx 以及 Controller／动态 API 的应用级 404／405 均不再反向惩罚客户端；旧版宽泛 `HighError` 自动封禁会从共享 Redis 与本机缓存幂等退休，手动、高频和新版 RouteScan 封禁不受影响。
- **官网依赖故障与客户系统彻底隔离**：客户租户调用 `https://api.itdos.com/apiengine/get-microi-store-list` 等官方绝对地址时，不再携带客户登录 Token，也不会因官网超时、鉴权失败、安全拦截或服务不可用触发全局 API 故障页、清理客户登录态或阻塞其它业务；失败只影响应用商城提醒。全局状态探测仅归属当前站点／当前租户 ApiBase，并保留连续健康探测门槛，确保吾码官网 API 挂掉时其它用户自己的系统仍可正常使用。
- **安全拦截页完整诊断与租户品牌**：安全页左侧优先显示当前租户 `SysLogo`、系统标题和 OsClient，右侧完整展示真实请求方法、客户站点、租户 ApiBase、脱敏后的绝对请求目标、拦截 IP、范围、原因标识、开始／解除时间、剩余等待和共享状态；地址与长文本自动换行，不再截断“请求位置”。复制诊断同样保留完整上下文，同时自动遮蔽 Token、密码、密钥、签名和授权码等敏感 Query 值，并适配桌面与窄屏滚动。
- **表单引擎性能、异步按钮与标签兼容**：字段 V8 上下文按表单生命周期缓存并在清理时释放，编辑表单不再预取未打开的日志／版本面板；重型模块 Tab 分批挂载、JSON 表避免重复解析和无效 Sortable，列表在空闲期预热但不提前挂载表单弹窗。表单顶部、更多按钮及嵌套详情统一等待异步 `V8CodeShow`，含 `await` 的显隐脚本不再只在列表可用；顶部 Label 布局中的 Button 保留对齐占位，有标题的 DevComponent 继续显示业务 Label。
- **模块呈现与工作流视觉优化**：模块 Hero 指标新增 `Icon` 配置，设计器和旧配置按序提供不同语义色与图标兜底；指标区改为轻量语义色块、扩大图标识别度并去除多层边框，在低分辨率下仍保留标题和指标的弹性空间。工作台主 Tab 改为紧凑分段式选中态，通知徽标与导航容器允许溢出显示，移动端同步收紧尺寸，避免粗重活动条和角标裁切。
- **应用商城接口引擎所有权与三方基线**：官方发布器升级至 v1.6.0，导入器升级至 v1.9.1，应用商城包升级至 v7.0.13；应用包可声明 `ResourcePolicies.ApiEngines`，官方核心使用 `Managed` 并以安装记录中的上一版 SHA-256 作为 Base，仅在 `Local == Base` 时更新，租户已修改则整包冲突回滚。租户 Hook 使用 `CreateIfMissing`，首次安装后永不覆盖且同一 Key 禁止改回受管模式；稳定 Id／Key 双命中冲突失败关闭，成功安装会回写资源基线和跳过统计。官方六项资源继续通过 `microi_itdos` 三方合并、乐观发布与远端摘要回读，本次发布同步已全部匹配。
- **微信小程序内容安全端到端交付**：UniApp 图片上传自动取得微信一次性 code、强制进入私有存储并提交异步检测，只有审核通过才向业务组件返回文件；用户资料保存同步复核头像与文本，拒绝、处理中和上游不可用均失败关闭且提示明确。服务端只信任 ASP.NET 身份或当前租户共享 Redis 中仍有效的登录记录，不再解码未验证 JWT 判断终端；微信回调支持推荐的 `--OsClient--{租户}--` 路径和 `?OsClient=`，路径与 Query 不一致时拒绝，禁止旧 `?o=`，Token、AppSecret、AESKey、登录 code 在 SaaS、V8、审计和日志边界均保持隔离。
- **微信回调协议网关与低代码扩展**：删除每次启动逐租户执行的 Upgrade32，新增可审计的“微信小程序内容安全”v1.0.0 应用商城包。C# 仅承担签名、AES 解密、AppId／租户校验和脱敏事件归一化；受管核心接口 `mci-wechat-content-callback-core` 负责共享 Redis 状态、稳定 EventId 幂等和基础日志，租户接口 `mci-wechat-content-callback-extension` 首次创建后归客户维护，可在线扩展写表、outbox 和通知而不会被后续应用更新覆盖。HDFS 对待审图片强制私有范围，SaaS 同时兼容历史 EncodingAESKey 字段并统一使用 `WeChatMiniProgramAESKey`，运行升级器只保留应用流式发布所需的物理结构不变量。
- **UniApp 自定义 TabBar 状态修复**：标准与项目 Profile 恢复微信原生自定义 TabBar 胶囊外观，当前选中项始终从真实可见路由推导，页面显示、异步配置到达和切换完成后分阶段同步；点击不再乐观修改选中态，切换失败保留原页面并释放防重入锁。底栏消费运行时安全区，所有 Tab 页统一预留内容尾部空间，H5 底栏与 AI 助手也不再覆盖路由选中状态。
- **开发规范、文档与 VS Code 同步**：官方文档补充安全误封边界、微信内容安全、SaaS 配置、应用商城资源所有权和接口引擎优先架构；Skills 与四类 AI 规则文件统一要求“低代码 CRUD／事件 → 接口引擎 → V8 原子能力 → 必要 C# 协议边界”的实现顺序，以及 Managed 核心／CreateIfMissing Hook、固定 OsClient 参数和应用商城优先于定制迁移。VS Code 类型知识库与初始化规则生成器同步注入这些约束，插件和 CLI 版本升至 v4.7.2。
- **定向回归与完整构建**：官网依赖隔离、安全页、表单性能、异步按钮、模块呈现和工作流视觉共 30 个前端用例通过；应用商城资源策略 53 个、微信内容安全应用包 3 个、UniApp TabBar／内容安全／MCI 合规 3 个契约通过；后端安全防护、微信内容安全和 SaaS 配置 58 个测试通过，合计 147 个定向检查全部成功。主发布同时完成现代前端、串行压缩、Chrome 49 legacy、后端 Release、19 个 NuGet 打包、Microi.net／Microi.AI 混淆与真实 API 存活探测，存活端点返回 HTTP 200；后端 0 个编译错误，仅保留 5 个 xUnit 分析器警告。
- **v7.1.0 公开发布回读**：一键发布以 `__MICROI_RELEASE_EXIT__=0` 完成 19 个 NuGet 包和前后端正式／版本／测试标签推送，NuGet.org 已独立回读 19/19 个 v7.1.0；阿里云后端 3 个标签收敛至 `sha256:71ad7775...947a7f`，前端 4 个标签收敛至 `sha256:53800be7...40c64b`。镜像和包回读证明公共制品已发布，不等于客户／生产容器已经拉取重建，也不把微信实体小程序真机审核回调描述为已验收。

## v7.0.9 - (2026-08-06 08:57)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、OCR、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v7.0.9；Microi VS Code 插件、独立 CLI 及内置 Skills 升级至 v4.7.0，UniApp Manifest 同步其独立 v7.0.8 应用版本。写入本日志前的非生成文件待提交基线为：根仓库 37 个已跟踪文件和 10 个未跟踪文件，Microi.net 2 个已跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 2 个已跟踪文件；四仓均无暂存内容，`dist`、`bin`、`obj` 等编译产物不纳入功能分析。
- **表单与表格异步数据源初始化**：字段元数据先进入 Vue 响应式列表，再从同一批代理字段启动数据源加载，修复表单复用或列表首屏时选择、部门等字段暂时显示原始 Id、必须拖动列宽或重新打开后才出现文字的问题。批量与单字段请求统一记录加载起点，并在成功、失败后清理状态；Select／Cascader 对空数据、超过 2 秒的陈旧加载标记提供 800ms 有界兜底，同时避免近期请求和已有数据被重复加载。
- **级联选择延迟回填与部门列筛选**：Cascader 在表单数据晚于组件挂载时仍会按单选／多选及 `EmitPath` 配置规范化持久化 JSON 路径，标量存储和空值形态保持兼容。部门字段以叶子 Id 存储时，列头筛选会递归展开部门树并展示名称、提交原始 Id；当页筛选复用列表已解析的可读文本，不再把部门 Id 直接显示给用户，路径型部门存储不被误改。
- **表单只读态与界面细节**：运行态表单项增加独立只读标记，输入框、选择器、文本域、日期、级联和数字控件恢复禁用背景、边框、标签色与不可编辑光标，在浅色／深色主题下继续保持文字清晰且能与可编辑字段区分；导航品牌图片增加最大宽度与等比缩放约束，避免超宽 Logo 挤压布局。
- **文件同步记录归属与状态语义**：跨平台同步的文件仍从源平台读取，但任务创建、进度和结果统一写入发起操作且展示同步日志的当前租户，删除失败后悄悄跨租户回退的路径；只有业务返回成功才推进已记录结果数，写入失败明确中止。待处理明细单独显示“待同步”及警告色，不再被误标为失败。
- **`$CurrentUser` SQL 占位符安全收口（Microi.net）**：`IN/NOT IN` 支持 JArray、JSON 数组、历史逗号字符串及带／不带外层括号的用户扩展值，列表元素逐项转义并重建为合法 SQL；缺失、`null`、`undefined` 或空列表统一替换为 `(NULL)` 失败关闭，普通标量继续转义单引号，避免残留可执行占位符、`IN null` 和双层括号。Microi.net 同步升级至 v7.0.9；Microi.AI 本轮除程序集、文件和 NuGet 版本升级至 v7.0.9 外无其它源码差异。
- **反向代理前缀下的微应用稳定入口**：稳定入口重写相对 JS／CSS 时改为相对当前 `index.html` 的 `./{Version}/...` 地址，既保留不可变版本与缓存参数，又不会在 `/v2` 等反向代理 PathBase 部署中被根相对 `/micro-app/...` 丢掉前缀；外部地址和原有根相对资源继续保持不变。
- **一键发布孤儿 Vite 归属修复**：Windows 进程管理器新增只读进程工作目录回读；当 npm／终端父进程已退出、Vite 命令只剩相对 `node_modules/vite/bin/vite.js` 时，仅在进程 CWD 精确等于当前 `Microi.Client` 才允许结束，读取失败或外部工作区继续拒停，“父进程不存在”不再被当作归属证据。当前工作区相对入口可安全收尾、外部临时工作区同形命令必须保留的双向回归均通过，并把该规则写回工作区与部署 Skills，防止后续发布再次因同类残留进程中断或误杀其它应用。
- **定向回归与完整构建**：异步字段数据、级联延迟值、部门筛选、文件同步记录、只读外观及发布进程生命周期共 23 个前端用例通过；当前用户 SQL 占位符和微应用稳定入口共 19 个后端用例通过。现代前端、逐文件串行压缩、Chrome 49 legacy、后端 Release、NuGet 打包、Microi.net／Microi.AI 混淆和真实 API 启动均成功，存活端点返回 HTTP 200；后端仅保留 5 个既有 xUnit 分析器警告，无编译错误。
- **v7.0.9 公开发布回读**：一键发布完成 19 个 NuGet 包以及后端正式／版本／测试三标签、前端正式／版本／兼容四标签推送；NuGet.org 已回读 19/19 个 v7.0.9，阿里云后端三标签收敛至 `sha256:a5d1233e...a0f65`，前端四标签收敛至 `sha256:4ef0b6a9...d6285`。镜像推送只证明公共制品已发布，不等于生产容器已经拉取、重建或完成真实业务页面验收。

## v7.0.8 - (2026-08-06 02:45)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、OCR、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v7.0.8；Microi VS Code 插件、独立 CLI 及内置 Skills 升级至 v4.6.9。写入本日志前的非生成文件待提交基线为：根仓库 62 个已跟踪文件和 8 个未跟踪文件，Microi.net 2 个已跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 12 个已跟踪文件和 1 个未跟踪文件；四仓均无暂存内容，`microi.mcp/dist` 等编译产物不纳入功能分析。
- **指定历史范围与自动合并去重**：从指定提交 `366f3d7fdafc577bcfa21f8b898d8056769235f2` 到发布前 `d40a6106` 共覆盖 12 个可达提交。`366f3d7f` 的英文标题按“合并远端 master 分支”归类，其合入的 v7.0.7 发布能力已在上一版日志完整记录；`d40a6106` 是合并请求 !110 的包装提交，最终树与功能分支 `9ff43ac4` 相同。两次合并均不作为新增功能重复累计，本版只总结中间 10 个源提交和当前工作区净差异。
- **平台表三级权限与真实管理员复核**：后端以 `PlatformResourceSecurity` 作为唯一事实源，将平台表分为管理员专用、只读委托和按角色管理三类：SaaS、接口、表字段、账号角色、任务、数据源、密钥等管理员专用表对普通帐号硬拒绝；工作流、微服务／商城、蓝图等运行元数据仅允许有真实 `Read` 授权的查询；`mic_page/mic_print` 按角色 CRUD 权限运行，三类全部拒绝匿名。角色页改为读取服务端授权策略，角色增删改、管理员控制面和通用 FormEngine 都从租户主库复核活动用户与有效角色等级，不能通过请求体、旧 Token 或缓存中的 `_IsAdmin/Level/RoleIds/OsClient` 伪造；角色降级先同步用户等级再提升共享授权 epoch，Upgrade15 只清理管理员专用表的历史普通角色直连权限。
- **登录主题、随机壁纸与可读性**：PC 登录页接入运行时主题色选择和“换壁纸”，新增只公开启用壁纸展示字段的匿名专用接口，支持 `LoginBgImgRandom`、Microi 文件对象／JSON／绝对地址归一化、图片预加载、失败剔除和默认背景回退；不为此开放通用匿名 FormEngine 查询。登录卡片、按钮、输入框、头像和焦点状态统一消费主题令牌，修复浅色输入文字、占位符和浏览器自动填充对比度，同时保留历史账号、密码显隐和响应式交互。
- **菜单型微服务宿主桥接**：主框架新增版本化 `microi.host.v1` 能力协议，菜单型微服务可通过统一 dispatch 请求关闭当前 Tab、站内跳转／替换、前进后退、刷新、修改页签标题和显示纯文本提示，并接收尽力返回的结果事件。宿主复用真实 TagsView 与 Vue Router，固定页签、最后一个页签、外部 URL、登录／访问密钥／内部重定向及未注册或无权动态路由均失败关闭；顶部页签刷新也会重新挂载子应用，弹窗型微服务继续使用原有成功／取消／失败协议。
- **表格关联字段数据源隔离与分页默认值**：列表加载主表及 JoinTable 字段元数据时，主表字段继续完整初始化，跨表字段只初始化菜单的显示、搜索、排序、统计、固定、移动卡片及表内编辑等配置真实引用项，避免无关历史 SQL 数据源或已缺失关联表拖垮整批字段请求；同时统一兼容对象数组、Id 数组、JSON 字符串和逗号字符串的字段引用格式。PC 表格、左树右表默认分页补齐 15 条档位，并保留 20／30／50／100 条选择。
- **AI 应用源码与公开构建存储边界**：MCP 读取 AI 应用文件时规范化 HDFS 与发布路径，路径一致的公开编译文件按公开存储读取，源码路径与发布路径不同或任一缺失时继续使用私有范围；VS Code 拉取微应用源码同步过滤 `HdfsPath=PublishHdfsPath` 的公开构建文件，避免把 `dist` 产物混入本地私有源码工程。
- **现代前端产物兼容修复**：现代产物压缩流程显式区分 ESM 入口与 `public/static/js` 复制来的经典脚本；经典脚本关闭 ESM 格式输出和 tree shaking，并用普通 `Function` 语法检查验证，防止 `microi.loading.js` 被改写成包含 `export` 的模块后丢失全局 `LoadRate`。构建流水线协议升级并补齐经典脚本真实执行与全局变量回归。
- **Android 平板状态栏安全区**：APK 启动器和远程客户端在 Android 平板 PC 布局下综合 5+ 状态栏、安全区、原生 WindowInsets／资源高度与设备缩放比例，ROM 错报“未沉浸”或高度为 0 时使用 32px 有界兜底；手机和 768px 边界继续保持沉浸，旋转后重新计算，避免平板顶部按钮被系统状态栏遮挡。Manifest 补充受控原生探测权限，README 与 7 个边界用例同步。
- **历史 UniApp AI 与表单提交修复**：AI 入口补齐图标加载和合规检查，按 SaaS `IsShowAiModel` 控制运行模型及模型通道板块显隐；客户端表单更新会先按 Id 读取最新完整记录，再与本次编辑字段合并后触发表单提交事件，修复订单事件只收到局部字段的问题，并同步 V8 facade、版本和写入契约测试。
- **历史 UniApp 导航与业务组件增强**：小程序切换为原生 tabBar，按真实业务入口解析 `SysMenuId`，修复“我的订单”修改权限和打卡列表卡片字段／图片菜单 Id 冲突；合同状态附件、续签开关及续签订单关联按审批后修改权限联动。客户选择器和原生字段支持手机号／座机拨号，拜访打卡及记录补齐拜访对象、地图加载、定位与图片展示，并收口业务详情中的冗余备注。
- **Microi.net 与 Microi.AI 子仓库**：Microi.net 升级至 v7.0.8，并把通用 FormEngine 的管理员硬边界改为按操作判定，平台只读／角色管理表在真实授权下可用、匿名仍拒绝；授权快照以数据库有效角色 Level 为准，避免用户冗余 Level 在角色降级后继续提供管理员绕过。Microi.AI 本轮仅同步程序集、文件和 NuGet 版本至 v7.0.8，没有其它源码差异。
- **Microi VS Code 发布与连接恢复**：插件及 CLI 升级至 v4.6.9；新连接首次登录尚未取得 `Type/Network` 时保存的 Token，只在同 API + OsClient 唯一 profile 下回退复用，设置页按规范化身份继承既有 profile，避免身份补齐后丢失会话或多环境串 Token。默认三端发布在 Visual Studio Marketplace 与 Open VSX 完成后，如仅缺 npm 登录会启动交互式 `npm login` 并自动续发 CLI；严格模式仍在版本递增前要求全部权限，用户取消或上传失败会保留同版 tarball 且不撤销已完成的扩展市场发布。
- **文档、Skills 与回归覆盖**：官方中文文档原位补充平台表分级、匿名与角色授权、微服务宿主桥接、VS Code npm 授权和 SaaS 安全边界；Skills 同步前端、微服务、系统交付、页面、打印、报表及 V8 安全规范。PC 登录／微服务／数据源／现代构建共 16 个用例、Android 平板安全区 7 个用例、VS Code 5 组定向脚本，以及服务器平台角色、FormEngine 租户权限、AI 应用存储范围 136 个用例均通过。
- **首轮构建与发布边界**：v7.0.8 一键发布已完成现代前端、Chrome 49 legacy、后端 Release、混淆产物、HTTP 200 存活检查、19 个 NuGet 包和前后端正式／测试 Docker 镜像推送；公共 NuGet 19/19 已回读到 v7.0.8，后端三标签与前端四标签分别收敛到一致远端摘要。Docker 镜像推送不等于生产容器已经拉取重建；本轮也未把实体 APK 安装、旋转与真机状态栏点击描述为已验收。

## v7.0.7 - (2026-08-04 21:30)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade、新增的 Microi.OCR 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v7.0.7；Microi VS Code 插件、独立 CLI 及内置 Skills 统一升级至 v4.6.6。写入本日志前的非生成文件待提交基线为：根仓库 121 个已跟踪文件和 38 个未跟踪文件，Microi.net 13 个已跟踪文件和 4 个未跟踪文件，Microi.AI 5 个已跟踪文件和 2 个未跟踪文件，Microi.VSCode 3 个已跟踪文件；四仓均无暂存内容，也没有 `dist`、`bin`、`obj` 待提交差异。
- **蓝牙打印机全局连接中心**：PC／平板右上角在桌面 AI 助手后新增蓝牙打印机入口，未连接、连接中、已连接、重连中和异常状态使用不同图标、颜色、提示与设备名称；移动端“我的”新增“蓝牙连接”菜单，同步显示当前状态和打印机名称。两端点击后复用统一连接面板，可选择设备、查看连接、主动断开、重新连接并显示明确错误，不必再进入每个业务模块后才连接。
- **蓝牙会话保持、恢复与 V8 兼容**：`V8.Print` 改为共享单例连接与串行打印队列，Plus Bluetooth 和 Web Bluetooth 都持久化最近设备线索并在应用激活、页面恢复、GATT／BLE 意外断开后按 0、1、2.5、5、10、30 秒有界退避自动恢复；用户主动断开会清除记忆并停止重连，避免“断开后又连上”。新增只读快照、订阅／退订和连接管理 API，设备名称统一转义，弹窗关闭时释放监听；旧业务 V8 打印调用保持兼容，不需要逐模块改造。
- **租户级 `V8.AI` 与统一授权门禁**：前端新增 `Chat/ChatGet/ChatStream/RecognizeIntent/NL2SQL/NL2V8/NL2V8Stream`，统一过滤客户端伪造的租户、用户、Endpoint、API Key 和 Authorization，并支持 Token 轮换及 SSE 增量输出；后端把租户、登录用户、模型端点和密钥绑定在服务端，匿名调用失败关闭，NL2V8 仅平台管理员可用。所有 AI 代理、模型和 V8 入口都在模型查询或上游调用前校验官方本地 License，不能通过替换依赖注入实现绕过；MCP `microi_chat` 同步返回最终结构化结果。
- **OCR 引擎端到端交付**：新增 Microi.OCR 项目、PaddleX／PaddleOCR 基础协议与高稳定性协议网关、受认证 `/api/Ocr/Recognize`、`V8.OCR.Recognize` 和 MCP `microi_ocr_recognize`；Upgrade29 在 SaaS 引擎幂等创建“OCR识别”Tab，按租户维护启用状态、服务地址、密钥、自定义 Header、超时、文件／页数及置信度上限。上传只接受受控图片／PDF 类型与魔数，限制大小、页数、重定向、响应体和超时，统一返回全文、页、区域、多边形与置信度且不泄露上游响应；MCP 本地文件要求绝对非符号链接路径或 Base64，并以 `confirmExecution="OCR"` 明确授权，审计只保留文件名、大小、哈希和安全选项。
- **LibreTranslate 完整翻译能力**：翻译引擎扩展单条／批量、自动语言检测、HTML、候选译文、语言列表、文件翻译、改进建议和健康摘要，覆盖 API、后端 V8、MCP、VS Code 类型和官方文档；文件入口支持 TXT、HTML、ODT、ODP、DOCX、PPTX、XLSX、EPUB、PDF，执行扩展名、魔数、20／25MB 预算、同源下载与 Endpoint／Key 不可覆盖门禁。Upgrade31 幂等维护“翻译引擎”Tab，并兼容既有阿里云字段；一键安装提供独立 LibreTranslate 容器、持久化 API Key 数据库和后台模型初始化，不阻塞吾码其它服务。
- **后端配置单一事实源与认证收口**：生产 API 的 `AppSettings`／同名环境变量严格只保留 OsClient、产品／网络／数据库类型、数据库连接、Redis 五项和 MongoDB 连接共十个启动参数；自动升级开关、JWT 轮换请求、FreeCAD 路径、可信反向代理、OCR、翻译及其它业务运行参数统一迁入 `sys_osclients`。Upgrade30 幂等创建“后端运行配置”Tab并清理旧 License 路径／重试字段；AuthSecret 只以租户数据库为事实源，缺失、弱值或不稳定时失败关闭。登录控制器删除环境变量、Header 和 Development 本地密码／短信旁路，自动化仅允许当前租户 `sys_config` 显式授权跳过图形验证码且密码仍真实校验。
- **官方许可证信任链加固**：验证端固定使用程序集内嵌官方公钥，签发端固定使用 `/app/microi_private.pem`（本地源码兼容路径只用于开发），不再接受环境变量或应用配置替换密钥；签发前回读并核对公私钥身份，在线 License 服务固定官方 HTTPS 地址。硬件指纹删除可伪造的机器 Id 环境变量回退，改用挂载的 machine-id、DMI 与持久化标识；License 恢复采用固定有界次数和间隔，敏感策略不再成为宿主可注入业务配置。
- **应用商城批量安装、版本事实与资源同步修复**：商城“全部安装／更新”只盘点 `ApplicationType=Platform` 且未安装或有新版本的官方平台应用，旧版错误计划会重新发现；小型可信官方包按“一应用一事务”快速执行，外层仍在每个应用后持久化 checkpoint，大型 Schema／ZIP／资产继续安全分片。导入器升级至 v1.8.10、批量接口至 v1.1.3、应用商城包至 v7.0.11，补齐 MySQL 宽表行外文本类型跨节点检查点、字段级失败详情、无 StoreId/AppId 的内置包跳过安装计数等恢复逻辑。仅在 `OsClient=iTdos` 且官方签名身份成立时，幂等对齐已成功安装的平台应用版本；不创建安装事实、不改失败记录、不猜测冲突键。官方六项资源继续三方合并、乐观锁发布并做远端 SHA-256 回读。
- **一键安装、运行恢复与资源安全**：在线／离线安装器默认编排 OCR 与 LibreTranslate，使用内部网络和宿主回环端口；主租户三元身份、持久化 AuthSecret、MinIO 配置、数据库任务、升级字段和完整 `ServerVersion` 都执行创建后回读，失败时输出可直接重跑的一键恢复摘要并保留非零退出码。MySQL 密码不进入命令行，跨 MySQL／SQL Server／PostgreSQL／Oracle／达梦等数据库的 SQL 和配置升级保持兼容；发布脚本按端口、进程类型、命令行和工作区精确管理共享服务，保留用户浏览器、VS Code 与其它任务进程。
- **前端稳定性、登录视觉与受控构建**：Android APK／平板按真实状态栏高度区分移动沉浸与大屏 WebView 安全区，并在旋转后恢复；登录页统一解析不同缓存结构的系统 Logo，升级响应式品牌区、玻璃质感表单、加载态、减少动态效果与无障碍交互。PageTabs 初始化只选择当前权限可见页签，隐藏 URL 页签和空可见集合安全回退，不再读取空数组首项导致普通账号崩溃。现代产物压缩与 Chrome 49 legacy 构建改为串行阶段，按实测进程树预算加 `max(1.5GB, 物理内存 5%)` 余量启动，95% 全机占用暂停／终止，避免并发全量构建触发 OOM。
- **Microi.net 子仓库待提交内容**：程序集升级至 v7.0.7；新增租户绑定的 `V8TenantAI`、`V8TenantOcr`、LibreTranslate 实现及自托管部署文件，扩展翻译、OCR 和 MCP 调试接口。License 公钥、签发私钥、官方服务地址和硬件指纹按固定信任链收口，`OsClient` 运行配置、V8 API 文档与 XML 声明同步，既有翻译入口继续兼容。
- **Microi.AI 子仓库待提交内容**：程序集升级至 v7.0.7；AI 代理和模型入口统一前置官方 License 门禁，阻止宿主替换授权实现、匿名租户身份、客户端 Endpoint／密钥／Authorization 覆盖及未授权 NL2V8。新增 License 门禁和 V8 AI 安全回归，内嵌 AI／HTTP Skills 同步租户绑定、流式调用及配置白名单边界。
- **Microi.VSCode、MCP、Skills 与官网同步**：VS Code 插件及 CLI 升级至 v4.6.6，类型管理器补齐 `V8.AI`、`V8.OCR` 和翻译检测／语言／文件／建议／健康 API，并把后端十项配置白名单、OOM 阶段预算和发布安全规则写入生成知识库。MCP 增加 AI 对话、OCR、完整翻译工具及本地文件授权测试；官方中文文档原位更新 AI、OCR、翻译、应用商城、Docker、安全和 V8 API，Skills 同步部署、系统交付、性能、Playwright、文件、HTTP、SaaS、安全及蓝牙打印指南，文档覆盖审计也修复了蓝牙 API 识别。
- **构建、页面与发布验收边界**：蓝牙运行态 6 个定向用例、相关前端回归、完整现代产物压缩和 757 个 Chrome 49 legacy 分块构建均通过；在共享 61500／61501 服务上以真实管理员登录完成 PC 顶栏和 390×844 移动“我的”页面点击验收，两个入口均能打开统一连接面板。v7.0.7 一键发布已完成前端、后端 Release、加密 DLL、HTTP 200 烟测、19 个 NuGet 包及前后端正式／测试 Docker 镜像发布，官方商城资源已通过 `microi_itdos` 写后远端回读。由于当前环境没有可配对的实体蓝牙打印机，本日志不把操作系统设备选择、真实 GATT／BLE 长时保持、断电重连和纸张输出描述为已通过；双节点故障注入及完整翻译文档覆盖审计中的既有缺口也仍是独立验收项。

## v7.0.4 - (2026-08-04 04:58)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v7.0.4；Microi VS Code 插件、独立 CLI 及内置 Skills 统一升级至 v4.6.4。写入本日志前的非 `dist` 待提交基线为：根仓库 75 个已跟踪文件和 8 个未跟踪文件，Microi.net 6 个已跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 7 个已跟踪文件；四仓均无暂存内容和 `dist` 待提交差异。Microi.AI 除版本元数据外没有其它源码差异。
- **应用商城官方平台身份与双端禁用**：官方运行环境不再只凭租户名或域名判断，服务端要求 `OsClient=iTdos` 且当前节点持有能与内嵌官方公钥匹配的签发私钥，运行时只读投影 `IsOfficialPlatform` 供前端隐藏安装、更新、重新安装、离线包及“全部安装/更新”入口；接口引擎对单应用和批量导入继续独立执行同一官方身份兜底，绕过界面直接请求也会被拒绝。该判断同时适用于吾码本地官方发布节点和官网正式节点，不把普通同名租户误识别为官方平台。
- **批量安装、持久化进度与安装次数闭环**：商城新增“全部安装/更新”，只处理未安装及有新版本的应用，跳过已是最新版的应用；批量清单、检查点、成功／失败明细和进度复用 `mci_background_task` 持久化状态，稳定请求 Id 与任务租约支持跨节点重试、恢复和幂等。安装、更新、重新安装统一携带稳定 `OperationId`，官方统计接口以安装事件表和条件更新在同一事务内去重递增 `InstallCount`，批量执行的每个应用也分别计数，响应丢失或重复投递不会重复累计。
- **老租户商城资源自愈与受信 Worker 调用**：统一导入器升级至 v1.8.6，应用商城包升级至 v7.0.5，批量接口升级至 v1.1.1；老租户缺少 `bulk-import-microi-store-packages` 时由应用包／官方资源链补齐。批量接口在兼容旧节点 `StopHttp` 行为的同时，脚本内强制核对服务端注入的受信后台标记、任务 Id、执行信封与正数 fencing token，普通 HTTP／MCP 直调失败关闭；新旧后端滚动共存期间不会再因 Worker 保留 Client 语义而误报“此接口已禁止http调用”。资源同步器支持无旧基线的新内嵌副本首次建立共同基线，仍要求独立源码、商城内嵌源码和远端候选完全一致，并保留官网六项资源的乐观锁、发布后 SHA-256 回读和冲突阻断。
- **用户自定义登录默认首页**：`sys_user` 新增 `DefaultIndexUrl`，个人设置可选择登录后默认进入的有权内部路由；密码登录、直接 Token、访问密钥和 SSO 恢复统一执行相同跳转优先级。前后端会规范化 Hash／路径写法，拒绝外部地址、登录页和访问密钥登录页，保存及实际跳转都校验当前菜单权限；无配置、越权或菜单下线时安全回退平台默认首页。Upgrade28、官网个人中心、MCP 说明和 Skills 同步该能力。
- **六个固定审计字段元数据修复与高级搜索**：`Id/CreateTime/UpdateTime/UserId/UserName/IsDeleted` 只要物理列存在，就作为正常 `diy_field` 元数据幂等补齐或恢复，不再显示在表单设计器“异常字段修复”列表；字段默认仍受“显示默认字段”控制并保持隐藏、锁定和只读。修复过程按租户和表使用可过期分布式租约，写后清理字段缓存，并新增服务端修复接口与 MCP `microi_repair_audit_fields`，自然语言即可盘点和修复任意表；表格创建人、创建时间、修改时间等系统列同步接入与普通字段一致的表头高级搜索。
- **数据卡片与 Microi.UI 设计契约升级**：模块卡片重构为紧凑、可读的企业级信息层级，桌面默认四列并响应式收敛为三／二／一列；无图片数据使用小型身份占位，操作区收敛为一个主动作和“更多”，补齐键盘 Enter／Space、`focus-visible`、减少动态效果、骨架屏与真实卡片尺寸一致等状态。Microi.UI 文档、UI／前端 Skills、设计模式库及机器可读 `MCI-DESIGN.md` 契约同步语义令牌、响应式、状态覆盖和治理规则。
- **用户身份刷新、OnlyGet 白名单与表创建恢复**：登录用户刷新改为通过权威角色／角色权限逻辑重建身份，刷新失败时保留旧的有效缓存快照；`OnlyGet` 仅对精确安全 POST 控制面开放 `RefreshLoginUser`、`RelayTokenSummary` 和后台任务列表，接口引擎执行仍保留角色授权门禁。表单引擎创建物理表后若元数据事务未提交，重试会识别并接管可证明的半完成状态，幂等补齐表和固定字段元数据，避免重复 DDL 或把完整物理表误报为冲突。
- **VS Code／CLI 精确身份与无密恢复仲裁**：共享 Token 的规范键固定为 `ApiBase|OsClient|Type|Network` 四段，即使类型或网络为空也保留空段；先读取精确身份，只有同 API／租户配置无歧义时才回退旧版紧凑键，防止多产品或多网络连接串用。插件启动完成即激活 SecretStorage 恢复 broker，不再依赖首次自动登录成功；插件、CLI 与 MCP 并发刷新时按 JWT 签发时间仲裁新旧 Token，以文件锁和原子合并保留未知身份键，并避免共享文件采用后递归写回覆盖更新值。
- **MCP、官网、Skills 与回归同步**：MCP 补充审计字段修复工具、用户默认首页说明、商城后台任务的 `InstallAction/InstallOperationId` 和精确 Token 恢复测试；官网原位更新应用商城、表单引擎、模块引擎、Microi.UI 及个人中心说明，Skills 同步商城故障诊断、字段建模、前端跳转、系统交付和设计契约。新增或扩展官方平台身份、StopHttp 受信后台调用、商城安装统计／资源副本、默认首页、审计字段搜索、卡片展示、权限缓存及 Token 仲裁等定向回归；本日志不把 `dist` 生成目录、NuGet 公共索引尚在传播的包或未取得 lxwb 有效登录态后的新按钮点击描述为已完成验收。

## v7.0.1 - (2026-08-03 15:49)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v7.0.1；Microi VS Code 插件、独立 CLI 及内置 Skills 统一升级至 v4.6.2。写入本日志前的非 `dist` 待提交基线为：根仓库 90 个已跟踪文件和 24 个未跟踪文件，Microi.net 10 个已跟踪文件和 1 个未跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 16 个已跟踪文件和 19 个未跟踪文件；四仓均无暂存内容，本轮没有 `dist` 待提交差异。Microi.AI 除版本元数据外没有其它源码差异。
- **平台内部通知闭环**：后端 V8 新增 `V8.Notification.Send`，按当前租户校验接收人、稳定 `NotificationId/EventId`、标题、内容、Payload 与安全链接，在业务事务提交后才以 1.8 秒有界预算发送 SignalR 提示；通知事实、未读状态与重连补偿继续由持久化消息日志和 `msg_internal_list/msg_internal_mark_read` 接口负责，实时通道失败不会反写已提交业务。PC 通知中心新增平台消息列表、未读角标、单条／全部已读和安全跳转；平台 SignalR 不再因租户选择其它聊天实现而被关闭，并补齐简体、繁体和英文文案。
- **登录历史帐号与头像体验**：PC 登录页新增按 `OsClient` 隔离的历史帐号选择、最多 8 条记录、单条删除／全部清空、密码显隐和当前帐号头像；勾选“记住密码”后只在当前浏览器本地保存，密码采用租户隔离的可逆 AES 包装以避免在 `localStorage` 中直接出现明文或 Base64，并明确提示公共设备不要启用。登录成功后缓存 64×64 头像快照，切换或编辑帐号会清空上一个帐号回填的密码，损坏、跨租户或不可解密记录失败关闭。
- **TableChild 关系统一与导入兼容**：主子表字段映射统一为紧凑 `FieldRelations: [[主表字段, 子表字段, 是否参与导入匹配], ...]`；前后端在读取时合并旧版 `TableChildCallbackField`、`ImportRelations`、`ImportBackfillFields` 和单字段匹配配置，按字段对去重，新版设计器在后续正常保存时清理旧键。嵌入式 TableChild 新增默认值、左树右表新增子记录、固定父记录回填以及 Office 导入匹配复用同一关系事实源；服务端只为已经授权的菜单返回精确关系，避免多处配置漂移。
- **受控 V8 无单次运行限制**：接口引擎和表后端 V8 事件新增显式高风险开关 `V8Unlimited`，Upgrade27 幂等补齐 `sys_apiengine/diy_table` 物理列、字段元数据与显隐事件，MCP、Manifest、VS Code 创建界面、同步状态和写后回读统一支持。开启后只取消当前接口或当前表后端事件的 Jint 单次超时、最大语句数、函数递归、累计分配预算和 Promise 固定等待；进程／容器常驻内存保护、请求与后台任务取消、执行并发、接口嵌套深度、权限沙箱和数据库保护仍生效，且不会自动传给嵌套接口。该能力仅用于业务明确要求整条链路共享同一事务且无法安全分片的场景，不能因数据量大自动开启。
- **接口引擎授权、后台身份与返回值修复**：角色含 `OnlyGet` 时，只有接口引擎 `ApiRole` 明确包含该用户角色才允许作为受控例外；空角色配置继续拒绝写调用，畸形策略失败关闭，普通 HTTP 与持久化后台任务使用同一规则。后台任务提交时回源共享数据库读取权威接口模型，Worker 执行前再次校验，嵌套 `V8.ApiEngine.Run` 只继承服务端认证的用户快照，客户端不能伪造可信标记；同步 IIFE 仅设置 `V8.Result` 时不再被 Jint 的 `undefined` 完成值覆盖成空响应。
- **系统账号访问密钥与路由稳定性**：系统账号“访问密钥”入口从 `diy-table.vue` 的表名／菜单特判迁移到 `sys_menu.MoreBtns` 动态行按钮，Upgrade26 以稳定按钮 Id、`ShowRow:true`、权限显隐 V8 和通用 `V8.OpenDialog + UserAccessKeyPanel` 幂等安装并清理菜单缓存，租户可在模块配置中统一控制。表单设计器路由改为启动时注册的常量受保护路由，避免动态菜单重载窗口内首次跳转只出现空壳、必须 F5 才能恢复；本地进程状态统计也修复无浏览器进程时的空值计算。
- **独立 `@microi.net/cli` 与多入口并存**：Microi.VSCode 新增可独立安装的 `microi.net/cli`，在无 VS Code 场景提供服务器 Profile、登录／验证码、AI 与 MCP 初始化、V8 拉取、同步状态、显式推送和 Doctor 诊断；与插件共享工作区配置、Token、AI 规则、Skills、MCP 配置和同步基线。配置、Token 与同步元数据改为带超时／陈旧锁恢复的原子合并写入，保留未知字段；MCP 记录工具来源和三段版本，旧 CLI／插件不会覆盖较新提供者，Skills／AI 指令也记录逐文件版本，保护用户修改和较新生成内容。
- **VS Code／CLI 联合发布安全**：扩展发布脚本新增 npm CLI、Visual Studio Marketplace 与 Open VSX 三目标预检、同版本打包校验、公开版本回读、严格模式、单目标补发和 npm 传播等待；默认隔离可选 npm 目标，CLI scope 未就绪不阻断已通过权限检查的两个扩展市场，同一不可变版本已被接收后不会重复上传。历史被 Git 跟踪的 `publish-tokens.json` 已停止读取并删除，发布凭据只允许环境变量或已忽略的 `publish-tokens.local.json`；官方 AI 开发文档同步 CLI 安装、命令、并存边界和补发流程。
- **文档、Skills 与定向回归**：更新表单组件、数据库字典、AI 接口引擎、V8 客户端／服务端、VS Code 插件与平台消息通知文档，补齐 `V8.Notification`、`FieldRelations`、`V8Unlimited`、CLI 和单事务风险边界；新增登录历史帐号、平台消息、TableChild 兼容、动态访问密钥、接口角色授权、后台身份、V8.Result、V8Unlimited、MCP 写后回读、CLI 并发／打包与三端发布门禁等定向测试。本日志不把尚未执行的后端 Full、双节点故障验收、真实租户写入或官网线上 HTTP 回读描述为已通过。

## v7.0.0 - (2026-08-02 21:42)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v7.0.0；Microi VS Code 插件及内置 Skills 升级至 v4.5.9。写入本日志前的非 `dist` 待提交基线为：根仓库 43 个已跟踪文件和 3 个未跟踪文件，Microi.net 5 个已跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 1 个已跟踪文件；四仓均无暂存内容，本轮没有 `dist` 待提交差异。Microi.AI 和 Microi.VSCode 除版本元数据外没有其它源码差异。
- **表单引擎操作列精确布局**：PC 列表操作列改为按每一行真实可见的 V8 外部按钮、工作流处理、详情、回收站恢复、访问密钥和“更多”按钮分别计算内容宽度，再取最宽行作为统一列宽；文字、前后图标、按钮边框内边距和相邻按钮间隙采用同一估算链路，树形“加载更多”特殊行也参与统计。人工 `TableActionFixedWidth` 继续作为安全最小值，固定列统一右对齐并保留角标安全区，避免把不同记录才出现的按钮错误叠加后形成大块空白，也避免低分辨率下按钮或统计角标被裁切。
- **移动端 OpenTable 关闭语义**：移动端普通模块继续使用路由返回；嵌入 Dialog／Drawer 的 OpenTable 点击顶部返回时改为向拥有者发送关闭事件，由两种 OpenAnyTable 容器统一收起当前弹层，不再错误执行全局 `$router.back()`。底部关闭按钮复用同一关闭入口，并新增独立回归用例覆盖弹层和独立路由两种路径。
- **匿名 AI 应用最小持久化能力**：显式开启匿名访问的 `app_*` 接口引擎，现在只允许通过字面量 `app_*` 表名调用单表 `AddFormData/UptFormData/UptFormDataByWhere/DelFormData/DelFormDataByWhere`；FormEngine 以服务端生成的匿名设备作用域写入 `UserId`，并把同一归属条件注入查询和更新，匿名访问者不能读写其它访问者的数据。动态表名、批量 FormEngine、原生 SQL、MongoDB、上传和嵌套写接口继续要求登录并失败关闭。AI 应用认证桥改为先请求服务端、仅在权威认证响应后弹出登录，缓存 Token 会通过 `GetCurrentUser` 真实校验并接收续签 Token，避免把允许匿名保存的应用动作提前拦截或把失效本地登录态当作有效会话。
- **私有文件与数据库备份对象回读**：私有文件审计代理统一从服务端内网对象存储端点生成上游地址，浏览器仍只接收后端短期审计票据，避免内网上传成功后又绕公网 MinIO 回源产生 404。数据库备份等平台保留对象仅对精确 `/{OsClient}/database-backups/` 合成前缀做白名单规范化，普通租户文件隔离前缀保持不变；备份 ZIP 的 `PutObject` 返回成功后最多五次从同一私有桶执行 `ObjectExist` 回读，未确认对象存在时不提交成功记录。Skills 同步补充 `Range: bytes=0-0` 下载验收及重要大文件写后回读规则。
- **应用商城老租户 NOT NULL 升级修复**：商城导入器升级至 v1.8.4，内置应用商城包升级至 v6.9.12。物理列从可空收紧为 `NOT NULL` 前，先统计老租户历史 `NULL`，使用应用包明确声明的默认值参数化回填，再执行 `ALTER TABLE ... MODIFY COLUMN`；时间戳和 bit 字面量只在类型与安全格式匹配时原样使用。包未声明默认值时按影响行数失败关闭，不猜测业务值；零空值和重复安装保持幂等，独立源码、共同基线与应用包内嵌副本同步一致。
- **多 AI 工作区发布互斥与进程安全**：一键编译发布新增 `.tmp/microi-process-state/release.lock` 工作区互斥锁，异常退出只在能够证明原持有进程已结束时回收；Windows 发布前调用新的 `Microi.LocalProcessManager.ps1`，按端口、进程类型、命令行和工作区路径精确识别 `61501` 后端、`61500` Vite 及额外 Release 后端，身份不符即停止，不按进程名批量结束 `dotnet/node/chrome/msedge`。清理后以独占文件句柄复核 Release DLL，编译禁用共享编译服务但不再全机结束 VBCSCompiler；浏览器、VS Code、Playwright Test Server、数据库和 Redis 明确保留。
- **本地自动化生命周期与定向回归**：表单冻结追踪启动器在发布锁存在时拒绝抢占共享端口，长期后端固定使用 Debug `dotnet run`，退出时先温和再强制结束本次创建的完整进程树；本地端口规范统一为前端 `61500`、后端 `61501`。新增／扩展操作列、移动端 OpenTable、发布互斥、进程身份与 DLL 锁、匿名 AI 应用 owner scope、私有 HDFS 内网回源、数据库备份路径以及商城 NOT NULL 回填等定向测试；本日志不把尚未执行的后端 Full、真实业务生产发布或双节点故障验收描述为已通过。

## v6.9.8 - (2026-08-02 12:01)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.9.8；Microi VS Code 插件及内置 Skills 升级至 v4.5.7。写入本日志前的非 `dist` 待提交基线为：根仓库 78 个已跟踪文件和 20 个未跟踪文件，Microi.net 4 个已跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 3 个已跟踪文件；四仓均无暂存内容。根仓库另有 25 个 `dist` 生成文件只随最终提交交付，不纳入功能分析。
- **应用资产流式发布协议 v3**：Web、UniApp 与 MicroService 公有构建改为不可变 `tenant/kind/app/version/request-fingerprint` 发布目录，stage 逐文件流式上传并验签，finalize 以 `sys_microistore` 当前指针和 `mci_ai_app_version` 版本行为同一主库事务事实源；`GateEpoch/PublishFence/PublishRowVersion/VersionRowVersion`、应用 `CurrentVersion/AppVersion`、清单与路由快照共同参与 CAS，旧请求晚到、应用身份漂移、同版本内容冲突和已提交版本回滚均失败关闭。单文件收敛为 128MiB、整份运行清单 1GiB，读取使用节点级加权预算和最多 8 个存储 Worker，首个失败后停止领取新工作，避免大文件严格回读把 API 进程推入内存压力。
- **发布门禁、跨库升级与回滚边界**：新增按 `OsClient + OsClientType + OsClientNetwork` 隔离的 `LegacyOpen → Drain → V3Only` 单调门禁以及唯一安全回退 `Drain → LegacyOpen`；转换要求平台管理员、稳定 `TransitionId`、规范化 Drain 证明、MCP 与服务端一致的 SHA-256 二次确认，并将门禁行和审计台账在同一事务提交，V3Only 不允许自动降级。Upgrade25 为 MySQL、SQL Server（含历史 SqlServer9）和 Oracle 幂等补齐发布状态、指针、fence、路由快照、文件路径哈希、审计表及七项索引；空表、完整表和危险的半安装状态分别处理，空值、重复身份和异常路径只审计或要求人工处理，不通过删除数据强行建唯一索引。
- **稳定入口与崩溃恢复**：`/micro-app/{OsClient}/{AppKey}` 和 v3 资源解析只读取已提交数据库指针、完整清单及不可变对象键，不再从最新 staged 行或可变 HDFS 别名推断当前版本；新应用入口可使用非默认 `EntryPath`，旧 Web／UniApp 书签可安全跳转当前 `PreviewUrl`，MicroService 和不受信任外链继续失败关闭。新增后台恢复 Worker，以同应用发布租约和数据库 CAS 幂等推进 `PointerCommitted/ProjectionPending/RepairRequired`，并对 legacy `root/latest` 别名做至少三次校验收敛；只修复权威指针仍引用的精确版本，不删除对象，旧持有者晚到不能覆盖新版本。
- **接口引擎通用实时事件 v2**：新增 `/api-engine-realtime` SignalR Hub，接口引擎事务成功后可通过固定大小写的 `DataAppend.RealtimeEvent` 发布订单、协同、设备、审批或多人房间事件；宿主只投影 `EventId/ChannelKey/SubjectId/Version/EventType/Data/OccurredAt`，失败结果、额外字段和用户私有数据不会广播。订阅固定调用 `realtime_{channel_key}_authorize`，从普通登录 Token 恢复租户和用户，使用 30 秒时隙租约、共享 Redis 跨标签页／节点限流、EventId Claim／完成标记及按 Subject 单调 Version 去重；Redis、SignalR 或 1.8 秒提交后预算异常不会反写已提交业务，客户端按版本缺口回读 HTTP Snapshot。旧 `/game-realtime` 保持兼容，并通过独立 Hub transport 避免群组串线。
- **JWT 稳定密钥与节点接流量门禁**：JWT `AuthSecret` 默认以 `sys_osclients` 或显式宿主配置为稳定来源，不再为启动占位租户生成进程临时密钥；弱密钥先幂等补齐字段并原子持久化，写回失败时 SaaS 初始化、服务启动和 readiness 直接失败关闭，诊断接口返回不含明文的来源与指纹。普通版本发布不再自动轮换密钥，只有运维显式设置新的 `MICROI_AUTH_SECRET_ROTATE_VERSION` 才执行轮换；Redis 旧快照不能覆盖节点已挂载的稳定密钥，修复旧版本遗留的共享运行态强密钥时优先固化原值，尽量保持发布前 Token 有效。
- **可续租分布式锁与 fencing**：`IMicroiLock` 新增租约上下文、独立获取超时、取消信号、自动续租、最长持有时间和单调 fencing token；回调可在每个外部副作用前后主动 `EnsureHeldAsync`，租约丢失或超过上限即失败。获取后通过 Redis 生成 fence，续租使用持有者比较加 `PEXPIRE`，释放使用单条 Lua 比较删除，替代非原子的 `GET + DEL`；短任务旧签名继续兼容，长发布任务则同时依赖租约与数据库 CAS，避免把锁误当作业务幂等。
- **SaaS 数据库备份目录修复**：备份控制面和实际执行不再以仅按 `OsClient` 建键的进程 `ClientList` 作为权威租户目录，而是从主库 `sys_osclients` 按当前运行类型、网络、启用状态及 MySQL 类型精确读取对应行；同一 `OsClient` 存在多套运行环境时不会再被最后加载的其它环境连接覆盖。列表只返回租户标识和名称，执行端复用同一已验证连接快照并继续按真实数据库去重，非法、缺库名或不属于当前运行三元组的连接失败关闭。
- **AI 应用 Vue 工程基线**：新增 `microi-ai-application` Skill 与完整参考，Web、MicroService、H5 及新建／整体升级的 AI 应用默认采用 Vue 3.5.40、Vite 7.3.6、TypeScript 5.9.3、`<script setup lang="ts">` 和 `vue-tsc` 严格检查，按 pages/components、composables、domain、services、platform 分层；Router、Pinia 只在确有多路由或共享复杂状态时引入。MCP 与 VS Code 生成器同步输出 `vite.config.ts`、`tsconfig.json`、类型化宿主上下文、每路由一个 SFC、相对构建路径和可安装的 Microi SDK，并禁止原生 `alert/confirm/prompt`、生产 localhost、硬编码 Token／租户及仅用 Vue 外壳包裹旧命令式 DOM 的伪迁移。
- **MCP 与 VS Code 发布一致性**：MCP 新增 `microi_transition_application_stream_gate` 预演／确认工具，并为目录流式发布补齐 v3 的显式 stage/finalize、规范 Int64 字符串、null 基线、NFC 路径、跨 Node/.NET 一致的递归规范 JSON 与 SHA-256、不可变路径预检及严格服务端证据回显；stdio 和 SSE 上下文同时携带租户运行类型／网络。VS Code v4.5.7 在长时间上传前冻结远端 `CurrentVersion + AppVersion`，finalize 原样提交条件切换，文件清单改用 Ordinal 排序并执行 128MiB／1GiB／2 万文件上限；本地脚手架和回归测试同步到上述 Vue + Vite + TypeScript 基线。
- **应用商城精确菜单、版本证明与资源同步**：商城发布器升级至 v1.5.8，v3 只接受精确 `CommittedProof.VersionId` 对应的 Completed 行、已提交路由快照、运行清单哈希和行版本，MicroService 打包不能回退到更新的 staged 行或可变运行态；`ExactMenuIds + MenuContract` 要求导出菜单集合、包内菜单和选择值完全一致，普通导出仍保留递归子菜单，安装器兼容后台任务新旧等价索引名。六项官方升级资源的读取、发布和发布后回读默认统一走已绑定 `https://api.itdos.com + iTdos` 的 `microi_itdos` MCP；V8 文件头说明／版本与可执行正文分开合并，两端独立升版不再制造假冲突，正文安全合成后基于最高版本再升一版，只有多种 Git 锚点算法都无法合并的真实逻辑冲突才停止发布。
- **运行构建、文档与回归覆盖**：AI 应用构建器读取既有源码时校验 HDFS 字节、哈希和大小，保留私有源码路径并将公开构建写入版本目录；一键发布的 Docker 探针增加 5 秒硬超时，避免 Docker Desktop／WSL 半启动时无限挂住。官方微应用与 V8 服务端文档补齐目录规范、两阶段发布、通用实时协议和稳定清单回收口径，官网导航突出 AI 应用。新增 v3 状态机／路径／跨库 DDL／门禁确认／恢复 Worker、通用实时授权与降级、JWT 重启稳定性、分布式租约、SaaS 备份三元组、商城菜单证明、MCP 跨语言向量和 Vue 脚手架等定向回归；本日志不把未执行的后端 Full、真实生产发布或双节点故障验收描述为已通过。

## v6.9.5 - (2026-08-01 21:16)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.9.5；Microi VS Code 插件及内置 Skills 保持 v4.5.1。写入本日志前的非 `dist` 待提交基线为：根仓库 91 个已跟踪文件和 18 个未跟踪文件，Microi.net 4 个已跟踪文件和 1 个未跟踪文件，Microi.AI 1 个已跟踪文件，Microi.VSCode 工作区干净；四仓均无暂存内容，`microi.mcp/dist` 等编译产物不纳入功能分析。
- **应用商城大包安装与可恢复续跑**：商城安装／更新请求只持久化 `StoreId`、目标租户、父菜单等定位信息，不再把整行 `Form/Row/Btn` 或 `AppPakcet` Base64 包体在浏览器、HTTP、后台任务和 Jint 之间反复复制；导入器按稳定后台任务 Id、持久化 Checkpoint 和字段冲突映射分阶段处理 Schema、应用资源与收尾，构建／源码文件按文件数和 Base64 字符数切成有界批次，已上传的 `AppId + FilePath + Hash` 可跨节点、跨重启复用并清理陈旧资源。旧库安装前会回读物理列与索引并补齐后台任务引导结构，重复安装保留客户已有记录、菜单显隐和定时任务配置。
- **后台任务运行域隔离与滚动升级**：`mci_background_task` 新增 `RuntimeOsClientType/RuntimeOsClientNetwork`，领取、重试、取消、完成清理、并发租约、Redis 任务列表、SignalR 在线连接和通知均按 `OsClient + 运行类型 + 网络` 隔离；幂等与领取索引先创建并回读新的运行域版本，再移除旧窄索引，避免多节点迁移窗口丢失最终唯一边界。定时生产者在入队前检查同类存活任务，稳定的单次触发幂等键继续承担跨节点竞态兜底，历史无运行域记录在滚动升级期间可单向兼容接管。
- **SaaS 数据库备份控制面**：新增超级管理员可用的租户清单、手动备份、计划设置读取／保存及 MCP 工具，候选库由服务端按当前 `OsClientType + OsClientNetwork` 过滤且不返回连接串；定时任务使用计划触发时间生成稳定运行键，限制过密 Cron，并把数据库备份作为平台原生后台任务执行，不再依赖可能缺失或版本漂移的商城 V8 Worker。执行链使用可续租 Redis 租约、fencing token、数据库 CAS、稳定备份记录 Id 和按尝试隔离的私有 HDFS 路径，旧持有者不能覆盖新结果；失败尝试、强杀遗留对象和过期备份可幂等清理，ZIP、SHA-256、库级进度、成功／失败数及保留状态写回审计表。
- **跨节点安全防护与可信代理边界**：IP 请求窗口和封禁记录以租户隔离的共享 Redis 原子计数／Hash 为跨节点事实源，Redis 不可用时才降级为进程内保护；Redis 已恢复且无共享封禁时不会被旧本机状态“复活”。普通请求不能通过伪造 `OsClient` 切换限流域，客户端自报 `X-Forwarded-For` 不再直接采信，只有 `ForwardedHeaders.KnownProxies/KnownNetworks` 明确配置的直接代理可投影真实来源 IP。VS Code 高频只读访问仅在服务端验证 Token、设备标识、超级管理员与只读路径后进入独立阈值，手工／自动封禁、自动到期、解除和访问风险继续异步落审计表。
- **安全拦截页与运维诊断**：PC 前端可识别后端明确返回的 `DataAppend.SecurityBlocked`，展示被拦截 IP、原因、共享 Redis／本节点状态源、自动解除时间、请求位置和恢复说明，并在到期后自动探测；普通业务 `Code=0`、响应 Header 或单接口失败不会误触发全局拦截页。`health/liveness` 增加进程内稳定 `InstanceId`，便于双节点验收确认两个直连地址确实落在不同 API 进程；安全防护的 CORS 顺序也前移，独立部署前端能够读取标准 DosResult，而不是把封禁误报成网络中断。
- **用户资料与上传恢复提示**：系统用户稀疏更新改为把非空补丁合并到数据库完整实体，修复修改密码等自助入口把未提交的帐号、姓名、角色和状态字段覆盖为空的问题；平台管理员 JObject 判断及 MCP 表结构读取消除 dynamic 扩展绑定异常。租户显式关闭上传时，HDFS、控制器和安全层统一返回 `TenantFileUploadDisabled`、准确配置字段、默认兼容语义及文档地址，便于直接在 SaaS 引擎恢复，而不是只提示“已停用”。
- **多人游戏实时失效协议**：新增 `/game-realtime` SignalR Hub，以服务端网关接口校验订阅身份、应用和房间回显，组名按租户、`AppKey`、`RoomId` 隔离；接口引擎业务事务完成后只从成功结果的标准 `DataAppend` 提取六个公开失效字段，再以 `EventId` 指纹、版本和 Redis 最新快照状态幂等发布。相同事件重放可安全去重、同 Id 不同内容会拒绝，Redis／SignalR 超时或故障不会把已提交的出牌／结算伪装成失败，客户端按权威 Snapshot 轮询收敛。
- **HDFS、MinIO 与大文件可靠性**：MinIO Endpoint 统一解析 `host:port` 与 `http(s)://host:port`，严格拒绝凭据、路径和查询串，按公开／私有端点分别应用 SSL、端口和 Region，修复带 scheme 时被 SDK 当成主机名导致的解析失败。对象存储参数新增单次超时，普通上传保持原默认，数据库备份等受控长任务可在 5 秒至 2 小时内显式放宽；应用资产流式发布同时修复动态 `JObject.FromObject` 绑定问题并继续校验入口 HTML、版本、Manifest 哈希和目标存储类型。
- **V8 商城导入内存保护**：仅主租户、服务端可信超级管理员、持久化后台任务且接口 Key 精确为 `import-microi-store-package` 时，允许一个有界导入切片跳过 Jint“累计已分配字节”计数，改由容器感知的进程常驻内存保护承担硬边界；95% 时停止接收新请求、98% 时有界停机的节点保护仍生效。普通 V8、前台调用、子租户、嵌套调用和不可信身份继续使用原有单引擎／调用树内存上限，不能通过请求参数开启该模式。
- **MCP 备份、商城与发布恢复**：MCP 新增数据库备份租户盘点和确认执行工具，以及只允许官方 `https://api.itdos.com`／`iTdos` 商城源、要求稳定 RequestId 和 `confirmExecution=StoreId` 的应用安装／更新工具；请求仅携带资源标识并使用稳定幂等键。刷新得到的新 Token 若立即被拒绝，会在同一有界请求中依次升级到 VS Code broker Token 和凭据重登录，避免再次进入刷新死循环；新增可脱敏错误的 stdio 单工具调用助手。滚动升级期间仅对旧 API 精确的 `JValue.Val` 流式发布缺陷开放现有 MicroService 最多 256 文件／5MB 的 C# 兼容路径，Web、UniApp 和更大构建继续失败关闭并要求升级 API。
- **官网登录态与应用商城检索**：官网登录、详情、收藏和商城列表统一复用稳定 ASCII `did`、标准 Authorization／Token Header、响应 Token 轮换和精确失效判断，普通权限不足不再误清登录态；同一浏览器优先复用 Microi.Client 已建立的设备标识。应用分类、排序和关键词写入可分享、可前进后退恢复的 URL 查询参数，无精确结果时可展示相关／热门建议并把当前需求带入需求中心，桌面和移动空状态、搜索提示及收藏回读同步完善。
- **Microi.net 与 Microi.AI 子仓库**：Microi.net 由 v6.9.3 升级至 v6.9.5，并新增上述可信商城导入常驻内存策略、ApiEngine 注入与 V8 运行时执行口径，XML API 元数据同步；Microi.AI 仅将程序集、文件和 NuGet 版本由 v6.9.3 升级至 v6.9.5，没有其它源码差异。Microi.VSCode 本轮没有待提交代码，因此不虚构插件功能或版本变更。
- **文档、Skills 与回归覆盖**：安全防护、文件上传、数据库备份和 V8 服务端文档原位补充，应用商城、调试、文件与安全 Skills 同步可恢复任务、租户边界和内存口径；新增安全代理／共享封禁、用户稀疏更新、上传停用、MinIO Endpoint、数据库备份运行域与 fencing、游戏实时契约、商城分片 Checkpoint、应用流式发布、MCP Token 恢复、官网会话和查询状态等定向回归。发布日志只总结源码、协议、配置和测试覆盖，不把 `microi.mcp/dist` 等生成文件或尚未执行的真实生产／双节点故障验收表述为新增能力。

## v6.9.3 - (2026-07-31 21:38)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.9.3；Microi VS Code 插件及内置 Skills 升级至 v4.5.1。写入本日志前的非 `dist` 待提交基线为：根仓库 51 个已跟踪文件和 4 个未跟踪测试文件，Microi.net 1 个文件，Microi.AI 1 个文件，Microi.VSCode 3 个文件；四仓均无暂存内容，`microi.mcp/dist` 等编译产物不纳入功能分析。
- **指定历史范围与自动合并去重**：根仓库从 `7788a3e794e142a2ecdd6ebb83d2392b6543faa8` 的父提交到最新远端 `b3710265` 共覆盖 7 个可达提交、114 个非 `dist` 文件、8944 行新增和 628 行删除的最终净差异。实际功能源提交为 `7788a3e7`、`e71bf8aa`、`594e23ae`、`f6535f56`；`dadb99f2`、`1538f8cb`（英文标题“Merge branch 'master'...”按“合并远端 master 分支”归类）和 `b3710265`／合并请求 !105、!106 的重合并差异均为空，没有独立冲突修复代码，因此只总结源提交和最终净结果，不重复累计自动 merge。
- **模块展示设计器与跨端视图**：模块引擎新增可视化展示设计器，统一配置紧凑模块标题、说明、最多 6 个动态指标、PC 复合列和移动业务卡片；顶层 PC 列表固定按“模块 Hero → 页面多 Tab → 查询与表格”展示，复合列支持主字段、多行副字段和右侧图标／状态，卡片支持头像、顶部标签、标题、副标题、右侧金额／状态、正文、Meta 和底部字段。字段模板结果继续经过净化并可被复合列、卡片复用，引用字段自动并入查询范围，空值和重复区域按语义隐藏。
- **菜单、页签与按钮统计角标**：`sys_menu` 新增 `MenuBadgeEnabled/MenuBadgeApiEngineKey`，侧栏菜单、PageTabs 及六类模块按钮支持按接口引擎或已有统计字段显示角标；同一接口按当前页 `Ids + ButtonKeys` 批量取数，页面级与逐行结果统一从 `Data.Buttons/Data.Rows` 读取，零值、超限和失败均可安全降级，避免逐行 N+1 查询。模块资源、数据库升级、缓存刷新、回读校验、MCP Schema、官方文档和 Skills 同步更新。
- **MCP 布局与展示批量写入保护**：新增 `microi_add_layout_field`，以仅元数据方式创建 CollapseGroup、Divider、Tabs，避免误对业务表执行物理 DDL；新增 `microi_bulk_apply_form_layout`、`microi_bulk_apply_module_presentation` 和批量数据能力开关工具，真实写入要求 dry-run 指纹及明确确认，写后回读布局／展示配置，并校验表事件、字段 V8、字段数据、路由、权限 SQL、接口替换和按钮业务动作未被覆盖，支持部分完成后的幂等续跑。
- **表格、卡片与主题体验**：表格搜索框、模块标题、指标条、设计器、只读／禁用控件和桌面卡片统一消费运行时明暗主题变量，主色文字自动满足对比度，卡片增加清晰边界、层次阴影、图片缺失首字兜底及减少动效适配。操作列按中英文按钮文字、图标、间距和角标计算安全宽度，人工固定宽度只作为最小值；卡片切回表格时主动重算固定列，选中行的右侧固定操作列保持不透明，避免横向滚动内容穿透。
- **卡片字段与行按钮兼容**：卡片图片配置同时支持 `diy_field.Id/Name/AsName`，公有图片解析 FileServer，私有图片继续通过记录级签名地址读取；全宽历史图片自动切换纵向布局，空图片显示标题首字。桌面端可复用移动端 Card ViewSchema，标题、头像、副标题、顶部、右侧、正文、Meta、底部字段依次去重；`ShowRow=false` 的行内 V8 按钮收敛到“更多”，避免在卡片底部重复展示。
- **多级侧栏与低性能终端优化**：桌面侧栏展开态对深层菜单使用封顶缩进，保留完整标题提示和可读宽度；收缩态不再递归挂载整棵 Element Plus 折叠菜单，只按当前悬停路径生成可键盘操作的多级悬浮面板，统一继承主题色并处理视口边界。汉堡按钮补充键盘、ARIA 和焦点样式，主内容与固定头部取消高成本宽度过渡，降低大型菜单展开／收起时的卡顿。
- **报表字段请求修复（历史 `e71bf8aa`）**：报表模式调用字段元数据接口时同时传递顶层 `TableId` 与兼容 `_Where`，既满足 `GetDiyFieldList` 的参数／权限校验，也兼容历史 `ApiReplace.GetDiyField` 指向通用查询接口的场景，并新增定向回归用例。
- **跨端上传、私有文件与 TableChild（历史 `594e23ae`、`f6535f56`）**：PC 图片控件统一兼容路径字符串、单对象、JSON 数组以及小程序缺少 `State` 的上传记录；HDFS 普通／UniApp 上传成功响应补充当次短期预览 URL，业务字段仍只持久化 Path，后续访问继续走记录级授权。PC TableChild 改用物理表名配合 `_TableChildAuth`，避免子菜单数据范围再次过滤已按外键授权的数据；UniApp 嵌套关联列表继续传递完整父子授权链。
- **UniApp 关联业务与搜索体验（历史用户贡献）**：关联列表从菜单 `SearchFieldIds` 生成关键词和筛选字段，物理子表查询构造同组 OR 条件，并按主表 Id 去重一对多 Join 结果；关联列表、表选择器、业务／模块／商城／任务列表、设备和人员选择统一增加防抖搜索、一键清空、请求序号防旧响应覆盖及加载错误反馈。详情页筛选遮罩脱离滚动容器，避免被外置新增按钮或底部操作栏遮挡；客户跟进联系人、关怀金额、方案安装点位数量和分享路径等项目扩展同步修复。
- **空数据库发布与一键发布可靠性（历史 `7788a3e7`）**：空数据库复制改为逐表独立连接、`REPEATABLE READ` 事务、复制前后行数核验和瞬时 MySQL 故障有界重试，并以带唯一任务持有者和过期时间的 Redis 租约限制跨节点并发发布。一键脚本在修改版本前执行资源预检，失败重跑复用高于 HEAD 的未提交版本；后端发布复用已验证 Release 产物，正式目录严格排除 logs/PDB，最终混淆产物以专用端口 `/api/Diagnostics/liveness` HTTP 200 冒烟并在成功、失败或中断时有界清理进程和运行态文件。
- **后台任务旧库自动接管与幂等修复**：Upgrade21 可接管“物理 `mci_background_task` 已存在但 `diy_table/diy_field` 元数据缺失”的半安装状态，并将固定字段、租户字段、业务字段的物理结构与元数据分开补齐；每步支持重复执行、失败后回读确认，最终严格校验运行时投影所需全部列、刷新表和字段缓存并记录实际修复列。后台任务不可用提示改为优先指导升级并重启新版后端，仅在自动升级被禁用时才要求前台安装基础包。
- **官方内嵌应用执行上限修复**：发布门禁发现表单引擎和应用商城的内嵌接口仍保存 `LimitRecursion=10000`，超过当前 V8 运行时硬上限；两份官方资源统一收敛为 `5000`，使首次安装、升级导入和运行时限制保持一致，避免官方包反复导入不可生效的超限配置。
- **PC／移动统一 AI 助手与安全交付说明**：PC 顶栏与移动端助手明确复用 `mci_ai_data_assistant` 的 Bootstrap、会话和问答协议，快捷问题动态读取业务域 `PromptExamples`；普通角色继续依赖 `mci_ai_role_policy`，只有后端可信超级管理员可在新安装租户缺少策略时获得禁用原始 SQL、隐藏敏感字段的安全兜底。商城包不固化发布租户角色／模型 Id，发布后须回读包并真实调用目标租户 Bootstrap；PC 模型与推理标签同时固定为单行布局。
- **Microi.VSCode 子仓库待提交内容**：插件升级至 v4.5.1；Codex MCP stdio 适配器把子进程输出从字符串拼接改为字节缓冲，等收到完整换行帧后再按 UTF-8 解码，避免中文字符恰好被分割在两个 stdout 数据块时产生乱码。生命周期测试新增“中文响应跨字节分片 + Content-Length 完整帧 + stdin 关闭后子进程退出”闭环。
- **Microi.net 与 Microi.AI 子仓库待提交内容**：两个独立程序集均由 v6.9.0 升级至 v6.9.3，本轮子仓库没有其它源码差异；根仓库公共组件同步升级至相同平台版本。相关前端、升级、报表、上传、模块展示、主题、MCP、AI 文档和 Skills 回归用例随源码更新，本日志不把 `dist` 生成物、纯 merge 重复或尚未执行的真实生产／双节点故障测试表述为新增能力。

## v6.9.0 - (2026-07-31 03:09)

- **版本发布与四仓边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.9.0；Microi VS Code 插件及内置 Skills 升级至 v4.4.6。写入本日志前的非 `dist` 盘点基线为：根仓库 72 个已跟踪待提交文件和 13 个未跟踪文件，Microi.net 10 个文件，Microi.AI 5 个文件，Microi.VSCode 6 个文件；四个仓库都没有暂存内容，本地 `master` 与各自 `origin/master` 对齐。`microi.mcp/dist` 等编译产物继续不纳入功能总结。
- **指定历史范围与自动合并去重**：根仓库从 `36e02f5e376ba7b937d295e4b500d04e240b24c1` 的父提交到当前 `HEAD 8e624d23` 共覆盖 17 个可达提交，最终为 142 个非 `dist` 文件、8960 行新增和 1133 行删除的净差异。其中 `6626818`、`205ef07d`（英文标题“Merge branch 'master'...”按“合并远端 master 分支”理解）和 `8e624d23`／合并请求 !104 都是无独立冲突解决差异的 merge 节点；本日志只按各功能源提交及最终净结果归并，不重复累计分支原提交、自动 merge 或已在 v6.8.4 记录的 `baab78a`。
- **v6.8.4／v6.8.5 内存修复补记（根历史 `36e02f5`、`a275dc03`）**：`36e02f5` 仅修订更新日志中的版本说明，没有新增业务源码；`a275dc03` 将平台版本推进至 v6.8.5，并把 API 进程内存保护的运行上限调整到物理内存 95%，同步请求退出、后台任务、多语言缓存、两级缓存、系统日志队列、诊断接口、测试及 AI 规则，低于软阈值时仍通过 readiness 降级和有界停机保护节点。该段按实际源码增量补记，不把日志文字修改虚构为功能。
- **子租户微服务与 MCP 发布修复补记（根历史 `5a906fb0`）**：微应用宿主补齐可用高度契约、运行错误页、稳定入口和弹窗适配；MCP／服务端发布链为子租户存储回读真实资产并校验大小、SHA-256、入口 HTML、源码清单和运行清单，在服务、页面路由、应用主数据或版本状态任一步失败时恢复旧运行指针，避免半发布。应用资产使用独立 20GB 上限而不继承普通附件 100MB 默认值，并补充发布者拒绝原因、MinIO Endpoint 兼容、目标租户源码读取和完整性回归；新增 Dos.ORM、部署、文档覆盖、表单／模块引擎、V8 工具与蓝牙打印等 Skills，英文技术字段统一按中文能力归类。
- **UniApp 关联业务与子表交互补记（根历史 `695dc20a` 至 `337dcc45`）**：业务详情把关联模块改为 Tab，标题取平台折叠项名称；关联列表与独立入口统一卡片、任务、明细和搜索体验，`ModuleEngineKey` 优先解析真实平台 Key，不再误用 `sys_menu.Id`。子表由主表内直接展开逐步收敛为首卡／“查看更多”及独立列表加载，并适配其它表单、联系人和默认地址同步；新增客户尚未保存时可先录入允许的关联数据，同时补齐原生表单和相关静态检查。
- **客户业务与 AI 移动入口补记（根历史 `990770d3`、`a113d531` 等）**：恢复客户移入公海、领取客户、负责人和跟进状态联动；PC 远程下拉保留当前页或当前帐号数据范围外但已选中的合法选项，避免已有 Id 因候选集未返回而显示为空。UniApp AI 悬浮入口升级为全局可拖动按钮，并同步 custom tabBar、客户范围脚本和回归检查；这些用户分支源码只总结一次，不再因三次 merge 重复列出。
- **访问密钥自动登录与旧身份隔离**：PC 新增统一 Token 归一化和身份切换状态，访问密钥兑换显式不携带旧 Authorization，并在切换期间抑制旧请求的 401、错误弹窗和重复登录框；兑换页改为三阶段安全反馈，显示授权帐号、清理地址栏密钥并短暂停留成功态后跳转。Vite 固定 61500 且启用 `strictPort`，避免前端端口被占用后自动顺延到 API 61501；新增匿名到登录态、Token 替换和访问密钥页面回归用例。
- **访问密钥控制面与 FormEngine 授权闭环**：匿名兑换在过滤器中先于旧 Token 解析短路，避免过期 Bearer 把兑换请求重新带入认证递归；密钥、用户、表、字段和菜单元数据改为租户数据库会话内的参数化分批查询，设置 10 秒命令超时并只对冷缓存加载做进程内 single-flight，共享数据库／Redis 仍是事实源。运行快照新增菜单 Id 与 `ModuleEngineKey` 白名单，动态 FormEngine 路由同时核对 URL 资源、请求表／菜单／字段引用，无法证明范围时失败关闭；保留真实帐号管理员标识后再与密钥 scope 和资源白名单求交，既不越权也不让既有角色校验误拒绝全部请求。
- **MCP 固定看板启动链接**：`microi_create_my_access_key` 在仍只返回一次明文密钥的前提下，新增相对和绝对的 Microi.Client 登录 URL 模板，明确必须使用前端 WebBase 而非 API Server，并对完整 `redirectPath` 编码；登录后目标页不再携带 `access_key` 是安全清理，不再生成第二份含明文的目标页链接。工具描述、服务端安全文档和访问密钥测试同步更新。
- **API 启动诊断与插件可观测性**：新增启动地址解析、端口监听预检和嵌套 `SocketException.AddressAlreadyInUse` 识别，端口冲突时在终端输出中文原因、解决方案和 Windows 排查命令；其它启动异常输出简要根因并把完整堆栈交给系统日志。只有 Kestrel 触发 `ApplicationStarted` 后才显示“全部启动成功”和真实访问地址；缓存、验证码、HTTP、ORM、HDFS、Job、MQ、MQTT、MongoDB、Office、搜索、采集及微信等插件增加注入／启动标记，日志拦截器保留启动失败、原因、方案和插件结果，避免尚未监听就误报成功。
- **V8 高内存长任务与后台执行一致性**：普通租户脚本继续默认 2048MB，平台可配置硬上限由 4096MB 放宽到 8192MB；租户开通、空库下载／导入、数据库备份等已授权平台长任务可暂停当前 Jint 引擎的单层独享累计分配计数，根调用树总预算、并发和取消保护仍然生效。持久化后台接口执行强制回源共享数据库读取最新脚本并修复缓存，避免某节点错过失效通知后执行旧代码；V8 并发和预编译缓存参数统一从主租户运行配置读取。
- **空数据库发布、租户开通与可恢复证据**：空库脱敏 Worker 使用稳定接口 Key，节点若在脱敏提交后、检查点持久化前重启，会先验证目标库并以 `AlreadySanitized` 幂等续跑，不重复执行非幂等清理 SQL。空库下载结果增加公有桶／带防缓存 CDN 来源、ZIP 与 SQL 文件名、字节数和 SHA-256；租户开通结果回传数据库导入及种子包结构化证据，便于后台任务审计和失败定位，连接串与密钥仍不返回脚本。
- **LibreTranslate 非阻塞安装与租户配置单源**：一键安装不再同步等待最长 60 分钟的模型下载、HTTP 就绪和真实翻译；改为用同版本镜像先在持久卷创建并回读随机 `api_keys.db`，再启动正式容器并确认运行，让语言模型在后台继续初始化，不阻塞吾码其它服务。翻译引擎取消 `MICROI_TRANSLATE_*` 环境变量回退，统一读取 SaaS 租户 `TranslateProvider/TranslateUrl/TranslateApiKey/TranslateTimeout`，安装脚本仍写后回读且不输出 Key；翻译、性能、调试和工作区内置 Skills 同步新的节点自动标识与持久卷规则。
- **Microi.UI 设计模式与可复用契约**：官方 Microi.UI 文档和 Skills 新增品牌叙事、真实产品流程、趋势构图、沉浸互动、动态首屏、数据工作台六类模式，要求一页一个主模式、先完成加载／空／错误／成功／权限／禁用状态，再增加装饰和动效。新增 `MCI-DESIGN.md` 契约模板、设计模式库、登录／支付／搜索／设置等产品流程配方、动效与 Canvas/WebGL／图片／视频降级规范，以及可运行的原创桌面／移动案例和官网 SVG 展示；移除旧的外部参考驱动文档，统一使用 `--mci-*` token、MCI 组件和合法项目资产。
- **1:N 子表建模门禁与表单组件资料**：业务蓝图、DB Schema、FormEngine 和组件目录明确先判定 `1:1/N:1/1:N`；“子表、明细、清单、条目、行项目、多个记录”默认创建独立子表、子表真实外键、`(OsClient, ParentId)` 回查索引、隐藏 CRUD 菜单和 `TableChild`，禁止用主表 `XxxId + JoinForm` 冒充明细。补齐 `JoinForm`、`TableChild` 的完整 Config、两阶段回读真实表／菜单 Id、导入关系和验收示例，关系不明确时必须在 MCP 写入前确认。
- **PC 微应用弹窗与开发端口修复**：固定高度的微应用弹窗为历史 `micro-app-body` 提供单一纵向滚动兜底，解决子应用未自建滚动区时内容被裁切；新建微服务模板使用宿主 `--micro-app-available-height` 而非强制 `100vh`，与既有宿主高度契约一致。前端端口占用改为明确失败，减少开发时“微应用空白／API 启动失败”相互掩盖。
- **Microi.VSCode 子仓库待提交内容**：插件由 v4.3.7 升级至 v4.4.6；任何独立“推送”都会先同步私有源码并保存服务端 `SourceManifestHash`，再对构建目录逐文件流式计算 SHA-256、以常量内存 multipart 上传，拒绝符号链接、越界路径、密钥／环境文件、源码映射、超过 2 万文件或 20GB 的目录。服务端按 `DeliveryBatchId + SourceManifestHash + RuntimeManifestHash` 完成逐文件回读验签和原子切换，插件只有在 `RuntimeVerified=true/PublishStatus=Published` 且稳定 `index.html` 返回有效 HTML 后才报告完成；显式目标服务器／租户只使用精确匹配 Token，微服务模板同步宿主可用高度。相关 API、测试和类型管理源码一并更新。
- **Microi.net 子仓库待提交内容**：程序集由 v6.8.4 升级至 v6.9.0。持久化后台接口引擎以可信身份标记强制回源数据库取最新脚本；V8 受控宿主操作实现单层内存暂停作用域，根调用树预算不变；V8 并发／缓存参数改用运行态配置，翻译供应商仅从 SaaS 租户配置读取。租户开通返回数据库导入、种子包、空库来源和双层 SHA-256 证据，清理已迁入租户配置的压力／安全环境变量别名并保留多语言运行参数映射；XML API 文档同步。
- **Microi.AI 子仓库待提交内容**：程序集由 v6.8.4 升级至 v6.9.0；内嵌翻译 Skill 改为 API Key 数据库预初始化、正式容器启动后后台下载模型，删除同步健康等待门禁和环境变量配置说明。性能、V8 调试和工作区规则取消人工设置稳定 `MICROI_NODE_ID`／spool 路径环境变量的要求，改为平台自动生成运行实例标识并复用固定持久卷，仍要求全局 `EventId` 幂等恢复。
- **回归、文档与验收边界**：新增或更新访问密钥、动态 FormEngine 路由、API 端口诊断、控制台日志、V8 内存、接口缓存兼容、空库幂等续跑、升级版本、微服务流式发布和宿主高度契约等回归用例；安全、Microi.UI、低代码建模、翻译、导入导出、前端与系统交付 Skills 同步。以上是源码、历史净差异和仓库待提交状态的发布总结，不把未执行的完整 .NET／前端构建、真实双节点故障转移、生产发布或硬件打印验收表述为已通过；本次只更新日志，不替用户提交或推送。

## v6.8.4 - (2026-07-29 19:16)

- **版本发布与仓库边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.8.4；Microi VS Code 插件及内置 Skills 升级至 v4.3.7。本次继续按根仓库、`Microi.Server/Microi.net`、`Microi.Server/Microi.AI`、`Microi.VSCode` 四个 Git 边界汇总，`microi.mcp/dist` 等编译产物及本地诊断日志不纳入功能变更说明。
- **指定历史范围与合并去重**：根仓库 `baab78a`、Microi.net `c5b3500`、Microi.VSCode `478eb16` 都是各自当前 `HEAD`，从指定提交到 `HEAD` 的范围均只有该提交本身，且三者都是单父普通提交，没有后续提交、自动 merge 或额外冲突解决代码；因此分别按根仓库 122 个非 `dist` 文件、Microi.net 13 个文件、VS Code 7 个文件的净差异审计。`baab78a` 中已写入 v6.7.7 的访问密钥、AI 助手、应用商城等基础能力不重复累计，本节以下只补记尚未覆盖的实际增量。
- **数据权限设计器、字段唯一方式与定制组件保存（补记根仓库 `baab78a`）**：数据权限可视化配置以可读的 `MICROI_DATA_PERMISSION_CONFIG` 注释随最终 SQL 持久化，重新打开时可恢复图形规则，同时最终 SQL 始终允许直接编辑；提交前统一刷新 Monaco／定制组件的防抖值，服务端执行时只剥离图形恢复标记，避免刚输入的条件丢失或标记进入真实查询。字段设计器新增“单独唯一（允许空值重复）／同时唯一（组合约束）”并兼容历史 Config；物理 `DevComponent` 字段识别、值回写和保存链路同步修复。
- **V8 嵌套调用预算与结构化诊断（补记根仓库 `baab78a`、Microi.net `c5b3500`）**：新增单层 Jint 累计分配预算、根调用树总预算、接口嵌套深度和嵌套内存隔离，子接口不再被每层父接口重复计费，同时整棵调用树仍有总上限；嵌套调用复用全局／租户并发名额、同 Key 重入避免自锁，并传递取消信号。超时、语句数、递归、单层／调用树内存和并发等待统一返回 `V8Limit` 诊断，脚本可通过 `V8.Limits` 查看本片有效预算；Upgrade22 幂等补充租户配置字段并纠正“累计分配量不等于实时堆内存”的历史描述。
- **可信后台身份与主租户授权闭环（补记根仓库 `baab78a`、Microi.net `c5b3500`）**：持久化后台任务从服务端保存的认证快照恢复 `AsyncLocal` 可信身份，允许内部 Worker 调用 `StopHttp=1` 接口并保留 `_InvokeType=Client` 业务事件语义，修复无 HTTP Token 时的 Code=1001；可信身份不暴露给 `V8.Param`，脚本参数不能伪造管理员。主租户创建 SaaS 租户继续要求实时主租户超级管理员授权，后台执行不放宽租户边界，取消和节点停止信号可传入 V8 执行片段。
- **空数据库发布残留审计（补记根仓库 `baab78a`）**：空库发布进一步识别并删除 AI 应用／商城相关物理表、表字段元数据及遗留运行数据，保留平台必需服务；发布结果新增非空表数量和行数排行，连接串先经 Dos.ORM 兼容规范化，再执行多数据库包生成及零残留门禁，便于定位异常大表和模板污染。
- **VS Code 身份恢复与 V8 类型提示（补记 `478eb16`）**：插件把 Token 新增、轮换和清理实时同步到 MCP Token 文件，MCP 身份失效时只写入不含凭据的短期恢复请求，由扩展宿主从 SecretStorage 按 `ApiBase + OsClient + 产品类型 + 网络环境` 精确恢复；同一身份采用 single-flight 合并并发恢复，校验失败 Token 的 SHA-256、请求时效和失败冷却，避免多连接串号或递归重登。同步识别签名／安全版本失效、验证码登录和租户配置错误，并为 `V8.Limits` 补齐超时、语句、递归、嵌套和累计分配类型声明。
- **SaaS 主租户运行参数集中管理**：普通运行、安全和集成参数从环境变量／`appsettings.json` 迁入主租户 `sys_osclients`，Upgrade23 幂等增加跨域、SSRF、后台任务、多语言缓存、OAuth、畅捷通、微信、安全防护、请求压力、ORM 连接／DDL 和采集会话等字段；API、FormEngine、Dos.ORM、Spider、微信／消息控制器统一通过运行态读取器取值。数据库、Redis、节点 Id、持久卷和密钥等启动基础设施仍保留专用配置路径，避免把节点级机密混入业务参数。
- **API 进程内存、流量退出与有界停机**：新增基于常驻集 RSS 的进程级内存软／硬阈值保护，软阈值停止接收普通新请求并让 readiness 返回降级，liveness 保持存活；硬阈值连续命中后先退出流量、请求宿主停止，宽限期后仍失控可用退出码 137 交由编排器重启。请求压力中间件同步返回 503 与 `Retry-After`，诊断接口公开当前 RSS、托管堆、阈值和停机状态，节点恢复到回滞线以下后再接单。
- **系统日志有界队列与故障 spool**：异步系统日志改为 4096 主队列、512 溢出区和分批写入，消除无界内存增长；每批先以 WriteThrough 写入带稳定节点标识的本地 spool，再写 MongoDB，队列已满、Mongo 故障或服务排空时同步进入紧急 spool，启动后自动恢复临时文件并幂等重放。监控增加队列、溢出、紧急落盘、丢弃和 spool 文件数；生产多节点应为每个 `MICROI_NODE_ID` 挂载独立持久卷。
- **文件上传限额与 413 全链路诊断**：ASP.NET Core 接收层统一提供 2GB 请求／multipart 硬上限，租户业务限额继续从 `sys_osclients` 与代码默认值读取；全局异常处理覆盖请求体过大、multipart 解析失败和 Controller 之前的 413，返回接收层、业务层、HDFS 层及 nginx 调整建议，并在 HDFS 响应头回传限额信息。PC 图片／文件控件新增失败回调和用户可读诊断，清理“正在上传”占位与失败文件，避免前端误报成功或残留假记录。
- **多语言运行时缓存安全重载**：`diy_lang` 缓存从一次性读取 20 万行改为按 Id 游标分页、物理字段白名单和命令超时加载，只投影配置语言列；加载前校验有效行数，并限制行数、字符总量、Key 与翻译文本长度。达到预算、游标异常或依赖失败时保留旧缓存并记录统计，不再用异常大表耗尽 API 内存；页大小和预算由 SaaS 主租户配置维护。
- **访问密钥运行态授权继续收口**：精确白名单扩展到 FormEngine、模块／流程、页面元数据、接口引擎、数据源、HDFS 和后台任务等受限运行接口，同时解析表 Key、表 Id、字段 Id 和间接菜单／流程引用；缺少引用、混合越权或无法证明范围时失败关闭。接口引擎按真实 Key／Address 回读授权，导出、数据源和后台任务再次执行控制器级校验；访问密钥会话不能获得管理员／超级管理员界面能力、踢出其它终端或进入应用资产发布控制面。
- **MCP Vue 微服务脚手架与二进制流式发布**：新增 `microi_scaffold_vue_microservice`，只允许在真实的租户“AI应用”目录中通过 dry-run 与精确确认创建 Vue 3 + Vite、多页面路由、MicroApp 上下文和 V8 SDK 脚手架，不覆盖不同项目或跟随符号链接。新增单文件与整目录流式发布：本地逐文件计算 SHA-256，拒绝 `.git`、`node_modules`、密钥、环境文件、越界路径和失控文件量，以 multipart 常量内存直达不可变 HDFS 版本目录，不经过 JSON、Base64 或 Jint；完整清单和完整性标记校验通过后才由服务端复制切换 root／latest 稳定入口，失败可安全重试。
- **微服务菜单绑定与可恢复客户端分片**：MCP 创建模块支持 `OpenType=MicroService`，同时校验服务 Id、页面 Id、稳定 Key 和内部路由的归属关系，并保存 `IsMicroiService`、页面与路由绑定，避免菜单指向其它服务。长操作若已在前端按独立事务分片，可声明 `ClientChunked`／`ClientSequential + MaxItemsPerChunk + Resumable` 保留客户端执行；缺少单片上限或不可恢复时仍按后台任务规则阻止伪分片。
- **一键安装与 LibreTranslate 闭环**：默认固定使用内置 Skills 与权限感知 Schema 搜索，不再询问或部署 Ollama、`nomic-embed-text`、Qdrant；MinIO 桶初始化改用吾码阿里云镜像中的官方 `mc`，避免直连海外下载站。LibreTranslate 固定 1.9.6 镜像，必须等待 booting 标记消失、HTTP 健康和 API Key 数据库就绪，注册随机 Key 后执行真实翻译烟测，再把 Provider、URL、Key 和超时写入当前租户 `sys_osclients` 并回读一致；终端和错误日志不输出 Key 明文。
- **Microi.AI 子仓库待提交内容**：程序集从 v6.7.7 升级至 v6.8.3；内嵌 AI Skill 明确一键安装不启用向量依赖、只有运维验证服务且租户显式开启后才使用向量召回；翻译 Skill 补充 SaaS 配置写后回读、LibreTranslate 启动误报根因、API Key 注册和真实翻译验证规则。
- **VS Code 与 MCP 工作区衔接**：插件当前待提交版本由 v4.3.4 升至 v4.3.7，并向每个 MCP 配置注入 `MICROI_WORKSPACE_ROOT`、`MICROI_SYNC_ROOT`、`MICROI_AI_APPLICATIONS_DIR`，使脚手架和应用发布准确定位当前租户工作区、同步根及“AI应用”目录；Microi.net 子仓库当前待提交内容仅为 v6.8.2 到 v6.8.3 的版本元数据升级。
- **回归、文档与 Skills 同步**：新增上传错误、请求体超限、SaaS 运行配置、多语言预算、应用资产流式发布、微服务脚手架、访问密钥、V8 内存、SSRF、采集安全、缓存升级、后台任务分片、LibreTranslate 和应用商城构建等回归用例；Docker／本地运行、数据库、HDFS、安全、SaaS、采集、翻译、V8 服务端及 MCP／Skills 文档同步更新。以上仅表示源码与用例已纳入本次待提交范围，不把未执行的完整构建、真实多节点部署或生产环境验收表述为已通过。

## v6.7.7 - (2026-07-28 22:07)

- **版本发布与仓库边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.7.7；Microi VS Code 插件及内置 Skills 升级至 v4.2.9。Microi.AI 子仓库本轮除版本元数据外无其它待提交功能代码；本次继续按根仓库、Microi.net、Microi.AI、Microi.VSCode 四个 Git 边界汇总，`dist` 等编译产物不纳入功能变更说明。
- **指定历史合并去重（根仓库 `f1bb6be`）**：`f1bb6be` 当前是 `origin/master` 顶端，此后没有新的远端提交；其合并链包含 `022947a`、`103eee8`、`7e04552` 三次实际源码变更，以及 `65b9511`／合并请求 !101、`3c632f5` 和 `f1bb6be`／合并请求 !102 三个汇入节点。三个 merge 节点没有额外冲突解决代码，本日志按 `6927c137..f1bb6be` 的 18 文件净差异归并，不重复累计自动 merge 的文件统计。
- **弹出表格固定筛选与连续选择（补记根仓库 `022947a`，经 `65b9511`、`3c632f5`、`f1bb6be` 汇入）**：`OpenTableSetWhere` 固定范围改为在搜索、Tab 和高级列筛选之后追加，同字段临时条件不能再覆盖固定条件；新旧 `_Where` 混用时统一转换为服务端可解析的兼容结构。弹出表格多选无需配置批量按钮也可开启连续选择，并在翻页和结果刷新后保留跨页勾选，新增固定条件及连续选择回归用例。英文提交前缀 `fix(framework)` 已按“框架修复”归并为中文说明。
- **UniApp 跟进记录与列表刷新（补记根仓库 `103eee8`、`7e04552`，经 `3c632f5`、`f1bb6be` 汇入）**：原生下拉把搜索、已选项和清除操作统一到输入区，多选即时保存数据源完整行并兼容历史 Id 数组；集福鲤跟进记录在新增、编辑、详情中回填客户 Id／名称和联系人对象，提交前阻止同名客户歧义。业务列表与通用模块列表监听详情页数据变更后刷新配置和数据，同时恢复原滚动位置；审批／驳回后立即补丁更新当前行并按文字、状态码双重判断按钮显隐，解决操作完成后按钮仍显示或列表未刷新的问题。
- **持久化分布式后台任务**：后台接口引擎任务由进程内字典升级为租户数据库事实源，新增 `mci_background_task` 幂等迁移、租户幂等唯一索引、待领取扫描索引、节点租约、续租、fencing token、并发组、取消、失败重试、软删除和断点重新入队；每个 API／Worker 节点都可运行持久化 Worker，节点退出或租约过期后由其它节点恢复。数据库定时备份同步使用稳定幂等键和全局并发组，避免多节点同一轮重复投递。
- **后台任务协议与真实进度**：`V8.ApiEngine.RunBackground` 新增 `IdempotencyKey`、`ConcurrencyKey`、重试次数及业务表状态／任务 Id／进度／ETA 字段，`V8.Method.UpdateBackgroundTask` 支持真实 `Current/Total`、消息和追加日志；超过 10 分钟的任务可返回 checkpoint 分片并在每片提交后重新排队。PC 通知中心新增业务记录、详细日志、可信度和预计结束时间，未知总量使用不定进度，失败／取消保留最后真实进度，SignalR 之外增加前后台自适应轮询兜底；MCP 会按 2 分钟、500 条、1000 个扇出或 100 次外部调用等工作量自动识别长任务并检查幂等配置。
- **自动升级宿主生命周期与跨容器缓存失效**：服务器自动升级从未被宿主跟踪的 `Task.Run` 改为可取消、可观测的 HostedService，每个租户在分布式租约下有界等待并优先幂等展开后台任务基础表，再继续原有迁移和多语言缓存加载；物理表创建中断在“元数据已存在、实体表缺失”时可通过 `_OnlyCreateTable` 精确自愈。两级缓存失效消息从单纯进程 Id 改为 `MICROI_NODE_ID/机器名 + PID + 随机实例 Id`，避免不同容器 PID 相同而误判为本节点消息、长期保留旧 L1 缓存。
- **浏览器访问密钥与受限免登录页面**：新增受保护控制面表 `mci_user_access_key`、创建／列表／吊销／兑换接口和用户管理弹窗；密钥只在创建时显示一次，数据库仅保存 SHA-256 哈希，可配置 90 天、自定义期限或永久。兑换后的短期 Token 每次请求都会通过共享 Redis／数据库复核密钥状态，并取“帐号实时权限 ∩ 页面、表、接口引擎、数据源和文件精确范围”；前端从 Hash 读取后立即清除密钥，只允许白名单路由，不再把传入 Token 输出到控制台或保存在 `sessionStorage`。
- **系统用户密码兼容审计**：平台超级管理员可在用户管理中经二次确认查看存量 `PwdEncode=DES` 密码，后端通过解密后重新加密校验密文有效性，拒绝访问密钥会话、自定义 V8 编码和其它未知编码，并设置禁止缓存响应、记录不含明文的安全审计；该能力不开放给普通角色、FormEngine、V8 或匿名端点。
- **AI 应用匿名浏览与登录写入隔离**：新增公有应用统一认证桥 `microi-ai-app-auth.js`，匿名用户可浏览 `app_*` 只读演示，首次保存、提交或修改时打开吾码登录框并携带新 Token 重试；服务端按接口 Key 后缀和 V8 代码双重识别写操作，未登录写入失败关闭。登录身份由服务端覆盖 `ClientKey/ActorKey/UserId`，匿名身份按租户和真实设备标识生成不可逆稳定读域；`app_*` 接口内对同前缀表的 FormEngine 新增、查询、修改和删除统一强制 `UserId` 行范围，客户端伪造字段或 `_Where` 无法越权。
- **主租户原子创建 SaaS 租户（Microi.net 子仓库）**：新增仅允许主租户超级管理员调用的 `V8.Method.ProvisionAdminTenant`，在分布式开通租约内完成数据库创建、空库或自定义库导入、`sys_osclients` 写入、admin 初始化、系统配置更新、运行态刷新和失败补偿，连接串不返回 V8。自定义 ZIP 只能从主租户私有 HDFS 读取，限制 256MB 包、512MB SQL、异常压缩比和 UTF-8 编码，且只能含根目录一个 `.sql`；导入后校验核心表与 admin，并暂停恢复库中的历史调度任务。
- **数据库索引统一管理与 MCP 建模**：Dos.ORM 为 SQL Server、PostgreSQL、人大金仓、Oracle、达梦统一返回有序字段、唯一性、类型和主键标识；后端新增租户物理表／字段校验、稳定索引名、等价索引幂等判断、并发创建／删除后的强制回读和主键删除保护。MCP 新增 `microi_get_table_indexes`、`microi_create_table_index`、`microi_drop_table_index`，Manifest 支持 `tables[].indexes` 并纳入生成／验收；PC“索引管理”同步识别跨库主键、组合唯一索引和系统字段，VS Code 类型知识与 Skills 明确禁止在 V8 中手写索引 DDL。
- **微应用稳定入口、Token 续接与加载体验**：PC 宿主、弹窗和开发组件统一访问 `/micro-app/{OsClient}/{AppKey}/index.html?v={Version}`，版本只作为缓存标识，不再进入入口路径；后端稳定入口把相对 JS／CSS 资产重写到对应不可变版本，同时保留外部及根相对地址。宿主与微应用 SDK 复用同一 V8 客户端并同步普通请求、FormData 上传和 `uni.uploadFile` 返回的新 Token，避免 Token 轮换后第二次请求失效；三类宿主统一骨架屏、弹窗固定内容高度和认证消息桥。
- **应用商城构建资产与租户运行上下文**：商城批量提升编译资产改传 `AssetsJson`，避免嵌套对象数组被表单参数映射成 `Assets[0]` 而丢失真实相对路径；`ai-app-build` 在入口、嵌套 HTML 和兼容路径中重新注入当前目标租户的 `ApiBase/OsClient`，转义运行上下文并拒绝硬编码官方 API。修复固定最新版时优先使用完整 `dist/build` 源码记录，仅在缺失时回退含完整入口的历史资产，避免把只有认证补丁的残缺版本切成白屏；VS Code 商城发布链路同步使用新协议。
- **PC／移动端／小程序 AI 助手统一入口**：PC 顶栏新增可拖动完整 AI 助手弹窗，手机底栏新增独立安全区槽位和专用页面，均由 `IsShowAiAssistant` 失败关闭并复用 `mci_ai_data_assistant` 的 Bootstrap、历史会话、重命名、归档、恢复和对话协议；缓存按 `OsClient + UserId` 隔离，身份变化会废弃旧异步响应。UniApp 的 standard／xjy Profile 统一启用原生 custom tabBar，H5 与微信小程序使用“导航胶囊 + 独立 AI 槽”固定布局，Profile 切换会重生成活动 TabBar 配置，非 Tab 页面保留安全区感知的固定回退入口。
- **UniApp 上传目录与 HDFS 分片策略**：普通交互上传只允许 `file/img/avatar/editor` 一级业务目录，头像、图片和普通文件按控件语义选择默认根路径，非法嵌套自定义路径回退到安全目录；后端继续负责追加租户及日期，并把对象存储日期目录从按日 `yyyyMMdd` 调整为按月 `yyyyMM`，避免单目录长期过大和每日生成过多目录，新增上传路径策略检查。
- **权限页面与大型菜单性能**：左右树表页面不再用通用 FormEngine 直读受保护的 `diy_LeftJoinRightView`，改由服务端校验精确菜单权限后返回单条配置；角色列表进入时不再立即下载包含全部 AI 应用的菜单树，只在打开角色编辑器时单次加载。菜单 JSON 转换的递归从字段循环中移出，消除多层大菜单树的指数级重复遍历和浏览器卡死风险。
- **官网应用详情与登录 API 路由**：应用详情页不再嵌入运行应用 iframe，改为安全解析上传预览图和净化后的富文本说明，并修复带 query 的 `/app-detail.html` 被误判为非详情页；本地官网 API 默认端口统一为 `https://localhost:61501`，生产构建仍强制回退官方域名。登录／短信接口统一使用 `--OsClient--iTdos--` 路由，升级器只在官方 iTdos 租户幂等修复 `send_sms_reg` 的匿名 HTTP 契约，不改客户同名接口配置。
- **前端构建内存守卫操作性**：构建前等待或构建中因 95% 全机内存占用暂停时，交互终端可输入 `s/skip` 继续，无人值守可显式设置 `MICROI_BUILD_SKIP_MEMORY_WAIT=1`；跳过后会给出风险提示并尝试安全恢复已暂停的完整进程树，恢复失败则终止任务避免留下挂起进程。一键编译脚本显式继承终端输入，根仓库同时忽略本地 `artifacts/` 验证产物。
- **回归、文档与 Skills 同步**：新增后台任务真实进度、微应用稳定入口／Token 轮换／骨架屏、桌面和移动 AI 助手、访问密钥安全、AI 应用用户隔离、租户数据库 ZIP、数据库索引写后回读、两级缓存实例标识、官网 API 基址和上传路径等回归用例；后端／前端 V8、任务调度、安全、数据库建模、应用认证及 MCP 文档同步更新。以上为源码、配置、迁移和资源元数据范围，未把 `microi.mcp/dist` 等生成目录计入功能清单。

## v6.7.5 - (2026-07-27 15:26)

- **版本发布与仓库边界**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.7.5；Microi VS Code 插件及内置 Skills 升级至 v4.2.4。Microi.net、Microi.AI 两个子仓库本轮除版本元数据外无其它待提交功能代码；本次继续按根仓库和三个子 Git 分开汇总，`dist` 等编译产物不纳入功能变更说明。
- **Skills v4.2.1 历史补记（根仓库 `0ef5a19`）**：在 v6.7.3 发布后先将 Microi Skills 从 v4.2.0 升至 v4.2.1，并更新时间元数据；本次最终随 VS Code 插件继续统一推进至 v4.2.4，避免插件与内置 Skills 发布版本分叉。
- **UniApp 原生表单与客户方案交付（补记根仓库 `f25a3e`、`63fff16`、`465b91b`、`f913aab`、`e705aef`，经 `671837e`、`5eaac31`／合并请求 !99 汇入主线）**：下拉选择器展开时会临时解除所在表单卡片裁切并提升层级，新增／编辑页的小字段组改为折叠展示并默认展开首组；集福鲤客户方案补齐初始值、设备型号联动和价格计算扩展，标准租户继续保留通用扩展入口；客户详情地图恢复正常显示，原生控件检查脚本同步增加回归断言。
- **CodeEditor 字段传输去重（补记根仓库 `3851338`、`25fee22`／合并请求 !100）**：模块引擎组装 CodeEditor 传输字段清单时统一去重，修复重复字段导致服务端解析后的传输字段列表失效问题，并新增重复输入回归测试。
- **在线 AI 应用发现与源码同步**：MCP 应用列表改为只读取发现、筛选所需的轻量字段，不再在列表接口中一次返回可能达到数十 MB 的应用包、富文本和图片内容；完整源码继续按单应用上下文读取。源码同步从仅支持 MicroService 扩展到 Web、UniApp、MicroService 三类应用，保留真实 `ApplicationType`、分类、描述和各自发布目录，并明确只写私有源码及商城主数据、不预先安装运行态微服务。
- **VS Code 应用商城独立发布链路**：AI 应用树不再过滤 Web／UniApp，按实际类型显示 Web、UniApp、MicroService；新增醒目的“构建并发布到应用商城（不安装）”操作，与“构建并安装到当前租户”彻底分离。发布前同步私有源码并构建，插件原生生成 UTF-8 ZIP，分别上传完整源码包和真实构建包，写入统一商城包、版本与预览元数据；发布前后回读 `sys_microiservice`，若运行态发生变化立即停止并报告，避免制作商城包时污染当前租户运行实例。
- **应用稳定最新版与历史版本双入口**：`ai_app_build` 升级至 v1.3.7，Web／UniApp／商城构建产物同时发布到不可变的 `versions/{Version}` 历史目录和无版本号固定最新版目录；先写非入口资产、最后切换根 `index.html`，避免发布瞬间引用尚未就绪的文件。商城、二维码和分享统一使用无版本根入口，不再在 URL 暴露 `v`、`apiBase`、`OsClient`；运行租户上下文由发布器写入入口 HTML，历史版本地址仍可独立回溯，并支持只修复固定最新版而不改历史版本。
- **跨租户安装运行上下文与统一应用包**：统一导入器升级至 v1.7.0，AI 应用发布器升级至 v1.5.4，内置应用商城包升级至 v6.7.5。安装包中的 HTML 会在目标租户重新写入 `ApiBase/OsClient` 运行上下文、重新计算大小和摘要，不再沿用发布端参数；MicroService 可只携带服务／路由元数据制作商城包，安装时再落地 `sys_microiservice` 与页面，Web、UniApp 和 MicroService 均保持私有源码、公开构建资产和安装运行态的清晰边界。
- **应用商城逻辑副本三方同步**：新增应用商城副本同步器，把 `import-package.js`、`ai-app-publish-store.js`、`ai-app-build.js` 与 `app.microi.store.json` 内嵌接口引擎视为同一组逻辑事实源；说明文字、换行或不同代码段的修改可以自动合并，同一代码位置出现不同实现时失败关闭。商城包需要写回官网但版本未高于远端时，可使用当前正式发布版本安全推进 `PackageInfo.Version`；本地独立文件、内嵌副本和共同基线不一致时禁止发布。
- **官方升级资源 MCP 安全发布**：资源刷新器在 CI 中继续优先使用环境变量令牌，本地未提供令牌时可复用工作区已登录的 `microi_itdos` MCP；连接前严格校验目标必须是 `https://api.itdos.com + iTdos`，通过 `microi_codex` 调用官方 `PublishBatch`，保留六项资源白名单、远端 SHA-256 乐观锁、冲突阻断和发布后回读。同步器不读取、打印或写入 MCP Token，缺少官方登录态和令牌时仍会明确中止。
- **v3／v6 接口引擎共享缓存迁移**：`sys_apiengine` 的 `SubmitAfterServerV8` 统一向 Redis 写入 JSON 文本，局部保存缺少 Key／Id／地址时回查完整记录，避免 v3 节点把动态对象落成 `System.Dynamic.ExpandoObject` 后无法反序列化。升级器在启动前及基础资源迁移后使用分布式升级租约、条件更新和并发回读，仅修复平台缓存写入片段并保留客户附加代码；随后按 ApiEngineKey、Id、ApiAddress 重建租户缓存别名，旧脚本已经序列化时不会二次编码。
- **官网 Gitee Star 校验反馈**：创建租户的 Gitee 授权回跳会读取校验原因和实际授权账号；未检测到 Star 时明确展示账号及目标仓库，提醒 Star 与授权必须使用同一账号，不再要求用户先取消再重新 Star。Gitee 事件或页面暂时不可用时改为独立的临时故障提示，中英文文案同步更新并在清理回跳参数时移除账号信息。
- **官网应用预览分享地址**：应用广场把历史 `versions/{Version}` 预览地址规范化为无版本固定最新版入口，移除缓存版本和租户运行参数，同时保留其它合法分享参数；新增 URL 工具测试，覆盖绝对地址和相对地址两种入口。
- **表单布局审计与界面细节**：表单分组规范由“只看字段数”改为按双列后的有效表单行、复杂控件和任务隔离判断，普通小业务域优先 CollapseGroup，扫码、报工、大型子表和代码编辑等强任务场景可保留 Tab；新增存量表自动审计、安全迁移、V8／Config 前后摘要比对和缓存回读要求，防止布局优化覆盖业务代码。PC 端同步调整更多按钮行高、父级 Tab 间距及左右树表页面高度，使紧凑布局下的上下留白保持一致。
- **回归与文档同步**：新增接口引擎缓存事件迁移、历史客户代码保留、JSON 防双重编码、商城独立文件／内嵌副本合并、真实代码冲突、正式版本推进、官方 MCP 租户绑定、稳定预览 URL 和 VS Code 多应用类型／商城发布边界等测试；升级资源 README、应用商城、表单布局和 UI Skills 同步更新。以上为源码、配置及资源元数据范围，未把编译目录计入功能清单。

## v6.7.3 - (2026-07-26 18:18)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.7.3；Microi VS Code 插件及内置 Skills 升级至 v4.2.0。本次按根仓库、Microi.net、Microi.AI、Microi.VSCode 四个 Git 边界汇总指定提交以来的历史差异和当前非编译产物待提交改动，`dist` 等构建目录不纳入功能变更说明。
- **统一测试框架与发布门禁（补记根仓库 `84c4237`）**：原 Dos.Common.Tests、Dos.ORM.Tests 等分散用例整合进 Microi.Tests，新增能力样例、数据库方言案例、执行计划断言、测试配置／Profile、Quick／Full 分级运行脚本和完整测试说明；PostgreSQL、KingbaseES 等数据库兼容编译与外部数据库管理能力同步纳入统一验证。接口引擎历史默认内存预算由 1024MB 提升至 2048MB，为大脚本和应用包执行提供基础容量，同时仍保留平台硬上限和用例约束。
- **Microi.net 唯一性与扩展数据库刷新（补记 `01f6935`）**：新增、修改数据时的唯一字段校验支持排除当前记录，并补齐组合唯一字段更新校验，避免正常编辑被自身旧值误判为重复；扩展数据库配置在事务成功提交后刷新共享运行态，使新连接配置及时生效且不把提交后通知失败伪装成业务回滚。
- **Microi.AI NL2SQL 与外部库知识（补记 `6eec6dd`）**：NL2SQL 权限检查新增 `diy_lang`、`mic_data_version` 元数据表集合并从普通业务表授权判断中分离；AI 组件补充扩展数据库结构发现、附件迁移、SQL／表单事件／文件／安全等内置 Skills 资料，并升级 Hosting、ONNX Runtime、OpenAI、Qdrant 等依赖。
- **VS Code v4.2.0 MCP 诊断（补记 `7f1a0e5`）**：插件补充 Microi 数据库类型提示，优化 MCP 状态字段、诊断描述和自动启动策略，减少重复启动请求；移除冗余 Codex CLI 配置同步，增强诊断脚本，并统一忽略 `.tmp` 临时目录。
- **后台主题与暗色模式重构**：PC 与移动端统一新的主题运行时，浅色／暗色模式各提供 12 套非冲突配色，以语义化 CSS 令牌驱动页面、导航、侧栏、页签、表格、弹窗、日历、文件管理器、工作流和 AI 工作台；暗色模式排除不可读的白色主色，自定义极亮／极暗颜色自动安全回退，并通过主按钮、侧栏激活项和底部波浪区域的 WCAG 对比度回归测试保证可读性。页面引擎和打印引擎设计态不再修改全局明暗状态。
- **模块数据权限图形设计器**：模块引擎新增可视化数据权限组件，可配置全部／本人／本人及下属／部门／部门及子级／自定义范围、租户隔离、全权限角色／岗位／部门、关联表和组合条件，并实时生成 `SqlWhere`、`SqlJoin` 与 `JoinTables`；图形快照使用平台专用标记无损恢复，手写 SQL 可切换高级模式继续维护。Microi.net 在执行前只移除设计器机器标记和自动说明注释，保留用户自行编写的普通 SQL 注释，相关模块资源、中文文档和回归用例同步更新。
- **V8 请求级控制台与异步运行时**：新增基于 AsyncLocal 的 `V8ConsoleContext`，接口引擎、MCP 和调试会话按请求捕获 `console.log/error/warn/info`，避免并发脚本通过全局 Console 串日志；Jint 运行时统一预处理异步脚本并在返回前安全排空 `setTimeout`，取消／释放时不再遗留 Timer，调试执行与正式执行保持相同语义，脚本摘要计算也兼容旧目标框架。
- **MongoDB 系统日志统一收口**：新增从 Dos.Common 到 Microi.Core 的运行诊断桥接和启动期缓冲，普通运行日志统一进入 MongoDB，仅在控制台保留启动、致命异常和日志管道自身故障等平台级信息；缓存、ORM、任务调度、RabbitMQ、MQTT、WebSocket、工作流、HDFS／CAD、OnlyOffice、Office 导入、Spider、AliDNS、模型绑定、SSRF 拦截及后台任务等日志补齐租户、动作、目标、级别和成功状态，系统监控明确区分平台关键控制台日志与普通 MongoDB 日志。
- **多租户两级缓存与批量写入稳定性**：Redis 订阅器由静态全局状态改为按缓存实例／租户隔离，允许不同租户使用不同 Redis；失效广播串行发送并对瞬时发布失败进行一次短延迟重试和聚合告警，FormEngine 写入与计数缓存失效改为可等待完成，减少批量导入时大量并发命令引发的 SocketClosed、跨节点旧值和日志风暴。
- **MQTT、RabbitMQ 与分布式任务诊断**：MQTT 未启用时不再启动 Broker，端口占用或启动失败后会解绑事件并完整清理实例；Windows 主端口访问被拒时可回退配置端口或 21883，TLS、租户解析、凭据冲突、Topic ACL、V8 拒绝和生命周期事件均记录结构化安全日志。RabbitMQ 子租户无效配置继续失败关闭且不回退主租户凭据，重复配置错误按租户聚合；Quartz MySQL 连接串在插件边界兼容旧租户 `SslMode=None/false` 等历史写法。
- **应用商城导入器大包稳定性**：仅把受信任的 `import-microi-store-package` 内存预算提升至 3072MB，普通接口引擎继续使用 2048MB 默认值和平台上限；升级前、资源包安装后都会修正执行限额并清理共享缓存，避免在线旧包把限额覆盖回 2048MB。菜单修复显式转换 dynamic 结果后再调用 JToken 扩展，资源校验改为接受不低于基线的语义版本，并同步应用包断点复用、稳定发布路径和源码／编译资产边界。
- **官网 Microi AI Studio 与账户资料**：官网首页升级为暗色 AI Studio 入口，登录用户可在个人中心使用服务端模型路由进行流式对话、模型切换、停止生成和本地会话历史；官网登录态会注入 Microi 官方产品身份与按问题检索的 Skills 片段，清理旧会话中“不了解吾码”的失效回答，并把调用方 system 提示降级为不能覆盖官方安全规则的普通补充要求，OpenAI 兼容接口继续保持通用用途。
- **AI 头像与资料自助维护**：个人中心支持昵称、头像上传和 AI 头像候选生成，服务端复用当前登录用户额度调用 MiniMax `image-01`，上游密钥不下发浏览器；生成结果需由用户选中后上传到当前租户 `member/avatar` 私有目录再保存。资料接口固定白名单为昵称和头像，用户及租户只能来自当前 Token，头像路径执行租户目录校验并在保存后刷新共享登录信息。
- **官网应用商城与 SEO**：应用商城重构分类、搜索、排序、骨架屏和响应式卡片，新增收藏／取消收藏、收藏量展示及按收藏量排序，详情页与列表统一使用官方公开数据源；VitePress 为每页生成唯一 description、keywords、canonical、Open Graph 和 JSON-LD，默认暗色但保留明暗切换，并把链接检查、站点构建和 SEO 审计串入文档构建流程。
- **表单弹窗与界面细节**：`OpenForm` 支持传入 `Height`（如 `80vh`）并使用固定高度滚动区，模块按钮打开设计器时可获得更稳定的大屏编辑空间；开发组件传值、表格导航、Tooltip 溢出、文件管理器、日历、AI 会话、移动端个人中心和工作流列表统一适配主题令牌与深色表面层级。
- **文档、Skills 与回归保护**：中文 FormEngine 文档原位补充数据权限设计器、自动注释清理和手写 SQL 兼容约定，前端架构、缓存、调试与安全 Skills 同步更新；新增主题对比度、V8 控制台并发隔离、缓存／应用升级、数据权限 SQL 注释和 AI 官方知识上下文等回归用例。版本日志只总结源码、配置与资源元数据，未把 `microi.mcp/dist` 等生成目录计入功能范围。

## v6.7.0 - (2026-07-25 04:32)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.7.0；Microi VS Code 插件及内置 Skills 升级至 v4.1.8。本次按根仓库、Microi.net、Microi.AI、Microi.VSCode 四个 Git 边界汇总非编译产物待提交改动，`dist` 等构建目录不纳入功能变更说明。
- **FormEngine 稀疏写入安全修复**：动态参数已经规范化为 `_RowModel`／`_FormData` 后，不再把完整参数对象及 `Name=""` 等模型默认值二次合并回待写行，确保升级器和服务端可信调用只更新显式传入字段，避免稀疏修改意外清空菜单名称、模块引擎 Key 等既有数据；租户边界回归用例同步覆盖两条动态参数转换路径和缺省字段不落入行模型的断言。
- **应用商城菜单自愈与前端兼容**：升级器改用官方稳定菜单 Id 定位应用商城，除重新绑定表 Id／表名外，仅在名称或 `ModuleEngineKey` 为空时补回“应用商城”和 `sys_microistore`，修复历史稀疏写入问题影响的租户且不覆盖正常客户配置；PC 菜单构建增加同一官方 Id／路由的空标题兼容，在服务端升级尚未执行前也能保持导航和页签可读。
- **私有文件网关与缺失文件反馈**：私有附件临时地址统一优先采用租户配置的规范 `ApiBase`，避免 Nginx、负载均衡或多节点部署下把后端 `localhost` 请求地址泄露给浏览器，Redis 中的共享票据仍可由任一 API 节点兑换；对象存储返回 404 时改为明确提示文件缺失及恢复建议，保留审计记录并改善排障体验。
- **文件同步与路由细节**：文件管理器在“当前平台 → 当前平台”场景也统一走服务端存储同步通道，避免不必要的浏览器中转；表单设计动态路由标记为隐藏，防止内部设计入口出现在普通导航；本地 Vite 开发端口由 1988 调整为 19888，减少与既有服务端口冲突。
- **前端构建内存保护**：构建前可用内存不足时由立即失败改为等待恢复；构建期间全机内存占用达到 95% 时暂停整个 Vite／转换进程树，降至 90% 并连续稳定 5 秒后自动继续，Windows 使用独立进程树挂起／恢复脚本，类 Unix 系统使用 `SIGSTOP`／`SIGCONT`，暂停失败时仍会安全终止作为保护回退。守护器记录 PID、持续输出暂停状态，并在信号退出和收尾阶段清理 PID 文件。
- **一键编译异常退出清理**：Windows Git Bash 发布脚本直接启动前端 Node 构建守护器，跟踪活动进程和守护 PID；关闭窗口、Ctrl+C、TERM 或 HUP 时先优雅结束再精确清理子进程树，避免残留 bash／npm／Node 进程，只有正常结束且终端可交互时才保留回车关闭提示。构建提示同步说明 95% 自动暂停、恢复后继续的新策略。
- **VS Code MCP 稳定性与 Windows 体验**：向 VS Code、Cursor、Trae 和 Claude 写入 MCP 配置前先比较序列化内容，字节未变化时不重复落盘，避免文件监听器无意义重启全部 stdio 服务；MCP Codex 适配器、Claude／npm 探测、压缩包解压、环境变量设置及 Git 长路径检查统一隐藏 Windows 子进程窗口，减少初始化和配置期间的黑色控制台闪现，并补充静态诊断回归断言。
- **发布工程维护**：根仓库忽略本轮 API 验证临时目录，版本元数据在客户端、服务器公共包、Microi.net、Microi.AI、VS Code 插件与 Skills 间保持一致；Microi.AI 本轮除 v6.7.0 版本元数据外无额外功能代码调整。

## v6.6.9 - (2026-07-24 20:52)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.6.9；Microi VS Code 插件及内置 Skills 升级至 v4.1.7。本次汇总根仓库与 Microi.net、Microi.AI、Microi.VSCode 三个子仓库的非编译产物待提交改动，`dist` 等构建目录不纳入功能变更说明。
- **CodeEditor 源码安全传输**：PC 表单仅在最终网络副本中把 CodeEditor 字段按 UTF-8 Base64URL 信封编码，前端 V8、日志、表单状态和提交回调继续使用明文；Microi.net 在新增、修改、按条件更新和批量写入入口统一校验协议版本、字段列表、大小及 UTF-8 后原子解码，并在服务端 V8 事件和入库前移除传输元数据。未携带信封的历史明文请求保持兼容，非法或部分损坏数据会整体拒绝而不会半解码写入。
- **v3／v6 接口引擎共享缓存兼容**：两级缓存统一动态 JSON 的 L1／L2 读取语义，接口引擎对象缓存兼容对象、标准 JSON 字符串及历史双重编码 JSON；应用导入器和动态路由改为向共享 Redis 写入明确的 JSON 文本。遇到历史 `System...` 类型名或其它损坏值时，只删除已确认损坏的租户缓存别名，从数据库回源并按 ApiEngineKey、Id、ApiAddress 重建，避免多节点或新旧版本并存时因命中层级不同得到不同类型。
- **接口引擎 JSON Body 与可信边界**：动态 `/apiengine/{key}` 路由及兼容 `/api/ApiEngine/Run` 入口都会把 JSON Body 恢复到 `V8.Param`，同名 Query／Form 参数继续保持既有优先级，XML 调用仍兼容；HTTP 请求中的 `_CurrentUser`、`_InvokeType:'Server'` 和 `_TrustedServerInvocation` 不能建立服务端信任，当前身份与调用类型仍由认证中间件和接口层决定。后端 V8 文档、接口配置 Skill 与 AI Skill 同步补充调用示例和安全验收规则。
- **v3 DiyConfig 与 v6 菜单物理字段双向兼容**：升级器为 `SelectApi`、按钮文案／类型、保存方式、隐藏序号、通用搜索、导入导出接口等字段补齐物理列，并在启动前、资源导入后和 `sys_menu` 提交事件中同步 `DiyConfig` 与物理字段；无字段级时间证据的冲突会保留双方并告警，不擅自覆盖客户配置。PC 读取旧菜单时可用 `DiyConfig` 填补空物理字段，应用导入器同时保留客户未知配置及桌面端／移动端显隐。
- **老库接口引擎字段 Config 自愈**：升级过程扫描 `sys_apiengine` 的字段元数据，保留已经合法的 JSON 原文，并兼容解开双重编码、规范化 Newtonsoft 宽松 JSON、转义 V8Code／SQL 字符串中的原始换行和控制字符；平台固定 Lock 字段可使用确定的标准配置兜底，其它包含业务数据源或 V8 的字段若无法无损恢复则保留原值并停止升级。修复后逐条严格回读，并清理字段列表共享缓存，让新旧节点重新从数据库构建一致元数据。
- **应用商城导入与内置资源升级**：内置应用商城包由 v6.5.14 升至 v6.5.16，统一导入器由 v1.6.8 升至 v1.6.10；导入菜单时合并目标库未知 `DiyConfig` 与包内显式配置、同步新旧字段并继续保护客户显隐，导入接口引擎时所有共享缓存别名均写入标准 JSON，避免 Jint／.NET 对象被字符串接口转换成类型名。
- **升级中断恢复与幂等建模**：创建 AI 角色数据访问策略表时会分别核对物理表和低代码元数据；若此前中断留下“物理表已创建、元数据事务已回滚”的半完成状态，升级器会接管现有物理表、事务性补齐固定字段元数据，并在物理列已经存在时只补 `diy_field`，避免重复 `CREATE TABLE`／`ALTER TABLE` 永久卡住后续启动。
- **官方升级资源发布容错**：六项官网升级资源的读取和发布后回读默认最多尝试 3 次、间隔 5 秒，只把网络、超时、限流及服务端错误识别为临时故障。实时官网仍不可用时，仅当六项本地资源与上次官网成功回读的共同基线逐字一致、内嵌应用商城副本也一致且没有本地待同步修改，才允许后端继续使用已验证离线基线；此路径不会写官网、修改本地资源或推进共同基线，认证、冲突和资源内容错误仍会失败关闭。
- **连接与发布物安全加固**：SignalR／WebSocket 对没有有效 Token 的连接改为明确中止，避免未初始化匿名连接继续占用资源，同时不恢复按 UserId／OsClient 直接信任的旧行为；Microi.net 项目从默认项、内容和嵌入资源三层排除 `License/keys`，防止官方签发中心私钥进入 NuGet、项目输出目录或客户 API 发布物。
- **AI 公共模型发现验收规范**：Microi.AI、V8 安全 Skill 与 UniApp 文档明确官方中转模型清单是跨租户、无 Token 的只读公共发现契约，只允许返回模型标识和展示名，禁止泄露 ApiKey、上游 Endpoint 或内部配置；发布验收需要同时验证匿名模型清单非空、Bootstrap 可用及登录普通账号真实 Chat，不能把 `NoAuth` 静默当作空模型或只看到推荐问题页面就判定 AI 可用。
- **交付与回归保护**：新增 CodeEditor Unicode 编解码、接口引擎缓存对象／双重 JSON／坏值回源、老库字段 Config 严格 JSON、菜单新旧字段同步、官方资源临时故障和离线基线门禁等回归用例；系统交付 Skill 补充“容器已删除但 Compose 文件残留”的安全重装规则，要求按 project 标签确认无运行或停止容器，校验并归档目标 yml 及 SHA-256 后才重新生成，拒绝覆盖身份不明、符号链接或语法损坏的生产编排。

## v6.6.0 - (2026-07-24 12:20)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.6.0；Microi VS Code 插件及内置 Skills 升级至 v4.1.5。本次同时汇总根仓库与 Microi.net、Microi.AI、Microi.VSCode 三个子仓库的非编译产物改动，`dist` 等构建目录不纳入功能变更说明。
- **UniApp 多租户与标准小程序架构（补记根仓库 `81d226c`、`76acd06`）**：UniApp 重构为标准版与租户交付版可并存的 Profile 架构，新增租户创建、切换、生成配置和同步脚本，保留集福鲤既有交付能力；补齐原生表单、列表、子表、关联表、上传、选择器、页面壳、AI 助手和业务模块等跨端组件，并以模块注册表、统一 ViewSchema、ActionSchema、指标与清单驱动标准小程序列表／详情／卡片。声明式动作不执行任意前端 V8，标准版与租户版均增加架构、路由、视图协议和交付质量校验。
- **跨端动态视图协议**：`sys_menu` 新增 `EnableViewSchema / ViewSchemaVersion / ViewConfigVersion / ViewSchema` 物理字段，支持按 Detail、Edit、List、Card 场景及 PC、Mobile、All 设备范围选择版本化布局；PC 表单引擎新增实体标题、指标条、动作区、响应式分组等渲染块，配置无效或未启用时自动回退现有模块和表单布局。MCP Manifest、模块创建／更新和升级资源同步支持该协议，并限制区块数量、嵌套深度、动作白名单、512KB 大小及可执行脚本字段，废弃继续向 `DiyConfig` 填充新配置的做法。
- **FormEngine 统一授权边界**：浏览器、PC、UniApp、第三方 SDK 与普通 HTTP 调用统一经过服务端菜单、动作、表、字段和数据范围校验；显式 `_SysMenuId / ModuleEngineKey` 必须精确绑定目标表，列表、计数和导出应用真实 `SqlWhere / SqlJoin`，新增、修改、删除、导入、导出分别校验对应权限。历史前端 V8 未传菜单时，从租户、用户、角色和授权版本共同生成的服务端快照安全推断同表菜单；无法安全合并的范围失败关闭，客户端伪造 `_InvokeType`、可信标记、角色或菜单信息均不能越权。
- **平台保护表与高级表权限**：集中维护 SaaS、用户、角色、菜单、表字段、接口引擎、数据源、任务、工作流、应用商城、AI 与审计等控制面保护表，普通角色即使拥有菜单、匿名开关或直接表权限也不能通过通用 FormEngine 访问；角色管理新增面向普通业务表的高级 `Read / Add / Edit / Del` 权限面板，为无菜单的 SDK 与定制页面提供最小授权。用户、角色、菜单和权限变更后递增共享 Redis 授权版本，各节点自动放弃旧快照；Upgrade15 幂等清理普通角色历史遗留的保护表直连授权。
- **TableChild、关联元数据与私有文件委托**：TableChild 请求由服务端重新读取父菜单、父表、字段、隐藏子菜单、外键和父记录范围，强制注入父记录外键并限制委托深度与循环，禁止伪造委托或跨父记录访问；字段批量加载以已授权主表为锚点，逐张剔除未授权关联表和保护表及其 SQL／V8 配置。私有附件和 OnlyOffice 预览同时校验菜单、记录、字段与真实文件引用，前端各上传控件、子表、详情和 Office 入口统一传递该上下文。
- **AI Schema 检索与 NL2SQL 安全**：在线 AI 默认使用“大模型关键词扩展 + 权限感知 Schema 搜索 + 精确字段回读”，旧库缺少向量字段或 `EnableVectorDatabase` 未开启时不连接 Qdrant／Ollama；显式开启后按可配置 TopK 与阈值融合关键词和向量结果，向量服务异常自动回退关键词模式。NL2SQL 的租户、用户、角色、候选表和可信标记全部由服务端生成，候选表与 FormEngine 授权取交集；执行层只允许单条只读 `SELECT`，逐个验证 FROM／JOIN 表，拒绝多语句、注释、CTE、UNION、危险函数和变量赋值，并按数据库类型追加 `MaxRows + 1` 限制、最多返回 100 行和 30 秒超时。
- **AI 向量多租户与分布式恢复**：Schema 关键词索引及向量写入、查询、精确匹配、增量同步、删除和重建均按规范化 `OsClient` 隔离；Qdrant point id 由租户与表确定性生成，HTTP／gRPC 查询强制租户 Filter，不再删除共享 Collection 或其它租户数据。Schema 与 V8 文档向量服务池只缓存成功初始化，失败后允许重试；多节点初始化、同步和重建使用带持有者令牌、续租、超时、fencing 与写入前持有权检查的 Redis 租约，避免重复副作用和丢锁后继续写入。
- **AI 领域服务与会话能力**：AI 控制器收敛为薄接口层，意图识别、聊天与流式上下文、会话标题和历史摘要、NL2SQL 授权执行、策略表选项、AI 工作流清单／图谱／详情／生成等逻辑迁入 Microi.AI；原 Microi.net `AIWorkFlowLogic` 迁移至 AI 组件，避免基础包重复承载。同步完善 OpenAI 兼容代理、用户 AI Key、订阅、订单、支付宝、模型路由、用量与额度服务，并把内置 V8／平台 Skills 扩展为可由关键词检索的独立资源集。
- **文件上传、Office 与文档安全**：新增租户级上传开关、单文件／单次总量／数量、帐号日额度和租户日额度，业务默认仍受独立绝对灾难上限、Kestrel／Multipart／Form 与反向代理限制；共享 Redis 原子预留 UTC 日额度，Redis 不可用时失败关闭，普通交互上传强制使用私有桶及 `file / img / avatar / editor` 允许目录。Excel 导入限制 20MB、5 万行和 256 列；Office／PDF 下载校验可信来源、大小、文件头和 OpenXML 包结构，OnlyOffice 私有编辑使用带 fencing、续租和仅持有者释放的 Redis 保存租约，写入稳定对象且确认仍持锁后才更新业务字段。
- **登录、Token 与 License 信任根**：登录 RSA 支持部署专属公私钥并保留历史密钥回退，弱、重复或沿用租户 Key 的 `AuthSecret` 自动更换为强随机值；Token 轮换增加同终端短暂宽限，避免多标签页并发请求因旧 Token 稍晚返回而误退出，自助修改用户资料时剔除 Token、安全版本及管理员字段。License 固定以内嵌官方 RSA 公钥为唯一信任根，外部公钥只能提供同身份副本，官方签发私钥必须反向验证对应公钥；冲突、无效、低于 RSA-2048 或任意自签身份均失败关闭，授权管理错误信息和输入长度同步收紧。
- **网络集成、采集与验证码安全**：V8.Http 与 Spider 新增可显式开启的严格 SSRF 模式，开启后拒绝非 HTTP(S)、URL 凭据、私网／链路本地／云元数据地址和重定向，并支持精确主机白名单；默认保持关闭以兼容客户内网设备与 sidecar。Spider 禁止 V8 指定浏览器可执行文件和用户数据目录，按租户与引擎隔离会话并限制总数、空闲／最长生命周期、抓包条数和响应体；验证码 OCR 绑定当前 Token 与租户，限制文件、文本、供应商响应和超时并保留人工输入回退。CORS 未配置时继续兼容多端访问，配置后按精确来源收紧，OAuth 返回地址仅允许站内相对路径或显式可信 HTTPS Origin。
- **V8 与引擎运行时稳定性**：ApiEngine、DataSource、Translate、Workflow、FormEngine 和调试会话统一服从当前 V8 租户上下文，角色策略使用精确 Id 匹配，非空畸形策略失败关闭；嵌套 `V8.ApiEngine.Run` 从服务端缓存读取原始运行配置，但只向脚本注入脱敏投影，并跳过空的全局服务端 V8，修复动态字符串绑定和空脚本求值异常。扩展数据库增加“已初始化但为空”状态，避免每次请求重复加载；V8 错误日志补充租户、引擎、事件和源码行，类型定义与文档同步补齐异步 Http／ApiEngine、DataSourceEngine、WFEngine、HDFS、Cache 等真实接口及可信调用边界。
- **控制面接口与资源保护**：接口引擎、数据源、任务、MQ／MQTT、搜索、Office、HDFS、菜单、角色、用户、系统监控、License、微服务、工作流、调试与测试等管理入口统一增加平台管理员校验，后台嵌套操作使用不可由 JSON 绑定的服务端可信参数；数据源匿名与角色策略、接口引擎角色策略均采用明确的失败关闭规则。HTTP 请求行、缓冲区、正文、Multipart 与表单值增加可配置硬上限，系统用户 Bearer 代理不再持久化上游 Token 或原始响应。
- **多节点自动升级与旧库修复**：自动升级按租户取得 Redis 分布式租约，包含唯一持有者、续租、超时、fencing、仅持有者释放及步骤间持锁检查；其它节点持锁或 Redis 暂不可用时本节点失败关闭但不把迁移误记为失败。升级步骤按四段版本严格递增并保持幂等，`sys_config.ServerVersion` 只允许条件更新向前推进且写后回读；启动前补齐旧库 `sys_apiengine` 的 StopHttp、Timeout、内存／递归／语句限制和锁字段、`diy_field.TableName`、移动端显隐及 ViewSchema 元数据，避免在安装基础应用前因缺列中断。
- **上传与 AI 增量升级步骤**：Upgrade16 为 `sys_osclients` 增加六项可空上传业务配置并保持历史默认；Upgrade17 增加 AI 角色策略模型，Upgrade18 增加可选向量开关、TopK／阈值、Embedding 与 Qdrant 配置 Tab，字段缺失、空值和 `0` 均按关闭处理。升级程序写入保护表统一走服务端可信 FormEngine，不开放给浏览器伪造。
- **官方基础资源安全同步**：表单引擎、模块引擎、应用商城、统一应用导入器、AI 应用发布器及官方资源接口六项固定资源建立 `.resource-sync-base` 共同基线，维护脚本按本地／官网／基线执行三方合并；冲突、缺少发布 Token、官网并发哈希变化或回读不一致都会阻止发布。官网写入采用白名单、`ExpectedRemoteSha256`、事务行锁及版本／内容哈希回读，运行期五项资源和 AI 构建器以内嵌资源进入程序集；在线资源任一失败时整组回退内置基线，防止新旧资源混装。
- **应用商城安装与交付资产完整性**：应用包继续区分私有源码 `SourceZip` 和公有运行产物 `BuildZip`，剥离包装目录但保留图片、字体等原始二进制；声明包含源码却缺失内容、哈希／大小不一致、写入后回读为空时停止安装。导入器修复旧库物理字段与菜单元数据，按稳定对象路径复用同哈希资产，只有全部步骤成功才推进安装版本；模块引擎基础包同步 ViewSchema 字段与表单控件，客户全局 V8 仍通过包隔离与存在性检查得到保护。
- **一键安装与可选翻译服务**：Linux 一键安装脚本升级至 2026-07-24，默认使用内置关键词 Schema 检索，不安装 Ollama、nomic-embed-text 和 Qdrant 也可使用在线 AI；选择向量增强时自动部署依赖、等待 Ollama 并下载 Embedding 模型，但不擅自开启任何租户的向量开关。新增 LibreTranslate 可选安装，支持基础、亚洲常用、全部语言及附加语言 Key，生成随机 API Key、持久化模型与密钥目录、健康检查 60 分钟失败关闭，并动态分配端口且默认不向宿主机防火墙开放内部翻译端口。
- **PC 前端授权上下文与服务不可用提示**：表单、列表、搜索、字段加载、子表、附件、OnlyOffice、导入导出和多入口导航统一传递真实菜单／模块上下文，角色管理新增高级表权限编辑；全局 API 服务状态层仅在连续健康探测失败并达到最小故障时间后显示“服务不可用”，统一覆盖主请求、页面引擎、打印引擎等入口，任一正常平台响应会取消故障态，避免单接口失败或瞬时网络抖动遮住整个应用。
- **MCP ViewSchema 与源码完整性保护**：MCP Manifest 和菜单工具支持跨端 ViewSchema，规范化声明式动作并拒绝可执行前端脚本；长接口引擎源码改为显式字符分段返回，提供完整长度、区间、下一段偏移和 SHA-256。保存接口／事件／模块代码前拦截 `tokens truncated`、`Exit code`、`Chunk ID`、`Wall time` 等 AI／终端包装文本；远端源码不少于 8000 字符且新代码突然缩短超过 15% 时要求显式确认，避免把被宿主截断的片段覆盖到服务器。
- **VS Code v4.1.5 与 Trae MCP**：插件新增 `.trae/mcp.json` 项目级配置，按 Trae 规范分别投影 stdio 的 `command / args / env` 与 HTTP 的 `url / headers`，配置生成、发现、诊断、删除、升级迁移和状态树全部覆盖 Trae；Windows 使用 VSIX 内置 `cmd.exe /d /s /c call` 启动器安全转发带空格的 Node／Electron、适配器与 MCP 路径，并通过真实 initialize、tools/list 与核心工具握手测试。插件仍明确提示 Trae 首次需开启项目级 MCP，Codex 已打开的对话需新开或重载后才会注入新增工具。
- **VS Code 模块代码同步与类型提示**：模块引擎叶子目录除行／表单／批量／页面按钮和 Tab 外，新增 `Join关联（SqlJoin）.js`、`Where条件（SqlWhere）.js` 拉取、三方差异、备份、推送和远端回读；一键同步、当前文件推送、状态树与元数据均覆盖这两类脚本，并在插件侧同步拦截源码污染。V8 typings 更新 FormEngine 信任语义、Cache Hash、异步 Http／ApiEngine、DataSourceEngine、WFEngine、HDFS、Office、上下文脱敏与提交动作等定义，构建和 VSIX 校验排除 Skills 的 Python 缓存并强制包含 Codex 适配器和 Trae 启动器。
- **官网、文档与 Skills**：官网生产构建统一从环境变量解析 API 地址，非本地站点发现 localhost 配置时回退官方 API，避免发布者本机地址进入线上包；应用商城类型与业务分类从服务端 KeyValue 动态读取并保留 URL 筛选，首页展示数量调整为 8。新增“平台安全与兼容基线”，原位补充 FormEngine、HDFS、AI、应用商城、SaaS、数据源、任务、报表、搜索、采集、翻译、V8 和安装部署文档；Skills v4.1.5 同步更新 45 个规则与数据库参考，并新增 AI、应用商城、数据源、任务、报表、搜索、翻译七类引擎 Skill 及内置 AI 资源。
- **回归测试与发布边界**：新增 FormEngine 租户／保护表／菜单范围／TableChild／元数据授权、数据源角色、Token 轮换、上传、Office、License、SSRF、Spider、AI NL2SQL、关键词／向量租户隔离、服务池恢复、租约丢失、官方资源三方同步、应用包资产、ViewSchema、MCP 源码完整性、VS Code 模块同步和 Trae 启动握手等测试。版本日志仅总结源码与配置变化，未把 `microi.mcp/dist` 等生成文件计入功能范围。

## v6.5.1 - (2026-07-23 05:43)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.5.1；Microi VS Code 插件及内置 Skills 升级至 v4.0.6，MCP 的 `dist` 编译产物不纳入功能变更说明。
- **SaaS 与 V8 租户安全边界（补记根仓库 `b90d6cd`、Microi.net `f25b465`“修复：隔离 SaaS 租户开通流程与 V8 服务”）**：V8 注入的 `OsClientModel / ClientModel / SysConfig` 统一改为独立脱敏副本，移除数据库连接、鉴权密钥、服务器端 V8 代码及 Redis、对象存储、RabbitMQ、MQTT、Search 等共享基础设施凭据；表单配置缓存、语言同步、V8 调试会话和文件能力强制绑定当前 `OsClient`，禁止由参数切换到其它租户。
- **共享基础设施命名空间与凭据隔离（补记根仓库 `b90d6cd`、Microi.net `f25b465`）**：`V8.Cache` 与 `V8.HDFS` 改为最小安全代理，缓存 Key、文件路径、RabbitMQ 队列、MQTT Topic 和搜索索引分别收敛到当前租户命名空间；MQ 消息补充稳定 `EventId` 和租户标识，MQTT 在线客户端按租户和当前节点返回。子租户缺少独立 RabbitMQ／MQTT／Search 凭据时失败关闭，不再回退主租户账号；同步新增跨租户访问、敏感投影、路径和命名空间回归测试。
- **分布式租户开通与失败补偿（补记 Microi.net `f25b465`“修复：隔离 SaaS 租户开通流程与 V8 服务”、`dc6d04e`“文档：刷新租户隔离 API 元数据”）**：SaaS 开通、归属更新和分步兼容流程增加按主租户与用户隔离的 Redis 租约，包含 fencing token、定时续租、租约丢失中止及仅持有者释放；新租户只在运行时继承白名单内的共享端点，不把主库数据库、鉴权和基础设施密钥写入子租户记录，外部服务资源未真实建立时返回明确警告并保留失败关闭。相关租户隔离 API XML 元数据同步刷新。
- **匿名系统配置安全与 GET 兼容（补记根仓库 `ce785cb`）**：匿名 `GetSysConfig` 只返回独立过滤后的前端协议字段，隐藏服务器端代码、客户端密钥及其它疑似凭据；接口允许无请求体的 GET，并继续兼容 POST JSON、查询参数和历史路由。
- **租户数据库额度（补记 Microi.net `cd382717`“新增：更新租户数据库配额管理逻辑”）**：`sys_user` 新增 `TenantDatabaseQuota`，开通前在分布式租约内按账号统计已归属租户并校验额度，个人中心接口返回总额度、已用、剩余及是否可继续创建；同一账号可按管理员充值额度创建多个独立租户，额度用完时统一阻止开通并给出明确提示，不再把“只能免费创建一个租户”写死在流程中。
- **官网 Gitee Star 开通门禁**：个人中心创建租户前先读取 Gitee Star 校验状态，未验证时展示开源支持说明并进入受信任的 `gitee.com/oauth/authorize`；租户 Key 和系统名称仅以当前用户绑定、10 分钟过期的 `sessionStorage` 草稿跨跳转保存，OAuth 返回后重新校验 Star 才继续创建。中英文文案、焦点恢复、网络／会话失效提示及额度展示同步完善。
- **AI 角色数据权限**：角色管理新增 `mci_ai_role_policy` 策略编辑，可配置启用状态、数据范围、授权业务域、可用模型、敏感字段、通用查询和附加规则；NL2SQL 在后端从当前 Token 的角色重新读取策略，仅允许“全部数据”且显式开启通用查询的角色执行，并由服务端生成业务域表白名单、校验模型和收窄客户端请求表，历史租户缺少策略表时只为平台管理员保留兼容能力。
- **AI 应用列表与开发详情拆分**：租户 AI 应用列表继续使用轻量字段查询，开发详情改为独立 `/mic-ai-app/:appId` 路由并按 `appId` 加载，旧 `workspace=apps/appId` 地址自动迁移；独立详情可自行加载模型与会话，微服务预览合并源码路由和运行态页面，并使用真实 `BuildVersion / EntryPath`。同时区分商城分类 `AppType` 与运行类型 `ApplicationType`，修复聊天区域条件模板缺失造成的空白，以及详情刷新、历史会话和多路由预览稳定性。
- **系统用户头像私有化**：`sys_user.Avatar` 上传固定使用私有桶，PC 导航、AI 对话、移动端个人中心、用户管理和表单卡片统一通过短期私有地址解析；同一路径结果短期缓存并合并并发签名请求，加载失败回退占位图，不再直接拼接公有 `FileServer`。HDFS 存储类型读取同步规避 dynamic 扩展绑定异常。
- **MCP 文件与模块写入增强**：`microi_upload_file_base64` 新增租户内精确私有路径模式，要求 `Limit=true`、文件名一致并校验路径，可在公有转私有迁移时保持数据库原路径；模块更新开放描述、卡片、分页、显隐 V8 等配置，回读比较统一规范 JSON 数组与 `DiyConfig`，若 `EditCodeShowV8` 等字段未真实持久化会返回失败而不是误报成功，并新增对应恢复性测试。
- **左右树表布局与表单体验**：模块引擎“树形+表格／表单”左树新增服务端分页、每页条数切换、关键字搜索、加载态和只接收最后一次并发结果；手机端改为右侧内容占满、左树从 88% 宽抽屉打开，节点选择后自动关闭，修复固定高度／Tab 溢出和事件来源问题。表单保存与流程按钮统一使用主色，校验错误改为控件内浮层展示，避免挤压或遮挡下一行字段。
- **登录后首页与动态路由稳定性**：登录完成和全局路由守卫会在动态菜单中验证默认首页是否真实存在且可访问，仅在目标无效时回退首个有效菜单；已有角色但动态路由尚未生成时会补建路由，避免 `/`、失效默认地址或租户切换后进入空白页。移动端旧侧栏遮罩同步移除，降低层级冲突。
- **官网应用商城与帮助中心**：应用商城桌面列表扩展为四列，UniApp／Web 预览保持完整比例，其它应用继续顶部裁切，并同步优化卡片高度与响应式断点；新增常见问题页面，说明 VS Code 内置 Copilot 与 OAICopilot 两类提交消息按钮如何配置中文、完整的 Conventional Commits 提示及大型变更分批暂存方式。
- **VS Code 多人同步保护**：直接“推送当前文件”会先按当前服务器、租户和目标资源做远端预检，只允许纯本地修改继续；服务器较新、服务器新增／删除、双方冲突、缺少基线或状态接口失败时停止覆盖。一键同步复用已验证快照并覆盖字段 V8，远端删除文件先备份再清理；状态树新增“服务器已删除”分组，全量盘点采用有限并发和节流，降低多人开发时触发限流的风险。
- **VS Code 实时同步命令**：新增 `npm run sync:status`，支持按接口／表单／模块／流程范围或单文件检查，输出不含 Token 与源码正文的 JSON 摘要，可将冲突双方保存到独立目录；只有本地修改和冲突均为 0 时，才允许携带租户确认口令执行拉取。插件 README、生成的 AI 知识库和同步回归脚本同步补齐远端新增、删除、字段 V8、失败关闭及预检约定。
- **文档、Skills 与工程约定**：官方模块引擎文档与新增 `microi-left-right-layout` Skill 补齐左右结构字段、V8 分页、MCP 幂等写入和桌面／手机验收；文件上传、UniApp、移动端质量、UI 设计和全系统交付 Skills 增加私有头像、HDFS/CDN 大资源、微信胶囊安全区、返回状态栈、真实触摸事件及多人同步规则；根仓库忽略临时 `tmp/` 目录。

## v6.5.0 - (2026-07-22 13:36)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.5.0；Microi VS Code 插件与内置 Skills 升级至 v4.0.3。
- **前端构建内存保护**：`npm run build`／`build:clean` 统一接入资源守卫，启动前检查物理内存和可用内存，现代构建默认限制 6GB Node 堆、esbuild 最多 2 个并行进程，构建期间持续监测可用内存和本次任务估算占用，触发保护线时回收完整子进程树；详细日志写入项目临时目录，分析报告只在 `build:analyze` 显式开启，并关闭日常发布中的压缩体积统计以降低末段内存峰值。
- **Chrome 49 低内存兼容构建**：旧浏览器产物由“完整现代／legacy 双图构建”改为先生成现代 ESM 包，再按真实依赖关系发现 chunk，使用独立 2GB 子进程逐文件串行转换为 Chrome 49 可用的 SystemJS／ES5 代码；自动生成 polyfill、注入 `nomodule` 回退入口，并校验 legacy chunk、依赖、HTML 入口和 polyfill 完整性，在保留旧版 Windows 7／360 极速内核兼容的同时降低 Babel AST 同时驻留造成的 OOM 风险。
- **go-view 样式构建去重**：go-view 的全局实体样式改由 `setup.js` 单次加载，Vite 向组件注入的 SCSS 只保留变量、函数、mixin 和 placeholder；过渡、毛玻璃、点阵背景等复用样式统一改用 Sass 占位选择器，避免数百个 Vue 组件重复编译整份 `style.scss`，并同步更新组件引用和开发说明。
- **构建配置稳定性**：Vite 输出目录支持通过环境变量覆盖，依赖分包路径统一按跨平台格式归一；日常构建不再默认启用可视化分析插件或 gzip 体积计算，一键编译发布脚本同步标注现代构建、legacy 串行转换及内存保护策略。

## v6.4.9 - (2026-07-22 03:03)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.4.9；Microi VS Code 插件与内置 Skills 升级至 v4.0.2。
- **V8 高级 Excel 导出**：`V8.Office.ExportExcel` 新增 `ExcelOptions` 与 `ExcelLayout`，标准表格和自由布局可在同一多 Sheet 工作簿中混用；支持 A1 区域、公式、合并单元格、行分组、列宽行高、隐藏／自动宽度、数字格式、字体背景、对齐换行、四边边框、冻结筛选、网格缩放及打印区域、纸张、页眉页脚和页码，并修复多图片字段展开后的表头合并判断。未传新参数时保持旧导出行为。
- **OnlyOffice 匿名安全预览**：`/online-office` 支持匿名只读打开当前租户的公有文件和接口引擎响应文件，匿名页面隐藏系统菜单、顶部导航及页签，URL 中的 `canEdit` 不再被当作授权依据；后端中转只接受当前平台、当前 `OsClient` 的单层 `/apiengine/{key}`，禁止重定向和任意第三方 URL，限制 50MB 并校验 Office／PDF 文件头，再按确定性路径写入当前租户公有 HDFS 并使用 Redis 共享缓存。
- **OnlyOffice 私有回源与响应文件兼容**：私有文件预览新增 `ForOfficePreview`，审计代理优先使用租户配置的公网 `ApiBase`，继续通过共享 Redis 临时票据隐藏对象存储真实签名地址；接口引擎响应文件路由补充 `HEAD`，解决浏览器可下载但远端 OnlyOffice 因拿到 localhost／内网地址或 `HEAD=405` 而提示下载失败的问题。
- **SaaS MySQL 在线备份**：新增超级管理员手动备份和固定 Quartz 任务投递能力，去重盘点已启用租户的 MySQL 数据库并串行导出表、数据、视图、触发器、存储过程、函数和事件；每库使用一致性快照，任务采用可续租 Redis 分布式租约、fencing token、仅持有者释放、取消检查和后台任务日志／进度，结果记录到 `mci_database_backup`，ZIP 计算 SHA-256 后只上传 HDFS 私有桶并按保留数量清理历史文件。当前备份引擎仅支持 MySQL，Redis 不可用时失败关闭。
- **一键安装数据库恢复增强**：安装脚本可选择官方标准空库或服务器上已上传的自定义 ZIP，严格校验压缩包完整性、单一 SQL 文件、路径穿越、解压大小和磁盘余量，使用固定临时路径安全展开且不删除用户源文件；MySQL 会按内存、物理／逻辑 CPU 和 SSD／HDD 自动生成保守配置，优化大 SQL 批量导入与依赖视图校验，并在 API／Worker 启动前暂停恢复库中的历史定时任务，避免旧环境任务立即执行。
- **前端身份与路由稳定性**：注销请求统一使用 `/api/SysUser/Logout`，不再把租户 Key 拼入控制器路由造成 404；匿名路由跳过全局用户初始化，在旧 Token 失效或动态路由初始化失败时仍允许进入受组件安全校验的公开预览页，同时只清理本次确认失效的 Token，降低并发续签误删风险。
- **文档、Skills 与 AI 提示同步**：官方中文 Office、后端 V8 和接口引擎文档补齐高级 Excel、匿名预览及 `GET/HEAD` 约定；导入导出、文件上传、接口配置、前端与工作区 Skills、Agents／Claude／Copilot／Cursor 指令及 VS Code 类型提示同步更新。构建资源规则将 6GB／20% 调整为启动规划目标、全机 95% 为硬停止线，并新增“仅明确发版时允许修改更新日志”的保护规则。

## v6.4.7 - (2026-07-20 18:37)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.4.7；本次 Microi.VSCode 子仓库无待提交代码，插件继续沿用 v4.0.1。
- **用户行为审计稳定性**：菜单访问和数据详情打开审计统一将动态结果显式转换为强类型对象及字符串，修复 `JValue.Val<T>()` 等扩展方法经动态绑定调用时可能出现的运行时异常；审计旁路增加独立异常隔离，即使审计数据异常或写入失败，也不再把原本成功的菜单、详情查询转成 HTTP 500。
- **在线终端脏数据兼容**：连接、断开、会话刷新、终端恢复和强制下线流程统一清理 Redis 历史终端列表中的空节点，避免空终端参与查找、裁剪或移除时触发空引用，并允许后续流程继续修复和保存有效终端状态。
- **异步系统日志租户兼容**：日志入队快照在未显式传入 `OsClient` 时，会从当前 Token／请求上下文补全租户标识，兼容历史 `AddSysLog` 调用方式，避免异步日志队列改造后因租户参数为空而拒绝或遗漏日志。

## v6.4.6 - (2026-07-20 18:06)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.4.6；Microi VS Code 插件与内置 Skills 按进位规则由 v3.9.6 升级至 v4.0.1。
- **可信用户行为审计**：菜单访问、数据详情打开／关闭与停留时长、表单新增／修改／删除、V8 按钮、导入导出、登录成功／失败／失效／退出、页面前后台切换及私有附件访问统一进入后端可信审计链路；日志新增 `Category / Action / Source / TargetType / TargetId / SessionId / DurationSeconds / Success / OccurredAt` 等结构化字段，用户显示统一为 `Name(Account)`，敏感字段自动脱敏和限长，前端不能伪造平台保留行为类型。
- **异步系统日志与故障恢复**：所有系统日志收口到后端有界队列，由单消费者批量、幂等写入按租户和月份拆分的 MongoDB 集合；批次写库前先生成带稳定 `MICROI_NODE_ID` 的 spool，MongoDB 暂时不可用或服务正常重启后自动重放，并按全局 `EventId` upsert 防止多节点重复。新增管理员队列健康接口及 10 万事件、双节点重复投递、MongoDB 故障和节点重启恢复压测工具；如需覆盖尚未落盘的强杀窗口，仍须使用外部持久消息队列或同步 WAL。
- **登录退出与失效恢复**：退出登录会真实吊销当前终端 Token、保留同一用户其它设备，并记录本次登录时长；登录失败和会话自然过期也形成安全审计。PC 前端扩大 `NoLogin`、Token 签名失败等身份失效识别范围，确认失败响应仍对应当前 Token 后清理本地状态，并携带原 Hash 路由完整重载登录页，避免旧动态路由残留导致空白页。
- **私有文件审计代理**：`GetPrivateFileUrl` 不再向浏览器暴露对象存储真实签名地址，而是返回存于共享 Redis、30 分钟过期的短期票据代理；后端分别记录链接签发和实际打开／下载，支持匿名转发访问、`Range` 与流式响应以及分片短时去重。代理异常时失败关闭，不回退泄露真实签名 URL；`Limit:false` 的公有文件仍可直接走 CDN／公有桶。
- **文件柜 MinIO 直连迁移**：文件同步新增 MinIO 源端／目标端，可测试连接、识别或创建私有桶和公有桶、限制租户根目录、加载文件树、全选／清空并按“重名忽略／覆盖”在当前平台与外部 MinIO 间服务端同步；直连凭据仅用于本次超级管理员会话，不写入同步记录。同步历史支持展开查看每个文件的源路径、目标路径、大小、状态和错误说明。
- **V8 代码自动版本**：表单、字段、接口引擎和工作流节点的 V8 代码保存统一由服务端比较前后内容，只有真实代码变化才写入 `mic_data_version`；版本可采用代码头较新的 `@version`，否则按语义版本进位，普通布局或非代码属性保存不再产生空版本。代码编辑器移除手工“保存当前版本”，历史预览与左右对比改用 Monaco 只读编辑器，支持行级和字符级差异及恢复。
- **表单前端 V8 稳定性**：`V8.FormSet` 兼容单个或数组字段引用，并阻止字段值变更 V8 同步执行期间再次设置当前字段造成直接递归；同时明确下拉对象赋值与 `V8.Form.字段名` 静默赋值边界。修复全屏表单中的 `V8.RefreshTable` 未继续转发到实际列表的问题，并补齐详情关闭和多入口 V8 按钮行为信号。
- **VS Code 表单事件命名兼容**：7 类表单 V8 事件名称统一与实时 `diy_field.Label` 对齐，`SubmitFormV8`／`OutFormV8` 分别规范为“前端表单提交前／提交后V8事件”，后端事件统一使用完整名称；插件拉取时兼容迁移旧的“前端表单提交／退出”“后端数据”等文件名并同步元数据，避免同一事件生成重复本地文件。
- **分布式与本地资源安全规范**：Quartz 接口引擎任务增加集群同一 JobKey 不重叠执行保护，同时继续要求业务幂等；工作区 Skills、Agents／Claude／Copilot／Cursor 指令和 VS Code 生成模板同步加入多节点租约、幂等、共享状态、滚动升级、健康检查、日志 spool，以及构建前内存检查、单重任务和 OOM 停止阈值等强制规则。
- **文档与 Skills 同步**：官方中文文档原位补充 V8 代码版本、表单事件命名、`V8.FormSet`、私有文件审计代理、系统日志 spool 和本地运行配置；前端、调试、文件上传、表单事件、性能测试、全系统交付及工作区约定 Skills 与插件内置知识库同步升级至 v4.0.1。

## v6.4.5 - (2026-07-19 20:08)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.4.5；本次 Microi.VSCode 子仓库无待提交代码，插件继续沿用 v3.9.5。
- **SaaS 租户数据库账号隔离（补记根仓库 `99a3ae8` 与 Microi.net `cb425c7`）**：MySQL 租户开通改为为每个数据库生成稳定受限账号和 32 位随机强密码，只授予当前租户库权限且不附带授权转授能力；租户连接串会彻底移除主库账号、密码及其历史别名，再写入专属凭据。其它尚未建立受控 DBA 账号契约的数据库类型采用失败关闭，禁止静默回退使用主库账号。
- **SaaS 开通权限与失败补偿**：租户开通、数据库创建、空库导入、租户归属和管理员初始化等 V8 底层原语统一限制为主租户调用，非主租户刷新配置时也只能作用于自身；数据库、专属账号、`sys_osclients`、用户归属或运行缓存任一步骤失败都会执行补偿回滚，并校验租户 Key 与数据库名严格匹配，避免半初始化租户和越界清理。官网个人中心同步改为只展示专属数据库账号与权限范围，不再向前端返回主库连接串。
- **敏感参数全链路脱敏**：Dos.ORM 新增 `AddSensitiveInParameter` 标记，普通 SQL 日志、慢 SQL 参数和可执行 SQL 展开统一以 `[REDACTED]` 隐去敏感值；SaaS 开通过程中的数据库连接串、账号密码、JWT 密钥、Redis 密码、AI API Key 和管理员密码均切换到敏感参数通道，降低诊断日志泄密风险。
- **空库脱敏发布门禁增强**：官方空库校验扩大 AI 应用残留识别范围，清理普通 Web、UniApp、MicroService、旧 AI 应用及项目数据的同时，强制保留 `microi-platform-service` 的商城主数据、微服务运行态和私有源码文件；官网租户开通统一下载规范命名的 `microi_empty_mysql57.sql.zip`，避免继续使用旧临时包名。
- **AI 应用商城发布稳定性**：内置应用商城包由 v6.5.8 升至 v6.5.12，`ai_app_publish_store` 由 v1.4.4 升至 v1.5.1；发布时可复用晚于最近成功构建的已上传 ZIP，减少大型应用同步打包引发的反向代理超时，并支持显式强制重建。微服务始终采用真实运行态 `BuildVersion`，其它应用取构建记录、调用参数、商城记录和应用记录中的最高语义版本，防止版本降级；批量补包未显式传值时继续保留预览图、分类、作者、价格、审核状态和发布路径等商城元数据。
- **安全回归测试**：新增租户账号命名、数据库级授权、主库凭据移除、非 MySQL 失败关闭、随机密码强度和敏感参数标记测试，覆盖本次 SaaS 数据库隔离与日志脱敏边界。

## v6.4.4 - (2026-07-19 15:35)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Dos.Common、Dos.ORM、Microi.Core、Microi.Upgrade 及缓存、验证码、HDFS、任务调度、消息队列、MQTT、MongoDB、Office、搜索、采集、V8、微信等服务器端公共组件统一升级至 v6.4.4；Microi VS Code 插件与内置 Skills 升级至 v3.9.5。
- **Dos.ORM 跨数据库中性架构（补记根仓库 `7ab57de` 起的遗漏提交）**：新增不可变 SQL AST，统一表达名称、类型、参数、表达式、语义函数、SELECT、INSERT／UPDATE／DELETE、DDL、数据库管理与原生 SQL 边界；编译流水线补齐规范化、校验、参数分配、绑定、能力判断、执行计划和受控原生 SQL 入口，并冻结旧公开 API 基线，保证新增架构不破坏历史调用。
- **六类数据库编译器与能力注册**：为 MySQL、SQL Server、PostgreSQL、人大金仓 KingbaseES、Oracle、达梦 DM8 建立独立能力描述、类型映射和 SQL 编译器，覆盖查询、分页、锁、DML、建表改表、数据库管理及大文本等差异；补齐 SQL Server 锁提示／`datetimeoffset`、Oracle／DM8 逻辑长文本和达梦禁用行标识符映射，并用大规模 AST、方言、边界和分配回归测试锁定行为。
- **数据库兼容能力下沉 Dos.ORM**：平台的数据库类型解析、连接字符串规范化、数据库创建／删除、字段与表结构访问、分页、标识符、空值函数、方言提示和历史 SQL 重写统一收口到 Dos.ORM；FormEngine、MCP、系统监控、动态接口和租户初始化不再分散维护 MySQL／SQL Server／Oracle 特判，移除 Oracle 专属接口路由过滤并避免配置解析静默回退。
- **多数据库空库转换与发布**：新增流式 MySQL 5.7 dump 解析、标准中性模型、确定性 SQL 输出和导入工具，可从官方空库源生成 SQL Server 2022、Oracle 19c、PostgreSQL 17、达梦 DM8、人大金仓 KingbaseES 完整结构与数据包；发布流程统一生成 MySQL 5.7、MySQL 8.0 及五个转换目标共 7 个规范 ZIP，并校验目标表数、行数与源库一致。
- **空库脱敏零残留门禁**：官方空库源更名为 `microi_empty_mysql57.sql.zip`，MySQL 8.0 使用独立规范包 `microi_empty_mysql80.sql.zip`；发布前除模板账号外，进一步检查并拒绝残留 `app_` 物理表、接口引擎、表／字段元数据、AI 应用商城记录和旧 AI 应用表数据，同时强制保留 `microi-platform-service`。一键安装脚本按所选数据库下载对应规范包，不再复用含义模糊的 `microi_empty_temp` 文件名。
- **Microi.net 数据库中立化（补记 `9ca1898`）**：租户连接、数据库创建删除、空库导入、字段补齐、表结构检查和 FormEngine CRUD 的数据库差异改由 Dos.ORM 统一处理；租户配置查询移除 `LIMIT/TOP`、反引号和 `SHOW COLUMNS` 等硬编码，并通过标准种子导入器校验核心表和数据完整性。
- **Microi.AI 数据库中立化（补记 `2650632`）**：AI 中转站账户／Token 流水改用 ORM 实体自动建表和补字段，统一表名／字段引用、空值函数与分页方言；用户 AI API Key、模型读取、额度查询及审计写入不再依赖 MySQL 语法，Token 扣减改为带余额条件的原子更新，降低并发超扣风险。
- **AI 应用构建、离线包与断点续装（补记根仓库 `dc33187`）**：应用构建器向入口页、嵌套页面和历史路径安全注入当前租户 `ApiBase/OsClient` 运行上下文并防止 XSS；SourceZip 只保留可编译源码根，BuildZip 携带全部真实编译资产并剥离构建包装目录。大型安装支持按路径、大小和哈希复用已上传源码／产物，复用文件不再重复移动，全部写完后再以 Jint 兼容方式清理旧元数据，升级器同步提高构建器、发布器、导入器和商城包能力门槛。
- **官网 AI 应用预览与广场体验**：应用详情预览 URL 自动携带版本、当前 API 地址和租户参数，避免旧缓存或错误租户上下文；AI 应用广场仅首次加载显示骨架，分页刷新时保留现有卡片并显示进度、禁用重复翻页，减少页面闪空。官网同时完善 Codex、跨数据库和分布式能力说明。
- **VS Code MCP 进程生命周期（补记 `348643c`）**：插件版本由 v3.9.1 升至 v3.9.3，并在本次发布继续升至 v3.9.5；Codex stdio 适配器在标准输入关闭、父进程退出、管道断开或收到终止信号时同步关闭子 MCP Server，设置强制回收兜底，新增生命周期回归测试，避免重载和断连后孤儿进程持续占用构建内存。
- **VS Code 文档与 AI 指令模板**：插件 README 重写为完整中文安装、AI 编程、80+ MCP 工具、多服务器、同步、调试、Playwright 和性能测试指南；插件生成的 Agents、Claude、Copilot、Cursor 知识库及 Cursor Skill 规则新增 Microi 工作进度播报规范，确保初始化或重新生成后规则不丢失。
- **官方文档质量门禁（补记根仓库 `54a4ded`）**：新增独立 VS Code 插件使用文档并修复内部开发文档、License 等失效相对链接；文档开发与构建前自动扫描全部 Markdown 页面死链，官网首页和 Skills 同步补充 Codex、六数据库能力及 AI 应用持久化必须走标准低代码建模的规则。

## v6.4.3 - (2026-07-17 12:11)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Microi.Upgrade 及服务器端公共组件统一升级至 v6.4.3；Microi VS Code 插件与内置 Skills 升级至 v3.9.1，Skills 发布版本改为直接跟随插件版本，打包时会拒绝版本不一致的资源。
- **AI应用与应用商城统一**：撤销重复的 `mci_ai_app` 主数据模型，平台应用、Web、UniApp 和微服务统一进入 `sys_microistore`；`ApplicationType / Category / PublisherType` 分别承载运行类型、业务分类和发布来源，`mci_ai_app_file / mci_ai_app_version` 仅保留私有源码与构建版本，工作台、MCP、发布、安装和文档全部切换到统一应用 Id。
- **应用商城筛选与提醒**：商城“官方应用／社区应用”合并为“AI应用”，新增应用类型、业务分类、发布来源复选筛选和搜索，继续保留我发布／我安装入口与安装版本状态；通知中心只提醒尚未安装的平台应用，不再把普通应用更新或版本异常混入平台必装提醒。
- **官网 AI 应用广场**：中英文导航新增 AI 应用入口，首页应用区改为实时读取商城接口，并新增独立应用广场和详情页；支持类型／分类／关键词筛选、服务端分页、预览图、在线预览、浏览／安装次数展示和打开详情后的浏览统计，不再维护静态应用卡片。
- **108 个可运行应用**：原规划中的 8 个行业应用已正式实现，另补充 50 个不重复的行业、工具、游戏和 UniApp 应用；当前共 108 个 Web／UniApp 应用发布到 `sys_config.FileServer` 对应公有桶，并逐个通过加载、点击交互、状态变化、控制台和截图自动化验收。
- **AI 应用工作台**：应用卡片按 12 个一页分页，创建时可选择游戏、企业、办公、教育、工具、生活、创意、数据、营销等分类；未归属应用改从统一商城读取，进入开发态时并行加载详情与更新路由，减少重复刷新等待。
- **UniApp 预览与图标**：桌面端继续显示 `Microi UniApp H5 Preview` 手机外框，手机和浏览器移动设备仿真下自动铺满并移除重复外框；全部底部菜单补齐真实 SVG 图标和可用页面切换，Skills 同步增加图标与双视口质量门禁。
- **离线包与升级基线**：统一导入器升级至 v1.5.9，AI 应用发布器升级至 v1.4.0，应用商城内置数据包升级至 v6.5.3；离线包优先携带真实编译资产，安装时按完整版本替换旧源码和旧 `dist` 元数据、保存稳定公有路径并累计去重安装次数，升级器同时校验统一字段、页面 Tab、筛选协议和资源最低版本。
- **接口引擎创建可靠性**：后端把接口路由缓存刷新限制为 3 秒，数据库已经创建成功时通过 `CacheRefresh` 单独报告缓存状态，不再把缓存超时伪装成创建失败；MCP 为恢复性回读增加独立短超时，并让 `microi_create_engine` 与代码、事件、菜单写入一样执行远端回读确认，传输中断但实际落库时返回 `RecoveredAfterTransportError`，避免重复创建。
- **MCP 中文主机名兼容**：设备标识 `did / MICROI_MCP_DID` 统一规范化为最长 128 字符的稳定可打印 ASCII，英文主机名继续保留原终端身份，中文、控制字符和超长主机名使用哈希后缀；插件会自动生成／迁移配置，并在 `ByteString` 错误中明确区分真实 Header 与只用于显示的 `MICROI_LABEL_BASE64`。
- **VS Code 资源树与微服务目录**：尚未拉取代码的服务器也会显示虚拟租户节点和 AI 应用入口；配置目录名变化时会复用唯一匹配的现有 `OsClient.Product/Internal` 目录，避免同一租户重复生成目录，并补充 MCP DID、应用同步、版本一致性和诊断回归测试。
- **PC 端历史兼容与按钮样式**：恢复 Vue3 全局 `OpenIframe` 兼容入口，旧打印弹窗自动转交当前打印引擎，普通 URL 继续使用 iframe，并修正历史 `http:/`、`https:/` 单斜杠地址；表格更多按钮重新读取配置样式，保留历史菜单缓存和客户按钮的显示效果。
- **官网账号与个人中心体验**：官网固定使用统一主流视觉并移除旧风格切换，登录页保留顶部导航；登录流程聚焦账号密码，支持记住账号／浏览器凭据、图形验证码加短信验证的安全找回密码以及登录后直接跳转，个人中心侧栏新增 AI Token 余额和使用进度，暗色模式同步完善。
- **文档、Skills 与 AI 指令同步**：应用商城、微服务、PC 前端、UniApp、移动端质量和 UI 规范同步更新；根目录 Copilot、Cursor、Claude、Agents 指令新增 MCP 连接证据链、短超时回读和 `ByteString` 排查规则，确保插件重新生成后不会丢失本次约束。

## v6.4.1 - (2026-07-16 19:49)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Microi.Upgrade 及服务器端公共组件统一升级至 v6.4.1；Microi VS Code 插件与内置 Skills 升级至 v3.8.2，并同步更新程序集、NuGet 包、客户端及 Skills 发布元数据。
- **Windows 7 与旧浏览器兼容**：PC 前端增加 Chrome 49／旧版 360 极速内核可加载的 SystemJS legacy 构建和 AbortController 等兼容能力，移除聊天、显隐规则、公式编辑器及 Monaco 中旧内核不支持的正则后行断言和特殊展开语法；明确 Node.js 构建版本并避免 legacy 分包循环依赖。
- **前端启动白屏诊断**：Loading 不再到 100% 后直接消失，而是等待 Vue 应用真实挂载；脚本未启动时会保留加载页并展示浏览器内核、启动错误、强制刷新／升级浏览器建议和重新加载入口，同时加强旧 WebView 页面滚动解锁。
- **微服务旧路由兼容**：`microi.routes.json` 的 `LegacyMenuUrls/LegacyComponentPaths` 支持路由顶层、`meta`、camelCase 和 PascalCase 多种历史写法；前端把原菜单 URL、稳定 `MsKey` 路由和历史服务 `Id` 路由注册为同一宿主页面，安装器重复执行时恢复已绑定菜单的旧 URL，不再覆盖客户菜单和既有书签。
- **历史定制组件微服务接管**：表单字段配置仍引用旧 Vue `DevComponentPath`、但当前前端已无本地组件源码时，可根据已安装微服务页面的 `LegacyComponentPaths` 自动解析并通过隔离 iframe 承载；透传表单上下文，支持组件高度回传和自定义事件，离线应用包安装后无需逐租户重写字段配置。
- **应用商城离线包稳定性**：AI 应用发布器升级至 v1.1.6，大型自包含源码包默认只返回文件内容和摘要，不再同时序列化一份重复的完整 `Package` 对象，降低数百 MB 级响应的内存占用；升级器统一补齐 1 小时超时、语句数、内存、递归和分布式锁运行参数。
- **应用安装与菜单恢复**：统一应用导入器升级至 v1.4.2，规范化 `RouteMetaJson` 与路由顶层元数据，安装后同时按旧地址和既有微服务绑定回查菜单，去重后恢复历史 URL；升级基线增加版本、标记和跨 MySQL／SQL Server 运行参数校验，避免旧资源或不完整配置覆盖客户数据库。
- **SaaS 扩展数据库隔离**：Microi.net 修复子租户初始化 `V8.Dbs.{DbKey}` 时误读取主租户 `microi_database` 配置的问题；主租户继续复用当前连接，子租户改为在自身数据库会话就绪后延迟加载，空缓存也允许重新读取，避免已配置扩展库长期显示 `undefined`。
- **MCP 写入可靠性**：MCP 客户端为普通请求和 V8／菜单写请求增加独立超时；保存接口引擎、表单 V8 事件和菜单模块后统一远端回读校验，网络断开或超时但实际已落库时返回 `RecoveredAfterTransportError`，回读不一致则明确报告结果不确定，阻止重复写入或绕过标准工具改走 SQL。
- **Codex MCP 单入口兼容**：新增 `microi_codex` 调度器，支持工具搜索、参数说明和调用全部原始 `microi_*` 能力，继续复用原工具的参数校验、确认口令、审计及回读保护；同时提供 `microi://codex/status`、`microi://codex/tools` 和资源模板调用通道，兼容 Codex 大工具集未注入或只暴露资源的会话。
- **MCP 配置与诊断**：中文服务器显示名改用 `MICROI_LABEL_BASE64` 安全传输，Codex 配置固定启用单入口工具和自动审批模式，并优先探测可靠的 `codex.exe`；插件诊断从 `initialize + tools/list` 扩展为真实调用 `microi_get_status`，并检查接口代码保存、菜单读取／更新等核心工具是否可用。
- **VS Code 通知与日志**：插件右下角信息、警告、错误及操作按钮选择统一写入【输出 → Microi 吾码】，日志改用电脑本地时区；后台静默状态探测不再输出预期网络错误，用户主动操作失败则保留错误码、系统调用、地址、端口和聚合错误明细。
- **表单页面路由默认值**：全屏新增／编辑页面支持从路由 `DefaultValues` 读取 JSON 或 URL 编码 JSON，并在同组件路由切换时重新解析，避免 KeepAlive 页面沿用上一次默认值。
- **官网主流／经典双风格**：官网、登录页、个人中心和文档页新增默认“主流”企业风格，保留原 3D 科技风格为“经典”并支持持久切换；完善明暗模式、首页可信度数据、桌面／移动端响应式布局，同时清理无法长期验证的“99% 准确率”宣传表述。
- **吾码小龙虾账号桥接**：官网登录页和个人中心增加仅允许本机 `localhost` 指定端口范围、随机通道握手的 OpenClaw 账号状态桥接；只有受信父窗口主动请求后才返回当前登录态和 AI 额度，未握手的 ready 消息不携带 Token。
- **VS Code 同步工作台（补记 `88d920e`）**：前端微服务源码统一进入租户 `AI应用/{appKey}` 目录，构建发布前先同步完整私有源码；新增三方同步基线、冲突／服务器较新／本地未推送分组和持久“同步结果”树，接口、表单、字段、模块按钮、流程及微服务均可按范围查看差异；远端 Key 使用可逆文件名编码，单文件失败不再中断整服务器拉取。
- **Skills 同步规范（补记 `aade7bd`）**：Skills v3.7.5 补齐前端微服务统一目录、私有源码先同步后发布、三方差异比较、持久同步结果、Windows 安全文件名和分类型容错拉取规则；本次继续同步 `V8.Cache.KeyExist`、旧运行时 SQL 时间函数、MCP 写入超时／Codex 资源降级及 VS Code 输出日志规范。

## v6.4.0 - (2026-07-15 17:01)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Microi.Upgrade 及服务器端公共组件统一升级至 v6.4.0；Microi VS Code 插件与内置 Skills 升级至 v3.7.1，并同步刷新空数据库模板和各项目程序集、NuGet 包、客户端版本信息。
- **一键安装主租户配置**：安装脚本新增主租户 `OsClient` 输入与格式校验，自动同步 `sys_osclients.OsClient/ClientName`、API／Web 容器环境变量和最终访问地址；MySQL 5.7／8.0 选择改为输入 `5`／`8`，减少首次安装配置歧义。
- **MinIO 自动初始化**：安装流程会等待 MinIO 健康就绪，按 CPU 架构下载官方 `mc` 客户端，自动创建私有桶 `mci-private` 和公有桶 `mci-public`、开放公有桶匿名下载，并把端点、密钥、桶名、网络模式写回当前租户 `sys_osclients`。
- **安装后地址自校准**：根据安装时选择的访问 IP 和实际端口自动更新 `sys_config.ApiBase` 与 `FileServer`，避免空库模板继续指向官方服务；Watchtower 固定兼容 Docker API 版本，文档补充只更新 API／Web 容器且不删除数据库和数据卷的一键命令。
- **移动端菜单显隐保护**：修复 `sys_menu` 部分更新时未传字段被默认值 `0` 覆盖的问题，新增菜单默认同时开启 `Display/AppDisplay`；旧库升级改为幂等补列和空值归一，升级前后快照恢复客户已有 `AppDisplay`，应用包更新既有菜单时也保留桌面端与移动端显隐配置。
- **移动工作台兼容**：移动端菜单仅在 `AppDisplay` 明确为 `0`、`"0"` 或 `false` 时隐藏，历史 `NULL`、未配置和空值继续按可见处理，避免旧租户升级后整棵工作台菜单消失；新增显隐边界回归测试。
- **角色菜单权限保存**：修复角色编辑中勾选叶子菜单后当前行 `_Check` 未同步，导致保存、刷新或重新打开时权限丢失的问题；统一递归更新父子菜单、默认权限与自定义按钮权限，并去重重复按钮 Id，新增父子菜单保存回归测试。
- **表单分页稳定性**：当模块默认排序未包含唯一主键时自动追加 `Id ASC` 作为稳定排序兜底，解决大量相同 `Sort` 值下 OFFSET 分页重复、遗漏，以及树形“加载更多”无法达到 `DataCount` 的问题。
- **主租户数据库配置恢复**：主租户数据库连接优先使用当前进程环境变量和 `appsettings`，从 Redis 恢复 SaaS 配置时保留本机 `DbConn/DbReadConn/DbType`；自动升级统一通过运行时租户对象解析连接，避免主租户 `sys_osclients.DbConn` 留空时被错误跳过。
- **应用商城自包含离线包**：AI 应用发布器升级至 v1.1.5，`PackageOnly`、离线下载和工作台制作离线包均内嵌最新运行产物；“同时发布源码”状态写入包元数据，勾选后若没有真实私有源码会立即停止生成，避免交付出只有声明没有内容的离线包。
- **应用安装完整性校验**：统一应用导入器升级至 v1.4.1，校验源码、编译产物及其内嵌内容；声明包含源码时采用失败关闭策略，写入目标租户私有 HDFS 后回读 `mci_ai_app_file`，回读为空即停止安装，同时保留未携带源码应用原有的 `PrivateSourcePath`。
- **微服务菜单跨服务器迁移**：安装器支持根据 `LegacyMenuUrls/LegacyComponentPaths` 把目标端历史菜单迁移到 `/micro-app/host`，使用稳定 `MsKey` 生成 `/micro-app/{MsKey}/{route}` 并补齐服务、页面和路由绑定；在原开发服务器重复制作或安装时保留仍可运行的原生组件菜单，不再破坏现有入口。
- **微服务路由兼容**：VS Code 插件同步 `microi.routes.json` 时保留路由顶层或 `meta` 中的 `LegacyMenuUrls/LegacyComponentPaths`；前端把旧菜单 URL、稳定 `MsKey` 路由和历史服务 `Id` 路由注册为同一宿主页面，后端资源路由同时按 `MsKey` 或 `Id` 查找，菜单无需强制改址且新旧书签可以并存。
- **AI 应用工作台稳定性**：以路由监听作为开发工作台唯一加载入口，并增加跨 KeepAlive 实例的路由协调，避免点击应用和 query 更新造成详情、页面及微应用 iframe 二次刷新；制作离线包时明确请求携带私有源码。
- **基础应用升级守护**：升级器提高应用导入器和 AI 发布器基线校验，优先安装应用商城，再安装表单引擎、模块引擎等资源；自动修复平台打包接口对客户全局 `DateNow` 或受限 `System.IO` 的依赖，改用局部时间回退和受控 ZIP 能力，且不覆盖客户全局 V8。
- **VS Code 认证恢复**：插件区分 Token 过期与“租户不存在／未启用”等连接配置错误，后者不再反复刷新 Token 或静默重登；登录前系统配置请求禁用身份恢复，并按服务器／租户增加恢复互斥门，阻止恢复回调递归进入自身，新增真实 HTTP 回归测试并纳入 `npm test`。
- **VS Code 通知与日志**：插件全部右下角信息、警告和错误通知同步写入【输出 → Microi 吾码】，操作按钮选择也会留痕；时间戳改用电脑本地时区，后台静默 `GetStatus` 探测不再反复输出空错误，用户主动请求失败时补齐错误码、地址、端口和聚合错误明细。
- **文档与 Skills**：官网首页和仓库 README 增加更新日志入口；完善一键安装、MinIO、在线应用离线交付、微服务菜单迁移和旧库升级保护文档，并同步更新 PC 前端、文件上传和全系统交付 Skills。

## v6.3.6 - (2026-07-15 03:29)

- **版本发布**：Microi.Client、Microi.net、Microi.AI 及服务器端公共组件统一升级至 v6.3.6；同步更新程序集、NuGet 包和客户端版本信息。
- **Redis 管理器**：新增独立路由 `#/mci-redis-manager`，采用连接／数据库树、Key 空间树、SCAN 列表和内容编辑器三栏布局；支持服务器与内存统计、模式检索、分页加载、类型／TTL／内存查看、单个与批量删除、重命名、TTL 设置，以及 String、Hash、List、Set、Sorted Set 内容维护，Stream 提供分页只读查看。
- **Redis 紧急恢复模式**：已登录超级管理员可使用当前租户 Redis 和按租户隔离的已保存连接；未登录时仅允许建立不落盘的临时连接，刷新页面即清除凭据，便于登录缓存异常时排查和恢复。登录失效后管理页会自动切换为临时连接模式，不再强制跳转登录页。
- **Redis 安全与审计**：后端只开放明确的 Redis 白名单操作，Key 列表统一使用非阻塞 `SCAN`，限制连接超时、数据库范围、分页数量、批量删除数量和匿名访问频率；已保存密码后端加密且永不回传，错误信息自动脱敏，删除、写入、重命名和 TTL 变更记录系统审计，不开放任意命令、Lua、`FLUSHALL` 或 `FLUSHDB`。
- **Redis MCP 工具**：新增 `microi_redis_statistics`、`microi_redis_list_keys`、`microi_redis_get_key`、`microi_redis_delete_keys`、`microi_redis_replace_value`、`microi_redis_rename_key`、`microi_redis_set_ttl` 七项工具；默认绑定当前 MCP 租户，写操作提供 dry-run 摘要并要求 `confirmExecution`，同时前置到 MCP 核心工具发现顺序。
- **多租户授权管理**：授权页改为由本机受保护接口统一读取和操作。主租户可提交申请、重新验证、下载和部署 License，子租户可查看同一服务器的完整授权状态与节点信息但保持只读；License 文件写入不再允许匿名调用，避免子租户或未登录请求修改服务器级授权。
- **授权状态可观测性**：授权页新增联系人、联系电话、更新服务到期时间、License 格式版本、在线 AI 授权、当前／主租户、授权组件版本和 Microi.AI 版本，并补充服务器 IP、授权到期时间等节点信息；`Microi.net` 统一从环境变量、应用配置和默认配置解析主租户，节点查询仅返回页面所需的非敏感字段。
- **Token 失效诊断**：后端新增结构化 `TokenAuthDiagnostic`，统一识别 Token 缺失、格式错误、声明缺失、租户不匹配、安全版本变化、JWT／终端会话过期、服务端会话丢失和 Token 被替换等原因；1001 响应通过 `DataAppend` 返回原因码、终端、租户和过期时长，并向用户展示分钟／小时／天级的明确说明。
- **登录续签与休眠恢复**：PC 前端不再固定每 15 分钟续签，而是根据 JWT `exp` 与 `MicroiTokenIssuedAt` 计算提前量；浏览器标签页在 `visibilitychange`、`focus`、`pageshow` 恢复时立即检查续签，并保护多标签页的新 Token 不被旧请求覆盖或误清。
- **统一前端会话协议**：通用前端 SDK 与 UniApp 增加稳定 `did`、准确 `_ClientType`、JWT 解析、single-flight RefreshToken、前台恢复续签和定时维护接口；UniApp 在 `App.onShow` 恢复会话，登录失效时先用模态框完整展示后端诊断，再跳转登录页。
- **VS Code 认证恢复**：Microi VS Code 插件支持解析后端 `DataAppend.ReasonCode`，窗口重新获得焦点时立即维护所有服务器 Token；自动重登录失败时显示经过一分钟去重的明确过期提示，并把 Redis 核心工具加入 MCP 可调用性诊断清单。
- **安装脚本 MySQL 选型**：一键安装脚本升级至 v2026-07-15，安装前可选择 MySQL 5.7 或 8.0，分别生成兼容的配置、容器名、镜像和远程授权 SQL，并按服务器内存补充 Buffer Pool 实例数、I/O Capacity 等性能参数。
- **Docker 固定网段**：安装脚本可选创建统一的 `microi` bridge 网络，严格校验 IPv4 subnet／gateway 和网络地址范围；已存在同名网络时仅在配置完全一致时复用，不一致则安全退出，不自动删除或修改现有网络，所有独立 Compose 编排可统一通过 external network 接入。
- **文档与 Skills**：补充 SaaS 引擎 Redis 管理器文档，并同步完善缓存、安全、PC 前端、UniApp、移动端质量和通用前端 SDK Skills，统一终端类型、设备标识、续签时机、租户边界、失效提示及 Redis 管理规范。

## v6.3.5 - (2026-07-14 17:06)

- **版本发布**：Microi.Client、Microi.net、Microi.AI、Microi.Upgrade 及服务器端公共组件统一升级至 v6.3.5；Microi VS Code 插件升级至 v3.6.5，并同步更新 Skills 发布元数据。
- **旧库自动升级**：重构服务器端升级流水线，任一步骤失败后立即停止后续迁移，并禁止错误推进 `sys_config.ServerVersion`；启动时额外幂等修复 `AuthSecret`、前端微服务所需字段及超级管理员 `Level=9999`，删除不再执行的旧 `UpgradeSysMenu` 步骤。
- **离线升级基线**：`Microi.Upgrade` 重新内置表单引擎、模块引擎、应用商城、统一应用导入器和 AI 应用发布器五项基础资源。在线资源只有整组下载并校验成功后才使用，客户服务器不通外网时自动整组回退到程序集内置基线，避免新旧资源混装。
- **官方应用源保护**：基础应用升级通过 `Microi.net` 私钥能力与 `OsClient=iTdos` 双重条件识别吾码官方应用源，仅官方源跳过基础包回写；客户即使使用相同租户名也会正常执行升级，不需要配置额外环境变量。
- **应用商城自愈**：升级器不再只相信全局版本号，而是检查导入器版本、AI 应用发布器、表单元数据、应用商城菜单、关联模块、页面多 Tab 和管理员权限；发现缺失后自动补齐，并支持重复启动安全重试。
- **应用安装稳定性**：统一应用导入器升级至 v1.3.4，普通应用和 AI 应用共用安装协议，补充 MySQL 死锁／锁等待／超时重试、失败时不写成功版本、源码与编译产物安装、后台任务进度以及旧库缺少 `DateNow` 时的兼容处理；同一租户的应用安装任务改为串行队列，降低并发 DDL 和元数据写入死锁。
- **离线包交付**：应用商城“安装离线包”改为带文件选择、格式校验、包类型、名称、版本和大小说明的弹层；优先打开统一离线安装微服务页面，老库则自动回退到内置上传弹层，安装继续使用后台任务并支持普通应用、Web、UniApp 和前端微服务。
- **接口引擎分类保护**：安装“接口引擎”应用时，仅当目标库已有两个及以上页面 Tab 才保留客户自定义分类；空值、空数组或单个 Tab 继续使用官方数据包配置，避免覆盖真实的多分类 V8 按钮，也避免残缺旧配置阻断升级。
- **页面多 Tab 关联模块**：新增通用 `PageTabs.TargetSysMenuId` 配置，JSON 表格列可复用真实字段的数据源。点击关联模块后替换当前路由并按目标模块的 `sys_menu / diy_table / diy_field` 完整重建；应用商城据此由一个官网模块和两个租户本地隐藏模块组成“官方应用、社区应用、我发布的应用、我安装的应用”，前端不再为不同表写死数据源分支。
- **角色权限性能**：角色编辑中的菜单权限明细由完整 `el-table` 树改为按展开状态渲染的轻量递归组件，并预构建父菜单索引，避免勾选深层菜单时反复扫描整棵树，显著缩短大型菜单库中选择权限的卡顿时间。
- **前端微服务兼容**：模块菜单接口支持根据微服务页面 `RouteMetaJson` 中的旧 URL／旧组件路径，瞬时映射历史 Vue2 菜单到新版前端微服务，不直接修改客户 `sys_menu`；微服务宿主和弹窗使用 iframe 隔离运行，并兼容友好路由、旧菜单路由和 `MsKey` 元数据。
- **AI 应用工作台**：进入应用开发时将 `appId` 写入路由，刷新或分享地址后可恢复目标应用；不再自动调用老租户可能缺失的编译文件接口，并明确区分“未携带私有源码”和“只有已发布运行产物”，避免出现“获取下载项失败: undefined”。
- **VS Code 微服务拉取**：前端微服务统一使用与 V8 引擎相同的“服务器／租户”目录隔离规则；新增“拉取服务器前端微服务”命令，通过应用列表和应用上下文接口下载私有源码，校验路径越界与缺失内容，兼容显示旧版平铺目录，并将 MCP Server 名中的连字符统一转换为下划线以适配 Claude、Codex 等客户端。
- **跨租户登录修复**：同域切换 `OsClient` 时，如果菜单接口明确返回 `NoLogin`、1001 或 1002，前端会清理残留租户 Token 并跳转登录页，不再停留在空白页面；普通路由构建异常仍保留原登录状态。
- **MCP 老库兼容**：接口引擎列表和详情读取改为安全的 `JObject` 字段访问，老数据库缺少 `Category`、`Version`、`ChangeHistory` 等字段时使用默认值，不再抛出 `FastExpando does not contain a definition for Category`；MCP 的菜单按钮校验同步支持关联模块字段。
- **AI 初始化容错**：Microi.AI 对 Qdrant 端口、Embedding 地址和超时配置改为安全解析；向量服务配置为空或不完整时记录提示并跳过 Schema 初始化，消除空字符串转换异常和 AI 插件启动失败日志。
- **官方私钥发现**：Microi.net 的 `LicenseService` 增加源码工作区私钥路径发现，统一判断本地官方服务能力，客户 NuGet 和发布包因不包含私钥不会被误识别为官方应用源。
- **其它修复**：修复任务调度升级脚本中 `V8.Http.Post` 的 `PostParam` 语法错误；完善后台任务通知、应用商城、模块引擎、前端微服务和 V8 客户端文档；重写完整历史更新日志并补充对应 Microi Skills 规范。

- 版本发布：v6.3.5 更新日期为 2026-07-14（commit c75fc9a1）
- Microi.VSCode：新增：更新版本号至 3.6.5，新增拉取服务器前端微服务功能及相关命令（commit 80e72cd）
- Microi.AI：新增：更新版本号至6.3.5，优化AI配置解析逻辑，增加配置获取方法（commit 24f4670）
- Microi.net：新增：更新版本号至6.3.5，优化私钥搜索路径逻辑（commit 617ca86）

## v6.3.4 - (2026-07-13 19:31)

- 新增：Word 文档导出支持动态内容（commit d4aec76a）
- 新增：更新版本至3.5.9，并修改更新时间（commit 170fcade）

- Microi.VSCode：新增：更新版本号至 3.5.6，新增 V8Http 请求参数接口及导出功能（commit 62bead7）
- Microi.AI：新增：更新版本号至6.3.4，完善V8.Http API文档，添加PATCH请求示例（commit 663a7bd）
- Microi.net：新增：更新版本号至6.3.4，修复License节点信息更新和查询逻辑（commit 84ef09b）
- Microi.VSCode：新增：更新版本号至 3.5.9，优化本地路径比较函数及相关逻辑（commit f8b4a09）

## v6.3.3 - (2026-07-13 15:52)

- 新增：版本升级至 6.3.3，并内置 Noto Sans CJK SC 字体（commit 4ec17728）

## v6.3.2 - (2026-07-13 15:08)

- 新增：增强字体处理逻辑，支持缺失字形自动回退并返回明确错误信息（commit 40c69563）
- 新增：更新版本至3.5.3，并完善SKILL.md中的ApiKey配置说明（commit b5669ff7）
- 新增：更新多个组件版本至6.3.2（commit 39c40be5）

- Microi.VSCode：新增：更新版本号至 3.5.3（commit 73578d2）
- Microi.net：新增：更新版本号至6.3.2，修复版本信息以保持一致性（commit c6ba27f）
- Microi.AI：新增：更新版本号至6.3.2（commit 7adcedd）

## v6.3.1 - (2026-07-13 11:33)

- 新增：更新版本至 3.4.7 在 .microi-skills-version.json（commit 4240cc1e）
- 新增：更新多个组件的样式以支持响应式布局，并修复弹窗数据传递逻辑（commit 8e6757dc）
- 新增：更新多个组件版本至6.3.1，并优化数据库导出导入逻辑，增加导入过程中的提示信息（commit ce045710）

- Microi.VSCode：新增：更新版本号至 3.4.6（commit d1c5142）
- Microi.net：新增：更新版本号至6.3.1，增强MySQL数据库导入功能，优化CDN下载逻辑（commit 26dd8f3）
- Microi.AI：新增：更新版本号至6.3.1（commit 86b9c2c）

## v6.3.0 - (2026-07-13 08:09)

- 新增：更新版本至 6.3.0 用于 Microi.V8Engine，Microi.WeChat 软件包（commit 192db234）

- Microi.AI：新增：更新版本号至6.3.0，添加PromptPreview字段，优化Token使用记录逻辑（commit 3201859）
- Microi.net：新增：更新版本号至6.3.0，新增后台任务接口和功能授权提供器，增强系统扩展性（commit 8c4acf1）

## v6.2.9 - (2026-07-13 05:05)

- 更新版本至 6.2.9 （多个 Microi 组件），新增 new EmptyDatabaseReleaseService 用于 脱敏数据库创建（commit 2638c9d4）

- Microi.AI：新增：更新版本号至6.2.9，重构AI授权验证逻辑，优化License管理（commit 039551c）

## v6.2.8 - (2026-07-13 04:06)

- 新增：更新版本至 6.2.8 （Microi 组件），更新 后台任务 API engine（commit 926b221f）

- Microi.AI：新增：更新版本号至6.2.8，添加在线AI授权验证功能（commit ebeb0f6）
- Microi.VSCode：新增：更新版本号至 3.4.5（commit 6ecf34e）

## v6.2.6 - (2026-07-13 02:52)

- 工程维护：更新版本至 6.2.6 （Microi 组件），更新 相关 文档（commit 1c7767b3）

- Microi.net：新增：更新版本号至6.2.6，新增License文件刷新功能以支持动态授权验证（commit f75703a）

## v6.3.4 - (2026-07-13)

- Microi.VSCode：新增：更新版本号至 3.5.2，优化 MCP 运行时配置以支持独立 Node 和 Electron（commit f60dc3f）

## v6.2.5 - (2026-07-12 20:41)

- Microi.AI：新增：更新版本号至6.2.5，增强中转模型支持与令牌管理功能（commit 1395f5b）
- Microi.net：新增：更新版本号至6.2.5，新增AI API密钥参数以增强租户系统配置初始化功能（commit ed3f179）

## v6.2.4 - (2026-07-12 14:16)

- 新增：增强 界面引擎 并 嵌套渲染，independent state 管理（commit a1eee08f）
- 新增：更新 Microi 组件版本至 6.2.4，增强 弹窗样式（commit e7dca905）

- Microi.VSCode：新增：更新版本号至 3.3.9，优化 MCP 配置以使用 process.execPath 代替硬编码的 node 命令（commit da48941）
- Microi.net：新增：更新版本号至6.2.4，新增创建和提取ZIP文件的方法，增强文件处理能力（commit 59839bb）

## v6.2.2 - (2026-07-12 01:19)

- 新增：Microi.V8Engine 与 Microi.WeChat 升级至 6.2.2；AiController 增加 ReasoningEffort 参数；更新 SysUserController 的 Token 处理；完善界面引擎与 UI 设计技能文档；在 v8-security 中实现用户退出登录（commit 2a6d1a69）

- Microi.net：新增：更新版本号至6.2.2，新增清除用户登录信息的方法，增强安全性（commit 153d59c）
- Microi.AI：新增：更新版本号至6.2.2，添加推理强度选项支持（commit 1a40cf4）
- Microi.VSCode：新增：更新版本号至 3.3.3，新增清除用户登录信息功能，优化在线应用规则（commit 12b2f85）

## v6.2.5 - (2026-07-12)

- 新增：单行文本字段支持插槽按钮，并增强用户资料组件（commit 505080cf）
- Microi.VSCode：新增：更新版本号至 3.4.1，新增路由项的 sourceFile 属性以支持文件来源信息（commit 09247fa）

## v6.2.1 - (2026-07-11 17:48)

- Microi.net：新增：更新版本号至6.2.1，移除后台任务运行时桥接相关代码，优化JWT AuthSecret提示信息（commit 0a02b69）
- Microi.AI：新增：更新版本号至6.2.1（commit 99ba92a）

## v6.2.1 - (2026-07-11)

- 新增：新增 ai-app-publish-store 脚本 用于 统一应用打包（commit a2a9fc2e）
- Microi.VSCode：新增：更新版本号至 3.2.8，增强微服务源码同步功能，支持自动上传项目源码至在线 AI 应用（commit d637542）

## v6.2.0 - (2026-07-10 14:31)

- Microi.net：新增：更新版本号至6.2.0，增强JWT AuthSecret生成与持久化逻辑（commit d0fe887）
- Microi.AI：新增：更新版本号至6.2.0（commit 68c865b）

## v6.1.9 - (2026-07-10 12:07)

- Microi.net：新增：更新版本号至6.1.9，增强后台任务进度更新逻辑，支持当前和总进度参数（commit 3d40096）
- Microi.AI：新增：更新版本号至6.1.9（commit 9cf1d4d）

## v6.2.0 - (2026-07-10)

- 新增：增强后台任务进度上报和文件同步弹窗（commit a96bf8ff）
- 新增：新增 v8-image-processing skill 文档，API 参考（commit 7289e3eb）
- 新增：新增 脚本 至 生成 Microi 解决方案报价 在 DOCX 格式（commit b65b4d68）
- Microi.VSCode：新增：更新版本号至 3.2.5，增强 API 客户端和认证管理器以支持更灵活的 token 维护和刷新机制（commit 5406d99）

## v6.1.8 - (2026-07-09 17:36)

- 新增：更新 Microi 组件版本至 6.1.8，增强 token 处理（commit aa4e0d31）

- Microi.VSCode：新增：更新版本号至 3.2.3，优化 API 客户端和认证管理器以支持更灵活的 token 管理和刷新机制（commit 4068440）

## v6.1.7 - (2026-07-09 16:38)

- 新增：更新版本至 3.2.2，并修改更新时间（commit b09874ef）
- 更新版本至 6.1.7 用于 Microi.V8Engine，Microi.WeChat; 更新 SKILL.md 以包含 移动端页面 源码路径（commit a6b9e20a）

## v6.1.6 - (2026-07-09 12:11)

- 新增：新增 默认 RSA 公开 key，device ID 至 MicroiClient（commit 1d36f7b5）
- 新增：更新多个组件版本至 6.1.6，并添加默认登录 RSA 私钥配置（commit 8e156342）

- Microi.VSCode：新增：更新版本号至 3.2.1，增强 API 客户端和认证管理器以支持 RSA 公钥登录及认证恢复处理（commit 7ea6a5d）

## v6.1.5 - (2026-07-09 07:45)

- 新增：增强 JWT Token 处理和在线终端管理（commit 7d6d143b）
- 新增：更新 MicroiClient 的 RSA 公钥处理并优化登录流程（commit 3d1cc2b4）
- 新增：更新多个组件版本至 6.1.5，增强 JSON 表格配置文档（commit 8c915939）

- Microi.VSCode：新增：更新版本号至 3.1.6（commit bc66a58）
- Microi.VSCode：新增：更新版本号至 3.2.0，增强 API 客户端和认证管理器以支持 RSA 公钥登录及请求体格式化（commit 06690d5）

## v6.1.4 - (2026-07-09 05:18)

- Microi.AI：新增：更新版本号至6.1.4（commit c211c06）
- Microi.net：新增：更新版本号至6.1.4，增强接口启用状态检查逻辑（commit c2781f7）

## v6.1.3 - (2026-07-09 01:26)

- Microi.net：新增：更新版本号至6.1.3，增强JWT AuthSecret轮换逻辑，支持安全版本升级（commit 04a9dca）
- Microi.AI：新增：更新版本号至6.1.3（commit da1dc89）

## v6.1.1 - (2026-07-09 00:03)

- 更新版本至 6.1.1 （多个 Microi 组件），增强 development 登录绕过 功能（commit c9d1a952）

- Microi.net：新增：更新版本号至6.1.1，增强OsClient配置处理逻辑，确保强JWT AuthSecret生成与存储（commit a6cfbfe）
- Microi.AI：新增：更新版本号至6.1.1（commit c533e7a）
- Microi.VSCode：新增：更新版本号至 3.1.4（commit 8dd9247）

## v6.1.1 - (2026-07-08)

- 新增：新增 一键编排 脚本，增强 installation 流程（commit 901709e4）

## v6.1.0 - (2026-07-07 14:40)

- Microi.net：新增 LicenseServerStore，支持授权持久化与恢复（commit 0e309bb）
- Microi.net：新增：更新版本号至6.1.0，提升项目版本管理（commit a71a5b8）

## v6.0.8 - (2026-07-07 03:16)

- 新增：增强 导入-软件包.js 并 物理列同步，优化 AI 意图识别（commit 01f8ceca）
- 新增：更新所有项目版本号至6.0.8（commit 747b745b）

## v6.0.7 - (2026-07-07 02:53)

- Microi.AI：新增：更新版本号至6.0.7，添加 TryBuildBuiltinChatReply 和 ResolveIntentAsync 方法（commit c6c51ef）

## v6.1.0 - (2026-07-07)

- 新增：增强 导入-软件包.js 并 后台任务 reporting，版本记录更新（commit 3664a367）
- 新增：更新 microi_empty_temp.sql.zip 文件（commit 1921109b）
- Microi.AI：更新 Microi.AI 版本并增强 AI 中转功能（commit e203db6）
- Microi.VSCode：新增：更新版本号至 3.1.3（commit 41327ff）

## v6.0.6 - (2026-07-06 17:25)

- 新增：增强 tenant 管理 UI 并 管理员登录提示，improved 租户卡片布局（commit b068c44f）
- 新增：优化数据获取逻辑，改进数据库连接和缓存处理（commit 6042ba51）
- 工程维护：更新软件包版本至 6.0.6 （多个项目）（commit 011de94b）

## v6.0.5 - (2026-07-06 15:32)

- 工程维护：更新 Microi.net 版本至 6.0.5 （所有项目），增强 error 处理 在 Excel 导入 功能（commit a001a4d4）

- Microi.net：增强租户开通服务与 V8 引擎集成（commit 09ff591）
- Microi.net：新增：增强ReloadSingleOsClient方法，添加性能计时和错误处理；版本号更新至6.0.5（commit 9953363）
- Microi.AI：新增：更新版本号至6.0.5（commit 7f64bfc）

## v6.0.4 - (2026-07-06 14:12)

- 新增：新增 ProfilePage 组件，profile 管理 功能（commit 83731185）
- 工程维护：更新版本至 6.0.4 （多个 Microi 组件），更新 README links（commit 380aa963）

- Microi.VSCode：新增：更新版本号至 3.0.9，增强 MCP 服务器名称构建逻辑以处理重复身份部分（commit aa0104e）
- Microi.AI：新增：更新版本号至6.0.4（commit 438f9e0）

## v6.0.2 - (2026-07-06 07:17)

- 重构代码结构，提升可读性与可维护性（commit 1791dfb8）
- 新增：增强 AI engine 查询结果 显示，新增 数据 analysis summary（commit 839ffd39）
- 新增：更新版本至 6.0.2，增强 通知中心（commit 2cf6a331）

- Microi.VSCode：新增：更新版本号至 3.0.8，增强 Codex MCP 配置功能（commit 3adc061）

## v6.0.1 - (2026-07-06 04:57)

- Microi.AI：新增：更新版本号至6.0.1，增强AI模型配置检查和流式响应处理（commit 6ac0279）
- Microi.net：新增：更新租户开通服务，增强数据库连接和错误处理；版本号更新至6.0.1（commit 2a9b552）

## v6.0.6 - (2026-07-06)

- 新增：更新 ProfilePage 和 UserBar 组件，优化界面与功能（commit 56851871）
- Microi.VSCode：新增：更新版本号至 3.1.0（commit 0397baa）

## v6.0.1 - (2026-07-05)

- Microi.VSCode：新增：更新版本号至 3.0.6，增强 Copilot 模型验证和工具限制保护功能（commit e94df04）

## v6.0.0 - (2026-07-04)

- 新增：更新多个组件以支持自适应高度和样式优化，修复相关逻辑（commit 2ddcf63c）
- 新增：更新技能版本至3.0.2，并调整版本规则说明（commit 85243072）
- 新增：更新技能版本至3.0.3，并更新时间戳（commit aad6fba5）
- Microi.VSCode：重构代码结构，提高可读性和可维护性（commit 8b30904）
- Microi.VSCode：新增：更新版本号至 3.0.3，添加 Copilot 同步警告功能（commit 8d349e0）
- Microi.net：新增：更新ApiEngine和FormEngine以优化V8引擎参数处理；版本号更新至6.0.0（commit fbf3ef6）
- Microi.AI：新增：更新版本号至6.0.0（commit ef4b347）

## v6.0.0 - (2026-07-02 15:18)

- 新增：新增 MicroiCaptchaRecognizer 用于 验证码识别，实现 采集引擎 文档（commit 7483ba8b）
- 新增：更新版本至 6.0.0，更新 相关 配置 （多个项目）（commit 2aff403f）

## v5.9.9 - (2026-07-02 11:09)

- Microi.net：新增：更新多个文件以优化表单事件处理和内存限制；版本号更新至5.9.9（commit 6e90842）

## v6.0.0 - (2026-07-02)

- Microi.VSCode：新增：更新 MCP server key 命名规则，添加诊断 MCP 可调用性功能（commit d61791a）

## v5.9.9 - (2026-07-01)

- 新增：增加 diy_field 记录批量更新工具和表单布局规范（commit 8ed5cb4f）

## v5.9.1 - (2026-06-30 12:01)

- 新增：更新版本至 5.9.1 （多个项目），增强 导入 功能（commit 9c0c0a89）

## v5.9.0 - (2026-06-30 03:33)

- 新增：更新版本至 5.9.0 （多个项目），增强 Microi.Spider 功能（commit 54f40594）

- Microi.net：新增：更新多个文件以增强字段处理和命令超时配置；版本号更新至5.9.0（commit 07ca67e）

## v5.8.8 - (2026-06-29 12:03)

- Microi.AI：新增：更新版本号至5.8.8（commit f2e1acd）

## v5.8.8 - (2026-06-29)

- Microi.VSCode：新增：添加 Codex MCP stdio 适配器，支持与 Microi MCP 服务器的兼容性（commit 2800b9f）
- 新增：新增 BackgroundTask，SecurityGuard 功能（commit b54ada9c）
- 新增：增强 工具注册，执行顺序（commit 1f58dfab）
- Microi.net：新增：添加后台任务进度更新功能；优化V8引擎并增强树懒加载支持（commit 6045388）

## v5.8.7 - (2026-06-28 06:06)

- 新增：更新版本至 5.8.7，增强 V8 engine 参数（commit 36c3af9f）

## v5.8.5 - (2026-06-28 00:41)

- 新增：更新版本至 5.8.5 （多个项目），增强 API 功能（commit 79346126）

- Microi.AI：新增：更新版本号至5.8.5（commit 0ec05c2）

## v5.8.4 - (2026-06-27)

- Microi.net：增强表单引擎缓存与翻译能力（commit f8eaea6）
- Microi.VSCode：新增：更新版本号至 2.5.3，增强 Claude Code 用户级 MCP 配置同步功能（commit 6a45c28）

## v5.8.1 - (2026-06-25 22:37)

- v5.8.1，完善多语言系统（commit f25d1d0c）

## v5.8.0 - (2026-06-25 18:11)

- 优化子菜单样式（commit d012088d）
- 更新v5.8.0，完善多语言系统（commit 235ea91c）

- Microi.net：新增：增强翻译引擎，添加空值检查和HTTP翻译支持；优化数据返回格式（commit 79758ad）
- Microi.net：新增：添加租户创建和缓存清理功能；更新版本号至5.8.0（commit df06e64）

## v5.8.1 - (2026-06-25)

- Microi.VSCode：新增：更新 MCP 配置支持，添加 Claude Code 项目级 .mcp.json 文件，优化服务器配置读取逻辑（commit f7d45d1）

## v5.8.0 - (2026-06-24)

- 新增：增强 widget 数据 标准化，清理图表文本（commit a76e04b4）
- 新增：新增 周期选择 功能 用于 统计 组件（commit 99f6ff10）
- 新增：增强 widget 高度计算，标准化（commit 204b03f0）
- 新增：增强周期筛选功能，优化组件数据处理和标题显示（commit 2706afc7）
- 新增：增强 SSE 请求体处理，优化 JSON 和文本类型支持，更新版本号至 1.4.6（commit 5e16a822）
- 修复：允许 release 脚本 至 run via sh（commit a5d4ce46）
- 维护提交（Anderson）（commit 4fb41d04）
- 新增：增强 V8 engine，Excel 导出 功能（commit 55b531aa）
- Microi.VSCode：重构代码结构，提高可读性和可维护性（commit ad04a5f）
- Microi.net：重构代码结构，提高可读性和可维护性（commit d30260c）
- Microi.VSCode：新增：更新版本号至 2.5.0（commit acb7746）
- Microi.AI：新增：更新版本号至5.7.9（commit f2dd374）

## v5.7.9 - (2026-06-23 14:22)

## v5.7.9 - (2026-06-23)

- 新增：更新 diy-select 组件 至 增强 数据 源码 处理，优化 对象 数据 源码 checks（commit c7e66ccd）

## v5.7.8 - (2026-06-22)

- 重构代码结构，提升可读性与可维护性（commit a1379935）
- 新增：增强 Office/PDF preview，editing 能力（commit e1a7cbfe）

## v5.7.6 - (2026-06-21 14:43)

- 新增：更新版本至 5.7.6 （多个项目），增强 MicroApp 功能（commit ac63e130）

## v5.7.5 - (2026-06-19 04:00)

- 新增：新增 MicroAppHost 组件，AI 工作流 API（commit d2f06ca1）
- 新增：更新版本号至 5.7.5，并优化 MicroAppController 中的存储逻辑（commit 774b77d4）

## v5.7.3 - (2026-06-17)

- 新增：更新版本号至 1.2.3，并修改更新时间；优化滚动段处理逻辑（commit 40a3f021）
- 新增：实现 数据 版本管理，回收站模式 功能（commit 5f5de8f7）
- 新增：增强 DIY form 功能 并 评论回复 功能，数据 版本预览（commit 5d65ef7f）
- 新增：优化表单和标签组件的样式与功能，增强用户体验（commit c550051f）

## v5.7.3 - (2026-06-16)

- 新增：增强 login，theme 处理 在 Microi UI（commit ebdb4c0e）
- 新增：增强 表 widget 并 自动滚动，分页 功能（commit 49e7829e）

## v5.7.3 - (2026-06-14)

- 重构并统一各项 Microi 技能中 SKILL.md 的说明；增强 Microi V8 前端 SDK 的错误提示与兼容能力；确保文档准确体现使用规范和开发最佳实践（commit 2cb4ff92）
- 新增：添加 MCP 默认可见性规则，优化未登录提示组件的样式和布局（commit ab99adaf）
- 新增：更新文档中的术语为中文，添加技能文档中文优先规则（commit b5e1ddb2）
- 新增：更新版本号至 1.1.9，并修改更新时间（commit 8fcc7f48）
- 新增：增强 sys_menu 配置，字段 处理（commit 2ea4e6a3）
- Microi.VSCode：新增：更新版本号至 2.1.9（commit 1129bcf）

## v5.7.2 - (2026-06-13 17:18)

- 新增：更新 V8 引擎编码最佳实践，增加移动端应用质量门禁和主题切换规范（commit 905de52f）
- 新增：更新版本号至 5.7.2，优化 Kestrel 请求处理配置（commit ce0baf62）

## v5.7.2 - (2026-06-13)

- 修复：set 默认 values 用于 可见性，显示 属性（commit 9938da09）
- 新增：更新搜索组件和表格操作，优化下拉框和文本框的处理逻辑（commit 41373f1b）
- 新增：更新版本号至 1.1.5，并修改更新时间（commit 33fe9255）
- Microi.VSCode：新增：更新版本号至 2.1.8，添加 MCP 默认可见性参考，优化知识库构建逻辑（commit 296c111）

## v5.7.2 - (2026-06-12)

- Microi.net：新增：优化错误信息返回格式，增强可读性和调试信息（commit f13be09）
- 新增：新增 设计工具 用于 Microi Page，Print Engine 校验, 构建,，保存（commit bbad781e）
- 新增：增强图片上传功能，支持替换与预览，优化上传状态管理（commit 1f8d1a0f）
- 新增：更新个人版说明，增加无限商用和永久有效的描述（commit 08e98359）
- 新增：添加移动端高品质视觉标准和质量门禁，优化移动应用体验（commit c9959b47）
- 新增：增强 移动端 UI 组件，视觉规范（commit 8f4f599b）
- Microi.VSCode：新增：更新版本号至 2.1.3，增强 MCP 服务器管理功能，添加多个 MCP 相关命令和状态监控（commit 9dd65f4）

## v5.7.2 - (2026-06-11)

- 新增：增强 导入-软件包.js 并 ID 重映射，引用同步（commit d48906f0）

## v5.7.2 - (2026-06-10)

- 新增：更新文件上传路径和规则，增强上传逻辑和错误处理（commit 9dc18522）
- 新增：更新打印功能，优化打印样式和布局，增强打印预览效果（commit 01e00dd3）
- 新增：添加在线文档路由，优化 ONLYOFFICE 编辑器界面，增强文件预览和下载功能（commit 75960e54）
- Microi.VSCode：新增：更新版本号至 2.0.9，增强 V8 树节点定位和远程差异显示功能（commit bc540f7）

## v5.7.2 - (2026-06-09)

- 新增：更新技能文档，增加 Microi.UI 设计规范和前端 SDK 相关信息（commit f0e8f805）
- 新增：更新表格分页配置，优化 SysConfig 处理逻辑，增强用户体验（commit 24f39389）
- Microi.VSCode：新增：增强版本管理和同步功能，支持技能版本处理和本地变更汇总（commit 0a48e6c）

## v5.7.2 - (2026-06-08)

- 新增：更新 mci-site.scss 和 SKILL.md，增强 UI 设计和样式一致性（commit 0ed243e4）
- 新增：增强 UI 组件，新增 visual 测试 用于 身份验证提示（commit 5ae0c1b9）

## v5.7.2 - (2026-06-07)

- 新增：更新 SKILL 文档，增加数据页加载态与空态区分规范，明确列表型资料页管理动作要求，添加 V8 缓存刷新约定（commit f18fff5b）
- 重构代码结构，提升可读性与可维护性（commit 574449e4）
- 新增：新增 Microi.UI runtime 用于 theme 管理，文档（commit 3978a57e）
- 新增：Microi UI 增加弹窗、订单卡片、商品卡片、区块、步骤条、Tab、主题面板、时间线和上传器等组件（commit b4ff3809）
- 增强 Microi UI 规范，styles 用于 更好的隔离性，一致性（commit 0d35dcb5）
- Microi.VSCode：新增：更新版本号至 2.0.1，增强同步管理器以支持本地变更项的处理（commit d435761）

## v5.7.2 - (2026-06-06)

- 新增：添加移动端分类独立滚动规范和后台直充行按钮实现细则，更新工作区 V8 代码同步收尾约定（commit 1e446586）
- 新增：优化表格筛选功能，增加列头筛选和分页筛选支持，调整样式以适应移动端（commit 0626e416）
- 新增：更新多个 SKILL 文档，增强移动端展示规范和同步状态检查，明确 Token 优先级及收尾复核要求（commit 68fb7a24）
- Microi.VSCode：新增：优化同步管理器，增强元数据更新逻辑，处理空代码情况（commit a1de8c1）

## v5.7.2 - (2026-06-05)

- 新增：更新本地启动约定，优化后端启动命令和文档说明（commit aac3a752）
- 新增：更新搜索组件逻辑，优化复选框和下拉选择的处理方式，增强富文本排版规范（commit 887aed83）

## v5.7.1 - (2026-06-04)

- 修复：修正 Microi V8 引擎代码编写最佳实践中的文件匹配规则，添加对文件上传字段值的兼容性处理（commit fede25e2）
- 新增：更新 V8.Db 使用示例，改为链式调用 AddInParameter 以支持参数化查询（commit 8b2088eb）
- Microi.VSCode：更新项目结构并增强功能（commit 8016dde）
- Microi.VSCode：新增：统一 AI 指令文件写入工作区根目录，新增初始化 AI 配置命令，更新 MCP 配置同步（commit eb23321）
- Microi.VSCode：新增：增强插件兼容性，支持 Windows Git 长路径，更新 MCP server key 命名规则（commit 16a8a1a）
- Microi.net：新增：更新版本号至5.7.1（commit 74d796b）
- Microi.AI：新增：更新版本号至5.7.1（commit 93a639b）

## v5.7.2 - (2026-06-02)

- 新增 SKILL.md 用于 uniapp-mall-assets，workspace-conventions（commit c7f49bed）

## v5.7.1 - (2026-06-01 21:54)

- 新增：新增 MongoDB logging 功能（commit 42cff4d1）
- 新增：增强 批量拖选，行高亮 在 DIY 表（commit 96007bc0）
- 工程维护：更新版本至 5.7.1 （多个项目），优化 文档（commit 01a972bd）

- Microi.net：增强 V8 引擎集成与调试能力（commit 7006544）

## v5.7.1 - (2026-06-01)

- Microi.VSCode：新增性能测试模块与 V8 版本管理（commit 05b5547）
- Microi.AI：新增：更新版本号至5.6.8（commit 4125af6）

## v5.6.8 - (2026-05-30 13:08)

## v5.6.8 - (2026-05-30)

- 新增：添加高并发性能压力测试规范及相关技能文档（commit 07515067）
- 新增：新增 工作流 事件 API，form 数据 管理 tools（commit 371e503e）

## v5.6.7 - (2026-05-29)

- 新增：更新 DiyFormDialog，使其触发 ParentFormSet 事件（commit 36328d54）

## v5.6.7 - (2026-05-27)

- 新增：添加 iframe 路由支持，优化 iframe URL 处理逻辑（commit 3d6b242f）
- 新增：更新 SKILL.md，添加用户问题编号跟踪和测试证据绑定需求编号的规范（commit f152665b）
- 新增：新增 GET_FIELD_LIST API，实现 字段 list retrieval（commit ff642d3f）

## v5.6.7 - (2026-05-26)

- 新增：更新资源路径规范，删除旧的 uniapp-mall-assets 规范并添加 microi-uniapp-frontend 规范（commit 9939b9a2）
- 新增：更新 SKILL.md 文档，修正头像解析和业务资产选中规则，调整示例数据和接口调用示例（commit 6f1966b4）
- 新增：更新 v8-formengine-http skill 并 new mall_product，shopping_cart 配置（commit 85619bcc）

## v5.6.0 - (2026-05-25 16:59)

- 新增：更新版本至5.6.0，优化文件上传路径处理和安全性检查（commit d7361426）

## v5.6.0 - (2026-05-24)

- 新增：增强 GoView 主题支持，优化键盘事件处理和文件响应验证（commit f2890d50）
- 新增：更新 ApiEngine 和 FormEngine 路由约定，优化 OsClient 参数处理（commit 50fd81ed）

## v5.5.9 - (2026-05-23 18:10)

- 新增：更新 Playwright 端到端 文档，重构 V8 resource 管理（commit 4bd44694）
- 新增：更新所有组件版本至5.5.9，确保一致性和兼容性（commit b7c5bd69）

## v5.5.8 - (2026-05-22 15:13)

- 新增：增强 API engine，V8 event 处理 并 版本管理，修改 history（commit 2ff39641）
- 更新 文档，版本管理 用于 Microi platform（commit fbd48da7）
- 新增：更新所有组件版本至5.5.8，确保一致性和兼容性（commit 35fae29a）

## v5.5.5 - (2026-05-22 03:27)

- 新增：添加商城 uni-app/Vue 前端图片资源强制 sanitizeAssetUrl 规范（commit 03f2ae7c）
- 增强 cache 管理 用于 API engine 更新与新增（commit acadca8e）
- 新增：更新所有组件版本至5.5.5，确保一致性和兼容性（commit f8cc5075）

## v5.5.4 - (2026-05-20 17:47)

- 重构 MicroiClient 至 use Base64 encoding 用于 ApiV8Code（commit 45eb2199）
- 新增：更新所有组件版本至5.5.4，确保一致性和兼容性（commit 31eed85d）

## v5.5.3 - (2026-05-19 09:17)

- Microi.AI：新增：更新版本号至5.5.3，并优化V8事件条件判断说明（commit 6d15301）

## v5.5.3 - (2026-05-19)

- Microi.net：新增 C# Dev Kit 语言服务缓存文件以提升性能（commit 6cfbc66）
- 新增：新增 文件 upload 功能，优化 文档（commit b930a42d）
- Microi.VSCode：新增：更新版本至 1.7.6，并增强 V8 引擎类型定义和数据库结构文档（commit 6bb008d）

## v5.5.2 - (2026-05-17 16:52)

- 新增：更新项目配置，修改环境变量为lsg，优化表单引擎逻辑（commit c1cb33bc）
- 新增：优化样式和功能，调整表单和表格组件的布局，增强用户体验（commit b480634d）
- 新增：更新部门组件和表格组件，优化数据处理逻辑，调整环境变量为iTdos（commit 0d92581d）
- 新增：更新所有组件版本至5.5.2，确保一致性和兼容性（commit 370bfd10）

## v5.5.2 - (2026-05-15)

- !89 合并 https://gitee.com/ITdos/microi.net 的 master 分支（commit da4dd5a3）
- 新增：增强 表单引擎诊断，runtime state 管理（commit 6b077c5c）
- 合并远程 master 分支（commit b1726eb2）
- 新增：添加重置路由功能，优化用户登出流程（commit fe48e3e9）

## v5.5.2 - (2026-05-14)

- 新增：更新 API engine 匿名调用设置，增强 按钮显隐逻辑（commit 9a850af7）
- 将手机端通讯录筛选上传（commit 660bfd03）
- 合并远程 master 分支（commit 2551fb28）
- 新增：重构diy-select组件，优化模型值处理和数据源管理逻辑（commit 9858253f）
- 新增：更新diy-form样式，禁用状态边框和圆角处理，调整el-row间距（commit 49b4931d）
- 合并远程 master 分支（commit c5f3c431）

## v5.5.2 - (2026-05-13)

- 合并远程 master 分支（commit 574de97e）
- 5.13修改了手机端通讯论筛选问题，平台配置列表和金额显示权限（commit b0747adb）

## v5.5.1 - (2026-05-12)

- 新增：增强 工作流 校验，测试 tools（commit fa97255f）
- 5.12拉取周总代码（commit a6ffe569）

## v5.5.0 - (2026-05-11)

- 合并远程 master 分支（commit 68b0e3b4）
- 新增：新增 业务蓝图工具，smoke test 脚本（commit 0f9d65fc）

## v5.5.0 - (2026-05-10)

- 新增：更新文档，添加低代码字段处理和HTTP复测的指导（commit 8d94559a）

## v5.5.0 - (2026-05-09)

- 去除折叠组件样式修改，只保留子表搜索输入框样式（commit fe7809a8）
- 恢复折叠样式后拉取代码（commit d2d0f097）

## v5.4.9 - (2026-05-08 15:02)

- 新增：增强 Playwright 上下文获取功能，支持动态页面大小和存储注入（commit b69f8391）
- 重构代码结构，提升可读性与可维护性（commit 5a030bde）
- 新增：服务器名称增加 Microi 前缀，并优化命名逻辑（commit 491cf63d）
- 新增：增强文件上传功能，支持获取支付凭证文件的临时访问地址（commit baae870c）
- 新增：更新 ParentFieldList 绑定逻辑，支持按标签分组字段列表（commit d820f9ce）
- 新增：添加按钮配置选项以刷新表格，优化点击事件处理逻辑（commit 48f2cb40）
- 合并 https://gitee.com/zhao-huiyin/microi.net 的 master 分支（commit 78f14da1）
- 新增：更新所有项目版本号至 5.4.9（commit d2a043f8）

- Microi.VSCode：新增：更新版本至 1.6.9，增强 Playwright 测试支持和错误处理（commit 27e4213）

## v5.4.9 - (2026-05-08)

- 新增：添加源码编辑功能，优化打印模板JSON保存逻辑（commit 9a35e777）
- 新增：增强字段显示逻辑，支持管理员查看隐藏字段并优化状态刷新机制（commit b8fb6fec）

## v5.4.8 - (2026-05-07 15:29)

- 合并远程 master 分支（commit 583f2b88）
- 新增：更新版本号至 5.4.8，确保所有模块版本一致（commit e1999ba9）

## v5.4.7 - (2026-05-07 05:54)

- 新增：新增 DIY 组件 包括 折叠分组, 滑块, 静态文本, 标签输入,，穿梭框（commit 35e1bbb6）
- 新增：增强 工作流 处理，form 数据 管理（commit e39eb595）
- 新增：移除选择用户的回调并优化工作流处理逻辑（commit 33f268a5）
- 新增：更新版本号至 5.4.7，包含多个模块的版本同步（commit b3ccc1b5）

- Microi.net：新增：更新版本号至5.4.7，并优化工作流引擎中的条件判断逻辑（commit f64d9d6）
- Microi.AI：新增：更新版本号至5.4.7（commit 881dd6d）
- Microi.VSCode：新增：更新版本至 1.6.5（commit 2f14632）

## v5.4.8 - (2026-05-07)

- 合并远程 master 分支（commit d721732f）
- 新增：新增 Tabs 组件 并 样式，配置 选项（commit f1de29fd）
- 重构：在多个组件中将 DiyConfig 重命名为 SysMenuModel（commit 98f01bc1）
- 合并远程 master 分支（commit f59e6c62）
- 修改折叠组件样式（commit d53bd691）

## v5.4.7 - (2026-05-06)

- 重构 高级工具，服务端上下文 处理（commit 7fbf3d0a）
- 重新修改审核按钮,详情样式调整（commit ea423e9c）
- 合并远程 master 分支（commit 6f9c5cca）
- Microi.VSCode：新增 Playwright E2E 集成及命令（commit 09aae98）

## v5.4.7 - (2026-05-05)

- 新增：更新 V8 引擎编码最佳实践，新增 FormEngine HTTP 路由约定（commit b91c0cbf）

## v5.4.5 - (2026-05-04 15:35)

- 新增：新增 Playwright context API，端到端 测试 能力（commit 064b14c5）
- 新增：更新 Playwright 端到端 test 说明，版本升级至 5.4.5 （多个项目）（commit 626edb78）

## v5.4.4 - (2026-05-04 15:18)

- 新增：增强 token 管理，recovery 流程（commit 87cdf2fc）
- 新增：增强 createEngine 方法对 ApiAddress 的支持，并新增示例数据初始化工具（commit a003241f）
- 新增：新增 V8McpLogic 补丁 用于 字段，表 updates, 架构缓存刷新,，匿名接口引擎设置（commit 60edcbc6）
- 新增：实现数据表字段排序自动递增；更新 API 排序说明；完善 Playwright 端到端测试文档及示例；补充 uni-app 主题切换实现，并强制主题色使用 CSS 变量（commit 06f03540）
- 新增：更新 Playwright 端到端 test 说明，版本升级至 5.4.4 （多个项目）（commit 0211f7d7）

- Microi.VSCode：新增：更新版本至 1.6.0，并增强数据库结构文档说明（commit 674c08a）

## v5.4.5 - (2026-05-04)

- 优化mcp（commit 9fad4971）

## v5.3.8 - (2026-05-03)

- 再一次拆分表格、表单组件代码（commit 9befc897）
- 修复：更新 参数 key 在 执行接口引擎的 API 调用 至 'Param' 用于 一致性 新增：扩展 AI 能力 在 README 以包含 7 新工具 用于 enhanced 功能（commit 6ccc8b49）
- 特性：为 Microi 服务器集成添加高级工具（commit 9a246049）
- 重构代码结构，提升可读性与可维护性（commit 4dada528）
- Microi.VSCode：增强 AI 文档与数据库结构处理（commit 19c84ae）
- Microi.AI：新增：更新版本号至5.3.8（commit 3cde37f）
- Microi.net：新增：更新版本号至5.3.8，并优化 OsClient 处理逻辑以增强错误处理和缓存清理（commit 9391354）

## v5.3.8 - (2026-05-02 02:43)

- 更新版本号至 5.3.8，确保所有相关项目一致性（commit dc499847）

## v5.3.8 - (2026-05-02)

- 功能：优化控制台输出编码，增强调试信息，添加 V8 引擎 API 知识库文档（commit ee163fac）

## v5.3.7 - (2026-05-01)

- !87 CVE-2023-44270 - PostCSS 注入漏洞修复（commit d1b714c2）
- 功能：实现对表单处理的替代提交并增强工作流集成（commit a29bfb17）
- 优化 sys-log 页面样式，调整内边距为 0；重构个人资料页面功能列表，简化结构并增强可读性；移除不必要的箭头标记（commit e90f019b）
- Auto(全行保存) / Submit(批量提交（commit fbf02d84）
- 功能：增强工作流集成并为 Unity WebGL 场景添加全局 API（commit 204b3edd）
- 功能：为 Microi 平台添加 V8 调试、Excel 导入/导出、文件上传/下载、前端事件、多租户架构及模板引擎使用的综合文档（commit 954d1eb9）
- 平台架构全面优化（commit cfa2a69c）
- 安全：修复 CVE-2023-44270 - PostCSS 注入漏洞修复（commit c152f363）
- Microi.net：新增：增强 V8 引擎安全性，添加类型黑名单和安全类型解析器（commit 9b2fc20）
- Microi.net：版本更新至 5.3.7，并增强 V8TenantContext 使用（commit d7aebb4）
- Microi.AI：新增：更新版本号至5.3.7（commit 5d0fc92）

## v5.3.8 - (2026-04-30)

- 升级 element-plus 依赖至 2.13.7；添加菜单权限翻译支持；优化移动端 FAB 操作条，支持拖拽位置保存（commit 4e32cab2）
- 修改审核按钮bug，处理冲突后上传新fork（commit f4010469）
- !86 修改审核按钮bug，处理冲突后上传新fork（commit b07ff41c）

## v5.3.7 - (2026-04-29 17:46)

- 优化移动端加载更多提示，支持点击触发；调整全局堆栈清理逻辑，避免误清空仍存活的实例；简化字段可见性判断逻辑（commit 26e2a6ab）
- 优化权限管理逻辑，修复角色权限获取和保存中的多个问题；调整前端组件以支持权限预览功能（commit 0a16c207）
- 优化多语言支持，增加日语和繁体中文语言包；调整语言选择组件，支持动态语言切换；改进语言存储逻辑，确保语言设置同步更新（commit b5172b48）
- 将所有组件的版本升级至 5.3.7，并更新文档链接以使用新的域名格式。（commit e773da3c）

## v5.3.7 - (2026-04-29)

- 删除过时的 AI 引擎文档，并更新相关映射文件以反映最新的文档结构和内容。（commit 35df7b8c）

## v5.3.7 - (2026-04-27)

- 优化 el-select 组件的选项渲染逻辑，增加 GetOptionLabel 和 GetOptionValue 方法，确保数据源类型处理准确；调整 DiyDataSourceConfig 组件的字段显示与存储配置逻辑，避免不必要的字段显示（commit fd428bb0）

## v5.3.6 - (2026-04-26 18:18)

- 优化表格懒渲染性能，增加内存清理逻辑，调整手机端卡片模式每页显示条数（commit 62191592）
- 更新多个组件和样式，调整字体大小，修复数据源处理逻辑，提升用户体验，版本号升级至 5.3.6（commit c0a9b5c4）

## v5.3.6 - (2026-04-24)

- 更新 Dockerfile 以替换环境变量，添加对 FileServer 和 OsClientType 的支持；更新 Vite 配置以排除 index.html 的压缩；修改一键编译发布脚本以确保构建镜像时不使用缓存（commit 0d9e02a6）
- 合并远程 master 分支（commit 5469c064）
- 重构多个组件的字体大小和边距以保持一致性（commit 97e7c4a9）
- 调整按钮高度和字体大小以改善样式一致性（commit 1fe461d1）
- 优化移动端样式，调整多个组件的内边距以提升用户体验（commit 5f0454c8）
- 调整菜单标题字体大小为12px，优化样式一致性；为小屏幕添加表单内边距以改善用户体验（commit 02095bcc）
- 优化样式，调整多个组件的内边距和填充以提升一致性和用户体验（commit 88e5f7d7）
- 移除菜单项底部填充样式以改善布局一致性（commit fe606409）
- 解锁页面滚动，优化加载完成后的用户体验（commit 3b148979）
- 优化加载完成后的页面解锁逻辑，增强兼容性和用户体验（commit 96c54228）
- 禁用 Brotli 和 Gzip 压缩，改由服务端 nginx 处理，简化本地开发配置（commit d12751e9）
- 更新 microi.loading.js 脚本注释，添加修改提示以防止浏览器缓存问题（commit 28d342b9）
- 添加 iOS Web App 支持和主屏幕指引，优化用户体验（commit 65e01623）
- 调整 el-dialog 最大宽度至 96%，优化对话框显示效果（commit 5420a938）
- 优化 DiyTableRowPageSize 的默认值获取逻辑，增强缓存处理和兼容性（commit 82733b02）
- 调整 iOS 检测逻辑，注释掉 PWA 主屏幕模式判断（commit 90e47921）
- 优化 DiyTableRowPageSize 的默认值设置，简化逻辑（commit a614472f）

## v5.3.5 - (2026-04-23 15:51)

- 更新所有项目版本号至 5.3.5，并添加 MQTT 设备级 ApiEngineId 缓存及日志功能（commit feb6eec6）

## v5.3.4 - (2026-04-23 12:24)

- 在应用启动时初始化主题系统，并在 App.vue 中显示事件（commit 7fce850b）
- 更新所有项目版本号至 5.3.4（commit 3f6c2e7f）

- Microi.AI：新增：更新版本号至5.3.4（commit a1014ef）
- Microi.net：新增：更新版本号至5.3.4，新增 OsClient 方法以支持占位模型检测和主租户加载验证（commit 99c2bca）

## v5.3.5 - (2026-04-23)

- Microi.VSCode：新增：增加对数据库模式的 Markdown 文件支持，并优化 API 文件命名（commit f3e8e64）
- 完善tab初始值，PC配置页面初始值和列表工作台调整（commit c84d4653）
- 合并远程 master 分支（commit ee74b385）
- 完善tab初始值，PC配置页面初始值和列表工作台调整（commit 622a4946）
- !82 完善tab初始值，PC配置页面初始值和列表工作台调整（commit 8105f2f3）

## v5.3.4 - (2026-04-22)

- 修改列表字段和列表样式，小程序分享功能待完善，电脑无法打开分享链接（commit 949b19da）
- 重构安装脚本并更新数据库文件（commit 411f50f6）
- !81 修改列表字段和列表样式，小程序分享功能待完善，电脑无法打开分享链接（commit de53c63a）

## v5.3.4 - (2026-04-21)

- 处理打开抽屉内表格更多按钮弹框无法关闭的问题（commit 0a875bb2）

## v5.3.3 - (2026-04-20 02:13)

- 添加 MCI 设计系统全局样式，支持明暗主题（commit 909b1050）
- 更新版本号至 5.3.3，确保所有相关项目一致性（commit d300957c）

- Microi.net：新增：更新版本号至5.3.3，并优化级联选择器和树形选择器的默认字段配置（commit d87ef03）
- Microi.AI：新增：更新版本号至5.3.3（commit 15fdc99）

## v5.3.3 - (2026-04-20)

- 整理已归档目录（commit 234436be）
- 修改页面初始值和页面布局（commit 3c16fb25）

## v5.3.3 - (2026-04-19)

- 修改：更新 .gitignore 文件以添加新目录，增强 home-glow.scss 中第5个按钮的样式，更新 index.md 以添加新的视频下载器链接（commit 4f34c6cc）
- !80 合并 https://gitee.com/ITdos/microi.net 的 master 分支（commit d4356bf9）
- 修复：更新 AMap API key placeholder 在 组件.js（commit 1e9d7f2f）
- 合并远程 master 分支（commit 5858cd29）

## v5.3.2 - (2026-04-17 06:12)

- - **新增**：增强表单组件的数据加载能力，防止重复请求 - 在 `SetFieldData` 和 `GetFieldsData` 方法中增加加载状态管理，避免并发请求。- 更新 `diy-cascader` 和 `diy-select-tree` 组件，确保 `Config` 属性已初始化，避免出现未定义错误。- 优化 `diy-select-tree` 中的树形结构处理，保证数据嵌套正确。- **重构**：调整 `diy-form-full` 在新增条目时复用 `TableRowId`，避免不必要的 API 调用。- **调整**：优化 `diy-form` 的自动初始化逻辑，防止特定模式下出现重复请求。- **优化**：改进 `diy-表` 的移动端搜索界面，提升用户体验。- **版本更新**：将多个项目中的 Microi.net 版本统一升级至 5.3.2。- **配置调整**：修改开发环境的启动配置。（commit 280c0719）

- Microi.AI：新增：更新版本号至5.3.2（commit 1f596ac）
- Microi.net：新增：更新版本号至5.3.2，并修复树形结构和Where条件的处理逻辑（commit 47ed0dc）

## v5.3.2 - (2026-04-17)

- **修改**：在多个组件中禁用自动初始化（AutoInit），以支持手动调用初始化逻辑（commit dbe06b9f）
- 新增：支持懒加载和远程搜索功能，优化树形选择组件的数据处理（commit 53900465）
- 修改：更新多个文件以添加新的数据库结构文件，优化登录和聊天功能的连接状态管理（commit 6abeb30d）
- 完善好H5处理抽屉/对话框返回bug，但小程序最后一层抽屉时任然不行（commit a56064e5）
- 合并远程 master 分支（commit fddadb90）

## v5.3.1 - (2026-04-16)

- 完善好售后和设备tabs，先上传好PR（commit d6bcef6d）
- !78 完善好售后和设备tabs，先上传好PR（commit 29a86949）
- 处理抽屉/对话框返回bug（commit fbb674ff）
- 合并远程 master 分支（commit 15a61790）
- !79 合并 https://gitee.com/ITdos/microi.net 的 master 分支（commit 85cb7b62）

## v5.3.1 - (2026-04-15)

- 优化移动端样式，调整组件布局和样式，增强用户体验（commit fe420135）
- 优化移动端界面，添加FAB浮动操作按钮并调整按钮显示逻辑，提升用户体验（commit 8f1fe21e）
- 优化移动端FAB浮动操作按钮显示逻辑，移除对小程序的限制，提升用户体验（commit dbd6d1d2）
- 优化搜索框显示逻辑，移除对移动端视图的限制，提升用户体验（commit ead411ab）
- 完善好售后和设备tabs（commit a0006a6c）
- 完善好售后和设备tabs，先上传好PR（commit a7924123）

## v5.3.1 - (2026-04-14)

- 优化移动端组件，使用el-tree-select替代el-cascader，调整样式以提升用户体验（commit 4a4889bd）
- 优化移动端界面，移除不必要的元素并实现FAB浮动操作按钮（commit 3469687d）
- 优化移动端样式，调整按钮圆角和搜索组件布局，增强用户体验（commit 264085f5）
- 合并远程 master 分支（commit 579b76ab）
- 修改了售后任务tab（commit 9534fbbf）
- 调试好售后tabs（commit db89279f）

## v5.3.0 - (2026-04-13 04:01)

- 特性：版本升级至 5.3.0 并优化工作流移动端界面（commit 9fd639bf）

- Microi.AI：新增：更新版本号至5.3.0（commit 906f8e6）
- Microi.net：新增：更新版本号至5.3.0（commit 06b1f73）

## v5.3.0 - (2026-04-13)

- 合并远程 master 分支（commit 13b2f802）
- 实现移动端悬浮操作按钮（FAB）（commit 51545b2c）
- 优化工作流页面布局，使用el-row和el-col组件替代传统div结构（commit b995e816）
- 合并远程 master 分支（commit db6b3dc2）

## v5.3.0 - (2026-04-11)

- 特性：为 HDFS 实现文件管理 API（commit dbe9eca7）

## v5.2.9 - (2026-04-10 12:34)

- 版本升级至 5.2.9，更新多个组件的版本号（commit f4718f41）

- Microi.net：新增：更新版本号至5.2.9（commit 3aac4ef）
- Microi.AI：新增：更新版本号至5.2.9（commit 61aefac）

## v5.2.9 - (2026-04-10)

- !76 修复新增按钮展示（commit 55749a77）
- 合并远程 master 分支（commit 7d06f1fd）
- 权限修改（commit e1148763）
- 合并远程 master 分支（commit 04ce2122）

## v5.2.8 - (2026-04-09 17:26)

- 完善好地区树形选择和片区管理新增数据后列表不更新问题（commit 081f881b）
- 修复新增按钮展示（commit 2456ff2c）
- 修复新增按钮展示（commit 36653151）
- 功能：将版本更新至 5.2.8 并增强全屏功能（commit 9f6014c7）

- Microi.AI：新增：更新版本号至5.2.8（commit fc536f6）
- Microi.net：新增：更新版本号至5.2.8，并在加密脚本中添加加密指纹标记功能（commit fdaed74）

## v5.2.8 - (2026-04-09)

- 注释权限问题（commit 64ef539e）
- 合并远程 master 分支（commit 10cdce67）

## v5.2.3 - (2026-04-08 11:57)

- 版本升级至5.2.3，并为Dos.ORM增加异步数据检索方法（commit e7621929）

- Microi.AI：新增：更新版本号至5.2.3（commit 2213a48）
- Microi.net：新增：更新版本号至5.2.3，增强 SQL 注入防护和字段名校验（commit 2c16e8b）

## v5.2.3 - (2026-04-08)

- 将级联选择器改为树形选择器（commit 3c5e0d71）
- PC保存级联选择器，移动使用树形选择器（commit 6be08662）
- 合并远程 master 分支（commit d75338fe）

## v5.2.0 - (2026-04-07 16:48)

- Microi.AI：新增：更新版本号至5.2.0（commit fa4b284）
- Microi.net：重构数据库事务处理，并将版本更新至 5.2.0（commit 4d08735）

## v5.1.9 - (2026-04-07 00:58)

- 更新 launchSettings.json 中的 ASPNETCORE_ENVIRONMENT 为 'chongshi'（commit 0e5ca617）
- 更新项目版本至 5.1.9 （多个 Microi.Server 组件）（commit 2af1ff1e）

- Microi.AI：新增：更新版本号至5.1.9（commit c7ac274）
- Microi.net：新增：更新版本号至5.1.9，添加 Windows 路径转换功能以支持 .NET 工具（commit 095f8f0）

## v5.2.0 - (2026-04-07)

- 合并远程 master 分支（commit 1fdabdf1）
- 特性：为ORM实现PostgreSQL和SQL Server服务（commit ebb6fca2）
- 合并远程 master 分支（commit 3c9cc2e4）
- 修改级联选择器超屏幕问题（commit d6b66ec9）

## v5.1.9 - (2026-04-06)

- 新增 Docker 容器监控功能，获取容器统计信息并展示在系统监控界面（commit d5263710）
- 更新 launchSettings.json 至 修改 ASPNETCORE_ENVIRONMENT 至 'iTdos'（commit 7cc84fb0）

## v5.1.9 - (2026-04-05)

- 添加 @vitejs/plugin-basic-ssl 依赖；调整预览样式为 100vh 和 100vw；更新 Vite 配置以支持 HTTPS 自签名证书（commit eaf4e84b）
- 更新构建脚本以使用 cross-env 设置环境变量；新增 cross-env 依赖（commit ff9f650e）
- 注释掉 DiyDocumentParam 类中的 _Top 属性（commit d8889a51）

## v5.1.8 - (2026-04-04 00:39)

- Microi.AI：新增：更新版本号至5.1.8，优化AI配置管理，减少动态类型使用，提升代码安全性和可维护性（commit 41cc3e3）
- Microi.net：新增：更新版本号至5.1.8，统一关闭 HidePrivateApi 设置以避免 DLR 运行时错误（commit 6121165）

## v5.1.8 - (2026-04-04)

- 壮举：添加3D模型加载器和预置场景配置（commit 9548c6c0）
- 合并远程 master 分支（commit 5c5d56af）
- 优化数据库提供程序缓存机制，使用并发字典替代普通字典以提高线程安全性（commit 97d8b406）
- 合并远程 master 分支（commit 576cf6a3）
- 壮举：将Microi 3D引擎升级到具有新功能的V3（commit 006f6f3a）
- 合并远程 master 分支（commit 922eac47）
- 更新路径编译方法，使用新的导入方式；调整样式设置以优化预览效果；修改环境变量配置为renyiPro（commit fc40992c）
- 删除子模块 任亿3D数字孪生（commit aa1a96c0）
- 更新 .gitignore 文件以包含任亿3D数字孪生；优化首页特色卡片样式，增强视觉效果（commit b31d7a0d）
- 增强发布助手功能，新增官方网站文档编译选项；优化聊天组件和产品展示样式，提升视觉效果（commit 40979d95）

## v5.1.8 - (2026-04-03)

- 修改日历超屏幕问题（commit 3e89e026）
- 安全：修复 CVE-2024-22262 - 新增 URL 校验 至 防止 开放重定向/SSRF（commit ffd4e730）
- !74 AI 队友自动生成：修复 CVE-2024-22262: Spring Framework UriComponentsBuilder 安全漏洞（commit 0bf87317）
- 安全：修复 CVE-2024-45296 - 升级 path-至-regexp 至 v6.3.0（commit 97f7f382）
- !75 AI 队友自动生成：[Security-高危] CVE-2024-45296 - Path-至-RegExp 安全漏洞修复（commit 7cea9b82）
- Microi.VSCode：新增：更新 package.json 版本至 1.5.5，并增强设置面板的环境变量管理和用户提示（commit b477a97）
- Microi.VSCode：新增：更新 package.json 版本至 1.5.7，并优化发布脚本以使用 npx 调用 ovsx（commit 563476f）

## v5.1.7 - (2026-04-02 18:15)

- 将页面搜索条件合并同步，联动搜索完成，时间选择超出页面待完善（commit 0a7f31fb）
- 将页面搜索条件合并同步，联动搜索完成，时间选择超出页面待完善（commit e945d391）
- 合并远程 master 分支（commit 58a46923）
- 将所有相关组件版本更新至5.1.7，修复Unity WebGL上下文管理及Blob URL处理（commit b330bcd6）

## v5.1.5 - (2026-04-02 15:28)

- 将所有相关组件版本更新至5.1.5，添加AI模型选择和对话历史功能（commit ce89e5fa）

- Microi.net：新增：更新版本号至5.1.5（commit e00e794）
- Microi.AI：新增：更新版本号至5.1.5，并优化AI配置管理，减少async方法中的局部变量数量（commit f17c8b5）

## v5.1.3 - (2026-04-02 14:17)

- 将所有相关组件版本更新至5.1.3，添加Docker镜像推送选项及官方网站文档发布功能（commit 03325439）

- Microi.net：新增：更新版本号至5.1.3（commit 6a39d26）
- Microi.AI：更新版本号至5.1.3（commit 551f2ef）

## v5.1.2 - (2026-04-02 12:33)

- 壮举：添加micro -offline-prepare.sh脚本，用于创建离线安装包（commit 8e0309f7）
- 将所有相关组件版本更新至5.1.2，确保一致性（commit a96d55d4）

- Microi.VSCode：新增：更新 package.json 版本至 1.4.9，并增强设置面板的 Claude Code 模型切换提示和环境变量管理（commit 49537ff）
- Microi.net：新增（TenantProvisioningService）：添加从CDN下载空库SQL文件的功能，优化导入逻辑（commit ff8c8c4）
- Microi.AI：新增 Microi V8 引擎安全最佳实践，涵盖 SQL 注入防护、权限校验、输入校验、XSS 防护和敏感数据处理（commit 9600860）
- Microi.AI：更新版本号至5.1.2（commit d0d238c）
- Microi.net：新增：更新版本号至5.1.2（commit 6b51341）

## v5.1.7 - (2026-04-02)

- !73 合并 https://gitee.com/ITdos/microi.net 的 master 分支（commit 3c9e6c98）

## v5.0.9 - (2026-04-01 11:26)

- Microi.AI：更新版本号至5.0.9（commit 2f762b1）

## v5.0.9 - (2026-04-01)

- 合并远程 master 分支（commit 6374ed8f）
- 在UserBar组件中添加密码设置功能（commit 2174eade）
- 全分享、批量删除按钮条件加到最外层元素，移动端更多搜索显隐改变，但更多搜索条件和外层移动端搜索条件还没有同步（commit e1ca3847）
- 合并远程 master 分支（commit dd4f33d9）
- Microi.VSCode：新增：增强 Claude Code 安装路径检测和环境状态显示（commit 387e87f）
- Microi.VSCode：新增：删除 v8-engine 1.1.7 的安装包（commit 3c0e58c）
- Microi.net：增强租户开通与 V8 上下文隔离（commit d911adc）
- Microi.VSCode：新增：更新 package.json 版本至 1.4.8，并增强设置面板的 Claude Code 状态显示和模型配置引导（commit 309a32e）

## v5.0.8 - (2026-03-31 13:02)

- 将项目版本更新到5.0.8，确保所有相关组件一致性（commit 3807a3d0）

## v5.0.7 - (2026-03-31 05:08)

- 为Microi低代码平台的本地设置和部署添加文档（commit 99af0c86）
- 将项目版本更新到5.0.7，并添加数据库结构文档和相关说明（commit c92ca20c）

- Microi.VSCode：新增：更新 package.json 版本至 1.4.5，并增强设置面板的 Claude Code 安装和检测功能（commit b7b456c）

## v5.0.8 - (2026-03-31)

- 修复移动端按钮显示逻辑，确保在小程序和手机视图下的功能完整性（commit e54b13ea）
- 修改了详情页顶部按钮，推送自己仓库好拉取周总仓库（commit a5c7c33f）
- 修改了详情页顶部按钮，图片预览问题（commit cbf57d96）
- !72 修改了详情页顶部按钮，图片预览问题（commit 5b3fb281）
- 为系统日志页面添加分步耗时解析功能，优化内容展示（commit 584d98bd）
- 恢复PC端返回按钮（commit 43b3389d）

## v5.0.6 - (2026-03-30 20:49)

- 主要处理合并冲突的问题上传（commit 759d0c08）
- 合并远程 master 分支（commit 64a6afc8）
- 修复新增按钮展示位置（commit e6673b62）
- 下午修改详情页，待完善（commit 56d17ec4）
- 跨多个项目将版本升级到5.0.6，并更新页面引擎功能的API（commit b1dcf3d3）

## v5.0.5 - (2026-03-30 13:06)

- 同步已选中数据源项状态，优化表格数据管理逻辑（commit 30fb9ac9）
- 将项目版本更新到5.0.5，修改启动设置，并使用AI集成指南和页面和打印引擎的新技能增强文档。（commit 44f8e7db）

## v5.0.6 - (2026-03-30)

- 安全：修复 CVE-2025-58754 - 升级 axios 至 ^0.30.2 至 防止 数据: scheme 拒绝服务漏洞（commit cd2b2200）
- !70 AI 队友自动生成：[Security-高危] CVE-2025-58754 - Axios 安全漏洞（commit 69d7e9e4）
- 安全：修复 CVE-2023-44270 - PostCSS 注入漏洞（commit be634b4b）
- !69 修复新增按钮展示位置（commit af1714bc）
- !71 AI 队友自动生成：[Security-中危] CVE-2023-44270 - PostCSS 注入漏洞（commit 0d6a200a）

## v5.0.3 - (2026-03-29)

- Microi.VSCode：增强设置面板的 Claude Code 管理，并新增接口引擎创建面板（commit d754078）
- 在sidebar.scss中为链接添加text-decoration: none;样式（commit 74b33ea7）
- 壮举：为具有TAB功能的表单设计器添加面板选项卡组件（commit 56d28aa8）
- 调整接口引擎相关表单项，优化数据接口填充逻辑（commit fae28f31）
- Microi.VSCode：新增：更新模型管理功能，支持 Claude Code 模型的添加、编辑和删除 工程维护：更新版本至 1.3.6，添加 publish-tokens.json 文件 重构：修改路径结构以支持中文目录名（commit e8d6452）
- Microi.net：新增：更新版本号至5.0.3（commit c302c9e）
- Microi.AI：更新版本号至5.0.3（commit 093b3a5）

## v5.0.3 - (2026-03-28 23:37)

- 更改微型客户端服务名称和映像，更新安装脚本以反映新配置（commit b95ee290）
- 移除MQTT消息接收处理中的调试输出（commit 67eebb13）
- 壮举：增加了导入-软件包.js的导出支持，并改进了日志记录（commit 1c130a35）
- 增加大盟、KingBase和PostgreSQL的数据库服务实现（commit d93f469d）
- 更新launchSettings.json中的ASPNETCORE_ENVIRONMENT变量为iTdos（commit 3ddd9663）
- 更新所有项目版本号至5.0.3（commit 39713f29）

- Microi.net：表单引擎新增数据写入辅助方法，支持自动编号生成、唯一字段校验和 SQL 构建（commit 7382e7c）
- Microi.net：新增（FormEngine）：优化自动编号生成逻辑，使用Redis计数器避免编号重复，增强文档说明（commit cfe5eb7）

## v5.0.2 - (2026-03-28 18:26)

- Microi.net：新增：更新表单操作日志，使用表名替代原有字段名，优化慢执行警告信息（commit 8139c94）
- Microi.AI：优化日志输出格式，添加时间戳和统一前缀（commit 86c4cc7）
- Microi.net：新增：添加获取表别名和SQL前缀处理方法，优化字段查询逻辑（commit c7a003d）
- Microi.net：新增：优化数据库字段类型处理，增强SQL生成逻辑，支持显式别名和ORDER BY子句附加（commit 5016efb）
- Microi.AI：更新版本号至5.0.2（commit 074f5fc）
- Microi.net：新增：更新版本号至5.0.2（commit 15310a2）

## v5.0.1 - (2026-03-28 00:57)

- 壮举：将Microi.net版本更新到5.0.1，并添加API调用计数跟踪（commit 9e4000e1）

- Microi.net：新增：增加异步记录接口调用次数和日志功能，更新版本号至5.0.1（commit 5a6e86b）
- Microi.AI：更新版本号至5.0.1（commit 2252802）

## v5.0.0 - (2026-03-27 23:47)

- Microi.AI：更新版本号至5.0.0（commit 7f6b707）

## v4.9.9 - (2026-03-27 15:14)

- 删除微型页面引擎和打印引擎子项目（commit 0c8d670a）
- 更新版本至4.9.9，修改多个项目文件以反映新版本（commit 6be8fad3）

- Microi.AI：更新版本号至4.9.9（commit ea4633d）

## v4.9.8 - (2026-03-27)

- 壮举：使用综合指标实现系统监控功能（commit 4ca047ab）
- Microi.net：增强 V8 事件日志与慢 SQL 执行跟踪（commit db8b5f1）
- Microi.net：发布版本 v4.9.8（commit 8d64cea）
- Microi.AI：更新版本号至4.9.8，并优化授权检查提示信息（commit af186ac）

## v4.9.8 - (2026-03-26 22:26)

- 更新版本至4.9.8，修改多个项目文件以反映新版本（commit b04ce660）

## v4.9.7 - (2026-03-26 19:56)

- 壮举：更新版本到4.9.7，并为许可证申请添加验证码功能（commit 6d378a8d）

## v4.9.6 - (2026-03-26 16:30)

- 更新：在NuGet包替换过程中添加替换前后文件大小的输出信息（commit 1c76cbd5）
- 更新版本至4.9.6，修改多个项目文件以反映新版本，更新一键编译发布脚本中的开源地址（commit f1ca3641）

## v4.9.5 - (2026-03-26 14:35)

- 更新项目版本至 4.9.5；增强 LicenseController 自动获取 IP 的能力；删除过时的发布脚本；新增包含 Docker 与 NuGet 配置的完整构建发布脚本（commit bdb11d8f）

## v4.9.3 - (2026-03-26 07:08)

- 更新版本至4.9.3，添加生成ULID的方法，更新文档以反映新功能（commit c84060c9）

- Microi.net：发布版本 v4.9.3（commit 1fddb21）

## v4.9.1 - (2026-03-25 22:56)

- 更新v4.9.1（commit 33ff6e8b）

- Microi.net：全新授权机制（commit 51a9ec8）
- Microi.net：发布版本 v4.9.1（commit 5493acf）
- Microi.AI：更新版本号至4.9.1（commit 888d61e）

## v4.8.4 - (2026-03-24 15:44)

- Microi.AI：更新版本号至4.8.4（commit 726af1f）
- Microi.net：发布版本 v4.8.4（commit 2e27507）

## v4.8.3 - (2026-03-24 01:12)

- 跨多个项目将版本升级到4.8.3，并为VS Code插件集成更新README（commit 36368a60）

- Microi.VSCode：增强 MCP 配置与 Token 管理（commit 6b30895）
- Microi.VSCode：工程维护：package.json 版本更新至 1.3.0（commit a9cef4f）
- Microi.AI：更新版本号至4.8.3（commit 00a87b4）

## v4.8.4 - (2026-03-24)

- 更新：修正.gitignore文件中的路径格式（commit 613720f4）
- 将microi.web修改为Microi.Client（commit 4118773a）
- 新增：添加Dockerfile、.gitignore和发布脚本，更新Nginx配置，删除不再使用的子项目（commit d6a1f847）
- 更新：调整.gitignore文件，添加对Microi.Server/Microi.AI和Microi.Server/Microi.net目录的忽略规则（commit e25ee80e）
- 重构：将 hbuilder-app 移至根目录并更名为 microi.app，更新所有文档和 README 引用（commit 88cd088e）
- 壮举：为代码插装和安全序列化添加V8McpService（commit ad370db3）
- 更新：修改首页tagline，增加对MCP和Skills的支持描述（commit b9081b60）
- 更新：修改README和文档首页描述，增加对MCP和Skills的支持信息（commit 5082feb4）
- 更新：从解决方案中移除Microi.AI项目及其配置（commit 909aabc3）
- 更新：修改文档中的开源时间为2025年，更新.gitignore以允许跟踪特定配置文件（commit c145077f）
- 增强Microi平台的文档：更新索引。md具有新的品牌和功能描述，包括V8引擎集成和改进的AI编程能力。（commit b90ddda3）
- 更新：在文档中添加新的预览图像以增强视觉效果（commit 7fea5254）
- 更新：修复README和索引文档中的预览图像格式（commit 2a00098d）
- 更新：从文档中移除多余的空图像行以优化布局（commit a0f77a58）
- Microi.VSCode：工程维护：版本更新至 1.3.4，并增强 MCP 服务器配置（commit 644d058）

## v4.8.3 - (2026-03-23)

- 更新文档：将“免费试用”改为“在线使用”，并在Docker部署文档中添加一键安装说明（commit 1c7faf28）
- 壮举：为V8引擎添加Microi技能文档和实现（commit 612cdf8c）
- 新增：添加V8引擎API知识库文档和Copilot指令文件（commit aa586b26）
- 壮举：更新V8引擎集成，并添加MongoDB和MQTT技能（commit f77fc964）
- 更新：重构V8引擎API知识库文档，添加接口引擎和CRUD操作示例（commit 14f9ddb9）
- Microi.VSCode：重构代码结构以提高可读性和可维护性（commit aa35b01）
- Microi.VSCode：重构代码结构，提高可读性和可维护性（commit 6ee6679）
- Microi.VSCode：重构代码结构，提高可读性和可维护性（commit 06fb38e）
- Microi.VSCode：删除过时的 v8 引擎版本文件（commit 5f56b14）

## v4.8.3 - (2026-03-22)

- 新增3D背景组件，优化主页视觉效果，更新依赖项（commit 763d2905）
- 修复：优化el-select组件，确保SQL/DataSource/ApiEngine数据源的字符串值转换为对象，增强选项存在性检查（commit 0f005036）
- 新增：创建HeroTitle3D组件，增强主页3D标题效果，优化视觉表现（commit e8aa2411）
- 新增：为VPHero组件的名称添加高度样式，优化视觉效果（commit f4942922）
- 壮举：更新翻译流程并添加新的文档（commit 1b8753c6）
- 重构代码结构以提高可读性和可维护性（commit dbff5f4e）
- Microi.VSCode：添加3D效果（commit b71fa3c）
- Microi.VSCode：重构代码结构，提高可读性和可维护性（commit b3022d8）
- Microi.VSCode：工程维护：清理代码结构并删除未使用的导入（commit be68aa2）

## v4.8.2 - (2026-03-21)

- 完善 AiController，新增用户订阅管理功能，优化 API 代理转发逻辑（commit 908cdc3b）
- 合并远程 master 分支（commit afb4cd93）
- 归档不再维护的开源项目（commit 7489afdf）
- 合并远程 master 分支（commit 076ce140）
- 新增接口引擎创建功能，更新环境变量配置（commit 6db80700）
- 壮举：为WebSocket中间件和核心服务添加V8调试支持（commit 3b88d2af）
- 更新 AI 编程全指南，合并相关文档并优化内容结构，增强用户体验（commit b8defe37）
- 新增支持WebSocket端口的MQTT服务选项，优化启动日志输出（commit 70110b0a）
- 优化MQTT服务启动逻辑，移除WebSocket端口配置，简化选项创建（commit 055801be）
- Microi.AI：新增：新增 SubscriptionService，用于管理订阅、订单及 API 密钥，支持多服务商（commit 07f49c2）
- Microi.VSCode：Microi吾码 - V8引擎 VS Code 插件（commit 2affc3b）
- Microi.VSCode：重构代码结构以提高可读性和可维护性（commit ebfe7f2）
- Microi.VSCode：新增：重构配置和同步管理（commit 2c547f5）
- Microi.VSCode：新增：增强引擎文件处理和添加数据库模式同步（commit 90b4b27）
- Microi.AI：增强V8引擎和API引擎的文档（commit dd98464）
- Microi.VSCode：更新 README.md，增强 AI 辅助编程功能描述，添加工作原理和使用说明（commit 8afc854）
- Microi.VSCode：重构代码结构以提高可读性和可维护性（commit 2d2e3ba）

## v4.8.2 - (2026-03-20)

- Microi.net：工程维护（commit 015fcd7）
- 优化表内编辑字段判断逻辑，新增 IsInTableEditField 方法以支持多种字段格式（commit 10fb020c）
- 壮举：增强了系统中的卡片显示和权限管理（commit d645d14f）
- 新增手机号授权登录功能，优化未绑定用户的注册流程（commit 45a388e4）
- 安全：修复 CVE-2023-45857 - 升级 axios 从 0.18.1 至 0.28.0（commit f6d90fe6）
- !64 AI 队友自动生成：修复 CVE-2023-45857 - Axios 安全漏洞（commit 544f1028）
- Microi.AI：工程维护（commit bc20bdb）

## v4.8.2 - (2026-03-19)

- 禁止接口引擎、V8事件代码中提交/回滚事务，由平台全面自动接管（commit d41162fb）

## v4.8.1 - (2026-03-18 14:06)

- 优化聊天系统、优化移动端（commit 8087e783）
- 更新v4.8.1（commit 8d00b5de）

## v4.8.1 - (2026-03-17)

- 批量更新文档（commit 13c12c4a）

## v4.8.1 - (2026-03-16)

- 更新 Microi.OpenClaw 吾码小龙虾（commit 0781eed3）
- 更新官网（commit c7dc8d4e）

## v4.8.0 - (2026-03-15 09:07)

- 修复关联表单组件bug（commit e09b6a90）
- 更新v4.8.0（commit 334bc59c）

## v4.8.0 - (2026-03-15)

- 安全：修复 CVE-2022-48285 - jszip 路径遍历漏洞（commit 00486f91）
- 安全：修复 CVE-2022-45143 - Apache Tomcat JsonErrorReportValve 注入漏洞（commit b233d5ea）
- 安全：修复 CVE-2023-51074 - Jayway JsonPath 安全漏洞（commit 3cb0b34b）
- !9 AI 队友自动生成：[Security-高危] CVE-2022-48285 - jszip 路径遍历漏洞（commit b0601579）
- !11 AI 队友自动生成：安全修复：CVE-2023-51074 Jayway JsonPath 栈溢出漏洞（commit 1cb7cd91）
- !10 AI 队友自动生成：[Security-高危] CVE-2022-45143 - Apache Tomcat 注入漏洞（commit 4a56ed64）
- 安全：修复 CVE-2024-24549 - Apache Tomcat HTTP/2 拒绝服务漏洞（commit f51aaf60）
- 安全：修复 CVE-2022-3509 - 升级 protobuf-java 至 3.21.7（commit b2d92dab）
- !22 AI 队友自动生成：[Security-高危] CVE-2024-24549 - Apache Tomcat 输入验证错误漏洞（commit db94c452）
- 将 gitee.com:ITdos/microi.net 的 master 分支合并到 修复-CVE-2022-3509-Gf0y（commit 059133dd）
- !23 AI 队友自动生成：[Security-高危] CVE-2022-3509 - IBM WebSphere Application Server Liberty 安全漏洞（commit 86232005）
- 安全：修复 CVE-2021-23370 - 升级 swiper 至 &gt;=6.5.1 至 防止 XSS 漏洞（commit 01a63a43）
- 删除无用大文件（commit 5d5f1ccc）
- 合并远程 master 分支（commit 274d09c6）
- !63 AI 队友自动生成：[Security-危急] CVE-2021-23370 - Vlad Tansky swiper 安全漏洞（commit d59d7c3a）
- 旧项目归档打包（commit ea05c6c2）
- 合并远程 master 分支（commit 78e00682）
- 工程维护：更新 .gitignore，忽略构建产物目录和大二进制文件（commit d5204d98）
- anderson（commit a606e0f0）

## v4.8.0 - (2026-03-13)

- 修复表格搜索功能bug、优化V8代码编辑器（commit 98bbf71f）
- 新增OpenClaw管理平台（commit 384083d6）
- 合并远程 master 分支（commit a5b06e9d）
- 新增openclaw（commit 26c52dc5）
- 合并远程 master 分支（commit 7be39492）
- 修复移动端bug（commit 71f10182）

## v4.8.0 - (2026-03-12)

- 修复json表格数据源搜索bug（commit bb3533bb）
- 修复json表格编辑失去焦点的bug（commit fb8f055f）
- 修复搜索不可见bug（commit 8d30336d）
- 图片文件上传组件支持保存完整路径、优化平台系统框架（commit ba40f654）
- 优化代码编辑器（commit 201ed103）
- 修复V8按钮权限bug（commit 56e3ff88）

## v4.8.0 - (2026-03-11)

- 优化数据大屏（commit a9193722）
- 修复数据大屏bug（commit c9cd156a）
- 优化数据大屏（commit 94d1b38b）
- 数据大屏新增Unity WebGL 3D组件（commit 6345f4d0）
- 优化数据大屏3D插件（commit 6d759532）

## v4.8.0 - (2026-03-10)

- 集成go-view（commit 9b3f4297）
- 集成go-view（commit 2a707fd2）
- 集成go-view源码并修复bug（commit 4a2147fa）
- 修复数据大屏设计器bug（commit 5044bd72）
- 优化前端项目构建时间，6分钟降低到3分钟（commit c44a4c43）

## v4.8.0 - (2026-03-09)

- 优化小程序（commit 35788471）
- 完善小程序（commit 349b6696）
- 优化移动端页面、修复下拉框表内编辑bug（commit 692bd901）
- 优化移动端、小程序（commit 85e4c3d1）

## v4.7.9 - (2026-03-08 23:28)

- 优化app打包项目、优化官方文档项目（commit 28008f9d）
- 优化移动端页面效果（commit 3581c57d）
- 更新v4.7.9，优化架构、新增3D自动转换并预览（commit b49b467c）

## v4.7.8 - (2026-03-06)

- [doc]修正前端V8.FieldSet用法说明（commit a9162e20）
- !8 [doc]修正前端V8.FieldSet用法说明 合并拉取请求 !8 从 Cham_Lu/功能/doc（commit 23becc8f）
- Microi.net：更新v4.7.8（commit d6aebf1）
- Microi.AI：更新v4.7.8（commit e4f168f）

## v4.7.8 - (2026-03-05)

- 更新打包apk说明文档（commit df63ea2e）

## v4.7.8 - (2026-03-04)

- 更新说明（commit ac0d4fa5）
- 新增：将 src/config.json 纳入版本库并通过 postinstall 自动忽略本地改动（commit 661540ab）
- 更新config规则（commit 0165fefd）

## v4.7.8 - (2026-03-03 22:02)

- 修复apk打包bug（commit d8d83659）
- 修复apk打包bug（commit 6384da1b）
- 修复apk打包后的bug（commit 5060e916）
- 彻底修复打包apk后的bug（commit 0dbc0285）
- 更新git（commit bff2e71e）
- 更新v4.7.8，修复后端模块引擎bug、前端打包apk扫一扫bug（commit 1525e994）

## v4.7.8 - (2026-03-02)

- 优化前端（commit 96a34d54）
- 允许局域网网访问前端（commit c08cc3cf）
- 修复前端bug（commit 6805aa9e）
- 修复批量打印等bug（commit d9f06310）
- 优化页面效果（commit 81a3306e）
- 优化前端页面效果（commit d7a15469）
- 修复apk返回问题、优化前端界面（commit 0331773e）

## v4.7.8 - (2026-03-01)

- 更新文档（commit 0bc615b9）
- 更新文档（commit 1c1236c5）

## v4.7.8 - (2026-02-27)

- 修复新版前端不支持V8.ParentV8的bug（commit ffe45668）
- 优化前端框架（commit 4f8dfb97）
- 优化前端架构（commit fc920a35）
- 优化移动端（commit 0a1b6254）

## v4.7.7 - (2026-02-26 08:54)

- 更新v4.7.7，优化前后端框架，移植并完善旧版移动端的扫一扫、蓝牙打印等功能（commit 81ebb35c）

- Microi.AI：发布版本 v4.7.7（commit 1add39a）
- Microi.net：发布版本 v4.7.7：开源版允许使用工作流了（commit 0e44672）

## v4.7.7 - (2026-02-25)

- 优化AI编程、完善平台小程序端（commit 7a1247b7）
- 修改源码结构（commit b2c1ea1c）
- 适配全平台小程序（commit 2d63108a）
- 更新文档（commit 73fe3485）

## v4.7.7 - (2026-02-24)

- WebOS源码集成到传统界面中支持切换、新增小程序webview版本、优化前端架构（commit d8843953）
- 更新文档（commit 1d5a3ed1）
- 更新文档（commit bfaffa9f）
- 修复 json表格 添加数据后的提示错误（commit 0da59e7a）

## v4.7.7 - (2026-02-17)

- 优化前端（commit 530fd547）

## v4.7.7 - (2026-02-12)

- 优化前端样式（commit b2484b24）

## v4.7.6 - (2026-02-11 09:44)

- 修复阿里云文件上传bug（commit f4d541d9）
- 修复图片、文件上传控件bug（commit 9709decc）
- 更新v4.7.6，修复新版文件、图片上传等bug（commit 10f5cdd8）

## v4.7.6 - (2026-02-11)

- 修复左右树形结构模板bug（commit 7721efe3）
- 优化前端框架（commit c6c16fd1）
- 优化移动端（commit dbb27d4c）

## v4.7.6 - (2026-02-10)

- 优化前端框架（commit 02489075）
- 优化前端框架（commit bb5dfe3e）
- 允许跟踪 microi.web/bin/Release 配置文件（commit fc5de550）
- 修复: 添加 microi.web/bin/ 例外规则（commit f39b7662）
- 使用根路径语法排除 microi.web/bin（commit ce109867）
- 调整 microi.web/bin 忽略规则（commit b01a43c1）
- 调整 .gitignore: 只跟踪 bin/Release 中的配置文件和 itdos-heart（commit a1e8ec25）
- 调整发布文件（commit 62611b15）

## v4.7.5 - (2026-02-09)

- Microi.AI：发布AI编程：新增自然语言转V8引擎代码（commit ea66004）
- 修复编译后的无法运行的bug（commit f95ccc3c）
- 修改源码目录结构（commit da09f6a8）
- 优化前端框架（commit 148d2ee4）
- 更新最新版数据库（commit 7e64cf56）
- 更新最新版空库（commit 42109f4b）
- 修复子表-表单传值bug（commit a0ffb2e0）
- Microi.net：发布版本 v4.7.5（commit d5170f8）

## v4.7.6 - (2026-02-08)

- 优化前端框架（commit cd8bbf4d）
- 优化前后端框架（commit 1da7ad04）
- 优化前后端框架（commit 326cd7ba）

## v4.7.5 - (2026-02-07 12:43)

- 更新平台文档、修复模块引擎【不显示列】不生效的bug（commit e15690a5）
- 更新v4.7.5，AI编程功能上线（commit eac217dc）

## v4.7.5 - (2026-02-07)

- 临时禁用界面引擎、打印引擎，否则编译打包后会报错（commit c0a3c430）

## v4.7.4 - (2026-02-06 14:15)

- 更新v4.7.4，优化前后端框架、修复bug（commit 8148a144）

## v4.7.4 - (2026-02-06)

- 编译包含嵌入文件（commit bc7b1747）
- 更新文档（commit 270ab5c9）
- 优化系统加载效果、优化系统发布后的体积（commit 2965f2f9）
- 修复单选框、复选框当数据源为sql或其它动态数据源，加载表单未显示选择项的bug（commit a83f0956）

## v4.7.3 - (2026-02-05 04:32)

- 优化前端框架、优化应用商城（commit 4c2126b6）
- 优化前端框架（commit 5afffb3c）
- 优化前端框架（commit b8d5642d）
- 优化前端框架（commit 3b9f12bc）
- 更新v4.7.3，提升应用商城稳定性、优化前端框架（commit 9db05246）

## v4.7.3 - (2026-02-05)

- 修复表单引擎 关联表单 组件bug（commit 70ae0dbc）

## v4.7.2 - (2026-02-04 16:02)

- 现在所有接口同时支持pay-load、form-数据、query了（commit 1de2169b）
- 更新v4.7.2，优化应用商城初始化（commit 08b1e49c）

## v4.7.2 - (2026-02-04)

- 优化前后端框架（commit 7b3a306b）
- 优化应用商城架构（commit afa3a653）
- 修复前端/form-page的相关bug（commit f45299f3）

## v4.7.1 - (2026-02-03 17:45)

- 优化前端框架（commit 745ffcdc）
- 优化前端框架（commit 19b119b0）
- 优化前端框架（commit 64e4d1d3）
- 修复360极速浏览器样式问题（commit e57bd8c0）
- 修复树形选择控件bug（commit d1ca08eb）
- 更新v4.7.1，应用商城功能上线（commit a4136bca）

- Microi.net：发布版本 v4.7.1（commit d7768f4）
- Microi.AI：发布版本 v4.7.1（commit c1895e8）

## v4.7.1 - (2026-02-03)

- 修复后端bug（commit 67d9f3e8）

## v4.7.1 - (2026-02-02)

- 优化前端框架（commit c372880f）
- 优化前端框架（commit 27070c02）
- 升级前端框架（commit be6130b7）
- 优化前端框架（commit 888723d8）
- 优化前端框架（commit 47d5b48f）

## v4.7.1 - (2026-02-01)

- 前端框架优化（commit ba1539d7）

## v4.7.0 - (2026-01-31 16:45)

- AI数据分析功能上线、参考官方文档部署向量数据库、自动差量同步向量数据库、聊天系统上线、完善传统界面vue3版本、完善移动端版本（commit aaaece54）
- 更新v4.7.0：AI数据分析功能上线、参考官方文档部署向量数据库、自动差量同步向量数据库、聊天系统上线、完善传统界面vue3版本、完善移动端版本（commit f3f051be）

- Microi.net：发布版本 v4.7.0（commit 1fa9b2c）

## v4.7.0 - (2026-01-31)

- 修复vue3编译后的bug（commit d437e887）
- 完善前端系统（commit 869105cf）
- Microi.AI：自动意图识别（普通聊天 vs 数据查询）（commit 974862b）
- Microi.AI：语义智能识别（commit 2ce8ef9）

## v4.7.0 - (2026-01-30)

- Microi.AI：初始化 Microi.AI 工程（commit eaaa043）
- Microi.AI：向量数据库完善ApiKey、差量同步（commit d56a1d1）

## v4.7.0 - (2026-01-29)

- 传统界面vue3版本兼容移动端，uni-app移动端不再维护（commit 1b586377）
- 优化移动端显示效果（commit 26356389）
- 完善vue3（commit f27b1325）
- 优化传统界面vue3+兼容移动端（commit 36ac22f9）

## v4.7.0 - (2026-01-28)

- 优化样式（commit 6e243880）
- 优化样式（commit e3bb210b）
- 优化样式（commit be28bcf6）

## v4.6.17 - (2026-01-27 11:25)

- 修复 bug（commit 3483124e）
- 更新v4.6.17，修复bug（commit 6cbec4a2）

## v4.6.16 - (2026-01-27 01:42)

- 更新v4.6.16，修复bug（commit c4498117）

## v4.6.17 - (2026-01-27)

- 优化传统界面vue3版本整体样式（commit ab189a5a）

## v4.6.15 - (2026-01-26)

- 完善传统界面vue3版本，性能极致优化（commit f1b8cee0）
- 完善传统界面vue3版本，体验极致丝滑（commit 601fee56）
- 传统界面vue3修复子表、弹出表格bug，优化样式（commit b318978b）
- 修复文件柜bug（commit 62c10abd）
- 显示文件柜（commit e7bec5ae）
- 传统界面vue3文件结构优化，优化本地二次开发时租户切换不方便的问题（commit b0f7f97c）
- Microi.net：发布版本 v4.6.15（commit 839b1df）

## v4.6.15 - (2026-01-25 06:27)

- 传统界面vue3完善（commit d16b1b92）
- 从Git中移除src/config.json并添加到.gitignore（commit 3663e019）
- 添加 Dockerfile 和 publish-demo.sh 到版本控制（commit 4e3ee842）
- 更新 .gitignore，允许提交 bin/Release 下的 Dockerfile 和 publish-demo.sh（commit e799e198）
- 更新v4.6.15，完善传统界面vue3，修复后端bug，新增前后端docker发布文件（commit 3246aa4e）

## v4.6.15 - (2026-01-25)

- 完善传统界面vue3版本（commit b158b415）
- 完善传统界面vue3版本（commit f6c594a9）
- 更新文档说明（commit 864a3035）
- 更新文档说明（commit 63c8fb1e）
- 完善传统界面vue3版本（commit 965e612a）
- 完善传统界面vue3版本（commit b5437b41）
- 完善传统界面vue3版本（commit 9093cb2e）
- 优化样式（commit 0ba68e68）
- 完善传统界面vue3版本（commit 2d7e671c）
- 优化（commit 353b7170）
- 完善传统界面vue3版本（commit 953e7a40）
- 合并远程 master 分支（commit 8c75a9b5）

## v4.6.15 - (2026-01-24)

- 请前往系统配置默认语言（commit 2e859c19）
- 传统界面升级至 vue3，完成度 95%（commit 452d83b4）
- 优化了语言选择，不再从系统设置项配置语言了，默认中文，可以切换英文，其他语言暂时隐藏了，可以切换各种语言。（commit ee8d9d88）
- 合并远程 master 分支（commit c887ab7e）
- 修复了列表打不开的一些bug（commit f6b1856d）

## v4.6.14 - (2026-01-23 12:53)

- 统一一个地方管理ApiBase（commit 3d10cb9f）
- 历时 7 年的 vue2 传统界面版本（ v1.0.0 ～ v4.6.13 ）即将落幕，本次提交备份。（commit 551811be）
- vue2传统界面升级至vue3前，删除不再使用的文件。（commit acc30924）
- microi.web.vue2项目启动说明（commit 69c58ab8）
- microi.web.vue在/src/config.json中配置ApiBase（commit 1ee2c974）
- 平台vue2版本：当系统设置未配置LoginBottomContent时，默认显示公司名称+系统版本号+当前语言（commit 52b96bcb）
- 修复平台vue2版本bug（commit e92c0f0f）
- 后端更新v4.6.14，修复bug（commit d9905a0e）

## v4.6.13 - (2026-01-23)

- 更新平台文档项目（commit 5bace2f7）
- 更新最新版数据库（commit e6463d59）
- 传统界面升级至 vue3，完成度 80%，提交git备份下（commit 2282b134）
- Microi.net：发布版本 v4.6.13（commit 7a36b59）

## v4.6.13 - (2026-01-22 21:30)

- 更新v4.6.13，优化V8引擎（与JavaScript有更强的兼容性），优化代码编辑器（commit b56afe3f）

## v4.6.12 - (2026-01-22 20:19)

- 更新v4.6.12，升级代码编辑器，修复V8引擎bug（commit 0c338280）

## v4.6.11 - (2026-01-22 15:26)

- 更新v4.6.11，修复bug（commit c4796968）

## v4.6.10 - (2026-01-22 01:26)

- 更新v4.6.10，修复流程引擎bug（commit 4bff96f0）

## v4.6.9 - (2026-01-21 23:51)

- 更新v4.6.9，修复sqlserver下的兼容性bug（commit 1564b574）

## v4.6.8 - (2026-01-21 22:59)

- 更新v4.6.8，优化架构，修复bug（commit bf3d6bd6）

## v4.6.7 - (2026-01-21 16:38)

- 发布v4.6.7，V8编辑器新增完全的V8引擎代码提示功能，修复bug，升级接口引擎配置（commit 6f012453）

- Microi.net：发布版本 v4.6.7（commit 8977556）

## v4.6.6 - (2026-01-21 05:16)

- 更新v4.6.6，应用商城功能即将上线，修复bug（commit c3474be1）

## v4.6.5 - (2026-01-20 16:24)

- 发布v4.6.5，优化性能、优化架构、修复Sqlserver兼容bug（commit 2a894265）

## v4.6.5 - (2026-01-20)

- 新增JTokenEx.FromObject替代JToken.FromObject（commit c3ddd8b3）

## v4.6.5 - (2026-01-19)

- 升平台文档项目（官方文档）且新增首页动画效果（commit 17724386）

## v4.6.4 - (2026-01-17 13:18)

- 类库动态依赖、去除不必要的consone.log（commit 24c2f292）
- 更新平台说明（commit 7e75a6d2）
- 新增开发环境的内存监控、优化前端内存占用（commit bf137dea）
- 修复V8.Db.Firs()无效的bug（commit b86fd075）
- 发布v4.6.4（commit fa1839b9）

- Microi.net：发布版本 v4.6.4（commit b2d3dc3）

## v4.6.4 - (2026-01-17)

- 优化性能、修复bug（commit 7ff72ffd）
- 格式化所有代码（commit 0d1ad70b）

## v4.6.3 - (2026-01-16 17:26)

- 修复SqlCount缓存bug（commit 26aaf682）
- 修复系统管理角色权限配置bug（commit 8063c905）
- v4.6.3发布，修复新版v4.x的一些bug（commit 3eb140b3）

- Microi.net：发布版本 v4.6.3（commit 001ce50）

## v4.6.1 - (2026-01-16 09:05)

- Microi.net.dll更新v.4.6.1，性能优化、架构优化、修复bug（commit aa3d031e）

- Microi.net：发布版本 v4.6.1（commit ce58f15）

## v4.5.0 - (2026-01-13 00:49)

- Microi.net.dll发布v4.5.0，优化架构、性能（commit ff6fa01b）

- Microi.net：发布版本 v4.5.0（commit 736063b）

## v4.5.0 - (2026-01-13)

- 修改类库配置（commit 3fdad260）
- 优化解决方案目录（commit d0f904ad）
- 新增[AI+低代码]开发文档（commit ead5bcd0）

## v4.5.0 - (2026-01-12)

- 更新平台文档（commit 03d0efb0）
- 修复ORM的.ToArray()方法（commit 29a37c8c）
- 更新AI写接口引擎文档（commit 46e4e606）
- 修复前端V8.SearchSet()使用新版_Where的bug（commit 6e86126f）
- 格式化文件（commit 1d777b8f）
- 格式化整个项目（commit 89f07314）
- 优化前端性能（commit 085df807）
- 优化前端表单引擎性能（commit ce8381ad）
- 优化前端框架性能（commit 4d935d51）

## v4.4.3 - (2026-01-11)

- 修复架构优化后带来的一些bug（commit f1d3e82e）
- 更新平台文档，加入AI辅助开发文档（commit 40d04b3b）
- 更新平台文档（commit 28b01560）
- 更新文档（commit 494e7685）
- 更新平台文档（commit 75f53475）

## v4.4.2 - (2026-01-10 23:44)

- Microi.net：发布版本 v4.4.2（commit 2d1a0e9）

## v4.4.2 - (2026-01-10)

- 完善SqlSugar与Dos.ORM的切换、修复SqlSugar应用bug（commit abd82532）
- 更新前端版本号（commit d063328c）
- 修改说明（commit d5b4a6a1）
- 新增L1、L2多级缓存、所有代码格式化、修复bug、去除_CurrentSysUser（只使用_CurrentUser）（commit cd8f3144）
- 更新配置文件（commit e7365e34）
- 更新配置文件（commit a1c0415c）
- 修复L1级缓存bug、现在_CurrentUser固定为JObject类型（commit d32d74f1）

## v4.2.0 - (2026-01-09 09:43)

- Microi.net：发布版本 v4.2.0（commit 637e401）

## v4.2.0 - (2026-01-09)

- 更新最新demo数据库、空库数据库（commit d79d1d02）
- 优化代码（commit 4f62e682）
- 优化Microi.ORM库（commit bab3ea15）
- 去除不必要的引用（commit c0963d18）
- 【重要更新】支持ORM切换了，现在平台支持Dos.ORM与SqlSugar之间的切换了（commit 8076d979）

## v4.2.0 - (2026-01-08)

- 新增Microi.Core核心库，开放更多后端源码，优化系统架构（commit 7efec1cc）
- 优化代码文件目录（commit 142b9aec）
- 修改git配置（commit 818d2130）
- 优化Dos.ORM（commit 79f44662）
- 优化Dos.Common（commit a8f3d99b）
- 优化Dos.ORM（commit c7656ff8）
- 前后端的Guid均修改为Ulid（commit d9a5c22f）
- 优化Office插件（commit 7768e077）
- 优化代码（commit 0988043a）

## v4.1.1 - (2026-01-07 02:50)

- 修复前端报表引擎的子表表内编辑在新增时无法保存的bug（commit eea08497）
- Microi.net.dll更新v4.1.1、更新平台文档（commit 2d5593d7）

## v4.1.1 - (2026-01-07)

- 优化高并发线程处理（commit cc016bb6）

## v4.1.1 - (2026-01-06)

- 扩展V8.WeChat.RSAEncrypt函数，微信支付转账api可能会用到。（commit 434bacea）
- 更新平台文档项目（commit b45ba368）
- 更新平台文档（commit 6a98d2e5）
- 移动端打包apk新增支持摄像头扫二维码、条形码，且支持V8函数。（commit c9b628c5）
- 移动端打包apk新增支持摄像头扫二维码、条形码，且支持V8函数。（commit fab66eec）

## v4.1.1 - (2026-01-05)

- 更新试用地址、平台文档、项目说明（commit 61b11e13）
- 更新说明（commit 699b19eb）
- 更新平台文档项目（commit 515c5660）

## v4.1.0 - (2026-01-04 15:02)

- 【重要更新】平台架构升级、Microi.net.dll升级至v4.0（commit 6e6921c8）
- 【重要升级】后端开放更多源码（99%）、Microi.net升级至v4.1.0（commit f96c7826）

- Microi.net：发布v4.0（commit b64a6e1）
- Microi.net：发布版本 v4.1.0（commit e5d6f8f）

## v4.1.0 - (2026-01-04)

- 修复移动端V8.FomEngine.GetTableData的bug（commit e48b7255）
- 解决方案添加开源[Microi.MongoDB]项目的引用（commit 053aa85d）

## v3.5.2 - (2025-12-29)

- 优化移动端蓝牙打印（commit 93657dc0）
- Microi.net.dll发布v3.5.2，放宽V8引擎容错机制（commit 0f74d8da）
- 优化错误提示（commit ef1eaa9e）
- 修复查看密码功能bug（commit 531cb640）

## v3.5.1 - (2025-12-27)

- Microi.net.dll发布v3.5.1、优化.net10发布机制、V8引擎增加容错机制（commit 4b4edb4b）
- 优化服务器端控制台输出（commit 935711a1）
- vue3 uni-app移动端上线蓝牙标签打印功能（commit 031cd9ca）

## v3.5.0 - (2025-12-26)

- 升级至.NET10、修复SaaS引擎主库修改配置后需要重新登录的问题、更新平台文档（commit 8ac35db1）
- 升级至.NET10、Docker镜像地址更换、更新平台文档（commit b6ffc00a）
- 重要升级：接口引擎、后端V8事件支持await、async等异步操作。（commit a57bba89）
- 后端V8引擎支持console、setTimeout两个对象（commit f3cbd140）

## v3.3.1 - (2025-12-25)

- 修复新版Where可能存在的bug、升级系统功能、更新平台文档（commit 86a9aecc）
- Microi.net：发布版本 v3.3.1；工程维护（commit d762198）

## v3.4.0 - (2025-12-23)

- 优化MQ消息队列、更新MQ文档（commit ab7c23b0）

## v3.4.0 - (2025-12-22)

- 移动端弹出表格新增关键词搜索（commit 84a8a9e7）
- 修复移动端下拉框远程搜索的bug（commit 0f4980d6）

## v3.4.0 - (2025-12-21)

- 优化界面引擎文件（commit e4738a82）

## v3.4.0 - (2025-12-20)

- 优化前端web样式（commit c3b48854）
- 优化框架样式（commit 4e95a25f）

## v3.3.0 - (2025-12-19)

- 平台架构升级、新增开源服务器端自动升级程序（commit e3e337b1）

## v3.2.0 - (2025-12-16)

- 升级任务调度引擎、更新平台文档（commit cb718f7f）
- 升级任务调度引擎，更稳定、更健壮。（commit def47519）

## v3.1.4 - (2025-12-15)

- V8引擎扩展新增支持更新阿里云更新ESA DNS、更新平台文档（commit f8d80265）

## v3.1.4 - (2025-12-14)

- 更新平台文档（commit 23f56c26）
- 更新平台文档（commit b3e436b6）

## v3.1.4 - (2025-12-13)

- 更新平台文档（commit f1d3c986）

## v3.1.4 - (2025-12-12)

- 分布式任务调度系统修改为默认CPU核心*10线程（之前默认10线程）、现在允许并发执行执行、更新平台平台（commit 51fc59c4）

## v3.1.4 - (2025-12-11)

- 更新平台文档（commit 8d8af042）

## v3.1.4 - (2025-12-07)

- 更新平台文档（commit e1ed2c75）

## v3.1.4 - (2025-12-04)

- 修复V8.SearchSet的bug（commit 1a4236bf）
- 更新平台文档（commit feef3c94）

## v3.1.4 - (2025-12-03)

- 更新平台文档、uni-app移动端蓝牙打印支持（commit 25968351）

## v3.1.4 - (2025-12-02)

- 更新平台文档（commit d60dd369）
- 更新uni-app移动端（commit af57f5ce）
- 修复版本号导致的导入功能报错（commit 0ddbfb39）
- 更新后端版本号（commit 63dcad4a）

## v3.1.4 - (2025-12-01)

- 更新平台文档（commit b780c680）
- 更新平台文档（commit b280b394）
- 优化表单设计器样式（commit c0fb5e0d）
- 更新平台文档（commit 42c3f743）
- 优化OsClient域名匹配机制、更新平台文档（commit e8eceb65）

## v3.1.3 - (2025-11-29)

- 更新平台文档、修复HideFormTab无效的bug（commit 9c5ebb71）
- 修复V8.HideFormTab无效的bug（commit fb9e4e13）
- 修复V8.HideFormTab()被隐藏后默认不显示的bug（commit 7cce5b10）
- 更新平台文档（commit 2c24a3d0）
- Microi.net.dll nuget发布v3.1.3，更新平台文档（commit 79e0ad82）

## v3.1.1 - (2025-11-28)

- 优化代码（commit 1febe8ea）
- 更新平台文档（commit d9b5e627）
- 更新平台文档（commit 0f082b26）

## v3.1.1 - (2025-11-27)

- 插件引擎文档从microi-web源码迁移至microi-doc平台文档项目中（commit 730f9dfb）
- 更新平台文档（commit 7d31bedc）
- 界面引擎甘特图组件添加了视图切换配置，修复了项目结束时间计算错误的问题。（commit 1858cb67）
- 优化了界面引擎甘特图组件，左边持续时间&gt;24小时转换成天+小时（commit 9cc6868e）

## v3.1.0 - (2025-11-26)

- Microi.net.dll nuget更新至v3.0.1、更新平台文档（commit 6450fa51）
- 更新平台文档（commit 45358416）
- 更新平台文档（commit 217aeed6）
- Microi.net.dll nuget发布v3.1.0、更新平台文档（commit 7f624b3e）
- 更新平台文档（commit bb30bcf0）
- 更新平台文档（commit 400e7aff）
- 新增_ForceUpt参数支持强制修改自动编号字段、更新平台文档（commit 9d6275fe）
- Microi.net：工程维护（commit 5f19d07）

## v3.0.0 - (2025-11-25)

- 优化redis、更新平台文档（commit fc38335a）
- Microi.net.dll升级至v3.0.0（大量更新、升级至.net standard2.1）、更新平台文档（commit 8df3eba2）
- 修复了tab点击问题（commit 982fadc8）
- 文件优化（commit a548fafe）
- Microi.net：优化代码（commit d6f9b13）

## v3.0.0 - (2025-11-24)

- Microi.net：工程维护（commit a2967e2）
- Microi.net：bug修复（commit 58707fe）
- Microi.net：优化事务（commit f6b03bb）

## v3.0.0 - (2025-11-22)

- 更新平台文档（commit ae960a5d）

## v2.8.5 - (2025-11-20)

- Microi.net.dll nuget升级至v2.7.0。、考虑到V8代码中处理事务对象的繁琐性，甚至可能出错，现对平台进行了非常强大的升级：【当接口引擎、后端V8事件代码出现return { Code : 不等于1 }、或V8.Result = { Code : 不等于1 }时，平台会自动回滚事务，反之提交事务。】 【之前的V8代码不受影响，仍然兼容】 B、修复V8.方法.AddSysLog()无法在服务器端V8事件中调用的bug C、修复在服务器端V8事件中调用接口引擎传入V8.DbTrans后，会导致报错【Connection must be valid，open 至 rollback transaction】（commit e80d9d5f）
- 为了程序业务逻辑的严谨、健壮性，现在表单服务器端提交前、提交后的V8事件代码若出现了异常，也会中止表单的提交、并且回滚事务。【之前并不会，这将可能导致以前事件中的异常bug全出显现出来，然后导致业务单据无法保存】（commit 1243305c）
- Microi.net.dll发布v2.8.0，修复服务器端V8事件与接口引擎之间的相互调用可能会出现V8.DbTrans对象被提前提交或回滚的问题（commit 0895c2bd）
- Microi.net.dll nuget更新至v2.8.5 重大优化升级、修复switch传值bug、更新平台文档（commit 570a2076）
- 修复表单引擎下拉框组件显示bug（commit aada51b2）

## v2.7.0 - (2025-11-19)

- 流程信息新增下一节点名称显示、修复ParentId树形控件字段不显示的bug、更新平台文档（commit 95517a6f）

## v2.7.0 - (2025-11-17)

- 修复表内编辑一些组件（如开关）在刷新数时但DOM不刷新的bug（commit 11aa18e2）
- 合并远程 master 分支（commit 6371a7ca）
- 修复下拉框控件当存储字段为Id、显示字段为Name时，在表内编辑时显示的是Id而并不是Name的bug（commit 098eb3df）

## v2.7.0 - (2025-11-15)

- 优化了提交代码，左右结构的时候，不要提交的参数校验（commit 65a614c7）

## v2.7.0 - (2025-11-14)

- 更新平台文档（commit 8fd36c67）
- 更新平台文档（commit 2e49aa35）
- 更新平台文档（commit b87b72b6）

## v2.7.0 - (2025-11-13)

- 更新版本引用（commit b569a431）
- 更新平台文档、新增V8.SelectedData代替V8.TableRowSelected（commit 1a1de68a）
- 更新平台文档（commit a04756e0）
- 更新平台文档（commit e4d115a8）

## v2.6.3 - (2025-11-12)

- 更新平台文档（commit 73efe19c）
- 后端Microi.net.dll升级至v2.6.3（commit 9d328698）
- 后端Microi.net.dll升级至v2.6.3（commit 29c6e145）

## v2.6.3 - (2025-11-11)

- 修复前端表单提交前V8事件无法通过【return Code : 0】阻止表单提交的bug、修复时间条件无法正常搜索的bug、修复数字控件无法搜索的bug、更新平台文档、后端Microi.net.dll更新v2.6.3（commit 184807df）
- 修复数字控件在可搜索列中默认为0的bug（commit 19a2ec27）
- 优化左右结构，左边选中，右边新增的bug（commit 21ccabd9）
- 彻底修复数字控件在可搜索列中默认为0的bug（commit 88396d05）
- 更新平台文档（commit a63a79c6）

## v2.6.2 - (2025-11-10)

- 修复新版_Where不支持多表联查搜索关联表字段搜索的问题（commit 7c4ea479）

## v2.6.0 - (2025-11-06)

- 优化角色管理、更新平台文档（commit 15e3f4fb）
- 登录页面，发送短信验证码会更新图形验证码的bug（commit d8041cac）
- 优化登录验证码刷新问题（commit 4a022bed）
- 更新平台文档（commit 86aa490a）
- 更新平台文档（commit 87642431）
- 更新平台文档（commit d52c858f）

## v2.5.0 - (2025-11-05)

- 更新平台文档（commit 7c1c81d6）
- 优化了自定义树形组件，添加了层级增加按钮显示的限制条件（commit 3c4518ef）

## v2.5.0 - (2025-11-03)

- 更新静态地址（commit 16bb5f75）

## v2.5.0 - (2025-11-01)

- 更新平台文档（commit 7264eb4e）
- 更新平台文档（commit eb5a5b82）
- 更新平台文档（commit 7fd2278d）
- 更新平台文档（commit a59695ce）

## v2.5.0 - (2025-10-31)

- 优化了登录页，去掉了项目特定代码，标题字号小了一号，在标题太长导致的换行（commit e1be952e）
- 新增默认不显示审计字段、修复审计字段显示bug问题（commit 68f884cb）
- 合并远程 master 分支（commit 67acab93）

## v2.5.0 - (2025-10-29)

- 优化了OpenAnyTable弹窗表单新增，编辑和删除是父表的bug，同时对弹窗的左右结构进行了优化，使其选择功能更加强大（commit 4c38ea83）
- 修复通用数据列表导出功能不支持新版_Where条件语法的bug、更新平台文档（commit b1b35164）
- 优化了插件引擎，支持第三方依赖包CDN引入，这样可以不用污染主框架的依赖包，开发插件更容易插拔，超强，另外不局限于vue2语法了，支持vue3写法。（commit 4ee67e85）
- 合并远程 master 分支（commit 1e38519c）
- 优化了表内编辑数据状态的命名，避免冲突，DataStatus改为_DataStatus（commit c2a81940）

## v2.5.0 - (2025-10-28)

- 更新文档（commit 6ce81300）
- 更新平台文档（commit b4bad271）
- Microi.net：工程维护（commit 4699630）

## v2.5.0 - (2025-10-27)

- 下拉多选框的搜索由OR条件修改为在，性能更高。（commit b622fa6a）

## v2.5.0 - (2025-10-25)

- 子表表内编辑，如果开启了主表保存后提交，则统一提交生效，否则是编辑了及时生效（commit 1c14c622）
- 优化readme文档（commit b5606885）

## v2.5.0 - (2025-10-24)

- 优化了界面引擎甘特图，支持以小时为最小单位，支持读取、编辑动态json列，优化了刻度1格显示1小时（commit 3aa1b0e8）
- 优化了表格图片展示，现在可以直接预览图片和多图预览。（commit 588e5aa0）
- 优化了表格图片懒加载（commit cadba51c）

## v2.4.6 - (2025-10-23)

- 现在word模板导出时图片字段会取图片的默认宽高（commit 2c2edca3）

## v2.4.6 - (2025-10-21)

- 修复获取接口引擎列表时也获取了代码导致慢的问题、更新平台文档（commit cdb7af01）

## v2.4.6 - (2025-10-20)

- 更新平台文档（commit 13651ff1）
- 修复下拉复选框搜索无效的bug（commit acec8f09）

## v2.4.6 - (2025-10-18)

- 修复V8.ClickFormTab的bug（commit 0fd3300a）
- 更新引用版本号（commit 1b8bf9ac）

## v2.4.5 - (2025-10-17)

- Microi.net.dll发布v2.4.5，修复接口引擎缓存初始化在一些特殊情况下会失败的bug（commit 2aac56a6）
- 修复接口引擎即使未启用下也能通过接口自定义地址调用的bug（commit 4850aef5）
- 优化接口引擎（commit c2c003b5）
- 表格批量选择的列宽度降低到合理范围（commit 8cf87f8d）
- 模块引擎新增【表格操作列固定宽度】配置（commit 1bccd09b）

## v2.4.5 - (2025-10-16)

- 左右结构优化（commit b7dfd2a5）

## v2.4.1 - (2025-10-15)

- 更新平台文档（commit 6a36a95c）
- 更新平台文档（commit 6be10de9）
- 修复特殊情况下部分表单的字段分组显示不对的bug（commit 3eb00802）
- 所有接口替换均支持$ApiBase$、$OsClient$变量了（commit fc6195ac）

## v2.4.0 - (2025-10-14)

- 全新_Where用法上线，用法见平台文档，兼容老版写法（commit 5c5852f3）
- 合并远程 master 分支（commit 4833d8e7）
- 替换老版_Where为新版_Where格式（commit 902b3266）

## v2.4.0 - (2025-10-13)

- 表单引擎-日期控件新增【多选天、多选月、多选年】的功能（commit c222d2d7）
- 左右结构优化（commit 0d2613d3）

## v2.4.0 - (2025-10-12)

- 修复了左右结构的bug（commit 65b189e6）

## v2.4.0 - (2025-10-11)

- 表单字段分组现在跟分组Id进行关联（而不再是分组名称一改导致分组失效）、修复表单分组排序字段是字符串的bug（commit dd9d8f65）

## v2.3.3 - (2025-10-10)

- 修复一些特殊格式和段落的模板导出时字段无法被正确替换的问题（commit 7cc1f3a0）
- 修复刘老师的代码bug、现在模块引擎的where条件和join条件是代码编辑器了、修复代码编辑器高度无法自定义传入的bug（commit eed539b8）
- 修复模块引擎中有多个代码编辑器组件时导致编辑器无法最大小化、最小化的bug（commit 3600f2f4）
- 修复一些特殊情况下模板导出子表数据只有一条的bug（commit 33417dc4）
- 取消Form表单中的Tabs懒加载功能，此功能会导致每次Tabs切换都刷新Tabs里面的表单内容且不保留状态（commit 956894cd）
- Microi.net：工程维护（commit f605bb8）

## v2.3.3 - (2025-10-09)

- 移动端审批页面优化（commit 7e56c1de）
- 表内编辑一起提交数据出现bug，先恢复以免影响使用（commit 46210123）
- 导出模板支持图片了、新增用户操作记录功能、模块引擎中的iframe接口引擎支持V8.Param.MenuId了。（commit ccb9f707）
- 可通过设置隐藏通用搜索框，有些情况下需要固定框精确等值搜索。（commit 6f0be384）

## v2.3.3 - (2025-10-08)

- key重复，值变更会报错（commit 5dd21fc4）
- 现在可以根据模块设计里的表内编辑，配置是值变更更新数据，还是最后表单提交一起保存数据（commit f1cd1a65）

## v2.3.3 - (2025-10-01)

- 更新了左右结构的菜单（commit 8265f38e）
- 重要，1,优化了左侧菜单背景颜色浅色，下拉菜单的箭头颜色获取设置的颜色；2,优化了二级下拉菜单背景颜色跟随主系统颜色的bug；*二级下拉菜单右侧的箭头太靠右（commit 126a55e9）

## v2.3.3 - (2025-09-30)

- 更新接口引擎实战文档：在接口引擎中对文件的接收、下载、上传（commit 090fb7d3）

## v2.3.3 - (2025-09-29)

- 更新平台集成OnlyOffice文档（commit 32188db8）
- 移动端的层级才需要高一点（commit 2559356b）
- 修复样式bug（commit 1d13af5e）
- 合并远程 master 分支（commit d7840bf1）

## v2.3.3 - (2025-09-28)

- 优化进度条组件、修复模块引擎V8按钮代码无法编辑的bug（commit dd9d41ac）
- 修复url参数带上Keyword之类的会影响到子表的bug（commit 2cde4db2）

## v2.3.3 - (2025-09-27)

- 现在模块引擎iframe支持接口引擎单点登录到第三方系统了、修复进度条组件在表格不显示的bug、现在进度条会有默认的颜色区分了（commit 4529950d）

## v2.3.3 - (2025-09-26)

- 更新文档（commit 936a4ced）
- 现在表单搜索字段无视大小写了、修复创建时间默认宽度（commit 67203cf5）
- 表单引擎新增进度条控件（commit c37e341e）
- 合并远程 master 分支（commit ff0ffbbc）
- 详情按钮可用代码控制，sys_menu表需要新增DetailCodeShowV8字段（commit 5834e2fd）
- 修复审计字段显示问题（commit e5f8ba3d）
- 合并远程 master 分支（commit 8b6502aa）

## v2.3.3 - (2025-09-23)

- 新增OnlyOffice支持、现在默认的审计字段也会在表单中显示了（在新建表的时候自动创建对应的字段控件、并且支持模块引擎中排序）（commit 5da6e0bc）
- 更新平台文档（commit 8e40eb8e）

## v2.3.3 - (2025-09-20)

- 修复了搜索下拉框，无法清除已选数据的bug（commit 313800b3）

## v2.3.3 - (2025-09-18)

- 优化模块引擎，【查询列、可搜索列】配置现在是以表格展示了（commit 98c04946）
- 修复做菜单与右边内容区域的层级关系，提高右边内容区域的层级以防止全屏编辑器被左边菜单树遮盖（commit a0add829）

## v2.3.3 - (2025-09-17)

- 更新平台文档（commit 5e599933）

## v2.3.3 - (2025-09-15)

- 去掉console代码（commit c2f8bd5d）
- Microi.net：工程维护（commit 12c14e9）

## v2.3.3 - (2025-09-14)

- 优化架构、修复地址组件bug（注意：若列表表内编辑开启了地址控件类型的字段，会导致列表页DOM渲染非常卡[地址数据量过大]！此问题将来再优化！）（commit bf88ed63）
- 表单引擎，如果表名、表描述过长导致换行影响用户查看，虽然现在解决不够完美，暂时保证超过一行用省略号（commit 7e4ab534）
- 新增登录成功运行一段代码，可执行业务伙计或者弹窗提示，openanyform等（commit f4383307）

## v2.3.3 - (2025-09-13)

- 优化项目架构代码（commit 35751faa）
- 优化系统架构代码（commit 94c28324）
- 修复sqlserver无法修改物理字段名的bug（commit d447a7ad）
- 上传SqlServer2017版主库数据库、修复sqlserver修改字段无法修改字段说明的bug（commit 6e1d894e）

## v2.3.2 - (2025-09-11)

- api接口系统首页由黑客帝国效果修改为官方文档（commit d860f7d5）
- 合并远程 master 分支（commit 053396ea）
- api接口系统首页由黑客帝国效果修改为官方文档（commit 09007e93）

## v2.3.2 - (2025-09-10)

- 更新平台文档（commit 9144288d）
- 更新了左右结构，同时新增了自定义移动端列表显示列（commit 0b24c6f8）

## v2.3.2 - (2025-09-09)

- 修复优化循环表单组件后产生的多选下拉框不显示bug（commit ea95cb3e）
- 修复表内编辑FormSet不生效的bug（commit 03d33917）
- 新增了openanytable的翻页选择功能，选择的数据会先存进临时数据，统一提交（commit 8bc3631e）
- 优化了文档，更新了OpenAnyTable的doc使用方法（commit 7764eef3）
- 优化了form页关联id不显示的bug（commit c7b7bd15）

## v2.3.2 - (2025-09-08)

- 修复表内编辑下拉框第二次下拉无数据的bug、修复循环表单组件时出现的bug（commit 3ec3f84b）
- 修复数字控件现在是循环模式的时候产生的bug（commit 74a206f8）

## v2.3.2 - (2025-09-07)

- 优化了移动端获取osclient的方法，更灵活（commit 33072cc3）

## v2.3.2 - (2025-09-05)

- 优化表单组件循环（commit f59822b7）

## v2.3.2 - (2025-09-04)

- 更加严谨了一些 如果有了undefind判定 还是返回真（commit 4e53e186）
- 格式化周总评论区部分代码（commit 489fc8eb）
- 删除不必要的软件包.json文件，会导致第三方公司扫描误报为高危漏洞（commit cbabe5e3）
- 修复毛总实现[表内编辑阻断数据提交]后，导致的正常表单[值变更事件]不再触发的bug！！！（commit e8482fb0）
- 二次修复毛总实现[表内编辑阻断数据提交]后，导致的正常表单[值变更事件]不再触发的bug！！！（commit 5f5c4972）
- 二次修复毛总实现[表内编辑阻断数据提交]后，导致的正常表单[值变更事件]不再触发的bug！！！（commit 0e1828a6）
- 第三次修复毛总实现[表内编辑阻断数据提交]后，导致的正常表单[值变更事件]不再触发的bug！！！（commit 84b2dec6）

## v2.3.2 - (2025-09-03)

- 更新说明（commit 1d7b1137）
- 增加了移动端的编辑按钮，可执行代码来显隐藏（commit e3ac098f）
- 优化了移动端新增按钮，可代码控制（commit edd3e3bd）
- 新增数据评论功能、修复移动端表单信息被数据日志层级覆盖显示的样式问题（commit ac2a3ec5）
- 合并远程 master 分支（commit af690a48）

## v2.3.2 - (2025-09-02)

- 修复了合并引起的冲突（commit 0bf3c19c）
- 回退 "修复了合并引起的冲突"（commit 1fc89b8e）
- 回退 "优化了下拉树"（commit 576821a2）
- 添加虚拟滚动组件（commit 39f242d9）
- 修改虚拟滚动列表名称（commit f755413d）
- 新增：改函数 改地址（commit 519ea0b6）
- 移动端目录优化了一下，客户的定制页面放到customer去了（commit a34227d7）

## v2.3.1 - (2025-08-30)

- 前端增加V8.OsClient访问当前saas租户的OsClient值，与后端一致（commit 8f1511d9）
- 下拉框默认开启搜索（commit b8c5e6b9）
- feat：目前值变更事件拦截 支持4种组件数字 单行文本 下拉单选 多行文本（commit 83918d5c）
- 优化了下拉树（commit 951b0f64）
- bug修复（commit 5834247f）
- 修复：【重大修复】下拉选择 可以正常显示 通过下拉逻辑出来的值了！！！！！！！！！！！！！！（commit 04ba6bd0）

## v2.9.0 - (2025-08-29)

- 接口引擎扩展V8.WeChat类、Microi.net发布v2.9.0（commit fb715421）
- 修复：值变更事件 现在如果有false的返回值 则 阻止更新事件（commit 1faa0654）
- V8.方法微信相关加密函数通过.net core类实现、V8.WeChat微信相关加密函数通过第三方类实现，效果都一样（commit d73c37ff）
- 合并远程 master 分支（commit 914545c8）

## v2.2.9 - (2025-08-25)

- 更新V8.Http用法文档（commit 8b6767ec）
- 更新文档（commit f43651a4）

## v2.2.9 - (2025-08-24)

- 优化移动端样式（commit 0bc7afe3）

## v2.2.8 - (2025-08-20)

- 修复数据列表开关控件搜索无效的bug（commit c3cf1ed9）
- 延迟执行搜索1秒改成500ms（commit 0dff2d41）
- 新增V8.SearchParam可访问搜索参数（commit 260cc2d5）
- 现在表内编辑的控件事件也能正常的访问V8.OldForm对象了。（commit d4cf7383）

## v2.2.8 - (2025-08-19)

- 修复移动端级联下拉没有更新的问题，使用 nextTick 确保 DOM 更新解决（commit f696d353）
- 修复了cardDetail.vue 页面diyFormFields参数的问题，使用computed保持响应式并不污染props.diyFormFields，采用深拷贝模式处理。（commit 416d674c）

## v2.2.6 - (2025-08-18)

- 项目上的文件以及审批意见高度增高、按钮颜色（commit 2df48c13）
- 增加了lable宽度（commit d30f1afc）
- 修复警告（commit bbaa1802）
- 合并远程 master 分支（commit 3db34fdb）

## v2.2.3 - (2025-08-16)

- 审批意见输入框大一些（commit 409136a4）
- Microi.net.dll发布v2.2.3，diy_table、sys_menu等查询现在会走redis缓存，数据列表、单条数据查询性能提升2-3倍。（commit 8bfff402）

## v2.2.5 - (2025-08-15)

- 修复了搜索条件下拉树选择不会赋值的问题，这是个vue和elementui的经典问题，涉及到下拉组件的内部机制问题。（commit b72710c0）
- Microi.net：工程维护（commit ca3b8d5）

## v2.2.5 - (2025-08-12)

- 原来写法vue2懒加载不生效，直接改掉了，（commit dc31df29）
- 优化了插件商城底座，使其支持路由和实体文件查找两种方式，既支持菜单展示，又支持嵌入form表单内部，可以在表列表显示自定义组件。（commit 9a16c1f5）
- 合并远程 master 分支（commit 67f521e7）
- 优化表单权限样式、v8 条件的按钮不再 admin 必显示（commit 4225da89）
- 默认不显示新增按钮，否则配置了不显示的条件后每次都是先出现再消失（commit 67998325）

## v2.2.5 - (2025-08-10)

- 目录树懒加载（commit 810e6ea7）
- 优化了目录树结构（commit ed10be22）

## v2.2.5 - (2025-08-09)

- 更新了界面设计引擎，优化了地图组件，地图可以通过url参数接收中心点地址（commit 9a218eee）
- 更新文档（commit 3d790b71）
- 修复了一下排序不升级，及样式优化（commit b99d5ebc）

## v2.2.5 - (2025-08-08)

- 管理员添加模块菜单默认赋予该页面权限，无需再手动添加（commit 16a6a9b5）

## v2.2.5 - (2025-08-07)

- 新增FormDataId URL参数（用法见平台文档）、表单模板引擎只在预览时渲染、更新平台文档项目等（commit 74fc33c7）
- 更新平台文档（commit c5edd762）
- 完善V8前端函数FormClose等等、完善平台文档（commit 6b34d0d5）

## v2.2.5 - (2025-08-06)

- 优化表格操作栏，默认按钮使用text格式，并去除换行。white-space: nowrap;改成 white-space: unset;（commit 14eaab7a）
- 合并远程 master 分支（commit b0d5511d）
- 优化表格按钮样式（commit 064daf40）
- 修复弹框顶部横线颜色没有跟随主题的问题，修复了页面权限列表超出高度没有滚动条的问题，还原了表格右侧操作区域的样式（commit 6eac30dd）

## v2.2.5 - (2025-08-05)

- 优化了新增按钮v8事件，执行新增和详情v8事件时，应禁止原默认的打开表单事件（commit 6e586c64）

## v2.2.5 - (2025-08-04)

- 更新文档（commit 19f93ead）
- 合并远程 master 分支（commit dc3bad5d）
- 单行文本框插槽按钮单独配置是否只读（commit e19fcb89）
- 合并远程 master 分支（commit 04c1ada4）
- 新增了表单分组 第一个选项卡固定显示，需要在表单设计添加字段 TabsTop，然后开启表单分栏。（commit 8aca85f0）

## v2.2.5 - (2025-08-03)

- 后端添加了Message控制器，用来验证消息加密解密（commit fca47fb9）

## v2.2.5 - (2025-08-02)

- 新增了一组表格内部标签样式（commit 304b5522）
- 优化了readmin.md 文档了，添加平台对goview大屏、three.js 3D模型渲染引擎、腾讯IM集成的介绍。（commit 6fa26a81）

## v2.2.5 - (2025-08-01)

- 合并远程 master 分支（commit cf80c72a）
- 修改了本地开发环境配置项（commit 4694e961）
- 降低sass版本 解决开发过程当中的报错（commit 0a9d0ea7）
- 插件包验证windows.js 函数使用，已认证可以使用（commit 9a6db757）
- 接口引擎日志对type空类型进行了处理（commit 38d144f1）
- 修复element表格排序箭头不正常显示正序、倒序颜色的bug（commit 97b048a9）
- 更新平台介绍（commit d7d828c2）
- 更新平台介绍（commit fa3f92fa）
- 更新平台介绍（commit e734348a）
- 更新平台文档（commit 12893245）

## v2.2.5 - (2025-07-31)

- 修复了&lt;i&gt;标签引发的各种问题，i 标签点击事件和鼠标悬停事件不触发，已使用span或者button包裹。（commit 1f6ef056）
- 表单设计器优化：单行文本框添加了按钮插槽功能，按钮插槽功能可以级联弹出表格功能（commit 4181cdaf）
- 控件类型优化（commit 80e94cb4）
- 合并远程 master 分支（commit 4f217511）

## v2.2.5 - (2025-07-30)

- 优化了接口引擎日志，解决 Msg: "未处理的异常：Element 'All' does not match any 字段 or property 的 class 日志报错的问题（commit 6ba4a629）

## v2.2.5 - (2025-07-29)

- 吾码插件商城底座开发完毕，流程清晰，文档齐全。（commit 7f701bb0）
- 优化路由和 devDependencies 两个npm包依赖（commit a0da414f）
- 【父组件刷新子表】如果子表是隐藏的，则不刷新（commit ae4ca623）
- 合并远程 master 分支（commit 70aa6999）
- 模块引擎新增【固定列】功能（commit d6ee6c7a）
- 去除界面引擎的翻译功能（commit 128cda57）
- 合并远程 master 分支（commit 34c8c5df）

## v2.2.5 - (2025-07-28)

- 【新增】列表删除时执行表单提交离开后事件（commit 456f3c18）
- 合并远程 master 分支（commit 420128f0）
- 优化（commit a973f545）
- 【新增】查看详情删除执行V8事件（commit dc275fce）
- 修复层级bug，添加插件商城基础（commit 244aa1c4）
- 合并远程 master 分支（commit 9d52f463）
- 添加了插件商城研发文档（commit 707a8d38）

## v2.2.5 - (2025-07-27)

- 优化了移动端，可以公众号认证（commit c304058d）

## v2.2.5 - (2025-07-26)

- 弹窗背景阴影层（commit ec9d810a）

## v2.2.5 - (2025-07-25)

- 优化了自定义按钮，不能回调父主键的bug（commit c02ac804）

## v2.2.5 - (2025-07-24)

- 优化了列表页下拉菜单显示的问题（commit 50bdc1df）
- 根据标识决定是否执行表单进入事件（子表提交后不执行）（commit 8f31710f）
- 合并远程 master 分支（commit 1a4b438c）

## v2.2.5 - (2025-07-23)

- 修复了列表页下拉框显示value不显示label的问题，修复了编辑框点击模块设计的层级问题（commit 09b903de）
- 合并远程 master 分支（commit f0ba41e4）
- 解决冲突（commit a7e52263）

## v2.2.1 - (2025-07-22)

- 修复数据源引擎z-index 层级不显示图标配置页面的问题（commit fec6c2bc）
- 修复了富文本框无法上传本地视频的问题（commit 765ffc74）
- 星进定制页面，（commit 394da492）
- token bug修复（commit d0d82613）

## v2.2.1 - (2025-07-18)

- 添加了接口引擎日志（commit 7ad396d9）

## v2.2.1 - (2025-07-17)

- 优化了界面引擎，修复了切换mock模版时不能保存成功的问题（commit c76bd534）

## v2.2.1 - (2025-07-16)

- 优化了二级列表的显示（commit 32412557）

## v2.2.1 - (2025-07-15)

- 升级了左右菜单导航方式（commit 67cda1da）
- 修复了权限不能级联全选的问题（commit ef4f1070）
- 优化了二级菜单的分类点击提交方法（commit 788359fa）

## v2.2.1 - (2025-07-14)

- 将表单设置权限接口改为后端实现（commit da79492d）

## v2.2.0 - (2025-07-11)

- 大版本更新：新增MQTT服务器、修复bug、Microi.net.dll更新到v2.2.0（commit 1600bc5a）
- 修改了甘特图的保存条件（commit 0ef466e8）

## v2.2.0 - (2025-07-09)

- 添加了在表单直接设置表单权限，优化了层级显示顺序等（commit 1ec7ae8e）
- 优化了弹出层相关代码（commit d06fc71c）
- app端兼容优化（commit 98da9385）
- 合并远程 master 分支（commit b0691160）
- 修复了模块引擎无法重置父级的问题，修复了全局主题样式个别组件背景色的问题（commit 39667389）
- 合并远程 master 分支（commit 222f6189）
- 权限保存提示词修改（commit 622343be）

## v2.2.0 - (2025-07-06)

- 修复了二次模块引擎编辑弹窗时自定义表的下拉菜单zindex过低不显示的问题，修复了新建自定义表没有设置描述时名称多一个-字符的怪异问题（commit 56d94312）

## v2.2.0 - (2025-07-05)

- 优化了模块引擎，可以在模块引擎直接建表，无需去表单引擎建表。（commit efd72c39）

## v2.2.0 - (2025-07-04)

- 【美勒特】项目团队成员保存优化（commit 89a8a463）
- 合并远程 master 分支（commit b2e6a933）

## v2.2.0 - (2025-07-03)

- 优化了基本搜索，添加了节流，延迟1秒（commit 086eacf5）
- 优化了组织部门页面（commit dff397c4）

## v2.2.0 - (2025-07-02)

- 优化了级联搜索（commit 42d2e613）
- 优化了级联搜索重置搜索和默认加载时清空该页级联搜索缓存。（commit 1181deac）

## v2.2.0 - (2025-07-01)

- V8.ParentV8用法优化（commit 6531d5c9）
- 【美勒特】打开apqp生成弹窗默认赋值功能（commit 8191bae3）
- 合并远程 master 分支（commit 6f1c586c）

## v2.2.0 - (2025-06-30)

- 移动端优化，组件优先级（commit 98d2cd75）
- 合并远程 master 分支（commit 01aa5481）
- 移动端表单提交验证优化（commit 688d8352）

## v2.2.0 - (2025-06-29)

- 修复了下拉树代码判断是否显示删除和编辑按钮没生效的bug（commit 44cf0356）

## v2.2.0 - (2025-06-28)

- 修复子表只能加载一个的问题（commit c6ceaec6）
- 修复子表查询的问题（commit 2183b25c）

## v2.2.0 - (2025-06-27)

- 去除debugger 检索恢复（commit 45af40ae）
- _Keyword 关键词搜索加节流防抖功能1秒，防止连续输入卡顿（commit cd2af09d）
- 修复了多语言版本判断时语法错误（commit 2c07fa53）

## v2.2.0 - (2025-06-26)

- 在方式复选框组搜索默认空值改成空数组字符串序列化（commit 50ace860）
- 暂时取消组合筛选条件优化，场景太多需要重新规划（commit 96a915b1）

## v2.2.0 - (2025-06-25)

- 界面引擎优化了甘特图灯箱以及负责人多人情况下不让保存的问题（commit 0425b9cb）
- 修复bug（commit 4da474ca）
- 优化了平台搜索，添加了防抖1秒延迟，添加了多条件检索缓存优化（commit 231b83ad）
- 合并远程 master 分支（commit 2c44b6a0）

## v2.2.0 - (2025-06-24)

- 优化代码（commit c8c508d1）
- 优化代码（commit aa4841dc）

## v2.2.0 - (2025-06-23)

- 界面引擎优化甘特图，添加灯箱相关功能（commit a02c4e15）
- 生成活动提交防重（commit 207dab1c）
- 合并远程 master 分支（commit 0313a677）

## v2.2.0 - (2025-06-18)

- 修复李赛赛多语言代码报错导致系统无法登录的bug、登录接口新增_ClientType标记（如果是PC则会有过期时间）（commit fb05b191）

## v2.2.0 - (2025-06-17)

- 界面引擎重大更新，使用AI协助重构。优化了所有资源配置，拆分了大文件js，优化了性能，修复了一些历史问题。（commit 0a039c6c）

## v2.2.0 - (2025-06-14)

- 优化了审批界面点击附件打开新页面浏览，不能关闭本窗口的bug（commit db9753e1）
- 界面引擎翻译兼容之前语言，默认不做处理，不然需要2秒间隔翻译时间（commit 1650cf98）

## v2.2.0 - (2025-06-13)

- 更换了语言系统，界面引擎同步更新语言（commit 07ea3b2a）
- 流程引擎代码区全屏被左边菜单挡住（commit 38a81846）

## v2.2.0 - (2025-06-12)

- 新增APMS测试活动看板（commit 7d490863）
- 更新文档项目（commit 92d8ceff）
- 合并远程 master 分支（commit 0a19637b）

## v2.2.0 - (2025-06-11)

- 美勒特活动看板获取数据优化（commit 37c2c127）

## v2.2.0 - (2025-06-10)

- 跨域配置支持通配符了（commit c909ff19）

## v2.2.0 - (2025-06-09)

- 删除冗余文件（commit e4e13178）
- 修复oracle大量bug、SaaS引擎新增CorsAllowOrigins跨域配置、流程引擎现在会自动更新_FlowState审计字段（commit 00b282ac）

## v2.2.0 - (2025-06-08)

- 优化了搜索框中，下拉菜单选项不正确，加了个文本，把下拉框作为文本搜索，至少能保证有个能用的（commit 89033e52）
- 优化了下拉框无数据，直接多了一个转文本框搜索的配置（commit 6beaf836）
- 每个控件都匹配了表内编辑的日志记录功能，之前只匹配了文本，现在其他控件也匹配了（commit 91fecf30）

## v2.2.0 - (2025-06-06)

- 优化了地图区域空间点击绘制，数据为空会报错。（commit 389854ad）

## v2.2.0 - (2025-06-04)

- 优化移动端 使用 openany form时提交子表保存的问题（commit 6126d99f）
- 界面引擎优化判断小屏幕适配（commit 9ea496d9）
- 修复ShowClassicTop、ShowClassicLeft样式问题（commit 6e38bb2c）

## v2.2.0 - (2025-06-03)

- 修复日期搜索的bug（commit 718aca0c）
- 界面引擎添加了暗黑皮肤持久化，添加了页面定时刷新（commit 7a39f38d）
- Microi.net：工程维护（commit 28f0afd）

## v2.2.0 - (2025-06-02)

- 优化了语言显示条件，移动端的bug修复，星进 定制页面（commit 5673956e）

## v2.2.0 - (2025-06-01)

- 打印引擎支持批量打印，数据源改成数组即可（commit 79e3978b）
- 优化了序号判断（commit d4ebe32a）
- 删除按钮点击，页面卡死，已处理（commit 6631ddb6）
- 提交和删除无返回值导致页面卡死（之前代码都能执行，原因未知）（commit 42444530）
- 优化了登录页面自定义颜色和是否显示中英文的判断（commit d60fe514）

## v2.1.6 - (2025-05-31)

- 优化了文档（commit d97ef94a）
- docker示例发布文件（commit 800311ba）
- 开放更多后端源码、优化部分接口（commit be9fb045）
- 更新源码目录结构（commit 23dcae64）
- 优化目录结构（commit 64342099）
- 优化目录（commit 0cafe05c）
- 更新开源协议（commit 58ce0022）
- 移动端openanyform优化（commit 2dd7972a）

## v2.1.6 - (2025-05-30)

- 优化样式、更新文档（commit 18336617）

## v2.1.6 - (2025-05-29)

- 对导出格式进行分别判断，一种是json格式的，一种是office文本格式的（commit 5b141a8e）
- 优化了移动端审批的bug（commit c7649bf3）
- 默认配置（commit 2a7ddd0e）
- 合并远程 master 分支（commit ac8031d3）

## v2.1.6 - (2025-05-28)

- 集成腾讯IM接口（commit c901bec7）
- 集成了腾讯IM通信，后端提供了两个三个接口，一个/api/Im/GetUserSig，一个批量导入用户接口/api/Im/MultiAccountImport，还一个/api/Im/MultiAccountDelete接口，另外系统配置项添加三个参数，分别是IMSdkAppid、IMSecretKey、Identifier（commit 030bb612）

## v2.1.6 - (2025-05-27)

- 优化了隐藏列表序列号的bug（commit 0d54b58b）
- 表单必填项，颜色全局配置（commit c6a98da8）
- 优化了导出按钮，json格式不能导出的问题（commit 7a3fb46e）
- 这两个传参还是需要的（commit 70cff14b）
- 修复了导出excel Blob格式未处理的问题（commit 0e4eb08f）

## v2.1.6 - (2025-05-26)

- 优化了界面引擎持久化暗黑模式，添加了页面定时更新，优化了甘特图保存提醒（commit 7dc308d6）
- 优化了甘特图回调接口参数（commit 029e682a）
- 隐藏列表默认序号（commit c50797f7）

## v2.1.6 - (2025-05-25)

- 优化PC WEB在移动端的显示（commit 204d5deb）
- 更新了搜索的bug和文档的bug（commit dd445933）
- 优化了二级栏目分类管理url自动获取（commit 24304be2）
- 工业提出列表某个栏目想隐藏默认的序号，列表自己有序号（commit 745e112f）

## v2.1.6 - (2025-05-24)

- 修复了界面引擎甘特图实时更新控制失效的bug（commit 8b5028a2）
- 删除多余配置文件、修改项目说明（commit e4775e20）
- !4 删除多余配置文件、修改项目说明 合并拉取请求 !4 从 微吾科技/master（commit d83f1cec）
- 优化数字输入框精度（commit 2d7d2e85）
- 合并远程 master 分支（commit a1e7722e）
- 更新文档（commit e1134b00）
- 合并 https://gitee.com/microios/microi.net 的 master 分支（commit 9cd59c5c）
- 更新文档 合并拉取请求 !5 从 微吾科技/master（commit fb7aa97f）
- 更新文档（commit 82a20f40）

## v2.1.6 - (2025-05-23)

- 修复oracle bug、优化样式、更新基于吾码的开源项目（commit 2a7dbfbd）
- 修复了页签切换时，没有根据fullPath来判断的历史bug（commit e18bbc75）
- 修复了页签切换时，没有根据fullPath来判断的历史bug（commit 354044a4）
- 更新了界面引擎适配移动端的问题（commit 3f9e63bc）
- 接口地址动态配置还原为localConfig.json 模式（commit bb4e8783）
- 界面引擎饼图组件标签显示添加了{b}{c}{d}三种方式（commit a6943ddc）
- 二级菜单联动优化（commit 1a874f9a）
- 样式优化、移动端显示表格时不再固定详情、更多按钮的操作列。（commit 2f008279）
- 搜索截流（commit 0874d016）
- 界面引擎适配移动端滚动条问题优化（commit 9ea026d5）
- 合并远程 master 分支（commit 5e259044）
- 现在查询接口替换、导出接口替换走json格式的请求了，而不再是form-数据（commit 53306538）
- 优化了界面引擎移动端没有识别移动模式的问题（commit dbe2fabe）
- 合并远程 master 分支（commit 2caaee71）
- 彻底修复移动端滚动条滑动不顺畅的问题（commit 36037132）

## v2.1.6 - (2025-05-22)

- 修复了页签切换时，没有根据fullPath来判断的历史bug（commit 1f020b3b）
- 继承了3D模型渲染引擎（commit cb3652fc）

## v2.1.6 - (2025-05-21)

- 修复搜索区域不显示的bug（commit a39a39cb）

## v2.1.6 - (2025-05-19)

- 修改.net9默认调试运行端口为7266（commit 52fef014）
- 优化了界面引擎统计组件，加了精度配置，优化了甘特图组件，添加了bar颜色和底色用于区分进度效果（commit 82093304）

## v2.1.6 - (2025-05-17)

- 更新了甘特图变更事件传参类型（commit da464260）
- 优化文件（commit 75b09f65）
- 合并远程 master 分支（commit c62a3526）
- 更新[基于吾码的开源项目]（commit af1e976a）
- 更新[基于吾码的开源项目]（commit 2b5b1b45）
- 重要：开源最新uniapp uni-ui移动端版本（commit c25b324e）

## v2.1.6 - (2025-05-16)

- 界面引擎 1.甘特图添加了日列视图宽度自定义，通过数据源来控制编辑状态。2.柱状图表添加了X、Y轴转换。3.支持组件、容器、页面跨端克隆复用。（commit 7c6eed22）
- * 修复地图组件bug * 优化搜索 * 优化样式（commit d090eea4）
- 界面引擎甘特图优化了更新提交，可以支持变更手动提交，也可以支持实时提交（commit 7c4f5ef5）
- 修复了界面引擎甘特图上一次更新遗留的小问题（commit 5d15dd4e）

## v2.1.6 - (2025-05-13)

- 合并 功能/master-merge 分支（commit 85b06f4b）
- 💎界面引擎重大更新,添加了组件和容器的克隆功能，添加了跨页面拷贝粘贴渲染功能，可以复用历史模板，大大增加开发时间（commit d43c1bdc）
- 在线文档预览功能bug修复。目前的在线浏览只能浏览office文档，如果附件里传了png和pdf还是不能访问（commit d311b947）

## v2.1.6 - (2025-05-12)

- !2 测试：check formatting 合并拉取请求 !2 从 毛家顺/功能/master-prettier3（commit f54c8671）
- 新增：先把启动报错给解决了（commit 26de18e7）
- 去掉了临时的传参代码，并测试出来查询接口替换后的查询，一定要用系统的路径才可以，页面做了提示（commit 5919cd30）
- 111（commit 5255261b）
- 将 master 分支合并到 功能/master-merge（commit 1dafeb67）
- 优化了界面引擎表格组件支持html格式，添加了高级日历组件（commit af2abbf2）
- 修复了界面引擎在设计时预览会自动切换移动端模式的bug（commit 7e42349c）

## v2.1.6 - (2025-05-10)

- 更改替换后端接口地址方式，localConfig.josn 方式改为.env模式（commit 0c6161e3）
- apiBaseUrl 默认值判断（commit 2f8b1adc）
- test（commit ea8017be）
- 111（commit ad67865e）
- 测试：check formatting（commit 8484e43b）
- 测试：check formatting（commit 83974ca1）
- 1111（commit b5556fb0）
- 测试：check formatting（commit 411385ca）
- 测试：check formatting（commit 5205c7a5）

## v2.1.6 - (2025-05-09)

- 修复bug（commit 213160fe）
- 修复bug（commit e1c0b90c）
- 优化了界面引擎甘特图放大缩小没有级联下拉框的问题，修复了表格组件内置饼图多个列共用的问题（commit 49595fa4）

## v2.1.6 - (2025-05-08)

- 前端V8.FormEngine支持最新写法（commit 8277bcde）
- 本次大量更新：优化搜索、优化样式、修复bug（commit fba9a1a4）

## v2.1.6 - (2025-05-07)

- 修复了系统皮肤的优先级关系，优化了主题色覆盖各种场景的问题，比如加载框，个别按钮的颜色等（commit abf203d7）
- 优化了主题色覆盖范围（commit e0729169）

## v2.1.6 - (2025-05-06)

- 界面引擎优化了office组件接收中文url参数乱码不识别的问题，描述组件添加了小饼图效果，添加了适配移动端的模式（commit b514375f）
- 刘老师转存修改（commit eaf2ca92）
- 更新了office-widget组件在iframe方式调用时，从demoObj 配置 filePath 路径（commit f61b13aa）
- 优化了界面引擎区域地图组件，默认渲染市级而非省级（commit 5c1f796c）
- 新增：二维码组件开发完成（commit 6e7e901d）
- 界面引擎修复了在线文档预览功能（commit 78992f28）
- 合并远程 master 分支（commit 0990d957）

## v2.1.6 - (2025-05-01)

- 优化了弹窗的提示框及界面引擎盖的bug（commit a8f6c42b）
- 合并远程 master 分支（commit 83762655）

## v2.1.5 - (2025-04-29)

- 界面引擎tabel组件添加了表格内部饼图小组件，用于显示占比和进度（commit 233b7b22）

## v2.1.5 - (2025-04-27)

- 修复了界面引擎同时多开设计保存会污染同级页面的问题（commit 4c686e1f）
- 优化了界面引擎区域地图点击触发事件跳转路由（commit 95526fb1）

## v2.1.5 - (2025-04-26)

- 增加了一种传参格式，便于接口替换的接收参数（commit 784dc0e1）
- 修复了表内编辑没有记录日志的bug（commit 923d4fcc）

## v2.1.5 - (2025-04-25)

- 二级目录页面优化（commit 91b5d48b）

## v2.1.5 - (2025-04-24)

- 更新了界面引擎甘特图，优化了诸多功能（commit 83c4ebe9）

## v2.1.5 - (2025-04-23)

- 修复了定时任务功能新增任务时不填写参数引发的一些列问题（commit 5a42d999）

## v2.1.5 - (2025-04-21)

- 优化了界面引擎区域地图，添加了回调接口地址和动态渲染宽高（commit adfef94c）
- 优化了界面引擎区域地图路由跳转（commit 3782c551）

## v2.1.5 - (2025-04-20)

- 界面引擎添加了区域钻地图组件，优化了甘特图组件（commit 93e5cf95）

## v2.1.5 - (2025-04-16)

- 默认主题色可以从后台系统配置（commit 28c51b54）
- 优化了界面引擎统计组件，添加了子项页面跳转路径（commit 511215aa）
- 界面引擎升级更新（commit 1485d01b）

## v2.1.5 - (2025-04-14)

- 重构了界面引擎动态搜索组件，优化了部分组件逻辑，优化了部分素材的来源方式（commit 63810c49）

## v2.1.5 - (2025-04-12)

- 现在日期搜索支持时分秒了（commit 0ea84f2e）
- 修复了界面引擎更新后老数据的兼容性问题（commit 7ea12ea9）
- 新增前端支持子系统模块显示（commit 3393c312）
- 新增发布用的Dockerfile文件（commit 45d44bc4）

## v2.1.5 - (2025-04-11)

- 优化了界面引擎动态搜索下拉框初始值问题，添加了@修改事件实时刷新（commit bc09852c）
- 优化了界面引擎甘特图和表格组件（commit 14244265）

## v2.1.5 - (2025-04-09)

- 添加了界面引擎容器动态时间日期，修复了select 第一次未生效的问题（commit e5876b78）
- 新增Microi二次开发demo、支付宝H5支付示例2（commit 4d2cee53）
- 新增Microi二次开发demo、支付宝H5支付示例2（commit 1d602891）
- 修复了界面引擎动态搜索相关问题（commit 2c1e3f84）

## v2.1.5 - (2025-04-08)

- 优化了界面引擎统计组件，添加了日期区间筛选条件（commit 581fa677）
- 界面引擎大部分组件添加了动态条件和日期筛选（commit ab93331a）

## v2.1.5 - (2025-04-06)

- 添加了界面引擎容器内组件组局刷新功能，优化了请求封装url异常报错的问题（commit 27cf566d）

## v2.1.5 - (2025-04-05)

- 优化了界面引擎容器背景颜色配置，优化了滚动条鼠标滚轮失效的问题。（commit 0db2f21e）

## v2.1.5 - (2025-04-04)

- 优化了页面左侧底部高度，无查看详情禁止双击查看查看下拉按钮按条件隐藏等（commit c96aaea1）

## v2.1.5 - (2025-04-03)

- 修复了左边菜单栏logo 标题过长换行的问题（commit 3f1b5a99）
- 添加了左边菜单标题的字号和截取配置，在系统配置里配置，默认截取12个字符，字号默认20px（commit a9b28b6b）
- * 默认导出现在下拉复选框会正确的只显示名称字段，而不是json * 修复关联表默认导出时关联的表字段未导出值的bug * 更新文档（commit 9a8924a0）
- 合并远程 master 分支（commit bca3799b）

## v2.1.5 - (2025-04-02)

- 添加了技术文档侧边栏的模板引擎用法，中英日文同步添加，无需额外翻译了。（commit c0f2d7d3）
- 模板引擎添加单图和多图列表显示的用法（commit ad0fc2ee）
- 更新数据库、更新一键安装脚本、更新文档（commit 1b0a4257）
- 合并远程 master 分支（commit 965f9eea）
- * 一键安装脚本支持ubuntu24.*了，更新mysql版本为5.7、redis版本为7.4.2 * 更新文档（commit e1abd162）
- 更新文档（commit d391bf9e）
- 更新文档（commit 4c89e064）
- 文档：文档更新（commit e0c0c6a0）

## v2.1.5 - (2025-03-31)

- 新增接口地址（commit 81764df2）

## v2.1.5 - (2025-03-30)

- ApiBase以docker环境变量最优先（commit 2ed85bb0）
- tabel 组件添加了颜色设置（commit 9be0e0bc）
- 优化了内置界面引擎表组件的设置属性，添加了颜色配置（commit 62ba7d04）
- * 新增控件数据源可选择接口引擎配置 * 修复控件数据源为接口引擎、数据源引擎时首次不加载数据的bug（commit 80929536）
- 优化了模块引擎的显示内容及分页数量，虚拟表的显示标签（commit a5be5b90）

## v2.1.5 - (2025-03-29)

- 降低并发 修改翻译key（commit d2e81f3c）
- 新增：将剩余的翻译翻译完全（commit cf88a197）
- 加一个运行时长优化（commit d65ddaae）
- 新增：针对faq优化脚本（commit c20fbbbf）
- 新增：faq文档更新（commit d30ac501）
- 新增界面引擎默认路由（commit 87ae60f8）
- 合并远程 master 分支（commit bbe295a7）
- 新增：脚本优化（commit e102db9a）
- 合并远程 master 分支（commit d784c854）
- 新增：脚本更新（commit 440ef26e）
- 更新文档、优化接口引擎、合并PC传统界面组件扩展代码（commit cf8ec88b）
- 将打印引擎内置到项目中，不再调用官方demo（commit 8574702c）
- 新增根据路由获取界面引擎数据（commit 704456e9）
- 合并远程 master 分支（commit e120112e）
- 优化了下拉单选数据源引擎（commit 807036b0）
- 修复界面引擎路由匹配的bug（commit 7cf839b4）
- 合并远程 master 分支（commit 6170975d）
- 更新数据库：首页由界面引擎配置（commit ef46adb4）

## v2.1.5 - (2025-03-28)

- 优化文档（commit c6d3d6ad）
- 优化文档项目源码（commit 084f6f24）
- 新增：脚本优化（commit a0821e02）
- 新增：脚本更新（commit f1489838）
- 新增：修复所有文档（commit b8a3675c）
- 新增：脚本更新（commit f5406c09）
- 新增：文档更新（commit 6520415f）
- 新增：修复vue（commit d30e6518）
- 脚本更新（commit 0cae3e41）
- 新增：脚本优化（commit 30d28150）
- 文档更新（commit 54ac4854）
- 在vue2中内置了界面界面引擎，无需调用官方界面引擎（commit d285acc5）
- 修改了界面引擎渲染器的地址（commit cfec811c）
- 合并远程 master 分支（commit 80ed648a）

## v2.1.4 - (2025-03-27)

- 删除两个无用测试页面，主要测试数据源引擎的问题（commit 61e5058a）
- 新增三套基于吾码的开源项目：企业官网UniApp；图片壁纸、短视频UniApp；支付宝H5手机网站支付。（commit 98d28d7e）
- 合并远程 master 分支（commit 710c090b）
- 更新接口引擎导入接口替换以及进度文档说明（commit 74c8002e）
- 修复首次运行系统多语言加载错误的bug（commit 42b752ec）
- !1 修复首次运行系统多语言加载错误的bug 合并拉取请求 !1 从 吴东明/master（commit b71e3fe3）

## v2.1.4 - (2025-03-26)

- 新增：翻译脚本优化（commit 928dfeed）
- 新增：翻译内容更新（commit 232fd2df）
- 新增：全量跑了一遍（commit 0d79319e）
- config: 翻译脚本优化（commit 4ccf31eb）
- 修复：修改了表的翻译（commit 7a846cfa）
- 支持支付宝支付后回调（也支持接口引擎处理回调），演示地址：https://os.microios.com:1301/（commit 58f9b0d4）
- 合并远程 master 分支（commit 707bf728）

## v2.1.4 - (2025-03-25)

- 开源扩展V8.Alipay支付宝H5支付，演示地址https://os.microios.com:1301/（commit 7b80e26a）
- 添加了日文语言，版面全面支持译文，包括侧边栏导航、底部（commit de3d3300）
- config: 添加翻译脚本（commit 2c2c6b63）
- 文档：docs lang 更新!（commit 1acb7948）
- 回退 "文档：docs lang 更新!"（commit edc2ac70）
- config: 脚本更新（commit 36cc98f2）
- 工程维护：脚本更新（commit 53b8286b）
- chroe: 修改翻译脚本目录（commit 0a8a8f11）
- 新增：更新多语言文档（commit 4d664984）
- chrome: 补充翻译脚本（commit 87049e91）
- 新增：补全index.md文件的翻译（commit 7d0aab96）
- 综讯固资数据大屏微服务（commit e0b2dc51）
- 合并远程 master 分支（commit f29fd9b2）
- 对接支付宝手机网站支付2.0、v3.0，已测试通过，测试地址：https://os.microios.com:1301/（commit 44510bf0）
- 合并远程 master 分支（commit 1e16f3a7）

## v2.1.4 - (2025-03-24)

- 修复了相同页面不同参数页签不添加的问题，path 改成 fullPath即可（commit d10ccb01）
- 编辑和删除可写v8代码控制是否显示（commit 0fa76bf1）
- apibase修改（commit 3d7231a3）
- 合并远程 master 分支（commit 9e0a5bd1）
- 修改传统界面源码说明文件（commit 654a75ec）
- 修改apibase（commit b56cff52）
- 合并远程 master 分支（commit 407a4244）
- 修复报错字段 not found on DiyMessage.Msg的bug（commit 90641ac0）
- 优化了后端接口地址替换的方法，只需在src文件下加一个localConfig.json，即可，该文件已被gitignore忽略。（commit e8edc07b）
- 合并远程 master 分支（commit c1b6ea37）
- ApiBase合并（commit 5551f690）
- 合并 https://gitee.com/ITdos/microi.net 的 master、master 分支（commit ba8012be）

## v2.1.4 - (2025-03-23)

- 更新数据库、MinIO代码优化（commit ee469ce7）

## v2.1.4 - (2025-03-21)

- 修复任务调度在暂停状态下，修改后任务又重新启动且没有更改状态为已启动的bug（commit 12383cfa）
- 说明文件修改了（commit 0704d338）
- 合并远程 master 分支（commit c8025e90）

## v2.1.4 - (2025-03-20)

- 更新了fqa页面，将历史fqa记录转移到doc文档（commit 9861847b）
- 合并远程 master 分支（commit dd3857ed）
- 修改了fqa错误语法，更改为faq（commit 4a79b1e1）
- 修复V8.Office.SendEmail()端口的bug（commit 2d37029f）
- 默认ApiBase配置为api-china.itdos.com（commit 75d7fd10）
- 合并远程 master 分支（commit d828fdf9）

## v2.1.4 - (2025-03-19)

- 刘诚新增允许角色才可查看表单修改日志（commit cb4c2224）
- 合并远程 master 分支（commit f1e6a794）

## v2.1.4 - (2025-03-18)

- 合并远程 master 分支（commit 1a0b481a）
- 现在V8导出excel支持根据数据类型判断单元格为数字（commit 40f48076）

## v2.1.4 - (2025-03-17)

- 修复了组织机构组件修改后列表页没有及时刷新的问题（commit 9633800b）
- 修改文档说明（commit 6509faf6）
- 合并远程 master 分支（commit 4ae4d00e）

## v2.1.4 - (2025-03-16)

- 注释了 InputInputEvent 触发CommonV8CodeChange 事件，修复了Init()事件内DiyCommon 未指向self的小bug，（commit 19a4d903）
- 【代码格式优化】纯格式化代码，没做任何修改（commit d495c6ad）
- 修复了组织机构下拉框不显示值的问题（commit cfd5d599）
- zero303 组织机构组建报错（commit d5b1cd6f）
- 合并远程 master 分支（commit cf765cbc）

## v2.1.4 - (2025-03-14)

- 新增：修改配置（commit eda60d4c）
- 新增：上传文档（commit ea57250e）
- 文档项目源码更新（commit 470b5067）
- 合并远程 master 分支（commit 3f10bcc7）

## v2.1.4 - (2025-03-13)

- 更新文档项目源码（commit 5f4f080d）

## v2.1.4 - (2025-03-12)

- 更新文档项目源码（commit efde5199）
- 更新文档项目源码（commit 84cce421）
- 更新文档项目源码（commit a515066e）
- 更新文档项目源码（commit 92d4ddbc）
- 文档新增最新doc.microi.net文档地址（commit 1b76e710）
- 更新文档项目源码（commit 4dce4526）
- 更新文档项目源码（commit dda7d109）
- 更新文档项目源码（commit 7af99d1e）
- 更新文档项目源码（commit 05a5a97a）
- 更新文档项目源码（commit 24cf5d7a）

## v2.1.4 - (2025-03-11)

- 更新文档项目（commit 737029ac）
- 合并远程 master 分支（commit 1b49b37d）
- 更新文档项目（commit 96714ea5）
- 更新文档项目（commit c498966e）
- 更新文档项目（commit 9bfc2f80）
- 导出Office Excel时现在数字类型字段会生成数字类型单元格，而不是string类型单元格（commit 2dc28865）
- 文档项目更新（commit a1e0c4fa）

## v2.1.4 - (2025-03-10)

- liucheng 去除表鼠标经过，背景颜色和文字都是深色的bug（commit 837a7927）

## v2.1.4 - (2025-03-09)

- 更新最新demo数据库和最新empty空库（commit 951cb124）
- 合并远程 master 分支（commit 62ad1f3d）

## v2.1.4 - (2025-03-07)

- 去除了doc文档 软件包-lock.json 版本控制（commit 2d8b5320）

## v2.1.3 - (2025-03-06)

- * 修复iframe菜单无法滚动的问题 * 更新microi.net版本（commit 622eb29e）
- microi.doc 软件包-lock.json（commit dc123ce4）
- 合并远程 master 分支（commit cea8af96）
- 目录优化（commit 9b83926b）
- 目录优化（commit 696e0f65）
- 目录优化（commit d7b0d29f）
- 优化了一些宣传md文档内容（commit 60aa9e95）
- 优化发布文件（commit 5c8ad519）
- 合并远程 master 分支（commit dfed45f3）
- Microi.net：工程维护（commit ba1697c）

## v2.1.2 - (2025-03-05)

- 修改了issues 和 pull 请求 地址，doc文档迁移到主分支上了，之前地址变掉了。（commit 317dce6f）
- 修改了issues 和 pull 请求 地址，doc文档迁移到主分支上了，之前地址变掉了。（commit 7cb17bb0）
- 合并远程 master 分支（commit b9a135c2）

## v2.1.2 - (2025-03-04)

- 修复了启动项在VisualStudio 无法启动的问题（commit f29dc2f0）

## v2.1.2 - (2025-03-03)

- 修复了monaco-editor运行报错的bug，现在不需要手动改了，已升级到0.33.1,(vue2支持最高版本)（commit 774c60a0）

## v2.1.1 - (2025-03-01)

- 代码文件目录结构优化（commit b995519e）
- 代码文件目录优化（commit 95def418）
- .net gRPC客户端演示代码提交（commit 2b9f0d90）
- 解决git代码冲突（commit 6e40753b）
- 修复解决方案文件乱码导致vs code无法正常加载.net解决方案的问题（commit 4a6546d4）
- 去除logs的排除（commit 568da95d）
- 合并远程 master 分支（commit 5fe0bcc0）
- 添加日志，从git排除文件移除（commit da268095）
- 优化文档项目（commit 6542c637）
- 修复批量审批，取消按钮的bug（commit 272cf02b）
- 撤回按钮，DiyCommon not defined 报错的bug（commit 403236dd）

## v2.1.1 - (2025-02-28)

- 优化了搜索样式优化（commit 2dba22e3）
- 新增了一个离开事件（commit 03e7a5cc）
- 合并远程 master 分支（commit 4699a73d）
- 新增了了技术文档项目（commit 83796cb9）

## v2.1.1 - (2025-02-27)

- 优化了编辑页tab选项卡从v8引擎进入时默认加载选项，优化了主题色el-tag的color（commit 49b848a2）

## v2.1.1 - (2025-02-25)

- 优化了左边菜单栏，添加了一件换主题（commit e803fd31）

## v2.1.1 - (2025-02-20)

- 固资的微服务页面 检查该条业务数据是否已删除，已删除则删除对应的流程数据（commit c5bc70ec）

## v2.1.1 - (2025-02-18)

- * 现在表内快速新增也会执行表单进入事件了 * 修复表内快速新增后保存时判断必填项错误的bug（commit 37185293）

## v2.1.1 - (2025-02-17)

- 修复弹出表格在某些特殊情况下可搜索字段搜索没有效果的bug（commit e1933ecc）

## v2.1.1 - (2025-02-10)

- 自定义导出时，当数据行没有图片自动1行高度，当数据行有图片时自动增加高度。（commit b0a43ff7）
- 合并远程 master 分支（commit 841988df）

## v2.1.1 - (2025-02-06)

- * 传统界面版本前端100%开源 * V8.SearchSe、V8.SearchAppend现在可以传入_Where条件了 * 弹出表格控件的[弹出前事件V8代码]新增V8.OpenTableSetWhere函数 * 修复PC前端v3版本表内编辑下拉框两次选择数据源丢失的bug * PC前端表内编辑新增的数据现在不会再显示详细和编辑按钮了 * 修复PC前端表内编辑未验证通过导致按钮一直loading的bug * 修复OpenTable将脏数据保存到了字段.Config中的bug * 现在数据即使sys_osclients表数据为空，只要环境变量包含了redis配置，系统也能正常运行了 * API接口系统由.net8.0升级至.net9 * RabbitMQ.Client升级至7.0.0 * 移除IS4身份认证，使用.net9.0自带JWT认证 * 新增V8.MongoDb系列操作，见平台文档 * 现在接口引擎返回纯字符串（非json）时，不会再额外返回两个双引号了 * 现在接口引擎支持接收xml参数了，同样使用V8.Param访问参数 * 现在接口引擎支持直接写 return { Code : 1 }了，而不是一定需要写V8.Result = { Code : 1 }; return; * redis键名进行了统一命名优化 * PC前端现在支持绑定微信公众号oepnid了 * 新增V8.TranslateEngine翻译引擎，并且也将diy_lang多语言管理表进行了缓存（非redis） * 现在接口引擎完全支持微信公众号相关接口了，如模板消息、公众号自定义菜单、帐号绑定等等 * 现在模块引擎的【可搜索字段】支持【等值】配置了 * 平台升级全新的消息通知设置，支持SaaS模式，动态配置通知方式（短信、消息模板、接收人、接收角色、触发条件等） * 新增V8.OpenAnyTable()函数，用法见平台文档（commit 74adbc15）
- 更新最新数据库（commit 7de7d968）
- 修改了说明文档，这里初次git 运行可能会卡在这里，请重点关注！！！（commit fd1f9725）
- 合并远程 master 分支（commit 816fff7f）

## v2.1.0 - (2024-11-19)

- 更新文档（commit 36cf2e00）
- Microi.net：工程维护（commit 140dce3）

## v2.0.3 - (2024-11-12)

- 修复多图字段导出时若只传了一张图片会抛出合并列异常的bug 修复V8.Http.Get()请求一些特殊大厂接口时会报错的bug 微信支付回调接口引擎自定义地址由于不支持url参数，因此接口引擎新增给地址增加【--OsClient--crm--】后缀以实现OsClient参数 修复.net6升级到.net8后通用导入会报错的bug 修复.net6升级到.net8后添加定时任务无法启动的bug 修复V8.DataSourceEngine数据源引擎无法设置匿名调用的bug（commit ecc35966）

## v2.0.3 - (2024-11-11)

- 更新文档（commit 3437bff0）

## v2.0.3 - (2024-11-06)

- 更新文档（commit 2e3b656f）

## v2.0.2 - (2024-11-05)

- git配置变更（commit 6c42b479）
- 更新文档（commit d0d6ee0e）
- 更新文档（commit 4333f4ef）
- 更新文档（commit 708fcd6c）
- 文档更新（commit 7dff0385）
- 更新文档（commit 5611b7c8）
- 现在通用导出支持单图、多图字段了，多图字段会根据图片数量自动创建列、表头合并列，自动计算图片定位浮在对应的单元格之上 接口引擎现在支持自定义Excel导出了，可自定义表头、自定义数据源，用法见【/文档/进阶：自定义导出Excel.md】 通用导出、自定义导出源码公开在Microi.Office源码中（commit 82888a5c）
- 更新说明（commit c71ea9a7）

## v2.0.1 - (2024-11-04)

- 修复文件/图片上传接口当Path参数为空时出现两个斜杠 修复接口引擎第一次保存后缓存会更新失败的bug 新增Microi.V8Engine库，可实现扩展接口引擎中V8对象、V8.方法对象 修复接口引擎不支持微信支付加密的bug 修复接口引擎在SaaS模式下，匿名通过get方式调用接收不到OsClient参数的bug 修复地图组件遇到传入空的xy轴加载地图失败的bug 修复VUE v2.6.10自动升级到v2.7.16后，表单设计器由于DOM刷新频繁导致页面卡死的严重bug。（commit c62ba0f5）

## v2.0.1 - (2024-11-03)

- 更新说明（commit 5536de1f）

## v2.0.1 - (2024-11-02)

- 更新介绍（commit a1f8b19c）
- 更新文档（commit 70c604ba）

## v2.0.1 - (2024-10-31)

- 上传数据库备份文件，更新前端vue2框架源码说明（commit f0236374）
- 上传部分案例截图、公司介绍（commit 2daca082）
- 资料更新（commit 89a43f14）
- Microi.net：工程维护（commit f26fe5c）

## v2.0.1 - (2024-10-30)

- npm microi.net 2.x用于vue2，3.x用于vue3（commit 0aaa5509）
- Microi.net：工程维护（commit 0f8b8aa）
- Microi.net：更新readme（commit f96c770）

## v2.0.0 - (2024-10-29)

- Microi吾码 - 低代码平台（commit 8dc8c89c）
- 更新说明（commit dd6b314b）
- 更新说明（commit 8801fe03）
- 更新说明（commit f47ba7f9）
- 新增界面引擎试用地址（commit 767a24a9）

## v4.0.0 - (2024-10-21 17:46)

- Microi v4.0
- microi v3.x版本已应用数百套产品，因此仍然长期持续维护，新增v4分支
- Vue2升级为Vue3
- .NET6升级到.NET8
- node14升级为node18
- Webpack更换为Vite
- Element-UI更换为Element-Plus
- Vuex更换为Pinia
- 经典系统界面更换为Web操作系统界面
- v4对应数据库、后端接口系统向下兼容v3
- 表单属性、字段属性、模块引擎等等定制页面现在全部由diy表单引擎驱动了，万物皆表单引擎。
- 新增壁纸管理
- 新增多语言管理
- 新增图标管理
- 新增个人设置
- 系统设置新增操作系统相关各种配置
- V8.FormEngine新增用法，无需再手写FormEngineKey、_RowModel参数名，见平台文档。
- 现在树形表格、树形控件支持懒加载了
- 表格模板引擎现在支持V8.Result = false;来取消模板渲染了。

## v3.17.1 - (2024-10-21 17:41)

- 【必须】手动去数据库管理工具给【diy_field】表新增字段：【AppVisible、bit、可为空】。
- 然后去【表单引擎】—>【diy_field】表—>【异常字段 选择 AppVisible 修复】。
- 执行SQL：update diy_field set AppVisible=1 where Visible=1
- 【必须】手动去数据库管理工具给【sys_menu】新增字段：【AppDisplay、bit、可为空】。
- 然后去【表单引擎】—>【sys_menu】表—>【异常字段 选择 AppDisplay 修复】。
- 执行SQL：update sys_menu set AppDisplay=1 where Display=1
- 现在阿里云私有桶文件也支持返回绑定域名的https地址了，并且支持在线预览而不是直接下载
- 接口引擎新增V8.Office工具类，支持读取excel里面的数据内容了
- 接口引擎现在支持Payload=Form Data方式调用了（之前只支持Paylowd=JSON方式请求，即raw json）
- 接口引擎自定义接口地址现在支持接收文件了（可以直接上传文件到接口引擎），使用V8.FilesByteBase64访问文件列表
- 接口引擎现在在代码中支持下载文件、上传文件（同时支持上传到第三方接口）了，用法见平台文档
- 接口引擎现在支持直接响应文件了（可以通过get请求接口引擎自定义地址返回任何类型的文件，需在Sys_ApiEngine表新增开关组件：响应文件[ResponseFile]）
- 平台的默认Upload上传接口现在多文件上传时，可以不再必传Multiple参数了，会自动识别（但如果本身想多文件上传，但又只选择了1个文件，建议传入Multiple=true）

## v3.16.20 - (2024-10-21 17:39)

- 现在表内编辑也能正确的触发表单属性里面的数据修改接口替换了。
- 表单引擎、模块引擎新增V8代码加密传输功能，但这导致必须要在sys_menu的表单设计-表单属性-【服务器端数据处理V8事件】和【服务器端表单提交前V8事件】均需要添加这段相同的代码：
- var base64ToStringArr = ["SqlWhere", "SqlJoin", "MoreBtns", "FormBtns", "ExportMoreBtns", "BatchSelectMoreBtns", "PageBtns", "PageTabs"];
- base64ToStringArr.forEach(item => {
- if(V8.Form[item]){
- V8.Form[item] = V8.Base64.Base64ToString(V8.Form[item]);
- }
- })
- V8代码编辑器新增代码折叠、代码搜索、代码缩略图、高级高亮、代码提示、代码补全
- 修复V8代码编辑器二次开发不高亮的问题
- 数据源引擎的DataSourceKey现在支持传入DataSourceId值了。
- 接口引擎以get访问时，支持给V8.Result指定RedirectUrl参数后自动跳转页面
- 接口引擎现在V8.Param可以访问到Url参数了
- 接口引擎现在支持GET请求了
- 数据源引擎现在支持SQL数据源、JSON数据源了
- 兼容oracle 11g一些特性，现在oracle11g可以正常做为saas从库、扩展数据库、V8.Dbs访问oracle11g
- sys_osclients新增DbVersion字段（值可为：空、12c[oracle为空时默认为12c]、11g），用于判断数据库为oracle11g时的兼容处理.

## v3.16.0 - (2024-10-21 17:35)

- 现在支持多字段排序了
- 修复MinIO上传过大或过小的图片报错的bug。
- 系统设置、接口引擎现在不再从数据库查询，而是从redis缓存。
- 后端更新v1.9.4.5时（若不更新，将导致即使修改了系统设置和接口引擎后仍然使用老数据redis缓存）：
- 1）表单设计（Sys_Config）服务器端表单提交后V8事件必须添加以下V8代码（可参考标准库）：
- V8.Cache.Remove(`SysConfig:${V8.OsClient}`);
- 2）表单设计（Sys_ApiEngine）服务器端表单提交后V8事件必须添加以下V8代码（可参考标准库）：
- var cacheKey = `FormData:${V8.OsClient}:sys_apiengine:${V8.Form.ApiEngineKey.toLowerCase()}`;
- V8.Cache.Remove(cacheKey);
- if(V8.Form.ApiAddress){
- var id2 = V8.Form.ApiAddress.replace(/\//g, '___').toLowerCase();
- var cacheKey2 = `FormData:${V8.OsClient}:sys_apiengine:${id2}`;
- V8.Cache.Remove(cacheKey2);
- }
- 日期时间控件新增[时分]、[时分秒]的显示格式。
- 后端V8引擎新增V8.Sms.Send()发送阿里云短信（其它常规短信平台也可使用接口引擎实现）。
- 用户登陆、修改密码现在会将密码base64传输（之所以不采用其它加密方式是要考虑到密码解密）
- 前端OS系统新增FileServer可配置环境变量。
- 修复关联表单不显示tab页面的bug。
- 修复表单控件过多时，可能存在排列不准确的样式问题。
- 修复下拉框动态赋值后，第二次选择会将数据源还原到上次的bug。
- 修复弹出表格动态赋值查询条件后，需要打开第二次才会刷新的bug。
- V8.HideFormBtn 新增可隐藏Save保存按钮。
- 系统引擎新增数据库管理（扩展数据库，与数据库级别的saas模式不一样），支持新建表以及数据CRUD时对应到扩展数据库，支持MySql、Oracle。已知问题：新增扩展数据库后需重启api接口系统。
- 系统设置新增是否开启用户注册功能。
- 抽象了Microi.Cache分布式缓存，现在数据库级别saas模式支持独立redis实例了。
- 验证码规则现在支持在系统设置中配置了。
- 开发配置新增开启上传文件名称重命名为guid名称配置。
- 新增大功能模块：本地自定义word模板打印。
- 新增Microi.HDFS分布式存储类库，抽象阿里云、MinIO、Amazon S3的实现。
- 现在后台异常等错误提示也支持多语言了。
- 修复流程引擎节点过多点击保存报参数错误的bug。
- 修复流程引擎修改节点名称后立即点击第二个节点会导致第二个节点名称变为上个节点名称的bug。
- 现在平台分布式存储支持Amazon S3私有存储桶的CDN鉴权配置了。
- 新增V8.ClientType常量，可能的值：PC、IOS、Android、H5、WeChat
- 修复移动端表单详情页面所有控件控制台均报错的问题导致只读等配置不生效的bug。
- 现在平台分布式存储完全兼容亚马逊云S3存储桶以及亚马逊云CDN了。
- 富文本控件上传功能重新实现，现在可以上传图片了。
- 现在服务器端V8事件或接口引擎调用接口引擎，可以不用再手动传入_CurrentUser对象了，即修复接口引擎或服务器端V8事件调用接口引擎报无权限错误的bug。
- 修复表单以新开页面时，V8更多按钮的显隐不支持异步调用、以及一些函数不生效的bug。
- UptFormData、UptFormDataByWhere新增_NoLineAdd参数（bool类型），当传入true时，修改的结果若数据为0受影响行数，则执行新增操作。
- 修复V8.FormSubmit、V8.ReloadForm里面的SavedType参数在当前表单是View的情况下不生效的bug。
- 现在登陆界面验证码输入框也能敲击Enter键进行登陆了。
- 现在number(10,0)是对应int类型，number(10,3)是decimal类型。
- 现在当V8.Http.Post()出现timeout等异常时，会正确的返回异常信息了。
- 现在自动编号字段即使前端V8或服务器端V8在新增时未传入该字段也会生成值了。
- 现在服务器端表单提交后V8事件中也能通过V8.Form获取到自动编号字段值、以及表单Id值（之前是若前端未传入Id则无法获取）。
- 现在当字段类型设置为int时，前端若传入浮点数值，会正确的抛出异常提示到具体字段错误信息。
- 修复数字控件当配置了小数点为0或非0后，修改字段类型并不会成功的bug。
- 修复以抽屉形式打开表单后，点击右上角删除成功后抽屉并没有被关闭的bug。
- 完善V8事件的名称。
- 前端V8引擎代码新增V8.TableModel、V8.TableName属性。
- 服务器端V8引擎代码新增V8.TableModel对象。
- 前端、服务器端V8均增加V8.EventName属性，可在全局V8中进行判断执行的哪一个事件，参照表见平台文档。
- 接口引擎V8.Cache新增HashGet、HashSet、HashRemove
- 现在表单属性-服务器端数据处理V8事件只在前端调用数据时触发，后台级开发或接口引擎等服务器端口V8内部调用不再触发（若触发，会影响开发者获取预期之外的数据，且可能会出现死循环）
- 现在所有服务器端V8事件都能获取到V8.SysConfig系统配置了。
- 现在表单属性-服务器端表单提交前/提交后V8事件只在前端调用增、删、改接口时触发，后台级开发或接口引擎等服务器端V8内部调用不再触发（若触发，会影响开发者得到预期之外的操作）
- 现在V8.Post的回调函数可以接收第二个参数了：headers
- 修复某些特殊情况下，单个表单字段单独配置了绑定角色当不可见时保存仍然校验必填的问题。
- 修复更新新功能后导致接口引擎开启分布式锁后无法获取V8.Result结果的bug。
- 系统设置新增是否显示隐私政策以及内容编辑，启用后登陆界面会显示隐私政策勾选项，不勾选禁止登陆。
- 修复_InvokeType默认值为Client导致一些请求不传此参数都被系统误认为是客户端请求的bug，现在默认值为null。
- 修复特殊情况下V8.Cache.Set时也会将字符串再次序列化的bug。

## v3.15.10 - (2023-08-08 20:48)

- 兄弟们，大更新来了：）
- 平台文档进行了大量更新
- 修复Oracle下获取部门机构报错的bug
- 修复Oracle多处数据排序无效的bug
- 修复Oracle修改表单名未生效的bug
- 修复V8设计器下拉框显示被遮住的bug
- 表单引擎新增复制整表功能，通过接口引擎实现。
- 表单引擎-自动编号控件固定前缀现在支持日期变量，写法：$yyyyMMddHHmmssfff$。双$里面支持任意分隔符。
- 流程引擎新增节点开始V8服务器端代码、节点结束V8服务器端代码
- 节点开始/结束V8服务器端代码新增V8.WF可访问对象。
- 流程引擎新增自动结束节点，实现某些非结束节点审批完毕后可能立即结束流程（核心逻辑处理很复杂）。
- 流程引擎现在支持后端传入LineValue值，而不用通过条件判断V8执行获得。
- 修复SAAS模式租户系统组织机构数据维护存在的bug。
- 修复独立组织机构V8强制指定非独立机构人审批报错的bug。
- 表单引擎—子表控件新增支持关闭分页功能。
- 表单引擎--多行文本控件新增默认行数功能。
- 修复表关联后相同字段名称搜索异常的bug。
- 流程引擎-修复开始节点服务器端V8代码执行V8.WF.ForceSelectUsers报错的bug。
- 流程引擎-现在退回到开始节点时可以由发起人作废流程了。
- 修复表单提交前事件出现代码错误仍会提交表单数据的bug。
- 修复接口引擎的自定义地址保存后调用偶尔会出现404的bug。
- 修复接口引擎匿名调用存在的一些bug。
- 修复我的工作经过翻页或搜索后数据显示错乱的bug。
- 调用接口引擎现在可在header中传入osclient、apiengine=1，以提高路径判断性能。
- 现在调用getFormData和getTableData接口可以加上-FormEngineKey或任意后缀，方便开发者更方便直观的查看接口地址。
- 现在sys_user表的Id不再校验是否是guid格式。
- 后端二次开发开放[获取token、身份认证过滤器]源代码。
- 服务器端V8引擎新增V8.Http，支持Get/Post请求、支持请求时传入header、支持请求后获取header等。
- _Where条件现在支持AND、OR，并且支持括号分组条件。
- 修复Oracle仅修改字段类型时没有生效的bug
- 修复匿名通过FormEngine新增数据时可能会报错的bug。
- 修复服务器端V8.Http传入TimeOut、Encoding不生效的bug。
- 现在数据库级别的saas模式下，接口引擎自定义接口地址即使不传入header也能正常匿名调用。
- 现在DIY表格在翻页或设置线每页X条数据时，会将滚动条自动置顶。
- 现在不同控件在某些必填情况不再是始终提示【请输入】，而可能是【请选择、请上传、请输入】。
- 修复表单引擎-下拉多选组件在远程搜索和前端搜索时，直接失去焦点后，下拉数据没有还原到初始状态的bug。
- 新增RefreshLoginUser接口和方法，用于刷新用户的登陆缓存信息。
- 服务器端V8引擎新增V8.Method内置方法/函数，详情见平台文档。
- 修复表单设计大量开关开启保存后刷新均默认显示未开启的bug。
- 表单设计—字段属性—控件类型 现在可以搜索了。
- 现在sys_osclient开发配置的域名支持多域名配置匹配osclient了，格式：$a.microi.net$b.microi.net$（修改了/api/os/GetOsClientByDomain接口）。
- 修复Oracle无法隐藏系统左下侧Copyright信息的bug。
- 修复Oracle接口引擎自定义地址不生效的bug。
- 移动端新增支持V8打开扫一扫（扫二维码、条形码，支持闪光灯、扫本地相册）并回传结果执行回调函数。
- 移动端现在支持部分V8事件了。
- 系统设置新增【获取私有文件前事件】、【获取私有文件后事件】
- 表单引擎—代码组件新增【高度】配置项。
- 获取私有文件临时访问地址现在会带FormEngineKey等参数，并且可以在服务器端V8事件访问，详情见平台文档。
- 服务器端V8.Method新增GetPrivateFileUrl函数。
- GetPrivateFileUrl函数/接口现在支持多文件同时获取。
- 现在Oracle在未修改字段类型的时候不会再执行修改字段类型的逻辑。
- 修复服务器端表单提交后事件不执行的bug（包括增、删、改、根据条件删除、根据条件修改），并且会在表单提交成功后才会执行。
- 现在服务器端表单提交前/后事件均支持V8.DbTrans了。
- 现在表单引擎列表数据、以及创建表、修改表也由表单引擎驱动。
- 接口引擎现在可以使用V8.Header访问到前端提交过来的报文了。
- 修复V8.Http接收xml数据报错的bug，现在会正确的返回xml字符串。
- 修复以弹窗弹出表单报错的bug。
- 字段属性默认值配置项现在只在新增时生效。
- 现在服务器端V8引擎代码也支持写await了。
- 服务器端V8引擎代码新增V8.Cache对象，包含一些对分布式缓存的操作，用法见平台文档。
- 优化身份认证系统存储的扩展信息。
- 新增验证码组件，可在系统设置中开启。默认关闭，开启后，注册、登陆接口均需要传入验证码Id和值才能调用成功。
- 修复更新新功能后导致下拉选择框普通数据第二次选择数据为空的bug。
- 修复更新新功能后导致下拉选择框普通数据无法搜索的bug。
- 修复swagger又报错的bug。
- 现在表单字段的必填验证在表单提交前V8事件之前执行，并且未验证通过不会再执行表单提交前V8事件。
- 修复更新新功能后导致删除接口未提交事务的bug。
- 删除DIY表格的单元格title属性，保留tooltip。
- 现在除第1页之外的最后一页如果只有一条数据在被删除后，会自动跳转到上一页，而不是显示空数据。
- 修复表单以新页面打开后，在添加数据里子表关联未生效的bug。

## v3.13.13 - (2023-06-15 19:05)

- 由于最近半年项目繁忙，所以半年内未上传更新日志。
- 本次更新前需要做的重要操作：
- 1、表单设计 --> 搜索Sys_OsClient：
- a）【非必须】建议对配置项进行分类[Base、Aliyun、MinIO、Cache]，如图：
- b）MinIO配置新增字段：MinIOEndPointInternet（单行文本控件、varchar(50)）
- c）MinIO配置新增字段：MinIOEndPointSSL（开关控件、int或bit类型均可、）
- 2、表单设计 --> 搜索Sys_User
- 服务器端表单提交前事件一定要加：
- if(V8.Form.Pwd){
- //密码加密
- var decodePwd = '';
- try{
- //尝试解密
- decodePwd = V8.EncryptHelper.DESDecode(V8.Form.Pwd);
- }catch(e){
- //如果解密失败，就是明文
- decodePwd = V8.Form.Pwd;
- }
- //DES加密
- V8.Form.Pwd = V8.EncryptHelper.DESEncode(decodePwd);
- }
- 近半年内部分做了记录的更新日志：
- FormEngine新增GetFormDataAnonymous、GetFormDataAnonymousDefault等匿名访问接口。
- 工作流审批记录接收人现在会完整显示头像+名称。
- 修复后端Microi.net二次开发一些方法报OsClient为空的bug。
- 修复一些表格、表单样式问题。
- 工作流引擎现在支持传入自定义FlowTitle。
- 修复统计列不显示的bug。
- 部门机构新增【是否独立机构】配置，为分公司/子公司的组织机构开启【独立机构】后，该机构下面的所有帐号登陆系统，访问到的组织机构模块、系统帐号模块 ，只会返回该独立机构下所有部门相关的数据。
- 修复表单设计-字段保存后再次保存会存在数据丢失的bug。
- 现在Sys_OsClient中的DbReadnConn不配置时会默认读取DbConn。
- 修复MongoDB连接不上会导致程序挂掉的稳定性问题。
- 修复将Microi.net平台以SAAS模式运行且租户数据库较多时，程序首次启动时间长达10秒以上，现在仅需1秒以内。
- 修复在模板引擎中使用V8.FormSet对自身赋值出现死循环的bug。
- 图片/文件上传控件新增上传前事件，可使用V8.Result阻止上传，使用V8.ThisValue访问当前文件信息。
- 修复角色无详情、无搜索无效的bug。
- 新增Oracle数据库支持。
- 弹出表格控件现在提交按钮会有前端Loading效果及防止重复提交了。
- V8.OpenAnyForm()在打开的表单V8中，现在能获取V8.ParentV8对象了。
- 修复流程审批找不到本部门领导人的bug。
- 移除SysUserFk表的使用。
- 现在默认首页支持iframe和http地址登陆跳转了，且支持单点登陆。
- 修复MinIO私有文件上传失败会触发死循环获取文件url的bug。
- 修复特殊情况下部分字段保存时true/false与int之间的转换bug。
- 修复保存一次字段后，再次保存不生效的bug.
- DIY底层通用新增、修改接口代码优化。
- 修复表单设计-异常字段列表错误的bug。
- 修复树形结构的表格列表总数显示为0的bug。
- 现在租户用户在通用导入数据时，会自动赋值TenantId、TenantName，且仅超级管理员有权限在excel中添加TenantId、TenantName字段为租户导入数据。
- 修复导入数据会给UpdateTime字段默认当前时间的bug，现在为null。
- 表单引擎新增Sys_ConfigTenant租户系统设置表，可设置系统Logo、短标题等。
- 修复DIY表格开启批量选择后，行高样式太高、复选框位置不垂直居中的问题。
- 优化前端主框架源码。
- 修复表单属性[默认值]的配置项设置无效的bug。
- 修复新增其它功能后导致单选框、日期等组件使用V8赋值无效的bug。
- 现在图片/文件上传后会触发相应值变更V8事件了。
- 完善工作流引擎中本部门领导审批、以及兼职部门领导审批的业务逻辑。
- 现在岗位角色绑定部门后，也会参与到工作流引擎本部门领导审批逻辑判断。
- 新增微信公众号配置。支持多公众号、多小程序、多模板消息配置，不同帐号可绑定不同公众号，支持小程序H5版本帐号绑定微信OpenId。
- 新增MinIO两项配置，解决MinIO配置问题。
- 新增Nuget依赖注入组件：Microi.WeChat，与Microi.net组件完全解耦，二次开发人员可选择是否引用此包。
- MySql数据库编码以及连接字符串从utf8全部修改为utf8mb4。

## v3.12.15 - (2022-12-16 01:16)

- DIY底层通用新增、修改接口代码优化。
- 修复表单设计-异常字段列表错误的bug。
- 修复树形结构的表格列表总数显示为0的bug。
- 现在租户用户在通用导入数据时，会自动赋值TenantId、TenantName，且仅超级管理员有权限在excel中添加TenantId、TenantName字段为租户导入数据。
- 修复导入数据会给UpdateTime字段默认当前时间的bug，现在为null。
- 表单引擎新增Sys_ConfigTenant租户系统设置表，可设置系统Logo、短标题等。
- 修复DIY表格开启批量选择后，行高样式太高、复选框位置不垂直居中的问题。
- 优化前端主框架源码。
- 修复表单属性[默认值]的配置项设置无效的bug。
- 修复新增其它功能后导致单选框、日期等组件使用V8赋值无效的bug。
- 现在图片/文件上传后会触发相应值变更V8事件了。

## v3.11.23 - (2022-11-24 16:56)

- 现在服务器端执行的工作流引擎条件V8代码时，V8.Form.下拉框获取到的值是正确的最终存储的值，而不是object。
- 工作流引擎现在在节点开始V8代码中，可以使用V8.FieldSet了。
- 修复通用导入功能报错的bug。
- 修复更新程序添加字段后会进入异常字段列表的bug。
- 修复新增数据后，返回的数据带引号的bug。
- 修复字段Label显示错误的bug。
- 修复通用导入功能在特殊情况下文件流读取报错的bug。
- 系统设置-界面风格新增[框架顶部宽度铺满]配置、优化框架部分界面。
- 现在表单更多按钮在加载的过程中，默认是不显示，而不是显示一个不可点击的Loading按钮。
- 表单引擎—打开方式为新页面时，现在会正确的显示表单更多V8按钮了。
- 角色权限勾选管理新增联动、批量选择功能，勾选主菜单权限会联动勾选子菜单权限、勾选子菜单权限会联动勾选主菜单。
- 修复特殊情况下HideFormBtn报错的bug。
- 修复表单设计—表单属性[树形结构]等复选框数据加载错误的bug。
- 现在V8代码支持实现完善的同步创建帐号、修改帐号名称、密码、角色等。
- 修复通过diy删除的系统帐号仍然可以登陆的bug。
- 现在角色管理、组织机构等模板，已经完美支持SaaS模式。
- 现在系统框架会强制保留最后一个页签。
- 现在admin超级管理员也能正常的配置哪些业务模块菜单不再显示（系统引擎、系统管理部分模块会强制显示）
- 现在只要是权限大于等于999的角色帐号，在角色模块配置处可以看到所有菜单模块。
- 修复表单引擎新开窗口的表单更多按钮不显示的bug。
- 修复系统模块diy驱动后，部分角色权限混乱的bug。
- 框架界面优化。
- 现在退出登陆会有确认提示。
- 修复一些特殊情况下，字段大小写不一致导致无法匹配、出错的bug。

## v3.10.19 - (2022-10-13 17:37)

- 修复旧的DiyTable相关接口不支持获取V8.CurrenUser的DIY扩展字段的bug
- 修复部分老的字符串’null‘脏数据导致流程发起失败的bug
- 修复表单引擎—地址控件手动赋值后DOM不刷新的bug。
- 修复导出功能严重bug。
- 接口引擎新增允许匿名调用功能
- 接口引擎现在支持自定义接口地址
- 新增Microi.net.Grpc.Server（.net服务端）、Microi.net.Grpc.Client（.net客户端）、Grpc.Client.Java.Mvc（Java客户端）三套demo源码
- 分布式锁新增AsyncActionLock方法，现在支持锁的内部代码使用await了。
- 工作流引擎新增【移交】功能。
- 工作流引擎现在在撤回、移交后也会正确的显示在【我处理的】工作列表中了。
- 修复特殊情况下获取字段列表错误缓存的bug。
- 工作流引擎节点属性的开始V8、结束V8现在支持V8.OldForm了。
- 工作流引擎节点属性增加允许移交、隐藏移交选择人配置项。
- 修复Base64组件在前端microi.net组件引用中的版本号问题导致加解密失败的bug。
- 修复流程设计时，流程属性修改后并不会保存成功的bug。

## v3.9.15 - (2022-09-15 08:47)

- 修复_Where条件参数的StartLike、EndLike查询报错的bug
- 现在附件上传后会正确的显示文件体积KB、MB、GB等单位。
- 获取我的工作接口新增FlowState流程状态返回。
- WF_Flow表新增HandlerUsers（处理过工作的人，包括同意、不同意、撤回、发起工作）、CopyUsers（抄送过的人）、NotHandlerUsers（收到过待办但未处理过的人）。
- 现在获取【我处理的】工作不再从WF_Work表获取（会出现重复），从WF_Flow表获取。
- 现在前端主框架在访问任意页面时带上token url参数均可以自动登陆，并且在已登陆状态下再次传入token url参数也会刷新登陆。
- 我发起的、我处理的、抄送我的、我相关的现在全部从WF_Flow表获取数据
- 我的工作界面优化以及修复数据显示错误bug
- 代码编辑器控件新增全屏切换功能，特别是在流程设计处编写V8代码更方便。
- 修复数据源引擎V8.CurrentUser无法访问DIY扩展字段信息的bug。
- 修复表单引擎字段搜索、异常字段部分bug
- 修复FormEngine.AddFormData时，数字类型字段赋值空值、开启加密存储报错的bug
- 修复前端microi.net核心获取OsClicent、ApiBase特殊情况下会出错的bug

## v3.9.2 - (2022-08-25 02:39)

- 修复文件上传最大不能超过30M的bug
- 修复字段搜索时，两张表有相同字段偶尔会搜索结果错误的bug
- 表单引擎新增【服务器端表单提交前V8事件】，支持新增、删除、修改时触发。
- 修复前端microi.net组件部分图片显示不出来的bug
- 接口引擎新增事务对象V8.DbTrans支持【若V8代码内部未对事务对象进行Commit()，外部会Rollback()以保证连接的释放】。
- 修复接口引擎、表单引擎前端传值int类型值为1，后端json.net会误认为decimal类型强制转换为1.0的bug。
- 修复接口引擎事务对象特殊情况下未释放的bug。若V8代码中未对事务提交或回滚，V8外部会最终执行回滚。
- 修复图片、pdf上传至MinIO后，通过文件地址访问无法即时预览，而是直接下载的问题.
- 接口引擎新增V8.SysConfig、V8.EncryptHelper等大量内置函数。
- 系统设置、用户账户（DIY驱动模块）新增密码存储形式配置，支持DES、V8（自定义任意加密方式）
- V8.EncryptHelper.SHA256()现在返回64进制
- GetTableData接口新增参数Ids
- 新增GetFieldsData接口，一次性获取所有字段配置的数据源，大大减少复杂表的前端请求次数。
- 【重要】新增V8.OpenAnyForm()打开任意表单
- 表单引擎-表单设计新增字段回收站、恢复字段功能
- V8.OpenAnyForm({})新增参数：Width、EventReplace、SelectFields、DialogType，用法见平台文档。
- 修复某种特殊情况下，下拉框清除选择后，无法保存到数据库。
- 修复下拉框仅赋值Id时，特殊情况下不显示对应Label的bug。

## v3.8.22 - (2022-08-22 23:04)

- 现在地址控件直接存储中文，不再是Code。
- 表单设计新增异常字段列表、修复功能。
- 表单设计现在搜索字段可以搜索Name了，以前只能搜索Label
- 表单引擎-日期控件现在支持年周、年月日时分（不含秒）的格式选项配置。
- 新增密码加密方式V8
- 修复弹出表格控件新增层级bug
- 由于工作繁忙，还有部分新增功能、bug修复本次更新暂未写入更新日志。

## v3.8.8 - (2022-08-08 17:26)

- 新增FormEngine相关接口，可以不再使用_RowModel了
- 表单引擎新增、修改字段新增内置字段判断。
- 修复表单引擎—组织机构控件、级联控件配置了只保存最后一个节点值时，不显示数据的bug
- 后端Microi.net组件GetDiyTableRow修改参数类型为DiyTableRowParam
- 优化上传接口，不会再报错gzip压缩异常，修复MinIO私有文件访问不到的bug等。
- 大量完善FormEngine、ModuleEngine相关接口、V8函数
- 现在模块引擎部分已经修改为表单引擎驱动了。
- 由于工作繁忙，还有部分新增功能、bug修复本次更新暂未写入更新日志。

## v3.7.31 - (2022-07-21 15:11)

- 【重要提示】
- 1、更新v3.7.31版本之前，一定要先手动将数据库Sys_User表的所有char36字段类型修改为varchar36，否则更新后无法登陆！
- 2、路由/diy-form-page/:TableId/:TableRowId中的FormMode修改为url?FormMode参数，二次开发中需要做相应的修改。
- 修复子表格新版搜索条件样式错乱的问题
- 修复子表格的[模块设计]打开后遮罩层挡住弹出层无法操作的bug
- 获取单条数据接口现在也会默认只查询未删除数据。
- 现在获取单条数据接口，若未查询到数据，不再返回成功(Code=1)，而是返回失败(Code=0)。
- 前端新增V8.FormEngine对象、后端新增/api/FormEngine/大量接口，详细见平台文档 。
- 修复有事务的情况下修改数据报错[未找到数据]的bug（未使用事务对象查询旧数据导致）
- 模块引擎—各种更多按钮 现在支持按钮样式配置
- 修复后端Microi.net组件部分接口如果参数_CurrentSysUser为空值时报错的bug
- 现在获取diy单条数据，如果数据不存在，会返回Code=2，而不再是Code=0
- 框架url地址可新增ShowClassicLeft=0参数，与ShowClassicTop原理一样，隐藏左侧菜单模块，现在上边也会默认保留20px的边距
- 数据源引擎现在和接口引擎一样支持动态参数了。
- 后端Microi.net组件DiyToken.GetAccessToken方法现在可手动传入HttpContext对象，也可以在类库中HttpContext为null时调用了。
- 数据源引擎、接口引擎 现在支持在线运行测试
- 现在数据源引擎、接口引擎 自身接口 均支持在所有服务器端V8引擎中调用了（之前仅支持表单引擎）。
- 前端页面首次进入loading效果修改为白色背景，更符合常规审美
- 表单引擎—分割线 新增 图标、标签样式 配置
- 修复表单引擎-分割线 设置了隐藏 但无效的bug
- DIY数据列表页，右侧行更多V8按钮现在是自适应宽度，并且右侧浮动宽度现在根据按钮文字数量计算。
- 现在关闭表单时，只有在修改了值后才会提示【确认关闭】，没有修改任何值时会直接关闭。
- 现在打开子表的操作，也会显示阴影遮罩层了，界面更美观、操作更专注
- 现在打开表单后，在没有修改任何值的情况下，可以通过ESC键、或点击遮罩层关闭表单，操作体验更佳。
- 修复消息系统界面部分样式错乱的问题
- 现在消息系统只有在打开的时候，才会开始加载表情包
- V8.FieldSet()现在支持多级赋值了，如：V8.FieldSet(fieldName, ‘Config.JoinTable.TableId’， value);
- 修复DIY数据列表页搜索界面特殊情况下样式会错乱的问题
- 修复创建时间、修改时间、创建人搜索条件重复显示的bug
- 表单引擎—组织机构控件新增【可搜索】配置，同时该字段做为可搜索列也可以搜索组织机构
- 表单引擎—新增【关联表格】控件，用于关联一个表格数据，与子表逻辑不同，用法见平台文档。
- 优化子表格、关联表格 搜索框样式
- 获取DIY数据列表新增全新参数【_Where】，用法见平台文档
- 修复表单引擎—弹出表格控件在预览数据时仍然可以点击的bug
- 现在弹出表格控件可以在提交事件中写V8.Result = false来阻止关闭弹出表格层了。
- 修复弹出表格控件第二次弹出仍保留上次选中数据的bug
- DIY数据列表新增Url参数：_SearchDateTime，对日期字段进行区间搜索，用法见平台文档 。
- 表单引擎Label宽度从100px增加到120px
- 现在系统管理—员工账户 支持完全由DIY表单引擎驱动了，可动态增加字段，并且可以在V8.CurrentUser中访问
- 现在组织机构控件、级联控件 支持配置 仅保存最后一级的值了，可以配置不保存所有级的完整数组。
- 现在模块引擎—数据源配置中$CurrentUser$变量支持Sys_User表所有字段了，并且支持加载为DIY后的扩展字段，如$CurrentUser.ShangjiaID$
- 现在支持服务器端返回的DIY数据主键为大小写id、ID，不再限制为Id
- 表单新开页面修改路由地址，现在查看时点击编辑不会再新开一个页面。
- 现在导出接口会正确的识别token身份认证信息了，之前是根据UserId直接查询身份信息，安全性较低。
- 后端MIcroi.net组件DiyToken.GetCurrentUser()、DiyToken.GetCurrentToken()、均新增string token, string osClient参数，用于解析token。
- 现在可以在表单V8离开事件中指定V8.Result = false; ，表单提交后不会关闭表单，新开表单提交后也不会返回上一页，此时可以使用V8.Router.Push()跳转到任意页面。
- 新增/api/SysUser/DiyLogin登陆接口，当系统设置开启了[Diy系统模块]，则会自动使用此登陆接口，同时兼容老的登陆接口。

## v3.7.22 - (2022-07-13 15:28)

- 修复特殊情况下偶尔base64解密v8代码报错导致diy数据列表无法显示的bug。
- 表单新开页面预览详情时新增编辑按钮。
- V8引擎代码新增V8.NewGuid()、await V8.NewServerGuid()，分别为生成一个前端guid值、生成一个服务器端guid值。
- 表单引擎—子表组件 新增【关联主表列名（默认Id）】，现在子表可以不用强制跟主表的Id值进行关联了，【关联主表列名】的值修改后，子表也会自动立即刷新。
- 现在_SearchEqual搜索条件传入的字段为空值时，也会追加一个[FieldName=‘’ OR FieldName IS NULL]的条件。
- 现在表单里面的子表控件，会等待主表数据加载完成后再加载子表数据，并且优化数据加载的核心逻辑
- 新增V8.SysConfig，包含系统设置所有信息
- 现在新增或删除diy数据时，如果数据库受影响行数为0时，会正确的返回错误："数据库受影响行数为0，可能是删除或修改了不存在的数据！"
- 修复批量新增接口在判断自动编号字段、唯一字段没有使用事务对象，导致逻辑偶尔无效的bug
- 现在模块引擎-可搜索字段 可以配置为[隐藏]了
- DIY数据列表页的自定义搜索界面优化，现在会好看一点点:)
- 现在模块引擎-可搜索字段 配置为[下拉]时，将不再显示复选框搜索，而是一个文本框搜索
- 修复表单引设计时保存全部偶尔会存在地图控件报错导致整个接口保存失败的bug
- 修复前端控制台总是报错[渲染定制组件出现错误]的bug
- 修复关联表单控件在一个主表单中切换关联表单时，主表是编辑模式，但关联表单并不是新增模式的bug
- 现在使用V8.FormSet()给某个字段赋值后，若此字段配置了表单模板引擎，也会同步执行表单模板引擎代码
- 封装DiySearch组件，将diy可搜列的界面展现封装为独立组件，方便二次开发引用。
- 现在组织机构、级联选择器、下拉树控件也可以正确的参与搜索了。
- 修复某些特殊情况下保存主表时，由于子表保存js报错导致主表无法保存的bug
- 现在可以使用/api/DataSourceEngine/GetData接口获取数据源引擎配置的V8数据源了。
- 修复表单引擎—V8编辑器控件在预览时也能编辑代码的bug
- 修复表单引擎—V8编辑器控件在切换数据时代码值不切换的bug
- 新增V8.DataSourceEngine.GetData(param); await V8.DataSourceEngine.GetDataAsync(param);数据源引擎
- 新增V8.ApiEngine.Run(param); await V8.ApiEngine.RunAsync(param);接口引擎
- 现在模块引擎新增了批量操作按钮后，进入模块后默认就是批量操作模式
- 模块引擎—默认排序 现在支持 创建时间、创建人、修改时间
- 模块引擎—可搜索列 现在支持 创建时间、创建人、修改时间
- 模块引擎—可排序列 现在支持 创建时间、创建人、修改时间
- 流程引擎—节点名称现在文字增长，节点宽度会自适应
- 新增核心模块【接口引擎】（未写进更新程序，可手动创建相关表字段，或等待应用商城模块上线在线安装）

## v3.7.18 - (2022-07-07 19:19)

- 修复流程设计图不存在任何线的时候，偶尔拖动节点后所有节点消失的bug
- 修复设计流程时，tab页签显示no-name的bug
- 流程设计图新增放大缩小查看
- 修复两个菜单之间鼠标划过时，有个无背景色的间隙样式问题
- 修复流程设计时，节点/条件属性的值修改后一定要切换到另一个节点/条件属性才会生效的问题，现在是即时生效
- 现在多图上传支持拖动排序、修改图片名称
- 修复流程设计时，节点属性的允许添加审批人、允许撤回等开关按钮，偶尔会自动变成未选中的bug
- 现在开关控件前端不管是传1或字符串true，后端都会认为是true
- 现在设计流程时，填写条件线名称会实时同步到流程图中显示
- 修复单行文本框失去焦点v8事件存在的特殊bug
- 现在使用V8.FormSet给某个字段赋值后，该字段控件会一并触发[值变更V8事件]，以前不会。
- 现在设计流程时，新增条件线后，可以立即配置条件属性了。
- 保存流程时新增了流程校验，会自动检测流程是否设计合理、自动删除脏数据条件线。
- 优化流程轨迹界面
- 修复表单引擎—关联表单控件关联自身死循环的bug
- 修复流程引擎发送至待办人偶尔会两个重复人的bug
- 现在表单V8模板引擎、按钮显示条件V8 等所有V8事件，全部支持await异步处理了
- 新增V8.Base64，用法见平台文档
- 现在表单引擎、模块引擎等所有跟Sql、V8代码相关的参数，全部base64加密存储
- 修复独立封装组织机构组件后导致的无法正常保存和显示数据的bug
- 新增V8.OpenDialog()打开自定义定制组件，可配置宽度、对话框/抽屉模式等，详情见平台文档
- 系统设置新增[界面风格]相关配置
- 新增全局V8引擎代码
- 新增V8.DelDiyDataListByWhere(param, callback)：根据条件进行删除数据
- 现在系统设置可以设置默认首页
- 修复所有V8事件支持await后，导致的一些V8按钮、Tabs显示错误的bug
- 现在V8代码支持全注释0代码运行了
- V8.OpenDialog()打开定制组件新增DataAppend参数、新增this.DataAppend.V8.CloseThisDialog()关闭当前对话框，详情见平台文档。
- 修复关联表单未显示或未加载时，主表提交报错的bug
- 修复某些特殊情况下V8代码可能会被二次base64加密的bug
- 流程引擎—节点属性 新增【同部门上级审批】开关，会在审批人列表中筛选出与流程发起人在同一个部门（或上级部门）的审批人出来收到待办工作。
- 修复表单模板引擎读取错误的bug
- 流程引擎—节点开始V8新增：V8.WF.ForceSelectUsers=[‘userid’];用来强制指定下一节点审批人。
- Js-base64新增判断对象是否存在，防止报错
- 修复流程引擎保存时，空值生成了null字符串的bug
- 修复删除流程节点时未找到条件线报参数错误的小bug（不影响使用）

## v3.7.1 - (2022-06-30 01:40)

- 新增系统更新日志的更新接口，每次版本更新脚本、缓存更新全部集成在此接口
- 修复富文本编辑器显示在V8引擎代码设计器之上的bug
- 现在聊天系统可以在系统设置中关闭
- 修复表单详情通过新开页面方式打开空白的bug
- 流程引擎大量升级和修复，支持定制表单发起流程、处理工作，节点属性新增条件判断V8，开始V8可以中断流程提交等等，详情查看平台文档。
- 修复新增时数据时删除按钮也会显示的bug
- 修复由于架构升级导致的系统管理多个模块点击新增无效的bug
- 表单引擎新增下拉树控件
- 修复使用了V8服务端引擎后，页面导出功能报错的bug
- 修复系统配置登录背景无效的bug
- 现在DIY表格数据列表也支持树形结构了
- 流程引擎服务端二次开发的StartWork、SendWork现在支持事务参数，与业务逻辑使用同一个事务。
- 更新流程引擎说明文档。
- 流程引擎-节点属性新增[允许撤回]配置。
- 修复流程设计-节点属性切换时V8代码不刷新的bug。
- 现在更多搜索下面不存在搜索字段时，不会显示[更多搜索]按钮了。
- 新增V8.OpenFormWF可在diy数据列表通过界面发起流程、预览流程，详情见平台文档。
- 新增地址控件
- 系统设置新增大量界面风格配置
- 现在多图上传支持拖动排序、修改图片名称

## v3.6.29 - (2022-06-29 12:41)

- diy框架样式优化
- 优化聊天系统log日志
- 替换v8代码编辑器，codemirror诟病太多
- 修复v8代码设计器样式问题
- 修复diy富文本编辑器html模式样式错乱的bug
- Microi.net后端组件大量升级
- 前端microi.net二次开发新增全新DiyFormDialog组件，是DiyForm组件的升级版，包含了整个表单引擎的对话框及所有按钮、事件等实现，用于聊天系统等地方调出diy表单详情
- 修复前端工作流引擎wordcolor报错的bug
- Microi.net后端主框架完善
- diy数据列表新增url参数：Tab，与Keyword同理，默认选中某个Tab
- 修改系统设置中的v8代码等控件字段类型
- 表单引擎新增【代码编辑器】组件
- 将新v8代码编辑器封装为独立组件，方便在其它页面、前端二次开发复用
- 修复新v8代码编辑器在切换、dom刷新后偶尔存在数据紊乱的bug
- 修复单点登陆返回header报错的bug
- 修复升级至.net6.0后产生新的时间时区问题
- V8.GetDiyTableRow/RunSqlGetList当出现错误不再返回null，而是[]。
- V8.RunSqlGetModel出现错误返回{}
- 修复下拉多选、复选框组件在未配置数据源的情况下，diy数据列表中显示[]的bug
- 修复diy数据列表在非表内编辑的情况下，开关控件没正常显示的bug
- 表单设计器属性配置界面样式优化
- 关联Id组件修改类型为varchar(36)
- 表单引擎新增控件【级联选择器 / 树形控件】，支持存储字段、显示字段、子级字段、动态加载、可搜索、多选、判断是否禁用、是否有子级等配置
- 表单引擎—>表单属性新增树型结构模式，可配置父级字段TreeParentField、完整父级字段TreeParentFields，支持懒加载、指定父级字段名称等配置
- 修复diy框架登陆后，未正确的跳转到第一个菜单路由的bug
- 前端microi.net组件v1.8.6升级，封装了聊天系统、工作流引擎等等
- 现在diy数据列表通用导出功能只会导出表格显示字段，并且会正确导出关联表字段的值
- 工作流引擎—节点属性—允许添加审批人，现在是对当前节点审批时生效
- 工作流引擎V8代码现在在服务器端执行
- 表单引擎—>WF_Node表字段[字段设置]，修改组件路径为【/diy/workflow/component/node-col-config.vue】
- V8按钮事件中执行V8.V8Callback()实现按钮loading效果，防止前端重复提交 。
- 现在支持配置关联表单字段可排序、默认排序了。

## v3.5.27 - (2022-05-27 11:10)

- 1、diy的字段名、表名，现在会强制替换掉所有的特殊字符，修复一些会导致的奇葩问题
- 2、恢复聊天系统
- 3、聊天系统界面进行了一些调整，现在在系统右上角
- 4、聊天系统新增所有站内通讯录联系人，可直接发起聊天
- 5、聊天系统服务器端内核优化。
- 6、聊天系统现在可以使用V8引擎代码V8.SendSystemMessage()发送系统消息了。
- 7、聊天系统现在支持消息内容带页面跳转，实现去处理某条数据
- 8、diy数据列表页面现在支持传入?Keyword=xx默认搜索条件
- 9、修复表单引擎->下拉框组件在一些特殊用法中（如sql拼接）保存后再次查看不显示数据的bug
- 10、修复表单引擎中如果使用了datetime字段类型，空值存储错误的bug

## v3.5.14 - (2022-04-13 14:08)

- 后端diy接口系统升级至.net 6.0框架，架构优化，性能提升。
- 现在表单设计中，会实时预览显示子表组件了
- 修复某些特殊情况下子表首次加载无数据的bug
- 修复模块引擎配置关联表，无法对关联表日期等类型字段进行搜索的bug
- 修复大量后端Microi.net二次开发_SearchCheckbox、_SearchEqual等参数关联表别名无法搜索的bug
- Diy数据列表页面新增【模块设计】按钮，方便即时修改模块引擎配置
- 修复Diy数据列表DateTime字段类型返回值为null的bug
- 表单引擎->表单属性新增【全局服务端v8代码引擎代码】，可封装一些全局方法、全局变量，在其它服务器端v8引擎代码事件中调用，用法见平台文档
- 现在表单引擎->字段属性录入了[说明]后，会在表单中显示一个信息图标用于展示说明文字
- Microi.net后端主框架架构大量简化调整，方便二次开发者快速入门；
- 后端MIcroi.net组件升级至v1.8.3.5，大量优化的数据获取方法，所有Guid类型修改为string类型
- 模块引擎查询列可以为列设置别名了，并且已联动处理好前端表内编辑
- 新增【服务器端数据处理V8引擎代码事件】
- 表单引擎->表单属性新增设置[访问权限]，绑定角色后仅该角色可获取该表数据
- 平台文档大量完善
- 现在部署一套全新的diy平台可以不用再配置Sys_OsClients表数据，通过环境变量直接运行、登陆。大大简化部署流程
- 系统设置新增密码强度配置
- 现在前端docker镜像在部署时也支持环境变量OsClient、Api，可不再根据域名来区分客户
- 修复删除时提前表单前执行v8代码报错row is not defined.
- 修复前端微服务框架重复调用接口导致页面卡顿的bug（保证app.js在最后引用加载）

## v3.4.13 - (2022-03-18 11:19)

- 1、2021-09-24至2022-04-11期间已有数十次更新，由于项目繁忙未记录到更新日志，现重新开始记录更新日志。
- 2、公司npm服务器地址更换为【https://repository.microi.net/repository/npm/】，帐号密码询问Anderson（禁止泄漏）。目前主要包含microi.net（核心库）、dos.fontawesome（图标库）、microi.service（微服务基座）、V8引擎代码设计器、SQL设计器等等组件。需要使用nrm重新添加npm源。
- 3、V8引擎代码新增：GetDiyTableRowModel、GetDiyTableRowModelAsync、AddDiyTableRowBatch、UptDiyTableRowBatch、DelDiyTableRowBatch。
- 4、模块引擎iframe打开方式新增用法：/iframe/http://itdos.com/?diytoken=${V8.CurrentToken}#/test?param=test，可不用再替换:/等符号，支持传入当前token。
- 5、diy框架新增：若url出现ShowClassicTop=0参数，则会隐藏系统框架顶部区域，只保留左侧菜单和右侧内容。
- 6、【重要】表单引擎新增[关联表单]控件，可增加指定或切换任意关联表单，同步新增、修改、查看。
- 7、修复工作流引擎某些情况下无法启动、无法获取绑定人员等Bug。
- 8、表格模板引擎支持await同步请求。
- 9、新增SSO单点登陆模块配置，支持多token配置（DIY系统内部token、或第三方系统token）自动登陆。
- 10、后端Microi.net组件发布v1.8.3.x，所有guid类型全部修改为string类型，方便集成第三方系统。
- 11、修复diy add方法升级后自动编号组件无法保存的Bug
- 12、前端微服务框架去除mock
- 13、现在后端Microi.net组件会记录捕获到的详细异常至系统日志。
- 14、修复表内编辑数字未成功保存小数点后面数值。
- 15、修复表内编辑行内新增某些情况下重复新增的bug。
- 16、系统设置现在可以配置左下角内容显示模板。
- 17、系统设置现在可以修改左侧模块背景颜色、文字颜色。
- 18、新增平台文档模块。

## v2.9.24 - (2021-09-24 00:20)

- 表单引擎组件【单行文本】、【多行文本】新增失去焦点事件V8引擎代码。
- 后端DIY接口大量完善，新增TableName、Id参数支持。

## v2.9.9 - (2021-09-09 09:25)

- V8引擎新增V8.ConfirmTips确认提示框函数。用法：V8.ConfirmTips('确认审批？', okCallback, cancelCallback, option)。 cancelCallback、option为可选参数，option可配置{Title:'',OkText:'',CancelText:'',Icon:''}
- 表单引擎设计器新增【移动端预览】
- 修复部分V8引擎代码bug。
- 表单引擎新增【图标库】组件。
- 表格模板引擎新增组件【开关】、【图标库】的默认处理。
- 恢复保持系统登陆状态。
- 新增【表单引擎组件管理】模块，

## v2.9.6 - (2021-09-06 16:46)

- 取消新增数据时添加子表数据会自动提交主表。
- 优化添加子表数据的前端逻辑，不会再出现不必要的刷新、不必要的数据重新获取。
- 修复表单更多按钮的V8代码执行bug、V8显示条件bug。
- 修复表单非抽屉弹出框执行V8.HideFormBtn()无效的bug。
- 现在微服务地址可以在系统管理中动态配置了，支持加载多个微服务。

## v2.9.5 - (2021-09-04 16:41)

- 前端微服务标准框架源码修复首次进去主框架时，访问微服务会出现404的bug。
- 【表单引擎】表单属性新增【允许匿名读取】、【允许匿名新增】配置，new DiyTableLogic().GetDiyTableRow()/AddDiyTableRow新增参数：_IsAnonymous，传入true表示匿名请求。
- 调用接口地址为：/api/DiyTable/GetDiyTableRowAnonymous或AddDiyTableRowAnonymous
- 【数据库操作】：
- Diy_Table表新增字段：
- IsAnonymousRead（是否允许匿名读取）
- IsAnonymousAdd（是否允许匿名新增）
- 类型均为：bit、不允许为null、默认值0
- Diy_Field表新增字段：
- IsLockField（是否锁定字段名称和类型）
- 类型为：bit、不允许为null、默认值0
- Sys_Menu表新增字段：
- FormBtns（表单更多按钮）
- 类型为：mediumtext，允许为null
- 【表单引擎】现在可以将所有非diy表转化为diy表，可用于直接加载客户老系统数据库表、扩展DIY系统的Sys_User等默认表。
- 【模块引擎】新增查询接口替换，指获取数据列表接口
- 【表单引擎】新增查询接口替换，指获取数据详情接口
- 【模块引擎】新增表单更多按钮，可用于添加审批等更多功能按钮
- 【V8引擎】新增V8.HideFormBtn('Update/Delete')函数，用于隐藏编辑、删除按钮。
- 现在表单的编辑、删除等按钮，需要等到数据加载完成、DOM渲染完毕后才会变成可点击，并且减少接口重复请求数，提升性能。
- 修复前端微服务框架i18n的$t报错bug。

## v2.9.3 - (2021-09-03 00:04)

- 修复子表控件无法被V8引擎代码隐藏的bug。
- 现在登陆界面支持在url中传入token参数实现自动登陆。
- 升级前端微服务架构，新增了一些默认组件引用，修复bug，详细请查看gitlab动态。

## v2.9.2 - (2021-09-02 13:59)

- 解决自动编号组件在设置前缀为数字时，自动增长错乱的Bug。
- 解决模块引擎->行更多按钮、页面多Tab、批量选择更多按钮 的V8显示条件执行结果有误的bug。
- 现在设置行更多按钮不会再在表格的操作列显示多余的空白，会根据当前数据列表可能出现的最多按钮数量动态设置宽度。
- 解决Confirm提示框被编辑器挡住的Bug。
- 修复富文本编辑器一系列问题：切换html模式显示错乱、鼠标右键弹出层不显示、P标签不再有margin-bottom的边距、编辑器默认高度由240调整为500。
- 表单详细信息弹出层增加【删除】功能按钮，拥有对应模块删除权限的账户才能看到此按钮。
- 系统设置增加Logo类型（文字、图形、文字图形）、Logo高度、Logo超链接设置项。

## v2.9.1 - (2021-08-31 15:29)

- 吾码Microi低代码平台从v1.0.0到v2.9.1，历经上百次更新迭代，现在开始做更新日志记录（之前版本未做更新日志记录）。
- 全新的系统界面。
- 部分功能模块新增骨架屏卡片数据列表显示模式，同时可切换回表格显示形式。
- 新增工作流引擎功能模块，以表单引擎驱动工作流引擎。
- 新增【系统设置】功能模块，由表单引擎驱动。
- 新增【框架更新日志】功能模块，由表单引擎驱动。
- iTdos.DIY后端低代码开发框架从v1.0.0.0到v1.7.0.1历经数十个版本，现更名为Microi.net，并且开始做更新日志记录。
- 注意：需要重新到Nuget引用Microi.net库，移除iTdos.DIY的引用，重新获取开发者License，并且整个解决方案替换代码【iTdos.DIY】为【Microi.net】，需要勾选匹配大小写。
- new DiyTableLogic().GetDiyTableRowModel()新增_SearchEqual参数，可不仅仅通过_TableRowId查询单条数据。
- 模块引擎新增【是否微服务】配置，用于主框架识别为微服务模块，不直接加载组件路径，而是加载微服务地址。
- 数据库需要执行更新操作：【ALTER TABLE `sys_menu` ADD COLUMN `IsMicroiService` bit NOT NULL COMMENT '是否微服务';】
- 现在新增表名支持以非【Diy_】开头，但仍然建议所有表以Diy_开头。
- iTdos.DIY前端低代码开发框架从v1.0.0到v1.7.6，历经数十个版本，现更名为Microi.net，并且开始做更新日志记录。
- 注意：
- 公司npm服务器地址更换为【https://nexus.itdos.com/repository/npm/】，帐号密码询问Anderson（禁止泄漏），之前的npm.itdos.com不再使用。
- 目前主要包含microi.net（核心库）、dos.fontawesome（图标库）、microi.service（微服务基座）等组件。
- 需要使用nrm重新添加npm源，安装microi.net组件库，并且修改所有代码【from 'itdos.diy'】为【from 'microi.net'】。
- 公司Gitlab上提供全新的前端微服务开发框架源码（禁止泄漏），所有定制开发均使用此框架进行开发。
- 请至【https://git.itdos.net:99/Anderson/Microi.Service.Framework】拉取源码（拉取源码后请先查看根目录文件【说明.txt】）。
- 注意所有定制开发需要重新创建git仓库并上传代码，如：Microi.Service.Aijuhome，无法直接上传至Microi.Service.Framework仓库。
- 表单引擎->图片上传组件->新增属性【是否压缩】、【文件大小限制】。
- 表单引擎->单选框组件->普通数据源支持添加数据项后修改。
- V8引擎代码支持同步请求后再设置V8.Result，如：var result = await V8.PostAsync()。
- 富文本组件在表格中显示的内容现在会去掉html标签。
- 修复前端一直不断抛出【Error in beforeDestroy hook: "Error: [ElementForm]unpected width】的异常。
- 修复子表数据关联出错的bug。
- 修复子表翻页后表格高度错乱的bug。
