export interface MicroiConfig {
    apiBaseUrl: string;
    username: string;
    password: string;
    osClient?: string;
    rsaPublicKey?: string;
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
export declare class MicroiClient {
    private config;
    private token;
    private refreshTimer?;
    private rsaPublicKey;
    constructor(config: MicroiConfig);
    /** RSA 加密（PKCS1_PADDING，兼容 Microi 前端 JSEncrypt） */
    private rsaEncrypt;
    /** 登录并获取 JWT token */
    login(): Promise<void>;
    /** 每 12 分钟自动刷新 token（token 有效期 15 分钟） */
    private startAutoRefresh;
    /** 通用 POST 请求 */
    private post;
    /** 通用 GET 请求 */
    private get;
    getStatus(): Promise<ApiResponse>;
    getDbSchema(): Promise<ApiResponse<{
        Tables: DbTable[];
    }>>;
    getEngineList(keyword?: string): Promise<ApiResponse<ApiEngine[]>>;
    getEngineCode(apiEngineKey: string): Promise<ApiResponse<ApiEngine>>;
    executeEngine(apiEngineKey: string, params?: Record<string, unknown>): Promise<ApiResponse>;
    getEventList(keyword?: string): Promise<ApiResponse<V8Event[]>>;
    destroy(): void;
}
//# sourceMappingURL=microi-client.d.ts.map