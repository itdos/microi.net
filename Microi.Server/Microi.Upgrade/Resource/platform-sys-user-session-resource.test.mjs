import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageModel = JSON.parse(fs.readFileSync(
  new URL('./app.microi.saas-engine.json', import.meta.url),
  'utf8',
));
const engine = packageModel.SysApiEngines.find(
  item => item.ApiEngineKey === 'platform-sys-user-session',
);

function execute(param) {
  const calls = [];
  const V8 = {
    Param: param,
    Method: {
      RunPlatformApiRuntime(input) {
        calls.push(input);
        return { Code: 1, Data: input };
      },
    },
  };
  const result = new Function('V8', engine.ApiV8Code)(V8);
  return { result, calls };
}

test('SaaS package ships the case-insensitive user-session compatibility engine', () => {
  assert.equal(packageModel.PackageInfo.Version, 'v7.7.12');
  assert.ok(engine);
  assert.equal(engine.Version, 'v1.0.1');
  assert.match(engine.ApiV8Code, /actionNames\[String\(action\)\.toLowerCase\(\)\]/);
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines['platform-sys-user-session'], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
});

for (const [routeAction, expectedAction] of [
  ['refreshToken', 'RefreshToken'],
  ['RefreshToken', 'RefreshToken'],
  ['tokenlogin', 'TokenLogin'],
  ['TokenLogin', 'TokenLogin'],
]) {
  test(`legacy route action ${routeAction} resolves to ${expectedAction}`, () => {
    const { result, calls } = execute({
      _RequestPath: `/api/SysUser/${routeAction}`,
      _HttpMethod: 'POST',
    });
    assert.equal(result.Code, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].RuntimeKey, 'SysUserSession');
    assert.equal(calls[0].Action, expectedAction);
  });
}

test('unknown user-session actions remain rejected', () => {
  const { result, calls } = execute({
    _RequestPath: '/api/SysUser/Unknown',
    _HttpMethod: 'POST',
  });
  assert.equal(result.Code, 0);
  assert.equal(result.Msg, '不支持的用户会话动作。');
  assert.equal(calls.length, 0);
});

test('post-only actions remain post-only after normalization', () => {
  const { result, calls } = execute({
    Action: 'refreshToken',
    _HttpMethod: 'GET',
  });
  assert.equal(result.Code, 0);
  assert.equal(result.Msg, '该用户会话动作仅支持 POST 请求。');
  assert.equal(calls.length, 0);
});
