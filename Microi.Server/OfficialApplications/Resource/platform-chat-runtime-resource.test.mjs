import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const resourceDir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(resourceDir, 'platform-chat-runtime.js'), 'utf8');
const execute = new Function('V8', 'System', source);
const deterministicSystem = {
  DateTime: {
    Now: {
      ToString(format) {
        return format === 'yyyy' ? '2026' : '2026-08-25 12:00:00';
      },
    },
  },
};

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function matches(row, where) {
  return (where || []).every((condition) => {
    const offset = condition.length >= 4 ? 1 : 0;
    const field = condition[offset];
    const op = String(condition[offset + 1] || '=').toUpperCase();
    const value = condition[offset + 2];
    if (op === '=' || op === 'EQ') return row[field] === value;
    if (op === '<>' || op === '!=' || op === 'NE') return row[field] !== value;
    if (op === 'IN') return value.includes(row[field]);
    throw new Error(`unsupported mock operator ${op}`);
  });
}

export function createRuntime({
  currentUser = { Id: 'user-1', Name: 'User One', Account: 'u1', Avatar: 'a1.png' },
  osClient = 'tenant-a',
  hook = () => ({ Code: 1 }),
  protocol = () => ({ Code: 1 }),
  failGetTableData = () => null,
  seedMessages = [],
  seedContacts = [],
  system = deterministicSystem,
} = {}) {
  const collections = new Map();
  const calls = [];
  const hooks = [];
  let protocolConsumes = 0;
  const collection = (table) => {
    if (!collections.has(table)) collections.set(table, new Map());
    return collections.get(table);
  };
  for (const row of seedMessages) collection('chat_2026').set(row.MessageId, clone({ ...row, _id: row.MessageId }));
  for (const row of seedContacts) collection('chat_last_contact').set(row.Id, clone({ ...row, _id: row.Id }));

  const mongo = {
    GetPartitionedTableData(request) {
      calls.push(['GetPartitionedTableData',clone(request)]);
      const scope=JSON.stringify([osClient,request._WhereAny||request._Where]);
      const cursor=request.Cursor?JSON.parse(request.Cursor):null;
      if(cursor&&cursor.scope!==scope)return {Code:0,Msg:'游标不属于当前查询'};
      let rows=[];
      for(const [name,items] of collections){
        if(!/^chat_\d{4}(?:\d{2})?$/.test(name))continue;
        for(const row of items.values())if(request._WhereAny?request._WhereAny.some(where=>matches(row,where)):matches(row,request._Where))
          rows.push({...clone(row),_PartitionDb:'diy_chat_'+osClient,_PartitionTable:name});
      }
      rows.sort((a,b)=>String(b.CreateTime).localeCompare(String(a.CreateTime))||String(b._id).localeCompare(String(a._id)));
      rows=[...new Map(rows.map(row=>[row._id,row])).values()];
      if(request.CountOnly)return {Code:1,Data:{Count:rows.length}};
      if(cursor)rows=rows.filter(row=>row.CreateTime<cursor.t||row.CreateTime===cursor.t&&row._id<cursor.id);
      const selected=rows.slice(0,request.PageSize),last=selected.at(-1);
      return {Code:1,Data:{Rows:selected,HasMore:rows.length>request.PageSize,NextCursor:last?JSON.stringify({scope,t:last.CreateTime,id:last._id}):''}};
    },
    GetFormData(request) {
      calls.push(['GetFormData', clone(request)]);
      const row = collection(request.TableName).get(request.Id);
      return row ? { Code: 1, Data: clone(row) } : { Code: 1, Data: null };
    },
    AddFormData(request) {
      calls.push(['AddFormData', clone(request)]);
      const rows = collection(request.TableName);
      if (rows.has(request.Id)) return { Code: 0, Msg: 'duplicate key' };
      const row = clone({ ...request._FormData, _id: request.Id, CreateTime: request.OccurredAt || system.DateTime.Now.ToString('yyyy-MM-dd HH:mm:ss') });
      rows.set(request.Id, row);
      return { Code: 1, Data: clone(row) };
    },
    UptFormData(request) {
      calls.push(['UptFormData', clone(request)]);
      const rows = collection(request.TableName);
      const row = rows.get(request.Id);
      if (!row) return { Code: 0, Msg: 'not found' };
      Object.assign(row, clone(request._FormData));
      return { Code: 1, Data: clone(row) };
    },
    DelFormData(request) {
      calls.push(['DelFormData', clone(request)]);
      collection(request.TableName).delete(request.Id);
      return { Code: 1 };
    },
    GetTableData(request) {
      calls.push(['GetTableData', clone(request)]);
      const forcedFailure = failGetTableData(request, calls);
      if (forcedFailure) return clone(forcedFailure);
      let rows = [...collection(request.TableName).values()].filter((row) => matches(row, request._Where));
      const direction = String(request._OrderByType || 'DESC').toUpperCase() === 'ASC' ? 1 : -1;
      const field = request._OrderBy || 'CreateTime';
      rows.sort((left, right) => String(left[field] || '').localeCompare(String(right[field] || '')) * direction);
      const count = rows.length;
      const pageIndex = Number(request._PageIndex || 1);
      const pageSize = Number(request._PageSize || request._Top || 1000);
      rows = rows.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);
      return { Code: 1, Data: clone(rows), DataCount: count };
    },
    UptFormDataByWhere(request) {
      calls.push(['UptFormDataByWhere', clone(request)]);
      let modified = 0;
      for (const row of collection(request.TableName).values()) {
        if (!matches(row, request._Where)) continue;
        Object.assign(row, clone(request._FormData));
        modified++;
      }
      return { Code: 1, Data: { ModifiedCount: modified } };
    },
    DelFormDataByWhere(request) {
      calls.push(['DelFormDataByWhere', clone(request)]);
      const rows = collection(request.TableName);
      let deleted = 0;
      for (const [id, row] of [...rows.entries()]) {
        if (!matches(row, request._Where)) continue;
        rows.delete(id);
        deleted++;
      }
      return { Code: 1, Data: { DeletedCount: deleted } };
    },
  };

  const users = {
    'user-1': { Id: 'user-1', Name: 'User One', Account: 'u1', Avatar: 'a1.png' },
    'user-2': { Id: 'user-2', Name: 'Authoritative Two', Account: 'u2', Avatar: 'a2.png', State: 1 },
    'user-3': { Id: 'user-3', Name: 'User Three', Account: 'u3', Avatar: 'a3.png', State: 1 },
  };
  const formEngine = {
    GetFormData: (_table, request) => users[request.Id]
      ? { Code: 1, Data: clone(users[request.Id]) }
      : { Code: 2 },
    GetTableData: (_table, request) => ({
      Code: 1,
      Data: (request.Ids || []).map((id) => users[id]).filter(Boolean).map(clone),
    }),
  };
  const v8 = {
    Param: {},
    OsClient: osClient,
    CurrentUser: currentUser,
    DbTrans: { id: 'shared' },
    MongoDb: mongo,
    FormEngine: formEngine,
    EncryptHelper: { Sha256Hex: sha256 },
    Method: {
      RequireManagedProtocolContext() {
        protocolConsumes++;
        return protocol(protocolConsumes);
      },
    },
    ApiEngine: {
      Run(key, payload, transaction) {
        hooks.push({ key, payload: clone(payload), transaction });
        return hook(hooks.length, key, payload);
      },
    },
  };
  return {
    v8,
    calls,
    hooks,
    get messages() { return new Map([...collections].filter(([name]) => /^chat_\d{4}(?:\d{2})?$/.test(name)).flatMap(([,rows]) => [...rows])); },
    contacts: collection('chat_last_contact'),
    collection,
    get protocolConsumes() { return protocolConsumes; },
    run(param) {
      v8.Param = param;
      return execute(v8, system);
    },
  };
}

