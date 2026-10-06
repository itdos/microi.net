import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(resourceDir, name), 'utf8'));
}

test('module package owns OpenFirstRecord as a physical sys_menu switch', () => {
  const packageData = read('app.microi.module-engine.json');
  const table = packageData.DiyTables.find((item) => String(item.Name).toLowerCase() === 'sys_menu');
  const field = packageData.DiyFields.find((item) =>
    item.TableId === table.Id && item.Name === 'OpenFirstRecord');
  const column = packageData.PhysicalColumns.find((item) =>
    item.TABLE_NAME === 'sys_menu' && item.COLUMN_NAME === 'OpenFirstRecord');
  const ddl = packageData.DDLStatements.find((item) => item.TableName === 'sys_menu');

  assert.equal(field.Component, 'Switch');
  assert.equal(field.DefaultValue, '0');
  assert.equal(column.COLUMN_DEFAULT, '0');
  assert.match(ddl.DDL, /`OpenFirstRecord` int NULL DEFAULT 0/);
  assert.match(
    ddl.DDL,
    /`ParentIds`\s+mediumtext\s+NULL\s*,\s*`OpenFirstRecord`\s+int/i,
    'OpenFirstRecord must be comma-separated from the preceding sys_menu column',
  );
  assert.doesNotMatch(ddl.DDL, /,\s*\) ENGINE=/i);
  assert.ok(packageData.PackageInfo.RequiredPlatformCapabilities.includes(
    'ServerField:SysMenu.OpenFirstRecord'));
});

test('SaaS system-config enables the menu-owned switch and removes JSON ownership', () => {
  const packageData = read('app.microi.saas-engine.json');
  const menu = packageData.SysMenus.find((item) =>
    item.Id === 'ea6b79e8-2c6b-4d0f-9b6a-44d01a3479bf');
  const table = packageData.DiyTables.find((item) =>
    String(item.Name).toLowerCase() === 'sys_config');
  const presentation = JSON.parse(table.FormPresentation);

  assert.equal(menu.OpenFirstRecord, 1);
  assert.equal(Object.hasOwn(presentation, 'OpenFirstRecord'), false);
  assert.equal(table.FormPresentationMode, 'ControlCenter');
  assert.equal(table.FormNavigationTitle, '配置分组');
  assert.deepEqual(JSON.parse(table.FormRecordSelectorLabelFields), [
    'PeizhiMC', 'SysTitle', 'ApiBase',
  ]);
});
