import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MicroiClient, DbTable, DbField } from './microi-client.js';

/** 将表结构格式化为 Markdown（方便 AI 阅读） */
function formatDbTables(tables: DbTable[]): string {
  if (!tables.length) return 'No tables found.';

  const lines: string[] = [`# Database Schema (${tables.length} tables)\n`];

  for (const table of tables) {
    const fields: DbField[] = table._Fields || table.Fields || [];
    lines.push(`## ${table.Name}${table.Description ? ` — ${table.Description}` : ''}`);

    if (!fields.length) {
      lines.push('_No field information available._\n');
      continue;
    }

    lines.push('| Field | Label | Type | Nullable | Description |');
    lines.push('|-------|-------|------|----------|-------------|');
    for (const f of fields) {
      const nullable = f.AllowNull === false ? 'NO' : 'YES';
      lines.push(`| ${f.Name} | ${f.Label || ''} | ${f.Type || ''} | ${nullable} | ${f.Description || ''} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 创建 MCP Server 并注册所有工具
 */
export function createMcpServer(client: MicroiClient): McpServer {
  const server = new McpServer({
    name: 'microi-mcp-server',
    version: '1.0.0',
  });

  // ========================
  // Tool: 获取服务器状态
  // ========================
  server.tool(
    'microi_get_status',
    'Check connection status to the Microi backend server',
    {},
    async () => {
      try {
        const result = await client.getStatus();
        if (result.Code === 1) {
          return { content: [{ type: 'text', text: `✅ Server is online.\n\n${JSON.stringify(result.Data, null, 2)}` }] };
        }
        return { content: [{ type: 'text', text: `⚠️ Server returned Code=${result.Code}: ${result.Msg}` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `❌ Connection failed: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 获取数据库表结构
  // ========================
  server.tool(
    'microi_get_db_schema',
    'Get database table structures from Microi platform. Returns table names, field names, types, labels, and descriptions. Use this to understand the data model before writing queries or API engines.',
    {
      tableName: z.string().optional().describe('Filter tables by name (case-insensitive partial match). Omit to get all tables.'),
    },
    async ({ tableName }) => {
      try {
        const result = await client.getDbSchema();
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }

        let tables = result.Data?.Tables || [];
        if (tableName) {
          const keyword = tableName.toLowerCase();
          tables = tables.filter(
            (t) => t.Name.toLowerCase().includes(keyword) || (t.Description && t.Description.toLowerCase().includes(keyword)),
          );
        }

        return { content: [{ type: 'text', text: formatDbTables(tables) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 列出接口引擎
  // ========================
  server.tool(
    'microi_list_engines',
    'List all API engines (接口引擎) on the Microi platform. Each engine is a JavaScript function that runs on the server with access to V8 APIs for database queries, HTTP calls, caching, etc.',
    {
      keyword: z.string().optional().describe('Search keyword to filter engines by name or key'),
    },
    async ({ keyword }) => {
      try {
        const result = await client.getEngineList(keyword);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }

        const engines = Array.isArray(result.Data) ? result.Data : [];
        if (!engines.length) {
          return { content: [{ type: 'text', text: 'No engines found.' }] };
        }

        const lines = [
          `# API Engines (${engines.length})\n`,
          '| # | Engine Key | Name | Category | Description |',
          '|---|-----------|------|----------|-------------|',
        ];
        engines.forEach((e, i) => {
          lines.push(`| ${i + 1} | ${e.ApiEngineKey} | ${e.ApiName || ''} | ${e.Category || ''} | ${e.Description || ''} |`);
        });

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 获取引擎源码
  // ========================
  server.tool(
    'microi_get_engine_code',
    'Get the JavaScript source code of a specific API engine by its key. Use this to understand existing engine logic before modifying or creating new engines.',
    {
      apiEngineKey: z.string().describe('The unique key of the API engine'),
    },
    async ({ apiEngineKey }) => {
      try {
        const result = await client.getEngineCode(apiEngineKey);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }

        const engine = result.Data;
        const lines = [
          `## API Engine: ${engine?.ApiEngineKey || apiEngineKey}`,
          engine?.ApiName ? `- **Name**: ${engine.ApiName}` : '',
          engine?.Category ? `- **Category**: ${engine.Category}` : '',
          engine?.ApiAddress ? `- **Address**: ${engine.ApiAddress}` : '',
          '',
          '```javascript',
          engine?.Code || '// No code available',
          '```',
        ].filter(Boolean);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 执行接口引擎
  // ========================
  server.tool(
    'microi_run_engine',
    'Execute an API engine on the Microi server and return the result. WARNING: This may have side effects (database writes, external API calls) depending on the engine logic. Use with caution.',
    {
      apiEngineKey: z.string().describe('The unique key of the API engine to execute'),
      params: z
        .record(z.unknown())
        .optional()
        .describe('Optional parameters to pass to the engine (available via V8.Param in the engine code)'),
    },
    async ({ apiEngineKey, params }) => {
      try {
        const result = await client.executeEngine(apiEngineKey, params);

        const lines = [
          `## Execution Result: ${apiEngineKey}`,
          `- **Code**: ${result.Code}`,
          result.Msg ? `- **Message**: ${result.Msg}` : '',
          '',
          '```json',
          JSON.stringify(result.Data, null, 2),
          '```',
        ].filter(Boolean);

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
          isError: result.Code !== 1,
        };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 列出 V8 事件
  // ========================
  server.tool(
    'microi_list_events',
    'List V8 events (table events) on the Microi platform. Events are triggers that run before/after table operations like insert, update, delete, and form validation.',
    {
      keyword: z.string().optional().describe('Search keyword to filter events'),
    },
    async ({ keyword }) => {
      try {
        const result = await client.getEventList(keyword);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }

        const events = Array.isArray(result.Data) ? result.Data : [];
        if (!events.length) {
          return { content: [{ type: 'text', text: 'No events found.' }] };
        }

        const lines = [
          `# V8 Events (${events.length})\n`,
          '| # | Table/FormEngine | Event Type | Description |',
          '|---|-----------------|------------|-------------|',
        ];
        events.forEach((ev, i) => {
          lines.push(
            `| ${i + 1} | ${ev.TableName || ev.FormEngineKey} | ${ev.EventType} | ${ev.Description || ''} |`,
          );
        });

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 保存接口引擎代码
  // ========================
  server.tool(
    'microi_save_engine_code',
    'Save (update) the JavaScript source code of an existing API engine. This will overwrite the current code on the server.',
    {
      apiEngineKey: z.string().describe('The unique key of the API engine'),
      code: z.string().describe('The complete JavaScript source code to save'),
    },
    async ({ apiEngineKey, code }) => {
      try {
        const result = await client.saveEngineCode(apiEngineKey, code);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `✅ Engine "${apiEngineKey}" code saved successfully.` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 创建接口引擎
  // ========================
  server.tool(
    'microi_create_engine',
    'Create a new API engine on the Microi platform. The engine will be created with the given key, name, and optional initial code.',
    {
      apiEngineKey: z.string().describe('Unique key for the new engine (lowercase, hyphens allowed, e.g. "my-new-api")'),
      apiName: z.string().describe('Display name of the engine'),
      category: z.string().optional().describe('Category to organize engines'),
      code: z.string().optional().describe('Initial JavaScript code for the engine'),
    },
    async ({ apiEngineKey, apiName, category, code }) => {
      try {
        const result = await client.createEngine({
          ApiEngineKey: apiEngineKey,
          ApiName: apiName,
          Category: category,
          Code: code,
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `✅ Engine "${apiEngineKey}" created successfully.` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 获取 V8 事件代码
  // ========================
  server.tool(
    'microi_get_event_code',
    'Get the JavaScript source code of a specific V8 event by table name and event type.',
    {
      formEngineKey: z.string().describe('The table name or FormEngine key the event belongs to'),
      eventType: z.string().describe('Event type: InFormV8 | SubmitFormV8 | OutFormV8 | SubmitBeforeServerV8 | SubmitAfterServerV8 | DataFilterV8'),
    },
    async ({ formEngineKey, eventType }) => {
      try {
        const result = await client.getEventCode(formEngineKey, eventType);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }

        const event = result.Data;
        const lines = [
          `## V8 Event: ${formEngineKey} / ${eventType}`,
          '',
          '```javascript',
          event?.Code || '// No code available',
          '```',
        ];

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 保存 V8 事件代码
  // ========================
  server.tool(
    'microi_save_event_code',
    'Save (update) the JavaScript source code of a V8 event. This will overwrite the current event code on the server.',
    {
      formEngineKey: z.string().describe('The table name or FormEngine key the event belongs to'),
      eventType: z.string().describe('Event type: InFormV8 | SubmitFormV8 | OutFormV8 | SubmitBeforeServerV8 | SubmitAfterServerV8 | DataFilterV8'),
      code: z.string().describe('The complete JavaScript source code to save'),
    },
    async ({ formEngineKey, eventType, code }) => {
      try {
        const result = await client.saveEventCode(formEngineKey, eventType, code);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `✅ Event "${formEngineKey}/${eventType}" code saved successfully.` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  return server;
}
