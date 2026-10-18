import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server.js';
import { MicroiClient } from './microi-client.js';
import { buildSourceRead, createContextReadScope, readPage } from './context-reading.js';

async function fixture(overrides: Record<string, unknown> = {}, tenant = 'fixture') {
  const calls: Record<string, any>[] = [];
  const tables = Array.from({ length: 4 }, (_, i) => ({
    Id: `t${i}`, Name: `biz_${i}`, Description: `业务 ${i}`,
    Fields: Array.from({ length: 3 }, (_, j) => ({ Name: `Field${j}`, Label: `字段 ${j}`, Type: 'varchar(80)', Component: 'Text' })),
  }));
  const files = [
    { FilePath: 'src/main.ts', Size: 24, HdfsPath: 'private/src/main.ts' },
    { FilePath: 'src/view.vue', Size: 20, HdfsPath: 'private/src/view.vue' },
    { FilePath: 'assets/logo.png', Size: 4, HdfsPath: 'private/assets/logo.png' },
  ];
  const fake = {
    getDbSchema: async () => ({ Code: 1, Msg: 'ok', Data: { Tables: tables } }),
    listApplications: async (args: Record<string, unknown>) => {
      calls.push({ action: 'list', ...args });
      return { Code: 1, Msg: 'ok', Data: { Count: 3, Applications: [0, 1, 2].map(i => ({
        Id: `a${i}`, AppKey: `app${i}`, Name: `应用 ${i}`, ApplicationType: 'Web', Status: 1,
        ...(args.IncludeFiles ? { Files: files } : {}),
      })) } };
    },
    getApplicationContext: async (args: Record<string, unknown>) => {
      calls.push({ action: 'context', ...args });
      return { Code: 1, Data: { Application: { Id: 'a0', AppKey: 'app0', Permission: { CanRead: true } }, Files: files, FileCount: 3, SourceManifestHash: 'source-v1' } };
    },
    getApplicationFile: async (args: Record<string, any>) => {
      calls.push({ action: 'file', ...args });
      const meta = files.find(file => file.FilePath === args.FilePath)!;
      return { Code: 1, Msg: 'ok', Data: { Application: { Id: 'a0', AppKey: 'app0', Permission: { CanRead: true } }, File: {
        ...meta, ...(args.IncludeContents ? args.FilePath.endsWith('.png')
          ? { FileByteBase64: 'AAECAw==', ContentEncoding: 'base64' }
          : { Content: 'one\ntwo target\nthree\nfour target\nfive', ContentEncoding: 'utf-8' } : {}),
      } } };
    },
    ...overrides,
  } as unknown as MicroiClient;
  const server = createMcpServer(fake, { osClient: tenant, apiBaseUrl: 'https://fixture.test', label: 'context test', codexMode: true });
  const client = new Client({ name: 'context-reading-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    calls,
    instructions: client.getInstructions() || '',
    async call(action: string, params: Record<string, unknown> = {}) {
      const result = await client.callTool({ name: 'microi_codex', arguments: { action, params } });
      const text = (result.content as Array<{ type: string; text?: string }>).find(item => item.type === 'text')?.text || '';
      return { result, data: (() => { try { return JSON.parse(text); } catch { return { text }; } })() as any };
    },
    async close() { await client.close(); await server.close(); },
  };
}

test('Schema 默认只回表摘要且分页可以完整遍历，字段数不是已读取字段', async () => {
  const f = await fixture();
  try {
    const first = (await f.call('microi_get_db_schema', { pageSize: 2 })).data;
    assert.equal(first.Data.Tables.length, 2);
    assert.equal(first.Data.Tables[0].FieldCount, 3);
    assert.equal(first.Data.Tables[0].Fields, undefined);
    assert.equal(first.Data.Paging.hasMore, true);
    assert.equal(first.Data.Completeness.detailsIncluded, false);
    const second = (await f.call('microi_get_db_schema', { pageSize: 2, cursor: first.Data.Paging.nextCursor })).data;
    assert.equal(second.Data.Paging.hasMore, false);
    assert.deepEqual([...first.Data.Tables, ...second.Data.Tables].map(t => t.Name), ['biz_0', 'biz_1', 'biz_2', 'biz_3']);
  } finally { await f.close(); }
});

test('Schema 精确表集合与字段筛选保留真实类型，字段可跨页遍历', async () => {
  const f = await fixture();
  try {
    const params = { detail: 'fields', tableNames: ['biz_1'], fieldNames: ['Field1', 'Field2'], pageSize: 1 };
    const a = (await f.call('microi_get_db_schema', params)).data;
    assert.equal(a.Data.Tables[0].Name, 'biz_1');
    assert.equal(a.Data.Tables[0].Fields[0].Name, 'Field1');
    const b = (await f.call('microi_get_db_schema', { ...params, cursor: a.Data.Paging.nextCursor })).data;
    assert.equal(b.Data.Tables[0].Fields[0].Name, 'Field2');
    assert.equal(b.Data.Tables[0].Fields[0].Type, 'varchar(80)');
    assert.equal(b.Data.Paging.hasMore, false);
  } finally { await f.close(); }
});

test('分页游标不能跨租户或查询范围复用，源变化必须重读', async () => {
  const a = await fixture(); const b = await fixture({}, 'another');
  try {
    const page = (await a.call('microi_get_db_schema', { pageSize: 1 })).data;
    assert.equal((await b.call('microi_get_db_schema', { pageSize: 1, cursor: page.Data.Paging.nextCursor })).result.isError, true);
    assert.equal((await a.call('microi_get_db_schema', { tableName: 'biz_2', cursor: page.Data.Paging.nextCursor })).result.isError, true);
  } finally { await a.close(); await b.close(); }
});

test('应用发现默认不读取所有应用文件清单，分页明确标出未返回部分', async () => {
  const f = await fixture();
  try {
    const page = (await f.call('microi_list_applications', { pageSize: 1 })).data;
    assert.equal(f.calls[0].IncludeFiles, false);
    assert.equal(page.Data.Applications.length, 1);
    assert.equal(page.Data.Paging.hasMore, true);
    assert.equal(page.Data.Completeness.filesIncluded, false);
  } finally { await f.close(); }
});

test('应用上下文先取清单，仅加载选中文件正文并保留权限字段', async () => {
  const f = await fixture();
  try {
    const page = (await f.call('microi_get_application_context', { appIdOrKey: 'app0', filePaths: ['src/main.ts'], includeContents: true })).data;
    assert.equal(f.calls[0].IncludeContents, false);
    assert.equal(page.Data.Files.length, 1);
    assert.equal(page.Data.Files[0].FilePath, 'src/main.ts');
    assert.equal(page.Data.Application.Permission.CanRead, true);
    assert.equal(f.calls.filter(c => c.action === 'file' && c.IncludeContents).length, 1);
    assert.equal(page.Data.Completeness.allFilesSelected, false);
  } finally { await f.close(); }
});

test('单文件按行读取与搜索有明确游标，结果不能伪装为完整源码', async () => {
  const f = await fixture();
  try {
    const range = (await f.call('microi_get_application_file', { appIdOrKey: 'app0', filePath: 'src/main.ts', startLine: 2, endLine: 3 })).data;
    assert.equal(range.Data.File.Content, 'two target\nthree');
    assert.equal(range.Data.ReadSummary.completeFile, false);
    const search = (await f.call('microi_get_application_file', { appIdOrKey: 'app0', filePath: 'src/main.ts', query: 'target', pageSize: 1 })).data;
    assert.equal(search.Data.Matches[0].line, 2);
    assert.equal(search.Data.Paging.hasMore, true);
    const next = (await f.call('microi_get_application_file', { appIdOrKey: 'app0', filePath: 'src/main.ts', query: 'target', pageSize: 1, cursor: search.Data.Paging.nextCursor })).data;
    assert.equal(next.Data.Matches[0].line, 4);
  } finally { await f.close(); }
});

test('二进制默认只返回可继续读取的引用，显式 full 才返回 Base64', async () => {
  const f = await fixture();
  try {
    const ref = (await f.call('microi_get_application_file', { appIdOrKey: 'app0', filePath: 'assets/logo.png' })).data;
    assert.equal(ref.Data.File.FileByteBase64, undefined);
    assert.equal(ref.Data.FileReference.filePath, 'assets/logo.png');
    assert.equal(f.calls.some(c => c.action === 'file' && c.IncludeContents), false);
    const full = (await f.call('microi_get_application_file', { appIdOrKey: 'app0', filePath: 'assets/logo.png', detail: 'full' })).data;
    assert.equal(full.Data.File.FileByteBase64, 'AAECAw==');
  } finally { await f.close(); }
});

test('权限失败保留原 Code、Msg、Data 和 DataAppend，不转成空成功结果', async () => {
  const error = { Code: 1002, Msg: '拒绝访问', Data: { Permission: 'denied' }, DataAppend: { TraceId: 'trace-1' } };
  const f = await fixture({ getDbSchema: async () => error });
  try {
    const got = await f.call('microi_get_db_schema');
    assert.equal(got.result.isError, true);
    assert.deepEqual(got.data, error);
  } finally { await f.close(); }
});

test('工具发现默认有界，可继续翻页且 describe 保留完整说明', async () => {
  const f = await fixture();
  try {
    const page = (await f.call('list_tools', { pageSize: 2 })).data;
    assert.equal(page.tools.length, 2);
    assert.equal(page.Paging.hasMore, true);
    const detail = (await f.call('describe_tool', { name: 'microi_get_application_file' })).data;
    assert.ok(detail.params.startLine);
    assert.ok(detail.params.query);
  } finally { await f.close(); }
});

test('初始化仅注入短路由但保留完整开发、局部依赖和真实验收要求', async () => {
  const f = await fixture();
  try {
    assert.ok(f.instructions.length < 6000);
    assert.match(f.instructions, /原 1–8.*后续增补/);
    assert.match(f.instructions, /菜单先行/);
    assert.match(f.instructions, /老板经营.*领导管理/);
    assert.match(f.instructions, /依赖闭包.*扩大读取/);
    assert.match(f.instructions, /远端回读/);
    assert.match(f.instructions, /部分源码不能覆盖保存成完整源码/);
    assert.doesNotMatch(f.instructions, /\| chart-bar \|/);
  } finally { await f.close(); }
});

test('连接指纹随真实会话或租户坐标改变且不暴露 Token', () => {
  const a = new MicroiClient({ apiBaseUrl: 'https://fixture.test/', osClient: 'fixture', osClientType: 'SaaS', username: 'user', password: '', token: 'token-a' });
  const b = new MicroiClient({ apiBaseUrl: 'https://fixture.test', osClient: 'fixture', osClientType: 'Other', username: 'user', password: '', token: 'token-a' });
  assert.match(a.getContextIdentity(), /^[a-f0-9]{64}$/);
  assert.notEqual(a.getContextIdentity(), b.getContextIdentity());
  const before = a.getContextIdentity();
  (a as unknown as { token: string }).token = 'token-b';
  assert.notEqual(a.getContextIdentity(), before);
});

function schemaClient(handler: (name: string, query: Record<string, any>) => Promise<any>) {
  const client = new MicroiClient({ apiBaseUrl: 'https://fixture.test', osClient: 'fixture', username: 'user', password: '', token: 'fixture-token' });
  client.getTableData = handler;
  return client;
}

test('Schema 表摘要通过受保护 FormEngine 下推筛选且完全不查询字段正文', async () => {
  const calls: Array<{ name: string; query: Record<string, any> }> = [];
  const client = schemaClient(async (name, query) => {
    calls.push({ name, query });
    return { Code: 1, Msg: 'ok', Data: [{ Id: 't1', Name: 'biz_order', Description: '订单' }], DataCount: 1, DataAppend: { Permission: 'admin-verified' } };
  });
  const result = await client.getDbSchema({ detail: 'summary', tableNames: ['biz_order'] });
  assert.equal(result.Code, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'diy_table');
  assert.deepEqual(calls[0].query._Where, [['Name', 'In', ['biz_order']]]);
  assert.deepEqual(calls[0].query._SelectFields, ['Id', 'Name', 'Description']);
  assert.equal(result.Data.Tables[0]._Fields, undefined);
  assert.equal(result.Data.ReadSource?.mode, 'form-engine-scoped');
  assert.equal(result.DataAppend?.Permission, 'admin-verified');
});

test('Schema 字段下推仅查询所选 TableId/字段名，重建 TableChild 关联语义', async () => {
  let query: Record<string, any> = {};
  const client = schemaClient(async (name, input) => {
    if (name === 'diy_table') return { Code: 1, Msg: 'ok', Data: [{ Id: 't1', Name: 'biz_order', Description: '' }], DataCount: 1 };
    query = input;
    return { Code: 1, Msg: 'ok', Data: [{ Id: 'f1', TableId: 't1', Name: 'Items', Type: 'varchar', Config: '{"TableChildTableId":"child","TableChildSysMenuId":"menu"}' }], DataCount: 1 };
  });
  const result = await client.getDbSchema({ detail: 'fields', tableNames: ['biz_order'], fieldNames: ['Items'] });
  assert.deepEqual(query._Where, [['TableId', 'In', ['t1']], ['Name', 'In', ['Items']]]);
  assert.equal((result.Data.Tables[0]._Fields![0] as any).TableChildTableId, 'child');
  assert.equal((result.Data.Tables[0]._Fields![0] as any).TableChildSysMenuId, 'menu');
  assert.equal((result.Data.Tables[0]._Fields![0] as any).Config, undefined);
});

test('Schema 分页按 DataCount 读取全部页，不能把第一页或短页当完整', async () => {
  const pages: number[] = [];
  const client = schemaClient(async (_name, query) => {
    pages.push(query._PageIndex);
    const rows = query._PageIndex === 1 ? [{ Id: 't1', Name: 'biz_a' }] : [{ Id: 't2', Name: 'biz_b' }];
    return { Code: 1, Msg: 'ok', Data: rows, DataCount: 2 };
  });
  const result = await client.getDbSchema({ detail: 'summary' });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(result.Data.Tables.length, 2);
  assert.equal(result.Data.ReadSource?.tablesComplete, true);
});

test('Schema 计数缺失、漂移、重复或超出安全范围时失败关闭，不回退权限路径', async () => {
  for (const mode of ['missing', 'drift', 'duplicate', 'over-cap', 'outside-id']) {
    const client = schemaClient(async (name, query) => {
      if (mode === 'missing') return { Code: 1, Msg: 'ok', Data: [{ Id: 't1', Name: 'biz_a' }] };
      if (mode === 'over-cap') return { Code: 1, Msg: 'ok', Data: [], DataCount: 10001 };
      if (mode === 'outside-id') return name === 'diy_table'
        ? { Code: 1, Msg: 'ok', Data: [{ Id: 't1', Name: 'biz_a' }], DataCount: 1 }
        : { Code: 1, Msg: 'ok', Data: [{ Id: 'f1', Name: 'A', TableId: 'another' }], DataCount: 1 };
      return { Code: 1, Msg: 'ok', Data: [{ Id: 't1', Name: 'biz_a' }], DataCount: mode === 'drift' && query._PageIndex === 2 ? 3 : 2 };
    });
    const result = await client.getDbSchema({ detail: mode === 'outside-id' ? 'fields' : 'summary' });
    assert.equal(result.Code, 0, mode);
    assert.equal(result.DataAppend?.ReasonCode, 'SCHEMA_READ_INCOMPLETE', mode);
  }
});

test('Schema 权限拒绝原样返回，禁止改用旧端点绕过', async () => {
  const denied = { Code: 1002, Msg: 'admin required', Data: { denied: true }, DataAppend: { Permission: 'denied' } };
  const client = schemaClient(async () => denied);
  assert.deepEqual(await client.getDbSchema({ detail: 'fields', tableNames: ['biz_order'] }), denied);
});

test('游标源变化、篡改和会话轮换失效，正文预算不静默截断', () => {
  let identity = 'tenant-a';
  const scope = createContextReadScope(() => identity);
  const first = readPage(scope, { action: 'fixture' }, ['a', 'b'], { pageSize: 1 });
  assert.throws(() => readPage(scope, { action: 'fixture' }, ['a', 'changed'], { cursor: first.Paging.nextCursor! }), /快照已变化/);
  assert.throws(() => readPage(scope, { action: 'fixture' }, ['a', 'b'], { cursor: `${first.Paging.nextCursor}x` }), /不属于当前连接/);
  identity = 'tenant-b';
  assert.throws(() => readPage(scope, { action: 'fixture' }, ['a', 'b'], { cursor: first.Paging.nextCursor! }), /连接.*已变化/);
  assert.throws(() => readPage(scope, {}, ['x'.repeat(2000)], { maxChars: 1000 }), /未返回不完整项/);
});

test('未登录或明确过期会话不签发上下文身份', () => {
  const client = new MicroiClient({ apiBaseUrl: 'https://fixture.test', osClient: 'fixture', username: '', password: '' });
  assert.equal(client.getContextIdentity(), '');
  (client as unknown as { token: string }).token = `x.${Buffer.from(JSON.stringify({ exp: 1 })).toString('base64url')}.x`;
  assert.equal(client.getContextIdentity(), '');
});

test('源码读取失败与缺失的指定路径显式返回，不宣称完整源码', async () => {
  const f = await fixture({ getApplicationFile: async () => ({ Code: 1, Msg: 'ok', Data: { Application: { Id: 'a0' }, File: { FilePath: 'src/main.ts', ContentReadError: 'HDFS denied' } } }) });
  try {
    const got = (await f.call('microi_get_application_file', { appIdOrKey: 'app0', filePath: 'src/main.ts' })).data;
    assert.equal(got.Data.File.ContentReadError, 'HDFS denied');
    assert.equal(got.Data.ReadSummary.completeFile, false);
    const missing = await f.call('microi_get_application_context', { appIdOrKey: 'app0', filePaths: ['missing.ts'], includeContents: true });
    assert.equal(missing.result.isError, true);
    assert.equal(missing.data.Code, 2);
    assert.deepEqual(missing.data.Data.MissingFilePaths, ['missing.ts']);
  } finally { await f.close(); }
});

test('Schema 多页或表到字段之间身份变化必须丢弃结果，不能混合两个权限主体', async () => {
  for (const stage of ['table-page', 'table-to-field']) {
    let client: MicroiClient;
    let calls = 0;
    client = schemaClient(async (name) => {
      calls++;
      if (stage === 'table-page' || name === 'diy_field') (client as unknown as { token: string }).token = 'another-user-token';
      return { Code: 1, Msg: 'ok', Data: [{ Id: calls === 1 ? 't1' : 'f1', Name: 'OnlyVisibleToOneUser', ...(name === 'diy_field' ? { TableId: 't1' } : {}) }], DataCount: stage === 'table-page' ? 2 : 1 };
    });
    const result = await client.getDbSchema({ detail: stage === 'table-page' ? 'summary' : 'fields' });
    assert.equal(result.Code, 0);
    assert.equal(result.Data, null);
    assert.match(result.Msg, /身份.*变化/);
  }
});

test('应用清单与正文之间身份变化失败关闭，不把旧主体元数据签给新主体', async () => {
  let identity = 'user-a';
  const f = await fixture({
    getContextIdentity: () => identity,
    getApplicationFile: async (args: Record<string, any>) => {
      if (args.IncludeContents) identity = 'user-b';
      return { Code: 1, Msg: 'ok', Data: { Application: { Id: 'a0' }, File: { FilePath: 'src/main.ts', Content: 'private-content' } } };
    },
  });
  try {
    const got = await f.call('microi_get_application_context', { appIdOrKey: 'app0', filePaths: ['src/main.ts'], includeContents: true });
    assert.equal(got.result.isError, true);
    assert.doesNotMatch(JSON.stringify(got.data), /private-content/);
    assert.match(JSON.stringify(got.data), /身份.*变化/);
  } finally { await f.close(); }
});

test('完整源码保留 CRLF 与尾随换行，分页显式提供原始边界和正文哈希', () => {
  const scope = createContextReadScope(() => 'fixture');
  const source = 'first\r\nsecond\r\n';
  const data = { File: { FilePath: 'src/main.ts', Content: source, ContentEncoding: 'utf-8' } };
  const whole = buildSourceRead(scope, 'app0', 'src/main.ts', data, {});
  assert.equal((whole.File as any).Content, source);
  assert.equal(whole.ReadSummary.completeFile, true);
  assert.equal((whole.ReadSummary as any).sourceSha256, crypto.createHash('sha256').update((whole.File as any).Content).digest('hex'));
  const first = buildSourceRead(scope, 'app0', 'src/main.ts', data, { pageSize: 1 });
  assert.equal((first.ReadSummary as any).followingLineEnding, '\r\n');
  assert.equal((first.ReadSummary as any).lineEndingsNormalized, false);
});

test('字段投影保留关联引用并明确完整控件配置未读取及下一步工具', async () => {
  const client = schemaClient(async (name) => name === 'diy_table'
    ? { Code: 1, Msg: 'ok', Data: [{ Id: 't1', Name: 'biz_order' }], DataCount: 1 }
    : { Code: 1, Msg: 'ok', Data: [{ Id: 'f1', TableId: 't1', Name: 'Customer', Config: '{"TableId":"customers","TableChildFkFieldName":"OrderId"}' }], DataCount: 1 });
  const got = await client.getDbSchema({ detail: 'fields' });
  const field = got.Data.Tables[0]._Fields![0] as any;
  assert.equal(field.RelationReferences.TableId, 'customers');
  assert.equal(field.TableChildFkFieldName, 'OrderId');
  assert.equal(field.ConfigIncluded, false);
  assert.equal(field.FullDefinitionRead.action, 'microi_get_field_list');
  assert.equal(got.Data.ReadSource?.fieldDefinitionsComplete, false);
});
