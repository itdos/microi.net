import crypto from 'node:crypto';
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
    }
    /** RSA 加密（PKCS1_PADDING，兼容 Microi 前端 JSEncrypt） */
    rsaEncrypt(plainText) {
        const encrypted = crypto.publicEncrypt({ key: this.rsaPublicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(plainText, 'utf-8'));
        return encrypted.toString('base64');
    }
    /** 登录并获取 JWT token */
    async login() {
        const encryptedPwd = this.rsaEncrypt(this.config.password);
        const res = await fetch(`${this.config.apiBaseUrl}/api/SysUser/Login`, {
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
        const json = (await res.json());
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
                const res = await fetch(`${this.config.apiBaseUrl}/api/SysUser/RefreshToken`, {
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
        const res = await fetch(`${this.config.apiBaseUrl}${path}`, {
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
        return (await res.json());
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
        return (await res.json());
    }
    // ---------- API 方法 ----------
    async getStatus() {
        return this.get('/api/V8Engine/GetStatus');
    }
    async getDbSchema() {
        return this.post('/api/V8Engine/GetDbSchema', {
            OsClient: this.config.osClient,
        });
    }
    async getEngineList(keyword) {
        return this.post('/api/V8Engine/GetApiEngineList', {
            OsClient: this.config.osClient,
            ...(keyword ? { _SearchKey: keyword } : {}),
        });
    }
    async getEngineCode(apiEngineKey) {
        return this.post('/api/V8Engine/GetApiEngineCode', {
            OsClient: this.config.osClient,
            ApiEngineKey: apiEngineKey,
        });
    }
    async executeEngine(apiEngineKey, params) {
        return this.post('/api/V8Engine/ExecuteApiEngine', {
            OsClient: this.config.osClient,
            ApiEngineKey: apiEngineKey,
            ...(params || {}),
        });
    }
    async getEventList(keyword) {
        return this.post('/api/V8Engine/GetV8EventList', {
            OsClient: this.config.osClient,
            ...(keyword ? { _SearchKey: keyword } : {}),
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