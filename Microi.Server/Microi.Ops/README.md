# Microi.Ops · 吾码平台运维中心

独立的 .NET 10 + Vue 3 / Microi.UI 运维容器，负责单台 Linux Docker 主机中明确登记的吾码 API/Web。运维页面、独立登录、任务账本、日志和升级执行均不依赖吾码 API、Web、Redis、MongoDB 或业务数据库存活。平台菜单通过 iframe 打开同一个独立页面，并提供可复制的地址与新窗口链接。

## v1.0.1 更新

- 修复独立登录初始化期间快速切换页签导致平台连接设置未加载的问题，忙碌时禁用导航并在切换入口再次检查。
- 源码纳入前端依赖锁文件；Docker 引导回归每次使用独立空目录及当前候选镜像，核对生成 Compose 和实际运行版本，避免复用旧测试镜像或配置。
- 安装器、离线包和引导默认镜像同步为 v1.0.1。已经部署的 Ops 请在宿主机通过原 Compose 更新，旧 v1.0.0 标签保留。

## 安装与访问

官方镜像：`registry.cn-hangzhou.aliyuncs.com/microios/microi-ops:v1.0.1`。一键安装器会在核心 API/Web 就绪后尝试安装 Ops，失败会报告附加组件警告并保留核心平台。离线制作脚本包含 Ops 镜像；离线首次安装使用 Manual，在线首次安装使用 Notify。

已有环境可在 Linux 主机执行一次性引导。先将下列容器名、域名和租户配置改成实际值；API/Web 必须共享用户自建 Docker 网络。这个命令只检查现有容器并生成配置。

```bash
docker run --rm --name microi-ops-bootstrap --memory 256m --cpus 1 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /microi/ops:/microi/ops -v /microi/logs/ops:/microi/logs/ops \
  -e OPS_BOOTSTRAP_API_NAME=microi-install-api \
  -e OPS_BOOTSTRAP_WEB_NAME=microi-install-client \
  -e OPS_PUBLIC_URL=https://ops.example.com \
  -e OPS_PLATFORM_API_URL=https://api.example.com \
  -e OPS_ALLOWED_FRAME_ORIGINS=https://web.example.com \
  registry.cn-hangzhou.aliyuncs.com/microios/microi-ops:v1.0.1 --bootstrap

docker compose -f /microi/ops/docker-compose.yml config --quiet
docker compose -f /microi/ops/docker-compose.yml up -d
```

生成的独立帐号为 `opsadmin`，随机密码只写入 `/microi/ops/config/ops.env`，不输出到安装日志。配置目录权限 700，账号文件权限 600。再次引导会拒绝覆盖原配置；修改该 env 文件后，使用原 Compose 重建 Ops 即可，旧登录会话随密码更换失效。可以改用 `OPS_ADMIN_PASSWORD_FILE` 挂载 Docker secret，须同时移除 `OPS_ADMIN_PASSWORD`。

Ops 默认只绑定宿主机 `127.0.0.1:61880`。请使用独立于 API/Web 容器的 HTTPS 反向代理，不能把唯一入口放在即将更新的 Web 容器中。代理转发 `Host`、`X-Forwarded-Proto`；`OPS_TRUSTED_PROXY_IPS` 必须包含 Ops 实际看到的代理源 IP。引导默认登记共享 Docker 网络网关，容器代理请改为其固定 IP。不信任任意来源的代理头。

```nginx
# 放入已配置好证书的 ops.example.com HTTPS server 块
location / {
    proxy_pass http://127.0.0.1:61880;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

在吾码 SaaS 引擎 → 后端运行配置设置 `MicroiOpsUrl=https://ops.example.com`，安装/更新「SaaS引擎」「系统日志/监控」「应用商城」，即可通过系统引擎 → 平台运维中心进入。平台管理员权限只控制入口显示与必要日志查询，不授予 Docker 权限；仍须登录独立运维账号。浏览器阻止跨站 iframe Cookie 时使用新窗口入口，推荐 API/Web/Ops 使用同一站点的不同 HTTPS 子域名。

## 环境变量与持久目录

这些变量只属于独立 Ops 容器，不能写入 `Microi.net.Api` 的启动配置。

