#!/usr/bin/env python3
"""真实已安装 BaoTa/1Panel 网站验收；只在带精确 marker 的独占 Linux 实验 VM 运行。

运行：python3 -B panel-host-nginx.e2e.py --config <root600-json> --phase inventory
依次：inventory -> exercise -> prepare-vendor-edit -> verify-vendor-edit；随后
checkpoint-restart ->（操作者实际重启服务）-> verify-service-restart，再次 checkpoint-restart
->（操作者实际重启主机）-> verify-host-reboot。External ACME runner 负责真实申请/续期；
其回执经 verify-external-acme 关联 Panel 任务账本及实际 TLS，最后 cleanup 只移除本 runner 标签。

私有输入最小结构（不把真实凭据写入此源码）：
{
  "runId":"panel-lab-...", "work":"/var/lib/panel-acceptance/<runId>/host-nginx",
  "panelRoot":"/microi/panel", "panelContainer":"microi-panel",
  "candidate":{"imageId":"sha256:...","sourceHash":"64hex","hostAdapterSha256":"64hex"},
  "sites":[{"provider":"1Panel|BaoTa","instanceId":"实际发现ID","siteId":"实际站点ID",
    "domain":"真实原面板创建的.example.test域名","vendorRoot":"/opt/1panel|/www/server/panel",
    "http":{"address":"127.0.0.1","port":80,"path":"/","status":200,"bodySha256":"64hex"},
    "tls":{"address":"127.0.0.1","port":443,"caFile":"<work内公有CA证书>"}}]
}

网站正文必须包含 runId，且只读 vendor SQLite 中有同一网站记录。TLS 可在 SSL 阶段前
补充；配置文件、原始响应、配置备份和 checkpoint 保持 root600，不自动进入公开报告或 Git。
不安装供应商、不创建模拟 Nginx、不启动容器、不执行重启、不改 vendor 数据库。
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import http.client
import http.cookiejar
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import sqlite3
import ssl
import stat
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

PHASES = ('inventory', 'exercise', 'prepare-vendor-edit', 'verify-vendor-edit',
          'checkpoint-restart', 'verify-service-restart', 'verify-host-reboot',
          'verify-external-acme', 'cleanup')
SHA = re.compile(r'^[a-f0-9]{64}$')
MARKER = Path('/var/lib/panel-acceptance-id')


def sha(raw): return hashlib.sha256(raw).hexdigest()


def require(condition, message):
    if not condition: raise AssertionError(message)


def safe_path(path, private=False, directory=False):
    path = Path(path)
    require(path.is_absolute() and '..' not in path.parts, 'Only explicit absolute paths are accepted')
    for parent in [*reversed(path.parents), path]:
        item = parent.lstat()
        require(not stat.S_ISLNK(item.st_mode), 'Linked test path is not owned: ' + str(parent))
    info = path.stat()
    require(stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode), 'Unexpected path type: ' + str(path))
    if private:
        require(info.st_uid == 0 and info.st_mode & 0o077 == 0, 'Private input/evidence must be root-only: ' + str(path))
    return path


def command(*args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=40)
    require(result.returncode == 0, 'Fixed read-only command failed: ' + args[0] + ' (exit ' + str(result.returncode) + ')')
    require(len(result.stdout) < 8 * 1024 * 1024, 'Read-only command output exceeded budget')
    return result.stdout.decode().strip()


def read_json(path):
    path = safe_path(path, private=True)
    require(path.stat().st_size <= 4 * 1024 * 1024, 'Private JSON exceeds budget')
    return json.loads(path.read_text())


def atomic_json(path, value):
    pending = path.with_name('.' + path.name + '.' + uuid.uuid4().hex + '.pending')
    descriptor = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(descriptor, 'w') as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2); stream.flush(); os.fsync(stream.fileno())
        os.replace(pending, path)
    finally:
        if pending.exists(): pending.unlink()


class PanelClient:
    def __init__(self, root, record_raw):
        root = safe_path(root, directory=True)
        env = dict(line.split('=', 1) for line in safe_path(root / 'config/panel.env', private=True).read_text().splitlines() if '=' in line)
        self.origin = env['OPS_PUBLIC_URL'].rstrip('/')
        origin = urllib.parse.urlsplit(self.origin)
        require(origin.scheme == 'https' and origin.path in ('', '/') and not origin.username, 'Installed Panel requires an explicit HTTPS origin')
        public_certificate = command('openssl', 'pkcs12', '-in', str(root / 'config/panel.pfx'), '-passin',
                                     'file:' + str(safe_path(root / 'config/tls-password', private=True)), '-clcerts', '-nokeys')
        tls = ssl.create_default_context(cadata=public_certificate)
        self.client = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=tls),
                                                 urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf = ''; self.record_raw = record_raw
        self.csrf = self.call('/ops-api/session', record=False)['csrfToken']
        password = safe_path(root / 'config/admin-password', private=True).read_text().strip()
        self.call('/ops-api/login', {'account': env['OPS_ADMIN_USERNAME'], 'password': password}, record=False)
        self.csrf = self.call('/ops-api/session', record=False)['csrfToken']

    def call(self, path, data=None, expected=200, record=True):
        request = urllib.request.Request(self.origin + path, data=json.dumps(data).encode() if data is not None else None,
                                        headers={'Origin': self.origin, 'Content-Type': 'application/json', 'X-Ops-CSRF': self.csrf})
        try: response = self.client.open(request, timeout=150)
        except urllib.error.HTTPError as error: response = error
        raw = response.read(4 * 1024 * 1024 + 1)
        require(len(raw) <= 4 * 1024 * 1024, 'Panel response exceeds budget')
        body = json.loads(raw) if raw else {}
        if record: self.record_raw(path, response.status, body)
        require(response.status == expected, f'{path}: expected HTTP {expected}, observed {response.status}; private raw receipt retained')
        return body

    def host(self, suffix, data=None, expected=200):
        return self.call('/ops-api/panel/host-nginx/' + suffix, data, expected)


class ProbeTLS(http.client.HTTPSConnection):
    def __init__(self, address, port, domain, context):
        super().__init__(address, port, context=context, timeout=12); self.domain = domain
    def connect(self):
        self.sock = self._context.wrap_socket(socket.create_connection((self.host, self.port), self.timeout), server_hostname=self.domain)


def onepanel_exec_path(service, text):
    """只接受两个固定 systemd 服务声明的官方路径，不执行 ExecStart 文本。"""
    require(service in ('1panel-core', '1panel-agent'), 'Only fixed 1Panel services are accepted')
    require(isinstance(text, str) and len(text) <= 16384 and not any(ord(char) < 32 for char in text), 'Invalid ExecStart text')
    match = re.fullmatch(r'\{\s*path=([^\s;{}]+)\s*;\s*argv\[\]=([^;{}]+)\s*;[^{}]*\}', text.strip())
    require(match is not None, 'Exactly one unambiguous ExecStart is required')
    allowed = ('/usr/bin/' + service, '/usr/local/bin/' + service)
    require(match.group(1) in allowed and match.group(2).strip().split()[0] == match.group(1), 'ExecStart binary is outside the fixed same-name paths')
    return match.group(1)


def onepanel_binary(service):
    declared = Path(onepanel_exec_path(service, command('systemctl', 'show', '--property=ExecStart', '--value', '--no-pager', service)))
    allowed = (Path('/usr/bin') / service, Path('/usr/local/bin') / service)
    safe_path(declared.parent, directory=True)
    target = declared
    if stat.S_ISLNK(declared.lstat().st_mode):
        # 官方安装会把 /usr/bin 同名链接到 /usr/local/bin；只放行这一层精确白名单链接，其他路径仍严格拒绝。
        target = Path(os.readlink(declared))
        require(target.is_absolute() and target in allowed, '1Panel link must directly name its allowed matching binary')
    target = safe_path(target)
    require(target in allowed and declared.resolve() == target, 'Actual 1Panel binary differs from the fixed declaration')
    before = target.stat(); digest = hashlib.sha256()
    require(before.st_mode & 0o111, 'Actual 1Panel binary is not executable')
    with target.open('rb') as stream:
        header = stream.read(4); require(header == b'\x7fELF', 'Actual 1Panel binary is not ELF'); digest.update(header)
        for block in iter(lambda: stream.read(1024 * 1024), b''): digest.update(block)
    after = target.stat()
    require(declared.resolve() == target and (before.st_ino, before.st_size, before.st_mtime_ns) ==
            (after.st_ino, after.st_size, after.st_mtime_ns), '1Panel binary changed during readback')
    return {'service': service, 'execStartPath': str(declared), 'realPath': str(target), 'sha256': digest.hexdigest()}


class Runner:
    def __init__(self, config, phase, receipt=None):
        require(os.name == 'posix' and os.geteuid() == 0, 'Run only as root inside the owned Linux VM')
        self.config = config; self.phase_name = phase; self.receipt_path = receipt
        self.run = config['runId']
        require(re.fullmatch(r'[a-z][a-z0-9-]{5,80}', self.run), 'Invalid run ID')
        require(safe_path(MARKER, private=True).read_text().strip() == self.run, 'Exact VM lab marker mismatch')
        self.work = Path(config['work']); parent = Path('/var/lib/panel-acceptance') / self.run
        require(self.work.is_absolute() and '..' not in self.work.parts and self.work.parent == parent,
                'Evidence must be a direct child of the exact owned VM lab directory')
        safe_path(parent, private=True, directory=True)
        # 写入前核验所有祖先，不能先 mkdir 再发现跟随了他人可写目录或符号链接。
        for ancestor in [*reversed(parent.parents), parent]:
            info = ancestor.lstat()
            require(info.st_uid == 0 and info.st_mode & 0o022 == 0,
                    'Evidence ancestor must be root-owned and not writable by others: ' + str(ancestor))
        # 目录只能由本任务首次创建；已存在目录必须带相同的私有归属标记。
        if not self.work.exists():
            self.work.mkdir(mode=0o700)
            atomic_json(self.work / 'owner.json', {'runId': self.run, 'purpose': 'real-vendor-host-nginx-acceptance'})
        safe_path(self.work, private=True, directory=True)
        require(read_json(self.work / 'owner.json') == {'runId': self.run, 'purpose': 'real-vendor-host-nginx-acceptance'}, 'Evidence directory has different ownership')
        self.path = self.work / 'host-nginx-report.json'; self.state_path = self.work / 'host-nginx-private-state.json'
        self.state = read_json(self.state_path) if self.state_path.exists() else {'runId': self.run, 'sites': {}}
        self.report = read_json(self.path) if self.path.exists() else {'runId': self.run, 'scope': 'real vendor host management; external ACME is verified in its own phase', 'phases': {}}
        require(self.state['runId'] == self.run and self.report['runId'] == self.run, 'Checkpoint ownership changed')
        candidate = config['candidate']
        require(re.fullmatch(r'sha256:[a-f0-9]{64}', candidate['imageId']) and all(SHA.fullmatch(candidate[key]) for key in ('sourceHash', 'hostAdapterSha256')), 'Immutable candidate binding is required')
        require(self.report.get('candidate', candidate) == candidate, 'Candidate changed: start an independent evidence directory')
        self.report['candidate'] = candidate
        runner_hash = sha(Path(__file__).read_bytes())
        require(self.report.get('runnerSha256', runner_hash) == runner_hash, 'Runner changed: preserve prior evidence and start an independent directory')
        self.report['runnerSha256'] = runner_hash
        self.phase = {'completed': False, 'startedAt': time.time(), 'passed': [], 'failure': None}
        self.report['phases'].setdefault(phase, []).append(self.phase)
        self.count = 0; self.save()
        self.api = PanelClient(config.get('panelRoot', '/microi/panel'), self.raw)
        self.verify_candidate()
        require(isinstance(config['sites'], list) and 1 <= len(config['sites']) <= 2, 'Select one or two explicit vendor fixture sites')
        require(len({site['provider'] for site in config['sites']}) == len(config['sites']), 'Duplicate vendor fixture')

    def save(self):
        atomic_json(self.state_path, self.state); atomic_json(self.path, self.report)
    def passed(self, name, evidence=None):
        self.phase['passed'].append({'check': name, 'evidence': evidence or {}}); self.save(); print('PASS ' + name, flush=True)
    def raw(self, path, status, body):
        self.count += 1
        name = 'raw-' + self.phase_name + '-' + str(int(self.phase['startedAt'] * 1000)) + '-' + str(self.count) + '.json'
        atomic_json(self.work / name, {'path': path, 'status': status, 'body': body, 'observedAt': time.time()})
    def verify_candidate(self):
        name = self.config.get('panelContainer', 'microi-panel')
        require(re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}', name), 'Invalid Panel container name')
        item = json.loads(command('docker', 'inspect', name))[0]
        require(item['State']['Running'] and item['Image'] == self.config['candidate']['imageId'], 'Running Panel differs from selected immutable image')
        module = safe_path('/opt/microi-auth-guard/nginx_adapter.py')
        require(sha(module.read_bytes()) == self.config['candidate']['hostAdapterSha256'], 'Installed host adapter differs from source binding')
        require(command('systemctl', 'is-active', 'microi-auth-guard.service') == 'active', 'Real host systemd unit must be active')
        self.api.call('/ready')
        self.phase['runtime'] = {'panelContainerId': item['Id'], 'imageId': item['Image'], 'hostAdapterSha256': sha(module.read_bytes()),
                                 'bootId': Path('/proc/sys/kernel/random/boot_id').read_text().strip(),
                                 'bootStartedAt': time.time() - float(Path('/proc/uptime').read_text().split()[0])}
        self.save()

    def selected(self, site, require_attached=None):
        require(site['provider'] in ('BaoTa', '1Panel'), 'Only real vendor fixtures are accepted')
        require(re.fullmatch(r'[a-z0-9.-]+\.test', site['domain']), 'Use an explicit isolated .test fixture domain')
        instances = self.api.host('instances')
        require(instances['protocol'] == 1, 'Host Nginx protocol missing')
        matches = [item for item in instances['instances'] if item['id'] == site['instanceId']]
        require(len(matches) == 1, 'Explicit vendor instance not discovered')
        instance = matches[0]
        require(instance['provider'] == site['provider'], 'Discovered provider differs from real vendor fixture')
        if require_attached is not None: require(instance['attached'] is require_attached, 'Unexpected attachment state')
        rows = self.api.host('instances/' + urllib.parse.quote(site['instanceId'], safe='') + '/sites')['sites']
        require(sum(item['id'] == site['siteId'] and site['domain'] in item['domains'] for item in rows) == 1, 'Explicit vendor site missing from discovery')
        current = self.configuration(site)
        require(site['domain'] in current['domains'], 'Site domain changed')
        require(current['sha256'] == sha(current['content'].encode()), 'Configuration hash does not match real bytes')
        require(current['fingerprint'] == instance['fingerprint'], 'Discovery/configuration identity mismatch')
        return instance, current
    def configuration(self, site):
        return self.api.host('instances/' + urllib.parse.quote(site['instanceId'], safe='') + '/sites/' + urllib.parse.quote(site['siteId'], safe='') + '/configuration')
    def body(self, site, current, **extra):
        return {'instanceId': site['instanceId'], 'siteId': site['siteId'], 'expectedFingerprint': current['fingerprint'], 'expectedSha256': current['sha256'],
                'requestId': str(uuid.uuid4()), 'confirm': site['siteId'], **extra}
    def business(self, site, secure=False):
        target = site['tls'] if secure else site['http']; address = str(ipaddress.ip_address(target['address']))
        require(1 <= target['port'] <= 65535, 'Invalid fixture port')
        path = site['http'].get('path', '/')
        require(path.startswith('/') and not any(ord(char) < 32 for char in path), 'Invalid fixture HTTP path')
        if secure:
            ca = safe_path(target['caFile']); require(ca.is_relative_to(self.work.parent), 'CA must be an owned lab public certificate')
            connection = ProbeTLS(address, target['port'], site['domain'], ssl.create_default_context(cafile=str(ca)))
        else: connection = http.client.HTTPConnection(address, target['port'], timeout=12)
        try:
            connection.request('GET', path, headers={'Host': site['domain']})
            certificate = connection.sock.getpeercert(binary_form=True) if secure else None
            response = connection.getresponse()
            content = response.read(1024 * 1024 + 1)
            require(response.status == site['http'].get('status', 200), 'Real website response status changed')
            require(len(content) <= 1024 * 1024 and sha(content) == site['http']['bodySha256'], 'Real business HTTP bytes changed')
            require(self.run.encode() in content, 'Website is not the exact owned vendor fixture')
            return {'status': response.status, 'bodySha256': sha(content), 'certificateSha256': sha(certificate) if certificate else None,
                    'certificateSha1': hashlib.sha1(certificate).hexdigest().upper() if certificate else None}
        finally: connection.close()

    def vendor(self, site):
        root = safe_path(site['vendorRoot'], directory=True); executables = []
        if site['provider'] == 'BaoTa':
            require(root == Path('/www/server/panel'), 'BaoTa must use its actual fixed installation')
            paths = [root / 'BTPanel/__init__.py', root / 'class/panelSite.py', Path('/www/server/nginx/sbin/nginx')]
            require(command('systemctl', 'is-active', 'bt') == 'active', 'Actual BaoTa service is not active')
            mapping = root / 'config/databases.json'; databases = []
            if mapping.exists():
                data = json.loads(safe_path(mapping).read_text())
                for filename, tables in data.items():
                    if 'sites' in tables:
                        require(re.fullmatch(r'[a-zA-Z0-9_-]+\.db', filename), 'Invalid BaoTa database mapping')
                        databases.append(root / 'data/db' / filename)
            # 新版供应商映射是唯一事实源，不能把保留的旧库重复当作第二份活动登记。
            if not databases:
                databases = [path for path in (root / 'data/db/default.db', root / 'data/default.db') if path.exists()][:1]
            sql, parameter = 'SELECT id,name,path FROM sites WHERE name=?', site['domain']
        else:
            for service in ('1panel-core', '1panel-agent'): require(command('systemctl', 'is-active', service) == 'active', 'Actual 1Panel service is not active')
            executables = [onepanel_binary(service) for service in ('1panel-core', '1panel-agent')]
            paths = []
            databases = [root / 'db/agent.db']; sql, parameter = 'SELECT id,primary_domain,alias FROM websites WHERE primary_domain=?', site['domain']
        hashes = {str(path): sha(safe_path(path).read_bytes()) for path in paths}
        hashes.update({value['realPath']: value['sha256'] for value in executables})
        found = []
        for path in dict.fromkeys(databases):
            if not path.exists(): continue
            safe_path(path)
            try:
                with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=3) as db:
                    db.execute('PRAGMA query_only=ON'); rows = db.execute(sql, (parameter,)).fetchall()
                    found.extend((str(path), row) for row in rows)
            except sqlite3.OperationalError as error:
                if 'no such table' not in str(error): raise
        require(len(found) == 1, 'Exactly one genuine vendor website registration is required')
        return {'provider': site['provider'], 'binaryHashes': hashes, 'database': found[0][0], 'siteId': found[0][1][0], 'domain': found[0][1][1], **({'executables': executables} if executables else {})}

    def runtime(self, site, instance):
        if site['provider'] == 'BaoTa':
            pid = int(Path('/www/server/nginx/logs/nginx.pid').read_text())
            require(os.readlink(f'/proc/{pid}/exe') == '/www/server/nginx/sbin/nginx', 'Actual BaoTa Nginx process identity mismatch')
            return {'pid': pid, 'startedTicks': Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[19]}
        item = json.loads(command('docker', 'inspect', instance['containerId']))[0]
        require(item['State']['Running'], 'Real OpenResty container is not running')
        return {'containerId': item['Id'], 'pid': item['State']['Pid'], 'startedAt': item['State']['StartedAt'], 'image': item['Image']}

    def snapshot_registrations(self, site):
        rows = self.api.call('/ops-api/panel/acme')
        return [{key: row.get(key) for key in ('id', 'target', 'resourceId', 'instanceId', 'siteId', 'instanceFingerprint', 'autoRenew', 'domains', 'revision')}
                for row in rows if row.get('instanceId') == site['instanceId'] and row.get('siteId') == site['siteId']]

    def exercise(self, site, state):
        instance, original = self.selected(site)
        require(original['sha256'] == state['baseline']['sha256'], 'Exercise must start from the recorded vendor configuration')
        own_hashes = set(); rollback_failure = None
        try:
            if not state.get('attachedByRun'):
                require(instance['attached'] is False, 'First exercise must prove explicit attachment')
                self.api.host('configuration', self.body(site, original, content=original['content']), 409)
                self.api.host('attach', {'instanceId': site['instanceId'], 'expectedFingerprint': instance['fingerprint'], 'confirm': site['instanceId']})
                state['attachedByRun'] = True; self.save()
            self.selected(site, True); self.passed(site['provider'] + ': explicit attachment is required before writes')
            stale = self.body(site, original, content=original['content'] + '\n# stale test\n'); stale['expectedSha256'] = '0' * 64
            self.api.host('configuration', stale, 409); require(self.configuration(site)['sha256'] == original['sha256'], 'Stale CAS changed configuration')
            self.passed(site['provider'] + ': stale CAS leaves configuration and business bytes intact', self.business(site))
            invalid = self.body(site, original, content=original['content'] + '\nmicroi_e2e_unknown_directive on;\n')
            self.api.host('configuration', invalid, 422)
            require(self.configuration(site)['sha256'] == original['sha256'], 'nginx -t failure did not restore original bytes')
            self.passed(site['provider'] + ': real nginx -t failure keeps original service', self.business(site))
            content = original['content'] + '\n# panel-host-e2e ' + self.run + '\n'
            own_hashes.add(sha(content.encode()))
            request = self.body(site, original, content=content); receipt = self.api.host('configuration', request)
            require(receipt['validated'] is True and receipt['reloaded'] is True and receipt['configSha256'] == sha(content.encode()), 'Successful edit lacks exact live receipt')
            state['lastPublished'] = receipt; self.save()
            history = self.api.host('instances/' + site['instanceId'] + '/sites/' + site['siteId'] + '/history')['revisions']
            require(any(row['id'] == receipt['backupRevision'] and row['sha256'] == original['sha256'] for row in history), 'Original backup missing from real history')
            self.passed(site['provider'] + ': real edit, worker reload and backup history agree', self.business(site))
            current = self.configuration(site)
            restored = self.api.host('rollback', self.body(site, current, revisionId=receipt['backupRevision']))
            require(restored['configSha256'] == original['sha256'] and self.configuration(site)['sha256'] == original['sha256'], 'History rollback did not restore original bytes')
            self.passed(site['provider'] + ': history rollback restores the real site', self.business(site))
        finally:
            # 仅恢复仍为本次已知哈希的版本；后来的 vendor/管理员变化绝不覆盖。
            current = self.configuration(site)
            if current['sha256'] in own_hashes:
                try:
                    self.api.host('configuration', self.body(site, current, content=original['content']))
                    require(self.configuration(site)['sha256'] == original['sha256'], 'Final recovery readback differs')
                except Exception as error: rollback_failure = type(error).__name__
            if rollback_failure: raise AssertionError('Fixture recovery failed; original private snapshot retained: ' + rollback_failure)

    def execute(self):
        for site in self.config['sites']:
            key = site['provider'] + ':' + site['siteId']; state = self.state['sites'].setdefault(key, {})
            vendor = self.vendor(site); instance, current = self.selected(site)
            require(state.get('vendor', vendor) == vendor, 'Vendor installation or registered website identity changed')
            state['vendor'] = vendor
            if self.phase_name == 'inventory':
                state.setdefault('baseline', current); state.setdefault('initialFingerprint', instance['fingerprint'])
                require(current['sha256'] == state['baseline']['sha256'], 'Read-only inventory differs from its original snapshot')
                self.passed(site['provider'] + ': actual vendor database, read-only discovery and business baseline', self.business(site))
            else:
                require('baseline' in state, 'Run inventory first')
                require(instance['fingerprint'] == state['initialFingerprint'], 'Stable vendor instance identity changed')
                if self.phase_name == 'exercise': self.exercise(site, state)
                elif self.phase_name == 'prepare-vendor-edit':
                    self.selected(site, True)
                    state['pendingVendorEdit'] = {'before': current, 'request': self.body(site, current, content=current['content'] + '\n# stale panel request\n'),
                                                 'requiredMarker': '# vendor-host-e2e ' + self.run, 'preparedAt': time.time()}
                    self.passed(site['provider'] + ': old Panel request frozen before the operator edits through the actual vendor')
                elif self.phase_name == 'verify-vendor-edit':
                    pending = state['pendingVendorEdit']
                    require(current['sha256'] != pending['before']['sha256'] and pending['requiredMarker'] in current['content'], 'Actual vendor edit has not occurred')
                    self.api.host('configuration', pending['request'], 409)
                    require(self.configuration(site)['sha256'] == current['sha256'], 'Old Panel request overwrote the later vendor edit')
                    state['vendorEditVerified'] = {'sha256': current['sha256'], 'observedAt': time.time()}
                    self.passed(site['provider'] + ': later real vendor edit survives the stale Panel request', self.business(site))
                elif self.phase_name == 'checkpoint-restart':
                    self.selected(site, True)
                    state['restart'] = {'bootId': self.phase['runtime']['bootId'], 'runtime': self.runtime(site, instance), 'configurationSha256': current['sha256'],
                                        'fingerprint': instance['fingerprint'], 'registrations': self.snapshot_registrations(site), 'createdAt': time.time()}
                    if site.get('tls'): state['restart']['tls'] = self.business(site, True)
                    self.passed(site['provider'] + ': durable restart checkpoint captured', self.business(site))
                elif self.phase_name in ('verify-service-restart', 'verify-host-reboot'):
                    before = state['restart']; self.selected(site, True); runtime = self.runtime(site, instance)
                    require(runtime != before['runtime'], 'A real Nginx process restart is required; reload is insufficient')
                    different_boot = before['bootId'] != self.phase['runtime']['bootId']
                    require(different_boot == (self.phase_name == 'verify-host-reboot'), 'Actual host boot ID does not match the requested restart scope')
                    require(current['fingerprint'] == before['fingerprint'], 'Normal restart invalidated attachment')
                    after = self.snapshot_registrations(site)
                    require(after == before['registrations'], 'Restart lost or changed persistent external ACME registration')
                    require(current['sha256'] == before['configurationSha256'],
                            'Restart changed configuration; preserve evidence and verify the separate ACME operation before taking a fresh checkpoint')
                    if site.get('tls'): self.assert_current_certificate(site)
                    state[self.phase_name] = {'verifiedAt': time.time(), 'bootId': self.phase['runtime']['bootId']}
                    self.passed(site['provider'] + ': actual restart retains attachment, business and renewal registration', self.business(site))
                elif self.phase_name == 'verify-external-acme': self.verify_external_acme(site, state)
                elif self.phase_name == 'cleanup':
                    lines = current['content'].splitlines(keepends=True)
                    own = {'# panel-host-e2e ' + self.run, '# vendor-host-e2e ' + self.run}
                    cleaned = ''.join(line for line in lines if line.strip() not in own)
                    if cleaned != current['content']: self.api.host('configuration', self.body(site, current, content=cleaned))
                    require(not any(line.strip() in own for line in self.configuration(site)['content'].splitlines()), 'Test tag cleanup not confirmed')
                    self.passed(site['provider'] + ': only exact test tags removed; later SSL/vendor settings retained', self.business(site))
                self.save()
        self.phase.update(completed=True, finishedAt=time.time()); self.save()
        print(json.dumps({'phase': self.phase_name, 'completed': True, 'checks': len(self.phase['passed']), 'report': str(self.path)}))

    def assert_current_certificate(self, site):
        require(site.get('tls'), 'Actual HTTPS probe configuration is required')
        registrations = self.snapshot_registrations(site)
        require(len(registrations) == 1 and registrations[0]['autoRenew'] is True, 'Actual persistent automatic renewal registration required')
        certificates = self.api.call('/ops-api/panel/certificates')
        matching = [value for value in certificates if value['id'] == registrations[0]['id']]
        require(len(matching) == 1, 'Actual Panel certificate ledger entry missing')
        probe = self.business(site, True)
        require(probe['certificateSha1'] == matching[0]['thumbprint'].replace(':', '').upper(), 'Actual TLS leaf differs from Panel certificate ledger')
        return registrations[0], probe

    def verify_external_acme(self, site, state):
        require(self.receipt_path, 'External runner receipt is required')
        path = safe_path(self.receipt_path, private=True)
        require(path.is_relative_to(self.work.parent), 'External receipt must belong to the same exact lab')
        receipt = read_json(path)
        require(receipt['runId'] == self.run and receipt['candidateImageId'] == self.config['candidate']['imageId']
                and receipt['sourceHash'] == self.config['candidate']['sourceHash'], 'External ACME candidate binding differs')
        matches = [row for row in receipt['sites'] if row['instanceId'] == site['instanceId'] and row['siteId'] == site['siteId'] and row['provider'] == site['provider']]
        require(len(matches) == 1 and matches[0]['completed'] is True, 'No completed real external ACME receipt for this vendor site')
        row = matches[0]; registration, probe = self.assert_current_certificate(site)
        require(all(SHA.fullmatch(row[key]) for key in ('firstCertificateSha256', 'renewedCertificateSha256')), 'External certificate fingerprints missing')
        require(row['firstCertificateSha256'] != row['renewedCertificateSha256'] == probe['certificateSha256'], 'No actual certificate rotation observed')
        require(row['issueOperationId'] != row['renewOperationId'], 'Issuance and renewal must be different real operations')
        for field, action in (('issueOperationId', 'ExternalAcmeIssue'), ('renewOperationId', 'ExternalAcmeRenew')):
            operation_id = row[field]; require(re.fullmatch(r'[a-f0-9]{32}', operation_id), 'Invalid actual Panel operation ID')
            operation = self.api.call('/ops-api/panel/operations/' + operation_id)
            require(operation['state'] == 'Succeeded' and operation['action'] == action and operation['resourceId'] == registration['resourceId'], 'Real Panel ACME operation ledger does not confirm receipt')
            if field == 'renewOperationId' and row.get('afterHostReboot'):
                finished = datetime.datetime.fromisoformat(operation['updated'].replace('Z', '+00:00')).timestamp()
                require(finished > self.phase['runtime']['bootStartedAt'], 'Claimed renewal completed before the actual host reboot')
        if row.get('afterHostReboot'):
            require(state.get('verify-host-reboot'), 'Post-reboot renewal claim requires independently observed different boot ID')
        self.passed(site['provider'] + ': real external issue and renewal agree with task ledger, TLS rotation and business bytes',
                    {'receiptSha256': sha(path.read_bytes()), 'certificateSha256': probe['certificateSha256'], 'afterHostReboot': bool(row.get('afterHostReboot'))})


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--config', required=True); parser.add_argument('--phase', required=True, choices=PHASES)
    parser.add_argument('--external-acme-receipt')
    args = parser.parse_args(); runner = None
    try:
        # 先保留对象引用，初始化后段（HTTPS/就绪）失败也要给已创建的私有报告写入原失败。
        runner = Runner.__new__(Runner)
        runner.__init__(read_json(args.config), args.phase, args.external_acme_receipt); runner.execute(); return 0
    except Exception as error:
        # 原始 HTTP 响应已在私有目录保存；stdout 不输出凭据、配置正文或私钥。
        if runner is not None and hasattr(runner, 'phase'):
            runner.phase.update(failure={'type': type(error).__name__, 'message': str(error)}, finishedAt=time.time()); runner.save()
        print(json.dumps({'phase': args.phase, 'completed': False, 'errorType': type(error).__name__, 'error': str(error)})); return 1


if __name__ == '__main__': raise SystemExit(main())
