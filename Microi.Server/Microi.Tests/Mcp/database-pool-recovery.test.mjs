import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
test('连接池应急 MCP 协议进入中央回归门禁', () => {
  const env = { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-reporter=tap', 'src/system-observability-tools.test.ts'], {
    cwd: path.join(root, 'microi.mcp'), encoding: 'utf8', windowsHide: true, timeout: 60000,
    env,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const count = Number(result.stdout.match(/# tests (\d+)/)?.[1]);
  assert.ok(count > 0);
  assert.equal(Number(result.stdout.match(/# pass (\d+)/)?.[1]), count);
  assert.match(result.stdout, /# fail 0\r?\n/);
  assert.match(result.stdout, /# skipped 0\r?\n/);
});
