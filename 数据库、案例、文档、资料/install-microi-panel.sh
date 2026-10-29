#!/usr/bin/env bash
# 吾码服务器运维面板独立安装器。安装本面板与宿主防护，不变更其它面板、Docker配置或业务数据。
set -Eeuo pipefail
umask 077
PANEL_ROOT=/microi/panel
PANEL_PORT=61890
PANEL_BIND=0.0.0.0
PANEL_HOST=''
PANEL_IMAGE=registry.cn-hangzhou.aliyuncs.com/microios/microi-panel:v2.0.2
PANEL_IMAGE_EXPLICIT=0
PANEL_LEGACY_PANEL_ONLY=0
PANEL_OFFLINE=0
PANEL_UPGRADE=0
PANEL_CHECK=0
PANEL_DOCKER_INSTALL=0
PANEL_YES=0
PANEL_PREVIOUS_IMAGE=''
PANEL_PREVIOUS_CONTAINER_ID=''
PANEL_EXPECTED_MOUNTS=''
PANEL_ORIGINAL_MOUNTS=''
PANEL_CANDIDATE_CONTAINER_ID=''
PANEL_HAS_AUTH_GUARD=0
PANEL_HAS_DISK_GUARD=0
PANEL_GUARD_PYTHON=/usr/bin/python3
PANEL_GUARD_SYSTEMD_VERSION=''
PANEL_GUARD_EXPORT_ID=''
PANEL_GUARD_STAGE=''
PANEL_OVERRIDE_RECEIPT=''
PANEL_GUARD_PREVIOUS_TREE=''
PANEL_GUARD_CANDIDATE_TREE=''
PANEL_GUARD_CANDIDATE_UNIT=''
PANEL_GUARD_PREVIOUS_ACTIVE=''
PANEL_GUARD_PREVIOUS_ENABLED=''
PANEL_GUARD_PREVIOUS_UNIT=''
PANEL_GUARD_PREVIOUS_SERVICE=''
PANEL_GUARD_CANDIDATE_SERVICE=''
PANEL_ORIGINAL_ARGS=("$@")
fail(){ printf 'Microi.Panel：%s\n' "$*" >&2; exit 1; }
# MICROI_DISK_GUARD_GENERATED_BEGIN
# 此模板由 tools/sync-disk-guard-installer.mjs 展开为自包含安装器；不要手工编辑生成段。
microi_install_disk_guard() (
  set -e
  [ "$(id -u)" = 0 ] || { printf 'Microi：宿主维护安装需要 root。\n' >&2; exit 1; }
  local base=/opt/microi-disk-guard stage selected='' candidate runtime_tmp archive mode
  for candidate in / /opt "$base"; do
    [ ! -L "$candidate" ] || { printf 'Microi：维护安装路径不能是软链接。\n' >&2; exit 1; }
    if [ -e "$candidate" ]; then
      mode=$(stat -c %a "$candidate")
      [ "$(stat -c %u "$candidate")" = 0 ] && [ "$((8#$mode & 8#022))" = 0 ] || { printf 'Microi：维护安装目录不受 root 控制。\n' >&2; exit 1; }
    fi
  done
  if [ -e "$base" ] && [ "$(stat -c %a "$base")" != 700 ]; then printf 'Microi：已有维护目录权限异常，保留现场。\n' >&2; exit 1; fi
  install -d -m 700 "$base"
  stage=$(mktemp -d "$base/.source.XXXXXXXX")
  trap 'case "$stage" in /opt/microi-disk-guard/.source.*) [ ! -L "$stage" ] && rm -r -- "$stage";; esac' EXIT
  for candidate in "${MICROI_INSTALL_DISK_GUARD_PYTHON:-}" "$base/python-3.11.18/python/bin/python3" /opt/microi-panel-runtime-3.11.18-20261026/python/bin/python3 "$(command -v python3 || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ] && "$candidate" -E -s -B -c 'import sys,sqlite3,socket; assert sys.version_info >= (3,9)' >/dev/null 2>&1; then selected=$candidate; break; fi
  done
  if [ -z "$selected" ]; then
    # 精确固定官方独立运行时及哈希；只补本服务依赖，不替换系统或宝塔 Python。
    [ "$(uname -m)" = x86_64 ] || { printf 'Microi：请为此架构配置 root 控制的 Python 3.9+。\n' >&2; exit 1; }
    runtime_tmp="$stage/runtime"
    archive="$stage/python-runtime.tar.gz"
    curl --fail --location --proto '=https' --tlsv1.2 --connect-timeout 15 --max-time 600 \
      'https://github.com/astral-sh/python-build-standalone/releases/download/20261026/cpython-3.11.18%2B20261026-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz' -o "$archive"
    printf '%s  %s\n' 17c4978a36c496dc53c08899ef8dad1ad2734f6325f08d6033a1e66419e0af26 "$archive" | sha256sum -c -
    install -d -m 700 "$runtime_tmp"
    tar -tzf "$archive" > "$stage/runtime-files.txt"
    if grep -E '(^/|(^|/)\.\.(/|$))' "$stage/runtime-files.txt"; then printf 'Microi：运行时归档路径异常。\n' >&2; exit 1; fi
    tar -xzf "$archive" --no-same-owner -C "$runtime_tmp"
    "$runtime_tmp/python/bin/python3" -E -s -B -c 'import sys,sqlite3; assert sys.version_info >= (3,9)'
    if [ -e "$base/python-3.11.18" ]; then printf 'Microi：独立运行时目录已存在但未通过选择检查，停止覆盖。\n' >&2; exit 1; fi
    mv -- "$runtime_tmp" "$base/python-3.11.18"
    selected="$base/python-3.11.18/python/bin/python3"
  fi
  cat > "$stage/daemon.py" <<'MICROI_DISK_GUARD_DAEMON_SOURCE'
#!/usr/bin/env python3
"""吾码独立宿主磁盘维护。固定 Unix socket，所有删除都绑定镜像身份并由 Docker 再次核验引用。"""
import argparse
import contextlib
import datetime as dt
import hashlib
import http.client
import http.server
import json
import os
from pathlib import Path
import re
import signal
import socket
import socketserver
import sqlite3
import stat
import struct
import subprocess
import sys
import threading
import time
import uuid
from urllib.parse import quote

PROTOCOL = 1
ROOT = Path('/var/lib/microi-disk-guard')
RUNTIME = Path('/run/microi-disk-guard')
SOCKET = str(RUNTIME / 'control.sock')
IMAGE = re.compile(r'^sha256:[a-f0-9]{64}$')
NAME = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$')
DEFAULTS = dict(enabled=True, warningPercent=85, pausePercent=90, minimumFreeGiB=5,
                inodeWarningPercent=85, inodePausePercent=90, idleDays=7,
                rollbackVersions=2, cleanupHour=3, utcOffsetMinutes=480)
LIMITS = dict(warningPercent=(50, 95), pausePercent=(60, 98), minimumFreeGiB=(1, 1024),
              inodeWarningPercent=(50, 95), inodePausePercent=(60, 98), idleDays=(1, 365),
              rollbackVersions=(2, 20), cleanupHour=(0, 23), utcOffsetMinutes=(-720, 840))
RESERVE_HEADER = b'MICROI_DISK_GUARD_RESERVE_V1\n'


def reserve_space(root):
    """仅释放本服务预分配的应急文件，为满盘后的账本和删除回执保留写入余量。"""
    path = Path(root) / 'emergency.reserve'
    free = os.statvfs(root).f_bavail * os.statvfs(root).f_frsize
    if path.exists() or path.is_symlink():
        fd = os.open(str(path), os.O_RDONLY | os.O_NOFOLLOW)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_nlink != 1 or info.st_size != 16 * 1024**2 or os.read(fd, len(RESERVE_HEADER)) != RESERVE_HEADER:
                raise GuardError('应急空间文件归属异常，保留并停止维护。')
            if free < 8 * 1024**2:
                if path.lstat().st_ino != info.st_ino:
                    raise GuardError('应急空间文件已变化。')
                path.unlink()
        finally:
            os.close(fd)
        return
    if free < 256 * 1024**2:
        return
    try:
        fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    except FileExistsError:
        return
    try:
        os.write(fd, RESERVE_HEADER)
        if hasattr(os, 'posix_fallocate'):
            os.posix_fallocate(fd, 0, 16 * 1024**2)
        else:
            remaining = 16 * 1024**2 - len(RESERVE_HEADER)
            while remaining:
                size = min(65536, remaining)
                os.write(fd, b'\0' * size)
                remaining -= size
        os.fsync(fd)
    except BaseException:
        if path.exists() and path.lstat().st_ino == os.fstat(fd).st_ino:
            path.unlink()
        raise
    finally:
        os.close(fd)


class GuardError(Exception):
    def __init__(self, message, status=409):
        super().__init__(message)
        self.status = status


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def repository(ref):
    """镜像仓库按真实引用解析；不把名称含 microi 或无标签当成归属证明。"""
    if not isinstance(ref, str) or len(ref) > 500 or not re.fullmatch(r'[a-zA-Z0-9./_:@-]+', ref):
        raise GuardError('镜像引用格式无效。', 400)
    if IMAGE.fullmatch(ref) or ref.startswith('<none>'):
        return None
    base = ref.split('@', 1)[0]
    if ':' in base.rsplit('/', 1)[-1]:
        base = base.rsplit(':', 1)[0]
    return base


def policy(body):
    if not isinstance(body, dict) or set(body) != set(DEFAULTS):
        raise GuardError('维护策略字段不完整或包含不受支持的动作。', 400)
    if type(body['enabled']) is not bool:
        raise GuardError('自动清理开关必须是布尔值。', 400)
    for key, (low, high) in LIMITS.items():
        if type(body[key]) is not int or not low <= body[key] <= high:
            raise GuardError('维护参数超出范围：' + key, 400)
    if body['pausePercent'] <= body['warningPercent'] or body['inodePausePercent'] <= body['inodeWarningPercent']:
        raise GuardError('暂停阈值必须高于预警阈值。', 400)
    return dict(body)


def private_dir(path, strict=True):
    path = Path(path)
    if not path.is_absolute():
        raise GuardError('维护目录必须是绝对路径。')
    for parent in [path, *path.parents]:
        if parent.is_symlink():
            raise GuardError('维护目录不能经过软链接。')
        if strict and parent.exists() and (parent.stat().st_uid != 0 or parent.stat().st_mode & 0o022):
            raise GuardError('维护目录及祖先必须由 root 控制。')
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if strict and (path.stat().st_uid != 0 or path.stat().st_mode & 0o077):
        raise GuardError('维护目录必须属于 root 且权限为 0700。')
    return path


class FileLock:
    """命令行安装/更新与守护进程共用同一宿主锁；忙时停止本次动作，不竞争删除。"""
    def __init__(self, path):
        self.path = Path(path)
        self.file = None

    def __enter__(self):
        import fcntl
        fd = os.open(str(self.path), os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        self.file = os.fdopen(fd, 'a+')
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_nlink != 1:
            self.file.close()
            raise GuardError('维护锁归属异常。')
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.file.close()
            raise GuardError('其它安装、更新或清理正在维护主机，请稍后重试。')
        return self

    def __exit__(self, *_):
        self.file.close()


class UnixHTTP(http.client.HTTPConnection):
    def __init__(self, path, timeout=8):
        super().__init__('localhost', timeout=timeout)
        self.path = path

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(self.path)


class Docker:
    def __init__(self, path='/var/run/docker.sock'):
        self.path, self.prefix = path, ''

    def call(self, method, path, missing=False):
        connection = UnixHTTP(self.path)
        try:
            connection.request(method, self.prefix + path)
            response = connection.getresponse()
            raw = response.read(8 * 1024 * 1024 + 1)
            if missing and response.status == 404:
                return None
            if len(raw) > 8 * 1024 * 1024:
                raise GuardError('Docker 清单超过安全预算，请先缩小主机资源范围。', 503)
            if not 200 <= response.status < 300:
                # Docker 错误正文可能含其它应用的信息，只暴露状态，不持久化环境或命令。
                raise GuardError('Docker 未确认操作，HTTP ' + str(response.status), 409 if response.status == 409 else 503)
            return json.loads(raw) if raw else None
        finally:
            connection.close()

    def info(self):
        if not self.prefix:
            version = self.call('GET', '/version')
            selected = min(tuple(map(int, version['ApiVersion'].split('.'))), (1, 53))
            if version.get('Os') != 'linux' or selected < (1, 41):
                raise GuardError('宿主维护需要 Linux Docker Engine API 1.41+。', 503)
            self.prefix = '/v' + '.'.join(map(str, selected))
        return self.call('GET', '/info')

    def image(self, ref):
        return self.call('GET', '/images/' + quote(ref, safe='') + '/json', missing=True)

    def container(self, name):
        return self.call('GET', '/containers/' + quote(name, safe='') + '/json', missing=True)

    def images(self):
        return self.call('GET', '/images/json?all=1')

    def containers(self):
        return self.call('GET', '/containers/json?all=1')

    def volumes(self):
        return sorted(x['Name'] for x in self.call('GET', '/volumes').get('Volumes') or [])

    def remove_image(self, image, engine_id, tags, digests):
        if not IMAGE.fullmatch(image):
            raise GuardError('只能删除完整镜像 ID。', 400)
        # 同一个 Unix 连接完成身份/引用复核与删除。Docker 重启断开连接时不自动换引擎重试。
        connection = UnixHTTP(self.path)
        connection.connect()
        original_socket = connection.sock
        def request(method, path, missing=False):
            if connection.sock is not original_socket:
                raise GuardError('Docker 控制连接已变化，删除结果需要重新核对。', 503)
            connection.request(method, self.prefix + path)
            response = connection.getresponse()
            raw = response.read(8 * 1024 * 1024 + 1)
            if missing and response.status == 404:
                return None
            if len(raw) > 8 * 1024 * 1024 or not 200 <= response.status < 300:
                raise GuardError('Docker 未确认精确镜像删除，HTTP ' + str(response.status), 409)
            return json.loads(raw) if raw else None
        try:
            if request('GET', '/info').get('ID') != engine_id:
                raise GuardError('Docker 引擎在删除前发生变化。')
            if any(x['ImageID'] == image for x in request('GET', '/containers/json?all=1')):
                raise GuardError('镜像新增容器引用，已跳过。')
            actual = request('GET', '/images/' + image + '/json')
            if actual.get('Id') != image or sorted(actual.get('RepoTags') or []) != tags or sorted(actual.get('RepoDigests') or []) != digests:
                raise GuardError('镜像身份或标签在删除前发生变化。')
            request('DELETE', '/images/' + image + '?force=0&noprune=1')
            if request('GET', '/images/' + image + '/json', missing=True) is not None:
                raise GuardError('Docker 未确认镜像消失。', 503)
        finally:
            connection.close()


def host_readonly(path, mountinfo=None):
    # systemd ProtectSystem=strict 在本服务命名空间生成只读挂载；它不表示宿主文件系统只读。
    # PID 1 的 mountinfo 是宿主实际挂载事实，读取它不进入宿主命名空间、不放宽服务写权限。
    raw = Path('/proc/1/mountinfo').read_text() if mountinfo is None else mountinfo
    target = os.path.realpath(path)
    matches = []
    for line in raw.splitlines():
        fields = line.split()
        if len(fields) < 10 or '-' not in fields:
            continue
        split = fields.index('-')
        if split + 3 >= len(fields):
            continue
        mount = re.sub(r'\\(040|011|012|134)', lambda match: chr(int(match[1], 8)), fields[4])
        if target == mount or target.startswith(mount.rstrip('/') + '/'):
            readonly = 'ro' in fields[5].split(',') or 'ro' in fields[split + 3].split(',')
            matches.append((len(mount), readonly))
    if not matches:
        raise GuardError('无法核对宿主实际挂载状态。', 503)
    return max(matches)[1]


def disk(path):
    # 控制 socket/FIFO/设备节点不存放业务数据，所在 /run tmpfs 不能套用数据盘余量。
    # 普通文件（如独立绑定的数据文件）和目录仍检测；stat 失败继续按不可确认存储关闭更新。
    mode = os.stat(path).st_mode
    if not stat.S_ISDIR(mode) and not stat.S_ISREG(mode):
        return None
    value = os.statvfs(path)
    total, free = value.f_blocks * value.f_frsize, value.f_bavail * value.f_frsize
    if total <= 0:
        raise GuardError('无法读取实际磁盘容量。', 503)
    return dict(path=path, totalBytes=total, availableBytes=free, usedPercent=100 * (total - free) / total,
                inodeUsedPercent=100 * (value.f_files - value.f_favail) / value.f_files if value.f_files else None,
                readOnly=host_readonly(path))


class Guard:
    def __init__(self, root=ROOT, docker=None, clock=time.time, disk_reader=disk, strict=True, recover=False):
        self.root = private_dir(root, strict)
        self.strict = strict
        if strict:
            reserve_space(self.root)
        self.docker = docker or Docker()
        self.clock, self.disk_reader = clock, disk_reader
        self.mutex = threading.RLock()
        self.error = ''
        self.started = self.clock()
        self.job = None
        self.queue = threading.Event()
        self.stop = threading.Event()
        self.dbpath = self.root / 'maintenance.sqlite3'
        if self.dbpath.is_symlink():
            raise GuardError('维护账本不能是软链接。')
        with self.db() as db:
            db.executescript('''
              CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, body TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, body TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, request TEXT UNIQUE NOT NULL, body TEXT NOT NULL);
            ''')
            self.set(db, 'policy', dict(DEFAULTS, revision=uuid.uuid4().hex), missing=True)
            self.set(db, 'registrations', {}, missing=True)
            self.set(db, 'leases', {}, missing=True)
            self.set(db, 'prepared', {}, missing=True)
            # 进程退出前未得到删除回读的任务结果未知；禁止重放旧预览直接删除。
            for row in list(db.execute('SELECT id,body FROM jobs')) if recover else []:
                item = json.loads(row[1])
                if item['state'] in ('Queued', 'Running'):
                    item.update(state='NeedsReview', error='宿主维护曾中断；请刷新预览后提交新任务。')
                    db.execute('UPDATE jobs SET body=? WHERE id=?', (json.dumps(item), row[0]))
        if os.name == 'posix':
            os.chmod(self.dbpath, 0o600)

    @contextlib.contextmanager
    def db(self):
        connection = sqlite3.connect(str(self.dbpath), timeout=5)
        try:
            connection.execute('PRAGMA busy_timeout=5000')
            connection.execute('PRAGMA synchronous=FULL')
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def get(db, key, default=None):
        row = db.execute('SELECT body FROM settings WHERE key=?', (key,)).fetchone()
        return json.loads(row[0]) if row else default

    @staticmethod
    def set(db, key, value, missing=False):
        sql = 'INSERT OR IGNORE' if missing else 'INSERT OR REPLACE'
        db.execute(sql + ' INTO settings(key,body) VALUES(?,?)', (key, json.dumps(value, allow_nan=False)))

    def engine(self):
        info = self.docker.info()
        if not isinstance(info.get('ID'), str) or not info['ID']:
            raise GuardError('无法确认 Docker Engine 身份。', 503)
        with self.db() as db:
            old = self.get(db, 'engine')
            if old and old != info['ID']:
                raise GuardError('Docker Engine 已变化，停止维护写入。')
            self.set(db, 'engine', info['ID'], missing=True)
        return info

    def enroll(self, name, role, expected_repository=''):
        if not NAME.fullmatch(name) or role not in ('api', 'web', 'data'):
            raise GuardError('只登记明确的应用或只读监测的数据服务。', 400)
        if expected_repository:
            expected_repository = repository(expected_repository)
            if not expected_repository:
                raise GuardError('登记需要可核对的仓库，不能只给镜像 ID。', 400)
        self.engine()
        current = self.docker.container(name)
        if not current or current.get('Name', '').lstrip('/') != name:
            raise GuardError('登记目标容器不存在。', 404)
        image = self.docker.image(current['Image'])
        raw_ref = current['Config']['Image']
        repo = None if re.fullmatch(r'[a-f0-9]{12,64}', raw_ref) else repository(raw_ref)
        if not repo and image:
            repos = {repository(x) for x in (image.get('RepoTags') or []) + (image.get('RepoDigests') or []) if not x.startswith('<none>')}
            repos.discard(None)
            if len(repos) == 1:
                repo = next(iter(repos))
            elif role == 'data' and not expected_repository:
                repo = 'data-only'
        if expected_repository and repo != expected_repository:
            raise GuardError('实际镜像仓库与部署清单不同，停止登记。')
        if not repo or not image or not IMAGE.fullmatch(image['Id']):
            raise GuardError('无法从实际容器确认镜像仓库。')
        labels = current['Config'].get('Labels') or {}
        spec = dict(name=name, role=role, repository='data-only' if role == 'data' else repo, composeProject=labels.get('com.docker.compose.project', ''),
                    initialImage=image['Id'], enrolledAt=self.clock(), history=[])
        with self.db() as db:
            registered = self.get(db, 'registrations')
            if name in registered:
                if any(registered[name][key] != spec[key] for key in ('name', 'role', 'repository', 'composeProject')):
                    raise GuardError('已有登记与本次目标不同，保留原清理范围。')
                return registered[name]
            if len(registered) >= 64:
                raise GuardError('登记服务超过主机维护预算。')
            registered[name] = spec
            self.set(db, 'registrations', registered)
        return spec

    def capacity(self, info, config, required=0):
        paths = {info['DockerRootDir'], str(self.root)}
        with self.db() as db:
            registered = self.get(db, 'registrations')
        for spec in registered.values():
            current = self.docker.container(spec['name'])
            for mount in (current or {}).get('Mounts') or []:
                if mount.get('Type') == 'bind' and mount.get('RW') is True and mount.get('Source', '').startswith('/'):
                    paths.add(mount['Source'])
        observations, warnings, blocked, healthy = [], [], [], True
        for path in sorted(paths):
            try:
                sample = self.disk_reader(path)
                if sample is None:
                    continue
                if sample['readOnly']:
                    blocked.append('文件系统只读：' + path)
                    healthy = False
                if sample['usedPercent'] >= config['warningPercent'] or sample['availableBytes'] < config['minimumFreeGiB'] * 1024**3:
                    warnings.append('磁盘空间预警：' + path)
                inode = sample['inodeUsedPercent']
                if inode is not None and inode >= config['inodeWarningPercent']:
                    warnings.append('inode 预警：' + path)
                additional = required if path == info['DockerRootDir'] else 0
                if sample['usedPercent'] >= config['pausePercent'] or sample['availableBytes'] < config['minimumFreeGiB'] * 1024**3 + additional:
                    blocked.append('本次操作空间预算不足：' + path)
                if inode is not None and inode >= config['inodePausePercent']:
                    blocked.append('inode 余量不足：' + path)
                observations.append(sample)
            except (OSError, GuardError):
                blocked.append('无法确认文件系统容量：' + path)
                healthy = False
        return dict(disks=observations, warnings=warnings, blockUpdates=bool(blocked), reasons=blocked,
                    storageHealthy=healthy, requiredAdditionalBytes=required, checkedAt=self.clock())

    def scan(self):
        info = self.engine()
        images, containers = self.docker.images(), self.docker.containers()
        if len(images) > 10000 or len(containers) > 5000:
            raise GuardError('主机清单超过维护预算，停止本次清理。', 503)
        by_id = {item['Id']: item for item in images}
        references = {item['ImageID'] for item in containers}
        now = self.clock()
        with self.db() as db:
            registered = self.get(db, 'registrations')
            config = self.get(db, 'policy')
            leases = self.get(db, 'leases')
            known = {key: json.loads(body) for key, body in db.execute('SELECT id,body FROM images')}
            protected = {item for lease in leases.values() for item in lease['images']}
            protected.update(x['imageId'] for x in self.get(db, 'prepared').values())
            repos = {spec['repository'] for spec in registered.values() if spec['role'] in ('api', 'web')}
            for name, spec in registered.items():
                if spec['role'] == 'data':
                    continue
                # 容器卸载后，原回滚清单仍然有效，不能因目标暂时缺失就回收其历史镜像。
                protected.update(x['id'] for x in spec['history'][:config['rollbackVersions'] + 1])
                protected.update([x['id'] for x in spec['history'] if x.get('verification') == 'verified'][:config['rollbackVersions'] + 1])
                if len(spec['history']) < config['rollbackVersions'] + 1:
                    protected.update(spec.get('baselineRollback', []))
                current = self.docker.container(name)
                if current is None:
                    protected.add(spec['initialImage'])
                    continue
                labels = current.get('Config', {}).get('Labels') or {}
                if labels.get('com.docker.compose.project', '') != spec['composeProject']:
                    raise GuardError('受管容器 Compose 归属变化：' + name)
                image_id = current['Image']
                if image_id not in by_id:
                    raise GuardError('容器镜像清单不完整，停止清理。')
                refs = [x for x in (by_id[image_id].get('RepoTags') or []) + (by_id[image_id].get('RepoDigests') or []) if not x.startswith('<none>')]
                if image_id != spec['initialImage'] and not any(repository(x) == spec['repository'] for x in refs):
                    raise GuardError('受管容器的实际镜像仓库无法确认：' + name)
                history = spec['history']
                if not history or history[0]['id'] != image_id:
                    prior = next((x for x in history if x['id'] == image_id), {})
                    history = [x for x in history if x['id'] != image_id]
                    history.insert(0, dict(id=image_id, observedAt=now, verification=prior.get('verification', 'observed')))
                    keep = history[:97] + [x for x in history[97:] if x.get('verification') == 'verified'][:3]
                    spec['history'] = keep[:100]
                if 'baselineRollback' not in spec:
                    # 首次接入不能把未曾观测切换的存量版本全删掉；保守保留两份历史候选，验证状态仍为未知。
                    historic = [x for x in images if x['Id'] != image_id and any(repository(ref) == spec['repository'] for ref in (x.get('RepoTags') or []) + (x.get('RepoDigests') or []) if not ref.startswith('<none>'))]
                    historic.sort(key=lambda x: (x.get('Created', 0), x['Id']), reverse=True)
                    spec['baselineRollback'] = [x['Id'] for x in historic[:config['rollbackVersions']]]
                if len(spec['history']) < config['rollbackVersions'] + 1:
                    protected.update(spec['baselineRollback'])
                protected.update(x['id'] for x in spec['history'][:config['rollbackVersions'] + 1])
                # 已验证的回滚版本独立保留；外部更新器观测到的镜像不冒充业务验收通过。
                protected.update([x['id'] for x in spec['history'] if x.get('verification') == 'verified'][:config['rollbackVersions'] + 1])
                known.setdefault(image_id, dict(id=image_id, firstSeen=now, unusedSince=None, repository=spec['repository']))
            self.set(db, 'registrations', registered)
            rows = []
            for image_id, item in by_id.items():
                if not IMAGE.fullmatch(image_id):
                    raise GuardError('Docker 返回了无效镜像 ID。', 503)
                tags = [x for x in item.get('RepoTags') or [] if not x.startswith('<none>')]
                digests = [x for x in item.get('RepoDigests') or [] if not x.startswith('<none>')]
                matches = [repository(x) for x in tags + digests]
                related = image_id in known or any(repo in repos for repo in matches)
                if not related:
                    continue
                record = known.get(image_id) or dict(id=image_id, firstSeen=now, unusedSince=None,
                                                      repository=next(x for x in matches if x in repos))
                used = image_id in references
                record['unusedSince'] = None if used else record['unusedSince'] if record['unusedSince'] is not None else now
                reason = '容器引用（含停止容器）' if used else '回滚或维护任务保护' if image_id in protected or any(x in protected for x in tags + digests) else ''
                if not reason and any(repo not in repos for repo in matches):
                    reason = '共享镜像仓库引用，保留'
                if not reason and len(tags) > 1:
                    reason = '多个标签，保留并待人工核对'
                if not reason and (record['unusedSince'] is None or now - record['unusedSince'] < config['idleDays'] * 86400):
                    reason = '连续闲置时间未达保留期'
                rows.append(dict(id=image_id, tags=sorted(tags), digests=sorted(digests), size=int(item.get('Size', 0)),
                                 unusedSince=record['unusedSince'], eligible=not reason, reason=reason or '满足安全回收条件'))
                db.execute('INSERT OR REPLACE INTO images(id,body) VALUES(?,?)', (image_id, json.dumps(record)))
            for stale in set(known) - set(by_id):
                db.execute('DELETE FROM images WHERE id=?', (stale,))
            if db.execute('SELECT COUNT(*) FROM images').fetchone()[0] > 10000:
                raise GuardError('镜像状态超过预算，停止清理。')
        rows.sort(key=lambda x: x['id'])
        result = dict(engineId=info['ID'], policy=config, images=rows, capacity=self.capacity(info, config),
                      registrations=list(registered.values()), leases=list(leases.values()), observedAt=now)
        result['fingerprint'] = digest(dict(engineId=info['ID'], revision=config['revision'], images=rows, protected=sorted(protected)))
        return result

    def save_policy(self, body):
        if set(body) != {'expectedRevision', 'policy'}:
            raise GuardError('策略请求字段无效。', 400)
        updated = policy(body['policy'])
        with self.db() as db:
            if body['expectedRevision'] != self.get(db, 'policy')['revision']:
                raise GuardError('维护策略已被其它管理员修改，请刷新。')
            updated['revision'] = uuid.uuid4().hex
            self.set(db, 'policy', updated)
        return updated

    def preflight(self, body):
        if set(body) != {'operationId', 'images', 'requiredBytes'} or not NAME.fullmatch(body['operationId']):
            raise GuardError('维护保护请求无效。', 400)
        if type(body['requiredBytes']) is not int or not 0 <= body['requiredBytes'] <= 10 * 1024**4:
            raise GuardError('操作空间预算无效。', 400)
        images = body['images']
        if not isinstance(images, list) or len(images) > 128 or any(not isinstance(x, str) or len(x) > 500 for x in images):
            raise GuardError('镜像保护清单无效。', 400)
        for image in images:
            repository(image)
        info = self.engine()
        with self.db() as db:
            config, leases = self.get(db, 'policy'), self.get(db, 'leases')
            if body['operationId'] not in leases and len(leases) >= 128:
                raise GuardError('待核对的维护保护任务过多，请先处理未结束任务。')
            prior = leases.get(body['operationId'])
            if prior and prior['images'] != sorted(set(images)):
                raise GuardError('同一维护任务不能替换原镜像保护清单。')
            leases[body['operationId']] = dict(id=body['operationId'], images=sorted(set(images)), createdAt=prior['createdAt'] if prior else self.clock())
            self.set(db, 'leases', leases)
        capacity = self.capacity(info, config, body['requiredBytes'])
        # 只在原保留规则内先尝试小批量回收；不临时缩短闲置期、不清卷、不扩大仓库范围。
        if config['enabled'] and (capacity['blockUpdates'] or capacity['warnings']) and self.job is None and capacity['storageHealthy']:
            snapshot = self.scan()
            if any(x['eligible'] for x in snapshot['images']):
                job = self.enqueue(dict(requestId='preflight-' + uuid.uuid4().hex, fingerprint=snapshot['fingerprint'], confirm='安全清理'), activate=False)
                job['mode'] = 'preflight'
                try:
                    self.clean(job, max_images=8)
                except Exception as error:
                    job.update(state='Failed', error=str(error) if isinstance(error, GuardError) else '预检清理未完成', finishedAt=self.clock())
                    self.save_job(job)
                    raise
                capacity = self.capacity(info, config, body['requiredBytes'])
        if capacity['blockUpdates']:
            raise GuardError('；'.join(capacity['reasons']))
        return dict(ready=True, operationId=body['operationId'], capacity=capacity)

    def complete(self, body):
        if set(body) != {'operationId', 'verifiedContainers'} or not NAME.fullmatch(body['operationId']):
            raise GuardError('维护完成请求无效。', 400)
        names = body['verifiedContainers']
        if not isinstance(names, list) or len(names) > 64 or any(not isinstance(x, str) or not NAME.fullmatch(x) for x in names):
            raise GuardError('就绪回读清单无效。', 400)
        with self.db() as db:
            registered = self.get(db, 'registrations')
            for name in names:
                spec = registered.get(name)
                current = self.docker.container(name)
                if not spec or not current or not current['State']['Running']:
                    raise GuardError('无法确认完成任务的受管容器。')
                image_id = current['Image']
                entry = next((x for x in spec['history'] if x['id'] == image_id), None)
                if not entry:
                    raise GuardError('需要先回读当前镜像历史再登记验证。')
                entry['verification'] = 'verified'
            self.set(db, 'registrations', registered)
            leases = self.get(db, 'leases')
            leases.pop(body['operationId'], None)
            self.set(db, 'leases', leases)
        return dict(completed=True)

    def prepared(self, body):
        if set(body) != {'operationId', 'images'} or not isinstance(body['images'], list) or len(body['images']) > 64 or not NAME.fullmatch(body['operationId']):
            raise GuardError('预拉取保护请求无效。', 400)
        with self.db() as db:
            registered, prepared = self.get(db, 'registrations'), self.get(db, 'prepared')
            for item in body['images']:
                if not isinstance(item, dict) or set(item) != {'name', 'imageId'} or not IMAGE.fullmatch(item['imageId']):
                    raise GuardError('预拉取镜像身份无效。', 400)
                spec = registered.get(item['name'])
                actual = self.docker.image(item['imageId'])
                if not spec or spec['role'] == 'data' or not actual or not any(repository(x) == spec['repository'] for x in (actual.get('RepoTags') or []) + (actual.get('RepoDigests') or []) if not x.startswith('<none>')):
                    raise GuardError('预拉取镜像不属于登记服务。')
                # 每个服务保留最新预拉取目标；旧目标仍服从闲置期与回滚保护，不无限累积永久 pin。
                prepared[item['name']] = dict(imageId=item['imageId'], preparedAt=self.clock())
            self.set(db, 'prepared', prepared)
            leases = self.get(db, 'leases')
            leases.pop(body['operationId'], None)
            self.set(db, 'leases', leases)
        return dict(completed=True)

    def enqueue(self, body, activate=True):
        if set(body) != {'requestId', 'fingerprint', 'confirm'} or not NAME.fullmatch(body['requestId']) or body['confirm'] != '安全清理':
            raise GuardError('请刷新预览并确认安全清理。', 400)
        with self.db() as db:
            previous = db.execute('SELECT body FROM jobs WHERE request=?', (body['requestId'],)).fetchone()
            if previous:
                saved = json.loads(previous[0])
                if saved['fingerprint'] != body['fingerprint']:
                    raise GuardError('相同请求号不能用于不同预览。')
                return saved
        snapshot = self.scan()
        if snapshot['fingerprint'] != body['fingerprint']:
            raise GuardError('主机状态或策略已变化，请重新预览。')
        job = dict(id=uuid.uuid4().hex, requestId=body['requestId'], fingerprint=body['fingerprint'],
                   state='Queued', createdAt=self.clock(), deleted=[], skipped=[], error='', mode='manual')
        if self.job is not None:
            raise GuardError('已有清理任务，请等待其结果。')
        with self.db() as db:
            db.execute('INSERT INTO jobs(id,request,body) VALUES(?,?,?)', (job['id'], body['requestId'], json.dumps(job)))
            db.execute('DELETE FROM jobs WHERE id IN (SELECT id FROM jobs ORDER BY rowid DESC LIMIT -1 OFFSET 200)')
        if activate:
            self.job = job
            self.queue.set()
        return job

    def save_job(self, job):
        with self.db() as db:
            db.execute('UPDATE jobs SET body=? WHERE id=?', (json.dumps(job, allow_nan=False), job['id']))

    def clean(self, job, max_images=64):
        """每个删除前重建候选；没有强制删除、卷删除、容器删除、全局 prune 或日志截断分支。"""
        before = self.scan()
        if not before['capacity']['storageHealthy']:
            raise GuardError('文件系统状态未通过核对，停止清理。', 503)
        if before['fingerprint'] != job['fingerprint']:
            raise GuardError('排队后主机状态已变化，本次任务未删除镜像，请重新预览。')
        candidates = [item for item in before['images'] if item['eligible']][:max_images]
        volumes = self.docker.volumes()
        job.update(state='Running', startedAt=self.clock(), beforeCapacity=before['capacity'])
        self.save_job(job)
        for item in candidates:
            if self.stop.is_set():
                raise GuardError('宿主维护服务正在停止；已删除部分的回执保留。')
            current = self.scan()
            fresh = next((x for x in current['images'] if x['id'] == item['id']), None)
            if not fresh or not fresh['eligible'] or fresh['tags'] != item['tags'] or fresh['digests'] != item['digests'] or current['policy']['revision'] != before['policy']['revision']:
                job['skipped'].append(dict(id=item['id'], reason='身份、引用、保护或策略变化'))
                continue
            try:
                job['inFlight'] = item['id']
                self.save_job(job)
                self.docker.remove_image(item['id'], current['engineId'], item['tags'], item['digests'])
                if self.docker.image(item['id']) is not None:
                    raise GuardError('删除后仍能读到镜像，结果未确认。', 503)
                job['deleted'].append(dict(id=item['id'], logicalBytes=item['size']))
            except GuardError as error:
                job['skipped'].append(dict(id=item['id'], reason=str(error)))
                if error.status >= 500:
                    job['uncertainResult'] = True
            job.pop('inFlight', None)
            self.save_job(job)
        after = self.scan()
        volume_after = self.docker.volumes()
        job.update(state='Succeeded', finishedAt=self.clock(), afterCapacity=after['capacity'],
                   volumeListUnchanged=volumes == volume_after, volumeDeletionAttempted=False,
                   remainingCandidates=sum(1 for x in after['images'] if x['eligible']),
                   pressureRemaining=after['capacity']['blockUpdates'])
        if volumes != volume_after:
            job.update(state='NeedsReview', error='期间数据卷清单发生外部变化，需独立核对。')
        if job.get('uncertainResult'):
            job.update(state='NeedsReview', error='部分镜像操作结果未确认，请核对本次回执后重新预览。')
        self.save_job(job)
        return job

    def status(self):
        with self.db() as db:
            config = self.get(db, 'policy')
            jobs = [json.loads(x[0]) for x in db.execute('SELECT body FROM jobs ORDER BY rowid DESC LIMIT 20')]
            registered = list(self.get(db, 'registrations').values())
            leases = list(self.get(db, 'leases').values())
            last = self.get(db, 'lastSnapshot')
        return dict(protocol=PROTOCOL, sourceHash=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), pid=os.getpid(),
                    policy=config, jobs=jobs, registrations=registered, leases=leases,
                    snapshot=last, error=self.error, observedAt=self.clock(), startedAt=self.started,
                    monitoringFresh=bool(last and self.clock() - last['observedAt'] < 960),
                    automaticCleanupEnabled=config['enabled'], volumesNeverDeleted=True)

    def dispatch(self, method, path, body):
        if method == 'GET' and path == '/status':
            return self.status()
        with self.mutex, FileLock(self.root / 'mutation.lock'):
            if method == 'GET' and path == '/preview':
                result = self.scan()
                with self.db() as db:
                    self.set(db, 'lastSnapshot', result)
                return result
            if method == 'PUT' and path == '/policy':
                return self.save_policy(body)
            if method == 'POST' and path == '/run':
                return self.enqueue(body)
            if method == 'POST' and path == '/preflight':
                return self.preflight(body)
            if method == 'POST' and path == '/complete':
                self.scan()
                return self.complete(body)
            if method == 'POST' and path == '/prepared':
                return self.prepared(body)
            if method == 'POST' and path == '/enroll' and set(body) in ({'name', 'role'}, {'name', 'role', 'expectedRepository'}):
                result = self.enroll(body['name'], body['role'], body.get('expectedRepository', ''))
                self.scan()
                return result
        raise GuardError('不支持的固定维护动作。', 404)

    def tick(self):
        with self.mutex, FileLock(self.root / 'mutation.lock'):
            if self.strict:
                reserve_space(self.root)
            snapshot = self.scan()
            with self.db() as db:
                self.set(db, 'lastSnapshot', snapshot)
                config = snapshot['policy']
                local = dt.datetime.fromtimestamp(self.clock(), dt.timezone(dt.timedelta(minutes=config['utcOffsetMinutes'])))
                day = local.date().isoformat()
                due = config['enabled'] and (snapshot['capacity']['warnings'] or local.hour == config['cleanupHour'] and self.get(db, 'lastCleanupDay') != day)
            if due and self.job is None:
                body = dict(requestId='auto-' + uuid.uuid4().hex, fingerprint=snapshot['fingerprint'], confirm='安全清理')
                job = self.enqueue(body)
                job['mode'] = 'automatic'
                self.save_job(job)
                with self.db() as db:
                    self.set(db, 'lastCleanupDay', day)
        self.error = ''

    def work(self):
        next_scan = 0
        while not self.stop.is_set():
            try:
                if self.clock() >= next_scan:
                    self.tick()
                    next_scan = self.clock() + 900
                if self.job:
                    job = self.job
                    try:
                        with self.mutex, FileLock(self.root / 'mutation.lock'):
                            self.clean(job)
                    except Exception as error:
                        job.update(state='Failed', error=str(error) if isinstance(error, GuardError) else '维护未完成：' + type(error).__name__, finishedAt=self.clock())
                        self.save_job(job)
                    finally:
                        self.job = None
            except Exception as error:
                self.error = str(error) if isinstance(error, GuardError) else '维护监测失败：' + type(error).__name__
                next_scan = self.clock() + 60
            self.queue.wait(1)
            self.queue.clear()


class LinuxOnlyServer:
    def __init__(self, *_):
        raise GuardError('宿主控制服务仅支持 Linux Unix socket。', 503)


class Server(socketserver.ThreadingMixIn, getattr(socketserver, 'UnixStreamServer', LinuxOnlyServer)):
    daemon_threads = True
    request_queue_size = 8

    def __init__(self, path, guard):
        self.guard = guard
        self.slots = threading.BoundedSemaphore(8)
        super().__init__(path, Handler)

    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, address):
        try:
            request.settimeout(10)
            super().process_request_thread(request, address)
        finally:
            self.slots.release()


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = 'MicroiDiskGuard/1'

    def log_message(self, *_):
        pass

    def handle_request(self):
        code = 200
        try:
            _, uid, _ = struct.unpack('3i', self.connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
            if uid != 0:
                raise GuardError('仅允许本机 root 控制通道。', 403)
            if self.headers.get('Transfer-Encoding') or self.headers.get('Expect'):
                raise GuardError('不支持分块或 Expect 请求。', 400)
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 <= size <= 65536:
                raise GuardError('维护请求过大。', 413)
            raw = self.rfile.read(size) if size else b'{}'
            if size and len(raw) != size:
                raise GuardError('维护请求未完整接收。', 400)
            result = self.server.guard.dispatch(self.command, self.path, json.loads(raw))
        except GuardError as error:
            code, result = error.status, dict(error=str(error))
        except (ValueError, TypeError, KeyError):
            code, result = 400, dict(error='维护请求格式无效。')
        except Exception as error:
            code, result = 503, dict(error='宿主维护不可用：' + type(error).__name__)
        payload = json.dumps(result, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    do_GET = do_POST = do_PUT = handle_request


def control(method, path, body=None):
    connection = UnixHTTP(SOCKET, timeout=20)
    try:
        payload = json.dumps(body or {}).encode()
        connection.request(method, path, payload, {'Content-Type': 'application/json'})
        response = connection.getresponse()
        result = json.loads(response.read(8 * 1024 * 1024 + 1))
        if response.status != 200:
            raise GuardError(result.get('error', '维护请求失败。'), response.status)
        return result
    finally:
        connection.close()


def parse_args(argv=None):
    raw = list(sys.argv[1:] if argv is None else argv)
    command = []
    if '--' in raw:
        split = raw.index('--')
        raw, command = raw[:split], raw[split + 1:]
    parser = argparse.ArgumentParser(description='吾码宿主磁盘维护：默认安全清理，不删除任何卷或容器')
    parser.add_argument('action', choices=['serve', 'status', 'preview', 'run', 'enroll', 'preflight', 'complete', 'guarded'])
    parser.add_argument('--name', default='')
    parser.add_argument('--role', choices=['api', 'web', 'data'])
    parser.add_argument('--expected-repository', default='')
    parser.add_argument('--operation', default='')
    parser.add_argument('--fingerprint', default='')
    parser.add_argument('--request', default='')
    parser.add_argument('--confirm', default='')
    parser.add_argument('--images', default='[]')
    parser.add_argument('--required-bytes', type=int, default=2 * 1024**3)
    args = parser.parse_args(raw)
    if command and args.action != 'guarded':
        parser.error('只有本机 guarded 入口允许命令参数。')
    args.command = command
    return args


def main(argv=None):
    args = parse_args(argv)
    if sys.platform != 'linux' or os.geteuid() != 0 or sys.version_info < (3, 9):
        raise GuardError('维护服务需要 Linux root 与 Python 3.9+。', 503)
    os.umask(0o077)
    if args.action == 'serve':
        private_dir(RUNTIME)
        with FileLock(RUNTIME / 'daemon.lock'):
            if Path(SOCKET).exists():
                if not stat.S_ISSOCK(Path(SOCKET).lstat().st_mode):
                    raise GuardError('控制路径已被非 socket 对象占用。')
                Path(SOCKET).unlink()
            guard = Guard(recover=True)
            server = Server(SOCKET, guard)
            os.chmod(SOCKET, 0o600)
            worker = threading.Thread(target=guard.work, daemon=True)
            worker.start()
            def stop(*_):
                guard.stop.set()
                threading.Thread(target=server.shutdown, daemon=True).start()
            signal.signal(signal.SIGTERM, stop)
            signal.signal(signal.SIGINT, stop)
            try:
                server.serve_forever(poll_interval=.5)
            finally:
                guard.stop.set()
                worker.join(timeout=30)
                server.server_close()
                if Path(SOCKET).exists() and stat.S_ISSOCK(Path(SOCKET).lstat().st_mode):
                    Path(SOCKET).unlink()
        return 0
    if args.action in ('status', 'preview'):
        result = control('GET', '/' + args.action)
    elif args.action == 'run':
        result = control('POST', '/run', dict(requestId=args.request, fingerprint=args.fingerprint, confirm=args.confirm))
    elif args.action == 'enroll':
        result = control('POST', '/enroll', dict(name=args.name, role=args.role, expectedRepository=args.expected_repository))
    elif args.action == 'complete':
        result = control('POST', '/complete', dict(operationId=args.operation, verifiedContainers=[]))
    else:
        request = dict(operationId=args.operation, images=json.loads(args.images), requiredBytes=args.required_bytes)
        if args.action == 'guarded':
            command = args.command[1:] if args.command[:1] == ['--'] else args.command
            if not command:
                raise GuardError('命令行维护需要明确的本机命令；HTTP 不提供此功能。', 400)
            guard = Guard()
            with FileLock(ROOT / 'mutation.lock'):
                # 预拉取标签、原镜像 ID 以及旧容器一起保护；标签移动后仍保留原不可变身份。
                current = guard.scan()
                refs = set(request['images'])
                for spec in current['registrations']:
                    if spec['role'] in ('api', 'web'):
                        item = guard.docker.container(spec['name'])
                        if item:
                            refs.add(item['Image'])
                for ref in list(refs):
                    actual = guard.docker.image(ref)
                    if actual:
                        refs.add(actual['Id'])
                request['images'] = sorted(refs)
                guard.preflight(request)
                process = subprocess.Popen(command, start_new_session=True)
                try:
                    while process.poll() is None:
                        time.sleep(2)
                        if process.poll() is not None:
                            break
                        with guard.db() as db:
                            config = guard.get(db, 'policy')
                        capacity = guard.capacity(guard.engine(), config)
                        if capacity['blockUpdates']:
                            raise GuardError('下载/编排期间容量达到保护线，已停止本次客户端：' + '；'.join(capacity['reasons']))
                finally:
                    if process.poll() is None:
                        # 只停止本入口创建的客户端；不停止 Docker 服务或任何业务/数据库容器。
                        process.terminate()
                        try:
                            process.wait(timeout=20)
                        except subprocess.TimeoutExpired:
                            process.kill()
                            process.wait(timeout=5)
                if process.returncode == 0:
                    guard.complete(dict(operationId=args.operation, verifiedContainers=[]))
                return process.returncode
        result = control('POST', '/preflight', request)
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (GuardError, OSError, ValueError, sqlite3.Error) as error:
        print('Microi：' + (str(error) if isinstance(error, GuardError) else '宿主维护失败：' + type(error).__name__), file=sys.stderr)
        raise SystemExit(1)
MICROI_DISK_GUARD_DAEMON_SOURCE
  cat > "$stage/install.sh" <<'MICROI_DISK_GUARD_INSTALL_SOURCE'
#!/bin/bash
# 同一份宿主服务由平台/独立面板安装器调用；已有策略、镜像历史、保护和回执全部保留。
set -euo pipefail
if [ "$(id -u)" != 0 ]; then printf 'Microi：宿主磁盘维护安装需要 root。\n' >&2; exit 1; fi
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
python_path=''
while [ "$#" -gt 0 ]; do
  case "$1" in --python) [ "$#" -ge 2 ] || exit 2; python_path=$2; shift 2;; *) printf 'Microi：未知维护安装参数。\n' >&2; exit 2;; esac
