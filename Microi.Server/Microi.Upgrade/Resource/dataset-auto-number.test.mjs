import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
const block = source.slice(source.indexOf('    var packageDataSets = Package.DataSets'), source.indexOf("    debugLog.step8Result = '随包数据处理完成"));
// 模拟平台真实契约：新增总会生成自动编号；更新只有 _ForceUpt 才能改编号。
// 每次执行使用事务副本，异常不能提交，以检查编号校验失败的安装回滚边界。
function fixture(options = {}) {
  let rows = structuredClone(options.rows || []);
  const calls = [], tx = {};
  const execute = (sets) => {
    const pending = structuredClone(rows);
    const context = {
      Package: { DataSets: sets }, stats: { DataSkipped: 0, DataUpdated: 0, DataInserted: 0, DataSetCount: 0 },
      debugLog: {}, reportProgress() {}, remapPackageDataRowReferences: (_table, row) => ({ ...row }),
      V8: { OsClient: 'target', DbTrans: tx, FormEngine: {
        GetTableData(table, args, trans) {
          calls.push({ method: 'list', table, args, trans });
          assert.equal(table, 'diy_field');
          return options.schemaFailure ? { Code: 0 } : { Code: 1, Data: options.fields ?? [{ Name: 'Number', Component: 'AutoNumber' }], DataCount: options.fieldCount ?? (options.fields?.length ?? 1) };
        },
        GetFormData(table, args, trans) {
          calls.push({ method: 'get', table, args, trans });
          if (table === 'diy_table') return { Code: 1, Data: { Id: 'table-id', Name: 'mic_print' } };
          let row = args.Id ? pending.find(r => r.Id === args.Id) : pending.find(r => args._Where.every(([k, , v]) => r[k] === v));
          if (options.readbackMismatch && args._SelectFields?.includes('Number') && row) row = { ...row, Number: 'WRONG' };
          return row ? { Code: 1, Data: { ...row } } : { Code: 2 };
        },
        AddFormData(table, args, trans) {
          calls.push({ method: 'add', table, args: { ...args }, trans });
          if (options.addFailure) return { Code: 0, Msg: 'insert failed' };
          pending.push({ ...args, Number: `PAGE${pending.length + 1}` });
          return { Code: 1, Data: { ...pending.at(-1) } };
        },
        UptFormData(table, args, trans) {
          calls.push({ method: 'update', table, args: { ...args }, trans });
          if (args._ForceUpt && options.forceFailure) return { Code: 0, Msg: 'duplicate' };
          const row = pending.find(r => r.Id === args.Id);
          if (!row) return { Code: 2 };
          for (const [key, value] of Object.entries(args)) if (!key.startsWith('_') && (key !== 'Number' || args._ForceUpt)) row[key] = value;
          return { Code: 1 };
        }
      } }
    };
    vm.runInNewContext(block, context);
    rows = pending;
    return context.stats;
  };
  const run = (row = { Id: 'template', Number: 'app-template', Title: '模板' }, policy = 'UpsertById', extra = {}) => execute([{ TableName: 'mic_print', ConflictPolicy: policy, Rows: [row], ...extra }]);
  return { run, execute, calls, tx, rows: () => rows };
}

test('首次安装恢复固定编号，限定最小字段并共享安装事务', () => {
  const f = fixture(); f.run(); assert.equal(f.rows()[0].Number, 'app-template');
  const force = f.calls.find(c => c.args._ForceUpt);
  assert.deepEqual(Object.keys(force.args).sort(), ['Id', 'Number', '_ForceUpt']); assert.equal(force.trans, f.tx);
  const read = f.calls.find(c => c.args._SelectFields?.includes('Number')); assert.equal(read.trans, f.tx);
});
test('旧安装生成的编号在 UpsertById 升级与同版重装恢复且无重复记录', () => {
  const f = fixture({ rows: [{ Id: 'template', Number: 'PAGE35', Title: '旧模板' }] });
  f.run(); f.run(); assert.equal(f.rows().length, 1); assert.equal(f.rows()[0].Number, 'app-template');
});
test('InsertIfMissing 已有租户编号及配置值保持不变', () => {
  const f = fixture({ rows: [{ Id: 'template', Number: 'TENANT-9', ConfigValue: 'custom' }] });
  f.run({ Id: 'template', Number: 'app-template', ConfigValue: 'default' }, 'InsertIfMissing');
  assert.equal(f.rows()[0].Number, 'TENANT-9'); assert.equal(f.rows()[0].ConfigValue, 'custom'); assert.ok(!f.calls.some(c => c.args._ForceUpt));
});
test('InsertIfMissing 新种子也保留稳定编号', () => {
  const f = fixture(); f.run(undefined, 'InsertIfMissing'); assert.equal(f.rows()[0].Number, 'app-template');
});
test('未提供、空值及普通字段不触发强制更新', () => {
  for (const Number of [undefined, null, '']) { const f = fixture(); f.run({ Id: 'template', Number }); assert.equal(f.rows()[0].Number, 'PAGE1'); assert.ok(!f.calls.some(c => c.args._ForceUpt)); }
  const f = fixture({ fields: [] }); f.run(); assert.ok(!f.calls.some(c => c.args._ForceUpt));
});
test('不接受包注入的强制更新及跨租户参数', () => {
  const f = fixture(); f.run({ Id: 'template', Number: 'app-template', _ForceUpt: true, OsClient: 'attacker' });
  const add = f.calls.find(c => c.method === 'add'); assert.equal(add.args._ForceUpt, undefined); assert.equal(add.args.OsClient, 'target');
});
test('编号修复失败或读回不一致不能提交安装数据', () => {
  for (const option of ['forceFailure', 'readbackMismatch']) { const f = fixture({ [option]: true }); assert.throws(() => f.run(), /自动编号/); assert.equal(f.rows().length, 0); }
});
test('字段元数据读取失败或超限在写入前拒绝', () => {
  for (const options of [{ schemaFailure: true }, { fieldCount: 1001 }]) { const f = fixture(options); assert.throws(() => f.run(), /自动编号/); assert.ok(!f.calls.some(c => c.method === 'add')); }
});
test('复杂值及不安全字段元数据不得进入强制更新', () => {
  for (const Number of [{ sql: 'x' }, ['x'], true]) { const f = fixture(); assert.throws(() => f.run({ Id: 'template', Number }), /自动编号/); assert.equal(f.rows().length, 0); }
  for (const Name of ['_ForceUpt', 'OsClient', 'Id', 'Number;DROP']) { const f = fixture({ fields: [{ Name, Component: 'AutoNumber' }] }); assert.throws(() => f.run(), /自动编号/); }
});
test('配置元数据白名单不能用 Number 覆盖既有租户编号', () => {
  const f = fixture({ rows: [{ Id: 'template', Number: 'CUSTOM' }] });
  assert.throws(() => f.run(undefined, 'InsertIfMissing', { MetadataFieldsIfExists: ['Number'] }), /仅允许/); assert.equal(f.rows()[0].Number, 'CUSTOM');
});
test('受保护表和失败新增不会触发强制修复', () => {
  const f = fixture(); assert.throws(() => f.execute([{ TableName: 'sys_user', Rows: [{ Id: 'admin', Number: 'x' }] }]), /不允许写入/);
  const g = fixture({ addFailure: true }); assert.throws(() => g.run(), /导入失败/); assert.ok(!g.calls.some(c => c.args._ForceUpt));
});
