import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pkg = JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json', import.meta.url)));
const source = process.env.MICROI_LOGIN_REGRESSION_SOURCE
  ? fs.readFileSync(process.env.MICROI_LOGIN_REGRESSION_SOURCE, 'utf8')
  : pkg.SysApiEngines.find(e => e.ApiEngineKey === 'official_sms_login').ApiV8Code;
const admin = { Id: 'verified-admin-id', Account: 'admin', Name: '管理员', Phone: 'shared-phone', RoleIds: '[{"Id":"admin-role","Level":9999}]', Level: 9999, State: 1, IsDeleted: 0 };
const demo = { ...admin, Id: 'demo-id', Account: 'demo', Name: '演示用户', RoleIds: '[{"Id":"demo-role","Level":10}]', Level: 10 };

function run(options = {}) {
  const users = (options.users || [demo, admin]).map(u => ({ ...u }));
  const authenticated = options.authenticated || users.find(u => u.Id === admin.Id) || admin;
  const calls = [], logs = [], updates = [], tokens = [];
  const V8 = {
    OsClient: 'iTdos', Param: { Action: 'login', LoginType: 'password', Account: 'admin', Pwd: 'test-only-password', ...options.param }, Header: { did: 'test-only-device' },
    ApiEngine: { Run(key, param) { calls.push({ type: 'authenticate', key, param }); return options.authResult || { Code: 1, Data: { ...authenticated }, DataAppend: options.authAppend || {} }; } },
    FormEngine: {
      GetFormData(table, param) {
        calls.push({ type: 'read', table, param });
        if (table.toLowerCase() === 'sys_user') {
          if (param.Id && options.readResult) return options.readResult;
          const row = param.Id ? users.find(u => u.Id === param.Id) : users.find(u => (param._Where || []).some(w => u[w.length === 4 ? w[1] : w[0]] === w.at(-1)));
          return row ? { Code: 1, Data: { ...row } } : { Code: 2, Data: null };
        }
        if (table === 'sys_role') return { Code: 1, Data: { Id: 'website-role', Name: '个人版角色', Level: 10 } };
        return { Code: 2, Data: null };
      },
      UptFormData(table, param) {
        updates.push({ table, param });
        const row = users.find(u => u.Id === param.Id);
        if (row) Object.assign(row, param);
        return { Code: 1 };
      }
    },
    Method: {
      SetSysUserRoleInfo(user) { return { ...user }; },
      GetAccessToken(param) { tokens.push(param); return { Code: 1, Data: { Token: 'test-only-token' } }; },
      GetUserTenant() { return { Code: 2 }; }, GetClientIP() { return { Data: '' }; },
      NewGuid() { return 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'; },
      AddSysLog(log) { logs.push(log); }
    }
  };
  const result = vm.runInNewContext(`(function(){${source}\n})()`, { V8, DateNow: () => '2026-10-03 00:00:00' });
  return { result, calls, updates, tokens, logs };
}

function assertAdmin(r) {
  assert.equal(r.result.Code, 1, r.result.Msg);
  assert.equal(r.result.Data.Id, admin.Id);
  assert.equal(r.result.Data.Account, 'admin');
  assert.equal(r.result.Data.Level, 9999);
  assert.equal(r.tokens[0].CurrentUser.Id, admin.Id);
  assert.ok(r.updates.every(u => u.param.Id === admin.Id));
}

test('共享手机号且demo先被查到时，密码登录仍只回读已认证admin的Id', () => {
  const r = run(); assertAdmin(r);
  const reads = r.calls.filter(c => c.type === 'read' && c.table.toLowerCase() === 'sys_user');
  assert.equal(reads.length, 1); assert.equal(reads[0].param.Id, admin.Id); assert.equal(reads[0].param.OsClient, 'iTdos');
});
test('手机号同时是另一人的Account也不能改变已认证身份', () => assertAdmin(run({ users: [{ ...demo, Phone: '', Account: admin.Phone }, admin] })));
test('无手机号的存量用户名账号可以登录', () => assertAdmin(run({ users: [{ ...admin, Phone: null }] })));
test('手机号唯一的正常账号仍可登录', () => assertAdmin(run({ users: [admin] })));
test('客户端伪造Id和Phone不能改写认证后回读目标', () => assertAdmin(run({ param: { Id: demo.Id, UserId: demo.Id, Phone: demo.Account } })));
test('空角色补齐后的第二次回读仍按认证Id，不会分配或签发demo身份', () => {
  const r = run({ users: [demo, { ...admin, RoleIds: '[]' }] }); assertAdmin(r);
  const reads = r.calls.filter(c => c.type === 'read' && c.table.toLowerCase() === 'sys_user');
  assert.equal(reads.length, 2); assert.ok(reads.every(c => c.param.Id === admin.Id));
});
test('密码验证失败立即返回，不回读、不补角色、不再次签发Token', () => {
  const r = run({ authResult: { Code: 0, Msg: '账号或密码错误' } });
  assert.equal(r.result.Code, 0); assert.equal(r.result.Msg, '账号或密码错误'); assert.equal(r.calls.length, 1); assert.equal(r.tokens.length, 0); assert.equal(r.updates.length, 0);
});
test('验证结果缺失Id时失败关闭，不能用客户端账号兜底', () => {
  const r = run({ authResult: { Code: 1, Data: { Account: 'admin', Phone: admin.Phone } } });
  assert.equal(r.result.Code, 0); assert.equal(r.calls.length, 1); assert.equal(r.tokens.length, 0); assert.match(r.result.DataAppend.TraceId, /^[a-f0-9]{32}$/);
});
for (const [label, readResult] of [['账号消失', { Code: 2, Data: null }], ['回读查询失败', { Code: 0, Data: null }], ['成功码但缺少数据', { Code: 1, Data: null }], ['回读成另一身份', { Code: 1, Data: demo }]]) {
  test(label + '时不崩溃、不签发其它身份，并保留脱敏追踪日志', () => {
    const r = run({ readResult }); assert.equal(r.result.Code, 0); assert.equal(r.tokens.length, 0); assert.equal(r.updates.length, 0);
    assert.match(r.result.DataAppend.TraceId, /^[a-f0-9]{32}$/);
    assert.equal(r.logs[0].Type, '官网登录身份回读失败'); assert.equal(JSON.parse(r.logs[0].Content).Stage, 'IdentityReadback');
    assert.doesNotMatch(JSON.stringify(r.logs), /test-only-password|test-only-token|shared-phone/);
  });
}
for (const [label, change] of [['已删除', { IsDeleted: 1 }], ['已停用', { State: 0 }]]) {
  test('原生验证后' + label + '的账号不能再次取得官网Token', () => {
    const r = run({ authenticated: admin, users: [{ ...admin, ...change }] }); assert.equal(r.result.Code, 0); assert.equal(r.tokens.length, 0);
  });
}
test('跨租户输入在认证前失败', () => {
  const r = run({ param: { OsClient: 'other-tenant' } }); assert.equal(r.result.Code, 0); assert.equal(r.calls.length, 0);
});
test('短信验证的身份也以验证码原子返回的Id为准', () => {
  const r = run({ param: { LoginType: 'sms', Phone: admin.Phone } }); assertAdmin(r);
  assert.equal(r.calls.find(c => c.type === 'authenticate').key, 'platform_auth_sms_login');
  assert.equal(r.calls.filter(c => c.type === 'read' && c.table.toLowerCase() === 'sys_user').at(-1).param.Id, admin.Id);
});
