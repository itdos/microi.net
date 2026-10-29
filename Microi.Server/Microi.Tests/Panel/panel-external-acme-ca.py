#!/usr/bin/env python3
"""隔离 VM 外的两套 Pebble 测试 CA；start/status/cleanup 只操作精确 owner 的 Desktop 容器。

配置须放工作区 .tmp/<task>/external-ca-config.json：
{runId, work:绝对 .tmp/<task>/external-ca, sans:[IP或DNS],
 sites:[{provider:'1Panel'|'BaoTa',domain,challengeAddress,challengePort,port,managementPort}]}
两套 CA 各128MiB，不拉镜像，不修改主机网络。VM 重启期间保持 CA 进程，不支持 CA 自身重启。
只导出公钥；任务私钥保留在独占目录和目标容器中，cleanup 会停止并移除本任务容器。
"""
from __future__ import annotations

import argparse
import base64
import datetime
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import ssl
import subprocess
import time
import urllib.request
import urllib.error
import urllib.parse

IMAGE = 'registry.cn-hangzhou.aliyuncs.com/microios/pebble@sha256:5080492187bea12909c053d7a2b90a9e95104ef1c82381828e7823db71ce7e54'
OWNER = 'io.microi.panel.external-acme-test'
ROLE = 'io.microi.panel.external-acme-provider'


def require(condition, message):
    if not condition: raise AssertionError(message)


def digest(data): return hashlib.sha256(data).hexdigest()


def docker(*args):
    result = subprocess.run(['docker', '--context', 'desktop-linux', *args], capture_output=True, timeout=60)
    require(result.returncode == 0, 'Desktop Docker ' + args[0] + ' failed: ' + result.stderr.decode(errors='replace')[-1500:])
    require(len(result.stdout) <= 2 * 1024 * 1024, 'Docker readback exceeded budget')
    return result.stdout.decode().strip()


def write_json(path, value):
    temporary = path.with_name(path.name + '.pending')
    with temporary.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2); stream.flush(); os.fsync(stream.fileno())
    os.replace(temporary, path)


def safe_directory(path):
    for parent in [*reversed(path.parents), path]:
        if parent.exists():
            require(not parent.is_symlink() and not (hasattr(parent, 'is_junction') and parent.is_junction()), 'Linked fixture path refused')


def certificates(work, sans):
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID
    key = ec.generate_private_key(ec.SECP256R1()); server = ec.generate_private_key(ec.SECP256R1())
    now = datetime.datetime.now(datetime.timezone.utc)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Microi owned external ACME transport test root')])
    root = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=5))
            .not_valid_after(now + datetime.timedelta(days=3)).add_extension(x509.BasicConstraints(ca=True, path_length=0), True)
            .add_extension(x509.KeyUsage(False, False, False, False, False, True, True, None, None), True).sign(key, hashes.SHA256()))
    names = []
    for value in sans:
        try: names.append(x509.IPAddress(ipaddress.ip_address(value)))
        except ValueError:
            require(re.fullmatch(r'[a-zA-Z0-9.-]+', value), 'Invalid explicit CA SAN')
            names.append(x509.DNSName(value))
    leaf = (x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Microi external ACME test transport')]))
            .issuer_name(name).public_key(server.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(minutes=5)).not_valid_after(now + datetime.timedelta(days=3))
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), True).add_extension(x509.SubjectAlternativeName(names), False)
            .add_extension(x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.SERVER_AUTH]), False).sign(key, hashes.SHA256()))
    # 只将 HTTPS 服务叶私钥交给 Pebble；传输 CA 私钥从不写盘，也不导出给 VM。
    for filename, data in [('transport-root.pem', root.public_bytes(serialization.Encoding.PEM)),
                           ('transport-server.pem', leaf.public_bytes(serialization.Encoding.PEM)),
                           ('transport-server-key.pem', server.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))]:
        with (work / filename).open('xb') as stream: stream.write(data)


