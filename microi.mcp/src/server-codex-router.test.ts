import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './server.js';
import type { MicroiClient } from './microi-client.js';

test('microi_codex discovers and invokes existing tools through one entry point', async () => {
  const fakeClient = {
    getStatus: async () => ({
      Code: 1,
      Data: { OsClient: 'junchi', Online: true },
    }),
  } as unknown as MicroiClient;
  const server = createMcpServer(fakeClient, {
    osClient: 'junchi',
    apiBaseUrl: 'https://api.chongstech.com',
    label: '宁波鸿地',
    codexMode: true,
  });
  const client = new Client({ name: 'microi-router-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  try {
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 1);
    assert.ok(tools.tools.some(tool => tool.name === 'microi_codex'));

    const resources = await client.listResources();
    assert.ok(resources.resources.some(resource => resource.uri === 'microi://codex/status'));
    assert.ok(resources.resources.some(resource => resource.uri === 'microi://codex/tools'));

    const templates = await client.listResourceTemplates();
    assert.ok(templates.resourceTemplates.some(template => template.uriTemplate === 'microi://codex/action/{action}/{params}'));

    const resourceStatus = await client.readResource({
      uri: 'microi://codex/action/microi_get_status/%7B%7D',
    });
    const firstResourceContent = resourceStatus.contents[0];
    const resourceStatusText = firstResourceContent && 'text' in firstResourceContent
      ? firstResourceContent.text
      : '';
    assert.match(resourceStatusText, /junchi/);

    const catalog = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'list_tools', params: { keyword: 'status' } },
    }) as CallToolResult;
    const catalogText = catalog.content[0]?.type === 'text' ? catalog.content[0].text : '';
    assert.match(catalogText, /microi_get_status/);

    const status = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'microi_get_status', params: {} },
    }) as CallToolResult;
    const statusText = status.content[0]?.type === 'text' ? status.content[0].text : '';
    assert.match(statusText, /junchi/);

    const invalid = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'microi_get_table_data', params: {} },
    }) as CallToolResult;
    const invalidText = invalid.content[0]?.type === 'text' ? invalid.content[0].text : '';
    assert.equal(invalid.isError, true);
    assert.match(invalidText, /Invalid tool parameters/);
  } finally {
    await client.close();
    await server.close();
  }
});
