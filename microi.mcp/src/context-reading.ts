import crypto from 'node:crypto';
import path from 'node:path';

type RecordValue = Record<string, any>;
export interface ReadPageOptions { pageSize?: number; cursor?: string; maxChars?: number }
export interface ContextReadScope { identity: () => string; key: Buffer }
export function createContextReadScope(identity: () => string): ContextReadScope {
  return { identity, key: crypto.randomBytes(32) };
}

/** 多次请求是一次读取：只允许首次未登录请求完成后绑定身份，之后变化必须丢弃整个结果。 */
export function createReadIdentityGuard(identity: () => string): () => void {
  let bound = identity();
  return () => {
    const current = identity();
    if (bound && current !== bound) throw new Error('读取期间登录身份或 Token 已变化，已丢弃混合结果；请重读。');
    if (!bound && current) bound = current;
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function hash(value: unknown): string { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }
function boundedInteger(value: unknown, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new Error(`${name} 必须为 ${min}–${max} 的整数。`);
  return Number(value);
}

/** 游标绑定连接、查询与快照，不能因翻页或续签混用另一个租户/版本；只保存摘要，不缓存正文或凭据。 */
export function readPage<T>(scope: ContextReadScope, query: unknown, items: T[], options: ReadPageOptions = {}) {
  const pageSize = boundedInteger(options.pageSize, 20, 1, 200, 'pageSize');
  const maxChars = boundedInteger(options.maxChars, 32_000, 1_000, 512_000, 'maxChars');
  const scopeHash = hash([scope.identity(), query]);
  const snapshotHash = hash(items);
  let offset = 0;
  if (options.cursor) {
    if (options.cursor.length > 1024) throw new Error('读取游标无效。');
    const [payload, signature, extra] = options.cursor.split('.');
    if (!payload || !signature || extra) throw new Error('读取游标无效。');
    const expected = crypto.createHmac('sha256', scope.key).update(payload).digest('base64url');
    if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) throw new Error('读取游标不属于当前连接，请从第一页重读。');
    let parsed: RecordValue;
    try { parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw new Error('读取游标无效。'); }
    if (parsed.scopeHash !== scopeHash || parsed.snapshotHash !== snapshotHash) throw new Error('连接、筛选或源码快照已变化，请从第一页重读。');
    offset = boundedInteger(parsed.offset, 0, 0, items.length, 'cursor.offset');
  }
  const selected: T[] = [];
  let chars = 2;
  for (const item of items.slice(offset, offset + pageSize)) {
    const size = JSON.stringify(item).length + (selected.length ? 1 : 0);
    if (chars + size > maxChars) {
      if (!selected.length) throw new Error(`单个读取项超过 maxChars=${maxChars}；请缩小文件/字段范围或显式提高预算（最高 512000）。未返回不完整项。`);
      break;
    }
    chars += size; selected.push(item);
  }
  const nextOffset = offset + selected.length;
  const hasMore = nextOffset < items.length;
  const payload = Buffer.from(JSON.stringify({ scopeHash, snapshotHash, offset: nextOffset })).toString('base64url');
  const nextCursor = hasMore ? `${payload}.${crypto.createHmac('sha256', scope.key).update(payload).digest('base64url')}` : null;
  return { items: selected, Paging: { returned: selected.length, totalMatched: items.length, offset, pageSize, maxChars, hasMore, nextCursor, snapshotHash, completeSelection: !hasMore && offset === 0 } };
}

export function record(value: unknown): RecordValue { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}; }
export function sortedRecords(value: unknown, key: (item: RecordValue) => string): RecordValue[] {
  return (Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as RecordValue[] : []).slice().sort((a, b) => key(a).localeCompare(key(b)));
}
export function exactNames(values: string[] | undefined): string[] { return [...new Set((values || []).map(value => value.toLowerCase()))].sort(); }