class Fixture:
    def __init__(self, config):
        self.config = config; self.run = config['runId']; self.work = Path(config['work']).absolute()
        require(re.fullmatch(r'[a-z][a-z0-9-]{5,80}', self.run), 'Invalid owner run')
        scratch = Path(__file__).resolve().parents[3] / '.tmp'
        require(self.work.is_relative_to(scratch) and self.work.parent.parent == scratch and self.work.name == 'external-ca', 'Use exact task scratch/external-ca')
        safe_directory(self.work); require((self.work.parent / 'owner.json').is_file(), 'Parent task owner marker required')
        self.path = self.work / 'ca-state.json'; owner = {'runId': self.run, 'purpose': 'external-persistent-test-ca'}
        if not self.work.exists():
            self.work.mkdir(); write_json(self.work / 'owner.json', owner)
        require(json.loads((self.work / 'owner.json').read_text()) == owner, 'Fixture ownership mismatch')
        self.hash = digest(json.dumps(config, sort_keys=True).encode())
        self.state = json.loads(self.path.read_text()) if self.path.exists() else {'runId': self.run, 'configSha256': self.hash, 'containers': {}, 'completed': False}
        require(self.state['runId'] == self.run and self.state['configSha256'] == self.hash, 'Fixture input changed after reservation')
        require({x['provider'] for x in config['sites']} == {'1Panel', 'BaoTa'} and len(config['sites']) == 2, 'Select exactly two vendor CAs')
        ports = [x[y] for x in config['sites'] for y in ('port', 'managementPort')]
        require(len(set(ports)) == 4 and all(type(x) is int and 1024 <= x <= 65535 for x in ports), 'Four explicit distinct loopback ports required')
        for site in config['sites']:
            require(re.fullmatch(r'[a-z0-9.-]+\.test', site['domain']), 'Only isolated test domains')
            if site['challengeAddress'] != 'host-gateway': ipaddress.ip_address(site['challengeAddress'])
            require(type(site['challengePort']) is int and 1024 <= site['challengePort'] <= 65535, 'Explicit forwarded HTTP challenge port required')

    def save(self): write_json(self.path, self.state)

    def inspect_owned(self, entry, site):
        current = json.loads(docker('inspect', entry['id']))[0]
        require(current['Id'] == entry['id'] and current['Config']['Labels'].get(OWNER) == self.run
                and current['Config']['Labels'].get(ROLE) == site['provider'] and current['Image'] == entry['imageId'], 'Container ownership changed')
        require(current['HostConfig']['Memory'] == 128 * 1024 * 1024 and current['HostConfig']['CapDrop'] == ['ALL'], 'CA resource/security limit changed')
        require(current['HostConfig']['ReadonlyRootfs'] and current['HostConfig']['RestartPolicy']['Name'] == 'no'
                and 'PEBBLE_VA_ALWAYS_VALID=1' not in current['Config']['Env'] and 'PEBBLE_AUTHZREUSE=0' in current['Config']['Env'], 'CA validation/continuity settings changed')
        return current

    def fetch(self, port, path):
        context = ssl.create_default_context(cafile=str(self.work / 'transport-root.pem'))
        client = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=context))
        with client.open('https://127.0.0.1:' + str(port) + path, timeout=8) as response:
            data = response.read(65537); require(response.status == 200 and len(data) <= 65536, 'CA response invalid or oversized'); return data

    def start(self):
        require(not self.state.get('cleaned'), 'A cleaned in-memory CA cannot be recreated under old evidence')
        if os.name == 'nt':
            # 两个轻量容器仍须遵守整个共享主机的安全余量；不能为了夹具启动挤占其它任务。
            import ctypes
            class Memory(ctypes.Structure):
                _fields_ = [('length', ctypes.c_uint32), ('load', ctypes.c_uint32)] + [(x, ctypes.c_uint64) for x in
                    ('total', 'available', 'pageTotal', 'pageAvailable', 'virtualTotal', 'virtualAvailable', 'extended')]
            memory = Memory(); memory.length = ctypes.sizeof(memory)
            require(ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)) and memory.available >= 2.1 * 1024**3,
                    'Keep at least 2.1 GiB Windows physical memory free before starting both CAs')
        image = json.loads(docker('image', 'inspect', IMAGE))[0]
        require(image['Os'] == 'linux' and image['Architecture'] == 'amd64', 'Select the cached Linux AMD64 CA image')
        if not (self.work / 'transport-root.pem').exists():
            require(not self.state['containers'], 'Transport trust lost while CA is active')
            certificates(self.work, self.config['sans'])
        created = []
        try:
            for site in self.config['sites']:
                provider = site['provider']; entry = self.state['containers'].get(provider)
                if entry:
                    self.inspect_owned(entry, site); continue
                for port in (site['port'], site['managementPort']):
                    with socket.socket() as check: check.bind(('127.0.0.1', port))
                name = 'mci-ext-acme-' + digest(self.run.encode())[:12] + '-' + provider.lower()
                require(docker('ps', '-aq', '--filter', 'name=^/' + name + '$') == '', 'Reserved CA container name already exists')
                path = self.work / (provider.lower() + '-config.json')
                write_json(path, {'pebble': {'listenAddress': '0.0.0.0:14000', 'managementListenAddress': '0.0.0.0:15000',
                    'certificate': '/fixture/transport-server.pem', 'privateKey': '/fixture/transport-server-key.pem',
                    'httpPort': site['challengePort'], 'tlsPort': 65534, 'externalAccountBindingRequired': False,
                    'keyAlgorithm': 'ecdsa', 'retryAfter': {'authz': 1, 'order': 1},
                    'profiles': {'default': {'description': 'Owned real HTTP01 test only', 'validityPeriod': 600}}}})
                identity = docker('create', '--name', name, '--label', OWNER + '=' + self.run, '--label', ROLE + '=' + provider,
                    '--memory', '128m', '--cpus', '0.5', '--pids-limit', '64', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                    '--read-only', '--restart', 'no', '--log-driver', 'local', '--log-opt', 'max-size=1m', '--log-opt', 'max-file=2',
                    '--add-host', site['domain'] + ':' + site['challengeAddress'], '-e', 'PEBBLE_VA_NOSLEEP=1', '-e', 'PEBBLE_AUTHZREUSE=0',
                    '-p', '127.0.0.1:' + str(site['port']) + ':14000', '-p', '127.0.0.1:' + str(site['managementPort']) + ':15000',
                    '--mount', 'type=bind,source=' + str(self.work) + ',target=/fixture,readonly', image['Id'],
                    '-config', '/fixture/' + path.name, '-strict=true')
                entry = {'id': identity, 'name': name, 'imageId': image['Id']}; self.state['containers'][provider] = entry; created.append((entry, site)); self.save()
                docker('start', identity)
                current = self.inspect_owned(entry, site); entry['startedAt'] = current['State']['StartedAt']; self.save()
            self.status()
        except BaseException:
            # 失败只回收本次新建且身份仍一致的容器；已成功存在的另一 CA 必须保留其账号和签发者。
            for entry, site in reversed(created):
                try:
                    current = self.inspect_owned(entry, site)
                    if current['State']['Running']: docker('stop', '--time', '5', entry['id'])
                    docker('rm', entry['id']); self.state['containers'].pop(site['provider']); self.save()
                except Exception as cleanup_error:
                    self.state.setdefault('cleanupErrors', []).append({'id': entry['id'], 'type': type(cleanup_error).__name__})
                    self.save()
            raise

    def status(self):
        public = {'runId': self.run, 'completed': False, 'testCaOnly': True, 'continuity': 'CA processes stay outside the VM; CA restart is rejected', 'sites': []}
        for site in self.config['sites']:
            entry = self.state['containers'][site['provider']]; current = self.inspect_owned(entry, site)
            require(current['State']['Running'] and current['State']['StartedAt'] == entry['startedAt'] and current['RestartCount'] == 0, 'CA was restarted or stopped; its in-memory evidence is invalid')
            deadline = time.monotonic() + 20
            while True:
                try:
                    directory = json.loads(self.fetch(site['port'], '/dir')); root = self.fetch(site['managementPort'], '/roots/0'); break
                except Exception:
                    if time.monotonic() >= deadline: raise
                    time.sleep(1)
            require('newAccount' in directory and root.startswith(b'-----BEGIN CERTIFICATE-----'), 'Real CA directory/root readback failed')
            root_hash = digest(root)
            require(entry.get('issuerPemSha256', root_hash) == root_hash, 'CA issuer changed across VM phases')
            root_path = self.work / (site['provider'].lower() + '-issuer-root.pem')
            if root_path.exists(): require(root_path.read_bytes() == root, 'Recorded issuer root changed')
            else: root_path.write_bytes(root)
            entry['issuerPemSha256'] = root_hash
            public['sites'].append({**site, 'containerId': entry['id'], 'imageId': entry['imageId'], 'startedAt': entry['startedAt'],
                'issuerPemSha256': root_hash, 'transportPemSha256': digest((self.work / 'transport-root.pem').read_bytes()),
                'transportRootFile': str(self.work / 'transport-root.pem'), 'issuerRootFile': str(root_path), 'lifetimeSeconds': 600})
        public.update(completed=True, observedAt=time.time()); self.state['completed'] = True; self.save(); write_json(self.work / 'ca-receipt.json', public)
        print(json.dumps(public))

    def cleanup(self):
        for site in self.config['sites']:
            entry = self.state['containers'].get(site['provider'])
            if not entry: continue
            current = self.inspect_owned(entry, site)
            if current['State']['Running']: docker('stop', '--time', '5', entry['id'])
            docker('rm', entry['id']); self.state['containers'].pop(site['provider']); self.save()
        require(docker('ps', '-aq', '--filter', 'label=' + OWNER + '=' + self.run) == '', 'Owned CA cleanup incomplete')
        self.state.update(cleaned=True, cleanedAt=time.time()); self.save()
        print(json.dumps({'runId': self.run, 'cleaned': True, 'retained': 'Minimal fixture/evidence files; private key deletion follows native owned-file cleanup'}))

    def probe_http(self, provider):
        """用真实 ACME 无令牌挑战证明 CA 已抵达原网站；预期授权失败，绝不当成成功签发。"""
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import ec, utils
        site = next((x for x in self.config['sites'] if x['provider'] == provider), None)
        require(site, 'Select exactly one configured provider for the HTTP reachability probe')
        self.status()
        context = ssl.create_default_context(cafile=str(self.work / 'transport-root.pem'))
        client = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=context))
        origin = 'https://127.0.0.1:' + str(site['port']); directory = json.loads(self.fetch(site['port'], '/dir'))
        key = ec.generate_private_key(ec.SECP256R1()); numbers = key.public_key().public_numbers()
        encode = lambda value: base64.urlsafe_b64encode(value).rstrip(b'=').decode()
        jwk = {'kty': 'EC', 'crv': 'P-256', 'x': encode(numbers.x.to_bytes(32, 'big')), 'y': encode(numbers.y.to_bytes(32, 'big'))}; account = None
        def post(url, payload):
            require(urllib.parse.urlsplit(url).netloc == urllib.parse.urlsplit(origin).netloc and url.startswith(origin + '/'), 'CA returned an unexpected protocol origin')
            for _ in range(5):
                with client.open(urllib.request.Request(directory['newNonce'], method='HEAD'), timeout=10) as response: nonce = response.headers['Replay-Nonce']
                protected = {'alg': 'ES256', 'nonce': nonce, 'url': url, **({'kid': account} if account else {'jwk': jwk})}
                header = encode(json.dumps(protected).encode()); data = encode(json.dumps(payload).encode()) if payload is not None else ''
                r, s = utils.decode_dss_signature(key.sign((header + '.' + data).encode(), ec.ECDSA(hashes.SHA256())))
                body = json.dumps({'protected': header, 'payload': data, 'signature': encode(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}).encode()
                try: response = client.open(urllib.request.Request(url, body, {'Content-Type': 'application/jose+json'}), timeout=12)
                except urllib.error.HTTPError as error: response = error
                with response:
                    raw = response.read(65537); require(len(raw) <= 65536, 'ACME probe response exceeded budget')
                    value = json.loads(raw) if raw else {}; status = response.status; location = response.headers.get('Location')
                if value.get('type') == 'urn:ietf:params:acme:error:badNonce': continue
                require(status < 400, 'ACME reachability probe protocol failed: ' + value.get('type', str(status)))
                return value, location
            raise AssertionError('ACME nonce retry budget exceeded')
        _, account = post(directory['newAccount'], {'termsOfServiceAgreed': True})
        order, _ = post(directory['newOrder'], {'identifiers': [{'type': 'dns', 'value': site['domain']}]})
        authz, _ = post(order['authorizations'][0], None)
        challenges = [x for x in authz['challenges'] if x['type'] == 'http-01']; require(len(challenges) == 1, 'Actual CA did not offer HTTP01')
        post(challenges[0]['url'], {})
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            authz, _ = post(order['authorizations'][0], None)
            if authz['status'] == 'invalid': break
            require(authz['status'] != 'valid', 'Missing-token probe unexpectedly validated; challenge validation may be bypassed')
            time.sleep(1)
        failed = next((x for x in authz['challenges'] if x['type'] == 'http-01'), {})
        error = failed.get('error', {}); detail = error.get('detail', '')
        reached = error.get('type') == 'urn:ietf:params:acme:error:unauthorized' and (any(x in detail.lower() for x in ('invalid response', 'key authorization', 'expected'))
            or ('non-200 status code from http:' in detail.lower() and detail.endswith('returned 404')))
        receipt = {'runId': self.run, 'provider': provider, 'completed': reached, 'scope': 'Real CA HTTP01 network probe; deliberately absent token and no certificate issuance',
            'expectedAuthorizationStatus': 'invalid', 'actualAuthorizationStatus': authz['status'], 'errorType': error.get('type'), 'detail': detail, 'observedAt': time.time()}
        write_json(self.work / (provider.lower() + '-http-probe.json'), receipt)
        require(reached, 'Real CA could not confirm an HTTP response from the selected website; inspect the owned probe receipt')
        print(json.dumps({k: v for k, v in receipt.items() if k != 'detail'}))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--config', required=True); parser.add_argument('--action', choices=('start', 'status', 'cleanup', 'probe-http'), required=True)
    parser.add_argument('--provider', choices=('1Panel', 'BaoTa'))
    args = parser.parse_args()
    try:
        config = Path(args.config).absolute(); safe_directory(config)
        require(config.stat().st_size <= 65536, 'Fixture configuration exceeds budget')
        fixture = Fixture(json.loads(config.read_text()))
        if args.action == 'probe-http': fixture.probe_http(args.provider)
        else: getattr(fixture, args.action)()
        return 0
    except Exception as error:
        print(json.dumps({'completed': False, 'errorType': type(error).__name__, 'error': str(error)})); return 1


if __name__ == '__main__': raise SystemExit(main())
