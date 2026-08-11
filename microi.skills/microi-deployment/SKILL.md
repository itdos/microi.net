---
name: microi-deployment
description: Microi 安装、部署、升级和本地运行指南。用于 Docker Compose、离线安装、Windows IIS、源码运行、MySQL、Redis、MongoDB、MinIO、反向代理、滚动发布、健康检查、备份恢复和生产部署验收。
---

> **Codex 强制前置：** 当前宿主为 Codex 时，在使用本 Skill 前必须先完整读取 `../microi-codex-installer/SKILL.md`，完成“Codex 每任务最新版硬门禁”；门禁未通过不得继续本 Skill。非 Codex 宿主跳过此项。

# Microi 安装与部署

本 Skill 把官网 Docker、Windows 和源码运行文档转成可执行的安全流程。具体镜像、
版本、端口和命令可能变化，执行前必须回读当前中文官网、仓库 compose/配置和目标
主机状态，不能把旧示例当作当前生产事实。

数据库备份 MCP 使用 `microi_list_database_backup_tenants` 盘点可备份租户，使用 `microi_run_database_backup` 提交带稳定幂等键的持久化任务。备份必须进入共享存储并回读文件大小、哈希和任务终态；本机进程返回成功不等于备份可恢复。

## 必读参考

- 部署方式、依赖、配置和验收矩阵：`references/deployment-matrix.md`
- 系统级交付与 MCP：`../microi-system-delivery/SKILL.md`
- 文件/对象存储：`../v8-file-upload/SKILL.md`
- 数据库模型：`../microi-db-schema/SKILL.md`

## 先确认部署类型

| 场景 | 推荐入口 |
|---|---|
| 生产 Linux、快速安装、可滚动升级 | Docker/Compose |
| 无互联网环境 | 在联网机制作离线包，再在目标机校验并安装 |
| Windows 传统环境 | IIS + .NET Hosting Bundle + 独立依赖 |
| 开发/调试 | 后端源码 + 前端 Vite，本地依赖或隔离容器 |

不得在未确认目标主机、目录、数据卷和备份的情况下执行官网“删除所有容器/编排”
或任何递归删除命令。

## 变更前只读盘点

至少记录：

- 操作系统、CPU、物理内存、可用磁盘、时区与端口占用；
- 当前 API/Web/Worker 节点数、镜像/版本、反向代理与证书；
- MySQL、Redis、MongoDB、MinIO/HDFS 地址和持久卷；
- 当前 `OsClient`、数据库备份、对象存储备份和配置备份；
- JWT/AuthSecret 等集群共享密钥的指纹一致性，绝不输出明文；
- `/api/Diagnostics/health` readiness 与 `/api/Diagnostics/liveness`；
- 当前运行中的 Node、dotnet、Docker build 等重任务。

## 后端配置单一事实源（强制）

Microi API 安装时，`AppSettings` 与同名容器环境变量只允许以下十个启动引导项：

`OsClient`、`OsClientType`、`OsClientNetwork`、`OsClientDbType`、`OsClientDbConn`、`OsClientRedisHost`、`OsClientRedisPort`、`OsClientRedisPwd`、`OsClientRedisDataBase`、`OsClientDbMongoConn`。

- 除这十项外，业务开关、超时、重试次数、资源上限、代理信任、密钥路径和第三方密钥通常必须在 SaaS 引擎 `sys_osclients` 的合适 Tab 中动态配置，并提供代码安全默认值；影响整个 API 进程的字段只读取主租户记录。唯一固定例外是官方 License 信任链：恢复重试次数/间隔使用代码常量，签发私钥只读取固定只读挂载 `/app/microi_private.pem`，不得为这三项创建 SaaS 字段。
- 不得新增 `MICROI_*`、`DOS_ORM_*`、自定义 `AppSettings` 节点或通用 `Environment.GetEnvironmentVariable(name)` 作为 API 运行配置；新增配置必须同步升级字段、表单 Tab、脱敏/子租户隔离、缓存刷新、文档和源码扫描测试。
- `ASPNETCORE_*`、`DOTNET_*` 属于 .NET 宿主配置；构建、安装器、测试、MCP 和发布脚本自己的进程变量也不属于 API 业务配置，但生产 API 代码不得读取它们来控制业务行为。
- `AuthSecret` 等已有 SaaS 敏感字段继续由受保护的主租户记录提供。普通业务私钥路径仍按相应 SaaS 配置管理；官方 License 签发私钥路径固定为 `/app/microi_private.pem`，只允许生产签发节点只读挂载。密钥明文不得写入镜像、Compose、日志或普通 V8 投影。
- 验收必须扫描生产源码、`appsettings.json`、在线/离线安装编排，断言 API 容器仅出现上述十项；不能只检查某一个示例文件。

## 一键安装脚本版本时间（强制）

