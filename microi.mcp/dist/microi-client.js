import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import { API } from './api-paths.js';
import { resolveMcpDid } from './mcp-did.js';
import { normalizeAuthorizationToken, selectPreferredAuthorizationTokenFromCandidates, shouldRefreshAuthorizationToken, } from './token-utils.js';
import { assertPayloadSourceIntegrity, assertSourceIntegrity } from './source-integrity.js';
import { prepareV8VersionedCode } from './v8-version.js';
import { readWorkspaceCredentials } from './workspace-protected-credentials.js';
/** Microi 后端登录身份失效错误码（与 diy_lang 表中 NoLogin 一致） */
const AUTH_FAILURE_CODES = new Set([1001, 1002]);
const DEFAULT_LOGIN_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R
XaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ
1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg
1DsI9VJ7gTHGL3R7sQIDAQAB
-----END PUBLIC KEY-----`;
/**
 * Return token-file keys from the most specific tenant identity to legacy keys.
 * New writers use api|os|type|network even when type/network are empty, while
 * readers keep accepting the older compact api|os|type, api|os and api layouts
 * during migration. Keeping the empty segments is important: the VS Code
 * broker may intentionally leave an ambiguous legacy alias untouched.
 */
export function buildTokenFileLookupKeys(apiBaseUrl, osClient = '', osClientType = '', osClientNetwork = '') {
    const apiUrl = String(apiBaseUrl || '').replace(/\/+$/, '');
    const tenant = String(osClient || '').trim();
    const tenantType = String(osClientType || '').trim();
    const tenantNetwork = String(osClientNetwork || '').trim();
    const keys = [];
    if (tenant) {
        keys.push(`${apiUrl}|${tenant}|${tenantType}|${tenantNetwork}`);
        // Login can happen before the backend reports Type/Network, so the broker
        // first stores the fresh token under the canonical untyped identity. Keep
        // that same-tenant alias in typed lookups; issuance-time arbitration below
        // prevents a stale typed exact key from winning forever.
        keys.push(`${apiUrl}|${tenant}||`);
        const compactIdentity = [apiUrl, tenant, tenantType, tenantNetwork]
            .filter(Boolean)
            .join('|');
        keys.push(compactIdentity);
        if (tenantType) {
            keys.push(`${apiUrl}|${tenant}|${tenantType}`);
        }
        keys.push(`${apiUrl}|${tenant}`);
    }
    keys.push(apiUrl);
    return Array.from(new Set(keys.filter(Boolean)));
}
export function buildMicroAppEntryUrl(apiBaseUrl, osClient, msKey) {
    const apiUrl = String(apiBaseUrl || '').replace(/\/+$/, '');
    return `${apiUrl}/micro-app/${encodeURIComponent(String(osClient || '').trim())}/${encodeURIComponent(String(msKey || '').trim())}/index.html`;
}
export function isTenantConfigurationFailureResponse(result) {
    const reasonCode = String(result?.DataAppend?.ReasonCode || '').trim();
    if (/^(InvalidTenant|InvalidOsClient|TenantNotFound|TenantDisabled)$/i.test(reasonCode)) {
        return true;
    }
    const message = [result?.Msg, result?.DataAppend?.UserMessage, result?.DataAppend?.Hint]
        .filter(Boolean)
        .join(' ');
    return /无效的租户标识|租户不存在|租户.*未启用|invalid\s+(tenant|osclient)|tenant\s+not\s+found|unknown\s+tenant/i.test(message);
}
export function isAuthenticationFailureResponse(result) {
    if (!result || isTenantConfigurationFailureResponse(result)) {
        return false;
    }
    if (AUTH_FAILURE_CODES.has(Number(result.Code))) {
        return true;
    }
    const reasonCode = String(result.DataAppend?.ReasonCode || '').trim();
    if (/^(MissingToken|MalformedToken|MissingClaims|TenantMismatch|AuthVersionChanged|JwtExpired|SessionExpired|SessionMissing|TokenReplaced|SignatureMismatch)$/i.test(reasonCode)) {
        return true;
    }
    const message = [result.Msg, result.DataAppend?.UserMessage, result.DataAppend?.AppendMsg]
        .filter(Boolean)
        .join(' ');
    return /Token签名|Token.*(无效|失效|过期)|登录.*(无效|失效|过期)|invalid\s*token|token\s*invalid|signature\s*mismatch/i.test(message);
}
function nextAuthRecoveryStage(stage) {
    if (stage === 'initial') {
        return 'replacement-token';
    }
    if (stage === 'replacement-token') {
        return 'broker-token';
    }
    return 'credential-token';
}
export class MicroiTransportError extends Error {
    kind;
    requestPath;
    uncertainOutcome;
    constructor(message, options) {
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
const LEGACY_APPLICATION_ASSET_STREAM_MAX_BYTES = 128 * 1024 * 1024;
const DEFAULT_APPLICATION_ASSET_MULTIPART_CHUNK_BYTES = 16 * 1024 * 1024;
const OCR_REQUEST_TIMEOUT_MS = 315_000;
const TRANSLATE_REQUEST_TIMEOUT_MS = 315_000;
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
function resolveTimeoutMs(value, fallback, maximum = 10 * 60_000) {
    const parsed = Number(value);
    const safeMaximum = Number.isFinite(maximum) && maximum >= 1_000
        ? Math.round(maximum)
        : 10 * 60_000;
    if (!Number.isFinite(parsed) || parsed < 1_000) {
        return Math.min(safeMaximum, fallback);
    }
    return Math.min(safeMaximum, Math.round(parsed));
}
function resolveStreamUploadTimeoutMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1_000)
        return DEFAULT_STREAM_UPLOAD_TIMEOUT_MS;
    return Math.min(MAX_STREAM_UPLOAD_TIMEOUT_MS, Math.round(parsed));
}
function buildMultipartFileBody(fields, filePath, fileName, boundary, contentEncoding) {
    const chunks = [];
    for (const [name, value] of Object.entries(fields)) {
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, 'utf8'));
    }
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`, 'utf8'));
    const prefix = Buffer.concat(chunks);
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const fileSize = fs.statSync(filePath).size;
    async function* streamParts() {
        yield prefix;
        const fileStream = fs.createReadStream(filePath);
        const transportStream = contentEncoding === 'gzip'
            ? fileStream.pipe(createGzip())
            : fileStream;
        for await (const chunk of transportStream) {
            yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        }
        yield suffix;
    }
    return {
        body: Readable.from(streamParts()),
        contentLength: prefix.length + fileSize + suffix.length,
    };
}
async function sha256LocalFileRange(filePath, start, length) {
    const hash = crypto.createHash('sha256');
    if (length > 0) {
        const stream = fs.createReadStream(filePath, {
            start,
            end: start + length - 1,
        });
        for await (const chunk of stream)
            hash.update(chunk);
    }
    return hash.digest('hex');
}
function applicationAssetV3ProtocolPayload(data) {
    if (data.ProtocolVersion !== 3)
        return {};
    return {
        ProtocolVersion: 3,
        PublishMode: 'stage',
        ExpectedGateEpoch: String(data.ExpectedGateEpoch ?? ''),
        RequestFingerprint: String(data.RequestFingerprint ?? ''),
        DeliveryBatchId: String(data.DeliveryBatchId ?? ''),
        SourceManifestHash: String(data.SourceManifestHash ?? ''),
        RuntimeManifestHash: String(data.RuntimeManifestHash ?? ''),
        RouteSnapshotJson: String(data.RouteSnapshotJson ?? ''),
        RouteSnapshotHash: String(data.RouteSnapshotHash ?? ''),
        ExpectedCurrentVersion: Number(data.ExpectedCurrentVersion),
        ExpectedAppVersion: data.ExpectedAppVersion ?? null,
        ExpectedPublishFence: String(data.ExpectedPublishFence ?? ''),
        ExpectedPublishRowVersion: String(data.ExpectedPublishRowVersion ?? ''),
        ExpectedVersionRowVersion: data.ExpectedVersionRowVersion ?? null,
        ExpectedActivePublishVersionId: data.ExpectedActivePublishVersionId ?? null,
        ExpectedCommittedPublishVersionId: data.ExpectedCommittedPublishVersionId ?? null,
    };
}
function normalizeCodeForComparison(value) {
    return String(value ?? '').replace(/\r\n/g, '\n').trim();
}
function apiEngineV8LimitValue(value) {
    if (value?.V8Limit !== undefined && value.V8Limit !== null) {
        return Number(value.V8Limit) === 1 ? 1 : 0;
    }
    if (value?.V8Unlimited !== undefined && value.V8Unlimited !== null) {
        return Number(value.V8Unlimited) === 1 ? 0 : 1;
    }
    return 0;
}
function stripMenuRuntimeFields(value) {
    if (Array.isArray(value))
        return value.map(stripMenuRuntimeFields);
    if (!value || typeof value !== 'object')
        return value;
    const entries = Object.entries(value)
        .filter(([key]) => !key.startsWith('_'))
        .sort(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(entries.map(([key, item]) => [key, stripMenuRuntimeFields(item)]));
}
function canonicalMenuJson(value) {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return JSON.stringify(stripMenuRuntimeFields(parsed));
    }
    catch {
        return undefined;
    }
}
function modulePatchMatches(expected, actual) {
    const ignoredFields = new Set(['OsClient', 'ModuleId', 'Id']);
    const mismatches = [];
    for (const [field, expectedValue] of Object.entries(expected)) {
        if (ignoredFields.has(field) || expectedValue === undefined)
            continue;
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
/**
 * Microi 后端 HTTP 客户端
 * - RSA 加密登录（与 Microi 前端 JSEncrypt 兼容）
 * - JWT 自动刷新
 */
export class MicroiClient {
    config;
    token = '';
    refreshTimer;
    rsaPublicKey;
    did;
    requestTimeoutMs;
    writeRequestTimeoutMs;
    readbackRequestTimeoutMs;
    /** 同一时刻只允许一个刷新请求在飞 */
    inflightRefresh;
    /** 同一时刻只允许一条完整身份恢复链路，避免并发重登或重复写恢复请求。 */
    inflightAuthRecovery;
    /** 刷新签发的替代 Token 仍被拒绝时，凭据恢复阶段也必须 single-flight。 */
    inflightCredentialRecovery;
    constructor(config) {
        this.config = config;
        this.reloadWorkspaceCredentials();
        this.rsaPublicKey = config.rsaPublicKey || DEFAULT_LOGIN_RSA_PUBLIC_KEY;
        this.did = resolveMcpDid(process.env.MICROI_MCP_DID, os.hostname());
        this.requestTimeoutMs = resolveTimeoutMs(config.requestTimeoutMs ?? process.env.MICROI_MCP_HTTP_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS);
        this.writeRequestTimeoutMs = resolveTimeoutMs(config.writeRequestTimeoutMs ?? process.env.MICROI_MCP_WRITE_TIMEOUT_MS, DEFAULT_WRITE_REQUEST_TIMEOUT_MS);
        this.readbackRequestTimeoutMs = resolveTimeoutMs(config.readbackRequestTimeoutMs ?? process.env.MICROI_MCP_READBACK_TIMEOUT_MS, DEFAULT_READBACK_REQUEST_TIMEOUT_MS);
        // 如果直接传入 token，跳过登录流程
        if (config.token) {
            this.token = normalizeAuthorizationToken(config.token);
        }
    }
    /** RSA 加密（PKCS1_PADDING，兼容 Microi 前端 JSEncrypt） */
    rsaEncrypt(plainText) {
        const publicKey = (this.rsaPublicKey || '').trim();
        if (!publicKey) {
            return plainText;
        }
        const encrypted = crypto.publicEncrypt({ key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(plainText, 'utf-8'));
        return encrypted.toString('base64');
    }
    /** 外部更新 token（由 VS Code 扩展 token 文件同步） */
    updateToken(newToken) {
        this.token = normalizeAuthorizationToken(newToken);
    }
    /** 登录并获取 JWT token（若已有 token 则直接启动刷新）
     *  注意：即便传入了 token（来自 VS Code 扩展的 token 文件），也始终启动 MCP 自身的自动刷新作为兜底，
     *  避免 VS Code 关闭时 token 不再续期导致 MCP 调用失败。
     */
    async login(_options) {
        // 若通过 token 初始化，跳过登录
        if (this.token) {
            this.startAutoRefresh();
            console.error('[microi-mcp] Using provided token (auto-refresh enabled)');
            return;
        }
        this.reloadWorkspaceCredentials();
        if (!this.config.username || !this.config.password) {
            throw new Error('Login credentials are unavailable from environment or workspace protected storage');
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
        let json;
        try {
            json = JSON.parse(text);
        }
        catch {
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
    startAutoRefresh() {
        if (this.refreshTimer)
            clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(() => {
            if (shouldRefreshAuthorizationToken(this.token)) {
                this.refreshTokenNow().catch((e) => console.error('[microi-mcp] Token refresh failed:', e));
            }
        }, 60 * 60 * 1000);
    }
    /** 立即调用 /api/SysUser/RefreshToken 以旧换新；成功后回写 token 文件。
     *  并发请求会复用同一个 in-flight Promise。
     */
    async refreshTokenNow() {
        if (this.inflightRefresh)
            return this.inflightRefresh;
        if (!this.token)
            return false;
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
                let json = null;
                try {
                    json = JSON.parse(text);
                }
                catch { /* ignore */ }
                if (newToken && json?.Code === 1) {
                    this.token = normalizeAuthorizationToken(newToken);
                    this.writeTokenToFile();
                    console.error('[microi-mcp] Token refreshed');
                    return true;
                }
                console.error(`[microi-mcp] Refresh rejected: Code=${json?.Code} Msg=${json?.Msg || ''}`);
                return false;
            }
            catch (e) {
                console.error('[microi-mcp] Refresh request error:', e);
                return false;
            }
            finally {
                this.inflightRefresh = undefined;
            }
        })();
        return this.inflightRefresh;
    }
    /** 从 token 文件重新读取（VS Code 扩展可能刚刚写入了新 token）。返回是否更新了 this.token。 */
    reloadTokenFromFile() {
        const filePath = this.config.tokenFilePath;
        if (!filePath)
            return false;
        try {
            const tokens = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const lookupKeys = buildTokenFileLookupKeys(this.config.apiBaseUrl, this.config.osClient, this.config.osClientType, this.config.osClientNetwork);
            const apiKey = String(this.config.apiBaseUrl || '').replace(/\/+$/, '');
            const tenantKeys = this.config.osClient
                ? lookupKeys.filter(key => key !== apiKey)
                : lookupKeys;
            const fileToken = selectPreferredAuthorizationTokenFromCandidates(tenantKeys.map(key => tokens[key])) || tokens[apiKey];
            const normalizedFileToken = normalizeAuthorizationToken(fileToken);
            if (normalizedFileToken && normalizedFileToken !== this.token) {
                this.token = normalizedFileToken;
                return true;
            }
        }
        catch { /* ignore */ }
        return false;
    }
    /** 把当前 token 回写到 token 文件（保持与 VS Code 扩展同步） */
    writeTokenToFile() {
        const filePath = this.config.tokenFilePath;
        if (!filePath || !this.token)
            return;
        try {
            let tokens = {};
            try {
                tokens = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
            catch { /* file may not exist yet */ }
            const [tokenKey] = buildTokenFileLookupKeys(this.config.apiBaseUrl, this.config.osClient, this.config.osClientType, this.config.osClientNetwork);
            if (!tokenKey)
                return;
            tokens[tokenKey] = this.token;
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', mode: 0o600 });
        }
        catch (e) {
            console.error('[microi-mcp] Write token file failed:', e);
        }
    }
    async requestVsCodeCredentialRecovery(failedToken) {
        const recoveryDir = this.config.authRecoveryRequestDir;
        const tokenFilePath = this.config.tokenFilePath;
        if (!recoveryDir || !tokenFilePath) {
            return false;
        }
        try {
            if (!fs.existsSync(recoveryDir))
                fs.mkdirSync(recoveryDir, { recursive: true });
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
        }
        catch (e) {
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
    async tryRecoverFromAuthFailure(rejectedToken, credentialOnly = false) {
        // 其它并发请求已更新了当前 Token，直接复用新状态。
        if (this.token && rejectedToken && this.token !== rejectedToken) {
            return true;
        }
        if (credentialOnly) {
            if (this.inflightCredentialRecovery) {
                return this.inflightCredentialRecovery;
            }
            const primaryRecovery = this.inflightAuthRecovery;
            this.inflightCredentialRecovery = (async () => {
                // 若首段刷新仍在飞，先等它收敛；只要它已换成其它 Token，当前请求可直接重试。
                if (primaryRecovery) {
                    await primaryRecovery;
                }
                if (this.token && rejectedToken && this.token !== rejectedToken) {
                    return true;
                }
                return this.tryRecoverFromAuthFailureCore(rejectedToken, true);
            })();
            try {
                return await this.inflightCredentialRecovery;
            }
            finally {
                this.inflightCredentialRecovery = undefined;
            }
        }
        // 更强的凭据恢复已在执行时，首段请求应复用它，不再并发刷新。
        if (this.inflightCredentialRecovery) {
            return this.inflightCredentialRecovery;
        }
        if (this.inflightAuthRecovery) {
            return this.inflightAuthRecovery;
        }
        this.inflightAuthRecovery = this.tryRecoverFromAuthFailureCore(rejectedToken, false);
        try {
            return await this.inflightAuthRecovery;
        }
        finally {
            this.inflightAuthRecovery = undefined;
        }
    }
    async tryRecoverFromAuthFailureCore(failedToken, credentialOnly) {
        if (this.token && failedToken && this.token !== failedToken) {
            return true;
        }
        // 1. 先尝试读文件，可能 VS Code 已经刷过了
        if (this.reloadTokenFromFile()) {
            console.error('[microi-mcp] Token reloaded from file after auth failure');
            return true;
        }
        // 2. 只有首段恢复才允许主动刷新。刷新签发的 Token 若立即被拒绝，
        // 第二段必须跳过 RefreshToken，否则会在同一枚无效 Token 上循环。
        if (!credentialOnly && await this.refreshTokenNow())
            return true;
        // 3. 优先重新读取工作区 DPAPI 保险库（密码可能刚由 VS Code/CLI 更新），
        // 再使用内存凭据重新登录。明文不会进入 MCP 配置或环境变量。
        this.reloadWorkspaceCredentials();
        if (this.config.username && this.config.password) {
            try {
                this.token = '';
                await this.login();
                if (this.token && this.token !== failedToken) {
                    this.writeTokenToFile();
                    console.error('[microi-mcp] Re-logged in after auth failure');
                    return true;
                }
            }
            catch (e) {
                this.token = failedToken;
                console.error('[microi-mcp] Re-login failed:', e);
            }
        }
        // 4. VS Code 托管模式：请求扩展宿主使用 SecretStorage 重登。
        return this.requestVsCodeCredentialRecovery(failedToken);
    }
    reloadWorkspaceCredentials() {
        const credentials = readWorkspaceCredentials({
            filePath: this.config.workspaceCredentialFilePath,
            usernameKey: this.config.workspaceCredentialUsernameKey,
            passwordKey: this.config.workspaceCredentialPasswordKey,
        });
        if (!credentials) {
            return false;
        }
        this.config.username = credentials.username;
        this.config.password = credentials.password;
        return true;
    }
    /** 通用 POST 请求（自动处理 token 失效：刷新后重试一次） */
    async post(reqPath, body, options = {}) {
        return this.requestJson('POST', reqPath, body, undefined, 'initial', options);
    }
    /** 通用 GET 请求（自动处理 token 失效：刷新后重试一次） */
    async get(reqPath, params, options = {}) {
        return this.requestJson('GET', reqPath, undefined, params, 'initial', options);
    }
    async requestJson(method, reqPath, body, params, authRecoveryStage = 'initial', options = {}) {
        let url = `${this.config.apiBaseUrl}${reqPath}`;
        if (method === 'GET' && params) {
            const qs = new URLSearchParams(params).toString();
            if (qs)
                url += `?${qs}`;
        }
        const requestToken = this.token;
        const headers = { Authorization: `Bearer ${requestToken}`, did: this.did };
        if (this.config.osClient)
            headers.OsClient = this.config.osClient;
        if (method === 'POST')
            headers['Content-Type'] = 'application/json';
        const timeoutMs = resolveTimeoutMs(options.timeoutMs, this.requestTimeoutMs, options.maxTimeoutMs);
        const operationName = options.operationName || `${method} ${reqPath}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let res;
        let text;
        const jsonBody = method === 'POST' ? JSON.stringify(body ?? {}) : undefined;
        try {
            const fetchResponse = await fetch(url, {
                method,
                headers,
                signal: controller.signal,
                ...(jsonBody !== undefined ? { body: jsonBody } : {}),
            });
            res = fetchResponse;
            text = await fetchResponse.text();
        }
        catch (error) {
            const isTimeout = controller.signal.aborted;
            if (isTimeout) {
                throw new MicroiTransportError(`${operationName} 请求超时（${timeoutMs}ms）`, {
                    kind: 'timeout',
                    requestPath: reqPath,
                    uncertainOutcome: method === 'POST',
                    cause: error,
                });
            }
            // Undici fetch can be reset by reverse proxies for otherwise valid JSON
            // requests (notably the bounded MicroService compatibility publisher).
            // Reuse the exact serialized body through node:http(s); callers retain
            // their existing CAS/readback guards for uncertain POST outcomes.
            try {
                await new Promise(resolve => setTimeout(resolve, 250));
                const nativeResponse = await this.requestJsonNative(method, url, headers, jsonBody, timeoutMs);
                res = nativeResponse.res;
                text = nativeResponse.text;
            }
            catch (nativeError) {
                const fetchMessage = error instanceof Error ? error.message : String(error);
                const nativeMessage = nativeError instanceof Error ? nativeError.message : String(nativeError);
                throw new MicroiTransportError(`${operationName} 网络请求失败：fetch=${fetchMessage}；native=${nativeMessage}`, {
                    kind: 'network',
                    requestPath: reqPath,
                    uncertainOutcome: method === 'POST',
                    cause: nativeError,
                });
            }
        }
        finally {
            clearTimeout(timer);
        }
        const newToken = res.headers.get('authorization');
        if (newToken) {
            this.token = normalizeAuthorizationToken(newToken);
            this.writeTokenToFile();
        }
        // HTTP 401 → 首段允许刷新；后续阶段只允许凭据恢复。
        // Broker 第一次可能只同步 VS Code 已有的不同 Token；若它也被拒绝，
        // 再提交一次它的失败哈希，扩展就能安全确认需要 SecretStorage 重登。
        if (res.status === 401 && authRecoveryStage !== 'credential-token') {
            const credentialOnly = authRecoveryStage !== 'initial';
            if (credentialOnly) {
                console.error('[microi-mcp] Replacement token was rejected; escalating to credential recovery');
            }
            if (await this.tryRecoverFromAuthFailure(requestToken, credentialOnly)) {
                return this.requestJson(method, reqPath, body, params, nextAuthRecoveryStage(authRecoveryStage), options);
            }
            throw new Error(`HTTP 401 Unauthorized — token recovery failed: ${text.slice(0, 200)}`);
        }
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
        }
        if (!text) {
            throw new Error(`HTTP ${res.status} — empty response body`);
        }
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch {
            throw new Error(`HTTP ${res.status} — invalid JSON: ${text.slice(0, 200)}`);
        }
        // Microi 历史版本可能用 Code=1001/1002、ReasonCode 或签名失败文本表达身份失效。
        if (isAuthenticationFailureResponse(parsed) && authRecoveryStage !== 'credential-token') {
            console.error(`[microi-mcp] Auth expired (Code=${parsed.Code}: ${parsed.Msg || ''}), attempting recovery...`);
            const credentialOnly = authRecoveryStage !== 'initial';
            if (credentialOnly) {
                console.error('[microi-mcp] Replacement token was rejected; escalating to credential recovery');
            }
            if (await this.tryRecoverFromAuthFailure(requestToken, credentialOnly)) {
                return this.requestJson(method, reqPath, body, params, nextAuthRecoveryStage(authRecoveryStage), options);
            }
        }
        return parsed;
    }
    /**
     * Stream one local file as multipart without materializing it as Base64 or a
     * whole-file Buffer. A retry constructs a fresh file stream, so auth recovery
     * remains safe for large immutable application assets.
     */
    async requestMultipartFile(reqPath, fields, filePath, fileName, authRecoveryStage = 'initial', timeoutMs, contentEncoding) {
        const requestToken = this.token;
        const transportFields = contentEncoding === 'gzip'
            ? { ...fields, ContentEncoding: 'gzip' }
            : fields;
        const boundary = `----microi-mcp-${crypto.randomBytes(24).toString('hex')}`;
        const multipart = buildMultipartFileBody(transportFields, filePath, fileName, boundary, contentEncoding);
        const controller = new AbortController();
        const effectiveTimeout = resolveStreamUploadTimeoutMs(timeoutMs);
        const timer = setTimeout(() => controller.abort(), effectiveTimeout);
        let res;
        let text;
        try {
            const fetchResponse = await fetch(`${this.config.apiBaseUrl}${reqPath}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${requestToken}`,
                    did: this.did,
                    ...(this.config.osClient ? { OsClient: this.config.osClient } : {}),
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                },
                body: multipart.body,
                // Node.js fetch requires duplex for a streaming request body.
                duplex: 'half',
                signal: controller.signal,
            });
            res = fetchResponse;
            text = await fetchResponse.text();
        }
        catch (error) {
            const isTimeout = controller.signal.aborted;
            if (isTimeout) {
                throw new MicroiTransportError(`应用资产流式上传超时（${effectiveTimeout}ms）`, {
                    kind: 'timeout',
                    requestPath: reqPath,
                    uncertainOutcome: true,
                    cause: error,
                });
            }
            // Undici/Node fetch occasionally aborts a streaming multipart request
            // after a previous keep-alive upload, even though the same endpoint and
            // payload are accepted by node:https. Application assets carry a stable
            // RequestId and are immutable, so retrying the same request through the
            // native transport is idempotent and avoids materialising the file.
            try {
                await new Promise(resolve => setTimeout(resolve, 250));
                const nativeResponse = await this.requestMultipartFileNative(reqPath, transportFields, filePath, fileName, effectiveTimeout, contentEncoding);
                res = nativeResponse.res;
                text = nativeResponse.text;
            }
            catch (nativeError) {
                const fetchMessage = error instanceof Error ? error.message : String(error);
                const nativeMessage = nativeError instanceof Error ? nativeError.message : String(nativeError);
                if (contentEncoding !== 'gzip') {
                    try {
                        return await this.requestMultipartFile(reqPath, fields, filePath, fileName, authRecoveryStage, timeoutMs, 'gzip');
                    }
                    catch (gzipError) {
                        const gzipMessage = gzipError instanceof Error ? gzipError.message : String(gzipError);
                        throw new MicroiTransportError(`应用资产流式上传网络失败：fetch=${fetchMessage}；native=${nativeMessage}；gzip=${gzipMessage}`, {
                            kind: 'network',
                            requestPath: reqPath,
                            uncertainOutcome: true,
                            cause: gzipError,
                        });
                    }
                }
                throw new MicroiTransportError(`应用资产 gzip 流式上传网络失败：fetch=${fetchMessage}；native=${nativeMessage}`, {
                    kind: 'network',
                    requestPath: reqPath,
                    uncertainOutcome: true,
                    cause: nativeError,
                });
            }
        }
        finally {
            clearTimeout(timer);
            multipart.body.destroy();
        }
        const newToken = res.headers.get('authorization');
        if (newToken) {
            this.token = normalizeAuthorizationToken(newToken);
            this.writeTokenToFile();
        }
        if (res.status === 401 && authRecoveryStage !== 'credential-token') {
            const credentialOnly = authRecoveryStage !== 'initial';
            if (credentialOnly) {
                console.error('[microi-mcp] Replacement token was rejected; escalating to credential recovery');
            }
            if (await this.tryRecoverFromAuthFailure(requestToken, credentialOnly)) {
                return this.requestMultipartFile(reqPath, fields, filePath, fileName, nextAuthRecoveryStage(authRecoveryStage), timeoutMs, contentEncoding);
            }
            throw new Error(`HTTP 401 Unauthorized — token recovery failed: ${text.slice(0, 200)}`);
        }
        if (!res.ok)
            throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
        if (!text)
            throw new Error(`HTTP ${res.status} — empty response body`);
        let parsed;
        try {
            parsed = JSON.parse(text);
        }
        catch {
            throw new Error(`HTTP ${res.status} — invalid JSON: ${text.slice(0, 200)}`);
        }
        if (isAuthenticationFailureResponse(parsed) && authRecoveryStage !== 'credential-token') {
            const credentialOnly = authRecoveryStage !== 'initial';
            if (credentialOnly) {
                console.error('[microi-mcp] Replacement token was rejected; escalating to credential recovery');
            }
            if (await this.tryRecoverFromAuthFailure(requestToken, credentialOnly)) {
                return this.requestMultipartFile(reqPath, fields, filePath, fileName, nextAuthRecoveryStage(authRecoveryStage), timeoutMs, contentEncoding);
            }
        }
        return parsed;
    }
    async requestJsonNative(method, url, headers, body, timeoutMs) {
        const endpoint = new URL(url);
        const requestModule = endpoint.protocol === 'https:' ? https : http;
        const bodyBuffer = body === undefined ? undefined : Buffer.from(body, 'utf8');
        return new Promise((resolve, reject) => {
            let settled = false;
            const finishReject = (error) => {
                if (settled)
                    return;
                settled = true;
                reject(error);
            };
            const req = requestModule.request({
                protocol: endpoint.protocol,
                hostname: endpoint.hostname,
                port: endpoint.port || undefined,
                path: `${endpoint.pathname}${endpoint.search}`,
                method,
                timeout: timeoutMs,
                headers: {
                    ...headers,
                    ...(bodyBuffer ? { 'Content-Length': String(bodyBuffer.length) } : {}),
                },
            }, response => {
                const chunks = [];
                response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                response.on('end', () => {
                    if (settled)
                        return;
                    settled = true;
                    const status = response.statusCode || 0;
                    const responseHeaders = {
                        get(name) {
                            const value = response.headers[name.toLowerCase()];
                            if (Array.isArray(value))
                                return value.join(', ');
                            return value === undefined ? null : String(value);
                        },
                    };
                    resolve({
                        res: {
                            status,
                            statusText: response.statusMessage || '',
                            ok: status >= 200 && status < 300,
                            headers: responseHeaders,
                        },
                        text: Buffer.concat(chunks).toString('utf8'),
                    });
                });
            });
            req.on('error', error => finishReject(new Error(error.message, { cause: error })));
            req.on('timeout', () => {
                req.destroy();
                finishReject(new Error(`native request timeout (${timeoutMs}ms)`));
            });
            if (bodyBuffer)
                req.write(bodyBuffer);
            req.end();
        });
    }
    async requestMultipartFileNative(reqPath, fields, filePath, fileName, timeoutMs, contentEncoding) {
        const boundary = `----microi-mcp-native-${crypto.randomBytes(24).toString('hex')}`;
        const multipart = buildMultipartFileBody(fields, filePath, fileName, boundary, contentEncoding);
        const endpoint = new URL(`${this.config.apiBaseUrl}${reqPath}`);
        const requestModule = endpoint.protocol === 'https:' ? https : http;
        try {
            return await new Promise((resolve, reject) => {
                let settled = false;
                const finishReject = (error) => {
                    if (settled)
                        return;
                    settled = true;
                    reject(error);
                };
                const req = requestModule.request({
                    protocol: endpoint.protocol,
                    hostname: endpoint.hostname,
                    port: endpoint.port || undefined,
                    path: `${endpoint.pathname}${endpoint.search}`,
                    method: 'POST',
                    timeout: timeoutMs,
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                        did: this.did,
                        ...(this.config.osClient ? { OsClient: this.config.osClient } : {}),
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    },
                }, response => {
                    const chunks = [];
                    response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                    response.on('end', () => {
                        if (settled)
                            return;
                        settled = true;
                        const status = response.statusCode || 0;
                        const headers = {
                            get(name) {
                                const value = response.headers[name.toLowerCase()];
                                if (Array.isArray(value))
                                    return value.join(', ');
                                return value === undefined ? null : String(value);
                            },
                        };
                        resolve({
                            res: {
                                status,
                                statusText: response.statusMessage || '',
                                ok: status >= 200 && status < 300,
                                headers,
                            },
                            text: Buffer.concat(chunks).toString('utf8'),
                        });
                    });
                });
                req.on('error', error => finishReject(new Error(error.message, { cause: error })));
                req.on('timeout', () => {
                    req.destroy();
                    finishReject(new Error(`native request timeout (${timeoutMs}ms)`));
                });
                multipart.body.on('error', error => {
                    req.destroy();
                    finishReject(new Error(`local asset stream failed: ${error.message}`, { cause: error }));
                });
                multipart.body.pipe(req);
            });
        }
        finally {
            multipart.body.destroy();
        }
    }
    /**
     * Send one exact local byte range as application/octet-stream. Each retry
     * opens a fresh range stream, so an interrupted request never depends on a
     * partially consumed Node stream. The server binds the part number to a
     * declared size and SHA-256 before committing its durable checkpoint.
     */
    async requestBinaryFileRange(reqPath, query, filePath, start, length, authRecoveryStage = 'initial', timeoutMs) {
        if (!Number.isSafeInteger(start) || start < 0
            || !Number.isSafeInteger(length) || length < 0) {
            throw new Error('断点分片 start/length 必须是非负 JavaScript 安全整数');
        }
        const endpoint = new URL(`${this.config.apiBaseUrl}${reqPath}`);
        for (const [key, value] of Object.entries(query))
            endpoint.searchParams.set(key, value);
        const requestToken = this.token;
        const effectiveTimeout = resolveStreamUploadTimeoutMs(timeoutMs);
        const requestModule = endpoint.protocol === 'https:' ? https : http;
        const transport = await new Promise((resolve, reject) => {
            let settled = false;
            const finishReject = (error) => {
                if (settled)
                    return;
                settled = true;
                reject(error);
            };
            const req = requestModule.request({
                protocol: endpoint.protocol,
                hostname: endpoint.hostname,
                port: endpoint.port || undefined,
                path: `${endpoint.pathname}${endpoint.search}`,
                method: 'POST',
                timeout: effectiveTimeout,
                headers: {
                    Authorization: `Bearer ${requestToken}`,
                    did: this.did,
                    ...(this.config.osClient ? { OsClient: this.config.osClient } : {}),
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': String(length),
                },
            }, response => {
                const chunks = [];
                response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                response.on('end', () => {
                    if (settled)
                        return;
                    settled = true;
                    const status = response.statusCode || 0;
                    const headers = {
                        get(name) {
                            const value = response.headers[name.toLowerCase()];
                            if (Array.isArray(value))
                                return value.join(', ');
                            return value === undefined ? null : String(value);
                        },
                    };
                    resolve({
                        status,
                        statusText: response.statusMessage || '',
                        headers,
                        text: Buffer.concat(chunks).toString('utf8'),
                    });
                });
            });
            req.on('error', error => finishReject(new Error(error.message, { cause: error })));
            req.on('timeout', () => {
                req.destroy();
                finishReject(new Error(`断点分片网络超时（${effectiveTimeout}ms）`));
            });
            if (length === 0) {
                req.end();
                return;
            }
            const fileStream = fs.createReadStream(filePath, {
                start,
                end: start + length - 1,
            });
            fileStream.on('error', error => {
                req.destroy();
                finishReject(new Error(`读取本地分片失败：${error.message}`, { cause: error }));
            });
            fileStream.pipe(req);
        }).catch(error => {
            throw new MicroiTransportError(`断点分片上传网络失败：${error instanceof Error ? error.message : String(error)}`, {
                kind: /超时/u.test(String(error)) ? 'timeout' : 'network',
                requestPath: reqPath,
                uncertainOutcome: true,
                cause: error,
            });
        });
        const newToken = transport.headers.get('authorization');
        if (newToken) {
            this.token = normalizeAuthorizationToken(newToken);
            this.writeTokenToFile();
        }
        if (transport.status === 401 && authRecoveryStage !== 'credential-token') {
            const credentialOnly = authRecoveryStage !== 'initial';
            if (await this.tryRecoverFromAuthFailure(requestToken, credentialOnly)) {
                return this.requestBinaryFileRange(reqPath, query, filePath, start, length, nextAuthRecoveryStage(authRecoveryStage), timeoutMs);
            }
            throw new Error(`HTTP 401 Unauthorized — token recovery failed: ${transport.text.slice(0, 200)}`);
        }
        if (transport.status < 200 || transport.status >= 300) {
            throw new Error(`HTTP ${transport.status} ${transport.statusText} — ${transport.text.slice(0, 200)}`);
        }
        if (!transport.text)
            throw new Error(`HTTP ${transport.status} — empty response body`);
        let parsed;
        try {
            parsed = JSON.parse(transport.text);
        }
        catch {
            throw new Error(`HTTP ${transport.status} — invalid JSON: ${transport.text.slice(0, 200)}`);
        }
        if (isAuthenticationFailureResponse(parsed) && authRecoveryStage !== 'credential-token') {
            const credentialOnly = authRecoveryStage !== 'initial';
            if (await this.tryRecoverFromAuthFailure(requestToken, credentialOnly)) {
                return this.requestBinaryFileRange(reqPath, query, filePath, start, length, nextAuthRecoveryStage(authRecoveryStage), timeoutMs);
            }
        }
        return parsed;
    }
    isUncertainWriteError(error) {
        return error instanceof MicroiTransportError && error.uncertainOutcome;
    }
    readbackOptions(operationName) {
        return {
            timeoutMs: this.readbackRequestTimeoutMs,
            operationName,
        };
    }
    async pollReadback(readback, matches) {
        let lastResponse;
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
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
            }
        }
        return { matched: false, response: lastResponse, lastError };
    }
    recoveredWriteResult(operation, error, data = {}) {
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
    uncertainWriteFailure(operation, error, lastError) {
        return new Error(`${operation} 的客户端响应异常，且回读未能确认写入结果。`
            + `原始错误：${error.message}`
            + `${lastError ? `；回读结果：${lastError}` : ''}。`
            + '请继续使用对应的标准 MCP 获取工具回读后再决定是否重试；不要改走原生 FormEngine、直接 SQL 或临时维护接口引擎。', { cause: error });
    }
    // ---------- API 方法 ----------
    async getStatus() {
        return this.get(API.GET_STATUS);
    }
    async transitionApplicationStreamGate(data) {
        return this.post(API.TRANSITION_APPLICATION_STREAM_GATE, data, {
            timeoutMs: this.writeRequestTimeoutMs,
            operationName: `transition application stream gate ${data.TransitionId}`,
        });
    }
    async listMyUserAccessKeys() {
        // Deliberately omit TargetUserId: the backend binds the operation to the
        // authenticated user and prevents an access-key session from managing keys.
        return this.post(API.LIST_USER_ACCESS_KEYS, {});
    }
    async createMyUserAccessKey(input) {
        // Permanent keys are intentionally not exposed through MCP. The backend
        // applies its bounded default expiry (currently 90 days) when ExpiresAt is absent.
        return this.post(API.CREATE_USER_ACCESS_KEY, {
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
    async revokeMyUserAccessKey(id) {
        return this.post(API.REVOKE_USER_ACCESS_KEY, { Id: id }, {
            timeoutMs: this.writeRequestTimeoutMs,
            operationName: `吊销当前用户访问密钥 ${id}`,
        });
    }
    async getDbSchema() {
        return this.post(API.GET_DB_SCHEMA, {
            OsClient: this.config.osClient,
        });
    }
    async getTableIndexes(tableName, readback = false) {
        return this.post(API.GET_TABLE_INDEXES, {
            OsClient: this.config.osClient,
            TableName: tableName,
        }, readback ? this.readbackOptions(`回读表 ${tableName} 索引`) : {});
    }
    async createTableIndex(data) {
        const payload = { OsClient: this.config.osClient, ...data };
        try {
            return await this.post(API.CREATE_TABLE_INDEX, payload, {
                timeoutMs: this.writeRequestTimeoutMs,
                operationName: `创建索引 ${data.IndexName || `${data.TableName}:${data.Columns.join(',')}`}`,
            });
        }
        catch (error) {
            if (!this.isUncertainWriteError(error))
                throw error;
            const readback = await this.pollReadback(() => this.getTableIndexes(data.TableName, true), (indexes) => indexes.some((index) => {
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
                    && columns.every((value, position) => value.toLowerCase() === data.Columns[position].toLowerCase());
            }));
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
    async dropTableIndex(tableName, indexName) {
        try {
            return await this.post(API.DROP_TABLE_INDEX, {
                OsClient: this.config.osClient,
                TableName: tableName,
                IndexName: indexName,
            }, {
                timeoutMs: this.writeRequestTimeoutMs,
                operationName: `删除索引 ${indexName}`,
            });
        }
        catch (error) {
            if (!this.isUncertainWriteError(error))
                throw error;
            const readback = await this.pollReadback(() => this.getTableIndexes(tableName, true), (indexes) => !indexes.some((index) => String(index.Key_name || index.Name || '').toLowerCase() === indexName.toLowerCase()));
            if (readback.matched) {
                return this.recoveredWriteResult('删除数据库索引', error, {
                    TableName: tableName,
                    IndexName: indexName,
                });
            }
            throw this.uncertainWriteFailure('删除数据库索引', error, readback.lastError);
        }
    }
    async getSupportedDatabaseTypes() {
        return this.post(API.GET_SUPPORTED_DATABASE_TYPES, {});
    }
    async inspectExternalDatabase(data) {
        return this.post(API.INSPECT_EXTERNAL_DATABASE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async queryExternalDatabase(data) {
        return this.post(API.QUERY_EXTERNAL_DATABASE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async executeExternalDatabaseSql(data) {
        const requestedTimeoutSeconds = Number(data.CommandTimeoutSeconds || 0);
        const executionTimeoutMs = Number.isFinite(requestedTimeoutSeconds) && requestedTimeoutSeconds > 0
            ? (requestedTimeoutSeconds + 30) * 1000
            : 630_000;
        return this.post(API.EXECUTE_EXTERNAL_DATABASE_SQL, {
            OsClient: this.config.osClient,
            ...data,
        }, {
            timeoutMs: Math.max(this.config.requestTimeoutMs ?? 120_000, this.config.writeRequestTimeoutMs ?? 60_000, executionTimeoutMs),
            operationName: 'execute external database sql',
        });
    }
    async saveDatabaseConnection(data) {
        return this.post(API.SAVE_DATABASE_CONNECTION, {
            OsClient: this.config.osClient,
            ...data,
        }, { timeoutMs: this.config.writeRequestTimeoutMs, operationName: 'save database connection' });
    }
    async importExternalAttachment(data) {
        const requestedTimeoutSeconds = Number(data.TimeoutSeconds || 0);
        const transferTimeoutMs = Number.isFinite(requestedTimeoutSeconds) && requestedTimeoutSeconds > 0
            ? (requestedTimeoutSeconds + 30) * 1000
            : 3_630_000;
        return this.post(API.IMPORT_EXTERNAL_ATTACHMENT, {
            OsClient: this.config.osClient,
            ...data,
        }, {
            timeoutMs: Math.max(this.config.requestTimeoutMs ?? 120_000, this.config.writeRequestTimeoutMs ?? 60_000, transferTimeoutMs),
            operationName: 'import external attachment',
        });
    }
    async getPlaywrightContext(keyword, pageSize) {
        return this.post(API.GET_PLAYWRIGHT_CONTEXT, {
            OsClient: this.config.osClient,
            ...(keyword ? { Keyword: keyword } : {}),
            ...(pageSize ? { PageSize: pageSize } : {}),
        });
    }
    async getEngineList(keyword) {
        return this.post(API.GET_ENGINE_LIST, {
            OsClient: this.config.osClient,
            ...(keyword ? { _SearchKey: keyword } : {}),
        });
    }
    async getEngineCode(apiEngineKey, options = {}) {
        return this.post(API.GET_ENGINE_CODE, {
            OsClient: this.config.osClient,
            ApiEngineKey: apiEngineKey,
        }, options);
    }
    async executeEngine(apiEngineKey, params) {
        return this.post(API.EXECUTE_ENGINE, {
            OsClient: this.config.osClient,
            ApiEngineKey: apiEngineKey,
            Param: params || {},
        });
    }
    async chat(input) {
        return this.post(API.AI_CHAT, {
            UserChatMsg: input.question,
            AiModel: input.aiModel,
            ...(input.systemPrompt ? { SystemChatMsg: input.systemPrompt } : {}),
            ...(input.aiModelId ? { AiModelId: input.aiModelId } : {}),
            ...(input.relayModel ? { RelayModel: input.relayModel } : {}),
            ...(input.conversationId ? { ConversationId: input.conversationId } : {}),
            ...(input.reasoningEffort ? { ReasoningEffort: input.reasoningEffort } : {}),
            ...(input.mode ? { Mode: input.mode } : {}),
            OsClient: this.config.osClient,
        }, {
            timeoutMs: Math.max(this.config.requestTimeoutMs ?? 120_000, 330_000),
            operationName: 'Microi AI chat',
        });
    }
    /**
     * 调用当前 MCP 身份和租户绑定的 OCR 网关。网络地址、Provider、认证头和
     * OsClient 均不属于本方法参数，避免 MCP 把后端网关变成任意 HTTP 代理。
     */
    async recognizeOcr(input) {
        return this.post(API.OCR_RECOGNIZE, input, {
            timeoutMs: OCR_REQUEST_TIMEOUT_MS,
            operationName: `OCR recognize ${input.FileName || 'unnamed file'}`,
        });
    }
    /** Calls the current authenticated tenant's server-side translation gateway. */
    async translateText(input) {
        return this.post(API.TRANSLATE_TEXT, input, {
            timeoutMs: TRANSLATE_REQUEST_TIMEOUT_MS,
            operationName: 'translate text',
        });
    }
    async detectLanguage(sourceText) {
        return this.post(API.TRANSLATE_DETECT, { SourceText: sourceText }, {
            timeoutMs: TRANSLATE_REQUEST_TIMEOUT_MS,
            operationName: 'detect language',
        });
    }
    async listTranslateLanguages() {
        return this.post(API.TRANSLATE_LANGUAGES, {}, {
            timeoutMs: TRANSLATE_REQUEST_TIMEOUT_MS,
            operationName: 'list translation languages',
        });
    }
    async translateFile(input) {
        return this.post(API.TRANSLATE_FILE, input, {
            timeoutMs: TRANSLATE_REQUEST_TIMEOUT_MS,
            operationName: `translate file ${input.FileName}`,
        });
    }
    async suggestTranslation(input) {
        return this.post(API.TRANSLATE_SUGGEST, input, {
            timeoutMs: TRANSLATE_REQUEST_TIMEOUT_MS,
            operationName: 'suggest translation',
        });
    }
    async getTranslateHealth() {
        return this.post(API.TRANSLATE_HEALTH, {}, {
            timeoutMs: TRANSLATE_REQUEST_TIMEOUT_MS,
            operationName: 'translation health',
        });
    }
    async saveEngineCode(apiEngineKey, code, options) {
        assertSourceIntegrity(code, `保存接口引擎 ${apiEngineKey}`);
        let remote;
        try {
            const remoteResult = await this.getEngineCode(apiEngineKey);
            remote = remoteResult.Code === 1 ? remoteResult.Data : undefined;
        }
        catch {
            remote = undefined;
        }
        const remoteSource = normalizeCodeForComparison(remote?.ApiV8Code || remote?.Code);
        const nextSource = normalizeCodeForComparison(code);
        if (remoteSource.length >= 8000
            && nextSource.length < remoteSource.length * 0.85
            && !options?.confirmLargeReduction) {
            throw new Error(`保存接口引擎 ${apiEngineKey} 已拦截：新源码 ${nextSource.length} 字符，远端源码 ${remoteSource.length} 字符，`
                + `减少超过 15%。这可能是长工具结果被截断；确认确需大幅删减时请传 confirmLargeReduction="${apiEngineKey}"。`);
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
        const requestedV8Limit = options?.v8Limit ?? (options?.v8Unlimited === undefined
            ? undefined
            : !options.v8Unlimited);
        const payload = {
            OsClient: this.config.osClient,
            ApiEngineKey: apiEngineKey,
            ApiV8CodeBase64: Buffer.from(prepared.code, 'utf8').toString('base64'),
            Version: prepared.version,
            ChangeHistory: prepared.changeHistory,
            ...(requestedV8Limit === undefined ? {} : { V8Limit: requestedV8Limit ? 1 : 0 }),
        };
        const matchesReadback = (data) => normalizeCodeForComparison(data?.ApiV8Code || data?.Code)
            === normalizeCodeForComparison(prepared.code)
            && (requestedV8Limit === undefined
                || apiEngineV8LimitValue(data) === (requestedV8Limit ? 1 : 0));
        try {
            const result = await this.post(API.UPDATE_ENGINE_CODE, payload, {
                timeoutMs: this.writeRequestTimeoutMs,
                operationName: `保存接口引擎 ${apiEngineKey}`,
            });
            if (result.Code !== 1 || requestedV8Limit === undefined)
                return result;
            const verification = await this.pollReadback(() => this.getEngineCode(apiEngineKey, this.readbackOptions(`回读接口引擎 ${apiEngineKey} V8Limit`)), matchesReadback);
            if (!verification.matched) {
                return {
                    Code: 0,
                    Data: { ApiEngineKey: apiEngineKey, UpdateResponse: result.Data },
                    Msg: `保存接口引擎 ${apiEngineKey} 返回成功，但 V8Limit 写后回读不一致：${verification.lastError || '代码或配置不一致'}`,
                };
            }
            return {
                ...result,
                Data: {
                    ...(result.Data && typeof result.Data === 'object' ? result.Data : {}),
                    ApiEngineKey: apiEngineKey,
                    V8Limit: requestedV8Limit ? 1 : 0,
                    Verified: true,
                    Verification: 'readback',
                },
            };
        }
        catch (error) {
            if (!this.isUncertainWriteError(error))
                throw error;
            const verification = await this.pollReadback(() => this.getEngineCode(apiEngineKey, this.readbackOptions(`回读接口引擎 ${apiEngineKey}`)), matchesReadback);
            if (verification.matched) {
                return this.recoveredWriteResult(`保存接口引擎 ${apiEngineKey}`, error, {
                    ApiEngineKey: apiEngineKey,
                    Version: prepared.version,
                });
            }
            throw this.uncertainWriteFailure(`保存接口引擎 ${apiEngineKey}`, error, verification.lastError);
        }
    }
    async updateEngineRuntimeLimit(apiEngineKey, v8Limit) {
        const payload = {
            OsClient: this.config.osClient,
            ApiEngineKey: apiEngineKey,
            V8Limit: v8Limit ? 1 : 0,
        };
        const verify = () => this.pollReadback(() => this.getEngineCode(apiEngineKey, this.readbackOptions(`回读接口引擎 ${apiEngineKey} V8Limit`)), (remote) => apiEngineV8LimitValue(remote) === (v8Limit ? 1 : 0));
        const operation = `更新接口引擎 ${apiEngineKey} V8Limit`;
        try {
            const result = await this.post(API.UPDATE_ENGINE_CODE, payload, {
                timeoutMs: this.writeRequestTimeoutMs,
                operationName: operation,
            });
            if (result.Code !== 1)
                return result;
            const verification = await verify();
            if (!verification.matched) {
                return {
                    Code: 0,
                    Data: { ApiEngineKey: apiEngineKey, UpdateResponse: result.Data },
                    Msg: `${operation} 接口返回成功，但远端写后回读不一致：${verification.lastError || '配置不一致'}`,
                };
            }
            return {
                ...result,
                Data: {
                    ...(result.Data && typeof result.Data === 'object' ? result.Data : {}),
                    ApiEngineKey: apiEngineKey,
                    V8Limit: v8Limit ? 1 : 0,
                    Verified: true,
                    Verification: 'readback',
                },
            };
        }
        catch (error) {
            if (!this.isUncertainWriteError(error))
                throw error;
            const verification = await verify();
            if (verification.matched) {
                return this.recoveredWriteResult(operation, error, {
                    ApiEngineKey: apiEngineKey,
                    V8Limit: v8Limit ? 1 : 0,
                    Verified: true,
                });
            }
            throw this.uncertainWriteFailure(operation, error, verification.lastError);
        }
    }
    /** @deprecated Use updateEngineRuntimeLimit with positive semantics. */
    async updateEngineRuntimeConfig(apiEngineKey, v8Unlimited) {
        return this.updateEngineRuntimeLimit(apiEngineKey, !v8Unlimited);
    }
    async createEngine(data) {
        // 默认 ApiAddress 为 /apiengine/{key}，否则平台路由匹配会 404
        const payload = {
            OsClient: this.config.osClient,
            ...data,
        };
        if (payload.V8Limit === undefined && payload.V8Unlimited !== undefined) {
            payload.V8Limit = Number(payload.V8Unlimited) === 1 ? 0 : 1;
        }
        delete payload.V8Unlimited;
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
        const verifyCreated = () => this.pollReadback(() => this.getEngineCode(data.ApiEngineKey, this.readbackOptions(`回读新建接口引擎 ${data.ApiEngineKey}`)), (remote) => String(remote?.ApiEngineKey || '') === data.ApiEngineKey
            && normalizeCodeForComparison(remote?.ApiV8Code || remote?.Code)
                === normalizeCodeForComparison(prepared.code)
            && (payload.V8Limit === undefined
                || apiEngineV8LimitValue(remote) === (Number(payload.V8Limit) === 1 ? 1 : 0)));
        try {
            const result = await this.post(API.CREATE_ENGINE, payload, {
                timeoutMs: this.writeRequestTimeoutMs,
                operationName: operation,
            });
            if (result.Code !== 1)
                return result;
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
                    ...(result.Data && typeof result.Data === 'object' ? result.Data : {}),
                    ApiEngineKey: data.ApiEngineKey,
                    Verified: true,
                    Verification: 'readback',
                },
            };
        }
        catch (error) {
            if (!this.isUncertainWriteError(error))
                throw error;
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
    async uploadFileBase64(data) {
        return this.post(API.UPLOAD_FILE_BASE64, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async uploadApplicationAssetStream(data) {
        const localPath = path.resolve(data.FilePath);
        const stat = fs.lstatSync(localPath);
        if (!stat.isFile() || stat.isSymbolicLink()) {
            throw new Error(`应用资产必须是普通文件且不能是符号链接：${localPath}`);
        }
        const relativeFileName = path.posix.basename(String(data.RelativePath || '').replace(/\\/g, '/'));
        if (!relativeFileName || /[\r\n"]/u.test(relativeFileName)) {
            throw new Error('RelativePath 的文件名不合法');
        }
        // Protocol v3 always uses the durable multipart transport, including for
        // small files. Besides making every stage reconnect-safe, this keeps
        // controlled application releases out of the ordinary interactive-upload
        // daily quota namespace. Legacy v2 callers retain the bounded multipart
        // request below for backwards compatibility.
        if (data.ProtocolVersion === 3) {
            return this.uploadApplicationAssetResumable(data, localPath, stat.size);
        }
        if (stat.size > LEGACY_APPLICATION_ASSET_STREAM_MAX_BYTES) {
            throw new Error(`当前文件 ${stat.size} bytes 超过旧版 128MiB 单请求边界；`
                + '请启用 ProtocolVersion=3，MCP 将自动使用 HDFS 分片断点续传。');
        }
        // The server derives and validates the canonical asset name from
        // RelativePath, not from IFormFile.FileName. Keep the multipart transport
        // filename extension-neutral so reverse proxies do not reject ordinary
        // compiled .js/.css assets before ASP.NET Core receives the request.
        const transportFileName = `microi-asset-${data.ExpectedSha256.slice(0, 16)}.bin`;
        const protocolFields = {};
        if (data.ProtocolVersion === 3) {
            const nullable = (value) => value === null ? 'null' : String(value ?? '');
            Object.assign(protocolFields, {
                ProtocolVersion: '3',
                PublishMode: 'stage',
                ExpectedGateEpoch: String(data.ExpectedGateEpoch ?? ''),
                RequestFingerprint: String(data.RequestFingerprint ?? ''),
                DeliveryBatchId: String(data.DeliveryBatchId ?? ''),
                SourceManifestHash: String(data.SourceManifestHash ?? ''),
                RuntimeManifestHash: String(data.RuntimeManifestHash ?? ''),
                RouteSnapshotJson: String(data.RouteSnapshotJson ?? ''),
                RouteSnapshotHash: String(data.RouteSnapshotHash ?? ''),
                ExpectedCurrentVersion: String(data.ExpectedCurrentVersion ?? ''),
                ExpectedAppVersion: nullable(data.ExpectedAppVersion),
                ExpectedPublishFence: String(data.ExpectedPublishFence ?? ''),
                ExpectedPublishRowVersion: String(data.ExpectedPublishRowVersion ?? ''),
                ExpectedVersionRowVersion: nullable(data.ExpectedVersionRowVersion),
                ExpectedActivePublishVersionId: nullable(data.ExpectedActivePublishVersionId),
                ExpectedCommittedPublishVersionId: nullable(data.ExpectedCommittedPublishVersionId),
            });
        }
        return this.requestMultipartFile(API.UPLOAD_APPLICATION_ASSET_STREAM, {
            OsClient: this.config.osClient || '',
            AppIdOrKey: data.AppIdOrKey,
            VersionNo: data.VersionNo,
            RelativePath: data.RelativePath,
            ExpectedSha256: data.ExpectedSha256,
            RequestId: data.RequestId,
            ...protocolFields,
        }, localPath, transportFileName, 'initial', data.TimeoutMs);
    }
    async getApplicationAssetMultipartStatus(appIdOrKey, sessionId) {
        return this.post(API.GET_APPLICATION_ASSET_MULTIPART_STATUS, {
            OsClient: this.config.osClient,
            AppIdOrKey: appIdOrKey,
            SessionId: sessionId,
        }, {
            timeoutMs: 2 * 60_000,
            operationName: 'read resumable application asset status',
        });
    }
    async uploadApplicationAssetResumable(data, localPath, totalSize) {
        if (!Number.isSafeInteger(totalSize) || totalSize < 0) {
            throw new Error('应用资产大小超出 JavaScript 安全整数范围');
        }
        const immutableProtocol = applicationAssetV3ProtocolPayload(data);
        const initiate = await this.post(API.INITIATE_APPLICATION_ASSET_MULTIPART, {
            OsClient: this.config.osClient,
            AppIdOrKey: data.AppIdOrKey,
            VersionNo: data.VersionNo,
            RelativePath: data.RelativePath,
            ExpectedSha256: data.ExpectedSha256,
            TotalSize: totalSize,
            RequestedChunkSize: DEFAULT_APPLICATION_ASSET_MULTIPART_CHUNK_BYTES,
            RequestId: data.RequestId,
            ...immutableProtocol,
        }, {
            timeoutMs: 2 * 60_000,
            operationName: 'initiate resumable application asset upload',
        });
        if (initiate.Code !== 1)
            return initiate;
        const initiated = initiate.Data;
        const sessionId = String(initiated?.SessionId || '').trim();
        const chunkSize = Number(initiated?.ChunkSize);
        const totalParts = Number(initiated?.TotalParts);
        if (!/^mciau-[a-f0-9]{30}$/u.test(sessionId)
            || !Number.isSafeInteger(chunkSize) || chunkSize < 16 * 1024 * 1024
            || !Number.isSafeInteger(totalParts) || totalParts < 0 || totalParts > 10_000
            || totalParts !== (totalSize === 0 ? 0 : Math.ceil(totalSize / chunkSize))) {
            throw new Error('服务端返回的断点上传 SessionId/ChunkSize/TotalParts 不合法');
        }
        let statusResult = await this.getApplicationAssetMultipartStatus(data.AppIdOrKey, sessionId);
        if (statusResult.Code !== 1)
            return statusResult;
        const completedStatus = String(statusResult.Data?.Status || '');
        if (completedStatus === 'Succeeded')
            return statusResult;
        const remoteParts = new Map();
        for (const part of statusResult.Data?.Parts || []) {
            const number = Number(part.Number);
            if (Number.isSafeInteger(number) && number > 0 && number <= totalParts) {
                remoteParts.set(number, part);
            }
        }
        let uploadedParts = 0;
        let resumedParts = 0;
        for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
            const start = (partNumber - 1) * chunkSize;
            const length = Math.min(chunkSize, totalSize - start);
            const sha256 = await sha256LocalFileRange(localPath, start, length);
            const remote = remoteParts.get(partNumber);
            if (remote) {
                if (Number(remote.Size) !== length || String(remote.Sha256 || '') !== sha256) {
                    throw new Error(`断点会话第 ${partNumber} 块与本地不可变文件不一致；`
                        + '已拒绝覆盖，请核对本地文件是否在上传期间发生变化。');
                }
                resumedParts += 1;
                continue;
            }
            let partResult;
            for (let attempt = 0; attempt < 5; attempt += 1) {
                try {
                    partResult = await this.requestBinaryFileRange(API.UPLOAD_APPLICATION_ASSET_MULTIPART_PART, {
                        osClient: this.config.osClient || '',
                        sessionId,
                        partNumber: String(partNumber),
                        expectedPartSha256: sha256,
                    }, localPath, start, length, 'initial', data.TimeoutMs);
                    if (partResult.Code === 1)
                        break;
                    if (attempt === 4)
                        return partResult;
                }
                catch (error) {
                    // The response may have been lost after HDFS and the durable CAS both
                    // succeeded. Read the checkpoint before replaying the same bytes.
                    statusResult = await this.getApplicationAssetMultipartStatus(data.AppIdOrKey, sessionId);
                    const checkpoint = (statusResult.Data?.Parts || [])
                        .find(item => Number(item.Number) === partNumber);
                    if (statusResult.Code === 1
                        && checkpoint
                        && Number(checkpoint.Size) === length
                        && String(checkpoint.Sha256 || '') === sha256) {
                        partResult = statusResult;
                        break;
                    }
                    if (attempt === 4)
                        throw error;
                    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
                }
            }
            if (!partResult || partResult.Code !== 1) {
                return partResult || {
                    Code: 0,
                    Data: null,
                    Msg: `第 ${partNumber} 块上传没有返回终态`,
                };
            }
            uploadedParts += 1;
            if (partNumber === 1 || partNumber % 20 === 0 || partNumber === totalParts) {
                console.error(`[microi-mcp] Resumable HDFS asset ${data.RelativePath}: ${partNumber}/${totalParts}`);
            }
        }
        try {
            const complete = await this.post(API.COMPLETE_APPLICATION_ASSET_MULTIPART, {
                OsClient: this.config.osClient,
                AppIdOrKey: data.AppIdOrKey,
                SessionId: sessionId,
            }, {
                timeoutMs: MAX_STREAM_UPLOAD_TIMEOUT_MS,
                maxTimeoutMs: MAX_STREAM_UPLOAD_TIMEOUT_MS,
                operationName: 'complete resumable application asset upload',
            });
            if (complete.Code === 1 && complete.Data && typeof complete.Data === 'object') {
                return {
                    ...complete,
                    Data: {
                        ...complete.Data,
                        UploadedInThisRun: uploadedParts,
                        ResumedParts: resumedParts,
                    },
                };
            }
            return complete;
        }
        catch (error) {
            const recovered = await this.getApplicationAssetMultipartStatus(data.AppIdOrKey, sessionId);
            if (recovered.Code === 1 && String(recovered.Data?.Status || '') === 'Succeeded') {
                return {
                    ...recovered,
                    Data: {
                        ...recovered.Data,
                        RecoveredAfterTransportError: true,
                        UploadedInThisRun: uploadedParts,
                        ResumedParts: resumedParts,
                    },
                    Msg: '完成请求响应中断，但已通过会话回读确认最终对象 Prepared。',
                };
            }
            throw error;
        }
    }
    async finalizeApplicationStreamPublish(data) {
        return this.post(API.FINALIZE_APPLICATION_STREAM_PUBLISH, {
            OsClient: this.config.osClient,
            ...data,
        }, {
            timeoutMs: 10 * 60_000,
            operationName: 'finalize application stream publish',
        });
    }
    async getMicroService(msKey) {
        return this.post(API.GET_MICRO_SERVICE, {
            OsClient: this.config.osClient,
            MsKey: msKey,
        });
    }
    async listApplications(data = {}) {
        return this.post(API.LIST_APPLICATIONS, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async getApplicationContext(data) {
        return this.post(API.GET_APPLICATION_CONTEXT, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async getApplicationFile(data) {
        return this.post(API.GET_APPLICATION_FILE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async createMicroService(data) {
        return this.post(API.CREATE_MICRO_SERVICE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async syncMicroServiceSource(data) {
        return this.post(API.SYNC_MICRO_SERVICE_SOURCE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async publishMicroService(data) {
        return this.post(API.PUBLISH_MICRO_SERVICE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async probeMicroAppEntry(msKey) {
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
        }
        catch (error) {
            return {
                ok: false,
                url,
                error: controller.signal.aborted
                    ? 'MicroApp entry probe timed out after 10000ms'
                    : error instanceof Error ? error.message : String(error),
            };
        }
        finally {
            clearTimeout(timer);
        }
    }
    async getTableData(tableName, query = {}) {
        return this.post(API.FORM_GET_TABLE_DATA, {
            OsClient: this.config.osClient,
            FormEngineKey: tableName,
            ...query,
        });
    }
    async addFormData(tableName, row) {
        return this.post(API.FORM_ADD_FORM_DATA, {
            OsClient: this.config.osClient,
            FormEngineKey: tableName,
            ...row,
        });
    }
    async updateFormData(tableName, row) {
        return this.post(API.FORM_UPT_FORM_DATA, {
            OsClient: this.config.osClient,
            FormEngineKey: tableName,
            ...row,
        });
    }
    async getEventCode(formEngineKey, eventType, options = {}) {
        return this.post(API.GET_EVENT_CODE, {
            OsClient: this.config.osClient,
            FormEngineKey: formEngineKey,
            EventType: eventType,
        }, options);
    }
    async saveEventCode(formEngineKey, eventType, code, options) {
        assertSourceIntegrity(code, `保存 V8 事件 ${formEngineKey}/${eventType}`);
        let remote;
        try {
            const remoteResult = await this.getEventCode(formEngineKey, eventType);
            remote = remoteResult.Code === 1 ? remoteResult.Data : undefined;
        }
        catch {
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
        }
        catch (error) {
            if (!this.isUncertainWriteError(error))
                throw error;
            const verification = await this.pollReadback(() => this.getEventCode(formEngineKey, eventType, this.readbackOptions(`回读 V8 事件 ${formEngineKey}/${eventType}`)), (data) => normalizeCodeForComparison(data?.V8Code || data?.Code)
                === normalizeCodeForComparison(prepared.code));
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
    async getEventList(keyword) {
        return this.post(API.GET_EVENT_LIST, {
            OsClient: this.config.osClient,
            ...(keyword ? { _SearchKey: keyword } : {}),
        });
    }
    async getWorkflowV8EventList(flowDesignId) {
        return this.post(API.GET_WORKFLOW_V8_EVENT_LIST, {
            OsClient: this.config.osClient,
            ...(flowDesignId ? { FlowDesignId: flowDesignId } : {}),
        });
    }
    async getWorkflowV8EventCode(nodeId, eventType, flowDesignId) {
        return this.post(API.GET_WORKFLOW_V8_EVENT_CODE, {
            OsClient: this.config.osClient,
            ...(flowDesignId ? { FlowDesignId: flowDesignId } : {}),
            NodeId: nodeId,
            EventType: eventType,
        });
    }
    async saveWorkflowV8EventCode(nodeId, eventType, code, options) {
        assertSourceIntegrity(code, `保存流程节点 V8 ${nodeId}/${eventType}`);
        let remote;
        try {
            const remoteResult = await this.getWorkflowV8EventCode(nodeId, eventType, options?.flowDesignId);
            remote = remoteResult.Code === 1 ? remoteResult.Data : undefined;
        }
        catch {
            remote = undefined;
        }
        const shouldClear = !code.trim();
        const payload = {
            OsClient: this.config.osClient,
            ...(options?.flowDesignId ? { FlowDesignId: options.flowDesignId } : {}),
            NodeId: nodeId,
            EventType: eventType,
        };
        if (shouldClear) {
            payload.V8Code = '';
        }
        else {
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
    async createTable(name, description, options) {
        return this.post(API.CREATE_TABLE, {
            OsClient: this.config.osClient,
            Name: name,
            Description: description || '',
            ...options,
        });
    }
    async repairFixedAuditFields(input) {
        return this.post(API.REPAIR_FIXED_AUDIT_FIELDS, {
            OsClient: this.config.osClient,
            TableId: input.tableId,
            TableName: input.tableName,
        });
    }
    async addField(data) {
        return this.post(API.ADD_FIELD, {
            OsClient: this.config.osClient,
            ...data,
            Visible: data.Visible ?? 1,
            AppVisible: data.AppVisible ?? 1,
        });
    }
    async deleteField(data) {
        return this.post(API.DELETE_FIELD, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async updateField(patch) {
        return this.post(API.UPDATE_FIELD, {
            OsClient: this.config.osClient,
            ...patch,
        });
    }
    async updateFieldList(patch) {
        return this.post(API.UPDATE_FIELD_LIST, {
            OsClient: this.config.osClient,
            ...patch,
        });
    }
    async getFieldList(tableName, tableId) {
        return this.post(API.GET_FIELD_LIST, {
            OsClient: this.config.osClient,
            TableName: tableName,
            TableId: tableId,
        });
    }
    async updateTable(patch) {
        return this.post(API.UPDATE_TABLE, {
            OsClient: this.config.osClient,
            ...patch,
        });
    }
    async refreshSchemaCache(tables) {
        return this.post(API.REFRESH_SCHEMA_CACHE, {
            OsClient: this.config.osClient,
            Tables: tables,
        });
    }
    async setEngineAnonymous(apiEngineKeys, allowAnonymous = 1) {
        return this.post(API.SET_ENGINE_ANONYMOUS, {
            OsClient: this.config.osClient,
            ApiEngineKeys: apiEngineKeys,
            AllowAnonymous: allowAnonymous,
        });
    }
    async createModule(data) {
        const result = await this.post(API.CREATE_MODULE, {
            OsClient: this.config.osClient,
            ...data,
            Display: data.Display ?? 1,
            AppDisplay: data.AppDisplay ?? 1,
        });
        if (result.Code !== 1)
            return result;
        const hasMicroServiceBinding = Boolean(data.IsMicroiService === 1
            || data.MicroServiceId
            || data.MicroServicePageId
            || data.MicroServiceRoutePath);
        if (!hasMicroServiceBinding)
            return result;
        const responseData = result.Data && typeof result.Data === 'object'
            ? result.Data
            : {};
        const moduleId = String(responseData.ModuleId || responseData.Id || '');
        if (!moduleId) {
            return {
                Code: 0,
                Data: { CreateResponse: result.Data },
                Msg: '菜单已创建，但返回结果缺少 ModuleId，无法写入并回读微服务关联字段。',
            };
        }
        const bindingPatch = {
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
    async setRolePermission(roleId, menuIds) {
        return this.post(API.SET_ROLE_PERMISSION, {
            OsClient: this.config.osClient,
            RoleId: roleId,
            MenuIds: menuIds,
        });
    }
    async listRoles(keyword) {
        return this.post(API.LIST_ROLES, {
            OsClient: this.config.osClient,
            ...(keyword ? { Keyword: keyword } : {}),
        });
    }
    async saveRole(data) {
        return this.post(API.SAVE_ROLE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async listModules(keyword) {
        return this.post(API.LIST_MODULES, {
            OsClient: this.config.osClient,
            ...(keyword ? { Keyword: keyword } : {}),
        });
    }
    async getModule(moduleId, options = {}) {
        return this.post(API.GET_MODULE, {
            OsClient: this.config.osClient,
            ModuleId: moduleId,
        }, options);
    }
    async updateModule(data) {
        const payload = {
            OsClient: this.config.osClient,
            ...data,
        };
        const moduleId = String(payload.ModuleId || payload.Id || '');
        const operation = `更新菜单模块 ${moduleId || payload.Name || ''}`.trim();
        assertPayloadSourceIntegrity(payload, operation);
        const verify = async () => {
            if (!moduleId)
                return { matched: false, mismatches: ['ModuleId'] };
            try {
                const response = await this.getModule(moduleId, this.readbackOptions(`回读菜单模块 ${moduleId}`));
                if (response.Code !== 1 || !response.Data || typeof response.Data !== 'object') {
                    return { matched: false, mismatches: ['回读失败'], response };
                }
                const comparison = modulePatchMatches(payload, response.Data);
                return { ...comparison, response };
            }
            catch {
                return { matched: false, mismatches: ['回读请求异常'] };
            }
        };
        try {
            const result = await this.post(API.UPDATE_MODULE, payload, {
                timeoutMs: this.writeRequestTimeoutMs,
                operationName: operation,
            });
            if (result.Code !== 1)
                return result;
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
                    ...(result.Data && typeof result.Data === 'object' ? result.Data : {}),
                    Verified: true,
                    Verification: 'readback',
                },
            };
        }
        catch (error) {
            if (!this.isUncertainWriteError(error))
                throw error;
            let lastMismatches = [];
            const verification = await this.pollReadback(async () => {
                const readback = await verify();
                lastMismatches = readback.mismatches;
                return {
                    Code: readback.response?.Code ?? (readback.matched ? 1 : 0),
                    Data: readback,
                    Msg: readback.response?.Msg || '',
                };
            }, (readback) => readback.matched);
            if (verification.matched) {
                return this.recoveredWriteResult(operation, error, {
                    ModuleId: moduleId,
                    Verified: true,
                });
            }
            throw this.uncertainWriteFailure(operation, error, lastMismatches.length ? `字段不一致：${lastMismatches.join(', ')}` : verification.lastError);
        }
    }
    async listDataSources(keyword) {
        return this.post(API.LIST_DATA_SOURCES, {
            OsClient: this.config.osClient,
            ...(keyword ? { Keyword: keyword } : {}),
        });
    }
    async saveDataSource(data) {
        return this.post(API.SAVE_DATA_SOURCE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async runDataSource(dataSourceKey, params) {
        return this.post(API.RUN_DATA_SOURCE, {
            OsClient: this.config.osClient,
            DataSourceKey: dataSourceKey,
            ...(params || {}),
        });
    }
    async listPrintTemplates(keyword) {
        return this.post(API.LIST_PRINT_TEMPLATES, {
            OsClient: this.config.osClient,
            ...(keyword ? { Keyword: keyword } : {}),
        });
    }
    async savePrintTemplate(data) {
        return this.post(API.SAVE_PRINT_TEMPLATE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async saveWorkflowPackage(data) {
        return this.post(API.SAVE_WORKFLOW_PACKAGE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async saveJob(data) {
        return this.post(API.SAVE_JOB, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async listDatabaseBackupTenants() {
        return this.post(API.LIST_DATABASE_BACKUP_TENANTS, {
            OsClient: this.config.osClient,
        });
    }
    async runDatabaseBackup(options) {
        if (!/^[A-Za-z0-9:._-]{8,128}$/.test(options?.idempotencyKey || '')) {
            throw new Error('database backup idempotencyKey is required (8-128 safe characters) and must be reused for uncertain retries');
        }
        return this.post(API.RUN_DATABASE_BACKUP, {
            OsClient: this.config.osClient,
            ConfirmExecution: 'DATABASE_BACKUP',
            RetainCount: options.retainCount ?? 7,
            ...(options.tenantOsClients === undefined
                ? {}
                : { TenantOsClients: options.tenantOsClients }),
            IdempotencyKey: options.idempotencyKey,
        });
    }
    async runBackgroundApiEngine(data) {
        return this.post(API.RUN_BACKGROUND_API_ENGINE, {
            OsClient: this.config.osClient,
            ApiEngineKey: data.apiEngineKey,
            Title: data.title,
            Param: data.param,
            Options: data.options || {},
        }, {
            timeoutMs: this.writeRequestTimeoutMs,
            operationName: `queue background API engine ${data.apiEngineKey}`,
        });
    }
    async validateLowCodeSystem(manifest) {
        return this.post(API.VALIDATE_LOW_CODE_SYSTEM, {
            OsClient: this.config.osClient,
            Manifest: manifest,
        });
    }
    async writeAuditLog(action, target, content) {
        return this.post(API.WRITE_MCP_AUDIT_LOG, {
            OsClient: this.config.osClient,
            Action: action,
            Target: target,
            Content: content,
        });
    }
    async queryMongodbLogs(query = {}) {
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
    async writeMongodbLog(log) {
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
    async getRedisStatistics(database = 0, connectionId) {
        return this.post(API.REDIS_STATISTICS, {
            Mode: connectionId ? 'saved' : 'tenant',
            ConnectionId: connectionId || '',
            Database: database,
        });
    }
    async getRedisKeys(pattern = '*', database = 0, pageSize = 100, cursor, connectionId) {
        return this.post(API.REDIS_KEYS, {
            Mode: connectionId ? 'saved' : 'tenant',
            ConnectionId: connectionId || '',
            Database: database,
            Pattern: pattern,
            PageSize: pageSize,
            Cursor: cursor || '',
        });
    }
    async getRedisKey(key, database = 0, pageIndex = 1, pageSize = 500, connectionId) {
        return this.post(API.REDIS_KEY, {
            Mode: connectionId ? 'saved' : 'tenant',
            ConnectionId: connectionId || '',
            Database: database,
            Key: key,
            PageIndex: pageIndex,
            PageSize: pageSize,
        });
    }
    async deleteRedisKeys(keys, database = 0, connectionId) {
        return this.post(API.REDIS_DELETE_KEYS, {
            Mode: connectionId ? 'saved' : 'tenant',
            ConnectionId: connectionId || '',
            Database: database,
            Keys: keys,
        });
    }
    async replaceRedisValue(key, dataType, value, database = 0, ttlSeconds, connectionId) {
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
    async renameRedisKey(key, newKey, database = 0, connectionId) {
        return this.post(API.REDIS_RENAME_KEY, {
            Mode: connectionId ? 'saved' : 'tenant',
            ConnectionId: connectionId || '',
            Database: database,
            Key: key,
            NewKey: newKey,
        });
    }
    async setRedisTtl(key, ttlSeconds, database = 0, connectionId) {
        return this.post(API.REDIS_SET_TTL, {
            Mode: connectionId ? 'saved' : 'tenant',
            ConnectionId: connectionId || '',
            Database: database,
            Key: key,
            TtlSeconds: ttlSeconds,
        });
    }
    // ---------- 界面引擎 API 方法 ----------
    async getPageEngineList(keyword) {
        return this.post(API.GET_PAGE_ENGINE_LIST, {
            OsClient: this.config.osClient,
            ...(keyword ? { Keyword: keyword } : {}),
        });
    }
    async getPageEngineDetail(pageId) {
        return this.post(API.GET_PAGE_ENGINE_DETAIL, {
            OsClient: this.config.osClient,
            PageId: pageId,
        });
    }
    async savePageEngine(data) {
        return this.post(API.SAVE_PAGE_ENGINE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async listPageEngineHistory(pageId, pageIndex = 1, pageSize = 50) {
        return this.post(API.LIST_PAGE_ENGINE_HISTORY, {
            OsClient: this.config.osClient,
            PageId: pageId,
            PageIndex: pageIndex,
            PageSize: pageSize,
        });
    }
    async getPageEngineHistory(pageId, historyId) {
        return this.post(API.GET_PAGE_ENGINE_HISTORY, {
            OsClient: this.config.osClient,
            PageId: pageId,
            HistoryId: historyId,
        });
    }
    async comparePageEngineVersions(pageId, leftHistoryId, rightHistoryId) {
        return this.post(API.COMPARE_PAGE_ENGINE_VERSIONS, {
            OsClient: this.config.osClient,
            PageId: pageId,
            ...(leftHistoryId ? { LeftHistoryId: leftHistoryId } : {}),
            ...(rightHistoryId ? { RightHistoryId: rightHistoryId } : {}),
        });
    }
    async exportPageEngine(pageId) {
        return this.post(API.EXPORT_PAGE_ENGINE, {
            OsClient: this.config.osClient,
            PageId: pageId,
        });
    }
    async rollbackPageEngine(data) {
        return this.post(API.ROLLBACK_PAGE_ENGINE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    // ---------- 业务架构蓝图（System Blueprint） ----------
    async listBlueprints(keyword) {
        return this.post(API.LIST_BLUEPRINTS, {
            OsClient: this.config.osClient,
            ...(keyword ? { Keyword: keyword } : {}),
        });
    }
    async getBlueprint(blueprintId) {
        return this.post(API.GET_BLUEPRINT, {
            OsClient: this.config.osClient,
            BlueprintId: blueprintId,
        });
    }
    async listBlueprintHistory(blueprintId, pageIndex = 1, pageSize = 50) {
        return this.post(API.LIST_BLUEPRINT_HISTORY, {
            OsClient: this.config.osClient,
            BlueprintId: blueprintId,
            PageIndex: pageIndex,
            PageSize: pageSize,
        });
    }
    async getBlueprintHistory(blueprintId, historyId) {
        return this.post(API.GET_BLUEPRINT_HISTORY, {
            OsClient: this.config.osClient,
            BlueprintId: blueprintId,
            HistoryId: historyId,
        });
    }
    async compareBlueprintVersions(blueprintId, leftHistoryId, rightHistoryId) {
        return this.post(API.COMPARE_BLUEPRINT_VERSIONS, {
            OsClient: this.config.osClient,
            BlueprintId: blueprintId,
            ...(leftHistoryId ? { LeftHistoryId: leftHistoryId } : {}),
            ...(rightHistoryId ? { RightHistoryId: rightHistoryId } : {}),
        });
    }
    async exportBlueprint(blueprintId) {
        return this.post(API.EXPORT_BLUEPRINT, {
            OsClient: this.config.osClient,
            BlueprintId: blueprintId,
        });
    }
    async saveBlueprint(data) {
        return this.post(API.SAVE_BLUEPRINT, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async rollbackBlueprint(data) {
        return this.post(API.ROLLBACK_BLUEPRINT, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async deleteBlueprint(blueprintId) {
        return this.post(API.DELETE_BLUEPRINT, {
            OsClient: this.config.osClient,
            BlueprintId: blueprintId,
        });
    }
    async validateBlueprint(blueprintId) {
        return this.post(API.VALIDATE_BLUEPRINT, {
            OsClient: this.config.osClient,
            BlueprintId: blueprintId,
        });
    }
    destroy() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }
}
//# sourceMappingURL=microi-client.js.map