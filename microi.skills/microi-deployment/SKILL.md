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
