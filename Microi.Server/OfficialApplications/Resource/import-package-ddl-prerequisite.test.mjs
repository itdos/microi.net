import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
const helper = source.match(/var ensureDeclaredIndexTable = function[\s\S]*?(?=\s*var ddlTablesChecked)/)[0];
const table = {TableName:'history', DDL:'CREATE TABLE `history` (`Id` varchar(36), `Created` datetime)'};
const index = {TableName:'history', DDL:'CREATE INDEX `ix_history_time` ON `history` (`Created`)'};
function fixture(options = {}) {
  const statements = options.rows || [index, table];
  const original = JSON.stringify(statements);
  const writes = [];
  let exists = !!options.exists;
  const scope = {
    allDdlStatements: statements, debugLog:{}, ddlTableExists:() => exists,
    classifyDdlStatement:(ddl, name) => ({Kind:/^CREATE TABLE/.test(ddl) ? 'table':'index', TableName:name}),
    normalizePackageDdlNullability:ddl => ddl,
    executePackageDdl(item) {
      writes.push(item.DDL);
      if (options.race) {exists = true; throw Error('concurrent create');}
      if (options.error) throw Error('DDL denied');
      if (!options.dropWrite) exists = true;
    },
    requirePackageDdlObject(info, error) {
      if (!exists) throw Error(error?.message || 'physical readback missing');
    }
  };
  vm.runInNewContext(helper + '\nrun=ensureDeclaredIndexTable;', scope);
  return {run:kind => scope.run({Kind:kind || 'index', TableName:'history'}), writes,
    unchanged:() => assert.equal(JSON.stringify(statements), original)};
}
test('跨 DDL 分片的索引先补其声明表，重放不写，检查点数组保持原样', () => {
  const f = fixture(); f.run(); f.run(); f.unchanged();
  assert.deepEqual(f.writes, [table.DDL]);
  const existing = fixture({exists:true}); existing.run(); assert.equal(existing.writes.length, 0);
  const normal = fixture(); normal.run('table'); assert.equal(normal.writes.length, 0);
});
test('缺少或重复建表声明在写入前拒绝，写失败或强回读失败不推进', () => {
  for (const rows of [[index], [index, table, table]]) {
    const f = fixture({rows}); assert.throws(() => f.run(), /建表/); assert.equal(f.writes.length, 0);
  }
  assert.throws(() => fixture({error:true}).run(), /DDL denied/);
  assert.throws(() => fixture({dropWrite:true}).run(), /physical readback missing/);
  const race = fixture({race:true}); race.run(); race.run(); assert.equal(race.writes.length, 1);
});
