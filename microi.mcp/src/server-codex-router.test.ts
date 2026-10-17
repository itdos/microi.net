import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createMcpServer } from './server.js';
import { MicroiClient } from './microi-client.js';

test('MicroService module dry run uses the selected tenant and preserves explicit legacy URLs', async () => {
  const server = createMcpServer({} as MicroiClient, {
    osClient: 'loctek', apiBaseUrl: 'https://api.example.test', label: 'tenant route test',
  });
  const client = new Client({ name: 'microservice-route-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    for (const explicitUrl of [undefined, '/micro-app/microi-3d-engine/designer']) {
      const result = await client.callTool({ name: 'microi_create_module', arguments: {
        name: '3D engine', openType: 'MicroService', microServiceId: 'service-1',
        microServicePageId: 'page-1', microServiceKey: 'microi-3d-engine',
        microServiceRoutePath: '/designer', ...(explicitUrl ? { url: explicitUrl } : {}),
      } }) as CallToolResult;
      assert.notEqual(result.isError, true, JSON.stringify(result.content));
      const text = result.content.find(item => item.type === 'text');
      assert.ok(text && text.type === 'text');
      const preview = JSON.parse(text.text);
      assert.equal(preview.dryRun, true);
      assert.equal(preview.module.Url, explicitUrl || '/micro-app/loctek/microi-3d-engine/designer');
    }
  } finally {
    await client.close();
    await server.close();
  }
});