test('missing identity fails closed before MongoDB or tenant hook access', () => {
  const runtime = createRuntime({ currentUser: null });
  const result = runtime.run({ Action: 'ListContacts', OsClient: 'forged' });
  assert.equal(result.Code, 1001);
  assert.equal(runtime.calls.length, 0);
  assert.equal(runtime.hooks.length, 0);
});

test('Client invocation requires and consumes the one-time SignalR host protocol context', () => {
  const denied = createRuntime({ protocol: () => ({ Code: 0, Msg: 'missing host context' }) });
  const deniedResult = denied.run({ Action: 'ListContacts', _InvokeType: 'Client' });
  assert.deepEqual(deniedResult, { Code: 0, Msg: 'missing host context' });
  assert.equal(denied.protocolConsumes, 1);
  assert.equal(denied.calls.length, 0);
  assert.equal(denied.hooks.length, 0);

  const allowed = createRuntime();
  const allowedResult = allowed.run({ Action: 'ListContacts', _InvokeType: 'Client' });
  assert.equal(allowedResult.Code, 1);
  assert.equal(allowed.protocolConsumes, 1);

  const nested = createRuntime({ protocol: () => ({ Code: 0, Msg: 'must not be consumed' }) });
  const nestedResult = nested.run({ Action: 'ListContacts', _InvokeType: 'Server' });
  assert.equal(nestedResult.Code, 1);
  assert.equal(nested.protocolConsumes, 0);
});

