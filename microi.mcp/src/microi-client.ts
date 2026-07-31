import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { API } from './api-paths.js';
import { resolveMcpDid } from './mcp-did.js';
import { normalizeAuthorizationToken, shouldRefreshAuthorizationToken } from './token-utils.js';
import { assertPayloadSourceIntegrity, assertSourceIntegrity } from './source-integrity.js';
import { prepareV8VersionedCode } from './v8-version.js';

/** Microi 后端登录身份失效错误码（与 diy_lang 表中 NoLogin 一致） */
const AUTH_FAILURE_CODES = new Set([1001, 1002]);
const DEFAULT_LOGIN_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R
XaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ
1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg
1DsI9VJ7gTHGL3R7sQIDAQAB
-----END PUBLIC KEY-----`;

export interface MicroiConfig {
  apiBaseUrl: string;
  username: string;
  password: string;
  osClient?: string;
  /** SaaS tenant type used to disambiguate profiles sharing the same API and OsClient. */
  osClientType?: string;
  /** SaaS tenant network used to disambiguate profiles sharing the same API, OsClient and type. */
  osClientNetwork?: string;
  rsaPublicKey?: string;
  /** 直接传入已有 Token（跳过帐号密码登录，适用于需要验证码的服务器） */
  token?: string;
  /** Token 文件路径（VS Code 扩展写入；MCP 自身刷新时也会回写以保持同步） */
  tokenFilePath?: string;
  /** MCP 仅写入无密恢复请求；VS Code 扩展使用 SecretStorage 中的凭据完成重登。 */
  authRecoveryRequestDir?: string;
  /** 普通 HTTP 请求超时，默认 120 秒 */
  requestTimeoutMs?: number;
  /** V8 代码、菜单等写请求超时，默认 60 秒 */
  writeRequestTimeoutMs?: number;
  /** 写请求响应不确定时，单次远端回读超时，默认 5 秒 */
  readbackRequestTimeoutMs?: number;
}

/**
 * Return token-file keys from the most specific tenant identity to legacy keys.
 * New writers use api|os|type|network, while readers keep accepting the older
 * api|os|type, api|os and api layouts during migration.
 */
export function buildTokenFileLookupKeys(
  apiBaseUrl: string,
  osClient = '',
  osClientType = '',
  osClientNetwork = '',
): string[] {
  const apiUrl = String(apiBaseUrl || '').replace(/\/+$/, '');
  const tenant = String(osClient || '').trim();
  const tenantType = String(osClientType || '').trim();
  const tenantNetwork = String(osClientNetwork || '').trim();
  const keys: string[] = [];

  if (tenant && (tenantType || tenantNetwork)) {
    keys.push(`${apiUrl}|${tenant}|${tenantType}|${tenantNetwork}`);
  }
  if (tenant && tenantType) {
    keys.push(`${apiUrl}|${tenant}|${tenantType}`);
  }
  if (tenant) {
    keys.push(`${apiUrl}|${tenant}`);
  }
  keys.push(apiUrl);
  return Array.from(new Set(keys.filter(Boolean)));
}

export function buildMicroAppEntryUrl(apiBaseUrl: string, osClient: string, msKey: string): string {
  const apiUrl = String(apiBaseUrl || '').replace(/\/+$/, '');
  return `${apiUrl}/micro-app/${encodeURIComponent(String(osClient || '').trim())}/${encodeURIComponent(String(msKey || '').trim())}/index.html`;
}

export interface ApiResponse<T = unknown> {
  Code: number;
  Data: T;
  Msg: string;
  Total?: number;
  DataCount?: number;
  DataAppend?: {
    ReasonCode?: string;
    UserMessage?: string;
    Hint?: string;
    AppendMsg?: string;
    [key: string]: unknown;
  };
}

export function isTenantConfigurationFailureResponse(result?: Partial<ApiResponse> | null): boolean {
  const reasonCode = String(result?.DataAppend?.ReasonCode || '').trim();
  if (/^(InvalidTenant|InvalidOsClient|TenantNotFound|TenantDisabled)$/i.test(reasonCode)) {
    return true;
  }
  const message = [result?.Msg, result?.DataAppend?.UserMessage, result?.DataAppend?.Hint]
    .filter(Boolean)
    .join(' ');
  return /无效的租户标识|租户不存在|租户.*未启用|invalid\s+(tenant|osclient)|tenant\s+not\s+found|unknown\s+tenant/i.test(message);
}

export function isAuthenticationFailureResponse(result?: Partial<ApiResponse> | null): boolean {
  if (!result || isTenantConfigurationFailureResponse(result)) { return false; }
  if (AUTH_FAILURE_CODES.has(Number(result.Code))) { return true; }

  const reasonCode = String(result.DataAppend?.ReasonCode || '').trim();
  if (/^(MissingToken|MalformedToken|MissingClaims|TenantMismatch|AuthVersionChanged|JwtExpired|SessionExpired|SessionMissing|TokenReplaced|SignatureMismatch)$/i.test(reasonCode)) {
    return true;
  }
  const message = [result.Msg, result.DataAppend?.UserMessage, result.DataAppend?.AppendMsg]
    .filter(Boolean)
    .join(' ');
  return /Token签名|Token.*(无效|失效|过期)|登录.*(无效|失效|过期)|invalid\s*token|token\s*invalid|signature\s*mismatch/i.test(message);
}

export interface ListEnvelope<T> {
  OsClient?: string;
  OsClientType?: string;
  OsClientNetwork?: string;
  List?: T[];
  Total?: number;
}

interface RequestOptions {
  timeoutMs?: number;
  operationName?: string;
}

export class MicroiTransportError extends Error {
  readonly kind: 'timeout' | 'network';
  readonly requestPath: string;
  readonly uncertainOutcome: boolean;

  constructor(
    message: string,
    options: {
      kind: 'timeout' | 'network';
      requestPath: string;
      uncertainOutcome: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = 'MicroiTransportError';
    this.kind = options.kind;
    this.requestPath = options.requestPath;
    this.uncertainOutcome = options.uncertainOutcome;
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_WRITE_REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_READBACK_REQUEST_TIMEOUT_MS = 5_000;
const WRITE_READBACK_DELAYS_MS = [0, 300, 800, 1_500, 3_000];
const DEFAULT_STREAM_UPLOAD_TIMEOUT_MS = 30 * 60_000;
const MAX_STREAM_UPLOAD_TIMEOUT_MS = 2 * 60 * 60_000;
const MENU_JSON_ARRAY_FIELDS = new Set([
  'MoreBtns',
  'FormBtns',
  'BatchSelectMoreBtns',
  'PageTabs',
  'ExportMoreBtns',
  'PageBtns',
  'SearchFieldIds',
  'TableDiyFieldIds',
  'SelectFields',
  'SortFieldIds',
  'NotShowFields',
  'StatisticsFields',
  'MobileListFields',
  'CardTitleTagFields',
  'CardBottomTagFields',
]);

function resolveTimeoutMs(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1_000) return fallback;
  return Math.min(10 * 60_000, Math.round(parsed));
}

function resolveStreamUploadTimeoutMs(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1_000) return DEFAULT_STREAM_UPLOAD_TIMEOUT_MS;
  return Math.min(MAX_STREAM_UPLOAD_TIMEOUT_MS, Math.round(parsed));
}

function buildMultipartFileBody(
  fields: Record<string, string>,
  filePath: string,
  fileName: string,
  boundary: string,
): { body: Readable; contentLength: number } {
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      'utf8',
    ));
  }
  chunks.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
    'utf8',
  ));
  const prefix = Buffer.concat(chunks);
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const fileSize = fs.statSync(filePath).size;

  async function* streamParts(): AsyncGenerator<Buffer> {
    yield prefix;
    for await (const chunk of fs.createReadStream(filePath)) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
    yield suffix;
  }

  return {
    body: Readable.from(streamParts()),
    contentLength: prefix.length + fileSize + suffix.length,
  };
}

function normalizeCodeForComparison(value: unknown): string {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function stripMenuRuntimeFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMenuRuntimeFields);
  if (!value || typeof value !== 'object') return value;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !key.startsWith('_'))
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries.map(([key, item]) => [key, stripMenuRuntimeFields(item)]));
}

function canonicalMenuJson(value: unknown): string | undefined {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return JSON.stringify(stripMenuRuntimeFields(parsed));
  } catch {
    return undefined;
  }
}

function modulePatchMatches(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): { matched: boolean; mismatches: string[] } {
  const ignoredFields = new Set(['OsClient', 'ModuleId', 'Id']);
  const mismatches: string[] = [];

  for (const [field, expectedValue] of Object.entries(expected)) {
    if (ignoredFields.has(field) || expectedValue === undefined) continue;
    const actualValue = actual[field];
    if (MENU_JSON_ARRAY_FIELDS.has(field) || field === 'ViewSchema') {
      const expectedJson = canonicalMenuJson(expectedValue);
      const actualJson = canonicalMenuJson(actualValue);
      if (!expectedJson || !actualJson || expectedJson !== actualJson) {
        mismatches.push(field);
      }
      continue;
    }
    if (String(expectedValue ?? '') !== String(actualValue ?? '')) {
      mismatches.push(field);
    }
  }

  return { matched: mismatches.length === 0, mismatches };
}

export interface DbTable {
  Id: string;
  Name: string;
  Description: string;
  Fields?: DbField[];
  _Fields?: DbField[];
}

export interface DbField {
  Name: string;
  Label: string;
  Description: string;
  Type: string;
  Component: string;
  IsPrimaryKey?: boolean;
  AllowNull?: boolean;
}

export interface TableIndexInfo {
  Key_name: string;
  Column_name: string;
  Non_unique: number;
  Index_type?: string;
  Seq_in_index?: number;
  Is_primary?: number;
  Name?: string;
  Columns?: string[];
  IsUnique?: boolean;
  IsPrimary?: boolean;
}

export interface ApiEngine {
  Id: string;
  ApiName: string;
  ApiEngineKey: string;
  ApiAddress: string;
  Category: string;
  ApiV8Code?: string;
  Code?: string;
  ApiRemark?: string;
  Description?: string;
  Version?: string;
  ChangeHistory?: string;
  UpdateTime?: string;
}

export interface V8Event {
  Id: string;
  FormEngineKey: string;
  Description: string;
  EventType: string;
  EventName?: string;
  V8Code?: string;
  Code?: string;
  TableName?: string;
  Version?: string;
  UpdateTime?: string;
}

export interface WorkflowNodeV8Event {
  Id: string;
  FlowDesignId: string;
  FlowName?: string;
  NodeId: string;
  NodeName?: string;
  NodeType?: string;
  EventType: string;
  EventName?: string;
  V8Code?: string;
  Code?: string;
  Version?: string;
  UpdateTime?: string;
}

export interface WorkflowV8EventListData {
  OsClient?: string;
  Flows?: Array<Record<string, unknown>>;
  Nodes?: Array<Record<string, unknown>>;
  Lines?: Array<Record<string, unknown>>;
  List?: WorkflowNodeV8Event[];
  Total?: number;
}

export interface MongodbLogQuery {
  keyword?: string;
  type?: string;
  level?: number;
  searchMonth?: string;
  pageIndex?: number;
  pageSize?: number;
}

export interface MongodbLogWrite {
  type?: string;
  title: string;
  content: string;
  level?: number;
  api?: string;
  param?: string;
  remark?: string;
  otherInfo?: string;
  timer?: number;
  result?: string;
  appId?: string;
}

export interface UserAccessKeyRecord {
  Id: string;
  Name?: string;
  KeyPrefix?: string;
  Scopes?: string;
  AllowedRoutes?: string;
  AllowedTableNames?: string;
  AllowedApiEngineKeys?: string;
  AllowedDataSourceKeys?: string;
  ExpiresAt?: string | null;
  State?: number;
  RevokedAt?: string;
  LastUsedAt?: string;
  LastUsedDid?: string;
  UseCount?: number;
  Remark?: string;
  CreateTime?: string;
}

export interface CreateUserAccessKeyInput {
  name: string;
  scopes?: string[];
  allowedRoutes: string[];
  redirectPath?: string;
  allowedTableNames: string[];
  allowedApiEngineKeys?: string[];
  allowedDataSourceKeys?: string[];
  expiresAt?: string;
  remark?: string;
}

export interface CreateUserAccessKeyResult {
  /** Plaintext credential. The backend returns it exactly once. */
  AccessKey: string;
  LoginPath?: string;
  Record?: UserAccessKeyRecord;
}

export interface PlaywrightEngineInfo {
  Id: string;
  ApiName: string;
  ApiEngineKey: string;
  Category: string;
  ApiAddress: string;
  ApiRemark: string;
  AllowAnonymous: number;
  StopHttp: number;
  IsEnable: number;
  UpdateTime?: string;
}

export interface PlaywrightModuleInfo {
  Id: string;
  Name: string;
  ParentId: string;
  DiyTableId: string;
  DiyTableName: string;
  Url: string;
  ComponentName: string;
  ComponentPath: string;
  OpenType: string;
  Display: number;
  AppDisplay: number;
  Sort: number;
  Icon: string;
  UpdateTime?: string;
}

export interface PlaywrightContextData {
  OsClient: string;
  ApiBaseUrl?: string;
  Keyword?: string;
  Engines: PlaywrightEngineInfo[];
  Modules: PlaywrightModuleInfo[];
  RecommendedEnv?: Record<string, string>;
  Summary?: {
    EngineCount?: number;
    PublicEngineCount?: number;
    ProtectedEngineCount?: number;
    ModuleCount?: number;
    PageSize?: number;
  };
  Warnings?: string[];
}

/**
 * Microi 后端 HTTP 客户端
 * - RSA 加密登录（与 Microi 前端 JSEncrypt 兼容）
 * - JWT 自动刷新
 */
export class MicroiClient {
  private config: MicroiConfig;
  private token = '';
  private refreshTimer?: ReturnType<typeof setInterval>;
  private rsaPublicKey: string;
  private readonly did: string;
  private readonly requestTimeoutMs: number;
  private readonly writeRequestTimeoutMs: number;
  private readonly readbackRequestTimeoutMs: number;
  /** 同一时刻只允许一个刷新请求在飞 */
  private inflightRefresh?: Promise<boolean>;
  /** 同一时刻只允许一条完整身份恢复链路，避免并发重登或重复写恢复请求。 */
  private inflightAuthRecovery?: Promise<boolean>;

  constructor(config: MicroiConfig) {
    this.config = config;
    this.rsaPublicKey = config.rsaPublicKey || DEFAULT_LOGIN_RSA_PUBLIC_KEY;
    this.did = resolveMcpDid(process.env.MICROI_MCP_DID, os.hostname());
    this.requestTimeoutMs = resolveTimeoutMs(
      config.requestTimeoutMs ?? process.env.MICROI_MCP_HTTP_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS,
    );
    this.writeRequestTimeoutMs = resolveTimeoutMs(
      config.writeRequestTimeoutMs ?? process.env.MICROI_MCP_WRITE_TIMEOUT_MS,
      DEFAULT_WRITE_REQUEST_TIMEOUT_MS,
    );
    this.readbackRequestTimeoutMs = resolveTimeoutMs(
      config.readbackRequestTimeoutMs ?? process.env.MICROI_MCP_READBACK_TIMEOUT_MS,
      DEFAULT_READBACK_REQUEST_TIMEOUT_MS,
    );
    // 如果直接传入 token，跳过登录流程
    if (config.token) {
      this.token = normalizeAuthorizationToken(config.token);
    }
  }

  /** RSA 加密（PKCS1_PADDING，兼容 Microi 前端 JSEncrypt） */
  private rsaEncrypt(plainText: string): string {
    const publicKey = (this.rsaPublicKey || '').trim();
    if (!publicKey) {
      return plainText;
    }
    const encrypted = crypto.publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(plainText, 'utf-8'),
    );
    return encrypted.toString('base64');
  }

  /** 外部更新 token（由 VS Code 扩展 token 文件同步） */
  updateToken(newToken: string): void {
    this.token = normalizeAuthorizationToken(newToken);
  }

  /** 登录并获取 JWT token（若已有 token 则直接启动刷新）
   *  注意：即便传入了 token（来自 VS Code 扩展的 token 文件），也始终启动 MCP 自身的自动刷新作为兜底，
   *  避免 VS Code 关闭时 token 不再续期导致 MCP 调用失败。
   */
  async login(_options?: { skipAutoRefresh?: boolean }): Promise<void> {
    // 若通过 token 初始化，跳过登录
    if (this.token) {
      this.startAutoRefresh();
      console.error('[microi-mcp] Using provided token (auto-refresh enabled)');
      return;
    }

    const encryptedPwd = this.rsaEncrypt(this.config.password);

    const loginBody = new URLSearchParams();
    loginBody.append('Account', this.config.username);
    loginBody.append('Pwd', encryptedPwd);
    if (this.config.osClient) {
      loginBody.append('OsClient', this.config.osClient);
    }
    loginBody.append('_ClientType', 'MCP');

    const res = await fetch(`${this.config.apiBaseUrl}${API.LOGIN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        did: this.did,
        ...(this.config.osClient ? { OsClient: this.config.osClient } : {}),
      },
      body: loginBody.toString(),
    });

    const token = res.headers.get('authorization') || '';
    const text = await res.text();
    if (!res.ok || !text) {
      throw new Error(`Login failed: HTTP ${res.status} — ${text?.slice(0, 200) || 'empty response'}`);
    }
    let json: ApiResponse;
    try {
      json = JSON.parse(text) as ApiResponse;
    } catch {
      throw new Error(`Login failed: invalid JSON — ${text.slice(0, 200)}`);
    }

    if (json.Code !== 1) {
      throw new Error(`Login failed: ${json.Msg || 'Unknown error'}`);
    }
    if (!token) {
      throw new Error('Login succeeded but no token in response header');
    }

    this.token = normalizeAuthorizationToken(token);
    this.startAutoRefresh();
    console.error('[microi-mcp] Login successful');
  }

  /** 每小时检查一次长效 Token，仅在临近到期时换新，避免多 MCP 进程竞争刷新。 */
  private startAutoRefresh(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => {
      if (shouldRefreshAuthorizationToken(this.token)) {
        this.refreshTokenNow().catch((e) => console.error('[microi-mcp] Token refresh failed:', e));
      }
    }, 60 * 60 * 1000);
  }

  /** 立即调用 /api/SysUser/RefreshToken 以旧换新；成功后回写 token 文件。
   *  并发请求会复用同一个 in-flight Promise。
   */
  async refreshTokenNow(): Promise<boolean> {
    if (this.inflightRefresh) return this.inflightRefresh;
    if (!this.token) return false;
    this.inflightRefresh = (async () => {
      try {
        const res = await fetch(`${this.config.apiBaseUrl}${API.REFRESH_TOKEN}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
            did: this.did,
            ...(this.config.osClient ? { OsClient: this.config.osClient } : {}),
          },
          // 同时把旧 token 放在 body 里（后端 SysUserController.RefreshToken 兼容两种位置）
          body: JSON.stringify({
            authorization: this.token,
            OsClient: this.config.osClient || undefined,
            _ClientType: 'MCP',
          }),
        });
        const newToken = res.headers.get('authorization');
        const text = await res.text();
        let json: ApiResponse | null = null;
        try { json = JSON.parse(text) as ApiResponse; } catch { /* ignore */ }
        if (newToken && json?.Code === 1) {
          this.token = normalizeAuthorizationToken(newToken);
          this.writeTokenToFile();
          console.error('[microi-mcp] Token refreshed');
          return true;
        }
        console.error(`[microi-mcp] Refresh rejected: Code=${json?.Code} Msg=${json?.Msg || ''}`);
        return false;
      } catch (e) {
        console.error('[microi-mcp] Refresh request error:', e);
        return false;
      } finally {
        this.inflightRefresh = undefined;
      }
    })();
    return this.inflightRefresh;
  }

  /** 从 token 文件重新读取（VS Code 扩展可能刚刚写入了新 token）。返回是否更新了 this.token。 */
  reloadTokenFromFile(): boolean {
    const filePath = this.config.tokenFilePath;
    if (!filePath) return false;
    try {
      const tokens = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, string>;
      const lookupKeys = buildTokenFileLookupKeys(
        this.config.apiBaseUrl,
        this.config.osClient,
        this.config.osClientType,
        this.config.osClientNetwork,
      );
      const fileToken = lookupKeys.map(key => tokens[key]).find(Boolean);
      const normalizedFileToken = normalizeAuthorizationToken(fileToken);
      if (normalizedFileToken && normalizedFileToken !== this.token) {
        this.token = normalizedFileToken;
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  /** 把当前 token 回写到 token 文件（保持与 VS Code 扩展同步） */
  private writeTokenToFile(): void {
    const filePath = this.config.tokenFilePath;
    if (!filePath || !this.token) return;
    try {
      let tokens: Record<string, string> = {};
      try {
        tokens = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, string>;
      } catch { /* file may not exist yet */ }
      const [tokenKey] = buildTokenFileLookupKeys(
        this.config.apiBaseUrl,
        this.config.osClient,
        this.config.osClientType,
        this.config.osClientNetwork,
      );
      if (!tokenKey) return;
      tokens[tokenKey] = this.token;
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', mode: 0o600 });
    } catch (e) {
      console.error('[microi-mcp] Write token file failed:', e);
    }
  }

  private async requestVsCodeCredentialRecovery(failedToken: string): Promise<boolean> {
    const recoveryDir = this.config.authRecoveryRequestDir;
    const tokenFilePath = this.config.tokenFilePath;
    if (!recoveryDir || !tokenFilePath) { return false; }

    try {
      if (!fs.existsSync(recoveryDir)) fs.mkdirSync(recoveryDir, { recursive: true });
      const apiBaseUrl = this.config.apiBaseUrl.replace(/\/+$/, '');
      const osClient = this.config.osClient || '';
      const osClientType = this.config.osClientType || '';
      const osClientNetwork = this.config.osClientNetwork || '';
      const identity = `${apiBaseUrl}|${osClient}|${osClientType}|${osClientNetwork}`;
      // 同一租户可能被多个编辑器/MCP 进程同时使用。请求文件必须唯一，
      // 避免 Windows 上 rename 覆盖既有文件失败而让其中一个进程失去恢复机会。
      const identityHash = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 24);
      const fileName = `${identityHash}-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`;
      const requestPath = path.join(recoveryDir, fileName);
      const tempPath = `${requestPath}.${process.pid}.tmp`;
      const payload = {
        version: 1,
        apiBaseUrl,
        osClient,
        osClientType,
        osClientNetwork,
        requestedAt: Date.now(),
        failedTokenHash: crypto.createHash('sha256').update(failedToken || '').digest('hex'),
      };
      fs.writeFileSync(tempPath, JSON.stringify(payload), { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tempPath, requestPath);

      // 扩展宿主每秒处理恢复请求；这里只等待 token 文件出现不同值，不读取任何密码。
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        if (this.reloadTokenFromFile()) {
          console.error('[microi-mcp] Token recovered by VS Code SecretStorage broker');
          return true;
        }
      }
    } catch (e) {
      console.error('[microi-mcp] VS Code credential recovery request failed:', e);
    }
    return false;
  }

  /** 检测 token 身份失效响应，若是则尝试恢复 token。
   *  恢复策略：1) 重新读取 token 文件（VS Code 扩展可能刚写入新 token）；
   *           2) 若 token 没变化或仍失效，调用 RefreshToken API 主动刷新；
   *           3) 仍失败且 MCP 独立配置了凭据时重新登录；
   *           4) VS Code 托管模式写入无密请求，由扩展通过 SecretStorage 重登。
   *  返回 true 表示 token 已更新，调用方可重试请求。
   */
  private async tryRecoverFromAuthFailure(): Promise<boolean> {
    if (this.inflightAuthRecovery) { return this.inflightAuthRecovery; }
    this.inflightAuthRecovery = this.tryRecoverFromAuthFailureCore();
    try {
      return await this.inflightAuthRecovery;
    } finally {
      this.inflightAuthRecovery = undefined;
    }
  }

  private async tryRecoverFromAuthFailureCore(): Promise<boolean> {
    const failedToken = this.token;
    // 1. 先尝试读文件，可能 VS Code 已经刷过了
    if (this.reloadTokenFromFile()) {
      console.error('[microi-mcp] Token reloaded from file after auth failure');
      return true;
    }
    // 2. 主动刷新
    if (await this.refreshTokenNow()) return true;
    // 3. 独立 MCP 配置的兜底：用账号密码重新登录
    if (this.config.username && this.config.password) {
      try {
        this.token = '';
        await this.login();
        if (this.token && this.token !== failedToken) {
          this.writeTokenToFile();
          console.error('[microi-mcp] Re-logged in after auth failure');
          return true;
        }
      } catch (e) {
        this.token = failedToken;
        console.error('[microi-mcp] Re-login failed:', e);
      }
    }
    // 4. VS Code 托管模式：请求扩展宿主使用 SecretStorage 重登。
    return this.requestVsCodeCredentialRecovery(failedToken);
  }

  /** 通用 POST 请求（自动处理 token 失效：刷新后重试一次） */
  private async post<T = unknown>(
    reqPath: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.requestJson<T>('POST', reqPath, body, undefined, true, options);
  }

  /** 通用 GET 请求（自动处理 token 失效：刷新后重试一次） */
  private async get<T = unknown>(
    reqPath: string,
    params?: Record<string, string>,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.requestJson<T>('GET', reqPath, undefined, params, true, options);
  }

  private async requestJson<T = unknown>(
    method: 'GET' | 'POST',
    reqPath: string,
    body?: unknown,
    params?: Record<string, string>,
    allowRetryOnAuthFailure = true,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    let url = `${this.config.apiBaseUrl}${reqPath}`;
    if (method === 'GET' && params) {
      const qs = new URLSearchParams(params).toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}`, did: this.did };
    if (this.config.osClient) headers.OsClient = this.config.osClient;
    if (method === 'POST') headers['Content-Type'] = 'application/json';

    const timeoutMs = resolveTimeoutMs(options.timeoutMs, this.requestTimeoutMs);
    const operationName = options.operationName || `${method} ${reqPath}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    let text: string;
    try {
      res = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
        ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
      });
      text = await res.text();
    } catch (error) {
      const isTimeout = controller.signal.aborted;
      throw new MicroiTransportError(
        isTimeout
          ? `${operationName} 请求超时（${timeoutMs}ms）`
          : `${operationName} 网络请求失败：${error instanceof Error ? error.message : String(error)}`,
        {
          kind: isTimeout ? 'timeout' : 'network',
          requestPath: reqPath,
          uncertainOutcome: method === 'POST',
          cause: error,
        },
      );
    } finally {
      clearTimeout(timer);
    }

    const newToken = res.headers.get('authorization');
    if (newToken) {
      this.token = normalizeAuthorizationToken(newToken);
      this.writeTokenToFile();
    }

    // HTTP 401 → 刷新后重试一次
    if (res.status === 401 && allowRetryOnAuthFailure) {
      if (await this.tryRecoverFromAuthFailure()) {
        return this.requestJson<T>(method, reqPath, body, params, false, options);
      }
      throw new Error(`HTTP 401 Unauthorized — token recovery failed: ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
    }
    if (!text) {
      throw new Error(`HTTP ${res.status} — empty response body`);
    }
    let parsed: ApiResponse<T>;
    try {
      parsed = JSON.parse(text) as ApiResponse<T>;
    } catch {
      throw new Error(`HTTP ${res.status} — invalid JSON: ${text.slice(0, 200)}`);
    }

    // Microi 历史版本可能用 Code=1001/1002、ReasonCode 或签名失败文本表达身份失效。
    if (isAuthenticationFailureResponse(parsed) && allowRetryOnAuthFailure) {
      console.error(`[microi-mcp] Auth expired (Code=${parsed.Code}: ${parsed.Msg || ''}), attempting recovery...`);
      if (await this.tryRecoverFromAuthFailure()) {
        return this.requestJson<T>(method, reqPath, body, params, false, options);
      }
    }
    return parsed;
  }

  /**
   * Stream one local file as multipart without materializing it as Base64 or a
   * whole-file Buffer. A retry constructs a fresh file stream, so auth recovery
   * remains safe for large immutable application assets.
   */
  private async requestMultipartFile<T = unknown>(
    reqPath: string,
    fields: Record<string, string>,
    filePath: string,
    fileName: string,
    allowRetryOnAuthFailure = true,
    timeoutMs?: number,
  ): Promise<ApiResponse<T>> {
    const boundary = `----microi-mcp-${crypto.randomBytes(24).toString('hex')}`;
    const multipart = buildMultipartFileBody(fields, filePath, fileName, boundary);
    const controller = new AbortController();
    const effectiveTimeout = resolveStreamUploadTimeoutMs(timeoutMs);
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);
    let res: Response;
    let text: string;
    try {
      res = await fetch(`${this.config.apiBaseUrl}${reqPath}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          did: this.did,
          ...(this.config.osClient ? { OsClient: this.config.osClient } : {}),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(multipart.contentLength),
        },
        body: multipart.body as unknown as BodyInit,
        // Node.js fetch requires duplex for a streaming request body.
        duplex: 'half',
        signal: controller.signal,
      } as RequestInit & { duplex: 'half' });
      text = await res.text();
    } catch (error) {
      const isTimeout = controller.signal.aborted;
      throw new MicroiTransportError(
        isTimeout
          ? `应用资产流式上传超时（${effectiveTimeout}ms）`
          : `应用资产流式上传网络失败：${error instanceof Error ? error.message : String(error)}`,
        {
          kind: isTimeout ? 'timeout' : 'network',
          requestPath: reqPath,
          uncertainOutcome: true,
          cause: error,
        },
      );
    } finally {
      clearTimeout(timer);
      multipart.body.destroy();
    }

    const newToken = res.headers.get('authorization');
    if (newToken) {
      this.token = normalizeAuthorizationToken(newToken);
      this.writeTokenToFile();
    }
    if (res.status === 401 && allowRetryOnAuthFailure) {
      if (await this.tryRecoverFromAuthFailure()) {
        return this.requestMultipartFile<T>(reqPath, fields, filePath, fileName, false, timeoutMs);
      }
      throw new Error(`HTTP 401 Unauthorized — token recovery failed: ${text.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
    if (!text) throw new Error(`HTTP ${res.status} — empty response body`);

    let parsed: ApiResponse<T>;
    try {
      parsed = JSON.parse(text) as ApiResponse<T>;
    } catch {
      throw new Error(`HTTP ${res.status} — invalid JSON: ${text.slice(0, 200)}`);
    }
    if (isAuthenticationFailureResponse(parsed) && allowRetryOnAuthFailure) {
      if (await this.tryRecoverFromAuthFailure()) {
        return this.requestMultipartFile<T>(reqPath, fields, filePath, fileName, false, timeoutMs);
      }
    }
    return parsed;
  }

  private isUncertainWriteError(error: unknown): error is MicroiTransportError {
    return error instanceof MicroiTransportError && error.uncertainOutcome;
  }

  private readbackOptions(operationName: string): RequestOptions {
    return {
      timeoutMs: this.readbackRequestTimeoutMs,
      operationName,
    };
  }

  private async pollReadback<T>(
    readback: () => Promise<ApiResponse<T>>,
    matches: (data: T) => boolean,
  ): Promise<{ matched: boolean; response?: ApiResponse<T>; lastError?: string }> {
    let lastResponse: ApiResponse<T> | undefined;
    let lastError = '';

    for (const delayMs of WRITE_READBACK_DELAYS_MS) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      try {
        const response = await readback();
        lastResponse = response;
        if (response.Code === 1 && matches(response.Data)) {
          return { matched: true, response };
        }
        lastError = response.Msg || `回读 Code=${response.Code}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    return { matched: false, response: lastResponse, lastError };
  }

  private recoveredWriteResult(
    operation: string,
    error: MicroiTransportError,
    data: Record<string, unknown> = {},
  ): ApiResponse {
    return {
      Code: 1,
      Data: {
        ...data,
        RecoveredAfterTransportError: true,
        Verification: 'readback',
        TransportError: error.message,
      },
      Msg: `${operation} 的客户端响应异常，但已通过远端回读确认写入成功。`,
    };
  }

  private uncertainWriteFailure(
    operation: string,
    error: MicroiTransportError,
    lastError?: string,
  ): Error {
    return new Error(
      `${operation} 的客户端响应异常，且回读未能确认写入结果。`
      + `原始错误：${error.message}`
      + `${lastError ? `；回读结果：${lastError}` : ''}。`
      + '请继续使用对应的标准 MCP 获取工具回读后再决定是否重试；不要改走原生 FormEngine、直接 SQL 或临时维护接口引擎。',
      { cause: error },
    );
  }

  // ---------- API 方法 ----------

  async getStatus(): Promise<ApiResponse> {
    return this.get(API.GET_STATUS);
  }

  async listMyUserAccessKeys(): Promise<ApiResponse<UserAccessKeyRecord[]>> {
    // Deliberately omit TargetUserId: the backend binds the operation to the
    // authenticated user and prevents an access-key session from managing keys.
    return this.post<UserAccessKeyRecord[]>(API.LIST_USER_ACCESS_KEYS, {});
  }

  async createMyUserAccessKey(
    input: CreateUserAccessKeyInput,
  ): Promise<ApiResponse<CreateUserAccessKeyResult>> {
    // Permanent keys are intentionally not exposed through MCP. The backend
    // applies its bounded default expiry (currently 90 days) when ExpiresAt is absent.
    return this.post<CreateUserAccessKeyResult>(API.CREATE_USER_ACCESS_KEY, {
      Name: input.name,
      Scopes: input.scopes,
      AllowedRoutes: input.allowedRoutes,
      RedirectPath: input.redirectPath,
      AllowedTableNames: input.allowedTableNames,
      AllowedApiEngineKeys: input.allowedApiEngineKeys,
      AllowedDataSourceKeys: input.allowedDataSourceKeys,
      ExpiresAt: input.expiresAt,
      Remark: input.remark,
      Permanent: false,
    }, {
      timeoutMs: this.writeRequestTimeoutMs,
      operationName: `创建当前用户访问密钥 ${input.name}`,
    });
  }

  async revokeMyUserAccessKey(id: string): Promise<ApiResponse<UserAccessKeyRecord>> {
    return this.post<UserAccessKeyRecord>(API.REVOKE_USER_ACCESS_KEY, { Id: id }, {
      timeoutMs: this.writeRequestTimeoutMs,
      operationName: `吊销当前用户访问密钥 ${id}`,
    });
  }

  async getDbSchema(): Promise<ApiResponse<{ Tables: DbTable[] }>> {
    return this.post(API.GET_DB_SCHEMA, {
      OsClient: this.config.osClient,
    });
  }

  async getTableIndexes(
    tableName: string,
    readback = false,
  ): Promise<ApiResponse<TableIndexInfo[]>> {
    return this.post(API.GET_TABLE_INDEXES, {
      OsClient: this.config.osClient,
      TableName: tableName,
    }, readback ? this.readbackOptions(`回读表 ${tableName} 索引`) : {});
  }

  async createTableIndex(data: {
    TableName: string;
    IndexName?: string;
    Columns: string[];
    Unique?: boolean;
  }): Promise<ApiResponse> {
    const payload = { OsClient: this.config.osClient, ...data };
    try {
      return await this.post(API.CREATE_TABLE_INDEX, payload, {
        timeoutMs: this.writeRequestTimeoutMs,
        operationName: `创建索引 ${data.IndexName || `${data.TableName}:${data.Columns.join(',')}`}`,
      });
    } catch (error) {
      if (!this.isUncertainWriteError(error)) throw error;
      const readback = await this.pollReadback(
        () => this.getTableIndexes(data.TableName, true),
        (indexes) => indexes.some((index) => {
          const nameMatches = data.IndexName
            ? String(index.Key_name || index.Name || '').toLowerCase() === data.IndexName.toLowerCase()
            : true;
          const columns = index.Columns?.length
            ? index.Columns
            : String(index.Column_name || '').split(',').map((value) => value.trim()).filter(Boolean);
          const unique = index.IsUnique ?? Number(index.Non_unique) === 0;
          return nameMatches
            && unique === Boolean(data.Unique)
            && columns.length === data.Columns.length
            && columns.every((value, position) =>
              value.toLowerCase() === data.Columns[position].toLowerCase());
        }),
      );
      if (readback.matched) {
        return this.recoveredWriteResult('创建数据库索引', error, {
          TableName: data.TableName,
          IndexName: data.IndexName,
          Columns: data.Columns,
        });
      }
      throw this.uncertainWriteFailure('创建数据库索引', error, readback.lastError);
    }
  }

  async dropTableIndex(tableName: string, indexName: string): Promise<ApiResponse> {
    try {
      return await this.post(API.DROP_TABLE_INDEX, {
        OsClient: this.config.osClient,
        TableName: tableName,
        IndexName: indexName,
      }, {
        timeoutMs: this.writeRequestTimeoutMs,
        operationName: `删除索引 ${indexName}`,
      });
    } catch (error) {
      if (!this.isUncertainWriteError(error)) throw error;
      const readback = await this.pollReadback(
        () => this.getTableIndexes(tableName, true),
        (indexes) => !indexes.some((index) =>
          String(index.Key_name || index.Name || '').toLowerCase() === indexName.toLowerCase()),
      );
      if (readback.matched) {
        return this.recoveredWriteResult('删除数据库索引', error, {
          TableName: tableName,
          IndexName: indexName,
        });
      }
      throw this.uncertainWriteFailure('删除数据库索引', error, readback.lastError);
    }
  }

  async getSupportedDatabaseTypes(): Promise<ApiResponse> {
    return this.post(API.GET_SUPPORTED_DATABASE_TYPES, {});
  }

  async inspectExternalDatabase(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.INSPECT_EXTERNAL_DATABASE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async queryExternalDatabase(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.QUERY_EXTERNAL_DATABASE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async executeExternalDatabaseSql(data: Record<string, unknown>): Promise<ApiResponse> {
    const requestedTimeoutSeconds = Number(data.CommandTimeoutSeconds || 0);
    const executionTimeoutMs = Number.isFinite(requestedTimeoutSeconds) && requestedTimeoutSeconds > 0
      ? (requestedTimeoutSeconds + 30) * 1000
      : 630_000;
    return this.post(API.EXECUTE_EXTERNAL_DATABASE_SQL, {
      OsClient: this.config.osClient,
      ...data,
    }, {
      timeoutMs: Math.max(
        this.config.requestTimeoutMs ?? 120_000,
        this.config.writeRequestTimeoutMs ?? 60_000,
        executionTimeoutMs,
      ),
      operationName: 'execute external database sql',
    });
  }

  async saveDatabaseConnection(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.SAVE_DATABASE_CONNECTION, {
      OsClient: this.config.osClient,
      ...data,
    }, { timeoutMs: this.config.writeRequestTimeoutMs, operationName: 'save database connection' });
  }

  async importExternalAttachment(data: Record<string, unknown>): Promise<ApiResponse> {
    const requestedTimeoutSeconds = Number(data.TimeoutSeconds || 0);
    const transferTimeoutMs = Number.isFinite(requestedTimeoutSeconds) && requestedTimeoutSeconds > 0
      ? (requestedTimeoutSeconds + 30) * 1000
      : 3_630_000;
    return this.post(API.IMPORT_EXTERNAL_ATTACHMENT, {
      OsClient: this.config.osClient,
      ...data,
    }, {
      timeoutMs: Math.max(
        this.config.requestTimeoutMs ?? 120_000,
        this.config.writeRequestTimeoutMs ?? 60_000,
        transferTimeoutMs,
      ),
      operationName: 'import external attachment',
    });
  }

  async getPlaywrightContext(keyword?: string, pageSize?: number): Promise<ApiResponse<PlaywrightContextData>> {
    return this.post(API.GET_PLAYWRIGHT_CONTEXT, {
      OsClient: this.config.osClient,
      ...(keyword ? { Keyword: keyword } : {}),
      ...(pageSize ? { PageSize: pageSize } : {}),
    });
  }

  async getEngineList(keyword?: string): Promise<ApiResponse<ApiEngine[] | ListEnvelope<ApiEngine>>> {
    return this.post(API.GET_ENGINE_LIST, {
      OsClient: this.config.osClient,
      ...(keyword ? { _SearchKey: keyword } : {}),
    });
  }

  async getEngineCode(apiEngineKey: string, options: RequestOptions = {}): Promise<ApiResponse<ApiEngine>> {
    return this.post(API.GET_ENGINE_CODE, {
      OsClient: this.config.osClient,
      ApiEngineKey: apiEngineKey,
    }, options);
  }

  async executeEngine(apiEngineKey: string, params?: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.EXECUTE_ENGINE, {
      OsClient: this.config.osClient,
      ApiEngineKey: apiEngineKey,
      Param: params || {},
    });
  }

  async saveEngineCode(apiEngineKey: string, code: string, options?: { functionDescription?: string; changeSummary?: string; confirmLargeReduction?: boolean }): Promise<ApiResponse> {
    assertSourceIntegrity(code, `保存接口引擎 ${apiEngineKey}`);
    let remote: ApiEngine | undefined;
    try {
      const remoteResult = await this.getEngineCode(apiEngineKey);
      remote = remoteResult.Code === 1 ? remoteResult.Data : undefined;
    } catch {
      remote = undefined;
    }
    const remoteSource = normalizeCodeForComparison(remote?.ApiV8Code || remote?.Code);
    const nextSource = normalizeCodeForComparison(code);
    if (remoteSource.length >= 8000
      && nextSource.length < remoteSource.length * 0.85
      && !options?.confirmLargeReduction) {
      throw new Error(
        `保存接口引擎 ${apiEngineKey} 已拦截：新源码 ${nextSource.length} 字符，远端源码 ${remoteSource.length} 字符，`
        + `减少超过 15%。这可能是长工具结果被截断；确认确需大幅删减时请传 confirmLargeReduction="${apiEngineKey}"。`,
      );
    }
    const prepared = prepareV8VersionedCode({
      kind: 'ApiEngine',
      key: apiEngineKey,
      currentCode: code,
      remoteCode: remote?.ApiV8Code || remote?.Code,
      remoteVersion: remote?.Version,
      functionDescription: options?.functionDescription,
      changeSummary: options?.changeSummary || `保存接口引擎 ${apiEngineKey}`,
    });
    const payload = {
      OsClient: this.config.osClient,
      ApiEngineKey: apiEngineKey,
      ApiV8CodeBase64: Buffer.from(prepared.code, 'utf8').toString('base64'),
      Version: prepared.version,
      ChangeHistory: prepared.changeHistory,
    };
    try {
      return await this.post(API.UPDATE_ENGINE_CODE, payload, {
        timeoutMs: this.writeRequestTimeoutMs,
        operationName: `保存接口引擎 ${apiEngineKey}`,
      });
    } catch (error) {
      if (!this.isUncertainWriteError(error)) throw error;
      const verification = await this.pollReadback(
        () => this.getEngineCode(
          apiEngineKey,
          this.readbackOptions(`回读接口引擎 ${apiEngineKey}`),
        ),
        (data) => normalizeCodeForComparison(data?.ApiV8Code || data?.Code)
          === normalizeCodeForComparison(prepared.code),
      );
      if (verification.matched) {
        return this.recoveredWriteResult(`保存接口引擎 ${apiEngineKey}`, error, {
          ApiEngineKey: apiEngineKey,
          Version: prepared.version,
        });
      }
      throw this.uncertainWriteFailure(`保存接口引擎 ${apiEngineKey}`, error, verification.lastError);
    }
  }

  async createEngine(data: { ApiEngineKey: string; ApiName: string; Category?: string; Code?: string; ApiAddress?: string; functionDescription?: string; changeSummary?: string }): Promise<ApiResponse> {
    // 默认 ApiAddress 为 /apiengine/{key}，否则平台路由匹配会 404
    const payload: any = {
      OsClient: this.config.osClient,
      ...data,
    };
    const code = typeof payload.Code === 'string' ? payload.Code : (typeof payload.ApiV8Code === 'string' ? payload.ApiV8Code : '');
    assertSourceIntegrity(code, `创建接口引擎 ${data.ApiEngineKey}`);
    const prepared = prepareV8VersionedCode({
      kind: 'ApiEngine',
      key: data.ApiEngineKey,
      currentCode: code,
      functionDescription: payload.functionDescription,
      changeSummary: payload.changeSummary || `创建接口引擎 ${data.ApiEngineKey}`,
      initial: true,
    });
    payload.ApiV8CodeBase64 = Buffer.from(prepared.code, 'utf8').toString('base64');
    payload.Version = prepared.version;
    payload.ChangeHistory = prepared.changeHistory;
    delete payload.Code;
    delete payload.ApiV8Code;
    delete payload.functionDescription;
    delete payload.changeSummary;
    if (!payload.ApiAddress || payload.ApiAddress.trim().length === 0) {
      payload.ApiAddress = `/apiengine/${data.ApiEngineKey}`;
    }
    payload.IsEnable = payload.IsEnable ?? 1;
    payload.StopHttp = payload.StopHttp ?? 0;
    payload.AllowAnonymous = payload.AllowAnonymous ?? 0;
    const operation = `创建接口引擎 ${data.ApiEngineKey}`;
    const verifyCreated = () => this.pollReadback(
      () => this.getEngineCode(
        data.ApiEngineKey,
        this.readbackOptions(`回读新建接口引擎 ${data.ApiEngineKey}`),
      ),
      (remote) => String(remote?.ApiEngineKey || '') === data.ApiEngineKey
        && normalizeCodeForComparison(remote?.ApiV8Code || remote?.Code)
          === normalizeCodeForComparison(prepared.code),
    );

    try {
      const result = await this.post(API.CREATE_ENGINE, payload, {
        timeoutMs: this.writeRequestTimeoutMs,
        operationName: operation,
      });
      if (result.Code !== 1) return result;

      const verification = await verifyCreated();
      if (!verification.matched) {
        return {
          Code: 0,
          Data: {
            ApiEngineKey: data.ApiEngineKey,
            CreateResponse: result.Data,
          },
          Msg: `${operation} 接口返回成功，但远端回读未确认新记录：${verification.lastError || '记录或代码不一致'}`,
        };
      }

      return {
        ...result,
        Data: {
          ...(result.Data && typeof result.Data === 'object' ? result.Data as Record<string, unknown> : {}),
          ApiEngineKey: data.ApiEngineKey,
          Verified: true,
          Verification: 'readback',
        },
      };
    } catch (error) {
      if (!this.isUncertainWriteError(error)) throw error;
      const verification = await verifyCreated();
      if (verification.matched) {
        return this.recoveredWriteResult(operation, error, {
          ApiEngineKey: data.ApiEngineKey,
          Version: prepared.version,
          Verified: true,
        });
      }
      throw this.uncertainWriteFailure(operation, error, verification.lastError);
    }
  }

  async uploadFileBase64(data: {
    FileName?: string;
    FileByteBase64: string;
    Path?: string;
    FilePathName?: string;
    Limit?: boolean;
    Preview?: boolean;
    TargetTable?: string;
    TargetId?: string;
    TargetField?: string;
  }): Promise<ApiResponse> {
    return this.post(API.UPLOAD_FILE_BASE64, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async uploadApplicationAssetStream(data: {
    AppIdOrKey: string;
    VersionNo: string;
    RelativePath: string;
    ExpectedSha256: string;
    FilePath: string;
    TimeoutMs?: number;
  }): Promise<ApiResponse> {
    const localPath = path.resolve(data.FilePath);
    const stat = fs.lstatSync(localPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`应用资产必须是普通文件且不能是符号链接：${localPath}`);
    }
    const fileName = path.posix.basename(String(data.RelativePath || '').replace(/\\/g, '/'));
    if (!fileName || /[\r\n"]/u.test(fileName)) {
      throw new Error('RelativePath 的文件名不合法');
    }
    return this.requestMultipartFile(
      API.UPLOAD_APPLICATION_ASSET_STREAM,
      {
        OsClient: this.config.osClient || '',
        AppIdOrKey: data.AppIdOrKey,
        VersionNo: data.VersionNo,
        RelativePath: data.RelativePath,
        ExpectedSha256: data.ExpectedSha256,
      },
      localPath,
      fileName,
      true,
      data.TimeoutMs,
    );
  }

  async finalizeApplicationStreamPublish(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.FINALIZE_APPLICATION_STREAM_PUBLISH, {
      OsClient: this.config.osClient,
      ...data,
    }, {
      timeoutMs: 10 * 60_000,
      operationName: 'finalize application stream publish',
    });
  }

  async getMicroService(msKey: string): Promise<ApiResponse> {
    return this.post(API.GET_MICRO_SERVICE, {
      OsClient: this.config.osClient,
      MsKey: msKey,
    });
  }

  async listApplications(data: Record<string, unknown> = {}): Promise<ApiResponse> {
    return this.post(API.LIST_APPLICATIONS, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async getApplicationContext(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.GET_APPLICATION_CONTEXT, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async getApplicationFile(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.GET_APPLICATION_FILE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async createMicroService(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.CREATE_MICRO_SERVICE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async syncMicroServiceSource(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.SYNC_MICRO_SERVICE_SOURCE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async publishMicroService(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.PUBLISH_MICRO_SERVICE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async probeMicroAppEntry(msKey: string): Promise<{
    ok: boolean;
    url: string;
    status?: number;
    contentType?: string;
    bodyBytes?: number;
    hasHead?: boolean;
    hasBody?: boolean;
    error?: string;
  }> {
    const url = buildMicroAppEntryUrl(this.config.apiBaseUrl, this.config.osClient || '', msKey);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type') || '';
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (Number.isFinite(contentLength) && contentLength > 2 * 1024 * 1024) {
        await response.body?.cancel();
        return {
          ok: false,
          url,
          status: response.status,
          contentType,
          bodyBytes: contentLength,
          error: 'MicroApp entry exceeds the 2MB probe limit',
        };
      }
      const body = Buffer.from(await response.arrayBuffer());
      const bodyBytes = body.byteLength;
      const html = body.toString('utf8');
      const hasHead = /<head(?:\s|>)/iu.test(html);
      const hasBody = /<body(?:\s|>)/iu.test(html);
      const ok = response.ok
        && contentType.toLowerCase().includes('text/html')
        && bodyBytes > 0
        && hasHead
        && hasBody;
      return {
        ok,
        url,
        status: response.status,
        contentType,
        bodyBytes,
        hasHead,
        hasBody,
        ...(!response.ok
          ? { error: `HTTP ${response.status} ${response.statusText}` }
          : !ok ? { error: 'MicroApp entry is not a complete HTML document with <head> and <body>' } : {}),
      };
    } catch (error) {
      return {
        ok: false,
        url,
        error: controller.signal.aborted
          ? 'MicroApp entry probe timed out after 10000ms'
          : error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async getTableData(tableName: string, query: Record<string, unknown> = {}): Promise<ApiResponse> {
    return this.post(API.FORM_GET_TABLE_DATA, {
      OsClient: this.config.osClient,
      FormEngineKey: tableName,
      ...query,
    });
  }

  async addFormData(tableName: string, row: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.FORM_ADD_FORM_DATA, {
      OsClient: this.config.osClient,
      FormEngineKey: tableName,
      ...row,
    });
  }

  async updateFormData(tableName: string, row: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.FORM_UPT_FORM_DATA, {
      OsClient: this.config.osClient,
      FormEngineKey: tableName,
      ...row,
    });
  }

  async getEventCode(
    formEngineKey: string,
    eventType: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<V8Event>> {
    return this.post(API.GET_EVENT_CODE, {
      OsClient: this.config.osClient,
      FormEngineKey: formEngineKey,
      EventType: eventType,
    }, options);
  }

  async saveEventCode(formEngineKey: string, eventType: string, code: string, options?: { functionDescription?: string; changeSummary?: string }): Promise<ApiResponse> {
    assertSourceIntegrity(code, `保存 V8 事件 ${formEngineKey}/${eventType}`);
    let remote: V8Event | undefined;
    try {
      const remoteResult = await this.getEventCode(formEngineKey, eventType);
      remote = remoteResult.Code === 1 ? remoteResult.Data : undefined;
    } catch {
      remote = undefined;
    }
    const prepared = prepareV8VersionedCode({
      kind: 'V8Event',
      key: formEngineKey,
      eventType,
      currentCode: code,
      remoteCode: remote?.V8Code || remote?.Code,
      remoteVersion: remote?.Version,
      functionDescription: options?.functionDescription,
      changeSummary: options?.changeSummary || `保存 V8 事件 ${formEngineKey}/${eventType}`,
    });
    const payload = {
      OsClient: this.config.osClient,
      FormEngineKey: formEngineKey,
      EventType: eventType,
      V8Code: prepared.code,
      Version: prepared.version,
      ChangeHistory: prepared.changeHistory,
    };
    try {
      return await this.post(API.UPDATE_EVENT_CODE, payload, {
        timeoutMs: this.writeRequestTimeoutMs,
        operationName: `保存 V8 事件 ${formEngineKey}/${eventType}`,
      });
    } catch (error) {
      if (!this.isUncertainWriteError(error)) throw error;
      const verification = await this.pollReadback(
        () => this.getEventCode(
          formEngineKey,
          eventType,
          this.readbackOptions(`回读 V8 事件 ${formEngineKey}/${eventType}`),
        ),
        (data) => normalizeCodeForComparison(data?.V8Code || data?.Code)
          === normalizeCodeForComparison(prepared.code),
      );
      if (verification.matched) {
        return this.recoveredWriteResult(`保存 V8 事件 ${formEngineKey}/${eventType}`, error, {
          FormEngineKey: formEngineKey,
          EventType: eventType,
          Version: prepared.version,
        });
      }
      throw this.uncertainWriteFailure(`保存 V8 事件 ${formEngineKey}/${eventType}`, error, verification.lastError);
    }
  }

  async getEventList(keyword?: string): Promise<ApiResponse<V8Event[] | ListEnvelope<V8Event>>> {
    return this.post(API.GET_EVENT_LIST, {
      OsClient: this.config.osClient,
      ...(keyword ? { _SearchKey: keyword } : {}),
    });
  }

  async getWorkflowV8EventList(flowDesignId?: string): Promise<ApiResponse<WorkflowV8EventListData>> {
    return this.post(API.GET_WORKFLOW_V8_EVENT_LIST, {
      OsClient: this.config.osClient,
      ...(flowDesignId ? { FlowDesignId: flowDesignId } : {}),
    });
  }

  async getWorkflowV8EventCode(nodeId: string, eventType: string, flowDesignId?: string): Promise<ApiResponse<WorkflowNodeV8Event>> {
    return this.post(API.GET_WORKFLOW_V8_EVENT_CODE, {
      OsClient: this.config.osClient,
      ...(flowDesignId ? { FlowDesignId: flowDesignId } : {}),
      NodeId: nodeId,
      EventType: eventType,
    });
  }

  async saveWorkflowV8EventCode(nodeId: string, eventType: string, code: string, options?: { flowDesignId?: string; functionDescription?: string; changeSummary?: string }): Promise<ApiResponse> {
    assertSourceIntegrity(code, `保存流程节点 V8 ${nodeId}/${eventType}`);
    let remote: WorkflowNodeV8Event | undefined;
    try {
      const remoteResult = await this.getWorkflowV8EventCode(nodeId, eventType, options?.flowDesignId);
      remote = remoteResult.Code === 1 ? remoteResult.Data : undefined;
    } catch {
      remote = undefined;
    }
    const shouldClear = !code.trim();
    const payload: Record<string, unknown> = {
      OsClient: this.config.osClient,
      ...(options?.flowDesignId ? { FlowDesignId: options.flowDesignId } : {}),
      NodeId: nodeId,
      EventType: eventType,
    };
    if (shouldClear) {
      payload.V8Code = '';
    } else {
      const workflowKey = `${options?.flowDesignId || remote?.FlowDesignId || 'workflow'}/${nodeId}`;
      const prepared = prepareV8VersionedCode({
        kind: 'Workflow',
        key: workflowKey,
        eventType,
        currentCode: code,
        remoteCode: remote?.V8Code || remote?.Code,
        remoteVersion: remote?.Version,
        functionDescription: options?.functionDescription,
        changeSummary: options?.changeSummary || `保存流程节点 V8 ${nodeId}/${eventType}`,
      });
      payload.V8CodeBase64 = Buffer.from(prepared.code, 'utf8').toString('base64');
      payload.Version = prepared.version;
      payload.ChangeHistory = prepared.changeHistory;
    }
    return this.post(API.UPDATE_WORKFLOW_V8_EVENT_CODE, payload);
  }

  // ---------- 低代码系统设计 API 方法 ----------

  async createTable(name: string, description?: string, options?: {
    Tabs?: string; IsTree?: number; Column?: number;
    FormOpenType?: string; FormOpenWidth?: string;
  }): Promise<ApiResponse> {
    return this.post(API.CREATE_TABLE, {
      OsClient: this.config.osClient,
      Name: name,
      Description: description || '',
      ...options,
    });
  }

  async addField(data: {
    TableId: string; Name: string; Label: string;
    Type?: string; Component?: string;
    Visible?: number; AppVisible?: number;
    Tab?: string; TableWidth?: number; Sort?: number;
    NameConfirm?: number; Readonly?: number;
    NotEmpty?: number; Unique?: number;
    DefaultValue?: string; Placeholder?: string;
    FormWidth?: number | null; Data?: string; Config?: string;
    Description?: string; Encrypt?: number; InTableEdit?: number;
  }): Promise<ApiResponse> {
    return this.post(API.ADD_FIELD, {
      OsClient: this.config.osClient,
      ...data,
      Visible: data.Visible ?? 1,
      AppVisible: data.AppVisible ?? 1,
    });
  }

  async deleteField(data: { Id: string; TableId?: string; Name?: string }): Promise<ApiResponse> {
    return this.post(API.DELETE_FIELD, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async updateField(patch: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.UPDATE_FIELD, {
      OsClient: this.config.osClient,
      ...patch,
    });
  }

  async updateFieldList(patch: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.UPDATE_FIELD_LIST, {
      OsClient: this.config.osClient,
      ...patch,
    });
  }

  async getFieldList(tableName?: string, tableId?: string): Promise<ApiResponse> {
    return this.post(API.GET_FIELD_LIST, {
      OsClient: this.config.osClient,
      TableName: tableName,
      TableId: tableId,
    });
  }

  async updateTable(patch: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.UPDATE_TABLE, {
      OsClient: this.config.osClient,
      ...patch,
    });
  }

  async refreshSchemaCache(tables: string[]): Promise<ApiResponse> {
    return this.post(API.REFRESH_SCHEMA_CACHE, {
      OsClient: this.config.osClient,
      Tables: tables,
    });
  }

  async setEngineAnonymous(apiEngineKeys: string[], allowAnonymous = 1): Promise<ApiResponse> {
    return this.post(API.SET_ENGINE_ANONYMOUS, {
      OsClient: this.config.osClient,
      ApiEngineKeys: apiEngineKeys,
      AllowAnonymous: allowAnonymous,
    });
  }

  async createModule(data: {
    Name: string; DiyTableId?: string; ParentId?: string;
    ComponentName?: string; ComponentPath?: string;
    Display?: number; AppDisplay?: number;
    OpenType?: string; Url?: string; Sort?: number;
    Icon?: string; SearchFieldIds?: string; TableDiyFieldIds?: string;
    DefaultOrderBy?: string; SqlWhere?: string;
    MenuBadgeEnabled?: number; MenuBadgeApiEngineKey?: string;
    EnableViewSchema?: number; ViewSchemaVersion?: string;
    ViewConfigVersion?: number; ViewSchema?: string;
    // 业务按钮 / 高级配置（JSON 字符串）
    MoreBtns?: string; FormBtns?: string; BatchSelectMoreBtns?: string;
    PageTabs?: string; ExportMoreBtns?: string; PageBtns?: string;
    SortFieldIds?: string; NotShowFields?: string;
    SqlJoin?: string; JoinTables?: string; SelectFields?: string;
    StatisticsFields?: string;
    InTableEdit?: number; InTableEditFields?: string;
    MobileListFields?: string;
    CardTitleTagFields?: string; CardBottomTagFields?: string;
    IsMicroiService?: number;
    MicroServiceId?: string;
    MicroServicePageId?: string;
    MicroServiceRoutePath?: string;
    MicroServiceKey?: string;
  }): Promise<ApiResponse> {
    const result = await this.post(API.CREATE_MODULE, {
      OsClient: this.config.osClient,
      ...data,
      Display: data.Display ?? 1,
      AppDisplay: data.AppDisplay ?? 1,
    });
    if (result.Code !== 1) return result;

    const hasMicroServiceBinding = Boolean(
      data.IsMicroiService === 1
      || data.MicroServiceId
      || data.MicroServicePageId
      || data.MicroServiceRoutePath,
    );
    if (!hasMicroServiceBinding) return result;

    const responseData = result.Data && typeof result.Data === 'object'
      ? result.Data as Record<string, unknown>
      : {};
    const moduleId = String(responseData.ModuleId || responseData.Id || '');
    if (!moduleId) {
      return {
        Code: 0,
        Data: { CreateResponse: result.Data },
        Msg: '菜单已创建，但返回结果缺少 ModuleId，无法写入并回读微服务关联字段。',
      };
    }

    const bindingPatch: Record<string, unknown> = {
      ModuleId: moduleId,
      IsMicroiService: 1,
      OpenType: data.OpenType || 'MicroService',
      ComponentName: data.ComponentName || 'MicroService',
      ComponentPath: data.ComponentPath || '/micro-app/host',
      Url: data.Url,
      MicroServiceId: data.MicroServiceId,
      MicroServicePageId: data.MicroServicePageId,
      MicroServiceRoutePath: data.MicroServiceRoutePath,
    };
    const bindingResult = await this.updateModule(bindingPatch);
    if (bindingResult.Code !== 1) {
      return {
        Code: 0,
        Data: {
          ModuleId: moduleId,
          CreateResponse: result.Data,
          BindingResponse: bindingResult.Data,
        },
        Msg: `菜单基础记录已创建，但微服务关联字段写入或回读失败：${bindingResult.Msg || '未知错误'}`,
      };
    }
    return {
      ...result,
      Data: {
        ...responseData,
        MicroServiceBindingVerified: true,
        BindingVerification: bindingResult.Data,
      },
    };
  }

  async setRolePermission(roleId: string, menuIds: string[]): Promise<ApiResponse> {
    return this.post(API.SET_ROLE_PERMISSION, {
      OsClient: this.config.osClient,
      RoleId: roleId,
      MenuIds: menuIds,
    });
  }

  async listRoles(keyword?: string): Promise<ApiResponse> {
    return this.post(API.LIST_ROLES, {
      OsClient: this.config.osClient,
      ...(keyword ? { Keyword: keyword } : {}),
    });
  }

  async saveRole(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.SAVE_ROLE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async listModules(keyword?: string): Promise<ApiResponse> {
    return this.post(API.LIST_MODULES, {
      OsClient: this.config.osClient,
      ...(keyword ? { Keyword: keyword } : {}),
    });
  }

  async getModule(moduleId: string, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.post(API.GET_MODULE, {
      OsClient: this.config.osClient,
      ModuleId: moduleId,
    }, options);
  }

  async updateModule(data: Record<string, unknown>): Promise<ApiResponse> {
    const payload: Record<string, unknown> = {
      OsClient: this.config.osClient,
      ...data,
    };
    const moduleId = String(payload.ModuleId || payload.Id || '');
    const operation = `更新菜单模块 ${moduleId || payload.Name || ''}`.trim();
    assertPayloadSourceIntegrity(payload, operation);
    const verify = async (): Promise<{ matched: boolean; mismatches: string[]; response?: ApiResponse }> => {
      if (!moduleId) return { matched: false, mismatches: ['ModuleId'] };
      try {
        const response = await this.getModule(
          moduleId,
          this.readbackOptions(`回读菜单模块 ${moduleId}`),
        );
        if (response.Code !== 1 || !response.Data || typeof response.Data !== 'object') {
          return { matched: false, mismatches: ['回读失败'], response };
        }
        const comparison = modulePatchMatches(payload, response.Data as Record<string, unknown>);
        return { ...comparison, response };
      } catch {
        return { matched: false, mismatches: ['回读请求异常'] };
      }
    };

    try {
      const result = await this.post(API.UPDATE_MODULE, payload, {
        timeoutMs: this.writeRequestTimeoutMs,
        operationName: operation,
      });
      if (result.Code !== 1) return result;
      const verification = await verify();
      if (!verification.matched) {
        return {
          Code: 0,
          Data: {
            ModuleId: moduleId,
            Mismatches: verification.mismatches,
            UpdateResponse: result.Data,
          },
          Msg: `${operation} 接口返回成功，但远端回读不一致：${verification.mismatches.join(', ')}`,
        };
      }
      return {
        ...result,
        Data: {
          ...(result.Data && typeof result.Data === 'object' ? result.Data as Record<string, unknown> : {}),
          Verified: true,
          Verification: 'readback',
        },
      };
    } catch (error) {
      if (!this.isUncertainWriteError(error)) throw error;
      let lastMismatches: string[] = [];
      const verification = await this.pollReadback(
        async () => {
          const readback = await verify();
          lastMismatches = readback.mismatches;
          return {
            Code: readback.response?.Code ?? (readback.matched ? 1 : 0),
            Data: readback,
            Msg: readback.response?.Msg || '',
          };
        },
        (readback) => readback.matched,
      );
      if (verification.matched) {
        return this.recoveredWriteResult(operation, error, {
          ModuleId: moduleId,
          Verified: true,
        });
      }
      throw this.uncertainWriteFailure(
        operation,
        error,
        lastMismatches.length ? `字段不一致：${lastMismatches.join(', ')}` : verification.lastError,
      );
    }
  }

  async listDataSources(keyword?: string): Promise<ApiResponse> {
    return this.post(API.LIST_DATA_SOURCES, {
      OsClient: this.config.osClient,
      ...(keyword ? { Keyword: keyword } : {}),
    });
  }

  async saveDataSource(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.SAVE_DATA_SOURCE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async runDataSource(dataSourceKey: string, params?: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.RUN_DATA_SOURCE, {
      OsClient: this.config.osClient,
      DataSourceKey: dataSourceKey,
      ...(params || {}),
    });
  }

  async listPrintTemplates(keyword?: string): Promise<ApiResponse> {
    return this.post(API.LIST_PRINT_TEMPLATES, {
      OsClient: this.config.osClient,
      ...(keyword ? { Keyword: keyword } : {}),
    });
  }

  async savePrintTemplate(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.SAVE_PRINT_TEMPLATE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async saveWorkflowPackage(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.SAVE_WORKFLOW_PACKAGE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async saveJob(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.SAVE_JOB, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async validateLowCodeSystem(manifest: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.VALIDATE_LOW_CODE_SYSTEM, {
      OsClient: this.config.osClient,
      Manifest: manifest,
    });
  }

  async writeAuditLog(action: string, target: string, content: string): Promise<ApiResponse> {
    return this.post(API.WRITE_MCP_AUDIT_LOG, {
      OsClient: this.config.osClient,
      Action: action,
      Target: target,
      Content: content,
    });
  }

  async queryMongodbLogs(query: MongodbLogQuery = {}): Promise<ApiResponse> {
    return this.post(API.QUERY_MONGODB_LOGS, {
      OsClient: this.config.osClient,
      Keyword: query.keyword,
      Type: query.type,
      Level: query.level,
      SearchMonth: query.searchMonth,
      PageIndex: query.pageIndex || 1,
      PageSize: query.pageSize || 20,
    });
  }

  async writeMongodbLog(log: MongodbLogWrite): Promise<ApiResponse> {
    return this.post(API.WRITE_MONGODB_LOG, {
      OsClient: this.config.osClient,
      Type: log.type || 'MCP',
      Title: log.title,
      Content: log.content,
      Level: log.level || 1,
      Api: log.api || 'microi.mcp',
      Param: log.param || '',
      Remark: log.remark || '',
      OtherInfo: log.otherInfo || '',
      Timer: log.timer,
      Result: log.result || '',
      AppId: log.appId || 'microi.mcp',
    });
  }

  async getRedisStatistics(database = 0, connectionId?: string): Promise<ApiResponse> {
    return this.post(API.REDIS_STATISTICS, {
      Mode: connectionId ? 'saved' : 'tenant',
      ConnectionId: connectionId || '',
      Database: database,
    });
  }

  async getRedisKeys(pattern = '*', database = 0, pageSize = 100, cursor?: string, connectionId?: string): Promise<ApiResponse> {
    return this.post(API.REDIS_KEYS, {
      Mode: connectionId ? 'saved' : 'tenant',
      ConnectionId: connectionId || '',
      Database: database,
      Pattern: pattern,
      PageSize: pageSize,
      Cursor: cursor || '',
    });
  }

  async getRedisKey(key: string, database = 0, pageIndex = 1, pageSize = 500, connectionId?: string): Promise<ApiResponse> {
    return this.post(API.REDIS_KEY, {
      Mode: connectionId ? 'saved' : 'tenant',
      ConnectionId: connectionId || '',
      Database: database,
      Key: key,
      PageIndex: pageIndex,
      PageSize: pageSize,
    });
  }

  async deleteRedisKeys(keys: string[], database = 0, connectionId?: string): Promise<ApiResponse> {
    return this.post(API.REDIS_DELETE_KEYS, {
      Mode: connectionId ? 'saved' : 'tenant',
      ConnectionId: connectionId || '',
      Database: database,
      Keys: keys,
    });
  }

  async replaceRedisValue(key: string, dataType: string, value: string, database = 0, ttlSeconds?: number, connectionId?: string): Promise<ApiResponse> {
    return this.post(API.REDIS_REPLACE_VALUE, {
      Mode: connectionId ? 'saved' : 'tenant',
      ConnectionId: connectionId || '',
      Database: database,
      Key: key,
      DataType: dataType,
      Value: value,
      ...(ttlSeconds === undefined ? {} : { TtlSeconds: ttlSeconds }),
    });
  }

  async renameRedisKey(key: string, newKey: string, database = 0, connectionId?: string): Promise<ApiResponse> {
    return this.post(API.REDIS_RENAME_KEY, {
      Mode: connectionId ? 'saved' : 'tenant',
      ConnectionId: connectionId || '',
      Database: database,
      Key: key,
      NewKey: newKey,
    });
  }

  async setRedisTtl(key: string, ttlSeconds: number, database = 0, connectionId?: string): Promise<ApiResponse> {
    return this.post(API.REDIS_SET_TTL, {
      Mode: connectionId ? 'saved' : 'tenant',
      ConnectionId: connectionId || '',
      Database: database,
      Key: key,
      TtlSeconds: ttlSeconds,
    });
  }

  // ---------- 界面引擎 API 方法 ----------

  async getPageEngineList(keyword?: string): Promise<ApiResponse> {
    return this.post(API.GET_PAGE_ENGINE_LIST, {
      OsClient: this.config.osClient,
      ...(keyword ? { Keyword: keyword } : {}),
    });
  }

  async getPageEngineDetail(pageId: string): Promise<ApiResponse> {
    return this.post(API.GET_PAGE_ENGINE_DETAIL, {
      OsClient: this.config.osClient,
      PageId: pageId,
    });
  }

  async savePageEngine(data: {
    PageId?: string; Title: string; Number?: string;
    Desc?: string; JsonStr: string; RoutePath?: string; ComponentPath?: string;
  }): Promise<ApiResponse> {
    return this.post(API.SAVE_PAGE_ENGINE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  // ---------- 业务架构蓝图（System Blueprint） ----------

  async listBlueprints(keyword?: string): Promise<ApiResponse> {
    return this.post(API.LIST_BLUEPRINTS, {
      OsClient: this.config.osClient,
      ...(keyword ? { Keyword: keyword } : {}),
    });
  }

  async getBlueprint(blueprintId: string): Promise<ApiResponse> {
    return this.post(API.GET_BLUEPRINT, {
      OsClient: this.config.osClient,
      BlueprintId: blueprintId,
    });
  }

  async saveBlueprint(data: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.SAVE_BLUEPRINT, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async deleteBlueprint(blueprintId: string): Promise<ApiResponse> {
    return this.post(API.DELETE_BLUEPRINT, {
      OsClient: this.config.osClient,
      BlueprintId: blueprintId,
    });
  }

  async validateBlueprint(blueprintId: string): Promise<ApiResponse> {
    return this.post(API.VALIDATE_BLUEPRINT, {
      OsClient: this.config.osClient,
      BlueprintId: blueprintId,
    });
  }

  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }
}
