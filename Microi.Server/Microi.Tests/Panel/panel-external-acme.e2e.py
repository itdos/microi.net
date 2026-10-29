#!/usr/bin/env python3
"""已有真实 BaoTa/1Panel 站点的外部 ACME 与主机重启后自动续期验收。

运行：python3 -B panel-external-acme.e2e.py --config <root600-json> --phase issue
然后 verify-deploy-rollback -> verify-scheduled -> checkpoint-reboot -> 操作者正常重启真实 VM -> verify-after-reboot。
本程序不重启主机、不创建站点/CA、不修改时钟/SQLite，不把协议模拟算成真实续期。

复用 panel-host-nginx.e2e.py 私有配置格式，但 work 必须是同一 run 的独立 external-acme 目录。
每个 sites[] 增加：
  "acme": {"directoryUrl":"https://<helper可达且SAN匹配的测试CA>/dir",
           "trustPemFile":"<本run目录内ACME HTTPS CA公钥PEM>",
           "rootCaFile":"<本run目录内叶证书签发根CA公钥PEM>",
           "maxCertificateLifetimeSeconds":600}
原 sites[].tls 的 address/port 用于真实 TLS/SNI 回读，caFile 必须等于 rootCaFile。
测试 CA 必须在 VM 重启期间保留账号和签发者状态；不能重启内存态 Pebble 后冒充同一个 CA。
最终 external-acme-receipt.json 交给 host runner 的 verify-external-acme；两 vendor 完成才 completed=true。
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import http.client
import importlib.util
import ipaddress
import json
import os
from pathlib import Path
import re
import ssl
import socket
import sys
import threading
import time
import urllib.parse
import uuid

_HOST_PATH = Path(__file__).with_name('panel-host-nginx.e2e.py')
_SPEC = importlib.util.spec_from_file_location('panel_host_nginx_acceptance', _HOST_PATH)
host = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(host)
require, safe_path, read_json, atomic_json, command = host.require, host.safe_path, host.read_json, host.atomic_json, host.command
PHASES = ('issue', 'verify-deploy-rollback', 'verify-scheduled', 'checkpoint-reboot', 'verify-after-reboot', 'cleanup')


def unix_time(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()


def selected_key(site):
    return site['provider'] + ':' + site['instanceId'] + ':' + site['siteId']


def bind_issue_operation(state, operation):
    """请求号负责幂等，操作号由服务端独立生成；先核对归属，再持久绑定真实操作号。"""
    request = state['issueRequest']
    require(isinstance(operation, dict) and operation.get('requestId') == request['requestId'],
            'Issue response belongs to a different request')
    operation_id = operation.get('id')
    require(isinstance(operation_id, str) and re.fullmatch(r'[a-f0-9]{32}', operation_id), 'Invalid issue operation ID')
    resource_id = 'host-nginx-' + host.sha(request['instanceId'].encode())[:24]
    require(operation.get('action') == 'ExternalAcmeIssue' and operation.get('resourceId') == resource_id,
            'Issue response belongs to a different action or instance')
    require(state.get('issueOperationId') in (None, operation_id), 'Issue replay returned a different operation')
    state['issueOperationId'] = operation_id
    return operation_id


def select_automatic_renewal(operation, registration, before, boot):
    """只接受持久调度器自己的真实任务；手工申请、旧成功回执或相同证书不能替代重启后续期。"""
    return (operation.get('state') == 'Succeeded' and operation.get('action') == 'ExternalAcmeRenew'
            and operation.get('actor') == 'scheduler' and operation.get('resourceId') == registration['resourceId']
            and operation.get('id') != before['issueOperationId']
            and unix_time(operation['updated']) >= boot['bootStartedAt']
            and registration.get('autoRenew') is True)


class ExternalAcmeRunner:
    def __init__(self, config, phase, timeout):
        require(os.name == 'posix' and os.geteuid() == 0, 'Run only as root inside the owned Linux VM')
        self.config, self.phase_name, self.timeout = config, phase, timeout
        self.run = config['runId']
        require(re.fullmatch(r'[a-z][a-z0-9-]{5,80}', self.run), 'Invalid run ID')
        require(safe_path('/var/lib/panel-acceptance-id', private=True).read_text().strip() == self.run, 'Exact lab marker mismatch')
        self.parent = Path('/var/lib/panel-acceptance') / self.run
        self.work = Path(config['work'])
        require(self.work.is_absolute() and self.work.parent == self.parent and self.work.name == 'external-acme', 'Use the exact owned external-acme directory')
        safe_path(self.parent, private=True, directory=True)
        for ancestor in [*reversed(self.parent.parents), self.parent]:
            info = ancestor.lstat()
            require(info.st_uid == 0 and info.st_mode & 0o022 == 0, 'Evidence ancestor is writable by another user')
        owner = {'runId': self.run, 'purpose': 'real-external-acme-acceptance'}
        if not self.work.exists():
            self.work.mkdir(mode=0o700); atomic_json(self.work / 'owner.json', owner)
        safe_path(self.work, private=True, directory=True)
        require(read_json(self.work / 'owner.json') == owner, 'Evidence directory has a different owner')
        self.path = self.work / 'external-acme-private-state.json'
        self.report_path = self.work / 'external-acme-report.json'
        self.receipt_path = self.work / 'external-acme-receipt.json'
        self.candidate = config['candidate']; self.runner_hash = host.sha(Path(__file__).read_bytes())
        require(re.fullmatch(r'sha256:[a-f0-9]{64}', self.candidate['imageId']), 'Exact candidate image ID required')
        require(all(host.SHA.fullmatch(self.candidate[x]) for x in ('sourceHash', 'hostAdapterSha256')), 'Candidate hashes required')
        self.host_runner_hash = host.sha(_HOST_PATH.read_bytes())
        self.state = read_json(self.path) if self.path.exists() else {'runId': self.run, 'candidate': self.candidate, 'runnerSha256': self.runner_hash, 'hostRunnerSha256': self.host_runner_hash, 'sites': {}}
        require(self.state['runId'] == self.run and self.state['candidate'] == self.candidate and self.state['runnerSha256'] == self.runner_hash
                and self.state['hostRunnerSha256'] == self.host_runner_hash, 'Candidate or either runner changed; retain old evidence in its owned directory')
        self.report = read_json(self.report_path) if self.report_path.exists() else {'runId': self.run, 'candidate': self.candidate, 'phases': {}}
        self.phase = {'completed': False, 'startedAt': time.time(), 'passed': [], 'failure': None}
        self.report['phases'].setdefault(phase, []).append(self.phase)
        sites = config['sites']
        require(isinstance(sites, list) and 1 <= len(sites) <= 2 and len({s['provider'] for s in sites}) == len(sites), 'Select explicit distinct vendor fixtures')
        require(set(self.state['sites']).issubset({selected_key(s) for s in sites}), 'Previously selected sites cannot be silently dropped')
        self.save()
        self.api = host.PanelClient(config.get('panelRoot', '/microi/panel'), self.raw)
        name = config.get('panelContainer', 'microi-panel')
        require(re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}', name), 'Invalid selected Panel container')
        item = json.loads(command('docker', 'inspect', name))[0]
        require(item['State']['Running'] and item['Image'] == self.candidate['imageId'], 'Running Panel differs from candidate')
        require(host.sha(safe_path('/opt/microi-auth-guard/nginx_adapter.py').read_bytes()) == self.candidate['hostAdapterSha256'], 'Installed adapter differs from candidate')
        require(command('systemctl', 'is-active', 'microi-auth-guard.service') == 'active', 'Real host service is not active')
        self.api.call('/ready')
        self.boot = {'bootId': Path('/proc/sys/kernel/random/boot_id').read_text().strip(),
                     'bootStartedAt': time.time() - float(Path('/proc/uptime').read_text().split()[0])}
        self.phase['runtime'] = {**self.boot, 'panelContainerId': item['Id'], 'imageId': item['Image']}
        self.save()

    def save(self):
        atomic_json(self.path, self.state); atomic_json(self.report_path, self.report)

    def raw(self, path, status, body):
        # 同一请求路径只保留最后响应，轮询不能无限累积日志；终态/证书事实另存持久检查点。
        atomic_json(self.work / ('raw-' + host.sha(path.encode())[:24] + '.json'),
                    {'path': path, 'status': status, 'body': body, 'observedAt': time.time()})

    def passed(self, title, evidence=None):
        self.phase['passed'].append({'check': title, 'evidence': evidence or {}}); self.save(); print('PASS ' + title, flush=True)

    def ca_file(self, path):
        value = safe_path(path)
        require(value.is_relative_to(self.parent) and value.stat().st_size <= 65536, 'CA public certificate must belong to this exact lab')
        return value

    def selected(self, site):
        require(site['provider'] in ('1Panel', 'BaoTa') and re.fullmatch(r'[a-z0-9.-]+\.test', site['domain']), 'Only explicit isolated vendor sites accepted')
        acme = site['acme']; uri = urllib.parse.urlsplit(acme['directoryUrl'])
        require(uri.scheme == 'https' and uri.hostname and not uri.username and not uri.password and not uri.fragment, 'ACME requires an explicit trusted HTTPS directory')
        require(60 <= acme['maxCertificateLifetimeSeconds'] <= 600, 'Use a bounded short-lived real test CA certificate')
        require(self.ca_file(site['tls']['caFile']) == self.ca_file(acme['rootCaFile']), 'TLS probe and issuer trust roots differ')
        trusted = self.ca_file(acme['trustPemFile']); issuer = self.ca_file(acme['rootCaFile'])
        binding = host.sha(json.dumps({'site': site, 'trustSha256': host.sha(trusted.read_bytes()), 'issuerSha256': host.sha(issuer.read_bytes())}, sort_keys=True).encode())
        key = selected_key(site); current_state = self.state['sites'].setdefault(key, {'binding': binding})
        require(current_state['binding'] == binding, 'Selected site, CA, or trust changed after the checkpoint')
        instances = self.api.host('instances'); require(instances['protocol'] == 1, 'Host protocol mismatch')
        rows = [x for x in instances['instances'] if x['id'] == site['instanceId']]
        require(len(rows) == 1 and rows[0]['provider'] == site['provider'] and rows[0]['attached'] is True, 'The actual vendor instance must be explicitly attached first')
        route = 'instances/' + urllib.parse.quote(site['instanceId'], safe='') + '/sites/' + urllib.parse.quote(site['siteId'], safe='') + '/configuration'
        config = self.api.host(route)
        require(config['fingerprint'] == rows[0]['fingerprint'] and config['sha256'] == host.sha(config['content'].encode()), 'Actual configuration identity/hash mismatch')
        require(config['domains'] == [site['domain']], 'The selected fixture must contain exactly its explicit test domain')
        return current_state, config

    def registration(self, site):
        rows = [x for x in self.api.call('/ops-api/panel/acme') if x['target'] == 'External' and x['instanceId'] == site['instanceId'] and x['siteId'] == site['siteId']]
        require(len(rows) <= 1, 'Duplicate persistent external registration')
        return rows[0] if rows else None

    def business(self, site, secure=False):
        target = site['tls'] if secure else site['http']; address = str(ipaddress.ip_address(target['address']))
        require(1 <= target['port'] <= 65535, 'Invalid explicit fixture port')
        path = site['http'].get('path', '/')
        require(path.startswith('/') and not any(ord(c) < 32 for c in path), 'Invalid business path')
        connection = host.ProbeTLS(address, target['port'], site['domain'], ssl.create_default_context(cafile=str(self.ca_file(site['acme']['rootCaFile'])))) if secure else http.client.HTTPConnection(address, target['port'], timeout=12)
        try:
            connection.request('GET', path, headers={'Host': site['domain']})
            leaf = connection.sock.getpeercert(binary_form=True) if secure else None
            details = connection.sock.getpeercert() if secure else None
            response = connection.getresponse(); body = response.read(256 * 1024 + 1)
            require(len(body) <= 256 * 1024 and response.status == site['http']['status'], 'Business response failed or exceeded its budget')
            require(host.sha(body) == site['http']['bodySha256'] and self.run.encode() in body, 'Original vendor business bytes changed')
            result = {'status': response.status, 'bodySha256': host.sha(body)}
            if secure:
                lifetime = ssl.cert_time_to_seconds(details['notAfter']) - ssl.cert_time_to_seconds(details['notBefore'])
                require(30 <= lifetime <= site['acme']['maxCertificateLifetimeSeconds'], 'The real issuer did not supply the selected short-lived certificate')
                result.update(certificateSha256=host.sha(leaf), certificateSha1=hashlib.sha1(leaf).hexdigest().upper(), lifetimeSeconds=lifetime)
            return result
        finally:
            connection.close()

    def certificate(self, registration, site):
        rows = [x for x in self.api.call('/ops-api/panel/certificates') if x['id'] == registration['id']]
        require(len(rows) == 1, 'Actual certificate ledger entry missing')
        tls = self.business(site, True)
        require(rows[0]['thumbprint'].replace(':', '').upper() == tls['certificateSha1'], 'Actual TLS certificate differs from Panel ledger')
        return rows[0], tls

    def control_body(self, site, config, **extra):
        return {'instanceId': site['instanceId'], 'siteId': site['siteId'], 'expectedFingerprint': config['fingerprint'],
                'expectedSha256': config['sha256'], 'requestId': str(uuid.uuid4()), 'confirm': site['siteId'], **extra}

    def guard_certificate(self, body):
        class UnixConnection(http.client.HTTPConnection):
            def connect(connection):
                connection.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM); connection.sock.settimeout(120)
                connection.sock.connect('/run/microi-auth-guard/control.sock')
        connection = UnixConnection('localhost', timeout=120); raw = json.dumps(body).encode()
        try:
            connection.request('POST', '/nginx/certificate', raw, {'Content-Type': 'application/json', 'Content-Length': str(len(raw))})
            response = connection.getresponse(); raw = response.read(1024 * 1024 + 1)
            require(len(raw) <= 1024 * 1024, 'Host certificate receipt exceeded budget')
            value = json.loads(raw); self.raw('/nginx/certificate', response.status, value); return response.status, value
        finally: connection.close()

    def restore_fault(self, site, state):
        fault = state.get('rollbackFixture')
        if not fault or fault.get('restored'): return
        _, current = self.selected(site)
        # 只恢复自身精确夹具版本；CAS 冲突时保留现场，不能覆盖外部编辑或强行恢复旧续期策略。
        require(current['sha256'] in (fault['original']['sha256'], fault['testSha256'], fault.get('ownedUnexpectedSha256')),
                'Rollback fixture changed externally; preserve it for review')
        if current['sha256'] != fault['original']['sha256']:
            self.api.host('configuration', self.control_body(site, current, requestId=fault['restoreRequestId'], content=fault['original']['content']))
        _, restored = self.selected(site); require(restored['sha256'] == fault['original']['sha256'], 'Fixture configuration restoration not confirmed')
        _, tls = self.certificate(self.registration(site), site)
        require(tls['certificateSha256'] == fault['beforeTls']['certificateSha256'], 'Fixture restoration changed the original certificate')
        registration = self.registration(site)
        require(registration['revision'] == fault['pausedRevision'] and registration['autoRenew'] is False, 'Renewal policy changed externally during the owned fixture')
        self.api.call('/ops-api/panel/acme/' + registration['id'] + '/policy', {'revision': registration['revision'], 'enabled': True, 'confirm': registration['id']})
        require(self.registration(site)['autoRenew'] is True, 'Automatic renewal restoration not confirmed')
        fault.update(restored=True, restoredAt=time.time()); self.save()
        if state.get('rollbackPolicy'):
            state['rollbackPolicy']['restored'] = True; self.save()

    def verify_deploy_rollback(self, site, state):
        try: self._verify_deploy_rollback(site, state)
        finally:
            # 在生成夹具之前就可能失败；暂停也必须在 finally 内按原 CAS 回读恢复，不能遗漏此早期阶段。
            self.restore_fault(site, state)
            policy = state.get('rollbackPolicy')
            if policy and not policy.get('restored'):
                require(policy.get('pausedRevision'), 'Policy response was unknown; preserve the private pause checkpoint for recovery')
                current = self.registration(site)
                require(current['revision'] == policy['pausedRevision'] and current['autoRenew'] is False, 'Pause policy changed externally; do not overwrite it')
                self.api.call('/ops-api/panel/acme/' + current['id'] + '/policy', {'revision': current['revision'], 'enabled': True, 'confirm': current['id']})
                require(self.registration(site)['autoRenew'] is True, 'Pause restoration not confirmed')
                policy['restored'] = True; self.save()

    def _verify_deploy_rollback(self, site, state):
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.x509.oid import NameOID
        self.restore_fault(site, state)
        registration = self.registration(site); require(registration and registration['autoRenew'] is True, 'Issue first with automatic renewal enabled')
        state['rollbackPolicy'] = {'id': registration['id'], 'originalRevision': registration['revision'], 'restored': False}; self.save()
        paused = self.api.call('/ops-api/panel/acme/' + registration['id'] + '/policy', {'revision': registration['revision'], 'enabled': False, 'confirm': registration['id']})
        state['rollbackPolicy']['pausedRevision'] = paused['revision']; self.save()
        # 暂停仅本测试站点，等已有任务退出，再取真实配置快照；不改调度器时间或数据库。
        deadline = time.monotonic() + 120
        while self.api.call('/ops-api/panel/operations/' + paused['lastOperationId'])['state'] in ('Queued', 'Running'):
            require(time.monotonic() < deadline, 'Existing certificate operation did not finish after policy pause'); time.sleep(1)
        _, current = self.selected(site); _, before_tls = self.certificate(paused, site)
        # 复用已经校验摘要的宿主 Nginx 解析器；它只负责定位文本，实际成功/失败仍以独立网络握手为准。
        sys.path.insert(0, '/opt/microi-auth-guard')
        try:
            adapter_spec = importlib.util.spec_from_file_location('owned_nginx_parser', '/opt/microi-auth-guard/nginx_adapter.py')
            adapter = importlib.util.module_from_spec(adapter_spec); adapter_spec.loader.exec_module(adapter)
        finally: sys.path.pop(0)
        replacements = []; tls_servers = [node for node in adapter.parse_config(current['content']) if node['name'] == 'server' and adapter.listen_ports(node, tls=True)]
        require(tls_servers, 'The issued fixture has no actual TLS server')
        for server in tls_servers:
            for node in server['children']:
                if node['name'] in ('ssl_protocols', 'ssl_ciphers'): replacements.append((node['start'], node['end'], ''))
            replacements.append((server['close'], server['close'], '\n    ssl_protocols TLSv1.2;\n    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256;\n'))
        text = adapter.edit_spans(current['content'], replacements)
        state['rollbackFixture'] = {'original': current, 'testSha256': host.sha(text.encode()), 'beforeTls': before_tls,
            'pausedRevision': paused['revision'], 'restoreRequestId': str(uuid.uuid4()), 'restored': False}
        self.save(); observed_errors = []; stop = threading.Event(); thread = None
        try:
            self.api.host('configuration', self.control_body(site, current, content=text))
            _, restricted = self.selected(site); restricted_tls = self.business(site, True)
            require(restricted_tls['certificateSha256'] == before_tls['certificateSha256'], 'Old EC certificate is not usable with the explicit test cipher')
            key = rsa.generate_private_key(public_exponent=65537, key_size=2048); now = datetime.datetime.now(datetime.timezone.utc)
            name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, site['domain'])])
            certificate = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
                .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=1)).not_valid_after(now + datetime.timedelta(hours=1))
                .add_extension(x509.SubjectAlternativeName([x509.DNSName(site['domain'])]), False).sign(key, hashes.SHA256()))
            request = self.control_body(site, restricted, certificatePem=certificate.public_bytes(serialization.Encoding.PEM).decode(),
                privateKeyPem=key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode())
            state['rollbackFixture']['requestId'] = request['requestId']; self.save()
            def observe():
                while not stop.is_set():
                    try: self.business(site, True)
                    except ssl.SSLError as error:
                        if len(observed_errors) < 100: observed_errors.append({'reason': error.reason, 'observedAt': time.time()})
                    except Exception: pass
                    stop.wait(.02)
            thread = threading.Thread(target=observe, daemon=True); thread.start()
            status, receipt = self.guard_certificate(request)
            stop.set(); thread.join(timeout=15)
            require(not thread.is_alive(), 'Independent TLS observer did not stop within its bounded timeout')
            # 若特定原厂默认 TLS 策略使故障未触发，仍只允许回收本请求已确认写入的版本，不能留下测试证书。
            if status == 200 and all(receipt.get(field) == request[field] for field in ('requestId', 'instanceId', 'siteId')) and host.SHA.fullmatch(receipt.get('configSha256', '')):
                state['rollbackFixture']['ownedUnexpectedSha256'] = receipt['configSha256']; self.save()
            require(status == 503 and '原服务回读' in json.dumps(receipt, ensure_ascii=False), 'Actual certificate deployment did not confirm rollback of the old service')
            _, after = self.selected(site); after_tls = self.business(site, True)
            require(after['sha256'] == restricted['sha256'] and after_tls['certificateSha256'] == before_tls['certificateSha256'], 'Old TLS/configuration was not restored')
            history = self.api.host('instances/' + site['instanceId'] + '/sites/' + site['siteId'] + '/history')
            require(any(x['id'] == 'certificate-' + request['requestId'] and x['state'] == 'rolledBack' for x in history['revisions']), 'Persistent host rollback record missing')
            require(any(any(value in item['reason'] for value in ('HANDSHAKE_FAILURE', 'NO_SHARED_CIPHER')) for item in observed_errors),
                    'No independent cipher handshake failure observed; do not claim post-deployment TLS rollback')
            state['deployRollback'] = {'completed': True, 'scope': 'Real host certificate transaction, not an ExternalAcmeIssue operation',
                'requestId': request['requestId'], 'status': status, 'before': before_tls, 'after': after_tls, 'configurationSha256': after['sha256'],
                'handshakeFailures': list(observed_errors), 'observedAt': time.time()}
            self.passed(site['provider'] + ': actual incompatible RSA deployment fails and independently restores the old EC TLS, configuration and business', state['deployRollback'])
        finally:
            stop.set()
            if thread: thread.join(timeout=15)
            self.restore_fault(site, state)

    def terminal(self, operation_id):
        deadline = time.monotonic() + self.timeout
        while time.monotonic() < deadline:
            operation = self.api.call('/ops-api/panel/operations/' + operation_id)
            if operation['state'] == 'Succeeded': return operation
            require(operation['state'] != 'Failed', 'External issue failed; original operation and private response were retained')
            time.sleep(2)
        raise AssertionError('External issue timed out; do not submit a new operation blindly')

    def issue(self, site, state, config):
        existing = self.registration(site)
        if 'issueRequest' not in state:
            require(existing is None, 'An existing external registration is not owned by this runner')
            request = {'requestId': str(uuid.uuid4()), 'instanceId': site['instanceId'], 'siteId': site['siteId'],
                       'expectedFingerprint': config['fingerprint'], 'expectedSha256': config['sha256'], 'domains': config['domains'],
                       'email': 'panel-acceptance@example.test', 'provider': 'Custom', 'directoryUrl': site['acme']['directoryUrl'],
                       'rootCertificatePem': self.ca_file(site['acme']['trustPemFile']).read_text(), 'autoRenew': True,
                       'acceptTerms': True, 'expectedAcmeRevision': '', 'confirm': site['siteId']}
            state['issueRequest'] = request; self.save()
        self.business(site)
        operation = self.api.call('/ops-api/panel/acme/external', state['issueRequest'], 202)
        operation_id = bind_issue_operation(state, operation); self.save()
        operation = self.terminal(operation_id)
        require(operation['action'] == 'ExternalAcmeIssue', 'Unexpected operation action')
        registration = self.registration(site); require(registration and registration['autoRenew'] is True, 'Automatic renewal was not persisted')
        cert, tls = self.certificate(registration, site)
        state.setdefault('firstCertificateSha256', tls['certificateSha256']); state['registrationId'] = registration['id']
        state['issued'] = {'operation': operation, 'registration': registration, 'certificate': cert, 'tls': tls, 'boot': self.boot}
        self.passed(site['provider'] + ': real ExternalAcmeIssue and strict CA/SNI agree with the certificate ledger and original business', tls)

    def checkpoint(self, site, state):
        require(state.get('scheduled'), 'Normal scheduler rotation must finish before reboot checkpoint')
        require(state.get('deployRollback', {}).get('completed') and state.get('rollbackFixture', {}).get('restored'), 'Actual deployment rollback and fixture restoration must finish first')
        registration = self.registration(site); require(registration and registration['autoRenew'] is True, 'Automatic renewal must stay enabled')
        cert, tls = self.certificate(registration, site)
        state['beforeReboot'] = {'boot': self.boot, 'registration': registration, 'certificate': cert, 'tls': tls, 'observedAt': time.time()}
        # 新的重启验收周期必须作废旧周期证据；失败或中断时不得留下 completed=true 的旧回执。
        state.pop('renewed', None); self.save(); self.receipt()
        self.passed(site['provider'] + ': durable automatic renewal checkpoint captured before normal host reboot', {'nextCheck': registration['nextCheck'], **tls})

    def verify_scheduled(self, site, state):
        require(state.get('issued'), 'Issue must finish before scheduler verification')
        require(not state.get('beforeReboot') or state['beforeReboot']['boot']['bootId'] == self.boot['bootId'], 'Do not replace pre-reboot scheduler evidence after a new boot')
        deadline = time.monotonic() + self.timeout
        earliest = {'bootStartedAt': unix_time(state['issued']['operation']['updated'])}
        while time.monotonic() < deadline:
            registration = self.registration(site)
            require(registration and registration['id'] == state['registrationId'] and registration['autoRenew'] is True, 'Automatic renewal registration changed')
            operation = self.api.call('/ops-api/panel/operations/' + registration['lastOperationId'])
            if select_automatic_renewal(operation, registration, state, earliest):
                cert, tls = self.certificate(registration, site)
                if tls['certificateSha256'] != state['firstCertificateSha256']:
                    state['scheduled'] = {'operation': operation, 'registration': registration, 'certificate': cert, 'tls': tls, 'observedAt': time.time(), 'boot': self.boot}
                    self.passed(site['provider'] + ': the real persistent scheduler rotates the issued certificate without a manual renewal trigger', tls)
                    return
            time.sleep(3)
        raise AssertionError('No real scheduled certificate rotation within the bounded wait')

    def verify_after_reboot(self, site, state):
        before = state.get('beforeReboot'); require(before and before['boot']['bootId'] != self.boot['bootId'], 'Actual VM boot ID must change after the checkpoint')
        require(before['observedAt'] < self.boot['bootStartedAt'], 'Checkpoint was not recorded before this host boot')
        deadline = time.monotonic() + self.timeout
        while time.monotonic() < deadline:
            registration = self.registration(site)
            require(registration and registration['id'] == state['registrationId'] and registration['autoRenew'] is True, 'Restart lost or paused the persistent external registration')
            operation = self.api.call('/ops-api/panel/operations/' + registration['lastOperationId'])
            if select_automatic_renewal(operation, registration, state, self.boot):
                cert, tls = self.certificate(registration, site)
                if tls['certificateSha256'] not in (before['tls']['certificateSha256'], state['firstCertificateSha256'], state['scheduled']['tls']['certificateSha256']) and operation['id'] != state['scheduled']['operation']['id']:
                    state['renewed'] = {'operation': operation, 'registration': registration, 'certificate': cert, 'tls': tls, 'observedAt': time.time(), 'boot': self.boot}
                    self.passed(site['provider'] + ': real scheduler rotates the certificate after normal VM reboot without a manual renewal trigger', tls)
                    return
            time.sleep(3)
        raise AssertionError('No actual scheduler-issued certificate rotation after host reboot within the bounded wait')

    def receipt(self):
        rows = []
        for site in self.config['sites']:
            state = self.state['sites'][selected_key(site)]
            if 'renewed' not in state or 'scheduled' not in state: continue
            renewal = state['renewed']; before = state['beforeReboot']; operation = renewal['operation']; registration = renewal['registration']
            rows.append({'provider': site['provider'], 'instanceId': site['instanceId'], 'siteId': site['siteId'], 'completed': True,
                         'issueOperationId': state['issueOperationId'], 'renewOperationId': operation['id'],
                         'firstCertificateSha256': state['firstCertificateSha256'], 'renewedCertificateSha256': renewal['tls']['certificateSha256'],
                         'hostDeploymentRollback': state.get('deployRollback'),
                         'scheduledRenewal': {'operationId': state['scheduled']['operation']['id'], 'actor': state['scheduled']['operation']['actor'],
                         'action': state['scheduled']['operation']['action'], 'certificateSha256': state['scheduled']['tls']['certificateSha256'],
                         'operationUpdatedAt': unix_time(state['scheduled']['operation']['updated']), 'observedAt': state['scheduled']['observedAt']},
                         'afterHostReboot': True, 'automaticRenewal': {'enabled': True, 'actor': operation['actor'], 'action': operation['action'],
                         'operationCreatedAt': unix_time(operation['created']), 'operationUpdatedAt': unix_time(operation['updated']),
                         'registrationId': registration['id'], 'registrationRevision': registration['revision'],
                         'scheduledNextCheckBeforeReboot': unix_time(before['registration']['nextCheck']),
                         'bootIdBefore': before['boot']['bootId'], 'bootIdAfter': renewal['boot']['bootId'],
                         'bootStartedAt': renewal['boot']['bootStartedAt'], 'observedAt': renewal['observedAt']}})
        result = {'runId': self.run, 'candidateImageId': self.candidate['imageId'], 'sourceHash': self.candidate['sourceHash'],
                  'hostAdapterSha256': self.candidate['hostAdapterSha256'], 'runnerSha256': self.runner_hash,
                  'hostRunnerSha256': self.host_runner_hash,
                  'completed': {row['provider'] for row in rows} == {'BaoTa', '1Panel'}, 'sites': rows,
                  'scope': 'Actual vendor websites with a real isolated test CA; not public Let\'s Encrypt issuance', 'observedAt': time.time()}
        atomic_json(self.receipt_path, result)

    def execute(self):
        for site in self.config['sites']:
            state, current = self.selected(site)
            if self.phase_name == 'issue': self.issue(site, state, current)
            elif self.phase_name == 'verify-deploy-rollback': self.verify_deploy_rollback(site, state)
            elif self.phase_name == 'verify-scheduled': self.verify_scheduled(site, state)
            elif self.phase_name == 'checkpoint-reboot': self.checkpoint(site, state)
            elif self.phase_name == 'verify-after-reboot': self.verify_after_reboot(site, state)
            elif self.phase_name == 'cleanup':
                self.restore_fault(site, state)
                require(state.get('issued'), 'Cleanup cannot claim an unissued external registration')
                registration = self.registration(site); require(registration and registration['id'] == state['registrationId'], 'Cleanup registration identity changed')
                if registration['autoRenew']:
                    self.api.call('/ops-api/panel/acme/' + registration['id'] + '/policy', {'revision': registration['revision'], 'enabled': False, 'confirm': registration['id']})
                require(self.registration(site)['autoRenew'] is False, 'Owned automatic renewal cleanup did not persist')
                self.passed(site['provider'] + ': cleanup pauses only this runner owned registration with CAS')
        self.phase.update(completed=True, finishedAt=time.time()); self.save()
        # 独立 host gate 已绑定最终文件原始字节摘要；清理只记录暂停结果，不重写先前验收回执。
        if self.phase_name != 'cleanup': self.receipt()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--config', required=True); parser.add_argument('--phase', choices=PHASES, required=True)
    parser.add_argument('--timeout', type=int, default=900)
    args = parser.parse_args(); runner = None
    try:
        require(60 <= args.timeout <= 1800, 'Bounded real CA timeout must be 60 to 1800 seconds')
        runner = ExternalAcmeRunner.__new__(ExternalAcmeRunner)
        runner.__init__(read_json(args.config), args.phase, args.timeout); runner.execute(); return 0
    except Exception as error:
        if runner is not None and hasattr(runner, 'phase'):
            runner.phase.update(failure={'type': type(error).__name__, 'message': str(error)}, finishedAt=time.time()); runner.save()
        print(json.dumps({'completed': False, 'phase': args.phase, 'errorType': type(error).__name__, 'error': str(error)})); return 1


if __name__ == '__main__': raise SystemExit(main())