- 每次修改 `数据库、案例、文档、资料/install-microi.sh`，必须同时更新文件头版本和 `SCRIPT_VERSION`，两处完全一致。
- 固定格式为 `vYYYY-MM-DD HH:mm:ss`，使用 `Asia/Shanghai` 时间并精确到秒；禁止只写日期或沿用上一次修改时间。
- 验收同时断言两处版本一致、格式正确，并以脚本实际启动输出为准；官网静态地址尚未发布新文件时，不能把本地版本误报为客户已经可下载。
- 恢复旧数据库时，OCR、翻译等启动不变量字段先出现不代表完整升级链已经成功。安装器必须在重启 API 和输出“安装完成”之前回读 `sys_config.ServerVersion` 达到本脚本最低版本；中间迁移失败或超时应失败关闭，禁止用部分字段就绪冒充整个平台升级成功，也禁止在升级事务仍执行时主动重启 API。
- Compose v2 生成文件不再写顶层 `version`；所有模板直接以 `services:` 开始，避免 `the attribute version is obsolete` 告警。
- LibreTranslate 属于一键安装默认组件：安装选择空输入按 `1` 处理，语言套餐空输入按基础套餐 `1` 处理；因此用户一路按 Enter 使用官方推荐组合。只有明确输入 `0` 才跳过，提示、端口预算、官网文档和静态回归测试必须一致。
- OCR 的 Upgrade29 与 LibreTranslate 的 Upgrade31 字段门禁都在 API liveness 后立即回读，每秒一次、最多 15 秒；首轮成功就继续，超时快速失败并提示镜像/迁移版本，不得退回 5 分钟空等，也不得直接创建字段绕过平台升级。
- 官方 API/Web 使用浮动 `latest` 时，生成的 Compose 必须设置 `pull_policy: always` 或在启动前显式拉取并核对，不能因宿主机已有同名镜像就复用旧版本；测试专用本机镜像覆盖必须明确使用 `never`，避免误访问或覆盖远端镜像。
- 端口、密码和数据目录全部生成后，安装器必须注册统一的失败收尾：任何后段错误继续保留原始非零退出码，并在终端输出标题为“安装未完成”的恢复汇总，列出已生成端口、凭据、目录、迁移门禁和容器状态。失败汇总不得使用“安装完成”文案、不得把 `Running` 当 readiness，也不得因此绕过 OCR/翻译/完整升级链门禁。
- 从客户/旧库恢复安装时，安装器只按 `OsClient + OsClientType + OsClientNetwork + IsEnable + IsDeleted` 处理目标主租户：0 条时幂等创建最小可运行记录，1 条时原位复用，超过 1 条失败关闭。禁止把所有活动 `sys_osclients` 批量改成输入的 OsClient；新记录不得落库 `DbConn/DbReadConn/DbMongoConnection` 或 Redis 主机、端口、密码，这些继续由十项编排启动配置提供。MinIO、OCR 等安装值随后只更新这个精确三元组并回读唯一性。

## 多节点与滚动发布

后端默认按多个 API/Worker 节点设计：

- 所有节点共享业务数据库、MongoDB、Redis 和持久对象存储。
- 全局状态、任务进度、锁和幂等事实不能只放进程内存/本机文件。
- 新旧版本并存期间使用“先扩展、后迁移、再收缩”的兼容顺序。
- 节点先停止接新工作，再有界排空；readiness 退出流量，liveness 只反映进程存活。
- 数据库迁移、建索引、种子和缓存预热必须幂等，多节点同时启动不能重复副作用。
- AuthSecret 在全部节点保持一致；轮换必须有明确的全节点策略，否则现有 JWT 会失效。

## 构建资源保护

启动 Node/Vite/dotnet/Docker build 前检查物理内存和同类进程。默认只运行一个重任务。
启动门槛按“当前阶段进程树预算 + `max(1.5GB, 物理内存 5%)` 系统安全余量”计算，
优先采用实测峰值；顺序阶段分别计算，不叠加峰值，也不得再用固定 20% 随机器容量放大门槛。
资源不足时改做定向测试/构建，不并行启动多个全量任务；全机占用达到 95% 时暂停或终止本轮启动的重任务树。

## Windows 多 AI 本地服务与 Release 文件锁

多个 AI 对话共用同一工作区和固定 `61500/61501` 时，前后端是工作区级单例共享服务，
不是每个对话各自拥有的后台进程。发布必须使用“工作区互斥 + 精确身份识别 + DLL 锁复核”：

- 健康开发服务默认复用；需要重载源码时串行重启。长期后端只从项目目录执行
  `dotnet run --launch-profile Microi.net.Api`，禁止直接运行 `bin/Release/net10.0`
  或 `bin/Release/publish` 作为 E2E 服务。
- 一键发布在改写输出目录前创建 `.tmp/microi-process-state/release.lock`；锁存在时其它 AI
  不得启动、自愈或重启 `61500/61501`。
- Windows 发布前调用 `Microi.Server/tools/Microi.LocalProcessManager.ps1 -Action PrepareRelease`。
  只在端口、命令行和当前工作区路径同时匹配时停止 Microi API/Vite，并额外查找当前工作区
  的 Release API；身份不匹配时失败关闭，禁止使用 `/IM dotnet.exe`、`/IM node.exe`、
  `/IM chrome.exe` 或 `/IM msedge.exe` 全机清理。
