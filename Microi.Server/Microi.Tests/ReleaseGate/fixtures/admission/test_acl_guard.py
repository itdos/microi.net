"""Offline boundary tests. Synthetic credentials only; never opens a database/socket."""
import copy
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import acl_guard as g


def context_value():
    build, attempt = '71e081ce-a30a-44f5-a882-a7abec5627ca', 'attempt-offline-unit'
    owner = g.sha((build + '\0' + attempt).encode())[:32]
    return dict(schema=1, task='formal-admission-offline-test', owner32=owner, tenant='adm_' + owner,
                mainTenant='FullMainOffline', parentDatabase='full_main_offline', fixtureOwner='parent-fixture-offline',
                privateDirectory='/unused/admission/private', candidateRoot=str(g.ROOT), python=sys.executable,
                mysql=dict(host='127.0.0.1', port=64160, user='offline-user', password='offline-password'),
                redis=dict(host='127.0.0.1', port=64162, password='offline-password', database=1),
                mongo=dict(localUri='mongodb://offline:offline@127.0.0.1:64163'),
                bootstrapFiles=[dict(path='/unused/a.json', sha256='a'*64), dict(path='/unused/b.json', sha256='b'*64)],
                sourceHashes={name: 'c'*64 for name in g.REQUIRED_SOURCES},
                sourceHead='d'*40, buildId=build, attempt=attempt, base='http://127.0.0.1:64171')


def bootstrap(value):
    mysql, redis = value['mysql'], value['redis']
    return {'AppSettings': dict(OsClient=value['mainTenant'], OsClientType='Product', OsClientNetwork='Internal',
        OsClientDbType='MySql', OsClientDbConn='Server=127.0.0.1;Port=' + str(mysql['port']) + ';Database='
            + value['parentDatabase'] + ';Uid=' + mysql['user'] + ';Pwd=' + mysql['password'] + ';',
        OsClientRedisHost=redis['host'], OsClientRedisPort=redis['port'], OsClientRedisPwd=redis['password'],
        OsClientRedisDataBase=redis['database'], OsClientDbMongoConn=value['mongo']['localUri'])}


