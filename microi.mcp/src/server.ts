import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { ApiResponse, MicroiClient, DbTable, DbField, PlaywrightContextData, PlaywrightEngineInfo, PlaywrightModuleInfo } from './microi-client.js';
import { normalizeAllMenuJson, normalizeViewSchemaJson, registerAdvancedTools } from './advanced-tools.js';
import { registerBlueprintTools } from './blueprint-tools.js';
import { registerDesignTools } from './design-tools.js';
import { normalizePageJsonObj } from './design-engine.js';
import {
  buildVueMicroServiceScaffoldPlan,
  resolveMicroiSdkSource,
  scaffoldVueMicroService,
} from './microservice-scaffold.js';

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

export interface LocalApplicationAsset {
  absolutePath: string;
  relativePath: string;
  size: number;
  sha256: string;
  isEntry: boolean;
}

export interface LocalApplicationAssetManifest {
  rootDirectory: string;
  entryPath: string;
  assets: LocalApplicationAsset[];
  totalSize: number;
  manifestHash: string;
  skippedSourceMaps: string[];
}

const FORBIDDEN_APPLICATION_ASSET_DIRECTORIES = new Set(['.git', '.svn', '.hg', 'node_modules']);
const FORBIDDEN_APPLICATION_ASSET_FILES = [
  /^\.env(?:\.|$)/iu,
  /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:\.|$)/iu,
  /\.(?:pem|key|pfx|p12|jks|keystore)$/iu,
];

function normalizeLocalApplicationRelativePath(value: string): string {
  const normalized = String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
  const segments = normalized.split('/');
  if (!normalized
    || normalized.startsWith('/')
    || normalized.includes('//')
    || normalized.includes(':')
    || segments.some(segment => !segment || segment === '.' || segment === '..')
    || /[\u0000-\u001f\u007f<>"|?*]/u.test(normalized)) {
    throw new Error(`应用资产相对路径不合法：${value}`);
  }
  if (['versions', 'latest', '.microi-integrity'].includes(segments[0].toLowerCase())) {
    throw new Error(`应用资产占用了发布器保留目录：${value}`);
  }
  return normalized;
}

async function sha256LocalFile(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

/**
 * Inspect and hash a built directory without loading any file wholly into RAM.
 * The hard caps also stop accidental node_modules/.git/trash-directory loops.
 */
export async function buildLocalApplicationAssetManifest(
  rootDirectory: string,
  entryPath = 'index.html',
  options: { includeSourceMaps?: boolean; maxFiles?: number; maxTotalBytes?: number } = {},
): Promise<LocalApplicationAssetManifest> {
  const root = path.resolve(rootDirectory);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`发布根目录必须是真实目录且不能是符号链接：${root}`);
  }
  const rootRealPath = fs.realpathSync(root);
  const normalizedEntry = normalizeLocalApplicationRelativePath(entryPath);
  const maxFiles = Math.min(20_000, Math.max(1, options.maxFiles ?? 20_000));
  const maxTotalBytes = Math.min(20 * 1024 * 1024 * 1024, Math.max(1, options.maxTotalBytes ?? 20 * 1024 * 1024 * 1024));
  const pending = [rootRealPath];
  const files: Array<{ absolutePath: string; relativePath: string; size: number }> = [];
  const skippedSourceMaps: string[] = [];
  let totalSize = 0;

  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, item.name);
      const itemStat = fs.lstatSync(absolutePath);
      if (itemStat.isSymbolicLink()) throw new Error(`发布目录不允许符号链接：${absolutePath}`);
      const relativePath = normalizeLocalApplicationRelativePath(path.relative(rootRealPath, absolutePath));
      const resolvedRealPath = fs.realpathSync(absolutePath);
      if (resolvedRealPath !== rootRealPath && !resolvedRealPath.startsWith(rootRealPath + path.sep)) {
        throw new Error(`发布资产越过了根目录：${absolutePath}`);
      }
      if (itemStat.isDirectory()) {
        if (FORBIDDEN_APPLICATION_ASSET_DIRECTORIES.has(item.name.toLowerCase())) {
          throw new Error(`发布目录包含禁止上传的目录 ${item.name}；请传入真实编译输出目录，而不是项目根目录。`);
        }
        pending.push(absolutePath);
        continue;
      }
      if (!itemStat.isFile()) throw new Error(`发布目录包含非普通文件：${absolutePath}`);
      if (FORBIDDEN_APPLICATION_ASSET_FILES.some(pattern => pattern.test(item.name))) {
        throw new Error(`发布目录疑似包含密钥或环境配置，已拒绝上传：${relativePath}`);
      }
      if (!options.includeSourceMaps && relativePath.toLowerCase().endsWith('.map')) {
        skippedSourceMaps.push(relativePath);
        continue;
      }
      files.push({ absolutePath, relativePath, size: itemStat.size });
      totalSize += itemStat.size;
      if (files.length > maxFiles) throw new Error(`发布文件超过上限 ${maxFiles}，请检查是否误选项目根目录或产生垃圾文件。`);
      if (totalSize > maxTotalBytes) throw new Error(`发布总大小超过上限 ${maxTotalBytes} bytes，已在上传前中止。`);
    }
  }
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  if (!files.some(file => file.relativePath.toLowerCase() === normalizedEntry.toLowerCase())) {
    throw new Error(`发布目录缺少入口文件：${normalizedEntry}`);
  }

  const assets: LocalApplicationAsset[] = [];
  for (const file of files) {
    assets.push({
      ...file,
      sha256: await sha256LocalFile(file.absolutePath),
      isEntry: file.relativePath.toLowerCase() === normalizedEntry.toLowerCase(),
    });
  }
  const manifestHash = crypto.createHash('sha256')
    .update(assets.map(asset => `${asset.relativePath}\t${asset.sha256}\t${asset.size}`).join('\n'))
    .digest('hex');
  return { rootDirectory: rootRealPath, entryPath: normalizedEntry, assets, totalSize, manifestHash, skippedSourceMaps };
}

const LEGACY_STREAM_COMPATIBILITY_MAX_FILES = 256;
const LEGACY_STREAM_COMPATIBILITY_MAX_BYTES = 5 * 1024 * 1024;

export interface LegacyStreamPublishFallbackResult {
  attempted: boolean;
  reason: string;
  appKey?: string;
  response?: ApiResponse;
}

/**
 * A short-lived compatibility detector for API nodes that predate the strongly
 * typed HDFS selector fix. Those nodes fail before writing the first asset when
 * the dynamic runtime tries to invoke Dos.Common.Val<T> on a JValue.
 */
