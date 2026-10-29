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
| 安全防护 | 密码错误计数、IP 封禁、白名单、自动与手动解封，以及各服务实际接入状态；需要配套主机防护服务 |
| 磁盘与安全清理 | 2.0.2 提供宿主独立监测、默认安全回收、候选/保护原因、策略修改、容量拦截和真实回执 |
| 插件市场 | 选择服务及版本，配置独立端口和数据卷；安装、启动、停止、重启、查看日志和卸载 |
| 网站 | Docker Nginx 的静态网站、域名、路径反向代理、请求体大小、超时和 HTTPS；2.0.2 提供已有宝塔 Nginx / 1Panel OpenResty 网站管理 |
| 证书 | 导入 PEM 证书与私钥，验证私钥匹配和域名 SAN；HTTP-01 自动申请、续期与暂停 |
| 文件 | 网站文件上传、下载、UTF-8 编辑、目录创建、回收和历史版本恢复 |
| 备份 | 服务停机冷备份、完整性校验、下载、新数据卷恢复和显式删除备份 |
| 计划任务 | 按间隔执行冷备份或服务重启，记录下次执行时间及每次结果 |
| 操作记录 | 幂等任务、错误原因、同一任务重试与重启后的进度恢复 |
| 吾码平台 | 原 Microi.Ops 的 API/Web 更新策略、维护窗口、平台连接及运维日志回传 |

适合单台 Linux Docker 主机上部署吾码平台、静态站点和已有应用的 HTTP 服务。当前不提供通用 SSH 终端、任意宿主机文件编辑、PHP 运行环境、邮件服务器、数据库在线 SQL 管理器、主机防火墙编辑或 Kubernetes/Swarm 管理；需要这些功能时继续使用专用工具。已有第三方服务先只读发现，写操作只作用于明确登记归属或显式接入管理的对象。

## 密码防暴力破解

::: tip v2.0.2 稳定版
已完成冻结版本的 1011 项自动检查，包括真实 Linux、两种安装顺序、原生网站及重启后的自动续期。
实测环境为 Ubuntu 24.04 / Docker 29.1.3、宝塔 13.1.0（Nginx 1.30.6）、1Panel 2.4.1（OpenResty 1.31.8.1-2-1-noble）。
证书测试使用真实独立测试 CA；公网 Let's Encrypt 签发及客户现场升级须在对应服务器另行验收。
:::

本节适用于携带 `io.microi.panel.authguard.protocol=1` 的面板镜像及配套
`microi-auth-guard` 主机服务。旧 `v2.0.0` 镜像不因更新网页或安装脚本而自动具有此能力。
交付时分别核验镜像、主机服务和「安全防护」中的实际回执。

### 默认策略与解封

| 设置 | 默认值 | 含义 |
| --- | --- | --- |
| 自动防护 | 开启 | 采集已接入服务的真实认证失败，并执行 IP 封禁 |
| 错误次数 | 3 次 | 同一来源 IP 跨已接入服务累计，不按用户名分别计算 |
| 自动解封 | 24 小时 | 从达到阈值时开始计算，解封后清零本轮计数 |
| 统计窗口 | 0 分钟 | 累计至解封；成功登录不清零。可显式改成滚动时间窗口 |
| 运维白名单 | 空 | 可登记固定 IP/CIDR；主机服务另外豁免回环及已确认的本机地址 |

进入「安全防护」修改次数、时长、窗口和白名单；保存后回读实际策略。
「封禁 IP」显示来源、原因、到期时间与执行状态，输入完整 IP 后可以手动解封。
策略有版本校验，两位管理员同时编辑时，旧页面不能覆盖新设置。

默认封禁覆盖该来源到本机及经本机转发的流量，因此会影响同一出口 IP 的其它连接。
共享 NAT 出口使用相同计数；通过代理访问时，必须正确配置可信代理和保留源 IP。
异步日志采集存在延迟，不能承诺第三个认证报文之后不存在任何并发在途请求。

### 每种服务如何接入

