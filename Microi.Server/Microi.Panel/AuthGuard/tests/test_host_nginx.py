"""固定宿主动作的跨平台回归；网络、Docker、服务重载均为受控替身，真实供应商验收另跑。"""
import copy
import json
import os
import pathlib
import stat
import sys
import tempfile
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import nginx_adapter as nginx
from store import GuardError

BASE = 'server { listen 80; server_name example.test; root /site; location / { try_files $uri =404; } }'


class FakeTransport:
    def __init__(self, folder):
        self.raw = BASE.encode(); self.folder = pathlib.Path(folder); self.tests = 0; self.reloads = 0; self.writes = 0
        self.fail_test = 0; self.fail_reload = 0; self.external = False; self.unmapped = False; self.tokens = {}; self.directories = {}
        (self.folder/'site').mkdir();(self.folder/'conf.d').mkdir()
    def files(self, root): return ['example.conf']
    def read(self, path): return self.raw
    def replace(self, path, expected, content, operation):
        if nginx.digest(self.raw) != expected: raise GuardError('CAS', 409)
        self.raw = content; self.writes += 1
    def test(self):
        self.tests += 1
        if self.external: self.raw = b'external changes'; raise GuardError('external', 422)
        if self.fail_test: self.fail_test -= 1; raise GuardError('syntax', 422)
    def reload(self):
        self.reloads += 1
        if self.fail_reload: self.fail_reload -= 1; raise GuardError('worker not seen', 503)
    def host_path(self, path):
        if self.unmapped and path == '/usr/share/nginx/html': raise GuardError('not bind', 409)
        return str(self.folder / pathlib.PurePosixPath(path).name)
    def create_owned(self, path, marker, files=None):
        old = self.directories.get(path)
        current = (marker, files or {})
        if old is not None and old != current: raise GuardError('owner mismatch', 409)
        self.directories[path] = current
        pathlib.Path(self.host_path(path)).mkdir(exist_ok=True)
    def challenge_token(self, directory, token, value=None):
        if value is None: self.tokens.pop(token, None)
        else: self.tokens[token] = value


