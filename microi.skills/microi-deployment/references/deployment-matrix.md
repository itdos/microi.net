# 部署矩阵与验收

## 中文官网路由

| 文档 | 主要用途 |
|---|---|
| `microi.doc/docs/doc/getting-started/docker-run.md` | Docker、Compose、离线包、依赖编排 |
| `microi.doc/docs/doc/getting-started/win-install-microi.md` | Windows/IIS 安装 |
| `microi.doc/docs/doc/getting-started/local-run.md` | 后端/前端源码运行、测试与构建 |
| `microi.doc/docs/doc/getting-started/start-use.md` | 部署后创建表、表单、菜单的首条业务链路 |

英文目录由中文生成，不作为本轮人工单独维护源。

## 服务依赖

| 依赖 | 作用 | 生产要求 |
|---|---|---|
| API/Worker | 后端、V8、任务与接口 | 至少双节点关键场景验证 |
| Web/Nginx/IIS | 前端与反向代理 | HTTPS、上传体积、超时、静态缓存 |
| MySQL/兼容业务库 | 平台与业务数据 | 备份、字符集、连接池、慢查询 |
| Redis | 会话、缓存、租约、进度 | 持久化/高可用、按租户 Key |
| MongoDB | 日志等文档数据 | 持久卷、容量与重放验收 |
| MinIO/HDFS | 上传和应用资源 | 公私桶、持久卷、备份、CORS |

可选依赖如翻译服务、Ollama、Qdrant 只在相应能力启用时部署，不把演示编排无条件
带入生产。

## 配置归类

| 配置 | 原则 |
|---|---|
| 数据库连接 | 密钥管理/环境注入，不入库明文示例 |
| Redis/Mongo/对象存储 | 全节点一致、网络可达、租户隔离 |
| AuthSecret/JWT | 集群一致；变更会影响已有登录态 |
| ApiBase/FileServer | 与反向代理外部地址一致 |
| 上传上限 | API、代理、租户配置三层一致 |
| 日志 spool | 每节点持久卷；Mongo 恢复后幂等重放 |
| 容器内存 | 多服务共机时给每容器合理 limit |

## Docker/Compose

执行前：

1. 固定目标目录和 compose 文件，解析所有 volume 的绝对宿主路径。
2. 校验镜像 tag/digest、端口、网络、重启策略、healthcheck 和 secrets。
3. 备份数据库、对象存储与配置，并验证备份可读。
4. `docker compose config` 只作静态校验，不代表服务可运行。

发布时一次只替换部分 API 节点；readiness 正常后再替换下一节点。数据库和对象存储
卷不随应用容器重建删除。Watchtower/自动更新若启用，必须保证 AuthSecret、配置卷和
健康检查不因容器替换漂移。

离线安装包要包含精确镜像、校验和、compose、配置模板和安装说明；目标机导入后复核
镜像 digest，不能只看文件解压成功。

## Windows/IIS

至少核对：

- .NET Hosting Bundle 与应用目标框架匹配；
- Application Pool 使用无托管代码并具备目录权限；
- API 和 Web 站点绑定、HTTPS、反向代理与 WebSocket 配置；
- 应用数据、上传、日志和 spool 目录不放临时发布目录；
- Windows 服务/计划任务不会与 IIS 节点重复执行同一后台任务；
- MySQL、Redis、MongoDB、MinIO 服务开机启动和恢复策略。

IIS 进程启动不代表 API 可用，仍要检查 readiness 和真实登录路径。

## 本地源码运行

后端：

- 使用当前仓库规定的 .NET SDK；
- 配置开发专用数据库/Redis/Mongo/对象存储；
- 先跑定向测试，再按资源允许程度执行更大构建；
- 不让本地调试连接生产写库。

前端：

- 使用仓库规定的 Node/npm/pnpm 版本；
- 复用已有 Vite 服务，不重复启动；
- 本地页面成功不替代宿主 Token、OsClient、菜单权限和生产构建验收。

## 最小上线验收

- API liveness 200，readiness 200；依赖降级能在 readiness/日志中体现。
- Web 首屏、登录、退出、Token 刷新正常。
- 管理员与普通角色各验证一个菜单和数据权限。
- FormEngine 新增/编辑/查询，ApiEngine 调用正常。
- 公有/私有文件各上传、预览/下载一次，Range/HEAD 按需验证。
- Redis/Mongo/对象存储短暂不可用后可恢复，无永久死锁或静默丢失。
- 双节点同时触发同一 Job/消息，业务副作用仅一次。
- 发布中终止一个节点，其余节点继续服务；恢复节点不重复初始化。
- 回滚步骤和恢复点已实际验证或明确标记未验证。