| 变量 | 作用 / 默认值 |
|---|---|
| `OPS_ADMIN_USERNAME` | 必填独立运维帐号 |
| `OPS_ADMIN_PASSWORD` / `OPS_ADMIN_PASSWORD_FILE` | 二选一，密码至少 12 位，不提供通用默认密码 |
| `OPS_PUBLIC_URL` | 浏览器直接访问的 HTTPS 根地址；仅回环测试允许 HTTP |
| `OPS_ALLOWED_FRAME_ORIGINS` | 允许嵌入的 Web Origin，多个用分号；空值禁止嵌入 |
| `OPS_TRUSTED_PROXY_IPS` | 可信反向代理 IP，多个用分号；不接受通配网段 |
| `OPS_DEPLOYMENT_FILE` | `/etc/microi-ops/deployment.json`，只读部署清单 |
| `OPS_DATA_DIR` | `/microi/ops/data`，SQLite 账本、平台加密凭据和 DataProtection 密钥 |
| `OPS_LOG_DIR` | 容器内 TXT 目录，默认 `/microi/logs/ops`；通过卷映射决定服务器目录 |
| `OPS_LOG_RETENTION_DAYS` | 默认 30，范围 1–365；TXT 与已投递事件保留时间 |
| `OPS_DOCKER_SOCKET` | `/var/run/docker.sock`，仅 Unix socket |
| `OPS_REGISTRY_CONFIG_FILE` | 可选只读 Docker registry JSON，支持 auths 中 auth / identitytoken；不执行宿主机 credsStore helper |
| `OPS_PLATFORM_CERTIFICATE_FILE` | 可选平台私有证书精确固定，用于自签部署；默认系统 TLS 信任 |

引导专用变量：`OPS_BOOTSTRAP_ROOT`（默认 `/microi/ops`）、`OPS_BOOTSTRAP_LOG_DIR`（默认 `/microi/logs/ops`）、`OPS_BOOTSTRAP_API_NAME`、`OPS_BOOTSTRAP_WEB_NAME`、`OPS_BOOTSTRAP_DEPLOYMENT_ID`、`OPS_BOOTSTRAP_IMAGE`、`OPS_PLATFORM_API_URL`、`OPS_HTTP_PORT`（默认 61880）、`OPS_BOOTSTRAP_INITIAL_MODE`（仅 Manual / Notify）。已保存的更新策略为最终事实，重新启动不会重新开启自动更新。

| 宿主机目录 | 内容与清理边界 |
|---|---|
| `/microi/ops/config` | 运维账号、固定部署清单、可选 registry 凭据，不能当日志清理 |
| `/microi/ops/data` | 任务/幂等账本、待投递事件、加密密钥，须一起备份，不能只备份数据库文件 |
| `/microi/logs/ops` | `microi-ops-yyyyMMdd-NNN.txt`，UTC 日期命名，单文件 10 MiB 轮转 |
| `/microi/compose/...` | 原 API/Web 编排及 `docker-compose.ops.yml` 镜像摘要覆盖 |
| `/microi/logs/exports` | 人工按指定容器导出的标准输出日志，可按自定保留策略清理 |

Ops 数据写入持久 SQLite 后才执行操作；TXT 写失败会在页面显示告警，已有持久事件仍可查看和补投。平台收到 MongoDB 持久化确认后，Ops 才标记该事件已投递。已投递旧事件和未提交旧计划按保留期清理；待投递事件、任务及其恢复计划保留，服务器长期离线时须监控磁盘空间。

Docker `json-file` 标准输出的实际路径由 Docker 管理，Ops 不会修改 Docker data-root、直接截断其日志文件或迁移现有数据库卷。引导设置 Docker 标准输出 `max-size=10m`、`max-file=3`。其它容器的应用文件日志可统一挂载到 `/microi/logs/<组件>`，但必须使用该组件真实的容器日志路径。

## 平台登录与 MongoDB 日志

在「平台连接」输入吾码平台账号和密码。Ops 每次登录读取当前系统设置，遵循前端 RSA 公钥密码协议、`EnableCaptcha` 和隐私协议要求。开启验证码时显示平台生成的图片并提交同一个 CaptchaId；配置读取失败会阻止登录，不能把失败当成关闭验证码。平台密码只用于该次请求，DiyToken 通过 DataProtection 加密存储，解绑立即移除凭据。

必要事件包括运维登录、策略变更、版本发现、更新接受/成功/失败、回退、Watchtower 状态变更和平台连接。通过应用包托管引擎 `platform-ops-event-ingest` 调用可信后端原子方法，写入现有 **MongoDB 系统日志**（`Category=Operations`、`Source=Microi.Ops`）。使用现有日志权限和保留策略，不另建业务 FormEngine 日志表，也不向 Ops 暴露 MongoDB 连接串。

