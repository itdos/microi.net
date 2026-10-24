import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {RESOURCE_INSTALL_TIMEOUT_MS, waitForResourceTask} from './resource-task-wait.mjs';

const TASK_ID = 'a'.repeat(32);
function clock() {
  let milliseconds = 0;
  return {
    now: () => milliseconds,
    sleep: async amount => { milliseconds += amount; },
    advance: amount => { milliseconds += amount; }
  };
}

test('a real task may exceed ten minutes and succeed inside the fixed thirty-minute window', async () => {
  const time = clock(), reads = [];
  const detail = {Code: 1, Data: {Id: TASK_ID, Status: 'Succeeded', Result: {Code: 1}}};
  const result = await waitForResourceTask(TASK_ID, {
    ...time,
    readStatus: async id => { reads.push(['Status', id]); return {Id: id, Status: time.now() >= 12 * 60_000 ? 'Succeeded' : 'Running'}; },
    readDetail: async id => { reads.push(['Detail', id]); return detail; }
  });
  assert.equal(time.now(), 12 * 60_000);
  assert.equal(result.status.Status, 'Succeeded');
  assert.equal(result.detail, detail);
  assert.ok(reads.every(([, id]) => id === TASK_ID));
  assert.equal(reads.filter(([action]) => action === 'Detail').length, 1);
});

test('deadline returns the last observed pending state and obtains genuine Detail without inventing success', async () => {
  const time = clock(), statuses = [];
  const detail = {Code: 1, Data: {Id: TASK_ID, Status: 'Pending', Progress: 64}};
  const result = await waitForResourceTask(TASK_ID, {
    ...time,
    readStatus: async id => { const state = {Id: id, Status: 'Pending', Progress: 64}; statuses.push(state); return state; },
    readDetail: async id => { assert.equal(id, TASK_ID); return detail; }
  });
  assert.equal(time.now(), 30 * 60_000);
  assert.equal(RESOURCE_INSTALL_TIMEOUT_MS, 30 * 60_000);
  assert.equal(statuses.length, 900);
  assert.equal(result.status, statuses.at(-1));
  assert.equal(result.status.Status, 'Pending');
  assert.equal(result.detail, detail);
});

test('time spent reading and reporting progress never resets the total deadline', async () => {
  const time = clock(); let reads = 0;
  const result = await waitForResourceTask(TASK_ID, {
    ...time,
    readStatus: async id => { reads++; time.advance(1000); return {Id: id, Status: 'Running', Progress: reads % 100}; },
    readDetail: async id => ({Code: 1, Data: {Id: id, Status: 'Running'}})
  });
  assert.equal(time.now(), RESOURCE_INSTALL_TIMEOUT_MS);
  assert.equal(reads, 600);
  assert.equal(result.status.Status, 'Running');
});

for (const status of ['Failed', 'Canceled']) {
  test(status + ' stops immediately and reads Detail exactly once', async () => {
    const reads = [], time = clock();
    const result = await waitForResourceTask(TASK_ID, {
      ...time,
      readStatus: async id => { reads.push(['Status', id]); return {Id: id, Status: status}; },
      readDetail: async id => { reads.push(['Detail', id]); return {Code: 1, Data: {Id: id, Status: status}}; }
    });
    assert.equal(result.status.Status, status);
    assert.equal(time.now(), 0);
    assert.deepEqual(reads, [['Status', TASK_ID], ['Detail', TASK_ID]]);
  });
}

test('a Status transport error propagates without rereading, submitting, or fabricating Detail', async () => {
  const error = new Error('status transport unavailable'), reads = [], time = clock();
  await assert.rejects(waitForResourceTask(TASK_ID, {
    ...time,
    readStatus: async id => { reads.push(['Status', id]); throw error; },
    readDetail: async id => { reads.push(['Detail', id]); throw new Error('must not run'); }
  }), actual => actual === error);
  assert.deepEqual(reads, [['Status', TASK_ID]]);
});

test('a Detail transport error propagates without resubmission or replacing the completed status', async () => {
  const error = new Error('detail transport unavailable'), reads = [], time = clock();
  await assert.rejects(waitForResourceTask(TASK_ID, {
    ...time,
    readStatus: async id => { reads.push(['Status', id]); return {Id: id, Status: 'Succeeded'}; },
    readDetail: async id => { reads.push(['Detail', id]); throw error; }
  }), actual => actual === error);
  assert.deepEqual(reads, [['Status', TASK_ID], ['Detail', TASK_ID]]);
});

