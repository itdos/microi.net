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

test('game delivery tools gate paid generation and role writes while exposing source cleanup preflight', async () => {
  const calls: Array<{ name: string; payload: Record<string, unknown> }> = [];
  const fakeClient = {
    generateMiniMaxMusic: async (payload: Record<string, unknown>) => {
      calls.push({ name: 'music', payload });
      return { Code: 1, Data: { FilePathName: '/tenant/audio/music.mp3' }, Msg: '' };
    },
    generateMiniMaxSpeech: async (payload: Record<string, unknown>) => {
      calls.push({ name: 'speech', payload });
      return { Code: 1, Data: { FilePathName: '/tenant/audio/voice.mp3' }, Msg: '' };
    },
    setEngineRoles: async (payload: Record<string, unknown>) => {
      calls.push({ name: 'roles', payload });
      return { Code: 1, Data: { UpdatedCount: 1 }, Msg: '' };
    },
    clearApplicationSource: async (payload: Record<string, unknown>) => {
      calls.push({ name: 'clear', payload });
      return { Code: 1, Data: { DryRun: true, ConfirmationSha256: 'a'.repeat(64) }, Msg: '' };
    },
  } as unknown as MicroiClient;
  const server = createMcpServer(fakeClient, {
    osClient: 'tenant-a',
    apiBaseUrl: 'https://microi.test',
    label: '测试租户',
    codexMode: true,
  });
  const client = new Client({ name: 'game-delivery-tools-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const musicRequestId = 'game.music.v1';
    const musicDryRun = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_generate_minimax_music',
        params: { requestId: musicRequestId, prompt: '原创国风策略配乐' },
      },
    }) as CallToolResult;
    assert.match(textOf(musicDryRun), /"dryRun": true/u);
    assert.equal(calls.length, 0);

    await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_generate_minimax_music',
        params: { requestId: musicRequestId, prompt: '原创国风策略配乐', confirmExecution: musicRequestId },
      },
    });
    assert.deepEqual(calls[0], {
      name: 'music',
      payload: {
        RequestId: musicRequestId,
        Prompt: '原创国风策略配乐',
        Model: 'music-3.0',
        IsInstrumental: true,
        SampleRate: 44100,
        Bitrate: 256000,
        Format: 'mp3',
        DurationSeconds: 20,
      },
    });

    const roleDryRun = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_set_engine_roles',
        params: { apiEngineKeys: ['app_game_gateway'], allowAuthenticatedUsers: true },
      },
    }) as CallToolResult;
    const confirmationSha256 = JSON.parse(textOf(roleDryRun)).confirmationSha256 as string;
    assert.match(confirmationSha256, /^[a-f0-9]{64}$/u);
    assert.equal(calls.filter(item => item.name === 'roles').length, 0);

    await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_set_engine_roles',
        params: {
          apiEngineKeys: ['app_game_gateway'],
          allowAuthenticatedUsers: true,
          confirmExecution: confirmationSha256,
        },
      },
    });
    assert.equal(calls.filter(item => item.name === 'roles').length, 1);

    await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_clear_application_source',
        params: { appIdOrKey: 'game-app' },
      },
    });
    assert.deepEqual(calls.find(item => item.name === 'clear')?.payload, { AppIdOrKey: 'game-app' });
  } finally {
    await client.close();
    await server.close();
  }
});
