import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPayloadSourceIntegrity, assertSourceIntegrity, findSourceIntegrityIssues } from './source-integrity.js';

test('detects AI and terminal output contamination markers', () => {
  const samples = [
    'var a = 1;\n…676 tokens truncated…\nreturn a;',
    'var a = 1;\n...1961 tokens truncated...\nreturn a;',
    'var a = 1;\nExit code: 0\nreturn a;',
    'Chunk ID: abc123',
    'Wall time: 0.25 seconds',
    'Process exited with code 1',
  ];
  for (const sample of samples) {
    assert.ok(findSourceIntegrityIssues(sample).length > 0, sample);
    assert.throws(() => assertSourceIntegrity(sample, '测试保存'));
  }
});

test('does not reject legitimate quoted business strings', () => {
  const source = [
    'var message = "Exit code: 0";',
    'var label = "Chunk ID: business-value";',
    '// The phrase tokens truncated is discussed here.',
    'return { Code: 1, Data: message };',
  ].join('\n');
  assert.deepEqual(findSourceIntegrityIssues(source), []);
  assert.doesNotThrow(() => assertSourceIntegrity(source, '测试保存'));
});

test('scans nested module button payloads', () => {
  assert.throws(() => assertPayloadSourceIntegrity({
    ModuleId: 'module-1',
    MoreBtns: JSON.stringify([{ Id: 'button-1', V8Code: 'var a = 1;\nExit code: 0' }]),
  }, '更新菜单模块'));
});

