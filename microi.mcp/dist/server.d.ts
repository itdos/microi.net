import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiResponse, MicroiClient } from './microi-client.js';
/** MCP Server 上下文（用于区分不同租户） */
export interface McpServerContext {
    osClient: string;
    apiBaseUrl: string;
    /** 服务器显示名称（SysTitle），与 mcp.json 中的 key 一致 */
    label: string;
    /** Codex compatibility mode exposes only microi_codex at protocol level. */
    codexMode?: boolean;
}
export interface LocalApplicationAsset {
    absolutePath: string;
    relativePath: string;
    size: number;
    sha256: string;
    isEntry: boolean;
}
export interface LocalApplicationAssetManifest {
    rootDirectory: string;
    entryPath: string;
    assets: LocalApplicationAsset[];
    totalSize: number;
    manifestHash: string;
    skippedSourceMaps: string[];
}
/**
 * Inspect and hash a built directory without loading any file wholly into RAM.
 * The hard caps also stop accidental node_modules/.git/trash-directory loops.
 */
export declare function buildLocalApplicationAssetManifest(rootDirectory: string, entryPath?: string, options?: {
    includeSourceMaps?: boolean;
    maxFiles?: number;
    maxTotalBytes?: number;
}): Promise<LocalApplicationAssetManifest>;
export interface LegacyStreamPublishFallbackResult {
    attempted: boolean;
    reason: string;
    appKey?: string;
    response?: ApiResponse;
}
/**
 * A short-lived compatibility detector for API nodes that predate the strongly
 * typed HDFS selector fix. Those nodes fail before writing the first asset when
 * the dynamic runtime tries to invoke Dos.Common.Val<T> on a JValue.
 */
export declare function isLegacyApplicationStreamJValueFailure(result?: Partial<ApiResponse> | null): boolean;
/**
 * Bridge a rolling-upgrade window without retrying the broken stream endpoint.
 * The fallback is deliberately restricted to small existing MicroServices: it
 * uses the legacy C# PublishMicroService JSON endpoint, never Jint, and refuses
 * Web/UniApp or large directories rather than silently changing their runtime.
 */
export declare function tryLegacyMicroServiceStreamPublishFallback(client: MicroiClient, manifest: LocalApplicationAssetManifest, input: {
    appIdOrKey: string;
    versionNo: string;
    routes?: Array<Record<string, unknown>>;
    deliveryBatchId: string;
    sourceManifestHash?: string;
}): Promise<LegacyStreamPublishFallbackResult>;
interface AccessKeyCreationConfirmationInput {
    name: string;
    allowedRoutes: string[];
    allowedTableNames: string[];
    scopes?: string[];
    redirectPath?: string;
    allowedApiEngineKeys?: string[];
    allowedDataSourceKeys?: string[];
    expiresAt?: string;
    remark?: string;
}
/**
 * Canonicalize the effective access-key grant before asking for confirmation.
 * The returned SHA-256 binds confirmation to scopes, allowlists and expiry,
 * rather than only to a reusable display name.
 */
export declare function buildAccessKeyCreationConfirmation(input: AccessKeyCreationConfirmationInput): {
    normalized: Required<AccessKeyCreationConfirmationInput>;
    sha256: string;
};
/**
 * 创建 MCP Server 并注册所有工具
 * @param client - Microi API 客户端
 * @param context - 服务器上下文（OsClient、API地址），用于在 instructions 中标识身份
 */
export declare function createMcpServer(client: MicroiClient, context: McpServerContext): McpServer;
export {};
//# sourceMappingURL=server.d.ts.map