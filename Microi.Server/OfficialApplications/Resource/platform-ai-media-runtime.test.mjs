import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const source = fs.readFileSync(new URL('./platform-ai-runtime.js', import.meta.url), 'utf8');
const execute = new (Object.getPrototypeOf(async function () {}).constructor)('V8', source);
async function run(action, input = {}, user = { Id: 'trusted', Level: 1 }) {
  const calls = [], hooks = [];
  const result = await execute({ Param: { ...input, Action: action }, CurrentUser: user, OsClient: 'tenant',
    ApiEngine: { Run: (...args) => { hooks.push(args); return { Code: 1 }; } },
    AI: new Proxy({}, { get: (_target, name) => async (...args) => { calls.push([name, args]); return { Code: 1 }; } }),
    FormEngine: { GetTableData: (...args) => { calls.push(['FormEngine', args]); return { Code: 1, Data: [] }; } }
  });
  return { result, calls, hooks };
}
test('media actions require identity before hook/runtime and reject unknown actions', async () => {
  for (const action of ['ListModels','GetMediaModels','GenerateMiniMaxImage','GetMiniMaxImageTask','RecoverMiniMaxImageTask','GenerateMiniMaxMusic','GetMiniMaxMusicTask','RecoverMiniMaxMusicTask']) {
    const result = await run(action, {}, {}); assert.equal(result.result.Code, 1001); assert.equal(result.calls.length + result.hooks.length, 0);
  }
  assert.equal((await run('RunAnything')).result.Code, 0);
});
test('image task mapping preserves idempotency, strips identity/secrets and normalizes empty references for Jint', async () => {
  const { result, calls, hooks } = await run('GenerateMiniMaxImage', { RequestId: 'stable', AiModelId: 'model', Prompt: 'draw', ReferenceImages: [], UserId: 'forged', OsClient: 'other', ApiKey: 'secret', Endpoint: 'https://evil.invalid', Width: 1024 });
  assert.equal(result.Code, 1); assert.equal(calls[0][0], 'GenerateMiniMaxImage');
  const request = calls[0][1][0]; assert.equal(request.RequestId, 'stable'); assert.equal(request.ReferenceImages, null); assert.equal(request.Width, 1024);
  for (const field of ['UserId','OsClient','ApiKey','Endpoint','ServerInternalCall']) assert.ok(!(field in request));
  assert.deepEqual(Object.keys(hooks[0][1]).sort(), ['Action', 'SourceApiEngineKey', 'Stage']);
});
test('music task only sends typed media fields and keeps the request key', async () => {
  const { calls } = await run('GenerateMiniMaxMusic', { RequestId: 'music-stable', Prompt: 'music', AiModelId: 'm', ApiKey: 'secret', CurrentUser: { Level: 9999 }, IsInstrumental: false });
  assert.equal(calls[0][0], 'GenerateMiniMaxMusic'); assert.equal(calls[0][1][0].RequestId, 'music-stable');
  assert.equal(calls[0][1][0].IsInstrumental, false); assert.ok(!('ApiKey' in calls[0][1][0])); assert.ok(!('CurrentUser' in calls[0][1][0]));
});
test('task status/recovery gets only bounded task id; media directory gets no caller identity arguments', async () => {
  for (const action of ['GetMiniMaxImageTask','RecoverMiniMaxImageTask','GetMiniMaxMusicTask','RecoverMiniMaxMusicTask']) {
    const { calls } = await run(action, { TaskId: 'x'.repeat(250), UserId: 'other' });
    assert.deepEqual(calls[0], [action, ['x'.repeat(240)]]);
  }
  assert.deepEqual((await run('GetMediaModels', { OsClient: 'other' })).calls, [['GetMediaModels', []]]);
});
test('catalog has bounded fixed projection and client permission semantics', async () => {
  const { calls } = await run('ListModels', { FormEngineKey: 'sys_user', _PageSize: 999999, _SelectFields: ['ApiKey'] });
  assert.equal(calls[0][1][0], 'mic_ai'); const request = calls[0][1][1];
  assert.equal(request._PageSize, 200); assert.equal(request._InvokeType, 'Client'); assert.ok(!request._SelectFields.includes('ApiKey'));
});
