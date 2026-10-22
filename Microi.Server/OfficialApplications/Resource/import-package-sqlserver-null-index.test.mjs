import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
const parser = source.slice(source.indexOf('function readDeclarativePackageDdl('), source.indexOf('/* SPARSE_TABLE_IMPORT_PREFLIGHT_V2'));
const helpers = source.slice(source.indexOf('    // PACKAGE_DECLARED_INDEX_DEFINITION_V1'), source.indexOf('    // MySQL 严格模式不允许'));
const execute = source.slice(source.indexOf('    var executePackageDdl ='), source.indexOf('    // PACKAGE_DECLARED_IDENTIFIER_STORAGE_V1'));

function fixture(options = {}) {
  const columns = options.columns ?? [{ COLUMN_NAME: 'RequestId', IS_NULLABLE: 'YES' }];
  const names = options.names ?? ['RequestId'];
  const item = { TableName: 'history', DDL: `CREATE ${options.unique === false ? '' : 'UNIQUE '}INDEX \`ux_history\` ON \`history\` (${names.map(n => '`' + n + '`').join(',')});`, ...options.item };
  let exists = !!options.exists, filter = options.filter ?? null;
  const writes = [];
  const scope = {
    allDdlStatements: [item], runtimeIsSqlServer: options.sqlServer !== false,
    isSafeIdentifier: name => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name)),
    readTargetPhysicalColumns: () => { if (options.catalogError) throw Error('catalog unavailable'); return columns; },
    getScalarCount: (row, keys) => Number(keys.map(k => row[k]).find(v => v !== undefined)),
    quotePhysicalIdentifier: name => '[' + name + ']',
    V8: { Db: { FromSql(sql) { return {
      AddInParameter() { return this; },
      ToArray() {
        if (/COUNT/.test(sql)) return [{ ObjectCount: exists ? 1 : 0 }];
        return names.map((ColumnName, i) => ({ ColumnName, SeqInIndex: i + 1, IsUnique: options.unique === false ? 0 : 1,
          IsDisabled: 0, IsHypothetical: 0, IsDescending: 0, IsIncluded: 0, IsPrimaryKey: 0, IsUniqueConstraint: 0,
          IndexType: 2, FilterDefinition: filter, ...options.indexPatch }));
      },
      ExecuteNonQuery() {
        writes.push(sql);
        if (options.writeError) throw Error('duplicate non-null key');
        if (!options.dropWrite) {
          exists = true;
          filter = sql.match(/ WHERE (.*?)(?: WITH |$)/)?.[1] ?? null;
        }
      }
    }; } } }
  };
  vm.runInNewContext(parser + '\n' + helpers + '\n' + execute, scope);
  scope.classifyDdlStatement = scope.readDeclarativePackageDdl;
  return { scope, writes, item, install() {
    const info = scope.classifyDdlStatement(item.DDL, item.TableName);
    if (!scope.ddlIndexExists(info.TableName, info.IndexName)) scope.executePackageDdl(item, info);
    assert.equal(scope.ddlIndexExists(info.TableName, info.IndexName), true);
  } };
}

test('SQL Server nullable unique keys exclude every nullable component and reinstall without DDL', () => {
  for (const columns of [
    [{ COLUMN_NAME: 'RequestId', IS_NULLABLE: 'YES' }],
    [{ COLUMN_NAME: 'Tenant', IS_NULLABLE: 'NO' }, { COLUMN_NAME: 'RequestId', IS_NULLABLE: 'YES' }],
    [{ COLUMN_NAME: 'Tenant', IS_NULLABLE: 'YES' }, { COLUMN_NAME: 'RequestId', IS_NULLABLE: 'YES' }],
  ]) {
    const f = fixture({ columns, names: columns.map(c => c.COLUMN_NAME) });
    f.install(); f.install();
    assert.equal(f.writes.length, 1);
    const expected = columns.filter(c => c.IS_NULLABLE === 'YES').map(c => `[${c.COLUMN_NAME}] IS NOT NULL`).join(' AND ');
    assert.ok(f.writes[0].endsWith(' WHERE ' + expected), f.writes[0]);
  }
});

test('required and nonunique keys do not gain filters; explicit filter remains the package authority', () => {
  for (const options of [{ columns: [{ COLUMN_NAME: 'RequestId', IS_NULLABLE: 'NO' }] }, { unique: false }]) {
    const f = fixture(options); f.install(); assert.doesNotMatch(f.writes[0], /WHERE/);
  }
  const f = fixture({ names: ['Tenant', 'RequestId'], columns: [{ COLUMN_NAME: 'Tenant', IS_NULLABLE: 'YES' }, { COLUMN_NAME: 'RequestId', IS_NULLABLE: 'YES' }], item: { SqlServerFilterColumn: 'RequestId' } });
  f.install(); assert.ok(f.writes[0].endsWith(' WHERE [RequestId] IS NOT NULL'));
});

test('historical ordinary unfiltered unique index is atomically reconciled once', () => {
  const f = fixture({ exists: true }); f.install(); f.install();
  assert.equal(f.writes.length, 1);
  assert.match(f.writes[0], /WHERE \[RequestId\] IS NOT NULL WITH \(DROP_EXISTING = ON\)$/);
  assert.doesNotMatch(f.writes[0], /DROP INDEX|DELETE|UPDATE/);
});

