import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
test('MCP ReadPrimary实际规划、工具处理器和客户端运输回归', () => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--max-old-space-size=256', '--import', 'tsx', '--test', '--test-reporter=tap', '--test-concurrency=1', 'src/form-read-primary.test.ts'], {
    cwd: path.join(repo, 'microi.mcp'), env, encoding: 'utf8', windowsHide: true, timeout: 60000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# tests 4\b/); assert.match(result.stdout, /# pass 4\b/);
  for (const key of ['fail', 'cancelled', 'skipped', 'todo']) assert.match(result.stdout, new RegExp(`# ${key} 0\\b`));
});
