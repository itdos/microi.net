import crypto from 'node:crypto';
import { API } from './api-paths.js';
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
    /** 登录并获取 JWT token（若已有 token 则直接启动刷新） */
    async login(options) {
        // 若通过 token 初始化，跳过登录
        if (this.token) {
            if (!options?.skipAutoRefresh) {
                this.startAutoRefresh();
            }
            console.error('[microi-mcp] Using provided token (skip login)');
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
    /** 每 12 分钟自动刷新 token（token 有效期 15 分钟） */
    startAutoRefresh() {
        if (this.refreshTimer)
            clearInterval(this.refreshTimer);
        this.refreshTimer = setInterval(async () => {
            try {
                const res = await fetch(`${this.config.apiBaseUrl}${API.REFRESH_TOKEN}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.token}`,
                    },
                });
                const newToken = res.headers.get('authorization');
                if (newToken) {
                    this.token = newToken;
                    console.error('[microi-mcp] Token refreshed');
                }
            }
            catch (e) {
                console.error('[microi-mcp] Token refresh failed:', e);
            }
        }, 12 * 60 * 1000);
    }
    /** 通用 POST 请求 */
    async post(path, body) {
        const url = `${this.config.apiBaseUrl}${path}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify(body),
        });
        const newToken = res.headers.get('authorization');
        if (newToken)
            this.token = newToken;
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
        }
        if (!text) {
            throw new Error(`HTTP ${res.status} — empty response body`);
        }
        try {
            return JSON.parse(text);
        }
        catch {
            throw new Error(`HTTP ${res.status} — invalid JSON: ${text.slice(0, 200)}`);
        }
    }
    /** 通用 GET 请求 */
    async get(path, params) {
        let url = `${this.config.apiBaseUrl}${path}`;
        if (params) {
            const qs = new URLSearchParams(params).toString();
            if (qs)
                url += `?${qs}`;
        }
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${this.token}` },
        });
        const newToken = res.headers.get('authorization');
        if (newToken)
            this.token = newToken;
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
        }
        if (!text) {
            throw new Error(`HTTP ${res.status} — empty response body`);
        }
        try {
            return JSON.parse(text);
        }
        catch {
            throw new Error(`HTTP ${res.status} — invalid JSON: ${text.slice(0, 200)}`);
        }
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
            ...(params || {}),
        });
    }
    async saveEngineCode(apiEngineKey, code) {
        return this.post(API.UPDATE_ENGINE_CODE, {
            OsClient: this.config.osClient,
            ApiEngineKey: apiEngineKey,
            ApiV8Code: code,
        });
    }
    async createEngine(data) {
        return this.post(API.CREATE_ENGINE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async getEventCode(formEngineKey, eventType) {
        return this.post(API.GET_EVENT_CODE, {
            OsClient: this.config.osClient,
            FormEngineKey: formEngineKey,
            EventType: eventType,
        });
    }
    async saveEventCode(formEngineKey, eventType, code) {
        return this.post(API.UPDATE_EVENT_CODE, {
            OsClient: this.config.osClient,
            FormEngineKey: formEngineKey,
            EventType: eventType,
            V8Code: code,
        });
    }
    async getEventList(keyword) {
        return this.post(API.GET_EVENT_LIST, {
            OsClient: this.config.osClient,
            ...(keyword ? { _SearchKey: keyword } : {}),
        });
    }
    // ---------- 低代码系统设计 API 方法 ----------
    async createTable(name, description) {
        return this.post(API.CREATE_TABLE, {
            OsClient: this.config.osClient,
            Name: name,
            Description: description || '',
        });
    }
    async addField(data) {
        return this.post(API.ADD_FIELD, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async createModule(data) {
        return this.post(API.CREATE_MODULE, {
            OsClient: this.config.osClient,
            ...data,
        });
    }
    async setRolePermission(roleId, menuIds) {
        return this.post(API.SET_ROLE_PERMISSION, {
            OsClient: this.config.osClient,
            RoleId: roleId,
            MenuIds: menuIds,
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