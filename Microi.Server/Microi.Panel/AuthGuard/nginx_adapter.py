#!/usr/bin/env python3
"""明确接入的第三方 Nginx 固定动作；不提供任意命令、宿主路径或容器生命周期接口。"""
from __future__ import annotations

import base64
import collections
import contextlib
import hashlib
import http.client
import io
import ipaddress
import json
import os
import re
import socket
import ssl
import stat
import subprocess
import tarfile
import threading
import time
import urllib.parse
import uuid
from pathlib import Path, PurePosixPath

from collectors import UnixHTTP
from store import GuardError

MAX_CONFIG = 128 * 1024
BT_ROOT = "/www/server/panel/vhost/nginx"
BT_WEB_ROOT = "/www/wwwroot"
BT_BINARY = "/www/server/nginx/sbin/nginx"
BT_MAIN = "/www/server/nginx/conf/nginx.conf"
CONTAINER_ROOTS = ("/usr/local/openresty/nginx/conf/conf.d", "/etc/nginx/conf.d")
HASH = re.compile(r"^[a-f0-9]{64}$")
NAME = re.compile(r"^[a-zA-Z0-9_.-]{1,180}\.conf$")
TLS_READBACK_SECONDS = 10.0


def remaining_timeout(deadline, maximum=3.0):
    if deadline is None: return maximum
    remaining = deadline - time.monotonic()
    if remaining <= 0: raise TimeoutError("Nginx 回读超过共享期限。")
    return min(maximum, remaining)


class _DeadlineReader(io.RawIOBase):
    """每次 recv 都扣除共享预算，避免分段响应头持续滴流绕过单次 socket timeout。"""
    def __init__(self, stream, deadline):
        super().__init__(); self.stream, self.deadline = stream, deadline
    def readable(self): return True
    def readinto(self, buffer):
        self.stream.settimeout(remaining_timeout(self.deadline))
        return self.stream.recv_into(buffer)


class _DeadlineSocket:
    def __init__(self, stream, deadline): self.stream, self.deadline = stream, deadline
    def makefile(self, mode):
        if mode != "rb": raise ValueError("Read-only response stream required")
        return io.BufferedReader(_DeadlineReader(self.stream, self.deadline))


class TlsNotReady(GuardError):
    """仅精确叶证书尚未切换可等待；路径、CAS、重定向等语义错误不转成重试。"""


def digest(value):
    return hashlib.sha256(value).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def checked_path(path):
    value = PurePosixPath(path)
    if not isinstance(path, str) or not path.startswith("/") or any(ord(x) < 32 or x in '\\"\'' for x in path) or ".." in value.parts or str(value) != path:
        raise GuardError("网站路径不符合受限管理边界。", 409)
    return value


def regular_path(path, directory=False):
    """已发现路径也重新逐级检查，不跟随面板外部后来替换的链接。"""
    value = Path(path)
    for ancestor in [*reversed(value.parents), value]:
        info = ancestor.lstat()
        if stat.S_ISLNK(info.st_mode):
            raise GuardError("网站路径经过符号链接，请在原面板确认真实路径。", 409)
    info = value.stat()
    if not (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode) and info.st_nlink == 1):
        raise GuardError("网站目标不是独立普通文件或目录。", 409)
    return info


def trusted_bind_directory(path):
    """校验到挂载时仍不能被网站账号替换的路径：root 持有、无组/其它写权限且不经链接。"""
    regular_path(path, directory=True)
    if os.name == "posix":
        value = Path(path)
        for ancestor in [*reversed(value.parents), value]:
            info = ancestor.lstat()
            if not root_owned_directory(info):
                raise GuardError("挑战挂载目录或祖先可被非 root 用户改写，停止挂载。", 409)


def root_owned_directory(info):
    return info.st_uid == 0 and not info.st_mode & 0o022


def trusted_native_challenge_directory(path):
    """原生 worker 直接遍历宿主路径；容器 bind 的宿主私有前缀不适用此规则。"""
    checked_path(path)
    if path != BT_WEB_ROOT and not path.startswith(BT_WEB_ROOT + "/"):
        raise GuardError("原生 HTTP-01 挑战目录必须位于固定网站根目录内。", 409)
    trusted_bind_directory(path)
    value = Path(path)
    for ancestor in [*reversed(value.parents), value]:
        if not ancestor.lstat().st_mode & stat.S_IXOTH:
            raise GuardError("原生 HTTP-01 挑战目录或祖先不能供 Nginx worker 遍历。", 409)


def read_native(path, limit=MAX_CONFIG):
    info = regular_path(path)
    if info.st_size > limit:
        raise GuardError("网站配置超过安全读取上限。", 413)
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        current = os.fstat(fd)
        if (current.st_dev, current.st_ino) != (info.st_dev, info.st_ino):
            raise GuardError("网站文件读取期间发生替换，请刷新。", 409)
        with os.fdopen(fd, "rb", closefd=False) as stream:
            raw = stream.read(limit + 1)
        if len(raw) > limit:
            raise GuardError("网站配置超过安全读取上限。", 413)
        return raw
    finally:
        os.close(fd)


