import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './server.js';
import type { MicroiClient } from './microi-client.js';

test('oversized constrained arrays stop before allocating an issue for every element', () => {
  let itemChecks = 0;
  const schema = z.array(z.unknown().superRefine((_value, ctx) => {
    itemChecks++;
    ctx.addIssue({ code: 'custom', message: 'invalid item' });
  })).max(2);
  const result = schema.safeParse(Array.from({ length: 20_000 }, () => null));
  assert.equal(result.success, false);
  assert.equal(itemChecks, 0);
  assert.deepEqual(result.error?.issues.map(issue => issue.code), ['too_big']);
});

test('patched SDK and Zod preserve real tool discovery, record arguments and validation boundaries', async () => {
  const calls: unknown[] = [];
  const remote = { getTableData: async (table: string, query: unknown) => {
    calls.push({ table, query });
    return { Code: 1, Data: [{ Name: 'fixture' }] };
  } } as unknown as MicroiClient;
  const server = createMcpServer(remote, { osClient: 'fixture', apiBaseUrl: 'https://fixture.invalid', label: 'dependency contract' });
  const client = new Client({ name: 'dependency-contract', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const readText = (result: CallToolResult) => {
    const text = result.content.find(item => item.type === 'text');
    assert.ok(text && text.type === 'text');
    return JSON.parse(text.text);
  };
  try {
    const tool = (await client.listTools()).tools.find(item => item.name === 'microi_get_table_data');
    assert.ok(tool);
    assert.equal(tool.inputSchema.type, 'object');
    assert.ok(tool.inputSchema.required?.includes('tableName'));
    const description = readText(await client.callTool({ name: 'microi_codex', arguments: {
      action: 'describe_tool', params: { name: 'microi_get_table_data' },
    } }) as CallToolResult);
    assert.equal(description.params.query.type, 'record');
    assert.equal(description.params.query.required, false);
    const query = { _Where: [['Name', '=', 'fixture']], _PageSize: 1, custom: { nested: [null, true, 3] } };
    assert.deepEqual(readText(await client.callTool({ name: 'microi_get_table_data', arguments: { tableName: 'Biz_Fixture', query } }) as CallToolResult), [{ Name: 'fixture' }]);
    assert.deepEqual(calls, [{ table: 'Biz_Fixture', query }]);
    const invalid = await client.callTool({ name: 'microi_get_table_data', arguments: { tableName: 'Biz_Fixture', query: false } }) as CallToolResult;
    assert.equal(invalid.isError, true);
    assert.equal(calls.length, 1, 'invalid input must not cross the client boundary');
  } finally { await client.close(); await server.close(); }
});
