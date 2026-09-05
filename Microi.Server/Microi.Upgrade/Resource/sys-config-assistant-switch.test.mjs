import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateOfficialPackageChangeLog, validateOfficialPackageInstallContracts } from './resource-sync-core.mjs';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

for (const name of ['app.microi.sys-config.json', 'app.microi.saas-engine.json']) {
  test(`${name} never recreates the retired positive AI switch`, () => {
    const content = read(name);
    const pkg = JSON.parse(content);
    const table = pkg.DiyTables.find(item => item.Name.toLowerCase() === 'sys_config');
    assert.ok(table);
    const fields = pkg.DiyFields.filter(item => item.TableId === table.Id);
    assert.equal(fields.filter(item => item.Name === 'IsShowAiAssistant').length, 0);
    const active = fields.filter(item => item.Name === 'DisableAiAssistant');
    assert.equal(active.length, 1);
    assert.equal(active[0].Component, 'Switch');
    assert.equal(active[0].Visible, 1);
    assert.equal(active[0].AppVisible, 1);
    assert.equal(String(active[0].DefaultValue), '0');
    assert.equal(pkg.PhysicalColumns.filter(item => item.TABLE_NAME.toLowerCase() === 'sys_config'
      && item.COLUMN_NAME === 'IsShowAiAssistant').length, 0);
    const ddl = pkg.DDLStatements.find(item => item.TableName.toLowerCase() === 'sys_config');
    assert.ok(ddl);
    assert.doesNotMatch(ddl.DDL, /`IsShowAiAssistant`/);
    assert.match(ddl.DDL, /`DisableAiAssistant`/);
    assert.equal(pkg.PackageInfo.FieldCount, pkg.DiyFields.length);
    assert.equal(pkg.PackageInfo.PhysicalColumnCount, pkg.PhysicalColumns.length);
    assert.doesNotThrow(() => validateOfficialPackageChangeLog(name, content));
    assert.doesNotThrow(() => validateOfficialPackageInstallContracts(name, content));
  });
}

test('system settings keeps the current field identity and seven presentation fields', () => {
  const pkg = JSON.parse(read('app.microi.sys-config.json'));
  const active = pkg.DiyFields.find(item => item.Name === 'DisableAiAssistant');
  assert.equal(active.Id, '01M08MN4C4ZF6P6YZK0MWXARNF');
  const group = pkg.DiyFields.find(item => item.Name === 'FrameworkPresentationGroup');
  assert.equal(JSON.parse(group.Config).CollapseGroup.FieldCount, 7);
  assert.equal((pkg.DataSets || []).filter(item => item.TableName.toLowerCase() === 'sys_config').length, 0);
  assert.match(pkg.PackageInfo.ChangeHistory, /v6\.3\.12/);
  assert.match(pkg.PackageInfo.ChangeHistory, /v6\.3\.13/);
});

test('framework generator excludes the old field instead of restoring its layout slot', () => {
  const source = read('configure-framework-presentation-resource.mjs');
  assert.match(source, /OBSOLETE_FIELD_NAMES = new Set\(\[[^\]]*'IsShowAiAssistant'/);
  assert.doesNotMatch(source, /\['IsShowAiAssistant',\s*\d+\]/);
  assert.match(source, /scopeMode: 'FieldCount', fieldCount: 7/);
});