test('PersistMessage binds actor and tenant, is idempotent, and keeps hooks content-free', () => {
  const runtime = createRuntime();
  const request = {
    Action: 'PersistMessage', RequestId: 'request-1', ToUserId: 'user-2',
    Content: 'private message body', Type: 'text', OsClient: 'forged-tenant',
    FromUserId: 'forged-user', ToUserName: 'forged-name', Token: 'secret-token',
  };
  const first = runtime.run(request);
  assert.equal(first.Code, 1);
  assert.equal(first.Data.Message.FromUserId, 'user-1');
  assert.equal(first.Data.Message.ToUserName, 'Authoritative Two');
  assert.equal(first.DataAppend.StorageCommitted, true);
  assert.equal(first.DataAppend.DeliveryPending, true);
  assert.equal(first.DataAppend.Duplicate, false);
  assert.equal(runtime.messages.size, 1);
  assert.ok(runtime.calls.every(([, payload]) => payload.OsClient === 'tenant-a'));
  assert.equal(runtime.hooks.length, 2);
  assert.ok(runtime.hooks.every(({ key, transaction }) => key === 'platform-message-notification-custom-hook'
    && transaction === runtime.v8.DbTrans));
  assert.doesNotMatch(JSON.stringify(runtime.hooks), /private message body|secret-token|Content|Token/i);

  const second = runtime.run(request);
  assert.equal(second.Code, 1);
  assert.equal(second.DataAppend.Duplicate, true);
  assert.equal(runtime.messages.size, 1);
  assert.equal(second.Data.Message.MessageId, first.Data.Message.MessageId);

  const conflict = runtime.run({ ...request, Content: 'different body' });
  assert.equal(conflict.Code, 0);
  assert.match(conflict.Msg, /RequestId/);
  assert.equal(runtime.messages.size, 1);
});

test('invalid and non-admin system actions fail before tenant hook or persistence', () => {
  const runtime = createRuntime();
  const unsupported = runtime.run({ Action: 'ForgedAction' });
  assert.equal(unsupported.Code, 0);
  assert.equal(runtime.hooks.length, 0);
  assert.equal(runtime.calls.length, 0);

  const system = runtime.run({
    Action: 'PersistSystemMessage', RequestId: 'system-1', ToUserId: 'user-2', Content: 'forged',
  });
  assert.equal(system.Code, 0);
  assert.match(system.Msg, /超级管理员/);
  assert.equal(runtime.hooks.length, 0);
  assert.equal(runtime.calls.length, 0);
});

test('invalid pagination is bounded to stable defaults', () => {
  const runtime = createRuntime();
  const result = runtime.run({ Action: 'ListContacts', PageIndex: 'NaN', PageSize: 'Infinity' });
  assert.equal(result.Code, 1);
  const list = runtime.calls.find(([name, request]) => name === 'GetTableData'
    && request.TableName === 'chat_last_contact');
  assert.equal(list[1]._PageIndex, 1);
  assert.equal(list[1]._PageSize, 20);
});

