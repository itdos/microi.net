import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = readFileSync(resolve(root, '数据库、案例、文档、资料/install-microi.sh'), 'utf8');
const bash = process.platform === 'win32'
  ? ['D:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/bin/bash.exe'].find(existsSync) : 'bash';
assert(bash);
function body(name) {
  const match = source.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`, 'm'));
  assert(match, `Installer must implement ${name}`);
  return match[0];
}
function run(input, env = {}) {
  const result = spawnSync(bash, ['-s'], {input, cwd: root, encoding: 'utf8', windowsHide: true,
    timeout: 10000, env: {...process.env, ...env}});
  assert(!result.error, String(result.error));
  return result;
}

test('4 GiB hosts block model startup before any image or key initialization', () => {
  const result = run(['set -e', body('evaluate_optional_model_memory'),
    'evaluate_optional_model_memory', 'echo BLOCKED=$OPTIONAL_MODELS_MEMORY_BLOCKED'].join('\n'),
  {MICROI_HOST_MEMORY_MB_OVERRIDE: '3622', MICROI_HOST_AVAILABLE_MEMORY_MB_OVERRIDE: '3000'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /BLOCKED=1/);
  for (const name of ['deploy_optional_ocr', 'deploy_optional_libretranslate']) {
    const deploy = body(name);
    assert(deploy.indexOf('enforce_optional_model_memory_guard') < deploy.indexOf('mkdir'));
    assert.match(deploy, /OPTIONAL_MODELS_MEMORY_BLOCKED/);
  }
});

for (const [total, available, blocked] of [[7679, 5000, 1], [7680, 2048, 0], [8192, 2047, 1],
  [32768, 0, 1], [32768, 20000, 0]]) {
  test(`memory admission total=${total}, available=${available} => blocked=${blocked}`, () => {
    const r = run([body('evaluate_optional_model_memory'), 'evaluate_optional_model_memory',
      'echo BLOCKED=${OPTIONAL_MODELS_MEMORY_BLOCKED:-0}'].join('\n'),
    {MICROI_HOST_MEMORY_MB_OVERRIDE: String(total), MICROI_HOST_AVAILABLE_MEMORY_MB_OVERRIDE: String(available)});
    assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, new RegExp(`BLOCKED=${blocked}`));
  });
}
test('Swap never admits a physically small host and a decision stays disabled after stop frees memory', () => {
  const r = run([body('evaluate_optional_model_memory'), 'evaluate_optional_model_memory',
    'MICROI_HOST_MEMORY_MB_OVERRIDE=16384', 'MICROI_HOST_AVAILABLE_MEMORY_MB_OVERRIDE=12000',
    'evaluate_optional_model_memory', 'echo BLOCKED=$OPTIONAL_MODELS_MEMORY_BLOCKED'].join('\n'),
  {MICROI_HOST_MEMORY_MB_OVERRIDE: '3622', MICROI_HOST_AVAILABLE_MEMORY_MB_OVERRIDE: '3000'});
  assert.match(r.stdout, /BLOCKED=1/);
});
test('missing or malformed memory readings fail closed', () => {
  const r = run(['awk() { echo invalid; }', body('evaluate_optional_model_memory'),
    'evaluate_optional_model_memory', 'echo BLOCKED=$OPTIONAL_MODELS_MEMORY_BLOCKED'].join('\n'),
  {MICROI_HOST_MEMORY_MB_OVERRIDE: '', MICROI_HOST_AVAILABLE_MEMORY_MB_OVERRIDE: ''});
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /BLOCKED=1/);
});

const guardSetup = `set -e
OCR_CONTAINER_NAME=microi-install-ocr
LIBRETRANSLATE_CONTAINER_NAME=microi-install-libretranslate
docker() {
  printf 'DOCKER:%s\\n' "$*" >&2
  case "$1" in
    ps) printf 'microi-install-api\\nmicroi-install-mysql57\\nmicroi-install-ocr\\nmicroi-install-libretranslate\\nother-ocr\\n' ;;
    stop) [ "\${TEST_MODE:-}" != stop_failure ] ;;
    update) return 0 ;;
    inspect) if [ "\${TEST_MODE:-}" = wrong_state ]; then echo 'true no'; else echo 'false no'; fi ;;
    *) return 40 ;;
  esac
}`;
for (const mode of ['success', 'stop_failure', 'wrong_state']) {
  test(`existing model shutdown is exact and verified: ${mode}`, () => {
    const r = run([guardSetup, body('evaluate_optional_model_memory'), body('enforce_optional_model_memory_guard'),
      'enforce_optional_model_memory_guard', 'echo CORE_ALLOWED'].join('\n'),
    {MICROI_HOST_MEMORY_MB_OVERRIDE: '3622', MICROI_HOST_AVAILABLE_MEMORY_MB_OVERRIDE: '1000', TEST_MODE: mode});
    if (mode !== 'success') { assert.notEqual(r.status, 0); assert.doesNotMatch(r.stdout, /CORE_ALLOWED/); return; }
    assert.equal(r.status, 0, r.stderr);
    for (const name of ['microi-install-ocr', 'microi-install-libretranslate']) {
      assert(r.stderr.includes(`stop -t 15 ${name}`)); assert(r.stderr.includes(`update --restart=no ${name}`));
    }
    assert.doesNotMatch(r.stderr, /DOCKER:(?:stop|update).*microi-install-(?:api|mysql)|DOCKER:(?:stop|update).*other-ocr|\brm\b|\bdown\b/);
  });
}
test('large healthy hosts perform no Docker shutdown operations', () => {
  const r = run([guardSetup, body('evaluate_optional_model_memory'), body('enforce_optional_model_memory_guard'),
    'enforce_optional_model_memory_guard'].join('\n'),
  {MICROI_HOST_MEMORY_MB_OVERRIDE: '16384', MICROI_HOST_AVAILABLE_MEMORY_MB_OVERRIDE: '8000'});
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stderr, '');
});
test('low memory exits both real deployment functions before pulling images or initializing keys', () => {
  const r = run([guardSetup, body('evaluate_optional_model_memory'), body('enforce_optional_model_memory_guard'),
    body('deploy_optional_ocr'), body('deploy_optional_libretranslate'),
    'INSTALL_LIBRETRANSLATE=1', 'deploy_optional_ocr', 'deploy_optional_libretranslate',
    'echo MODEL_START_SKIPPED'].join('\n'),
  {MICROI_HOST_MEMORY_MB_OVERRIDE: '3622', MICROI_HOST_AVAILABLE_MEMORY_MB_OVERRIDE: '3000'});
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /MODEL_START_SKIPPED/);
  assert.doesNotMatch(r.stderr, /DOCKER:(?:pull|run|start|restart|compose)/);
});
test('the actual small-host MySQL generator caps buffer pool at 384 MiB', () => {
  const result = spawnSync(bash, [resolve(root, '数据库、案例、文档、资料/install-microi.sh').replaceAll('\\', '/')],
  {cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000, env: {...process.env,
    MICROI_INSTALL_MYSQL_CONFIG_ONLY: '1', MICROI_DATABASE_CHOICE: '2',
    MICROI_HOST_MEMORY_MB_OVERRIDE: '3622', MICROI_HOST_LOGICAL_CPUS_OVERRIDE: '2',
    MICROI_HOST_PHYSICAL_CORES_OVERRIDE: '2', MICROI_HOST_DISK_TYPE_OVERRIDE: 'ssd'}});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^innodb_buffer_pool_size = 384M$/m);
});

for (const choice of [1, 2, 3, 5, 6]) {
  test(`database ${choice} disables only the unique selected tenant without deleting URL or key`, () => {
    const r = run([`set -e
