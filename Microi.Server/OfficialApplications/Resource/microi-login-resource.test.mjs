import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { configureMicroiLoginPackages } from './configure-microi-login-resource.mjs';

const readPackage = name => JSON.parse(fs.readFileSync(new URL(`./app.microi.${name}.json`, import.meta.url), 'utf8'));
const bindingSource = fs.readFileSync(new URL('./platform-external-login-binding.js', import.meta.url), 'utf8');
const packages = new Map(['sys-config', 'saas-engine'].map(name => [name, readPackage(name)]));
packages.set('bootstrap', JSON.parse(fs.readFileSync(new URL('../../Microi.Upgrade/Resource/app.microi.bootstrap.json', import.meta.url), 'utf8')));

test('new and upgraded tenants receive nullable Microi capability and hide switches with safe defaults', () => {
  for (const [name, pkg] of packages) {
    const table = pkg.DiyTables.find(item => item.Name.toLowerCase() === 'sys_config');
    for (const fieldName of ['MicroiLoginEnabled', 'DisableLoginMicroi']) {
      const matches = pkg.DiyFields.filter(item => item.TableId === table.Id && item.Name === fieldName);
      assert.equal(matches.length, 1, `${name}:${fieldName} metadata`);
      const field = matches[0];
      assert.equal(field.DefaultValue, '0', `${name}:${fieldName} must require deliberate enablement`);
      assert.equal(field.Component, 'Switch');
      assert.equal(field.Visible, 1);
      assert.equal(field.AppVisible, 1);
      assert.equal(field.FormWidth, undefined);
      const columns = pkg.PhysicalColumns.filter(item => item.TABLE_NAME.toLowerCase() === 'sys_config' && item.COLUMN_NAME === fieldName);
      assert.equal(columns.length, 1, `${name}:${fieldName} physical column`);
      assert.equal(columns[0].IS_NULLABLE, 'YES');
      assert.equal(columns[0].COLUMN_DEFAULT, null, 'upgrade must not fill existing tenant values');
      assert.ok(pkg.DDLStatements.some(item => item.TableName.toLowerCase() === 'sys_config' && item.DDL.includes(`\`${fieldName}\``)));
    }
  }
});

test('Microi hide switch stays beside Gitee in the login-entry layout and uses its matching prototype', () => {
  const official = packages.get('sys-config');
  const officialTable = official.DiyTables.find(item => item.Name.toLowerCase() === 'sys_config');
  const officialFields = official.DiyFields.filter(item => item.TableId === officialTable.Id);
  const giteeHide = officialFields.find(item => item.Name === 'DisableLoginGitee');
  const enabledPrototype = officialFields.find(item => item.Name === 'GiteeLoginEnabled');
  const groupFor = (field, fields) => fields
    .filter(item => item.Component === 'CollapseGroup' && item.Tab === field.Tab && Number(item.Sort) <= Number(field.Sort))
    .sort((left, right) => Number(right.Sort) - Number(left.Sort))[0]?.Name;
  assert.equal(groupFor(giteeHide, officialFields), 'InterfaceLoginExperienceGroup');
  for (const [name, pkg] of packages) {
    const table = pkg.DiyTables.find(item => item.Name.toLowerCase() === 'sys_config');
    const hide = pkg.DiyFields.find(item => item.TableId === table.Id && item.Name === 'DisableLoginMicroi');
    const enabled = pkg.DiyFields.find(item => item.TableId === table.Id && item.Name === 'MicroiLoginEnabled');
    const fields = pkg.DiyFields.filter(item => item.TableId === table.Id);
    assert.equal(groupFor(hide, fields), 'InterfaceLoginExperienceGroup', `${name}: hide switch belongs to the real login-entry group`);
    assert.equal(hide.Sort, name === 'sys-config' ? 5610 : 1815, `${name}: preserve the package's actual login-group range`);
    assert.equal(hide.Tab, giteeHide.Tab, `${name}: preserve the hide-switch prototype tab`);
    assert.equal(enabled.Sort, 1715);
    assert.equal(enabled.Tab, enabledPrototype.Tab);
  }
  assert.equal(groupFor(officialFields.find(item => item.Name === 'DisableLoginMicroi'), officialFields), 'InterfaceLoginExperienceGroup');

  const models = new Map(['sys-config', 'saas-engine'].map(name => [name, structuredClone(packages.get(name))]));
  for (const pkg of models.values()) {
    pkg.DiyFields = pkg.DiyFields.filter(item => !['MicroiLoginEnabled', 'DisableLoginMicroi'].includes(item.Name));
    pkg.DiyFields.find(item => item.Name === 'GiteeLoginEnabled').PrototypeLayoutMarker = 'enabled-switch';
  }
  const hidePrototype = models.get('sys-config').DiyFields.find(item => item.Name === 'DisableLoginGitee');
  hidePrototype.PrototypeLayoutMarker = 'hide-switch';
  configureMicroiLoginPackages(models, bindingSource);
  for (const [name, pkg] of models) {
    const hide = pkg.DiyFields.find(item => item.Name === 'DisableLoginMicroi');
    const enabled = pkg.DiyFields.find(item => item.Name === 'MicroiLoginEnabled');
    assert.equal(hide.PrototypeLayoutMarker, 'hide-switch', `${name}: use DisableLoginGitee prototype`);
    assert.equal(hide.Tab, hidePrototype.Tab);
    assert.equal(enabled.PrototypeLayoutMarker, 'enabled-switch', `${name}: use GiteeLoginEnabled prototype`);
  }

  const existingHide = models.get('sys-config').DiyFields.find(item => item.Name === 'DisableLoginMicroi');
  existingHide.Sort = 1815;
  existingHide.Tab = 'wrong-tab';
  configureMicroiLoginPackages(models, bindingSource);
  assert.equal(existingHide.Sort, 5610, 'regeneration repairs an existing field in the wrong group');
  assert.equal(existingHide.Tab, hidePrototype.Tab);
});

