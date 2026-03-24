import crypto from 'node:crypto';
import { API } from './api-paths.js';

const DEFAULT_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
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
  rsaPublicKey?: string;
  /** 直接传入已有 Token（跳过帐号密码登录，适用于需要验证码的服务器） */
  token?: string;
}

export interface ApiResponse<T = unknown> {
  Code: number;
  Data: T;
  Msg: string;
  Total?: number;
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

export interface ApiEngine {
  Id: string;
  ApiName: string;
  ApiEngineKey: string;
  ApiAddress: string;
  Category: string;
  Code: string;
  Description?: string;
}

export interface V8Event {
  Id: string;
  FormEngineKey: string;
  Description: string;
  EventType: string;
  Code: string;
  TableName?: string;
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

  constructor(config: MicroiConfig) {
    this.config = config;
    this.rsaPublicKey = config.rsaPublicKey || DEFAULT_RSA_PUBLIC_KEY;
    // 如果直接传入 token，跳过登录流程
    if (config.token) {
      this.token = config.token;
    }
  }

  /** RSA 加密（PKCS1_PADDING，兼容 Microi 前端 JSEncrypt） */
  private rsaEncrypt(plainText: string): string {
    const encrypted = crypto.publicEncrypt(
      { key: this.rsaPublicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(plainText, 'utf-8'),
    );
    return encrypted.toString('base64');
  }

  /** 外部更新 token（由 VS Code 扩展 token 文件同步） */
  updateToken(newToken: string): void {
    this.token = newToken;
  }

  /** 登录并获取 JWT token（若已有 token 则直接启动刷新） */
  async login(options?: { skipAutoRefresh?: boolean }): Promise<void> {
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

    this.token = token;
    this.startAutoRefresh();
    console.error('[microi-mcp] Login successful');
  }

  /** 每 12 分钟自动刷新 token（token 有效期 15 分钟） */
  private startAutoRefresh(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
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
      } catch (e) {
        console.error('[microi-mcp] Token refresh failed:', e);
      }
    }, 12 * 60 * 1000);
  }

  /** 通用 POST 请求 */
  private async post<T = unknown>(path: string, body: unknown): Promise<ApiResponse<T>> {
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
    if (newToken) this.token = newToken;

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
    }
    if (!text) {
      throw new Error(`HTTP ${res.status} — empty response body`);
    }
    try {
      return JSON.parse(text) as ApiResponse<T>;
    } catch {
      throw new Error(`HTTP ${res.status} — invalid JSON: ${text.slice(0, 200)}`);
    }
  }

  /** 通用 GET 请求 */
  private async get<T = unknown>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    let url = `${this.config.apiBaseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      if (qs) url += `?${qs}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    const newToken = res.headers.get('authorization');
    if (newToken) this.token = newToken;

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
    }
    if (!text) {
      throw new Error(`HTTP ${res.status} — empty response body`);
    }
    try {
      return JSON.parse(text) as ApiResponse<T>;
    } catch {
      throw new Error(`HTTP ${res.status} — invalid JSON: ${text.slice(0, 200)}`);
    }
  }

  // ---------- API 方法 ----------

  async getStatus(): Promise<ApiResponse> {
    return this.get(API.GET_STATUS);
  }

  async getDbSchema(): Promise<ApiResponse<{ Tables: DbTable[] }>> {
    return this.post(API.GET_DB_SCHEMA, {
      OsClient: this.config.osClient,
    });
  }

  async getEngineList(keyword?: string): Promise<ApiResponse<ApiEngine[]>> {
    return this.post(API.GET_ENGINE_LIST, {
      OsClient: this.config.osClient,
      ...(keyword ? { _SearchKey: keyword } : {}),
    });
  }

  async getEngineCode(apiEngineKey: string): Promise<ApiResponse<ApiEngine>> {
    return this.post(API.GET_ENGINE_CODE, {
      OsClient: this.config.osClient,
      ApiEngineKey: apiEngineKey,
    });
  }

  async executeEngine(apiEngineKey: string, params?: Record<string, unknown>): Promise<ApiResponse> {
    return this.post(API.EXECUTE_ENGINE, {
      OsClient: this.config.osClient,
      ApiEngineKey: apiEngineKey,
      ...(params || {}),
    });
  }

  async saveEngineCode(apiEngineKey: string, code: string): Promise<ApiResponse> {
    return this.post(API.UPDATE_ENGINE_CODE, {
      OsClient: this.config.osClient,
      ApiEngineKey: apiEngineKey,
      ApiV8Code: code,
    });
  }

  async createEngine(data: { ApiEngineKey: string; ApiName: string; Category?: string; Code?: string }): Promise<ApiResponse> {
    return this.post(API.CREATE_ENGINE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async getEventCode(formEngineKey: string, eventType: string): Promise<ApiResponse<V8Event>> {
    return this.post(API.GET_EVENT_CODE, {
      OsClient: this.config.osClient,
      FormEngineKey: formEngineKey,
      EventType: eventType,
    });
  }

  async saveEventCode(formEngineKey: string, eventType: string, code: string): Promise<ApiResponse> {
    return this.post(API.UPDATE_EVENT_CODE, {
      OsClient: this.config.osClient,
      FormEngineKey: formEngineKey,
      EventType: eventType,
      V8Code: code,
    });
  }

  async getEventList(keyword?: string): Promise<ApiResponse<V8Event[]>> {
    return this.post(API.GET_EVENT_LIST, {
      OsClient: this.config.osClient,
      ...(keyword ? { _SearchKey: keyword } : {}),
    });
  }

  // ---------- 低代码系统设计 API 方法 ----------

  async createTable(name: string, description?: string): Promise<ApiResponse> {
    return this.post(API.CREATE_TABLE, {
      OsClient: this.config.osClient,
      Name: name,
      Description: description || '',
    });
  }

  async addField(data: {
    TableId: string; Name: string; Label: string;
    Type?: string; Component?: string;
    Visible?: number; AppVisible?: number;
    Tab?: string; TableWidth?: number; Sort?: number;
    NameConfirm?: number; Readonly?: number;
  }): Promise<ApiResponse> {
    return this.post(API.ADD_FIELD, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async createModule(data: {
    Name: string; DiyTableId?: string; ParentId?: string;
    ComponentName?: string; ComponentPath?: string;
    Display?: number; AppDisplay?: number;
    OpenType?: string; Url?: string; Sort?: number;
  }): Promise<ApiResponse> {
    return this.post(API.CREATE_MODULE, {
      OsClient: this.config.osClient,
      ...data,
    });
  }

  async setRolePermission(roleId: string, menuIds: string[]): Promise<ApiResponse> {
    return this.post(API.SET_ROLE_PERMISSION, {
      OsClient: this.config.osClient,
      RoleId: roleId,
      MenuIds: menuIds,
    });
  }

  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }
}
