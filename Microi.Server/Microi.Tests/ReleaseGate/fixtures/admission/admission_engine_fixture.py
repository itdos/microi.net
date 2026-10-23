"""仅独占 admission 测试租户的两个固定引擎：字节 CAS、原文备份与未知结果回读。

生产 API 不引用本文件。没有 SQL/连接/表/Key 的自由输入；不创建租户或服务。
"""
import argparse
import base64
import datetime
import decimal
import hashlib
import json
import pathlib
import re
import sys

sys.dont_write_bytecode = True
from acl_guard import Context, ROOT, PROTOCOL, ACL_VERIFIER, check
import register_fixture as registration

KEYS = ('platform-chat-runtime', 'platform-chat-maintenance')
FIELDS = ('ApiName', 'ApiV8Code', 'IsEnable', 'AllowAnonymous', 'StopHttp', 'Lock', 'ApiRole')
CHANNEL = 'microi:cache:invalidate'


class BoundaryError(RuntimeError):
    pass


def require(condition, message):
    if not condition:
        raise BoundaryError(message)


def decode_mysql_bit(value):
    # PyMySQL BIT(1) is binary, unlike integer flags. Preserve its exact 0/1 value;
    # arbitrary binary columns keep the original byte codec and binary CAS.
    require(isinstance(value, bytes) and len(value) == 1 and value[0] in (0, 1), 'Unsupported native BIT flag')
    return value[0]


def native_bit_conversions(conversions, bit_type):
    result = dict(conversions)
    result[bit_type] = decode_mysql_bit
    return result