test('普通 MCP 宿主初始化也收到跨模型的版本与自动更新基础规则', async () => {
  const server = createMcpServer({} as MicroiClient, {
    osClient: 'fixture', apiBaseUrl: 'https://api.example.test', label: '基础入口验收',
  });
  const client = new Client({ name: 'ordinary-mcp-host', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    assert.match(client.getInstructions() || '', /任何 AI 模型强制读取/);
    assert.match(client.getInstructions() || '', /Microi吾码开发工具版本/);
    assert.match(client.getInstructions() || '', /microi update --background/);
    assert.match(client.getInstructions() || '', /microi-system-delivery\/SKILL\.md/);
    assert.match(client.getInstructions() || '', /microi-system-delivery\/references\/progressive-01-标准工作流\.md/);
    assert.match(client.getInstructions() || '', /原 1–8.*后续增补/);
    assert.match(client.getInstructions() || '', /已读取的文件路径.*交付清单/s);
    assert.match(client.getInstructions() || '', /不能声称已自动加载/);
    assert.ok((await client.listTools()).tools.length > 1);
  } finally {
    await client.close();
    await server.close();
  }
});

test('microi_codex discovers and invokes existing tools through one entry point', async () => {
  let repairedAuditFieldsInput: { tableId?: string; tableName?: string } | undefined;
  const fakeClient = {
    getStatus: async () => ({
      Code: 1,
      Data: { OsClient: 'junchi', Online: true },
    }),
    repairFixedAuditFields: async (input: { tableId?: string; tableName?: string }) => {
      repairedAuditFieldsInput = input;
      return {
        Code: 1,
        Data: { TableName: input.tableName, Repaired: 6 },
      };
    },
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
    const instructions = client.getInstructions() || '';
    assert.match(instructions, /workspace-conventions\/SKILL\.md/);
    assert.match(instructions, /microi update --background/);
    assert.match(instructions, /Microi吾码开发工具版本/);
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

    const databaseCatalog = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'list_tools', params: { keyword: 'database' } },
    }) as CallToolResult;
    const databaseCatalogText = databaseCatalog.content[0]?.type === 'text'
      ? databaseCatalog.content[0].text
      : '';
    assert.match(databaseCatalogText, /microi_inspect_external_database/);
    assert.match(databaseCatalogText, /microi_execute_external_database/);
    assert.match(databaseCatalogText, /microi_save_database_connection/);

    const indexCatalog = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'list_tools', params: { keyword: 'index' } },
    }) as CallToolResult;
    const indexCatalogText = indexCatalog.content[0]?.type === 'text'
      ? indexCatalog.content[0].text
      : '';
    assert.match(indexCatalogText, /microi_get_table_indexes/);
    assert.match(indexCatalogText, /microi_create_table_index/);
    assert.match(indexCatalogText, /microi_drop_table_index/);

    const auditCatalog = await client.callTool({
      name: 'microi_codex',
      arguments: { action: 'list_tools', params: { keyword: 'audit' } },
    }) as CallToolResult;
    const auditCatalogText = auditCatalog.content[0]?.type === 'text'
      ? auditCatalog.content[0].text
      : '';
    assert.match(auditCatalogText, /microi_repair_audit_fields/);

    const auditRepair = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_repair_audit_fields',
        params: { tableName: 'biz_order' },
      },
    }) as CallToolResult;
    const auditRepairText = auditRepair.content[0]?.type === 'text'
      ? auditRepair.content[0].text
      : '';
    assert.equal(auditRepair.isError, undefined);
    assert.equal(repairedAuditFieldsInput?.tableName, 'biz_order');
    assert.equal(repairedAuditFieldsInput?.tableId, undefined);
    assert.match(auditRepairText, /"Repaired": 6/);

    const blockedIndexCreate = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_create_table_index',
        params: {
          tableName: 'biz_order',
          columns: ['OsClient', 'OrderNo'],
          unique: true,
        },
      },
    }) as CallToolResult;
    const blockedIndexCreateText = blockedIndexCreate.content[0]?.type === 'text'
      ? blockedIndexCreate.content[0].text
      : '';
    assert.equal(blockedIndexCreate.isError, true);
    assert.match(blockedIndexCreateText, /confirmExecution="biz_order"/);

    const administrativeSqlDryRun = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_execute_external_database',
        params: {
          dbKey: 'erp_sqlserver',
          mode: 'NonQuery',
          sql: 'DROP TABLE audit_example',
        },
      },
    }) as CallToolResult;
    const administrativeSqlDryRunText = administrativeSqlDryRun.content[0]?.type === 'text'
      ? administrativeSqlDryRun.content[0].text
      : '';
    assert.match(administrativeSqlDryRunText, /"dryRun": true/);
    assert.match(administrativeSqlDryRunText, /"sqlSha256": "[a-f0-9]{64}"/);
    assert.doesNotMatch(administrativeSqlDryRunText, /DROP TABLE/);

    const saveDryRun = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_save_database_connection',
        params: {
          dbKey: 'erp_sqlserver',
          databaseType: 'SqlServer',
          connectionString: 'Server=db.example;User Id=admin;Password=top-secret;',
        },
      },
    }) as CallToolResult;
    const saveDryRunText = saveDryRun.content[0]?.type === 'text' ? saveDryRun.content[0].text : '';
    assert.match(saveDryRunText, /"dryRun": true/);
    assert.doesNotMatch(saveDryRunText, /top-secret|db\.example|admin/);

    const attachmentDryRun = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_import_external_attachment',
        params: {
          sourceUrl: 'https://files.example.com/invoice.pdf?token=signed-secret',
          headers: { Authorization: 'Bearer header-secret' },
        },
      },
    }) as CallToolResult;
    const attachmentDryRunText = attachmentDryRun.content[0]?.type === 'text'
      ? attachmentDryRun.content[0].text
      : '';
    assert.match(attachmentDryRunText, /https:\/\/files\.example\.com\/\[REDACTED\]/);
    assert.doesNotMatch(attachmentDryRunText, /invoice\.pdf|signed-secret|header-secret/);

    const localAttachmentDryRun = await client.callTool({
      name: 'microi_codex',
      arguments: {
        action: 'microi_import_external_attachment',
        params: {
          sourcePath: '\\\\fileserver\\finance-secret\\annual-report-500mb.zip',
        },
      },
    }) as CallToolResult;
    const localAttachmentDryRunText = localAttachmentDryRun.content[0]?.type === 'text'
      ? localAttachmentDryRun.content[0].text
      : '';
    assert.match(localAttachmentDryRunText, /LOCAL_OR_UNC_SOURCE/);
    assert.doesNotMatch(localAttachmentDryRunText, /annual-report-500mb\.zip|finance-secret|fileserver/);

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