def run(command, timeout=20):
    try:
        result = subprocess.run(command, capture_output=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise GuardError("Nginx 固定动作无法完成或超时。", 503)
    if len(result.stdout) + len(result.stderr) > 4 * 1024 * 1024:
        raise GuardError("Nginx 动作结果超过上限。", 503)
    return result.returncode, result.stdout, result.stderr


class DockerApi:
    def __init__(self, path="/var/run/docker.sock"):
        self.path = path

    def request(self, method, path, data=None, binary=False, deadline=None):
        connection = UnixHTTP(self.path, timeout=remaining_timeout(deadline, 30))
        try:
            body = data if isinstance(data, bytes) else canonical(data) if data is not None else None
            headers = {"Content-Type": "application/x-tar" if binary else "application/json"}
            if deadline is not None:
                connection.connect()
                connection.sock.settimeout(remaining_timeout(deadline))
            connection.request(method, path, body=body, headers=headers)
            if deadline is None: response = connection.getresponse()
            else:
                # 独立短连接无需复用 HTTPConnection 状态；响应头与正文都使用同一截止时间。
                response = http.client.HTTPResponse(_DeadlineSocket(connection.sock, deadline), method=method)
                response.begin()
            with response: raw = response.read(4 * 1024 * 1024 + 1)
            remaining_timeout(deadline, 30)
            if response.status not in (200, 201, 204) or len(raw) > 4 * 1024 * 1024:
                raise GuardError("Docker Nginx 读取或固定动作失败。", 503)
            return raw
        finally:
            connection.close()

    def json(self, method, path, data=None, deadline=None):
        raw = self.request(method, path, data, **({"deadline": deadline} if deadline is not None else {}))
        return json.loads(raw) if raw else None

    def execute(self, container, command):
        item = self.json("POST", "/containers/" + container + "/exec", {"AttachStdout": True, "AttachStderr": True, "Tty": False, "Cmd": command})
        raw = self.request("POST", "/exec/" + item["Id"] + "/start", {"Detach": False, "Tty": False})
        output = bytearray()
        while raw:
            if len(raw) < 8 or raw[0] not in (1, 2) or raw[1:4] != b"\0\0\0":
                raise GuardError("Docker Nginx 动作回执无效。", 503)
            size = int.from_bytes(raw[4:8], "big")
            if size > len(raw) - 8:
                raise GuardError("Docker Nginx 动作回执不完整。", 503)
            output.extend(raw[8:8 + size]); raw = raw[8 + size:]
        result = self.json("GET", "/exec/" + item["Id"] + "/json")
        if result.get("Running") or type(result.get("ExitCode")) is not int:
            raise GuardError("Docker Nginx 动作尚未完成。", 503)
        return result["ExitCode"], bytes(output), b""


# 固定脚本只使用已发现的路径和内容哈希作为位置参数，不插入浏览器文本为 Shell。
CHECK_FILE = r'''p=$1
while [ "$p" != / ]; do [ ! -L "$p" ] || exit 72; p=${p%/*}; [ -n "$p" ] || p=/; done
[ -f "$1" ] && [ "$(stat -c %h -- "$1")" = 1 ] || exit 72
'''
CAS_FILE = CHECK_FILE + r'''[ "$(sha256sum -- "$1" | cut -d ' ' -f1)" = "$2" ] || exit 73
[ -f "$3" ] && [ ! -L "$3" ] && [ "$(sha256sum -- "$3" | cut -d ' ' -f1)" = "$4" ] || exit 72
chmod "$(stat -c %a -- "$1")" -- "$3" || exit 74
chown "$(stat -c %u:%g -- "$1")" -- "$3" || exit 74
[ "$(sha256sum -- "$1" | cut -d ' ' -f1)" = "$2" ] || exit 73
mv -f -- "$3" "$1" && sync
'''


class Transport:
    def __init__(self, instance, docker):
        self.instance, self.docker = instance, docker

    def execute(self, command):
        return self.docker.execute(self.instance["containerId"], command) if self.instance["kind"] == "docker" else run(command)

    def read(self, path):
        checked_path(path)
        if self.instance["kind"] == "native":
            return read_native(path)
        code, _, _ = self.execute(["sh", "-c", CHECK_FILE, "microi-check", path])
        if code:
            raise GuardError("网站文件或父路径不安全，停止操作。", 409)
        raw = self.docker.request("GET", "/containers/" + self.instance["containerId"] + "/archive?path=" + urllib.parse.quote(path, safe=""))
        with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
            members = archive.getmembers()
            if len(members) != 1 or not members[0].isfile() or members[0].size > MAX_CONFIG:
                raise GuardError("网站文件归档不是单个普通配置。", 409)
            return archive.extractfile(members[0]).read(MAX_CONFIG + 1)

    def files(self, root):
        if self.instance["kind"] == "native":
            regular_path(root, directory=True)
            return [p.name for p in Path(root).iterdir() if NAME.fullmatch(p.name) and p.is_file() and not p.is_symlink()]
        code, out, _ = self.execute(["find", root, "-maxdepth", "1", "-type", "f", "-name", "*.conf"])
        if code:
            return []
        return [PurePosixPath(x).name for x in out.decode().splitlines() if str(PurePosixPath(x).parent) == root and NAME.fullmatch(PurePosixPath(x).name)]

    def create_owned(self, path, marker, files=None):
        """仅创建服务端计算的新子目录；已有目录必须拥有相同归属标记，绝不接管现有网站目录。"""
        checked_path(path); files = files or {}
        parent = str(PurePosixPath(path).parent)
        if self.instance["kind"] == "native":
            regular_path(parent, directory=True)
            try: os.mkdir(path, 0o755); os.chmod(path, 0o755); fresh = True
            except FileExistsError: fresh = False
            regular_path(path, directory=True)
            if not fresh:
                if read_native(str(PurePosixPath(path) / ".microi-owner")) != marker: raise GuardError("专属目录归属不一致。", 409)
                for name, raw in files.items():
                    if read_native(str(PurePosixPath(path) / name)) != raw: raise GuardError("专属证书目录已被外部更改。", 409)
                return
            for name, raw in {".microi-owner": marker, **files}.items():
                fd = os.open(str(PurePosixPath(path) / name), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
                with os.fdopen(fd, "wb") as handle: handle.write(raw); handle.flush(); os.fsync(handle.fileno())
        else:
            command = r'''p=$1; while [ "$p" != / ]; do [ ! -L "$p" ] || exit 72; p=${p%/*}; [ -n "$p" ] || p=/; done
if [ -e "$1" ]; then [ -d "$1" ] || exit 72; exit 10; fi
mkdir -m 755 -- "$1"'''
            code, _, _ = self.execute(["sh", "-c", command, "microi-directory", path])
            if code == 10:
                if self.read(path + "/.microi-owner") != marker: raise GuardError("专属目录归属不一致。", 409)
                for name, raw in files.items():
                    if self.read(path + "/" + name) != raw: raise GuardError("专属证书目录已被外部更改。", 409)
                return
            if code: raise GuardError("无法创建隔离目录，请检查原面板挂载与路径。", 409)
            archive = io.BytesIO()
            with tarfile.open(fileobj=archive, mode="w") as tar:
                for name, raw in {".microi-owner": marker, **files}.items():
                    item = tarfile.TarInfo(name); item.size = len(raw); item.mode = 0o600; tar.addfile(item, io.BytesIO(raw))
            self.docker.request("PUT", "/containers/" + self.instance["containerId"] + "/archive?path=" + urllib.parse.quote(path, safe=""), archive.getvalue(), binary=True)
            if self.read(path + "/.microi-owner") != marker: raise GuardError("隔离目录写入回读失败。", 409)

    def host_path(self, path):
        checked_path(path)
        if self.instance["kind"] == "native": return path
        matches = [m for m in self.instance["mounts"] if m.get("RW") is True and m.get("Type") == "bind" and (path == m["Destination"] or path.startswith(m["Destination"].rstrip("/") + "/"))]
        if not matches: raise GuardError("本站路径没有可核验的读写 bind 挂载，不能隔离 HTTP-01。", 409)
        mount = max(matches, key=lambda m: len(m["Destination"]))
        host = str(PurePosixPath(mount["Source"]) / str(PurePosixPath(path).relative_to(mount["Destination"])))
        checked_path(host); return host

    def challenge_token(self, directory, token, value=None):
        """只读写本次随机探针名；真实 token 由 helper 直接写入同一个专属根，无异步复制竞态。"""
        if not re.fullmatch(r"[a-f0-9]{32}", token): raise GuardError("挑战探针标识无效。")
        relative = ".well-known/acme-challenge/" + token
        if self.instance["kind"] == "native":
            target = Path(directory)
            for name in (".well-known", "acme-challenge"):
                target = target / name
                if value is not None and not target.exists(): target.mkdir(mode=0o755); target.chmod(0o755)
                regular_path(target, directory=True)
            path = target / token
            if value is None:
                if path.exists(): regular_path(path); path.unlink()
            else:
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o644)
                with os.fdopen(fd, "wb") as handle: handle.write(value); handle.flush(); os.fchmod(handle.fileno(), 0o644)
        else:
            # 路径只由已校验目录和固定子路径组成；删除仅限这个随机探针，不清空 CA 文件。
            script = r'''p=$1; while [ "$p" != / ]; do [ ! -L "$p" ] || exit 72; p=${p%/*}; [ -n "$p" ] || p=/; done
if [ "$3" = remove ]; then [ ! -L "$1/.well-known" ] && [ ! -L "$1/.well-known/acme-challenge" ] && [ ! -L "$1/.well-known/acme-challenge/$2" ] || exit 72; rm -f -- "$1/.well-known/acme-challenge/$2"; exit $?; fi
[ ! -L "$1/.well-known" ] && [ ! -L "$1/.well-known/acme-challenge" ] || exit 72
mkdir -p -m 755 -- "$1/.well-known/acme-challenge"; [ ! -e "$1/.well-known/acme-challenge/$2" ] || exit 73'''
            code, _, _ = self.execute(["sh", "-c", script, "microi-challenge", directory, token, "remove" if value is None else "create"])
            if code: raise GuardError("挑战探针路径不安全。", 409)
            if value is not None:
                archive = io.BytesIO()
                with tarfile.open(fileobj=archive, mode="w") as tar:
                    info = tarfile.TarInfo(relative); info.size = len(value); info.mode = 0o644; tar.addfile(info, io.BytesIO(value))
                self.docker.request("PUT", "/containers/" + self.instance["containerId"] + "/archive?path=" + urllib.parse.quote(directory, safe=""), archive.getvalue(), binary=True)

    def replace(self, path, expected, content, operation):
        if digest(self.read(path)) != expected:
            raise GuardError("网站配置已被其它管理员修改，请刷新后重试。", 409)
        pending = str(PurePosixPath(path).parent / (".microi-" + operation + ".pending"))
        if self.instance["kind"] == "native":
            info = regular_path(path)
            fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), stat.S_IMODE(info.st_mode))
            try:
                with os.fdopen(fd, "wb") as handle:
                    handle.write(content); handle.flush(); os.fchmod(handle.fileno(), stat.S_IMODE(info.st_mode)); os.fsync(handle.fileno())
                os.chown(pending, info.st_uid, info.st_gid)
                if digest(self.read(path)) != expected or (regular_path(path).st_ino, regular_path(path).st_dev) != (info.st_ino, info.st_dev):
                    raise GuardError("网站配置写入前发生变化，原文件未覆盖。", 409)
                os.replace(pending, path)
                directory = os.open(str(Path(path).parent), os.O_RDONLY | os.O_DIRECTORY)
                try: os.fsync(directory)
                finally: os.close(directory)
            finally:
                if os.path.exists(pending) and not os.path.islink(pending):
                    os.unlink(pending)
        else:
            # tar 只含本次 UUID 暂存名；永远不对原目标进行 archive 覆盖。
            archive = io.BytesIO()
            with tarfile.open(fileobj=archive, mode="w") as tar:
                item = tarfile.TarInfo(PurePosixPath(pending).name); item.size = len(content); item.mode = 0o600
                tar.addfile(item, io.BytesIO(content))
            self.docker.request("PUT", "/containers/" + self.instance["containerId"] + "/archive?path=" + urllib.parse.quote(str(PurePosixPath(path).parent), safe=""), archive.getvalue(), binary=True)
            code, _, _ = self.execute(["sh", "-c", CAS_FILE, "microi-cas", path, expected, pending, digest(content)])
            if code:
                raise GuardError("网站配置写入前身份或内容变化，暂存版本已保留。", 409)
        if digest(self.read(path)) != digest(content):
            raise GuardError("网站配置写入后回读不一致，停止重载。", 409)

    def workers(self):
        if self.instance["kind"] == "docker":
            data = self.docker.json("GET", "/containers/" + self.instance["containerId"] + "/top?ps_args=-eo%20pid,ppid,args")
            rows = data.get("Processes", [])
            masters = {str(row[0]) for row in rows if "nginx: master process" in " ".join(row[2:])}
            return {str(row[0]) for row in rows if str(row[1]) in masters and "nginx: worker process" in " ".join(row[2:]) and "shutting down" not in " ".join(row[2:])}
        master = self.instance["pid"]
        children = Path(f"/proc/{master}/task/{master}/children").read_text().split()
        result = set()
        for child in children:
            try:
                command = Path(f"/proc/{child}/cmdline").read_bytes().replace(b"\0", b" ").decode()
                if "nginx: worker process" in command and "shutting down" not in command:
                    result.add(child)
            except FileNotFoundError:
                pass
        return result

    def test(self):
        command = ["nginx", "-t"] if self.instance["kind"] == "docker" else [BT_BINARY, "-t", "-c", BT_MAIN]
        code, _, _ = self.execute(command)
        if code:
            # nginx -t 可能回显带凭据的配置行；浏览器只接收阶段诊断，内容仍可从已授权编辑器检查。
            raise GuardError("Nginx 配置校验未通过；请检查本站及原面板其它配置，未执行重载。", 422)

    def reload(self):
        before = self.workers()
        if not before:
            raise GuardError("未发现运行中的 Nginx 工作进程，停止重载。", 409)
        command = ["nginx", "-s", "reload"] if self.instance["kind"] == "docker" else [BT_BINARY, "-s", "reload", "-c", BT_MAIN]
        code, _, _ = self.execute(command)
        if code:
            raise GuardError("Nginx 未确认接收重载请求。", 503)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if self.workers() - before:
                return
            time.sleep(.1)
        raise GuardError("未观测到新 Nginx 工作进程，不能确认配置已生效。", 503)