def encoded(value):
    if isinstance(value, bytes):
        return {'$bytes': base64.b64encode(value).decode('ascii')}
    if isinstance(value, datetime.datetime):
        return {'$datetime': value.isoformat(timespec='microseconds')}
    if isinstance(value, datetime.date):
        return {'$date': value.isoformat()}
    if isinstance(value, datetime.timedelta):
        return {'$timedelta': str(value.total_seconds())}
    if isinstance(value, decimal.Decimal):
        return {'$decimal': str(value)}
    if isinstance(value, dict):
        return {key: encoded(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [encoded(item) for item in value]
    require(value is None or isinstance(value, (str, int, float, bool)), 'Unsupported native row value')
    return value


def decoded(value):
    if isinstance(value, dict):
        if set(value) == {'$bytes'}:
            return base64.b64decode(value['$bytes'], validate=True)
        if set(value) == {'$datetime'}:
            return datetime.datetime.fromisoformat(value['$datetime'])
        if set(value) == {'$date'}:
            return datetime.date.fromisoformat(value['$date'])
        if set(value) == {'$timedelta'}:
            return datetime.timedelta(seconds=float(value['$timedelta']))
        if set(value) == {'$decimal'}:
            return decimal.Decimal(value['$decimal'])
        return {key: decoded(item) for key, item in value.items()}
    if isinstance(value, list):
        return [decoded(item) for item in value]
    return value


def wire(value):
    return json.dumps(encoded(value), ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


def digest(value):
    return hashlib.sha256(wire(value)).hexdigest()


def body_hash(row):
    return hashlib.sha256(str(row.get('ApiV8Code') or '').encode('utf-8')).hexdigest()


def write_new(file, value, context=None):
    if context:
        context.verify()
        context.owned_path(file, creating=True)
    # 意图与原文都先以 CreateNew 落盘；已有未知结果只读恢复，不重发写入。
    with pathlib.Path(file).open('xb') as stream:
        stream.write(wire(value) + b'\n')
        stream.flush()
        import os
        if os.name != 'nt':
            os.chmod(file, 0o600)
        os.fsync(stream.fileno())
    if context:
        context.owned_path(file)


def read(file, context=None):
    if context:
        context.owned_path(file)
    require(pathlib.Path(file).stat().st_size <= 4 * 1024 * 1024, 'Private journal exceeds bound')
    return decoded(json.loads(pathlib.Path(file).read_text(encoding='utf-8')))


def binding(config, context):
    c = context.data
    require(config.get('task') == c['task'], 'Wrong fixture task')
    owner = config.get('owner', '')
    require(re.fullmatch('[a-f0-9]{32}', owner) is not None, 'Invalid fixture owner')
    require(owner == c['owner32'] and config.get('owner32') == owner, 'Fixture owner aliases differ')
    tenant = config.get('tenant', '')
    require(tenant == c['tenant'], 'Wrong admission tenant')
    expected_db = 'microi_' + tenant.replace('-', '_')
    require(config.get('returnedDbName') == expected_db, 'Wrong formal tenant database return')
    require(config.get('database') in (expected_db, expected_db.lower()), 'Wrong admission physical database')
    require(config.get('registeredDatabase') == config['database'], 'Registered/physical database mapping is not verified')
    require(config.get('parentDatabase') == c['parentDatabase'], 'Wrong fixture parent')
    for key in ('tenantId', 'ownerUserId'):
        require(re.fullmatch('(?:[0-9A-HJKMNP-TV-Z]{26}|[a-fA-F0-9]{32}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12})', config.get(key, '')) is not None, 'Missing fixture identity')
    require(config.get('contextSha256') == config.get('nativeScopeSha256') == context.expected_hash, 'Wrong frozen context hash')
    require(re.fullmatch('[a-f0-9]{64}', config.get('registeredDbConnSha256', '')) is not None, 'Missing registered tenant connection hash')
    for key in ('mainInfrastructureSha256', 'tenantInfrastructureSha256', 'effectiveInfrastructureSha256', 'bootstrapSha256', 'registrationVerifierSha256'):
        require(re.fullmatch('[a-f0-9]{64}', config.get(key, '')) is not None, 'Missing effective infrastructure proof')
    redis = config.get('redis', {})
    require(redis.get('host') == c['redis']['host'] and redis.get('port') == c['redis']['port'], 'Wrong admission Redis transport')
    require(redis.get('database') == c['redis']['database'], 'Invalid admission Redis database')
    return config


def validate_row(row, key):
    require(key in KEYS and row.get('ApiEngineKey') == key, 'Wrong engine Key')
    require(isinstance(row.get('Id'), str) and row['Id'].strip(), 'Missing engine Id')
    require(int(row.get('IsDeleted') or 0) == 0, 'Deleted engine cannot become fixture')
    require(all(re.fullmatch('[A-Za-z_][A-Za-z0-9_]*', col) for col in row), 'Unsupported column identifier')
    require(all(col in row for col in FIELDS), 'Managed engine schema is incomplete')
    require(isinstance(row.get('ApiV8Code'), str), 'Missing original engine source')


def patched(rows, request, owner):
    action = request.get('action')
    result = {key: dict(row) for key, row in rows.items()}
    if action == 'install':
        patches = request.get('engines', {})
        require(set(patches) == set(KEYS), 'Install requires exactly two fixed engines')
        for key in KEYS:
            patch = patches[key]
            require(set(patch) == set(FIELDS), 'Unexpected engine fixture fields')
            require(patch['ApiName'] == 'admission-fixture-' + owner, 'Missing engine owner marker')
            require(isinstance(patch['ApiV8Code'], str) and 1 <= len(patch['ApiV8Code']) <= 20000, 'Invalid fixture source')
            require(patch['IsEnable'] == 1 and patch['AllowAnonymous'] == 0 and patch['StopHttp'] == 0 and patch['Lock'] == 0 and patch['ApiRole'] == '[]', 'Fixture permission boundary differs')
            result[key].update(patch)
    elif action == 'lock':
        require(request.get('value') in (0, 1) and type(request.get('value')) is int, 'Invalid lock value')
        require(all(row['ApiName'] == 'admission-fixture-' + owner for row in rows.values()), 'Fixture is not installed')
        result[KEYS[0]]['Lock'] = request['value']
    else:
        raise BoundaryError('Unsupported fixture mutation')
    return result


def cas_statement(before, after):
    require(set(before) == set(after), 'Column set changed')
    validate_row(before, before.get('ApiEngineKey'))
    require(before['Id'] == after['Id'] and before['ApiEngineKey'] == after['ApiEngineKey'], 'Identity cannot change')
    changed = [key for key in sorted(before) if wire(before[key]) != wire(after[key])]
    require(set(changed).issubset(FIELDS), 'Only fixture engine fields may change')
    if not changed:
        return None
    columns = sorted(before)
    # 文本/二进制逐字节 NULL-safe 比较，拒绝大小写或尾空格漂移；数值/日期按列的原生类型比较。
    # DATETIME(3) 转 BINARY 是三位小数，但驱动参数可能补齐六位，不能让格式差异阻断同值恢复。
    checks = [('BINARY `' + key + '` <=> BINARY %s') if isinstance(before[key], (str, bytes)) or before[key] is None
              else ('`' + key + '` <=> %s') for key in columns]
    sql = ('UPDATE `sys_apiengine` SET ' + ','.join('`' + key + '`=%s' for key in changed)
           + ' WHERE ' + ' AND '.join(checks))
    return sql, tuple(after[key] for key in changed) + tuple(before[key] for key in columns)


def outcome(current, before, after):
    if digest(current) == digest(after):
        return 'Applied'
    if digest(current) == digest(before):
        return 'NotApplied'
    return 'ConflictOrUnknown'


def cache_keys(tenant, rows):
    require(re.fullmatch(r'adm_[a-f0-9]{32}', tenant.lower()), 'Wrong cache tenant')
    aliases = set()
    for key in KEYS:
        row = rows[key]
        validate_row(row, key)
        values = [row['Id'], key, row.get('ApiAddress') or ''] + str(row.get('ApiRoutes') or '').split(';')
        require(len(values) <= 132, 'Too many engine aliases')
        for value in values:
            alias = str(value).strip().lower()
            if not alias:
                continue
            require(len(alias) <= 500 and not any(ch in alias for ch in ('*', '?', '[', ']', '|', '\r', '\n')), 'Unsafe cache alias')
            aliases.add('Microi:' + tenant + ':FormData:sys_apiengine:' + alias)
    require(len(aliases) <= 16, 'Fixture cache alias budget exceeded')
    return sorted(aliases)


class NativeStore:
    def __init__(self, config, context):
        self.context = context.verify()
        self.config = binding(config, context)
        self.scope = context.data
        require(set(config.get('protocolSourceHashes', {})) == set(PROTOCOL), 'Missing protocol source hashes')
        for relative in PROTOCOL:
            require(hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == config['protocolSourceHashes'][relative], 'Protocol source changed')
        require(hashlib.sha256(pathlib.Path(registration.__file__).read_bytes()).hexdigest() == config['registrationVerifierSha256'], 'Registration verifier changed')
        self.verify_owner()

    def connection(self, database):
        self.context.verify()
        require(database in (self.config['database'], self.config['parentDatabase']), 'Unregistered database')
        import pymysql
        from pymysql.constants import FIELD_TYPE
        values = dict(self.scope['mysql'])
        values.update(database=database, connect_timeout=5, read_timeout=15, write_timeout=15,
                      charset='utf8mb4', autocommit=False, cursorclass=pymysql.cursors.DictCursor,
                      conv=native_bit_conversions(pymysql.converters.conversions, FIELD_TYPE.BIT))
        return pymysql.connect(**values)

    def verify_owner(self):
        c = self.config
        with self.connection(c['database']) as conn, conn.cursor() as cur:
            cur.execute('SELECT DATABASE() AS Name')
            require(cur.fetchone()['Name'] == c['database'], 'Physical database resolution differs')
            cur.execute('SELECT Task,Owner,Tenant,TenantId,OwnerUserId FROM `_agent_admission_owner` WHERE Id=1')
            row = cur.fetchone()
            require(row == {key: c[value] for key, value in [('Task', 'task'), ('Owner', 'owner'), ('Tenant', 'tenant'), ('TenantId', 'tenantId'), ('OwnerUserId', 'ownerUserId')]}, 'New database owner marker differs')
            cur.execute('SELECT COUNT(*) AS N FROM `_agent_admission_owner`')
            require(cur.fetchone()['N'] == 1, 'Ambiguous new database owner')
        with self.connection(c['parentDatabase']) as conn, conn.cursor() as cur:
            registration.verify_parent_cursor(cur, self.scope)
            cur.execute('SELECT OsClient,Id,OwnerUserId,DbConn,OsClientType,OsClientNetwork,IsEnable,IsDeleted,RedisHost,RedisPort,RedisPwd,RedisDataBase,DbMongoConnection FROM sys_osclients WHERE BINARY Id=BINARY %s AND IsDeleted=0', (c['tenantId'],))
            rows = cur.fetchall()
            require(len(rows) == 1, 'Missing exact parent tenant registration')
            row = rows[0]
            require(row['OsClient'] == c['tenant'] and row['OwnerUserId'] == c['ownerUserId'], 'Parent tenant identity differs')
            cur.execute('SELECT Id,OsClient,OsClientType,OsClientNetwork,IsEnable,IsDeleted,RedisHost,RedisPort,RedisPwd,RedisDataBase,DbMongoConnection '
                        'FROM sys_osclients WHERE BINARY OsClient=BINARY %s', (self.scope['mainTenant'],))
            mains = cur.fetchall()
            require(len(mains) == 1, 'Main infrastructure registration is missing or ambiguous')
            verified = registration.verify_registration(row, c['ownerUserId'], [c['database']], self.scope,
                                                        mains[0], self.context.bootstrap)
            require(all(c.get(key) == value for key, value in verified.items()), 'Effective inherited infrastructure changed')

    def rows(self):
        self.verify_owner()
        with self.connection(self.config['database']) as conn, conn.cursor() as cur:
            cur.execute('SELECT * FROM sys_apiengine WHERE ApiEngineKey IN (%s,%s)', KEYS)
            rows = cur.fetchall()
        require(len(rows) == 2 and {row.get('ApiEngineKey') for row in rows} == set(KEYS), 'Fixed engines are missing or duplicated')
        result = {row['ApiEngineKey']: row for row in rows}
        for key, row in result.items():
            validate_row(row, key)
        return result

    def replace(self, before, after):
        self.verify_owner()
        counts = []
        with self.connection(self.config['database']) as conn:
            try:
                with conn.cursor() as cur:
                    for key in KEYS:
                        command = cas_statement(before[key], after[key])
                        if command is None:
                            counts.append(0)
                            continue
                        cur.execute(*command)
                        counts.append(cur.rowcount)
                        require(cur.rowcount == 1, 'Native engine byte CAS conflict')
                conn.commit()
            except BaseException:
                try:
                    conn.rollback()
                except BaseException:
                    pass
                raise
        return counts

    def invalidate(self, rows):
        import redis
        self.verify_owner()
        # Only the same bootstrap-verified loopback bridge; no credential discovery or alternate transport.
        settings = dict(self.scope['redis'])
        client = redis.Redis(host=settings['host'], port=int(settings['port']), password=settings.get('password'),
                             db=self.config['redis']['database'], socket_connect_timeout=5, socket_timeout=5)
        keys = cache_keys(self.config['tenant'], rows)
        records = []
        try:
            # 一次有界 pipeline，仅这两个资源的确切键；无 SCAN、通配删除或无限重试。
            pipeline = client.pipeline(transaction=False)
            for key in keys:
                pipeline.delete(key)
                pipeline.publish(CHANNEL, 'admission-fixture-' + self.config['owner'] + '|' + key)
            results = pipeline.execute()
            for index, key in enumerate(keys):
                records.append({'key': key, 'removed': int(results[index * 2]), 'subscribers': int(results[index * 2 + 1])})
        finally:
            client.close()
        return records


def run(request, store, folder):
    config = store.config
    context = getattr(store, 'context', None)
    read_record = lambda file: read(file, context)
    write_record = lambda file, value: write_new(file, value, context)
    require(request.get('owner') == config['owner'] and request.get('tenant') == config['tenant'], 'Wrong request ownership')
    request_id = request.get('requestId', '')
    require(re.fullmatch('[a-f0-9]{32}', request_id) is not None, 'Invalid fixture request Id')
    action = request.get('action')
    require(action in ('snapshot', 'install', 'lock', 'restore', 'status'), 'Unsupported fixture action')
    folder = pathlib.Path(folder)
    if context:
        expected = context.private / ('admission-engines-' + config['owner'] + '-' + request.get('runId', ''))
        require(folder == expected and re.fullmatch('[a-f0-9]{32}', request.get('runId', '')), 'Wrong journal directory')
        context.owned_path(folder, creating=not folder.exists())
    # Windows 的 Python 0o700 会另建包含管理员组的 DACL，破坏已验证父目录的两主体边界。
    # 新子目录沿用父目录继承；POSIX 仍使用 0700。既有目录不改权限，随后严格复核。
    folder.mkdir(mode=0o777 if sys.platform == 'win32' else 0o700, exist_ok=True)
    if context:
        context.owned_path(folder)
    backup = folder / 'original.json'
    if not backup.exists():
        require(action == 'snapshot', 'Original backup is required before writes')
        originals = store.rows()
        write_record(backup, {'task': config['task'], 'owner': config['owner'], 'tenant': config['tenant'], 'rows': originals, 'sha256': digest(originals)})
    original = read_record(backup)
    require(original['task'] == config['task'] and original['owner'] == config['owner'] and original['tenant'] == config['tenant'] and original['sha256'] == digest(original['rows']), 'Original backup identity/hash differs')
    current = store.rows()
    state = original['rows']
    # 按持久意图顺序恢复状态。未知提交先读回；永不按超时猜失败或重发同一写入。
    intents = sorted(folder.glob('intent-*.json'))
    require(len(intents) <= 8, 'Fixture action budget exceeded')
    for item in intents:
        intent = read_record(item)
        require(intent['beforeHash'] == digest(state), 'Fixture journal continuity differs')
        result_file = folder / ('result-' + intent['requestId'] + '.json')
        if result_file.exists():
            result = read_record(result_file)
            require(result['requestHash'] == intent['requestHash'], 'Fixture result binding differs')
            if result['outcome'] == 'Applied':
                state = intent['after']
            else:
                require(result['outcome'] == 'NotApplied', 'Unresolved prior fixture mutation')
        else:
            resolved = outcome(current, intent['before'], intent['after'])
            require(resolved != 'ConflictOrUnknown', 'Unknown prior fixture write: readback does not match either complete state')
            invalidation = store.invalidate(current) if resolved == 'Applied' else []
            write_record(result_file, {'requestHash': intent['requestHash'], 'outcome': resolved, 'rowCounts': None, 'recoveredByReadback': True, 'cacheInvalidations': invalidation})
            if resolved == 'Applied':
                state = intent['after']
    require(digest(current) == digest(state), 'External engine change: original and fixture evidence retained')
    summary = {'task': config['task'], 'owner': config['owner'], 'tenant': config['tenant'], 'rowsHash': digest(current),
               'engines': {key: {'Id': row['Id'], 'bodySha256': body_hash(row), 'rowSha256': digest(row)} for key, row in current.items()}}
    if action in ('snapshot', 'status'):
        return {**summary, 'Code': 1, 'mutated': False, 'originalHash': original['sha256']}
    if any(read_record(item)['requestId'] == request_id for item in intents):
        require(any(read_record(item)['requestId'] == request_id and read_record(item)['requestHash'] == digest(request) for item in intents), 'RequestId conflict')
        prior = read_record(folder / ('result-' + request_id + '.json'))
        require(prior['outcome'] == 'Applied', 'Prior fixture mutation was not applied; refusing to report a successful replay')
        return {**summary, 'Code': 1, 'mutated': False, 'duplicate': True}
    if action == 'install':
        require(not intents, 'Fixture was already started; use a new registered run for a new test')
    require(len(intents) < 8, 'Fixture mutation budget exceeded')
    after = original['rows'] if action == 'restore' else patched(current, request, config['owner'])
    cache_keys(config['tenant'], after)  # 先验证失效范围，再允许发出数据库写入。
    intent = {'task': config['task'], 'owner': config['owner'], 'requestId': request_id, 'requestHash': digest(request),
              'action': action, 'beforeHash': digest(current), 'afterHash': digest(after), 'before': current, 'after': after}
    write_record(folder / ('intent-' + str(len(intents)).zfill(4) + '-' + request_id + '.json'), intent)
    counts = None
    failure = None
    try:
        counts = store.replace(current, after)
    except BaseException as error:
        failure = type(error).__name__
    observed = store.rows()
    resolved = outcome(observed, current, after)
    require(resolved != 'ConflictOrUnknown', 'Unknown engine mutation: retain intent and original source; no retry')
    invalidation = store.invalidate(observed) if resolved == 'Applied' else []
    result = {'requestHash': intent['requestHash'], 'outcome': resolved, 'rowCounts': counts,
              'bodyHashes': {key: body_hash(row) for key, row in observed.items()},
              'readbackHash': digest(observed), 'recoveredByReadback': failure is not None,
              'errorType': failure, 'cacheInvalidations': invalidation}
    write_record(folder / ('result-' + request_id + '.json'), result)
    require(resolved == 'Applied', 'Fixture mutation was not applied')
    return {**summary, 'Code': 1, 'rowsHash': digest(observed), 'mutated': counts is not None and any(counts), **result}


def record_process_failure(request, config, context):
    """仅把失败进程的有界正文存入已验证私有目录；不构造 store、不连接或重试数据库。"""
    require(set(request) == {'owner', 'tenant', 'runId', 'requestId', 'action', 'exitCode', 'stdout', 'stderr'}, 'Unexpected process evidence fields')
    require(request['owner'] == config['owner'] and request['tenant'] == config['tenant'], 'Wrong process evidence ownership')
    for key in ('runId', 'requestId'):
        require(re.fullmatch('[a-f0-9]{32}', request[key] or '') is not None, 'Invalid process evidence identity')
    require(request['action'] in ('snapshot', 'status', 'install', 'lock', 'restore'), 'Unsupported failed action')
    require(type(request['exitCode']) is int and -2147483648 <= request['exitCode'] <= 2147483647, 'Invalid failed exit code')
    for key in ('stdout', 'stderr'):
        value = request[key]
        require(isinstance(value, dict) and set(value) == {'text', 'characters', 'utf16LeSha256', 'truncated'}, 'Invalid bounded process stream')
        require(isinstance(value['text'], str), 'Missing process stream text')
        text = value['text'].encode('utf-16-le', errors='strict')
        units = len(text) // 2
        require(units <= 65536 and type(value['characters']) is int and units <= value['characters'] <= 2147483647, 'Process stream bound differs')
        require(type(value['truncated']) is bool and value['truncated'] == (value['characters'] > units), 'Process stream truncation differs')
        require(re.fullmatch('[a-f0-9]{64}', value['utf16LeSha256'] or '') is not None, 'Missing whole stream hash')
        if not value['truncated']:
            require(hashlib.sha256(text).hexdigest() == value['utf16LeSha256'], 'Complete stream hash differs')
    name = 'native-control-failure-' + request['requestId'] + '.json'
    # Context.save 同时执行源/上下文/ACL 校验与 CreateNew；权限拒绝不得换路径或改 ACL。
    context.save(name, {'schema': 'microi.admission.native-process-failure.v1', 'task': config['task'],
                       'sourceHead': context.data['sourceHead'], 'attempt': context.data['attempt'], **request})
    return {'Code': 1, 'file': name, 'sqlWrites': 0, 'databaseConnections': 0}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--context', required=True)
    parser.add_argument('--context-sha256', required=True)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--stdio', action='store_true')
    group.add_argument('--verify-owner', action='store_true')
    group.add_argument('--record-process-failure', action='store_true')
    args = parser.parse_args()
    context = Context(args.context, args.context_sha256)
    config = binding(context.load('admission-fixture.json'), context)
    if args.record_process_failure:
        raw = sys.stdin.read(1048577)
        require(len(raw) <= 1048576, 'Private process evidence exceeds bound')
        print(json.dumps(record_process_failure(json.loads(raw), config, context)))
        return
    store = NativeStore(config, context)
    if args.verify_owner:
        rows = store.rows()
        print(json.dumps({'Code': 1, 'task': config['task'], 'owner': config['owner'], 'tenant': config['tenant'],
                          'readOnly': True, 'rowsHash': digest(rows)}))
        return
    raw = sys.stdin.read(100001)
    require(len(raw) <= 100000, 'Fixture request exceeds bound')
    request = json.loads(raw)
    run_id = request.get('runId', '')
    require(re.fullmatch('[a-f0-9]{32}', run_id) is not None, 'Invalid run Id')
    folder = context.private / ('admission-engines-' + config['owner'] + '-' + run_id)
    print(json.dumps(run(request, store, folder), ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        # Native exceptions can contain credentials/source. Keep evidence private.
        print(json.dumps({'Code': 0, 'errorType': type(error).__name__,
                          'errorCode': error.args[0] if error.args and isinstance(error.args[0], int) else None}), file=sys.stderr)
        sys.exit(1)