test('Microi client templates have no shared credential or public projection and preserve tenant-owned values', () => {
  const pkg = packages.get('saas-engine');
  const dataSet = pkg.DataSets.find(item => item.TableName.toLowerCase() === 'mci_system_setting');
  assert.equal(dataSet.ConflictPolicy, 'InsertIfMissing');
  assert.deepEqual(dataSet.ConflictFields, ['ConfigKey']);
  assert.ok(!dataSet.MetadataFieldsIfExists.includes('ConfigValue'));
  const microiRows = dataSet.Rows.filter(item => item.ConfigKey.startsWith('Login.Microi.'));
  assert.deepEqual(microiRows.map(item => item.ConfigKey).sort(), [
    'Login.Microi.ClientId', 'Login.Microi.Description', 'Login.Microi.Name', 'Login.Microi.Scope',
  ]);
  for (const row of microiRows) {
    assert.equal(row.IsSecret, 0);
    assert.equal(row.IsPublic, 0);
    assert.equal(row.IsEnabled, 0);
  }
  assert.equal(microiRows.find(item => item.ConfigKey === 'Login.Microi.ClientId').ConfigValue, '');
  assert.equal(microiRows.find(item => item.ConfigKey === 'Login.Microi.Scope').ConfigValue, 'openid profile email');
});

function runBinding(param, { currentUser = { Id: 'local-user' }, trusted = true, existing = null, databaseFailure = false, hookReentry = false } = {}) {
  const writes = [];
  const reads = [];
  const hooks = [];
  let protocolCalls = 0;
  const result = vm.runInNewContext(`(function(){${bindingSource}\n})()`, {
    DateNow: () => '2026-10-13 12:00:00',
    V8: {
      Param: param, CurrentUser: currentUser,
      Method: { RequireManagedProtocolContext: () => ({ Code: trusted && ++protocolCalls === 1 ? 1 : 0 }), NewGuid: () => 'new-binding' },
      ApiEngine: { Run(key, value) {
        const hook = { key, value, protocolAlreadyConsumed: protocolCalls === 1 };
        if (hookReentry) hook.reentryCode = trusted && ++protocolCalls === 1 ? 1 : 0;
        hooks.push(hook);
        return { Code: 1 };
      } },
      FormEngine: {
        GetTableData: () => ({ Code: 1, Data: [] }),
        GetFormData(table, query) {
          reads.push({ table, query });
          if (databaseFailure) return { Code: 0, Msg: 'Database unavailable' };
          if (table === 'sys_user') return { Code: 1, Data: { Id: 'local-user' } };
          return existing ? { Code: 1, Data: existing } : { Code: 2 };
        },
        AddFormData(table, form) { writes.push({ table, form }); return { Code: 1 }; },
        UptFormData(table, form) { writes.push({ table, form }); return { Code: 1 }; },
      },
    },
  });
  return { result, reads, writes, hooks, protocolCalls };
}

