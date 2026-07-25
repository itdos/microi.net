import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { MicroiClient, DbTable, DbField, PlaywrightContextData, PlaywrightEngineInfo, PlaywrightModuleInfo } from './microi-client.js';
import { normalizeViewSchemaJson, registerAdvancedTools } from './advanced-tools.js';
import { registerBlueprintTools } from './blueprint-tools.js';
import { registerDesignTools } from './design-tools.js';
import { normalizePageJsonObj } from './design-engine.js';

/** MCP Server 上下文（用于区分不同租户） */
export interface McpServerContext {
  osClient: string;
  apiBaseUrl: string;
  /** 服务器显示名称（SysTitle），与 mcp.json 中的 key 一致 */
  label: string;
  /** Codex compatibility mode exposes only microi_codex at protocol level. */
  codexMode?: boolean;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== 'object') return [];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.List)) return record.List as T[];
  if (Array.isArray(record.Data)) return record.Data as T[];
  return [];
}

function getStringField(data: unknown, ...keys: string[]): string {
  if (!data || typeof data !== 'object') return '';
  const record = data as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function includesKeyword(value: unknown, keyword?: string): boolean {
  if (!keyword) return true;
  return String(value || '').toLowerCase().includes(keyword.toLowerCase());
}

function sanitizeServerNamePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .substring(0, 48);
}

function buildRuntimeServerName(context: McpServerContext): string {
  let hostPart = '';
  try {
    hostPart = sanitizeServerNamePart(new URL(context.apiBaseUrl).host);
  } catch {
    hostPart = sanitizeServerNamePart(context.apiBaseUrl || '');
  }

  const basePart = sanitizeServerNamePart(context.osClient || '')
    || hostPart
    || 'default';
  return `Microi-${basePart}`;
}

const CORE_TOOL_REGISTRATION_ORDER = [
  'microi_codex',
  'microi_get_status',
  'microi_redis_statistics',
  'microi_redis_list_keys',
  'microi_redis_get_key',
  'microi_redis_delete_keys',
  'microi_redis_replace_value',
  'microi_redis_rename_key',
  'microi_redis_set_ttl',
  'microi_get_db_schema',
  'microi_list_database_types',
  'microi_inspect_external_database',
  'microi_query_external_database',
  'microi_execute_external_database',
  'microi_save_database_connection',
  'microi_import_external_attachment',
  'microi_get_field_list',
  'microi_add_field',
  'microi_update_field',
  'microi_refresh_schema_cache',
  'microi_create_table',
  'microi_create_module',
  'microi_get_event_code',
  'microi_save_event_code',
  'microi_list_events',
  'microi_get_table_data',
  'microi_add_form_data',
  'microi_update_form_data',
  'microi_get_manifest_schema',
  'microi_plan_system',
  'microi_generate_system',
  'microi_validate_system',
  'microi_build_field_config',
  'microi_validate_menu_buttons',
  'microi_list_engines',
  'microi_get_engine_code',
  'microi_save_engine_code',
  'microi_create_engine',
  'microi_get_module',
  'microi_update_module',
  'microi_list_modules',
  'microi_update_table',
  'microi_set_role_permission',
  'microi_set_engine_anonymous',
];

const CORE_TOOL_PRIORITY = new Map(CORE_TOOL_REGISTRATION_ORDER.map((name, index) => [name, index]));
const jsonRecordSchema = z.record(z.unknown());

interface BufferedToolRegistration {
  name: string;
  args: unknown[];
  index: number;
}

interface BufferedToolRegistry {
  flush: (enabledNames?: string[]) => void;
  invoke: (name: string, params?: Record<string, unknown>) => Promise<CallToolResult>;
  list: (keyword?: string) => Array<{ name: string; description: string }>;
  describe: (name: string) => {
    name: string;
    description: string;
    params: Record<string, { type: string; required: boolean; description: string }>;
  } | undefined;
}

function isZodSchema(value: unknown): value is z.ZodTypeAny {
  return !!value
    && typeof value === 'object'
    && typeof (value as { safeParse?: unknown }).safeParse === 'function';
}

function getToolDescription(registration: BufferedToolRegistration): string {
  return registration.args.find((arg, index) => index > 0 && typeof arg === 'string') as string || '';
}

function getToolShape(registration: BufferedToolRegistration): z.ZodRawShape | undefined {
  for (let index = 1; index < registration.args.length - 1; index += 1) {
    const candidate = registration.args[index];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const values = Object.values(candidate as Record<string, unknown>);
    if (values.length === 0 || values.every(isZodSchema)) {
      return candidate as z.ZodRawShape;
    }
  }
  return undefined;
}

function getZodTypeName(schema: z.ZodTypeAny): string {
  let current: z.ZodTypeAny = schema;
  const wrappers: string[] = [];
  while (current?._def?.innerType && isZodSchema(current._def.innerType)) {
    wrappers.push(String(current._def.typeName || current.constructor.name));
    current = current._def.innerType;
  }
  const rawName = String(current?._def?.typeName || current?.constructor?.name || 'unknown');
  const name = rawName.replace(/^Zod/, '').toLowerCase();
  if (wrappers.some(item => /Array/i.test(item))) return `${name}[]`;
  return name;
}

function parseResourceParams(value: unknown): Record<string, unknown> {
  const raw = String(value || '').trim();
  if (!raw) return {};
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // The MCP URI parser may already have decoded the variable.
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next representation.
    }
  }
  throw new Error('params must be a URI-encoded JSON object');
}

function toolResultResourceText(result: CallToolResult): string {
  return JSON.stringify({
    isError: result.isError === true,
    content: result.content,
    structuredContent: result.structuredContent,
  }, null, 2);
}

function bufferToolRegistrationsByPriority(server: McpServer): BufferedToolRegistry {
  const mutableServer = server as unknown as { tool: (...args: unknown[]) => unknown };
  const originalTool = mutableServer.tool.bind(server);
  const buffered: BufferedToolRegistration[] = [];

  mutableServer.tool = (...args: unknown[]): unknown => {
    const name = typeof args[0] === 'string' ? args[0] : '';
    buffered.push({ name, args, index: buffered.length });
    return undefined;
  };

  const findRegistration = (name: string): BufferedToolRegistration | undefined => {
    const normalized = name.startsWith('microi_') ? name : `microi_${name}`;
    return buffered.find(item => item.name === normalized);
  };

  return {
    flush: (enabledNames) => {
      const enabledSet = enabledNames ? new Set(enabledNames) : undefined;
      mutableServer.tool = originalTool;
      buffered
        .filter(item => !enabledSet || enabledSet.has(item.name))
        .sort((a, b) => {
          const priorityA = CORE_TOOL_PRIORITY.get(a.name) ?? Number.MAX_SAFE_INTEGER;
          const priorityB = CORE_TOOL_PRIORITY.get(b.name) ?? Number.MAX_SAFE_INTEGER;
          return priorityA - priorityB || a.index - b.index;
        })
        .forEach((item) => {
          originalTool(...item.args);
        });
    },
    invoke: async (name, params = {}) => {
      const registration = findRegistration(name);
      if (!registration || registration.name === 'microi_codex') {
        return {
          content: [{ type: 'text', text: `Unknown Microi action: ${name}. Call action="list_tools" to discover available tools.` }],
          isError: true,
        };
      }
      const handler = registration.args[registration.args.length - 1] as
        | ((args: Record<string, unknown>, extra: Record<string, never>) => CallToolResult | Promise<CallToolResult>)
        | undefined;
      if (typeof handler !== 'function') {
        return {
          content: [{ type: 'text', text: `Microi action has no callable handler: ${registration.name}` }],
          isError: true,
        };
      }
      const shape = getToolShape(registration);
      let validatedParams: Record<string, unknown> = params;
      if (shape) {
        const parsed = z.object(shape).safeParse(params);
        if (!parsed.success) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                action: registration.name,
                error: 'Invalid tool parameters',
                issues: parsed.error.issues,
              }, null, 2),
            }],
            isError: true,
          };
        }
        validatedParams = parsed.data;
      }
      return handler(validatedParams, {});
    },
    list: (keyword) => buffered
      .filter(item => item.name !== 'microi_codex')
      .filter(item => !keyword
        || includesKeyword(item.name, keyword)
        || includesKeyword(getToolDescription(item), keyword))
      .map(item => ({
        name: item.name,
        description: getToolDescription(item),
      })),
    describe: (name) => {
      const registration = findRegistration(name);
      if (!registration || registration.name === 'microi_codex') return undefined;
      const shape = getToolShape(registration) || {};
      return {
        name: registration.name,
        description: getToolDescription(registration),
        params: Object.fromEntries(Object.entries(shape).map(([key, schema]) => [
          key,
          {
            type: getZodTypeName(schema),
            required: !schema.isOptional(),
            description: schema.description || '',
          },
        ])),
      };
    },
  };
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

function moduleRoute(module: PlaywrightModuleInfo): string {
  const raw = (module.Url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return raw;
  return `/${raw}`;
}

function isPublicEngine(engine: PlaywrightEngineInfo): boolean {
  return Number(engine.AllowAnonymous) === 1 && Number(engine.StopHttp) !== 1 && Number(engine.IsEnable) !== 0;
}

function isCallableEngine(engine: PlaywrightEngineInfo): boolean {
  return Number(engine.StopHttp) !== 1 && Number(engine.IsEnable) !== 0;
}

function formatPlaywrightContext(data: PlaywrightContextData, fallbackApiBaseUrl: string): string {
  const engines = Array.isArray(data.Engines) ? data.Engines : [];
  const modules = Array.isArray(data.Modules) ? data.Modules : [];
  const publicEngines = engines.filter(isPublicEngine);
  const protectedEngines = engines.filter((engine) => isCallableEngine(engine) && !isPublicEngine(engine));
  const routeModules = modules.filter((module) => moduleRoute(module));
  const apiBase = data.ApiBaseUrl || fallbackApiBaseUrl;
  const lines = [
    `# Playwright Context for ${data.OsClient || 'current tenant'}`,
    '',
    '## Recommended Environment',
    '```bash',
    `PW_API_BASE=${apiBase}`,
    `PW_OS_CLIENT=${data.OsClient || ''}`,
    'PW_BASE_URL=http://127.0.0.1:5180',
    'PW_HOME_PATH=/',
    '```',
    '',
    `## Summary`,
    `- Engines: ${engines.length}`,
    `- Public callable engines: ${publicEngines.length}`,
    `- Protected callable engines: ${protectedEngines.length}`,
    `- Menu routes: ${routeModules.length}`,
  ];

  if (data.Warnings?.length) {
    lines.push('', '## Warnings', ...data.Warnings.map((warning) => `- ${warning}`));
  }

  lines.push('', '## Public API Engines');
  if (!publicEngines.length) {
    lines.push('_No public callable engines found._');
  } else {
    lines.push('| Engine Key | Name | Category | Address |', '|---|---|---|---|');
    publicEngines.slice(0, 80).forEach((engine) => {
      lines.push(`| ${engine.ApiEngineKey || ''} | ${engine.ApiName || ''} | ${engine.Category || ''} | ${engine.ApiAddress || `/apiengine/${engine.ApiEngineKey}`} |`);
    });
  }

  lines.push('', '## Protected API Engines');
  if (!protectedEngines.length) {
    lines.push('_No protected callable engines found._');
  } else {
    lines.push('| Engine Key | Name | Category | Address |', '|---|---|---|---|');
    protectedEngines.slice(0, 80).forEach((engine) => {
      lines.push(`| ${engine.ApiEngineKey || ''} | ${engine.ApiName || ''} | ${engine.Category || ''} | ${engine.ApiAddress || `/apiengine/${engine.ApiEngineKey}`} |`);
    });
  }

  lines.push('', '## Menu Routes');
  if (!routeModules.length) {
    lines.push('_No menu routes found._');
  } else {
    lines.push('| Route | Name | Table | Component | PC | Mobile |', '|---|---|---|---|---|---|');
    routeModules.slice(0, 120).forEach((module) => {
      lines.push(`| ${moduleRoute(module)} | ${module.Name || ''} | ${module.DiyTableName || module.DiyTableId || ''} | ${module.ComponentName || module.ComponentPath || ''} | ${module.Display === 1 ? 'yes' : 'no'} | ${module.AppDisplay === 1 ? 'yes' : 'no'} |`);
    });
  }

  return lines.join('\n');
}

function buildPlaywrightPlanText(args: {
  osClient: string;
  apiBaseUrl: string;
  frontendBaseUrl?: string;
  appType?: string;
  homePath?: string;
  loginEngineKey?: string;
  smokeEngineKey?: string;
  pageSize?: number;
  context?: PlaywrightContextData;
}): string {
  const appType = args.appType || 'uniapp-h5';
  const testDir = 'tests/e2e';
  const homePath = args.homePath || (appType === 'uniapp-h5' ? '/#/pages/index/index' : '/');
  const loginEngine = args.loginEngineKey || args.context?.Engines?.find((engine) => /login|登录/i.test(`${engine.ApiEngineKey} ${engine.ApiName}`))?.ApiEngineKey || 'member_login';
  const smokeEngine = args.smokeEngineKey || args.context?.Engines?.find(isPublicEngine)?.ApiEngineKey || 'home_data';
  const route = args.context?.Modules?.map(moduleRoute).find(Boolean) || homePath;
  return [
    `# Playwright E2E Plan`,
    '',
    '## Naming',
    'Keep the skill/folder name `playwright-e2e`: E2E means End-to-End, and the suffix signals browser-level delivery validation.',
    '',
    '## Environment',
    '```bash',
    `PW_BASE_URL=${args.frontendBaseUrl || 'http://127.0.0.1:5180'}`,
    `PW_API_BASE=${args.apiBaseUrl}`,
    `PW_OS_CLIENT=${args.osClient}`,
    `PW_LOGIN_ENGINE=${loginEngine}`,
    `PW_SMOKE_ENGINE=${smokeEngine}`,
    'PW_TEST_ACCOUNT=<dedicated-test-account>',
    'PW_TEST_PASSWORD=<dedicated-test-password>',
    `PW_HOME_PATH=${homePath}`,
    'PW_SCREENSHOT_DIR=tests/e2e/screenshots',
    `PW_CONTEXT_PAGE_SIZE=${args.pageSize || args.context?.Summary?.PageSize || 5000}`,
    '```',
    '',
    '## Files to create',
    `- playwright.config.js`,
    `- ${testDir}/helpers/microi.js`,
    `- ${testDir}/specs/smoke.spec.js`,
    `- ${testDir}/specs/auth.spec.js`,
    `- ${testDir}/specs/api-contract.spec.js`,
    `- ${testDir}/specs/network.spec.js`,
    `- ${testDir}/specs/visual-and-assets.spec.js`,
    `- ${testDir}/specs/business-flow.spec.js`,
    '',
    '## Required quality gates',
    `1. Open ${homePath} and assert body plus one stable app element.`,
    `2. Call /apiengine/${smokeEngine} with Playwright request and assert DosResult shape.`,
    `3. Call /apiengine/${loginEngine} with PW_TEST_ACCOUNT/PW_TEST_PASSWORD and assert Token without printing secrets.`,
    `4. Inject Token into storage, open ${route}, and assert the page is visible.`,
    '5. Intercept all API responses and fail on HTTP 404/5xx, empty body, string `null`, invalid JSON, or unexpected `Code=0`.',
    '6. Save fullPage screenshots for every core page and review them; do not rely on failure-only screenshots.',
    '7. Verify uploaded images, avatars, banners, private files, QR codes, and product/card pictures really render, not only that URLs are non-empty.',
    '8. Run contrast/overflow checks: no unreadable text, no horizontal scrollbar, no missing mobile tabBar/fixed footer.',
    '9. Cover at least one real write flow with repeatable seed data and assert the state change by querying the backend.',
    '10. Verify unauthenticated protected actions redirect to login or return Code=1001/1002.',
    '11. Treat visible `开发中`, `待开发`, `请求失败`, `网络错误`, and `null` as delivery failures.',
    '',
    '## Microi rules',
    '- Always send `OsClient` in API headers.',
    '- Use a dedicated test account and repeatable seed data for write scenarios.',
    '- Prefer API login plus storage injection over clicking the login form in every test.',
    '- Use MCP `microi_get_playwright_context` before adding business-flow specs.',
    '- If backend/frontend services are not reachable, auto-start them before declaring the test blocked.',
    '- Prefer MCP/platform tools for metadata fixes; only create tenant ApiEngines for tenant business logic.',
    '- For mobile member apps, do not call platform FormEngine directly with a mall member token; use tenant ApiEngines or a safe query proxy.',
    '- Keep generic platform lessons in `microi.skills/microi-system-delivery/SKILL.md`; project-specific rules belong in the project blueprint/config.',
  ].join('\n');
}

/** 常用编程类型→平台允许的列类型映射（防止 AI 传入无效类型）
 *  ⚠️ 平台禁止使用 datetime/date/timestamp 物理列，统一存为 varchar(25)
 *  平台允许的列类型：varchar(N) | mediumtext | longtext | int | bigint | decimal(18,N)
 */
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
  // ⚠️ 禁止 datetime / date / timestamp / time —— 一律映射为 varchar(25)
  date: 'varchar(25)',
  datetime: 'varchar(25)',
  timestamp: 'varchar(25)',
  time: 'varchar(25)',
  long: 'bigint',
  json: 'mediumtext',
};

