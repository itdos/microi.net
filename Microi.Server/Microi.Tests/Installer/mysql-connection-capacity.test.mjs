import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const installer = resolve(root, '数据库、案例、文档、资料/install-microi.sh');
const bash = process.platform === 'win32'
  ? ['D:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/bin/bash.exe'].find(existsSync)
  : 'bash';
assert(bash, 'Bash is required for the actual MySQL configuration generator.');
function generate(memory, cpus, sharedBudget) {
  // 走安装器既有只读入口，真实执行配置生成器；不触碰 Docker、网络或客户配置。
  const run = spawnSync(bash, [installer.replaceAll('\\', '/')], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: {...process.env, MICROI_INSTALL_MYSQL_CONFIG_ONLY: '1', MICROI_DATABASE_CHOICE: '2',
      MICROI_HOST_MEMORY_MB_OVERRIDE: String(memory), MICROI_HOST_LOGICAL_CPUS_OVERRIDE: String(cpus),
      MICROI_HOST_PHYSICAL_CORES_OVERRIDE: String(Math.max(1, Math.floor(cpus / 2))),
      MICROI_HOST_DISK_TYPE_OVERRIDE: 'ssd', MICROI_DOCKER_MEMORY_BUDGET_MB: sharedBudget ? String(sharedBudget) : ''}
  });
  assert.equal(run.status, 0, run.stderr || String(run.error));
  const number = key => Number(run.stdout.match(new RegExp(`^${key}\\s*=\\s*(\\d+)`, 'm'))?.[1]);
  return {run, connections: number('max_connections'), buffer: number('innodb_buffer_pool_size')};
}
test('16 GiB / 8 logical cores reserves the recommended 500 server connections', () => {
  const result = generate(16384, 8);
  assert.equal(result.connections, 500);
});
test('connection capacity does not become a low-core CPU concurrency limit', () => {
  assert.equal(generate(16384, 2).connections, 500);
});
test('high-memory hosts retain the bounded 800 connection ceiling', () => {
  assert.equal(generate(65536, 64).connections, 800);
});
test('2/4/8 GiB hosts explicitly lower capacity within their memory plan', () => {
  const limits = [2048, 4096, 8192].map(memory => {
    const result = generate(memory, 64);
    assert(result.connections >= 10 && result.connections < 500);
    assert.match(result.run.stderr, /内存预算.*低于推荐.*500/);
    return result.connections;
  });
  assert(limits[0] < limits[1] && limits[1] < limits[2]);
});
test('a tighter shared resource pool takes priority over physical host RAM', () => {
  const result = generate(65536, 64, 4096);
  assert(result.buffer < 4096);
  assert(result.connections < 500);
});
test('safe durability and installer version contract remain intact', () => {
  const result = generate(16384, 8);
  assert.match(result.run.stdout, /^innodb_flush_log_at_trx_commit = 1$/m);
  assert.match(result.run.stdout, /^sync_binlog = 1$/m);
  const source = readFileSync(installer, 'utf8');
  const header = source.match(/^# 版本：(v\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$/m)?.[1];
  assert(header); assert.equal(source.match(/^SCRIPT_VERSION="([^"]+)"$/m)?.[1], header);
});
