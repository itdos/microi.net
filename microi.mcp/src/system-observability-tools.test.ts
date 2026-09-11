import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './server.js';
import type { MicroiClient, SystemObservabilityManage, SystemObservabilityQuery } from './microi-client.js';
import { MicroiClient as HttpMicroiClient } from './microi-client.js';

function toolText(result: CallToolResult): string {
  return result.content
    .filter(item => item.type === 'text')
    .map(item => item.type === 'text' ? item.text : '')
    .join('\n');
}

test('pool recovery MCP previews, confirms, preserves idempotency and reads node receipts without ordinary audit calls', async () => {
  const id = 'a'.repeat(32);
  const pools = ['b'.repeat(64)];
  const writes: SystemObservabilityManage[] = [];
  const queries: SystemObservabilityQuery[] = [];
  const fakeClient = {
    querySystemObservability: async (query: SystemObservabilityQuery) => {
      queries.push(query);
      return { Code: 1, Data: { OperationId: id, PoolIds: pools, Target: 'Read', State: 'Pending' } };
    },
    manageSystemObservability: async (command: SystemObservabilityManage) => {
      writes.push(command); return { Code: 1, Data: { OperationId: id, State: 'Pending' } };
    },
    writeAuditLog: async () => { throw new Error('ordinary audit depends on exhausted pool'); },
  } as unknown as MicroiClient;
  const server = createMcpServer(fakeClient, { osClient: 'tenant-pool', apiBaseUrl: 'https://microi.test', label: '连接池测试', codexMode: true });
  const client = new Client({ name: 'pool-recovery', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  const call = async (name: string, args: Record<string, unknown>) => await client.callTool({
    name: 'microi_codex', arguments: { action: name, params: args },
  }) as CallToolResult;
  try {
    const preview = await call('microi_manage_system_observability', { action: 'ResetDatabasePools', poolTarget: 'Read' });
    assert.equal(preview.isError, undefined);
    assert.match(toolText(preview), new RegExp(`ResetDatabasePools:${id}`));
    assert.equal(writes.length, 0);
    const invalid = await call('microi_manage_system_observability', { action: 'ResetDatabasePools', confirmExecution: 'wrong' });
    assert.equal(invalid.isError, true); assert.equal(writes.length, 0);
    const command = { action: 'ResetDatabasePools', poolTarget: 'Read', operationId: id, poolIds: pools, confirmExecution: `ResetDatabasePools:${id}` };
    const accepted = await call('microi_manage_system_observability', command);
    assert.equal(accepted.isError, undefined);
    assert.deepEqual(writes[0], { Action: 'ResetDatabasePools', Target: 'Read', OperationId: id, PoolIds: pools, Confirm: `ResetDatabasePools:${id}` });
    const state = await call('microi_query_system_observability', { action: 'DatabasePoolRecovery', operationId: id });
    assert.equal(state.isError, undefined); assert.match(toolText(state), /Pending/u);
    assert.equal(queries.at(-1)?.OperationId, id);
  } finally { await client.close(); await server.close(); }
});

test('pool emergency HTTP client uses bound tenant and direct protocol, never native transport replay on uncertain reset', async () => {
  const previous = globalThis.fetch;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const client = new HttpMicroiClient({ apiBaseUrl: 'https://microi.test', osClient: 'bound-tenant', token: 'pool-test-token', username: '', password: '' });
  try {
    globalThis.fetch = async (url, options) => {
      requests.push({ url: String(url), body: JSON.parse(String(options?.body)) });
      return new Response(JSON.stringify({ Code: 1, Data: { State: 'Pending' } }), { headers: { 'Content-Type': 'application/json' } });
    };
    await client.querySystemObservability({ Action: 'DatabasePools', OsClient: 'forged-tenant' });
    await client.manageSystemObservability({ Action: 'ResetDatabasePools', OperationId: 'a'.repeat(32) });
    assert.equal(requests.length, 2);
    for (const request of requests) {
      assert.equal(request.url, 'https://microi.test/api/Diagnostics/database-pools');
      assert.equal(request.body.OsClient, 'bound-tenant');
    }
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('connection reset after accept'); };
    await assert.rejects(() => client.manageSystemObservability({ Action: 'ResetDatabasePools', OperationId: 'a'.repeat(32) }), /禁用非幂等传输重放/u);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previous; }
});

test('system observability MCP exposes bounded read catalog and confirmed IP governance', async () => {
  const queries: SystemObservabilityQuery[] = [];
  const commands: SystemObservabilityManage[] = [];
  const audits: Array<{ action: string; target: string; content: string }> = [];
  const fakeClient = {
    querySystemObservability: async (query: SystemObservabilityQuery) => {
      queries.push(query);
      return { Code: 1, Msg: '', Data: { Action: query.Action, CurrentNodeOnly: true,
        ...(query.Action === 'Memory' ? {
          Executions: { ObservationMode: 'BoundaryAccounting+BackgroundIdentity', IdentityRegistryOverflowCount: 0,
            NativeThreadIdentityUnavailableCount: 0, IdentityRefreshFailureCount: 0 },
          Collector: { ObservedIdentityProtocolVersion: 2, BackgroundIdentityRefreshes: 17, RejectedStaleIdentityMarkers: 1 },
        } : {}),
      } };
    },
    manageSystemObservability: async (command: SystemObservabilityManage) => {
      commands.push(command);
      return { Code: 1, Msg: '已封禁。', Data: { Ip: command.Ip } };
    },
    writeAuditLog: async (action: string, target: string, content: string) => {
      audits.push({ action, target, content });
      return { Code: 1, Msg: '', Data: null };
    },
  } as unknown as MicroiClient;

  const server = createMcpServer(fakeClient, {
    osClient: 'tenant-a', apiBaseUrl: 'https://microi.test', label: '测试租户', codexMode: true,
  });
  const client = new Client({ name: 'microi-system-observability-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const catalog = await client.callTool({
      name: 'microi_codex', arguments: { action: 'list_tools', params: { keyword: 'observability' } },
    }) as CallToolResult;
    assert.match(toolText(catalog), /microi_query_system_observability/u);
    assert.match(toolText(catalog), /microi_manage_system_observability/u);

    const description = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'describe_tool', params: { name: 'microi_query_system_observability' } },
    }) as CallToolResult;
    assert.equal(description.isError, undefined);
    for (const term of ['MemoryIncidents', 'MemoryIncident', 'incidentId', 'Collector', 'retained heap']) {
      assert.ok(toolText(description).includes(term), `AI discovery must explain ${term}`);
    }

    const capabilities = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'microi_query_system_observability', params: { action: 'Capabilities' } },
    }) as CallToolResult;
    assert.equal(capabilities.isError, undefined);
    assert.equal(queries[0]?.Action, 'Capabilities');

    const traffic = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_query_system_observability',
        params: { action: 'HistoricalDashboard', rangeKey: '30d', top: 15 },
      },
    }) as CallToolResult;
    assert.equal(traffic.isError, undefined);
    assert.deepEqual(queries[1], {
      Action: 'HistoricalDashboard', RangeKey: '30d', Top: 15,
    });

    const trafficDetails = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_query_system_observability',
        params: {
          action: 'TrafficDetails', rangeKey: '7d', pageIndex: 2, pageSize: 15,
          transferAction: '上传', ip: '203.0.113.20', userId: 'user-1',
          endpoint: '/apiengine/upload-file', keyword: '.zip',
        },
      },
    }) as CallToolResult;
    assert.equal(trafficDetails.isError, undefined);
    assert.deepEqual(queries[2], {
      Action: 'TrafficDetails', Keyword: '.zip', _Keyword: '.zip',
      PageIndex: 2, _PageIndex: 2, PageSize: 15, _PageSize: 15,
      RangeKey: '7d', TransferAction: '上传', Ip: '203.0.113.20',
      UserId: 'user-1', Endpoint: '/apiengine/upload-file',
    });

    const missingTrace = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'microi_query_system_observability', params: { action: 'Trace' } },
    }) as CallToolResult;
    assert.equal(missingTrace.isError, true);
    assert.equal(queries.length, 3);

    // 事故查询始终只读；详情标识由入口校验，不能把任意文件路径送进后端。
    for (const action of ['Memory', 'MemoryIncidents'] as const) {
      const result = await client.callTool({ name: 'microi_codex',
        arguments: { action: 'microi_query_system_observability', params: { action } } }) as CallToolResult;
      assert.equal(result.isError, undefined);
      assert.equal(queries.at(-1)?.Action, action);
      if (action === 'Memory') {
        for (const field of ['BoundaryAccounting+BackgroundIdentity', 'IdentityRegistryOverflowCount',
          'NativeThreadIdentityUnavailableCount', 'IdentityRefreshFailureCount', 'ObservedIdentityProtocolVersion',
          'BackgroundIdentityRefreshes', 'RejectedStaleIdentityMarkers'])
          assert.ok(toolText(result).includes(field), `MCP must preserve diagnostic quality field ${field}`);
      }
    }
    const incidentId = 'abcdef0123456789abcdef0123456789';
    const detail = await client.callTool({ name: 'microi_codex',
      arguments: { action: 'microi_query_system_observability', params: { action: 'MemoryIncident', incidentId } } }) as CallToolResult;
    assert.equal(detail.isError, undefined);
    assert.deepEqual(queries.at(-1), { Action: 'MemoryIncident', IncidentId: incidentId });
    const countBeforeInvalid = queries.length;
    for (const invalid of [{}, { incidentId: '../../secrets' }]) {
      const result = await client.callTool({ name: 'microi_codex',
        arguments: { action: 'microi_query_system_observability', params: { action: 'MemoryIncident', ...invalid } } }) as CallToolResult;
      assert.equal(result.isError, true);
    }
    assert.equal(queries.length, countBeforeInvalid);
    assert.equal(commands.length, 0);

    const dryRun = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_manage_system_observability',
        params: { action: 'BlockIp', ip: '203.0.113.10', blockMinutes: 45, reason: '异常流量复核' },
      },
    }) as CallToolResult;
    assert.equal(dryRun.isError, undefined);
    assert.match(toolText(dryRun), /"dryRun": true/u);
    assert.match(toolText(dryRun), /BlockIp:203\.0\.113\.10/u);
    assert.equal(commands.length, 0);
    assert.equal(audits.length, 0);

    const confirmed = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_manage_system_observability',
        params: {
          action: 'BlockIp', ip: '203.0.113.10', blockMinutes: 45, reason: '异常流量复核',
          confirmExecution: 'BlockIp:203.0.113.10',
        },
      },
    }) as CallToolResult;
    assert.equal(confirmed.isError, undefined);
    assert.deepEqual(commands[0], {
      Action: 'BlockIp', Ip: '203.0.113.10', BlockMinutes: 45, Reason: '异常流量复核',
    });
    assert.equal(audits.length, 1);
    assert.doesNotMatch(audits[0]?.content || '', /异常流量复核/u);
  } finally {
    await client.close();
    await server.close();
  }
});

