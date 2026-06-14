import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MicroiClient, ApiResponse } from './microi-client.js';
import type { McpServerContext } from './server.js';
import { normalizePageJsonObj, normalizePrintObj, normalizePrintPageObj } from './design-engine.js';

type JsonRecord = Record<string, unknown>;
type ToolContent = { type: 'text'; text: string };
type ToolResult = { content: ToolContent[]; isError?: boolean };
type FieldRef = {
  ref: string;
  asName?: string;
  type?: string;
  displayType?: string;
  displaySelect?: boolean;
  equal?: boolean;
};
type FieldMeta = {
  id: string;
  name: string;
  label: string;
  tableId: string;
  tableName: string;
  tableDescription: string;
  component: string;
  type: string;
};
type FieldLookup = {
  byTableAndRef: Map<string, FieldMeta>;
  fieldsByTable: Map<string, FieldMeta[]>;
};
type WorkflowCheckResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  summary: JsonRecord;
};

const WF_MARKER_BEGIN = '/* MICROI_WF_LINE_CONDITION_JSON';
const WF_MARKER_END = 'MICROI_WF_LINE_CONDITION_JSON */';

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

function getValue(record: JsonRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  }
  return undefined;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function fieldLookupKey(tableRef: string, fieldRef: string): string {
  return `${normalizeKey(tableRef)}::${normalizeKey(fieldRef)}`;
}

function isSystemFieldName(value: string): boolean {
  return ['Id', 'CreateTime', 'UpdateTime', 'CreateUserId', 'CreateUserName', 'UpdateUserId', 'UpdateUserName', 'OsClient', 'IsDeleted']
    .some((name) => name.toLowerCase() === value.toLowerCase());
}

function jsonArrayOrSplit(value: string): unknown[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to loose splitting.
    }
  }
  return trimmed.split(/[,;\n\uFF0C\uFF1B\u3001]+/).map((item) => item.trim()).filter(Boolean);
}

function getFieldRefs(record: JsonRecord, ...keys: string[]): FieldRef[] {
  for (const key of keys) {
    const value = getValue(record, key);
    if (value === undefined || value === null || value === '') continue;
    const values = Array.isArray(value) ? value : (typeof value === 'string' ? jsonArrayOrSplit(value) : [value]);
    return values.map((item) => {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        return { ref: String(item).trim() };
      }
      const source = asRecord(item);
      return {
        ref: getString(source, 'field', 'Field', 'fieldName', 'FieldName', 'name', 'Name', 'id', 'Id', 'fieldId', 'FieldId'),
        asName: getString(source, 'asName', 'AsName', 'alias', 'Alias') || undefined,
        type: getString(source, 'type', 'Type') || undefined,
        displayType: getString(source, 'displayType', 'DisplayType') || undefined,
        displaySelect: typeof source.displaySelect === 'boolean'
          ? source.displaySelect
          : (typeof source.DisplaySelect === 'boolean' ? source.DisplaySelect : undefined),
        equal: typeof source.equal === 'boolean'
          ? source.equal
          : (typeof source.Equal === 'boolean' ? source.Equal : undefined),
      };
    }).filter((item) => item.ref);
  }
  return [];
}

function createFieldLookup(): FieldLookup {
  return { byTableAndRef: new Map<string, FieldMeta>(), fieldsByTable: new Map<string, FieldMeta[]>() };
}

function addFieldMeta(lookup: FieldLookup, meta: FieldMeta): void {
  const tableRefs = [meta.tableId, meta.tableName].filter(Boolean);
  const fieldRefs = [meta.id, meta.name, meta.label].filter(Boolean);
  for (const tableRef of tableRefs) {
    for (const fieldRef of fieldRefs) lookup.byTableAndRef.set(fieldLookupKey(tableRef, fieldRef), meta);
    const key = normalizeKey(tableRef);
    const existing = lookup.fieldsByTable.get(key) || [];
    if (!existing.some((item) => item.id === meta.id || normalizeKey(item.name) === normalizeKey(meta.name))) {
      existing.push(meta);
      lookup.fieldsByTable.set(key, existing);
    }
  }
}

function findFieldMeta(lookup: FieldLookup, tableRef: string, ref: string): FieldMeta | undefined {
  if (!tableRef || !ref) return undefined;
  return lookup.byTableAndRef.get(fieldLookupKey(tableRef, ref));
}

function getFieldsForTable(lookup: FieldLookup, tableRef: string): FieldMeta[] {
  return lookup.fieldsByTable.get(normalizeKey(tableRef)) || [];
}

