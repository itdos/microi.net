"""有限读取的认证日志适配器；日志不是任意 IP 封禁指令。"""
from __future__ import annotations

import collections
import datetime
import hashlib
import http.client
import ipaddress
import json
import math
import os
import re
import socket
import stat
import struct
import subprocess
import time
import urllib.parse

from store import GuardError, canonical_ip

MAX_LOG_BYTES = 1024 * 1024
MAX_LINE = 32768
OWNER = "io.microi.panel.owner"
RESOURCE = "io.microi.panel.resource"
PLUGIN = "io.microi.panel.plugin"
PROXY = "io.microi.panel.auth-guard.redis-proxy"
PROXY_PORT = "io.microi.panel.auth-guard.redis-proxy-port"
PROXY_BIND = "io.microi.panel.auth-guard.redis-proxy-bind"
SECURITY_LABELS = (OWNER, RESOURCE, PLUGIN, PROXY, PROXY_PORT, PROXY_BIND)


def peer_ip(value):
    """服务端生成的 endpoint 才可传入；IPv6 必须正确拆分方括号/末端口。"""
    if not isinstance(value, str) or len(value) > 80:
        return None
    if value.startswith("["):
        match = re.fullmatch(r"\[([^\]]+)\]:(\d{1,5})", value)
    else:
        match = re.fullmatch(r"(.+):(\d{1,5})", value)
    if not match or not 1 <= int(match[2]) <= 65535:
        return None
    try:
        return canonical_ip(match[1])
    except GuardError:
        return None


SSH_RE = re.compile(r"^Failed (?:password|keyboard-interactive(?:/pam)?) for (?:invalid user )?[^\r\n]{1,100} from ([0-9a-fA-F:.]+) port (\d{1,5}) ssh2(?: \[preauth\])?$")
MYSQL_RE = re.compile(r"^(?:\d{4}-\d{2}-\d{2}[T ][0-9:.+Z-]+\s+)?(?:\d+\s+)?\[(?:Note|Warning)\] (?:\[MY-010926\] \[Server\] )?Access denied for user '[^'\r\n]{1,128}'@'([0-9a-fA-F:.]+)' \(using password: (?:YES|NO)\)$")


def parse_failure(kind, line):
    """严格匹配服务端固定格式，拒绝任意用户名/消息中伪造的地址。"""
    if not isinstance(line, str) or len(line) > MAX_LINE or "\n" in line or "\r" in line:
        return None
    if kind == "ssh":
        match = SSH_RE.fullmatch(line)
        # 用户名是单个标识，不允许嵌入 another ' from IP port ...' 诱骗贪婪匹配。
        if match and line.count(" from ") == 1 and 1 <= int(match[2]) <= 65535:
            try:
                return canonical_ip(match[1])
            except GuardError:
                pass
    elif kind == "mysql":
        match = MYSQL_RE.fullmatch(line)
        if match:
            try:
                return canonical_ip(match[1])
            except GuardError:
                pass
    elif kind == "mongodb":
        try:
            event = json.loads(line)
            attrs = event.get("attr", {})
            if event.get("c") != "ACCESS" or not isinstance(attrs, dict) or attrs.get("isClusterMember") is True:
                return None
            if event.get("id") == 5286307 and event.get("msg") == "Failed to authenticate" and attrs.get("result") == 18:
                return peer_ip(attrs.get("client"))
            if event.get("id") == 20249 and event.get("msg") == "Authentication failed" and \
                    re.match(r"^(AuthenticationFailed|UserNotFound)(?::|\s)", str(attrs.get("error", ""))):
                return peer_ip(attrs.get("remote"))
        except (ValueError, AttributeError, TypeError):
            pass
    return None


