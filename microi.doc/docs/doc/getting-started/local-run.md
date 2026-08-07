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
$env:MICROI_TEST_ALLOW_WRITES = "YES"
.\Microi.Server\Microi.Tests\run-tests.ps1 -Mode Full
```

Full 会依次执行：

1. Release 恢复与编译、全部 Quick 单元/组件回归。
2. FormEngine 单条、批量、按条件新增/查询/计数/修改/删除的真实 HTTP 闭环。
3. ApiEngine 的 GET、JSON POST 调用。
4. 以唯一前缀清理本次测试数据，并输出 TRX/覆盖率结果。
5. NuGet 易受攻击包和弃用包审计。

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
2. 执行 `npm run build` 命令打包
3. 进入 `bin/Release/` 目录，执行 `publish-demo.sh` 脚本（记得先修改里面的配置）
