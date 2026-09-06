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

`Microi一键编译发布.sh` 在发布后端或构建前端时自动调用 `Full`：先取得发布锁，
保持已加载候选源码的共享服务供测试使用，通过后再停止服务、改版本及发布。
缺少变量、零用例、失败或跳过均阻止发布；文档专用选项 6 不触发后端业务门禁。
AI 发布话术仍需要求在 VS Code 扩展发布前执行同一门禁，不能替代脚本检查。

Quick：

```powershell
.\Microi.Server\Microi.Tests\run-tests.ps1 -Mode Quick
```

Full 必须使用专用测试租户、专用测试表和可安全调用的测试接口引擎：

```powershell
$env:MICROI_TEST_API_BASE = "http://127.0.0.1:1052/"
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
$env:MICROI_TEST_ALLOW_WRITES = "YES"
.\Microi.Server\Microi.Tests\run-tests.ps1 -Mode Full
```

主、子租户应来自同一维护控制面的有效租户目录。默认所有 HTTP 测试访问
`MICROI_TEST_API_BASE`；本地节点与生产子租户处于不同网络分组时，可分别指定
`MICROI_TEST_CONTROL_API_BASE`、`MICROI_TEST_CHILD_API_BASE`。应在报告中分别注明
本地候选源码和远端已部署代码的验收范围，不能用远端成功声称本地代码已经上线。
各 Token 的设备标识必须与 `MICROI_TEST_DID`（默认 `Microi.Tests`）一致。

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
