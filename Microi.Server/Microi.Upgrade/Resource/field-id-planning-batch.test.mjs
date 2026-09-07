import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('./import-package.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const start = source.indexOf('    // FIELD_ID_PLAN_BOUNDED_READ_BATCH_V1');
const end = source.indexOf('    restorePersistentIdMaps();', start);
assert.ok(start > 0 && end > start);
const helpers = source.slice(start, end);

function run(fields, rows, options = {}) {
  const queries = [];
  const maps = { ...(options.maps || {}) };
  const equivalent = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
  const context = {
    Package: { DiyFields: fields },
    normalizeId: value => String(value || '').trim(),
    fieldMapTarget: id => maps[id] || '',
    addIdMap: (_kind, id, target) => { maps[id] = target; },
    V8: {
      Db: { FromSql(sql) {
        const values = {};
        const select = batch => {
          queries.push({ sql, values: { ...values }, batch });
          if (options.failBatch && batch) throw new Error('database read failed');
          if (sql.includes('WHERE Id IN')) {
            if (options.nullIds) return null;
            return rows.filter(row => Object.values(values).some(id => equivalent(id, row.Id)));
          }
          if (sql.includes('WHERE Id =')) return rows.find(row => equivalent(row.Id, values['@p0'])) || null;
          const selected = rows.filter(row => {
            for (let n = 0; n < Object.keys(values).length; n += 2) {
              if (equivalent(row.TableId, values['@p' + n]) && equivalent(row.Name, values['@p' + (n + 1)])) return true;
            }
            return false;
          }).sort((a, b) => Number(a.IsDeleted || 0) - Number(b.IsDeleted || 0));
          if (!batch) return selected[0] || null;
          const bounded = selected.slice(0, 513);
          return options.dotnetArray ? Object.assign({ length: bounded.length }, bounded) : bounded;
        };
        return { AddInParameter(key, value) { values[key] = value; return this; },
          First: () => select(false), ToArray: () => select(true) };
      } },
      Method: { NewUlid: () => { if (options.noNewId) throw Error('must reuse planned id'); return 'generated-id'; } }
    }
  };
  vm.runInNewContext(helpers + '\nplanPackageFieldIdMaps(0, Package.DiyFields.length);', context);
  return { maps, queries };
}

test('32 field mappings use two bounded reads and support CLR array wrappers', () => {
  const fields = Array.from({ length: 32 }, (_, n) => ({ Id: 'source-' + n, TableId: 'table', Name: 'Field' + n }));
  const rows = fields.map((f, n) => ({ ...f, Id: 'existing-' + n }));
  const result = run(fields, rows, { dotnetArray: true });
  assert.equal(result.queries.length, 2);
  assert.equal(Object.keys(result.maps).length, 32);
  for (let n = 0; n < 32; n++) assert.equal(result.maps['source-' + n], 'existing-' + n);
});

test('natural-key duplicates preserve the existing single-row selection', () => {
  const fields = [{ Id: 'a', TableId: 't', Name: 'A' }, { Id: 'b', TableId: 't', Name: 'B' }];
  const result = run(fields, [
    { Id: 'deleted-a', TableId: 't', Name: 'A', IsDeleted: 1 },
    { Id: 'live-a', TableId: 't', Name: 'A', IsDeleted: 0 },
    { Id: 'live-b', TableId: 't', Name: 'B', IsDeleted: 0 }
  ]);
  assert.equal(result.maps.a, 'live-a');
  assert.equal(result.maps.b, 'live-b');
  assert.equal(result.queries.filter(q => !q.batch).length, 1);
});

test('row-limit overflow falls back instead of treating truncated keys as absent', () => {
  const fields = [{ Id: 'a', TableId: 't', Name: 'A' }, { Id: 'b', TableId: 't', Name: 'B' }];
  const rows = Array.from({ length: 513 }, (_, n) => ({ Id: 'dup-' + n, TableId: 't', Name: 'A' }));
  rows.push({ Id: 'live-b', TableId: 't', Name: 'B' });
  const result = run(fields, rows);
  assert.equal(result.maps.b, 'live-b');
  assert.equal(result.queries.filter(q => q.batch).length, 1);
  assert.equal(result.queries.filter(q => !q.batch).length, 2);
});

test('source-id collisions reuse the checkpoint mapping on retry', () => {
  const fields = [{ Id: 'source-a', TableId: 't', Name: 'A' }, { Id: 'source-b', TableId: 't', Name: 'B' }];
  const rows = [{ Id: 'source-b', TableId: 'other', Name: 'Other' }];
  const first = run(fields, rows);
  assert.equal(first.maps['source-b'], 'generated-id');
  const retry = run(fields, rows, { maps: first.maps, noNewId: true });
  assert.equal(retry.maps['source-b'], 'generated-id');
  assert.equal(retry.queries.length, 2);
});

test('occupied checkpoint ids are checked before generating a replacement', () => {
  const fields = [{ Id: 'a', TableId: 't', Name: 'A' }, { Id: 'b', TableId: 't', Name: 'B' }];
  const result = run(fields, [
    { Id: 'a', TableId: 'other', Name: 'Other' },
    { Id: 'stale', TableId: 'third', Name: 'Wrong' }
  ], { maps: { a: 'stale' } });
  assert.equal(result.maps.a, 'generated-id');
});

test('all identifiers and names are bound parameters', () => {
  const fieldName = "x'); DROP TABLE diy_field; --";
  const fields = [{ Id: 'a', TableId: 't', Name: fieldName }, { Id: 'b', TableId: 't', Name: 'B' }];
  const result = run(fields, []);
  assert.ok(result.queries.every(q => !q.sql.includes(fieldName)));
  assert.ok(result.queries.some(q => Object.values(q.values).includes(fieldName)));
});

test('failed batch reads stop planning rather than inventing missing rows', () => {
  const fields = [{ Id: 'a', TableId: 't', Name: 'A' }, { Id: 'b', TableId: 't', Name: 'B' }];
  assert.throws(() => run(fields, [], { failBatch: true }), /database read failed/);
  assert.throws(() => run(fields, [], { nullIds: true }), /批量读取未返回结果/);
});

test('empty or whitespace identifiers keep the original skip behavior', () => {
  const result = run([{ Id: ' ', TableId: 't', Name: 'A' }, { Id: 'b', TableId: ' ', Name: 'B' }], []);
  assert.equal(result.queries.length, 0);
  assert.equal(Object.keys(result.maps).length, 0);
});
