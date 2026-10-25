import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import manifest, { policyFields } from '../PlatformService/file-resource-manifest.mjs';
import { configureFileResourceCandidate, fileResourceCandidateNames } from './configure-file-resource-candidate.mjs';
import { alignMasterCatalogMetadata, masterCatalogMetadata, baseFieldNames } from '../PlatformService/sync-file-resource-master-metadata.mjs';
const load = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));

test('canonical monitoring source retains the complete catalog through the standard runtime generator', () => {
  const source = load('system-observability-package-source.json');
  const pkg = load('app.microi.sys-log.json');
  const names = new Set(['mci_file_resource', 'mci_file_traffic_window', 'mci_file_replica']);
  const tables = pkg.DiyTables.filter(row => names.has(row.Name));
  const ids = new Set(tables.map(row => row.Id));
  const selections = {
    DiyTables: [row => names.has(row.Name), 3],
    DiyFields: [row => ids.has(row.TableId), 67],
    PhysicalColumns: [row => names.has(row.TABLE_NAME), 67],
    DDLStatements: [row => names.has(row.TableName), 8],
    SysApiEngines: [row => row.ApiEngineKey === 'mci-file-resource-manager', 1],
  };
  for (const [key, [select, count]] of Object.entries(selections)) {
    const expected = pkg[key].filter(select);
    assert.equal(expected.length, count, key);
    assert.deepEqual(source[key].filter(select), expected, key);
  }
  assert.deepEqual(source.ResourcePolicies.ApiEngines['mci-file-resource-manager'],
    pkg.ResourcePolicies.ApiEngines['mci-file-resource-manager']);
  execFileSync(process.execPath, [new URL('./configure-system-observability-package.mjs', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, '$1:'), '--verify-only'],
    { windowsHide: true, stdio: 'pipe' });
});

test('complete master export supplies all 18 base field metadata and the one exact manager without touching shared resources', () => {
  const pkg = load('app.microi.sys-log.json');
  const expected = masterCatalogMetadata.DiyFields.filter(row => baseFieldNames.includes(row.Name));
  assert.equal(expected.length, 18);
  for (const field of expected) assert.deepEqual(pkg.DiyFields.filter(row => row.TableId === field.TableId && row.Name === field.Name), [field]);
  assert.deepEqual(pkg.SysApiEngines.find(row => row.ApiEngineKey === 'mci-file-resource-manager'), masterCatalogMetadata.SysApiEngines[0]);
  const before = structuredClone(pkg);
  before.DiyFields = before.DiyFields.filter(row => !expected.some(base => base.Id === row.Id));
  before.PackageInfo.FieldCount = before.DiyFields.length;
  assert.deepEqual(alignMasterCatalogMetadata(before), pkg);
  assert.deepEqual(alignMasterCatalogMetadata(pkg), pkg);
  for (const name of ['app.microi.sys-config.json', 'app.microi.saas-engine.json']) {
    const shared = load(name);
    assert(!shared.DiyTables.some(row => masterCatalogMetadata.DiyTables.some(owned => owned.Id === row.Id)));
  }
});

test('candidate projection is idempotent and preserves tenant values, runtime bundle, jobs and release versions', () => {
  for (const name of fileResourceCandidateNames) {
    const before = load(name), after = configureFileResourceCandidate(before, name);
    assert.deepEqual(configureFileResourceCandidate(after, name), after);
    for (const key of ['DataSets', 'ScheduleJobs', 'ApplicationBundles', 'SysMenus']) assert.deepEqual(after[key], before[key], name + ':' + key);
    for (const key of ['Version', 'ChangeLog', 'ChangeLogs', 'ChangeHistory', 'CreateTime']) assert.deepEqual(after.PackageInfo[key], before.PackageInfo[key], name + ':' + key);
    const originalIds = new Map(before.DiyFields.map(x => [x.TableId + '/' + x.Name, x.Id]));
    for (const row of after.DiyFields) if (originalIds.has(row.TableId + '/' + row.Name)) assert.equal(row.Id, originalIds.get(row.TableId + '/' + row.Name));
  }
});

test('only system-log owns the new Managed engine; no paid collector, copy job or new application is seeded', () => {
  assert.deepEqual(manifest.scheduleJobs, []); assert.deepEqual(manifest.modules, []); assert.deepEqual(manifest.dataSets, []);
  for (const name of fileResourceCandidateNames) {
    const p = configureFileResourceCandidate(load(name), name), engines = p.SysApiEngines.filter(x => x.ApiEngineKey === 'mci-file-resource-manager');
    assert.equal(engines.length, name === 'app.microi.sys-log.json' ? 1 : 0);
    if (engines.length) {
      assert.equal(engines[0].AllowAnonymous, 0); assert.equal(engines[0].EnableLog, 0);
      assert.equal(p.ResourcePolicies.ApiEngines['mci-file-resource-manager'].UpgradePolicy, 'Managed');
      assert.equal(engines[0].ApiV8Code, fs.readFileSync(new URL('../PlatformService/engines/mci-file-resource-manager.js', import.meta.url), 'utf8'));
    }
  }
});

