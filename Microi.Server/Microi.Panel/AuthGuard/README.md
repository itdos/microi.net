# 宿主认证防护代理

这是 Linux root 运行的独立 Python 3 标准库服务。它在 SQLite 中持久保存跨服务来源 IP 的失败次数、封禁、策略和日志 cursor，控制端只接受 root Unix socket HTTP 请求。它不运行可编辑 V8，不将 Docker socket 或防火墙权限交给浏览器。

默认策略：启用、同一 IP 累计 3 次认证失败、封禁 86400 秒；`windowSeconds=0` 表示累计到解封。设置正数时使用真实滑动窗口，例如 10 秒窗口中的 t=0/8/16 三次不会达到阈值。手工或到期解封同时清理计数，保留事件去重记录及解封时间，迟到的旧日志不能重新封禁。成功登录不重置累计计数。公网、内网地址均计数；回环、本机接口地址和管理员配置的 CIDR 白名单豁免，不信任 X-Forwarded-For。

## 安装产物与控制面验收

镜像 `/app/AuthGuard/manifest.json` 的 `protocol=1`，`files` 为完整运行文件清单。安装器将其复制到 `/opt/microi-auth-guard` 并安装 `microi-auth-guard.service`。升级不得覆盖 `/var/lib/microi-auth-guard/` 或已有 `/etc/microi-auth-guard/config.json`。Python 需支持 `asyncio.to_thread`（Python 3.9+）；宿主需 systemd、Docker、`ip`、可用的 nftables，或同时具备 iptables/ip6tables。SSH 日志需 journalctl 或明确的本地日志源。

```sh
# 只读检查；不创建状态文件、不写防火墙规则。
python3 -B /opt/microi-auth-guard/daemon.py --check
# 读取正在运行的服务；只有新鲜的 firewall.verified=true 返回 0。
python3 -B /opt/microi-auth-guard/daemon.py --verify-ready
# 更严格的采集覆盖检查；存量 Redis 待迁移、日志未验证等均返回非 0。
python3 -B /opt/microi-auth-guard/daemon.py --verify-ready --strict-coverage
# 从宿主控制台/第二条管理通道以 root 解封：沿用服务的验证与回读。
sudo python3 -B /opt/microi-auth-guard/daemon.py --unban 198.51.100.25
```

控制台解封只调用现有 Unix HTTP `/unban`，不会另建防火墙规则、改写 SQLite 或执行任意 shell。只有指定 IP、`removed=true`、`banned=false` 和 `firewallVerified=true` 全部确认才 exit 0。服务停止或 socket 不可访问时命令失败，需先恢复宿主服务，再重试；不要将退出失败视为已解封。

服务启动先创建并回读自有防火墙对象，失败则退出。Unix socket 默认 `/run/microi-auth-guard/control.sock`，目录 root:root 0700、socket 0600，并校验 `SO_PEERCRED.uid=0`；不支持把普通宿主用户映射成容器 root 的 userns 控制连接。面板可将整个 socket 目录只读挂载：只读 bind mount 不禁止连接 Unix socket；面板无法更换目录文件。宿主 root、Docker 管理员和面板后端 root 属于受信管理边界。

systemd 单元使用 `RuntimeDirectoryPreserve=yes`，停止、升级和回滚重启均保留运行目录 inode；进程只重建目录内 socket。否则面板容器已绑定的旧目录可能不再看见新 socket。操作系统重启时 `/run` 仍是临时目录，启动顺序及面板目录挂载需由安装器核对。

控制面就绪和覆盖范围分别报告：存量 Redis `needs-migration`、数据库日志 `needs-verification` 不应导致整套面板回滚。新 Redis 必须匹配 `adapter.id=resourceId` 且状态为 `protecting` 才能完成其安装。防火墙回读超过 30 秒自动变为 `verified=false/stale=true`。即使 `verified=true`，`packetTested=false` 仍明确表示 API 的规则结构回读不等于外部连接实际拦截验收。

## HTTP JSON 接口

无 TCP 控制端口。所有路径使用 HTTP/1.x 经 Unix socket，JSON body 上限 64 KiB，最多 16 个并发请求，超时 3 秒；错误为 HTTP 400/409/503 与 `{"error":"…"}`。时间均为 Unix 秒，可带小数。

| 方法与路径 | 请求 | 响应重点 |
| --- | --- | --- |
| `GET /status` | 无 | `protocol,policy,health,adapters,firewall,bans,statistics,observedAt,lastError` |
| `PUT /policy` | `expectedRevision` 加要修改的基础策略字段 | `policy,firewall`；版本冲突 409 |
| `POST /check` | `{"ip":"198.51.100.25"}` | `ip,banned,ban,policy,failedAttempts,lastFailure,recentFailureTimes,resetEpoch,observedAt,firewall` |
| `POST /failures` | `{"ip":"198.51.100.25","eventId":"unique-id","service":"panel","occurredAt":1793000000}` | 幂等计数结果及上述 policy/计数/时间回执；仅允许 panel 服务上报 |
| `POST /unban` | `{"ip":"198.51.100.25"}` | 实际移除并回读成功后 `removed=true,banned=false,firewallVerified=true` |