test('List and Revoke reject an untrusted caller before reading data or entering tenant hooks', () => {
  for (const action of ['List', 'Revoke']) {
    const attempt = runBinding({ Action: action, Id: 'owned-binding' }, { trusted: false });
    assert.equal(attempt.result.Code, 0, action);
    assert.equal(attempt.reads.length, 0, action);
    assert.equal(attempt.writes.length, 0, action);
    assert.equal(attempt.hooks.length, 0, action);
  }
});

test('authenticated List and owned Revoke consume one host grant before tenant hooks', () => {
  for (const action of ['List', 'Revoke']) {
    const attempt = runBinding({ Action: action, Id: 'owned-binding' }, {
      existing: { Id: 'owned-binding', ProviderKey: 'Microi', BoundUserId: 'local-user' },
    });
    assert.equal(attempt.result.Code, 1, action);
    assert.equal(attempt.protocolCalls, 1, action);
    assert.ok(attempt.hooks.length > 0, action);
    assert.ok(attempt.hooks.every(hook => hook.protocolAlreadyConsumed), action);
  }
});

test('a tenant hook cannot reuse the List or Revoke host grant for a nested binding operation', () => {
  for (const action of ['List', 'Revoke']) {
    const attempt = runBinding({ Action: action, Id: 'owned-binding' }, {
      existing: { Id: 'owned-binding', ProviderKey: 'Microi', BoundUserId: 'local-user' }, hookReentry: true,
    });
    assert.equal(attempt.result.Code, 1, action);
    assert.ok(attempt.hooks.length > 0, action);
    assert.ok(attempt.hooks.every(hook => hook.reentryCode === 0), action);
  }
});

test('trusted binding lists and revokes still require a current local user', () => {
  for (const action of ['List', 'Revoke']) {
    const attempt = runBinding({ Action: action, Id: 'owned-binding' }, { currentUser: null });
    assert.equal(attempt.result.Code, 1001, action);
    assert.equal(attempt.hooks.length, 0, action);
    assert.equal(attempt.reads.length, 0, action);
    assert.equal(attempt.writes.length, 0, action);
  }
});

test('revoke queries include the authenticated owner and do not mutate an absent binding', () => {
  const attempt = runBinding({ Action: 'Revoke', Id: 'another-users-binding' });
  assert.equal(attempt.result.Code, 0);
  assert.equal(attempt.reads[0].query.Id, 'another-users-binding');
  assert.deepEqual(Array.from(attempt.reads[0].query._Where[0]), ['BoundUserId', '=', 'local-user']);
  assert.equal(attempt.hooks.length, 0);
  assert.equal(attempt.writes.length, 0);
});

