import assert from 'node:assert/strict';
import test from 'node:test';
import { tapResult } from './verify.mjs';
const full = '# tests 54\n# pass 54\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
test('完整成功总账与 CRLF 可解析', () => { assert.equal(tapResult(full, 0).passed, true); assert.equal(tapResult(full.replaceAll('\n', '\r\n'), 0).passed, true); });
test('退出失败、计数丢失或双总账不能伪装成功', () => { assert.equal(tapResult(full, 1).passed, false); assert.equal(tapResult(full.replace('# skipped 0\n', ''), 0).passed, false); assert.equal(tapResult(full + full, 0).passed, false); });
test('跳过、待办、取消和失败均拒绝', () => { for (const key of ['fail', 'skipped', 'todo', 'cancelled']) assert.equal(tapResult(full.replace(`# ${key} 0`, `# ${key} 1`), 0).passed, false); });
test('零测试、数量不符与不足责任用例数均拒绝', () => { assert.equal(tapResult(full.replaceAll('54', '0'), 0).passed, false); assert.equal(tapResult(full.replace('# pass 54', '# pass 53'), 0).passed, false); assert.equal(tapResult(full.replaceAll('54', '2'), 0).passed, false); });
