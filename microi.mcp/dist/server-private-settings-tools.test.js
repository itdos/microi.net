import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
test('secret tool discovers the existing settings facility, confirms writes and never returns values', async () => {
    const writes = [];
    const secret = 'test-secret-not-for-output';
    const backend = {
        listServerPrivateSettings: async () => ({ Code: 1, Data: [{ Id: 'id', ConfigKey: 'Integration.Changjet.AppSecret', IsSecret: true,
                    HasSecret: true, IsEnabled: true, ConfigValue: secret, SecretCipher: secret }] }),
        saveServerPrivateSecret: async (input) => { writes.push(input); return { Code: 1, Data: { Value: secret } }; },
    };
    const server = createMcpServer(backend, { label: 'test', osClient: 'test', apiBaseUrl: 'https://test.invalid', codexMode: true });
    const client = new Client({ name: 'secret-test', version: '1' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);
    const call = async (params) => await client.callTool({ name: 'microi_codex', arguments: { action: 'microi_manage_server_private_secret', params } });
    try {
        const blocked = await call({ action: 'Save', configKey: 'Integration.Changjet.AppSecret', value: secret });
        assert.equal(blocked.isError, true);
        assert.equal(writes.length, 0);
        const saved = await call({ action: 'Save', configKey: 'Integration.Changjet.AppSecret', value: secret,
            confirmExecution: 'SAVE:Integration.Changjet.AppSecret' });
        assert.notEqual(saved.isError, true);
        assert.equal(writes.length, 1);
        assert.doesNotMatch(JSON.stringify(saved), /test-secret-not-for-output|SecretCipher|ConfigValue/);
        assert.match(JSON.stringify(saved), /ServerPrivateSettings/);
        backend.saveServerPrivateSecret = async () => { throw new Error(secret); };
        const uncertain = await call({ action: 'Save', configKey: 'Integration.Changjet.AppSecret', value: secret,
            confirmExecution: 'SAVE:Integration.Changjet.AppSecret' });
        assert.equal(uncertain.isError, true);
        assert.doesNotMatch(JSON.stringify(uncertain), /test-secret-not-for-output/);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=server-private-settings-tools.test.js.map