test('before hook denial prevents persistence while after hook failure keeps committed success', () => {
  const denied = createRuntime({ hook: () => ({ Code: 0, Msg: 'tenant denied' }) });
  const deniedResult = denied.run({
    Action: 'PersistMessage', RequestId: 'request-denied', ToUserId: 'user-2', Content: 'blocked',
  });
  assert.deepEqual(deniedResult, { Code: 0, Msg: 'tenant denied' });
  assert.equal(denied.messages.size, 0);

  const warning = createRuntime({ hook: (index) => index === 1 ? { Code: 1 } : { Code: 0, Msg: 'after failed' } });
  const warningResult = warning.run({
    Action: 'PersistMessage', RequestId: 'request-warning', ToUserId: 'user-2', Content: 'committed',
  });
  assert.equal(warningResult.Code, 1);
  assert.equal(warningResult.DataAppend.StorageCommitted, true);
  assert.equal(warningResult.DataAppend.HookWarning, 'after failed');
  assert.equal(warning.messages.size, 1);
});

test('history marks only authoritative incoming peer messages read', () => {
  const runtime = createRuntime({
    seedMessages: [
      { MessageId: 'a'.repeat(24), RequestId: 'a', FromUserId: 'user-2', ToUserId: 'user-1', Content: 'in', Type: 'text', IsRead: false, CreateTime: '2026-08-25 10:00:00' },
      { MessageId: 'b'.repeat(24), RequestId: 'b', FromUserId: 'user-1', ToUserId: 'user-2', Content: 'out', Type: 'text', IsRead: false, CreateTime: '2026-08-25 11:00:00' },
      { MessageId: 'c'.repeat(24), RequestId: 'c', FromUserId: 'user-3', ToUserId: 'user-1', Content: 'other', Type: 'text', IsRead: false, CreateTime: '2026-08-25 09:00:00' },
    ],
  });
  const result = runtime.run({
    Action: 'GetHistoryAndMarkRead', PeerUserId: 'user-2', PageIndex: 1, PageSize: 20,
  });
  assert.equal(result.Code, 1);
  assert.deepEqual(result.Data.Messages.map((item) => item.Content), ['in', 'out']);
  assert.equal(runtime.messages.get('a'.repeat(24)).IsRead, true);
  assert.equal(runtime.messages.get('b'.repeat(24)).IsRead, false);
  assert.equal(runtime.messages.get('c'.repeat(24)).IsRead, false);
  const marked = runtime.calls.filter(([name,request]) => name === 'UptFormData' && request.TableName === 'chat_2026');
  assert.deepEqual(marked.map(([,request])=>request.Id),['a'.repeat(24)]);
});

test('DeleteContact can delete only the current actor contact edge', () => {
  const runtime = createRuntime({
    seedContacts: [
      { Id: '1'.repeat(24), UserId: 'user-1', ContactUserId: 'user-2', UpdateTime: '2026-08-25 10:00:00' },
      { Id: '2'.repeat(24), UserId: 'user-3', ContactUserId: 'user-2', UpdateTime: '2026-08-25 10:00:00' },
    ],
  });
  const result = runtime.run({ Action: 'DeleteContact', PeerUserId: 'user-2', UserId: 'user-3' });
  assert.equal(result.Code, 1);
  assert.equal(runtime.contacts.has('1'.repeat(24)), false);
  assert.equal(runtime.contacts.has('2'.repeat(24)), true);
  const bulk = runtime.calls.find(([name]) => name === 'DelFormDataByWhere');
  assert.deepEqual(bulk[1]._Where, [
    ['UserId', '=', 'user-1'], ['ContactUserId', '=', 'user-2'],
  ]);
});

test('post-delete projection failure returns committed success with a warning', () => {
  const runtime = createRuntime({
    seedContacts: [
      { Id: '1'.repeat(24), UserId: 'user-1', ContactUserId: 'user-2', UpdateTime: '2026-08-25 10:00:00' },
    ],
    failGetTableData: (request) => request.TableName === 'chat_last_contact'
      ? { Code: 0, Msg: 'projection unavailable' }
      : null,
  });
  const result = runtime.run({ Action: 'DeleteContact', PeerUserId: 'user-2' });
  assert.equal(result.Code, 1);
  assert.equal(result.DataAppend.StorageCommitted, true);
  assert.deepEqual(result.DataAppend.ProjectionWarnings, ['projection unavailable']);
  assert.equal(runtime.contacts.has('1'.repeat(24)), false);
});

