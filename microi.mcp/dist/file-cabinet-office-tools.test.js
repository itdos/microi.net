import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
test('file cabinet Office discovery routes exact tenant object context and propagates authorization failure', async () => {
    const calls = [];
    const fakeClient = {
        listFileCabinetObjects: async (...args) => {
            calls.push({ operation: 'list', args });
            return { Code: 1, Data: { Files: [{ FullPath: '/itdos/docs/A.docx' }] }, Msg: '' };
        },
        getFileCabinetOfficeMeta: async (...args) => {
            calls.push({ operation: 'meta', args });
            return { Code: 0, Data: null, Msg: '指定菜单不是权威文件柜菜单！' };
        },
    };
    const server = createMcpServer(fakeClient, {
        osClient: 'iTdos', apiBaseUrl: 'https://api.itdos.com', label: '吾码官方', codexMode: true,
    });
    const client = new Client({ name: 'microi-file-cabinet-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        const catalog = await client.callTool({
            name: 'microi_codex', arguments: { action: 'list_tools', params: { keyword: 'file_cabinet' } },
        });
        const catalogText = catalog.content[0]?.type === 'text' ? catalog.content[0].text : '';
        assert.match(catalogText, /microi_list_file_cabinet_objects/);
        assert.match(catalogText, /microi_get_file_cabinet_office_meta/);
        const listed = await client.callTool({
            name: 'microi_codex', arguments: {
                action: 'microi_list_file_cabinet_objects', params: { path: '/itdos/docs/', limit: false },
            },
        });
        assert.equal(listed.isError, undefined);
        assert.deepEqual(calls[0], { operation: 'list', args: ['/itdos/docs/', false] });
        const rejected = await client.callTool({
            name: 'microi_codex', arguments: {
                action: 'microi_get_file_cabinet_office_meta',
                params: { filePathName: '/itdos/docs/A.docx', sysMenuId: 'wrong-menu', limit: false },
            },
        });
        assert.equal(rejected.isError, true);
        assert.deepEqual(calls[1], { operation: 'meta', args: ['/itdos/docs/A.docx', 'wrong-menu', false] });
        assert.match(JSON.stringify(rejected.content), /权威文件柜菜单/);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=file-cabinet-office-tools.test.js.map