def parse_config(text):
    """按 Nginx 的注释、引号、转义和区块分词；不能让同一行指令绕过文件边界。"""
    tokens = []; i = 0
    while i < len(text):
        if text[i].isspace(): i += 1; continue
        if text[i] == "#":
            end = text.find("\n", i); i = len(text) if end < 0 else end + 1; continue
        start = i
        if text[i] in ";{}": tokens.append((text[i], i, i + 1)); i += 1; continue
        quote = None
        while i < len(text):
            char = text[i]
            if char == "\\":
                if i + 1 == len(text): raise GuardError("Nginx 配置包含未完成的转义。")
                i += 2; continue
            if quote:
                if char == quote: quote = None
                i += 1; continue
            if char in "\"'": quote = char; i += 1; continue
            if char == "$" and i + 1 < len(text) and text[i + 1] == "{":
                end = text.find("}", i + 2)
                if end < 0: raise GuardError("Nginx 配置变量不完整。")
                i = end + 1; continue
            if char.isspace() or char in ";{}#": break
            i += 1
        if quote: raise GuardError("Nginx 配置引号未闭合。")
        tokens.append((text[start:i], start, i))
    position = 0
    def block(nested=False, depth=0):
        nonlocal position
        if depth > 32: raise GuardError("Nginx 配置嵌套超过安全上限。")
        result = []
        while position < len(tokens):
            if tokens[position][0] == "}":
                if not nested: raise GuardError("Nginx 配置区块不平衡。")
                close = tokens[position]; position += 1; return result, close
            words = []
            while position < len(tokens) and tokens[position][0] not in (";", "{", "}"):
                words.append(tokens[position]); position += 1
            if not words or position == len(tokens) or tokens[position][0] == "}": raise GuardError("Nginx 指令不完整。")
            separator = tokens[position]; position += 1
            if separator[0] == "{" and "lua" in words[0][0].lower():
                # 第三方既有 Lua 区块按原始完整字节保护，不把 Lua 语法当作 Nginx 指令执行或重新编排。
                balance = 1; close = separator
                while position < len(tokens) and balance:
                    close = tokens[position]; position += 1
                    balance += (1 if close[0] == "{" else -1 if close[0] == "}" else 0)
                if balance: raise GuardError("脚本区块未闭合。")
                children = []
            else: children, close = block(True, depth + 1) if separator[0] == "{" else ([], separator)
            result.append({"name": words[0][0], "args": tuple(x[0] for x in words[1:]), "start": words[0][1], "end": close[2], "open": separator[1] if separator[0] == "{" else None, "close": close[1], "children": children})
        if nested: raise GuardError("Nginx 配置区块未闭合。")
        return result, None
    return block()[0]


def walk(nodes, context=()):
    for node in nodes:
        yield node, context
        yield from walk(node["children"], context + ((node["name"], node["args"]),))


def literal(value):
    if value[:1] in ("'", '"') and value[-1:] == value[:1]: value = value[1:-1]
    if any(x in value for x in ("$", "\\", "\0", "\n", "\r", '"', "'")): raise GuardError("此网站使用动态或转义路径，需先在原面板确认。", 409)
    return value


def site_domains(content):
    result = []
    for node, _ in walk(parse_config(content)):
        if node["name"] != "server_name": continue
        for word in node["args"]:
            name = literal(word).lower()
            if re.fullmatch(r"(?:\*\.)?[A-Za-z0-9][A-Za-z0-9_.-]{0,252}", name) and name not in ("_", "localhost") and name not in result: result.append(name)
    return result


def validate_edit(before, after):
    if not isinstance(after, str) or not 1 <= len(after.encode()) <= MAX_CONFIG or "\0" in after:
        raise GuardError("网站配置必须为不超过 128 KiB 的 UTF-8 文本。", 413)
    original, candidate = parse_config(before), parse_config(after)
    if not any(x["name"] == "server" and x["open"] is not None for x in candidate):
        raise GuardError("本站配置必须保留至少一个 server 区块。")
    # 站点编辑不扩大宿主文件可见范围；证书和 HTTP-01 仅由单独固定动作更改路径。
    protected = {"include", "root", "alias", "ssl_certificate", "ssl_certificate_key", "ssl_client_certificate", "proxy_ssl_trusted_certificate", "auth_basic_user_file", "access_log", "error_log", "proxy_temp_path", "fastcgi_temp_path", "client_body_temp_path", "ssl_trusted_certificate", "ssl_dhparam"}
    def directives(nodes, source):
        result = collections.Counter()
        for node, context in walk(nodes):
            name = node["name"]
            script = "lua" in name.lower() or name.lower().startswith(("perl", "js_")) or name.lower() == "load_module"
            path_directive = name.lower() in protected or name.lower().endswith(("_path", "_file", "_crl", "_certificate", "_certificate_key", "_trusted_certificate"))
            if path_directive or script:
                result[(context, name, node["args"], source[node["start"]:node["end"]] if script else "")] += 1
        return result
    if directives(original, before) != directives(candidate, after):
        raise GuardError("配置编辑不能增加或改变宿主文件路径、include 或证书路径；请使用专用证书动作或先在原面板调整。", 409)


