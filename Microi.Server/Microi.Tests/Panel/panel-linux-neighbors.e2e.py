#!/usr/bin/env python3
"""隔离 Linux 共存验收：在吾码安装前后回读第三方面板、Docker 和启动配置。"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import time


def onepanel_exec_path(service, text):
    """只解析两个固定服务的 ExecStart，不执行返回内容，也不接受任意二进制或 shell。"""
    if service not in ('1panel-core', '1panel-agent'):
        raise ValueError('Only the fixed 1Panel core/agent services are accepted')
    if not isinstance(text, str) or len(text) > 16384 or any(ord(char) < 32 for char in text):
        raise ValueError('Unexpected ExecStart text')
    match = re.fullmatch(r'\{\s*path=([^\s;{}]+)\s*;\s*argv\[\]=([^;{}]+)\s*;[^{}]*\}', text.strip())
    if not match:
        raise ValueError('Exactly one unambiguous systemd ExecStart is required')
    path = match.group(1)
    allowed = ('/usr/bin/' + service, '/usr/local/bin/' + service)
    if path not in allowed or match.group(2).strip().split()[0] != path:
        raise ValueError('ExecStart does not identify the allowed matching 1Panel binary')
    return path


def file_sha256(path, executable=False):
    value = Path(path)
    if not value.is_file(): return None
    resolved = value.resolve()
    if executable:
        # 仅兼容两个白名单目录间的同名官方链接；外部路径、包装脚本及替换中的文件不能冒充真实二进制。
        allowed = (Path('/usr/bin') / value.name, Path('/usr/local/bin') / value.name)
        if resolved not in allowed or not stat.S_ISREG(resolved.lstat().st_mode):
            raise ValueError('The selected 1Panel binary must resolve to its matching fixed path')
        if value.is_symlink():
            target = Path(os.readlink(value))
            target = target if target.is_absolute() else value.parent / target
            if target not in allowed: raise ValueError('The 1Panel symlink must directly target its matching fixed path')
    before = value.stat(); result = hashlib.sha256()
    with value.open('rb') as stream:
        header = stream.read(4)
        if executable and (header != b'\x7fELF' or not before.st_mode & 0o111):
            raise ValueError('The selected 1Panel path is not an executable ELF binary')
        result.update(header)
        for block in iter(lambda: stream.read(1024 * 1024), b''): result.update(block)
    after = value.stat()
    if value.resolve() != resolved or (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
        raise ValueError('The selected file changed while hashing')
    return result.hexdigest()


parser = argparse.ArgumentParser()
parser.add_argument('--run-id', required=True)
parser.add_argument('--phase', choices=['before-panel', 'after-panel', 'post-reboot'], required=True)
parser.add_argument('--work', required=True)
args = parser.parse_args()
assert os.geteuid() == 0
assert Path('/var/lib/panel-acceptance-id').read_text().strip() == args.run_id, 'Lab identity mismatch'
work = Path(args.work)
work.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(work, 0o700)
report_path = work / 'linux-neighbors-report.json'
report = json.loads(report_path.read_text()) if report_path.exists() else {'runId': args.run_id, 'phases': {}}
assert report['runId'] == args.run_id
phase = report['phases'][args.phase] = {'completed': False, 'startedAt': time.time(), 'passed': []}

def command(*items):
    return subprocess.check_output(items, text=True, stderr=subprocess.PIPE).strip()

def save():
    temporary = report_path.with_suffix('.tmp')
    temporary.write_text(json.dumps(report, indent=2))
    os.chmod(temporary, 0o600)
    temporary.replace(report_path)

def passed(message):
    phase['passed'].append(message)
    save()
    print('PASS ' + message, flush=True)

save()
try:
    # 不读取密码或数据库正文；只比较固定配置和执行文件的散列。
    onepanel = {name: onepanel_exec_path(name, command('systemctl', 'show', '--property=ExecStart', '--value', '--no-pager', name))
                for name in ('1panel-core', '1panel-agent')}
    paths = ['/www/server/panel/BTPanel/__init__.py', onepanel['1panel-core'], onepanel['1panel-agent'],
             '/usr/bin/docker', '/www/server/panel/data/port.pl', '/www/server/panel/data/admin_path.pl',
             '/opt/1panel/conf/app.yaml', '/etc/docker/daemon.json', '/etc/systemd/system/docker.service',
             '/usr/lib/systemd/system/docker.service']
    hashes = {path: file_sha256(path, executable=path in onepanel.values()) for path in paths}
    for path in paths[:4]:
        assert hashes[path], 'Required actual vendor installation is missing: ' + path
    services = {name: {'active': command('systemctl', 'is-active', name), 'enabled': command('systemctl', 'is-enabled', name)}
                for name in ['bt', '1panel-core', '1panel-agent', 'docker']}
    assert all(value['active'] == 'active' and value['enabled'] == 'enabled' for value in services.values())
    passed('Actual BaoTa, 1Panel core/agent and Docker services are active and enabled')
    info = json.loads(command('docker', 'info', '--format', '{{json .}}'))
    assert info['OSType'] == 'linux'
    boot_id = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    state = {'configAndBinaryHashes': hashes, 'onePanelExecutables': onepanel,
             'onePanelResolvedExecutables': {name: str(Path(path).resolve()) for name, path in onepanel.items()},
             'services': services, 'dockerEngineId': info['ID'],
             'dockerVersion': command('docker', 'version', '--format', '{{.Server.Version}}'),
             'composeVersion': command('docker', 'compose', 'version', '--short'),
             'onePanelVersion': command('1pctl', 'version'), 'bootId': boot_id}
    if args.phase == 'before-panel':
        for label in ['io.microi.panel.controller=true', 'io.microi.ops.controller=true']:
            assert not command('docker', 'ps', '-aq', '--filter', 'label=' + label), 'Panel already installed'
        report['baseline'] = state
        passed('Third-party installations and the existing Docker engine are recorded before Panel installation')
    else:
        baseline = report['baseline']
        for key in ['configAndBinaryHashes', 'onePanelExecutables', 'onePanelResolvedExecutables', 'dockerEngineId', 'dockerVersion', 'composeVersion', 'onePanelVersion']:
            assert state[key] == baseline[key], 'Panel installation changed existing neighbor state: ' + key
        passed('Panel installation preserves existing vendor binaries, configuration and Docker identity')
        if args.phase == 'post-reboot':
            assert boot_id != baseline['bootId'], 'A real host reboot is required'
            passed('A different host boot retains all third-party services and the same Docker engine')
    phase.update({'completed': True, 'finishedAt': time.time(), 'state': state})
    save()
    print(json.dumps({'phase': args.phase, 'passed': len(phase['passed']), 'completed': True}))
except Exception as error:
    phase['error'] = str(error)
    save()
    raise
