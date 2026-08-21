import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const resourcePath = new URL('./app.microi.form-engine.json', import.meta.url);

test('form-engine package publishes positive diy_table V8Limit and hides the legacy switch', async () => {
  const resource = JSON.parse(await readFile(resourcePath, 'utf8'));
  const table = resource.DiyTables.find(item => String(item.Name).toLowerCase() === 'diy_table');
  assert.ok(table, 'diy_table resource is missing');

  const field = resource.DiyFields.find(item => item.TableId === table.Id && item.Name === 'V8Limit');
  assert.ok(field, 'diy_table.V8Limit metadata is missing');
  assert.equal(field.Label, 'V8运行限制');
  assert.equal(field.Component, 'Switch');
  assert.equal(field.DefaultValue, '0');
  assert.equal(field.Visible, 1);
  assert.equal(field.AppVisible, 1);

  const legacy = resource.DiyFields.find(
    item => item.TableId === table.Id && item.Name === 'V8Unlimited',
  );
  assert.ok(legacy, 'legacy diy_table.V8Unlimited compatibility metadata is missing');
  assert.equal(legacy.Visible, 0);
  assert.equal(legacy.AppVisible, 0);
  assert.equal(legacy.IsDeleted, 1);

  const physical = resource.PhysicalColumns.find(
    item => String(item.TABLE_NAME).toLowerCase() === 'diy_table' && item.COLUMN_NAME === 'V8Limit',
  );
  assert.ok(physical, 'diy_table.V8Limit physical-column snapshot is missing');
  assert.equal(physical.DATA_TYPE, 'int');

  const ddl = resource.DDLStatements.find(
    item => String(item.TableName).toLowerCase() === 'diy_table',
  );
  assert.match(String(ddl?.DDL || ''), /`V8Limit` int NULL COMMENT 'V8运行限制'/);
});
