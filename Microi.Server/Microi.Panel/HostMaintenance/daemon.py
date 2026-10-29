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