/** 摘要是有损视图，明示被省略字段；错误、权限与版本语义保留，完整元数据可显式 detail=full。 */
export function applicationSummary(value: unknown): RecordValue {
  const app = record(value);
  const keys = new Set(['Id', 'AppKey', 'AppId', 'AppName', 'Name', 'ApplicationType', 'AppType', 'Category', 'PublisherType', 'Status', 'BuildStatus', 'CurrentVersion', 'AppVersion', 'PreviewUrl', 'PublicPublishPath', 'PrivateSourcePath', 'OwnerUserId', 'OwnerName', 'CreateTime', 'UpdateTime']);
  const result: RecordValue = {};
  for (const [key, item] of Object.entries(app)) {
    if (keys.has(key) || /permission|error|^Code$|^Msg$|^Can(Read|Write|Edit|Delete)$|^Access(Allowed|Denied|Scope|State)$|^AuthorizationResult$/i.test(key)) result[key] = item;
  }
  const description = String(app.Description ?? app.AppDetail ?? '');
  result.Description = description.slice(0, 600);
  result.MetadataSummary = true;
  result.OmittedMetadataFields = Object.keys(app).filter(key => !(key in result) && key !== 'Description');
  result.DescriptionTruncated = description.length > 600;
  return result;
}

export function sourceFileMetadata(value: unknown): RecordValue {
  const { Content: _content, FileByteBase64: _base64, ContentBase64: _legacy, ...metadata } = record(value);
  return metadata;
}

