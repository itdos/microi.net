import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { configurePasswordAuthPackage, passwordAuthReleases } from './configure-official-password-auth-resource.mjs';

const pkg = JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json', import.meta.url)));
const source = key => pkg.SysApiEngines.find(item => item.ApiEngineKey === key)?.ApiV8Code || '';
const phone = '13812345678';
const member = { Id: 'member-id', Account: 'legacy-member', Phone: phone, Name: '普通用户', State: 1, IsDeleted: 0, RoleIds: '[{"Id":"member-role"}]' };

// 夹具只模拟受信认证边界；手机号解析不能签发身份，必须仍使用核心返回的用户 Id。
function login(options = {}) {
  const users = options.users || [member];
  const calls = [], tokenChecks = [], issued = [];
  let authenticatedUser;
  const V8 = {
    OsClient: 'iTdos', Header: options.header || {},
    Param: { Action: 'login', LoginType: 'password', Account: phone, Pwd: 'fixture-only-password', ...options.param },
    TranslateEngine: { GetLang: (key, lang) => `${lang}:${key}` },
    ApiEngine: { Run(key, param) {
      calls.push({ key, param });
      if (options.authResult) return options.authResult;
      const user = users.find(row => row.Account === param.Account || (key === 'platform_auth_sms_login' && row.Phone === param.Phone));
      authenticatedUser = user;
      return user ? { Code: 1, Data: { ...user }, DataAppend: { Token: 'fixture-only-token' } } : { Code: 0, Msg: `${param._Lang}:AccountOrPwdError` };
    } },
    FormEngine: {
      GetFormData(table, param) {
        if (table.toLowerCase() !== 'sys_user') return { Code: 2 };
        if (options.queryFailure && !param.Id) return { Code: 0, Msg: 'private database detail' };
        const row = param.Id ? users.find(item => item.Id === param.Id)
          : users.find(item => (param._Where || []).some(where => item[where.length === 4 ? where[1] : where[0]] === where.at(-1)));
        return row ? { Code: 1, Data: { ...row } } : { Code: 2 };
      },
      GetTableData(table, param) {
        if (options.queryFailure) return { Code: 0, Msg: 'private database detail' };
        const rows = users.filter(item => (param._Where || []).every(where => item[where[0]] === where[2]));
        return { Code: 1, Data: rows.slice(0, param._PageSize || 2), DataCount: rows.length };
      },
      UptFormData: () => ({ Code: 1 })
    },
    Method: {
      SetSysUserRoleInfo: user => ({ ...user }),
      GetAccessToken(param) { issued.push(param.CurrentUser.Id); return { Code: 1, Data: { Token: 'fixture-only-token' } }; },
      GetCurrentToken(token, osClient) {
        tokenChecks.push({ token, osClient });
        return options.revokedAfterAuthentication ? null : { OsClient: osClient, CurrentUser: authenticatedUser, Token: token };
      },
      GetUserTenant: () => ({ Code: 2 }), GetClientIP: () => ({ Data: '' }),
      AddSysLog() {}, NewGuid: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    }
  };
  const result = vm.runInNewContext(`(function(){${source('official_sms_login')}\n})()`, { V8, DateNow: () => '2026-10-26 00:00:00' });
  return { result, calls, issued, tokenChecks };
}

test('历史用户名与手机号不同的账号可以手机号密码登录，身份仍由认证结果确定', () => {
  const result = login({ param: { _Lang: 'zh-CN' } });
  assert.equal(result.result.Code, 1, result.result.Msg);
  assert.equal(result.calls[0].param.Account, member.Account);
  assert.equal(result.calls[0].param._Lang, 'zh-CN');
  assert.deepEqual(result.issued, []);
  assert.equal(result.result.Data.Id, member.Id);
  assert.equal(result.result.DataAppend.Token, 'fixture-only-token');
});

test('手机号形状的精确账号优先，不能误认成另一个人的手机号', () => {
  const exact = { ...member, Id: 'exact-account-id', Account: phone, Phone: '13987654321' };
  const result = login({ users: [member, exact] });
  assert.equal(result.result.Code, 1);
  assert.equal(result.calls[0].param.Account, phone);
  assert.deepEqual(result.issued, []);
  assert.equal(result.result.Data.Id, exact.Id);
});

