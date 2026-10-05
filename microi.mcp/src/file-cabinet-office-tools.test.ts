import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './server.js';
import type { MicroiClient } from './microi-client.js';
import { MicroiClient as HttpMicroiClient } from './microi-client.js';
import http from 'node:http';

test('file cabinet Office discovery routes exact tenant object context and propagates authorization failure', async () => {
  const calls: Array<{ operation: string; args: unknown[] }> = [];
  const fakeClient = {
    listFileCabinetObjects: async (...args: unknown[]) => {
      calls.push({ operation: 'list', args });
      return { Code: 1, Data: { Files: [{ FullPath: '/itdos/docs/A.docx' }] }, Msg: '' };
    },
    getFileCabinetOfficeMeta: async (...args: unknown[]) => {
      calls.push({ operation: 'meta', args });
      return { Code: 0, Data: null, Msg: '指定菜单不是权威文件柜菜单！' };
    },
  } as unknown as MicroiClient;

  const server = createMcpServer(fakeClient, {
    osClient: 'iTdos', apiBaseUrl: 'https://api.itdos.com', label: '吾码官方', codexMode: true,
  });
  const client = new Client({ name: 'microi-file-cabinet-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const catalog = await client.callTool({
      name: 'microi_codex', arguments: { action: 'list_tools', params: { keyword: 'file_cabinet' } },
    }) as CallToolResult;
    const catalogText = catalog.content[0]?.type === 'text' ? catalog.content[0].text : '';
    assert.match(catalogText, /microi_list_file_cabinet_objects/);
    assert.match(catalogText, /microi_get_file_cabinet_office_meta/);

    const listed = await client.callTool({
      name: 'microi_codex', arguments: {
        action: 'microi_list_file_cabinet_objects', params: { path: '/itdos/docs/', limit: false },
      },
    }) as CallToolResult;
    assert.equal(listed.isError, undefined);
    assert.deepEqual(calls[0], { operation: 'list', args: ['/itdos/docs/', false] });

    const rejected = await client.callTool({
      name: 'microi_codex', arguments: {
        action: 'microi_get_file_cabinet_office_meta',
        params: { filePathName: '/itdos/docs/A.docx', sysMenuId: 'wrong-menu', limit: false },
      },
    }) as CallToolResult;
    assert.equal(rejected.isError, true);
    assert.deepEqual(calls[1], { operation: 'meta', args: ['/itdos/docs/A.docx', 'wrong-menu', false] });
    assert.match(JSON.stringify(rejected.content), /权威文件柜菜单/);
  } finally {
    await client.close();
    await server.close();
  }
});

test('empty marker MCP is dry-run by default and only sends explicit exact-key execution', async () => {
  const calls: unknown[][] = [];
  const fake = { deleteEmptyDirectoryMarker: async (...args: unknown[]) => {
    calls.push(args); return { Code: 0, Msg: '目录非空', Data: { OutcomeUnknown: false } };
  } } as unknown as MicroiClient;
  const server = createMcpServer(fake, { osClient: 'itdos', apiBaseUrl: 'http://fixture.test', label: '测试租户', codexMode: true });
  const client = new Client({ name: 'marker-tools-test', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
  const path = '/itdos/file/attempt-original/';
  const call = (params: Record<string, unknown>) => client.callTool({ name: 'microi_codex', arguments: { action: 'microi_delete_empty_directory_marker', params } }) as Promise<CallToolResult>;
  try {
    const dry = await call({ filePathName: path, limit: true });
    assert.match(JSON.stringify(dry), /dryRun/);
    assert.equal(calls.length, 0);
    await call({ filePathName: path, limit: true, confirmExecution: 'different-key' });
    assert.equal(calls.length, 0);
    const missingBucket = await call({ filePathName: path, confirmExecution: path });
    assert.equal(missingBucket.isError, true);
    const missingSlash = await call({ filePathName: path.slice(0, -1), limit: true, confirmExecution: path.slice(0, -1) });
    assert.equal(missingSlash.isError, true);
    assert.equal(calls.length, 0);
    const result = await call({ filePathName: path, limit: true, confirmExecution: path });
    assert.equal(result.isError, true);
    assert.deepEqual(calls, [[path, true]]);
    assert.match(JSON.stringify(result), /目录非空/);
  } finally { await client.close(); await server.close(); }
});

for (const fault of ['old-backend-404', 'unknown-disconnect', 'unverified-success', 'verified-success'] as const) {
  test(`empty marker HTTP ${fault} never falls back to ordinary recursive delete`, async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        requests.push({ path: req.url || '', body: JSON.parse(Buffer.concat(chunks).toString()) });
        if (fault === 'unknown-disconnect') { req.socket.destroy(); return; }
        if (fault === 'old-backend-404') { res.writeHead(404); res.end('missing safe route'); return; }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ Code: 1, Data: fault === 'verified-success'
          ? { DeletionMode: 'EmptyDirectoryMarkerOnly', VerifiedAbsent: true }
          : { FilePathName: '/itdos/file/attempt-original/' } }));
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const client = new HttpMicroiClient({ apiBaseUrl: `http://127.0.0.1:${address.port}`, osClient: 'itdos', username: '', password: '', token: 'fixture-token', requestTimeoutMs: 2000 });
    try {
      if (fault === 'verified-success') assert.equal((await client.deleteEmptyDirectoryMarker('/itdos/file/attempt-original/', true)).Code, 1);
      else await assert.rejects(() => client.deleteEmptyDirectoryMarker('/itdos/file/attempt-original/', true));
      assert.deepEqual(requests, [{ path: '/api/HDFS/DeleteEmptyDirectoryMarker', body: {
        OsClient: 'itdos', FilePathName: '/itdos/file/attempt-original/', Limit: true, EmptyDirectoryOnly: true,
      } }]);
    } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
}
