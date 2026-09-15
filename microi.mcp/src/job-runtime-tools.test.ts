import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
import type { MicroiClient } from './microi-client.js';

test('job diagnostics and logs stay read-only and preserve backend failures and cursor bounds', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const backend = {
    executeEngine: async (key: string, params: Record<string, unknown>) => {
      assert.equal(key, 'platform-schedule-job'); calls.push(params);
      return { Code: 0, Msg: 'MongoDB unavailable' };
    },
  } as unknown as MicroiClient;
  const server = createMcpServer(backend, { osClient: 'tenant', apiBaseUrl: 'https://microi.test', label: 'test', codexMode: true });
  const client = new Client({ name: 'job-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  const call = (params: Record<string, unknown>) => client.callTool({ name: 'microi_codex', arguments: { action: 'microi_query_job_runtime', params } });
  try {
    await call({ action: 'Logs', jobName: 'minute' });
    assert.equal(calls.length, 0);
    await call({ action: 'Logs', jobName: 'minute', searchMonth: '202609', beforeLogId: 'orphan' });
    assert.equal(calls.length, 0);
    const result = await call({ action: 'Logs', jobName: 'minute', searchMonth: '202609', pageSize: 25, beforeLogId: 'event', beforeLogTime: '2026-09-15T01:00:00Z', OsClient: 'forged' });
    assert.match(JSON.stringify(result), /MongoDB unavailable/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].Action, 'Logs');
    assert.equal(calls[0].PageSize, 25);
    assert.equal(calls[0].BeforeLogId, 'event');
    assert.equal(calls[0].OsClient, undefined);
    await call({ action: 'Pause', jobName: 'minute' });
    assert.equal(calls.length, 1);
  } finally { await client.close(); await server.close(); }
});
