type RecordValue = Record<string, any>;
export interface ReadPageOptions {
    pageSize?: number;
    cursor?: string;
    maxChars?: number;
}
export interface ContextReadScope {
    identity: () => string;
    key: Buffer;
}
export declare function createContextReadScope(identity: () => string): ContextReadScope;
/** 多次请求是一次读取：只允许首次未登录请求完成后绑定身份，之后变化必须丢弃整个结果。 */
export declare function createReadIdentityGuard(identity: () => string): () => void;
/** 游标绑定连接、查询与快照，不能因翻页或续签混用另一个租户/版本；只保存摘要，不缓存正文或凭据。 */
export declare function readPage<T>(scope: ContextReadScope, query: unknown, items: T[], options?: ReadPageOptions): {
    items: T[];
    Paging: {
        returned: number;
        totalMatched: number;
        offset: number;
        pageSize: number;
        maxChars: number;
        hasMore: boolean;
        nextCursor: string | null;
        snapshotHash: string;
        completeSelection: boolean;
    };
};
export declare function record(value: unknown): RecordValue;
export declare function sortedRecords(value: unknown, key: (item: RecordValue) => string): RecordValue[];
export declare function exactNames(values: string[] | undefined): string[];
/** 摘要是有损视图，明示被省略字段；错误、权限与版本语义保留，完整元数据可显式 detail=full。 */
export declare function applicationSummary(value: unknown): RecordValue;
export declare function sourceFileMetadata(value: unknown): RecordValue;
export declare function isTextSourceFile(file: RecordValue, filePath: string): boolean;
export declare function buildSchemaRead(scope: ContextReadScope, data: RecordValue, options: ReadPageOptions & {
    detail?: 'summary' | 'fields';
    tableName?: string;
    tableNames?: string[];
    fieldNames?: string[];
}): {
    Tables: RecordValue[];
    Paging: {
        unit: string;
        returned: number;
        totalMatched: number;
        offset: number;
        pageSize: number;
        maxChars: number;
        hasMore: boolean;
        nextCursor: string | null;
        snapshotHash: string;
        completeSelection: boolean;
    };
    Selection: {
        requestedTableNames: string[];
        missingTableNames: string[];
        requestedFieldNames: string[];
    };
    Completeness: {
        detailsIncluded: boolean;
        allFieldsSelected: boolean;
        fieldDefinitionsComplete: boolean;
        omittedFieldProperties: string[];
        nextFieldDefinitionRead: {
            action: string;
            params: string;
        };
        matchedTableCount: number;
        scope: string;
        sourceCompleteness: string;
        fieldFilterApplied: boolean;
    };
    ReadSource: RecordValue;
};
export interface SourceReadOptions extends ReadPageOptions {
    detail?: 'text' | 'metadata' | 'full';
    startLine?: number;
    endLine?: number;
    query?: string;
    caseSensitive?: boolean;
}
export declare function buildSourceRead(scope: ContextReadScope, appIdOrKey: string, filePath: string, data: RecordValue, options: SourceReadOptions): {
    ReadSummary: {
        completeFile: boolean;
        contentError: boolean;
        explicitlyRequestedFull?: undefined;
        contentsIncluded?: undefined;
        reason?: undefined;
        sourceSha256?: undefined;
        returnedContentSha256?: undefined;
        lineEndingsNormalized?: undefined;
        followingLineEnding?: undefined;
        totalLines?: undefined;
        requestedStartLine?: undefined;
        requestedEndLine?: undefined;
        returnedStartLine?: undefined;
        returnedEndLine?: undefined;
        searchOnly?: undefined;
    };
    ContentErrorCount: number;
    Application: RecordValue;
    File: RecordValue;
} | {
    File: RecordValue;
    ReadSummary: {
        completeFile: boolean;
        explicitlyRequestedFull: boolean;
        contentError?: undefined;
        contentsIncluded?: undefined;
        reason?: undefined;
        sourceSha256?: undefined;
        returnedContentSha256?: undefined;
        lineEndingsNormalized?: undefined;
        followingLineEnding?: undefined;
        totalLines?: undefined;
        requestedStartLine?: undefined;
        requestedEndLine?: undefined;
        returnedStartLine?: undefined;
        returnedEndLine?: undefined;
        searchOnly?: undefined;
    };
    Application: RecordValue;
} | {
    FileReference: {
        appIdOrKey: string;
        filePath: string;
        next: {
            action: string;
            params: {
                appIdOrKey: string;
                filePath: string;
                detail: string;
            };
        };
    };
    ReadSummary: {
        completeFile: boolean;
        contentsIncluded: boolean;
        reason: string;
        contentError?: undefined;
        explicitlyRequestedFull?: undefined;
        sourceSha256?: undefined;
        returnedContentSha256?: undefined;
        lineEndingsNormalized?: undefined;
        followingLineEnding?: undefined;
        totalLines?: undefined;
        requestedStartLine?: undefined;
        requestedEndLine?: undefined;
        returnedStartLine?: undefined;
        returnedEndLine?: undefined;
        searchOnly?: undefined;
    };
    Application: RecordValue;
    File: RecordValue;
} | {
    Paging: {
        returned: number;
        totalMatched: number;
        offset: number;
        pageSize: number;
        maxChars: number;
        hasMore: boolean;
        nextCursor: string | null;
        snapshotHash: string;
        completeSelection: boolean;
    };
    ReadSummary: {
        completeFile: boolean;
        sourceSha256: string;
        returnedContentSha256: string | null;
        lineEndingsNormalized: boolean;
        followingLineEnding: string;
        totalLines: number;
        requestedStartLine: number;
        requestedEndLine: number;
        returnedStartLine: number;
        returnedEndLine: number | null;
        searchOnly: boolean;
        contentError: boolean;
        explicitlyRequestedFull?: undefined;
        contentsIncluded?: undefined;
        reason?: undefined;
    };
    Matches?: {
        line: number;
        text: string;
    }[] | undefined;
    File: {
        Content?: string | undefined;
    };
    Application: RecordValue;
};
export {};
//# sourceMappingURL=context-reading.d.ts.map