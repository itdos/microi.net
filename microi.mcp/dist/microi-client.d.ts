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
    /** Windows DPAPI(CurrentUser) 工作区凭据保险库；只传路径和键名，不传明文。 */
    workspaceCredentialFilePath?: string;
    workspaceCredentialUsernameKey?: string;
    workspaceCredentialPasswordKey?: string;
    /** 普通 HTTP 请求超时，默认 120 秒 */
    requestTimeoutMs?: number;
    /** V8 代码、菜单等写请求超时，默认 60 秒 */
    writeRequestTimeoutMs?: number;
    /** 写请求响应不确定时，单次远端回读超时，默认 5 秒 */
    readbackRequestTimeoutMs?: number;
}
/**
 * Return token-file keys from the most specific tenant identity to legacy keys.
 * New writers use api|os|type|network even when type/network are empty, while
 * readers keep accepting the older compact api|os|type, api|os and api layouts
 * during migration. Keeping the empty segments is important: the VS Code
 * broker may intentionally leave an ambiguous legacy alias untouched.
 */
export declare function buildTokenFileLookupKeys(apiBaseUrl: string, osClient?: string, osClientType?: string, osClientNetwork?: string): string[];
export declare function buildMicroAppEntryUrl(apiBaseUrl: string, osClient: string, msKey: string): string;
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
export interface OcrRecognizeRequest {
    FileByteBase64: string;
    FileName?: string;
    UseDocOrientationClassify?: boolean;
    UseDocUnwarping?: boolean;
    UseTextlineOrientation?: boolean;
    TextRecScoreThresh?: number;
    ReturnWordBox?: boolean;
}
export interface OcrRegion {
    Text?: string;
    Confidence?: number;
    Polygon?: number[][];
}
export interface OcrPage {
    PageIndex?: number;
    Text?: string;
    AverageConfidence?: number;
    Regions?: OcrRegion[];
}
export interface OcrRecognizeResult {
    Provider?: string;
    TraceId?: string;
    FileName?: string;
    FileType?: string;
    Text?: string;
    AverageConfidence?: number;
    PageCount?: number;
    ElapsedMilliseconds?: number;
    Pages?: OcrPage[];
    TextTruncated?: boolean;
}
export interface TranslateTextRequest {
    SourceText?: string;
    SourceTexts?: string[];
    FromLang?: string;
    Lang: string;
    Format?: 'text' | 'html';
    Alternatives?: number;
}
export interface TranslateDetection {
    Language?: string;
    Confidence?: number;
}
export interface TranslateTextResult {
    Provider?: string;
    IsBatch?: boolean;
    SourceLanguage?: string;
    TargetLanguage?: string;
    Format?: string;
    TranslatedText?: string;
    TranslatedTexts?: string[];
    DetectedLanguage?: TranslateDetection;
    DetectedLanguages?: TranslateDetection[];
    Alternatives?: string[];
    AlternativeGroups?: string[][];
}
export interface TranslateLanguage {
    Code?: string;
    Name?: string;
    Targets?: string[];
}
export interface TranslateFileRequest {
    FileByteBase64: string;
    FileName: string;
    FromLang?: string;
    Lang: string;
}
export interface TranslateFileResult {
    Provider?: string;
    FileName?: string;
    ContentType?: string;
    FileByteBase64?: string;
    ByteLength?: number;
}
export interface TranslateSuggestionResult {
    Provider?: string;
    Success?: boolean;
}
export interface TranslateHealthResult {
    Provider?: string;
    Status?: string;
    Healthy?: boolean;
    SupportsBatch?: boolean;
    SupportsHtml?: boolean;
    SupportsAlternatives?: boolean;
    SupportsDetection?: boolean;
    SupportsFiles?: boolean;
    SupportsSuggestions?: boolean;
}
export interface ApplicationStreamGateTransitionRequest {
    OsClient: string;
    OsClientType: string;
    OsClientNetwork: string;
    ExpectedMode: 'LegacyOpen' | 'Drain' | 'V3Only';
    ExpectedMinProtocol: 2 | 3;
    ExpectedGateEpoch: string;
    TargetMode: 'LegacyOpen' | 'Drain' | 'V3Only';
    TargetMinProtocol: 2 | 3;
    TransitionId: string;
    Reason: string;
    DrainProofJson: string;
    DrainProofHash: string;
    ConfirmationSha256: string;
    ConfirmExecution: true;
}
export interface ApplicationAssetStreamUploadRequest {
    AppIdOrKey: string;
    VersionNo: string;
    RelativePath: string;
    ExpectedSha256: string;
    RequestId: string;
    FilePath: string;
    TimeoutMs?: number;
    ProtocolVersion?: 3;
    ExpectedGateEpoch?: string;
    RequestFingerprint?: string;
    DeliveryBatchId?: string;
    SourceManifestHash?: string;
    RuntimeManifestHash?: string;
    RouteSnapshotJson?: string;
    RouteSnapshotHash?: string;
    ExpectedCurrentVersion?: number;
    ExpectedAppVersion?: string | null;
    ExpectedPublishFence?: string;
    ExpectedPublishRowVersion?: string;
    ExpectedVersionRowVersion?: string | null;
    ExpectedActivePublishVersionId?: string | null;
    ExpectedCommittedPublishVersionId?: string | null;
}
export interface ApplicationAssetMultipartPartEvidence {
    Number: number;
    Size: number;
    Sha256: string;
    Path?: string;
    UploadedAt?: string;
}
export interface ApplicationAssetMultipartEvidence {
    SessionId: string;
    Status: string;
    ChunkSize: number;
    TotalParts: number;
    UploadedParts?: number;
    ReceivedBytes?: number;
    Total?: number;
    ProgressPercent?: number;
    Parts?: ApplicationAssetMultipartPartEvidence[];
    Completed?: boolean;
    Idempotent?: boolean;
    [key: string]: unknown;
}
export interface ApplicationAssetStreamFinalizeRequest {
    AppIdOrKey: string;
    VersionNo: string;
    EntryPath: string;
    Assets: Array<{
        Path: string;
        Sha256: string;
        Size: number;
    }>;
    PublishMode?: 'stage' | 'finalize';
    ProtocolVersion?: 3;
    ExpectedGateEpoch?: string;
    RequestId: string;
    RequestFingerprint?: string;
    DeliveryBatchId: string;
    SourceManifestHash?: string;
    RuntimeManifestHash: string;
    RouteSnapshotJson?: string;
    RouteSnapshotHash?: string;
    ExpectedCurrentVersion?: number;
    ExpectedAppVersion?: string | null;
    ExpectedPublishFence?: string;
    ExpectedPublishRowVersion?: string;
    ExpectedVersionRowVersion?: string | null;
    ExpectedActivePublishVersionId?: string | null;
    ExpectedCommittedPublishVersionId?: string | null;
    Routes?: Array<Record<string, unknown>>;
    ChangeSummary?: string;
}
export declare function isTenantConfigurationFailureResponse(result?: Partial<ApiResponse> | null): boolean;
export declare function isAuthenticationFailureResponse(result?: Partial<ApiResponse> | null): boolean;
export interface ListEnvelope<T> {
    OsClient?: string;
    OsClientType?: string;
    OsClientNetwork?: string;
    List?: T[];
    Total?: number;
}
interface RequestOptions {
    timeoutMs?: number;
    /** Ordinary JSON requests stay bounded to ten minutes unless an explicit
     * long-running streaming operation raises this ceiling. */
    maxTimeoutMs?: number;
    operationName?: string;
}
export declare class MicroiTransportError extends Error {
    readonly kind: 'timeout' | 'network';
    readonly requestPath: string;
    readonly uncertainOutcome: boolean;
    constructor(message: string, options: {
        kind: 'timeout' | 'network';
        requestPath: string;
        uncertainOutcome: boolean;
        cause?: unknown;
    });
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
    V8Unlimited?: number;
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
export declare class MicroiClient {
    private config;
    private token;
    private refreshTimer?;
    private rsaPublicKey;
    private readonly did;
    private readonly requestTimeoutMs;
    private readonly writeRequestTimeoutMs;
    private readonly readbackRequestTimeoutMs;
    /** 同一时刻只允许一个刷新请求在飞 */
    private inflightRefresh?;
    /** 同一时刻只允许一条完整身份恢复链路，避免并发重登或重复写恢复请求。 */
    private inflightAuthRecovery?;
    /** 刷新签发的替代 Token 仍被拒绝时，凭据恢复阶段也必须 single-flight。 */
    private inflightCredentialRecovery?;
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
    /** 每小时检查一次长效 Token，仅在临近到期时换新，避免多 MCP 进程竞争刷新。 */
    private startAutoRefresh;
    /** 立即调用 /api/SysUser/RefreshToken 以旧换新；成功后回写 token 文件。
     *  并发请求会复用同一个 in-flight Promise。
     */
    refreshTokenNow(): Promise<boolean>;
    /** 从 token 文件重新读取（VS Code 扩展可能刚刚写入了新 token）。返回是否更新了 this.token。 */
    reloadTokenFromFile(): boolean;
    /** 把当前 token 回写到 token 文件（保持与 VS Code 扩展同步） */
    private writeTokenToFile;
    private requestVsCodeCredentialRecovery;
    /** 检测 token 身份失效响应，若是则尝试恢复 token。
     *  恢复策略：1) 重新读取 token 文件（VS Code 扩展可能刚写入新 token）；
     *           2) 若 token 没变化或仍失效，调用 RefreshToken API 主动刷新；
     *           3) 仍失败且 MCP 独立配置了凭据时重新登录；
     *           4) VS Code 托管模式写入无密请求，由扩展通过 SecretStorage 重登。
     *  返回 true 表示 token 已更新，调用方可重试请求。
     */
    private tryRecoverFromAuthFailure;
    private tryRecoverFromAuthFailureCore;
    private reloadWorkspaceCredentials;
    /** 通用 POST 请求（自动处理 token 失效：刷新后重试一次） */
    private post;
    /** 通用 GET 请求（自动处理 token 失效：刷新后重试一次） */
    private get;
    private requestJson;
    /**
     * Stream one local file as multipart without materializing it as Base64 or a
     * whole-file Buffer. A retry constructs a fresh file stream, so auth recovery
     * remains safe for large immutable application assets.
     */
    private requestMultipartFile;
    private requestJsonNative;
    private requestMultipartFileNative;
    /**
     * Send one exact local byte range as application/octet-stream. Each retry
     * opens a fresh range stream, so an interrupted request never depends on a
     * partially consumed Node stream. The server binds the part number to a
     * declared size and SHA-256 before committing its durable checkpoint.
     */
    private requestBinaryFileRange;
    private isUncertainWriteError;
    private readbackOptions;
    private pollReadback;
    private recoveredWriteResult;
    private uncertainWriteFailure;
    getStatus(): Promise<ApiResponse>;
    transitionApplicationStreamGate(data: ApplicationStreamGateTransitionRequest): Promise<ApiResponse>;
    listMyUserAccessKeys(): Promise<ApiResponse<UserAccessKeyRecord[]>>;
    createMyUserAccessKey(input: CreateUserAccessKeyInput): Promise<ApiResponse<CreateUserAccessKeyResult>>;
    revokeMyUserAccessKey(id: string): Promise<ApiResponse<UserAccessKeyRecord>>;
    getDbSchema(): Promise<ApiResponse<{
        Tables: DbTable[];
    }>>;
    getTableIndexes(tableName: string, readback?: boolean): Promise<ApiResponse<TableIndexInfo[]>>;
    createTableIndex(data: {
        TableName: string;
        IndexName?: string;
        Columns: string[];
        Unique?: boolean;
    }): Promise<ApiResponse>;
    dropTableIndex(tableName: string, indexName: string): Promise<ApiResponse>;
    getSupportedDatabaseTypes(): Promise<ApiResponse>;
    inspectExternalDatabase(data: Record<string, unknown>): Promise<ApiResponse>;
    queryExternalDatabase(data: Record<string, unknown>): Promise<ApiResponse>;
    executeExternalDatabaseSql(data: Record<string, unknown>): Promise<ApiResponse>;
    saveDatabaseConnection(data: Record<string, unknown>): Promise<ApiResponse>;
    importExternalAttachment(data: Record<string, unknown>): Promise<ApiResponse>;
    getPlaywrightContext(keyword?: string, pageSize?: number): Promise<ApiResponse<PlaywrightContextData>>;
    getEngineList(keyword?: string): Promise<ApiResponse<ApiEngine[] | ListEnvelope<ApiEngine>>>;
    getEngineCode(apiEngineKey: string, options?: RequestOptions): Promise<ApiResponse<ApiEngine>>;
    executeEngine(apiEngineKey: string, params?: Record<string, unknown>): Promise<ApiResponse>;
    chat(input: {
        question: string;
        systemPrompt?: string;
        aiModel: string;
        aiModelId?: string;
        relayModel?: string;
        conversationId?: string;
        reasoningEffort?: 'auto' | 'low' | 'medium' | 'high';
        mode?: 'chat' | 'data' | 'code' | 'builder' | 'project';
    }): Promise<ApiResponse>;
    /**
     * 调用当前 MCP 身份和租户绑定的 OCR 网关。网络地址、Provider、认证头和
     * OsClient 均不属于本方法参数，避免 MCP 把后端网关变成任意 HTTP 代理。
     */
    recognizeOcr(input: OcrRecognizeRequest): Promise<ApiResponse<OcrRecognizeResult>>;
    /** Calls the current authenticated tenant's server-side translation gateway. */
    translateText(input: TranslateTextRequest): Promise<ApiResponse<TranslateTextResult>>;
    detectLanguage(sourceText: string): Promise<ApiResponse<TranslateDetection[]>>;
    listTranslateLanguages(): Promise<ApiResponse<TranslateLanguage[]>>;
    translateFile(input: TranslateFileRequest): Promise<ApiResponse<TranslateFileResult>>;
    suggestTranslation(input: {
        SourceText: string;
        SuggestedText: string;
        FromLang: string;
        Lang: string;
    }): Promise<ApiResponse<TranslateSuggestionResult>>;
    getTranslateHealth(): Promise<ApiResponse<TranslateHealthResult>>;
    saveEngineCode(apiEngineKey: string, code: string, options?: {
        functionDescription?: string;
        changeSummary?: string;
        confirmLargeReduction?: boolean;
        v8Unlimited?: boolean;
    }): Promise<ApiResponse>;
    updateEngineRuntimeConfig(apiEngineKey: string, v8Unlimited: boolean): Promise<ApiResponse>;
    createEngine(data: {
        ApiEngineKey: string;
        ApiName: string;
        Category?: string;
        Code?: string;
        ApiAddress?: string;
        V8Unlimited?: number;
        functionDescription?: string;
        changeSummary?: string;
    }): Promise<ApiResponse>;
    uploadFileBase64(data: {
        FileName?: string;
        FileByteBase64: string;
        Path?: string;
        FilePathName?: string;
        Limit?: boolean;
        Preview?: boolean;
        TargetTable?: string;
        TargetId?: string;
        TargetField?: string;
    }): Promise<ApiResponse>;
    uploadApplicationAssetStream(data: ApplicationAssetStreamUploadRequest): Promise<ApiResponse>;
    private getApplicationAssetMultipartStatus;
    private uploadApplicationAssetResumable;
    finalizeApplicationStreamPublish(data: ApplicationAssetStreamFinalizeRequest): Promise<ApiResponse>;
    getMicroService(msKey: string): Promise<ApiResponse>;
    listApplications(data?: Record<string, unknown>): Promise<ApiResponse>;
    getApplicationContext(data: Record<string, unknown>): Promise<ApiResponse>;
    getApplicationFile(data: Record<string, unknown>): Promise<ApiResponse>;
    createMicroService(data: Record<string, unknown>): Promise<ApiResponse>;
    syncMicroServiceSource(data: Record<string, unknown>): Promise<ApiResponse>;
    publishMicroService(data: Record<string, unknown>): Promise<ApiResponse>;
    probeMicroAppEntry(msKey: string): Promise<{
        ok: boolean;
        url: string;
        status?: number;
        contentType?: string;
        bodyBytes?: number;
        hasHead?: boolean;
        hasBody?: boolean;
        error?: string;
    }>;
    getTableData(tableName: string, query?: Record<string, unknown>): Promise<ApiResponse>;
    addFormData(tableName: string, row: Record<string, unknown>): Promise<ApiResponse>;
    updateFormData(tableName: string, row: Record<string, unknown>): Promise<ApiResponse>;
    getEventCode(formEngineKey: string, eventType: string, options?: RequestOptions): Promise<ApiResponse<V8Event>>;
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
        V8Unlimited?: number;
    }): Promise<ApiResponse>;
    repairFixedAuditFields(input: {
        tableId?: string;
        tableName?: string;
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
    deleteField(data: {
        Id: string;
        TableId?: string;
        Name?: string;
    }): Promise<ApiResponse>;
    updateField(patch: Record<string, unknown>): Promise<ApiResponse>;
    updateFieldList(patch: Record<string, unknown>): Promise<ApiResponse>;
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
        HasChild?: number;
        OpenType?: string;
        Url?: string;
        Sort?: number;
        Icon?: string;
        SearchFieldIds?: string;
        TableDiyFieldIds?: string;
        DefaultOrderBy?: string;
        SqlWhere?: string;
        MenuBadgeEnabled?: number;
        MenuBadgeApiEngineKey?: string;
        EnableViewSchema?: number;
        ViewSchemaVersion?: string;
        ViewConfigVersion?: number;
        ViewSchema?: string;
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
        IsMicroiService?: number;
        MicroServiceId?: string;
        MicroServicePageId?: string;
        MicroServiceRoutePath?: string;
        MicroServiceKey?: string;
    }): Promise<ApiResponse>;
    setRolePermission(roleId: string, menuIds: string[]): Promise<ApiResponse>;
    listRoles(keyword?: string): Promise<ApiResponse>;
    saveRole(data: Record<string, unknown>): Promise<ApiResponse>;
    listModules(keyword?: string): Promise<ApiResponse>;
    getModule(moduleId: string, options?: RequestOptions): Promise<ApiResponse>;
    updateModule(data: Record<string, unknown>): Promise<ApiResponse>;
    listDataSources(keyword?: string): Promise<ApiResponse>;
    saveDataSource(data: Record<string, unknown>): Promise<ApiResponse>;
    runDataSource(dataSourceKey: string, params?: Record<string, unknown>): Promise<ApiResponse>;
    listPrintTemplates(keyword?: string): Promise<ApiResponse>;
    savePrintTemplate(data: Record<string, unknown>): Promise<ApiResponse>;
    saveWorkflowPackage(data: Record<string, unknown>): Promise<ApiResponse>;
    saveJob(data: Record<string, unknown>): Promise<ApiResponse>;
    listDatabaseBackupTenants(): Promise<ApiResponse>;
    runDatabaseBackup(options: {
        tenantOsClients?: string[];
        retainCount?: number;
        idempotencyKey: string;
    }): Promise<ApiResponse>;
    runBackgroundApiEngine(data: {
        apiEngineKey: string;
        title: string;
        param: Record<string, unknown>;
        options?: Record<string, unknown>;
    }): Promise<ApiResponse>;
    validateLowCodeSystem(manifest: Record<string, unknown>): Promise<ApiResponse>;
    writeAuditLog(action: string, target: string, content: string): Promise<ApiResponse>;
    queryMongodbLogs(query?: MongodbLogQuery): Promise<ApiResponse>;
    writeMongodbLog(log: MongodbLogWrite): Promise<ApiResponse>;
    getRedisStatistics(database?: number, connectionId?: string): Promise<ApiResponse>;
    getRedisKeys(pattern?: string, database?: number, pageSize?: number, cursor?: string, connectionId?: string): Promise<ApiResponse>;
    getRedisKey(key: string, database?: number, pageIndex?: number, pageSize?: number, connectionId?: string): Promise<ApiResponse>;
    deleteRedisKeys(keys: string[], database?: number, connectionId?: string): Promise<ApiResponse>;
    replaceRedisValue(key: string, dataType: string, value: string, database?: number, ttlSeconds?: number, connectionId?: string): Promise<ApiResponse>;
    renameRedisKey(key: string, newKey: string, database?: number, connectionId?: string): Promise<ApiResponse>;
    setRedisTtl(key: string, ttlSeconds: number, database?: number, connectionId?: string): Promise<ApiResponse>;
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
        ExpectedCurrentHash?: string;
        ChangeSummary?: string;
    }): Promise<ApiResponse>;
    listPageEngineHistory(pageId: string, pageIndex?: number, pageSize?: number): Promise<ApiResponse>;
    getPageEngineHistory(pageId: string, historyId: string): Promise<ApiResponse>;
    comparePageEngineVersions(pageId: string, leftHistoryId?: string, rightHistoryId?: string): Promise<ApiResponse>;
    exportPageEngine(pageId: string): Promise<ApiResponse>;
    rollbackPageEngine(data: {
        PageId: string;
        HistoryId: string;
        ExpectedCurrentHash: string;
        ChangeSummary?: string;
    }): Promise<ApiResponse>;
    listBlueprints(keyword?: string): Promise<ApiResponse>;
    getBlueprint(blueprintId: string): Promise<ApiResponse>;
    listBlueprintHistory(blueprintId: string, pageIndex?: number, pageSize?: number): Promise<ApiResponse>;
    getBlueprintHistory(blueprintId: string, historyId: string): Promise<ApiResponse>;
    compareBlueprintVersions(blueprintId: string, leftHistoryId?: string, rightHistoryId?: string): Promise<ApiResponse>;
    exportBlueprint(blueprintId: string): Promise<ApiResponse>;
    saveBlueprint(data: Record<string, unknown>): Promise<ApiResponse>;
    rollbackBlueprint(data: {
        BlueprintId: string;
        HistoryId: string;
        ExpectedCurrentHash: string;
        NewVersion?: string;
        ChangeSummary?: string;
    }): Promise<ApiResponse>;
    deleteBlueprint(blueprintId: string): Promise<ApiResponse>;
    validateBlueprint(blueprintId: string): Promise<ApiResponse>;
    destroy(): void;
}
export {};
//# sourceMappingURL=microi-client.d.ts.map