import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { MicroiClient, MicroiTransportError } from './microi-client.js';
import { reportOperation, reportDdlEvents, withOperationProgress, notExecuted } from './operation-progress.js';
import { createMcpServer } from './server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { buildDefaultFormBanner, registerAdvancedTools } from './advanced-tools.js';

test('进度只投影固定DDL阶段，正文与连接信息不进入事件', async () => {
  const events: string[] = [];
  await withOperationProgress(async () => {
    await reportOperation('/api/V8Engine/CreateTable', 'POST');
    await reportOperation('/api/V8Engine/CreateTable', 'POST', true);
    return { content: [] };
  }, async value => { events.push(value); });
  assert.equal(events.length, 2); assert.match(events[0]!, /DDL/);
  assert.equal(JSON.parse(events[1]!).state, 'returned');
  assert.doesNotMatch(events.join(), /token|password|Name|http/);
});

test('本地校验未写入与已发请求失败有不同确定性状态', async () => {
  const before = await withOperationProgress(async () => notExecuted({ content: [], isError: true }));
  assert.equal((before._meta?.microiExecution as { state: string }).state, 'notExecuted');
  const after = await withOperationProgress(async () => { await reportOperation('/api/V8Engine/AddField', 'POST'); return { content: [], isError: true }; });
  assert.equal((after._meta?.microiExecution as { state: string }).state, 'uncertain');
  const unknown = await withOperationProgress(async () => ({ content: [], isError: true }));
  assert.equal((unknown._meta?.microiExecution as { state: string }).state, 'uncertain');
});

test('DDL只采用固定鉴权端点的真实安全回执，保留执行阶段和未确认commit', async () => {
  const events: string[] = [];
  await withOperationProgress(async () => {
    const body = { DataAppend: { DdlEvents: [{ Id: 1, Statement: 'CREATE TABLE fixture (Id int)', State: 'executed', TransactionPending: true, ObservedAtUtc: 'fixture-time' }] } };
    await reportDdlEvents('/api/foreign/anything', body);
    assert.equal(events.length, 0);
    await reportDdlEvents('/api/V8Engine/CreateTable', body);
    return { content: [] };
  }, async value => { events.push(value); });
  assert.equal(events.length, 1);
  const event = JSON.parse(events[0]!);
  assert.equal(event.kind, 'ddl'); assert.equal(event.state, 'executed'); assert.equal(event.transactionPending, true);
  assert.equal(event.statement, 'CREATE TABLE fixture (Id int)'); assert.equal(event.committed, undefined);
});

