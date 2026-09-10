import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// 统一回归调用真实 MCP 工具处理器测试，避免重复一份与发布代码脱节的实现。
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
test('MCP Banner persisted configuration validation regression suite', () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--max-old-space-size=256', '--import', 'tsx', '--test', '--test-reporter=tap', '--test-concurrency=1', 'src/advanced-tools-validation-envelope.test.ts', 'src/form-banner-defaults.test.ts'], {
    cwd: path.join(repo, 'microi.mcp'), env, encoding: 'utf8', windowsHide: true, timeout: 60000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# tests 20\b/);
  assert.match(result.stdout, /# fail 0\b/);
  assert.match(result.stdout, /# skipped 0\b/);
});
