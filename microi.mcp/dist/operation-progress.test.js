import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { MicroiClient, MicroiTransportError } from './microi-client.js';
import { reportOperation, reportDdlEvents, withOperationProgress, notExecuted } from './operation-progress.js';
import { createMcpServer } from './server.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
test('进度只投影固定DDL阶段，正文与连接信息不进入事件', async () => {
    const events = [];
    await withOperationProgress(async () => {
        await reportOperation('/api/V8Engine/CreateTable', 'POST');
        await reportOperation('/api/V8Engine/CreateTable', 'POST', true);
        return { content: [] };
    }, async (value) => { events.push(value); });
    assert.equal(events.length, 2);
    assert.match(events[0], /DDL/);
    assert.equal(JSON.parse(events[1]).state, 'returned');
    assert.doesNotMatch(events.join(), /token|password|Name|http/);
});
test('本地校验未写入与已发请求失败有不同确定性状态', async () => {
    const before = await withOperationProgress(async () => notExecuted({ content: [], isError: true }));
    assert.equal((before._meta?.microiExecution).state, 'notExecuted');
    const after = await withOperationProgress(async () => { await reportOperation('/api/V8Engine/AddField', 'POST'); return { content: [], isError: true }; });
    assert.equal((after._meta?.microiExecution).state, 'uncertain');
    const unknown = await withOperationProgress(async () => ({ content: [], isError: true }));
    assert.equal((unknown._meta?.microiExecution).state, 'uncertain');
});
test('DDL只采用固定鉴权端点的真实安全回执，保留执行阶段和未确认commit', async () => {
    const events = [];
    await withOperationProgress(async () => {
        const body = { DataAppend: { DdlEvents: [{ Id: 1, Statement: 'CREATE TABLE fixture (Id int)', State: 'executed', TransactionPending: true, ObservedAtUtc: 'fixture-time' }] } };
        await reportDdlEvents('/api/foreign/anything', body);
        assert.equal(events.length, 0);
        await reportDdlEvents('/api/V8Engine/CreateTable', body);
        return { content: [] };
    }, async (value) => { events.push(value); });
    assert.equal(events.length, 1);
    const event = JSON.parse(events[0]);
    assert.equal(event.kind, 'ddl');
    assert.equal(event.state, 'executed');
    assert.equal(event.transactionPending, true);
    assert.equal(event.statement, 'CREATE TABLE fixture (Id int)');
    assert.equal(event.committed, undefined);
});
test('POST被服务端接收后断线只发送一次，不通过native再发DDL', async () => {
    let writes = 0;
    const server = http.createServer((req, res) => { req.resume(); req.on('end', () => { writes++; if (writes === 1)
        req.socket.destroy();
    else
        res.end('{"Code":1,"Data":{}}'); }); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const client = new MicroiClient({ apiBaseUrl: `http://127.0.0.1:${address.port}`, username: '', password: '', token: 'fixture', osClient: 'fixture' });
    try {
        await assert.rejects(client.createTable('fixture_table'), error => error instanceof MicroiTransportError && error.uncertainOutcome);
        assert.equal(writes, 1);
    }
    finally {
        client.destroy();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});
test('真实MCP单入口在HTTP返回前传递DDL通知并保留校验未执行元数据', async () => {
    const httpServer = http.createServer((req, res) => { req.resume(); req.on('end', () => res.end('{"Code":1,"Data":{"TableId":"fixture-id"}}')); });
    await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const port = httpServer.address().port;
    const api = new MicroiClient({ apiBaseUrl: `http://127.0.0.1:${port}`, username: '', password: '', token: 'fixture', osClient: 'fixture' });
    const server = createMcpServer(api, { apiBaseUrl: `http://127.0.0.1:${port}`, osClient: 'fixture', label: 'fixture', codexMode: true });
    const client = new Client({ name: 'progress-fixture', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(a), server.connect(b)]);
    try {
        const invalid = await client.callTool({ name: 'microi_codex', arguments: { action: 'microi_create_table', params: {} } });
        assert.equal(invalid.isError, true);
        assert.equal((invalid._meta?.microiExecution).state, 'notExecuted');
        const notices = [];
        const result = await client.callTool({ name: 'microi_codex', arguments: { action: 'microi_create_table', params: { name: 'fixture_table' } } }, undefined, { onprogress: value => notices.push(String(value.message)) });
        assert.notEqual(result.isError, true);
        assert.equal(notices.length, 2);
        assert.match(notices[0], /DDL/);
        assert.equal(JSON.parse(notices[1]).state, 'returned');
    }
    finally {
        await client.close();
        await server.close();
        api.destroy();
        await new Promise(resolve => httpServer.close(() => resolve()));
    }
});
//# sourceMappingURL=operation-progress.test.js.map