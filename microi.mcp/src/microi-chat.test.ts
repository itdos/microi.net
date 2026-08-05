import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MicroiClient } from './microi-client.js';
import { createMcpServer } from './server.js';

test('microi_chat forwards only the declared chat contract through the authenticated client', async () => {
  let captured: Record<string, unknown> | undefined;
  const fakeClient = {
    chat: async (input: Record<string, unknown>) => {
      captured = input;
      return { Code: 1, Data: '你好，我是 Microi.AI。', Msg: '' };
    },
  } as unknown as MicroiClient;
  const server = createMcpServer(fakeClient, {
    osClient: 'tenant-a',
    apiBaseUrl: 'https://microi.test',
    label: '测试租户',
    codexMode: true,
  });
  const client = new Client({ name: 'microi-chat-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const result = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_chat',
        params: {
          question: '你好',
          aiModel: 'model-a',
          reasoningEffort: 'low',
          OsClient: 'forged-tenant',
          ApiKey: 'forged-key',
          Endpoint: 'https://evil.example',
          Authorization: 'Bearer forged',
        },
      },
    }) as CallToolResult;

    assert.equal(result.isError, undefined);
    assert.equal(result.content[0]?.type === 'text' ? result.content[0].text : '', '你好，我是 Microi.AI。');
    assert.deepEqual(captured, {
      question: '你好',
      aiModel: 'model-a',
      reasoningEffort: 'low',
      systemPrompt: undefined,
      aiModelId: undefined,
      relayModel: undefined,
      conversationId: undefined,
      mode: undefined,
    });
  } finally {
    await client.close();
    await server.close();
  }
});

test('microi_chat reports license rejection as an MCP tool error', async () => {
  const fakeClient = {
    chat: async () => ({ Code: 0, Data: null, Msg: '需要有效的 Microi License。' }),
  } as unknown as MicroiClient;
  const server = createMcpServer(fakeClient, {
    osClient: 'tenant-a',
    apiBaseUrl: 'https://microi.test',
    label: '测试租户',
    codexMode: true,
  });
  const client = new Client({ name: 'microi-chat-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const result = await client.callTool({
      name: 'microi_codex',
        arguments: { action: 'microi_chat', params: { question: '你好', aiModel: 'model-a' } },
    }) as CallToolResult;
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.structuredContent), /Microi License/u);
  } finally {
    await client.close();
    await server.close();
  }
});
