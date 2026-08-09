import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
function toolText(result) {
    return result.content
        .filter(item => item.type === 'text')
        .map(item => item.type === 'text' ? item.text : '')
        .join('\n');
}
test('blueprint version tools expose read-only diff and confirmation-gated rollback', async () => {
    const calls = [];
    const audits = [];
    const fakeClient = {
        listBlueprintHistory: async (blueprintId, pageIndex, pageSize) => {
            calls.push({ method: 'list', data: { blueprintId, pageIndex, pageSize } });
            return { Code: 1, Data: { Items: [], CurrentHash: 'a'.repeat(64) }, Msg: '' };
        },
        compareBlueprintVersions: async (blueprintId, left, right) => {
            calls.push({ method: 'compare', data: { blueprintId, left, right } });
            return { Code: 1, Data: { Equal: false, Changed: 1 }, Msg: '' };
        },
        exportBlueprint: async (blueprintId) => {
            calls.push({ method: 'export', data: { blueprintId } });
            return { Code: 1, Data: { FileName: 'bp.microi-blueprint.json', ContentHash: 'b'.repeat(64) }, Msg: '' };
        },
        rollbackBlueprint: async (data) => {
            calls.push({ method: 'rollback', data });
            return { Code: 1, Data: { RolledBack: true }, Msg: 'ok' };
        },
        writeAuditLog: async (action, target, content) => {
            audits.push({ action, target, content });
            return { Code: 1, Data: null, Msg: '' };
        },
    };
    const server = createMcpServer(fakeClient, {
        osClient: 'tenant-a',
        apiBaseUrl: 'https://microi.test',
        label: '测试租户',
        codexMode: true,
    });
    const client = new Client({ name: 'blueprint-version-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        const catalog = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'list_tools', params: { keyword: 'blueprint' } },
        });
        const catalogText = toolText(catalog);
        assert.match(catalogText, /microi_list_blueprint_history/u);
        assert.match(catalogText, /microi_compare_blueprint_versions/u);
        assert.match(catalogText, /microi_export_blueprint/u);
        assert.match(catalogText, /microi_rollback_blueprint/u);
        const list = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_list_blueprint_history',
                params: { blueprintId: 'bp-1', pageIndex: 2, pageSize: 25 },
            },
        });
        assert.equal(list.isError, false);
        assert.deepEqual(calls[0], {
            method: 'list',
            data: { blueprintId: 'bp-1', pageIndex: 2, pageSize: 25 },
        });
        const compare = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_compare_blueprint_versions',
                params: { blueprintId: 'bp-1', leftHistoryId: 'h-1' },
            },
        });
        assert.equal(compare.isError, false);
        assert.equal(calls[1].method, 'compare');
        const exported = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_export_blueprint',
                params: { blueprintId: 'bp-1' },
            },
        });
        assert.equal(exported.isError, false);
        assert.equal(calls[2].method, 'export');
        const blocked = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_rollback_blueprint',
                params: {
                    blueprintId: 'bp-1',
                    historyId: 'h-1',
                    expectedCurrentHash: 'a'.repeat(64),
                    confirmExecution: 'wrong',
                },
            },
        });
        assert.equal(blocked.isError, true);
        assert.equal(calls.filter(item => item.method === 'rollback').length, 0);
        assert.equal(audits.length, 0);
        const applied = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_rollback_blueprint',
                params: {
                    blueprintId: 'bp-1',
                    historyId: 'h-1',
                    expectedCurrentHash: 'a'.repeat(64),
                    newVersion: '1.2',
                    changeSummary: '恢复稳定版本',
                    confirmExecution: 'bp-1',
                    OsClient: 'forged',
                },
            },
        });
        assert.equal(applied.isError, false);
        const rollbackCall = calls.find(item => item.method === 'rollback');
        assert.ok(rollbackCall);
        assert.deepEqual(rollbackCall.data, {
            BlueprintId: 'bp-1',
            HistoryId: 'h-1',
            ExpectedCurrentHash: 'a'.repeat(64),
            NewVersion: '1.2',
            ChangeSummary: '恢复稳定版本',
        });
        assert.equal(audits.length, 1);
        assert.equal(audits[0].action, 'microi_rollback_blueprint');
        assert.equal(audits[0].target, 'bp-1');
        assert.doesNotMatch(audits[0].content, /forged/u);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=blueprint-versioning.test.js.map