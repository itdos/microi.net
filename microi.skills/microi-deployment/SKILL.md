---
name: microi-deployment
description: Microi 安装、部署、升级和本地运行指南。用于 Docker Compose、离线安装、Windows IIS、源码运行、MySQL、Redis、MongoDB、MinIO、反向代理、滚动发布、健康检查、备份恢复和生产部署验收。
---

# Microi 安装与部署

本 Skill 把官网 Docker、Windows 和源码运行文档转成可执行的安全流程。具体镜像、
版本、端口和命令可能变化，执行前必须回读当前中文官网、仓库 compose/配置和目标
主机状态，不能把旧示例当作当前生产事实。

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

## 多节点与滚动发布

后端默认按多个 API/Worker 节点设计：

- 所有节点共享业务数据库、MongoDB、Redis 和持久对象存储。
- 全局状态、任务进度、锁和幂等事实不能只放进程内存/本机文件。
- 新旧版本并存期间使用“先扩展、后迁移、再收缩”的兼容顺序。
- 节点先停止接新工作，再有界排空；readiness 退出流量，liveness 只反映进程存活。
- 数据库迁移、建索引、种子和缓存预热必须幂等，多节点同时启动不能重复副作用。
- AuthSecret 在全部节点保持一致；轮换必须有明确的全节点策略，否则现有 JWT 会失效。

## 构建资源保护

启动 Node/Vite/dotnet/Docker build 前检查物理内存和同类进程。默认只运行一个重任务，
为 VS Code、Codex 和操作系统保留至少 `max(6GB, 物理内存 20%)`。资源不足时改做
定向测试/构建，不并行启动多个全量任务；全机占用达到 95% 时终止本轮启动的重任务树。

## 部署证据分层

不要把某一层成功等同生产完成：

1. 配置/compose 静态检查。
2. 镜像拉取或定向构建成功。
3. 容器/进程启动且无启动错误。
4. liveness/readiness 正常，依赖可达。
5. 登录、菜单、FormEngine、ApiEngine、文件上传等真实路径正常。
6. 双节点重复投递、节点退出、滚动升级与恢复验证。

未执行的层必须明确写“未验证”，不能用“部署成功”概括。

## 禁止事项

- 不把数据库/Redis/MinIO 密码写入仓库、日志、命令回显或最终答复。
- 不因容器更新而删除数据库卷、对象存储卷或日志 spool。
- 不在所有节点同时硬重启。
- 不把 `docker ps` 的 Running 当作 readiness。
- 不在没有备份和恢复演练时执行数据库升级或不可逆迁移。
- 不修改 `microi.doc/docs/doc/about/update-log.md`，除非用户明确要求发版。
