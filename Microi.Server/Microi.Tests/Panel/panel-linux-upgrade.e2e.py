#!/usr/bin/env python3
"""真实独立安装器的只读预检、离线升级和失败回退；仅允许显式隔离实验机。"""
import argparse
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import ssl
import subprocess
import time
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--run-id', required=True)
parser.add_argument('--work', required=True)
parser.add_argument('--installer', required=True)
args = parser.parse_args()
assert os.geteuid() == 0
assert Path('/var/lib/panel-acceptance-id').read_text().strip() == args.run_id
assert args.run_id.replace('-', '').isalnum()
work = Path(args.work)
work.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(work, 0o700)
root = Path('/microi/panel')
report = {'runId': args.run_id, 'completed': False, 'passed': [], 'startedAt': time.time(),
          'installerSha256': hashlib.sha256(Path(args.installer).read_bytes()).hexdigest()}
report_path = work / 'linux-upgrade-report.json'

def command(*items):
    return subprocess.check_output(items, text=True, stderr=subprocess.PIPE).strip()

def inspect(name):
    return json.loads(command('docker', 'inspect', name))[0]

def save():
    report_path.write_text(json.dumps(report, indent=2))
    os.chmod(report_path, 0o600)

def passed(message):
    report['passed'].append(message)
    save()
    print('PASS ' + message, flush=True)

env = dict(line.split('=', 1) for line in (root / 'config/panel.env').read_text().splitlines() if '=' in line)
origin = env['OPS_PUBLIC_URL']
certificate = command('openssl', 'pkcs12', '-in', str(root / 'config/panel.pfx'), '-passin', 'file:' + str(root / 'config/tls-password'), '-clcerts', '-nokeys')
certificate_path = work / 'panel-public.pem'
certificate_path.write_text(certificate)
client = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=str(certificate_path))),
                                    urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
csrf = ''

def api(path, data=None):
    request = urllib.request.Request(origin + path, data=json.dumps(data).encode() if data is not None else None,
                                     headers={'Origin': origin, 'Content-Type': 'application/json', 'X-Ops-CSRF': csrf})
    with client.open(request, timeout=30) as response:
        assert response.status == 200
        return json.loads(response.read())

csrf = api('/ops-api/session')['csrfToken']
api('/ops-api/login', {'account': env['OPS_ADMIN_USERNAME'], 'password': (root / 'config/admin-password').read_text().strip()})
csrf = api('/ops-api/session')['csrfToken']

def snapshot():
    value = api('/ops-api/panel/snapshot')
    gateway = next(item for item in value['resources'] if item['id'] == 'coexist-gateway')
    assert inspect(gateway['containerId'])['State']['Running']
    return {'ownerId': value['ownerId'], 'gatewayId': gateway['containerId'], 'gatewayVolume': gateway['volumeName'],
            'fileHash': api('/ops-api/panel/nginx/coexist-gateway/sites/witness/file?path=index.html')['hash'],
            'configHashes': {name: hashlib.sha256((root / 'config' / name).read_bytes()).hexdigest()
                             for name in ['panel.env', 'admin-password', 'tls-password', 'panel.pfx', 'deployment.json']}}

def install(stage, image, success=True, check=False):
    path = work / (stage + '.log')
    arguments = ['bash', args.installer, '--upgrade', '--root', str(root), '--image', image, '--offline', '--yes']
    if check:
        arguments.append('--check')
    with path.open('w') as output:
        result = subprocess.run(arguments, stdout=output, stderr=subprocess.STDOUT, timeout=240)
    os.chmod(path, 0o600)
    if success:
        assert result.returncode == 0, 'Installer failed; inspect private log: ' + str(path)
    else:
        assert result.returncode != 0, 'A deliberately unhealthy candidate was incorrectly accepted'
        assert '已恢复原面板' in path.read_text(), 'Installer did not prove rollback readiness'
    assert snapshot() == original_state, 'Upgrade or rollback changed credentials, original website or data ownership'
    return result.returncode

original = inspect('microi-panel')
assert original['Config']['Labels']['io.microi.panel.controller'] == 'true'
original_state = snapshot()
report['originalImageId'] = original['Image']
fixture = args.run_id + '-upgrade-fixture'
good, bad = args.run_id + '-upgrade:healthy', args.run_id + '-upgrade:unhealthy'
save()
try:
    install('readonly-check', original['Image'], check=True)
    assert inspect('microi-panel')['Id'] == original['Id']
    passed('Read-only upgrade preflight leaves the real container, account, certificate and website unchanged')
    # 在未启动、无业务挂载的空容器上只修改镜像配置，构造可追溯的健康/故障候选；不修改实际面板文件。
    command('docker', 'create', '--name', fixture, '--label', 'io.microi.panel.test=' + args.run_id,
            '--network', 'none', '--memory', '64m', original['Image'])
    assert inspect(fixture)['Config']['Labels']['io.microi.panel.test'] == args.run_id
    command('docker', 'commit', '--change', 'LABEL io.microi.panel.upgrade-test=healthy', fixture, good)
    command('docker', 'commit', '--change', 'ENTRYPOINT ["/bin/false"]', '--change', 'LABEL io.microi.panel.upgrade-test=unhealthy', fixture, bad)
    command('docker', 'rm', fixture)
    install('offline-upgrade', good)
    current = inspect('microi-panel')
    assert current['Id'] != original['Id'] and current['Image'] != original['Image']
    passed('Offline upgrade selects a new local image and preserves the account, TLS, website and durable ownership')
    install('failed-upgrade', bad, success=False)
    assert inspect('microi-panel')['Image'] == current['Image']
    passed('Unhealthy new image is rejected and the previously healthy real controller becomes available again')
    install('restore-candidate', original['Image'])
    assert inspect('microi-panel')['Image'] == original['Image']
    passed('Original tested image is restored with the same website, data volume and independent credentials')
    report.update({'completed': True, 'finishedAt': time.time(), 'finalImageId': inspect('microi-panel')['Image']})
    save()
    print(json.dumps({'completed': True, 'passed': len(report['passed'])}))
except Exception as error:
    report['error'] = str(error)
    save()
    raise
