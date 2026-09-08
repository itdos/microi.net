# 🐳 Docker 部署

> **通过 Docker 编排部署 Microi吾码低代码平台全套环境**

## 🚀 一键安装（零门槛部署）

针对不想本地编译代码、打包镜像、安装环境等繁琐操作的用户，提供**一键安装脚本**。

默认安装 **主数据库 + Redis + MinIO + MongoDB + 低代码平台程序（API + Web）**，并默认尝试安装 **Microi.Ops 平台运维中心 + PaddleX/PaddleOCR + LibreTranslate（基础语言套餐）** 附加能力。已有 MySQL 或 MinIO 的客户也可在交互中选择复用，安装器会跳过对应容器、数据目录、编排和宿主机端口。附加组件镜像、网络、容器健康检查或对应配置失败时，只会跳过对应附加能力并输出警告，不会回滚或中断已经通过 liveness/readiness 的核心平台；明确不需要动态翻译时可在提示中输入 `0` 跳过 LibreTranslate。

> **权限说明：** 一键安装和一键更新/修复需要创建 `/microi`、数据目录、防火墙规则及宿主机资源限制。下面两条脚本命令可保持原样复制：root 帐号会直接执行；普通帐号会在步骤 1 之前请求一次 `sudo` 并以 root 重新执行，不会再到步骤 5 创建 `/microi/compose` 时才报 `mkdir: Permission denied`。精简系统没有 `sudo` 时，脚本会在任何宿主机变更前明确停止，请先执行 `su -` 切换到 root 后重试。

### ⭐ 最重要的 3 条命令

**1. CentOS 7/8/9 / Ubuntu 20/22/24 / Debian 10/11/12 一键安装**

