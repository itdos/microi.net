import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ensurePlatformServiceRuntimeFields, platformServiceRuntimeFields } from './platform-service-runtime-fields.mjs';

for (const name of ['saas-engine', 'store']) {
  test(`${name}: 真实包交付微服务投影字段和可空列，重复生成无漂移`, async () => {
    const model = JSON.parse(await readFile(new URL(`app.microi.${name}.json`, import.meta.url), 'utf8'));
    const before = JSON.stringify(model);
    ensurePlatformServiceRuntimeFields(model);
    assert.equal(JSON.stringify(model), before);
    for (const definition of platformServiceRuntimeFields) {
      const table = model.DiyTables.find(item => item.Name === definition.TableName);
      const fields = model.DiyFields.filter(item => item.Name === definition.Name && item.TableId === table.Id);
      assert.equal(fields.length, 1);
      assert.equal(fields[0].FormWidth, definition.FormWidth);
      assert.equal(fields[0].NotEmpty, 0);
    }
  });
}
test('按稳定表名与字段名合并，保留已有布局、包内表身份及其它字段', () => {
  const tables = platformServiceRuntimeFields.map((field, i) => ({ Name: field.TableName, Id: `table-${i}` }));
  const model = { PackageInfo: {}, DiyTables: tables.reverse(), DiyFields: [{ TableId: 'table-0', Name: 'Description', Id: 'existing', FormWidth: 12 }],
    PhysicalColumns: [], DDLStatements: platformServiceRuntimeFields.map(field => ({ TableName: field.TableName, DDL: `CREATE TABLE x (\`${field.Name}\` ${field.Type} NULL)` })) };
  ensurePlatformServiceRuntimeFields(model);
  assert.equal(model.DiyFields.find(field => field.Id === 'existing').FormWidth, 12);
  assert.equal(model.DiyFields.find(field => field.Name === 'PageName').TableId, 'table-1');
  const once = JSON.stringify(model);
  ensurePlatformServiceRuntimeFields(model);
  assert.equal(JSON.stringify(model), once);
  assert.ok(model.PhysicalColumns.every(column => column.IS_NULLABLE === 'YES'));
});
