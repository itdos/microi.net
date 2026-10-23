"""Test-only admission boundary. No credential discovery or configurable code loading."""
import argparse
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import stat
import subprocess
import sys
import urllib.parse
import uuid

sys.dont_write_bytecode = True
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]
ACL_VERIFIER = HERE.parent / 'native-mysql-client.py'
PROTOCOL = (
    'Microi.Server/Microi.Cache/MicroiTwoLevelCache.cs',
    'Microi.Server/Microi.Cache/MicroiTwoLevelCacheConfig.cs',
    'Microi.Server/Microi.Core/ApiEngine/ApiEngineRouteAliases.cs',
    'Microi.Server/Microi.net/Common/OsClient.cs',
    'Microi.Server/Microi.Core/SaaSEngine/TenantConfigurationSecurity.cs')
SOURCE_PREFIX = 'Microi.Server/Microi.Tests/ReleaseGate/fixtures/'
REQUIRED_SOURCES = (*PROTOCOL, SOURCE_PREFIX + 'native-mysql-client.py',
                    *(SOURCE_PREFIX + 'admission/' + name for name in
                      ('acl_guard.py', 'register_fixture.py', 'admission_engine_fixture.py')))
BOOTSTRAP_KEYS = {'OsClient', 'OsClientType', 'OsClientNetwork', 'OsClientDbType', 'OsClientDbConn',
                  'OsClientRedisHost', 'OsClientRedisPort', 'OsClientRedisPwd',
                  'OsClientRedisDataBase', 'OsClientDbMongoConn'}


def require(value, message):
    if not value:
        raise ValueError(message)


def sha(value):
    return hashlib.sha256(value).hexdigest()


def same_path(left, right):
    return os.path.normcase(os.path.abspath(left)) == os.path.normcase(os.path.abspath(right))


