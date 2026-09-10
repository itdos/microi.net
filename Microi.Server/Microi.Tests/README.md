# Microi.Tests

`Microi.Tests` 是吾码后端统一自动化测试入口，合并了原
`Dos.Common.Tests` 与 `Dos.ORM.Tests`，并在私有源码存在时条件纳入
`Microi.AI.Tests`、FormEngine、ApiEngine、安全与多租户边界回归。
测试代码统一由此入口编排，但被测源码仍归属各自仓库；例如空数据库 V8
接口源码保留在 `Microi-V8-Engine`，其 Node 回归测试放在本项目 `V8/`
目录并由 `run-tests.ps1` 自动执行，避免复制线上脚本到 C# 测试夹具。

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

`run-node-regressions.mjs` 自动发现本测试目录、`Microi.Upgrade/Resource` 和
`Microi.Client/tests` 的确定性 Node 测试；新增文件无需再维护手工清单。
无法分类、零测试、失败、取消、跳过或 todo 均失败关闭。Playwright 文件由真实
浏览器入口负责，不能混入 Node 单测冒充 E2E。

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
| 应用包、V8 脚本与生成器 | `V8` 或 Resource Node 行为测试、幂等和新版本不回退 |
| 前端登录、路由、控件与数据映射 | 前端确定性测试 + 真实浏览器路径；只测源码文本不足以验收 |
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

调度共库夹具另使用专用 `schedule_gate` 空库（`127.0.0.1:62680`，预先初始化
Quartz MySQL 表结构）与独立 Redis（`127.0.0.1:62681`）。只允许一次性测试实例，
禁止指向业务库；测试结束关闭本任务创建的容器，不停止其它任务的共享依赖。

并行任务可为上述两个环境变量指定自己的回环地址高位端口，数据库仍必须为
`schedule_gate`。使用非默认端口时，必须设置 16–80 位字母、数字、下划线或连字符组成的
`MICROI_TEST_SCHEDULE_FIXTURE_ID`，并在自己的 MySQL 中准备
`microi_schedule_fixture (Id int PRIMARY KEY, FixtureId varchar(100) NOT NULL)` 的 `Id=1`
记录、在自己的 Redis 中设置 `Microi:Full:ScheduleFixture`，两者的值均为该夹具 Id。
测试在任何调度写入前核验归属；标记缺失或不匹配会失败，调度业务断言和 Full 门禁保持不变。

测试表至少要有一个可写短文本字段，默认名为 `Name`；若不同，设置
`MICROI_TEST_NAME_FIELD`。测试会写入
短 `mrg<time><random>` 前缀数据并在 `finally` 中清理，兼容旧租户的
`varchar(20)` 测试字段。

测试接口若返回标准 DosResult，默认校验 `Code=1`；仅对已知返回 JSON
原始值的历史测试接口，可设置
`MICROI_TEST_API_ENGINE_RESPONSE_MODE=Any`，此时仍校验 GET/POST HTTP 与
JSON 传输，但不会伪造不存在的 DosResult 断言。

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