def edit_spans(text, replacements):
    for start, end, value in sorted(replacements, reverse=True): text = text[:start] + value + text[end:]
    return text


def listen_ports(server, tls=False):
    listeners = [node for node in server["children"] if node["name"] == "listen"]
    if not listeners: return [] if tls else [80]
    result = set()
    for listener in listeners:
        # QUIC 是 UDP 上的 HTTP/3，不能用作普通 HTTP-01 或 TCP TLS 的回读端口。
        if "quic" in listener["args"]: continue
        if ("ssl" in listener["args"]) != tls: continue
        value = literal(listener["args"][0]).rsplit(":", 1)[-1]
        if not value.isdigit() or not 1 <= int(value) <= 65535: raise GuardError("Nginx 监听不是可核验的 TCP 端口。", 409)
        result.add(int(value))
    return sorted(result)


def http_ports_by_domain(text):
    result = {}
    for server in [node for node in parse_config(text) if node["name"] == "server"]:
        for domain in site_domains(text[server["start"]:server["end"]]):
            result.setdefault(domain, set()).update(listen_ports(server))
    if any(not ports for ports in result.values()): raise GuardError("部分域名没有 HTTP 监听；请先在原面板配置公网 80 的验证入口。", 409)
    return {domain: sorted(ports) for domain, ports in result.items()}


def tls_certificate(address, port, domain, deadline=None):
    # 读取实际 SNI 叶证书供精确比对或旧服务快照；本函数本身不作 CA/域名信任结论。
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT); context.check_hostname = False; context.verify_mode = ssl.CERT_NONE
    with socket.create_connection((address, port), timeout=remaining_timeout(deadline)) as stream:
        stream.settimeout(remaining_timeout(deadline))
        with context.wrap_socket(stream, server_hostname=domain) as secured:
            remaining_timeout(deadline)
            return digest(secured.getpeercert(binary_form=True))


def tls_leaf(address, port, domain, expected, deadline=None):
    # 允许自签导入证书，但信任来自已核验的叶证书精确 DER 哈希，绝非跳过验证后直接成功。
    actual = tls_certificate(address, port, domain, **({"deadline": deadline} if deadline is not None else {}))
    if actual != expected: raise TlsNotReady("实际 Nginx TLS 指纹与本次证书不同。", 503)
    return {"serverName": domain, "sha256": actual}


def tls_http_readback(address, port, domain, expected, deadline=None):
    """证书之外回读真实 HTTPS 响应，阻止双 server 误配造成的本站重定向循环；不跟随外部地址。"""
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT); context.check_hostname = False; context.verify_mode = ssl.CERT_NONE
    target = "/"; seen = set()
    for _ in range(6):
        if target in seen: raise GuardError("本站 HTTPS 出现重定向循环，不能确认部署成功。", 503)
        seen.add(target)
        with socket.create_connection((address, port), timeout=remaining_timeout(deadline)) as stream:
            stream.settimeout(remaining_timeout(deadline))
            with context.wrap_socket(stream, server_hostname=domain) as secured:
                if digest(secured.getpeercert(binary_form=True)) != expected: raise TlsNotReady("HTTPS 业务连接证书不一致。", 503)
                secured.settimeout(remaining_timeout(deadline))
                secured.sendall(("GET " + target + " HTTP/1.1\r\nHost: " + domain + "\r\nConnection: close\r\n\r\n").encode("ascii"))
                response = http.client.HTTPResponse(_DeadlineSocket(secured, deadline) if deadline is not None else secured); response.begin()
                remaining_timeout(deadline)
                if response.status not in (301,302,303,307,308): return {"status": response.status}
                location = urllib.parse.urlsplit(response.getheader("Location", ""))
        if location.hostname and location.hostname.lower() != domain.lower(): return {"status": response.status, "externalRedirect": True}
        if location.scheme and location.scheme != "https": raise GuardError("本站 HTTPS 重定向到非 TLS 地址。", 503)
        if location.port and location.port != port: return {"status": response.status, "differentPortRedirect": True}
        target = urllib.parse.urljoin(target, (location.path or "/") + ("?" + location.query if location.query else ""))
        if not target.startswith("/") or any(ord(x) < 32 or ord(x) > 126 for x in target): raise GuardError("HTTPS 重定向地址无效。", 503)
    raise GuardError("本站 HTTPS 重定向超过回读上限。", 503)


