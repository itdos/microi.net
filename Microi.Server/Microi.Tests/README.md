# Microi.Tests

原生 Full 宿主的进程观察器在每轮就绪校验中批量读取一次 CIM 进程表及 TCP 监听表，再逐 PID 校验原有身份、原生 CWD 和全部端口；不放宽 20 秒原生查询、30 秒夹具子命令及原身份断言。准入入口的子命令失败会把有界 stderr、退出码/信号和原生错误码保存到经 ACL 验证的私有 profile 目录 `admission-failure-*.json`，控制台只显示固定分类。stdout、命令参数明文和连接凭据不进入公开日志；私有诊断不得提交 Git 或上传公有证据桶。该诊断不代替重新执行原 Full。

`Microi.Tests` 是吾码后端统一自动化测试入口，合并了原
`Dos.Common.Tests` 与 `Dos.ORM.Tests`，并在私有源码存在时条件纳入
`Microi.AI.Tests`、FormEngine、ApiEngine、安全与多租户边界回归。
测试代码统一由此入口编排，但被测源码仍归属各自仓库；例如空数据库 V8
接口源码保留在 `Microi-V8-Engine`，其 Node 回归测试放在本项目 `V8/`
目录并由 `run-tests.ps1` 自动执行，避免复制线上脚本到 C# 测试夹具。

AI CAD、AI 员工中心和邮箱的统一 Node 入口使用
`V8/official-application-source-contract.json` 声明的唯一官方源码根。恢复源码时先从
官方 `iTdos` MCP 读取完整应用上下文，再逐文件核对原始字节数、SHA-256 与服务端
`SourceManifestHash`；门禁在执行业务测试前复核完整清单。吾码小龙虾继续归属其独立
官方 Git 仓，同时核对明确的提交与全部跟踪文件。缺少真实源码、正文漂移、路径越界
或清单不完整都会失败，不能用编译产物重写被测业务，也不能跳过客户私有项目缺源项。

本地仅增补 `package.json.scripts.test` 时，必须在声明中记录 `LocalTestOverlay`：
保留真实官方 MCP 的原始正文、字节数、SHA-256 与完整源码清单，并另外固定本地
字节及完整清单摘要。覆盖层只允许增加已审计的 `node --test --test-concurrency=1 tests`
命令，绑定声明中全部真实测试文件；依赖、其它 scripts 或业务正文变化仍失败关闭。
这份本地测试元数据记录不代表远端源码已经更新。V8 测试加载器必须使用函数包装
执行带顶层 `return` 的完整接口正文，不能依赖固定 LF 字符串截断调度入口。

## 测试归属

本项目只编排吾码平台能力及其内置资源的发布回归。官方或社区独立业务应用、
游戏和客户项目的规则、接口、画面、输入、音频与专项交付测试，保留在各自
源码根的 `tests/` 或独立测试工程中，由该应用的 `npm test`、C# 测试工程及
专项验收入口执行，不在本项目创建转调包装，也不进入平台 Quick/Full。
应用开发中若修复了平台通用缺陷，在本项目保留通用的最小回归夹具，
不依赖某个业务应用或客户源码目录。平台 SDK、商城协议及安装器测试仍归平台。

## 两级门禁

- `Quick`：不连接服务器、不写数据库。覆盖 Dos.Common、Dos.ORM、多数据库
  SQL 编译、图片/Office、安全边界、租户隔离、升级兼容、Jint 约束等。
  当同级 `Microi-V8-Engine` 存在时，还会执行空数据库接口引擎语法检查和
  Node 行为回归；缺少 Node.js 时失败关闭。
- `Full`：先执行 Quick 和完整后端 Release 构建，再对一个隔离测试租户真实
  执行 FormEngine 单条、批量、按条件 CRUD、查询、计数，以及 ApiEngine
  GET/POST 调用，最后清理本次唯一前缀的数据；同时覆盖 API 实际启动、健康
  检查、真实 Token、匿名系统配置脱敏和数据库连接串兼容。
  还会运行独立 MySQL/SQL Server 结构升级夹具、主租户指定子租户维护、子租户
  安装/更新全部平台应用、重复幂等提交、任务成功终态及零更新复跑；最后通过
  独立浏览器 Context 完成真实登录和通知中心按钮操作。官方 iTdos 是发布源，
  测试其控制子租户的维护能力，并断言不会出现给自身安装应用的按钮。
  真实 Redis 配置即时生效、并发跳过日志去重及新旧 Quartz 共库调度测试也属于
  Full，不属于无外部依赖的 Quick；所需配置在任何构建前检查，缺失即失败。

