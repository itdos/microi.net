import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// 统一门禁直接运行责任工程的源测试，避免复用旧dist掩盖当前Manifest校验变化。
test('MCP关联建模覆盖独立库、共享租户列及非物理字段索引', () => {
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [
    '--max-old-space-size=768', '--import', 'tsx', '--test', '--test-reporter=tap', 'src/manifest-field-relations.test.ts',
  ], { cwd: path.join(repo, 'microi.mcp'), env, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, (result.stdout || '') + (result.stderr || ''));
  const count = Number((result.stdout || '').match(/^# tests (\d+)$/m)?.[1] || 0);
  assert.ok(count >= 9, '责任工程测试缺失或零用例，禁止将空跑视为通过');
  assert.match(result.stdout, /^# fail 0$/m);
  assert.match(result.stdout, /^# skipped 0$/m);
});