test('external authenticated binding actions enter exact tenant host scopes while retaining token and ownership checks', () => {
  const runtime = fs.readFileSync(new URL('../../Microi.SSO/ExternalLogin/ExternalLoginRuntime.cs', import.meta.url), 'utf8');
  for (const [method, end] of [['ListBindings', 'RevokeBinding'], ['RevokeBinding', 'private']]) {
    const start = runtime.indexOf(`public async Task<object> ${method}(`);
    const section = runtime.slice(start, method === 'ListBindings' ? runtime.indexOf('public async Task<object> RevokeBinding(', start) : runtime.indexOf('\n        private ', start));
    assert.ok(start >= 0, method);
    assert.match(section, /RequireUserTokenAsync\(\)/, method);
    assert.match(section, /if \(token.Code != 1\) return Json\(token\)/, method);
    assert.match(section, /RunTrustedProtocolAsync\(\s*BindingApiEngineKey,\s*token.Data.OsClient,/, method);
  }
});

test('personal external identities include Microi while excluding unknown providers', () => {
  const { result } = runBinding({ Action: 'List', Providers: [
    { Key: 'Microi', Name: 'Microi 登录', Enabled: true, Configured: true },
    { Key: 'Attacker', Name: 'unknown', Enabled: true, Configured: true },
  ] });
  assert.equal(result.Code, 1);
  assert.deepEqual(Array.from(result.Data.Providers, item => item.Key), ['Microi']);
});

test('Microi binds stable official subjects and cannot claim an identity owned by another local user', () => {
  const param = { Action: 'Bind', ProviderKey: 'Microi', ProviderSubject: 'official-sub', TrustedUserId: 'local-user' };
  const bound = runBinding(param);
  assert.equal(bound.result.Code, 1);
  assert.equal(bound.writes.length, 1);
  assert.equal(bound.writes[0].table, 'mci_user_external_identity');
  assert.equal(bound.writes[0].form.ProviderKey, 'Microi');
  assert.equal(bound.writes[0].form.ProviderSubject, 'official-sub');
  assert.equal(bound.writes[0].form.BoundUserId, 'local-user');
  const denied = runBinding(param, { existing: { Id: 'other-binding', BoundUserId: 'other-user' } });
  assert.equal(denied.result.Code, 0);
  assert.equal(denied.writes.length, 0);
});

test('Microi resolution rejects unbound subjects, untrusted protocol callers and database failures', () => {
  const param = { Action: 'Resolve', ProviderKey: 'Microi', ProviderSubject: 'official-sub' };
  const missing = runBinding(param);
  assert.equal(missing.result.Code, 2);
  assert.equal(missing.writes.length, 0, 'login cannot automatically create accounts or bindings');
  const denied = runBinding(param, { trusted: false });
  assert.equal(denied.result.Code, 0);
  assert.equal(denied.reads.length, 0);
  const failed = runBinding(param, { databaseFailure: true });
  assert.equal(failed.result.Code, 0);
  assert.equal(failed.result.Msg, 'Database unavailable');
  assert.equal(failed.writes.length, 0);
});

test('existing Gitee, GitHub and WeChat bindings retain their exact provider-subject lookup', () => {
  for (const provider of ['Gitee', 'GitHub', 'WeChat', 'Microi']) {
    const resolved = runBinding({ Action: 'Resolve', ProviderKey: provider, ProviderSubject: 'same-subject' }, {
      existing: { Id: `${provider}-binding`, BoundUserId: 'local-user' },
    });
    assert.equal(resolved.result.Code, 1, provider);
    assert.equal(resolved.result.Data.Id, `${provider}-binding`);
    assert.equal(resolved.reads[0].query._Where[0][2], provider);
    assert.equal(resolved.reads[0].query._Where[1][2], 'same-subject');
  }
});

test('official SaaS package carries the same trusted binding implementation and ownership policy', () => {
  const pkg = packages.get('saas-engine');
  const binding = pkg.SysApiEngines.find(item => item.ApiEngineKey === 'platform-external-login-binding');
  assert.equal(binding.ApiV8Code.replaceAll('\r\n', '\n').trim(), bindingSource.replaceAll('\r\n', '\n').trim());
  assert.equal(binding.StopHttp, 1);
  assert.equal(binding.AllowAnonymous, 0);
  assert.equal(binding.Lock, 1);
  assert.equal(pkg.ResourcePolicies.ApiEngines[binding.ApiEngineKey].UpgradePolicy, 'Managed');
});

test('resource regeneration is idempotent and preserves unrelated package metadata and tenant-owned settings', () => {
  const models = new Map(['sys-config', 'saas-engine'].map(name => [name, structuredClone(packages.get(name))]));
  const saas = models.get('saas-engine');
  const settings = saas.DataSets.find(item => item.TableName.toLowerCase() === 'mci_system_setting');
  const client = settings.Rows.find(item => item.ConfigKey === 'Login.Microi.ClientId');
  client.ConfigValue = 'deployment-client';
  client.IsEnabled = 1;
  saas.UnrelatedReleaseMarker = { Preserve: true };
  models.get('sys-config').DiyFields.push({ Id: 'unrelated', TableId: 'custom-table', Name: 'KeepMe' });
  configureMicroiLoginPackages(models, bindingSource);
  assert.equal(client.ConfigValue, 'deployment-client');
  assert.equal(client.IsEnabled, 1);
  assert.deepEqual(saas.UnrelatedReleaseMarker, { Preserve: true });
  assert.ok(models.get('sys-config').DiyFields.some(item => item.Name === 'KeepMe'));
  const first = JSON.stringify([...models]);
  configureMicroiLoginPackages(models, bindingSource);
  assert.equal(JSON.stringify([...models]), first);
});
