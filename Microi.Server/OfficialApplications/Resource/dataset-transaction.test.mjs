import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
const prerequisite = source.match(/function isEmptySharedTablePrerequisite\(dataSet\) \{[\s\S]*?\n\}/)[0];
const block = prerequisite + '\n' + source.slice(source.indexOf('    var packageDataSets = Package.DataSets'), source.indexOf("    debugLog.step8Result = '随包数据处理完成"));
const copy = value => structuredClone(value);
const matches = (row, args) => args.Id ? row.Id === args.Id : args._Where.every(([key, , value]) => row[key] === value);
const settings = (rows, extra = {}) => ({ TableName: 'mci_system_setting', ConflictPolicy: 'InsertIfMissing', ConflictFields: ['ConfigKey'], Rows: rows, ...extra });

// 独立连接只见已提交数据；共享事务能见本片写入。用锁错误暴露查重读逃出事务，
// 用独立提交暴露元数据更新逃出事务，避免所有假查询都读同一个数组而漏掉真实故障。
function fixture(options = {}) {
  let committed = copy(options.tables || {});
  const calls = [];
  const execute = (sets, script = block) => {
    let pending = copy(committed), wrote = false;
    const transaction = {}, injectedError = options.queryError;
    const rows = (table, trans) => (trans === transaction ? pending : committed)[table] || [];
    const read = (table, args, trans, list) => {
      calls.push({ method: list ? 'list' : 'get', table, args: copy(args), shared: trans === transaction });
      if (table === 'diy_table') {
        if (options.pendingMetadata && trans !== transaction) return { Code: 2 };
        return { Code: 1, Data: { Id: `table-${args._Where[0][2]}`, Name: args._Where[0][2] } };
      }
      if (table === 'diy_field') return { Code: 1, Data: [], DataCount: 0 };
      if (injectedError && injectedError(table, args, wrote)) return { Code: 0, Msg: 'permission denied by fixture' };
      if (wrote && trans !== transaction) return { Code: 0, Msg: 'SQL lock timeout: independent reader waits for pending writer' };
      const found = rows(table, trans).filter(row => matches(row, args));
      return list ? { Code: 1, Data: copy(found), DataCount: found.length }
        : found.length ? { Code: 1, Data: copy(found[0]) } : { Code: 2 };
    };
    const write = (table, args, trans, add) => {
      calls.push({ method: add ? 'add' : 'update', table, args: copy(args), shared: trans === transaction });
      if (options.writeFailure?.(table, args)) return { Code: 0, Msg: 'write denied by fixture' };
      const target = trans === transaction ? pending : committed;
      target[table] ||= [];
      if (add) target[table].push(copy(args));
      else {
        const row = target[table].find(row => row.Id === args.Id);
        if (!row) return { Code: 2 };
        Object.assign(row, copy(args));
      }
      wrote = true;
      return { Code: 1 };
    };
    const context = {
      Package: { DataSets: sets }, stats: { DataSkipped: 0, DataUpdated: 0, DataInserted: 0, DataSetCount: 0 }, debugLog: {},
      reportProgress() {}, remapPackageDataRowReferences: (_table, row) => copy(row),
      V8: { OsClient: 'transaction-fixture', DbTrans: transaction, FormEngine: {
        GetFormData: (table, args, trans) => read(table, args, trans, false),
        GetTableData: (table, args, trans) => read(table, args, trans, true),
        AddFormData: (table, args, trans) => write(table, args, trans, true),
        UptFormData: (table, args, trans) => write(table, args, trans, false)
      } }
    };
    vm.runInNewContext(script, context);
    committed = pending;
    return context.stats;
  };
  return { execute, calls, rows: table => copy(committed[table] || []) };
}

test('多条 ConfigKey 种子共享事务，后续业务键查重看见本片未提交插入', () => {
  const f = fixture();
  const result = f.execute([settings([
    { Id: 'a', ConfigKey: 'first', ConfigValue: 'default-a' },
    { Id: 'b', ConfigKey: 'second', ConfigValue: 'default-b' },
    { Id: 'different-id', ConfigKey: 'first', ConfigValue: 'must-not-overwrite' }
  ])]);
  assert.equal(result.DataInserted, 2); assert.equal(result.DataSkipped, 1);
  assert.equal(f.rows('mci_system_setting').length, 2);
  assert.equal(f.rows('mci_system_setting')[0].ConfigValue, 'default-a');
  assert.ok(f.calls.every(call => call.shared));
});