官方源码可在 [GitHub 镜像](https://github.com/itdos/microi.net) 中浏览；下面的代码块只保留可直接复制执行的命令。

```bash
url=https://gitee.com/ITdos/microi.net/raw/master/%E6%95%B0%E6%8D%AE%E5%BA%93%E3%80%81%E6%A1%88%E4%BE%8B%E3%80%81%E6%96%87%E6%A1%A3%E3%80%81%E8%B5%84%E6%96%99/install-microi.sh;if command -v curl >/dev/null 2>&1;then curl -fsSL -o install-microi.sh "$url";else wget -O install-microi.sh "$url";fi;sed -i 's/\r$//' install-microi.sh;bash install-microi.sh
```

**2. 一键更新/修复 API 与 Web 前端**

这条命令会保留数据库、Redis、MongoDB、MinIO、数据目录与 Docker volume；官方源码同样可在 [GitHub 镜像](https://github.com/itdos/microi.net) 中浏览。

```bash
url=https://gitee.com/ITdos/microi.net/raw/master/%E6%95%B0%E6%8D%AE%E5%BA%93%E3%80%81%E6%A1%88%E4%BE%8B%E3%80%81%E6%96%87%E6%A1%A3%E3%80%81%E8%B5%84%E6%96%99/install-microi.sh;if command -v curl >/dev/null 2>&1;then curl -fsSL -o install-microi.sh "$url";else wget -O install-microi.sh "$url";fi;sed -i 's/\r$//' install-microi.sh;bash install-microi.sh --repair-app
```

**3. 强制删除所有一键安装容器/编排实例**

:::: danger 执行前必须确认目标
下面的命令会强制停止并删除名称以 `microi-install-` 开头的全部容器，服务会立即中断。它不主动删除 `/microi` 数据目录或附加 `-v` 删除卷，但仍应先完成备份并核对容器名称。

```bash
docker ps -a --format "{{.Names}}" | grep "^microi-install-" | xargs -r docker rm -f
```
::::

### 📸 预览图

![Microi吾码 Docker Compose 一键安装终端预览](/images/getting-started/docker-one-click-install-terminal.jpg)

### 🛡️ 宿主机 CPU / 内存保护

Docker 的 `cpus`、`mem_limit` 是**单容器**上限。如果给 API 和数据库各写“整机 95%”，两个容器并发时仍可能把宿主机耗尽；如果按固定比例拆分，又会出现 16 GiB 服务器上的 API 只能使用 2 GiB 之类的不合理限制。

当前一键安装使用 **共享父 cgroup**，但只把 **吾码 API + 本脚本创建的主数据库** 放入同一个 `microi.slice`。CPU、内存只限制这两者的合计，不给 API 和数据库固定拆分份额：数据库空闲时 API 可以使用整个共享池，API 空闲时数据库也可以使用整个共享池；两者同时繁忙时，合计仍不能突破父级硬上限。

- CPU 总预算：`宿主机逻辑 CPU 数 × 95%`，留出 5% 给宿主机和宝塔等进程。
- 内存总预算：`向下取整(宿主机总内存 MiB × 95%)`，剩余部分留给宿主机。计算后的 API + 主数据库共享预算不足 1 GiB 时，安装器会停止。
- 安装器创建持久化的 `/etc/systemd/system/microi.slice`。Docker 使用 `systemd` cgroup 驱动时，Compose 写入 `cgroup_parent: microi.slice`；使用 `cgroupfs` 时写入 `cgroup_parent: /microi.slice`。
- 当前一键安装只支持由宿主机 systemd 管理的 rootful Docker；检测到 rootless Docker 或不具备 CPU/内存 cgroup 控制器时，会在写入 Slice 和启动新容器前停止。
- cgroup v2 会设置父级 `MemoryMax`、`CPUQuota` 和 `MemorySwapMax=0`；cgroup v1 会设置 `MemoryLimit`、`CPUQuota`，内核启用 swap accounting 时再把父级内存与 Swap 合计限制为同一数值。
- Redis、MongoDB、Web、MinIO、OCR、LibreTranslate、Ollama、Qdrant 以及临时工具容器都不加入这个共享池，也不由本方案新增 Docker CPU/内存硬限制。
- Microi.Ops 使用独立编排和独立资源限制（默认 512 MiB / 1 CPU），不加入 API/主数据库共享池，避免平台升级或该池耗尽时连带中断运维入口。
- 复用已有 MySQL 时，外部数据库不在安装器管理的本机父 cgroup 内，因此本机共享池实际只约束吾码 API；外部数据库必须在它自己的宿主机或服务平台单独保护。
- 安装器在启动容器前回读父级 CPU、内存和 Swap 控制文件，启动每个编排前执行 `docker compose config`，启动后再用 `docker inspect` 确认 API 与本脚本创建的主数据库已进入同一 `CgroupParent`。

例如按 4 核、16384 MiB 计算，API + 主数据库共享池硬上限为 **3.8 CPU / 15564 MiB**，给宿主机留下 **0.2 CPU / 820 MiB**（整数 MiB 向下取整后的结果）：

- API 单独繁忙、数据库空闲时，可使用最多约 **3.8 CPU / 15564 MiB**，不再被固定到 2 GiB 左右。
- 数据库单独繁忙时同样可以使用共享池的全部空闲额度。
- API 与主数据库同时繁忙时，它们的**合计**最多为 3.8 CPU / 15564 MiB；其它容器不计入这个合计。

:::: warning 资源限制的真实边界
共享限制能把吾码 API 与主数据库的合计失控影响收敛在 `microi.slice` 内，但不能证明历史故障一定由吾码引起，也不能保证宝塔绝不会受影响：Redis、MongoDB、Web、MinIO、OCR 等其它容器、宿主机 nginx、宝塔和非 Docker 进程都不受这个父级约束，仍可能竞争剩余资源。共享池达到内存硬上限时，API 或数据库进程可能被 OOM Kill；达到 CPU 上限时两者会被整体节流。生产环境仍需结合 `docker stats`、容器日志和宿主机监控定位真实原因。
::::

#### 已有安装或手工 Compose 如何补上限制

此次修改不会自动重写已经生成的旧 Compose。已有环境应先备份数据库和编排文件，再创建共享 Slice，并且只把**吾码 API 与主数据库容器**加入同一个父级；其它服务如曾配置该父级，应从 Compose 中移除。下面以 4 核、16 GiB、cgroup v2 为例：

```ini
# /etc/systemd/system/microi.slice
[Unit]
Description=Microi API and primary database shared resource pool

[Slice]
CPUAccounting=yes
MemoryAccounting=yes
CPUQuota=380%
MemoryMax=15564M
MemorySwapMax=0

[Install]
WantedBy=multi-user.target
```

cgroup v1 主机把 `MemoryMax`、`MemorySwapMax` 替换为 `MemoryLimit=15564M`；旧内核还需按实际是否启用 swap accounting 设置父级 `memory.memsw.limit_in_bytes`。不要为了补这个配置直接重跑已有安装；应先备份，再按本节手工升级并重建原编排。然后确认 Docker 驱动，并只在 API 与主数据库的 Compose 中持久化对应的父级名称：

```bash
docker info --format 'CgroupDriver={{.CgroupDriver}} CgroupVersion={{.CgroupVersion}}'

# Docker CgroupDriver=systemd：API 与主数据库写 cgroup_parent: microi.slice
# Docker CgroupDriver=cgroupfs：API 与主数据库写 cgroup_parent: /microi.slice
```

```yaml
services:
  microi-api:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
    cgroup_parent: microi.slice # cgroupfs 驱动必须改为 /microi.slice

  microi-database:
    image: mysql:8.0
    cgroup_parent: microi.slice # 与 API 完全相同
```

API 和主数据库必须使用完全相同的 `cgroup_parent`，也不要再分别写固定 `cpus` / `mem_limit`。Redis、MongoDB、MinIO、OCR、LibreTranslate、Web、Microi.Ops 以及可选 Ollama/Qdrant 不写这个属性。修改后按顺序验收：

```bash
# 1. 装载并启动共享父级
sudo systemctl daemon-reload
sudo systemctl enable --now microi.slice

# 2. 只解析、规范化并校验 Compose，不启动容器
docker compose config

# 3. 确认数据库已备份后重建当前编排；不要附加 -v
docker compose up -d --force-recreate

# 4. 回读 API、主数据库父级和 Slice 的合计硬限制，并观察一次资源占用
docker inspect microi-api --format 'CgroupParent={{.HostConfig.CgroupParent}} OOMKilled={{.State.OOMKilled}}'
docker inspect microi-database --format 'CgroupParent={{.HostConfig.CgroupParent}} OOMKilled={{.State.OOMKilled}}'
systemctl show microi.slice -p ControlGroup -p CPUQuotaPerSecUSec -p MemoryMax -p MemoryLimit -p MemorySwapMax
docker stats --no-stream
```

Docker Compose 官方文档说明 `cgroup_parent` 用于指定容器父 cgroup；Docker 对 `systemd` 与 `cgroupfs` 驱动的父级命名规则不同。Linux cgroup 的资源限制按层级向所有后代生效，子组不能逃逸父级约束。参见 [Compose 服务属性](https://docs.docker.com/reference/compose-file/services/#cgroup_parent)、[Docker 默认 cgroup 父级](https://docs.docker.com/reference/cli/dockerd/#default-cgroup-parent) 和 [Linux cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)。

:::: warning 不再推荐安装 Ollama、nomic-embed-text 和 Qdrant
对于 Microi吾码默认的 **NL2SQL、NL2V8、在线 AI 数据分析与 AI 编程** 场景，平台内置的“**大模型关键词扩展 + 当前用户权限范围内的 Schema/Skill 搜索 + 精确表/字段回读**”已经完整替代原来的 **Ollama + `nomic-embed-text` + Qdrant** 方案。一键安装脚本已固定跳过这三项：安装更快、资源占用更低，也不会连接或同步向量数据库。

页面末尾仍保留 Ollama 与 Qdrant 的手动编排，仅用于已有项目兼容、独立本地模型实验，或经过实际召回评测后确认必须使用向量库的特殊场景；它们不是新装环境的推荐依赖。
::::

### 📦 CentOS 7/8/9 / Alibaba Cloud Linux 3 / Anolis / Ubuntu 20/22/24 / Debian 10/11/12 一键安装

Alibaba Cloud Linux 3 会按[阿里云官方安装方式](https://help.aliyun.com/zh/ecs/user-guide/install-and-use-docker)补齐 `dnf-plugin-releasever-adapter`，使 Docker CE 仓库使用适配后的发行版本；已有 Docker 与 Compose 可用时继续复用。

```bash
# 官方 GitHub 镜像（源码浏览）：https://github.com/itdos/microi.net
url=https://gitee.com/ITdos/microi.net/raw/master/%E6%95%B0%E6%8D%AE%E5%BA%93%E3%80%81%E6%A1%88%E4%BE%8B%E3%80%81%E6%96%87%E6%A1%A3%E3%80%81%E8%B5%84%E6%96%99/install-microi.sh;if command -v curl >/dev/null 2>&1;then curl -fsSL -o install-microi.sh "$url";else wget -O install-microi.sh "$url";fi;sed -i 's/\r$//' install-microi.sh;bash install-microi.sh
```

#### MinIO 报 `no route to host`（Alibaba Cloud Linux / Anolis / 宝塔）

如果宿主机 MinIO 健康检查通过，但 `mc` 访问 `http://microi-install-minio:9000` 报 `no route to host`，说明容器之间的 TCP 连接尚未建立，不能据此认定 Access Key / Secret Key 错误。重点检查 `microi` 网桥的 firewalld zone、Docker 转发规则和宝塔防火墙规则。

新版脚本会分别写入、回读 firewalld 的运行与持久端口配置，不再在创建 Docker 网络后执行全局 `firewall-cmd --reload`；只校正 `microi` / `microi-ocr` 对应网桥在 Docker 官方 `docker` zone 中的归属。已有 zone 的 target 必须为 `ACCEPT`，否则输出诊断并停止，不自动更改全局安全策略。脚本不会关闭 firewalld/SELinux、清空 iptables、全局放行 FORWARD 或重启 Docker。这与 [Docker 的 firewalld 集成](https://docs.docker.com/engine/network/packet-filtering-firewalls/#integration-with-firewalld)和 [firewalld 的运行/持久端口配置方式](https://firewalld.org/documentation/howto/open-a-port-or-service.html)一致。

安装中断后，可先把最新版 `install-microi.sh` 放到服务器，再执行独立的网络修复：

```bash
bash install-microi.sh --repair-network
```

该入口保留现有容器、端口、凭据和数据目录，并用 `mc` 镜像在 `microi` 网络中访问 MinIO readiness。正常安装也必须通过相同网络检测，随后才验证凭据、创建或复用桶并回读公私桶权限；宿主机端口可达不会单独显示为 MinIO 验收通过。

**网络修复不等于续装。** 若失败发生于步骤 9、API 和 `microi-install-app/docker-compose.yml` 还没有创建，`--repair-app` 无法补齐此次安装。保留失败汇总与已有编排，按实际配置恢复后续安装；普通安装入口仍会拒绝覆盖已有 `microi-install-*` 容器，防止重新导入数据库。仅在确认是尚未投入使用的新安装且已有备份时，才按中断安装提示停掉对应编排并重新安装，原数据目录继续保留。

#### 复用已有 MySQL / MinIO

- 选择 MySQL 5.7 或 MySQL 8.0 后，可选择“使用已有 MySQL 服务”，再填写 IP/DNS、端口、`root` 帐号和该帐号的真实密码。IP 直接按 Enter 表示本机服务，容器通过 `host.docker.internal` 的 host-gateway 访问；安装器会实测连接和服务端版本，只接受与所选项一致的 MySQL 5.7.x / 8.0.x，不接受 MariaDB，也不存在“MySQL 5.8”这个版本选项。
- MySQL 主租户的安装导入、API `OsClientDbConn` 及运行时主库/读库连接统一使用 `root` 和同一密码。新装 MySQL 使用本次生成的随机 root 密码；已有 MySQL 使用输入的 root 密码，不能填写仅有单个业务库权限的普通帐号。`MICROI_EXTERNAL_MYSQL_USER` 省略或为空时默认 root，显式设置为其它帐号会在交互阶段停止。SQL Server、达梦、PostgreSQL 继续使用各自的 `sa`、`SYSDBA`、`postgres` 管理帐号。
- root 名称本身不代表权限完整：安装器从 API 所在的 `microi` Docker 网络，以真实认证到的 `root@Host` 只读检查全部库级权限、`CREATE USER`、`GRANT OPTION`、帐号查询权限和主库可写状态，并拒绝 MySQL 8.0 的库级部分撤权。导入前先检查，导入后在启动 API 前再打开主租户库复核；已有服务权限不足时停止并提示管理员处理，不自动修改已有服务的授权。授权依据见 [MySQL 官方权限说明](https://dev.mysql.com/doc/refman/8.0/en/privileges-provided.html)。
- 主租户数据库连接由 API 的十项启动配置提供，不把 root 密码复制到 `sys_osclients.DbConn/DbReadConn`。子租户继续使用平台为其分配的独立数据库帐号。已安装环境不会因下载新脚本而自动更换凭据：若现场 API 仍使用普通帐号，应先备份编排，把 `OsClientDbConn` 更新为可从 Docker 网络登录、授权完整的 root 连接，再按下方 `--repair-app` 流程更新应用；不要重新导入或删除已有业务数据库。
- MySQL 连接信息确认后，仍可选择吾码官方标准空业务数据库，或指定服务器上的自定义 SQL ZIP。目标数据库不存在时会创建，已存在但为空时会导入；若已经含有表、视图、存储过程或事件，安装器为保护客户数据会停止，不覆盖、不合并、不删除。
- 数据库初始化包选定后，可选择“使用已有 MinIO 服务”，填写 API IP/DNS、端口、HTTP/HTTPS、Access Key、Secret Key、私有桶、公有桶、浏览器可访问地址和可选 Region。安装器使用临时 `mc` 客户端验证凭据，创建或复用两个桶，并确保私有桶禁止匿名访问、公有桶允许匿名下载，然后把端点和桶配置写回当前 SaaS 主租户。
- 本机已有 MySQL/MinIO 不能只监听 `127.0.0.1`，必须允许 Docker host-gateway 到达；远程服务还需提前放通来自安装服务器的网络和帐号权限。客户已有服务的密码/密钥不会在安装结果或失败恢复摘要中回显。

自动化运行可预置以下选择，其余既有提示仍按脚本要求提供输入：

- MySQL：`MICROI_DATABASE_CHOICE=1|2`、`MICROI_MYSQL_SERVICE_MODE=external`、`MICROI_EXTERNAL_MYSQL_HOST`、`MICROI_EXTERNAL_MYSQL_PORT`、`MICROI_EXTERNAL_MYSQL_USER`、`MICROI_EXTERNAL_MYSQL_PASSWORD`。
- MinIO：`MICROI_MINIO_SERVICE_MODE=external`、`MICROI_EXTERNAL_MINIO_HOST`、`MICROI_EXTERNAL_MINIO_PORT`、`MICROI_EXTERNAL_MINIO_USE_SSL`、`MICROI_EXTERNAL_MINIO_ACCESS_KEY`、`MICROI_EXTERNAL_MINIO_SECRET_KEY`、`MICROI_EXTERNAL_MINIO_PRIVATE_BUCKET`、`MICROI_EXTERNAL_MINIO_PUBLIC_BUCKET`、`MICROI_EXTERNAL_MINIO_PUBLIC_ENDPOINT`、`MICROI_EXTERNAL_MINIO_REGION`。

密码和 Secret Key 应只通过当前安装进程的临时环境注入，不要写入命令历史或长期配置文件。

### ⚠️ 注意事项

| 序号 | 说明 |
| :--: | ---- |
| 1 | 执行脚本时会提示选择【公网 IP `g` / 内网 IP `n`】、主租户 `OsClient`（直接 Enter 默认为 `iTdos`）、主数据库类型/版本，以及是否复用已有 MySQL / MinIO |
| 2 | Docker 环境不存在时脚本会**自动安装** Docker 及 Docker Compose V2 插件 |
| 3 | 新装 MySQL 的性能配置会根据宿主机内存与 CPU 自适应生成；Docker 层只让吾码 API 与脚本创建的主数据库共享 `microi.slice` 合计硬上限，复用已有 MySQL 时不修改其全局配置且外部 MySQL 不受本机 Slice 约束 |
| 4 | 数据库还原后会自动同步 `sys_osclients.OsClient/ClientName` 和 API、Web 编排中的 `OsClient` |
| 5 | 新装或复用 MinIO 都会创建/复用私有桶和公有桶（默认 `mci-private` / `mci-public`，已有服务可改名），清理私有桶匿名权限、为公有桶开放匿名下载，并把端点、密钥、桶名、SSL 等配置写回 `sys_osclients` |
| 6 | 根据安装模式选择的访问 IP 和实际端点，自动把 `sys_config.ApiBase` 写为 API 地址，把 `sys_config.FileServer` 写为最终公有桶 HTTP(S) 地址 |
| 7 | 端口从 **61600 开始顺序 +1 分配**；默认新装基础服务（含 OCR）占用 8 个连续端口，LibreTranslate 增加 1 个端口。复用已有 MySQL 时减少 1 个本机端口，复用已有 MinIO 时减少 2 个；已有服务原端口不参与分配或自动开放防火墙 |
| 8 | 安装器始终创建/复用 `microi` 共享 Docker bridge 网络；新装依赖使用容器 DNS 和内部端口，已有 MySQL/MinIO 使用所填地址（本机默认映射为 host-gateway）。OCR 与 LibreTranslate 的诊断端口只绑定 `127.0.0.1` |
| 9 | OCR 国内固定版本镜像和 LibreTranslate 会默认尝试安装，但都属于附加能力。核心 API/Web 先完成 liveness、完整 `ServerVersion` 升级链与 readiness；随后附加服务只有在容器检查、Upgrade29/Upgrade31 字段、唯一主租户和配置回读全部通过时才启用，任一阶段失败只记录警告并跳过对应配置，不回滚或中断核心平台 |
| 10 | API/Web 使用官方浮动标签时会在部署前强制回源拉取最新镜像，避免宿主机缓存的旧 `latest` 通过 liveness 后却缺少 Upgrade29/Upgrade31 |
| 11 | 数据库、Redis、MongoDB、MinIO、API/Web、完整平台升级链、API liveness/readiness 等**核心门禁**失败时，脚本保持非零退出码并打印“安装未完成”恢复汇总；OCR/LibreTranslate 的镜像、网络、健康检查或 SaaS 配置失败时，核心安装继续并在成功汇总中列出附加能力警告。新装凭据按既有规则展示，客户已有 MySQL/MinIO 的密码和密钥只标记为已读取，绝不回显 |
| 12 | 检测到已有安装或中断编排时不要直接重跑、删卷、删除数据目录或清空外部服务；先按失败汇总和 API 日志排查，确需停编排时使用对应目录的 `docker compose down`，禁止附加 `-v` |
| 13 | 安装器源码固定为 UTF-8 no-BOM，并会在任何中文提示前校验可用 UTF-8 locale；原始 locale 明确为 GBK、GB18030 或 GB2312 时自动转码输出。由于服务器无法知道 SSH/宝塔终端实际采用的字符集，如果首屏提示的编码与终端设置不一致，可先执行无副作用检查：`MICROI_INSTALL_OUTPUT_ENCODING=GBK bash install-microi.sh --encoding-check-only`；确认中文正常后用同一变量运行正式安装。可选值为 `UTF-8`、`GB18030`、`GBK`、`GB2312`，推荐优先把终端客户端直接切换为 UTF-8；Windows 旧终端通常先尝试 `GBK`。仅执行 `export LANG=...` 不能改变终端客户端的解码方式。 |
| 14 | 当前一键安装只把吾码 API 与脚本创建的主数据库加入同一个 `microi.slice`，并回读父级 CPU、内存和 Swap 合计硬上限；其它服务不加入。旧安装不会自动补写，请按“宿主机 CPU / 内存保护”一节升级 |

### 📋 端口分配表（默认从 61600 开始）

| 端口 | 服务 | 容器内部端口 |
| :--: | ---- | :--: |
| 61600 | Web 前端 | 80 |
| 61601 | API | 80 |
| 61602 | 主数据库（实际内部端口随所选数据库变化） | - |
| 61603 | Redis 7.4 | 6379 |
| 61604 | MongoDB | 27017 |
| 61605 | MinIO API | 9000 |
| 61606 | MinIO Console | 9001 |
| 61607 | PaddleX/PaddleOCR（仅 `127.0.0.1`） | 8080 |
| 61608 | LibreTranslate（默认安装，套餐 1） | 5000 |

> 上表是一直按 Enter 的吾码官方默认组合，共使用 9 个端口。只有明确输入 `0` 跳过 LibreTranslate 时才使用 `61600`～`61607`；若候选段冲突，脚本把起点从 `61600` 逐次加一后重新检查整段。

> 复用已有 MySQL 会从上表移除主数据库映射端口，复用已有 MinIO 会移除 MinIO API/Console 两个映射端口，其后新装组件会自动前移；两者都复用时默认基础组合减少 3 个本机端口。用户填写的已有服务端口保持原值，不计入本机连续端口段。

> 容器内的 `127.0.0.1` / `localhost` 只代表该容器自身，不能作为 API 连接其它容器或宿主机服务的地址。新装模式采用 Docker DNS：Redis 为 `microi-install-redis:6379`，MongoDB 为 `microi-install-mongodb:27017`，数据库使用实际数据库容器名及内部端口，MinIO 为 `microi-install-minio:9000`。复用本机 MySQL/MinIO 时安装器改用 `host.docker.internal` 并添加 host-gateway；浏览器访问的 `ApiBase`、`FileServer` 和 MinIO 公有端点仍使用实际公网/局域网地址。

> OCR 的宿主机端口不会写入防火墙规则。API 与 OCR 均接入 external bridge 网络 `microi-ocr`，实际调用地址为 `http://microi-install-ocr:8080/ocr`，不经过公网或宿主机 LAN 地址。

### 🔄 一键更新/修复 **API 与 Web 前端**

适用于通过上述一键安装脚本部署的环境，也适用于以下故障：API 报“未检测到 `OsClientRedisHost`”、`OsClientDbConn` 数据库连接串被截断、更新时报同名容器冲突、API/Web 编排在宝塔面板中消失。修复器会从现有容器 Compose 标签及两个标准目录中定位现场编排；多个配置不一致时会在删除容器前停止，不会猜测或覆盖。

```bash
# 官方 GitHub 镜像（源码浏览）：https://github.com/itdos/microi.net
url=https://gitee.com/ITdos/microi.net/raw/master/%E6%95%B0%E6%8D%AE%E5%BA%93%E3%80%81%E6%A1%88%E4%BE%8B%E3%80%81%E6%96%87%E6%A1%A3%E3%80%81%E8%B5%84%E6%96%99/install-microi.sh;if command -v curl >/dev/null 2>&1;then curl -fsSL -o install-microi.sh "$url";else wget -O install-microi.sh "$url";fi;sed -i 's/\r$//' install-microi.sh;bash install-microi.sh --repair-app
```

修复流程如下：

1. 回读现有 API/Web 容器的 Compose project、配置文件和镜像，静态校验 API 十项启动配置及数据库连接串结构；先把 Compose、容器元数据和旧镜像恢复点保存到应用编排目录的 `.repair-backups/<时间>/`。
2. 创建/复用 `microi` 共享 bridge 网络，将脚本新装的数据库、Redis、MongoDB、MinIO 容器接入该网络；通过安装标签识别已有 MySQL/MinIO，保留外部连接串、host-gateway 和 SaaS 存储配置，不查找或重建对应容器。如果脚本管理的数据库连接串缺少用户、密码或端口，修复器会从唯一匹配的现有数据库容器安装环境中恢复完整连接串，全程不输出密码；无法精确匹配容器或凭据时会在删除应用容器前停止。
3. 检测运行中的 Microi.Ops，存在时拒绝并行修复；先在 Ops 确认无活动任务并切为手动，再明确停止 Ops 才能使用命令行救援。按现场 Compose 与 `docker-compose.ops.yml` 镜像覆盖拉取镜像，临时停止原本正在运行的旧 Watchtower，只删除并重建 `microi-install-api`、`microi-install-client` 两个无状态应用容器，从而接管丢失标签或归属漂移造成的同名容器冲突。
4. 重建后回读十项启动配置和 `microi` 网络，依次验证 API liveness、readiness；失败时自动尝试用修复前镜像恢复。最后只恢复原本正在运行的旧 Watchtower；本来关闭的自动更新器保持关闭。

> 该命令不会删除或重建主数据库、Redis、MongoDB、MinIO 容器，不会删除它们的数据目录或 Docker volume，也不会改动客户已有 MySQL/MinIO 服务，更不会执行 `docker compose down -v`。API、Web 前端重建时会有短暂中断。宝塔标准编排目录存在而应用编排仅位于 `/microi/compose` 时，修复器会把已经完整解析的应用配置恢复到宝塔目录后再重建，使编排重新可管理。

### 🗑️ 删除所有已安装容器/编排

::: danger 此操作会立即中断全部一键安装服务
方式一（推荐）：进入各编排目录执行 `docker compose down`。不要附加 `-v`，并保留 `/microi` 下的数据目录。

方式二（强制删除所有 `microi-install-*` 容器）：
```bash
docker ps -a --format "{{.Names}}" | grep "^microi-install-" | xargs -r docker rm -f
```

该命令不主动删除 `/microi` 数据目录或 Docker volume，但会立即中断服务；执行前仍必须备份并核对目标容器。
:::

### 🔌 离线安装（无互联网环境）

适用于**无法访问互联网**的 Linux 服务器，需要在一台有网络的机器上提前制作离线安装包。

#### 前置要求
- 目标服务器已安装 **Docker** 和 **Docker Compose V2** 插件（离线 Docker 安装请参考 [Docker 官方文档](https://docs.docker.com/engine/install/binaries/)）
- 目标服务器已安装 `unzip`、`openssl` 命令
- 制作离线包的机器需要有互联网且已安装 Docker

#### 第一步：在有网络的机器上制作离线包

```bash
# 下载制作脚本和离线安装脚本
# 官方 GitHub 镜像（源码浏览）：https://github.com/itdos/microi.net
curl -sSO https://static.itdos.com/install/microi-offline-prepare.sh
curl -sSO https://static.itdos.com/install/install-microi-offline.sh
curl -sSO https://gitee.com/ITdos/microi.net/raw/master/%E6%95%B0%E6%8D%AE%E5%BA%93%E3%80%81%E6%A1%88%E4%BE%8B%E3%80%81%E6%96%87%E6%A1%A3%E3%80%81%E8%B5%84%E6%96%99/install-microi.sh
sed -i 's/\r$//' microi-offline-prepare.sh install-microi-offline.sh install-microi.sh

# 执行制作脚本（会拉取 Docker 镜像并打包，约需 10-30 分钟）
bash microi-offline-prepare.sh
```

执行完成后会在当前目录生成 `microi-offline.zip`（约 5-10GB，包含所有 Docker 镜像和数据库文件）。

#### 第二步：上传到目标服务器并安装

```bash
# 1. 将 microi-offline.zip 上传到目标服务器（使用 scp、sftp 等工具）
scp microi-offline.zip root@目标服务器IP:/root/

# 2. 在目标服务器上解压
unzip microi-offline.zip -d microi-offline

# 3. 进入目录并执行离线安装
cd microi-offline
bash install-microi-offline.sh
```

::: warning 离线脚本版本边界
- 离线安装器独立维护，不能再假定与当前在线脚本功能完全一致；制作包前必须确认三个脚本版本相同。
- 当前 OCR 默认安装、Upgrade29 字段等待和 SaaS 配置回读以本页在线安装脚本为准。完全离线环境需要额外把固定 OCR 镜像执行 `docker save`/`docker load`，再按下方 OCR 手动编排部署并在健康后配置 SaaS 引擎。
- 离线镜像清单包含 Microi.Ops，首次安装默认为「仅手动」。先通过 `docker load` 导入镜像，再在 Ops 勾选「仅使用本地镜像」并选择目标标签；不会定时访问镜像仓库。缺失 Ops 镜像时报告警告，不转为联网拉取，也不回滚核心平台。
:::

---

## 🔧 Docker 手动编排部署

::: tip 生产环境建议
- 通过服务器面板**原生安装 MySQL**（低配服务器建议 v5.7.x，高配服务器建议 v8.0.x）
- Redis、MongoDB 根据实际情况自由决定编排部署还是服务器面板部署
:::

> 本节只有吾码 API 与主数据库的 Compose 示例使用同一个 `cgroup_parent`，不再给这两者分别写固定 CPU / 内存份额；其它服务示例不加入该父级，也不由本方案新增 Docker 硬限制。共享父级的总上限按前文公式计算；最省心且不易配置错的方式仍是使用一键安装脚本动态生成。

::: danger Ubuntu 24 注意
使用宝塔面板在 Ubuntu 24 上原生安装的 Redis、MongoDB，可能会遇到安装失败或修改端口/密码后无法启动服务，建议直接卸载改用 Docker 编排部署。
:::

请将编排中的镜像地址替换为您的实际地址（默认为开源版镜像）。如使用非公开镜像，需先登录：

```bash
# 请替换帐号、密码、地域
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```

如果不使用宝塔等面板在编排界面操作，可使用脚本将编排内容转换成一行命令在SSH中执行，请将以下脚本命名为【一键编排生成.sh】文件然后直接运行

::: details 如果不使用宝塔等面板在编排界面操作，可使用脚本将编排内容置换成一行命令在SSH中执行
```bash
:<<'WIN'
@echo off
chcp 65001 2>nul
setlocal EnableDelayedExpansion
rem ════════════════════════════════════════════════════════════════
rem  Docker 编排 → 一行 SSH 命令生成器 - Windows 自动启动器
rem  自动查找 Git Bash 或 WSL 并执行此脚本
rem ════════════════════════════════════════════════════════════════
set "BASH_EXE="
if exist "%ProgramFiles%\Git\bin\bash.exe"           set "BASH_EXE=%ProgramFiles%\Git\bin\bash.exe"
if exist "%ProgramFiles(x86)%\Git\bin\bash.exe"      if not defined BASH_EXE set "BASH_EXE=%ProgramFiles(x86)%\Git\bin\bash.exe"
if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe"  if not defined BASH_EXE set "BASH_EXE=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if exist "C:\Git\bin\bash.exe"                       if not defined BASH_EXE set "BASH_EXE=C:\Git\bin\bash.exe"
if exist "C:\msys64\usr\bin\bash.exe"                if not defined BASH_EXE set "BASH_EXE=C:\msys64\usr\bin\bash.exe"
if not defined BASH_EXE (
    for /f "delims=" %%i in ('where bash 2^>nul') do (
        echo %%i | findstr /i "System32" >nul || if not defined BASH_EXE set "BASH_EXE=%%i"
    )
)
if defined BASH_EXE goto :bash_run
where wsl >nul 2>nul
if %ERRORLEVEL% equ 0 goto :wsl_run
echo.
echo   ════════════════════════════════════════════════════════
echo   ERROR: 未找到 Git Bash 或 WSL！请安装以下任意一种:
echo     1. Git for Windows: https://git-scm.com/download/win
echo     2. WSL2: 在管理员 PowerShell 中运行 wsl --install
echo   ════════════════════════════════════════════════════════
echo.
pause
exit /b 1
:bash_run
echo   ^> Bash: !BASH_EXE!
"!BASH_EXE!" "%~f0" %*
set EC=!ERRORLEVEL!
echo.
pause
exit /b !EC!
:wsl_run
echo   ^> WSL: 执行中...
for /f "delims=" %%p in ('wsl wslpath -u "%~f0"') do set "WSLP=%%p"
wsl bash "!WSLP!" %*
set EC=!ERRORLEVEL!
echo.
pause
exit /b !EC!
WIN
#!/usr/bin/env bash
# 如果用户在 macOS/Linux 上用 `sh 一键编排生成.sh` 启动，
# 这里先切回 bash；脚本后续依赖数组、case 等 bash 特性。
if [ -z "${BASH_VERSION:-}" ]; then
    if command -v bash >/dev/null 2>&1; then
        exec bash "$0" "$@"
    fi
    printf '%s\n' "ERROR: 未找到 bash，请安装 bash 后执行: bash $0" >&2
    exit 1
fi
set +o posix 2>/dev/null || true

# ════════════════════════════════════════════════════════════════
#  Docker 编排 → 一行 SSH 命令生成器
#  把任意 docker-compose 编排文件 / 编排内容 转成可在 SSH 终端
#  直接粘贴运行的一行命令：
#      mkdir -p <目录> && echo '<b64>' | base64 -d > <目录>/<文件> \
#          && cd <目录> && <compose命令> up -d
#
#  使用场景：
#      A 电脑有编排文件 → 一键生成一行命令 → 复制粘到 B 电脑的 SSH
#      终端 → 在 C 服务器(CentOS)上一键拉起所有编排容器。
#
#  两种调用方式：
#      [1] 双击 / 无参数    → 交互模式（输入路径或粘贴内容，生成 .sh 文件）
#      [2] bash 一键编排生成.sh <编排文件> [...选项]
#                          → 命令行模式（直接输出命令到屏幕）
#
#  平台支持：
#      macOS / Linux:  bash 一键编排生成.sh [选项]
#      Windows:        在资源管理器双击 .sh（自动调用 Git Bash / WSL）
#                      或 Git Bash 终端中执行同样的 bash 命令
# ════════════════════════════════════════════════════════════════
set -e
set -o pipefail

# 切换到脚本所在目录（确保编排文件相对路径可用，也是生成 .sh 文件的输出目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Windows (Git Bash / WSL) 下：异常退出也暂停等待用户确认，避免窗口一闪而过
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$WINDIR" ]]; then
    trap 'echo ""; read -r -p "  按回车键关闭窗口..." _w' EXIT
fi

# ──────────────────────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

print_banner() {
    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    printf "${BOLD}${CYAN}║${NC}  ${BOLD}%-58s${NC}${BOLD}${CYAN}║${NC}\n" "$1"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "  ${CYAN}▸${NC} $1"
}

print_success() {
    echo -e "  ${GREEN}[OK]${NC} $1"
}

print_fail() {
    echo -e "  ${RED}[ERR]${NC} $1" >&2
    echo ""
    echo -e "  ${RED}════════════════════════════════════════════════════════════${NC}" >&2
    echo -e "  ${RED}脚本中止！${NC}" >&2
    echo -e "  ${RED}════════════════════════════════════════════════════════════${NC}" >&2
    exit 1
}

print_warning() {
    echo -e "  ${YELLOW}[WARN]${NC} $1"
}

# 跨平台 base64 编码（Linux 用 -w0，macOS BSD base64 没有 -w）
b64_encode() {
    if echo "test" | base64 -w0 >/dev/null 2>&1; then
        base64 -w0
    else
        base64 | tr -d '\n'
    fi
}

# 跨平台复制到剪贴板
copy_to_clipboard() {
    local content=$1
    if command -v pbcopy >/dev/null 2>&1; then
        printf '%s' "$content" | pbcopy
        print_success "已复制到剪贴板 (pbcopy)"
    elif command -v xclip >/dev/null 2>&1; then
        printf '%s' "$content" | xclip -selection clipboard
        print_success "已复制到剪贴板 (xclip)"
    elif command -v wl-copy >/dev/null 2>&1; then
        printf '%s' "$content" | wl-copy
        print_success "已复制到剪贴板 (wl-copy)"
    elif command -v clip.exe >/dev/null 2>&1; then
        printf '%s' "$content" | clip.exe
        print_success "已复制到剪贴板 (clip.exe)"
    elif command -v powershell.exe >/dev/null 2>&1; then
        printf '%s' "$content" | powershell.exe -NoProfile -Command "$input | Set-Clipboard"
        print_success "已复制到剪贴板 (PowerShell Set-Clipboard)"
    else
        print_warning "未检测到任何剪贴板命令（pbcopy / xclip / wl-copy / clip.exe / powershell.exe），请手动复制"
    fi
}

# Windows 路径转 Git Bash 路径：d:\Work\a.txt → /d/Work/a.txt
# 同时把反斜杠全部转为正斜杠
normalize_path() {
    local p=$1
    # 先把所有 \ 替换为 /
    p="${p//\\//}"
    # 把盘符前缀 X: 转为 /x（小写）
    if [[ "$p" =~ ^([A-Za-z]):(/|$) ]]; then
        local drive="${BASH_REMATCH[1],,}"
        local rest="${BASH_REMATCH[2]}"
        p="/${drive}${rest}"
    fi
    printf '%s' "$p"
}

# ──────────────────────────────────────────────────────────────
# 核心：把内容编码并写入 gen-cmdline-<timestamp>.sh 到 SCRIPT_DIR
# 入参: $1=内容字符串  $2=源描述(用于注释)  $3=是否复制到剪贴板(true/false)
# 副作用: 创建 .sh 文件,打印命令,可选复制剪贴板
# ──────────────────────────────────────────────────────────────
generate_sh_file() {
    local content=$1
    local source_desc=$2
    local copy_clip=${3:-false}

    local content_len=${#content}
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)
    local output_file="${SCRIPT_DIR}/gen-cmdline-${timestamp}.txt"

    # Base64 编码（用 printf 确保不加末尾换行）
    local b64
    b64=$(printf '%s' "$content" | b64_encode)
    local b64_len=${#b64}

    # 拼成最终一行命令（base64 用单引号包裹）
    local cmd="mkdir -p ${REMOTE_DIR} && echo '${b64}' | base64 -d > ${REMOTE_DIR}/${COMPOSE_FILE} && cd ${REMOTE_DIR} && ${COMPOSE_CMD} up -d"
    local cmd_len=${#cmd}

    # 写入新的 .txt 文件（纯文本，方便用记事本/VSCode 直接打开）
    cat > "$output_file" <<HEADER
# ════════════════════════════════════════════════════════════════
#  一行 SSH 命令 - 由 一键编排生成.sh 自动生成
#  生成时间:  $(date '+%Y-%m-%d %H:%M:%S')
#  源:        ${source_desc}
#  内容字节:  ${content_len}
#  Base64:    ${b64_len} 字符
#  写入远程:  ${REMOTE_DIR}/${COMPOSE_FILE}
#  启动命令:  ${COMPOSE_CMD} up -d
#  文件路径:  ${output_file}
# ════════════════════════════════════════════════════════════════
#
#  用法 (任选其一):
#    1) 在 B 电脑的 SSH 终端(C 服务器)直接粘贴下面这一行命令
#    2) 在 A 电脑执行: cat 此文件 | ssh root@C服务器
#    3) 用文本编辑器打开此文件,复制下面这一行命令

${cmd}
HEADER

    # 显示信息
    echo ""
    echo -e "${BOLD}${GREEN}================ 一行 SSH 命令 (复制后粘到 B 电脑 SSH 终端) ================${NC}"
    echo ""
    echo "$cmd"
    echo ""
    echo -e "${BOLD}${GREEN}================ 信息 ================${NC}"
    echo "  源:        $source_desc"
    echo "  内容字节:  $content_len"
    echo "  Base64:    $b64_len 字符"
    echo "  命令总长:  $cmd_len 字符"
    echo "  写入远程:  ${REMOTE_DIR}/${COMPOSE_FILE}"
    echo "  启动命令:  ${COMPOSE_CMD} up -d"
    echo ""
    echo -e "${BOLD}${YELLOW}📁 已生成可重复使用的命令文件:${NC}"
    echo -e "  ${BOLD}${output_file}${NC}"
    echo ""
    echo -e "  💡 以后想再次部署,直接用文本编辑器打开该文件,复制里面那一行命令粘到 SSH 终端即可。"
    echo ""

    if [ "$copy_clip" = true ]; then
        copy_to_clipboard "$cmd"
    fi
}

# ──────────────────────────────────────────────────────────────
# 交互模式（双击 / 无参数 / -i）
# ──────────────────────────────────────────────────────────────
interactive_mode() {
    print_banner "Docker 编排 → 一行 SSH 命令生成器  [交互模式]"

    echo "  请选择输入方式:"
    echo ""
    echo "    [1] 输入编排文件路径 (支持绝对/相对路径)"
    echo "    [2] 直接粘贴编排内容 (YAML 多行,以单独空行结束)"
    echo ""
    echo -n "  请输入选项 [1/2] (直接回车 = 1): "
    IFS= read -r choice
    choice="${choice:-1}"

    case "$choice" in
        2)
            # ─── 内容粘贴模式 ───
            echo ""
            echo "  ┌──────────────────────────────────────────────────────────────┐"
            echo "  │ 请粘贴 docker-compose 编排内容 (YAML)                        │"
            echo "  │ 粘贴完成后,单独输入一个空行 (直接按回车) 即可结束           │"
            echo "  └──────────────────────────────────────────────────────────────┘"
            echo ""
            local content=""
            local line_count=0
            local first_line=1
            while IFS= read -r line; do
                # 第一个空行 = 结束
                if [ -z "$line" ] && [ $first_line -eq 0 ]; then
                    break
                fi
                first_line=0
                # 第一行不空才开始记录;首行若为空也允许(空内容时直接按回车)
                if [ $line_count -eq 0 ]; then
                    content="$line"
                else
                    content="$content"$'\n'"$line"
                fi
                line_count=$((line_count + 1))
            done

            if [ -z "$content" ]; then
                print_fail "未粘贴任何编排内容"
            fi

            echo ""
            print_success "已接收编排内容 (${#content} 字符, $line_count 行)"

            # 可选复制
            echo -n "  是否同时复制生成的命令到剪贴板? [y/N]: "
            IFS= read -r copy_choice
            local want_clip=false
            [[ "$copy_choice" =~ ^[Yy]$ ]] && want_clip=true

            generate_sh_file "$content" "直接粘贴的编排内容 (${line_count} 行)" "$want_clip"
            ;;

        *)
            # ─── 文件路径模式 ───
            echo ""
            echo "  请输入编排文件路径 (支持 Windows 路径 d:\\... 或 POSIX 路径 /d/...):"
            echo ""
            echo -e "  ${DIM}提示: 当前目录 = ${SCRIPT_DIR}${NC}"
            echo -e "  ${DIM}      相对路径示例: ./程序编排.txt  或  程序编排.txt${NC}"
            echo ""
            echo -n "  文件路径: "
            IFS= read -r file_path

            if [ -z "$file_path" ]; then
                print_fail "未输入文件路径"
            fi

            # 去掉首尾空白与可能附带的引号
            file_path="${file_path#"${file_path%%[![:space:]]*}"}"  # 去前导空格
            file_path="${file_path%"${file_path##*[![:space:]]}"}"  # 去尾部空格
            file_path="${file_path%\"}"  # 去尾部引号
            file_path="${file_path#\"}"  # 去前导引号

            # 路径规范化: Windows 路径转 Git Bash 风格
            local normalized
            normalized=$(normalize_path "$file_path")

            # 多候选位置尝试解析(用户输入相对路径时,智能匹配)
            local resolved=""
            if [[ "$normalized" =~ ^/ ]] || [[ "$normalized" =~ ^[A-Za-z]: ]]; then
                # 绝对路径,直接用
                [ -f "$normalized" ] && resolved="$normalized"
            else
                # 相对路径,按顺序尝试以下候选位置,哪个能找到就用哪个:
                local -a candidates=(
                    "$normalized"                          # 1) 原值(纯文件名,依赖 CWD)
                    "${SCRIPT_DIR}/${normalized}"          # 2) 脚本所在目录(最常见,用户双击时)
                    "$(pwd)/${normalized}"                 # 3) 当前工作目录
                    "${SCRIPT_DIR}/../${normalized}"       # 4) 脚本的父目录(可能在 ToDesk 上层)
                    "${SCRIPT_DIR}/../../${normalized}"     # 5) 上两级目录
                    "${HOME:-}/${normalized}"               # 6) 用户 HOME 目录
                )
                for cand in "${candidates[@]}"; do
                    if [ -f "$cand" ]; then
                        resolved="$cand"
                        break
                    fi
                done
                [ -z "$resolved" ] && resolved="${SCRIPT_DIR}/${normalized}"
            fi

            if [ -z "$resolved" ] || [ ! -f "$resolved" ]; then
                echo ""
                echo "  ${RED}[ERR]${NC} 文件不存在: $file_path"
                echo ""
                echo "  已尝试解析为以下路径,均未找到文件:"
                echo "    - $file_path (原始输入)"
                echo "    - ${normalized} (规范化后)"
                if [[ ! "$normalized" =~ ^/ ]] && [[ ! "$normalized" =~ ^[A-Za-z]: ]]; then
                    echo "    - ${SCRIPT_DIR}/${normalized}  (脚本目录)"
                    echo "    - $(pwd)/${normalized}  (当前目录)"
                    echo "    - ${SCRIPT_DIR}/../${normalized}  (上级目录)"
                    echo "    - ${HOME:-}/${normalized}  (HOME)"
                fi
                echo ""
                echo "  当前工作目录: $(pwd)"
                echo "  脚本目录:     ${SCRIPT_DIR}"
                echo ""
                echo "  提示:"
                echo "    1) 直接粘贴文件的完整绝对路径(Windows 路径可: d:\\... 或 /d/...)"
                echo "    2) 确认文件名拼写正确,以及文件确实存在"
                echo "    3) 或者选 [2] 直接粘贴编排内容"
                echo ""
                exit 1
            fi

            local file_size
            file_size=$(wc -c < "$resolved" | tr -d ' ')
            print_success "编排文件: $resolved (${file_size} 字节)"

            # 读取文件内容
            local content
            content=$(cat "$resolved")

            # 可选复制
            echo -n "  是否同时复制生成的命令到剪贴板? [y/N]: "
            IFS= read -r copy_choice
            local want_clip=false
            [[ "$copy_choice" =~ ^[Yy]$ ]] && want_clip=true

            generate_sh_file "$content" "文件: $normalized (${file_size} 字节)" "$want_clip"
            ;;
    esac
}

# ──────────────────────────────────────────────────────────────
# 帮助信息
# ──────────────────────────────────────────────────────────────
print_usage() {
    cat <<EOF

${BOLD}用法:${NC}
  bash 一键编排生成.sh                       [交互模式: 输入路径或粘贴内容]
  bash 一键编排生成.sh <编排文件> [...选项]  [命令行模式]

${BOLD}位置参数 (命令行模式):${NC}
  <编排文件>       必填。要转换的 docker-compose 编排文件路径。
  [远程目录]       可选。远程服务器目标目录，默认 /microi。
  [compose文件名]  可选。远程服务器上落地的文件名，默认 docker-compose.yml。
  [compose命令]    可选。远程服务器上的 compose 命令，默认 docker-compose。

${BOLD}选项 (放任意位置):${NC}
  -i, --interactive   强制进入交互模式。
  --save              同时把生成的一行命令保存为 .sh 文件到本脚本同目录。
  --clip              复制到剪贴板。
  -h, --help          显示帮助。

${BOLD}典型示例:${NC}
  # 1) 双击 .sh / 无参数 → 交互模式
  bash 一键编排生成.sh

  # 2) 命令行: 转换编排文件
  bash 一键编排生成.sh 程序编排.txt

  # 3) 命令行 + 自定义参数 + 保存 + 复制
  bash 一键编排生成.sh app.yml /opt/app docker-compose.yml "docker compose" --save --clip

  # 4) 强制交互
  bash 一键编排生成.sh -i
EOF
}

# ──────────────────────────────────────────────────────────────
# 主入口
# ──────────────────────────────────────────────────────────────
# 先解析选项
FORCE_INTERACTIVE=false
SAVE_TO_FILE=false
COPY_CLIP=false
POSITIONAL=()

for arg in "$@"; do
    case "$arg" in
        -h|--help)
            print_usage
            exit 0
            ;;
        -i|--interactive)
            FORCE_INTERACTIVE=true
            ;;
        --save)
            SAVE_TO_FILE=true
            ;;
        --clip)
            COPY_CLIP=true
            ;;
        *)
            POSITIONAL+=("$arg")
            ;;
    esac
done

# 默认参数 (远端目录 / compose 文件名 / compose 命令)
REMOTE_DIR="${POSITIONAL[1]:-/microi}"
COMPOSE_FILE="${POSITIONAL[2]:-docker-compose.yml}"
COMPOSE_CMD="${POSITIONAL[3]:-docker-compose}"

# 决定模式
if [ "$FORCE_INTERACTIVE" = true ] || [ ${#POSITIONAL[@]} -eq 0 ]; then
    # ── 交互模式 ──
    interactive_mode
else
    # ── 命令行模式 ──
    FILE="${POSITIONAL[0]}"

    # 路径规范化
    FILE=$(normalize_path "$FILE")
    if [[ ! "$FILE" =~ ^/ ]] && [[ ! "$FILE" =~ ^[A-Za-z]: ]]; then
        FILE="${SCRIPT_DIR}/${FILE}"
    fi

    if [ ! -f "$FILE" ]; then
        print_banner "Docker 编排 → 一行 SSH 命令生成器  [命令行模式]"
        print_fail "找不到编排文件: ${POSITIONAL[0]}\n  解析后路径: $FILE"
    fi

    FILE_BYTES=$(wc -c < "$FILE" | tr -d ' ')
    print_banner "Docker 编排 → 一行 SSH 命令生成器  [命令行模式]"
    print_step "读取编排文件: $FILE"
    print_success "编排文件: $FILE (${FILE_BYTES} 字节)"

    print_step "Base64 编码中..."
    CONTENT=$(cat "$FILE")
    B64=$(printf '%s' "$CONTENT" | b64_encode)
    B64_LEN=${#B64}
    print_success "Base64 长度: $B64_LEN"

    # 拼成最终一行命令
    CMD="mkdir -p ${REMOTE_DIR} && echo '${B64}' | base64 -d > ${REMOTE_DIR}/${COMPOSE_FILE} && cd ${REMOTE_DIR} && ${COMPOSE_CMD} up -d"
    CMD_LEN=${#CMD}

    echo ""
    echo -e "${BOLD}${GREEN}================ 一行 SSH 命令 (复制后粘到 B 电脑 SSH 终端) ================${NC}"
    echo ""
    echo "$CMD"
    echo ""
    echo -e "${BOLD}${GREEN}================ 信息 ================${NC}"
    echo "  编排文件:    $FILE"
    echo "  文件字节:    $FILE_BYTES"
    echo "  Base64 长度: $B64_LEN"
    echo "  命令总长度:  $CMD_LEN"
    echo "  写入远程:    ${REMOTE_DIR}/${COMPOSE_FILE}"
    echo "  启动命令:    ${COMPOSE_CMD} up -d"
    echo ""

    if [ "$COPY_CLIP" = true ]; then
        copy_to_clipboard "$CMD"
    fi

    if [ "$SAVE_TO_FILE" = true ]; then
        generate_sh_file "$CONTENT" "文件: $FILE (${FILE_BYTES} 字节)" "$COPY_CLIP"
    fi
fi

# Windows (Git Bash / WSL) 下：正常结束时也给用户看一眼结果再关闭窗口
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$WINDIR" ]]; then
    echo ""
    read -r -p "  按回车键关闭窗口..." _w
fi
```
::: 

---

### 1️⃣ 安装 MySQL

::: tip 推荐
推荐使用服务器面板进行**原生安装 MySQL**。
:::

::: danger Ubuntu 24 + MySQL 8.0 注意
使用宝塔面板在 Ubuntu 24 上原生安装的 MySQL 8.0，可能遇到修改 3306 端口为其它端口后无法启动的问题，此时直接使用 3306 端口即可。
:::

**安装后操作：**

1. 使用面板的数据库性能配置进行优化
2. 在配置文件 `[mysqld]` 下添加 `lower_case_table_names = 1`
3. 尝试使用服务器面板的数据库管理进行还原数据库

::: warning 还原数据库失败？
若面板还原失败（如视图之间存在关联 SQL），可使用 Navicat 的**数据传输**功能（成功率 100%）。若遇到视图关联问题，请依次单个还原视图。
:::

4. 还原成功后，建议执行以下 SQL：
```sql
-- 若不能通过Navicat连接数据库，如果是docker部署的mysql，先进入mysql的docker容器
docker exec -it 容器Id/Name bash
-- 在服务器执行命令进入mysql
mysql -u root -p
use 您的数据库名称;
-- 1、修改【sys_config】表中的【SysTitle】字段为新系统名称
update sys_config set SysTitle='新系统名称';
-- 2、修改【sys_osclients】表中的【OsClient】字段为新系统key，修改【RedisHost、RedisPort、RedisPwd】字段为空
update sys_osclients set OsClient='新系统key',RedisHost='',RedisPort='',RedisPwd='';
-- 3、为了防止部分定时任务影响原有业务，建议执行sql停止所有定时任务
update diy_schedule_job set Status='暂停';
update microi_job_triggers set TRIGGER_STATE='PAUSED';
```

---

#### MySQL 5.7 编排

::: tip 配置建议
低配服务器建议 v5.7.x（如 4核8G/16G），高配服务器建议 v8.0.x（如 8核8G/16G）
:::
::: details 展开查看 Shell 命令（21 行）
```shell
version: '3.8'
services:
  microi-mysql5.7:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mysql:5.7
    container_name: microi-mysql5.7
    restart: always
    cgroup_parent: "${MICROI_CGROUP_PARENT:-microi.slice}"
    tty: true
    stdin_open: true
    ports:
      - "1306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password123456
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - /microi/mysql5.7/data:/var/lib/mysql
      - /microi/mysql5.7/config/microi_mysql.cnf:/etc/mysql/conf.d/microi_mysql.cnf
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
:::
MySQL 5.7 数据库配置文件 `microi_mysql.cnf`：
::: details 展开查看 Shell 命令（48 行）
```shell
[mysqld]
# Microi 自适应配置：RAM=16384MB, physical=4, logical=4, disk=ssd
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
max_allowed_packet = 512M
skip_name_resolve = ON
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION

# 连接与表缓存（连接数同时受 CPU、共享父级内存上限约束）
max_connections = 100
max_connect_errors = 100000
thread_cache_size = 32
table_open_cache = 1024

# 全局内存；每连接缓冲保持保守值，避免高并发 OOM
innodb_buffer_pool_size = 5120M
innodb_log_buffer_size = 64M
key_buffer_size = 64M
tmp_table_size = 64M
max_heap_table_size = 64M
sort_buffer_size = 512K
read_buffer_size = 512K
read_rnd_buffer_size = 512K
join_buffer_size = 512K
thread_stack = 512K

# 按物理核心与 SSD/HDD 自动调节的 InnoDB I/O
innodb_buffer_pool_instances = 5
innodb_log_file_size = 320M
innodb_log_files_in_group = 2
innodb_io_capacity = 2000
innodb_io_capacity_max = 4000
innodb_flush_method = O_DIRECT
innodb_flush_neighbors = 0
innodb_read_io_threads = 4
innodb_write_io_threads = 4
innodb_purge_threads = 2
innodb_adaptive_flushing = ON

# 默认采用安全持久化；不要为降低资源占用而牺牲事务一致性
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1
innodb_doublewrite = 1
log_bin_trust_function_creators = ON
performance_schema = ON
query_cache_type = 0
query_cache_size = 0
```
:::

---

#### MySQL 8.0 编排

::: tip 配置建议
低配服务器建议 v5.7.x，高配服务器建议 v8.0.x
:::
::: details 展开查看 Shell 命令（21 行）
```shell
version: '3.8'
services:
  microi-mysql8.0:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mysql:8.0
    container_name: microi-mysql8.0
    restart: always
    cgroup_parent: "${MICROI_CGROUP_PARENT:-microi.slice}"
    tty: true
    stdin_open: true
    ports:
      - "1307:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password123456
      - MYSQL_TIME_ZONE=Asia/Shanghai
    volumes:
      - /microi/mysql8.0/data:/var/lib/mysql
      - /microi/mysql8.0/config/microi_mysql8.0.cnf:/etc/mysql/conf.d/microi_mysql8.0.cnf
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
:::
MySQL 8.0 数据库配置文件 `microi_mysql8.0.cnf`：
::: details 展开查看 Shell 命令（47 行）
```shell
[mysqld]
# Microi 自适应配置：RAM=16384MB, physical=4, logical=4, disk=ssd
lower_case_table_names = 1
character_set_server = utf8mb4
collation_server = utf8mb4_unicode_ci
max_allowed_packet = 512M
skip_name_resolve = ON
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION

# 连接与表缓存（连接数同时受 CPU、共享父级内存上限约束）
max_connections = 100
max_connect_errors = 100000
thread_cache_size = 32
table_open_cache = 1024

# 全局内存；每连接缓冲保持保守值，避免高并发 OOM
innodb_buffer_pool_size = 5120M
innodb_log_buffer_size = 64M
key_buffer_size = 64M
tmp_table_size = 64M
max_heap_table_size = 64M
sort_buffer_size = 512K
read_buffer_size = 512K
read_rnd_buffer_size = 512K
join_buffer_size = 512K
thread_stack = 512K

# 按物理核心与 SSD/HDD 自动调节的 InnoDB I/O
innodb_buffer_pool_instances = 5
innodb_log_file_size = 320M
innodb_log_files_in_group = 2
innodb_io_capacity = 2000
innodb_io_capacity_max = 4000
innodb_flush_method = O_DIRECT
innodb_flush_neighbors = 0
innodb_read_io_threads = 4
innodb_write_io_threads = 4
innodb_purge_threads = 2
innodb_adaptive_flushing = ON

# 默认采用安全持久化；不要为降低资源占用而牺牲事务一致性
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1
innodb_doublewrite = 1
log_bin_trust_function_creators = ON
performance_schema = ON
default_authentication_plugin = mysql_native_password
```
:::

---

### 3️⃣ Redis 编排

::: warning 注意
编排中有两个地方包含 `password123456`，请修改为您的自定义密码。
:::
::: details 展开查看 Shell 命令（93 行）
```shell
version: '3.8'
services:
  microi-redis:
    image: registry.cn-hangzhou.aliyuncs.com/microios/redis:7.4.2
    container_name: microi-redis
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
      - /microi/redis/data:/data
    environment:  
      - REDIS_PASSWORD=password123456
    ports:
      - "1379:6379"
    command: 
      - redis-server
      - "--requirepass"
      - "password123456"
      - "--maxmemory"
      - "2gb"            # Redis 自身的缓存上限；不计入 API + 主数据库共享池
      - "--maxmemory-policy"
      - "allkeys-lru"
      - "--timeout"
      - "300"
      - "--tcp-keepalive"
      - "300"
      - "--tcp-backlog"
      - "511"
      - "--maxclients"
      - "10000"
      - "--loglevel"
      - "notice"
      - "--databases"
      - "16"
      - "--save"
      - "900 1"
      - "--save"
      - "300 10"
      - "--save"
      - "60 10000"
      - "--stop-writes-on-bgsave-error"
      - "no"
      - "--rdbcompression"
      - "yes"
      - "--rdbchecksum"
      - "yes"
      - "--dbfilename"
      - "dump.rdb"
      - "--appendonly"
      - "yes"
      - "--appendfilename"
      - "appendonly.aof"
      - "--appendfsync"
      - "everysec"
      - "--no-appendfsync-on-rewrite"
      - "no"
      - "--auto-aof-rewrite-percentage"
      - "100"
      - "--auto-aof-rewrite-min-size"
      - "64mb"
      - "--aof-load-truncated"
      - "yes"
      - "--aof-use-rdb-preamble"
      - "yes"
      - "--lua-time-limit"
      - "5000"
      - "--lazyfree-lazy-eviction"
      - "no"
      - "--lazyfree-lazy-expire"
      - "no"
      - "--lazyfree-lazy-server-del"
      - "no"
      - "--replica-lazy-flush"
      - "no"
      - "--slowlog-log-slower-than"
      - "10000"
      - "--slowlog-max-len"
      - "128"
      - "--hz"
      - "10"
      - "--dynamic-hz"
      - "yes"
      - "--aof-rewrite-incremental-fsync"
      - "yes"
      - "--rdb-save-incremental-fsync"
      - "yes"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true
```
:::


---

### 4️⃣ MongoDB 编排

::: warning 注意
请修改默认密码 `password123456`。
:::
::: details 展开查看 Shell 命令（21 行）
```shell
version: '3.8'
services:
  microi-mongodb:
    image: registry.cn-hangzhou.aliyuncs.com/microios/mongo:latest
    container_name: microi-mongodb
    restart: always
    tty: true
    stdin_open: true
    ports:
      - "1017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=root
      - MONGO_INITDB_ROOT_PASSWORD=password123456
    volumes:
      - /microi/mongodb/data:/data/db
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    logging:
      options:
        max-size: 10m
        max-file: "10"
```
:::

---

### 5️⃣ MinIO 编排

::: warning 注意修改默认密码 `password123456`
:::

| 端口 | 说明 |
| :--: | ---- |
| 1011 (9001) | MinIO 后台管理面板，安装后需添加公有桶 `mci-public`（权限设为 public）和私有桶 `mci-private` |
| 1010 (9000) | Endpoint 端口，用于 SaaS 引擎配置 EndPoint，如 `192.168.31.199:1010` |

::: danger MinIO 反向代理注意
必须设置 `proxy_set_header Host $http_host`，否则导致私有桶只能上传无法下载。阿里云 OSS、CDN、负载均衡默认配置不会有此问题。
:::
::: details 展开查看 Shell 命令（25 行）
```shell
version: '3.8'
services:
  microi-minio:
    image:  registry.cn-hangzhou.aliyuncs.com/microios/minio:2023-06-09
    container_name: microi-minio
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
      - /microi/minio/data:/data
      - /microi/minio/config:/root/.minio
    environment:  
      - MINIO_ROOT_USER=root
      - MINIO_ROOT_PASSWORD=password123456
    command: server /data --console-address ":9001"
    ports:
      - "1010:9000"
      - "1011:9001"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true
```
:::

---

### 6️⃣ 低代码平台程序编排（Api + Web）

::: tip 说明
- 请将所有参数修改为实际参数，以下镜像均为公开开源版镜像
- `microi-client` 编排的 `OsClient` 可不指定，默认为空（SaaS 模式）
- API 容器只允许下面十个启动引导配置：`OsClient`、`OsClientType`、`OsClientNetwork`、`OsClientDbType`、`OsClientDbConn`、`OsClientRedisHost`、`OsClientRedisPort`、`OsClientRedisPwd`、`OsClientRedisDataBase`、`OsClientDbMongoConn`。其它后端运行参数统一在主租户 SaaS 引擎中动态维护，不要再增加 `MICROI_*` 或自定义 `AppSettings` 环境变量。`ASPNETCORE_*` / `DOTNET_*` 仅属于 .NET 宿主配置。
- 下方旧式手工示例中的 `172.27.221.211` 表示 API 容器确实可达的外部数据库/缓存宿主机，并不表示推荐让同机 Docker 依赖绕宿主机端口；同机容器部署应建立共享 bridge 网络，改用对应容器 DNS 与内部端口。无论哪种方式，都不要把 API 容器中的 `127.0.0.1` / `localhost` 当成其它容器。
:::
::: details 展开查看 Shell 命令（64 行）
```shell
version: '3.8'
services:
  microi-api:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
    container_name: microi-api
    cgroup_parent: "${MICROI_CGROUP_PARENT:-microi.slice}"
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    environment:  
      - OsClient=iTdos
      - OsClientType=Product
      - OsClientNetwork=Internal
      - OsClientDbType=MySql
      - OsClientDbConn=Data Source=172.27.221.211;Database=microi_demo;User Id=microi_demo;Password=password123456;Port=1306;Convert Zero Datetime=True;Allow Zero Datetime=True;Charset=utf8mb4;Max Pool Size=500;sslmode=None;
      - OsClientRedisHost=172.27.221.211
      - OsClientRedisPort=1379
      - OsClientRedisPwd=password123456
      - OsClientRedisDataBase=5
      - OsClientDbMongoConn=mongodb://root:password123456@172.27.221.211:17017/?authSource=admin
    ports:
      - "1000:80"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    privileged: true
    restart: always
    tty: true
    stdin_open: true

  microi-client:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-client:latest
    container_name: microi-client
    volumes:
      - /etc/localtime:/etc/localtime
      - /usr/share/fonts:/usr/share/fonts
    environment:
      - OsClient=
      - ApiBase=https://api.itdos.com
    ports:
      - "1001:80"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: always
    tty: true
    stdin_open: true

```
:::


### 平台运维中心 Microi.Ops：独立升级入口

[Watchtower 上游](https://github.com/containrrr/watchtower) 已于 **2025 年 12 月 17 日**归档，并声明不再维护。新安装不再部署 Watchtower，改由 **Microi.Ops / 吾码平台运维中心**提供 API/Web 的手动更新、定时检查、下载、维护窗口更新、状态与日志。现有 Watchtower 保留现场和启停选择，完成受管范围核对后再迁移；不能同时让两个更新器改同一个 API/Web。

Ops 是独立 .NET 10 容器，页面使用吾码 UI。即使 API/Web 正在更新或已经停止，独立登录、任务进度、本地日志仍可使用。系统引擎菜单通过 iframe 打开它，同时展示访问 URL、复制地址和新窗口链接。请将地址加入书签，反向代理也必须独立于被更新的 API/Web 容器。

#### 安装与两套登录

新版一键安装在核心平台就绪后尝试部署 Ops；安装失败会报告警告，核心平台继续运行。编排位于 `/microi/ops/docker-compose.yml`，账号和随机密码保存在 `/microi/ops/config/ops.env`（权限 600），不输出到安装日志。Ops 帐号默认名为 `opsadmin`，密码无通用默认值。已有配置不会被再次安装覆盖。

已有平台可用一次性引导生成独立编排，下面容器名适用于一键安装；手工部署须改为实际 `microi-api`、`microi-client`。API/Web 应共享用户自建 Docker 网络，域名须改为自己的实际地址。

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

默认宿主机监听为 `127.0.0.1:61880`，通过独立 HTTPS 反向代理开放访问。代理转发 `Host` 和 `X-Forwarded-Proto`；`OPS_TRUSTED_PROXY_IPS` 填 Ops 实际看到的代理 IP，多个用分号。引导默认登记共享 Docker 网络网关；代理在容器中时改用其固定 IP。`OPS_PUBLIC_URL` 与浏览器实际访问地址保持一致。示例仅放入已配置好证书的 Ops 域名 HTTPS `server` 块：

```nginx
location / {
    proxy_pass http://127.0.0.1:61880;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

在「SaaS 引擎 → 后端运行配置」填写 `MicroiOpsUrl`，更新「SaaS引擎」「系统日志/监控」「应用商城」后，从「系统引擎 → 平台运维中心」进入。入口和平台连接信息都不包含运维密码。允许嵌入的 Web Origin 填入 `OPS_ALLOWED_FRAME_ORIGINS`，以分号分隔；推荐平台与 Ops 使用同站点的不同 HTTPS 子域名。浏览器阻止跨站 iframe Cookie 时使用新窗口入口。

独立 Ops 登录成功后，可在「平台连接」再次登录吾码平台。该登录读取当前系统设置、RSA 密码公钥、`EnableCaptcha` 和隐私协议；开启验证码时显示验证码，设置读取失败时不会绕过验证。平台账号只用于必要日志回传，不取代独立运维权限。平台密码不持久保存，DiyToken 在 Ops 本地加密，解除连接后移除。

#### 目录、日志与保留策略

| 宿主机目录 | 用途 |
|---|---|
| `/microi/ops/config` | 账号、部署清单、可选私有镜像仓库凭据 |
| `/microi/ops/data` | SQLite 任务账本、待投递日志、加密凭据和密钥；须整体备份 |
| `/microi/logs/ops` | Ops TXT 文件，按 UTC 日期和 10 MiB 分卷，默认保留 30 天 |
| `/microi/logs/exports` | 指定容器标准输出的人工导出文件 |
| `/microi/compose/...` | 原平台编排及 Ops 写入的镜像摘要覆盖文件 |

`OPS_LOG_DIR` 指定 **Ops 容器内** TXT 路径，卷映射指定服务器实际目录。例如 `-v /microi/logs/ops:/microi/logs/ops` 配合 `OPS_LOG_DIR=/microi/logs/ops`。`OPS_LOG_RETENTION_DAYS` 控制 1–365 天保留期；清理只针对 Ops 自己的 TXT 和已投递旧事件，不删除待投递记录、任务账本、数据库、上传文件或其它容器卷。不要把整个 `/microi` 当成日志目录清理。

必要事件先提交 Ops 独立 SQLite，再写 TXT；平台恢复时通过 `platform-ops-event-ingest` 写入现有 **MongoDB 系统日志**。平台确认 MongoDB 持久化后才回执，稳定 EventId 防止断线重试重复写日志。在「系统日志/监控」选择「平台运维」，查询 `Category=Operations / Source=Microi.Ops`。API 需要包含新增的 `IngestOpsEvent` 原子方法；旧 API 返回升级提示时，日志仍保留在 Ops 等待补投。

所有吾码自行维护的应用日志建议放入 `/microi/logs/<组件>`，但各组件的容器内真实文件路径须按其程序配置映射。[Docker 标准输出日志](https://docs.docker.com/engine/logging/configure/)由 logging driver 管理：Ops 编排设置 `max-size=10m / max-file=3`，其它容器保持原配置并可按容量调整。不要移动 Docker data-root、直接截断 `/var/lib/docker/containers` 日志或为统一目录搬迁存量数据库卷。

#### 更新、恢复和旧 Watchtower

在线初次安装为 **检查并通知**，离线初次安装为 **仅手动**；策略保存在持久卷中，重启后不重新开启自动更新。页面还支持自动下载和维护窗口自动更新。默认每小时检查、Asia/Shanghai 02:00–05:00，支持跨午夜。引导仅给 Web 开启自动更新与兼容回退资格，API 的数据库兼容性需要管理员审查后在部署清单明确声明。

每次更新先生成固定镜像摘要的计划，拉取全部镜像后才停止旧服务；任务显示当前阶段、下载字节和可计算的预计时间。API 启动后还要通过 `platform-ops-readiness` 验证租户数据库、Redis 与 V8。单副本切换会短暂中断，未知阶段不显示假倒计时。Ops 重启会恢复同一任务，成功的相同镜像不会再升级。原来停止的容器仍保持停止，匿名卷和挂载数据保留。

成功切换会在真实 API/Web Compose 目录写入 `docker-compose.ops.yml`。新版一键安装/修复自动加载它；宝塔或手工 Compose 也必须同时加载原文件和覆盖文件，避免后续重建退回旧镜像：

```bash
docker compose -f docker-compose.yml -f docker-compose.ops.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.ops.yml up -d
```

旧容器以 `*-ops-old-<任务>` 保留，关闭自动重启。声明兼容时健康检查失败会恢复旧容器；存在数据库不兼容或外部并发改动时保留现场等待人工处理。**镜像恢复不等于数据库恢复**，Ops 不自动清库、降级数据库、更新数据库容器或清理全机旧镜像。

存量 Watchtower 只有在管理范围明确且只覆盖本次 API/Web 时，才允许通过 Ops 暂停或恢复；管理其它应用的实例须先在原编排拆分范围。恢复 Watchtower 前将 Ops 改为仅手动，暂停后同步原编排防止其它工具重建。Ops 提供吾码所需的更新能力，v1 不承诺完整兼容 Watchtower 任意 cron、钩子或通知插件，也不支持 Swarm/Kubernetes/多主机。

Ops 自身更新使用宿主机上独立 Compose，不能在正在运行的控制器内自行替换自己。若 Ops 也无法使用，先确认无活动任务并停止该控制器，再执行命令行一键修复；主机或 Docker 守护进程故障仍须通过 SSH/服务器面板处理。Ops 拥有 Docker socket 管理权限，仅向主机运维管理员开放，不向普通平台用户和可编辑 V8 暴露通用 Docker 命令。

#### 大文件上传的 nginx 反向代理配置

SaaS 引擎中的“单文件上限 MB”和“单次总量上限 MB”只在请求进入吾码 API 后生效，不能放大 nginx 的请求体上限。普通上传默认允许 500 MB，可在 SaaS 引擎系统设置中调整为 1024 MB 或 2048 MB；若 nginx 先返回 `413 Content Too Large`，请在 **API 域名对应的 `server` 块**中配置相匹配的请求体上限。下面示例覆盖平台 2 GB 硬顶并为 multipart 封装留出余量。`proxy_*` 指令可以放在 `server` 层由真实代理 `location` 继承；如果 `location` 或宝塔 `include` 中重复配置，以更近层级的值为准，必须确认没有重新开启请求缓冲或缩短超时：

```nginx
server {
  # 支持平台2GB硬顶，并为multipart封装留出余量；禁止配置为0取消保护
  client_max_body_size 2112m;

  # 慢速大文件上传：这是两次读取请求体数据之间的超时，不是整个上传总时长
  client_body_timeout 600s;

  # 大文件直接流式转发给吾码API，避免nginx先把整个请求体落到代理临时目录
  proxy_request_buffering off;

  # HTTP/1.1可避免分块请求在关闭request buffering后仍被强制缓冲
  proxy_http_version 1.1;
  proxy_connect_timeout 60s;
  proxy_send_timeout 600s;
  proxy_read_timeout 600s;

  error_page 413 = @microi_upload_too_large;
  location @microi_upload_too_large {
      default_type application/json;
      charset utf-8;
      add_header Cache-Control "no-store" always;
      # 若Web与API跨域，必须在这里显式复用正常API代理的CORS白名单/include。
      # 请求已被nginx拒绝，不会进入ASP.NET Core，因此不能依赖后端补CORS响应头。
      return 200 '{"Code":0,"Data":null,"Msg":"上传请求超过了反向代理允许的最大容量。SaaS引擎中的上传额度不能放大nginx或API启动级上限，请联系运维同步提高client_max_body_size以及吾码API请求体上限。","DataAppend":{"ErrorType":"UploadRequestTooLarge","Layer":"ReverseProxy"}}';
  }
}
```

吾码 API 已内置统一的 2048 MB HTTP/Multipart 接收硬顶，不需要再为上传大小增加额外环境变量；真正的单文件、单次文件数、单次总量及帐号/租户日额度统一在 SaaS 引擎中配置。`proxy_request_buffering off` 只关闭 nginx 的请求体预缓冲，不代表绕过吾码 API 的 Multipart、权限、配额和 HDFS 校验，也不能用响应方向的 `proxy_buffering off` 代替。

“创建 SaaS 租户”的数据库 ZIP 使用专用断点续传协议，不再把整个文件提交给 `/api/HDFS/UniappUpload`：

- 浏览器默认按 16 MB 分片上传；服务端单片最多 32 MB，请求接收上限 64 MB。每片都会校验 SHA-256 并持久记录，刷新页面或网络中断后，重新选择同一文件只补传服务器缺失分片。
- 合并完成后再次校验整包 SHA-256，并流式解压、读取和执行 SQL，不把 2 GB ZIP 或解压后的 SQL 整体载入内存。连续 `INSERT` / `REPLACE` 按最多 500 条或 1 MB 合并为一个事务批次，避免几十万次独立往返和提交。
- 后台任务显示 ZIP/SQL 已读取量、批次数、已执行语句数、平均吞吐和动态预计剩余时间。当前状态最多每 2 秒或每增加 16 MB 更新一次；执行记录只在阶段变化或 SQL 进度跨越 5% 时追加，并受日志总长上限约束，不会按每行数据推送到浏览器。

因此，即使代理仍保留 100 MB 请求体限制，数据库 ZIP 也能上传至当前租户配置额度；CDN/WAF 仍需允许 64 MB 请求并提供足够的单片空闲超时。

修改后先执行 `nginx -t`，确认成功再 reload nginx。若仍返回原生 413 HTML，请继续检查宝塔生成的全局配置和 `include` 文件中是否存在更小的 `client_max_body_size`；若大文件上传到固定时长后中断，则继续检查 CDN、WAF、负载均衡、Ingress 及宝塔上游是否还有独立的请求体或空闲超时限制。

#### HTTPS 必须配置完整证书链

API 域名的 nginx `ssl_certificate` 必须指向包含“站点证书 + 中间证书”的 `fullchain.pem`，不能只配置单张叶子证书。浏览器可能通过系统缓存或 AIA 自动补齐中间证书，看起来访问正常，但 Node.js、MCP、容器任务和部分移动端会严格按服务器实际发送的证书链校验，并报 `unable to verify the first certificate`。这类错误与吾码 Token、OsClient 或接口权限无关。

```nginx
server {
  listen 443 ssl http2;
  server_name api.example.com;

  # 必须是站点证书在前、中间证书在后的完整链文件
  ssl_certificate     /www/server/panel/vhost/cert/api.example.com/fullchain.pem;
  ssl_certificate_key /www/server/panel/vhost/cert/api.example.com/privkey.pem;
}
```

修改后先执行 `nginx -t`，成功后 reload，再从一台没有浏览器证书缓存的机器验证服务器确实发送完整链：

```bash
openssl s_client -connect api.example.com:443 -servername api.example.com -showcerts </dev/null
```

输出末尾应为 `Verify return code: 0 (ok)`，并能看到站点证书和中间证书；若仍为 `unable to get local issuer certificate`，应在 nginx/宝塔证书配置中修复 `fullchain.pem`，不要在吾码、MCP 或 Node.js 中关闭 TLS 校验。首次一键安装后的正式验收应同时检查 Web 与 API 域名的证书链。

#### ESA 自定义域名：记录创建后还要验收真实 HTTPS

SaaS 开通流程自动创建阿里云 ESA CNAME 后，控制面回读成功只表示记录和代理配置已经写入，不表示公网用户已经能够访问。安装或开库验收必须继续执行数据面检查：从源站网络之外访问租户 HTTPS 域名，确认 DNS 已进入 ESA、回源 Host/SNI 正确、证书链有效，并得到真实的非 5xx 响应；CNAME 存在、ESA 控制台显示启用、TCP 能连接或源站本机返回 200，都不能单独标记为 Ready。

如果页面返回 `HTTP 522`，含义是 ESA 节点与源站建立连接超时，不是 DNS 记录创建失败。请依次检查：

1. 在 ESA【安全防护 → 源站防护】分别取得当前生效和最新待启用的 IPv4/IPv6 CIDR 清单，计算 `最新 - 当前` 差集。先将差集加入所有白名单并暂时保留两份清单的并集，再在 ESA 确认启用最新清单；不要先删除当前清单，也不要在本文硬编码会变化的 IP 段。
2. 将 ESA 回源 CIDR 加入 ECS 安全组入方向、阿里云云防火墙、宝塔/第三方安全软件和主机 `firewalld` / `nftables` / `iptables` / `ufw`。源站经 HTTP 跳转并使用 HTTPS 回源时，TCP 80、443 都要允许；若只使用一个端口，ESA 配置必须完全一致。使用云防火墙联动时开启 ESA“自动启用最新回源 IP 列表”，同时人工核对其它非联动层。
3. 在源站执行监听检查，并用真实源站域名和 SNI 绕过 ESA 验证源站；源站地址不能再指向另一个 ESA 加速域名：

```bash
ss -lntp | grep -E ':(80|443)\b'
curl -sS -o /dev/null -w '%{http_code}\n' --resolve origin.example.com:443:203.0.113.10 https://origin.example.com/
```

4. HTTPS 源站的 nginx 必须使用上一节所示 `fullchain.pem`。边缘证书可用不代表回源证书链完整；继续使用 `openssl s_client -connect origin.example.com:443 -servername origin.example.com -showcerts` 验证源站发送的完整链。
5. 放行和证书修复后，从公网执行真实 GET，而不是只做 DNS/TCP 探测。仅当状态码为非 5xx、响应内容属于目标租户，且源站日志能看到 ESA 回源请求时，才将域名标记为 Ready。动态 IP 清单与错误定义以阿里云当前的 [ESA 源站防护](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/origin-protection) 和 [522 源站连接超时](https://help.aliyun.com/zh/edge-security-acceleration/esa/support/522-error-origin-connection-timeout) 文档为准。

如果数据库导入、`sys_osclients` 唯一租户记录、按 `OsClient` 的 API 登录和系统设置回读均已成功，应保留已创建租户及其后台任务记录，只修复 DNS、ESA、防火墙、反向代理或证书链。522、证书错误和 DNS 传播中都不是删除租户、重复导入大数据库的依据。SaaS 控制面与数据面状态定义详见 [SaaS 引擎](../system-engine/saas-engine)。


---

### 7️⃣ PaddleX / PaddleOCR 文字识别服务编排（默认安装）

Microi API 内置统一 OCR 网关，模型推理由独立的 PaddleX 服务承载。一键安装使用吾码杭州镜像源中的固定版本 `PaddleX 3.6.1 + PaddlePaddle 3.2.2` CPU 镜像，并已在发布镜像阶段预置默认 OCR 产线模型。PaddlePaddle 3.3.0 当前存在 CPU oneDNN PIR 推理兼容问题，请勿自行替换为 3.3.0。因此服务器只需拉取一个经过固定版本验证的镜像，不再现场安装 Python 依赖或重新下载模型。

:::: tip 一键安装会自动完成
一键安装会先部署并验收数据库、Redis、MongoDB、MinIO、API 与 Web，确认 API liveness、完整 `ServerVersion` 升级链和 readiness 后，再尝试创建 `microi-install-ocr` 独立编排并等待容器进入 `healthy`。OCR 健康后，脚本回读 API Upgrade29 创建的 9 个物理字段，每秒一次、最多 15 秒；只有全部字段、唯一主租户和写入后回读都通过，才设置 `OcrEnabled=1` 与正确内网地址并重启 API 使配置生效。脚本不会绕过 Upgrade29 直接伪造元数据。OCR 镜像拉取、架构、内部网络、容器健康或 SaaS 配置失败时，会保留容器与日志、明确显示“OCR 未启用”，但核心平台继续运行，最终命令仍以核心平台安装成功结束并列出附加能力警告。
::::

当前公开基线为 `linux/amd64`。建议整机至少 4 核 16 GB 内存，并根据真实图片尺寸、PDF 页数及并发压测调整；ARM64 主机会自动跳过这项附加能力而继续安装核心平台。ARM64 或 GPU 服务器如需 OCR，应使用仓库 Dockerfile/官方 Paddle 镜像构建对应架构版本，不要强行运行 amd64 CPU 镜像。

手动部署可使用以下 Compose：

:::: details 展开查看 OCR 编排
```yaml
name: microi-ocr

services:
  microi-ocr:
    image: registry.cn-hangzhou.aliyuncs.com/microios/paddlex-ocr:3.6.1-paddle3.2.2-cpu
    container_name: microi-ocr
    init: true
    restart: unless-stopped
    ports:
      # 仅允许宿主机访问；不要直接暴露到公网。
      - "127.0.0.1:18080:8080"
    shm_size: "4gb"
    stop_grace_period: 90s
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    volumes:
      - microi-ocr-models:/home/microi/.paddlex
    healthcheck:
      test: ["CMD", "python", "-c", "import socket; s=socket.create_connection(('127.0.0.1',8080),3); s.close()"]
      interval: 30s
      timeout: 5s
      retries: 10
      start_period: 10m
    logging:
      driver: json-file
      options:
        max-size: 20m
        max-file: "3"
    networks:
      - microi-ocr

volumes:
  microi-ocr-models:
    name: microi-ocr-models

networks:
  microi-ocr:
    name: microi-ocr
    driver: bridge
```
::::

启动并检查健康状态：

```bash
docker compose up -d
docker compose ps
docker inspect microi-ocr --format '{{.State.Health.Status}}'
```

如果 Microi API 也在 Docker 中，把 API 服务加入同一个 external 网络：

```yaml
services:
  microi-api:
    image: registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest
    cgroup_parent: "${MICROI_CGROUP_PARENT:-microi.slice}"
    networks:
      - microi-ocr

networks:
  microi-ocr:
    external: true
    name: microi-ocr
```

随后在 `SaaS引擎 → OCR识别` 设置：`OcrEnabled=1`、`OcrProvider=PaddleX`、`OcrEndpoint=http://microi-ocr:8080/ocr`、`OcrTimeoutSeconds=120`、`OcrMaxFileMB=20`、`OcrMaxPages=10`、`OcrMinConfidence=0`。若 API 运行在宿主机，则端点改为 `http://127.0.0.1:18080/ocr`。`OcrApiKey` 和 `OcrHeadersJson` 仅在接入自建鉴权代理时配置，不应写进 V8 脚本。

V8 接口引擎通过租户绑定网关调用，不直接接触 OCR 地址或密钥：

```javascript
var result = await V8.OCR.Recognize({
  FileByteBase64: V8.FilesByteBase64.invoice,
  FileName: 'invoice.png',
  TextRecScoreThresh: 0.5,
  ReturnWordBox: false
});
return result;
```

完整参数、PDF/图片格式、统一返回结构与安全边界见 [V8.OCR 官方文档](/doc/v8-engine/v8-server.html#v8-ocr)。PaddleX 的基础服务接口为 `POST /ocr`，官方服务化方式及协议可参考 [PaddleX Serving 文档](https://www.paddleocr.ai/main/en/version3.x/inference_deployment/serving/serving.html)。

---

### 8️⃣ LibreTranslate 开源翻译服务编排（默认安装）

LibreTranslate 用于动态内容翻译，不影响 `diy_lang` 固定界面词条。加载的语言越多，首次下载模型的时间和磁盘占用越大，因此建议从基础套餐开始：

| 套餐 | 语言 |
| ---- | ---- |
| 1（推荐） | 简体中文 `zh`、繁体中文 `zt`、英语 `en` |
| 2 | 套餐 1 + 日语 `ja`、韩语 `ko`、越南语 `vi`、泰语 `th`、印度尼西亚语 `id`、马来语 `ms`、菲律宾语 `tl` |
| 3 | 全部支持语言 |

全部可选语言如下：

| 中文名 | Key | 中文名 | Key | 中文名 | Key |
| ---- | ---- | ---- | ---- | ---- | ---- |
| 简体中文 | `zh` | 繁体中文 | `zt` | 英语 | `en` |
| 日语 | `ja` | 韩语 | `ko` | 越南语 | `vi` |
| 泰语 | `th` | 印度尼西亚语 | `id` | 马来语 | `ms` |
| 菲律宾语 | `tl` | 印地语 | `hi` | 乌尔都语 | `ur` |
| 阿拉伯语 | `ar` | 俄语 | `ru` | 德语 | `de` |
| 法语 | `fr` | 西班牙语 | `es` | 葡萄牙语 | `pt` |
| 意大利语 | `it` | 荷兰语 | `nl` | 土耳其语 | `tr` |
| 波兰语 | `pl` | 乌克兰语 | `uk` |  |  |

一键安装脚本默认尝试安装 LibreTranslate：安装选择直接按 Enter 等同于 `1`，语言套餐直接按 Enter 等同于基础套餐 `1`（简体中文、繁体中文、英语）。因此用户一路按 Enter 就会使用吾码官方推荐组合；明确不安装时在第一处提示输入 `0`。选择安装后仍可改选套餐 2/3 或输入额外语言 Key。核心平台通过 liveness、完整升级链与 readiness 后，脚本再分配只绑定 `127.0.0.1` 的诊断端口、生成并回读随机 API Key 数据库、启动翻译容器，并回读 Upgrade31 的 4 个翻译物理字段，每秒一次、最多 15 秒。字段齐全后脚本才通过内部 Docker 地址写入唯一主租户并回读验证，兼容没有 `TranslateProvider` 等新列的旧恢复库，且不会绕过 Upgrade31 直接伪造元数据。

字段前置迁移完成不等于整条平台升级链成功，因此一键安装会在部署 LibreTranslate 前先回读 `sys_config.ServerVersion` 至少达到脚本要求的版本。核心升级链或 API readiness 失败时仍会明确停止并返回非零；LibreTranslate 镜像、Key 初始化、容器运行、Upgrade31 字段或配置回读失败时，只会保留现场并把翻译能力标记为未启用，不会删除数据、回滚或中断已经可用的核心平台。只有至少一项附加能力配置成功回读时才重启 API；没有成功配置时保持现有 API 运行状态。

手动部署时可使用项目中的 `数据库、案例、文档、资料/docker-compose.libretranslate.yml`，并根据服务器修改宿主机目录、端口、`LT_LOAD_ONLY` 和 API Key。由于 Docker Compose 可能把全中文目录名归一化为空项目名，建议复制到 ASCII 目录，并始终显式指定项目名：

```bash
mkdir -p /microi/compose/libretranslate
cp "数据库、案例、文档、资料/docker-compose.libretranslate.yml" /microi/compose/libretranslate/docker-compose.yml
cd /microi/compose/libretranslate
docker compose -p microi-libretranslate up -d
```

如果直接在源码目录运行，也必须使用 `docker compose -p microi-libretranslate -f "数据库、案例、文档、资料/docker-compose.libretranslate.yml" up -d`。正式使用前请替换示例 API Key；不要把 LibreTranslate 端口直接暴露到公网。一键安装脚本会在容器启动前独立生成并回读 Key 数据库，让语言模型后台初始化，不会用 LibreTranslate 自带的“booting 即 healthy”检查冒充 HTTP 已就绪。

下面是适用于 `/microi` 目录的等价编排：

:::: details 展开查看 LibreTranslate 编排
```yaml
services:
  microi-translate:
    image: registry.cn-hangzhou.aliyuncs.com/microios/libretranslate:1.9.6-microi1
    container_name: microi-translate
    user: "0:0"
    security_opt:
      - apparmor=unconfined
    volumes:
      - /microi/libretranslate/models:/home/libretranslate/.local
      - /microi/libretranslate/api-keys:/app/db
    environment:
      - LT_UPDATE_MODELS=true
      # 基础套餐；按上表追加语言 Key。加载全部语言会显著增加首次下载时间。
      - LT_LOAD_ONLY=zh,zt,en
      - LT_API_KEYS=true
      - LT_API_KEYS_DB_PATH=/app/db/api_keys.db
      # 仅用于首次向 LibreTranslate 注册密钥；请替换为随机强密钥。
      - LT_BOOTSTRAP_API_KEY=replace-with-a-random-strong-key
      - LT_WORKERS=1
      - LT_TIMEOUT=120
    entrypoint: /bin/sh
    command: >
      -lc "set -e;
      ./scripts/entrypoint.sh &
      (
        for i in $$(seq 1 90); do
          if [ -f \"$${LT_API_KEYS_DB_PATH:-/app/db/api_keys.db}\" ]; then
            ltmanage keys --api-keys-db-path \"$${LT_API_KEYS_DB_PATH:-/app/db/api_keys.db}\" add 1000000 --key \"$${LT_BOOTSTRAP_API_KEY}\" || true;
            break;
          fi;
          sleep 2;
        done
      ) &
      wait"
    ports:
      - "1469:5000"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "10"
    restart: unless-stopped
    tty: true
    stdin_open: true
```
::::

Microi API 不需要增加翻译环境变量。请在 SaaS 引擎主租户记录中设置 `TranslateProvider=LibreTranslate`、`TranslateUrl=http://宿主机IP:1469`、`TranslateApiKey=与上面一致的随机强密钥`、`TranslateTimeout=120`；保存后由 SaaS 引擎刷新共享 Redis 配置。一键安装脚本会自动写入并回读验证这些字段。

---

### 9️⃣ Ollama 编排（不推荐，仅兼容特殊场景）

:::: warning 新装环境请跳过本节
Microi 默认 NL2SQL/NL2V8/在线 AI 数据分析已经由内置的关键词扩展、权限感知 Schema/Skill 搜索和精确字段回读完整承接，不再推荐部署 Ollama、`nomic-embed-text` 与 Qdrant。仅当已有系统必须兼容旧向量链路，或独立召回评测证明内置能力无法满足特殊语义检索时，才同时部署本节和下一节。

如确需在同一宿主机部署 Ollama 与 Qdrant，它们也不加入 API + 主数据库的 `cgroup_parent`，本方案不会为它们新增 Docker CPU / 内存硬限制。模型加载仍可能挤压整机资源，生产环境更建议使用独立服务器，或由运维人员根据实际模型单独规划资源。
::::

>* Docker会自动创建所需的数据目录，无需手动创建
>* 通过docker编排部署
::: details 展开查看 Shell 命令（50 行）
```shell
version: '3.8'
services:
  # Ollama AI 服务（使用阿里云镜像加速）
  microi-ollama:
    image: registry.cn-hangzhou.aliyuncs.com/microios/ollama:latest  # 使用阿里云镜像，也可使用日期版本如 :20260129
    container_name: microi-ollama
    ports:
      - "1434:11434"  # 如需修改端口，直接改这里，如 "8080:11434"
    volumes:
      - /microi/ollama/data:/root/.ollama  # 持久化模型数据（统一存储在/microi目录下）
    restart: always  # 开机自动启动
    environment:
      - OLLAMA_HOST=0.0.0.0:11434
    healthcheck:
      test: ["CMD", "/bin/sh", "-c", "ollama list || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - microi-ollama-network

networks:
  microi-ollama-network:
    driver: bridge

# =====================================================
# Microi.net 专用 Ollama + DeepSeek 部署方案
# 使用阿里云镜像加速
# =====================================================
#
# 【验证部署】
#   curl http://localhost:1434/api/tags
#   docker exec microi-ollama ollama list
#
# 【测试AI对话】
#   curl http://localhost:1434/v1/chat/completions \
#     -H "Content-Type: application/json" \
#     -d '{
#       "model": "deepseek-r1:1.5b",
#       "messages": [{"role": "user", "content": "你好"}]
#     }'
#
# 【下载其他模型】
#   docker exec microi-ollama ollama pull deepseek-r1:7b # 下载7B模型
#   docker exec microi-ollama ollama pull deepseek-coder:1.3b # 下载Coder模型
#   docker exec microi-ollama ollama pull deepseek-coder:6.7b # 下载Coder 6.7B模型
#   docker logs -f microi-ollama # 查看下载进度
#   docker exec microi-ollama ollama list # 查看已安装模型
# =====================================================
```
:::

>* 拉取 nomic-embed-text 模型（当前 Microi Ollama HTTP 向量链路使用 768 维，用于中英文文本）
```shell
docker exec microi-ollama ollama pull nomic-embed-text
```

>* 测试API
```
curl http://localhost:1434/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "input": "测试"}'
```

### 🔟 Qdrant 向量数据库编排（不推荐，仅兼容特殊场景）
::: details 展开查看 Shell 命令（86 行）
```shell
version: '3.8'
services:
  # Qdrant向量数据库服务
  microi-qdrant:
    image: registry.cn-hangzhou.aliyuncs.com/microios/qdrant:latest
    container_name: microi-qdrant
    restart: unless-stopped
    
    # 端口映射
    ports:
      - "1333:6333"      # HTTP API端口
      - "1334:6334"      # gRPC端口（可选，高性能场景）
      
    # 数据卷挂载（持久化存储）
    volumes:
      - /microi/qdrant/storage:/qdrant/storage          # 主存储目录
      - /microi/qdrant/snapshots:/qdrant/snapshots      # 快照目录
      - /microi/qdrant/config:/qdrant/config            # 配置文件目录（可选）

    # 环境变量配置（所有优化配置）
    environment:
      # 安全配置（生产环境建议启用）
      - QDRANT__SERVICE__API_KEY=password123456         # API密钥（取消注释后启用）
      - QDRANT__SERVICE__ENABLE_TLS=false               # TLS加密（本地部署可关闭）

      # 核心配置
      - QDRANT__SERVICE__HTTP_PORT=6333
      - QDRANT__SERVICE__GRPC_PORT=6334
      
      # 性能优化配置
      - QDRANT__STORAGE__PERFORMANCE__MAX_SEARCH_THREADS=4          # 搜索线程数
      - QDRANT__STORAGE__PERFORMANCE__MAX_OPTIMIZATION_THREADS=2    # 优化线程数
      - QDRANT__STORAGE__PERFORMANCE__UPDATE_QUEUE_SIZE=100         # 更新队列大小
      
      # HNSW索引优化（提升搜索速度）
      - QDRANT__STORAGE__HNSW_INDEX__M=16                           # HNSW图的连接数（默认16）
      - QDRANT__STORAGE__HNSW_INDEX__EF_CONSTRUCT=100               # 构建时的搜索深度（默认100）
      
      # 内存优化
      - QDRANT__STORAGE__ON_DISK_PAYLOAD=true                       # 将Payload存储到磁盘（节省内存）
      - QDRANT__STORAGE__MMAP_THRESHOLD_KB=102400                   # 100MB以上使用mmap（减少内存占用）
      
      # 持久化与恢复
      - QDRANT__STORAGE__WAL__WAL_CAPACITY_MB=32                    # WAL日志容量（MB）
      - QDRANT__STORAGE__WAL__WAL_SEGMENTS_AHEAD=0                  # 提前创建WAL段数
      - QDRANT__STORAGE__SNAPSHOT_PATH=/qdrant/snapshots            # 快照路径
      
      # 日志配置
      - QDRANT__LOG_LEVEL=INFO                                      # 日志级别: TRACE, DEBUG, INFO, WARN, ERROR
      
      # 集群配置（单机部署可忽略）
      - QDRANT__CLUSTER__ENABLED=false                              # 是否启用集群模式
      
      # 资源限制（防止OOM）
      - QDRANT__STORAGE__OPTIMIZERS__MEMMAP_THRESHOLD_KB=102400     # mmap阈值
      - QDRANT__STORAGE__OPTIMIZERS__INDEXING_THRESHOLD_KB=20480    # 索引阈值（20MB）
        
    # 健康检查（可选，如不需要可删除）
    # 作用：监控服务状态，自动重启失败的容器
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    # 网络配置
    networks:
      - microi-qdrant-network
    
    # 标签（便于管理）
    labels:
      - "com.microi.service=qdrant"
      - "com.microi.description=Qdrant Vector Database for AI"
      - "com.microi.version=1.0"

# 网络定义
networks:
  microi-qdrant-network:
    driver: bridge  # 简单桥接网络，无需固定IP

# http://localhost:1333/healthz # 健康检查接口
# 管理界面: http://localhost:1333/dashboard
# 检查向量数据是否已初始化：
# http://localhost:1333/collections/microi_schema
# 查看 points_count 是否>0
```
:::

---

## 💻 本地 Docker 环境

### 1️⃣ 本地安装 Docker Desktop

- 下载地址：[Docker Desktop](https://docs.docker.com/get-started/get-docker/)

::: warning Windows 用户注意
需要 **Windows 专业版**及以上，不支持 Windows 家庭版。
:::

---

### 2️⃣ 本地打包并上传 Docker 镜像 - 后端

- 容器镜像服务可使用阿里云免费服务：[阿里云容器镜像服务](https://cr.console.aliyun.com/cn-hangzhou/instances)
- 也可自行搭建 [Harbor](https://goharbor.io/) 容器镜像服务
- 编译打包到 `/Microi.net.Api/bin/Release/net8.0/`

在 `/Microi.net.Api/bin/Release/` 处创建 `Dockerfile`：
```powershell
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
MAINTAINER iTdos
LABEL description="iTdos"
COPY net8.0/ /app
WORKDIR /app
EXPOSE 80
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
RUN echo 'Asia/Shanghai' >/etc/timezone
CMD ["dotnet", "Microi.net.Api.dll", "--urls", "http://0.0.0.0:80"]
```
在同目录创建 `publish.sh`（Windows 为 `publish.bat`）：
```powershell
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-api .
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:latest
docker tag microi-api registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-api:$version
```
在 cmd 中执行 `publish.sh` 或 `publish.bat`。

---

### 3️⃣ 本地打包并上传 Docker 镜像 - 前端

- 默认使用 `npm run build` 打包现代版前端（Chrome / Edge 107+、Firefox 104+、Safari 16+）
- 只有明确需要兼容 Chrome 49 的存量客户才使用 `npm run build:legacy`；它会额外生成 legacy 包，显著增加构建时间和产物体积，且交付前必须在客户真实旧浏览器上验证
- 在打包输出目录创建 `Dockerfile`：
```powershell
#Vue2
FROM registry.cn-hangzhou.aliyuncs.com/acs-sample/nginx
COPY dist/  /usr/share/nginx/html/
COPY default.conf /etc/nginx/conf.d/default.conf
CMD ["/bin/bash", "-c", "sed -i \"s@var OsClient = '';@var OsClient = '$OsClient';@;s@var ApiBase = '';@var ApiBase = '$ApiBase';@\" /usr/share/nginx/html/index.html; nginx -g \"daemon off;\""]

#Vue3
FROM registry.cn-hangzhou.aliyuncs.com/acs-sample/nginx
COPY dist/  /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf
RUN chmod -R 755 /usr/share/nginx/html
CMD ["/bin/bash", "-c", "sed -i \"s@window.OsClient = '';@window.OsClient = '$OsClient';@;s@window.ApiBase = '';@window.ApiBase = '$ApiBase';@;s@window.ApiCustom = '';@window.ApiCustom = '$ApiCustom';@\" /usr/share/nginx/html/index.html && nginx -g \"daemon off;\""]
```
在同目录创建 `publish.sh`（Windows 为 `publish.bat`）：
```powershell
echo "请输入本次要发布的api版本号："
read version
docker login --username=镜像服务帐号 --password=镜像服务帐号密码 registry.cn-地域.aliyuncs.com
docker build -t microi-os .
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:latest
docker tag microi-os registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
docker push registry.cn-地域.aliyuncs.com/命名空间/microi-os:$version
```
在同目录创建 `default.conf`：
```json
server {
	listen	0.0.0.0:80;
	#server_name	127.0.0.1 localhost;
	root	/usr/share/nginx/html;
	index	index.html;
	location / {
		try_files $uri $uri/ /index.html;
		add_header Access-Control-Allow-Origin '*';
		# 允许所有内容类型
		if (-f $request_filename) {
			break;
		}
	}
	location = / {
		add_header Access-Control-Allow-Origin '*';
	}
}
```
在 cmd 中执行 `publish.sh` 或 `publish.bat`。

---

### 5️⃣ 登录 Docker 容器镜像服务
```powershell
docker login --username=帐号 --password=密码 registry.cn-地域.aliyuncs.com
```

---

## 🛠️ 服务器安装 Docker 环境

可通过 Linux 命令安装，也可通过宝塔、1Panel 等面板工具安装：
```powershell
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl start docker
systemctl enable docker.service
```

---

## 📝 Docker 常用命令
::: details 展开查看 powershell 代码（42 行）
```powershell
# Docker 标准输出通过 logging.max-size / max-file 控制轮转。
# 导出一个明确指定的吾码容器日志，不直接修改 Docker 内部日志文件。
mkdir -p /microi/logs/exports
docker logs --since 24h --timestamps microi-api > /microi/logs/exports/microi-api.txt 2>&1

#docker restart 容器名称/容器Id  //重启docker
#docker stop 容器名称/容器Id  //停止docker
#docker rm -f 容器名称/容器Id  //强制删除docker
#docker inspect 容器名称/容器Id //查看容器信息
#docker exec -it 容器Id bash //进入容器
进入docker容器后使用vim：
#apt-get update
#apt-get install -y vim
#vim xxxx.json
按键i开始编辑，按键ESC后输入:wq保存并退出

cd /
# 查看空间占用
du -h --max-depth=1 | sort -h
# 看哪个目录占用空间大
du -s * | sort -rn
# 查找大文件（超过100M）
find / -size +100M -exec ls -lh {}
# 根据情况进行移动或者卸载，
# 软件包可以rpm –e卸载，
# 文件可以使用rm -rf dir删除；
# 常用命令
ls -lh
# 显示当前目录
pwd
# 显示当前目录所有文件的体积，以M为单位，正序排，不显示文件夹
find . -maxdepth 1 -type f -exec du -m {} \; | sort -n
# 清理docker悬空镜像
docker image prune -a -f
# 清理docker无用的卷
docker image prune -a -f
# 清理docker构建缓存
docker image prune -a -f

```
:::

---

## ⚙️ MySQL 注意事项

::: tip 核心要点
- 建议使用宝塔、1Panel 等服务器面板工具原生安装 MySQL
- 安装成功后，一定要根据服务器实际配置设置 MySQL 的性能配置
- **必须设置**：`lower_case_table_names = 1`
- 还原数据库前，若旧库不为空，请先删除并重新创建数据库
:::

::: danger Ubuntu 24 + MySQL 8.0
使用宝塔在 Ubuntu 24 上原生安装的 MySQL 8.0，可能遇到修改 3306 端口后无法启动的问题。
:::

::: warning 宝塔 MySQL 5.7 性能调整缺陷
宝塔的 MySQL 5.7 性能调整存在缺陷，例如优化方案选择 48-64GB 时，`table_open_cache=4096` 但 `table_definition_cache` 只有 400，可能出现 `1615 - Prepared statement needs to be re-prepared` 错误。

**解决方案：** 在配置文件中添加 `table_definition_cache = 2000`（可为 `table_open_cache` 值的一半或 75%）。临时方案：`SET GLOBAL table_definition_cache = 2000;`
:::

::: warning Navicat 数据传输报错
若报错 `Incorrect datetime value: '0000-00-00 00:00:00'`，先查询 `SELECT @@GLOBAL.sql_mode;`，然后删除 `NO_ZERO_DATE` 和 `NO_ZERO_IN_DATE`：
:::
```json
[mysqld]
sql_mode = ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
```

::: warning 还原数据库报错
若报错 `Dumping data for table [SQL] Process terminated`，需增加配置：
:::
```json
[mysqld]
max_allowed_packet = 512M
net_buffer_length = 16384
```

**宝塔安装后 root 无法外网登录？** 在服务器执行以下命令开放（项目上线后为了安全性可关闭防火墙 MySQL 端口）：
```sql
mysql -u root -p
show databases;
use mysql;
select host,user from user;
update user set host='%' where user='root';
flush privileges;
```
**MySQL 问题排查常用 SQL：**
```sql
-- 查看当前连接数和使用情况
SHOW STATUS LIKE 'Threads_connected';
-- 查看连接详细
SHOW PROCESSLIST;
-- 查看连接来源
SELECT user, host, db, command, time, state, info 
FROM information_schema.processlist 
WHERE command != 'Sleep';
-- 查看连接历史峰值
SHOW STATUS LIKE 'Max_used_connections';
```

---

## 📦 Redis 注意事项
```cmd
//检查Redis运行状态
docker exec -it redis容器名称 redis-cli -a 'redis密码' info stats

//监控Redis性能
docker exec -it redis容器名称 redis-cli -a 'redis密码' monitor
//监控原生安装的redis
redis-cli -p 3306 -a 'redis密码' monitor

//检查连接数
docker exec -it redis容器名称 redis-cli -a 'redis密码' info clients
```

---

## 📂 MinIO 注意事项

::: danger 反向代理必须配置
MinIO 在做反向代理时，必须设置 `proxy_set_header Host $http_host`，否则会导致私有桶只能上传无法下载。阿里云 OSS、CDN、负载均衡默认配置不会有此问题。
:::