export function isLegacyApplicationStreamJValueFailure(result?: Partial<ApiResponse> | null): boolean {
  if (!result || Number(result.Code) === 1) return false;
  const message = String(result.Msg || '');
  return /Newtonsoft\.Json\.Linq\.JValue/iu.test(message)
    && /does not contain a definition for ['‘’"]?Val|\.Val(?:<|\b)/iu.test(message);
}

export function resolveLegacyApplicationStreamFallbackPolicy(
  result: Partial<ApiResponse> | null | undefined,
  uploadedCount: number,
  allowLegacyFallback = true,
): {
  matched: boolean;
  attemptFallback: boolean;
  requireMultipartStream: boolean;
} {
  const matched = uploadedCount === 0 && isLegacyApplicationStreamJValueFailure(result);
  return {
    matched,
    attemptFallback: matched && allowLegacyFallback,
    requireMultipartStream: matched && !allowLegacyFallback,
  };
}

function asJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * Bridge a rolling-upgrade window without retrying the broken stream endpoint.
 * The fallback is deliberately restricted to small existing MicroServices: it
 * uses the legacy C# PublishMicroService JSON endpoint, never Jint, and refuses
 * Web/UniApp or large directories rather than silently changing their runtime.
 */
export async function tryLegacyMicroServiceStreamPublishFallback(
  client: MicroiClient,
  manifest: LocalApplicationAssetManifest,
  input: {
    appIdOrKey: string;
    versionNo: string;
    routes?: Array<Record<string, unknown>>;
    deliveryBatchId: string;
    sourceManifestHash?: string;
  },
): Promise<LegacyStreamPublishFallbackResult> {
  if (manifest.assets.length > LEGACY_STREAM_COMPATIBILITY_MAX_FILES) {
    return {
      attempted: false,
      reason: `旧节点兼容发布最多允许 ${LEGACY_STREAM_COMPATIBILITY_MAX_FILES} 个文件；当前 ${manifest.assets.length} 个`,
    };
  }
  if (manifest.totalSize > LEGACY_STREAM_COMPATIBILITY_MAX_BYTES) {
    return {
      attempted: false,
      reason: `旧节点兼容发布最多允许 ${LEGACY_STREAM_COMPATIBILITY_MAX_BYTES} bytes；当前 ${manifest.totalSize} bytes`,
    };
  }

  const contextResult = await client.getApplicationContext({
    AppIdOrKey: input.appIdOrKey,
    IncludeContents: false,
    MaxFileBytes: 1,
    MaxTotalBytes: 1,
  });
  if (contextResult.Code !== 1) {
    return {
      attempted: false,
      reason: `无法确认兼容发布目标：${contextResult.Msg || '应用上下文读取失败'}`,
    };
  }
  const context = asJsonRecord(contextResult.Data);
  const application = asJsonRecord(context.Application || contextResult.Data);
  const applicationType = getStringField(application, 'ApplicationType', 'AppType');
  if (applicationType.toLowerCase() !== 'microservice') {
    return {
      attempted: false,
      reason: `旧节点兼容发布只支持 MicroService；当前类型 ${applicationType || '未知'}`,
    };
  }
  const appKey = getStringField(application, 'AppKey', 'AppId');
  if (!appKey) {
    return { attempted: false, reason: '应用上下文缺少服务端确认的 AppKey' };
  }

  const assets: Array<Record<string, unknown>> = [];
  for (const asset of manifest.assets) {
    const bytes = await fs.promises.readFile(asset.absolutePath);
    if (bytes.byteLength !== asset.size) {
      return {
        attempted: false,
        reason: `本地资产在清单生成后发生变化：${asset.relativePath}`,
      };
    }
    const actualSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    if (actualSha256 !== asset.sha256) {
      return {
        attempted: false,
        reason: `本地资产在清单生成后哈希发生变化：${asset.relativePath}`,
      };
    }
    assets.push({
      Path: asset.relativePath,
      FileName: path.posix.basename(asset.relativePath),
      FileByteBase64: bytes.toString('base64'),
      Size: asset.size,
      Sha256: asset.sha256,
      IsEntry: asset.isEntry,
    });
  }

  const appName = getStringField(application, 'AppName', 'Name') || appKey;
  const response = await client.publishMicroService({
    microService: {
      MsKey: appKey,
      MsName: appName,
      Name: appName,
      ApplicationType: 'MicroService',
      BuildVersion: input.versionNo,
      EntryPath: manifest.entryPath,
      StorageMode: 'file',
    },
    assets,
    routes: input.routes || [],
    DeliveryBatchId: input.deliveryBatchId,
    SourceManifestHash: input.sourceManifestHash || '',
  });
  return {
    attempted: true,
    reason: '目标 API 节点命中旧版 JValue.Val 流式发布缺陷，已使用受限的小型 MicroService C# 兼容发布路径',
    appKey,
    response,
  };
}

interface AccessKeyCreationConfirmationInput {
  name: string;
  allowedRoutes: string[];
  allowedTableNames: string[];
  scopes?: string[];
  redirectPath?: string;
  allowedApiEngineKeys?: string[];
  allowedDataSourceKeys?: string[];
  expiresAt?: string;
  remark?: string;
}

function normalizeAccessKeyStringList(values: string[] | undefined, lowerCase = false): string[] {
  const normalized = (values || [])
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .map(value => lowerCase ? value.toLowerCase() : value);
  return Array.from(new Set(normalized)).sort((left, right) => left.localeCompare(right));
}

function buildBrowserAccessKeyLoginUrlTemplates(osClient: string, redirectPath?: string): {
  relative: string;
  absolute: string;
} {
  const tenant = encodeURIComponent(String(osClient || '').trim());
  const redirect = String(redirectPath || '').trim() || '/';
  const relative = `/?OsClient=${tenant}#/access-login?access_key=<AccessKey>&redirect=${encodeURIComponent(redirect)}`;
  return {
    relative,
    absolute: `https://<Microi前端域名>${relative}`,
  };
}

/**
 * Canonicalize the effective access-key grant before asking for confirmation.
 * The returned SHA-256 binds confirmation to scopes, allowlists and expiry,
 * rather than only to a reusable display name.
 */
export function buildAccessKeyCreationConfirmation(input: AccessKeyCreationConfirmationInput): {
  normalized: Required<AccessKeyCreationConfirmationInput>;
  sha256: string;
} {
  const normalized: Required<AccessKeyCreationConfirmationInput> = {
    name: String(input.name || '').trim(),
    allowedRoutes: normalizeAccessKeyStringList(input.allowedRoutes),
    allowedTableNames: normalizeAccessKeyStringList(input.allowedTableNames),
    scopes: normalizeAccessKeyStringList(input.scopes || ['page:open', 'form:read'], true),
    redirectPath: String(input.redirectPath || '').trim(),
    allowedApiEngineKeys: normalizeAccessKeyStringList(input.allowedApiEngineKeys),
    allowedDataSourceKeys: normalizeAccessKeyStringList(input.allowedDataSourceKeys),
    expiresAt: String(input.expiresAt || '').trim(),
    remark: String(input.remark || '').trim(),
  };
  const sha256 = crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized), 'utf8')
    .digest('hex');
  return { normalized, sha256 };
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
  'microi_get_table_indexes',
  'microi_create_table_index',
  'microi_drop_table_index',
  'microi_list_database_types',
  'microi_inspect_external_database',
  'microi_query_external_database',
  'microi_execute_external_database',
  'microi_save_database_connection',
  'microi_import_external_attachment',
  'microi_get_field_list',
  'microi_add_field',
  'microi_add_layout_field',
  'microi_bulk_apply_form_layout',
  'microi_delete_field',
  'microi_update_field',
  'microi_refresh_schema_cache',
  'microi_create_table',
  'microi_create_module',
  'microi_scaffold_vue_microservice',
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
  'microi_bulk_apply_module_presentation',
  'microi_list_modules',
  'microi_update_table',
  'microi_bulk_update_table_features',
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
4. **microi_get_table_indexes / microi_create_table_index** — 按真实查询与业务唯一约束创建并回读物理索引
5. **microi_create_module** — 创建菜单模块（写入 sys_menu），绑定 diyTableId 后即可在导航栏看到并使用 CRUD。**复杂业务系统请同时传入 moreBtns/formBtns/pageTabs/batchSelectMoreBtns** 一次性配齐按钮
6. **microi_create_engine** — 复杂业务（审批/工作流/统计/集成）必须创建接口引擎，菜单按钮的 V8Code 通过 V8.ApiEngine.Run 调用
7. **microi_set_role_permission** — 设置角色权限（写入 sys_rolelimit）。roleId 传 "admin" 可自动查找管理员角色

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
- **microi_list_my_access_keys / microi_create_my_access_key / microi_revoke_my_access_key** — 管理当前登录用户自己的限期访问密钥。列表、创建和吊销都必须显式确认；创建先返回规范化授权载荷的 SHA-256，再以该 SHA-256 确认；MCP 暂只开放 page:open、form:read、api-engine:run、data-source:run、file:read，永久密钥不通过 MCP 创建，明文只在创建结果中返回一次
- **固定看板启动 URL 规范** — 使用 Microi.Client 前端 WebBase（不是 API Server）拼接 \`/?OsClient=${ctx.osClient}#/access-login?access_key=<密钥>&redirect=<encodeURIComponent后的站内Hash路由>\`。例如 redirect 原值为 \`/mic/data-dashboard/preview/01KK988A0YPHKAM8SF216917HX\` 时编码为 \`%2Fmic%2Fdata-dashboard%2Fpreview%2F01KK988A0YPHKAM8SF216917HX\`。完整自动登录链接应保存为电视/看板的启动页；兑换成功后地址栏变为不含 \`access_key\` 的目标页是安全设计，禁止给目标页再次追加密钥，也禁止新增 \`permanent=1\` 一类由客户端决定有效期的参数

## 数据库索引（强制通过 MCP）
- 需求、蓝图、接口、Job 或评审一旦明确某表字段需要索引，必须声明 Manifest \`tables[].indexes\`，并通过 \`microi_create_table_index\` 创建；禁止在 V8、接口引擎、FormEngine 或临时 SQL 中执行 CREATE/DROP INDEX。
- 创建前后调用 \`microi_get_table_indexes\` 回读。删除只能调用 \`microi_drop_table_index\`，主键索引禁止删除。
- 租户业务组合索引通常以 OsClient 开头；业务唯一键/幂等键用租户范围唯一索引；外键、子表回查、待办/重试扫描按真实 WHERE/JOIN/ORDER BY 设计。
- 不得把 SearchFieldIds、SortFieldIds、StatisticsFields 机械转换为一批单列索引。Status/开关/删除标记等低基数字段不能单独滥建，LIKE '%keyword%' 和长文本也不能依赖普通 B-tree 索引。
- MCP 创建在 diy_table 物理表上的索引，必须能在 Microi.Client “开发设计 → 索引管理”看到相同名称、有序字段和唯一性。

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
  "ApiEngineKey": "",        // 后台任务执行的接口引擎Key
  "Workload": { "ExpectedItems": 2000, "FanOutOperations": 10000, "ExpectedSeconds": 3000 },
  "BackgroundTaskOptions": {
    "IdempotencyKeyFields": ["Id", "Version"],
    "ConcurrencyKey": "seed-test-tasks",
    "BusinessTable": "biz_batch",
    "BusinessStatusField": "TaskStatus",
    "BusinessTaskIdField": "BackgroundTaskId",
    "BusinessProgressField": "TaskProgress",
    "BusinessEtaField": "EstimatedEndTime"
  }
}
\`\`\`
按钮的 V8Code **强烈建议** 调用接口引擎（V8.ApiEngine.Run）执行后端逻辑，前端只负责弹窗、刷新、提示。
以下任一条件成立时按长任务设计：预计超过 2 分钟、500 条以上、1000 个以上扇出子操作、100 次以上外部调用、总量未知且可能持续运行，或属于安装/初始化/批量导入/批量生成/全量同步/迁移/备份。MCP 会依据 Workload 与动作语义自动启用 RunBackground 并给出警告。
若按钮已经在前端将任务拆成多个独立 HTTP 请求，并且每片事务可独立提交、失败后可按业务剩余量恢复，可显式配置 \`Workload: { ExecutionMode: "ClientChunked", MaxItemsPerChunk: 40, Resumable: true }\`；逐条串行请求可用 \`ClientSequential\`。该声明只豁免名称语义触发的后台任务强制转换，缺少单片上限或不可恢复时仍会被 MCP 拦截。
后台任务不是“把同步接口换个入口”：必须配置稳定幂等键；业务主记录至少保存“处理中”状态和 BackgroundTaskId，建议同时保存真实进度与 EstimatedEndTime；接口引擎用 V8.Method.UpdateBackgroundTask 上报已提交的 Current/Total。未知总量不填 Total，通知中心显示“计算中”，不得伪造百分比。
预计超过 10 分钟的任务必须分片提交，每片返回 Data.BackgroundTask={HasMore:true,Checkpoint:...,Current,Total,NextDelaySeconds}，平台持久化检查点后重新入队；最后一片返回正常 Code=1。每片独立事务，重试以 IdempotencyKey + FencingToken + 数据库唯一约束保证副作用仅一次。
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
- 重要菜单可配置 menuBadgeEnabled=1 和 menuBadgeApiEngineKey，在侧栏显示接口引擎统计值；接口应返回 {Code:1,Data:{Value:number}}，并保持轻量、租户隔离。
- ViewSchema 可直接传 JSON 对象或字符串；Layout.List 的多行列/尾随字段与 Layout.Card 的顶部、右侧、正文、元数据、底部字段组会完整保存。

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
    'microi_list_my_access_keys',
    `List the current authenticated user's access keys for OsClient "${osClient}". The response contains only public metadata and never returns the credential or its hash. Access-key sessions cannot manage keys. Requires confirmExecution="LIST" because key prefixes and usage metadata are security-sensitive.`,
    {
      confirmExecution: z.string().optional().describe('Required. Pass LIST.'),
    },
    async ({ confirmExecution }) => {
      if (confirmExecution !== 'LIST') {
        return {
          content: [{ type: 'text', text: '执行已拦截：访问密钥列表包含安全元数据，请重新调用并传 confirmExecution="LIST"。' }],
          isError: true,
        };
      }
      try {
        const result = await client.listMyUserAccessKeys();
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `读取访问密钥失败：${result.Msg || `Code=${result.Code}`}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.Data || [], null, 2) }] };
      } catch (e: unknown) {
        return {
          content: [{ type: 'text', text: `读取访问密钥失败：${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'microi_create_my_access_key',
    `Create one revocable, bounded access key for the current authenticated user on OsClient "${osClient}". This is not a permanent admin/MCP bypass: the backend stores only a SHA-256 hash, returns plaintext exactly once, and exchanges the key for a short scoped session. The MCP surface never creates permanent keys; omitting expiresAt uses the backend's bounded default (currently 90 days). Omit scopes for the minimum page:open + form:read permissions. For a browser kiosk, combine the one-time AccessKey with the Microi.Client frontend origin using /?OsClient=${encodeURIComponent(osClient)}#/access-login?access_key=<AccessKey>&redirect=<encodeURIComponent(redirectPath)>; do not use the API origin and do not append the key to the destination page. The first call is a dry confirmation step and returns RequiredConfirmationSha256; repeat the exact same payload with confirmExecution equal to that SHA-256.`,
    {
      name: z.string().min(1).max(200).describe('Human-readable key name.'),
      allowedRoutes: z.array(z.string().min(1).max(500)).min(1).max(100).describe('Exact allowed routes. Use * only after explicit risk review.'),
      allowedTableNames: z.array(z.string().min(1).max(200)).min(1).max(100).describe('Exact table names. Use * only after explicit risk review.'),
      scopes: z.array(z.enum([
        'page:open',
        'form:read',
        'api-engine:run',
        'data-source:run',
        'file:read',
      ])).min(1).max(5).optional().describe('Omit for minimum page:open + form:read. MCP does not expose form:write/form:export until the backend path facade supports them.'),
      redirectPath: z.string().max(500).optional().describe('Internal Hash route beginning with /; must be included in allowedRoutes. Example: /mic/data-dashboard/preview/01KK988A0YPHKAM8SF216917HX. MCP URL-encodes the entire value into the browser login redirect parameter.'),
      allowedApiEngineKeys: z.array(z.string().min(1).max(200)).max(100).optional().describe('Exact keys; required only with api-engine:run. Wildcards are rejected.'),
      allowedDataSourceKeys: z.array(z.string().min(1).max(200)).max(100).optional().describe('Exact keys; required only with data-source:run. Wildcards are rejected.'),
      expiresAt: z.string().optional().describe('Optional server-local expiry time, later than now and no more than 365 days. Omit for the bounded default.'),
      remark: z.string().max(1000).optional(),
      confirmExecution: z.string().optional().describe('Required for the real create. First omit it; then pass the returned RequiredConfirmationSha256 with the exact same payload.'),
    },
    async ({ name, allowedRoutes, allowedTableNames, scopes, redirectPath, allowedApiEngineKeys, allowedDataSourceKeys, expiresAt, remark, confirmExecution }) => {
      const confirmation = buildAccessKeyCreationConfirmation({
        name,
        allowedRoutes,
        allowedTableNames,
        scopes,
        redirectPath,
        allowedApiEngineKeys,
        allowedDataSourceKeys,
        expiresAt,
        remark,
      });
      if (String(confirmExecution || '').trim().toLowerCase() !== confirmation.sha256) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              Blocked: true,
              Message: '创建访问密钥会产生新的登录凭据。请核对以下规范化权限载荷，并使用对应 SHA-256 确认。',
              NormalizedGrant: confirmation.normalized,
              RequiredConfirmationSha256: confirmation.sha256,
              Next: '保持其它参数完全不变，并将 confirmExecution 设置为 RequiredConfirmationSha256。',
            }, null, 2),
          }],
          isError: true,
        };
      }
      try {
        const result = await client.createMyUserAccessKey({
          name: confirmation.normalized.name,
          allowedRoutes: confirmation.normalized.allowedRoutes,
          allowedTableNames: confirmation.normalized.allowedTableNames,
          scopes: confirmation.normalized.scopes,
          redirectPath: confirmation.normalized.redirectPath || undefined,
          allowedApiEngineKeys: confirmation.normalized.allowedApiEngineKeys,
          allowedDataSourceKeys: confirmation.normalized.allowedDataSourceKeys,
          expiresAt: confirmation.normalized.expiresAt || undefined,
          remark: confirmation.normalized.remark || undefined,
        });
        if (result.Code !== 1 || !result.Data?.AccessKey) {
          return { content: [{ type: 'text', text: `创建访问密钥失败：${result.Msg || `Code=${result.Code}`}` }], isError: true };
        }
        const loginUrlTemplates = buildBrowserAccessKeyLoginUrlTemplates(
          osClient,
          confirmation.normalized.redirectPath,
        );
        // Do not return LoginPath because it embeds a second plaintext copy in a URL.
        // The credential below is the one and only MCP response containing plaintext.
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              AccessKey: result.Data.AccessKey,
              Record: result.Data.Record || null,
              Notice: '明文仅本次返回。请立即存入安全凭据库；后续列表和日志不会再次显示。',
              LoginUrlRelativeTemplate: loginUrlTemplates.relative,
              LoginUrlTemplate: loginUrlTemplates.absolute,
              LoginUrlNotice: '请用 Microi.Client 前端域名替换占位符，并用本次 AccessKey 替换 <AccessKey>。固定终端应保存完整 access-login 启动链接；登录后目标页面不再显示 access_key 属于正常的安全清理。',
            }, null, 2),
          }],
        };
      } catch (e: unknown) {
        return {
          content: [{ type: 'text', text: `创建访问密钥失败：${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'microi_revoke_my_access_key',
    `Revoke one access key owned by the current authenticated user on OsClient "${osClient}". Revocation is idempotent and invalidates the shared runtime cache. Requires confirmExecution equal to id. For rotation, create a new bounded key first, securely store its one-time plaintext, then revoke the old id.`,
    {
      id: z.string().min(1).max(100).describe('Access key record Id from microi_list_my_access_keys.'),
      confirmExecution: z.string().optional().describe('Required. Pass the exact id.'),
    },
    async ({ id, confirmExecution }) => {
      if (confirmExecution !== id) {
        return {
          content: [{
            type: 'text',
            text: `执行已拦截：吊销后该访问密钥将立即失效，请重新调用并传 confirmExecution="${id}"。`,
          }],
          isError: true,
        };
      }
      try {
        const result = await client.revokeMyUserAccessKey(id);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `吊销访问密钥失败：${result.Msg || `Code=${result.Code}`}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify({
          Id: id,
          Revoked: true,
          Record: result.Data || null,
          Message: result.Msg || '访问密钥已吊销。',
        }, null, 2) }] };
      } catch (e: unknown) {
        return {
          content: [{ type: 'text', text: `吊销访问密钥失败：${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        };
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
    'microi_get_table_indexes',
    `List normalized physical database indexes for one table in OsClient "${osClient}". Returns one item per index with ordered Columns, IsUnique and IsPrimary. Use this before changing indexes and again for readback verification.`,
    {
      tableName: z.string().min(1).describe('Physical table name, e.g. Biz_Order or sys_apiengine.'),
    },
    async ({ tableName }) => {
      try {
        const result = await client.getTableIndexes(tableName);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify({
          TableName: tableName,
          IndexCount: result.Data?.length || 0,
          Indexes: result.Data || [],
        }, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_create_table_index',
    `Create an idempotent physical database index for OsClient "${osClient}". The backend validates the real table/columns, skips an equivalent existing index, and verifies the result by readback. Indexes created on a diy_table are immediately visible in Microi.Client's 索引管理 dialog. Requires confirmExecution equal to tableName or EXECUTE.`,
    {
      tableName: z.string().min(1).describe('Physical table name.'),
      columns: z.array(z.string().min(1)).min(1).max(8).describe('Ordered index columns. Put equality/tenant columns first and range/order columns last.'),
      indexName: z.string().optional().describe('Optional index name. Omit for a stable idx_<table>_<columns> name.'),
      unique: z.boolean().optional().describe('Create a UNIQUE index. Default false. Use only when this is a real business invariant.'),
      confirmExecution: z.string().optional().describe('Required. Pass the exact tableName or EXECUTE.'),
    },
    async ({ tableName, columns, indexName, unique, confirmExecution }) => {
      if (confirmExecution !== tableName && confirmExecution !== 'EXECUTE') {
        return {
          content: [{
            type: 'text',
            text: `执行已拦截：创建数据库索引会执行 DDL，请重新调用并传 confirmExecution="${tableName}" 或 "EXECUTE"。`,
          }],
          isError: true,
        };
      }
      try {
        const result = await client.createTableIndex({
          TableName: tableName,
          Columns: columns,
          IndexName: indexName,
          Unique: unique,
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}\n${JSON.stringify(result.Data || {}, null, 2)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    'microi_drop_table_index',
    `Drop a non-primary database index from OsClient "${osClient}". The operation is idempotent, blocks primary-key indexes, and verifies absence by readback. Requires confirmExecution equal to "tableName:indexName" or DROP.`,
    {
      tableName: z.string().min(1).describe('Physical table name.'),
      indexName: z.string().min(1).describe('Exact index name returned by microi_get_table_indexes.'),
      confirmExecution: z.string().optional().describe('Required. Pass tableName:indexName or DROP.'),
    },
    async ({ tableName, indexName, confirmExecution }) => {
      const exactConfirmation = `${tableName}:${indexName}`;
      if (confirmExecution !== exactConfirmation && confirmExecution !== 'DROP') {
        return {
          content: [{
            type: 'text',
            text: `执行已拦截：删除数据库索引会执行破坏性 DDL，请重新调用并传 confirmExecution="${exactConfirmation}" 或 "DROP"。`,
          }],
          isError: true,
        };
      }
      try {
        const result = await client.dropTableIndex(tableName, indexName);
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}\n${JSON.stringify(result.Data || {}, null, 2)}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
  // Tool: 添加纯元数据布局控件（不执行 ALTER TABLE）
  // ========================
  server.tool(
    'microi_add_layout_field',
    `Add a metadata-only form layout field for OsClient "${osClient}". Supports CollapseGroup, Divider and Tabs. The backend receives an empty physical Type and therefore must not create or alter a database column. Use this instead of microi_add_field for layout nodes. The operation is idempotent and verifies the saved metadata by readback.`,
    {
      tableId: z.string().describe('Owning diy_table Id.'),
      name: z.string().describe('Stable metadata field name, unique inside the table.'),
      label: z.string().describe('Visible layout title.'),
      component: z.enum(['CollapseGroup', 'Divider', 'Tabs']).describe('Layout component type.'),
      tab: z.string().optional().describe('Optional owning form Tab id/name.'),
      sort: z.number().optional().describe('Display order. Place the layout node immediately before the fields it controls.'),
      visible: z.number().optional().describe('PC visibility. Default: 1.'),
      appVisible: z.number().optional().describe('Mobile visibility. Default: 1.'),
      config: z.union([z.string(), jsonRecordSchema]).optional().describe('Component Config JSON. CollapseGroup should normally set DefaultCollapsed=false, Description, Icon, Theme and ShowFieldCount.'),
      description: z.string().optional(),
      confirmExecution: z.string().describe('Must equal the exact layout field name or EXECUTE.'),
    },
    async ({ tableId, name, label, component, tab, sort, visible, appVisible, config, description, confirmExecution }) => {
      try {
        if (confirmExecution !== name && confirmExecution !== 'EXECUTE') {
          return { content: [{ type: 'text', text: `Error: confirmExecution must equal "${name}" or EXECUTE.` }], isError: true };
        }
        const configText = config === undefined
          ? undefined
          : (typeof config === 'string' ? config : JSON.stringify(config));
        if (configText) JSON.parse(configText);
        const result = await client.addField({
          TableId: tableId,
          Name: name,
          Label: label,
          Type: '',
          Component: component,
          Visible: visible ?? 1,
          AppVisible: appVisible ?? 1,
          Tab: tab,
          TableWidth: 120,
          Sort: sort ?? nextSortFor(tableId),
          Data: '[]',
          Config: configText,
          Description: description,
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        const readback = await client.getFieldList(undefined, tableId);
        if (readback.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: layout field write succeeded but readback failed: ${readback.Msg}` }], isError: true };
        }
        const saved = unwrapList<Record<string, unknown>>(readback.Data)
          .find(item => String(item.Name || '') === name && String(item.Component || '') === component);
        if (!saved) {
          return { content: [{ type: 'text', text: `Error: layout field ${name} was not found after readback.` }], isError: true };
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ok: true,
              id: saved.Id,
              tableId,
              name,
              component,
              metadataOnly: true,
              skipped: Boolean((result.Data as Record<string, unknown> | undefined)?.Skipped),
            }, null, 2),
          }],
        };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 批量应用表单布局（并发指纹保护 + V8 不变校验）
  // ========================
  server.tool(
    'microi_bulk_apply_form_layout',
    `Read, plan or apply metadata-only form layout changes for OsClient "${osClient}". A dry-run may omit expectedFingerprint to obtain the current SHA-256 state; real writes require that fingerprint, preventing stale AI snapshots from overwriting another developer's changes. The tool may add CollapseGroup/Divider/Tabs metadata nodes, patch only Tab/Sort/Config/FormWidth/TableWidth on explicitly listed fields, and patch diy_table.Tabs. It verifies the final layout and proves table/field V8 code plus field Data remain unchanged. Re-running a partially completed batch is safe.`,
    {
      plans: z.array(z.object({
        tableId: z.string().min(1),
        tableName: z.string().min(1),
        expectedFingerprint: z.string().regex(/^[a-fA-F0-9]{64}$/u).optional(),
        tableTabs: z.string().optional().describe('Final diy_table.Tabs JSON string. Omit to preserve.'),
        layoutFields: z.array(z.object({
          name: z.string().min(1),
          label: z.string().min(1),
          component: z.enum(['CollapseGroup', 'Divider', 'Tabs']),
          tab: z.string().optional(),
          sort: z.number(),
          visible: z.number().optional(),
          appVisible: z.number().optional(),
          config: z.union([z.string(), jsonRecordSchema]).optional(),
          description: z.string().optional(),
        })).optional(),
        fieldPatches: z.array(z.object({
          id: z.string().min(1),
          tab: z.string().optional(),
          sort: z.number().optional(),
          config: z.string().optional(),
          formWidth: z.number().nullable().optional(),
          tableWidth: z.number().int().min(60).max(600).optional(),
        })).optional(),
      })).min(1).max(100),
      dryRun: z.boolean().optional().describe('Default true. Set false for real writes.'),
      confirmExecution: z.string().optional().describe('Required when dryRun=false; must be EXECUTE.'),
    },
    async ({ plans, dryRun, confirmExecution }) => {
      const planning = dryRun !== false;
      if (!planning && confirmExecution !== 'EXECUTE') {
        return { content: [{ type: 'text', text: 'Error: real layout writes require dryRun=false and confirmExecution="EXECUTE".' }], isError: true };
      }

      const tableSelectFields = [
        'Id', 'Name', 'Tabs', 'SubmitFormV8', 'SubmitBeforeServerV8', 'SubmitAfterServerV8',
        'InFormV8', 'OutFormV8', 'ServerDataV8', 'UpdateTime',
      ];
      const fieldSelectFields = [
        'Id', 'TableId', 'Name', 'Label', 'Component', 'Sort', 'Visible', 'AppVisible',
        'FormWidth', 'TableWidth', 'Tab', 'Data', 'Config', 'V8Code', 'KeyupV8Code', 'UpdateTime', 'IsDeleted',
      ];
      const readState = async (tableId: string) => {
        const tableResponse = await client.getTableData('diy_table', {
          _Where: [['Id', '=', tableId]],
          _SelectFields: tableSelectFields,
          _PageIndex: 1,
          _PageSize: 2,
        });
        if (tableResponse.Code !== 1) throw new Error(tableResponse.Msg || '读取 diy_table 失败');
        const tableRows = unwrapList<Record<string, unknown>>(tableResponse.Data);
        if (tableRows.length !== 1) throw new Error(tableRows.length ? 'TableId 命中多张表' : '未找到表');
        const fieldResponse = await client.getTableData('diy_field', {
          _Where: [['TableId', '=', tableId], ['IsDeleted', '=', 0]],
          _SelectFields: fieldSelectFields,
          _OrderBy: 'Sort',
          _OrderByType: 'ASC',
          _PageIndex: 1,
          _PageSize: 500,
        });
        if (fieldResponse.Code !== 1) throw new Error(fieldResponse.Msg || '读取 diy_field 失败');
        return {
          table: tableRows[0],
          fields: unwrapList<Record<string, unknown>>(fieldResponse.Data),
        };
      };
      const canonicalState = (state: { table: Record<string, unknown>; fields: Array<Record<string, unknown>> }) => ({
        table: {
          Id: state.table.Id ?? '',
          Name: state.table.Name ?? '',
          Tabs: state.table.Tabs ?? '',
          SubmitFormV8: state.table.SubmitFormV8 ?? '',
          SubmitBeforeServerV8: state.table.SubmitBeforeServerV8 ?? '',
          SubmitAfterServerV8: state.table.SubmitAfterServerV8 ?? '',
          InFormV8: state.table.InFormV8 ?? '',
          OutFormV8: state.table.OutFormV8 ?? '',
          ServerDataV8: state.table.ServerDataV8 ?? '',
        },
        fields: state.fields
          .map(field => ({
            Id: field.Id ?? '',
            Name: field.Name ?? '',
            Component: field.Component ?? '',
            Sort: field.Sort ?? null,
            Visible: field.Visible ?? null,
            AppVisible: field.AppVisible ?? null,
            FormWidth: field.FormWidth ?? null,
            TableWidth: field.TableWidth ?? null,
            Tab: field.Tab ?? '',
            Data: field.Data ?? '',
            Config: field.Config ?? '',
            V8Code: field.V8Code ?? '',
            KeyupV8Code: field.KeyupV8Code ?? '',
          }))
          .sort((a, b) => String(a.Id).localeCompare(String(b.Id))),
      });
      const fingerprint = (state: { table: Record<string, unknown>; fields: Array<Record<string, unknown>> }) => crypto
        .createHash('sha256')
        .update(JSON.stringify(canonicalState(state)), 'utf8')
        .digest('hex');
      const matchesExpectedJson = (actual: unknown, expected: unknown): boolean => {
        if (Array.isArray(expected)) {
          return Array.isArray(actual)
            && actual.length === expected.length
            && expected.every((item, index) => matchesExpectedJson(actual[index], item));
        }
        if (expected && typeof expected === 'object') {
          if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
          const actualObject = actual as Record<string, unknown>;
          return Object.entries(expected as Record<string, unknown>)
            .filter(([key]) => !key.startsWith('_'))
            .every(([key, value]) => Object.prototype.hasOwnProperty.call(actualObject, key)
              && matchesExpectedJson(actualObject[key], value));
        }
        return (actual ?? null) === (expected ?? null);
      };
      const desiredLayoutMatches = (
        state: { table: Record<string, unknown>; fields: Array<Record<string, unknown>> },
        plan: (typeof plans)[number],
      ): boolean => {
        if (plan.tableTabs !== undefined) {
          try {
            if (!matchesExpectedJson(
              JSON.parse(String(state.table.Tabs || '[]')),
              JSON.parse(plan.tableTabs || '[]'),
            )) return false;
          } catch { return false; }
        }
        const fieldsById = new Map(state.fields.map(field => [String(field.Id || ''), field]));
        for (const patch of plan.fieldPatches || []) {
          const field = fieldsById.get(patch.id);
          if (!field) return false;
          if (patch.tab !== undefined && String(field.Tab || '') !== patch.tab) return false;
          if (patch.sort !== undefined && Number(field.Sort) !== patch.sort) return false;
          if (patch.config !== undefined && String(field.Config || '') !== patch.config) return false;
          if (patch.formWidth !== undefined && (field.FormWidth ?? null) !== patch.formWidth) return false;
          if (patch.tableWidth !== undefined && Number(field.TableWidth) !== patch.tableWidth) return false;
        }
        for (const layoutField of plan.layoutFields || []) {
          const field = state.fields.find(item => String(item.Name || '') === layoutField.name);
          if (!field || String(field.Component || '') !== layoutField.component) return false;
        }
        return true;
      };
      const immutableState = (state: { table: Record<string, unknown>; fields: Array<Record<string, unknown>> }, newNames: Set<string>) => ({
        tableEvents: {
          SubmitFormV8: state.table.SubmitFormV8 ?? '',
          SubmitBeforeServerV8: state.table.SubmitBeforeServerV8 ?? '',
          SubmitAfterServerV8: state.table.SubmitAfterServerV8 ?? '',
          InFormV8: state.table.InFormV8 ?? '',
          OutFormV8: state.table.OutFormV8 ?? '',
          ServerDataV8: state.table.ServerDataV8 ?? '',
        },
        fields: state.fields
          .filter(field => !newNames.has(String(field.Name || '')))
          .map(field => ({
            Id: field.Id ?? '',
            Name: field.Name ?? '',
            Component: field.Component ?? '',
            Data: field.Data ?? '',
            V8Code: field.V8Code ?? '',
            KeyupV8Code: field.KeyupV8Code ?? '',
          }))
          .sort((a, b) => String(a.Id).localeCompare(String(b.Id))),
      });

      const summary = {
        ok: true,
        dryRun: planning,
        requested: plans.length,
        matched: 0,
        planned: 0,
        updated: 0,
        unchanged: 0,
        verified: 0,
        stale: 0,
        states: [] as Array<Record<string, unknown>>,
        failures: [] as Array<{ tableId: string; tableName: string; error: string }>,
      };

      for (const plan of plans) {
        try {
          const before = await readState(plan.tableId);
          if (String(before.table.Name || '').toLowerCase() !== plan.tableName.toLowerCase()) {
            throw new Error(`TableId 当前绑定 ${String(before.table.Name || '')}，与计划 ${plan.tableName} 不一致`);
          }
          const actualFingerprint = fingerprint(before);
          summary.states.push({
            tableId: plan.tableId,
            tableName: String(before.table.Name || ''),
            updateTime: before.table.UpdateTime,
            fingerprint: actualFingerprint,
            fieldCount: before.fields.length,
          });
          if (plan.expectedFingerprint && actualFingerprint.toLowerCase() !== plan.expectedFingerprint.toLowerCase()) {
            summary.stale++;
            throw new Error(`STALE_LAYOUT_FINGERPRINT：当前 ${actualFingerprint}，计划 ${plan.expectedFingerprint}`);
          }
          if (!planning && !plan.expectedFingerprint) {
            throw new Error('真实写入必须提供 dry-run 返回的 expectedFingerprint');
          }
          summary.matched++;
          summary.planned++;
          if (planning) continue;
          if (desiredLayoutMatches(before, plan)) {
            summary.unchanged++;
            summary.verified++;
            continue;
          }

          const newNames = new Set((plan.layoutFields || []).map(field => field.name));
          const immutableBefore = immutableState(before, newNames);
          for (const layoutField of plan.layoutFields || []) {
            const configText = layoutField.config === undefined
              ? undefined
              : (typeof layoutField.config === 'string' ? layoutField.config : JSON.stringify(layoutField.config));
            if (configText) JSON.parse(configText);
            const addResult = await client.addField({
              TableId: plan.tableId,
              Name: layoutField.name,
              Label: layoutField.label,
              Type: '',
              Component: layoutField.component,
              Visible: layoutField.visible ?? 1,
              AppVisible: layoutField.appVisible ?? 1,
              Tab: layoutField.tab,
              TableWidth: 120,
              Sort: layoutField.sort,
              Data: '[]',
              Config: configText,
              Description: layoutField.description,
            });
            if (addResult.Code !== 1) throw new Error(`新增布局节点 ${layoutField.name} 失败：${addResult.Msg || ''}`);
          }

          if ((plan.fieldPatches || []).length) {
            const updateResult = await client.updateFieldList({
              TableId: plan.tableId,
              FieldList: (plan.fieldPatches || []).map(field => ({
                Id: field.id,
                ...(field.tab !== undefined ? { Tab: field.tab } : {}),
                ...(field.sort !== undefined ? { Sort: field.sort } : {}),
                ...(field.config !== undefined ? { Config: field.config } : {}),
                ...(field.formWidth !== undefined ? { FormWidth: field.formWidth } : {}),
                ...(field.tableWidth !== undefined ? { TableWidth: field.tableWidth } : {}),
              })),
            });
            if (updateResult.Code !== 1) throw new Error(`批量更新字段失败：${updateResult.Msg || ''}`);
          }
          if (plan.tableTabs !== undefined) {
            JSON.parse(plan.tableTabs || '[]');
            const updateTableResult = await client.updateTable({ Id: plan.tableId, Tabs: plan.tableTabs });
            if (updateTableResult.Code !== 1) throw new Error(`更新表单 Tabs 失败：${updateTableResult.Msg || ''}`);
          }
          summary.updated++;

          const after = await readState(plan.tableId);
          if (JSON.stringify(immutableState(after, newNames)) !== JSON.stringify(immutableBefore)) {
            throw new Error('IMMUTABLE_GUARD：表事件、字段 V8 或字段 Data 在布局写入后发生变化');
          }
          if (plan.tableTabs !== undefined) {
            const expectedTabs = JSON.parse(plan.tableTabs || '[]');
            const actualTabs = JSON.parse(String(after.table.Tabs || '[]'));
            if (!matchesExpectedJson(actualTabs, expectedTabs)) throw new Error('回读 diy_table.Tabs 与计划不一致');
          }
          const afterById = new Map(after.fields.map(field => [String(field.Id || ''), field]));
          for (const fieldPatch of plan.fieldPatches || []) {
            const saved = afterById.get(fieldPatch.id);
            if (!saved) throw new Error(`回读未找到字段 ${fieldPatch.id}`);
            if (fieldPatch.tab !== undefined && String(saved.Tab || '') !== fieldPatch.tab) throw new Error(`字段 ${fieldPatch.id} Tab 回读不一致`);
            if (fieldPatch.sort !== undefined && Number(saved.Sort) !== fieldPatch.sort) throw new Error(`字段 ${fieldPatch.id} Sort 回读不一致`);
            if (fieldPatch.config !== undefined && String(saved.Config || '') !== fieldPatch.config) throw new Error(`字段 ${fieldPatch.id} Config 回读不一致`);
            if (fieldPatch.formWidth !== undefined && (saved.FormWidth ?? null) !== fieldPatch.formWidth) throw new Error(`字段 ${fieldPatch.id} FormWidth 回读不一致`);
            if (fieldPatch.tableWidth !== undefined && Number(saved.TableWidth) !== fieldPatch.tableWidth) throw new Error(`字段 ${fieldPatch.id} TableWidth 回读不一致`);
          }
          for (const layoutField of plan.layoutFields || []) {
            const saved = after.fields.find(field => String(field.Name || '') === layoutField.name);
            if (!saved || String(saved.Component || '') !== layoutField.component) throw new Error(`布局节点 ${layoutField.name} 回读失败`);
          }
          summary.verified++;
        } catch (e: unknown) {
          summary.ok = false;
          summary.failures.push({
            tableId: plan.tableId,
            tableName: plan.tableName,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }], isError: !summary.ok && summary.matched === 0 };
    },
  );

  // ========================
  // Tool: 删除字段（走平台 DelDiyField，软删除元数据并清缓存）
  // ========================
  server.tool(
    'microi_delete_field',
    `Delete one non-system DIY field from OsClient "${osClient}" through the platform DelDiyField API. The platform performs a metadata soft delete and cache invalidation; it intentionally preserves the physical column for backward compatibility. Requires exact field readback and confirmExecution equal to the field Id or DELETE.`,
    {
      id: z.string().min(1).describe('Exact diy_field Id returned by microi_get_field_list.'),
      tableName: z.string().optional().describe('Owning table name used for safety readback.'),
      tableId: z.string().optional().describe('Owning diy_table Id used for safety readback.'),
      confirmExecution: z.string().describe('Must equal the exact field Id or DELETE.'),
    },
    async ({ id, tableName, tableId, confirmExecution }) => {
      try {
        if (confirmExecution !== id && confirmExecution !== 'DELETE') {
          return { content: [{ type: 'text', text: `Error: confirmExecution must equal "${id}" or DELETE.` }], isError: true };
        }
        if (!tableName && !tableId) {
          return { content: [{ type: 'text', text: 'Error: tableName or tableId is required for ownership readback.' }], isError: true };
        }
        const before = await client.getFieldList(tableName, tableId);
        if (before.Code !== 1) return { content: [{ type: 'text', text: `Error: ${before.Msg}` }], isError: true };
        const fields = unwrapList<Record<string, unknown>>(before.Data);
        const field = fields.find(item => String(item.Id || '') === id);
        if (!field) return { content: [{ type: 'text', text: `Error: field ${id} does not belong to the requested table.` }], isError: true };
        const fieldName = String(field.Name || '');
        const protectedFields = new Set(['Id', 'CreateTime', 'UpdateTime', 'UserId', 'UserName', 'IsDeleted']);
        if (protectedFields.has(fieldName) || Number(field.IsLockField || 0) === 1) {
          return { content: [{ type: 'text', text: `Error: protected platform field ${fieldName} cannot be deleted.` }], isError: true };
        }
        const result = await client.deleteField({
          Id: id,
          TableId: String(field.TableId || tableId || ''),
          Name: fieldName,
        });
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        const after = await client.getFieldList(tableName, tableId);
        if (after.Code !== 1) return { content: [{ type: 'text', text: `Error: delete succeeded but readback failed: ${after.Msg}` }], isError: true };
        const remaining = unwrapList<Record<string, unknown>>(after.Data);
        if (remaining.some(item => String(item.Id || '') === id)) {
          return { content: [{ type: 'text', text: `Error: field ${fieldName} is still active after delete readback.` }], isError: true };
        }
        return { content: [{ type: 'text', text: `✅ Field ${fieldName}(${id}) deleted and readback confirmed.` }] };
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
    `Update a diy_table record for OsClient "${osClient}" (for example form layout, data log/comment/version switches, Description or IsTree). Only provided fields are patched. Automatically clears diy_table + diy_table_field_list Redis caches.`,
    {
      id: z.string().optional().describe('TableId (preferred locator)'),
      name: z.string().optional().describe('Table Name (alternative locator)'),
      column: z.number().optional().describe('Form columns: 1, 2 or 3'),
      description: z.string().optional(),
      isTree: z.number().optional(),
      tabs: z.string().optional(),
      formOpenType: z.string().optional(),
      formOpenWidth: z.string().optional(),
      enableDataLog: z.number().optional().describe('1 enables per-row data change logs; 0 disables.'),
      enableDataComment: z.number().optional().describe('1 enables per-row comments; 0 disables.'),
      enableDataVersion: z.number().optional().describe('1 enables data versions; 0 disables.'),
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
        if (args.enableDataLog !== undefined) patch.EnableDataLog = args.enableDataLog === 1 ? 1 : 0;
        if (args.enableDataComment !== undefined) patch.EnableDataComment = args.enableDataComment === 1 ? 1 : 0;
        if (args.enableDataVersion !== undefined) patch.EnableDataVersion = args.enableDataVersion === 1 ? 1 : 0;
        const result = await client.updateTable(patch);
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: `✅ Table updated. ${JSON.stringify(result.Data)}` }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 批量开启/关闭 diy_table 数据能力，逐表回读并可安全续跑
  // ========================
  server.tool(
    'microi_bulk_update_table_features',
    `Plan or apply data-log, data-comment and data-version switches to many diy_table records for OsClient "${osClient}". Each table is read immediately before writing, patched independently through UpdateTable, and verified by readback. Existing V8 events, Tabs and unrelated table metadata are never sent or overwritten. Re-running the same batch is safe and resumes by skipping already-matched rows.`,
    {
      tables: z.array(z.object({
        id: z.string().optional(),
        name: z.string().optional(),
      }).refine(value => Boolean(value.id || value.name), 'Each table needs id or name')).min(1).max(1000),
      enableDataLog: z.number().optional().describe('Desired value, default 1.'),
      enableDataComment: z.number().optional().describe('Desired value, default 1.'),
      enableDataVersion: z.number().optional().describe('Desired value, default 1.'),
      dryRun: z.boolean().optional().describe('Default true. Set false for real writes.'),
      confirmExecution: z.string().optional().describe('Required when dryRun=false; must be EXECUTE.'),
    },
    async ({ tables, enableDataLog, enableDataComment, enableDataVersion, dryRun, confirmExecution }) => {
      const desired = {
        EnableDataLog: enableDataLog === undefined ? 1 : (enableDataLog === 1 ? 1 : 0),
        EnableDataComment: enableDataComment === undefined ? 1 : (enableDataComment === 1 ? 1 : 0),
        EnableDataVersion: enableDataVersion === undefined ? 1 : (enableDataVersion === 1 ? 1 : 0),
      };
      const planning = dryRun !== false;
      if (!planning && confirmExecution !== 'EXECUTE') {
        return { content: [{ type: 'text', text: 'Error: real bulk writes require dryRun=false and confirmExecution="EXECUTE".' }], isError: true };
      }

      const summary = {
        ok: true,
        dryRun: planning,
        requested: tables.length,
        matched: 0,
        alreadyCorrect: 0,
        planned: 0,
        updated: 0,
        verified: 0,
        failures: [] as Array<{ id?: string; name?: string; error: string }>,
      };

      const readTable = async (locator: { id?: string; name?: string }) => {
        const where = locator.id
          ? [['Id', '=', locator.id]]
          : [['Name', '=', locator.name]];
        const response = await client.getTableData('diy_table', {
          _Where: where,
          _SelectFields: ['Id', 'Name', 'EnableDataLog', 'EnableDataComment', 'EnableDataVersion', 'UpdateTime'],
          _PageIndex: 1,
          _PageSize: 2,
        });
        if (response.Code !== 1) throw new Error(response.Msg || '读取 diy_table 失败');
        const rows = unwrapList<Record<string, unknown>>(response.Data);
        if (rows.length !== 1) throw new Error(rows.length ? '定位到多张同名表，请改用 TableId' : '未找到表');
        return rows[0];
      };

      for (const locator of tables) {
        try {
          const before = await readTable(locator);
          summary.matched++;
          const needsUpdate = Object.entries(desired)
            .some(([key, value]) => Number(before[key] ?? 0) !== value);
          if (!needsUpdate) {
            summary.alreadyCorrect++;
            continue;
          }
          summary.planned++;
          if (planning) continue;

          const tableId = String(before.Id || '');
          const result = await client.updateTable({ Id: tableId, ...desired });
          if (result.Code !== 1) throw new Error(result.Msg || 'UpdateTable 返回失败');
          summary.updated++;

          const after = await readTable({ id: tableId });
          const mismatches = Object.entries(desired)
            .filter(([key, value]) => Number(after[key] ?? 0) !== value)
            .map(([key]) => key);
          if (mismatches.length) throw new Error(`回读不一致：${mismatches.join(', ')}`);
          summary.verified++;
        } catch (e: unknown) {
          summary.ok = false;
          summary.failures.push({
            id: locator.id,
            name: locator.name,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        isError: !summary.ok,
      };
    },
  );

  // ========================
  // Tool: 批量应用模块展示配置（并发指纹 + 业务逻辑不变保护）
  // ========================
  server.tool(
    'microi_bulk_apply_module_presentation',
    `Read, plan or apply presentation-only sys_menu changes for OsClient "${osClient}". The tool supports ViewSchema Hero/List/Card, statistics/mobile/card fields, menu badges and badge-only changes to existing buttons/PageTabs. It fingerprints the complete current module before writing, rejects stale snapshots, and proves routes, table binding, SQL/data permissions, API replacements and button V8/business actions remain unchanged. New PageTabs require an explicit per-plan opt-in.`,
    {
      plans: z.array(z.object({
        moduleId: z.string().min(1),
        expectedFingerprint: z.string().regex(/^[a-fA-F0-9]{64}$/u).optional(),
        allowCreatePageTabs: z.boolean().optional(),
        patch: z.object({
          EnableViewSchema: z.number().optional(),
          ViewSchemaVersion: z.string().optional(),
          ViewConfigVersion: z.number().int().min(0).optional(),
          ViewSchema: z.union([z.string(), jsonRecordSchema]).optional(),
          StatisticsFields: z.string().optional(),
          MobileListFields: z.string().optional(),
          CardTitleTagFields: z.string().optional(),
          CardBottomTagFields: z.string().optional(),
          MenuBadgeEnabled: z.number().optional(),
          MenuBadgeApiEngineKey: z.string().optional(),
          MoreBtns: z.string().optional(),
          FormBtns: z.string().optional(),
          BatchSelectMoreBtns: z.string().optional(),
          PageTabs: z.string().optional(),
          ExportMoreBtns: z.string().optional(),
          PageBtns: z.string().optional(),
        }).strict(),
      })).min(1).max(50),
      dryRun: z.boolean().optional().describe('Default true. Dry-run returns the current full-module fingerprint and presentation projection.'),
      confirmExecution: z.string().optional().describe('Required when dryRun=false; must be EXECUTE.'),
    },
    async ({ plans, dryRun, confirmExecution }) => {
      const planning = dryRun !== false;
      if (!planning && confirmExecution !== 'EXECUTE') {
        return { content: [{ type: 'text', text: 'Error: real module presentation writes require dryRun=false and confirmExecution="EXECUTE".' }], isError: true };
      }

      const presentationFields = new Set([
        'EnableViewSchema', 'ViewSchemaVersion', 'ViewConfigVersion', 'ViewSchema',
        'StatisticsFields', 'MobileListFields', 'CardTitleTagFields', 'CardBottomTagFields',
        'MenuBadgeEnabled', 'MenuBadgeApiEngineKey',
        'MoreBtns', 'FormBtns', 'BatchSelectMoreBtns', 'PageTabs', 'ExportMoreBtns', 'PageBtns',
      ]);
      const buttonFields = ['MoreBtns', 'FormBtns', 'BatchSelectMoreBtns', 'PageTabs', 'ExportMoreBtns', 'PageBtns'];

      const parseJson = (value: unknown): unknown => {
        let parsed = value;
        for (let index = 0; index < 2 && typeof parsed === 'string'; index++) {
          const text = parsed.trim();
          if (!text || (!text.startsWith('[') && !text.startsWith('{') && !text.startsWith('"'))) break;
          try { parsed = JSON.parse(text); } catch { break; }
        }
        return parsed;
      };
      const stableValue = (value: unknown): unknown => {
        const parsed = parseJson(value);
        if (Array.isArray(parsed)) return parsed.map(stableValue);
        if (!parsed || typeof parsed !== 'object') return parsed ?? null;
        return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
          .filter(([key]) => !key.startsWith('_'))
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, stableValue(item)]));
      };
      const canonical = (value: unknown) => JSON.stringify(stableValue(value));
      const moduleState = (value: Record<string, unknown>, immutableOnly = false) => Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !key.startsWith('_'))
          .filter(([key]) => !immutableOnly || (!presentationFields.has(key) && key !== 'UpdateTime'))
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, stableValue(item)]),
      );
      const fingerprint = (value: Record<string, unknown>) => crypto
        .createHash('sha256')
        .update(JSON.stringify(moduleState(value)), 'utf8')
        .digest('hex');
      const presentationProjection = (value: Record<string, unknown>) => Object.fromEntries(
        [...presentationFields]
          .filter((key) => value[key] !== undefined)
          .map((key) => [key, value[key]]),
      );
      const stableButtonValue = (value: unknown): unknown => {
        const parsed = parseJson(value);
        if (typeof parsed === 'string') return parsed.replace(/\r\n/gu, '\n').trim();
        if (Array.isArray(parsed)) return parsed.map(stableButtonValue);
        if (!parsed || typeof parsed !== 'object') return parsed ?? null;
        return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
          .filter(([key]) => !key.startsWith('_'))
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, stableButtonValue(item)]));
      };
      const buttonBusinessSignature = (value: unknown, fieldName: string) => {
        const parsed = parseJson(value);
        if (!Array.isArray(parsed)) return canonical([]);
        const clean = parsed.map((raw, index) => {
          if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
          const source = raw as Record<string, unknown>;
          const normalized = Object.fromEntries(Object.entries(source)
            .filter(([key, item]) => !key.startsWith('_')
              && !/^Badge/iu.test(key)
              && item !== ''
              && item !== null
              && item !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [
              key,
              key === 'Sort' && Number.isFinite(Number(item))
                ? Number(item)
                : stableButtonValue(item),
            ]));
          if (normalized.Sort === undefined) normalized.Sort = index * 10;
          if (normalized.IsVisible === undefined) normalized.IsVisible = true;
          if (fieldName === 'MoreBtns' && normalized.ShowRow === undefined) normalized.ShowRow = true;
          return normalized;
        });
        return JSON.stringify(clean.map(stableButtonValue));
      };
      const isEmptyButtonList = (value: unknown) => {
        const parsed = parseJson(value);
        return !Array.isArray(parsed) || parsed.length === 0;
      };
      const readModule = async (moduleId: string) => {
        const response = await client.getModule(moduleId);
        if (response.Code !== 1 || !response.Data || typeof response.Data !== 'object') {
          throw new Error(response.Msg || '读取 sys_menu 失败');
        }
        return response.Data as Record<string, unknown>;
      };

      const summary = {
        ok: true,
        dryRun: planning,
        requested: plans.length,
        matched: 0,
        planned: 0,
        updated: 0,
        verified: 0,
        stale: 0,
        states: [] as Array<Record<string, unknown>>,
        failures: [] as Array<{ moduleId: string; name?: string; error: string }>,
      };

      for (const plan of plans) {
        let moduleName = '';
        try {
          const before = await readModule(plan.moduleId);
          moduleName = String(before.Name || '');
          const currentFingerprint = fingerprint(before);
          const stateIndex = summary.states.length;
          summary.states.push({
            moduleId: plan.moduleId,
            name: moduleName,
            diyTableId: before.DiyTableId,
            updateTime: before.UpdateTime,
            fingerprint: currentFingerprint,
            presentation: presentationProjection(before),
          });
          if (plan.expectedFingerprint && currentFingerprint.toLowerCase() !== plan.expectedFingerprint.toLowerCase()) {
            summary.stale++;
            throw new Error(`STALE_MODULE_FINGERPRINT：当前 ${currentFingerprint}，计划 ${plan.expectedFingerprint}`);
          }
          if (!planning && !plan.expectedFingerprint) {
            throw new Error('真实写入必须提供 dry-run 返回的 expectedFingerprint');
          }
          summary.matched++;

          const normalized = normalizeAllMenuJson({ ModuleId: plan.moduleId, ...plan.patch });
          if (normalized.errors.length) throw new Error(normalized.errors.join('；'));
          const normalizedPatch = normalized.data;
          const buttonBefore = Object.fromEntries(buttonFields.map((field) => [field, buttonBusinessSignature(before[field], field)]));
          for (const field of buttonFields) {
            if (normalizedPatch[field] === undefined) continue;
            const currentEmpty = isEmptyButtonList(before[field]);
            const nextEmpty = isEmptyButtonList(normalizedPatch[field]);
            if (field === 'PageTabs' && currentEmpty && !nextEmpty) {
              if (!plan.allowCreatePageTabs) throw new Error('新增 PageTabs 必须显式设置 allowCreatePageTabs=true');
              continue;
            }
            if (buttonBusinessSignature(normalizedPatch[field], field) !== buttonBefore[field]) {
              throw new Error(`${field} 仅允许增加/调整 Badge* 展示字段，业务动作、V8、顺序与显隐必须保持不变`);
            }
          }

          summary.planned++;
          if (planning) continue;
          const immutableBefore = canonical(moduleState(before, true));
          const result = await client.updateModule({ ModuleId: plan.moduleId, ...normalizedPatch });
          if (result.Code !== 1) throw new Error(result.Msg || 'UpdateModule 返回失败');
          summary.updated++;

          const after = await readModule(plan.moduleId);
          if (canonical(moduleState(after, true)) !== immutableBefore) {
            throw new Error('IMMUTABLE_GUARD：菜单路由、表绑定、权限/SQL 条件、接口替换或其它业务配置发生变化');
          }
          for (const field of buttonFields) {
            if (normalizedPatch[field] === undefined) continue;
            if (field === 'PageTabs' && isEmptyButtonList(before[field]) && plan.allowCreatePageTabs) continue;
            if (buttonBusinessSignature(after[field], field) !== buttonBefore[field]) {
              throw new Error(`IMMUTABLE_GUARD：${field} 的业务动作或 V8 发生变化`);
            }
          }
          summary.states[stateIndex] = {
            moduleId: plan.moduleId,
            name: moduleName,
            diyTableId: after.DiyTableId,
            updateTime: after.UpdateTime,
            fingerprint: fingerprint(after),
            previousFingerprint: currentFingerprint,
            presentation: presentationProjection(after),
          };
          summary.verified++;
        } catch (e: unknown) {
          summary.ok = false;
          summary.failures.push({
            moduleId: plan.moduleId,
            name: moduleName || undefined,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        isError: !summary.ok && summary.matched === 0,
      };
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
      openType: z.string().optional().describe('Open type. Default: "Diy" (low-code page). Options: "Diy", "Url", "Page", "MicroService"'),
      url: z.string().optional().describe('Menu route. MicroService menus normally use /micro-app/{MicroServiceKey}/{routePath}.'),
      sort: z.number().optional().describe('Sort order for menu display. Default: 100. Lower numbers appear first'),
      icon: z.string().optional().describe('Menu icon class name (e.g. "el-icon-user", "el-icon-s-order", "fa fa-home")'),
      menuBadgeEnabled: z.number().optional().describe('Show a dynamic statistic badge beside this sidebar menu (1=yes, 0=no). Important menus with actionable counts should normally enable it.'),
      menuBadgeApiEngineKey: z.string().optional().describe('ApiEngineKey for the sidebar badge. Recommended response: {Code:1,Data:{Value:number}}. Keep it tenant-scoped, inexpensive, and side-effect free.'),
      searchFieldIds: z.string().optional().describe('SearchFieldIds JSON/object-array string. If omitted and diyTableId is bound, backend infers common searchable fields such as title/name/no/status/type/category/person/time.'),
      tableDiyFieldIds: z.string().optional().describe('Comma-separated field Ids to show as table columns (e.g. "fieldId1,fieldId2,fieldId3"). Controls which fields appear in the list view.'),
      defaultOrderBy: z.string().optional().describe('Default sort expression (e.g. "CreateTime DESC", "Sort ASC")'),
      sqlWhere: z.string().optional().describe('Fixed SQL WHERE clause for data filtering (e.g. "Status=1", "IsDeleted=0")'),
      enableViewSchema: z.number().optional().describe('Enable the versioned cross-client ViewSchema (1=yes, 0=no). Default: 0.'),
      viewSchemaVersion: z.string().optional().describe('ViewSchema protocol version stored in sys_menu.ViewSchemaVersion. Default: "1.0".'),
      viewConfigVersion: z.number().optional().describe('Monotonic configuration version stored in sys_menu.ViewConfigVersion. Default: 1.'),
      viewSchema: z.union([z.string(), jsonRecordSchema]).optional().describe('Versioned cross-client view JSON object/string stored in sys_menu.ViewSchema. Supports Detail/Edit/List/Card and PC/Mobile/All. Layout.List keeps multi-line Columns[].Lines, TrailingFields and RequiredFields; Layout.Card keeps AvatarTextField, TitleField, SubtitleFields, StatusFields, TopFields, RightFields, Fields, MetaFields and BottomFields.'),
      moreBtns: z.string().optional().describe('Row action buttons JSON ARRAY (string). Each item: {Id,Sort,Name,Icon,BtnStyle,IsVisible,ShowRow:true,V8CodeShow,V8Code,RunBackground,BackgroundTask,IsBackgroundTask,ApiEngineKey}. V8Code typically calls V8.ApiEngine.Run(...). Long tasks such as install/import/init should set RunBackground=true and ApiEngineKey so the frontend starts a background task. Example: \'[{"Id":"01K...","Name":"指派","BtnStyle":"primary","IsVisible":true,"ShowRow":true,"V8CodeShow":"V8.Result=V8.Form.Status==\\"待指派\\";","V8Code":"V8.OpenAnyForm({TableName:\\"Diy_X\\",Id:V8.Form.Id,FormMode:\\"Edit\\",SelectFields:[\\"AssigneeId\\"],EventReplace:{Submit:async function(v8,p,cb){var r=await V8.ApiEngine.Run({ApiEngineKey:\\"x_assign\\",Id:v8.Form.Id,AssigneeId:v8.Form.AssigneeId});cb(r);V8.RefreshTable({_PageIndex:1});}}});"}]\''),
      formBtns: z.string().optional().describe('Form bottom buttons JSON ARRAY (string). Same item shape as moreBtns but ShowRow not required. Buttons may configure BadgeEnabled, BadgeApiEngineKey, BadgeValuePath, BadgeTone, BadgeMax, BadgeShowZero and BadgeRefreshSeconds.'),
      batchSelectMoreBtns: z.string().optional().describe('Batch action buttons JSON ARRAY (string). Same item and optional Badge* fields as moreBtns. Use V8.TableRowSelected to access selected rows; badge APIs must batch current-page Ids instead of calling once per row.'),
      pageTabs: z.string().optional().describe('Page top tabs JSON ARRAY (string). Each item: {Id,Sort,Name,Icon,V8Code,V8CodeShow,TargetSysMenuId}. TargetSysMenuId associates another module; clicking it replaces the current route and reloads that module. V8Code typically calls V8.SearchSet({field:value}) for tabs within the current module.'),
      exportMoreBtns: z.string().optional().describe('Export menu extra buttons JSON ARRAY (string). Supports the same optional Badge* fields as formBtns.'),
      pageBtns: z.string().optional().describe('Page-level top buttons JSON ARRAY (string). Supports the same optional Badge* fields; page counts normally come from Data.Buttons.'),
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
      microServiceId: z.string().optional().describe('sys_microiservice.Id. Required when openType=MicroService.'),
      microServicePageId: z.string().optional().describe('sys_microiservice_page.Id for this menu route. Required when openType=MicroService.'),
      microServiceRoutePath: z.string().optional().describe('Internal Vue route such as /context-test. Required when openType=MicroService.'),
      microServiceKey: z.string().optional().describe('sys_microiservice.MsKey/AppKey. Used to generate the friendly menu URL.'),
      confirmExecution: z.string().optional().describe('Required for real writes. Must exactly equal name, or EXECUTE. Omit for a dry-run payload.'),
    },
    async ({ name, diyTableId, parentId, componentName, componentPath, display, appDisplay, openType, url, sort,
      icon, menuBadgeEnabled, menuBadgeApiEngineKey, searchFieldIds, tableDiyFieldIds, defaultOrderBy, sqlWhere,
      enableViewSchema, viewSchemaVersion, viewConfigVersion, viewSchema,
      moreBtns, formBtns, batchSelectMoreBtns, pageTabs, exportMoreBtns, pageBtns,
      sortFieldIds, notShowFields, sqlJoin, joinTables, selectFields, statisticsFields,
      inTableEdit, inTableEditFields, mobileListFields, cardTitleTagFields, cardBottomTagFields,
      microServiceId, microServicePageId, microServiceRoutePath, microServiceKey, confirmExecution }) => {
      try {
        const isMicroService = String(openType || '').toLowerCase() === 'microservice'
          || Boolean(microServiceId || microServicePageId || microServiceRoutePath || microServiceKey);
        let effectiveOpenType = openType;
        let effectiveComponentName = componentName;
        let effectiveComponentPath = componentPath;
        let effectiveUrl = url;
        let effectiveMicroServiceRoutePath = microServiceRoutePath;
        if (isMicroService) {
          const missing = [
            !microServiceId ? 'microServiceId' : '',
            !microServicePageId ? 'microServicePageId' : '',
            !microServiceRoutePath ? 'microServiceRoutePath' : '',
            !microServiceKey ? 'microServiceKey' : '',
          ].filter(Boolean);
          if (missing.length) {
            return { content: [{ type: 'text', text: `Error: MicroService 菜单缺少字段：${missing.join(', ')}` }], isError: true };
          }
          const routePath = String(microServiceRoutePath || '').trim().replace(/\\/gu, '/');
          if (!/^\/(?:[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)*)?$/u.test(routePath) || routePath.includes('..')) {
            return { content: [{ type: 'text', text: `Error: microServiceRoutePath 不合法：${microServiceRoutePath}` }], isError: true };
          }
          effectiveMicroServiceRoutePath = routePath;
          effectiveOpenType = 'MicroService';
          effectiveComponentName = componentName || 'MicroService';
          effectiveComponentPath = componentPath || '/micro-app/host';
          const encodedRoute = routePath === '/'
            ? ''
            : '/' + routePath.slice(1).split('/').map(segment => encodeURIComponent(segment)).join('/');
          effectiveUrl = url || `/micro-app/${encodeURIComponent(String(microServiceKey))}${encodedRoute}`;
        }
        if (confirmExecution !== name && confirmExecution !== 'EXECUTE') {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              dryRun: true,
              confirmationRequired: name,
              module: {
                Name: name,
                ParentId: parentId,
                OpenType: effectiveOpenType || 'Diy',
                ComponentName: effectiveComponentName,
                ComponentPath: effectiveComponentPath,
                Url: effectiveUrl,
                MenuBadgeEnabled: menuBadgeEnabled ?? 0,
                MenuBadgeApiEngineKey: menuBadgeApiEngineKey,
                EnableViewSchema: enableViewSchema ?? 0,
                ViewSchema: viewSchema,
                IsMicroiService: isMicroService ? 1 : 0,
                MicroServiceId: microServiceId,
                MicroServicePageId: microServicePageId,
                MicroServiceRoutePath: effectiveMicroServiceRoutePath,
                MicroServiceKey: microServiceKey,
              },
            }, null, 2) }],
          };
        }
        const normalizedViewSchema = normalizeViewSchemaJson(viewSchema);
        if (!normalizedViewSchema.ok) {
          return {
            content: [{ type: 'text', text: `Error: ${normalizedViewSchema.errors.join('\n')}` }],
            isError: true,
          };
        }
        const result = await client.createModule({
          Name: name, DiyTableId: diyTableId, ParentId: parentId,
          ComponentName: effectiveComponentName, ComponentPath: effectiveComponentPath,
          Display: display ?? 1, AppDisplay: appDisplay ?? 1,
          OpenType: effectiveOpenType, Url: effectiveUrl, Sort: sort,
          Icon: icon,
          MenuBadgeEnabled: menuBadgeEnabled ?? 0,
          MenuBadgeApiEngineKey: menuBadgeApiEngineKey,
          SearchFieldIds: searchFieldIds, TableDiyFieldIds: tableDiyFieldIds,
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
          IsMicroiService: isMicroService ? 1 : undefined,
          MicroServiceId: microServiceId,
          MicroServicePageId: microServicePageId,
          MicroServiceRoutePath: effectiveMicroServiceRoutePath,
          MicroServiceKey: microServiceKey,
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
    `Get one Web, UniApp or MicroService application by Id/AppKey for OsClient "${osClient}". It returns metadata and the full file manifest by default without embedding source bodies; set includeContents=true only when the complete source is actually needed, or use microi_get_application_file for one exact file. MicroService responses also include sys_microiservice runtime/pages.`,
    {
      appIdOrKey: z.string().describe('sys_microistore.Id or AppKey.'),
      includeContents: z.boolean().optional().default(false).describe('Read private HDFS source contents. Defaults to false; prefer microi_get_application_file for targeted reads.'),
      maxFileBytes: z.number().int().positive().optional().describe('Maximum bytes read per source file. Default 2MB.'),
      maxTotalBytes: z.number().int().positive().optional().describe('Maximum total bytes read for this app. Default 50MB.'),
    },
    async ({ appIdOrKey, includeContents, maxFileBytes, maxTotalBytes }) => {
      try {
        const result = await client.getApplicationContext({
          AppIdOrKey: appIdOrKey,
          IncludeContents: includeContents === true,
          ...(maxFileBytes ? { MaxFileBytes: maxFileBytes } : {}),
          ...(maxTotalBytes ? { MaxTotalBytes: maxTotalBytes } : {}),
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        const data = result.Data as Record<string, unknown>;
        const files = Array.isArray(data?.Files) ? data.Files as Array<Record<string, unknown>> : [];
        const contentErrorCount = files.filter(file => typeof file?.ContentReadError === 'string' && file.ContentReadError).length;
        const payload = {
          ...data,
          McpReadSummary: {
            RequestedContents: includeContents === true,
            ContentsComplete: includeContents !== true || contentErrorCount === 0,
            ContentErrorCount: contentErrorCount,
          },
        };
        return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
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
  // Tool: 在本地 AI 应用目录创建 Vue 微服务脚手架
  // ========================
  server.tool(
    'microi_scaffold_vue_microservice',
    `Create a safe Vue 3 + Vite MicroService scaffold inside the local tenant AI应用 directory for OsClient "${osClient}". The tool writes .microi-micro-app.json, microi.routes.json and one Vue component per declared route. It only accepts a real absolute directory whose basename is AI应用, never overwrites a different existing project, and performs a dry run until confirmExecution exactly equals appKey. After scaffolding, use microi_create_microservice, microi_sync_microservice_source and microi_publish_application_directory_stream (or the legacy publisher for a tiny compatibility payload).`,
    {
      appKey: z.string().regex(/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/u).describe('Stable lowercase application key and local directory name.'),
      name: z.string().min(1).max(120).describe('Human-readable MicroService name.'),
      description: z.string().optional().describe('Optional application description.'),
      aiApplicationsDirectory: z.string().optional().describe('Absolute tenant AI应用 directory. Defaults to MICROI_AI_APPLICATIONS_DIR injected by Microi.VSCode.'),
      buildVersion: z.string().regex(/^v\d+\.\d+\.\d+$/u).optional().default('v0.1.0').describe('Initial semantic build version. Default v0.1.0.'),
      routes: z.array(z.object({
        path: z.string().describe('Internal route path such as /context-test.'),
        name: z.string().describe('Stable route key such as context-test.'),
        title: z.string().describe('Page/menu title.'),
        description: z.string().optional().describe('Optional visible page explanation.'),
        isHome: z.boolean().optional().describe('Mark one route as the default page. The first route is used when omitted.'),
      })).min(1).max(50).describe('Vue pages and MicroService internal routes. One .vue file is generated per item.'),
      confirmExecution: z.string().optional().describe('Required for filesystem writes and must exactly equal appKey. Omit for a local preflight only.'),
    },
    async ({ appKey, name, description, aiApplicationsDirectory, buildVersion, routes, confirmExecution }) => {
      try {
        const targetRoot = String(aiApplicationsDirectory || process.env.MICROI_AI_APPLICATIONS_DIR || '').trim();
        if (!targetRoot) {
          return {
            content: [{ type: 'text', text: 'Error: 缺少 AI 应用目录。请由 Microi.VSCode 注入 MICROI_AI_APPLICATIONS_DIR，或显式传入 aiApplicationsDirectory。' }],
            isError: true,
          };
        }
        if (confirmExecution && confirmExecution !== appKey) {
          return { content: [{ type: 'text', text: `Error: confirmExecution 必须精确等于 ${appKey}` }], isError: true };
        }
        const scaffoldOptions = {
          aiApplicationsDirectory: targetRoot,
          appKey,
          name,
          description,
          apiBaseUrl: context.apiBaseUrl,
          osClient,
          buildVersion,
          routes,
          sdkSource: resolveMicroiSdkSource(process.env.MICROI_WORKSPACE_ROOT),
        };
        const plan = buildVueMicroServiceScaffoldPlan(scaffoldOptions);
        if (confirmExecution !== appKey) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              dryRun: true,
              confirmationRequired: appKey,
              targetDirectory: plan.targetDirectory,
              appKey: plan.appKey,
              buildVersion: plan.buildVersion,
              routeCount: plan.routes.length,
              routes: plan.routes.map(route => ({ path: route.path, name: route.name, title: route.title, sourceFile: route.sourceFile, isHome: route.isHome })),
              fileCount: plan.files.length,
              files: plan.files.map(file => ({ Path: file.relativePath, Size: file.size, Sha256: file.sha256 })),
            }, null, 2) }],
          };
        }
        const result = scaffoldVueMicroService(scaffoldOptions);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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
  // Tool: 流式上传单个应用资产
  // ========================
  server.tool(
    'microi_upload_application_asset_stream',
    `Stream one local built asset directly to the immutable HDFS version directory for OsClient "${osClient}". The file is never encoded as Base64 and never enters Jint. This is a low-level resumable primitive; normally use microi_publish_application_directory_stream to upload and atomically promote a complete directory.`,
    {
      appIdOrKey: z.string().min(1).describe('Existing sys_microistore Id or AppKey.'),
      versionNo: z.string().regex(/^v?\d+\.\d+\.\d+$/u).describe('Immutable semantic version, e.g. v1.2.3.'),
      relativePath: z.string().min(1).describe('POSIX-style path inside the compiled output, e.g. assets/index-abcd.js.'),
      localFilePath: z.string().min(1).describe('Absolute or workspace-relative path of one local ordinary file.'),
      sha256: z.string().regex(/^[a-fA-F0-9]{64}$/u).optional().describe('Optional expected SHA-256. MCP computes and verifies it when omitted.'),
      timeoutMs: z.number().int().min(1_000).max(2 * 60 * 60_000).optional().describe('Per-file upload timeout. Default 30 minutes; maximum 2 hours.'),
      confirmExecution: z.string().optional().describe('Required for the real upload and must exactly equal appIdOrKey.'),
    },
    async ({ appIdOrKey, versionNo, relativePath, localFilePath, sha256, timeoutMs, confirmExecution }) => {
      try {
        const normalizedPath = normalizeLocalApplicationRelativePath(relativePath);
        const absolutePath = path.resolve(localFilePath);
        const stat = fs.lstatSync(absolutePath);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`本地资产必须是普通文件且不能是符号链接：${absolutePath}`);
        const actualSha256 = await sha256LocalFile(absolutePath);
        if (sha256 && sha256.toLowerCase() !== actualSha256) throw new Error('本地文件 SHA-256 与传入值不一致');
        const summary = { appIdOrKey, versionNo, relativePath: normalizedPath, size: stat.size, sha256: actualSha256 };
        if (confirmExecution !== appIdOrKey) {
          return { content: [{ type: 'text', text: JSON.stringify({ dryRun: true, confirmationRequired: appIdOrKey, ...summary }, null, 2) }] };
        }
        const result = await client.uploadApplicationAssetStream({
          AppIdOrKey: appIdOrKey,
          VersionNo: versionNo,
          RelativePath: normalizedPath,
          ExpectedSha256: actualSha256,
          FilePath: absolutePath,
          TimeoutMs: timeoutMs,
        });
        if (result.Code !== 1) return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(result.Data, null, 2) }] };
      } catch (e: unknown) {
        return { content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  // ========================
  // Tool: 流式发布完整应用目录
  // ========================
  server.tool(
    'microi_publish_application_directory_stream',
    `Publish a real Web, UniApp or MicroService build directory for OsClient "${osClient}" using constant-memory multipart streams. MCP hashes and uploads each file to an immutable semantic version, then sends a metadata-only manifest so HDFS performs server-side copies to short root/latest URLs. It rejects symlinks, secrets, node_modules/.git and runaway file counts before uploading. This is the preferred publisher for compiled applications; file bytes do not pass through JSON, Base64 or Jint. During a rolling upgrade only, an exact pre-write JValue.Val defect on an old API node may use the bounded legacy C# path for an existing MicroService of at most 256 files / 5MB; Web, UniApp and larger builds fail closed until the API node is upgraded.`,
    {
      appIdOrKey: z.string().min(1).describe('Existing sys_microistore Id or AppKey.'),
      versionNo: z.string().regex(/^v?\d+\.\d+\.\d+$/u).describe('Immutable semantic version, e.g. v1.2.3.'),
      directory: z.string().min(1).describe('Local compiled output directory such as dist or unpackage/dist/build/h5.'),
      entryPath: z.string().optional().default('index.html').describe('Entry file relative to directory. Default index.html.'),
      routes: z.array(jsonRecordSchema).optional().describe('Optional MicroService page/route metadata.'),
      changeSummary: z.string().optional().describe('Version change summary stored in mci_ai_app_version.'),
      sourceManifestHash: z.string().regex(/^[a-fA-F0-9]{64}$/u).optional().describe('Optional source-manifest SHA-256 returned by microi_sync_microservice_source, tying source and runtime to one delivery.'),
      deliveryBatchId: z.string().min(1).max(128).optional().describe('Optional stable delivery batch id. MCP generates one when omitted.'),
      includeSourceMaps: z.boolean().optional().default(false).describe('Publish *.map source maps. Defaults to false to avoid source disclosure.'),
      maxFiles: z.number().int().min(1).max(20_000).optional().describe('Safety cap checked before upload. Default and hard maximum 20,000.'),
      maxTotalMegabytes: z.number().positive().max(20_480).optional().describe('Safety cap checked before upload. Default and hard maximum 20GB.'),
      timeoutMsPerFile: z.number().int().min(1_000).max(2 * 60 * 60_000).optional().describe('Per-file upload timeout. Default 30 minutes.'),
      allowLegacyFallback: z.boolean().optional().default(true).describe('Allow the bounded legacy Base64 C# fallback only for a small existing MicroService when an old API node hits the exact pre-write JValue.Val defect. Set false for deliveries that require multipart streaming end to end.'),
      confirmExecution: z.string().optional().describe('Required for real publishing and must exactly equal appIdOrKey. Omit for a local preflight manifest only.'),
    },
    async ({ appIdOrKey, versionNo, directory, entryPath, routes, changeSummary, sourceManifestHash, deliveryBatchId, includeSourceMaps, maxFiles, maxTotalMegabytes, timeoutMsPerFile, allowLegacyFallback, confirmExecution }) => {
      try {
        if (confirmExecution && confirmExecution !== appIdOrKey) {
          return { content: [{ type: 'text', text: `Error: confirmExecution 必须精确等于 ${appIdOrKey}` }], isError: true };
        }
        const manifest = await buildLocalApplicationAssetManifest(directory, entryPath, {
          includeSourceMaps,
          maxFiles,
          maxTotalBytes: maxTotalMegabytes ? Math.floor(maxTotalMegabytes * 1024 * 1024) : undefined,
        });
        if (confirmExecution !== appIdOrKey) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              dryRun: true,
              confirmationRequired: appIdOrKey,
              rootDirectory: manifest.rootDirectory,
              entryPath: manifest.entryPath,
              assetCount: manifest.assets.length,
              totalSize: manifest.totalSize,
              runtimeManifestHash: manifest.manifestHash,
              skippedSourceMaps: manifest.skippedSourceMaps,
              assetsPreview: manifest.assets.slice(0, 200).map(asset => ({ Path: asset.relativePath, Size: asset.size, Sha256: asset.sha256 })),
              previewTruncated: manifest.assets.length > 200,
            }, null, 2) }],
          };
        }

        const effectiveDeliveryBatchId = deliveryBatchId || crypto.randomUUID();
        let uploadedCount = 0;
        const uploadOrder = [...manifest.assets].sort((left, right) => Number(left.isEntry) - Number(right.isEntry));
        for (const asset of uploadOrder) {
          const result = await client.uploadApplicationAssetStream({
            AppIdOrKey: appIdOrKey,
            VersionNo: versionNo,
            RelativePath: asset.relativePath,
            ExpectedSha256: asset.sha256,
            FilePath: asset.absolutePath,
            TimeoutMs: timeoutMsPerFile,
          });
          if (result.Code !== 1) {
            const fallbackPolicy = resolveLegacyApplicationStreamFallbackPolicy(result, uploadedCount, allowLegacyFallback);
            if (fallbackPolicy.requireMultipartStream) {
              return {
                content: [{ type: 'text', text: JSON.stringify({
                  error: result.Msg,
                  failedPath: asset.relativePath,
                  uploadedCount,
                  totalCount: manifest.assets.length,
                  retrySafe: true,
                  allowLegacyFallback: false,
                  compatibilityFallbackAttempted: false,
                  requiresMultipartStream: true,
                  transport: 'multipart-stream-required',
                }, null, 2) }],
                isError: true,
              };
            }
            if (fallbackPolicy.attemptFallback) {
              const fallback = await tryLegacyMicroServiceStreamPublishFallback(
                client,
                manifest,
                {
                  appIdOrKey,
                  versionNo,
                  routes: routes || [],
                  deliveryBatchId: effectiveDeliveryBatchId,
                  sourceManifestHash: sourceManifestHash || '',
                },
              );
              if (fallback.attempted && fallback.response?.Code === 1) {
                const fallbackData = asJsonRecord(fallback.response.Data);
                const publishedAppKey = getStringField(fallbackData, 'MsKey', 'AppKey')
                  || fallback.appKey
                  || appIdOrKey;
                let runtimeProbe = await client.probeMicroAppEntry(publishedAppKey);
                for (const delayMs of [250, 750, 1_500]) {
                  if (runtimeProbe.ok) break;
                  await new Promise(resolve => setTimeout(resolve, delayMs));
                  runtimeProbe = await client.probeMicroAppEntry(publishedAppKey);
                }
                const payload = {
                  ...fallbackData,
                  deliveryBatchId: effectiveDeliveryBatchId,
                  sourceManifestHash: sourceManifestHash || '',
                  runtimeManifestHash: getStringField(fallbackData, 'RuntimeManifestHash') || manifest.manifestHash,
                  RuntimeProbe: runtimeProbe,
                  PublishedButUnavailable: !runtimeProbe.ok,
                  uploadedCount: 0,
                  legacyUploadedCount: manifest.assets.length,
                  totalSize: manifest.totalSize,
                  skippedSourceMaps: manifest.skippedSourceMaps,
                  transport: 'legacy-base64-csharp-compatibility',
                  CompatibilityFallback: true,
                  CompatibilityReason: fallback.reason,
                  StreamFailure: result.Msg,
                  StablePromoted: true,
                  jintFileBytes: 0,
                };
                return {
                  content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
                  ...(!runtimeProbe.ok ? { isError: true } : {}),
                };
              }
              return {
                content: [{ type: 'text', text: JSON.stringify({
                  error: fallback.attempted
                    ? fallback.response?.Msg || '旧节点兼容发布失败'
                    : result.Msg,
                  failedPath: asset.relativePath,
                  uploadedCount,
                  totalCount: manifest.assets.length,
                  retrySafe: !fallback.attempted,
                  compatibilityFallbackAttempted: fallback.attempted,
                  compatibilityFallbackReason: fallback.reason,
                  compatibilityFallbackRetryRequiresReadback: fallback.attempted,
                  streamFailure: result.Msg,
                }, null, 2) }],
                isError: true,
              };
            }
            return {
              content: [{ type: 'text', text: JSON.stringify({
                error: result.Msg,
                failedPath: asset.relativePath,
                uploadedCount,
                totalCount: manifest.assets.length,
                retrySafe: true,
              }, null, 2) }],
              isError: true,
            };
          }
          uploadedCount += 1;
          if (uploadedCount === 1 || uploadedCount % 25 === 0 || uploadedCount === manifest.assets.length) {
            console.error(`[microi-mcp] Stream publish ${appIdOrKey} ${versionNo}: ${uploadedCount}/${manifest.assets.length}`);
          }
        }

        const finalizeResult = await client.finalizeApplicationStreamPublish({
          AppIdOrKey: appIdOrKey,
          VersionNo: versionNo,
          EntryPath: manifest.entryPath,
          Assets: manifest.assets.map(asset => ({ Path: asset.relativePath, Sha256: asset.sha256, Size: asset.size })),
          Routes: routes || [],
          ChangeSummary: changeSummary || 'MCP 二进制流式发布',
          DeliveryBatchId: effectiveDeliveryBatchId,
          SourceManifestHash: sourceManifestHash || '',
          RuntimeManifestHash: manifest.manifestHash,
        });
        if (finalizeResult.Code !== 1) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: finalizeResult.Msg, uploadedCount, stablePromoted: false, retrySafe: true }, null, 2) }], isError: true };
        }
        const publishedAppKey = String((finalizeResult.Data as Record<string, unknown> | undefined)?.AppKey || appIdOrKey);
        let runtimeProbe = await client.probeMicroAppEntry(publishedAppKey);
        for (const delayMs of [250, 750, 1_500]) {
          if (runtimeProbe.ok) break;
          await new Promise(resolve => setTimeout(resolve, delayMs));
          runtimeProbe = await client.probeMicroAppEntry(publishedAppKey);
        }
        const payload = {
          ...(finalizeResult.Data && typeof finalizeResult.Data === 'object' ? finalizeResult.Data as Record<string, unknown> : {}),
          deliveryBatchId: effectiveDeliveryBatchId,
          sourceManifestHash: sourceManifestHash || '',
          runtimeManifestHash: manifest.manifestHash,
          RuntimeProbe: runtimeProbe,
          PublishedButUnavailable: !runtimeProbe.ok,
          uploadedCount,
          totalSize: manifest.totalSize,
          skippedSourceMaps: manifest.skippedSourceMaps,
          transport: 'multipart-stream-to-hdfs',
          jintFileBytes: 0,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          ...(!runtimeProbe.ok ? { isError: true } : {}),
        };
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
    `Legacy small-payload publisher for generated microservice / micro-app files in Base64. For real compiled directories or large assets, use microi_publish_application_directory_stream so bytes stream directly to HDFS and never enter JSON/Jint.`,
    {
      microService: jsonRecordSchema.describe('Microservice metadata. Required: MsKey and MsName/Name. Optional: BuildVersion, EntryPath, SourceDirName.'),
      assets: z.array(jsonRecordSchema).describe('Built asset files. Each item needs Path/RelativePath/FileName and FileByteBase64/ContentBase64. Mark the main HTML/JS entry with IsEntry=true or Entry=true.'),
      routes: z.array(jsonRecordSchema).optional().describe('Optional route/page records for sys_microiservice_page. Fields: PageKey, PageName, PageTitle, RoutePath, EntryPath, SourceDirName, SourceFile, RouteMetaJson, Sort, IsHome.'),
      sourceManifestHash: z.string().regex(/^[a-fA-F0-9]{64}$/u).optional().describe('Optional source-manifest SHA-256 returned by source sync.'),
      deliveryBatchId: z.string().min(1).max(128).optional().describe('Optional stable delivery batch id. MCP generates one when omitted.'),
      confirmExecution: z.string().optional().describe('Required for real writes. Pass any non-empty confirmation string after reviewing the payload.'),
    },
    async ({ microService, assets, routes, sourceManifestHash, deliveryBatchId, confirmExecution }) => {
      if (!confirmExecution) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ dryRun: true, microService, assetCount: assets.length, routes: routes || [] }, null, 2) }],
        };
      }
      try {
        const result = await client.publishMicroService({
          microService,
          assets,
          routes: routes || [],
          DeliveryBatchId: deliveryBatchId || crypto.randomUUID(),
          SourceManifestHash: sourceManifestHash || '',
        });
        if (result.Code !== 1) {
          return { content: [{ type: 'text', text: `Error: ${result.Msg}` }], isError: true };
        }
        const msKey = String(microService.MsKey || microService.MicroServiceKey || microService.AppKey || '').trim();
        let runtimeProbe = msKey ? await client.probeMicroAppEntry(msKey) : {
          ok: false,
          url: '',
          error: 'Cannot probe runtime because MsKey is missing',
        };
        for (const delayMs of [250, 750, 1_500]) {
          if (runtimeProbe.ok || !msKey) break;
          await new Promise(resolve => setTimeout(resolve, delayMs));
          runtimeProbe = await client.probeMicroAppEntry(msKey);
        }
        const payload = {
          ...(result.Data && typeof result.Data === 'object' ? result.Data as Record<string, unknown> : {}),
          RuntimeProbe: runtimeProbe,
          PublishedButUnavailable: !runtimeProbe.ok,
          ...(!runtimeProbe.ok ? {
            Warning: '发布元数据和资产写入已完成，但稳定入口不可用。请检查 API 节点到租户 HDFS/MinIO 公有桶的服务端读取链路；不要无判断重复发布。',
          } : {}),
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          ...(!runtimeProbe.ok ? { isError: true } : {}),
        };
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