function systemFieldMeta(tableId: string, tableName: string, fieldName: string): FieldMeta {
  return {
    id: fieldName,
    name: fieldName,
    label: fieldName,
    tableId,
    tableName,
    tableDescription: tableName,
    component: 'Text',
    type: 'varchar(255)',
  };
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

function toSearchFieldModel(meta: FieldMeta, ref?: FieldRef): JsonRecord {
  const component = componentKey(meta);
  return compactObject({
    Id: meta.id,
    AsName: ref?.asName || '',
    Name: meta.name,
    Label: meta.label || meta.name,
    TableId: meta.tableId,
    TableName: meta.tableName,
    TableDescription: meta.tableDescription || meta.tableName,
    DisplayType: ref?.displayType || (EXACT_SEARCH_COMPONENTS.has(component) || isDateField(meta) || component === 'numbertext' ? 'In' : 'Out'),
    DisplaySelect: ref?.displaySelect ?? ['opentable', 'joinform', 'department', 'selecttree'].includes(component),
    Equal: ref?.equal ?? (EXACT_SEARCH_COMPONENTS.has(component) || component === 'numbertext' ? true : undefined),
    IsVisible: true,
  });
}

function resolveFieldRefs(lookup: FieldLookup, tableId: string, tableName: string, refs: FieldRef[], context: string): Array<{ meta: FieldMeta; ref: FieldRef }> {
  return refs.map((ref) => {
    const meta = findFieldMeta(lookup, tableId, ref.ref)
      || findFieldMeta(lookup, tableName, ref.ref)
      || (isSystemFieldName(ref.ref) ? systemFieldMeta(tableId, tableName, ref.ref) : undefined);
    if (!meta) throw new Error(`${context}: unknown field "${ref.ref}" on table "${tableName || tableId}"`);
    return { meta, ref };
  });
}

function getExplicitJsonString(record: JsonRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = getValue(record, key);
    if (value === undefined || value === null || value === '') continue;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return '';
}

const TECHNICAL_FIELD_NAMES = new Set([
  'id', 'osclient', 'isdeleted', 'createuserid', 'updateuserid', 'deleteuserid',
  'tenantid', 'storeid', 'userid', 'userids', 'roleid', 'roleids', 'parentid',
  'parentids', 'class', 'code', 'enname', 'endescription',
]);

const LAYOUT_COMPONENTS = new Set([
  'button', 'divider', 'collapsegroup', 'tabs', 'alert', 'statictext', 'html', 'devcomponent',
]);

const HEAVY_LIST_COMPONENTS = new Set([
  'textarea', 'richtext', 'codeeditor', 'jsontable', 'imgupload', 'fileupload',
  'tablechild', 'map', 'maparea', 'jointable', 'opentable', 'treecheckbox', 'transfer',
]);

const SEARCHABLE_COMPONENTS = new Set([
  'text', 'textarea', 'select', 'multipleselect', 'radio', 'checkbox', 'datetime',
  'date', 'numbertext', 'autonumber', 'switch', 'department', 'address', 'cascader',
  'selecttree', 'opentable', 'joinform', 'autocomplete', 'taginput',
]);

const EXACT_SEARCH_COMPONENTS = new Set([
  'select', 'multipleselect', 'radio', 'checkbox', 'switch', 'department', 'selecttree',
  'opentable', 'joinform', 'cascader',
]);

function lower(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function fieldText(field: FieldMeta): string {
  return `${field.name || ''} ${field.label || ''} ${field.component || ''} ${field.type || ''}`.toLowerCase();
}

function hasKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function componentKey(field: FieldMeta): string {
  return lower(field.component || 'Text');
}

function isLayoutField(field: FieldMeta): boolean {
  return LAYOUT_COMPONENTS.has(componentKey(field));
}

function isHeavyListField(field: FieldMeta): boolean {
  return HEAVY_LIST_COMPONENTS.has(componentKey(field));
}

function isIdLikeField(field: FieldMeta): boolean {
  const name = field.name || '';
  const normalized = lower(name).replace(/[_\-\s]+/g, '');
  if (TECHNICAL_FIELD_NAMES.has(normalized)) return true;
  if (/^(.*id|.*ids|.*idlist|.*guid)$/.test(normalized) && !/idcard|identity|cardid/.test(normalized)) return true;
  if (/Id$|ID$|Ids$|IDs$|Guid$/u.test(name) && !/IdCard|IDCard|Identity|CardId/u.test(name)) return true;
  return false;
}

function shouldHideInMenuList(field: FieldMeta): boolean {
  if (isSystemFieldName(field.name) && !['CreateTime', 'UpdateTime', 'UserName'].some((name) => name.toLowerCase() === field.name.toLowerCase())) return true;
  if (isIdLikeField(field)) return true;
  if (isLayoutField(field)) return true;
  if (isHeavyListField(field)) return true;
  return componentKey(field).includes('hidden');
}

function uniqueFields(fields: FieldMeta[]): FieldMeta[] {
  const seen = new Set<string>();
  return fields.filter((field) => {
    const key = field.id || field.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rankedFields(fields: FieldMeta[], score: (field: FieldMeta) => number): FieldMeta[] {
  return fields
    .map((field, index) => ({ field, index, score: score(field) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.field);
}

function isNumericField(field: FieldMeta): boolean {
  const type = lower(field.type);
  return componentKey(field) === 'numbertext'
    || type.startsWith('decimal')
    || type === 'int'
    || type === 'bigint';
}

function isDateField(field: FieldMeta): boolean {
  const text = fieldText(field);
  return componentKey(field) === 'datetime' || hasKeyword(text, ['time', 'date', '日期', '时间']);
}

function defaultSearchRef(meta: FieldMeta): FieldRef {
  const component = componentKey(meta);
  const exact = EXACT_SEARCH_COMPONENTS.has(component) || component === 'numbertext' || component === 'rate' || component === 'progress';
  return {
    ref: meta.name,
    displayType: exact || isDateField(meta) ? 'In' : 'Out',
    displaySelect: ['opentable', 'joinform', 'department', 'selecttree'].includes(component),
    equal: exact ? true : undefined,
  };
}

function searchFieldScore(field: FieldMeta): number {
  const text = fieldText(field);
  let score = 0;
  if (hasKeyword(text, ['name', 'title', 'no', 'code', 'account', 'phone', 'mobile', 'email', '名称', '标题', '编号', '账号', '电话', '手机', '邮箱'])) score += 50;
  if (hasKeyword(text, ['status', 'state', 'type', 'category', 'level', 'class', '状态', '类型', '分类', '等级'])) score += 45;
  if (hasKeyword(text, ['customer', 'member', 'user', 'owner', '负责人', '客户', '会员', '用户', '联系人'])) score += 35;
  if (isDateField(field)) score += 25;
  if (isNumericField(field) && !hasKeyword(text, ['phone', 'mobile', 'tel', '电话', '手机'])) score += 15;
  if (componentKey(field) === 'textarea') score -= 25;
  return score;
}

function listFieldScore(field: FieldMeta): number {
  const text = fieldText(field);
  let score = 0;
  if (hasKeyword(text, ['name', 'title', 'no', 'code', '名称', '标题', '编号'])) score += 70;
  if (hasKeyword(text, ['status', 'state', 'type', 'category', '状态', '类型', '分类'])) score += 45;
  if (hasKeyword(text, ['customer', 'member', 'user', 'owner', 'phone', 'mobile', '客户', '会员', '用户', '负责人', '电话', '手机'])) score += 35;
  if (hasKeyword(text, ['amount', 'money', 'price', 'total', 'count', 'qty', '金额', '价格', '总额', '数量', '积分', '余额'])) score += 30;
  if (isDateField(field)) score += 15;
  if (componentKey(field) === 'autonumber') score += 55;
  return score;
}

function defaultHiddenFields(fields: FieldMeta[]): FieldMeta[] {
  return uniqueFields(fields.filter(shouldHideInMenuList));
}

function defaultListFields(fields: FieldMeta[]): FieldMeta[] {
  const businessFields = fields.filter((field) => !shouldHideInMenuList(field));
  const source = businessFields.length ? businessFields : fields;
  return uniqueFields(rankedFields(source, listFieldScore)).slice(0, Math.min(12, source.length));
}

function defaultSearchFields(fields: FieldMeta[]): FieldMeta[] {
  const candidates = fields.filter((field) => !shouldHideInMenuList(field) && SEARCHABLE_COMPONENTS.has(componentKey(field)));
  const ranked = rankedFields(candidates, searchFieldScore).filter((field) => searchFieldScore(field) > 0);
  return uniqueFields((ranked.length ? ranked : candidates)).slice(0, Math.min(8, candidates.length));
}

function defaultSortFields(fields: FieldMeta[]): FieldMeta[] {
  const candidates = fields.filter((field) => !shouldHideInMenuList(field) && (isDateField(field) || isNumericField(field) || lower(field.name) === 'sort'));
  return uniqueFields(rankedFields(candidates, (field) => {
    const text = fieldText(field);
    if (hasKeyword(text, ['update', '修改'])) return 80;
    if (hasKeyword(text, ['create', '创建'])) return 75;
    if (lower(field.name) === 'sort') return 70;
    if (hasKeyword(text, ['amount', 'money', 'price', 'total', 'count', '金额', '价格', '数量'])) return 60;
    return 20;
  })).slice(0, Math.min(8, candidates.length));
}

function defaultStatisticsFields(fields: FieldMeta[]): FieldMeta[] {
  const blocked = ['phone', 'mobile', 'tel', 'status', 'state', 'sort', 'rate', 'level', '电话', '手机', '状态', '排序', '等级'];
  const candidates = fields.filter((field) => {
    const text = fieldText(field);
    return !shouldHideInMenuList(field)
      && isNumericField(field)
      && !hasKeyword(text, blocked)
      && hasKeyword(text, ['amount', 'money', 'price', 'total', 'count', 'qty', 'score', 'point', 'balance', '金额', '价格', '总额', '数量', '积分', '余额', '面积', '重量']);
  });
  return uniqueFields(rankedFields(candidates, (field) => hasKeyword(fieldText(field), ['amount', 'money', 'price', 'total', '金额', '价格', '总额']) ? 80 : 40)).slice(0, 6);
}

function defaultMobileFields(fields: FieldMeta[]): FieldMeta[] {
  const candidates = defaultListFields(fields);
  const title = rankedFields(candidates, (field) => hasKeyword(fieldText(field), ['name', 'title', 'no', 'code', '名称', '标题', '编号']) ? 100 : 0)[0];
  const tags = rankedFields(candidates.filter((field) => field !== title), (field) => hasKeyword(fieldText(field), ['status', 'state', 'type', 'category', '状态', '类型', '分类']) ? 80 : 0);
  const rest = candidates.filter((field) => field !== title && !tags.slice(0, 1).includes(field));
  return uniqueFields([title, ...tags.slice(0, 1), ...rest].filter(Boolean) as FieldMeta[]).slice(0, 4);
}

function defaultCardTitleFields(fields: FieldMeta[]): FieldMeta[] {
  return rankedFields(defaultListFields(fields), (field) => hasKeyword(fieldText(field), ['status', 'state', 'type', 'category', 'level', '状态', '类型', '分类', '等级']) ? 100 : 0)
    .filter((field) => hasKeyword(fieldText(field), ['status', 'state', 'type', 'category', 'level', '状态', '类型', '分类', '等级']))
    .slice(0, 2);
}

function defaultCardBottomFields(fields: FieldMeta[]): FieldMeta[] {
  return rankedFields(defaultListFields(fields), (field) => {
    const text = fieldText(field);
    if (hasKeyword(text, ['amount', 'money', 'price', 'total', 'count', 'qty', '积分', '余额', '金额', '价格', '数量'])) return 90;
    if (isDateField(field)) return 60;
    return 0;
  }).filter((field) => {
    const text = fieldText(field);
    return isDateField(field) || hasKeyword(text, ['amount', 'money', 'price', 'total', 'count', 'qty', '积分', '余额', '金额', '价格', '数量']);
  }).slice(0, 3);
}

function defaultOrderByFromFields(fields: FieldMeta[], tableId: string, tableName: string): string | undefined {
  const candidates = fields.length ? fields : [systemFieldMeta(tableId, tableName, 'CreateTime')];
  const field = candidates.find((item) => lower(item.name) === 'createtime')
    || candidates.find((item) => lower(item.name) === 'updatetime')
    || candidates.find((item) => lower(item.name) === 'sort');
  if (!field) return undefined;
  return JSON.stringify([{ Id: field.id, Name: field.name, Type: lower(field.name) === 'sort' ? 'ASC' : 'DESC', Sort: 0 }]);
}

function buildDefaultOrderBy(module: JsonRecord, lookup: FieldLookup, tableId: string, tableName: string): string | undefined {
  const canonical = getValue(module, 'DefaultOrderBy');
  if (canonical !== undefined && canonical !== null && canonical !== '') {
    return typeof canonical === 'string' ? canonical : JSON.stringify(canonical);
  }
  const natural = getValue(module, 'defaultOrderBy');
  if (natural !== undefined && natural !== null && natural !== '') {
    const refs = Array.isArray(natural) || (typeof natural === 'string' && natural.trim().startsWith('['))
      ? getFieldRefs({ value: natural }, 'value')
      : [{ ref: String(natural).trim(), type: 'DESC' }];
    return JSON.stringify(resolveFieldRefs(lookup, tableId, tableName, refs, 'module.defaultOrderBy').map(({ meta, ref }, index) => ({
      Id: meta.id,
      Name: meta.name,
      Type: ref.type || 'DESC',
      Sort: index,
    })));
  }
  const refs = getFieldRefs(module, 'orderBy', 'OrderBy', 'defaultSort', 'DefaultSort', 'sortBy', 'SortBy');
  if (!refs.length) return undefined;
  return JSON.stringify(resolveFieldRefs(lookup, tableId, tableName, refs, 'module.defaultOrderBy').map(({ meta, ref }, index) => ({
    Id: meta.id,
    Name: meta.name,
    Type: ref.type || 'DESC',
    Sort: index,
  })));
}

function resolveModuleFields(module: JsonRecord, lookup: FieldLookup, tableId: string, tableName: string): JsonRecord {
  if (!tableId && !tableName) return {};
  const tableFields = getFieldsForTable(lookup, tableId).length ? getFieldsForTable(lookup, tableId) : getFieldsForTable(lookup, tableName);
  const output: JsonRecord = {};

  const searchRefs = getFieldRefs(module, 'searchFields', 'SearchFields', 'searchFieldNames', 'SearchFieldNames');
  const resolvedSearch = searchRefs.length
    ? resolveFieldRefs(lookup, tableId, tableName, searchRefs, 'module.searchFields')
    : defaultSearchFields(tableFields).map((meta) => ({ meta, ref: defaultSearchRef(meta) }));
  if (!getExplicitJsonString(module, 'searchFieldIds', 'SearchFieldIds') && resolvedSearch.length) {
    output.SearchFieldIds = JSON.stringify(resolvedSearch.map(({ meta, ref }) => toSearchFieldModel(meta, ref)));
  }

  const listRefs = getFieldRefs(module, 'listFields', 'ListFields', 'tableFields', 'TableFields', 'columns', 'Columns');
  const resolvedList = listRefs.length
    ? resolveFieldRefs(lookup, tableId, tableName, listRefs, 'module.listFields')
    : defaultListFields(tableFields).map((meta) => ({ meta, ref: { ref: meta.name } }));
  if (!getExplicitJsonString(module, 'tableDiyFieldIds', 'TableDiyFieldIds') && resolvedList.length) {
    output.TableDiyFieldIds = JSON.stringify(resolvedList.map(({ meta }) => meta.id));
  }
  if (!getExplicitJsonString(module, 'selectFields', 'SelectFields') && resolvedList.length) {
    output.SelectFields = JSON.stringify(resolvedList.map(({ meta, ref }) => toSearchFieldModel(meta, ref)));
  }

  const listFieldConfigs: Array<{ canonical: string; explicitKeys: string[]; refKeys: string[]; objectArray?: boolean }> = [
    { canonical: 'SortFieldIds', explicitKeys: ['sortFieldIds', 'SortFieldIds'], refKeys: ['sortFields', 'SortFields'] },
    { canonical: 'NotShowFields', explicitKeys: ['notShowFields', 'NotShowFields'], refKeys: ['hiddenFields', 'HiddenFields', 'notShowFieldsByName', 'NotShowFieldsByName'] },
    { canonical: 'InTableEditFields', explicitKeys: ['inTableEditFields', 'InTableEditFields'], refKeys: ['editableFields', 'EditableFields', 'inTableEditFieldsByName', 'InTableEditFieldsByName'] },
    { canonical: 'MobileListFields', explicitKeys: ['mobileListFields', 'MobileListFields'], refKeys: ['mobileFields', 'MobileFields'], objectArray: true },
    { canonical: 'CardTitleTagFields', explicitKeys: ['cardTitleTagFields', 'CardTitleTagFields'], refKeys: ['cardTitleFields', 'CardTitleFields'], objectArray: true },
    { canonical: 'CardBottomTagFields', explicitKeys: ['cardBottomTagFields', 'CardBottomTagFields'], refKeys: ['cardBottomFields', 'CardBottomFields'], objectArray: true },
  ];
  for (const item of listFieldConfigs) {
    if (getExplicitJsonString(module, ...item.explicitKeys)) continue;
    const refs = getFieldRefs(module, ...item.refKeys);
    const defaultByCanonical: Record<string, FieldMeta[]> = {
      SortFieldIds: defaultSortFields(tableFields),
      NotShowFields: defaultHiddenFields(tableFields),
      MobileListFields: defaultMobileFields(tableFields),
      CardTitleTagFields: defaultCardTitleFields(tableFields),
      CardBottomTagFields: defaultCardBottomFields(tableFields),
      InTableEditFields: [],
    };
    if (!refs.length && !defaultByCanonical[item.canonical]?.length) continue;
    const resolved = refs.length
      ? resolveFieldRefs(lookup, tableId, tableName, refs, `module.${item.canonical}`)
      : defaultByCanonical[item.canonical].map((meta) => ({ meta, ref: { ref: meta.name } }));
    output[item.canonical] = JSON.stringify(item.objectArray
      ? resolved.map(({ meta, ref }) => toSearchFieldModel(meta, ref))
      : resolved.map(({ meta }) => meta.id));
  }

  const statisticsRefs = getFieldRefs(module, 'statisticsFieldNames', 'StatisticsFieldNames', 'statFields', 'StatFields');
  if (!getExplicitJsonString(module, 'statisticsFields', 'StatisticsFields')) {
    const resolvedStatistics = statisticsRefs.length
      ? resolveFieldRefs(lookup, tableId, tableName, statisticsRefs, 'module.statisticsFields')
      : defaultStatisticsFields(tableFields).map((meta) => ({ meta, ref: { ref: meta.name, type: 'Sum' } }));
    if (resolvedStatistics.length) output.StatisticsFields = JSON.stringify(resolvedStatistics.map(({ meta, ref }) => ({
      Id: meta.id,
      Type: ref.type || 'Sum',
    })));
  }

  const defaultOrderBy = buildDefaultOrderBy(module, lookup, tableId, tableName)
    || (getExplicitJsonString(module, 'DefaultOrderBy', 'defaultOrderBy') ? undefined : defaultOrderByFromFields(tableFields, tableId, tableName));
  if (defaultOrderBy) output.DefaultOrderBy = defaultOrderBy;
  return output;
}

function populateFieldLookupFromSchema(lookup: FieldLookup, schemaData: unknown, tableIdByName?: Map<string, string>): void {
  const tables = asArray(asRecord(schemaData).Tables);
  for (const table of tables) {
    const tableId = getString(table, 'Id', 'id');
    const tableName = getString(table, 'Name', 'name');
    if (!tableId || !tableName) continue;
    tableIdByName?.set(tableName.toLowerCase(), tableId);
    const fieldsValue = getValue(table, '_Fields', 'Fields', 'fields');
    const fields = Array.isArray(fieldsValue) ? asArray(fieldsValue) : [];
    for (const field of fields) {
      const id = getString(field, 'Id', 'id');
      const name = getString(field, 'Name', 'name');
      if (!id || !name) continue;
      addFieldMeta(lookup, {
        id,
        name,
        label: getString(field, 'Label', 'label') || name,
        tableId,
        tableName,
        tableDescription: getString(table, 'Description', 'description') || tableName,
        component: getString(field, 'Component', 'component') || 'Text',
        type: getString(field, 'Type', 'type') || 'varchar(255)',
      });
    }
  }
}

type TableLayoutDefaults = {
  tabs?: JsonRecord[];
  fieldTabs: Map<string, string>;
  column?: number;
};

function tableFieldComponent(field: JsonRecord): string {
  return lower(getString(field, 'component', 'Component') || 'Text');
}

function tableFieldText(field: JsonRecord): string {
  return `${getString(field, 'name', 'Name')} ${getString(field, 'label', 'Label')} ${getString(field, 'component', 'Component')}`.toLowerCase();
}

function autoTableTabForField(field: JsonRecord, index: number): string {
  const text = tableFieldText(field);
  const component = tableFieldComponent(field);
  if (['imgupload', 'fileupload', 'richtext', 'codeeditor', 'jsontable', 'tablechild', 'map', 'maparea', 'textarea'].includes(component)
    || hasKeyword(text, ['remark', 'note', 'content', 'file', 'image', 'attach', 'map', '备注', '说明', '内容', '附件', '图片', '地图'])) {
    return 'attachment';
  }
  if (hasKeyword(text, ['phone', 'mobile', 'email', 'address', 'city', 'contact', '联系人', '电话', '手机', '邮箱', '地址', '城市'])) {
    return 'contact';
  }
  if (hasKeyword(text, ['status', 'state', 'type', 'category', 'amount', 'money', 'price', 'count', 'date', 'time', '状态', '类型', '分类', '金额', '价格', '数量', '时间', '日期'])) {
    return 'business';
  }
  return index < 8 ? 'basic' : 'extra';
}

function buildDefaultTableLayout(table: JsonRecord): TableLayoutDefaults {
  const fields = getArray(table, 'fields', 'Fields');
  const explicitTabs = getValue(table, 'tabs', 'Tabs');
  const fieldTabs = new Map<string, string>();
  const column = getNumber(table, 'column', 'Column') ?? (fields.length > 6 ? 2 : undefined);
  if (explicitTabs !== undefined && explicitTabs !== null && explicitTabs !== '') return { fieldTabs, column };

  const nonLayoutFields = fields.filter((field) => !LAYOUT_COMPONENTS.has(tableFieldComponent(field)));
  if (nonLayoutFields.length <= 12) return { fieldTabs, column };

  const labels: Record<string, { Name: string; Icon: string; Sort: number }> = {
    basic: { Name: '基础信息', Icon: 'fas fa-id-card', Sort: 10 },
    contact: { Name: '联系信息', Icon: 'fas fa-address-book', Sort: 20 },
    business: { Name: '业务信息', Icon: 'fas fa-briefcase', Sort: 30 },
    attachment: { Name: '附件备注', Icon: 'fas fa-paperclip', Sort: 40 },
    extra: { Name: '扩展信息', Icon: 'fas fa-layer-group', Sort: 50 },
  };
  const used = new Set<string>();
  nonLayoutFields.forEach((field, index) => {
    const fieldName = getString(field, 'name', 'Name');
    if (!fieldName || getString(field, 'tab', 'Tab')) return;
    const tabId = autoTableTabForField(field, index);
    fieldTabs.set(fieldName, tabId);
    used.add(tabId);
  });

  const ordered = ['basic', 'contact', 'business', 'attachment', 'extra'].filter((tabId) => used.has(tabId));
  return {
    tabs: ordered.map((tabId) => ({ Id: tabId, Name: labels[tabId].Name, Icon: labels[tabId].Icon, Sort: labels[tabId].Sort })),
    fieldTabs,
    column,
  };
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
  const manifestFieldsByTable = new Map<string, Set<string>>();

  if (!tables.length && !engines.length && !modules.length && !pages.length) {
    warnings.push('Manifest 未声明 tables/engines/modules/pages，可能不是完整系统计划');
  }

  roles.forEach((item) => plan.push(`save_role ${getString(item, 'name', 'Name')}`));
  tables.forEach((table, tableIndex) => {
    const name = getString(table, 'name', 'Name');
    if (!name) errors.push(`tables[${tableIndex}].name 不能为空`);
    plan.push(`create_table ${name || `(index ${tableIndex})`}`);
    const layout = buildDefaultTableLayout(table);
    if (layout.tabs?.length) {
      warnings.push(`table ${name || `(index ${tableIndex})`} has many fields; generator will create diy_table.Tabs and assign empty field Tab values automatically`);
    }
    if (name) manifestFieldsByTable.set(name.toLowerCase(), new Set<string>());
    getArray(table, 'fields', 'Fields').forEach((field, fieldIndex) => {
      const fieldName = getString(field, 'name', 'Name');
      const label = getString(field, 'label', 'Label');
      if (!fieldName) errors.push(`tables[${tableIndex}].fields[${fieldIndex}].name 不能为空`);
      if (!label) errors.push(`tables[${tableIndex}].fields[${fieldIndex}].label 不能为空`);
      if (name && fieldName) manifestFieldsByTable.get(name.toLowerCase())?.add(fieldName.toLowerCase());
      if (name && label) manifestFieldsByTable.get(name.toLowerCase())?.add(label.toLowerCase());
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
    const tableRef = getString(item, 'table', 'tableName', 'diyTableName', 'DiyTableName');
    const moduleName = getString(item, 'name', 'Name');
    if (tableRef && manifestFieldsByTable.has(tableRef.toLowerCase())) {
      const fields = manifestFieldsByTable.get(tableRef.toLowerCase()) || new Set<string>();
      const fieldGroups = [
        ['listFields', getFieldRefs(item, 'listFields', 'ListFields', 'tableFields', 'TableFields', 'columns', 'Columns')],
        ['searchFields', getFieldRefs(item, 'searchFields', 'SearchFields', 'searchFieldNames', 'SearchFieldNames')],
        ['sortFields', getFieldRefs(item, 'sortFields', 'SortFields')],
        ['hiddenFields', getFieldRefs(item, 'hiddenFields', 'HiddenFields', 'notShowFieldsByName', 'NotShowFieldsByName')],
        ['mobileFields', getFieldRefs(item, 'mobileFields', 'MobileFields')],
      ] as const;
      for (const [groupName, refs] of fieldGroups) {
        for (const ref of refs) {
          if (!fields.has(ref.ref.toLowerCase()) && !isSystemFieldName(ref.ref)) {
            errors.push(`modules.${moduleName || tableRef}.${groupName} references unknown field "${ref.ref}" on table "${tableRef}"`);
          }
        }
      }
    }
    if (tableRef && !getFieldRefs(item, 'listFields', 'ListFields', 'tableFields', 'TableFields', 'columns', 'Columns').length && !getExplicitJsonString(item, 'TableDiyFieldIds', 'SelectFields')) {
      warnings.push(`module ${moduleName || tableRef} has no listFields; generator will use the first business fields from ${tableRef}`);
    }
    plan.push(`create_or_update_module ${getString(item, 'name', 'Name')}`);
  });
  permissions.forEach((item) => plan.push(`set_permission ${getString(item, 'roleId', 'RoleId') || 'admin'}`));
  pages.forEach((item, pageIndex) => {
    const normalizedPage = normalizePageJsonObj(item.json ?? item.JsonObj ?? item.JsonStr ?? item);
    errors.push(...normalizedPage.errors.map((error) => `pages[${pageIndex}]: ${error}`));
    warnings.push(...normalizedPage.warnings.map((warning) => `pages[${pageIndex}]: ${warning}`));
    plan.push(`save_page ${getString(item, 'title', 'Title')}`);
  });
  printTemplates.forEach((item, printIndex) => {
    const page = normalizePrintPageObj(item.PageObj ?? item.pageObj);
    const data = normalizePrintObj(item.PrintObj ?? item.printObj);
    errors.push(...page.errors.map((error) => `printTemplates[${printIndex}].PageObj: ${error}`));
    warnings.push(...page.warnings.map((warning) => `printTemplates[${printIndex}].PageObj: ${warning}`));
    errors.push(...data.errors.map((error) => `printTemplates[${printIndex}].PrintObj: ${error}`));
    warnings.push(...data.warnings.map((warning) => `printTemplates[${printIndex}].PrintObj: ${warning}`));
    plan.push(`save_print_template ${getString(item, 'title', 'Title')}`);
  });
  workflows.forEach((item, workflowIndex) => {
    const check = validateWorkflowPackage(item);
    errors.push(...check.errors.map((error) => `workflows[${workflowIndex}]: ${error}`));
    warnings.push(...check.warnings.map((warning) => `workflows[${workflowIndex}]: ${warning}`));
    plan.push(`save_workflow ${getString(asRecord(item.FlowDesign ?? item.flowDesign ?? item), 'FlowName', 'flowName', 'name')}`);
  });
  jobs.forEach((item) => plan.push(`save_job ${getString(item, 'jobName', 'JobName')}`));
  return { plan, errors, warnings };
}

function getWorkflowParts(workflow: JsonRecord): { flow: JsonRecord; nodes: JsonRecord[]; lines: JsonRecord[] } {
  return {
    flow: asRecord(workflow.FlowDesign ?? workflow.flowDesign ?? workflow),
    nodes: getArray(workflow, 'Nodes', 'nodes'),
    lines: getArray(workflow, 'Lines', 'lines'),
  };
}

function getNodeId(node: JsonRecord): string {
  return getString(node, 'Id', 'id', 'NodeId', 'nodeId');
}

function getNodeName(node: JsonRecord): string {
  return getString(node, 'NodeName', 'nodeName', 'Name', 'name');
}

function getNodeType(node: JsonRecord): string {
  return getString(node, 'NodeType', 'nodeType', 'Type', 'type');
}

function isStartNode(node: JsonRecord): boolean {
  const value = `${getNodeType(node)} ${getNodeName(node)}`.toLowerCase();
  return value.includes('start') || value.includes('begin') || value.includes('开始') || value.includes('发起');
}

function isEndNode(node: JsonRecord): boolean {
  const value = `${getNodeType(node)} ${getNodeName(node)}`.toLowerCase();
  return value.includes('end') || value.includes('finish') || value.includes('结束') || value.includes('完成');
}

function validateWorkflowPackage(workflow: JsonRecord): WorkflowCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { flow, nodes, lines } = getWorkflowParts(workflow);
  const flowName = getString(flow, 'FlowName', 'flowName', 'Name', 'name');
  const flowTableId = getString(flow, 'TableId', 'tableId');
  const flowTableRef = getString(flow, 'table', 'tableName', 'TableName', 'diyTableName', 'DiyTableName');
  const nodeById = new Map<string, JsonRecord>();
  const outgoing = new Map<string, JsonRecord[]>();
  const incoming = new Map<string, JsonRecord[]>();

  if (!flowName) errors.push('FlowDesign.FlowName 不能为空');
  if (!nodes.length) errors.push('Nodes 至少需要包含开始、审批/业务、结束节点');
  if (!lines.length) errors.push('Lines 至少需要连接开始到下一节点');
  if (!flowTableId && !flowTableRef) warnings.push('FlowDesign.TableId 为空；普通审批流建议绑定业务 diy_table');

  nodes.forEach((node, index) => {
    const id = getNodeId(node);
    const name = getNodeName(node);
    if (!id) errors.push(`Nodes[${index}].Id/NodeId 不能为空`);
    if (!name) errors.push(`Nodes[${index}].NodeName 不能为空`);
    if (id) {
      if (nodeById.has(id)) errors.push(`节点 Id 重复：${id}`);
      nodeById.set(id, node);
    }
  });

  lines.forEach((line, index) => {
    const id = getString(line, 'Id', 'id', 'LineId', 'lineId') || `(index ${index})`;
    const fromNodeId = getString(line, 'FromNodeId', 'fromNodeId');
    const toNodeId = getString(line, 'ToNodeId', 'toNodeId');
    if (!fromNodeId) errors.push(`Lines[${index}].FromNodeId 不能为空`);
    if (!toNodeId) errors.push(`Lines[${index}].ToNodeId 不能为空`);
    if (fromNodeId && !nodeById.has(fromNodeId)) errors.push(`连线 ${id} 的 FromNodeId 不存在：${fromNodeId}`);
    if (toNodeId && !nodeById.has(toNodeId)) errors.push(`连线 ${id} 的 ToNodeId 不存在：${toNodeId}`);
    if (fromNodeId === toNodeId && fromNodeId) warnings.push(`连线 ${id} 指向自身，请确认是否为有意循环`);
    if (fromNodeId) outgoing.set(fromNodeId, [...(outgoing.get(fromNodeId) || []), line]);
    if (toNodeId) incoming.set(toNodeId, [...(incoming.get(toNodeId) || []), line]);
  });

  const startNodes = nodes.filter(isStartNode);
  const endNodes = nodes.filter(isEndNode);
  if (startNodes.length !== 1) errors.push(`需要且仅需要 1 个开始节点，当前 ${startNodes.length} 个`);
  if (endNodes.length < 1) errors.push('至少需要 1 个结束节点');

  nodes.forEach((node) => {
    const id = getNodeId(node);
    const name = getNodeName(node) || id;
    if (!id) return;
    const outLines = outgoing.get(id) || [];
    const inLines = incoming.get(id) || [];
    if (!isStartNode(node) && inLines.length === 0) warnings.push(`节点 ${name} 没有入线`);
    if (!isEndNode(node) && outLines.length === 0) warnings.push(`节点 ${name} 没有出线`);
    if (outLines.length > 1) {
      const conditionCode = getString(node, 'LineValueV8', 'lineValueV8', 'V8Code', 'v8Code');
      if (!conditionCode) warnings.push(`节点 ${name} 有 ${outLines.length} 条出线，建议配置 LineValueV8，并优先用 V8.NextNodeId 指定下一节点`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      flowName,
      tableId: flowTableId,
      table: flowTableRef,
      nodeCount: nodes.length,
      lineCount: lines.length,
      startNodes: startNodes.map((node) => ({ id: getNodeId(node), name: getNodeName(node) })),
      endNodes: endNodes.map((node) => ({ id: getNodeId(node), name: getNodeName(node) })),
    },
  };
}

function extractWorkflowVisualConfig(code: string): JsonRecord | null {
  const beginIndex = code.indexOf(WF_MARKER_BEGIN);
  if (beginIndex < 0) return null;
  const jsonStart = beginIndex + WF_MARKER_BEGIN.length;
  const endIndex = code.indexOf(WF_MARKER_END, jsonStart);
  if (endIndex < 0) return null;
  try {
    return asRecord(JSON.parse(code.slice(jsonStart, endIndex).trim()));
  } catch {
    return null;
  }
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

function compareWorkflowRule(rule: JsonRecord, formData: JsonRecord): boolean {
  const field = getString(rule, 'field', 'Field');
  const operator = getString(rule, 'operator', 'Operator') || 'eq';
  const expected = getValue(rule, 'value', 'Value');
  const actual = field ? formData[field] : undefined;
  const actualText = actual == null ? '' : String(actual);
  const expectedText = expected == null ? '' : String(expected);
  if (operator === 'empty') return isEmptyValue(actual);
  if (operator === 'notEmpty') return !isEmptyValue(actual);
  if (operator === 'contains') return actualText.includes(expectedText);
  if (operator === 'notContains') return !actualText.includes(expectedText);
  if (operator === 'startsWith') return actualText.startsWith(expectedText);
  if (operator === 'endsWith') return expectedText === '' || actualText.endsWith(expectedText);
  if (['gt', 'gte', 'lt', 'lte'].includes(operator)) {
    const left = Number(actual);
    const right = Number(expected);
    if (Number.isNaN(left) || Number.isNaN(right)) return false;
    if (operator === 'gt') return left > right;
    if (operator === 'gte') return left >= right;
    if (operator === 'lt') return left < right;
    return left <= right;
  }
  if (operator === 'ne') return actualText !== expectedText;
  return actualText === expectedText;
}

function testWorkflowVisualCondition(input: JsonRecord): JsonRecord {
  const workflow = asRecord(input.workflow);
  const formData = asRecord(input.formData);
  let code = getString(input, 'lineValueV8Code', 'LineValueV8', 'code');
  if (!code && Object.keys(workflow).length > 0) {
    const { nodes } = getWorkflowParts(workflow);
    const nodeId = getString(input, 'nodeId', 'NodeId');
    const node = (nodeId ? nodes.find((item) => getNodeId(item) === nodeId) : nodes.find(isStartNode) || nodes[0]) || {};
    code = getString(node, 'LineValueV8', 'lineValueV8', 'V8Code', 'v8Code');
  }
  const config = extractWorkflowVisualConfig(code);
  const routes = getArray(config || {}, 'routes', 'Routes');
  if (!config || routes.length === 0) {
    return { ok: false, selectedRoute: null, warnings: ['未找到图形条件标记，MCP 不执行任意手写 V8；请用图形条件生成 LineValueV8 后再测试。'] };
  }
  const defaultRoute = routes.find((route) => !!getValue(route, 'isDefault', 'IsDefault')) || null;
  for (const route of routes) {
    if (route === defaultRoute) continue;
    const rules = getArray(route, 'rules', 'Rules').filter((rule) => getString(rule, 'field', 'Field'));
    if (rules.length === 0) continue;
    const match = getString(route, 'match', 'Match') === 'any'
      ? rules.some((rule) => compareWorkflowRule(rule, formData))
      : rules.every((rule) => compareWorkflowRule(rule, formData));
    if (match) {
      return { ok: true, selectedRoute: route, assignment: buildWorkflowAssignment(route), source: 'matched' };
    }
  }
  return { ok: !!defaultRoute, selectedRoute: defaultRoute, assignment: defaultRoute ? buildWorkflowAssignment(defaultRoute) : null, source: defaultRoute ? 'default' : 'none' };
}

function buildWorkflowAssignment(route: JsonRecord): JsonRecord {
  const lineValue = getString(route, 'lineValue', 'LineValue');
  const toNodeId = getString(route, 'toNodeId', 'ToNodeId');
  return lineValue ? { LineValue: lineValue } : { NextNodeId: toNodeId };
}

function workflowPayload(workflow: JsonRecord, tableIdByName: Map<string, string>): JsonRecord {
  const { flow, nodes, lines } = getWorkflowParts(workflow);
  const nextFlow = { ...flow };
  const tableRef = getString(flow, 'table', 'tableName', 'TableName', 'diyTableName', 'DiyTableName');
  if (!getString(nextFlow, 'TableId', 'tableId') && tableRef) {
    const resolvedTableId = tableIdByName.get(tableRef.toLowerCase());
    if (resolvedTableId) nextFlow.TableId = resolvedTableId;
  }
  const nodeNameById = new Map<string, string>();
  const nextNodes = nodes.map((node, index) => {
    const id = getNodeId(node) || `wf_node_${index + 1}_${randomId().slice(0, 8)}`;
    const nextNode = { ...node, Id: id };
    const name = getNodeName(nextNode);
    if (name) nodeNameById.set(id, name);
    return nextNode;
  });
  const nextLines = lines.map((line, index) => {
    const fromNodeId = getString(line, 'FromNodeId', 'fromNodeId');
    const toNodeId = getString(line, 'ToNodeId', 'toNodeId');
    const lineName = getString(line, 'LineName', 'lineName') || `${nodeNameById.get(fromNodeId) || fromNodeId || '当前节点'} 到 ${nodeNameById.get(toNodeId) || toNodeId || '下一节点'}`;
    return { ...line, Id: getString(line, 'Id', 'id', 'LineId', 'lineId') || `wf_line_${index + 1}_${randomId().slice(0, 8)}`, LineName: lineName };
  });
  return { FlowDesign: nextFlow, Nodes: nextNodes, Lines: nextLines };
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

function modulePayload(module: JsonRecord, tableIdByName: Map<string, string>, moduleIdByName?: Map<string, string>, fieldLookup?: FieldLookup): JsonRecord {
  const tableRef = getString(module, 'table', 'tableName', 'diyTableName', 'DiyTableName');
  const normalized = normalizeAllMenuJson(module);
  if (normalized.errors.length) throw new Error(normalized.errors.join('\n'));
  const diyTableId = getString(module, 'diyTableId', 'DiyTableId') || (tableRef ? tableIdByName.get(tableRef.toLowerCase()) : '');
  const tableName = tableRef || getString(module, 'DiyTableName', 'diyTableName');
  const resolvedFields = fieldLookup ? resolveModuleFields(module, fieldLookup, diyTableId || '', tableName) : {};
  const payload = compactObject({
    ...normalized.data,
    ...resolvedFields,
    Name: getString(module, 'name', 'Name'),
    DiyTableId: diyTableId,
    ParentId: getString(module, 'parentId', 'ParentId') || (moduleIdByName ? moduleIdByName.get(getString(module, 'parentName', 'ParentName').toLowerCase()) : undefined),
    ComponentName: getString(module, 'componentName', 'ComponentName'),
    ComponentPath: getString(module, 'componentPath', 'ComponentPath'),
    Display: getNumber(module, 'display', 'Display') ?? 1,
    AppDisplay: getNumber(module, 'appDisplay', 'AppDisplay') ?? 1,
    OpenType: getString(module, 'openType', 'OpenType'),
    Url: getString(module, 'url', 'Url'),
    Sort: getNumber(module, 'sort', 'Sort'),
    Icon: getString(module, 'icon', 'Icon'),
    SearchFieldIds: getExplicitJsonString(module, 'searchFieldIds', 'SearchFieldIds') || resolvedFields.SearchFieldIds,
    TableDiyFieldIds: getExplicitJsonString(module, 'tableDiyFieldIds', 'TableDiyFieldIds') || resolvedFields.TableDiyFieldIds,
    SelectFields: getExplicitJsonString(module, 'selectFields', 'SelectFields') || resolvedFields.SelectFields,
    DefaultOrderBy: getExplicitJsonString(module, 'DefaultOrderBy') || resolvedFields.DefaultOrderBy,
    SqlWhere: getString(module, 'sqlWhere', 'SqlWhere'),
    SqlJoin: getString(module, 'sqlJoin', 'SqlJoin'),
    JoinTables: getExplicitJsonString(module, 'joinTables', 'JoinTables'),
    SortFieldIds: getExplicitJsonString(module, 'sortFieldIds', 'SortFieldIds') || resolvedFields.SortFieldIds,
    NotShowFields: getExplicitJsonString(module, 'notShowFields', 'NotShowFields') || resolvedFields.NotShowFields,
    StatisticsFields: getExplicitJsonString(module, 'statisticsFields', 'StatisticsFields') || resolvedFields.StatisticsFields,
    InTableEdit: getNumber(module, 'inTableEdit', 'InTableEdit'),
    InTableEditFields: getExplicitJsonString(module, 'inTableEditFields', 'InTableEditFields') || resolvedFields.InTableEditFields,
    MobileListFields: getExplicitJsonString(module, 'mobileListFields', 'MobileListFields') || resolvedFields.MobileListFields,
    CardTitleTagFields: getExplicitJsonString(module, 'cardTitleTagFields', 'CardTitleTagFields') || resolvedFields.CardTitleTagFields,
    CardBottomTagFields: getExplicitJsonString(module, 'cardBottomTagFields', 'CardBottomTagFields') || resolvedFields.CardBottomTagFields,
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
  const page = normalizePrintPageObj(template.PageObj ?? template.pageObj);
  if (!page.ok || !page.json) throw new Error(`printTemplates.${getString(template, 'Title', 'title') || '(untitled)'} PageObj invalid: ${page.errors.join('; ')}`);
  const printObj = normalizePrintObj(template.PrintObj ?? template.printObj);
  if (!printObj.ok || !printObj.json) throw new Error(`printTemplates.${getString(template, 'Title', 'title') || '(untitled)'} PrintObj invalid: ${printObj.errors.join('; ')}`);
  return compactObject({
    ...template,
    Id: getString(template, 'Id', 'printId', 'PrintId') || undefined,
    Title: getString(template, 'Title', 'title'),
    Number: getString(template, 'Number', 'number'),
    Desc: getString(template, 'Desc', 'desc', 'description'),
    DataApi: getString(template, 'DataApi', 'dataApi'),
    PageObj: page.json,
    PrintObj: printObj.json,
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

function manifestGuide(osClient: string | undefined): JsonRecord {
  const confirmTarget = osClient || 'EXECUTE';
  return {
    osClient,
    workflow: [
      'Call microi_get_db_schema first to inspect existing tables.',
      'Call microi_get_manifest_schema to draft a manifest from the user requirement.',
      'Call microi_plan_system with the manifest and fix all errors.',
      'Call microi_generate_system with dryRun=true.',
      `Call microi_generate_system with dryRun=false and confirmExecution="${confirmTarget}" only after the user confirms writes.`,
      'Call microi_validate_system after generation if you need an independent validation pass.',
    ],
    manifestShape: {
      name: 'System name',
      roles: [{ name: 'Admin', level: 999 }],
      tables: [{
        name: 'Biz_Order',
        description: 'Order main table',
        tabs: [{ Id: 'basic', Name: 'Basic Info', Sort: 10 }, { Id: 'business', Name: 'Business Info', Sort: 20 }],
        fields: [
          { name: 'OrderNo', label: 'Order No', type: 'varchar(50)', component: 'AutoNumber', tab: 'basic', configSource: { sourceType: 'AutoNumber', prefix: 'ORD', length: 6 }, notEmpty: 1, unique: 1, tableWidth: 160, sort: 10 },
          { name: 'CustomerName', label: 'Customer', type: 'varchar(100)', component: 'Text', tab: 'basic', notEmpty: 1, tableWidth: 160, sort: 20 },
          { name: 'Status', label: 'Status', type: 'varchar(50)', component: 'Select', tab: 'business', configSource: { sourceType: 'KeyValue', items: [{ Key: 'Draft', Value: 'Draft' }, { Key: 'Submitted', Value: 'Submitted' }] }, sort: 30 },
        ],
      }],
      engines: [{ apiEngineKey: 'biz_order_submit', apiName: 'Submit order', category: 'Biz_Order', code: "return { Code: 1, Data: V8.Param };" }],
      events: [{ formEngineKey: 'Biz_Order', eventType: 'SubmitBeforeServerV8', code: "if (!V8.Form.OrderNo) return { Code: 0, Msg: 'OrderNo required' };" }],
      modules: [{
        name: 'Orders',
        table: 'Biz_Order',
        icon: 'Document',
        listFields: ['OrderNo', 'CustomerName', 'Status', 'CreateTime'],
        searchFields: ['OrderNo', 'CustomerName', 'Status'],
        sortFields: ['CreateTime'],
        defaultOrderBy: [{ field: 'CreateTime', type: 'DESC' }],
        moreBtns: [{ Name: 'Submit', BtnStyle: 'primary', V8CodeShow: "V8.Result=V8.Form.Status=='Draft';", V8Code: "var r=await V8.ApiEngine.Run({ApiEngineKey:'biz_order_submit',Id:V8.Form.Id});V8.Result=r;" }],
      }],
      permissions: [{ roleId: 'admin', moduleNames: ['Orders'] }],
      dataSources: [],
      pages: [{
        title: 'Operations Dashboard',
        number: 'page_operations_dashboard',
        routePath: '/page/operations-dashboard',
        JsonObj: {
          formConfig: { gutter: 0, mask: false, drag: false, hover: false, shadow: true, link: true, dark: false, dynamicStyle: { padding: '12px 0 0 0', backgroundColor: '#f3f4f6', opacity: 1 } },
          wrapperList: [
            { type: 'pannel', label: 'Card', wrapperOption: { span: 24, height: 180, titleOption: { hidden: true, title: 'Core Metrics' } }, widgetList: [] },
          ],
        },
      }],
      printTemplates: [{
        title: 'Business Print Template',
        number: 'print_business_template',
        PageObj: {
          panels: [
            { index: 0, name: 'A4 Template', paperType: 'A4', height: 297, width: 210, paperHeader: 0, paperFooter: 841.8897637795277, printElements: [] },
          ],
        },
        PrintObj: {},
      }],
      workflows: [{
        FlowDesign: { FlowName: 'Order approval', TableId: '<Biz_Order table id or tableName-resolved id>', IsEnable: 1 },
        Nodes: [
          { Id: 'start', NodeName: '发起人', NodeType: 'Start', AllowSelectUsers: 0, PositionLeft: 80, PositionTop: 160, LineValueV8: '' },
          { Id: 'manager', NodeName: '部门经理审批', NodeType: 'Approve', Roles: 'Manager', AllowSelectUsers: 1, PositionLeft: 320, PositionTop: 160 },
          { Id: 'end', NodeName: '结束', NodeType: 'End', PositionLeft: 560, PositionTop: 160 },
        ],
        Lines: [
          { Id: 'line_start_manager', FromNodeId: 'start', ToNodeId: 'manager', LineName: '发起人 到 部门经理审批', LineValue: '' },
          { Id: 'line_manager_end', FromNodeId: 'manager', ToNodeId: 'end', LineName: '部门经理审批 到 结束', LineValue: '' },
        ],
      }],
      jobs: [],
    },
    naturalFieldKeys: {
      tables: {
        tabs: 'diy_table.Tabs form groups. When omitted and the table has more than 12 business fields, generator creates Basic/Contact/Business/Attachment/Extra tabs and assigns empty field tab values.',
        column: 'Form column count. Omit to use 2 columns for generated systems unless the user asks for a single-column form.',
      },
      fields: {
        component: 'Use the real Microi component name. Available controls include Text, Textarea, NumberText, DateTime, Select, MultipleSelect, Radio, Checkbox, Switch, Rate, Progress, Slider, ColorPicker, AutoNumber, Divider, CollapseGroup, Tabs, Alert, StaticText, Html, RichText, CodeEditor, JsonTable, ImgUpload, FileUpload, Autocomplete, TagInput, Transfer, Cascader, Address, Department, SelectTree, TreeCheckbox, OpenTable, JoinTable, JoinForm, TableChild, Map, MapArea, Qrcode, FontAwesome, DevComponent.',
        tab: 'Assign a field to a diy_table.Tabs Id/Name. For many fields, prefer table-level Tabs; use CollapseGroup or field component Tabs only when an in-page section needs collapsible or nested grouping.',
      },
      modules: {
        table: 'Bind by table name. The generator resolves the table Id after create/refresh schema.',
        listFields: 'Field names/labels/ids for grid columns. Produces TableDiyFieldIds and SelectFields. When omitted, generator chooses title/no/status/person/amount/time fields.',
        searchFields: 'Field names/labels/ids for search controls. Produces SearchFieldIds object array. When omitted, generator chooses title/no/status/type/category/person/time fields.',
        sortFields: 'Field names/labels/ids for sortable fields. Produces SortFieldIds. When omitted, generator chooses date/time, Sort and numeric business fields.',
        hiddenFields: 'Field names/labels/ids to hide. Produces NotShowFields. When omitted, generator hides Id-like fields, foreign keys, system fields and layout/large controls.',
        editableFields: 'Field names/labels/ids for in-table editing. Produces InTableEditFields.',
        mobileFields: 'Field names/labels/ids for mobile card list. Produces MobileListFields. When omitted, generator picks 3-4 compact title/status/summary fields.',
        cardTitleFields: 'Field names/labels/ids for card title tags. Produces CardTitleTagFields. When omitted, generator picks status/type/category fields.',
        cardBottomFields: 'Field names/labels/ids for card bottom tags. Produces CardBottomTagFields. When omitted, generator picks amount/count/date fields.',
        statisticsFields: 'Field names/labels/ids for table footer statistics. When omitted, generator sums amount/price/count/point/balance numeric fields.',
      },
    },
    rules: [
      'Use table and field names in manifests; do not ask the user for diy_field ids.',
      'Put business logic in API engines and call them from menu button V8Code.',
      'For workflow manifests, include exactly one start node, at least one end node, valid FromNodeId/ToNodeId lines, and stable LineName values in the form "{from node} 到 {to node}".',
      'For multi-route workflow nodes, generate LineValueV8 with the visual condition marker and prefer assigning V8.NextNodeId; then call microi_check_workflow_package and microi_test_workflow_condition before microi_save_workflow_package.',
      'Use parameterized V8.Db SQL or V8.FormEngine CRUD in engine/event code.',
      'Leave diy_field.FormWidth null/omitted for normal fields; use formWidth: 24 only for full-row controls such as CodeEditor, Textarea, RichText, upload, TableChild, map/layout/custom components.',
      'Do not leave sys_menu list configuration empty. If the user does not specify it, rely on the generator defaults for NotShowFields, SearchFieldIds, SortFieldIds, StatisticsFields, MobileListFields, CardTitleTagFields and CardBottomTagFields.',
      'For forms with many fields, use diy_table.Tabs first. Use CollapseGroup for optional/secondary sections and field component Tabs for nested in-page grouping.',
      'Use dryRun=true until the user explicitly asks to write.',
      'For Page Engine pages, save only the JsonObj layer to mic_page.JsonObj: {formConfig, wrapperList}. Do not wrap it in formData.',
      'For Print Engine templates, PageObj must be a hiprint object with panels[].printElements; PrintObj is sample/runtime data.',
      'For natural-language UI or print design, prefer microi_build_page_design or microi_build_print_template_design, then save after confirmation.',
    ],
  };
}

export function registerAdvancedTools(server: McpServer, client: MicroiClient, context: McpServerContext): void {
  const osClient = context.osClient;
  const systemConfirmTarget = osClient || 'EXECUTE';

  server.tool(
    'microi_get_manifest_schema',
    'Return the recommended full-system manifest schema for natural-language Microi generation, including field-name based module configuration.',
    {},
    async () => textResult(JSON.stringify(manifestGuide(osClient), null, 2)),
  );

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
    'microi_check_workflow_package',
    'Validate a wf_flowdesign + wf_node + wf_line workflow package locally before saving. Checks topology, node ids, line endpoints, start/end nodes and multi-route condition setup.',
    { workflow: jsonRecordSchema.describe('Workflow package with FlowDesign, Nodes and Lines') },
    async ({ workflow }) => {
      const check = validateWorkflowPackage(workflow);
      return textResult(JSON.stringify(check, null, 2), !check.ok);
    },
  );

  server.tool(
    'microi_test_workflow_condition',
    'Test a workflow LineValueV8 generated by the visual condition designer against sample formData. For safety this only evaluates Microi visual-condition marker JSON, not arbitrary hand-written V8.',
    {
      workflow: jsonRecordSchema.optional().describe('Optional workflow package; when provided the tool reads the selected node LineValueV8'),
      nodeId: z.string().optional().describe('Node Id whose LineValueV8 should be tested. If omitted, uses the start node or first node.'),
      lineValueV8Code: z.string().optional().describe('Direct LineValueV8 JavaScript code containing MICROI_WF_LINE_CONDITION_JSON marker'),
      formData: jsonRecordSchema.optional().describe('Sample business form data used for rule evaluation'),
    },
    async (input) => textResult(JSON.stringify(testWorkflowVisualCondition(input as JsonRecord), null, 2)),
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
    `Generate a complete Microi low-code system from a manifest. Supports dryRun execution plans and post-generation validation. Writes require confirmExecution="${systemConfirmTarget}". OsClient: ${osClient}`,
    {
      manifest: jsonRecordSchema.describe('System manifest with tables, fields, dataSources, engines, events, modules, permissions, pages, printTemplates, workflows and jobs'),
      dryRun: z.boolean().optional().describe('Default true. When true, only returns an execution plan.'),
      confirmExecution: z.string().optional().describe(`Required when dryRun=false. Must equal "${systemConfirmTarget}".`),
    },
    async ({ manifest, dryRun = true, confirmExecution }) => {
      const plan = buildPlan(manifest);
      if (plan.errors.length > 0) return textResult(JSON.stringify({ ok: false, ...plan }, null, 2), true);
      if (dryRun) return textResult(JSON.stringify({ ok: true, dryRun: true, ...plan }, null, 2));
      if (confirmExecution !== systemConfirmTarget) {
        return textResult(`写入已拦截：请重新调用并传 confirmExecution="${systemConfirmTarget}"。\n\n${JSON.stringify({ plan: plan.plan, warnings: plan.warnings }, null, 2)}`, true);
      }

      const results: JsonRecord[] = [];
      const tableIdByName = new Map<string, string>();
      const moduleIdByName = new Map<string, string>();
      const roleIdByName = new Map<string, string>();
      const fieldLookup = createFieldLookup();
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
          const tableLayout = buildDefaultTableLayout(table);
          const response = await client.createTable(tableName, getString(table, 'description', 'Description'), {
            Tabs: stringifyConfig(table.tabs ?? table.Tabs ?? tableLayout.tabs),
            IsTree: getNumber(table, 'isTree', 'IsTree'),
            Column: getNumber(table, 'column', 'Column') ?? tableLayout.column ?? 2,
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
              Visible: getNumber(field, 'visible', 'Visible') ?? 1,
              AppVisible: getNumber(field, 'appVisible', 'AppVisible') ?? 1,
              Tab: getString(field, 'tab', 'Tab') || tableLayout.fieldTabs.get(getString(field, 'name', 'Name')),
              TableWidth: getNumber(field, 'tableWidth', 'TableWidth'),
              Sort: getNumber(field, 'sort', 'Sort'),
              Readonly: getNumber(field, 'readonly', 'Readonly'),
              NotEmpty: getNumber(field, 'notEmpty', 'NotEmpty'),
              Unique: getNumber(field, 'unique', 'Unique'),
              DefaultValue: getString(field, 'defaultValue', 'DefaultValue'),
              Placeholder: getString(field, 'placeholder', 'Placeholder'),
              FormWidth: getNumber(field, 'formWidth', 'FormWidth'),
              Data: generatedConfig?.data ?? getString(field, 'data', 'Data'),
              Config: generatedConfig ? JSON.stringify(generatedConfig.config) : stringifyConfig(field.config ?? field.Config),
              Description: getString(field, 'description', 'Description'),
              Encrypt: getNumber(field, 'encrypt', 'Encrypt'),
              InTableEdit: getNumber(field, 'inTableEdit', 'InTableEdit'),
            }) as Parameters<MicroiClient['addField']>[0];
            const addResponse = await client.addField(fieldPayload);
            results.push({ step: 'addField', tableName, fieldName: getString(field, 'name', 'Name'), response: addResponse });
            if (addResponse.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'addField', tableName, field, response: addResponse, results }, null, 2), true);
            const fieldId = getString(asRecord(addResponse.Data), 'FieldId', 'Id');
            const fieldName = getString(fieldPayload, 'Name');
            if (fieldId && fieldName) {
              addFieldMeta(fieldLookup, {
                id: fieldId,
                name: fieldName,
                label: getString(fieldPayload, 'Label') || fieldName,
                tableId,
                tableName,
                tableDescription: getString(table, 'description', 'Description') || tableName,
                component: getString(fieldPayload, 'Component') || 'Text',
                type: getString(fieldPayload, 'Type') || 'varchar(255)',
              });
            }
          }
        }

        const schemaResponse = await client.getDbSchema();
        results.push({ step: 'refreshDbSchema', response: { Code: schemaResponse.Code, Msg: schemaResponse.Msg, Summary: asRecord(asRecord(schemaResponse.Data).Summary) } });
        if (schemaResponse.Code === 1) {
          populateFieldLookupFromSchema(fieldLookup, schemaResponse.Data, tableIdByName);
        } else {
          plan.warnings.push(`Could not refresh schema before module field resolution: ${schemaResponse.Msg || schemaResponse.Code}`);
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
          const payload = modulePayload(module, tableIdByName, moduleIdByName, fieldLookup) as Parameters<MicroiClient['createModule']>[0];
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
          const normalizedPage = normalizePageJsonObj(page.json ?? page.JsonObj ?? page.JsonStr ?? page);
          if (!normalizedPage.ok || !normalizedPage.json) {
            return textResult(JSON.stringify({ ok: false, failedAt: 'savePage:normalize', page, errors: normalizedPage.errors, warnings: normalizedPage.warnings, results }, null, 2), true);
          }
          const response = await client.savePageEngine({
            PageId: getString(page, 'pageId', 'PageId', 'Id') || undefined,
            Title: getString(page, 'title', 'Title'),
            Number: getString(page, 'number', 'Number') || undefined,
            Desc: getString(page, 'desc', 'Desc') || undefined,
            JsonStr: normalizedPage.json,
            RoutePath: getString(page, 'routePath', 'RoutePath') || undefined,
            ComponentPath: getString(page, 'componentPath', 'ComponentPath') || undefined,
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
          const payload = workflowPayload(workflow, tableIdByName);
          const response = await client.saveWorkflowPackage(payload);
          results.push({ step: 'saveWorkflowPackage', workflow: getString(asRecord(payload.FlowDesign ?? payload.flowDesign ?? payload), 'FlowName', 'flowName'), response });
          if (response.Code !== 1) return textResult(JSON.stringify({ ok: false, failedAt: 'saveWorkflowPackage', workflow: payload, response, results }, null, 2), true);
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
    const check = validateWorkflowPackage(workflow);
    if (!check.ok) return textResult(JSON.stringify(check, null, 2), true);
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