test('catalogue, traffic and replica tables have stable fields, physical columns and uniqueness DDL', () => {
  const p = configureFileResourceCandidate(load('app.microi.sys-log.json'), 'app.microi.sys-log.json');
  for (const definition of manifest.tables) {
    const table = p.DiyTables.find(x => x.Name === definition.name); assert(table); assert.equal(table.ReadPrimary, 1);
    const create = p.DDLStatements.find(x => x.TableName === definition.name && /^CREATE TABLE/.test(x.DDL)); assert(create);
    for (const field of definition.fields) {
      const metadata = p.DiyFields.find(x => x.TableId === table.Id && x.Name === field.name);
      assert(metadata); assert.equal(metadata.Readonly, 1); assert.equal(metadata.FormWidth, undefined);
      assert(p.PhysicalColumns.some(x => x.TABLE_NAME === definition.name && x.COLUMN_NAME === field.name)); assert(create.DDL.includes('`' + field.name + '`'));
    }
    for (const index of definition.indexes) assert(p.DDLStatements.some(x => x.TableName === definition.name && x.DDL.includes('INDEX `' + index.name + '`')));
  }
  for (const [table, column] of [['mci_file_traffic_window', 'Bytes'], ['mci_file_traffic_window', 'Requests'], ['mci_file_replica', 'VerifiedSize']]) {
    const c = p.PhysicalColumns.find(x => x.TABLE_NAME === table && x.COLUMN_NAME === column); assert.equal(c.COLUMN_DEFAULT, null); assert.equal(c.IS_NULLABLE, 'YES');
  }
});

test('manager timeout matches the independently read master and leaves other engines unchanged', () => {
  const name = 'app.microi.sys-log.json', before = load(name);
  const master = JSON.parse(fs.readFileSync(new URL('../PlatformService/file-resource-install/official-master-catalog-identities-20261025.json', import.meta.url), 'utf8'));
  const after = configureFileResourceCandidate(before, name);
  const owned = row => row.ApiEngineKey === 'mci-file-resource-manager';
  assert.equal(before.SysApiEngines.find(owned).Timeout, master.engine.Timeout);
  assert.equal(after.SysApiEngines.find(owned).Timeout, master.engine.Timeout);
  assert.deepEqual(after.SysApiEngines.filter(row => !owned(row)), before.SysApiEngines.filter(row => !owned(row)));
});

test('system settings expose GiB and 24h defaults without seeding this user threshold into other tenants', () => {
  assert.deepEqual(policyFields.map(x => x.name), ['FileServerBakThresholdGiB', 'FileServerBakWindowHours']);
  assert(policyFields.every(x => x.name.length <= 30), 'respect the live form-engine field-name length limit');
  const ids = [];
  for (const name of ['app.microi.sys-config.json', 'app.microi.saas-engine.json']) {
    const before = load(name), p = configureFileResourceCandidate(before, name), table = p.DiyTables.find(x => x.Name.toLowerCase() === 'sys_config');
    assert.deepEqual(p.DiyFields.find(x => x.TableId === table.Id && x.Name === 'FileServerBak'), before.DiyFields.find(x => x.TableId === table.Id && x.Name === 'FileServerBak'));
    const fields = policyFields.map(f => p.DiyFields.find(x => x.TableId === table.Id && x.Name === f.name));
    assert.equal(fields[0].DefaultValue, ''); assert.equal(fields[1].DefaultValue, '24'); ids.push(fields.map(x => x.Id));
    assert(fields.every(x => x.Visible === 1 && x.AppVisible === 1 && x.Readonly === 0));
    for (const field of fields) assert(p.DDLStatements.find(x => x.TableName.toLowerCase() === 'sys_config' && /^CREATE TABLE/.test(x.DDL)).DDL.includes('`' + field.Name + '`'));
    assert.deepEqual(p.DataSets, before.DataSets);
  }
  assert.deepEqual(ids[0], ids[1]);
});

test('known system-setting separator repairs change only the two malformed comma positions', () => {
  for (const name of ['app.microi.sys-config.json', 'app.microi.saas-engine.json']) {
    const expected = load(name), malformed = structuredClone(expected);
    const create = malformed.DDLStatements.find(x => x.TableName.toLowerCase() === 'sys_config' && /^CREATE TABLE/.test(x.DDL));
    create.DDL = create.DDL
      .replace("`DisableTaskScheduling` int NULL COMMENT '停用任务调度',\n", "`DisableTaskScheduling` int NULL COMMENT '停用任务调度'\n")
      .replace("`CompatiblePlatformOldVersion` int NULL COMMENT '兼容平台旧版本',", "`CompatiblePlatformOldVersion` int NULL COMMENT '兼容平台旧版本',,");
    assert.notDeepEqual(malformed, expected);
    assert.deepEqual(configureFileResourceCandidate(malformed, name), expected);
  }
});
