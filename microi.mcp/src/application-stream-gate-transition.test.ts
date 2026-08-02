import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ApplicationStreamGateTransitionRequest, MicroiClient } from './microi-client.js';
import { createMcpServer } from './server.js';

function toolText(result: CallToolResult): string {
  return result.content[0]?.type === 'text' ? result.content[0].text : '';
}

test('application stream gate transition is coordinate-bound, monotonic, and double-confirmed', async () => {
  const serverCalls: ApplicationStreamGateTransitionRequest[] = [];
  const fakeClient = {
    transitionApplicationStreamGate: async (request: ApplicationStreamGateTransitionRequest) => {
      serverCalls.push(request);
      return {
        Code: 1,
        Data: {
          TransitionId: request.TransitionId,
          Mode: request.TargetMode,
          GateEpoch: (BigInt(request.ExpectedGateEpoch) + 1n).toString(),
        },
        Msg: 'transitioned',
      };
    },
  } as unknown as MicroiClient;

  const server = createMcpServer(fakeClient, {
    osClient: 'iTdos',
    osClientType: 'Product',
    osClientNetwork: 'Internal',
    apiBaseUrl: 'https://api.itdos.com',
    label: 'Microi official',
    codexMode: true,
  });
  const client = new Client({ name: 'microi-gate-transition-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const drainProofJson = '{"activeV2Publishes":0,"checkedAtUtc":"2026-08-02T00:00:00Z","nodes":["api-1","api-2"]}';
  const drainProofHash = crypto.createHash('sha256').update(drainProofJson, 'utf8').digest('hex');
  const baseParams = {
    osClient: 'iTdos',
    osClientType: 'Product',
    osClientNetwork: 'Internal',
    expectedMode: 'LegacyOpen',
    expectedMinProtocol: 2,
    expectedGateEpoch: '7',
    targetMode: 'Drain',
    transitionId: 'gate-20260802-0001',
    reason: 'Begin an audited v2 drain window',
    drainProofJson,
    drainProofHash,
  } as const;

  try {
    const catalog = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'list_tools', params: { keyword: 'gate transition' } },
    }) as CallToolResult;
    assert.match(toolText(catalog), /microi_transition_application_stream_gate/);

    const preview = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_transition_application_stream_gate',
        params: baseParams,
      },
    }) as CallToolResult;
    assert.equal(preview.isError, undefined);
    const previewJson = JSON.parse(toolText(preview)) as {
      Preview: boolean;
      RemoteWriteAttempted: boolean;
      ConfirmationSha256: string;
      Transition: Record<string, unknown>;
    };
    assert.equal(previewJson.Preview, true);
    assert.equal(previewJson.RemoteWriteAttempted, false);
    assert.match(previewJson.ConfirmationSha256, /^[a-f0-9]{64}$/u);
    assert.equal(serverCalls.length, 0, 'preview must cause zero server calls');

    const wrongConfirmation = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_transition_application_stream_gate',
        params: {
          ...baseParams,
          confirmExecution: true,
          confirmationSha256: '0'.repeat(64),
        },
      },
    }) as CallToolResult;
    assert.equal(wrongConfirmation.isError, true);
    assert.match(toolText(wrongConfirmation), /未调用服务器/);
    assert.equal(serverCalls.length, 0, 'wrong confirmation must cause zero server calls');

    const changedAfterPreview = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_transition_application_stream_gate',
        params: {
          ...baseParams,
          reason: 'A changed reason must invalidate confirmation',
          confirmExecution: true,
          confirmationSha256: previewJson.ConfirmationSha256,
        },
      },
    }) as CallToolResult;
    assert.equal(changedAfterPreview.isError, true);
    assert.equal(serverCalls.length, 0, 'payload drift must cause zero server calls');

    const confirmed = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_transition_application_stream_gate',
        params: {
          ...baseParams,
          confirmExecution: true,
          confirmationSha256: previewJson.ConfirmationSha256,
        },
      },
    }) as CallToolResult;
    assert.equal(confirmed.isError, undefined);
    assert.equal(serverCalls.length, 1, 'exact confirmation permits exactly one fake client call');
    assert.deepEqual(serverCalls[0], {
      OsClient: 'iTdos',
      OsClientType: 'Product',
      OsClientNetwork: 'Internal',
      ExpectedMode: 'LegacyOpen',
      ExpectedMinProtocol: 2,
      ExpectedGateEpoch: '7',
      TargetMode: 'Drain',
      TargetMinProtocol: 2,
      TransitionId: 'gate-20260802-0001',
      Reason: 'Begin an audited v2 drain window',
      DrainProofJson: drainProofJson,
      DrainProofHash: drainProofHash,
      ConfirmationSha256: previewJson.ConfirmationSha256,
      ConfirmExecution: true,
    });

    const rollbackParams = {
      ...baseParams,
      expectedMode: 'Drain',
      expectedGateEpoch: '8',
      targetMode: 'LegacyOpen',
      transitionId: 'gate-20260802-rollback-0001',
      reason: 'Safety rollback while preserving an increasing gate epoch',
    } as const;
    const rollbackPreview = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_transition_application_stream_gate',
        params: rollbackParams,
      },
    }) as CallToolResult;
    assert.equal(rollbackPreview.isError, undefined);
    const rollbackPreviewJson = JSON.parse(toolText(rollbackPreview)) as { ConfirmationSha256: string };
    assert.match(rollbackPreviewJson.ConfirmationSha256, /^[a-f0-9]{64}$/u);
    assert.equal(serverCalls.length, 1, 'rollback preview must cause zero server calls');

    const rollbackConfirmed = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_transition_application_stream_gate',
        params: {
          ...rollbackParams,
          confirmExecution: true,
          confirmationSha256: rollbackPreviewJson.ConfirmationSha256,
        },
      },
    }) as CallToolResult;
    assert.equal(rollbackConfirmed.isError, undefined);
    assert.equal(serverCalls.length, 2);
    assert.equal(serverCalls[1]?.ExpectedMode, 'Drain');
    assert.equal(serverCalls[1]?.ExpectedMinProtocol, 2);
    assert.equal(serverCalls[1]?.ExpectedGateEpoch, '8');
    assert.equal(serverCalls[1]?.TargetMode, 'LegacyOpen');
    assert.equal(serverCalls[1]?.TargetMinProtocol, 2);

    const v3OnlyParams = {
      ...baseParams,
      expectedMode: 'Drain',
      expectedGateEpoch: '9',
      targetMode: 'V3Only',
      transitionId: 'gate-20260802-v3only-0001',
      reason: 'All nodes are drained and ready for protocol v3 only',
    } as const;
    const v3OnlyPreview = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_transition_application_stream_gate',
        params: v3OnlyParams,
      },
    }) as CallToolResult;
    assert.equal(v3OnlyPreview.isError, undefined);
    const v3OnlyPreviewJson = JSON.parse(toolText(v3OnlyPreview)) as {
      ConfirmationSha256: string;
      Transition: { TargetMinProtocol: number };
    };
    assert.equal(v3OnlyPreviewJson.Transition.TargetMinProtocol, 3);
    assert.equal(serverCalls.length, 2, 'V3Only preview must cause zero server calls');

    const v3OnlyConfirmed = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_transition_application_stream_gate',
        params: {
          ...v3OnlyParams,
          confirmExecution: true,
          confirmationSha256: v3OnlyPreviewJson.ConfirmationSha256,
        },
      },
    }) as CallToolResult;
    assert.equal(v3OnlyConfirmed.isError, undefined);
    assert.equal(serverCalls.length, 3);
    assert.equal(serverCalls[2]?.TargetMode, 'V3Only');
    assert.equal(serverCalls[2]?.TargetMinProtocol, 3);

    const rejectedCases: Array<{ name: string; params: Record<string, unknown>; message: RegExp }> = [
      {
        name: 'direct LegacyOpen to V3Only',
        params: { ...baseParams, targetMode: 'V3Only' },
        message: /禁止 LegacyOpen 直接切换到 V3Only/,
      },
      {
        name: 'V3Only rollback',
        params: {
          ...baseParams,
          expectedMode: 'V3Only',
          expectedMinProtocol: 3,
          expectedGateEpoch: '8',
          targetMode: 'Drain',
        },
        message: /禁止从 V3Only 降级或再次转换/,
      },
      {
        name: 'tenant coordinate mismatch',
        params: { ...baseParams, osClientNetwork: 'External' },
        message: /租户坐标不匹配/,
      },
      {
        name: 'non-canonical epoch',
        params: { ...baseParams, expectedGateEpoch: '07' },
        message: /规范非负十进制字符串/,
      },
      {
        name: 'mode/min protocol mismatch',
        params: { ...baseParams, expectedMinProtocol: 3 },
        message: /ExpectedMinProtocol=2/,
      },
      {
        name: 'non-canonical proof',
        params: {
          ...baseParams,
          drainProofJson: '{ "nodes": [], "activeV2Publishes": 0 }',
          drainProofHash: crypto.createHash('sha256')
            .update('{ "nodes": [], "activeV2Publishes": 0 }', 'utf8')
            .digest('hex'),
        },
        message: /canonical JSON/,
      },
      {
        name: 'proof hash mismatch',
        params: { ...baseParams, drainProofHash: 'f'.repeat(64) },
        message: /SHA-256 不一致/,
      },
    ];

    for (const rejected of rejectedCases) {
      const callCountBefore: number = serverCalls.length;
      const result = await client.callTool({
        name: 'microi_codex',
        arguments: {
          action: 'microi_transition_application_stream_gate',
          params: {
            ...rejected.params,
            confirmExecution: true,
            confirmationSha256: previewJson.ConfirmationSha256,
          },
        },
      }) as CallToolResult;
      assert.equal(result.isError, true, rejected.name);
      assert.match(toolText(result), rejected.message, rejected.name);
      assert.equal(serverCalls.length, callCountBefore, `${rejected.name} must cause zero server calls`);
    }
  } finally {
    await client.close();
    await server.close();
  }
});