const textExtensions = new Set(['.vue', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.md', '.txt', '.xml', '.yaml', '.yml', '.toml', '.ini', '.env', '.cs', '.csproj', '.sln', '.java', '.kt', '.go', '.py', '.php', '.rb', '.rs', '.sql', '.sh', '.ps1', '.bat', '.cmd']);
export function isTextSourceFile(file: RecordValue, filePath: string): boolean {
  const extension = path.posix.extname(String(file.FilePath || filePath));
  return file.ContentEncoding === 'utf-8' || !extension || textExtensions.has(extension.toLowerCase());
}

export function buildSchemaRead(scope: ContextReadScope, data: RecordValue, options: ReadPageOptions & { detail?: 'summary' | 'fields'; tableName?: string; tableNames?: string[]; fieldNames?: string[] }) {
  const names = exactNames(options.tableNames); const fieldNames = exactNames(options.fieldNames);
  const keyword = (options.tableName || '').toLowerCase(); const detail = options.detail || 'summary';
  const tables = sortedRecords(data.Tables, table => String(table.Name)).filter(table =>
    (!names.length || names.includes(String(table.Name).toLowerCase()))
    && (!keyword || `${table.Name} ${table.Description || ''}`.toLowerCase().includes(keyword)));
  const source = record(data.ReadSource);
  const rows: RecordValue[] = [];
  for (const table of tables) {
    const fields = sortedRecords(table._Fields || table.Fields, field => String(field.Name)).filter(field => !fieldNames.length || fieldNames.includes(String(field.Name).toLowerCase()));
    const metadata = { Id: table.Id, Name: table.Name, Description: table.Description || '' };
    if (detail === 'summary') rows.push({ ...metadata, FieldCount: source.fieldCountKnown === false ? null : fields.length });
    else if (fields.length) for (const field of fields) rows.push({ table: metadata, field });
    else rows.push({ table: metadata, field: null });
  }
  const page = readPage(scope, { action: 'schema', detail, names, fieldNames, keyword }, rows, options);
  const output: RecordValue[] = [];
  for (const row of page.items) {
    if (detail === 'summary') output.push(row);
    else {
      const existing = output.find(item => item.Id === row.table.Id);
      const table: RecordValue = existing ?? { ...row.table, Fields: [] };
      if (!existing) output.push(table);
      if (row.field) table.Fields.push(row.field);
    }
  }
  return {
    Tables: output, Paging: { ...page.Paging, unit: detail === 'summary' ? 'tables' : 'fields-or-empty-table' },
    Selection: { requestedTableNames: names, missingTableNames: names.filter(name => !tables.some(table => String(table.Name).toLowerCase() === name)), requestedFieldNames: fieldNames },
    Completeness: { detailsIncluded: detail === 'fields', allFieldsSelected: detail === 'fields' && fieldNames.length === 0, fieldDefinitionsComplete: false, omittedFieldProperties: ['Config', 'Data', 'KeyValue', 'events-and-other-control-properties'], nextFieldDefinitionRead: { action: 'microi_get_field_list', params: 'tableName or tableId from Tables' }, matchedTableCount: tables.length, scope: 'filtered-backend-snapshot', sourceCompleteness: source.tablesComplete === true ? 'verified-by-DataCount' : 'not-reported-by-backend', fieldFilterApplied: fieldNames.length > 0 },
    ReadSource: Object.keys(source).length ? source : { mode: 'legacy-full-schema-local-projection', fieldsIncluded: true, tablesComplete: null },
  };
}

export interface SourceReadOptions extends ReadPageOptions { detail?: 'text' | 'metadata' | 'full'; startLine?: number; endLine?: number; query?: string; caseSensitive?: boolean }
export function buildSourceRead(scope: ContextReadScope, appIdOrKey: string, filePath: string, data: RecordValue, options: SourceReadOptions) {
  const file = record(data.File);
  const metadata = sourceFileMetadata(file);
  const common = { ...data, Application: applicationSummary(data.Application), File: metadata };
  const full = options.detail === 'full';
  if (file.ContentReadError || file.ContentSkipped) return { ...common, ReadSummary: { completeFile: false, contentError: true }, ContentErrorCount: 1 };
  if (full) return { ...common, File: file, ReadSummary: { completeFile: typeof file.Content === 'string' || typeof file.FileByteBase64 === 'string', explicitlyRequestedFull: true } };
  if (options.detail === 'metadata' || typeof file.Content !== 'string') return {
    ...common, FileReference: { appIdOrKey, filePath, next: { action: 'microi_get_application_file', params: { appIdOrKey, filePath, detail: 'full' } } },
    ReadSummary: { completeFile: false, contentsIncluded: false, reason: options.detail === 'metadata' ? 'metadata-requested' : 'binary-or-content-unavailable' },
  };
  const lines = file.Content.split(/\r\n|\r|\n/);
  const lineEndings = file.Content.match(/\r\n|\r|\n/g) || [];
  const startLine = boundedInteger(options.startLine, 1, 1, Math.max(lines.length, 1), 'startLine');
  const endLine = boundedInteger(options.endLine, lines.length, startLine, lines.length, 'endLine');
  const query = options.query;
  if (query !== undefined && (!query || query.length > 1000)) throw new Error('query 必须包含 1–1000 个字符，按纯文本搜索。');
  const needle = options.caseSensitive ? query : query?.toLowerCase();
  const rows: Array<{ line: number; text: string }> = [];
  for (let index = startLine - 1; index < endLine; index++) {
    if (!needle || (options.caseSensitive ? lines[index] : lines[index].toLowerCase()).includes(needle)) rows.push({ line: index + 1, text: lines[index] });
  }
  const page = readPage(scope, { action: 'file', appIdOrKey, filePath, startLine, endLine, query, caseSensitive: !!options.caseSensitive, sourceHash: hash(file.Content) }, rows, { ...options, pageSize: options.pageSize ?? 200, maxChars: options.maxChars ?? 16_000 });
  // 范围返回保留原行尾；分页末尾边界单独返回，完整单页与原文件的字节哈希一致。
  const returnedContent = page.items.map((row, index) => row.text + (index < page.items.length - 1 ? lineEndings[row.line - 1] || '' : '')).join('');
  return {
    ...common, File: { ...metadata, ...(query === undefined ? { Content: returnedContent } : {}) },
    ...(query !== undefined ? { Matches: page.items } : {}), Paging: page.Paging,
    ReadSummary: { completeFile: query === undefined && startLine === 1 && endLine === lines.length && page.Paging.completeSelection, sourceSha256: crypto.createHash('sha256').update(file.Content, 'utf8').digest('hex'), returnedContentSha256: query === undefined ? crypto.createHash('sha256').update(returnedContent, 'utf8').digest('hex') : null, lineEndingsNormalized: false, followingLineEnding: page.items.length ? lineEndings[page.items.at(-1)!.line - 1] || '' : '', totalLines: lines.length, requestedStartLine: startLine, requestedEndLine: endLine, returnedStartLine: page.items[0]?.line ?? null, returnedEndLine: page.items.at(-1)?.line ?? null, searchOnly: query !== undefined, contentError: false },
  };
}
