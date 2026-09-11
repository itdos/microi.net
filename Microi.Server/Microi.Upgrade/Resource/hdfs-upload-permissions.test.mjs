import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { configureHdfsUploadPermissions, hdfsUploadRuleFieldId, hdfsUploadRuleVersions } from './configure-hdfs-upload-permissions-resource.mjs';
import { validateOfficialPackageChangeLog, validateOfficialPackageInstallContracts } from './resource-sync-core.mjs';

const packages = Object.keys(hdfsUploadRuleVersions).map(name => ({name, pkg: JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'))}));
for (const { name, pkg } of packages) {
  test(`${name} 发布普通上传配置且不覆盖租户数据`, () => {
    const table = pkg.DiyTables.find(row => row.Name.toLowerCase() === 'sys_config');
    const fields = pkg.DiyFields.filter(row => row.TableId === table.Id && row.Name === 'HdfsUploadRules');
    assert.equal(fields.length, 1);
    const field = fields[0];
    assert.equal(field.Id, hdfsUploadRuleFieldId);
    assert.equal(field.Encrypt, 0);
    assert.equal(field.DefaultValue, '[]');
    assert.equal(field.Component, 'JsonTable');
    assert.equal(field.FormWidth, 24);
    assert.equal(field.Visible, 1);
    assert.ok(JSON.parse(table.Tabs).some(tab => tab.Id === field.Tab));
    assert.equal(JSON.parse(field.Config).JsonTable.Columns.length, 5);
    assert.equal(JSON.parse(field.Config).JsonTable.Columns[0].Placeholder, 'files/{inspection,quality}/**');
    for (const syntax of ['*', '**', '?', '[a-z]', '[!0-9]', '{目录A,目录B}', 'v8.2.9']) assert.ok(field.Description.includes(syntax));
    const column = pkg.PhysicalColumns.filter(row => row.TABLE_NAME.toLowerCase() === 'sys_config' && row.COLUMN_NAME === field.Name);
    assert.equal(column.length, 1);
    assert.equal(column[0].IS_NULLABLE, 'YES');
    assert.ok(pkg.DDLStatements.some(row => row.TableName.toLowerCase() === 'sys_config' && row.DDL.includes('`HdfsUploadRules` mediumtext NULL')));
    for (const data of pkg.DataSets || []) if (data.TableName.toLowerCase() === 'sys_config')
      assert.ok((data.Rows || []).every(row => !Object.hasOwn(row, field.Name)));
    assert.doesNotThrow(() => validateOfficialPackageChangeLog(name, JSON.stringify(pkg)));
    assert.doesNotThrow(() => validateOfficialPackageInstallContracts(name, JSON.stringify(pkg)));
    assert.deepEqual(configureHdfsUploadPermissions(pkg, name), pkg, '候选包生成必须幂等');
  });
}
test('系统设置与基础包共享相同上传字段契约', () => {
  assert.deepEqual(...packages.map(({pkg}) => pkg.DiyFields.find(row => row.Id === hdfsUploadRuleFieldId)));
});

test('上传字段生成器不覆盖后续已发布版本及更新日志', () => {
  for (const {name, pkg} of packages) {
    const candidate = structuredClone(pkg);
    candidate.PackageInfo.Version = 'v99.0.0';
    candidate.PackageInfo.ChangeLog = {Version:'v99.0.0',Title:'后续修复',Content:'后续修复内容'};
    const release = structuredClone(candidate.PackageInfo);
    const result = configureHdfsUploadPermissions(candidate, name);
    assert.deepEqual(result.PackageInfo, release);
  }
});