done
for candidate in "$python_path" /opt/microi-disk-guard/python-3.11.18/python/bin/python3 /opt/microi-panel-runtime-3.11.18-20261026/python/bin/python3 "$(command -v python3 || true)"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ] && "$candidate" -E -s -B -c 'import sys,sqlite3,socket; assert sys.version_info >= (3,9)' >/dev/null 2>&1; then python_path=$candidate; break; fi
done
if [ -z "$python_path" ] || ! "$python_path" -E -s -B -c 'import sys; assert sys.version_info >= (3,9)' >/dev/null 2>&1; then
  printf 'Microi：磁盘维护需要 root 控制的 Python 3.9+，请用 --python 指定独立运行时；不替换系统或宝塔 Python。\n' >&2
  exit 1
fi
python_path=$("$python_path" -E -s -B -c 'import os,sys; print(os.path.realpath(sys.executable))')
"$python_path" -E -s -B - "$python_path" "$source_dir" <<'PY'
import ast,os,pathlib,stat,sys
for raw in sys.argv[1:]:
    path=pathlib.Path(raw)
    for part in [path,*path.parents]:
        info=part.lstat()
        if part.is_symlink() or info.st_uid!=0 or info.st_mode&0o022:raise SystemExit('Microi: maintenance installation source/runtime is not root-controlled')
