import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageModel = JSON.parse(await readFile(new URL('./app.microi.saas-engine.json', import.meta.url), 'utf8'));
const sysConfigTable = packageModel.DiyTables.find(item => String(item.Name).toLowerCase() === 'sys_config');
const fieldNames = [
  'FrameworkWatermarkEnabled',
  'FrameworkWatermarkContent',
  'FrameworkWatermarkDirection',
  'FrameworkWatermarkOpacity',
  'FrameworkWatermarkDensity',
  'FrameworkWatermarkFontSize',
];
const fields = packageModel.DiyFields.filter(item => item.TableId === sysConfigTable.Id && fieldNames.includes(item.Name));

test('SaaS package delivers all framework watermark fields in interface style', () => {
  assert.equal(packageModel.PackageInfo.Version, 'v7.5.28');
  assert.equal(fields.length, fieldNames.length);
  assert.deepEqual(new Set(fields.map(item => item.Name)), new Set(fieldNames));
  for (const field of fields) {
    assert.equal(field.Visible, 1);
    assert.equal(field.AppVisible, 1);
    assert.equal(field.IsLockField, 1);
    assert.equal(field.Tab, 'f7e10da1-0b96-4624-90ea-07c7e6991b74');
  }
  assert.equal(packageModel.DiyFields.some(item => item.TableId === sysConfigTable.Id && item.Name === 'RenderSourceBadgeMode'), false);
  assert.equal(fields.find(item => item.Name === 'FrameworkWatermarkEnabled').DefaultValue, '0');
  assert.equal(fields.find(item => item.Name === 'FrameworkWatermarkContent').DefaultValue, '$SysTitle$ - $UserName$');
  assert.equal(fields.find(item => item.Name === 'FrameworkWatermarkOpacity').DefaultValue, '30');
  assert.equal(fields.find(item => item.Name === 'FrameworkWatermarkFontSize').DefaultValue, '14');
  const groups = ['InterfaceThemeNavigationGroup', 'InterfaceLoginExperienceGroup', 'FrameworkPresentationGroup']
    .map(name => packageModel.DiyFields.find(item => item.TableId === sysConfigTable.Id && item.Name === name));
  assert.ok(groups.every(Boolean));
  for (const group of groups) {
    assert.equal(group.Component, 'CollapseGroup');
    assert.equal(group.FormWidth, 24);
    const groupConfig = JSON.parse(group.Config).CollapseGroup;
    assert.equal(groupConfig.DefaultCollapsed, true);
    assert.equal(groupConfig.ShowFieldCount, true);
    assert.ok(groupConfig.Icon);
    assert.ok(group.Description);
  }
});

test('presentation fields have physical columns and empty-database DDL', () => {
  const physicalNames = new Set(packageModel.PhysicalColumns
    .filter(item => String(item.TABLE_NAME).toLowerCase() === 'sys_config')
    .map(item => item.COLUMN_NAME));
  const ddl = packageModel.DDLStatements.find(item => String(item.TableName).toLowerCase() === 'sys_config').DDL;
  for (const name of fieldNames) {
    assert.ok(physicalNames.has(name), `missing physical column ${name}`);
    assert.match(ddl, new RegExp('`' + name + '`'));
  }
  assert.equal(physicalNames.has('RenderSourceBadgeMode'), false);
  assert.doesNotMatch(ddl, /`RenderSourceBadgeMode`/u);
  assert.equal(packageModel.PackageInfo.FieldCount, packageModel.DiyFields.length);
  assert.equal(packageModel.PackageInfo.PhysicalColumnCount, packageModel.PhysicalColumns.length);
});

test('choice fields save stable keys while displaying readable labels', () => {
  for (const name of ['FrameworkWatermarkDirection', 'FrameworkWatermarkDensity']) {
    const field = fields.find(item => item.Name === name);
    const config = JSON.parse(field.Config);
    const data = JSON.parse(field.Data);
    assert.equal(config.DataSource, 'KeyValue');
    assert.equal(config.SelectLabel, 'Value');
    assert.equal(config.SelectSaveField, 'Key');
    assert.ok(data.every(item => item.Key && item.Value));
  }
});
