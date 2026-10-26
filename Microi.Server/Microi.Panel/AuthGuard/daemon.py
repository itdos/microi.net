#!/usr/bin/env python3
"""吾码宿主防爆破服务：root Unix socket 是唯一控制入口，不开放 TCP 管理端口。"""
from __future__ import annotations

import argparse
import contextlib
import http.server
import ipaddress
import json
import os
import signal
import socket
import socketserver
import stat
import struct
import sys
import threading
import time
from pathlib import Path

from collectors import DockerClient, DockerCollector, FileCollector, JournalCollector, UnixHTTP
from firewall import Firewall, run_command
from store import GuardError, Store, canonical_ip, validate_policy


def read_config(path):
    if not path or not os.path.exists(path):
        return {"ssh": {"enabled": True, "source": "auto"}, "docker": {"enabled": True}, "nativeLogs": []}
    info = os.lstat(path)
    if not stat.S_ISREG(info.st_mode) or (os.name != "nt" and (info.st_uid != 0 or info.st_mode & 0o077)):
        raise GuardError("宿主配置必须是 root 所有、权限 0600 的普通文件。")
    if info.st_size > 65536:
        raise GuardError("宿主配置超过 64 KiB。")
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict) or set(data) - {"ssh", "docker", "nativeLogs", "firewallBackend"}:
        raise GuardError("宿主配置字段无效。")
    ssh = data.setdefault("ssh", {"enabled": True, "source": "auto"})
    docker = data.setdefault("docker", {"enabled": True})
    logs = data.setdefault("nativeLogs", [])
    if not isinstance(ssh, dict) or set(ssh)-{"enabled", "source", "path"} or type(ssh.get("enabled", True)) is not bool or ssh.get("source", "auto") not in ("auto", "journal", "file"):
        raise GuardError("SSH 日志配置无效。")
    if not isinstance(docker, dict) or set(docker)-{"enabled", "socketPath"} or type(docker.get("enabled", True)) is not bool:
        raise GuardError("Docker 配置无效。")
    if not isinstance(logs, list) or len(logs) > 32:
        raise GuardError("本机日志源最多 32 个。")
    identities = set()
    for item in logs:
        if not isinstance(item, dict) or set(item)-{"id", "kind", "path"} or item.get("kind") not in ("mysql", "mongodb"):
            raise GuardError("原生日志仅支持 mysql/mongodb。")
        if not isinstance(item.get("id"), str) or not 1 <= len(item["id"]) <= 80 or item["id"] in identities:
            raise GuardError("原生日志标识缺失或重复。")
        identities.add(item["id"])
    paths = [item.get("path") for item in logs]
    if ssh.get("source") == "file":
        paths.append(ssh.get("path"))
    paths.append(docker.get("socketPath", "/var/run/docker.sock"))
    if any(not isinstance(path, str) or not path.startswith("/") or "\0" in path or len(path) > 512 for path in paths):
        raise GuardError("宿主日志和 Docker socket 必须使用明确绝对路径。")
    if data.get("firewallBackend", "auto") not in ("auto", "nftables", "iptables"):
        raise GuardError("防火墙后端无效。")
    return data


