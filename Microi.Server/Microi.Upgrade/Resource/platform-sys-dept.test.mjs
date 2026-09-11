import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./platform-sys-dept.js', import.meta.url), 'utf8');
const run = new Function('V8', source);
function invoke(param, user = { Id: 'current-user' }, result = { Code: 1, Data: [] }) {
  const calls = [];
  const response = run({ Param: param, CurrentUser: user, Method: {
    ManageSystemDirectory: request => { calls.push(request); return result; }
  } });
  return { response, calls };
}

for (const path of [
  '/api/SysDept/GetSysDeptStep',
  '/API/SYSDEPT/GETSYSDEPTSTEP',
  '/api/SysDept/GetSysDeptStep--OsClient--tenant-a--?x=1'
]) {
  test(`旧部门树地址无需 Action 且不能改为写操作: ${path}`, () => {
    for (const action of [undefined, 'DelSysDept']) {
      const param = { _RequestPath: path, FormEngineKey: 'Sys_Dept', Action: action };
      const { response, calls } = invoke(param);
      assert.equal(response.Code, 1);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].Domain, 'SysDept');
      assert.equal(calls[0].Action, 'GetSysDeptStep');
      assert.equal(calls[0].Param, param);
    }
  });
}

test('现代接口保留显式动作、大小写归一和可信目录原子的原始结果', () => {
  const expected = { Code: 1, Data: [{ Id: 'root', _Child: [{ Id: 'child' }] }] };
  for (const action of ['GetSysDeptStep', 'getsysdeptstep', 'GetSysDept', 'AddSysDept']) {
    const { response, calls } = invoke({ Action: action }, undefined, expected);
    assert.equal(response, expected);
    assert.equal(calls.length, 1);
  }
});

test('匿名、空动作及原型属性不得进入目录原子', () => {
  assert.equal(invoke({ _RequestPath: '/api/SysDept/GetSysDeptStep' }, null).response.Code, 1001);
  for (const action of ['', 'Unknown', 'constructor', 'toString', '__proto__']) {
    const { response, calls } = invoke({ Action: action });
    assert.equal(response.Code, 0);
    assert.equal(calls.length, 0);
  }
});

test('相似路径不能被当成部门树旧地址，真实权限失败不能改成成功', () => {
  for (const path of ['/api/SysDept/GetSysDeptStep/other', '/other/api/SysDept/GetSysDeptStep']) {
    const { response, calls } = invoke({ _RequestPath: path });
    assert.equal(response.Code, 0);
    assert.equal(calls.length, 0);
  }
  const denied = { Code: 1002, Msg: 'denied' };
  assert.equal(invoke({ Action: 'GetSysDeptStep' }, undefined, denied).response, denied);
});

test('官方 SaaS 包和生成器交付唯一部门树别名及完整源码', async () => {
  const pkg = JSON.parse(await readFile(new URL('./app.microi.saas-engine.json', import.meta.url), 'utf8'));
  const engines = pkg.SysApiEngines.filter(x => x.ApiEngineKey === 'platform-sys-dept');
  assert.equal(engines.length, 1);
  assert.equal(engines[0].ApiV8Code, source);
  assert.ok(String(engines[0].ApiRoutes).split(';').includes('/api/SysDept/GetSysDeptStep'));
  assert.equal(engines[0].AllowAnonymous, 0);
  assert.equal(engines[0].StopHttp, 0);
  assert.equal(pkg.ResourcePolicies.ApiEngines['platform-sys-dept'].UpgradePolicy, 'Managed');
  const generator = await readFile(new URL('./configure-platform-runtime-engines.mjs', import.meta.url), 'utf8');
  assert.match(generator, /key: 'platform-sys-dept'[\s\S]{0,450}apiRoutes: '\/api\/SysDept\/GetSysDeptStep'/);
});
