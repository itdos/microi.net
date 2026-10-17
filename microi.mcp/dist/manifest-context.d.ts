type JsonRecord = Record<string, unknown>;
type ToolResult = {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
};
export type ManifestContextInput = {
    manifest?: JsonRecord;
    manifestRef?: string;
    manifestHash?: string;
    detail?: 'summary' | 'full';
};
export type ResolvedManifest = {
    manifest: JsonRecord;
    manifestHash: string;
    manifestRef?: string;
    expiresAt?: number;
    contextNotice?: string;
    /** 仅内部绑定，不输出到工具回执，防止异步执行中身份切换泄漏旧回执。 */
    contextIdentity?: string;
};
/** 规范化只排序对象键，保留数组顺序和文本原字节；不执行用户自定义 toJSON。 */
export declare function canonicalManifestJson(value: unknown): string;
export declare function manifestSha256(manifest: JsonRecord): string;
/**
 * 仅为当前 MCP 注册会话减少重复传输，绝不缓存授权、结构检查通过或远端验收通过的事实。
 * 重启、凭据变化、TTL 或容量淘汰均可丢失；丢失时明确拒绝引用，不自动重放写入。
 */
export declare class ManifestContextStore {
    private readonly getIdentity?;
    private readonly entries;
    private identity;
    private bytes;
    private readonly ttlMs;
    private readonly maxEntries;
    private readonly maxBytes;
    private readonly maxEntryBytes;
    private readonly now;
    constructor(getIdentity?: (() => string) | undefined, options?: {
        ttlMs?: number;
        maxEntries?: number;
        maxBytes?: number;
        maxEntryBytes?: number;
        now?: () => number;
    });
    private synchronizeIdentity;
    private remove;
    private insert;
    private read;
    resolve(input: ManifestContextInput): ResolvedManifest;
    readResult(ref: string, expectedManifestHash?: string): ToolResult;
    /** 每个外部动作重新核对身份，不让一份 A 的计划在异步续签/切换后继续以 B 写入。 */
    assertExecutionIdentity(resolved: ResolvedManifest): void;
    finish(raw: ToolResult, resolved: ResolvedManifest, input: ManifestContextInput, writesRequested: boolean): ToolResult;
}
export type ManifestIdentityFailure = {
    method: string;
    phase: 'before' | 'after';
    message: string;
    response?: unknown;
};
/**
 * 原业务编排仍调用原 MicroiClient 方法；代理只增加请求边界身份门禁。
 * “后检查”失败时不能丢弃已返回的写入回执，也不能把新身份的回读视为旧计划验收。
 */
export declare function bindManifestExecutionClient<T extends object>(client: T, store: ManifestContextStore, resolved: ResolvedManifest): {
    client: T;
    failure?: ManifestIdentityFailure;
};
/** 只压缩已明确成功的逐步回执；失败、警告和最终验收 envelope 完整保留。 */
export declare function summarizeManifestResult(payload: JsonRecord): JsonRecord;
export {};
//# sourceMappingURL=manifest-context.d.ts.map