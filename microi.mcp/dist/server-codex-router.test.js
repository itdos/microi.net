import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
test('microi_codex discovers and invokes existing tools through one entry point', async () => {
    const fakeClient = {
        getStatus: async () => ({
            Code: 1,
            Data: { OsClient: 'junchi', Online: true },
        }),
    };
    const server = createMcpServer(fakeClient, {
        osClient: 'junchi',
        apiBaseUrl: 'https://api.chongstech.com',
        label: '宁波鸿地',
    });
    const client = new Client({ name: 'microi-router-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
    ]);
    try {
        const tools = await client.listTools();
        assert.ok(tools.tools.some(tool => tool.name === 'microi_codex'));
        const catalog = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'list_tools', params: { keyword: 'status' } },
        });
        const catalogText = catalog.content[0]?.type === 'text' ? catalog.content[0].text : '';
        assert.match(catalogText, /microi_get_status/);
        const status = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_get_status', params: {} },
        });
        const statusText = status.content[0]?.type === 'text' ? status.content[0].text : '';
        assert.match(statusText, /junchi/);
        const invalid = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_get_table_data', params: {} },
        });
        const invalidText = invalid.content[0]?.type === 'text' ? invalid.content[0].text : '';
        assert.equal(invalid.isError, true);
        assert.match(invalidText, /Invalid tool parameters/);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=server-codex-router.test.js.map