root=pathlib.Path(sys.argv[2]);source=root/'daemon.py'
if source.is_symlink() or not source.is_file() or source.stat().st_size>256*1024:raise SystemExit('Microi: invalid maintenance source')
ast.parse(source.read_text(encoding='utf-8'))
PY
if [ "$(cat /proc/1/comm)" != systemd ]; then printf 'Microi：宿主维护需要 systemd，尚未修改服务。\n' >&2; exit 1; fi
systemd_version=$(systemctl --version | awk 'NR==1{print $2}')
if ! [[ "$systemd_version" =~ ^[0-9]+$ ]] || [ "$systemd_version" -lt 219 ]; then printf 'Microi：宿主维护需要 systemd 219+。\n' >&2; exit 1; fi
base=/opt/microi-disk-guard
state=/var/lib/microi-disk-guard
runtime=/run/microi-disk-guard
unit=/etc/systemd/system/microi-disk-guard.service
"$python_path" -E -s -B - "$base" "$state" "$runtime" <<'PY'
import pathlib,sys
for raw in sys.argv[1:]:
    p=pathlib.Path(raw)
    for part in [p,*p.parents]:
        if part.is_symlink() or part.exists() and (part.stat().st_uid!=0 or part.stat().st_mode&0o022):raise SystemExit('Microi: maintenance target is not root-controlled')
    if p.exists() and p.stat().st_mode&0o077:raise SystemExit('Microi: existing maintenance directory is not private')
