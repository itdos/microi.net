#!/usr/bin/env python3
"""Real Linux installation/coexistence acceptance; refuses hosts without an exact lab marker.

Run as root inside an isolated VM after the real installer. A baseline installs a
real Nginx through Panel, publishes a file, and records durable identities. Run
again after each actual third-party panel installation and after a host reboot.
No credentials or private keys are written to the report or standard output.
"""
import argparse
import base64
import hashlib
import http.client
import http.cookiejar
import json
import os
from pathlib import Path
import ssl
import subprocess
import time
import urllib.error
import urllib.request
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--run-id', required=True)
parser.add_argument('--phase', required=True)
parser.add_argument('--root', default='/microi/panel')
parser.add_argument('--work', required=True)
parser.add_argument('--image-digest', required=True)
parser.add_argument('--retry-failed', action='store_true')
args = parser.parse_args()
assert os.geteuid() == 0, 'This isolated-host test requires root'
assert Path('/var/lib/panel-acceptance-id').read_text().strip() == args.run_id, 'Lab host identity mismatch'
assert args.phase.replace('-', '').isalnum(), 'Invalid phase'
root, work = Path(args.root), Path(args.work)
work.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(work, 0o700)
record_path = work / 'linux-install-report.json'
record = json.loads(record_path.read_text()) if record_path.exists() else {'runId': args.run_id, 'operations': {}, 'phases': {}}
assert record['runId'] == args.run_id
record['phases'][args.phase] = {'completed': False, 'startedAt': time.time(), 'passed': []}
phase = record['phases'][args.phase]

def save():
    temp = record_path.with_suffix('.tmp')
    temp.write_text(json.dumps(record, ensure_ascii=False, indent=2))
    os.chmod(temp, 0o600)
    temp.replace(record_path)

def passed(message):
    phase['passed'].append(message)
    save()
    print('PASS ' + message, flush=True)

def command(*items):
    return subprocess.check_output(items, text=True, stderr=subprocess.PIPE).strip()

def digest(data):
    return hashlib.sha256(data).hexdigest()