/** 每个表的字段 Sort 自增计数器（同一会话内有效）；
 *  作用：当 AI 不传 sort 时，按调用顺序自动 +10，避免所有字段 Sort=100 撞车导致列表/表单顺序乱。
 *  起始 100、步进 10，给手动插入留空隙。
 */
const TABLE_FIELD_SORT_COUNTER: Map<string, number> = new Map();
function nextSortFor(tableId: string): number {
  const cur = TABLE_FIELD_SORT_COUNTER.get(tableId) ?? 100;
  const next = cur + 10;
  TABLE_FIELD_SORT_COUNTER.set(tableId, next);
  return cur;
}

/** 将 AI 可能传入的编程语言类型自动映射为平台允许的列类型；并强制拦截 datetime/date/timestamp */
function normalizeFieldType(type?: string): string {
  if (!type) return 'varchar(500)';
  const trimmed = type.trim();
  const lower = trimmed.toLowerCase();
  if (FIELD_TYPE_MAP[lower]) return FIELD_TYPE_MAP[lower];
  // 兜底：以 datetime / timestamp 开头（含 datetime(6) 等变体）一律改为 varchar(25)
  if (lower.startsWith('datetime') || lower.startsWith('timestamp') || lower === 'date' || lower === 'time') {
    return 'varchar(25)';
  }
  if (lower.startsWith('float') || lower.startsWith('double') || lower.startsWith('real') || lower === 'money') {
    return 'decimal(18,2)';
  }
  return trimmed;
}

/**
 * 构建 MCP Server instructions（让 AI 了解此 MCP 服务器的身份和系统知识）
 */