MongoDB 实库回归默认使用当前 MCP 对应的实际服务端版本，不固定要求 3.6/7 两套服务。
先只读探测 `buildInfo.version`，通过测试进程变量 `MICROI_TEST_MONGO_CURRENT` 提供隔离连接、
`MICROI_TEST_MONGO_CURRENT_VERSION` 提供精确版本（例如当前 MCP 探测为 `5.0.5`）。实测必须
与该版本完全一致，并输出实际版本；认证、日志幂等去重、游标分页、租户隔离及 update/delete/list
断言全部执行，不能用 ping 替代。除非特殊兼容问题必须验证旧版，否则不要求另建服务或再次询问固定矩阵。
特殊矩阵额外显式传入 `MICROI_TEST_MONGO_LEGACY` 与 `MICROI_TEST_MONGO_LEGACY_VERSION`，
两项必须成对、版本必须精确，且不能与当前端点重复（`localhost` 与 `127.0.0.1` 视为同一主机）。
报告只声明实际覆盖版本，单一 5.0.5 实测不代表覆盖 3.6 或 7。

`run-node-regressions.mjs` 自动发现本测试目录、`OfficialApplications/Resource` 和
`Microi.Client/tests` 的确定性 Node 测试；新增文件无需再维护手工清单。
无法分类、零测试、失败、取消、跳过或 todo 均失败关闭。Playwright 文件由真实
浏览器入口负责，不能混入 Node 单测冒充 E2E。

### 显式 SQL Server 集成例外

默认 `Full` 仍要求 SQL Server 配置及零跳过。只有用户明确授权 SQL Server 未覆盖时，
才接受测试专用授权回执；它不能用于跳过 MySQL、MongoDB、Quick、浏览器或其它失败。
`ReleaseGate/sqlserver-exemption.mjs` 固定精确24个 SQL Server 数据用例，三个混合
数据库 Theory 按 provider 数据行判断依赖，MySQL 的6个数据用例仍执行完整断言。

执行任务先回读人类授权，再在最终源码提交和冻结后生成 UTF-8 JSON 回执。回执必须包含
`schemaVersion:1`、`kind:"microi-sqlserver-integration-exemption"`、`issuedAt`、
真实 `sourceHead`、固定责任文件 `sourceFiles` 摘要、完整 `caseNames`，以及
`authorization` 中的 `source:"explicit-human-message"`、
`scope:"SQLServer integration only"`、真实 `threadId/turnId/messageId` 与非空原因。
源码绑定和24用例名单直接使用导出的 `currentSqlServerSource(候选根)` 与
`SQL_SERVER_CASES`，不能手工扩大例外名单或复用旧 HEAD 的回执。回执保存在任务临时目录，
执行方另行固定回执 SHA-256；回执正文不包含连接密码、Token 或其它秘密。

```powershell
# 此文件由执行任务依据已回读的人类授权生成，不由 Full 自动创建或默认发现。
$receipt = '<授权回执绝对路径>'
$receiptSha256 = (Get-FileHash -LiteralPath $receipt -Algorithm SHA256).Hash.ToLowerInvariant()
Remove-Item Env:MICROI_UPGRADE_SQLSERVER_TEST_CONN -ErrorAction SilentlyContinue
.\Microi.Server\Microi.Tests\run-tests.ps1 -Mode Full `
  -SqlServerExemptionReceipt $receipt -SqlServerExemptionSha256 $receiptSha256