def iso_time(timestamp):
    return datetime.datetime.fromtimestamp(timestamp, datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def timestamp(value):
    try:
        # Docker RFC3339Nano 有九位小数；Python 3.9/3.10 fromisoformat 只接受毫秒/微秒。
        value = re.sub(r"(\.\d{6})\d+(?=Z|[+-]\d\d:\d\d|$)", r"\1", value)
        return datetime.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except (ValueError, TypeError, AttributeError):
        return None


def event_key(source, position, text):
    return hashlib.sha256((source + "\0" + str(position) + "\0" + text).encode()).hexdigest()


def line_time(kind, line):
    """解封后的积压日志不能重新封禁；时间缺失时不伪装为刚发生。"""
    if kind == "mongodb":
        try:
            return timestamp(json.loads(line).get("t", {}).get("$date"))
        except (ValueError, AttributeError):
            return None
    match = re.match(r"^(\d{4}-\d\d-\d\d[T ][0-9:.+Z-]+)", line)
    if match:
        return timestamp(match[1])
    if kind == "ssh":
        match = re.match(r"^([A-Z][a-z]{2}\s+\d+ \d\d:\d\d:\d\d) ", line)
        if match:
            try:
                now = datetime.datetime.now().astimezone()
                months = {name: index for index, name in enumerate(("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1)}
                parts = match[1].split()
                hour, minute, second = map(int, parts[2].split(":"))
                value = datetime.datetime(now.year, months[parts[0]], int(parts[1]), hour, minute, second).astimezone()
                if value > now + datetime.timedelta(days=1):
                    value = value.replace(year=value.year-1)
                return value.timestamp()
            except (ValueError, KeyError):
                return None
    return None


class FileCollector:
    def __init__(self, store, report, config):
        self.store, self.report, self.config = store, report, config
        self.key = "file:" + config["id"]
        self.state = {"id": config["id"], "service": config["kind"], "status": "initializing", "message": "等待日志检查。"}

    def poll(self):
        try:
            path = self.config["path"]
            info = os.stat(path, follow_symlinks=False)
            if not stat.S_ISREG(info.st_mode) or (os.name != "nt" and info.st_mode & stat.S_IWOTH):
                raise GuardError("日志必须是不可被任意用户写入的普通文件。")
            generation = str(info.st_dev) + ":" + str(info.st_ino)
            cursor = self.store.cursor(self.key)
            if cursor is None:
                # 首次接管从尾部建立基线，不能用历史失败立即封禁管理员。
                cursor = {"generation": generation, "offset": info.st_size}
                self.store.set_cursor(self.key, cursor)
            elif cursor["generation"] != generation or cursor["offset"] > info.st_size:
                cursor = {"generation": generation, "offset": 0}
            offset = cursor["offset"]
            with open(path, "rb") as handle:
                handle.seek(offset)
                consumed = 0
                while consumed < MAX_LOG_BYTES:
                    raw = handle.readline(MAX_LINE + 1)
                    if not raw:
                        break
                    if len(raw) > MAX_LINE:
                        raise GuardError("日志行超过安全上限；未跳过未知认证记录。", 503)
                    if not raw.endswith(b"\n"):
                        break
                    line = raw.decode("utf-8", "replace").rstrip("\r\n")
                    auth_line = line
                    if self.config["kind"] == "ssh":
                        # 文件型 syslog 只接受 sshd/sshd-session 正规前缀。
                        prefix = re.fullmatch(r"(?:[A-Z][a-z]{2}\s+\d+ \d\d:\d\d:\d\d|\d{4}-\d\d-\d\dT\S+) \S+ sshd(?:-session|-auth)?\[\d+\]: (.+)", line)
                        auth_line = prefix[1] if prefix else ""
                    ip = parse_failure(self.config["kind"], auth_line)
                    if ip:
                        when = line_time(self.config["kind"], line)
                        if when is None:
                            raise GuardError("认证日志缺少可验证的时间戳。", 503)
                        self.report(ip, event_key(self.key, generation+":"+str(offset), line), self.config["kind"], occurred=when)
                        self.store.set_cursor(self.key+":verified", {"observedAt": time.time()})
                    offset += len(raw)
                    consumed += len(raw)
                    self.store.set_cursor(self.key, {"generation": generation, "offset": offset})
                pending = info.st_size - offset
            verified = bool(self.store.cursor(self.key+":verified"))
            self.state.update(status=("monitoring" if verified else "needs-verification") if pending <= MAX_LINE else "degraded", observedAt=time.time(),
                              message="文件读取正常；需真实失败验证日志级别与原始 IP。" if pending <= MAX_LINE else "日志积压，正在有界追赶。",
                              sourceReadable=True, authenticationSourceVerified=verified)
        except Exception as exc:
            self.state.update(status="degraded", message=str(exc)[:300], observedAt=time.time())
        return self.state


class JournalCollector:
    def __init__(self, store, report, runner=subprocess.run):
        self.store, self.report, self.runner = store, report, runner
        self.state = {"id": "ssh", "service": "ssh", "status": "initializing", "message": "等待宿主 SSH journal。"}

    def poll(self):
        try:
            cursor = self.store.cursor("ssh:journal")
            # systemd 219 supports JSON but not --output-fields; trusted fields are still checked below.
            args = ["journalctl", "--no-pager", "-o", "json", "-n", "1000",
                    "_SYSTEMD_UNIT=ssh.service", "+", "_SYSTEMD_UNIT=sshd.service", "+", "_COMM=sshd", "+", "_COMM=sshd-session", "+", "_COMM=sshd-auth"]
            # 按时间顺序读取一个有界批次；未读完的 cursor 不推进到末端。
            if cursor:
                args[1:1] = ["--after-cursor=" + cursor["cursor"]] if "cursor" in cursor else ["--since=" + cursor["since"]]
                args[args.index("-n")+1] = "+1000"
            else:
                args[args.index("-n")+1] = "1"
            result = self.runner(args, capture_output=True, timeout=5, text=True, encoding="utf-8", errors="replace")
            if result.returncode or len(result.stdout) > MAX_LOG_BYTES:
                raise GuardError("SSH journal 不可读取或批次过大。", 503)
            events = [json.loads(line) for line in result.stdout.splitlines() if line]
            if cursor is None and not events:
                self.store.set_cursor("ssh:journal", {"since": iso_time(time.time())})
            for item in events:
                if not isinstance(item.get("__CURSOR"), str) or len(item["__CURSOR"]) > 1024:
                    raise GuardError("SSH journal 缺少可靠 cursor。", 503)
                if cursor:
                    # 非 root/syslog 日志写入者不能利用同名 tag 注入封禁对象。
                    exe = item.get("_EXE", "")
                    trusted = item.get("_UID") == "0" and re.fullmatch(r"/(?:usr/)?(?:sbin/sshd|lib(?:exec)?/(?:openssh/)?sshd-(?:session|auth))", exe)
                    ip = parse_failure("ssh", item.get("MESSAGE", "")) if trusted else None
                    if ip:
                        when = int(item["__REALTIME_TIMESTAMP"]) / 1000000
                        self.report(ip, event_key("ssh:journal", item["__CURSOR"], ""), "ssh", occurred=when)
                        self.store.set_cursor("ssh:journal:verified", {"observedAt": time.time()})
                self.store.set_cursor("ssh:journal", {"cursor": item["__CURSOR"]})
            verified = bool(self.store.cursor("ssh:journal:verified"))
            self.state.update(status="monitoring" if verified else "needs-verification", observedAt=time.time(), sourceReadable=True,
                              message="已观察到 root SSH 进程的认证失败。" if verified else "宿主 journal 可读；尚需实际 SSH 错密与原始 IP 验证。", authenticationSourceVerified=verified)
        except Exception as exc:
            self.state.update(status="degraded", message=str(exc)[:300], observedAt=time.time())
        return self.state


class UnixHTTP(http.client.HTTPConnection):
    def __init__(self, path, timeout=4):
        super().__init__("localhost", timeout=timeout)
        self.path = path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.path)


class DockerClient:
    def __init__(self, path="/var/run/docker.sock"):
        self.path = path

    def get(self, path, limit=MAX_LOG_BYTES):
        connection = UnixHTTP(self.path)
        try:
            connection.request("GET", path, headers={"Host": "localhost"})
            response = connection.getresponse()
            body = response.read(limit+1)
            if response.status != 200 or len(body) > limit:
                raise GuardError("Docker 读取失败或结果超过上限。", 503)
            return body
        finally:
            connection.close()

    def json(self, path):
        return json.loads(self.get(path).decode())


def docker_messages(payload, tty=False):
    """Docker multiplex header 不能被作为认证正文；未知/截断流失败关闭。"""
    if tty:
        raise GuardError("TTY 容器日志无法使用固定认证日志适配器。", 503)
    offset = 0
    chunks = {1: bytearray(), 2: bytearray()}
    while offset < len(payload):
        if offset+8 > len(payload):
            raise GuardError("Docker 日志 frame 不完整。", 503)
        stream = payload[offset]
        size = struct.unpack(">I", payload[offset+4:offset+8])[0]
        if stream not in chunks or payload[offset+1:offset+4] != b"\0\0\0" or size > MAX_LOG_BYTES or offset+8+size > len(payload):
            raise GuardError("Docker 日志 frame 无效。", 503)
        chunks[stream].extend(payload[offset+8:offset+8+size])
        offset += 8+size
    lines = []
    for data in chunks.values():
        if data and not data.endswith(b"\n"):
            raise GuardError("Docker 认证日志末行不完整。", 503)
        for raw in data.splitlines():
            if len(raw) > MAX_LINE:
                raise GuardError("Docker 日志行超出安全上限。", 503)
            value = raw.decode("utf-8", "replace")
            split = value.split(" ", 1)
            if len(split) != 2 or timestamp(split[0]) is None:
                raise GuardError("Docker 认证日志缺少时间戳。", 503)
            lines.append((split[0], split[1]))
    return sorted(lines, key=lambda row: row[0])


class DockerCollector:
    def __init__(self, store, report, client=None):
        self.store, self.report = store, report
        self.client = client or DockerClient()
        self.states = []
        self.proxy_entries = []
        self.redis_backends = []
        self.backend_by_id = {}

    def poll(self):
        states, entries, backends, backend_by_id = [], [], [], {}
        try:
            filters = urllib.parse.quote(json.dumps({"label": [OWNER, RESOURCE, PLUGIN]}), safe="")
            containers = self.client.json("/containers/json?filters=" + filters)
            if not isinstance(containers, list) or len(containers) > 64:
                raise GuardError("受管容器数量超过防护扫描上限 64。", 503)
            for item in containers:
                labels = item.get("Labels", {})
                kind = labels.get(PLUGIN)
                if kind not in ("mysql", "mongodb", "redis"):
                    continue
                identity = labels.get(RESOURCE, "")
                owner = labels.get(OWNER, "")
                container_id = item.get("Id", "")
                if not re.fullmatch(r"[a-z][a-z0-9-]{0,39}", identity) or not re.fullmatch(r"[a-z][a-z0-9-]{0,39}", owner) or not re.fullmatch(r"[a-f0-9]{64}", container_id):
                    continue
                state = {"id": identity, "service": kind, "containerId": container_id, "status": "initializing"}
                states.append(state)
                if kind == "redis" and labels.get(PROXY) == "true":
                    backend_by_id[identity] = self.backend_by_id.get(identity, [])
                try:
                    detail = self.client.json("/containers/" + container_id + "/json")
                    inspected_labels = detail.get("Config", {}).get("Labels") or {}
                    # Desktop/container-list 会附加不在 Config.Labels 中的运行注释；只比较决定归属与代理边界的固定标签。
                    if any(inspected_labels.get(key) != labels.get(key) for key in SECURITY_LABELS):
                        raise GuardError("容器归属标签在读取期间变化。", 409)
                    if kind == "redis":
                        if labels.get(PROXY) != "true":
                            state.update(status="needs-migration", message="现有 Redis 未使用认证代理；ACL LOG 聚合不能准确按 IP 封禁。")
                            continue
                        networks = detail.get("NetworkSettings", {}).get("Networks", {})
                        # 标签已声明由认证代理接管：即使拓扑校验失败，也保留已知后端直连阻断。
                        backend_by_id[identity] = list({canonical_ip(address) for network in networks.values()
                                                       for address in (network.get("IPAddress"), network.get("GlobalIPv6Address")) if address})
                        expected = "mci-panel-" + owner + "-" + identity + "-guard"
                        ports = detail.get("HostConfig", {}).get("PortBindings") or {}
                        if set(networks) != {expected} or any(ports.values()) or detail.get("HostConfig", {}).get("NetworkMode") in ("host", "none"):
                            raise GuardError("Redis 后端必须使用独占网络且不能发布原始端口。", 503)
                        backend = canonical_ip(networks[expected].get("IPAddress", ""))
                        backend6 = networks[expected].get("GlobalIPv6Address", "")
                        port = int(labels.get(PROXY_PORT, "0"))
                        bind_input = labels.get(PROXY_BIND, "")
                        bind = str(ipaddress.ip_address(bind_input)) if bind_input in ("0.0.0.0", "::") else canonical_ip(bind_input)
                        if not 1 <= port <= 65535:
                            raise GuardError("Redis 代理端口标签无效。")
                        network_id = networks[expected].get("NetworkID", "")
                        if not re.fullmatch(r"[a-f0-9]{64}", network_id):
                            raise GuardError("Redis 网络身份缺失。", 503)
                        net = self.client.json("/networks/" + network_id)
                        if set((net.get("Containers") or {})) != {container_id}:
                            raise GuardError("Redis 独占网络中存在其它容器，代理可能被绕过。", 503)
                        entries.append({"id": identity, "bindAddress": bind, "listenPort": port,
                                        "backendHost": backend, "backendPort": 6379})
                        state.update(status="initializing", message="等待后端直连阻断与代理监听回读。")
                    else:
                        self._logs(container_id, kind, detail, state)
                except Exception as exc:
                    state.update(status="degraded", message=str(exc)[:300])
            backends = sorted({ip for addresses in backend_by_id.values() for ip in addresses})
            self.states, self.proxy_entries, self.redis_backends = states, entries, backends
            self.backend_by_id = backend_by_id
        except Exception as exc:
            # 发现失败不关闭既有代理，不删除既有后端隔离规则。
            self.states = [{"id": "docker", "service": "docker", "status": "degraded", "message": str(exc)[:300]}]
        return self.states

    def _logs(self, container_id, kind, detail, state):
        if detail.get("HostConfig", {}).get("LogConfig", {}).get("Type") not in ("json-file", "local", "journald"):
            raise GuardError("当前 Docker 日志驱动不在已支持读取范围。", 503)
        source = "docker:" + container_id
        cursor = self.store.cursor(source)
        if cursor is None:
            cursor = {"since": iso_time(time.time())}
            self.store.set_cursor(source, cursor)
        since = timestamp(cursor.get("since"))
        if since is None:
            raise GuardError("Docker 日志游标时间无效。", 503)
        # 原始 Engine API 接收 Unix 秒，CLI 才会替调用方转换 RFC3339。
        # 向下取整并重读本秒，原始纳秒游标和稳定事件 ID 避免截断精度漏读/重复计数。
        query = urllib.parse.urlencode({"stdout": "1", "stderr": "1", "timestamps": "1", "since": str(math.floor(since))})
        payload = self.client.get("/containers/" + container_id + "/logs?" + query)
        messages = docker_messages(payload, detail.get("Config", {}).get("Tty", False))
        seen_at_timestamp = collections.Counter()
        found_ip = False
        for date, line in messages:
            when = timestamp(date)
            if when < since:
                continue
            digest = hashlib.sha256(line.encode()).hexdigest()
            series = (date, digest)
            seen_at_timestamp[series] += 1
            ip = parse_failure(kind, line)
            if ip:
                self.report(ip, event_key(source, date+":"+str(seen_at_timestamp[series]), line), kind, occurred=when)
                found_ip = True
            self.store.set_cursor(source, {"since": date})
        # 能读取stdout不等于mysqld已启用认证错误日志；无证据时明确显示未验证。
        verified = found_ip or bool(self.store.cursor(source+":verified"))
        if found_ip:
            self.store.set_cursor(source+":verified", {"observedAt": time.time()})
        state.update(status="monitoring" if verified else "needs-verification", sourceReadable=True,
                     authenticationSourceVerified=verified, observedAt=time.time(),
                     message="已观察到含数字来源 IP 的真实认证失败；规则状态独立显示。" if verified else
                     ("尚未观察到可验证的认证失败。MySQL 需 log_error_verbosity=3 与数字来源 IP。" if kind == "mysql" else
                      "尚未观察到可验证的认证失败；需 MongoDB 认证日志含 client/remote 和失败原因。"))