- Vite 以相对 `node_modules/vite/bin/vite.js` 启动且父进程退出时，命令行可能没有绝对工作区路径。
  进程管理器只能把只读回读到的 CWD 精确等于当前 `Microi.Client` 作为补充证据；读取失败、
  CWD 属于其它目录或仅检测到孤儿状态时仍须失败关闭。回归同时覆盖当前工作区可精确停止、
  外部工作区同名相对 Vite 保持运行。
- 停止后必须确认 `61500/61501` 已释放，并以 `FileShare.None` 独占打开
  `Microi.net.Api/bin/Release/net10.0` DLL。只结束 `VBCSCompiler` 不能解决正在运行的
  `.NET Host` 对业务 DLL 的锁定。
- Edge/Chrome 用户浏览器、VS Code 的 Playwright Test Server、MCP/语言服务 Node、
  数据库和 Redis 不属于发布清理范围。人工查看使用进程管理器的 `-Action Status`。

## 一键发布产物边界与缓存

- 需要完整解决方案构建和 NuGet 打包时，先完成一次 Release build；publish 阶段复用已验证产物，禁止先 clean 再重复编译同一项目引用链。
- API 镜像只允许使用 `bin/Release/publish`，前端镜像只允许使用 `bin/Release/dist` 和必要的服务器配置；`net10.0`、源码、测试输出及其它构建中间目录不得进入 Docker 上下文。
- `logs`、故障 spool、WAL 和节点诊断文件属于运行态数据。发布前后及冒烟测试后都要从 publish 清理，但不得删除源码/持久卷中尚待重放的原始 spool；项目文件应从源头设置为不复制到发布目录。
- 正式发布不需要 PDB 时，从 publish 清单统一排除项目引用和第三方 PDB，并在推送前断言数量为零；这不等于删除编译中间目录中用于本地诊断的符号。
- Docker 使用内容摘要缓存并在基础镜像标签可变时检查更新；不要在每个镜像方案前无条件 `prune -a` 或永久使用 `--no-cache`。磁盘不足时先报告占用，再对精确目标做可恢复或有条件清理。
- DLL 混淆/签名必须先于最终冒烟测试，确保被验证、写入 NuGet 和放入 Docker 的是同一份最终 DLL。前端旧浏览器产物可以按源码、转换器和依赖锁文件的内容指纹做增量缓存，但缓存命中后仍需执行完整依赖、polyfill 和入口校验。

## 部署证据分层

不要把某一层成功等同生产完成：

1. 配置/compose 静态检查。
2. 镜像拉取或定向构建成功。
3. 容器/进程启动且无启动错误。
4. liveness/readiness 正常，依赖可达。
5. 登录、菜单、FormEngine、ApiEngine、文件上传等真实路径正常。
6. 双节点重复投递、节点退出、滚动升级与恢复验证。

未执行的层必须明确写“未验证”，不能用“部署成功”概括。

### 复盘：启动文案变化导致一键发布冒烟假失败

- 触发场景：发布产物已经输出 `Now listening` / `Application started` 并可访问，但发布脚本因为等待某句历史中文启动文案而持续到超时，期间运行态日志或 spool 不断写入 `publish/logs`。
- 根因：把易变化的日志文本当成服务可用事实源；超时/异常路径没有对临时进程和运行态目录做完整的有界收尾。
- 通用规则：发布冒烟必须启动最终混淆/签名后的产物，确认本次进程仍存活，再以 `/api/Diagnostics/liveness` HTTP 200 判定启动成功；使用专用空闲端口，成功、超时、异常和中断路径都要在有限时间内结束本次进程并清理 publish 内的临时 logs/PDB。版本号已经更新但尚未提交时，重跑默认继续工作区当前版本，不能再次自动递增；当前版本进入 Git HEAD 后才计算下一版本。
- 自动化检查：构造不再输出旧中文文案但 liveness 返回 200 的版本，断言冒烟成功；另覆盖端口占用、进程提前退出和 liveness 超时，断言脚本失败原因准确、进程无残留、`publish/logs` 不存在。再把工作区版本设为高于 HEAD，验证重跑默认版本保持不变。

## 禁止事项

- 不把数据库/Redis/MinIO 密码写入仓库、日志、命令回显或最终答复。
- 不因容器更新而删除数据库卷、对象存储卷或日志 spool。
- 不在所有节点同时硬重启。
- 不把 `docker ps` 的 Running 当作 readiness。
- 不在没有备份和恢复演练时执行数据库升级或不可逆迁移。
- 不修改 `microi.doc/docs/doc/about/update-log.md`，除非用户明确要求发版。
- 撤回或重写版本日志前，必须遵循 `../workspace-conventions/SKILL.md` 的“多对话共享工作区变更归属保护”；当天提交、最新 `HEAD`、相同作者或相关提交信息都不能单独证明改动属于当前对话。