PY
install -d -m 700 "$base" "$state" "$runtime" "$base/releases"
exec 9>"$runtime/install.lock"
flock -n 9 || { printf 'Microi：其它安装器正在维护磁盘服务。\n' >&2; exit 1; }
release_hash=$(sha256sum "$source_dir/daemon.py" | awk '{print $1}')
release="$base/releases/$release_hash"
stage=$(mktemp -d "$base/.install.XXXXXXXX")
trap 'case "$stage" in /opt/microi-disk-guard/.install.*) [ ! -L "$stage" ] && rm -r -- "$stage";; esac' EXIT
old_active=inactive; old_enabled=disabled; old_target=''; existed=0; activated=0; success=0
if [ -L "$unit" ]; then printf 'Microi：现有维护单元不能是符号链接。\n' >&2; exit 1; fi
if [ -e "$unit" ]; then
  [ -f "$base/installed.service" ] && [ ! -L "$base/installed.service" ] && cmp -s "$unit" "$base/installed.service" || { printf 'Microi：同名服务归属不明或已有自定义修改，停止覆盖。\n' >&2; exit 1; }
  [ "$(systemctl show microi-disk-guard.service -p DropInPaths)" = DropInPaths= ] || { printf 'Microi：维护服务存在自定义 drop-in，停止覆盖。\n' >&2; exit 1; }
  existed=1
  cp -- "$unit" "$stage/before.service"
  old_active=$(systemctl is-active microi-disk-guard.service || true)
  old_enabled=$(systemctl is-enabled microi-disk-guard.service || true)
fi
if [ -L "$base/current" ]; then old_target=$(readlink "$base/current"); elif [ -e "$base/current" ]; then printf 'Microi：维护 current 路径被其它文件占用。\n' >&2; exit 1; fi
if [ -n "$old_target" ]; then
  case "$old_target" in "$base"/releases/*) ;; *) printf 'Microi：原维护代码指向范围外，停止覆盖。\n' >&2; exit 1;; esac
  old_hash=${old_target##*/}
  [[ "$old_hash" =~ ^[a-f0-9]{64}$ ]] && [ ! -L "$old_target" ] && [ ! -L "$old_target/daemon.py" ] && [ "$(sha256sum "$old_target/daemon.py" | awk '{print $1}')" = "$old_hash" ] || { printf 'Microi：原维护发行身份不符。\n' >&2; exit 1; }
fi
finish(){
  local code=$?
  trap - EXIT
  if [ "$success" != 1 ] && [ "$activated" = 1 ]; then
    # 只有本次写入的单元仍逐字匹配时才能回退，保留管理员并发改动与全部运行态数据。
    if cmp -s "$unit" "$stage/new.service"; then
      systemctl stop microi-disk-guard.service || true
      if [ "$existed" = 1 ]; then install -m 644 "$stage/before.service" "$unit"; else systemctl disable microi-disk-guard.service >/dev/null 2>&1 || true; rm -- "$unit"; fi
      if [ -n "$old_target" ]; then ln -s "$old_target" "$stage/rollback-current"; mv -T -- "$stage/rollback-current" "$base/current"; fi
      systemctl daemon-reload
      if [ "$old_active" = active ]; then systemctl start microi-disk-guard.service || true; fi
      printf 'Microi：新维护服务未通过验收，已尝试恢复原单元；策略与数据保留。\n' >&2
    else printf 'Microi：服务单元已被外部修改，保留现场，不自动覆盖。\n' >&2; fi
  fi
  case "$stage" in "$base"/.install.*) [ ! -L "$stage" ] && rm -r -- "$stage";; esac
  exit "$code"
}
trap finish EXIT
if [ ! -e "$release" ]; then
  install -d -m 700 "$release"
  install -m 600 "$source_dir/daemon.py" "$release/daemon.py"
fi
[ ! -L "$release" ] && [ ! -L "$release/daemon.py" ] && [ "$(sha256sum "$release/daemon.py" | awk '{print $1}')" = "$release_hash" ] || { printf 'Microi：维护发行目录身份校验失败。\n' >&2; exit 1; }
isolation='ProtectSystem=strict
ReadWritePaths=/run /var/lib/microi-disk-guard
MemoryMax=128M
TasksMax=64'
if [ "$systemd_version" -lt 232 ]; then isolation='ReadOnlyDirectories=/
ReadWriteDirectories=/run /var/lib/microi-disk-guard
MemoryLimit=128M'; fi
cat > "$stage/new.service" <<EOF
[Unit]
Description=Microi independent host disk maintenance
After=docker.service
Wants=docker.service
[Service]
Type=simple
User=root
Group=root
UMask=0077
# Docker 自动重启可能先创建 bind-mount 目录为 0755；由 systemd 在启动服务前
# 设置自身运行目录。重启服务保留目录 inode，避免面板持有已被删除目录的挂载。
RuntimeDirectory=microi-disk-guard
RuntimeDirectoryMode=0700
RuntimeDirectoryPreserve=yes
ExecStart=$python_path -E -s -B $release/daemon.py serve
Restart=on-failure
RestartSec=10
TimeoutStopSec=45
NoNewPrivileges=true
# 在线安装器的数据默认位于 /home；需要 statvfs 读取这些实际挂载点。
# 只读暴露仍禁止宿主维护修改用户目录，写入范围仅保留上方运行态和自身账本。
ProtectHome=read-only
PrivateTmp=true
CapabilityBoundingSet=
RestrictAddressFamilies=AF_UNIX
$isolation
[Install]
WantedBy=multi-user.target
EOF
systemd-analyze verify "$stage/new.service" > "$stage/verify.log" 2>&1 || { cat "$stage/verify.log" >&2; exit 1; }
if grep -F "$stage/new.service:" "$stage/verify.log" | grep -Ei 'Unknown (lvalue|key)|Unknown assignment|Failed to parse|Ignoring.*(ReadWrite|ReadOnly|Protect|Memory|Capability)'; then printf 'Microi：systemd 忽略了关键维护限制，停止安装。\n' >&2; exit 1; fi
ln -s "$release" "$stage/new-current"
mv -T -- "$stage/new-current" "$base/current"
install -m 644 "$stage/new.service" "$unit"
activated=1
systemctl daemon-reload
if [ "$existed" = 0 ] || [ "$old_enabled" = enabled ]; then systemctl enable microi-disk-guard.service >/dev/null; fi
if [ "$existed" = 1 ] && [ "$old_active" != active ]; then
  printf '%s\n' "$python_path" > "$stage/python-path"
  install -m 600 "$stage/python-path" "$base/python-path"
  install -m 600 "$stage/new.service" "$base/installed.service"
  printf 'Microi：宿主维护代码已更新，保留原服务的停止状态。\n'
  success=1; exit 0
fi
systemctl restart microi-disk-guard.service
for attempt in $(seq 1 20); do
  if "$python_path" -E -s -B "$base/current/daemon.py" status > "$stage/status.json" 2>/dev/null \
    && "$python_path" -E -s -B - "$stage/status.json" "$release_hash" <<'PY'
import json,sys
x=json.load(open(sys.argv[1]));sys.exit(0 if x['protocol']==1 and x['sourceHash']==sys.argv[2] and x['monitoringFresh'] and not x['error'] and x['volumesNeverDeleted'] else 1)
PY
  then
    printf '%s\n' "$python_path" > "$stage/python-path"
    install -m 600 "$stage/python-path" "$base/python-path"
    install -m 600 "$stage/new.service" "$base/installed.service"
    success=1
    printf 'Microi：独立宿主磁盘维护已启动并完成真实监测回读；既有策略保留，新装默认开启安全清理。\n'
    exit 0
  fi
  sleep 1
done
printf 'Microi：宿主维护未通过实际监测验收。\n' >&2
exit 1
MICROI_DISK_GUARD_INSTALL_SOURCE
  chmod 600 "$stage/daemon.py" "$stage/install.sh"
  bash "$stage/install.sh" --python "$selected"
  "$selected" -E -s -B -c 'import os,sys; print(os.path.realpath(sys.executable))' > "$stage/python-path"
  install -m 600 "$stage/python-path" "$base/python-path"
)