| 服务 | 认证事件来源 | 生效条件 |
| --- | --- | --- |
| 面板登录 | 独立登录接口的实际验证结果 | SQLite 持久计数；主机服务离线时继续提供面板自身防护 |
| SSH | 宿主 journald 或 `auth.log/secure` | 正确读取 OpenSSH 密码失败日志；公钥尝试、断开和重复 PAM 行不计为密码错误 |
| MySQL | 服务端认证拒绝日志 | 新实例启用 `log_error_verbosity=3` 和数字来源地址；存量实例需核对日志配置 |
| MongoDB | 结构化认证结果日志 | 支持目录内版本的认证事件，排除普通权限错误及未完成的认证 |
| Redis | 独立 RESP 认证入口的逐次返回结果 | 新实例使用独立网络，后端不直接发布端口，外部访问经过认证代理 |

OpenSSH 的 `password` 失败会在 INFO 级别记录，但 `keyboard-interactive` 的早期失败可能
仅在 VERBOSE 级别记录。使用交互式密码或 PAM 时，应验证实际 `LogLevel` 和认证日志路径；
仅能读取 journal 不代表每次失败都可计数。面板不会自动修改已有 sshd 配置。

MongoDB 按服务端实际认证协议失败计次，包含 `isSpeculative=true` 且认证失败的事件。
驱动的一次 `connect()` 可能包含 speculative 与常规认证，不能把应用调用次数等同于
密码失败次数，也不能简单跳过 speculative；普通断开造成的未完成认证不计数。

Redis 的 `ACL LOG` 会合并多个客户端的失败，不能把聚合次数归给最后一个 IP。
因此新实例由主机服务提供所选访问端口；管理代理不可用时不会开放一个绕过防护的备用端口。
代理支持普通认证、管道、事务及 Pub/Sub；TLS 直通、复制/集群流、`MONITOR` 和
`CLIENT REPLY OFF/SKIP` 不属于此入口支持范围，不能把它用于这些场景后宣称已保护。

存量 Redis 保留原端口、数据与运行方式，显示「需要迁移」。迁移需在维护窗口完成：
先验证可恢复备份及连接方式，再建立受保护的新实例并使用 Redis 支持的数据迁移流程，
核对真实读写与三次失败拦截后切换客户端。不要直接修改既有卷的数据库大版本。
旧 MySQL 不自动开启 `skip_name_resolve`，以免影响按主机名授权的已有账号。

第三方面板安装的数据库、远程数据库，以及未适配的 PostgreSQL、SQL Server、Oracle
不会仅因本机开关开启就自动获得认证计数。原生 MySQL/MongoDB 可由主机管理员在
受限配置文件中登记日志源；面板不提供任意日志路径或 Shell 执行入口。

### 状态、运行与恢复边界

「已开启」表示策略；「保护运行中」还要求该服务的日志/代理、源地址和防火墙回读正常。
缺少日志、未知格式、权限不足、规则异常或旧实例未迁移时显示待验证或需要处理，
不能以容器 `Running`、静态健康检查或一个配置值代替实际保护。

业务服务继续通过 Docker 运行。防护代理是宿主机上的小型 Python/systemd 服务，
与业务数据库和面板独立；固定使用 `/opt/microi-auth-guard`、`/etc/microi-auth-guard`、
`/var/lib/microi-auth-guard` 和 `/run/microi-auth-guard`。控制接口仅通过 root 专用 Unix
socket 通信，不监听公网管理端口，不向业务 V8 或 DiyToken 授予防火墙权限。

防火墙仅维护吾码自己的表、集合和链，覆盖宿主 INPUT 与 Docker 转发链路。
nftables 使用内核超时；iptables 兼容模式依赖守护进程按时移除规则，守护进程停止时
不能保证准点自动解封。页面须以实际后端及回读为准。云安全组、第三方封禁规则或上游
代理的限制不由吾码的「解封」按钮解除。

主机管理员可在控制台检查服务，不需要启动业务平台：

```bash
systemctl status microi-auth-guard --no-pager
python3 -B /opt/microi-auth-guard/daemon.py --verify-ready
# 将示例地址替换为需要解封的真实来源 IP，以 root 执行：
sudo /opt/microi-auth-guard/run.sh --unban 198.51.100.25
```

控制台解封调用同一个 root Unix socket 接口，只有指定 IP 的规则移除并回读确认后才返回
成功；同时清零该 IP 的失败计数。主机服务未运行或返回失败时，不代表已解封，应先恢复服务
再重试。该命令不会删除其它防火墙规则，也不会直接改写数据库。

