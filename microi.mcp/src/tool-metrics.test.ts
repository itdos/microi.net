import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolPayloadMetrics } from './tool-metrics.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
import type { MicroiClient } from './microi-client.js';

test('计量成功、业务失败与异常，保留结果且不保留正文或秘密', async () => {
  const metrics = new ToolPayloadMetrics();
  const result = { content: [{ type: 'text', text: '中文回执' }] };
  assert.equal(await metrics.measure('read', { token: 'private-fixture', code: 'secret-source' }, () => result), result);
  await metrics.measure('write', {}, () => ({ isError: true }));
  const failure = new Error('private-error');
  await assert.rejects(metrics.measure('write', {}, () => { throw failure; }), error => error === failure);
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.totals.calls, 3);
  assert.equal(snapshot.totals.errors, 2);
  assert.ok(snapshot.totals.requestBytes > 0);
  assert.ok(snapshot.totals.responseBytes > 0);
  assert.doesNotMatch(JSON.stringify(snapshot), /private-fixture|secret-source|private-error|中文回执/);
  assert.equal(snapshot.providerUsage, 'unknown');
});

test('会话计量隔离，快照不允许修改内部数字', async () => {
  const a = new ToolPayloadMetrics(), b = new ToolPayloadMetrics();
  await a.measure('read', { value: 1 }, () => ({ ok: true }));
  a.snapshot().actions[0].calls = 999;
  assert.equal(a.snapshot().totals.calls, 1);
  assert.equal(b.snapshot().totals.calls, 0);
});

test('真实MCP单入口只计一次业务调用，查询指标不增加计数', async () => {
  const server = createMcpServer({ getStatus: async () => ({ Code: 1, Data: { OsClient: 'fixture' } }) } as unknown as MicroiClient,
    { osClient: 'fixture', apiBaseUrl: 'https://fixture.invalid', label: 'metrics fixture', codexMode: true });
  const client = new Client({ name: 'metrics-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  try {
    await client.callTool({ name: 'microi_codex', arguments: { action: 'microi_get_status', params: {} } });
    for (let i = 0; i < 2; i++) {
      const result = await client.callTool({ name: 'microi_codex', arguments: { action: 'microi_get_context_metrics' } });
      const text = (result.content as Array<{ type: string; text?: string }>).find(item => item.type === 'text')?.text;
      const metrics = JSON.parse(text || '{}');
      assert.equal(metrics.totals.calls, 1);
      assert.equal(metrics.actions[0].action, 'microi_get_status');
      assert.equal(metrics.providerUsage, 'unknown');
    }
  } finally { await client.close(); await server.close(); }
});