test('memory MCP preserves incomplete evidence and backend failures without invoking writes', async () => {
  const incidentId = 'abcdef0123456789abcdef0123456789';
  let reply: { Code: number; Msg: string; Data: unknown } = {
    Code: 1, Msg: '', Data: {
      Items: [{ Id: incidentId, Stacks: { MissingStackSamples: 527, Truncated: true },
        Evidence: { StackQuality: { MissingStackSamples: 527 } } }],
      SharedStorage: 'Unavailable', LocalFallbackAvailable: true,
      Evidence: { PendingUploads: 2, SharedStorageError: 'TimeoutException' },
    },
  };
  let reads = 0;
  const server = createMcpServer({
    querySystemObservability: async () => { reads++; return reply; },
    manageSystemObservability: async () => { assert.fail('memory reads must not invoke governance'); },
    writeAuditLog: async () => { assert.fail('memory reads must not create a write action'); },
  } as unknown as MicroiClient, {
    osClient: 'tenant-a', apiBaseUrl: 'https://microi.test', label: '测试租户', codexMode: true,
  });
  const client = new Client({ name: 'memory-evidence-boundaries', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  const read = () => client.callTool({ name: 'microi_codex', arguments: {
    action: 'microi_query_system_observability', params: { action: 'MemoryIncident', incidentId },
  } }) as Promise<CallToolResult>;
  try {
    const partial = await read();
    assert.equal(partial.isError, undefined);
    assert.deepEqual(JSON.parse(toolText(partial)), reply);
    for (const Msg of ['不支持的系统观测动作。', '当前后端未安装内存诊断运行时，请升级 API 后端。', '无平台可观测性管理员权限。']) {
      reply = { Code: 0, Msg, Data: null };
      const failed = await read();
      assert.equal(failed.isError, true);
      assert.deepEqual(JSON.parse(toolText(failed)), reply);
    }
    assert.equal(reads, 4, 'failures must not trigger automatic retry or fallback writes');
  } finally {
    await client.close();
    await server.close();
  }
});