class Guard:
    """串行处理策略/规则更改；对外成功必须包含独立防火墙回读。"""
    def __init__(self, store, firewall, config=None, proxy=None):
        self.store, self.firewall = store, firewall
        self.config = config or {"ssh": {"enabled": False}, "docker": {"enabled": False}, "nativeLogs": []}
        self.lock = threading.RLock()
        self.stop = threading.Event()
        self.local_ips = set()
        self.adapters = []
        self.last_error = ""
        self.capacity_error = ""
        self.initialized = False
        self.runtime_error = ""
        self.redis_backends = []
        self.last_sync = 0
        self.proxy = proxy
        self.collectors = []
        ssh = self.config.get("ssh", {})
        if ssh.get("enabled", True):
            source = ssh.get("source", "auto")
            if source == "auto":
                source = "journal" if os.path.isdir("/run/systemd/journal") else "file"
            if source == "journal":
                self.collectors.append(JournalCollector(store, self.failure))
            else:
                path = ssh.get("path") or next((p for p in ("/var/log/auth.log", "/var/log/secure") if os.path.isfile(p)), "/var/log/auth.log")
                self.collectors.append(FileCollector(store, self.failure, {"id": "ssh", "kind": "ssh", "path": path}))
        for source in self.config.get("nativeLogs", []):
            self.collectors.append(FileCollector(store, self.failure, source))
        self.docker = DockerCollector(store, self.failure, DockerClient(self.config.get("docker", {}).get("socketPath", "/var/run/docker.sock"))) if self.config.get("docker", {}).get("enabled", True) else None

    def load_local_ips(self):
        try:
            result = run_command(["ip", "-j", "address", "show"])
            ips = set()
            for interface in json.loads(result.stdout):
                for address in interface.get("addr_info", []):
                    ips.add(canonical_ip(address["local"]))
            self.local_ips = ips
        except Exception:
            # 回环始终安全豁免；缺少本机地址盘点明确保留诊断。
            self.last_error = "无法读取本机地址；仅回环与显式白名单自动豁免。"

    def is_banned(self, ip):
        policy = self.policy()
        return policy["enabled"] and not self.store.allowed(ip, policy, self.local_ips) and self.store.ban(ip) is not None

    def active_bans(self, policy=None):
        policy = policy or self.policy()
        return [ban for ban in self.store.bans() if not ban["pendingRemoval"] and not self.store.allowed(ban["ip"], policy, self.local_ips)]

    def sync(self):
        with self.lock:
            policy = self.store.policy()
            try:
                actual = self.firewall.sync(self.active_bans(policy), policy["enabled"], self.redis_backends)
                self.store.expire(actual)
                self.store.mark_applied(actual)
                self.last_sync = time.time()
                return True
            except Exception as exc:
                self.store.mark_applied([], str(exc))
                self.last_error = str(exc)[:300]
                return False

    def failure(self, ip, event_id, service, occurred=None):
        ip = canonical_ip(ip)
        with self.lock:
            previous = self.store.ban(ip)
            if previous and previous["pendingRemoval"]:
                self.sync()
            try:
                result = self.store.failure(ip, event_id, service, occurred, self.local_ips)
                self.capacity_error = ""
            except GuardError as exc:
                if exc.status == 503:
                    self.capacity_error = str(exc)
                raise
            if result.get("banned") and not (result.get("ban") or {}).get("applied"):
                self.sync()
            result["ban"] = self.store.ban(ip)
            result["policy"] = self.store.policy()
            result.update(self.store.receipt(ip, self.local_ips))
            result["observedAt"] = time.time()
            result["ip"] = ip
            result["firewall"] = self.firewall_status()
            return result

    def policy(self):
        return self.store.policy()

    def update_policy(self, body):
        with self.lock:
            current = self.policy()
            proposed = validate_policy(body, current)
            bans = self.active_bans(proposed)
            # 禁用/白名单调整先验证规则移除，再保存新策略，避免页面显示已解除而内核仍在拦截。
            actual = self.firewall.sync(bans, proposed["enabled"], self.redis_backends)
            result = self.store.update_policy(body)
            self.store.mark_applied(actual)
            self.last_sync = time.time()
            return {"policy": result, "firewall": self.firewall.status()}

    def unban(self, ip):
        ip = canonical_ip(ip)
        with self.lock:
            desired = [b for b in self.active_bans() if b["ip"] != ip]
            try:
                actual = self.firewall.sync(desired, self.policy()["enabled"], self.redis_backends)
            except Exception as exc:
                self.last_error = str(exc)[:300]
                raise GuardError("网络解封回读失败，原封禁台账已保留。", 503) from exc
            if ip in actual:
                raise GuardError("网络解封回读仍发现该 IP。", 503)
            self.store.unban(ip)
            self.store.mark_applied(actual)
            self.last_sync = time.time()
            return {"ip": ip, "banned": False, "removed": True, "firewallVerified": True, "policy": self.policy()}

    def status(self):
        with self.lock:
            firewall = self.firewall_status()
            policy = self.policy()
            if not policy["enabled"]:
                health = "disabled" if firewall.get("verified") else "degraded"
            elif self.runtime_error or self.capacity_error or not firewall.get("verified") or any(a.get("status") in ("degraded", "needs-migration", "needs-verification", "initializing") for a in self.adapters):
                health = "degraded"
            elif not self.initialized and (self.collectors or self.docker):
                health = "initializing"
            else:
                health = "monitoring"
            return {"protocol": 1, "policy": policy, "health": health, "adapters": list(self.adapters),
                    "firewall": firewall, "bans": self.store.bans(), "statistics": self.store.summary(),
                    "observedAt": time.time(), "lastError": self.runtime_error or self.capacity_error or self.last_error,
                    "semantics": "跨服务累计同一来源 IP；windowSeconds=0 表示累计至解封。网络实测另行验收。"}

    def firewall_status(self):
        state = self.firewall.status()
        if self.last_sync and time.time() - self.last_sync > 30:
            state.update(verified=False, status="degraded", message="防火墙回读超过 30 秒，旧状态不能证明当前拦截。", stale=True)
        return state

    def dispatch(self, method, path, body=None):
        body = {} if body is None else body
        if not isinstance(body, dict):
            raise GuardError("JSON 请求必须为对象。")
        if method == "GET" and path == "/status":
            return self.status()
        if method == "PUT" and path == "/policy":
            return self.update_policy(body)
        if method == "POST" and path == "/unban" and set(body) == {"ip"}:
            return self.unban(body["ip"])
        if method == "POST" and path == "/check" and set(body) == {"ip"}:
            ip = canonical_ip(body["ip"])
            with self.lock:
                return {"ip": ip, "banned": self.is_banned(ip), "policy": self.policy(),
                        "firewall": self.firewall_status(), "observedAt": time.time(), **self.store.receipt(ip, self.local_ips)}
        if method == "POST" and path == "/failures":
            if set(body)-{"ip", "eventId", "service", "occurredAt"} or body.get("service") != "panel":
                raise GuardError("该控制入口仅接收受信面板的认证失败。")
            return self.failure(body.get("ip"), body.get("eventId"), "panel", body.get("occurredAt"))
        raise GuardError("不支持的防护控制请求。", 404)

    def poll(self):
        states = [collector.poll() for collector in self.collectors]
        if self.docker:
            states.extend(self.docker.poll())
            self.redis_backends = self.docker.redis_backends
        ready = self.sync()
        if self.proxy and self.docker:
            if ready:
                proxy_states = self.proxy.reconcile(self.docker.proxy_entries)
            else:
                # 已建立代理继续运行且自身执行ban检查；新代理不在隔离规则失败时开放。
                proxy_states = self.proxy.status()
            by_id = {item["id"]: item for item in proxy_states}
            for state in states:
                if state.get("service") == "redis" and state.get("status") == "initializing":
                    proxy = by_id.get(state["id"], {})
                    listening = ready and proxy.get("state") == "listening"
                    state.update(status="protecting" if listening else "degraded", proxy=proxy,
                                 message="代理已监听，后端直连阻断和封禁规则已回读。" if listening else "Redis 代理或宿主阻断未就绪。")
        if not self.policy()["enabled"]:
            for state in states:
                if state.get("status") == "protecting":
                    state.update(status="disabled", message="代理仍转发，认证防护策略已关闭。")
        with self.lock:
            self.adapters = states
            self.initialized = True

    def run(self):
        self.load_local_ips()
        iteration = 0
        while not self.stop.is_set():
            try:
                self.poll()
                self.runtime_error = ""
                iteration += 1
                if iteration % 20 == 0:
                    self.store.prune()
                    self.load_local_ips()
            except Exception as exc:
                self.runtime_error = str(exc)[:300]
            self.stop.wait(3)