class HostNginx:
    def __init__(self, state_dir, docker=None, discover=None, transport=None):
        self.state = Path(state_dir) / "nginx"
        self.state.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.docker = docker or DockerApi()
        self.discover_override, self.transport_factory = discover, transport or (lambda item: Transport(item, self.docker))
        self.lock = threading.RLock()
        self.thread_state = threading.local()

    @contextlib.contextmanager
    def exclusive(self):
        with self.lock:
            if getattr(self.thread_state, "held", False):
                yield; return
            with open(self.state / "transaction.lock", "a+b") as handle:
                if os.name == "posix":
                    import fcntl
                    fcntl.flock(handle, fcntl.LOCK_EX)
                self.thread_state.held = True
                try: yield
                finally:
                    self.thread_state.held = False
                    if os.name == "posix": fcntl.flock(handle, fcntl.LOCK_UN)

    def load(self, name, default=None):
        path = self.state / name
        if not path.exists(): return default
        return json.loads(read_native(path, 1024 * 1024))

    def save(self, name, value):
        path = self.state / name; pending = self.state / ("." + str(uuid.uuid4()) + ".pending")
        fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as handle:
            handle.write(canonical(value)); handle.flush(); os.fsync(handle.fileno())
        os.replace(pending, path)

    def discover(self):
        if self.discover_override: return self.discover_override()
        result, errors = [], []
        if Path(BT_BINARY).exists() and Path(BT_ROOT).is_dir():
            try:
                binary = regular_path(BT_BINARY); root_info = regular_path(BT_ROOT, directory=True)
                pid = int(read_native("/www/server/nginx/logs/nginx.pid", 128).strip())
                if os.readlink(f"/proc/{pid}/exe") != BT_BINARY:
                    raise GuardError("宝塔 Nginx 进程身份不匹配。", 409)
                code, _, version = run([BT_BINARY, "-v"])
                if code: raise GuardError("宝塔 Nginx 版本读取失败。", 503)
                # 接入身份绑定安装对象，不绑定进程代数；正常服务/主机重启不应永久停掉自动续期。
                # 每次发现仍重新检查运行 PID 的 exe，程序或配置目录被替换则必须重新接入。
                identity = ["BaoTa", BT_BINARY, binary.st_dev, binary.st_ino, digest(read_native(BT_BINARY, 64 * 1024 * 1024)), BT_ROOT, root_info.st_dev, root_info.st_ino]
                result.append({"id": "baota-native", "provider": "BaoTa", "name": "宝塔 Nginx", "kind": "native", "status": "running", "configRoot": BT_ROOT, "version": version.decode().strip()[:160], "pid": pid, "fingerprint": digest(canonical(identity))})
            except (OSError, ValueError, GuardError): errors.append("检测到宝塔安装，但无法确认运行进程和配置目录。")
        try:
            for summary in self.docker.json("GET", "/containers/json?all=1"):
                if "openresty" not in summary.get("Image", "").lower(): continue
                container_id = summary.get("Id", "")
                if not HASH.fullmatch(container_id): continue
                detail = self.docker.json("GET", "/containers/" + container_id + "/json")
                if not detail.get("State", {}).get("Running"): continue
                mounts = [{k: mount.get(k) for k in ("Type", "Source", "Destination", "RW")} for mount in detail.get("Mounts", [])]
                # Docker 不保证 Mounts 返回顺序；只消除序列差异，完整挂载字段及重复记录仍参与身份校验。
                mounts.sort(key=canonical)
                provider = "1Panel" if re.search(r"(?:^|/)1panel/openresty(?:[:@]|$)", summary.get("Image", "").lower()) else "OpenResty"
                item = {"id": "onepanel-" + container_id[:24], "provider": provider, "name": detail.get("Name", "").lstrip("/"), "kind": "docker", "containerId": container_id, "status": "running", "version": detail.get("Config", {}).get("Image", ""), "mounts": mounts}
                transport = self.transport_factory(item)
                roots = [path for path in CONTAINER_ROOTS if any(m.get("RW") is True and (path == m.get("Destination") or path.startswith(str(m.get("Destination", "")) + "/")) for m in mounts)]
                if not roots: continue
                item["configRoot"] = roots[0]
                item["fingerprint"] = digest(canonical([container_id, detail.get("Image"), mounts, roots[0]]))
                result.append(item)
        except (OSError, ValueError, GuardError): errors.append("无法完整读取 Docker OpenResty 实例。")
        return result, errors

    def instance(self, instance_id, expected=None, attached=False):
        if expected is not None and (not isinstance(expected, str) or not HASH.fullmatch(expected)): raise GuardError("实例身份摘要无效。")
        items, _ = self.discover()
        item = next((x for x in items if x["id"] == instance_id), None)
        if not item: raise GuardError("Nginx 实例未发现或已停止，请刷新。", 404)
        if expected is not None and expected != item["fingerprint"]:
            raise GuardError("Nginx 实例身份或挂载已变化，请重新发现并明确接入。", 409)
        known = self.load("attachments.json", {})
        item["attached"] = known.get(instance_id) == item["fingerprint"]
        if attached and not item["attached"]: raise GuardError("请先明确接入此第三方 Nginx 实例。", 409)
        return item

    def site(self, instance, site_id):
        transport = self.transport_factory(instance)
        for name in transport.files(instance["configRoot"]):
            if digest((instance["id"] + "\0" + name).encode())[:32] == site_id:
                path = str(PurePosixPath(instance["configRoot"]) / name)
                raw = transport.read(path)
                return {"id": site_id, "name": name[:-5], "fileName": name, "path": path, "raw": raw, "sha256": digest(raw)}
        raise GuardError("本站配置不存在或未处于已发现的受限目录。", 404)

    def transaction(self, body, content=None, validate=True, action="config", verify=None, extra=None, rollback_verify=None):
        with self.exclusive():
            instance = self.instance(body.get("instanceId"), body.get("expectedFingerprint"), attached=True)
            site = self.site(instance, body.get("siteId"))
            if body.get("confirm") != site["id"]: raise GuardError("请明确确认本站标识。")
            try: operation = str(uuid.UUID(body.get("requestId", "")))
            except (ValueError, TypeError): raise GuardError("网站写入需要稳定 UUID 请求标识。")
            expected = body.get("expectedSha256", "")
            if not HASH.fullmatch(expected): raise GuardError("网站写入需要原配置 SHA-256。")
            content = body.get("content") if content is None else content
            if validate: validate_edit(site["raw"].decode(), content)
            new = content.encode(); request_hash = digest(canonical(body))
            revision = operation if action == "config" else action + "-" + operation
            name = "operation-" + revision + ".json"
            record = self.load(name)
            if record:
                if record["requestHash"] != request_hash: raise GuardError("请求标识已用于不同的网站变更。", 409)
                if record["state"] == "succeeded":
                    if site["sha256"] != record["newHash"]: raise GuardError("此请求曾完成，但网站现已变化，请刷新。", 409)
                    if verify: verify(instance, site, transport=self.transport_factory(instance))
                    return record["receipt"]
                if record["state"] in ("rolledBack", "recoveryFailed"):
                    if site["sha256"] != record["oldHash"]: raise GuardError("已恢复任务之后发生外部修改，停止旧任务重试。", 409)
                    if record["state"] == "recoveryFailed" and rollback_verify:
                        rollback_verify(instance, site, transport=self.transport_factory(instance))
                    record["attempts"] = record.get("attempts", 1) + 1
                    record["state"] = "prepared"; self.save(name, record)
            elif site["sha256"] != expected:
                raise GuardError("网站配置已被其它管理员修改，请刷新后重试。", 409)
            if not record:
                record = {"requestHash": request_hash, "requestId": operation, "revisionId": revision, "instanceId": instance["id"], "siteId": site["id"], "created": time.time(), "oldHash": expected, "newHash": digest(new), "old": base64.b64encode(site["raw"]).decode(), "state": "prepared"}
                self.save(name, record)
            transport = self.transport_factory(instance)
            def verify_restored():
                if rollback_verify:
                    try: rollback_verify(instance, site, transport=transport)
                    except Exception as recovery_error:
                        record.update(state="recoveryFailed", recoveryError=type(recovery_error).__name__); self.save(name, record)
                        raise GuardError("网站配置已还原，但旧 TLS 或业务回读未通过，不能确认恢复；请保留备份并核对原服务。", 503) from recovery_error
            try:
                current = digest(transport.read(site["path"]))
                if current == expected:
                    transport.replace(site["path"], expected, new, operation)
                elif current != record["newHash"]:
                    raise GuardError("未完成任务期间配置已被外部更改，停止覆盖。", 409)
                self.instance(instance["id"], instance["fingerprint"], attached=True)
                transport.test(); transport.reload()
                self.instance(instance["id"], instance["fingerprint"], attached=True)
                if digest(transport.read(site["path"])) != record["newHash"]: raise GuardError("重载期间配置被其它管理员修改，不能确认本次发布。", 409)
                if verify: verify(instance, site, transport=transport)
                receipt = {"requestId": operation, "instanceId": instance["id"], "siteId": site["id"], "sha256": record["newHash"], "configSha256": record["newHash"], "fingerprint": instance["fingerprint"], "backupRevision": revision, "validated": True, "reloaded": True, **(extra or {})}
                record.update(state="succeeded", receipt=receipt); self.save(name, record)
                return receipt
            except Exception as original:
                try:
                    self.instance(instance["id"], instance["fingerprint"], attached=True)
                    current = digest(transport.read(site["path"]))
                    if current == record["newHash"]:
                        transport.replace(site["path"], current, base64.b64decode(record["old"]), operation + "-restore")
                        transport.test(); transport.reload()
                        verify_restored()
                        record["state"] = "rolledBack"; self.save(name, record)
                        verified_message = "原服务回读" if rollback_verify else "重载"
                        raise GuardError("网站发布未完成，已恢复原配置并验证" + verified_message + "；备份已保留。", getattr(original, "status", 503)) from original
                    if current == record["oldHash"]:
                        verify_restored()
                        record["state"] = "rolledBack"; self.save(name, record)
                        raise original
                    record["state"] = "conflict"; self.save(name, record)
                    raise GuardError("网站发布期间出现外部变更，未覆盖该变更；请回读配置和本次备份。", 409) from original
                except GuardError:
                    raise
                except Exception:
                    raise GuardError("网站发布失败且无法确认恢复；原始备份已保留，请在原面板核对服务。", 503) from original

    def endpoint_addresses(self, instance, deadline=None):
        if instance["kind"] == "native": return ["127.0.0.1"]
        item = self.docker.json("GET", "/containers/" + instance["containerId"] + "/json", **({"deadline": deadline} if deadline is not None else {}))
        if not item.get("State", {}).get("Running"): raise GuardError("Nginx 容器已停止。", 409)
        if item.get("HostConfig", {}).get("NetworkMode") == "host": return ["127.0.0.1"]
        addresses = [value.get("IPAddress", "") for value in item.get("NetworkSettings", {}).get("Networks", {}).values()]
        return [str(ipaddress.ip_address(value)) for value in addresses if value]

    def capture_previous_tls(self, instance, text):
        """修改任何网站文件前保存实际旧 SNI 指纹；只有可回读的旧 TLS 才能承诺恢复它。"""
        snapshot = []; seen = set()
        for server in [node for node in parse_config(text) if node["name"] == "server"]:
            for port in listen_ports(server, tls=True):
                for domain in site_domains(text[server["start"]:server["end"]]):
                    if (domain, port) in seen: continue
                    seen.add((domain, port)); previous = None
                    for address in self.endpoint_addresses(instance):
                        try:
                            fingerprint = tls_certificate(address, port, domain)
                            tls_http_readback(address, port, domain, fingerprint)
                            previous = {"serverName": domain, "port": port, "certificateSha256": fingerprint}; break
                        except (OSError, GuardError): pass
                    if previous is None: raise GuardError("原网站 TLS 无法取得恢复快照，未改写网站配置；请先在原面板核对服务。", 503)
                    snapshot.append(previous)
        return snapshot

    def wait_tls_readback(self, instance, expected, failure):
        # reload 观测到新 PID 后仍有交接窗口。每轮必须全部 SNI/端口通过，不能累计零散成功。
        deadline = time.monotonic() + TLS_READBACK_SECONDS
        addresses = self.endpoint_addresses(instance, deadline=deadline)
        last_error = None
        while time.monotonic() < deadline:
            complete = True
            for previous in expected:
                matched = False
                for address in addresses:
                    try:
                        remaining_timeout(deadline)
                        tls_leaf(address, previous["port"], previous["serverName"], previous["certificateSha256"], deadline=deadline)
                        tls_http_readback(address, previous["port"], previous["serverName"], previous["certificateSha256"], deadline=deadline)
                        remaining_timeout(deadline)
                        matched = True; break
                    except (OSError, TlsNotReady) as error: last_error = error
                if not matched: complete = False; break
            if complete and time.monotonic() < deadline: return
            remaining = deadline - time.monotonic()
            if remaining <= 0: break
            time.sleep(min(.1, remaining))
        raise GuardError(failure, 503) from last_error

    def verify_previous_tls(self, instance, snapshot):
        self.wait_tls_readback(instance, snapshot, "原网站 TLS 指纹或业务响应未恢复，不能确认回退就绪。")

    def verify_managed_tls(self, body):
        if set(body) != {"ownerId", "resourceId", "containerId", "domains"} or not HASH.fullmatch(body.get("containerId", "")): raise GuardError("受管 TLS 请求格式无效。")
        if not re.fullmatch(r"[a-z][a-z0-9-]{0,39}", body.get("ownerId", "")) or not isinstance(body.get("resourceId"), str): raise GuardError("受管 TLS 归属无效。")
        domains = body.get("domains")
        if not isinstance(domains, list) or not 1 <= len(domains) <= 100: raise GuardError("TLS 域名数量无效。")
        seen = set()
        for value in domains:
            if not isinstance(value, dict) or set(value) != {"serverName", "certificateSha256"} or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]{0,252}", value.get("serverName", "")) or not HASH.fullmatch(value.get("certificateSha256", "")) or value["serverName"] in seen: raise GuardError("TLS 域名或证书摘要无效。")
            seen.add(value["serverName"])
        item = self.docker.json("GET", "/containers/" + body["containerId"] + "/json")
        labels = item.get("Config", {}).get("Labels", {}) or {}
        if item.get("Id") != body["containerId"] or not item.get("State", {}).get("Running") or labels.get("io.microi.panel.owner") != body["ownerId"] or labels.get("io.microi.panel.resource") != body["resourceId"] or labels.get("io.microi.panel.plugin") != "nginx": raise GuardError("TLS 容器不属于当前面板的 Nginx 资源。", 409)
        network = item.get("NetworkSettings", {}).get("Networks", {}).get("mci-panel-" + body["ownerId"], {})
        try: address = str(ipaddress.ip_address(network.get("IPAddress", "")))
        except ValueError: raise GuardError("受管容器未连接其归属网络。", 409)
        receipts = [tls_leaf(address, 443, value["serverName"], value["certificateSha256"]) for value in domains]
        return {"verified": True, "certificates": receipts}

    def prepare_http01(self, body):
        with self.exclusive():
            instance = self.instance(body.get("instanceId"), body.get("expectedFingerprint"), attached=True)
            site = self.site(instance, body.get("siteId")); transport = self.transport_factory(instance)
            expected_domains = body.get("expectedDomains")
            if not isinstance(expected_domains, list) or not expected_domains or any(not isinstance(x, str) for x in expected_domains) or sorted(set(expected_domains)) != sorted(site_domains(site["raw"].decode())):
                raise GuardError("网站域名已变化或缺少域名快照，请刷新后重新申请。", 409)
            try: operation = str(uuid.UUID(body.get("requestId", "")))
            except (ValueError, TypeError): raise GuardError("HTTP-01 请求标识无效。")
            if body.get("confirm") != site["id"]: raise GuardError("请确认本站。")
            key = "http01-plan-" + operation + ".json"; plan = self.load(key)
            if plan:
                if plan["requestHash"] != digest(canonical(body)): raise GuardError("HTTP-01 请求标识已用于其它参数。", 409)
            else:
                if site["sha256"] != body.get("expectedSha256"): raise GuardError("网站配置已变化，请刷新。", 409)
                text = site["raw"].decode(); all_servers = [node for node in parse_config(text) if node["name"] == "server"]
                domain_ports = http_ports_by_domain(text)
                servers = [node for node in all_servers if listen_ports(node)]
                domains = site_domains(text)
                if not domains or any(domain.startswith("*.") for domain in domains): raise GuardError("HTTP-01 需要明确域名，不能包含通配符。")
                # 每个网站固定隔离 ID，续期复用同一目录，避免每次续期产生不同路由或目录。
                isolation = digest((instance["fingerprint"] + "\0" + site["id"]).encode())
                owned_key = "http01-site-" + site["id"] + ".json"
                owned = self.load(owned_key)
                def route_hashes(source):
                    return [digest(source[n["start"]:n["end"]].encode()) for n, _ in walk(parse_config(source)) if n["name"] == "location" and ("acme-challenge" in " ".join(n["args"]) or "@microi_old_acme_" + isolation[:16] in n["args"])]
                if ".microi-acme-" + isolation in text:
                    # 后续续期复用原挑战及原 CA 回退；不能把自己的替代 root 当成原面板的 root。
                    if not owned or owned["fingerprint"] != instance["fingerprint"] or owned["routeHashes"] != route_hashes(text): raise GuardError("已接入的 ACME 路由发生外部修改，请回读后在原面板确认。", 409)
                    plan = {"requestHash": digest(canonical(body)), "content": text, "directory": owned["directory"], "hostPath": owned["hostPath"], "isolationId": isolation, "domains": domains, "domainPorts": domain_ports}
                    self.save(key, plan)
                    return self.finish_http01(body, instance, site, transport, plan)
                replacements = []; roots = []
                for server in servers:
                    locations = [x for x in server["children"] if x["name"] == "location" and "acme-challenge" in " ".join(x["args"])]
                    existing = locations[0] if len(locations) == 1 else None
                    if len(locations) > 1: raise GuardError("已有多条 ACME 路由，需先在原面板确认。", 409)
                    original_root = next((literal(x["args"][0]) for x in server["children"] if x["name"] == "root" and len(x["args"]) == 1), None)
                    if existing:
                        if existing["args"] not in (("^~", "/.well-known/acme-challenge"), ("^~", "/.well-known/acme-challenge/")):
                            raise GuardError("现有自定义 ACME 路由不能安全合并，请在原面板确认。", 409)
                        allowed = {"allow", "root", "try_files", "types", "default_type", "disable_symlinks", "limit_except"}
                        if any(x["name"] not in allowed for x in existing["children"]): raise GuardError("现有 ACME 路由包含自定义行为，停止自动修改。", 409)
                        original_root = next((literal(x["args"][0]) for x in existing["children"] if x["name"] == "root" and len(x["args"]) == 1), original_root)
                        existing_try = [x for x in existing["children"] if x["name"] == "try_files"]
                        if existing_try and not any(".microi-acme-" + isolation in " ".join(x["args"]) for x in existing_try): raise GuardError("现有 ACME 文件选择规则需要在原面板确认。", 409)
                    if not original_root:
                        names = set(site_domains(text[server["start"]:server["end"]]))
                        candidates = {literal(x["args"][0]) for other in all_servers if names.intersection(site_domains(text[other["start"]:other["end"]])) for x in other["children"] if x["name"] == "root" and len(x["args"]) == 1}
                        original_root = candidates.pop() if len(candidates) == 1 else instance["configRoot"]
                    checked_path(original_root)
                    try:
                        if instance["kind"] == "native": trusted_native_challenge_directory(original_root)
                        else: trusted_bind_directory(transport.host_path(original_root))
                        root = original_root
                    except (GuardError, OSError):
                        # 原生配置目录可能为原厂私有权限，不能靠修改其权限供 worker 读取。
                        # 容器仍使用已核验配置挂载；两种 fallback 都保留原 CA 的命名路由。
                        root = BT_WEB_ROOT if instance["kind"] == "native" else instance["configRoot"]
                    if instance["kind"] == "native": trusted_native_challenge_directory(root)
                    else: trusted_bind_directory(transport.host_path(root))
                    roots.append(root)
                    fallback = "=404" if root == original_root else "@microi_old_acme_" + isolation[:16]
                    route = '\n    location ^~ /.well-known/acme-challenge/ {\n        root "' + root + '";\n        try_files /.microi-acme-' + isolation + '$uri ' + ("$uri =404" if fallback == "=404" else fallback) + ';\n        types {} default_type text/plain; disable_symlinks on;\n        limit_except GET HEAD { deny all; }\n    }\n'
                    if fallback != "=404": route += '    location ' + fallback + ' { root "' + original_root + '"; try_files $uri =404; types {} default_type text/plain; disable_symlinks on; limit_except GET HEAD { deny all; } }\n'
                    replacements.append((existing["start"], existing["end"], route) if existing else (server["close"], server["close"], route))
                    # 原本单独的 HTTP 跳转块仍保留全站跳转，只让固定 ACME 前缀先进入上述隔离路由。
                    for node in server["children"]:
                        if node["name"] == "return" and node["args"][:1] in (("301",), ("302",), ("307",), ("308",)):
                            original = text[node["start"]:node["end"]]
                            replacements.append((node["start"], node["end"], 'if ($uri !~ "^/\\.well-known/acme-challenge/") { ' + original + ' }'))
                if len(set(roots)) != 1: raise GuardError("本站多个 server 使用不同验证目录，需在原面板统一后重试。", 409)
                directory = roots[0] + "/.microi-acme-" + isolation
                host_path = transport.host_path(directory)
                plan = {"requestHash": digest(canonical(body)), "content": edit_spans(text, replacements), "directory": directory, "hostPath": host_path, "isolationId": isolation, "domains": domains, "domainPorts": domain_ports}
                self.save(owned_key, {"fingerprint": instance["fingerprint"], "directory": directory, "hostPath": host_path, "routeHashes": route_hashes(plan["content"])})
                self.save(key, plan)
            return self.finish_http01(body, instance, site, transport, plan)

    def finish_http01(self, body, instance, site, transport, plan):
            # 旧计划可能把 QUIC 443 分类成普通 HTTP；按已冻结的配置正文重新识别，
            # 保留原请求、配置和隔离目录，不改写原计划，也不要求丢弃失败任务。
            domain_ports = http_ports_by_domain(plan["content"])
            def validate_directory(path):
                if instance["kind"] != "native":
                    trusted_bind_directory(path)
                    return
                try: trusted_native_challenge_directory(path)
                except (GuardError, OSError) as error:
                    # 失败计划已固定路径，重试绝不悄悄换根；新修复只影响新的请求。
                    raise GuardError("HTTP-01 计划的原生挑战目录不可安全访问；原计划保持不变，请检查目录并刷新后提交新请求。", 409) from error
            if instance["kind"] == "native":
                validate_directory(str(PurePosixPath(plan["directory"]).parent))
            marker = canonical({"instance": instance["fingerprint"], "site": site["id"], "isolation": plan["isolationId"]})
            transport.create_owned(plan["directory"], marker)
            validate_directory(plan["hostPath"])
            def verify(item, current, transport):
                transport.create_owned(plan["directory"], marker); validate_directory(plan["hostPath"])
                token = uuid.uuid4().hex; value = uuid.uuid4().hex.encode()
                try:
                    transport.challenge_token(plan["directory"], token, value)
                    for domain in plan["domains"]:
                        for port in domain_ports[domain]:
                            reachable = False
                            for address in self.endpoint_addresses(item):
                                connection = http.client.HTTPConnection(address, port, timeout=3)
                                try:
                                    connection.request("GET", "/.well-known/acme-challenge/" + token, headers={"Host": domain})
                                    response = connection.getresponse()
                                    if response.status == 200 and response.read(1024) == value: reachable = True; break
                                except OSError: pass
                                finally: connection.close()
                            if not reachable: raise GuardError("实际 HTTP-01 路由未返回隔离目录探针，停止申请并恢复配置。", 503)
                finally: transport.challenge_token(plan["directory"], token)
            return self.transaction(body, plan["content"], validate=False, action="http01", verify=verify,
                extra={"prepared": True, "domains": plan["domains"], "challengeHostPath": plan["hostPath"], "isolationId": plan["isolationId"]})

    def deploy_certificate(self, body):
        with self.exclusive():
            instance = self.instance(body.get("instanceId"), body.get("expectedFingerprint"), attached=True)
            site = self.site(instance, body.get("siteId")); transport = self.transport_factory(instance)
            try: operation = str(uuid.UUID(body.get("requestId", "")))
            except (ValueError, TypeError): raise GuardError("证书请求标识无效。")
            certificate, private_key = body.get("certificatePem"), body.get("privateKeyPem")
            if not isinstance(certificate, str) or not isinstance(private_key, str) or not 1 <= len(certificate.encode()) <= MAX_CONFIG or not 1 <= len(private_key.encode()) <= MAX_CONFIG: raise GuardError("证书或私钥内容无效。")
            # Python SSL 验证证书链格式与密钥配对；验证临时文件仅存在 root 状态目录且在 finally 清理。
            folder = self.state / (".certificate-" + str(uuid.uuid4())); folder.mkdir(mode=0o700)
            try:
                for name, value in (("certificate.pem", certificate), ("key.pem", private_key)):
                    fd = os.open(folder / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                    with os.fdopen(fd, "w") as handle: handle.write(value)
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); context.load_cert_chain(folder / "certificate.pem", folder / "key.pem")
                decoded = ssl._ssl._test_decode_cert(str(folder / "certificate.pem"))
                leaf = re.search(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", certificate, re.S)
                certificate_hash = digest(ssl.PEM_cert_to_DER_cert(leaf.group(0)))
                if ssl.cert_time_to_seconds(decoded["notAfter"]) <= time.time() or ssl.cert_time_to_seconds(decoded["notBefore"]) > time.time(): raise GuardError("证书不在有效期内。")
            except (ssl.SSLError, ValueError, AttributeError): raise GuardError("证书或私钥格式、配对校验失败。")
            finally:
                for name in ("certificate.pem", "key.pem"):
                    path = folder / name
                    if path.exists(): path.unlink()
                folder.rmdir()
            names = [name.lower() for kind, name in decoded.get("subjectAltName", []) if kind == "DNS"]
            domains = site_domains(site["raw"].decode())
            if not domains or any(not any(domain == name or name.startswith("*.") and domain.endswith(name[1:]) and domain.count(".") == name.count(".") for name in names) for domain in domains): raise GuardError("证书未覆盖本站所有域名。")
            directory = instance["configRoot"] + "/.microi-cert-" + site["id"] + "-" + operation
            key = "certificate-plan-" + operation + ".json"; plan = self.load(key)
            if plan:
                if plan["requestHash"] != digest(canonical(body)): raise GuardError("证书请求标识已用于其它参数。", 409)
                if "previousTls" not in plan:
                    if site["sha256"] != body.get("expectedSha256"): raise GuardError("旧证书任务缺少恢复快照且配置已切换，请在原面板核对后创建新任务。", 409)
                    plan["previousTls"] = self.capture_previous_tls(instance, site["raw"].decode()); self.save(key, plan)
            else:
                if site["sha256"] != body.get("expectedSha256"): raise GuardError("网站配置已变化，停止证书部署。", 409)
                text = site["raw"].decode(); replacements = []; domain_ports = {}
                servers = [node for node in parse_config(text) if node["name"] == "server"]
                server_domains = lambda node: site_domains(text[node["start"]:node["end"]])
                tls_servers = [node for node in servers if any(x["name"] == "listen" and "ssl" in x["args"] for x in node["children"])]
                covered = {domain for node in tls_servers for domain in server_domains(node)}
                targets = list(tls_servers)
                remaining = set(domains) - covered
                for domain in remaining:
                    owners = [node for node in servers if domain in server_domains(node)]
                    if len(owners) != 1 or set(server_domains(owners[0])) & covered: raise GuardError("HTTP 与 HTTPS server 域名存在歧义，停止自动增加 TLS 监听。", 409)
                    if owners[0] not in targets: targets.append(owners[0])
                if any(sum(domain in server_domains(node) for node in tls_servers) > 1 for domain in covered): raise GuardError("同域名存在多个 TLS server，需在原面板确认。", 409)
                for server in targets:
                    add = ""; cert_nodes = [x for x in server["children"] if x["name"] in ("ssl_certificate", "ssl_certificate_key")]
                    for node in cert_nodes:
                        path = directory + ("/fullchain.pem" if node["name"] == "ssl_certificate" else "/private.key")
                        replacements.append((node["start"], node["end"], node["name"] + ' "' + path + '";'))
                    if not any(x["name"] == "ssl_certificate" for x in cert_nodes): add += '\n    ssl_certificate "' + directory + '/fullchain.pem";'
                    if not any(x["name"] == "ssl_certificate_key" for x in cert_nodes): add += '\n    ssl_certificate_key "' + directory + '/private.key";'
                    listeners = [x for x in server["children"] if x["name"] == "listen" and "ssl" in x["args"]]
                    ports = set()
                    if not listeners: add += "\n    listen 443 ssl;"; ports.add(443)
                    for listener in listeners:
                        value = literal(listener["args"][0]).rsplit(":", 1)[-1]
                        if not value.isdigit() or not 1 <= int(value) <= 65535: raise GuardError("TLS 监听端口无法安全确定。", 409)
                        ports.add(int(value))
                    replacements.append((server["close"], server["close"], add + "\n"))
                    for domain in server_domains(server): domain_ports[domain] = sorted(ports)
                plan = {"requestHash": digest(canonical(body)), "content": edit_spans(text, replacements), "domainPorts": domain_ports, "domains": domains,
                        "previousTls": self.capture_previous_tls(instance, text)}
                self.save(key, plan)
            transport.create_owned(directory, canonical({"instance": instance["fingerprint"], "site": site["id"], "certificate": certificate_hash}), {"fullchain.pem": certificate.encode(), "private.key": private_key.encode()})
            def verify(item, current, transport):
                expected = [{"serverName": domain, "port": port, "certificateSha256": certificate_hash} for domain in plan["domains"] for port in plan["domainPorts"][domain]]
                self.wait_tls_readback(item, expected, "Nginx 实际 TLS 未回读到本次证书，已停止登记成功。")
            return self.transaction(body, plan["content"], validate=False, action="certificate", verify=verify,
                extra={"verified": True, "certificateSha256": certificate_hash},
                rollback_verify=(lambda item, current, transport: self.verify_previous_tls(item, plan["previousTls"])) if plan["previousTls"] else None)

    def dispatch(self, method, target, body):
        parsed = urllib.parse.urlsplit(target)
        query = urllib.parse.parse_qs(parsed.query, strict_parsing=True)
        params = {key: values[0] for key, values in query.items() if len(values) == 1}
        path = parsed.path
        if method == "POST":
            if not isinstance(body, dict): raise GuardError("Nginx 请求必须为对象。")
            if path != "/nginx/verify-managed-tls" and not HASH.fullmatch(body.get("expectedFingerprint", "")): raise GuardError("必须提交已发现实例的身份摘要。")
        if method == "POST" and path == "/nginx/verify-managed-tls": return self.verify_managed_tls(body)
        if method == "POST" and path == "/nginx/http01": return self.prepare_http01(body)
        if method == "POST" and path == "/nginx/certificate": return self.deploy_certificate(body)
        if method == "GET" and path == "/nginx/instances":
            items, errors = self.discover(); known = self.load("attachments.json", {})
            return {"protocol": 1, "instances": [{k: v for k, v in (item | {"attached": known.get(item["id"]) == item["fingerprint"]}).items() if k not in ("mounts", "pid")} for item in items], "errors": errors, "observedAt": time.time()}
        if method == "POST" and path == "/nginx/attach":
            with self.exclusive():
                item = self.instance(body.get("instanceId"), body.get("expectedFingerprint"))
                if body.get("confirm") != item["id"]: raise GuardError("请明确确认需要接入的 Nginx 实例。")
                known = self.load("attachments.json", {}); known[item["id"]] = item["fingerprint"]; self.save("attachments.json", known)
                return {"instanceId": item["id"], "fingerprint": item["fingerprint"], "attached": True}
        if method == "GET" and path in ("/nginx/sites", "/nginx/config", "/nginx/history"):
            item = self.instance(params.get("instanceId")); transport = self.transport_factory(item)
            if path.endswith("/sites"):
                sites = []
                filenames = transport.files(item["configRoot"])
                if len(filenames) > 500: raise GuardError("实例超过 500 个配置，不能返回不完整的网站列表。", 413)
                for name in filenames:
                    raw = transport.read(str(PurePosixPath(item["configRoot"]) / name)); domains = site_domains(raw.decode())
                    if domains: sites.append({"id": digest((item["id"] + "\0" + name).encode())[:32], "name": name[:-5], "fileName": name, "sha256": digest(raw), "domains": domains})
                return {"instanceId": item["id"], "fingerprint": item["fingerprint"], "sites": sites}
            site = self.site(item, params.get("siteId"))
            if path.endswith("/config"):
                return {"instanceId": item["id"], "siteId": site["id"], "content": site["raw"].decode(), "domains": site_domains(site["raw"].decode()), "sha256": site["sha256"], "fingerprint": item["fingerprint"]}
            # 逐个读取并仅保留最近 100 条摘要，不能把全部含配置正文的备份载入 256 MiB 守护进程。
            revisions = []
            for path in self.state.glob("operation-*.json"):
                record = self.load(path.name)
                if record["instanceId"] == item["id"] and record["siteId"] == site["id"]:
                    revisions.append({"id": record.get("revisionId", record["requestId"]), "created": record["created"], "sha256": record["oldHash"], "state": record["state"]})
                    revisions.sort(key=lambda value: value["created"], reverse=True)
                    del revisions[100:]
            return {"instanceId": item["id"], "siteId": site["id"], "revisions": revisions}
        if method == "POST" and path == "/nginx/config": return self.transaction(body)
        if method == "POST" and path == "/nginx/rollback":
            revision = body.get("revisionId", "")
            if not isinstance(revision, str) or not re.fullmatch(r"(?:(?:http01|certificate)-)?[a-f0-9-]{36}", revision): raise GuardError("备份版本标识无效。")
            record = self.load("operation-" + revision + ".json")
            if not record or (record["instanceId"], record["siteId"]) != (body.get("instanceId"), body.get("siteId")):
                raise GuardError("备份不属于当前实例和网站。", 409)
            return self.transaction(body, base64.b64decode(record["old"]).decode(), validate=False)
        if method == "POST" and path in ("/nginx/test", "/nginx/reload"):
            with self.exclusive():
                item = self.instance(body.get("instanceId"), body.get("expectedFingerprint"), attached=True)
                if body.get("confirm") != item["id"]: raise GuardError("请明确确认 Nginx 实例。")
                transport = self.transport_factory(item); transport.test()
                if path.endswith("/reload"): transport.reload()
                self.instance(item["id"], item["fingerprint"], attached=True)
                return {"instanceId": item["id"], "fingerprint": item["fingerprint"], "validated": True, "reloaded": path.endswith("/reload")}
        raise GuardError("不支持的 Nginx 固定动作。", 404)