class HostNginxTests(unittest.TestCase):
    def setUp(self):
        root = pathlib.Path(__file__).resolve().parents[4] / '.tmp'; root.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='panel-host-nginx-unit-', dir=root)
        self.addCleanup(self.temp.cleanup)
        self.transport = FakeTransport(self.temp.name)
        self.instance = {'id':'onepanel-test','fingerprint':'a'*64,'kind':'docker','configRoot':'/etc/nginx/conf.d','containerId':'c'*64,'mounts':[]}
        self.host = nginx.HostNginx(self.temp.name, discover=lambda:([copy.deepcopy(self.instance)],[]), transport=lambda _:self.transport)
        self.host.endpoint_addresses = lambda _,**options:['127.0.0.1']
        self.site = nginx.digest(b'onepanel-test\0example.conf')[:32]
        self.attach()
    def attach(self):
        return self.host.dispatch('POST','/nginx/attach',{'instanceId':self.instance['id'],'expectedFingerprint':self.instance['fingerprint'],'confirm':self.instance['id']})
    def body(self, **extra):
        return {'instanceId':self.instance['id'],'siteId':self.site,'expectedFingerprint':self.instance['fingerprint'],
                'expectedSha256':nginx.digest(self.transport.raw),'requestId':str(uuid.uuid4()),'confirm':self.site,**extra}
    def http(self, status=200):
        transport = self.transport
        class Connection:
            def __init__(self,*_,**__): pass
            def request(self,method,path,headers): self.token=path.rsplit('/',1)[-1]
            def getresponse(self): return SimpleNamespace(status=status,read=lambda _:transport.tokens.get(self.token,b''))
            def close(self): pass
        return patch.object(nginx.http.client,'HTTPConnection',Connection)
    def prepare(self, body=None):
        with self.http(): return self.host.dispatch('POST','/nginx/http01',body or self.body(expectedDomains=['example.test']))
    def certificate(self, body=None, probe_error=None):
        body = body or self.body(certificatePem='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----',privateKeyPem='fixture test private key')
        with patch.object(nginx.ssl,'SSLContext') as context,patch.object(nginx.ssl._ssl,'_test_decode_cert',return_value={'notAfter':'Jan  1 00:00:00 2099 GMT','notBefore':'Jan  1 00:00:00 2020 GMT','subjectAltName':[('DNS','example.test')]}),patch.object(nginx.ssl,'PEM_cert_to_DER_cert',return_value=b'unit leaf'),patch.object(nginx,'tls_certificate',return_value='a'*64,create=True),patch.object(nginx,'tls_leaf',side_effect=probe_error),patch.object(nginx,'tls_http_readback',return_value={'status':200}):
            return self.host.dispatch('POST','/nginx/certificate',body)

    def test_discovery_protocol_and_snapshot_domains(self):
        self.assertEqual(1,self.host.dispatch('GET','/nginx/instances',{})['protocol'])
        result=self.host.dispatch('GET',f'/nginx/config?instanceId={self.instance["id"]}&siteId={self.site}',{})
        self.assertEqual(['example.test'],result['domains']);self.assertEqual(nginx.digest(self.transport.raw),result['sha256'])
    def test_attach_requires_current_fingerprint(self):
        with self.assertRaises(GuardError): self.host.dispatch('POST','/nginx/attach',{'instanceId':self.instance['id'],'confirm':self.instance['id']})
    def test_write_requires_explicit_attachment(self):
        self.host.save('attachments.json',{})
        with self.assertRaises(GuardError): self.host.transaction(self.body(content=BASE+'\n# changed'))
        self.assertEqual(0,self.transport.writes)
    def test_stale_config_does_not_write(self):
        with self.assertRaises(GuardError): self.host.transaction(self.body(content=BASE+'\n# changed',expectedSha256='f'*64))
        self.assertEqual(0,self.transport.writes)
    def test_wrong_site_confirmation_does_not_write(self):
        with self.assertRaises(GuardError): self.host.transaction(self.body(content=BASE,confirm='wrong'))
    def test_success_has_backup_and_idempotent_readback(self):
        body=self.body(content=BASE+'\n# changed');first=self.host.transaction(body);second=self.host.transaction(body)
        self.assertEqual(first,second);self.assertEqual(1,self.transport.writes)
        record=self.host.load('operation-'+body['requestId']+'.json');self.assertEqual('succeeded',record['state'])
    def test_request_id_different_content_rejected(self):
        body=self.body(content=BASE+'\n# changed');self.host.transaction(body)
        with self.assertRaises(GuardError): self.host.transaction(body|{'content':BASE+'\n# other'})
    def test_completed_request_external_change_rejected(self):
        body=self.body(content=BASE+'\n# changed');self.host.transaction(body);self.transport.raw=BASE.encode()
        with self.assertRaises(GuardError): self.host.transaction(body)
    def test_syntax_failure_restores_then_same_request_retries(self):
        body=self.body(content=BASE+'\n# changed');self.transport.fail_test=1
        with self.assertRaises(GuardError): self.host.transaction(body)
        self.assertEqual(BASE.encode(),self.transport.raw)
        self.assertTrue(self.host.transaction(body)['reloaded']);self.assertEqual(2,self.host.load('operation-'+body['requestId']+'.json')['attempts'])
    def test_reload_failure_restores_original(self):
        self.transport.fail_reload=1
        with self.assertRaises(GuardError):self.host.transaction(self.body(content=BASE+'\n# changed'))
        self.assertEqual(BASE.encode(),self.transport.raw);self.assertEqual(2,self.transport.reloads)
    def test_external_change_is_never_rolled_over(self):
        self.transport.external=True
        with self.assertRaises(GuardError):self.host.transaction(self.body(content=BASE+'\n# changed'))
        self.assertEqual(b'external changes',self.transport.raw);self.assertEqual(1,self.transport.writes)
    def test_rolled_back_retry_rejects_external_change(self):
        body=self.body(content=BASE+'\n# changed');self.transport.fail_test=1
        with self.assertRaises(GuardError):self.host.transaction(body)
        self.transport.raw=(BASE+'\n# somebody else').encode()
        with self.assertRaises(GuardError):self.host.transaction(body)
    def test_rollback_backup_cannot_cross_site(self):
        body=self.body(content=BASE+'\n# changed');self.host.transaction(body)
        with self.assertRaises(GuardError):self.host.dispatch('POST','/nginx/rollback',self.body(revisionId=body['requestId'],siteId='b'*32))
    def test_rollback_restores_saved_bytes(self):
        body=self.body(content=BASE+'\n# changed');self.host.transaction(body)
        result=self.host.dispatch('POST','/nginx/rollback',self.body(revisionId=body['requestId']))
        self.assertEqual(nginx.digest(BASE.encode()),result['sha256']);self.assertEqual(BASE.encode(),self.transport.raw)
    def test_inline_root_alias_and_script_bypass_rejected(self):
        for directive in ('root /etc;','alias /root;','content_by_lua "os.execute(1)";','ssl_password_file /etc/shadow;','grpc_ssl_certificate_key /etc/shadow;'):
            with self.subTest(directive=directive),self.assertRaises(GuardError):nginx.validate_edit(BASE,BASE.replace('listen 80;','listen 80; '+directive))
    def test_path_relocation_to_other_context_rejected(self):
        with self.assertRaises(GuardError):nginx.validate_edit(BASE,BASE.replace('root /site;','').replace('try_files','root /site; try_files'))
    def test_quoted_hash_semicolon_and_comments_are_not_directives(self):
        text='server { root "/a#b;c"; server_name example.test; add_header X "root /etc; #"; }'
        nginx.validate_edit(text,text+'\n# root /root;')
        self.assertEqual(['example.test'],nginx.site_domains(text))
    def test_escaped_quotes_and_variables_parse(self):
        text='server { root /site; server_name example.test; add_header X "a\\\";#"; set $x ${host}; }'
        nginx.validate_edit(text,text+'\n# ok')
    def test_existing_lua_block_preserved_new_or_changed_rejected(self):
        text='server { root /site; server_name example.test; content_by_lua_block { local x = "#;{}" return x } }'
        nginx.validate_edit(text,text+'\n# safe')
        with self.assertRaises(GuardError):nginx.validate_edit(text,text.replace('return x','return 1'))
    def test_bad_braces_quote_and_deep_nesting_rejected(self):
        for text in ('server {','server { root "x; }','server { } }','server {'*40+'}'*40):
            with self.subTest(text=text[:30]),self.assertRaises(GuardError):nginx.parse_config(text)
    def test_http01_domains_change_has_zero_side_effect(self):
        with self.assertRaises(GuardError):self.prepare(self.body(expectedDomains=['stale.test']))
        self.assertEqual({},self.transport.directories);self.assertEqual(0,self.transport.writes)
    def test_http01_probe_failure_restores_old_configuration(self):
        with self.http(404),self.assertRaises(GuardError):self.host.dispatch('POST','/nginx/http01',self.body(expectedDomains=['example.test']))
        self.assertEqual(BASE.encode(),self.transport.raw);self.assertEqual({},self.transport.tokens)
    def test_http01_prepare_replay_same_id_and_new_renewal_keep_directory(self):
        body=self.body(expectedDomains=['example.test']);first=self.prepare(body);second=self.prepare(body);third=self.prepare()
        self.assertEqual(first,second);self.assertEqual(first['challengeHostPath'],third['challengeHostPath']);self.assertEqual({},self.transport.tokens)
        self.assertEqual(1,self.transport.raw.decode().count('location ^~ /.well-known/acme-challenge/'))
    def test_http01_unmapped_vendor_root_fallback_survives_renewal(self):
        self.transport.unmapped=True
        self.transport.raw=b'server { listen 80; server_name example.test; location ^~ /.well-known/acme-challenge { allow all; root /usr/share/nginx/html; } }'
        first=self.prepare();before=self.transport.raw;self.prepare();self.assertEqual(before,self.transport.raw)
        self.assertIn(b'@microi_old_acme_',self.transport.raw);self.assertIn(b'root "/usr/share/nginx/html"',self.transport.raw)
    def test_http01_unknown_custom_route_refused(self):
        self.transport.raw=b'server { listen 80; server_name example.test; root /site; location ^~ /.well-known/acme-challenge { proxy_pass http://other; } }'
        with self.assertRaises(GuardError):self.prepare()
        self.assertEqual(0,self.transport.writes)
    def test_http01_external_route_change_refused(self):
        self.prepare();self.transport.raw=self.transport.raw.replace(b'default_type text/plain',b'default_type text/html')
        with self.assertRaises(GuardError):self.prepare()
    def test_http01_www_writable_root_uses_trusted_config_directory_with_ca_fallback(self):
        original=nginx.trusted_bind_directory
        def verify(path):
            if pathlib.Path(path).name=='site':raise GuardError('www can rename root',409)
            return original(path)
        with patch.object(nginx,'trusted_bind_directory',side_effect=verify):self.prepare()
        self.assertIn(b'root "/etc/nginx/conf.d"',self.transport.raw)
        self.assertIn(b'root "/site"',self.transport.raw);self.assertIn(b'@microi_old_acme_',self.transport.raw)
    def test_challenge_bind_requires_root_owner_and_no_group_or_world_write(self):
        self.assertTrue(nginx.root_owned_directory(SimpleNamespace(st_uid=0,st_mode=0o40755)))
        for uid,mode in ((1000,0o40755),(0,0o40775),(0,0o40757),(0,0o41777)):
            self.assertFalse(nginx.root_owned_directory(SimpleNamespace(st_uid=uid,st_mode=mode)))
    def test_native_challenge_checks_every_ancestor_without_relaxing_trust(self):
        # 对应本次宝塔安装器的私有祖先；使用 POSIX 元数据模型，在 Windows 也验证完整拒绝链。
        entries={};observed=[]
        class NativePath(pathlib.PurePosixPath):
            def lstat(self):
                observed.append(str(self));uid,mode=entries.get(str(self),(0,stat.S_IFDIR|0o755))
                return SimpleNamespace(st_uid=uid,st_mode=mode)
            stat=lstat
        with patch.object(nginx,'Path',NativePath),patch.object(nginx.os,'name','posix'):
            nginx.trusted_native_challenge_directory('/www/wwwroot/site')
            self.assertTrue({'/','/www','/www/wwwroot','/www/wwwroot/site'}.issubset(observed))
            for path,uid,mode in [('/www',0,stat.S_IFDIR|0o600),('/www/wwwroot',0,stat.S_IFDIR|0o750),
                                  ('/www/wwwroot/site',0,stat.S_IFDIR|0o700),('/www/wwwroot/site',1001,stat.S_IFDIR|0o755),
                                  ('/www/wwwroot',0,stat.S_IFDIR|0o775),('/www',0,stat.S_IFDIR|0o757),
                                  ('/www/wwwroot/site',0,stat.S_IFLNK|0o777)]:
                with self.subTest(path=path,uid=uid,mode=oct(mode)):
                    entries.clear();entries[path]=(uid,mode)
                    with self.assertRaises(GuardError):nginx.trusted_native_challenge_directory('/www/wwwroot/site')
            entries.clear()
            for path in ('/www/server/panel/vhost/nginx','/www/wwwroot-other','/www/wwwroot/../private'):
                with self.subTest(path=path),self.assertRaises(GuardError):nginx.trusted_native_challenge_directory(path)
    def test_native_http01_unsafe_site_root_uses_fixed_public_root_and_retains_old_ca_route(self):
        self.instance['kind']='native';self.instance['configRoot']=nginx.BT_ROOT
        self.transport.raw=BASE.replace('/site','/www/wwwroot/site').encode()
        checked=[]
        def validate(path):
            checked.append(path)
            if path=='/www/wwwroot/site':raise GuardError('www-owned or inaccessible ancestor',409)
            if path==nginx.BT_ROOT:raise AssertionError('Native private configRoot cannot be the fallback')
        with patch.object(nginx,'trusted_native_challenge_directory',side_effect=validate):
            first=self.prepare();saved=self.transport.raw;self.prepare()
        self.assertEqual(saved,self.transport.raw);self.assertIn(nginx.BT_WEB_ROOT,checked)
        plan=next(self.host.state.glob('http01-plan-*'));record=json.loads(plan.read_text())
        self.assertEqual(nginx.BT_WEB_ROOT,pathlib.PurePosixPath(record['directory']).parent.as_posix())
        self.assertIn(b'root "/www/wwwroot"',saved);self.assertIn(b'root "/www/wwwroot/site"',saved)
        self.assertIn(b'@microi_old_acme_',saved);self.assertTrue(first['prepared'])
    def test_native_http01_trusted_worker_readable_site_keeps_its_root(self):
        self.instance['kind']='native';self.transport.raw=BASE.replace('/site','/www/wwwroot/site').encode()
        with patch.object(nginx,'trusted_native_challenge_directory') as validate:self.prepare()
        validate.assert_any_call('/www/wwwroot/site')
        self.assertIn(b'root "/www/wwwroot/site"',self.transport.raw);self.assertNotIn(b'@microi_old_acme_',self.transport.raw)
    def test_native_http01_bad_fixed_root_stops_before_any_plan_or_site_write(self):
        self.instance['kind']='native'
        with patch.object(nginx,'trusted_native_challenge_directory',side_effect=GuardError('unsafe ancestor',409)),self.assertRaises(GuardError):self.prepare()
        self.assertEqual(0,self.transport.writes);self.assertEqual({},self.transport.directories)
        self.assertEqual([],list(self.host.state.glob('http01-*.json')))
    def test_docker_http01_never_applies_native_worker_rules_to_host_bind_prefix(self):
        with patch.object(nginx,'trusted_native_challenge_directory',side_effect=AssertionError('Docker host ancestry is not worker ancestry')) as validate:
            self.assertTrue(self.prepare()['prepared'])
        validate.assert_not_called()
    def test_native_old_failed_plan_is_not_relocated_or_rewritten_on_retry(self):
        self.instance['kind']='native';self.instance['configRoot']=nginx.BT_ROOT
        body=self.body(expectedDomains=['example.test']);key='http01-plan-'+body['requestId']+'.json'
        directory=nginx.BT_ROOT+'/.microi-acme-'+'b'*64
        plan={'requestHash':nginx.digest(nginx.canonical(body)),'directory':directory,'hostPath':directory,
              'isolationId':'b'*64,'content':BASE,'domains':['example.test'],'domainPorts':{'example.test':[80]}}
        operation='operation-http01-'+body['requestId']+'.json'
        self.host.save(key,plan);self.host.save(operation,{'state':'rolledBack','originalEvidence':'permission denied'})
        before={p.name:p.read_bytes() for p in self.host.state.glob('*.json')}
        with patch.object(self.transport,'create_owned') as create,self.assertRaisesRegex(GuardError,'原计划保持不变.*新请求'):self.prepare(body)
        create.assert_not_called();self.assertEqual(0,self.transport.writes)
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.host.state.glob('*.json')})
        with patch.object(nginx,'trusted_native_challenge_directory'):self.assertTrue(self.prepare()['prepared'])
        self.assertEqual(before[key],(self.host.state/key).read_bytes());self.assertEqual(before[operation],(self.host.state/operation).read_bytes())
    def test_native_http01_umask_keeps_only_owned_directories_and_token_public(self):
        # 真正调用原生文件写入；POSIX 额外核对最终权限，Windows 核对相同 chmod/fchmod 调用边界。
        parent=pathlib.Path(self.temp.name)/'native-root';parent.mkdir()
        directory=parent/('.microi-acme-'+'b'*64);token='c'*32;token_path=directory/'.well-known'/'acme-challenge'/token
        transport=nginx.Transport({'kind':'native'},None);chmod=os.chmod
        fchmod=getattr(os,'fchmod',None) or (lambda fd,mode:chmod(token_path,mode))
        previous=os.umask(0o077)
        try:
            with patch.object(nginx,'checked_path',side_effect=pathlib.PurePosixPath),patch.object(nginx.os,'chmod',wraps=chmod) as modes,patch.object(nginx.os,'fchmod',side_effect=fchmod,create=True) as file_modes:
                transport.create_owned(directory.as_posix(),b'owned-marker')
                transport.challenge_token(directory.as_posix(),token,b'probe')
                self.assertEqual(b'probe',token_path.read_bytes());self.assertEqual(0o644,file_modes.call_args.args[1])
                self.assertEqual({directory,directory/'.well-known',directory/'.well-known'/'acme-challenge'},{pathlib.Path(call.args[0]) for call in modes.call_args_list})
                self.assertTrue(all(call.args[1]==0o755 for call in modes.call_args_list))
                if os.name=='posix':
                    for path in (directory,directory/'.well-known',directory/'.well-known'/'acme-challenge'):self.assertEqual(0o755,stat.S_IMODE(path.stat().st_mode))
                    self.assertEqual(0o644,stat.S_IMODE(token_path.stat().st_mode));self.assertEqual(0o600,stat.S_IMODE((directory/'.microi-owner').stat().st_mode))
                modes.reset_mock();transport.create_owned(directory.as_posix(),b'owned-marker');modes.assert_not_called()
                transport.challenge_token(directory.as_posix(),token);self.assertFalse(token_path.exists())
        finally:os.umask(previous)
    def test_http01_uses_actual_coexistence_listener_port(self):
        self.transport.raw=BASE.replace('listen 80','listen 18080').encode()
        observed=[];transport=self.transport
        class Connection:
            def __init__(self,address,port,**_):observed.append((address,port))
            def request(self,method,path,headers):self.token=path.rsplit('/',1)[-1]
            def getresponse(self):return SimpleNamespace(status=200,read=lambda _:transport.tokens[self.token])
            def close(self):pass
        with patch.object(nginx.http.client,'HTTPConnection',Connection):self.host.dispatch('POST','/nginx/http01',self.body(expectedDomains=['example.test']))
        self.assertEqual([('127.0.0.1',18080)],observed)
    def test_baota_ssl_and_quic_listeners_are_not_plain_http(self):
        text='server { listen 80; listen [::]:80; listen 443 ssl; listen [::]:443 ssl; listen 443 quic; listen [::]:443 quic; server_name example.test; root /site; }'
        server=nginx.parse_config(text)[0]
        self.assertEqual([80],nginx.listen_ports(server))
        self.assertEqual([443],nginx.listen_ports(server,tls=True))
        self.assertEqual({'example.test':[80]},nginx.http_ports_by_domain(text))
    def test_quic_without_tcp_http_cannot_supply_http01(self):
        self.transport.raw=b'server { listen 443 quic; server_name example.test; root /site; }'
        with self.assertRaises(GuardError):self.prepare()
        self.assertEqual(0,self.transport.writes)
    def test_http01_retry_reclassifies_legacy_plan_without_overwriting_it(self):
        self.transport.raw=BASE.replace('listen 80;','listen 80; listen 443 ssl; listen 443 quic;').encode()
        body=self.body(expectedDomains=['example.test'])
        with self.http(404),self.assertRaises(GuardError):self.host.dispatch('POST','/nginx/http01',body)
        key='http01-plan-'+body['requestId']+'.json';plan=self.host.load(key)
        plan['domainPorts']={'example.test':[80,443]};self.host.save(key,plan)
        observed=[];transport=self.transport
        class Connection:
            def __init__(self,address,port,**_):self.port=port;observed.append(port)
            def request(self,method,path,headers):self.token=path.rsplit('/',1)[-1]
            def getresponse(self):return SimpleNamespace(status=200 if self.port==80 else 302,read=lambda _:transport.tokens[self.token])
            def close(self):pass
        with patch.object(nginx.http.client,'HTTPConnection',Connection):self.host.dispatch('POST','/nginx/http01',body)
        self.assertEqual([80],observed)
        self.assertEqual(plan,self.host.load(key))
    def test_http01_http_redirect_block_only_exempts_challenge_prefix(self):
        self.transport.raw=b'server { listen 81; server_name example.test; return 301 https://$host$request_uri; } server { listen 443 ssl; server_name example.test; root /site; }'
        self.prepare();text=self.transport.raw.decode()
        self.assertIn('if ($uri !~ "^/\\.well-known/acme-challenge/") { return 301 https://$host$request_uri; }',text)
        self.assertEqual(1,text.count('location ^~ /.well-known/acme-challenge/'))
        self.prepare();self.assertEqual(text,self.transport.raw.decode())
    def test_managed_tls_rejects_foreign_identity_before_network(self):
        self.host.docker=SimpleNamespace(json=lambda *_:{'Id':'c'*64,'State':{'Running':True},'Config':{'Labels':{'io.microi.panel.owner':'other'}}})
        with patch.object(nginx,'tls_leaf') as probe,self.assertRaises(GuardError):self.host.verify_managed_tls({'ownerId':'owner','resourceId':'resource','containerId':'c'*64,'domains':[{'serverName':'example.test','certificateSha256':'d'*64}]})
        probe.assert_not_called()
    def test_managed_tls_uses_only_inspected_owned_network(self):
        self.host.docker=SimpleNamespace(json=lambda *_:{'Id':'c'*64,'State':{'Running':True},'Config':{'Labels':{'io.microi.panel.owner':'owner','io.microi.panel.resource':'resource','io.microi.panel.plugin':'nginx'}},'NetworkSettings':{'Networks':{'mci-panel-owner':{'IPAddress':'172.18.0.2'}}}})
        with patch.object(nginx,'tls_leaf',return_value={'serverName':'example.test','sha256':'d'*64}) as probe:
            self.assertTrue(self.host.verify_managed_tls({'ownerId':'owner','resourceId':'resource','containerId':'c'*64,'domains':[{'serverName':'example.test','certificateSha256':'d'*64}]})['verified'])
        probe.assert_called_once_with('172.18.0.2',443,'example.test','d'*64)
    def test_invalid_certificate_never_changes_config(self):
        with self.assertRaises(GuardError):self.host.dispatch('POST','/nginx/certificate',self.body(certificatePem='invalid',privateKeyPem='invalid'))
        self.assertEqual(BASE.encode(),self.transport.raw);self.assertEqual([],list(self.host.state.glob('.certificate-*')))
    def test_certificate_same_http01_request_id_has_separate_namespace(self):
        body=self.body(expectedDomains=['example.test']);self.prepare(body)
        result=self.certificate(self.body(requestId=body['requestId'],certificatePem='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----',privateKeyPem='fixture key'))
        self.assertTrue(result['verified']);self.assertEqual(nginx.digest(b'unit leaf'),result['certificateSha256'])
    def test_certificate_updates_tls_block_without_moving_http_redirect_to_443(self):
        text='server { listen 80; server_name example.test; return 301 https://$host$request_uri; } server { listen 443 ssl; server_name example.test; root /site; ssl_certificate /old/fullchain.pem; ssl_certificate_key /old/key.pem; }'
        self.transport.raw=text.encode();self.certificate()
        blocks=nginx.parse_config(self.transport.raw.decode());self.assertEqual(('80',),blocks[0]['children'][0]['args'])
        self.assertFalse(any(node['name'].startswith('ssl_') for node in blocks[0]['children']))
        self.assertEqual(1,self.transport.raw.count(b'listen 443 ssl'))
    def test_certificate_ambiguous_http_blocks_refused_before_directory_creation(self):
        self.transport.raw=(BASE+' '+BASE).encode()
        with self.assertRaises(GuardError):self.certificate()
        self.assertEqual({},self.transport.directories);self.assertEqual(0,self.transport.writes)
    def test_certificate_tls_mismatch_rolls_back_without_replacing_old_certificate(self):
        before=self.transport.raw
        with self.assertRaises(GuardError):self.certificate(probe_error=GuardError('different TLS fingerprint',503))
        self.assertEqual(before,self.transport.raw)
        self.assertEqual(1,len(self.transport.directories))
    def test_certificate_rollback_rechecks_the_previous_live_tls_leaf(self):
        self.transport.raw=BASE.replace('listen 80;','listen 8443 ssl; ssl_certificate /old/cert; ssl_certificate_key /old/key;').encode()
        before=self.transport.raw;observed=[]
        def probe(address,port,domain,expected,**options):
            observed.append((port,expected))
            if expected==nginx.digest(b'unit leaf'):raise GuardError('new TLS failed',503)
        with self.assertRaises(GuardError):self.certificate(probe_error=probe)
        self.assertEqual(before,self.transport.raw)
        self.assertIn((8443,'a'*64),observed,'Restored files and new workers do not prove the old TLS leaf was restored')
    def test_certificate_rollback_bad_old_tls_is_recovery_failed_and_cannot_overwrite_again(self):
        self.transport.raw=BASE.replace('listen 80;','listen 8443 ssl; ssl_certificate /old/cert; ssl_certificate_key /old/key;').encode()
        before=self.transport.raw;body=self.body(certificatePem='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----',privateKeyPem='fixture key')
        with self.assertRaisesRegex(GuardError,'不能确认恢复'):self.certificate(body,probe_error=GuardError('all TLS failed',503))
        self.assertEqual(before,self.transport.raw);self.assertEqual(2,self.transport.writes)
        name='operation-certificate-'+body['requestId']+'.json';self.assertEqual('recoveryFailed',self.host.load(name)['state'])
        with self.assertRaises(GuardError):self.certificate(body,probe_error=GuardError('old TLS still failed',503))
        self.assertEqual(2,self.transport.writes,'Retry must first verify the unresolved old service')
        self.assertTrue(self.certificate(body)['verified']);self.assertEqual('succeeded',self.host.load(name)['state'])
    def test_certificate_retry_reuses_durable_old_tls_snapshot(self):
        self.transport.raw=BASE.replace('listen 80;','listen 8443 ssl; ssl_certificate /old/cert; ssl_certificate_key /old/key;').encode()
        body=self.body(certificatePem='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----',privateKeyPem='fixture key')
        def probe(address,port,domain,expected,**options):
            if expected==nginx.digest(b'unit leaf'):raise GuardError('new TLS failed',503)
        with self.assertRaises(GuardError):self.certificate(body,probe_error=probe)
        plan=self.host.load('certificate-plan-'+body['requestId']+'.json')
        self.assertEqual([{'serverName':'example.test','port':8443,'certificateSha256':'a'*64}],plan['previousTls'])
        with patch.object(self.host,'capture_previous_tls',side_effect=AssertionError('Must not replace the durable old fingerprint')):
            self.assertTrue(self.certificate(body)['verified'])
    def test_certificate_unreadable_old_tls_stops_before_site_files_are_written(self):
        self.transport.raw=BASE.replace('listen 80;','listen 8443 ssl;').encode()
        with patch.object(self.host,'capture_previous_tls',side_effect=GuardError('old TLS unavailable',503)),self.assertRaises(GuardError):self.certificate()
        self.assertEqual(0,self.transport.writes);self.assertEqual({},self.transport.directories)
    def test_certificate_old_plan_without_tls_snapshot_cannot_accept_switched_configuration(self):
        body=self.body(certificatePem='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----',privateKeyPem='fixture key');self.certificate(body)
        name='certificate-plan-'+body['requestId']+'.json';plan=self.host.load(name);del plan['previousTls'];self.host.save(name,plan)
        writes=self.transport.writes
        with self.assertRaisesRegex(GuardError,'缺少恢复快照'):self.certificate(body)
        self.assertEqual(writes,self.transport.writes)
    def test_previous_tls_snapshot_covers_each_actual_listener(self):
        text=BASE.replace('listen 80;','listen 443 ssl; listen 8443 ssl;')
        with patch.object(nginx,'tls_certificate',side_effect=lambda address,port,domain:str(port)[-1]*64),patch.object(nginx,'tls_http_readback',return_value={'status':200}):
            snapshot=self.host.capture_previous_tls(self.instance,text)
        self.assertEqual([443,8443],[entry['port'] for entry in snapshot])
    def test_certificate_result_unknown_replay_revalidates_tls(self):
        body=self.body(certificatePem='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----',privateKeyPem='fixture key')
        self.certificate(body)
        with self.assertRaises(GuardError):self.certificate(body,probe_error=GuardError('wrong live cert',503))
    def test_tls_readback_retries_complete_round_for_every_sni_and_port(self):
        now=[0.0];seen=[];attempts={}
        expected=[{'serverName':'a.test','port':443,'certificateSha256':'a'*64},
                  {'serverName':'b.test','port':8443,'certificateSha256':'b'*64}]
        def probe(address,port,domain,fingerprint,deadline):
            seen.append((domain,port,deadline));attempts[domain]=attempts.get(domain,0)+1
            if domain=='b.test' and attempts[domain]==1:raise nginx.TlsNotReady('previous worker leaf',503)
        with patch.object(nginx.time,'monotonic',side_effect=lambda:now[0]),patch.object(nginx.time,'sleep',side_effect=lambda seconds:now.__setitem__(0,now[0]+seconds)),patch.object(nginx,'tls_leaf',side_effect=probe),patch.object(nginx,'tls_http_readback',return_value={'status':200}):
            self.host.wait_tls_readback(self.instance,expected,'timeout')
        self.assertEqual([('a.test',443),('b.test',8443),('a.test',443),('b.test',8443)],[(domain,port) for domain,port,_ in seen])
        self.assertEqual({10.0},{deadline for _,_,deadline in seen});self.assertEqual(.1,now[0])
    def test_tls_readback_does_not_accept_final_success_after_shared_deadline(self):
        now=[0.0];expected=[{'serverName':'example.test','port':443,'certificateSha256':'a'*64}]
        def delayed(*args,**kwargs):now[0]=10.01;return {'status':200}
        with patch.object(nginx.time,'monotonic',side_effect=lambda:now[0]),patch.object(nginx,'tls_leaf'),patch.object(nginx,'tls_http_readback',side_effect=delayed),self.assertRaisesRegex(GuardError,'timeout'):
            self.host.wait_tls_readback(self.instance,expected,'timeout')
    def test_tls_readback_address_discovery_uses_the_same_deadline(self):
        now=[0.0];deadlines=[]
        def addresses(instance,deadline):deadlines.append(deadline);now[0]=10.01;return ['127.0.0.1']
        with patch.object(nginx.time,'monotonic',side_effect=lambda:now[0]),patch.object(self.host,'endpoint_addresses',side_effect=addresses),patch.object(nginx,'tls_leaf') as leaf,self.assertRaises(GuardError):
            self.host.wait_tls_readback(self.instance,[{'serverName':'example.test','port':443,'certificateSha256':'a'*64}],'timeout')
        self.assertEqual([10.0],deadlines);leaf.assert_not_called()
    def test_tls_readback_identity_and_redirect_errors_are_not_retried(self):
        expected=[{'serverName':'example.test','port':443,'certificateSha256':'a'*64}]
        for message,status in [('identity changed',409),('redirect loop',503)]:
            with self.subTest(message=message),patch.object(nginx,'tls_leaf'),patch.object(nginx,'tls_http_readback',side_effect=GuardError(message,status)) as business,patch.object(nginx.time,'sleep') as sleep:
                with self.assertRaisesRegex(GuardError,message):self.host.wait_tls_readback(self.instance,expected,'timeout')
                self.assertEqual(1,business.call_count);sleep.assert_not_called()
    def test_permanent_new_tls_failure_times_out_then_independently_restores_old_tls(self):
        self.transport.raw=BASE.replace('listen 80;','listen 8443 ssl;').encode();now=[0.0];deadlines=[]
        body=self.body(certificatePem='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----',privateKeyPem='fixture key')
        def probe(address,port,domain,expected,deadline):
            deadlines.append((expected,deadline))
            if expected==nginx.digest(b'unit leaf'):raise nginx.ssl.SSLError('no shared cipher')
        with patch.object(nginx.time,'monotonic',side_effect=lambda:now[0]),patch.object(nginx.time,'sleep',side_effect=lambda seconds:now.__setitem__(0,now[0]+seconds)),self.assertRaisesRegex(GuardError,'原服务回读'):
            self.certificate(body,probe_error=probe)
        self.assertEqual(10.0,now[0]);self.assertEqual(('a'*64,20.0),deadlines[-1])
        self.assertEqual('rolledBack',self.host.load('operation-certificate-'+body['requestId']+'.json')['state'])
    def test_permanent_restored_tls_failure_cannot_report_recovery(self):
        self.transport.raw=BASE.replace('listen 80;','listen 8443 ssl;').encode();now=[0.0]
        body=self.body(certificatePem='-----BEGIN CERTIFICATE-----\nfixture\n-----END CERTIFICATE-----',privateKeyPem='fixture key')
        with patch.object(nginx.time,'monotonic',side_effect=lambda:now[0]),patch.object(nginx.time,'sleep',side_effect=lambda seconds:now.__setitem__(0,now[0]+seconds)),self.assertRaisesRegex(GuardError,'不能确认恢复'):
            self.certificate(body,probe_error=nginx.ssl.SSLError('still unavailable'))
        self.assertEqual(20.0,now[0]);self.assertEqual('recoveryFailed',self.host.load('operation-certificate-'+body['requestId']+'.json')['state'])
    def test_http_header_trickle_cannot_extend_absolute_deadline(self):
        now=[0.0];timeouts=[];reads=[]
        class Stream:
            def settimeout(self,value):timeouts.append(value)
            def recv_into(self,buffer):
                reads.append(1);buffer[0]=ord('H');now[0]+=.6;return 1
        with patch.object(nginx.time,'monotonic',side_effect=lambda:now[0]):
            response=nginx.http.client.HTTPResponse(nginx._DeadlineSocket(Stream(),1.0))
            with self.assertRaises(TimeoutError):response.begin()
            response.close()
        self.assertEqual(2,len(reads));self.assertEqual([1.0,.4],timeouts)
    def test_tls_connection_and_handshake_share_remaining_budget(self):
        now=[0.0];timeouts=[]
        class Stream:
            def __enter__(self):return self
            def __exit__(self,*_):pass
            def settimeout(self,value):timeouts.append(value)
            def getpeercert(self,**_):return b'leaf'
        def connect(address,timeout):self.assertEqual(2.5,timeout);now[0]=2;return Stream()
        def handshake(stream,server_hostname):now[0]=2.6;return stream
        with patch.object(nginx.time,'monotonic',side_effect=lambda:now[0]),patch.object(nginx.socket,'create_connection',side_effect=connect),patch.object(nginx.ssl,'SSLContext') as context:
            context.return_value.wrap_socket.side_effect=handshake
            with self.assertRaises(TimeoutError):nginx.tls_certificate('127.0.0.1',443,'example.test',deadline=2.5)
        self.assertEqual([.5],timeouts)
    def test_docker_address_readback_deadline_reaches_unix_socket_and_response(self):
        now=[50.0];timeouts=[];initial=[]
        payload=json.dumps({'State':{'Running':True},'NetworkSettings':{'Networks':{'owned':{'IPAddress':'172.18.0.2'}}}}).encode()
        class Connection:
            def __init__(self,path,timeout):initial.append(timeout);self.sock=self;self.raw=b'HTTP/1.1 200 OK\r\nContent-Length: '+str(len(payload)).encode()+b'\r\n\r\n'+payload
            def connect(self):now[0]=50.25
            def request(self,*args,**kwargs):now[0]=50.75
            def settimeout(self,value):timeouts.append(value)
            def recv_into(self,buffer):
                count=min(len(buffer),len(self.raw));buffer[:count]=self.raw[:count];self.raw=self.raw[count:];return count
            def close(self):pass
        with patch.object(nginx.time,'monotonic',side_effect=lambda:now[0]),patch.object(nginx,'UnixHTTP',Connection):
            self.host.docker=nginx.DockerApi()
            addresses=nginx.HostNginx.endpoint_addresses(self.host,self.instance,deadline=52.0)
        self.assertEqual(['172.18.0.2'],addresses);self.assertEqual([2.0],initial);self.assertEqual([1.75,1.25],timeouts)
    def test_systemd_retains_readonly_host_boundary_and_native_fixed_paths(self):
        import configparser
        unit=configparser.ConfigParser(interpolation=None);unit.read(pathlib.Path(nginx.__file__).with_name('microi-auth-guard.service'),encoding='utf-8')
        self.assertEqual('0077',unit['Service']['UMask'])
        self.assertEqual('strict',unit['Service']['ProtectSystem'])
        self.assertEqual('true',unit['Service']['NoNewPrivileges'])
        self.assertEqual({'CAP_NET_ADMIN','CAP_NET_RAW','CAP_NET_BIND_SERVICE','CAP_DAC_READ_SEARCH','CAP_DAC_OVERRIDE','CAP_CHOWN','CAP_FOWNER','CAP_SYS_PTRACE'},set(unit['Service']['CapabilityBoundingSet'].split()))
        self.assertEqual('~ptrace process_vm_readv process_vm_writev',unit['Service']['SystemCallFilter'])
        paths=unit['Service']['ReadWritePaths'].split()
        self.assertEqual({'/run','/var/lib/microi-auth-guard','-/www/server/panel/vhost','-/www/server/nginx/logs','-/www/wwwlogs','-/www/wwwroot'},set(paths))
    def test_manifest_includes_nginx_module_without_breaking_guard_protocol(self):
        manifest=json.loads(pathlib.Path(nginx.__file__).with_name('manifest.json').read_text())
        self.assertEqual(1,manifest['protocol']);self.assertEqual(1,manifest['nginxProtocol']);self.assertIn('nginx_adapter.py',manifest['files'])
    def test_native_identity_survives_process_restart_but_not_binary_change(self):
        binary=pathlib.Path(self.temp.name)/'nginx-bin';binary.write_bytes(b'fixed program');root=pathlib.Path(self.temp.name)/'vhost';root.mkdir()
        host=nginx.HostNginx(self.temp.name,docker=SimpleNamespace(json=lambda *_:[]));read=nginx.read_native;pid=[100]
        def read_path(path,limit=nginx.MAX_CONFIG): return str(pid[0]).encode() if str(path).endswith('/logs/nginx.pid') else read(path,limit)
        with patch.object(nginx,'BT_BINARY',str(binary)),patch.object(nginx,'BT_ROOT',str(root)),patch.object(nginx,'read_native',read_path),patch.object(nginx.os,'readlink',return_value=str(binary)),patch.object(nginx,'run',return_value=(0,b'',b'nginx version')):
            first=host.discover()[0][0];pid[0]=200;second=host.discover()[0][0]
            self.assertEqual(first['fingerprint'],second['fingerprint']);self.assertNotEqual(first['pid'],second['pid'])
            binary.write_bytes(b'new program');self.assertNotEqual(first['fingerprint'],host.discover()[0][0]['fingerprint'])

    def docker_discovery(self):
        # 对应真实 1Panel OpenResty 的独立配置、站点和只读时间挂载；Docker 返回顺序可重排。
        detail={'Id':'c'*64,'Image':'sha256:'+'d'*64,'Name':'/1Panel-openresty',
                'State':{'Running':True},'Config':{'Image':'1panel/openresty:1.27.1'},'Mounts':[
                    {'Type':'bind','Source':'/opt/1panel/apps/openresty/openresty/www','Destination':'/www','RW':True},
                    {'Type':'bind','Source':'/opt/1panel/apps/openresty/openresty/conf/conf.d','Destination':nginx.CONTAINER_ROOTS[0],'RW':True},
                    {'Type':'bind','Source':'/etc/localtime','Destination':'/etc/localtime','RW':False}]}
        def read(method,path):
            if path=='/containers/json?all=1':return [{'Id':detail['Id'],'Image':detail['Config']['Image']}]
            self.assertEqual('/containers/'+detail['Id']+'/json',path)
            return copy.deepcopy(detail)
        host=nginx.HostNginx(self.temp.name,docker=SimpleNamespace(json=read),transport=lambda _:self.transport)
        return host,detail

    def test_docker_mount_order_preserves_discovery_attachment_and_config_cas(self):
        host,detail=self.docker_discovery()
        with patch.object(nginx,'BT_BINARY',str(pathlib.Path(self.temp.name)/'absent-native')):
            first=host.discover()[0][0]
            detail['Mounts']=detail['Mounts'][1:]+detail['Mounts'][:1]
            attached=host.dispatch('POST','/nginx/attach',{'instanceId':first['id'],'expectedFingerprint':first['fingerprint'],'confirm':first['id']})
            self.assertTrue(attached['attached'])
            detail['Mounts'].reverse()
            site=nginx.digest((first['id']+'\0example.conf').encode())[:32]
            current=host.dispatch('GET',f'/nginx/config?instanceId={first["id"]}&siteId={site}',{})
            self.assertEqual(first['fingerprint'],current['fingerprint'])
            body={'instanceId':first['id'],'siteId':site,'expectedFingerprint':first['fingerprint'],'expectedSha256':current['sha256'],'requestId':str(uuid.uuid4()),'confirm':site,'content':BASE+'\n# retained identity'}
            self.assertTrue(host.transaction(body)['reloaded'])
            self.assertEqual(1,self.transport.writes)

    def test_docker_mount_identity_changes_still_reject_previous_attachment(self):
        host,detail=self.docker_discovery();original=copy.deepcopy(detail)
        with patch.object(nginx,'BT_BINARY',str(pathlib.Path(self.temp.name)/'absent-native')):
            first=host.discover()[0][0]
            host.save('attachments.json',{first['id']:first['fingerprint']})
            changes=[('Type','volume'),('Source','/another-owned-site'),('Destination','/different-www'),('RW',False)]
            for field,value in changes:
                with self.subTest(field=field):
                    detail.clear();detail.update(copy.deepcopy(original));detail['Mounts'][0][field]=value
                    self.assertNotEqual(first['fingerprint'],host.discover()[0][0]['fingerprint'])
                    with self.assertRaises(GuardError):host.instance(first['id'],first['fingerprint'],attached=True)
            for field,value in [('Image','sha256:'+'e'*64),('Id','f'*64)]:
                with self.subTest(field=field):
                    detail.clear();detail.update(copy.deepcopy(original));detail[field]=value
                    self.assertNotEqual(first['fingerprint'],host.discover()[0][0]['fingerprint'])
                    with self.assertRaises(GuardError):host.instance(first['id'],first['fingerprint'],attached=True)
            self.assertEqual(0,self.transport.writes)

    def test_docker_duplicate_mount_is_not_silently_deduplicated(self):
        host,detail=self.docker_discovery()
        with patch.object(nginx,'BT_BINARY',str(pathlib.Path(self.temp.name)/'absent-native')):
            first=host.discover()[0][0]
            detail['Mounts'].append(copy.deepcopy(detail['Mounts'][0]))
            self.assertNotEqual(first['fingerprint'],host.discover()[0][0]['fingerprint'])
            with self.assertRaises(GuardError):host.instance(first['id'],first['fingerprint'])


if __name__ == '__main__': unittest.main()