OPTIONAL_MODELS_MEMORY_BLOCKED=1
OS_CLIENT=example
RUNTIME_OS_CLIENT_TYPE=Product
RUNTIME_OS_CLIENT_NETWORK=Internal
database_exec_sql() {
  printf 'SQL:%s\\n' "$1" >&2
  case "$1" in
    *MICROI_MODEL_TENANT_OK*) echo MICROI_MODEL_TENANT_OK ;;
    UPDATE*) return 0 ;;
    *MICROI_MODELS_DISABLED*) echo MICROI_MODELS_DISABLED ;;
    *) return 41 ;;
  esac
}`, body('disable_memory_blocked_model_config'), 'disable_memory_blocked_model_config',
      'echo CHANGED=$OPTIONAL_MODELS_CONFIG_CHANGED'].join('\n'), {DATABASE_CHOICE: String(choice)});
    assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /CHANGED=1/);
    assert.match(r.stderr, /COUNT\(\*\)=1/);
    assert.match(r.stderr, /OsClient[\]"]?='example'/);
    assert.match(r.stderr, /OsClientType[\]"]?='Product'/);
    assert.match(r.stderr, /OsClientNetwork[\]"]?='Internal'/);
    assert.match(r.stderr, /TranslateProvider[\]"]?='None'/);
    assert.doesNotMatch(r.stderr, /TranslateUrl|TranslateApiKey|OcrEndpoint|DELETE|TRUNCATE|ALTER/);
  });
}
for (const mode of ['not_unique', 'sql_failure', 'bad_readback']) {
  test(`disable configuration rejects ${mode}`, () => {
    const r = run([`set -e