microi_disk_guard_connect() {
  [ ! -L /opt/microi-disk-guard ] && [ "$(stat -c %u:%a /opt/microi-disk-guard 2>/dev/null)" = 0:700 ] || return 1
  [ -f /opt/microi-disk-guard/python-path ] && [ ! -L /opt/microi-disk-guard/python-path ] || return 1
  [ "$(stat -c %u:%a /opt/microi-disk-guard/python-path)" = 0:600 ] || return 1
  MICROI_DISK_GUARD_PYTHON=$(cat /opt/microi-disk-guard/python-path)
  [ -x "$MICROI_DISK_GUARD_PYTHON" ] || return 1
  case "$MICROI_DISK_GUARD_PYTHON" in /*) ;; *) return 1;; esac
  "$MICROI_DISK_GUARD_PYTHON" -E -s -B /opt/microi-disk-guard/current/daemon.py status >/dev/null
}

microi_disk_run() {
  # 只拦截拉取/创建路径；只读 config/version 等仍沿用原调用，维护命令不进入业务 API。
  local mutation=0 argument operation pins
  for argument in "$@"; do case "$argument" in pull|up) mutation=1;; esac; done
  if [ "$mutation" != 1 ]; then "$@"; return $?; fi
  if ! microi_disk_guard_connect; then
    microi_install_disk_guard && microi_disk_enroll_existing || { printf 'Microi：宿主磁盘维护未就绪，保持原服务并停止新增下载/编排。\n' >&2; return 1; }
  fi
  operation="install-$$-$(cat /proc/sys/kernel/random/uuid)"
  pins=$("$MICROI_DISK_GUARD_PYTHON" -E -s -B -c 'import json,sys;print(json.dumps([x for x in sys.argv[1:] if x]))' "${API_IMAGE:-}" "${CLIENT_IMAGE:-}") || return 1
  "$MICROI_DISK_GUARD_PYTHON" -E -s -B /opt/microi-disk-guard/current/daemon.py guarded \
    --operation "$operation" --images "$pins" --required-bytes "${MICROI_INSTALL_DISK_REQUIRED_BYTES:-2147483648}" -- "$@"
}

microi_disk_enroll_existing() {
  local name role expected count=0
  microi_disk_guard_connect || return 1
  for name in microi-install-api microi-install-client microi-install-database microi-install-redis microi-install-mongodb microi-install-minio microi-panel microi-ops; do
    if ! docker container inspect "$name" >/dev/null 2>&1; then continue; fi
    role=data; expected=''
    case "$name" in
      microi-install-api) role=api; expected="${API_IMAGE:-registry.cn-hangzhou.aliyuncs.com/microios/microi-api:latest}";;
      microi-install-client) role=web; expected="${CLIENT_IMAGE:-registry.cn-hangzhou.aliyuncs.com/microios/microi-client:latest}";;
    esac
    "$MICROI_DISK_GUARD_PYTHON" -E -s -B /opt/microi-disk-guard/current/daemon.py enroll --name "$name" --role "$role" --expected-repository "$expected" >/dev/null || return 1
    count=$((count+1))
  done
  printf 'Microi：本次按实际容器登记 %s 个维护对象；data 仅监测数据盘，数据库数据卷不参与清理。\n' "$count"
}
# MICROI_DISK_GUARD_GENERATED_END

panel_select_install_scope(){
  # 发行候选与最终验收绑定同一默认版本；没有隐式旧版豁免，也不在拉取失败后退回无防护镜像。
  if ((PANEL_IMAGE_EXPLICIT==0)); then
    [[ "$PANEL_IMAGE" == registry.cn-hangzhou.aliyuncs.com/microios/microi-panel:v2.0.2 ]] || fail '默认发行镜像身份不符，请使用--image明确选择并校验其它镜像'
    printf 'Microi.Panel：默认v2.0.2要求主机认证防护与磁盘维护协议1；首次安装默认累计3次失败封禁24小时。离线或自定义镜像请使用--image和--offline明确选择已校验的制品。\n' >&2
  fi
}
# 主机只允许一个安装/升级进程，锁覆盖盘点、下载、切换和恢复；退出后由内核释放，不删除共享锁文件。
panel_acquire_install_lock(){
  command -v flock >/dev/null 2>&1 || fail '缺少util-linux flock，不能安全串行安装或升级面板'
  local lock_file=/run/microi-panel-install.lock
  [[ ! -L "$lock_file" ]] || fail '安装锁不能是符号链接'
  exec {PANEL_INSTALL_LOCK_FD}>"$lock_file" || fail '无法打开面板安装锁'
  flock -n "$PANEL_INSTALL_LOCK_FD" || fail '另一个面板安装或升级正在执行，请等待其完成后重试'
}
# 一次 inspect 取得同一容器的身份与挂载；只读失败不是“容器不存在”，禁止据此覆盖未知现场。
panel_inspect_target(){
  local identity
  identity=$(docker inspect --format '{{.Id}}|{{.Image}}|{{index .Config.Labels "io.microi.panel.controller"}}|{{index .Config.Labels "io.microi.panel.installer-operation"}}|{{range .Mounts}}{{printf "%s=%s:%t;" .Destination .Source .RW}}{{end}}' microi-panel) || return 1
  IFS='|' read -r PANEL_CURRENT_ID PANEL_CURRENT_IMAGE PANEL_CURRENT_LABEL PANEL_CURRENT_OPERATION PANEL_CURRENT_MOUNTS <<< "$identity"
  # Docker返回挂载数组的顺序不构成身份，按完整挂载记录排序后比较，避免无变化重建被误拒绝。
  local -a mount_entries
  IFS=';' read -r -a mount_entries <<< "$PANEL_CURRENT_MOUNTS"
  PANEL_CURRENT_MOUNTS=$(printf '%s\n' "${mount_entries[@]}" | LC_ALL=C sort | paste -sd ';' -) || return 1
  PANEL_CURRENT_MOUNTS+=';'
  [[ "$PANEL_CURRENT_ID" =~ ^[a-f0-9]{64}$ && "$PANEL_CURRENT_IMAGE" =~ ^sha256:[a-f0-9]{64}$ && "$PANEL_CURRENT_LABEL" == true ]] || return 1
  [[ "$PANEL_CURRENT_MOUNTS" == *"/microi/ops/data=$PANEL_ROOT/data:true;"* ]] || return 1
}
panel_assert_target(){
  panel_inspect_target || fail '无法确认面板容器身份或原数据挂载，保留现场并停止操作'
  [[ "$PANEL_CURRENT_IMAGE" == "$1" ]] || fail '面板运行镜像与本次候选不一致，保留现场并停止操作'
  [[ -z "$2" || "$PANEL_CURRENT_ID" == "$2" ]] || fail '面板容器已被外部替换，保留现场并停止自动回退'
  [[ -z "$3" || "$PANEL_CURRENT_OPERATION" == "$3" ]] || fail '面板容器不属于本次安装操作，保留现场并停止自动回退'
  [[ -z "$4" || "$PANEL_CURRENT_MOUNTS" == "$4" ]] || fail '面板挂载已变化，保留现场并停止自动回退'
}
panel_file_receipt(){
  local path=$1 identity digest
  [[ ! -L "$path" ]] || return 1
  if [[ ! -e "$path" ]]; then printf missing; return 0; fi
  [[ -f "$path" ]] || return 1
  identity=$(stat -c '%d:%i:%f:%u:%g:%s:%Y' -- "$path") || return 1
  digest=$(sha256sum -- "$path") || return 1
  printf '%s:%s' "$identity" "${digest%% *}"
}
panel_capture_image_override(){
  local path="$PANEL_ROOT/docker-compose.image.yml" before after
  before=$(panel_file_receipt "$path") || fail '镜像override不是普通独立文件，保留并停止覆盖'
  if [[ "$before" != missing ]]; then
    [[ $(stat -c '%s' -- "$path") -le 8192 ]] || fail '镜像override超出安装器格式，保留自定义配置'
    local -a lines
    mapfile -t lines < "$path"
    # 只识别安装器写出的有限格式；其它字段、重复键、YAML引用或自定义挂载都不能静默丢弃。
    [[ ${#lines[@]} == 3 || ${#lines[@]} == 5 || ${#lines[@]} == 7 || ${#lines[@]} == 8 ]] || fail '镜像override含自定义内容，请先将自定义设置合并到docker-compose.yml；原文件未覆盖'
    [[ "${lines[0]}" == services: && "${lines[1]}" == '  microi-panel:' && "${lines[2]}" =~ ^'    image: '[a-z0-9][a-z0-9./:_@-]{1,220}$ ]] || fail '镜像override不属于安装器已知格式，保留并停止覆盖'
    if ((${#lines[@]}>=5)); then
      [[ "${lines[3]}" == '    labels:' && "${lines[4]}" =~ ^'      io.microi.panel.installer-operation: "'[a-zA-Z0-9_-]{1,128}'"'$ ]] || fail '镜像override包含自定义标签，保留并停止覆盖'
    fi
    if ((${#lines[@]}>=7)); then
      [[ "${lines[5]}" == '    volumes:' && "${lines[6]}" == '      - /run/microi-auth-guard:/run/microi-auth-guard:ro' ]] || fail '镜像override包含自定义挂载，保留并停止覆盖'
    fi
    if ((${#lines[@]}==8)); then
      [[ "${lines[7]}" == '      - /run/microi-disk-guard:/run/microi-disk-guard:ro' ]] || fail '磁盘维护挂载不属于安装器格式，停止覆盖'
    fi
  fi
  after=$(panel_file_receipt "$path") || fail '镜像override读取期间变化，停止覆盖'
  [[ "$before" == "$after" ]] || fail '镜像override读取期间变化，停止覆盖'
  PANEL_OVERRIDE_RECEIPT=$after
}
panel_assert_image_override(){
  local actual
  actual=$(panel_file_receipt "$PANEL_ROOT/docker-compose.image.yml") || fail '镜像override身份已变化，保留现场并停止覆盖'
  [[ -n "$PANEL_OVERRIDE_RECEIPT" && "$actual" == "$PANEL_OVERRIDE_RECEIPT" ]] || fail '镜像override已被外部修改，保留现场并停止覆盖'
}
panel_render_image_override(){
  # 镜像固定到不可变ID；操作标签使同镜像的外部重建也不会被误认成本轮候选。
  printf 'services:\n  microi-panel:\n    image: %s\n    labels:\n      io.microi.panel.installer-operation: "%s"\n' "$1" "$PANEL_OPERATION_ID"
  if ((PANEL_HAS_AUTH_GUARD)); then
    # socket目录只读绑定仍支持Unix协议连接，防止容器删除宿主socket；旧Compose按目标路径合并这个明确新增项。
    printf '    volumes:\n      - /run/microi-auth-guard:/run/microi-auth-guard:ro\n'
    if ((PANEL_HAS_DISK_GUARD)); then printf '      - /run/microi-disk-guard:/run/microi-disk-guard:ro\n'; fi
  fi
}
panel_write_image_override(){
  local pending="$PANEL_ROOT/.docker-compose.image.$PANEL_OPERATION_ID.pending"
  panel_assert_image_override
  [[ ! -e "$pending" && ! -L "$pending" ]] || fail '本轮镜像override暂存路径已存在，停止覆盖'
  (set -o noclobber; panel_render_image_override "$1" > "$pending") || fail '无法生成本轮镜像override'
  panel_assert_image_override
  mv -T -- "$pending" "$PANEL_ROOT/docker-compose.image.yml"
  PANEL_OVERRIDE_RECEIPT=$(panel_file_receipt "$PANEL_ROOT/docker-compose.image.yml") || fail '镜像override写入后无法回读'
}
panel_guard_feature(){
  local protocol
  protocol=$(docker image inspect --format '{{index .Config.Labels "io.microi.panel.authguard.protocol"}}' "$PANEL_IMAGE_ID") || fail '无法读取候选面板防护协议'
  case "$protocol" in
    1) PANEL_HAS_AUTH_GUARD=1;;
    ''|'<no value>')
      ((PANEL_LEGACY_PANEL_ONLY)) || fail '所选镜像缺少io.microi.panel.authguard.protocol=1；默认要求主机认证防护，已停止安装。只有明确接受旧版面板不含防护时才使用--legacy-panel-only'
      PANEL_HAS_AUTH_GUARD=0
      printf 'Microi.Panel：所选镜像仅旧版面板，不含SSH/数据库认证防护；不能视为SSH或数据库已受保护。\n' >&2;;
    *) fail '候选面板防护协议不受当前安装器支持，停止升级';;
  esac
}
panel_guard_upgrade_compatibility(){
  ((PANEL_UPGRADE && PANEL_HAS_AUTH_GUARD==0)) || return 0
  local previous_protocol
  [[ "$PANEL_PREVIOUS_IMAGE" =~ ^sha256:[a-f0-9]{64}$ ]] || fail '原面板镜像身份缺失，无法确认旧版兼容性，停止升级'
  previous_protocol=$(docker image inspect --format '{{index .Config.Labels "io.microi.panel.authguard.protocol"}}' "$PANEL_PREVIOUS_IMAGE") || fail '无法回读原镜像防护协议，停止降级'
  case "$previous_protocol" in
    ''|'<no value>') return 0;;
    *) fail '原面板已使用主机防护协议，禁止降级到无协议旧镜像；--legacy-panel-only不能绕过Redis隔离配置与账本兼容保护';;
  esac
}
panel_report_completion(){
  if ((PANEL_HAS_AUTH_GUARD)); then
    printf 'Microi.Panel：安装完成，宿主防护控制面已回读；各服务实际覆盖仍以安全防护状态为准。\n'
  else
    ((PANEL_LEGACY_PANEL_ONLY)) || fail '缺少默认主机防护回执，不能报告安装完成'
    printf 'Microi.Panel：安装完成：仅旧版面板，不含SSH/数据库认证防护。\n'
  fi
  printf '入口 %s\n账号 paneladmin；密码文件 %s/config/admin-password\n' "$PANEL_URL" "$PANEL_ROOT"
  printf '请在云安全组按需放行TCP %s。首次自签证书请核对安装输出的SHA-256指纹。\n' "$PANEL_PORT"
  printf '升级/重建时同时加载 docker-compose.yml 和 docker-compose.image.yml。\n'
}
panel_guard_cleanup(){
  # 导出容器从不启动，只按本轮Id和标签删除；无法核对时保留，绝不按名字强制清理。
  if [[ -n "$PANEL_GUARD_EXPORT_ID" ]]; then
    local owner
    owner=$(docker inspect --format '{{index .Config.Labels "io.microi.panel.installer-export"}}' "$PANEL_GUARD_EXPORT_ID" 2>/dev/null) || owner=''
    if [[ "$owner" == "$PANEL_OPERATION_ID" ]]; then docker rm "$PANEL_GUARD_EXPORT_ID" >/dev/null || true; fi
  fi
  if [[ -n "$PANEL_GUARD_STAGE" && "$PANEL_GUARD_STAGE" == "$PANEL_ROOT"/.authguard-stage.* && ! -L "$PANEL_GUARD_STAGE" ]]; then
    local file
    for file in manifest.json daemon.py store.py firewall.py collectors.py redis_proxy.py nginx_adapter.py run.sh microi-auth-guard.service README.md; do
      [[ ! -f "$PANEL_GUARD_STAGE/$file" || -L "$PANEL_GUARD_STAGE/$file" ]] || rm -- "$PANEL_GUARD_STAGE/$file"
    done
    rmdir -- "$PANEL_GUARD_STAGE" 2>/dev/null || printf 'Microi.Panel：防护暂存目录有待诊断内容，已保留 %s\n' "$PANEL_GUARD_STAGE" >&2
  fi
}
panel_guard_tree_receipt(){
  # 目录inode和整个文件树进入回执；移动到本轮备份目录不改变身份，替换/增删/改写任何文件都会拒绝恢复。
  python3 - "$1" <<'PANEL_GUARD_TREE'
import hashlib,json,os,pathlib,stat,sys
root=pathlib.Path(sys.argv[1]); required={'daemon.py','store.py','firewall.py','collectors.py','redis_proxy.py','run.sh','microi-auth-guard.service'}
if root.is_symlink() or not root.is_dir(): raise SystemExit('AuthGuard directory invalid')
manifest=root/'manifest.json'
if manifest.is_symlink() or not manifest.is_file() or manifest.stat().st_size>65536: raise SystemExit('AuthGuard manifest invalid')
data=json.loads(manifest.read_text(encoding='utf-8'))
if data.get('nginxProtocol') not in (None,1): raise SystemExit('Unsupported Nginx host protocol')
if data.get('nginxProtocol')==1: required.add('nginx_adapter.py')
if data.get('protocol')!=1 or data.get('entrypoint')!='daemon.py' or not required.issubset(set(data.get('files',[]))): raise SystemExit('AuthGuard manifest ownership mismatch')
for name in required:
    if (root/name).is_symlink() or not (root/name).is_file(): raise SystemExit('AuthGuard required file invalid')
rows=[]
for path in [root,*sorted(root.rglob('*'))]:
    item=path.lstat()
    if not (stat.S_ISREG(item.st_mode) or stat.S_ISDIR(item.st_mode)): raise SystemExit('AuthGuard contains unsupported link/type')
    if len(rows)>1000 or item.st_size>32*1024*1024: raise SystemExit('AuthGuard tree exceeds expected bounds')
    content=hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else ''
    rows.append([str(path.relative_to(root)),item.st_dev,item.st_ino,item.st_mode,item.st_uid,item.st_gid,item.st_size if content else 0,item.st_mtime_ns if content else 0,content])
print(hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest())
PANEL_GUARD_TREE
}
# 不依赖新版 systemctl --value；缺失属性和命令失败保持不同退出状态，不能把服务读取错误当作空值。
panel_systemd_property(){
  local output line value='' count=0
  # systemd 219 对未知 --property 返回 1；完整读取后解析才能区分缺少可选属性与真实读取失败。
  output=$(systemctl show "$1" --all --no-pager) || return 1
  while IFS= read -r line; do
    if [[ "$line" == "$2="* ]]; then
      count=$((count+1))
      value=${line#*=}
    fi
  done <<< "$output"
  ((count)) || return 2
  ((count==1)) || return 1
  printf '%s' "$value"
}
panel_guard_runtime_preflight(){
  [[ "$PANEL_GUARD_PYTHON" =~ ^/([a-zA-Z0-9._+-]+/)*[a-zA-Z0-9._+-]+$ ]] || fail '宿主防护Python必须是无空格、无控制字符的绝对可执行路径'
  command -v python3 >/dev/null 2>&1 || fail '缺少用于校验运行时归属的系统Python 3'
  # 只接受 root 控制的解释器及全部真实祖先；-I 隔离用户目录和 PYTHONPATH，避免安装入口加载用户可写模块。
  PANEL_GUARD_PYTHON=$(python3 -I - "$PANEL_GUARD_PYTHON" <<'PANEL_RUNTIME_TRUST'
import os,pathlib,stat,sys
path=pathlib.Path(sys.argv[1]).resolve(strict=True)
for item in [path,*path.parents]:
    info=item.stat()
    if info.st_uid!=0 or info.st_mode & 0o022: raise SystemExit('Python executable/ancestor is not exclusively controlled by root: '+str(item))
if not path.is_file() or not os.access(str(path),os.X_OK): raise SystemExit('Python executable is not a regular executable file')
print(str(path))
PANEL_RUNTIME_TRUST
  ) || fail '宿主防护Python路径归属或权限校验失败，尚未修改服务'
  "$PANEL_GUARD_PYTHON" -I -B -c 'import sys; sys.version_info >= (3,9) or sys.exit("宿主服务需要Python 3.9或更新版本；可用--guard-python选择独立运行时，不替换系统Python"); import ssl,sqlite3,asyncio; hasattr(asyncio,"to_thread") or sys.exit("运行时缺少asyncio.to_thread")' || fail '宿主防护Python或必要标准库不可用，尚未修改服务'
  command -v systemctl >/dev/null 2>&1 || fail '宿主防护需要systemd'
  command -v systemd-analyze >/dev/null 2>&1 || fail '宿主防护需要systemd-analyze校验实际服务配置'
  PANEL_GUARD_SYSTEMD_VERSION=$(systemctl --version | sed -n '1s/^systemd \([0-9][0-9]*\).*$/\1/p')
  [[ "$PANEL_GUARD_SYSTEMD_VERSION" =~ ^[0-9]+$ ]] && ((PANEL_GUARD_SYSTEMD_VERSION>=219)) || fail 'systemd版本无法确认或低于219，尚未修改服务'
}
panel_guard_render_unit(){
  # 老 systemd 不能识别 strict/ReadWritePaths；使用其真实支持的只读命名空间，绝不删除文件系统隔离来通过启动。
  "$PANEL_GUARD_PYTHON" -I - "$1" "$PANEL_GUARD_PYTHON" "$PANEL_GUARD_SYSTEMD_VERSION" <<'PANEL_RENDER_UNIT'
import pathlib,sys
root=pathlib.Path(sys.argv[1]);runtime=sys.argv[2];version=int(sys.argv[3])
unit=root/'microi-auth-guard.service';launcher=root/'run.sh'
text=unit.read_text(encoding='utf-8');shell=launcher.read_text(encoding='utf-8')
if text.count('/usr/bin/python3 -B ')!=2 or shell.count('exec /usr/bin/python3 -B ')!=1: raise SystemExit('Unexpected shipped AuthGuard entrypoints')
text=text.replace('/usr/bin/python3 -B ',runtime+' -E -s -B ')
shell=shell.replace('exec /usr/bin/python3 -B ','exec '+runtime+' -E -s -B ')
if version<235:
    text='\n'.join(line for line in text.splitlines() if not line.startswith(('RuntimeDirectoryPreserve=','StateDirectory=','StateDirectoryMode=')))+'\n'
if version<232:
    if text.count('ProtectSystem=strict\n')!=1 or text.count('ReadWritePaths=')!=1: raise SystemExit('Unexpected filesystem-isolation template')
    text=text.replace('ProtectSystem=strict\n','ProtectSystem=full\nReadOnlyDirectories=/\n')
    text=text.replace('ReadWritePaths=','ReadWriteDirectories=')
    text=text.replace('MemoryMax=256M\n','MemoryLimit=256M\n')
    text='\n'.join(line for line in text.splitlines() if not line.startswith('LockPersonality='))+'\n'
# 旧名称仍支持可选目录前缀，保持后装第三方面板后重启服务可重新取得原有固定白名单。
unit.write_text(text,encoding='utf-8');unit.chmod(0o600)
launcher.write_text(shell,encoding='utf-8');launcher.chmod(0o700)
PANEL_RENDER_UNIT
}
panel_guard_verify_unit(){
  local output scoped status=0
  output=$(systemd-analyze verify "$1/microi-auth-guard.service" 2>&1) || status=$?
  [[ -z "$output" ]] || printf '%s\n' "$output" >&2
  # verify 会顺带打印第三方已有单元的警告；只排除有明确其它单元身份的行，通用错误仍必须失败。
  scoped=$(awk '/^[^[:space:]]+\.service:[0-9]+:/ && $0 !~ /microi-auth-guard\.service:[0-9]+:/ {next} {print}' <<< "$output")
  ((status==0)) && ! grep -Eiq 'Unknown (lvalue|key|value)|Failed to parse|not executable|does not exist' <<< "$scoped" || fail '宿主服务定义在当前systemd上未通过完整解析，尚未替换原服务'
}

panel_guard_service_receipt(){
  local fragment dropins invocation enabled status pid started active second
  fragment=$(panel_systemd_property microi-auth-guard.service FragmentPath) || return 1
  dropins=$(panel_systemd_property microi-auth-guard.service DropInPaths) || return 1
  [[ "$fragment" == /etc/systemd/system/microi-auth-guard.service && -z "$dropins" ]] || return 1
  if invocation=$(panel_systemd_property microi-auth-guard.service InvocationID); then :
  else status=$?; ((status==2)) || return 1; invocation=''; fi
  if [[ -z "$invocation" ]]; then
    # systemd219没有InvocationID；用同一启动的PID和单调时钟标识，读取期间变化则拒绝覆盖。
    pid=$(panel_systemd_property microi-auth-guard.service MainPID) || return 1
    started=$(panel_systemd_property microi-auth-guard.service ExecMainStartTimestampMonotonic) || return 1
    active=$(panel_systemd_property microi-auth-guard.service ActiveState) || return 1
    [[ "$pid" =~ ^[0-9]+$ && "$started" =~ ^[0-9]+$ && "$active" =~ ^(active|inactive|failed)$ ]] || return 1
    [[ "$active" != active || ( "$pid" != 0 && "$started" != 0 ) ]] || return 1
    second=$(panel_systemd_property microi-auth-guard.service MainPID) || return 1
    [[ "$pid" == "$second" ]] || return 1
    second=$(panel_systemd_property microi-auth-guard.service ExecMainStartTimestampMonotonic) || return 1
    [[ "$started" == "$second" ]] || return 1
    second=$(panel_systemd_property microi-auth-guard.service ActiveState) || return 1
    [[ "$active" == "$second" ]] || return 1
    invocation="legacy:$pid:$started:$active"
  fi
  enabled=$(systemctl is-enabled microi-auth-guard.service) || [[ "$enabled" == disabled ]] || return 1
  [[ "$enabled" == enabled || "$enabled" == disabled ]] || return 1
  printf '%s|%s' "$invocation" "$enabled"
}
panel_guard_assert_rollback_files(){
  local target=/opt/microi-auth-guard backup="/opt/microi-auth-guard.before-$PANEL_OPERATION_ID" actual
  [[ -n "$PANEL_GUARD_PREVIOUS_TREE" && -n "$PANEL_GUARD_CANDIDATE_TREE" && -n "$PANEL_GUARD_CANDIDATE_UNIT" ]] || return 1
  [[ ! -L "$target/.installer-operation" && $(cat "$target/.installer-operation") == "$PANEL_OPERATION_ID" ]] || return 1
  actual=$(panel_guard_tree_receipt "$target") || return 1
  [[ "$actual" == "$PANEL_GUARD_CANDIDATE_TREE" ]] || return 1
  actual=$(panel_guard_tree_receipt "$backup") || return 1
  [[ "$actual" == "$PANEL_GUARD_PREVIOUS_TREE" ]] || return 1
  actual=$(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) || return 1
  [[ "$actual" == "$PANEL_GUARD_CANDIDATE_UNIT" ]] || return 1
  cmp -s "$target/microi-auth-guard.service" /etc/systemd/system/microi-auth-guard.service || return 1
}
panel_guard_wait_ready(){
  local attempt
  for ((attempt=0;attempt<15;attempt++)); do
    if "${PANEL_GUARD_PYTHON:-python3}" -E -s -B /opt/microi-auth-guard/daemon.py --verify-ready --socket /run/microi-auth-guard/control.sock; then return 0; fi
    sleep 1
  done
  return 1
}
panel_guard_rollback(){
  local target=/opt/microi-auth-guard backup="/opt/microi-auth-guard.before-$PANEL_OPERATION_ID" failed="/opt/microi-auth-guard.failed-$PANEL_OPERATION_ID" actual
  if ! panel_guard_assert_rollback_files; then printf 'Microi.Panel：没有完整原防护回执，或防护文件已被外部修改；保留现场，不自动回退。\n' >&2; return 1; fi
  actual=$(panel_guard_service_receipt) || return 1
  [[ -n "$PANEL_GUARD_CANDIDATE_SERVICE" && "$actual" == "$PANEL_GUARD_CANDIDATE_SERVICE" ]] || { printf 'Microi.Panel：防护运行实例或服务设置已变化，停止自动回退。\n' >&2; return 1; }
  [[ ! -e "$failed" && ! -L "$failed" ]] || return 1
  systemctl stop microi-auth-guard.service || return 1
  panel_guard_assert_rollback_files || return 1
  # 不覆盖目标目录；失败候选保留为本轮诊断材料。任何新出现的路径都会使后续身份核验失败并停止。
  mv -T -n -- "$target" "$failed" || return 1
  [[ ! -e "$target" && ! -L "$target" ]] || return 1
  actual=$(panel_guard_tree_receipt "$failed") || return 1
  [[ "$actual" == "$PANEL_GUARD_CANDIDATE_TREE" ]] || return 1
  mv -T -n -- "$backup" "$target" || return 1
  [[ ! -e "$backup" && ! -L "$backup" ]] || return 1
  actual=$(panel_guard_tree_receipt "$target") || return 1
  [[ "$actual" == "$PANEL_GUARD_PREVIOUS_TREE" ]] || return 1
  actual=$(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) || return 1
  [[ "$actual" == "$PANEL_GUARD_CANDIDATE_UNIT" ]] || return 1
  install -m 644 "$target/microi-auth-guard.service" /etc/systemd/system/microi-auth-guard.service || return 1
  cmp -s "$target/microi-auth-guard.service" /etc/systemd/system/microi-auth-guard.service || return 1
  systemctl daemon-reload || return 1
  if [[ "$PANEL_GUARD_PREVIOUS_ENABLED" == enabled ]]; then systemctl enable microi-auth-guard.service || return 1
  else systemctl disable microi-auth-guard.service || return 1; fi
  if [[ "$PANEL_GUARD_PREVIOUS_ACTIVE" == active ]]; then
    systemctl restart microi-auth-guard.service || return 1
    panel_guard_wait_ready || { printf 'Microi.Panel：原防护源码已恢复，但控制面回读仍未就绪，不能报告恢复成功。\n' >&2; return 1; }
    printf 'Microi.Panel：原宿主防护已恢复并通过控制面回读；失败候选保留于 %s。\n' "$failed" >&2
  else
    actual=$(systemctl is-active microi-auth-guard.service) || true
    [[ "$actual" == inactive || "$actual" == failed ]] || return 1
    printf 'Microi.Panel：原宿主防护文件与未运行状态已恢复；未宣称网络保护就绪，失败候选保留于 %s。\n' "$failed" >&2
  fi
}
panel_guard_abort(){
  panel_guard_rollback || printf 'Microi.Panel：自动恢复未取得完整回执，请保留防护候选、备份及日志，由主机控制台核对。\n' >&2
  fail "$1；本次安装仍记为失败，面板与业务数据保留"
}
panel_install_auth_guard(){
  ((PANEL_HAS_AUTH_GUARD)) || return 0
  panel_guard_runtime_preflight
  local target=/opt/microi-auth-guard backup="/opt/microi-auth-guard.before-$PANEL_OPERATION_ID" prepared="/opt/microi-auth-guard.candidate-$PANEL_OPERATION_ID" file
  for file in /opt /etc /var/lib /run "$target" /etc/microi-auth-guard /var/lib/microi-auth-guard /run/microi-auth-guard; do
    [[ ! -L "$file" ]] || fail "防护路径不能是符号链接：$file"
  done
  [[ ! -L /etc/systemd/system/microi-auth-guard.service ]] || fail '既有防护服务定义是符号链接，停止覆盖'
  if [[ -e /etc/systemd/system/microi-auth-guard.service ]]; then
    [[ -f "$target/microi-auth-guard.service" ]] && cmp -s "$target/microi-auth-guard.service" /etc/systemd/system/microi-auth-guard.service || fail '既有同名服务定义无法确认归属或有本地修改，保留并停止覆盖'
  fi
  if [[ -e "$target" ]]; then
    PANEL_GUARD_PREVIOUS_TREE=$(panel_guard_tree_receipt "$target") || fail '既有防护文件树或manifest无法确认，停止覆盖'
    PANEL_GUARD_PREVIOUS_UNIT=$(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) || fail '既有防护unit无法回读'
    [[ "$PANEL_GUARD_PREVIOUS_UNIT" != missing ]] || fail '既有防护unit缺失，停止覆盖'
    PANEL_GUARD_PREVIOUS_SERVICE=$(panel_guard_service_receipt) || fail '既有防护来自其他unit路径、drop-in或非标准启用状态，保留现场'
    PANEL_GUARD_PREVIOUS_ENABLED=${PANEL_GUARD_PREVIOUS_SERVICE##*|}
    PANEL_GUARD_PREVIOUS_ACTIVE=$(systemctl is-active microi-auth-guard.service) || true
    [[ "$PANEL_GUARD_PREVIOUS_ACTIVE" == active || "$PANEL_GUARD_PREVIOUS_ACTIVE" == inactive || "$PANEL_GUARD_PREVIOUS_ACTIVE" == failed ]] || fail '既有防护正在切换状态，稍后重试'
  else
    [[ $(panel_systemd_property microi-auth-guard.service LoadState) == not-found ]] || fail '同名防护服务已有非本安装器定义，停止覆盖'
  fi
  mkdir -p "$PANEL_ROOT"
  PANEL_GUARD_STAGE=$(mktemp -d "$PANEL_ROOT/.authguard-stage.XXXXXX") || fail '无法创建本轮防护暂存目录'
  PANEL_GUARD_EXPORT_ID=$(docker create --name "microi-panel-guard-export-$PANEL_OPERATION_ID" --label "io.microi.panel.installer-export=$PANEL_OPERATION_ID" --network none "$PANEL_IMAGE_ID") || fail '无法只读导出候选防护文件'
  docker cp "$PANEL_GUARD_EXPORT_ID:/app/AuthGuard/." "$PANEL_GUARD_STAGE" || fail '新候选声明防护能力但缺少完整产物，停止安装'
  # 镜像协议与实际文件同时成立，旧镜像和缺文件不能靠生成空白配置冒充已交付。
  "$PANEL_GUARD_PYTHON" -I - "$PANEL_GUARD_STAGE" <<'PANEL_GUARD_MANIFEST'
import json,pathlib,sys
root=pathlib.Path(sys.argv[1]); required={'daemon.py','store.py','firewall.py','collectors.py','redis_proxy.py','run.sh','microi-auth-guard.service'}
manifest=root/'manifest.json'
if manifest.is_symlink() or not manifest.is_file() or manifest.stat().st_size>65536: raise SystemExit('AuthGuard manifest missing or invalid')
data=json.loads(manifest.read_text(encoding='utf-8'))
if data.get('nginxProtocol') not in (None,1): raise SystemExit('Unsupported Nginx host protocol')
if data.get('nginxProtocol')==1: required.add('nginx_adapter.py')
if data.get('protocol')!=1 or data.get('entrypoint')!='daemon.py' or not required.issubset(set(data.get('files',[]))): raise SystemExit('AuthGuard manifest protocol/files mismatch')
for name in required:
    path=root/name
    if path.is_symlink() or not path.is_file(): raise SystemExit('AuthGuard required file missing: '+name)
    if name.endswith('.py'): compile(path.read_text(encoding='utf-8'), str(path), 'exec')
PANEL_GUARD_MANIFEST
  panel_guard_render_unit "$PANEL_GUARD_STAGE"
  panel_guard_verify_unit "$PANEL_GUARD_STAGE"
  "$PANEL_GUARD_PYTHON" -E -s -B "$PANEL_GUARD_STAGE/daemon.py" --check --config /etc/microi-auth-guard/config.json || fail '宿主防护前置检查失败，原面板与数据库保持原状'
  [[ ! -e "$prepared" && ! -L "$prepared" ]] || fail '本轮防护候选目录已存在，停止覆盖'
  mkdir -m 700 -- "$prepared"
  for file in manifest.json daemon.py store.py firewall.py collectors.py redis_proxy.py run.sh microi-auth-guard.service; do
    install -m 600 "$PANEL_GUARD_STAGE/$file" "$prepared/$file"
  done
  if [[ -f "$PANEL_GUARD_STAGE/nginx_adapter.py" && ! -L "$PANEL_GUARD_STAGE/nginx_adapter.py" ]]; then
    install -m 600 "$PANEL_GUARD_STAGE/nginx_adapter.py" "$prepared/nginx_adapter.py"
  fi
  chmod 700 "$prepared/run.sh"
  printf '%s\n' "$PANEL_OPERATION_ID" > "$prepared/.installer-operation"
  PANEL_GUARD_CANDIDATE_TREE=$(panel_guard_tree_receipt "$prepared") || fail '候选防护文件无法取得完整回执'
  if [[ -e "$target" ]]; then
    [[ -d "$target" && -f "$target/manifest.json" && ! -e "$backup" ]] || fail '既有防护目录无法确认归属，停止覆盖'
    [[ $(panel_guard_tree_receipt "$target") == "$PANEL_GUARD_PREVIOUS_TREE" && $(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) == "$PANEL_GUARD_PREVIOUS_UNIT" && $(panel_guard_service_receipt) == "$PANEL_GUARD_PREVIOUS_SERVICE" ]] || fail '防护导出期间原文件或服务已变化，停止覆盖'
    mv -T -n -- "$target" "$backup"
    [[ ! -e "$target" && ! -L "$target" && $(panel_guard_tree_receipt "$backup") == "$PANEL_GUARD_PREVIOUS_TREE" ]] || fail '原防护目录未能安全保留，停止安装'
  else
    [[ -z "$PANEL_GUARD_PREVIOUS_TREE" && $(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) == missing ]] || fail '防护准备期间原目录或服务定义已变化，停止覆盖'
  fi
  mv -T -n -- "$prepared" "$target"
  [[ ! -e "$prepared" && ! -L "$prepared" && $(panel_guard_tree_receipt "$target") == "$PANEL_GUARD_CANDIDATE_TREE" ]] || fail '防护候选目录切换身份不符，停止修改服务定义'
  install -d -m 700 /etc/microi-auth-guard /var/lib/microi-auth-guard /run/microi-auth-guard
  [[ $(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) == "${PANEL_GUARD_PREVIOUS_UNIT:-missing}" ]] || fail '防护unit在切换期间被外部修改，停止覆盖'
  install -m 644 "$target/microi-auth-guard.service" /etc/systemd/system/microi-auth-guard.service
  PANEL_GUARD_CANDIDATE_UNIT=$(panel_file_receipt /etc/systemd/system/microi-auth-guard.service) || fail '候选防护unit无法取得回执'
  # config与state从不覆盖；控制面就绪不等于每个既有数据库已接入，后者由状态回读明确报告。
  if ! systemctl daemon-reload || ! systemctl enable microi-auth-guard.service || ! systemctl restart microi-auth-guard.service; then
    PANEL_GUARD_CANDIDATE_SERVICE=$(panel_guard_service_receipt) || PANEL_GUARD_CANDIDATE_SERVICE=''
    panel_guard_abort '候选宿主防护启动失败'
  fi
  PANEL_GUARD_CANDIDATE_SERVICE=$(panel_guard_service_receipt) || panel_guard_abort '候选防护服务身份无法回读'
  panel_guard_wait_ready || panel_guard_abort '候选宿主防护未取得防火墙真实生效回执'
  printf 'Microi.Panel：宿主防护控制面已回读。上方状态中的待接入、待验证或迁移项仍未完全保护；原数据库不会自动重建。\n'
  [[ ! -d "$backup" ]] || printf 'Microi.Panel：先前防护源码已保留供恢复：%s\n' "$backup"
}
usage(){
  cat <<'HELP'
吾码服务器运维面板安装器 v2.0.2
  bash install-microi-panel.sh [选项]
  --host <域名或IPv4>   浏览器使用的地址，交互安装时询问
  --port <端口>         独立HTTPS端口，默认61890
  --bind <IPv4>         监听地址，默认0.0.0.0；内网代理可设127.0.0.1
  --root <目录>         独立目录，默认/microi/panel
  --image <镜像>        显式选择已校验镜像，默认要求主机防护协议1
  --guard-python <路径> 显式选择root控制的Python 3.9+，不替换系统Python
  --offline             只使用已经docker load导入的本地镜像
  --legacy-panel-only   仅首装或旧版升级旧版可用；仅旧版面板，不含SSH/数据库认证防护
  --install-docker      新主机缺少Docker时安装Docker Engine
  --upgrade             使用原账号、证书、配置和数据更新面板
  --check               只读检查参数、Docker、目录和端口，不安装
  --yes                 非交互执行；新安装必须同时明确--host
  --help                查看帮助
已有宝塔/1Panel无需停止。端口已占用时请改用独立端口；安装器不抢占端口。
默认镜像v2.0.2，必须具有主机认证防护协议1；首次安装默认累计3次失败封禁24小时。
离线安装须先导入镜像，并用--image和--offline明确选择；安装器核对宿主防护协议，不会自动退回旧版。
显式旧版镜像须加--legacy-panel-only；已安装主机防护协议的面板禁止降级到旧版。
HELP
}
while (($#)); do
  case "$1" in
    --host|--port|--bind|--root|--image|--guard-python)
      (($#>=2)) || fail "$1 缺少值"
      case "$1" in --guard-python) PANEL_GUARD_PYTHON=$2;; --host) PANEL_HOST=$2;; --port) PANEL_PORT=$2;; --bind) PANEL_BIND=$2;; --root) PANEL_ROOT=$2;; --image) PANEL_IMAGE=$2; PANEL_IMAGE_EXPLICIT=1;; esac
      shift 2;;
    --offline) PANEL_OFFLINE=1; shift;; --upgrade) PANEL_UPGRADE=1; shift;;
    --legacy-panel-only) PANEL_LEGACY_PANEL_ONLY=1; shift;;
    --check) PANEL_CHECK=1; shift;; --install-docker) PANEL_DOCKER_INSTALL=1; shift;;
    --yes) PANEL_YES=1; shift;; --help|-h) usage; exit 0;; *) fail "未知参数：$1";;
  esac
done
panel_select_install_scope
if ((EUID!=0 && PANEL_CHECK==0)); then
  command -v sudo >/dev/null 2>&1 || fail '需要root权限，当前系统没有sudo；请su -后重新运行本命令'
  exec sudo -- bash "$0" "${PANEL_ORIGINAL_ARGS[@]}"
fi
[[ "$PANEL_ROOT" =~ ^/([a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+$ ]] || fail '安装目录必须是由字母、数字、短横线和下划线组成的独立绝对目录'
[[ "$PANEL_PORT" =~ ^[0-9]{4,5}$ ]] && ((10#$PANEL_PORT>=1024 && 10#$PANEL_PORT<=65535)) || fail 'HTTPS端口须为1024–65535'
[[ "$PANEL_BIND" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail '监听地址必须为IPv4'
[[ "$PANEL_IMAGE" =~ ^[a-z0-9][a-z0-9./:_@-]+$ ]] || fail '镜像引用格式无效'
PANEL_PORT=$((10#$PANEL_PORT))
PANEL_PARENT=$PANEL_ROOT
while [[ "$PANEL_PARENT" != / ]]; do
  [[ ! -L "$PANEL_PARENT" ]] || fail "目录包含符号链接，停止写入：$PANEL_PARENT"
  PANEL_PARENT=$(dirname "$PANEL_PARENT")
done
if ((PANEL_CHECK==0)); then
  panel_acquire_install_lock
  PANEL_OPERATION_ID=$(cat /proc/sys/kernel/random/uuid) || fail '无法生成本次面板安装操作标识'
  [[ "$PANEL_OPERATION_ID" =~ ^[a-f0-9-]{36}$ ]] || fail '本次面板安装操作标识无效'
  trap panel_guard_cleanup EXIT
fi
if ((PANEL_UPGRADE)); then
  [[ -r "$PANEL_ROOT/config/panel.env" ]] || fail '升级需要原安装目录中的config/panel.env'
  PANEL_URL=$(sed -n 's/^OPS_PUBLIC_URL=//p' "$PANEL_ROOT/config/panel.env")
  [[ "$PANEL_URL" =~ ^https://[a-zA-Z0-9.-]+:([0-9]{4,5})$ ]] || fail '原面板HTTPS地址不符合独立安装格式，请核对原配置'
  PANEL_PORT=${BASH_REMATCH[1]}
else
  if [[ -z "$PANEL_HOST" ]]; then
    if ((PANEL_YES || PANEL_CHECK)); then fail '请使用--host指定浏览器实际使用的域名或IPv4'; fi
    read -r -p '浏览器访问使用的域名或服务器IPv4：' PANEL_HOST
  fi
  [[ "$PANEL_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || fail '访问地址只填写域名或IPv4，不包含协议、路径和端口'
  PANEL_URL="https://${PANEL_HOST}:${PANEL_PORT}"
fi
printf 'Microi.Panel：目录 %s；HTTPS入口 %s；镜像 %s\n' "$PANEL_ROOT" "$PANEL_URL" "$PANEL_IMAGE"

download(){
  if command -v curl >/dev/null 2>&1; then curl --fail --location --retry 3 --connect-timeout 20 --max-time 180 "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget --timeout=30 --tries=3 -O "$2" "$1"
  else fail '缺少curl或wget，请先安装一个下载工具'; fi
}
install_docker_apt(){
  local distro=$1 codename=$2 existing_package repository key_fingerprint candidate_dir selected_repository=''
  [[ "$distro" == ubuntu || "$distro" == debian ]] && [[ "$codename" =~ ^[a-z]+$ ]] || fail 'Docker APT发行版或代号无效'
  # 不为安装面板卸载用户已有的容器运行时；如存在冲突，由管理员选择保留或迁移。
  for existing_package in docker.io docker-compose docker-compose-v2 podman-docker containerd runc; do
    if [[ $(dpkg-query -W -f='${Status}' "$existing_package" 2>/dev/null || true) == 'install ok installed' ]]; then
      fail "检测到已有容器运行时包 ${existing_package}，请先按Docker文档处理兼容性；未卸载或替换它"
    fi
  done
  DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o DPkg::Lock::Timeout=300 update
  DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o DPkg::Lock::Timeout=300 install -y --no-install-recommends ca-certificates curl gnupg
  candidate_dir=$(mktemp -d /tmp/microi-panel-docker-apt.XXXXXX)
  # 只用Docker签名的软件包；国内镜像只是传输回退，不能替换签名身份。
  for repository in "https://download.docker.com/linux/$distro" "https://mirrors.aliyun.com/docker-ce/linux/$distro"; do
    if curl --fail --silent --show-error --location --retry 2 --retry-all-errors --connect-timeout 8 --max-time 30 "$repository/gpg" -o "$candidate_dir/docker.asc" \
      && curl --fail --silent --show-error --location --retry 2 --retry-all-errors --connect-timeout 8 --max-time 30 "$repository/dists/$codename/InRelease" -o "$candidate_dir/InRelease"; then
      key_fingerprint=$(gpg --batch --show-keys --with-colons "$candidate_dir/docker.asc" 2>/dev/null | awk -F: '$1=="fpr" {print $10; exit}')
      [[ "$key_fingerprint" == 9DC858229FC7DD38854AE2D88D81803C0EBFCD88 ]] || fail 'Docker仓库签名公钥身份不符，停止安装'
      selected_repository=$repository
      break
    fi
  done
  [[ -n "$selected_repository" ]] || fail 'Docker官方及国内软件包仓库均不可达；未创建面板配置，请恢复网络后重试'
  printf 'Microi.Panel：Docker软件包仓库 %s；已核对Docker签名公钥。\n' "$selected_repository"
  install -m 0755 -d /etc/apt/keyrings
  install -m 0644 "$candidate_dir/docker.asc" /etc/apt/keyrings/microi-panel-docker.asc
  cat > "$candidate_dir/microi-panel-docker.sources" <<REPO
Types: deb
URIs: $selected_repository
Suites: $codename
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/microi-panel-docker.asc
REPO
  if [[ -e /etc/apt/sources.list.d/microi-panel-docker.sources ]]; then
    cmp -s "$candidate_dir/microi-panel-docker.sources" /etc/apt/sources.list.d/microi-panel-docker.sources || fail '已有不同的面板Docker仓库配置，请先核对；未覆盖它'
  else
    install -m 0644 "$candidate_dir/microi-panel-docker.sources" /etc/apt/sources.list.d/microi-panel-docker.sources
  fi
  DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o DPkg::Lock::Timeout=300 update
  DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o DPkg::Lock::Timeout=300 install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}
install_docker(){
  ((PANEL_OFFLINE==0)) || fail '离线模式要求先准备Docker Engine和Compose插件'
  [[ -r /etc/os-release ]] || fail '无法识别Linux发行版'
  # Docker安装属于主机运行时。仅在缺少Docker时执行，禁止更改已经工作的Docker守护进程配置。
  . /etc/os-release
  case "$ID" in
    ubuntu|debian)
      install_docker_apt "$ID" "${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
      ;;
    centos|rhel|fedora|raspbian)
      local script_dir
      script_dir=$(mktemp -d /tmp/microi-panel-docker.XXXXXX)
      download https://get.docker.com "$script_dir/install-docker.sh"
      sh "$script_dir/install-docker.sh"
      ;;
    alinux|anolis|rocky|almalinux)
      command -v dnf >/dev/null 2>&1 || fail '此发行版需要dnf，请按Docker官方文档先安装Docker'
      # 衍生发行版不能把自身releasever=3传入CentOS仓库；仓库文件限定EL兼容分支，不修改全局releasever。
      local el_major
      if [[ "$ID" == alinux || "$ID" == anolis ]]; then el_major=8; else el_major=${VERSION_ID%%.*}; fi
      [[ "$el_major" =~ ^(8|9|10)$ ]] || fail "未验证的EL兼容版本：$VERSION_ID"
      [[ ! -e /etc/yum.repos.d/microi-panel-docker.repo ]] || fail '已有面板Docker仓库文件，请核对后继续'
      cat > /etc/yum.repos.d/microi-panel-docker.repo <<REPO
[microi-panel-docker]
name=Docker CE stable for Microi.Panel
baseurl=https://download.docker.com/linux/centos/$el_major/\$basearch/stable
enabled=1
gpgcheck=1
gpgkey=https://download.docker.com/linux/centos/gpg
REPO
      dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      ;;
    *) fail "暂未提供此发行版的自动Docker安装：$ID；按Docker官方文档安装后可继续";;
  esac
  systemctl enable --now docker
}
if ! command -v docker >/dev/null 2>&1; then
  if ((PANEL_CHECK)); then fail 'Docker尚未安装；只读检查已结束'; fi
  if ((PANEL_DOCKER_INSTALL==0)); then
    ((PANEL_YES==0)) || fail '缺少Docker；非交互安装请明确传入--install-docker'
    read -r -p '此主机尚无Docker，是否安装Docker Engine？[y/N] ' panel_answer
    [[ "$panel_answer" == y || "$panel_answer" == Y ]] || fail '已停止；未安装Docker'
  fi
  ((EUID==0)) || fail '安装Docker需要root，请以root运行本命令'
  install_docker
fi
command -v timeout >/dev/null 2>&1 || fail '缺少coreutils timeout，请先安装系统基础工具'
timeout 15 docker info >/dev/null || fail '现有Docker不可用；请先核对docker服务，安装器不会重置或替换它'
docker compose version >/dev/null || fail '需要Docker Compose v2插件；不会替换现有Docker'
[[ $(docker info --format '{{.OSType}}') == linux ]] || fail '面板仅支持Linux Docker Engine'
PANEL_COMPOSE="$PANEL_ROOT/docker-compose.yml"
panel_capture_image_override
# 兼容Docker对同一key/不同key过滤的行为，单独盘点旧Ops与新Panel后去重。
PANEL_EXISTING_NEW=$(docker ps -aq --filter label=io.microi.panel.controller=true) || fail '无法读取既有Panel控制器清单，停止安装'
PANEL_EXISTING_OPS=$(docker ps -aq --filter label=io.microi.ops.controller=true) || fail '无法读取既有Ops控制器清单，停止安装'
PANEL_CONTROLLERS=$(printf '%s\n%s\n' "$PANEL_EXISTING_NEW" "$PANEL_EXISTING_OPS" | sed '/^$/d' | sort -u)
if ((PANEL_UPGRADE==0)); then
  [[ -z "$PANEL_CONTROLLERS" ]] || fail '本机已有吾码Ops/Panel（包含停止状态）；请使用原编排升级，避免两个控制器管理同一主机'
  [[ ! -e "$PANEL_COMPOSE" && ! -e "$PANEL_ROOT/config/panel.env" ]] || fail '已有配置，请使用--upgrade保留账号和数据升级'
  [[ -z $(docker ps -aq --filter 'name=^/microi-panel$') ]] || fail 'microi-panel容器名已存在，停止覆盖'
  if command -v ss >/dev/null 2>&1 && [[ -n $(ss -Hln "sport = :$PANEL_PORT" 2>/dev/null) ]]; then fail '选定端口已占用，请改用--port；已有服务保持不变'; fi
else
  [[ -f "$PANEL_COMPOSE" && -f "$PANEL_ROOT/config/panel.env" ]] || fail '升级需要既有独立Panel编排；旧Ops请按兼容迁移文档使用原Compose'
  [[ -f "$PANEL_ROOT/config/admin-password" && -f "$PANEL_ROOT/config/panel.pfx" ]] || fail '原凭据或证书文件缺失，停止升级'
  [[ $(docker inspect --format '{{index .Config.Labels "io.microi.panel.controller"}}' microi-panel) == true ]] || fail '同名容器不是吾码面板，停止升级'
  [[ $(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/microi/ops/data"}}{{.Source}}{{end}}{{end}}' microi-panel) == "$PANEL_ROOT/data" ]] || fail '原面板数据目录与--root不一致，停止升级'
  while read -r panel_controller; do
    [[ -z "$panel_controller" || $(docker inspect --format '{{.Name}}' "$panel_controller") == /microi-panel ]] || fail '存在另一个Ops/Panel控制器（包含停止状态），停止竞争更新'
  done <<< "$PANEL_CONTROLLERS"
  PANEL_URL=$(sed -n 's/^OPS_PUBLIC_URL=//p' "$PANEL_ROOT/config/panel.env")
  panel_inspect_target || fail '无法完整回读原面板身份与数据挂载，停止升级'
  PANEL_PREVIOUS_IMAGE=$PANEL_CURRENT_IMAGE
  PANEL_PREVIOUS_CONTAINER_ID=$PANEL_CURRENT_ID
  PANEL_EXPECTED_MOUNTS=$PANEL_CURRENT_MOUNTS
  PANEL_ORIGINAL_MOUNTS=$PANEL_CURRENT_MOUNTS
fi
if ((PANEL_CHECK)); then
  ((PANEL_LEGACY_PANEL_ONLY)) || panel_guard_runtime_preflight
  printf 'Microi.Panel：只读检查通过，未写入或启动服务。\n'; exit 0
fi
((EUID==0)) || fail '写入面板配置需要root，请以root运行'
if ((PANEL_LEGACY_PANEL_ONLY==0)); then
  panel_guard_runtime_preflight
  MICROI_INSTALL_DISK_GUARD_PYTHON=$PANEL_GUARD_PYTHON microi_install_disk_guard
  microi_disk_enroll_existing || fail '宿主磁盘维护未通过现有部署登记；原面板保持运行'
fi
if ((PANEL_OFFLINE)); then docker image inspect "$PANEL_IMAGE" >/dev/null || fail '本地缺少所选镜像'
elif ((PANEL_LEGACY_PANEL_ONLY)); then docker pull "$PANEL_IMAGE"
else microi_disk_run docker pull "$PANEL_IMAGE"; fi
# 拉取完成再生成配置或停止旧控制器；下载失败不改变既有入口。
PANEL_IMAGE_ID=$(docker image inspect --format '{{.Id}}' "$PANEL_IMAGE")
[[ $(docker image inspect --format '{{index .Config.Labels "io.microi.panel.controller"}}' "$PANEL_IMAGE_ID") == true ]] || fail '所选镜像未声明吾码面板身份'
[[ $(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' "$PANEL_IMAGE_ID") == 2.* ]] || fail '此安装器只接受2.x面板；跨主版本需要对应迁移方案'
panel_guard_feature
if [[ $(docker image inspect --format '{{index .Config.Labels "io.microi.panel.diskguard.protocol"}}' "$PANEL_IMAGE_ID") == 1 ]]; then
  PANEL_HAS_DISK_GUARD=1
elif ((PANEL_LEGACY_PANEL_ONLY==0)); then fail '候选缺少宿主磁盘维护协议1，停止切换原面板；请选择已校验的新候选'; fi
panel_guard_upgrade_compatibility
if ((PANEL_UPGRADE)); then panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_PREVIOUS_CONTAINER_ID" '' "$PANEL_ORIGINAL_MOUNTS"; fi
panel_assert_image_override
panel_install_auth_guard
if ((PANEL_UPGRADE==0)); then
  mkdir -p "$PANEL_ROOT"
  docker run --rm --name microi-panel-bootstrap --network none --memory 256m --cpus 1 \
    --security-opt no-new-privileges:true -v "$PANEL_ROOT:$PANEL_ROOT" \
    -e "PANEL_INSTALL_ROOT=$PANEL_ROOT" -e "PANEL_INSTALL_PORT=$PANEL_PORT" -e "PANEL_INSTALL_URL=$PANEL_URL" \
    -e "PANEL_INSTALL_BIND=$PANEL_BIND" -e "PANEL_INSTALL_IMAGE=$PANEL_IMAGE" "$PANEL_IMAGE_ID" --init-panel
else
  # 下载期间其它工具可能重建面板；重新核对原容器而不是仅比较可复用的镜像名称。
  panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_PREVIOUS_CONTAINER_ID" '' "$PANEL_EXPECTED_MOUNTS"
  # 升级先保留一份精确编排，使用独立override避免重写用户已有端口/挂载/环境。
  panel_assert_image_override
  cp -p -n "$PANEL_COMPOSE" "$PANEL_ROOT/docker-compose.before-panel-upgrade.$PANEL_OPERATION_ID.yml"
  if [[ -f "$PANEL_ROOT/docker-compose.image.yml" ]]; then cp -p -n "$PANEL_ROOT/docker-compose.image.yml" "$PANEL_ROOT/docker-compose.image.before-upgrade.$PANEL_OPERATION_ID.yml"; fi
fi
if ((PANEL_HAS_AUTH_GUARD && PANEL_UPGRADE)); then
  if [[ "$PANEL_EXPECTED_MOUNTS" == *'/run/microi-auth-guard='* ]]; then
    [[ "$PANEL_EXPECTED_MOUNTS" == *'/run/microi-auth-guard=/run/microi-auth-guard:false;'* ]] || fail '既有防护socket挂载不符合只读约定，停止改写'
  else
    PANEL_EXPECTED_MOUNTS+='/run/microi-auth-guard=/run/microi-auth-guard:false;'
    IFS=';' read -r -a panel_mount_entries <<< "$PANEL_EXPECTED_MOUNTS"
    PANEL_EXPECTED_MOUNTS=$(printf '%s\n' "${panel_mount_entries[@]}" | LC_ALL=C sort | paste -sd ';' -)';'
  fi
fi
if ((PANEL_HAS_DISK_GUARD && PANEL_UPGRADE)); then
  if [[ "$PANEL_EXPECTED_MOUNTS" == *'/run/microi-disk-guard='* ]]; then
    [[ "$PANEL_EXPECTED_MOUNTS" == *'/run/microi-disk-guard=/run/microi-disk-guard:false;'* ]] || fail '已有磁盘维护挂载不符合只读约定'
  else
    PANEL_EXPECTED_MOUNTS+='/run/microi-disk-guard=/run/microi-disk-guard:false;'
    IFS=';' read -r -a panel_mount_entries <<< "$PANEL_EXPECTED_MOUNTS"
    PANEL_EXPECTED_MOUNTS=$(printf '%s\n' "${panel_mount_entries[@]}" | LC_ALL=C sort | paste -sd ';' -)';'
  fi
fi
panel_write_image_override "$PANEL_IMAGE_ID"
docker compose -f "$PANEL_COMPOSE" -f "$PANEL_ROOT/docker-compose.image.yml" config --quiet
if ((PANEL_UPGRADE)); then
  panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_PREVIOUS_CONTAINER_ID" '' "$PANEL_ORIGINAL_MOUNTS"
else
  PANEL_NAMED_CONTAINER=$(docker ps -aq --no-trunc --filter 'name=^/microi-panel$') || fail '无法回读安装前容器状态，停止创建'
  [[ -z "$PANEL_NAMED_CONTAINER" ]] || fail '安装期间同名容器已出现，保留现场并停止创建'
fi
PANEL_STARTED=0
if docker compose -f "$PANEL_COMPOSE" -f "$PANEL_ROOT/docker-compose.image.yml" up -d --no-deps microi-panel; then PANEL_STARTED=1; fi
if ((PANEL_STARTED)); then
  panel_assert_target "$PANEL_IMAGE_ID" '' "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
  PANEL_CANDIDATE_CONTAINER_ID=$PANEL_CURRENT_ID
  if ((PANEL_HAS_AUTH_GUARD)); then [[ "$PANEL_CURRENT_MOUNTS" == *'/run/microi-auth-guard=/run/microi-auth-guard:false;'* ]] || fail '新候选缺少宿主防护socket只读挂载'; fi
fi
for ((panel_attempt=0;PANEL_STARTED && panel_attempt<60;panel_attempt++)); do
  panel_assert_target "$PANEL_IMAGE_ID" "$PANEL_CANDIDATE_CONTAINER_ID" "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
  if docker exec "$PANEL_CANDIDATE_CONTAINER_ID" dotnet Microi.Panel.dll --health-check >/dev/null 2>&1; then
    if ((PANEL_HAS_AUTH_GUARD)) && ! docker exec "$PANEL_CANDIDATE_CONTAINER_ID" dotnet Microi.Panel.dll --ready-check >/dev/null 2>&1; then sleep 2; continue; fi
    panel_assert_target "$PANEL_IMAGE_ID" "$PANEL_CANDIDATE_CONTAINER_ID" "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
    if ((PANEL_HAS_DISK_GUARD)); then
      [[ "$PANEL_CURRENT_MOUNTS" == *'/run/microi-disk-guard=/run/microi-disk-guard:false;'* ]] || fail '候选缺少磁盘维护只读挂载'
      microi_disk_enroll_existing || fail '面板已运行，但宿主磁盘监测登记未通过，不能报告交付完成'
    fi
    panel_report_completion
    exit 0
  fi
  sleep 2
done
if ((PANEL_UPGRADE)) && [[ -n "$PANEL_PREVIOUS_IMAGE" ]]; then
  # 只有明确查无同名容器、仍为原容器或仍为本轮候选时恢复；Docker不可达及同镜像外部替换都失败关闭。
  PANEL_NAMED_CONTAINER=$(docker ps -aq --no-trunc --filter 'name=^/microi-panel$') || fail '无法确认失败后的容器状态，停止自动回退'
  if [[ -n "$PANEL_NAMED_CONTAINER" ]]; then
    if [[ "$PANEL_NAMED_CONTAINER" == "$PANEL_PREVIOUS_CONTAINER_ID" ]]; then
      panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_PREVIOUS_CONTAINER_ID" '' "$PANEL_ORIGINAL_MOUNTS"
    else
      panel_assert_target "$PANEL_IMAGE_ID" "$PANEL_CANDIDATE_CONTAINER_ID" "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
    fi
  fi
  printf 'Microi.Panel：新面板健康检查失败，正在恢复此前镜像；业务插件保持当前状态。\n' >&2
  panel_write_image_override "$PANEL_PREVIOUS_IMAGE"
  docker compose -f "$PANEL_COMPOSE" -f "$PANEL_ROOT/docker-compose.image.yml" up -d --no-deps microi-panel
  panel_assert_target "$PANEL_PREVIOUS_IMAGE" '' "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
  PANEL_ROLLBACK_CONTAINER_ID=$PANEL_CURRENT_ID
  for ((panel_attempt=0;panel_attempt<30;panel_attempt++)); do
    panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_ROLLBACK_CONTAINER_ID" "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
    if docker exec "$PANEL_ROLLBACK_CONTAINER_ID" dotnet Microi.Panel.dll --health-check >/dev/null 2>&1; then
      panel_assert_target "$PANEL_PREVIOUS_IMAGE" "$PANEL_ROLLBACK_CONTAINER_ID" "$PANEL_OPERATION_ID" "$PANEL_EXPECTED_MOUNTS"
      fail '新版本未通过检查，已恢复原面板。请保留日志并核对候选版本'
    fi
    sleep 2
  done
fi
fail '面板尚未通过健康检查，配置和数据已保留。请查看docker logs microi-panel'