```

原一键发布入口通过测试进程变量 `MICROI_TEST_SQLSERVER_EXEMPTION_RECEIPT` 与
`MICROI_TEST_SQLSERVER_EXEMPTION_SHA256` 传入相同回执；两项缺一、源码漂移、名单不符、
任何未授权跳过或失败均拒绝。独立回读重新解析本轮同一物理目录下的规范 TRX，核对 XML
完成状态、全部用例与统计，拒绝改写 JSON 投影、旧目录或链接替换。结果目录保留原 TRX、`sqlserver-exemption-outcomes.json`
和 `sqlserver-exemption-result.json`，一键脚本在候选一致性检查前再次核验这些指纹。
报告必须写“已执行用例通过，SQL Server 24项未覆盖”，不得称为原零跳过 Full；
没有显式回执的运行保持原严格行为。此例外不授权新建 Docker 依赖或写入业务数据库。

AI 回归分三层：源码模式条件编译 `Microi.AI.Tests` 的模型协议、租户/身份、
授权、Schema、媒体任务和 Jint 用例；Resource Node 测试执行真实 Managed AI
脚本；`Microi.Client/tests/ai-workbench-chat-stream.spec.mjs` 从实际工作台 SFC
的 AST 提取 `sendChatQuestion → sendChatStream → readChatSse` 闭包，替换网络
和宿主状态后执行普通/中转对话、UTF-8/CRLF 分片、最终结果、思考文本、
HTTP/SSE/网络失败、取消和旧文本响应。该文件由上述发现器自动进入 Quick/Full，
也可通过 `Microi.Client` 的 `npm run test:v8-ai` 定向运行。仅测试 `V8.AI`
工具模块或检查工作台路由字符串，不能证明实际工作台发送路径可运行。
这些离线测试使用受控响应，不代表真实供应商推理或线上工作台已验收；
发布 AI 改动仍须补目标模型的真实 HTTP/SSE 与浏览器对话证据。

内存诊断回归也由 `Microi.Tests` 的 xUnit 用例自动发现。`Fixtures/MemoryDiagnosticsNode`
只是受统一项目构建的隔离进程夹具，用于线程池耗尽、EventPipe 轮转和 HTTP 宿主，
不再作为第二个独立测试项目运行。Quick 执行合同断言与脚本基准的结果校验；Full
还执行身份刷新、栈轮转、MongoDB 事故重放和有界 MySQL 查询。后两者分别使用
`MICROI_TEST_MONGO_CURRENT` 与专用测试库 `MICROI_MEMORY_TEST_CONN`；未单独提供
MySQL 连接时复用 Full 的 `MICROI_TEST_SCHEDULE_MYSQL` 专用库。
连接共享 MongoDB 时，父进程为真实 Mongo/HTTP 夹具生成 `mci_mem_<随机UUID>` 租户并传给
子进程，保留原请求协议与断言。收尾先确认子进程退出，再用独立有界取消令牌清理仅本轮
已知租户对应的 `sys_log_` 数据库；不枚举或清理其它共享 MongoDB 数据。

Full 的 SDK 输出统一位于本次结果目录 `.net-artifacts`。`run-tests.ps1` 只为当前测试
进程绑定 `MICROI_TEST_REPOSITORY_ROOT`；源码定位以真实 `.csproj` 为标记，不能把
隔离输出中同名的项目目录当成源码。内存诊断仍在独立子进程执行，并按当前测试
程序集的 Configuration 与输出布局选定唯一夹具 DLL；产物缺失时失败，不借用旧 Debug。

`Microi一键编译发布.sh` 在发布后端、构建前端或仅推送镜像时自动调用 `Full`：先取得发布锁，
保持已加载候选源码的共享服务供测试使用，通过后再停止服务、改版本及发布。
PC/API 镜像候选仍覆盖根仓及六个闭源子仓的源码与内置资源；独立 `microi.uniapp`
的页面、客户资源和版本号不属于这两个镜像的构建输入，不阻断其发布。
`microi.uniapp/src/utils/` 由后端 SDK 契约测试读取，继续参与内容哈希校验。
缺少变量、零用例、失败或跳过均阻止发布；文档专用选项 6 不触发后端业务门禁。
AI 发布话术仍需要求在 VS Code 扩展发布前执行同一门禁，不能替代脚本检查。

构建完成后保存候选源码与 Docker 构建上下文的 SHA-256 回执；每次推送再次回读。
仅推送模式没有回执或产物发生漂移时拒绝发布，必须重新构建，不能用当前测试
通过替代另一份旧产物的证明。依赖镜像通过发行机的
`Microi一键编译发布.sh --mirror-dependencies` 同步到配置的阿里云命名空间。

## 新功能与缺陷修复的测试评审

| 风险 | 必须补充的测试位置/层次 |
|---|---|
| C# 公共能力、权限、V8、ORM、缓存、存储 | 本项目责任目录，正常/边界/拒绝/旧格式兼容 |
| 表单/接口引擎 HTTP、事务、租户隔离 | `FullStack`，隔离租户和唯一前缀数据，最后清理回读 |
| 平台内置应用包、平台 V8 脚本与生成器 | `V8` 或 Resource Node 行为测试、幂等和新版本不回退 |
| 前端登录、路由、控件与数据映射 | 前端确定性测试 + 真实浏览器路径；只测源码文本不足以验收 |
| 独立业务应用、游戏、客户项目 | 应用自身测试项目与发布验收；不进入平台 Quick/Full |
| 发布、镜像与构建产物 | `ReleaseGate`，缺失/失败/跳过/源码与产物漂移等负向测试 |

客户存量 SSO 路径可用 `FullStack/legacy-sso.e2e.mjs` 做只读专项验收；通过环境变量
`MICROI_TEST_LEGACY_SSO_ENTRY`、`MICROI_TEST_LEGACY_SSO_TARGET`、
`MICROI_TEST_LEGACY_SSO_EXPECT_TEXT` 提供入口/路由/目标页真实可见文案。
`--fresh-assets` 仅用于把旧网关缓存与真实资源响应隔离诊断，不修改响应或关闭 CORS；
报告必须披露此项，修复部署后的最终验收应不带该参数。
不在源码保存真实客户帐号或 Token，报告不记录重定向中的凭据。这类专项验收
不能代替 Full，也不能据此宣称所有客户业务均已覆盖。

Quick：

```powershell
.\Microi.Server\Microi.Tests\run-tests.ps1 -Mode Quick
```

Full 必须使用专用测试租户、专用测试表和可安全调用的测试接口引擎：

```powershell
$env:MICROI_TEST_API_BASE = "http://127.0.0.1:1052/"
$env:MICROI_TEST_PEER_API_BASE = "http://127.0.0.1:1053/"
$env:MICROI_TEST_OSCLIENT = "integration-test"
$env:MICROI_TEST_TOKEN = "<super-admin-test-token>"
$env:MICROI_TEST_FORM_ENGINE_KEY = "mci_release_gate"
$env:MICROI_TEST_API_ENGINE_KEY = "release_gate_echo"
$env:MICROI_TEST_CHILD_OSCLIENT = "integration-child"
$env:MICROI_TEST_CHILD_TOKEN = "<child-admin-test-token>"
$env:MICROI_TEST_FRONTEND_BASE = "http://localhost:61500"
$env:MICROI_TEST_ACCOUNT = "<main-test-account>"
$env:MICROI_TEST_PASSWORD = "<main-test-password>"
$env:MICROI_TEST_CHILD_ACCOUNT = "<child-test-account>"
$env:MICROI_TEST_CHILD_PASSWORD = "<child-test-password>"
$env:MICROI_UPGRADE_TEST_CONN = "<isolated MySQL upgrade_fixture connection on 127.0.0.1:62606>"
$env:MICROI_UPGRADE_SQLSERVER_TEST_CONN = "<isolated SQL Server upgrade_fixture connection on 127.0.0.1,62616>"
$env:MICROI_TEST_SCHEDULE_REDIS = "127.0.0.1:62681"
$env:MICROI_TEST_SCHEDULE_MYSQL = "<isolated schedule_gate MySQL connection on 127.0.0.1:62680>"
$env:MICROI_TEST_ALLOW_WRITES = "YES"
.\Microi.Server\Microi.Tests\run-tests.ps1 -Mode Full
```

主、子租户应来自同一维护控制面的有效租户目录。默认所有 HTTP 测试访问
`MICROI_TEST_API_BASE`；本地节点与生产子租户处于不同网络分组时，可分别指定
`MICROI_TEST_CONTROL_API_BASE`、`MICROI_TEST_CHILD_API_BASE`。应在报告中分别注明
本地候选源码和远端已部署代码的验收范围，不能用远端成功声称本地代码已经上线。
各 Token 的设备标识必须与 `MICROI_TEST_DID`（默认 `Microi.Tests`）一致。

`MICROI_TEST_PEER_API_BASE` 必须是加载同一候选源码的第二个独立 API 节点，和主测试节点使用相同主租户、运行分区、数据库及 Redis。消息通知双节点用例会核对启动批次一致、并发领取唯一、原会话重试恢复、重新登录不重复及关闭回执，通知只发给当前隔离测试帐号，结束后撤回。不同版本、不同分区或指向同一节点均不是有效的双节点验收。

共享工作区可用独立编译配置及 `run-tests.ps1 -SolutionPath <隔离解决方案路径>`
运行完整构建。隔离解决方案应保留原解决方案全部项目，仅更改输出配置和项目路径，
不能为通过 Full 门禁排除项目。MySQL 和 SQL Server 升级集成测试只接受本机连接，
各用例创建独立随机数据库并在结束时删除，不清空传入的 `upgrade_fixture` 数据库，
也不要求复用其它任务占用的固定端口。

默认复用当前 MCP 对应的 MySQL、Redis、MongoDB 和 HDFS/OSS/MinIO 服务，在已授权
范围分配本任务测试命名空间；需要回环地址的现有夹具可使用已登记的本地连接映射。
固定库名或端口被占用时不得另建本地依赖容器，也不得修改其它任务的标记。

MySQL 升级夹具支持 `MICROI_TEST_UPGRADE_DATABASE=microi_test_upgrade_<任务后缀>`，
并设置 `MICROI_TEST_UPGRADE_FIXTURE_ID`。调度夹具支持
`MICROI_TEST_SCHEDULE_DATABASE=microi_test_schedule_<任务后缀>`，并设置
`MICROI_TEST_SCHEDULE_FIXTURE_ID`。库名后缀为 8–40 位小写字母、数字或下划线；
连接串中的 Database 必须与显式配置完全相同，所有者为 16–80 位字母、数字、
下划线或连字符。调度库仍需预先初始化 Quartz MySQL 表结构。

在各自已核验归属的测试库中分别准备 `microi_upgrade_fixture` /
`microi_schedule_fixture` 表（`Id int PRIMARY KEY, FixtureId varchar(100) NOT NULL`），
`Id=1` 的 FixtureId 必须等于对应所有者。调度 Redis 仍使用独占 DB 或已限制的连接映射，
并设置同值的 `Microi:Full:ScheduleFixture`。测试只读核验标记，缺失、不匹配或读取失败均
在写入前停止，不自动创建或改写标记。旧固定名称及默认端口继续兼容，但不是并行测试
必须争用的资源。结束后只清理本任务拥有的命名空间，保留共享服务及其它任务数据。

测试表至少要有一个可写短文本字段，默认名为 `Name`；若不同，设置
`MICROI_TEST_NAME_FIELD`。测试会写入
短 `mrg<time><random>` 前缀数据并在 `finally` 中清理，兼容旧租户的
`varchar(20)` 测试字段。

测试接口若返回标准 DosResult，默认校验 `Code=1`；仅对已知返回 JSON
原始值的历史测试接口，可设置
`MICROI_TEST_API_ENGINE_RESPONSE_MODE=Any`，此时仍校验 GET/POST HTTP 与
JSON 传输，但不会伪造不存在的 DosResult 断言。

## Admission fixture：真实维护准入 HTTP 门禁

Full 的维护准入门禁由 `run-tests.ps1` 自动调用正式
`ReleaseGate/fixtures/admission/runtime.mjs`，不依赖某次任务目录的脚本。
当前支持 staged runtime：最终构建后核验同次双 API、前端、桥进程、源码 HEAD、
DLL 指纹与 fresh login，再创建独占 `adm_<32位nonce>` 租户。短前缀保留完整归属 nonce，并兼容存量 `sys_user.TenantId` 的36字符边界；临时账号不超过20字符，临时密码采用20字符强随机格式。 新租户先通过独立登记/物理库校验，再经正式应用导入接口安装源码闭包绑定的完整消息通知包；安装后仍必须通过聊天接口、归属和身份校验，禁止用SQL补接口。
非 staged Full 或缺失 profile 会在重型构建前明确失败；该测试不能 Skip。

在已有可信 staged Full 配置上设置 `MICROI_ADMISSION_PROFILE_FILE` 为绝对路径。
文件须为私有普通文件（Windows 仅当前 SID 与 SYSTEM；POSIX 当前用户 0600），内容例如：

```json
{
  "schema": 1,
  "task": "your-isolated-full-task",
  "expectedParentOwner": "your-registered-fixture-owner",
  "python": "C:/your-private-runtime/python.exe",
  "bootstrapFiles": ["C:/private/api-a/appsettings.json", "C:/private/api-b/appsettings.json"]
}
```

`task` 必须等于同次 runtime-ready 的任务，长度 8–67；`expectedParentOwner`
必须与已登记父测试库 `_ui_full_owner.TaskId` 相同。Python 需要 `pymysql`、`redis`。
两份 API 配置仅使用既有十项 bootstrap 字段，均指向已授权 loopback 依赖，
配置正文、端口、实际 ACL 和源码依赖在预检时冻结。不会认领旧数据库或创建新依赖服务。

正式入口在 FullStack 前按顺序完成：父夹具只读归属核验、创建普通 owner、
确认新租户/物理库不存在、调用正式 Managed 开通升级、读取真实注册及继承配置、
登记新库所有权、真实登录与 AccessKey 最小授权。所有密码/Token、逐阶段意图、
完整原文及 CAS 备份仅保存在本次结果目录 `admission/private`，创建后立即验证实际 ACL。
`admission-ready.json` 独立绑定原 runtime-ready 的 SHA，不修改既有 ready 协议。

HTTP 用例实际覆盖普通、分布式锁、Hub 兼容三条路径和在途排空；只在新租户中
对两个固定 Managed Key 做逐字节 CAS 替换/恢复，并用 HTTP 回读确认 API 节点缓存已恢复。
测试取消时使用独立有界清理 token；无法确认在途归零时保持维护关闭并保留备份，禁止强制解除。
FullStack 退出后正式入口撤销本次 AccessKey、删除新租户普通测试用户；新租户、
主测试库中的 owner 和精确资源清单保留供人工审查，不清空借用主/子库或伪造生产删除接口。

任何未知写入只留意图并停止，不自动重放租户开通。失败后先核对 private 中的原始回执，
按已冻结 context 与精确资源身份恢复；不得重新取当前哈希覆盖冲突或删除整套共享夹具。
离线契约测试只证明守卫与控制语义，不能代替同次 Full 的实际 HTTP/Mongo/Redis 通过证据。

## 敏感信息规则

- `Microi.Tests` 不保存任何真实账号、密码、Token、数据库连接串或私钥。
  Full 所需 Token 只通过进程环境变量注入，不能写进 `.cs`、README、TRX
  或提交到 Git。
- `Microi.net.Api/appsettings.iTdos.json` 是本机私有且已被 Git 忽略的配置，
  不属于测试项目，也不会复制到测试输出。其它开发者应维护自己的忽略配置。
- 测试内置泄密门禁，会拒绝凭据文件、私钥、长 Bearer/JWT、GitHub Token、
  AWS Access Key 等高置信度字面量，并检查测试输出不包含 iTdos 私有配置。
- 对真实租户执行时，登录和只读烟测可覆盖多个租户；写入测试只能使用名称、
  说明均明确为自动化测试用途的专用表，并必须带唯一前缀和清理回读。

## 能证明什么

通过 Quick 说明纯代码和组件回归通过；通过 Full 说明当前构建产物在指定
测试环境中完成了核心 FormEngine/ApiEngine HTTP 闭环。它会显著降低发布
风险，但不能证明任意租户业务 V8、第三方服务、生产数据、反向代理和所有
分布式故障都绝对无误。正式发布仍需两节点连接同一 Redis/数据库，覆盖重复
投递、节点中断、依赖短暂故障和滚动升级。
