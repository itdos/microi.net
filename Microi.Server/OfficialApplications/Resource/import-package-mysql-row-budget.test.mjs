import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./import-package.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('    var isMysqlRowSizeTooLargeError ='),
  source.indexOf('    var applyPersistedMysqlOffpageOverrides ='));
const addLoop = source.slice(source.indexOf('            var fieldsAddedForTable = 0;'),
  source.indexOf('            if (fieldsAddedForTable > 0)'));

function fixture(options = {}) {
  // 历史表已接近上限：仅把待新增字段改为 TEXT 的 12 字节指针也无法容纳。
  const tableName = 'legacy_user';
  const rows = [{ TABLE_NAME: tableName, COLUMN_NAME: 'OwnedSetting', COLUMN_TYPE: 'varchar(500)',
    IS_NULLABLE: 'YES', COLUMN_DEFAULT: null, COLUMN_KEY: '', EXTRA: '',
    CHARACTER_SET_NAME: 'utf8mb4', COLLATION_NAME: 'utf8mb4_bin', COLUMN_COMMENT: "保留'说明", ...(options.column || {}) }];
  const fields = [
    { TableId: 'table-1', Name: 'LastWebsiteLoginTime', Type: 'varchar(25)' },
    { TableId: 'table-1', Name: 'InvitationPath', Type: 'varchar(2000)' },
    { TableId: 'table-1', Name: 'OwnedSetting', Type: options.declaredType || 'varchar(500)' },
  ];
  const calls = [];
  let budget = 65530;
  const ctx = { Package: { DiyTables: [{ Id: 'table-1', Name: tableName }], DiyFields: fields,
    PhysicalColumns: rows.map(row => ({ ...row, COLUMN_TYPE: options.physicalType || row.COLUMN_TYPE })), DDLStatements: [] },
    runtimeIsSqlServer: options.sqlServer || false, mysqlOffpageTypeOverrides: {}, debugLog: {},
    ddlItem: { TableName: tableName, TableId: 'table-1' }, tableFields: fields.slice(0, 2),
    fieldsAdded: 0, existingColumns: { ownedsetting: true }, existingColumnTypes: { ownedsetting: 'varchar(500)' },
    packageOwnsPhysicalTable: () => options.owned !== false,
    isSafeIdentifier: value => /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value || '')),
    sqlString: value => String(value).replace(/'/g, "''"), quotePhysicalIdentifier: value => '`' + value + '`',
    mapToMySQLType: value => value,
    getPhysicalValue(row, names) { for (const name of names) if (row[name] !== undefined) return row[name]; return null; },
    readTargetPhysicalColumns: () => rows.map(row => ({ ...row })),
    buildDiyFieldAddColumnSql: (_table, field, type) => 'ALTER TABLE `legacy_user` ADD COLUMN `' + field.Name + '` ' + type + ' NULL',
    V8: { Db: { FromSql(sql) {
      const call = { sql, params: [] }; calls.push(call);
      return { AddInParameter(key, value) { call.params.push([key, value]); return this; },
        ToArray() { if (options.indexReadError) throw new Error('索引读取权限不足'); return options.indexed ? [{ COLUMN_NAME: 'OwnedSetting' }] : []; },
        ExecuteNonQuery() {
          if (options.error && / ADD COLUMN /.test(sql)) throw new Error(options.error);
          if (/ MODIFY COLUMN `OwnedSetting` (medium|long)text/.test(sql)) {
            assert.match(sql, /CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL COMMENT '保留''说明'/);
            if (!options.badReadback) rows[0].COLUMN_TYPE = / longtext/.test(sql) ? 'longtext' : 'mediumtext';
            budget -= 1988; return 0;
          }
          const match = / ADD COLUMN `([^`]+)` (varchar\((\d+)\)|mediumtext)/.exec(sql);
          assert.ok(match, sql);
          const bytes = match[3] ? Number(match[3]) * 4 + 2 : 12;
          if (budget + bytes > 65535) throw new Error('Row size too large. The maximum row size is 65535');
          rows.push({ TABLE_NAME: tableName, COLUMN_NAME: match[1], COLUMN_TYPE: match[2], IS_NULLABLE: 'YES' });
          budget += bytes; return 0;
        } };
    } } },
  };
  vm.runInNewContext(helpers + '\n' + addLoop, ctx);
  return { ctx, rows, calls };
}

test('exhausted legacy row is repaired before adding a short date and a long invitation path', () => {
  const result = fixture();
  assert.equal(result.ctx.fieldsAdded, 2, JSON.stringify(result.ctx.debugLog));
  assert.equal(result.rows.find(row => row.COLUMN_NAME === 'LastWebsiteLoginTime').COLUMN_TYPE, 'varchar(25)');
  assert.equal(result.rows.find(row => row.COLUMN_NAME === 'InvitationPath').COLUMN_TYPE, 'mediumtext');
  assert.equal(result.calls.filter(call => / MODIFY COLUMN /.test(call.sql)).length, 1);
  assert.equal(result.ctx.mysqlOffpageTypeOverrides['legacy_user.ownedsetting'], 'mediumtext');
});

test('actual target indexes and unowned tables prevent automatic widening of existing columns', () => {
  for (const options of [{ indexed: true }, { owned: false }]) {
    const result = fixture(options);
    assert.equal(result.ctx.fieldsAdded, 0);
    assert.equal(result.calls.filter(call => / MODIFY COLUMN /.test(call.sql)).length, 0);
    assert.ok(Object.keys(result.ctx.debugLog).some(key => key.includes('field_add_error')));
  }
});

test('non-row-size errors never mutate other columns', () => {
  const result = fixture({ error: 'ALTER command denied' });
  assert.equal(result.ctx.fieldsAdded, 0);
  assert.equal(result.calls.filter(call => / MODIFY COLUMN /.test(call.sql)).length, 0);
});

test('widening requires a physical readback before the installer can claim success', () => {
  const result = fixture({ badReadback: true });
  assert.match(result.ctx.debugLog.field_add_error_legacy_user_LastWebsiteLoginTime, /回读/);
  assert.equal(result.ctx.debugLog.field_added_legacy_user_LastWebsiteLoginTime, undefined);
});


test('defaults, NOT NULL, generated columns, undeclared numeric types and failed index reads are protected', () => {
  for (const options of [
    { column: { COLUMN_DEFAULT: 'default' } }, { column: { IS_NULLABLE: 'NO' } },
    { column: { EXTRA: 'STORED GENERATED' } }, { declaredType: 'int' },
    { physicalType: 'int' }, { indexReadError: true },
  ]) {
    const result = fixture(options);
    assert.equal(result.ctx.fieldsAdded, 0, JSON.stringify(options));
    assert.equal(result.calls.filter(call => / MODIFY COLUMN /.test(call.sql)).length, 0);
    assert.equal(result.ctx.Package.DiyFields[2].Type, options.declaredType || 'varchar(500)', 'no partial package mutation');
  }
});

test('a source LONGTEXT contract is never narrowed during row-budget recovery', () => {
  const result = fixture({ declaredType: 'longtext' });
  assert.equal(result.ctx.fieldsAdded, 2, JSON.stringify(result.ctx.debugLog));
  assert.equal(result.rows[0].COLUMN_TYPE, 'longtext');
});

test('reinstall skips completed columns and restores off-page types from a persisted checkpoint', () => {
  const result = fixture();
  const before = result.calls.length;
  vm.runInNewContext(addLoop, result.ctx);
  assert.equal(result.calls.length, before);
  assert.equal(result.ctx.fieldsAdded, 2);
  result.ctx.Package.DiyFields[2].Type = 'varchar(500)';
  result.ctx.Package.PhysicalColumns[0].COLUMN_TYPE = 'varchar(500)';
  const restore = source.slice(source.indexOf('    var applyPersistedMysqlOffpageOverrides ='),
    source.indexOf('    var getScalarCount =', source.indexOf('    var applyPersistedMysqlOffpageOverrides =')));
  vm.runInNewContext(restore, result.ctx);
  assert.equal(result.ctx.Package.DiyFields[2].Type, 'mediumtext');
  assert.equal(result.ctx.Package.PhysicalColumns[0].COLUMN_TYPE, 'mediumtext');
});
