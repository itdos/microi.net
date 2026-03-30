import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MicroiClient, DbTable, DbField } from './microi-client.js';

/** MCP Server 上下文（用于区分不同租户） */
export interface McpServerContext {
  osClient: string;
  apiBaseUrl: string;
  /** 服务器显示名称（SysTitle），与 mcp.json 中的 key 一致 */
  label: string;
}

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

/** 常用编程类型→MySQL 列类型映射（防止 AI 传入无效的编程语言类型） */
const FIELD_TYPE_MAP: Record<string, string> = {
  string: 'varchar(500)',
  text: 'varchar(500)',
  number: 'int',
  integer: 'int',
  float: 'decimal(18,2)',
  double: 'decimal(18,2)',
  decimal: 'decimal(18,2)',
  boolean: 'int',
  bool: 'int',
  date: 'datetime',
  timestamp: 'datetime',
  long: 'bigint',
  json: 'mediumtext',
};

/** 将 AI 可能传入的编程语言类型自动映射为 MySQL 列类型 */
function normalizeFieldType(type?: string): string {
  if (!type) return 'varchar(500)';
  const lower = type.toLowerCase().trim();
  return FIELD_TYPE_MAP[lower] || type;
}

/**
 * 构建 MCP Server instructions（让 AI 了解此 MCP 服务器的身份和系统知识）
 */
function buildInstructions(ctx: McpServerContext): string {
  return `This MCP server manages a Microi (吾码) low-code platform instance.
- Server Name: ${ctx.label || ctx.osClient}
- API Server: ${ctx.apiBaseUrl}
- OsClient (tenant): ${ctx.osClient}

IMPORTANT: This server ONLY manages tenant "${ctx.label || ctx.osClient}". When the user specifies a different tenant name, do NOT use this server.

## 低代码系统设计工作流（按顺序执行）
1. **microi_get_db_schema** — 先查看已有表结构，了解数据模型
2. **microi_create_table** — 创建自定义表（写入 diy_table，自动创建 MySQL 表并添加 Id/CreateTime/UpdateTime/CreateUser/OsClient 基础字段）
3. **microi_add_field** — 逐个添加业务字段（写入 diy_field，执行 ALTER TABLE），需指定 component 组件类型
4. **microi_create_module** — 创建菜单模块（写入 sys_menu），绑定 diyTableId 后即可在导航栏看到并使用 CRUD
5. **microi_set_role_permission** — 设置角色权限（写入 sys_rolelimit）。roleId 传 "admin" 可自动查找管理员角色

## 核心系统表名（请严格使用以下表名）
| 表名 | 说明 |
|------|------|
| diy_table | 自定义表定义 |
| diy_field | 字段定义 |
| sys_menu | 菜单/模块导航树（注意：不是 sys_module、不是 Sys_Module） |
| sys_role | 角色表（Level=999 为超级管理员） |
| sys_rolelimit | 角色-菜单权限关联表 |
| sys_apiengine | 接口引擎 |
| Sys_User | 用户表 |
| mic_page | 界面引擎（页面配置） |

## 字段类型（type 参数）→ 必须是 MySQL 列类型
| 用途 | 正确的 type 值 | 错误示例 |
|------|---------------|----------|
| 短文本 | varchar(50), varchar(200), varchar(500) | ❌ string, text |
| 长文本/富文本 | mediumtext, longtext | ❌ string |
| 整数 | int, bigint | ❌ number, integer |
| 小数/金额 | decimal(18,2), decimal(10,4) | ❌ float, double |
| 日期时间 | datetime | ❌ date, timestamp |
| 开关(0/1) | int | ❌ boolean, bool |

## 组件类型（component 参数）
microi_add_field 的 component 决定该字段在表单中的 UI 控件：
| Component | 说明 | 推荐 type |
|-----------|------|-----------|
| Text | 单行文本输入框（默认） | varchar(200) |
| Textarea | 多行文本 | varchar(2000) 或 mediumtext |
| RichText | 富文本编辑器 | mediumtext |
| NumberText | 数字输入框 | int 或 decimal(18,2) |
| Rate | 评分(1-5星) | int |
| Radio | 单选按钮组 | varchar(50) |
| Checkbox | 多选复选框 | varchar(500) |
| Select | 下拉单选 | varchar(50) |
| MultipleSelect | 下拉多选 | varchar(500) |
| Switch | 开关 | int |
| SelectTree | 树形选择器 | varchar(50) |
| Cascader | 级联选择器 | varchar(500) |
| DateTime | 日期时间选择器 | datetime |
| Department | 部门选择器 | varchar(50) |
| Address | 地址选择（省市区） | varchar(500) |
| Map | 地图坐标选择 | varchar(200) |
| ImgUpload | 图片上传 | varchar(2000) |
| FileUpload | 文件上传 | varchar(2000) |
| AutoNumber | 自动编号（如 WO-20240101-001） | varchar(200) |
| TableChild | 子表/明细表 | — (关联表) |
| JoinForm | 关联表单（外键） | varchar(50) |
| OpenTable | 弹窗选择关联数据 | varchar(50) |

## 字段命名规范
- 使用 PascalCase（如 CustomerName, OrderAmount, CreateTime）
- 常见字段：Name(名称), Phone(电话), Email(邮箱), Status(状态), Remark(备注), Sort(排序), Amount(金额), Count(数量)

## 菜单模块配置（microi_create_module）
- componentName 页面模板：搜索+表格（默认）、树+搜索+表格、详情、报表
- componentPath 默认 /diy/diy-table-rowlist
- openType: Diy（低代码页面）, Url（外部链接）, Page（自定义前端页面）
- 绑定 diyTableId 后，平台自动提供完整 CRUD 功能（列表、搜索、新增、编辑、删除、导入、导出）

## V8 事件类型（microi_get_event_code / microi_save_event_code 的 eventType）
| eventType | 运行端 | 触发时机 |
|-----------|--------|---------|
| InFormV8 | 前端 | 表单打开时 |
| SubmitFormV8 | 前端 | 表单提交时 |
| SubmitBeforeServerV8 | 后端 | 数据写入DB前（事务中） |
| SubmitAfterServerV8 | 后端 | 数据写入DB后（仍在事务中） |
| OutFormV8 | 前端 | 表单关闭后 |
| DataFilterV8 | 后端 | 获取数据后每行执行 |

## 界面引擎（Page Engine）
界面引擎用于创建自定义页面（仪表盘、数据概览、报表等），数据存储在 mic_page 表。
- **microi_list_pages** — 列出已有页面
- **microi_get_page** — 获取页面JSON配置
- **microi_save_page** — 创建或更新页面

### 页面JSON结构
\`\`\`json
{
  "formData": {
    "Id": "", "Title": "页面标题",
    "formConfig": { "gridNum": 12, "mask": false, "watermark": false },
    "wrapperList": [
      {
        "type": "pannel", "title": "卡片标题",
        "widgetList": [
          { "type": "chart-bar", "title": "柱状图", "config": { "apiEngineKey": "xxx" } }
        ]
      }
    ]
  }
}
\`\`\`

### 常用组件类型
| type | 说明 |
|------|------|
| chart-bar | 柱状图 |
| chart-pie | 饼图 |
| chart-line | 折线图 |
| chart-number | 统计数值 |
| data-table | 数据表格 |
| map-binddata | 地图 |
| html | 自定义HTML |
| iframe | 内嵌页面 |`;
}

