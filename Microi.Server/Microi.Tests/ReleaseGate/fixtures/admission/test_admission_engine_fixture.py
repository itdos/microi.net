import copy
import datetime
import importlib.util
import pathlib
import tempfile
import unittest
import types
from test_acl_guard import context_value
from acl_guard import ROOT

C = context_value()
CTX = types.SimpleNamespace(data=C, expected_hash="c"*64)

spec = importlib.util.spec_from_file_location('fixture', pathlib.Path(__file__).with_name('admission_engine_fixture.py'))
f = importlib.util.module_from_spec(spec)
spec.loader.exec_module(f)
OWNER = C['owner32']
TENANT = 'adm_' + OWNER


def temporary_directory():
    scratch = ROOT / '.tmp'
    scratch.mkdir(exist_ok=True)
    return tempfile.TemporaryDirectory(prefix='admission-engine-unit-', dir=scratch)


def rows():
    return {key: {'Id': str(i) * 32, 'ApiEngineKey': key, 'IsDeleted': 0,
                  'ApiName': 'Managed', 'ApiV8Code': 'return {Code:1,Data:"Original"}; ',
                  'IsEnable': 1, 'AllowAnonymous': 0, 'StopHttp': 0, 'Lock': 0,
                  'ApiRole': None, 'ApiAddress': '/old/' + str(i), 'ApiRoutes': '/route/' + str(i) + '; /ROUTE/' + str(i),
                  'UpdateTime': datetime.datetime(2026, 10, 23, 1, 2, 3, 456000), 'Version': 27}
            for i, key in enumerate(f.KEYS, 1)}


def request(action, number=1):
    result = {'owner': OWNER, 'tenant': TENANT, 'runId': 'b' * 32,
              'requestId': format(number, '032x'), 'action': action}
    if action == 'install':
        result['engines'] = {key: dict(ApiName='admission-fixture-' + OWNER, ApiV8Code='return {Code:1,Data:"Fixture"};',
            IsEnable=1, AllowAnonymous=0, StopHttp=0, Lock=0, ApiRole='[]') for key in f.KEYS}
    return result


class Store:
    def __init__(self):
        self.config = {'task': C['task'], 'owner': OWNER, 'tenant': TENANT}
        self.actual = rows()
        self.calls = 0
        self.fail_after_commit = False
        self.reject = False
        self.conflict = False
        self.invalidated = []

    def rows(self):
        return copy.deepcopy(self.actual)

    def replace(self, before, after):
        self.calls += 1
        if self.reject:
            raise TimeoutError()
        if self.conflict:
            self.actual[f.KEYS[0]]['ApiV8Code'] += '// another writer'
            raise RuntimeError()
        if f.digest(self.actual) != f.digest(before):
            raise RuntimeError()
        self.actual = copy.deepcopy(after)
        if self.fail_after_commit:
            raise TimeoutError()
        return [int(f.digest(before[key]) != f.digest(after[key])) for key in f.KEYS]

    def invalidate(self, values):
        keys = f.cache_keys(TENANT, values)
        self.invalidated += keys
        return [{'key': key, 'removed': 1, 'subscribers': 2} for key in keys]