OPTIONAL_MODELS_MEMORY_BLOCKED=1
OS_CLIENT=example
RUNTIME_OS_CLIENT_TYPE=Product
RUNTIME_OS_CLIENT_NETWORK=Internal
database_exec_sql() {
 case "$1" in
  *MICROI_MODEL_TENANT_OK*) [ "$TEST_MODE" = not_unique ] || echo MICROI_MODEL_TENANT_OK ;;
  UPDATE*) [ "$TEST_MODE" != sql_failure ] ;;
  *MICROI_MODELS_DISABLED*) if [ "$TEST_MODE" = bad_readback ]; then echo 'ERROR: MICROI_MODELS_DISABLED'; else echo MICROI_MODELS_DISABLED; fi ;;
 esac
}`, body('disable_memory_blocked_model_config'), 'disable_memory_blocked_model_config',
      'echo CONFIG_SUCCESS'].join('\n'), {DATABASE_CHOICE: '1', TEST_MODE: mode});
    assert.notEqual(r.status, 0); assert.doesNotMatch(r.stdout, /CONFIG_SUCCESS/);
  });
}
test('core readiness remains required after disabled tenant configuration refresh', () => {
  assert.match(source, /if \[ "\$\{OCR_SAAS_CONFIG_READY\}" = "1" \].*OPTIONAL_MODELS_CONFIG_CHANGED/);
  const block = source.slice(source.indexOf("echo 'Microi：重启新安装 API"), source.indexOf("echo '[步骤10/11] 平台应用"));
  assert.match(block, /wait_for_microi_api '\/api\/Diagnostics\/health'/);
  assert.match(block, /exit 1/);
});
test('per-model limits and worker limits are independent of the API environment', () => {
  const ocr = body('deploy_optional_ocr'), translate = body('deploy_optional_libretranslate');
  assert.match(ocr, /mem_limit: 1024m/); assert.match(ocr, /memswap_limit: 1536m/);
  assert.match(translate, /mem_limit: 768m/); assert.match(translate, /memswap_limit: 1280m/);
  for (const block of [ocr, translate]) { assert.match(block, /cpus: "0\.75"/); assert.match(block, /OMP_NUM_THREADS=1/); }
  assert.match(translate, /LT_THREADS=1/);
});
test('Swap cannot overwrite existing files and only proceeds after backup and disk/filesystem checks', () => {
  const swap = body('prepare_low_memory_swap');
  assert(swap.indexOf('[ -e "${swap_file}" ]') < swap.indexOf('fallocate'));
  assert(swap.indexOf('4194304') < swap.indexOf('fallocate'));
  assert(swap.indexOf('cp /etc/fstab') < swap.indexOf('fallocate'));
  assert(swap.indexOf('swapon "${swap_file}"') < swap.indexOf('>> /etc/fstab'));
  assert.match(swap, /set -o noclobber/); assert.match(swap, /ext4\|xfs/);
  for (const [swapTotal, fs, free] of [[2048, 'ext4', 8000000], [0, 'btrfs', 8000000], [0, 'xfs', 100]]) {
    const r = run([`set -e
OPTIONAL_MODELS_MEMORY_BLOCKED=1
awk() { if [ "$1" = '/^SwapTotal:/ {print $2; exit}' ]; then echo ${swapTotal}; else echo ${free}; fi; }
findmnt() { echo ${fs}; }
df() { echo unused; }
cp() { echo UNEXPECTED_WRITE >&2; return 90; }
fallocate() { echo UNEXPECTED_WRITE >&2; return 91; }`, swap, 'prepare_low_memory_swap'].join('\n'));
    assert.equal(r.status, 0, r.stderr); assert.doesNotMatch(r.stderr, /UNEXPECTED_WRITE/);
  }
});