function buildInstructions(ctx: McpServerContext): string {
  return `This MCP server manages a Microi (吾码) low-code platform instance.
- Server Name: ${ctx.label || ctx.osClient}
- API Server: ${ctx.apiBaseUrl}
- OsClient (tenant): ${ctx.osClient}

IMPORTANT: This server ONLY manages OsClient tenant "${ctx.osClient}". "${ctx.label || ctx.osClient}" is only a display name. When the user specifies a different tenant name, do NOT use this server.
BOUNDARY RULES:
- Bound API Server: ${ctx.apiBaseUrl}
- Bound OsClient: ${ctx.osClient || '(default)'}
- Before any write tool call, compare the user's requested server/tenant with the bound API and OsClient above.
- Never satisfy a request for another Microi server or another OsClient with this MCP instance; ask the user to select the correct MCP instead.
- If multiple Microi MCP servers are available, keep all reads and writes for one system on the same bound server.

## 低代码系统设计工作流（按顺序执行）
1. **microi_get_db_schema** — 先查看已有表结构，了解数据模型
2. **microi_create_table** — 创建自定义表（写入 diy_table，自动创建 MySQL 表并添加 Id/CreateTime/UpdateTime/CreateUser/OsClient 基础字段）
3. **microi_add_field** — 逐个添加业务字段（写入 diy_field，执行 ALTER TABLE），需指定 component 组件类型
4. **microi_create_module** — 创建菜单模块（写入 sys_menu），绑定 diyTableId 后即可在导航栏看到并使用 CRUD。**复杂业务系统请同时传入 moreBtns/formBtns/pageTabs/batchSelectMoreBtns** 一次性配齐按钮
5. **microi_create_engine** — 复杂业务（审批/工作流/统计/集成）必须创建接口引擎，菜单按钮的 V8Code 通过 V8.ApiEngine.Run 调用
6. **microi_set_role_permission** — 设置角色权限（写入 sys_rolelimit）。roleId 传 "admin" 可自动查找管理员角色

## 更高一层编排与验收工具
- **microi_get_manifest_schema** — Return the full-system Manifest contract and example. In modules, use field names such as listFields/searchFields/sortFields; MCP resolves them to diy_field Id, SelectFields and SearchFieldIds before writing sys_menu.
- **microi_plan_system** — 从完整 Manifest 生成干跑计划，不写入
- **microi_generate_system** — 按 Manifest 一次性编排表、字段、数据源、接口引擎、事件、菜单、权限、页面、打印、工作流、任务，并自动验收；真实写入必须传 confirmExecution
- **microi_validate_system** — 对生成结果做后置验收，检查表/字段/引擎/菜单/数据源/打印/工作流是否存在
- **microi_validate_menu_buttons** — 校验并规范化 MoreBtns/FormBtns/PageTabs 等按钮 JSON，自动补 Id/Sort/默认显隐
- **microi_build_field_config** — 生成 Select/Radio/Checkbox/JoinForm/AutoNumber/DateTime 等字段的 Data/Config JSON
- **microi_get_field_list / microi_update_field / microi_refresh_schema_cache** — 修改已有 diy_field 字段属性、KeyValue 数据源、Config 后必须回读并刷新缓存，避免后台字段选项与前端/接口枚举不一致
- **microi_get_table_data / microi_add_form_data / microi_update_form_data** — 维护租户业务表数据（如商品、示例数据、配置项）时使用，写入后必须回读验证关键字段
- **microi_upsert_engine** — 接口引擎存在则更新，不存在则创建；真实写入必须确认
- **microi_save_engine_code** — 递增代码头语义版本并保存 ApiV8Code；如 sys_apiengine 存在 Version/ChangeHistory 字段则同步写入；不修改 AllowAnonymous/StopHttp/IsEnable/ApiAddress 等接口配置
- **microi_check_workflow_package / microi_test_workflow_condition** — 保存工作流前检查拓扑，并用样例表单数据测试图形条件路线
- **microi_save_data_source / microi_save_print_template / microi_save_workflow_package / microi_save_job** — 覆盖数据源、打印、工作流、定时任务的系统级建模
- **microi_get_playwright_context / microi_plan_playwright_e2e** — 为 Playwright E2E 自动化测试提供当前租户的菜单路由、接口引擎和冒烟计划

## MCP 写入超时与回读规则
- \`microi_create_engine\`、\`microi_save_engine_code\`、\`microi_save_event_code\`、\`microi_update_module\` 已内置请求超时和远端短超时回读确认。若响应中出现 \`RecoveredAfterTransportError:true\`，表示客户端响应异常但远端写入已经确认成功。
- 超时只代表客户端没有及时拿到响应，不等于服务器一定未写入。必须先用对应 get 工具回读，禁止立即重复创建表、字段、接口引擎或按钮。
- 接口引擎数据库创建成功后，后端路由缓存刷新超时不能把创建结果伪装成失败；检查响应中的 \`CacheRefresh\`，不要重复创建同一个 ApiEngineKey。
- 菜单按钮字段始终传明文 JSON 数组；不要根据租户 \`sys_menu\` 事件自行 Base64 编码。
- 标准工具回读仍不能确认时，报告“写入结果不确定”并保留原始错误。不要擅自改走原生 FormEngine HTTP、直接 SQL 或新建一次性维护接口引擎。

## Codex 兼容入口
- Codex 模式下协议层只暴露 \`microi_codex\`，但该入口内部仍可调用全部原始工具。
- 若 Codex 线程只提供资源能力，读取 \`microi://codex/status\` 验证连接，读取 \`microi://codex/tools\` 查看工具，或使用资源模板 \`microi://codex/action/{action}/{params}\` 调用；params 为 URI 编码 JSON。
- 资源模式与工具模式复用同一个 handler，写入确认、审计和回读规则完全一致。

## Redis 管理
- **microi_redis_statistics / microi_redis_list_keys / microi_redis_get_key** — 统计、SCAN 分页与查看 String/Hash/List/Set/Sorted Set/Stream；默认操作当前租户 Redis
- **microi_redis_delete_keys / microi_redis_replace_value / microi_redis_rename_key / microi_redis_set_ttl** — 删除、写入、重命名和 TTL，均要求 confirmExecution
- 不要把 Redis 密码放进 MCP 参数、日志或回答；额外连接应先由平台 Redis 管理页保存，再通过 connectionId 使用

## sys_menu 自动增强默认值（创建后端菜单必须关注）
- 绑定 diyTableId 创建菜单时，不要只写 Name/DiyTableId。应配置或允许 MCP/后端自动推断：TableDiyFieldIds、SelectFields、SearchFieldIds、SortFieldIds、NotShowFields、StatisticsFields、MobileListFields、CardTitleTagFields、CardBottomTagFields、DefaultOrderBy。
- NotShowFields 默认隐藏 Id/外键/系统字段/布局控件/上传富文本地图子表等重字段；SearchFieldIds 默认选择标题、名称、编号、状态、类型、分类、负责人、时间等常用筛选；StatisticsFields 默认选择金额、价格、数量、积分、余额等数值字段；MobileListFields 默认选择 3-4 个卡片可读字段。
- 如果用户显式指定上述字段，以用户配置为准；否则 microi_generate_system 和后端 CreateModule 会按真实 diy_field 元数据补齐。

## ✅ 工具支持并发调用（请尽量并发以提高效率）
主要低代码建模写入工具（microi_create_table / microi_add_field / microi_create_module）已做幂等保护；microi_create_engine 的 ApiEngineKey 必须唯一，重复创建会返回错误：
- 后端使用 Ulid 随机段（非时间戳）生成唯一 URL 后缀，碰撞自动重试最多 5 次
- 重复 Name/字段会幂等返回 Skipped:true 而非报错
- "已存在唯一值" 错误会自动重试并追加随机后缀
**鼓励**：为同一张表批量添加 N 个字段时，可一次性发起 N 个并发 microi_add_field 调用以缩短总耗时；
不同表的 microi_create_table 也可并发；菜单模块同理。接口引擎请先 list/get 再 create，避免重复 ApiEngineKey。

## ⚖️ 何时创建接口引擎（microi_create_engine）
**绑定了 diyTableId 的菜单模块已经自动具备完整的基础 CRUD**（新增/编辑/删除/列表/搜索/导入/导出），无需额外接口引擎。
但**复杂业务系统几乎一定需要接口引擎**，遇到下列任一场景请**主动创建**：
- ✅ 工作流/审批节点动作（指派、接单、验收、驳回、批量处理等）
- ✅ 跨表事务操作（一次操作涉及多张表的写入/状态联动）
- ✅ 数据统计/报表/聚合查询（GROUP BY、SUM、复杂 JOIN）
- ✅ 第三方系统集成（调用外部 HTTP API、支付、短信、邮件、推送）
- ✅ 定时任务 / 消息队列消费 / MQTT 处理
- ✅ 业务校验/防重/库存扣减/账单生成
- ✅ 菜单按钮 V8Code 中调用的业务接口（典型模式：按钮点击 → V8.ApiEngine.Run('your-key', {...})）
**判断口诀**：能用一句 SQL/单表 CRUD 完成的不要建；逻辑超过 5 行 JS 或涉及多表/外部系统的，建一个接口引擎。

## 🔘 菜单按钮（重要！业务系统必备）
菜单模块（sys_menu）支持下列按钮 JSON 字段，每个按钮可写 V8 代码触发业务逻辑：
| 字段 | 说明 | 触发位置 |
|------|------|---------|
| MoreBtns | 行操作按钮（每行尾） | 列表每一行 |
| FormBtns | 表单底部按钮 | 编辑/查看表单 |
| BatchSelectMoreBtns | 批量操作按钮 | 列表勾选多行后 |
| PageTabs | 页面顶部 Tab 切换 | 列表顶部 |
| ExportMoreBtns | 导出扩展按钮 | 列表导出菜单 |
| PageBtns | 页面级按钮 | 页面顶部 |

**按钮对象结构**：
\`\`\`json
{
  "Id": "ulid-or-guid",     // 唯一Id
  "Sort": 0,                 // 排序
  "Name": "指派",            // 按钮名
  "Icon": "fas fa-user",     // 图标(可选)
  "BtnStyle": "primary",     // 样式: primary|success|warning|danger
  "IsVisible": true,
  "ShowRow": true,           // 行内显示(MoreBtns需要)
  "V8CodeShow": "if(V8.Form.Status=='待处理'){V8.Result=true;}else{V8.Result=false;}",  // 显隐JS
  "V8Code": "V8.ApiEngine.Run({ApiEngineKey:'order_assign', Id:V8.Form.Id}, function(r){V8.RefreshTable({_PageIndex:1});});",  // 点击执行JS
  "RunBackground": false,    // 长任务可设 true
  "BackgroundTask": false,   // 兼容别名
  "IsBackgroundTask": false, // 兼容别名
  "ApiEngineKey": ""         // 后台任务执行的接口引擎Key
}
\`\`\`
按钮的 V8Code **强烈建议** 调用接口引擎（V8.ApiEngine.Run）执行后端逻辑，前端只负责弹窗、刷新、提示。
应用安装、初始化多语言、批量导入、批量修复、跨系统同步等长任务应使用后台任务：按钮设置 RunBackground/BackgroundTask/IsBackgroundTask=true 并提供 ApiEngineKey，接口引擎内用 V8.Method.UpdateBackgroundTask 上报进度。
详细写法参考 skill 文档：\`microi.skills/v8-menu-buttons/SKILL.md\`

## 系统级表名前缀
平台级安全、访问审计、后台任务、运行态监控等系统能力表必须使用 mci_ 前缀；普通业务系统表不要使用 mci_ 前缀。

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

## 字段类型（type 参数）→ 必须是平台允许的列类型
⚠️ **平台禁止使用 datetime / date / timestamp / float / double / boolean 物理列类型！**
所有日期时间字段一律使用 \`varchar(25)\` 存储 'yyyy-MM-dd HH:mm:ss' 格式字符串。

| 用途 | 正确的 type 值 | 禁止使用 |
|------|---------------|----------|
| 短文本 | varchar(50), varchar(200), varchar(500) | ❌ string, text |
| 长文本/富文本 | mediumtext, longtext | ❌ string |
| 整数 | int, bigint | ❌ number, integer |
| 小数/金额 | decimal(18,2), decimal(10,4) | ❌ float, double, money |
| **日期时间** | **varchar(25)**（存 'yyyy-MM-dd HH:mm:ss'） | ❌❌❌ datetime, date, timestamp, time |
| 开关(0/1) | int | ❌ boolean, bool |

平台允许的列类型只有：**varchar(N)** | **mediumtext** | **longtext** | **int** | **bigint** | **decimal(18,N)**

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
| DateTime | 日期时间选择器 | **varchar(25)**（不要用 datetime） |
| Department | 部门选择器 | varchar(50) |
| Address | 地址选择（省市区） | varchar(500) |
| Map | 地图坐标选择 | varchar(200) |
| ImgUpload | 图片上传 | varchar(2000) |
| FileUpload | 文件上传 | varchar(2000) |
| AutoNumber | 自动编号（如 WO-20240101-001） | varchar(200) |
| TableChild | 子表/明细表 | — (关联表) |
| JoinForm | 关联表单（外键） | varchar(50) |
| OpenTable | 弹窗选择关联数据 | varchar(50) |

## 选项类组件（Select/MultipleSelect/Radio/Checkbox）数据源（重要！）
为这四种组件添加字段时，**必须**通过 \`data\` 参数传入选项，否则表单下拉框为空。
MCP 后端会自动解析 \`data\` 字符串并构建正确的 \`Config\` JSON。

### data 参数格式
- **KeyValue 格式**（推荐）：\`"key1|label1,key2|label2"\` —— 例如 \`"1|启用,0|禁用"\`、\`"male|男,female|女"\`
  - 自动生成 Config: \`{DataSource:"KeyValue", SelectLabel:"Value", SelectSaveField:"Key"}\`
  - 数据库存的是 key（如 "1"、"male"），界面显示 label
- **简单数组格式**：\`"启用,禁用,已删除"\` —— 仅显示和存储相同值
  - 自动生成 Config: \`{DataSource:"Data"}\`

### 高级数据源（通过 config 参数显式传入 JSON）
当需要 SQL/接口引擎/数据源引擎作为下拉数据时，传入 \`config\` JSON：
- SQL 数据源：\`{"DataSource":"Sql","Sql":"select Id,Name from xxx where Name like '%$Keyword$%' limit 0,20","SelectLabel":"Name","SelectSaveField":"Id","DataSourceSqlRemote":true}\`
- 接口引擎：\`{"DataSource":"ApiEngine","DataSourceApiEngineKey":"my-engine","SelectLabel":"name","SelectSaveField":"id"}\`
- 数据源引擎：\`{"DataSource":"DataSource","DataSourceId":"xxx","SelectLabel":"Name","SelectSaveField":"Id"}\`

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
  const { osClient } = context;

  // 协议层名称保持 ASCII；中文业务名只放在 UTF-8 instructions 中用于显示。
  const serverName = buildRuntimeServerName(context);

  const server = new McpServer(
    { name: serverName, version: '1.0.0' },
    { instructions: buildInstructions(context) },
  );
  const toolRegistry = bufferToolRegistrationsByPriority(server);

  server.tool(
    'microi_codex',
    `Codex-compatible single entry point for all Microi tools on OsClient "${osClient}". Use action="list_tools" with optional params.keyword to discover tools, action="describe_tool" with params.name to inspect exact arguments, or pass any existing Microi tool name such as microi_get_status, microi_get_db_schema, microi_get_table_data, microi_get_module, microi_update_module, microi_get_engine_code, or microi_save_engine_code. The dispatcher reuses the original tool validation, write confirmation, audit, and readback logic.`,
    {
      action: z.string().describe('list_tools | describe_tool | an existing microi_* tool name'),
      params: jsonRecordSchema.optional().describe('Arguments for the selected action. Use {keyword?} for list_tools and {name} for describe_tool.'),
    },
    async ({ action, params }) => {
      try {
        if (action === 'list_tools') {
          const keyword = getStringField(params, 'keyword', 'Keyword');
          const tools = toolRegistry.list(keyword);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                count: tools.length,
                keyword: keyword || null,
                tools,
                next: 'Call action="describe_tool" with params.name before invoking an unfamiliar write tool.',
              }, null, 2),
            }],
          };
        }
        if (action === 'describe_tool') {
          const name = getStringField(params, 'name', 'Name', 'tool', 'Tool');
          const detail = toolRegistry.describe(name);
          if (!detail) {
            return {
              content: [{ type: 'text', text: `Unknown Microi tool: ${name || '(empty)'}` }],
              isError: true,
            };
          }
          return { content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }] };
        }
        return await toolRegistry.invoke(action, params);
      } catch (e: unknown) {
        return {
          content: [{ type: 'text', text: `Microi dispatcher failed: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    },
  );

  // Codex versions affected by the tool-only MCP discovery regression call
  // resources/list instead of exposing server tools. Keep fixed discovery
  // resources plus a template fallback that still routes through the original
  // tool handlers and their validation/confirmation rules.
  server.resource(
    'microi_codex_status',
    'microi://codex/status',
    {
      title: `Microi ${osClient} status`,
      description: 'Read-only connection status fallback for Codex clients that fail to inject MCP tools.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const result = await toolRegistry.invoke('microi_get_status', {});
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: toolResultResourceText(result),
        }],
      };
    },
  );
  server.resource(
    'microi_codex_tools',
    'microi://codex/tools',
    {
      title: `Microi ${osClient} tool catalog`,
      description: 'Lists Microi tool names for Codex resource-mode fallback.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          tools: toolRegistry.list(),
          actionTemplate: 'microi://codex/action/{action}/{params}',
          params: 'URI-encoded JSON object. Example: microi://codex/action/microi_get_status/%7B%7D',
        }, null, 2),
      }],
    }),
  );
  server.resource(
    'microi_codex_action',
    new ResourceTemplate('microi://codex/action/{action}/{params}', { list: undefined }),
    {
      title: `Microi ${osClient} action fallback`,
      description: 'Invokes an original microi_* tool through a resource URI when Codex does not expose MCP tools. Write confirmations remain mandatory.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      try {
        const action = String(variables.action || '');
        const params = parseResourceParams(variables.params);
        const result = await toolRegistry.invoke(action, params);
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: toolResultResourceText(result),
          }],
        };
      } catch (e: unknown) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              isError: true,
              error: e instanceof Error ? e.message : String(e),
            }, null, 2),
          }],
        };
      }
    },
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

  server.tool(
    'microi_redis_statistics',
    `Get Redis server/keyspace statistics for OsClient "${osClient}". Uses the current tenant Redis by default; pass connectionId only for a connection previously saved in mci_redis_connection. Never pass Redis passwords through MCP.`,
    {
      database: z.number().int().min(0).max(1023).optional().describe('Redis database index. Default: 0.'),
      connectionId: z.string().optional().describe('Optional saved mci_redis_connection Id. Omit for current tenant Redis.'),
    },
    async ({ database, connectionId }) => {
      try {
        const result = await client.getRedisStatistics(database || 0, connectionId);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_redis_list_keys',
    `SCAN Redis keys for OsClient "${osClient}" without using blocking KEYS. Returns type, TTL, memory estimate and an opaque next cursor.`,
    {
      pattern: z.string().optional().describe('Redis glob pattern. Plain text is treated as a contains search. Default: *.'),
      database: z.number().int().min(0).max(1023).optional().describe('Redis database index. Default: 0.'),
      pageSize: z.number().int().min(10).max(500).optional().describe('Page size. Default: 100.'),
      cursor: z.string().optional().describe('Opaque NextCursor from the previous call.'),
      connectionId: z.string().optional().describe('Optional saved connection Id. Omit for current tenant Redis.'),
    },
    async ({ pattern, database, pageSize, cursor, connectionId }) => {
      try {
        const result = await client.getRedisKeys(pattern || '*', database || 0, pageSize || 100, cursor, connectionId);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_redis_get_key',
    `Read one Redis key for OsClient "${osClient}". Supports String, Hash, List, Set, Sorted Set and Stream with bounded pagination.`,
    {
      key: z.string().describe('Exact Redis key.'),
      database: z.number().int().min(0).max(1023).optional().describe('Redis database index. Default: 0.'),
      pageIndex: z.number().int().min(1).optional().describe('Collection page index. Default: 1.'),
      pageSize: z.number().int().min(10).max(1000).optional().describe('Collection page size. Default: 500.'),
      connectionId: z.string().optional().describe('Optional saved connection Id. Omit for current tenant Redis.'),
    },
    async ({ key, database, pageIndex, pageSize, connectionId }) => {
      try {
        const result = await client.getRedisKey(key, database || 0, pageIndex || 1, pageSize || 500, connectionId);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_redis_delete_keys',
    `Delete up to 500 Redis keys for OsClient "${osClient}". This is irreversible and requires confirmExecution="DELETE".`,
    {
      keys: z.array(z.string()).min(1).max(500).describe('Exact Redis keys to delete.'),
      database: z.number().int().min(0).max(1023).optional().describe('Redis database index. Default: 0.'),
      connectionId: z.string().optional().describe('Optional saved connection Id. Omit for current tenant Redis.'),
      confirmExecution: z.string().optional().describe('Required. Pass DELETE after reviewing the key list.'),
    },
    async ({ keys, database, connectionId, confirmExecution }) => {
      if (confirmExecution !== 'DELETE') {
        return { content: [{ type: 'text', text: JSON.stringify({ dryRun: true, action: 'delete', database: database || 0, connectionId: connectionId || null, keys }, null, 2) }] };
      }
      try {
        const result = await client.deleteRedisKeys(keys, database || 0, connectionId);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data || { ok: true }, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_redis_replace_value',
    `Create or replace a Redis String/Hash/List/Set/Sorted Set for OsClient "${osClient}". Existing content is replaced; confirmExecution must equal the exact key or EXECUTE.`,
    {
      key: z.string().describe('Exact Redis key.'),
      dataType: z.enum(['string', 'hash', 'list', 'set', 'sortedset']).describe('Target Redis data type.'),
      value: z.string().describe('String value, or JSON object/array for collection types.'),
      ttlSeconds: z.number().int().min(-1).optional().describe('-1 permanent, 0 delete immediately, positive seconds. Omit to preserve existing TTL.'),
      database: z.number().int().min(0).max(1023).optional().describe('Redis database index. Default: 0.'),
      connectionId: z.string().optional().describe('Optional saved connection Id. Omit for current tenant Redis.'),
      confirmExecution: z.string().optional().describe('Required. Pass the exact key or EXECUTE.'),
    },
    async ({ key, dataType, value, ttlSeconds, database, connectionId, confirmExecution }) => {
      if (confirmExecution !== key && confirmExecution !== 'EXECUTE') {
        return { content: [{ type: 'text', text: JSON.stringify({ dryRun: true, key, dataType, ttlSeconds, database: database || 0, connectionId: connectionId || null, valueLength: value.length }, null, 2) }] };
      }
      try {
        const result = await client.replaceRedisValue(key, dataType, value, database || 0, ttlSeconds, connectionId);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data || { ok: true }, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_redis_rename_key',
    `Rename a Redis key for OsClient "${osClient}" without overwriting an existing target. Requires confirmExecution equal to the new key or EXECUTE.`,
    {
      key: z.string().describe('Existing Redis key.'),
      newKey: z.string().describe('New Redis key.'),
      database: z.number().int().min(0).max(1023).optional(),
      connectionId: z.string().optional(),
      confirmExecution: z.string().optional().describe('Required. Pass newKey or EXECUTE.'),
    },
    async ({ key, newKey, database, connectionId, confirmExecution }) => {
      if (confirmExecution !== newKey && confirmExecution !== 'EXECUTE') {
        return { content: [{ type: 'text', text: JSON.stringify({ dryRun: true, action: 'rename', key, newKey, database: database || 0 }, null, 2) }] };
      }
      try {
        const result = await client.renameRedisKey(key, newKey, database || 0, connectionId);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data || { ok: true }, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_redis_set_ttl',
    `Set Redis TTL for OsClient "${osClient}". -1 persists, 0 deletes, positive values are seconds. Requires confirmExecution equal to the key or EXECUTE.`,
    {
      key: z.string().describe('Exact Redis key.'),
      ttlSeconds: z.number().int().min(-1).describe('-1 permanent, 0 delete, positive seconds.'),
      database: z.number().int().min(0).max(1023).optional(),
      connectionId: z.string().optional(),
      confirmExecution: z.string().optional().describe('Required. Pass key or EXECUTE.'),
    },
    async ({ key, ttlSeconds, database, connectionId, confirmExecution }) => {
      if (confirmExecution !== key && confirmExecution !== 'EXECUTE') {
        return { content: [{ type: 'text', text: JSON.stringify({ dryRun: true, action: 'ttl', key, ttlSeconds, database: database || 0 }, null, 2) }] };
      }
      try {
        const result = await client.setRedisTtl(key, ttlSeconds, database || 0, connectionId);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data || { ok: true }, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
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

  server.tool(
    'microi_list_database_types',
    'List all database types certified by the current Microi Dos.ORM runtime, including aliases, default ports, and redacted connection-string examples.',
    {},
    async () => {
      try {
        const result = await client.getSupportedDatabaseTypes();
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_inspect_external_database',
    `Connect to an external database through Dos.ORM for OsClient "${osClient}" and return physical tables, columns, native types, nullability, keys, and comments. Prefer dbKey after saving a connection so credentials are not repeatedly passed to AI tools. This tool never returns the connection string.`,
    {
      dbKey: z.string().optional().describe('Saved and enabled microi_database DbKey. Preferred over passing connectionString.'),
      databaseType: z.string().optional().describe('Required only with a temporary connectionString. Call microi_list_database_types for certified values.'),
      connectionString: z.string().optional().describe('Temporary database connection string. Sensitive: never place it in generated code, logs, or narrative output.'),
      tableName: z.string().optional().describe('Optional case-insensitive partial table-name filter.'),
      maxTables: z.number().int().min(1).max(5000).optional().describe('Maximum returned tables. Default 500.'),
      includeColumns: z.boolean().optional().describe('Whether to load columns for each table. Default true.'),
      commandTimeoutSeconds: z.number().int().min(1).max(600).optional().describe('Metadata query timeout. Default 60 seconds.'),
    },
    async ({ dbKey, databaseType, connectionString, tableName, maxTables, includeColumns, commandTimeoutSeconds }) => {
      if (!dbKey && (!databaseType || !connectionString)) {
        return { content: [{ type: 'text', text: 'Error: pass dbKey, or both databaseType and connectionString.' }], isError: true };
      }
      try {
        const result = await client.inspectExternalDatabase({
          DbKey: dbKey,
          DatabaseType: databaseType,
          ConnectionString: connectionString,
          TableName: tableName,
          MaxTables: maxTables,
          IncludeColumns: includeColumns,
          CommandTimeoutSeconds: commandTimeoutSeconds,
        });
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_query_external_database',
    `Run a bounded, parameterized, read-only SELECT/CTE query against an external Dos.ORM database for OsClient "${osClient}". Use this after schema inspection to read source rows for migration or synchronization. Multi-statement, DML, DDL, procedures, and file-reading SQL are rejected.`,
    {
      sql: z.string().min(1).describe('Single read-only SELECT or WITH ... SELECT statement. Use named parameters.'),
      parameters: z.record(z.unknown()).optional().describe('Named SQL parameter values, e.g. { status: 1 }. Never concatenate dynamic values into SQL.'),
      dbKey: z.string().optional().describe('Saved and enabled microi_database DbKey. Preferred.'),
      databaseType: z.string().optional().describe('Required only with a temporary connectionString.'),
      connectionString: z.string().optional().describe('Temporary connection string. Sensitive and never returned.'),
      maxRows: z.number().int().min(1).max(5000).optional().describe('Maximum returned rows. Default 200.'),
      commandTimeoutSeconds: z.number().int().min(1).max(600).optional().describe('Query timeout. Default 60 seconds.'),
    },
    async ({ sql, parameters, dbKey, databaseType, connectionString, maxRows, commandTimeoutSeconds }) => {
      if (!dbKey && (!databaseType || !connectionString)) {
        return { content: [{ type: 'text', text: 'Error: pass dbKey, or both databaseType and connectionString.' }], isError: true };
      }
      try {
        const result = await client.queryExternalDatabase({
          Sql: sql,
          Parameters: parameters,
          DbKey: dbKey,
          DatabaseType: databaseType,
          ConnectionString: connectionString,
          MaxRows: maxRows,
          CommandTimeoutSeconds: commandTimeoutSeconds,
        });
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_execute_external_database',
    `Execute explicitly confirmed administrative SQL against an external Dos.ORM database for OsClient "${osClient}". This Level >= 9999 control-plane tool intentionally permits DML, DDL, stored procedures, provider-specific commands, and driver-supported multi-statement scripts. The SQL text and connection string are never written to audit logs.`,
    {
      sql: z.string().min(1).describe('Raw administrative SQL. It may change schema/data or invoke provider-specific capabilities.'),
      mode: z.enum(['Query', 'Scalar', 'NonQuery']).describe('How Dos.ORM should consume the result. Use NonQuery for DML/DDL/scripts.'),
      parameters: z.record(z.unknown()).optional().describe('Optional named parameters. Use parameters for dynamic values whenever the provider supports them.'),
      dbKey: z.string().optional().describe('Saved and enabled microi_database DbKey. Preferred.'),
      databaseType: z.string().optional().describe('Required only with a temporary connectionString.'),
      connectionString: z.string().optional().describe('Temporary connection string. Sensitive and never returned or audited.'),
      maxRows: z.number().int().min(1).max(100000).optional().describe('Query response cap only; it does not limit SQL permissions. Default 1000.'),
      commandTimeoutSeconds: z.number().int().min(1).max(86400).optional().describe('Default 600 seconds.'),
      confirmExecution: z.string().optional().describe('Required. Pass EXECUTE or the SHA-256 shown by the dry run.'),
    },
    async ({ sql, mode, parameters, dbKey, databaseType, connectionString, maxRows, commandTimeoutSeconds, confirmExecution }) => {
      if (!dbKey && (!databaseType || !connectionString)) {
        return { content: [{ type: 'text', text: 'Error: pass dbKey, or both databaseType and connectionString.' }], isError: true };
      }
      const sqlSha256 = crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
      if (confirmExecution !== 'EXECUTE' && confirmExecution?.toLowerCase() !== sqlSha256) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              dryRun: true,
              action: 'execute_external_database_sql',
              target: dbKey ? `DbKey:${dbKey}` : `temporary:${databaseType}`,
              mode,
              sqlSha256,
              sqlLength: sql.length,
              parameterNames: Object.keys(parameters || {}),
              connectionStringProvided: !!connectionString,
              requiresConfirmation: 'EXECUTE or sqlSha256',
            }, null, 2),
          }],
        };
      }
      try {
        const result = await client.executeExternalDatabaseSql({
          Sql: sql,
          Mode: mode,
          Parameters: parameters,
          DbKey: dbKey,
          DatabaseType: databaseType,
          ConnectionString: connectionString,
          MaxRows: maxRows,
          CommandTimeoutSeconds: commandTimeoutSeconds,
          ConfirmExecution: confirmExecution,
        });
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_save_database_connection',
    `Validate and add or update a connection in the protected microi_database table for OsClient "${osClient}". The backend tests the connection before writing, never returns the secret, and invalidates the local V8.Dbs cache. Requires explicit confirmation.`,
    {
      dbKey: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,49}$/).describe('Stable V8 key used as V8.Dbs.{DbKey}.'),
      dbName: z.string().max(100).optional().describe('Display name. Defaults to dbKey.'),
      databaseType: z.string().describe('Certified type returned by microi_list_database_types.'),
      connectionString: z.string().min(1).describe('Sensitive database connection string. It is validated and never echoed.'),
      dbReadConn: z.string().optional().describe('Optional read-replica connection string of the same database type.'),
      dbVersion: z.string().optional(),
      remark: z.string().optional(),
      isEnable: z.number().int().min(0).max(1).optional().describe('Default 1.'),
      commandTimeoutSeconds: z.number().int().min(5).max(120).optional().describe('Connection validation timeout. Default 30 seconds.'),
      confirmExecution: z.string().optional().describe('Required. Pass the exact dbKey or EXECUTE.'),
    },
    async ({ dbKey, dbName, databaseType, connectionString, dbReadConn, dbVersion, remark, isEnable, commandTimeoutSeconds, confirmExecution }) => {
      if (confirmExecution !== dbKey && confirmExecution !== 'EXECUTE') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              dryRun: true,
              action: 'save_database_connection',
              dbKey,
              dbName: dbName || dbKey,
              databaseType,
              connectionStringProvided: true,
              requiresConfirmation: dbKey,
            }, null, 2),
          }],
        };
      }
      try {
        const result = await client.saveDatabaseConnection({
          DbKey: dbKey,
          DbName: dbName,
          DatabaseType: databaseType,
          ConnectionString: connectionString,
          DbReadConn: dbReadConn,
          DbVersion: dbVersion,
          Remark: remark,
          IsEnable: isEnable,
          CommandTimeoutSeconds: commandTimeoutSeconds,
          ConfirmExecution: confirmExecution,
        });
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_import_external_attachment',
    `Stream one attachment from HTTP(S), an absolute server-local path, or a UNC path into Microi storage for OsClient "${osClient}". This Level >= 9999 control-plane tool intentionally permits private-network and server-filesystem access. It bypasses Base64 buffering and has no fixed MCP size ceiling; MaxBytes is an optional caller safety limit. Requires explicit confirmation and writes a redacted audit record.`,
    {
      sourceUrl: z.string().url().refine(value => /^https?:\/\//i.test(value), 'sourceUrl must use http or https').optional().describe('HTTP(S) attachment URL. Provide exactly one of sourceUrl/sourcePath.'),
      sourcePath: z.string().optional().describe('Absolute path visible to the API service account, including Windows UNC paths such as \\\\server\\share\\file.bin. Provide exactly one source.'),
      headers: z.record(z.string()).optional().describe('Optional authentication headers. Sensitive values are never returned.'),
      fileName: z.string().optional(),
      path: z.string().optional().describe('Target Microi storage directory.'),
      filePathName: z.string().optional().describe('Exact tenant-scoped target path; bucket visibility follows limit.'),
      limit: z.boolean().optional(),
      preview: z.boolean().optional(),
      maxBytes: z.number().int().nonnegative().optional().describe('Optional caller limit in bytes. Omit or pass 0 for no MCP-level size cap.'),
      timeoutSeconds: z.number().int().min(5).max(86400).optional().describe('HTTP transfer timeout. Default 3600 seconds.'),
      targetTable: z.string().optional(),
      targetId: z.string().optional(),
      targetField: z.string().optional(),
      confirmExecution: z.string().optional().describe('Required. Pass EXECUTE, the exact source value, or its dry-run SHA-256.'),
    },
    async ({ sourceUrl, sourcePath, headers, fileName, path, filePathName, limit, preview, maxBytes, timeoutSeconds, targetTable, targetId, targetField, confirmExecution }) => {
      if (!!sourceUrl === !!sourcePath) {
        return { content: [{ type: 'text', text: 'Error: provide exactly one of sourceUrl or sourcePath.' }], isError: true };
      }
      const source = sourceUrl || sourcePath || '';
      const sourceSha256 = crypto.createHash('sha256').update(source, 'utf8').digest('hex');
      if (confirmExecution !== source && confirmExecution !== 'EXECUTE'
        && confirmExecution?.toLowerCase() !== sourceSha256) {
        let redactedSource = sourcePath ? '[LOCAL_OR_UNC_SOURCE]' : '[INVALID_URL]';
        if (sourceUrl) {
          try {
            const parsed = new URL(sourceUrl);
            redactedSource = `${parsed.protocol}//${parsed.host}/[REDACTED]`;
          } catch {
            // Zod already validates URL; retain defensive fallback.
          }
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              dryRun: true,
              action: 'import_external_attachment',
              source: redactedSource,
              sourceKind: sourcePath ? 'LocalOrUncPath' : 'Http',
              sourceSha256,
              headersProvided: !!headers && Object.keys(headers).length > 0,
              targetTable,
              targetId,
              targetField,
              requiresConfirmation: 'EXECUTE, exact source, or sourceSha256',
            }, null, 2),
          }],
        };
      }
      try {
        const result = await client.importExternalAttachment({
          SourceUrl: sourceUrl,
          SourcePath: sourcePath,
          Headers: headers,
          FileName: fileName,
          Path: path,
          FilePathName: filePathName,
          Limit: limit,
          Preview: preview,
          MaxBytes: maxBytes,
          TimeoutSeconds: timeoutSeconds,
          TargetTable: targetTable,
          TargetId: targetId,
          TargetField: targetField,
          ConfirmExecution: confirmExecution,
        });
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 获取 Playwright 测试上下文
  // ========================
  server.tool(
    'microi_get_playwright_context',
    `Get Playwright E2E testing context for OsClient "${osClient}". Returns callable API engines, anonymous/public flags, and menu routes for writing browser automation tests.`,
    {
      keyword: z.string().optional().describe('Optional keyword to filter engines/modules by name, key, route, category, or table name.'),
      pageSize: z.number().int().min(100).max(20000).optional().describe('Maximum number of engines/modules returned by the backend context API. Default: 5000.'),
    },
    async ({ keyword, pageSize }) => {
      try {
        const result = await client.getPlaywrightContext(keyword, pageSize);
        if (result.Code !== 1 || !result.Data) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg || 'GetPlaywrightContext failed'}` }], isError: true };
        }
        return { content: [{ type: 'text', text: formatPlaywrightContext(result.Data, context.apiBaseUrl) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 生成 Playwright E2E 计划
  // ========================
  server.tool(
    'microi_plan_playwright_e2e',
    `Create a Playwright E2E starter plan for a Microi frontend connected to OsClient "${osClient}". Use this before scaffolding tests in a PC Vue or uni-app H5 project.`,
    {
      appType: z.enum(['pc-vue', 'uniapp-h5', 'web']).optional().describe('Frontend type. Default: uniapp-h5.'),
      frontendBaseUrl: z.string().optional().describe('Local frontend URL, e.g. http://127.0.0.1:5180.'),
      homePath: z.string().optional().describe('Home route, e.g. /#/pages/index/index for uni-app H5.'),
      loginEngineKey: z.string().optional().describe('ApiEngineKey used for login.'),
      smokeEngineKey: z.string().optional().describe('Public ApiEngineKey used for API smoke assertion.'),
      keyword: z.string().optional().describe('Keyword to focus context on a module or business area.'),
      pageSize: z.number().int().min(100).max(20000).optional().describe('Maximum number of engines/modules requested from the backend context API. Default: 5000.'),
    },
    async ({ appType, frontendBaseUrl, homePath, loginEngineKey, smokeEngineKey, keyword, pageSize }) => {
      try {
        const contextResult = await client.getPlaywrightContext(keyword, pageSize);
        const playwrightContext = contextResult.Code === 1 ? contextResult.Data : undefined;
        const text = buildPlaywrightPlanText({
          osClient,
          apiBaseUrl: playwrightContext?.ApiBaseUrl || context.apiBaseUrl,
          frontendBaseUrl,
          appType,
          homePath,
          loginEngineKey,
          smokeEngineKey,
          pageSize,
          context: playwrightContext,
        });
        return { content: [{ type: 'text', text }] };
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

        let engines = unwrapList<Record<string, unknown>>(result.Data);
        if (keyword) {
          engines = engines.filter((e) =>
            includesKeyword(e.ApiEngineKey, keyword) ||
            includesKeyword(e.ApiName, keyword) ||
            includesKeyword(e.Category, keyword) ||
            includesKeyword(e.ApiRemark, keyword),
          );
        }
        if (!engines.length) {
          return { content: [{ type: 'text', text: 'No engines found.' }] };
        }

        const lines = [
          `# API Engines (${engines.length})\n`,
          '| # | Engine Key | Name | Category | Description |',
          '|---|-----------|------|----------|-------------|',
        ];
        engines.forEach((e, i) => {
          lines.push(`| ${i + 1} | ${e.ApiEngineKey || ''} | ${e.ApiName || ''} | ${e.Category || ''} | ${e.ApiRemark || e.Description || ''} |`);
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
    `Get JavaScript source code of a specific API engine (OsClient: ${osClient}). Large source is returned in explicit character chunks so the MCP host cannot silently replace missing code with a "tokens truncated" marker. Read every chunk before editing; never save a single partial chunk as complete source.`,
    {
      apiEngineKey: z.string().describe('The unique key of the API engine'),
      charOffset: z.number().int().nonnegative().optional().describe('Zero-based character offset. Start with 0, then use nextCharOffset until hasMore=false.'),
      maxChars: z.number().int().min(1000).max(16000).optional().describe('Characters per chunk (default 6000, max 16000).'),
    },
    async ({ apiEngineKey, charOffset, maxChars }) => {
      try {
        const result = await client.getEngineCode(apiEngineKey);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }

        const engine = result.Data;
        const code = getStringField(engine, 'ApiV8Code', 'Code', 'V8Code');
        const start = Math.min(charOffset || 0, code.length);
        const chunkSize = maxChars || 6000;
        const end = Math.min(start + chunkSize, code.length);
        const chunk = code.slice(start, end);
        const hasMore = end < code.length;
        const sha256 = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
        const lines = [
          `## API Engine: ${engine?.ApiEngineKey || apiEngineKey}`,
          engine?.ApiName ? `- **Name**: ${engine.ApiName}` : '',
          engine?.Category ? `- **Category**: ${engine.Category}` : '',
          engine?.ApiAddress ? `- **Address**: ${engine.ApiAddress}` : '',
          engine?.ApiRemark ? `- **Remark**: ${engine.ApiRemark}` : '',
          `- **Source completeness**: ${hasMore || start > 0 ? 'PARTIAL CHUNK — do not save this chunk alone' : 'COMPLETE'}`,
          `- **Character range**: [${start}, ${end}) of ${code.length}`,
          `- **Full source SHA-256**: ${sha256}`,
          hasMore ? `- **Next call**: charOffset=${end}, maxChars=${chunkSize}` : '- **Has more**: false',
          '',
          '```javascript',
          chunk || '// No code available',
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
      confirmExecution: z.string().optional().describe('Required because engine execution may write data. Use apiEngineKey or EXECUTE.'),
    },
    async ({ apiEngineKey, params, confirmExecution }) => {
      try {
        if (confirmExecution !== apiEngineKey && confirmExecution !== 'EXECUTE') {
          return { content: [{ type: 'text', text: `执行已拦截：microi_run_engine 可能产生写入或外部调用，请重新调用并传 confirmExecution="${apiEngineKey}" 或 "EXECUTE"。` }], isError: true };
        }
        await client.writeAuditLog('microi_run_engine', apiEngineKey, JSON.stringify(params || {}));
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
  // Tool: 批量插入样例数据 (Sample Data Seeding)
  // ========================
  server.tool(
    'microi_seed_table_data',
    `Seed sample/demo rows into any low-code table for OsClient "${osClient}". Wraps V8.FormEngine.AddTableData. Use this for filling商品/订单/会员等样例数据。Each row will get Id/CreateTime/OsClient auto-filled by the platform.`,
    {
      tableName: z.string().describe('Target diy_table name (e.g. "mall_product")'),
      rows: z.array(z.record(z.unknown())).describe('Array of row objects. Each object = one record. Field names must match diy_field PascalCase names.'),
      skipIfExists: z.boolean().optional().describe('When true, skips seeding if table already has any rows. Default: false.'),
      confirmExecution: z.string().optional().describe('Required because this writes to DB. Use tableName or "EXECUTE".'),
    },
    async ({ tableName, rows, skipIfExists, confirmExecution }) => {
      try {
        if (confirmExecution !== tableName && confirmExecution !== 'EXECUTE') {
          return { content: [{ type: 'text', text: `执行已拦截：microi_seed_table_data 会写入 ${rows.length} 条到表 ${tableName}，请重新调用并传 confirmExecution="${tableName}" 或 "EXECUTE"。` }], isError: true };
        }
        await client.writeAuditLog('microi_seed_table_data', tableName, JSON.stringify({ count: rows.length, skipIfExists: !!skipIfExists }));
        const result = await client.executeEngine('_mcp_seed_table_data', { tableName, rows, skipIfExists: !!skipIfExists });
        return {
          content: [{ type: 'text', text: `## Seed: ${tableName}\n- **Code**: ${result.Code}\n- **Msg**: ${result.Msg ?? ''}\n\n\`\`\`json\n${JSON.stringify(result.Data, null, 2)}\n\`\`\`` }],
          isError: result.Code !== 1,
        };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 通用 FormEngine 数据读写
  // ========================
  server.tool(
    'microi_get_table_data',
    `Read rows from a low-code table through FormEngine.GetTableData for OsClient "${osClient}". Use this to verify business data after writes.`,
    {
      tableName: z.string().describe('Target diy_table name, e.g. mall_product'),
      query: z.record(z.unknown()).optional().describe('FormEngine query object: _Where, _SelectFields, _PageSize, _OrderBy, etc.'),
    },
    async ({ tableName, query }) => {
      try {
        const result = await client.getTableData(tableName, query || {});
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_add_form_data',
    `Add one row to a low-code table through FormEngine.AddFormData for OsClient "${osClient}". Writes to DB; confirmExecution is required.`,
    {
      tableName: z.string().describe('Target diy_table name, e.g. mall_product'),
      row: z.record(z.unknown()).describe('Row object. Field names must match diy_field names.'),
      confirmExecution: z.string().optional().describe('Required. Use tableName or "EXECUTE".'),
    },
    async ({ tableName, row, confirmExecution }) => {
      try {
        if (confirmExecution !== tableName && confirmExecution !== 'EXECUTE') {
          return { content: [{ type: 'text', text: `执行已拦截：microi_add_form_data 会写入表 ${tableName}，请传 confirmExecution="${tableName}" 或 "EXECUTE"。` }], isError: true };
        }
        await client.writeAuditLog('microi_add_form_data', tableName, JSON.stringify({ fields: Object.keys(row || {}) }));
        const result = await client.addFormData(tableName, row);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: `✅ Row added to ${tableName}. ${JSON.stringify(result.Data)}` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_update_form_data',
    `Update one row in a low-code table through FormEngine.UptFormData for OsClient "${osClient}". The row must include Id. Writes to DB; confirmExecution is required.`,
    {
      tableName: z.string().describe('Target diy_table name, e.g. mall_product'),
      row: z.record(z.unknown()).describe('Patch object. Must include Id.'),
      confirmExecution: z.string().optional().describe('Required. Use tableName or "EXECUTE".'),
    },
    async ({ tableName, row, confirmExecution }) => {
      try {
        if (confirmExecution !== tableName && confirmExecution !== 'EXECUTE') {
          return { content: [{ type: 'text', text: `执行已拦截：microi_update_form_data 会更新表 ${tableName}，请传 confirmExecution="${tableName}" 或 "EXECUTE"。` }], isError: true };
        }
        if (!row || typeof row.Id !== 'string' || !row.Id) {
          return { content: [{ type: 'text', text: 'Error: row.Id is required.' }], isError: true };
        }
        await client.writeAuditLog('microi_update_form_data', tableName, JSON.stringify({ id: row.Id, fields: Object.keys(row || {}) }));
        const result = await client.updateFormData(tableName, row);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: `✅ Row updated in ${tableName}. ${JSON.stringify(result.Data)}` }] };
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

        let events = unwrapList<Record<string, unknown>>(result.Data);
        if (keyword) {
          events = events.filter((ev) =>
            includesKeyword(ev.FormEngineKey, keyword) ||
            includesKeyword(ev.TableName, keyword) ||
            includesKeyword(ev.Description, keyword) ||
            includesKeyword(ev.EventType, keyword),
          );
        }
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
    `Save (update) API engine JavaScript code on Microi server (OsClient: ${osClient}). Increments semantic Version (v1.0.0 -> v1.0.1, patch/minor max 9), writes a header with function description only, syncs sys_apiengine.Version/ChangeHistory when those fields exist, and preserves AllowAnonymous, StopHttp, IsEnable, ApiAddress and other HTTP/security metadata. Transport timeouts are automatically verified by remote readback. Do not bypass this tool with raw HTTP, FormEngine, SQL, or a temporary maintenance engine.`,
    {
      apiEngineKey: z.string().describe('The unique key of the API engine'),
      code: z.string().describe('The complete JavaScript source code to save'),
      functionDescription: z.string().optional().describe('Complete function description to keep in the code header. No change history here.'),
      changeSummary: z.string().optional().describe('One-line change summary stored in sys_apiengine.ChangeHistory when the field exists.'),
      confirmLargeReduction: z.string().optional().describe('Required only when replacing source >=8000 chars with code shorter by more than 15%. Use apiEngineKey or EXECUTE.'),
    },
    async ({ apiEngineKey, code, functionDescription, changeSummary, confirmLargeReduction }) => {
      try {
        const result = await client.saveEngineCode(apiEngineKey, code, {
          functionDescription,
          changeSummary,
          confirmLargeReduction: confirmLargeReduction === apiEngineKey || confirmLargeReduction === 'EXECUTE',
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return {
          content: [{
            type: 'text',
            text: `✅ Engine "${apiEngineKey}" code saved successfully.\n\n${JSON.stringify(result.Data || {}, null, 2)}`,
          }],
        };
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
    `Create a new API engine (接口引擎) for OsClient "${osClient}". Stored in sys_apiengine table. WARNING: Do NOT create API engines for basic CRUD operations — the low-code platform handles CRUD automatically when a menu module is bound to a diy_table. Only create engines for complex business logic, third-party integrations, scheduled tasks, or custom calculations.`,
    {
      apiEngineKey: z.string().describe('Unique key for the new engine (lowercase, hyphens allowed, e.g. "my-new-api")'),
      apiName: z.string().describe('Display name of the engine'),
      category: z.string().optional().describe('Category to organize engines'),
      code: z.string().optional().describe('Initial JavaScript code for the engine'),
      functionDescription: z.string().optional().describe('Complete function description to keep in the initial code header. No change history here.'),
      changeSummary: z.string().optional().describe('One-line change summary stored in sys_apiengine.ChangeHistory when the field exists.'),
      apiAddress: z.string().optional().describe('Custom URL path. Default: /apiengine/{apiEngineKey}. ⚠️ Empty string causes 404 — MCP auto-fills this; only override when you need a custom alias.'),
    },
    async ({ apiEngineKey, apiName, category, code, functionDescription, changeSummary, apiAddress }) => {
      try {
        const result = await client.createEngine({
          ApiEngineKey: apiEngineKey,
          ApiName: apiName,
          Category: category,
          Code: code,
          functionDescription,
          changeSummary,
          ApiAddress: apiAddress,
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return {
          content: [{
            type: 'text',
            text: [
              `✅ Engine "${apiEngineKey}" created successfully.`,
              result.Msg ? `\n${result.Msg}` : '',
              result.Data ? `\n${JSON.stringify(result.Data, null, 2)}` : '',
            ].join(''),
          }],
        };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 上传平台文件
  // ========================
  server.tool(
    'microi_upload_file_base64',
    `Upload a base64 file to Microi platform HDFS for OsClient "${osClient}". Use this for app images, posters, banners and other assets instead of third-party image URLs. Optionally writes the uploaded platform file path back to a low-code table field.`,
    {
      fileByteBase64: z.string().describe('File content as base64. Data URLs such as data:image/png;base64,... are accepted.'),
      fileName: z.string().optional().describe('File name, e.g. mall-banner.png'),
      path: z.string().optional().describe('Platform storage path, e.g. mall/banner or mcp/assets'),
      filePathName: z.string().optional().describe('Exact tenant-scoped private object path. Requires limit=true and preserves the existing database path during public-to-private migration.'),
      limit: z.boolean().optional().describe('Whether to upload to a private path. Default false.'),
      preview: z.boolean().optional().describe('Whether to let the platform generate preview/compressed output. Default true.'),
      targetTable: z.string().optional().describe('Optional table name to update after upload.'),
      targetId: z.string().optional().describe('Optional row Id to update after upload.'),
      targetField: z.string().optional().describe('Optional field name that stores the uploaded file path.'),
    },
    async ({ fileByteBase64, fileName, path, filePathName, limit, preview, targetTable, targetId, targetField }) => {
      try {
        const result = await client.uploadFileBase64({
          FileName: fileName,
          FileByteBase64: fileByteBase64,
          Path: path,
          FilePathName: filePathName,
          Limit: limit,
          Preview: preview,
          TargetTable: targetTable,
          TargetId: targetId,
          TargetField: targetField,
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `✅ File uploaded successfully.\n\n${JSON.stringify(result.Data, null, 2)}` }] };
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
    `Get form/table V8 event JavaScript code by table name and event type (OsClient: ${osClient}). Use this for 表单V8事件 such as SubmitBeforeServerV8, SubmitAfterServerV8 and DataFilterV8.`,
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
        const code = getStringField(event, 'V8Code', 'Code');
        const lines = [
          `## V8 Event: ${formEngineKey} / ${eventType}`,
          event?.EventName ? `- **Name**: ${event.EventName}` : '',
          event?.Description ? `- **Table**: ${event.Description}` : '',
          '',
          '```javascript',
          code || '// No code available',
          '```',
        ].filter(Boolean);

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
    `Save (update) form/table V8 event code on Microi server (OsClient: ${osClient}). This is the MCP tool for submitting 表单V8事件 code. Increments semantic Version in the code header and keeps only the complete function description in code; change history is not written into event source code. Transport timeouts are automatically verified by remote readback. Do not switch to Diy_Table/FormEngine direct writes or SQL after a timeout.`,
    {
      formEngineKey: z.string().describe('The table name or FormEngine key the event belongs to'),
      eventType: z.string().describe('Event type: InFormV8 | SubmitFormV8 | OutFormV8 | SubmitBeforeServerV8 | SubmitAfterServerV8 | DataFilterV8'),
      code: z.string().describe('The complete JavaScript source code to save'),
      functionDescription: z.string().optional().describe('Complete function description to keep in the code header. No change history here.'),
      changeSummary: z.string().optional().describe('One-line change summary for audit/future compatible storage.'),
    },
    async ({ formEngineKey, eventType, code, functionDescription, changeSummary }) => {
      try {
        const result = await client.saveEventCode(formEngineKey, eventType, code, { functionDescription, changeSummary });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return {
          content: [{
            type: 'text',
            text: `✅ Event "${formEngineKey}/${eventType}" code saved successfully.\n\n${JSON.stringify(result.Data || {}, null, 2)}`,
          }],
        };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 列出流程节点 V8 事件
  // ========================
  server.tool(
    'microi_list_workflow_v8_events',
    `List workflow node V8 events from WF_Node for OsClient ${osClient}. WF_Line is returned only in the workflow package snapshot; executable route condition code is WF_Node.LineValueV8.`,
    {
      flowDesignId: z.string().optional().describe('Optional WF_FlowDesign.Id to limit results to one workflow'),
    },
    async ({ flowDesignId }) => {
      try {
        const result = await client.getWorkflowV8EventList(flowDesignId);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 获取流程节点 V8 代码
  // ========================
  server.tool(
    'microi_get_workflow_v8_code',
    `Get workflow node V8 JavaScript code from WF_Node by nodeId and event type (OsClient: ${osClient}).`,
    {
      nodeId: z.string().describe('WF_Node.Id'),
      eventType: z.string().describe('WF_Node V8 field: StartV8 | EndV8 | StartV8Server | EndV8Server | LineValueV8 | AllowAddUserV8Code'),
      flowDesignId: z.string().optional().describe('Optional WF_FlowDesign.Id used as a safety check'),
    },
    async ({ nodeId, eventType, flowDesignId }) => {
      try {
        const result = await client.getWorkflowV8EventCode(nodeId, eventType, flowDesignId);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }

        const event = result.Data;
        const code = getStringField(event, 'V8Code', 'Code');
        const lines = [
          `## Workflow V8: ${event?.FlowName || event?.FlowDesignId || flowDesignId || ''} / ${event?.NodeName || nodeId} / ${eventType}`,
          event?.EventName ? `- **Name**: ${event.EventName}` : '',
          event?.FlowDesignId ? `- **FlowDesignId**: ${event.FlowDesignId}` : '',
          event?.NodeId ? `- **NodeId**: ${event.NodeId}` : '',
          '',
          '```javascript',
          code || '// No code available',
          '```',
        ].filter(Boolean);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 保存流程节点 V8 代码
  // ========================
  server.tool(
    'microi_save_workflow_v8_code',
    `Save workflow node V8 code into WF_Node for OsClient ${osClient}. Empty code clears the field without adding a generated header.`,
    {
      nodeId: z.string().describe('WF_Node.Id'),
      eventType: z.string().describe('WF_Node V8 field: StartV8 | EndV8 | StartV8Server | EndV8Server | LineValueV8 | AllowAddUserV8Code'),
      code: z.string().describe('The complete JavaScript source code to save; pass empty string to clear'),
      flowDesignId: z.string().optional().describe('Optional WF_FlowDesign.Id used as a safety check'),
      functionDescription: z.string().optional().describe('Complete function description to keep in the code header. No change history here.'),
      changeSummary: z.string().optional().describe('One-line change summary for audit/future compatible storage.'),
    },
    async ({ nodeId, eventType, code, flowDesignId, functionDescription, changeSummary }) => {
      try {
        const result = await client.saveWorkflowV8EventCode(nodeId, eventType, code, { flowDesignId, functionDescription, changeSummary });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `✅ Workflow node V8 "${nodeId}/${eventType}" saved successfully.` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 查询 MongoDB 系统日志
  // ========================
  server.tool(
    'microi_query_mongodb_logs',
    `Query Microi MongoDB system logs (sys_log_<osClient>/log_yyyyMM) for OsClient ${osClient}. Use this after automated tests to inspect V8 errors, slow logs, workflow logs and platform guard logs.`,
    {
      keyword: z.string().optional().describe('Keyword searched in log Title and Content'),
      type: z.string().optional().describe('Log Type, for example MCP, 表单V8慢日志, 表单V8递归保护, 工作流合并提交慢日志'),
      level: z.number().optional().describe('Log level. Common values: 1 info, 2 warning, 3 error'),
      searchMonth: z.string().optional().describe('Month in yyyyMM. Defaults to current month on server'),
      pageIndex: z.number().optional().describe('Page index, default 1'),
      pageSize: z.number().optional().describe('Page size, default 20, backend max 200'),
    },
    async ({ keyword, type, level, searchMonth, pageIndex, pageSize }) => {
      try {
        const result = await client.queryMongodbLogs({ keyword, type, level, searchMonth, pageIndex, pageSize });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 写入 MongoDB 系统日志
  // ========================
  server.tool(
    'microi_write_mongodb_log',
    `Write a Microi MongoDB system log for OsClient ${osClient}. Useful for AI automated test milestones, reproduction markers, and repair verification notes.`,
    {
      title: z.string().describe('Log title'),
      content: z.string().describe('Log content'),
      type: z.string().optional().describe('Log Type, default MCP'),
      level: z.number().optional().describe('Log level, default 1'),
      api: z.string().optional().describe('Related API/tool name'),
      param: z.string().optional().describe('Input or context summary. Avoid secrets.'),
      remark: z.string().optional().describe('Short remark or target identifier'),
      otherInfo: z.string().optional().describe('Additional diagnostic info. Avoid secrets.'),
      timer: z.number().optional().describe('Elapsed milliseconds, if applicable'),
      result: z.string().optional().describe('Result summary'),
      appId: z.string().optional().describe('AppId, default microi.mcp'),
    },
    async ({ title, content, type, level, api, param, remark, otherInfo, timer, result, appId }) => {
      try {
        const writeResult = await client.writeMongodbLog({ title, content, type, level, api, param, remark, otherInfo, timer, result, appId });
        if (writeResult.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${writeResult.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(writeResult.Data || { ok: true }, null, 2) }] };
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
    `Create a new custom table for OsClient "${osClient}". Inserts a record into diy_table. IDEMPOTENT — calling again with the same name returns Skipped:true with the existing TableId. This is step 2 of system design.`,
    {
      name: z.string().describe('Table name in English (e.g. "Crm_Customer", "Order_Main"). Convention: Module_Entity format. Will be a real MySQL table.'),
      description: z.string().optional().describe('Chinese description of the table (e.g. "客户信息", "订单主表")'),
      tabs: z.string().optional().describe('Form tab layout JSON (e.g. \'[{"Id":"basic","Name":"基本信息","Sort":10},{"Id":"business","Name":"业务信息","Sort":20}]\'). Groups fields into diy_table.Tabs. When using microi_generate_system, many-field tables can be auto-tabbed.'),
      isTree: z.number().optional().describe('Enable tree structure (1=tree table with ParentId self-referencing, 0=flat). Default: 0'),
      column: z.number().optional().describe('Number of form columns (1, 2, or 3). Controls form layout. Default: 2 (双列，更紧凑现代)'),
      formOpenType: z.string().optional().describe('How to open form: "Dialog" (弹窗), "Drawer" (抽屉), "Page" (新页面). Default: Dialog'),
      formOpenWidth: z.string().optional().describe('Form dialog/drawer width (e.g. "800px", "60%"). Default: auto'),
    },
    async ({ name, description, tabs, isTree, column, formOpenType, formOpenWidth }) => {
      try {
        const result = await client.createTable(name, description, {
          Tabs: tabs, IsTree: isTree, Column: column ?? 2,
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
    `Add a field to a custom table for OsClient "${osClient}". Inserts a record into diy_field and executes ALTER TABLE to add the column. The "type" parameter MUST be a platform-allowed column type. ⚠️ FORBIDDEN: datetime, date, timestamp, time — all date/time fields MUST use varchar(25) and store 'yyyy-MM-dd HH:mm:ss' strings. Allowed types: varchar(N), mediumtext, longtext, int, bigint, decimal(18,N). This tool is IDEMPOTENT — calling it again with the same TableId+name returns Skipped:true instead of failing.`,
    {
      tableId: z.string().describe('The TableId returned from microi_create_table'),
      name: z.string().describe('Field name in English (e.g. "CustomerName", "Phone", "Amount")'),
      label: z.string().describe('Chinese display label (e.g. "客户名称", "手机号", "金额")'),
      type: z.string().optional().describe('Platform column type. Default: varchar(500). Valid: varchar(25/50/200/500/2000), int, bigint, decimal(18,2), mediumtext, longtext. ⚠️ FORBIDDEN: datetime, date, timestamp, float, double, boolean — for dates use varchar(25); for floats use decimal(18,N); for booleans use int.'),
      component: z.string().optional().describe('UI component type. Default: Text. Options: Text, Textarea, NumberText, Select, MultipleSelect, Radio, Checkbox, Switch, DateTime, RichText, ImgUpload, FileUpload, AutoNumber, JoinForm, OpenTable, SelectTree, Cascader, Department, Address, Map, Rate, TableChild'),
      visible: z.number().optional().describe('Is visible in form (1=yes, 0=no). Default: 1'),
      appVisible: z.number().optional().describe('Is visible in mobile app (1=yes, 0=no). Default: 1'),
      tab: z.string().optional().describe('Form tab group name (for organizing fields into tabs)'),
      tableWidth: z.number().optional().describe('Column width in list view (pixels). Default: 120'),
      sort: z.number().optional().describe('Field display order (smaller = front). If omitted, MCP auto-increments per table starting at 100, step 10 — so adding fields in business-meaningful order produces correct list/form ordering automatically. Override only when you need a specific position.'),
      readonly: z.number().optional().describe('Is readonly (1=yes, 0=no). Default: 0'),
      notEmpty: z.number().optional().describe('Required field validation (1=required, 0=optional). Default: 0'),
      unique: z.number().optional().describe('Unique constraint (1=unique, 0=allow duplicates). Default: 0'),
      defaultValue: z.string().optional().describe('Default value for the field'),
      placeholder: z.string().optional().describe('Placeholder text shown in form input'),
      formWidth: z.number().nullable().optional().describe('Field width in form grid columns (1-24). Default: null/omitted for normal fields. Use 24 only for full-row controls such as CodeEditor, Textarea, RichText, upload, TableChild, map/layout/custom components.'),
      data: z.string().optional().describe('Options data source for Select/MultipleSelect/Radio/Checkbox components. REQUIRED for these four components. Format: "key1|label1,key2|label2" (KeyValue, recommended — e.g. "1|启用,0|禁用", "male|男,female|女") — backend stores key, displays label. Or simple "v1,v2,v3" (same value for both). Backend auto-builds the Config JSON. For SQL/ApiEngine/DataSource sources, use the config parameter instead.'),
      config: z.string().optional().describe('Component config JSON string. Auto-generated for Select/Radio/Checkbox when "data" is provided. Use this only for advanced cases:\n - SQL source: \'{"DataSource":"Sql","Sql":"select Id,Name from t where Name like \\\'%$Keyword$%\\\' limit 0,20","SelectLabel":"Name","SelectSaveField":"Id","DataSourceSqlRemote":true}\'\n - ApiEngine: \'{"DataSource":"ApiEngine","DataSourceApiEngineKey":"key","SelectLabel":"name","SelectSaveField":"id"}\'\n - AutoNumber: \'{"AutoNumberFixed":"ORD","AutoNumberLength":4}\'\n - DateTime: \'{"DateTimeType":"datetime"}\' (datetime|date|month|year|HH:mm)\n - JoinForm: \'{"JoinForm":{"TableId":"xxx","TableName":"xxx","JoinFieldName":"yyy"}}\''),
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
          Visible: visible ?? 1, AppVisible: appVisible ?? 1,
          Tab: tab, TableWidth: tableWidth, Sort: sort ?? nextSortFor(tableId),
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
  // Tool: 添加外键关联字段对（Id 隐藏 + Name 可见 Select+SQL）
  // ========================
  server.tool(
    'microi_add_join_field',
    `Add a foreign-key field PAIR to a custom table for OsClient "${osClient}". Creates TWO fields atomically: (1) {baseName}Id — hidden varchar(50) Text storing the FK Id; (2) {baseName}Name — visible varchar(200) Select with DataSource:Sql showing and storing the Name, plus a FieldValueChange V8Code that copies the selected option's Id into the {baseName}Id field. This is the CORRECT pattern for any FK relationship in Microi — do NOT use a single Id-only field, as the list view cannot show the related Name without a join. IDEMPOTENT.`,
    {
      tableId: z.string().describe('The TableId of the table to add fields into'),
      baseName: z.string().describe('Base field name without Id/Name suffix, e.g. "Category", "Supplier", "Customer". The tool creates "{baseName}Id" + "{baseName}Name".'),
      label: z.string().describe('Chinese display label, e.g. "分类", "供应商". Used as label of the visible Name field; the hidden Id field gets "{label}Id".'),
      joinTableName: z.string().describe('Name of the related table to query, e.g. "mall_category", "mall_supplier"'),
      joinIdField: z.string().optional().describe('Id field name in the related table. Default: "Id"'),
      joinNameField: z.string().optional().describe('Display name field in the related table. Default: "Name"'),
      joinWhere: z.string().optional().describe('Extra SQL WHERE clause appended to the lookup, e.g. "Status=\'Active\'". Do NOT include the leading AND.'),
      tab: z.string().optional().describe('Form tab group both fields share'),
      sort: z.number().optional().describe('Sort order applied to the visible Name field (Id field gets sort+1). Default: 100'),
      notEmpty: z.number().optional().describe('Required flag, applied to the visible Name field (1=required). Default: 0'),
      tableWidth: z.number().optional().describe('Column width in list view for the Name field. Default: 120'),
      placeholder: z.string().optional().describe('Placeholder for the Name select. Default: "请选择{label}"'),
    },
    async ({ tableId, baseName, label, joinTableName, joinIdField, joinNameField, joinWhere, tab, sort, notEmpty, tableWidth, placeholder }) => {
      try {
        const idName = `${baseName}Id`;
        const nameName = `${baseName}Name`;
        const idField = joinIdField || 'Id';
        const nameField = joinNameField || 'Name';
        const sortVal = sort ?? 100;
        const wherePart = joinWhere ? ` AND ${joinWhere}` : '';
        // 1) 隐藏 Id 字段
        const idResult = await client.addField({
          TableId: tableId, Name: idName, Label: `${label}Id`,
          Type: 'varchar(50)', Component: 'Text',
          Visible: 0, AppVisible: 0, Tab: tab,
          Sort: sortVal + 1, TableWidth: 0,
        });
        if (idResult.Code !== 1) {
          return { content: [{ type: 'text', text: `Error creating ${idName}: ${idResult.Msg}` }], isError: true };
        }
        // 2) 可见 Name 字段（Select + SQL 数据源 + V8Code 回填 Id）
        const sql = `select ${idField}, ${nameField} from ${joinTableName} where ${nameField} like '%$Keyword$%'${wherePart} limit 0,20`;
        const v8Code = `// 选中变更后将关联表的 Id 回填到隐藏字段 ${idName}\nif (V8.ThisValue && typeof V8.ThisValue === 'object') {\n  V8.Form.${idName} = V8.ThisValue.${idField} || '';\n} else if (!V8.ThisValue) {\n  V8.Form.${idName} = '';\n}`;
        const config = {
          DataSource: 'Sql',
          Sql: sql,
          SelectLabel: nameField,
          SelectSaveField: nameField,
          DataSourceSqlRemote: true,
          EnableSearch: true,
          V8Code: v8Code,
        };
        const nameResult = await client.addField({
          TableId: tableId, Name: nameName, Label: label,
          Type: 'varchar(200)', Component: 'Select',
          Visible: 1, AppVisible: 1, Tab: tab,
          Sort: sortVal, TableWidth: tableWidth ?? 120,
          NotEmpty: notEmpty ?? 0,
          Placeholder: placeholder || `请选择${label}`,
          Config: JSON.stringify(config),
        });
        if (nameResult.Code !== 1) {
          return { content: [{ type: 'text', text: `Created ${idName} but failed ${nameName}: ${nameResult.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: `✅ Join field pair created: ${idName} (hidden) + ${nameName} (Select from ${joinTableName}.${nameField}, V8Code copies ${idField} to ${idName}).` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 修复已有外键字段（补建 Name 字段并回填）
  // ========================
  server.tool(
    'microi_fix_join_field',
    `Retrofit an existing FK-only field to the proper Id+Name pair design for OsClient "${osClient}". For a table that has only "{baseName}Id" but no "{baseName}Name", this tool delegates to the helper API engine "_mcp_fix_join_field" to: (1) flip {baseName}Id field to hidden; (2) create {baseName}Name varchar(200) Select with SQL DataSource and FieldValueChange V8Code (does ALTER TABLE + diy_field insert); (3) backfill {baseName}Name from join table for existing rows. Use this to fix tables produced before microi_add_join_field was available. ⚠️ Requires the helper engine "_mcp_fix_join_field" to exist on the server (auto-installed by the MCP team).`,
    {
      tableName: z.string().describe('Physical table name to fix, e.g. "mall_product"'),
      baseName: z.string().describe('Base name of the FK, e.g. "Category" — looks for {baseName}Id and creates {baseName}Name'),
      label: z.string().describe('Chinese label for the visible Name field, e.g. "分类"'),
      joinTableName: z.string().describe('Related table to query, e.g. "mall_category"'),
      joinIdField: z.string().optional().describe('Default: "Id"'),
      joinNameField: z.string().optional().describe('Default: "Name"'),
      joinWhere: z.string().optional().describe('Extra WHERE clause for the lookup'),
      tab: z.string().optional(),
      sort: z.number().optional(),
      backfill: z.boolean().optional().describe('Backfill existing rows. Default: true.'),
      confirmExecution: z.string().optional().describe('Pass "EXECUTE" to apply changes; otherwise dry-run.'),
    },
    async ({ tableName, baseName, label, joinTableName, joinIdField, joinNameField, joinWhere, tab, sort, backfill, confirmExecution }) => {
      try {
        const dryRun = confirmExecution !== 'EXECUTE';
        const result = await client.executeEngine('_mcp_fix_join_field', {
          tableName, baseName, label, joinTableName,
          joinIdField: joinIdField || 'Id',
          joinNameField: joinNameField || 'Name',
          joinWhere: joinWhere || '',
          tab: tab || '',
          sort: sort ?? 100,
          backfill: backfill !== false,
          dryRun,
        });
        if (!result || result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result?.Msg || 'helper engine _mcp_fix_join_field call failed'}` }], isError: true };
        }
        const data = result.Data || result;
        const summary = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        return { content: [{ type: 'text', text: (dryRun ? '[DRY-RUN]\n' : '✅ ') + summary }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 修改字段（走原生 API，自动清缓存）
  // ========================
  server.tool(
    'microi_get_field_list',
    `List diy_field rows for a table on OsClient "${osClient}". Use before changing existing field Data/Config so the update targets the real FieldId and can be verified after writing.`,
    {
      tableName: z.string().optional().describe('TableName, e.g. mall_product'),
      tableId: z.string().optional().describe('TableId alternative locator'),
    },
    async ({ tableName, tableId }) => {
      try {
        if (!tableName && !tableId) {
          return { content: [{ type: 'text', text: 'Error: tableName or tableId is required.' }], isError: true };
        }
        const result = await client.getFieldList(tableName, tableId);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_update_field',
    `Update a single diy_field for OsClient "${osClient}". Calls FormEngine.UptDiyField on the backend, which automatically clears the diy_table_field_list Redis cache so the frontend immediately sees the change. Locate the field by either Id or (TableId/TableName + Name). Only fields included in the patch are updated.`,
    {
      id: z.string().optional().describe('FieldId (preferred). If absent, must provide TableId/TableName + Name.'),
      tableId: z.string().optional().describe('TableId (alternative locator). Use with name.'),
      tableName: z.string().optional().describe('TableName (alternative locator). Use with name.'),
      name: z.string().optional().describe('Field Name (FK locator with TableId/TableName).'),
      label: z.string().optional(),
      type: z.string().optional(),
      component: z.string().optional(),
      visible: z.number().optional(),
      appVisible: z.number().optional(),
      readonly: z.number().optional(),
      notEmpty: z.number().optional(),
      unique: z.number().optional(),
      sort: z.number().optional(),
      formWidth: z.number().nullable().optional(),
      tableWidth: z.number().optional(),
      placeholder: z.string().optional(),
      defaultValue: z.string().optional(),
      tab: z.string().optional(),
      data: z.string().optional(),
      config: z.string().optional(),
      description: z.string().optional(),
      inTableEdit: z.number().optional(),
    },
    async (args) => {
      try {
        const patch: Record<string, unknown> = {};
        const map: Record<string, string> = {
          id: 'Id', tableId: 'TableId', tableName: 'TableName', name: 'Name',
          label: 'Label', type: 'Type', component: 'Component',
          visible: 'Visible', appVisible: 'AppVisible', readonly: 'Readonly',
          notEmpty: 'NotEmpty', unique: 'Unique', sort: 'Sort',
          formWidth: 'FormWidth', tableWidth: 'TableWidth',
          placeholder: 'Placeholder', defaultValue: 'DefaultValue', tab: 'Tab',
          data: 'Data', config: 'Config', description: 'Description',
          inTableEdit: 'InTableEdit',
        };
        for (const [k, v] of Object.entries(args)) {
          if (v !== undefined && map[k]) patch[map[k]] = v;
        }
        const result = await client.updateField(patch);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: `✅ Field updated. ${JSON.stringify(result.Data)}` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 批量更新 diy_field（一次提交多字段，事务 + 自动清缓存）
  // ========================
  server.tool(
    'microi_update_field_list',
    `Batch update multiple diy_field records for OsClient "${osClient}" in a single transaction. Calls FormEngine.UptDiyFieldList on the backend, which automatically clears the diy_table_field_list Redis cache. Use this for bulk operations like assigning Tab values to many fields at once, batch updating Sort/Visible/Component, or any operation that would otherwise require many microi_update_field calls.`,
    {
      tableId: z.string().describe('TableId (required). The fields must belong to this table.'),
      fieldList: z.array(z.object({
        id: z.string().describe('FieldId (required).'),
        tab: z.string().optional().describe('Form tab group name.'),
        sort: z.number().optional().describe('Field display order.'),
        visible: z.number().optional().describe('Visible in PC form (1=yes, 0=no).'),
        appVisible: z.number().optional().describe('Visible in mobile app.'),
        component: z.string().optional(),
        label: z.string().optional(),
        formWidth: z.number().nullable().optional(),
        tableWidth: z.number().optional(),
        notEmpty: z.number().optional(),
        readonly: z.number().optional(),
        placeholder: z.string().optional(),
        defaultValue: z.string().optional(),
        data: z.string().optional(),
        config: z.string().optional(),
        description: z.string().optional(),
        inTableEdit: z.number().optional(),
        unique: z.number().optional(),
      })).describe('Array of field patches. Each item must include id; other fields are optional and only applied when present.'),
    },
    async (args) => {
      try {
        const fieldList = (args.fieldList || []).map((f: Record<string, unknown>) => {
          const out: Record<string, unknown> = {};
          if (f.id !== undefined) out.Id = f.id;
          if (f.tab !== undefined) out.Tab = f.tab;
          if (f.sort !== undefined) out.Sort = f.sort;
          if (f.visible !== undefined) out.Visible = f.visible;
          if (f.appVisible !== undefined) out.AppVisible = f.appVisible;
          if (f.component !== undefined) out.Component = f.component;
          if (f.label !== undefined) out.Label = f.label;
          if (f.formWidth !== undefined) out.FormWidth = f.formWidth;
          if (f.tableWidth !== undefined) out.TableWidth = f.tableWidth;
          if (f.notEmpty !== undefined) out.NotEmpty = f.notEmpty;
          if (f.readonly !== undefined) out.Readonly = f.readonly;
          if (f.placeholder !== undefined) out.Placeholder = f.placeholder;
          if (f.defaultValue !== undefined) out.DefaultValue = f.defaultValue;
          if (f.data !== undefined) out.Data = f.data;
          if (f.config !== undefined) out.Config = f.config;
          if (f.description !== undefined) out.Description = f.description;
          if (f.inTableEdit !== undefined) out.InTableEdit = f.inTableEdit;
          if (f.unique !== undefined) out.Unique = f.unique;
          return out;
        });
        const result = await client.updateFieldList({
          TableId: args.tableId,
          FieldList: fieldList,
        });
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: `✅ ${fieldList.length} fields updated. ${JSON.stringify(result.Data)}` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 修改 diy_table 属性（如表单列数 Column）
  // ========================
  server.tool(
    'microi_update_table',
    `Update a diy_table record for OsClient "${osClient}" (e.g. set Column=2 for a two-column form layout, change Description, IsTree, etc). Automatically clears diy_table + diy_table_field_list Redis caches.`,
    {
      id: z.string().optional().describe('TableId (preferred locator)'),
      name: z.string().optional().describe('Table Name (alternative locator)'),
      column: z.number().optional().describe('Form columns: 1, 2 or 3'),
      description: z.string().optional(),
      isTree: z.number().optional(),
      tabs: z.string().optional(),
      formOpenType: z.string().optional(),
      formOpenWidth: z.string().optional(),
    },
    async (args) => {
      try {
        const patch: Record<string, unknown> = {};
        if (args.id) patch.Id = args.id;
        if (args.name) patch.Name = args.name;
        if (args.column !== undefined) patch.Column = args.column;
        if (args.description !== undefined) patch.Description = args.description;
        if (args.isTree !== undefined) patch.IsTree = args.isTree;
        if (args.tabs !== undefined) patch.Tabs = args.tabs;
        if (args.formOpenType !== undefined) patch.FormOpenType = args.formOpenType;
        if (args.formOpenWidth !== undefined) patch.FormOpenWidth = args.formOpenWidth;
        const result = await client.updateTable(patch);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: `✅ Table updated. ${JSON.stringify(result.Data)}` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 手动刷新表结构 Redis 缓存
  // ========================
  server.tool(
    'microi_refresh_schema_cache',
    `Manually invalidate Redis caches for diy_table / diy_field / diy_table_field_list for the given tables (OsClient "${osClient}"). Useful after bulk DB changes or when caches go stale.`,
    {
      tables: z.array(z.string()).describe('Array of table names or TableIds. All cache key variants for each will be cleared.'),
    },
    async ({ tables }) => {
      try {
        const result = await client.refreshSchemaCache(tables);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: `✅ Cache refreshed. ${JSON.stringify(result.Data)}` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 批量设置接口引擎是否允许匿名
  // ========================
  server.tool(
    'microi_set_engine_anonymous',
    `Batch set sys_apiengine.AllowAnonymous for one or more API engines (OsClient "${osClient}"). Use 1 for login/register/public endpoints that need to be callable without a token; use 0 to require login. The backend also keeps the engine HTTP-callable (IsEnable=1, StopHttp=0) and refreshes the corresponding sys_apiengine dynamic route cache entries from the latest DB row.`,
    {
      apiEngineKeys: z.array(z.string()).describe('Array of ApiEngineKey strings'),
      allowAnonymous: z.number().optional().describe('1 = allow anonymous (default), 0 = require login'),
    },
    async ({ apiEngineKeys, allowAnonymous }) => {
      try {
        const result = await client.setEngineAnonymous(apiEngineKeys, allowAnonymous ?? 1);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: `✅ ${JSON.stringify(result.Data, null, 2)}` }] };
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
    `Create a menu module for OsClient "${osClient}". Inserts a record into sys_menu table (NOT sys_module, NOT Sys_Module). Links a diy_table to the navigation sidebar. IDEMPOTENT — calling again with the same Name+ParentId returns Skipped:true with the existing ModuleId. URL collisions are auto-resolved with random suffixes (concurrency-safe). Step 4 of system design. ⚠️ For business systems, also pass moreBtns/formBtns/pageTabs/batchSelectMoreBtns JSON to wire up business buttons in one call — see skill doc microi.skills/v8-menu-buttons.`,
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
      searchFieldIds: z.string().optional().describe('SearchFieldIds JSON/object-array string. If omitted and diyTableId is bound, backend infers common searchable fields such as title/name/no/status/type/category/person/time.'),
      tableDiyFieldIds: z.string().optional().describe('Comma-separated field Ids to show as table columns (e.g. "fieldId1,fieldId2,fieldId3"). Controls which fields appear in the list view.'),
      defaultOrderBy: z.string().optional().describe('Default sort expression (e.g. "CreateTime DESC", "Sort ASC")'),
      sqlWhere: z.string().optional().describe('Fixed SQL WHERE clause for data filtering (e.g. "Status=1", "IsDeleted=0")'),
      enableViewSchema: z.number().optional().describe('Enable the versioned cross-client ViewSchema (1=yes, 0=no). Default: 0.'),
      viewSchemaVersion: z.string().optional().describe('ViewSchema protocol version stored in sys_menu.ViewSchemaVersion. Default: "1.0".'),
      viewConfigVersion: z.number().optional().describe('Monotonic configuration version stored in sys_menu.ViewConfigVersion. Default: 1.'),
      viewSchema: z.string().optional().describe('Versioned cross-client view JSON stored in the physical sys_menu.ViewSchema column. Supports Detail/Edit/List/Card views and PC/Mobile/All device scopes.'),
      moreBtns: z.string().optional().describe('Row action buttons JSON ARRAY (string). Each item: {Id,Sort,Name,Icon,BtnStyle,IsVisible,ShowRow:true,V8CodeShow,V8Code,RunBackground,BackgroundTask,IsBackgroundTask,ApiEngineKey}. V8Code typically calls V8.ApiEngine.Run(...). Long tasks such as install/import/init should set RunBackground=true and ApiEngineKey so the frontend starts a background task. Example: \'[{"Id":"01K...","Name":"指派","BtnStyle":"primary","IsVisible":true,"ShowRow":true,"V8CodeShow":"V8.Result=V8.Form.Status==\\"待指派\\";","V8Code":"V8.OpenAnyForm({TableName:\\"Diy_X\\",Id:V8.Form.Id,FormMode:\\"Edit\\",SelectFields:[\\"AssigneeId\\"],EventReplace:{Submit:async function(v8,p,cb){var r=await V8.ApiEngine.Run({ApiEngineKey:\\"x_assign\\",Id:v8.Form.Id,AssigneeId:v8.Form.AssigneeId});cb(r);V8.RefreshTable({_PageIndex:1});}}});"}]\''),
      formBtns: z.string().optional().describe('Form bottom buttons JSON ARRAY (string). Same item shape as moreBtns but ShowRow not required.'),
      batchSelectMoreBtns: z.string().optional().describe('Batch action buttons (after selecting multiple rows) JSON ARRAY (string). Same item shape as moreBtns. Use V8.TableRowSelected to access selected rows.'),
      pageTabs: z.string().optional().describe('Page top tabs JSON ARRAY (string). Each item: {Id,Sort,Name,Icon,V8Code,V8CodeShow,TargetSysMenuId}. TargetSysMenuId associates another module; clicking it replaces the current route and reloads that module. V8Code typically calls V8.SearchSet({field:value}) for tabs within the current module.'),
      exportMoreBtns: z.string().optional().describe('Export menu extra buttons JSON ARRAY (string).'),
      pageBtns: z.string().optional().describe('Page-level top buttons JSON ARRAY (string).'),
      sortFieldIds: z.string().optional().describe('Comma-separated field Ids that user can sort by. JSON array string also accepted.'),
      notShowFields: z.string().optional().describe('JSON array string of field Ids hidden from the list. If omitted and diyTableId is bound, backend hides Id-like fields, foreign keys, system fields, layout controls and heavy fields such as upload/rich text/map/child table.'),
      sqlJoin: z.string().optional().describe('Custom SQL JOIN clause for the list query (e.g. "LEFT JOIN Diy_Customer C ON A.CustomerId=C.Id"). Use aliases A=main table, B/C/D=joined tables.'),
      joinTables: z.string().optional().describe('JSON array of joined tables for select fields cross-table: [{Id,AsName:"B",Name:"Diy_Xxx",Description:"xxx",IsVisible:true}]'),
      selectFields: z.string().optional().describe('JSON array of selectable fields (cross-table) for the list view.'),
      statisticsFields: z.string().optional().describe('JSON array of fields to show as table footer statistics (e.g. [{Id,Type:"Sum"}], Type=Sum|Avg|Max|Min|Count). If omitted and diyTableId is bound, backend infers amount/price/count/point/balance numeric fields.'),
      inTableEdit: z.number().optional().describe('Enable inline edit in list view (1=yes,0=no). Default: 0'),
      inTableEditFields: z.string().optional().describe('JSON array string of field Ids that allow inline edit (when inTableEdit=1).'),
      mobileListFields: z.string().optional().describe('JSON array of fields shown in mobile/card list. If omitted and diyTableId is bound, backend picks compact title/status/summary fields.'),
      cardTitleTagFields: z.string().optional().describe('JSON array of fields shown as title tags on mobile/card view.'),
      cardBottomTagFields: z.string().optional().describe('JSON array of fields shown as bottom tags on mobile/card view.'),
    },
    async ({ name, diyTableId, parentId, componentName, componentPath, display, appDisplay, openType, url, sort,
      icon, searchFieldIds, tableDiyFieldIds, defaultOrderBy, sqlWhere,
      enableViewSchema, viewSchemaVersion, viewConfigVersion, viewSchema,
      moreBtns, formBtns, batchSelectMoreBtns, pageTabs, exportMoreBtns, pageBtns,
      sortFieldIds, notShowFields, sqlJoin, joinTables, selectFields, statisticsFields,
      inTableEdit, inTableEditFields, mobileListFields, cardTitleTagFields, cardBottomTagFields }) => {
      try {
        const normalizedViewSchema = normalizeViewSchemaJson(viewSchema);
        if (!normalizedViewSchema.ok) {
          return {
            content: [{ type: 'text', text: `Error: ${normalizedViewSchema.errors.join('\n')}` }],
            isError: true,
          };
        }
        const result = await client.createModule({
          Name: name, DiyTableId: diyTableId, ParentId: parentId,
          ComponentName: componentName, ComponentPath: componentPath,
          Display: display ?? 1, AppDisplay: appDisplay ?? 1,
          OpenType: openType, Url: url, Sort: sort,
          Icon: icon, SearchFieldIds: searchFieldIds, TableDiyFieldIds: tableDiyFieldIds,
          DefaultOrderBy: defaultOrderBy, SqlWhere: sqlWhere,
          EnableViewSchema: enableViewSchema ?? 0,
          ViewSchemaVersion: viewSchemaVersion ?? '1.0',
          ViewConfigVersion: viewConfigVersion ?? 1,
          ViewSchema: normalizedViewSchema.value,
          MoreBtns: moreBtns, FormBtns: formBtns, BatchSelectMoreBtns: batchSelectMoreBtns,
          PageTabs: pageTabs, ExportMoreBtns: exportMoreBtns, PageBtns: pageBtns,
          SortFieldIds: sortFieldIds, NotShowFields: notShowFields,
          SqlJoin: sqlJoin, JoinTables: joinTables, SelectFields: selectFields,
          StatisticsFields: statisticsFields,
          InTableEdit: inTableEdit, InTableEditFields: inTableEditFields,
          MobileListFields: mobileListFields,
          CardTitleTagFields: cardTitleTagFields, CardBottomTagFields: cardBottomTagFields,
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        const data = result.Data as { ModuleId?: string; Message?: string; Url?: string };
        return { content: [{ type: 'text', text: `✅ Module "${name}" created.\n- ModuleId: ${data?.ModuleId}\n- Url: ${data?.Url || '(auto-generated)'}\n- Use this ModuleId when setting permissions via microi_set_role_permission` }] };
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
    `Create or update a page engine page for OsClient "${osClient}". Accepts raw JsonObj, {JsonObj}, {JsonStr}, a mic_page row, or {formData:{JsonObj}} and normalizes it to the canonical JsonObj saved in mic_page.JsonObj. Pass pageId to update an existing page, or omit to create a new one.`,
    {
      pageId: z.string().optional().describe('Page Id to update. Omit to create a new page.'),
      title: z.string().describe('Page title (e.g. "销售仪表盘", "数据概览")'),
      number: z.string().optional().describe('Page number/code (auto-generated if omitted)'),
      desc: z.string().optional().describe('Page description'),
      jsonStr: z.string().optional().describe('Page Engine JsonObj string. Prefer json for object input.'),
      json: z.unknown().optional().describe('Page Engine JSON object/string in any common AI output shape.'),
      routePath: z.string().optional().describe('Optional route path saved to mic_page.RoutePath.'),
      componentPath: z.string().optional().describe('Optional component path saved to mic_page.ComponentPath.'),
    },
    async ({ pageId, title, number, desc, jsonStr, json, routePath, componentPath }) => {
      try {
        const normalized = normalizePageJsonObj(json ?? jsonStr);
        if (!normalized.ok || !normalized.json) {
          return { content: [{ type: 'text', text: JSON.stringify(normalized, null, 2) }], isError: true };
        }
        const result = await client.savePageEngine({
          PageId: pageId, Title: title, Number: number,
          Desc: desc, JsonStr: normalized.json,
          RoutePath: routePath, ComponentPath: componentPath,
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

  // ========================
  // Tool: 查询全部在线应用与文件清单
  // ========================
  server.tool(
    'microi_list_applications',
    `List every online AI application for OsClient "${osClient}" across Web, UniApp and MicroService, including each app's complete source-file manifest by default. AI agents should call this at the beginning of application/page work so they understand existing apps before creating duplicates. For complex custom dialogs/pages, prefer extending an existing MicroService or creating one with microi_create_microservice + microi_sync_microservice_source; do not embed large HTML in V8.ConfirmTips.`,
    {
      appType: z.enum(['Web', 'UniApp', 'MicroService']).optional().describe('Optional exact application type filter.'),
      keyword: z.string().optional().describe('Optional case-insensitive search across name, AppKey, type and description.'),
      includeFiles: z.boolean().optional().default(true).describe('Include the complete file manifest for every app. Defaults to true.'),
    },
    async ({ appType, keyword, includeFiles }) => {
      try {
        const result = await client.listApplications({ AppType: appType, Keyword: keyword, IncludeFiles: includeFiles !== false });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 获取应用完整源码上下文
  // ========================
  server.tool(
    'microi_get_application_context',
    `Get one Web, UniApp or MicroService application by Id/AppKey for OsClient "${osClient}", with its full file manifest and all readable source-code contents by default. MicroService responses also include sys_microiservice runtime/pages. Use this after microi_list_applications before editing an existing app.`,
    {
      appIdOrKey: z.string().describe('sys_microistore.Id or AppKey.'),
      includeContents: z.boolean().optional().default(true).describe('Read private HDFS source contents. Defaults to true.'),
      maxFileBytes: z.number().int().positive().optional().describe('Maximum bytes read per source file. Default 2MB.'),
      maxTotalBytes: z.number().int().positive().optional().describe('Maximum total bytes read for this app. Default 50MB.'),
    },
    async ({ appIdOrKey, includeContents, maxFileBytes, maxTotalBytes }) => {
      try {
        const result = await client.getApplicationContext({
          AppIdOrKey: appIdOrKey,
          IncludeContents: includeContents !== false,
          ...(maxFileBytes ? { MaxFileBytes: maxFileBytes } : {}),
          ...(maxTotalBytes ? { MaxTotalBytes: maxTotalBytes } : {}),
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 获取单个应用文件
  // ========================
  server.tool(
    'microi_get_application_file',
    `Read one exact source file from a Web, UniApp or MicroService online AI application for OsClient "${osClient}". Text code is returned as UTF-8 Content; binary files are returned as FileByteBase64.`,
    {
      appIdOrKey: z.string().describe('sys_microistore.Id or AppKey.'),
      filePath: z.string().describe('Exact relative source path from the application file manifest.'),
      maxFileBytes: z.number().int().positive().optional().describe('Maximum bytes read. Default 10MB.'),
    },
    async ({ appIdOrKey, filePath, maxFileBytes }) => {
      try {
        const result = await client.getApplicationFile({
          AppIdOrKey: appIdOrKey,
          FilePath: filePath,
          IncludeContents: true,
          ...(maxFileBytes ? { MaxFileBytes: maxFileBytes } : {}),
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 查询微服务 / 微应用
  // ========================
  server.tool(
    'microi_get_microservice',
    `Get one Microi microservice / micro-app by MsKey for OsClient "${osClient}". Use this before publishing to inspect current BuildVersion, EntryPath and asset manifest.`,
    {
      msKey: z.string().describe('Microservice key, stored in sys_microiservice.MsKey'),
    },
    async ({ msKey }) => {
      try {
        const result = await client.getMicroService(msKey);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 创建微服务 / 微应用元数据
  // ========================
  server.tool(
    'microi_create_microservice',
    `Create or update sys_microiservice metadata for OsClient "${osClient}". This only writes metadata. For generated app source/dist files, use microi_publish_microservice.`,
    {
      microService: jsonRecordSchema.describe('Microservice metadata. Required: MsKey and MsName/Name. Optional: MsType, Runtime, StorageMode, SourceDirName, EntryPath, BuildVersion.'),
      confirmExecution: z.string().optional().describe('Required for real writes. Pass any non-empty confirmation string after reviewing the payload.'),
    },
    async ({ microService, confirmExecution }) => {
      if (!confirmExecution) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ dryRun: true, microService }, null, 2) }],
        };
      }
      try {
        const result = await client.createMicroService(microService);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 同步微服务源码到在线 AI 应用
  // ========================
  server.tool(
    'microi_sync_microservice_source',
    `Sync local microservice source files into the online AI Application for OsClient "${osClient}". The app is created/upserted as AppType=MicroService; source files are private and remain separate from published assets.`,
    {
      microService: jsonRecordSchema.describe('Microservice metadata. Required: MsKey and MsName/Name. Optional: Description and SourceDirName.'),
      sourceFiles: z.array(jsonRecordSchema).describe('Source files. Each item needs Path/FilePath and FileByteBase64/ContentBase64. Optional: Size and Sha256.'),
      replace: z.boolean().optional().describe('When true, remove stale online source metadata not present in this manifest.'),
      confirmExecution: z.string().optional().describe('Required for real writes. Pass any non-empty confirmation string after reviewing the payload.'),
    },
    async ({ microService, sourceFiles, replace, confirmExecution }) => {
      if (!confirmExecution) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ dryRun: true, microService, sourceFileCount: sourceFiles.length, replace: replace === true }, null, 2) }],
        };
      }
      try {
        const result = await client.syncMicroServiceSource({ microService, sourceFiles, Replace: replace === true });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 发布微服务 / 微应用文件资产
  // ========================
  server.tool(
    'microi_publish_microservice',
    `Publish generated microservice / micro-app files for OsClient "${osClient}". Uploads assets to Microi HDFS, upserts sys_microiservice and syncs sys_microiservice_page routes.`,
    {
      microService: jsonRecordSchema.describe('Microservice metadata. Required: MsKey and MsName/Name. Optional: BuildVersion, EntryPath, SourceDirName.'),
      assets: z.array(jsonRecordSchema).describe('Built asset files. Each item needs Path/RelativePath/FileName and FileByteBase64/ContentBase64. Mark the main HTML/JS entry with IsEntry=true or Entry=true.'),
      routes: z.array(jsonRecordSchema).optional().describe('Optional route/page records for sys_microiservice_page. Fields: PageKey, PageName, PageTitle, RoutePath, EntryPath, Sort, IsHome.'),
      confirmExecution: z.string().optional().describe('Required for real writes. Pass any non-empty confirmation string after reviewing the payload.'),
    },
    async ({ microService, assets, routes, confirmExecution }) => {
      if (!confirmExecution) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ dryRun: true, microService, assetCount: assets.length, routes: routes || [] }, null, 2) }],
        };
      }
      try {
        const result = await client.publishMicroService({ microService, assets, routes: routes || [] });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  registerDesignTools(server, client, context);
  registerAdvancedTools(server, client, context);
  registerBlueprintTools(server, client, context);

  toolRegistry.flush(context.codexMode ? ['microi_codex'] : undefined);
  return server;
}