save()
try:
    env = dict(line.split('=', 1) for line in (root / 'config/panel.env').read_text().splitlines() if '=' in line)
    origin = env['OPS_PUBLIC_URL']
    assert origin.startswith('https://')
    certificate = command('openssl', 'pkcs12', '-in', str(root / 'config/panel.pfx'), '-passin', 'file:' + str(root / 'config/tls-password'), '-clcerts', '-nokeys')
    ca_file = work / 'panel-public.pem'
    ca_file.write_text(certificate)
    tls = ssl.create_default_context(cafile=str(ca_file))
    cookies = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(urllib.request.HTTPSHandler(context=tls), urllib.request.HTTPCookieProcessor(cookies))
    csrf = ''

    def api(path, data=None, expected=200):
        request = urllib.request.Request(origin + path, data=json.dumps(data).encode() if data is not None else None,
                                         headers={'Origin': origin, 'Content-Type': 'application/json', 'X-Ops-CSRF': csrf})
        try:
            response = client.open(request, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        body = response.read().decode()
        assert response.status == expected, f'{path}: expected {expected}, got {response.status}: {body[:1200]}'
        return json.loads(body) if body else {}

    assert api('/health')['version'] == '2.0.0'
    api('/ops-api/panel/snapshot', expected=401)
    passed('Independent HTTPS validates its installed certificate and rejects anonymous host access')
    csrf = api('/ops-api/session')['csrfToken']
    api('/ops-api/login', {'account': env['OPS_ADMIN_USERNAME'], 'password': (root / 'config/admin-password').read_text().strip()})
    csrf = api('/ops-api/session')['csrfToken']
    snapshot = api('/ops-api/panel/snapshot')
    assert snapshot['ownerId']
    catalog = api('/ops-api/panel/catalog')
    assert len(catalog) >= 10
    passed('Generated independent account logs in and reads the real Docker plugin catalog')

    controller = json.loads(command('docker', 'inspect', 'microi-panel'))[0]
    image = json.loads(command('docker', 'image', 'inspect', controller['Image']))[0]
    image_digests = [controller['Image'], image['Id'], *image.get('RepoDigests', [])]
    assert any(args.image_digest in value for value in image_digests), 'Installed image differs from the candidate'
    assert controller['Config']['Labels']['io.microi.panel.controller'] == 'true'
    assert controller['State']['Health']['Status'] == 'healthy'
    assert controller['HostConfig']['Memory'] == 512 * 1024 * 1024
    configs = {name: digest((root / 'config' / name).read_bytes()) for name in ['admin-password', 'tls-password', 'panel.pfx', 'panel.env', 'deployment.json']}
    for name in configs:
        assert (root / 'config' / name).stat().st_mode & 0o777 == 0o600, 'Configuration permissions changed: ' + name
    engine_id = json.loads(command('docker', 'info', '--format', '{{json .}}'))['ID']

    def operation(step, endpoint, data):
        if step not in record['operations']:
            data['requestId'] = str(uuid.uuid5(uuid.NAMESPACE_URL, args.run_id + ':' + step))
            record['operations'][step] = api('/ops-api/' + endpoint, data, 202)['id']
            save()
        operation_id = record['operations'][step]
        result = api('/ops-api/panel/operations/' + operation_id)
        if result['state'] == 'Failed' and args.retry_failed:
            api('/ops-api/panel/operations/' + operation_id + '/retry', {'confirm': operation_id}, 202)
        until = time.monotonic() + 300
        while time.monotonic() < until:
            result = api('/ops-api/panel/operations/' + operation_id)
            assert result['state'] != 'Failed', f'{step} failed: {json.dumps(result, ensure_ascii=False)[:1800]}'
            if result['state'] == 'Succeeded':
                return result
            time.sleep(1)
        raise AssertionError(step + ' did not reach a terminal state: ' + operation_id)

    content = '<h1>Microi.Panel coexistence ' + args.run_id + '</h1>'
    if args.phase == 'baseline':
        operation('install-nginx', 'panel/install', {'name': 'coexist-gateway', 'pluginId': 'nginx', 'version': '1.30.4', 'ports': {'http': 61891, 'https': 61892}, 'confirm': 'coexist-gateway'})
        configuration = {'sites': [{'id': 'witness', 'name': '共存验收站点', 'domains': ['coexist.example.test'], 'kind': 'Static'}]}
        operation('publish-site', 'panel/nginx/coexist-gateway/publish', {'confirm': 'coexist-gateway', 'expectedRevision': 'initial', 'configuration': configuration})
        operation('write-file', 'panel/nginx/coexist-gateway/files', {'siteId': 'witness', 'action': 'Write', 'path': 'index.html', 'confirm': 'index.html', 'contentBase64': base64.b64encode(content.encode()).decode(), 'expectedHash': ''})
    else:
        assert record.get('baseline'), 'A successful baseline is required before coexistence verification'
        baseline = record['baseline']
        assert configs == baseline['configHashes'], 'Original credentials, TLS or deployment configuration changed'
        assert engine_id == baseline['dockerEngineId'], 'Docker engine was replaced'
        assert controller['Id'] == baseline['controllerId'], 'Panel container was replaced by another installer'
        assert snapshot['ownerId'] == baseline['ownerId'], 'Panel durable ownership changed'
        passed('Existing Docker identity, controller, credentials and certificate are preserved')

    latest = api('/ops-api/panel/snapshot')
    resource = next(item for item in latest['resources'] if item['id'] == 'coexist-gateway')
    gateway = json.loads(command('docker', 'inspect', resource['containerName']))[0]
    assert gateway['State']['Running']
    file = api('/ops-api/panel/nginx/coexist-gateway/sites/witness/file?path=index.html')
    assert file['text'] == content
    connection = http.client.HTTPConnection('127.0.0.1', 61891, timeout=15)
    connection.request('GET', '/', headers={'Host': 'coexist.example.test'})
    response = connection.getresponse()
    assert response.status == 200
    assert response.read().decode() == content
    connection.close()
    for step, operation_id in record['operations'].items():
        assert api('/ops-api/panel/operations/' + operation_id)['state'] == 'Succeeded', 'Durable operation history changed: ' + step
    passed('Real Nginx site, persisted file and original operation history remain available')
    state = {'configHashes': configs, 'dockerEngineId': engine_id, 'controllerId': controller['Id'], 'imageDigest': args.image_digest,
             'ownerId': latest['ownerId'], 'gatewayId': gateway['Id'], 'fileHash': file['hash'], 'origin': origin,
             'dockerVersion': command('docker', 'version', '--format', '{{.Server.Version}}'), 'composeVersion': command('docker', 'compose', 'version', '--short')}
    if args.phase == 'baseline':
        record['baseline'] = state
    else:
        assert state['gatewayId'] == record['baseline']['gatewayId'], 'Third-party installer replaced Panel Nginx'
        assert state['fileHash'] == record['baseline']['fileHash']
    phase.update({'completed': True, 'finishedAt': time.time(), 'state': state})
    save()
    print(json.dumps({'phase': args.phase, 'passed': len(phase['passed']), 'completed': True}))
except Exception as error:
    phase['error'] = str(error)
    phase['finishedAt'] = time.time()
    save()
    raise
