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
    DataCount?: number;
}
export interface ListEnvelope<T> {
    OsClient?: string;
    OsClientType?: string;
    OsClientNetwork?: string;
    List?: T[];
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
    ApiV8Code?: string;
    Code?: string;
    ApiRemark?: string;
    Description?: string;
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
    UpdateTime?: string;
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
    /** 外部更新 token（由 VS Code 扩展 token 文件同步） */
    updateToken(newToken: string): void;
    /** 登录并获取 JWT token（若已有 token 则直接启动刷新） */
    login(options?: {
        skipAutoRefresh?: boolean;
    }): Promise<void>;
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
    getEngineList(keyword?: string): Promise<ApiResponse<ApiEngine[] | ListEnvelope<ApiEngine>>>;
    getEngineCode(apiEngineKey: string): Promise<ApiResponse<ApiEngine>>;
    executeEngine(apiEngineKey: string, params?: Record<string, unknown>): Promise<ApiResponse>;
    saveEngineCode(apiEngineKey: string, code: string): Promise<ApiResponse>;
    createEngine(data: {
        ApiEngineKey: string;
        ApiName: string;
        Category?: string;
        Code?: string;
    }): Promise<ApiResponse>;
    getEventCode(formEngineKey: string, eventType: string): Promise<ApiResponse<V8Event>>;
    saveEventCode(formEngineKey: string, eventType: string, code: string): Promise<ApiResponse>;
    getEventList(keyword?: string): Promise<ApiResponse<V8Event[] | ListEnvelope<V8Event>>>;
    createTable(name: string, description?: string, options?: {
        Tabs?: string;
        IsTree?: number;
        Column?: number;
        FormOpenType?: string;
        FormOpenWidth?: string;
    }): Promise<ApiResponse>;
    addField(data: {
        TableId: string;
        Name: string;
        Label: string;
        Type?: string;
        Component?: string;
        Visible?: number;
        AppVisible?: number;
        Tab?: string;
        TableWidth?: number;
        Sort?: number;
        NameConfirm?: number;
        Readonly?: number;
        NotEmpty?: number;
        Unique?: number;
        DefaultValue?: string;
        Placeholder?: string;
        FormWidth?: string;
        Data?: string;
        Config?: string;
        Description?: string;
        Encrypt?: number;
        InTableEdit?: number;
    }): Promise<ApiResponse>;
    createModule(data: {
        Name: string;
        DiyTableId?: string;
        ParentId?: string;
        ComponentName?: string;
        ComponentPath?: string;
        Display?: number;
        AppDisplay?: number;
        OpenType?: string;
        Url?: string;
        Sort?: number;
        Icon?: string;
        SearchFieldIds?: string;
        TableDiyFieldIds?: string;
        DefaultOrderBy?: string;
        SqlWhere?: string;
        DiyConfig?: string;
        MoreBtns?: string;
        FormBtns?: string;
        BatchSelectMoreBtns?: string;
        PageTabs?: string;
        ExportMoreBtns?: string;
        PageBtns?: string;
        SortFieldIds?: string;
        NotShowFields?: string;
        SqlJoin?: string;
        JoinTables?: string;
        SelectFields?: string;
        StatisticsFields?: string;
        InTableEdit?: number;
        InTableEditFields?: string;
        MobileListFields?: string;
        CardTitleTagFields?: string;
        CardBottomTagFields?: string;
    }): Promise<ApiResponse>;
    setRolePermission(roleId: string, menuIds: string[]): Promise<ApiResponse>;
    getPageEngineList(keyword?: string): Promise<ApiResponse>;
    getPageEngineDetail(pageId: string): Promise<ApiResponse>;
    savePageEngine(data: {
        PageId?: string;
        Title: string;
        Number?: string;
        Desc?: string;
        JsonStr: string;
    }): Promise<ApiResponse>;
    destroy(): void;
}
//# sourceMappingURL=microi-client.d.ts.map