策略包含 `enabled`、`maxFailures`（1–100）、`banSeconds`（60–31536000）、`windowSeconds`（0–86400）、`allowlist`（最多 256 个数字 IP/CIDR，禁止 /0）、`revision`（字符串）、`generation`（从 1 开始单调增加）。客户端只可提交前五个可写字段和 `expectedRevision`；日志路径、执行命令和后端配置不接受 Web API 写入。

封禁条目有 `ip,service,reason,failedAttempts,bannedAt,expiresAt,applied,error,pendingRemoval`。`applied=false` 不能称为网络封禁成功。到期但内核移除失败时保留 `pendingRemoval=true` 的台账和计数，`/check` 仍报告待解封，管理员可重试手工解封。白名单变更成功前也要求移除回读。`/check` 对白名单或禁用策略返回零计数且 `ban=null`，方便面板准确镜像本地降级状态。

## 日志来源与 Redis 拓扑

SSH 优先 journal，筛选 ssh/sshd unit 和 sshd 进程，仅接受 root 可信可执行路径产生的固定 `Failed password` / `keyboard-interactive` 行；不把公钥失败、断线或 PAM 重复行算入密码错误。使用 journal cursor 重启续读；首次接管仅建立当前基线。文件模式按设备/inode/offset 持久续读，严格匹配 sshd syslog 前缀及时间戳。普通 syslog 文本没有 journal 的 `_UID/_EXE` 身份证据；有本机不可信日志写入者的环境应使用 journal，不能将可伪造 syslog 当强身份来源。

OpenSSH 的 password 失败按 INFO 记录，但 keyboard-interactive 早期失败可能仅在 VERBOSE 级别记录；要覆盖每一次交互式密码尝试，管理员必须验证其 LogLevel/PAM 路径，不能仅凭 journal 可读承诺三次阈值。服务不会自行修改 sshd 配置。未知格式不从任意文本猜测来源 IP，也不会把首次看到的普通日志当认证来源验证。

Docker 只读取拥有 `io.microi.panel.owner/resource/plugin` 标签的受管容器；最多 64 个。读取 Docker Engine Unix socket 的列表、inspect、network 与 logs GET API，不读取容器环境变量输出到控制响应。支持 `json-file/local/journald` 日志驱动，不接受 TTY 混合流。MySQL 仅接受数字来源 IP 的固定认证拒绝格式（8.x `MY-010926` 或兼容旧 Note/Warning 格式）；MongoDB 解析结构化认证事件 `5286307/result=18/client` 或 `20249/AuthenticationFailed|UserNotFound/remote`，不把弃用认证、普通命令错误、集群成员认证当密码失败。

MongoDB 按服务端实际认证协议失败计次，包含 `isSpeculative=true` 且 `result=18` 的失败；不按某个驱动的 `connect()` 调用次数推算。驱动可能先做 speculative 再做常规认证，一次应用连接调用可能触发多次认证。不能简单跳过 speculative，也不能将 `AuthenticationAbandoned` 计成密码失败；真实版本/驱动矩阵必须单独核对事件数。

能读取 stdout 不代表认证日志已开启。MySQL 新实例需要 `log_error_verbosity=3` 与 `skip_name_resolve`；后者可能影响原有 hostname 授权，不能偷偷改存量实例。MongoDB 新实例需要支持详细认证健康日志的版本与参数；旧文本、自定义日志格式、日志未到 stdout 的实例应配置受信原生日志或明确显示未验证。观察到带数字来源的真实失败后才将来源标为已验证；这仍不证明 NAT/负载均衡后来源一定是原始终端。共享出口 NAT 会连带封禁同出口用户，部署前应配置稳定管理出口白名单和第二条管理通道。

Redis 使用独立 TCP 认证代理获取真实连接 peer 与每一次认证响应。不能用 ACL LOG 的 `count` 乘到 `client-info` 上：官方 Redis 源码会跨 IP 聚合同类事件，最新 client-info 无法还原每个 IP 次数。MONITOR 不适合作认证失败审计。代理拒绝会遮蔽响应的 `CLIENT REPLY OFF/SKIP` 以及 MONITOR/SYNC/PSYNC；不提供 TLS 直通认证识别。代理限制和支持的 RESP 模式见 `redis_proxy.py` 与对应测试。

新 Redis 标签 `io.microi.panel.auth-guard.redis-proxy=true`，代理监听地址/端口来自其受管标签；后端没有任何 Host PortBindings，使用 `mci-panel-{owner}-{resource}-guard` 专属网络且只能有该容器。守护进程首先回读到后端 IP:6379 的 forward DROP，再启动代理监听；直接路由也不能绕过。宿主本机 OUTPUT 属于可信管理边界。拓扑变化、未知容器加入或规则失败时不能宣告 `protecting`；已知后端隔离规则保留，新增代理失败关闭。老 Redis 显示 `needs-migration`，本服务不自动断开其旧端口或搬迁数据。

