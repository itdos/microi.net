import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
function toolText(result) {
    return result.content[0]?.type === 'text' ? result.content[0].text : '';
}
test('current-user access-key tools require confirmation and expose plaintext only once', async () => {
    const created = [];
    const revoked = [];
    const fakeCredential = 'microi_ak_test.one-time-fixture';
    const fakeClient = {
        listMyUserAccessKeys: async () => ({
            Code: 1,
            Data: [{
                    Id: 'key-1',
                    Name: '只读看板',
                    KeyPrefix: 'microi_ak_test',
                    Scopes: '["page:open","form:read"]',
                    State: 1,
                }],
            Msg: '',
        }),
        createMyUserAccessKey: async (input) => {
            created.push(input);
            return {
                Code: 1,
                Data: {
                    AccessKey: fakeCredential,
                    LoginPath: `/#/access-login?access_key=${fakeCredential}`,
                    Record: { Id: 'key-2', Name: input.name, State: 1 },
                },
                Msg: 'created',
            };
        },
        revokeMyUserAccessKey: async (id) => {
            revoked.push(id);
            return { Code: 1, Data: { Id: id, State: 2 }, Msg: 'revoked' };
        },
    };
    const server = createMcpServer(fakeClient, {
        osClient: 'iTdos',
        apiBaseUrl: 'https://api.itdos.com',
        label: 'Microi official',
        codexMode: true,
    });
    const client = new Client({ name: 'microi-access-key-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        const catalog = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'list_tools', params: { keyword: 'access key' } },
        });
        const catalogText = toolText(catalog);
        assert.match(catalogText, /microi_list_my_access_keys/);
        assert.match(catalogText, /microi_create_my_access_key/);
        assert.match(catalogText, /microi_revoke_my_access_key/);
        const blockedList = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_list_my_access_keys', params: {} },
        });
        assert.equal(blockedList.isError, true);
        assert.match(toolText(blockedList), /confirmExecution="LIST"/);
        const list = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_list_my_access_keys',
                params: { confirmExecution: 'LIST' },
            },
        });
        assert.equal(list.isError, undefined);
        assert.match(toolText(list), /microi_ak_test/);
        assert.doesNotMatch(toolText(list), /SecretHash|one-time-fixture/);
        const createParams = {
            name: 'MCP 只读开发会话',
            allowedRoutes: ['/'],
            allowedTableNames: ['biz_order'],
        };
        const blockedCreate = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_create_my_access_key', params: createParams },
        });
        assert.equal(blockedCreate.isError, true);
        assert.match(toolText(blockedCreate), /confirmExecution/);
        assert.equal(created.length, 0);
        const create = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_create_my_access_key',
                params: { ...createParams, confirmExecution: createParams.name },
            },
        });
        assert.equal(create.isError, undefined);
        assert.equal(created.length, 1);
        assert.equal(created[0]?.scopes, undefined);
        assert.equal((toolText(create).match(/one-time-fixture/g) || []).length, 1);
        assert.doesNotMatch(toolText(create), /LoginPath|access-login/);
        const blockedRevoke = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_revoke_my_access_key', params: { id: 'key-1' } },
        });
        assert.equal(blockedRevoke.isError, true);
        assert.equal(revoked.length, 0);
        const revoke = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_revoke_my_access_key',
                params: { id: 'key-1', confirmExecution: 'key-1' },
            },
        });
        assert.equal(revoke.isError, undefined);
        assert.deepEqual(revoked, ['key-1']);
        assert.match(toolText(revoke), /"Revoked": true/);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=user-access-key-tools.test.js.map