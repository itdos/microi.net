import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(directory, 'platform-home-overview.js'), 'utf8')
  .replaceAll('\r\n', '\n');
const execute = new Function('V8', 'DateAdd', 'DateNow', source);
const menus = [
  { Id: 'menu-a', Name: '客户管理', Url: '/customer', Icon: '', IconClass: 'i-customer', Description: '', Sort: 10, Display: 1, IsDeleted: 0 },
  { Id: 'menu-b', Name: '订单管理', Url: '/orders', Icon: '', IconClass: 'i-order', Description: '', Sort: 20, Display: 1, IsDeleted: 0 },
  { Id: 'menu-secret', Name: '机密设置', Url: '/secret', Icon: '', IconClass: '', Description: '', Sort: 30, Display: 1, IsDeleted: 0 },
  { Id: 'menu-folder', Name: '目录', Url: '', Icon: '', IconClass: '', Description: '', Sort: 1, Display: 1, IsDeleted: 0 },
];

function makeDate(offset) {
  const date = new Date(Date.UTC(2026, 8, 3));
  date.setUTCDate(date.getUTCDate() + Number(offset || 0));
  return date.toISOString().slice(0, 10);
}

function run(param, state, currentUser = {
  Id: 'user-1',
  Level: 100,
  _RoleLimits: [{ Type: 'Menu', FkId: 'menu-a' }, { Type: 'Menu', FkId: 'menu-b' }],
}) {
  let update = null;
  const V8 = {
    Param: param,
    CurrentUser: currentUser,
    FormEngine: {
      GetTableData(table) {
        assert.equal(table, 'sys_menu');
        return { Code: 1, Data: menus };
      },
      GetFormData(table, query) {
        if (table === 'sys_menu') {
          const menu = menus.find(item => item.Id === query.Id);
          return menu ? { Code: 1, Data: menu } : { Code: 2 };
        }
        assert.equal(table, 'sys_user');
        assert.equal(query.Id, currentUser.Id);
        return { Code: 1, Data: { Id: currentUser.Id, HomeUsageStats: state.HomeUsageStats || '' } };
      },
      UptFormData(table, model) {
        assert.equal(table, 'sys_user');
        assert.equal(model.Id, currentUser.Id);
        assert.deepEqual(Object.keys(model).sort(), ['HomeUsageStats', 'Id']);
        update = model;
        state.HomeUsageStats = model.HomeUsageStats;
        return { Code: 1 };
      },
    },
  };
  const result = execute(V8, (_date, _unit, offset) => makeDate(offset), () => '2026-09-03 18:00:00');
  return { result, update };
}

test('system-account package owns the Managed overview engine and hidden aggregate field', () => {
  const packageModel = JSON.parse(fs.readFileSync(path.join(directory, 'app.microi.sys_user.json'), 'utf8'));
  const engines = packageModel.SysApiEngines.filter(item => item.ApiEngineKey === 'platform-home-overview');
  assert.equal(engines.length, 1);
  assert.equal(engines[0].Version, 'v1.0.0');
  assert.equal(engines[0].ApiV8Code.replaceAll('\r\n', '\n'), `${source.trimEnd()}\n`);
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines['platform-home-overview'], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
  const fields = packageModel.DiyFields.filter(item => (
    String(item.TableName).toLowerCase() === 'sys_user'
      && String(item.Name).toLowerCase() === 'homeusagestats'
  ));
  assert.equal(fields.length, 1);
  assert.equal(fields[0].Visible, 0);
  assert.equal(fields[0].AppVisible, 0);
  assert.equal(fields[0].Readonly, 1);
  assert.equal(fields[0].Type, 'mediumtext');
});

test('recording rejects unauthorized menus and writes only the token user aggregate', () => {
  const state = {};
  const rejected = run({ Action: 'RecordMenuOpen', MenuId: 'menu-secret' }, state);
  assert.equal(rejected.result.Code, 0);
  assert.equal(rejected.update, null);

  const accepted = run({ Action: 'RecordMenuOpen', MenuId: 'menu-a', Id: 'attacker' }, state);
  assert.equal(accepted.result.Code, 1);
  assert.equal(accepted.update.Id, 'user-1');
  const stored = JSON.parse(state.HomeUsageStats);
  assert.equal(stored.Menus['menu-a'].Count, 1);
  assert.equal(stored.Menus['menu-a'].Daily['2026-09-03'], 1);
  assert.doesNotMatch(state.HomeUsageStats, /customer|attacker|secret/);
});

test('dashboard ranks actual use and filters removed permissions from metrics and results', () => {
  const state = {};
  run({ Action: 'RecordMenuOpen', MenuId: 'menu-a' }, state);
  run({ Action: 'RecordMenuOpen', MenuId: 'menu-a' }, state);
  run({ Action: 'RecordMenuOpen', MenuId: 'menu-b' }, state);

  const { result } = run({ Action: 'Dashboard' }, state);
  assert.equal(result.Code, 1);
  assert.equal(result.Data.TodayOpenCount, 3);
  assert.equal(result.Data.WeekOpenCount, 3);
  assert.equal(result.Data.UsedAppCount, 2);
  assert.equal(result.Data.AccessibleAppCount, 2);
  assert.equal(result.Data.AiToolCount, 29);
  assert.equal(result.Data.FrequentApps[0].Id, 'menu-a');
  assert.equal(result.Data.FrequentApps[0].OpenCount, 2);
  assert.ok(result.Data.FrequentApps.every(item => item.Id !== 'menu-secret'));
  assert.equal(result.Data.Dates.length, 7);
  assert.equal(result.Data.Counts.length, 7);
});
