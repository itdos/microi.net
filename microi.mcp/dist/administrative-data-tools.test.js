import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
test('administrative data tools are discoverable, confirmation-scoped and routed to the protected API', async () => {
    const calls = [];
    const audits = [];
    const fakeClient = {
        getAdministrativeCapabilities: async () => ({
            Code: 1,
            Data: {
                PlatformAdministrator: true,
                Level: 9999,
                RequiredLevel: 9999,
                AccessKeySessionAllowed: false,
            },
        }),
        administerTableData: async (input) => {
            calls.push(input);
            return {
                Code: 1,
                Data: {
                    Operation: input.operation,
                    TableName: input.tableName,
                    SensitiveFieldsRedacted: true,
                },
            };
        },
        writeAuditLog: async (operation, target, detail) => {
            audits.push({ operation, target, detail });
            return { Code: 1 };
        },
    };
    const server = createMcpServer(fakeClient, {
        osClient: 'iTdos',
        apiBaseUrl: 'https://api.itdos.com',
        label: '吾码官方',
        codexMode: true,
    });
    const client = new Client({ name: 'microi-admin-data-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        const catalog = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'list_tools', params: { keyword: 'admin' } },
        });
        const catalogText = catalog.content[0]?.type === 'text' ? catalog.content[0].text : '';
        assert.match(catalogText, /microi_get_administrative_capabilities/);
        assert.match(catalogText, /microi_admin_table_data/);
        const capabilities = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_get_administrative_capabilities', params: {} },
        });
        const capabilitiesText = capabilities.content[0]?.type === 'text' ? capabilities.content[0].text : '';
        assert.match(capabilitiesText, /"PlatformAdministrator": true/);
        assert.match(capabilitiesText, /"AccessKeySessionAllowed": false/);
        const query = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_admin_table_data',
                params: {
                    operation: 'query',
                    tableName: 'sys_role',
                    query: { _SelectFields: ['Id', 'Name', 'BaseLimit'], _PageSize: 20 },
                },
            },
        });
        assert.equal(query.isError, undefined);
        assert.equal(calls.length, 1);
        assert.equal(calls[0]?.operation, 'query');
        const blocked = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_admin_table_data',
                params: {
                    operation: 'update',
                    tableName: 'sys_role',
                    row: { Id: 'role-1', BaseLimit: '[]' },
                },
            },
        });
        const blockedText = blocked.content[0]?.type === 'text' ? blocked.content[0].text : '';
        assert.equal(blocked.isError, true);
        assert.match(blockedText, /UPDATE:sys_role:role-1/);
        assert.equal(calls.length, 1);
        const updated = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_admin_table_data',
                params: {
                    operation: 'update',
                    tableName: 'sys_role',
                    row: { Id: 'role-1', BaseLimit: '[]' },
                    confirmExecution: 'UPDATE:sys_role:role-1',
                },
            },
        });
        assert.equal(updated.isError, undefined);
        assert.equal(calls.length, 2);
        assert.equal(calls[1]?.id, 'role-1');
        assert.equal(audits.length, 1);
        assert.doesNotMatch(String(audits[0]?.detail), /OnlyGet|password|secret-value/i);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=administrative-data-tools.test.js.map