test('POST被服务端接收后断线只发送一次，不通过native再发DDL', async () => {
  let writes = 0;
  const server = http.createServer((req, res) => { req.resume(); req.on('end', () => { writes++; if (writes === 1) req.socket.destroy(); else res.end('{"Code":1,"Data":{}}'); }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const client = new MicroiClient({ apiBaseUrl: `http://127.0.0.1:${address.port}`, username: '', password: '', token: 'fixture', osClient: 'fixture' });
  try {
    await assert.rejects(client.createTable('fixture_table'), error => error instanceof MicroiTransportError && error.uncertainOutcome);
    assert.equal(writes, 1);
  } finally { client.destroy(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('真实MCP单入口在HTTP返回前传递DDL通知并保留校验未执行元数据', async () => {
  const httpServer = http.createServer((req, res) => { req.resume(); req.on('end', () => res.end('{"Code":1,"Data":{"TableId":"fixture-id"}}')); });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const port = (httpServer.address() as { port: number }).port;
  const api = new MicroiClient({ apiBaseUrl: `http://127.0.0.1:${port}`, username: '', password: '', token: 'fixture', osClient: 'fixture' });
  const server = createMcpServer(api, { apiBaseUrl: `http://127.0.0.1:${port}`, osClient: 'fixture', label: 'fixture', codexMode: true });
  const client = new Client({ name: 'progress-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  try {
    const invalid = await client.callTool({ name: 'microi_codex', arguments: { action: 'microi_create_table', params: {} } }) as CallToolResult;
    assert.equal(invalid.isError, true);
    assert.equal((invalid._meta?.microiExecution as { state: string }).state, 'notExecuted');
    const notices: string[] = [];
    const result = await client.callTool({ name: 'microi_codex', arguments: { action: 'microi_create_table', params: { name: 'fixture_table' } } }, undefined, { onprogress: value => notices.push(String(value.message)) }) as CallToolResult;
    assert.notEqual(result.isError, true);
    assert.equal(notices.length, 2);
    assert.match(notices[0]!, /DDL/);
    assert.equal(JSON.parse(notices[1]!).state, 'returned');
  } finally { await client.close(); await server.close(); api.destroy(); await new Promise<void>(resolve => httpServer.close(() => resolve())); }
});

async function manifestIndexHttpFixture(indexAllowed: boolean) {
  const table = { name: 'biz_index_progress', fields: [{ name: 'Name', label: '名称', component: 'Text', type: 'varchar(100)' }],
    indexes: [{ name: 'idx_progress_name', columns: ['Name'], unique: false }] };
  const requests: string[] = [];
  const notices: string[] = [];
  const httpServer = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      const route = req.url || '';
      requests.push(route);
      const body: { Code: number; Data: unknown; DataAppend?: unknown; Msg?: string } = { Code: 1, Data: {} };
      if (route === '/api/V8Engine/CreateTable') body.Data = { TableId: 'index-table-id' };
      else if (route === '/api/V8Engine/AddField') body.Data = { FieldId: 'name-field-id' };
      else if (route === '/api/V8Engine/CreateTableIndex') {
        if (indexAllowed) body.DataAppend = { DdlTransactionCommitConfirmed: false, DdlEvents: [
          { Id: 1, Statement: 'CREATE INDEX idx_progress_name ON biz_index_progress (Name)', State: 'submitted', TransactionPending: false },
          { Id: 1, Statement: 'CREATE INDEX idx_progress_name ON biz_index_progress (Name)', State: 'executed', TransactionPending: false },
        ] };
        else { body.Code = 0; body.Msg = '权限不足'; }
      } else if (route === '/api/V8Engine/GetDbSchema') body.Data = { Tables: [] };
      else if (route === '/api/V8Engine/ValidateLowCodeSystem') body.Data = { Passed: true, Errors: [] };
      else if (route === '/api/V8Engine/McpFormData') body.Data = [{ Id: 'index-table-id', Name: table.name, ...buildDefaultFormBanner(table) }];
      else if (!['/api/V8Engine/WriteMcpAuditLog', '/api/V8Engine/UpdateTable'].includes(route)) {
        body.Code = 0; body.Msg = 'Unexpected fixture route';
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const port = (httpServer.address() as { port: number }).port;
  const api = new MicroiClient({ apiBaseUrl: `http://127.0.0.1:${port}`, username: '', password: '', token: 'fixture', osClient: 'fixture' });
  type Handler = (input: Record<string, unknown>) => Promise<CallToolResult>;
  const handlers = new Map<string, Handler>();
  // 只替换工具注册容器；实际Manifest处理器、MicroiClient HTTP与进度投影完整执行。
  const registry = { tool(name: string, ...args: unknown[]) { handlers.set(name, args.at(-1) as Handler); } };
  registerAdvancedTools(registry as unknown as Parameters<typeof registerAdvancedTools>[0], api,
    { osClient: 'fixture' } as Parameters<typeof registerAdvancedTools>[2]);
  try {
    const result = await withOperationProgress(() => handlers.get('microi_generate_system')!({
      manifest: { name: '索引进度验证', tables: [table] }, dryRun: false, confirmExecution: 'fixture',
    }), async message => { notices.push(message); });
    return { result, requests, notices: notices.map(message => JSON.parse(message) as Record<string, unknown>) };
  } finally {
    api.destroy();
    await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()));
  }
}

test('Manifest索引通过真实HTTP链回传submitted/executed且不宣称commit', async () => {
  const { result, requests, notices } = await manifestIndexHttpFixture(true);
  assert.notEqual(result.isError, true, JSON.stringify(result));
  assert.equal(requests.filter(route => route === '/api/V8Engine/CreateTableIndex').length, 1);
  const ddl = notices.filter(notice => notice.kind === 'ddl');
  assert.deepEqual(ddl.map(item => item.state), ['submitted', 'executed']);
  assert(ddl.every(item => item.statement === 'CREATE INDEX idx_progress_name ON biz_index_progress (Name)'));
  assert(ddl.every(item => item.committed === undefined));
});

test('Manifest索引权限失败保留失败并停止后续配置且没有DDL正文通知', async () => {
  const { result, requests, notices } = await manifestIndexHttpFixture(false);
  assert.equal(result.isError, true);
  assert.equal(JSON.parse(result.content[0]!.type === 'text' ? result.content[0]!.text : '{}').failedAt, 'createTableIndex');
  assert.equal(requests.filter(route => route === '/api/V8Engine/CreateTableIndex').length, 1);
  assert.equal(requests.includes('/api/V8Engine/UpdateTable'), false);
  assert.equal(requests.includes('/api/V8Engine/ValidateLowCodeSystem'), false);
  assert.deepEqual(notices.filter(notice => notice.kind === 'ddl'), []);
});

test('DDL通知仅精确可信路由，普通DML及伪装后缀不能投影正文', async () => {
  const events: string[] = [];
  await withOperationProgress(async () => {
    const body = { DataAppend: { DdlEvents: [{ Id: 1, Statement: 'CREATE INDEX safe_name ON fixture (Name)', State: 'executed' }] } };
    for (const route of ['/api/FormEngine/UptFormData', '/api/foreign/CreateTable', '/api/foreign/AddField',
      '/api/foreign/CreateTableIndex', '/api/V8Engine/CreateTableIndex/foreign', '/api/V8Engine/CreateTableIndex?foreign=1']) {
      await reportDdlEvents(route, body);
    }
    return { content: [] };
  }, async message => { events.push(message); });
  assert.deepEqual(events, []);
});
