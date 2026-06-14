import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MicroiClient, DbTable, DbField, PlaywrightContextData, PlaywrightEngineInfo, PlaywrightModuleInfo } from './microi-client.js';
import { registerAdvancedTools } from './advanced-tools.js';
import { registerBlueprintTools } from './blueprint-tools.js';
import { registerDesignTools } from './design-tools.js';
import { normalizePageJsonObj } from './design-engine.js';

/** MCP Server 上下文（用于区分不同租户） */
export interface McpServerContext {
  osClient: string;
  apiBaseUrl: string;
  /** 服务器显示名称（SysTitle），与 mcp.json 中的 key 一致 */
  label: string;
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

function withMicroiServerPrefix(value: string): string {
  const name = String(value || '').trim();
  if (!name) return '';
  return /^microi[-_]/i.test(name) ? name : `Microi-${name}`;
}

function buildRuntimeServerName(context: McpServerContext): string {
  let hostPart = '';
  try {
    hostPart = sanitizeServerNamePart(new URL(context.apiBaseUrl).host);
  } catch {
    hostPart = sanitizeServerNamePart(context.apiBaseUrl || '');
  }
  const titlePart = (context.label || '').trim();
  if (titlePart) return withMicroiServerPrefix(titlePart);

  const basePart = sanitizeServerNamePart(context.osClient || '')
    || hostPart
    || 'default';
  return `Microi-${basePart}`;
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

IMPORTANT: This server ONLY manages tenant "${ctx.label || ctx.osClient}". When the user specifies a different tenant name, do NOT use this server.
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
  "V8Code": "V8.ApiEngine.Run({ApiEngineKey:'order_assign', Id:V8.Form.Id}, function(r){V8.RefreshTable({_PageIndex:1});});"  // 点击执行JS
}
\`\`\`
按钮的 V8Code **强烈建议** 调用接口引擎（V8.ApiEngine.Run）执行后端逻辑，前端只负责弹窗、刷新、提示。
详细写法参考 skill 文档：\`microi.skills/v8-menu-buttons/SKILL.md\`

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

  // 服务器名称与 mcp.json key 保持一致：统一使用 Microi- 前缀，如 Microi-乐闪购。
  const serverName = buildRuntimeServerName(context);

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
        const code = getStringField(engine, 'ApiV8Code', 'Code', 'V8Code');
        const lines = [
          `## API Engine: ${engine?.ApiEngineKey || apiEngineKey}`,
          engine?.ApiName ? `- **Name**: ${engine.ApiName}` : '',
          engine?.Category ? `- **Category**: ${engine.Category}` : '',
          engine?.ApiAddress ? `- **Address**: ${engine.ApiAddress}` : '',
          engine?.ApiRemark ? `- **Remark**: ${engine.ApiRemark}` : '',
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
    `Save (update) API engine JavaScript code on Microi server (OsClient: ${osClient}). Increments semantic Version (v1.0.0 -> v1.0.1, patch/minor max 9), writes a header with function description only, syncs sys_apiengine.Version/ChangeHistory when those fields exist, and preserves AllowAnonymous, StopHttp, IsEnable, ApiAddress and other HTTP/security metadata.`,
    {
      apiEngineKey: z.string().describe('The unique key of the API engine'),
      code: z.string().describe('The complete JavaScript source code to save'),
      functionDescription: z.string().optional().describe('Complete function description to keep in the code header. No change history here.'),
      changeSummary: z.string().optional().describe('One-line change summary stored in sys_apiengine.ChangeHistory when the field exists.'),
    },
    async ({ apiEngineKey, code, functionDescription, changeSummary }) => {
      try {
        const result = await client.saveEngineCode(apiEngineKey, code, { functionDescription, changeSummary });
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
        return { content: [{ type: 'text', text: `✅ Engine "${apiEngineKey}" created successfully.` }] };
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
      limit: z.boolean().optional().describe('Whether to upload to a private path. Default false.'),
      preview: z.boolean().optional().describe('Whether to let the platform generate preview/compressed output. Default true.'),
      targetTable: z.string().optional().describe('Optional table name to update after upload.'),
      targetId: z.string().optional().describe('Optional row Id to update after upload.'),
      targetField: z.string().optional().describe('Optional field name that stores the uploaded file path.'),
    },
    async ({ fileByteBase64, fileName, path, limit, preview, targetTable, targetId, targetField }) => {
      try {
        const result = await client.uploadFileBase64({
          FileName: fileName,
          FileByteBase64: fileByteBase64,
          Path: path,
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
    `Save (update) V8 event code on Microi server (OsClient: ${osClient}). Increments semantic Version in the code header and keeps only the complete function description in code; change history is not written into event source code.`,
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
        return { content: [{ type: 'text', text: `✅ Event "${formEngineKey}/${eventType}" code saved successfully.` }] };
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
      diyConfig: z.string().optional().describe('Advanced module config JSON string'),
      moreBtns: z.string().optional().describe('Row action buttons JSON ARRAY (string). Each item: {Id,Sort,Name,Icon,BtnStyle,IsVisible,ShowRow:true,V8CodeShow,V8Code}. V8Code typically calls V8.ApiEngine.Run(...). Example: \'[{"Id":"01K...","Name":"指派","BtnStyle":"primary","IsVisible":true,"ShowRow":true,"V8CodeShow":"V8.Result=V8.Form.Status==\\"待指派\\";","V8Code":"V8.OpenAnyForm({TableName:\\"Diy_X\\",Id:V8.Form.Id,FormMode:\\"Edit\\",SelectFields:[\\"AssigneeId\\"],EventReplace:{Submit:async function(v8,p,cb){var r=await V8.ApiEngine.Run({ApiEngineKey:\\"x_assign\\",Id:v8.Form.Id,AssigneeId:v8.Form.AssigneeId});cb(r);V8.RefreshTable({_PageIndex:1});}}});"}]\''),
      formBtns: z.string().optional().describe('Form bottom buttons JSON ARRAY (string). Same item shape as moreBtns but ShowRow not required.'),
      batchSelectMoreBtns: z.string().optional().describe('Batch action buttons (after selecting multiple rows) JSON ARRAY (string). Same item shape as moreBtns. Use V8.TableRowSelected to access selected rows.'),
      pageTabs: z.string().optional().describe('Page top tabs JSON ARRAY (string). Each item: {Id,Sort,Name,Icon,V8Code,V8CodeShow}. V8Code typically calls V8.SearchSet({field:value}) to filter. V8CodeShow controls visibility per V8.ClientType.'),
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
      icon, searchFieldIds, tableDiyFieldIds, defaultOrderBy, sqlWhere, diyConfig,
      moreBtns, formBtns, batchSelectMoreBtns, pageTabs, exportMoreBtns, pageBtns,
      sortFieldIds, notShowFields, sqlJoin, joinTables, selectFields, statisticsFields,
      inTableEdit, inTableEditFields, mobileListFields, cardTitleTagFields, cardBottomTagFields }) => {
      try {
        const result = await client.createModule({
          Name: name, DiyTableId: diyTableId, ParentId: parentId,
          ComponentName: componentName, ComponentPath: componentPath,
          Display: display ?? 1, AppDisplay: appDisplay ?? 1,
          OpenType: openType, Url: url, Sort: sort,
          Icon: icon, SearchFieldIds: searchFieldIds, TableDiyFieldIds: tableDiyFieldIds,
          DefaultOrderBy: defaultOrderBy, SqlWhere: sqlWhere, DiyConfig: diyConfig,
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

  registerDesignTools(server, client, context);
  registerAdvancedTools(server, client, context);
  registerBlueprintTools(server, client, context);

  return server;
}
