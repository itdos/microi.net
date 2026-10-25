import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, evaluate, runSuite, officialTransport, limits } from './run.mjs';

test('plan is fixed, balanced, bounded and synthetic', () => {
  const requests = plan('synthetic-model');
  assert.equal(requests.length, 6);
  assert.equal(requests.filter(x => x.condition === 'plain').length, 3);
  for (const { body } of requests) { assert.equal(body.max_tokens, 1024); assert.equal(body.stream, true); assert.equal(body.stream_options.include_usage, true); }
  assert.equal(limits.retries, 0);
});

test('M3 protocol profile separates reasoning and fixes the same non-thinking policy in both conditions', () => {
  for (const request of plan('MiniMax-M3')) {
    assert.equal(request.body.reasoning_split, true);
    assert.deepEqual(request.body.thinking, { type: 'disabled' });
  }
  assert.equal(plan('another-model')[0].body.reasoning_split, undefined);
  assert.equal(plan('another-model')[0].body.thinking, undefined);
});
test('validation rejects invalid JSON, insecure identity and incomplete transactions', () => {
  assert.equal(evaluate('query-plan', '```json\n{}\n```').passed, false);
  assert.equal(evaluate('trust-boundary', '{"identitySource":"requestBody"}').passed, false);
  assert.equal(evaluate('transaction-plan', '{"engine":"ApiEngine","successCode":1,"manualCommit":false,"failureRollsBack":true,"invalidInputWrites":false}').passed, true);
  assert.equal(evaluate('query-plan', '{"table":"Diy_Order","where":[["Amount",">",1000],["Status","=","已确认"]],"orderBy":"CreateTime","order":"DESC","pageIndex":1,"pageSize":20}').passed, true);
});
test('harness fixtures can never be reported as provider usage and outputs are not saved', async () => {
  const report = await runSuite({ model: 'fixture', transport: async () => ({ status: 'truncated', text: 'SYNTHETIC_BODY_SECRET', usage: { total_tokens: 12, internalSecret: 'DO_NOT_SAVE' }, elapsedMs: 1 }) });
  assert.equal(report.completedCalls, 6);
  assert.equal(report.passed, 0);
  assert.equal(report.records[0].usageSource, 'synthetic-fixture');
  assert.doesNotMatch(JSON.stringify(report), /SYNTHETIC_BODY_SECRET|DO_NOT_SAVE/);
});
test('transport failure stops suite without retry and missing usage stays unknown', async () => {
  let count = 0;
  const report = await runSuite({ model: 'fixture', evidenceKind: 'real-provider', transport: async () => { count++; return { status: 'http-error', httpStatus: 401, elapsedMs: 1 }; } });
  assert.equal(count, 1);
  assert.equal(report.records[0].usage, null);
  assert.equal(report.records[0].usageSource, 'unavailable');
});
test('SSE parser handles fragmented UTF8, completion and actual usage', async () => {
  const content = '中文';
  const sse = `data: ${JSON.stringify({ model: 'fixture-returned', choices: [{ delta: { content }, finish_reason: null }] })}\r\n\r\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 2, total_tokens: 9 } })}\n\ndata: [DONE]\n\n`;
  const bytes = new TextEncoder().encode(sse);
  let calls = 0;
  const result = await officialTransport(plan('fixture')[0].body, 'synthetic-key', { fetchImpl: async (url, options) => {
    calls++; assert.equal(url, 'https://api.microi.net/v1/chat/completions'); assert.equal(options.redirect, 'error');
    return new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } }), { status: 200 });
  } });
  assert.equal(calls, 1); assert.equal(result.status, 'complete'); assert.equal(result.text, content); assert.equal(result.usage.total_tokens, 9);
});
test('SSE without explicit stop stays incomplete even with DONE', async () => {
  const result = await officialTransport(plan('fixture')[0].body, 'synthetic-key', { fetchImpl: async () => new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\ndata: [DONE]\n\n') });
  assert.equal(result.status, 'incomplete');
});

test('DONE is terminal even when later completion or malformed events share its chunk', async () => {
  const afterDone = 'data: {"model":"injected","choices":[{"delta":{"content":"injected"},"finish_reason":"stop"}]}\n\ndata: not-json\n\n';
  for (const suffix of [afterDone, afterDone.trim()]) {
    const result = await officialTransport(plan('fixture')[0].body, 'synthetic-key', { fetchImpl: async () =>
      new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\ndata: [DONE]\n\n' + suffix) });
    assert.equal(result.status, 'incomplete');
    assert.equal(result.text, 'partial');
    assert.equal(result.finish, null);
    assert.equal(result.returnedModel, null);
  }
});

test('provider model metadata accepts bounded IDs and never persists objects or control text', async () => {
  for (const model of ['vendor/model:v1.2-test_0', { secret: 'MODEL_SECRET' }, 'bad\nMODEL_SECRET', 'a'.repeat(129), '']) {
    const result = await officialTransport(plan('fixture')[0].body, 'synthetic-key', { fetchImpl: async () =>
      new Response('data: ' + JSON.stringify({ model, choices: [{ delta: { content: '{}' }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n') });
    assert.equal(result.returnedModel, model === 'vendor/model:v1.2-test_0' ? model : null);
  }
  const report = await runSuite({ model: 'fixture', transport: async () => ({ status: 'incomplete', returnedModel: { secret: 'MODEL_SECRET' } }) });
  assert.doesNotMatch(JSON.stringify(report), /MODEL_SECRET/);
});

test('usage accepts only nonnegative safe integers including nested details', async () => {
  for (const invalid of [-1, 0.1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '12', null]) {
    const report = await runSuite({ model: 'fixture', transport: async () => ({ status: 'incomplete', usage: {
      prompt_tokens: invalid, completion_tokens: 0, total_tokens: 12,
      prompt_tokens_details: { cached_tokens: invalid }, completion_tokens_details: { reasoning_tokens: 2 }
    } }) });
    assert.deepEqual(report.records[0].usage, { completion_tokens: 0, total_tokens: 12, completion_tokens_details: { reasoning_tokens: 2 } });
  }
});
