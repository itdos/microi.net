import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';

const source = fs.readFileSync(new URL('./mci-ai-data-assistant.js', import.meta.url), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('V8', 'DateNow', source);
const roleId = '01M1TCN4MZ7QD5YCAG4MHPNBY4';
function fixture(options = {}) {
  const models = options.models ?? [{ Id: 'model-current', Name: 'Test model', AiModel: 'test-chat', IsEnable: 1, ApiKey: 'never-expose', Endpoint: 'https://model.example/v1' }];
  const policies = options.policies ?? [];
  const records = options.records ?? [];
  const calls = [];
  const posted = [];
  const domains = ['orders', 'reports'].map((key) => ({
    DomainKey: key, DomainName: key, SourceTable: 'business_' + key,
    Keywords: key, SelectFields: 'Id,OwnerId,Title', SensitiveFields: 'Secret',
    ScopeConfig: JSON.stringify({ selfFields: { generic: 'OwnerId' } }), Enabled: 1
  }));
  let seq = 0;
  const matches = (row, params) => (!params.Id || row.Id === params.Id) && (params._Where || []).every((part) => {
    const p = part[0] === 'AND' ? part.slice(1) : part;
    const [name, op, val] = p;
    if (op === 'In') return val.includes(row[name]);
    if (op === '=') return row[name] === val;
    if (op === '<>') return row[name] !== val;
    if (op === 'Like') return String(row[name] || '').includes(val);
    return true;
  });
  function tableRows(table, params) {
    calls.push({ table, params: structuredClone(params) });
    const data = ({ mic_ai: models, mci_ai_role_policy: policies, mci_ai_data_domain: domains, mic_ai_record: records })[table];
    if (data) return data.filter(x => matches(x, params));
    if (table.startsWith('business_')) return [{ Id: 'row', OwnerId: 'u1', Title: 'private business fixture', Secret: 'masked' }];
    throw new Error('Unexpected table: ' + table);
  }
  const V8 = {
    CurrentUser: options.user ?? { Id: 'u1', Name: 'Test user', RoleIds: [], Level: 0 },
    OsClient: 'test-tenant', SysConfig: { SysTitle: 'Test platform' }, Param: {},
    FormEngine: {
      GetTableData(table, params) { return { Code: 1, Data: tableRows(table, params) }; },
      GetFormData(table, params) { const rows = tableRows(table, params); return { Code: rows.length ? 1 : 2, Data: rows[0] }; },
      GetTableDataCount(table, params) { return { Code: 1, Data: tableRows(table, params).length }; },
      AddFormData(table, row) { assert.equal(table, 'mic_ai_record'); records.push({ ...row }); return { Code: 1, Data: row }; },
      UptFormData(table, row) { assert.equal(table, 'mic_ai_record'); Object.assign(records.find(x => x.Id === row.Id), row); return { Code: 1 }; }
    },
    ApiEngine: { Run(key, payload) { assert.equal(key, 'platform-ai-custom-hook'); assert.deepEqual(Object.keys(payload).sort(), ['Action', 'SourceApiEngineKey', 'Stage']); return { Code: 1 }; } },
    Method: { NewUlid: () => 'fixture' + (++seq) },
    EncryptHelper: { MD5Encrypt: text => crypto.createHash('md5').update(text).digest('hex') },
    Http: {
      async Get() { return { Code: 1, Data: [{ id: 'relay-test' }] }; },
      async Post(params) { posted.push(params); if (options.failModel) throw new Error('secret upstream error'); return { choices: [{ message: { content: '可以，我来帮你整理。' } }] }; }
    }
  };
  return { V8, calls, posted, records, run: async params => { V8.Param = params; return run(V8, () => '2026-09-06 12:00:00'); } };
}
const policy = (overrides = {}) => ({ RoleId: roleId, RoleName: 'Staff', Enabled: 1, DataScope: 'Self', AllowedDomains: 'orders', AllowedModels: 'model-current', ...overrides });
const roleUser = { Id: 'u1', RoleIds: [roleId], Level: 0 };

for (const [name, user] of [['roleless', { Id: 'u1', Level: 0 }], ['customer', { Id: 'u1', RoleName: '客户', Level: 0 }], ['new ULID role', roleUser]]) {
  test(name + ' can bootstrap and really converse without data grants', async () => {
    const f = fixture({ user });
    const boot = await f.run({ Action: 'Bootstrap' });
    assert.equal(boot.Data.Enabled, true); assert.equal(boot.Data.CanQueryData, false);
    assert.equal(boot.Data.Models.length, 1); assert.deepEqual(boot.Data.AllowedDomains, []);
    const result = await f.run({ Action: 'Chat', Question: '帮我整理工作计划', RequestId: 'q1' });
    assert.equal(result.Code, 1); assert.equal(result.Data.UsedAi, true); assert.equal(result.Data.Mode, 'chat');
    assert.equal(f.posted.length, 1); assert.equal(f.calls.some(x => x.table.startsWith('business_')), false);
    assert.ok(!JSON.stringify(boot).includes('never-expose'));
  });
}
test('anonymous callers cannot use models or history', async () => {
  const f = fixture({ user: {} });
  for (const Action of ['Bootstrap', 'Chat', 'History']) assert.equal((await f.run({ Action, Question: '你好' })).Code, 0);
  assert.equal(f.calls.length, 0);
});
for (const flag of [null, undefined, '', 1, true, '1', 'true']) {
  test('default chat flag accepts ' + String(flag), async () => {
    const f = fixture();
    f.V8.FormEngine.GetTableData = ((original) => (table, params) => {
      const result = original(table, params); if (table === 'mic_ai') result.Data.forEach(row => row.AllowAllRolesChat = flag); return result;
    })(f.V8.FormEngine.GetTableData);
    assert.equal((await f.run({ Action: 'Bootstrap' })).Data.ChatEnabled, true);
  });
}
for (const flag of [0, false, '0', 'false', 'unknown']) {
  test('explicit opt-out or invalid chat flag ' + String(flag) + ' requires a policy', async () => {
    const f = fixture({ models: [{ Id: 'restricted', IsEnable: 1, AllowAllRolesChat: flag }] });
    const boot = await f.run({ Action: 'Bootstrap' });
    assert.equal(boot.Data.Enabled, true); assert.equal(boot.Data.ChatEnabled, false);
    assert.equal(boot.Data.UnavailableReason, 'MODEL_UNAVAILABLE');
  });
}
test('stale policy models allow general chat but not business data on an unapproved model', async () => {
  const f = fixture({ user: roleUser, policies: [policy({ AllowedModels: 'old-model' })] });
  const boot = await f.run({ Action: 'Bootstrap' }); assert.equal(boot.Data.CanQueryData, false);
  const result = await f.run({ Action: 'Chat', Question: 'orders 有多少条？', Mode: 'data', RequestId: 'q1', Level: 9999, AllowedDomains: ['orders'] });
  assert.equal(result.Data.Mode, 'chat'); assert.equal(f.calls.some(x => x.table.startsWith('business_')), false);
  assert.ok(!JSON.stringify(f.posted).includes('private business fixture'));
});
test('approved model and ULID role retain Self data scope', async () => {
  const f = fixture({ user: roleUser, policies: [policy()] });
  assert.equal((await f.run({ Action: 'Bootstrap' })).Data.CanQueryData, true);
  const result = await f.run({ Action: 'Chat', Question: 'orders 有多少条', RequestId: 'q1' });
  assert.equal(result.Data.Mode, 'data');
  const reads = f.calls.filter(x => x.table === 'business_orders');
  assert.ok(reads.length > 0); assert.ok(reads.every(x => x.params._Where.some(p => p.includes('OwnerId') && p.includes('u1'))));
  assert.ok(!JSON.stringify(f.posted).includes('masked'));
});
test('All for one domain never widens Self for another domain', async () => {
  const role2 = '10e444cb-f4c4-4e53-91d6-1b9c0c020782';
  const f = fixture({ user: { ...roleUser, RoleIds: [roleId, role2] }, policies: [policy({ DataScope: 'All' }), policy({ RoleId: role2, AllowedDomains: 'reports' })] });
  await f.run({ Action: 'Chat', Question: 'orders reports', RequestId: 'q1' });
  assert.ok(f.calls.filter(x => x.table === 'business_reports').every(x => x.params._Where.some(p => p.includes('OwnerId'))));
  assert.ok(f.calls.filter(x => x.table === 'business_orders').every(x => !x.params._Where.some(p => p.includes('OwnerId'))));
});
test('greetings do not fall back to querying every permitted domain', async () => {
  const f = fixture({ user: roleUser, policies: [policy()] });
  const r = await f.run({ Action: 'Chat', Question: '你好', RequestId: 'q1' });
  assert.equal(r.Data.Mode, 'chat'); assert.equal(f.calls.some(x => x.table.startsWith('business_')), false);
});
test('disabled role data policies do not disable general conversation', async () => {
  const f = fixture({ user: roleUser, policies: [policy({ Enabled: 0 })] });
  const r = await f.run({ Action: 'Bootstrap' }); assert.equal(r.Data.ChatEnabled, true); assert.equal(r.Data.CanQueryData, false);
});
test('model failure is not reported as successful deterministic general chat', async () => {
  const f = fixture({ failModel: true }); const r = await f.run({ Action: 'Chat', Question: '你好', RequestId: 'q1' });
  assert.equal(r.Code, 0); assert.ok(!r.Msg.includes('secret')); assert.ok(!r.Msg.includes('角色'));
});
test('general chat excludes old data-mode context and another user history', async () => {
  const record = (id, user, mode, content) => ({ Id: id, UserId: user, Content: JSON.stringify({ Source: 'mci-ai-data-assistant', ConversationId: 'c1', Mode: mode, Role: 'assistant', Content: content }) });
  const f = fixture({ records: [record('a', 'u1', 'data', 'previous sensitive data'), record('b', 'u2', 'chat', 'other user secret'), record('c', 'u1', 'chat', 'hello history')] });
  await f.run({ Action: 'Chat', Question: '你好', ConversationId: 'c1', RequestId: 'q1' });
  const body = JSON.stringify(f.posted); assert.ok(!body.includes('previous sensitive')); assert.ok(!body.includes('other user')); assert.ok(body.includes('hello history'));
});
test('forged model cannot route to a disabled or unapproved provider', async () => {
  const f = fixture(); const r = await f.run({ Action: 'Chat', Question: '你好', AiModelId: 'forged', RequestId: 'q1', Endpoint: 'https://evil.example' });
  assert.equal(r.Code, 0); assert.equal(f.posted.length, 0);
});
test('media-only models are never selected as default conversation channels', async () => {
  const f = fixture({ models: [{ Id: 'image-channel', IsEnable: 1, AiModel: 'image-only', MediaModels: JSON.stringify([{ Id: 'image-only', Capability: 'image' }]) }] });
  const r = await f.run({ Action: 'Bootstrap' }); assert.equal(r.Data.ChatEnabled, false); assert.deepEqual(r.Data.Models, []);
});
test('packaged default switch and canonical engine retain metadata and source closure', () => {
  const p = JSON.parse(fs.readFileSync(new URL('./app.microi.ai-engine.json', import.meta.url), 'utf8'));
  assert.equal(p.SysApiEngines.find(x => x.ApiEngineKey === 'mci_ai_data_assistant').ApiV8Code, source);
  const engine = p.SysApiEngines.find(x => x.ApiEngineKey === 'mci_ai_data_assistant');
  assert.deepEqual(JSON.parse(engine.ApiRole), ['$authenticated']);
  assert.equal(engine.AllowAnonymous, 0);
  const field = p.DiyFields.find(x => x.TableName === 'mic_ai' && x.Name === 'AllowAllRolesChat');
  assert.equal(field.DefaultValue, '1'); assert.equal(field.Component, 'Switch'); assert.equal(field.Tab, '基础配置');
  assert.ok(p.PhysicalColumns.some(x => x.TABLE_NAME === 'mic_ai' && x.COLUMN_NAME === 'AllowAllRolesChat'));
  assert.ok(p.DDLStatements.find(x => x.TableName === 'mic_ai').DDL.includes('`AllowAllRolesChat`'));
  assert.ok(!p.DataSets.some(x => ['mic_ai', 'mci_ai_role_policy'].includes(x.TableName)));
});
