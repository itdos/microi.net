import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = readFileSync(resolve(root, '数据库、案例、文档、资料/install-microi.sh'), 'utf8');
const block = source.slice(source.indexOf("echo 'Microi：暂停恢复库中的定时任务...'"),
  source.indexOf('echo "Microi：核对并初始化 SaaS 主租户'));
const bash = process.platform === 'win32'
  ? ['D:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/bin/bash.exe'].find(existsSync) : 'bash';
assert(bash);

function run(choice, mode) {
  // 执行安装器真实暂停区块；模拟外部命令结果，确保失败时不能继续启动 API。
  const input = ['set -e', 'database_exec_sql() {',
    'if [[ "$1" == UPDATE* ]]; then [ "$TEST_MODE" != update_failure ]; return; fi',
    'case "$TEST_MODE" in',
    'success) printf "Marker\\n  MICROI_SCHEDULES_PAUSED  \\n" ;;',
    'sql_failure) printf "ERROR 1064: MICROI_SCHEDULES_PAUSED\\n"; return 42 ;;',
    'mismatch) printf "Marker\\n(0 rows)\\n" ;;',
    'misleading) printf "ERROR: missing MICROI_SCHEDULES_PAUSED marker\\n" ;;',
    'esac', '}', block, 'printf "VERIFY_SQL:%s\\n" "$PAUSE_SCHEDULE_VERIFY_SQL"',
    'printf "API_START_ALLOWED\\n"'].join('\n');
  const result = spawnSync(bash, ['-s'], {cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: {...process.env, DATABASE_CHOICE: String(choice), TEST_MODE: mode}, input});
  assert(!result.error, String(result.error));
  return result;
}

for (const choice of [1, 2]) {
  test(`MySQL choice ${choice} uses the 5.7-compatible DUAL source`, () => {
    const result = run(choice, 'success');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /AS Marker FROM DUAL WHERE NOT EXISTS/);
    assert.match(result.stdout, /diy_schedule_job.*microi_job_triggers/);
  });
}
for (const choice of [1, 2, 3, 5, 6]) {
  test(`database choice ${choice} accepts a complete pause receipt`, () => {
    const result = run(choice, 'success');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /API_START_ALLOWED/);
  });
}
for (const mode of ['update_failure', 'sql_failure', 'mismatch', 'misleading']) {
  test(`${mode} blocks subsequent API startup`, () => {
    const result = run(1, mode);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout, /API_START_ALLOWED/);
    if (mode === 'sql_failure') assert.match(result.stdout, /校验 SQL 执行失败/);
  });
}