// 执行真实 resourcesStage 函数正文，只在传输边界使用本地夹具，避免测试另抄一份实现。
// 本测试不创建租户、不访问网络或数据库，也不写业务回执；时间由夹具推进。
function resourceStageFixture({outcome = 'Succeeded', failAction, succeedAt = 0} = {}) {
  const source = fs.readFileSync(new URL('./prepare.mjs', import.meta.url), 'utf8');
  const stageSource = source.slice(source.indexOf('async function resourcesStage() {'), source.indexOf('\nasync function identitiesStage()'));
  const requestSource = source.slice(source.indexOf('export function resourceInstallRequest('), source.indexOf('\nlet contextFile'));
  assert.ok(stageSource.startsWith('async function resourcesStage() {'));
  const calls = [], receipts = new Map(), time = clock(), failure = new Error(failAction + ' read failed');
  const packageBytes = Buffer.from(JSON.stringify({PackageInfo: {Name: 'fixture', Version: 'v1.0.0'}, SysApiEngines: [], ResourcePolicies: {ApiEngines: {}}}));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const initial = {
    'registered-tenant.json': {ownerUserId: 'owner-fixture'},
    'owner.result.json': {user: {Id: 'owner-fixture'}}
  };
  class Session {
    async login() { return {Id: 'admin-fixture', Account: 'admin'}; }
    async post(route, body) {
      assert.equal(route, 'apiengine/platform-background-task');
      calls.push(structuredClone(body));
      if (body.Action === 'RunApiEngine') return {Code: 1, Data: {Id: TASK_ID}};
      assert.equal(body.Id, TASK_ID);
      if (body.Action === failAction) throw failure;
      if (body.Action === 'Status') return {Code: 1, Data: {Id: TASK_ID, Status: time.now() >= succeedAt ? outcome : 'Running'}};
      assert.equal(body.Action, 'Detail');
      return {Code: 1, Data: {Id: TASK_ID, Status: outcome, Result: {Code: 1}}};
    }
  }
  const context = {
    assert, fs: {readFileSync: () => packageBytes}, path, Date: {now: time.now}, delay: time.sleep,
    TASK: 'fixture', OWNER: 'b'.repeat(32), TENANT: 'tenant-fixture',
    CONTEXT: {candidateRoot: '/fixture', sourceHashes: {package: hash(packageBytes)}},
    REQUIRED_APPLICATION: 'package', HttpSession: Session, fixture: value => value,
    read: name => { assert.ok(Object.hasOwn(initial, name)); return initial[name]; },
    credentials: () => ({ownerPassword: 'local-fixture-only'}),
    currentUser: user => assert.equal(user.Account, 'admin'), id: value => value, sha: hash,
    requiredApplication: (bytes, expectedHash) => { assert.equal(hash(bytes), expectedHash); return JSON.parse(bytes); },
    success: result => { assert.equal(result.Code, 1); return result.Data; },
    intent: (name, value) => { const key = name + '.intent.json'; assert.ok(!receipts.has(key)); receipts.set(key, structuredClone(value)); },
    save: (name, value) => { assert.ok(!receipts.has(name), 'receipt cannot be overwritten'); receipts.set(name, structuredClone(value)); },
    waitForResourceTask: (id, readers) => waitForResourceTask(id, {...readers, ...time})
  };
  const run = vm.runInNewContext(requestSource.replace('export function', 'function') + '\n' + stageSource + '\nresourcesStage', context);
  return {run, calls, receipts, failure, time};
}

for (const failAction of ['Status', 'Detail']) {
  test('actual resourcesStage retains original intent and submitted task after ' + failAction + ' failure', async () => {
    const f = resourceStageFixture({failAction});
    await assert.rejects(f.run(), error => error === f.failure);
    assert.equal(f.calls.filter(x => x.Action === 'RunApiEngine').length, 1);
    assert.ok(f.calls.filter(x => x.Action !== 'RunApiEngine').every(x => x.Id === TASK_ID));
    assert.ok(f.receipts.has('resources.intent.json'));
    assert.equal(f.receipts.get('resources-submit.result.json').response.Data.Id, TASK_ID);
    assert.equal(f.receipts.has('resources.result.json'), false);
  });
}

test('actual resourcesStage saves real deadline status then rejects the incomplete install', async () => {
  const f = resourceStageFixture({outcome: 'Pending'});
  await assert.rejects(f.run(), /Application task did not succeed/);
  assert.equal(f.time.now(), RESOURCE_INSTALL_TIMEOUT_MS);
  assert.equal(f.calls.filter(x => x.Action === 'RunApiEngine').length, 1);
  const receipt = f.receipts.get('resources.result.json');
  assert.equal(receipt.taskId, TASK_ID);
  assert.equal(receipt.status, 'Pending');
  assert.equal(receipt.response.Data.Status, 'Pending');
});

test('actual resourcesStage accepts success after ten minutes only with real successful Detail', async () => {
  const f = resourceStageFixture({succeedAt: 17 * 60_000});
  await f.run();
  assert.equal(f.calls.filter(x => x.Action === 'RunApiEngine').length, 1);
  assert.equal(f.time.now(), 17 * 60_000);
  assert.equal(f.receipts.get('resources.result.json').status, 'Succeeded');
  assert.equal(f.receipts.get('resources.result.json').response.Data.Result.Code, 1);
});
