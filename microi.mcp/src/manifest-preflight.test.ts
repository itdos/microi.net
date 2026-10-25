import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlan } from './advanced-tools.js';
import { harness, toolJson } from './manifest-context-fixtures.js';

const valid = () => ({ name: '声明校验', tables: [{ name: 'Biz_Evidence', fields: [{ name: 'Name', label: '名称' }] }] });
const checkBlocked = async (manifest: Record<string, unknown>, path: string) => {
  const run = harness();
  const planned = buildPlan(manifest);
  assert.ok(planned.errors.some(error => error.includes(path)), JSON.stringify(planned));
  const result = await run.call('microi_generate_system', { manifest, dryRun: false, confirmExecution: 'tenant' });
  assert.equal(result.isError, true);
  assert.equal(toolJson(result).ok, false);
  assert.equal(run.calls.length, 0, '无效声明必须在任何资源读写前整体拒绝');
};

test('拒绝非数组资源集合，不能把错误形状当作未声明', async () => {
  for (const bad of [{}, null, 'invalid', 123]) await checkBlocked({ ...valid(), engines: bad }, 'engines');
});
test('拒绝被静默丢弃的无效数组成员，阻止前面的合法资源先写入', async () => {
  for (const bad of [null, false, 'invalid', [], {}]) await checkBlocked({ ...valid(), engines: [{ apiEngineKey: 'valid-first', code: 'return { Code: 1 };' }, bad] }, 'engines[1]');
});
test('拒绝冲突的大小写集合别名', async () => {
  await checkBlocked({ ...valid(), Tables: [{ name: 'Biz_Other' }] }, 'tables');
});
test('相同别名和省略可选集合保持兼容，局部引擎更新仍有效', () => {
  const manifest = valid();
  assert.deepEqual(buildPlan({ ...manifest, Tables: structuredClone(manifest.tables) }).errors, []);
  assert.deepEqual(buildPlan({ engines: [{ apiEngineKey: 'biz-one', code: 'return { Code: 1 };' }] }).errors, []);
});
test('拒绝同一 Manifest 中大小写不同的重复表名', async () => {
  await checkBlocked({ tables: [...valid().tables, { name: 'biz_evidence', fields: [{ name: 'Code', label: '编号' }] }] }, 'tables[1]');
});
test('拒绝同一表内大小写不同的重复字段名', async () => {
  await checkBlocked({ tables: [{ name: 'Biz_Evidence', fields: [{ name: 'Name', label: '名称' }, { name: 'name', label: '另一个名称' }] }] }, 'fields[1]');
});
test('拒绝重复接口 Key，防止先写再覆盖导致最后一项获胜', async () => {
  await checkBlocked({ engines: [{ apiEngineKey: 'biz-check', code: 'return 1;' }, { ApiEngineKey: 'BIZ-CHECK', code: 'return 2;' }] }, 'engines[1]');
});
test('拒绝重复数据源 Key 和同表重复索引名', async () => {
  await checkBlocked({ dataSources: [{ dataSourceKey: 'options' }, { DataSourceKey: 'OPTIONS' }] }, 'dataSources[1]');
  await checkBlocked({ tables: [{ name: 'Biz_Evidence', fields: [{ name: 'Name', label: '名称' }], indexes: [{ name: 'ix_name', columns: ['Name'] }, { Name: 'IX_NAME', Columns: ['Id'] }] }] }, 'indexes[1]');
});
test('嵌套集合的非法形状、丢失成员和别名冲突都整体拒绝', async () => {
  for (const table of [{ name: 'Biz_Evidence', fields: {} }, { name: 'Biz_Evidence', fields: [null] }, { name: 'Biz_Evidence', fields: [{ name: 'Name', label: '名称' }], Fields: [{ name: 'Code', label: '编号' }] }]) {
    await checkBlocked({ tables: [table] }, 'fields');
  }
});
test('不同表可使用相同字段名，不能误判跨表字段重复', () => {
  const first = valid().tables[0];
  assert.deepEqual(buildPlan({ tables: [first, { ...structuredClone(first), name: 'Biz_Second' }] }).errors, []);
});
test('错误信息只含安全路径，不回显无效资源正文', () => {
  const marker = 'PRIVATE_CONTENT_MUST_NOT_APPEAR';
  const result = buildPlan({ engines: marker });
  assert.ok(result.errors.length > 0);
  assert.ok(!JSON.stringify(result.errors).includes(marker));
});
