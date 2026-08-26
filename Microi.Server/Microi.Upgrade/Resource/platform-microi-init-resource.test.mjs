import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const packageModel = JSON.parse(fs.readFileSync(
  path.join(directory, 'app.microi.saas-engine.json'),
  'utf8',
));
const canonicalSource = fs.readFileSync(
  path.join(directory, 'platform-microi-init.js'),
  'utf8',
).replace(/\r\n?/g, '\n').trimEnd();
const engine = packageModel.SysApiEngines.find(item => item.ApiEngineKey === 'microi-init');

function execute(overrides = {}) {
  const calls = [];
  const V8 = {
    Param: {},
    OsClient: 'tenant-a',
    ApiEngine: {
      Run(key, param) {
        calls.push({ type: 'engine', key, param });
        if (key === 'platform-os-client-by-domain') {
          return { Code: 1, Data: { OsClient: 'tenant-a' } };
        }
        if (key === 'platform-sys-config') {
          return { Code: 1, Data: { SysTitle: 'Microi', PublicOnly: true } };
        }
        throw new Error(`unexpected engine ${key}`);
      },
    },
    Method: {
      GetCurrentToken() { return null; },
      RefreshLoginUser() { throw new Error('unexpected refresh'); },
    },
    Action: { GetDateTimeNow: () => '2026-08-25 12:00:00' },
    FormEngine: {
      GetTableDataTree() { throw new Error('unexpected menu read'); },
    },
    ...overrides,
  };
  const result = new Function('V8', canonicalSource)(V8);
  return { result, calls, V8 };
}

test('legacy microi-init is a Managed SaaS engine shipped by the current package', () => {
  assert.equal(packageModel.PackageInfo.Version, 'v7.7.1');
  assert.ok(engine);
  assert.equal(engine.Version, 'v2.0.2');
  assert.equal(engine.AllowAnonymous, 1);
  assert.equal(engine.StopHttp, 0);
  assert.equal(engine.ApiAddress, '/apiengine/microi-init');
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines['microi-init'], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
  assert.ok(packageModel.PackageInfo.RequiredPlatformCapabilities.includes(
    'ApiEngine:microi-init',
  ));
  assert.equal(engine.ApiV8Code.replace(/\r\n?/g, '\n').trimEnd(), canonicalSource);
  assert.match(engine.ApiV8Code, /^\/\* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1/);
  assert.match(engine.ApiV8Code, /RefreshLoginUser\([\s\S]*rawToken/);
  assert.match(engine.ApiV8Code, /GetLegacyInitMenuTree\(rawToken, osClient\)/);
  assert.match(engine.ApiV8Code, /safeCurrentUserProjection/);
  assert.doesNotMatch(engine.ApiV8Code, /GetTableDataTree|GetFormData\(/);
});

test('anonymous initialization returns only public startup data and never reads menus', () => {
  const { result, calls } = execute();
  assert.equal(result.Code, 1);
  assert.deepEqual(result.Data, {
    OsClient: 'tenant-a',
    SysConfig: { SysTitle: 'Microi', PublicOnly: true },
    DateTimeNow: '2026-08-25 12:00:00',
    CurrentUser: {},
    Token: {},
    ModuleList: [],
  });
  assert.deepEqual(calls, [{
    type: 'engine',
    key: 'platform-sys-config',
    param: { _Lang: '' },
  }]);
});

test('domain discovery cannot switch the anonymous execution tenant', () => {
  let configCalled = false;
  const { result } = execute({
    Param: { Domain: 'tenant-b.example.test' },
    ApiEngine: {
      Run(key) {
        if (key === 'platform-os-client-by-domain') {
          return { Code: 1, Data: { OsClient: 'tenant-b' } };
        }
        configCalled = true;
        return { Code: 1, Data: {} };
      },
    },
  });
  assert.equal(result.Code, 1002);
  assert.equal(result.Data.OsClient, 'tenant-b');
  assert.equal(result.DataAppend.OsClient, 'tenant-b');
  assert.equal(configCalled, false);
});

test('invalid raw tokens fail closed before menu access', () => {
  let menuRead = false;
  const { result } = execute({
    Param: { Token: 'expired-token' },
    Method: {
      GetCurrentToken: () => null,
      RefreshLoginUser: () => { throw new Error('unexpected refresh'); },
    },
    FormEngine: {
      GetTableDataTree: () => { menuRead = true; return { Code: 1, Data: [] }; },
    },
  });
  assert.equal(result.Code, 1001);
  assert.equal(menuRead, false);
});

test('validated users bind refresh and authoritative menu-tree atoms to the raw token', () => {
  const refreshCalls = [];
  const menuCalls = [];
  const currentUser = {
    Id: 'user-1',
    Account: 'member',
    Level: 1,
    Pwd: 'password-hash',
    PwdEncode: 'PBKDF2-SHA256',
    AiApiKey: 'relay-secret',
    Nested: { Name: 'kept', Token: 'nested-secret' },
    _RoleLimits: [
      { Type: 'Menu', FkId: 'menu-a' },
      { Type: 'Table', FkId: 'table-secret' },
      { Type: 'Menu', FkId: 'menu-b' },
    ],
  };
  const { result } = execute({
    Param: { Token: 'validated-token', _Lang: 'zh-CN' },
    Method: {
      GetCurrentToken(token, osClient) {
        assert.equal(token, 'validated-token');
        assert.equal(osClient, 'tenant-a');
        return { CurrentUser: currentUser, OsClient: 'tenant-a', Token: token };
      },
      RefreshLoginUser(userId, osClient, token) {
        refreshCalls.push({ userId, osClient, token });
        return { Code: 1, Data: currentUser };
      },
      GetLegacyInitMenuTree(token, osClient) {
        menuCalls.push({ token, osClient });
        return { Code: 1, Data: [{ Id: 'menu-a' }] };
      },
    },
    FormEngine: {
      GetTableDataTree() { throw new Error('generic sys_menu read must not execute'); },
    },
  });

  assert.deepEqual(refreshCalls, [{
    userId: 'user-1',
    osClient: 'tenant-a',
    token: 'validated-token',
  }]);
  assert.deepEqual(menuCalls, [{ token: 'validated-token', osClient: 'tenant-a' }]);
  assert.equal(result.Code, 1);
  assert.equal(result.Data.Token, 'validated-token');
  assert.equal(result.Data.CurrentUser.Id, 'user-1');
  assert.equal(result.Data.CurrentUser.Nested.Name, 'kept');
  assert.equal(result.Data.CurrentUser.Pwd, undefined);
  assert.equal(result.Data.CurrentUser.PwdEncode, undefined);
  assert.equal(result.Data.CurrentUser.AiApiKey, undefined);
  assert.equal(result.Data.CurrentUser.Nested.Token, undefined);
  assert.deepEqual(result.Data.ModuleList, [{
    ScreenId: 1,
    ScreenName: '',
    List: [{ Id: 'menu-a' }],
  }]);
});
