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
$env:MICROI_TEST_ALLOW_WRITES = "YES"
.\Microi.Server\Microi.Tests\run-tests.ps1 -Mode Full
```

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
