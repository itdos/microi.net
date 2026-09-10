#!/usr/bin/env python3
"""隔离 Linux 共存验收：在吾码安装前后回读第三方面板、Docker 和启动配置。"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

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
    paths = ['/www/server/panel/BTPanel/__init__.py', '/usr/bin/1panel-core', '/usr/bin/1panel-agent',
             '/usr/bin/docker', '/www/server/panel/data/port.pl', '/www/server/panel/data/admin_path.pl',
             '/opt/1panel/conf/app.yaml', '/etc/docker/daemon.json', '/etc/systemd/system/docker.service',
             '/usr/lib/systemd/system/docker.service']
    hashes = {path: hashlib.sha256(Path(path).read_bytes()).hexdigest() if Path(path).is_file() else None for path in paths}
    for path in paths[:4]:
        assert hashes[path], 'Required actual vendor installation is missing: ' + path
    services = {name: {'active': command('systemctl', 'is-active', name), 'enabled': command('systemctl', 'is-enabled', name)}
                for name in ['bt', '1panel-core', '1panel-agent', 'docker']}
    assert all(value['active'] == 'active' and value['enabled'] == 'enabled' for value in services.values())
    passed('Actual BaoTa, 1Panel core/agent and Docker services are active and enabled')
    info = json.loads(command('docker', 'info', '--format', '{{json .}}'))
    assert info['OSType'] == 'linux'
    boot_id = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    state = {'configAndBinaryHashes': hashes, 'services': services, 'dockerEngineId': info['ID'],
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
        for key in ['configAndBinaryHashes', 'dockerEngineId', 'dockerVersion', 'composeVersion', 'onePanelVersion']:
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