test('多个账号共用手机号时拒绝别名登录，不选择第一条记录', () => {
  const result = login({ users: [member, { ...member, Id: 'other-id', Account: 'other-member' }], param: { _Lang: 'en' } });
  assert.equal(result.result.Code, 0);
  assert.equal(result.result.Msg, 'en:AccountOrPwdError');
  assert.equal(result.calls.length, 0);
  assert.deepEqual(result.issued, []);
});

test('手机号映射后认证返回不同用户 Id 时失败关闭', () => {
  const other = { ...member, Id: 'other-id', Account: 'other-member', Phone: '13987654321' };
  const result = login({ users: [member, other], authResult: { Code: 1, Data: other }, param: { _Lang: 'en' } });
  assert.equal(result.result.Code, 0);
  assert.equal(result.result.Msg, 'en:AccountOrPwdError');
  assert.deepEqual(result.issued, []);
});

test('手机号查询失败不泄露查询错误或继续认证', () => {
  const result = login({ queryFailure: true, param: { _Lang: 'zh-TW' } });
  assert.equal(result.result.Code, 0);
  assert.equal(result.result.Msg, 'zh-TW:AccountOrPwdError');
  assert.equal(result.calls.length, 0);
});

for (const lang of ['cn', 'en-US', 'zh-TW']) {
  test(`密码登录将请求语言 ${lang} 传到认证内核`, () => {
    const result = login({ param: { Account: member.Account, _Lang: lang } });
    assert.equal(result.result.Code, 1);
    assert.equal(result.calls[0].param._Lang, lang);
  });
  test(`短信登录将请求语言 ${lang} 传到认证内核`, () => {
    const result = login({ param: { LoginType: 'sms', Phone: phone, _Lang: lang } });
    assert.equal(result.result.Code, 1);
    assert.equal(result.calls[0].param._Lang, lang);
  });
}

test('旧客户端没有语言参数时沿用 lang Header 或中文默认', () => {
  assert.equal(login({ param: { Account: member.Account }, header: { lang: 'en-US' } }).calls[0].param._Lang, 'en-US');
  assert.equal(login({ param: { Account: member.Account } }).calls[0].param._Lang, 'cn');
});

test('密码登录保持密码首尾空格，与可信重置原子保持相同输入', () => {
  const result = login({ param: { Account: member.Account, Pwd: ' fixture-only-password ' } });
  assert.equal(result.result.Code, 1);
  assert.equal(result.calls[0].param.Pwd, ' fixture-only-password ');
});

test('内层认证成功后短信重置撤销会话，官网不得重签使旧登录复活', () => {
  const result = login({ revokedAfterAuthentication: true, param: { _Lang: 'en' } });
  assert.equal(result.calls.length, 1, '内层认证确实已完成');
  assert.equal(result.tokenChecks.length, 1, '回读已经撤销的原会话');
  assert.equal(result.result.Code, 0);
  assert.equal(result.result.Msg, 'en:AccountOrPwdError');
  assert.deepEqual(result.issued, [], '禁止包装层新建会话');
});

test('认证结果缺失Token时失败关闭，不通过重新签发填补', () => {
  const result = login({ authResult: { Code: 1, Data: member } });
  assert.equal(result.result.Code, 0);
  assert.deepEqual(result.issued, []);
  assert.equal(result.tokenChecks.length, 0);
});

for (const state of [0, 2, -1, '', null]) {
  test(`用户状态 ${JSON.stringify(state)} 不允许官网签发会话`, () => {
    const result = login({ users: [{ ...member, State: state }] });
    assert.equal(result.result.Code, 0);
    assert.deepEqual(result.issued, []);
  });
}

function reset(param = {}, response = { Code: 1, Msg: 'password changed' }) {
  const calls = [];
  const V8 = {
    OsClient: 'iTdos', Param: param, Header: { lang: 'en-US' },
    TranslateEngine: { GetLang: (key, lang) => `${lang}:${key}` },
    Method: { ResetPlatformSmsPassword(input) { calls.push(input); return response; } },
    FormEngine: new Proxy({}, { get() { throw Error('reset must not write credentials through FormEngine'); } }),
    EncryptHelper: new Proxy({}, { get() { throw Error('reset must not encrypt credentials in V8'); } })
  };
  const result = vm.runInNewContext(`(function(){${source('official_password_reset')}\n})()`, { V8 });
  return { result, calls };
}

