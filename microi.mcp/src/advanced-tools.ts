import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MicroiClient, ApiResponse } from './microi-client.js';
import type { McpServerContext } from './server.js';

type JsonRecord = Record<string, unknown>;
type ToolContent = { type: 'text'; text: string };
type ToolResult = { content: ToolContent[]; isError?: boolean };

const jsonRecordSchema = z.record(z.unknown());

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text }], isError };
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item) => Object.keys(item).length > 0) : [];
}

function getArray(record: JsonRecord, ...keys: string[]): JsonRecord[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return asArray(value);
  }
  return [];
}

function getString(record: JsonRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return '';
}

function getNumber(record: JsonRecord, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return undefined;
}

function getStringArray(record: JsonRecord, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.map((item) => typeof item === 'string' ? item : getString(asRecord(item), 'name', 'Name', 'id', 'Id')).filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) return value.split(/[,，;；]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function compactObject(record: JsonRecord): JsonRecord {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

function randomId(): string {
  const now = Date.now().toString(36).toUpperCase().padStart(10, '0');
  const random = Math.random().toString(36).slice(2, 18).toUpperCase().padEnd(16, '0');
  return `${now}${random}`.slice(0, 26);
}

function unwrapList(data: unknown): JsonRecord[] {
  if (Array.isArray(data)) return asArray(data);
  const record = asRecord(data);
  if (Array.isArray(record.List)) return asArray(record.List);
  if (Array.isArray(record.Data)) return asArray(record.Data);
  return [];
}

function apiText(title: string, response: ApiResponse): ToolResult {
  const lines = [
    `## ${title}`,
    `- Code: ${response.Code}`,
    response.Msg ? `- Message: ${response.Msg}` : '',
    '',
    '```json',
    JSON.stringify(response.Data ?? {}, null, 2),
    '```',
  ].filter(Boolean);
  return textResult(lines.join('\n'), response.Code !== 1);
}

function parseJsonInput(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string') return value ?? fallback;
  if (!value.trim()) return fallback;
  try { return JSON.parse(value); } catch { return value; }
}

function stringifyConfig(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function normalizeMenuJsonArray(fieldName: string, raw?: unknown): { ok: boolean; value?: string; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: undefined, errors, warnings };

  let arr: unknown;
  try {
    arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (error) {
    return { ok: false, errors: [`${fieldName} 不是合法 JSON 数组：${error instanceof Error ? error.message : String(error)}`], warnings };
  }
  if (!Array.isArray(arr)) return { ok: false, errors: [`${fieldName} 必须是 JSON 数组`], warnings };

  const ids = new Set<string>();
  const normalized = arr.map((item, index) => {
    const button = asRecord(item);
    const name = getString(button, 'Name', 'name');
    if (!name) errors.push(`${fieldName}[${index}].Name 不能为空`);
    if (!getString(button, 'V8Code', 'v8Code') && !getString(button, 'Url', 'url')) {
      errors.push(`${fieldName}[${index}] 必须配置 V8Code 或 Url`);
    }

    const id = getString(button, 'Id', 'id') || randomId();
    if (!getString(button, 'Id', 'id')) warnings.push(`${fieldName}[${index}] 未传 Id，已自动生成 ${id}`);
    if (ids.has(id)) errors.push(`${fieldName} 中存在重复 Id：${id}`);
    ids.add(id);

    const codeShow = getString(button, 'V8CodeShow', 'v8CodeShow');
    if (codeShow && !codeShow.includes('V8.Result')) {
      warnings.push(`${fieldName}[${index}].V8CodeShow 建议显式赋值 V8.Result=true/false`);
    }

    return compactObject({
      ...button,
      Id: id,
      Sort: getNumber(button, 'Sort', 'sort') ?? index * 10,
      Name: name,
      Icon: getString(button, 'Icon', 'icon') || undefined,
      BtnStyle: getString(button, 'BtnStyle', 'btnStyle') || undefined,
      IsVisible: button.IsVisible ?? button.isVisible ?? true,
      ShowRow: fieldName === 'MoreBtns' ? (button.ShowRow ?? button.showRow ?? true) : (button.ShowRow ?? button.showRow),
      V8CodeShow: codeShow || undefined,
      V8Code: getString(button, 'V8Code', 'v8Code') || undefined,
      Url: getString(button, 'Url', 'url') || undefined,
    });
  });

  return { ok: errors.length === 0, value: JSON.stringify(normalized), errors, warnings };
}

function normalizeAllMenuJson(data: JsonRecord): { data: JsonRecord; errors: string[]; warnings: string[] } {
  const result = { ...data };
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldMap: Record<string, string[]> = {
    MoreBtns: ['MoreBtns', 'moreBtns'],
    FormBtns: ['FormBtns', 'formBtns'],
    BatchSelectMoreBtns: ['BatchSelectMoreBtns', 'batchSelectMoreBtns'],
    PageTabs: ['PageTabs', 'pageTabs'],
    ExportMoreBtns: ['ExportMoreBtns', 'exportMoreBtns'],
    PageBtns: ['PageBtns', 'pageBtns'],
  };
  for (const [canonical, keys] of Object.entries(fieldMap)) {
    const key = keys.find((candidate) => data[candidate] !== undefined);
    if (!key) continue;
    const normalized = normalizeMenuJsonArray(canonical, data[key]);
    errors.push(...normalized.errors);
    warnings.push(...normalized.warnings);
    if (normalized.ok && normalized.value !== undefined) result[canonical] = normalized.value;
  }
  return { data: result, errors, warnings };
}

function buildFieldConfig(sourceType: string, options: JsonRecord): { data?: string; config: JsonRecord; warnings: string[] } {
  const warnings: string[] = [];
  const type = sourceType.toLowerCase();
  if (type === 'keyvalue') {
    const raw = getString(options, 'data', 'options');
    const rows = raw
      ? raw.split(/[,，;；\n]/).map((item) => item.trim()).filter(Boolean).map((item) => {
        const [key, label] = item.split('|');
        return { Key: (key || '').trim(), Value: (label || key || '').trim() };
      })
      : asArray(options.items).map((item) => ({ Key: getString(item, 'Key', 'key'), Value: getString(item, 'Value', 'label', 'name') }));
    return {
      data: JSON.stringify(rows),
      config: { DataSource: 'KeyValue', SelectLabel: 'Value', SelectSaveField: 'Key', SelectSaveFormat: 'Text', EnableSearch: false, DataSourceSqlRemote: false },
      warnings,
    };
  }
  if (type === 'data') {
    const raw = getString(options, 'data', 'options');
    const rows = raw ? raw.split(/[,，;；\n]/).map((item) => item.trim()).filter(Boolean) : (Array.isArray(options.items) ? options.items : []);
    return { data: JSON.stringify(rows), config: { DataSource: 'Data', SelectSaveFormat: 'Text', EnableSearch: false, DataSourceSqlRemote: false }, warnings };
  }
  if (type === 'sql') {
    const sql = getString(options, 'sql', 'Sql');
    if (!sql) warnings.push('SQL 数据源缺少 sql');
    return {
      config: {
        DataSource: 'Sql', Sql: sql, SelectLabel: getString(options, 'selectLabel', 'SelectLabel') || 'Name',
        SelectSaveField: getString(options, 'selectSaveField', 'SelectSaveField') || 'Id',
        DataSourceSqlRemote: options.dataSourceSqlRemote ?? options.DataSourceSqlRemote ?? true,
        EnableSearch: options.enableSearch ?? options.EnableSearch ?? true,
      },
      warnings,
    };
  }
  if (type === 'apiengine') {
    const apiEngineKey = getString(options, 'apiEngineKey', 'DataSourceApiEngineKey');
    if (!apiEngineKey) warnings.push('接口引擎数据源缺少 apiEngineKey');
    return { config: { DataSource: 'ApiEngine', DataSourceApiEngineKey: apiEngineKey, SelectLabel: getString(options, 'selectLabel') || 'name', SelectSaveField: getString(options, 'selectSaveField') || 'id' }, warnings };
  }
  if (type === 'datasource') {
    const dataSourceId = getString(options, 'dataSourceId', 'DataSourceId');
    if (!dataSourceId) warnings.push('数据源引擎配置缺少 dataSourceId');
    return { config: { DataSource: 'DataSource', DataSourceId: dataSourceId, SelectLabel: getString(options, 'selectLabel') || 'Name', SelectSaveField: getString(options, 'selectSaveField') || 'Id' }, warnings };
  }
  if (type === 'autonumber') {
    return { config: { AutoNumberFixed: getString(options, 'prefix', 'AutoNumberFixed'), AutoNumberLength: getNumber(options, 'length', 'AutoNumberLength') ?? 4 }, warnings };
  }
  if (type === 'datetime') {
    return { config: { DateTimeType: getString(options, 'dateTimeType', 'DateTimeType') || 'datetime' }, warnings };
  }
  if (type === 'joinform') {
    return { config: { JoinForm: { TableId: getString(options, 'tableId'), TableName: getString(options, 'tableName'), JoinFieldName: getString(options, 'joinFieldName') || 'Name' } }, warnings };
  }
  warnings.push(`未知 sourceType: ${sourceType}，已返回空配置`);
  return { config: {}, warnings };
}

function buildPlan(manifest: JsonRecord): { plan: string[]; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const plan: string[] = [];
  const roles = getArray(manifest, 'roles', 'Roles');
  const tables = getArray(manifest, 'tables', 'Tables');
  const engines = getArray(manifest, 'engines', 'Engines');
  const modules = getArray(manifest, 'modules', 'Modules');
  const events = getArray(manifest, 'events', 'Events');
  const dataSources = getArray(manifest, 'dataSources', 'DataSources');
  const pages = getArray(manifest, 'pages', 'Pages');
  const printTemplates = getArray(manifest, 'printTemplates', 'PrintTemplates');
  const workflows = getArray(manifest, 'workflows', 'Workflows');
  const jobs = getArray(manifest, 'jobs', 'Jobs');
  const permissions = getArray(manifest, 'permissions', 'Permissions');

  if (!tables.length && !engines.length && !modules.length && !pages.length) {
    warnings.push('Manifest 未声明 tables/engines/modules/pages，可能不是完整系统计划');
  }

  roles.forEach((item) => plan.push(`save_role ${getString(item, 'name', 'Name')}`));
  tables.forEach((table, tableIndex) => {
    const name = getString(table, 'name', 'Name');
    if (!name) errors.push(`tables[${tableIndex}].name 不能为空`);
    plan.push(`create_table ${name || `(index ${tableIndex})`}`);
    getArray(table, 'fields', 'Fields').forEach((field, fieldIndex) => {
      const fieldName = getString(field, 'name', 'Name');
      const label = getString(field, 'label', 'Label');
      if (!fieldName) errors.push(`tables[${tableIndex}].fields[${fieldIndex}].name 不能为空`);
      if (!label) errors.push(`tables[${tableIndex}].fields[${fieldIndex}].label 不能为空`);
      plan.push(`add_field ${name}.${fieldName}`);
    });
  });
  dataSources.forEach((item) => plan.push(`save_data_source ${getString(item, 'dataSourceKey', 'DataSourceKey')}`));
  engines.forEach((item) => plan.push(`upsert_engine ${getString(item, 'apiEngineKey', 'ApiEngineKey')}`));
  events.forEach((item) => plan.push(`save_event ${getString(item, 'formEngineKey', 'FormEngineKey')}/${getString(item, 'eventType', 'EventType')}`));
  modules.forEach((item) => {
    const normalized = normalizeAllMenuJson(item);
    errors.push(...normalized.errors);
    warnings.push(...normalized.warnings);
    plan.push(`create_or_update_module ${getString(item, 'name', 'Name')}`);
  });
  permissions.forEach((item) => plan.push(`set_permission ${getString(item, 'roleId', 'RoleId') || 'admin'}`));
  pages.forEach((item) => plan.push(`save_page ${getString(item, 'title', 'Title')}`));
  printTemplates.forEach((item) => plan.push(`save_print_template ${getString(item, 'title', 'Title')}`));
  workflows.forEach((item) => plan.push(`save_workflow ${getString(asRecord(item.FlowDesign ?? item.flowDesign ?? item), 'FlowName', 'flowName', 'name')}`));
  jobs.forEach((item) => plan.push(`save_job ${getString(item, 'jobName', 'JobName')}`));
  return { plan, errors, warnings };
}

async function audit(client: MicroiClient, action: string, target: string, payload: unknown): Promise<void> {
  try {
    await client.writeAuditLog(action, target, JSON.stringify(payload).slice(0, 6000));
  } catch (error) {
    console.error('[microi-mcp] audit log failed:', error instanceof Error ? error.message : String(error));
  }
}

async function upsertEngine(client: MicroiClient, engine: JsonRecord): Promise<ApiResponse> {
  const apiEngineKey = getString(engine, 'apiEngineKey', 'ApiEngineKey');
  const apiName = getString(engine, 'apiName', 'ApiName', 'name', 'Name') || apiEngineKey;
  const category = getString(engine, 'category', 'Category') || 'AI生成';
  const code = getString(engine, 'code', 'Code', 'ApiV8Code');
  const existing = await client.getEngineCode(apiEngineKey);
  if (existing.Code === 1) {
    return client.saveEngineCode(apiEngineKey, code);
  }
  return client.createEngine({ ApiEngineKey: apiEngineKey, ApiName: apiName, Category: category, Code: code });
}

function modulePayload(module: JsonRecord, tableIdByName: Map<string, string>, moduleIdByName?: Map<string, string>): JsonRecord {
  const tableRef = getString(module, 'table', 'tableName', 'diyTableName', 'DiyTableName');
  const normalized = normalizeAllMenuJson(module);
  if (normalized.errors.length) throw new Error(normalized.errors.join('\n'));
  const diyTableId = getString(module, 'diyTableId', 'DiyTableId') || (tableRef ? tableIdByName.get(tableRef.toLowerCase()) : '');
  const payload = compactObject({
    ...normalized.data,
    Name: getString(module, 'name', 'Name'),
    DiyTableId: diyTableId,
    ParentId: getString(module, 'parentId', 'ParentId') || (moduleIdByName ? moduleIdByName.get(getString(module, 'parentName', 'ParentName').toLowerCase()) : undefined),
    ComponentName: getString(module, 'componentName', 'ComponentName'),
    ComponentPath: getString(module, 'componentPath', 'ComponentPath'),
    Display: getNumber(module, 'display', 'Display'),
    AppDisplay: getNumber(module, 'appDisplay', 'AppDisplay'),
    OpenType: getString(module, 'openType', 'OpenType'),
    Url: getString(module, 'url', 'Url'),
    Sort: getNumber(module, 'sort', 'Sort'),
    Icon: getString(module, 'icon', 'Icon'),
    SearchFieldIds: getString(module, 'searchFieldIds', 'SearchFieldIds'),
    TableDiyFieldIds: getString(module, 'tableDiyFieldIds', 'TableDiyFieldIds'),
    DefaultOrderBy: getString(module, 'defaultOrderBy', 'DefaultOrderBy'),
    SqlWhere: getString(module, 'sqlWhere', 'SqlWhere'),
    DiyConfig: stringifyConfig(module.diyConfig ?? module.DiyConfig),
  });
  return payload;
}

function rolePayload(role: JsonRecord): JsonRecord {
  return compactObject({
    ...role,
    Id: getString(role, 'Id', 'roleId', 'RoleId') || undefined,
    Name: getString(role, 'Name', 'name'),
    Level: getNumber(role, 'Level', 'level'),
    Sort: getNumber(role, 'Sort', 'sort'),
    Remark: getString(role, 'Remark', 'remark', 'description'),
    DeptIds: getString(role, 'DeptIds', 'deptIds'),
    BaseLimit: getString(role, 'BaseLimit', 'baseLimit'),
  });
}

function dataSourcePayload(dataSource: JsonRecord): JsonRecord {
  return compactObject({
    ...dataSource,
    Id: getString(dataSource, 'Id', 'dataSourceId', 'DataSourceId') || undefined,
    DataSourceName: getString(dataSource, 'DataSourceName', 'dataSourceName', 'name', 'Name'),
    DataSourceKey: getString(dataSource, 'DataSourceKey', 'dataSourceKey'),
    DataSourceType: getString(dataSource, 'DataSourceType', 'dataSourceType') || 'V8',
    SqlDataSource: getString(dataSource, 'SqlDataSource', 'sqlDataSource', 'sql'),
    V8DataSource: getString(dataSource, 'V8DataSource', 'v8DataSource', 'code'),
    JsonDataSource: stringifyConfig(dataSource.JsonDataSource ?? dataSource.jsonDataSource ?? dataSource.json),
    TestParam: stringifyConfig(dataSource.TestParam ?? dataSource.testParam),
    DataSourceRole: getString(dataSource, 'DataSourceRole', 'dataSourceRole'),
    AllowAnonymous: getNumber(dataSource, 'AllowAnonymous', 'allowAnonymous'),
    IsEnable: getNumber(dataSource, 'IsEnable', 'isEnable') ?? 1,
  });
}

function printTemplatePayload(template: JsonRecord): JsonRecord {
  return compactObject({
    ...template,
    Id: getString(template, 'Id', 'printId', 'PrintId') || undefined,
    Title: getString(template, 'Title', 'title'),
    Number: getString(template, 'Number', 'number'),
    Desc: getString(template, 'Desc', 'desc', 'description'),
    DataApi: getString(template, 'DataApi', 'dataApi'),
    PageObj: stringifyConfig(template.PageObj ?? template.pageObj),
    PrintObj: stringifyConfig(template.PrintObj ?? template.printObj),
  });
}

function jobPayload(job: JsonRecord): JsonRecord {
  return compactObject({
    ...job,
    Id: getString(job, 'Id', 'jobId', 'JobId') || undefined,
    JobName: getString(job, 'JobName', 'jobName', 'name', 'Name'),
    CronExpression: getString(job, 'CronExpression', 'cronExpression', 'cron'),
    JobType: getString(job, 'JobType', 'jobType') || '1',
    ApiEngineKey: getString(job, 'ApiEngineKey', 'apiEngineKey'),
    JobParam: stringifyConfig(job.JobParam ?? job.jobParam ?? job.params),
    JobDesc: getString(job, 'JobDesc', 'jobDesc', 'description'),
    CronDesc: getString(job, 'CronDesc', 'cronDesc'),
    DllName: getString(job, 'DllName', 'dllName'),
    JobPath: getString(job, 'JobPath', 'jobPath'),
  });
}

export function registerAdvancedTools(server: McpServer, client: MicroiClient, context: McpServerContext): void {
  const osClient = context.osClient;

  server.tool(
    'microi_validate_menu_buttons',
    'Validate and normalize sys_menu button/tab JSON arrays (MoreBtns/FormBtns/BatchSelectMoreBtns/PageTabs/ExportMoreBtns/PageBtns). Returns canonical JSON strings with generated Id/Sort/default visibility.',
    {
      moreBtns: z.unknown().optional(),
      formBtns: z.unknown().optional(),
      batchSelectMoreBtns: z.unknown().optional(),
      pageTabs: z.unknown().optional(),
      exportMoreBtns: z.unknown().optional(),
      pageBtns: z.unknown().optional(),
    },
    async (input) => {
      const normalized = normalizeAllMenuJson(input as JsonRecord);
      return textResult(JSON.stringify({ ok: normalized.errors.length === 0, ...normalized }, null, 2), normalized.errors.length > 0);
    },
  );

  server.tool(
    'microi_build_field_config',
    `Build and validate Microi diy_field Data/Config JSON for option controls, SQL/APIEngine/DataSource sources, JoinForm, AutoNumber and DateTime. OsClient: ${osClient}`,
    {
      sourceType: z.enum(['Data', 'KeyValue', 'Sql', 'ApiEngine', 'DataSource', 'AutoNumber', 'JoinForm', 'DateTime']).describe('Config source type'),
      options: jsonRecordSchema.optional().describe('Source options, such as data/options, sql, apiEngineKey, dataSourceId, tableId, prefix, length'),
    },
    async ({ sourceType, options }) => {
      const built = buildFieldConfig(sourceType, options || {});
      return textResult(JSON.stringify({ ok: built.warnings.length === 0, ...built, configJson: JSON.stringify(built.config) }, null, 2));
    },
  );

  server.tool(
    'microi_plan_system',
    'Create a dry-run execution plan for a full low-code system manifest. This performs local structural validation only and does not write to Microi.',
    { manifest: jsonRecordSchema.describe('System manifest with tables, engines, modules, permissions, pages, dataSources, printTemplates, workflows, jobs') },
    async ({ manifest }) => {
      const plan = buildPlan(manifest);
      return textResult(JSON.stringify({ ok: plan.errors.length === 0, dryRun: true, ...plan }, null, 2), plan.errors.length > 0);
    },
  );

  server.tool(
    'microi_validate_system',
    `Validate that a generated low-code system exists on Microi server after generation. OsClient: ${osClient}`,
    { manifest: jsonRecordSchema.describe('The same manifest used by microi_generate_system') },
    async ({ manifest }) => {
      try {
        const result = await client.validateLowCodeSystem(manifest);
        return apiText('Low-Code System Validation', result);
      } catch (error) {
        return textResult(`Error: ${error instanceof Error ? error.message : String(error)}`, true);
      }
    },
  );

  server.tool(
    'microi_generate_system',
    `Generate a complete Microi low-code system from a manifest. Supports dryRun execution plans and post-generation validation. Writes require confirmExecution="${osClient || 'EXECUTE'}" or "EXECUTE". OsClient: ${osClient}`,
    {
      manifest: jsonRecordSchema.describe('System manifest with tables, fields, dataSources, engines, events, modules, permissions, pages, printTemplates, workflows and jobs'),
      dryRun: z.boolean().optional().describe('Default true. When true, only returns an execution plan.'),
      confirmExecution: z.string().optional().describe('Required when dryRun=false. Use current OsClient or EXECUTE.'),
    },
    async ({ manifest, dryRun = true, confirmExecution }) => {
      const plan = buildPlan(manifest);
      if (plan.errors.length > 0) return textResult(JSON.stringify({ ok: false, ...plan }, null, 2), true);
      if (dryRun) return textResult(JSON.stringify({ ok: true, dryRun: true, ...plan }, null, 2));
      if (confirmExecution !== osClient && confirmExecution !== 'EXECUTE') {
        return textResult(`写入已拦截：请重新调用并传 confirmExecution="${osClient || 'EXECUTE'}" 或 "EXECUTE"。\n\n${JSON.stringify({ plan: plan.plan, warnings: plan.warnings }, null, 2)}`, true);
      }

      const results: JsonRecord[] = [];
      const tableIdByName = new Map<string, string>();
      const moduleIdByName = new Map<string, string>();
      const roleIdByName = new Map<string, string>();
      try {
        await audit(client, 'microi_generate_system:start', getString(manifest, 'name', 'Name') || 'manifest', manifest);

        for (const role of getArray(manifest, 'roles', 'Roles')) {
          const payload = rolePayload(role);
          const response = await client.saveRole(payload);
          const roleName = getString(payload, 'Name');
          results.push({ step: 'saveRole', roleName, response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'saveRole', role: payload, response, results }, null, 2), true);
          const roleId = getString(asRecord(response.Data), 'Id', 'RoleId');
          if (roleName && roleId) roleIdByName.set(roleName.toLowerCase(), roleId);
        }

        for (const table of getArray(manifest, 'tables', 'Tables')) {
          const tableName = getString(table, 'name', 'Name');
          const response = await client.createTable(tableName, getString(table, 'description', 'Description'), {
            Tabs: stringifyConfig(table.tabs ?? table.Tabs),
            IsTree: getNumber(table, 'isTree', 'IsTree'),
            Column: getNumber(table, 'column', 'Column'),
            FormOpenType: getString(table, 'formOpenType', 'FormOpenType'),
            FormOpenWidth: getString(table, 'formOpenWidth', 'FormOpenWidth'),
          });
          results.push({ step: 'createTable', tableName, response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'createTable', tableName, response, results }, null, 2), true);
          const tableId = getString(asRecord(response.Data), 'TableId', 'Id');
          if (tableId) tableIdByName.set(tableName.toLowerCase(), tableId);

          for (const field of getArray(table, 'fields', 'Fields')) {
            const configSource = asRecord(field.configSource ?? field.ConfigSource);
            const generatedConfig = getString(configSource, 'sourceType') ? buildFieldConfig(getString(configSource, 'sourceType'), configSource) : undefined;
            const fieldPayload = compactObject({
              TableId: tableId,
              Name: getString(field, 'name', 'Name'),
              Label: getString(field, 'label', 'Label'),
              Type: getString(field, 'type', 'Type'),
              Component: getString(field, 'component', 'Component'),
              Visible: getNumber(field, 'visible', 'Visible'),
              AppVisible: getNumber(field, 'appVisible', 'AppVisible'),
              Tab: getString(field, 'tab', 'Tab'),
              TableWidth: getNumber(field, 'tableWidth', 'TableWidth'),
              Sort: getNumber(field, 'sort', 'Sort'),
              Readonly: getNumber(field, 'readonly', 'Readonly'),
              NotEmpty: getNumber(field, 'notEmpty', 'NotEmpty'),
              Unique: getNumber(field, 'unique', 'Unique'),
              DefaultValue: getString(field, 'defaultValue', 'DefaultValue'),
              Placeholder: getString(field, 'placeholder', 'Placeholder'),
              Data: generatedConfig?.data ?? getString(field, 'data', 'Data'),
              Config: generatedConfig ? JSON.stringify(generatedConfig.config) : stringifyConfig(field.config ?? field.Config),
              Description: getString(field, 'description', 'Description'),
              Encrypt: getNumber(field, 'encrypt', 'Encrypt'),
              InTableEdit: getNumber(field, 'inTableEdit', 'InTableEdit'),
            }) as Parameters<MicroiClient['addField']>[0];
            const addResponse = await client.addField(fieldPayload);
            results.push({ step: 'addField', tableName, fieldName: getString(field, 'name', 'Name'), response: addResponse });
            if (addResponse.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'addField', tableName, field, response: addResponse, results }, null, 2), true);
          }
        }

        for (const dataSource of getArray(manifest, 'dataSources', 'DataSources')) {
          const payload = dataSourcePayload(dataSource);
          const response = await client.saveDataSource(payload);
          results.push({ step: 'saveDataSource', key: getString(payload, 'DataSourceKey'), response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'saveDataSource', dataSource: payload, response, results }, null, 2), true);
        }

        for (const engine of getArray(manifest, 'engines', 'Engines')) {
          const response = await upsertEngine(client, engine);
          results.push({ step: 'upsertEngine', apiEngineKey: getString(engine, 'apiEngineKey', 'ApiEngineKey'), response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'upsertEngine', engine, response, results }, null, 2), true);
        }

        for (const event of getArray(manifest, 'events', 'Events')) {
          const response = await client.saveEventCode(getString(event, 'formEngineKey', 'FormEngineKey'), getString(event, 'eventType', 'EventType'), getString(event, 'code', 'Code', 'V8Code'));
          results.push({ step: 'saveEvent', event, response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'saveEvent', event, response, results }, null, 2), true);
        }

        for (const module of getArray(manifest, 'modules', 'Modules')) {
          const payload = modulePayload(module, tableIdByName, moduleIdByName) as Parameters<MicroiClient['createModule']>[0];
          const response = await client.createModule(payload);
          results.push({ step: 'createModule', moduleName: payload.Name, response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'createModule', module: payload, response, results }, null, 2), true);
          const moduleId = getString(asRecord(response.Data), 'ModuleId', 'Id');
          if (moduleId && typeof payload.Name === 'string') moduleIdByName.set(payload.Name.toLowerCase(), moduleId);
        }

        for (const permission of getArray(manifest, 'permissions', 'Permissions')) {
          const roleName = getString(permission, 'roleName', 'RoleName', 'name', 'Name');
          const roleId = getString(permission, 'roleId', 'RoleId') || (roleName ? roleIdByName.get(roleName.toLowerCase()) : '') || 'admin';
          const explicitMenuIds = getStringArray(permission, 'menuIds', 'MenuIds');
          const moduleNames = getStringArray(permission, 'moduleNames', 'ModuleNames');
          const menuIds = explicitMenuIds.length
            ? explicitMenuIds
            : moduleNames.map((name) => moduleIdByName.get(name.toLowerCase()) || '').filter(Boolean);
          const response = await client.setRolePermission(roleId, menuIds);
          results.push({ step: 'setRolePermission', roleId, menuIds, response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'setRolePermission', permission, response, results }, null, 2), true);
        }

        for (const page of getArray(manifest, 'pages', 'Pages')) {
          const response = await client.savePageEngine({
            PageId: getString(page, 'pageId', 'PageId', 'Id') || undefined,
            Title: getString(page, 'title', 'Title'),
            Number: getString(page, 'number', 'Number') || undefined,
            Desc: getString(page, 'desc', 'Desc') || undefined,
            JsonStr: stringifyConfig(page.json ?? page.JsonObj ?? page.JsonStr) || '{}',
          });
          results.push({ step: 'savePage', title: getString(page, 'title', 'Title'), response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'savePage', page, response, results }, null, 2), true);
        }

        for (const template of getArray(manifest, 'printTemplates', 'PrintTemplates')) {
          const payload = printTemplatePayload(template);
          const response = await client.savePrintTemplate(payload);
          results.push({ step: 'savePrintTemplate', title: getString(payload, 'Title'), response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'savePrintTemplate', template: payload, response, results }, null, 2), true);
        }

        for (const workflow of getArray(manifest, 'workflows', 'Workflows')) {
          const response = await client.saveWorkflowPackage(workflow);
          results.push({ step: 'saveWorkflowPackage', workflow: getString(asRecord(workflow.FlowDesign ?? workflow.flowDesign ?? workflow), 'FlowName', 'flowName'), response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'saveWorkflowPackage', workflow, response, results }, null, 2), true);
        }

        for (const job of getArray(manifest, 'jobs', 'Jobs')) {
          const payload = jobPayload(job);
          const response = await client.saveJob(payload);
          results.push({ step: 'saveJob', jobName: getString(payload, 'JobName'), response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'saveJob', job: payload, response, results }, null, 2), true);
        }

        const validation = await client.validateLowCodeSystem(manifest);
        await audit(client, 'microi_generate_system:finish', getString(manifest, 'name', 'Name') || 'manifest', { results, validation });
        return textResult(JSON.stringify({ ok: validation.Code === 1, results, validation: validation.Data }, null, 2), validation.Code !== 1);
      } catch (error) {
        return textResult(`Error: ${error instanceof Error ? error.message : String(error)}\n\n${JSON.stringify({ results }, null, 2)}`, true);
      }
    },
  );

  server.tool('microi_list_roles', `List roles for OsClient ${osClient}.`, { keyword: z.string().optional() }, async ({ keyword }) => apiText('Roles', await client.listRoles(keyword)));
  server.tool('microi_save_role', `Create or update a role for OsClient ${osClient}.`, { role: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ role, confirmExecution }) => {
    const payload = rolePayload(role);
    const name = getString(payload, 'Name');
    if (confirmExecution !== name && confirmExecution !== 'EXECUTE') return textResult(`写入已拦截：请传 confirmExecution="${name}" 或 "EXECUTE"。`, true);
    await audit(client, 'microi_save_role', name, payload);
    return apiText('Save Role', await client.saveRole(payload));
  });
  server.tool('microi_list_modules', `List menu modules for OsClient ${osClient}.`, { keyword: z.string().optional() }, async ({ keyword }) => apiText('Modules', await client.listModules(keyword)));
  server.tool('microi_get_module', `Get one menu module by ModuleId for OsClient ${osClient}.`, { moduleId: z.string() }, async ({ moduleId }) => apiText('Module Detail', await client.getModule(moduleId)));
  server.tool('microi_update_module', `Incrementally update an existing menu module, including button/tab JSON. OsClient ${osClient}.`, { module: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ module, confirmExecution }) => {
    const normalized = normalizeAllMenuJson(module);
    if (normalized.errors.length) return textResult(JSON.stringify(normalized, null, 2), true);
    const target = getString(module, 'moduleId', 'ModuleId', 'Id') || getString(module, 'name', 'Name');
    if (confirmExecution !== target && confirmExecution !== 'EXECUTE') return textResult(`写入已拦截：请传 confirmExecution="${target}" 或 "EXECUTE"。`, true);
    await audit(client, 'microi_update_module', target, normalized.data);
    return apiText('Update Module', await client.updateModule(normalized.data));
  });

  server.tool('microi_upsert_engine', `Create an API engine if missing, otherwise update its code. OsClient ${osClient}.`, { engine: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ engine, confirmExecution }) => {
    const key = getString(engine, 'apiEngineKey', 'ApiEngineKey');
    if (!key) return textResult('ApiEngineKey 不能为空', true);
    if (confirmExecution !== key && confirmExecution !== 'EXECUTE') return textResult(`写入已拦截：请传 confirmExecution="${key}" 或 "EXECUTE"。`, true);
    await audit(client, 'microi_upsert_engine', key, engine);
    return apiText('Upsert Engine', await upsertEngine(client, engine));
  });

  server.tool('microi_list_data_sources', `List data source engines for OsClient ${osClient}.`, { keyword: z.string().optional() }, async ({ keyword }) => apiText('Data Sources', await client.listDataSources(keyword)));
  server.tool('microi_save_data_source', `Create or update sys_datasource for SQL/V8/JSON data source engines. OsClient ${osClient}.`, { dataSource: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ dataSource, confirmExecution }) => {
    const payload = dataSourcePayload(dataSource);
    const key = getString(payload, 'DataSourceKey');
    if (confirmExecution !== key && confirmExecution !== 'EXECUTE') return textResult(`写入已拦截：请传 confirmExecution="${key}" 或 "EXECUTE"。`, true);
    await audit(client, 'microi_save_data_source', key, payload);
    return apiText('Save Data Source', await client.saveDataSource(payload));
  });
  server.tool('microi_run_data_source', `Run a sys_datasource engine for validation. May have side effects if the data source V8 writes data. OsClient ${osClient}.`, { dataSourceKey: z.string(), params: jsonRecordSchema.optional(), confirmExecution: z.string().optional() }, async ({ dataSourceKey, params, confirmExecution }) => {
    if (confirmExecution !== dataSourceKey && confirmExecution !== 'EXECUTE') return textResult(`执行已拦截：请传 confirmExecution="${dataSourceKey}" 或 "EXECUTE"。`, true);
    await audit(client, 'microi_run_data_source', dataSourceKey, params || {});
    return apiText('Run Data Source', await client.runDataSource(dataSourceKey, params));
  });

  server.tool('microi_list_print_templates', `List print engine templates for OsClient ${osClient}.`, { keyword: z.string().optional() }, async ({ keyword }) => apiText('Print Templates', await client.listPrintTemplates(keyword)));
  server.tool('microi_save_print_template', `Create or update a mic_print print template. OsClient ${osClient}.`, { template: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ template, confirmExecution }) => {
    const payload = printTemplatePayload(template);
    const title = getString(payload, 'Title');
    if (confirmExecution !== title && confirmExecution !== 'EXECUTE') return textResult(`写入已拦截：请传 confirmExecution="${title}" 或 "EXECUTE"。`, true);
    await audit(client, 'microi_save_print_template', title, payload);
    return apiText('Save Print Template', await client.savePrintTemplate(payload));
  });

  server.tool('microi_save_workflow_package', `Create or update wf_flowdesign + wf_node + wf_line as one workflow package. OsClient ${osClient}.`, { workflow: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ workflow, confirmExecution }) => {
    const name = getString(asRecord(workflow.FlowDesign ?? workflow.flowDesign ?? workflow), 'FlowName', 'flowName', 'name');
    if (confirmExecution !== name && confirmExecution !== 'EXECUTE') return textResult(`写入已拦截：请传 confirmExecution="${name}" 或 "EXECUTE"。`, true);
    await audit(client, 'microi_save_workflow_package', name, workflow);
    return apiText('Save Workflow Package', await client.saveWorkflowPackage(workflow));
  });

  server.tool('microi_save_job', `Create or update a scheduled job. For ApiEngine jobs use JobType="1" and ApiEngineKey. OsClient ${osClient}.`, { job: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ job, confirmExecution }) => {
    const payload = jobPayload(job);
    const name = getString(payload, 'JobName');
    if (confirmExecution !== name && confirmExecution !== 'EXECUTE') return textResult(`写入已拦截：请传 confirmExecution="${name}" 或 "EXECUTE"。`, true);
    await audit(client, 'microi_save_job', name, payload);
    return apiText('Save Job', await client.saveJob(payload));
  });
}