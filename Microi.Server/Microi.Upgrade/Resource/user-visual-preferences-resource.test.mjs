import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageModel = JSON.parse(await readFile(new URL('./app.microi.saas-engine.json', import.meta.url), 'utf8'));
const versionAtLeast = (actual, minimum) => {
  const left = String(actual || '').replace(/^v/i, '').split('.').map(value => Number.parseInt(value, 10) || 0);
  const right = String(minimum || '').replace(/^v/i, '').split('.').map(value => Number.parseInt(value, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0);
  }
  return true;
};
const table = packageModel.DiyTables.find(item => String(item.Name || '').toLowerCase() === 'sys_user');
const names = ['ThemeColor', 'ThemeMode', 'MenuChildExpandMode'];
const fields = names.map(name => packageModel.DiyFields.find(item => item.TableId === table.Id && item.Name === name));

test('SaaS package delivers per-user visual preferences with safe legacy defaults', () => {
  assert.ok(versionAtLeast(packageModel.PackageInfo.Version, 'v7.5.28'));
  assert.ok(fields.every(Boolean));
  assert.ok(fields.every(field => field.Tab === '01KGFAYTX109WCP98XJZP395VY'));
  assert.equal(fields.find(field => field.Name === 'ThemeColor').DefaultValue, '');
  assert.equal(fields.find(field => field.Name === 'ThemeMode').DefaultValue, 'light');
  assert.equal(fields.find(field => field.Name === 'MenuChildExpandMode').DefaultValue, 'System');
  assert.deepEqual(
    JSON.parse(fields.find(field => field.Name === 'MenuChildExpandMode').Data).map(item => item.Key),
    ['System', 'Down', 'Right'],
  );
});

test('sys_user settings are grouped across account, organization and personal tabs without physical layout columns', () => {
  const groups = [
    'UserBasicProfileGroup',
    'UserAccountSecurityGroup',
    'UserOrganizationGroup',
    'UserExternalIdentityGroup',
    'UserAiUsageGroup',
    'PersonalHomeGroup',
    'PersonalThemeGroup',
    'PersonalDesktopGroup',
  ]
    .map(name => packageModel.DiyFields.find(item => item.TableId === table.Id && item.Name === name));
  assert.ok(groups.every(Boolean));
  for (const group of groups) {
    assert.equal(group.Component, 'CollapseGroup');
    assert.equal(group.Type, '');
    assert.equal(group.FormWidth, 24);
    const config = JSON.parse(group.Config).CollapseGroup;
    assert.equal(config.DefaultCollapsed, true);
    assert.equal(config.ShowFieldCount, true);
    assert.ok(config.Icon);
    assert.ok(group.Description);
  }
  const physical = new Set(packageModel.PhysicalColumns
    .filter(item => String(item.TABLE_NAME || '').toLowerCase() === 'sys_user')
    .map(item => item.COLUMN_NAME));
  for (const name of names) assert.ok(physical.has(name), `missing ${name}`);
  for (const group of groups) assert.equal(physical.has(group.Name), false, `${group.Name} must remain metadata-only`);
});
