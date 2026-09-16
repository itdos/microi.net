import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertTestSummary } from '../run-node-regressions.mjs';

test('MCP 任务诊断与日志查询只读参数及错误语义', () => {
  const cwd = fileURLToPath(new URL('../../../microi.mcp', import.meta.url));
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--max-old-space-size=384', '--import', 'tsx', '--test', '--test-reporter=tap', 'src/job-runtime-tools.test.ts'], {
    cwd, env, encoding: 'utf8', windowsHide: true, timeout: 60000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assertTestSummary(result.stdout);
});
