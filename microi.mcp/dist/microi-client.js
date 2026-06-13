import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { API } from './api-paths.js';
import { prepareV8VersionedCode } from './v8-version.js';
/** Microi 后端登录身份失效错误码（与 diy_lang 表中 NoLogin 一致） */
const NO_LOGIN_CODE = 1001;
const DEFAULT_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R
XaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ
1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg
1DsI9VJ7gTHGL3R7sQIDAQAB
-----END PUBLIC KEY-----`;
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
    /** 同一时刻只允许一个刷新请求在飞 */
    inflightRefresh;
    constructor(config) {
        this.config = config;
        this.rsaPublicKey = config.rsaPublicKey || DEFAULT_RSA_PUBLIC_KEY;
        // 如果直接传入 token，跳过登录流程
        if (config.token) {
            this.token = config.token;
        }
    }
    /** RSA 加密（PKCS1_PADDING，兼容 Microi 前端 JSEncrypt） */
    rsaEncrypt(plainText) {
        const encrypted = crypto.publicEncrypt({ key: this.rsaPublicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(plainText, 'utf-8'));
        return encrypted.toString('base64');
    }
    /** 外部更新 token（由 VS Code 扩展 token 文件同步） */
    updateToken(newToken) {
        this.token = newToken;
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
        const encryptedPwd = this.rsaEncrypt(this.config.password);
        const res = await fetch(`${this.config.apiBaseUrl}${API.LOGIN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Account: this.config.username,
                Pwd: encryptedPwd,
                OsClient: this.config.osClient || undefined,
                _ClientType: 'MCP',
            }),
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
        this.token = token;
        this.startAutoRefresh();
        console.error('[microi-mcp] Login successful');
    }
    /** 每 12 分钟自动刷新 token（token 有效期通常 15 分钟） */
    startAutoRefresh() {
        if (this.refreshTimer)
            clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(() => {
            this.refreshTokenNow().catch((e) => console.error('[microi-mcp] Token refresh failed:', e));
        }, 12 * 60 * 1000);
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
                    },
                    // 同时把旧 token 放在 body 里（后端 SysUserController.RefreshToken 兼容两种位置）
                    body: JSON.stringify({
                        authorization: this.token,
                        OsClient: this.config.osClient || undefined,
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
                    this.token = newToken;
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
            const apiUrl = this.config.apiBaseUrl.replace(/\/+$/, '');
            const osClient = this.config.osClient || '';
            const fileToken = osClient ? tokens[`${apiUrl}|${osClient}`] : tokens[apiUrl];
            if (fileToken && fileToken !== this.token) {
                this.token = fileToken;
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
            const apiUrl = this.config.apiBaseUrl.replace(/\/+$/, '');
            const osClient = this.config.osClient || '';
            if (osClient) {
                tokens[`${apiUrl}|${osClient}`] = this.token;
            }
            else {
                tokens[apiUrl] = this.token;
            }
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), { encoding: 'utf-8', mode: 0o600 });
        }
        catch (e) {
            console.error('[microi-mcp] Write token file failed:', e);
        }
    }
    /** 检测是否是 token 失效响应（Code=1001 NoLogin），若是则尝试恢复 token。
     *  恢复策略：1) 重新读取 token 文件（VS Code 扩展可能刚写入新 token）；
     *           2) 若 token 没变化或仍失效，调用 RefreshToken API 主动刷新；
     *           3) 仍失败则用 username/password 重新登录（兜底）。
     *  返回 true 表示 token 已更新，调用方可重试请求。
     */
    async tryRecoverFromAuthFailure() {
        // 1. 先尝试读文件，可能 VS Code 已经刷过了
        if (this.reloadTokenFromFile()) {
            console.error('[microi-mcp] Token reloaded from file after auth failure');
            return true;
        }
        // 2. 主动刷新
        if (await this.refreshTokenNow())
            return true;
        // 3. 兜底：用账号密码重新登录
        if (this.config.username && this.config.password) {
            try {
                const oldToken = this.token;
                this.token = '';
                await this.login();
                if (this.token && this.token !== oldToken) {
                    this.writeTokenToFile();
                    console.error('[microi-mcp] Re-logged in after auth failure');
                    return true;
                }
            }
            catch (e) {
                console.error('[microi-mcp] Re-login failed:', e);
            }
        }
        return false;
    }
    /** 通用 POST 请求（自动处理 token 失效：刷新后重试一次） */
    async post(reqPath, body) {
        return this.requestJson('POST', reqPath, body, undefined, true);
    }
    /** 通用 GET 请求（自动处理 token 失效：刷新后重试一次） */
    async get(reqPath, params) {
        return this.requestJson('GET', reqPath, undefined, params, true);
    }
    async requestJson(method, reqPath, body, params, allowRetryOnAuthFailure = true) {
        let url = `${this.config.apiBaseUrl}${reqPath}`;
        if (method === 'GET' && params) {
            const qs = new URLSearchParams(params).toString();
            if (qs)
                url += `?${qs}`;
        }
        const headers = { Authorization: `Bearer ${this.token}` };
        if (method === 'POST')
            headers['Content-Type'] = 'application/json';
        const res = await fetch(url, {
            method,
            headers,
            ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
        });
        const newToken = res.headers.get('authorization');
        if (newToken) {
            this.token = newToken;
            this.writeTokenToFile();
        }
        const text = await res.text();
        // HTTP 401 → 刷新后重试一次
        if (res.status === 401 && allowRetryOnAuthFailure) {
            if (await this.tryRecoverFromAuthFailure()) {
                return this.requestJson(method, reqPath, body, params, false);
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
        // Microi 用 Code=1001 表达"登录身份已过期"（HTTP 仍是 200）
        if (parsed?.Code === NO_LOGIN_CODE && allowRetryOnAuthFailure) {
            console.error(`[microi-mcp] Auth expired (Code=${NO_LOGIN_CODE}: ${parsed.Msg || ''}), attempting recovery...`);
            if (await this.tryRecoverFromAuthFailure()) {
                return this.requestJson(method, reqPath, body, params, false);
            }
        }
        return parsed;
    }
    // ---------- API 方法 ----------
    async getStatus() {
        return this.get(API.GET_STATUS);
    }
    async getDbSchema() {
        return this.post(API.GET_DB_SCHEMA, {
            OsClient: this.config.osClient,
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
    async getEngineCode(apiEngineKey) {
        return this.post(API.GET_ENGINE_CODE, {
            OsClient: this.config.osClient,
            ApiEngineKey: apiEngineKey,
        });
    }
    async executeEngine(apiEngineKey, params) {
        return this.post(API.EXECUTE_ENGINE, {
            OsClient: this.config.osClient,
            ApiEngineKey: apiEngineKey,
            Param: params || {},
        });
    }
    async saveEngineCode(apiEngineKey, code, options) {
        let remote;
        try {
            const remoteResult = await this.getEngineCode(apiEngineKey);
            remote = remoteResult.Code === 1 ? remoteResult.Data : undefined;
        }
        catch {
            remote = undefined;
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
        return this.post(API.UPDATE_ENGINE_CODE, {
            OsClient: this.config.osClient,
            ApiEngineKey: apiEngineKey,
            ApiV8CodeBase64: Buffer.from(prepared.code, 'utf8').toString('base64'),
            Version: prepared.version,
            ChangeHistory: prepared.changeHistory,
        });
    }
    async createEngine(data) {
        // 默认 ApiAddress 为 /apiengine/{key}，否则平台路由匹配会 404
        const payload = {
            OsClient: this.config.osClient,
            ...data,
        };
        const code = typeof payload.Code === 'string' ? payload.Code : (typeof payload.ApiV8Code === 'string' ? payload.ApiV8Code : '');
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
        return this.post(API.CREATE_ENGINE, payload);
    }
    async uploadFileBase64(data) {
        return this.post(API.UPLOAD_FILE_BASE64, {
            OsClient: this.config.osClient,
            ...data,
        });
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
    async getEventCode(formEngineKey, eventType) {
        return this.post(API.GET_EVENT_CODE, {
            OsClient: this.config.osClient,
            FormEngineKey: formEngineKey,
            EventType: eventType,
        });
    }
    async saveEventCode(formEngineKey, eventType, code, options) {
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
        return this.post(API.UPDATE_EVENT_CODE, {
            OsClient: this.config.osClient,
            FormEngineKey: formEngineKey,
            EventType: eventType,
            V8Code: prepared.code,
            Version: prepared.version,
            ChangeHistory: prepared.changeHistory,
        });
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
    async addField(data) {
        return this.post(API.ADD_FIELD, {
            OsClient: this.config.osClient,
            ...data,
            Visible: data.Visible ?? 1,
            AppVisible: data.AppVisible ?? 1,
        });
    }
    async updateField(patch) {
        return this.post(API.UPDATE_FIELD, {
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
        return this.post(API.CREATE_MODULE, {
            OsClient: this.config.osClient,
            ...data,
            Display: data.Display ?? 1,
            AppDisplay: data.AppDisplay ?? 1,
        });
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
    async getModule(moduleId) {
        return this.post(API.GET_MODULE, {
            OsClient: this.config.osClient,
            ModuleId: moduleId,
        });
    }
    async updateModule(data) {
        return this.post(API.UPDATE_MODULE, {
            OsClient: this.config.osClient,
            ...data,
        });
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
    async saveBlueprint(data) {
        return this.post(API.SAVE_BLUEPRINT, {
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