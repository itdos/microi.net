import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MicroiClient } from './microi-client.js';
import { createMcpServer } from './server.js';

function textOf(result: CallToolResult): string {
  return result.content[0]?.type === 'text' ? result.content[0].text : '';
}

test('MiniMax image MCP tools gate generation and preserve one persistent task identity', async () => {
  const calls: Array<{ name: string; value: unknown }> = [];
  const fakeClient = {
    generateMiniMaxImage: async (payload: Record<string, unknown>) => {
      calls.push({ name: 'generate', value: payload });
      return { Code: 2, Data: { TaskId: 'image-task-1', Status: 'Pending' }, Msg: 'queued' };
    },
    getMiniMaxImageTask: async (taskId: string) => {
      calls.push({ name: 'get', value: taskId });
      return { Code: 1, Data: { TaskId: taskId, Images: [{ FileUrl: 'https://static.example/image.png' }] }, Msg: '' };
    },
    recoverMiniMaxImageTask: async (taskId: string) => {
      calls.push({ name: 'recover', value: taskId });
      return { Code: 2, Data: { TaskId: taskId, Status: 'Recovering' }, Msg: '' };
    },
  } as unknown as MicroiClient;
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
    }) as CallToolResult;
    assert.match(textOf(dryRun), /"dryRun": true/u);
    assert.equal(calls.length, 0);

    const queued = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_generate_minimax_image',
        params: { requestId, prompt: '电影感未来港湾', aspectRatio: '16:9', count: 1, confirmExecution: requestId },
      },
    }) as CallToolResult;
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
    }) as CallToolResult;
    assert.equal(status.isError, undefined);
    assert.match(textOf(status), /static\.example/u);

    const recovery = await client.callTool({
      name: 'microi_codex', arguments: { action: 'microi_recover_minimax_image_task', params: { taskId: 'image-task-1' } },
    }) as CallToolResult;
    assert.equal(recovery.isError, undefined);
    assert.deepEqual(calls.slice(1), [
      { name: 'get', value: 'image-task-1' },
      { name: 'recover', value: 'image-task-1' },
    ]);

    const catalog = await client.callTool({
      name: 'microi_codex', arguments: { action: 'list_tools', params: { keyword: 'image' } },
    }) as CallToolResult;
    assert.match(textOf(catalog), /microi_generate_minimax_image/u);
    assert.match(textOf(catalog), /microi_get_minimax_image_task/u);
    assert.match(textOf(catalog), /microi_recover_minimax_image_task/u);
  } finally {
    await client.close();
    await server.close();
  }
});

test('MiniMax image MCP tool rejects incomplete exact dimensions before remote generation', async () => {
  let called = false;
  const fakeClient = {
    generateMiniMaxImage: async () => { called = true; return { Code: 2, Data: {}, Msg: '' }; },
  } as unknown as MicroiClient;
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
    }) as CallToolResult;
    assert.equal(result.isError, true);
    assert.match(textOf(result), /width and height/u);
    assert.equal(called, false);
  } finally {
    await client.close();
    await server.close();
  }
});

test('media model catalog and Token Plan readback stay read-only and never queue generation', async () => {
  const calls: string[] = [];
  const fakeClient = {
    getMediaModels: async () => {
      calls.push('models');
      return {
        Code: 1,
        Data: {
          Models: [
            { Id: 'image-01', Capability: 'image', Protocol: 'minimax-image' },
            { Id: 'minimax-code-image', Capability: 'image', Protocol: 'minimax-connector-image' },
          ],
        },
        Msg: '',
      };
    },
    getMiniMaxTokenPlanRemains: async () => {
      calls.push('remains');
      return {
        Code: 1,
        Data: {
          Usage: {
            model_remains: [
              { model_name: 'general', current_interval_remaining_percent: 0, current_interval_status: 2 },
            ],
          },
        },
        Msg: '',
      };
    },
    generateMiniMaxImage: async () => {
      calls.push('generate');
      return { Code: 2, Data: {}, Msg: '' };
    },
  } as unknown as MicroiClient;
  const server = createMcpServer(fakeClient, {
    osClient: 'tenant-a', apiBaseUrl: 'https://microi.test', label: '测试租户', codexMode: true,
  });
  const client = new Client({ name: 'media-model-catalog-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const models = await client.callTool({
      name: 'microi_codex', arguments: { action: 'microi_list_media_models', params: {} },
    }) as CallToolResult;
    assert.equal(models.isError, undefined);
    assert.match(textOf(models), /minimax-code-image/u);

    const remains = await client.callTool({
      name: 'microi_codex', arguments: { action: 'microi_get_minimax_token_plan_remains', params: {} },
    }) as CallToolResult;
    assert.equal(remains.isError, undefined);
    assert.match(textOf(remains), /current_interval_remaining_percent/u);

    assert.deepEqual(calls, ['models', 'remains']);
  } finally {
    await client.close();
    await server.close();
  }
});