test('Id 不冲突但 ConfigKey 已有时保留租户值，同版本重装不新增且仅更新声明元数据', () => {
  const f = fixture({ tables: { mci_system_setting: [{ Id: 'tenant-id', ConfigKey: 'first', ConfigValue: 'tenant-value', Category: 'old', Description: 'old' }] } });
  const packageData = [settings([
    { Id: 'package-id', ConfigKey: 'first', ConfigValue: 'package-value', Category: 'new', Description: 'new' },
    { Id: 'new-id', ConfigKey: 'second', ConfigValue: 'default', Category: 'new', Description: 'new' }
  ], { MetadataFieldsIfExists: ['Category', 'Description'] })];
  assert.equal(f.execute(packageData).DataInserted, 1);
  assert.equal(f.execute(packageData).DataInserted, 0);
  const existing = f.rows('mci_system_setting').find(row => row.ConfigKey === 'first');
  assert.equal(existing.Id, 'tenant-id'); assert.equal(existing.ConfigValue, 'tenant-value'); assert.equal(existing.Category, 'new');
  assert.equal(f.rows('mci_system_setting').length, 2);
  for (const call of f.calls.filter(call => call.method === 'update')) {
    assert.equal(call.shared, true);
    assert.deepEqual(Object.keys(call.args).sort(), ['Category', 'Description', 'Id', 'OsClient']);
  }
});

test('真实查询错误继续失败，前行新增和既有行元数据更新一起回滚', () => {
  const initial = [{ Id: 'existing', ConfigKey: 'retained', ConfigValue: 'tenant-value', Category: 'old' }];
  const f = fixture({ tables: { mci_system_setting: initial }, queryError: (_table, args) => args._Where?.some(([key, , value]) => key === 'ConfigKey' && value === 'broken') });
  assert.throws(() => f.execute([settings([
    { Id: 'new', ConfigKey: 'new', ConfigValue: 'default', Category: 'new' },
    { Id: 'package-existing', ConfigKey: 'retained', ConfigValue: 'default', Category: 'new' },
    { Id: 'broken', ConfigKey: 'broken', ConfigValue: 'default', Category: 'new' }
  ], { MetadataFieldsIfExists: ['Category'] })]), /业务冲突键失败.*permission denied/);
  assert.deepEqual(f.rows('mci_system_setting'), initial);
});

test('Id 查询错误不能降格为不存在或进入新增', () => {
  const f = fixture({ queryError: (_table, args) => args.Id === 'broken' });
  assert.throws(() => f.execute([settings([{ Id: 'broken', ConfigKey: 'broken' }])]), /既有 Id 失败.*permission denied/);
  assert.ok(!f.calls.some(call => call.method === 'add'));
});

test('父记录绑定能读取同片前一数据集写入，父记录与子种子一并提交', () => {
  const f = fixture();
  f.execute([
    { TableName: 'business_parent', ConflictPolicy: 'InsertIfMissing', Rows: [{ Id: 'parent', IsEnable: 1 }] },
    settings([{ Id: 'child', ConfigKey: 'child' }], { ParentBinding: { Field: 'ParentId', TableName: 'business_parent', MatchField: 'IsEnable', MatchValue: 1 } })
  ]);
  assert.equal(f.rows('mci_system_setting')[0].ParentId, 'parent');
  assert.equal(f.calls.find(call => call.method === 'list' && call.table === 'business_parent').shared, true);
});

test('目标表与严格零行共享依赖的元数据均从同一安装事务读取', () => {
  const f = fixture({ pendingMetadata: true });
  const result = f.execute([
    { TableId: 'shared', TableName: 'sys_config', SelectionMode: 'Ids', RowIds: [], Where: [], ConflictPolicy: 'InsertIfMissing', ConflictFields: ['Id'], Rows: [] },
    settings([{ Id: 'a', ConfigKey: 'a' }])
  ]);
  assert.equal(result.DataSetCount, 2); assert.equal(result.DataInserted, 1);
  assert.ok(f.calls.filter(call => call.table === 'diy_table').every(call => call.shared));
});

test('负对照：仅移除两处查重的事务即重现第二条种子的独立连接锁等待', () => {
  const oldReads = block
    .replace('GetFormData(dataTableName, { Id: String(sourceRow.Id) }, V8.DbTrans)', 'GetFormData(dataTableName, { Id: String(sourceRow.Id) })')
    .replace('_PageSize: 1\n        }, V8.DbTrans)', '_PageSize: 1\n        })')
    .replace('_PageSize: 1\r\n        }, V8.DbTrans)', '_PageSize: 1\r\n        })');
  const f = fixture();
  assert.throws(() => f.execute([settings([{ Id: 'a', ConfigKey: 'a' }, { Id: 'b', ConfigKey: 'b' }])], oldReads), /SQL lock timeout/);
  assert.equal(f.rows('mci_system_setting').length, 0);
});