test('microi_codex executes the same CRM table, field, menu and API-engine writes as local Microi.Agent', async () => {
  const writes: Array<{ kind: string; value: unknown }> = [];
  const fakeClient = {
    createTable: async (name: string, description: string) => {
      writes.push({ kind: 'table', value: { name, description } });
      return { Code: 1, Data: { TableId: 'crm-table-id' } };
    },
    addField: async (field: Record<string, unknown>) => {
      writes.push({ kind: 'field', value: field });
      return { Code: 1 };
    },
    getFieldList: async () => ({ Code: 1, Data: [] }),
    createModule: async (module: Record<string, unknown>) => {
      writes.push({ kind: 'module', value: module });
      return { Code: 1, Data: { ModuleId: 'crm-module-id' } };
    },
    createEngine: async (engine: Record<string, unknown>) => {
      writes.push({ kind: 'engine', value: engine });
      return { Code: 1, Data: { Id: 'crm-engine-id' } };
    },
  } as unknown as MicroiClient;
  const server = createMcpServer(fakeClient, {
    osClient: 'iTdos', apiBaseUrl: 'http://localhost:61501',
    label: 'CRM test', codexMode: true,
  });
  const client = new Client({ name: 'online-ai-crm-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const invoke = async (action: string, params: Record<string, unknown>) =>
      client.callTool({ name: 'microi_codex', arguments: { action, params } }) as Promise<CallToolResult>;
    const table = await invoke('microi_create_table', { name: 'Crm_Customer', description: '客户信息' });
    const field = await invoke('microi_add_field', {
      tableId: 'crm-table-id', name: 'CustomerName', label: '客户名称', type: 'varchar(200)', component: 'Text',
    });
    const module = await invoke('microi_create_module', {
      name: '客户管理', diyTableId: 'crm-table-id', confirmExecution: '客户管理',
    });
    const engine = await invoke('microi_create_engine', {
      apiEngineKey: 'crm-customer-summary', apiName: 'CRM 客户汇总',
      code: 'return { Code: 1, Data: { Count: 0 } };',
    });
    for (const result of [table, field, module, engine])
      assert.notEqual(result.isError, true, JSON.stringify(result.content));
    assert.deepEqual(writes.map(write => write.kind), ['table', 'field', 'module', 'engine']);
    assert.equal((writes[1].value as Record<string, unknown>).TableId, 'crm-table-id');
    assert.equal((writes[2].value as Record<string, unknown>).DiyTableId, 'crm-table-id');
    assert.equal((writes[2].value as Record<string, unknown>).Display, 1);
    assert.equal((writes[2].value as Record<string, unknown>).AppDisplay, 1);
  } finally {
    await client.close();
    await server.close();
  }
});

async function withFieldToolHttpFixture(codexMode: boolean, run: (fixture: {
  client: Client;
  bodies: Array<Record<string, unknown>>;
  invoke: (params: Record<string, unknown>) => Promise<CallToolResult>;
}) => Promise<void>, toolName: 'microi_add_field' | 'microi_get_field_list' = 'microi_add_field'): Promise<void> {
  const bodies: Array<Record<string, unknown>> = [];
  const route = toolName === 'microi_add_field' ? '/api/V8Engine/AddField' : '/api/V8Engine/GetFieldList';
  const httpServer = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => { chunks.push(Buffer.from(chunk)); });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method !== 'POST' || req.url !== route) {
        res.statusCode = 404;
        res.end(JSON.stringify({ Code: 0, Msg: 'Unexpected fixture route' }));
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      bodies.push(body);
      if (toolName === 'microi_get_field_list') {
        if (body.TableId === 'permission-denied') {
          res.statusCode = 403;
          res.end(JSON.stringify({ Code: 0, Msg: 'Fixture permission denied' }));
        } else if (body.TableId === 'http-failed') {
          res.statusCode = 503;
          res.end(JSON.stringify({ Code: 0, Msg: 'Fixture unavailable' }));
        } else if (body.TableId === 'business-failed') {
          res.end(JSON.stringify({ Code: 0, Msg: 'Fixture table unavailable' }));
        } else res.end(JSON.stringify({ Code: 1, Data: [{ Id: 'fixture-field', Name: 'Title' }] }));
        return;
      }
      res.end(JSON.stringify({ Code: 1, Data: { FieldId: 'default-fixture-field' } }));
    });
  });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const apiBaseUrl = `http://127.0.0.1:${(httpServer.address() as { port: number }).port}`;
  const api = new MicroiClient({ apiBaseUrl, username: '', password: '', token: 'fixture', osClient: 'fixture' });
  const server = createMcpServer(api, { apiBaseUrl, osClient: 'fixture', label: 'default fixture', codexMode });
  const client = new Client({ name: 'add-field-default-fixture', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    await run({
      client, bodies,
      invoke: params => client.callTool(codexMode
        ? { name: 'microi_codex', arguments: { action: toolName, params } }
        : { name: toolName, arguments: params }) as Promise<CallToolResult>,
    });
  } finally {
    try { await client.close(); } finally {
      try { await server.close(); } finally {
        api.destroy();
        await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()));
      }
    }
  }
}

