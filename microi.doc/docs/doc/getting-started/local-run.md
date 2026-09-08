# 💻 源码本地运行

> **在本地环境中运行 Microi吾码源码（前端 + 后端）**

---

## 🎥 视频教程

- 待重新录制上传
- 历史视频教程：[https://net.itdos.net:999/sharing/ZBN5cLPKa](https://net.itdos.net:999/sharing/ZBN5cLPKa)

---

## 一、后端运行

### 📦 下载源码与 .NET 环境

- 使用 Git 从开源地址拉取最新代码：[GitHub 仓库](https://github.com/itdos/microi.net) / [Gitee 仓库](https://gitee.com/ITdos/microi.net)
- 下载并安装 .NET 10 SDK：[.NET 下载页](https://dotnet.microsoft.com/zh-cn/download)

---

### 🛠️ 使用 VS Code 打开解决方案（Mac 推荐）

1. 下载并安装 [VS Code](https://code.visualstudio.com/)
2. 安装插件：**C# Dev Kit**
3. 打开 `/Microi.Server` 目录，稍等几秒会自动出现【解决方案资源管理器】，等待自动还原 NuGet 库
4. **必须**配置 `/Microi.net.Api/appsettings.json` 文件
```json
  "AppSettings": {
    "OsClient": "iTdos",//【必须】自定义SaaS引擎Key，与数据库【sys_osclients】表的【OsClient】字段值对应
    "OsClientType": "Product",//【必须】自定义程序运行环境，如：Product（正式环境）、Dev（测试环境）等
    "OsClientNetwork": "Internet",//【必须】自定义网络类型，如：Internet（公网）、Internal（内网）等
    "OsClientDbType": "MySql",//默认MySql，可选SqlServer、Oracle
    //【必须】数据库连接字符串，建议使用源码提供的MySql。同时支持SqlServer、Oracle
    "OsClientDbConn": "Data Source=192.168.31.1;Database=microi_empty;User Id=roo;Password=password123456;Port=3306;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;Min Pool Size=5;Connection Lifetime=300;Connection Timeout=30;Pooling=true;sslmode=None;",
    //SqlServer连接字符串示例：Server=192.168.31.1,1434;Database=microi_empty;User Id=sa;Password=password123456;
    //Oracle连接字符串示例：User Id=MICROI;Password=password123456;Data Source=192.168.31.1:1521/xe;
    //Tips：若【OsClient + OsClientType + OsClientNetwork】在【sys_osclients】表中能匹配到数据，且数据中有Redis相关配置，则可以省略以下Redis配置
    "OsClientRedisHost" : "",//Redis Host，如：119.31.116.88
    "OsClientRedisPort" : "",//Redis端口，如：6379
    "OsClientRedisPwd" : "",//Redis密码，如：123456
    "OsClientRedisDataBase" : ""//Redis库，如：0、5
    //其余配置分布式存储（如阿里云OSS、MinIO）、MQ消息队列、ES搜索引擎等，均在平台【SaaS引擎】中动态配置
  },
```

本地与存量部署的 CORS 在未配置来源时默认允许任意来源；只有在 SaaS 引擎主租户的 `CorsAllowOrigins` 中填写来源后才收紧。严格 SSRF 模式同样默认关闭，并由主租户 `SsrfProtectionEnabled` 控制。不要为了本地调试删除登录 RSA 历史兼容密钥或私有授权密钥；完整规则见 [平台安全与兼容基线](../more/security)。

::: warning 注意事项
- 拉取源码后，请**优先将 `Microi.net.dll` 更新至最新版本**
- 若 NuGet 自动还原失败 / 加载项目失败导致编译失败，可尝试重启 VS Code 重新加载项目等待 NuGet 还原
:::

5. 右键 `Microi.net.Api` 项目 → 调试 → 启动新实例
6. 访问地址：`https://localhost:7266`（端口在 `/Microi.net.Api/Properties/launchSettings.json` 配置）

---

### 🖥️ 使用 Visual Studio 2022 打开解决方案（Windows 推荐）

1. 下载并安装 [Visual Studio 2022](https://visualstudio.microsoft.com/zh-hans/)
2. 双击打开 `/Microi.net.sln`，稍等片刻右键 `Microi.net.Api` 项目 → 重新生成
3. 若还原 NuGet 包失败，关闭 VS2022 并重新打开 `Microi.net.sln`（一般是网络问题，可尝试手机热点）
4. **必须**配置 `/Microi.net.Api/appsettings.json`，说明同上

---

### ⚙️ 配置必须参数

::: tip 最低要求
要使项目跑起来，至少需要 **数据库 + Redis** 两个环境，缺一不可。
:::

---

### 独立端口复现历史 SQL Server 数据库

多人共用工作区时，可使用独立的 `appsettings.SqlServerLocal.json`、编译配置和端口，避免修改其它进程正在使用的 `.microi-local`。该文件按现有本地配置规则忽略，数据库凭据不得提交到仓库；`AppSettings` 仍只配置上文的租户、数据库、Redis、MongoDB 十项基础连接参数。测试副本应使用独立数据库与缓存，避免与同名正式租户共享会话和升级锁。

以下 PowerShell 命令在 `Microi.Server/Microi.net.Api` 目录执行，先确认端口未被占用：

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'SqlServerLocal'
$env:DOTNET_ENVIRONMENT = 'SqlServerLocal'
dotnet build -c SqlServerLocal -m:1 -p:UseSharedCompilation=false
& './bin/SqlServerLocal/net10.0/Microi.net.Api.exe' --urls 'https://localhost:61631'
```

SQL Server 的 `15.0.2000.5` 对应 SQL Server 2019 RTM。还原脚本前应区分 `.bak` 备份与 SQL 导出脚本，并检查后者是否包含 `INSERT` 数据；只有 `CREATE TABLE/ALTER TABLE` 的脚本不能恢复客户账号、配置或业务记录。为这种脚本补入的测试账号和数据必须在验收报告中单独标明。

升级时先修复登录和接口执行所需的核心物理列与自描述元数据，再通过当前基础应用包交付表、字段、接口和运行资产。SaaS 包提供应用文件、版本和微服务页面结构，必须先于商城资产安装。旧版 MySQL 专用升级 SQL 不再直接重放到 SQL Server；任何 DDL 或应用安装失败都停止并保留原 `ServerVersion`。排查时记录首个失败阶段，修复后重复执行并回读字段、应用版本和业务数据，不能通过手工提高版本号跳过错误。

SQL Server 验收还应覆盖 Unicode 文本、带单引号的创建人姓名和原生日期字段清空。表单引擎参数化写入创建人身份；新建文本列使用 Unicode 类型，原生日期的空输入保存为 `NULL`。应用文件唯一索引只约束非空 `VersionId` 的发布文件，允许不同应用保留同名的当前源码；已到达当前数据库版本的租户也会在分布式租约内修复旧的未过滤索引，继续跳过历史迁移链。

已有 `varchar` 列还受 SQL Server 排序规则的字符集限制。SaaS 包在 `diy_lang` 的物理文本列上声明 `SQLSERVER_UNICODE: true`，由商城导入器转换为足够宽的 Unicode 类型，保留目标排序规则、可空性、默认值和普通索引；引用表或未声明的业务列不执行这种转换。字符已经变成问号时，原文无法由类型转换恢复，需要从可靠备份或已知的系统元数据重新生成，不能猜测覆盖客户词条。原始数据库重放验收应同时检查物理类型和中文实际回读。

---

### 📝 环境配置注意事项

| 环境 | 影响功能 |
| :-- | :-- |
| 无 MongoDB | 系统日志暂存到后端 spool，MongoDB 恢复后自动重放；持续不可用时无法在系统日志页查询 |
| 无 MinIO / 阿里云 OSS | 无法使用文件/图片上传 |
| 无 RabbitMQ | 无法使用消息队列 |
| 无 Elasticsearch | 无法使用搜索引擎 |

::: warning 系统日志 spool
生产/容器环境请将后端固定目录 `logs/syslog-spool` 挂载到持久卷。该目录用于 MongoDB 故障和服务正常重启时的日志重放，不应放在容器临时层。节点标识由平台根据当前节点自动生成，不需要增加环境变量；所有节点连接同一 MongoDB 时按全局 `EventId` 幂等写入。
:::

---

### 🧪 后端自动化测试与发布门禁

后端测试统一位于 `/Microi.Server/Microi.Tests`。它合并了历史
`Dos.Common.Tests`、`Dos.ORM.Tests`，并在私有源码存在时条件纳入 AI、
FormEngine、ApiEngine、安全与多租户边界测试。

日常开发先运行不连接服务器、不会写数据库的 Quick 门禁：

```powershell
.\Microi.Server\Microi.Tests\run-tests.ps1 -Mode Quick
```

准备发布 API 前，必须对**隔离测试租户和专用测试表**运行 Full 门禁：

```powershell
$env:MICROI_TEST_API_BASE = "http://127.0.0.1:1052/"
$env:MICROI_TEST_OSCLIENT = "integration-test"
$env:MICROI_TEST_TOKEN = "<测试租户超级管理员Token>"
$env:MICROI_TEST_FORM_ENGINE_KEY = "mci_release_gate"
$env:MICROI_TEST_API_ENGINE_KEY = "release_gate_echo"
$env:MICROI_TEST_CHILD_OSCLIENT = "integration-child"
$env:MICROI_TEST_CHILD_TOKEN = "<子租户测试管理员Token>"
$env:MICROI_TEST_FRONTEND_BASE = "http://localhost:61500"
$env:MICROI_TEST_ACCOUNT = "<主租户测试账号>"
$env:MICROI_TEST_PASSWORD = "<主租户测试密码>"
$env:MICROI_TEST_CHILD_ACCOUNT = "<子租户测试账号>"
$env:MICROI_TEST_CHILD_PASSWORD = "<子租户测试密码>"
$env:MICROI_UPGRADE_TEST_CONN = "<127.0.0.1:62606 上 upgrade_fixture 独立 MySQL 测试库连接>"
$env:MICROI_UPGRADE_SQLSERVER_TEST_CONN = "<127.0.0.1,62616 上 upgrade_fixture 独立 SQL Server 测试库连接>"
$env:MICROI_TEST_ALLOW_WRITES = "YES"
.\Microi.Server\Microi.Tests\run-tests.ps1 -Mode Full
```

Full 会依次执行：

1. Release 恢复与编译、全部 Quick 单元/组件回归。
2. FormEngine 单条、批量、按条件新增/查询/计数/修改/删除的真实 HTTP 闭环。
3. ApiEngine 的 GET、JSON POST 调用。
4. 以唯一前缀清理本次测试数据，并输出 TRX/覆盖率结果。
5. MySQL/SQL Server 结构升级、主租户指定子租户的平台应用维护、子租户安装/更新全部平台应用、幂等重复提交和 `Succeeded/100%` 终态；再次执行时应为 `Planned=0`。
6. 在独立浏览器 Context 中使用真实账号密码登录，验证通知中心按钮和后台任务完成；官方 iTdos 发布源应隐藏给自身安装应用的按钮。
7. NuGet 易受攻击包和弃用包审计。

一键编译发布脚本在后端发布或前端构建之前强制执行 Full：缺少环境、凭据、零用例、失败或跳过均停止发布。测试时共享服务必须已经加载候选源码；取得发布锁后只使用现有服务，测试通过才停止服务并开始升版和发布。文档专用选项 6 不触发后端业务测试。AI 发布话术还应要求在 VS Code 扩展发布之前先运行同一门禁，话术不能替代脚本检查。

主、子租户必须在同一维护控制面的有效租户目录中；必要时用 `MICROI_TEST_CONTROL_API_BASE`、`MICROI_TEST_CHILD_API_BASE` 指定各自入口。详细变量和测试边界见源码 `Microi.Server/Microi.Tests/README.md`，报告应区分本地候选与已部署远端的结果。

测试表至少包含一个可写短文本字段（默认 `Name`，其它名称可通过
`MICROI_TEST_NAME_FIELD` 指定）。`MICROI_TEST_ALLOW_WRITES=YES` 是强制保护，
禁止对生产租户设置。测试通过能显著降低发布风险，但不等于证明所有客户
V8、第三方接口、生产数据和基础设施绝对无误；正式发布还要用两个 API/Worker
节点连接同一 Redis/数据库，覆盖重复投递、锁持有者退出、依赖短暂故障、
响应前重启和滚动升级。

---

### 🐳 本地编译发布到 Docker 镜像

1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. 在 `Microi.net.Api` 项目目录下执行：

```bash
dotnet clean && dotnet publish -c Release -o ./bin/Release/publish
```

3. 进入 `./bin/Release/` 目录，执行 `publish-demo.sh` 脚本（记得先修改里面的配置）

---

## 二、前端运行

### 📦 下载源码与开发工具

- 使用 Git 从开源地址拉取最新代码：[GitHub 仓库](https://github.com/itdos/microi.net) / [Gitee 仓库](https://gitee.com/ITdos/microi.net)
- 下载并安装 [VS Code](https://code.visualstudio.com/)
- 下载并安装 nvm：[Windows 版](https://nvm.uihtm.com/) | [MacBook 版](https://blog.csdn.net/qq973702/article/details/143637128)
```shell
# 记住安装路径，一路往下安装即可
# 打开 nvm安装路径（我的是【D:\Users\Administrator\AppData\Local\nvm】），找到 settings.txt 文件，新增2行配置
node_mirror: https://npmmirror.com/mirrors/node/
npm_mirror: https://npmmirror.com/mirrors/npm/
# 打开cmd窗口,执行
nvm list available
nvm install 18
nvm install 14
# 常用命令
nvm ls
nvm use 18
node -v
```

---

### ▶️ 运行前端源码

1. 在 VS Code 打开 `/Microi.Client/` 文件夹
2. 查看 `/Microi.Client/README.md`，执行以下命令：

```bash
nvm use 20
nrm use taobao
npm install
npm run dev
```

### 指定或切换 ApiBase 与 OsClient

`Microi.Client/src/config.json` 的 `ApiBaseDev` 是本地 Vite 的默认 API 地址。开发服务器默认使用
`http://localhost:61500`，可在主框架 URL 的 `#` 之前临时指定目标租户和 API：

```text
http://localhost:61500/?OsClient=iTdos&ApiBase=https%3A%2F%2Fapi.example.com#/首页或菜单路由
```

`ApiBase` 建议用 `encodeURIComponent` 编码。`ApiBase` 可以包含路径，例如
`https://api.example.com/v2`；只允许完整的 `http://` 或 `https://` 地址，不能包含账号密码、额外
query 或 hash。`OsClient` 与 `ApiBase` 都不是登录凭据，Token、密码和访问密钥禁止放进 URL。

运行时取值顺序如下：

| 优先级 | ApiBase | OsClient |
|---|---|---|
| 1（最高） | 当前 URL 的 `ApiBase` | 当前 URL 的 `OsClient` |
| 2 | `index.html` 的 `window.ApiBase` | `index.html` 的 `window.OsClient` |
| 3 | `src/config.json` 的 `ApiBaseDev` | 当前 Pinia/localStorage 状态 |
| 4 | 当前 Pinia/localStorage 状态；最后回落同源 | 状态为空时按当前域名向 API 解析；最后使用平台默认值 |

URL 参数决定当前页面的运行目标，不需要反复改 `config.json`。平台初始化和登录仍会把运行状态
写入当前浏览器的同源持久化存储，因此并行租户仍必须按下文隔离浏览器。跨域连接远端 API 时，
目标租户还必须允许 `http://localhost:61500` 的 CORS；否则参数已正确生效，浏览器请求仍会被
CORS 拦截。

页面完成租户初始化后会公开一个不含 Token 的只读诊断对象，AI 和测试脚本可直接读取：

```js
window.__MICROI_RUNTIME_ENDPOINT__
// {
//   protocol: 'microi.runtime-endpoint.v1',
//   apiBase: 'https://api.example.com',
//   osClient: 'iTdos',
//   source: { apiBase: 'url-query', osClient: 'url-query' }
// }
```

#### 多租户并行测试必须隔离浏览器存储

同一浏览器配置文件下，相同 `http://localhost:61500` 源的 Tab 和窗口共享 localStorage、Pinia
持久化数据、Token、CurrentUser、ApiBase 和 OsClient。A 窗口登录租户 A 后，再让 B 窗口切换到
租户 B，A 窗口可能被新 Token/用户状态污染，表现为自动切租户、身份失效、请求发往错误服务器或
页面白屏。URL 参数优先级不能隔离共享的登录态。

::: danger 并行测试规则
- 人工测试第二个不同 `ApiBase + OsClient` 时，至少使用无痕/隐私窗口；更稳妥的是独立浏览器
  Profile 或独立 `--user-data-dir`。
- 同一 Chrome 进程中的多个无痕窗口可能共享同一个临时无痕会话。三个以上并行租户不要只开多个
  无痕窗口，应为每组目标使用独立 Profile/浏览器进程。
- Codex、Playwright 等自动化必须为每个 `ApiBase + OsClient` 创建独立
  `browser.newContext()`，不得在同一个 context 中用多个 Page 混测不同租户；结束后只关闭自己
  创建的 context/browser。
:::

#### AI 从线上页面识别目标后在本地复现

AI 收到一个已部署吾码页面地址时，应先在一次性独立浏览器上下文打开线上页面，等主框架完成
初始化，再读取 `window.__MICROI_RUNTIME_ENDPOINT__`。旧版本尚未提供该对象时，按顺序读取 URL
参数、`window.ApiBase/window.OsClient`、同源 localStorage 的 `microi.net.ApiBase/OsClient`；若
OsClient 仍为空，再以线上域名调用平台租户解析接口或从已成功的平台请求中确认，不能猜租户。

确认目标后，使用新的独立浏览器上下文打开本地源码：

```js
const localUrl = `http://localhost:61500/?OsClient=${encodeURIComponent(osClient)}`
  + `&ApiBase=${encodeURIComponent(apiBase)}#/目标路由`;
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(localUrl);
```

远端识别、本地源码构建、浏览器页面验收和生产部署是不同证据层；本地参数切换成功不表示线上已
部署新源码。

3. 常见问题
```js
npm : 无法加载文件 d:\nvm4w\nodejs\npm.ps1，因为在此系统上禁止运行脚本。有关详细信息，请参阅 https:/go.microsoft.com/fwlink/?LinkID
=135170 中的 about_Execution_Policies。
所在位置 行:1 字符: 1
+ npm -v
+ ~~~
    + CategoryInfo          : SecurityError: (:) []，PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess

//解决方案：
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
---

### 🐳 本地编译发布到 Docker 镜像

1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. 执行 `npm run build` 打包现代版（Chrome / Edge 107+、Firefox 104+、Safari 16+，默认推荐）
3. 进入 `bin/Release/` 目录，执行 `publish-demo.sh` 脚本（记得先修改里面的配置）

只有已明确约定继续支持 Chrome 49 的存量客户，才使用 `npm run build:legacy` 同时生成 legacy 包。该命令会额外执行旧语法转换、polyfill 和完整校验，明显增加构建时间与产物体积。由于 Vue 3、Element Plus 等当前依赖已不再官方支持 Chrome 49，这一产物属于尽力兼容层，正式交付前仍需在客户真实旧浏览器上验证实际使用功能。
