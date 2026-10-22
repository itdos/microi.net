"""Verify a formally created admission tenant; never provision or mutate the borrowed parent."""
import datetime
import json
import pathlib
import re
import sys
sys.dont_write_bytecode = True
from acl_guard import Context, ROOT, PROTOCOL, arguments, bootstrap_configuration, parse_conn, require, sha

INFRA_FIELDS = ('RedisHost', 'RedisPort', 'RedisPwd', 'RedisDataBase', 'DbMongoConnection')


def identifier(value):
    require(isinstance(value, str) and re.fullmatch(
        r'(?:[0-7][0-9A-HJKMNP-TV-Z]{25}|[a-fA-F0-9]{32}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})', value),
        'Invalid identity format')
    return value


def infrastructure(row, main, bootstrap, context):
    # Match OsClient/TenantConfigurationSecurity: child Redis always inherits main;
    # blank main infrastructure falls back to bootstrap. Never persist copied secrets.
    require(main.get('OsClient') == context['mainTenant'] and main.get('OsClientType') == 'Product'
            and main.get('OsClientNetwork') == 'Internal', 'Wrong main infrastructure identity')
    identifier(main.get('Id'))
    require(int(main.get('IsEnable') or 0) == 1 and int(main.get('IsDeleted') or 0) == 0, 'Inactive main infrastructure')
    require(bootstrap.get('OsClient') == context['mainTenant'] and bootstrap.get('OsClientType') == 'Product'
            and bootstrap.get('OsClientNetwork') == 'Internal', 'Wrong bootstrap identity')
    effective = {key: main.get(key) for key in INFRA_FIELDS}
    if not str(effective.get('RedisHost') or '').strip():
        for key in ('RedisHost', 'RedisPort', 'RedisPwd', 'RedisDataBase'):
            effective[key] = bootstrap.get('OsClient' + key)
        require(all(str(effective.get(key) or '').strip() for key in ('RedisHost', 'RedisPort', 'RedisPwd')),
                'Missing main Redis inheritance')
    require(not str(row.get('DbMongoConnection') or '').strip(), 'Fresh tenant unexpectedly owns Mongo connection')
    if not str(effective.get('DbMongoConnection') or '').strip():
        effective['DbMongoConnection'] = bootstrap.get('OsClientDbMongoConn')
    redis = context['redis']
    require(effective['RedisHost'] == redis['host'] and int(effective['RedisPort']) == redis['port']
            and (effective['RedisPwd'] or '') == redis['password'], 'Wrong effective Redis bridge')
    require(effective['DbMongoConnection'] == context['mongo']['localUri'], 'Wrong effective Mongo bridge')
    redis_db = int(effective['RedisDataBase'])
    require(redis_db == redis['database'], 'Wrong inherited Redis database')
    canonical = lambda value: sha(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8'))
    return {'mainTenantId': main['Id'],
            'mainInfrastructureSha256': canonical({key: main.get(key) for key in INFRA_FIELDS}),
            'tenantInfrastructureSha256': canonical({key: row.get(key) for key in INFRA_FIELDS}),
            'effectiveInfrastructureSha256': canonical(effective),
            'bootstrapSha256': canonical(bootstrap),
            'redis': {'host': effective['RedisHost'], 'port': int(effective['RedisPort']), 'database': redis_db}}


def verify_registration(row, owner_id, schemas, context, main, bootstrap):
    tenant, expected_db = context['tenant'], 'microi_' + context['tenant'].replace('-', '_')
    require(row.get('OsClient') == tenant, 'Actual tenant case differs')
    identifier(row.get('Id'))
    require(row.get('OwnerUserId') == identifier(owner_id), 'Registered owner differs')
    require(row.get('OsClientType') == 'Product' and row.get('OsClientNetwork') == 'Internal', 'Wrong tenant tuple')
    require(int(row.get('IsEnable') or 0) == 1 and int(row.get('IsDeleted') or 0) == 0, 'Inactive registration')
    parts = parse_conn(row.get('DbConn'))
    registered = parts.get('database')
    require(registered in (expected_db, expected_db.lower()), 'Connection outside derived database')
    mysql = context['mysql']
    # Formal provisioning creates its own DB principal/password. Only transport and
    # derived database are inherited; the entire registered string is hash-bound below.
    require(parts.get('server') == mysql['host'] and parts.get('port') == str(mysql['port'])
            and parts.get('user id') and parts.get('password'), 'Wrong registered MySQL bridge')
    require(len(schemas) == 1 and schemas[0] in (expected_db, expected_db.lower()), 'Physical schema missing or ambiguous')
    require(registered == schemas[0], 'Registered/physical casing differs')
    infra = infrastructure(row, main, bootstrap, context)
    return {'task': context['task'], 'owner32': context['owner32'], 'owner': context['owner32'], 'tenant': tenant,
            'tenantId': row['Id'], 'ownerUserId': owner_id, 'returnedDbName': expected_db,
            'database': schemas[0], 'registeredDatabase': registered, 'parentDatabase': context['parentDatabase'],
            'registeredDbConnSha256': sha(row['DbConn'].encode('utf-8')), **infra}


def verify_parent_cursor(cur, context):
    cur.execute('SELECT DATABASE() AS Name')
    require(cur.fetchone() == {'Name': context['parentDatabase']}, 'Parent physical database differs')
    cur.execute('SELECT Id,TaskId FROM `_ui_full_owner`')
    require(cur.fetchall() == [{'Id': 1, 'TaskId': context['fixtureOwner']}], 'Borrowed parent ownership differs')


def read_main(cur, context):
    cur.execute('SELECT Id,OsClient,OsClientType,OsClientNetwork,IsEnable,IsDeleted,RedisHost,RedisPort,RedisPwd,RedisDataBase,DbMongoConnection '
                'FROM sys_osclients WHERE BINARY OsClient=BINARY %s', (context['mainTenant'],))
    rows = cur.fetchall()
    require(len(rows) == 1, 'Main infrastructure registration is missing or ambiguous')
    return rows[0]


class Registry:
    def __init__(self, context):
        self.context = context.verify()
        self.c = context.data
        self.db = 'microi_' + self.c['tenant']

    def connect(self, database=None):
        self.context.verify()
        database = self.c['parentDatabase'] if database is None else database
        require(database in (self.c['parentDatabase'], self.db, self.db.lower()), 'Unregistered database')
        import pymysql
        values = dict(self.c['mysql'])
        values.update(database=database, charset='utf8mb4', autocommit=False,
                      connect_timeout=5, read_timeout=15, write_timeout=15, cursorclass=pymysql.cursors.DictCursor)
        return pymysql.connect(**values)

    def check_parent(self):
        # Runs BEFORE AddSysUser. It reads only the fixed marker, main registration,
        # exact derived tenant/schema/account; collisions are never adopted.
        with self.connect() as conn, conn.cursor() as cur:
            verify_parent_cursor(cur, self.c)
            main = read_main(cur, self.c)
            infra = infrastructure({}, main, self.context.bootstrap, self.c)
            cur.execute('SELECT Id FROM sys_user WHERE LOWER(Account)=LOWER(%s) OR BINARY Remark=BINARY %s',
                        ('admissiono' + self.c['owner32'][:15], self.c['task'] + ':' + self.c['owner32']))
            require(not cur.fetchall(), 'Owner account already exists; no adoption')
            cur.execute('SELECT Id FROM sys_osclients WHERE LOWER(OsClient)=LOWER(%s)', (self.c['tenant'],))
            require(not cur.fetchall(), 'Tenant already exists; no adoption')
            cur.execute('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE LOWER(SCHEMA_NAME)=LOWER(%s)', (self.db,))
            require(not cur.fetchall(), 'Derived database already exists; no adoption')
        return {'task': self.c['task'], 'owner32': self.c['owner32'], 'parentVerified': True,
                'contextSha256': self.context.expected_hash, **infra}

    def owner_id(self):
        owner = self.context.load('owner.result.json')
        require(owner.get('task') == self.c['task'] and owner.get('owner32') == self.c['owner32']
                and owner.get('tenant') == self.c['mainTenant'], 'Wrong owner stage')
        return identifier(owner['user']['Id'])

    def parent_read(self):
        owner_id = self.owner_id()
        with self.connect() as conn, conn.cursor() as cur:
            verify_parent_cursor(cur, self.c)
            cur.execute('SELECT Id,Account,Name,Remark,State,Level,IsDeleted,TenantId FROM sys_user WHERE BINARY Id=BINARY %s', (owner_id,))
            owners = cur.fetchall()
            require(len(owners) == 1, 'Owner user is missing or ambiguous')
            row = owners[0]
            require(row['Account'] == 'admissiono' + self.c['owner32'][:15]
                    and row['Name'] == 'Admission ' + self.c['owner32']
                    and row['Remark'] == self.c['task'] + ':' + self.c['owner32'], 'Owned main user differs')
            require(int(row.get('State') or 0) == 1 and int(row.get('Level') or 0) == 0
                    and int(row.get('IsDeleted') or 0) == 0, 'Owner is not active ordinary user')
            cur.execute('SELECT Id,OsClient,OsClientType,OsClientNetwork,OwnerUserId,DbConn,IsEnable,IsDeleted,RedisHost,RedisPort,RedisPwd,RedisDataBase,DbMongoConnection '
                        'FROM sys_osclients WHERE LOWER(OsClient)=LOWER(%s)', (self.c['tenant'],))
            registrations = cur.fetchall()
            main = read_main(cur, self.c)
            cur.execute('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE LOWER(SCHEMA_NAME)=LOWER(%s)', (self.db,))
            schemas = [item['SCHEMA_NAME'] for item in cur.fetchall()]
        return row, registrations, schemas, main

    def inspect(self):
        owner_id = self.owner_id()
        formal = self.context.load('tenant.result.json')
        require(formal.get('task') == self.c['task'] and formal.get('owner32') == self.c['owner32']
                and formal.get('ownerUserId') == owner_id, 'Wrong formal receipt')
        response = formal['response']
        require(response.get('Code') == 1 and response['Data'].get('OsClient') == self.c['tenant']
                and response['Data'].get('DbName') == self.db, 'No matching formal successful tenant result')
        require(response['Data'].get('FreeTenantCreated') is True and isinstance(response['Data'].get('Upgrade'), dict),
                'Formal upgrade receipt missing')
        owner, registrations, schemas, main = self.parent_read()
        require(owner.get('TenantId') == self.c['tenant'], 'Formal main owner tenant link differs')
        require(len(registrations) == 1, 'Registration is missing or ambiguous')
        config = verify_registration(registrations[0], owner_id, schemas, self.c, main, self.context.bootstrap)
        with self.connect(config['database']) as conn, conn.cursor() as cur:
            cur.execute('SELECT DATABASE() AS Name')
            require(cur.fetchone() == {'Name': config['database']}, 'Physical database differs')
            cur.execute('SELECT ApiEngineKey FROM sys_apiengine WHERE ApiEngineKey IN (%s,%s) AND IsDeleted=0',
                        ('platform-chat-runtime', 'platform-chat-maintenance'))
            require(sorted(row['ApiEngineKey'] for row in cur.fetchall()) == ['platform-chat-maintenance', 'platform-chat-runtime'],
                    'Upgraded fixed Managed resources missing/duplicate')
        config['nativeScopeSha256'] = self.context.expected_hash
        config['contextSha256'] = self.context.expected_hash
        config['protocolSourceHashes'] = {relative: sha((ROOT / relative).read_bytes()) for relative in PROTOCOL}
        config['registrationVerifierSha256'] = sha(pathlib.Path(__file__).read_bytes())
        return config

    def preflight(self):
        owner, registrations, schemas, main = self.parent_read()
        infrastructure({}, main, self.context.bootstrap, self.c)
        require(not registrations and not schemas, 'Tenant or physical DB already exists; no adoption')
        require(not owner.get('TenantId'), 'Owner already has tenant link')
        result = {'task': self.c['task'], 'owner32': self.c['owner32'], 'ownerUserId': self.owner_id(), 'tenant': self.c['tenant'],
                  'targetAbsent': True, 'nativeScopeSha256': self.context.expected_hash,
                  'at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
        self.context.save('target-absent.json', result)
        return result

    def claim(self):
        config = self.inspect()
        absent = self.context.load('target-absent.json')
        require(absent.get('targetAbsent') is True and absent.get('task') == self.c['task']
                and absent.get('tenant') == self.c['tenant'] and absent.get('owner32') == self.c['owner32']
                and absent.get('ownerUserId') == config['ownerUserId']
                and absent.get('nativeScopeSha256') == self.context.expected_hash, 'Missing pre-create absence proof')
        require(not (self.context.private / 'claim.intent.json').exists()
                and not (self.context.private / 'admission-fixture.json').exists(), 'Prior claim must be reconciled; no retry')
        self.context.save('claim.intent.json', config)
        # New derived DB only; deliberately no IF NOT EXISTS or adoption after unknown DDL.
        with self.connect(config['database']) as conn:
            with conn.cursor() as cur:
                cur.execute('CREATE TABLE `_agent_admission_owner` ('
                            '`Id` INT PRIMARY KEY, `Task` VARCHAR(100) NOT NULL, `Owner` CHAR(32) NOT NULL,'
                            '`Tenant` VARCHAR(80) NOT NULL, `TenantId` VARCHAR(100) NOT NULL, `OwnerUserId` VARCHAR(100) NOT NULL)'
                            ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin')
                cur.execute('INSERT INTO `_agent_admission_owner` (Id,Task,Owner,Tenant,TenantId,OwnerUserId) VALUES (1,%s,%s,%s,%s,%s)',
                            (self.c['task'], self.c['owner32'], self.c['tenant'], config['tenantId'], config['ownerUserId']))
                require(cur.rowcount == 1, 'Marker insert count differs')
            conn.commit()
        with self.connect(config['database']) as conn, conn.cursor() as cur:
            cur.execute('SELECT Id,Task,Owner,Tenant,TenantId,OwnerUserId FROM `_agent_admission_owner`')
            require(cur.fetchall() == [{'Id': 1, 'Task': self.c['task'], 'Owner': self.c['owner32'], 'Tenant': self.c['tenant'],
                                        'TenantId': config['tenantId'], 'OwnerUserId': config['ownerUserId']}], 'Owner marker differs')
        require(self.inspect() == config, 'Registration changed during marker claim')
        self.context.save('admission-fixture.json', config)
        return config


def main():
    args = arguments(('check-parent', 'preflight', 'inspect', 'claim'))
    context = Context(args.context, args.context_sha256)
    result = getattr(Registry(context), args.action.replace('-', '_'))()
    print(json.dumps({'task': context.data['task'], 'action': args.action, 'tenant': context.data['tenant'],
                      'verified': True, 'configurationSha256': sha(json.dumps(result, sort_keys=True).encode('utf-8'))}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Native failures can include SQL/credentials. Preserve intent, disclose only type/code.
        print(json.dumps({'verified': False, 'errorType': type(error).__name__,
                          'errorCode': error.args[0] if error.args and isinstance(error.args[0], int) else None}), file=sys.stderr)
        sys.exit(1)