def check(path, private=True, directory=None):
    path = pathlib.Path(path)
    require(path.is_absolute() and '..' not in path.parts, 'Absolute ordinary path required')
    for item in (path, *path.parents):
        metadata = item.lstat()
        require(not stat.S_ISLNK(metadata.st_mode)
                and not getattr(metadata, 'st_file_attributes', 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT,
                'Reparse point is forbidden')
    require(same_path(path, path.resolve()), 'Resolved path differs')
    if directory is not None:
        require(path.is_dir() if directory else path.is_file(), 'Wrong path kind')
    if private:
        spec = importlib.util.spec_from_file_location('admission_private_acl', ACL_VERIFIER)
        verifier = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(verifier)
        verifier.verify_private_acl(path)
    return path


def read_json(path, private=True, maximum=1024 * 1024):
    path = check(path, private=private, directory=False)
    require(path.stat().st_size <= maximum, 'Bounded JSON file required')
    raw = path.read_bytes()
    require(len(raw) <= maximum, 'JSON size changed')
    return raw, json.loads(raw.decode('utf-8-sig'))


def parse_conn(text):
    # Same bounded quote/doubled-quote grammar as runtime.mjs. Duplicate aliases
    # are rejected before either connection or schema selection.
    require(isinstance(text, str), 'Missing connection')
    aliases = {'host': 'server', 'data source': 'server', 'uid': 'user id', 'user': 'user id',
               'username': 'user id', 'pwd': 'password', 'initial catalog': 'database'}
    parts, part, quote, index = [], '', '', 0
    while index < len(text):
        char = text[index]
        if quote:
            if char == quote:
                if index + 1 < len(text) and text[index + 1] == quote:
                    part += char
                    index += 1
                else:
                    quote = ''
            else:
                part += char
        elif char in ('"', "'"):
            quote = char
        elif char == ';':
            parts.append(part)
            part = ''
        else:
            part += char
        index += 1
    require(not quote, 'Unclosed connection quote')
    parts.append(part)
    result = {}
    for part in parts:
        if not part.strip():
            continue
        require('=' in part, 'Unsupported connection syntax')
        key, value = part.split('=', 1)
        key, value = key.strip().lower(), value.strip()
        key = aliases.get(key, key)
        require(key and key not in result, 'Duplicate connection key')
        require(not any(ch in value for ch in ('\r', '\n')), 'Multiline connection is forbidden')
        result[key] = value
    return result


def port(value):
    require(type(value) is int and 1024 <= value <= 65535, 'Invalid loopback bridge port')
    return value


def validate_context(value):
    require(isinstance(value, dict) and value.get('schema') == 1, 'Wrong context schema')
    for key in ('task', 'attempt', 'fixtureOwner'):
        require(isinstance(value.get(key), str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,99}', value[key]),
                'Invalid context identity')
    require(len(value['task']) <= 67, 'Task and owner marker exceed storage bound')
    build_id = uuid.UUID(value.get('buildId', ''))
    require(str(build_id) == value['buildId'] and build_id.version == 4, 'Invalid build identity')
    require(re.fullmatch(r'[a-f0-9]{40}', value.get('sourceHead', '')), 'Missing source HEAD')
    owner = sha((value['buildId'] + '\0' + value['attempt']).encode('utf-8'))[:32]
    require(value.get('owner32') == owner and value.get('tenant') == 'adm_' + owner,
            'Owner must derive from this build and attempt')
    require(re.fullmatch(r'[A-Za-z0-9_-]{1,50}', value.get('mainTenant', ''))
            and value['mainTenant'].lower() != value['tenant'].lower(), 'Invalid main tenant')
    parent = value.get('parentDatabase', '')
    require(re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,63}', parent)
            and parent.lower() not in {'mysql', 'sys', 'information_schema', 'performance_schema'}
            and parent.lower() != ('microi_' + value['tenant']).lower(), 'Invalid parent database')
    mysql, redis, mongo = (value.get(name, {}) for name in ('mysql', 'redis', 'mongo'))
    require(set(mysql) == {'host', 'port', 'user', 'password'} and mysql['host'] == '127.0.0.1', 'Invalid MySQL boundary')
    port(mysql['port'])
    require(all(isinstance(mysql[key], str) and 0 < len(mysql[key]) <= limit
                for key, limit in (('user', 128), ('password', 4096))), 'Missing MySQL credentials')
    require(set(redis) == {'host', 'port', 'password', 'database'} and redis['host'] == '127.0.0.1', 'Invalid Redis boundary')
    port(redis['port'])
    require(type(redis['database']) is int and 0 <= redis['database'] <= 15
            and isinstance(redis['password'], str) and 0 < len(redis['password']) <= 4096, 'Invalid Redis settings')
    require(set(mongo) == {'localUri'} and isinstance(mongo['localUri'], str), 'Invalid Mongo settings')
    uri = urllib.parse.urlsplit(mongo['localUri'])
    require(uri.scheme == 'mongodb' and uri.hostname == '127.0.0.1' and ',' not in uri.netloc
            and not uri.fragment and not any(key.lower() == 'replicaset' for key, _ in urllib.parse.parse_qsl(uri.query)),
            'Mongo must use a single registered loopback bridge')
    port(uri.port)
    require(len({mysql['port'], redis['port'], uri.port}) == 3, 'Infrastructure bridges overlap')
    endpoint = urllib.parse.urlsplit(value.get('base', ''))
    require(endpoint.scheme == 'http' and endpoint.hostname == '127.0.0.1' and endpoint.port
            and not endpoint.username and not endpoint.password and not endpoint.query and not endpoint.fragment
            and endpoint.path in ('', '/'), 'API must use loopback root')
    require(isinstance(value.get('bootstrapFiles'), list) and len(value['bootstrapFiles']) == 2,
            'Exactly two bootstrap files required')
    for item in value['bootstrapFiles']:
        require(isinstance(item, dict) and set(item) == {'path', 'sha256'}
                and re.fullmatch(r'[a-f0-9]{64}', item['sha256']), 'Missing bootstrap hash')
    require(not same_path(value['bootstrapFiles'][0]['path'], value['bootstrapFiles'][1]['path']), 'Bootstrap paths overlap')
    require(isinstance(value.get('sourceHashes'), dict) and set(REQUIRED_SOURCES) <= set(value['sourceHashes']),
            'Incomplete source closure')
    for relative, digest in value['sourceHashes'].items():
        require(isinstance(relative, str) and '\\' not in relative and ':' not in relative
                and not relative.startswith('/') and '..' not in relative.split('/')
                and re.fullmatch(r'[a-f0-9]{64}', digest), 'Invalid source hash entry')
    return value


