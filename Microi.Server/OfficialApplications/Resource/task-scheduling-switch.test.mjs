import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateOfficialPackageChangeLog, validateOfficialPackageInstallContracts } from './resource-sync-core.mjs';
const names = ['app.microi.sys-config.json', 'app.microi.saas-engine.json'];
const packages = names.map(name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8')));
for (const [index, pkg] of packages.entries()) {
  test(`${names[index]} ships the default-off scheduling gate without overwriting tenant values`, () => {
    const table = pkg.DiyTables.find(x => x.Name.toLowerCase() === 'sys_config');
    const fields = pkg.DiyFields.filter(x => x.TableId === table.Id && x.Name === 'DisableTaskScheduling');
    assert.equal(fields.length, 1);
    assert.equal(fields[0].Id, '01M1ZTZ06F43BC6SKB4AARZ2FP');
    assert.equal(fields[0].DefaultValue, '0');
    assert.equal(fields[0].Component, 'Switch');
    assert.equal(fields[0].Visible, 1);
    assert.equal(fields[0].AppVisible, 1);
    assert.ok(JSON.parse(table.Tabs).some(x => x.Id === fields[0].Tab));
    assert.equal(pkg.PhysicalColumns.filter(x => x.TABLE_NAME.toLowerCase() === 'sys_config' && x.COLUMN_NAME === fields[0].Name).length, 1);
    assert.ok(pkg.DDLStatements.some(x => x.TableName.toLowerCase() === 'sys_config' && x.DDL.includes('`DisableTaskScheduling`')));
    for (const data of pkg.DataSets || [])
      if ((data.TableName || '').toLowerCase() === 'sys_config')
        assert.ok((data.Rows || []).every(row => !Object.hasOwn(row, 'DisableTaskScheduling')), '应用更新不得重置租户开关');
    const content = JSON.stringify(pkg);
    assert.doesNotThrow(() => validateOfficialPackageChangeLog(names[index], content));
    assert.doesNotThrow(() => validateOfficialPackageInstallContracts(names[index], content));
  });
}
test('standalone settings and SaaS bootstrap share the exact field contract', () => {
  assert.deepEqual(...packages.map(p => p.DiyFields.find(x => x.Name === 'DisableTaskScheduling')));
});
