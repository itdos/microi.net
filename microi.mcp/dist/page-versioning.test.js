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
test('page version tools expose history, semantic diff, export and confirmation-gated rollback', async () => {
    const calls = [];
    const audits = [];
    const fakeClient = {
        listPageEngineHistory: async (pageId, pageIndex, pageSize) => {
            calls.push({ method: 'list', data: { pageId, pageIndex, pageSize } });
            return { Code: 1, Data: { Items: [], CurrentHash: 'b'.repeat(64) }, Msg: '' };
        },
        comparePageEngineVersions: async (pageId, left, right) => {
            calls.push({ method: 'compare', data: { pageId, left, right } });
            return { Code: 1, Data: { Equal: false, Changed: 1 }, Msg: '' };
        },
        exportPageEngine: async (pageId) => {
            calls.push({ method: 'export', data: { pageId } });
            return { Code: 1, Data: { FileName: 'page.microi-page.json' }, Msg: '' };
        },
        rollbackPageEngine: async (data) => {
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
    const client = new Client({ name: 'page-version-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        const catalog = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'list_tools', params: { keyword: 'page_history' } },
        });
        const catalogText = toolText(catalog);
        assert.match(catalogText, /microi_list_page_history/u);
        assert.match(catalogText, /microi_get_page_history/u);
        const list = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_list_page_history',
                params: { pageId: 'page-1', pageIndex: 2, pageSize: 25 },
            },
        });
        assert.equal(list.isError, false);
        assert.deepEqual(calls[0], {
            method: 'list',
            data: { pageId: 'page-1', pageIndex: 2, pageSize: 25 },
        });
        const compare = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_compare_page_versions',
                params: { pageId: 'page-1', leftHistoryId: 'history-1' },
            },
        });
        assert.equal(compare.isError, false);
        assert.equal(calls[1].method, 'compare');
        const exported = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_export_page_design', params: { pageId: 'page-1' } },
        });
        assert.equal(exported.isError, false);
        assert.equal(calls[2].method, 'export');
        const blocked = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_rollback_page_design',
                params: {
                    pageId: 'page-1',
                    historyId: 'history-1',
                    expectedCurrentHash: 'b'.repeat(64),
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
                action: 'microi_rollback_page_design',
                params: {
                    pageId: 'page-1',
                    historyId: 'history-1',
                    expectedCurrentHash: 'b'.repeat(64),
                    changeSummary: '恢复稳定页面',
                    confirmExecution: 'page-1',
                    OsClient: 'forged',
                },
            },
        });
        assert.equal(applied.isError, false);
        const rollbackCall = calls.find(item => item.method === 'rollback');
        assert.ok(rollbackCall);
        assert.deepEqual(rollbackCall.data, {
            PageId: 'page-1',
            HistoryId: 'history-1',
            ExpectedCurrentHash: 'b'.repeat(64),
            ChangeSummary: '恢复稳定页面',
        });
        assert.equal(audits.length, 1);
        assert.equal(audits[0].action, 'microi_rollback_page_design');
        assert.equal(audits[0].target, 'page-1');
        assert.doesNotMatch(audits[0].content, /forged/u);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=page-versioning.test.js.map