test('equivalent SQL Server filter parentheses and conjunction ordering are idempotent', () => {
  const f = fixture({ exists: true, names: ['Tenant', 'RequestId'],
    columns: [{ COLUMN_NAME: 'Tenant', IS_NULLABLE: 'YES' }, { COLUMN_NAME: 'RequestId', IS_NULLABLE: 'YES' }],
    filter: '(([RequestId] IS NOT NULL) AND ([Tenant] IS NOT NULL))' });
  f.install(); assert.equal(f.writes.length, 0);
});

test('legacy partial NULL filters expand only to the actual nullable key set', () => {
  const f = fixture({ exists: true, names: ['Tenant', 'RequestId'],
    columns: [{ COLUMN_NAME: 'Tenant', IS_NULLABLE: 'YES' }, { COLUMN_NAME: 'RequestId', IS_NULLABLE: 'YES' }],
    filter: '[RequestId] IS NOT NULL' });
  f.install(); f.install(); assert.equal(f.writes.length, 1);
  assert.match(f.writes[0], /WHERE \[Tenant\] IS NOT NULL AND \[RequestId\] IS NOT NULL WITH \(DROP_EXISTING = ON\)$/);
});

test('unknown column metadata fails before writes instead of guessing nullability', () => {
  for (const options of [{ columns: [] }, { columns: [{ COLUMN_NAME: 'RequestId' }] },
    { columns: [{ COLUMN_NAME: 'RequestId', IS_NULLABLE: 'YES' }, { COLUMN_NAME: 'requestid', IS_NULLABLE: 'YES' }] }, { catalogError: true }]) {
    const f = fixture(options); assert.throws(() => f.install(), /索引|catalog/); assert.equal(f.writes.length, 0);
  }
});

test('unrelated filters, key drift, constraints and disabled indexes are never silently replaced', () => {
  for (const options of [{ filter: '[RequestId] IS NOT NULL AND [Tenant] IS NOT NULL' },
    { indexPatch: { ColumnName: 'WrongKey' } }, { indexPatch: { IsUnique: 0 } },
    { indexPatch: { IsPrimaryKey: 1 } }, { indexPatch: { IsUniqueConstraint: 1 } },
    { indexPatch: { IndexType: 1 } }, { indexPatch: { IsDisabled: 1 } },
    { indexPatch: { IsIncluded: 1 } }, { indexPatch: { IsDescending: 1 } }]) {
    const f = fixture({ exists: true, ...options });
    assert.throws(() => f.install(), /索引定义冲突/); assert.equal(f.writes.length, 0);
  }
});

test('non-null conflicts and missing write readbacks remain failures with no destructive fallback', () => {
  for (const exists of [false, true]) {
    const failed = fixture({ exists, writeError: true });
    assert.throws(() => failed.install(), /duplicate non-null key/); assert.equal(failed.writes.length, 1);
  }
  const stale = fixture({ exists: true, dropWrite: true });
  assert.throws(() => stale.install(), /索引定义冲突/); assert.equal(stale.writes.length, 1);
});

test('SQL Server unique-index columns synchronize before inference, once per table and fail closed', () => {
  const first = source.indexOf('    var ensureDeclaredIndexColumns =');
  assert.ok(first >= 0, 'unique index preparation must precede DDL execution');
  const helper = source.slice(first, source.indexOf('    var ddlTablesChecked =', first));
  for (const sqlServer of [false, true]) {
    const calls = [], scope = { runtimeIsSqlServer: sqlServer,
      syncPhysicalColumnsFromPackage(tables) { calls.push(Object.keys(tables)); return { Errors: 0 }; } };
    vm.runInNewContext(helper, scope);
    const info = { Kind: 'index', TableName: 'history' };
    scope.ensureDeclaredIndexColumns({ DDL: 'CREATE INDEX ix_a ON history(RequestId)' }, info);
    assert.equal(calls.length, 0);
    for (const ddl of ['CREATE UNIQUE INDEX ux_a ON history(RequestId)', 'ALTER TABLE history ADD UNIQUE KEY ux_b(RequestId)'])
      scope.ensureDeclaredIndexColumns({ DDL: ddl }, info);
    assert.equal(calls.length, sqlServer ? 1 : 0);
    scope.ensureDeclaredIndexColumns({ ApplicationStreamGateContract: true, DDL: 'CREATE INDEX ix_gate ON gate(Id)' }, { Kind: 'index', TableName: 'gate' });
    assert.deepEqual(calls.at(-1), ['gate']);
  }
  const scope = { runtimeIsSqlServer: true, syncPhysicalColumnsFromPackage() { return { Errors: 1 }; } };
  vm.runInNewContext(helper, scope);
  assert.throws(() => scope.ensureDeclaredIndexColumns({ DDL: 'CREATE UNIQUE INDEX ux_a ON history(RequestId)' },
    { Kind: 'index', TableName: 'history' }), /索引.*物理列/);
  assert.ok(source.indexOf('ensureDeclaredIndexColumns(ddlItem, ddlInfo);') < source.indexOf('var alreadyExists = ddlInfo.Kind'));
});
