export interface MicroiConfig {
    apiBaseUrl: string;
    username: string;
    password: string;
    osClient?: string;
    rsaPublicKey?: string;
    /** 直接传入已有 Token（跳过帐号密码登录，适用于需要验证码的服务器） */
    token?: string;
    /** Token 文件路径（VS Code 扩展写入；MCP 自身刷新时也会回写以保持同步） */
    tokenFilePath?: string;
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
export declare class MicroiClient {
    private config;
    private token;
    private refreshTimer?;
    private rsaPublicKey;
    /** 同一时刻只允许一个刷新请求在飞 */
    private inflightRefresh?;
    constructor(config: MicroiConfig);
    /** RSA 加密（PKCS1_PADDING，兼容 Microi 前端 JSEncrypt） */
    private rsaEncrypt;
    /** 外部更新 token（由 VS Code 扩展 token 文件同步） */
    updateToken(newToken: string): void;
    /** 登录并获取 JWT token（若已有 token 则直接启动刷新）
     *  注意：即便传入了 token（来自 VS Code 扩展的 token 文件），也始终启动 MCP 自身的自动刷新作为兜底，
     *  避免 VS Code 关闭时 token 不再续期导致 MCP 调用失败。
     */
    login(_options?: {
        skipAutoRefresh?: boolean;
    }): Promise<void>;
    /** 每 12 分钟自动刷新 token（token 有效期通常 15 分钟） */
    private startAutoRefresh;
    /** 立即调用 /api/SysUser/RefreshToken 以旧换新；成功后回写 token 文件。
     *  并发请求会复用同一个 in-flight Promise。
     */
    refreshTokenNow(): Promise<boolean>;
    /** 从 token 文件重新读取（VS Code 扩展可能刚刚写入了新 token）。返回是否更新了 this.token。 */
    reloadTokenFromFile(): boolean;
    /** 把当前 token 回写到 token 文件（保持与 VS Code 扩展同步） */
    private writeTokenToFile;
    /** 检测是否是 token 失效响应（Code=1001 NoLogin），若是则尝试恢复 token。
     *  恢复策略：1) 重新读取 token 文件（VS Code 扩展可能刚写入新 token）；
     *           2) 若 token 没变化或仍失效，调用 RefreshToken API 主动刷新；
     *           3) 仍失败则用 username/password 重新登录（兜底）。
     *  返回 true 表示 token 已更新，调用方可重试请求。
     */
    private tryRecoverFromAuthFailure;
    /** 通用 POST 请求（自动处理 token 失效：刷新后重试一次） */
    private post;
    /** 通用 GET 请求（自动处理 token 失效：刷新后重试一次） */
    private get;
    private requestJson;
    getStatus(): Promise<ApiResponse>;
    getDbSchema(): Promise<ApiResponse<{
        Tables: DbTable[];
    }>>;
    getPlaywrightContext(keyword?: string, pageSize?: number): Promise<ApiResponse<PlaywrightContextData>>;
    getEngineList(keyword?: string): Promise<ApiResponse<ApiEngine[] | ListEnvelope<ApiEngine>>>;
    getEngineCode(apiEngineKey: string): Promise<ApiResponse<ApiEngine>>;
    executeEngine(apiEngineKey: string, params?: Record<string, unknown>): Promise<ApiResponse>;
    saveEngineCode(apiEngineKey: string, code: string, options?: {
        functionDescription?: string;
        changeSummary?: string;
    }): Promise<ApiResponse>;
    createEngine(data: {
        ApiEngineKey: string;
        ApiName: string;
        Category?: string;
        Code?: string;
        ApiAddress?: string;
        functionDescription?: string;
        changeSummary?: string;
    }): Promise<ApiResponse>;
    uploadFileBase64(data: {
        FileName?: string;
        FileByteBase64: string;
        Path?: string;
        Limit?: boolean;
        Preview?: boolean;
        TargetTable?: string;
        TargetId?: string;
        TargetField?: string;
    }): Promise<ApiResponse>;
    getTableData(tableName: string, query?: Record<string, unknown>): Promise<ApiResponse>;
    addFormData(tableName: string, row: Record<string, unknown>): Promise<ApiResponse>;
    updateFormData(tableName: string, row: Record<string, unknown>): Promise<ApiResponse>;
    getEventCode(formEngineKey: string, eventType: string): Promise<ApiResponse<V8Event>>;
    saveEventCode(formEngineKey: string, eventType: string, code: string, options?: {
        functionDescription?: string;
        changeSummary?: string;
    }): Promise<ApiResponse>;
    getEventList(keyword?: string): Promise<ApiResponse<V8Event[] | ListEnvelope<V8Event>>>;
    getWorkflowV8EventList(flowDesignId?: string): Promise<ApiResponse<WorkflowV8EventListData>>;
    getWorkflowV8EventCode(nodeId: string, eventType: string, flowDesignId?: string): Promise<ApiResponse<WorkflowNodeV8Event>>;
    saveWorkflowV8EventCode(nodeId: string, eventType: string, code: string, options?: {
        flowDesignId?: string;
        functionDescription?: string;
        changeSummary?: string;
    }): Promise<ApiResponse>;
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
        FormWidth?: number | null;
        Data?: string;
        Config?: string;
        Description?: string;
        Encrypt?: number;
        InTableEdit?: number;
    }): Promise<ApiResponse>;
    updateField(patch: Record<string, unknown>): Promise<ApiResponse>;
    getFieldList(tableName?: string, tableId?: string): Promise<ApiResponse>;
    updateTable(patch: Record<string, unknown>): Promise<ApiResponse>;
    refreshSchemaCache(tables: string[]): Promise<ApiResponse>;
    setEngineAnonymous(apiEngineKeys: string[], allowAnonymous?: number): Promise<ApiResponse>;
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
    listRoles(keyword?: string): Promise<ApiResponse>;
    saveRole(data: Record<string, unknown>): Promise<ApiResponse>;
    listModules(keyword?: string): Promise<ApiResponse>;
    getModule(moduleId: string): Promise<ApiResponse>;
    updateModule(data: Record<string, unknown>): Promise<ApiResponse>;
    listDataSources(keyword?: string): Promise<ApiResponse>;
    saveDataSource(data: Record<string, unknown>): Promise<ApiResponse>;
    runDataSource(dataSourceKey: string, params?: Record<string, unknown>): Promise<ApiResponse>;
    listPrintTemplates(keyword?: string): Promise<ApiResponse>;
    savePrintTemplate(data: Record<string, unknown>): Promise<ApiResponse>;
    saveWorkflowPackage(data: Record<string, unknown>): Promise<ApiResponse>;
    saveJob(data: Record<string, unknown>): Promise<ApiResponse>;
    validateLowCodeSystem(manifest: Record<string, unknown>): Promise<ApiResponse>;
    writeAuditLog(action: string, target: string, content: string): Promise<ApiResponse>;
    queryMongodbLogs(query?: MongodbLogQuery): Promise<ApiResponse>;
    writeMongodbLog(log: MongodbLogWrite): Promise<ApiResponse>;
    getPageEngineList(keyword?: string): Promise<ApiResponse>;
    getPageEngineDetail(pageId: string): Promise<ApiResponse>;
    savePageEngine(data: {
        PageId?: string;
        Title: string;
        Number?: string;
        Desc?: string;
        JsonStr: string;
        RoutePath?: string;
        ComponentPath?: string;
    }): Promise<ApiResponse>;
    listBlueprints(keyword?: string): Promise<ApiResponse>;
    getBlueprint(blueprintId: string): Promise<ApiResponse>;
    saveBlueprint(data: Record<string, unknown>): Promise<ApiResponse>;
    deleteBlueprint(blueprintId: string): Promise<ApiResponse>;
    validateBlueprint(blueprintId: string): Promise<ApiResponse>;
    destroy(): void;
}
//# sourceMappingURL=microi-client.d.ts.map