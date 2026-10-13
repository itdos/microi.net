import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { auditTable, auditColumns, gateIndexes, applyApplicationStreamPhysicalContract } from './application-stream-physical-contract.mjs';
import { validateOfficialPackageInstallContracts } from './resource-sync-core.mjs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const packageModel = JSON.parse(read('./app.microi.store.json'));
const importer = read('./import-package.js');
const parser = importer.slice(importer.indexOf('function readDeclarativePackageDdl('), importer.indexOf('/* SPARSE_TABLE_IMPORT_PREFLIGHT_V2'));
const indexHelpers = importer.slice(importer.indexOf('    // PACKAGE_DECLARED_INDEX_DEFINITION_V1'), importer.indexOf('    // MySQL 严格模式不允许'));
const executeHelper = importer.slice(importer.indexOf('    var executePackageDdl ='), importer.indexOf('    // PACKAGE_DECLARED_IDENTIFIER_STORAGE_V1'));
function context(statements, query, sqlServer = false) {
  const scope = { allDdlStatements: statements, runtimeIsSqlServer: sqlServer,
    isSafeIdentifier: name => /^[A-Za-z0-9_]+$/.test(String(name)),
    getScalarCount: (row, names) => Number(names.map(name => row[name]).find(value => value !== undefined)),
    quotePhysicalIdentifier: name => sqlServer ? '[' + name + ']' : '`' + name + '`',
    V8: { Db: { FromSql(sql) { const args = {}; return {
      AddInParameter(key, value) { args[key] = value; return this; },
      ToArray() { return query(sql, args); }, ExecuteNonQuery() { return query(sql, args); },
    }; } } },
  };
  vm.runInNewContext(parser + '\n' + indexHelpers + '\n' + executeHelper, scope);
  scope.classifyDdlStatement = scope.readDeclarativePackageDdl;
  return scope;
}
const indexItem = index => packageModel.DDLStatements.find(row => row.TableName === index.TableName && row.DDL.includes('`' + index.IndexName + '`'));