for (const codexMode of [false, true]) {
  const entry = codexMode ? 'codex' : 'native';
  test(`add_field defaultValue ${entry}: null/omitted省略HTTP正文，空串及原始字符串保持`, async () => {
    await withFieldToolHttpFixture(codexMode, async ({ invoke, bodies }) => {
      const values = [null, undefined, '', '0', '中文默认值 "quoted" \\ raw\nline'];
      for (const [index, defaultValue] of values.entries()) {
        const result = await invoke({ tableId: 'fixture-table', name: `Field${index}`, label: '默认值',
          ...(defaultValue === undefined ? {} : { defaultValue }) });
        assert.notEqual(result.isError, true, JSON.stringify(result.content));
        assert.equal(bodies.length, index + 1);
        const body = bodies[index]!;
        assert.equal(body.OsClient, 'fixture');
        assert.equal(body.TableId, 'fixture-table');
        assert.equal(body.Name, `Field${index}`);
        if (defaultValue === null || defaultValue === undefined) {
          assert.equal(Object.hasOwn(body, 'DefaultValue'), false);
        } else {
          assert.equal(body.DefaultValue, defaultValue);
        }
      }
    });
  });

  test(`add_field defaultValue ${entry}: 数字布尔对象数组在HTTP前拒绝，不放宽其它参数`, async () => {
    await withFieldToolHttpFixture(codexMode, async ({ invoke, bodies }) => {
      for (const defaultValue of [0, 1, false, true, {}, [], { value: 'raw' }]) {
        const result = await invoke({ tableId: 'fixture-table', name: 'Rejected', label: '拒绝', defaultValue });
        assert.equal(result.isError, true, JSON.stringify(result.content));
        if (codexMode) assert.equal((result._meta?.microiExecution as { state: string }).state, 'notExecuted');
        assert.equal(bodies.length, 0);
      }
      for (const invalid of [{ name: null }, { label: {} }, { tableId: null }, { type: 1 }]) {
        const result = await invoke({ tableId: 'fixture-table', name: 'Rejected', label: '拒绝', ...invalid });
        assert.equal(result.isError, true, JSON.stringify(result.content));
        assert.equal(bodies.length, 0);
      }
    });
  });
}

test('add_field defaultValue describe_tool保持string/optional并说明null和省略语义', async () => {
  await withFieldToolHttpFixture(true, async ({ client, bodies }) => {
    const result = await client.callTool({ name: 'microi_codex', arguments: {
      action: 'describe_tool', params: { name: 'microi_add_field' },
    } }) as CallToolResult;
    assert.notEqual(result.isError, true);
    const text = result.content.find(item => item.type === 'text');
    assert.ok(text && text.type === 'text');
    const description = JSON.parse(text.text);
    assert.equal(description.params.defaultValue.type, 'string');
    assert.equal(description.params.defaultValue.required, false);
    assert.match(description.params.defaultValue.description, /null.*omit.*unset/i);
    assert.equal(description.params.tableId.type, 'string');
    assert.equal(description.params.tableId.required, true);
    assert.equal(bodies.length, 0);
  });
});

for (const codexMode of [false, true]) {
  const entry = codexMode ? 'codex' : 'native';
  test(`get_field_list locator ${entry}: 缺两个locator及unknown keys明确notExecuted`, async () => {
    await withFieldToolHttpFixture(codexMode, async ({ invoke, bodies }) => {
      for (const params of [{}, { TableId: 'wrong-case-id' }, { TableName: 'wrong-case-name' }, { foreign: 'ignored' }]) {
        const result = await invoke(params);
        assert.equal(result.isError, true);
        assert.equal((result._meta?.microiExecution as { state?: string } | undefined)?.state, 'notExecuted');
        const text = result.content.find(item => item.type === 'text');
        assert.ok(text && text.type === 'text');
        const error = JSON.parse(text.text);
        assert.equal(error.errorCode, 'FIELD_LOCATOR_REQUIRED');
        assert.match(error.message, /tableId/);
        assert.match(error.message, /tableName/);
        assert.doesNotMatch(text.text, /wrong-case-id|wrong-case-name|foreign|ignored/);
        assert.equal(bodies.length, 0);
      }
    }, 'microi_get_field_list');
  });

  test(`get_field_list locator ${entry}: camelCase各发1HTTP，权限业务和HTTP失败不冒充未执行`, async () => {
    await withFieldToolHttpFixture(codexMode, async ({ invoke, bodies }) => {
      for (const params of [{ tableId: 'fixture-table' }, { tableName: 'Fixture_Table' }]) {
        const count = bodies.length;
        const result = await invoke(params);
        assert.notEqual(result.isError, true, JSON.stringify(result.content));
        assert.equal(bodies.length, count + 1);
        const body = bodies.at(-1)!;
        assert.equal(body.OsClient, 'fixture');
        if ('tableId' in params) { assert.equal(body.TableId, params.tableId); assert.equal(Object.hasOwn(body, 'TableName'), false); }
        else { assert.equal(body.TableName, params.tableName); assert.equal(Object.hasOwn(body, 'TableId'), false); }
        assert.equal((result._meta?.microiExecution as { state?: string } | undefined)?.state, codexMode ? 'returned' : undefined);
      }
      for (const tableId of ['permission-denied', 'business-failed', 'http-failed']) {
        const count = bodies.length;
        const result = await invoke({ tableId });
        assert.equal(result.isError, true);
        assert.equal(bodies.length, count + 1);
        const state = (result._meta?.microiExecution as { state?: string } | undefined)?.state;
        assert.notEqual(state, 'notExecuted');
        assert.equal(state, codexMode ? 'uncertain' : undefined);
        assert.doesNotMatch(JSON.stringify(result.content), /FIELD_LOCATOR_REQUIRED/);
      }
    }, 'microi_get_field_list');
  });
}
