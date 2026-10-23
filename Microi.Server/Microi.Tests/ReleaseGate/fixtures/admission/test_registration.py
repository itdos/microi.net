"""纯离线契约测试，不加载 scope、不导入 pymysql、不连网络。"""
import copy
import unittest
from unittest import mock
import types
import register_fixture as r
from test_acl_guard import context_value

C = context_value()
MAIN, TENANT, DB = C["mainTenant"], C["tenant"], "microi_" + C["tenant"]


class RegistrationTests(unittest.TestCase):
    def setUp(self):
        self.owner = '01K7NF6Q6F1YJVZ6FMSR2QK3TN'
        self.scope = copy.deepcopy(C)
        self.main = {'Id': self.owner, 'OsClient': MAIN, 'OsClientType': 'Product', 'OsClientNetwork': 'Internal',
                     'IsEnable': 1, 'IsDeleted': 0, 'RedisHost': '127.0.0.1', 'RedisPort': C['redis']['port'],
                     'RedisPwd': C['redis']['password'], 'RedisDataBase': 1, 'DbMongoConnection': self.scope['mongo']['localUri']}
        self.bootstrap = {'OsClient': MAIN, 'OsClientType': 'Product', 'OsClientNetwork': 'Internal',
                          'OsClientRedisHost': '127.0.0.1', 'OsClientRedisPort': str(C['redis']['port']), 'OsClientRedisPwd': C['redis']['password'],
                          'OsClientRedisDataBase': '1', 'OsClientDbMongoConn': self.scope['mongo']['localUri']}
        self.row = {'Id': self.owner, 'OsClient': TENANT, 'OwnerUserId': self.owner,
                    'OsClientType': 'Product', 'OsClientNetwork': 'Internal', 'IsEnable': 1, 'IsDeleted': 0,
                    'DbConn': 'Server=127.0.0.1;Port=' + str(C['mysql']['port']) + ';Database=' + DB + ';Uid=' + C['mysql']['user'] + ';Pwd=' + C['mysql']['password'] + ';',
                    'RedisHost': None, 'RedisPort': None, 'RedisDataBase': None, 'RedisPwd': None, 'DbMongoConnection': None}

    def verify(self, row=None, schemas=None):
        return r.verify_registration(row or self.row, self.owner, [DB] if schemas is None else schemas, self.scope, self.main, self.bootstrap)

    def test_preserves_registered_and_physical_case(self):
        c = self.verify()
        self.assertEqual(c['registeredDatabase'], DB)
        self.assertEqual(c['returnedDbName'], DB)
        self.assertNotIn('DbConn', c)
        self.assertNotIn('RedisPwd', c)
        self.assertEqual(c['registeredDbConnSha256'], r.sha(self.row['DbConn'].encode('utf-8')))

    def test_lower_variant_is_explicitly_read_back(self):
        row = dict(self.row, DbConn=self.row['DbConn'].replace(DB, DB.lower()))
        c = self.verify(row, [DB.lower()])
        self.assertEqual(c['database'], DB.lower())
        self.assertEqual(c['returnedDbName'], DB)

    def test_case_alias_without_registered_agreement_stops(self):
        with self.assertRaises(ValueError): self.verify(schemas=[DB.lower()])

    def test_no_schema_or_two_aliases_stops(self):
        for schemas in ([], [DB, DB.lower()]):
            with self.subTest(schemas=schemas), self.assertRaises(ValueError): self.verify(schemas=schemas)

    def test_wrong_tuple_or_owner_stops(self):
        for change in ({'OsClient': TENANT.lower()}, {'OwnerUserId': 'f'*32}, {'OsClientNetwork': 'Internet'},
                       {'IsEnable': 0}, {'IsDeleted': 1}, {'DbMongoConnection': 'foreign'}):
            with self.subTest(change=tuple(change)), self.assertRaises(ValueError): self.verify(dict(self.row, **change))

    def test_connection_duplicate_or_foreign_is_not_normalized_away(self):
        for conn in (self.row['DbConn']+'DATABASE=mysql;', self.row['DbConn'].replace(DB,'mysql'),
                     self.row['DbConn'].replace('127.0.0.1','other'), self.row['DbConn'].replace(str(C['mysql']['port']),'3306')):
            with self.subTest(connection='redacted'), self.assertRaises(ValueError): self.verify(dict(self.row, DbConn=conn))

    def test_full_id_is_validated_without_guid_assumption(self):
        self.assertEqual(r.identifier(self.owner), self.owner)
        with self.assertRaises(ValueError): r.identifier('root')

    def test_empty_child_raw_infrastructure_inherits_without_persisting_secrets(self):
        before = copy.deepcopy(self.row)
        result = self.verify()
        self.assertEqual(self.row, before)
        self.assertEqual(result['redis'], {'host': '127.0.0.1', 'port': C['redis']['port'], 'database': 1})
        self.assertNotIn(C['redis']['password'], str(result))
        self.assertLessEqual(len(TENANT), 50)

    def test_child_legacy_redis_is_ignored_exactly_like_actual_runtime(self):
        result = self.verify(dict(self.row, RedisHost='old-docker-only', RedisPort=6379, RedisPwd='old-secret', RedisDataBase=9))
        self.assertEqual(result['redis']['port'], C['redis']['port'])
        self.assertNotEqual(result['tenantInfrastructureSha256'], self.verify()['tenantInfrastructureSha256'])

    def test_main_missing_infrastructure_inherits_bootstrap(self):
        self.main.update(RedisHost='', DbMongoConnection=None)
        self.assertEqual(self.verify()['redis']['database'], 1)
        self.bootstrap['OsClientRedisPwd'] = ''
        with self.assertRaises(ValueError): self.verify()

    def test_foreign_main_config_cannot_be_hidden_by_correct_bootstrap(self):
        for change in ({'OsClient': 'iTdos'}, {'IsDeleted': 1}, {'RedisHost': 'foreign'}, {'RedisPort': 6379},
                       {'RedisPwd': 'foreign'}, {'RedisDataBase': 2}, {'DbMongoConnection': 'foreign'}):
            original = self.main
            self.main = dict(self.main, **change)
            with self.subTest(change=tuple(change)), self.assertRaises(ValueError): self.verify()
            self.main = original

    def test_formal_tenant_uses_its_own_database_principal(self):
        row = dict(self.row, DbConn=self.row['DbConn'].replace(C['mysql']['user'], 'tenant-only-user')
                   .replace(C['mysql']['password'], 'tenant-only-password'))
        result = self.verify(row)
        self.assertNotEqual(result['registeredDbConnSha256'], self.verify()['registeredDbConnSha256'])
        self.assertNotIn('tenant-only-password', str(result))

    def test_whitespace_main_mongo_inherits_bootstrap(self):
        self.main['DbMongoConnection'] = ' \t '
        self.assertEqual(self.verify()['redis']['port'], C['redis']['port'])

    def check_parent(self, *, marker=None, main=None, collisions=None):
        owner_rows = [{'Id': 1, 'TaskId': C['fixtureOwner']}] if marker is None else marker
        data = iter([[{'Name': C['parentDatabase']}], owner_rows, [main or self.main], *(collisions or [[], [], []])])
        cur = mock.MagicMock()
        cur.__enter__.return_value = cur
        def execute(sql, params=()):
            self.assertTrue(sql.startswith('SELECT '), 'check-parent may never mutate')
            cur.current = next(data)
        cur.execute.side_effect = execute
        cur.fetchall.side_effect = lambda: cur.current
        cur.fetchone.side_effect = lambda: cur.current[0] if cur.current else None
        conn = mock.MagicMock()
        conn.__enter__.return_value = conn
        conn.cursor.return_value = cur
        context = types.SimpleNamespace(data=self.scope, bootstrap=self.bootstrap, expected_hash='e'*64)
        context.verify = lambda: context
        # No owner.result exists yet; check-parent must not read one.
        context.load = mock.Mock(side_effect=AssertionError('owner stage not created'))
        registry = r.Registry(context)
        with mock.patch.object(registry, 'connect', return_value=conn):
            result = registry.check_parent()
        context.load.assert_not_called()
        return result, cur

    def test_check_parent_executes_readonly_owner_and_absence_checks_before_user_creation(self):
        result, cur = self.check_parent()
        self.assertTrue(result['parentVerified'])
        self.assertEqual(cur.execute.call_count, 6)
        account_call = cur.execute.call_args_list[3]
        self.assertEqual(account_call.args[1], ('admo'+C['owner32'][:15], C['task']+':'+C['owner32']))
        self.assertLessEqual(len(account_call.args[1][0]), 20)

    def test_check_parent_rejects_wrong_or_multiple_parent_marker_and_collisions(self):
        for marker in ([], [{'Id': 1, 'TaskId': 'other'}],
                       [{'Id': 1, 'TaskId': C['fixtureOwner']}, {'Id': 2, 'TaskId': C['fixtureOwner']}]):
            with self.subTest(marker='synthetic'), self.assertRaises(ValueError): self.check_parent(marker=marker)
        for index in range(3):
            collisions = [[], [], []]; collisions[index] = [{'Id': 'existing'}]
            with self.subTest(collision=index), self.assertRaises(ValueError): self.check_parent(collisions=collisions)
        with self.assertRaises(ValueError): self.check_parent(main=dict(self.main, RedisPort=6379))


if __name__ == '__main__':
    unittest.main()
