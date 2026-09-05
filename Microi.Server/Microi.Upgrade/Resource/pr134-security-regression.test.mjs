import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const store = JSON.parse(await readFile(new URL('./app.microi.store.json', import.meta.url), 'utf8'));
const saas = JSON.parse(await readFile(new URL('./app.microi.saas-engine.json', import.meta.url), 'utf8'));
const createSource = store.SysApiEngines.find(engine => engine.ApiEngineKey === 'ai_app_create').ApiV8Code;
const sdkFunction = createSource.match(/function vueMicroiSdk\(\)\s*\{\s*return\s*("(?:[^"\\]|\\.)*")\s*;/);
assert.ok(sdkFunction, '必须验证随商城包交付的真实脚手架 SDK');
const sdkSource = JSON.parse(sdkFunction[1]);
const { createMicroiV8 } = await import(`data:text/javascript;base64,${Buffer.from(sdkSource).toString('base64')}`);

function clientFixture(response) {
  const cache = new Map();
  const expired = [];
  const client = createMicroiV8({
    apiBase: 'https://fixture.invalid',
    osClient: 'fixture',
    token: 'fixture-session',
    storage: { get: key => cache.get(key) || '', set: (key, value) => cache.set(key, value), remove: key => cache.delete(key) },
    requestAdapter: async () => response,
    onAuthExpired: body => expired.push(body),
    toast: () => {},
  });
  return { client, expired };
}

test('脚手架返回 Code=-1 业务失败时保留 DiyToken 和当前会话', async () => {
  const body = { Code: -1, Msg: '库存不足' };
  const { client, expired } = clientFixture({ statusCode: 200, data: body });
  assert.deepEqual(await client.request({ url: '/business' }), body);
  assert.equal(client.getToken(), 'fixture-session');
  assert.equal(expired.length, 0);
  await assert.rejects(client.request({ url: '/business', checkCode: true, silentError: true }), error => error === body);
  assert.equal(client.getToken(), 'fixture-session');
  assert.equal(expired.length, 0);
});

for (const response of [
  { statusCode: 200, data: { Code: 401 } },
  { statusCode: 200, data: { Code: 1001 } },
  { statusCode: 200, data: { Code: 1002 } },
  { statusCode: 401, data: { Code: -1 } },
]) {
  test(`脚手架仍清理真正失效的会话：HTTP ${response.statusCode} / Code ${response.data.Code}`, async () => {
    const { client, expired } = clientFixture(response);
    await assert.rejects(client.request({ url: '/business', silentError: true }));
    assert.equal(client.getToken(), '');
    assert.equal(expired.length, 1);
  });
}

const homeMenuIds = [
  'daa16941-afa8-4263-a77d-26a14b679bbd',
  'a283360d-9f1f-43d3-9380-074d60b87375',
  '299b8094-7e9e-4862-8e3c-62fdc4cc8a09',
  '01KX884VMCV672GN43Z5RCT84X',
  '01KX884VXENKCJQMMTYPS2PK63',
];

function saveRolePermissions(requested) {
  const role = saas.DiyTables.find(table => table.Name === 'sys_role');
  const V8 = {
    CurrentUser: { _IsAdmin: true },
    FormSubmitAction: 'Upt',
    Form: { Id: 'limited-role', Name: '受限业务角色', Level: 1, RolePermissionDetails: JSON.stringify({ Menu: requested }) },
    OldForm: {},
    DbTrans: {},
    FormEngine: {
      GetTableData(name) {
        if (name === 'sys_role') return { Code: 1, Data: [], DataCount: 0 };
        if (name === 'sys_menu') {
          const Data = [...homeMenuIds, 'requested-report'].map(Id => ({ Id, ParentId: '' }));
          return { Code: 1, Data, DataCount: Data.length };
        }
        throw new Error(`出现未预期的数据访问：${name}`);
      },
    },
  };
  const result = vm.runInNewContext(`(function(){${role.SubmitBeforeServerV8}\n})()`, { V8 }, { timeout: 1000 });
  assert.equal(result.Code, 1, result.Msg);
  return JSON.parse(V8.Form.RolePermissionDetails).Menu;
}

test('管理员明确清空角色菜单权限后，保存事件不得重新赋予首页业务读权限', () => {
  assert.deepEqual(saveRolePermissions([]), []);
});

test('保存角色只保留已授权菜单，不向已有角色追加未勾选的业务菜单', () => {
  const requested = [{ Id: 'requested-report', Permission: '["Read","Edit"]' }];
  assert.deepEqual(saveRolePermissions(requested), requested);
});

test('SaaS 升级包不声明跨全部角色的权限扩张，菜单数量与实际资源一致', () => {
  assert.deepEqual(saas.ResourcePolicies.MenuReadGrants || [], []);
  assert.equal(saas.PackageInfo.MenuCount, saas.SysMenus.length);
});
