#!/usr/bin/env python3
"""Explicitly invoked, isolated Linux security acceptance on Docker Desktop.

Never uses host networking, host PID namespaces, privileged containers, or host
firewall commands. All firewall operations run in the registered router's own
network namespace. Requires explicit authorization to create this small lab.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import http.client
import http.server
import ipaddress
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import socket
import socketserver
import subprocess
import sys
import threading
import time
import urllib.parse
import uuid

sys.dont_write_bytecode = True
LABEL = "io.microi.security-lab.owner"


class UnixHTTP(http.client.HTTPConnection):
    def __init__(self, path, timeout=5):
        super().__init__("localhost", timeout=timeout)
        self.path = path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.path)


def unix_call(path, method, route, body=None):
    connection = UnixHTTP(path)
    try:
        connection.request(method, route, None if body is None else json.dumps(body),
                           {"Content-Type": "application/json"})
        response = connection.getresponse()
        raw = response.read(8 * 1024 * 1024)
        if response.status != 200:
            raise RuntimeError("control_http_" + str(response.status) + ":" + raw[:600].decode(errors="replace"))
        return json.loads(raw)
    finally:
        connection.close()


def inside(role):
    if role == "control":
        value = json.load(sys.stdin)
        result = unix_call("/run/microi-auth-guard/control.sock", value["method"], value["path"], value.get("body"))
        print(json.dumps(result))
    elif role == "client":
        request = json.load(sys.stdin)
        kind, host, password = request["kind"], request["host"], request["password"]
        result = {"success": False, "reason": "connection"}
        try:
            if kind == "ssh":
                env = dict(os.environ, SSHPASS=password)
                run = subprocess.run(["sshpass", "-e", "ssh", "-o", "PreferredAuthentications=password",
                                      "-o", "NumberOfPasswordPrompts=1", "-o", "StrictHostKeyChecking=no",
                                      "-o", "UserKnownHostsFile=/dev/null", "-o", "LogLevel=ERROR",
                                      "-o", "ConnectTimeout=3", "guardtest@" + host, "true"], env=env,
                                     capture_output=True, timeout=10)
                result = {"success": run.returncode == 0, "reason": "ok" if run.returncode == 0 else
                          ("authentication" if b"Permission denied" in run.stderr else "connection"),
                          "diagnostic": run.stderr.decode(errors="replace").replace(password, "[redacted]")[:300]}
            elif kind == "redis":
                with socket.create_connection((host, request.get("port", 16379)), timeout=3) as connection:
                    raw = password.encode()
                    connection.sendall(b"*2\r\n$4\r\nAUTH\r\n$" + str(len(raw)).encode() + b"\r\n" + raw + b"\r\n")
                    response = connection.makefile("rb").readline(1024)
                    result = {"success": response == b"+OK\r\n", "reason": "ok" if response == b"+OK\r\n" else
                              ("authentication" if response.startswith(b"-WRONGPASS") else "connection")}
            elif kind == "mysql":
                import pymysql
                connection = pymysql.connect(host=host, user="root", password=password, connect_timeout=3,
                                             read_timeout=3, write_timeout=3)
                try:
                    with connection.cursor() as cursor:
                        cursor.execute("SELECT 1")
                        result = {"success": cursor.fetchone()[0] == 1, "reason": "ok"}
                finally:
                    connection.close()
            elif kind == "mongodb":
                from pymongo import MongoClient
                with MongoClient(host, username="guardtest", password=password, authSource="admin",
                                 serverSelectionTimeoutMS=3000, connectTimeoutMS=3000, socketTimeoutMS=3000,
                                 maxPoolSize=1, minPoolSize=0, directConnection=True) as connection:
                    result = {"success": connection.admin.command("ping")["ok"] == 1, "reason": "ok"}
            elif kind == "tcp":
                with socket.create_connection((host, request["port"]), timeout=2):
                    result = {"success": True, "reason": "ok"}
        except Exception as error:
            # 只输出错误类别，不输出供应商异常中可能出现的用户名、连接串和口令。
            code = getattr(error, "code", None)
            if code == 18 or (getattr(error, "args", None) and error.args[0] == 1045):
                result["reason"] = "authentication"
        print(json.dumps(result))
    elif role == "api":
        owner = os.environ["LAB_OWNER"]
        path = "/run/lab-docker.sock"

        def docker_get(route):
            connection = UnixHTTP("/var/run/docker.sock")
            try:
                connection.request("GET", route)
                response = connection.getresponse()
                raw = response.read(8 * 1024 * 1024 + 1)
                if len(raw) > 8 * 1024 * 1024:
                    raise ValueError("lab_api_limit")
                return response.status, raw, response.getheader("Content-Type", "application/json")
            finally:
                connection.close()

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_GET(self):
                try:
                    route = urllib.parse.urlsplit(self.path)
                    bits = route.path.strip("/").split("/")
                    if route.path == "/containers/json":
                        query = urllib.parse.parse_qs(route.query)
                        filters = json.loads(query.get("filters", ["{}"])[0])
                        filters.setdefault("label", []).append(LABEL + "=" + owner)
                        query["filters"] = [json.dumps(filters)]
                        target = route.path + "?" + urllib.parse.urlencode(query, doseq=True)
                    elif len(bits) >= 2 and bits[0] in ("containers", "networks"):
                        target = self.path
                        inspection = "/" + bits[0] + "/" + bits[1] + ("/json" if bits[0] == "containers" else "")
                        status, raw, _ = docker_get(inspection)
                        entity = json.loads(raw)
                        labels = entity.get("Config", {}).get("Labels", {}) if bits[0] == "containers" else entity.get("Labels", {})
                        if status != 200 or labels.get(LABEL) != owner:
                            raise ValueError("unowned_docker_object")
                        if bits[0] == "containers" and (len(bits) != 3 or bits[2] not in ("json", "logs")):
                            raise ValueError("unsupported_read")
                    else:
                        raise ValueError("unsupported_read")
                    status, raw, content_type = docker_get(target)
                except Exception as error:
                    status, raw, content_type = 403, b'{"error":"lab read scope denied"}', "application/json"
                    with open("/run/lab-api-errors.jsonl", "a") as log:
                        log.write(json.dumps({"path": self.path, "error": str(error)[:500]}) + "\n")
                if status != 200:
                    with open("/run/lab-api-errors.jsonl", "a") as log:
                        log.write(json.dumps({"path": self.path, "status": status, "body": raw[:500].decode(errors="replace")}) + "\n")
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

        class Server(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
            daemon_threads = True
        if os.path.exists(path):
            os.unlink(path)
        with Server(path, Handler) as server:
            os.chmod(path, 0o600)
            server.serve_forever()
    else:
        raise ValueError("unknown_lab_role")


DOCKERFILE = """FROM registry.cn-hangzhou.aliyuncs.com/microios/dotnet-aspnet:10.0.13
USER root
RUN sed -i 's|http://archive.ubuntu.com/ubuntu|https://mirrors.aliyun.com/ubuntu|g;s|http://security.ubuntu.com/ubuntu|https://mirrors.aliyun.com/ubuntu|g' /etc/apt/sources.list.d/ubuntu.sources && apt-get -o Acquire::Retries=1 -o Acquire::https::Timeout=30 update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3 python3-venv openssh-server openssh-client sshpass rsyslog nftables iptables iproute2 ca-certificates && python3 -m venv /opt/lab && /opt/lab/bin/pip install --no-cache-dir PyMySQL==1.1.1 pymongo==4.10.1 cryptography==44.0.3 && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/sh guardtest && mkdir -p /run/sshd && ssh-keygen -A && printf 'Port 22\\nListenAddress 0.0.0.0\\nListenAddress ::\\nPasswordAuthentication yes\\nKbdInteractiveAuthentication no\\nPermitRootLogin no\\nUsePAM no\\nLogLevel INFO\\nSubsystem sftp internal-sftp\\n' > /etc/ssh/sshd_config && printf 'module(load="imuxsock")\\n$ActionFileDefaultTemplate RSYSLOG_TraditionalFileFormat\\nauth,authpriv.* /var/log/auth.log\\n' > /etc/rsyslog.conf
ENV PYTHONDONTWRITEBYTECODE=1
ENTRYPOINT ["/bin/sh", "-c", "mkdir -p /run/sshd; rsyslogd -n -i /run/rsyslogd.pid & exec /usr/sbin/sshd -D"]
"""


class Lab:
    def __init__(self, scratch, keep_image=False, tools_image=None):
        self.owner = "ag" + uuid.uuid4().hex[:10]
        self.root = scratch / ("lab-" + self.owner)
        self.root.mkdir(parents=True)
        self.keep_image = keep_image or bool(tools_image)
        self.password = secrets.token_hex(24)
        self.containers, self.networks, self.volumes = [], [], []
        self.image = tools_image or "microi-auth-guard-lab:" + self.owner
        self.tools_image = tools_image
        self.guard_process = None
        self.process_handles = []
        self.report = {"owner": self.owner, "startedAt": time.time(), "checks": [], "images": {},
                       "scope": "isolated Linux namespaces; not a customer deployment", "cleanup": {}}
        self.source = Path(__file__).resolve().parents[1]
        self.file = Path(__file__).resolve()
        self.guard = self.owner + "-guard"
        self.client_a, self.client_b = self.owner + "-a", self.owner + "-b"
        self.ipv6 = True
        self.api_process = None
        self.write("owner.json", {"owner": self.owner, "purpose": "authorized isolated auth guard acceptance"})
        self.write("runner-process.json", {"owner": self.owner, "pid": os.getpid(), "startedAt": time.time()})

    def write(self, name, data):
        path = self.root / name
        path.write_text(data if isinstance(data, str) else json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def command(self, arguments, *, payload=None, timeout=60, check=True):
        run = subprocess.run(["docker", *arguments], input=payload, text=True, encoding="utf-8", errors="replace",
                             capture_output=True, timeout=timeout)
        if check and run.returncode:
            error = run.stderr.replace(self.password, "[redacted]")
            raise RuntimeError("docker " + " ".join(arguments[:2]) + " failed: " + error[-1200:])
        return run

    def inspect(self, kind, identity):
        return json.loads(self.command([kind, "inspect", identity]).stdout)[0]

    def own(self, kind, identity):
        item = self.inspect(kind, identity)
        labels = item.get("Config", {}).get("Labels", {}) if kind in ("container", "image") else item.get("Labels", {})
        if labels.get(LABEL) != self.owner:
            raise RuntimeError("refusing operation on unowned " + kind)
        return item

    def check(self, label, condition, detail=None):
        entry = {"name": label, "passed": bool(condition)}
        if detail is not None:
            entry["detail"] = detail
        self.report["checks"].append(entry)
        print(json.dumps({"check": label, "passed": bool(condition)}, ensure_ascii=False), flush=True)
        self.write("report.json", self.report)
        if not condition:
            raise AssertionError(label)

    def wait(self, callback, seconds=30):
        deadline, last = time.monotonic() + seconds, None
        while time.monotonic() < deadline:
            try:
                value = callback()
                if value:
                    return value
            except Exception as error:
                last = error
            time.sleep(0.5)
        raise TimeoutError("lab readiness timeout" + (":" + str(last)[:300] if last else ""))

    def build(self):
        self.write("Dockerfile", DOCKERFILE)
        code = self.root / "code"
        code.mkdir()
        hashes = {}
        for source in self.source.glob("*.py"):
            raw = source.read_bytes()
            (code / source.name).write_bytes(raw)
            hashes[source.name] = hashlib.sha256(raw).hexdigest()
        self.report["sourceHashes"] = hashes
        if self.tools_image:
            self.report["images"]["tools"] = self.inspect("image", self.image)["Id"]
            return
        log = open(self.root / "build.log", "w", encoding="utf-8")
        try:
            process = subprocess.Popen(["docker", "build", "--label", LABEL + "=" + self.owner,
                                        "-t", self.image, "-f", str(self.root / "Dockerfile"), str(self.root)],
                                       stdout=log, stderr=subprocess.STDOUT, text=True)
            self.write("build-process.json", {"pid": process.pid, "owner": self.owner, "startedAt": time.time()})
            try:
                while process.poll() is None:
                    print(json.dumps({"phase": "building-lab-tools", "pid": process.pid}), flush=True)
                    time.sleep(15)
                if process.returncode:
                    raise RuntimeError("lab tools build failed; see registered build.log")
            finally:
                if process.poll() is None:
                    process.terminate()
                    process.wait(timeout=30)
        finally:
            log.close()
        self.report["images"]["tools"] = self.inspect("image", self.image)["Id"]

    def network(self, name, subnet, subnet6):
        args = ["network", "create", "--label", LABEL + "=" + self.owner, "--subnet", subnet,
                "--opt", "com.docker.network.bridge.enable_ip_masquerade=false",
                "--opt", "com.docker.network.bridge.gateway_mode_ipv4=nat-unprotected"]
        if self.ipv6:
            args += ["--ipv6", "--subnet", subnet6, "--opt", "com.docker.network.bridge.gateway_mode_ipv6=nat-unprotected"]
        args.append(name)
        try:
            result = self.command(args)
        except BaseException:
            # Docker 创建结果未知时按本次精确名称和随机归属标签回读，防止泄漏半创建对象。
            try:
                existing = self.own("network", name)
                self.networks.append(existing["Id"])
            except Exception:
                pass
            raise
        identity = result.stdout.strip()
        self.networks.append(identity)
        self.write("resources.json", {"containers": self.containers, "networks": self.networks, "volumes": self.volumes})
        return name

    def run(self, name, image, args=(), command=(), network=None, ip=None, ip6=None, memory="192m", entrypoint=None):
        argv = ["run", "-d", "--name", name, "--label", LABEL + "=" + self.owner,
                "--memory", memory, "--memory-swap", memory, "--cpus", "1", "--pids-limit", "256"]
        if network:
            argv += ["--network", network]
        if ip:
            argv += ["--ip", ip]
        if ip6 and self.ipv6:
            argv += ["--ip6", ip6]
        if entrypoint:
            argv += ["--entrypoint", entrypoint]
        argv += list(args) + [image] + list(command)
        try:
            result = self.command(argv, timeout=60)
        except BaseException:
            try:
                existing = self.own("container", name)
                self.containers.append(existing["Id"])
            except Exception:
                pass
            raise
        identity = result.stdout.strip()
        self.containers.append(identity)
        self.write("resources.json", {"containers": self.containers, "networks": self.networks, "volumes": self.volumes})
        return identity

    def exec(self, name, command, payload=None, check=True, timeout=30):
        self.own("container", name)
        return self.command(["exec", "-i", name, *command], payload=payload, check=check, timeout=timeout)

    def python(self, name, role, body=None, timeout=30):
        result = self.exec(name, ["/opt/lab/bin/python", "-B", "/lab/test.py", "--inside", role],
                           None if body is None else json.dumps(body), timeout=timeout)
        return json.loads(result.stdout)

    def control(self, method="GET", path="/status", body=None):
        return self.python(self.guard, "control", {"method": method, "path": path, "body": body})

    def configure(self, backend):
        configuration = {"firewallBackend": backend, "ssh": {"enabled": True, "source": "file", "path": "/var/log/auth.log"},
                         "docker": {"enabled": True, "socketPath": "/run/lab-docker.sock"}, "nativeLogs": []}
        self.exec(self.guard, ["python3", "-c", "import sys,os; p='/etc/lab-guard.json';open(p,'w').write(sys.stdin.read());os.chmod(p,0o600)"], json.dumps(configuration))

    def start_guard(self):
        log = open(self.root / "guard.log", "a", encoding="utf-8")
        process = subprocess.Popen(["docker", "exec", self.guard, "python3", "-B", "/code/daemon.py", "--config", "/etc/lab-guard.json"],
                                   stdout=log, stderr=subprocess.STDOUT, text=True)
        self.guard_process = process
        self.process_handles.append(log)
        self.wait(lambda: self.control()["firewall"]["verified"], 30)

    def stop_guard(self):
        if self.guard_process is None:
            return
        program = "import os,signal;[(os.kill(int(p),signal.SIGTERM)) for p in os.listdir('/proc') if p.isdigit() and b'/code/daemon.py' in open('/proc/'+p+'/cmdline','rb').read().split(b'\\0')]"
        self.exec(self.guard, ["python3", "-c", program])
        self.guard_process.wait(timeout=30)
        self.guard_process = None

    def attempt(self, client, kind, target, valid=True, port=None):
        body = {"kind": kind, "host": target, "password": self.password if valid else "not-the-lab-password"}
        if port:
            body["port"] = port
        return self.python(client, "client", body, timeout=20)

    def unban(self, ip):
        result = self.control("POST", "/unban", {"ip": ip})
        self.check("manual-unban:" + ip, result["removed"] and result["firewallVerified"])

    def fail_three(self, client, ip, kind, target):
        for expected in range(1, 4):
            result = self.attempt(client, kind, target, False)
            # 第三次错误在写回响应前持久化并下发内核规则，客户端可能直接看到断线/超时。
            self.check(kind + ":authentication-error:" + str(expected), not result["success"] and
                       result["reason"] in (("authentication", "connection") if expected == 3 else ("authentication",)))
            self.wait(lambda: next((row for row in self.control()["statistics"]["counters"] if row["ip"] == ip and row["count"] == expected), None), 20)
        status = self.control()
        ban = next((row for row in status["bans"] if row["ip"] == ip), None)
        self.check(kind + ":third-failure-kernel-ban", ban and ban["applied"])
        return ban

    def prove_block(self, client, kind, target, label):
        result = self.attempt(client, kind, target)
        self.check(label, not result["success"] and result["reason"] == "connection", result)

    def remove_container(self, identity):
        self.own("container", identity)
        self.command(["rm", "-f", "-v", identity])
        self.containers.remove(identity)

    def setup(self):
        listed = json.loads(self.command(["network", "inspect", *self.command(["network", "ls", "-q"]).stdout.split()]).stdout)
        occupied = [ipaddress.ip_network(item["Subnet"]) for net in listed for item in (net.get("IPAM", {}).get("Config") or []) if item.get("Subnet")]
        candidates = []
        for second in range(28, 32):
            for third in range(10, 250):
                net = ipaddress.ip_network(f"172.{second}.{third}.0/24")
                if not any(net.version == old.version and net.overlaps(old) for old in occupied):
                    candidates.append(net)
                if len(candidates) == 3:
                    break
            if len(candidates) == 3:
                break
        if len(candidates) != 3:
            raise RuntimeError("no isolated test subnet available")
        self.ext, self.redis_net, self.db_net = map(str, candidates)
        base6 = "fd42:" + self.owner[2:6] + ":" + self.owner[6:10]
        self.ext6, self.redis6, self.db6 = (base6 + ":" + str(i) + "::/64" for i in (1, 2, 3))
        self.guard_ip, self.a_ip, self.b_ip = (str(candidates[0][i]) for i in (2, 10, 11))
        ext6 = ipaddress.ip_network(self.ext6)
        self.guard_ip6, self.a_ip6, self.b_ip6 = (str(ext6[i]) for i in (2, 10, 11))
        external = self.network(self.owner + "-external", self.ext, self.ext6)
        mounts = ["--mount", "type=bind,source=" + str(self.file) + ",target=/lab/test.py,readonly"]
        self.run(self.guard, self.image, [*mounts, "--mount", "type=bind,source=" + str(self.root / "code") + ",target=/code,readonly",
                 "--mount", "type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock,readonly",
                 "--cap-add", "NET_ADMIN", "--sysctl", "net.ipv4.ip_forward=1", "--sysctl", "net.ipv6.conf.all.forwarding=1",
                 "--sysctl", "net.ipv4.conf.all.send_redirects=0", "--sysctl", "net.ipv4.conf.default.send_redirects=0",
                 "--env", "LAB_OWNER=" + self.owner], network=external, ip=self.guard_ip, ip6=self.guard_ip6)
        for name, address, address6 in ((self.client_a, self.a_ip, self.a_ip6), (self.client_b, self.b_ip, self.b_ip6)):
            self.run(name, self.image, [*mounts, "--cap-add", "NET_ADMIN", "--sysctl", "net.ipv4.conf.all.accept_redirects=0",
                                       "--sysctl", "net.ipv4.conf.default.accept_redirects=0", "--sysctl", "net.ipv6.conf.all.accept_redirects=0"], ["infinity"], network=external,
                     ip=address, ip6=address6, memory="128m", entrypoint="sleep")
            for network, network6 in ((self.redis_net, self.redis6), (self.db_net, self.db6)):
                self.exec(name, ["ip", "route", "add", network, "via", self.guard_ip])
                self.exec(name, ["ip", "-6", "route", "add", network6, "via", self.guard_ip6])
        # Windows text 管道会把 LF 转成 CRLF；口令通过 JSON stdin 到 Linux 后生成本机 LF。
        self.exec(self.guard, ["python3", "-c", "import json,sys,subprocess;subprocess.run(['chpasswd'],input='guardtest:'+json.load(sys.stdin)+'\\n',text=True,check=True)"], json.dumps(self.password))
        self.exec(self.guard, ["python3", "-c", "import os;open('/var/log/auth.log','a').close();os.chmod('/var/log/auth.log',0o600)"])
        self.command(["exec", "-d", self.guard, "python3", "-B", "/lab/test.py", "--inside", "api"])
        self.wait(lambda: self.exec(self.guard, ["test", "-S", "/run/lab-docker.sock"], check=False).returncode == 0)
        self.configure("nftables")
        self.start_guard()
        policy = self.control()["policy"]
        self.check("defaults-enabled-3-86400-cumulative", policy["enabled"] and policy["maxFailures"] == 3 and policy["banSeconds"] == 86400 and policy["windowSeconds"] == 0)

    def ssh_tests(self):
        baseline = self.attempt(self.client_b, "ssh", self.guard_ip)
        self.check("ssh:baseline-other-ip", baseline["success"], baseline)
        self.fail_three(self.client_a, self.a_ip, "ssh", self.guard_ip)
        self.prove_block(self.client_a, "ssh", self.guard_ip, "nft:INPUT-blocks-correct-password")
        self.check("ssh:other-ip-remains-usable", self.attempt(self.client_b, "ssh", self.guard_ip)["success"])
        self.stop_guard()
        self.start_guard()
        self.prove_block(self.client_a, "ssh", self.guard_ip, "nft:ban-survives-agent-restart")
        self.exec(self.guard, ["nft", "delete", "table", "inet", "microi_auth_guard"])
        self.wait(lambda: self.exec(self.guard, ["nft", "list", "table", "inet", "microi_auth_guard"], check=False).returncode == 0)
        self.prove_block(self.client_a, "ssh", self.guard_ip, "nft:own-rules-reconciled-after-loss")
        self.unban(self.a_ip)
        self.check("ssh:manual-unban-works", self.attempt(self.client_a, "ssh", self.guard_ip)["success"])
        self.fail_three(self.client_a, self.a_ip6, "ssh", self.guard_ip6)
        self.prove_block(self.client_a, "ssh", self.guard_ip6, "nft:IPv6-INPUT-blocks")
        self.check("ssh:IPv6-other-ip-works", self.attempt(self.client_b, "ssh", self.guard_ip6)["success"])
        self.unban(self.a_ip6)
        current = self.control()["policy"]
        self.control("PUT", "/policy", {"banSeconds": 60, "expectedRevision": current["revision"]})
        self.fail_three(self.client_a, self.a_ip, "ssh", self.guard_ip)
        self.prove_block(self.client_a, "ssh", self.guard_ip, "nft:auto-unban-before-expiry-blocks")
        deadline = time.monotonic() + 70
        while time.monotonic() < deadline:
            if not any(row["ip"] == self.a_ip for row in self.control()["bans"]):
                break
            print(json.dumps({"phase": "waiting-real-60-second-ban-expiry"}), flush=True)
            time.sleep(10)
        self.check("ssh:automatic-expiry-restores-network", self.attempt(self.client_a, "ssh", self.guard_ip)["success"])
        current = self.control()["policy"]
        self.control("PUT", "/policy", {"banSeconds": 86400, "expectedRevision": current["revision"]})

    def backend(self, kind, image, network, subnet, subnet6):
        name = self.owner + "-" + kind
        args = ["--label", "io.microi.panel.owner=" + self.owner, "--label", "io.microi.panel.resource=" + kind,
                "--label", "io.microi.panel.plugin=" + kind]
        target = str(ipaddress.ip_network(subnet)[2])
        if kind == "redis":
            secret = self.write("redis.conf", "bind 0.0.0.0 ::\nprotected-mode no\nrequirepass " + self.password + "\nappendonly no\n")
            args += ["--label", "io.microi.panel.auth-guard.redis-proxy=true", "--label", "io.microi.panel.auth-guard.redis-proxy-port=16379",
                     "--label", "io.microi.panel.auth-guard.redis-proxy-bind=0.0.0.0", "--mount", "type=bind,source=" + str(secret) + ",target=/run/redis.conf,readonly"]
            command = ["redis-server", "/run/redis.conf"]
            memory = "96m"
        else:
            secret = self.write(kind + "-password", self.password)
            args += ["--mount", "type=bind,source=" + str(secret) + ",target=/run/lab-password,readonly"]
            if kind == "mysql":
                args += ["--env", "MYSQL_ROOT_PASSWORD_FILE=/run/lab-password", "--env", "MYSQL_ROOT_HOST=%"]
                command = ["mysqld", "--log-error-verbosity=3", "--skip-name-resolve", "--innodb-buffer-pool-size=67108864", "--max-connections=30"]
                memory = "768m"
            else:
                args += ["--env", "MONGO_INITDB_ROOT_USERNAME=guardtest", "--env", "MONGO_INITDB_ROOT_PASSWORD_FILE=/run/lab-password"]
                command = ["mongod", "--wiredTigerCacheSizeGB", "0.25", "--setParameter", "enableDetailedConnectionHealthMetricLogLines=true"]
                memory = "512m"
        identity = self.run(name, image, args, command, network=network, ip=target,
                            ip6=str(ipaddress.ip_network(subnet6)[2]), memory=memory)
        self.report["images"][kind] = self.inspect("container", identity)["Image"]
        return identity, target

    def redis_tests(self, image):
        network = self.network("mci-panel-" + self.owner + "-redis-guard", self.redis_net, self.redis6)
        identity, backend_ip = self.backend("redis", image, network, self.redis_net, self.redis6)
        try:
            self.wait(lambda: any(item["service"] == "redis" and item["status"] == "protecting" for item in self.control()["adapters"]), 40)
            self.check("redis:real-backend-through-proxy", self.attempt(self.client_b, "redis", self.guard_ip)["success"])
            direct = self.attempt(self.client_b, "tcp", backend_ip, port=6379)
            self.check("nft:FORWARD-raw-redis-backend-bypass-blocked", not direct["success"])
            self.fail_three(self.client_a, self.a_ip, "redis", self.guard_ip)
            self.prove_block(self.client_a, "redis", self.guard_ip, "redis:correct-fourth-password-blocked")
            self.check("redis:other-source-works", self.attempt(self.client_b, "redis", self.guard_ip)["success"])
            self.unban(self.a_ip)
            self.check("redis:unban-restores-proxy", self.attempt(self.client_a, "redis", self.guard_ip)["success"])
        finally:
            self.capture_backend_log(identity, "redis")
            self.remove_container(identity)

    def database_tests(self, kind, image, switch_iptables=False):
        network_name = self.owner + "-database"
        if not any(self.inspect("network", item)["Name"] == network_name for item in self.networks):
            self.network(network_name, self.db_net, self.db6)
        identity, target = self.backend(kind, image, network_name, self.db_net, self.db6)
        try:
            self.wait(lambda: self.attempt(self.client_b, kind, target)["success"], 150)
            self.wait(lambda: any(item["service"] == kind for item in self.control()["adapters"]), 20)
            self.fail_three(self.client_a, self.a_ip, kind, target)
            self.prove_block(self.client_a, kind, target, "nft:FORWARD-" + kind + "-correct-password-blocked")
            self.check(kind + ":other-source-works", self.attempt(self.client_b, kind, target)["success"])
            self.unban(self.a_ip)
            self.check(kind + ":unban-restores-network", self.attempt(self.client_a, kind, target)["success"])
            if switch_iptables:
                self.stop_guard()
                self.exec(self.guard, ["nft", "delete", "table", "inet", "microi_auth_guard"])
                self.configure("iptables")
                self.start_guard()
                self.check("iptables:baseline-before-ban", self.attempt(self.client_a, kind, target)["success"])
                self.fail_three(self.client_a, self.a_ip, kind, target)
                self.prove_block(self.client_a, kind, target, "iptables:FORWARD-blocks-correct-password")
                self.prove_block(self.client_a, "ssh", self.guard_ip, "iptables:INPUT-shared-ban-blocks-ssh")
                self.check("iptables:other-ip-works", self.attempt(self.client_b, kind, target)["success"])
                self.unban(self.a_ip)
                self.check("iptables:manual-unban-restores-network", self.attempt(self.client_a, kind, target)["success"])
        finally:
            self.capture_backend_log(identity, kind)
            self.remove_container(identity)

    def capture_backend_log(self, identity, kind):
        self.own("container", identity)
        result = self.command(["logs", "--tail", "80", identity], check=False)
        lines = (result.stdout + result.stderr).splitlines()
        selected = [line for line in lines if any(marker in line.lower() for marker in ("auth", "access denied", "error"))]
        self.write(kind + "-auth-log.txt", "\n".join(selected).replace(self.password, "[redacted]")[-16000:])
        result = self.exec(self.guard, ["cat", "/run/lab-api-errors.jsonl"], check=False)
        if result.returncode == 0:
            self.write("lab-api-errors.jsonl", result.stdout.replace(self.password, "[redacted]")[-16000:])

    def cleanup(self):
        errors = []
        with contextlib.suppress(Exception):
            self.stop_guard()
        for identity in list(reversed(self.containers)):
            try:
                self.remove_container(identity)
            except Exception as error:
                errors.append({"container": identity, "error": str(error)[:300]})
        for identity in reversed(self.networks):
            try:
                self.own("network", identity)
                self.command(["network", "rm", identity])
            except Exception as error:
                errors.append({"network": identity, "error": str(error)[:300]})
        for handle in self.process_handles:
            handle.close()
        if not self.keep_image:
            try:
                self.own("image", self.image)
                self.command(["image", "rm", self.image])
            except Exception as error:
                errors.append({"image": self.image, "error": str(error)[:300]})
        for name in ("redis.conf", "mysql-password", "mongodb-password"):
            file = self.root / name
            if file.is_file() and not file.is_symlink():
                file.unlink()
        remaining = self.command(["ps", "-aq", "--filter", "label=" + LABEL + "=" + self.owner]).stdout.split()
        networks = self.command(["network", "ls", "-q", "--filter", "label=" + LABEL + "=" + self.owner]).stdout.split()
        self.report["cleanup"] = {"remainingContainers": remaining, "remainingNetworks": networks, "errors": errors,
                                  "passed": not remaining and not networks and not errors}
        self.report["finishedAt"] = time.time()
        current = {name: hashlib.sha256((self.source / name).read_bytes()).hexdigest() for name in self.report.get("sourceHashes", {})}
        self.report["candidateChangedDuringRun"] = current != self.report.get("sourceHashes", {})
        self.write("report.json", self.report)

    def diagnose(self):
        """失败时先保留小型脱敏证据，随后仍销毁本次服务和数据卷。"""
        try:
            self.write("failure-status.json", self.control())
        except Exception:
            pass
        rows = []
        for identity in self.containers:
            try:
                detail = self.own("container", identity)
                logs = self.command(["logs", "--tail", "30", identity], check=False).stderr
                rows.append({"name": detail["Name"], "status": detail["State"],
                             "recentLog": logs.replace(self.password, "[redacted]")[-6000:]})
            except Exception:
                pass
        self.write("failure-containers.json", rows)
        try:
            logs = self.exec(self.guard, ["tail", "-n", "25", "/var/log/auth.log"]).stdout
            self.write("failure-ssh.log", logs.replace(self.password, "[redacted]"))
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inside", choices=("client", "control", "api"))
    parser.add_argument("--scratch")
    parser.add_argument("--redis-image", default="sha256:71da9275c5f3fcb97d0fa0c8c5b36cc995327265420f17a04bfd544f458059f7")
    parser.add_argument("--mysql-image", default="sha256:3466ba4a4828aa8d46fb7c3bc16b67b781c98413cf4ea0fac6feaa6e881faa26")
    parser.add_argument("--mongodb-image", default="sha256:66f3cb7106154d8793364d06c1f56933795ee9ca2fdf63c194ce1403228f38d7")
    parser.add_argument("--keep-image", action="store_true")
    parser.add_argument("--tools-image")
    parser.add_argument("--phases", default="ssh,redis,mongodb,mysql")
    args = parser.parse_args()
    if args.inside:
        inside(args.inside)
        return 0
    if not args.scratch:
        parser.error("explicit owned --scratch is required")
    scratch = Path(args.scratch).resolve(strict=True)
    repo = Path(__file__).resolve().parents[4]
    # 必须位于已登记的工作区 .tmp，不能接受盘根、源码根或外部链接作为清理边界。
    if not scratch.is_relative_to(repo / ".tmp") or not (scratch / "owner.json").is_file():
        raise RuntimeError("scratch must be an already registered workspace task directory")
    lab = Lab(scratch, args.keep_image, args.tools_image)
    phases = args.phases.split(",")
    if not phases or any(phase not in ("ssh", "redis", "mongodb", "mysql") for phase in phases):
        raise ValueError("invalid lab phases")
    lab.report["selectedPhases"] = phases
    succeeded = False
    try:
        lab.build()
        lab.setup()
        if "ssh" in phases:
            lab.ssh_tests()
        if "redis" in phases:
            lab.redis_tests(args.redis_image)
        if "mongodb" in phases:
            lab.database_tests("mongodb", args.mongodb_image)
        if "mysql" in phases:
            lab.database_tests("mysql", args.mysql_image, switch_iptables=True)
        succeeded = True
    except BaseException as error:
        lab.report["failure"] = (type(error).__name__ + ":" + str(error)).replace(lab.password, "[redacted]")[:2000]
        print(json.dumps({"failed": lab.report["failure"]}, ensure_ascii=False), flush=True)
        lab.diagnose()
    finally:
        lab.cleanup()
    print(json.dumps({"passed": succeeded and lab.report["cleanup"]["passed"], "report": str(lab.root / "report.json")}), flush=True)
    return 0 if succeeded and lab.report["cleanup"]["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
