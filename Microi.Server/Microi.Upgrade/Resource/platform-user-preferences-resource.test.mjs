import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const engineKey = 'platform-user-update-preferences';
const source = fs.readFileSync(path.join(resourceDir, `${engineKey}.js`), 'utf8').replaceAll('\r\n', '\n');
const execute = new Function('V8', source);

function run(param = {}, currentUser = { Id: 'user-1', Account: 'admin', Name: '管理员', DesktopBg: '' }) {
  let updateModel = null;
  const hooks = [];
  const V8 = {
    Param: param,
    CurrentUser: currentUser,
    OsClient: 'junchi',
    ApiEngine: {
      Run(key, payload) {
        hooks.push({ key, payload });
        return { Code: 1 };
      },
    },
    FormEngine: {
      UptFormData(table, model) {
        assert.equal(table, 'sys_user');
        updateModel = model;
        return { Code: 1 };
      },
    },
    Method: {
      RefreshLoginUser(userId, osClient) {
        assert.equal(userId, currentUser.Id);
        assert.equal(osClient, 'junchi');
        return { Code: 1, Data: { ...currentUser, ...(updateModel || {}) } };
      },
    },
  };
  return { result: execute(V8), updateModel, hooks };
}

test('system-account package uniquely carries the exact Managed current-user preference engine', () => {
  const packageName = 'app.microi.sys_user.json';
  const pkg = JSON.parse(fs.readFileSync(path.join(resourceDir, packageName), 'utf8'));
  const engines = (pkg.SysApiEngines || []).filter(item => item.ApiEngineKey === engineKey);
  assert.equal(engines.length, 1, packageName);
  assert.equal(String(engines[0].ApiV8Code || '').replaceAll('\r\n', '\n'), source, packageName);
  assert.match(engines[0].ApiV8Code, /所属官方应用：系统账号/, packageName);
  assert.equal(engines[0].AllowAnonymous, 0);
  assert.equal(engines[0].StopHttp, 0);
  assert.equal(engines[0].IsEnable, 1);
  assert.deepEqual(pkg.ResourcePolicies.ApiEngines[engineKey], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
  assert.ok(pkg.PackageInfo.RequiredPlatformCapabilities.some(value =>
    value === `ApiEngine:${engineKey}` || value.startsWith(`ApiEngine:${engineKey}@`)));
  assert.ok(!pkg.PackageInfo.RequiredPlatformCapabilities.includes('Api:SysUser.UpdateMyPreferences'));

  for (const packageName of ['app.microi.saas-engine.json', 'app.microi.store.json']) {
    const pkg = JSON.parse(fs.readFileSync(path.join(resourceDir, packageName), 'utf8'));
    const engines = (pkg.SysApiEngines || []).filter(item => item.ApiEngineKey === engineKey);
    assert.equal(engines.length, 0, packageName);
    assert.equal(pkg.ResourcePolicies?.ApiEngines?.[engineKey], undefined, packageName);
    assert.ok(!pkg.PackageInfo.RequiredPlatformCapabilities.some(value =>
      value === `ApiEngine:${engineKey}` || value.startsWith(`ApiEngine:${engineKey}@`)), packageName);
  }
});

test('preference generator delegates to the system-account fact source and cannot rewrite the shared base', () => {
  const generator = fs.readFileSync(
    path.join(resourceDir, 'configure-platform-user-preferences-engine.mjs'),
    'utf8',
  );
  assert.match(generator, /configureV8FirstPlatformPackages/);
  assert.match(generator, /app\.microi\.sys_user\.json/);
  assert.match(generator, /禁止生成器直接使用 --sync-base/);
  assert.doesNotMatch(generator, /LimitRecursion\s*:/);
  assert.doesNotMatch(generator, /writeFileSync/);
});

test('engine saves only its fixed whitelist against the token user', () => {
  const { result, updateModel, hooks } = run({
    DefaultIndexUrl: '#/dashboard',
    ThemeColor: '#12abef',
    ThemeMode: 'DARK',
    MenuChildExpandMode: 'right',
    DesktopType: 'windows',
    DesktopBg: '/junchi/member/background.webp',
    RandomDesktopBg: false,
    OpenTreeMenu: true,
    DesktopDockMenu: ['menu-a', 'MENU-A', 'menu-b'],
    Id: 'attacker-user',
    UserId: 'attacker-user',
    OsClient: 'itdos',
    Account: 'attacker',
    Level: 9999,
    RoleIds: ['admin-role'],
    DeptId: 'admin-dept',
  });

  assert.equal(result.Code, 1);
  assert.deepEqual(updateModel, {
    Id: 'user-1',
    DefaultIndexUrl: '/dashboard',
    ThemeColor: '#12ABEF',
    ThemeMode: 'dark',
    MenuChildExpandMode: 'Right',
    DesktopType: 'windows',
    DesktopBg: '/junchi/member/background.webp',
    RandomDesktopBg: 0,
    OpenTreeMenu: 1,
    DesktopDockMenu: '["menu-a","menu-b"]',
  });
  for (const forbidden of ['UserId', 'OsClient', 'Account', 'Level', 'RoleIds', 'DeptId']) {
    assert.ok(!(forbidden in updateModel));
  }
  assert.equal(hooks.length, 2);
  assert.ok(hooks.every(item => item.key === 'platform-user-custom-hook'));
  assert.equal(hooks[0].payload.Stage, 'BeforeUpdatePreferences');
  assert.equal(hooks[1].payload.Stage, 'AfterUpdatePreferences');
  assert.equal(hooks[0].payload.UserId, 'user-1');
  assert.deepEqual(hooks[0].payload.ChangedFields.sort(), Object.keys(updateModel)
    .filter(name => name !== 'Id')
    .sort());
  assert.doesNotMatch(JSON.stringify(hooks), /attacker|RoleIds|DeptId|Account|Level/);
});

test('engine rejects external routes, invalid colors and cross-tenant desktop paths', () => {
  assert.equal(run({ DefaultIndexUrl: '//evil.example/path' }).result.Code, 0);
  assert.equal(run({ DefaultIndexUrl: '/login' }).result.Code, 0);
  assert.equal(run({ ThemeColor: 'red' }).result.Code, 0);
  assert.equal(run({ ThemeMode: 'system' }).result.Code, 0);
  assert.equal(run({ MenuChildExpandMode: 'popup' }).result.Code, 0);
  assert.equal(run({ DesktopBg: '/itdos/member/background.webp' }).result.Code, 0);
  assert.equal(run({ DesktopDockMenu: Array.from({ length: 101 }, (_, index) => `menu-${index}`) }).result.Code, 0);
});

test('both framework clients call the Managed ApiEngine instead of a binary-only controller', () => {
  const themeSelect = fs.readFileSync(
    path.resolve(resourceDir, '../../../Microi.Client/src/layout/components/ThemeSelect.vue'),
    'utf8',
  );
  const personalSettings = fs.readFileSync(
    path.resolve(resourceDir, '../../../AI-Project/microi/AI应用/microi-platform-service/src/PersonalSettings.vue'),
    'utf8',
  );
  assert.match(themeSelect, /ApiEngine\.Run\(\s*["']platform-user-update-preferences["']/);
  assert.match(personalSettings, /ApiEngine\.Run\(\s*["']platform-user-update-preferences["']/);
  assert.doesNotMatch(themeSelect + personalSettings, /UpdateMyPreferences/);
});