test('source contract uses exact deterministic ids and never trusts Param actor or tenant', () => {
  assert.match(source, /PLATFORM_CHAT_LOCAL_TIME_V1/);
  assert.match(source, /function nowText\(format\)/);
  assert.doesNotMatch(source, /\bDateNow\s*\(/);
  assert.match(source, /messageIdFor\(requestId\)/);
  assert.match(source, /Sha256Hex\('chat-message\|'/);
  assert.match(source, /if \(!V8\.CurrentUser \|\| !V8\.CurrentUser\.Id \|\| !V8\.OsClient\)/);
  assert.match(source, /V8\.MongoDb\.GetPartitionedTableData/);
  assert.match(source, /DbName:readRow\._PartitionDb/);
  assert.match(source, /V8\.MongoDb\.DelFormDataByWhere/);
  assert.doesNotMatch(source, /param\.(?:OsClient|FromUserId|UserId)\b/);
});

// PLATFORM_CHAT_NATIVE_MISSING_REGRESSIONS
// 缺失、失败、未知 ACK 和重复请求必须分别验证，避免模拟器再次掩盖真实 Mongo 契约。
const pointer='chat_message_location';
const input={Action:'PersistMessage',RequestId:'owned-null-contract',ToUserId:'user-2',Content:'独立测试消息'};
const isBody=r=>/^chat_\d{6}$/.test(r.TableName);
const writes=h=>h.calls.filter(([name,r])=>name==='AddFormData'&&(r.TableName===pointer||isBody(r)));

test('首次创建指针及正文，完整回读才确认；身份与年度库月集合绑定',()=>{
  const h=createRuntime(),r=h.run({...input,FromUserId:'forged',OsClient:'forged'});
  assert.equal(r.Code,1);assert.equal(r.DataAppend.StorageCommitted,true);
  assert.equal(writes(h).length,2);assert.equal(h.messages.size,1);
  const body=writes(h).find(([,r])=>isBody(r))[1];
  assert.equal(body.DbName,'diy_chat_tenant-a_2026');assert.equal(body.TableName,'chat_202608');
  assert.equal(body.OccurredAt,'2026-08-25 12:00:00');assert.equal(body._FormData.FromUserId,'user-1');
  assert.ok(h.calls.every(([,r])=>r.OsClient==='tenant-a'));
});

test('同 RequestId 重放不重建指针或正文；冲突内容与收件人不能覆盖',()=>{
  const h=createRuntime(),first=h.run(input),body=JSON.stringify([...h.messages]),count=writes(h).length;
  const replay=h.run(input);assert.equal(replay.Code,1);assert.equal(replay.DataAppend.Duplicate,true);
  assert.equal(first.Data.Message.MessageId,replay.Data.Message.MessageId);assert.equal(writes(h).length,count);
  for(const delta of [{Content:'不同内容'},{ToUserId:'user-3'}]){
    const bad=h.run({...input,...delta});assert.equal(bad.Code,0);assert.match(bad.Msg,/RequestId/);
    assert.equal(JSON.stringify([...h.messages]),body);assert.equal(writes(h).length,count);
  }
});

test('旧 Code2 无正文仍兼容；Code1 不带 Data 不是可信不存在',()=>{
  const legacy=createRuntime(),get=legacy.v8.MongoDb.GetFormData;
  legacy.v8.MongoDb.GetFormData=r=>{const v=get(r);return v.Code===1&&v.Data===null?{Code:2}:v};
  assert.equal(legacy.run(input).Code,1);
  const broken=createRuntime();broken.v8.MongoDb.GetFormData=()=>({Code:1});
  assert.equal(broken.run(input).Code,0);assert.equal(writes(broken).length,0);
});

for(const location of ['pointer','legacy','body'])for(const outcome of ['failed','absent-response','malformed-success']){
  test(`${location} 读取 ${outcome} 必须停止，不能误判为缺失并新增`,()=>{
    const h=createRuntime(),get=h.v8.MongoDb.GetFormData;
    h.v8.MongoDb.GetFormData=r=>{
      const selected=location==='pointer'?r.TableName===pointer:location==='legacy'?r.TableName==='chat_2026':isBody(r);
      return selected?(outcome==='failed'?{Code:0,Data:null,Msg:'测试读取失败'}:outcome==='absent-response'?null:{Code:1}):get(r);
    };
    assert.equal(h.run(input).Code,0);
    assert.equal(writes(h).filter(([,r])=>isBody(r)).length,0);
    assert.equal(writes(h).filter(([,r])=>r.TableName===pointer).length,location==='body'?1:0);
  });
}

for(const location of ['pointer','body'])for(const outcome of ['ack-error','ack-throw']){
  test(`${location} 写入成功但 ${outcome}：仅固定 Id 回读确认，不重发`,()=>{
    const h=createRuntime(),add=h.v8.MongoDb.AddFormData;
    h.v8.MongoDb.AddFormData=r=>{
      const result=add(r),selected=location==='pointer'?r.TableName===pointer:isBody(r);
      if(selected){if(outcome==='ack-throw')throw Error('测试丢失 ACK');return{Code:0,Msg:'测试丢失 ACK'}}return result;
    };
    const result=h.run(input);assert.equal(result.Code,1);assert.equal(h.messages.size,1);assert.equal(writes(h).length,2);
    assert.equal(h.run(input).Code,1);assert.equal(writes(h).length,2);
  });
}

for(const location of ['pointer','body'])test(`${location} 写入结果未知且未提交，不确认成功；相同请求后续可恢复`,()=>{
  const h=createRuntime(),add=h.v8.MongoDb.AddFormData;let interrupted=false,attempts=0;
  h.v8.MongoDb.AddFormData=r=>{
    if((location==='pointer'?r.TableName===pointer:isBody(r))&&!interrupted){attempts++;interrupted=true;throw Error('测试未知写入')}
    return add(r);
  };
  assert.equal(h.run(input).Code,0);assert.equal(attempts,1);assert.equal(h.messages.size,0);
  assert.equal(h.run(input).Code,1);assert.equal(h.messages.size,1);assert.equal(h.collection(pointer).size,1);
});

test('指针已写但回读失败，跨年重试沿用原指针和发生时间，不生成次月消息',()=>{
  let time='2026-12-31 23:59:59',block=true,created=false;
  const h=createRuntime({system:{DateTime:{Now:{ToString:f=>f==='yyyy'?time.slice(0,4):time}}}});
  const add=h.v8.MongoDb.AddFormData,get=h.v8.MongoDb.GetFormData;
  h.v8.MongoDb.AddFormData=r=>{const v=add(r);if(r.TableName===pointer)created=true;return v};
  h.v8.MongoDb.GetFormData=r=>r.TableName===pointer&&created&&block?{Code:0,Data:null}:get(r);
  assert.equal(h.run(input).Code,0);assert.equal(h.messages.size,0);
  block=false;time='2027-01-01 00:00:01';assert.equal(h.run(input).Code,1);
  const body=writes(h).filter(([,r])=>isBody(r));assert.equal(body.length,1);
  assert.equal(body[0][1].TableName,'chat_202612');assert.equal(body[0][1].OccurredAt,'2026-12-31 23:59:59');
  assert.equal(h.collection('chat_202701').size,0);
});

test('正文已写但回读失败，恢复后重放只回读一次消息事实',()=>{
  const h=createRuntime(),add=h.v8.MongoDb.AddFormData,get=h.v8.MongoDb.GetFormData;let written=false,blocked=true;
  h.v8.MongoDb.AddFormData=r=>{const v=add(r);if(isBody(r))written=true;return v};
  h.v8.MongoDb.GetFormData=r=>isBody(r)&&written&&blocked?{Code:0,Data:null}:get(r);
  assert.equal(h.run(input).Code,0);assert.equal(h.messages.size,1);const count=writes(h).length;
  blocked=false;const replay=h.run(input);assert.equal(replay.Code,1);assert.equal(replay.DataAppend.Duplicate,true);
  assert.equal(writes(h).length,count);assert.equal(h.messages.size,1);
});

test('并发占用相同指针 Id 的不同摘要必须拒绝，不能新增或覆盖正文',()=>{
  const h=createRuntime(),add=h.v8.MongoDb.AddFormData;
  h.v8.MongoDb.AddFormData=r=>r.TableName===pointer?add({...r,_FormData:{...r._FormData,PayloadHash:'other'}}):add(r);
  assert.equal(h.run(input).Code,0);assert.equal(h.messages.size,0);assert.equal(h.collection(pointer).size,1);
  assert.equal([...h.collection(pointer).values()][0].PayloadHash,'other');
});
