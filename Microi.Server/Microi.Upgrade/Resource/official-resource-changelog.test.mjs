import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('./official-resource-api.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function validatePackageChangeLog('), source.indexOf('var liveApiEngineFields'));
const model = { PackageInfo: { Version: 'v8.0.1', ChangeLog: { Version: 'v8.0.1', Title: '标题', ChangeType: 'Fix', Content: '修复说明', ReleaseTime: '2026-09-05 16:10:00' } } };
function fixture(rows = [], mode = '') {
  let writes = 0;
  const db = { FromSql(sql) {
    assert.match(sql, /StoreId=@p0 AND Version=@p1/);
    const params = {};
    return { AddInParameter(key, value) { params[key] = value; return this; }, ToArray() {
      assert.equal(params['@p0'], 'store-id'); assert.equal(params['@p1'], 'v8.0.1'); return rows;
    } };
  } };
  const V8 = { Db: db, DbTrans: { FromSql() { throw new Error('must verify committed log before pointer'); } }, OsClient: 'iTdos', Method: { NewGuid: () => 'new-id' }, FormEngine: { AddFormData(table, row, trans) {
    assert.equal(table, 'sys_microistore_changelog'); assert.equal(trans, undefined); writes++;
    if (mode === 'reject') return { Code: 0, Msg: 'injected' };
    if (mode !== 'lost') rows.push({ ...row });
    return { Code: 1 };
  } } };
  const context = vm.createContext({ V8, text: value => value == null ? '' : String(value), DateNow: () => '' });
  vm.runInContext(functions, context);
  return { run: (input = model) => context.ensurePackageChangeLog('store-id', input), rows, writes: () => writes };
}
test('publication reads committed exact version log independently of pointer transaction; replay adds nothing', () => {
  const f = fixture(); f.run(); f.run(); assert.equal(f.writes(), 1); assert.equal(f.rows.length, 1);
});
test('publication cannot replace a released version log or revive a tombstone', () => {
  for (const patch of [{ Content: 'old' }, { IsDeleted: 1 }]) {
    const f = fixture([{ ...model.PackageInfo.ChangeLog, ...patch }]);
    assert.throws(() => f.run(), /必须使用新版本/); assert.equal(f.writes(), 0);
  }
});
test('write failure or missing authoritative readback blocks publication', () => {
  assert.throws(() => fixture([], 'reject').run(), /保存失败/);
  assert.throws(() => fixture([], 'lost').run(), /强回读不一致/);
});
test('missing or mismatched version log is rejected before any write', () => {
  const f = fixture();
  assert.throws(() => f.run({ PackageInfo: { Version: 'v8.0.1' } }), /精确匹配/);
  assert.throws(() => f.run({ PackageInfo: { Version: 'v8.0.1', ChangeLog: { Version: 'v8.0.1' } } }), /缺少 Title/);
  assert.equal(f.writes(), 0);
});
test('package publication requires persisted log before HDFS and version pointer changes', () => {
  const body = source.slice(source.indexOf('function applyPublishResource('));
  const persistedLog = body.indexOf('ensurePackageChangeLog(');
  const storage = body.indexOf('V8.ApiEngine.Run("microi-store-package-storage"');
  const pointer = body.indexOf('V8.FormEngine.UptFormData("sys_microistore"');
  assert.ok(persistedLog >= 0 && storage > persistedLog && pointer > storage);
});
