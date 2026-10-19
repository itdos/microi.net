import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MicroiClient } from './microi-client.js';
import { createMcpServer } from './server.js';
test('Redis tools preserve configured database omission and explicit zero through their client payloads', async () => {
    const backend = new MicroiClient({ apiBaseUrl: 'https://redis-fixture.invalid', osClient: 'child', username: '', password: '', token: 'fixture' });
    const calls = [];
    // 捕获真实工具到客户端的最终请求体，避免仅测试一份重复的序列化实现。
    backend.post = async (_url, body) => {
        calls.push(body);
        return { Code: 1, Data: {} };
    };
    const server = createMcpServer(backend, { osClient: 'child', apiBaseUrl: 'https://redis-fixture.invalid', label: 'Redis isolation fixture', codexMode: true });
    const client = new Client({ name: 'redis-tenant-scope-test', version: '1.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(a), server.connect(b)]);
    const cases = [
        ['microi_redis_statistics', {}],
        ['microi_redis_list_keys', { pattern: '*' }],
        ['microi_redis_get_key', { key: 'Microi:child:test' }],
        ['microi_redis_delete_keys', { keys: ['Microi:child:test'], confirmExecution: 'DELETE' }],
        ['microi_redis_replace_value', { key: 'Microi:child:test', dataType: 'string', value: 'test', confirmExecution: 'EXECUTE' }],
        ['microi_redis_rename_key', { key: 'Microi:child:test', newKey: 'Microi:child:renamed', confirmExecution: 'EXECUTE' }],
        ['microi_redis_set_ttl', { key: 'Microi:child:test', ttlSeconds: 60, confirmExecution: 'EXECUTE' }],
    ];
    try {
        for (const [name, params] of cases) {
            for (const database of [undefined, 0, 4]) {
                calls.length = 0;
                const result = await client.callTool({ name: 'microi_codex', arguments: { action: name, params: { ...params, ...(database === undefined ? {} : { database }) } } });
                assert.notEqual(result.isError, true, name);
                assert.equal(calls.length, 1, name);
                assert.equal(Object.hasOwn(calls[0], 'Database'), database !== undefined, name);
                assert.equal(calls[0].Database, database, name);
            }
        }
    }
    finally {
        await client.close();
        await server.close();
        backend.destroy();
    }
});
//# sourceMappingURL=redis-tenant-scope.test.js.map