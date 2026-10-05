import assert from 'node:assert/strict';
import test from 'node:test';
import V8 from '../src/utils/microi.v8.js';
import { createPlatformReminderClient } from '../src/platform-reminder-api.js';

test('bundled SDK can invoke reminders without a newer Http namespace', async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ Code: 1, Data: { Administrator: true } }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  };
  try {
    V8.configure({ apiBase: 'https://reminder.test', osClient: 'test', appendOsClientQuery: false });
    V8.setToken('unit-test-session');
    const result = await createPlatformReminderClient(() => V8)('Capabilities');
    assert.equal(result.Data.Administrator, true);
    assert.match(requests[0].url, /\/apiengine\/platform-reminder-runtime$/);
    assert.equal(JSON.parse(requests[0].options.body).Action, 'Capabilities');
  } finally { globalThis.fetch = original; V8.setToken(''); }
});

test('new Http SDK JSON text and server errors retain their semantics', async () => {
  const run = createPlatformReminderClient(() => ({ Http: { Post: async p =>
    JSON.stringify(p.PostParam.Action === 'Inbox' ? {Code:1,Data:[]} : {Code:0,Msg:'规则已被修改'}) } }));
  assert.deepEqual((await run('Inbox')).Data, []);
  await assert.rejects(run('Publish'), /规则已被修改/);
});