平台可用时在「系统日志/监控 → 平台运维」筛选中查询。API 不包含 `IngestOpsEvent` 原子方法时，入口返回明确的后端升级提示，日志保留在 Ops 待投递队列；需要安装包含该方法的 API 版本。平台接口成功回执绑定 EventId，同一事件重投不会重复入库。

## 更新模式与可靠性

| 模式 | 检查 | 拉取镜像 | 重建容器 |
|---|---|---|---|
| Manual 仅手动 | 点击操作时 | 点击操作时 | 确认计划后 |
| Notify 检查并通知 | 定时 | 否 | 否 |
| Download 自动下载 | 定时 | 新摘要 | 否 |
| Automatic 维护窗口自动更新 | 定时 | 新摘要 | 窗口内且清单声明兼容的 API/Web |

默认每小时检查，时区 Asia/Shanghai，维护窗口 02:00–05:00；支持跨午夜窗口。首次引导默认只允许 Web 自动更新和兼容回退，API 必须由管理员确认数据库兼容后修改部署清单。UI 模式切换不会扩大部署清单授权范围。当前版本采用间隔和小时窗口，不解析任意 Watchtower cron/通知插件/钩子脚本。

执行前锁定目标镜像摘要、Docker Engine Id、容器配置快照和中断范围。先拉取全部镜像，保持旧容器运行；再逐个切换并验证 Docker Healthcheck 或配置的 HTTP 就绪内容。更新中重启 Ops 后从同一任务恢复；重复提交相同 RequestId 返回同一任务；停止的容器保持停止。

成功更新将镜像摘要写到原 Compose 目录下的 `docker-compose.ops.yml`。新版一键安装/修复自动合并；手工使用 Compose 或宝塔编排时也要同时加载：

```bash
docker compose -f docker-compose.yml -f docker-compose.ops.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.ops.yml up -d
```

原容器保留为 `*-ops-old-<任务>`，其自动重启策略被关闭。端口、挂载、匿名卷、网络与用户配置保留，旧镜像不自动全局清理。健康失败且声明兼容时恢复旧容器；数据库不兼容或遇到外部并发修改会保留现场等待人工处理。恢复镜像不会恢复数据库；不承诺单副本零停机。进度反映实际阶段和下载字节，ETA 为下载估计，未知阶段不显示伪造倒计时。

## 从 Watchtower 迁移与救援

[Watchtower 上游](https://github.com/containrrr/watchtower) 已于 2025-12-17 归档并声明不再维护。新安装使用 Ops；存量实例不会被安装器静默删除或启动。

在部署清单登记旧 Watchtower。只有能明确证明其命令只管理当前 API/Web 时，Ops 才允许页面暂停或恢复；范围不明确或同时管理其它应用时必须在原编排拆分范围。恢复 Watchtower 前先把 Ops 切为 Manual；受管目标可能存在竞争更新器时拒绝切换。暂停后同步修改旧 Compose 的 restart 配置，避免其它工具重建它后恢复自动更新。

API/Web 不可用时直接打开 Ops URL。Ops 自身更新在宿主机通过原 Compose 完成，不能自行替换自己。宿主机或 Docker 守护进程故障时仍需 SSH/宿主机面板。命令行一键修复会检测运行中的 Ops，并持有官方布局 `/microi/ops/data/controller.lock` 的内核文件锁，防止两边同时修改 API/Web。救援时先在 Ops 确认没有活动任务、切为 Manual，再明确停止 Ops 后执行修复；手动部署并改用其它数据目录的实例不使用这条一键修复路径。

Docker socket 具有主机管理权限。Ops 必须作为独立运维信任域部署，只挂载明确配置和 Compose 目录，不向平台可编辑 V8、普通用户或任意 API 请求开放通用 Docker 命令。v1 不支持 Swarm、Kubernetes、多主机、任意容器更新和远程终端。

## 开发与回归

```powershell
# 从仓库根目录构建，包含本地 Microi.UI；不依赖 Microi.Core 或闭源平台程序集
docker build -f Microi.Server/Microi.Ops/Dockerfile -t microi-ops:local-20260906 .
dotnet run --project Microi.Server/Microi.Ops/Tests/Microi.Ops.Tests.csproj -- .tmp/microi-ops-tests
node Microi.Server/Microi.Ops/Tests/docker-e2e.mjs
```

Docker E2E 只操作标记 `io.microi.ops.test=20260906` 的测试容器，使用 61880–61886 临时端口，不重启共享 61500/61501。平台协议回归使用临时 HTTPS 服务模拟验证码和丢失回执；实际平台登录回归单独读取本机已授权的测试账号文件，账号、密码和 Token 不写入测试报告。
