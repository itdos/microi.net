---
title: 吾码服务器运维面板 Microi.Panel
description: 独立 Docker 服务器面板，提供插件市场、Nginx 网站与反向代理、HTTPS 证书、网站文件、冷备份恢复、计划任务和吾码平台升级。
---

# 吾码服务器运维面板

**Microi.Panel** 是面向客户部署和日常维护的独立服务器面板。它由 Microi.Ops 演进而来，使用 .NET 10、Vue 3、Microi.UI 和本地 SQLite；面板、Nginx、数据库、对象存储及 AI 服务均通过 Docker 运行。安装吾码平台时，可以直接使用它管理所需服务，无需先安装宝塔或 1Panel。

面板使用独立运维账号。吾码 API、Web 或数据库停机时，面板的登录、任务账本与本地日志仍可访问。Docker 或整台主机发生故障时，仍需通过 SSH 或云控制台恢复。

## 功能与适用范围

| 页面 | 可完成的工作 |
| --- | --- |
| 服务器 | 主机 CPU、内存、面板数据磁盘空间、Docker 状态及受管容器资源用量 |
| 插件市场 | 选择服务及版本，配置独立端口和数据卷；安装、启动、停止、重启、查看日志和卸载 |
| 网站 | Docker Nginx 的静态网站、域名、路径反向代理、请求体大小、超时和 HTTPS |
| 证书 | 导入 PEM 证书与私钥，验证私钥匹配和域名 SAN；HTTP-01 自动申请、续期与暂停 |
| 文件 | 网站文件上传、下载、UTF-8 编辑、目录创建、回收和历史版本恢复 |
| 备份 | 服务停机冷备份、完整性校验、下载、新数据卷恢复和显式删除备份 |
| 计划任务 | 按间隔执行冷备份或服务重启，记录下次执行时间及每次结果 |
| 操作记录 | 幂等任务、错误原因、同一任务重试与重启后的进度恢复 |
| 吾码平台 | 原 Microi.Ops 的 API/Web 更新策略、维护窗口、平台连接及运维日志回传 |

适合单台 Linux Docker 主机上部署吾码平台、静态站点和已有应用的 HTTP 服务。当前不提供通用 SSH 终端、任意宿主机文件编辑、PHP 运行环境、邮件服务器、数据库在线 SQL 管理器、主机防火墙编辑或 Kubernetes/Swarm 管理；需要这些功能时继续使用专用工具。已有第三方容器可观测，写操作只作用于明确登记归属的资源。

## 独立一键安装

使用 Linux 主机的 SSH 终端执行。普通账号会通过 `sudo` 进入安装流程；没有 `sudo` 时先使用 `su -`。安装器会询问浏览器使用的域名或服务器 IPv4；主机缺少 Docker 时再询问是否安装 Docker Engine。

`v2.0.0` 面板镜像按 `Linux/amd64` 交付；首装、升级回退及宝塔/1Panel 两种安装顺序的实际验收使用 Ubuntu 24.04。插件目录中的 ARM64 标识仅表示对应插件镜像支持该架构，不代表面板及所有 Linux 发行版均已验收。

```bash
panel_url=https://gitee.com/ITdos/microi.net/raw/master/%E6%95%B0%E6%8D%AE%E5%BA%93%E3%80%81%E6%A1%88%E4%BE%8B%E3%80%81%E6%96%87%E6%A1%A3%E3%80%81%E8%B5%84%E6%96%99/install-microi-panel.sh; (if command -v curl >/dev/null 2>&1; then curl -fSL -o install-microi-panel.sh "$panel_url"; else wget -O install-microi-panel.sh "$panel_url"; fi) && sed -i 's/\r$//' install-microi-panel.sh && bash install-microi-panel.sh
```

