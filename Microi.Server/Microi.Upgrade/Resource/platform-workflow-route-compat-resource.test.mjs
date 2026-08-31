import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageModel = JSON.parse(fs.readFileSync(
  new URL('./app.microi.saas-engine.json', import.meta.url),
  'utf8',
));
const engine = packageModel.SysApiEngines.find(
  item => item.ApiEngineKey === 'platform-workflow',
);

function execute(param) {
  const hookCalls = [];
  const runtimeCalls = [];
  const V8 = {
    Param: param,
    ApiEngine: {
      Run(key, input) {
        hookCalls.push({ key, input });
        return { Code: 1 };
      },
    },
    Method: {
      ManageWorkFlow(input) {
        runtimeCalls.push(input);
        return { Code: 1, Data: input };
      },
    },
  };
  const result = new Function('V8', engine.ApiV8Code)(V8);
  return { result, hookCalls, runtimeCalls };
}

test('SaaS package ships the case-insensitive workflow compatibility engine', () => {
  assert.equal(packageModel.PackageInfo.Version, 'v7.7.13');
  assert.ok(engine);
  assert.equal(engine.Version, 'v1.0.1');
  assert.match(engine.ApiV8Code, /actionNames\[String\(action\)\.toLowerCase\(\)\]/);
  assert.deepEqual(packageModel.ResourcePolicies.ApiEngines['platform-workflow'], {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  });
});

for (const [routeAction, expectedAction] of [
  ['getWFWork', 'GetWFWork'],
  ['GetWFWork', 'GetWFWork'],
  ['getWFFlow', 'GetWFFlow'],
  ['GetWFFlow', 'GetWFFlow'],
]) {
  test(`legacy workflow route ${routeAction} resolves to ${expectedAction}`, () => {
    const { result, hookCalls, runtimeCalls } = execute({
      _RequestPath: `/api/WorkFlow/${routeAction}`,
    });
    assert.equal(result.Code, 1);
    assert.equal(hookCalls.length, 1);
    assert.equal(hookCalls[0].input.Action, expectedAction);
    assert.equal(runtimeCalls.length, 1);
    assert.equal(runtimeCalls[0].Action, expectedAction);
  });
}

test('unknown workflow actions remain rejected before the tenant hook', () => {
  const { result, hookCalls, runtimeCalls } = execute({
    _RequestPath: '/api/WorkFlow/Unknown',
  });
  assert.equal(result.Code, 0);
  assert.equal(result.Msg, '不支持的工作流动作。');
  assert.equal(hookCalls.length, 0);
  assert.equal(runtimeCalls.length, 0);
});
