import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRegistry } from './summarize-saas-registry.mjs';

const verifiedAt = '2026-10-25T14:01:08.473Z';
function input(rows) { return { verifiedAt, pages: [{ PageIndex: 1, Total: rows.length, Data: rows }] }; }
test('只输出聚合统计，不泄露名称、Id 或逐行哈希', () => {
  const result = summarizeRegistry(input([
    { Id: 'private-row-1', ClientName: 'Example Customer 13800138000' },
    { Id: 'private-row-2', ClientName: 'Example Customer 13800138000' },
    { Id: 'private-row-3', ClientName: '集成测试' },
    { Id: 'private-row-4', ClientName: null },
  ]));
  assert.deepEqual(result.counts, { registeredRecords: 4, emptyNames: 1, excludedNames: 1, candidateRecords: 2, distinctExactNames: 1 });
  assert.doesNotMatch(JSON.stringify(result), /private-row|Example Customer|13800138000/);
});
test('全角字符和空格不增加同名计数', () => {
  const result = summarizeRegistry(input([{ Id: '1', ClientName: 'ＡＢＣ ' }, { Id: '2', ClientName: 'ABC' }]));
  assert.equal(result.counts.distinctExactNames, 1);
});
test('拒绝秘密或额外字段，错误不包含字段值', () => {
  assert.throws(() => summarizeRegistry(input([{ Id: '1', ClientName: 'Example', DbConn: 'private-secret' }])), error => !error.message.includes('private-secret'));
});
test('拒绝重复 Id、漏页、乱序和采集中变化的总数', () => {
  assert.throws(() => summarizeRegistry(input([{ Id: '1' }, { Id: '1' }])));
  assert.throws(() => summarizeRegistry({ verifiedAt, pages: [{ PageIndex: 1, Total: 2, Data: [{ Id: '1' }] }] }));
  assert.throws(() => summarizeRegistry({ verifiedAt, pages: [{ PageIndex: 2, Total: 0, Data: [] }] }));
  assert.throws(() => summarizeRegistry({ verifiedAt, pages: [{ PageIndex: 1, Total: 0, Data: [] }, { PageIndex: 2, Total: 1, Data: [] }] }));
});
test('空集仍明确不能作为付费或交付证明', () => {
  const result = summarizeRegistry(input([]));
  assert.equal(result.counts.registeredRecords, 0);
  assert.match(result.limits[0], /不等于/);
});