/**
 * 创建 MCP Server 并注册所有工具
 * @param client - Microi API 客户端
 * @param context - 服务器上下文（OsClient、API地址），用于在 instructions 中标识身份
 */
export function createMcpServer(client: MicroiClient, context: McpServerContext): McpServer {
  const { osClient, label } = context;

  // 服务器名称与 mcp.json key 保持一致：单服务器用 'microi'，多服务器用 'microi-{label}'
  const serverName = label ? `microi-${label}` : `microi-${osClient || 'default'}`;

  const server = new McpServer(
    { name: serverName, version: '1.0.0' },
    { instructions: buildInstructions(context) },
  );

  // ========================
  // Tool: 获取服务器状态
  // ========================
  server.tool(
    'microi_get_status',
    `Check connection status to Microi server (OsClient: ${osClient}, API: ${context.apiBaseUrl})`,
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
    `Get database table structures for OsClient "${osClient}". Returns table names, field names, MySQL column types, labels. ALWAYS call this first before creating tables or adding fields to understand the existing data model.`,
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
    `List API engines (接口引擎) for OsClient "${osClient}". Each engine is a server-side JavaScript function with V8 APIs for database queries, HTTP calls, caching, etc.`,
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
    `Get JavaScript source code of a specific API engine (OsClient: ${osClient}).`,
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
    `Execute an API engine on Microi server (OsClient: ${osClient}). WARNING: May have side effects (DB writes, external API calls).`,
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
    `List V8 events (table triggers) for OsClient "${osClient}". Events run before/after table operations (insert, update, delete, form validation).`,
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
    `Save (update) API engine JavaScript code on Microi server (OsClient: ${osClient}). Overwrites existing code.`,
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
    `Create a new API engine (接口引擎) for OsClient "${osClient}". Stored in sys_apiengine table.`,
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
    `Get V8 event JavaScript code by table name and event type (OsClient: ${osClient}).`,
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
    `Save (update) V8 event code on Microi server (OsClient: ${osClient}). Overwrites existing event code.`,
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

  // ========================
  // Tool: 创建自定义表（低代码系统设计）
  // ========================
  server.tool(
    'microi_create_table',
    `Create a new custom table for OsClient "${osClient}". Inserts a record into diy_table. This is step 1 of system design — create table, then add fields, then create menu module.`,
    {
      name: z.string().describe('Table name in English (e.g. "Crm_Customer", "Order_Main"). Convention: Module_Entity format. Will be a real MySQL table.'),
      description: z.string().optional().describe('Chinese description of the table (e.g. "客户信息", "订单主表")'),
      tabs: z.string().optional().describe('Form tab layout JSON (e.g. \'[{"Name":"基本信息"},{"Name":"详细信息"}]\'). Groups fields into tabs.'),
      isTree: z.number().optional().describe('Enable tree structure (1=tree table with ParentId self-referencing, 0=flat). Default: 0'),
      column: z.number().optional().describe('Number of form columns (1, 2, or 3). Controls form layout. Default: 1'),
      formOpenType: z.string().optional().describe('How to open form: "Dialog" (弹窗), "Drawer" (抽屉), "Page" (新页面). Default: Dialog'),
      formOpenWidth: z.string().optional().describe('Form dialog/drawer width (e.g. "800px", "60%"). Default: auto'),
    },
    async ({ name, description, tabs, isTree, column, formOpenType, formOpenWidth }) => {
      try {
        const result = await client.createTable(name, description, {
          Tabs: tabs, IsTree: isTree, Column: column,
          FormOpenType: formOpenType, FormOpenWidth: formOpenWidth,
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        const data = result.Data as { TableId?: string; Name?: string; Message?: string };
        return { content: [{ type: 'text', text: `✅ Table "${name}" created.\n- TableId: ${data?.TableId}\n- Use this TableId when adding fields via microi_add_field` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 添加字段（低代码系统设计）
  // ========================
  server.tool(
    'microi_add_field',
    `Add a field to a custom table for OsClient "${osClient}". Inserts a record into diy_field and executes ALTER TABLE to add the MySQL column. The "type" parameter MUST be a valid MySQL column type (e.g. varchar(500), int, decimal(18,2), datetime, mediumtext). Do NOT use programming types like "string" or "number".`,
    {
      tableId: z.string().describe('The TableId returned from microi_create_table'),
      name: z.string().describe('Field name in English (e.g. "CustomerName", "Phone", "Amount")'),
      label: z.string().describe('Chinese display label (e.g. "客户名称", "手机号", "金额")'),
      type: z.string().optional().describe('MySQL column type. Default: varchar(500). Valid examples: varchar(50), varchar(200), varchar(500), int, bigint, decimal(18,2), datetime, mediumtext, longtext. NEVER use: string, number, boolean, float, date — these are NOT valid MySQL types.'),
      component: z.string().optional().describe('UI component type. Default: Text. Options: Text, Textarea, NumberText, Select, MultipleSelect, Radio, Checkbox, Switch, DateTime, RichText, ImgUpload, FileUpload, AutoNumber, JoinForm, OpenTable, SelectTree, Cascader, Department, Address, Map, Rate, TableChild'),
      visible: z.number().optional().describe('Is visible in form (1=yes, 0=no). Default: 1'),
      appVisible: z.number().optional().describe('Is visible in mobile app (1=yes, 0=no). Default: 1'),
      tab: z.string().optional().describe('Form tab group name (for organizing fields into tabs)'),
      tableWidth: z.number().optional().describe('Column width in list view (pixels). Default: 120'),
      sort: z.number().optional().describe('Field display order. Default: 100'),
      readonly: z.number().optional().describe('Is readonly (1=yes, 0=no). Default: 0'),
      notEmpty: z.number().optional().describe('Required field validation (1=required, 0=optional). Default: 0'),
      unique: z.number().optional().describe('Unique constraint (1=unique, 0=allow duplicates). Default: 0'),
      defaultValue: z.string().optional().describe('Default value for the field'),
      placeholder: z.string().optional().describe('Placeholder text shown in form input'),
      formWidth: z.string().optional().describe('Field width in form (e.g. "100%", "50%"). Default: "100%"'),
      data: z.string().optional().describe('Options data for Select/Radio/Checkbox/MultipleSelect components. Format: "value1|label1,value2|label2" (e.g. "1|启用,0|禁用" or "male|男,female|女"). REQUIRED for Select/Radio/Checkbox/MultipleSelect components.'),
      config: z.string().optional().describe('Advanced component config JSON string. Used for AutoNumber pattern, JoinForm/OpenTable binding, etc.'),
      description: z.string().optional().describe('Field description / help text'),
      encrypt: z.number().optional().describe('Enable encryption storage (1=encrypt, 0=plain). Default: 0. For sensitive data like phone/ID number.'),
      inTableEdit: z.number().optional().describe('Enable inline editing in table list view (1=yes, 0=no). Default: 0'),
    },
    async ({ tableId, name, label, type, component, visible, appVisible, tab, tableWidth, sort,
      readonly: readonlyVal, notEmpty, unique, defaultValue, placeholder, formWidth, data, config, description, encrypt, inTableEdit }) => {
      try {
        // 自动映射编程语言类型为 MySQL 类型
        const normalizedType = normalizeFieldType(type);
        if (type && normalizedType !== type) {
          console.error(`[microi-mcp] Auto-mapped field type: "${type}" → "${normalizedType}"`);
        }

        const result = await client.addField({
          TableId: tableId, Name: name, Label: label,
          Type: normalizedType, Component: component,
          Visible: visible, AppVisible: appVisible,
          Tab: tab, TableWidth: tableWidth, Sort: sort,
          Readonly: readonlyVal,
          NotEmpty: notEmpty, Unique: unique,
          DefaultValue: defaultValue, Placeholder: placeholder,
          FormWidth: formWidth, Data: data, Config: config,
          Description: description, Encrypt: encrypt, InTableEdit: inTableEdit,
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `✅ Field "${label}(${name})" added to table.` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 创建功能模块/菜单（低代码系统设计）
  // ========================
  server.tool(
    'microi_create_module',
    `Create a menu module for OsClient "${osClient}". Inserts a record into sys_menu table (NOT sys_module, NOT Sys_Module). This links a diy_table to the navigation sidebar. Step 4 of system design.`,
    {
      name: z.string().describe('Module display name (Chinese, e.g. "客户管理", "订单列表")'),
      diyTableId: z.string().optional().describe('The TableId to bind this module to (from microi_create_table)'),
      parentId: z.string().optional().describe('Parent menu Id for nesting (omit for top-level)'),
      componentName: z.string().optional().describe('Component type. Default: "搜索+表格". Options: "搜索+表格", "树+搜索+表格", "详情", "报表"'),
      componentPath: z.string().optional().describe('Component path. Default: "/diy/diy-table-rowlist"'),
      display: z.number().optional().describe('Show in PC menu (1=yes, 0=no). Default: 1'),
      appDisplay: z.number().optional().describe('Show in mobile menu (1=yes, 0=no). Default: 1'),
      openType: z.string().optional().describe('Open type. Default: "Diy" (low-code page). Options: "Diy", "Url", "Page"'),
      url: z.string().optional().describe('URL if openType is "Url"'),
      sort: z.number().optional().describe('Sort order for menu display. Default: 100. Lower numbers appear first'),
      icon: z.string().optional().describe('Menu icon class name (e.g. "el-icon-user", "el-icon-s-order", "fa fa-home")'),
      searchFieldIds: z.string().optional().describe('Comma-separated field Ids to show in search bar (e.g. "fieldId1,fieldId2")'),
      tableDiyFieldIds: z.string().optional().describe('Comma-separated field Ids to show as table columns (e.g. "fieldId1,fieldId2,fieldId3"). Controls which fields appear in the list view.'),
      defaultOrderBy: z.string().optional().describe('Default sort expression (e.g. "CreateTime DESC", "Sort ASC")'),
      sqlWhere: z.string().optional().describe('Fixed SQL WHERE clause for data filtering (e.g. "Status=1", "IsDeleted=0")'),
      diyConfig: z.string().optional().describe('Advanced module config JSON string'),
    },
    async ({ name, diyTableId, parentId, componentName, componentPath, display, appDisplay, openType, url, sort,
      icon, searchFieldIds, tableDiyFieldIds, defaultOrderBy, sqlWhere, diyConfig }) => {
      try {
        const result = await client.createModule({
          Name: name, DiyTableId: diyTableId, ParentId: parentId,
          ComponentName: componentName, ComponentPath: componentPath,
          Display: display, AppDisplay: appDisplay,
          OpenType: openType, Url: url, Sort: sort,
          Icon: icon, SearchFieldIds: searchFieldIds, TableDiyFieldIds: tableDiyFieldIds,
          DefaultOrderBy: defaultOrderBy, SqlWhere: sqlWhere, DiyConfig: diyConfig,
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        const data = result.Data as { ModuleId?: string; Message?: string };
        return { content: [{ type: 'text', text: `✅ Module "${name}" created.\n- ModuleId: ${data?.ModuleId}\n- Use this ModuleId when setting permissions via microi_set_role_permission` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 设置角色菜单权限
  // ========================
  server.tool(
    'microi_set_role_permission',
    `Grant a role access to menu modules for OsClient "${osClient}". Inserts records into sys_rolelimit table. Pass roleId="admin" to auto-detect the admin role (highest Level in sys_role). Step 5 of system design.`,
    {
      roleId: z.string().describe('Role Id, or pass "admin" to auto-detect the admin role (queries sys_role for highest Level)'),
      menuIds: z.array(z.string()).describe('Array of menu/module Ids (ModuleId from microi_create_module) to grant access to'),
    },
    async ({ roleId, menuIds }) => {
      try {
        const result = await client.setRolePermission(roleId, menuIds);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        const data = result.Data as { AddedCount?: number; SkippedCount?: number; Message?: string };
        return { content: [{ type: 'text', text: `✅ ${data?.Message || 'Permissions set successfully.'}` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 列出界面引擎页面
  // ========================
  server.tool(
    'microi_list_pages',
    `List page engine (界面引擎) pages for OsClient "${osClient}". Pages are stored in mic_page table and define custom UI layouts with charts, tables, maps, and other dashboard components.`,
    {
      keyword: z.string().optional().describe('Search keyword to filter pages by title, number, or description'),
    },
    async ({ keyword }) => {
      try {
        const result = await client.getPageEngineList(keyword);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }

        const pages = Array.isArray(result.Data) ? result.Data : [];
        if (!pages.length) {
          return { content: [{ type: 'text', text: 'No pages found.' }] };
        }

        const lines = [
          `# Page Engine Pages (${pages.length})\n`,
          '| # | Title | Number | Description | Updated |',
          '|---|-------|--------|-------------|---------|',
        ];
        pages.forEach((p: Record<string, string>, i: number) => {
          lines.push(`| ${i + 1} | ${p.Title || ''} | ${p.Number || ''} | ${p.Desc || ''} | ${p.UpdateTime || ''} |`);
        });

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 获取界面引擎页面详情
  // ========================
  server.tool(
    'microi_get_page',
    `Get page engine detail including full JSON configuration for OsClient "${osClient}". The JsonObj field contains the complete page structure with formData, wrapperList, and widgetList.`,
    {
      pageId: z.string().describe('The page Id to retrieve'),
    },
    async ({ pageId }) => {
      try {
        const result = await client.getPageEngineDetail(pageId);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }

        const page = result.Data as Record<string, unknown>;
        const lines = [
          `## Page: ${page?.Title || pageId}`,
          page?.Number ? `- **Number**: ${page.Number}` : '',
          page?.Desc ? `- **Description**: ${page.Desc}` : '',
          '',
          '### JSON Configuration',
          '```json',
          typeof page?.JsonObj === 'string' ? page.JsonObj : JSON.stringify(page?.JsonObj, null, 2),
          '```',
        ].filter(Boolean);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 保存界面引擎页面
  // ========================
  server.tool(
    'microi_save_page',
    `Create or update a page engine page for OsClient "${osClient}". The jsonStr must be a valid page engine JSON with formData/wrapperList/widgetList structure. Pass pageId to update an existing page, or omit to create a new one.`,
    {
      pageId: z.string().optional().describe('Page Id to update. Omit to create a new page.'),
      title: z.string().describe('Page title (e.g. "销售仪表盘", "数据概览")'),
      number: z.string().optional().describe('Page number/code (auto-generated if omitted)'),
      desc: z.string().optional().describe('Page description'),
      jsonStr: z.string().describe('Complete page JSON configuration string. Must contain formData with wrapperList and widgetList structure. Refer to page engine documentation for the JSON schema.'),
    },
    async ({ pageId, title, number, desc, jsonStr }) => {
      try {
        const result = await client.savePageEngine({
          PageId: pageId, Title: title, Number: number,
          Desc: desc, JsonStr: jsonStr,
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        const data = result.Data as { PageId?: string; Message?: string };
        return { content: [{ type: 'text', text: `✅ ${data?.Message || 'Page saved successfully.'}\n- PageId: ${data?.PageId}` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  return server;
}
