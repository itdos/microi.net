import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { configureReadPrimary, readPrimaryFieldId, readPrimaryCapability } from './configure-form-read-primary-resource.mjs';

const pkg = JSON.parse(fs.readFileSync(new URL('./app.microi.form-engine.json', import.meta.url), 'utf8'));
test('ReadPrimary正式声明具有真实nullable列、设计器字段、升级说明与后端能力要求', () => {
  const table = pkg.DiyTables.find(x => x.Name === 'diy_table');
  const fields = pkg.DiyFields.filter(x => x.TableId === table.Id && x.Name === 'ReadPrimary');
  assert.equal(fields.length, 1);
  assert.equal(fields[0].Id, readPrimaryFieldId);
  assert.equal(fields[0].Type, 'int');
  assert.equal(fields[0].Component, 'Switch');
  assert.equal(fields[0].FormWidth, null);
  assert.ok(JSON.parse(table.Tabs).some(x => x.Id === fields[0].Tab));
  const cols = pkg.PhysicalColumns.filter(x => x.TABLE_NAME === 'diy_table' && x.COLUMN_NAME === 'ReadPrimary');
  assert.equal(cols.length, 1); assert.equal(cols[0].IS_NULLABLE, 'YES'); assert.equal(cols[0].COLUMN_DEFAULT, null);
  assert.match(pkg.DDLStatements.find(x => x.TableName === 'diy_table').DDL, /`ReadPrimary` int NULL/);
  assert.ok(pkg.PackageInfo.RequiredPlatformCapabilities.includes(readPrimaryCapability));
  assert.equal(pkg.PackageInfo.Version, pkg.PackageInfo.ChangeLog.Version);
  assert.match(pkg.PackageInfo.ChangeLog.Content, /显式事务|后端/);
});
test('ReadPrimary生成器幂等且保留其它字段、旧日志、数据与资源所有权', () => {
  const once = configureReadPrimary(pkg), twice = configureReadPrimary(once);
  assert.deepEqual(once, twice);
  assert.deepEqual(once.DiyFields.filter(x => x.Name !== 'ReadPrimary'), pkg.DiyFields.filter(x => x.Name !== 'ReadPrimary'));
  assert.deepEqual(once.DiyTables, pkg.DiyTables);
  assert.deepEqual(once.DataSets, pkg.DataSets);
  assert.deepEqual(once.ResourcePolicies, pkg.ResourcePolicies);
  assert.ok(once.PackageInfo.ChangeHistory.includes('v7.7.3'));
});
test('ReadPrimary生成器拒绝未知版本和字段Id占用', () => {
  assert.throws(() => configureReadPrimary({ ...pkg, PackageInfo: { ...pkg.PackageInfo, Version: 'v9.0.0' } }), /候选/);
  const conflict = structuredClone(pkg); conflict.DiyFields.push({ Id: readPrimaryFieldId, Name: 'Other' });
  conflict.DiyFields = conflict.DiyFields.filter(x => x.Name !== 'ReadPrimary');
  assert.throws(() => configureReadPrimary(conflict), /占用/);
});