原生服务可由 root 创建 0600 配置文件；省略文件时默认启用 SSH 自动发现和 Docker。配置更改重启服务生效，基础安全策略仍以 SQLite 为准。

```json
{
  "ssh": {"enabled": true, "source": "journal"},
  "docker": {"enabled": true, "socketPath": "/var/run/docker.sock"},
  "firewallBackend": "auto",
  "nativeLogs": [
    {"id": "mysql-native", "kind": "mysql", "path": "/var/log/mysql/error.log"},
    {"id": "mongo-native", "kind": "mongodb", "path": "/var/log/mongodb/mongod.log"}
  ]
}
```

## 防火墙与可靠性边界

优先使用 nftables 自有 `inet microi_auth_guard` 表，input/forward 独立 base chain 优先级 -10，双栈封禁集合有内核 timeout。回读核对所有链、集合、真实 DROP 表达式及归属标记，拒绝 dormant、额外规则和同名他人对象。仅增删自己集合元素；不 flush ruleset、不接管 Docker 表。外部工具删除整个自有表会重建；部分结构被改写时明确降级，保留现场供管理员排查。

iptables 兼容模式创建自有 `MICROI-AUTH-GUARD` 链，在 INPUT、FORWARD 与存在时的 DOCKER-USER 首位跳转；同时要求 ip6tables 可用。只增删自己规则，不重排第三方规则；跳转被移到非首位即降级。iptables 模式的自动解封依赖守护进程运行，报告 `automaticExpiryRequiresDaemon=true/expiryMode=daemon-reconciled`；进程宕机期间无法承诺到期瞬间移除规则。需要独立内核到期保障时使用 nftables。程序停止不清空规则，systemd 自动重启后从 SQLite 恢复并核对到期状态。

SQLite 事务保证同一 eventId 仅计一次；跨服务按规范化 IP 累计。日志每批最多 1 MiB、单行 32 KiB，原生源最多 32 个；去重事件最多 500000，累计 IP 最多 100000，封禁最多 10000，审计保留 10000。事件去重保留两天，超出边界而无法由解封时间证明可忽略的重放返回 503；容量满、日志截断/过大、journal cursor 失效、Docker 不可读均明确降级，不静默丢弃后继续显示完整保护。首次安装前的历史日志不追溯封禁。日志方案的发现延迟、系统日志丢失和错误格式不能等同于同步认证网关；Redis 代理可同步逐次识别，SSH/MySQL/Mongo 需真实服务矩阵验收。

## 验证与主资料

轻量 `python3 -B -m unittest discover -s AuthGuard/tests -p 'test_*.py'` 仅覆盖 SQLite、fake firewall/Docker、解析器和代理 socket 组件。真实实验必须另测 IPv4/IPv6、SSH journal/file、MySQL 版本与日志参数、MongoDB 版本、Docker iptables 与原生 nft 后端、第三次错误后的现有/新连接、Redis raw IP 绕过、NAT 来源、重启恢复、规则移除失败和到期/手工解封。组件测试或规则回读不能替代这些实测。

- [OpenSSH auth.c](https://github.com/openssh/openssh-portable/blob/master/auth.c) 与 [journalctl 官方手册](https://www.freedesktop.org/software/systemd/man/latest/journalctl.html)
- [MySQL 8.0 认证源码](https://github.com/mysql/mysql-server/blob/8.0/sql/auth/sql_authentication.cc) 与 [MySQL host cache](https://dev.mysql.com/doc/refman/8.4/en/host-cache.html)
- [MongoDB 8.0 认证事件源码](https://github.com/mongodb/mongo/blob/v8.0/src/mongo/db/auth/authentication_session.cpp) 与 [健康日志参数](https://github.com/mongodb/mongo/blob/v8.0/src/mongo/db/connection_health_metrics_parameter.idl)
- [Redis 8.10 ACL 源码](https://github.com/redis/redis/blob/8.10/src/acl.c)、[ACL LOG](https://redis.io/docs/latest/commands/acl-log/)、[MONITOR](https://redis.io/docs/latest/commands/monitor/)
- [Docker iptables](https://docs.docker.com/engine/network/firewall-iptables/)、[Docker nftables](https://docs.docker.com/engine/network/firewall-nftables/)、[nft 官方手册](https://netfilter.org/projects/nftables/manpage.html)

Fail2ban 可以作为经过单独验证的部署替代方案，但默认 INPUT/input action 不覆盖 Docker 转发链；旧 MongoDB filter、Redis ACL LOG 聚合或未开启的 MySQL 日志不能直接兑现这里的逐 IP/逐次语义。本实现不安装第二套 Fail2ban 或修改其 jail。
