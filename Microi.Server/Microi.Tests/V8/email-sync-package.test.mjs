import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

test('Official email package passes delta-write and synchronization cursor regressions', () => {
  const app = fileURLToPath(new URL('../../../Microi-V8-Engine/Microi吾码 (api.itdos.com)/iTdos.Product.Internal/AI应用/mci-email/', import.meta.url));
  const env = {...process.env};
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-concurrency=1', 'tests'], {
    cwd: app, env, encoding: 'utf8', windowsHide: true, timeout: 30000
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# tests 10\r?\n/);
  assert.match(result.stdout, /# pass 10\r?\n/);
  assert.match(result.stdout, /# skipped 0\r?\n/);
});