test('短信重置委派可信密码原子，保留原始密码与语言且不直接写凭据', () => {
  const result = reset({ Phone: phone, SmsCode: 'fixture-code', NewPassword: ' fixture-password ', ConfirmPassword: ' fixture-password ', _Lang: 'zh-TW' });
  assert.equal(result.result?.Code, 1);
  assert.equal(result.calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.calls[0])), { Phone: phone, SmsCode: 'fixture-code', NewPassword: ' fixture-password ', ConfirmPassword: ' fixture-password ', _Lang: 'zh-TW' });
});

test('短信重置兼容旧参数并按后端原样返回验证码拒绝', () => {
  const response = { Code: 0, Msg: 'SMS code expired', Data: null };
  const result = reset({ Phone: phone, _SmsCaptchaValue: 'fixture-code', Pwd: 'fixture-password', ConfirmPwd: 'fixture-password' }, response);
  assert.equal(result.result, response);
  assert.equal(result.calls[0]._Lang, 'en-US');
  assert.equal(result.calls[0].NewPassword, 'fixture-password');
});

test('短信重置拒绝客户端指定其它租户，不调用密码原子', () => {
  const result = reset({ OsClient: 'other-tenant', Phone: phone });
  assert.equal(result.result?.Code, 0);
  assert.equal(result.calls.length, 0);
});

test('短信重置只由 SaaS 包以 Managed 资源交付', () => {
  const engine = pkg.SysApiEngines.find(item => item.ApiEngineKey === 'official_password_reset');
  assert.ok(engine, '必须交付官方短信重置接口');
  assert.equal(engine.AllowAnonymous, 1);
  assert.equal(engine.StopHttp, 0);
  assert.equal(engine.EnableLog, 0);
  assert.deepEqual(pkg.ResourcePolicies.ApiEngines.official_password_reset, { Ownership: 'Platform', UpgradePolicy: 'Managed' });
  const owners = fs.readdirSync(import.meta.dirname).filter(file => /^app\..+\.json$/.test(file)).filter(file => {
    const text = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    return text.includes('official_password_reset') && JSON.parse(text).SysApiEngines?.some(item => item.ApiEngineKey === 'official_password_reset');
  });
  assert.deepEqual(owners, ['app.microi.saas-engine.json']);
});

function platformSms(options = {}) {
  const calls = [];
  const record = (name, response) => input => { calls.push({ name, input }); return response; };
  const V8 = {
    OsClient: 'iTdos', Param: { Phone: phone, Pwd: ' fixture-password ', _CaptchaValue: 'fixture-code', _Lang: 'en-US' }, Header: {},
    FormEngine: { GetFormData: () => options.user ? { Code: 1, Data: options.user } : { Code: 2 } },
    Method: {
      CreatePlatformSmsProof: record('proof', { Code: 1, Data: 'fixture-proof' }),
      CreatePlatformSmsUser: record('create', { Code: 1, Data: member }),
      CompletePlatformSmsLogin: record('login', { Code: 1, Data: member })
    },
    ApiEngine: { Run: () => ({ Code: 1 }) }
  };
  return { result: vm.runInNewContext(`(function(){${source('platform_auth_sms_login')}\n})()`, { V8, DateNow: () => '2026-10-26 00:00:00' }), calls };
}

test('短信注册的下一层编排也保持原始密码，并向三个可信原子继续传递语言', () => {
  const result = platformSms();
  assert.equal(result.result.Code, 1);
  assert.deepEqual(result.calls.map(call => call.name), ['proof', 'create', 'login']);
  assert.equal(result.calls.find(call => call.name === 'create').input.Password, ' fixture-password ');
  assert.ok(result.calls.every(call => call.input._Lang === 'en-US'));
});

test('直接短信登录也拒绝历史State=2，不恢复资料或调用签发原子', () => {
  const result = platformSms({ user: { ...member, State: 2 } });
  assert.equal(result.result.Code, 0);
  assert.deepEqual(result.calls.map(call => call.name), ['proof']);
});