面板不可访问时应使用云控制台或另一可信管理来源恢复，不能关闭整台主机防火墙作为
常规解封步骤。备份面板 `config/data` 时，也保存防护服务的配置和持久状态；恢复到另一
主机前重新核对 Docker 身份、网络与来源地址。Docker Desktop 隔离容器验收只能证明
对应协议和网络空间的行为，不能替代真实 Linux 主机的 systemd、重启及第三方面板共存验收。

## 独立一键安装

稳定版安装器默认使用 `v2.0.2`，同时安装认证防护和磁盘维护宿主服务。首次安装默认累计 3 次认证失败封禁 IP 24 小时，并开启安全镜像回收；升级保留已有策略、账号、证书和业务数据。

使用 Linux 主机的 SSH 终端执行。普通账号会通过 `sudo` 进入安装流程；没有 `sudo` 时先使用 `su -`。安装器会询问浏览器使用的域名或服务器 IPv4；主机缺少 Docker 时再询问是否安装 Docker Engine。

`v2.0.2` 面板镜像按 `Linux/amd64` 交付；首装、升级回退及宝塔/1Panel 两种安装顺序的实际验收使用 Ubuntu 24.04。插件目录中的 ARM64 标识仅表示对应插件镜像支持该架构，不代表面板及所有 Linux 发行版均已验收。

```bash
panel_url=https://gitee.com/ITdos/microi.net/raw/master/%E6%95%B0%E6%8D%AE%E5%BA%93%E3%80%81%E6%A1%88%E4%BE%8B%E3%80%81%E6%96%87%E6%A1%A3%E3%80%81%E8%B5%84%E6%96%99/install-microi-panel.sh; (if command -v curl >/dev/null 2>&1; then curl -fSL -o install-microi-panel.sh "$panel_url"; else wget -O install-microi-panel.sh "$panel_url"; fi) && sed -i 's/\r$//' install-microi-panel.sh && bash install-microi-panel.sh
```

