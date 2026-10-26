# 🔌 Microi MCP Server 完整指南

Microi MCP Server 让 Codex、GitHub Copilot、Cursor、Claude Code、Trae 等 AI 工具连接真实的 Microi 服务器与 OsClient。它不是只读文档搜索器，也不是绕过权限的万能数据库接口：每个工具围绕平台业务对象设计，继续执行参数校验、当前身份、租户隔离、写入确认、审计与远端回读。

源码随主仓库开放：[GitHub](https://github.com/itdos/microi.net/tree/master/microi.mcp) / [Gitee](https://gitee.com/ITdos/microi.net/tree/master/microi.mcp)。普通用户推荐通过 [VS Code 插件或 CLI](/doc/v8-engine/microi-agent) 使用内置版本，无需单独克隆。

本文的精确读取、Manifest 会话引用及上下文载荷计量需要开发工具 **5.9.7 或以上**。升级后由新启动的 MCP 进程接管；正在运行的旧进程继续当前工作。以实际工具发现结果核对参数，完整系统和局部修改都继续执行相应质量与验收规范。

## 当前能力面

工具随版本演进。连接后使用 `tools/list`，或 Codex 单入口的 `list_tools` / `describe_tool` 获取本次实际可用工具、参数和说明；官网不把历史扫描数量作为当前连接能力。平台、开发工具和已加载的 MCP 进程分别记录版本，刚升级的安装包由新进程接管。

| 类别 | 代表工具 | 作用 |
|---|---|---|
| 连接与发现 | `microi_get_status`、`microi_get_db_schema`、`microi_get_field_list` | 确认服务器、租户、表与字段事实 |
| 表与索引 | `microi_create_table`、`microi_add_field`、`microi_get_table_indexes`、`microi_create_table_index` | 建模、布局、审计字段与物理索引回读 |
| 数据 | `microi_get_table_data`、`microi_add_form_data`、`microi_update_form_data`、`microi_seed_table_data` | 按普通 FormEngine 菜单、表、行和动作权限维护租户业务数据 |
| 平台管理员数据控制面 | `microi_get_administrative_capabilities`、`microi_admin_table_data` | 服务端实时复核超级管理员后，在当前租户查询或单行新增、修改、删除任意已注册表数据 |
| V8 与接口引擎 | `microi_list_engines`、`microi_get_engine_code`、`microi_save_engine_code`、`microi_run_engine` | 读取、版本化保存与远程执行 |
| 表单事件 | `microi_list_events`、`microi_get_event_code`、`microi_save_event_code` | 维护前后端表单 V8 事件 |
| 模块与权限 | `microi_create_module`、`microi_update_module`、`microi_set_role_permission` | 菜单、列、按钮、Tab 与角色授权 |
| Manifest 全系统交付 | `microi_get_manifest_schema`、`microi_plan_system`、`microi_generate_system`、`microi_validate_system` | 从自然语言编排完整低代码系统 |
| 页面与打印 | `microi_build_page_design`、`microi_save_page_design`、`microi_build_print_template_design` | 校验、生成并保存设计 JSON |
| 工作流与任务 | `microi_check_workflow_package`、`microi_test_workflow_condition`、`microi_save_workflow_package`、`microi_save_job` | 流程拓扑、条件测试与调度 |
| 蓝图 | `microi_list_blueprints`、`microi_get_blueprint`、`microi_save_blueprint`、`microi_validate_blueprint` | 读取、维护和验证业务架构 |
| 前端微服务 | `microi_list_applications`、`microi_create_microservice`、`microi_sync_microservice_source`、`microi_publish_microservice` | 创建、同步源码、构建与发布 |
| 应用商城 | `microi_install_store_application`、`microi_update_store_application` | 提交可恢复安装/更新任务；发布升版恢复可固定 `storeVersionId` 不可变快照 |
| 外部数据库 | `microi_list_database_types`、`microi_inspect_external_database`、`microi_query_external_database`、`microi_execute_external_database` | 结构探测、只读采样与受控高权限执行 |
| 文件迁移 | `microi_import_external_attachment`、`microi_upload_file_base64` | 从 URL、本机/UNC 或 Base64 写入 HDFS |
| Redis / MongoDB 日志 | `microi_redis_*`、`microi_query_mongodb_logs`、`microi_write_mongodb_log` | 诊断和显式确认后的维护 |
| AI、翻译、OCR | `microi_chat`、`microi_translate*`、`microi_ocr_recognize` | 调用当前租户可信配置的服务 |
| 数据库备份 | `microi_list_database_backup_tenants`、`microi_run_database_backup` | 提交带幂等键的持久化备份任务 |
| 访问密钥 | `microi_list_my_access_keys`、`microi_create_my_access_key`、`microi_revoke_my_access_key` | 管理当前用户自己的限期访问密钥 |
| E2E | `microi_get_playwright_context`、`microi_plan_playwright_e2e` | 生成租户绑定的测试上下文和计划 |

审批工作流包需包含 `FlowDesign/Nodes/Lines`。MCP 保存前检查人工节点的人员策略、
节点类型、坐标重叠与拓扑可达性，并回读当前租户的用户、角色、部门和岗位 Id；
缺省坐标会按拓扑补成像素值。模块 `openType=WorkFlow` 可在同一 Manifest 中通过
`flowName` 绑定已启用流程，或用 `flowDesignId` 指向现有流程；必须同步绑定相同
业务表。详见 [工作流引擎](/doc/system-engine/wf-engine)。

应用安装母版可将 `FlowDesign.IsEnable` 显式设为 `0` 或字符串 `"0"`，保持
禁用且不填写租户审批人。此时仅允许人工节点空绑定，拓扑、节点类型、绑定格式
及任何已填写的真实用户、角色、部门、岗位引用仍须通过检查和当前租户回读；
`false`、`null`、省略或 `UNBOUND_*` 假 Id 不能绕过门禁。目标租户使用正常配置
入口绑定真实审批人，重新检查后再启用；禁用模板安装成功不代表审批可用。

## 推荐接入方式

### 本地 HTTPS 证书

新版 MCP 对 `localhost` 和 `127.0.0.1` 保持 Node 默认的证书校验，也保留启动者设置的
严格策略。自签开发证书须先由系统或 MCP 进程信任；可在启动前用 `NODE_EXTRA_CA_CERTS`
指定已核验的公开 CA PEM。不要把私钥写入配置，也不要设置全进程跳过 TLS 校验。
验收应确认正确 CA 可以连接，无信任或陌生 CA 时请求在 TLS 握手阶段失败。

### 从已登录平台复制连接说明

只有 `Level >= 9999` 的超级管理员点击右上角 Api/Web 版本才会打开开发工具连接窗口；其他用户只显示版本。复制时服务器再次核验管理员身份，生成独立的开发工具 DiyToken，可在在线终端单独撤销，不影响浏览器会话。连接说明只保留安装 CLI、标准输入导入及初始化验收步骤，无需向 AI 提供平台密码。

同一窗口的“角色 AI 开发权限”提供角色搜索、允许连接、访问范围、创建/修改、删除开关，并与角色编辑的权限明细使用同一份 `sys_rolelimit` 授权。未配置时默认关闭；超级管理员保留完整权限。保存使用加载时的版本核对，另一个窗口已修改时要求刷新，防止互相覆盖。

“仅角色模块及对应表单”保留模块、表、行和字段权限，只允许受限的元数据编辑与业务数据操作，不开放服务端脚本、SQL、身份或基础设施管理。完整范围及创建/修改、删除同时开启后具有服务端代码执行能力，只应授予可信开发者；完整只读与另一个受限角色的写权限不会组合成完整写权限。后台在每次 MCP 请求重新检查当前租户主库授权，撤销无需等待旧 Token 过期；MCP/VSCode 开发会话不能改走普通 HTTP 路由绕过限制。

此功能需同步升级平台、SaaS 引擎官方应用及开发工具。普通账号由管理员授权后使用自己的账号连接，不应共享管理员复制出的 Token。

新版 CLI 支持 `microi auth import --session-stdin`，从标准输入读取连接 JSON 并向服务器验证，再用系统加密存储保存。Token 不应进入命令参数、项目源码或日志。接着运行 `microi ai init` 和 `microi doctor`，验证 MCP 的初始化、工具清单与当前租户状态。模型服务的登录与计费独立于平台 Token，保留 AI 工具既有模型配置；未配置时由用户通过 AI 工具自身的授权流程完成登录。Windows 导入连接的 Token 和 MCP 共享 Token 均由当前系统用户的 DPAPI 加密保护，使用支持该格式的新版 CLI/MCP 读取，不能复制保险库到另一台机器直接使用。

需要新版平台、SaaS 引擎应用和包含该导入命令的 CLI 配合使用。

### VS Code 插件

安装 Microi吾码插件后执行：

1. `Microi: 插件配置`，填写服务器与 OsClient。
2. `Microi: 登录`。
3. `Microi: 初始化AI配置`。
4. `Microi: 配置 MCP（AI 工具连接）`。
5. `Microi MCP: 诊断 MCP 可调用性`。

诊断会真实执行 MCP `initialize`、`tools/list` 和状态读取，不只是检查配置文件存在。

### CLI

```bash
npm install -g @microi.net/cli
microi init --pull
microi doctor
```

CLI 与插件共用连接、Token、MCP、Skills、V8 工作区和同步基线。需要自动续登时，帐号密码与 Token 通过当前系统用户的安全存储保存；项目配置仅保存引用。Windows 使用 DPAPI，macOS 使用 Keychain；支持 Linux 的新版 CLI/MCP 使用 Secret Service，需要 `/usr/bin/secret-tool`、当前用户的 D-Bus 会话和已解锁的钥匙环。无可用钥匙环时，CLI 写入和会话引用恢复会给出 `MICROI_SECURE_STORAGE_UNAVAILABLE`；MCP 凭据读取也可能报告凭据不可用，均不会回退到明文文件。首次生成 Codex MCP 配置后，已打开的会话通常不会热加载新工具，新进程再验收。

无交互终端中，宿主可通过标准输入向 `microi auth login --credentials-stdin` 提交原始 JSON，字段为 `Username`、`Password`，连接仍由所选 Profile 决定；已有独立开发工具会话则使用 `auth import --session-stdin`。密码输入保留原始空格，不能先 trim。秘密不得进入命令行参数、源码、日志或公开输出；非 TTY 不再回退到会回显的普通密码输入。

云平台提供的代理密钥占位符不等于原始平台密码。只有宿主支持安全注入原始凭据，且有可用系统安全存储时，才能完成上述持久登录；CLI 不能自行解开不透明占位符。HTTP 200 但 `Code=1001/0` 且提示未携带 Token 表示业务认证失败，不能据此报告登录成功。导入或登录后继续验证 `doctor`、MCP `initialize`、`tools/list` 和 `microi_get_status` 的真实身份与租户；开发源码测试通过不代表 npm 已发布该能力。

### 独立 stdio / SSE

需要自行部署时，`microi.mcp` 支持本地 stdio 与远程 SSE。SSE 适合团队共享，但必须放在受控网络、TLS 和反向代理之后，并绑定服务器端凭据；不要把管理员帐号密码写入公开镜像或前端配置。

MCP 的租户连接由 API、`OsClient`、`OsClientType`、`OsClientNetwork` 共同确定。独立部署可设置 `MICROI_OS_CLIENT` 及可选 `MICROI_OS_CLIENT_TYPE`、`MICROI_OS_CLIENT_NETWORK`；显式 Type/Network 必须绑定非空 OsClient。已配置坐标随 Login 表单、Refresh 正文和所有 API Header 传输，流式 multipart 表单也使用同一坐标，普通 JSON 业务正文与 GET 查询不额外注入 Type/Network。省略可选项保持原协议；单次请求与已配置坐标冲突、重复或含非法标识时发送前拒绝。

SSE 每个连接使用 `X-Microi-OsClient` 及可选 `X-Microi-OsClientType`、`X-Microi-OsClientNetwork` 选择对应坐标，省略项沿用服务器默认值；Login、续签和工具上下文保持同一连接身份。恢复后必须先执行 `initialize`、`tools/list` 和 `microi_get_status`，核对服务端实际四段连接身份。Token 文件键或本地配置不能代替该回读，也不能为匹配分区而修改 SaaS 租户网络记录。

三参数只声明连接目标，不能切换 API 节点的可信运行分区或发布门禁。ApiBase 必须指向目标分区的真实节点；Header 正确而状态仍不符时停止写入，修正节点地址，不改 SaaS/gate、不借其它分区任务，也不通过请求头强迫节点切区。

标准 stdio 服务使用固定 `128 MiB`（`134217728` 字节）未解析 JSON-RPC 缓冲，
超过上限会拒绝并关闭连接；调用端若仍使用 SDK 默认 `10 MiB`，大响应仍会失败。
按整个 UTF-8 wire 计算 Base64、JSON 信封及重复 `Data/Result`，不能只按原包大小估算。
单 Base64 字段理论可承载约 `96 MiB` 原字节减信封，但这不是 HDFS `256 MiB`
应用包能力的新限制，也不保证任意 `64 MiB` 结果能通过重复正文包装。
已有正规完整包协议继续保留精确版本、CAS、HDFS 哈希回读及不可变快照；超限源码或
运行资产使用已有目录/文件 stream、分片及小型回执，禁止设无限缓冲。连接关闭后先
回读原请求结果，再决定是否恢复；不能盲重传或换请求键。

## Codex 单入口兼容

部分 Codex 版本不会稳定注入超大工具集。Microi 提供 `microi_codex` 单入口：

```text
action=list_tools
action=describe_tool, params={name:"microi_get_db_schema"}
action=microi_get_db_schema, params={...}
```

单入口只改变协议暴露方式，仍调用原始工具注册与参数 Schema，不会绕过写入确认、审计或远端回读。还可使用 `microi://codex/status`、`microi://codex/tools` 与 action 资源模板做兼容发现。

## 从自然语言生成系统

质量优先于 token、耗时和回复长度。完整系统仍须执行原八项、菜单先行、业务/经营/领导报表及真实验收；局部修改先确认目标、当前版本和依赖，范围不清时扩大读取，不能依据一页摘要猜测修改。

标准顺序是：

1. `microi_get_db_schema`：读取已有表，避免重复建模。
2. `microi_get_manifest_schema`：获取当前 Manifest 协议与示例。
3. `microi_plan_system`：检查字段、菜单、页面、流程和依赖顺序。
4. `microi_generate_system` + `dryRun:true`：只生成执行计划。
5. 用户确认真实写入范围。
6. `microi_generate_system` + `dryRun:false` + `confirmExecution`：执行。
7. `microi_validate_system`：独立回读表、字段、接口、菜单、页面、打印、流程等结果。

Manifest 支持角色、表、索引、数据源、接口引擎、事件、菜单、权限、页面、打印模板、工作流和任务。常规表单字段不要默认写 `FormWidth=24`；整行控件才使用整行宽度。绑定表的菜单应同时补齐 PC/移动列、搜索列、隐藏列、排序、统计与卡片字段。

### 原始声明的整体写前检查

AI 生成的 JSON 能解析，不代表能够安全落地。新增的声明预检先检查原始资源，
再做关系、字段和工作流等领域检查；计划、dry-run、生成与独立验收共用同一入口。

| 情况 | 处理 |
|---|---|
| 把 `engines` 等资源集合写成对象、字符串或 `null` | 整体拒绝；不需要该集合时省略属性 |
| 数组夹有 `null`、字符串、数组或空资源对象 | 返回原始项的位置，不静默忽略 |
| 同时传 `tables/Tables` 等别名且内容不同 | 拒绝歧义；相同声明继续兼容 |
| 同一声明重复表名、接口 Key、数据源 Key | 按大小写不敏感检测，拒绝后写覆盖 |
| 同一张表重复字段名或显式索引名 | 写入前拒绝；不同表的同名字段合法 |

例如 `engines:[{"apiEngineKey":"biz-check"},null]` 会明确指出 `engines[1]`，
不会先保存合法的第一项。错误只返回路径与固定原因，不回显原始代码或数据。
合法的局部更新和省略可选集合继续支持。

### 权限引用与验收结果

开发工具 **6.1.7** 的权限预检与独立验收共同防止“计划可解析但实际授权错误”以及“回包不完整却报告通过”。
具体回归可从[声明交付检查](https://github.com/itdos/microi.net/tree/master/microi.benchmarks/manifest-delivery)复跑；
安装包与已加载的 MCP 进程必须包含相同变更，源码测试不代表旧进程自动升级。

升级 CLI 时使用官方 npm 渠道；VS Code 用户通过扩展市场更新吾码插件：

```bash
npm install -g @microi.net/cli@latest --registry=https://registry.npmjs.org/
microi version --json
microi doctor
```

`microi version` 显示已安装 CLI；Codex 单入口 `action=profiles` 的
`toolchain.loadedVersion` 显示本次连接实际加载的 MCP。两者应分别核对，
已有任务保持运行，新任务或宿主自然重启后再检查已加载版本。更新工具本身不会
修改租户数据库，也不能代替当前租户的独立验收。

| 情况 | 处理 |
|---|---|
| `roleName` 或 `moduleNames` 拼错、同名资源有歧义 | 计划阶段拒绝；名称必须唯一指向本次声明，现有资源使用回读后的 `roleId` / `menuIds` |
| 权限数组含无效成员，或大小写属性别名冲突 | 整体拒绝，不静默丢项 |
| 保存角色或菜单返回成功但未返回可解析 Id | 在本批第一笔权限写入前停止；不回退管理员、不写入缩减后的菜单集 |
| 系统验收仅返回 `Code=1`，缺 `Data.Passed` 或不是布尔值 | 报告验收失败并保留原始诊断；不得据此报告完整交付成功 |
| `Passed=true` 但 `Errors` 非空或格式错误 | 报告验收失败；明确通过且没有错误时才通过 |

省略角色继续保持已有管理员默认约定；显式指定的角色不能因解析失败切换为管理员。
省略权限声明与显式清空菜单权限是不同操作，写入前确认目标。
权限解析失败可能发生在角色、菜单已保存之后；返回已有步骤供回读，不能把停止权限写入解释成跨资源自动回滚。

该能力由 MCP 工具实现，权限引用与严格验收修复需要 **6.1.7 或以上**；
`microi_get_manifest_schema` 的 `declarationPreflight.version=1` 表示声明预检协议，
不能单独代替工具发行版本判断。已经运行的旧 MCP 进程不会因官网更新而自动获得能力。
它不代替服务端权限、跨资源事务或写后回读；执行阶段失败仍须核对实际状态。
可复现源码与检查入口见[声明交付证据](https://gitee.com/ITdos/microi.net/tree/master/microi.benchmarks/manifest-delivery)
（[GitHub](https://github.com/itdos/microi.net/tree/master/microi.benchmarks/manifest-delivery)）。

### 精确读取与完整性

新版读取工具先返回可遍历的摘要，减少无关信息。首次完整开发必须盘点全部相关资源，并读取字段/关系详情；摘要不等于完整结构，不能因为没有在第一页看到资源就重复创建。

| 工具 | 精确读取方式 | 必须检查 |
|---|---|---|
| `microi_get_db_schema` | 默认表目录；`detail:"fields"`、`tableNames`、`fieldNames` 获取目标结构；查询通过受保护 FormEngine 下推 | `Paging.hasMore/nextCursor`、`Completeness`；过滤范围与权限 |
| `microi_list_applications` | 默认应用摘要；`keyword/appType` 筛选；显式 `includeFiles:true` 才带文件清单 | 返回集合的上游完整性声明，不能把目录摘要当全租户事实 |
| `microi_get_application_context` | 按应用获取文件清单，使用 `filePaths/pathKeyword` 选择文件；按需 `includeContents:true` | 分页、逐文件错误和是否实际读取正文 |
| `microi_get_application_file` | `startLine/endLine` 读取行范围，`query` 做纯文本搜索；`detail:"full"` 明确读取全文 | `ReadSummary.completeFile`、源码哈希；片段不可替代全文覆盖 |

分页游标绑定当前连接、查询条件和资源快照；改变身份、过滤条件或源码后应重新开始读取。二进制默认返回引用，不将大型 Base64 塞进模型上下文；显式全文请求继续受读取上限约束。错误、未知完整性和截断都需要补读，不能当成完整成功。

### Manifest 引用与原有调用兼容

较大 Manifest 可在 `microi_plan_system` 一次提交正文并传 `detail:"summary"` 获取 `manifestRef/manifestHash`，后续用同一引用完成 dry-run、执行和独立验收；原有直接提交 `manifest` 的方式继续支持。小正文可以继续直接传输，不为使用引用增加无意义往返。

```json
{"action":"microi_generate_system","params":{"manifestRef":"<本会话返回的引用>","manifestHash":"<原始内容哈希>","dryRun":true,"detail":"summary"}}
```

实际执行仍需要 `dryRun:false` 和目标租户的 `confirmExecution`，重新运行结构检查及当前权限校验。引用是当前 MCP 会话的传输优化，不是授权、分布式状态或持久任务；过期、凭据变化和进程重启后重传已核对正文。写入结果未知时先回读，不盲目重放。

正文调用默认保留完整回执；引用调用默认摘要，保留错误、警告、资源状态和完整验证结果。通过现有 `microi_plan_system` 的 `action:"read_result" + resultRef` 可取回完整证据。部分成功、验证失败和未知结果不能被摘要成“完成”。

### 可测量的节省

`microi_get_context_metrics` 返回当前 MCP 会话中已验证工具参数与回执的 UTF-8 字节、调用数、错误数和耗时，不存源码或凭据。它不包含模型历史、协议外层和供应商 Usage，不能当作 token 账单。

仓库提供 `microi.mcp/scripts/evaluate-context-efficiency.mjs`：使用 `--baseline`、`--candidate`、`--output` 导入脱敏计量和验收摘要。只有同任务、同模型、同验收契约且全部通过时才输出可比较的节省比例；供应商输入、缓存输入、输出、推理和费用缺失时明确显示未知。离线载荷对比不代表完整项目的实际 token 或工期改善倍数。

模块 `modules[].tableHeaders` 可配置合并表头，例如 `[{"Label":"人数（人）","Fields":["Total","Male","Female"]}]`；字段名须与相邻的可见表格列一致。嵌套分组使用 `Children`。设置 `hideTableBanner: 1` 或 `hideFormBanner: 1` 可分别关闭顶部列表和表单 Banner，省略或设为 `0` 则保持显示。已有模块可用 `microi_update_module` 更新 `TableHeaders`、`HideTableBanner`、`HideFormBanner` 并回读，完整字段说明见[模块引擎](/doc/system-engine/module-engine.html)。

`TableChild` 的回查索引必须对应真实物理列。默认独立租户库不自动创建 `OsClient` 列，例如子表外键为 `OrderId` 时使用 `columns:["OrderId"]`；只有显式声明了 `OsClient` 物理列的共享表，才使用 `columns:["OsClient","OrderId"]`。平台固定物理列是 `Id/CreateTime/UpdateTime/UserId/UserName/IsDeleted`；`CreateUser` 不是默认字段，`TableChild` 与布局控件本身也不能建索引。新版计划检查在远端写入前拒绝这些无效索引，存量工具出现错误的租户列要求时应更新 MCP，不应为通过计划而虚构字段。

## 读取、写入与高风险操作

| 级别 | 示例 | 要求 |
|---|---|---|
| 只读 | 状态、Schema、列表、代码读取 | 仍绑定当前身份、URL 与 OsClient |
| 普通写入 | 保存 V8、字段、模块、页面 | 显式确认；成功后远端回读关键字段 |
| 可执行副作用 | 运行接口/数据源、安装应用、备份 | 使用稳定幂等键，区分排队成功与业务完成 |
| 高权限/破坏性 | 任意外库 SQL、删索引、删 Redis Key | 更高角色门槛、明确目标与专用确认值 |

工具返回 `Code=1` 只代表该次协议调用成功。安装、备份、文件迁移等后台任务还要读取任务状态和最终对象；前端功能还要做真实 PC/移动页面验收。

### 平台管理员通用数据控制面

普通的 `microi_get_table_data`、`microi_add_form_data` 和 `microi_update_form_data` 继续执行 FormEngine 的菜单、表、行和动作权限，不会因为模型声称自己是管理员而放宽。确需维护保护表或执行通用删除时，按以下顺序调用：

1. `microi_get_administrative_capabilities`：服务端从 DiyToken 取身份，并同时复核当前租户 `sys_user`、用户状态和有效管理员角色；平台内置最高管理员阈值是 `Level >= 9999`。
2. `microi_get_db_schema(tableName?)` 与专用业务工具：先理解真实表、字段、引擎及配置，已有角色、菜单、页面、工作流等专用工具时仍优先使用。
3. `microi_admin_table_data`：支持 `query/get/add/update/delete`。查询每页最多 200 条；写入仅允许单行，并要求 `ADD:<表名>`、`UPDATE:<表名>:<Id>` 或 `DELETE:<表名>:<Id>` 精确确认。
4. 使用同一工具回读目标行；写入审计只记录租户、操作、表、Id、字段名和结果，不记录字段值。

该能力只接受真实登录的 DiyToken，会拒绝访问密钥会话，也不相信请求体中的 `Level`、`OsClient`、`_CurrentUser` 或 `_TrustedServerInvocation`。密码、Token、API Key、私钥、连接串和 `SecretCipher` 等字段在通用读取中递归脱敏，并禁止通过通用入口写入；应改用对应的专用安全端点。

## 租户与安全边界

- 每次连接绑定 API URL、OsClient、用户身份和网络环境；不要跨连接复用 Token。
- 写工具从当前 Token 解析租户，不能相信模型随意传入的另一个 OsClient。
- 平台管理员通用数据能力使用 `Level >= 9999`，因为 9999 是吾码保留的内置最高管理员等级；使用 `> 9999` 会错误排除标准超级管理员。Token 声明还必须由当前租户主库与有效角色复核。
- `microi_admin_table_data` 仅限当前租户和真实登录会话，不向访问密钥开放；它不提供跨租户、任意 SQL 或秘密字段明文读取能力。
- 密码、数据库连接串、OCR/AI Key 和对象存储密钥不应出现在工具结果或审计正文。
- `microi_execute_external_database` 等高风险工具只对后端确认的高权限用户开放。
- MCP 的“可点击/可调用”不是最终授权边界，服务端仍执行菜单、表、行和动作权限。
- 超时后的结果不确定时先回读，不要直接重复写入；若返回 `RecoveredAfterTransportError:true`，表示远端状态已经确认。

## 常见问题

### 配置成功但当前对话没有工具

先运行 MCP 诊断；诊断通过后新开 AI 对话或重载客户端。Codex 可先检查 `microi_codex` 单入口与资源模板。

### 能否只安装 CLI，不装 VS Code

可以。自然语言建模、V8、页面、打印、工作流、微服务和回读验收都通过同一 MCP 完成；编辑器资源树、Diff 和逐行断点调试仍是 VS Code 插件的交互能力。

### 为什么不能直接用 SQL 建全部资源

表、字段、菜单、权限、页面和工作流同时包含元数据、缓存、物理结构与兼容规则。标准工具会校验、幂等写入并回读；临时 SQL 容易留下只有物理列、没有 `diy_field` 或菜单显示配置的半成品。

### 如何获得最新工具清单

使用运行时 `tools/list`；Codex 单入口使用 `list_tools`，再对目标工具执行 `describe_tool`。不要长期复制一份静态参数 Schema 到提示词中。