const userPackage = JSON.parse(fs.readFileSync(new URL('./app.microi.sys_user.json', import.meta.url)));
const adminSource = userPackage.SysApiEngines.find(item => item.ApiEngineKey === 'platform-sys-user-admin').ApiV8Code;
function repair(param, response = { Code: 0, Msg: 'administrator required' }) {
  const calls = [];
  const V8 = {
    Param: { Action: 'RepairPasswordEncoding', ...param }, Header: {}, CurrentUser: null,
    ApiEngine: { Run() { throw Error('password encoding repair must not call a tenant hook'); } },
    Method: {
      ManageSysUserAdmin() { throw Error('repair must use its dedicated trusted primitive'); },
      RepairPlatformPasswordEncoding(input) { calls.push(input); return response; }
    }
  };
  return { result: vm.runInNewContext(`(function(){${adminSource}\n})()`, { V8 }), calls };
}

test('管理员修复默认只读预览，仅透传限定参数给可信原子，不触发租户Hook', () => {
  const outcome = { Code: 1, Data: [{ Id: 'fixture-user', Classification: 'EncodingMismatch', WillRepair: true }] };
  const result = repair({ UserIds: ['fixture-user'], _Lang: 'en', Pwd: 'never-forward-this', OsClient: 'other' }, outcome);
  assert.equal(result.result, outcome);
  assert.deepEqual(JSON.parse(JSON.stringify(result.calls[0])), { UserIds: ['fixture-user'], DryRun: true, _Lang: 'en' });
});

test('管理员修复写入必须显式DryRun=false，可信鉴权拒绝原样返回', () => {
  const response = { Code: 1002, Msg: 'administrator required' };
  const result = repair({ UserIds: ['fixture-user'], DryRun: false, ConfirmExecution: 'REPAIR_PASSWORD_ENCODING', _Lang: 'zh-CN' }, response);
  assert.equal(result.result, response);
  assert.equal(result.calls[0].DryRun, false);
  assert.equal(result.calls[0].ConfirmExecution, 'REPAIR_PASSWORD_ENCODING');
  assert.equal(repair({ DryRun: 'false' }).calls[0].DryRun, true);
});

for (const release of passwordAuthReleases) {
  test(`${release.file}定向生成幂等并保留所有无关资源`, () => {
    const input = structuredClone(release.file.includes('saas-engine') ? pkg : userPackage);
    input.PackageInfo.Version = release.previous;
    input.PackageInfo.ServerMinVersion = '8.7.3';
    input.TenantFixture = { setting: 'preserve', rows: [1, 2] };
    input.SysApiEngines.push({ ApiEngineKey: 'fixture_unrelated_hook', ApiV8Code: 'return {Code:1};', Version: 'v9.0.0' });
    const before = structuredClone(input);
    const sources = Object.fromEntries(release.engines.map(spec => [spec.key, spec.key === 'platform-sys-user-admin' ? adminSource : source(spec.key)]));
    const generated = configurePasswordAuthPackage(input, release, sources);
    assert.deepEqual(input, before, '不得修改调用方持有的包对象');
    assert.deepEqual(configurePasswordAuthPackage(generated, release, sources), generated, '重复执行应完全幂等');
    for (const key of Object.keys(before).filter(key => !['PackageInfo', 'SysApiEngines', 'ResourcePolicies'].includes(key))) assert.deepEqual(generated[key], before[key], key);
    const owned = new Set(release.engines.map(spec => spec.key));
    assert.deepEqual(generated.SysApiEngines.filter(item => !owned.has(item.ApiEngineKey)), before.SysApiEngines.filter(item => !owned.has(item.ApiEngineKey)));
    for (const spec of release.engines) {
      const oldEngine = before.SysApiEngines.find(item => item.ApiEngineKey === spec.key);
      const newEngine = generated.SysApiEngines.find(item => item.ApiEngineKey === spec.key);
      for (const key of Object.keys(oldEngine).filter(key => !['ApiV8Code', 'Version', 'UpdateTime', 'ChangeHistory'].includes(key))) assert.deepEqual(newEngine[key], oldEngine[key], `${spec.key}.${key}`);
    }
    assert.equal(generated.PackageInfo.ServerMinVersion, '8.7.4');
    const newerPrerequisite = structuredClone(input);
    newerPrerequisite.PackageInfo.ServerMinVersion = '8.8.1';
    assert.equal(configurePasswordAuthPackage(newerPrerequisite, release, sources).PackageInfo.ServerMinVersion, '8.8.1');
    assert.ok(release.capabilities.every(item => generated.PackageInfo.RequiredPlatformCapabilities.includes(item)));
    before.PackageInfo.Version = 'v99.0.0';
    assert.throws(() => configurePasswordAuthPackage(before, release, sources), /版本已变化/);
  });
}