class ControlServer(socketserver.ThreadingMixIn, getattr(socketserver, "UnixStreamServer", socketserver.TCPServer)):
    daemon_threads = True
    request_queue_size = 16
    def __init__(self, path, guard):
        if not hasattr(socketserver, "UnixStreamServer"):
            raise GuardError("当前系统不支持宿主 Unix socket 控制服务。", 503)
        self.guard = guard
        self.slots = threading.BoundedSemaphore(16)
        super().__init__(path, ControlHandler)

    def verify_request(self, request, client_address):
        request.settimeout(3)
        try:
            _, uid, _ = struct.unpack("3i", request.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
            return uid == 0
        except (OSError, AttributeError):
            return False

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()


class ControlHandler(http.server.BaseHTTPRequestHandler):
    server_version = "MicroiAuthGuard/1"
    def log_message(self, *_):
        pass

    def _handle(self):
        status_code = 200
        try:
            if self.headers.get("Transfer-Encoding") or self.headers.get("Expect"):
                raise GuardError("不支持分块或 Expect 请求。")
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 <= size <= 65536:
                raise GuardError("控制请求超过 64 KiB。", 413)
            raw = self.rfile.read(size) if size else b""
            if len(raw) != size:
                raise GuardError("控制请求未完整接收。")
            body = json.loads(raw) if raw else {}
            result = self.server.guard.dispatch(self.command, self.path, body)
        except GuardError as exc:
            status_code, result = exc.status, {"error": str(exc)}
        except (ValueError, TypeError):
            status_code, result = 400, {"error": "JSON 或请求长度无效。"}
        except Exception:
            status_code, result = 503, {"error": "防护控制执行失败，请查看宿主服务状态。"}
        payload = json.dumps(result, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    do_GET = do_PUT = do_POST = _handle


def private_directory(path):
    value = Path(path)
    if not value.is_absolute():
        raise GuardError("运行路径必须是绝对路径。")
    # 不跟随预先种植的软链接；标准路径不需要 /var/run 兼容链接。
    for ancestor in [value, *value.parents]:
        if ancestor.is_symlink():
            raise GuardError("运行路径不能经过软链接。")
    value.mkdir(mode=0o700, parents=True, exist_ok=True)
    info = value.stat()
    if info.st_uid != 0 or info.st_mode & 0o077:
        raise GuardError("运行目录必须属于 root 且权限 0700。")
    return value


def check_environment(config):
    errors = []
    if sys.version_info < (3, 9):
        errors.append("宿主服务需要 Python 3.9 或更新版本。")
    if sys.platform != "linux" or not hasattr(os, "geteuid") or os.geteuid() != 0:
        errors.append("宿主服务需要 Linux root。")
    firewall = Firewall(config.get("firewallBackend", "auto"))
    try:
        firewall.select()
        if firewall.backend == "iptables":
            for binary in ("iptables", "ip6tables"):
                run_command([binary, "-w", "5", "-S", "INPUT"])
        else:
            run_command(["nft", "-j", "list", "tables"])
    except Exception as exc:
        errors.append(str(exc))
    try:
        import redis_proxy  # noqa: F401
    except ImportError:
        errors.append("发行包缺少 redis_proxy.py 或运行时依赖。")
    return {"protocol": 1, "ready": not errors, "errors": errors, "firewallBackend": firewall.backend,
            "ruleChanges": False, "message": "只读预检不等于真实防护验收。"}


def main(argv=None):
    parser = argparse.ArgumentParser(description="吾码宿主认证防护服务")
    parser.add_argument("--state-dir", default="/var/lib/microi-auth-guard")
    parser.add_argument("--socket", default="/run/microi-auth-guard/control.sock")
    parser.add_argument("--config", default="/etc/microi-auth-guard/config.json")
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument("--check", action="store_true")
    actions.add_argument("--verify-ready", action="store_true")
    actions.add_argument("--unban", metavar="IP", help="以 root 调用现有控制 socket，移除指定 IP 封禁并回读")
    parser.add_argument("--strict-coverage", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.unban is not None:
            if not hasattr(os, "geteuid") or os.geteuid() != 0:
                raise GuardError("控制台解封需要 Linux root。", 403)
            ip = canonical_ip(args.unban)
            connection = UnixHTTP(args.socket)
            try:
                connection.request("POST", "/unban", body=json.dumps({"ip": ip}).encode(),
                                   headers={"Content-Type": "application/json"})
                response = connection.getresponse()
                raw = response.read(65537)
                if len(raw) > 65536:
                    raise GuardError("解封回执超过安全上限。", 503)
                receipt = json.loads(raw)
                if response.status != 200:
                    raise GuardError("控制服务未确认解封：" + str(receipt.get("error", "请求失败"))[:300], 503)
                if receipt.get("ip") != ip or receipt.get("banned") is not False or receipt.get("removed") is not True or receipt.get("firewallVerified") is not True:
                    raise GuardError("解封回执未包含完整的内核移除确认。", 503)
                print(json.dumps(receipt, ensure_ascii=False))
                return 0
            finally:
                connection.close()
        if args.verify_ready:
            connection = UnixHTTP(args.socket)
            try:
                connection.request("GET", "/status")
                response = connection.getresponse()
                raw = response.read(4*1024*1024+1)
                if response.status != 200 or len(raw) > 4*1024*1024:
                    raise GuardError("防护状态回读失败。", 503)
                status = json.loads(raw)
                complete = status.get("health") in ("monitoring", "protecting")
                ready = status.get("firewall", {}).get("verified") is True and (complete or not args.strict_coverage)
                print(json.dumps({"ready": ready, "health": status.get("health"), "firewall": status.get("firewall"),
                                  "coverage": "complete" if complete else "partial",
                                  "adapters": status.get("adapters"), "observedAt": status.get("observedAt")}, ensure_ascii=False))
                return 0 if ready else 1
            finally:
                connection.close()
        config = read_config(args.config)
        preflight = check_environment(config)
        if args.check:
            print(json.dumps(preflight, ensure_ascii=False))
            return 0 if preflight["ready"] else 1
        if not preflight["ready"]:
            raise GuardError("；".join(preflight["errors"]))
        os.umask(0o077)
        state = private_directory(args.state_dir)
        runtime = private_directory(str(Path(args.socket).parent))
        import fcntl
        lock = open(runtime / "agent.lock", "a+")
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        socket_path = Path(args.socket)
        if socket_path.exists():
            if not stat.S_ISSOCK(socket_path.lstat().st_mode):
                raise GuardError("控制路径已被非 socket 对象占用。")
            socket_path.unlink()
        store = Store(state / "guard.sqlite3")
        guard = Guard(store, Firewall(config.get("firewallBackend", "auto")), config)
        from redis_proxy import RedisProxyManager
        guard.proxy = RedisProxyManager(guard.failure, guard.is_banned, guard.policy)
        server = ControlServer(args.socket, guard)
        os.chmod(args.socket, 0o600)
        # 初始规则必须回读；日志/服务能力继续通过状态单独报告，不以systemd active替代。
        if not guard.sync():
            server.server_close()
            raise GuardError("防火墙初始化未通过回读。")
        worker = threading.Thread(target=guard.run, name="microi-guard-collector", daemon=True)
        worker.start()
        def stop(*_):
            guard.stop.set()
            threading.Thread(target=server.shutdown, daemon=True).start()
        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        try:
            server.serve_forever(poll_interval=0.5)
        finally:
            guard.stop.set()
            worker.join(timeout=20)
            guard.proxy.close()
            server.server_close()
            if socket_path.exists() and stat.S_ISSOCK(socket_path.lstat().st_mode):
                socket_path.unlink()
            store.close()
            lock.close()
        return 0
    except Exception as exc:
        print(json.dumps({"ready": False, "error": str(exc)[:400]}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