class Tests(unittest.TestCase):
    def test_binary_cas_compares_every_column_null_case_and_trailing_space(self):
        before = rows()[f.KEYS[0]]
        after = {**before, 'ApiV8Code': before['ApiV8Code'].upper().rstrip()}
        sql, values = f.cas_statement(before, after)
        self.assertEqual(sql.count('<=>'), len(before))
        self.assertIn('BINARY `ApiV8Code` <=> BINARY %s', sql)
        self.assertIn('`UpdateTime` <=> %s', sql)
        self.assertNotIn('BINARY `UpdateTime`', sql)
        self.assertIn('BINARY `ApiRole` <=> BINARY %s', sql)
        self.assertIn(before['ApiV8Code'], values)
        self.assertIn(None, values)
        self.assertNotIn(before['ApiV8Code'], sql)
        self.assertNotEqual(f.digest(before), f.digest(after))

    def test_binary_cas_refuses_identity_or_unowned_column_writes(self):
        before = rows()[f.KEYS[0]]
        for change in ({'Id': 'evil'}, {'Version': 1}, {'ApiEngineKey': 'other-key'}):
            with self.assertRaises(f.BoundaryError):
                f.cas_statement(before, {**before, **change})

    def test_snapshot_roundtrips_complete_native_row(self):
        original = rows()
        with temporary_directory() as temp:
            file = pathlib.Path(temp) / 'backup.json'
            f.write_new(file, original)
            self.assertEqual(original, f.read(file))
            with self.assertRaises(FileExistsError):
                f.write_new(file, original)

    def test_install_lock_and_restore_restore_exact_original_bytes(self):
        store = Store()
        original = store.rows()
        with temporary_directory() as temp:
            f.run(request('snapshot'), store, temp)
            f.run(request('install', 2), store, temp)
            locked = request('lock', 3); locked['value'] = 1
            f.run(locked, store, temp)
            self.assertEqual(store.actual[f.KEYS[0]]['Lock'], 1)
            f.run(request('restore', 4), store, temp)
            self.assertEqual(f.wire(original), f.wire(store.actual))
            self.assertEqual(store.calls, 3)
            self.assertTrue(all(key.startswith('Microi:' + TENANT + ':') for key in store.invalidated))

    def test_commit_timeout_reads_back_and_does_not_repeat_mutation(self):
        store = Store(); store.fail_after_commit = True
        with temporary_directory() as temp:
            f.run(request('snapshot'), store, temp)
            result = f.run(request('install', 2), store, temp)
            self.assertTrue(result['recoveredByReadback'])
            self.assertEqual(result['outcome'], 'Applied')
            self.assertTrue(f.run(request('install', 2), store, temp)['duplicate'])
            self.assertEqual(store.calls, 1)

    def test_rejected_write_keeps_original_and_does_not_retry(self):
        store = Store(); store.reject = True
        with temporary_directory() as temp:
            f.run(request('snapshot'), store, temp)
            with self.assertRaises(f.BoundaryError):
                f.run(request('install', 2), store, temp)
            result = f.read(pathlib.Path(temp) / ('result-' + format(2, '032x') + '.json'))
            self.assertEqual(result['outcome'], 'NotApplied')
            with self.assertRaises(f.BoundaryError):
                f.run(request('install', 2), store, temp)
            f.run(request('status', 3), store, temp)
            self.assertEqual(store.calls, 1)

    def test_same_request_id_different_payload_fails_without_new_write(self):
        store = Store()
        with temporary_directory() as temp:
            f.run(request('snapshot'), store, temp)
            f.run(request('install', 2), store, temp)
            changed = request('install', 2)
            changed['engines'][f.KEYS[0]]['ApiV8Code'] += '// different'
            with self.assertRaises(f.BoundaryError):
                f.run(changed, store, temp)
            self.assertEqual(store.calls, 1)

    def test_cache_timeout_recovers_complete_commit_before_any_new_mutation(self):
        store = Store()
        original_invalidate = store.invalidate
        with temporary_directory() as temp:
            f.run(request('snapshot'), store, temp)
            def fail(_):
                raise TimeoutError()
            store.invalidate = fail
            with self.assertRaises(TimeoutError):
                f.run(request('install', 2), store, temp)
            self.assertFalse(list(pathlib.Path(temp).glob('result-*.json')))
            store.invalidate = original_invalidate
            result = f.run(request('install', 2), store, temp)
            self.assertTrue(result['duplicate'])
            self.assertEqual(store.calls, 1)
            self.assertTrue(store.invalidated)

    def test_ninth_mutation_is_rejected_before_any_write(self):
        store = Store()
        with temporary_directory() as temp:
            f.run(request('snapshot'), store, temp)
            f.run(request('install', 2), store, temp)
            for number in range(3, 10):
                action = request('lock', number); action['value'] = number % 2
                f.run(action, store, temp)
            self.assertEqual(store.calls, 8)
            action = request('lock', 10); action['value'] = 0
            with self.assertRaises(f.BoundaryError): f.run(action, store, temp)
            self.assertEqual(store.calls, 8)
            self.assertEqual(len(list(pathlib.Path(temp).glob('intent-*.json'))), 8)

    def test_actual_acl_verifier_dependency_loads_without_side_effects(self):
        self.assertTrue(f.ACL_VERIFIER.is_file())
        spec = importlib.util.spec_from_file_location('actual_acl_verifier', f.ACL_VERIFIER)
        verifier = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(verifier)
        self.assertTrue(callable(verifier.verify_private_acl))

    def test_conflicting_external_write_fails_closed_without_restore(self):
        store = Store()
        with temporary_directory() as temp:
            f.run(request('snapshot'), store, temp)
            f.run(request('install', 2), store, temp)
            store.actual[f.KEYS[0]]['Version'] += 1
            with self.assertRaises(f.BoundaryError):
                f.run(request('restore', 3), store, temp)
            self.assertEqual(store.calls, 1)
            self.assertTrue((pathlib.Path(temp) / 'original.json').exists())

    def test_unknown_commit_retains_intent_and_forbids_new_write(self):
        store = Store(); store.conflict = True
        with temporary_directory() as temp:
            f.run(request('snapshot'), store, temp)
            with self.assertRaises(f.BoundaryError):
                f.run(request('install', 2), store, temp)
            self.assertEqual(len(list(pathlib.Path(temp).glob('intent-*.json'))), 1)
            self.assertFalse(list(pathlib.Path(temp).glob('result-*.json')))
            with self.assertRaises(f.BoundaryError):
                f.run(request('restore', 3), store, temp)
            self.assertEqual(store.calls, 1)

    def test_wrong_owner_and_extra_engine_are_rejected_before_write(self):
        store = Store()
        with temporary_directory() as temp:
            bad = request('snapshot'); bad['tenant'] = 'iTdos'
            with self.assertRaises(f.BoundaryError):
                f.run(bad, store, temp)
            f.run(request('snapshot'), store, temp)
            bad = request('install', 2); bad['engines']['other-engine'] = {}
            with self.assertRaises(f.BoundaryError):
                f.run(bad, store, temp)
            self.assertEqual(store.calls, 0)

    def test_precise_cache_aliases_dedupe_and_never_accept_patterns(self):
        original = rows()
        keys = f.cache_keys(TENANT, original)
        self.assertEqual(len(keys), 8)
        self.assertEqual(len(keys), len(set(keys)))
        original[f.KEYS[0]]['ApiRoutes'] = 'unowned*'
        with self.assertRaises(f.BoundaryError):
            f.cache_keys(TENANT, original)

    def test_public_binding_rejects_main_child_and_arbitrary_database(self):
        config = dict(task=C['task'], owner32=OWNER, contextSha256=CTX.expected_hash, owner=OWNER, tenant=TENANT, database=('microi_' + TENANT).lower(),
                      returnedDbName='microi_' + TENANT, registeredDatabase=('microi_' + TENANT).lower(), parentDatabase=C['parentDatabase'], tenantId='1' * 32,
                      ownerUserId='2' * 32, nativeScopeSha256='c' * 64, registeredDbConnSha256='d' * 64,
                      mainInfrastructureSha256='e'*64, tenantInfrastructureSha256='f'*64,
                      effectiveInfrastructureSha256='1'*64, bootstrapSha256='2'*64, registrationVerifierSha256='3'*64,
                      redis=dict(host='127.0.0.1', port=C['redis']['port'], database=C['redis']['database']))
        self.assertIs(f.binding(config, CTX), config)
        self.assertEqual(f.binding({**config, 'tenantId': '01ARZ3NDEKTSV4RRFFQ69G5FAV'}, CTX)['tenantId'], '01ARZ3NDEKTSV4RRFFQ69G5FAV')
        for change in ({'tenant': 'AnotherMainTenant'}, {'database': 'business'}, {'registeredDatabase':'another'}, {'owner': OWNER[:-1]}, {'task': 'another-fixture-task'}):
            with self.assertRaises(f.BoundaryError):
                f.binding({**config, **change}, CTX)


    def test_mysql_single_bit_values_are_canonical_without_loss(self):
        self.assertEqual(f.decode_mysql_bit(b'\x00'), 0)
        self.assertEqual(f.decode_mysql_bit(b'\x01'), 1)

    def test_mysql_bit_rejects_text_multi_bit_and_malformed_values(self):
        for value in (b'', b'\x00\x00', b'\x02', b'0', None, 0):
            with self.subTest(value=repr(value)):
                with self.assertRaises(f.BoundaryError):
                    f.decode_mysql_bit(value)

    def test_mysql_bit_converter_copy_keeps_other_native_types(self):
        original = {16: bytes, 7: datetime.datetime, 252: bytes}
        selected = f.native_bit_conversions(original, 16)
        self.assertEqual(selected[16](b'\x01'), 1)
        self.assertIs(original[16], bytes)
        self.assertIs(selected[252], bytes)
        self.assertIs(selected[7], datetime.datetime)


if __name__ == '__main__':
    unittest.main()