def bootstrap_configuration(context):
    values = []
    for item in context['bootstrapFiles']:
        raw, value = read_json(item['path'], maximum=65536)
        require(sha(raw) == item['sha256'], 'Bootstrap bytes changed')
        settings = value.get('AppSettings', {})
        require(set(settings) == BOOTSTRAP_KEYS, 'Wrong bootstrap whitelist')
        values.append(settings)
    require(values[0] == values[1], 'API bootstrap infrastructure differs')
    value = values[0]
    require(value['OsClient'] == context['mainTenant'] and value['OsClientType'] == 'Product'
            and value['OsClientNetwork'] == 'Internal' and str(value['OsClientDbType']).lower() == 'mysql',
            'Wrong bootstrap tenant tuple')
    parts = parse_conn(value['OsClientDbConn'])
    mysql = context['mysql']
    require(parts.get('database') == context['parentDatabase'] and parts.get('server') == mysql['host']
            and parts.get('port') == str(mysql['port']) and parts.get('user id') == mysql['user']
            and parts.get('password') == mysql['password'], 'MySQL context differs from bootstrap')
    redis = context['redis']
    require(value['OsClientRedisHost'] == redis['host'] and str(value['OsClientRedisPort']) == str(redis['port'])
            and value['OsClientRedisPwd'] == redis['password']
            and str(value['OsClientRedisDataBase']) == str(redis['database'])
            and value['OsClientDbMongoConn'] == context['mongo']['localUri'], 'Infrastructure context differs from bootstrap')
    return value


class Context:
    def __init__(self, path, expected_sha256):
        self.path = pathlib.Path(path)
        require(re.fullmatch(r'[a-f0-9]{64}', expected_sha256 or ''), 'Frozen context hash required')
        self.expected_hash = expected_sha256
        self.verify()

    def verify(self):
        raw, value = read_json(self.path, maximum=262144)
        require(sha(raw) == self.expected_hash, 'Frozen context changed')
        value = validate_context(value)
        require(same_path(value['candidateRoot'], ROOT), 'Candidate must be the helper source tree')
        head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True, timeout=10,
                                       stderr=subprocess.DEVNULL).strip()
        require(head == value['sourceHead'], 'Candidate HEAD changed')
        require(same_path(value['python'], sys.executable), 'Python executable differs')
        check(value['python'], private=False, directory=False)
        private = check(value['privateDirectory'], directory=True)
        require(private.name == 'private' and private.parent.name == 'admission'
                and same_path(self.path, private / 'context.json'), 'Wrong run private directory')
        for relative, digest in value['sourceHashes'].items():
            source = check(ROOT / relative, private=False, directory=False)
            require(sha(source.read_bytes()) == digest, 'Frozen source input changed')
        build_raw, build = read_json(value['runtimeBuildFile'])
        ready_raw, ready = read_json(value['runtimeReadyFile'])
        require(sha(build_raw) == value['runtimeBuildSha256'] and sha(ready_raw) == value['runtimeReadySha256'],
                'Runtime receipt bytes changed')
        require(build.get('schemaVersion') == 1 and ready.get('schemaVersion') == 1
                and build.get('sourceHead') == ready.get('sourceHead') == value['sourceHead']
                and build.get('buildId') == ready.get('buildId') == value['buildId']
                and ready.get('task') == value['task'] and ready.get('attempt') == value['attempt']
                and same_path(private, pathlib.Path(build['resultsDirectory']) / 'admission' / 'private'),
                'Runtime receipt is not this run')
        self.data, self.private = value, private
        self.bootstrap = bootstrap_configuration(value)
        return self

    def owned_path(self, path, creating=False):
        path = pathlib.Path(path)
        require(path.is_absolute() and '..' not in path.parts and path != self.private
                and path.is_relative_to(self.private), 'Path outside run private directory')
        if creating:
            check(path.parent, directory=True)
            require(not path.exists() and not path.is_symlink(), 'CreateNew target already exists')
        else:
            check(path)
        return path

    def load(self, name):
        require(pathlib.Path(name).name == name, 'Invalid private filename')
        _, value = read_json(self.owned_path(self.private / name))
        return value

    def save(self, name, value):
        self.verify()
        path = self.owned_path(self.private / name, creating=True)
        with path.open('x', encoding='utf-8') as stream:
            os.chmod(path, 0o600) if os.name != 'nt' else None
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        check(path)


def arguments(actions, argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--context', required=True)
    parser.add_argument('--context-sha256', required=True)
    parser.add_argument('action', choices=actions)
    return parser.parse_args(argv)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--context', required=True)
    parser.add_argument('--context-sha256', required=True)
    parser.add_argument('action', choices=('verify', 'directory', 'file'))
    parser.add_argument('name', nargs='?')
    args = parser.parse_args()
    context = Context(args.context, args.context_sha256)
    if args.action == 'file':
        require(isinstance(args.name, str) and pathlib.Path(args.name).name == args.name, 'Private filename required')
        context.owned_path(context.private / args.name)
    else:
        require(args.name is None, 'Unexpected ACL argument')
        check(context.private, directory=True)
    print(json.dumps({'verified': True, 'task': context.data['task'], 'contextSha256': context.expected_hash}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'verified': False, 'errorType': type(error).__name__}), file=sys.stderr)
        sys.exit(1)
