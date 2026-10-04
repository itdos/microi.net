import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { configureFeishuUserIdResource, feishuUserIdFieldId, feishuUserIdRelease } from './configure-feishu-user-id-resource.mjs';

for (const name of Object.keys(feishuUserIdRelease)) {
  test(`${name}: identity metadata, physical schema and DDL ship together and stay idempotent`, () => {
    const original = JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
    const pkg = configureFeishuUserIdResource(original, name);
    const field = pkg.DiyFields.find(row => row.Id === feishuUserIdFieldId);
    assert.equal(field.Name, 'FeishuUserId');
    assert.equal(field.Type, 'varchar(100)');
    assert.equal(field.Readonly, 1);
    assert.equal(field.NotEmpty, 0);
    assert.equal(pkg.DiyFields.filter(row => row.Name === 'FeishuUserId' && row.TableId === field.TableId).length, 1);
    assert.ok(pkg.PhysicalColumns.some(row => row.TABLE_NAME === 'sys_user' && row.COLUMN_NAME === field.Name));
    assert.match(pkg.DDLStatements.find(row => row.TableName === 'sys_user').DDL, /`FeishuUserId` varchar\(100\) NULL/);
    assert.deepEqual(configureFeishuUserIdResource(pkg, name), pkg);
    assert.deepEqual(pkg.SysApiEngines, original.SysApiEngines, 'Do not alter authentication engines');
    assert.deepEqual(pkg.DataSets, original.DataSets, 'Do not package or overwrite tenant identity values');
    assert.equal(pkg.PackageInfo.FieldCount, pkg.DiyFields.length);
    assert.equal(pkg.PackageInfo.PhysicalColumnCount, pkg.PhysicalColumns.length);
  });
}