def protect_owned(path):
    if os.name == 'nt':
        sid = subprocess.check_output(['whoami', '/user', '/fo', 'csv', '/nh'], text=True).strip().split(',')[-1].strip('"')
        subprocess.run(['icacls', str(path), '/inheritance:r', '/grant:r', '*' + sid + ':(OI)(CI)F',
                        '*S-1-5-18:(OI)(CI)F'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    else:
        path.chmod(0o700)


class ContextTests(unittest.TestCase):
    def test_two_unrelated_runs_derive_distinct_owner_without_task_constants(self):
        first = context_value()
        second = copy.deepcopy(first)
        second['buildId'] = '4a197fd0-55bb-4680-935b-85c31fe8ac29'
        second['task'] = 'another-formal-run'
        second['owner32'] = g.sha((second['buildId']+'\0'+second['attempt']).encode())[:32]
        second['tenant'] = 'adm_' + second['owner32']
        self.assertIs(g.validate_context(first), first)
        self.assertIs(g.validate_context(second), second)
        self.assertNotEqual(first['owner32'], second['owner32'])

    def test_remote_hosts_overlap_or_wrong_databases_fail_closed(self):
        for path, bad in ((('mysql','host'),'remote'), (('redis','host'),'localhost'),
                          (('mongo','localUri'),'mongodb://127.0.0.1:64163,remote:27017'),
                          (('mongo','localUri'),'mongodb+srv://127.0.0.1'),
                          (('mysql','port'), True), (('redis','database'),-1),
                          (('redis','port'),64160), (('parentDatabase',),'mysql'),
                          (('owner32',),'a'*32), (('tenant',),'iTdos')):
            value = context_value()
            target = value
            for key in path[:-1]: target = target[key]
            target[path[-1]] = bad
            with self.subTest(field=path), self.assertRaises((ValueError, TypeError)):
                g.validate_context(value)

    def test_source_closure_and_aliases_are_not_normalized_away(self):
        value = context_value(); value['sourceHashes'].pop(g.PROTOCOL[-1])
        with self.assertRaises(ValueError): g.validate_context(value)
        value = context_value(); value['sourceHashes']['../outside.py'] = '1'*64
        with self.assertRaises(ValueError): g.validate_context(value)
        for text in ('Server=127.0.0.1;Host=remote;', 'Database=a;Initial Catalog=b;', 'Pwd=a;Password=b;'):
            with self.assertRaises(ValueError): g.parse_conn(text)

    def test_quoted_connection_delimiters_and_escaped_quotes(self):
        result = g.parse_conn('Server=127.0.0.1;Password="a;b""c";Database=owned;')
        self.assertEqual(result['password'], 'a;b"c')
        self.assertEqual(result['database'], 'owned')
        self.assertEqual(g.parse_conn("Pwd='it''s;private';")['password'], "it's;private")
        for value in ('Pwd="open;', 'Pwd="one";Password=two;', 'Pwd="a\nb";'):
            with self.assertRaises(ValueError): g.parse_conn(value)


class PrivateFilesTests(unittest.TestCase):
    def setUp(self):
        scratch = g.ROOT / '.tmp'
        scratch.mkdir(exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix='admission-python-unit-', dir=scratch)
        self.addCleanup(self.temp.cleanup)
        self.results = pathlib.Path(self.temp.name)
        self.private = self.results / 'admission' / 'private'
        self.private.mkdir(parents=True)
        protect_owned(self.private)

    def write(self, name, value):
        path = self.private / name
        path.write_text(json.dumps(value), encoding='utf-8')
        if os.name != 'nt': path.chmod(0o600)
        return path

    def fixture(self):
        value = context_value()
        value['sourceHead'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=g.ROOT, text=True).strip()
        value['privateDirectory'] = str(self.private)
        value['sourceHashes'] = {relative: g.sha((g.ROOT / relative).read_bytes()) for relative in g.REQUIRED_SOURCES}
        for index, item in enumerate(value['bootstrapFiles']):
            path = self.write('api-' + str(index) + '.json', bootstrap(value))
            item.update(path=str(path), sha256=g.sha(path.read_bytes()))
        build = dict(schemaVersion=1, sourceHead=value['sourceHead'], buildId=value['buildId'], resultsDirectory=str(self.results))
        ready = dict(schemaVersion=1, sourceHead=value['sourceHead'], buildId=value['buildId'], task=value['task'], attempt=value['attempt'])
        for prefix, data in (('runtimeBuild', build), ('runtimeReady', ready)):
            path = self.write(prefix + '.json', data)
            value[prefix + 'File'] = str(path); value[prefix + 'Sha256'] = g.sha(path.read_bytes())
        path = self.write('context.json', value)
        return path, g.sha(path.read_bytes()), value

    def test_actual_private_acl_and_full_context_positive(self):
        path, digest, value = self.fixture()
        context = g.Context(path, digest)
        self.assertEqual(context.data['task'], value['task'])
        self.assertEqual(context.bootstrap['OsClient'], value['mainTenant'])
        context.save('safe-result.json', {'value': 1})
        self.assertEqual(context.load('safe-result.json'), {'value': 1})
        with self.assertRaises(ValueError): context.save('safe-result.json', {'value': 2})

    def test_actual_cli_directory_and_file_contract(self):
        path, digest, _ = self.fixture()
        for action in (['directory'], ['file', 'context.json']):
            result = subprocess.run([sys.executable, '-B', str(g.HERE/'acl_guard.py'), '--context', str(path),
                                     '--context-sha256', digest, *action], capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(json.loads(result.stdout)['verified'])
        result = subprocess.run([sys.executable, '-B', str(g.HERE/'acl_guard.py'), '--context', str(path),
                                 '--context-sha256', digest, 'file', '../escape'], capture_output=True, text=True, timeout=10)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('offline-password', result.stderr)

    def test_source_hash_python_root_and_head_mismatch_are_rejected(self):
        path, _, original = self.fixture()
        for change in ({'candidateRoot': str(g.ROOT.parent)}, {'python': str(path)},
                       {'sourceHead': '0'*40}, {'sourceHashes': {**original['sourceHashes'], g.PROTOCOL[0]: '0'*64}}):
            value = {**original, **change}; self.write('context.json', value)
            with self.subTest(change=tuple(change)), self.assertRaises(ValueError):
                g.Context(path, g.sha(path.read_bytes()))

    def test_actual_acl_rejects_extra_principal(self):
        path = self.write('public.json', {'synthetic': True})
        if os.name == 'nt':
            subprocess.run(['icacls', str(path), '/grant', '*S-1-1-0:R'], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        else: path.chmod(0o644)
        with self.assertRaises(Exception): g.check(path)

    def test_context_bootstrap_and_runtime_hash_changes_are_rejected(self):
        path, digest, value = self.fixture()
        g.Context(path, digest)
        path.write_bytes(path.read_bytes()+b' ')
        with self.assertRaises(ValueError): g.Context(path, digest)
        path.write_bytes(path.read_bytes()[:-1])
        boot = pathlib.Path(value['bootstrapFiles'][0]['path'])
        boot.write_bytes(boot.read_bytes()+b' ')
        with self.assertRaises(ValueError): g.Context(path, digest)
        boot.write_bytes(boot.read_bytes()[:-1])
        ready = pathlib.Path(value['runtimeReadyFile'])
        ready.write_bytes(ready.read_bytes()+b' ')
        with self.assertRaises(ValueError): g.Context(path, digest)

    def test_other_run_receipt_and_credential_mismatch_are_rejected(self):
        path, _, value = self.fixture()
        ready = json.loads(pathlib.Path(value['runtimeReadyFile']).read_text())
        ready['task'] = 'other-run'
        self.write('runtimeReady.json', ready)
        value['runtimeReadySha256'] = g.sha(pathlib.Path(value['runtimeReadyFile']).read_bytes())
        self.write('context.json', value)
        with self.assertRaises(ValueError): g.Context(path, g.sha(path.read_bytes()))
        ready['task'] = value['task']; self.write('runtimeReady.json', ready)
        value['runtimeReadySha256'] = g.sha(pathlib.Path(value['runtimeReadyFile']).read_bytes())
        value['mysql']['password'] = 'different'
        self.write('context.json', value)
        with self.assertRaises(ValueError): g.Context(path, g.sha(path.read_bytes()))

    def test_private_directory_traversal_and_symlink_rejected(self):
        path, digest, _ = self.fixture()
        context = g.Context(path, digest)
        for other in (self.results / 'outside.json', self.private / '..' / 'escape.json'):
            with self.assertRaises(ValueError): context.owned_path(other, creating=True)
        target = self.write('target.json', {})
        link = self.private / 'link.json'
        try:
            link.symlink_to(target)
        except OSError:
            # Ancestor reparse handling is also exercised independently on hosts without symlink privilege.
            metadata = target.lstat()
            proxy = mock.Mock(st_mode=metadata.st_mode, st_file_attributes=1024)
            with mock.patch.object(pathlib.Path, 'lstat', return_value=proxy), self.assertRaises(ValueError):
                g.check(target)
        else:
            with self.assertRaises(ValueError): g.check(link)


if __name__ == '__main__':
    unittest.main()