安装脚本也提供 [GitHub 备用下载](https://github.com/itdos/microi.net/raw/refs/heads/master/%E6%95%B0%E6%8D%AE%E5%BA%93%E3%80%81%E6%A1%88%E4%BE%8B%E3%80%81%E6%96%87%E6%A1%A3%E3%80%81%E8%B5%84%E6%96%99/install-microi-panel.sh)。

默认目录 `/microi/panel`，独立 HTTPS 端口 `61890`，容器名 `microi-panel`。账号为 `paneladmin`，随机密码保存在 `/microi/panel/config/admin-password`，安装日志不输出密码。初始证书由本次安装独立生成，首次访问时核对终端输出的 SHA-256 指纹；正式对外使用可更换为受信任证书。

自动化部署可指定参数，例如：

```bash
bash install-microi-panel.sh --host panel.example.com --port 61890 --root /microi/panel --install-docker --yes
```

将域名替换为实际地址。已有 Docker 时复用现有引擎，不重新安装或改写守护进程配置。云安全组按需放行所选面板端口；数据库和存储端口按实际业务范围开放。

建议使用稳定 IP 或固定域名。服务器地址变化时，浏览器入口和证书 SAN 必须与新地址一致；不要用跳过证书校验来代替地址配置。Ubuntu/Debian 新主机通过 Docker 签名 APT 仓库安装运行时，官方传输不可达时可回退阿里云镜像，公钥身份仍固定为 Docker 官方签名。安装器不自动卸载已有 `docker.io`、`containerd`、`runc` 等冲突包；先按 Docker 的兼容迁移方法处理，再继续安装。

只读检查不会创建或启动服务：

```bash
bash install-microi-panel.sh --host panel.example.com --port 61890 --check
```

面板自身限制为 512 MiB 内存和 1 CPU，各插件另有独立限额。SQL Server、Oracle 和 OCR 初始化需要较多资源，请先检查主机余量；目录中显示的容器限额不能当作整套系统的最低配置。OCR 默认预算 8 GiB，翻译服务默认 2 GiB，数据库和业务 API 还需另计。

## 插件市场与版本

目录包含 Nginx、MySQL、SQL Server、PostgreSQL、Oracle Database Free、MinIO、Redis、MongoDB、LibreTranslate 和 PaddleX OCR。安装页面列出实际支持的版本、CPU 架构和许可说明；版本选择决定拉取的镜像，开始任务后锁定镜像摘要，断线重试继续使用同一份镜像。

数据库、Redis 和存储默认仅绑定 `127.0.0.1`。其它机器确需访问时，在安装表单明确设置监听地址和独立端口，并配合云安全组限制来源。不要为了复用默认端口停止客户已有服务。

每个实例有独立 Docker 网络归属、容器标签和命名数据卷。卸载只移除该实例容器，数据卷保留；可从「服务器」中的原实例选择「重新安装」，继续使用原版本、账号和数据卷。原数据卷丢失时会停止，不会创建空卷冒充恢复。备份和恢复在面板中单独操作。数据库的不同主版本不一定兼容同一物理数据目录，跨主版本迁移必须使用该数据库支持的迁移流程。

Oracle 使用原厂镜像渠道；SQL Server 需按实际用途选择许可版本。MinIO Community 插件基于最后社区安全版本源码构建，镜像包含对应源码和 AGPLv3 许可；上游仓库已归档，维护状态会在安装页提示。新安装 MySQL 优先选择 8.4，8.0 仅用于已有应用兼容迁移。

## Nginx、反向代理与 HTTPS

先在市场安装 Nginx，再进入「网站」选择该实例。网站支持多个域名；静态模式使用自己的站点目录，代理模式按路径转发到明确的 HTTP/HTTPS 上游。配置先预览，发布时执行 `nginx -t`，成功后原子切换并重新加载；失败保留原站点配置。

从 Nginx 容器访问其它服务时，`127.0.0.1` 指的是 Nginx 容器自身。使用可从该容器网络到达的服务域名或服务器地址；端口映射不会自动把宿主机回环地址变成容器内可访问地址。

手动 HTTPS：在「证书」导入完整 PEM 证书链和匹配私钥，再在网站中选择证书并发布。系统检查有效期、域名 SAN 和私钥匹配，私钥不在列表和操作日志中返回。

自动 HTTPS：为已发布的网站填写联系邮箱，选择 Let's Encrypt 生产或测试环境，确认条款并申请。HTTP-01 要求域名正确解析，公网 TCP 80 的挑战路径能到达当前 Nginx。若 80 已由宝塔或 1Panel 使用，可由现有入口转发 `/.well-known/acme-challenge/` 到面板 Nginx 的独立 HTTP 端口。通配符域名需要 DNS 验证取得证书后手动导入。

自动续期状态和下次检查时间保存在面板账本，重启后继续。修改域名后重新确认自动证书配置；暂停策略会停止后续续期排程。签发失败后先修正 DNS、入口转发或 CA 信任问题，再从操作记录继续原任务，避免反复创建新的签发申请。

面板自己的 HTTPS 入口由面板容器直接提供，不依赖它正在管理的 Nginx。需要更换面板证书时，将新的 PFX 和密码分别放入 `config/panel.pfx`、`config/tls-password`，权限保持 `600`，然后通过下方原 Compose 重新创建面板；网站证书管理不会自动替换面板入口证书。

## 与宝塔、1Panel 共存

三套面板使用独立安装目录、账号和监听端口。吾码面板安装时不停止已有面板，不改写客户 Nginx、MySQL、Docker 的全局配置。无论先安装哪套面板，都要在后安装的产品中选择未占用端口，并关闭其对吾码资源的自动接管或清理。

同一 IP 的同一个 TCP 端口不能由两个服务同时监听。只有一个入口占用 `80/443`，其它 Nginx 使用独立端口，由现有入口按域名转发。默认 `61890` 是吾码面板入口，Nginx 默认 `18080/18443`；若这些端口已被占用，安装器会停止该动作并保留现有服务。

不同面板共享同一个 Docker Engine 时，停止 Docker、卸载 Docker、全机容器清理或全机数据卷清理会影响所有产品。此类宿主机动作必须由主机管理员统一协调；软件目录隔离不能消除共享运行时的影响。

宝塔原厂安装器会检查已有 Web 环境，部分版本要求空白系统或再次确认覆盖风险。共存前应阅读该版本原厂提示，不在客户主机上直接自动回答覆盖确认。吾码安装器只能保证自身的操作边界，不能约束其它产品之后执行的全机安装、接管或清理动作。

## 网站文件、备份与恢复

文件管理仅开放所选网站目录。单文件上传上限 20 MiB，UTF-8 在线编辑上限 512 KiB；较大部署产物使用独立交付渠道。修改带内容哈希检查，旧页面不能直接覆盖另一位管理员刚保存的内容。删除进入本站点回收记录，历史恢复同样校验当前内容。

冷备份会暂时停止目标服务，完成后恢复原运行状态，备份大小和磁盘速度会影响中断时间。归档包含数据与版本信息，并记录 SHA-256。恢复先校验归档，在新卷解包并逐项核对，再切换容器；原容器和原数据卷保留，切换失败会尝试恢复原运行状态。备份不自动同步到另一台服务器，请另行下载并保存异地副本。

计划任务支持 1–168 小时间隔的冷备份或重启。启用前确认服务允许中断；任务账本会记录稳定操作编号和下次执行时间。失败后查阅任务记录，不会把失败隐藏成一次成功的定时执行。

## 更新面板与离线安装

独立面板使用宿主机安装器更新自身。它先拉取候选镜像，保留原编排、账号、证书和数据，健康检查通过才报告成功；失败会在核对当前容器身份后尝试恢复原镜像。

```bash
bash install-microi-panel.sh --upgrade --root /microi/panel
```

手工重建时同时加载原编排与镜像覆盖文件，保留精确镜像版本：

```bash
docker compose -f /microi/panel/docker-compose.yml -f /microi/panel/docker-compose.image.yml config --quiet
docker compose -f /microi/panel/docker-compose.yml -f /microi/panel/docker-compose.image.yml up -d --no-deps microi-panel
```

离线环境先准备 Linux Docker Engine、Compose v2 和所需 CPU 架构的镜像，执行 `docker load` 后运行安装器的 `--offline` 模式。市场安装时选择「仅使用本地镜像」；Oracle、翻译模型及其它依赖也需提前准备，不能把面板镜像本身当作包含所有业务服务的离线包。

## 接入已有吾码 API/Web

独立安装完成后即可管理插件、网站和备份。原平台更新页只接受明确登记的 API/Web，初始 `config/deployment.json` 留空；安装平台时复用现有面板，也不会自动扩大面板的更新权限。

先在宿主机回读实际容器名、镜像及 Compose 标签：

```bash
docker inspect --format '{{.Name}} {{.Config.Image}} project={{index .Config.Labels "com.docker.compose.project"}} service={{index .Config.Labels "com.docker.compose.service"}} directory={{index .Config.Labels "com.docker.compose.project.working_dir"}}' <API容器名> <Web容器名>
```

按结果填写 `/microi/panel/config/deployment.json`。下面是一个 API 服务的完整示例；容器名、仓库、项目、服务、目录、域名及租户都须换成实际值，Web 同样在 `services` 增加一项，`role` 为 `web`，就绪地址指向 Web 首页。`allowedImageRepositories` 只填获准更新的实际仓库，不填写含密码的镜像地址。

```json
{
  "id": "microi-production",
  "name": "吾码平台",
  "platformApiBase": "https://api.example.com",
  "platformOsClient": "your-osclient",
  "allowedImageRepositories": ["registry.cn-hangzhou.aliyuncs.com/microios/microi-api"],
  "services": [{
    "name": "microi-api", "role": "api",
    "repository": "registry.cn-hangzhou.aliyuncs.com/microios/microi-api", "tag": "latest",
    "composeProject": "microi", "composeService": "microi-api",
    "composeDirectory": "/microi/compose/platform",
    "requireDockerHealth": false,
    "readyUrl": "https://api.example.com/apiengine/platform-ops-readiness?OsClient=your-osclient",
    "readyContains": "\"Ready\"",
    "allowAutomatic": false, "imageRollbackCompatible": false,
    "readyTimeoutSeconds": 300
  }]
}
```

保持文件权限 `600`。在面板原 `docker-compose.yml` 的 `microi-panel.volumes` 增加原 Compose 目录的**同路径读写挂载**，例如 `/microi/compose/platform:/microi/compose/platform`，让更新后的镜像摘要能写回 `docker-compose.ops.yml`；不要覆盖原端口、config/data/logs 或 Docker socket 挂载。随后使用上一节同时加载两个 Compose 文件的命令重建面板。

在「吾码平台升级」核对服务名、当前镜像和更新计划。API 的数据库回退兼容性必须单独确认，确认前保留 `allowAutomatic=false`、`imageRollbackCompatible=false`。平台连接与日志回传在「平台连接」中使用平台账号完成，平台密码不写入部署清单。

需要从吾码后台进入时，更新官方「SaaS引擎」至 `8.3.11`、「应用商城」至 `8.3.7` 及平台内置微服务至 `2.0.2` 或后续版本，在 SaaS 的「服务器运维面板地址」填写独立 HTTPS 地址。需嵌入时，在面板 `config/panel.env` 设置 `OPS_ALLOWED_FRAME_ORIGINS=https://web.example.com` 后重建面板；浏览器限制跨站 Cookie 时使用新窗口入口。这个配置只控制入口和允许的页面来源，不授予服务器管理权限。

## 从 Microi.Ops 迁移

原 API/Web 运维功能保留在面板中，兼容既有 `OPS_*` 参数、SQLite 账本、数据保护密钥、平台运维日志来源和 `MicroiOpsUrl` 字段。原目录、端口、挂载和账号无需为了改名而移动。

已有 Ops 时先在原页面确认没有活动更新任务，将策略改为仅手动，再使用**原 Ops Compose** 把对应服务镜像改为 `registry.cn-hangzhou.aliyuncs.com/microios/microi-panel:v2.0.0`，重新创建该服务。不要重新执行初始化、创建第二个面板控制器或删除原数据卷；同一 Docker 主机只运行一个吾码控制器。

原平台配置和日志回传详见 [Docker 部署的独立运维入口](/doc/getting-started/docker-run.html#平台运维中心-microi-ops-独立升级入口)。平台菜单只是入口，平台 DiyToken 不授予 Docker 权限。管理身份、主机文件和执行器在独立面板内校验，不向可编辑 V8 暴露任意 Docker 指令。

## 运维数据位置

| 路径 | 内容 |
| --- | --- |
| `/microi/panel/config` | 管理员密码文件、面板入口证书、环境配置、可选原平台部署清单 |
| `/microi/panel/data` | SQLite 操作账本、加密凭据与数据保护密钥、备份归档 |
| `/microi/panel/logs` | 面板自己的可轮转运维日志 |
| Docker 命名数据卷 | 各插件的业务数据、Nginx 站点文件和证书客户端状态 |

迁移或灾备须整体保存面板 `config/data` 与相关业务卷。只复制 SQLite 而遗漏加密密钥无法完整恢复凭据；只保留面板镜像无法恢复客户数据。
