import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
test('standard engine MCP keeps bounded sparse selectors and both CAS proofs without weakening confirmation', async () => {
    const calls = [];
    const fake = { executeEngine: async (key, params) => { calls.push({ key, params }); return { Code: 1 }; }, writeAuditLog: async () => ({ Code: 1 }) };
    const server = createMcpServer(fake, { osClient: 'iTdos', apiBaseUrl: 'https://api.itdos.com', label: 'fixture', codexMode: true });
    const client = new Client({ name: 'sparse-selection-test', version: '1.0.0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);
    try {
        const description = await client.callTool({ name: 'microi_codex', arguments: { action: 'describe_tool', params: { name: 'microi_run_engine' } } });
        assert.match(JSON.stringify(description), /SparseTableSelections/);
        const params = { Action: 'InspectResourceSnapshot', RuntimeAssetsOnly: false, IncludeSource: false, SparseTableSelections: [{ TableId: 'shared-id', FieldIds: ['field-id'] }], CommittedProof: { PublishVersionId: 'committed' }, ExpectedResourceSnapshotHash: 'a'.repeat(64) };
        const blocked = await client.callTool({ name: 'microi_codex', arguments: { action: 'microi_run_engine', params: { apiEngineKey: 'ai_app_publish_store', params } } });
        assert.equal(blocked.isError, true);
        assert.equal(calls.length, 0);
        const response = await client.callTool({ name: 'microi_codex', arguments: { action: 'microi_run_engine', params: { apiEngineKey: 'ai_app_publish_store', params, confirmExecution: 'ai_app_publish_store' } } });
        assert.notEqual(response.isError, true);
        assert.deepEqual(calls, [{ key: 'ai_app_publish_store', params }]);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=store-sparse-selection-tools.test.js.map