test('release package delivers the physical-only ledger and every required gate index', () => {
  assert.equal(packageModel.DDLStatements.filter(row => row.TableName === auditTable && /^CREATE TABLE/.test(row.DDL)).length, 1);
  assert.deepEqual(packageModel.PhysicalColumns.filter(row => row.TABLE_NAME === auditTable).map(row => row.COLUMN_NAME), auditColumns.map(([name]) => name));
  for (const index of gateIndexes) {
    const item = indexItem(index); assert.ok(item, index.IndexName);
    assert.equal(item.SqlServerFilterColumn, index.SqlServerFilterColumn);
  }
  assert.equal(packageModel.DiyTables.some(row => row.Name === auditTable), false);
  assert.equal(packageModel.DiyFields.some(row => row.TableName === auditTable), false);
  assert.equal(packageModel.DataSets.some(row => row.TableName === auditTable), false);
  assert.doesNotThrow(() => validateOfficialPackageInstallContracts('app.microi.store.json', JSON.stringify(packageModel)));
});
test('generator replays preserve version, unrelated resources and all existing rows', () => {
  const once = applyApplicationStreamPhysicalContract(packageModel);
  assert.deepEqual(applyApplicationStreamPhysicalContract(once), once);
  for (const name of ['DiyTables', 'DiyFields', 'DataSets', 'SysMenus', 'SysApiEngines', 'ApplicationBundles'])
    assert.deepEqual(once[name], packageModel[name], name);
  assert.equal(once.PackageInfo.Version, packageModel.PackageInfo.Version);
});
test('ledger seed data and writable metadata are rejected while physical Unicode structure remains allowed', () => {
  for (const extra of [{ DiyTables: [{ Name: auditTable }] }, { DiyFields: [{ TableName: auditTable }] }, { DataSets: [{ TableName: auditTable, Rows: [{ TransitionId: 'fake' }] }] }]) {
    assert.throws(() => applyApplicationStreamPhysicalContract({ PackageInfo: {}, ...extra }), /禁止/);
    assert.throws(() => validateOfficialPackageInstallContracts('app.microi.store.json', JSON.stringify(extra)), /禁止/);
  }
  const preflight = importer.slice(0, importer.indexOf('// SQLSERVER_PHYSICAL_SCHEMA_DIALECT_V1'));
  for (const body of [{ DiyTables: [{ Name: auditTable }] }, { DiyFields: [{ TableName: auditTable }] },
    { DataSets: [{ TableName: auditTable, Rows: [{ TransitionId: 'fake' }] }] }]) {
    let writes = 0;
    const result = vm.runInNewContext('(function(){' + preflight + '\nreturn {Code:1};})()', {
      V8: { Param: { Package: body }, Db: new Proxy({}, { get() { writes++; throw Error('preflight must not access DB'); } }) },
    });
    assert.equal(result.Code, 0); assert.match(result.Msg, /审计/); assert.equal(writes, 0);
  }
});
test('existing index names require matching uniqueness, ordered full keys and SQL Server filters', () => {
  const definition = { TableName: 'history', DDL: 'CREATE UNIQUE INDEX `ux_history` ON `history` (`AppId`,`RequestId`);', SqlServerFilterColumn: 'RequestId' };
  const mysqlRows = [{ ColumnName: 'AppId', SeqInIndex: 1, NonUnique: 0, SubPart: null, IndexType: 'BTREE', SortOrder: 'A' },
    { ColumnName: 'RequestId', SeqInIndex: 2, NonUnique: 0, SubPart: null, IndexType: 'BTREE', SortOrder: 'A' }];
  for (const sqlServer of [false, true]) {
    const rows = sqlServer ? mysqlRows.map(row => ({ ...row, IsUnique: 1, IsDisabled: 0, IsHypothetical: 0, IsDescending: 0, IsIncluded: 0, FilterDefinition: '([RequestId] IS NOT NULL)' })) : mysqlRows;
    const build = values => context([definition], sql => /COUNT/.test(sql) ? [{ ObjectCount: 1 }] : values, sqlServer);
    assert.equal(build(rows).ddlIndexExists('history', 'ux_history'), true);
    for (const patch of [sqlServer ? { IsUnique: 0 } : { NonUnique: 1 }, { ColumnName: 'Unexpected' },
      sqlServer ? { FilterDefinition: null } : { SubPart: 20 }, sqlServer ? { IsIncluded: 1 } : { SortOrder: 'D' },
      ...(sqlServer ? [{ IsDisabled: 1 }, { IsHypothetical: 1 }] : [])]) {
      const invalid = structuredClone(rows); Object.assign(invalid[0], patch);
      assert.throws(() => build(invalid).ddlIndexExists('history', 'ux_history'), /索引定义冲突/);
    }
  }
});
test('SQL Server creation carries the declared null filter and rejects unsafe filter input before SQL', () => {
  const definition = { TableName: 'history', DDL: 'CREATE UNIQUE INDEX `ux_history` ON `history` (`AppId`,`RequestId`);', SqlServerFilterColumn: 'RequestId' };
  const writes = [], scope = context([definition], sql => { writes.push(sql); return []; }, true);
  scope.executePackageDdl(definition, scope.readDeclarativePackageDdl(definition.DDL, definition.TableName));
  assert.equal(writes[0], 'CREATE UNIQUE INDEX [ux_history] ON [history] ([AppId],[RequestId]) WHERE [RequestId] IS NOT NULL');
  for (const filter of ['Unknown', 'RequestId] DROP TABLE history', true]) {
    const invalid = { ...definition, SqlServerFilterColumn: filter };
    assert.throws(() => context([invalid], () => assert.fail('must not write SQL'), true)
      .executePackageDdl(invalid, scope.readDeclarativePackageDdl(invalid.DDL, invalid.TableName)), /SqlServerFilterColumn/);
  }
});
test('legacy ALTER ADD UNIQUE INDEX and KEY retain uniqueness on first install and reinstallation', () => {
  for (const keyword of ['INDEX', 'KEY']) for (const sqlServer of [false, true]) {
    const definition = { TableName: 'history', DDL: 'ALTER TABLE `history` ADD UNIQUE ' + keyword + ' `ux_history` (`AppId`,`RequestId`);' };
    let exists = false; const writes = [];
    const rows = ['AppId', 'RequestId'].map((ColumnName, index) => ({ ColumnName, SeqInIndex: index + 1,
      NonUnique: 0, SubPart: null, IndexType: 'BTREE', SortOrder: 'A', IsUnique: 1, IsDisabled: 0, IsHypothetical: 0, IsDescending: 0, IsIncluded: 0, FilterDefinition: null }));
    const scope = context([definition], sql => {
      if (/COUNT/.test(sql)) return [{ ObjectCount: exists ? 1 : 0 }];
      if (/^(CREATE|ALTER)/.test(sql)) { writes.push(sql); exists = true; return []; }
      return rows;
    }, sqlServer);
    const install = () => {
      if (!scope.ddlIndexExists('history', 'ux_history')) scope.executePackageDdl(definition, scope.readDeclarativePackageDdl(definition.DDL, 'history'));
      assert.equal(scope.ddlIndexExists('history', 'ux_history'), true);
    };
    install(); install(); assert.equal(writes.length, 1); assert.match(writes[0], /UNIQUE/);
  }
});
test('official fixed projection reads only catalog and rejects missing/changed source contracts', () => {
  const helper = read('./application-stream-gate-export.js').replace('APPLICATION_STREAM_GATE_AUDIT_COLUMNS', JSON.stringify(auditColumns)).replace('APPLICATION_STREAM_GATE_INDEXES', JSON.stringify(gateIndexes));
  const columns = auditColumns.map(([COLUMN_NAME, COLUMN_TYPE], index) => ({ TABLE_NAME: auditTable, COLUMN_NAME, COLUMN_TYPE, ORDINAL_POSITION: index + 1 }));
  const indexes = gateIndexes.flatMap(index => index.Columns.map((COLUMN_NAME, seq) => ({ TABLE_NAME: index.TableName, INDEX_NAME: index.IndexName, COLUMN_NAME, SEQ_IN_INDEX: seq + 1, NON_UNIQUE: index.Unique ? 0 : 1, INDEX_TYPE: 'BTREE', SUB_PART: null, SORT_ORDER: 'A' })));
  function project(patch = {}) {
    const queries = [], scope = { V8: { OsClient: 'iTdos', CurrentUser: { Level: 9999 }, OsClientModel: { DbType: 'MySql' }, Param: { IncludeApplicationStreamGateContract: true, PersistAppKey: 'app.microi.store' }, Db: { FromSql(sql) { queries.push(sql); return { AddInParameter() { return this; }, ToArray() { return /COLUMNS/.test(sql) ? (patch.columns || columns) : (patch.indexes || indexes); } }; } }, ...patch.v8 } };
    vm.runInNewContext(helper, scope); const model = { PackageInfo: {}, DDLStatements: [], PhysicalColumns: [] };
    scope.appendApplicationStreamGatePhysicalContract(model); return { model, queries };
  }
  const result = project(); assert.equal(result.model.DDLStatements.length, 8); assert.equal(result.model.PhysicalColumns.length, 20);
  assert.ok(result.queries.every(sql => /INFORMATION_SCHEMA/.test(sql)));
  assert.throws(() => project({ columns: columns.slice(1) }), /物理列缺失/);
  assert.throws(() => project({ indexes: indexes.slice(1) }), /索引缺失/);
  for (const v8 of [{ OsClient: 'customer' }, { CurrentUser: { Level: 999 } }, { Param: { IncludeApplicationStreamGateContract: true, PersistAppKey: 'other' } }]) assert.throws(() => project({ v8 }), /仅允许官方/);
});

