import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('./import-package.js', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('    var mapToMySQLType ='), source.indexOf('    var quoteSqlServerCatalogIdentifier ='));
const context = {runtimeIsSqlServer: false};
vm.runInNewContext(helpers, context);

test('physical BIT never falls back to varchar during package synchronization', () => {
  for (const type of ['bit', 'bit(1)', 'bit(8)', 'bit(64)']) assert.equal(context.mapToMySQLType(type), type);
  assert.equal(context.chooseCompatibleColumnType(context.mapToMySQLType('bit(1)'), 'bit(1)'), 'bit(1)');
  assert.equal(context.chooseCompatibleColumnType('bit(1)', 'int(11)'), 'int(11)');
  assert.equal(context.chooseCompatibleColumnType('bit(1)', 'tinyint(1)'), 'tinyint(1)');
  // Multi-bit masks must not be confused with boolean values.
  assert.equal(context.chooseCompatibleColumnType('bit(64)', 'int(11)'), 'bit(64)');
});

test('integer display width is equivalent but precision and signedness are not', () => {
  assert.equal(context.normalizeSqlType('int(11)'), context.normalizeSqlType('int'));
  assert.equal(context.chooseCompatibleColumnType('int', 'int(11)'), 'int(11)');
  assert.notEqual(context.normalizeSqlType('int unsigned'), context.normalizeSqlType('int'));
  assert.notEqual(context.normalizeSqlType('decimal(18,2)'), context.normalizeSqlType('decimal(18,4)'));
});

function syncColumn(target, incoming, {readbackMatches = true} = {}) {
  const sql = [];
  const c = {...context, Package: {PhysicalColumns: [incoming], DiyTables: [{Name: 'diy_schedule_job_log'}]}, debugLog: {},
    quotePhysicalIdentifier: name => '`' + name + '`',
    groupPackagePhysicalColumns: () => ({log: {TableName: 'diy_schedule_job_log', Columns: [incoming]}}),
    getTargetPhysicalColumns: () => ({isdeleted: target}),
    getPhysicalValue: (row, names) => names.map(name => row[name]).find(value => value !== undefined),
    V8: {Db: {FromSql: text => {sql.push(text); return {ExecuteNonQuery: () => {
      if (readbackMatches && text.includes(' ALTER COLUMN ')) target.COLUMN_DEFAULT = incoming.COLUMN_DEFAULT;
      return 0;
    }};}}},
    prepareNumericColumnData: () => {throw new Error('compatible column must not scan rows');},
    prepareNotNullColumnData: () => {throw new Error('compatible column must not backfill rows');}
  };
  const body = source.slice(source.indexOf('    var packageOwnsPhysicalTable ='), source.indexOf('    var buildPhysicalTableFilter ='));
  vm.runInNewContext(body, c);
  const result = c.syncPhysicalColumnsFromPackage(null);
  assert.equal(result.Errors, 0, JSON.stringify(c.debugLog));
  return {result, sql};
}

test('default-only changes use metadata DDL, preserve existing rows and verify readback', () => {
  const source = {COLUMN_NAME: 'IsDeleted', COLUMN_TYPE: 'bit(1)', IS_NULLABLE: 'YES', COLUMN_DEFAULT: "b'0'"};
  const {result, sql} = syncColumn({...source, COLUMN_TYPE: 'int(11)', COLUMN_DEFAULT: null}, source);
  assert.equal(result.Modified, 1);
  assert.deepEqual(sql, ["ALTER TABLE `diy_schedule_job_log` ALTER COLUMN `IsDeleted` SET DEFAULT b'0', ALGORITHM=INPLACE, LOCK=NONE"]);
  assert.throws(() => syncColumn({...source, COLUMN_TYPE: 'int', COLUMN_DEFAULT: null}, source, {readbackMatches:false}), /回读不一致/);
});

test('an empty string default is distinct from no default and defaults can be removed', () => {
  const source = {COLUMN_NAME:'IsDeleted',COLUMN_TYPE:'varchar(50)',IS_NULLABLE:'YES',COLUMN_DEFAULT:''};
  assert.match(syncColumn({...source,COLUMN_DEFAULT:null},source).sql[0], /SET DEFAULT ''/);
  assert.match(syncColumn({...source},{...source,COLUMN_DEFAULT:null}).sql[0], /DROP DEFAULT/);
});

test('large log table boolean and cosmetic differences cause zero DDL and zero row scans', () => {
  const incoming = {COLUMN_NAME: 'IsDeleted', COLUMN_TYPE: 'bit(1)', IS_NULLABLE: 'YES', COLUMN_DEFAULT: "b'0'", COLUMN_COMMENT: '是否删除'};
  for (const type of ['bit(1)', 'int', 'int(11)', 'tinyint(1)']) {
    const {result, sql} = syncColumn({...incoming, COLUMN_TYPE: type, COLUMN_DEFAULT: type === 'bit(1)' ? "b'0'" : '0', COLUMN_COMMENT: '是否已删除'}, incoming);
    assert.equal(result.Skipped, 1);
    assert.deepEqual(sql, []);
  }
});

test('字段元数据路径不重复修改包内物理列，也不因标签变动修改大表', () => {
  const phase = source.slice(source.indexOf('    // 阶段0：执行字段变更'), source.indexOf('    // 阶段1：按TableId分组字段'));
  const changes = [
    {OldType: 'int', NewType: 'int', OldLabel: '旧标签', NewLabel: '新标签'},
    {OldType: 'bit(1)', NewType: 'int', OldLabel: '是否删除', NewLabel: '是否删除'}
  ].map(c => ({...c, TableName: 'diy_schedule_job_log', OldName: 'IsDeleted', NewName: 'IsDeleted'}));
  const c = {...context, fieldChanges: changes, debugLog: {},
    packagePhysicalColumns: [{TABLE_NAME: 'diy_schedule_job_log', COLUMN_NAME: 'IsDeleted', COLUMN_TYPE: 'bit(1)'}],
    isVirtualFieldType: () => false,
    getPhysicalValue: (row, names) => names.map(n => row[n]).find(x => x !== undefined),
    V8: {Db: {FromSql: () => {throw new Error('元数据路径不能执行SQL');}}}
  };
  vm.runInNewContext(phase,c);
  assert.equal(c.debugLog.modify_skipped_metadata_only_diy_schedule_job_log_IsDeleted, '仅字段标签变化，物理列无需修改');
  assert.equal(c.debugLog.modify_deferred_physical_diy_schedule_job_log_IsDeleted, '由物理列同步统一处理');
  assert.ok(!Object.keys(c.debugLog).some(k=>/error/.test(k)), JSON.stringify(c.debugLog));
});

test('应用文件写回不再直接依赖租户 DateNow', () => {
  const body = source.slice(source.indexOf('    var persistApplicationAsset ='), source.indexOf('    var persistApplicationAsset =') + 2500);
  assert.match(body, /var now = nowText\('yyyy-MM-dd HH:mm:ss'\)/);
  assert.doesNotMatch(body, /\bDateNow\s*\(/);
});
