import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
function textOf(result) {
    return result.content[0]?.type === 'text' ? result.content[0].text : '';
}
test('MiniMax image MCP tools gate generation and preserve one persistent task identity', async () => {
    const calls = [];
    const fakeClient = {
        generateMiniMaxImage: async (payload) => {
            calls.push({ name: 'generate', value: payload });
            return { Code: 2, Data: { TaskId: 'image-task-1', Status: 'Pending' }, Msg: 'queued' };
        },
        getMiniMaxImageTask: async (taskId) => {
            calls.push({ name: 'get', value: taskId });
            return { Code: 1, Data: { TaskId: taskId, Images: [{ FileUrl: 'https://static.example/image.png' }] }, Msg: '' };
        },
        recoverMiniMaxImageTask: async (taskId) => {
            calls.push({ name: 'recover', value: taskId });
            return { Code: 2, Data: { TaskId: taskId, Status: 'Recovering' }, Msg: '' };
        },
    };
    const server = createMcpServer(fakeClient, {
        osClient: 'tenant-a', apiBaseUrl: 'https://microi.test', label: '测试租户', codexMode: true,
    });
    const client = new Client({ name: 'minimax-image-tools-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        const requestId = 'promotion.image.20260916.01';
        const dryRun = await client.callTool({
            name: 'microi_codex',
            arguments: { action: 'microi_generate_minimax_image', params: { requestId, prompt: '电影感未来港湾' } },
        });
        assert.match(textOf(dryRun), /"dryRun": true/u);
        assert.equal(calls.length, 0);
        const queued = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_generate_minimax_image',
                params: { requestId, prompt: '电影感未来港湾', aspectRatio: '16:9', count: 1, confirmExecution: requestId },
            },
        });
        assert.equal(queued.isError, undefined);
        assert.match(textOf(queued), /image-task-1/u);
        assert.deepEqual(calls[0], {
            name: 'generate',
            value: {
                RequestId: requestId,
                Prompt: '电影感未来港湾',
                Model: 'image-01',
                AspectRatio: '16:9',
                Count: 1,
                Operation: 'text-to-image',
            },
        });
        const status = await client.callTool({
            name: 'microi_codex', arguments: { action: 'microi_get_minimax_image_task', params: { taskId: 'image-task-1' } },
        });
        assert.equal(status.isError, undefined);
        assert.match(textOf(status), /static\.example/u);
        const recovery = await client.callTool({
            name: 'microi_codex', arguments: { action: 'microi_recover_minimax_image_task', params: { taskId: 'image-task-1' } },
        });
        assert.equal(recovery.isError, undefined);
        assert.deepEqual(calls.slice(1), [
            { name: 'get', value: 'image-task-1' },
            { name: 'recover', value: 'image-task-1' },
        ]);
        const catalog = await client.callTool({
            name: 'microi_codex', arguments: { action: 'list_tools', params: { keyword: 'image' } },
        });
        assert.match(textOf(catalog), /microi_generate_minimax_image/u);
        assert.match(textOf(catalog), /microi_get_minimax_image_task/u);
        assert.match(textOf(catalog), /microi_recover_minimax_image_task/u);
    }
    finally {
        await client.close();
        await server.close();
    }
});
test('MiniMax image MCP tool rejects incomplete exact dimensions before remote generation', async () => {
    let called = false;
    const fakeClient = {
        generateMiniMaxImage: async () => { called = true; return { Code: 2, Data: {}, Msg: '' }; },
    };
    const server = createMcpServer(fakeClient, {
        osClient: 'tenant-a', apiBaseUrl: 'https://microi.test', label: '测试租户', codexMode: true,
    });
    const client = new Client({ name: 'minimax-image-dimensions-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
        const result = await client.callTool({
            name: 'microi_codex',
            arguments: {
                action: 'microi_generate_minimax_image',
                params: {
                    requestId: 'promotion.image.invalid-size', prompt: '测试图片', width: 1024,
                    confirmExecution: 'promotion.image.invalid-size',
                },
            },
        });
        assert.equal(result.isError, true);
        assert.match(textOf(result), /width and height/u);
        assert.equal(called, false);
    }
    finally {
        await client.close();
        await server.close();
    }
});
//# sourceMappingURL=minimax-image-tools.test.js.map