安装脚本也提供 [GitHub 备用下载](https://github.com/itdos/microi.net/raw/refs/heads/master/%E6%95%B0%E6%8D%AE%E5%BA%93%E3%80%81%E6%A1%88%E4%BE%8B%E3%80%81%E6%96%87%E6%A1%A3%E3%80%81%E8%B5%84%E6%96%99/install-microi-panel.sh)。

默认目录 `/microi/panel`，独立 HTTPS 端口 `61890`，容器名 `microi-panel`。账号为 `paneladmin`，随机密码保存在 `/microi/panel/config/admin-password`，安装日志不输出密码。初始证书由本次安装独立生成，首次访问时核对终端输出的 SHA-256 指纹；正式对外使用可更换为受信任证书。

自动化部署可指定参数，例如：

```bash
bash install-microi-panel.sh --image registry.cn-hangzhou.aliyuncs.com/microios/microi-panel:v2.0.2 --host panel.example.com --port 61890 --root /microi/panel --yes
```

将域名替换为实际地址。已有 Docker 时复用现有引擎，不重新安装或改写守护进程配置。云安全组按需放行所选面板端口；数据库和存储端口按实际业务范围开放。

建议使用稳定 IP 或固定域名。服务器地址变化时，浏览器入口和证书 SAN 必须与新地址一致；不要用跳过证书校验来代替地址配置。Ubuntu/Debian 新主机通过 Docker 签名 APT 仓库安装运行时，官方传输不可达时可回退阿里云镜像，公钥身份仍固定为 Docker 官方签名。安装器不自动卸载已有 `docker.io`、`containerd`、`runc` 等冲突包；先按 Docker 的兼容迁移方法处理，再继续安装。

只读检查不会创建或启动服务：

```bash
bash install-microi-panel.sh --host panel.example.com --port 61890 --check
```

宿主防护需要 Python 3.9 或更新版本及必要的 SSL、SQLite、asyncio 标准库。旧主机可安装到独立、仅 root 可写的目录，用 `--guard-python` 明确选择；安装器不替换系统 Python，也不复用版本不足的第三方面板解释器。解释器和真实祖先目录均须由 root 控制，升级时继续传入同一个路径：

```bash
bash install-microi-panel.sh --host panel.example.com --port 61890 \
  --guard-python /opt/microi-python/python/bin/python3 --check
```

安装器会读取实际 systemd 版本并校验生成的服务定义。systemd 219–231 使用 `ReadOnlyDirectories=/` 与原有固定目录的 `ReadWriteDirectories` 实现只读命名空间，保留能力限制、系统调用过滤和 `NoNewPrivileges`，使用兼容的内存限制名称；新版继续使用 `ProtectSystem=strict`。未知或被忽略的关键指令会令预检失败，不启动不完整的防护服务。旧服务实例用 PID 与单调启动时间核验并发变化，不依赖旧版缺失的 `InvocationID` 或 `systemctl --value`。[systemd 219 命名空间实现](https://github.com/systemd/systemd/blob/v219/src/core/namespace.c)

这些运行时检查不能代替该发行版的实际启动、防火墙、网站和重启验收；`--check` 只作只读前置检查。交付时同时核对实际安装回执、镜像及源码哈希。

旧 systemd 的属性读取使用 `--all --no-pager`，区分不存在的属性、空属性和真实命令失败。SSH 日志采集兼容旧版 JSON journal 输出，仍核验 root UID、sshd 路径、时间和游标；本机地址在旧 `iproute2` 上使用固定格式的单行输出，不将广播地址视为本机地址。生成的 Compose CPU 限额使用数值，以兼容旧版解析器。

Docker 新建网络后可能把自身规则插到 FORWARD 首部。防护服务会只重新定位吾码自有跳转，使用独立注释和完整规则匹配保留其他防火墙规则，并重新回读；不清空宝塔、Docker 或系统防火墙。交付验收应包含新建容器/网络后的状态，以及从独立来源进行真实 SSH 错密、第三次封禁、手动解封和网络恢复，不能只检查 `systemd active`。

面板自身限制为 512 MiB 内存和 1 CPU，各插件另有独立限额。SQL Server、Oracle 和 OCR 初始化需要较多资源，请先检查主机余量；目录中显示的容器限额不能当作整套系统的最低配置。OCR 默认预算 8 GiB，翻译服务默认 2 GiB，数据库和业务 API 还需另计。

## 插件市场与版本

目录包含 Nginx、MySQL、SQL Server、PostgreSQL、Oracle Database Free、MinIO、Redis、MongoDB、LibreTranslate 和 PaddleX OCR。安装页面列出实际支持的版本、CPU 架构和许可说明；版本选择决定拉取的镜像，开始任务后锁定镜像摘要，断线重试继续使用同一份镜像。

数据库、Redis 和存储默认仅绑定 `127.0.0.1`。其它机器确需访问时，在安装表单明确设置监听地址和独立端口，并配合云安全组限制来源。不要为了复用默认端口停止客户已有服务。

每个实例有独立 Docker 网络归属、容器标签和命名数据卷。卸载只移除该实例容器，数据卷保留；可从「服务器」中的原实例选择「重新安装」，继续使用原版本、账号和数据卷。原数据卷丢失时会停止，不会创建空卷冒充恢复。备份和恢复在面板中单独操作。数据库的不同主版本不一定兼容同一物理数据目录，跨主版本迁移必须使用该数据库支持的迁移流程。

Oracle 使用原厂镜像渠道；SQL Server 需按实际用途选择许可版本。MinIO Community 插件基于最后社区安全版本源码构建，镜像包含对应源码和 AGPLv3 许可；上游仓库已归档，维护状态会在安装页提示。新安装 MySQL 优先选择 8.4，8.0 仅用于已有应用兼容迁移。

## Nginx、反向代理与 HTTPS

::: tip 已有网站管理与续期验收
稳定版支持已有宝塔 Nginx / 1Panel OpenResty 网站直接管理。两种安装顺序均通过真实原厂网站、配置回滚、并发修改保护、实际证书签发、自动续期及整机重启后续期检查。公网 CA 仍取决于客户域名、DNS、端口和网络条件。
:::

### 吾码受管 Nginx

先在市场安装 Nginx，再进入「网站」选择该实例。网站支持多个域名；静态模式使用自己的站点目录，代理模式按路径转发到明确的 HTTP/HTTPS 上游。配置先预览，发布时执行 `nginx -t`，成功后原子切换并重新加载；失败保留原站点配置。

从 Nginx 容器访问其它服务时，`127.0.0.1` 指的是 Nginx 容器自身。使用可从该容器网络到达的服务域名或服务器地址；端口映射不会自动把宿主机回环地址变成容器内可访问地址。

### 直接管理已有宝塔 / 1Panel 网站

在「网站 → 宝塔 / 1Panel 网站」查看本机已发现的宝塔 Nginx 和 1Panel OpenResty。
发现与查看配置是只读操作；输入实例标识确认「接入管理」后，才开放该实例已识别站点的
配置编辑、语法校验、平滑重载、吾码变更历史及免费 SSL。接入不会迁移网站数据、重建原有
容器或创建一条虚假的吾码受管实例；原面板继续保留自身账号和管理功能。

每次修改绑定实例指纹、站点标识和当前配置 SHA-256，以版本比较（CAS）拒绝旧页面覆盖新文件。
发布前保存原配置，候选通过 `nginx -t` 后才切换并重载；失败保留原文件和恢复记录。
「历史备份」恢复的是吾码保存的变更版本，恢复时仍检查当前版本；宝塔或 1Panel 自己的历史
记录继续由原面板管理。遇到身份变化、路径映射不清或不支持的配置时停止并显示原因。

这是所选站点配置的管理入口，不是任意宿主文件或 Shell 入口。避免在两套面板同时编辑同一
站点；发生版本冲突后重新读取、比较并确认修改，不要通过反复提交覆盖原面板的新配置。

### 免费证书与 HTTP-01 入口

手动 HTTPS：在「证书」导入完整 PEM 证书链和匹配私钥，再在吾码网站中选择证书并发布。
系统检查有效期、域名 SAN 和私钥匹配，私钥不在列表和操作日志中返回。

自动 HTTPS：吾码站点选择「自动证书」，已接入的外部站点选择「免费 SSL」，填写联系邮箱、
选择 Let's Encrypt 生产或测试环境并确认条款。测试环境证书不受普通浏览器信任；自定义
ACME CA 仅接受 HTTPS Directory，可配置其 CA 根证书，不通过关闭 TLS 校验来签发。

| 站点来源 | HTTP-01 如何到达 |
| --- | --- |
| 吾码 Nginx | 使用该实例现有挑战目录；公网 80 已由其它入口占用时，由入口转发 `/.well-known/acme-challenge/` 到吾码 Nginx 的独立 HTTP 端口 |
| 已接入宝塔 / 1Panel 网站 | 宿主适配器核对实际目录、权限及容器挂载，创建独立挑战子目录并校验、重载对应入口；宝塔原生站点根不适合隔离验证时，使用固定 `/www/wwwroot` 下的专用子目录，不更改原厂目录权限；无需把整个站点目录挂入证书客户端 |

域名证书要求域名真实解析，HTTP-01 要求公网 TCP 80 可达，CDN、WAF 或反向代理不能拦截挑战路径。
Let's Encrypt 的公网 IPv4 证书使用 `shortlived` 配置，签发与续期均由客户端显式传入；
有效期约 160 小时，因此应保留自动续期和失败告警。面板管理端口可以使用自定义端口，
HTTP-01 的公网验证入口仍是 80，不能用管理端口替代。IP 证书不使用 DNS-01。
[Let's Encrypt IP 与短周期证书说明](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability)
外部站点已有的验证路由、重写或 include 与候选入口冲突时，应按适配器返回的具体原因处理；
不能直接覆盖其它证书工具的入口。通配符域名仍需 DNS 验证取得证书后导入，当前自动入口不提供 DNS 凭据管理。

宝塔同时配置 TCP TLS 和 QUIC / HTTP/3 时，HTTP-01 只探测普通 HTTP 监听；UDP 的 QUIC 443 不会被当作 HTTP 端口。旧失败计划按其原配置正文重新识别监听类型，保留原请求号、配置版本和隔离目录。

### 自动续期、暂停与失败恢复

申请表默认勾选自动续期。账号、证书、检查时间、操作编号和失败次数持久化保存；面板重启后
从原检查点继续。客户端依据 CA 的 ARI 续期建议和证书有效期判断是否换证，正常检查间隔
不超过 12 小时，短周期证书会更频繁检查。未换证书时回读当前 TLS，不将普通检查记为新签发。

暂时失败采用持久退避，通常从约 5 分钟开始逐步延长，并在临近过期时缩短检查间隔。
已签发但尚未发布成功的任务继续原部署检查点；重启或重复投递不能变成一批新的签发申请。
先修正 DNS、挑战入口、CA 信任或服务状态，再从操作记录继续原任务。

首次连接失败而客户端已保存本地账号文件时，仅在 CA 明确确认账号不存在、且本地没有成功注册回执后，才归档未完成的账号材料并继续原任务。原私钥随归档保留，恢复步骤也有持久检查点；不要清空证书状态卷或靠反复新建任务处理这类故障。

新证书先验证私钥及 SAN，再执行配置校验和重载；只有实际 SNI 连接返回预期叶证书的
SHA-256 指纹，才登记部署成功。已有宝塔 / 1Panel 网站在平滑重载后会有限等待新工作进程就绪，
每轮检查全部域名和 TLS 端口，并核验实际 HTTPS 响应及重定向；超时仍报告失败。
失败时保留旧证书并尝试恢复原配置，回退也需核验实际 TLS；
回读缺失或恢复失败会显示未完成，不能只凭文件写入或 `nginx -t` 成功宣称网站已换证。

「证书」页统一显示吾码和外部站点的最近检查、最近换证、失败原因及下次检查时间。
暂停会停止后续排程，已排队的旧自动续期任务在开始执行前也会复核策略；暂停不是强行中断
已经开始的 CA 请求或重载。修改域名后重新确认自动证书配置，并避免原面板同时续签同一站点。

面板自己的 HTTPS 入口由面板容器直接提供，不依赖它正在管理的 Nginx。需要更换面板证书时，将新的 PFX 和密码分别放入 `config/panel.pfx`、`config/tls-password`，权限保持 `600`，然后通过下方原 Compose 重新创建面板；网站证书管理不会自动替换面板入口证书。

## 与宝塔、1Panel 共存

三套面板使用独立安装目录、账号和监听端口。吾码面板安装时不停止已有面板，不自动改写客户 Nginx、MySQL、Docker 的全局配置。只有显式接入并提交操作后，才管理已识别的外部站点配置。无论先安装哪套面板，都要在后安装的产品中选择未占用端口，并关闭其对吾码资源的自动接管或清理。

同一 IP 的同一个 TCP 端口不能由两个服务同时监听。只有一个入口占用 `80/443`，其它 Nginx 使用独立端口，由现有入口按域名转发。默认 `61890` 是吾码面板入口，Nginx 默认 `18080/18443`；若这些端口已被占用，安装器会停止该动作并保留现有服务。

如果先安装吾码面板、后安装宝塔及其 Nginx，在宝塔目录创建完成后执行
`sudo systemctl restart microi-auth-guard.service`，再进入已有网站管理执行语法校验和一次带版本检查的保存，确认回执及实际网站内容。
宿主服务保留只读文件系统命名空间，仅对已声明的宝塔配置、日志和站点目录保留可写例外；新版使用 `ProtectSystem=strict`，旧版使用上方兼容指令。首次启动时尚不存在的目录会被 systemd 忽略，服务重启才会按现有目录重新建立该进程的挂载视图。
无需重启宝塔、Nginx 或 Docker，也不要把整个 `/www` 或根目录改成可写。`daemon-reload` 只重新读取 unit 定义，不能代替这里的服务重启。此安装顺序仍需完成真实 Linux 的共存与整机重启验收。[systemd 官方说明](https://www.freedesktop.org/software/systemd/man/256/systemd.exec.html)

宝塔原生 Nginx 的身份核验还需读取其主进程 `/proc/PID/exe`。Linux 对此执行 ptrace 访问检查，缩减能力的 root 服务同样可能被拒绝。主机服务因此包含 `CAP_SYS_PTRACE`，同时通过 `SystemCallFilter` 禁止 `ptrace`、`process_vm_readv` 和 `process_vm_writev`；保留 `NoNewPrivileges`、只读文件系统和固定可写目录，不提供任意 PID、调试或 Shell 接口。[Linux 进程可执行文件权限说明](https://man7.org/linux/man-pages/man5/proc_pid_exe.5.html)

不同面板共享同一个 Docker Engine 时，停止 Docker、卸载 Docker、全机容器清理或全机数据卷清理会影响所有产品。此类宿主机动作必须由主机管理员统一协调；软件目录隔离不能消除共享运行时的影响。

宝塔原厂安装器会检查已有 Web 环境，部分版本要求空白系统或再次确认覆盖风险。进程检查也可能识别到 Docker 内的 Nginx，即使监听端口彼此独立，仍会触发提示。共存前应保存原编排、网站配置和数据备份，阅读该版本原厂提示，不在客户主机上直接自动回答覆盖确认。独立测试机上的风险确认与客户现场安装分别记录；安装后回读原 Docker 身份、面板账号与证书、网站文件和真实 HTTP 响应。吾码安装器只能保证自身的操作边界，不能约束其它产品之后执行的全机安装、接管或清理动作。

## 网站文件、备份与恢复

文件管理仅开放所选网站目录。单文件上传上限 20 MiB，UTF-8 在线编辑上限 512 KiB；较大部署产物使用独立交付渠道。修改带内容哈希检查，旧页面不能直接覆盖另一位管理员刚保存的内容。删除进入本站点回收记录，历史恢复同样校验当前内容。

冷备份会暂时停止目标服务，完成后恢复原运行状态，备份大小和磁盘速度会影响中断时间。归档包含数据与版本信息，并记录 SHA-256。恢复先校验归档，在新卷解包并逐项核对，再切换容器；原容器和原数据卷保留，切换失败会尝试恢复原运行状态。备份不自动同步到另一台服务器，请另行下载并保存异地副本。

计划任务支持 1–168 小时间隔的冷备份或重启。启用前确认服务允许中断；任务账本会记录稳定操作编号和下次执行时间。失败后查阅任务记录，不会把失败隐藏成一次成功的定时执行。

## 更新面板与离线安装

独立面板使用宿主机安装器更新自身。它先拉取候选镜像，保留原编排、账号、证书和数据，健康检查通过才报告成功；失败会在核对当前容器身份后尝试恢复原镜像。

```bash
bash install-microi-panel.sh --upgrade --root /microi/panel --image registry.cn-hangzhou.aliyuncs.com/microios/microi-panel:v2.0.2
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

2.0.2 磁盘治理必须通过配套安装器更新宿主服务，不能只替换面板容器。新装默认开启，
每天北京时间 03:00 清理、15 分钟监测；连续闲置满 7 天且无容器引用、无回滚或任务保护的
登记应用镜像才会进入候选。当前版本与两个不同历史版本、最近验证通过的回滚版本均保留；
首次接入的存量历史候选只记录为未验证。数据库数据卷、停止容器和其它项目镜像始终保留。

面板的“磁盘与安全清理”编辑宿主同一份策略，并展示候选、保留原因、执行结果与采样状态。
独立 `microi-disk-guard.service` 在面板、业务 API 停止后继续运行；更新前先核对容量，按原规则
尝试小批量安全回收，仍不足则阻止本次下载。外部 Watchtower 和手工 Docker 不受该入口拦截。
关闭自动清理仍继续监测，原有关闭策略与服务停止状态在升级时保留。

详细阈值、已有平台补装和资源登记边界见 [磁盘容量与安全回收](/doc/getting-started/docker-run.html#磁盘容量与安全回收)。
稳定镜像不可变摘要：`sha256:d460ac77c8e4f60a6a60088294630d5c9c10848e63d573dc2d48285f54016cb8`。现场安装独立验收；历史版本须升级镜像和配套宿主服务后才能使用新能力。

| 路径 | 内容 |
| --- | --- |
| `/microi/panel/config` | 管理员密码文件、面板入口证书、环境配置、可选原平台部署清单 |
| `/microi/panel/data` | SQLite 操作账本、加密凭据与数据保护密钥、备份归档 |
| `/microi/panel/logs` | 面板自己的可轮转运维日志 |
| `/var/lib/microi-disk-guard` | 宿主磁盘策略、镜像闲置/回滚历史、保护任务、删除回执与应急保留文件 |
| `/run/microi-disk-guard/control.sock` | root Unix 控制接口，不开放 TCP；面板通过只读目录挂载连接 |
| Docker 命名数据卷 | 各插件的业务数据、Nginx 站点文件和证书客户端状态 |

迁移或灾备须整体保存面板 `config/data` 与相关业务卷。只复制 SQLite 而遗漏加密密钥无法完整恢复凭据；只保留面板镜像无法恢复客户数据。