const requestedContainer = process.env.MICROI_GATE_TEST_MYSQL_CONTAINER;
const autoMysql = process.env.MICROI_GATE_TEST_MYSQL_AUTO === '1';
test('isolated MySQL: empty install, old missing ledger, reinstallation and index/data conflicts', { skip: !requestedContainer && !autoMysql }, async t => {
  let container = requestedContainer;
  const owner = autoMysql ? 'microservice-gate-contract-' + randomUUID() : 'microservice-gate-contract-20261013';
  if (autoMysql) {
    assert.equal(requestedContainer, undefined, '自动模式不能复用调用方的现有容器');
    container = 'microi-gate-contract-' + randomUUID().slice(0, 12);
    const image = process.env.MICROI_GATE_TEST_MYSQL_IMAGE;
    assert.ok(image && /^[A-Za-z0-9./:@_-]+$/.test(image), '自动验收必须显式提供已核验的 MICROI_GATE_TEST_MYSQL_IMAGE');
    const started = spawnSync('docker', ['run', '--name', container, '--label', 'codex.task=' + owner,
      '--network', 'none', '--memory', '512m', '--cpus', '1', '-e', 'MYSQL_ALLOW_EMPTY_PASSWORD=yes', '-d', image,
      '--innodb-buffer-pool-size=64M', '--performance-schema=OFF', '--max-connections=20'], { encoding: 'utf8' });
    assert.equal(started.status, 0, started.stderr);
    t.after(() => {
      const owned = spawnSync('docker', ['inspect', '--format', '{{index .Config.Labels "codex.task"}}', container], { encoding: 'utf8' });
      assert.equal(owned.status, 0); assert.equal(owned.stdout.trim(), owner);
      const removed = spawnSync('docker', ['rm', '-f', '-v', container], { encoding: 'utf8' });
      assert.equal(removed.status, 0, removed.stderr);
    });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      // 初始化临时 mysqld 也会回答 ping；必须确认主进程已 exec 为正式服务。
      const processReady = spawnSync('docker', ['exec', container, 'sh', '-c', 'test "$(cat /proc/1/comm)" = mysqld && mysqladmin ping -uroot'], { encoding: 'utf8' });
      if (processReady.status === 0) { ready = true; break; }
      await delay(500);
    }
    assert.equal(ready, true, '专属 MySQL 在50秒内未达到正式主进程就绪');
    t.diagnostic('专属 MySQL 容器 ' + container + '，上限512MiB/1CPU，无宿主端口；结束后按唯一label清理');
  }
  assert.match(container, /^microi-gate-contract-/);
  const ownership = spawnSync('docker', ['inspect', '--format', '{{index .Config.Labels "codex.task"}}', container], { encoding: 'utf8' });
  assert.equal(ownership.status, 0); assert.equal(ownership.stdout.trim(), owner);
  const db = 'gate_contract';
  function sql(text, withDb = true) {
    const result = spawnSync('docker', ['exec', '-i', container, 'mysql', '-uroot', '-B', ...(withDb ? [db] : [])], { input: text, encoding: 'utf8' });
    if (result.status !== 0) throw Error(result.stderr || result.stdout);
    const lines = result.stdout.trim().split('\n');
    if (!result.stdout.trim()) return [];
    const headers = lines.shift().split('\t');
    return lines.map(line => Object.fromEntries(line.split('\t').map((value, i) => [headers[i], value === 'NULL' ? null : value])));
  }
  const statements = packageModel.DDLStatements.filter(row => [auditTable, 'sys_microistore', 'mci_ai_app_version', 'mci_ai_app_file'].includes(row.TableName));
  const scope = context(statements, (query, args) => sql(query.replace(/@p\d+/g, key => "'" + String(args[key]).replace(/'/g, "''") + "'")));
  const install = () => {
    for (const row of statements) {
      const info = scope.readDeclarativePackageDdl(row.DDL, row.TableName);
      if (info.Kind === 'index' && scope.ddlIndexExists(info.TableName, info.IndexName)) continue;
      scope.executePackageDdl(row, info);
      if (info.Kind === 'index') assert.equal(scope.ddlIndexExists(info.TableName, info.IndexName), true);
    }
  };
  sql('DROP DATABASE IF EXISTS `' + db + '`; CREATE DATABASE `' + db + '`;', false); install(); install();
  assert.equal(sql('SELECT COUNT(*) AS Count FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND INDEX_NAME=\'ux_asgt_transition_id\'')[0].Count, '1');
  sql('DROP TABLE `' + auditTable + '`; INSERT INTO sys_microistore (Id,Name) VALUES (\'existing-app\',\'保留原业务\');');
  install(); assert.equal(sql("SELECT Name FROM sys_microistore WHERE Id='existing-app'")[0].Name, '保留原业务');
  for (const keyword of ['INDEX', 'KEY']) {
    const table = 'history_' + keyword.toLowerCase();
    sql('CREATE TABLE `' + table + '` (Id varchar(50) PRIMARY KEY,AppId varchar(50),RequestId varchar(100));');
    const definition = { TableName: table, DDL: 'ALTER TABLE `' + table + '` ADD UNIQUE ' + keyword + ' `ux_legacy` (`AppId`,`RequestId`);' };
    const legacyScope = context([definition], (query, args) => sql(query.replace(/@p\d+/g, key => "'" + String(args[key]).replace(/'/g, "''") + "'")));
    for (let replay = 0; replay < 2; replay++) {
      if (!legacyScope.ddlIndexExists(table, 'ux_legacy')) legacyScope.executePackageDdl(definition, legacyScope.readDeclarativePackageDdl(definition.DDL, table));
      assert.equal(legacyScope.ddlIndexExists(table, 'ux_legacy'), true);
    }
    sql('INSERT INTO `' + table + '` VALUES (\'row-a\',\'app\',\'request\');');
    assert.throws(() => sql('INSERT INTO `' + table + '` VALUES (\'row-b\',\'app\',\'request\');'), /Duplicate entry/);
  }
  sql('DROP INDEX ix_store_active_fence ON sys_microistore; CREATE INDEX ix_store_active_fence ON sys_microistore (Id);');
  assert.throws(install, /索引定义冲突/);
  assert.equal(sql("SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sys_microistore' AND INDEX_NAME='ix_store_active_fence'")[0].COLUMN_NAME, 'Id');
  sql('DROP INDEX ix_store_active_fence ON sys_microistore; CREATE INDEX ix_store_active_fence ON sys_microistore (ActivePublishVersionId,PublishFence); DROP INDEX ux_aav_app_version ON mci_ai_app_version; INSERT INTO mci_ai_app_version (Id,AppId,VersionNo) VALUES (\'old-a\',\'existing-app\',\'v1.0.0\'),(\'old-b\',\'existing-app\',\'v1.0.0\');');
  assert.throws(install, /Duplicate entry/);
  assert.equal(sql("SELECT COUNT(*) AS Count FROM mci_ai_app_version WHERE AppId='existing-app'")[0].Count, '2');
});
