import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function packageModel(name) {
  return JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'));
}

const saas = packageModel('app.microi.saas-engine.json');
const account = packageModel('app.microi.sys_user.json');
const moduleEngine = packageModel('app.microi.module-engine.json');

function field(model, name) {
  return model.DiyFields.find(item => item.Name === name);
}

function column(model, table, name) {
  return model.PhysicalColumns.find(item => item.TABLE_NAME === table && item.COLUMN_NAME === name);
}

test('new tenant account preference matches the independently upgradable account application', () => {
  const baseField = field(saas, 'CornerStyle');
  const appField = field(account, 'CornerStyle');
  assert.ok(baseField);
  assert.equal(baseField.Id, appField.Id);
  assert.equal(baseField.DefaultValue, 'round');
  assert.deepEqual(JSON.parse(baseField.Data).map(item => item.Key), ['round', 'square']);
  const baseColumn = column(saas, 'sys_user', 'CornerStyle');
  const appColumn = column(account, 'sys_user', 'CornerStyle');
  assert.equal(baseColumn.COLUMN_TYPE, appColumn.COLUMN_TYPE);
  assert.equal(baseColumn.COLUMN_DEFAULT, appColumn.COLUMN_DEFAULT);
  assert.match(saas.DDLStatements.find(item => item.TableName === 'sys_user').DDL, /`CornerStyle` varchar\(25\)/);
});

test('new tenant module Banner columns match the independently upgradable module application', () => {
  for (const name of ['HideTableBanner', 'HideFormBanner']) {
    const baseColumn = column(saas, 'sys_menu', name);
    const appColumn = column(moduleEngine, 'sys_menu', name);
    assert.ok(baseColumn, name);
    assert.equal(baseColumn.COLUMN_TYPE, appColumn.COLUMN_TYPE);
    assert.equal(baseColumn.COLUMN_DEFAULT, '0');
    assert.equal(field(moduleEngine, name).DefaultValue, '0');
  }
});
